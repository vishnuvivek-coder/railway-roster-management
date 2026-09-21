import React, { useState, useEffect, useMemo } from 'react';

const API_BASE = '/api';

export default function TaApprovals({ isAdmin, authToken, categories = [] }) {
  const [year, setYear] = useState('2026');
  const [month, setMonth] = useState('9');
  const [selectedCatId, setSelectedCatId] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('PENDING'); // PENDING, APPROVED, REJECTED, ALL
  const [searchQuery, setSearchQuery] = useState('');

  // Date Range state
  const [useDateRange, setUseDateRange] = useState(false);
  const [startDate, setStartDate] = useState('2026-09-01');
  const [endDate, setEndDate] = useState('2026-09-30');

  const [loading, setLoading] = useState(false);
  const [approvalsData, setApprovalsData] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Show temporary toast message
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  // Fetch approvals data
  const fetchApprovals = async () => {
    try {
      setLoading(true);
      let url = `${API_BASE}/ta-approvals?year=${year}&month=${month}`;
      if (useDateRange && startDate && endDate) {
        url += `&start_date=${startDate}&end_date=${endDate}`;
      }
      if (selectedCatId && selectedCatId !== 'ALL') url += `&category_id=${selectedCatId}`;
      if (statusFilter && statusFilter !== 'ALL') url += `&status=${statusFilter}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data && data.success) {
        setApprovalsData(data);
        setSelectedIds(new Set()); // Reset selection on fetch
      }
    } catch (err) {
      console.error('Error loading TA approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [year, month, selectedCatId, statusFilter, useDateRange, startDate, endDate, authToken]);

  // Real-time synchronization across all tabs and documents
  useEffect(() => {
    const handleRosterUpdate = (e) => {
      if (e.detail && e.detail.source === 'ta_approvals') return;
      fetchApprovals();
    };
    window.addEventListener('railway_roster_data_updated', handleRosterUpdate);
    return () => window.removeEventListener('railway_roster_data_updated', handleRosterUpdate);
  }, [year, month, selectedCatId, statusFilter, useDateRange, startDate, endDate, authToken]);

  // Handle single claim acceptance
  const handleAcceptSingle = async (id, staffName) => {
    if (!isAdmin) return;
    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/ta-approvals/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ TA accepted for ${staffName}! Added to TA Document.`);
        fetchApprovals();
        window.dispatchEvent(new CustomEvent('railway_roster_data_updated', {
          detail: { source: 'ta_approvals', timestamp: Date.now() }
        }));
      } else {
        alert(data.error || 'Failed to accept TA');
      }
    } catch (err) {
      console.error(err);
      alert('Error accepting TA claim');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle batch acceptance of selected claims
  const handleAcceptBatch = async () => {
    if (!isAdmin || selectedIds.size === 0) return;
    try {
      setActionLoading(true);
      const idsArray = Array.from(selectedIds);
      const res = await fetch(`${API_BASE}/ta-approvals/accept-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ ids: idsArray })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Accepted ${data.count} selected TA claims! Added to TA Documents.`);
        setSelectedIds(new Set());
        fetchApprovals();
      } else {
        alert(data.error || 'Failed to accept selected TAs');
      }
    } catch (err) {
      console.error(err);
      alert('Error accepting selected TAs');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle accept all pending claims matching filters
  const handleAcceptAll = async () => {
    if (!isAdmin) return;
    const pendingCount = approvalsData?.stats?.pending || 0;
    if (pendingCount === 0) {
      alert('No pending TA claims to accept.');
      return;
    }

    const confirmMsg = `Are you sure you want to ACCEPT ALL (${pendingCount}) pending TA claims for Month ${month}/${year}? Once accepted, these will be officially added into each employee's TA Document.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/ta-approvals/accept-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          year: parseInt(year, 10),
          month: parseInt(month, 10),
          category_id: selectedCatId
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Accepted all ${data.count} pending TA claims! Added to TA Documents.`);
        setSelectedIds(new Set());
        fetchApprovals();
      } else {
        alert(data.error || 'Failed to accept all TAs');
      }
    } catch (err) {
      console.error(err);
      alert('Error accepting all TAs');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle rejection
  const handleReject = async (id, ids = null) => {
    if (!isAdmin) return;
    const reason = window.prompt('Please enter a reason for rejecting this TA claim:', 'Duty not performed or cancelled');
    if (reason === null) return; // User cancelled prompt

    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/ta-approvals/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ id, ids, reason })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`❌ TA claim rejected.`);
        fetchApprovals();
      } else {
        alert(data.error || 'Failed to reject TA');
      }
    } catch (err) {
      console.error(err);
      alert('Error rejecting TA');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle revert back to pending
  const handleRevert = async (id) => {
    if (!isAdmin) return;
    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/ta-approvals/revert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`🔄 Reverted claim back to PENDING.`);
        fetchApprovals();
      } else {
        alert(data.error || 'Failed to revert TA');
      }
    } catch (err) {
      console.error(err);
      alert('Error reverting TA');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle selection for single item
  const toggleSelectOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Select/Deselect all visible rows
  const claims = approvalsData?.claims || [];
  const isAllSelected = claims.length > 0 && claims.every(c => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const next = new Set(claims.map(c => c.id));
      setSelectedIds(next);
    }
  };

  // Format absence duration (e.g. 7.5 -> 7h 30m)
  const formatDuration = (hours) => {
    if (hours === null || hours === undefined) return '---';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0 && m === 0) return '0m';
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const stats = approvalsData?.stats || { total: 0, pending: 0, approved: 0, rejected: 0, total_pending_amount: 0, total_approved_amount: 0 };

  return (
    <div className="ta-approvals-container" style={{ padding: '8px 0 40px 0' }}>
      {/* Toast Banner */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#10b981',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '10px',
          fontWeight: 700,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. Header Card with Official Railway Calculation Rule Banner */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.8rem' }}>🎫</span>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
                  Railway TA Approvals & Authorization
                </h2>
                <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '0.86rem' }}>
                  When an employee completes duty and returns to HQ, the Admin must accept the TA claim before it appears in the official TA Document.
                </p>
              </div>
            </div>
          </div>

          {/* Quick sync button */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={fetchApprovals}
              disabled={loading || actionLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
            >
              🔄 Refresh List
            </button>
          </div>
        </div>

        {/* Calculation Rule Reference Banner (from User's Document) */}
        <div style={{
          marginTop: '16px',
          padding: '12px 16px',
          background: 'rgba(212, 161, 92, 0.08)',
          border: '1px solid rgba(212, 161, 92, 0.25)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '0.84rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.1rem' }}>📐</span>
            <strong style={{ color: 'var(--primary)' }}>Official Railway TA Duration Calculation Rules:</strong>
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', fontWeight: 700, border: '1px solid rgba(6, 182, 212, 0.3)' }}>
              Absence &lt; 6 hours: 30% of DA (0.3)
            </span>
            <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontWeight: 700, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              Absence 6h to 12h: 70% of DA (0.7)
            </span>
            <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              Absence &gt; 12 hours: 100% of DA (1.0)
            </span>
          </div>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '14px',
        marginBottom: '20px'
      }}>
        {/* Pending Card */}
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.04))',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '12px',
          padding: '16px'
        }}>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>
            ⏳ Pending Acceptance
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b', margin: '4px 0' }}>
            {stats.pending}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            Claims awaiting approval
          </div>
        </div>

        {/* Approved Card */}
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.04))',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '12px',
          padding: '16px'
        }}>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>
            ✅ Approved & In TA Doc
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', margin: '4px 0' }}>
            {stats.approved}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            Claims approved for TA document
          </div>
        </div>

        {/* Rejected Card */}
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.04))',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '16px'
        }}>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>
            ❌ Rejected
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ef4444', margin: '4px 0' }}>
            {stats.rejected}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            Excluded from TA claim
          </div>
        </div>

        {/* Total Month Claims */}
        <div className="card" style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-glass)',
          borderRadius: '12px',
          padding: '16px'
        }}>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>
            📊 Total Month Claims
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: '4px 0' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            Duties across all categories
          </div>
        </div>
      </div>

      {/* 3. Controls & Filter Bar */}
      <div className="card" style={{
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '20px',
        border: '1px solid var(--border-glass)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          {/* Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Year:</label>
              <select className="select-input" value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Month:</label>
              <select className="select-input" value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="7">July</option>
                <option value="8">August</option>
                <option value="9">September</option>
                <option value="10">October</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Category:</label>
              <select className="select-input" value={selectedCatId} onChange={(e) => setSelectedCatId(e.target.value)}>
                <option value="ALL">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Status Pills */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '3px' }}>
              {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: statusFilter === st ? 'var(--primary)' : 'transparent',
                    color: statusFilter === st ? '#111' : 'var(--color-text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {st === 'PENDING' ? `⏳ Pending (${stats.pending})` :
                   st === 'APPROVED' ? `✅ Approved (${stats.approved})` :
                   st === 'REJECTED' ? `❌ Rejected (${stats.rejected})` :
                   `All (${stats.total})`}
                </button>
              ))}
            </div>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '10px', color: 'var(--color-text-secondary)', fontSize: '0.9rem', pointerEvents: 'none' }}>
              🔍
            </span>
            <input
              type="text"
              className="select-input"
              placeholder="Search staff, train, station..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchApprovals()}
              style={{
                paddingLeft: '32px',
                paddingRight: searchQuery ? '28px' : '12px',
                width: '230px',
                borderRadius: '8px',
                fontSize: '0.86rem'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setTimeout(fetchApprovals, 50); }}
                style={{
                  position: 'absolute',
                  right: '8px',
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
        </div>

        {/* Date Range Sub-row */}
        <div style={{
          marginTop: '12px',
          paddingTop: '10px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          flexWrap: 'wrap',
          fontSize: '0.84rem'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 700, color: 'var(--primary)' }}>
            <input
              type="checkbox"
              checked={useDateRange}
              onChange={(e) => setUseDateRange(e.target.checked)}
              style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
            Filter by Date Range
          </label>

          {useDateRange && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>From:</span>
                <input
                  type="date"
                  className="select-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ padding: '4px 8px', fontSize: '0.82rem' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>To:</span>
                <input
                  type="date"
                  className="select-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ padding: '4px 8px', fontSize: '0.82rem' }}
                />
              </div>
              <span style={{
                fontSize: '0.78rem',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'rgba(212, 161, 92, 0.15)',
                border: '1px solid var(--border-gold)',
                color: 'var(--primary)',
                fontWeight: 600
              }}>
                Period: {startDate.split('-').reverse().join('/')} ➔ {endDate.split('-').reverse().join('/')}
              </span>
            </>
          )}
        </div>

        {/* Bulk Action Buttons */}
        {isAdmin && (
          <div style={{
            marginTop: '16px',
            paddingTop: '14px',
            borderTop: '1px solid var(--border-glass)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                Selected: <strong>{selectedIds.size}</strong> of {claims.length}
              </span>

              {/* Accept Multiple Persons Option */}
              <button
                type="button"
                className="btn btn-primary"
                disabled={selectedIds.size === 0 || actionLoading}
                onClick={handleAcceptBatch}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  background: selectedIds.size > 0 ? '#10b981' : 'rgba(255,255,255,0.05)',
                  border: 'none',
                  color: selectedIds.size > 0 ? '#fff' : 'var(--color-text-muted)',
                  cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>✅</span> Accept Selected ({selectedIds.size})
              </button>

              {/* Reject Selected Option */}
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={actionLoading}
                  onClick={() => handleReject(null, Array.from(selectedIds))}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    color: '#ef4444',
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    cursor: 'pointer'
                  }}
                >
                  <span>❌</span> Reject Selected ({selectedIds.size})
                </button>
              )}
            </div>

            {/* Accept All Option */}
            <div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={stats.pending === 0 || actionLoading}
                onClick={handleAcceptAll}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                  border: 'none',
                  cursor: stats.pending > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: stats.pending > 0 ? '0 4px 14px rgba(212, 161, 92, 0.3)' : 'none'
                }}
              >
                <span>⚡</span> Accept All Pending ({stats.pending})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Claims Data Table */}
      <div className="card" style={{
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        padding: 0,
        overflow: 'hidden',
        border: '1px solid var(--border-glass)'
      }}>
        {loading ? (
          <div className="spinner-container" style={{ padding: '60px 0' }}>
            <div className="spinner"></div> Loading TA Claims...
          </div>
        ) : claims.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-secondary)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📋</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              No TA Claims Found
            </div>
            <p style={{ margin: '6px 0 16px 0', fontSize: '0.86rem' }}>
              {searchQuery ? `No results matching "${searchQuery}".` : `No claims currently under status "${statusFilter}".`}
            </p>
            {searchQuery && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setSearchQuery(''); setTimeout(fetchApprovals, 50); }}
                style={{ fontSize: '0.84rem' }}
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="data-table-container" style={{ maxHeight: '680px', overflowY: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#17171a', position: 'sticky', top: 0, zIndex: 10 }}>
                  {isAdmin && (
                    <th style={{ width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
                        title="Select/Deselect All Visible"
                      />
                    </th>
                  )}
                  <th style={{ width: '50px', textAlign: 'center' }}>SL</th>
                  <th>Employee Name</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Train No</th>
                  <th>From → To</th>
                  <th>Departure</th>
                  <th>Arrival</th>
                  <th style={{ textAlign: 'center' }}>Absence from HQ</th>
                  <th style={{ textAlign: 'center' }}>% of DA</th>
                  <th style={{ textAlign: 'right' }}>DA Rate</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  {isAdmin && <th style={{ textAlign: 'center', minWidth: '150px' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {claims.map((claim, idx) => {
                  const isSelected = selectedIds.has(claim.id);
                  const isPending = claim.status === 'PENDING';
                  const isApproved = claim.status === 'APPROVED';
                  const isRejected = claim.status === 'REJECTED';

                  // Badge style for percentage
                  const pct = claim.ta_percentage;
                  let pctBadge = { bg: 'rgba(255,255,255,0.05)', color: 'var(--color-text-secondary)', border: 'transparent', text: '0%' };
                  if (pct === 0.3) {
                    pctBadge = { bg: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', border: 'rgba(6, 182, 212, 0.4)', text: '30%' };
                  } else if (pct === 0.7) {
                    pctBadge = { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.4)', text: '70%' };
                  } else if (pct === 1.0) {
                    pctBadge = { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.4)', text: '100%' };
                  }

                  return (
                    <tr
                      key={claim.id}
                      style={{
                        background: isSelected ? 'rgba(212, 161, 92, 0.08)' : (idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent'),
                        transition: 'background 0.15s ease'
                      }}
                    >
                      {isAdmin && (
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(claim.id)}
                            style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
                          />
                        </td>
                      )}
                      <td style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontWeight: 700 }}>
                        {idx + 1}
                      </td>
                      <td>
                        <strong style={{ color: 'var(--primary)', fontSize: '0.88rem' }}>
                          {claim.staff_name}
                        </strong>
                        <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)' }}>
                          {claim.staff_designation} {claim.staff_pf_no ? `• PF: ${claim.staff_pf_no}` : ''}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                          {claim.category_name}
                        </span>
                      </td>
                      <td>
                        <strong>{claim.date_str}</strong>
                      </td>
                      <td>
                        <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', fontWeight: 800 }}>
                          🚆 {claim.train_no}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{claim.from_station}</span>
                        <span style={{ margin: '0 4px', color: 'var(--color-text-secondary)' }}>→</span>
                        <span style={{ fontWeight: 600 }}>{claim.to_station}</span>
                      </td>
                      <td style={{ color: claim.dep_time === '---' ? 'var(--color-text-muted)' : 'inherit', fontWeight: 600 }}>
                        {claim.dep_time}
                      </td>
                      <td style={{ color: claim.arr_time === '---' ? 'var(--color-text-muted)' : 'inherit', fontWeight: 600 }}>
                        {claim.arr_time}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {formatDuration(claim.absence_hours)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          background: pctBadge.bg,
                          color: pctBadge.color,
                          border: `1px solid ${pctBadge.border}`
                        }} title={claim.absence_hours ? `Absence: ${claim.absence_hours}h` : ''}>
                          {pctBadge.text}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                        ₹{claim.da_rate || 800}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isPending && (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            background: 'rgba(245, 158, 11, 0.18)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245, 158, 11, 0.4)'
                          }}>
                            ⏳ PENDING
                          </span>
                        )}
                        {isApproved && (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            background: 'rgba(16, 185, 129, 0.18)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.4)'
                          }} title={claim.approved_by ? `Approved by ${claim.approved_by} at ${claim.approved_at || ''}` : 'Approved'}>
                            ✅ APPROVED
                          </span>
                        )}
                        {isRejected && (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            background: 'rgba(239, 68, 68, 0.18)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.4)'
                          }} title={claim.rejection_reason ? `Reason: ${claim.rejection_reason}` : 'Rejected'}>
                            ❌ REJECTED
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  disabled={actionLoading}
                                  onClick={() => handleAcceptSingle(claim.id, claim.staff_name)}
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.76rem',
                                    fontWeight: 800,
                                    background: '#10b981',
                                    border: 'none',
                                    color: '#fff',
                                    cursor: 'pointer'
                                  }}
                                  title="Accept this TA claim and add to employee's TA Document"
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  disabled={actionLoading}
                                  onClick={() => handleReject(claim.id)}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.76rem',
                                    color: '#ef4444',
                                    borderColor: 'rgba(239, 68, 68, 0.35)',
                                    cursor: 'pointer'
                                  }}
                                  title="Reject this TA claim"
                                >
                                  Reject
                                </button>
                              </>
                            )}

                            {(isApproved || isRejected) && (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                disabled={actionLoading}
                                onClick={() => handleRevert(claim.id)}
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.74rem',
                                  color: 'var(--color-text-secondary)',
                                  cursor: 'pointer'
                                }}
                                title="Revert back to Pending status"
                              >
                                🔄 Revert
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
