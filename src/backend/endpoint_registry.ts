/**
 * ============================================================================
 * RAILWAY ROSTER MANAGER — MASTER BACKEND ENDPOINT & DATA-FLOW REGISTRY
 * ============================================================================
 *
 * Purpose:
 *   Provides a single, crystal-clear reference of EVERY API endpoint in the
 *   backend (`src/backend/server.js`), showing:
 *     1. Which Frontend screen/component calls the endpoint (`frontend_caller`)
 *     2. Which SQLite database table(s) the data is read from (`reads_from_tables`)
 *     3. Which SQLite database table(s) the data is saved to (`saves_to_tables`)
 *     4. Which linked database tables & UI modules automatically receive the
 *        cascaded/synchronized updates (`cascades_to_tables`, `synced_ui_modules`)
 *
 * Universal Multi-Directional Sync Architecture:
 *   ┌──────────────────────────┐      ┌──────────────────────────┐
 *   │   Daily Summary Table    │◄────►│  Monthly Movement Grid   │
 *   │      (overrides)         │      │ (overrides / rest_rules) │
 *   └────────────┬─────────────┘      └─────────────┬────────────┘
 *                │                                  │
 *                ▼                                  ▼
 *   ┌────────────────────────────────────────────────────────────┐
 *   │    Central Sync Engine (server.js)                         │
 *   │    • syncDutyChangeAcrossAllModules()                      │
 *   │    • syncDocumentsAndEarningsForStaffDate()                │
 *   │    • syncMusterToSchedulesAndApprovals()                   │
 *   │    • syncLRSheetCellChange()                               │
 *   └────┬─────────┬──────────┬──────────┬──────────┬────────────┘
 *        │         │          │          │          │
 *        ▼         ▼          ▼          ▼          ▼
 *   ┌─────────┐ ┌──────┐ ┌─────────┐ ┌────────┐ ┌────────────────┐
 *   │ Muster  │ │  LR  │ │   TA    │ │  NDA & │ │ Daily Earnings │
 *   │  Roll   │ │Sheet │ │Approvals│ │ Diary  │ │  & Audit Logs  │
 *   └─────────┘ └──────┘ └─────────┘ └────────┘ └────────────────┘
 * ============================================================================
 */

const ALL_LINKED_ROSTER_MODULES = [
  'Daily Summary Table (overrides)',
  'Monthly Movement Grid (overrides)',
  'Muster Roll & Individual Muster (muster_records)',
  'TA Approvals & TA Journal (ta_approvals, ta_entries)',
  'NDA Journal (nda_entries)',
  'Staff Diary (diary_entries)',
  'Daily Earnings Sheet (daily_earnings_entries)',
  'Leave / Swap Register (overrides, leave_requests)',
  'Leave Reserve Sheet (lr_sheet_records)',
  'Audit Logs (audit_logs)'
];

const ENDPOINT_GROUPS = [
  // ==========================================================================
  // GROUP 1: DAILY SUMMARY TABLE, DUTY OVERRIDES & STAFF SWAPS
  // ==========================================================================
  {
    group_id: 'daily_summary_and_duty_overrides',
    group_title: '1. Daily Summary Table, Duty Overrides & Staff Swaps',
    group_description: 'Handles all daily movement edits, duty status changes (Working, Leave, Spare, Rest), substitute assignments, train drag-and-drop, and two-employee duty exchanges.',
    primary_tables: ['overrides', 'duty_register'],
    endpoints: [
      {
        method: 'POST',
        endpoint: '/api/duty/change-status',
        module: 'Daily Summary & Monthly Movement',
        frontend_caller: 'App.jsx -> Daily Summary Table / Monthly Movement Grid Cell Edit / Change Duty Modal',
        reads_from_tables: ['staff', 'links', 'overrides', 'train_ta_nda'],
        saves_to_tables: ['overrides'],
        cascades_to_tables: [
          'muster_records',
          'lr_sheet_records',
          'ta_approvals',
          'ta_entries',
          'nda_entries',
          'diary_entries',
          'daily_earnings_entries',
          'duty_register',
          'audit_logs'
        ],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Primary endpoint when changing any staff duty, marking Leave/Rest/Spare, assigning a substitute (LR/Spare), or assigning extra/advance trains. Saves to `overrides` and cascades to Muster, LR Sheet, TA, NDA, Diary, Daily Earnings, and Audit Logs.'
      },
      {
        method: 'POST',
        endpoint: '/api/overrides',
        module: 'Daily Summary & Duty Overrides',
        frontend_caller: 'App.jsx -> Direct Override Save',
        reads_from_tables: ['overrides', 'staff'],
        saves_to_tables: ['overrides'],
        cascades_to_tables: [
          'muster_records',
          'lr_sheet_records',
          'ta_approvals',
          'ta_entries',
          'nda_entries',
          'diary_entries',
          'daily_earnings_entries',
          'audit_logs'
        ],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Creates or updates a direct date override in `overrides` and triggers universal cross-module synchronization.'
      },
      {
        method: 'POST',
        endpoint: '/api/duty/exchange-staff',
        module: 'Leave / Swap & Duty Exchange',
        frontend_caller: 'App.jsx -> Exchange / Swap Staff Modal',
        reads_from_tables: ['staff', 'links', 'overrides'],
        saves_to_tables: ['overrides', 'links'],
        cascades_to_tables: [
          'muster_records',
          'lr_sheet_records',
          'ta_approvals',
          'ta_entries',
          'nda_entries',
          'diary_entries',
          'daily_earnings_entries',
          'audit_logs'
        ],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Swaps duties between two employees (temporary date range in `overrides` or permanent link swap in `links`) and updates both employees across Muster, TA, NDA, Diary, Daily Earnings, and LR Sheet.'
      },
      {
        method: 'POST',
        endpoint: '/api/duty/drag-assign-train',
        module: 'Daily Summary & Train Assignment',
        frontend_caller: 'App.jsx -> Drag-and-Drop Train Assignment on Daily Summary / Availability Sheet',
        reads_from_tables: ['staff', 'links', 'overrides', 'non_daily_trains'],
        saves_to_tables: ['overrides', 'non_daily_assignments'],
        cascades_to_tables: [
          'muster_records',
          'lr_sheet_records',
          'ta_approvals',
          'ta_entries',
          'nda_entries',
          'diary_entries',
          'daily_earnings_entries',
          'audit_logs'
        ],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Assigns a regular or non-daily train to an employee on a specific date via drag-and-drop and syncs all downstream sheets.'
      },
      {
        method: 'POST',
        endpoint: '/api/duty/assign-non-daily-train',
        module: 'Daily Summary & Non-Daily Trains',
        frontend_caller: 'App.jsx -> Non-Daily Train Assignment Modal',
        reads_from_tables: ['non_daily_trains', 'non_daily_assignments', 'staff'],
        saves_to_tables: ['non_daily_assignments', 'overrides'],
        cascades_to_tables: [
          'muster_records',
          'lr_sheet_records',
          'ta_approvals',
          'ta_entries',
          'nda_entries',
          'diary_entries',
          'daily_earnings_entries',
          'audit_logs'
        ],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Assigns a non-daily train to a staff member on a date, writes to `non_daily_assignments` and `overrides`, and updates Muster, TA, NDA, Diary, and Earnings.'
      },
      {
        method: 'POST',
        endpoint: '/api/duty/unassign-non-daily-train',
        module: 'Daily Summary & Non-Daily Trains',
        frontend_caller: 'App.jsx -> Remove Non-Daily Train Assignment',
        reads_from_tables: ['non_daily_assignments', 'overrides'],
        saves_to_tables: ['non_daily_assignments', 'overrides'],
        cascades_to_tables: [
          'muster_records',
          'lr_sheet_records',
          'ta_approvals',
          'ta_entries',
          'nda_entries',
          'diary_entries',
          'daily_earnings_entries',
          'audit_logs'
        ],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Removes a non-daily train assignment and restores/resyncs the employee duty across all modules.'
      },
      {
        method: 'GET',
        endpoint: '/api/reports/daily-view',
        module: 'Daily Summary Table',
        frontend_caller: 'App.jsx -> fetchDailyView() (Daily Summary / Movement Tab)',
        reads_from_tables: ['staff', 'links', 'overrides', 'muster_records', 'lr_sheet_records', 'non_daily_assignments', 'leave_requests'],
        saves_to_tables: [],
        cascades_to_tables: [],
        synced_ui_modules: ['Daily Summary Table'],
        description: 'Computes the complete Daily Summary / Daily Movement sheet for a selected date by combining base links, overrides, Muster Roll, LR Sheet, and Non-Daily assignments.'
      },
      {
        method: 'GET',
        endpoint: '/api/reports/availability-sheet',
        module: 'Daily Availability Sheet',
        frontend_caller: 'App.jsx -> fetchAvailabilitySheet() (Spare / LR / Rest Availability)',
        reads_from_tables: ['staff', 'links', 'overrides', 'muster_records', 'lr_sheet_records'],
        saves_to_tables: [],
        cascades_to_tables: [],
        synced_ui_modules: ['Daily Availability Sheet'],
        description: 'Returns available Spare, Leave Reserve (LR), Rest, and On-Leave staff for a given date.'
      }
    ]
  },

  // ==========================================================================
  // GROUP 2: MONTHLY MOVEMENT & ROSTER SCHEDULE GRID
  // ==========================================================================
  {
    group_id: 'monthly_movement_and_roster',
    group_title: '2. Monthly Movement & Roster Schedule Grid',
    group_description: 'Generates the 30/31-day Monthly Movement Grid and manages weekly rest day changes and rest adjustments.',
    primary_tables: ['links', 'overrides', 'staff_rest_rules', 'roster_rest_adjustments'],
    endpoints: [
      {
        method: 'GET',
        endpoint: '/api/roster',
        module: 'Monthly Movement Grid',
        frontend_caller: 'App.jsx -> fetchRoster() (Monthly Movement Tab)',
        reads_from_tables: ['staff', 'links', 'overrides', 'muster_records', 'lr_sheet_records', 'staff_rest_rules', 'roster_rest_adjustments', 'non_daily_assignments'],
        saves_to_tables: [],
        cascades_to_tables: [],
        synced_ui_modules: ['Monthly Movement Grid'],
        description: 'Builds the full Monthly Movement matrix for all categories and employees for a date range, merging base link cycles with overrides, Muster Roll, and LR Sheet records.'
      },
      {
        method: 'POST',
        endpoint: '/api/roster/change-rest-day',
        module: 'Monthly Movement Grid (Rest Adjustment)',
        frontend_caller: 'App.jsx -> Rest Day Adjustment Modal',
        reads_from_tables: ['staff', 'links', 'roster_rest_adjustments'],
        saves_to_tables: ['roster_rest_adjustments', 'overrides'],
        cascades_to_tables: ['muster_records', 'ta_approvals', 'audit_logs'],
        synced_ui_modules: ['Monthly Movement Grid', 'Daily Summary Table', 'Muster Roll', 'Audit Logs'],
        description: 'Shifts an employee’s rest day in the Monthly Movement Grid and records the rest adjustment.'
      },
      {
        method: 'POST',
        endpoint: '/api/roster/reset-rest-adjustment',
        module: 'Monthly Movement Grid (Rest Adjustment)',
        frontend_caller: 'App.jsx -> Reset Rest Day Adjustment',
        reads_from_tables: ['roster_rest_adjustments'],
        saves_to_tables: ['roster_rest_adjustments', 'overrides'],
        cascades_to_tables: ['audit_logs'],
        synced_ui_modules: ['Monthly Movement Grid', 'Daily Summary Table', 'Audit Logs'],
        description: 'Resets a custom rest-day adjustment back to the base link cycle.'
      },
      {
        method: 'POST',
        endpoint: '/api/staff/:id/change-weekly-rest',
        module: 'Monthly Movement & Staff Rest Rules',
        frontend_caller: 'App.jsx -> Change Weekly Rest Rule',
        reads_from_tables: ['staff', 'staff_rest_rules'],
        saves_to_tables: ['staff_rest_rules', 'staff'],
        cascades_to_tables: ['audit_logs'],
        synced_ui_modules: ['Monthly Movement Grid', 'Daily Summary Table', 'Muster Roll', 'Audit Logs'],
        description: 'Updates the recurring weekly rest day rule for a staff member from an effective date onward.'
      }
    ]
  },

  // ==========================================================================
  // GROUP 3: LEAVE REQUESTS & LEAVE APPROVALS
  // ==========================================================================
  {
    group_id: 'leave_requests',
    group_title: '3. Leave Requests & Leave Approvals',
    group_description: 'Manages staff leave applications, approvals, and rejections, propagating approved leaves to Daily Summary, Monthly Movement, Muster Roll, LR Sheet, and Documents.',
    primary_tables: ['leave_requests', 'overrides'],
    endpoints: [
      {
        method: 'GET',
        endpoint: '/api/leave-requests',
        module: 'Leave / Swap Register',
        frontend_caller: 'App.jsx -> fetchLeaveRequests()',
        reads_from_tables: ['leave_requests', 'staff'],
        saves_to_tables: [],
        cascades_to_tables: [],
        synced_ui_modules: ['Leave Requests Panel'],
        description: 'Fetches all pending, approved, and rejected leave applications.'
      },
      {
        method: 'POST',
        endpoint: '/api/leave-requests',
        module: 'Leave / Swap Register',
        frontend_caller: 'App.jsx -> Submit Leave Request Form',
        reads_from_tables: ['staff'],
        saves_to_tables: ['leave_requests'],
        cascades_to_tables: ['audit_logs'],
        synced_ui_modules: ['Leave Requests Panel', 'Audit Logs'],
        description: 'Submits a new leave application (`PENDING` status) into `leave_requests`.'
      },
      {
        method: 'POST',
        endpoint: '/api/leave-requests/:id/approve',
        module: 'Leave / Swap Register',
        frontend_caller: 'App.jsx -> Approve Leave Button',
        reads_from_tables: ['leave_requests', 'staff', 'links'],
        saves_to_tables: ['leave_requests', 'overrides'],
        cascades_to_tables: [
          'muster_records',
          'lr_sheet_records',
          'ta_approvals',
          'ta_entries',
          'nda_entries',
          'diary_entries',
          'daily_earnings_entries',
          'audit_logs'
        ],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Approves a leave request, writes `LEAVE` overrides for every date in the leave range, marks Muster Roll & LR Sheet, clears conflicting TA/NDA/Earnings, and logs to Audit.'
      },
      {
        method: 'POST',
        endpoint: '/api/leave-requests/:id/reject',
        module: 'Leave / Swap Register',
        frontend_caller: 'App.jsx -> Reject Leave Button',
        reads_from_tables: ['leave_requests', 'overrides'],
        saves_to_tables: ['leave_requests', 'overrides'],
        cascades_to_tables: [
          'muster_records',
          'lr_sheet_records',
          'ta_approvals',
          'ta_entries',
          'nda_entries',
          'diary_entries',
          'daily_earnings_entries',
          'audit_logs'
        ],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Rejects a leave request, removes any leave overrides for those dates, and resyncs the employee’s regular duty across all modules.'
      }
    ]
  },

  // ==========================================================================
  // GROUP 4: MUSTER ROLL & INDIVIDUAL MUSTER
  // ==========================================================================
  {
    group_id: 'muster_roll',
    group_title: '4. Muster Roll & Individual Attendance Sheet',
    group_description: 'Handles monthly attendance codes (P, R, LA, SICK, CL, LAP, Trg, PME, Duties/Train Nos) and propagates changes to Daily Summary, Monthly Movement, LR Sheet, TA, NDA, Diary, and Earnings.',
    primary_tables: ['muster_records'],
    endpoints: [
      {
        method: 'GET',
        endpoint: '/api/muster',
        module: 'Muster Roll & Individual Muster',
        frontend_caller: 'App.jsx -> fetchMusterData() (Muster Roll Tab & Individual Muster Modal)',
        reads_from_tables: ['staff', 'muster_records', 'overrides', 'links', 'lr_sheet_records', 'ta_approvals'],
        saves_to_tables: [],
        cascades_to_tables: [],
        synced_ui_modules: ['Muster Roll', 'Individual Muster'],
        description: 'Loads the monthly Muster Roll grid for all staff (or a single employee), merging explicit `muster_records` with Daily Summary overrides, base link duties, and LR Sheet duties.'
      },
      {
        method: 'POST',
        endpoint: '/api/muster/update-cell',
        module: 'Muster Roll & Individual Muster',
        frontend_caller: 'App.jsx -> handleMusterCellSave() (Single Cell Edit in Muster Roll)',
        reads_from_tables: ['muster_records', 'staff', 'links'],
        saves_to_tables: ['muster_records'],
        cascades_to_tables: [
          'overrides',
          'lr_sheet_records',
          'ta_approvals',
          'ta_entries',
          'nda_entries',
          'diary_entries',
          'daily_earnings_entries',
          'audit_logs'
        ],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Saves a single Muster cell (`muster_records`) and runs `syncMusterToSchedulesAndApprovals()` to update Daily Summary (`overrides`), Monthly Movement, LR Sheet, TA, NDA, Diary, and Daily Earnings.'
      },
      {
        method: 'POST',
        endpoint: '/api/muster/batch-update',
        module: 'Muster Roll & Individual Muster',
        frontend_caller: 'App.jsx -> handleMusterBatchSave() (Save All / Employee Row Save in Muster Roll)',
        reads_from_tables: ['muster_records', 'staff', 'links'],
        saves_to_tables: ['muster_records'],
        cascades_to_tables: [
          'overrides',
          'lr_sheet_records',
          'ta_approvals',
          'ta_entries',
          'nda_entries',
          'diary_entries',
          'daily_earnings_entries',
          'audit_logs'
        ],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Saves multiple Muster cells one employee at a time into `muster_records`, syncing each changed date across Daily Summary, Monthly Movement, LR Sheet, TA, NDA, Diary, and Daily Earnings.'
      },
      {
        method: 'POST',
        endpoint: '/api/muster/reset-cell',
        module: 'Muster Roll & Individual Muster',
        frontend_caller: 'App.jsx -> Reset Single Muster Cell',
        reads_from_tables: ['muster_records'],
        saves_to_tables: ['muster_records'],
        cascades_to_tables: [
          'overrides',
          'lr_sheet_records',
          'ta_approvals',
          'ta_entries',
          'nda_entries',
          'diary_entries',
          'daily_earnings_entries',
          'audit_logs'
        ],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Deletes a custom Muster cell override and reverts linked `overrides`, `lr_sheet_records`, `ta_approvals`, and document entries back to default.'
      },
      {
        method: 'POST',
        endpoint: '/api/muster/batch-reset',
        module: 'Muster Roll & Individual Muster',
        frontend_caller: 'App.jsx -> Batch Reset Muster Roll',
        reads_from_tables: ['muster_records'],
        saves_to_tables: ['muster_records'],
        cascades_to_tables: [
          'overrides',
          'lr_sheet_records',
          'ta_approvals',
          'ta_entries',
          'nda_entries',
          'diary_entries',
          'daily_earnings_entries',
          'audit_logs'
        ],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Resets a batch of Muster cells for a month/staff and reverts linked overrides and document entries.'
      }
    ]
  },

  // ==========================================================================
  // GROUP 5: LEAVE RESERVE (LR) SHEET
  // ==========================================================================
  {
    group_id: 'lr_sheet',
    group_title: '5. Leave Reserve (LR) Sheet',
    group_description: 'Manages Category 4 (Leave Reserve) staff daily duty allocations and syncs with Daily Summary, Monthly Movement, Muster Roll, TA, NDA, Diary, and Daily Earnings.',
    primary_tables: ['lr_sheet_records', 'lr_sheet_members'],
    endpoints: [
      {
        method: 'GET',
        endpoint: '/api/lr-sheet',
        module: 'Leave Reserve (LR) Sheet',
        frontend_caller: 'App.jsx -> fetchLrSheet() (LR Sheet Tab)',
        reads_from_tables: ['lr_sheet_records', 'lr_sheet_members', 'staff', 'overrides', 'muster_records'],
        saves_to_tables: [],
        cascades_to_tables: [],
        synced_ui_modules: ['Leave Reserve Sheet'],
        description: 'Fetches the monthly LR Sheet grid for all Leave Reserve members.'
      },
      {
        method: 'POST',
        endpoint: '/api/lr-sheet/cell',
        module: 'Leave Reserve (LR) Sheet',
        frontend_caller: 'App.jsx -> handleLrCellSave() (Single Cell Edit in LR Sheet)',
        reads_from_tables: ['lr_sheet_records', 'staff'],
        saves_to_tables: ['lr_sheet_records'],
        cascades_to_tables: [
          'overrides',
          'muster_records',
          'ta_approvals',
          'ta_entries',
          'nda_entries',
          'diary_entries',
          'daily_earnings_entries',
          'audit_logs'
        ],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Saves a single cell in `lr_sheet_records` and runs `syncLRSheetCellChange()` to update `overrides`, `muster_records`, `ta_approvals`, `ta_entries`, `nda_entries`, `diary_entries`, and `daily_earnings_entries`.'
      },
      {
        method: 'POST',
        endpoint: '/api/lr-sheet/batch-update',
        module: 'Leave Reserve (LR) Sheet',
        frontend_caller: 'App.jsx -> handleLrBatchSave() (Save All Button in LR Sheet)',
        reads_from_tables: ['lr_sheet_records', 'staff'],
        saves_to_tables: ['lr_sheet_records'],
        cascades_to_tables: [
          'overrides',
          'muster_records',
          'ta_approvals',
          'ta_entries',
          'nda_entries',
          'diary_entries',
          'daily_earnings_entries',
          'audit_logs'
        ],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Saves multiple LR Sheet cells one employee at a time into `lr_sheet_records` and cascades each change to all linked modules.'
      },
      {
        method: 'POST',
        endpoint: '/api/lr-sheet/sync-from-daily-duty',
        module: 'Leave Reserve (LR) Sheet',
        frontend_caller: 'App.jsx -> Sync LR Sheet from Daily Duty Button',
        reads_from_tables: ['overrides', 'staff', 'links'],
        saves_to_tables: ['lr_sheet_records'],
        cascades_to_tables: ['muster_records', 'ta_approvals', 'audit_logs'],
        synced_ui_modules: ['Leave Reserve Sheet', 'Muster Roll', 'TA Approvals', 'Audit Logs'],
        description: 'Pulls all LR substitute and extra duties from Daily Summary (`overrides`) into `lr_sheet_records`.'
      }
    ]
  },

  // ==========================================================================
  // GROUP 6: TA JOURNAL & TA APPROVALS
  // ==========================================================================
  {
    group_id: 'ta_journal_and_approvals',
    group_title: '6. Travelling Allowance (TA) Journal & TA Approvals',
    group_description: 'Handles TA Claim Verification/Approval (`ta_approvals`) and Individual Employee TA Journals (`ta_entries`), cross-syncing train numbers and timings with Roster, Muster, NDA, Diary, and Earnings.',
    primary_tables: ['ta_entries', 'ta_approvals'],
    endpoints: [
      {
        method: 'GET',
        endpoint: '/api/documents/ta/:staffId',
        module: 'TA Journal Document',
        frontend_caller: 'TaDocument.jsx -> fetchTaData()',
        reads_from_tables: ['ta_entries', 'ta_approvals', 'overrides', 'muster_records', 'lr_sheet_records', 'links', 'train_ta_nda'],
        saves_to_tables: [],
        cascades_to_tables: [],
        synced_ui_modules: ['TA Journal Document'],
        description: 'Generates or retrieves the monthly TA Journal for an employee, merging saved `ta_entries`, `ta_approvals`, Daily Summary `overrides`, `muster_records`, and `lr_sheet_records` per date.'
      },
      {
        method: 'POST',
        endpoint: '/api/documents/ta/:staffId',
        module: 'TA Journal Document',
        frontend_caller: 'TaDocument.jsx -> handleSave() (Save TA Journal Button)',
        reads_from_tables: ['ta_entries', 'ta_approvals', 'staff'],
        saves_to_tables: ['ta_entries'],
        cascades_to_tables: [
          'ta_approvals',
          'overrides',
          'muster_records',
          'lr_sheet_records',
          'nda_entries',
          'diary_entries',
          'daily_earnings_entries',
          'audit_logs'
        ],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Saves an employee’s monthly TA Journal rows into `ta_entries`, updates matching `ta_approvals`, and syncs edited train duties across Daily Summary (`overrides`), Muster Roll, LR Sheet, NDA, Diary, and Daily Earnings.'
      },
      {
        method: 'DELETE',
        endpoint: '/api/documents/ta/:staffId',
        module: 'TA Journal Document',
        frontend_caller: 'TaDocument.jsx -> handleReset() (Reset to Auto-Generated Roster)',
        reads_from_tables: ['ta_entries'],
        saves_to_tables: ['ta_entries'],
        cascades_to_tables: ['audit_logs'],
        synced_ui_modules: ['TA Journal Document', 'Audit Logs'],
        description: 'Clears manual `ta_entries` for the selected employee and month so the TA Journal dynamically regenerates from the live Roster/Muster/TA Approvals.'
      },
      {
        method: 'GET',
        endpoint: '/api/ta-approvals',
        module: 'TA Approvals Portal',
        frontend_caller: 'TaApprovals.jsx -> fetchApprovals()',
        reads_from_tables: ['ta_approvals', 'staff', 'categories', 'overrides', 'muster_records', 'lr_sheet_records'],
        saves_to_tables: ['ta_approvals'],
        cascades_to_tables: [],
        synced_ui_modules: ['TA Approvals Portal'],
        description: 'Auto-syncs pending TA claims for the month (saving one employee at a time) and returns all `PENDING`, `APPROVED`, and `REJECTED` claims from `ta_approvals`.'
      },
      {
        method: 'POST',
        endpoint: '/api/ta-approvals/accept',
        module: 'TA Approvals Portal',
        frontend_caller: 'TaApprovals.jsx -> handleAcceptSingle()',
        reads_from_tables: ['ta_approvals', 'staff'],
        saves_to_tables: ['ta_approvals', 'ta_entries'],
        cascades_to_tables: ['nda_entries', 'diary_entries', 'daily_earnings_entries', 'audit_logs'],
        synced_ui_modules: ['TA Approvals Portal', 'TA Journal Document', 'NDA Journal', 'Staff Diary', 'Daily Earnings Sheet', 'Audit Logs'],
        description: 'Approves a single TA claim in `ta_approvals`, writes it into the employee’s `ta_entries`, and refreshes linked documents.'
      },
      {
        method: 'POST',
        endpoint: '/api/ta-approvals/accept-batch',
        module: 'TA Approvals Portal',
        frontend_caller: 'TaApprovals.jsx -> handleAcceptBatch()',
        reads_from_tables: ['ta_approvals', 'staff'],
        saves_to_tables: ['ta_approvals', 'ta_entries'],
        cascades_to_tables: ['nda_entries', 'diary_entries', 'daily_earnings_entries', 'audit_logs'],
        synced_ui_modules: ['TA Approvals Portal', 'TA Journal Document', 'NDA Journal', 'Staff Diary', 'Daily Earnings Sheet', 'Audit Logs'],
        description: 'Approves selected TA claims one employee at a time, writes approved rows to `ta_entries`, reports saved vs error counts, and logs to `audit_logs`.'
      },
      {
        method: 'POST',
        endpoint: '/api/ta-approvals/accept-all',
        module: 'TA Approvals Portal',
        frontend_caller: 'TaApprovals.jsx -> handleAcceptAll()',
        reads_from_tables: ['ta_approvals', 'staff'],
        saves_to_tables: ['ta_approvals', 'ta_entries'],
        cascades_to_tables: ['nda_entries', 'diary_entries', 'daily_earnings_entries', 'audit_logs'],
        synced_ui_modules: ['TA Approvals Portal', 'TA Journal Document', 'NDA Journal', 'Staff Diary', 'Daily Earnings Sheet', 'Audit Logs'],
        description: 'Approves all pending TA claims for the selected month/category one employee at a time and syncs them into `ta_entries`.'
      },
      {
        method: 'POST',
        endpoint: '/api/ta-approvals/reject',
        module: 'TA Approvals Portal',
        frontend_caller: 'TaApprovals.jsx -> handleReject()',
        reads_from_tables: ['ta_approvals'],
        saves_to_tables: ['ta_approvals', 'ta_entries'],
        cascades_to_tables: ['nda_entries', 'diary_entries', 'daily_earnings_entries', 'audit_logs'],
        synced_ui_modules: ['TA Approvals Portal', 'TA Journal Document', 'Audit Logs'],
        description: 'Marks a TA claim as `REJECTED` in `ta_approvals` and removes it from `ta_entries`.'
      },
      {
        method: 'POST',
        endpoint: '/api/ta-approvals/revert',
        module: 'TA Approvals Portal',
        frontend_caller: 'TaApprovals.jsx -> handleRevert()',
        reads_from_tables: ['ta_approvals'],
        saves_to_tables: ['ta_approvals', 'ta_entries'],
        cascades_to_tables: ['audit_logs'],
        synced_ui_modules: ['TA Approvals Portal', 'TA Journal Document', 'Audit Logs'],
        description: 'Reverts an approved/rejected TA claim back to `PENDING` in `ta_approvals`.'
      }
    ]
  },

  // ==========================================================================
  // GROUP 7: NDA (NIGHT DUTY ALLOWANCE) JOURNAL
  // ==========================================================================
  {
    group_id: 'nda_journal',
    group_title: '7. Night Duty Allowance (NDA) Journal',
    group_description: 'Generates and saves monthly Night Duty Allowance (22:00 to 06:00 hrs) claims per employee (`nda_entries`) and syncs duties across linked modules.',
    primary_tables: ['nda_entries'],
    endpoints: [
      {
        method: 'GET',
        endpoint: '/api/documents/nda/:staffId',
        module: 'NDA Journal Document',
        frontend_caller: 'NdaDocument.jsx -> fetchNdaData()',
        reads_from_tables: ['nda_entries', 'overrides', 'muster_records', 'lr_sheet_records', 'daily_earnings_entries', 'links', 'train_ta_nda'],
        saves_to_tables: [],
        cascades_to_tables: [],
        synced_ui_modules: ['NDA Journal Document'],
        description: 'Generates or retrieves the monthly NDA Journal for an employee, merging saved `nda_entries` per date with live Roster, Overrides, Muster, LR Sheet, and Daily Earnings duties.'
      },
      {
        method: 'POST',
        endpoint: '/api/documents/nda/:staffId',
        module: 'NDA Journal Document',
        frontend_caller: 'NdaDocument.jsx -> handleSave() (Save NDA Journal Button)',
        reads_from_tables: ['nda_entries', 'staff'],
        saves_to_tables: ['nda_entries'],
        cascades_to_tables: [
          'overrides',
          'muster_records',
          'lr_sheet_records',
          'ta_approvals',
          'ta_entries',
          'diary_entries',
          'daily_earnings_entries',
          'audit_logs'
        ],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Saves manual edits in the NDA Journal to `nda_entries` and synchronizes any duty/train modifications across Daily Summary, Muster, LR Sheet, TA, Diary, and Daily Earnings.'
      },
      {
        method: 'DELETE',
        endpoint: '/api/documents/nda/:staffId',
        module: 'NDA Journal Document',
        frontend_caller: 'NdaDocument.jsx -> handleReset() (Reset NDA Journal)',
        reads_from_tables: ['nda_entries'],
        saves_to_tables: ['nda_entries'],
        cascades_to_tables: ['audit_logs'],
        synced_ui_modules: ['NDA Journal Document', 'Audit Logs'],
        description: 'Deletes saved `nda_entries` for the employee/month so NDA recalculates dynamically from live Roster/Muster/Override data.'
      }
    ]
  },

  // ==========================================================================
  // GROUP 8: STAFF DIARY (MONTHLY WORK & EFT REGISTER)
  // ==========================================================================
  {
    group_id: 'staff_diary',
    group_title: '8. Staff Diary (Monthly Work & EFT Register)',
    group_description: 'Generates and saves the monthly Staff Diary (`diary_entries`) including train movements, attendance, and EFT checking figures linked with Daily Earnings.',
    primary_tables: ['diary_entries'],
    endpoints: [
      {
        method: 'GET',
        endpoint: '/api/documents/diary/:staffId',
        module: 'Staff Diary Document',
        frontend_caller: 'DiaryDocument.jsx -> fetchDiaryData()',
        reads_from_tables: ['diary_entries', 'daily_earnings_entries', 'overrides', 'muster_records', 'lr_sheet_records', 'links'],
        saves_to_tables: [],
        cascades_to_tables: [],
        synced_ui_modules: ['Staff Diary Document'],
        description: 'Generates or retrieves the monthly Staff Diary for an employee, merging saved `diary_entries` per date with live Roster, Overrides, Muster, LR Sheet, and EFT figures from `daily_earnings_entries`.'
      },
      {
        method: 'POST',
        endpoint: '/api/documents/diary/:staffId',
        module: 'Staff Diary Document',
        frontend_caller: 'DiaryDocument.jsx -> handleSave() (Save Diary Button)',
        reads_from_tables: ['diary_entries', 'staff'],
        saves_to_tables: ['diary_entries'],
        cascades_to_tables: [
          'daily_earnings_entries',
          'overrides',
          'muster_records',
          'lr_sheet_records',
          'ta_approvals',
          'ta_entries',
          'nda_entries',
          'audit_logs'
        ],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Saves the employee’s monthly Diary into `diary_entries`, cross-updates EFT cases/amounts in `daily_earnings_entries`, and syncs duty changes across Roster, Muster, TA, and NDA.'
      },
      {
        method: 'DELETE',
        endpoint: '/api/documents/diary/:staffId',
        module: 'Staff Diary Document',
        frontend_caller: 'DiaryDocument.jsx -> handleReset() (Reset Diary)',
        reads_from_tables: ['diary_entries'],
        saves_to_tables: ['diary_entries'],
        cascades_to_tables: ['audit_logs'],
        synced_ui_modules: ['Staff Diary Document', 'Audit Logs'],
        description: 'Clears saved `diary_entries` for the month so the Staff Diary regenerates from live Roster, Muster, and Daily Earnings.'
      }
    ]
  },

  // ==========================================================================
  // GROUP 9: DAILY EARNINGS & EFT PERFORMANCE SHEET
  // ==========================================================================
  {
    group_id: 'daily_earnings',
    group_title: '9. Daily Earnings & EFT Checking Sheet',
    group_description: 'Manages daily/monthly EFT checking performance, penalty amounts, and working train details (`daily_earnings_entries`), cross-linked with Staff Diary, TA, NDA, Muster, and Roster.',
    primary_tables: ['daily_earnings_entries'],
    endpoints: [
      {
        method: 'GET',
        endpoint: '/api/documents/daily-earnings',
        module: 'Daily Earnings Sheet',
        frontend_caller: 'DailyEarningsDocument.jsx -> fetchDailyEarnings() (Single Date Mode)',
        reads_from_tables: ['daily_earnings_entries', 'staff', 'links', 'overrides', 'muster_records', 'lr_sheet_records'],
        saves_to_tables: [],
        cascades_to_tables: [],
        synced_ui_modules: ['Daily Earnings Sheet'],
        description: 'Fetches the Daily Earnings sheet for all staff on a single date, merging saved `daily_earnings_entries` with live duties from Roster, Overrides, Muster, and LR Sheet.'
      },
      {
        method: 'POST',
        endpoint: '/api/documents/daily-earnings',
        module: 'Daily Earnings Sheet',
        frontend_caller: 'DailyEarningsDocument.jsx -> handleSave() (Single Date Save)',
        reads_from_tables: ['daily_earnings_entries', 'staff'],
        saves_to_tables: ['daily_earnings_entries'],
        cascades_to_tables: [
          'diary_entries',
          'overrides',
          'muster_records',
          'lr_sheet_records',
          'ta_approvals',
          'ta_entries',
          'nda_entries',
          'audit_logs'
        ],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Saves Daily Earnings rows one employee at a time into `daily_earnings_entries`, syncs EFT figures into `diary_entries`, and propagates duty/train updates across all modules.'
      },
      {
        method: 'POST',
        endpoint: '/api/documents/daily-earnings/staff/:staffId',
        module: 'Daily Earnings Sheet (Employee Monthly Mode)',
        frontend_caller: 'DailyEarningsDocument.jsx -> handleSave() (Employee Monthly Mode)',
        reads_from_tables: ['daily_earnings_entries', 'staff'],
        saves_to_tables: ['daily_earnings_entries'],
        cascades_to_tables: [
          'diary_entries',
          'overrides',
          'muster_records',
          'lr_sheet_records',
          'ta_approvals',
          'ta_entries',
          'nda_entries',
          'audit_logs'
        ],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Saves a full month of Daily Earnings for a single employee into `daily_earnings_entries` and syncs with Staff Diary, TA, NDA, Muster, and Roster.'
      },
      {
        method: 'POST',
        endpoint: '/api/documents/daily-earnings/range',
        module: 'Daily Earnings Sheet (Date Range Mode)',
        frontend_caller: 'DailyEarningsDocument.jsx -> handleSave() (Date Range Mode)',
        reads_from_tables: ['daily_earnings_entries', 'staff'],
        saves_to_tables: ['daily_earnings_entries'],
        cascades_to_tables: [
          'diary_entries',
          'overrides',
          'muster_records',
          'lr_sheet_records',
          'ta_approvals',
          'ta_entries',
          'nda_entries',
          'audit_logs'
        ],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Saves Daily Earnings across a multi-day range one employee at a time into `daily_earnings_entries` and cascades changes to all linked modules.'
      }
    ]
  },

  // ==========================================================================
  // GROUP 10: DUTY REGISTER & RECONCILIATION
  // ==========================================================================
  {
    group_id: 'duty_register',
    group_title: '10. Actual Duty Register & Roster Reconciliation',
    group_description: 'Records actual sign-on/sign-off duty logs (`duty_register`) and reconciles planned vs actual working.',
    primary_tables: ['duty_register'],
    endpoints: [
      {
        method: 'GET',
        endpoint: '/api/duty-register',
        module: 'Duty Register',
        frontend_caller: 'App.jsx -> fetchDutyRegister()',
        reads_from_tables: ['duty_register', 'staff'],
        saves_to_tables: [],
        cascades_to_tables: [],
        synced_ui_modules: ['Duty Register'],
        description: 'Fetches actual duty register entries for a selected date.'
      },
      {
        method: 'POST',
        endpoint: '/api/duty-register',
        module: 'Duty Register',
        frontend_caller: 'App.jsx -> Save Duty Register Entry',
        reads_from_tables: ['duty_register', 'staff'],
        saves_to_tables: ['duty_register'],
        cascades_to_tables: [
          'overrides',
          'muster_records',
          'lr_sheet_records',
          'ta_approvals',
          'ta_entries',
          'nda_entries',
          'diary_entries',
          'daily_earnings_entries',
          'audit_logs'
        ],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Saves an actual duty record to `duty_register` and synchronizes the duty across Daily Summary (`overrides`), Muster Roll, LR Sheet, TA, NDA, Diary, and Earnings.'
      }
    ]
  },

  // ==========================================================================
  // GROUP 11: LINKS, LINK SETS, SLOT CUSTOMIZATIONS & TRAIN TA/NDA MASTER
  // ==========================================================================
  {
    group_id: 'links_and_trains_master',
    group_title: '11. Link Sets, Base Roster Links & Train TA/NDA Master',
    group_description: 'Manages base cyclic roster links (`links`, `link_sets`), slot labels (`slot_customizations`), and train timings (`train_ta_nda`, `non_daily_trains`).',
    primary_tables: ['link_sets', 'links', 'slot_customizations', 'train_ta_nda', 'non_daily_trains'],
    endpoints: [
      {
        method: 'POST',
        endpoint: '/api/links',
        module: 'Roster Link Builder',
        frontend_caller: 'App.jsx -> Create / Update Roster Link Slot',
        reads_from_tables: ['links', 'link_sets'],
        saves_to_tables: ['links'],
        cascades_to_tables: ['audit_logs'],
        synced_ui_modules: ['Roster Link Builder', 'Daily Summary Table', 'Monthly Movement Grid', 'Muster Roll', 'TA Approvals', 'Audit Logs'],
        description: 'Creates or updates a cyclic roster link slot in `links`.'
      },
      {
        method: 'PUT',
        endpoint: '/api/links/:id',
        module: 'Roster Link Builder',
        frontend_caller: 'App.jsx -> Edit Roster Link Slot (Staff / Trains / Remarks)',
        reads_from_tables: ['links'],
        saves_to_tables: ['links'],
        cascades_to_tables: ['audit_logs'],
        synced_ui_modules: ['Roster Link Builder', 'Daily Summary Table', 'Monthly Movement Grid', 'Muster Roll', 'TA Approvals', 'Audit Logs'],
        description: 'Updates staff assignment or train sequence on a base link slot in `links`.'
      },
      {
        method: 'POST',
        endpoint: '/api/train-ta-nda/batch',
        module: 'Train TA/NDA Master Timings',
        frontend_caller: 'App.jsx -> Save Train TA/NDA Timings Table',
        reads_from_tables: ['train_ta_nda'],
        saves_to_tables: ['train_ta_nda'],
        cascades_to_tables: ['audit_logs'],
        synced_ui_modules: ['Train TA/NDA Master', 'TA Approvals', 'TA Journal Document', 'NDA Journal Document', 'Audit Logs'],
        description: 'Batch saves departure/arrival timings, halt durations, and TA/NDA hours for trains into `train_ta_nda`.'
      }
    ]
  },

  // ==========================================================================
  // GROUP 12: STAFF, CATEGORIES & SENIORITY MASTER
  // ==========================================================================
  {
    group_id: 'staff_and_categories',
    group_title: '12. Staff Directory, Categories & Seniority Master',
    group_description: 'Manages employee master records (`staff`), roster categories (`categories`), and seniority (`seniority_list`).',
    primary_tables: ['staff', 'categories', 'seniority_list'],
    endpoints: [
      {
        method: 'GET',
        endpoint: '/api/staff',
        module: 'Staff Directory',
        frontend_caller: 'App.jsx -> fetchStaff()',
        reads_from_tables: ['staff', 'categories'],
        saves_to_tables: [],
        cascades_to_tables: [],
        synced_ui_modules: ['Staff Directory', 'All Modules'],
        description: 'Returns all staff members with category, designation, headquarters, basic pay, and PF/HRMS details.'
      },
      {
        method: 'POST',
        endpoint: '/api/staff',
        module: 'Staff Directory',
        frontend_caller: 'App.jsx -> Add New Employee Modal',
        reads_from_tables: ['staff', 'categories'],
        saves_to_tables: ['staff'],
        cascades_to_tables: ['lr_sheet_members', 'audit_logs'],
        synced_ui_modules: ['Staff Directory', 'Daily Summary Table', 'Monthly Movement Grid', 'Muster Roll', 'LR Sheet', 'Audit Logs'],
        description: 'Creates a new employee in `staff` (and adds to `lr_sheet_members` if Category 4 Leave Reserve).'
      },
      {
        method: 'PUT',
        endpoint: '/api/staff/:id',
        module: 'Staff Directory',
        frontend_caller: 'App.jsx -> Edit Employee Details Modal',
        reads_from_tables: ['staff'],
        saves_to_tables: ['staff'],
        cascades_to_tables: ['links', 'lr_sheet_members', 'audit_logs'],
        synced_ui_modules: ['Staff Directory', 'Daily Summary Table', 'Monthly Movement Grid', 'Muster Roll', 'LR Sheet', 'Audit Logs'],
        description: 'Updates employee profile, category, or designation in `staff` and syncs category membership.'
      },
      {
        method: 'DELETE',
        endpoint: '/api/staff/:id',
        module: 'Staff Directory',
        frontend_caller: 'App.jsx -> Delete Employee Button',
        reads_from_tables: ['staff'],
        saves_to_tables: ['staff'],
        cascades_to_tables: ['links', 'overrides', 'muster_records', 'lr_sheet_records', 'lr_sheet_members', 'audit_logs'],
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Deletes an employee from `staff` and unassigns/cleans up their link slots and records.'
      }
    ]
  },

  // ==========================================================================
  // GROUP 13: AUDIT LOGS, UNIVERSAL UNDO & SYSTEM DATA-FLOW MAP
  // ==========================================================================
  {
    group_id: 'audit_and_system',
    group_title: '13. Audit Logs, Universal Undo & System Data-Flow Map',
    group_description: 'Tracks every change across the system (`audit_logs`), shows What Is Saved & Where It Is Saved, supports 1-click Undo, and serves the System Data-Flow Map.',
    primary_tables: ['audit_logs'],
    endpoints: [
      {
        method: 'GET',
        endpoint: '/api/audit-logs',
        module: 'Audit Logs & System History',
        frontend_caller: 'App.jsx -> fetchAuditLogs() (Audit Logs Tab)',
        reads_from_tables: ['audit_logs'],
        saves_to_tables: [],
        cascades_to_tables: [],
        synced_ui_modules: ['Audit Logs'],
        description: 'Returns the latest 300 audit logs enriched with `what_saved` and `where_saved` (`endpoint`, `source_module`, `saved_tables`, `linked_modules`).'
      },
      {
        method: 'POST',
        endpoint: '/api/audit-logs/:id/undo',
        module: 'Audit Logs & Universal Undo',
        frontend_caller: 'App.jsx -> handleUndoAuditLog() (Undo Button in Audit Logs)',
        reads_from_tables: ['audit_logs'],
        saves_to_tables: ['audit_logs', 'overrides', 'links', 'staff', 'muster_records', 'lr_sheet_records'],
        cascades_to_tables: ALL_LINKED_ROSTER_MODULES,
        synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
        description: 'Reverts a previously recorded action using its stored `undo_data` snapshot and resynchronizes all affected tables.'
      },
      {
        method: 'GET',
        endpoint: '/api/system/data-flow-map',
        module: 'System Architecture & Endpoint Data-Flow Map',
        frontend_caller: 'App.jsx -> Data-Flow Map Viewer in Audit & Architecture Tab',
        reads_from_tables: [],
        saves_to_tables: [],
        cascades_to_tables: [],
        synced_ui_modules: ['System Data-Flow Map'],
        description: 'Returns this complete Endpoint & Data-Flow Registry so you can inspect every endpoint, where its data comes from, and which DB tables and UI modules it updates.'
      }
    ]
  }
];

/**
 * Flatten all endpoints for quick lookup and pattern matching
 */
const FLAT_ENDPOINTS = [];
for (const group of ENDPOINT_GROUPS) {
  for (const ep of group.endpoints) {
    // Convert Express route params like `/api/documents/ta/:staffId` into a RegExp
    const regexStr = '^' + ep.endpoint.replace(/:[^/]+/g, '[^/]+') + '/?$';
    FLAT_ENDPOINTS.push({
      ...ep,
      group_id: group.group_id,
      group_title: group.group_title,
      _regex: new RegExp(regexStr, 'i')
    });
  }
}

/**
 * Given an HTTP method and request path (e.g. `POST`, `/api/documents/ta/15`),
 * returns the matching endpoint data-flow descriptor.
 */
function lookupEndpointFlow(method, rawPath) {
  const cleanMethod = String(method || 'GET').toUpperCase();
  const cleanPath = String(rawPath || '').split('?')[0];

  const exactMatch = FLAT_ENDPOINTS.find(
    (e) => e.method === cleanMethod && e._regex.test(cleanPath)
  );
  if (exactMatch) {
    const { _regex, ...rest } = exactMatch;
    return rest;
  }

  // Fallback heuristic if an unlisted route is hit
  if (cleanPath.startsWith('/api/muster')) {
    return {
      method: cleanMethod,
      endpoint: cleanPath,
      module: 'Muster Roll & Individual Muster',
      frontend_caller: 'App.jsx (Muster Roll)',
      reads_from_tables: ['muster_records'],
      saves_to_tables: cleanMethod === 'GET' ? [] : ['muster_records'],
      cascades_to_tables: cleanMethod === 'GET' ? [] : ['overrides', 'lr_sheet_records', 'ta_approvals', 'ta_entries', 'nda_entries', 'diary_entries', 'daily_earnings_entries', 'audit_logs'],
      synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
      description: 'Muster Roll operation synchronized across Roster and Employee Documents.'
    };
  }
  if (cleanPath.startsWith('/api/lr-sheet')) {
    return {
      method: cleanMethod,
      endpoint: cleanPath,
      module: 'Leave Reserve (LR) Sheet',
      frontend_caller: 'App.jsx (LR Sheet)',
      reads_from_tables: ['lr_sheet_records'],
      saves_to_tables: cleanMethod === 'GET' ? [] : ['lr_sheet_records'],
      cascades_to_tables: cleanMethod === 'GET' ? [] : ['overrides', 'muster_records', 'ta_approvals', 'ta_entries', 'nda_entries', 'diary_entries', 'daily_earnings_entries', 'audit_logs'],
      synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
      description: 'Leave Reserve (LR) Sheet operation synchronized across Roster and Employee Documents.'
    };
  }
  if (cleanPath.startsWith('/api/ta-approvals') || cleanPath.startsWith('/api/documents/ta')) {
    return {
      method: cleanMethod,
      endpoint: cleanPath,
      module: 'TA Journal & TA Approvals',
      frontend_caller: 'TaDocument.jsx / TaApprovals.jsx',
      reads_from_tables: ['ta_entries', 'ta_approvals'],
      saves_to_tables: cleanMethod === 'GET' ? [] : ['ta_entries', 'ta_approvals'],
      cascades_to_tables: cleanMethod === 'GET' ? [] : ['overrides', 'muster_records', 'lr_sheet_records', 'nda_entries', 'diary_entries', 'daily_earnings_entries', 'audit_logs'],
      synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
      description: 'TA Journal / Approval operation synchronized across Roster and Employee Documents.'
    };
  }
  if (cleanPath.startsWith('/api/documents/nda')) {
    return {
      method: cleanMethod,
      endpoint: cleanPath,
      module: 'NDA Journal Document',
      frontend_caller: 'NdaDocument.jsx',
      reads_from_tables: ['nda_entries'],
      saves_to_tables: cleanMethod === 'GET' ? [] : ['nda_entries'],
      cascades_to_tables: cleanMethod === 'GET' ? [] : ['overrides', 'muster_records', 'lr_sheet_records', 'ta_approvals', 'ta_entries', 'diary_entries', 'daily_earnings_entries', 'audit_logs'],
      synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
      description: 'NDA Journal operation synchronized across Roster and Employee Documents.'
    };
  }
  if (cleanPath.startsWith('/api/documents/diary')) {
    return {
      method: cleanMethod,
      endpoint: cleanPath,
      module: 'Staff Diary Document',
      frontend_caller: 'DiaryDocument.jsx',
      reads_from_tables: ['diary_entries'],
      saves_to_tables: cleanMethod === 'GET' ? [] : ['diary_entries'],
      cascades_to_tables: cleanMethod === 'GET' ? [] : ['daily_earnings_entries', 'overrides', 'muster_records', 'lr_sheet_records', 'ta_approvals', 'ta_entries', 'nda_entries', 'audit_logs'],
      synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
      description: 'Staff Diary operation synchronized across Daily Earnings, Roster, and Employee Documents.'
    };
  }
  if (cleanPath.startsWith('/api/documents/daily-earnings')) {
    return {
      method: cleanMethod,
      endpoint: cleanPath,
      module: 'Daily Earnings Sheet',
      frontend_caller: 'DailyEarningsDocument.jsx',
      reads_from_tables: ['daily_earnings_entries'],
      saves_to_tables: cleanMethod === 'GET' ? [] : ['daily_earnings_entries'],
      cascades_to_tables: cleanMethod === 'GET' ? [] : ['diary_entries', 'overrides', 'muster_records', 'lr_sheet_records', 'ta_approvals', 'ta_entries', 'nda_entries', 'audit_logs'],
      synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
      description: 'Daily Earnings operation synchronized across Staff Diary, Roster, and Employee Documents.'
    };
  }
  if (cleanPath.startsWith('/api/duty') || cleanPath.startsWith('/api/overrides')) {
    return {
      method: cleanMethod,
      endpoint: cleanPath,
      module: 'Daily Summary & Duty Overrides',
      frontend_caller: 'App.jsx (Daily Summary / Monthly Movement)',
      reads_from_tables: ['overrides', 'links', 'staff'],
      saves_to_tables: cleanMethod === 'GET' ? [] : ['overrides'],
      cascades_to_tables: cleanMethod === 'GET' ? [] : ['muster_records', 'lr_sheet_records', 'ta_approvals', 'ta_entries', 'nda_entries', 'diary_entries', 'daily_earnings_entries', 'audit_logs'],
      synced_ui_modules: ALL_LINKED_ROSTER_MODULES,
      description: 'Duty override operation synchronized across all Roster and Document modules.'
    };
  }

  return null;
}

/**
 * Express Middleware:
 *   1. Attaches `req.dataFlow` to every incoming `/api/*` request.
 *   2. On write requests (`POST`, `PUT`, `DELETE`), logs a clear trace to the
 *      backend console showing which endpoint ran, where it saved data, and
 *      which tables it cascaded to.
 *   3. Injects `_data_flow` metadata into JSON object responses on write requests
 *      so inspecting any API response in DevTools Network tab immediately tells
 *      you where the data went.
 */
function dataFlowTraceMiddleware(req, res, next) {
  if (!req.path || !req.path.startsWith('/api/')) {
    return next();
  }

  const flow = lookupEndpointFlow(req.method, req.path);
  req.dataFlow = flow;

  if (flow) {
    const readsFrom = (flow.reads_from_tables || []).join(', ') || 'none';
    const savesTo = (flow.saves_to_tables || []).join(', ') || 'none (read-only)';
    const cascadesTo = (flow.cascades_to_tables || []).join(', ') || 'none';

    // Expose clear headers in Chrome DevTools -> Network -> Headers
    res.setHeader('X-Data-Module', String(flow.module || 'System'));
    res.setHeader('X-Frontend-Caller', String(flow.frontend_caller || 'App.jsx'));
    res.setHeader('X-Reads-From-DB', readsFrom);
    res.setHeader('X-Saves-To-DB', savesTo);
    res.setHeader('X-Auto-Syncs-To-DB', cascadesTo);

    const isWriteMethod = ['POST', 'PUT', 'DELETE'].includes(req.method.toUpperCase());
    if (isWriteMethod) {
      console.log(
        `[DATA-FLOW] ${req.method} ${req.path} | Module: ${flow.module} | Saves To DB: [${savesTo}] | Auto-Syncs: [${cascadesTo}]`
      );
    }

    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (body && typeof body === 'object' && !Array.isArray(body) && !body._data_flow) {
        body._data_flow = {
          endpoint: `${flow.method} ${flow.endpoint}`,
          actual_path: `${req.method} ${req.path}`,
          module: flow.module,
          frontend_caller: flow.frontend_caller,
          reads_from_tables: flow.reads_from_tables,
          saves_to_tables: flow.saves_to_tables,
          cascades_to_tables: flow.cascades_to_tables,
          synced_ui_modules: flow.synced_ui_modules
        };
      }
      return originalJson(body);
    };
  }

  next();
}

export {
  ALL_LINKED_ROSTER_MODULES,
  ENDPOINT_GROUPS,
  FLAT_ENDPOINTS,
  lookupEndpointFlow,
  dataFlowTraceMiddleware
};

module.exports = {
  ALL_LINKED_ROSTER_MODULES,
  ENDPOINT_GROUPS,
  FLAT_ENDPOINTS,
  lookupEndpointFlow,
  dataFlowTraceMiddleware
};
