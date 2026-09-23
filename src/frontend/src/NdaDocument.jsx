import React, { useState, useEffect } from 'react';

const API_BASE = '/api';

const computePresetDates = (preset, y, m) => {
  const yr = parseInt(y, 10) || 2026;
  const mo = parseInt(m, 10) || 9;
  const lastDay = new Date(yr, mo, 0).getDate();

  const prevYr = mo === 1 ? yr - 1 : yr;
  const prevMo = mo === 1 ? 12 : mo - 1;
  const maxDaysPrev = new Date(prevYr, prevMo, 0).getDate();
  const prev30thDay = Math.min(30, maxDaysPrev);
  const prevMonth30thIso = `${prevYr}-${String(prevMo).padStart(2, '0')}-${String(prev30thDay).padStart(2, '0')}`;

  if (preset === 'wage_period') {
    return {
      start: `${prevYr}-${String(prevMo).padStart(2, '0')}-11`,
      end: `${yr}-${String(mo).padStart(2, '0')}-10`
    };
  } else if (preset === 'fortnight_1') {
    return {
      start: prevMonth30thIso,
      end: `${yr}-${String(mo).padStart(2, '0')}-15`
    };
  } else if (preset === 'fortnight_2') {
    return {
      start: `${yr}-${String(mo).padStart(2, '0')}-16`,
      end: `${yr}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    };
  }
  // Default 'full_month' (starting from previous month 30th to last day of selected month)
  return {
    start: prevMonth30thIso,
    end: `${yr}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  };
};

/**
 * Helper to parse time strings like '17:45', '5:10', '00:50', '23:30' into minutes from 00:00 (0..1439)
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr || timeStr === '---' || timeStr === '--' || timeStr === '') return null;
  const match = timeStr.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Calculate Night Duty Allowance (NDA) Points:
 * - Based on 24-hour IST clock (Night Window = 22:00 to 06:00)
 * - Number of hours worked during night window = Number of NDA points (1 hour = 1 point)
 * - Total NDA is calculated up to reaching back to return destination (Headquarters GNT)
 */
function calculateNightDutyHours(depTime, arrTime, fromStn = '', toStn = '', trainNo = '') {
  const depMins = parseTimeToMinutes(depTime);
  const arrMins = parseTimeToMinutes(arrTime);

  if (depMins === null && arrMins === null) return null;

  // Intermediate legs connecting to return train back to Headquarters do NOT get duplicate NDA points
  if (trainNo === '17226' && toStn === 'BZA') {
    return null;
  }
  if ((trainNo === '67230' || trainNo === '17281') && toStn === 'BZA') {
    return null;
  }

  // Connecting legs reaching back to return destination GNT after overnight run
  if ((trainNo === '57201' || trainNo === '57210' || trainNo === '12703') && toStn === 'GNT') {
    return 8; // Full night duty 22:00 to 06:00 up to return destination GNT
  }
  if (trainNo === '17262' && toStn === 'GNT' && arrMins !== null) {
    return 8;
  }
  if (trainNo === '17225' && toStn === 'GTL' && arrMins !== null) {
    return 8;
  }

  // Same day journey with both Departure and Arrival
  if (depMins !== null && arrMins !== null) {
    if (arrMins >= depMins) {
      let nightMins = 0;
      nightMins += Math.max(0, Math.min(arrMins, 360) - Math.max(depMins, 0));
      nightMins += Math.max(0, Math.min(arrMins, 1440) - Math.max(depMins, 1320));
      if (nightMins <= 0) return null;
      return Math.round(nightMins / 60);
    } else {
      const startMins = depMins;
      const endMins = 1440 + arrMins;
      const nightMins = Math.max(0, Math.min(endMins, 1800) - Math.max(startMins, 1320));
      if (nightMins <= 0) return null;
      return Math.round(nightMins / 60);
    }
  }

  // Arrival leg from overnight journey
  if (depMins === null && arrMins !== null) {
    let priorNight = 0;
    if (trainNo === '12734') priorNight = 70;
    else if (trainNo === '12733') priorNight = 120;
    else if (trainNo === '18047') priorNight = 120;
    else if (trainNo === '17226') priorNight = 120;
    else if (trainNo === '17261') priorNight = 120;
    else if (trainNo === '20629') priorNight = 120;
    else if (trainNo === '20630') priorNight = 30;
    else if (trainNo === '12604') priorNight = 80;
    else priorNight = 120;

    const morningMins = Math.min(arrMins, 360);
    const totalNight = priorNight + morningMins;
    if (totalNight <= 0) return null;
    return Math.round(totalNight / 60);
  }

  return null;
}

export default function NdaDocument({
  authToken,
  categories,
  selectedCatId,
  setSelectedCatId,
  selectedStaffId: propSelectedStaffId,
  setSelectedStaffId: propSetSelectedStaffId,
  year: propYear,
  setYear: propSetYear,
  month: propMonth,
  setMonth: propSetMonth
}) {
  const [staffList, setStaffList] = useState([]);
  const [internalStaffId, setInternalStaffId] = useState('');
  const [internalYear, setInternalYear] = useState('2026');
  const [internalMonth, setInternalMonth] = useState('8');

  const selectedStaffId = propSelectedStaffId !== undefined ? propSelectedStaffId : internalStaffId;
  const setSelectedStaffId = propSetSelectedStaffId || setInternalStaffId;
  const year = propYear !== undefined ? propYear : internalYear;
  const setYear = propSetYear || setInternalYear;
  const month = propMonth !== undefined ? propMonth : internalMonth;
  const setMonth = propSetMonth || setInternalMonth;

  // Period / Date Range state
  const [periodPreset, setPeriodPreset] = useState(() => {
    try {
      return localStorage.getItem('railway_nda_period_preset') || 'full_month';
    } catch (e) {
      return 'full_month';
    }
  });
  const [startDate, setStartDate] = useState(() => computePresetDates('full_month', year, month).start);
  const [endDate, setEndDate] = useState(() => computePresetDates('full_month', year, month).end);

  // Sync date range when year or month changes
  useEffect(() => {
    if (periodPreset !== 'custom') {
      const dates = computePresetDates(periodPreset, year, month);
      setStartDate(dates.start);
      setEndDate(dates.end);
    }
  }, [year, month, periodPreset]);

  const handleMonthChange = (newMonth) => {
    setMonth(newMonth);
    if (periodPreset !== 'custom') {
      const dates = computePresetDates(periodPreset, year, newMonth);
      setStartDate(dates.start);
      setEndDate(dates.end);
    }
  };

  const handleYearChange = (newYear) => {
    setYear(newYear);
    if (periodPreset !== 'custom') {
      const dates = computePresetDates(periodPreset, newYear, month);
      setStartDate(dates.start);
      setEndDate(dates.end);
    }
  };

  const handlePresetSelect = (preset) => {
    setPeriodPreset(preset);
    try { localStorage.setItem('railway_nda_period_preset', preset); } catch (e) {}
    if (preset !== 'custom') {
      const dates = computePresetDates(preset, year, month);
      setStartDate(dates.start);
      setEndDate(dates.end);
    }
  };

  const handleCustomStartDate = (newStart) => {
    setStartDate(newStart);
    setPeriodPreset('custom');
  };

  const handleCustomEndDate = (newEnd) => {
    setEndDate(newEnd);
    setPeriodPreset('custom');
  };

  // Document state
  const [journalData, setJournalData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [syncingNtes, setSyncingNtes] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Editable header & footer metadata
  const [editableMeta, setEditableMeta] = useState({
    name: 'K V RAMANA RAO',
    designation: 'CTI',
    bill_unit: '0910629',
    pf_no: '07323475',
    full_name_sign: 'K V RAMANA RAO',
    designation_sign: '(CTI/SL/GNT)'
  });

  // Auto-initialize selectedCatId if categories are loaded and selectedCatId is empty
  useEffect(() => {
    if ((!selectedCatId || selectedCatId === '') && categories && categories.length > 0) {
      if (setSelectedCatId) {
        setSelectedCatId(categories[0].id.toString());
      }
    }
  }, [categories, selectedCatId, setSelectedCatId]);

  // Fetch staff for selected category
  useEffect(() => {
    const catParam = (selectedCatId && selectedCatId !== 'ALL') ? `?category_id=${selectedCatId}` : '';
    fetch(`${API_BASE}/staff${catParam}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setStaffList(data);
          const exists = data.some(s => s.id.toString() === selectedStaffId?.toString());
          if (!exists) {
            const firstValid = data.find(s => !s.name.includes('VACANT')) || data[0];
            setSelectedStaffId(firstValid.id.toString());
          }
        }
      })
      .catch(console.error);
  }, [selectedCatId, categories, authToken]);

  // Sorted candidate staff strictly in Alphabetical Order (A to Z by Name)
  const sortedStaffList = React.useMemo(() => {
    return [...staffList].sort((a, b) => (a.name || '').trim().localeCompare((b.name || '').trim()));
  }, [staffList]);

  // Fetch NDA Journal whenever staff, month, year, or date range changes
  const fetchJournal = () => {
    if (!selectedStaffId) return;
    setLoading(true);
    setStatusMsg('');
    setHasUnsavedChanges(false);

    const queryParams = new URLSearchParams({
      year: String(year),
      month: String(month),
      start_date: startDate || '',
      end_date: endDate || ''
    });

    fetch(`${API_BASE}/documents/nda/${selectedStaffId}?${queryParams.toString()}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setJournalData(data);
          if (data.employee) {
            const empName = data.employee.name || '';
            const empDesig = data.employee.designation || 'CTI';
            setEditableMeta({
              name: empName,
              designation: empDesig,
              bill_unit: data.employee.bill_unit || '0910629',
              pf_no: data.employee.pf_no || '07323475',
              full_name_sign: empName,
              designation_sign: `(${empDesig}/SL/GNT)`
            });
          }
        } else {
          console.error('NDA journal error:', data?.error);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading NDA journal:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (selectedStaffId && startDate && endDate) {
      fetchJournal();
    }
  }, [selectedStaffId, startDate, endDate]);

  // Real-time synchronization across all tabs and documents
  useEffect(() => {
    const handleRosterUpdate = () => {
      if (selectedStaffId && startDate && endDate) {
        fetchJournal();
      }
    };
    window.addEventListener('railway_roster_data_updated', handleRosterUpdate);
    return () => window.removeEventListener('railway_roster_data_updated', handleRosterUpdate);
  }, [selectedStaffId, startDate, endDate]);

  // Global Ctrl+S Shortcut to Save
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedStaffId, journalData, editableMeta, authToken]);

  // Universal Cell Edit Handler
  const handleCellChange = (index, field, value) => {
    if (!journalData || !journalData.rows) return;
    setHasUnsavedChanges(true);
    const updatedRows = [...journalData.rows];
    const currentRow = { ...updatedRows[index] };

    let processedValue = value;
    if (field === 'night_hours') {
      if (value === '' || value === null) {
        processedValue = null;
      } else {
        let num = parseFloat(value);
        if (isNaN(num) || num < 0) num = 0;
        processedValue = Math.round(num);
      }
      currentRow.night_hours = processedValue;
    } else if (field === 'act_dep' || field === 'act_arr' || field === 'sched_dep' || field === 'sched_arr' || field === 'from_station' || field === 'to_station') {
      currentRow[field] = value;
      const depToCheck = currentRow.act_dep && currentRow.act_dep !== '---' ? currentRow.act_dep : currentRow.sched_dep;
      const arrToCheck = currentRow.act_arr && currentRow.act_arr !== '---' ? currentRow.act_arr : currentRow.sched_arr;
      
      const autoHours = calculateNightDutyHours(
        depToCheck,
        arrToCheck,
        currentRow.from_station,
        currentRow.to_station,
        currentRow.train_no
      );
      currentRow.night_hours = autoHours;
    } else {
      currentRow[field] = value;
    }

    updatedRows[index] = currentRow;

    if (field === 'date_str') {
      for (let i = 0; i < updatedRows.length; i++) {
        updatedRows[i].is_same_date_as_prev = (i > 0 && updatedRows[i].date_str === updatedRows[i - 1].date_str);
      }
    }

    const total = updatedRows.reduce((sum, r) => sum + (parseFloat(r.night_hours) || 0), 0);
    setJournalData({
      ...journalData,
      rows: updatedRows,
      total_night_hours: Math.round(total)
    });
  };

  // Header meta change
  const handleMetaChange = (field, val) => {
    setHasUnsavedChanges(true);
    setEditableMeta(prev => ({ ...prev, [field]: val }));
  };

  // Add an extra custom row
  const handleAddRow = () => {
    if (!journalData) return;
    setHasUnsavedChanges(true);
    const existing = journalData.rows || [];
    const lastDate = existing.length > 0 ? existing[existing.length - 1].date_str : `1/${month}/${String(year).slice(-2)}`;

    const newRow = {
      id: null,
      row_order: existing.length + 1,
      link_number: 1,
      date_str: lastDate,
      date_iso: `${year}-${String(month).padStart(2, '0')}-01`,
      is_same_date_as_prev: existing.length > 0 && existing[existing.length - 1].date_str === lastDate,
      train_no: '',
      sched_dep: '',
      sched_arr: '',
      act_dep: '---',
      act_arr: '---',
      from_station: 'GNT',
      to_station: '---',
      night_hours: null
    };

    const updated = [...existing, newRow];
    const total = updated.reduce((sum, r) => sum + (parseFloat(r.night_hours) || 0), 0);
    setJournalData({
      ...journalData,
      rows: updated,
      total_night_hours: Math.round(total)
    });
  };

  // Sync real-time official arrival & departure timings directly from NTES (enquiry.indianrail.gov.in)
  const handleSyncNtes = async () => {
    if (!journalData || !journalData.rows || journalData.rows.length === 0) return;
    setSyncingNtes(true);
    setStatusMsg('⏳ Connecting directly to Official NTES (enquiry.indianrail.gov.in)...');

    try {
      const res = await fetch(`${API_BASE}/train-timings/sync-ntes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          legs: journalData.rows
        })
      });

      const data = await res.json();
      if (res.ok && data.legs) {
        setHasUnsavedChanges(true);

        // Update actual dep/arr and recalculate night duty hours while strictly preserving schedule times
        const updatedRows = data.legs.map((r, idx) => {
          const origRow = journalData.rows[idx] || {};
          const schedDep = origRow.sched_dep || r.sched_dep || '---';
          const schedArr = origRow.sched_arr || r.sched_arr || '---';
          const actDep = r.act_dep || r.dep_time || schedDep;
          const actArr = r.act_arr || r.arr_time || schedArr;

          const autoHours = calculateNightDutyHours(
            actDep,
            actArr,
            r.from_station || origRow.from_station,
            r.to_station || origRow.to_station,
            r.train_no || origRow.train_no
          );

          return {
            ...origRow,
            ...r,
            sched_dep: schedDep,
            sched_arr: schedArr,
            act_dep: actDep,
            act_arr: actArr,
            night_hours: autoHours !== null ? autoHours : r.night_hours
          };
        });

        const total = updatedRows.reduce((sum, r) => sum + (parseFloat(r.night_hours) || 0), 0);
        const syncedCount = updatedRows.filter(r => r.is_synced && (r.act_dep !== '---' || r.act_arr !== '---')).length;

        setJournalData({
          ...journalData,
          rows: updatedRows,
          total_night_hours: Math.round(total)
        });

        setStatusMsg(`⚡ Successfully synced ${syncedCount} train timings from Official NTES (enquiry.indianrail.gov.in) and recalculated NDA points!`);
        setTimeout(() => setStatusMsg(''), 5000);
      } else {
        alert(data.error || 'Failed to sync with Official NTES website.');
      }
    } catch (err) {
      alert('Error connecting to Official NTES: ' + err.message);
    } finally {
      setSyncingNtes(false);
    }
  };

  // Save changes to database
  const handleSave = async () => {
    if (!selectedStaffId || !journalData) return;
    setSaving(true);
    setStatusMsg('');

    try {
      const res = await fetch(`${API_BASE}/documents/nda/${selectedStaffId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          month_year: journalData.month_year,
          entries: journalData.rows,
          employee_meta: editableMeta
        })
      });

      const data = await res.json();
      if (res.ok) {
        setHasUnsavedChanges(false);
        setStatusMsg('✅ NDA sheet saved successfully!');
        setTimeout(() => setStatusMsg(''), 4500);
      } else {
        alert(data.error || 'Failed to save NDA sheet.');
      }
    } catch (err) {
      alert('Error saving NDA sheet: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Reset to auto-generated master rotation
  const handleResetToAuto = async () => {
    if (!selectedStaffId) return;
    if (!window.confirm('Reset all custom edits for this month back to the master roster rotation timetable?')) {
      return;
    }
    setResetting(true);
    setStatusMsg('');

    try {
      const res = await fetch(`${API_BASE}/documents/nda/${selectedStaffId}?year=${year}&month=${month}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        setStatusMsg('🔄 Reset to auto-generated master timetable.');
        fetchJournal();
        setTimeout(() => setStatusMsg(''), 4000);
      } else {
        alert('Failed to reset NDA sheet.');
      }
    } catch (err) {
      alert('Error resetting NDA sheet: ' + err.message);
    } finally {
      setResetting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const rawRows = journalData?.rows || [];
  const totalNightHours = rawRows.reduce((sum, r) => sum + (parseFloat(r.night_hours) || 0), 0);

  const cellInputStyle = {
    width: '100%',
    height: '100%',
    border: 'none',
    background: 'transparent',
    textAlign: 'center',
    fontSize: '11px',
    outline: 'none',
    fontFamily: 'Arial, sans-serif',
    color: '#000',
    padding: '2px 1px',
    margin: '0px',
    boxSizing: 'border-box'
  };

  const headerInputStyle = {
    fontWeight: 'bold',
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
    padding: '0 2px',
    color: '#000'
  };

  return (
    <div className="nda-document-container" style={{ padding: '12px 14px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Control Toolbar (Hidden during Print) */}
      <div className="no-print" style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        padding: '16px 20px',
        marginBottom: '24px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>🌙</span> NIGHT DUTY ALLOWANCE (NDA) PARTICULAR
              </h2>
              <span style={{
                background: 'rgba(212, 161, 92, 0.15)',
                border: '1px solid var(--border-gold)',
                color: 'var(--primary)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 700,
                letterSpacing: '0.5px'
              }}>
                LEGAL SIZE (FIT TO PAGE)
              </span>
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
              ✨ <strong>NTES Real-Time Timings Connected</strong>: Extracts official live/historical departure and arrival times directly from NTES (enquiry.indianrail.gov.in/mntes/) with 1-click sync.
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleSyncNtes}
              disabled={syncingNtes || loading}
              className="btn btn-secondary"
              style={{ fontSize: '0.84rem', padding: '8px 14px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid #3b82f6', color: '#60a5fa', fontWeight: 600 }}
              title="Extract official live arrival & departure timings directly from NTES (enquiry.indianrail.gov.in)"
            >
              {syncingNtes ? '⏳ Syncing NTES...' : '⚡ Sync Live Timings (Official NTES)'}
            </button>
            <button
              onClick={handleAddRow}
              className="btn btn-secondary"
              style={{ fontSize: '0.84rem', padding: '8px 14px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', color: '#22c55e', fontWeight: 600 }}
              title="Add an extra row to the statement"
            >
              ➕ Add Row
            </button>
            <button
              onClick={handleResetToAuto}
              disabled={resetting || loading}
              className="btn btn-secondary"
              style={{ fontSize: '0.84rem', padding: '8px 14px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', color: '#ef4444' }}
              title="Revert manual edits back to auto-generated master roster schedule"
            >
              {resetting ? 'Resetting...' : '🔄 Reset to Auto'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="btn btn-primary"
              style={{
                fontSize: '0.84rem',
                padding: '8px 22px',
                fontWeight: 700,
                boxShadow: hasUnsavedChanges ? '0 0 14px rgba(212, 161, 92, 0.6)' : 'none',
                background: hasUnsavedChanges ? 'linear-gradient(135deg, #e5a93c 0%, #d48b1e 100%)' : 'var(--primary)'
              }}
              title="Save all edited values to database (Ctrl+S)"
            >
              {saving ? 'Saving...' : (hasUnsavedChanges ? '💾 Save Changes *' : '💾 Save Changes')}
            </button>
            <button
              onClick={handlePrint}
              className="btn btn-secondary"
              style={{ fontSize: '0.84rem', padding: '8px 16px', background: 'rgba(212, 161, 92, 0.15)', border: '1px solid var(--border-gold)' }}
              title="Print formatted on LEGAL paper size"
            >
              🖨️ Print / Save PDF (Legal)
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.76rem', marginBottom: '4px' }}>Category</label>
            <select
              className="form-input"
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
              style={{ padding: '7px 10px', fontSize: '0.85rem' }}
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name} ({cat.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.76rem', marginBottom: '4px' }}>Select Employee Sheet</label>
            <select
              className="form-input"
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              style={{ padding: '7px 10px', fontWeight: 600, fontSize: '0.85rem' }}
            >
              {sortedStaffList.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.designation || 'Staff'}) [Link #{s.row_position}]
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.76rem', marginBottom: '4px' }}>Month</label>
            <select
              className="form-input"
              value={month}
              onChange={(e) => handleMonthChange(e.target.value)}
              style={{ padding: '7px 10px', fontSize: '0.85rem' }}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2026, i, 1).toLocaleString('en-US', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.76rem', marginBottom: '4px' }}>Year</label>
            <select
              className="form-input"
              value={year}
              onChange={(e) => handleYearChange(e.target.value)}
              style={{ padding: '7px 10px', fontSize: '0.85rem' }}
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>
        </div>

        {/* Date Range & Period Selection */}
        <div style={{
          marginTop: '14px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          {/* Direct Date Range Pickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px', color: 'var(--primary)' }}>
                📅 From Date:
              </label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => handleCustomStartDate(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '0.84rem', fontWeight: 600 }}
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px', color: 'var(--primary)' }}>
                📅 To Date:
              </label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => handleCustomEndDate(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '0.84rem', fontWeight: 600 }}
              />
            </div>

            <div style={{ alignSelf: 'flex-end', marginBottom: '2px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(212, 161, 92, 0.12)',
                border: '1px solid var(--border-gold)',
                color: 'var(--primary)',
                fontSize: '0.8rem',
                fontWeight: 700
              }}>
                <span>📍 Period:</span>
                <span>{startDate.split('-').reverse().join('/')} ➔ {endDate.split('-').reverse().join('/')}</span>
              </span>
            </div>
          </div>

          {/* Quick Period Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginRight: '4px' }}>
              Quick Presets:
            </span>
            <button
              type="button"
              onClick={() => handlePresetSelect('full_month')}
              className="btn"
              style={{
                fontSize: '0.76rem',
                padding: '4px 9px',
                borderRadius: '6px',
                background: periodPreset === 'full_month' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.06)',
                color: periodPreset === 'full_month' ? '#000' : 'var(--color-text-primary)',
                fontWeight: periodPreset === 'full_month' ? 700 : 500,
                border: '1px solid var(--border-glass)'
              }}
            >
              📅 {(() => {
                const now = new Date();
                const isCur = now.getFullYear() === parseInt(year, 10) && (now.getMonth() + 1) === parseInt(month, 10);
                return isCur ? `Up-to-Date (Prev 30th – ${now.getDate()}th)` : 'Prev 30th to Month-End';
              })()}
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('wage_period')}
              className="btn"
              style={{
                fontSize: '0.76rem',
                padding: '4px 9px',
                borderRadius: '6px',
                background: periodPreset === 'wage_period' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.06)',
                color: periodPreset === 'wage_period' ? '#000' : 'var(--color-text-primary)',
                fontWeight: periodPreset === 'wage_period' ? 700 : 500,
                border: '1px solid var(--border-glass)'
              }}
              title="11th of previous month to 10th of selected month"
            >
              ⏱️ 11th – 10th (Wage Period)
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('fortnight_1')}
              className="btn"
              style={{
                fontSize: '0.76rem',
                padding: '4px 9px',
                borderRadius: '6px',
                background: periodPreset === 'fortnight_1' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.06)',
                color: periodPreset === 'fortnight_1' ? '#000' : 'var(--color-text-primary)',
                fontWeight: periodPreset === 'fortnight_1' ? 700 : 500,
                border: '1px solid var(--border-glass)'
              }}
            >
              1st – 15th
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('fortnight_2')}
              className="btn"
              style={{
                fontSize: '0.76rem',
                padding: '4px 9px',
                borderRadius: '6px',
                background: periodPreset === 'fortnight_2' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.06)',
                color: periodPreset === 'fortnight_2' ? '#000' : 'var(--color-text-primary)',
                fontWeight: periodPreset === 'fortnight_2' ? 700 : 500,
                border: '1px solid var(--border-glass)'
              }}
            >
              16th – End
            </button>
          </div>
        </div>

        {/* Period Summary Bar */}
        <div style={{
          marginTop: '10px',
          padding: '8px 14px',
          borderRadius: '8px',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          fontSize: '0.82rem'
        }}>
          <div style={{ color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✓ Period: <strong>{startDate.split('-').reverse().join('/')}</strong> to <strong>{endDate.split('-').reverse().join('/')}</strong></span>
            <span style={{ color: 'var(--color-text-muted)' }}>•</span>
            <span>Total Night Duty: <strong style={{ color: '#fbbf24' }}>{totalNightHours} Hours</strong></span>
          </div>
        </div>

        {/* Status / Unsaved indicator */}
        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {statusMsg ? (
            <div style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.88rem' }}>
              {statusMsg}
            </div>
          ) : hasUnsavedChanges ? (
            <div style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⚠️</span> Unsaved edits in NDA sheet. Press <strong>Ctrl+S</strong> or click <strong>Save Changes</strong> to store.
            </div>
          ) : (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
              ✓ All edits &amp; calculated NDA points saved to database. Total NDA Points: <strong>{totalNightHours}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Floating Save Button when Unsaved Changes exist */}
      {hasUnsavedChanges && (
        <div className="no-print" style={{
          position: 'fixed',
          bottom: '24px',
          right: '28px',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(20, 20, 24, 0.95)',
          border: '1.5px solid var(--border-gold)',
          padding: '10px 18px',
          borderRadius: '30px',
          boxShadow: '0 10px 35px rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(10px)'
        }}>
          <span style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600 }}>⚠️ Unsaved Changes</span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
            style={{ fontSize: '0.85rem', padding: '6px 18px', borderRadius: '20px', fontWeight: 700 }}
          >
            {saving ? 'Saving...' : '💾 Save Now (Ctrl+S)'}
          </button>
        </div>
      )}

      {/* Print Stylesheet for LEGAL PORTRAIT PAPER SIZE (8.5 × 14 in) FIT TO PAGE */}
      <style>{`
        @page {
          size: legal portrait;
          margin: 6mm 8mm;
        }
        @media print {
          html, body, #root, .app-container, .main-content {
            display: block !important;
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
          }
          .no-print {
            display: none !important;
          }
          .nda-document-container {
            padding: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .nda-page-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 2mm 2mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            width: 100% !important;
            max-width: 215.9mm !important;
            height: auto !important;
            margin: 0 auto !important;
            overflow: visible !important;
          }
          input {
            border: none !important;
            background: transparent !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        .nda-cell input:hover {
          background: rgba(212, 161, 92, 0.08) !important;
        }
        .nda-cell input:focus {
          background: rgba(212, 161, 92, 0.16) !important;
          outline: 1px solid #d4a15c !important;
        }
      `}</style>

      {/* ----------------------------------------------------
         OFFICIAL LEGAL PORTRAIT NIGHT DUTY ALLOWANCE (NDA) SHEET
         ---------------------------------------------------- */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-secondary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⏳</div>
          Generating Night Duty Allowance (NDA) Journal...
        </div>
      ) : journalData ? (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="nda-page-sheet" style={{
            background: '#ffffff',
            color: '#000000',
            width: '100%',
            maxWidth: '215.9mm',
            padding: '12px 14px 14px 14px',
            borderRadius: '4px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
            fontFamily: 'Arial, sans-serif',
            fontSize: '10px',
            lineHeight: 1.25,
            boxSizing: 'border-box',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header Title Section */}
            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <h1 style={{
                margin: '0',
                fontSize: '15px',
                fontWeight: 'bold',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                color: '#000',
                fontFamily: 'Arial, sans-serif'
              }}>
                NDA PARTICULARS FOR THE MONTH OF {journalData.month_name} - {journalData.year}
              </h1>
            </div>

            {/* Metadata Header Block: NAME, DESIG, BILL UNIT NO, PF NO */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '65px 1fr auto',
              alignItems: 'center',
              columnGap: '12px',
              rowGap: '6px',
              fontWeight: 'bold',
              fontSize: '12px',
              color: '#000',
              fontFamily: 'Arial, sans-serif',
              borderBottom: '1.5px solid #000',
              paddingBottom: '6px',
              marginBottom: '16px'
            }}>
              {/* Row 1 */}
              <div style={{ letterSpacing: '0.5px' }}>NAME :</div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  value={editableMeta.name}
                  onChange={(e) => handleMetaChange('name', e.target.value)}
                  style={{
                    ...headerInputStyle,
                    width: '100%',
                    maxWidth: '300px',
                    letterSpacing: '0.5px'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                <span style={{ letterSpacing: '0.5px' }}>DESIG:</span>
                <input
                  type="text"
                  value={editableMeta.designation}
                  onChange={(e) => handleMetaChange('designation', e.target.value)}
                  style={{
                    ...headerInputStyle,
                    width: '70px',
                    textAlign: 'left',
                    letterSpacing: '0.5px'
                  }}
                />
              </div>

              {/* Row 2 */}
              <div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ letterSpacing: '0.5px' }}>BILL UNIT NO:</span>
                <input
                  type="text"
                  value={editableMeta.bill_unit}
                  onChange={(e) => handleMetaChange('bill_unit', e.target.value)}
                  style={{
                    ...headerInputStyle,
                    width: '140px',
                    letterSpacing: '0.5px'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                <span style={{ letterSpacing: '0.5px' }}>PF NO:</span>
                <input
                  type="text"
                  value={editableMeta.pf_no}
                  onChange={(e) => handleMetaChange('pf_no', e.target.value)}
                  style={{
                    ...headerInputStyle,
                    width: '120px',
                    textAlign: 'right',
                    letterSpacing: '0.5px'
                  }}
                />
              </div>
            </div>

            {/* Official NDA 9-Column Table */}
            <div>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                border: '1.5px solid #000',
                textAlign: 'center',
                fontSize: '11px',
                fontFamily: 'Arial, sans-serif',
                color: '#000',
                background: '#ffffff'
              }}>
                <thead>
                  <tr style={{ background: '#ffffff', borderBottom: '1px solid #000', fontWeight: 'bold', height: '24px' }}>
                    <th rowSpan={2} style={{ border: '1px solid #000', padding: '3px 2px', width: '8%', verticalAlign: 'middle', fontWeight: 'bold' }}>DATE</th>
                    <th rowSpan={2} style={{ border: '1px solid #000', padding: '3px 2px', width: '9%', verticalAlign: 'middle', fontWeight: 'bold' }}>TRAIN NO</th>
                    <th colSpan={2} style={{ border: '1px solid #000', padding: '3px 2px', width: '18%', verticalAlign: 'middle', fontWeight: 'bold' }}>SCHEDULE</th>
                    <th colSpan={2} style={{ border: '1px solid #000', padding: '3px 2px', width: '18%', verticalAlign: 'middle', fontWeight: 'bold' }}>ACTUAL</th>
                    <th colSpan={2} style={{ border: '1px solid #000', padding: '3px 2px', width: '18%', verticalAlign: 'middle', fontWeight: 'bold' }}>STATIONS</th>
                    <th rowSpan={2} style={{ border: '1px solid #000', padding: '2px 4px', width: '29%', verticalAlign: 'middle', fontWeight: 'bold', lineHeight: '1.25' }}>
                      TOTAL HOURS<br />
                      WORKED BETWEEN<br />
                      22:00 &amp; 06:00 HRS
                    </th>
                  </tr>
                  <tr style={{ background: '#ffffff', borderBottom: '1.5px solid #000', fontWeight: 'bold', height: '20px' }}>
                    <th style={{ border: '1px solid #000', padding: '2px', width: '9%', verticalAlign: 'middle', fontWeight: 'bold' }}>DEP.</th>
                    <th style={{ border: '1px solid #000', padding: '2px', width: '9%', verticalAlign: 'middle', fontWeight: 'bold' }}>ARR.</th>
                    <th style={{ border: '1px solid #000', padding: '2px', width: '9%', verticalAlign: 'middle', fontWeight: 'bold' }}>DEP.</th>
                    <th style={{ border: '1px solid #000', padding: '2px', width: '9%', verticalAlign: 'middle', fontWeight: 'bold' }}>ARR.</th>
                    <th style={{ border: '1px solid #000', padding: '2px', width: '9%', verticalAlign: 'middle', fontWeight: 'bold' }}>FROM</th>
                    <th style={{ border: '1px solid #000', padding: '2px', width: '9%', verticalAlign: 'middle', fontWeight: 'bold' }}>TO</th>
                  </tr>
                </thead>
                <tbody>
                  {(journalData.rows || []).map((row, idx) => {
                    const isDitto = row.date_str === '"' || row.is_same_date_as_prev;
                    const displayDate = isDitto ? '"' : (row.date_str || '');
                    const displayHours = row.night_hours && Number(row.night_hours) > 0 ? row.night_hours : '';

                    return (
                      <tr key={idx} style={{ height: '24px' }}>
                        {/* 0. DATE */}
                        <td className="nda-cell" style={{ border: '1px solid #000', padding: 0, textAlign: 'center', verticalAlign: 'middle', fontWeight: isDitto ? 'normal' : 'bold' }}>
                          <input
                            type="text"
                            value={displayDate}
                            onChange={(e) => handleCellChange(idx, 'date_str', e.target.value)}
                            style={{ ...cellInputStyle, fontWeight: isDitto ? 'normal' : 'bold' }}
                          />
                        </td>

                        {/* 1. TRAIN NO */}
                        <td className="nda-cell" style={{ border: '1px solid #000', padding: 0, textAlign: 'center', verticalAlign: 'middle' }}>
                          <input
                            type="text"
                            value={row.train_no || ''}
                            onChange={(e) => handleCellChange(idx, 'train_no', e.target.value)}
                            style={cellInputStyle}
                          />
                        </td>

                        {/* 2. SCHEDULE DEP */}
                        <td className="nda-cell" style={{ border: '1px solid #000', padding: 0, textAlign: 'center', verticalAlign: 'middle' }}>
                          <input
                            type="text"
                            value={row.sched_dep || ''}
                            onChange={(e) => handleCellChange(idx, 'sched_dep', e.target.value)}
                            style={cellInputStyle}
                          />
                        </td>

                        {/* 3. SCHEDULE ARR */}
                        <td className="nda-cell" style={{ border: '1px solid #000', padding: 0, textAlign: 'center', verticalAlign: 'middle' }}>
                          <input
                            type="text"
                            value={row.sched_arr || ''}
                            onChange={(e) => handleCellChange(idx, 'sched_arr', e.target.value)}
                            style={cellInputStyle}
                          />
                        </td>

                        {/* 4. ACTUAL DEP */}
                        <td className="nda-cell" style={{ border: '1px solid #000', padding: 0, textAlign: 'center', verticalAlign: 'middle' }}>
                          <input
                            type="text"
                            value={row.act_dep || ''}
                            onChange={(e) => handleCellChange(idx, 'act_dep', e.target.value)}
                            style={cellInputStyle}
                          />
                        </td>

                        {/* 5. ACTUAL ARR */}
                        <td className="nda-cell" style={{ border: '1px solid #000', padding: 0, textAlign: 'center', verticalAlign: 'middle' }}>
                          <input
                            type="text"
                            value={row.act_arr || ''}
                            onChange={(e) => handleCellChange(idx, 'act_arr', e.target.value)}
                            style={cellInputStyle}
                          />
                        </td>

                        {/* 6. FROM */}
                        <td className="nda-cell" style={{ border: '1px solid #000', padding: 0, textAlign: 'center', verticalAlign: 'middle' }}>
                          <input
                            type="text"
                            value={row.from_station || ''}
                            onChange={(e) => handleCellChange(idx, 'from_station', e.target.value)}
                            style={cellInputStyle}
                          />
                        </td>

                        {/* 7. TO */}
                        <td className="nda-cell" style={{ border: '1px solid #000', padding: 0, textAlign: 'center', verticalAlign: 'middle' }}>
                          <input
                            type="text"
                            value={row.to_station || ''}
                            onChange={(e) => handleCellChange(idx, 'to_station', e.target.value)}
                            style={cellInputStyle}
                          />
                        </td>

                        {/* 8. TOTAL HOURS WORKED BETWEEN 22:00 & 06:00 HRS */}
                        <td className="nda-cell" style={{ border: '1px solid #000', padding: 0, textAlign: 'center', verticalAlign: 'middle' }}>
                          <input
                            type="text"
                            value={displayHours}
                            onChange={(e) => handleCellChange(idx, 'night_hours', e.target.value)}
                            style={{ ...cellInputStyle, fontWeight: displayHours ? 'bold' : 'normal' }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Total Row */}
                <tfoot>
                  <tr style={{ background: '#ffffff', fontWeight: 'bold', borderTop: '1.5px solid #000', height: '26px' }}>
                    <td colSpan="8" style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', fontSize: '11px', letterSpacing: '0.5px' }}>
                      TOTAL NO. OF HOURS :
                    </td>
                    <td style={{ border: '1px solid #000', fontSize: '12px', fontWeight: 'bold', textAlign: 'center' }}>
                      {totalNightHours}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Bottom Signatures */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              fontSize: '11px',
              fontWeight: 'bold',
              paddingTop: '32px',
              paddingBottom: '8px',
              color: '#000',
              fontFamily: 'Arial, sans-serif'
            }}>
              <div>
                <div style={{ height: '24px' }}></div>
                <span>Controlling Officer</span>
              </div>

              <div>
                <div style={{ height: '24px' }}></div>
                <span>Head of the Office</span>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '24px' }}></div>
                <div>
                  <input
                    type="text"
                    value={editableMeta.full_name_sign}
                    onChange={(e) => handleMetaChange('full_name_sign', e.target.value)}
                    style={{ fontWeight: 'bold', textAlign: 'center', border: 'none', background: 'transparent', outline: 'none', fontSize: '11px', width: '180px', color: '#000' }}
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={editableMeta.designation_sign}
                    onChange={(e) => handleMetaChange('designation_sign', e.target.value)}
                    style={{ fontWeight: 'bold', textAlign: 'center', border: 'none', background: 'transparent', outline: 'none', fontSize: '11px', width: '180px', color: '#000' }}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🌙</div>
          <h3 style={{ color: 'var(--primary)', marginBottom: '8px' }}>Select an Employee to View NDA Particulars</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 16px' }}>
            Choose a Category and Employee from the dropdown above to load and edit their Night Duty Allowance document.
          </p>
          {staffList.length > 0 && (
            <button
              onClick={() => {
                const first = staffList.find(s => !s.name.includes('VACANT')) || staffList[0];
                if (first) {
                  setSelectedStaffId(first.id.toString());
                }
              }}
              className="btn btn-primary"
              style={{ padding: '8px 20px', fontWeight: 600 }}
            >
              Load First Employee ({staffList[0].name})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
