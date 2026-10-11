import React, { useState, useEffect } from 'react';

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

/**
 * Compact, collapsible banner that can be placed at the top of any module or document
 * so the user immediately sees the Direct URL Path, Backend Endpoint, and Database Flow.
 */
export function ModuleDataFlowBar({ moduleKey, currentPath, style = {} }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const info = MODULE_DATA_FLOW_INFO[moduleKey];
  if (!info) return null;

  const displayPath = currentPath || (typeof window !== 'undefined' ? window.location.pathname : info.frontendRoute);

  const handleCopyUrl = (e) => {
    e.stopPropagation();
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="no-print"
      style={{
        marginBottom: '10px',
        padding: '7px 12px',
        borderRadius: '8px',
        background: 'rgba(15, 23, 42, 0.78)',
        border: '1px solid rgba(56, 189, 248, 0.28)',
        color: '#e2e8f0',
        fontSize: '0.76rem',
        ...style
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          flexWrap: 'wrap',
          cursor: 'pointer'
        }}
        onClick={() => setExpanded(!expanded)}
        title="Click to inspect full URL Route, Backend Endpoint & Database Flow for this screen"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span
            onClick={handleCopyUrl}
            title="Click to copy full URL for this tab"
            style={{
              padding: '2px 7px',
              borderRadius: '4px',
              background: 'rgba(245, 158, 11, 0.16)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: '#fbbf24',
              fontWeight: 700,
              fontFamily: 'monospace',
              fontSize: '0.73rem',
              cursor: 'pointer'
            }}
          >
            🔗 {copied ? 'Copied URL!' : displayPath}
          </span>
          <span style={{ fontWeight: 700, color: '#38bdf8' }}>
            {info.icon} {info.title}:
          </span>
          <span>
            <strong style={{ color: '#94a3b8' }}>Saves via:</strong>{' '}
            <code
              style={{
                padding: '1px 6px',
                borderRadius: '4px',
                background: 'rgba(56, 189, 248, 0.14)',
                color: '#7dd3fc',
                fontWeight: 700
              }}
            >
              {info.writeEndpoints[0]}
            </code>
          </span>
          <span>→</span>
          <span>
            <strong style={{ color: '#94a3b8' }}>DB Table:</strong>{' '}
            <code
              style={{
                padding: '1px 6px',
                borderRadius: '4px',
                background: 'rgba(16, 185, 129, 0.16)',
                color: '#6ee7b7',
                fontWeight: 700
              }}
            >
              {info.primaryTables.join(', ')}
            </code>
          </span>
          <span>→</span>
          <span style={{ color: '#cbd5e1' }}>
            <strong style={{ color: '#94a3b8' }}>Auto-Syncs:</strong>{' '}
            {info.syncedTargets.slice(0, 3).join(' • ')}
            {info.syncedTargets.length > 3 ? ` +${info.syncedTargets.length - 3} more` : ''}
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          style={{
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            color: '#38bdf8',
            borderRadius: '5px',
            padding: '2px 8px',
            fontSize: '0.7rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {expanded ? '▲ Hide Route & Endpoint Map' : '▼ View Route & Where Data Goes'}
        </button>
      </div>

      {expanded && (
        <div
          style={{
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid rgba(148, 163, 184, 0.2)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '10px',
            lineHeight: 1.5
          }}
        >
          <div>
            <div style={{ color: '#94a3b8', fontWeight: 700, marginBottom: '3px' }}>
              1. Frontend Route, Component & Read Endpoints:
            </div>
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: '#cbd5e1' }}>Direct Tab URL: </span>
              <code style={{ color: '#fbbf24', fontWeight: 700 }}>{info.frontendRoute}</code>
            </div>
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: '#cbd5e1' }}>UI Component: </span>
              <code style={{ color: '#f8fafc' }}>{info.frontendSource}</code>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {info.readEndpoints.map((ep, i) => (
                <code
                  key={i}
                  style={{
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: 'rgba(148, 163, 184, 0.15)',
                    color: '#e2e8f0',
                    fontSize: '0.71rem'
                  }}
                >
                  {ep}
                </code>
              ))}
            </div>
          </div>

          <div>
            <div style={{ color: '#94a3b8', fontWeight: 700, marginBottom: '3px' }}>
              2. Save / Write Endpoints & Primary DB Tables:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
              {info.writeEndpoints.map((ep, i) => (
                <code
                  key={i}
                  style={{
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: 'rgba(56, 189, 248, 0.16)',
                    color: '#38bdf8',
                    fontSize: '0.71rem',
                    fontWeight: 700
                  }}
                >
                  {ep}
                </code>
              ))}
            </div>
            <div>
              <span style={{ color: '#cbd5e1' }}>Primary SQLite Table(s): </span>
              {info.primaryTables.map((t, i) => (
                <code
                  key={i}
                  style={{
                    marginRight: '4px',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: 'rgba(16, 185, 129, 0.16)',
                    color: '#6ee7b7',
                    fontSize: '0.71rem',
                    fontWeight: 700
                  }}
                >
                  {t}
                </code>
              ))}
            </div>
          </div>

          <div>
            <div style={{ color: '#94a3b8', fontWeight: 700, marginBottom: '3px' }}>
              3. Automatically Synced Modules & Tables:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {info.syncedTargets.map((target, i) => (
                <span
                  key={i}
                  style={{
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: 'rgba(99, 102, 241, 0.16)',
                    color: '#c7d2fe',
                    fontSize: '0.7rem'
                  }}
                >
                  {target}
                </span>
              ))}
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1', color: '#94a3b8', fontSize: '0.74rem' }}>
            💡 <strong style={{ color: '#e2e8f0' }}>How it works:</strong> {info.summary}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Interactive Explorer showing every Frontend URL Route, Backend API Endpoint,
 * Primary SQLite Database Table, and Cascaded/Synced Modules.
 */
export function BackendEndpointExplorer({ onNavigateRoute }) {
  const [mapData, setMapData] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('ALL');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch('/api/system/data-flow-map')
      .then((r) => r.json())
      .then((d) => {
        if (active && d && d.groups) {
          setMapData(d);
        }
      })
      .catch((err) => console.error('Failed to load endpoint map:', err))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const groups = mapData?.groups || [];
  const q = search.trim().toLowerCase();

  return (
    <div
      style={{
        marginBottom: '20px',
        padding: '16px',
        borderRadius: '10px',
        background: 'rgba(15, 23, 42, 0.85)',
        border: '1px solid rgba(56, 189, 248, 0.35)'
      }}
    >
      {/* Frontend Direct URL Routes Directory */}
      <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
        <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fbbf24', marginBottom: '6px' }}>
          🔗 Direct Frontend URL Paths for Every Tab (Click any path to open)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {TAB_ROUTE_DIRECTORY.map((r) => (
            <a
              key={r.path}
              href={r.path}
              onClick={(e) => {
                if (onNavigateRoute) {
                  e.preventDefault();
                  onNavigateRoute(r.activeTab, r.docSubTab);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 9px',
                borderRadius: '6px',
                background: 'rgba(30, 41, 59, 0.9)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                color: '#f8fafc',
                textDecoration: 'none',
                fontSize: '0.73rem'
              }}
              title={`Aliases: ${(r.aliases || []).join(', ')}`}
            >
              <span>{r.icon}</span>
              <code style={{ color: '#fbbf24', fontWeight: 700 }}>{r.path}</code>
              <span style={{ color: '#94a3b8' }}>({r.label})</span>
            </a>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '12px'
        }}
      >
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
            🗺️ Complete Backend & Frontend Endpoint Data-Flow Map
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Look up any API endpoint (`GET`, `POST`, `PUT`, `DELETE`) to see which Frontend screen calls it, which SQLite database table saves it, and where the data automatically flows.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: '0.78rem',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              background: 'rgba(15, 23, 42, 0.9)',
              color: 'var(--color-text-primary)'
            }}
          >
            <option value="ALL">All 13 Endpoint Groups</option>
            {groups.map((g) => (
              <option key={g.group_id} value={g.group_id}>
                {g.group_title}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="🔍 Search endpoint (/api/muster, /api/duty, ta_entries...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              background: 'rgba(15, 23, 42, 0.9)',
              color: 'var(--color-text-primary)',
              minWidth: '260px'
            }}
          />
        </div>
      </div>

      {loading && (
        <div style={{ padding: '12px', color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
          Loading endpoint architecture map...
        </div>
      )}

      {!loading &&
        groups
          .filter((g) => selectedGroup === 'ALL' || g.group_id === selectedGroup)
          .map((group) => {
            const matchingEndpoints = (group.endpoints || []).filter((ep) => {
              if (!q) return true;
              const hay = `${ep.method} ${ep.endpoint} ${ep.module} ${ep.frontend_caller} ${(ep.saves_to_tables || []).join(' ')} ${(ep.cascades_to_tables || []).join(' ')} ${ep.description}`.toLowerCase();
              return hay.includes(q);
            });

            if (matchingEndpoints.length === 0) return null;

            return (
              <div
                key={group.group_id}
                style={{
                  marginBottom: '14px',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    background: 'rgba(30, 41, 59, 0.9)',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}
                >
                  <div>
                    <strong style={{ color: '#f8fafc', fontSize: '0.85rem' }}>{group.group_title}</strong>
                    <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{group.group_description}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Primary DB:</span>
                    {(group.primary_tables || []).map((t, idx) => (
                      <code
                        key={idx}
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(16, 185, 129, 0.16)',
                          color: '#6ee7b7',
                          fontSize: '0.72rem',
                          fontWeight: 700
                        }}
                      >
                        {t}
                      </code>
                    ))}
                  </div>
                </div>

                <div className="data-table-container" style={{ margin: 0 }}>
                  <table className="data-table" style={{ fontSize: '0.77rem' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '220px' }}>Backend Endpoint</th>
                        <th style={{ width: '210px' }}>Called From (Frontend)</th>
                        <th style={{ width: '160px' }}>Saves To (Primary DB)</th>
                        <th style={{ width: '250px' }}>Cascades / Auto-Syncs To</th>
                        <th>How Data Flows (Plain-English Summary)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchingEndpoints.map((ep, idx) => {
                        const isWrite = ep.method !== 'GET';
                        const methodColor =
                          ep.method === 'POST'
                            ? '#34d399'
                            : ep.method === 'PUT'
                            ? '#fbbf24'
                            : ep.method === 'DELETE'
                            ? '#f87171'
                            : '#60a5fa';

                        return (
                          <tr key={idx} style={{ verticalAlign: 'top' }}>
                            <td>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 800,
                                  fontSize: '0.68rem',
                                  marginRight: '6px',
                                  background: 'rgba(15, 23, 42, 0.8)',
                                  color: methodColor,
                                  border: `1px solid ${methodColor}`
                                }}
                              >
                                {ep.method}
                              </span>
                              <code style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.75rem' }}>
                                {ep.endpoint}
                              </code>
                              <div style={{ fontSize: '0.7rem', color: '#38bdf8', marginTop: '2px' }}>
                                {ep.module}
                              </div>
                            </td>
                            <td style={{ color: '#cbd5e1', fontSize: '0.74rem' }}>{ep.frontend_caller}</td>
                            <td>
                              {isWrite && ep.saves_to_tables?.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                  {ep.saves_to_tables.map((t, i) => (
                                    <code
                                      key={i}
                                      style={{
                                        padding: '1px 5px',
                                        borderRadius: '3px',
                                        background: 'rgba(16, 185, 129, 0.16)',
                                        color: '#6ee7b7',
                                        fontSize: '0.7rem',
                                        fontWeight: 700
                                      }}
                                    >
                                      {t}
                                    </code>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                                  Read-Only ({(ep.reads_from_tables || []).join(', ')})
                                </span>
                              )}
                            </td>
                            <td>
                              {ep.cascades_to_tables?.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                  {ep.cascades_to_tables.map((t, i) => (
                                    <code
                                      key={i}
                                      style={{
                                        padding: '1px 5px',
                                        borderRadius: '3px',
                                        background: 'rgba(99, 102, 241, 0.16)',
                                        color: '#c7d2fe',
                                        fontSize: '0.69rem'
                                      }}
                                    >
                                      {t}
                                    </code>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: '#64748b', fontSize: '0.72rem' }}>—</span>
                              )}
                            </td>
                            <td style={{ color: '#e2e8f0', fontSize: '0.75rem', lineHeight: 1.4 }}>
                              {ep.description}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
    </div>
  );
}
