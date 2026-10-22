import { get, all, run, withTransaction } from '../db';
import { getDayOffset, getBaseLinkNumber } from '../rotation';
import { getWeekday } from '../restAdjustment';
import { ApiError } from '../utils/api_error';
import {
  formatDateDisplay,
  getActiveLinkDef,
  getLinkSetDetails,
  NON_DAILY_PAIRS_MAP,
  getMultiDayNonDailyMatch,
  ALLOWED_MUSTER_CODES,
  resolveDutyCodeForLRStaff
} from './helpers.service';
import {
  syncDutyChangeAcrossAllModules,
  syncDocumentsAndEarningsForStaffDate,
  restoreMusterTaApprovalsAndEntries,
  syncLRSheetRecord
} from './sync.service';
import { logAudit } from './audit.service';

export async function saveOverride(data: any, currentUser: string = 'Admin') {
  const { staff_id, date, overridden_link_number, reason, target_category_id } = data;
  if (!staff_id || !date || reason === undefined || reason === null) {
    throw new ApiError(400, 'Staff ID, date and reason are required' );
  }
    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) {
      throw new ApiError(404, 'Staff member not found' );
    }
    const category = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);

    // Compute original link number using rotation formula
    const dayOffset = getDayOffset(category.anchor_date, date);
    const originalLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);

    const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, date]);
    const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, date]);

    // Upsert override
    await run(
      `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, reason, target_category_id) 
       VALUES (?, ?, ?, ?, ?, ?) 
       ON CONFLICT(staff_id, date) 
       DO UPDATE SET overridden_link_number = excluded.overridden_link_number, reason = excluded.reason, target_category_id = excluded.target_category_id`,
      [staff_id, date, originalLink, overridden_link_number, reason, target_category_id || null]
    );

    // Multi-module synchronization
    await syncDutyChangeAcrossAllModules({ get, all, run }, staff_id, date, {
      targetLink: overridden_link_number,
      isLeave: false,
      isRest: overridden_link_number === null,
      remarks: reason
    });

    const undoData = {
      action: 'MANUAL_OVERRIDE',
      staff_id,
      staff_name: staff.name,
      date,
      previous_override: existingOverride || null,
      previous_muster: existingMuster || null
    };

    const targetDesc = overridden_link_number === null ? 'REST' : `Link ${overridden_link_number}`;
    await logAudit(
      'Admin',
      'MANUAL_OVERRIDE',
      `Overrode ${staff.name} on ${date} from Link ${originalLink} to ${targetDesc}. Reason: ${reason}`,
      undoData
    );

    return ({ message: 'Override applied successfully' });
}

export async function changeDutyStatus(data: any, currentUser: string = 'Admin') {
  const {
    staff_id,
    date,
    to_date, // Optional multi-day range
    action, // 'SICK', 'LEAVE', 'CR', 'CHANGED_LINK', 'RESET'
    leave_type, // 'CL', 'LAP', 'LHAP', 'CCL', 'SCL', 'SICK', 'CR'
    day_wise_leaves, // Optional day-wise map or array: { [date]: { leave_type, reason, cr_earned_date } }
    reason,
    new_link_number,
    target_category_id,
    replacement_type, // 'OTHER_COLUMN', 'LR', 'UPGRADE_SLEEPER', 'CUSTOM', 'NONE'
    replacement_staff_id,
    replacement_name
  } = data;

  if (!staff_id || !date || !action) {
    throw new ApiError(400, 'staff_id, date, and action are required' );
  }

    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) {
      throw new ApiError(404, 'Staff member not found' );
    }

    const category = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);

    return await withTransaction(async () => {
      // Determine dates array to update (supports single date or date range)
      const datesToProcess = [];
      const startDate = new Date(date + 'T12:00:00');
      const endDate = (to_date && to_date >= date) ? new Date(to_date + 'T12:00:00') : startDate;
      const curDate = new Date(startDate);
      while (curDate <= endDate) {
        const y = curDate.getFullYear();
        const m = String(curDate.getMonth() + 1).padStart(2, '0');
        const d = String(curDate.getDate()).padStart(2, '0');
        datesToProcess.push(`${y}-${m}-${d}`);
        curDate.setDate(curDate.getDate() + 1);
      }
      if (datesToProcess.length === 0) datesToProcess.push(date);

      if (action === 'RESET' || action === 'CANCEL_LEAVE') {
        const undoSnapshots = [];
        for (const dStr of datesToProcess) {
          const existing = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          let subOverride = null;
          let subMuster = null;
          if (existing && existing.substitute_staff_id) {
            subOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [existing.substitute_staff_id, dStr]);
            subMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [existing.substitute_staff_id, dStr]);
          }
          undoSnapshots.push({
            date: dStr,
            override: existing || null,
            muster: existingMuster || null,
            subOverride,
            subMuster
          });

          if (existing && existing.substitute_staff_id) {
            if (existing.status === 'SUBSTITUTE') {
              // If this staff was a substitute, clear substitute reference on original staff's override
              await run('UPDATE overrides SET substitute_staff_id = NULL, substitute_name = NULL WHERE staff_id = ? AND date = ?', [existing.substitute_staff_id, dStr]);
            } else {
              // If this staff was sick/leave, remove the substitute's override & reset their muster record
              await run('DELETE FROM overrides WHERE staff_id = ? AND date = ? AND status = "SUBSTITUTE"', [existing.substitute_staff_id, dStr]);
              await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [existing.substitute_staff_id, dStr]);
              // If substitute was an LR employee, clear their LR sheet record
              await run('DELETE FROM lr_sheet_records WHERE staff_id = ? AND date = ?', [existing.substitute_staff_id, dStr]);
            }
          }
          await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          // Also delete from muster_records so attendance reverts to cyclic baseline
          await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);

          // If staff is an LR employee, clear their LR sheet record
          if (staff.category_id === 4) {
            await run('DELETE FROM lr_sheet_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          }

          // Restore TA approvals and entries for both main staff and substitute
          const dateParts = dStr.split('-');
          const altDateStr = dateParts.length === 3 ? `${parseInt(dateParts[2], 10)}/${parseInt(dateParts[1], 10)}/${dateParts[0].slice(-2)}` : dStr;
          await restoreMusterTaApprovalsAndEntries(staff_id, dStr, altDateStr);
          await syncDocumentsAndEarningsForStaffDate(staff_id, dStr, { dutyText: null, isLeaveOrRest: false });
          if (existing && existing.substitute_staff_id) {
            await restoreMusterTaApprovalsAndEntries(existing.substitute_staff_id, dStr, altDateStr);
            await syncDocumentsAndEarningsForStaffDate(existing.substitute_staff_id, dStr, { dutyText: null, isLeaveOrRest: false });
          }
          try {
            const { generatePendingTaClaimsForMonth } = require('./ta_generator');
            await generatePendingTaClaimsForMonth({ run, get, all }, parseInt(dateParts[0], 10), parseInt(dateParts[1], 10), staff_id);
          } catch (err) { }

          // Automatically cancel any approved leave_requests for this staff on this date
          await run(
            `UPDATE leave_requests SET status = 'CANCELLED' 
           WHERE staff_id = ? AND ((from_date <= ? AND to_date >= ?) OR date = ?) AND status = 'APPROVED'`,
            [staff_id, dStr, dStr, dStr]
          );

          // Also check if this staff was on 1-day leave on Day 1 of a multi-day link set on dStr,
          // which generated AVAILABLE_FOR_BOOKING overrides on subsequent days:
          const resetDayOffset = getDayOffset(category.anchor_date, dStr);
          const resetOrigLink = getBaseLinkNumber(staff.row_position, resetDayOffset, category.cycle_length);
          const resetLinkSet = getLinkSetDetails(staff.category_id, resetOrigLink);
          if (resetLinkSet && resetLinkSet.isFirstDayOfSet && resetLinkSet.remainingLinks.length > 0) {
            for (let k = 0; k < resetLinkSet.remainingLinks.length; k++) {
              const nextDate = new Date(dStr + 'T12:00:00');
              nextDate.setDate(nextDate.getDate() + k + 1);
              const y = nextDate.getFullYear();
              const m = String(nextDate.getMonth() + 1).padStart(2, '0');
              const d = String(nextDate.getDate()).padStart(2, '0');
              const nextDateStr = `${y}-${m}-${d}`;

              const subOv = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, nextDateStr]);
              if (subOv && subOv.status === 'AVAILABLE_FOR_BOOKING') {
                if (subOv.substitute_staff_id) {
                  await run('DELETE FROM overrides WHERE staff_id = ? AND date = ? AND status = "SUBSTITUTE"', [subOv.substitute_staff_id, nextDateStr]);
                  await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [subOv.substitute_staff_id, nextDateStr]);
                  await syncDocumentsAndEarningsForStaffDate(subOv.substitute_staff_id, nextDateStr, { dutyText: null, isLeaveOrRest: false });
                }
                await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, nextDateStr]);
                await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, nextDateStr]);
                await syncDocumentsAndEarningsForStaffDate(staff_id, nextDateStr, { dutyText: null, isLeaveOrRest: false });
              }
            }
          }
        }

        const logMsg = action === 'CANCEL_LEAVE'
          ? `Cancelled leave for ${staff.name} between ${datesToProcess[0]} and ${datesToProcess[datesToProcess.length - 1]} and restored cyclic duty`
          : `Reset duty status and muster records for ${staff.name} between ${datesToProcess[0]} and ${datesToProcess[datesToProcess.length - 1]} to cyclic roster`;

        const undoData = {
          action,
          staff_id,
          staff_name: staff.name,
          dates: datesToProcess,
          snapshots: undoSnapshots
        };
        await logAudit('Admin', action === 'CANCEL_LEAVE' ? 'CANCEL_LEAVE' : 'RESET_DUTY', logMsg, undoData);

        const userMsg = action === 'CANCEL_LEAVE'
          ? `Leave cancelled successfully. ${staff.name} returned to original cyclic link duty!`
          : `Duty and muster records reset to cyclic roster for ${staff.name}`;
        return ({ success: true, message: userMsg });
      }

      if (action === 'WRONG_ALLOTMENT') {
        const undoSnapshots = [];
        const linkNum = data.link_number || data.new_link_number;
        const targetCatId = target_category_id || staff.category_id;
        const subAction = data.wrong_allotment_action || (replacement_staff_id ? 'REPLACE' : (replacement_type === 'RESET' ? 'RESET' : 'VACANT'));

        for (const dStr of datesToProcess) {
          const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          let existingSubOverride = null;
          let existingSubMuster = null;
          if (replacement_staff_id) {
            existingSubOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [replacement_staff_id, dStr]);
            existingSubMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [replacement_staff_id, dStr]);
          }
          undoSnapshots.push({
            date: dStr,
            override: existingOverride || null,
            muster: existingMuster || null,
            subOverride: existingSubOverride || null,
            subMuster: existingSubMuster || null
          });

          // 1. Relieve the wrongly allotted employee (staff_id)
          if (existingOverride && (existingOverride.status === 'CHANGED_LINK' || existingOverride.status === 'SUBSTITUTE')) {
            // If staff_id was a substitute or placed on this link via override, clear that assignment
            if (existingOverride.substitute_staff_id) {
              await run('UPDATE overrides SET substitute_staff_id = NULL, substitute_name = NULL WHERE staff_id = ? AND date = ?', [existingOverride.substitute_staff_id, dStr]);
            }
            await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
            await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
            if (staff.category_id === 4) {
              await run('DELETE FROM lr_sheet_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
            }
          } else if (subAction === 'RESET') {
            await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
            await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
            if (staff.category_id === 4) {
              await run('DELETE FROM lr_sheet_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
            }
          } else {
            // staff_id was cyclic occupant of this link, relieve them as AVAILABLE_FOR_BOOKING at HQ
            const dayOffset = getDayOffset(category.anchor_date, dStr);
            const origLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);
            await run(
              `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id)
             VALUES (?, ?, ?, NULL, 'AVAILABLE_FOR_BOOKING', ?, ?)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               overridden_link_number = NULL,
               status = 'AVAILABLE_FOR_BOOKING',
               reason = excluded.reason`,
              [
                staff_id,
                dStr,
                origLink,
                reason || 'Wrong allotment removed (Available at HQ)',
                staff.category_id
              ]
            );
            await run(
              `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
             VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               code = 'P',
               remarks = excluded.remarks,
               updated_by = excluded.updated_by,
               updated_at = CURRENT_TIMESTAMP`,
              [staff_id, dStr, 'Available at HQ (Wrong allotment removed)']
            );
          }
          await syncDocumentsAndEarningsForStaffDate(staff_id, dStr, { dutyText: 'AVL', isLeaveOrRest: false, remarks: 'Wrong allotment removed' });

          // 2. If replacement employee is selected, assign them to this link
          if (replacement_staff_id) {
            const subStaff = await get('SELECT * FROM staff WHERE id = ?', [replacement_staff_id]);
            if (subStaff) {
              const subCat = await get('SELECT * FROM categories WHERE id = ?', [subStaff.category_id]);
              const subOrigLink = getBaseLinkNumber(subStaff.row_position, getDayOffset(subCat.anchor_date, dStr), subCat.cycle_length);
              const targetLinkVal = linkNum ? parseInt(linkNum, 10) : (existingOverride?.overridden_link_number || existingOverride?.original_link_number || null);

              await run(
                `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id)
               VALUES (?, ?, ?, ?, 'CHANGED_LINK', ?, ?)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 overridden_link_number = excluded.overridden_link_number,
                 status = 'CHANGED_LINK',
                 reason = excluded.reason,
                 target_category_id = excluded.target_category_id`,
                [
                  subStaff.id,
                  dStr,
                  subOrigLink,
                  targetLinkVal,
                  reason || `Assigned to Link #${targetLinkVal} (Replaced wrong allotment of ${staff.name})`,
                  targetCatId
                ]
              );

              await run(
                `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
               VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 code = 'P',
                 remarks = excluded.remarks,
                 updated_by = excluded.updated_by,
                 updated_at = CURRENT_TIMESTAMP`,
                [subStaff.id, dStr, `Working Link #${targetLinkVal}`]
              );

              if (subStaff.category_id === 4) {
                const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                const dObj = new Date(dStr + 'T12:00:00');
                const dayOfWeek = dayNames[dObj.getDay()];
                const resolvedSubDuty = await resolveDutyCodeForLRStaff(subStaff.id, dStr, dayOfWeek, subStaff.rest_day);
                if (resolvedSubDuty && resolvedSubDuty.code) {
                  await syncLRSheetRecord(subStaff.id, dStr, resolvedSubDuty.code, `Link #${targetLinkVal}`);
                }
              }
              await syncDutyChangeAcrossAllModules({ get, all, run }, subStaff.id, dStr, {
                targetLink: targetLinkVal,
                isLeave: false,
                remarks: `Working Link #${targetLinkVal}`
              });
            }
          }
        }

        const auditMsg = replacement_staff_id
          ? `Removed wrong allotment for ${staff.name} on ${date} and replaced with ${replacement_name || 'selected employee'}`
          : `Removed wrong allotment for ${staff.name} on ${date}`;

        await logAudit('Admin', 'WRONG_ALLOTMENT', auditMsg, {
          staff_id,
          staff_name: staff.name,
          action: 'WRONG_ALLOTMENT',
          subAction,
          replacement_staff_id,
          snapshots: undoSnapshots
        });

        const returnMsg = replacement_staff_id
          ? `Wrong allotment removed! ${staff.name} relieved and replaced by ${replacement_name || 'selected employee'}.`
          : (subAction === 'RESET'
            ? `Wrong allotment removed! Restored to regular cyclic roster.`
            : `Wrong allotment removed! ${staff.name} relieved from this duty.`);

        return ({ success: true, message: returnMsg });
      }

      if (action === 'MARK_LATER' || action === 'REASON_LATER') {
        let finalSubstituteName = replacement_name;
        if (!finalSubstituteName && replacement_staff_id) {
          const subStaffObj = await get('SELECT name FROM staff WHERE id = ?', [replacement_staff_id]);
          finalSubstituteName = subStaffObj ? subStaffObj.name : null;
        }

        const undoSnapshots = [];
        const effectiveReason = reason || 'Mark Reason Later (Muster Blank)';

        for (const dStr of datesToProcess) {
          const dayOffset = getDayOffset(category.anchor_date, dStr);
          const originalLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);

          const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          let existingSubOverride = null;
          let existingSubMuster = null;
          if (replacement_staff_id) {
            existingSubOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [replacement_staff_id, dStr]);
            existingSubMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [replacement_staff_id, dStr]);
          }
          undoSnapshots.push({
            date: dStr,
            override: existingOverride || null,
            muster: existingMuster || null,
            subOverride: existingSubOverride || null,
            subMuster: existingSubMuster || null
          });

          // 1. Mark main staff member with status = 'MARK_LATER' and leave_type = NULL
          await run(
            `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id, leave_type)
           VALUES (?, ?, ?, NULL, 'MARK_LATER', ?, ?, ?, ?, NULL)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             overridden_link_number = NULL,
             status = 'MARK_LATER',
             substitute_staff_id = excluded.substitute_staff_id,
             substitute_name = excluded.substitute_name,
             reason = excluded.reason,
             target_category_id = excluded.target_category_id,
             leave_type = NULL`,
            [
              staff_id,
              dStr,
              originalLink,
              replacement_staff_id || null,
              finalSubstituteName || null,
              effectiveReason,
              staff.category_id
            ]
          );

          // 2. Insert into muster_records with BLANK code: ''
          await run(
            `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
           VALUES (?, ?, '', ?, 'Admin', CURRENT_TIMESTAMP)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             code = '',
             remarks = excluded.remarks,
             updated_by = excluded.updated_by,
             updated_at = CURRENT_TIMESTAMP`,
            [staff_id, dStr, effectiveReason]
          );

          // Sync main staff with LR sheet if staff is in Category 4
          if (staff.category_id === 4) {
            await syncLRSheetRecord(staff.id, dStr, '', effectiveReason);
          }

          // Disallow TA claims since employee was deleted from slot and did not work
          const dateParts = dStr.split('-');
          const altDateStr = dateParts.length === 3 ? `${parseInt(dateParts[2], 10)}/${parseInt(dateParts[1], 10)}/${dateParts[0].slice(-2)}` : dStr;
          const disallowRemark = `Disallowed: Deleted from duty slot (Reason to be marked later)`;
          await run(
            `UPDATE ta_approvals 
           SET status = 'REJECTED', 
               claim_amount = 0, 
               ta_percentage = NULL, 
               remarks = ?
           WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)`,
            [disallowRemark, staff.id, dStr, dStr, altDateStr]
          );
          await run(
            `UPDATE ta_entries 
           SET ta_b1 = '', 
               days_claiming_ta = NULL, 
               remarks = ?
           WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)`,
            [disallowRemark, staff.id, dStr, dStr, altDateStr]
          );
          await syncDocumentsAndEarningsForStaffDate(staff.id, dStr, { dutyText: '', isLeaveOrRest: true, remarks: effectiveReason });

          // 3. If replacement staff selected, assign them to originalLink
          if (replacement_staff_id) {
            const subStaff = await get('SELECT * FROM staff WHERE id = ?', [replacement_staff_id]);
            if (subStaff) {
              const subCat = await get('SELECT * FROM categories WHERE id = ?', [subStaff.category_id]);
              const subOrigLink = getBaseLinkNumber(subStaff.row_position, getDayOffset(subCat.anchor_date, dStr), subCat.cycle_length);
              const effectiveSlotLink = (datesToProcess.length === 1 && data.target_link ? parseInt(data.target_link, 10) : null) ||
                (datesToProcess.length === 1 && data.link_number ? parseInt(data.link_number, 10) : null) ||
                (existingOverride && existingOverride.overridden_link_number ? parseInt(existingOverride.overridden_link_number, 10) : null) ||
                originalLink;
              const isUpgrade = replacement_type === 'UPGRADE_SLEEPER' || staff.category_id === 1 || target_category_id === 1;
              const subReason = isUpgrade
                ? `Upgraded to COR Link ${effectiveSlotLink} in place of ${staff.name}`
                : `Substitute for ${staff.name} on Link ${effectiveSlotLink}`;

              // Clear any previous substitute assignment for this staff on another slot on the same date
              await run(
                `UPDATE overrides SET substitute_staff_id = NULL, substitute_name = NULL WHERE substitute_staff_id = ? AND staff_id != ? AND date = ?`,
                [subStaff.id, staff.id, dStr]
              );

              await run(
                `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id, leave_type, is_extra, extra_train_no, is_advance_duty, advance_train_no)
               VALUES (?, ?, ?, ?, 'SUBSTITUTE', ?, ?, ?, ?, NULL, 0, NULL, 0, NULL)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 overridden_link_number = excluded.overridden_link_number,
                 status = excluded.status,
                 substitute_staff_id = excluded.substitute_staff_id,
                 substitute_name = excluded.substitute_name,
                 reason = excluded.reason,
                 target_category_id = excluded.target_category_id,
                 leave_type = NULL,
                 is_extra = 0,
                 extra_train_no = NULL,
                 is_advance_duty = 0,
                 advance_train_no = NULL`,
                [
                  subStaff.id,
                  dStr,
                  subOrigLink,
                  effectiveSlotLink,
                  staff.id,
                  staff.name,
                  subReason,
                  isUpgrade ? 1 : (target_category_id || staff.category_id)
                ]
              );

              await run(
                `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
               VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 code = 'P',
                 remarks = excluded.remarks,
                 updated_by = excluded.updated_by,
                 updated_at = CURRENT_TIMESTAMP`,
                [subStaff.id, dStr, isUpgrade ? `Upgraded to COR Link #${effectiveSlotLink} (Sub for ${staff.name})` : `Working as substitute for ${staff.name}`]
              );

              // Regenerate TA claims for substitute
              await run(
                `DELETE FROM ta_approvals WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?) AND (status = 'PENDING' OR remarks LIKE 'Disallowed%')`,
                [subStaff.id, dStr, dStr, altDateStr]
              );
              const subY = parseInt(dateParts[0], 10);
              const subM = parseInt(dateParts[1], 10);
              try {
                const { generatePendingTaClaimsForMonth } = require('./ta_generator');
                await generatePendingTaClaimsForMonth({ run, get, all }, subY, subM, subStaff.id);
              } catch (err) { }

              if (subStaff.category_id === 4) {
                const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                const dObj = new Date(dStr + 'T12:00:00');
                const dayOfWeek = dayNames[dObj.getDay()];
                const resolvedSubDuty = await resolveDutyCodeForLRStaff(subStaff.id, dStr, dayOfWeek, subStaff.rest_day);
                if (resolvedSubDuty && resolvedSubDuty.code) {
                  await syncLRSheetRecord(subStaff.id, dStr, resolvedSubDuty.code, subReason);
                }
              }
              await syncDocumentsAndEarningsForStaffDate(subStaff.id, dStr, { dutyText: `L-${effectiveSlotLink}`, isLeaveOrRest: false, remarks: subReason });
            }
          }
        }

        const dateRangeStr = datesToProcess.length > 1 ? `${datesToProcess[0]} to ${datesToProcess[datesToProcess.length - 1]}` : date;
        const undoData = {
          action: 'MARK_LATER',
          staff_id,
          staff_name: staff.name,
          dates: datesToProcess,
          replacement_staff_id: replacement_staff_id || null,
          snapshots: undoSnapshots
        };
        await logAudit(
          'Admin',
          'STAFF_MARK_LATER',
          `Deleted ${staff.name} from duty slot on ${dateRangeStr}. Reason marked later and muster kept blank. Replacement: ${finalSubstituteName || 'None'}.`,
          undoData
        );

        return ({
          success: true,
          message: `Deleted ${staff.name} from duty slot on ${dateRangeStr}! Muster record kept blank to fill later.${finalSubstituteName ? ` Replaced by ${finalSubstituteName}.` : ' Slot left vacant.'}`
        });
      }

      if (action === 'SICK' || action === 'LEAVE' || action === 'CR' || action === 'ABSENT' || action === 'REST') {
        let finalSubstituteName = replacement_name;
        if (!finalSubstituteName && replacement_staff_id) {
          const subStaffObj = await get('SELECT name FROM staff WHERE id = ?', [replacement_staff_id]);
          finalSubstituteName = subStaffObj ? subStaffObj.name : null;
        }

        // Determine leave type and muster code
        let effectiveLeaveType = leave_type;
        if (action === 'LEAVE') {
          effectiveLeaveType = leave_type || 'CL';
        } else if (action === 'SICK') {
          effectiveLeaveType = leave_type || 'LHAP';
        } else if (action === 'CR') {
          effectiveLeaveType = 'CR';
        } else if (action === 'ABSENT') {
          effectiveLeaveType = 'ABSENT';
        } else if (action === 'REST') {
          effectiveLeaveType = leave_type || 'REST';
        }

        let musterCode = effectiveLeaveType.toUpperCase();
        if (action === 'ABSENT') {
          musterCode = 'O';
        } else if (action === 'REST' || effectiveLeaveType === 'REST' || effectiveLeaveType === 'R') {
          musterCode = 'R';
        } else if (!ALLOWED_MUSTER_CODES.includes(musterCode)) {
          musterCode = action === 'LEAVE' ? 'CL' : (action === 'SICK' ? 'LHAP' : 'CR');
        }

        const undoSnapshots = [];

        for (const dStr of datesToProcess) {
          const dayOffset = getDayOffset(category.anchor_date, dStr);
          const originalLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);

          // Determine day-specific leave type and reason
          let dayLeaveType = effectiveLeaveType;
          let dayReason = reason;
          let dayAction = action;

          if (day_wise_leaves) {
            let dayConfig = null;
            if (Array.isArray(day_wise_leaves)) {
              dayConfig = day_wise_leaves.find(item => item && item.date === dStr);
            } else if (typeof day_wise_leaves === 'object') {
              dayConfig = day_wise_leaves[dStr];
            }

            if (dayConfig) {
              if (typeof dayConfig === 'string') {
                dayLeaveType = dayConfig.toUpperCase();
              } else if (typeof dayConfig === 'object') {
                if (dayConfig.leave_type) dayLeaveType = dayConfig.leave_type.toUpperCase();
                if (dayConfig.reason) dayReason = dayConfig.reason;
              }
            }
          }

          if (action === 'LEAVE' && dayLeaveType === 'CR') {
            dayAction = 'CR';
          } else if (action === 'LEAVE' && (dayLeaveType === 'REST' || dayLeaveType === 'R')) {
            dayAction = 'REST';
          } else if (action === 'CR' && dayLeaveType !== 'CR') {
            dayAction = (dayLeaveType === 'REST' || dayLeaveType === 'R') ? 'REST' : 'LEAVE';
          } else if (action === 'REST' && (dayLeaveType !== 'REST' && dayLeaveType !== 'R')) {
            dayAction = dayLeaveType === 'CR' ? 'CR' : 'LEAVE';
          }

          let dayMusterCode = dayLeaveType.toUpperCase();
          if (dayAction === 'ABSENT') {
            dayMusterCode = 'O';
          } else if (dayAction === 'REST' || dayLeaveType === 'REST' || dayLeaveType === 'R') {
            dayMusterCode = 'R';
          } else if (!ALLOWED_MUSTER_CODES.includes(dayMusterCode)) {
            dayMusterCode = dayAction === 'LEAVE' ? 'CL' : (dayAction === 'SICK' ? 'LHAP' : 'CR');
          }

          const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          let existingSubOverride = null;
          let existingSubMuster = null;
          if (replacement_staff_id) {
            existingSubOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [replacement_staff_id, dStr]);
            existingSubMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [replacement_staff_id, dStr]);
          }
          undoSnapshots.push({
            date: dStr,
            override: existingOverride || null,
            muster: existingMuster || null,
            subOverride: existingSubOverride || null,
            subMuster: existingSubMuster || null
          });

          // 1. Mark main staff member
          await run(
            `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id, leave_type)
           VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             overridden_link_number = NULL,
             status = excluded.status,
             substitute_staff_id = excluded.substitute_staff_id,
             substitute_name = excluded.substitute_name,
             reason = excluded.reason,
             target_category_id = excluded.target_category_id,
             leave_type = excluded.leave_type`,
            [
              staff_id,
              dStr,
              originalLink,
              dayAction,
              replacement_staff_id || null,
              finalSubstituteName || null,
              dayReason || `${dayAction} - ${dayLeaveType}`,
              staff.category_id,
              dayLeaveType
            ]
          );

          // 2. Automatically sync with muster_records table
          const musterRemarks = `${dayAction} [${dayLeaveType}]${finalSubstituteName ? ` - Sub: ${finalSubstituteName}` : ''}${dayReason ? ` (${dayReason})` : ''}`;
          await run(
            `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
           VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             code = excluded.code,
             remarks = excluded.remarks,
             updated_by = excluded.updated_by,
             updated_at = CURRENT_TIMESTAMP`,
            [staff_id, dStr, dayMusterCode, musterRemarks]
          );

          // Sync main staff with LR sheet if staff is in Category 4
          if (staff.category_id === 4) {
            const lrMusterCode = dayMusterCode === 'SICK' ? 'S' : dayMusterCode;
            await syncLRSheetRecord(staff.id, dStr, lrMusterCode, dayReason || `${dayAction} - ${dayLeaveType}`);
          }

          // Synchronize TA approvals for main staff on leave/sick/rest
          const dateParts = dStr.split('-');
          const altDateStr = dateParts.length === 3 ? `${parseInt(dateParts[2], 10)}/${parseInt(dateParts[1], 10)}/${dateParts[0].slice(-2)}` : dStr;
          const disallowRemark = `Disallowed: On Leave/Absent as per Daily Duty (${dayMusterCode})`;
          await run(
            `UPDATE ta_approvals 
           SET status = 'REJECTED', 
               claim_amount = 0, 
               ta_percentage = NULL, 
               remarks = ?
           WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)`,
            [disallowRemark, staff.id, dStr, dStr, altDateStr]
          );
          await run(
            `UPDATE ta_entries 
           SET ta_b1 = '', 
               days_claiming_ta = NULL, 
               remarks = ?
           WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)`,
            [disallowRemark, staff.id, dStr, dStr, altDateStr]
          );
          await syncDocumentsAndEarningsForStaffDate(staff.id, dStr, { dutyText: dayMusterCode, isLeaveOrRest: true, remarks: musterRemarks });

          // If replacement is an existing staff member in another column or LR pool
          if (replacement_staff_id) {
            const subStaff = await get('SELECT * FROM staff WHERE id = ?', [replacement_staff_id]);
            if (subStaff) {
              const subCat = await get('SELECT * FROM categories WHERE id = ?', [subStaff.category_id]);
              const subOrigLink = getBaseLinkNumber(subStaff.row_position, getDayOffset(subCat.anchor_date, dStr), subCat.cycle_length);
              const effectiveSlotLink = (datesToProcess.length === 1 && data.target_link ? parseInt(data.target_link, 10) : null) ||
                (datesToProcess.length === 1 && data.link_number ? parseInt(data.link_number, 10) : null) ||
                (existingOverride && existingOverride.overridden_link_number ? parseInt(existingOverride.overridden_link_number, 10) : null) ||
                originalLink;
              const isUpgrade = replacement_type === 'UPGRADE_SLEEPER' || staff.category_id === 1 || target_category_id === 1;
              const subReason = isUpgrade
                ? `Upgraded to COR Link ${effectiveSlotLink} in place of ${staff.name} (${dayLeaveType})`
                : `Substitute for ${staff.name} (${dayLeaveType}) on Link ${effectiveSlotLink}`;

              // Clear any previous substitute assignment for this staff on another slot on the same date
              await run(
                `UPDATE overrides SET substitute_staff_id = NULL, substitute_name = NULL WHERE substitute_staff_id = ? AND staff_id != ? AND date = ?`,
                [subStaff.id, staff.id, dStr]
              );

              await run(
                `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id, leave_type, is_extra, extra_train_no, is_advance_duty, advance_train_no)
               VALUES (?, ?, ?, ?, 'SUBSTITUTE', ?, ?, ?, ?, NULL, 0, NULL, 0, NULL)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 overridden_link_number = excluded.overridden_link_number,
                 status = excluded.status,
                 substitute_staff_id = excluded.substitute_staff_id,
                 substitute_name = excluded.substitute_name,
                 reason = excluded.reason,
                 target_category_id = excluded.target_category_id,
                 leave_type = NULL,
                 is_extra = 0,
                 extra_train_no = NULL,
                 is_advance_duty = 0,
                 advance_train_no = NULL`,
                [
                  subStaff.id,
                  dStr,
                  subOrigLink,
                  effectiveSlotLink,
                  staff.id,
                  staff.name,
                  subReason,
                  isUpgrade ? 1 : (target_category_id || staff.category_id)
                ]
              );

              // Substitute is working duty on this date: record 'P' in muster roll
              await run(
                `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
               VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 code = 'P',
                 remarks = excluded.remarks,
                 updated_by = excluded.updated_by,
                 updated_at = CURRENT_TIMESTAMP`,
                [subStaff.id, dStr, isUpgrade ? `Upgraded to COR Link #${effectiveSlotLink} (Sub for ${staff.name})` : `Working as substitute for ${staff.name}`]
              );

              // Regenerate TA claims for substitute
              await run(
                `DELETE FROM ta_approvals WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?) AND (status = 'PENDING' OR remarks LIKE 'Disallowed%')`,
                [subStaff.id, dStr, dStr, altDateStr]
              );
              const subY = parseInt(dateParts[0], 10);
              const subM = parseInt(dateParts[1], 10);
              try {
                const { generatePendingTaClaimsForMonth } = require('./ta_generator');
                await generatePendingTaClaimsForMonth({ run, get, all }, subY, subM, subStaff.id);
              } catch (err) { }
              await syncDocumentsAndEarningsForStaffDate(subStaff.id, dStr, { dutyText: `L-${effectiveSlotLink}`, isLeaveOrRest: false, remarks: subReason });

              // Sync substitute with LR sheet if substitute is in Category 4
              if (subStaff.category_id === 4) {
                const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                const dObj = new Date(dStr + 'T12:00:00');
                const dayOfWeek = dayNames[dObj.getDay()];
                const resolvedSubDuty = await resolveDutyCodeForLRStaff(subStaff.id, dStr, dayOfWeek, subStaff.rest_day);
                if (resolvedSubDuty && resolvedSubDuty.code) {
                  await syncLRSheetRecord(subStaff.id, dStr, resolvedSubDuty.code, subReason);
                }

                // If original link is part of a multi-day link set, automatically book LR substitute for the entire link!
                if (datesToProcess.length === 1) {
                  const subLinkSet = getLinkSetDetails(staff.category_id, originalLink);
                  if (subLinkSet && subLinkSet.remainingLinks && subLinkSet.remainingLinks.length > 0) {
                    for (let k = 0; k < subLinkSet.remainingLinks.length; k++) {
                      const remLinkNum = subLinkSet.remainingLinks[k];
                      const nextDate = new Date(dStr + 'T12:00:00');
                      nextDate.setDate(nextDate.getDate() + k + 1);
                      const y = nextDate.getFullYear();
                      const m = String(nextDate.getMonth() + 1).padStart(2, '0');
                      const d = String(nextDate.getDate()).padStart(2, '0');
                      const nextDateStr = `${y}-${m}-${d}`;

                      const subLegReason = `Substitute for ${staff.name} on Link #${remLinkNum} (Day ${subLinkSet.dayIndexInSet + k + 1} of ${subLinkSet.setLength}-day link set)`;

                      await run(
                        `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
                       VALUES (?, ?, NULL, ?, 'SUBSTITUTE', ?, ?, ?, ?)
                       ON CONFLICT(staff_id, date) DO UPDATE SET
                         overridden_link_number = excluded.overridden_link_number,
                         status = excluded.status,
                         substitute_staff_id = excluded.substitute_staff_id,
                         substitute_name = excluded.substitute_name,
                         reason = excluded.reason,
                         target_category_id = excluded.target_category_id`,
                        [subStaff.id, nextDateStr, remLinkNum, staff.id, staff.name, subLegReason, target_category_id || staff.category_id]
                      );

                      await run(
                        `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
                       VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
                       ON CONFLICT(staff_id, date) DO UPDATE SET
                         code = 'P',
                         remarks = excluded.remarks,
                         updated_by = excluded.updated_by,
                         updated_at = CURRENT_TIMESTAMP`,
                        [subStaff.id, nextDateStr, `Working as substitute for ${staff.name} on Link #${remLinkNum}`]
                      );

                      const nextDObj = new Date(nextDateStr + 'T12:00:00');
                      const nextDayOfWeek = dayNames[nextDObj.getDay()];
                      const resolvedNextDuty = await resolveDutyCodeForLRStaff(subStaff.id, nextDateStr, nextDayOfWeek, subStaff.rest_day);
                      if (resolvedNextDuty && resolvedNextDuty.code) {
                        await syncLRSheetRecord(subStaff.id, nextDateStr, resolvedNextDuty.code, subLegReason);
                      }
                      await syncDocumentsAndEarningsForStaffDate(subStaff.id, nextDateStr, { dutyText: `L-${remLinkNum}`, isLeaveOrRest: false, remarks: subLegReason });
                    }
                  }
                }
              }
            }
          }
        }

        // Multi-Day Link Leave/Sick Automation:
        // If employee takes leave or sick on Day 1 (or Days 1..M) of an N-day link set (where M < N),
        // they did not travel outstation on Day 1, so they remain physically present at HQ (GNT).
        // For any remaining days of the link set:
        // - Main staff is automatically marked AVAILABLE_FOR_BOOKING at HQ (Muster: 'P').
        // - The scheduled link slot on that day is vacated for relief allotment ([UNMANNED / VACANT] with Assign Staff button).
        // - If a substitute was assigned, the substitute works the train for the return legs as well.
        let multiDaySetNotice = '';
        if (action === 'LEAVE' || action === 'SICK' || action === 'CR' || action === 'REST') {
          const firstDate = datesToProcess[0];
          const lastDate = datesToProcess[datesToProcess.length - 1];
          const firstDayOffset = getDayOffset(category.anchor_date, firstDate);
          const firstOriginalLink = getBaseLinkNumber(staff.row_position, firstDayOffset, category.cycle_length);
          const linkSet = getLinkSetDetails(staff.category_id, firstOriginalLink);

          if (linkSet && linkSet.setLinks) {
            const startIndex = linkSet.setLinks.indexOf(firstOriginalLink);
            const daysCovered = datesToProcess.length;
            const remainingSetLinks = linkSet.setLinks.slice(startIndex + daysCovered);

            if (remainingSetLinks.length > 0) {
              multiDaySetNotice = ` Multi-Day Link detected (${linkSet.setLength}-day link #${firstOriginalLink}): On the remaining ${remainingSetLinks.length} day(s), staff is marked Available for Booking at HQ [Muster: P], and Link #${remainingSetLinks.join(', #')} vacated for relief allotment.`;

              for (let k = 0; k < remainingSetLinks.length; k++) {
                const remLink = remainingSetLinks[k];
                const nextDate = new Date(lastDate + 'T12:00:00');
                nextDate.setDate(nextDate.getDate() + k + 1);
                const y = nextDate.getFullYear();
                const m = String(nextDate.getMonth() + 1).padStart(2, '0');
                const d = String(nextDate.getDate()).padStart(2, '0');
                const remDateStr = `${y}-${m}-${d}`;

                // Record snapshot for undo
                const existingSubDayOv = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, remDateStr]);
                const existingSubDayMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, remDateStr]);
                let existingSubDaySubOv = null;
                let existingSubDaySubMuster = null;
                if (replacement_staff_id) {
                  existingSubDaySubOv = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [replacement_staff_id, remDateStr]);
                  existingSubDaySubMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [replacement_staff_id, remDateStr]);
                }
                undoSnapshots.push({
                  date: remDateStr,
                  override: existingSubDayOv || null,
                  muster: existingSubDayMuster || null,
                  subOverride: existingSubDaySubOv || null,
                  subMuster: existingSubDaySubMuster || null
                });

                // 1. Mark main staff as AVAILABLE_FOR_BOOKING at HQ
                await run(
                  `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
                 VALUES (?, ?, ?, NULL, 'AVAILABLE_FOR_BOOKING', ?, ?, ?, ?)
                 ON CONFLICT(staff_id, date) DO UPDATE SET
                   overridden_link_number = NULL,
                   status = 'AVAILABLE_FOR_BOOKING',
                   substitute_staff_id = excluded.substitute_staff_id,
                   substitute_name = excluded.substitute_name,
                   reason = excluded.reason,
                   target_category_id = excluded.target_category_id`,
                  [
                    staff_id,
                    remDateStr,
                    remLink,
                    replacement_staff_id || null,
                    finalSubstituteName || null,
                    `Available for Booking Duty at HQ (Came out of ${action} on Link #${firstOriginalLink})`,
                    staff.category_id
                  ]
                );

                // 2. Mark main staff muster as 'P' (Present at HQ)
                await run(
                  `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
                 VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
                 ON CONFLICT(staff_id, date) DO UPDATE SET
                   code = 'P',
                   remarks = excluded.remarks,
                   updated_by = excluded.updated_by,
                   updated_at = CURRENT_TIMESTAMP`,
                  [
                    staff_id,
                    remDateStr,
                    `Present at HQ (Available for booking - Came out of ${action} on Link #${firstOriginalLink})`
                  ]
                );
                await syncDocumentsAndEarningsForStaffDate(staff_id, remDateStr, { dutyText: 'AVL', isLeaveOrRest: false });

                // 3. If substitute assigned on Day 1, they work return leg as well
                if (replacement_staff_id) {
                  const subStaff = await get('SELECT * FROM staff WHERE id = ?', [replacement_staff_id]);
                  if (subStaff) {
                    const subCat = await get('SELECT * FROM categories WHERE id = ?', [subStaff.category_id]);
                    const subOrigLink = getBaseLinkNumber(subStaff.row_position, getDayOffset(subCat.anchor_date, remDateStr), subCat.cycle_length);
                    const subReason = `Substitute for ${staff.name} on return Link #${remLink}`;

                    await run(
                      `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
                     VALUES (?, ?, ?, ?, 'SUBSTITUTE', ?, ?, ?, ?)
                     ON CONFLICT(staff_id, date) DO UPDATE SET
                       overridden_link_number = excluded.overridden_link_number,
                       status = excluded.status,
                       substitute_staff_id = excluded.substitute_staff_id,
                       substitute_name = excluded.substitute_name,
                       reason = excluded.reason,
                       target_category_id = excluded.target_category_id`,
                      [
                        subStaff.id,
                        remDateStr,
                        subOrigLink,
                        remLink,
                        staff.id,
                        staff.name,
                        subReason,
                        staff.category_id
                      ]
                    );

                    await run(
                      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
                     VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
                     ON CONFLICT(staff_id, date) DO UPDATE SET
                       code = 'P',
                       remarks = excluded.remarks,
                       updated_by = excluded.updated_by,
                       updated_at = CURRENT_TIMESTAMP`,
                      [subStaff.id, remDateStr, `Working as substitute for ${staff.name} on Link #${remLink}`]
                    );
                    await syncDocumentsAndEarningsForStaffDate(subStaff.id, remDateStr, { dutyText: `L-${remLink}`, isLeaveOrRest: false, remarks: subReason });
                  }
                }
              }
            }
          }
        }

        let dayWiseSummary = '';
        if (day_wise_leaves && datesToProcess.length > 1) {
          const parts = datesToProcess.map(dStr => {
            let t = effectiveLeaveType;
            if (Array.isArray(day_wise_leaves)) {
              const f = day_wise_leaves.find(x => x && x.date === dStr);
              if (f && f.leave_type) t = f.leave_type;
            } else if (typeof day_wise_leaves === 'object' && day_wise_leaves[dStr]) {
              t = typeof day_wise_leaves[dStr] === 'string' ? day_wise_leaves[dStr] : (day_wise_leaves[dStr].leave_type || t);
            }
            const dParts = dStr.split('-');
            return `${dParts[2]}/${dParts[1]}: ${t}`;
          });
          dayWiseSummary = ` (${parts.join(', ')})`;
        }

        const dateRangeStr = datesToProcess.length > 1 ? `${datesToProcess[0]} to ${datesToProcess[datesToProcess.length - 1]}` : date;
        const undoData = {
          action,
          staff_id,
          staff_name: staff.name,
          dates: datesToProcess,
          replacement_staff_id: replacement_staff_id || null,
          snapshots: undoSnapshots
        };
        await logAudit(
          'Admin',
          `STAFF_${action}`,
          `Marked ${staff.name} as ${action}${dayWiseSummary || ` (${effectiveLeaveType})`} on ${dateRangeStr}. Replacement: ${finalSubstituteName || 'None'}. Reason: ${reason || action}.${multiDaySetNotice ? ' ' + multiDaySetNotice : ''} Updated Muster Sheet.`,
          undoData
        );

        return ({
          success: true,
          message: `Updated ${staff.name} to ${action}${dayWiseSummary || ` [${effectiveLeaveType}]`} with replacement ${finalSubstituteName || 'None'}${multiDaySetNotice ? ' - ' + multiDaySetNotice : ''} and updated Muster Sheet!`
        });
      }

      if (action === 'CHANGED_LINK') {
        const targetLink = (new_link_number === '' || new_link_number === null || new_link_number === undefined) ? null : parseInt(new_link_number, 10);
        const linkStatus = targetLink === null ? 'REST' : 'CHANGED_LINK';
        const dayOffset = getDayOffset(category.anchor_date, date);
        const originalLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);

        // Resolve target_category_id (never leave as 4 for LR staff when a link is assigned)
        let resolvedTargetCat = target_category_id ? parseInt(target_category_id, 10) : null;
        if ((!resolvedTargetCat || resolvedTargetCat === 4) && targetLink !== null) {
          const preferredCat = (staff.category_id === 1) ? 1 : 2;
          const ownLink = await get('SELECT category_id FROM links WHERE category_id = ? AND link_number = ? AND (status = \'published\' OR status IS NULL OR status = \'\') AND (status != \'draft\') AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = \'published\' OR status IS NULL))', [preferredCat, targetLink]);
          if (ownLink) {
            resolvedTargetCat = preferredCat;
          } else {
            const anyLink = await get('SELECT category_id FROM links WHERE category_id != 4 AND link_number = ? AND (status = \'published\' OR status IS NULL OR status = \'\') AND (status != \'draft\') AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = \'published\' OR status IS NULL)) ORDER BY category_id DESC LIMIT 1', [targetLink]);
            if (anyLink) resolvedTargetCat = anyLink.category_id;
            else resolvedTargetCat = preferredCat;
          }
        }
        if (!resolvedTargetCat) resolvedTargetCat = (staff.category_id === 1 ? 1 : 2);

        const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, date]);
        const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, date]);

        await run(
          `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           overridden_link_number = excluded.overridden_link_number,
           status = excluded.status,
           substitute_staff_id = NULL,
           substitute_name = NULL,
           leave_type = NULL,
           is_extra = 0,
           extra_train_no = NULL,
           is_advance_duty = 0,
           advance_train_no = NULL,
           reason = excluded.reason,
           target_category_id = excluded.target_category_id`,
          [staff_id, date, originalLink, targetLink, linkStatus, reason || `Changed to Link ${targetLink === null ? 'REST' : targetLink}`, resolvedTargetCat]
        );

        // Clear any previous substitute reference for this staff on this date so their previous slot shows vacant
        await run(
          'UPDATE overrides SET substitute_staff_id = NULL, substitute_name = NULL WHERE substitute_staff_id = ? AND date = ?',
          [staff_id, date]
        );

        // If this staff is replacing an original occupant on this date, link substitute_staff_id on the original occupant's override row
        if (data.replaced_staff_id && parseInt(data.replaced_staff_id, 10) !== parseInt(staff_id, 10) && targetLink !== null) {
          await run(
            'UPDATE overrides SET substitute_staff_id = ?, substitute_name = ? WHERE staff_id = ? AND date = ?',
            [staff.id, staff.name, parseInt(data.replaced_staff_id, 10), date]
          );
        }

        // Keep non_daily_trains template table clean
        await run(
          'UPDATE non_daily_trains SET assigned_staff_id = NULL, assigned_staff_name = NULL WHERE assigned_staff_id = ?',
          [staff_id]
        );

        // Check if Day 1 was a scheduled REST day
        const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        const dObj = new Date(date + 'T12:00:00');
        const dayOfWeek = dayNames[dObj.getDay()];
        let isDay1Rest = false;
        if (staff.rest_day && staff.rest_day.toUpperCase() === dayOfWeek) isDay1Rest = true;
        if (staff.category_id !== 4) {
          const origLinkDef = await getActiveLinkDef(staff.category_id, originalLink, date);
          if (originalLink === null || (origLinkDef && origLinkDef.is_rest === 1)) isDay1Rest = true;
        }
        const day1RestRemark = (isDay1Rest && targetLink !== null) ? ` - Rest day worked (CR credited for ${formatDateDisplay(date)})` : '';
        const baseRemark = reason || (targetLink === null ? 'Assigned Rest Day' : `Assigned Link #${targetLink}`);
        const musterRemark = baseRemark + day1RestRemark;

        // Sync with muster records: P for duty, R for rest
        const musterCode = targetLink === null ? 'R' : 'P';
        await run(
          `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
         VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           code = excluded.code,
           remarks = excluded.remarks,
           updated_by = excluded.updated_by,
           updated_at = CURRENT_TIMESTAMP`,
          [staff_id, date, musterCode, musterRemark]
        );

        // Sync with Leave Reserve (LR) sheet if staff is Category 4
        if (staff.category_id === 4) {
          const resolvedDuty = await resolveDutyCodeForLRStaff(staff.id, date, dayOfWeek, staff.rest_day);
          if (resolvedDuty && resolvedDuty.code) {
            await syncLRSheetRecord(staff.id, date, resolvedDuty.code, musterRemark);
          } else if (targetLink === null) {
            await syncLRSheetRecord(staff.id, date, 'R', reason || 'Assigned Rest Day');
          }
        }

        // Sync Day 1 across TA, NDA, Diary, and Daily Earnings
        await syncDutyChangeAcrossAllModules({ get, all, run }, staff.id, date, {
          targetLink,
          targetCat: resolvedTargetCat,
          isLeave: false,
          isRest: targetLink === null,
          remarks: musterRemark
        });

        // Multi-Day Link Set Assignment for ALL staff (Categories 1, 2, 3, 4):
        // If assigned to a multi-day link set (2-day, 3-day, or 4-day link), assign to entire beat!
        if (targetLink !== null) {
          const linkSet = getLinkSetDetails(resolvedTargetCat, targetLink);
          if (linkSet && linkSet.remainingLinks && linkSet.remainingLinks.length > 0) {
            for (let k = 0; k < linkSet.remainingLinks.length; k++) {
              const remLinkNum = linkSet.remainingLinks[k];
              const nextDate = new Date(date + 'T12:00:00');
              nextDate.setDate(nextDate.getDate() + k + 1);
              const y = nextDate.getFullYear();
              const m = String(nextDate.getMonth() + 1).padStart(2, '0');
              const d = String(nextDate.getDate()).padStart(2, '0');
              const nextDateStr = `${y}-${m}-${d}`;

              // Check if this date was a scheduled REST day for this staff member
              let isNextDayRest = false;
              const nextDObj = new Date(nextDateStr + 'T12:00:00');
              const nextDayOfWeek = dayNames[nextDObj.getDay()];
              if (staff.rest_day && staff.rest_day.toUpperCase() === nextDayOfWeek) isNextDayRest = true;
              if (staff.category_id !== 4) {
                const nextDayOffset = getDayOffset(category.anchor_date, nextDateStr);
                const nextOrigLink = getBaseLinkNumber(staff.row_position, nextDayOffset, category.cycle_length);
                const nextLinkDef = await getActiveLinkDef(staff.category_id, nextOrigLink, nextDateStr);
                if (nextOrigLink === null || (nextLinkDef && nextLinkDef.is_rest === 1)) isNextDayRest = true;
              }

              const restRemark = isNextDayRest ? ` - Rest day worked (CR credited for ${formatDateDisplay(nextDateStr)})` : '';
              const nextReason = `Assigned Link #${remLinkNum} (Day ${k + 2} of Link #${targetLink})${restRemark}`;

              await run(
                `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
               VALUES (?, ?, NULL, ?, 'CHANGED_LINK', NULL, NULL, ?, ?)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 overridden_link_number = excluded.overridden_link_number,
                 status = 'CHANGED_LINK',
                 reason = excluded.reason,
                 target_category_id = excluded.target_category_id`,
                [staff.id, nextDateStr, remLinkNum, nextReason, resolvedTargetCat]
              );

              await run(
                `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
               VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 code = 'P',
                 remarks = excluded.remarks,
                 updated_by = excluded.updated_by,
                 updated_at = CURRENT_TIMESTAMP`,
                [staff.id, nextDateStr, nextReason]
              );

              // If staff is LR, sync with LR sheet
              if (staff.category_id === 4) {
                const resolvedNextDuty = await resolveDutyCodeForLRStaff(staff.id, nextDateStr, nextDayOfWeek, staff.rest_day);
                if (resolvedNextDuty && resolvedNextDuty.code) {
                  await syncLRSheetRecord(staff.id, nextDateStr, resolvedNextDuty.code, nextReason);
                }
              }

              // Sync across all modules (TA, NDA, Diary)
              await syncDutyChangeAcrossAllModules({ get, all, run }, staff.id, nextDateStr, {
                targetLink: remLinkNum,
                targetCat: resolvedTargetCat,
                isLeave: false
              });
            }
          }
        }

        const undoData = {
          action: 'CHANGED_LINK',
          staff_id,
          staff_name: staff.name,
          date,
          previous_override: existingOverride || null,
          previous_muster: existingMuster || null
        };

        await logAudit(
          'Admin',
          'CHANGED_LINK',
          `Changed link for ${staff.name} on ${date} from Link ${originalLink} to ${targetLink === null ? 'REST' : `Link ${targetLink}`} (Category ${resolvedTargetCat}). Reason: ${reason}`,
          undoData
        );

        return ({ success: true, message: `Changed link for ${staff.name} to ${targetLink === null ? 'REST' : `Link ${targetLink}`} and updated Muster Sheet` });
      }

      if (action === 'AVAILABLE_FOR_BOOKING' || action === 'REPORTED_FIT' || action === 'MARK_AVAILABLE' || action === 'REMOVE_FROM_LINK' || action === 'REMOVE') {
        const dayOffset = getDayOffset(category.anchor_date, date);
        const originalLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);
        const isReportedFit = action === 'REPORTED_FIT' || (reason && /sick|fit/i.test(reason));
        const finalReason = reason || (isReportedFit
          ? 'Reported fit / came out of sick leave; spare at HQ GNT available for duty booking'
          : (action === 'AVAILABLE_FOR_BOOKING' ? 'Available for Booking Duty at HQ GNT' : `Removed from Link #${originalLink} - Available for other duty / booking`));

        const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, date]);
        const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, date]);

        await run(
          `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
         VALUES (?, ?, ?, NULL, 'AVAILABLE_FOR_BOOKING', NULL, NULL, ?, ?)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           overridden_link_number = NULL,
           status = 'AVAILABLE_FOR_BOOKING',
           substitute_staff_id = NULL,
           substitute_name = NULL,
           reason = excluded.reason,
           target_category_id = excluded.target_category_id`,
          [staff_id, date, originalLink, finalReason, staff.category_id]
        );

        // In muster records, they are on duty at HQ available for booking
        await run(
          `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
         VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           code = 'P',
           remarks = excluded.remarks,
           updated_by = excluded.updated_by,
           updated_at = CURRENT_TIMESTAMP`,
          [staff_id, date, finalReason]
        );

        // If Category 4 (LR), update LR sheet
        if (staff.category_id === 4) {
          await syncLRSheetRecord(staff.id, date, 'SPARE', reason || 'Available for other duty');
        }

        await syncDocumentsAndEarningsForStaffDate(staff.id, date, { dutyText: 'AVL', isLeaveOrRest: false, remarks: finalReason });

        const undoData = {
          action,
          staff_id,
          staff_name: staff.name,
          date,
          original_link: originalLink,
          previous_override: existingOverride || null,
          previous_muster: existingMuster || null
        };

        await logAudit(
          'Admin',
          'REMOVE_FROM_LINK',
          `Removed ${staff.name} from Link #${originalLink} on ${date}. Marked Available for Booking at HQ. Reason: ${reason || 'Available for other duty'}`,
          undoData
        );

        return ({
          success: true,
          message: `${staff.name} has been removed from Link #${originalLink} on ${date} and is now Available for Booking at HQ!`
        });
      }

      // UPGRADE_TO_COR: Upgrade Staff to Conductor (COR / Category 1)
      if (action === 'UPGRADE_TO_COR' || action === 'UPGRADE_COR') {
        const targetCorLink = data.target_cor_link !== undefined && data.target_cor_link !== null && data.target_cor_link !== ''
          ? parseInt(data.target_cor_link, 10)
          : (new_link_number ? parseInt(new_link_number, 10) : 1);
        const trainInfo = data.cor_train_info || '';
        const undoSnapshots = [];

        for (const dStr of datesToProcess) {
          const dayOffset = getDayOffset(category.anchor_date, dStr);
          const originalLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);

          const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          let subOverride = null;
          let subMuster = null;

          if (replacement_staff_id) {
            subOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [replacement_staff_id, dStr]);
            subMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [replacement_staff_id, dStr]);
          }

          undoSnapshots.push({
            date: dStr,
            original_link: originalLink,
            target_cor_link: targetCorLink,
            override: existingOverride || null,
            muster: existingMuster || null,
            subOverride,
            subMuster
          });

          // 1. Assign upgraded staff to COR link with status 'SUBSTITUTE' and target_category_id = 1
          await run(
            `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
           VALUES (?, ?, ?, ?, 'SUBSTITUTE', NULL, NULL, ?, 1)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             overridden_link_number = excluded.overridden_link_number,
             status = 'SUBSTITUTE',
             substitute_staff_id = NULL,
             substitute_name = NULL,
             reason = excluded.reason,
             target_category_id = 1`,
            [staff_id, dStr, originalLink, targetCorLink, reason || `Upgraded to COR on Link #${targetCorLink}${trainInfo ? ` (${trainInfo})` : ''}`]
          );

          // Muster record: P for working duty
          await run(
            `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
           VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             code = 'P',
             remarks = excluded.remarks,
             updated_by = excluded.updated_by,
             updated_at = CURRENT_TIMESTAMP`,
            [staff_id, dStr, `Upgraded to COR Link #${targetCorLink}`]
          );

          // 2. If replacement employee selected to take their original slot, assign them
          if (replacement_staff_id) {
            const subStaff = await get('SELECT * FROM staff WHERE id = ?', [replacement_staff_id]);
            if (subStaff) {
              const subCat = await get('SELECT * FROM categories WHERE id = ?', [subStaff.category_id]);
              const subOrigLink = getBaseLinkNumber(subStaff.row_position, getDayOffset(subCat.anchor_date, dStr), subCat.cycle_length);
              const slotReason = `Assigned to Link #${originalLink} (Substitute for upgraded staff ${staff.name})`;

              await run(
                `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id)
               VALUES (?, ?, ?, ?, 'CHANGED_LINK', ?, ?)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 overridden_link_number = excluded.overridden_link_number,
                 status = 'CHANGED_LINK',
                 reason = excluded.reason,
                 target_category_id = excluded.target_category_id`,
                [subStaff.id, dStr, subOrigLink, originalLink, slotReason, staff.category_id]
              );

              await run(
                `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
               VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 code = 'P',
                 remarks = excluded.remarks,
                 updated_by = excluded.updated_by,
                 updated_at = CURRENT_TIMESTAMP`,
                [subStaff.id, dStr, `Working Link #${originalLink} (Sub for ${staff.name})`]
              );

              if (subStaff.category_id === 4) {
                const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                const dObj = new Date(dStr + 'T12:00:00');
                const dayOfWeek = dayNames[dObj.getDay()];
                const resolvedSubDuty = await resolveDutyCodeForLRStaff(subStaff.id, dStr, dayOfWeek, subStaff.rest_day);
                if (resolvedSubDuty && resolvedSubDuty.code) {
                  await syncLRSheetRecord(subStaff.id, dStr, resolvedSubDuty.code, `Link #${originalLink}`);
                }
              }

              await syncDutyChangeAcrossAllModules({ get, all, run }, subStaff.id, dStr, {
                targetLink: originalLink,
                targetCat: staff.category_id,
                isLeave: false
              });
            }
          }

          // Sync upgraded staff across modules
          await syncDutyChangeAcrossAllModules({ get, all, run }, staff_id, dStr, {
            targetLink: targetCorLink,
            targetCat: 1,
            isLeave: false
          });
        }

        const dateRangeStr = datesToProcess.length > 1 ? `${datesToProcess[0]} to ${datesToProcess[datesToProcess.length - 1]}` : date;
        await logAudit(
          'Admin',
          'UPGRADE_TO_COR',
          `Upgraded ${staff.name} to Conductor (COR) Link #${targetCorLink} on ${dateRangeStr}. Original slot ${replacement_name ? `replaced by ${replacement_name}` : 'vacated'}.`,
          {
            action: 'UPGRADE_TO_COR',
            staff_id,
            staff_name: staff.name,
            dates: datesToProcess,
            target_cor_link: targetCorLink,
            replacement_staff_id: replacement_staff_id || null,
            snapshots: undoSnapshots
          }
        );

        return ({
          success: true,
          message: `${staff.name} successfully upgraded to Conductor (COR) on Link #${targetCorLink} for ${dateRangeStr}! ${replacement_name ? `Original slot assigned to ${replacement_name}.` : 'Original slot vacated.'}`
        });
      }

      // REASSIGN_STAFF: Reassign train link to another employee and set original staff status
      if (action === 'REASSIGN_STAFF' || action === 'REASSIGN') {
        const targetLink = data.target_link !== undefined && data.target_link !== null && data.target_link !== ''
          ? parseInt(data.target_link, 10)
          : (data.link_number ? parseInt(data.link_number, 10) : (new_link_number ? parseInt(new_link_number, 10) : null));
        const targetCatId = target_category_id ? parseInt(target_category_id, 10) : staff.category_id;
        const originalStaffAction = data.original_staff_action || 'SPARE_HQ'; // 'SPARE_HQ' | 'LEAVE' | 'REST' | 'SHIFTED'
        const repStaffId = replacement_staff_id ? parseInt(replacement_staff_id, 10) : null;
        let repStaffName = replacement_name;

        if (!repStaffId) {
          throw new ApiError(400, 'Replacement employee must be selected for link reassignment.' );
        }

        const subStaff = await get('SELECT * FROM staff WHERE id = ?', [repStaffId]);
        if (!subStaff) {
          throw new ApiError(404, 'Replacement employee not found in database.' );
        }
        if (!repStaffName) repStaffName = subStaff.name;

        const undoSnapshots = [];

        for (const dStr of datesToProcess) {
          const dayOffset = getDayOffset(category.anchor_date, dStr);
          const originalLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);

          const existingMainOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          const existingMainMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          const existingSubOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [repStaffId, dStr]);
          const existingSubMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [repStaffId, dStr]);

          undoSnapshots.push({
            date: dStr,
            mainOverride: existingMainOverride || null,
            mainMuster: existingMainMuster || null,
            subOverride: existingSubOverride || null,
            subMuster: existingSubMuster || null
          });

          // 1. Update original employee (staff_id)
          if (originalStaffAction === 'SPARE_HQ') {
            await run(
              `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id)
             VALUES (?, ?, ?, NULL, 'AVAILABLE_FOR_BOOKING', ?, ?)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               overridden_link_number = NULL,
               status = 'AVAILABLE_FOR_BOOKING',
               reason = excluded.reason`,
              [staff_id, dStr, originalLink, reason || `Available at HQ / Spare (Link #${targetLink} reassigned to ${repStaffName})`, staff.category_id]
            );
            await run(
              `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
             VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               code = 'P',
               remarks = excluded.remarks,
               updated_by = excluded.updated_by,
               updated_at = CURRENT_TIMESTAMP`,
              [staff_id, dStr, `Available at HQ / Spare (Link #${targetLink} reassigned to ${repStaffName})`]
            );
            if (staff.category_id === 4) {
              await syncLRSheetRecord(staff.id, dStr, 'P', `Available at HQ / Spare (Reassigned to ${repStaffName})`);
            }
          } else if (originalStaffAction === 'LEAVE') {
            const effectiveLeave = leave_type || 'CL';
            await run(
              `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id, leave_type)
             VALUES (?, ?, ?, NULL, 'LEAVE', ?, ?, ?, ?, ?)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               overridden_link_number = NULL,
               status = 'LEAVE',
               substitute_staff_id = excluded.substitute_staff_id,
               substitute_name = excluded.substitute_name,
               reason = excluded.reason,
               target_category_id = excluded.target_category_id,
               leave_type = excluded.leave_type`,
              [staff_id, dStr, originalLink, repStaffId, repStaffName, reason || `Leave [${effectiveLeave}] (Reassigned to ${repStaffName})`, staff.category_id, effectiveLeave]
            );
            await run(
              `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
             VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               code = excluded.code,
               remarks = excluded.remarks,
               updated_by = excluded.updated_by,
               updated_at = CURRENT_TIMESTAMP`,
              [staff_id, dStr, effectiveLeave.toUpperCase(), `Leave [${effectiveLeave}] - Sub: ${repStaffName}`]
            );
            if (staff.category_id === 4) {
              await syncLRSheetRecord(staff.id, dStr, effectiveLeave.toUpperCase(), `Leave [${effectiveLeave}] - Reassigned`);
            }
          } else if (originalStaffAction === 'REST') {
            await run(
              `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id, leave_type)
             VALUES (?, ?, ?, NULL, 'REST', ?, ?, ?, ?, 'REST')
             ON CONFLICT(staff_id, date) DO UPDATE SET
               overridden_link_number = NULL,
               status = 'REST',
               substitute_staff_id = excluded.substitute_staff_id,
               substitute_name = excluded.substitute_name,
               reason = excluded.reason,
               target_category_id = excluded.target_category_id,
               leave_type = 'REST'`,
              [staff_id, dStr, originalLink, repStaffId, repStaffName, reason || `Weekly Rest (Reassigned to ${repStaffName})`, staff.category_id]
            );
            await run(
              `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
             VALUES (?, ?, 'R', ?, 'Admin', CURRENT_TIMESTAMP)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               code = 'R',
               remarks = excluded.remarks,
               updated_by = excluded.updated_by,
               updated_at = CURRENT_TIMESTAMP`,
              [staff_id, dStr, `Weekly Rest - Reassigned to ${repStaffName}`]
            );
            if (staff.category_id === 4) {
              await syncLRSheetRecord(staff.id, dStr, 'R', `Weekly Rest - Reassigned to ${repStaffName}`);
            }
          } else if (originalStaffAction === 'SHIFTED') {
            await run(
              `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id)
             VALUES (?, ?, ?, NULL, 'SHIFTED', ?, ?)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               overridden_link_number = NULL,
               status = 'SHIFTED',
               reason = excluded.reason`,
              [staff_id, dStr, originalLink, reason || `Shifted Place (Reassigned Link #${targetLink} to ${repStaffName})`, staff.category_id]
            );
            await run(
              `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
             VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               code = 'P',
               remarks = excluded.remarks,
               updated_by = excluded.updated_by,
               updated_at = CURRENT_TIMESTAMP`,
              [staff_id, dStr, `Shifted Place (Reassigned to ${repStaffName})`]
            );
          }

          // 2. Assign replacement employee (subStaff) to targetLink
          const subCat = await get('SELECT * FROM categories WHERE id = ?', [subStaff.category_id]);
          const subOrigLink = getBaseLinkNumber(subStaff.row_position, getDayOffset(subCat.anchor_date, dStr), subCat.cycle_length);
          const subReason = reason || `Reassigned to Link #${targetLink} (Relieved ${staff.name})`;

          await run(
            `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
           VALUES (?, ?, ?, ?, 'CHANGED_LINK', ?, ?, ?, ?)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             overridden_link_number = excluded.overridden_link_number,
             status = 'CHANGED_LINK',
             substitute_staff_id = excluded.substitute_staff_id,
             substitute_name = excluded.substitute_name,
             reason = excluded.reason,
             target_category_id = excluded.target_category_id`,
            [subStaff.id, dStr, subOrigLink, targetLink, staff_id, staff.name, subReason, targetCatId]
          );

          await run(
            `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
           VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             code = 'P',
             remarks = excluded.remarks,
             updated_by = excluded.updated_by,
             updated_at = CURRENT_TIMESTAMP`,
            [subStaff.id, dStr, `Working Link #${targetLink} (Reassigned from ${staff.name})`]
          );

          if (subStaff.category_id === 4) {
            const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
            const dObj = new Date(dStr + 'T12:00:00');
            const dayOfWeek = dayNames[dObj.getDay()];
            const resolvedSubDuty = await resolveDutyCodeForLRStaff(subStaff.id, dStr, dayOfWeek, subStaff.rest_day);
            if (resolvedSubDuty && resolvedSubDuty.code) {
              await syncLRSheetRecord(subStaff.id, dStr, resolvedSubDuty.code, `Link #${targetLink}`);
            }
          }

          // Multi-Day Link Set check for targetLink:
          if (targetLink !== null) {
            const linkSet = getLinkSetDetails(targetCatId, targetLink);
            if (linkSet && linkSet.remainingLinks && linkSet.remainingLinks.length > 0) {
              for (let k = 0; k < linkSet.remainingLinks.length; k++) {
                const remLinkNum = linkSet.remainingLinks[k];
                const nextDate = new Date(dStr + 'T12:00:00');
                nextDate.setDate(nextDate.getDate() + k + 1);
                const y = nextDate.getFullYear();
                const m = String(nextDate.getMonth() + 1).padStart(2, '0');
                const d = String(nextDate.getDate()).padStart(2, '0');
                const nextDateStr = `${y}-${m}-${d}`;
                const nextReason = `Assigned Link #${remLinkNum} (Day ${k + 2} of Link #${targetLink})`;

                await run(
                  `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id)
                 VALUES (?, ?, NULL, ?, 'CHANGED_LINK', ?, ?)
                 ON CONFLICT(staff_id, date) DO UPDATE SET
                   overridden_link_number = excluded.overridden_link_number,
                   status = 'CHANGED_LINK',
                   reason = excluded.reason,
                   target_category_id = excluded.target_category_id`,
                  [subStaff.id, nextDateStr, remLinkNum, nextReason, targetCatId]
                );

                await run(
                  `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
                 VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
                 ON CONFLICT(staff_id, date) DO UPDATE SET
                   code = 'P',
                   remarks = excluded.remarks,
                   updated_by = excluded.updated_by,
                   updated_at = CURRENT_TIMESTAMP`,
                  [subStaff.id, nextDateStr, nextReason]
                );

                if (subStaff.category_id === 4) {
                  const nextDayOfWeek = getWeekday(nextDateStr);
                  const resolvedNextDuty = await resolveDutyCodeForLRStaff(subStaff.id, nextDateStr, nextDayOfWeek, subStaff.rest_day);
                  if (resolvedNextDuty && resolvedNextDuty.code) {
                    await syncLRSheetRecord(subStaff.id, nextDateStr, resolvedNextDuty.code, nextReason);
                  }
                }

                await syncDutyChangeAcrossAllModules({ get, all, run }, subStaff.id, nextDateStr, {
                  targetLink: remLinkNum,
                  targetCat: targetCatId,
                  isLeave: false
                });
              }
            }
          }

          // Sync both employees across all modules
          await syncDutyChangeAcrossAllModules({ get, all, run }, staff_id, dStr, {
            targetLink: null,
            targetCat: staff.category_id,
            isLeave: originalStaffAction === 'LEAVE'
          });
          await syncDutyChangeAcrossAllModules({ get, all, run }, subStaff.id, dStr, {
            targetLink,
            targetCat: targetCatId,
            isLeave: false
          });
        }

        const dateRangeStr = datesToProcess.length > 1 ? `${datesToProcess[0]} to ${datesToProcess[datesToProcess.length - 1]}` : date;
        await logAudit(
          'Admin',
          'REASSIGN_STAFF',
          `Reassigned Link #${targetLink} from ${staff.name} to ${repStaffName} on ${dateRangeStr}. Original staff status: ${originalStaffAction}.`,
          {
            action: 'REASSIGN_STAFF',
            staff_id,
            staff_name: staff.name,
            target_link: targetLink,
            replacement_staff_id: repStaffId,
            replacement_name: repStaffName,
            original_staff_action: originalStaffAction,
            dates: datesToProcess,
            snapshots: undoSnapshots
          }
        );

        return ({
          success: true,
          message: `Successfully reassigned Link #${targetLink} to ${repStaffName} on ${dateRangeStr}! ${staff.name} placed on ${originalStaffAction === 'SPARE_HQ' ? 'Available at HQ / Spare' : originalStaffAction}.`
        });
      }

      // UTILISED_ADVANCE: Employee utilised for advance duty out-of-turn for emergency utilisation
      if (action === 'UTILISED_ADVANCE' || action === 'ADVANCE_DUTY' || action === 'ADVANCE_BOOKED') {
        const advanceTrainNo = data.advance_train_no ? String(data.advance_train_no).trim() : '';
        const vacateNextLink = Boolean(data.vacate_next_link);
        const advanceLinkNumber = data.advance_link_number !== undefined && data.advance_link_number !== null && data.advance_link_number !== ''
          ? parseInt(data.advance_link_number, 10)
          : null;

        // 1. If assigned to an advance link today, record that assignment
        if (advanceLinkNumber !== null) {
          const dayOffset = getDayOffset(category.anchor_date, date);
          const originalLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);
          await run(
            `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
           VALUES (?, ?, ?, ?, 'CHANGED_LINK', NULL, NULL, ?, ?)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             overridden_link_number = excluded.overridden_link_number,
             status = 'CHANGED_LINK',
             reason = excluded.reason,
             target_category_id = excluded.target_category_id`,
            [staff_id, date, originalLink, advanceLinkNumber, `Assigned Advance Duty (Train ${advanceTrainNo || 'Emergency'})`, staff.category_id]
          );
          await run(
            `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
           VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             code = 'P',
             remarks = excluded.remarks,
             updated_by = excluded.updated_by,
             updated_at = CURRENT_TIMESTAMP`,
            [staff_id, date, `Advance Duty on Link #${advanceLinkNumber} (Tr. ${advanceTrainNo})`]
          );
        }

        // 2. Determine target date to vacate with UTILISED_ADVANCE (next cyclic link date or specified date)
        let targetVacateDate = date;
        if (vacateNextLink) {
          const curD = new Date(date + 'T12:00:00');
          curD.setDate(curD.getDate() + 1);
          const y = curD.getFullYear();
          const m = String(curD.getMonth() + 1).padStart(2, '0');
          const d = String(curD.getDate()).padStart(2, '0');
          targetVacateDate = `${y}-${m}-${d}`;
        }

        const vacateDayOffset = getDayOffset(category.anchor_date, targetVacateDate);
        const vacateOrigLink = getBaseLinkNumber(staff.row_position, vacateDayOffset, category.cycle_length);

        const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, targetVacateDate]);
        const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, targetVacateDate]);

        const advanceReason = reason || (advanceTrainNo ? `UTILISED ADVANCE BY TRAIN NO ${advanceTrainNo}` : 'UTILISED ADVANCE');

        await run(
          `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, advance_train_no, is_advance_duty, reason, target_category_id)
         VALUES (?, ?, ?, NULL, 'UTILISED_ADVANCE', ?, 1, ?, ?)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           overridden_link_number = NULL,
           status = 'UTILISED_ADVANCE',
           advance_train_no = excluded.advance_train_no,
           is_advance_duty = 1,
           substitute_staff_id = NULL,
           substitute_name = NULL,
           reason = excluded.reason,
           target_category_id = excluded.target_category_id`,
          [staff_id, targetVacateDate, vacateOrigLink, advanceTrainNo || null, advanceReason, staff.category_id]
        );

        // On the vacated date, muster is P (Present/On duty)
        await run(
          `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
         VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           code = 'P',
           remarks = excluded.remarks,
           updated_by = excluded.updated_by,
           updated_at = CURRENT_TIMESTAMP`,
          [staff_id, targetVacateDate, `Utilised in Advance (Tr. ${advanceTrainNo || 'Emergency'})`]
        );

        // If replacement staff is provided to cover this vacated link:
        if (replacement_staff_id) {
          const subStaff = await get('SELECT * FROM staff WHERE id = ?', [replacement_staff_id]);
          if (subStaff) {
            const subCat = await get('SELECT * FROM categories WHERE id = ?', [subStaff.category_id]);
            const subOrigLink = getBaseLinkNumber(subStaff.row_position, getDayOffset(subCat.anchor_date, targetVacateDate), subCat.cycle_length);
            const subReason = `Substitute for ${staff.name} (Advance Booked Tr. ${advanceTrainNo || ''}) on Link #${vacateOrigLink}`;

            await run(
              `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
             VALUES (?, ?, ?, ?, 'SUBSTITUTE', ?, ?, ?, ?)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               overridden_link_number = excluded.overridden_link_number,
               status = excluded.status,
               substitute_staff_id = excluded.substitute_staff_id,
               substitute_name = excluded.substitute_name,
               reason = excluded.reason,
               target_category_id = excluded.target_category_id`,
              [subStaff.id, targetVacateDate, subOrigLink, vacateOrigLink, staff.id, staff.name, subReason, staff.category_id]
            );

            await run(
              `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
             VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               code = 'P',
               remarks = excluded.remarks,
               updated_by = excluded.updated_by,
               updated_at = CURRENT_TIMESTAMP`,
              [subStaff.id, targetVacateDate, `Working as substitute for ${staff.name} on Link #${vacateOrigLink}`]
            );

            if (subStaff.category_id === 4) {
              const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
              const targetDObj = new Date(targetVacateDate + 'T12:00:00');
              const targetDayOfWeek = dayNames[targetDObj.getDay()];
              const resolvedDuty = await resolveDutyCodeForLRStaff(subStaff.id, targetVacateDate, targetDayOfWeek, subStaff.rest_day);
              if (resolvedDuty && resolvedDuty.code) {
                await syncLRSheetRecord(subStaff.id, targetVacateDate, resolvedDuty.code, subReason);
              }
            }
            await syncDutyChangeAcrossAllModules({ get, all, run }, subStaff.id, targetVacateDate, {
              targetLink: vacateOrigLink,
              isLeave: false,
              remarks: subReason
            });
          }
        }

        await syncDutyChangeAcrossAllModules({ get, all, run }, staff_id, targetVacateDate, {
          targetTrain: advanceTrainNo || null,
          targetLink: advanceLinkNumber,
          isLeave: false,
          remarks: advanceReason
        });

        const undoData = {
          action: 'UTILISED_ADVANCE',
          staff_id,
          staff_name: staff.name,
          date: targetVacateDate,
          original_link: vacateOrigLink,
          advance_train_no: advanceTrainNo,
          replacement_staff_id: replacement_staff_id || null,
          previous_override: existingOverride || null,
          previous_muster: existingMuster || null
        };

        await logAudit(
          'Admin',
          'UTILISED_ADVANCE',
          `Marked ${staff.name} as Utilised in Advance (Tr. ${advanceTrainNo || 'Emergency'}). Vacated Link #${vacateOrigLink} on ${targetVacateDate} with blinking notice.`,
          undoData
        );

        return ({
          success: true,
          message: `Marked ${staff.name} as Utilised in Advance (Tr. ${advanceTrainNo || 'Emergency'}). Link #${vacateOrigLink} on ${targetVacateDate} is now Vacant with blinking notice.`
        });
      }

      // MUTUAL_SHIFT: Mutual exchange/shift of duties/places between Staff A and Staff B across date range
      if (action === 'MUTUAL_SHIFT' || (action === 'SHIFTED' && data.shifted_mode === 'MUTUAL')) {
        const staffBId = data.staff_b_id || data.replacement_staff_id;
        if (!staffBId) {
          throw new ApiError(400, 'staff_b_id is required for mutual shift' );
        }
        if (parseInt(staff_id, 10) === parseInt(staffBId, 10)) {
          throw new ApiError(400, 'Cannot mutually shift duties with the same employee' );
        }

        const staffA = staff;
        const staffB = await get('SELECT * FROM staff WHERE id = ?', [staffBId]);
        if (!staffB) {
          throw new ApiError(404, 'Staff B not found' );
        }

        const catA = category;
        const catB = await get('SELECT * FROM categories WHERE id = ?', [staffB.category_id]);

        const datesToProcess = [];
        const fromD = new Date(date + 'T12:00:00');
        const toD = to_date ? new Date(to_date + 'T12:00:00') : new Date(date + 'T12:00:00');
        if (toD < fromD) toD.setTime(fromD.getTime());
        for (let cur = new Date(fromD); cur <= toD; cur.setDate(cur.getDate() + 1)) {
          const y = cur.getFullYear();
          const m = String(cur.getMonth() + 1).padStart(2, '0');
          const d = String(cur.getDate()).padStart(2, '0');
          datesToProcess.push(`${y}-${m}-${d}`);
        }

        for (const dStr of datesToProcess) {
          const existingOverrideA = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staffA.id, dStr]);
          const existingOverrideB = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staffB.id, dStr]);

          // Determine baseline cyclic links
          const dayOffsetA = getDayOffset(catA.anchor_date, dStr);
          const dayOffsetB = catB ? getDayOffset(catB.anchor_date, dStr) : 1;
          const origLinkA = getBaseLinkNumber(staffA.row_position, dayOffsetA, catA.cycle_length);
          const origLinkB = catB ? getBaseLinkNumber(staffB.row_position, dayOffsetB, catB.cycle_length) : 1;

          // Extract Staff A's current duty profile on dStr
          let dutyProfileA = {
            linkNum: null,
            catId: staffA.category_id,
            shiftedPlace: null,
            extraTrainNo: null,
            isExtra: 0,
            status: 'CHANGED_LINK',
            isRest: false,
            desc: ''
          };

          if (existingOverrideA) {
            dutyProfileA.linkNum = existingOverrideA.overridden_link_number;
            dutyProfileA.catId = existingOverrideA.target_category_id || staffA.category_id;
            dutyProfileA.shiftedPlace = existingOverrideA.shifted_place;
            dutyProfileA.extraTrainNo = existingOverrideA.extra_train_no;
            dutyProfileA.isExtra = existingOverrideA.is_extra || 0;
            dutyProfileA.status = existingOverrideA.status;
            if (existingOverrideA.status === 'REST' || existingOverrideA.leave_type === 'REST') {
              dutyProfileA.isRest = true;
            }
            dutyProfileA.desc = dutyProfileA.linkNum ? `Link #${dutyProfileA.linkNum}` : (dutyProfileA.extraTrainNo ? `Train ${dutyProfileA.extraTrainNo}` : (dutyProfileA.shiftedPlace || (dutyProfileA.isRest ? 'REST' : 'Duty')));
          } else {
            const linkDefA = await get('SELECT * FROM links WHERE category_id = ? AND link_number = ? AND (status = \'published\' OR status IS NULL OR status = \'\') AND (status != \'draft\') AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = \'published\' OR status IS NULL))', [staffA.category_id, origLinkA]);
            if (staffA.category_id === 4) {
              dutyProfileA.desc = 'LR Standby Pool';
              dutyProfileA.status = 'AVAILABLE_FOR_BOOKING';
            } else if (!linkDefA || linkDefA.is_rest) {
              dutyProfileA.isRest = true;
              dutyProfileA.status = 'REST';
              dutyProfileA.desc = 'Weekly REST';
            } else {
              dutyProfileA.linkNum = origLinkA;
              dutyProfileA.catId = staffA.category_id;
              dutyProfileA.status = 'CHANGED_LINK';
              dutyProfileA.desc = `Link #${origLinkA}${linkDefA.train_numbers ? ` (Tr ${linkDefA.train_numbers})` : ''}`;
            }
          }

          // Extract Staff B's current duty profile on dStr
          let dutyProfileB = {
            linkNum: null,
            catId: staffB.category_id,
            shiftedPlace: null,
            extraTrainNo: null,
            isExtra: 0,
            status: 'CHANGED_LINK',
            isRest: false,
            desc: ''
          };

          if (existingOverrideB) {
            dutyProfileB.linkNum = existingOverrideB.overridden_link_number;
            dutyProfileB.catId = existingOverrideB.target_category_id || staffB.category_id;
            dutyProfileB.shiftedPlace = existingOverrideB.shifted_place;
            dutyProfileB.extraTrainNo = existingOverrideB.extra_train_no;
            dutyProfileB.isExtra = existingOverrideB.is_extra || 0;
            dutyProfileB.status = existingOverrideB.status;
            if (existingOverrideB.status === 'REST' || existingOverrideB.leave_type === 'REST') {
              dutyProfileB.isRest = true;
            }
            dutyProfileB.desc = dutyProfileB.linkNum ? `Link #${dutyProfileB.linkNum}` : (dutyProfileB.extraTrainNo ? `Train ${dutyProfileB.extraTrainNo}` : (dutyProfileB.shiftedPlace || (dutyProfileB.isRest ? 'REST' : 'Duty')));
          } else {
            const linkDefB = catB ? await get('SELECT * FROM links WHERE category_id = ? AND link_number = ? AND (status = \'published\' OR status IS NULL OR status = \'\') AND (status != \'draft\') AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = \'published\' OR status IS NULL))', [staffB.category_id, origLinkB]) : null;

            if (staffB.category_id === 4) {
              dutyProfileB.desc = 'LR Standby Pool';
              dutyProfileB.status = 'AVAILABLE_FOR_BOOKING';
            } else if (!linkDefB || linkDefB.is_rest) {
              dutyProfileB.isRest = true;
              dutyProfileB.status = 'REST';
              dutyProfileB.desc = 'Weekly REST';
            } else {
              dutyProfileB.linkNum = origLinkB;
              dutyProfileB.catId = staffB.category_id;
              dutyProfileB.status = 'CHANGED_LINK';
              dutyProfileB.desc = `Link #${origLinkB}${linkDefB.train_numbers ? ` (Tr ${linkDefB.train_numbers})` : ''}`;
            }
          }

          // SWAP:
          // Staff A gets Duty Profile B
          const statusForA = dutyProfileB.isRest ? 'REST' : (dutyProfileB.extraTrainNo ? 'EXTRA_CREW' : (dutyProfileB.shiftedPlace ? 'SHIFTED' : (dutyProfileB.linkNum ? 'CHANGED_LINK' : 'AVAILABLE_FOR_BOOKING')));
          const reasonForA = reason ? `Mutual shift with ${staffB.name}: ${reason}` : `Mutual shift with ${staffB.name} (${dutyProfileB.desc})`;
          const effectiveOrigA = existingOverrideA?.original_link_number || origLinkA;

          await run(
            `INSERT INTO overrides (
            staff_id, date, original_link_number, overridden_link_number, status,
            substitute_staff_id, substitute_name, reason, target_category_id,
            shifted_place, extra_train_no, is_extra, shifted_from_link, shifted_from_train
          ) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             overridden_link_number = excluded.overridden_link_number,
             status = excluded.status,
             substitute_staff_id = NULL,
             substitute_name = NULL,
             reason = excluded.reason,
             target_category_id = excluded.target_category_id,
             shifted_place = excluded.shifted_place,
             extra_train_no = excluded.extra_train_no,
             is_extra = excluded.is_extra,
             shifted_from_link = COALESCE(overrides.shifted_from_link, excluded.shifted_from_link),
             shifted_from_train = COALESCE(overrides.shifted_from_train, excluded.shifted_from_train)`,
            [
              staffA.id,
              dStr,
              effectiveOrigA,
              dutyProfileB.linkNum,
              statusForA,
              reasonForA,
              dutyProfileB.catId,
              dutyProfileB.shiftedPlace,
              dutyProfileB.extraTrainNo,
              dutyProfileB.isExtra,
              origLinkA || null,
              null
            ]
          );

          // Staff B gets Duty Profile A
          const statusForB = dutyProfileA.isRest ? 'REST' : (dutyProfileA.extraTrainNo ? 'EXTRA_CREW' : (dutyProfileA.shiftedPlace ? 'SHIFTED' : (dutyProfileA.linkNum ? 'CHANGED_LINK' : 'AVAILABLE_FOR_BOOKING')));
          const reasonForB = reason ? `Mutual shift with ${staffA.name}: ${reason}` : `Mutual shift with ${staffA.name} (${dutyProfileA.desc})`;
          const effectiveOrigB = existingOverrideB?.original_link_number || origLinkB;

          await run(
            `INSERT INTO overrides (
            staff_id, date, original_link_number, overridden_link_number, status,
            substitute_staff_id, substitute_name, reason, target_category_id,
            shifted_place, extra_train_no, is_extra, shifted_from_link, shifted_from_train
          ) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             overridden_link_number = excluded.overridden_link_number,
             status = excluded.status,
             substitute_staff_id = NULL,
             substitute_name = NULL,
             reason = excluded.reason,
             target_category_id = excluded.target_category_id,
             shifted_place = excluded.shifted_place,
             extra_train_no = excluded.extra_train_no,
             is_extra = excluded.is_extra,
             shifted_from_link = COALESCE(overrides.shifted_from_link, excluded.shifted_from_link),
             shifted_from_train = COALESCE(overrides.shifted_from_train, excluded.shifted_from_train)`,
            [
              staffB.id,
              dStr,
              effectiveOrigB,
              dutyProfileA.linkNum,
              statusForB,
              reasonForB,
              dutyProfileA.catId,
              dutyProfileA.shiftedPlace,
              dutyProfileA.extraTrainNo,
              dutyProfileA.isExtra,
              origLinkB || null,
              null
            ]
          );

          // Muster updates: 'R' if REST, otherwise 'P'
          const musterCodeA = dutyProfileB.isRest ? 'R' : 'P';
          const musterCodeB = dutyProfileA.isRest ? 'R' : 'P';

          await run(
            `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
           VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             code = excluded.code,
             remarks = excluded.remarks,
             updated_by = excluded.updated_by,
             updated_at = CURRENT_TIMESTAMP`,
            [staffA.id, dStr, musterCodeA, reasonForA]
          );

          await run(
            `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
           VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             code = excluded.code,
             remarks = excluded.remarks,
             updated_by = excluded.updated_by,
             updated_at = CURRENT_TIMESTAMP`,
            [staffB.id, dStr, musterCodeB, reasonForB]
          );

          // Sync LR sheet if staffA or staffB is in Category 4
          const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
          const dObj = new Date(dStr + 'T12:00:00');
          const dayOfWeek = dayNames[dObj.getDay()];

          if (staffA.category_id === 4) {
            const resA = await resolveDutyCodeForLRStaff(staffA.id, dStr, dayOfWeek, staffA.rest_day);
            if (resA && resA.code) {
              await syncLRSheetRecord(staffA.id, dStr, resA.code, reasonForA);
            } else if (dutyProfileB.isRest) {
              await syncLRSheetRecord(staffA.id, dStr, 'R', reasonForA);
            }
          }

          if (staffB.category_id === 4) {
            const resB = await resolveDutyCodeForLRStaff(staffB.id, dStr, dayOfWeek, staffB.rest_day);
            if (resB && resB.code) {
              await syncLRSheetRecord(staffB.id, dStr, resB.code, reasonForB);
            } else if (dutyProfileA.isRest) {
              await syncLRSheetRecord(staffB.id, dStr, 'R', reasonForB);
            }
          }

          // Synchronize across TA approvals and documents for both staff
          await syncDutyChangeAcrossAllModules({ get, all, run }, staffA.id, dStr, {
            targetLink: dutyProfileB.linkNum,
            targetTrain: dutyProfileB.extraTrainNo,
            isLeave: false,
            isRest: dutyProfileB.isRest,
            remarks: reasonForA
          });
          await syncDutyChangeAcrossAllModules({ get, all, run }, staffB.id, dStr, {
            targetLink: dutyProfileA.linkNum,
            targetTrain: dutyProfileA.extraTrainNo,
            isLeave: false,
            isRest: dutyProfileA.isRest,
            remarks: reasonForB
          });
        }

        await logAudit(
          'Admin',
          'MUTUAL_SHIFT',
          `Mutual shift between ${staffA.name} and ${staffB.name} from ${date} to ${to_date || date}`,
          {
            action: 'MUTUAL_SHIFT',
            staff_id: staffA.id,
            staff_name: `${staffA.name} ↔ ${staffB.name}`,
            staff_b_id: staffB.id,
            dates: datesToProcess
          }
        );

        return ({
          success: true,
          message: `Successfully executed mutual shift of places between ${staffA.name} and ${staffB.name}`,
          staff_a: staffA.name,
          staff_b: staffB.name,
          dates: datesToProcess
        });
      }

      // SHIFTED / SHIFTED_PLACE: Shift employee away from this link slot to another place / duty / link
      if (action === 'SHIFTED' || action === 'SHIFTED_PLACE') {
        const isNonDaily = data.is_extra === 1 || data.shifted_mode === 'NON_DAILY' || Boolean(data.extra_train_no);
        const extraTrainNo = isNonDaily ? (data.extra_train_no || null) : null;
        const shiftedPlace = data.shifted_place ? String(data.shifted_place).trim() : (isNonDaily ? 'NON_DAILY_TRAIN' : '');
        const shiftedLinkNum = data.shifted_link_number !== undefined && data.shifted_link_number !== null && data.shifted_link_number !== ''
          ? parseInt(data.shifted_link_number, 10)
          : null;
        const shiftedCatId = data.shifted_category_id ? parseInt(data.shifted_category_id, 10) : staff.category_id;

        const datesToProcess = [];
        const fromD = new Date(date + 'T12:00:00');
        const toD = to_date ? new Date(to_date + 'T12:00:00') : new Date(date + 'T12:00:00');
        if (toD < fromD) toD.setTime(fromD.getTime());
        for (let cur = new Date(fromD); cur <= toD; cur.setDate(cur.getDate() + 1)) {
          const y = cur.getFullYear();
          const m = String(cur.getMonth() + 1).padStart(2, '0');
          const d = String(cur.getDate()).padStart(2, '0');
          datesToProcess.push(`${y}-${m}-${d}`);
        }

        const shiftDesc = shiftedLinkNum
          ? `Link #${shiftedLinkNum}${shiftedPlace ? ` (${shiftedPlace})` : ''}`
          : (isNonDaily && extraTrainNo ? `Non-Daily Train ${extraTrainNo}` : (shiftedPlace || 'Another Place / Duty'));
        const shiftReason = reason || `Shifted to ${shiftDesc}`;

        const undoSnapshots = [];
        for (const dStr of datesToProcess) {
          const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          let subOverride = null;
          let subMuster = null;
          if (replacement_staff_id) {
            subOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [replacement_staff_id, dStr]);
            subMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [replacement_staff_id, dStr]);
          }
          undoSnapshots.push({
            date: dStr,
            override: existingOverride || null,
            muster: existingMuster || null,
            subOverride,
            subMuster
          });

          const dayOffset = getDayOffset(category.anchor_date, dStr);
          const originalLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);

          const newStatus = shiftedLinkNum !== null ? 'CHANGED_LINK' : (isNonDaily ? 'EXTRA_CREW' : 'SHIFTED');

          await run(
            `INSERT INTO overrides (
            staff_id, date, original_link_number, overridden_link_number, status,
            substitute_staff_id, substitute_name, reason, target_category_id,
            shifted_place, extra_train_no, is_extra, shifted_from_link, shifted_from_train
          ) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             overridden_link_number = excluded.overridden_link_number,
             status = excluded.status,
             substitute_staff_id = NULL,
             substitute_name = NULL,
             reason = excluded.reason,
             target_category_id = excluded.target_category_id,
             shifted_place = excluded.shifted_place,
             extra_train_no = excluded.extra_train_no,
             is_extra = excluded.is_extra,
             shifted_from_link = COALESCE(overrides.shifted_from_link, excluded.shifted_from_link),
             shifted_from_train = COALESCE(overrides.shifted_from_train, excluded.shifted_from_train)`,
            [
              staff_id,
              dStr,
              originalLink,
              shiftedLinkNum,
              newStatus,
              shiftReason,
              shiftedCatId,
              shiftedPlace || (isNonDaily ? 'NON_DAILY_TRAIN' : null),
              extraTrainNo,
              isNonDaily ? 1 : 0,
              originalLink || null,
              null
            ]
          );

          // Muster record: P (Present on duty at the shifted place)
          await run(
            `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
           VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             code = 'P',
             remarks = excluded.remarks,
             updated_by = excluded.updated_by,
             updated_at = CURRENT_TIMESTAMP`,
            [staff_id, dStr, shiftReason]
          );

          await syncDutyChangeAcrossAllModules({ get, all, run }, staff_id, dStr, {
            targetLink: shiftedLinkNum,
            targetTrain: extraTrainNo || shiftedPlace,
            isLeave: false,
            remarks: shiftReason
          });

          // If replacement staff is provided to take over this original link slot:
          if (replacement_staff_id) {
            const subStaff = await get('SELECT * FROM staff WHERE id = ?', [replacement_staff_id]);
            if (subStaff) {
              const subCat = await get('SELECT * FROM categories WHERE id = ?', [subStaff.category_id]);
              const subOrigLink = getBaseLinkNumber(subStaff.row_position, getDayOffset(subCat.anchor_date, dStr), subCat.cycle_length);
              const subReason = `Substitute for ${staff.name} (${shiftReason}) on Link #${originalLink}`;

              await run(
                `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
               VALUES (?, ?, ?, ?, 'SUBSTITUTE', ?, ?, ?, ?)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 overridden_link_number = excluded.overridden_link_number,
                 status = excluded.status,
                 substitute_staff_id = excluded.substitute_staff_id,
                 substitute_name = excluded.substitute_name,
                 reason = excluded.reason,
                 target_category_id = excluded.target_category_id`,
                [subStaff.id, dStr, subOrigLink, originalLink, staff.id, staff.name, subReason, staff.category_id]
              );

              await run(
                `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
               VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 code = 'P',
                 remarks = excluded.remarks,
                 updated_by = excluded.updated_by,
                 updated_at = CURRENT_TIMESTAMP`,
                [subStaff.id, dStr, subReason]
              );

              if (subStaff.category_id === 4) {
                const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                const targetDObj = new Date(dStr + 'T12:00:00');
                const targetDayOfWeek = dayNames[targetDObj.getDay()];
                const resolvedDuty = await resolveDutyCodeForLRStaff(subStaff.id, dStr, targetDayOfWeek, subStaff.rest_day);
                if (resolvedDuty && resolvedDuty.code) {
                  await syncLRSheetRecord(subStaff.id, dStr, resolvedDuty.code, subReason);
                }
              }
              await syncDutyChangeAcrossAllModules({ get, all, run }, subStaff.id, dStr, {
                targetLink: originalLink,
                isLeave: false,
                remarks: subReason
              });
            }
          }
        }

        const undoData = {
          action: 'SHIFTED',
          staff_id,
          staff_name: staff.name,
          dates: datesToProcess,
          replacement_staff_id: replacement_staff_id || null,
          snapshots: undoSnapshots
        };

        await logAudit(
          'Admin',
          'SHIFTED',
          `Shifted ${staff.name} to ${shiftDesc} on ${date}. Original slot updated.`,
          undoData
        );

        return ({
          success: true,
          message: `Shifted ${staff.name} to ${shiftDesc} on ${date}! Original slot updated.`
        });
      }

      // UNDO_SHIFT: Revert shift and restore original employee
      if (action === 'UNDO_SHIFT') {
        await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, date]);
        await run('DELETE FROM overrides WHERE substitute_staff_id = ? AND date = ?', [staff_id, date]);
        await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, date]);
        await syncDocumentsAndEarningsForStaffDate(staff_id, date, { dutyText: null, isLeaveOrRest: false });
        await logAudit('Admin', 'UNDO_SHIFT', `Reverted shift for ${staff.name} on ${date} and restored to original cyclic link`, {
          staff_id,
          staff_name: staff.name,
          date
        });
        return ({ success: true, message: 'Shift undone and staff restored to original cyclic link.' });
      }

      throw new ApiError(400, 'Invalid action specified' );
    });
}

export async function exchangeStaff(data: any, currentUser: string = 'Admin') {
  const { staff_a_id, staff_b_id, date, reason, duty_a_link, duty_a_category_id, duty_b_link, duty_b_category_id } = data;
  if (!staff_a_id || !staff_b_id || !date) {
    throw new ApiError(400, 'staff_a_id, staff_b_id, and date are required' );
  }
  if (parseInt(staff_a_id, 10) === parseInt(staff_b_id, 10)) {
    throw new ApiError(400, 'Cannot exchange duties with the same employee' );
  }

    const staffA = await get('SELECT * FROM staff WHERE id = ?', [staff_a_id]);
    const staffB = await get('SELECT * FROM staff WHERE id = ?', [staff_b_id]);
    if (!staffA || !staffB) {
      throw new ApiError(404, 'One or both staff members not found' );
    }

    let labelA = '';
    let labelB = '';

    await withTransaction(async () => {
      const catA = await get('SELECT * FROM categories WHERE id = ?', [staffA.category_id]);
      const catB = await get('SELECT * FROM categories WHERE id = ?', [staffB.category_id]);

      const dayOffsetA = getDayOffset(catA.anchor_date, date);
      const dayOffsetB = getDayOffset(catB.anchor_date, date);

      const origLinkA = getBaseLinkNumber(staffA.row_position, dayOffsetA, catA.cycle_length);
      const origLinkB = getBaseLinkNumber(staffB.row_position, dayOffsetB, catB.cycle_length);

      const existingOverrideA = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staffA.id, date]);
      const existingOverrideB = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staffB.id, date]);

      const existingMusterA = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staffA.id, date]);
      const existingMusterB = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staffB.id, date]);

      // Determine current effective duty of Staff A
      let currentDutyA = null;
      let targetCatA = staffA.category_id;
      if (duty_a_link !== undefined && duty_a_link !== null && duty_a_link !== '') {
        currentDutyA = parseInt(duty_a_link, 10);
        if (duty_a_category_id) targetCatA = parseInt(duty_a_category_id, 10);
      } else if (existingOverrideA) {
        if (existingOverrideA.overridden_link_number !== null) {
          currentDutyA = existingOverrideA.overridden_link_number;
          targetCatA = existingOverrideA.target_category_id || staffA.category_id;
        } else {
          // Fallback: If relieved/spare, use their original duty link
          currentDutyA = existingOverrideA.original_link_number || origLinkA;
          targetCatA = existingOverrideA.target_category_id || staffA.category_id;
        }
      } else {
        currentDutyA = origLinkA;
        const linkDefA = await get('SELECT * FROM links WHERE category_id = ? AND link_number = ? AND (status = \'published\' OR status IS NULL OR status = \'\') AND (status != \'draft\') AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = \'published\' OR status IS NULL))', [staffA.category_id, origLinkA]);
        if (!linkDefA || linkDefA.is_rest) currentDutyA = null;
      }

      // Determine current effective duty of Staff B
      let currentDutyB = null;
      let targetCatB = staffB.category_id;
      if (duty_b_link !== undefined && duty_b_link !== null && duty_b_link !== '') {
        currentDutyB = parseInt(duty_b_link, 10);
        if (duty_b_category_id) targetCatB = parseInt(duty_b_category_id, 10);
      } else if (existingOverrideB) {
        if (existingOverrideB.overridden_link_number !== null) {
          currentDutyB = existingOverrideB.overridden_link_number;
          targetCatB = existingOverrideB.target_category_id || staffB.category_id;
        } else {
          // Fallback: If relieved/spare, use their original duty link
          currentDutyB = existingOverrideB.original_link_number || origLinkB;
          targetCatB = existingOverrideB.target_category_id || staffB.category_id;
        }
      } else {
        currentDutyB = origLinkB;
        const linkDefB = await get('SELECT * FROM links WHERE category_id = ? AND link_number = ? AND (status = \'published\' OR status IS NULL OR status = \'\') AND (status != \'draft\') AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = \'published\' OR status IS NULL))', [staffB.category_id, origLinkB]);
        if (!linkDefB || linkDefB.is_rest) currentDutyB = null;
      }

      // Exchange: Staff A receives Staff B's duty, Staff B receives Staff A's duty
      const newDutyA = currentDutyB;
      let newCatA = targetCatB;
      if (newDutyA !== null) {
        const linkDef = await get(
          'SELECT category_id FROM links WHERE link_number = ? AND (status = \'published\' OR status IS NULL OR status = \'\') AND (status != \'draft\') AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = \'published\' OR status IS NULL)) ORDER BY (category_id = ?) DESC LIMIT 1',
          [newDutyA, targetCatB || staffB.category_id]
        );
        if (linkDef) newCatA = linkDef.category_id;
      }
      const newStatusA = newDutyA === null ? 'REST' : 'CHANGED_LINK';
      const reasonA = reason ? `Exchange with ${staffB.name}: ${reason}` : `Exchanged duty with ${staffB.name}`;

      const newDutyB = currentDutyA;
      let newCatB = targetCatA;
      if (newDutyB !== null) {
        const linkDef = await get(
          'SELECT category_id FROM links WHERE link_number = ? AND (status = \'published\' OR status IS NULL OR status = \'\') AND (status != \'draft\') AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = \'published\' OR status IS NULL)) ORDER BY (category_id = ?) DESC LIMIT 1',
          [newDutyB, targetCatA || staffA.category_id]
        );
        if (linkDef) newCatB = linkDef.category_id;
      }

      const newStatusB = newDutyB === null ? 'REST' : 'CHANGED_LINK';
      const reasonB = reason ? `Exchange with ${staffA.name}: ${reason}` : `Exchanged duty with ${staffA.name}`;

      const effectiveOrigA = existingOverrideA?.original_link_number || origLinkA;
      const effectiveOrigB = existingOverrideB?.original_link_number || origLinkB;

      // Apply override for Staff A
      await run(
        `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id, leave_type)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           overridden_link_number = excluded.overridden_link_number,
           status = excluded.status,
           substitute_staff_id = NULL,
           substitute_name = NULL,
           leave_type = NULL,
           reason = excluded.reason,
           target_category_id = excluded.target_category_id`,
        [staffA.id, date, effectiveOrigA, newDutyA, newStatusA, reasonA, newCatA]
      );

      // Apply override for Staff B
      await run(
        `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id, leave_type)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           overridden_link_number = excluded.overridden_link_number,
           status = excluded.status,
           substitute_staff_id = NULL,
           substitute_name = NULL,
           leave_type = NULL,
           reason = excluded.reason,
           target_category_id = excluded.target_category_id`,
        [staffB.id, date, effectiveOrigB, newDutyB, newStatusB, reasonB, newCatB]
      );

      // Muster updates: P for duty, R for rest
      const musterCodeA = newDutyA === null ? 'R' : 'P';
      const musterCodeB = newDutyB === null ? 'R' : 'P';

      await run(
        `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
         VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           code = excluded.code,
           remarks = excluded.remarks,
           updated_by = excluded.updated_by,
           updated_at = CURRENT_TIMESTAMP`,
        [staffA.id, date, musterCodeA, reasonA]
      );

      await run(
        `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
         VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           code = excluded.code,
           remarks = excluded.remarks,
           updated_by = excluded.updated_by,
           updated_at = CURRENT_TIMESTAMP`,
        [staffB.id, date, musterCodeB, reasonB]
      );

      // Sync with Leave Reserve (LR) sheet if staffA or staffB is Category 4
      const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const dObj = new Date(date + 'T12:00:00');
      const dayOfWeek = dayNames[dObj.getDay()];

      if (staffA.category_id === 4) {
        const resA = await resolveDutyCodeForLRStaff(staffA.id, date, dayOfWeek, staffA.rest_day);
        if (resA && resA.code) {
          await syncLRSheetRecord(staffA.id, date, resA.code, reasonA);
        } else if (newDutyA === null) {
          await syncLRSheetRecord(staffA.id, date, 'R', reasonA);
        }
      }

      if (staffB.category_id === 4) {
        const resB = await resolveDutyCodeForLRStaff(staffB.id, date, dayOfWeek, staffB.rest_day);
        if (resB && resB.code) {
          await syncLRSheetRecord(staffB.id, date, resB.code, reasonB);
        } else if (newDutyB === null) {
          await syncLRSheetRecord(staffB.id, date, 'R', reasonB);
        }
      }

      // Synchronize across TA approvals and documents for both staff
      await syncDutyChangeAcrossAllModules({ get, all, run }, staffA.id, date, {
        targetLink: newDutyA,
        isLeave: false,
        isRest: newDutyA === null,
        remarks: reasonA
      });
      await syncDutyChangeAcrossAllModules({ get, all, run }, staffB.id, date, {
        targetLink: newDutyB,
        isLeave: false,
        isRest: newDutyB === null,
        remarks: reasonB
      });

      const undoData = {
        action: 'EXCHANGE_STAFF',
        date,
        staff_a: {
          id: staffA.id,
          name: staffA.name,
          previous_override: existingOverrideA || null,
          previous_muster: existingMusterA || null
        },
        staff_b: {
          id: staffB.id,
          name: staffB.name,
          previous_override: existingOverrideB || null,
          previous_muster: existingMusterB || null
        }
      };

      labelA = newDutyA === null ? 'REST' : `Link ${newDutyA}`;
      labelB = newDutyB === null ? 'REST' : `Link ${newDutyB}`;
      await logAudit(
        'Admin',
        'EXCHANGE_STAFF',
        `Exchanged duties between ${staffA.name} (${labelA}) and ${staffB.name} (${labelB}) on ${date}`,
        undoData
      );
    });

    return ({
      success: true,
      message: `Successfully exchanged duties: ${staffA.name} is now on ${labelA} and ${staffB.name} is now on ${labelB}!`
    });
}

export async function dragAssignTrain(data: any, currentUser: string = 'Admin') {
  const {
    staff_id,
    date,
    source_link,
    source_category_id,
    source_train,
    target_train,
    target_slot_id,
    target_link,
    target_category_id,
    is_extra,
    replace_staff_id
  } = data;

  if (!staff_id || !date || !target_train) {
    throw new ApiError(400, 'staff_id, date, and target_train are required' );
  }

    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) throw new ApiError(404, 'Staff member not found' );
    if (parseInt(staff.category_id, 10) === 1 && (is_extra === 1 || !target_link || (target_category_id && parseInt(target_category_id, 10) !== 1))) {
      throw new ApiError(400, 'Conductors (COR) can only be assigned to COR (AC coaches) links.' );
    }

    const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, date]);
    const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff.id, date]);

    const cat = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
    const dayOffset = getDayOffset(cat.anchor_date, date);
    const origLink = getBaseLinkNumber(staff.row_position, dayOffset, cat.cycle_length);

    const isExtraCrew = is_extra === 1 || !target_link;
    const status = isExtraCrew ? 'EXTRA_CREW' : 'CHANGED_LINK';
    const effectiveLink = isExtraCrew ? null : parseInt(target_link, 10);
    const parsedTargetCat = target_category_id ? parseInt(target_category_id, 10) : null;
    const effectiveTargetCat = isExtraCrew
      ? staff.category_id
      : ((parsedTargetCat && parsedTargetCat !== 4) ? parsedTargetCat : (staff.category_id === 1 ? 1 : 2));
    const shiftedPlace = isExtraCrew ? 'EXTRA_DOWN_BELOW' : `Link #${effectiveLink}`;
    const reason = isExtraCrew
      ? `Shifted from Train ${source_train || origLink || ''} to Train ${target_train} as Extra Staff (down below)`
      : `Shifted from Train ${source_train || origLink || ''} to Train ${target_train} (Link #${effectiveLink})`;

    await run(
      `INSERT INTO overrides (
        staff_id, date, overridden_link_number, status, target_category_id,
        reason, original_link_number, extra_train_no, is_extra,
        shifted_from_link, shifted_from_train, shifted_place,
        advance_train_no, is_advance_duty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0)
      ON CONFLICT(staff_id, date) DO UPDATE SET
        overridden_link_number = excluded.overridden_link_number,
        status = excluded.status,
        target_category_id = excluded.target_category_id,
        reason = excluded.reason,
        original_link_number = COALESCE(overrides.original_link_number, excluded.original_link_number),
        extra_train_no = excluded.extra_train_no,
        is_extra = excluded.is_extra,
        shifted_from_link = excluded.shifted_from_link,
        shifted_from_train = excluded.shifted_from_train,
        shifted_place = excluded.shifted_place,
        advance_train_no = NULL,
        is_advance_duty = 0`,
      [
        staff.id,
        date,
        effectiveLink,
        status,
        effectiveTargetCat,
        reason,
        origLink,
        target_train,
        isExtraCrew ? 1 : 0,
        source_link || origLink || null,
        source_train || null,
        shiftedPlace
      ]
    );

    // Clear any previous substitute reference for this staff on this date so their previous slot shows vacant
    await run(
      'UPDATE overrides SET substitute_staff_id = NULL, substitute_name = NULL WHERE substitute_staff_id = ? AND date = ?',
      [staff.id, date]
    );

    // If replacing an existing employee on this duty slot, relieve the replaced staff to Available at HQ
    if (replace_staff_id && parseInt(replace_staff_id, 10) !== parseInt(staff.id, 10)) {
      const replacedStaff = await get('SELECT * FROM staff WHERE id = ?', [replace_staff_id]);
      if (replacedStaff) {
        const replacedCat = await get('SELECT * FROM categories WHERE id = ?', [replacedStaff.category_id]);
        const replacedDayOffset = getDayOffset(replacedCat.anchor_date, date);
        const replacedOrigLink = getBaseLinkNumber(replacedStaff.row_position, replacedDayOffset, replacedCat.cycle_length);
        const relievedReason = `Available at HQ (Relieved by ${staff.name} on Train ${target_train}${effectiveLink ? ` Link #${effectiveLink}` : ''})`;

        await run(
          `INSERT INTO overrides (
            staff_id, date, overridden_link_number, status, target_category_id,
            reason, original_link_number, extra_train_no, is_extra,
            shifted_from_link, shifted_from_train, shifted_place,
            advance_train_no, is_advance_duty
          ) VALUES (?, ?, NULL, 'AVAILABLE_FOR_BOOKING', ?, ?, ?, NULL, 0, ?, ?, 'AVAILABLE_AT_HQ', NULL, 0)
          ON CONFLICT(staff_id, date) DO UPDATE SET
            overridden_link_number = NULL,
            status = 'AVAILABLE_FOR_BOOKING',
            target_category_id = excluded.target_category_id,
            reason = excluded.reason,
            extra_train_no = NULL,
            is_extra = 0,
            shifted_from_link = excluded.shifted_from_link,
            shifted_from_train = excluded.shifted_from_train,
            shifted_place = 'AVAILABLE_AT_HQ',
            advance_train_no = NULL,
            is_advance_duty = 0`,
          [
            replacedStaff.id,
            date,
            replacedStaff.category_id,
            relievedReason,
            replacedOrigLink || null,
            effectiveLink || replacedOrigLink || null,
            target_train || null
          ]
        );

        await syncDutyChangeAcrossAllModules({ get, all, run }, replacedStaff.id, date, {
          targetTrain: null,
          targetLink: null,
          isLeave: false
        });

        await run(
          `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
           VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             code = 'P',
             remarks = excluded.remarks,
             updated_by = excluded.updated_by,
             updated_at = CURRENT_TIMESTAMP`,
          [replacedStaff.id, date, relievedReason]
        );
      }
    }

    // Check if Day 1 was a scheduled REST day
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dObj = new Date(date + 'T12:00:00');
    const dayOfWeek = dayNames[dObj.getDay()];
    let isDay1Rest = false;
    if (staff.rest_day && staff.rest_day.toUpperCase() === dayOfWeek) isDay1Rest = true;
    if (staff.category_id !== 4) {
      const origLinkDef = await getActiveLinkDef(staff.category_id, origLink, date);
      if (origLink === null || (origLinkDef && origLinkDef.is_rest === 1)) isDay1Rest = true;
    }
    const day1RestRemark = (isDay1Rest) ? ` - Rest day worked (CR credited for ${formatDateDisplay(date)})` : '';
    const musterRemark = reason + day1RestRemark;

    // Multi-module synchronization across Muster, TA, NDA, Diary, LR Sheet
    await syncDutyChangeAcrossAllModules({ get, all, run }, staff.id, date, {
      targetTrain: target_train,
      targetLink: effectiveLink,
      isLeave: false
    });

    await run(
      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
       VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         code = 'P',
         remarks = excluded.remarks,
         updated_by = excluded.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
      [staff.id, date, musterRemark]
    );

    // Multi-Day Link Set Assignment for ALL staff (Categories 1, 2, 3, 4):
    // If assigned to a multi-day link set (2-day, 3-day, or 4-day link), assign to entire beat!
    if (effectiveLink !== null) {
      const linkSet = getLinkSetDetails(effectiveTargetCat, effectiveLink);
      if (linkSet && linkSet.isFirstDayOfSet && linkSet.remainingLinks.length > 0) {
        for (let k = 0; k < linkSet.remainingLinks.length; k++) {
          const remLinkNum = linkSet.remainingLinks[k];
          const nextDate = new Date(date + 'T12:00:00');
          nextDate.setDate(nextDate.getDate() + k + 1);
          const y = nextDate.getFullYear();
          const m = String(nextDate.getMonth() + 1).padStart(2, '0');
          const d = String(nextDate.getDate()).padStart(2, '0');
          const nextDateStr = `${y}-${m}-${d}`;

          // Check if this date was a scheduled REST day for this staff member
          let isNextDayRest = false;
          const nextDObj = new Date(nextDateStr + 'T12:00:00');
          const nextDayOfWeek = dayNames[nextDObj.getDay()];
          if (staff.rest_day && staff.rest_day.toUpperCase() === nextDayOfWeek) isNextDayRest = true;
          if (staff.category_id !== 4) {
            const nextDayOffset = getDayOffset(cat.anchor_date, nextDateStr);
            const nextOrigLink = getBaseLinkNumber(staff.row_position, nextDayOffset, cat.cycle_length);
            const nextLinkDef = await getActiveLinkDef(staff.category_id, nextOrigLink, nextDateStr);
            if (nextOrigLink === null || (nextLinkDef && nextLinkDef.is_rest === 1)) isNextDayRest = true;
          }

          const restRemark = isNextDayRest ? ` - Rest day worked (CR credited for ${formatDateDisplay(nextDateStr)})` : '';
          const nextReason = `Assigned Link #${remLinkNum} (Day ${k + 2} of Link #${effectiveLink})${restRemark}`;

          await run(
            `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
             VALUES (?, ?, NULL, ?, 'CHANGED_LINK', NULL, NULL, ?, ?)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               overridden_link_number = excluded.overridden_link_number,
               status = 'CHANGED_LINK',
               reason = excluded.reason,
               target_category_id = excluded.target_category_id`,
            [staff.id, nextDateStr, remLinkNum, nextReason, effectiveTargetCat]
          );

          await run(
            `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
             VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               code = 'P',
               remarks = excluded.remarks,
               updated_by = excluded.updated_by,
               updated_at = CURRENT_TIMESTAMP`,
            [staff.id, nextDateStr, nextReason]
          );

          // Multi-module synchronization across Muster, TA, NDA, Diary, LR Sheet
          await syncDutyChangeAcrossAllModules({ get, all, run }, staff.id, nextDateStr, {
            targetTrain: target_train,
            targetLink: remLinkNum,
            isLeave: false
          });
        }
      }
    }

    // Record audit log with undo data
    const undoData = {
      action: 'DRAG_ASSIGN_DUTY',
      date,
      staff_id: staff.id,
      staff_name: staff.name,
      previous_override: existingOverride || null,
      previous_muster: existingMuster || null
    };

    const targetDesc = isExtraCrew
      ? `Train ${target_train} as Extra Crew (down below)`
      : `Train ${target_train} (Link #${effectiveLink})`;

    await logAudit(
      'Admin',
      'DRAG_ASSIGN_DUTY',
      `Assigned ${staff.name} to ${targetDesc} on ${date}`,
      undoData
    );

    return ({
      success: true,
      message: `Assigned ${staff.name} to ${targetDesc}!`,
      is_extra: isExtraCrew,
      target_train,
      target_link: effectiveLink
    });
}

export async function assignNonDailyTrain(data: any, currentUser: string = 'Admin') {
  const { staff_id, date, non_daily_train_id, train_number, source_link } = data;
  if (!staff_id || !date || (!non_daily_train_id && !train_number)) {
    throw new ApiError(400, 'staff_id, date, and train_number or non_daily_train_id are required' );
  }
    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) throw new ApiError(404, 'Staff member not found' );

    let trainObj = null;
    if (non_daily_train_id) {
      trainObj = await get('SELECT * FROM non_daily_trains WHERE id = ?', [non_daily_train_id]);
    } else if (train_number) {
      trainObj = await get('SELECT * FROM non_daily_trains WHERE train_number = ?', [train_number]);
    }
    const finalTrainNo = trainObj ? trainObj.train_number : train_number;
    const cat = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
    const dayOffset = getDayOffset(cat.anchor_date, date);
    const origLink = getBaseLinkNumber(staff.row_position, dayOffset, cat.cycle_length);

    const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, date]);
    const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff.id, date]);

    const reason = `Assigned to Non-Daily Train ${finalTrainNo}${trainObj && trainObj.departure_station ? ` (${trainObj.departure_station} ➔ ${trainObj.arrival_station})` : ''}`;
    await run(
      `INSERT INTO overrides (
        staff_id, date, overridden_link_number, status, target_category_id,
        reason, original_link_number, extra_train_no, is_extra,
        shifted_from_link, shifted_from_train, shifted_place,
        advance_train_no, is_advance_duty
      ) VALUES (?, ?, NULL, 'EXTRA_CREW', ?, ?, ?, ?, 1, ?, 'NON_DAILY', 'NON_DAILY_TRAIN', NULL, 0)
      ON CONFLICT(staff_id, date) DO UPDATE SET
        overridden_link_number = NULL,
        status = 'EXTRA_CREW',
        target_category_id = excluded.target_category_id,
        reason = excluded.reason,
        original_link_number = COALESCE(overrides.original_link_number, excluded.original_link_number),
        extra_train_no = excluded.extra_train_no,
        is_extra = 1,
        shifted_from_link = excluded.shifted_from_link,
        shifted_from_train = excluded.shifted_from_train,
        shifted_place = 'NON_DAILY_TRAIN',
        advance_train_no = NULL,
        is_advance_duty = 0`,
      [
        staff.id,
        date,
        staff.category_id,
        reason,
        origLink,
        finalTrainNo,
        source_link || origLink || null
      ]
    );

    // Sync muster to Present (P)
    await run(
      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
       VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         code = 'P',
         remarks = excluded.remarks,
         updated_by = 'Admin',
         updated_at = CURRENT_TIMESTAMP`,
      [staff.id, date, `Train ${finalTrainNo}`]
    );

    // Clear any previous substitute reference for this staff on this date so their previous slot shows vacant
    await run(
      'UPDATE overrides SET substitute_staff_id = NULL, substitute_name = NULL WHERE substitute_staff_id = ? AND date = ?',
      [staff.id, date]
    );

    // Keep non_daily_trains template table clean (assignments are date-specific in overrides)
    await run(
      'UPDATE non_daily_trains SET assigned_staff_id = NULL, assigned_staff_name = NULL WHERE assigned_staff_id = ?',
      [staff.id]
    );

    // Sync TA, NDA, Diary
    await syncDutyChangeAcrossAllModules({ get, all, run }, staff.id, date, {
      targetTrain: finalTrainNo,
      isLeave: false
    });

    // Multi-Day Continuation for Non-Daily Services (2-Day or 3-Day services)
    const ndMatch = NON_DAILY_PAIRS_MAP[String(finalTrainNo).trim()] || getMultiDayNonDailyMatch(finalTrainNo);
    const returnTrain = ndMatch?.returnTrain || (trainObj && trainObj.last_day_train_number ? trainObj.last_day_train_number : null);
    const totalDays = ndMatch?.totalDays || (returnTrain ? 2 : 1);
    const via = ndMatch?.via || (trainObj && trainObj.departure_station ? `${trainObj.departure_station} ➔ ${trainObj.arrival_station}` : '');
    const to = ndMatch?.to || 'GNT';
    const arrHqTime = ndMatch?.arrHqTime || '';
    const restTill = ndMatch?.restTill || '';

    if (totalDays >= 2 && returnTrain) {
      const d2Obj = new Date(date + 'T12:00:00');
      d2Obj.setDate(d2Obj.getDate() + 1);
      const d2Str = d2Obj.toISOString().split('T')[0];
      const d2Offset = getDayOffset(cat.anchor_date, d2Str);
      const d2OrigLink = getBaseLinkNumber(staff.row_position, d2Offset, cat.cycle_length);
      const d2Reason = `Day 2 Return of ${finalTrainNo} (${returnTrain}${via ? ` ${via}` : ''} ➔ ${to})`;

      await run(
        `INSERT INTO overrides (
          staff_id, date, overridden_link_number, status, target_category_id,
          reason, original_link_number, extra_train_no, is_extra,
          shifted_from_link, shifted_from_train, shifted_place,
          advance_train_no, is_advance_duty
        ) VALUES (?, ?, NULL, 'EXTRA_CREW', ?, ?, ?, ?, 1, ?, 'NON_DAILY', 'NON_DAILY_RETURN', NULL, 0)
        ON CONFLICT(staff_id, date) DO UPDATE SET
          overridden_link_number = NULL,
          status = 'EXTRA_CREW',
          target_category_id = excluded.target_category_id,
          reason = excluded.reason,
          original_link_number = COALESCE(overrides.original_link_number, excluded.original_link_number),
          extra_train_no = excluded.extra_train_no,
          is_extra = 1,
          shifted_from_link = excluded.shifted_from_link,
          shifted_from_train = excluded.shifted_from_train,
          shifted_place = 'NON_DAILY_RETURN',
          advance_train_no = NULL,
          is_advance_duty = 0`,
        [
          staff.id,
          d2Str,
          staff.category_id,
          d2Reason,
          d2OrigLink,
          returnTrain,
          d2OrigLink || null
        ]
      );

      await run(
        `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
         VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           code = 'P',
           remarks = excluded.remarks,
           updated_by = 'Admin',
           updated_at = CURRENT_TIMESTAMP`,
        [staff.id, d2Str, `Train ${returnTrain}`]
      );

      await syncDutyChangeAcrossAllModules({ get, all, run }, staff.id, d2Str, {
        targetTrain: returnTrain,
        isLeave: false
      });
    }

    if (totalDays === 3) {
      const d3Obj = new Date(date + 'T12:00:00');
      d3Obj.setDate(d3Obj.getDate() + 2);
      const d3Str = d3Obj.toISOString().split('T')[0];
      const d3Offset = getDayOffset(cat.anchor_date, d3Str);
      const d3OrigLink = getBaseLinkNumber(staff.row_position, d3Offset, cat.cycle_length);
      const d3Reason = `Day 3: Arrived GNT ${arrHqTime || ''} on ${returnTrain || ''}${restTill ? ` • 8h HQ Rest till ${restTill}` : ''} • 3-Day Link Complete`;

      await run(
        `INSERT INTO overrides (
          staff_id, date, overridden_link_number, status, target_category_id,
          reason, original_link_number, extra_train_no, is_extra,
          shifted_from_link, shifted_from_train, shifted_place,
          advance_train_no, is_advance_duty
        ) VALUES (?, ?, NULL, 'DUTY', ?, ?, ?, NULL, 0, ?, 'NON_DAILY', 'NON_DAILY_REST', NULL, 0)
        ON CONFLICT(staff_id, date) DO UPDATE SET
          overridden_link_number = NULL,
          status = 'DUTY',
          target_category_id = excluded.target_category_id,
          reason = excluded.reason,
          original_link_number = COALESCE(overrides.original_link_number, excluded.original_link_number),
          extra_train_no = NULL,
          is_extra = 0,
          shifted_from_link = excluded.shifted_from_link,
          shifted_from_train = excluded.shifted_from_train,
          shifted_place = 'NON_DAILY_REST',
          advance_train_no = NULL,
          is_advance_duty = 0`,
        [
          staff.id,
          d3Str,
          staff.category_id,
          d3Reason,
          d3OrigLink,
          d3OrigLink || null
        ]
      );

      await run(
        `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
         VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           code = 'P',
           remarks = excluded.remarks,
           updated_by = 'Admin',
           updated_at = CURRENT_TIMESTAMP`,
        [staff.id, d3Str, `HQ Rest after Tr ${returnTrain || ''}`]
      );

      await syncDutyChangeAcrossAllModules({ get, all, run }, staff.id, d3Str, {
        targetTrain: null,
        isLeave: false
      });
    }

    const undoData = {
      action: 'ASSIGN_NON_DAILY_TRAIN',
      staff_id: staff.id,
      staff_name: staff.name,
      date,
      train_number: finalTrainNo,
      previous_override: existingOverride || null,
      previous_muster: existingMuster || null
    };

    await logAudit('Admin', 'ASSIGN_NON_DAILY_TRAIN', `Assigned ${staff.name} to Non-Daily Train ${finalTrainNo} on ${date}`, undoData);

    return ({
      success: true,
      message: `Assigned ${staff.name} to Non-Daily Train ${finalTrainNo}!`,
      train_number: finalTrainNo,
      staff_name: staff.name
    });
}

export async function unassignNonDailyTrain(data: any, currentUser: string = 'Admin') {
  const { staff_id, date, non_daily_train_id } = data;
    let resolvedStaffId = staff_id;
    if (!resolvedStaffId && non_daily_train_id) {
      const trainRecord = await get('SELECT assigned_staff_id FROM non_daily_trains WHERE id = ?', [non_daily_train_id]);
      if (trainRecord && trainRecord.assigned_staff_id) resolvedStaffId = trainRecord.assigned_staff_id;
    }
    let existingOverride = null;
    let existingMuster = null;
    if (resolvedStaffId && date) {
      existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [resolvedStaffId, date]);
      existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [resolvedStaffId, date]);
      await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [resolvedStaffId, date]);
      await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [resolvedStaffId, date]);
      await run(
        'UPDATE non_daily_trains SET assigned_staff_id = NULL, assigned_staff_name = NULL WHERE assigned_staff_id = ?',
        [resolvedStaffId]
      );
      await syncDutyChangeAcrossAllModules({ get, all, run }, resolvedStaffId, date, {
        targetTrain: null,
        isLeave: false
      });

      // Also clean up Day 2 and Day 3 continuation overrides if present
      const d2Obj = new Date(date + 'T12:00:00');
      d2Obj.setDate(d2Obj.getDate() + 1);
      const d2Str = d2Obj.toISOString().split('T')[0];

      const d3Obj = new Date(date + 'T12:00:00');
      d3Obj.setDate(d3Obj.getDate() + 2);
      const d3Str = d3Obj.toISOString().split('T')[0];

      // Also check if current date itself was Day 2 or Day 3 of a multi-day service
      const dMinus1 = new Date(date + 'T12:00:00');
      dMinus1.setDate(dMinus1.getDate() - 1);
      const dMinus1Str = dMinus1.toISOString().split('T')[0];

      const dMinus2 = new Date(date + 'T12:00:00');
      dMinus2.setDate(dMinus2.getDate() - 2);
      const dMinus2Str = dMinus2.toISOString().split('T')[0];

      const affectedDates = [dMinus2Str, dMinus1Str, d2Str, d3Str];
      for (const affDate of affectedDates) {
        const affOv = await get(
          `SELECT * FROM overrides 
           WHERE staff_id = ? AND date = ? AND shifted_place IN ('NON_DAILY_TRAIN', 'NON_DAILY_RETURN', 'NON_DAILY_REST')`,
          [resolvedStaffId, affDate]
        );
        if (affOv) {
          await run('DELETE FROM overrides WHERE id = ?', [affOv.id]);
          await run(
            `DELETE FROM muster_records WHERE staff_id = ? AND date = ? AND (remarks LIKE '%Train%' OR remarks LIKE '%HQ Rest%')`,
            [resolvedStaffId, affDate]
          );
          await syncDutyChangeAcrossAllModules({ get, all, run }, resolvedStaffId, affDate, {
            targetTrain: null,
            isLeave: false
          });
        }
      }
    }
    if (non_daily_train_id) {
      await run(
        'UPDATE non_daily_trains SET assigned_staff_id = NULL, assigned_staff_name = NULL WHERE id = ?',
        [non_daily_train_id]
      );
    }
    const undoData = {
      action: 'UNASSIGN_NON_DAILY_TRAIN',
      staff_id: resolvedStaffId,
      date,
      non_daily_train_id,
      previous_override: existingOverride || null,
      previous_muster: existingMuster || null
    };
    await logAudit('Admin', 'UNASSIGN_NON_DAILY_TRAIN', `Unassigned staff ${staff_id || ''} from Non-Daily Train ID ${non_daily_train_id || ''} on ${date || ''}`, undoData);
    return ({ success: true, message: 'Unassigned staff from non-daily train successfully' });
}

export async function getOverridesAudit() {
    const logs = await all(`
      SELECT o.*, s.name as staff_name, s.designation as staff_desg, c.name as category_name 
      FROM overrides o 
      JOIN staff s ON o.staff_id = s.id 
      JOIN categories c ON s.category_id = c.id 
      ORDER BY o.created_at DESC
    `);
    return (logs);
}
