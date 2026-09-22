import React, { useState, useEffect, useMemo } from 'react';

const API_BASE = '/api';

export default function DailyAmenityBookingDocument({
  authToken,
  categories = [],
  selectedDate: propSelectedDate,
  setSelectedDate: propSetSelectedDate
}) {
  const [internalDate, setInternalDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const selectedDate = propSelectedDate !== undefined ? propSelectedDate : internalDate;
  const setSelectedDate = propSetSelectedDate || setInternalDate;

  const [activeCategoryId, setActiveCategoryId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [copied, setCopied] = useState(false);

  // Show Toast notification
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  // Fetch Booking Chart Data
  const fetchBookingChart = () => {
    if (!selectedDate) return;
    setLoading(true);
    setCopied(false);

    const catParam = activeCategoryId !== 'all' ? `&category_id=${activeCategoryId}` : '';
    fetch(`${API_BASE}/documents/daily-booking-chart?date=${selectedDate}${catParam}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setChartData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading Daily Booking Chart:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchBookingChart();
  }, [selectedDate, activeCategoryId, authToken]);

  // Real-time synchronization
  useEffect(() => {
    const handleRosterUpdate = () => {
      fetchBookingChart();
    };
    window.addEventListener('railway_roster_data_updated', handleRosterUpdate);
    return () => window.removeEventListener('railway_roster_data_updated', handleRosterUpdate);
  }, [selectedDate, activeCategoryId]);

  // Date Navigation Helpers
  const shiftDate = (days) => {
    const [y, m, d] = selectedDate.split('-').map(v => parseInt(v, 10));
    const newD = new Date(y, m - 1, d);
    newD.setDate(newD.getDate() + days);
    const newIso = newD.toISOString().split('T')[0];
    setSelectedDate(newIso);
  };

  const setDateToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  };

  // Copy WhatsApp Text to Clipboard
  const handleCopyWhatsAppText = () => {
    if (!chartData || !chartData.whatsapp_text) return;
    navigator.clipboard.writeText(chartData.whatsapp_text).then(() => {
      setCopied(true);
      showToast('📋 Daily Summary skeleton copied to clipboard! Ready to paste into WhatsApp / Telegram.');
      setTimeout(() => setCopied(false), 3000);
    }).catch(err => {
      console.error('Clipboard copy failed:', err);
      // Fallback copy
      const textarea = document.createElement('textarea');
      textarea.value = chartData.whatsapp_text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      showToast('📋 Daily Summary skeleton copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    });
  };

  // Filtered Train Blocks based on search query
  const filteredTrainBlocks = useMemo(() => {
    if (!chartData || !chartData.train_blocks) return [];
    if (!searchQuery.trim()) return chartData.train_blocks;

    const q = searchQuery.toLowerCase().trim();
    return chartData.train_blocks.filter(tb => {
      const tMatch = tb.trainNumber.toLowerCase().includes(q) ||
                     (tb.retTrain && tb.retTrain.toLowerCase().includes(q)) ||
                     (tb.route && tb.route.toLowerCase().includes(q));
      const crewMatch = tb.crew.some(c => c.name.toLowerCase().includes(q) || c.roleBadge.toLowerCase().includes(q));
      return tMatch || crewMatch;
    });
  }, [chartData, searchQuery]);

  // Arrange filtered train blocks across 4 columns
  const displayColumns = useMemo(() => {
    const cols = [[], [], [], []];
    filteredTrainBlocks.forEach((tb, idx) => {
      cols[idx % 4].push(tb);
    });
    return cols;
  }, [filteredTrainBlocks]);

  return (
    <div className="daily-amenity-booking-container" style={{ maxWidth: '1400px', margin: '0 auto', padding: '12px' }}>
      {/* Toast Alert */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '28px',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#ffffff',
          padding: '12px 22px',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
          fontWeight: 700,
          fontSize: '0.92rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>✓</span> {toastMsg}
        </div>
      )}

      {/* Top Control Bar (Hidden in Print) */}
      <div className="no-print" style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-gold)',
        borderRadius: '16px',
        padding: '16px 20px',
        marginBottom: '20px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '14px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>📊</span> TENTATIVE AMENITY STAFF BOOKING / DAILY SUMMARY
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
              Official 4-Column Amenity Crew Booking Chart with 1-Click WhatsApp Posting Skeleton.
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleCopyWhatsAppText}
              className="btn btn-primary"
              style={{
                fontSize: '0.86rem',
                padding: '8px 18px',
                fontWeight: 700,
                background: copied ? '#10b981' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                color: '#ffffff',
                border: 'none',
                boxShadow: '0 4px 14px rgba(34, 197, 94, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              title="Copy formatted skeleton text for posting to WhatsApp or messaging groups"
            >
              <span>{copied ? '✅' : '📋'}</span>
              {copied ? 'Copied to Clipboard!' : 'Copy WhatsApp Text'}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="btn btn-secondary"
              style={{
                fontSize: '0.86rem',
                padding: '8px 16px',
                background: 'rgba(212, 161, 92, 0.15)',
                border: '1px solid var(--border-gold)',
                color: 'var(--primary)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Print official 4-column booking chart"
            >
              <span>🖨️</span> Print / PDF Export
            </button>
          </div>
        </div>

        {/* Date Selector & Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          {/* Date Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>📅 Duty Date:</span>
            <button
              type="button"
              onClick={() => shiftDate(-1)}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              title="Previous Day"
            >
              ◀ Prev
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="form-input"
              style={{ padding: '6px 12px', fontSize: '0.88rem', fontWeight: 700, width: '150px' }}
            />
            <button
              type="button"
              onClick={() => shiftDate(1)}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              title="Next Day"
            >
              Next ▶
            </button>
            <button
              type="button"
              onClick={setDateToday}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid #3b82f6', color: '#60a5fa' }}
            >
              Today
            </button>
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginRight: '4px' }}>Category:</span>
            {[
              { id: 'all', label: 'All Categories' },
              { id: '1', label: 'Conductors (COR)' },
              { id: '2', label: 'TTI / Sleeper' },
              { id: '3', label: 'Ladies / TTE' },
              { id: '4', label: 'LR Staff' }
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategoryId(cat.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: activeCategoryId === cat.id ? 700 : 500,
                  background: activeCategoryId === cat.id ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                  color: activeCategoryId === cat.id ? '#000' : 'var(--color-text-secondary)',
                  border: activeCategoryId === cat.id ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Quick Search Input */}
          <div style={{ position: 'relative', width: '260px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="🔍 Search train (e.g. 20629), staff..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 12px',
                paddingRight: searchQuery ? '30px' : '12px',
                fontSize: '0.82rem',
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
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Printable Document Sheet (Exact reproduction of reference image) */}
      <div className="amenity-sheet-page" style={{
        background: '#ffffff',
        color: '#000000',
        padding: '16px 20px',
        borderRadius: '6px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        boxSizing: 'border-box'
      }}>
        {/* Document Master Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          alignItems: 'center',
          border: '2px solid #000000',
          borderBottom: '2px solid #000000',
          background: '#ffffff',
          fontWeight: 'bold'
        }}>
          <div style={{
            textAlign: 'center',
            fontSize: '13px',
            padding: '8px 12px',
            letterSpacing: '0.5px',
            textTransform: 'uppercase'
          }}>
            {chartData?.title || `TENTATIVE AMENITY STAFF BOOKING ON ${chartData?.day_of_week_short || 'DUTY'}`}
          </div>
          <div style={{
            borderLeft: '2px solid #000000',
            padding: '8px 16px',
            fontSize: '12px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap'
          }}>
            {chartData?.date_formatted || selectedDate}
          </div>
        </div>

        {/* 4-Column Train Grid Layout */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#666666' }}>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⏳</div>
            Loading Daily Amenity Staff Booking Chart...
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            borderLeft: '2px solid #000000',
            borderRight: '2px solid #000000',
            borderBottom: '2px solid #000000',
            gap: 0,
            background: '#ffffff'
          }}>
            {displayColumns.map((colBlocks, colIdx) => (
              <div
                key={colIdx}
                style={{
                  borderRight: colIdx < 3 ? '1.5px solid #000000' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0
                }}
              >
                {colBlocks.map((tb, bIdx) => {
                  const isSpecial = tb.isSpecial;
                  const headerBg = isSpecial ? '#93c5fd' : '#fff566'; // Bright yellow or blue for special

                  return (
                    <div
                      key={`${tb.trainNumber}_${bIdx}`}
                      style={{
                        borderBottom: '1.5px solid #000000',
                        breakInside: 'avoid'
                      }}
                    >
                      {/* Train Block Header */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '10px' }}>
                        <tbody>
                          <tr style={{ background: headerBg, fontWeight: 'bold', borderBottom: '1px solid #000000' }}>
                            <td style={{ width: '22%', padding: '4px 2px', borderRight: '1px solid #000000', fontSize: '10.5px' }}>
                              {tb.trainNumber}
                            </td>
                            <td style={{ width: '56%', padding: '4px 2px', borderRight: '1px solid #000000', fontSize: '9.5px', whiteSpace: 'nowrap' }}>
                              {tb.depTime} @ {tb.route}
                            </td>
                            <td style={{ width: '22%', padding: '4px 2px', fontSize: '10px' }}>
                              {tb.retTrain || '-'}
                            </td>
                          </tr>

                          {/* Crew Rows */}
                          {tb.crew.map((c, cIdx) => (
                            <tr
                              key={c.id || cIdx}
                              style={{
                                borderBottom: cIdx < tb.crew.length - 1 ? '1px solid #cccccc' : 'none',
                                background: cIdx % 2 === 0 ? '#ffffff' : '#fafafa'
                              }}
                            >
                              <td style={{
                                width: '22%',
                                padding: '3px 2px',
                                borderRight: '1px solid #000000',
                                fontWeight: 'bold',
                                fontSize: '9px',
                                textTransform: 'uppercase',
                                color: c.roleBadge === 'COR' ? '#000000' : (c.roleBadge === 'LADIES' ? '#9d174d' : '#000000')
                              }}>
                                {c.roleBadge}
                              </td>
                              <td style={{
                                width: '56%',
                                padding: '3px 4px',
                                borderRight: '1px solid #000000',
                                textAlign: 'left',
                                fontWeight: 'bold',
                                fontSize: '9.5px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {c.isCancelled ? (
                                  <span style={{ background: '#ef4444', color: '#ffffff', padding: '1px 6px', borderRadius: '3px', fontSize: '8.5px', fontWeight: 'bold' }}>
                                    CANCELLED
                                  </span>
                                ) : (
                                  c.name
                                )}
                              </td>
                              <td style={{
                                width: '22%',
                                padding: '3px 2px',
                                fontSize: '9.5px',
                                fontWeight: 'bold',
                                color: '#000000'
                              }}>
                                {c.isCancelled ? '' : (c.coachTag || tb.retTrain || '')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}

                {colBlocks.length === 0 && (
                  <div style={{ padding: '24px 8px', textAlign: 'center', color: '#999999', fontSize: '10px' }}>
                    —
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Standby, Rest & Leave Summary Cards Below Grid */}
        <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {/* Standby Staff at HQ */}
          <div style={{ border: '1px solid #000000', borderRadius: '4px', padding: '10px 12px', background: '#f8fafc' }}>
            <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#0f766e', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
              <span>🛡️ STANDBY / SPARE STAFF AT HQ</span>
              <span>({chartData?.standby_staff?.length || 0})</span>
            </div>
            {chartData?.standby_staff?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {chartData.standby_staff.map((s, i) => (
                  <div key={s.id || i} style={{ fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span><strong>{s.name}</strong> ({s.roleBadge})</span>
                    <span style={{ color: '#64748b', fontSize: '9px' }}>{s.remarks}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '10px' }}>No staff currently on standby at HQ.</div>
            )}
          </div>

          {/* Rest Staff */}
          <div style={{ border: '1px solid #000000', borderRadius: '4px', padding: '10px 12px', background: '#f8fafc' }}>
            <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#334155', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
              <span>🛌 STAFF ON REST</span>
              <span>({chartData?.rest_staff?.length || 0})</span>
            </div>
            {chartData?.rest_staff?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {chartData.rest_staff.map((s, i) => (
                  <div key={s.id || i} style={{ fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span><strong>{s.name}</strong> ({s.roleBadge})</span>
                    <span style={{ color: '#64748b', fontSize: '9px' }}>{s.remarks}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '10px' }}>No staff on rest.</div>
            )}
          </div>

          {/* Leave / Sick / OD Staff */}
          <div style={{ border: '1px solid #000000', borderRadius: '4px', padding: '10px 12px', background: '#f8fafc' }}>
            <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#b91c1c', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
              <span>🏥 STAFF ON LEAVE / SICK / OD</span>
              <span>({chartData?.leave_staff?.length || 0})</span>
            </div>
            {chartData?.leave_staff?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {chartData.leave_staff.map((s, i) => (
                  <div key={s.id || i} style={{ fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span><strong>{s.name}</strong> ({s.roleBadge})</span>
                    <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '9px' }}>[{s.status}]</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '10px' }}>No staff on leave or sick.</div>
            )}
          </div>
        </div>

        {/* Footer Summary Statistics */}
        <div style={{
          marginTop: '16px',
          borderTop: '2px solid #000000',
          paddingTop: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          fontWeight: 'bold'
        }}>
          <div>
            SOUTH COAST RAILWAY • GUNTUR DIVISION
          </div>
          <div>
            Total Services: {chartData?.summary?.total_trains || 0} | Booked Crew: {chartData?.summary?.total_booked_crew || 0} | Standby: {chartData?.summary?.total_standby || 0} | Rest: {chartData?.summary?.total_rest || 0} | Leave: {chartData?.summary?.total_leave || 0} | Grand Total: {chartData?.summary?.grand_total || 0}
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .amenity-sheet-page {
            box-shadow: none !important;
            padding: 8px !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
        }
      `}</style>
    </div>
  );
}
