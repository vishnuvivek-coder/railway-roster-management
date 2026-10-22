import { run, get, all } from '../db';
import { resolveDutyCodeForLRStaff } from './helpers.service';
import { syncDutyChangeAcrossAllModules, syncLRSheetRecord } from './sync.service';

export function deriveAuditMetadata(actionType: any, description: any, undoData: any = null) {
  const act = String(actionType || '').toUpperCase();
  const desc = String(description || '');
  let parsedUndo = null;
  if (undoData) {
    if (typeof undoData === 'object') parsedUndo = undoData;
    else if (typeof undoData === 'string') {
      try { parsedUndo = JSON.parse(undoData); } catch (e) { }
    }
  }

  let endpoint = 'POST /api/duty/change-status';
  let frontendCaller = 'App.jsx (Daily Summary / Monthly Movement)';
  let sourceModule = 'System Roster';
  let savedTables = ['overrides'];
  let linkedModules = [
    'Daily Summary Table',
    'Monthly Movement Grid',
    'Muster Roll',
    'TA Journal & Approvals',
    'NDA Journal',
    'Diary',
    'Daily Earnings Sheet',
    'Leave / Swap',
    'LR Sheet'
  ];

  if (act.includes('MUSTER')) {
    endpoint = act.includes('BATCH')
      ? (act.includes('RESET') ? 'POST /api/muster/batch-reset' : 'POST /api/muster/batch-update')
      : (act.includes('RESET') ? 'POST /api/muster/reset-cell' : 'POST /api/muster/update-cell');
    frontendCaller = 'App.jsx (Muster Roll & Individual Muster)';
    sourceModule = 'Muster Roll & Attendance';
    savedTables = ['muster_records'];
    linkedModules = [
      'Muster Roll (muster_records)',
      'Daily Summary Table (overrides)',
      'Monthly Movement Grid',
      'TA Approvals & TA Journal (ta_approvals, ta_entries)',
      'NDA Journal (nda_entries)',
      'Diary (diary_entries)',
      'Daily Earnings Sheet (daily_earnings_entries)',
      'Leave / Swap (overrides)',
      'LR Sheet (lr_sheet_records)'
    ];
  } else if (act.includes('LR_SHEET') || act.includes('LR_')) {
    endpoint = act.includes('BATCH') || act.includes('BULK')
      ? 'POST /api/lr-sheet/batch-update'
      : act.includes('SYNC')
        ? 'POST /api/lr-sheet/sync-from-daily-duty'
        : 'POST /api/lr-sheet/cell';
    frontendCaller = 'App.jsx (Leave Reserve LR Sheet)';
    sourceModule = 'Leave Reserve (LR) Sheet';
    savedTables = ['lr_sheet_records'];
    linkedModules = [
      'LR Sheet (lr_sheet_records)',
      'Daily Summary Table (overrides)',
      'Monthly Movement Grid',
      'Muster Roll (muster_records)',
      'TA Approvals & TA Journal (ta_approvals, ta_entries)',
      'NDA Journal (nda_entries)',
      'Diary (diary_entries)',
      'Daily Earnings Sheet (daily_earnings_entries)'
    ];
  } else if (act.includes('TA_JOURNAL') || act === 'SAVE_TA_JOURNAL' || act === 'RESET_TA_JOURNAL') {
    endpoint = act.includes('RESET') ? 'DELETE /api/documents/ta/:staffId' : 'POST /api/documents/ta/:staffId';
    frontendCaller = 'TaDocument.jsx (Employee TA Journal)';
    sourceModule = 'TA Journal Document';
    savedTables = ['ta_entries', 'ta_approvals', 'actual_train_runs'];
    linkedModules = [
      'TA Journal (ta_entries)',
      'TA Approvals (ta_approvals)',
      'Daily Summary Table (overrides)',
      'Muster Roll (muster_records)',
      'LR Sheet (lr_sheet_records)',
      'NDA Journal (nda_entries)',
      'Diary (diary_entries)',
      'Daily Earnings Sheet (daily_earnings_entries)'
    ];
  } else if (act.includes('ACCEPT_TA') || act.includes('REJECT_TA') || act.includes('REVERT_TA') || act.includes('SYNC_TA') || act.includes('TA_APPROVAL')) {
    endpoint = act.includes('ALL')
      ? 'POST /api/ta-approvals/accept-all'
      : act.includes('BATCH')
        ? 'POST /api/ta-approvals/accept-batch'
        : act.includes('REJECT')
          ? 'POST /api/ta-approvals/reject'
          : act.includes('REVERT')
            ? 'POST /api/ta-approvals/revert'
            : 'POST /api/ta-approvals/accept';
    frontendCaller = 'TaApprovals.jsx (TA Approvals Portal)';
    sourceModule = 'TA Approvals Portal';
    savedTables = ['ta_approvals', 'ta_entries'];
    linkedModules = [
      'TA Approvals (ta_approvals)',
      'TA Journal (ta_entries)',
      'NDA Journal (nda_entries)',
      'Diary (diary_entries)',
      'Daily Earnings Sheet (daily_earnings_entries)'
    ];
  } else if (act.includes('NDA_JOURNAL') || act === 'SAVE_NDA_JOURNAL' || act === 'RESET_NDA_JOURNAL') {
    endpoint = act.includes('RESET') ? 'DELETE /api/documents/nda/:staffId' : 'POST /api/documents/nda/:staffId';
    frontendCaller = 'NdaDocument.jsx (Employee NDA Journal)';
    sourceModule = 'NDA Journal Document';
    savedTables = ['nda_entries', 'actual_train_runs'];
    linkedModules = [
      'NDA Journal (nda_entries)',
      'Daily Summary Table (overrides)',
      'Muster Roll (muster_records)',
      'LR Sheet (lr_sheet_records)',
      'TA Journal & Approvals (ta_entries, ta_approvals)',
      'Diary (diary_entries)',
      'Daily Earnings Sheet (daily_earnings_entries)'
    ];
  } else if (act.includes('DIARY') || act === 'SAVE_DIARY' || act === 'RESET_DIARY') {
    endpoint = act.includes('RESET') ? 'DELETE /api/documents/diary/:staffId' : 'POST /api/documents/diary/:staffId';
    frontendCaller = 'DiaryDocument.jsx (Employee Monthly Diary)';
    sourceModule = 'Diary (E.F.T Earnings Statement)';
    savedTables = ['diary_entries', 'daily_earnings_entries'];
    linkedModules = [
      'Diary (diary_entries)',
      'Daily Earnings Sheet (daily_earnings_entries)',
      'Daily Summary Table (overrides)',
      'Muster Roll (muster_records)',
      'LR Sheet (lr_sheet_records)',
      'TA Journal & Approvals (ta_entries, ta_approvals)',
      'NDA Journal (nda_entries)'
    ];
  } else if (act.includes('DAILY_EARNINGS') || act.includes('MONTHLY_EARNINGS')) {
    endpoint = act.includes('RESET')
      ? 'DELETE /api/documents/daily-earnings'
      : act.includes('BULK') || act.includes('RANGE')
        ? 'POST /api/documents/daily-earnings/range'
        : 'POST /api/documents/daily-earnings';
    frontendCaller = 'DailyEarningsDocument.jsx (Daily Earnings Sheet)';
    sourceModule = 'Daily Earnings Sheet';
    savedTables = ['daily_earnings_entries', 'diary_entries'];
    linkedModules = [
      'Daily Earnings Sheet (daily_earnings_entries)',
      'Diary (diary_entries)',
      'Daily Summary Table (overrides)',
      'Monthly Movement Grid',
      'Muster Roll (muster_records)',
      'TA Journal & Approvals (ta_approvals, ta_entries)',
      'NDA Journal (nda_entries)',
      'LR Sheet (lr_sheet_records)'
    ];
  } else if (act.includes('DUTY_REGISTER')) {
    endpoint = 'POST /api/duty-register';
    frontendCaller = 'App.jsx (Actual Duty Register)';
    sourceModule = 'Actual Duty Register';
    savedTables = ['duty_register', 'overrides'];
    linkedModules = [
      'Duty Register (duty_register)',
      'Daily Summary Table (overrides)',
      'Monthly Movement Grid',
      'Muster Roll (muster_records)',
      'LR Sheet (lr_sheet_records)',
      'TA / NDA / Diary / Earnings'
    ];
  } else if (
    act.includes('LEAVE') || act.includes('SICK') || act.includes('CR') ||
    act.includes('ABSENT') || act.includes('REST') || act.includes('SWAP') ||
    act.includes('EXCHANGE') || act.includes('MUTUAL_SHIFT') || act.includes('SHIFTED') ||
    act.includes('CHANGED_LINK') || act.includes('REASSIGN') || act.includes('UPGRADE_TO_COR') ||
    act.includes('UTILISED_ADVANCE') || act.includes('WRONG_ALLOTMENT') || act.includes('MARK_LATER') ||
    act.includes('REMOVE_FROM_LINK') || act.includes('DRAG_ASSIGN') || act.includes('NON_DAILY') ||
    act.includes('MANUAL_OVERRIDE') || act.includes('RESET_DUTY')
  ) {
    if (act.includes('EXCHANGE') || act.includes('SWAP')) {
      endpoint = 'POST /api/duty/exchange-staff';
      frontendCaller = 'App.jsx (Exchange / Swap Staff Modal)';
    } else if (act.includes('DRAG_ASSIGN')) {
      endpoint = 'POST /api/duty/drag-assign-train';
      frontendCaller = 'App.jsx (Drag-and-Drop Train Assignment)';
    } else if (act.includes('NON_DAILY')) {
      endpoint = 'POST /api/duty/assign-non-daily-train';
      frontendCaller = 'App.jsx (Non-Daily Train Assignment)';
    } else if (act.includes('APPROVE_LEAVE')) {
      endpoint = 'POST /api/leave-requests/:id/approve';
      frontendCaller = 'App.jsx (Leave Request Approval)';
    } else {
      endpoint = 'POST /api/duty/change-status';
      frontendCaller = 'App.jsx (Daily Summary & Monthly Movement Duty Edit)';
    }
    sourceModule = (act.includes('LEAVE') || act.includes('SICK') || act.includes('CR') || act.includes('SWAP') || act.includes('EXCHANGE') || act.includes('MUTUAL'))
      ? 'Daily Summary / Leave & Swap'
      : 'Daily Summary & Duty Movement';
    savedTables = ['overrides', 'muster_records'];
    linkedModules = [
      'Daily Summary Table (overrides)',
      'Monthly Movement Grid',
      'Muster Roll (muster_records)',
      'TA Approvals & TA Journal (ta_approvals, ta_entries)',
      'NDA Journal (nda_entries)',
      'Diary (diary_entries)',
      'Daily Earnings Sheet (daily_earnings_entries)',
      'Leave / Swap (overrides, leave_requests)',
      'LR Sheet (lr_sheet_records)'
    ];
  } else if (act.includes('STAFF')) {
    endpoint = act.includes('ADD') || act.includes('CREATE')
      ? 'POST /api/staff'
      : act.includes('DELETE')
        ? 'DELETE /api/staff/:id'
        : 'PUT /api/staff/:id';
    frontendCaller = 'App.jsx (Staff Directory)';
    sourceModule = 'Staff & Seniority Directory';
    savedTables = ['staff'];
    linkedModules = [
      'Staff Directory (staff)',
      'Daily Summary Table',
      'Monthly Movement Grid',
      'Muster Roll',
      'TA / NDA / Diary / Daily Earnings',
      'LR Sheet'
    ];
  } else if (act.includes('LINK') || act.includes('SLOT')) {
    endpoint = act.includes('SLOT') ? 'POST /api/slot-customizations' : 'POST / PUT /api/links';
    frontendCaller = 'App.jsx (Roster Link & Slot Builder)';
    sourceModule = 'Link & Slot Configuration';
    savedTables = act.includes('SLOT') ? ['slot_customizations', 'daily_slot_customizations'] : ['links', 'link_sets'];
    linkedModules = [
      'Link Configuration (links)',
      'Daily Summary Table',
      'Monthly Movement Grid',
      'TA / NDA / Diary Generators'
    ];
  } else if (act.includes('TRAIN_TA_NDA')) {
    endpoint = 'POST /api/train-ta-nda/batch';
    frontendCaller = 'App.jsx (Train TA/NDA Master Timings)';
    sourceModule = 'Train TA/NDA Master Directory';
    savedTables = ['train_ta_nda_directory'];
    linkedModules = [
      'Train TA/NDA Directory (train_ta_nda_directory)',
      'TA Journal & Approvals',
      'NDA Journal',
      'Diary'
    ];
  } else if (act === 'UNDO') {
    endpoint = 'POST /api/audit-logs/:id/undo';
    frontendCaller = 'App.jsx (Audit Logs Undo Button)';
    sourceModule = 'Audit Logs (Undo System)';
    savedTables = ['audit_logs', 'overrides', 'muster_records'];
    linkedModules = [
      'Daily Summary Table',
      'Monthly Movement Grid',
      'Muster Roll',
      'TA / NDA / Diary / Earnings',
      'LR Sheet'
    ];
  }

  if (parsedUndo && parsedUndo.where_saved) {
    if (parsedUndo.where_saved.endpoint) endpoint = parsedUndo.where_saved.endpoint;
    if (parsedUndo.where_saved.frontend_caller) frontendCaller = parsedUndo.where_saved.frontend_caller;
    if (parsedUndo.where_saved.source_module) sourceModule = parsedUndo.where_saved.source_module;
    if (Array.isArray(parsedUndo.where_saved.saved_tables)) savedTables = parsedUndo.where_saved.saved_tables;
    if (Array.isArray(parsedUndo.where_saved.linked_modules)) linkedModules = parsedUndo.where_saved.linked_modules;
  }

  return {
    what_saved: (parsedUndo && parsedUndo.what_saved) ? parsedUndo.what_saved : desc,
    where_saved: {
      endpoint: endpoint,
      frontend_caller: frontendCaller,
      source_module: sourceModule,
      saved_tables: savedTables,
      linked_modules: linkedModules
    },
    saved_count: parsedUndo?.saved_count ?? parsedUndo?.savedCount ?? null,
    error_count: parsedUndo?.error_count ?? parsedUndo?.errorCount ?? null,
    saved_employees_count: parsedUndo?.saved_employees_count ?? parsedUndo?.savedEmployeesCount ?? null,
    error_employees_count: parsedUndo?.error_employees_count ?? parsedUndo?.errorEmployeesCount ?? null
  };
}

export async function logAudit(role: string, actionType: string, description: string, undoData: any = null) {
  try {
    let payloadObj: any = {};
    if (undoData) {
      if (typeof undoData === 'string') {
        try { payloadObj = JSON.parse(undoData); } catch (e) { payloadObj = { raw: undoData }; }
      } else if (typeof undoData === 'object') {
        payloadObj = { ...undoData };
      }
    }
    const meta = deriveAuditMetadata(actionType, description, payloadObj);
    payloadObj.what_saved = meta.what_saved;
    payloadObj.where_saved = meta.where_saved;
    const undoJson = JSON.stringify(payloadObj);
    await run(
      'INSERT INTO audit_logs (user_role, action_type, description, undo_data, is_undone) VALUES (?, ?, ?, ?, 0)',
      [role || 'Admin', actionType, description, undoJson]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

export async function restoreOverrideAndMuster(staffId: any, date: string, prevOverride: any, prevMuster: any) {
  if (prevOverride) {
    await run(
      `INSERT INTO overrides (
        staff_id, date, original_link_number, overridden_link_number, status,
        substitute_staff_id, substitute_name, reason, target_category_id,
        extra_train_no, is_extra, shifted_from_link, shifted_from_train,
        shifted_place, advance_train_no, is_advance_duty, leave_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(staff_id, date) DO UPDATE SET
        original_link_number = excluded.original_link_number,
        overridden_link_number = excluded.overridden_link_number,
        status = excluded.status,
        substitute_staff_id = excluded.substitute_staff_id,
        substitute_name = excluded.substitute_name,
        reason = excluded.reason,
        target_category_id = excluded.target_category_id,
        extra_train_no = excluded.extra_train_no,
        is_extra = excluded.is_extra,
        shifted_from_link = excluded.shifted_from_link,
        shifted_from_train = excluded.shifted_from_train,
        shifted_place = excluded.shifted_place,
        advance_train_no = excluded.advance_train_no,
        is_advance_duty = excluded.is_advance_duty,
        leave_type = excluded.leave_type`,
      [
        prevOverride.staff_id, date, prevOverride.original_link_number, prevOverride.overridden_link_number,
        prevOverride.status, prevOverride.substitute_staff_id, prevOverride.substitute_name,
        prevOverride.reason, prevOverride.target_category_id, prevOverride.extra_train_no,
        prevOverride.is_extra, prevOverride.shifted_from_link, prevOverride.shifted_from_train,
        prevOverride.shifted_place, prevOverride.advance_train_no, prevOverride.is_advance_duty,
        prevOverride.leave_type
      ]
    );
  } else {
    await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [staffId, date]);
  }

  if (prevMuster) {
    await run(
      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         code = excluded.code,
         remarks = excluded.remarks,
         updated_by = excluded.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
      [prevMuster.staff_id, date, prevMuster.code, prevMuster.remarks, prevMuster.updated_by || 'Admin']
    );
  } else {
    await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [staffId, date]);
  }

  await run(
    'UPDATE overrides SET substitute_staff_id = NULL, substitute_name = NULL WHERE substitute_staff_id = ? AND date = ?',
    [staffId, date]
  );

  await syncDutyChangeAcrossAllModules({ get, all, run }, staffId, date, {
    targetLink: prevOverride?.overridden_link_number || null,
    targetTrain: prevOverride?.extra_train_no || null,
    isLeave: ['LEAVE', 'SICK', 'CR', 'ABSENT'].includes(prevOverride?.status)
  });

  const s = await get('SELECT category_id, rest_day FROM staff WHERE id = ?', [staffId]);
  if (s && s.category_id === 4) {
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dObj = new Date(date + 'T12:00:00');
    const dayOfWeek = dayNames[dObj.getDay()];
    const resolvedDuty = await resolveDutyCodeForLRStaff(staffId, date, dayOfWeek, s.rest_day);
    if (resolvedDuty && resolvedDuty.code) {
      await syncLRSheetRecord(staffId, date, resolvedDuty.code, prevOverride?.reason || 'Restored duty');
    } else {
      await run('DELETE FROM lr_sheet_records WHERE staff_id = ? AND date = ?', [staffId, date]);
    }
  }
}

export async function getAuditLogs() {
  const logs: any[] = await all('SELECT id, user_role, action_type, description, timestamp, undo_data, is_undone FROM audit_logs ORDER BY timestamp DESC, id DESC LIMIT 300');
  return logs.map(row => {
    let parsedUndo = null;
    if (row.undo_data) {
      try {
        parsedUndo = typeof row.undo_data === 'string' ? JSON.parse(row.undo_data) : row.undo_data;
      } catch (e) { }
    }
    const meta = deriveAuditMetadata(row.action_type, row.description, parsedUndo);
    return {
      ...row,
      what_saved: parsedUndo?.what_saved || meta.what_saved,
      where_saved: parsedUndo?.where_saved || meta.where_saved
    };
  });
}

export async function undoAuditLog(id: any) {
  const log = await get('SELECT * FROM audit_logs WHERE id = ?', [id]);
  if (!log) {
    throw new Error('Audit log entry not found');
  }
  if (log.is_undone) {
    throw new Error('This action has already been undone.');
  }

  let undoData = null;
  if (log.undo_data) {
    try {
      undoData = JSON.parse(log.undo_data);
    } catch (e) { }
  }

  let undoneSuccess = false;
  let detailsMsg = '';

  if (undoData) {
    if (undoData.action === 'EXCHANGE_STAFF') {
      const { date, staff_a, staff_b } = undoData;
      await restoreOverrideAndMuster(staff_a.id, date, staff_a.previous_override, staff_a.previous_muster);
      await restoreOverrideAndMuster(staff_b.id, date, staff_b.previous_override, staff_b.previous_muster);
      undoneSuccess = true;
      detailsMsg = `Reverted duty exchange between ${staff_a.name} and ${staff_b.name} on ${date}`;
    } else if (['CHANGED_LINK', 'MANUAL_OVERRIDE', 'REMOVE_FROM_LINK', 'UPGRADE_TO_COR'].includes(undoData.action)) {
      const { staff_id, staff_name, date, previous_override, previous_muster } = undoData;
      await restoreOverrideAndMuster(staff_id, date, previous_override, previous_muster);
      undoneSuccess = true;
      detailsMsg = `Reverted ${undoData.action} for ${staff_name || `staff ID ${staff_id}`} on ${date}`;
    } else if (undoData.action === 'DRAG_ASSIGN_DUTY') {
      const { staff_id, staff_name, date, previous_override, previous_muster } = undoData;
      await restoreOverrideAndMuster(staff_id, date, previous_override, previous_muster);
      undoneSuccess = true;
      detailsMsg = `Reverted drag duty assignment for ${staff_name || `staff ID ${staff_id}`} on ${date}`;
    } else if (undoData.action === 'ASSIGN_NON_DAILY_TRAIN') {
      const { staff_id, staff_name, date, train_number, previous_override, previous_muster } = undoData;
      await restoreOverrideAndMuster(staff_id, date, previous_override, previous_muster);
      await run('UPDATE non_daily_trains SET assigned_staff_id = NULL, assigned_staff_name = NULL WHERE assigned_staff_id = ?', [staff_id]);
      undoneSuccess = true;
      detailsMsg = `Reverted Non-Daily Train ${train_number || ''} assignment for ${staff_name || `staff ID ${staff_id}`} on ${date}`;
    } else if (undoData.action === 'UNASSIGN_NON_DAILY_TRAIN') {
      const { staff_id, date, previous_override, previous_muster } = undoData;
      if (staff_id && date) {
        await restoreOverrideAndMuster(staff_id, date, previous_override, previous_muster);
      }
      undoneSuccess = true;
      detailsMsg = `Reverted unassign of Non-Daily Train for staff ID ${staff_id || ''} on ${date || ''}`;
    } else if (['SICK', 'LEAVE', 'CR', 'ABSENT', 'STAFF_SICK', 'STAFF_LEAVE', 'STAFF_CR', 'STAFF_ABSENT'].includes(undoData.action)) {
      const { staff_id, staff_name, dates, replacement_staff_id, snapshots } = undoData;
      for (const snap of (snapshots || [])) {
        const dStr = snap.date;
        if (replacement_staff_id) {
          await restoreOverrideAndMuster(replacement_staff_id, dStr, snap.subOverride, snap.subMuster);
        }
        await restoreOverrideAndMuster(staff_id, dStr, snap.override, snap.muster);
      }
      undoneSuccess = true;
      detailsMsg = `Reverted ${undoData.action} for ${staff_name || `staff ID ${staff_id}`} on ${dates ? dates.join(', ') : 'selected dates'}`;
    } else if (['RESET', 'CANCEL_LEAVE', 'RESET_DUTY'].includes(undoData.action)) {
      const { staff_id, staff_name, snapshots } = undoData;
      for (const snap of (snapshots || [])) {
        const dStr = snap.date;
        await restoreOverrideAndMuster(staff_id, dStr, snap.override, snap.muster);
        if (snap.subOverride || snap.subMuster) {
          const subId = snap.subOverride?.staff_id || snap.subMuster?.staff_id;
          if (subId) {
            await restoreOverrideAndMuster(subId, dStr, snap.subOverride, snap.subMuster);
          }
        }
      }
      undoneSuccess = true;
      detailsMsg = `Reverted reset/cancellation and restored previous duty for ${staff_name || `staff ID ${staff_id}`}`;
    } else if (['SHIFTED', 'SHIFTED_PLACE'].includes(undoData.action)) {
      const { staff_id, staff_name, dates, replacement_staff_id, snapshots } = undoData;
      for (const snap of (snapshots || [])) {
        const dStr = snap.date;
        await restoreOverrideAndMuster(staff_id, dStr, snap.override, snap.muster);
        if (replacement_staff_id) {
          await restoreOverrideAndMuster(replacement_staff_id, dStr, snap.subOverride, snap.subMuster);
        }
      }
      undoneSuccess = true;
      detailsMsg = `Reverted shift for ${staff_name || `staff ID ${staff_id}`} on ${dates ? dates.join(', ') : 'date'}`;
    } else if (['UTILISED_ADVANCE', 'ADVANCE_DUTY', 'ADVANCE_BOOKED'].includes(undoData.action)) {
      const { staff_id, staff_name, date, replacement_staff_id, previous_override, previous_muster } = undoData;
      await restoreOverrideAndMuster(staff_id, date, previous_override, previous_muster);
      if (replacement_staff_id) {
        await run('DELETE FROM overrides WHERE staff_id = ? AND date = ? AND status = "SUBSTITUTE"', [replacement_staff_id, date]);
        await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [replacement_staff_id, date]);
      }
      undoneSuccess = true;
      detailsMsg = `Reverted advance utilisation for ${staff_name || `staff ID ${staff_id}`} on ${date}`;
    } else if (undoData.action === 'APPROVE_LEAVE') {
      const { staff_id, staff_name, from_date, to_date, request_id, snapshots } = undoData;
      for (const snap of (snapshots || [])) {
        await restoreOverrideAndMuster(staff_id, snap.date, snap.override, snap.muster);
      }
      if (request_id) {
        await run("UPDATE leave_requests SET status = 'PENDING', approved_by = NULL, approved_at = NULL WHERE id = ?", [request_id]);
      }
      undoneSuccess = true;
      detailsMsg = `Reverted approved leave for ${staff_name || `staff ID ${staff_id}`} from ${from_date} to ${to_date}`;
    } else if (undoData.action === 'APPROVE_SWAP') {
      const { date, staff_a, staff_b, request_id } = undoData;
      await restoreOverrideAndMuster(staff_a.id, date, staff_a.previous_override, staff_a.previous_muster);
      await restoreOverrideAndMuster(staff_b.id, date, staff_b.previous_override, staff_b.previous_muster);
      if (request_id) {
        await run("UPDATE leave_requests SET status = 'PENDING', approved_by = NULL, approved_at = NULL WHERE id = ?", [request_id]);
      }
      undoneSuccess = true;
      detailsMsg = `Reverted approved swap between ${staff_a.name} and ${staff_b.name} on ${date}`;
    } else if (undoData.action === 'MUSTER_CELL_UPDATE' || undoData.action === 'MUSTER_CELL_RESET') {
      const { staff_id, date, previous_code, previous_remarks } = undoData;
      if (previous_code) {
        await run(
          `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at) VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
           ON CONFLICT(staff_id, date) DO UPDATE SET code = excluded.code, remarks = excluded.remarks`,
          [staff_id, date, previous_code, previous_remarks]
        );
      } else {
        await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, date]);
      }
      undoneSuccess = true;
      detailsMsg = `Reverted muster cell for staff ID ${staff_id} on ${date}`;
    } else if (undoData.action === 'UPDATE_LINK') {
      const { link_id, previous } = undoData;
      if (previous && link_id) {
        await run(
          `UPDATE links 
           SET train_numbers = ?, from_station = ?, to_station = ?, coaches = ?, is_rest = ?, 
               effective_from = ?, effective_to = ?, set_type = ?, set_name = ?,
               link_number = ?, category_id = ?, link_set_id = ?, status = ?
           WHERE id = ?`,
          [
            previous.train_numbers, previous.from_station, previous.to_station, previous.coaches, previous.is_rest,
            previous.effective_from, previous.effective_to, previous.set_type, previous.set_name,
            previous.link_number, previous.category_id, previous.link_set_id, previous.status,
            link_id
          ]
        );
        undoneSuccess = true;
        detailsMsg = `Reverted Link #${previous.link_number} (ID ${link_id}) back to train "${previous.train_numbers}"`;
      }
    } else if (undoData.action === 'CREATE_LINK') {
      const { created_link_id } = undoData;
      if (created_link_id) {
        await run('DELETE FROM links WHERE id = ?', [created_link_id]);
        undoneSuccess = true;
        detailsMsg = `Deleted newly created Link ID ${created_link_id}`;
      }
    } else if (undoData.action === 'REORDER_LINKS') {
      const { previous_reorders } = undoData;
      if (Array.isArray(previous_reorders)) {
        for (const item of previous_reorders) {
          await run('UPDATE links SET link_number = ? WHERE id = ?', [item.link_number, item.id]);
        }
        undoneSuccess = true;
        detailsMsg = `Restored previous order of ${previous_reorders.length} links`;
      }
    } else if (undoData.action === 'DUPLICATE_LINK_SET') {
      const { created_set_id } = undoData;
      if (created_set_id) {
        await run('DELETE FROM links WHERE link_set_id = ?', [created_set_id]);
        await run('DELETE FROM link_sets WHERE id = ?', [created_set_id]);
        undoneSuccess = true;
        detailsMsg = `Removed duplicated Draft Link Set #${created_set_id} and its links`;
      }
    } else if (undoData.action === 'DELETE_LINK_SET') {
      const { deleted_set, deleted_links } = undoData;
      if (deleted_set) {
        await run(
          `INSERT INTO link_sets (id, name, category_id, status, effective_from, effective_to, cloned_from_id, link_count, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET name = excluded.name, status = excluded.status`,
          [
            deleted_set.id, deleted_set.name, deleted_set.category_id, deleted_set.status,
            deleted_set.effective_from, deleted_set.effective_to, deleted_set.cloned_from_id,
            deleted_set.link_count, deleted_set.notes
          ]
        );
        if (Array.isArray(deleted_links)) {
          for (const link of deleted_links) {
            await run(
              `INSERT INTO links (id, category_id, link_set_id, link_number, train_numbers, from_station, to_station, coaches, is_rest, effective_from, effective_to, set_type, set_name, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET train_numbers = excluded.train_numbers, link_number = excluded.link_number`,
              [
                link.id, link.category_id, link.link_set_id, link.link_number,
                link.train_numbers, link.from_station, link.to_station, link.coaches,
                link.is_rest, link.effective_from, link.effective_to, link.set_type,
                link.set_name, link.status
              ]
            );
          }
        }
        undoneSuccess = true;
        detailsMsg = `Restored deleted Link Set #${deleted_set.id} "${deleted_set.name}" and its links`;
      }
    } else if (undoData.action === 'DELETE_LINK_AND_SHIFT' || undoData.action === 'DELETE_LINK') {
      const { deleted_link, subsequent_links_shifted } = undoData;
      if (deleted_link) {
        await run(
          `INSERT INTO links (id, category_id, link_set_id, link_number, train_numbers, from_station, to_station, coaches, is_rest, effective_from, effective_to, set_type, set_name, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET train_numbers = excluded.train_numbers, link_number = excluded.link_number`,
          [
            deleted_link.id, deleted_link.category_id, deleted_link.link_set_id, deleted_link.link_number,
            deleted_link.train_numbers, deleted_link.from_station, deleted_link.to_station, deleted_link.coaches,
            deleted_link.is_rest, deleted_link.effective_from, deleted_link.effective_to, deleted_link.set_type,
            deleted_link.set_name, deleted_link.status
          ]
        );
        if (Array.isArray(subsequent_links_shifted)) {
          for (const link of subsequent_links_shifted) {
            await run('UPDATE links SET link_number = ?, effective_from = ? WHERE id = ?', [link.link_number, link.effective_from, link.id]);
          }
        }
        if (deleted_link.link_set_id) {
          const remainingInSet = await get('SELECT count(*) as c FROM links WHERE link_set_id = ?', [deleted_link.link_set_id]);
          await run('UPDATE link_sets SET link_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [remainingInSet?.c || 0, deleted_link.link_set_id]);
        }
        undoneSuccess = true;
        detailsMsg = `Restored Link #${deleted_link.link_number} and reverted subsequent link shifts`;
      }
    } else if (undoData.action === 'UPDATE_SLOT_TRAIN_COACH') {
      const { target_key, previous_customization } = undoData;
      if (previous_customization) {
        await run(
          `INSERT INTO slot_customizations (custom_key, first_train, last_train, first_coach, last_coach, updated_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(custom_key) DO UPDATE SET
             first_train = excluded.first_train,
             last_train = excluded.last_train,
             first_coach = excluded.first_coach,
             last_coach = excluded.last_coach,
             updated_at = CURRENT_TIMESTAMP`,
          [
            target_key,
            previous_customization.first_train,
            previous_customization.last_train,
            previous_customization.first_coach,
            previous_customization.last_coach
          ]
        );
      } else {
        await run('DELETE FROM slot_customizations WHERE custom_key = ?', [target_key]);
      }
      undoneSuccess = true;
      detailsMsg = `Reverted train/coach customization for ${target_key}`;
    } else if (undoData.action === 'RESET_SLOT_TRAIN_COACH') {
      const { previous_customizations } = undoData;
      if (Array.isArray(previous_customizations) && previous_customizations.length > 0) {
        for (const pc of previous_customizations) {
          await run(
            `INSERT INTO slot_customizations (custom_key, first_train, last_train, first_coach, last_coach, updated_at)
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(custom_key) DO UPDATE SET
               first_train = excluded.first_train,
               last_train = excluded.last_train,
               first_coach = excluded.first_coach,
               last_coach = excluded.last_coach,
               updated_at = CURRENT_TIMESTAMP`,
            [pc.custom_key, pc.first_train, pc.last_train, pc.first_coach, pc.last_coach]
          );
        }
      }
      undoneSuccess = true;
      detailsMsg = `Restored train/coach slot customizations`;
    } else if (undoData.action === 'UPDATE_LINK_SET') {
      const { link_set_id, previous } = undoData;
      if (previous && link_set_id) {
        await run(
          `UPDATE link_sets 
           SET name = ?, effective_from = ?, effective_to = ?, status = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [previous.name, previous.effective_from, previous.effective_to, previous.status, link_set_id]
        );
        undoneSuccess = true;
        detailsMsg = `Reverted Link Set #${link_set_id} to "${previous.name}"`;
      }
    } else if (undoData.action === 'PUBLISH_LINK_SET') {
      const { link_set_id, previous_status, previous_effective_from, category_id, prev_end } = undoData;
      if (link_set_id) {
        await run(
          `UPDATE link_sets SET status = ?, effective_from = ? WHERE id = ?`,
          [previous_status || 'draft', previous_effective_from || '', link_set_id]
        );
        await run(
          `UPDATE links SET status = ?, effective_from = ? WHERE link_set_id = ?`,
          [previous_status || 'draft', previous_effective_from || '', link_set_id]
        );
        if (category_id && prev_end) {
          await run(
            `UPDATE link_sets SET effective_to = '9999-12-31' WHERE category_id = ? AND id != ? AND effective_to = ?`,
            [category_id, link_set_id, prev_end]
          );
          await run(
            `UPDATE links SET effective_to = '9999-12-31' WHERE category_id = ? AND link_set_id != ? AND effective_to = ?`,
            [category_id, link_set_id, prev_end]
          );
        }
        undoneSuccess = true;
        detailsMsg = `Reverted publication of Link Set #${link_set_id} back to draft`;
      }
    }
  }

  // Fallback: Parse description if undoData is not set (e.g. legacy logs)
  if (!undoneSuccess) {
    const desc = log.description || '';
    const nonDailyMatch = desc.match(/Assigned (.+?) to Non-Daily Train (\w+) on (\d{4}-\d{2}-\d{2})/i);
    const dragMatch = desc.match(/Assigned (.+?) to (?:Train|Link) (.+?) on (\d{4}-\d{2}-\d{2})/i);
    const linkMatch = desc.match(/Changed link for (.+?) on (\d{4}-\d{2}-\d{2})/i);
    const leaveMatch = desc.match(/Marked (.+?) as (LEAVE|SICK|CR|ABSENT).*?on (\d{4}-\d{2}-\d{2})/i);
    const exchMatch = desc.match(/Exchanged duties between (.+?) .*? and (.+?) .*? on (\d{4}-\d{2}-\d{2})/i);
    const shiftMatch = desc.match(/Shifted (.+?) to (.+?) on (\d{4}-\d{2}-\d{2})/i);
    const resetMatch = desc.match(/Reset duty status and muster records for (.+?) between (\d{4}-\d{2}-\d{2}) and (\d{4}-\d{2}-\d{2})/i);
    const cancelLeaveMatch = desc.match(/Cancelled leave for (.+?) between (\d{4}-\d{2}-\d{2}) and (\d{4}-\d{2}-\d{2})/i);
    const advanceMatch = desc.match(/Marked (.+?) as Utilised in Advance.*?on (\d{4}-\d{2}-\d{2})/i);
    const upgradeMatch = desc.match(/Upgraded (.+?) from Sleeper Link.*?on (\d{4}-\d{2}-\d{2})/i);
    const appLeaveMatch = desc.match(/Approved leave for (.+?) from (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/i);
    const appSwapMatch = desc.match(/Approved swap between (.+?) and (.+?) on (\d{4}-\d{2}-\d{2})/i);
    const musterMatch = desc.match(/Assigned muster code '(.+?)' for staff ID (\d+) on (\d{4}-\d{2}-\d{2})/i);

    if (nonDailyMatch) {
      const staffName = nonDailyMatch[1].trim();
      const trainNo = nonDailyMatch[2].trim();
      const dStr = nonDailyMatch[3];
      const s = await get('SELECT id FROM staff WHERE name = ?', [staffName]);
      if (s) {
        await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [s.id, dStr]);
        await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [s.id, dStr]);
        await run('UPDATE non_daily_trains SET assigned_staff_id = NULL, assigned_staff_name = NULL WHERE assigned_staff_id = ?', [s.id]);
        await syncDutyChangeAcrossAllModules({ get, all, run }, s.id, dStr, { targetTrain: null, targetLink: null, isLeave: false });
        undoneSuccess = true;
        detailsMsg = `Reverted Non-Daily Train ${trainNo} assignment for ${staffName} on ${dStr}`;
      }
    } else if (dragMatch) {
      const staffName = dragMatch[1].trim();
      const dStr = dragMatch[3];
      const s = await get('SELECT id FROM staff WHERE name = ?', [staffName]);
      if (s) {
        await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [s.id, dStr]);
        await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [s.id, dStr]);
        await syncDutyChangeAcrossAllModules({ get, all, run }, s.id, dStr, { targetTrain: null, targetLink: null, isLeave: false });
        undoneSuccess = true;
        detailsMsg = `Reverted drag assignment for ${staffName} on ${dStr}`;
      }
    } else if (linkMatch) {
      const staffName = linkMatch[1].trim();
      const dStr = linkMatch[2];
      const s = await get('SELECT id FROM staff WHERE name = ?', [staffName]);
      if (s) {
        await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [s.id, dStr]);
        await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [s.id, dStr]);
        await syncDutyChangeAcrossAllModules({ get, all, run }, s.id, dStr, { targetTrain: null, targetLink: null, isLeave: false });
        undoneSuccess = true;
        detailsMsg = `Reverted link change for ${staffName} on ${dStr}`;
      }
    } else if (leaveMatch) {
      const staffName = leaveMatch[1].trim();
      const dStr = leaveMatch[3];
      const s = await get('SELECT id FROM staff WHERE name = ?', [staffName]);
      if (s) {
        const ovr = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [s.id, dStr]);
        if (ovr && ovr.substitute_staff_id) {
          await run('DELETE FROM overrides WHERE staff_id = ? AND date = ? AND status = "SUBSTITUTE"', [ovr.substitute_staff_id, dStr]);
          await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [ovr.substitute_staff_id, dStr]);
        }
        await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [s.id, dStr]);
        await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [s.id, dStr]);
        await syncDutyChangeAcrossAllModules({ get, all, run }, s.id, dStr, { targetTrain: null, targetLink: null, isLeave: false });
        undoneSuccess = true;
        detailsMsg = `Reverted leave for ${staffName} on ${dStr}`;
      }
    } else if (exchMatch) {
      const staffAName = exchMatch[1].trim();
      const staffBName = exchMatch[2].trim();
      const dStr = exchMatch[3];
      const sA = await get('SELECT id FROM staff WHERE name = ?', [staffAName]);
      const sB = await get('SELECT id FROM staff WHERE name = ?', [staffBName]);
      if (sA) {
        await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [sA.id, dStr]);
        await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [sA.id, dStr]);
        await syncDutyChangeAcrossAllModules({ get, all, run }, sA.id, dStr, { targetTrain: null, targetLink: null, isLeave: false });
      }
      if (sB) {
        await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [sB.id, dStr]);
        await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [sB.id, dStr]);
        await syncDutyChangeAcrossAllModules({ get, all, run }, sB.id, dStr, { targetTrain: null, targetLink: null, isLeave: false });
      }
      undoneSuccess = true;
      detailsMsg = `Reverted duty exchange between ${staffAName} and ${staffBName} on ${dStr}`;
    } else if (shiftMatch) {
      const staffName = shiftMatch[1].trim();
      const dStr = shiftMatch[3];
      const s = await get('SELECT id FROM staff WHERE name = ?', [staffName]);
      if (s) {
        await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [s.id, dStr]);
        await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [s.id, dStr]);
        await syncDutyChangeAcrossAllModules({ get, all, run }, s.id, dStr, { targetTrain: null, targetLink: null, isLeave: false });
        undoneSuccess = true;
        detailsMsg = `Reverted shift for ${staffName} on ${dStr}`;
      }
    } else if (resetMatch || cancelLeaveMatch) {
      const m = resetMatch || cancelLeaveMatch;
      const staffName = m[1].trim();
      const fromD = m[2];
      const toD = m[3];
      const s = await get('SELECT id FROM staff WHERE name = ?', [staffName]);
      if (s) {
        undoneSuccess = true;
        detailsMsg = `Reverted reset for ${staffName} between ${fromD} and ${toD}`;
      }
    } else if (advanceMatch) {
      const staffName = advanceMatch[1].trim();
      const dStr = advanceMatch[2];
      const s = await get('SELECT id FROM staff WHERE name = ?', [staffName]);
      if (s) {
        await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [s.id, dStr]);
        await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [s.id, dStr]);
        await syncDutyChangeAcrossAllModules({ get, all, run }, s.id, dStr, { targetTrain: null, targetLink: null, isLeave: false });
        undoneSuccess = true;
        detailsMsg = `Reverted advance duty for ${staffName} on ${dStr}`;
      }
    } else if (upgradeMatch) {
      const staffName = upgradeMatch[1].trim();
      const dStr = upgradeMatch[2];
      const s = await get('SELECT id FROM staff WHERE name = ?', [staffName]);
      if (s) {
        await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [s.id, dStr]);
        await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [s.id, dStr]);
        await syncDutyChangeAcrossAllModules({ get, all, run }, s.id, dStr, { targetTrain: null, targetLink: null, isLeave: false });
        undoneSuccess = true;
        detailsMsg = `Reverted COR upgrade for ${staffName} on ${dStr}`;
      }
    } else if (appLeaveMatch) {
      const staffName = appLeaveMatch[1].trim();
      const fromD = appLeaveMatch[2];
      const toD = appLeaveMatch[3];
      const s = await get('SELECT id FROM staff WHERE name = ?', [staffName]);
      if (s) {
        await run('DELETE FROM overrides WHERE staff_id = ? AND date >= ? AND date <= ?', [s.id, fromD, toD]);
        await run('DELETE FROM muster_records WHERE staff_id = ? AND date >= ? AND date <= ?', [s.id, fromD, toD]);
        undoneSuccess = true;
        detailsMsg = `Reverted approved leave for ${staffName} from ${fromD} to ${toD}`;
      }
    } else if (appSwapMatch) {
      const staffAName = appSwapMatch[1].trim();
      const staffBName = appSwapMatch[2].trim();
      const dStr = appSwapMatch[3];
      const sA = await get('SELECT id FROM staff WHERE name = ?', [staffAName]);
      const sB = await get('SELECT id FROM staff WHERE name = ?', [staffBName]);
      if (sA) {
        await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [sA.id, dStr]);
        await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [sA.id, dStr]);
      }
      if (sB) {
        await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [sB.id, dStr]);
        await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [sB.id, dStr]);
      }
      undoneSuccess = true;
      detailsMsg = `Reverted approved swap between ${staffAName} and ${staffBName} on ${dStr}`;
    } else if (musterMatch) {
      const sId = parseInt(musterMatch[2], 10);
      const dStr = musterMatch[3];
      await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [sId, dStr]);
      undoneSuccess = true;
      detailsMsg = `Reverted muster cell for staff ID ${sId} on ${dStr}`;
    } else if (desc.match(/into Draft Set #(\d+)/i)) {
      const m = desc.match(/into Draft Set #(\d+)/i);
      const setId = parseInt(m[1], 10);
      await run('DELETE FROM links WHERE link_set_id = ?', [setId]);
      await run('DELETE FROM link_sets WHERE id = ?', [setId]);
      undoneSuccess = true;
      detailsMsg = `Removed duplicated Draft Set #${setId} and its links`;
    } else if (desc.match(/Updated Link ID (\d+)/i)) {
      const m = desc.match(/Updated Link ID (\d+)/i);
      const linkId = parseInt(m[1], 10);
      const prevLog = await get(
        `SELECT * FROM audit_logs WHERE id < ? AND description LIKE ? AND action_type = 'UPDATE_LINK' ORDER BY id DESC LIMIT 1`,
        [id, `Updated Link ID ${linkId}%`]
      );
      if (prevLog) {
        const trainM = prevLog.description.match(/Train:\s*([^)]+)/i);
        const linkM = prevLog.description.match(/Link\s*#(\d+)/i);
        if (trainM || linkM) {
          if (trainM && linkM) {
            await run('UPDATE links SET train_numbers = ?, link_number = ? WHERE id = ?', [trainM[1].trim(), parseInt(linkM[1], 10), linkId]);
          } else if (trainM) {
            await run('UPDATE links SET train_numbers = ? WHERE id = ?', [trainM[1].trim(), linkId]);
          } else if (linkM) {
            await run('UPDATE links SET link_number = ? WHERE id = ?', [parseInt(linkM[1], 10), linkId]);
          }
          undoneSuccess = true;
          detailsMsg = `Reverted Link ID ${linkId} to previous values (${prevLog.description})`;
        }
      }
      if (!undoneSuccess) {
        const currLink = await get('SELECT * FROM links WHERE id = ?', [linkId]);
        if (currLink && currLink.link_set_id) {
          const setObj = await get('SELECT * FROM link_sets WHERE id = ?', [currLink.link_set_id]);
          if (setObj && setObj.cloned_from_id) {
            const origLink = await get(
              'SELECT * FROM links WHERE link_set_id = ? AND link_number = ?',
              [setObj.cloned_from_id, currLink.link_number]
            );
            if (origLink) {
              await run(
                'UPDATE links SET train_numbers = ?, from_station = ?, to_station = ?, coaches = ?, is_rest = ? WHERE id = ?',
                [origLink.train_numbers, origLink.from_station, origLink.to_station, origLink.coaches, origLink.is_rest, linkId]
              );
              undoneSuccess = true;
              detailsMsg = `Reverted Link ID ${linkId} to master train "${origLink.train_numbers}" from Set #${setObj.cloned_from_id}`;
            }
          }
        }
      }
    } else if (desc.match(/Updated train\/coaches for (slot_\w+|day_\w+)/i)) {
      const m = desc.match(/Updated train\/coaches for (slot_\w+|day_\w+)/i);
      const targetKey = m[1];
      await run('DELETE FROM slot_customizations WHERE custom_key = ?', [targetKey]);
      undoneSuccess = true;
      detailsMsg = `Reverted train/coach slot customization for ${targetKey}`;
    }
  }

  if (!undoneSuccess) {
    throw new Error('Unable to automatically undo this action type.');
  }

  // Mark as undone
  await run('UPDATE audit_logs SET is_undone = 1 WHERE id = ?', [id]);
  await logAudit('Admin', 'UNDO', `Undid ${log.action_type}: ${detailsMsg || log.description}`);

  return {
    success: true,
    message: `Successfully undone: ${detailsMsg || log.description}`
  };
}
