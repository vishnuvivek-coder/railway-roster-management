import React, { useState, useEffect, useMemo } from 'react';

const TIER_MAP = {
  'CTI': 1,
  'TTI': 2,
  'SRTE': 3,
  'Sr.CCTC': 4,
  'SRCCTC': 4,
  'CCTC': 5
};

export default function SeniorityList({ API_BASE = '/api', authToken, isAdmin }) {
  const [seniorityList, setSeniorityList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [desgFilter, setDesgFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('hierarchy'); // 'hierarchy' | 'sl_no'

  const fetchSeniority = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/seniority-list`, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      if (!res.ok) throw new Error(`Failed to fetch seniority list: ${res.statusText}`);
      const data = await res.json();
      setSeniorityList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching seniority list:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeniority();
  }, []);

  // Compute within-designation rank map
  const desgCounters = useMemo(() => {
    const counts = {};
    const rankMap = new Map();
    const sorted = [...seniorityList].sort((a, b) => a.sl_no - b.sl_no);
    sorted.forEach(item => {
      const d = item.designation || 'OTHER';
      counts[d] = (counts[d] || 0) + 1;
      rankMap.set(item.sl_no, counts[d]);
    });
    return { counts, rankMap };
  }, [seniorityList]);

  // Filtered and Sorted list
  const filteredList = useMemo(() => {
    let list = seniorityList.filter(item => {
      const isChandrika = item.name && item.name.includes('CHANDRIKA');
      if (desgFilter !== 'ALL') {
        if (desgFilter === 'TTI') {
          // Keep VS Chandrika in TTI list for working purpose
          if (item.designation !== 'TTI' && !isChandrika) return false;
        } else if (desgFilter === 'COR') {
          // VS Chandrika is not in COR list for working purpose
          if (item.designation !== 'COR' || isChandrika) return false;
        } else if (item.designation !== desgFilter) {
          return false;
        }
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const desgRank = item.desg_rank || desgCounters.rankMap.get(item.sl_no) || '';
      return (
        String(item.sl_no).includes(q) ||
        String(desgRank).includes(q) ||
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.designation && item.designation.toLowerCase().includes(q)) ||
        (item.working_designation && item.working_designation.toLowerCase().includes(q)) ||
        (isChandrika && (q === 'tti' || q === 'cor')) ||
        (item.cug_number && item.cug_number.toLowerCase().includes(q)) ||
        (item.contact_number && item.contact_number.toLowerCase().includes(q)) ||
        (item.pf_number && item.pf_number.toLowerCase().includes(q)) ||
        (item.email && item.email.toLowerCase().includes(q))
      );
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'hierarchy') {
        const tierA = a.hierarchy_tier || TIER_MAP[a.designation] || 999;
        const tierB = b.hierarchy_tier || TIER_MAP[b.designation] || 999;
        if (tierA !== tierB) return tierA - tierB;
        const rankA = a.desg_rank != null ? a.desg_rank : (desgCounters.rankMap.get(a.sl_no) || a.sl_no);
        const rankB = b.desg_rank != null ? b.desg_rank : (desgCounters.rankMap.get(b.sl_no) || b.sl_no);
        return rankA - rankB;
      }
      return a.sl_no - b.sl_no;
    });

    return list;
  }, [seniorityList, desgFilter, searchQuery, sortBy, desgCounters]);

  // Designation counts
  const counts = useMemo(() => {
    const c = { ALL: seniorityList.length };
    seniorityList.forEach(item => {
      const d = item.designation || 'OTHER';
      c[d] = (c[d] || 0) + 1;
    });
    return c;
  }, [seniorityList]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredList.length === 0) return;
    let csv = 'Official Seniority Rank,Name of Employee,Designation,Rank in Designation,Designation Hierarchy Priority,CUG Number,Contact Number,PF Number,Email ID\n';
    filteredList.forEach(item => {
      const rankInDesg = item.desg_rank != null ? item.desg_rank : (desgCounters.rankMap.get(item.sl_no) || '');
      const tier = item.hierarchy_tier || TIER_MAP[item.designation] || '';
      csv += `"${item.sl_no}","${item.name || ''}","${item.designation || ''}","${item.designation} #${rankInDesg}","${tier}","${item.cug_number || ''}","${item.contact_number || ''}","${item.pf_number || ''}","${item.email || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Seniority_List_Guntur_Division_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getDesgBadgeStyle = (desg) => {
    switch (desg) {
      case 'CTI':
        return { background: 'rgba(217, 119, 6, 0.18)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' };
      case 'TTI':
        return { background: 'rgba(59, 130, 246, 0.18)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.4)' };
      case 'SRTE':
        return { background: 'rgba(168, 85, 247, 0.18)', color: '#c084fc', border: '1px solid rgba(192, 132, 252, 0.4)' };
      case 'Sr.CCTC':
        return { background: 'rgba(16, 185, 129, 0.18)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.4)' };
      case 'CCTC':
        return { background: 'rgba(236, 72, 153, 0.18)', color: '#f472b6', border: '1px solid rgba(244, 114, 182, 0.4)' };
      default:
        return { background: 'rgba(156, 163, 175, 0.18)', color: '#9ca3af', border: '1px solid rgba(156, 163, 175, 0.4)' };
    }
  };

  return (
    <div className="seniority-container" style={{ padding: '0 4px' }}>
      {/* Top Header Card */}
      <div className="card" style={{
        padding: '20px',
        marginBottom: '20px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-glass)',
        borderRadius: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🏅</span> Seniority List
            </h2>
            <span className="badge" style={{ background: 'var(--primary-glow)', color: 'var(--primary)', fontWeight: 800, fontSize: '0.82rem', padding: '4px 10px', borderRadius: '8px' }}>
              {seniorityList.length} Total Staff
            </span>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', margin: '6px 0 0 0', fontSize: '0.88rem' }}>
            Basic Data of Ticket Checking Staff &mdash; Guntur Division (South Central Railway)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchSeniority}
            title="Refresh list"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', padding: '8px 14px' }}
          >
            <span>🔄</span> Refresh
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', padding: '8px 14px' }}
          >
            <span>📥</span> Export CSV
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.print()}
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', padding: '8px 14px' }}
          >
            <span>📄</span> Download / Print
          </button>
        </div>
      </div>

      {/* Designation Hierarchy Priority Banner */}
      <div style={{
        padding: '12px 18px',
        marginBottom: '16px',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(168, 85, 247, 0.08))',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, color: '#60a5fa', fontSize: '0.92rem' }}>⚖️ Seniority Hierarchy:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '0.85rem', fontWeight: 700 }}>
            <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(217, 119, 6, 0.2)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' }}>1. CTI</span>
            <span style={{ color: 'var(--color-text-secondary)' }}>➔</span>
            <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.4)' }}>2. TTI</span>
            <span style={{ color: 'var(--color-text-secondary)' }}>➔</span>
            <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: '1px solid rgba(192, 132, 252, 0.4)' }}>3. SRTE</span>
            <span style={{ color: 'var(--color-text-secondary)' }}>➔</span>
            <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.4)' }}>4. Sr.CCTC (SRCCTC)</span>
            <span style={{ color: 'var(--color-text-secondary)' }}>➔</span>
            <span style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(236, 72, 153, 0.2)', color: '#f472b6', border: '1px solid rgba(244, 114, 182, 0.4)' }}>5. CCTC</span>
          </div>
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
          💡 <em>Seniority evaluated within same designation &amp; compared across designations by hierarchy priority</em>
        </div>
      </div>

      {/* Designation Filter Pills, Search & Sort Toggle */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px'
      }}>
        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['ALL', 'CTI', 'TTI', 'SRTE', 'Sr.CCTC', 'CCTC'].map(desg => (
            <button
              key={desg}
              type="button"
              onClick={() => setDesgFilter(desg)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: desgFilter === desg ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                background: desgFilter === desg ? 'var(--primary)' : 'var(--bg-secondary)',
                color: desgFilter === desg ? '#fff' : 'var(--color-text-secondary)',
                boxShadow: desgFilter === desg ? '0 2px 8px var(--primary-glow)' : 'none'
              }}
            >
              {desg} ({counts[desg] || 0})
            </button>
          ))}
        </div>

        {/* Search Bar & Sort Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: '1', justifyContent: 'flex-end' }}>
          {/* Sort Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-secondary)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
            <button
              type="button"
              onClick={() => setSortBy('hierarchy')}
              title="Sort by Designation Hierarchy (1. CTI > 2. TTI > 3. SRTE > 4. Sr.CCTC > 5. CCTC)"
              style={{
                fontSize: '0.78rem',
                padding: '5px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                border: 'none',
                fontWeight: 700,
                background: sortBy === 'hierarchy' ? 'var(--primary)' : 'transparent',
                color: sortBy === 'hierarchy' ? '#fff' : 'var(--color-text-secondary)'
              }}
            >
              ⚖️ Hierarchy
            </button>
            <button
              type="button"
              onClick={() => setSortBy('sl_no')}
              title="Sort by Official List SL NO (1–139)"
              style={{
                fontSize: '0.78rem',
                padding: '5px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                border: 'none',
                fontWeight: 700,
                background: sortBy === 'sl_no' ? 'var(--primary)' : 'transparent',
                color: sortBy === 'sl_no' ? '#fff' : 'var(--color-text-secondary)'
              }}
            >
              🔢 Sl No (1–139)
            </button>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative', minWidth: '240px', maxWidth: '340px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="🔍 Search by name, rank, PF, CUG..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingRight: searchQuery ? '36px' : '14px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                fontSize: '0.86rem',
                width: '100%'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
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
      </div>

      {/* Loading & Error States */}
      {loading ? (
        <div className="spinner-container" style={{ padding: '60px', textAlign: 'center' }}>
          <div className="spinner"></div>
          <span style={{ marginLeft: '12px', color: 'var(--color-text-secondary)' }}>Loading Seniority List...</span>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-secondary)', border: '1px solid #ef4444' }}>
          <p style={{ color: '#ef4444', fontWeight: 700, fontSize: '1.1rem' }}>⚠️ {error}</p>
          <button type="button" className="btn btn-primary" onClick={fetchSeniority} style={{ marginTop: '12px' }}>🔄 Retry</button>
        </div>
      ) : (
        /* Seniority Table */
        <div className="table-responsive seniority-table-container" style={{
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--border-glass)',
          overflowX: 'auto',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
        }}>
          <table className="roster-table seniority-table" style={{ width: '100%', minWidth: '920px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#18181b' }}>
                <th className="seniority-col-rank" style={{ width: '70px', textAlign: 'center', padding: '12px 6px' }}>SL NO.</th>
                <th className="seniority-col-name" style={{ width: '220px', textAlign: 'left', padding: '12px 14px' }}>NAME OF THE EMPLOYEE</th>
                <th style={{ width: '90px', textAlign: 'center', padding: '12px 8px' }}>DESG.</th>
                <th style={{ width: '110px', textAlign: 'center', padding: '12px 8px' }}>DESG. RANK</th>
                <th style={{ width: '130px', textAlign: 'center', padding: '12px 8px' }}>CUG NUMBER</th>
                <th style={{ width: '130px', textAlign: 'center', padding: '12px 8px' }}>CONTACT NUMBER</th>
                <th style={{ width: '140px', textAlign: 'center', padding: '12px 8px' }}>PF NUMBER</th>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>E-MAIL ID</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
                    No employees match your search query: "<strong>{searchQuery}</strong>"
                  </td>
                </tr>
              ) : (
                filteredList.map((emp) => {
                  const desgStyle = getDesgBadgeStyle(emp.designation);
                  const rankInDesg = emp.desg_rank != null ? emp.desg_rank : (desgCounters.rankMap.get(emp.sl_no) || '-');
                  return (
                    <tr key={emp.sl_no} style={{ borderBottom: '1px solid var(--border-glass)', transition: 'background 0.15s ease' }}>
                      {/* Rank / SL NO */}
                      <td className="seniority-col-rank" style={{ textAlign: 'center', padding: '10px 6px', fontWeight: 800 }}>
                        <span style={{
                          display: 'inline-block',
                          width: '32px',
                          height: '32px',
                          lineHeight: '32px',
                          borderRadius: '8px',
                          background: emp.sl_no <= 10 
                            ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.35))'
                            : 'rgba(255, 255, 255, 0.05)',
                          color: emp.sl_no <= 10 ? '#f59e0b' : 'var(--color-text-primary)',
                          border: emp.sl_no <= 10 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-glass)',
                          fontSize: '0.84rem'
                        }}>
                          {emp.sl_no}
                        </span>
                      </td>

                      {/* Employee Name */}
                      <td className="seniority-col-name" style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--primary)' }}>
                        <span style={{ fontSize: '0.92rem' }}>{emp.name}</span>
                        {emp.name && emp.name.includes('CHANDRIKA') && (
                          <span 
                            className="badge no-print" 
                            title="Kept in TTI list (not in COR list) for working purpose only"
                            style={{
                              background: 'rgba(59, 130, 246, 0.18)',
                              color: '#60a5fa',
                              border: '1px solid rgba(96, 165, 250, 0.4)',
                              fontSize: '0.72rem',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              marginLeft: '8px',
                              fontWeight: 700
                            }}
                          >
                            🛠️ Working in TTI (not in COR)
                          </span>
                        )}
                      </td>

                      {/* Designation */}
                      <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          ...desgStyle
                        }}>
                          {emp.designation}
                        </span>
                        {emp.name && emp.name.includes('CHANDRIKA') && (
                          <span style={{ fontSize: '0.7rem', color: '#60a5fa', display: 'block', marginTop: '3px', fontWeight: 700 }}>
                            Working: TTI
                          </span>
                        )}
                      </td>

                      {/* Rank in Designation */}
                      <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: 'var(--color-text-primary)',
                          border: '1px solid var(--border-glass)'
                        }}>
                          #{rankInDesg}
                        </span>
                      </td>

                      {/* CUG Number */}
                      <td style={{ textAlign: 'center', padding: '10px 8px', fontSize: '0.86rem', color: emp.cug_number && emp.cug_number !== '--' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                        {emp.cug_number && emp.cug_number !== '--' ? (
                          <a href={`tel:${emp.cug_number}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            📞 {emp.cug_number}
                          </a>
                        ) : (
                          '--'
                        )}
                      </td>

                      {/* Contact Number */}
                      <td style={{ textAlign: 'center', padding: '10px 8px', fontSize: '0.86rem' }}>
                        {emp.contact_number && emp.contact_number !== '--' ? (
                          <a href={`tel:${emp.contact_number}`} style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
                            📱 {emp.contact_number}
                          </a>
                        ) : (
                          '--'
                        )}
                      </td>

                      {/* PF Number */}
                      <td style={{ textAlign: 'center', padding: '10px 8px', fontFamily: 'monospace', fontSize: '0.88rem', color: '#a78bfa' }}>
                        {emp.pf_number || '--'}
                      </td>

                      {/* Email */}
                      <td style={{ padding: '10px 14px', fontSize: '0.84rem' }}>
                        {emp.email && emp.email !== '--' && emp.email !== '=' ? (
                          <a href={`mailto:${emp.email}`} style={{ color: '#38bdf8', textDecoration: 'none' }}>
                            ✉️ {emp.email}
                          </a>
                        ) : (
                          <span style={{ color: 'var(--color-text-secondary)' }}>--</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
