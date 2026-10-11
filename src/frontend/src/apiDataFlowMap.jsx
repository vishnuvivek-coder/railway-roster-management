/**
 * ============================================================================
 * FRONTEND URL ROUTER & BACKEND DATA-FLOW MAP (`src/frontend/src/apiDataFlowMap.jsx`)
 * ============================================================================
 *
 * 1. Maps every single Frontend Tab & Document Sub-Tab to a dedicated URL path:
 *    - `/daily`                -> Staff Movement / Schedule (`activeTab = 'daily'`)
 *    - `/daily-summary`        -> Daily Summary Table (`activeTab = 'daily-summary'`)
 *    - `/roster`               -> Roster Grid / Monthly Movement (`activeTab = 'roster'`)
 *    - `/links`                -> Train Roster / Link Sets (`activeTab = 'links'`)
 *    - `/staff`                -> Staff Roster (`activeTab = 'staff'`)
 *    - `/leaves`               -> Leave / Swap (`activeTab = 'leaves'`)
 *    - `/ta-approvals`         -> TA Approvals (`activeTab = 'ta-approvals'`)
 *    - `/documents/ta`         -> TA Journal Document (`activeTab = 'documents', docSubTab = 'ta'`)
 *    - `/documents/nda`        -> NDA Journal Document (`activeTab = 'documents', docSubTab = 'nda'`)
 *    - `/documents/diary`      -> Diary (E.F.T) Document (`activeTab = 'documents', docSubTab = 'diary'`)
 *    - `/documents/earnings`   -> Daily Earnings Sheet (`activeTab = 'documents', docSubTab = 'earnings'`)
 *    - `/documents/muster`     -> Individual Muster (`activeTab = 'documents', docSubTab = 'muster'`)
 *    - `/documents/amenity`    -> Amenity Booking Chart (`activeTab = 'documents', docSubTab = 'amenity'`)
 *    - `/muster`               -> Muster Details / Attendance Roll (`activeTab = 'muster'`)
 *    - `/lr-list`              -> LR List / Leave Reserve Sheet (`activeTab = 'lr-list'`)
 *    - `/availability`         -> Staff Availability Sheet (`activeTab = 'availability'`)
 *    - `/seniority`            -> Seniority List (`activeTab = 'seniority'`)
 *    - `/audit`                -> Audit Logs (`activeTab = 'audit'`)
 *    - `/user-management`      -> User Approvals (`activeTab = 'user-management'`)
 *
 * 2. Clearly documents and visually displays for every screen/module:
 *    - Frontend URL Path (e.g. `localhost:5173/muster`)
 *    - Backend API Endpoint(s) called when reading or saving
 *    - Primary SQLite Database Table(s)
 *    - Linked Modules & Database Tables automatically synchronized
 * ============================================================================
 */

export const TAB_ROUTE_DIRECTORY = [
  {
    path: '/daily',
    aliases: ['/', '/movement', '/staff-movement', '/schedule'],
    activeTab: 'daily',
    docSubTab: null,
    label: 'Staff Movement / Schedule',
    icon: '👤'
  },
  {
    path: '/daily-summary',
    aliases: ['/summary', '/daily-table'],
    activeTab: 'daily-summary',
    docSubTab: null,
    label: 'Daily Summary Table',
    icon: '📋'
  },
  {
    path: '/roster',
    aliases: ['/roster-grid', '/monthly-movement', '/grid'],
    activeTab: 'roster',
    docSubTab: null,
    label: 'Roster Grid (Monthly Movement)',
    icon: '📅'
  },
  {
    path: '/links',
    aliases: ['/train-roster', '/trains', '/link-sets'],
    activeTab: 'links',
    docSubTab: null,
    label: 'Train Roster & Link Sets',
    icon: '🚆'
  },
  {
    path: '/staff',
    aliases: ['/staff-roster', '/employees'],
    activeTab: 'staff',
    docSubTab: null,
    label: 'Staff Roster',
    icon: '👥'
  },
  {
    path: '/leaves',
    aliases: ['/leave', '/swap', '/leave-swap'],
    activeTab: 'leaves',
    docSubTab: null,
    label: 'Leave / Swap',
    icon: '✉️'
  },
  {
    path: '/ta-approvals',
    aliases: ['/approvals'],
    activeTab: 'ta-approvals',
    docSubTab: null,
    label: 'TA Approvals',
    icon: '✅'
  },
  {
    path: '/documents/ta',
    aliases: ['/documents', '/ta', '/ta-document', '/ta-journal'],
    activeTab: 'documents',
    docSubTab: 'ta',
    label: 'TA Document (Documents Hub)',
    icon: '📄'
  },
  {
    path: '/documents/nda',
    aliases: ['/nda', '/nda-document', '/nda-journal'],
    activeTab: 'documents',
    docSubTab: 'nda',
    label: 'NDA Document (Documents Hub)',
    icon: '🌙'
  },
  {
    path: '/documents/diary',
    aliases: ['/diary', '/staff-diary', '/eft'],
    activeTab: 'documents',
    docSubTab: 'diary',
    label: 'Diary E.F.T (Documents Hub)',
    icon: '📔'
  },
  {
    path: '/documents/earnings',
    aliases: ['/earnings', '/daily-earnings'],
    activeTab: 'documents',
    docSubTab: 'earnings',
    label: 'Daily Earnings (Documents Hub)',
    icon: '💰'
  },
  {
    path: '/documents/muster',
    aliases: ['/individual-muster', '/documents/individual-muster'],
    activeTab: 'documents',
    docSubTab: 'muster',
    label: 'Individual Muster (Documents Hub)',
    icon: '📋'
  },
  {
    path: '/documents/amenity',
    aliases: ['/amenity', '/booking-chart', '/amenity-booking'],
    activeTab: 'documents',
    docSubTab: 'amenity',
    label: 'Amenity Booking Chart (Documents Hub)',
    icon: '📊'
  },
  {
    path: '/muster',
    aliases: ['/muster-roll', '/muster-details', '/attendance'],
    activeTab: 'muster',
    docSubTab: null,
    label: 'Muster Details (Attendance Roll)',
    icon: '📅'
  },
  {
    path: '/lr-list',
    aliases: ['/lr', '/lr-sheet', '/leave-reserve'],
    activeTab: 'lr-list',
    docSubTab: null,
    label: 'LR List (Leave Reserve Sheet)',
    icon: '📋'
  },
  {
    path: '/availability',
    aliases: ['/staff-availability', '/available'],
    activeTab: 'availability',
    docSubTab: null,
    label: 'Staff Availability Sheet',
    icon: '🟢'
  },
  {
    path: '/seniority',
    aliases: ['/seniority-list'],
    activeTab: 'seniority',
    docSubTab: null,
    label: 'Seniority List',
    icon: '🏅'
  },
  {
    path: '/audit',
    aliases: ['/audit-logs', '/logs', '/history'],
    activeTab: 'audit',
    docSubTab: null,
    label: 'Audit Logs',
    icon: '📜'
  },
  {
    path: '/user-management',
    aliases: ['/users', '/user-approvals', '/admin/users'],
    activeTab: 'user-management',
    docSubTab: null,
    label: 'User Approvals',
    icon: '🛡️'
  },
  {
    path: '/register',
    aliases: ['/duty-register'],
    activeTab: 'register',
    docSubTab: null,
    label: 'Actual Duty Register',
    icon: '📝'
  }
];

/**
 * Given the browser `window.location.pathname` (e.g. `/muster` or `/documents/nda`),
 * returns `{ activeTab, docSubTab, routeEntry }`.
 */
export function parseRouteFromPathname(rawPathname) {
  const clean = String(rawPathname || '/')
    .trim()
    .toLowerCase()
    .replace(/\/+$/, '') || '/';

  for (const entry of TAB_ROUTE_DIRECTORY) {
    if (entry.path.toLowerCase() === clean) {
      return {
        activeTab: entry.activeTab,
        docSubTab: entry.docSubTab || 'ta',
        routeEntry: entry
      };
    }
    if (Array.isArray(entry.aliases) && entry.aliases.some((a) => a.toLowerCase() === clean)) {
      return {
        activeTab: entry.activeTab,
        docSubTab: entry.docSubTab || 'ta',
        routeEntry: entry
      };
    }
  }

  return {
    activeTab: 'daily',
    docSubTab: 'ta',
    routeEntry: TAB_ROUTE_DIRECTORY[0]
  };
}

/**
 * Returns the canonical URL path (e.g. `/muster`, `/documents/nda`, `/lr-list`)
 * for the given `activeTab` and `docSubTab`.
 */
export function getCanonicalPathForTab(activeTab, docSubTab = 'ta') {
  if (activeTab === 'documents') {
    const sub = docSubTab || 'ta';
    const foundDoc = TAB_ROUTE_DIRECTORY.find(
      (r) => r.activeTab === 'documents' && r.docSubTab === sub
    );
    return foundDoc ? foundDoc.path : `/documents/${sub}`;
  }

  const found = TAB_ROUTE_DIRECTORY.find((r) => r.activeTab === activeTab);
  return found ? found.path : `/${activeTab || 'daily'}`;
}

export const MODULE_DATA_FLOW_INFO = {
  'daily-summary': {
    title: 'Daily Summary / Daily Duty Movement',
    icon: '📋',
    frontendRoute: '/daily & /daily-summary',
    frontendSource: 'App.jsx (Daily Summary Tab)',
    readEndpoints: ['GET /api/reports/daily-view', 'GET /api/reports/availability-sheet'],
    writeEndpoints: [
      'POST /api/duty/change-status',
      'POST /api/duty/exchange-staff',
      'POST /api/duty/drag-assign-train',
      'POST /api/duty/assign-non-daily-train'
    ],
    primaryTables: ['overrides', 'non_daily_assignments'],
    syncedTargets: [
      'Monthly Movement Grid (overrides)',
      'Muster Roll (muster_records)',
      'LR Sheet (lr_sheet_records)',
      'TA Approvals & TA Journal (ta_approvals, ta_entries)',
      'NDA Journal (nda_entries)',
      'Staff Diary (diary_entries)',
      'Daily Earnings (daily_earnings_entries)',
      'Audit Logs (audit_logs)'
    ],
    summary: 'Any duty change, leave, spare, substitute, or train assignment saved here writes to `overrides` and immediately cascades across Muster Roll, LR Sheet, TA, NDA, Diary, and Daily Earnings.'
  },
  'monthly-movement': {
    title: 'Monthly Movement (30/31-Day Roster Grid)',
    icon: '📅',
    frontendRoute: '/roster',
    frontendSource: 'App.jsx (Monthly Movement Tab)',
    readEndpoints: ['GET /api/roster'],
    writeEndpoints: [
      'POST /api/duty/change-status',
      'POST /api/roster/change-rest-day',
      'POST /api/staff/:id/change-weekly-rest'
    ],
    primaryTables: ['overrides', 'roster_rest_adjustments', 'staff_rest_rules'],
    syncedTargets: [
      'Daily Summary Table (overrides)',
      'Muster Roll (muster_records)',
      'LR Sheet (lr_sheet_records)',
      'TA Approvals & TA Journal (ta_approvals, ta_entries)',
      'NDA Journal (nda_entries)',
      'Staff Diary (diary_entries)',
      'Daily Earnings (daily_earnings_entries)',
      'Audit Logs (audit_logs)'
    ],
    summary: 'Edits to any date cell or rest rule in the Monthly Movement Grid save to `overrides` / `roster_rest_adjustments` and sync with Daily Summary, Muster Roll, LR Sheet, and all Employee Documents.'
  },
  'muster-roll': {
    title: 'Muster Roll & Individual Attendance',
    icon: '📑',
    frontendRoute: '/muster (and /documents/muster)',
    frontendSource: 'MusterRoll.jsx & IndividualMusterDocument.jsx',
    readEndpoints: ['GET /api/muster'],
    writeEndpoints: [
      'POST /api/muster/update-cell',
      'POST /api/muster/batch-update',
      'POST /api/muster/reset-cell',
      'POST /api/muster/batch-reset'
    ],
    primaryTables: ['muster_records'],
    syncedTargets: [
      'Daily Summary Table (overrides)',
      'Monthly Movement Grid (overrides)',
      'LR Sheet (lr_sheet_records)',
      'TA Approvals & TA Journal (ta_approvals, ta_entries)',
      'NDA Journal (nda_entries)',
      'Staff Diary (diary_entries)',
      'Daily Earnings (daily_earnings_entries)',
      'Audit Logs (audit_logs)'
    ],
    summary: 'Saving attendance or duty codes in Muster Roll writes to `muster_records` (one employee at a time) and runs `syncMusterToSchedulesAndApprovals()` to update Daily Summary, Monthly Movement, LR Sheet, TA, NDA, Diary, and Earnings.'
  },
  'lr-sheet': {
    title: 'Leave Reserve (LR) Sheet',
    icon: '🗂️',
    frontendRoute: '/lr-list (alias: /lr)',
    frontendSource: 'LRList.jsx',
    readEndpoints: ['GET /api/lr-sheet'],
    writeEndpoints: [
      'POST /api/lr-sheet/cell',
      'POST /api/lr-sheet/batch-update',
      'POST /api/lr-sheet/sync-from-daily-duty'
    ],
    primaryTables: ['lr_sheet_records', 'lr_sheet_members'],
    syncedTargets: [
      'Daily Summary Table (overrides)',
      'Monthly Movement Grid (overrides)',
      'Muster Roll (muster_records)',
      'TA Approvals & TA Journal (ta_approvals, ta_entries)',
      'NDA Journal (nda_entries)',
      'Staff Diary (diary_entries)',
      'Daily Earnings (daily_earnings_entries)',
      'Audit Logs (audit_logs)'
    ],
    summary: 'Saving a duty or leave code on the LR Sheet writes to `lr_sheet_records` and runs `syncLRSheetCellChange()` to update `overrides`, `muster_records`, `ta_approvals`, `ta_entries`, `nda_entries`, `diary_entries`, and `daily_earnings_entries`.'
  },
  'ta-approvals': {
    title: 'TA Approvals (Claim Verification Portal)',
    icon: '🚆',
    frontendRoute: '/ta-approvals',
    frontendSource: 'TaApprovals.jsx',
    readEndpoints: ['GET /api/ta-approvals'],
    writeEndpoints: [
      'POST /api/ta-approvals/accept',
      'POST /api/ta-approvals/accept-batch',
      'POST /api/ta-approvals/accept-all',
      'POST /api/ta-approvals/reject',
      'POST /api/ta-approvals/revert'
    ],
    primaryTables: ['ta_approvals', 'ta_entries'],
    syncedTargets: [
      'Employee TA Journal (ta_entries)',
      'NDA Journal (nda_entries)',
      'Staff Diary (diary_entries)',
      'Daily Earnings (daily_earnings_entries)',
      'Audit Logs (audit_logs)'
    ],
    summary: 'Accepting or rejecting TA claims updates `ta_approvals` one employee at a time, writes accepted claims into `ta_entries`, and logs the exact saved/error counts to `audit_logs`.'
  },
  'ta-journal': {
    title: 'Employee TA Journal Document',
    icon: '🧾',
    frontendRoute: '/documents/ta (alias: /ta)',
    frontendSource: 'TaDocument.jsx',
    readEndpoints: ['GET /api/documents/ta/:staffId'],
    writeEndpoints: [
      'POST /api/documents/ta/:staffId',
      'DELETE /api/documents/ta/:staffId'
    ],
    primaryTables: ['ta_entries', 'ta_approvals', 'actual_train_runs'],
    syncedTargets: [
      'TA Approvals (ta_approvals)',
      'Daily Summary Table (overrides)',
      'Muster Roll (muster_records)',
      'LR Sheet (lr_sheet_records)',
      'NDA Journal (nda_entries)',
      'Staff Diary (diary_entries)',
      'Daily Earnings (daily_earnings_entries)',
      'Audit Logs (audit_logs)'
    ],
    summary: 'Saving an employee’s TA Journal writes to `ta_entries` & `ta_approvals` and synchronizes any train/duty changes back to Daily Summary, Muster Roll, LR Sheet, NDA, Diary, and Daily Earnings.'
  },
  'nda-journal': {
    title: 'Employee NDA (Night Duty Allowance) Journal',
    icon: '🌙',
    frontendRoute: '/documents/nda (alias: /nda)',
    frontendSource: 'NdaDocument.jsx',
    readEndpoints: ['GET /api/documents/nda/:staffId'],
    writeEndpoints: [
      'POST /api/documents/nda/:staffId',
      'DELETE /api/documents/nda/:staffId'
    ],
    primaryTables: ['nda_entries', 'actual_train_runs'],
    syncedTargets: [
      'Daily Summary Table (overrides)',
      'Muster Roll (muster_records)',
      'LR Sheet (lr_sheet_records)',
      'TA Approvals & TA Journal (ta_approvals, ta_entries)',
      'Staff Diary (diary_entries)',
      'Daily Earnings (daily_earnings_entries)',
      'Audit Logs (audit_logs)'
    ],
    summary: 'Saving an employee’s NDA Journal writes to `nda_entries` and cascades any edited duty/train numbers across Roster, Muster, LR Sheet, TA, Diary, and Daily Earnings.'
  },
  'staff-diary': {
    title: 'Staff Diary (Monthly Work & EFT Statement)',
    icon: '📔',
    frontendRoute: '/documents/diary (alias: /diary)',
    frontendSource: 'DiaryDocument.jsx',
    readEndpoints: ['GET /api/documents/diary/:staffId'],
    writeEndpoints: [
      'POST /api/documents/diary/:staffId',
      'DELETE /api/documents/diary/:staffId'
    ],
    primaryTables: ['diary_entries', 'daily_earnings_entries'],
    syncedTargets: [
      'Daily Earnings Sheet (daily_earnings_entries)',
      'Daily Summary Table (overrides)',
      'Muster Roll (muster_records)',
      'LR Sheet (lr_sheet_records)',
      'TA Approvals & TA Journal (ta_approvals, ta_entries)',
      'NDA Journal (nda_entries)',
      'Audit Logs (audit_logs)'
    ],
    summary: 'Saving the Staff Diary writes to `diary_entries`, cross-saves EFT cases/amounts into `daily_earnings_entries`, and syncs duty updates across Roster, Muster, TA, and NDA.'
  },
  'daily-earnings': {
    title: 'Daily Earnings & EFT Checking Sheet',
    icon: '💰',
    frontendRoute: '/documents/earnings (alias: /earnings)',
    frontendSource: 'DailyEarningsDocument.jsx',
    readEndpoints: [
      'GET /api/documents/daily-earnings',
      'GET /api/documents/daily-earnings/staff/:staffId',
      'GET /api/documents/daily-earnings/range'
    ],
    writeEndpoints: [
      'POST /api/documents/daily-earnings',
      'POST /api/documents/daily-earnings/staff/:staffId',
      'POST /api/documents/daily-earnings/range',
      'DELETE /api/documents/daily-earnings'
    ],
    primaryTables: ['daily_earnings_entries', 'diary_entries'],
    syncedTargets: [
      'Staff Diary (diary_entries)',
      'Daily Summary Table (overrides)',
      'Monthly Movement Grid (overrides)',
      'Muster Roll (muster_records)',
      'LR Sheet (lr_sheet_records)',
      'TA Approvals & TA Journal (ta_approvals, ta_entries)',
      'NDA Journal (nda_entries)',
      'Audit Logs (audit_logs)'
    ],
    summary: 'Saving Daily Earnings writes to `daily_earnings_entries` one employee at a time, syncs EFT figures with `diary_entries`, and updates working duties across Roster, Muster, TA, and NDA.'
  },
  'links-master': {
    title: 'Train Roster & Cyclic Link Sets',
    icon: '🚆',
    frontendRoute: '/links',
    frontendSource: 'App.jsx (Train Roster Tab)',
    readEndpoints: ['GET /api/links', 'GET /api/link-sets', 'GET /api/train-ta-nda'],
    writeEndpoints: ['POST /api/links', 'PUT /api/links/:id', 'POST /api/train-ta-nda/batch'],
    primaryTables: ['links', 'link_sets', 'train_ta_nda'],
    syncedTargets: [
      'Daily Summary Table',
      'Monthly Movement Grid',
      'Muster Roll',
      'TA Approvals & Journal',
      'NDA Journal',
      'Audit Logs (audit_logs)'
    ],
    summary: 'Edits to base link slots or train TA/NDA timings save to `links` / `train_ta_nda` and recalculate schedules across all connected modules.'
  },
  'staff-master': {
    title: 'Staff Directory & Category Roster',
    icon: '👥',
    frontendRoute: '/staff',
    frontendSource: 'App.jsx (Staff Roster Tab)',
    readEndpoints: ['GET /api/staff', 'GET /api/categories'],
    writeEndpoints: ['POST /api/staff', 'PUT /api/staff/:id', 'DELETE /api/staff/:id'],
    primaryTables: ['staff', 'categories'],
    syncedTargets: [
      'Daily Summary Table',
      'Monthly Movement Grid',
      'Muster Roll',
      'LR Sheet (lr_sheet_members)',
      'All Employee Documents',
      'Audit Logs (audit_logs)'
    ],
    summary: 'Adding, editing, or reordering employees updates `staff` and immediately reflects across all rosters, Muster Roll, LR Sheet, and Documents.'
  },
  'leaves-swap': {
    title: 'Leave Requests & Staff Duty Swaps',
    icon: '✉️',
    frontendRoute: '/leaves',
    frontendSource: 'App.jsx (Leave / Swap Tab)',
    readEndpoints: ['GET /api/leave-requests'],
    writeEndpoints: [
      'POST /api/leave-requests',
      'POST /api/leave-requests/:id/approve',
      'POST /api/leave-requests/:id/reject',
      'POST /api/duty/exchange-staff'
    ],
    primaryTables: ['leave_requests', 'overrides'],
    syncedTargets: [
      'Daily Summary Table (overrides)',
      'Monthly Movement Grid (overrides)',
      'Muster Roll (muster_records)',
      'LR Sheet (lr_sheet_records)',
      'TA / NDA / Diary / Earnings',
      'Audit Logs (audit_logs)'
    ],
    summary: 'Approving leaves or swapping staff writes to `leave_requests` and `overrides` and cascades across Muster Roll, LR Sheet, TA, NDA, Diary, and Daily Earnings.'
  },
  'seniority-list': {
    title: 'Seniority List',
    icon: '🏅',
    frontendRoute: '/seniority',
    frontendSource: 'SeniorityList.jsx',
    readEndpoints: ['GET /api/seniority-list'],
    writeEndpoints: ['PUT /api/seniority-list/:id'],
    primaryTables: ['seniority_list', 'staff'],
    syncedTargets: ['Staff Directory', 'Coach Allocation', 'Audit Logs (audit_logs)'],
    summary: 'Updates employee seniority rank and details in `seniority_list`.'
  }
};

