import React, { useState, useEffect } from 'react';

const API_BASE = '/api';

export default function IndividualMusterDocument({
  authToken,
  categories,
  selectedCatId,
  setSelectedCatId,
  selectedStaffId: propSelectedStaffId,
  setSelectedStaffId: propSetSelectedStaffId,
  year: propYear,
  setYear: propSetYear,
  month: propMonth,
  setMonth: propSetMonth,
  onClose
}) {
  const [staffList, setStaffList] = useState([]);
  const [internalStaffId, setInternalStaffId] = useState('');
  const [internalYear, setInternalYear] = useState('2026');
  const [internalMonth, setInternalMonth] = useState('9');

  const selectedStaffId = propSelectedStaffId !== undefined ? propSelectedStaffId : internalStaffId;
  const setSelectedStaffId = propSetSelectedStaffId || setInternalStaffId;
  const year = propYear !== undefined ? propYear : internalYear;
  const setYear = propSetYear || setInternalYear;
  const month = propMonth !== undefined ? propMonth : internalMonth;
  const setMonth = propSetMonth || setInternalMonth;

  const [loading, setLoading] = useState(false);
  const [staffInfo, setStaffInfo] = useState(null);
  const [daysData, setDaysData] = useState([]);
  const [summary, setSummary] = useState({
    totalDays: 0,
    present: 0,
    rest: 0,
    cr: 0,
    leave: 0,
    sick: 0,
    od: 0,
    absent: 0,
    taPoints: 0,
    nightHours: 0
  });

  // Fetch Staff List for Category
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const catParam = selectedCatId && selectedCatId !== 'ALL' ? `?category_id=${selectedCatId}` : '';
        const res = await fetch(`${API_BASE}/staff${catParam}`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        });
        const data = await res.json();
        const valid = (data || []).filter(s => !s.name || !s.name.toUpperCase().includes('VACANT'));
        setStaffList(valid);
        if (valid.length > 0 && (!selectedStaffId || !valid.some(s => s.id === parseInt(selectedStaffId, 10)))) {
          setSelectedStaffId(valid[0].id);
        }
      } catch (err) {
        console.error('Failed to load staff for Individual Muster:', err);
      }
    };
    fetchStaff();
  }, [selectedCatId, authToken]);

  // Load Individual Muster & TA Details
  useEffect(() => {
    if (!selectedStaffId) return;

    const loadMusterData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Roster / Movement Data for selected staff and month
        const catId = selectedCatId === 'ALL' ? 1 : (selectedCatId || 1);
        const rosterRes = await fetch(`${API_BASE}/roster?category_id=${catId}&year=${year}&month=${month}`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        });
        const rosterJson = await rosterRes.json();
        
        let foundRow = null;
        if (rosterJson && rosterJson.rows) {
          foundRow = rosterJson.rows.find(r => r.staffId === parseInt(selectedStaffId, 10));
        }

        // If not found in current category, fetch staff profile
        let staffObj = (staffList || []).find(s => s.id === parseInt(selectedStaffId, 10));
        if (!foundRow && staffObj && staffObj.category_id !== catId) {
          const crossRes = await fetch(`${API_BASE}/roster?category_id=${staffObj.category_id}&year=${year}&month=${month}`, {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
          });
          const crossJson = await crossRes.json();
          if (crossJson && crossJson.rows) {
            foundRow = crossJson.rows.find(r => r.staffId === parseInt(selectedStaffId, 10));
          }
        }

        // 2. Fetch TA Journal Data to cross-verify TA points and duties
        let taPointsTotal = 0;
        let nightHoursTotal = 0;
        let empMeta = null;
        try {
          const taRes = await fetch(`${API_BASE}/documents/ta/${selectedStaffId}?year=${year}&month=${month}`, {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
          });
          const taJson = await taRes.json();
          if (taJson && taJson.employee) {
            empMeta = taJson.employee;
          }
          if (taJson && taJson.total_days !== undefined) {
            taPointsTotal = parseFloat(taJson.total_days) || 0;
          } else if (taJson && taJson.rows) {
            taPointsTotal = (taJson.rows || []).reduce((sum, d) => sum + (parseFloat(d.days_claiming_ta || d.ta_percentage || d.ta || 0) || 0), 0);
          }
        } catch (e) {
          console.warn('Could not fetch TA document details for muster:', e);
        }

        // 3. Fetch NDA Data if available
        try {
          const ndaRes = await fetch(`${API_BASE}/documents/nda/${selectedStaffId}?year=${year}&month=${month}`, {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
          });
          const ndaJson = await ndaRes.json();
          if (ndaJson && ndaJson.total_night_hours !== undefined) {
            nightHoursTotal = parseFloat(ndaJson.total_night_hours) || 0;
          } else if (ndaJson && ndaJson.rows) {
            nightHoursTotal = (ndaJson.rows || []).reduce((sum, d) => sum + (parseFloat(d.night_hours || 0) || 0), 0);
          }
        } catch (e) {
          console.warn('Could not fetch NDA document details:', e);
        }

        if (foundRow || empMeta) {
          setStaffInfo({
            name: empMeta?.name || foundRow?.staffName,
            designation: empMeta?.designation || foundRow?.designation || 'TTI / CTI',
            pf_no: empMeta?.pf_no || foundRow?.pf_no || '2410558' + String(selectedStaffId).padStart(4, '0'),
            bill_unit: empMeta?.bill_unit || '3704629',
            hq: empMeta?.hq || 'GNT',
            category_name: empMeta?.category_name || (categories.find(c => c.id === parseInt(selectedCatId, 10))?.name) || 'Conductors / TTI',
            cr_available: foundRow?.cr_available || '-'
          });

          // Process cells
          let pCount = 0;
          let rCount = 0;
          let crCount = 0;
          let leaveCount = 0;
          let sickCount = 0;
          let odCount = 0;
          let absentCount = 0;

          const days = (foundRow.cells || []).map(c => {
            const dateObj = new Date(c.date + 'T12:00:00');
            const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'short' });
            const dayNum = dateObj.getDate();

            let musterCode = c.muster_code;
            let statusDesc = '';
            let badgeBg = 'rgba(16, 185, 129, 0.15)';
            let badgeColor = '#10b981';

            if (c.status === 'SICK' || musterCode === 'SICK') {
              musterCode = 'SICK';
              statusDesc = 'Reported Sick (Medical)';
              badgeBg = 'rgba(239, 68, 68, 0.18)';
              badgeColor = '#ef4444';
              sickCount++;
            } else if (musterCode === 'CR' || c.status === 'CR') {
              musterCode = 'CR';
              statusDesc = 'Compensatory Rest (CR)';
              badgeBg = 'rgba(139, 92, 246, 0.18)';
              badgeColor = '#a78bfa';
              crCount++;
            } else if (['CL', 'CCL', 'SCL', 'LAP', 'LHAP'].includes(musterCode) || c.status === 'LEAVE' || c.isLeave) {
              musterCode = musterCode || c.leave_type || 'LAP';
              statusDesc = `Sanctioned Leave (${musterCode})`;
              badgeBg = 'rgba(245, 158, 11, 0.18)';
              badgeColor = '#f59e0b';
              leaveCount++;
            } else if (musterCode === 'OD' || c.status === 'OD' || c.leave_type === 'OD') {
              musterCode = 'OD';
              statusDesc = 'On Duty (Official / Special)';
              badgeBg = 'rgba(59, 130, 246, 0.18)';
              badgeColor = '#60a5fa';
              odCount++;
            } else if (c.status === 'ABSENT' || musterCode === 'O') {
              musterCode = 'O';
              statusDesc = 'Unauthorized Absence (O)';
              badgeBg = 'rgba(239, 68, 68, 0.25)';
              badgeColor = '#f87171';
              absentCount++;
            } else if (c.isRest || c.status === 'REST' || musterCode === 'R' || (!c.train_numbers && c.actualLinkNumber === null && c.status !== 'AVAILABLE_FOR_BOOKING')) {
              musterCode = 'R';
              statusDesc = 'Weekly Rest (R)';
              badgeBg = 'rgba(107, 114, 128, 0.18)';
              badgeColor = '#9ca3af';
              rCount++;
            } else {
              // Working / Present on Duty
              musterCode = musterCode || 'P';
              statusDesc = c.overrideReason || (c.train_numbers ? `Working ${c.train_numbers}` : `Link #${c.actualLinkNumber}`);
              pCount++;
            }

            return {
              date: c.date,
              dayNum,
              dayName,
              linkNo: c.actualLinkNumber,
              trains: c.train_numbers || '-',
              route: (c.from_station && c.to_station && c.from_station !== '-') ? `${c.from_station} ➔ ${c.to_station}` : 'GNT ➔ GNT',
              coaches: c.coaches || '-',
              musterCode,
              statusDesc,
              badgeBg,
              badgeColor,
              overrideReason: c.overrideReason
            };
          });

          setDaysData(days);
          setSummary({
            totalDays: days.length,
            present: pCount,
            rest: rCount,
            cr: crCount,
            leave: leaveCount,
            sick: sickCount,
            od: odCount,
            absent: absentCount,
            taPoints: Math.round(taPointsTotal * 10) / 10,
            nightHours: Math.round(nightHoursTotal * 10) / 10
          });
        }
      } catch (err) {
        console.error('Error loading individual muster:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMusterData();
  }, [selectedStaffId, year, month, selectedCatId, staffList, authToken]);

  const monthName = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1).toLocaleString('en-US', { month: 'long' }).toUpperCase();

  return (
    <div style={{ padding: '8px 0' }}>
      {/* Controls Bar */}
      <div className="no-print card" style={{
        padding: '14px 20px',
        marginBottom: '20px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-glass)',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div className="filter-group">
            <label className="form-label" style={{ marginBottom: 0 }}>Category:</label>
            <select
              className="select-input"
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
              style={{ minWidth: '160px' }}
            >
              <option value="ALL">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="form-label" style={{ marginBottom: 0 }}>Select Employee:</label>
            <select
              className="select-input"
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(parseInt(e.target.value, 10))}
              style={{ minWidth: '220px', fontWeight: 600 }}
            >
              {(staffList || []).map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.designation || '-'})</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="form-label" style={{ marginBottom: 0 }}>Year:</label>
            <select className="select-input" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="form-label" style={{ marginBottom: 0 }}>Month:</label>
            <select className="select-input" value={month} onChange={(e) => setMonth(e.target.value)}>
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
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.print()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
              color: '#1a1829',
              fontWeight: 700,
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            🖨️ Print Individual Muster
          </button>
          {onClose && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ padding: '8px 14px' }}
            >
              ✕ Close
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="spinner-container" style={{ padding: '40px', textAlign: 'center' }}>
          <div className="spinner"></div> Loading Monthly Muster Details...
        </div>
      ) : staffInfo ? (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-glass)',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          {/* Official Document Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid var(--border-gold)', paddingBottom: '16px', marginBottom: '20px' }}>
            <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>
              SOUTH COAST RAILWAY • GUNTUR DIVISION
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '6px 0', color: 'var(--primary)' }}>
              INDIVIDUAL MONTHLY MUSTER ROLL & DUTY STATEMENT
            </h2>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              For the Month of <strong>{monthName} {year}</strong> | Headquarters: <strong>{staffInfo.hq}</strong>
            </div>
          </div>

          {/* Employee Metadata Bar */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '14px 18px',
            borderRadius: '8px',
            border: '1px solid var(--border-glass)',
            marginBottom: '20px'
          }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block' }}>Name of Employee</span>
              <strong style={{ fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>{staffInfo.name}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block' }}>Designation / Branch</span>
              <strong style={{ fontSize: '0.95rem' }}>{staffInfo.designation} (Commercial)</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block' }}>P.F. / Staff Number</span>
              <strong style={{ fontSize: '0.95rem', fontFamily: 'monospace' }}>{staffInfo.pf_no}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block' }}>Bill Unit / Station HQ</span>
              <strong style={{ fontSize: '0.95rem' }}>BU: {staffInfo.bill_unit} / {staffInfo.hq}</strong>
            </div>
          </div>

          {/* Summary Metric Counters */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '10px',
            marginBottom: '24px'
          }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#10b981' }}>{summary.present}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Duties (P)</div>
            </div>
            <div style={{ background: 'rgba(107, 114, 128, 0.1)', border: '1px solid rgba(107, 114, 128, 0.3)', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#9ca3af' }}>{summary.rest}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Weekly Rest (R)</div>
            </div>
            <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#a78bfa' }}>{summary.cr}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>CR Days</div>
            </div>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f59e0b' }}>{summary.leave + summary.sick}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Leave / Sick</div>
            </div>
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#60a5fa' }}>{summary.od}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>On Duty (OD)</div>
            </div>
            <div style={{ background: 'rgba(212, 161, 92, 0.12)', border: '1px solid var(--border-gold)', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)' }}>{summary.taPoints}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Total TA Pts</div>
            </div>
            <div style={{ background: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#c084fc' }}>{summary.nightHours}h</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Night Hours</div>
            </div>
          </div>

          {/* Daily Muster & Duties Table */}
          <div className="table-responsive" style={{ border: '1px solid var(--border-glass)', borderRadius: '8px', overflow: 'hidden' }}>
            <table className="roster-table" style={{ width: '100%', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.04)' }}>
                  <th style={{ width: '60px', textAlign: 'center' }}>Day</th>
                  <th style={{ width: '110px' }}>Date</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Muster</th>
                  <th style={{ width: '90px' }}>Link No</th>
                  <th style={{ width: '150px' }}>Train Numbers</th>
                  <th>Journey Route</th>
                  <th style={{ width: '80px' }}>Coaches</th>
                  <th>Duty Description / Remarks</th>
                </tr>
              </thead>
              <tbody>
                {daysData.map((d) => (
                  <tr key={d.date} style={{
                    background: ['R', 'CR'].includes(d.musterCode) ? 'rgba(255, 255, 255, 0.015)' : (d.musterCode === 'SICK' || d.musterCode === 'O' ? 'rgba(239, 68, 68, 0.03)' : 'transparent')
                  }}>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                      {d.dayNum}
                    </td>
                    <td>
                      <strong>{d.date.split('-').reverse().join('/')}</strong> <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>({d.dayName})</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        background: d.badgeBg,
                        color: d.badgeColor,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        border: `1px solid ${d.badgeColor}`
                      }}>
                        {d.musterCode}
                      </span>
                    </td>
                    <td>
                      {d.linkNo ? `#${d.linkNo}` : '-'}
                    </td>
                    <td style={{ fontWeight: 600, color: d.trains !== '-' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                      {d.trains}
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>
                      {d.route}
                    </td>
                    <td>
                      {d.coaches}
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>
                      {d.statusDesc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Certificate & Signatures */}
          <div style={{ marginTop: '28px', paddingTop: '16px', borderTop: '1px dashed var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '20px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', maxWidth: '450px' }}>
              I hereby certify that the duties and attendance recorded above accurately reflect the actual turns performed by the employee in accordance with Railway Board rules and Division records.
            </div>
            <div style={{ display: 'flex', gap: '40px', textAlign: 'center' }}>
              <div>
                <div style={{ height: '35px' }}></div>
                <div style={{ borderTop: '1px solid var(--color-text-secondary)', width: '130px', fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>
                  Signature of Employee
                </div>
              </div>
              <div>
                <div style={{ height: '35px' }}></div>
                <div style={{ borderTop: '1px solid var(--color-text-secondary)', width: '130px', fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>
                  CTI / In-Charge GNT
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="alert-banner" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}>
          <span>⚠️</span> No muster data found for selected employee.
        </div>
      )}
    </div>
  );
}
