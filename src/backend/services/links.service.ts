import { run, get, all } from '../db';
import { logAudit } from './audit.service';
import { is18047Day, is18048Day, normalizeEffectiveDate } from './helpers.service';
import { syncLRSheetRecord } from './sync.service';

export async function getLinkSets(categoryId?: any) {
  let sql = `
    SELECT 
      ls.*,
      c.name as category_name,
      p.name as cloned_from_name,
      (SELECT COUNT(*) FROM links l WHERE l.link_set_id = ls.id) as link_count
    FROM link_sets ls
    LEFT JOIN categories c ON ls.category_id = c.id
    LEFT JOIN link_sets p ON ls.cloned_from_id = p.id
  `;
  const params: any[] = [];
  if (categoryId && categoryId !== 'ALL') {
    sql += ' WHERE ls.category_id = ?';
    params.push(categoryId);
  }
  sql += ' ORDER BY ls.category_id ASC, CASE WHEN ls.status = "published" THEN 0 ELSE 1 END, ls.id DESC';
  return await all(sql, params);
}

export async function getLinkSetById(id: any) {
  const set = await get(`
    SELECT 
      ls.*,
      c.name as category_name,
      p.name as cloned_from_name,
      (SELECT COUNT(*) FROM links l WHERE l.link_set_id = ls.id) as link_count
    FROM link_sets ls
    LEFT JOIN categories c ON ls.category_id = c.id
    LEFT JOIN link_sets p ON ls.cloned_from_id = p.id
    WHERE ls.id = ?
  `, [id]);
  if (!set) throw { status: 404, message: 'Link set not found' };
  const links = await all('SELECT * FROM links WHERE link_set_id = ? ORDER BY link_number ASC, id ASC', [id]);
  return { ...set, links };
}

export async function duplicateLinkSet(id: any, customName?: string) {
  const origSet = await get('SELECT * FROM link_sets WHERE id = ?', [id]);
  if (!origSet) throw { status: 404, message: 'Source link set not found' };

  const newName = customName && customName.trim()
    ? customName.trim()
    : `${origSet.name} (Draft Copy)`;

  const setInsert = await run(
    `INSERT INTO link_sets (category_id, name, status, effective_from, effective_to, cloned_from_id)
     VALUES (?, ?, 'draft', '', '9999-12-31', ?)`,
    [origSet.category_id, newName, origSet.id]
  );
  const newSetId = setInsert.lastID;

  let origLinks: any[] = await all('SELECT * FROM links WHERE link_set_id = ? ORDER BY link_number ASC, id ASC', [origSet.id]);
  if (!origLinks || origLinks.length === 0) {
    origLinks = await all(
      'SELECT * FROM links WHERE category_id = ? AND (status = "published" OR status IS NULL OR status = "") ORDER BY link_number ASC, id ASC',
      [origSet.category_id]
    );
  }

  for (const link of origLinks) {
    await run(
      `INSERT INTO links (category_id, link_set_id, link_number, train_numbers, from_station, to_station, coaches, is_rest, effective_from, effective_to, set_type, set_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [
        origSet.category_id,
        newSetId,
        link.link_number,
        link.train_numbers || '',
        link.from_station || '',
        link.to_station || '',
        link.coaches || '',
        link.is_rest ? 1 : 0,
        '',
        '9999-12-31',
        link.set_type || '2-Day Set',
        link.set_name || null
      ]
    );
  }

  await logAudit(
    'Admin',
    'DUPLICATE_LINK_SET',
    `Duplicated Link Set "${origSet.name}" (#${origSet.id}) into Draft Set #${newSetId} with ${origLinks.length} links`,
    {
      action: 'DUPLICATE_LINK_SET',
      created_set_id: newSetId
    }
  );

  return {
    success: true,
    id: newSetId,
    name: newName,
    category_id: origSet.category_id,
    status: 'draft',
    effective_from: '',
    cloned_from_id: origSet.id,
    cloned_from_name: origSet.name,
    link_count: origLinks.length,
    message: 'Link set duplicated as draft successfully'
  };
}

export async function updateLinkSet(id: any, body: any) {
  const { name, effective_from, effective_to, status } = body;
  const origSet = await get('SELECT * FROM link_sets WHERE id = ?', [id]);
  if (!origSet) throw { status: 404, message: 'Link set not found' };

  let newStatus = origSet.status;
  if (origSet.status === 'draft') {
    newStatus = 'draft';
  } else if (status !== undefined) {
    newStatus = status;
  }

  const newFrom = effective_from !== undefined ? (effective_from && effective_from.trim() ? effective_from.trim() : null) : origSet.effective_from;
  const newTo = effective_to !== undefined ? (effective_to && effective_to.trim() ? effective_to.trim() : '9999-12-31') : origSet.effective_to;

  await run(
    `UPDATE link_sets 
     SET name = COALESCE(?, name),
         effective_from = ?,
         effective_to = ?,
         status = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [name, newFrom, newTo, newStatus, id]
  );

  if (effective_from !== undefined) {
    await run('UPDATE links SET effective_from = ? WHERE link_set_id = ?', [newFrom || '', id]);
  }
  if (effective_to !== undefined) {
    await run('UPDATE links SET effective_to = ? WHERE link_set_id = ?', [newTo || '9999-12-31', id]);
  }
  if (newStatus !== origSet.status || origSet.status === 'draft') {
    await run('UPDATE links SET status = ? WHERE link_set_id = ?', [newStatus, id]);
  }

  await logAudit('Admin', 'UPDATE_LINK_SET', `Updated Link Set #${id} (${name || origSet.name}) [Effective: ${newFrom} to ${newTo}]`, {
    action: 'UPDATE_LINK_SET',
    link_set_id: id,
    previous: origSet,
    effective_from: newFrom,
    effective_to: newTo
  });

  return { success: true, message: 'Link set updated successfully', effective_from: newFrom, effective_to: newTo };
}

export async function publishLinkSet(id: any, body: any) {
  const { effective_from, effective_to } = body || {};
  const origSet = await get('SELECT * FROM link_sets WHERE id = ?', [id]);
  if (!origSet) throw { status: 404, message: 'Link set not found' };

  const effDate = (effective_from && effective_from.trim()) ? effective_from.trim() : (origSet.effective_from || new Date().toISOString().split('T')[0]);
  const effTo = (effective_to && effective_to.trim()) ? effective_to.trim() : (origSet.effective_to || '9999-12-31');
  const prevEnd = new Date(new Date(effDate).getTime() - 86400000).toISOString().split('T')[0];

  await run(
    `UPDATE link_sets 
     SET status = 'published',
         effective_from = ?,
         effective_to = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [effDate, effTo, id]
  );

  await run(
    `UPDATE links 
     SET status = 'published',
         effective_from = ?,
         effective_to = ?
     WHERE link_set_id = ?`,
    [effDate, effTo, id]
  );

  if (origSet.category_id) {
    await run(
      `UPDATE link_sets 
       SET effective_to = ? 
       WHERE category_id = ? AND id != ? AND status = 'published' AND date(effective_from) < date(?) AND (effective_to = '9999-12-31' OR date(effective_to) >= date(?))`,
      [prevEnd, origSet.category_id, id, effDate, effDate]
    );

    await run(
      `UPDATE links 
       SET effective_to = ? 
       WHERE category_id = ? AND (link_set_id != ? OR link_set_id IS NULL) AND (status = 'published' OR status IS NULL OR status = '') AND date(effective_from) < date(?) AND (effective_to = '9999-12-31' OR date(effective_to) >= date(?))`,
      [prevEnd, origSet.category_id, id, effDate, effDate]
    );

    const memberCount = await get('SELECT count(*) as c FROM links WHERE link_set_id = ?', [id]);
    if (memberCount && memberCount.c > 0) {
      await run('UPDATE categories SET cycle_length = ? WHERE id = ?', [memberCount.c, origSet.category_id]);
    }
  }

  await logAudit('Admin', 'PUBLISH_LINK_SET', `Published Link Set #${id} "${origSet.name}" with effective date ${effDate}`, {
    action: 'PUBLISH_LINK_SET',
    link_set_id: id,
    previous_status: origSet.status,
    previous_effective_from: origSet.effective_from,
    previous_effective_to: origSet.effective_to,
    category_id: origSet.category_id,
    prev_end: prevEnd
  });

  return { success: true, message: `Link set "${origSet.name}" published successfully with effective date ${effDate}!` };
}

export async function deleteLinkSet(id: any) {
  const origSet = await get('SELECT * FROM link_sets WHERE id = ?', [id]);
  if (!origSet) throw { status: 404, message: 'Link set not found' };

  const origLinks = await all('SELECT * FROM links WHERE link_set_id = ?', [id]);

  await run('DELETE FROM links WHERE link_set_id = ?', [id]);
  await run('DELETE FROM link_sets WHERE id = ?', [id]);

  await logAudit('Admin', 'DELETE_LINK_SET', `Deleted Link Set #${id} "${origSet.name}" and all its links`, {
    action: 'DELETE_LINK_SET',
    deleted_set: origSet,
    deleted_links: origLinks
  });

  return { success: true, message: 'Link set deleted successfully' };
}

export async function getLinks(query: any) {
  const { category_id, link_set_id, status, date, month } = query;
  let sql = 'SELECT * FROM links WHERE 1=1';
  const params: any[] = [];
  if (link_set_id) {
    sql += ' AND link_set_id = ?';
    params.push(link_set_id);
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
  } else {
    if (date) {
      sql += ' AND (effective_from IS NULL OR date(effective_from) <= date(?)) AND (effective_to IS NULL OR date(?) <= date(effective_to))';
      params.push(date, date);
    } else if (month) {
      const [yStr, mStr] = month.split('-');
      const lastDay = new Date(parseInt(yStr, 10), parseInt(mStr, 10), 0).getDate();
      const startOfMonth = `${month}-01`;
      const endOfMonth = `${month}-${String(lastDay).padStart(2, '0')}`;
      sql += ' AND (effective_from IS NULL OR date(effective_from) <= date(?)) AND (effective_to IS NULL OR date(effective_to) >= date(?))';
      params.push(endOfMonth, startOfMonth);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
      if (status === 'published') {
        sql += ' AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = "published" OR status IS NULL))';
      }
    } else {
      sql += " AND (status = 'published' OR status IS NULL OR status = '') AND (status != 'draft') AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = 'published' OR status IS NULL))";
    }
    if (category_id && category_id !== 'ALL') {
      sql += ' AND category_id = ?';
      params.push(category_id);
    }
  }
  sql += ' ORDER BY category_id, CAST(link_number AS SIGNED) ASC, link_number ASC, date(effective_from) DESC';
  let links: any[] = await all(sql, params);

  if (date) {
    links = links.map(link => {
      const num = parseInt(link.link_number, 10);
      const cat = parseInt(link.category_id, 10);
      if ((cat === 1 && num === 15) || (cat === 2 && num === 50)) {
        const is18047 = is18047Day(date);
        return {
          ...link,
          train_numbers: cat === 1 ? (is18047 ? '67230, 18047' : '67230, 17225') : (is18047 ? 'PILOT(67230), 18047' : 'PILOT(67230), 17225')
        };
      } else if (cat === 1 && num === 16) {
        const d = new Date(date + (date.includes('T') ? '' : 'T00:00:00'));
        const dow = d.getDay();
        const inT = (dow === 0 || dow === 2 || dow === 5) ? '17225' : '18047';
        const retT = is18048Day(date) ? '18048' : '17226';
        return { ...link, train_numbers: `${inT}, ${retT}` };
      } else if (cat === 1 && num === 17) {
        const retT = is18048Day(date) ? '18048' : '17226';
        return { ...link, train_numbers: `${retT}, 57201` };
      } else if (cat === 2 && num === 51) {
        const d = new Date(date + (date.includes('T') ? '' : 'T00:00:00'));
        const dow = d.getDay();
        const inT = (dow === 0 || dow === 2 || dow === 5) ? '17225' : '18047';
        const retT = is18048Day(date) ? '18048' : '17226';
        return { ...link, train_numbers: `${inT}, ${retT}` };
      } else if (cat === 2 && num === 52) {
        const retT = is18048Day(date) ? '18048' : '17226';
        return { ...link, train_numbers: `${retT}, PILOT(12703)` };
      }
      return link;
    });
  }
  return links;
}

export async function reorderLinks(reorders: any[]) {
  if (!Array.isArray(reorders)) {
    throw { status: 400, message: 'Invalid reorders data' };
  }
  const ids = reorders.map(r => r.id);
  const prevRows = await all(`SELECT id, link_number FROM links WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  for (const item of reorders) {
    await run('UPDATE links SET link_number = ? WHERE id = ?', [item.link_number, item.id]);
  }
  await logAudit('Admin', 'REORDER_LINKS', `Reordered ${reorders.length} link numbers in train roster`, {
    action: 'REORDER_LINKS',
    previous_reorders: prevRows
  });
  return { message: 'Links reordered successfully' };
}

export async function createLink(body: any) {
  const { category_id, link_set_id, link_number, train_numbers, from_station, to_station, coaches, is_rest, effective_from, set_type, set_name, status } = body;

  let isDraft = status === 'draft';
  if (link_set_id) {
    const parentSet = await get('SELECT status FROM link_sets WHERE id = ?', [link_set_id]);
    if (parentSet && parentSet.status === 'draft') {
      isDraft = true;
    }
  }

  if (!category_id || !link_number) {
    throw { status: 400, message: 'Category ID and Link Number are required' };
  }
  if (!isDraft && !effective_from) {
    throw { status: 400, message: 'Effective From date is required' };
  }

  if (!isDraft && effective_from) {
    const previous = await get(
      `SELECT * FROM links 
       WHERE category_id = ? AND link_number = ? AND (status = 'published' OR status IS NULL) AND effective_to = '9999-12-31' 
         AND date(effective_from) < date(?)
         AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = 'published' OR status IS NULL))`,
      [category_id, link_number, effective_from]
    );
    if (previous) {
      const prevEnd = new Date(new Date(effective_from).getTime() - 86400000).toISOString().split('T')[0];
      await run('UPDATE links SET effective_to = ? WHERE id = ?', [prevEnd, previous.id]);
    }
  }

  const result = await run(
    `INSERT INTO links (category_id, link_set_id, link_number, train_numbers, from_station, to_station, coaches, is_rest, effective_from, effective_to, set_type, set_name, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      category_id,
      link_set_id || null,
      link_number,
      train_numbers || '',
      from_station || '',
      to_station || '',
      coaches || '',
      is_rest ? 1 : 0,
      effective_from || '',
      '9999-12-31',
      set_type || '2-Day Set',
      set_name || null,
      isDraft ? 'draft' : (status || 'published')
    ]
  );

  await logAudit(
    'Admin',
    'CREATE_LINK',
    `Created Link ${link_number} for Category ${category_id}${isDraft ? ' (Draft)' : ''}`,
    {
      action: 'CREATE_LINK',
      created_link_id: result.lastID,
      category_id,
      link_set_id
    }
  );

  return { id: result.lastID };
}

export async function updateLink(id: any, body: any) {
  const existing = await get('SELECT * FROM links WHERE id = ?', [id]);
  if (!existing) throw { status: 404, message: 'Link not found' };

  const link_set_id = body.link_set_id !== undefined ? body.link_set_id : existing.link_set_id;
  let status = body.status !== undefined ? body.status : existing.status;
  if (link_set_id) {
    const parentSet = await get('SELECT status FROM link_sets WHERE id = ?', [link_set_id]);
    if (parentSet && parentSet.status === 'draft') {
      status = 'draft';
    }
  }

  const train_numbers = body.train_numbers !== undefined ? body.train_numbers : existing.train_numbers;
  const from_station = body.from_station !== undefined ? body.from_station : existing.from_station;
  const to_station = body.to_station !== undefined ? body.to_station : existing.to_station;
  const coaches = body.coaches !== undefined ? body.coaches : existing.coaches;
  const is_rest = body.is_rest !== undefined ? (body.is_rest ? 1 : 0) : existing.is_rest;
  const effective_from = body.effective_from !== undefined ? body.effective_from : existing.effective_from;
  const effective_to = body.effective_to !== undefined ? body.effective_to : existing.effective_to;
  const set_type = body.set_type !== undefined ? body.set_type : existing.set_type;
  const set_name = body.set_name !== undefined ? body.set_name : existing.set_name;
  const link_number = body.link_number !== undefined ? (parseInt(body.link_number, 10) || null) : existing.link_number;
  const category_id = body.category_id !== undefined ? (parseInt(body.category_id, 10) || null) : existing.category_id;

  await run(
    `UPDATE links 
     SET train_numbers = ?, from_station = ?, to_station = ?, coaches = ?, is_rest = ?, 
         effective_from = ?, effective_to = ?, set_type = ?, set_name = ?,
         link_number = ?, category_id = ?, link_set_id = ?, status = ?
     WHERE id = ?`,
    [
      train_numbers, from_station, to_station, coaches, is_rest,
      effective_from, effective_to, set_type, set_name,
      link_number, category_id, link_set_id, status,
      id
    ]
  );

  await logAudit(
    'Admin',
    'UPDATE_LINK',
    `Updated Link ID ${id}${train_numbers ? ` (Train: ${train_numbers})` : ''} (Link #${link_number})`,
    {
      action: 'UPDATE_LINK',
      link_id: id,
      previous: existing
    }
  );

  const updated = await get('SELECT * FROM links WHERE id = ?', [id]);
  return { message: 'Link updated successfully', link: updated };
}

export async function deleteLink(id: any, rawDate?: string, user?: any) {
  const effectiveDate = normalizeEffectiveDate(rawDate || '2026-10-01');

  const target = await get('SELECT * FROM links WHERE id = ?', [id]);
  if (!target) throw { status: 404, message: 'Link not found' };

  const deletedLinkNum = target.link_number;
  const catId = target.category_id;
  const linkSetId = target.link_set_id;

  let isDraftLink = target.status === 'draft';
  if (linkSetId) {
    const parentSet = await get('SELECT status FROM link_sets WHERE id = ?', [linkSetId]);
    if (parentSet && parentSet.status === 'draft') {
      isDraftLink = true;
    }
  }

  await run('DELETE FROM links WHERE id = ?', [id]);

  if (!isDraftLink) {
    await run('DELETE FROM train_ta_nda_rules WHERE category_id = ? AND link_number = ?', [catId, deletedLinkNum]);
  }

  let subsequentLinks: any[] = [];
  if (linkSetId) {
    subsequentLinks = await all(
      'SELECT id, link_number FROM links WHERE link_set_id = ? AND link_number > ? ORDER BY link_number ASC',
      [linkSetId, deletedLinkNum]
    );
  } else {
    subsequentLinks = await all(
      `SELECT id, link_number FROM links 
       WHERE category_id = ? AND link_set_id IS NULL AND link_number > ? 
         AND (status = ? OR (status IS NULL AND ? = 'published'))
       ORDER BY link_number ASC`,
      [catId, deletedLinkNum, isDraftLink ? 'draft' : 'published', isDraftLink ? 'draft' : 'published']
    );
  }

  let shiftedCount = 0;
  for (const link of subsequentLinks) {
    const oldNum = link.link_number;
    const newNum = oldNum - 1;

    if (isDraftLink) {
      await run('UPDATE links SET link_number = ? WHERE id = ?', [newNum, link.id]);
    } else {
      await run(
        'UPDATE links SET link_number = ?, effective_from = ? WHERE id = ?',
        [newNum, effectiveDate, link.id]
      );
      await run(
        'UPDATE train_ta_nda_rules SET link_number = ? WHERE category_id = ? AND link_number = ?',
        [newNum, catId, oldNum]
      );
    }
    shiftedCount++;
  }

  if (linkSetId) {
    await run('UPDATE link_sets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [linkSetId]);
  }

  await logAudit(
    user?.username || 'Admin',
    'DELETE_LINK_AND_SHIFT',
    `Deleted Link #${deletedLinkNum} (Cat ${catId}). Shifted ${shiftedCount} subsequent links up by 1 with effective date ${effectiveDate}.`,
    {
      action: 'DELETE_LINK_AND_SHIFT',
      deleted_link: target,
      subsequent_links_shifted: subsequentLinks,
      effective_date: effectiveDate
    }
  );

  return {
    message: `Link #${deletedLinkNum} deleted. ${shiftedCount} subsequent links moved to previous numbered links in order.`,
    deleted_link: deletedLinkNum,
    shifted_count: shiftedCount,
    effective_from: effectiveDate
  };
}

export async function clearAllLinks(link_set_id?: any) {
  if (link_set_id) {
    await run('DELETE FROM links WHERE link_set_id = ?', [link_set_id]);
    await logAudit('Admin', 'CLEAR_LINKS_IN_SET', `Cleared all links for Link Set #${link_set_id}`);
  } else {
    await run("DELETE FROM links WHERE status = 'published' OR status IS NULL");
    await logAudit('Admin', 'CLEAR_ALL_LINKS', 'Cleared all published roster links');
  }
  return { message: 'Links cleared successfully' };
}

export async function getSlotCustomizations() {
  const rows: any[] = await all('SELECT * FROM slot_customizations');
  const result: Record<string, any> = {};
  for (const row of rows) {
    result[row.custom_key] = {
      firstTrain: row.first_train || '',
      lastTrain: row.last_train || '',
      firstCoach: row.first_coach || '',
      lastCoach: row.last_coach || ''
    };
  }
  return result;
}

export async function saveSlotCustomization(body: any) {
  const { key, slot_id, link_num, category_id, first_train, last_train, first_coach, last_coach, links_to_update } = body;
  if (!key && !slot_id) {
    throw { status: 400, message: 'Custom key or slot_id is required' };
  }
  const targetKey = key || `slot_${slot_id}`;
  const prevCustomization = await get('SELECT * FROM slot_customizations WHERE custom_key = ?', [targetKey]);
  const cleanFirstTrain = first_train !== undefined && first_train !== null ? String(first_train).trim() : null;
  const cleanLastTrain = last_train !== undefined && last_train !== null ? String(last_train).trim() : null;
  const cleanFirstCoach = first_coach !== undefined && first_coach !== null ? String(first_coach).trim() : null;
  const cleanLastCoach = last_coach !== undefined && last_coach !== null ? String(last_coach).trim() : null;

  await run(
    `INSERT INTO slot_customizations (custom_key, first_train, last_train, first_coach, last_coach, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(custom_key) DO UPDATE SET
       first_train = COALESCE(excluded.first_train, first_train),
       last_train = COALESCE(excluded.last_train, last_train),
       first_coach = COALESCE(excluded.first_coach, first_coach),
       last_coach = COALESCE(excluded.last_coach, last_coach),
       updated_at = CURRENT_TIMESTAMP`,
    [targetKey, cleanFirstTrain, cleanLastTrain, cleanFirstCoach, cleanLastCoach]
  );

  if (Array.isArray(links_to_update) && links_to_update.length > 0) {
    for (const l of links_to_update) {
      if (l.category_id && l.link_num && cleanFirstTrain) {
        const formattedTrain = cleanLastTrain ? `${cleanFirstTrain}, ${cleanLastTrain}` : cleanFirstTrain;
        await run(
          `UPDATE links SET train_numbers = ? WHERE category_id = ? AND link_number = ? AND (status = 'published' OR status IS NULL OR status = '')`,
          [formattedTrain, l.category_id, l.link_num]
        );
      }
    }
  } else if (category_id && link_num && cleanFirstTrain) {
    const formattedTrain = cleanLastTrain ? `${cleanFirstTrain}, ${cleanLastTrain}` : cleanFirstTrain;
    await run(
      `UPDATE links SET train_numbers = ? WHERE category_id = ? AND link_number = ? AND (status = 'published' OR status IS NULL OR status = '')`,
      [formattedTrain, category_id, link_num]
    );
  }

  await logAudit(
    'Admin',
    'UPDATE_SLOT_TRAIN_COACH',
    `Updated train/coaches for ${targetKey} (Train: ${cleanFirstTrain || ''} / ${cleanLastTrain || ''})`,
    {
      action: 'UPDATE_SLOT_TRAIN_COACH',
      target_key: targetKey,
      previous_customization: prevCustomization
    }
  );
  return { success: true, message: 'Train & Coach customization saved successfully' };
}

export async function resetSlotCustomizations(body: any) {
  const { keys, key } = body;
  const keysToReset = Array.isArray(keys) && keys.length > 0 ? keys : (key ? [key] : []);
  let prevCustomizations: any[] = [];
  if (keysToReset.length > 0) {
    prevCustomizations = await all(`SELECT * FROM slot_customizations WHERE custom_key IN (${keysToReset.map(() => '?').join(',')})`, keysToReset);
    for (const k of keysToReset) {
      await run('DELETE FROM slot_customizations WHERE custom_key = ?', [k]);
    }
  }
  await logAudit('Admin', 'RESET_SLOT_TRAIN_COACH', 'Reset slot train/coach customizations to default', {
    action: 'RESET_SLOT_TRAIN_COACH',
    previous_customizations: prevCustomizations
  });
  return { success: true, message: 'Customizations reset to baseline' };
}

export async function getTrainTaNdaRules() {
  const rules: any[] = await all('SELECT * FROM train_ta_nda_rules ORDER BY category_id, link_number, train_number');
  const map: Record<string, any> = {};
  for (const r of rules) {
    map[`${r.category_id}_${r.link_number}_${r.train_number}`] = r;
  }
  return { success: true, rules, map };
}

export async function saveTrainTaNdaRule(body: any, user: any) {
  const catId = body.category_id || body.categoryId;
  const linkNum = body.link_number || body.linkNumber;
  const trainNum = body.train_number || body.trainNumber;
  const taPctRaw = body.ta_percentage !== undefined ? body.ta_percentage : body.taPercentage;
  const taAmtRaw = body.ta_amount !== undefined ? body.ta_amount : body.taAmount;
  const ndaHoursRaw = body.nda_hours !== undefined ? body.nda_hours : body.ndaHours;
  const ndaAmtRaw = body.nda_amount !== undefined ? body.nda_amount : body.ndaAmount;
  const absenceRaw = body.absence_hours !== undefined ? body.absence_hours : body.absenceHours;
  const remarks = body.remarks || null;
  const actualArrTime = body.actual_arr_time || body.actualArrTime || null;
  const schedArrTime = body.sched_arr_time || body.schedArrTime || null;
  const extraNextDayTa = body.extra_next_day_ta !== undefined ? parseFloat(body.extra_next_day_ta) : (body.extraNextDayTa !== undefined ? parseFloat(body.extraNextDayTa) : 0);
  const ntesStatus = body.ntes_status || body.ntesStatus || null;

  if (!catId || !linkNum || !trainNum) {
    throw { status: 400, message: 'category_id, link_number, and train_number are required' };
  }

  const cleanCat = parseInt(catId, 10);
  const cleanLink = parseInt(linkNum, 10);
  const cleanTrain = String(trainNum).trim();
  const cleanTaPct = taPctRaw !== undefined && taPctRaw !== null ? parseFloat(taPctRaw) : 0.7;
  const cleanTaAmt = taAmtRaw !== undefined && taAmtRaw !== null ? parseInt(taAmtRaw, 10) : Math.round(cleanTaPct * 800);
  const cleanNdaHours = ndaHoursRaw !== undefined && ndaHoursRaw !== null ? parseFloat(ndaHoursRaw) : 0;
  const cleanNdaAmt = ndaAmtRaw !== undefined && ndaAmtRaw !== null ? parseInt(ndaAmtRaw, 10) : Math.round(cleanNdaHours * 168);
  const cleanAbsence = absenceRaw !== undefined && absenceRaw !== null ? parseFloat(absenceRaw) : 0;
  const updatedBy = user?.username || user?.name || 'Admin';

  await run(`
    INSERT INTO train_ta_nda_rules (
      category_id, link_number, train_number, ta_percentage, ta_amount, nda_hours, nda_amount, absence_hours, remarks,
      actual_arr_time, sched_arr_time, extra_next_day_ta, ntes_status, updated_by, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(category_id, link_number, train_number) DO UPDATE SET
      ta_percentage = excluded.ta_percentage,
      ta_amount = excluded.ta_amount,
      nda_hours = excluded.nda_hours,
      nda_amount = excluded.nda_amount,
      absence_hours = excluded.absence_hours,
      remarks = excluded.remarks,
      actual_arr_time = excluded.actual_arr_time,
      sched_arr_time = excluded.sched_arr_time,
      extra_next_day_ta = excluded.extra_next_day_ta,
      ntes_status = excluded.ntes_status,
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
  `, [cleanCat, cleanLink, cleanTrain, cleanTaPct, cleanTaAmt, cleanNdaHours, cleanNdaAmt, cleanAbsence, remarks, actualArrTime, schedArrTime, extraNextDayTa, ntesStatus, updatedBy]);

  const updated = await get(
    'SELECT * FROM train_ta_nda_rules WHERE category_id = ? AND link_number = ? AND train_number = ?',
    [cleanCat, cleanLink, cleanTrain]
  );

  await logAudit(updatedBy, 'UPDATE_TRAIN_TA_NDA', `Updated TA/NDA for Train ${cleanTrain} (Cat ${cleanCat} Link #${cleanLink}): TA ${cleanTaPct}, extra ${extraNextDayTa}, NDA ${cleanNdaHours}h`);
  return { success: true, rule: updated };
}

export async function batchSaveTrainTaNdaRules(rules: any[], user: any) {
  if (!Array.isArray(rules) || rules.length === 0) {
    throw { status: 400, message: 'Array of rules is required' };
  }

  const updatedBy = user?.username || user?.name || 'Admin';
  let savedCount = 0;
  let errorCount = 0;
  const errors: any[] = [];

  for (const r of rules) {
    try {
      const catId = r.category_id || r.categoryId;
      const linkNum = r.link_number || r.linkNumber;
      const trainNum = r.train_number || r.trainNumber;
      if (!catId || !linkNum || !trainNum) {
        throw new Error('Missing category_id, link_number, or train_number');
      }

      const cleanCat = parseInt(catId, 10);
      const cleanLink = parseInt(linkNum, 10);
      const cleanTrain = String(trainNum).trim();
      const taPctRaw = r.ta_percentage !== undefined ? r.ta_percentage : r.taPercentage;
      const taAmtRaw = r.ta_amount !== undefined ? r.ta_amount : r.taAmount;
      const ndaHoursRaw = r.nda_hours !== undefined ? r.nda_hours : r.ndaHours;
      const ndaAmtRaw = r.nda_amount !== undefined ? r.nda_amount : r.ndaAmount;
      const absenceRaw = r.absence_hours !== undefined ? r.absence_hours : r.absenceHours;
      const actualArrTime = r.actual_arr_time || r.actualArrTime || null;
      const schedArrTime = r.sched_arr_time || r.schedArrTime || null;
      const extraNextDayTa = r.extra_next_day_ta !== undefined ? parseFloat(r.extra_next_day_ta) : (r.extraNextDayTa !== undefined ? parseFloat(r.extraNextDayTa) : 0);
      const ntesStatus = r.ntes_status || r.ntesStatus || null;

      const cleanTaPct = taPctRaw !== undefined && taPctRaw !== null ? parseFloat(taPctRaw) : 0.7;
      const cleanTaAmt = taAmtRaw !== undefined && taAmtRaw !== null ? parseInt(taAmtRaw, 10) : Math.round(cleanTaPct * 800);
      const cleanNdaHours = ndaHoursRaw !== undefined && ndaHoursRaw !== null ? parseFloat(ndaHoursRaw) : 0;
      const cleanNdaAmt = ndaAmtRaw !== undefined && ndaAmtRaw !== null ? parseInt(ndaAmtRaw, 10) : Math.round(cleanNdaHours * 168);
      const cleanAbsence = absenceRaw !== undefined && absenceRaw !== null ? parseFloat(absenceRaw) : 0;

      await run(`
        INSERT INTO train_ta_nda_rules (
          category_id, link_number, train_number, ta_percentage, ta_amount, nda_hours, nda_amount, absence_hours, remarks,
          actual_arr_time, sched_arr_time, extra_next_day_ta, ntes_status, updated_by, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(category_id, link_number, train_number) DO UPDATE SET
          ta_percentage = excluded.ta_percentage,
          ta_amount = excluded.ta_amount,
          nda_hours = excluded.nda_hours,
          nda_amount = excluded.nda_amount,
          absence_hours = excluded.absence_hours,
          remarks = excluded.remarks,
          actual_arr_time = excluded.actual_arr_time,
          sched_arr_time = excluded.sched_arr_time,
          extra_next_day_ta = excluded.extra_next_day_ta,
          ntes_status = excluded.ntes_status,
          updated_by = excluded.updated_by,
          updated_at = CURRENT_TIMESTAMP
      `, [cleanCat, cleanLink, cleanTrain, cleanTaPct, cleanTaAmt, cleanNdaHours, cleanNdaAmt, cleanAbsence, r.remarks || null, actualArrTime, schedArrTime, extraNextDayTa, ntesStatus, updatedBy]);
      savedCount++;
    } catch (itemErr: any) {
      errorCount++;
      errors.push({
        link_number: r?.link_number || r?.linkNumber || '?',
        train_number: r?.train_number || r?.trainNumber || '?',
        error: itemErr.message
      });
    }
  }

  await logAudit(updatedBy, 'BATCH_UPDATE_TRAIN_TA_NDA', `Saved train TA/NDA rules one-by-one: ${savedCount} succeeded, ${errorCount} failed`);
  const errorSummary = errors.length > 0
    ? ` | Errors: ${errors.map(e => `Link #${e.link_number} (${e.train_number}): ${e.error}`).join('; ')}`
    : '';

  return {
    success: errorCount === 0,
    savedCount,
    errorCount,
    errors,
    message: `Saved ${savedCount} train TA/NDA rule(s) successfully, ${errorCount} failed.${errorSummary}`
  };
}

export async function getNtesTimings() {
  const runs: any[] = await all(`
    SELECT train_no, run_date, station_code, sched_arr, sched_dep, act_arr, act_dep, delay_arr_mins, source, updated_at
    FROM actual_train_runs
    WHERE station_code IN ('GNT', 'BZA', 'TPTY', 'MAS')
    ORDER BY run_date DESC, id DESC
  `);
  const latestByTrain: Record<string, any> = {};
  for (const r of runs) {
    if (!latestByTrain[r.train_no]) {
      latestByTrain[r.train_no] = r;
    }
  }
  return { success: true, latest: latestByTrain };
}

export async function resetTrainTaNdaRules(body: any, user: any) {
  const cat = body.category_id || body.categoryId;
  const link = body.link_number || body.linkNumber;
  const updatedBy = user?.username || user?.name || 'Admin';

  if (cat && link) {
    await run('DELETE FROM train_ta_nda_rules WHERE category_id = ? AND link_number = ?', [cat, link]);
    await logAudit(updatedBy, 'RESET_TRAIN_TA_NDA', `Reset train TA/NDA rules for category ID ${cat} link #${link}`);
  } else if (cat) {
    await run('DELETE FROM train_ta_nda_rules WHERE category_id = ?', [parseInt(cat, 10)]);
    await logAudit(updatedBy, 'RESET_TRAIN_TA_NDA', `Reset train TA/NDA rules for category ID ${cat}`);
  } else {
    await run('DELETE FROM train_ta_nda_rules');
    await logAudit(updatedBy, 'RESET_TRAIN_TA_NDA', 'Reset all train TA/NDA rules to default baseline');
  }
  return { success: true, message: 'Train TA/NDA rules reset to default baseline' };
}

export async function getNonDailyTrains(day_of_week?: any, date?: any) {
  let day = day_of_week;
  if (date && !day) {
    const parts = String(date).split('-');
    if (parts.length === 3) {
      const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
      const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      day = days[dObj.getDay()];
    }
  }

  let sql = 'SELECT * FROM non_daily_trains';
  const params: any[] = [];
  if (day) {
    sql += ' WHERE UPPER(day_of_week) = ? ORDER BY id';
    params.push(day.toUpperCase());
  } else {
    sql += ' ORDER BY CASE day_of_week ' +
      "WHEN 'SUNDAY' THEN 1 WHEN 'MONDAY' THEN 2 WHEN 'TUESDAY' THEN 3 " +
      "WHEN 'WEDNESDAY' THEN 4 WHEN 'THURSDAY' THEN 5 WHEN 'FRIDAY' THEN 6 WHEN 'SATURDAY' THEN 7 ELSE 8 END, id";
  }

  return await all(sql, params);
}

export async function createNonDailyTrain(body: any) {
  const { day_of_week, train_number, last_day_train_number, departure_station, departure_time, arrival_station, arrival_time, coaches, last_day_coaches, remarks, assigned_staff_id, assigned_staff_name } = body;
  if (!day_of_week || !train_number) {
    throw { status: 400, message: 'Day of week and Train number are required' };
  }

  const result = await run(
    `INSERT INTO non_daily_trains 
     (day_of_week, train_number, last_day_train_number, departure_station, departure_time, arrival_station, arrival_time, coaches, last_day_coaches, remarks, assigned_staff_id, assigned_staff_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      day_of_week.toUpperCase(),
      train_number,
      last_day_train_number || null,
      departure_station || '',
      departure_time || '',
      arrival_station || '',
      arrival_time || '',
      coaches || 'SL / AC',
      last_day_coaches || coaches || 'SL / AC',
      remarks || null,
      assigned_staff_id || null,
      assigned_staff_name || null
    ]
  );
  await logAudit('Admin', 'ADD_NON_DAILY_TRAIN', `Added non-daily train ${train_number}${last_day_train_number ? '/' + last_day_train_number : ''} for ${day_of_week}`);
  return { id: result.lastID, message: 'Non-daily train added successfully' };
}

export async function updateNonDailyTrain(id: any, body: any) {
  const { day_of_week, train_number, last_day_train_number, departure_station, departure_time, arrival_station, arrival_time, coaches, last_day_coaches, remarks, assigned_staff_id, assigned_staff_name } = body;
  const existingTrain = await get('SELECT * FROM non_daily_trains WHERE id = ?', [id]);
  if (!existingTrain) throw { status: 404, message: 'Non-daily train not found' };
  const oldTrainNo = existingTrain.train_number;

  await run(
    `UPDATE non_daily_trains
     SET day_of_week = COALESCE(?, day_of_week),
         train_number = COALESCE(?, train_number),
         last_day_train_number = ?,
         departure_station = COALESCE(?, departure_station),
         departure_time = COALESCE(?, departure_time),
         arrival_station = COALESCE(?, arrival_station),
         arrival_time = COALESCE(?, arrival_time),
         coaches = COALESCE(?, coaches),
         last_day_coaches = ?,
         remarks = ?,
         assigned_staff_id = ?,
         assigned_staff_name = ?
     WHERE id = ?`,
    [
      day_of_week ? day_of_week.toUpperCase() : (day_of_week === null ? null : existingTrain.day_of_week),
      train_number !== undefined ? train_number : existingTrain.train_number,
      last_day_train_number !== undefined ? last_day_train_number : existingTrain.last_day_train_number,
      departure_station !== undefined ? departure_station : existingTrain.departure_station,
      departure_time !== undefined ? departure_time : existingTrain.departure_time,
      arrival_station !== undefined ? arrival_station : existingTrain.arrival_station,
      arrival_time !== undefined ? arrival_time : existingTrain.arrival_time,
      coaches !== undefined ? coaches : existingTrain.coaches,
      last_day_coaches !== undefined ? last_day_coaches : existingTrain.last_day_coaches,
      remarks !== undefined ? remarks : existingTrain.remarks,
      assigned_staff_id !== undefined ? assigned_staff_id : existingTrain.assigned_staff_id,
      assigned_staff_name !== undefined ? assigned_staff_name : existingTrain.assigned_staff_name,
      id
    ]
  );

  if (train_number && oldTrainNo && oldTrainNo !== train_number) {
    await run('UPDATE overrides SET extra_train_no = ? WHERE extra_train_no = ?', [train_number, oldTrainNo]);
  }

  await logAudit('Admin', 'UPDATE_NON_DAILY_TRAIN', `Updated non-daily train ID ${id} (${oldTrainNo} ➔ ${train_number || oldTrainNo})`);

  if (assigned_staff_id) {
    const staffObj = await get('SELECT category_id FROM staff WHERE id = ?', [assigned_staff_id]);
    if (staffObj && staffObj.category_id === 4) {
      const trainObj = await get('SELECT * FROM non_daily_trains WHERE id = ?', [id]);
      if (trainObj && trainObj.train_number && trainObj.day_of_week) {
        const dowUpper = trainObj.day_of_week.toUpperCase().substring(0, 3);
        const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        for (let d = 1; d <= 30; d++) {
          const dObj = new Date(2026, 8, d);
          const dStr = `2026-09-${String(d).padStart(2, '0')}`;
          if (dayNames[dObj.getDay()] === dowUpper) {
            await syncLRSheetRecord(assigned_staff_id, dStr, trainObj.train_number, trainObj.remarks || `Non-daily train ${trainObj.train_number}`);
          }
        }
      }
    }
  }
  return { message: 'Non-daily train updated successfully' };
}

export async function patchNonDailyTrain(id: any, updates: any) {
  const existingTrain = await get('SELECT * FROM non_daily_trains WHERE id = ?', [id]);
  if (!existingTrain) throw { status: 404, message: 'Non-daily train not found' };

  const new1stTrain = updates.train_number !== undefined ? updates.train_number : existingTrain.train_number;
  const newLastTrain = updates.last_day_train_number !== undefined ? updates.last_day_train_number : existingTrain.last_day_train_number;
  const new1stCoach = updates.coaches !== undefined ? updates.coaches : existingTrain.coaches;
  const newLastCoach = updates.last_day_coaches !== undefined ? updates.last_day_coaches : existingTrain.last_day_coaches;
  const newRemarks = updates.remarks !== undefined ? updates.remarks : existingTrain.remarks;

  await run(
    `UPDATE non_daily_trains
     SET train_number = ?,
         last_day_train_number = ?,
         coaches = ?,
         last_day_coaches = ?,
         remarks = ?
     WHERE id = ?`,
    [new1stTrain, newLastTrain, new1stCoach, newLastCoach, newRemarks, id]
  );

  if (updates.train_number && existingTrain.train_number && existingTrain.train_number !== updates.train_number) {
    await run('UPDATE overrides SET extra_train_no = ? WHERE extra_train_no = ?', [updates.train_number, existingTrain.train_number]);
  }

  await logAudit('Admin', 'PATCH_NON_DAILY_TRAIN', `Quick-edited non-daily train ID ${id}`);
  return { message: 'Non-daily train updated successfully' };
}

export async function deleteNonDailyTrain(id: any) {
  const train = await get('SELECT * FROM non_daily_trains WHERE id = ?', [id]);
  await run('DELETE FROM non_daily_trains WHERE id = ?', [id]);
  await logAudit('Admin', 'DELETE_NON_DAILY_TRAIN', `Deleted non-daily train ${train?.train_number} for ${train?.day_of_week}`);
  return { message: 'Non-daily train deleted successfully' };
}
