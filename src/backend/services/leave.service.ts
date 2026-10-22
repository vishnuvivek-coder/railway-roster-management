import { get, all, run } from '../db';
import { getDayOffset, getBaseLinkNumber } from '../rotation';
import { ApiError } from '../utils/api_error';
import { getCategoryParamsForDate, getLinkSetDetails } from './helpers.service';
import { syncDutyChangeAcrossAllModules, syncDocumentsAndEarningsForStaffDate } from './sync.service';
import { logAudit } from './audit.service';

export async function getLeaveRequests() {
  return await all(`
    SELECT lr.*, 
           s.name as staff_name, s.designation as staff_desg, s.category_id,
           ss.name as swap_staff_name, ss.designation as swap_staff_desg 
    FROM leave_requests lr
    JOIN staff s ON lr.staff_id = s.id
    LEFT JOIN staff ss ON lr.swap_staff_id = ss.id
    ORDER BY COALESCE(lr.from_date, lr.date) DESC, lr.id DESC
  `);
}

export async function createLeaveRequest(data: any) {
  const { staff_id, date, from_date, to_date, type, swap_staff_id, reason } = data;
  const fromDate = from_date || date;
  const toDate = to_date || fromDate;
  if (!staff_id || !fromDate || !type) {
    throw new ApiError(400, 'Staff ID, from_date/date and type are required');
  }
  const result = await run(
    'INSERT INTO leave_requests (staff_id, date, from_date, to_date, type, swap_staff_id, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [staff_id, fromDate, fromDate, toDate, type.toUpperCase(), swap_staff_id || null, reason || '', 'PENDING']
  );
  return { id: result.lastID };
}

export async function approveLeaveRequest(id: any, currentUser: string = 'Admin') {
  const request = await get('SELECT * FROM leave_requests WHERE id = ?', [id]);
  if (!request) {
    throw new ApiError(404, 'Request not found');
  }

  const staffA = await get('SELECT * FROM staff WHERE id = ?', [request.staff_id]);
  const cat = await get('SELECT * FROM categories WHERE id = ?', [staffA.category_id]);

  if (request.type === 'LEAVE') {
    const fromD = request.from_date || request.date;
    const toD = request.to_date || fromD;

    const undoSnapshots = [];
    const start = new Date(fromD + 'T00:00:00Z');
    const end = new Date(toD + 'T00:00:00Z');
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const curDateStr = d.toISOString().split('T')[0];
      const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staffA.id, curDateStr]);
      const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staffA.id, curDateStr]);

      undoSnapshots.push({
        date: curDateStr,
        override: existingOverride || null,
        muster: existingMuster || null
      });

      const { anchor_date: catAnchorDate, cycle_length: catCycleLength } = getCategoryParamsForDate(cat, curDateStr);
      const dayOffset = getDayOffset(catAnchorDate, curDateStr);
      const origLink = getBaseLinkNumber(staffA.row_position, dayOffset, catCycleLength);
      const leaveReason = `Approved Leave: ${request.reason || 'On Leave'}`;

      await run(
        `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, leave_type) 
         VALUES (?, ?, ?, NULL, 'LEAVE', ?, 'CL') 
         ON CONFLICT(staff_id, date) DO UPDATE SET overridden_link_number = NULL, status = 'LEAVE', reason = excluded.reason, leave_type = COALESCE(overrides.leave_type, 'CL')`,
        [staffA.id, curDateStr, origLink, leaveReason]
      );

      await syncDutyChangeAcrossAllModules({ get, all, run }, staffA.id, curDateStr, {
        isLeave: true,
        leaveCode: 'CL',
        remarks: leaveReason
      });
    }

    if (fromD === toD) {
      const { anchor_date: fromAnchorDate, cycle_length: fromCycleLength } = getCategoryParamsForDate(cat, fromD);
      const dayOffset = getDayOffset(fromAnchorDate, fromD);
      const origLink = getBaseLinkNumber(staffA.row_position, dayOffset, fromCycleLength);
      const linkSet = getLinkSetDetails(staffA.category_id, origLink);
      if (linkSet && linkSet.isFirstDayOfSet && linkSet.remainingLinks.length > 0) {
        for (let k = 0; k < linkSet.remainingLinks.length; k++) {
          const remLink = linkSet.remainingLinks[k];
          const nextDate = new Date(fromD + 'T12:00:00');
          nextDate.setDate(nextDate.getDate() + k + 1);
          const y = nextDate.getFullYear();
          const m = String(nextDate.getMonth() + 1).padStart(2, '0');
          const d = String(nextDate.getDate()).padStart(2, '0');
          const remDateStr = `${y}-${m}-${d}`;

          await run(
            `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) 
             VALUES (?, ?, ?, NULL, 'AVAILABLE_FOR_BOOKING', ?, ?) 
             ON CONFLICT(staff_id, date) DO UPDATE SET overridden_link_number = NULL, status = 'AVAILABLE_FOR_BOOKING', reason = excluded.reason, target_category_id = excluded.target_category_id`,
            [staffA.id, remDateStr, remLink, `Available for Booking Duty at HQ (Took 1-day leave on Link #${origLink})`, staffA.category_id]
          );

          await run(
            `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
             VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
             ON CONFLICT(staff_id, date) DO UPDATE SET code = 'P', remarks = excluded.remarks, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
            [staffA.id, remDateStr, `Present at HQ (Available for booking - 1-day leave on Link #${origLink})`]
          );
          await syncDocumentsAndEarningsForStaffDate(staffA.id, remDateStr, { dutyText: 'AVL', isLeaveOrRest: false });
        }
      }
    }

    const undoData = {
      action: 'APPROVE_LEAVE',
      request_id: id,
      staff_id: staffA.id,
      staff_name: staffA.name,
      from_date: fromD,
      to_date: toD,
      snapshots: undoSnapshots
    };

    await logAudit('Admin', 'APPROVE_LEAVE', `Approved leave for ${staffA.name} from ${fromD} to ${toD}`, undoData);
  } else if (request.type === 'SWAP') {
    const swapDate = request.from_date || request.date;
    const { anchor_date: swapAnchorDate, cycle_length: swapCycleLength } = getCategoryParamsForDate(cat, swapDate);
    const dayOffset = getDayOffset(swapAnchorDate, swapDate);
    const staffB = await get('SELECT * FROM staff WHERE id = ?', [request.swap_staff_id]);
    if (!staffB) {
      throw new ApiError(400, 'Swap staff member not found');
    }

    const origLinkA = getBaseLinkNumber(staffA.row_position, dayOffset, swapCycleLength);
    const origLinkB = getBaseLinkNumber(staffB.row_position, dayOffset, swapCycleLength);

    const activeOverrideA = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staffA.id, swapDate]);
    const activeOverrideB = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staffB.id, swapDate]);
    const existingMusterA = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staffA.id, swapDate]);
    const existingMusterB = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staffB.id, swapDate]);

    const dutyA = (activeOverrideA && activeOverrideA.overridden_link_number !== undefined) ? activeOverrideA.overridden_link_number : origLinkA;
    const dutyB = (activeOverrideB && activeOverrideB.overridden_link_number !== undefined) ? activeOverrideB.overridden_link_number : origLinkB;

    await run(
      `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason) 
       VALUES (?, ?, ?, ?, ?, ?) 
       ON CONFLICT(staff_id, date) DO UPDATE SET overridden_link_number = excluded.overridden_link_number, status = excluded.status, reason = excluded.reason`,
      [staffA.id, swapDate, origLinkA, dutyB, dutyB === null ? 'REST' : 'CHANGED_LINK', `Swap with ${staffB.name}`]
    );

    await run(
      `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason) 
       VALUES (?, ?, ?, ?, ?, ?) 
       ON CONFLICT(staff_id, date) DO UPDATE SET overridden_link_number = excluded.overridden_link_number, status = excluded.status, reason = excluded.reason`,
      [staffB.id, swapDate, origLinkB, dutyA, dutyA === null ? 'REST' : 'CHANGED_LINK', `Swap with ${staffA.name}`]
    );

    await syncDutyChangeAcrossAllModules({ get, all, run }, staffA.id, swapDate, {
      targetLink: dutyB,
      isLeave: false,
      isRest: dutyB === null,
      remarks: `Swap with ${staffB.name}`
    });
    await syncDutyChangeAcrossAllModules({ get, all, run }, staffB.id, swapDate, {
      targetLink: dutyA,
      isLeave: false,
      isRest: dutyA === null,
      remarks: `Swap with ${staffA.name}`
    });

    const undoData = {
      action: 'APPROVE_SWAP',
      request_id: id,
      date: swapDate,
      staff_a: { id: staffA.id, name: staffA.name, previous_override: activeOverrideA || null, previous_muster: existingMusterA || null },
      staff_b: { id: staffB.id, name: staffB.name, previous_override: activeOverrideB || null, previous_muster: existingMusterB || null }
    };

    await logAudit('Admin', 'APPROVE_SWAP', `Approved swap between ${staffA.name} and ${staffB.name} on ${swapDate}`, undoData);
  }

  await run(
    "UPDATE leave_requests SET status = 'APPROVED', approved_by = 'Admin', approved_at = datetime('now') WHERE id = ?",
    [id]
  );

  return { message: 'Request approved and synchronized across all modules successfully' };
}

export async function rejectLeaveRequest(id: any, reason?: string, currentUser: string = 'Admin') {
  const request = await get('SELECT lr.*, s.name as staff_name FROM leave_requests lr LEFT JOIN staff s ON lr.staff_id = s.id WHERE lr.id = ?', [id]);
  await run(
    "UPDATE leave_requests SET status = 'REJECTED', reason = ? WHERE id = ?",
    [reason || 'Rejected by Admin', id]
  );
  await logAudit('Admin', 'REJECT_LEAVE', `Rejected ${request?.type || 'leave'} request for ${request?.staff_name || `Staff #${request?.staff_id || id}`} (${request?.from_date || request?.date || ''}): ${reason || 'Rejected by Admin'}`, {
    request_id: id,
    staff_id: request?.staff_id,
    staff_name: request?.staff_name,
    date: request?.from_date || request?.date
  });
  return { message: 'Request rejected' };
}
