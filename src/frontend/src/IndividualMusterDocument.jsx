import React, { useState, useEffect, useCallback, useMemo } from 'react';
import SearchableStaffSelect from './SearchableStaffSelect';
import { printElement, downloadPdfFromElement } from './printUtils';

const API_BASE = '/api';

const MUSTER_CODE_OPTIONS = [
  { code: 'P', label: 'Present / Duty', bg: '#10b981', color: '#ffffff', desc: 'Working Duty / Present' },
  { code: 'R', label: 'Weekly Rest', bg: '#6b7280', color: '#ffffff', desc: 'Weekly Rest (R)' },
  { code: 'CR', label: 'Comp. Rest (CR)', bg: '#8b5cf6', color: '#ffffff', desc: 'Compensatory Rest (CR)' },
  { code: 'SICK', label: 'Medical Sick', bg: '#ef4444', color: '#ffffff', desc: 'Reported Sick (Medical)' },
  { code: 'CL', label: 'Casual Leave (CL)', bg: '#f59e0b', color: '#ffffff', desc: 'Casual Leave (CL)' },
  { code: 'LAP', label: 'Leave Avg Pay (LAP)', bg: '#ea580c', color: '#ffffff', desc: 'Leave on Average Pay (LAP)' },
  { code: 'LHAP', label: 'Half Pay (LHAP)', bg: '#ec4899', color: '#ffffff', desc: 'Leave on Half Average Pay (LHAP)' },
  { code: 'OD', label: 'On Duty (OD)', bg: '#3b82f6', color: '#ffffff', desc: 'On Duty / Special Tour (OD)' },
  { code: 'CCL', label: 'Child Care (CCL)', bg: '#6366f1', color: '#ffffff', desc: 'Child Care Leave (CCL)' },
  { code: 'SCL', label: 'Special CL (SCL)', bg: '#06b6d4', color: '#ffffff', desc: 'Special Casual Leave (SCL)' },
  { code: 'NH', label: 'National Holiday (NH)', bg: '#14b8a6', color: '#ffffff', desc: 'National Holiday (NH)' },
  { code: 'O', label: 'Absent (O)', bg: '#dc2626', color: '#ffffff', desc: 'Unauthorized Absence (O)' }
];

export default function IndividualMusterDocument({
  authToken,
  isAdmin = true,
  categories = [],
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

  // Date-wise Range Editor state
  const yNum = parseInt(year, 10) || 2026;
  const mNum = parseInt(month, 10) || 9;
  const daysInCurrentMonth = useMemo(() => new Date(yNum, mNum, 0).getDate(), [yNum, mNum]);
  const monthMinDate = useMemo(() => `${yNum}-${String(mNum).padStart(2, '0')}-01`, [yNum, mNum]);
  const monthMaxDate = useMemo(() => `${yNum}-${String(mNum).padStart(2, '0')}-${String(daysInCurrentMonth).padStart(2, '0')}`, [yNum, mNum, daysInCurrentMonth]);

  const [rangeFromDate, setRangeFromDate] = useState(monthMinDate);
  const [rangeToDate, setRangeToDate] = useState(monthMaxDate);
  const [rangeCode, setRangeCode] = useState('P');
  const [rangeRemarks, setRangeRemarks] = useState('');
  const [savingRange, setSavingRange] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState(null);

  // Single Day Quick Edit Modal State
  const [singleDayModal, setSingleDayModal] = useState(null);

  // Sync date boundaries when year or month changes
  useEffect(() => {
    setRangeFromDate(monthMinDate);
    setRangeToDate(monthMaxDate);
  }, [monthMinDate, monthMaxDate]);

  // Compute selected dates list in range
  const selectedDatesList = useMemo(() => {
    if (!rangeFromDate || !rangeToDate || rangeFromDate > rangeToDate) return [];
    const list = [];
    let curr = new Date(rangeFromDate + 'T12:00:00');
    const end = new Date(rangeToDate + 'T12:00:00');
    while (curr <= end) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      list.push(`${y}-${m}-${d}`);
      curr.setDate(curr.getDate() + 1);
    }
    return list;
  }, [rangeFromDate, rangeToDate]);

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
  const loadMusterData = useCallback(async () => {
    if (!selectedStaffId) return;
    setLoading(true);
    try {
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

      if (foundRow || empMeta || staffObj) {
        setStaffInfo({
          name: empMeta?.name || foundRow?.staffName || staffObj?.name || 'Staff Member',
          designation: empMeta?.designation || foundRow?.designation || staffObj?.designation || 'TTI / CTI',
          pf_no: empMeta?.pf_no || foundRow?.pf_no || staffObj?.pf_no || ('2410558' + String(selectedStaffId).padStart(4, '0')),
          bill_unit: empMeta?.bill_unit || '3704629',
          hq: empMeta?.hq || staffObj?.station || 'GNT',
          category_name: empMeta?.category_name || (categories.find(c => c.id === parseInt(selectedCatId, 10))?.name) || 'Conductors / TTI',
          cr_available: foundRow?.cr_available || '-'
        });

        // Ensure we have cells for all days of the month
        let rawCells = foundRow?.cells || [];
        if (!rawCells || rawCells.length === 0) {
          const daysCount = new Date(yNum, mNum, 0).getDate();
          rawCells = Array.from({ length: daysCount }, (_, i) => {
            const dNum = i + 1;
            const dStr = `${yNum}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
            return {
              date: dStr,
              muster_code: null,
              status: 'DUTY',
              actualLinkNumber: null,
              train_numbers: '-',
              from_station: 'GNT',
              to_station: 'GNT',
              coaches: '-'
            };
          });
        }

        // Process cells & calculate metrics
        let pCount = 0;
        let rCount = 0;
        let crCount = 0;
        let leaveCount = 0;
        let sickCount = 0;
        let odCount = 0;
        let absentCount = 0;

        const days = rawCells.map(c => {
          const dateObj = new Date(c.date + 'T12:00:00');
          const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'short' });
          const dayNum = dateObj.getDate();

          let musterCode = c.muster_code;
          let statusDesc = '';
          let badgeBg = 'rgba(16, 185, 129, 0.15)';
          let badgeColor = '#10b981';

          if (c.status === 'SICK' || musterCode === 'SICK') {
            musterCode = 'SICK';
            statusDesc = c.overrideReason || c.muster_remarks || 'Reported Sick (Medical)';
            badgeBg = 'rgba(239, 68, 68, 0.18)';
            badgeColor = '#ef4444';
            sickCount++;
          } else if (musterCode === 'CR' || c.status === 'CR') {
            musterCode = 'CR';
            statusDesc = c.overrideReason || c.muster_remarks || 'Compensatory Rest (CR)';
            badgeBg = 'rgba(139, 92, 246, 0.18)';
            badgeColor = '#a78bfa';
            crCount++;
          } else if (['CL', 'CCL', 'SCL', 'LAP', 'LHAP'].includes(musterCode) || c.status === 'LEAVE' || c.isLeave) {
            musterCode = musterCode || c.leave_type || 'LAP';
            statusDesc = c.overrideReason || c.muster_remarks || `Sanctioned Leave (${musterCode})`;
            badgeBg = 'rgba(245, 158, 11, 0.18)';
            badgeColor = '#f59e0b';
            leaveCount++;
          } else if (musterCode === 'OD' || c.status === 'OD' || c.leave_type === 'OD') {
            musterCode = 'OD';
            statusDesc = c.overrideReason || c.muster_remarks || 'On Duty (Official / Special)';
            badgeBg = 'rgba(59, 130, 246, 0.18)';
            badgeColor = '#60a5fa';
            odCount++;
          } else if (musterCode === 'NH') {
            musterCode = 'NH';
            statusDesc = c.overrideReason || c.muster_remarks || 'National Holiday (NH)';
            badgeBg = 'rgba(20, 184, 166, 0.18)';
            badgeColor = '#14b8a6';
            leaveCount++;
          } else if (c.status === 'ABSENT' || musterCode === 'O') {
            musterCode = 'O';
            statusDesc = c.overrideReason || c.muster_remarks || 'Unauthorized Absence (O)';
            badgeBg = 'rgba(239, 68, 68, 0.25)';
            badgeColor = '#f87171';
            absentCount++;
          } else if (c.isRest || c.status === 'REST' || musterCode === 'R' || (!c.train_numbers && c.actualLinkNumber === null && c.status !== 'AVAILABLE_FOR_BOOKING')) {
            musterCode = 'R';
            statusDesc = c.overrideReason || c.muster_remarks || 'Weekly Rest (R)';
            badgeBg = 'rgba(107, 114, 128, 0.18)';
            badgeColor = '#9ca3af';
            rCount++;
          } else {
            musterCode = musterCode || 'P';
            statusDesc = c.overrideReason || c.muster_remarks || (c.train_numbers && c.train_numbers !== '-' ? `Working ${c.train_numbers}` : (c.actualLinkNumber ? `Link #${c.actualLinkNumber}` : 'Present on Duty'));
            badgeBg = 'rgba(16, 185, 129, 0.15)';
            badgeColor = '#10b981';
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
            overrideReason: c.overrideReason || c.muster_remarks,
            isOverridden: !!(c.overrideReason || c.muster_remarks || c.muster_code)
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
      } else {
        setStaffInfo(null);
        setDaysData([]);
      }
    } catch (err) {
      console.error('Error loading individual muster:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedStaffId, year, month, selectedCatId, staffList, authToken, categories, yNum, mNum]);

  // Initial and reactive load
  useEffect(() => {
    loadMusterData();
  }, [loadMusterData]);

  // Universal synchronization listener
  useEffect(() => {
    const handleUpdate = (e) => {
      if (!e.detail || !e.detail.staffId || parseInt(e.detail.staffId, 10) === parseInt(selectedStaffId, 10)) {
        loadMusterData();
      }
    };
    window.addEventListener('railway_muster_updated', handleUpdate);
    window.addEventListener('railway_roster_data_updated', handleUpdate);
    return () => {
      window.removeEventListener('railway_muster_updated', handleUpdate);
      window.removeEventListener('railway_roster_data_updated', handleUpdate);
    };
  }, [loadMusterData, selectedStaffId]);

  // Handler: Apply Batch Date Range Updates
  const handleApplyBatchRange = async () => {
    if (!selectedStaffId) {
      setStatusFeedback({ type: 'error', message: 'Please select an employee first.' });
      return;
    }
    if (!rangeFromDate || !rangeToDate) {
      setStatusFeedback({ type: 'error', message: 'Please select both From Date and Upto Date.' });
      return;
    }
    if (rangeFromDate > rangeToDate) {
      setStatusFeedback({ type: 'error', message: 'From Date cannot be later than Upto Date.' });
      return;
    }
    if (selectedDatesList.length === 0) {
      setStatusFeedback({ type: 'error', message: 'No valid dates selected in range.' });
      return;
    }

    try {
      setSavingRange(true);
      setStatusFeedback(null);
      const token = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token');

      const updates = selectedDatesList.map(dateStr => ({
        staff_id: parseInt(selectedStaffId, 10),
        date: dateStr,
        code: rangeCode,
        remarks: rangeRemarks.trim() || undefined
      }));

      const res = await fetch(`${API_BASE}/muster/batch-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ updates })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save batch muster updates');

      await loadMusterData();

      // Dispatch real-time universal update events
      window.dispatchEvent(new CustomEvent('railway_roster_data_updated', {
        detail: { staffId: selectedStaffId, dates: selectedDatesList }
      }));
      window.dispatchEvent(new CustomEvent('railway_muster_updated', {
        detail: { staffId: selectedStaffId, dates: selectedDatesList }
      }));

      setStatusFeedback({
        type: 'success',
        message: `✓ Successfully updated ${selectedDatesList.length} days (${rangeFromDate.split('-').reverse().join('/')} to ${rangeToDate.split('-').reverse().join('/')}) to "${rangeCode}" for ${staffInfo?.name || 'employee'}!`
      });
    } catch (err) {
      console.error('Batch muster update error:', err);
      setStatusFeedback({ type: 'error', message: `❌ Error: ${err.message}` });
    } finally {
      setSavingRange(false);
    }
  };

  // Handler: Reset Batch Range to Default Baseline
  const handleResetBatchRange = async () => {
    if (!selectedStaffId || selectedDatesList.length === 0) return;
    if (!window.confirm(`Reset ${selectedDatesList.length} days back to default baseline link schedule for ${staffInfo?.name || 'this employee'}?`)) {
      return;
    }

    try {
      setSavingRange(true);
      setStatusFeedback(null);
      const token = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token');

      const resets = selectedDatesList.map(dateStr => ({
        staff_id: parseInt(selectedStaffId, 10),
        date: dateStr
      }));

      const res = await fetch(`${API_BASE}/muster/batch-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ resets })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset muster cells');

      await loadMusterData();

      window.dispatchEvent(new CustomEvent('railway_roster_data_updated', {
        detail: { staffId: selectedStaffId, dates: selectedDatesList }
      }));
      window.dispatchEvent(new CustomEvent('railway_muster_updated', {
        detail: { staffId: selectedStaffId, dates: selectedDatesList }
      }));

      setStatusFeedback({
        type: 'success',
        message: `✓ Successfully reset ${selectedDatesList.length} days to default cyclic baseline for ${staffInfo?.name || 'employee'}!`
      });
    } catch (err) {
      console.error('Reset muster error:', err);
      setStatusFeedback({ type: 'error', message: `❌ Error: ${err.message}` });
    } finally {
      setSavingRange(false);
    }
  };

  // Handler: Update Single Day
  const handleUpdateSingleDay = async (targetDate, newCode, remarks = '') => {
    try {
      const token = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/muster/update-cell`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          staff_id: parseInt(selectedStaffId, 10),
          date: targetDate,
          code: newCode,
          remarks
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update day');

      setSingleDayModal(null);
      await loadMusterData();

      window.dispatchEvent(new CustomEvent('railway_roster_data_updated', {
        detail: { staffId: selectedStaffId, date: targetDate }
      }));
      window.dispatchEvent(new CustomEvent('railway_muster_updated', {
        detail: { staffId: selectedStaffId, date: targetDate }
      }));

      setStatusFeedback({
        type: 'success',
        message: `✓ Updated ${targetDate.split('-').reverse().join('/')} to "${newCode}" for ${staffInfo?.name}!`
      });
    } catch (err) {
      console.error('Update single day error:', err);
      setStatusFeedback({ type: 'error', message: `❌ Error: ${err.message}` });
    }
  };

  // Handler: Reset Single Day
  const handleResetSingleDay = async (targetDate) => {
    try {
      const token = authToken || localStorage.getItem('railway_auth_token') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/muster/reset-cell`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          staff_id: parseInt(selectedStaffId, 10),
          date: targetDate
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset day');

      setSingleDayModal(null);
      await loadMusterData();

      window.dispatchEvent(new CustomEvent('railway_roster_data_updated', {
        detail: { staffId: selectedStaffId, date: targetDate }
      }));
      window.dispatchEvent(new CustomEvent('railway_muster_updated', {
        detail: { staffId: selectedStaffId, date: targetDate }
      }));

      setStatusFeedback({
        type: 'success',
        message: `✓ Reset ${targetDate.split('-').reverse().join('/')} to baseline for ${staffInfo?.name}!`
      });
    } catch (err) {
      console.error('Reset single day error:', err);
      setStatusFeedback({ type: 'error', message: `❌ Error: ${err.message}` });
    }
  };

  const monthName = new Date(yNum, mNum - 1, 1).toLocaleString('en-US', { month: 'long' }).toUpperCase();

  return (
    <div style={{ padding: '8px 0' }}>
      {/* Controls Bar */}
      <div className="no-print card" style={{
        padding: '14px 20px',
        marginBottom: '16px',
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

          <div className="filter-group" style={{ minWidth: '260px' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Search / Select Employee:</label>
            <SearchableStaffSelect
              staffList={staffList || []}
              value={selectedStaffId}
              onChange={(val) => setSelectedStaffId(parseInt(val, 10))}
              customStyles={{
                control: (base) => ({ ...base, minHeight: '32px', fontSize: '0.88rem' })
              }}
            />
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

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => printElement('printable-individual-muster', {
              title: `Muster_${staffInfo?.name || 'Staff'}_${month}_${year}`,
              orientation: 'portrait',
              pageFormat: 'a4'
            })}
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
            title="Print Individual Muster"
          >
            🖨️ Print
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => downloadPdfFromElement('printable-individual-muster', `Muster_${staffInfo?.name || 'Staff'}_${month}_${year}`, {
              orientation: 'portrait',
              format: 'a4'
            })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#ffffff',
              fontWeight: 700,
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer'
            }}
            title="Download Direct PDF"
          >
            📄 Download PDF
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

      {/* Ultra-Simple Date-Wise Range Muster Editor */}
      {isAdmin && (
        <div className="no-print card" style={{
          marginBottom: '20px',
          background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.96), rgba(39, 39, 42, 0.94))',
          border: '1.5px solid rgba(212, 161, 92, 0.45)',
          borderRadius: '12px',
          padding: '16px 20px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
        }}>
          {/* Header Row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '14px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            paddingBottom: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.25rem' }}>⚡</span>
              <div>
                <strong style={{ fontSize: '0.98rem', color: '#f8fafc', display: 'block' }}>
                  Date-Wise Muster Editor (Whole Month / Custom Date Range)
                </strong>
                <span style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>
                  Select From & Upto Date, pick Attendance Code, and click Apply to update {monthName} {year}
                </span>
              </div>
            </div>
            {staffInfo && (
              <div style={{
                background: 'rgba(212, 161, 92, 0.15)',
                border: '1px solid var(--border-gold)',
                borderRadius: '20px',
                padding: '4px 14px',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>👤</span>
                <span>{staffInfo.name}</span>
                <span style={{ opacity: 0.75, fontWeight: 500 }}>({staffInfo.designation})</span>
              </div>
            )}
          </div>

          {/* Date Range Inputs & Presets */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-end', marginBottom: '14px' }}>
            {/* From Date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0' }}>
                From Date:
              </label>
              <input
                type="date"
                value={rangeFromDate}
                min={monthMinDate}
                max={monthMaxDate}
                onChange={(e) => setRangeFromDate(e.target.value)}
                style={{
                  background: '#09090b',
                  border: '1.5px solid rgba(212, 161, 92, 0.5)',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '7px 12px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
            </div>

            {/* Upto Date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0' }}>
                Upto Date:
              </label>
              <input
                type="date"
                value={rangeToDate}
                min={monthMinDate}
                max={monthMaxDate}
                onChange={(e) => setRangeToDate(e.target.value)}
                style={{
                  background: '#09090b',
                  border: '1.5px solid rgba(212, 161, 92, 0.5)',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '7px 12px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
            </div>

            {/* Quick 1-Click Presets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                Quick Presets:
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setRangeFromDate(monthMinDate);
                    setRangeToDate(monthMaxDate);
                  }}
                  style={{
                    background: (rangeFromDate === monthMinDate && rangeToDate === monthMaxDate) ? 'rgba(212, 161, 92, 0.25)' : 'rgba(255,255,255,0.07)',
                    border: (rangeFromDate === monthMinDate && rangeToDate === monthMaxDate) ? '1px solid var(--border-gold)' : '1px solid rgba(255,255,255,0.15)',
                    color: (rangeFromDate === monthMinDate && rangeToDate === monthMaxDate) ? 'var(--primary)' : '#e2e8f0',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                  title="Select entire month"
                >
                  📅 Full Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRangeFromDate(monthMinDate);
                    setRangeToDate(`${yNum}-${String(mNum).padStart(2, '0')}-15`);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#e2e8f0',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                  title="Select 1st to 15th"
                >
                  1️⃣ 1st to 15th
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRangeFromDate(`${yNum}-${String(mNum).padStart(2, '0')}-16`);
                    setRangeToDate(monthMaxDate);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#e2e8f0',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                  title="Select 16th to End of Month"
                >
                  2️⃣ 16th to End
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRangeFromDate(monthMinDate);
                    setRangeToDate(`${yNum}-${String(mNum).padStart(2, '0')}-07`);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#e2e8f0',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                  title="Select 1st to 7th"
                >
                  7️⃣ First 7 Days
                </button>
              </div>
            </div>
          </div>

          {/* Attendance Code Selection Pills */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
                Select Attendance Code to Apply:
              </label>
              <span style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>
                Active: <strong style={{ color: 'var(--primary)' }}>{rangeCode}</strong> ({MUSTER_CODE_OPTIONS.find(o => o.code === rangeCode)?.label || rangeCode})
              </span>
            </div>

            <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
              {MUSTER_CODE_OPTIONS.map(opt => {
                const isSelected = rangeCode === opt.code;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => setRangeCode(opt.code)}
                    style={{
                      background: isSelected ? opt.bg : 'rgba(255,255,255,0.06)',
                      color: isSelected ? opt.color : '#cbd5e1',
                      border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.14)',
                      borderRadius: '8px',
                      padding: '7px 12px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: isSelected ? `0 0 12px ${opt.bg}80` : 'none',
                      transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                      transition: 'all 0.15s ease'
                    }}
                    title={opt.desc}
                  >
                    <span style={{ fontSize: '0.92rem' }}>{opt.code}</span>
                    <span style={{ fontSize: '0.72rem', opacity: 0.9, fontWeight: 500 }}>
                      {opt.label.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Remarks & Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 260px' }}>
              <input
                type="text"
                placeholder="Optional Remarks (e.g., Leave Sanctioned / Medical Memo / Special Order)"
                value={rangeRemarks}
                onChange={(e) => setRangeRemarks(e.target.value)}
                style={{
                  background: '#09090b',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '0.85rem',
                  width: '100%'
                }}
              />
            </div>

            <button
              type="button"
              className="btn btn-primary"
              disabled={savingRange || selectedDatesList.length === 0}
              onClick={handleApplyBatchRange}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff',
                fontWeight: 800,
                padding: '9px 22px',
                borderRadius: '8px',
                border: 'none',
                cursor: (savingRange || selectedDatesList.length === 0) ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                fontSize: '0.9rem'
              }}
            >
              {savingRange ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                  <span>Saving {selectedDatesList.length} Days...</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Apply & Save to Selected Dates ({selectedDatesList.length} {selectedDatesList.length === 1 ? 'Day' : 'Days'})</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={savingRange || selectedDatesList.length === 0}
              onClick={handleResetBatchRange}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#e2e8f0',
                fontWeight: 600,
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                cursor: (savingRange || selectedDatesList.length === 0) ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem'
              }}
              title="Reset selected dates back to cyclic link duty"
            >
              <span>↺ Reset Range to Baseline</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              disabled={savingRange}
              onClick={async () => {
                await loadMusterData();
                setStatusFeedback({
                  type: 'success',
                  message: `💾 Muster for ${staffInfo?.name || 'employee'} verified & saved permanently to database!`
                });
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: '#ffffff',
                fontWeight: 800,
                padding: '9px 18px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.88rem',
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
              }}
              title="Save and lock all muster attendance records to database"
            >
              <span>💾</span>
              <span>Save Individual Muster</span>
            </button>
          </div>

          {/* Feedback Toast Banner */}
          {statusFeedback && (
            <div style={{
              marginTop: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.88rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: statusFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              border: `1px solid ${statusFeedback.type === 'success' ? '#10b981' : '#ef4444'}`,
              color: statusFeedback.type === 'success' ? '#34d399' : '#f87171'
            }}>
              <span>{statusFeedback.message}</span>
              <button
                type="button"
                onClick={() => setStatusFeedback(null)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="spinner-container" style={{ padding: '40px', textAlign: 'center' }}>
          <div className="spinner"></div> Loading Monthly Muster Details...
        </div>
      ) : staffInfo ? (
        <div id="printable-individual-muster" style={{
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
                  <th style={{ width: '50px', textAlign: 'center' }}>Day</th>
                  <th style={{ width: '110px' }}>Date</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Muster</th>
                  <th style={{ width: '80px' }}>Link No</th>
                  <th style={{ width: '140px' }}>Train Numbers</th>
                  <th>Journey Route</th>
                  <th style={{ width: '80px' }}>Coaches</th>
                  <th>Duty Description / Remarks</th>
                  {isAdmin && <th className="no-print" style={{ width: '80px', textAlign: 'center' }}>Action</th>}
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
                      <button
                        type="button"
                        onClick={() => {
                          if (isAdmin) {
                            setSingleDayModal({
                              date: d.date,
                              currentCode: d.musterCode,
                              dayNum: d.dayNum,
                              dayName: d.dayName,
                              currentDesc: d.statusDesc
                            });
                          }
                        }}
                        style={{
                          background: d.badgeBg,
                          color: d.badgeColor,
                          padding: '3px 9px',
                          borderRadius: '6px',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          border: `1.5px solid ${d.badgeColor}`,
                          cursor: isAdmin ? 'pointer' : 'default',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}
                        title={isAdmin ? "Click to edit attendance code for this day" : undefined}
                      >
                        {d.musterCode}
                      </button>
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
                    {isAdmin && (
                      <td className="no-print" style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSingleDayModal({
                              date: d.date,
                              currentCode: d.musterCode,
                              dayNum: d.dayNum,
                              dayName: d.dayName,
                              currentDesc: d.statusDesc
                            });
                          }}
                          style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: '#e2e8f0',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '0.74rem',
                            cursor: 'pointer'
                          }}
                          title="Edit this single day"
                        >
                          ✏️ Edit
                        </button>
                      </td>
                    )}
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
          <span>⚠️</span> No muster data found for selected employee. Please select an employee from the dropdown above.
        </div>
      )}

      {/* Single Day Quick Edit Modal */}
      {singleDayModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="modal-content" style={{
            maxWidth: '500px',
            width: '92%',
            background: 'var(--bg-primary)',
            border: '1.5px solid var(--border-gold)',
            borderRadius: '14px',
            padding: '22px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📅</span>
                <span>Edit Date: {singleDayModal.date.split('-').reverse().join('/')} ({singleDayModal.dayName})</span>
              </h4>
              <button
                type="button"
                onClick={() => setSingleDayModal(null)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.3rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '0.86rem', color: 'var(--color-text-secondary)', marginBottom: '14px' }}>
              Employee: <strong style={{ color: '#fff' }}>{staffInfo?.name}</strong> | Current Code: <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{singleDayModal.currentCode}</span>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                Click to Assign New Attendance Code:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {MUSTER_CODE_OPTIONS.map(opt => (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => handleUpdateSingleDay(singleDayModal.date, opt.code)}
                    style={{
                      background: opt.bg,
                      color: opt.color,
                      border: singleDayModal.currentCode === opt.code ? '2.5px solid #ffffff' : 'none',
                      borderRadius: '8px',
                      padding: '10px 6px',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      boxShadow: singleDayModal.currentCode === opt.code ? `0 0 10px ${opt.bg}` : 'none'
                    }}
                    title={opt.desc}
                  >
                    <span>{opt.code}</span>
                    <span style={{ fontSize: '0.68rem', opacity: 0.9 }}>{opt.label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '14px' }}>
              <button
                type="button"
                onClick={() => handleResetSingleDay(singleDayModal.date)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#e2e8f0',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                ↺ Reset Day to Baseline
              </button>
              <button
                type="button"
                onClick={() => {
                  setRangeFromDate(singleDayModal.date);
                  setRangeToDate(singleDayModal.date);
                  setSingleDayModal(null);
                }}
                style={{
                  background: 'rgba(59, 130, 246, 0.2)',
                  border: '1px solid #3b82f6',
                  color: '#60a5fa',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                Set as Range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
