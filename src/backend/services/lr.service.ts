import { get, all, run, withTransaction } from '../db';
import { ApiError } from '../utils/api_error';
import {
  NON_DAILY_MULTI_DAY_SERVICES,
  resolveDutyCodeForLRStaff,
  getStaffLastDutyAndRestStatus,
  getMultiDayNonDailyMatch
} from './helpers.service';
import {
  syncLRSheetRecord,
  syncLRSheetCellChange
} from './sync.service';
import { logAudit } from './audit.service';

export async function syncLRSheetFromDailyDuty(targetYear = 2026, targetMonth = 9) {
  try {
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const startDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const endDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    const cat4Staff = await all('SELECT * FROM staff WHERE category_id = 4 ORDER BY row_position ASC');
    const monthOverrides = await all(`
      SELECT o.*, s1.name as staff_name, s1.category_id as staff_cat
      FROM overrides o
      JOIN staff s1 ON o.staff_id = s1.id
      WHERE o.date >= ? AND o.date <= ?
    `, [startDateStr, endDateStr]);
    const linksList = await all(`
      SELECT * FROM links 
      WHERE (status = 'published' OR status IS NULL OR status = '') 
        AND (status != 'draft')
        AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = 'published' OR status IS NULL))
    `);
    const nonDailyList = await all('SELECT * FROM non_daily_trains');
    const dutyRegisterEntries = await all(`
      SELECT dre.*, drs.staff_id
      FROM duty_register_entry dre
      JOIN duty_register_staff drs ON dre.id = drs.entry_id
      WHERE dre.date >= ? AND dre.date <= ?
    `, [startDateStr, endDateStr]);
    const musterList = await all(`
      SELECT mr.*
      FROM muster_records mr
      JOIN staff s ON mr.staff_id = s.id
      WHERE s.category_id = 4 AND mr.date >= ? AND mr.date <= ?
    `, [startDateStr, endDateStr]);
    const earningsList = await all(`
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
            // Never overwrite explicit manual Admin entries in LR Sheet unless it was just a non-daily placeholder
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
  } catch (err) {
    console.error('Error in syncLRSheetFromDailyDuty:', err);
    return { success: false, error: err.message };
  }
}

export async function getLrSheet(query: any) {
    let year = parseInt(query.year, 10);
    let month = parseInt(query.month, 10);
    if (query.month && String(query.month).includes('-')) {
      const parts = String(query.month).split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    }
    if (!year) year = 2026;
    if (!month || month < 1 || month > 12) month = 9;

    const daysInMonth = new Date(year, month, 0).getDate();
    const days = [];
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = dayNames[dateObj.getDay()];
      days.push({
        dayNum: d,
        dateStr,
        dayOfWeek,
        isSunday: dayOfWeek === 'SUN'
      });
    }

    const allCat4Staff = await all('SELECT * FROM staff WHERE category_id = 4 ORDER BY row_position ASC, id ASC');

    // Separate active and relieved staff (relieved kept at bottom)
    const activeStaff = allCat4Staff.filter(s => s.name !== 'K NAGA NAIK' && s.id !== 115 && !s.is_relieved);
    const relievedStaff = allCat4Staff.filter(s => s.name === 'K NAGA NAIK' || s.id === 115 || s.is_relieved);
    const sortedCat4Staff = [...activeStaff, ...relievedStaff];

    const staffList = sortedCat4Staff.map((s, idx) => {
      const isRelieved = s.name === 'K NAGA NAIK' || s.id === 115 || !!s.is_relieved;
      return {
        slNo: idx + 1,
        staffId: s.id,
        name: s.name,
        designation: s.designation || 'CCTC',
        restDay: isRelieved ? '-' : (s.rest_day || '-'),
        pfNo: s.pf_no || '',
        hrmsId: s.hrms_id || '',
        isRelieved,
        relievedNote: isRelieved ? (s.relieved_note || 'RELIEVED TO ZRTI / MLY') : ''
      };
    });

    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const records = await all(
      'SELECT * FROM lr_sheet_records WHERE date >= ? AND date <= ?',
      [startDateStr, endDateStr]
    );

    const recordsMap = {};
    records.forEach(r => {
      recordsMap[`${r.staff_id}_${r.date}`] = {
        id: r.id,
        dutyCode: r.duty_code,
        remarks: r.remarks || '',
        updatedBy: r.updated_by
      };
    });

    // Real-time synchronization pool: overrides, links, non-daily, duty-register, muster, and daily earnings
    const monthOverrides = await all(`
      SELECT o.*, s1.name as staff_name, s1.category_id as staff_cat
      FROM overrides o
      JOIN staff s1 ON o.staff_id = s1.id
      WHERE o.date >= ? AND o.date <= ?
    `, [startDateStr, endDateStr]);
    const linksList = await all(`
      SELECT * FROM links 
      WHERE (status = 'published' OR status IS NULL OR status = '') 
        AND (status != 'draft')
        AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = 'published' OR status IS NULL))
    `);
    const nonDailyList = await all('SELECT * FROM non_daily_trains');
    const dutyRegisterEntries = await all(`
      SELECT dre.*, drs.staff_id
      FROM duty_register_entry dre
      JOIN duty_register_staff drs ON dre.id = drs.entry_id
      WHERE dre.date >= ? AND dre.date <= ?
    `, [startDateStr, endDateStr]);
    const musterList = await all(`
      SELECT mr.*
      FROM muster_records mr
      JOIN staff s ON mr.staff_id = s.id
      WHERE s.category_id = 4 AND mr.date >= ? AND mr.date <= ?
    `, [startDateStr, endDateStr]);
    const earningsList = await all(`
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

    // Dynamically overlay live daily duty allotments for LR staff
    for (const staff of staffList) {
      if (staff.isRelieved) continue;
      for (const day of days) {
        const key = `${staff.staffId}_${day.dateStr}`;
        const existing = recordsMap[key];

        const hasDirectOv = monthOverrides.some(o => o.staff_id === staff.staffId && o.date === day.dateStr);
        const hasSubOv = monthOverrides.some(o => o.substitute_staff_id === staff.staffId && o.date === day.dateStr);
        const hasDutyReg = dutyRegisterEntries.some(r => r.staff_id === staff.staffId && r.date === day.dateStr);
        const hasEarn = earningsList.some(e => e.staff_id === staff.staffId && e.date === day.dateStr);
        const hasMuster = musterList.some(m => m.staff_id === staff.staffId && m.date === day.dateStr && ['R', 'CR', 'SICK', 'S', 'CL', 'LAP', 'LHAP', 'CAP', 'L', 'O'].includes(m.code.toUpperCase()));

        // Check multi-day continuation from previous day
        const dObj = new Date(day.dateStr + 'T12:00:00');
        dObj.setDate(dObj.getDate() - 1);
        const prev1Str = dObj.toISOString().split('T')[0];
        const hasPrevOv = monthOverrides.some(o => (o.staff_id === staff.staffId || o.substitute_staff_id === staff.staffId) && o.date === prev1Str);

        // If an override, duty register, daily earnings, or muster record exists:
        const isNonDailyPlaceholder = existing && String(existing.dutyCode).toUpperCase().startsWith('NON DAILY');
        const isAdminSaved = existing && existing.updatedBy === 'Admin' && !isNonDailyPlaceholder;
        if (!isAdminSaved && (hasDirectOv || hasSubOv || hasDutyReg || hasEarn || hasPrevOv || isNonDailyPlaceholder || (!existing && hasMuster))) {
          const resolved = await resolveDutyCodeForLRStaff(staff.staffId, day.dateStr, day.dayOfWeek, staff.restDay, dataPool);
          if (resolved && resolved.code) {
            recordsMap[key] = {
              id: existing?.id || null,
              dutyCode: resolved.code,
              remarks: resolved.remarks || existing?.remarks || '',
              updatedBy: 'Daily Duty Management'
            };
          }
        }

        // Check 8-Hour HQ Rest & Available for Duty status
        const curEntry = recordsMap[key];
        const isRestDay = day.dayOfWeek === staff.restDay;
        const hasDutyOrLeave = curEntry && curEntry.dutyCode && curEntry.dutyCode !== 'SPARE' && curEntry.dutyCode !== 'AVL' && curEntry.dutyCode !== 'REST_HQ';

        if (!hasDutyOrLeave && !isRestDay) {
          const restInfo = await getStaffLastDutyAndRestStatus(staff.staffId, day.dateStr);
          if (restInfo && restInfo.hasLastDuty) {
            if (restInfo.restStatus === 'IN_HQ_REST') {
              recordsMap[key] = {
                id: curEntry?.id || null,
                dutyCode: 'REST_HQ',
                isInHqRest: true,
                remarks: restInfo.remarksText || 'In statutory HQ rest (< 8h required)',
                updatedBy: 'System'
              };
            } else if (restInfo.isAvailableForBooking) {
              recordsMap[key] = {
                id: curEntry?.id || null,
                dutyCode: 'AVL',
                isAvailable: true,
                arrivalTime: restInfo.arrivalTime || null,
                remarks: restInfo.remarksText || 'Min 8h HQ rest completed. Available for Duty booking.',
                updatedBy: 'System'
              };
            }
          } else if (restInfo && !restInfo.hasLastDuty && restInfo.isAvailableForBooking) {
            recordsMap[key] = {
              id: curEntry?.id || null,
              dutyCode: 'AVL',
              isAvailable: true,
              arrivalTime: null,
              remarks: 'LR Standby Pool • Full HQ Rest Available • Ready for Booking',
              updatedBy: 'System'
            };
          }
        }
      }
    }

    // Enrich records with multiDayInfo if matching non-daily service
    Object.keys(recordsMap).forEach(key => {
      const rec = recordsMap[key];
      if (rec && rec.dutyCode) {
        const ndMatch = getMultiDayNonDailyMatch(rec.dutyCode) || getMultiDayNonDailyMatch(rec.remarks);
        if (ndMatch) {
          const isReturn = ndMatch.returnTrain && String(rec.dutyCode).includes(ndMatch.returnTrain);
          const isOutward = String(rec.dutyCode).includes(ndMatch.outTrain);
          rec.isNonDaily = true;
          rec.multiDayInfo = {
            serviceName: ndMatch.serviceName,
            dayNumber: isOutward ? 1 : (isReturn ? 2 : (rec.dutyCode === 'AVL' ? 3 : 1)),
            totalDays: ndMatch.totalDays,
            dayRole: isOutward ? 'Outward Leg' : (isReturn ? 'Return Leg' : 'Arrival & HQ Rest'),
            trainNo: isOutward ? ndMatch.outTrain : (isReturn ? ndMatch.returnTrain : '---'),
            route: isOutward ? `${ndMatch.from} ➔ ${ndMatch.via}` : `${ndMatch.via} ➔ ${ndMatch.to}`,
            depTime: isOutward ? ndMatch.depTime : ndMatch.retDepTime,
            arrTime: isOutward ? '' : ndMatch.arrHqTime,
            restTill: ndMatch.restTill,
            coaches: ndMatch.coaches
          };
        }
      }
    });

    const monthDate = new Date(year, month - 1, 1);
    const monthName = monthDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    return ({
      success: true,
      year,
      month,
      monthName,
      days,
      staff: staffList,
      records: recordsMap,
      nonDailyServices: NON_DAILY_MULTI_DAY_SERVICES
    });
}

export async function getLrMultiDayServices() {
  return { success: true, services: NON_DAILY_MULTI_DAY_SERVICES };
}

export async function updateLrCell(data: any, currentUser: any = 'Admin') {
    const { staff_id, date, duty_code, remarks, link_number, target_category_id } = data;
    if (!staff_id || !date) {
      throw new ApiError(400, 'staff_id and date are required' );
    }

    await withTransaction(async () => {
      const staffRow = await get('SELECT name FROM staff WHERE id = ?', [staff_id]);
      const staffName = staffRow?.name || `Staff #${staff_id}`;

      await syncLRSheetCellChange(staff_id, date, duty_code, remarks, { link_number, target_category_id });

      await logAudit(
        'Admin',
        'LR_CELL_UPDATE',
        `Updated LR Sheet cell for ${staffName} (ID ${staff_id}) on ${date} to '${duty_code || 'CLEARED'}' — synchronized to Daily Summary, Monthly Movement, Muster Roll, TA, NDA, Diary & Daily Earnings`,
        { staffId: staff_id, staffName, date, duty_code: duty_code || '', savedCount: 1, errorCount: 0, savedEmployeesCount: 1, errorEmployeesCount: 0 }
      );
    });
    return ({ success: true, message: `Updated and synchronized LR cell for ${date}` });
}

export async function batchUpdateLrSheet(data: any, currentUser: any = 'Admin') {
    const { updates } = data;
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new ApiError(400, 'Array of updates required' );
    }

    let savedCount = 0;
    let errorCount = 0;
    const savedEmployeesSet = new Set();
    const errorEmployeesSet = new Set();
    const errors = [];

    for (const item of updates) {
      try {
        if (!item.staff_id || !item.date) {
          throw new Error('Missing staff_id or date');
        }
        await withTransaction(async () => {
          await syncLRSheetCellChange(item.staff_id, item.date, item.duty_code, item.remarks, { link_number: item.link_number, target_category_id: item.target_category_id });
        });
        savedCount++;
        savedEmployeesSet.add(item.staff_id);
      } catch (itemErr) {
        errorCount++;
        if (item?.staff_id) errorEmployeesSet.add(item.staff_id);
        const staffRow = item?.staff_id ? await get('SELECT name FROM staff WHERE id = ?', [item.staff_id]).catch(() => null) : null;
        errors.push({
          staff_id: item?.staff_id || null,
          staff_name: staffRow?.name || `Employee #${item?.staff_id || '?'}`,
          date: item?.date || null,
          error: itemErr.message
        });
      }
    }

    const savedEmployeesCount = savedEmployeesSet.size;
    const errorEmployeesCount = errorEmployeesSet.size;
    await logAudit(
      'Admin',
      'LR_BATCH_UPDATE',
      `Saved LR Sheet records one-by-one: ${savedEmployeesCount} employee(s) (${savedCount} day record(s)) saved, ${errorEmployeesCount} employee(s) (${errorCount} day record(s)) failed`,
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
      message: `LR Sheet Save Complete: ${savedEmployeesCount} employee(s) (${savedCount} day record(s)) saved successfully, ${errorEmployeesCount} employee(s) (${errorCount} day record(s)) had an error.${errorSummary}`
    });
}

export async function addLrMember(data: any, currentUser: any = 'Admin') {
  if (currentUser && currentUser !== 'Admin') {
    throw new ApiError(403, 'Permission denied: Administrator privileges required.' );
  }
    const { existing_staff_id, name, designation, rest_day, pf_no, hrms_id } = data;

    const maxPosRow = await get('SELECT MAX(row_position) as maxPos FROM staff WHERE category_id = 4');
    const nextPos = (maxPosRow && maxPosRow.maxPos ? maxPosRow.maxPos : 0) + 1;
    const cleanRest = rest_day ? String(rest_day).trim().toUpperCase() : 'MON';
    const cleanDesg = designation ? String(designation).trim() : 'CCTC';
    const cleanPf = pf_no ? String(pf_no).trim() : null;
    const cleanHrms = hrms_id ? String(hrms_id).trim() : null;

    let targetStaffId;
    let staffName = '';

    if (existing_staff_id) {
      const existing = await get('SELECT * FROM staff WHERE id = ?', [existing_staff_id]);
      if (!existing) {
        throw new ApiError(404, 'Selected staff member not found in database' );
      }
      targetStaffId = existing.id;
      staffName = name && name.trim() ? name.trim() : existing.name;

      await run(`
        UPDATE staff 
        SET category_id = 4,
            row_position = ?,
            rest_day = ?,
            designation = COALESCE(?, designation),
            pf_no = COALESCE(?, pf_no),
            hrms_id = COALESCE(?, hrms_id),
            active = 1
        WHERE id = ?
      `, [
        nextPos,
        cleanRest,
        cleanDesg,
        cleanPf,
        cleanHrms,
        targetStaffId
      ]);
    } else {
      if (!name || !name.trim()) {
        throw new ApiError(400, 'Staff name is required to create a new member' );
      }
      staffName = name.trim();
      const insResult = await run(`
        INSERT INTO staff (name, designation, category_id, row_position, rest_day, pf_no, hrms_id, active)
        VALUES (?, ?, 4, ?, ?, ?, ?, 1)
      `, [
        staffName,
        cleanDesg,
        nextPos,
        cleanRest,
        cleanPf,
        cleanHrms
      ]);
      targetStaffId = (insResult as any).lastID;
    }

    // Ensure dummy LR link exists in links table
    const existingLink = await get('SELECT id FROM links WHERE category_id = 4 AND link_number = ?', [nextPos]);
    if (!existingLink) {
      await run(`
        INSERT INTO links (category_id, link_number, train_numbers, from_station, to_station, coaches, is_rest, effective_from, effective_to, set_type, set_name, link_set_id, status)
        VALUES (4, ?, ?, 'GNT', 'GNT', 'Relief / LR', 0, '2020-01-01', '9999-12-31', 'Relief / LR', ?, 4, 'published')
      `, [nextPos, `LR-${nextPos} (${cleanRest} Rest)`, `LR Link ${nextPos}`]);
    }

    // Keep categories cycle length in sync with current LR count
    try {
      await run(`UPDATE categories SET cycle_length = (SELECT COUNT(*) FROM staff WHERE category_id = 4) WHERE id = 4`);
    } catch (e) { }

    await logAudit(currentUser ? currentUser : 'Admin', 'ADD_LR_MEMBER', `Added LR staff member '${staffName}' (ID: ${targetStaffId}) at position ${nextPos} with Rest: ${cleanRest}`);

    return ({
      success: true,
      message: `Successfully added ${staffName} to Leave Reserve (Position ${nextPos})!`,
      staffId: targetStaffId,
      rowPosition: nextPos
    });
}

export async function removeLrMember(data: any, currentUser: any = 'Admin') {
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

    const oldPos = staff.row_position;
    const staffName = staff.name;

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
      try { await run('UPDATE users SET staff_id = NULL WHERE staff_id = ?', [staff_id]); } catch (e) { }
      try { await run('UPDATE non_daily_trains SET assigned_staff_id = NULL WHERE assigned_staff_id = ?', [staff_id]); } catch (e) { }
      try { await run('DELETE FROM lr_duty_completions WHERE staff_id = ?', [staff_id]); } catch (e) { }
      await run('DELETE FROM staff WHERE id = ?', [staff_id]);
    } else {
      await run('UPDATE staff SET active = 0, category_id = NULL, row_position = NULL WHERE id = ?', [staff_id]);
    }

    // Re-index row_position for remaining Category 4 staff to keep contiguous sequence 1, 2, 3...
    const remainingCat4 = await all('SELECT id FROM staff WHERE category_id = 4 ORDER BY row_position ASC, id ASC');
    for (let i = 0; i < remainingCat4.length; i++) {
      await run('UPDATE staff SET row_position = ? WHERE id = ?', [i + 1, remainingCat4[i].id]);
    }

    // Update categories cycle length
    try {
      await run(`UPDATE categories SET cycle_length = (SELECT COUNT(*) FROM staff WHERE category_id = 4) WHERE id = 4`);
    } catch (e) { }

    await logAudit(currentUser ? currentUser : 'Admin', 'REMOVE_LR_MEMBER', `${permanent_delete ? 'Permanently deleted' : 'Removed from LR pool'} staff '${staffName}' (was position ${oldPos})`);

    return ({
      success: true,
      message: `Successfully removed ${staffName} from Leave Reserve.`,
      staffId: staff_id
    });
}
