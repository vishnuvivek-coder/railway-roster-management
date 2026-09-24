import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

const API_BASE = '/api';

export default function DailyEarningsDocument({
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
  // Mode selection:
  // 'continuous' -> Multi-Day Continuous Daily Summary (exact format of user's spreadsheet screenshot)
  // 'single_day' -> Single Date View (Category Separated)
  // 'monthly'    -> Individual Staff Monthly Breakdown (1 staff for 30/31 days)
  const [viewMode, setViewMode] = useState('continuous');

  // Duty Filter: 'booked_only' (Booked to Duty), 'on_duty' (Booked + Outstation), 'all' (All Staff)
  const [dutyFilter, setDutyFilter] = useState('on_duty');

  // Internal state fallbacks
  const [internalStaffId, setInternalStaffId] = useState('');
  const [internalYear, setInternalYear] = useState('2026');
  const [internalMonth, setInternalMonth] = useState('8');

  const selectedStaffId = propSelectedStaffId !== undefined ? propSelectedStaffId : internalStaffId;
  const setSelectedStaffId = propSetSelectedStaffId || setInternalStaffId;
  const year = propYear !== undefined ? propYear : internalYear;
  const setYear = propSetYear || setInternalYear;
  const month = propMonth !== undefined ? propMonth : internalMonth;
  const setMonth = propSetMonth || setInternalMonth;

  // Staff list for category
  const [staffList, setStaffList] = useState([]);

  // Date selection states
  const [singleDate, setSingleDate] = useState('2026-08-28');
  const [rangeStartDate, setRangeStartDate] = useState('2026-08-28');
  const [rangeEndDate, setRangeEndDate] = useState('2026-08-30');

  const [activeCategoryId, setActiveCategoryId] = useState('all');
  const [depotTitle, setDepotTitle] = useState('GNT ATY-1D2');

  // Single Day state
  const [singleSheetData, setSingleSheetData] = useState(null);
  const [singleRows, setSingleRows] = useState([]);

  // Continuous Multi-Day state
  const [rangeData, setRangeData] = useState(null);
  const [rangeDays, setRangeDays] = useState([]);

  // Monthly mode state (for individual employee)
  const [monthlyData, setMonthlyData] = useState(null);
  const [monthlyRows, setMonthlyRows] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch staff for dropdowns
  useEffect(() => {
    const catId = selectedCatId || (categories && categories.length > 0 ? categories[0].id.toString() : '1');
    fetch(`${API_BASE}/staff?category_id=${catId}`, {
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
  }, [selectedCatId, categories, authToken, selectedStaffId, setSelectedStaffId]);

  // 1. Fetch Continuous Multi-Day Range Data (Matching user screenshot)
  const fetchContinuousRange = () => {
    setLoading(true);
    setStatusMsg('');
    setHasUnsavedChanges(false);

    const catParam = activeCategoryId !== 'all' ? `&category_id=${activeCategoryId}` : '';
    fetch(`${API_BASE}/documents/daily-earnings/range?start_date=${rangeStartDate}&end_date=${rangeEndDate}${catParam}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data && data.days) {
          setRangeData(data);
          setRangeDays(data.days);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching Continuous Multi-Day Earnings:', err);
        setStatusMsg('Failed to load Continuous Daily Earnings data.');
        setLoading(false);
      });
  };

  // 2. Fetch Single Day Data
  const fetchSingleDay = () => {
    setLoading(true);
    setStatusMsg('');
    setHasUnsavedChanges(false);

    const catParam = activeCategoryId !== 'all' ? `&category_id=${activeCategoryId}` : '';
    fetch(`${API_BASE}/documents/daily-earnings?date=${singleDate}${catParam}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data && data.rows) {
          setSingleSheetData(data);
          setSingleRows(data.rows);
          if (data.depot_title) {
            setDepotTitle(data.depot_title);
          }
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching Single Day Earnings:', err);
        setStatusMsg('Failed to load Daily Earnings data.');
        setLoading(false);
      });
  };

  // 3. Fetch Employee Monthly Breakdown
  const fetchMonthlyEarnings = () => {
    if (!selectedStaffId) return;
    setLoading(true);
    setStatusMsg('');
    setHasUnsavedChanges(false);

    fetch(`${API_BASE}/documents/daily-earnings/staff/${selectedStaffId}?year=${year}&month=${month}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data && data.days) {
          setMonthlyData(data);
          setMonthlyRows(data.days);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching Monthly Earnings for employee:', err);
        setStatusMsg('Failed to load employee monthly earnings.');
        setLoading(false);
      });
  };

  // Trigger appropriate fetch based on viewMode
  useEffect(() => {
    if (viewMode === 'continuous') {
      fetchContinuousRange();
    } else if (viewMode === 'single_day') {
      fetchSingleDay();
    } else {
      fetchMonthlyEarnings();
    }
  }, [viewMode, rangeStartDate, rangeEndDate, singleDate, activeCategoryId, selectedStaffId, year, month, authToken]);

  // Recalculate row totals helper
  const recalcRow = (row) => {
    const twt_nc = parseInt(row.twt_nc, 10) || 0;
    const twt_fare = parseFloat(row.twt_fare) || 0;
    const twt_penalty = parseFloat(row.twt_penalty) || 0;

    const ir_nc = parseInt(row.ir_nc, 10) || 0;
    const ir_fare = parseFloat(row.ir_fare) || 0;
    const ir_penalty = parseFloat(row.ir_penalty) || 0;

    const ubl_nc = parseInt(row.ubl_nc, 10) || 0;
    const ubl_amt = parseFloat(row.ubl_amt) || 0;

    const gst = parseFloat(row.gst) || 0;

    const z652_nc = parseInt(row.z652_nc, 10) || 0;
    const z652_amt = parseFloat(row.z652_amt) || 0;

    const oc_nc = parseInt(row.oc_nc, 10) || 0;
    const oc_amt = parseFloat(row.oc_amt) || 0;

    row.nc_eff_nc = twt_nc + ir_nc + ubl_nc;
    row.nc_eff_amt = twt_fare + twt_penalty + ir_fare + ir_penalty + ubl_amt;

    row.nc_gtot_nc = row.nc_eff_nc + z652_nc + oc_nc;
    row.nc_gtot_amt = row.nc_eff_amt + gst + z652_amt + oc_amt;

    return row;
  };

  // Handle cell change in Continuous Multi-Day Mode
  const handleContinuousCellChange = (dayIndex, staffId, field, value) => {
    setRangeDays(prevDays => {
      const updatedDays = [...prevDays];
      const day = { ...updatedDays[dayIndex] };
      const updatedRows = day.rows.map(row => {
        if (row.staff_id !== staffId) return row;
        const newRow = { ...row };

        if (['twt_nc', 'ir_nc', 'ubl_nc', 'z652_nc', 'oc_nc'].includes(field)) {
          newRow[field] = value === '' ? 0 : (parseInt(value, 10) || 0);
        } else if (['twt_fare', 'twt_penalty', 'ir_fare', 'ir_penalty', 'ubl_amt', 'gst', 'z652_amt', 'oc_amt'].includes(field)) {
          newRow[field] = value === '' ? 0 : (parseFloat(value) || 0);
        } else {
          newRow[field] = value;
        }

        return recalcRow(newRow);
      });

      day.rows = updatedRows;
      updatedDays[dayIndex] = day;
      return updatedDays;
    });

    setHasUnsavedChanges(true);
  };

  // Handle cell change in Single Day Mode
  const handleSingleDayCellChange = (staffId, field, value) => {
    setSingleRows(prevRows => {
      return prevRows.map(row => {
        if (row.staff_id !== staffId) return row;
        const newRow = { ...row };

        if (['twt_nc', 'ir_nc', 'ubl_nc', 'z652_nc', 'oc_nc'].includes(field)) {
          newRow[field] = value === '' ? 0 : (parseInt(value, 10) || 0);
        } else if (['twt_fare', 'twt_penalty', 'ir_fare', 'ir_penalty', 'ubl_amt', 'gst', 'z652_amt', 'oc_amt'].includes(field)) {
          newRow[field] = value === '' ? 0 : (parseFloat(value) || 0);
        } else {
          newRow[field] = value;
        }

        return recalcRow(newRow);
      });
    });

    setHasUnsavedChanges(true);
  };

  // Handle cell change in Monthly Mode
  const handleMonthlyCellChange = (index, field, value) => {
    setMonthlyRows(prevRows => {
      const updated = [...prevRows];
      const row = { ...updated[index] };

      if (['twt_nc', 'ir_nc', 'ubl_nc', 'z652_nc', 'oc_nc'].includes(field)) {
        row[field] = value === '' ? 0 : (parseInt(value, 10) || 0);
      } else if (['twt_fare', 'twt_penalty', 'ir_fare', 'ir_penalty', 'ubl_amt', 'gst', 'z652_amt', 'oc_amt'].includes(field)) {
        row[field] = value === '' ? 0 : (parseFloat(value) || 0);
      } else {
        row[field] = value;
      }

      updated[index] = recalcRow(row);
      return updated;
    });

    setHasUnsavedChanges(true);
  };

  // Helper to filter rows based on dutyFilter
  const filterRows = (rows) => {
    if (!Array.isArray(rows)) return [];
    return rows.filter(row => {
      if (row.staff_name && row.staff_name.includes('VACANT')) return false;

      if (dutyFilter === 'booked_only') {
        return row.is_booked_to_duty;
      } else if (dutyFilter === 'on_duty') {
        // Booked + Outstation
        return !row.is_rest;
      }
      // 'all' includes REST
      return true;
    });
  };

  // Compute subtotal for a list of rows
  const computeSubtotal = (rows) => {
    const list = filterRows(rows);
    return {
      count: list.length,
      twt_nc: list.reduce((s, r) => s + (parseInt(r.twt_nc, 10) || 0), 0),
      twt_fare: list.reduce((s, r) => s + (parseFloat(r.twt_fare) || 0), 0),
      twt_penalty: list.reduce((s, r) => s + (parseFloat(r.twt_penalty) || 0), 0),
      ir_nc: list.reduce((s, r) => s + (parseInt(r.ir_nc, 10) || 0), 0),
      ir_fare: list.reduce((s, r) => s + (parseFloat(r.ir_fare) || 0), 0),
      ir_penalty: list.reduce((s, r) => s + (parseFloat(r.ir_penalty) || 0), 0),
      ubl_nc: list.reduce((s, r) => s + (parseInt(r.ubl_nc, 10) || 0), 0),
      ubl_amt: list.reduce((s, r) => s + (parseFloat(r.ubl_amt) || 0), 0),
      nc_eff_nc: list.reduce((s, r) => s + (parseInt(r.nc_eff_nc, 10) || 0), 0),
      nc_eff_amt: list.reduce((s, r) => s + (parseFloat(r.nc_eff_amt) || 0), 0),
      gst: list.reduce((s, r) => s + (parseFloat(r.gst) || 0), 0),
      z652_nc: list.reduce((s, r) => s + (parseInt(r.z652_nc, 10) || 0), 0),
      z652_amt: list.reduce((s, r) => s + (parseFloat(r.z652_amt) || 0), 0),
      oc_nc: list.reduce((s, r) => s + (parseInt(r.oc_nc, 10) || 0), 0),
      oc_amt: list.reduce((s, r) => s + (parseFloat(r.oc_amt) || 0), 0),
      nc_gtot_nc: list.reduce((s, r) => s + (parseInt(r.nc_gtot_nc, 10) || 0), 0),
      nc_gtot_amt: list.reduce((s, r) => s + (parseFloat(r.nc_gtot_amt) || 0), 0)
    };
  };

  // Grand total for continuous view across all days
  const continuousGrandTotal = useMemo(() => {
    let allRows = [];
    rangeDays.forEach(d => {
      allRows = allRows.concat(filterRows(d.rows));
    });
    return computeSubtotal(allRows);
  }, [rangeDays, dutyFilter]);

  const autoSaveTimerRef = useRef(null);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);

  // Save changes (supports explicit click and automatic background save)
  const handleSave = async (silent = false) => {
    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    isSavingRef.current = true;
    setSaving(true);
    if (!silent) setStatusMsg('⏳ Saving Daily Earnings sheet...');

    try {
      if (viewMode === 'continuous') {
        const payloadDays = rangeDays.map(d => ({
          date: d.date,
          entries: d.rows
        }));

        try {
          localStorage.setItem(`railway_daily_earnings_cont_${rangeStartDate}_${rangeEndDate}`, JSON.stringify(payloadDays));
        } catch (e) {}

        const res = await fetch(`${API_BASE}/documents/daily-earnings/range`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ days: payloadDays })
        });

        const result = await res.json();
        if (res.ok) {
          const timeStr = new Date().toLocaleTimeString();
          setStatusMsg(`✅ Changes saved automatically (${timeStr})`);
          setHasUnsavedChanges(false);
        } else {
          if (!silent) setStatusMsg(`❌ Save failed: ${result.error || 'Unknown error'}`);
        }
      } else if (viewMode === 'single_day') {
        try {
          localStorage.setItem(`railway_daily_earnings_single_${singleDate}`, JSON.stringify(singleRows));
        } catch (e) {}

        const res = await fetch(`${API_BASE}/documents/daily-earnings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            date: singleDate,
            depot_title: depotTitle,
            entries: singleRows
          })
        });

        const result = await res.json();
        if (res.ok) {
          const timeStr = new Date().toLocaleTimeString();
          setStatusMsg(`✅ Changes saved automatically (${timeStr})`);
          setHasUnsavedChanges(false);
        } else {
          if (!silent) setStatusMsg(`❌ Save failed: ${result.error || 'Unknown error'}`);
        }
      } else {
        try {
          localStorage.setItem(`railway_daily_earnings_monthly_${selectedStaffId}_${year}_${month}`, JSON.stringify(monthlyRows));
        } catch (e) {}

        const res = await fetch(`${API_BASE}/documents/daily-earnings/staff/${selectedStaffId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            year,
            month,
            entries: monthlyRows
          })
        });

        const result = await res.json();
        if (res.ok) {
          const timeStr = new Date().toLocaleTimeString();
          setStatusMsg(`✅ Changes saved automatically (${timeStr})`);
          setHasUnsavedChanges(false);
        } else {
          if (!silent) setStatusMsg(`❌ Save failed: ${result.error || 'Unknown error'}`);
        }
      }
    } catch (err) {
      console.error('Error saving earnings:', err);
      if (!silent) setStatusMsg(`❌ Save failed: ${err.message}`);
    } finally {
      setSaving(false);
      isSavingRef.current = false;
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        handleSave(true);
      }
    }
  };

  // Debounced auto-save on any cell edit (1200ms)
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave(true);
    }, 1200);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [hasUnsavedChanges, rangeDays, singleRows, monthlyRows]);

  // Emergency auto-save on beforeunload
  useEffect(() => {
    const onBeforeUnload = () => {
      if (hasUnsavedChanges) {
        try {
          if (viewMode === 'continuous' && rangeDays?.length) {
            localStorage.setItem(`railway_daily_earnings_cont_${rangeStartDate}_${rangeEndDate}`, JSON.stringify(rangeDays));
          } else if (viewMode === 'single_day' && singleRows?.length) {
            localStorage.setItem(`railway_daily_earnings_single_${singleDate}`, JSON.stringify(singleRows));
          } else if (viewMode === 'monthly' && monthlyRows?.length) {
            localStorage.setItem(`railway_daily_earnings_monthly_${selectedStaffId}_${year}_${month}`, JSON.stringify(monthlyRows));
          }
        } catch (e) {}
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges, viewMode, rangeDays, singleRows, monthlyRows, rangeStartDate, rangeEndDate, singleDate, selectedStaffId, year, month]);

  // Quick helper to jump to single date
  const jumpToSingleDay = (dateIso) => {
    setSingleDate(dateIso);
    setViewMode('single_day');
  };

  const currentEmpName = monthlyData?.employee?.name || staffList.find(s => s.id.toString() === selectedStaffId?.toString())?.name || 'Staff Member';
  const currentEmpDesig = monthlyData?.employee?.designation || staffList.find(s => s.id.toString() === selectedStaffId?.toString())?.designation || 'TTI';

  return (
    <div className="daily-earnings-container" style={{ width: '100%', maxWidth: '100%', margin: '0 auto', paddingBottom: '60px' }}>
      
      {/* Mode Switcher Tabs */}
      <div className="no-print" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        marginBottom: '16px',
        flexWrap: 'wrap'
      }}>
        <button
          type="button"
          onClick={() => setViewMode('continuous')}
          className="btn"
          style={{
            padding: '10px 24px',
            borderRadius: '24px',
            fontWeight: 800,
            fontSize: '0.92rem',
            background: viewMode === 'continuous'
              ? 'linear-gradient(135deg, var(--primary), var(--primary-hover))'
              : 'var(--bg-secondary)',
            color: viewMode === 'continuous' ? '#0D0D0F' : 'var(--color-text-secondary)',
            border: viewMode === 'continuous' ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
            boxShadow: viewMode === 'continuous' ? '0 4px 16px rgba(212, 161, 92, 0.4)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          📆 Daily Summary Register (Continuous Multi-Day Sheet)
        </button>

        <button
          type="button"
          onClick={() => setViewMode('single_day')}
          className="btn"
          style={{
            padding: '10px 24px',
            borderRadius: '24px',
            fontWeight: 800,
            fontSize: '0.92rem',
            background: viewMode === 'single_day'
              ? 'linear-gradient(135deg, var(--primary), var(--primary-hover))'
              : 'var(--bg-secondary)',
            color: viewMode === 'single_day' ? '#0D0D0F' : 'var(--color-text-secondary)',
            border: viewMode === 'single_day' ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
            boxShadow: viewMode === 'single_day' ? '0 4px 16px rgba(212, 161, 92, 0.4)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          📅 Single Day View
        </button>

        <button
          type="button"
          onClick={() => setViewMode('monthly')}
          className="btn"
          style={{
            padding: '10px 24px',
            borderRadius: '24px',
            fontWeight: 800,
            fontSize: '0.92rem',
            background: viewMode === 'monthly'
              ? 'linear-gradient(135deg, var(--primary), var(--primary-hover))'
              : 'var(--bg-secondary)',
            color: viewMode === 'monthly' ? '#0D0D0F' : 'var(--color-text-secondary)',
            border: viewMode === 'monthly' ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
            boxShadow: viewMode === 'monthly' ? '0 4px 16px rgba(212, 161, 92, 0.4)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          👤 Employee Monthly Sheet (Whole Month)
        </button>
      </div>

      {/* Control Panel (Hidden during Print) */}
      <div className="no-print card" style={{
        marginBottom: '20px',
        padding: '18px 24px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          
          {viewMode === 'continuous' ? (
            /* Controls for Continuous Multi-Day Register */
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)' }}>
                📆 Date Range:
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>From:</span>
                <input
                  type="date"
                  className="form-input"
                  value={rangeStartDate}
                  onChange={(e) => setRangeStartDate(e.target.value)}
                  style={{
                    width: '150px',
                    padding: '6px 10px',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-gold)',
                    borderRadius: '8px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>To:</span>
                <input
                  type="date"
                  className="form-input"
                  value={rangeEndDate}
                  onChange={(e) => setRangeEndDate(e.target.value)}
                  style={{
                    width: '150px',
                    padding: '6px 10px',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-gold)',
                    borderRadius: '8px'
                  }}
                />
              </div>

              {/* Quick Range Presets matching TA & NDA */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setRangeStartDate('2026-09-01');
                    setRangeEndDate('2026-09-30');
                  }}
                  style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                >
                  📅 Full Month
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setRangeStartDate('2026-08-11');
                    setRangeEndDate('2026-09-10');
                  }}
                  style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                  title="11th of previous month to 10th of selected month"
                >
                  ⏱️ 11th – 10th (Wage Period)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setRangeStartDate('2026-09-01');
                    setRangeEndDate('2026-09-15');
                  }}
                  style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                >
                  1st – 15th
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setRangeStartDate('2026-09-16');
                    setRangeEndDate('2026-09-30');
                  }}
                  style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                >
                  16th – End
                </button>
              </div>

              {/* Duty Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Filter:</span>
                <select
                  className="select-input"
                  value={dutyFilter}
                  onChange={(e) => setDutyFilter(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '0.85rem', fontWeight: 700, minWidth: '180px', color: 'var(--primary)' }}
                >
                  <option value="on_duty">🚆 On Duty Only (Active Working)</option>
                  <option value="booked_only">⭐ Booked to Duty (Starting HQ)</option>
                  <option value="all">📋 All Staff (Including REST)</option>
                </select>
              </div>

              {/* Category Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Category:</span>
                <select
                  className="select-input"
                  value={activeCategoryId}
                  onChange={(e) => setActiveCategoryId(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '0.85rem', minWidth: '130px' }}
                >
                  <option value="all">All Categories</option>
                  {categories && categories.map(cat => (
                    <option key={cat.id} value={cat.id.toString()}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : viewMode === 'single_day' ? (
            /* Controls for Single Day Mode */
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)' }}>
                📅 Sheet Date:
              </span>
              <input
                type="date"
                className="form-input"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                style={{
                  width: '160px',
                  padding: '6px 12px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-gold)',
                  borderRadius: '8px'
                }}
              />
              <select
                className="select-input"
                value={dutyFilter}
                onChange={(e) => setDutyFilter(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '0.85rem', fontWeight: 700, minWidth: '180px' }}
              >
                <option value="on_duty">🚆 On Duty Only</option>
                <option value="booked_only">⭐ Booked to Duty Only</option>
                <option value="all">📋 All Staff (Including REST)</option>
              </select>
            </div>
          ) : (
            /* Controls for Monthly Mode */
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>👤 Employee:</span>
                <select
                  className="select-input"
                  value={selectedStaffId}
                  onChange={(e) => {
                    if (setSelectedStaffId) setSelectedStaffId(e.target.value);
                  }}
                  style={{ padding: '6px 12px', fontSize: '0.88rem', fontWeight: 700, minWidth: '220px', color: 'var(--primary)' }}
                >
                  {[...staffList]
                    .sort((a, b) => (a.name || '').trim().localeCompare((b.name || '').trim()))
                    .map(s => (
                      <option key={s.id} value={s.id.toString()}>
                        {s.name} ({s.designation || 'TTI'}) [Link #{s.row_position}]
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Month:</span>
                <select
                  className="select-input"
                  value={month}
                  onChange={(e) => {
                    if (setMonth) setMonth(e.target.value);
                  }}
                  style={{ padding: '6px 12px', fontSize: '0.85rem', minWidth: '120px' }}
                >
                  {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, idx) => (
                    <option key={idx + 1} value={(idx + 1).toString()}>{m}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Year:</span>
                <select
                  className="select-input"
                  value={year}
                  onChange={(e) => {
                    if (setYear) setYear(e.target.value);
                  }}
                  style={{ padding: '6px 12px', fontSize: '0.85rem', minWidth: '85px' }}
                >
                  {['2025', '2026', '2027', '2028'].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '8px 18px',
                fontSize: '0.88rem',
                fontWeight: 700,
                boxShadow: hasUnsavedChanges ? '0 0 16px var(--primary-glow-strong)' : 'none'
              }}
            >
              {saving ? '⏳ Saving...' : hasUnsavedChanges ? '💾 Save Changes *' : '💾 Save Sheet'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => window.print()}
              style={{ padding: '8px 16px', fontSize: '0.88rem', fontWeight: 600 }}
            >
              🖨️ Print / PDF
            </button>
          </div>
        </div>

        {/* Status Msg */}
        {statusMsg && (
          <div style={{
            marginTop: '12px',
            padding: '8px 14px',
            borderRadius: '6px',
            fontSize: '0.88rem',
            fontWeight: 600,
            background: statusMsg.includes('❌') ? 'rgba(189, 90, 90, 0.15)' : 'rgba(104, 166, 125, 0.15)',
            color: statusMsg.includes('❌') ? '#f87171' : '#68A67D',
            border: `1px solid ${statusMsg.includes('❌') ? 'rgba(189, 90, 90, 0.3)' : 'rgba(104, 166, 125, 0.3)'}`
          }}>
            {statusMsg}
          </div>
        )}
      </div>

      {loading ? (
        <div className="spinner-container">
          <div className="spinner"></div>
          <span>Loading Daily Summary Register...</span>
        </div>
      ) : viewMode === 'continuous' ? (
        /* ========================================================================================= */
        /* VIEW 1: CONTINUOUS MULTI-DAY REGISTER (EXACT FORMAT MATCHING USER SPREADSHEET SCREENSHOT) */
        /* ========================================================================================= */
        <div className="daily-earnings-sheet-paper" style={{
          background: '#FFFFFF',
          color: '#000000',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 4px 25px rgba(0,0,0,0.15)',
          overflowX: 'auto',
          border: '1px solid #C0C0C0',
          fontFamily: 'Arial, sans-serif'
        }}>
          {rangeDays.map((dayData, dayIdx) => {
            const filteredRows = filterRows(dayData.rows);
            const daySubtotal = computeSubtotal(dayData.rows);

            return (
              <div key={dayData.date || dayIdx} style={{ marginBottom: '20px' }}>
                <table className="daily-earnings-table" style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '11px',
                  textAlign: 'center',
                  color: '#000000',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #777'
                }}>
                  {dayIdx === 0 && (
                    <thead>
                      {/* Top Header Group Row */}
                      <tr style={{ backgroundColor: '#F0F0F0', borderTop: '2px solid #000000', borderBottom: '1px solid #000000' }}>
                        <th style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, width: '85px', fontSize: '11px' }}>
                          {depotTitle}
                        </th>
                        <th style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, width: '75px', fontSize: '11px' }}>
                          DATE
                        </th>
                        <th style={{ border: '1px solid #777', padding: '5px 8px', fontWeight: 800, textAlign: 'left', minWidth: '160px', fontSize: '11px' }}>
                          NAME
                        </th>
                        <th style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, width: '45px', fontSize: '11px' }}>
                          DESIG
                        </th>

                        {/* TWT Group */}
                        <th colSpan="3" style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, fontSize: '11px', backgroundColor: '#EBEBEB' }}>
                          TWT
                        </th>

                        {/* IR Group */}
                        <th colSpan="3" style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, fontSize: '11px', backgroundColor: '#EBEBEB' }}>
                          IR
                        </th>

                        {/* UBL Group */}
                        <th colSpan="2" style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, fontSize: '11px', backgroundColor: '#EBEBEB' }}>
                          UBL
                        </th>

                        {/* NC-EFF-AMT (Cyan) */}
                        <th colSpan="2" style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, fontSize: '11px', backgroundColor: '#00E5FF', color: '#000000' }}>
                          NC-EFF-AMT
                        </th>

                        {/* GST */}
                        <th style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, width: '45px', fontSize: '11px' }}>
                          GST
                        </th>

                        {/* Z652 */}
                        <th colSpan="2" style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, fontSize: '11px', backgroundColor: '#EBEBEB' }}>
                          Z652
                        </th>

                        {/* OC Group */}
                        <th colSpan="2" style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, fontSize: '11px', backgroundColor: '#EBEBEB' }}>
                          OC
                        </th>

                        {/* NC-GTOT-AMT (Cyan) */}
                        <th colSpan="2" style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, fontSize: '11px', backgroundColor: '#00E5FF', color: '#000000' }}>
                          NC-GTOT-AMT
                        </th>

                        {/* DUTY */}
                        <th style={{ border: '1px solid #777', padding: '5px 6px', fontWeight: 800, width: '80px', fontSize: '11px' }}>
                          DUTY
                        </th>
                      </tr>

                      {/* Sub-Header Row */}
                      <tr style={{ backgroundColor: '#F8F8F8', borderBottom: '1px solid #000000', fontSize: '10px', fontWeight: 700 }}>
                        <th style={{ border: '1px solid #999', padding: '3px' }}></th>
                        <th style={{ border: '1px solid #999', padding: '3px' }}></th>
                        <th style={{ border: '1px solid #999', padding: '3px' }}></th>
                        <th style={{ border: '1px solid #999', padding: '3px' }}></th>

                        {/* TWT Sub */}
                        <th style={{ border: '1px solid #999', padding: '3px', width: '32px' }}>NC</th>
                        <th style={{ border: '1px solid #999', padding: '3px', width: '48px' }}>FARE</th>
                        <th style={{ border: '1px solid #999', padding: '3px', width: '52px' }}>PENALTY</th>

                        {/* IR Sub */}
                        <th style={{ border: '1px solid #999', padding: '3px', width: '32px' }}>NC</th>
                        <th style={{ border: '1px solid #999', padding: '3px', width: '48px' }}>FARE</th>
                        <th style={{ border: '1px solid #999', padding: '3px', width: '52px' }}>PENALTY</th>

                        {/* UBL Sub */}
                        <th style={{ border: '1px solid #999', padding: '3px', width: '32px' }}>NC</th>
                        <th style={{ border: '1px solid #999', padding: '3px', width: '45px' }}>AMT</th>

                        {/* NC-EFF-AMT Sub (Cyan) */}
                        <th style={{ border: '1px solid #999', padding: '3px', width: '34px', backgroundColor: '#B2EBF2' }}>0</th>
                        <th style={{ border: '1px solid #999', padding: '3px', width: '55px', backgroundColor: '#B2EBF2' }}>0</th>

                        {/* GST */}
                        <th style={{ border: '1px solid #999', padding: '3px' }}></th>

                        {/* Z652 Sub */}
                        <th style={{ border: '1px solid #999', padding: '3px', width: '32px' }}>NC</th>
                        <th style={{ border: '1px solid #999', padding: '3px', width: '45px' }}>AMT</th>

                        {/* OC Sub */}
                        <th style={{ border: '1px solid #999', padding: '3px', width: '32px' }}>NC</th>
                        <th style={{ border: '1px solid #999', padding: '3px', width: '50px' }}>AMT</th>

                        {/* NC-GTOT-AMT Sub (Cyan) */}
                        <th style={{ border: '1px solid #999', padding: '3px', width: '34px', backgroundColor: '#B2EBF2' }}>0</th>
                        <th style={{ border: '1px solid #999', padding: '3px', width: '55px', backgroundColor: '#B2EBF2' }}>0</th>

                        {/* DUTY */}
                        <th style={{ border: '1px solid #999', padding: '3px' }}></th>
                      </tr>
                    </thead>
                  )}

                  <tbody>
                    {filteredRows.map((row, rIdx) => (
                      <tr key={row.staff_id || rIdx} style={{ height: '24px', backgroundColor: rIdx % 2 === 0 ? '#FFFFFF' : '#FBFBFB' }}>
                        {/* Date Column 1: Yellow Merged Badge for Day */}
                        {rIdx === 0 ? (
                          <td
                            rowSpan={filteredRows.length}
                            style={{
                              border: '1px solid #777',
                              padding: '4px',
                              backgroundColor: '#FFE600',
                              color: '#000000',
                              fontWeight: 900,
                              fontSize: '11px',
                              verticalAlign: 'middle',
                              width: '85px'
                            }}
                          >
                            <div style={{ fontSize: '11px' }}>{dayData.date_formatted}</div>
                            <div style={{ fontSize: '9px', marginTop: '3px', textTransform: 'uppercase', color: dayData.day_of_week === 'SUNDAY' ? '#C86B6B' : '#000' }}>
                              {dayData.day_of_week}
                            </div>
                          </td>
                        ) : null}

                        {/* Column 2: Date */}
                        <td style={{ border: '1px solid #CCC', padding: '2px 4px', fontSize: '10px', color: '#333' }}>
                          {dayData.date_formatted}
                        </td>

                        {/* Column 3: Name */}
                        <td style={{ border: '1px solid #CCC', padding: '2px 8px', textAlign: 'left', fontWeight: 800, fontSize: '11px', color: '#000' }}>
                          {row.staff_name}
                        </td>

                        {/* Column 4: Designation */}
                        <td style={{ border: '1px solid #CCC', padding: '2px 4px', fontWeight: 600, fontSize: '10px', color: '#444' }}>
                          {row.designation || 'TTI'}
                        </td>

                        {/* TWT: NC */}
                        <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                          <input
                            type="number"
                            value={row.twt_nc || ''}
                            onChange={(e) => handleContinuousCellChange(dayIdx, row.staff_id, 'twt_nc', e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }}
                          />
                        </td>

                        {/* TWT: FARE */}
                        <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                          <input
                            type="number"
                            value={row.twt_fare || ''}
                            onChange={(e) => handleContinuousCellChange(dayIdx, row.staff_id, 'twt_fare', e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }}
                          />
                        </td>

                        {/* TWT: PENALTY */}
                        <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                          <input
                            type="number"
                            value={row.twt_penalty || ''}
                            onChange={(e) => handleContinuousCellChange(dayIdx, row.staff_id, 'twt_penalty', e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }}
                          />
                        </td>

                        {/* IR: NC */}
                        <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                          <input
                            type="number"
                            value={row.ir_nc || ''}
                            onChange={(e) => handleContinuousCellChange(dayIdx, row.staff_id, 'ir_nc', e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }}
                          />
                        </td>

                        {/* IR: FARE */}
                        <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                          <input
                            type="number"
                            value={row.ir_fare || ''}
                            onChange={(e) => handleContinuousCellChange(dayIdx, row.staff_id, 'ir_fare', e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }}
                          />
                        </td>

                        {/* IR: PENALTY */}
                        <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                          <input
                            type="number"
                            value={row.ir_penalty || ''}
                            onChange={(e) => handleContinuousCellChange(dayIdx, row.staff_id, 'ir_penalty', e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }}
                          />
                        </td>

                        {/* UBL: NC */}
                        <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                          <input
                            type="number"
                            value={row.ubl_nc || ''}
                            onChange={(e) => handleContinuousCellChange(dayIdx, row.staff_id, 'ubl_nc', e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }}
                          />
                        </td>

                        {/* UBL: AMT */}
                        <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                          <input
                            type="number"
                            value={row.ubl_amt || ''}
                            onChange={(e) => handleContinuousCellChange(dayIdx, row.staff_id, 'ubl_amt', e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }}
                          />
                        </td>

                        {/* NC-EFF-AMT: NC (Cyan) */}
                        <td style={{ border: '1px solid #00B0FF', backgroundColor: '#00E5FF', color: '#000', fontWeight: 700, fontSize: '11px', padding: '2px' }}>
                          {row.nc_eff_nc || 0}
                        </td>

                        {/* NC-EFF-AMT: AMT (Cyan) */}
                        <td style={{ border: '1px solid #00B0FF', backgroundColor: '#00E5FF', color: '#000', fontWeight: 700, fontSize: '11px', padding: '2px' }}>
                          {row.nc_eff_amt ? row.nc_eff_amt.toLocaleString('en-IN') : 0}
                        </td>

                        {/* GST */}
                        <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                          <input
                            type="number"
                            value={row.gst || ''}
                            onChange={(e) => handleContinuousCellChange(dayIdx, row.staff_id, 'gst', e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }}
                          />
                        </td>

                        {/* Z652: NC */}
                        <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                          <input
                            type="number"
                            value={row.z652_nc || ''}
                            onChange={(e) => handleContinuousCellChange(dayIdx, row.staff_id, 'z652_nc', e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }}
                          />
                        </td>

                        {/* Z652: AMT */}
                        <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                          <input
                            type="number"
                            value={row.z652_amt || ''}
                            onChange={(e) => handleContinuousCellChange(dayIdx, row.staff_id, 'z652_amt', e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }}
                          />
                        </td>

                        {/* OC: NC */}
                        <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                          <input
                            type="number"
                            value={row.oc_nc || ''}
                            onChange={(e) => handleContinuousCellChange(dayIdx, row.staff_id, 'oc_nc', e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }}
                          />
                        </td>

                        {/* OC: AMT */}
                        <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                          <input
                            type="number"
                            value={row.oc_amt || ''}
                            onChange={(e) => handleContinuousCellChange(dayIdx, row.staff_id, 'oc_amt', e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }}
                          />
                        </td>

                        {/* NC-GTOT-AMT: NC (Cyan) */}
                        <td style={{ border: '1px solid #00B0FF', backgroundColor: '#00E5FF', color: '#000', fontWeight: 700, fontSize: '11px', padding: '2px' }}>
                          {row.nc_gtot_nc || 0}
                        </td>

                        {/* NC-GTOT-AMT: AMT (Cyan) */}
                        <td style={{ border: '1px solid #00B0FF', backgroundColor: '#00E5FF', color: '#000', fontWeight: 800, fontSize: '11px', padding: '2px' }}>
                          {row.nc_gtot_amt ? row.nc_gtot_amt.toLocaleString('en-IN') : 0}
                        </td>

                        {/* DUTY */}
                        <td style={{
                          border: '1px solid #CCC',
                          padding: '2px 4px',
                          fontWeight: 800,
                          fontSize: '10px',
                          color: row.duty === 'REST' ? '#888' : '#000',
                          backgroundColor: row.duty === 'REST' ? '#F0F0F0' : 'transparent'
                        }}>
                          {row.duty || ''}
                        </td>
                      </tr>
                    ))}

                    {/* DAY TOTAL ROW (Yellow) */}
                    <tr style={{
                      backgroundColor: '#FFE600',
                      color: '#000000',
                      fontWeight: 800,
                      fontSize: '11px',
                      borderTop: '2px solid #000000',
                      borderBottom: '2px solid #000000',
                      height: '26px'
                    }}>
                      <td style={{ border: '1px solid #777', padding: '3px', fontSize: '10px' }}>
                        {dayData.date_formatted}
                      </td>
                      <td colSpan="3" style={{ border: '1px solid #777', padding: '3px 8px', textAlign: 'left', fontWeight: 900, fontSize: '11px', letterSpacing: '0.5px' }}>
                        TOTAL
                      </td>

                      {/* TWT Subtotals */}
                      <td style={{ border: '1px solid #777', padding: '3px' }}>{daySubtotal.twt_nc}</td>
                      <td style={{ border: '1px solid #777', padding: '3px' }}>{daySubtotal.twt_fare ? daySubtotal.twt_fare.toLocaleString('en-IN') : 0}</td>
                      <td style={{ border: '1px solid #777', padding: '3px' }}>{daySubtotal.twt_penalty ? daySubtotal.twt_penalty.toLocaleString('en-IN') : 0}</td>

                      {/* IR Subtotals */}
                      <td style={{ border: '1px solid #777', padding: '3px' }}>{daySubtotal.ir_nc}</td>
                      <td style={{ border: '1px solid #777', padding: '3px' }}>{daySubtotal.ir_fare ? daySubtotal.ir_fare.toLocaleString('en-IN') : 0}</td>
                      <td style={{ border: '1px solid #777', padding: '3px' }}>{daySubtotal.ir_penalty ? daySubtotal.ir_penalty.toLocaleString('en-IN') : 0}</td>

                      {/* UBL Subtotals */}
                      <td style={{ border: '1px solid #777', padding: '3px' }}>{daySubtotal.ubl_nc}</td>
                      <td style={{ border: '1px solid #777', padding: '3px' }}>{daySubtotal.ubl_amt ? daySubtotal.ubl_amt.toLocaleString('en-IN') : 0}</td>

                      {/* NC-EFF-AMT Subtotals (Cyan) */}
                      <td style={{ border: '1px solid #00B0FF', padding: '3px', backgroundColor: '#00E5FF', fontWeight: 900 }}>{daySubtotal.nc_eff_nc}</td>
                      <td style={{ border: '1px solid #00B0FF', padding: '3px', backgroundColor: '#00E5FF', fontWeight: 900 }}>{daySubtotal.nc_eff_amt ? daySubtotal.nc_eff_amt.toLocaleString('en-IN') : 0}</td>

                      {/* GST */}
                      <td style={{ border: '1px solid #777', padding: '3px' }}>{daySubtotal.gst ? daySubtotal.gst.toLocaleString('en-IN') : 0}</td>

                      {/* Z652 */}
                      <td style={{ border: '1px solid #777', padding: '3px' }}>{daySubtotal.z652_nc}</td>
                      <td style={{ border: '1px solid #777', padding: '3px' }}>{daySubtotal.z652_amt ? daySubtotal.z652_amt.toLocaleString('en-IN') : 0}</td>

                      {/* OC */}
                      <td style={{ border: '1px solid #777', padding: '3px' }}>{daySubtotal.oc_nc}</td>
                      <td style={{ border: '1px solid #777', padding: '3px' }}>{daySubtotal.oc_amt ? daySubtotal.oc_amt.toLocaleString('en-IN') : 0}</td>

                      {/* NC-GTOT-AMT Subtotals (Cyan) */}
                      <td style={{ border: '1px solid #00B0FF', padding: '3px', backgroundColor: '#00E5FF', fontWeight: 900 }}>{daySubtotal.nc_gtot_nc}</td>
                      <td style={{ border: '1px solid #00B0FF', padding: '3px', backgroundColor: '#00E5FF', fontWeight: 900 }}>{daySubtotal.nc_gtot_amt ? daySubtotal.nc_gtot_amt.toLocaleString('en-IN') : 0}</td>

                      <td style={{ border: '1px solid #777', padding: '3px', fontWeight: 800 }}>{filteredRows.filter(r => !r.is_rest).length}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}

          {/* OVERALL GRAND TOTAL ACROSS ALL DAYS IN RANGE */}
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '11px',
            textAlign: 'center',
            color: '#000000',
            backgroundColor: '#FFE600',
            border: '2px solid #000000',
            marginTop: '16px'
          }}>
            <thead>
              <tr style={{ height: '30px', fontWeight: 900 }}>
                <td style={{ border: '1px solid #777', padding: '4px', width: '85px', fontSize: '10px' }}>
                  RANGE TOTAL
                </td>
                <td colSpan="3" style={{ border: '1px solid #777', padding: '4px 10px', textAlign: 'left', fontWeight: 900, fontSize: '11px', letterSpacing: '1px' }}>
                  🌟 GRAND TOTAL ({rangeDays.length} DAYS — {continuousGrandTotal.count} ENTRIES)
                </td>

                {/* TWT Grand Totals */}
                <td style={{ border: '1px solid #777', padding: '4px', width: '32px' }}>{continuousGrandTotal.twt_nc}</td>
                <td style={{ border: '1px solid #777', padding: '4px', width: '48px' }}>{continuousGrandTotal.twt_fare ? continuousGrandTotal.twt_fare.toLocaleString('en-IN') : 0}</td>
                <td style={{ border: '1px solid #777', padding: '4px', width: '52px' }}>{continuousGrandTotal.twt_penalty ? continuousGrandTotal.twt_penalty.toLocaleString('en-IN') : 0}</td>

                {/* IR Grand Totals */}
                <td style={{ border: '1px solid #777', padding: '4px', width: '32px' }}>{continuousGrandTotal.ir_nc}</td>
                <td style={{ border: '1px solid #777', padding: '4px', width: '48px' }}>{continuousGrandTotal.ir_fare ? continuousGrandTotal.ir_fare.toLocaleString('en-IN') : 0}</td>
                <td style={{ border: '1px solid #777', padding: '4px', width: '52px' }}>{continuousGrandTotal.ir_penalty ? continuousGrandTotal.ir_penalty.toLocaleString('en-IN') : 0}</td>

                {/* UBL Grand Totals */}
                <td style={{ border: '1px solid #777', padding: '4px', width: '32px' }}>{continuousGrandTotal.ubl_nc}</td>
                <td style={{ border: '1px solid #777', padding: '4px', width: '45px' }}>{continuousGrandTotal.ubl_amt ? continuousGrandTotal.ubl_amt.toLocaleString('en-IN') : 0}</td>

                {/* NC-EFF-AMT Grand Totals (Cyan) */}
                <td style={{ border: '1px solid #00B0FF', padding: '4px', width: '34px', backgroundColor: '#00E5FF', fontWeight: 900 }}>{continuousGrandTotal.nc_eff_nc}</td>
                <td style={{ border: '1px solid #00B0FF', padding: '4px', width: '55px', backgroundColor: '#00E5FF', fontWeight: 900 }}>{continuousGrandTotal.nc_eff_amt ? continuousGrandTotal.nc_eff_amt.toLocaleString('en-IN') : 0}</td>

                {/* GST */}
                <td style={{ border: '1px solid #777', padding: '4px', width: '45px' }}>{continuousGrandTotal.gst ? continuousGrandTotal.gst.toLocaleString('en-IN') : 0}</td>

                {/* Z652 */}
                <td style={{ border: '1px solid #777', padding: '4px', width: '32px' }}>{continuousGrandTotal.z652_nc}</td>
                <td style={{ border: '1px solid #777', padding: '4px', width: '45px' }}>{continuousGrandTotal.z652_amt ? continuousGrandTotal.z652_amt.toLocaleString('en-IN') : 0}</td>

                {/* OC */}
                <td style={{ border: '1px solid #777', padding: '4px', width: '32px' }}>{continuousGrandTotal.oc_nc}</td>
                <td style={{ border: '1px solid #777', padding: '4px', width: '50px' }}>{continuousGrandTotal.oc_amt ? continuousGrandTotal.oc_amt.toLocaleString('en-IN') : 0}</td>

                {/* NC-GTOT-AMT Grand Totals (Cyan) */}
                <td style={{ border: '1px solid #00B0FF', padding: '4px', width: '34px', backgroundColor: '#00E5FF', fontWeight: 900 }}>{continuousGrandTotal.nc_gtot_nc}</td>
                <td style={{ border: '1px solid #00B0FF', padding: '4px', width: '55px', backgroundColor: '#00E5FF', fontWeight: 900 }}>{continuousGrandTotal.nc_gtot_amt ? continuousGrandTotal.nc_gtot_amt.toLocaleString('en-IN') : 0}</td>

                {/* Duty Column */}
                <td style={{ border: '1px solid #777', padding: '4px', width: '80px', fontWeight: 900 }}>
                  {continuousGrandTotal.count} ENTRIES
                </td>
              </tr>
            </thead>
          </table>
        </div>
      ) : viewMode === 'single_day' ? (
        /* ========================================================================================= */
        /* VIEW 2: SINGLE DAY VIEW                                                                   */
        /* ========================================================================================= */
        <div className="daily-earnings-sheet-paper" style={{
          background: '#FFFFFF',
          color: '#000000',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 4px 25px rgba(0,0,0,0.15)',
          overflowX: 'auto',
          border: '1px solid #C0C0C0',
          fontFamily: 'Arial, sans-serif'
        }}>
          {/* Header Banner */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
            fontSize: '11px',
            color: '#333'
          }}>
            <div><strong>Depot:</strong> {depotTitle} &nbsp;|&nbsp; <strong>Date:</strong> {singleSheetData?.date_formatted || singleDate}</div>
            <div><strong>Staff Count:</strong> {filterRows(singleRows).length} staff</div>
          </div>

          <table className="daily-earnings-table" style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '11px',
            textAlign: 'center',
            color: '#000000',
            backgroundColor: '#FFFFFF',
            border: '1px solid #777'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#F0F0F0', borderTop: '2px solid #000000', borderBottom: '1px solid #000000' }}>
                <th style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, width: '85px', fontSize: '11px' }}>{depotTitle}</th>
                <th style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, width: '75px', fontSize: '11px' }}>DATE</th>
                <th style={{ border: '1px solid #777', padding: '5px 8px', fontWeight: 800, textAlign: 'left', minWidth: '160px', fontSize: '11px' }}>NAME</th>
                <th style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, width: '45px', fontSize: '11px' }}>DESIG</th>
                <th colSpan="3" style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, fontSize: '11px', backgroundColor: '#EBEBEB' }}>TWT</th>
                <th colSpan="3" style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, fontSize: '11px', backgroundColor: '#EBEBEB' }}>IR</th>
                <th colSpan="2" style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, fontSize: '11px', backgroundColor: '#EBEBEB' }}>UBL</th>
                <th colSpan="2" style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, fontSize: '11px', backgroundColor: '#00E5FF', color: '#000000' }}>NC-EFF-AMT</th>
                <th style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, width: '45px', fontSize: '11px' }}>GST</th>
                <th colSpan="2" style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, fontSize: '11px', backgroundColor: '#EBEBEB' }}>Z652</th>
                <th colSpan="2" style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, fontSize: '11px', backgroundColor: '#EBEBEB' }}>OC</th>
                <th colSpan="2" style={{ border: '1px solid #777', padding: '5px 4px', fontWeight: 800, fontSize: '11px', backgroundColor: '#00E5FF', color: '#000000' }}>NC-GTOT-AMT</th>
                <th style={{ border: '1px solid #777', padding: '5px 6px', fontWeight: 800, width: '80px', fontSize: '11px' }}>DUTY</th>
              </tr>
              <tr style={{ backgroundColor: '#F8F8F8', borderBottom: '1px solid #000000', fontSize: '10px', fontWeight: 700 }}>
                <th style={{ border: '1px solid #999', padding: '3px' }}></th>
                <th style={{ border: '1px solid #999', padding: '3px' }}></th>
                <th style={{ border: '1px solid #999', padding: '3px' }}></th>
                <th style={{ border: '1px solid #999', padding: '3px' }}></th>
                <th style={{ border: '1px solid #999', padding: '3px', width: '32px' }}>NC</th>
                <th style={{ border: '1px solid #999', padding: '3px', width: '48px' }}>FARE</th>
                <th style={{ border: '1px solid #999', padding: '3px', width: '52px' }}>PENALTY</th>
                <th style={{ border: '1px solid #999', padding: '3px', width: '32px' }}>NC</th>
                <th style={{ border: '1px solid #999', padding: '3px', width: '48px' }}>FARE</th>
                <th style={{ border: '1px solid #999', padding: '3px', width: '52px' }}>PENALTY</th>
                <th style={{ border: '1px solid #999', padding: '3px', width: '32px' }}>NC</th>
                <th style={{ border: '1px solid #999', padding: '3px', width: '45px' }}>AMT</th>
                <th style={{ border: '1px solid #999', padding: '3px', width: '34px', backgroundColor: '#B2EBF2' }}>0</th>
                <th style={{ border: '1px solid #999', padding: '3px', width: '55px', backgroundColor: '#B2EBF2' }}>0</th>
                <th style={{ border: '1px solid #999', padding: '3px' }}></th>
                <th style={{ border: '1px solid #999', padding: '3px', width: '32px' }}>NC</th>
                <th style={{ border: '1px solid #999', padding: '3px', width: '45px' }}>AMT</th>
                <th style={{ border: '1px solid #999', padding: '3px', width: '32px' }}>NC</th>
                <th style={{ border: '1px solid #999', padding: '3px', width: '50px' }}>AMT</th>
                <th style={{ border: '1px solid #999', padding: '3px', width: '34px', backgroundColor: '#B2EBF2' }}>0</th>
                <th style={{ border: '1px solid #999', padding: '3px', width: '55px', backgroundColor: '#B2EBF2' }}>0</th>
                <th style={{ border: '1px solid #999', padding: '3px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filterRows(singleRows).map((row, idx) => (
                <tr key={row.staff_id || idx} style={{ height: '24px', backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FBFBFB' }}>
                  {idx === 0 ? (
                    <td rowSpan={filterRows(singleRows).length} style={{ border: '1px solid #777', backgroundColor: '#FFE600', color: '#000', fontWeight: 900, fontSize: '11px', verticalAlign: 'middle', width: '85px' }}>
                      <div>{singleSheetData?.date_formatted || singleDate}</div>
                      <div style={{ fontSize: '9px', marginTop: '3px' }}>{singleSheetData?.day_of_week}</div>
                    </td>
                  ) : null}
                  <td style={{ border: '1px solid #CCC', padding: '2px 4px', fontSize: '10px' }}>{singleSheetData?.date_formatted || singleDate}</td>
                  <td style={{ border: '1px solid #CCC', padding: '2px 8px', textAlign: 'left', fontWeight: 800, fontSize: '11px' }}>{row.staff_name}</td>
                  <td style={{ border: '1px solid #CCC', padding: '2px 4px', fontWeight: 600, fontSize: '10px' }}>{row.designation || 'TTI'}</td>
                  
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.twt_nc || ''} onChange={(e) => handleSingleDayCellChange(row.staff_id, 'twt_nc', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.twt_fare || ''} onChange={(e) => handleSingleDayCellChange(row.staff_id, 'twt_fare', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.twt_penalty || ''} onChange={(e) => handleSingleDayCellChange(row.staff_id, 'twt_penalty', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.ir_nc || ''} onChange={(e) => handleSingleDayCellChange(row.staff_id, 'ir_nc', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.ir_fare || ''} onChange={(e) => handleSingleDayCellChange(row.staff_id, 'ir_fare', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.ir_penalty || ''} onChange={(e) => handleSingleDayCellChange(row.staff_id, 'ir_penalty', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.ubl_nc || ''} onChange={(e) => handleSingleDayCellChange(row.staff_id, 'ubl_nc', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.ubl_amt || ''} onChange={(e) => handleSingleDayCellChange(row.staff_id, 'ubl_amt', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #00B0FF', backgroundColor: '#00E5FF', fontWeight: 700, padding: '2px' }}>{row.nc_eff_nc || 0}</td>
                  <td style={{ border: '1px solid #00B0FF', backgroundColor: '#00E5FF', fontWeight: 700, padding: '2px' }}>{row.nc_eff_amt ? row.nc_eff_amt.toLocaleString('en-IN') : 0}</td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.gst || ''} onChange={(e) => handleSingleDayCellChange(row.staff_id, 'gst', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.z652_nc || ''} onChange={(e) => handleSingleDayCellChange(row.staff_id, 'z652_nc', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.z652_amt || ''} onChange={(e) => handleSingleDayCellChange(row.staff_id, 'z652_amt', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.oc_nc || ''} onChange={(e) => handleSingleDayCellChange(row.staff_id, 'oc_nc', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.oc_amt || ''} onChange={(e) => handleSingleDayCellChange(row.staff_id, 'oc_amt', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #00B0FF', backgroundColor: '#00E5FF', fontWeight: 700, padding: '2px' }}>{row.nc_gtot_nc || 0}</td>
                  <td style={{ border: '1px solid #00B0FF', backgroundColor: '#00E5FF', fontWeight: 800, padding: '2px' }}>{row.nc_gtot_amt ? row.nc_gtot_amt.toLocaleString('en-IN') : 0}</td>
                  <td style={{ border: '1px solid #CCC', padding: '2px 4px', fontWeight: 800, fontSize: '10px' }}>{row.duty || ''}</td>
                </tr>
              ))}
              {/* Day Total */}
              <tr style={{ backgroundColor: '#FFE600', color: '#000', fontWeight: 900, height: '26px' }}>
                <td style={{ border: '1px solid #777', padding: '3px' }}>{singleSheetData?.date_formatted || singleDate}</td>
                <td colSpan="3" style={{ border: '1px solid #777', padding: '3px 8px', textAlign: 'left' }}>TOTAL</td>
                <td style={{ border: '1px solid #777' }}>{computeSubtotal(singleRows).twt_nc}</td>
                <td style={{ border: '1px solid #777' }}>{computeSubtotal(singleRows).twt_fare.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #777' }}>{computeSubtotal(singleRows).twt_penalty.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #777' }}>{computeSubtotal(singleRows).ir_nc}</td>
                <td style={{ border: '1px solid #777' }}>{computeSubtotal(singleRows).ir_fare.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #777' }}>{computeSubtotal(singleRows).ir_penalty.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #777' }}>{computeSubtotal(singleRows).ubl_nc}</td>
                <td style={{ border: '1px solid #777' }}>{computeSubtotal(singleRows).ubl_amt.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #00B0FF', backgroundColor: '#00E5FF' }}>{computeSubtotal(singleRows).nc_eff_nc}</td>
                <td style={{ border: '1px solid #00B0FF', backgroundColor: '#00E5FF' }}>{computeSubtotal(singleRows).nc_eff_amt.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #777' }}>{computeSubtotal(singleRows).gst.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #777' }}>{computeSubtotal(singleRows).z652_nc}</td>
                <td style={{ border: '1px solid #777' }}>{computeSubtotal(singleRows).z652_amt.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #777' }}>{computeSubtotal(singleRows).oc_nc}</td>
                <td style={{ border: '1px solid #777' }}>{computeSubtotal(singleRows).oc_amt.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #00B0FF', backgroundColor: '#00E5FF' }}>{computeSubtotal(singleRows).nc_gtot_nc}</td>
                <td style={{ border: '1px solid #00B0FF', backgroundColor: '#00E5FF' }}>{computeSubtotal(singleRows).nc_gtot_amt.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #777' }}>{filterRows(singleRows).filter(r => !r.is_rest).length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        /* ========================================================================================= */
        /* VIEW 3: INDIVIDUAL EMPLOYEE MONTHLY SHEET                                                 */
        /* ========================================================================================= */
        <div className="daily-earnings-sheet-paper" style={{
          background: '#FFFFFF',
          color: '#000000',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 4px 25px rgba(0,0,0,0.15)',
          overflowX: 'auto',
          border: '1px solid #C0C0C0',
          fontFamily: 'Arial, sans-serif'
        }}>
          {/* Employee Header Banner */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
            padding: '10px 16px',
            background: '#F5F5F5',
            border: '1px solid #DDD',
            borderRadius: '6px'
          }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#000', textTransform: 'uppercase' }}>
                👤 {currentEmpName}
              </span>
              <span style={{ fontSize: '11px', color: '#555', marginLeft: '12px', fontWeight: 600 }}>
                DESIG: {currentEmpDesig} | HQ: {monthlyData?.employee?.hq_station || 'GNT'} | BILL UNIT: {monthlyData?.employee?.bill_unit || '0910629'}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#000' }}>
                MONTH: {monthlyData?.month_name?.toUpperCase() || month} {year}
              </span>
            </div>
          </div>

          <table className="daily-earnings-table" style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '11px',
            textAlign: 'center',
            color: '#000000',
            backgroundColor: '#FFFFFF',
            border: '1px solid #777'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#F0F0F0', borderTop: '2px solid #000000', borderBottom: '1px solid #000000' }}>
                <th style={{ border: '1px solid #777', padding: '6px 4px', fontWeight: 800, width: '75px', fontSize: '11px' }}>DATE</th>
                <th style={{ border: '1px solid #777', padding: '6px 4px', fontWeight: 800, width: '80px', fontSize: '11px' }}>DAY</th>
                <th style={{ border: '1px solid #777', padding: '6px 6px', fontWeight: 800, width: '75px', fontSize: '11px' }}>DUTY</th>
                <th colSpan="3" style={{ border: '1px solid #777', padding: '6px 4px', fontWeight: 800, fontSize: '11px', backgroundColor: '#EBEBEB' }}>TWT</th>
                <th colSpan="3" style={{ border: '1px solid #777', padding: '6px 4px', fontWeight: 800, fontSize: '11px', backgroundColor: '#EBEBEB' }}>IR</th>
                <th colSpan="2" style={{ border: '1px solid #777', padding: '6px 4px', fontWeight: 800, fontSize: '11px', backgroundColor: '#EBEBEB' }}>UBL</th>
                <th colSpan="2" style={{ border: '1px solid #777', padding: '6px 4px', fontWeight: 800, fontSize: '11px', backgroundColor: '#00E5FF', color: '#000000' }}>NC-EFF-AMT</th>
                <th style={{ border: '1px solid #777', padding: '6px 4px', fontWeight: 800, width: '45px', fontSize: '11px' }}>GST</th>
                <th colSpan="2" style={{ border: '1px solid #777', padding: '6px 4px', fontWeight: 800, fontSize: '11px', backgroundColor: '#EBEBEB' }}>Z652</th>
                <th colSpan="2" style={{ border: '1px solid #777', padding: '6px 4px', fontWeight: 800, fontSize: '11px', backgroundColor: '#EBEBEB' }}>OC</th>
                <th colSpan="2" style={{ border: '1px solid #777', padding: '6px 4px', fontWeight: 800, fontSize: '11px', backgroundColor: '#00E5FF', color: '#000000' }}>NC-GTOT-AMT</th>
                <th style={{ border: '1px solid #777', padding: '6px 6px', fontWeight: 800, width: '80px', fontSize: '11px' }}>REMARKS</th>
                <th className="no-print" style={{ border: '1px solid #777', padding: '6px 4px', width: '35px' }}></th>
              </tr>
              <tr style={{ backgroundColor: '#F8F8F8', borderBottom: '1px solid #000000', fontSize: '10px', fontWeight: 700 }}>
                <th style={{ border: '1px solid #999', padding: '4px' }}></th>
                <th style={{ border: '1px solid #999', padding: '4px' }}></th>
                <th style={{ border: '1px solid #999', padding: '4px' }}></th>
                <th style={{ border: '1px solid #999', padding: '4px', width: '32px' }}>NC</th>
                <th style={{ border: '1px solid #999', padding: '4px', width: '48px' }}>FARE</th>
                <th style={{ border: '1px solid #999', padding: '4px', width: '52px' }}>PENALTY</th>
                <th style={{ border: '1px solid #999', padding: '4px', width: '32px' }}>NC</th>
                <th style={{ border: '1px solid #999', padding: '4px', width: '48px' }}>FARE</th>
                <th style={{ border: '1px solid #999', padding: '4px', width: '52px' }}>PENALTY</th>
                <th style={{ border: '1px solid #999', padding: '4px', width: '32px' }}>NC</th>
                <th style={{ border: '1px solid #999', padding: '4px', width: '45px' }}>AMT</th>
                <th style={{ border: '1px solid #999', padding: '4px', width: '34px', backgroundColor: '#B2EBF2' }}>0</th>
                <th style={{ border: '1px solid #999', padding: '4px', width: '55px', backgroundColor: '#B2EBF2' }}>0</th>
                <th style={{ border: '1px solid #999', padding: '4px' }}></th>
                <th style={{ border: '1px solid #999', padding: '4px', width: '32px' }}>NC</th>
                <th style={{ border: '1px solid #999', padding: '4px', width: '45px' }}>AMT</th>
                <th style={{ border: '1px solid #999', padding: '4px', width: '32px' }}>NC</th>
                <th style={{ border: '1px solid #999', padding: '4px', width: '50px' }}>AMT</th>
                <th style={{ border: '1px solid #999', padding: '4px', width: '34px', backgroundColor: '#B2EBF2' }}>0</th>
                <th style={{ border: '1px solid #999', padding: '4px', width: '55px', backgroundColor: '#B2EBF2' }}>0</th>
                <th style={{ border: '1px solid #999', padding: '4px' }}></th>
                <th className="no-print" style={{ border: '1px solid #999', padding: '4px' }}></th>
              </tr>
            </thead>
            <tbody>
              {monthlyRows.map((row, idx) => (
                <tr key={row.date || idx} style={{ height: '26px', backgroundColor: row.is_rest ? '#F5F5F5' : idx % 2 === 0 ? '#FFFFFF' : '#FBFBFB' }}>
                  <td style={{ border: '1px solid #CCC', padding: '2px 4px', fontSize: '10px', fontWeight: 700, color: '#000' }}>{row.date_formatted}</td>
                  <td style={{ border: '1px solid #CCC', padding: '2px 4px', fontSize: '10px', fontWeight: 600, color: row.day_of_week === 'SUNDAY' ? '#C86B6B' : '#555' }}>{row.day_of_week}</td>
                  <td style={{ border: '1px solid #CCC', padding: '2px 4px', fontWeight: 800, fontSize: '10px', color: row.duty === 'REST' ? '#888' : '#000' }}>{row.duty || ''}</td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.twt_nc || ''} onChange={(e) => handleMonthlyCellChange(idx, 'twt_nc', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.twt_fare || ''} onChange={(e) => handleMonthlyCellChange(idx, 'twt_fare', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.twt_penalty || ''} onChange={(e) => handleMonthlyCellChange(idx, 'twt_penalty', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.ir_nc || ''} onChange={(e) => handleMonthlyCellChange(idx, 'ir_nc', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.ir_fare || ''} onChange={(e) => handleMonthlyCellChange(idx, 'ir_fare', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.ir_penalty || ''} onChange={(e) => handleMonthlyCellChange(idx, 'ir_penalty', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.ubl_nc || ''} onChange={(e) => handleMonthlyCellChange(idx, 'ubl_nc', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.ubl_amt || ''} onChange={(e) => handleMonthlyCellChange(idx, 'ubl_amt', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #00B0FF', backgroundColor: '#00E5FF', fontWeight: 700, padding: '2px' }}>{row.nc_eff_nc || 0}</td>
                  <td style={{ border: '1px solid #00B0FF', backgroundColor: '#00E5FF', fontWeight: 700, padding: '2px' }}>{row.nc_eff_amt ? row.nc_eff_amt.toLocaleString('en-IN') : 0}</td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.gst || ''} onChange={(e) => handleMonthlyCellChange(idx, 'gst', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.z652_nc || ''} onChange={(e) => handleMonthlyCellChange(idx, 'z652_nc', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.z652_amt || ''} onChange={(e) => handleMonthlyCellChange(idx, 'z652_amt', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.oc_nc || ''} onChange={(e) => handleMonthlyCellChange(idx, 'oc_nc', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="number" value={row.oc_amt || ''} onChange={(e) => handleMonthlyCellChange(idx, 'oc_amt', e.target.value)} placeholder="0" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '11px', outline: 'none' }} />
                  </td>
                  <td style={{ border: '1px solid #00B0FF', backgroundColor: '#00E5FF', fontWeight: 700, padding: '2px' }}>{row.nc_gtot_nc || 0}</td>
                  <td style={{ border: '1px solid #00B0FF', backgroundColor: '#00E5FF', fontWeight: 800, padding: '2px' }}>{row.nc_gtot_amt ? row.nc_gtot_amt.toLocaleString('en-IN') : 0}</td>
                  <td style={{ border: '1px solid #CCC', padding: '1px' }}>
                    <input type="text" value={row.remarks || ''} onChange={(e) => handleMonthlyCellChange(idx, 'remarks', e.target.value)} placeholder="-" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '10px', outline: 'none' }} />
                  </td>
                  <td className="no-print" style={{ border: '1px solid #DDD', padding: '1px' }}>
                    <button type="button" onClick={() => jumpToSingleDay(row.date)} style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontWeight: 700, fontSize: '10px', padding: '2px 4px' }} title="Open this date">👁️</button>
                  </td>
                </tr>
              ))}
              {/* Monthly Total */}
              <tr style={{ backgroundColor: '#FFE600', color: '#000000', fontWeight: 800, fontSize: '11px', height: '28px' }}>
                <td colSpan="3" style={{ border: '1px solid #777', padding: '4px 8px', textAlign: 'left', fontWeight: 900 }}>MONTHLY TOTAL ({monthlyRows.length} DAYS)</td>
                <td style={{ border: '1px solid #777', padding: '4px' }}>{computeSubtotal(monthlyRows).twt_nc}</td>
                <td style={{ border: '1px solid #777', padding: '4px' }}>{computeSubtotal(monthlyRows).twt_fare.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #777', padding: '4px' }}>{computeSubtotal(monthlyRows).twt_penalty.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #777', padding: '4px' }}>{computeSubtotal(monthlyRows).ir_nc}</td>
                <td style={{ border: '1px solid #777', padding: '4px' }}>{computeSubtotal(monthlyRows).ir_fare.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #777', padding: '4px' }}>{computeSubtotal(monthlyRows).ir_penalty.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #777', padding: '4px' }}>{computeSubtotal(monthlyRows).ubl_nc}</td>
                <td style={{ border: '1px solid #777', padding: '4px' }}>{computeSubtotal(monthlyRows).ubl_amt.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #00B0FF', padding: '4px', backgroundColor: '#00E5FF', fontWeight: 900 }}>{computeSubtotal(monthlyRows).nc_eff_nc}</td>
                <td style={{ border: '1px solid #00B0FF', padding: '4px', backgroundColor: '#00E5FF', fontWeight: 900 }}>{computeSubtotal(monthlyRows).nc_eff_amt.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #777', padding: '4px' }}>{computeSubtotal(monthlyRows).gst.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #777', padding: '4px' }}>{computeSubtotal(monthlyRows).z652_nc}</td>
                <td style={{ border: '1px solid #777', padding: '4px' }}>{computeSubtotal(monthlyRows).z652_amt.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #777', padding: '4px' }}>{computeSubtotal(monthlyRows).oc_nc}</td>
                <td style={{ border: '1px solid #777', padding: '4px' }}>{computeSubtotal(monthlyRows).oc_amt.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #00B0FF', padding: '4px', backgroundColor: '#00E5FF', fontWeight: 900 }}>{computeSubtotal(monthlyRows).nc_gtot_nc}</td>
                <td style={{ border: '1px solid #00B0FF', padding: '4px', backgroundColor: '#00E5FF', fontWeight: 900 }}>{computeSubtotal(monthlyRows).nc_gtot_amt.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #777', padding: '4px' }}></td>
                <td className="no-print" style={{ border: '1px solid #777', padding: '4px' }}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Floating Save Button & Status on Every Screen & Scroll Position */}
      {(rangeDays.length > 0 || singleRows.length > 0 || monthlyRows.length > 0) && (
        <div className="no-print" style={{
          position: 'fixed',
          bottom: '24px',
          right: '28px',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(20, 20, 24, 0.95)',
          border: hasUnsavedChanges ? '2px solid #f59e0b' : '1.5px solid var(--border-gold)',
          padding: '10px 18px',
          borderRadius: '30px',
          boxShadow: '0 10px 35px rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(10px)'
        }}>
          {saving ? (
            <span style={{ color: '#60a5fa', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid #60a5fa', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
              Saving automatically...
            </span>
          ) : hasUnsavedChanges ? (
            <span style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600 }}>
              ⚠️ Unsaved edits (Auto-saving...)
            </span>
          ) : (
            <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>
              ✅ All changes saved permanently
            </span>
          )}
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="btn btn-primary"
            style={{
              fontSize: '0.85rem',
              padding: '6px 18px',
              borderRadius: '20px',
              fontWeight: 700,
              background: hasUnsavedChanges ? 'linear-gradient(135deg, #e5a93c 0%, #d48b1e 100%)' : 'var(--primary)',
              boxShadow: hasUnsavedChanges ? '0 0 12px rgba(245, 158, 11, 0.6)' : 'none'
            }}
            title="Save now (auto-saves automatically on edit)"
          >
            {saving ? 'Saving...' : '💾 Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
