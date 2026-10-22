import { run, get, all, withTransaction } from '../db';
import { resolveDutyCodeForLRStaff } from './helpers.service';
const { calculateAbsenceAndTa, generatePendingTaClaimsForMonth } = require('../ta_generator');

// Clears stale custom entries on that date in NDA & Diary (and TA when duty changes) so generators dynamically reflect the latest duty/leave/swap/LR assignment, and updates saved Daily Earnings duty/remarks.
export async function syncDocumentsAndEarningsForStaffDate(staffId: any, dateStr: any, options: any = {}) {
  if (!staffId || !dateStr) return;
  try {
    const dateParts = String(dateStr).split('-');
    if (dateParts.length !== 3) return;
    const monthYear = `${dateParts[0]}-${dateParts[1]}`;
    const altShort = `${parseInt(dateParts[2], 10)}/${parseInt(dateParts[1], 10)}/${dateParts[0].slice(-2)}`;
    const altPadded = `${dateParts[2]}/${dateParts[1]}/${dateParts[0].slice(-2)}`;
    const altFull = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

    const { dutyText, isLeaveOrRest, remarks, preserveCustomTa, dutyCode, isOffDuty } = options;
    const effectiveDutyText = dutyText !== undefined ? dutyText : dutyCode;

    // 1. Clear stale custom saved rows for this specific date in nda_entries and diary_entries so per-date merge regenerates them cleanly
    await run(
      `DELETE FROM nda_entries 
       WHERE staff_id = ? AND month_year = ? AND (date_str = ? OR date_str = ? OR date_str = ? OR date_str = ?)`,
      [staffId, monthYear, dateStr, altShort, altPadded, altFull]
    );

    await run(
      `DELETE FROM diary_entries 
       WHERE staff_id = ? AND month_year = ? AND (date_str = ? OR date_str = ? OR date_str = ? OR date_str = ?)`,
      [staffId, monthYear, dateStr, altShort, altPadded, altFull]
    );

    if (!preserveCustomTa && !isLeaveOrRest && !isOffDuty) {
      await run(
        `DELETE FROM ta_entries 
         WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ? OR date_str = ? OR date_str = ?)`,
        [staffId, dateStr, dateStr, altShort, altPadded, altFull]
      );
    }

    // 2. If a saved Daily Earnings entry exists for this staff & date, update its duty and remarks
    if (effectiveDutyText !== undefined && effectiveDutyText !== null) {
      await run(
        `UPDATE daily_earnings_entries 
         SET duty = ?, 
             remarks = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE remarks END,
             updated_at = CURRENT_TIMESTAMP
         WHERE staff_id = ? AND date = ?`,
        [String(effectiveDutyText), remarks || '', remarks || '', remarks || '', staffId, dateStr]
      );
    }
  } catch (err: any) {
    console.warn('Error in syncDocumentsAndEarningsForStaffDate:', err.message);
  }
}

// Helper to synchronize any duty change / deviation across TA, NDA, Diary, Daily Earnings, Muster, Overrides, and LR Sheet
export async function syncDutyChangeAcrossAllModules(db: any, staffId: any, date: any, details: any = {}) {
  const dbRun = db?.run || run;
  const dbGet = db?.get || get;

  const staff = await dbGet('SELECT * FROM staff WHERE id = ?', [staffId]);
  if (!staff) return;

  const { targetTrain, targetLink, isLeave, leaveCode, remarks, isRest, isAvailable } = details;

  // 1. Sync Muster Records
  if (isLeave) {
    const code = (leaveCode || 'LEAVE').toUpperCase() === 'SICK' ? 'SICK' : (leaveCode || 'CL').toUpperCase();
    await dbRun(
      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
       VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         code = excluded.code,
         remarks = excluded.remarks,
         updated_by = 'Admin',
         updated_at = CURRENT_TIMESTAMP`,
      [staffId, date, code, remarks || code]
    );
  } else if (isRest) {
    await dbRun(
      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
       VALUES (?, ?, 'R', ?, 'Admin', CURRENT_TIMESTAMP)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         code = 'R',
         remarks = excluded.remarks,
         updated_by = 'Admin',
         updated_at = CURRENT_TIMESTAMP`,
      [staffId, date, remarks || 'Assigned Rest Day']
    );
  } else {
    const remark = targetTrain ? `Train ${targetTrain}` : (targetLink ? `Link #${targetLink}` : (isAvailable ? 'Available at HQ' : (remarks || 'Present')));
    await dbRun(
      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
       VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         code = 'P',
         remarks = excluded.remarks,
         updated_by = 'Admin',
         updated_at = CURRENT_TIMESTAMP`,
      [staffId, date, remark]
    );
  }

  // 2. Sync LR Sheet Records if staff is LR (category_id = 4)
  if (staff.category_id === 4) {
    if (isLeave) {
      const lrCode = (leaveCode || 'L').toUpperCase() === 'SICK' ? 'S' : (leaveCode || 'L').toUpperCase();
      await syncLRSheetRecord(staffId, date, lrCode, remarks || lrCode, 'Universal Sync');
    } else if (isRest) {
      await syncLRSheetRecord(staffId, date, 'R', remarks || 'Rest Day', 'Universal Sync');
    } else if (isAvailable || (!targetTrain && !targetLink)) {
      const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const dObj = new Date(date + 'T12:00:00');
      const dayOfWeek = dayNames[dObj.getDay()];
      const resolved = await resolveDutyCodeForLRStaff(staffId, date, dayOfWeek, staff.rest_day);
      if (resolved && resolved.code) {
        await syncLRSheetRecord(staffId, date, resolved.code, remarks || resolved.remarks || 'Available at HQ', 'Universal Sync');
      } else {
        await syncLRSheetRecord(staffId, date, 'AVL', remarks || 'Available at HQ', 'Universal Sync');
      }
    } else {
      const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const dObj = new Date(date + 'T12:00:00');
      const dayOfWeek = dayNames[dObj.getDay()];
      const resolved = await resolveDutyCodeForLRStaff(staffId, date, dayOfWeek, staff.rest_day);
      const train = (resolved && resolved.code && !['R', 'AVL', 'P'].includes(resolved.code))
        ? resolved.code
        : (targetTrain || (targetLink ? `Link ${targetLink}` : 'AVL'));
      await syncLRSheetRecord(staffId, date, train, remarks || (resolved && resolved.remarks) || 'UTILISED', 'Universal Sync');
    }
  }

  // 3. Sync TA Approvals & TA Entries
  const dateParts = date.split('-');
  const altDateStr = dateParts.length === 3 ? `${parseInt(dateParts[2], 10)}/${parseInt(dateParts[1], 10)}/${dateParts[0].slice(-2)}` : date;
  if (isLeave || isRest) {
    const disallowRemark = `Disallowed: On Leave/Absent as per Muster/Daily Duty (${leaveCode || (isRest ? 'REST' : 'LEAVE')})`;
    await dbRun(
      `UPDATE ta_approvals 
       SET status = 'REJECTED', 
           claim_amount = 0, 
           ta_percentage = NULL, 
           remarks = ?
       WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)`,
      [disallowRemark, staffId, date, date, altDateStr]
    );
    await dbRun(
      `UPDATE ta_entries 
       SET ta_b1 = '', 
           days_claiming_ta = NULL, 
           remarks = ?
       WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)`,
      [disallowRemark, staffId, date, date, altDateStr]
    );
  } else {
    await dbRun(
      `DELETE FROM ta_approvals WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?) AND (status = 'PENDING' OR remarks LIKE 'Disallowed%')`,
      [staffId, date, date, altDateStr]
    );
    const y = parseInt(dateParts[0], 10);
    const m = parseInt(dateParts[1], 10);
    try {
      await generatePendingTaClaimsForMonth({ run, get, all }, y, m, staffId);
    } catch (err: any) {
      console.warn('Error regenerating TA claims in sync:', err.message);
    }
  }

  // 4. Sync NDA, Diary, TA custom rows & Daily Earnings Sheet
  const effectiveDutyText = isLeave
    ? (leaveCode || 'LEAVE')
    : (isRest ? 'REST' : (isAvailable ? 'AVL' : (targetTrain || (targetLink ? `L-${targetLink}` : null))));
  await syncDocumentsAndEarningsForStaffDate(staffId, date, {
    dutyText: effectiveDutyText,
    isLeaveOrRest: Boolean(isLeave || isRest),
    remarks
  });
}

// Helper: sync an approved claim into ta_entries so it appears in the employee's TA document
export async function syncClaimToTaEntries(claimId: any) {
  const claim = await get('SELECT * FROM ta_approvals WHERE id = ?', [claimId]);
  if (!claim || claim.status !== 'APPROVED') return;

  const existing = await get(
    `SELECT id FROM ta_entries 
     WHERE staff_id = ? AND duty_date = ? AND train_no = ? AND from_station = ? AND to_station = ?`,
    [claim.staff_id, claim.duty_date, claim.train_no, claim.from_station, claim.to_station]
  ) || await get(
    `SELECT id FROM ta_entries 
     WHERE staff_id = ? AND month_year = ? AND date_str = ? AND train_no = ? AND from_station = ? AND to_station = ?`,
    [claim.staff_id, claim.month_year, claim.date_str, claim.train_no, claim.from_station, claim.to_station]
  );

  if (existing) {
    await run(
      `UPDATE ta_entries SET
        dep_time = ?, arr_time = ?, ta_b1 = ?, days_claiming_ta = ?, object_of_journey = ?, remarks = ?, row_order = ?, duty_date = ?
       WHERE id = ?`,
      [
        claim.dep_time, claim.arr_time, claim.ta_percentage !== null && claim.ta_percentage !== undefined ? String(claim.ta_percentage) : '',
        claim.ta_percentage, claim.object_of_journey, claim.remarks || '', claim.row_order, claim.duty_date, existing.id
      ]
    );
  } else {
    await run(
      `INSERT INTO ta_entries (
        staff_id, month_year, duty_date, date_str, train_no, from_station, to_station,
        dep_time, arr_time, ta_a1, ta_a, ta_b1, days_claiming_ta, object_of_journey, remarks, row_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, ?, ?)`,
      [
        claim.staff_id, claim.month_year, claim.duty_date, claim.date_str, claim.train_no, claim.from_station, claim.to_station,
        claim.dep_time, claim.arr_time, claim.ta_percentage !== null && claim.ta_percentage !== undefined ? String(claim.ta_percentage) : '',
        claim.ta_percentage, claim.object_of_journey, claim.remarks || '', claim.row_order
      ]
    );
  }
}

// Helper: remove claim from ta_entries if rejected or reverted
export async function removeClaimFromTaEntries(claimId: any) {
  const claim = await get('SELECT * FROM ta_approvals WHERE id = ?', [claimId]);
  if (!claim) return;
  await run(
    `DELETE FROM ta_entries 
     WHERE staff_id = ? AND duty_date = ? AND train_no = ? AND from_station = ? AND to_station = ?`,
    [claim.staff_id, claim.duty_date, claim.train_no, claim.from_station, claim.to_station]
  );
  await run(
    `DELETE FROM ta_entries 
     WHERE staff_id = ? AND month_year = ? AND date_str = ? AND train_no = ? AND from_station = ? AND to_station = ?`,
    [claim.staff_id, claim.month_year, claim.date_str, claim.train_no, claim.from_station, claim.to_station]
  );
}

export async function restoreMusterTaApprovalsAndEntries(staffId: any, dateStr: string, altDateStr: string) {
  const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
  const daRate = (staff && staff.pay_amount >= 53100) ? 800 : ((staff && staff.pay_amount >= 35400) ? 500 : 800);

  const disallowedClaims: any[] = await all(
    `SELECT * FROM ta_approvals 
     WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?) 
       AND (remarks LIKE 'Disallowed: On Leave/Absent as per Muster Chart%' OR remarks LIKE 'Disallowed: On Leave/Absent as per LR Sheet%' OR status = 'REJECTED')`,
    [staffId, dateStr, dateStr, altDateStr]
  );

  for (const c of disallowedClaims) {
    const calc = calculateAbsenceAndTa(c.dep_time, c.arr_time, c.from_station, c.to_station, c.train_no);
    const taPct = calc.ta_percentage;
    const absenceHours = calc.absence_hours;
    const claimAmt = taPct !== null && taPct !== undefined ? Math.round(taPct * daRate) : 0;
    const restoredStatus = 'APPROVED';

    await run(
      `UPDATE ta_approvals 
       SET status = ?, 
           ta_percentage = ?, 
           absence_hours = ?, 
           claim_amount = ?, 
           remarks = '' 
       WHERE id = ?`,
      [restoredStatus, taPct, absenceHours, claimAmt, c.id]
    );

    await run(
      `UPDATE ta_entries 
       SET ta_b1 = ?, 
           days_claiming_ta = ?, 
           remarks = '' 
       WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?) AND train_no = ?`,
      [taPct !== null && taPct !== undefined ? String(taPct) : '', taPct, staffId, dateStr, dateStr, altDateStr, c.train_no]
    );
  }
}

/**
 * Synchronize Muster Record status across Overrides, TA Approvals, LR Sheet, and TA Entries
 */
export async function syncMusterToSchedulesAndApprovals(staffId: any, dateStr: string, cleanCode: any, remarks: string = '') {
  return await withTransaction(async () => {
    const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
    const isLeave = ['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'OD', 'NH'].includes(cleanCode);
    const isSick = cleanCode === 'SICK';
    const isCr = cleanCode === 'CR';
    const isRest = cleanCode === 'R';
    const isAbsent = cleanCode === 'O';
    const isBlank = cleanCode === '' || cleanCode === null || cleanCode === undefined;

    const dateParts = dateStr.split('-');
    const altDateStr = dateParts.length === 3 ? `${parseInt(dateParts[2], 10)}/${parseInt(dateParts[1], 10)}/${dateParts[0].slice(-2)}` : dateStr;

    if (isBlank) {
      const status = 'MARK_LATER';
      const reason = remarks ? `Muster Blank (${remarks})` : 'Mark Reason Later (Muster Blank)';
      const disallowRemark = `Disallowed: Deleted from duty slot (Reason to be marked later)`;

      await run(
        `INSERT INTO overrides (staff_id, date, overridden_link_number, status, reason, leave_type)
         VALUES (?, ?, NULL, ?, ?, NULL)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           overridden_link_number = NULL,
           status = excluded.status,
           reason = excluded.reason,
           leave_type = NULL`,
        [staffId, dateStr, status, reason]
      );

      await run(
        `UPDATE ta_approvals 
         SET status = 'REJECTED', 
             claim_amount = 0, 
             ta_percentage = NULL, 
             remarks = ?
         WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)`,
        [disallowRemark, staffId, dateStr, dateStr, altDateStr]
      );

      await run(
        `UPDATE ta_entries 
         SET ta_b1 = '', 
             days_claiming_ta = NULL, 
             remarks = ?
         WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)`,
        [disallowRemark, staffId, dateStr, dateStr, altDateStr]
      );

      await syncDocumentsAndEarningsForStaffDate(staffId, dateStr, { isOffDuty: true, dutyCode: 'BLANK', remarks: reason });

      if (staff && staff.category_id === 4) {
        await syncLRSheetRecord(staffId, dateStr, '', remarks);
      }
      return;
    }

    if (isLeave || isSick || isCr || isRest || isAbsent) {
      const status = isLeave ? 'LEAVE' : (isSick ? 'SICK' : (isCr ? 'CR' : (isRest ? 'REST' : 'ABSENT')));
      const reason = `Muster: ${cleanCode}${remarks ? ` (${remarks})` : ''}`;
      const leaveType = isLeave ? cleanCode : null;
      const disallowRemark = `Disallowed: On Leave/Absent as per Muster Chart (${cleanCode})`;

      await run(
        `INSERT INTO overrides (staff_id, date, overridden_link_number, status, reason, leave_type)
         VALUES (?, ?, NULL, ?, ?, ?)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           overridden_link_number = NULL,
           status = excluded.status,
           reason = excluded.reason,
           leave_type = excluded.leave_type`,
        [staffId, dateStr, status, reason, leaveType]
      );

      await run(
        `UPDATE ta_approvals 
         SET status = 'REJECTED', 
             claim_amount = 0, 
             ta_percentage = NULL, 
             remarks = ?
         WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)`,
        [disallowRemark, staffId, dateStr, dateStr, altDateStr]
      );

      await run(
        `UPDATE ta_entries 
         SET ta_b1 = '', 
             days_claiming_ta = NULL, 
             remarks = ?
         WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)`,
        [disallowRemark, staffId, dateStr, dateStr, altDateStr]
      );

      await syncDocumentsAndEarningsForStaffDate(staffId, dateStr, { isOffDuty: true, dutyCode: cleanCode, remarks: reason });

      if (staff && staff.category_id === 4) {
        const lrCode = cleanCode === 'SICK' ? 'S' : cleanCode;
        await syncLRSheetRecord(staffId, dateStr, lrCode, reason, 'Muster Roll Sync');
      }
    } else if (cleanCode === 'P' || cleanCode === 'E') {
      await run(
        `DELETE FROM overrides 
         WHERE staff_id = ? AND date = ? AND (reason LIKE 'Muster:%' OR reason LIKE 'Muster Chart:%' OR reason LIKE 'Muster Blank%')`,
        [staffId, dateStr]
      );

      await restoreMusterTaApprovalsAndEntries(staffId, dateStr, altDateStr);

      let resolvedDutyCode = '';
      if (staff && staff.category_id === 4) {
        const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        const dObj = new Date(dateStr + 'T12:00:00');
        const dayOfWeek = dayNames[dObj.getDay()];
        const resolved = await resolveDutyCodeForLRStaff(staffId, dateStr, dayOfWeek, staff.rest_day);
        if (resolved && resolved.code) {
          resolvedDutyCode = resolved.code;
          await syncLRSheetRecord(staffId, dateStr, resolved.code, resolved.remarks || 'Muster: Present', 'Muster Roll Sync');
        } else {
          resolvedDutyCode = 'AVL';
          await syncLRSheetRecord(staffId, dateStr, 'AVL', 'Present at HQ', 'Muster Roll Sync');
        }
      }

      await syncDocumentsAndEarningsForStaffDate(staffId, dateStr, { isOffDuty: false, dutyCode: resolvedDutyCode, remarks: remarks || 'Muster: Present' });
    }
  });
}

export async function revertMusterFromSchedulesAndApprovals(staffId: any, dateStr: string) {
  return await withTransaction(async () => {
    const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
    const dateParts = dateStr.split('-');
    const altDateStr = dateParts.length === 3 ? `${parseInt(dateParts[2], 10)}/${parseInt(dateParts[1], 10)}/${dateParts[0].slice(-2)}` : dateStr;

    await run(
      `DELETE FROM overrides 
       WHERE staff_id = ? AND date = ? AND (reason LIKE 'Muster:%' OR reason LIKE 'Muster Chart:%' OR reason LIKE 'Muster Blank%')`,
      [staffId, dateStr]
    );
    await restoreMusterTaApprovalsAndEntries(staffId, dateStr, altDateStr);

    let resolvedCode = '';
    if (staff && staff.category_id === 4) {
      const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const dObj = new Date(dateStr + 'T12:00:00');
      const dayOfWeek = dayNames[dObj.getDay()];
      const resolved = await resolveDutyCodeForLRStaff(staffId, dateStr, dayOfWeek, staff.rest_day);
      if (resolved && resolved.code) {
        resolvedCode = resolved.code;
        await syncLRSheetRecord(staffId, dateStr, resolved.code, resolved.remarks || 'Baseline', 'Muster Roll Sync');
      } else {
        await run('DELETE FROM lr_sheet_records WHERE staff_id = ? AND date = ?', [staffId, dateStr]);
      }
    }

    await syncDocumentsAndEarningsForStaffDate(staffId, dateStr, { isOffDuty: false, dutyCode: resolvedCode, remarks: '' });
  });
}

export async function syncLRSheetRecord(staffId: any, dateStr: string, dutyCode: any, remarks: string = '', updatedBy: string = 'Daily Duty Management') {
  if (!staffId || !dateStr) return;
  try {
    const staff = await get('SELECT id, category_id FROM staff WHERE id = ?', [staffId]);
    if (!staff || staff.category_id !== 4) return;

    if (!dutyCode || String(dutyCode).trim() === '') {
      await run('DELETE FROM lr_sheet_records WHERE staff_id = ? AND date = ?', [staffId, dateStr]);
      return;
    }

    const clean = String(dutyCode).trim();
    await run(`
      INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(staff_id, date) DO UPDATE SET
        duty_code = excluded.duty_code,
        remarks = excluded.remarks,
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `, [staffId, dateStr, clean, remarks || null, updatedBy]);
  } catch (err) {
    console.error(`Error syncing LR sheet record for staff ${staffId} on ${dateStr}:`, err);
  }
}

export async function syncLRSheetFromDailyDuty(targetYear: number = 2026, targetMonth: number = 9) {
  try {
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const startDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const endDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    const cat4Staff: any[] = await all('SELECT * FROM staff WHERE category_id = 4 ORDER BY row_position ASC');
    const monthOverrides: any[] = await all(`
      SELECT o.*, s1.name as staff_name, s1.category_id as staff_cat
      FROM overrides o
      JOIN staff s1 ON o.staff_id = s1.id
      WHERE o.date >= ? AND o.date <= ?
    `, [startDateStr, endDateStr]);
    const linksList: any[] = await all(`
      SELECT * FROM links 
      WHERE (status = 'published' OR status IS NULL OR status = '') 
        AND (status != 'draft')
        AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = 'published' OR status IS NULL))
    `);
    const nonDailyList: any[] = await all('SELECT * FROM non_daily_trains');
    const dutyRegisterEntries: any[] = await all(`
      SELECT dre.*, drs.staff_id
      FROM duty_register_entry dre
      JOIN duty_register_staff drs ON dre.id = drs.entry_id
      WHERE dre.date >= ? AND dre.date <= ?
    `, [startDateStr, endDateStr]);
    const musterList: any[] = await all(`
      SELECT mr.*
      FROM muster_records mr
      JOIN staff s ON mr.staff_id = s.id
      WHERE s.category_id = 4 AND mr.date >= ? AND mr.date <= ?
    `, [startDateStr, endDateStr]);
    const earningsList: any[] = await all(`
      SELECT * FROM daily_earnings_entries
      WHERE date >= ? AND date <= ?
    `, [startDateStr, endDateStr]);

    const dataPool = {
      overrides: monthOverrides,
      links: linksList,
      nonDaily: nonDailyList,
      dutyRegister: dutyRegisterEntries,
      muster: musterList,
      dailyEarnings: earningsList
    };

    let syncedCount = 0;

    for (const staff of cat4Staff) {
      if (staff.id === 115) continue; // Skip K NAGA NAIK (relieved)

      for (let d = 1; d <= daysInMonth; d++) {
        const dObj = new Date(targetYear, targetMonth - 1, d);
        const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOfWeek = dayNames[dObj.getDay()];
        const hasDirectOv = monthOverrides.some(o => o.staff_id === staff.id && o.date === dateStr);
        const hasSubOv = monthOverrides.some(o => o.substitute_staff_id === staff.id && o.date === dateStr);
        const hasDutyReg = dutyRegisterEntries.some(r => r.staff_id === staff.id && r.date === dateStr);
        const hasEarn = earningsList.some(e => e.staff_id === staff.id && e.date === dateStr);
        const hasMuster = musterList.some(m => m.staff_id === staff.id && m.date === dateStr && ['R', 'CR', 'SICK', 'S', 'CL', 'LAP', 'LHAP', 'CAP', 'L'].includes(m.code.toUpperCase()));

        const dMinus1 = new Date(targetYear, targetMonth - 1, d);
        dMinus1.setDate(dMinus1.getDate() - 1);
        const prev1Str = `${dMinus1.getFullYear()}-${String(dMinus1.getMonth() + 1).padStart(2, '0')}-${String(dMinus1.getDate()).padStart(2, '0')}`;
        const dMinus2 = new Date(targetYear, targetMonth - 1, d);
        dMinus2.setDate(dMinus2.getDate() - 2);
        const prev2Str = `${dMinus2.getFullYear()}-${String(dMinus2.getMonth() + 1).padStart(2, '0')}-${String(dMinus2.getDate()).padStart(2, '0')}`;

        const hasPrevOv = monthOverrides.some(o => (o.staff_id === staff.id || (o.substitute_staff_id === staff.id && o.status !== 'LEAVE' && o.status !== 'SICK')) && (o.date === prev1Str || o.date === prev2Str) && o.status !== 'REST' && o.status !== 'SICK' && o.status !== 'LEAVE' && o.status !== 'CR');

        if (hasDirectOv || hasSubOv || hasDutyReg || hasEarn || hasMuster || hasPrevOv) {
          const resolved = await resolveDutyCodeForLRStaff(staff.id, dateStr, dayOfWeek, staff.rest_day, dataPool);
          if (resolved && resolved.code) {
            const existing = await get('SELECT * FROM lr_sheet_records WHERE staff_id = ? AND date = ?', [staff.id, dateStr]);
            const isNonDailyPlaceholder = existing && String(existing.dutyCode || existing.code || '').toUpperCase().startsWith('NON DAILY');
            const isAdminSaved = existing && existing.updated_by === 'Admin' && !isNonDailyPlaceholder;
            if (!isAdminSaved && (!existing || isNonDailyPlaceholder || existing.updated_by !== 'Admin' || hasDirectOv || hasSubOv || hasPrevOv)) {
              await syncLRSheetRecord(staff.id, dateStr, resolved.code, resolved.remarks, 'Daily Duty Management');
              syncedCount++;
            }
          }
        }
      }
    }

    const monthDate = new Date(targetYear, targetMonth - 1, 1);
    const monthName = monthDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    console.log(`[LR Sync] Checked Daily Duty Sheet up to date. Synchronized ${syncedCount} duties for ${monthName}.`);
    return { success: true, count: syncedCount, monthName };
  } catch (err: any) {
    console.error('Error in syncLRSheetFromDailyDuty:', err);
    return { success: false, error: err.message };
  }
}

export const backfillLRSheetFromOverrides = syncLRSheetFromDailyDuty;

export async function syncLRSheetCellChange(staffId: any, dateStr: any, dutyCode: any, remarks: any = '', options: any = {}) {
  if (!staffId || !dateStr) return;
  return await withTransaction(async () => {
    const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
    if (!staff) return;

    const dateParts = dateStr.split('-');
    const altDateStr = dateParts.length === 3 ? `${parseInt(dateParts[2], 10)}/${parseInt(dateParts[1], 10)}/${dateParts[0].slice(-2)}` : dateStr;

    if (!dutyCode || dutyCode.trim() === '') {
      await run('DELETE FROM lr_sheet_records WHERE staff_id = ? AND date = ?', [staffId, dateStr]);
      await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [staffId, dateStr]);
      await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [staffId, dateStr]);
      await restoreMusterTaApprovalsAndEntries(staffId, dateStr, altDateStr);
      await syncDocumentsAndEarningsForStaffDate(staffId, dateStr, { isOffDuty: false, dutyCode: '', remarks: '' });
      return;
    }

    const clean = dutyCode.trim();
    const upper = clean.toUpperCase();

    // 1. Upsert LR Sheet Record
    await run(`
      INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks, updated_by, updated_at)
      VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
      ON CONFLICT(staff_id, date) DO UPDATE SET
        duty_code = excluded.duty_code,
        remarks = excluded.remarks,
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `, [staffId, dateStr, clean, remarks || null]);

    // 2. Classify duty code
    const isSick = upper === 'S' || upper === 'SICK';
    const isLeave = ['CL', 'LAP', 'LHAP', 'CCL', 'SCL', 'OD', 'NH', 'L', 'CAP'].includes(upper);
    const isRest = upper === 'R' || upper === 'REST';
    const isCr = upper === 'CR';
    const isAbsent = upper === 'O' || upper === 'ABSENT';
    const isAvailable = ['AVL', 'SPARE', 'REST_HQ', 'STANDBY', 'AVAILABLE'].includes(upper);

    if (isSick || isLeave || isRest || isCr || isAbsent) {
      const musterCode = isSick ? 'SICK' : (isLeave ? (upper === 'L' || upper === 'CAP' ? 'LAP' : upper) : (isRest ? 'R' : (isCr ? 'CR' : 'O')));
      const status = isLeave ? 'LEAVE' : (isSick ? 'SICK' : (isCr ? 'CR' : (isRest ? 'REST' : 'ABSENT')));
      const reason = `LR Sheet: ${clean}${remarks ? ` (${remarks})` : ''}`;
      const leaveType = isLeave ? musterCode : null;

      await run(
        `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id, leave_type)
         VALUES (?, ?, NULL, NULL, ?, ?, 4, ?)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           overridden_link_number = NULL,
           status = excluded.status,
           reason = excluded.reason,
           target_category_id = 4,
           leave_type = excluded.leave_type`,
        [staffId, dateStr, status, reason, leaveType]
      );

      await run(
        `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
         VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           code = excluded.code,
           remarks = excluded.remarks,
           updated_by = excluded.updated_by,
           updated_at = CURRENT_TIMESTAMP`,
        [staffId, dateStr, musterCode, reason]
      );

      const disallowRemark = `Disallowed: On Leave/Absent as per LR Sheet (${clean})`;
      await run(
        `UPDATE ta_approvals 
         SET status = 'REJECTED', 
             claim_amount = 0, 
             ta_percentage = NULL, 
             remarks = ?
         WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)`,
        [disallowRemark, staffId, dateStr, dateStr, altDateStr]
      );
      await run(
        `UPDATE ta_entries 
         SET ta_b1 = '', 
             days_claiming_ta = NULL, 
             remarks = ?
         WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)`,
        [disallowRemark, staffId, dateStr, dateStr, altDateStr]
      );
      await syncDocumentsAndEarningsForStaffDate(staffId, dateStr, { isOffDuty: true, dutyCode: clean, remarks: reason });
    } else if (isAvailable) {
      const reason = `LR Standby at HQ: ${clean}${remarks ? ` (${remarks})` : ''}`;
      await run(
        `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id)
         VALUES (?, ?, NULL, NULL, 'AVAILABLE_FOR_BOOKING', ?, 4)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           overridden_link_number = NULL,
           status = 'AVAILABLE_FOR_BOOKING',
           reason = excluded.reason,
           target_category_id = 4`,
        [staffId, dateStr, reason]
      );
      await run(
        `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
         VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           code = 'P',
           remarks = excluded.remarks,
           updated_by = excluded.updated_by,
           updated_at = CURRENT_TIMESTAMP`,
        [staffId, dateStr, reason]
      );
      await restoreMusterTaApprovalsAndEntries(staffId, dateStr, altDateStr);
      await syncDocumentsAndEarningsForStaffDate(staffId, dateStr, { isOffDuty: true, dutyCode: clean, remarks: reason });
    } else {
      // Train duty or Link duty
      const isCorExplicit = /COR|CONDUCTOR/i.test(clean) || (options.target_category_id === 1);
      const linkMatch = clean.match(/^(?:(?:COR|SL|CONDUCTOR|SLEEPER)\s*)?(?:LINK|L)[\s#-]*(\d+)/i) || (options.link_number ? [null, String(options.link_number)] : null);

      if (linkMatch) {
        const linkNum = options.link_number ? parseInt(options.link_number, 10) : parseInt(linkMatch[1], 10);
        let targetCatId = options.target_category_id ? parseInt(options.target_category_id, 10) : (isCorExplicit ? 1 : null);
        if (!targetCatId) {
          if (linkNum > 21) {
            targetCatId = 2; // Category 2 Sleeper
          } else {
            const corCheck = await get('SELECT id FROM links WHERE category_id = 1 AND link_number = ?', [linkNum]);
            targetCatId = corCheck ? 1 : 2;
          }
        }

        const linkDef = await get('SELECT train_numbers, from_station, to_station, coaches, set_type FROM links WHERE category_id = ? AND link_number = ?', [targetCatId, linkNum]);
        const catLabel = targetCatId === 1 ? 'COR' : 'SL';
        const linkTrain = linkDef?.train_numbers ? ` (${linkDef.train_numbers})` : '';
        const reason = remarks ? `Assigned to ${catLabel} Link #${linkNum}${linkTrain} • ${remarks}` : `Assigned to ${catLabel} Link #${linkNum}${linkTrain}`;

        await run(
          `INSERT INTO overrides (
            staff_id, date, overridden_link_number, status, target_category_id,
            reason, original_link_number, extra_train_no, is_extra,
            shifted_from_link, shifted_from_train, shifted_place,
            advance_train_no, is_advance_duty
          ) VALUES (?, ?, ?, 'CHANGED_LINK', ?, ?, NULL, NULL, 0, NULL, NULL, 'LR_SHEET', NULL, 0)
          ON CONFLICT(staff_id, date) DO UPDATE SET
            overridden_link_number = excluded.overridden_link_number,
            status = 'CHANGED_LINK',
            target_category_id = excluded.target_category_id,
            reason = excluded.reason,
            extra_train_no = NULL,
            is_extra = 0,
            shifted_place = 'LR_SHEET'`,
          [staffId, dateStr, linkNum, targetCatId, reason]
        );

        await run(
          `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
           VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             code = 'P',
             remarks = excluded.remarks,
             updated_by = excluded.updated_by,
             updated_at = CURRENT_TIMESTAMP`,
          [staffId, dateStr, reason]
        );

        await run(
          `DELETE FROM ta_approvals WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?) AND (status = 'PENDING' OR remarks LIKE 'Disallowed%')`,
          [staffId, dateStr, dateStr, altDateStr]
        );
        const y = parseInt(dateParts[0], 10);
        const m = parseInt(dateParts[1], 10);
        try {
          await generatePendingTaClaimsForMonth({ run, get, all }, y, m, staffId);
        } catch (err: any) {
          console.warn('Error regenerating TA claims in LR sync:', err.message);
        }
        await syncDocumentsAndEarningsForStaffDate(staffId, dateStr, { isOffDuty: false, dutyCode: clean, remarks: reason, target_category_id: targetCatId, link_number: linkNum });
      } else {
        const reason = `LR Assigned Train ${clean}${remarks ? ` (${remarks})` : ''}`;
        await run(
          `INSERT INTO overrides (
            staff_id, date, overridden_link_number, status, target_category_id,
            reason, original_link_number, extra_train_no, is_extra,
            shifted_from_link, shifted_from_train, shifted_place,
            advance_train_no, is_advance_duty
          ) VALUES (?, ?, NULL, 'EXTRA_CREW', 4, ?, NULL, ?, 1, NULL, NULL, 'LR_SHEET', NULL, 0)
          ON CONFLICT(staff_id, date) DO UPDATE SET
            overridden_link_number = NULL,
            status = 'EXTRA_CREW',
            target_category_id = 4,
            reason = excluded.reason,
            extra_train_no = excluded.extra_train_no,
            is_extra = 1,
            shifted_place = 'LR_SHEET'`,
          [staffId, dateStr, reason, clean]
        );
        await run(
          `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
           VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             code = 'P',
             remarks = excluded.remarks,
             updated_by = excluded.updated_by,
             updated_at = CURRENT_TIMESTAMP`,
          [staffId, dateStr, reason]
        );

        await run(
          `DELETE FROM ta_approvals WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?) AND (status = 'PENDING' OR remarks LIKE 'Disallowed%')`,
          [staffId, dateStr, dateStr, altDateStr]
        );
        const y = parseInt(dateParts[0], 10);
        const m = parseInt(dateParts[1], 10);
        try {
          await generatePendingTaClaimsForMonth({ run, get, all }, y, m, staffId);
        } catch (err: any) {
          console.warn('Error regenerating TA claims in LR sync:', err.message);
        }
        await syncDocumentsAndEarningsForStaffDate(staffId, dateStr, { isOffDuty: false, dutyCode: clean, remarks: reason });
      }
    }
  });
}
