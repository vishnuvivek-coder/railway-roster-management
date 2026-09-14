import React, { useState, useEffect, useMemo } from 'react';

export default function SeniorityList({ API_BASE = '/api', authToken, isAdmin }) {
  const [seniorityList, setSeniorityList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [desgFilter, setDesgFilter] = useState('ALL');

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

  // Filtered list
  const filteredList = useMemo(() => {
    return seniorityList.filter(item => {
      if (desgFilter !== 'ALL' && item.designation !== desgFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        String(item.sl_no).includes(q) ||
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.designation && item.designation.toLowerCase().includes(q)) ||
        (item.cug_number && item.cug_number.toLowerCase().includes(q)) ||
        (item.contact_number && item.contact_number.toLowerCase().includes(q)) ||
        (item.pf_number && item.pf_number.toLowerCase().includes(q)) ||
        (item.email && item.email.toLowerCase().includes(q))
      );
    });
  }, [seniorityList, desgFilter, searchQuery]);

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
    let csv = 'Seniority Rank,Name of Employee,Designation,CUG Number,Contact Number,PF Number,Email ID\n';
    filteredList.forEach(item => {
      csv += `"${item.sl_no}","${item.name || ''}","${item.designation || ''}","${item.cug_number || ''}","${item.contact_number || ''}","${item.pf_number || ''}","${item.email || ''}"\n`;
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

      {/* Designation Filter Pills & Search */}
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

        {/* Search Bar */}
        <div style={{ position: 'relative', minWidth: '280px', flex: '1', maxWidth: '420px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Search by name, rank, designation, PF, CUG..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              paddingRight: searchQuery ? '36px' : '14px',
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              fontSize: '0.88rem',
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
          <table className="roster-table seniority-table" style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#18181b' }}>
                <th className="seniority-col-rank" style={{ width: '70px', textAlign: 'center', padding: '12px 6px' }}>SL NO.</th>
                <th className="seniority-col-name" style={{ width: '220px', textAlign: 'left', padding: '12px 14px' }}>NAME OF THE EMPLOYEE</th>
                <th style={{ width: '100px', textAlign: 'center', padding: '12px 8px' }}>DESG.</th>
                <th style={{ width: '130px', textAlign: 'center', padding: '12px 8px' }}>CUG NUMBER</th>
                <th style={{ width: '130px', textAlign: 'center', padding: '12px 8px' }}>CONTACT NUMBER</th>
                <th style={{ width: '140px', textAlign: 'center', padding: '12px 8px' }}>PF NUMBER</th>
                <th style={{ textAlign: 'left', padding: '12px 14px' }}>E-MAIL ID</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
                    No employees match your search query: "<strong>{searchQuery}</strong>"
                  </td>
                </tr>
              ) : (
                filteredList.map((emp) => {
                  const desgStyle = getDesgBadgeStyle(emp.designation);
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
