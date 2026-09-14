import React, { useState, useEffect, useMemo } from 'react';

export default function AvailabilitySheet({ isAdmin, openDutyEditModal }) {
  // Date state - defaults to today's local date
  const getLocalDateStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(getLocalDateStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active Category Tab: 'ALL' | '1' (COR) | '2' (TTE) | '3' (LADIES) | '4' (LR)
  const [activeCategoryTab, setActiveCategoryTab] = useState('ALL');

  // Filter & Search state
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'AVAILABLE' | 'NOT_AVAILABLE'
  const [searchQuery, setSearchQuery] = useState('');
  const [includeWeeklyRestAsAvailable, setIncludeWeeklyRestAsAvailable] = useState(true);

  // Fetch availability data from backend
  const fetchAvailability = async (dateStr) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/reports/availability-sheet?date=${encodeURIComponent(dateStr)}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch availability data: ${res.statusText}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Error fetching availability sheet:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailability(selectedDate);
  }, [selectedDate]);

  // Quick date navigation
  const shiftDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${day}`);
  };

  // Category Tabs Configuration
  const categoryTabs = [
    { id: 'ALL', code: 'ALL', name: 'All Staff', icon: '🌐' },
    { id: '1', code: 'COR', name: 'Conductors (COR)', icon: '🚆' },
    { id: '2', code: 'TTI_SLEEPER', name: 'TTI / Sleeper (TTE)', icon: '💺' },
    { id: '3', code: 'LADIES_TTE', name: 'Ladies Staff (LADIES)', icon: '👩' },
    { id: '4', code: 'LR_STAFF', name: 'Leave Reserve (LR)', icon: '⚡' }
  ];

  // Filtered staff list based on category, status, search, and weekly rest toggle
  const filteredStaff = useMemo(() => {
    if (!data || !data.categories) return [];

    let list = [];
    data.categories.forEach(cat => {
      if (activeCategoryTab === 'ALL' || String(cat.categoryId) === String(activeCategoryTab)) {
        list = list.concat(cat.staff || []);
      }
    });

    // Exclude vacant posts
    list = list.filter(s => !s.is_vacant);

    // Apply Weekly Rest as Available toggle
    const processedList = list.map(s => {
      let isAvail = s.is_available;
      let dot = s.dot_status;
      if (s.status_category === 'AVAILABLE_WEEKLY_REST' && !includeWeeklyRestAsAvailable) {
        isAvail = false;
        dot = 'RED';
      }
      return {
        ...s,
        computedAvailable: isAvail,
        computedDot: dot
      };
    });

    // Apply Status Filter
    let filtered = processedList;
    if (statusFilter === 'AVAILABLE') {
      filtered = filtered.filter(s => s.computedAvailable);
    } else if (statusFilter === 'NOT_AVAILABLE') {
      filtered = filtered.filter(s => !s.computedAvailable);
    }

    // Apply Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(s => 
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.designation && s.designation.toLowerCase().includes(q)) ||
        (s.categoryName && s.categoryName.toLowerCase().includes(q)) ||
        (s.categoryCode && s.categoryCode.toLowerCase().includes(q)) ||
        (s.train_numbers && s.train_numbers.toLowerCase().includes(q)) ||
        (String(s.link_number).includes(q)) ||
        (s.status_label && s.status_label.toLowerCase().includes(q)) ||
        (s.current_location && s.current_location.toLowerCase().includes(q)) ||
        (s.pf_no && s.pf_no.toLowerCase().includes(q))
      );
    }

    return filtered;
  }, [data, activeCategoryTab, statusFilter, searchQuery, includeWeeklyRestAsAvailable]);

  // Calculate Metrics for the current Category Tab
  const activeMetrics = useMemo(() => {
    if (!data || !data.categories) {
      return { total: 0, available: 0, notAvailable: 0, percentage: 0, breakdown: {} };
    }

    if (activeCategoryTab === 'ALL') {
      const total = data.summary?.total_staff || 0;
      let avail = data.summary?.available_count || 0;
      if (!includeWeeklyRestAsAvailable) {
        avail -= (data.summary?.breakdown?.available_weekly_rest || 0);
      }
      const notAvail = total - avail;
      const pct = total > 0 ? Math.round((avail / total) * 100) : 0;
      return {
        total,
        available: Math.max(0, avail),
        notAvailable: Math.max(0, notAvail),
        percentage: pct,
        breakdown: data.summary?.breakdown || {}
      };
    }

    const cat = data.categories.find(c => String(c.categoryId) === String(activeCategoryTab));
    if (!cat) return { total: 0, available: 0, notAvailable: 0, percentage: 0, breakdown: {} };

    const total = cat.total_staff || 0;
    let avail = cat.available_count || 0;
    if (!includeWeeklyRestAsAvailable) {
      avail -= (cat.breakdown?.available_weekly_rest || 0);
    }
    const notAvail = total - avail;
    const pct = total > 0 ? Math.round((avail / total) * 100) : 0;
    return {
      total,
      available: Math.max(0, avail),
      notAvailable: Math.max(0, notAvail),
      percentage: pct,
      breakdown: cat.breakdown || {}
    };
  }, [data, activeCategoryTab, includeWeeklyRestAsAvailable]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredStaff.length === 0) return;
    let csv = 'S.No,Availability,Employee Name,Designation,Category,Link No,Train Numbers,Route,Current Location,Status Label,Detailed Reason,CR Available\n';
    filteredStaff.forEach((s, idx) => {
      const availText = s.computedAvailable ? 'AVAILABLE' : 'NOT AVAILABLE';
      const linkText = s.link_number ? `Link ${s.link_number}` : 'REST';
      csv += `"${idx + 1}","${availText}","${s.name}","${s.designation || '-'}","${s.categoryName}","${linkText}","${s.train_numbers || '-'}","${s.from_station || '-'} -> ${s.to_station || '-'}","${s.current_location}","${s.status_label}","${(s.status_reason || '').replace(/"/g, '""')}","${s.cr_available || '-'}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Staff_Availability_${selectedDate}_${activeCategoryTab}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format header date
  const headerDateObj = new Date(selectedDate);
  const formattedHeaderDate = headerDateObj.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="availability-sheet-container" style={{ paddingBottom: '40px' }}>
      {/* CSS Injected for Pulsating Glowing Dots */}
      <style>{`
        @keyframes pulse-emerald-glow {
          0% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.8), 0 0 8px #10b981;
          }
          70% {
            box-shadow: 0 0 0 12px rgba(16, 185, 129, 0), 0 0 18px #10b981;
          }
          100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0), 0 0 8px #10b981;
          }
        }

        @keyframes pulse-ruby-glow {
          0% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.8), 0 0 8px #ef4444;
          }
          70% {
            box-shadow: 0 0 0 12px rgba(239, 68, 68, 0), 0 0 18px #ef4444;
          }
          100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0), 0 0 8px #ef4444;
          }
        }

        .dot-glow-green {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background-color: #10b981;
          display: inline-block;
          animation: pulse-emerald-glow 2s infinite;
          flex-shrink: 0;
        }

        .dot-glow-red {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background-color: #ef4444;
          display: inline-block;
          animation: pulse-ruby-glow 2s infinite;
          flex-shrink: 0;
        }

        .cat-tab-btn {
          padding: 10px 18px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 0.88rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--border-glass);
          background: rgba(255, 255, 255, 0.03);
          color: var(--color-text-secondary);
        }

        .cat-tab-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--color-text-primary);
        }

        .cat-tab-btn.active {
          background: linear-gradient(135deg, rgba(212, 161, 92, 0.2) 0%, rgba(212, 161, 92, 0.08) 100%);
          border-color: var(--primary);
          color: var(--primary);
          box-shadow: 0 4px 15px rgba(212, 161, 92, 0.15);
        }

        .avail-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-glass);
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }
      `}</style>

      {/* Main Title & Action Bar */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(13, 148, 136, 0.05) 50%, rgba(212, 161, 92, 0.08) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.25)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{ fontSize: '1.4rem' }}>🟢</span>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, fontFamily: 'Fraunces, serif', color: 'var(--color-text-primary)' }}>
              Staff Availability & Duty Status Sheet
            </h1>
            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid #10b981', fontWeight: 700 }}>
              Live Roster & Train Tracking
            </span>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', margin: '4px 0 0 0', fontSize: '0.88rem' }}>
            Instant real-time availability indicator: <strong style={{ color: '#10b981' }}>🟢 Glowing Green Dot</strong> for available employees present at HQ; <strong style={{ color: '#ef4444' }}>🔴 Glowing Red Dot</strong> for booked, outstation, resting, sick, or on leave staff.
          </p>
        </div>

        {/* Date Selector & Export Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-glass)',
            borderRadius: '10px',
            padding: '4px 8px',
            gap: '6px'
          }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => shiftDate(-1)}
              style={{ padding: '4px 10px', fontSize: '0.85rem' }}
              title="Previous Day"
            >
              ◀ Prev
            </button>
            <input
              type="date"
              className="form-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: '4px 8px', background: 'transparent', border: 'none', color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSelectedDate(getLocalDateStr())}
              style={{ padding: '4px 10px', fontSize: '0.85rem' }}
              title="Jump to Today"
            >
              Today
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => shiftDate(1)}
              style={{ padding: '4px 10px', fontSize: '0.85rem' }}
              title="Next Day"
            >
              Next ▶
            </button>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCSV}
            style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            📥 Export CSV
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.print()}
            style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            🖨️ Print Sheet
          </button>
        </div>
      </div>

      {/* Date Banner */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-glass)',
        borderRadius: '12px',
        padding: '12px 20px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.2rem' }}>📅</span>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
            {formattedHeaderDate}
          </span>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
            ({data?.dayOfWeek || 'DAILY'} SCHEDULE)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            <input
              type="checkbox"
              checked={includeWeeklyRestAsAvailable}
              onChange={(e) => setIncludeWeeklyRestAsAvailable(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
            <span>Count Weekly Rest Staff as 🟢 Available at HQ</span>
          </label>
        </div>
      </div>

      {/* Category Tabs Switcher (COR, TTE, LADIES, LR, ALL) */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
        overflowX: 'auto',
        paddingBottom: '4px',
        WebkitOverflowScrolling: 'touch'
      }}>
        {categoryTabs.map(tab => {
          const isActive = activeCategoryTab === tab.id;
          let catCount = 0;
          let catAvail = 0;

          if (data && data.categories) {
            if (tab.id === 'ALL') {
              catCount = data.summary?.total_staff || 0;
              catAvail = data.summary?.available_count || 0;
              if (!includeWeeklyRestAsAvailable) {
                catAvail -= (data.summary?.breakdown?.available_weekly_rest || 0);
              }
            } else {
              const c = data.categories.find(item => String(item.categoryId) === String(tab.id));
              if (c) {
                catCount = c.total_staff || 0;
                catAvail = c.available_count || 0;
                if (!includeWeeklyRestAsAvailable) {
                  catAvail -= (c.breakdown?.available_weekly_rest || 0);
                }
              }
            }
          }

          return (
            <button
              key={tab.id}
              type="button"
              className={`cat-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveCategoryTab(tab.id)}
            >
              <span style={{ fontSize: '1rem' }}>{tab.icon}</span>
              <span>{tab.name}</span>
              {data && (
                <span className="badge" style={{
                  background: isActive ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
                  color: isActive ? '#000' : 'var(--color-text-muted)',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: '10px',
                  marginLeft: '4px'
                }}>
                  {Math.max(0, catAvail)}/{catCount} Avail
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Summary KPI Cards for Active Category */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px',
        marginBottom: '20px'
      }}>
        {/* Total Staff */}
        <div className="avail-card">
          <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>
            👥 Total Employees
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--color-text-primary)' }}>
              {activeMetrics.total}
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              in active link roster
            </span>
          </div>
        </div>

        {/* 🟢 Available Count */}
        <div className="avail-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="dot-glow-green" style={{ width: '10px', height: '10px' }} />
              🟢 Available Staff
            </span>
            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 800 }}>
              {activeMetrics.percentage}% Ready
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10b981' }}>
              {activeMetrics.available}
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              at Headquarters GNT
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
            <span>Standby: <strong>{activeMetrics.breakdown?.available_standby || 0}</strong></span>
            <span>•</span>
            <span>12h Rest: <strong>{activeMetrics.breakdown?.available_12h_rest || 0}</strong></span>
            <span>•</span>
            <span>Min 8h: <strong>{activeMetrics.breakdown?.available_8h_rest || 0}</strong></span>
            <span>•</span>
            <span>Leave Return: <strong>{activeMetrics.breakdown?.available_leave_return || 0}</strong></span>
            <span>•</span>
            <span>Weekly Rest: <strong>{activeMetrics.breakdown?.available_weekly_rest || 0}</strong></span>
          </div>
        </div>

        {/* 🔴 Not Available Count */}
        <div className="avail-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="dot-glow-red" style={{ width: '10px', height: '10px' }} />
              🔴 Not Available Staff
            </span>
            <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 800 }}>
              {100 - activeMetrics.percentage}% Busy
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ef4444' }}>
              {activeMetrics.notAvailable}
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              on duty / outstation / rest
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
            <span>Booked: <strong>{activeMetrics.breakdown?.booked_to_duty || 0}</strong></span>
            <span>•</span>
            <span>Outstation: <strong>{activeMetrics.breakdown?.outstation || 0}</strong></span>
            <span>•</span>
            <span>Leave: <strong>{activeMetrics.breakdown?.on_leave || 0}</strong></span>
            <span>•</span>
            <span>Sick: <strong>{activeMetrics.breakdown?.sick || 0}</strong></span>
            <span>•</span>
            <span>In Rest (&lt;8h): <strong>{activeMetrics.breakdown?.in_hq_rest || 0}</strong></span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-glass)',
        borderRadius: '12px',
        padding: '14px 20px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        {/* Status Filter Buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginRight: '4px' }}>Filter:</span>
          <button
            type="button"
            className={`btn ${statusFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('ALL')}
            style={{ padding: '6px 14px', fontSize: '0.82rem' }}
          >
            All Staff ({activeMetrics.total})
          </button>
          <button
            type="button"
            className={`btn ${statusFilter === 'AVAILABLE' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('AVAILABLE')}
            style={{
              padding: '6px 14px',
              fontSize: '0.82rem',
              borderColor: statusFilter === 'AVAILABLE' ? '#10b981' : undefined,
              color: statusFilter === 'AVAILABLE' ? '#fff' : '#10b981'
            }}
          >
            🟢 Available ({activeMetrics.available})
          </button>
          <button
            type="button"
            className={`btn ${statusFilter === 'NOT_AVAILABLE' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('NOT_AVAILABLE')}
            style={{
              padding: '6px 14px',
              fontSize: '0.82rem',
              borderColor: statusFilter === 'NOT_AVAILABLE' ? '#ef4444' : undefined,
              color: statusFilter === 'NOT_AVAILABLE' ? '#fff' : '#ef4444'
            }}
          >
            🔴 Not Available ({activeMetrics.notAvailable})
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Search employee name, train, link, PF..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              paddingRight: searchQuery ? '32px' : '12px',
              paddingTop: '6px',
              paddingBottom: '6px',
              fontSize: '0.85rem',
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
                fontSize: '0.85rem'
              }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Availability Data Table */}
      <div className="table-responsive" style={{
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        padding: '16px',
        border: '1px solid var(--border-glass)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.2)'
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '8px' }}>⏳</span>
            Calculating live staff availability for {selectedDate}...
          </div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
            <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '8px' }}>⚠️</span>
            {error}
          </div>
        ) : filteredStaff.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '8px' }}>🔍</span>
            No staff records found matching your filters.
          </div>
        ) : (
          <table className="roster-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '45px', textAlign: 'center' }}>S.No</th>
                <th style={{ width: '180px' }}>Availability Status</th>
                <th style={{ width: '220px' }}>Name of Employee</th>
                <th style={{ width: '130px' }}>Category</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Link No</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Train(s)</th>
                <th style={{ width: '140px' }}>Route / Section</th>
                <th style={{ width: '150px' }}>Current Location</th>
                <th>Duty Status & Rest Details</th>
                <th style={{ width: '110px', textAlign: 'center' }}>CR Avail</th>
                {isAdmin && <th style={{ width: '100px', textAlign: 'center' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((staff, idx) => {
                const isAvail = staff.computedAvailable;
                const dotClass = staff.computedDot === 'GREEN' ? 'dot-glow-green' : 'dot-glow-red';

                return (
                  <tr
                    key={staff.staffId}
                    style={{
                      background: isAvail ? 'rgba(16, 185, 129, 0.02)' : 'transparent',
                      borderBottom: '1px solid var(--border-glass)'
                    }}
                  >
                    {/* S.No */}
                    <td style={{ textAlign: 'center', verticalAlign: 'middle', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                      #{idx + 1}
                    </td>

                    {/* Glowing Dot & Availability Status */}
                    <td style={{ verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className={dotClass} title={isAvail ? 'Available for Duty' : 'Not Available'} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong style={{
                            color: isAvail ? '#10b981' : '#ef4444',
                            fontSize: '0.85rem',
                            letterSpacing: '0.3px'
                          }}>
                            {isAvail ? 'AVAILABLE' : 'NOT AVAILABLE'}
                          </strong>
                          <span style={{
                            fontSize: '0.74rem',
                            color: isAvail ? '#34d399' : '#f87171',
                            fontWeight: 600
                          }}>
                            {staff.status_label.replace('Available', '').replace('Not Available', '').replace(/[()]/g, '').trim() || (isAvail ? 'At HQ' : 'On Duty')}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Employee Name & Designation */}
                    <td style={{ verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ fontSize: '0.92rem', color: isAvail ? '#f1f5f9' : 'inherit' }}>
                          {staff.name}
                        </strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                          <span>{staff.designation || '-'}</span>
                          {staff.pf_no && (
                            <>
                              <span>•</span>
                              <span>PF: {staff.pf_no}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td style={{ verticalAlign: 'middle' }}>
                      <span className="badge" style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--color-text-secondary)',
                        fontSize: '0.78rem',
                        fontWeight: 600
                      }}>
                        {staff.categoryCode || staff.categoryName}
                      </span>
                    </td>

                    {/* Link Number */}
                    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      {staff.link_number ? (
                        <span className="badge" style={{
                          background: staff.isOverridden ? 'rgba(59, 130, 246, 0.15)' : 'rgba(212, 161, 92, 0.12)',
                          color: staff.isOverridden ? '#60a5fa' : 'var(--primary)',
                          border: `1px solid ${staff.isOverridden ? 'rgba(59, 130, 246, 0.3)' : 'var(--border-gold)'}`,
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          padding: '3px 8px'
                        }}>
                          #{staff.link_number}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>-</span>
                      )}
                    </td>

                    {/* Train Numbers */}
                    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      <strong style={{
                        color: staff.train_numbers === 'SPARE (HQ)' ? '#10b981' :
                               ['REST', 'LEAVE', 'SICK', 'CR'].includes(staff.train_numbers) ? 'var(--color-text-secondary)' :
                               'var(--color-text-primary)',
                        fontSize: '0.86rem'
                      }}>
                        {staff.train_numbers || '-'}
                      </strong>
                    </td>

                    {/* Route / Section */}
                    <td style={{ verticalAlign: 'middle', fontSize: '0.82rem' }}>
                      {staff.from_station && staff.to_station ? (
                        <span style={{ color: staff.from_station === 'GNT' ? 'var(--primary)' : 'inherit', fontWeight: 600 }}>
                          {staff.from_station} ➔ {staff.to_station}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }}>-</span>
                      )}
                    </td>

                    {/* Current Location */}
                    <td style={{ verticalAlign: 'middle' }}>
                      <strong style={{
                        fontSize: '0.82rem',
                        color: staff.current_location.includes('GNT') ? '#34d399' :
                               staff.current_location.includes('Outstation') ? '#60a5fa' :
                               staff.current_location.includes('Leave') ? '#f59e0b' : 'inherit'
                      }}>
                        {staff.current_location}
                      </strong>
                    </td>

                    {/* Status & Detailed Reason */}
                    <td style={{ verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {staff.muster_code && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="badge" style={{
                              background: 'rgba(212, 161, 92, 0.2)',
                              color: 'var(--primary)',
                              border: '1px solid var(--border-gold)',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '1px 6px'
                            }}>
                              📋 Muster: {staff.muster_code}
                            </span>
                            {staff.muster_remarks && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                                ({staff.muster_remarks})
                              </span>
                            )}
                          </div>
                        )}
                        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                          {staff.status_reason}
                        </span>
                        {staff.lr_rest_info && staff.lr_rest_info.hasLastDuty && (
                          <div style={{ display: 'flex', gap: '8px', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                            <span>⏱️ 8h Rest: <strong style={{ color: staff.lr_rest_info.restElapsedHours >= 8 ? '#10b981' : '#f59e0b' }}>{staff.lr_rest_info.rest8hTime}</strong></span>
                            <span>•</span>
                            <span>12h: <strong style={{ color: staff.lr_rest_info.restElapsedHours >= 12 ? '#10b981' : '#f59e0b' }}>{staff.lr_rest_info.rest12hTime}</strong></span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* CR Available */}
                    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      {staff.cr_available ? (
                        <span className="badge" style={{
                          background: 'rgba(139, 92, 246, 0.15)',
                          color: '#a78bfa',
                          border: '1px solid rgba(139, 92, 246, 0.35)',
                          fontWeight: 700,
                          fontSize: '0.74rem',
                          padding: '3px 8px',
                          whiteSpace: 'nowrap'
                        }} title={staff.cr_available}>
                          💤 {staff.cr_available}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-secondary)', opacity: 0.4 }}>-</span>
                      )}
                    </td>

                    {/* Action Button */}
                    {isAdmin && (
                      <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                        {isAvail ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => openDutyEditModal({
                              staffId: staff.staffId,
                              name: staff.name,
                              designation: staff.designation,
                              categoryId: staff.categoryId,
                              actualLinkNumber: staff.link_number,
                              calculatedLinkNumber: staff.original_link_number,
                              train_numbers: staff.train_numbers,
                              status: staff.status,
                              substituteStaffId: staff.substituteStaffId,
                              substituteName: staff.substituteName,
                              overrideReason: staff.overrideReason,
                              isOverridden: staff.isOverridden,
                              lr_rest_info: staff.lr_rest_info,
                              cr_available: staff.cr_available
                            }, selectedDate)}
                            style={{
                              padding: '5px 10px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              borderRadius: '6px',
                              background: 'linear-gradient(135deg, #10b981, #059669)',
                              border: 'none',
                              color: '#fff',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                            }}
                            title="Book Employee to Duty Slot"
                          >
                            ✏️ Book Duty
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => openDutyEditModal({
                              staffId: staff.staffId,
                              name: staff.name,
                              designation: staff.designation,
                              categoryId: staff.categoryId,
                              actualLinkNumber: staff.link_number,
                              calculatedLinkNumber: staff.original_link_number,
                              train_numbers: staff.train_numbers,
                              status: staff.status,
                              substituteStaffId: staff.substituteStaffId,
                              substituteName: staff.substituteName,
                              overrideReason: staff.overrideReason,
                              isOverridden: staff.isOverridden,
                              lr_rest_info: staff.lr_rest_info,
                              cr_available: staff.cr_available
                            }, selectedDate)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              borderRadius: '6px',
                              background: 'rgba(212, 161, 92, 0.12)',
                              color: 'var(--primary)',
                              border: '1px solid var(--border-gold)',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                            title="Edit Duty Status"
                          >
                            ✏️ Edit
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
