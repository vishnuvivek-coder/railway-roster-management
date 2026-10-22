import { run, get, all, withTransaction } from '../db';
import { logAudit } from './audit.service';
import { getDayOffset, getBaseLinkNumber } from '../rotation';
import { findScheduledRestDate, getWeekday } from '../restAdjustment';
import {
  calculateStaffCrBalances,
  getStaffLastDutyAndRestStatus,
  getCorRestDay
} from './helpers.service';

export async function getCategories() {
  return await all('SELECT * FROM categories');
}

export async function createCategory(data: any) {
  const { name, code, cycle_length, anchor_date } = data;
  if (!name || !code || !cycle_length || !anchor_date) {
    throw { status: 400, message: 'All fields are required' };
  }
  const result = await run(
    'INSERT INTO categories (name, code, cycle_length, anchor_date) VALUES (?, ?, ?, ?)',
    [name, code, cycle_length, anchor_date]
  );
  await logAudit('Admin', 'CREATE_CATEGORY', `Created category ${name} (${code})`);
  return { id: result.lastID };
}

export async function updateCategory(id: any, data: any) {
  const { name, code, cycle_length, anchor_date } = data;
  await run(
    'UPDATE categories SET name = ?, code = ?, cycle_length = ?, anchor_date = ? WHERE id = ?',
    [name, code, cycle_length, anchor_date, id]
  );
  await logAudit('Admin', 'UPDATE_CATEGORY', `Updated category ID ${id} to ${name}`);
  return { message: 'Category updated successfully' };
}

export async function deleteCategory(id: any) {
  const category = await get('SELECT name FROM categories WHERE id = ?', [id]);
  await run('DELETE FROM categories WHERE id = ?', [id]);
  await logAudit('Admin', 'DELETE_CATEGORY', `Deleted category ${category?.name} (ID: ${id})`);
  return { message: 'Category deleted successfully' };
}

export async function getSeniorityList(query: any) {
  const { q, designation, sort } = query;
  let sql = 'SELECT * FROM seniority_list WHERE 1=1';
  const params: any[] = [];
  if (designation && designation !== 'ALL') {
    if (designation === 'TTI') {
      sql += " AND (designation = 'TTI' OR working_designation = 'TTI' OR name LIKE '%CHANDRIKA%')";
    } else if (designation === 'COR') {
      sql += " AND designation = 'COR' AND name NOT LIKE '%CHANDRIKA%'";
    } else {
      sql += ' AND designation = ?';
      params.push(designation);
    }
  }
  if (q && q.trim()) {
    const term = `%${q.trim()}%`;
    sql += ' AND (name LIKE ? OR designation LIKE ? OR working_designation LIKE ? OR pf_number LIKE ? OR contact_number LIKE ? OR cug_number LIKE ? OR email LIKE ? OR CAST(sl_no AS TEXT) LIKE ?)';
    params.push(term, term, term, term, term, term, term, term);
  }
  if (sort === 'hierarchy') {
    sql += ' ORDER BY hierarchy_tier ASC, desg_rank ASC, sl_no ASC';
  } else {
    sql += ' ORDER BY sl_no ASC';
  }
  return await all(sql, params);
}

export async function updateSeniorityRecord(id: any, data: any, user: any) {
  const { name, designation, cug_number, contact_number, pf_number, email } = data;
  await run(
    `UPDATE seniority_list 
     SET name = COALESCE(?, name),
         designation = COALESCE(?, designation),
         cug_number = COALESCE(?, cug_number),
         contact_number = COALESCE(?, contact_number),
         pf_number = COALESCE(?, pf_number),
         email = COALESCE(?, email)
     WHERE id = ?`,
    [name, designation, cug_number, contact_number, pf_number, email, id]
  );
  await logAudit(user?.name || 'Admin', 'UPDATE_SENIORITY', `Updated Seniority record ID ${id} (${name || ''})`);
  return { message: 'Seniority record updated successfully' };
}

export async function getStaff(categoryId: any) {
  let sql = 'SELECT * FROM staff WHERE (active = 1 OR active IS NULL)';
  const params: any[] = [];
  if (categoryId && categoryId !== 'ALL') {
    sql += ' AND category_id = ? ORDER BY row_position';
    params.push(categoryId);
  } else {
    sql += ' ORDER BY category_id, row_position';
  }
  const staff: any[] = await all(sql, params);
  const crBalances = await calculateStaffCrBalances();
  return staff.map(s => {
    const cr = crBalances[s.id];
    return {
      ...s,
      cr_available: cr ? cr.display : null,
      cr_short_display: cr ? cr.shortDisplay : '-',
      cr_count: cr ? cr.count : 0,
      cr_dates: cr ? cr.dates : [],
      cr_due_dates: cr ? cr.due_dates : []
    };
  });
}

export async function getStaffCrBalances() {
  return await calculateStaffCrBalances();
}

export async function getStaffCrDetails(staffId: number) {
  const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
  if (!staff) throw { status: 404, message: 'Staff member not found' };
  const crBalances = await calculateStaffCrBalances();
  const cr = crBalances[staffId] || {
    count: 0,
    dates: [],
    due_dates: [],
    all_forgone_records: [],
    redeemed_dates: [],
    display: null,
    shortDisplay: '-'
  };
  return {
    staff_id: staff.id,
    staff_name: staff.name,
    designation: staff.designation,
    category_id: staff.category_id,
    rest_day: staff.rest_day,
    count: cr.count,
    dates: cr.dates,
    due_dates: cr.due_dates,
    all_forgone_records: cr.all_forgone_records,
    redeemed_dates: cr.redeemed_dates,
    display: cr.display,
    shortDisplay: cr.shortDisplay
  };
}

export async function getRecentDuties(staffId: number, beforeDateStr: string, limit: number) {
  const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
  if (!staff) throw { status: 404, message: 'Staff member not found' };
  const category = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
  const allLinks: any[] = await all(`
    SELECT * FROM links 
    WHERE (status = 'published' OR status IS NULL OR status = '') 
      AND (status != 'draft')
      AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = 'published' OR status IS NULL))
    ORDER BY category_id ASC, link_number ASC
  `);

  const results: any[] = [];
  const curr = new Date(beforeDateStr + 'T12:00:00');
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

  for (let i = 1; i <= 21 && results.length < limit; i++) {
    const d = new Date(curr);
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().split('T')[0];
    const dow = dayNames[d.getDay()];

    const ov = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staffId, dStr]);
    const subOv = await get('SELECT * FROM overrides WHERE substitute_staff_id = ? AND date = ?', [staffId, dStr]);
    const nd = await get('SELECT * FROM non_daily_trains WHERE assigned_staff_id = ? AND UPPER(day_of_week) = ?', [staffId, dow]);
    const manual = await get('SELECT * FROM lr_duty_completions WHERE staff_id = ? AND arrival_date = ?', [staffId, dStr]);

    let dutyText = '';
    let dutyType = 'WORK';
    let trainNo = '';
    let route = '';
    let linkNum = null;
    let coaches = '';
    let notes = '';

    if (ov) {
      if (ov.status === 'LEAVE') {
        dutyText = `Leave (${ov.leave_type || 'CL'})`;
        dutyType = 'LEAVE';
        notes = ov.reason || '';
      } else if (ov.status === 'SICK') {
        dutyText = `Sick (${ov.leave_type || 'MC'})`;
        dutyType = 'SICK';
        notes = ov.reason || '';
      } else if (ov.status === 'ABSENT') {
        dutyText = 'Absent [O]';
        dutyType = 'ABSENT';
        notes = ov.reason || '';
      } else if (ov.status === 'REST') {
        dutyText = 'Weekly Rest';
        dutyType = 'REST';
      } else if (ov.extra_train_no) {
        dutyText = `Train ${ov.extra_train_no} (Special/Non-Daily)`;
        trainNo = ov.extra_train_no;
        dutyType = 'WORK';
        notes = ov.reason || '';
      } else if (ov.shifted_place) {
        dutyText = `Shifted: ${ov.shifted_place}`;
        dutyType = 'WORK';
        notes = ov.reason || '';
      } else if (ov.overridden_link_number !== null && ov.overridden_link_number !== undefined) {
        linkNum = ov.overridden_link_number;
        const lDef = allLinks.find(l => l.link_number === linkNum && l.category_id === (ov.target_category_id || staff.category_id))
          || allLinks.find(l => l.link_number === linkNum);
        if (lDef && lDef.is_rest) {
          dutyText = 'Weekly Rest';
          dutyType = 'REST';
        } else {
          trainNo = lDef ? lDef.train_numbers : '';
          route = lDef ? `${lDef.from_station} ➔ ${lDef.to_station}` : '';
          coaches = lDef ? lDef.coaches : '';
          dutyText = `Link #${linkNum}${trainNo ? ` (${trainNo})` : ''}`;
          dutyType = 'WORK';
        }
        notes = ov.reason || '';
      }
    } else if (subOv) {
      linkNum = subOv.overridden_link_number;
      const lDef = allLinks.find(l => l.link_number === linkNum);
      trainNo = lDef ? lDef.train_numbers : '';
      route = lDef ? `${lDef.from_station} ➔ ${lDef.to_station}` : '';
      coaches = lDef ? lDef.coaches : '';
      dutyText = `Relief on Link #${linkNum}${trainNo ? ` (${trainNo})` : ''}`;
      dutyType = 'WORK';
      notes = subOv.reason || 'Relief duty';
    } else if (nd) {
      dutyText = `Non-Daily Train ${nd.train_number}${nd.last_day_train_number ? '/' + nd.last_day_train_number : ''}`;
      trainNo = nd.train_number;
      route = `${nd.departure_station || ''} ➔ ${nd.arrival_station || ''}`;
      coaches = nd.coaches || '';
      dutyType = 'WORK';
      notes = nd.remarks || '';
    } else if (manual) {
      dutyText = `Train ${manual.last_train_no}`;
      trainNo = manual.last_train_no;
      route = `${manual.from_station || '---'} ➔ ${manual.to_station || 'GNT'}`;
      dutyType = 'WORK';
      notes = manual.notes || '';
    } else if (staff.category_id && staff.category_id !== 4 && category) {
      const offset = getDayOffset(category.anchor_date, dStr);
      linkNum = getBaseLinkNumber(staff.row_position, offset, category.cycle_length);
      const lDef = allLinks.find(l => l.link_number === linkNum && l.category_id === category.id);
      if (lDef && lDef.is_rest) {
        dutyText = 'Weekly Rest';
        dutyType = 'REST';
      } else if (lDef) {
        trainNo = lDef.train_numbers || '';
        route = `${lDef.from_station || ''} ➔ ${lDef.to_station || ''}`;
        coaches = lDef.coaches || '';
        dutyText = `Link #${linkNum}${trainNo ? ` (${trainNo})` : ''}`;
        dutyType = 'WORK';
      } else {
        dutyText = `Link #${linkNum}`;
        dutyType = 'WORK';
      }
    } else if (staff.category_id === 4) {
      const restDay = (staff.rest_day || '').toUpperCase().trim();
      if (restDay && (restDay === dow || restDay === dow.substring(0, 3))) {
        dutyText = 'Designated Weekly Rest';
        dutyType = 'REST';
      } else {
        dutyText = 'LR Standby / Available at HQ';
        dutyType = 'STANDBY';
      }
    }

    results.push({
      date: dStr,
      day_of_week: dow,
      duty_text: dutyText,
      duty_type: dutyType,
      train_number: trainNo,
      route,
      link_number: linkNum,
      coaches,
      notes
    });
  }

  return {
    staff: {
      id: staff.id,
      name: staff.name,
      designation: staff.designation,
      category_id: staff.category_id,
      category_name: category ? category.name : 'Staff'
    },
    target_date: beforeDateStr,
    recent_duties: results
  };
}

export async function recordLrDutyCompletion(body: any) {
  const { staff_id, last_train_no, arrival_date, arrival_time, rest_hours_required, notes } = body;
  if (!staff_id || !arrival_date || !arrival_time) {
    throw { status: 400, message: 'staff_id, arrival_date, and arrival_time are required' };
  }

  const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
  if (!staff) throw { status: 404, message: 'Staff not found' };

  await run(
    `INSERT INTO lr_duty_completions (staff_id, last_train_no, from_station, to_station, arrival_date, arrival_time, rest_hours_required, notes, updated_by)
     VALUES (?, ?, '---', 'GNT', ?, ?, ?, ?, 'Admin')
     ON CONFLICT(staff_id, arrival_date) DO UPDATE SET
       last_train_no = excluded.last_train_no,
       arrival_time = excluded.arrival_time,
       rest_hours_required = excluded.rest_hours_required,
       notes = excluded.notes,
       updated_by = 'Admin',
       updated_at = CURRENT_TIMESTAMP`,
    [staff_id, last_train_no || 'MANUAL', arrival_date, arrival_time, rest_hours_required || 12, notes || '']
  );

  await logAudit('Admin', 'LR_DUTY_COMPLETION', `Recorded duty completion for ${staff.name}: Train ${last_train_no || 'Duty'} arr GNT ${arrival_time} on ${arrival_date}`);

  const evalDate = body.target_date || new Date().toISOString().split('T')[0];
  const updatedRest = await getStaffLastDutyAndRestStatus(staff_id, evalDate);
  return { success: true, message: `Recorded duty completion and HQ rest for ${staff.name}`, restInfo: updatedRest };
}

export async function getLrDutyCompletions(staff_id?: any, date?: any) {
  let sql = 'SELECT c.*, s.name as staff_name, s.designation FROM lr_duty_completions c JOIN staff s ON c.staff_id = s.id';
  const params: any[] = [];
  const conditions: string[] = [];
  if (staff_id) {
    conditions.push('c.staff_id = ?');
    params.push(staff_id);
  }
  if (date) {
    conditions.push('c.arrival_date = ?');
    params.push(date);
  }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY date(c.arrival_date) DESC, c.arrival_time DESC LIMIT 50';

  return await all(sql, params);
}

export async function getLrRestStatus(staffId: any, date?: any) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  return await getStaffLastDutyAndRestStatus(staffId, targetDate);
}

export async function createStaff(body: any) {
  const { name, designation, category_id, row_position, rest_day } = body;
  if (!name || !category_id) {
    throw { status: 400, message: 'Name and Category ID are required' };
  }

  let pos = row_position;
  if (!pos) {
    const maxPos = await get('SELECT MAX(row_position) as maxPos FROM staff WHERE category_id = ?', [category_id]);
    pos = (maxPos.maxPos || 0) + 1;
  } else {
    await run(
      'UPDATE staff SET row_position = row_position + 1 WHERE category_id = ? AND row_position >= ?',
      [category_id, pos]
    );
  }

  const result = await run(
    'INSERT INTO staff (name, designation, category_id, row_position, rest_day) VALUES (?, ?, ?, ?, ?)',
    [name, designation || null, category_id, pos, rest_day || null]
  );

  await logAudit('Admin', 'ADD_STAFF', `Added staff member '${name}' at position ${pos}${rest_day ? ` with Rest Day: ${rest_day}` : ''}`);
  return { id: result.lastID, row_position: pos, rest_day };
}

export async function reorderStaff(reorders: any[]) {
  if (!Array.isArray(reorders)) {
    throw { status: 400, message: 'Invalid reorders data' };
  }
  let savedCount = 0;
  let errorCount = 0;
  const errors: any[] = [];

  for (const item of reorders) {
    try {
      if (!item || !item.id) {
        throw new Error('Missing employee ID');
      }
      const current = await get('SELECT id, name, category_id, row_position FROM staff WHERE id = ?', [item.id]);
      if (!current) {
        throw new Error(`Employee ID ${item.id} not found`);
      }
      const targetPos = item.row_position !== undefined && item.row_position !== null ? parseInt(item.row_position, 10) : current.row_position;

      const conflict = await get(
        'SELECT id FROM staff WHERE category_id = ? AND row_position = ? AND id != ?',
        [current.category_id, targetPos, item.id]
      );
      if (conflict) {
        await run('UPDATE staff SET row_position = ? WHERE id = ?', [-(conflict.id + 10000), conflict.id]);
      }

      await run(
        `UPDATE staff SET
           row_position = ?,
           name = COALESCE(?, name),
           designation = COALESCE(?, designation),
           rest_day = COALESCE(?, rest_day),
           pf_no = COALESCE(?, pf_no),
           hrms_id = COALESCE(?, hrms_id),
           seniority_no = COALESCE(?, seniority_no)
         WHERE id = ?`,
        [
          targetPos,
          item.name !== undefined ? String(item.name).trim() : null,
          item.designation !== undefined ? String(item.designation).trim() : null,
          item.rest_day !== undefined ? item.rest_day : null,
          item.pf_no !== undefined ? String(item.pf_no).trim() : null,
          item.hrms_id !== undefined ? String(item.hrms_id).trim() : null,
          item.seniority_no !== undefined ? item.seniority_no : null,
          item.id
        ]
      );
      savedCount++;
    } catch (err: any) {
      errorCount++;
      errors.push({
        staff_id: item?.id || null,
        staff_name: item?.name || `ID #${item?.id || '?'}`,
        error: err.message
      });
    }
  }

  await logAudit('Admin', 'REORDER_STAFF', `Saved staff details one-by-one: ${savedCount} succeeded, ${errorCount} failed`);
  const errorSummary = errors.length > 0
    ? ` | Errors: ${errors.map(e => `${e.staff_name}: ${e.error}`).join('; ')}`
    : '';

  return {
    success: errorCount === 0,
    savedCount,
    errorCount,
    errors,
    message: `Staff Roster Save Complete: ${savedCount} employee(s) saved successfully, ${errorCount} had an error.${errorSummary}`
  };
}

export async function updateStaff(id: any, body: any) {
  const { name, designation, row_position, active, pf_no, bill_unit, pay_amount, doa, hq_station, rest_day, hrms_id, seniority_no } = body;
  const currentStaff = await get('SELECT * FROM staff WHERE id = ?', [id]);
  if (!currentStaff) {
    throw { status: 404, message: 'Staff member not found' };
  }

  if (row_position && row_position !== currentStaff.row_position) {
    const catId = currentStaff.category_id;
    if (row_position > currentStaff.row_position) {
      await run(
        'UPDATE staff SET row_position = row_position - 1 WHERE category_id = ? AND row_position > ? AND row_position <= ?',
        [catId, currentStaff.row_position, row_position]
      );
    } else {
      await run(
        'UPDATE staff SET row_position = row_position + 1 WHERE category_id = ? AND row_position >= ? AND row_position < ?',
        [catId, row_position, currentStaff.row_position]
      );
    }
  }

  const targetName = name !== undefined ? name.trim() : currentStaff.name;
  const targetDesg = designation !== undefined ? designation.trim() : currentStaff.designation;
  const targetHrms = hrms_id !== undefined ? hrms_id.trim() : currentStaff.hrms_id;
  const targetPf = pf_no !== undefined ? pf_no.trim() : currentStaff.pf_no;

  await run(
    `UPDATE staff 
     SET name = ?, 
         designation = ?, 
         row_position = COALESCE(?, row_position), 
         active = COALESCE(?, active),
         pf_no = ?,
         bill_unit = COALESCE(?, bill_unit),
         pay_amount = COALESCE(?, pay_amount),
         doa = COALESCE(?, doa),
         hq_station = COALESCE(?, hq_station),
         rest_day = COALESCE(?, rest_day),
         hrms_id = ?,
         seniority_no = COALESCE(?, seniority_no)
     WHERE id = ?`,
    [targetName, targetDesg, row_position || null, active !== undefined ? active : null, targetPf, bill_unit || null, pay_amount || null, doa || null, hq_station || null, rest_day || null, targetHrms, seniority_no || null, id]
  );

  await logAudit('Admin', 'UPDATE_STAFF', `Updated staff member '${targetName}' (ID: ${id})`);
  return { message: 'Staff member updated successfully' };
}

export async function deleteStaff(staffId: number) {
  const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
  if (!staff) {
    return { success: true, message: 'Staff member already deleted or does not exist.' };
  }

  const staffName = staff.name;
  const catId = staff.category_id;

  await withTransaction(async () => {
    await run('DELETE FROM muster_records WHERE staff_id = ?', [staffId]);
    await run('DELETE FROM overrides WHERE staff_id = ? OR substitute_staff_id = ?', [staffId, staffId]);
    await run('DELETE FROM ta_approvals WHERE staff_id = ?', [staffId]);
    await run('DELETE FROM ta_entries WHERE staff_id = ?', [staffId]);
    await run('DELETE FROM nda_entries WHERE staff_id = ?', [staffId]);
    await run('DELETE FROM diary_entries WHERE staff_id = ?', [staffId]);
    await run('DELETE FROM daily_earnings_entries WHERE staff_id = ?', [staffId]);
    await run('DELETE FROM lr_sheet_records WHERE staff_id = ?', [staffId]);
    await run('DELETE FROM duty_register_staff WHERE staff_id = ?', [staffId]);
    await run('DELETE FROM leave_requests WHERE staff_id = ? OR swap_staff_id = ?', [staffId, staffId]);
    await run('UPDATE users SET staff_id = NULL WHERE staff_id = ?', [staffId]);
    await run('UPDATE non_daily_trains SET assigned_staff_id = NULL WHERE assigned_staff_id = ?', [staffId]);
    await run('DELETE FROM lr_duty_completions WHERE staff_id = ?', [staffId]);

    await run('DELETE FROM staff WHERE id = ?', [staffId]);

    if (catId) {
      const remaining: any[] = await all('SELECT id FROM staff WHERE category_id = ? ORDER BY row_position ASC, id ASC', [catId]);
      for (let i = 0; i < remaining.length; i++) {
        await run('UPDATE staff SET row_position = ? WHERE id = ?', [-(i + 1000), remaining[i].id]);
      }
      for (let i = 0; i < remaining.length; i++) {
        await run('UPDATE staff SET row_position = ? WHERE id = ?', [i + 1, remaining[i].id]);
      }
      try {
        await run('UPDATE categories SET cycle_length = (SELECT COUNT(*) FROM staff WHERE category_id = ?) WHERE id = ?', [catId, catId]);
      } catch (e) { }
    }

    await logAudit('Admin', 'DELETE_STAFF', `Deleted staff member '${staffName}' (ID: ${staffId})`);
  });

  return { success: true, message: `Staff member '${staffName}' permanently deleted from database.` };
}

export async function getCorLinksSummary() {
  const corCategory = await get('SELECT * FROM categories WHERE id = 1');
  if (!corCategory) {
    throw { status: 404, message: 'COR category not found' };
  }

  const corLinks: any[] = await all(
    `SELECT * FROM links 
     WHERE category_id = 1 
       AND (status = 'published' OR status IS NULL OR status = '')
       AND (status != 'draft')
       AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = 'published' OR status IS NULL))
     ORDER BY link_number ASC`
  );

  const corStaff: any[] = await all(
    `SELECT * FROM staff WHERE category_id = 1 ORDER BY row_position ASC`
  );

  const isVacant = (name: string) => {
    if (!name) return true;
    const n = name.trim().toUpperCase();
    return n.includes('VACANT') || n === 'V' || n === '(V)';
  };

  const linksSummary = corLinks.map(link => {
    const staffAtPos = corStaff.find(s => s.row_position === link.link_number);
    const vacant = !staffAtPos || isVacant(staffAtPos.name);
    return {
      link_number: link.link_number,
      train_numbers: link.train_numbers,
      from_station: link.from_station,
      to_station: link.to_station,
      coaches: link.coaches,
      is_rest: link.is_rest === 1,
      scheduled_rest_day: getCorRestDay(link.link_number),
      occupant: staffAtPos ? {
        id: staffAtPos.id,
        name: staffAtPos.name,
        designation: staffAtPos.designation,
        pf_no: staffAtPos.pf_no,
        rest_day: staffAtPos.rest_day || getCorRestDay(link.link_number),
        is_vacant: vacant
      } : null,
      is_vacant: vacant
    };
  });

  return {
    category: corCategory,
    total_links: corLinks.length,
    links: linksSummary
  };
}

export async function upgradeToCor(body: any) {
  const {
    staff_id,
    target_cor_row,
    target_action = 'FILL_VACANT',
    new_designation = 'CTI',
    new_rest_day
  } = body;

  if (!staff_id || !target_cor_row) {
    throw { status: 400, message: 'staff_id and target_cor_row are required' };
  }

  const targetRowInt = parseInt(target_cor_row, 10);
  if (isNaN(targetRowInt) || targetRowInt < 1) {
    throw { status: 400, message: 'Invalid target_cor_row' };
  }

  const isVacant = (name: string) => {
    if (!name) return true;
    const n = name.trim().toUpperCase();
    return n.includes('VACANT') || n === 'V' || n === '(V)';
  };

  const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
  if (!staff) {
    throw { status: 404, message: 'Employee not found' };
  }

  const oldCatId = staff.category_id;
  const oldRowPos = staff.row_position;
  const oldStaffName = staff.name;
  const oldRestDay = staff.rest_day;

  if (oldCatId === 1) {
    throw { status: 400, message: 'Employee is already in Conductors (COR) category' };
  }

  const oldCategory = await get('SELECT * FROM categories WHERE id = ?', [oldCatId]);

  const currentOccupant = await get(
    'SELECT * FROM staff WHERE category_id = 1 AND row_position = ?',
    [targetRowInt]
  );

  const calculatedRestDay = new_rest_day || getCorRestDay(targetRowInt);
  const updatedDesignation = new_designation || 'CTI';

  return await withTransaction(async () => {
    if (currentOccupant) {
      const occupantIsVacant = isVacant(currentOccupant.name);

      if (occupantIsVacant || target_action === 'FILL_VACANT') {
        await run('DELETE FROM staff WHERE id = ?', [currentOccupant.id]);
      } else if (target_action === 'REPLACE_TO_VACANT') {
        await run('DELETE FROM staff WHERE id = ?', [currentOccupant.id]);
      } else if (target_action === 'SWAP') {
        await run('UPDATE staff SET row_position = -999 WHERE id = ?', [currentOccupant.id]);
        await run(
          `UPDATE staff 
           SET category_id = 1, row_position = ?, designation = ?, rest_day = ?
           WHERE id = ?`,
          [targetRowInt, updatedDesignation, calculatedRestDay, staff_id]
        );
        await run(
          `UPDATE staff 
           SET category_id = ?, row_position = ?, designation = ?
           WHERE id = ?`,
          [oldCatId, oldRowPos, currentOccupant.designation || '', currentOccupant.id]
        );
        await logAudit(
          'Admin',
          'UPGRADE_TO_COR_SWAP',
          `Swapped employee '${oldStaffName}' into COR Link ${targetRowInt} and '${currentOccupant.name}' to ${oldCategory?.name || 'Category ' + oldCatId} (Row ${oldRowPos})`
        );
        return {
          success: true,
          message: `Successfully swapped '${oldStaffName}' to COR Link ${targetRowInt}`,
          upgraded_staff: { id: staff_id, name: oldStaffName, category_id: 1, row_position: targetRowInt },
          swapped_staff: { id: currentOccupant.id, name: currentOccupant.name, category_id: oldCatId, row_position: oldRowPos }
        };
      } else if (target_action === 'INSERT_SHIFT') {
        const staffToShift: any[] = await all(
          'SELECT id, row_position FROM staff WHERE category_id = 1 AND row_position >= ? ORDER BY row_position DESC',
          [targetRowInt]
        );
        for (const s of staffToShift) {
          await run('UPDATE staff SET row_position = row_position + 1 WHERE id = ?', [s.id]);
        }
      }
    }

    await run(
      `UPDATE staff 
       SET category_id = 1, 
           row_position = ?, 
           designation = ?, 
           rest_day = ?
       WHERE id = ?`,
      [targetRowInt, updatedDesignation, calculatedRestDay, staff_id]
    );

    await run(
      `INSERT INTO staff (name, designation, category_id, row_position, rest_day, active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      ['VACANT (V)', '', oldCatId, oldRowPos, oldRestDay || null]
    );

    const upgradedStaff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    const vacantPlaceholder = await get(
      'SELECT * FROM staff WHERE category_id = ? AND row_position = ?',
      [oldCatId, oldRowPos]
    );

    await logAudit(
      'Admin',
      'UPGRADE_TO_COR',
      `Upgraded employee '${oldStaffName}' from ${oldCategory?.name || 'Category ' + oldCatId} (Row ${oldRowPos}) to Conductors (COR) at Link ${targetRowInt}. Older place preserved as VACANT (V).`
    );

    return {
      success: true,
      message: `Successfully upgraded '${oldStaffName}' to Conductors (COR) Link ${targetRowInt}. Older slot at Row ${oldRowPos} in ${oldCategory?.name || 'Old Category'} is now VACANT (V).`,
      upgraded_staff: upgradedStaff,
      vacant_record: vacantPlaceholder
    };
  });
}

export async function changeWeeklyRest(staffId: any, new_rest_weekday: string) {
  if (!new_rest_weekday) {
    throw { status: 400, message: 'new_rest_weekday is required' };
  }

  const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
  if (!staff) throw { status: 404, message: 'Staff member not found' };
  const category = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
  const allCategoryStaff: any[] = await all('SELECT * FROM staff WHERE category_id = ? ORDER BY row_position', [category.id]);

  const targetStaff = allCategoryStaff.find(s => {
    const restDate = findScheduledRestDate(s.row_position, category.anchor_date, category.anchor_date, category.cycle_length);
    return getWeekday(restDate).toLowerCase() === new_rest_weekday.toLowerCase();
  });

  if (targetStaff && targetStaff.id !== staff.id) {
    const posA = staff.row_position;
    const posB = targetStaff.row_position;
    await run('UPDATE staff SET row_position = ? WHERE id = ?', [posB, staff.id]);
    await run('UPDATE staff SET row_position = ? WHERE id = ?', [posA, targetStaff.id]);

    await logAudit(
      'Admin',
      'CHANGE_WEEKLY_REST',
      `Swapped rotation position of ${staff.name} (pos ${posA} -> ${posB}) with ${targetStaff.name} (pos ${posB} -> ${posA}) for ${new_rest_weekday} weekly rest.`
    );

    return {
      success: true,
      message: `Weekly rest changed to ${new_rest_weekday} by exchanging roster position with ${targetStaff.name}.`,
      new_row_position: posB
    };
  } else {
    return {
      success: true,
      message: targetStaff ? `${staff.name} already has weekly rest on ${new_rest_weekday}.` : `Weekly rest ${new_rest_weekday} assigned.`
    };
  }
}
