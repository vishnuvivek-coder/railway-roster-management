import { get, all, run, withTransaction } from '../db';
import { getDayOffset, getBaseLinkNumber } from '../rotation';
import { ApiError } from '../utils/api_error';
import {
  getCategoryParamsForDate,
  calculateStaffCrBalances,
  ALLOWED_MUSTER_CODES,
  getMusterCycleDates,
  formatTrainString,
  resolveDutyCodeForLRStaff
} from './helpers.service';
import {
  syncDocumentsAndEarningsForStaffDate,
  restoreMusterTaApprovalsAndEntries,
  syncMusterToSchedulesAndApprovals,
  revertMusterFromSchedulesAndApprovals,
  syncLRSheetRecord
} from './sync.service';
import { logAudit } from './audit.service';

export async function getMusterGrid(query: any) {
    const { cycle_start, category_id } = query;
    const cycle = getMusterCycleDates(cycle_start);

    let staffSql = `
      SELECT s.*, c.name as category_name, c.code as category_code, c.cycle_length, c.anchor_date 
      FROM staff s 
      LEFT JOIN categories c ON s.category_id = c.id
      WHERE (s.name NOT LIKE '%VACANT%')
        AND (s.active = 1 OR s.active IS NULL)
        AND (s.category_id IS NOT NULL OR s.seniority_no IN (1, 6))
    `;
    let staffParams = [];
    if (category_id && category_id !== 'ALL') {
      staffSql += ' AND s.category_id = ?';
      staffParams.push(category_id);
    }
    staffSql += `
      ORDER BY 
        CASE WHEN s.seniority_no IS NOT NULL AND s.seniority_no > 0 THEN s.seniority_no ELSE 9999 END,
        s.category_id, 
        s.row_position
    `;
    const staffMembers = await all(staffSql, staffParams);

    const links = await all(`
      SELECT * FROM links 
      WHERE (status = 'published' OR status IS NULL OR status = '') 
        AND (status != 'draft')
        AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = 'published' OR status IS NULL))
    `);

    const linkMap = {};
    links.forEach(l => {
      linkMap[`${l.category_id}_${l.link_number}`] = l;
    });

    const overrides = await all('SELECT * FROM overrides WHERE date >= ? AND date <= ?', [cycle.startDateStr, cycle.endDateStr]);
    const overrideMap = {};
    overrides.forEach(o => {
      overrideMap[`${o.staff_id}_${o.date}`] = o;
    });

    const musterRecords = await all('SELECT * FROM muster_records WHERE date >= ? AND date <= ?', [cycle.startDateStr, cycle.endDateStr]);
    const musterMap = {};
    musterRecords.forEach(m => {
      musterMap[`${m.staff_id}_${m.date}`] = m;
    });

    const crBalances = await calculateStaffCrBalances();
    const grandTotals = { P: 0, R: 0, O: 0, E: 0, CR: 0, CL: 0, CCL: 0, SCL: 0, LAP: 0, LHAP: 0, SICK: 0, OD: 0, NH: 0, totalLeaves: 0 };
    const staffRows = [];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    const todayIso = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
    const effectiveTotalDays = cycle.dates.filter(d => d.dateStr <= todayIso).length;

    for (const staff of staffMembers) {
      const days = {};
      const counts = { P: 0, R: 0, O: 0, E: 0, CR: 0, CL: 0, CCL: 0, SCL: 0, LAP: 0, LHAP: 0, SICK: 0, OD: 0, NH: 0 };
      const staffCr = crBalances[staff.id];

      for (const d of cycle.dates) {
        const key = `${staff.id}_${d.dateStr}`;
        let code = 'P';
        let isManual = false;
        let remarks = '';

        if (musterMap[key]) {
          code = musterMap[key].code;
          isManual = true;
          remarks = musterMap[key].remarks || '';
        } else if (overrideMap[key]) {
          const o = overrideMap[key];
          if (o.status === 'CR') code = 'CR';
          else if (o.status === 'SICK') code = o.leave_type || 'LHAP';
          else if (o.status === 'LEAVE') code = o.leave_type || 'CL';
          else if (o.status === 'REST') code = 'R';
          else if (o.overridden_link_number !== null) {
            // All assigned train duties and outstation halt count as P (Present)
            code = 'P';
          }
        } else {
          // Cyclic baseline
          let isRest = false;
          if (staff.category_id && staff.row_position) {
            const catParams = (staff.category_id === 2 || staff.category_code === 'TTI_SLEEPER')
              ? getCategoryParamsForDate(staff, d.dateStr)
              : { anchor_date: staff.anchor_date, cycle_length: staff.cycle_length };
            const dayOffset = getDayOffset(catParams.anchor_date, d.dateStr);
            const linkNum = getBaseLinkNumber(staff.row_position, dayOffset, catParams.cycle_length);

            if (staff.category_id === 4) {
              if (staff.rest_day && staff.rest_day.toUpperCase() === d.dayOfWeek) isRest = true;
              else if (staff.name.toUpperCase().includes(`${d.dayOfWeek} REST`)) isRest = true;
            } else {
              const lDef = linkNum !== null ? links.find(l =>
                l.category_id === staff.category_id &&
                l.link_number === linkNum &&
                (!l.effective_from || l.effective_from <= d.dateStr) &&
                (!l.effective_to || l.effective_to >= d.dateStr)
              ) : null;
              if (linkNum === null || (lDef && lDef.is_rest === 1)) isRest = true;
            }
          } else {
            // Staff without roster grid baseline (e.g. MV PRASAD, P PRATHAP)
            if (staff.rest_day && staff.rest_day.toUpperCase() === d.dayOfWeek) {
              isRest = true;
            } else if (d.dayOfWeek === 'SUN') {
              isRest = true;
            }
          }

          if (isRest) {
            code = 'R';
          } else {
            // Outstation Duty / Halt is now P (Present)
            code = 'P';
          }
        }

        // Attendance totals shown up to date only; do not show estimation for future dates
        const isPastOrToday = d.dateStr <= todayIso;
        if (isPastOrToday) {
          if (counts[code] !== undefined) counts[code]++;
          if (grandTotals[code] !== undefined) grandTotals[code]++;
        }
        const isRestDayWorked = (staffCr && staffCr.dates && staffCr.dates.includes(d.dateStr)) ||
          (remarks && /rest day worked|cr credit|cr against rest/i.test(remarks));
        days[d.dateStr] = { code, isManual, remarks, isRestDayWorked, isFuture: !isPastOrToday };
      }

      const totalLeaves = counts.CL + counts.CCL + counts.SCL + counts.LAP + counts.LHAP + counts.SICK + (counts.NH || 0);
      grandTotals.totalLeaves += totalLeaves;

      staffRows.push({
        id: staff.id,
        name: staff.name,
        designation: staff.designation || '',
        pf_no: staff.pf_no || '',
        hrms_id: staff.hrms_id || '',
        seniority_no: staff.seniority_no || null,
        categoryId: staff.category_id,
        categoryName: staff.category_name,
        categoryCode: staff.category_code,
        rowPosition: staff.row_position,
        cr_available: staffCr ? staffCr.display : null,
        cr_short_display: staffCr ? staffCr.shortDisplay : '-',
        cr_count: staffCr ? staffCr.count : 0,
        cr_dates: staffCr ? staffCr.dates : [],
        counts: {
          ...counts,
          totalLeaves,
          totalDays: effectiveTotalDays,
          cycleTotalDays: cycle.totalDays
        },
        days
      });
    }

    return ({
      success: true,
      cycle,
      staff: staffRows,
      grandTotals: {
        ...grandTotals,
        staffCount: staffMembers.length
      }
    });
}

export async function updateMusterCell(data: any, currentUser: any = "Admin") {
    const { staff_id, date, code, remarks } = data;
    if (!staff_id || !date || code === undefined || code === null) {
      throw new ApiError(400, 'staff_id, date, and code are required' );
    }

    const cleanCode = (code || '').trim().toUpperCase();
    if (cleanCode !== '' && !ALLOWED_MUSTER_CODES.includes(cleanCode)) {
      throw new ApiError(400, `Invalid code. Must be one of: ${ALLOWED_MUSTER_CODES.join(', ')} or blank` );
    }

    await withTransaction(async () => {
      const staffRow = await get('SELECT name FROM staff WHERE id = ?', [staff_id]);
      const staffName = staffRow?.name || `Staff #${staff_id}`;

      await run(
        `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
         VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           code = excluded.code,
           remarks = excluded.remarks,
           updated_by = excluded.updated_by,
           updated_at = CURRENT_TIMESTAMP`,
        [staff_id, date, cleanCode, remarks || null]
      );

      // Synchronize to Overrides, Daily View, TA Approvals, NDA, Diary, Daily Earnings, and LR Sheet
      await syncMusterToSchedulesAndApprovals(staff_id, date, cleanCode, remarks);

      const auditActionDesc = cleanCode === '' ? 'Cleared muster code to blank' : `Assigned muster code '${cleanCode}'`;
      await logAudit(
        'Admin',
        'MUSTER_CELL_UPDATE',
        `${auditActionDesc} for ${staffName} (ID ${staff_id}) on ${date} — synchronized to Daily Summary, Monthly Movement, TA, NDA, Diary, Earnings & LR Sheet`,
        { staffId: staff_id, staffName, date, code: cleanCode, savedCount: 1, errorCount: 0, savedEmployeesCount: 1, errorEmployeesCount: 0 }
      );
    });
    return ({ success: true, message: cleanCode === '' ? 'Muster cell kept blank to fill later' : `Muster cell updated to ${cleanCode} and synchronized across all sheets & documents` });
}

export async function resetMusterCell(data: any, currentUser: any = "Admin") {
    const { staff_id, date } = data;
    if (!staff_id || !date) {
      throw new ApiError(400, 'staff_id and date are required' );
    }

    await withTransaction(async () => {
      const staffRow = await get('SELECT name FROM staff WHERE id = ?', [staff_id]);
      const staffName = staffRow?.name || `Staff #${staff_id}`;

      await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, date]);
      await revertMusterFromSchedulesAndApprovals(staff_id, date);

      await logAudit(
        'Admin',
        'MUSTER_CELL_RESET',
        `Reset muster cell for ${staffName} (ID ${staff_id}) on ${date} to baseline — synchronized across Daily Summary, Monthly Movement, TA, NDA, Diary, Earnings & LR Sheet`,
        { staffId: staff_id, staffName, date, savedCount: 1, errorCount: 0, savedEmployeesCount: 1, errorEmployeesCount: 0 }
      );
    });
    return ({ success: true, message: 'Cell reset to cyclic baseline and synchronized' });
}

export async function batchUpdateMuster(data: any, currentUser: any = "Admin") {
    const { updates } = data;
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new ApiError(400, 'Array of updates required' );
    }

    let savedCount = 0;
    let errorCount = 0;
    const savedEmployeesSet = new Set();
    const errorEmployeesSet = new Set();
    const errors = [];
    const staffNameCache = {};

    const getStaffName = async (staffId) => {
      if (!staffId) return 'Unknown Employee';
      if (staffNameCache[staffId]) return staffNameCache[staffId];
      const row = await get('SELECT name FROM staff WHERE id = ?', [staffId]).catch(() => null);
      staffNameCache[staffId] = row?.name || `Employee #${staffId}`;
      return staffNameCache[staffId];
    };

    for (const item of updates) {
      try {
        if (!item.staff_id || !item.date || !item.code) {
          throw new Error('Missing staff_id, date, or attendance code');
        }
        const cleanCode = String(item.code).trim().toUpperCase();
        if (!ALLOWED_MUSTER_CODES.includes(cleanCode)) {
          throw new Error(`Invalid attendance code "${cleanCode}" on ${item.date}`);
        }

        await withTransaction(async () => {
          await run(
            `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
             VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               code = excluded.code,
               remarks = excluded.remarks,
               updated_by = excluded.updated_by,
               updated_at = CURRENT_TIMESTAMP`,
            [item.staff_id, item.date, cleanCode, item.remarks || null]
          );

          await syncMusterToSchedulesAndApprovals(item.staff_id, item.date, cleanCode, item.remarks);
        });
        savedCount++;
        savedEmployeesSet.add(item.staff_id);
      } catch (itemErr) {
        errorCount++;
        if (item?.staff_id) errorEmployeesSet.add(item.staff_id);
        const sName = await getStaffName(item?.staff_id);
        errors.push({
          staff_id: item?.staff_id || null,
          staff_name: sName,
          date: item?.date || null,
          error: itemErr.message
        });
      }
    }

    const savedEmployeesCount = savedEmployeesSet.size;
    const errorEmployeesCount = errorEmployeesSet.size;
    await logAudit(
      'Admin',
      'MUSTER_BATCH_UPDATE',
      `Saved Muster Roll records one-by-one: ${savedEmployeesCount} employee(s) (${savedCount} day record(s)) saved, ${errorEmployeesCount} employee(s) (${errorCount} day record(s)) failed`,
      { savedCount, errorCount, savedEmployeesCount, errorEmployeesCount }
    );
    const errorSummary = errors.length > 0
      ? ` | Errors: ${errors.map(e => `${e.staff_name} (${e.date || '?'}): ${e.error}`).join('; ')}`
      : '';
    return ({
      success: errorCount === 0,
      savedCount,
      errorCount,
      savedEmployeesCount,
      errorEmployeesCount,
      errors,
      message: `Muster Roll Save Complete: ${savedEmployeesCount} employee(s) (${savedCount} day record(s)) saved successfully, ${errorEmployeesCount} employee(s) (${errorCount} day record(s)) had an error.${errorSummary}`
    });
}

export async function batchResetMuster(data: any, currentUser: any = "Admin") {
    const { resets } = data; // Array of { staff_id, date }
    if (!Array.isArray(resets) || resets.length === 0) {
      throw new ApiError(400, 'Array of resets required' );
    }

    let savedCount = 0;
    let errorCount = 0;
    const savedEmployeesSet = new Set();
    const errorEmployeesSet = new Set();
    const errors = [];
    const staffNameCache = {};

    const getStaffName = async (staffId) => {
      if (!staffId) return 'Unknown Employee';
      if (staffNameCache[staffId]) return staffNameCache[staffId];
      const row = await get('SELECT name FROM staff WHERE id = ?', [staffId]).catch(() => null);
      staffNameCache[staffId] = row?.name || `Employee #${staffId}`;
      return staffNameCache[staffId];
    };

    for (const item of resets) {
      try {
        if (!item.staff_id || !item.date) {
          throw new Error('Missing staff_id or date');
        }
        await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [item.staff_id, item.date]);
        await revertMusterFromSchedulesAndApprovals(item.staff_id, item.date);
        savedCount++;
        savedEmployeesSet.add(item.staff_id);
      } catch (itemErr) {
        errorCount++;
        if (item?.staff_id) errorEmployeesSet.add(item.staff_id);
        const sName = await getStaffName(item?.staff_id);
        errors.push({
          staff_id: item?.staff_id || null,
          staff_name: sName,
          date: item?.date || null,
          error: itemErr.message
        });
      }
    }

    const savedEmployeesCount = savedEmployeesSet.size;
    const errorEmployeesCount = errorEmployeesSet.size;
    await logAudit(
      'Admin',
      'MUSTER_BATCH_RESET',
      `Reset Muster Roll records one-by-one: ${savedEmployeesCount} employee(s) (${savedCount} day record(s)) reset, ${errorEmployeesCount} employee(s) (${errorCount} day record(s)) failed`,
      { savedCount, errorCount, savedEmployeesCount, errorEmployeesCount }
    );
    const errorSummary = errors.length > 0
      ? ` | Errors: ${errors.map(e => `${e.staff_name} (${e.date || '?'}): ${e.error}`).join('; ')}`
      : '';
    return ({
      success: errorCount === 0,
      savedCount,
      errorCount,
      savedEmployeesCount,
      errorEmployeesCount,
      errors,
      message: `Muster Reset Complete: ${savedEmployeesCount} employee(s) (${savedCount} day record(s)) reset successfully, ${errorEmployeesCount} employee(s) (${errorCount} day record(s)) had an error.${errorSummary}`
    });
}

export async function reorderMuster(data: any, currentUser: any = "Admin") {
    const { staff_ids } = data; // Array of staff IDs in the new order [id1, id2, id3, ...]
    if (!Array.isArray(staff_ids) || staff_ids.length === 0) {
      throw new ApiError(400, 'staff_ids array is required' );
    }

    let savedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let index = 0; index < staff_ids.length; index++) {
      const staffId = staff_ids[index];
      const newSeniorityNo = index + 1;
      try {
        await run('UPDATE staff SET seniority_no = ? WHERE id = ?', [newSeniorityNo, staffId]);
        savedCount++;
      } catch (itemErr) {
        errorCount++;
        const staffRow = await get('SELECT name FROM staff WHERE id = ?', [staffId]).catch(() => null);
        errors.push({
          staff_id: staffId,
          staff_name: staffRow?.name || `Employee #${staffId}`,
          error: itemErr.message
        });
      }
    }

    await logAudit('Admin', 'MUSTER_REORDER', `Reordered muster staff one-by-one: ${savedCount} succeeded, ${errorCount} failed`, { savedCount, errorCount });
    const errorSummary = errors.length > 0
      ? ` | Errors: ${errors.map(e => `${e.staff_name}: ${e.error}`).join('; ')}`
      : '';
    return ({
      success: errorCount === 0,
      savedCount,
      errorCount,
      errors,
      message: `Muster Roll Order Saved: ${savedCount} employee(s) saved successfully, ${errorCount} had an error.${errorSummary}`
    });
}

export async function addEmployeeToMuster(data: any, currentUser: any = "Admin") {
  if (currentUser && currentUser !== 'Admin') {
    throw new ApiError(403, 'Permission denied: Administrator privileges required.' );
  }
    const {
      mode, // 'new' | 'existing'
      name,
      designation,
      category_id,
      pf_no,
      hrms_id,
      rest_day,
      seniority_no,
      existing_staff_id
    } = data;

    const targetCatId = parseInt(category_id, 10) || 1;

    if (mode === 'existing') {
      if (!existing_staff_id) {
        throw new ApiError(400, 'existing_staff_id is required' );
      }
      const existing = await get('SELECT * FROM staff WHERE id = ?', [existing_staff_id]);
      if (!existing) {
        throw new ApiError(404, 'Staff member not found' );
      }

      const maxRow = await get('SELECT MAX(row_position) as maxPos FROM staff WHERE category_id = ?', [targetCatId]);
      const nextPos = (maxRow?.maxPos || 0) + 1;

      await run(
        `UPDATE staff 
         SET category_id = ?, 
             row_position = ?, 
             designation = COALESCE(?, designation),
             rest_day = COALESCE(?, rest_day),
             pf_no = COALESCE(?, pf_no),
             hrms_id = COALESCE(?, hrms_id),
             seniority_no = COALESCE(?, seniority_no)
         WHERE id = ?`,
        [targetCatId, nextPos, designation || null, rest_day || null, pf_no || null, hrms_id || null, seniority_no || null, existing_staff_id]
      );

      if (targetCatId === 4) {
        try {
          await run(`UPDATE categories SET cycle_length = (SELECT COUNT(*) FROM staff WHERE category_id = 4) WHERE id = 4`);
        } catch (e) { }
      }

      await logAudit(currentUser ? currentUser : 'Admin', 'ADD_MUSTER_EMPLOYEE', `Added existing staff '${existing.name}' to Category ${targetCatId} at position ${nextPos}`);

      return ({
        success: true,
        message: `Successfully added ${existing.name} to Muster (Category ${targetCatId})!`,
        staffId: existing_staff_id,
        rowPosition: nextPos
      });
    }

    // Mode: 'new'
    if (!name || !name.trim()) {
      throw new ApiError(400, 'Employee name is required' );
    }

    const cleanName = name.trim().toUpperCase();
    const cleanDesg = (designation || 'TTI').trim().toUpperCase();
    const cleanPf = pf_no ? pf_no.trim().toUpperCase() : null;
    const cleanHrms = hrms_id ? hrms_id.trim().toUpperCase() : null;
    const cleanRest = rest_day ? rest_day.trim().toUpperCase() : 'SUN';

    const maxRow = await get('SELECT MAX(row_position) as maxPos FROM staff WHERE category_id = ?', [targetCatId]);
    const nextPos = (maxRow?.maxPos || 0) + 1;

    let senNo = parseInt(seniority_no, 10);
    if (!senNo || isNaN(senNo)) {
      const maxSen = await get('SELECT MAX(seniority_no) as maxSen FROM staff WHERE seniority_no < 9000');
      senNo = (maxSen?.maxSen || 100) + 1;
    }

    const insResult = await run(
      `INSERT INTO staff (name, designation, category_id, row_position, rest_day, pf_no, hrms_id, seniority_no)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cleanName, cleanDesg, targetCatId, nextPos, cleanRest, cleanPf, cleanHrms, senNo]
    );

    if (targetCatId === 4) {
      try {
        await run(`UPDATE categories SET cycle_length = (SELECT COUNT(*) FROM staff WHERE category_id = 4) WHERE id = 4`);
      } catch (e) { }
    }

    await logAudit(currentUser ? currentUser : 'Admin', 'ADD_MUSTER_EMPLOYEE', `Created new staff '${cleanName}' in Category ${targetCatId} at position ${nextPos}`);

    return ({
      success: true,
      message: `Successfully created and added ${cleanName} to Muster!`,
      staffId: insResult.lastID,
      rowPosition: nextPos
    });
}

export async function deleteEmployeeFromMuster(data: any, currentUser: any = "Admin") {
  if (currentUser && currentUser !== 'Admin') {
    throw new ApiError(403, 'Permission denied: Administrator privileges required.' );
  }
    const { staff_id, permanent_delete } = data;
    if (!staff_id) {
      throw new ApiError(400, 'staff_id is required' );
    }

    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) {
      throw new ApiError(404, 'Staff member not found' );
    }

    const staffName = staff.name;
    const catId = staff.category_id;
    const oldPos = staff.row_position;

    if (permanent_delete) {
      try { await run('DELETE FROM muster_records WHERE staff_id = ?', [staff_id]); } catch (e) { }
      try { await run('DELETE FROM overrides WHERE staff_id = ? OR substitute_staff_id = ?', [staff_id, staff_id]); } catch (e) { }
      try { await run('DELETE FROM ta_approvals WHERE staff_id = ?', [staff_id]); } catch (e) { }
      try { await run('DELETE FROM ta_entries WHERE staff_id = ?', [staff_id]); } catch (e) { }
      try { await run('DELETE FROM nda_entries WHERE staff_id = ?', [staff_id]); } catch (e) { }
      try { await run('DELETE FROM diary_entries WHERE staff_id = ?', [staff_id]); } catch (e) { }
      try { await run('DELETE FROM daily_earnings_entries WHERE staff_id = ?', [staff_id]); } catch (e) { }
      try { await run('DELETE FROM lr_sheet_records WHERE staff_id = ?', [staff_id]); } catch (e) { }
      try { await run('DELETE FROM duty_register_staff WHERE staff_id = ?', [staff_id]); } catch (e) { }
      try { await run('DELETE FROM leave_requests WHERE staff_id = ? OR swap_staff_id = ?', [staff_id, staff_id]); } catch (e) { }
      try { await run('UPDATE users SET staff_id = NULL WHERE staff_id = ?', [staff_id]); } catch (e) { } try { await run('UPDATE non_daily_trains SET assigned_staff_id = NULL WHERE assigned_staff_id = ?', [staff_id]); } catch (e) { }
      try { await run('DELETE FROM lr_duty_completions WHERE staff_id = ?', [staff_id]); } catch (e) { }
      await run('DELETE FROM staff WHERE id = ?', [staff_id]);
    } else {
      await run('UPDATE staff SET active = 0, category_id = NULL, row_position = NULL WHERE id = ?', [staff_id]);
    }

    if (catId) {
      const remaining = await all('SELECT id FROM staff WHERE category_id = ? ORDER BY row_position ASC, id ASC', [catId]);
      for (let i = 0; i < remaining.length; i++) {
        await run('UPDATE staff SET row_position = ? WHERE id = ?', [i + 1, remaining[i].id]);
      }
      if (catId === 4) {
        try {
          await run(`UPDATE categories SET cycle_length = (SELECT COUNT(*) FROM staff WHERE category_id = 4) WHERE id = 4`);
        } catch (e) { }
      }
    }

    await logAudit(
      currentUser ? currentUser : 'Admin',
      'DELETE_MUSTER_EMPLOYEE',
      `${permanent_delete ? 'Permanently deleted' : 'Removed from Muster/category'} staff '${staffName}' (ID: ${staff_id})`
    );

    return ({
      success: true,
      message: `Successfully ${permanent_delete ? 'deleted' : 'removed'} ${staffName} from Muster.`,
      staffId: staff_id
    });
}
