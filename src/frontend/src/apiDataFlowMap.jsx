import React, { useState, useEffect } from 'react';

/**
 * ============================================================================
 * FRONTEND & BACKEND DATA-FLOW MAP (`src/frontend/src/apiDataFlowMap.jsx`)
 * ============================================================================
 *
 * Clearly documents and visually displays for every screen/module:
 *   1. Which Backend API Endpoint(s) are called when reading or saving
 *   2. Which Primary SQLite Database Table(s) receive the saved data
 *   3. Which Linked Modules & Database Tables are automatically synchronized
 * ============================================================================
 */

export const MODULE_DATA_FLOW_INFO = {
  'daily-summary': {
    title: 'Daily Summary / Daily Duty Movement',
    icon: '📋',
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
    frontendSource: 'App.jsx (Muster Roll Tab & Individual Muster)',
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
    frontendSource: 'App.jsx (LR Sheet Modal / Tab)',
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
  }
};

/**
 * Compact, collapsible banner that can be placed at the top of any module or document
 * so the user immediately sees WHICH endpoint is called and WHERE the data goes.
 */
export function ModuleDataFlowBar({ moduleKey, style = {} }) {
  const [expanded, setExpanded] = useState(false);
  const info = MODULE_DATA_FLOW_INFO[moduleKey];
  if (!info) return null;

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
        title="Click to inspect full Backend Endpoint & Database Flow for this screen"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#38bdf8' }}>
            🧭 Data Flow ({info.icon} {info.title}):
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
            {info.syncedTargets.slice(0, 4).join(' • ')}
            {info.syncedTargets.length > 4 ? ` +${info.syncedTargets.length - 4} more` : ''}
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
          {expanded ? '▲ Hide Endpoint Map' : '▼ View Where Data Goes'}
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
              1. Frontend Component & Read Endpoints:
            </div>
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: '#cbd5e1' }}>UI Source: </span>
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
 * Interactive Explorer showing every Backend API Endpoint, Frontend Caller,
 * Primary SQLite Database Table, and Cascaded/Synced Modules.
 */
export function BackendEndpointExplorer() {
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
