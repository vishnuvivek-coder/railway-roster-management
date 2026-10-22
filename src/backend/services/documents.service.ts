import { get, all, run } from '../db';
import { ApiError } from '../utils/api_error';
import {
  generateStaffTaJournal,
  generatePendingTaClaimsForMonth,
  calculateAbsenceAndTa
} from '../ta_generator';
import { generateStaffNdaJournal } from '../nda_generator';
import { generateStaffDiary } from '../diary_generator';
import { generateDailyBookingChart } from '../daily_booking_generator';
import {
  generateDailyEarnings,
  generateStaffMonthlyEarnings,
  generateRangeDailyEarnings
} from '../daily_earnings_generator';
import {
  resolveIsoDateFromDocRow,
  syncDailyEarningsItemToDiary
} from './helpers.service';
import {
  syncClaimToTaEntries,
  removeClaimFromTaEntries
} from './sync.service';
import { logAudit } from './audit.service';

export async function getTaDocument(staffId: any, query: any) {
    staffId = parseInt(staffId, 10);
    const year = parseInt(query.year, 10) || new Date().getFullYear();
    const month = parseInt(query.month, 10) || (new Date().getMonth() + 1);
    const startDate = query.start_date || query.startDate || null;
    const endDate = query.end_date || query.endDate || null;

    const journal = await generateStaffTaJournal({ get, all, run }, staffId, year, month, startDate, endDate);
    return (journal);
}

export async function saveTaDocument(staffId: any, data: any, currentUser: any = "Admin") {
    staffId = parseInt(staffId, 10);
    const { month_year, start_date, end_date, entries, employee_meta } = data;

    if (!Array.isArray(entries)) {
      throw new ApiError(400, 'Invalid payload. entries array required.' );
    }

    // Update employee profile metadata if provided
    if (employee_meta) {
      const { name, designation, pay, pf_no, bill_unit, doa, hq } = employee_meta;
      if (name) {
        await run('UPDATE staff SET name = ? WHERE id = ?', [name, staffId]);
      }
      if (designation) {
        await run('UPDATE staff SET designation = ? WHERE id = ?', [designation, staffId]);
      }
      await run(
        `UPDATE staff SET pay_amount = ?, pf_no = ?, bill_unit = ?, doa = ?, hq_station = ? WHERE id = ?`,
        [pay || 68000, pf_no || '07323475', bill_unit || '0910629', doa || '05/08/2000', hq || 'GNT', staffId]
      );
    }

    // Delete existing saved entries for this staff in range or month
    if (start_date && end_date) {
      await run('DELETE FROM ta_entries WHERE staff_id = ? AND duty_date >= ? AND duty_date <= ?', [staffId, start_date, end_date]);
    } else if (month_year) {
      await run('DELETE FROM ta_entries WHERE staff_id = ? AND month_year = ?', [staffId, month_year]);
    }

    const staffMember = await get('SELECT id, category_id FROM staff WHERE id = ?', [staffId]);
    const defaultObjText = (staffMember && staffMember.category_id === 1) ? 'MANNING AC COACHES' : 'MANNING SLEEPER COACHES';

    // Save all current rows & propagate timings
    for (let i = 0; i < entries.length; i++) {
      const item = entries[i];
      let daysClaiming = item.days_claiming_ta !== null && item.days_claiming_ta !== undefined && item.days_claiming_ta !== ''
        ? parseFloat(item.days_claiming_ta)
        : null;
      if (daysClaiming !== null && !isNaN(daysClaiming)) {
        daysClaiming = Math.min(1.0, Math.max(0.01, daysClaiming));
      } else {
        daysClaiming = null;
      }

      const dutyDate = item.date_iso || item.duty_date || null;
      const rowMonthYear = item.month_year || month_year || (dutyDate ? dutyDate.slice(0, 7) : '2026-09');

      await run(
        `INSERT INTO ta_entries (staff_id, month_year, duty_date, date_str, train_no, from_station, to_station, dep_time, arr_time, ta_a1, ta_a, ta_b1, days_claiming_ta, object_of_journey, remarks, row_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          staffId,
          rowMonthYear,
          dutyDate,
          item.date_str || '',
          item.train_no || '',
          item.from_station || '',
          item.to_station || '',
          item.dep_time || '',
          item.arr_time || '',
          item.ta_a1 || '',
          item.ta_a || '',
          item.ta_b1 || '',
          daysClaiming,
          item.object_of_journey || defaultObjText,
          item.remarks || '',
          i + 1
        ]
      );

      // Save to actual_train_runs cache so all document generators pick it up
      if (item.train_no && item.date_iso) {
        if (item.from_station && item.dep_time && item.dep_time !== '---') {
          await run(
            `INSERT OR REPLACE INTO actual_train_runs (train_no, run_date, station_code, sched_arr, sched_dep, act_arr, act_dep, delay_arr_mins, delay_dep_mins, source)
             VALUES (?, ?, ?, '---', ?, '---', ?, 0, 0, 'TA_SYNC')`,
            [item.train_no, item.date_iso, item.from_station, item.sched_dep || item.dep_time, item.dep_time]
          );
        }
        if (item.to_station && item.arr_time && item.arr_time !== '---') {
          await run(
            `INSERT OR REPLACE INTO actual_train_runs (train_no, run_date, station_code, sched_arr, sched_dep, act_arr, act_dep, delay_arr_mins, delay_dep_mins, source)
             VALUES (?, ?, ?, ?, '---', ?, '---', 0, 0, 'TA_SYNC')`,
            [item.train_no, item.date_iso, item.to_station, item.sched_arr || item.arr_time, item.arr_time]
          );
        }
      }

      // Propagate timing updates to matching ta_approvals, nda_entries, and diary_entries rows
      if (item.train_no && (item.date_str || dutyDate)) {
        await run(
          `UPDATE ta_approvals 
           SET dep_time = CASE WHEN ? != '' AND ? != '---' THEN ? ELSE dep_time END,
               arr_time = CASE WHEN ? != '' AND ? != '---' THEN ? ELSE arr_time END,
               ta_percentage = COALESCE(?, ta_percentage)
           WHERE staff_id = ? AND (duty_date = ? OR date_str = ?) AND train_no = ?`,
          [
            item.dep_time || '', item.dep_time || '', item.dep_time || '',
            item.arr_time || '', item.arr_time || '', item.arr_time || '',
            daysClaiming,
            staffId, dutyDate || item.date_str, item.date_str || '', item.train_no
          ]
        );
        await run(
          `UPDATE nda_entries 
           SET act_dep = CASE WHEN ? != '' AND ? != '---' THEN ? ELSE act_dep END,
               act_arr = CASE WHEN ? != '' AND ? != '---' THEN ? ELSE act_arr END
           WHERE staff_id = ? AND month_year = ? AND (date_str = ? OR date_str = ?) AND train_no = ?`,
          [
            item.dep_time || '', item.dep_time || '', item.dep_time || '',
            item.arr_time || '', item.arr_time || '', item.arr_time || '',
            staffId, rowMonthYear, item.date_str || '', dutyDate || '', item.train_no
          ]
        );
        await run(
          `UPDATE diary_entries 
           SET dep_time = CASE WHEN ? != '' AND ? != '---' THEN ? ELSE dep_time END,
               arr_time = CASE WHEN ? != '' AND ? != '---' THEN ? ELSE arr_time END
           WHERE staff_id = ? AND month_year = ? AND (date_str = ? OR date_str = ?) AND train_no = ?`,
          [
            item.dep_time || '', item.dep_time || '', item.dep_time || '',
            item.arr_time || '', item.arr_time || '', item.arr_time || '',
            staffId, rowMonthYear, item.date_str || '', dutyDate || '', item.train_no
          ]
        );
      }
    }

    const staffRow = await get('SELECT name FROM staff WHERE id = ?', [staffId]).catch(() => null);
    const staffLabel = staffRow?.name || employee_meta?.name || `Staff #${staffId}`;
    const periodLabel = (start_date && end_date) ? `${start_date} to ${end_date}` : (month_year || 'Month');
    await logAudit(
      currentUser?.role || 'Admin',
      'SAVE_TA_JOURNAL',
      `Saved TA Journal for ${staffLabel} (${periodLabel}): ${entries.length} leg row(s) saved & synced to TA Approvals, NDA, and Diary`,
      {
        staff_id: staffId,
        staff_name: staffLabel,
        month_year: month_year || periodLabel,
        savedCount: entries.length,
        errorCount: 0,
        savedEmployeesCount: 1,
        errorEmployeesCount: 0
      }
    );

    return ({
      success: true,
      savedCount: entries.length,
      errorCount: 0,
      savedEmployeesCount: 1,
      errorEmployeesCount: 0,
      message: `Travelling Allowance Journal saved for ${staffLabel} (${entries.length} row(s)) and synced to TA Approvals, NDA & Diary!`
    });
}

export async function resetTaDocument(staffId: any, query: any, currentUser: any = "Admin") {
    staffId = parseInt(staffId, 10);
    const startDate = query.start_date || query.startDate;
    const endDate = query.end_date || query.endDate;
    let periodLabel = '';
    if (startDate && endDate) {
      periodLabel = `${startDate} to ${endDate}`;
      await run('DELETE FROM ta_entries WHERE staff_id = ? AND duty_date >= ? AND duty_date <= ?', [staffId, startDate, endDate]);
    } else {
      const year = parseInt(query.year, 10) || new Date().getFullYear();
      const month = parseInt(query.month, 10) || (new Date().getMonth() + 1);
      const monthYearStr = `${year}-${String(month).padStart(2, '0')}`;
      periodLabel = monthYearStr;
      await run('DELETE FROM ta_entries WHERE staff_id = ? AND month_year = ?', [staffId, monthYearStr]);
    }
    const staffRow = await get('SELECT name FROM staff WHERE id = ?', [staffId]).catch(() => null);
    const staffLabel = staffRow?.name || `Staff #${staffId}`;
    await logAudit(
      currentUser?.role || 'Admin',
      'RESET_TA_JOURNAL',
      `Reset TA Journal for ${staffLabel} (${periodLabel}) to master roster rotation`,
      { staff_id: staffId, staff_name: staffLabel, month_year: periodLabel }
    );
    return ({ success: true, message: 'TA Journal reset to master roster rotation.' });
}

export async function getTaApprovals(query: any) {
    const year = parseInt(query.year, 10) || new Date().getFullYear();
    const month = parseInt(query.month, 10) || (new Date().getMonth() + 1);
    const startDate = query.start_date || query.startDate || null;
    const endDate = query.end_date || query.endDate || null;
    const categoryId = query.category_id && query.category_id !== 'ALL' ? parseInt(query.category_id, 10) : null;
    const status = query.status && query.status !== 'ALL' ? query.status.toUpperCase() : null;
    const search = query.search ? query.search.trim().toLowerCase() : '';

    const monthYearStr = `${year}-${String(month).padStart(2, '0')}`;

    // Auto-generate pending claims if none exist for this month or range
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      let curr = new Date(start.getFullYear(), start.getMonth(), 1);
      const last = new Date(end.getFullYear(), end.getMonth(), 1);
      while (curr <= last) {
        const mStr = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}`;
        const existing = await get('SELECT id FROM ta_approvals WHERE month_year = ? LIMIT 1', [mStr]);
        if (!existing) {
          await generatePendingTaClaimsForMonth({ get, all, run }, curr.getFullYear(), curr.getMonth() + 1);
        }
        curr.setMonth(curr.getMonth() + 1);
      }
    } else {
      const existing = await get('SELECT id FROM ta_approvals WHERE month_year = ? LIMIT 1', [monthYearStr]);
      if (!existing) {
        await generatePendingTaClaimsForMonth({ get, all, run }, year, month);
      }
    }

    // Fetch summary statistics
    let statsSql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN a.status = 'PENDING' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN a.status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN a.status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN a.status = 'PENDING' THEN a.claim_amount ELSE 0 END) as total_pending_amount,
        SUM(CASE WHEN a.status = 'APPROVED' THEN a.claim_amount ELSE 0 END) as total_approved_amount
      FROM ta_approvals a
      JOIN staff s ON a.staff_id = s.id
      WHERE ${(startDate && endDate) ? 'a.duty_date >= ? AND a.duty_date <= ?' : 'a.month_year = ?'}
    `;
    const statsParams = (startDate && endDate) ? [startDate, endDate] : [monthYearStr];
    if (categoryId) {
      statsSql += ' AND s.category_id = ?';
      statsParams.push(categoryId);
    }
    const stats = await get(statsSql, statsParams);

    // Fetch filtered claims list
    let listSql = `
      SELECT 
        a.*,
        s.name as staff_name,
        s.designation as staff_designation,
        s.pf_no as staff_pf_no,
        s.category_id,
        c.name as category_name
      FROM ta_approvals a
      JOIN staff s ON a.staff_id = s.id
      JOIN categories c ON s.category_id = c.id
      WHERE ${(startDate && endDate) ? 'a.duty_date >= ? AND a.duty_date <= ?' : 'a.month_year = ?'}
    `;
    const listParams = (startDate && endDate) ? [startDate, endDate] : [monthYearStr];

    if (categoryId) {
      listSql += ' AND s.category_id = ?';
      listParams.push(categoryId);
    }
    if (status) {
      listSql += ' AND a.status = ?';
      listParams.push(status);
    }
    if (search) {
      listSql += ' AND (LOWER(s.name) LIKE ? OR LOWER(s.designation) LIKE ? OR a.train_no LIKE ? OR LOWER(a.from_station) LIKE ? OR LOWER(a.to_station) LIKE ?)';
      const sPattern = `%${search}%`;
      listParams.push(sPattern, sPattern, sPattern, sPattern, sPattern);
    }

    listSql += ' ORDER BY a.duty_date ASC, s.row_position ASC, a.row_order ASC';

    const claims = await all(listSql, listParams);

    return ({
      success: true,
      year,
      month,
      month_year: monthYearStr,
      stats: {
        total: stats?.total || 0,
        pending: stats?.pending || 0,
        approved: stats?.approved || 0,
        rejected: stats?.rejected || 0,
        total_pending_amount: stats?.total_pending_amount || 0,
        total_approved_amount: stats?.total_approved_amount || 0
      },
      claims
    });
}

export async function syncTaApprovals(data: any, currentUser: any = "Admin") {
    const { year, month } = data;
    const y = parseInt(year, 10) || new Date().getFullYear();
    const m = parseInt(month, 10) || (new Date().getMonth() + 1);

    await generatePendingTaClaimsForMonth({ get, all, run }, y, m);
    await logAudit(
      currentUser?.name || currentUser?.username || 'Admin',
      'SYNC_TA_APPROVALS',
      `Synchronized & regenerated TA Claims for ${String(m).padStart(2, '0')}/${y} from live Roster, Overrides, Muster Roll & LR Sheet`,
      { year: y, month: m }
    );
    return ({ success: true, message: `Synced TA claims for ${m}/${y}` });
}

export async function acceptTaApproval(data: any, currentUser: any = "Admin") {
    const { id } = data;
    if (!id) throw new ApiError(400, 'Claim id required' );

    const claim = await get('SELECT a.*, s.name as staff_name FROM ta_approvals a JOIN staff s ON a.staff_id = s.id WHERE a.id = ?', [id]);
    if (!claim) throw new ApiError(404, 'Claim not found' );

    const adminName = currentUser?.name || currentUser?.username || 'Admin';
    await run(
      `UPDATE ta_approvals SET
        status = 'APPROVED',
        approved_by = ?,
        approved_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [adminName, id]
    );

    await syncClaimToTaEntries(id);
    await logAudit(
      adminName,
      'ACCEPT_TA',
      `Accepted TA claim for ${claim.staff_name} on ${claim.date_str} (Train ${claim.train_no}) — synced to TA Journal`,
      { claim_id: id, staffId: claim.staff_id, staffName: claim.staff_name, savedCount: 1, errorCount: 0, savedEmployeesCount: 1, errorEmployeesCount: 0 }
    );

    return ({ success: true, message: `TA claim accepted for ${claim.staff_name}` });
}

export async function acceptBatchTaApprovals(data: any, currentUser: any = "Admin") {
    const { ids } = data;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'Array of claim ids required' );
    }

    const adminName = currentUser?.name || currentUser?.username || 'Admin';
    let savedCount = 0;
    let errorCount = 0;
    const savedEmployeesSet = new Set();
    const errorEmployeesSet = new Set();
    const errors = [];

    for (const id of ids) {
      let claimRow = null;
      try {
        claimRow = await get(
          'SELECT a.id, a.staff_id, a.date_str, s.name as staff_name FROM ta_approvals a LEFT JOIN staff s ON a.staff_id = s.id WHERE a.id = ?',
          [id]
        );
        if (!claimRow) {
          throw new Error(`TA Claim #${id} not found`);
        }
        await run(
          `UPDATE ta_approvals SET
            status = 'APPROVED',
            approved_by = ?,
            approved_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [adminName, id]
        );
        await syncClaimToTaEntries(id);
        savedCount++;
        if (claimRow.staff_id) savedEmployeesSet.add(claimRow.staff_id);
      } catch (itemErr) {
        errorCount++;
        if (claimRow?.staff_id) errorEmployeesSet.add(claimRow.staff_id);
        errors.push({
          claim_id: id,
          staff_id: claimRow?.staff_id || null,
          staff_name: claimRow?.staff_name || `Claim #${id}`,
          error: itemErr.message
        });
      }
    }

    const savedEmployeesCount = savedEmployeesSet.size;
    const errorEmployeesCount = errorEmployeesSet.size;
    await logAudit(
      adminName,
      'ACCEPT_TA_BATCH',
      `Batch accepted TA claims one-by-one: ${savedEmployeesCount} employee(s) (${savedCount} claim(s)) saved, ${errorEmployeesCount} employee(s) (${errorCount} claim(s)) failed`,
      { savedCount, errorCount, savedEmployeesCount, errorEmployeesCount }
    );
    const errorSummary = errors.length > 0
      ? ` | Errors: ${errors.map(e => `${e.staff_name}: ${e.error}`).join('; ')}`
      : '';
    return ({
      success: errorCount === 0,
      count: savedCount,
      savedCount,
      errorCount,
      savedEmployeesCount,
      errorEmployeesCount,
      errors,
      message: `TA Approvals Save Complete: ${savedEmployeesCount} employee(s) (${savedCount} claim(s)) saved successfully, ${errorEmployeesCount} employee(s) (${errorCount} claim(s)) had an error.${errorSummary}`
    });
}

export async function acceptAllTaApprovals(data: any, currentUser: any = "Admin") {
    const { year, month, category_id } = data;
    const y = parseInt(year, 10) || new Date().getFullYear();
    const m = parseInt(month, 10) || (new Date().getMonth() + 1);
    const monthYearStr = `${y}-${String(m).padStart(2, '0')}`;

    let sql = `
      SELECT a.id, a.staff_id, a.date_str, s.name as staff_name FROM ta_approvals a
      JOIN staff s ON a.staff_id = s.id
      WHERE a.month_year = ? AND a.status = 'PENDING'
    `;
    const params: any[] = [monthYearStr];
    if (category_id && category_id !== 'ALL') {
      sql += ' AND s.category_id = ?';
      params.push(parseInt(category_id, 10));
    }

    const pendingClaims = await all(sql, params);
    const adminName = currentUser?.name || currentUser?.username || 'Admin';
    let savedCount = 0;
    let errorCount = 0;
    const savedEmployeesSet = new Set();
    const errorEmployeesSet = new Set();
    const errors = [];

    for (const claim of pendingClaims) {
      try {
        await run(
          `UPDATE ta_approvals SET
            status = 'APPROVED',
            approved_by = ?,
            approved_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [adminName, claim.id]
        );
        await syncClaimToTaEntries(claim.id);
        savedCount++;
        if (claim.staff_id) savedEmployeesSet.add(claim.staff_id);
      } catch (itemErr) {
        errorCount++;
        if (claim.staff_id) errorEmployeesSet.add(claim.staff_id);
        errors.push({
          claim_id: claim.id,
          staff_id: claim.staff_id,
          staff_name: claim.staff_name || `Employee #${claim.staff_id}`,
          error: itemErr.message
        });
      }
    }

    const savedEmployeesCount = savedEmployeesSet.size;
    const errorEmployeesCount = errorEmployeesSet.size;
    await logAudit(
      adminName,
      'ACCEPT_TA_ALL',
      `Accepted pending TA claims for ${m}/${y} one-by-one: ${savedEmployeesCount} employee(s) (${savedCount} claim(s)) saved, ${errorEmployeesCount} employee(s) (${errorCount} claim(s)) failed`,
      { savedCount, errorCount, savedEmployeesCount, errorEmployeesCount, month_year: monthYearStr }
    );
    const errorSummary = errors.length > 0
      ? ` | Errors: ${errors.map(e => `${e.staff_name}: ${e.error}`).join('; ')}`
      : '';
    return ({
      success: errorCount === 0,
      count: savedCount,
      savedCount,
      errorCount,
      savedEmployeesCount,
      errorEmployeesCount,
      errors,
      message: `TA Approvals Save Complete: ${savedEmployeesCount} employee(s) (${savedCount} claim(s)) saved successfully, ${errorEmployeesCount} employee(s) (${errorCount} claim(s)) had an error.${errorSummary}`
    });
}

export async function rejectTaApproval(data: any, currentUser: any = "Admin") {
    const { id, ids, reason } = data;
    const targetIds = Array.isArray(ids) ? ids : (id ? [id] : []);
    if (targetIds.length === 0) {
      throw new ApiError(400, 'Claim id or ids required' );
    }

    const adminName = currentUser?.name || currentUser?.username || 'Admin';
    let savedCount = 0;
    let errorCount = 0;
    const savedEmployeesSet = new Set();
    const errorEmployeesSet = new Set();
    const errors = [];

    for (const claimId of targetIds) {
      let claimRow = null;
      try {
        claimRow = await get(
          'SELECT a.id, a.staff_id, s.name as staff_name FROM ta_approvals a LEFT JOIN staff s ON a.staff_id = s.id WHERE a.id = ?',
          [claimId]
        );
        await run(
          `UPDATE ta_approvals SET
            status = 'REJECTED',
            rejection_reason = ?,
            approved_by = ?,
            approved_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [reason || 'Rejected by Admin', adminName, claimId]
        );
        await removeClaimFromTaEntries(claimId);
        savedCount++;
        if (claimRow?.staff_id) savedEmployeesSet.add(claimRow.staff_id);
      } catch (itemErr) {
        errorCount++;
        if (claimRow?.staff_id) errorEmployeesSet.add(claimRow.staff_id);
        errors.push({
          claim_id: claimId,
          staff_id: claimRow?.staff_id || null,
          staff_name: claimRow?.staff_name || `Claim #${claimId}`,
          error: itemErr.message
        });
      }
    }

    const savedEmployeesCount = savedEmployeesSet.size;
    const errorEmployeesCount = errorEmployeesSet.size;
    await logAudit(
      adminName,
      'REJECT_TA',
      `Rejected ${savedCount} TA claim(s) across ${savedEmployeesCount} employee(s) (${errorCount} failed): ${reason || 'No reason specified'}`,
      { savedCount, errorCount, savedEmployeesCount, errorEmployeesCount, reason }
    );
    const errorSummary = errors.length > 0
      ? ` | Errors: ${errors.map(e => `${e.staff_name}: ${e.error}`).join('; ')}`
      : '';
    return ({
      success: errorCount === 0,
      count: savedCount,
      savedCount,
      errorCount,
      savedEmployeesCount,
      errorEmployeesCount,
      errors,
      message: `Rejected ${savedCount} TA claim(s) across ${savedEmployeesCount} employee(s), ${errorCount} failed.${errorSummary}`
    });
}

export async function revertTaApproval(data: any, currentUser: any = "Admin") {
    const { id } = data;
    if (!id) throw new ApiError(400, 'Claim id required' );

    const claim = await get('SELECT a.*, s.name as staff_name FROM ta_approvals a LEFT JOIN staff s ON a.staff_id = s.id WHERE a.id = ?', [id]);

    await run(
      `UPDATE ta_approvals SET
        status = 'PENDING',
        approved_by = NULL,
        approved_at = NULL,
        rejection_reason = NULL
       WHERE id = ?`,
      [id]
    );

    await removeClaimFromTaEntries(id);
    await logAudit(
      currentUser?.name || currentUser?.username || 'Admin',
      'REVERT_TA',
      `Reverted TA claim for ${claim?.staff_name || `Claim #${id}`} on ${claim?.date_str || ''} (${claim?.train_no || ''}) back to PENDING`,
      { claim_id: id, staffId: claim?.staff_id, staffName: claim?.staff_name, savedCount: 1, errorCount: 0 }
    );
    return ({ success: true, message: 'Claim reverted to PENDING' });
}

export async function getNdaDocument(staffId: any, query: any) {
    staffId = parseInt(staffId, 10);
    let year = parseInt(query.year, 10);
    let month = parseInt(query.month, 10);
    if (query.month && String(query.month).includes('-')) {
      const parts = String(query.month).split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    }
    if (!year) year = new Date().getFullYear();
    if (!month) month = new Date().getMonth() + 1;

    const startDate = query.start_date || null;
    const endDate = query.end_date || null;

    const journal = await generateStaffNdaJournal({ get, all, run }, staffId, year, month, startDate, endDate);
    return (journal);
}

export async function saveNdaDocument(staffId: any, data: any, currentUser: any = "Admin") {
    staffId = parseInt(staffId, 10);
    const { month_year, entries, employee_meta } = data;

    if (!month_year || !Array.isArray(entries)) {
      throw new ApiError(400, 'Invalid payload. month_year and entries array required.' );
    }

    // Update employee profile metadata if provided
    if (employee_meta) {
      const { name, designation, pay, pf_no, bill_unit, doa, hq } = employee_meta;
      await run(
        `UPDATE staff 
         SET name = COALESCE(?, name),
             designation = COALESCE(?, designation),
             pay_amount = COALESCE(?, pay_amount),
             pf_no = COALESCE(?, pf_no),
             bill_unit = COALESCE(?, bill_unit),
             doa = COALESCE(?, doa),
             hq_station = COALESCE(?, hq_station)
         WHERE id = ?`,
        [name, designation, pay, pf_no, bill_unit, doa, hq, staffId]
      );
    }

    const staffRow = await get('SELECT name FROM staff WHERE id = ?', [staffId]);
    const staffName = staffRow?.name || employee_meta?.name || `Staff #${staffId}`;

    // Clear previous entries for this staff & month
    await run('DELETE FROM nda_entries WHERE staff_id = ? AND month_year = ?', [staffId, month_year]);

    // Save all current rows
    for (let i = 0; i < entries.length; i++) {
      const item = entries[i];
      let nightHours = item.night_hours !== null && item.night_hours !== undefined && item.night_hours !== ''
        ? parseFloat(item.night_hours)
        : null;
      if (nightHours !== null && !isNaN(nightHours)) {
        nightHours = Math.max(0, nightHours);
      } else {
        nightHours = null;
      }

      await run(
        `INSERT INTO nda_entries (staff_id, month_year, date_str, train_no, sched_dep, sched_arr, act_dep, act_arr, from_station, to_station, night_hours, row_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          staffId,
          month_year,
          item.date_str || '',
          item.train_no || '',
          item.sched_dep || '',
          item.sched_arr || '',
          item.act_dep || '',
          item.act_arr || '',
          item.from_station || '',
          item.to_station || '',
          nightHours,
          i + 1
        ]
      );

      const resolvedIso = resolveIsoDateFromDocRow(month_year, item.date_str, item.date_iso);

      // Save to actual_train_runs cache so TA and Diary pick it up
      if (item.train_no && resolvedIso) {
        if (item.from_station && item.act_dep && item.act_dep !== '---') {
          await run(
            `INSERT OR REPLACE INTO actual_train_runs (train_no, run_date, station_code, sched_arr, sched_dep, act_arr, act_dep, delay_arr_mins, delay_dep_mins, source)
             VALUES (?, ?, ?, '---', ?, '---', ?, 0, 0, 'NDA_SYNC')`,
            [item.train_no, resolvedIso, item.from_station, item.sched_dep || item.act_dep, item.act_dep]
          );
        }
        if (item.to_station && item.act_arr && item.act_arr !== '---') {
          await run(
            `INSERT OR REPLACE INTO actual_train_runs (train_no, run_date, station_code, sched_arr, sched_dep, act_arr, act_dep, delay_arr_mins, delay_dep_mins, source)
             VALUES (?, ?, ?, ?, '---', ?, '---', 0, 0, 'NDA_SYNC')`,
            [item.train_no, resolvedIso, item.to_station, item.sched_arr || item.act_arr, item.act_arr]
          );
        }
      }

      // Update matching ta_entries, ta_approvals, and diary_entries rows if present
      await run(
        `UPDATE ta_entries 
         SET dep_time = CASE WHEN ? != '' AND ? != '---' THEN ? ELSE dep_time END,
             arr_time = CASE WHEN ? != '' AND ? != '---' THEN ? ELSE arr_time END
         WHERE staff_id = ? AND month_year = ? AND (row_order = ? OR (date_str = ? AND train_no = ?))`,
        [
          item.act_dep || '', item.act_dep || '', item.act_dep || '',
          item.act_arr || '', item.act_arr || '', item.act_arr || '',
          staffId, month_year, i + 1, item.date_str || '', item.train_no || ''
        ]
      );
      await run(
        `UPDATE diary_entries 
         SET dep_time = CASE WHEN ? != '' AND ? != '---' THEN ? ELSE dep_time END,
             arr_time = CASE WHEN ? != '' AND ? != '---' THEN ? ELSE arr_time END
         WHERE staff_id = ? AND month_year = ? AND (row_order = ? OR (date_str = ? AND train_no = ?))`,
        [
          item.act_dep || '', item.act_dep || '', item.act_dep || '',
          item.act_arr || '', item.act_arr || '', item.act_arr || '',
          staffId, month_year, i + 1, item.date_str || '', item.train_no || ''
        ]
      ).catch(() => { });
    }

    await logAudit(
      currentUser?.role || 'Admin',
      'SAVE_NDA_JOURNAL',
      `Saved NDA Journal for ${staffName} (${month_year}): ${entries.length} row(s) saved and synchronized to TA Journal & Diary`,
      {
        staffId,
        staffName,
        month_year,
        savedCount: entries.length,
        errorCount: 0,
        savedEmployeesCount: 1,
        errorEmployeesCount: 0
      }
    );

    return ({ success: true, message: 'Night Duty Allowance journal saved and synced to TA & Diary successfully.' });
}

export async function resetNdaDocument(staffId: any, query: any, currentUser: any = "Admin") {
    staffId = parseInt(staffId, 10);
    const year = parseInt(query.year, 10) || new Date().getFullYear();
    const month = parseInt(query.month, 10) || (new Date().getMonth() + 1);
    const monthYearStr = `${year}-${String(month).padStart(2, '0')}`;

    const staffRow = await get('SELECT name FROM staff WHERE id = ?', [staffId]);
    const staffName = staffRow?.name || `Staff #${staffId}`;

    await run('DELETE FROM nda_entries WHERE staff_id = ? AND month_year = ?', [staffId, monthYearStr]);
    await logAudit(
      currentUser?.role || 'Admin',
      'RESET_NDA_JOURNAL',
      `Reset NDA Journal for ${staffName} (${monthYearStr}) to live synchronized roster, Muster & LR state`,
      { staffId, staffName, month_year: monthYearStr }
    );
    return ({ success: true, message: 'NDA Journal reset to master roster rotation.' });
}

export async function getDiaryDocument(staffId: any, query: any) {
    staffId = parseInt(staffId, 10);
    let year = parseInt(query.year, 10);
    let month = parseInt(query.month, 10);
    if (query.month && String(query.month).includes('-')) {
      const parts = String(query.month).split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    }
    if (!year) year = new Date().getFullYear();
    if (!month) month = new Date().getMonth() + 1;

    const startDate = query.start_date || null;
    const endDate = query.end_date || null;

    const diary = await generateStaffDiary({ get, all, run }, staffId, year, month, startDate, endDate);
    return (diary);
}

export async function saveDiaryDocument(staffId: any, data: any, currentUser: any = "Admin") {
    staffId = parseInt(staffId, 10);
    const { month_year, entries, employee_meta } = data;

    if (!month_year || !Array.isArray(entries)) {
      throw new ApiError(400, 'Invalid payload. month_year and entries array required.' );
    }

    // Update employee profile metadata if provided
    if (employee_meta) {
      const { name, designation, pay, pf_no, bill_unit, t_code_no } = employee_meta;
      await run(
        `UPDATE staff 
         SET name = COALESCE(?, name),
             designation = COALESCE(?, designation),
             pay_amount = COALESCE(?, pay_amount),
             pf_no = COALESCE(?, pf_no),
             bill_unit = COALESCE(?, bill_unit),
             t_code_no = COALESCE(?, t_code_no)
         WHERE id = ?`,
        [name, designation, pay, pf_no, bill_unit, t_code_no, staffId]
      );
    }

    const staffRow = await get('SELECT name FROM staff WHERE id = ?', [staffId]);
    const staffName = staffRow?.name || employee_meta?.name || `Staff #${staffId}`;

    // Clear previous entries for this staff & month
    await run('DELETE FROM diary_entries WHERE staff_id = ? AND month_year = ?', [staffId, month_year]);

    // Save all current rows
    for (let i = 0; i < entries.length; i++) {
      const item = entries[i];
      await run(
        `INSERT INTO diary_entries (staff_id, month_year, date_str, train_no, dep_time, arr_time, from_station, to_station, eft_from, eft_to, total_issued, no_of_cases, collected_rs, gst_cases, gst_amount, total_amount, remit_station, remit_mr_no, remit_date, remit_amount, row_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          staffId,
          month_year,
          item.date_str || '',
          item.train_no || '',
          item.dep_time || '',
          item.arr_time || '',
          item.from_station || '',
          item.to_station || '',
          item.eft_from || '',
          item.eft_to || '',
          item.total_issued !== null && item.total_issued !== undefined && item.total_issued !== '' ? parseInt(item.total_issued, 10) : null,
          item.no_of_cases !== null && item.no_of_cases !== undefined && item.no_of_cases !== '' ? parseInt(item.no_of_cases, 10) : null,
          item.collected_rs !== null && item.collected_rs !== undefined && item.collected_rs !== '' ? parseFloat(item.collected_rs) : null,
          item.gst_cases !== null && item.gst_cases !== undefined && item.gst_cases !== '' ? parseInt(item.gst_cases, 10) : null,
          item.gst_amount !== null && item.gst_amount !== undefined && item.gst_amount !== '' ? parseFloat(item.gst_amount) : null,
          item.total_amount !== null && item.total_amount !== undefined && item.total_amount !== '' ? parseFloat(item.total_amount) : null,
          item.remit_station || '',
          item.remit_mr_no || '',
          item.remit_date || '',
          item.remit_amount !== null && item.remit_amount !== undefined && item.remit_amount !== '' ? parseFloat(item.remit_amount) : null,
          i + 1
        ]
      );

      // Sync timings to ta_entries and nda_entries if present
      if ((item.dep_time && item.dep_time !== '---') || (item.arr_time && item.arr_time !== '---')) {
        await run(
          `UPDATE ta_entries 
           SET dep_time = CASE WHEN ? != '' AND ? != '---' THEN ? ELSE dep_time END,
               arr_time = CASE WHEN ? != '' AND ? != '---' THEN ? ELSE arr_time END
           WHERE staff_id = ? AND month_year = ? AND (row_order = ? OR (date_str = ? AND train_no = ?))`,
          [
            item.dep_time || '', item.dep_time || '', item.dep_time || '',
            item.arr_time || '', item.arr_time || '', item.arr_time || '',
            staffId, month_year, i + 1, item.date_str || '', item.train_no || ''
          ]
        ).catch(() => { });
        await run(
          `UPDATE nda_entries 
           SET act_dep = CASE WHEN ? != '' AND ? != '---' THEN ? ELSE act_dep END,
               act_arr = CASE WHEN ? != '' AND ? != '---' THEN ? ELSE act_arr END
           WHERE staff_id = ? AND month_year = ? AND (row_order = ? OR (date_str = ? AND train_no = ?))`,
          [
            item.dep_time || '', item.dep_time || '', item.dep_time || '',
            item.arr_time || '', item.arr_time || '', item.arr_time || '',
            staffId, month_year, i + 1, item.date_str || '', item.train_no || ''
          ]
        ).catch(() => { });
      }
    }

    await logAudit(
      currentUser?.role || 'Admin',
      'SAVE_DIARY',
      `Saved EFT Diary Statement for ${staffName} (${month_year}): ${entries.length} row(s) saved and synchronized to TA, NDA & Daily Earnings`,
      {
        staffId,
        staffName,
        month_year,
        savedCount: entries.length,
        errorCount: 0,
        savedEmployeesCount: 1,
        errorEmployeesCount: 0
      }
    );

    return ({ success: true, message: 'Diary entries saved and synchronized successfully.' });
}

export async function resetDiaryDocument(staffId: any, query: any, currentUser: any = "Admin") {
    staffId = parseInt(staffId, 10);
    const year = parseInt(query.year, 10) || new Date().getFullYear();
    const month = parseInt(query.month, 10) || (new Date().getMonth() + 1);
    const monthYearStr = `${year}-${String(month).padStart(2, '0')}`;

    const staffRow = await get('SELECT name FROM staff WHERE id = ?', [staffId]);
    const staffName = staffRow?.name || `Staff #${staffId}`;

    await run('DELETE FROM diary_entries WHERE staff_id = ? AND month_year = ?', [staffId, monthYearStr]);
    await logAudit(
      currentUser?.role || 'Admin',
      'RESET_DIARY',
      `Reset EFT Diary Statement for ${staffName} (${monthYearStr}) to live synchronized roster & Daily Earnings state`,
      { staffId, staffName, month_year: monthYearStr }
    );
    return ({ success: true, message: 'Diary reset to master roster rotation.' });
}

export async function getDailyBookingChart(query: any) {
    const { date, category_id } = query;
    const chart = await generateDailyBookingChart({ get, all, run }, date, category_id);
    return (chart);
}

export async function getDailyEarnings(query: any) {
    const { date, category_id } = query;
    const earningsSheet = await generateDailyEarnings({ get, all, run }, date, category_id);
    return (earningsSheet);
}

export async function getDailyEarningsRange(query: any) {
    const { start_date, end_date, category_id } = query;
    if (!start_date || !end_date) {
      throw new ApiError(400, 'start_date and end_date query parameters are required.' );
    }
    const rangeData = await generateRangeDailyEarnings({ get, all, run }, start_date, end_date, category_id);
    return (rangeData);
}

export async function saveDailyEarningsRange(data: any, currentUser: any = "Admin") {
    const { days } = data;
    if (!Array.isArray(days)) {
      throw new ApiError(400, 'days array is required.' );
    }

    let savedCount = 0;
    let errorCount = 0;
    const savedEmployeesSet = new Set();
    const errorEmployeesSet = new Set();
    const errors = [];
    const dateSet = new Set();

    for (const day of days) {
      if (!day.date || !Array.isArray(day.entries)) continue;
      dateSet.add(day.date);
      for (let i = 0; i < day.entries.length; i++) {
        const item = day.entries[i];
        if (!item.staff_id) continue;

        try {
          const twt_nc = parseInt(item.twt_nc, 10) || 0;
          const twt_fare = parseFloat(item.twt_fare) || 0;
          const twt_penalty = parseFloat(item.twt_penalty) || 0;

          const ir_nc = parseInt(item.ir_nc, 10) || 0;
          const ir_fare = parseFloat(item.ir_fare) || 0;
          const ir_penalty = parseFloat(item.ir_penalty) || 0;

          const ubl_nc = parseInt(item.ubl_nc, 10) || 0;
          const ubl_amt = parseFloat(item.ubl_amt) || 0;

          const gst = parseFloat(item.gst) || 0;

          const z652_nc = parseInt(item.z652_nc, 10) || 0;
          const z652_amt = parseFloat(item.z652_amt) || 0;

          const oc_nc = parseInt(item.oc_nc, 10) || 0;
          const oc_amt = parseFloat(item.oc_amt) || 0;

          await run(
            `INSERT OR REPLACE INTO daily_earnings_entries 
             (date, category_id, staff_id, staff_name, designation, depot_title, twt_nc, twt_fare, twt_penalty, ir_nc, ir_fare, ir_penalty, ubl_nc, ubl_amt, gst, z652_nc, z652_amt, oc_nc, oc_amt, duty, remarks, row_order, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              day.date,
              item.category_id || null,
              item.staff_id,
              item.staff_name || '',
              item.designation || 'TTI',
              item.depot_title || 'GNT ATY-1D2',
              twt_nc,
              twt_fare,
              twt_penalty,
              ir_nc,
              ir_fare,
              ir_penalty,
              ubl_nc,
              ubl_amt,
              gst,
              z652_nc,
              z652_amt,
              oc_nc,
              oc_amt,
              item.duty || '',
              item.remarks || '',
              i + 1
            ]
          );

          await syncDailyEarningsItemToDiary(
            item.staff_id, day.date,
            twt_nc, twt_fare, twt_penalty,
            ir_nc, ir_fare, ir_penalty,
            ubl_nc, ubl_amt, gst, z652_amt, oc_amt,
            item.duty || ''
          );

          savedCount++;
          savedEmployeesSet.add(item.staff_id);
        } catch (itemErr) {
          errorCount++;
          errorEmployeesSet.add(item.staff_id);
          errors.push({
            staff_id: item.staff_id,
            staff_name: item.staff_name || `Employee #${item.staff_id}`,
            date: day.date,
            error: itemErr.message
          });
        }
      }
    }

    const savedEmployeesCount = savedEmployeesSet.size;
    const errorEmployeesCount = errorEmployeesSet.size;
    const sortedDates = Array.from(dateSet).sort();
    const rangeLabel = sortedDates.length > 0 ? `${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}` : 'Range';

    await logAudit(
      currentUser?.role || 'Admin',
      'SAVE_DAILY_EARNINGS_RANGE',
      `Saved Multi-Day Daily Earnings (${rangeLabel}) one-by-one: ${savedEmployeesCount} employee(s) (${savedCount} record(s)) saved, ${errorEmployeesCount} employee(s) (${errorCount} record(s)) failed`,
      {
        rangeLabel,
        savedCount,
        errorCount,
        savedEmployeesCount,
        errorEmployeesCount
      }
    );

    const errorSummary = errors.length > 0
      ? ` | Errors: ${errors.map(e => `${e.staff_name} (${e.date}): ${e.error}`).join('; ')}`
      : '';
    return ({
      success: errorCount === 0,
      savedCount,
      errorCount,
      savedEmployeesCount,
      errorEmployeesCount,
      errors,
      message: `Daily Earnings Save Complete: ${savedEmployeesCount} employee(s) (${savedCount} record(s)) saved successfully, ${errorEmployeesCount} employee(s) (${errorCount} record(s)) had an error.${errorSummary}`
    });
}

export async function getStaffDailyEarnings(staffId: any, query: any) {
    staffId = parseInt(staffId, 10);
    const year = parseInt(query.year, 10) || new Date().getFullYear();
    const month = parseInt(query.month, 10) || (new Date().getMonth() + 1);

    const monthlyEarnings = await generateStaffMonthlyEarnings({ get, all, run }, staffId, year, month);
    return (monthlyEarnings);
}

export async function saveStaffDailyEarnings(staffId: any, data: any, currentUser: any = "Admin") {
    staffId = parseInt(staffId, 10);
    const { entries, year, month } = data;
    if (!Array.isArray(entries)) {
      throw new ApiError(400, 'Entries array is required.' );
    }

    const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
    if (!staff) {
      throw new ApiError(404, 'Staff member not found.' );
    }

    let savedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < entries.length; i++) {
      const item = entries[i];
      if (!item.date) continue;

      try {
        const twt_nc = parseInt(item.twt_nc, 10) || 0;
        const twt_fare = parseFloat(item.twt_fare) || 0;
        const twt_penalty = parseFloat(item.twt_penalty) || 0;

        const ir_nc = parseInt(item.ir_nc, 10) || 0;
        const ir_fare = parseFloat(item.ir_fare) || 0;
        const ir_penalty = parseFloat(item.ir_penalty) || 0;

        const ubl_nc = parseInt(item.ubl_nc, 10) || 0;
        const ubl_amt = parseFloat(item.ubl_amt) || 0;

        const gst = parseFloat(item.gst) || 0;

        const z652_nc = parseInt(item.z652_nc, 10) || 0;
        const z652_amt = parseFloat(item.z652_amt) || 0;

        const oc_nc = parseInt(item.oc_nc, 10) || 0;
        const oc_amt = parseFloat(item.oc_amt) || 0;

        await run(
          `INSERT OR REPLACE INTO daily_earnings_entries 
           (date, category_id, staff_id, staff_name, designation, depot_title, twt_nc, twt_fare, twt_penalty, ir_nc, ir_fare, ir_penalty, ubl_nc, ubl_amt, gst, z652_nc, z652_amt, oc_nc, oc_amt, duty, remarks, row_order, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            item.date,
            staff.category_id,
            staff.id,
            staff.name,
            staff.designation || 'TTI',
            item.depot_title || 'GNT ATY-1D2',
            twt_nc,
            twt_fare,
            twt_penalty,
            ir_nc,
            ir_fare,
            ir_penalty,
            ubl_nc,
            ubl_amt,
            gst,
            z652_nc,
            z652_amt,
            oc_nc,
            oc_amt,
            item.duty || '',
            item.remarks || '',
            i + 1
          ]
        );

        await syncDailyEarningsItemToDiary(
          staff.id, item.date,
          twt_nc, twt_fare, twt_penalty,
          ir_nc, ir_fare, ir_penalty,
          ubl_nc, ubl_amt, gst, z652_amt, oc_amt,
          item.duty || ''
        );

        savedCount++;
      } catch (itemErr) {
        errorCount++;
        errors.push({
          staff_id: staff.id,
          staff_name: staff.name,
          date: item.date,
          error: itemErr.message
        });
      }
    }

    const savedEmployeesCount = savedCount > 0 ? 1 : 0;
    const errorEmployeesCount = errorCount > 0 ? 1 : 0;
    const monthLabel = year && month ? `${year}-${String(month).padStart(2, '0')}` : 'Month';

    await logAudit(
      currentUser?.role || 'Admin',
      'SAVE_STAFF_MONTHLY_EARNINGS',
      `Saved Monthly Earnings for ${staff.name} (${monthLabel}): ${savedCount} day(s) saved, ${errorCount} day(s) failed`,
      {
        staffId: staff.id,
        staffName: staff.name,
        month_year: monthLabel,
        savedCount,
        errorCount,
        savedEmployeesCount,
        errorEmployeesCount
      }
    );

    const errorSummary = errors.length > 0
      ? ` | Errors: ${errors.map(e => `${e.date}: ${e.error}`).join('; ')}`
      : '';
    return ({
      success: errorCount === 0,
      savedCount,
      errorCount,
      savedEmployeesCount,
      errorEmployeesCount,
      errors,
      message: `Monthly Earnings for ${staff.name}: ${savedCount} day(s) saved successfully, ${errorCount} day(s) had an error.${errorSummary}`
    });
}

export async function resetStaffDailyEarnings(staffId: any, query: any, currentUser: any = "Admin") {
    staffId = parseInt(staffId, 10);
    const year = parseInt(query.year, 10) || new Date().getFullYear();
    const month = parseInt(query.month, 10) || (new Date().getMonth() + 1);
    const monthStr = String(month).padStart(2, '0');
    const startDateStr = `${year}-${monthStr}-01`;
    const endDateStr = `${year}-${monthStr}-31`;

    const staffRow = await get('SELECT name FROM staff WHERE id = ?', [staffId]);
    const staffName = staffRow?.name || `Staff #${staffId}`;

    await run(
      'DELETE FROM daily_earnings_entries WHERE staff_id = ? AND date >= ? AND date <= ?',
      [staffId, startDateStr, endDateStr]
    );

    await logAudit(
      currentUser?.role || 'Admin',
      'RESET_STAFF_MONTHLY_EARNINGS',
      `Reset Monthly Earnings for ${staffName} (${year}-${monthStr}) to live roster duties`,
      { staffId, staffName, month_year: `${year}-${monthStr}` }
    );

    return ({ success: true, message: 'Staff monthly earnings reset to roster duties.' });
}

export async function saveDailyEarnings(data: any, currentUser: any = "Admin") {
    const { date, depot_title, entries } = data;
    if (!date || !Array.isArray(entries)) {
      throw new ApiError(400, 'Date and entries array are required.' );
    }

    let savedCount = 0;
    let errorCount = 0;
    const savedEmployeesSet = new Set();
    const errorEmployeesSet = new Set();
    const errors = [];

    for (let i = 0; i < entries.length; i++) {
      const item = entries[i];
      if (!item.staff_id) continue;

      try {
        const twt_nc = parseInt(item.twt_nc, 10) || 0;
        const twt_fare = parseFloat(item.twt_fare) || 0;
        const twt_penalty = parseFloat(item.twt_penalty) || 0;

        const ir_nc = parseInt(item.ir_nc, 10) || 0;
        const ir_fare = parseFloat(item.ir_fare) || 0;
        const ir_penalty = parseFloat(item.ir_penalty) || 0;

        const ubl_nc = parseInt(item.ubl_nc, 10) || 0;
        const ubl_amt = parseFloat(item.ubl_amt) || 0;

        const gst = parseFloat(item.gst) || 0;

        const z652_nc = parseInt(item.z652_nc, 10) || 0;
        const z652_amt = parseFloat(item.z652_amt) || 0;

        const oc_nc = parseInt(item.oc_nc, 10) || 0;
        const oc_amt = parseFloat(item.oc_amt) || 0;

        await run(
          `INSERT OR REPLACE INTO daily_earnings_entries 
           (date, category_id, staff_id, staff_name, designation, depot_title, twt_nc, twt_fare, twt_penalty, ir_nc, ir_fare, ir_penalty, ubl_nc, ubl_amt, gst, z652_nc, z652_amt, oc_nc, oc_amt, duty, remarks, row_order, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            date,
            item.category_id || null,
            item.staff_id,
            item.staff_name || '',
            item.designation || 'TTI',
            depot_title || item.depot_title || 'GNT ATY-1D2',
            twt_nc,
            twt_fare,
            twt_penalty,
            ir_nc,
            ir_fare,
            ir_penalty,
            ubl_nc,
            ubl_amt,
            gst,
            z652_nc,
            z652_amt,
            oc_nc,
            oc_amt,
            item.duty || '',
            item.remarks || '',
            i + 1
          ]
        );

        await syncDailyEarningsItemToDiary(
          item.staff_id, date,
          twt_nc, twt_fare, twt_penalty,
          ir_nc, ir_fare, ir_penalty,
          ubl_nc, ubl_amt, gst, z652_amt, oc_amt,
          item.duty || ''
        );

        savedCount++;
        savedEmployeesSet.add(item.staff_id);
      } catch (itemErr) {
        errorCount++;
        errorEmployeesSet.add(item.staff_id);
        errors.push({
          staff_id: item.staff_id,
          staff_name: item.staff_name || `Employee #${item.staff_id}`,
          date,
          error: itemErr.message
        });
      }
    }

    const savedEmployeesCount = savedEmployeesSet.size;
    const errorEmployeesCount = errorEmployeesSet.size;

    await logAudit(
      currentUser?.role || 'Admin',
      'SAVE_DAILY_EARNINGS',
      `Saved Daily Earnings Sheet (${date}) one-by-one: ${savedEmployeesCount} employee(s) (${savedCount} record(s)) saved, ${errorEmployeesCount} employee(s) (${errorCount} record(s)) failed`,
      {
        date,
        savedCount,
        errorCount,
        savedEmployeesCount,
        errorEmployeesCount
      }
    );

    const errorSummary = errors.length > 0
      ? ` | Errors: ${errors.map(e => `${e.staff_name}: ${e.error}`).join('; ')}`
      : '';
    return ({
      success: errorCount === 0,
      savedCount,
      errorCount,
      savedEmployeesCount,
      errorEmployeesCount,
      errors,
      message: `Daily Earnings Sheet (${date}): ${savedEmployeesCount} employee(s) saved successfully, ${errorEmployeesCount} employee(s) had an error.${errorSummary}`
    });
}

export async function resetDailyEarnings(query: any, currentUser: any = "Admin") {
    const { date, category_id } = query;
    if (!date) throw new ApiError(400, 'Date is required' );

    if (category_id && category_id !== 'all') {
      await run('DELETE FROM daily_earnings_entries WHERE date = ? AND category_id = ?', [date, category_id]);
    } else {
      await run('DELETE FROM daily_earnings_entries WHERE date = ?', [date]);
    }

    await logAudit(
      currentUser?.role || 'Admin',
      'RESET_DAILY_EARNINGS',
      `Reset Daily Earnings Sheet for ${date} (Category: ${category_id || 'ALL'}) to live roster rotation`,
      { date, category_id: category_id || 'all' }
    );

    return ({ success: true, message: 'Daily Earnings Sheet reset to master roster rotation.' });
}
