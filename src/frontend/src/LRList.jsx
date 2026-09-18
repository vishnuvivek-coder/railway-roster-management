import React, { useState, useEffect, useMemo } from 'react';

const QUICK_CODES = [
  { code: 'R', label: 'Weekly Rest', color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.15)', border: 'rgba(156, 163, 175, 0.35)' },
  { code: 'S', label: 'Sick / Medical', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.18)', border: 'rgba(239, 68, 68, 0.4)' },
  { code: 'LAP', label: 'Leave on Avg Pay', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.18)', border: 'rgba(244, 63, 94, 0.4)' },
  { code: 'CL', label: 'Casual Leave', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.18)', border: 'rgba(6, 182, 212, 0.4)' },
  { code: 'CR', label: 'Compensatory Rest', color: '#a78bfa', bg: 'rgba(139, 92, 246, 0.18)', border: 'rgba(139, 92, 246, 0.4)' },
  { code: 'L', label: 'Leave', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.18)', border: 'rgba(245, 158, 11, 0.4)' },
  { code: 'CAP', label: 'Child Care / CAP', color: '#818cf8', bg: 'rgba(99, 102, 241, 0.18)', border: 'rgba(99, 102, 241, 0.4)' }
];

export default function LRList({ isAdmin, authToken, API_BASE = '/api' }) {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(9);
  const [sheetData, setSheetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Active cell edit modal
  const [editModal, setEditModal] = useState(null);
  const [inputCode, setInputCode] = useState('');
  const [inputRemarks, setInputRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncingDaily, setSyncingDaily] = useState(false);
  const [syncNotice, setSyncNotice] = useState(null);

  const fetchSheet = async (targetYear = year, targetMonth = month) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/lr-sheet?year=${targetYear}&month=${targetMonth}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch Leave Reserve sheet');
      }
      setSheetData(data);
    } catch (err) {
      console.error('Error loading LR sheet:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFromDailyDuty = async () => {
    try {
      setSyncingDaily(true);
      const res = await fetch(`${API_BASE}/lr-sheet/sync-from-daily-duty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to sync with Daily Duty Sheet');
      }
      setSyncNotice(data.message || 'Daily duty sheet checked and synchronized up to date.');
      await fetchSheet(year, month);
      setTimeout(() => setSyncNotice(null), 6000);
    } catch (err) {
      alert('Sync error: ' + err.message);
    } finally {
      setSyncingDaily(false);
    }
  };

  useEffect(() => {
    fetchSheet(year, month);
  }, [year, month]);

  // Real-time reactive listener: when duties are assigned in Daily Duty Management, auto-refresh LR sheet
  useEffect(() => {
    const handleDutyUpdate = () => {
      fetchSheet(year, month);
    };
    window.addEventListener('railway_duty_allotment_updated', handleDutyUpdate);
    return () => window.removeEventListener('railway_duty_allotment_updated', handleDutyUpdate);
  }, [year, month]);

  const handleSaveCell = async (newCode, newRemarks = '') => {
    if (!editModal) return;
    try {
      setSaving(true);
      const token = authToken || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/lr-sheet/cell`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        },
        body: JSON.stringify({
          staff_id: editModal.staff.staffId,
          date: editModal.day.dateStr,
          duty_code: newCode,
          remarks: newRemarks
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update cell');
      }

      // Update local state smoothly
      setSheetData(prev => {
        if (!prev) return prev;
        const newRecords = { ...prev.records };
        const key = `${editModal.staff.staffId}_${editModal.day.dateStr}`;
        if (!newCode || newCode.trim() === '') {
          delete newRecords[key];
        } else {
          newRecords[key] = { dutyCode: newCode.trim(), remarks: newRemarks };
        }
        return { ...prev, records: newRecords };
      });

      setEditModal(null);
    } catch (err) {
      alert('Error updating cell: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Helper to determine style for badge
  const getBadgeStyle = (code) => {
    if (!code) return null;
    const clean = code.trim().toUpperCase();
    if (clean === 'AVL' || clean === 'AVAILABLE') {
      return { color: '#34d399', bg: 'rgba(16, 185, 129, 0.25)', border: '#10b981', isAvailable: true };
    }
    if (clean === 'REST_HQ' || clean === 'HQ REST') {
      return { color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.18)', border: 'rgba(245, 158, 11, 0.4)', isInHqRest: true };
    }
    if (clean === 'O' || clean === 'ABSENT') {
      return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.22)', border: 'rgba(239, 68, 68, 0.5)', isAbsent: true };
    }
    if (clean === 'R') {
      return { color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.15)', border: 'rgba(156, 163, 175, 0.4)', isRest: true };
    }
    if (clean === 'S' || clean === 'SICK') {
      return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.18)', border: 'rgba(239, 68, 68, 0.45)', isSick: true };
    }
    if (clean === 'LAP') {
      return { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.18)', border: 'rgba(244, 63, 94, 0.45)', isLeave: true };
    }
    if (clean === 'CL') {
      return { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.18)', border: 'rgba(6, 182, 212, 0.45)', isLeave: true };
    }
    if (clean.startsWith('CR')) {
      return { color: '#a78bfa', bg: 'rgba(139, 92, 246, 0.18)', border: 'rgba(139, 92, 246, 0.45)', isCr: true };
    }
    if (clean === 'L' || clean === 'CAP' || clean === 'LHAP' || clean === 'SCL' || clean === 'CCL' || clean === 'OD') {
      return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.18)', border: 'rgba(245, 158, 11, 0.45)', isLeave: true };
    }
    // Regular train or station duty (e.g. 12603, GTL, TPTY)
    return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)', isTrain: true };
  };

  const filteredStaff = useMemo(() => {
    if (!sheetData?.staff) return [];
    if (!searchQuery.trim()) return sheetData.staff;
    const q = searchQuery.toLowerCase().trim();
    return sheetData.staff.filter(s => 
      s.name.toLowerCase().includes(q) ||
      (s.designation && s.designation.toLowerCase().includes(q)) ||
      (s.restDay && s.restDay.toLowerCase().includes(q))
    );
  }, [sheetData, searchQuery]);

  // Compute staff row statistics
  const getStaffStats = (staff) => {
    if (!sheetData?.days || !sheetData?.records) return { duty: 0, rest: 0, sick: 0, leave: 0, total: 0 };
    let duty = 0, rest = 0, sick = 0, leave = 0;

    sheetData.days.forEach(day => {
      const rec = sheetData.records[`${staff.staffId}_${day.dateStr}`];
      const code = rec ? rec.dutyCode : (day.dayOfWeek === staff.restDay ? 'R' : null);
      if (!code) return;

      const style = getBadgeStyle(code);
      if (style?.isTrain) duty++;
      else if (style?.isRest) rest++;
      else if (style?.isSick) sick++;
      else if (style?.isLeave || style?.isCr) leave++;
    });

    return { duty, rest, sick, leave, total: duty + rest + sick + leave };
  };

  return (
    <div style={{ padding: '4px 0 32px 0' }}>
      {/* Top Header Card */}
      <div className="card" style={{
        padding: '22px',
        marginBottom: '20px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-glass)',
        borderRadius: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem' }}>🚆</span>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--primary)' }}>
                LEAVE RESERVE SHEET (LR LIST)
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', margin: '4px 0 0 0', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>Monthly Duty & Attendance Register for Leave Reserve Staff • <strong>{sheetData?.monthName || 'September 2026'}</strong></span>
                <span style={{ fontSize: '0.76rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                  ● Live Synced with Daily Duty Sheet
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Controls: Month/Year picker & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.2)', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Month:</span>
            <select
              className="form-input"
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              style={{ padding: '4px 8px', fontSize: '0.84rem', width: 'auto', background: 'transparent', border: 'none' }}
            >
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>

            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginLeft: '6px' }}>Year:</span>
            <select
              className="form-input"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              style={{ padding: '4px 8px', fontSize: '0.84rem', width: 'auto', background: 'transparent', border: 'none' }}
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (!sheetData?.days || !sheetData?.staff) return;
              let csv = 'SL. NO,NAME,DESG,REST';
              sheetData.days.forEach(d => { csv += `,${d.dayOfWeek} ${d.dayNum}`; });
              csv += ',DUTY DAYS,REST,SICK,LEAVES,TOTAL\n';

              sheetData.staff.forEach(s => {
                const stats = getStaffStats(s);
                csv += `"${s.slNo}","${s.name}","${s.designation || '-'}","${s.restDay || '-'}"`;
                if (s.isRelieved) {
                  sheetData.days.forEach(() => { csv += ',"RELIEVED TO ZRTI / MLY"'; });
                } else {
                  sheetData.days.forEach(d => {
                    const rec = sheetData.records[`${s.staffId}_${d.dateStr}`];
                    const val = rec ? rec.dutyCode : (d.dayOfWeek === s.restDay ? 'R' : '-');
                    csv += `,"${val}"`;
                  });
                }
                csv += `,${stats.duty},${stats.rest},${stats.sick},${stats.leave},${stats.total}\n`;
              });

              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.setAttribute('download', `LR_Sheet_${sheetData.monthName.replace(/\s+/g, '_')}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            style={{ padding: '7px 14px', fontSize: '0.85rem' }}
          >
            📥 Export CSV
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleSyncFromDailyDuty}
            disabled={syncingDaily}
            title="Check and auto-update all LR duties from Daily Duty Sheet up to date"
            style={{
              padding: '7px 14px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              fontWeight: 700
            }}
          >
            <span>⚡</span> {syncingDaily ? 'Checking Daily Duty Sheet...' : 'Auto-Sync Daily Duties'}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fetchSheet(year, month)}
            title="Refresh Leave Reserve sheet from latest daily duty allotments"
            style={{ padding: '7px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>🔄</span> Refresh
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.print()}
            style={{
              padding: '7px 14px',
              fontSize: '0.85rem',
              background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
              border: 'none',
              fontWeight: 700
            }}
          >
            📄 Print / PDF
          </button>
        </div>
      </div>

      {/* Sync Notification Banner */}
      {syncNotice && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 18px',
          borderRadius: '10px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          color: '#10b981',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: 700,
          fontSize: '0.9rem'
        }}>
          <span>✅ {syncNotice}</span>
          <button
            type="button"
            onClick={() => setSyncNotice(null)}
            style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontWeight: 800 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Legend & Quick Filter Bar */}
      <div style={{
        marginBottom: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Search LR employee name or rest..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ borderRadius: '8px', fontSize: '0.85rem', background: 'var(--bg-secondary)', paddingRight: searchQuery ? '32px' : '12px' }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.78rem' }}>
          <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Legend:</span>
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.35)', fontWeight: 700 }}>
            Train / Duty
          </span>
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af', border: '1px solid rgba(156, 163, 175, 0.3)', fontWeight: 700 }}>
            R (Rest)
          </span>
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.18)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', fontWeight: 700 }}>
            S (Sick)
          </span>
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(244, 63, 94, 0.18)', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.4)', fontWeight: 700 }}>
            LAP (Leave)
          </span>
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.18)', color: '#06b6d4', border: '1px solid rgba(6, 182, 212, 0.4)', fontWeight: 700 }}>
            CL
          </span>
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(139, 92, 246, 0.18)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.4)', fontWeight: 700 }}>
            CR
          </span>
        </div>
      </div>

      {/* Main Table Container */}
      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px auto' }}></div>
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading Leave Reserve Sheet...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '30px', textAlign: 'center', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444' }}>
          <p style={{ color: '#ef4444', fontWeight: 700 }}>{error}</p>
          <button className="btn btn-secondary" onClick={() => fetchSheet(year, month)}>Retry</button>
        </div>
      ) : sheetData ? (
        <div className="table-responsive lr-table-container" style={{
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--border-glass)',
          overflowX: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.36)'
        }}>
          <table className="roster-table lr-table" style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '2px solid var(--border-glass)' }}>
                <th className="lr-col-slno">
                  SL NO
                </th>
                <th className="lr-col-name">
                  NAME
                </th>
                <th className="lr-col-desg">
                  DESG
                </th>
                <th className="lr-col-rest">
                  REST
                </th>

                {/* Day Columns */}
                {sheetData.days.map(d => (
                  <th
                    key={d.dateStr}
                    style={{
                      width: '78px',
                      minWidth: '72px',
                      textAlign: 'center',
                      padding: '8px 2px',
                      background: d.isSunday ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                      borderRight: '1px solid var(--border-glass)',
                      color: d.isSunday ? '#f87171' : 'inherit'
                    }}
                  >
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, opacity: 0.85 }}>
                      {d.dayOfWeek}
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>
                      {d.dayNum}
                    </div>
                  </th>
                ))}

                {/* Summary Columns */}
                <th style={{ width: '55px', textAlign: 'center', padding: '8px 4px', background: '#17171a', color: '#10b981', fontWeight: 700 }}>
                  DUTY
                </th>
                <th style={{ width: '50px', textAlign: 'center', padding: '8px 4px', background: '#17171a', color: '#9ca3af', fontWeight: 700 }}>
                  REST
                </th>
                <th style={{ width: '50px', textAlign: 'center', padding: '8px 4px', background: '#17171a', color: '#ef4444', fontWeight: 700 }}>
                  SICK
                </th>
                <th style={{ width: '55px', textAlign: 'center', padding: '8px 4px', background: '#17171a', color: '#f43f5e', fontWeight: 700 }}>
                  LEAVE
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((staff, sIdx) => {
                const isEven = sIdx % 2 === 0;
                const stats = getStaffStats(staff);

                return (
                  <tr
                    key={staff.staffId || sIdx}
                    style={{
                      background: isEven ? 'rgba(255,255,255,0.015)' : 'transparent',
                      borderBottom: '1px solid var(--border-glass)'
                    }}
                  >
                    {/* Fixed Columns */}
                    <td className="lr-col-slno">
                      {staff.slNo}
                    </td>
                    <td className="lr-col-name">
                      {staff.name}
                    </td>
                    <td className="lr-col-desg">
                      {staff.designation || '-'}
                    </td>
                    <td className="lr-col-rest">
                      {staff.restDay || '-'}
                    </td>

                    {/* Check if this row is K NAGA NAIK (relieved) */}
                    {staff.isRelieved ? (
                      <td
                        colSpan={sheetData.days.length}
                        style={{
                          textAlign: 'center',
                          padding: '10px',
                          background: 'rgba(239, 68, 68, 0.06)',
                          color: '#f87171',
                          fontWeight: 800,
                          letterSpacing: '2px',
                          fontSize: '0.85rem'
                        }}
                      >
                        ★ ★ ★ ★ ★ {staff.relievedNote || 'RELIEVED TO ZRTI / MLY'} ★ ★ ★ ★ ★
                      </td>
                    ) : (
                      sheetData.days.map(day => {
                        const rec = sheetData.records[`${staff.staffId}_${day.dateStr}`];
                        // If cell is empty, check if it's default weekly rest day
                        const isDefaultRest = !rec && (day.dayOfWeek === staff.restDay);
                        const displayCode = rec ? rec.dutyCode : (isDefaultRest ? 'R' : '');
                        const badgeStyle = getBadgeStyle(displayCode);

                        return (
                          <td
                            key={day.dateStr}
                            onClick={() => {
                              if (isAdmin) {
                                setEditModal({ staff, day, currentCode: displayCode, remarks: rec?.remarks || '' });
                                setInputCode(displayCode);
                                setInputRemarks(rec?.remarks || '');
                              }
                            }}
                            style={{
                              textAlign: 'center',
                              padding: '6px 2px',
                              borderRight: '1px solid var(--border-glass)',
                              background: day.isSunday ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                              cursor: isAdmin ? 'pointer' : 'default',
                              verticalAlign: 'middle',
                              transition: 'background 0.15s'
                            }}
                            title={isAdmin ? `Click to edit ${staff.name} duty on ${day.dateStr}` : displayCode}
                          >
                            {displayCode === 'AVL' || rec?.isAvailable ? (() => {
                              const arrMatch = rec?.arrivalTime || (rec?.remarks && rec.remarks.match(/arr\s+GNT\s+(\d{1,2}:\d{2})/i)?.[1]);
                              return (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '2px 5px',
                                    borderRadius: '5px',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    color: '#34d399',
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    border: '1px solid rgba(16, 185, 129, 0.4)',
                                    letterSpacing: '0.2px',
                                    whiteSpace: 'nowrap',
                                    lineHeight: 1.15
                                  }}
                                  title={rec?.remarks || `Available for Duty (${staff.name} - min 8h HQ rest completed)`}
                                >
                                  <span>Available</span>
                                  {arrMatch && <span style={{ fontSize: '0.60rem', color: '#6ee7b7', fontWeight: 600 }}>Arr {arrMatch}</span>}
                                </span>
                              );
                            })() : displayCode === 'REST_HQ' || rec?.isInHqRest ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 5px',
                                  borderRadius: '5px',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  background: 'rgba(245, 158, 11, 0.18)',
                                  color: '#fbbf24',
                                  border: '1px solid rgba(245, 158, 11, 0.4)',
                                  whiteSpace: 'nowrap'
                                }}
                                title={rec?.remarks || 'In statutory HQ rest (< 8h required)'}
                              >
                                ⏳ HQ Rest
                              </span>
                            ) : displayCode ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 6px',
                                  borderRadius: '5px',
                                  fontSize: displayCode.length > 8 ? '0.65rem' : '0.74rem',
                                  fontWeight: 700,
                                  lineHeight: 1.2,
                                  maxWidth: '70px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  background: badgeStyle?.bg || 'rgba(255,255,255,0.06)',
                                  color: badgeStyle?.color || 'inherit',
                                  border: `1px solid ${badgeStyle?.border || 'transparent'}`,
                                  opacity: isDefaultRest ? 0.65 : 1
                                }}
                              >
                                {displayCode}
                              </span>
                            ) : (
                              isAdmin ? (
                                <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.75rem' }}>
                                  +
                                </span>
                              ) : null
                            )}
                          </td>
                        );
                      })
                    )}

                    {/* Stats */}
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#10b981', padding: '6px 2px' }}>
                      {stats.duty}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#9ca3af', padding: '6px 2px' }}>
                      {stats.rest}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#ef4444', padding: '6px 2px' }}>
                      {stats.sick}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#f43f5e', padding: '6px 2px' }}>
                      {stats.leave}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Admin Cell Edit Modal */}
      {editModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div className="card" style={{
            background: '#1a1a1d',
            border: '1px solid var(--border-gold)',
            borderRadius: '16px',
            maxWidth: '480px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--primary)' }}>
                  Assign LR Duty / Attendance
                </h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.84rem', margin: '4px 0 0 0' }}>
                  {editModal.staff.name} ({editModal.staff.designation}) • <strong>{editModal.day.dayOfWeek} {editModal.day.dateStr}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditModal(null)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Quick Buttons */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                Quick Attendance / Rest Codes:
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {QUICK_CODES.map(q => (
                  <button
                    key={q.code}
                    type="button"
                    onClick={() => setInputCode(q.code)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: inputCode === q.code ? q.bg : 'rgba(255,255,255,0.06)',
                      color: inputCode === q.code ? q.color : 'inherit',
                      border: `1px solid ${inputCode === q.code ? q.color : 'rgba(255,255,255,0.1)'}`
                    }}
                  >
                    {q.code} ({q.label})
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Code / Train Number input */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                Train Number / Movement / Custom Duty:
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 12603, 17221, 17254 / 12795, GTL, TPTY"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                style={{ borderRadius: '8px', fontSize: '0.9rem', width: '100%' }}
                autoFocus
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'block' }}>
                Enter train number, station code, or leave code.
              </span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                Remarks (Optional):
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Relieved for special duty, CR ref 21/8"
                value={inputRemarks}
                onChange={(e) => setInputRemarks(e.target.value)}
                style={{ borderRadius: '8px', fontSize: '0.85rem', width: '100%' }}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving}
                onClick={() => handleSaveCell('', '')}
                style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)', fontSize: '0.84rem' }}
              >
                🗑️ Clear Cell
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={saving}
                  onClick={() => setEditModal(null)}
                  style={{ fontSize: '0.84rem' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving}
                  onClick={() => handleSaveCell(inputCode, inputRemarks)}
                  style={{
                    background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.84rem'
                  }}
                >
                  {saving ? 'Saving...' : '💾 Save Duty'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
