import React, { useState, useEffect, useMemo } from 'react';
import LRList from './LRList';

const MUSTER_CODES = [
  { code: 'P', label: 'Present / Regular / Outstation Duty', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)' },
  { code: 'OD', label: 'On Duty (Official / Special Duty)', color: '#10b981', bg: 'rgba(16, 185, 129, 0.18)', border: 'rgba(16, 185, 129, 0.4)' },
  { code: 'R', label: 'Weekly Rest', color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.15)', border: 'rgba(156, 163, 175, 0.3)' },
  { code: 'O', label: 'Absent (Not Attended Duty)', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.35)' },
  { code: 'E', label: 'Emergency / Extra Duty', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.18)', border: 'rgba(245, 158, 11, 0.4)' },
  { code: 'CR', label: 'Compensatory Rest', color: '#a78bfa', bg: 'rgba(139, 92, 246, 0.18)', border: 'rgba(139, 92, 246, 0.4)' },
  { code: 'CL', label: 'Casual Leave', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.35)' },
  { code: 'CCL', label: 'Child Care / Comp Leave', color: '#818cf8', bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.35)' },
  { code: 'SCL', label: 'Special Casual Leave', color: '#38bdf8', bg: 'rgba(14, 165, 233, 0.15)', border: 'rgba(14, 165, 233, 0.35)' },
  { code: 'LAP', label: 'Leave on Average Pay', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.35)' },
  { code: 'LHAP', label: 'Leave on Half Avg Pay', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.35)' },
  { code: 'SICK', label: 'Sick / Medical Leave', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.18)', border: 'rgba(239, 68, 68, 0.4)' },
  { code: 'NH', label: 'National Holiday', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.18)', border: 'rgba(245, 158, 11, 0.4)' }
];

const CODE_MAP = {};
MUSTER_CODES.forEach(c => { CODE_MAP[c.code] = c; });

export default function MusterRoll({ isAdmin, categories = [], authToken, API_BASE = '/api', initialTab = 'wage-period' }) {
  const [musterTab, setMusterTab] = useState(initialTab);
  const [cycleData, setCycleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCycleStart, setSelectedCycleStart] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Active cell edit modal
  const [activeCellModal, setActiveCellModal] = useState(null);
  const [cellRemarks, setCellRemarks] = useState('');
  const [savingCell, setSavingCell] = useState(false);

  // Generate available cycles for quick jump (last 6 months to next 3 months)
  const availableCycles = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let offset = -6; offset <= 3; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 11);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const startStr = `${y}-${m}-11`;
      
      const nextM = new Date(y, d.getMonth() + 1, 10);
      const nextY = nextM.getFullYear();
      const nextMonthShort = nextM.toLocaleString('default', { month: 'short' });
      const curMonthShort = d.toLocaleString('default', { month: 'short' });
      
      list.push({
        value: startStr,
        label: `${curMonthShort} 11 - ${nextMonthShort} 10, ${nextY}`
      });
    }
    return list;
  }, []);

  const fetchMuster = async (cycleStart = selectedCycleStart) => {
    try {
      setLoading(true);
      setError(null);
      let url = '/api/muster?';
      if (cycleStart) url += 'cycle_start=' + encodeURIComponent(cycleStart) + '&';
      if (selectedCategory && selectedCategory !== 'ALL') url += 'category_id=' + encodeURIComponent(selectedCategory) + '&';

      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch muster roll data');
      }
      setCycleData(data);
      if (!selectedCycleStart && data.cycle && data.cycle.startDateStr) {
        setSelectedCycleStart(data.cycle.startDateStr);
      }
    } catch (err) {
      console.error('Error loading muster roll:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMuster(selectedCycleStart);
  }, [selectedCycleStart, selectedCategory]);

  const handleUpdateCode = async (staffId, dateStr, newCode, remarks = '') => {
    try {
      setSavingCell(true);
      const token = authToken || localStorage.getItem('token');
      const res = await fetch('/api/muster/update-cell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        },
        body: JSON.stringify({
          staff_id: staffId,
          date: dateStr,
          code: newCode,
          remarks
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update muster code');

      setCycleData(prev => {
        if (!prev) return prev;
        const newStaff = prev.staff.map(s => {
          if (s.id !== staffId) return s;
          const oldCode = (s.days[dateStr] && s.days[dateStr].code) || 'P';
          const newCounts = { ...s.counts };
          if (newCounts[oldCode] !== undefined && newCounts[oldCode] > 0) newCounts[oldCode]--;
          if (newCounts[newCode] !== undefined) newCounts[newCode]++;
          
          newCounts.totalLeaves = (newCounts.CL || 0) + (newCounts.CCL || 0) + (newCounts.SCL || 0) + (newCounts.LAP || 0) + (newCounts.LHAP || 0) + (newCounts.NH || 0);

          return {
            ...s,
            counts: newCounts,
            days: {
              ...s.days,
              [dateStr]: {
                code: newCode,
                isManual: true,
                remarks
              }
            }
          };
        });

        return { ...prev, staff: newStaff };
      });

      setActiveCellModal(null);
    } catch (err) {
      alert('Error updating muster code: ' + err.message);
    } finally {
      setSavingCell(false);
    }
  };

  const handleResetCell = async (staffId, dateStr) => {
    try {
      setSavingCell(true);
      const token = authToken || localStorage.getItem('token');
      const res = await fetch('/api/muster/reset-cell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        },
        body: JSON.stringify({ staff_id: staffId, date: dateStr })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset cell');

      setActiveCellModal(null);
      await fetchMuster(selectedCycleStart);
    } catch (err) {
      alert('Error resetting cell: ' + err.message);
    } finally {
      setSavingCell(false);
    }
  };

  const filteredStaff = useMemo(() => {
    if (!cycleData || !cycleData.staff) return [];
    if (!searchQuery.trim()) return cycleData.staff;
    const q = searchQuery.toLowerCase().trim();
    return cycleData.staff.filter(s => 
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.designation && s.designation.toLowerCase().includes(q)) ||
      (s.categoryName && s.categoryName.toLowerCase().includes(q)) ||
      (String(s.rowPosition).includes(q))
    );
  }, [cycleData, searchQuery]);

  const handleExportCSV = () => {
    if (!cycleData || !cycleData.cycle || !cycleData.cycle.dates || !filteredStaff.length) return;

    const headers = [
      'S.No',
      'Name of Employee',
      'Designation',
      'Category',
      ...cycleData.cycle.dates.map(d => `${d.dayNumber} (${d.dayOfWeek})`),
      'P (Present / Outstation Duty)',
      'R (Rest)',
      'O (Absent)',
      'E (Emergency)',
      'CR',
      'CL',
      'CCL',
      'SCL',
      'LAP',
      'LHAP',
      'NH',
      'Total Leaves',
      'Total Days'
    ];

    const rows = filteredStaff.map((s, idx) => [
      idx + 1,
      '"' + s.name + '"',
      '"' + (s.designation || '-') + '"',
      '"' + (s.categoryName || '-') + '"',
      ...cycleData.cycle.dates.map(d => (s.days[d.dateStr] && s.days[d.dateStr].code) || 'P'),
      s.counts.P,
      s.counts.R,
      s.counts.O,
      s.counts.E,
      s.counts.CR,
      s.counts.CL,
      s.counts.CCL,
      s.counts.SCL,
      s.counts.LAP,
      s.counts.LHAP,
      s.counts.NH || 0,
      s.counts.totalLeaves,
      s.counts.totalDays
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Railway_Muster_Roll_' + cycleData.cycle.periodLabel.replace(/[\s,]+/g, '_') + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="muster-roll-container" style={{ padding: '4px 0 40px 0' }}>
      {/* Muster Roll vs LR List Navigation Tabs */}
      <div className="no-print" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px',
        padding: '6px 8px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '12px',
        border: '1px solid var(--border-glass)',
        width: 'fit-content'
      }}>
        <button
          type="button"
          onClick={() => setMusterTab('wage-period')}
          style={{
            padding: '10px 22px',
            borderRadius: '9px',
            fontWeight: 800,
            fontSize: '0.92rem',
            cursor: 'pointer',
            border: musterTab === 'wage-period' ? '1.5px solid var(--border-gold)' : '1px solid transparent',
            background: musterTab === 'wage-period' ? 'linear-gradient(135deg, rgba(212, 161, 92, 0.22), rgba(212, 161, 92, 0.08))' : 'transparent',
            color: musterTab === 'wage-period' ? 'var(--primary)' : 'var(--color-text-secondary)',
            boxShadow: musterTab === 'wage-period' ? '0 4px 14px rgba(212, 161, 92, 0.25)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <span>📅</span> Muster Roll (11th – 10th Wage Period)
        </button>
        <button
          type="button"
          onClick={() => setMusterTab('lr-list')}
          style={{
            padding: '10px 22px',
            borderRadius: '9px',
            fontWeight: 800,
            fontSize: '0.92rem',
            cursor: 'pointer',
            border: musterTab === 'lr-list' ? '1.5px solid var(--border-gold)' : '1px solid transparent',
            background: musterTab === 'lr-list' ? 'linear-gradient(135deg, rgba(212, 161, 92, 0.22), rgba(212, 161, 92, 0.08))' : 'transparent',
            color: musterTab === 'lr-list' ? 'var(--primary)' : 'var(--color-text-secondary)',
            boxShadow: musterTab === 'lr-list' ? '0 4px 14px rgba(212, 161, 92, 0.25)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <span>📋</span> LR List (Monthly Leave Reserve Sheet)
        </button>
      </div>

      {musterTab === 'lr-list' && (
        <LRList isAdmin={isAdmin} authToken={authToken} API_BASE={API_BASE} />
      )}

      {musterTab === 'wage-period' && (
        <>
      {/* 1. Header Card */}
      <div className="card" style={{
        background: 'var(--bg-secondary)',
        borderRadius: '14px',
        padding: '20px 24px',
        marginBottom: '20px',
        border: '1.5px solid var(--border-gold)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
                📅 Railway Attendance & Muster Roll
              </h2>
              <span className="badge" style={{ background: 'rgba(212, 161, 92, 0.18)', color: 'var(--primary)', fontWeight: 800, fontSize: '0.82rem', border: '1px solid var(--border-gold)' }}>
                Wage Period Cycle: 11th - 10th
              </span>
            </div>
            <p style={{ margin: '6px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '0.86rem' }}>
              Monthly attendance register running continuously from the 11th of the current month to the 10th of the following month.
            </p>
          </div>

          {/* Action Buttons: Print & Export */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleExportCSV}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 700,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-glass)',
                cursor: 'pointer'
              }}
            >
              📥 Export CSV / Excel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handlePrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              🖨️ Print Muster Roll
            </button>
          </div>
        </div>

        <hr style={{ margin: '18px 0', borderColor: 'var(--border-glass)' }} />

        {/* Cycle Navigation & Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          {/* Cycle Navigator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => cycleData && cycleData.cycle && cycleData.cycle.prevCycleStart && setSelectedCycleStart(cycleData.cycle.prevCycleStart)}
              disabled={loading || !cycleData || !cycleData.cycle || !cycleData.cycle.prevCycleStart}
              style={{ padding: '6px 12px', fontSize: '0.84rem', fontWeight: 700, borderRadius: '8px' }}
              title="Previous Wage Cycle"
            >
              ◀ Previous Cycle
            </button>

            <div style={{
              background: 'rgba(212, 161, 92, 0.12)',
              border: '1px solid var(--border-gold)',
              padding: '6px 16px',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '0.95rem',
              color: 'var(--primary)',
              minWidth: '220px',
              textAlign: 'center'
            }}>
              📅 {(cycleData && cycleData.cycle && cycleData.cycle.periodLabel) || 'Loading Cycle...'}
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                ({(cycleData && cycleData.cycle && cycleData.cycle.totalDays) || 0} Days)
              </span>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => cycleData && cycleData.cycle && cycleData.cycle.nextCycleStart && setSelectedCycleStart(cycleData.cycle.nextCycleStart)}
              disabled={loading || !cycleData || !cycleData.cycle || !cycleData.cycle.nextCycleStart}
              style={{ padding: '6px 12px', fontSize: '0.84rem', fontWeight: 700, borderRadius: '8px' }}
              title="Next Wage Cycle"
            >
              Next Cycle ▶
            </button>

            {/* Quick Cycle Dropdown */}
            <select
              className="form-input"
              value={selectedCycleStart || (cycleData && cycleData.cycle && cycleData.cycle.startDateStr) || ''}
              onChange={(e) => setSelectedCycleStart(e.target.value)}
              style={{
                width: 'auto',
                fontSize: '0.84rem',
                padding: '6px 10px',
                borderRadius: '8px',
                background: 'var(--bg-card)'
              }}
            >
              {availableCycles.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
            <input
              type="text"
              className="form-input"
              placeholder="🔍 Search employee name, desg..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingRight: searchQuery ? '32px' : '12px',
                paddingTop: '6px',
                paddingBottom: '6px',
                fontSize: '0.84rem',
                borderRadius: '8px'
              }}
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
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.8rem'
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '16px' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', fontWeight: 600, marginRight: '4px' }}>
            Category:
          </span>
          {[
            { id: 'ALL', label: 'All Categories' },
            { id: '1', label: 'Conductors (COR)' },
            { id: '2', label: 'TTI / Sleeper Staff' },
            { id: '3', label: 'Ladies Staff / TTE' },
            { id: '4', label: '📋 Leave Reserve (LR)' }
          ].map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: selectedCategory === cat.id ? 800 : 500,
                background: selectedCategory === cat.id ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                color: selectedCategory === cat.id ? '#000' : 'var(--color-text-secondary)',
                border: selectedCategory === cat.id ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Muster Code Color Legend */}
        <div style={{
          marginTop: '16px',
          padding: '12px 14px',
          borderRadius: '10px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          fontSize: '0.78rem'
        }}>
          <span style={{ color: 'var(--color-text-secondary)', fontWeight: 700 }}>Muster Codes:</span>
          {MUSTER_CODES.map(c => (
            <div key={c.code} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{
                background: c.bg,
                color: c.color,
                border: '1px solid ' + c.border,
                fontWeight: 800,
                fontSize: '0.72rem',
                padding: '1px 6px',
                borderRadius: '4px',
                minWidth: '22px',
                textAlign: 'center'
              }}>
                {c.code}
              </span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Loading / Error States */}
      {loading && (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px auto', width: '36px', height: '36px' }}></div>
          <strong>Generating Railway Muster Roll ({(cycleData && cycleData.cycle && cycleData.cycle.periodLabel) || 'Wage Cycle'})...</strong>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* 3. Main Master Muster Grid */}
      {!loading && !error && cycleData && (
        <div className="card" style={{
          background: 'var(--bg-secondary)',
          borderRadius: '14px',
          padding: '16px',
          border: '1px solid var(--border-glass)',
          overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', maxHeight: '72vh' }}>
            <table className="roster-table muster-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#18181b' }}>
                {/* Top Row: Headers */}
                <tr>
                  <th style={{ width: '45px', textAlign: 'center', position: 'sticky', left: 0, background: '#18181b', zIndex: 12 }}>
                    S.No
                  </th>
                  <th style={{ width: '220px', minWidth: '200px', textAlign: 'left', position: 'sticky', left: '45px', background: '#18181b', zIndex: 12 }}>
                    Name of Employee
                  </th>
                  <th style={{ width: '90px', textAlign: 'center', position: 'sticky', left: '265px', background: '#18181b', zIndex: 12 }}>
                    Category
                  </th>

                  {/* Day Date Headers */}
                  {cycleData.cycle.dates.map(d => (
                    <th
                      key={d.dateStr}
                      style={{
                        width: '38px',
                        minWidth: '38px',
                        maxWidth: '42px',
                        textAlign: 'center',
                        padding: '6px 2px',
                        background: d.isSunday ? 'rgba(239, 68, 68, 0.12)' : '#18181b',
                        color: d.isSunday ? '#f87171' : 'inherit',
                        borderBottom: '2px solid var(--border-gold)'
                      }}
                    >
                      <div style={{ fontSize: '0.88rem', fontWeight: 800 }}>{d.dayNumber}</div>
                      <div style={{ fontSize: '0.64rem', color: d.isSunday ? '#fca5a5' : 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                        {d.dayOfWeek}
                      </div>
                    </th>
                  ))}

                  {/* Summary Columns */}
                  <th style={{ width: '40px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', fontWeight: 800 }} title="Present / Regular / Outstation Duty (P)">P</th>
                  <th style={{ width: '40px', textAlign: 'center', background: 'rgba(156, 163, 175, 0.12)', color: '#d1d5db', fontWeight: 800 }} title="Weekly Rest (R)">R</th>
                  <th style={{ width: '40px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', fontWeight: 800 }} title="Absent / Not Attended Duty (O)">O</th>
                  <th style={{ width: '40px', textAlign: 'center', background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', fontWeight: 800 }} title="Emergency Duty (E)">E</th>
                  <th style={{ width: '40px', textAlign: 'center', background: 'rgba(139, 92, 246, 0.12)', color: '#c4b5fd', fontWeight: 800 }} title="Compensatory Rest (CR)">CR</th>
                  <th style={{ width: '48px', textAlign: 'center', background: 'rgba(244, 63, 94, 0.12)', color: '#fb7185', fontWeight: 800 }} title="Approved Leaves (CL, CCL, SCL, LAP, LHAP, NH)">Leaves</th>
                  <th style={{ width: '50px', textAlign: 'center', background: 'rgba(212, 161, 92, 0.15)', color: 'var(--primary)', fontWeight: 800 }}>Total</th>
                </tr>
              </thead>

              <tbody>
                {filteredStaff.map((staff, sIdx) => (
                  <tr key={staff.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                    {/* Fixed Left S.No */}
                    <td style={{
                      textAlign: 'center',
                      fontWeight: 600,
                      position: 'sticky',
                      left: 0,
                      background: 'var(--bg-secondary)',
                      zIndex: 8,
                      fontSize: '0.82rem',
                      color: 'var(--color-text-secondary)'
                    }}>
                      {sIdx + 1}
                    </td>

                    {/* Fixed Left Name */}
                    <td style={{
                      position: 'sticky',
                      left: '45px',
                      background: 'var(--bg-secondary)',
                      zIndex: 8,
                      padding: '8px 12px'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ fontSize: '0.88rem', color: '#f3f4f6', whiteSpace: 'nowrap' }}>
                          {staff.name}
                        </strong>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                          {staff.designation || '-'} (Row #{staff.rowPosition})
                        </span>
                      </div>
                    </td>

                    {/* Fixed Left Category */}
                    <td style={{
                      position: 'sticky',
                      left: '265px',
                      background: 'var(--bg-secondary)',
                      zIndex: 8,
                      textAlign: 'center',
                      padding: '4px 6px'
                    }}>
                      <span className="badge" style={{
                        background: 'rgba(255,255,255,0.05)',
                        color: 'var(--color-text-secondary)',
                        fontSize: '0.68rem',
                        padding: '2px 6px'
                      }}>
                        {staff.categoryCode || staff.categoryName}
                      </span>
                    </td>

                    {/* Daily Muster Cells */}
                    {cycleData.cycle.dates.map(d => {
                      const dayData = staff.days[d.dateStr] || { code: 'P', isManual: false };
                      const meta = CODE_MAP[dayData.code] || CODE_MAP.P;

                      return (
                        <td
                          key={d.dateStr}
                          onClick={() => {
                            if (isAdmin) {
                              setActiveCellModal({
                                staffId: staff.id,
                                staffName: staff.name,
                                designation: staff.designation,
                                dateStr: d.dateStr,
                                dayNumber: d.dayNumber,
                                dayOfWeek: d.dayOfWeek,
                                currentCode: dayData.code,
                                isManual: dayData.isManual,
                                remarks: dayData.remarks || ''
                              });
                              setCellRemarks(dayData.remarks || '');
                            }
                          }}
                          style={{
                            textAlign: 'center',
                            padding: '3px 1px',
                            cursor: isAdmin ? 'pointer' : 'default',
                            background: d.isSunday ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                            userSelect: 'none'
                          }}
                          title={dayData.remarks ? `${staff.name} on ${d.dateStr}: ${dayData.code} (${dayData.remarks})` : (isAdmin ? 'Click to change code for ' + staff.name + ' on ' + d.dateStr + ' (Current: ' + dayData.code + ')' : undefined)}
                        >
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '28px',
                            borderRadius: '5px',
                            background: meta.bg,
                            color: meta.color,
                            border: dayData.isRestDayWorked ? '1.5px solid #a78bfa' : (dayData.isManual ? '1.5px solid ' + meta.color : '1px solid ' + meta.border),
                            fontWeight: 800,
                            fontSize: '0.74rem',
                            position: 'relative',
                            boxShadow: dayData.isRestDayWorked ? '0 0 7px rgba(167, 139, 250, 0.45)' : (dayData.isManual ? '0 0 6px rgba(212, 161, 92, 0.35)' : 'none')
                          }}>
                            {dayData.code}
                            {dayData.isManual && (
                              <span style={{
                                position: 'absolute',
                                top: '1px',
                                right: '2px',
                                width: '4px',
                                height: '4px',
                                borderRadius: '50%',
                                background: 'var(--primary)'
                              }} />
                            )}
                            {dayData.isRestDayWorked && (
                              <span style={{
                                position: 'absolute',
                                bottom: '1px',
                                right: '2px',
                                width: '4px',
                                height: '4px',
                                borderRadius: '50%',
                                background: '#a78bfa'
                              }} title={`Rest Day Worked (+1 CR earned for ${d.dateStr})`} />
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Summary Columns */}
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#10b981', fontSize: '0.84rem' }}>{staff.counts.P}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#9ca3af', fontSize: '0.84rem' }}>{staff.counts.R}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#ef4444', fontSize: '0.84rem' }}>{staff.counts.O}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#f59e0b', fontSize: '0.84rem' }}>{staff.counts.E}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#a78bfa', fontSize: '0.84rem' }} title={staff.cr_available ? `CR Balance: ${staff.cr_available} | Redeemed: ${staff.counts.CR}` : `Redeemed CR: ${staff.counts.CR}`}>
                      {staff.counts.CR > 0 ? staff.counts.CR : 0}
                      {staff.cr_count > 0 && (
                        <div style={{ fontSize: '0.66rem', color: '#38bdf8', fontWeight: 800, marginTop: '1px' }} title={staff.cr_available}>
                          +{staff.cr_count} Avail
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#f43f5e', fontSize: '0.84rem' }}>{staff.counts.totalLeaves}</td>
                    <td style={{ textAlign: 'center', fontWeight: 900, color: 'var(--primary)', fontSize: '0.88rem' }}>{staff.counts.totalDays}</td>
                  </tr>
                ))}
              </tbody>

              {/* Table Footer: Division Totals */}
              <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 10, background: '#18181b', borderTop: '2px solid var(--border-gold)' }}>
                <tr>
                  <td colSpan={3} style={{
                    position: 'sticky',
                    left: 0,
                    background: '#18181b',
                    zIndex: 12,
                    padding: '10px 14px',
                    fontWeight: 800,
                    color: 'var(--primary)',
                    fontSize: '0.88rem'
                  }}>
                    DIVISION TOTALS ({filteredStaff.length} Employees)
                  </td>

                  {cycleData.cycle.dates.map(d => (
                    <td key={d.dateStr} style={{ textAlign: 'center', fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-secondary)', padding: '6px 2px' }}>
                      {d.dayNumber}
                    </td>
                  ))}

                  <td style={{ textAlign: 'center', fontWeight: 900, color: '#10b981' }}>{cycleData.grandTotals.P}</td>
                  <td style={{ textAlign: 'center', fontWeight: 900, color: '#9ca3af' }}>{cycleData.grandTotals.R}</td>
                  <td style={{ textAlign: 'center', fontWeight: 900, color: '#ef4444' }}>{cycleData.grandTotals.O}</td>
                  <td style={{ textAlign: 'center', fontWeight: 900, color: '#f59e0b' }}>{cycleData.grandTotals.E}</td>
                  <td style={{ textAlign: 'center', fontWeight: 900, color: '#a78bfa' }}>{cycleData.grandTotals.CR}</td>
                  <td style={{ textAlign: 'center', fontWeight: 900, color: '#f43f5e' }}>{cycleData.grandTotals.totalLeaves}</td>
                  <td style={{ textAlign: 'center', fontWeight: 900, color: 'var(--primary)' }}>
                    {cycleData.grandTotals.staffCount * cycleData.cycle.totalDays}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 4. Cell Assignment Modal */}
      {activeCellModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="card" style={{
            width: '460px',
            maxWidth: '100%',
            background: 'var(--bg-secondary)',
            borderRadius: '14px',
            padding: '24px',
            border: '1.5px solid var(--border-gold)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)' }}>
                ✍️ Assign Muster Code
              </h3>
              <button
                type="button"
                onClick={() => setActiveCellModal(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '0.84rem'
            }}>
              <div>Employee: <strong style={{ color: '#f3f4f6' }}>{activeCellModal.staffName}</strong> ({activeCellModal.designation || 'Staff'})</div>
              <div style={{ marginTop: '3px' }}>
                Date: <strong>{activeCellModal.dateStr}</strong> ({activeCellModal.dayOfWeek}) | Current: <strong>{activeCellModal.currentCode}</strong>
              </div>
            </div>

            <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '10px' }}>
              Select Attendance / Muster Code:
            </label>

            {/* Grid of 10 Options */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '18px' }}>
              {MUSTER_CODES.map(c => {
                const isSelected = activeCellModal.currentCode === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    disabled={savingCell}
                    onClick={() => handleUpdateCode(activeCellModal.staffId, activeCellModal.dateStr, c.code, cellRemarks)}
                    style={{
                      padding: '10px 4px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid ' + c.color : '1px solid var(--border-glass)',
                      background: isSelected ? c.bg : 'rgba(255,255,255,0.03)',
                      color: c.color,
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '2px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{c.code}</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 500, color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.1 }}>
                      {c.code === 'P' ? 'Duty' : c.code === 'R' ? 'Rest' : c.code === 'O' ? 'Absent' : c.code === 'E' ? 'Emerg' : c.code === 'NH' ? 'Nat Hol' : c.code}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Optional Remarks */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Remarks / Reason (Optional):</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Sanctioned Emergency Duty, Leave Certificate"
                value={cellRemarks}
                onChange={(e) => setCellRemarks(e.target.value)}
                style={{ fontSize: '0.82rem', padding: '7px 10px' }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {activeCellModal.isManual && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={savingCell}
                  onClick={() => handleResetCell(activeCellModal.staffId, activeCellModal.dateStr)}
                  style={{ fontSize: '0.78rem', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)' }}
                >
                  🔄 Reset to Cyclic Baseline
                </button>
              )}
              <div style={{ marginLeft: 'auto' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActiveCellModal(null)}
                  style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
