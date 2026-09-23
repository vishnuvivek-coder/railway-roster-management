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

export default function DiaryDocument({
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
      return localStorage.getItem('railway_diary_period_preset') || 'full_month';
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
    try { localStorage.setItem('railway_diary_period_preset', preset); } catch (e) {}
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
  const [diaryData, setDiaryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [syncingNtes, setSyncingNtes] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Editable header meta
  const [editableMeta, setEditableMeta] = useState({
    name: 'K V R RAO',
    designation: 'CTI',
    t_code_no: '7133'
  });

  // Editable Page 2 bottom summary breakdown metadata
  const [summaryMeta, setSummaryMeta] = useState({
    nw_days: 25,
    hp_cases: 3,
    hp_amount: 3737,
    hp_gst: 1584,
    hp_total: 5320,
    it_cases: 5,
    it_amount: 6824,
    it_gst: 2356,
    it_total: 9180,
    oc_cases: 71,
    oc_amount: 50270
  });

  // Auto-initialize selectedCatId if categories are loaded
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

  // Fetch Diary Statement whenever staff, month, year, or date range changes
  const fetchDiary = () => {
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

    fetch(`${API_BASE}/documents/diary/${selectedStaffId}?${queryParams.toString()}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setDiaryData(data);
          if (data.employee) {
            setEditableMeta({
              name: data.employee.name || 'K V R RAO',
              designation: data.employee.designation || 'CTI',
              t_code_no: data.employee.t_code_no || '7133'
            });
          }
          if (data.summary_breakdown) {
            setSummaryMeta(data.summary_breakdown);
          }
        } else {
          console.error('Diary error:', data?.error);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading diary statement:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (selectedStaffId && startDate && endDate) {
      fetchDiary();
    }
  }, [selectedStaffId, startDate, endDate]);

  // Real-time synchronization across all tabs and documents
  useEffect(() => {
    const handleRosterUpdate = () => {
      if (selectedStaffId && startDate && endDate) {
        fetchDiary();
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
  }, [selectedStaffId, diaryData, editableMeta, summaryMeta, authToken]);

  // Cell key navigation across 18 columns
  const handleCellKeyDown = (e, rowIndex, colIndex) => {
    const TOTAL_COLS = 18;
    const totalRows = (diaryData?.rows?.length || 0);

    if (e.key === 'ArrowRight') {
      if (e.target.selectionStart === e.target.value?.length || e.target.type === 'number') {
        e.preventDefault();
        if (colIndex < TOTAL_COLS - 1) {
          focusCell(rowIndex, colIndex + 1);
        } else if (rowIndex < totalRows - 1) {
          focusCell(rowIndex + 1, 0);
        }
      }
    } else if (e.key === 'ArrowLeft') {
      if (e.target.selectionStart === 0 || e.target.type === 'number') {
        e.preventDefault();
        if (colIndex > 0) {
          focusCell(rowIndex, colIndex - 1);
        } else if (rowIndex > 0) {
          focusCell(rowIndex - 1, TOTAL_COLS - 1);
        }
      }
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      if (rowIndex < totalRows - 1) {
        focusCell(rowIndex + 1, colIndex);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIndex > 0) {
        focusCell(rowIndex - 1, colIndex);
      }
    }
  };

  const focusCell = (r, c) => {
    const input = document.querySelector(`input[data-row="${r}"][data-col="${c}"]`);
    if (input) {
      input.focus();
      if (input.select) input.select();
    }
  };

  // Universal Cell Edit Handler across all 18 columns
  const handleCellChange = (index, field, value) => {
    if (!diaryData) return;
    setHasUnsavedChanges(true);
    const updatedRows = [...(diaryData.rows || [])];
    while (updatedRows.length <= index) {
      updatedRows.push({
        id: null,
        row_order: updatedRows.length + 1,
        date_str: '',
        train_no: '',
        from_station: '',
        to_station: '',
        dep_time: '',
        arr_time: '',
        eft_from: '',
        eft_to: '',
        total_issued: null,
        cases_count: null,
        collected_amount: null,
        gst_cases: null,
        gst_amount: null,
        total_amount: null,
        remit_station: '',
        remit_mr_no: '',
        remit_date: '',
        remit_amount: null
      });
    }
    const currentRow = { ...updatedRows[index] };
    delete currentRow.isEmptyPadding;

    // Numerical columns handling
    const numFields = ['total_issued', 'cases_count', 'collected_amount', 'gst_cases', 'gst_amount', 'total_amount', 'remit_amount'];
    if (numFields.includes(field)) {
      if (value === '' || value === null) {
        currentRow[field] = null;
      } else {
        const parsed = parseFloat(value);
        currentRow[field] = isNaN(parsed) ? 0 : parsed;
      }

      // Auto-sync total_amount with collected + gst if user edits collected/gst
      if (field === 'collected_amount' || field === 'gst_amount') {
        const col = currentRow.collected_amount || 0;
        const gst = currentRow.gst_amount || 0;
        if (col > 0 || gst > 0) {
          currentRow.total_amount = col + gst;
        }
      }
    } else {
      currentRow[field] = value;
    }

    updatedRows[index] = currentRow;

    // Recalculate is_same_date_as_prev flags if date was edited
    if (field === 'date_str') {
      for (let i = 0; i < updatedRows.length; i++) {
        updatedRows[i].is_same_date_as_prev = (i > 0 && updatedRows[i].date_str === updatedRows[i - 1].date_str);
      }
    }

    // Recalculate totals
    const grandTotals = {
      total_issued: updatedRows.reduce((s, r) => s + (r.total_issued || 0), 0),
      total_cases: updatedRows.reduce((s, r) => s + (r.cases_count || 0), 0),
      total_collected: updatedRows.reduce((s, r) => s + (r.collected_amount || 0), 0),
      total_gst_cases: updatedRows.reduce((s, r) => s + (r.gst_cases || 0), 0),
      total_gst_amount: updatedRows.reduce((s, r) => s + (r.gst_amount || 0), 0),
      grand_total_amount: updatedRows.reduce((s, r) => s + (r.total_amount || 0), 0),
      total_remit_amount: updatedRows.reduce((s, r) => s + (r.remit_amount || 0), 0)
    };

    setDiaryData({
      ...diaryData,
      rows: updatedRows,
      grand_totals: grandTotals
    });
  };

  // Header meta change
  const handleMetaChange = (field, val) => {
    setHasUnsavedChanges(true);
    setEditableMeta(prev => ({ ...prev, [field]: val }));
  };

  // Add an extra custom row
  const handleAddRow = () => {
    if (!diaryData) return;
    setHasUnsavedChanges(true);
    const existing = diaryData.rows || [];
    const lastDate = existing.length > 0 ? existing[existing.length - 1].date_str : `1/${month}/${String(year).slice(-2)}`;

    const newRow = {
      id: null,
      row_order: existing.length + 1,
      page_number: existing.length < 24 ? 1 : 2,
      date_str: lastDate,
      date_iso: `${year}-${String(month).padStart(2, '0')}-01`,
      is_same_date_as_prev: existing.length > 0 && existing[existing.length - 1].date_str === lastDate,
      train_no: '',
      from_station: 'GNT',
      to_station: '---',
      dep_time: '',
      arr_time: '',
      eft_from: null,
      eft_to: null,
      total_issued: null,
      cases_count: null,
      collected_amount: null,
      gst_cases: null,
      gst_amount: null,
      total_amount: null,
      remit_station: '',
      remit_mr_no: '',
      remit_date: '',
      remit_amount: null
    };

    const updated = [...existing, newRow];
    setDiaryData({
      ...diaryData,
      rows: updated
    });
  };

  // Sync real-time official arrival & departure timings directly from NTES (enquiry.indianrail.gov.in)
  const handleSyncNtes = async () => {
    if (!diaryData || !diaryData.rows || diaryData.rows.length === 0) return;
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
          legs: diaryData.rows
        })
      });

      const data = await res.json();
      if (res.ok && data.legs) {
        setHasUnsavedChanges(true);

        const updatedRows = data.legs.map(r => ({
          ...r,
          dep_time: r.act_dep || r.dep_time,
          arr_time: r.act_arr || r.arr_time
        }));

        const syncedCount = updatedRows.filter(r => r.is_synced && (r.act_dep !== '---' || r.act_arr !== '---')).length;

        setDiaryData({
          ...diaryData,
          rows: updatedRows
        });

        setStatusMsg(`⚡ Successfully synced ${syncedCount} train timings from Official NTES (enquiry.indianrail.gov.in)!`);
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
    if (!selectedStaffId || !diaryData) return;
    setSaving(true);
    setStatusMsg('');

    try {
      const res = await fetch(`${API_BASE}/documents/diary/${selectedStaffId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          month_year: diaryData.month_year,
          entries: diaryData.rows,
          employee_meta: editableMeta,
          summary_breakdown: summaryMeta
        })
      });

      const data = await res.json();
      if (res.ok) {
        setHasUnsavedChanges(false);
        setStatusMsg('✅ Diary E.F.T Statement & all 18 columns saved successfully!');
        setTimeout(() => setStatusMsg(''), 4500);
      } else {
        alert(data.error || 'Failed to save Diary statement.');
      }
    } catch (err) {
      alert('Error saving Diary statement: ' + err.message);
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
      const res = await fetch(`${API_BASE}/documents/diary/${selectedStaffId}?year=${year}&month=${month}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        setStatusMsg('🔄 Reset to auto-generated master timetable.');
        fetchDiary();
        setTimeout(() => setStatusMsg(''), 4000);
      } else {
        alert('Failed to reset statement.');
      }
    } catch (err) {
      alert('Error resetting diary: ' + err.message);
    } finally {
      setResetting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // 2-Page Partitioning: Page 1 holds up to 24 rows, Page 2 holds up to 20 rows
  const PAGE1_ROW_COUNT = 24;
  const PAGE2_ROW_COUNT = 20;

  const rawRows = diaryData?.rows || [];
  const rawPage1 = rawRows.slice(0, PAGE1_ROW_COUNT);
  const rawPage2 = rawRows.slice(PAGE1_ROW_COUNT);

  // Pad Page 1 up to 24 rows for clean full-page ledger styling
  const page1Rows = [...rawPage1];
  while (page1Rows.length < PAGE1_ROW_COUNT) {
    page1Rows.push({
      isEmptyPadding: true,
      row_order: page1Rows.length + 1,
      date_str: '',
      train_no: '',
      from_station: '',
      to_station: '',
      dep_time: '',
      arr_time: '',
      eft_from: '',
      eft_to: '',
      total_issued: null,
      cases_count: null,
      collected_amount: null,
      gst_cases: null,
      gst_amount: null,
      total_amount: null,
      remit_station: '',
      remit_mr_no: '',
      remit_date: '',
      remit_amount: null
    });
  }

  // Pad Page 2 up to 20 rows for clean full-page ledger styling
  const page2Rows = [...rawPage2];
  while (page2Rows.length < PAGE2_ROW_COUNT) {
    page2Rows.push({
      isEmptyPadding: true,
      row_order: PAGE1_ROW_COUNT + page2Rows.length + 1,
      date_str: '',
      train_no: '',
      from_station: '',
      to_station: '',
      dep_time: '',
      arr_time: '',
      eft_from: '',
      eft_to: '',
      total_issued: null,
      cases_count: null,
      collected_amount: null,
      gst_cases: null,
      gst_amount: null,
      total_amount: null,
      remit_station: '',
      remit_mr_no: '',
      remit_date: '',
      remit_amount: null
    });
  }

  // Page 1 Totals (computed over actual non-empty rows)
  const page1Totals = {
    total_issued: rawPage1.reduce((s, r) => s + (r.total_issued || 0), 0),
    total_cases: rawPage1.reduce((s, r) => s + (r.cases_count || 0), 0),
    total_collected: rawPage1.reduce((s, r) => s + (r.collected_amount || 0), 0),
    total_gst_cases: rawPage1.reduce((s, r) => s + (r.gst_cases || 0), 0),
    total_gst_amount: rawPage1.reduce((s, r) => s + (r.gst_amount || 0), 0),
    grand_total_amount: rawPage1.reduce((s, r) => s + (r.total_amount || 0), 0),
    total_remit_amount: rawPage1.reduce((s, r) => s + (r.remit_amount || 0), 0)
  };

  // Grand Totals (Both Pages)
  const grandTotals = diaryData?.grand_totals || page1Totals;

  const cellInputStyle = {
    width: '100%',
    height: '100%',
    border: 'none',
    background: 'transparent',
    textAlign: 'center',
    fontSize: '9.5px',
    outline: 'none',
    fontFamily: 'inherit',
    color: '#000',
    padding: '2px 1px',
    boxSizing: 'border-box'
  };

  return (
    <div className="diary-document-container" style={{ padding: '12px 14px', maxWidth: '1440px', margin: '0 auto' }}>
      
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
                <span>📔</span> DIARY — E.F.T Earnings Statement
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
                LEGAL LANDSCAPE (14 × 8.5 in)
              </span>
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
              ✨ <strong>100% Full Page Fill & Zero White Spaces</strong>: All 18 columns adjusted proportionally to span the full Legal Landscape sheets seamlessly.
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
              title="Print formatted on LEGAL LANDSCAPE paper size"
            >
              🖨️ Print / Save PDF (Legal Landscape)
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
            <span>Total Issued: <strong style={{ color: '#fbbf24' }}>{grandTotals.total_issued || 0}</strong></span>
            <span style={{ color: 'var(--color-text-muted)' }}>•</span>
            <span>Total Cases: <strong style={{ color: '#fbbf24' }}>{grandTotals.total_cases || 0}</strong></span>
            <span style={{ color: 'var(--color-text-muted)' }}>•</span>
            <span>Grand Total: <strong style={{ color: '#34d399' }}>₹{grandTotals.grand_total_amount || 0}</strong></span>
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
              <span>⚠️</span> Unsaved edits in Diary. Press <strong>Ctrl+S</strong> or click <strong>Save Changes</strong> to store.
            </div>
          ) : (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
              ✓ All edits & calculated EFT earnings saved to database.
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

      {/* Print Stylesheet for LEGAL LANDSCAPE PAPER SIZE (14 × 8.5 in) FIT TO PAGE */}
      <style>{`
        @page {
          size: legal landscape;
          margin: 4mm 6mm;
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
          .diary-document-container {
            padding: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .diary-page-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 3mm 4mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            width: 100% !important;
            max-width: 355.6mm !important;
            height: auto !important;
            margin: 0 auto !important;
            overflow: visible !important;
          }
          .diary-page-sheet:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          input {
            border: none !important;
            background: transparent !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        .diary-cell input:hover {
          background: rgba(212, 161, 92, 0.08) !important;
          border: 1px solid rgba(212, 161, 92, 0.4) !important;
        }
        .diary-cell input:focus {
          background: rgba(212, 161, 92, 0.16) !important;
          border: 1px solid #d4a15c !important;
          box-shadow: 0 0 4px rgba(212, 161, 92, 0.6) !important;
        }
      `}</style>

      {/* ----------------------------------------------------
         OFFICIAL 2-PAGE DIARY / E.F.T EARNINGS STATEMENT (LEGAL LANDSCAPE - 100% FULL PAGE FILL)
         ---------------------------------------------------- */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-secondary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⏳</div>
          Generating Diary Statement...
        </div>
      ) : diaryData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', alignItems: 'center' }}>
          
          {/* ====================================================
             PAGE 1 OF 2 (LEGAL LANDSCAPE - 100% FULL PAGE FILL)
             ==================================================== */}
          <div className="diary-page-sheet" style={{
            background: '#ffffff',
            color: '#000000',
            width: '100%',
            maxWidth: '355.6mm',
            padding: '12px 14px 14px 14px',
            borderRadius: '4px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '9.5px',
            lineHeight: 1.2,
            boxSizing: 'border-box',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header Title Row */}
            <div style={{
              flex: '0 0 auto',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 'bold',
              fontSize: '11.5px',
              marginBottom: '6px',
              paddingBottom: '2px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>E.F.T Earnings Statement of</span>
                <input
                  type="text"
                  value={editableMeta.name}
                  onChange={(e) => handleMetaChange('name', e.target.value)}
                  style={{ fontWeight: 'bold', width: '170px', border: '1px solid transparent', background: 'transparent', outline: 'none', fontSize: '11.5px', padding: '1px 4px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>Designation</span>
                <input
                  type="text"
                  value={editableMeta.designation}
                  onChange={(e) => handleMetaChange('designation', e.target.value)}
                  style={{ fontWeight: 'bold', width: '50px', border: '1px solid transparent', background: 'transparent', outline: 'none', fontSize: '11.5px', padding: '1px 4px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>T.Code.No.</span>
                <input
                  type="text"
                  value={editableMeta.t_code_no}
                  onChange={(e) => handleMetaChange('t_code_no', e.target.value)}
                  style={{ fontWeight: 'bold', width: '60px', border: '1px solid transparent', background: 'transparent', outline: 'none', fontSize: '11.5px', padding: '1px 4px' }}
                />
              </div>

              <div>
                <span>Month of {diaryData.month_name} {diaryData.year}</span>
              </div>

              <div>
                <span>page-1</span>
              </div>
            </div>

            {/* 18-Column Official Table (Page 1) */}
            <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}>
              <table style={{
                width: '100%',
                tableLayout: 'fixed',
                borderCollapse: 'collapse',
                border: '1.5px solid #000',
                textAlign: 'center',
                fontSize: '9px'
              }}>
                <thead>
                  <tr style={{ background: '#ffffff', borderBottom: '1px solid #000', fontWeight: 'bold' }}>
                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '4.5%' }}>DATE</th>
                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '5.5%' }}>TRAIN<br/>NO.</th>
                    <th colSpan="2" style={{ border: '1px solid #000', padding: '1px', width: '9%' }}>STATIONS</th>
                    <th colSpan="2" style={{ border: '1px solid #000', padding: '1px', width: '9%' }}>TIME</th>
                    <th colSpan="2" style={{ border: '1px solid #000', padding: '1px', width: '11.5%' }}>EFT'S ISSUED</th>
                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '5%' }}>TOTAL<br/>ISSUED</th>
                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '5%' }}>No. Of<br/>Cases</th>
                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '6.5%' }}>Collected<br/>E.F.T'S<br/>RS</th>
                    <th colSpan="2" style={{ border: '1px solid #000', padding: '1px', width: '10%' }}>GST</th>
                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '7.5%' }}>Total<br/>Amount of<br/>E.F.T'S &amp;<br/>Coupons</th>
                    <th colSpan="4" style={{ border: '1px solid #000', padding: '1px', width: '26.5%' }}>REMITTANCE PARTICULARS</th>
                  </tr>
                  <tr style={{ background: '#ffffff', borderBottom: '1.5px solid #000', fontWeight: 'bold' }}>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '4.5%' }}>FROM</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '4.5%' }}>TO</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '4.5%' }}>DEP</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '4.5%' }}>ARR</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '6%' }}>FROM</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '5.5%' }}>TO</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '4.5%' }}>TOTAL<br/>CASES</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '5.5%' }}>AMOUNT</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '5.5%' }}>Station</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '8.5%' }}>M.R. NO.</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '5.5%' }}>Date</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '7%' }}>AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {page1Rows.map((row, idx) => (
                    <tr key={idx} style={{ height: '18px' }}>
                      {/* 0. DATE */}
                      <td className="diary-cell" style={{ border: '1px solid #000', padding: 0, fontWeight: row.is_same_date_as_prev ? 'normal' : 'bold' }}>
                        <input
                          type="text"
                          data-row={idx}
                          data-col={0}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 0)}
                          value={row.is_same_date_as_prev ? '"' : (row.date_str || '')}
                          onChange={(e) => handleCellChange(idx, 'date_str', e.target.value)}
                          style={cellInputStyle}
                        />
                      </td>

                      {/* 1. TRAIN NO */}
                      <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        <input
                          type="text"
                          data-row={idx}
                          data-col={1}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 1)}
                          value={row.train_no || ''}
                          onChange={(e) => handleCellChange(idx, 'train_no', e.target.value)}
                          style={cellInputStyle}
                        />
                      </td>

                      {/* 2. STATION FROM */}
                      <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        <input
                          type="text"
                          data-row={idx}
                          data-col={2}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 2)}
                          value={row.from_station || ''}
                          onChange={(e) => handleCellChange(idx, 'from_station', e.target.value)}
                          style={cellInputStyle}
                        />
                      </td>

                      {/* 3. STATION TO */}
                      <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        <input
                          type="text"
                          data-row={idx}
                          data-col={3}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 3)}
                          value={row.to_station || ''}
                          onChange={(e) => handleCellChange(idx, 'to_station', e.target.value)}
                          style={cellInputStyle}
                        />
                      </td>

                      {/* 4. TIME DEP */}
                      <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        <input
                          type="text"
                          data-row={idx}
                          data-col={4}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 4)}
                          value={row.dep_time || ''}
                          onChange={(e) => handleCellChange(idx, 'dep_time', e.target.value)}
                          style={cellInputStyle}
                        />
                      </td>

                      {/* 5. TIME ARR */}
                      <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        <input
                          type="text"
                          data-row={idx}
                          data-col={5}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 5)}
                          value={row.arr_time || ''}
                          onChange={(e) => handleCellChange(idx, 'arr_time', e.target.value)}
                          style={cellInputStyle}
                        />
                      </td>

                      {/* 6. EFT FROM */}
                      <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        <input
                          type="text"
                          data-row={idx}
                          data-col={6}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 6)}
                          value={row.eft_from || ''}
                          onChange={(e) => handleCellChange(idx, 'eft_from', e.target.value)}
                          style={cellInputStyle}
                        />
                      </td>

                      {/* 7. EFT TO */}
                      <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        <input
                          type="text"
                          data-row={idx}
                          data-col={7}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 7)}
                          value={row.eft_to || ''}
                          onChange={(e) => handleCellChange(idx, 'eft_to', e.target.value)}
                          style={cellInputStyle}
                        />
                      </td>

                      {/* 8. TOTAL ISSUED */}
                      <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        <input
                          type="number"
                          data-row={idx}
                          data-col={8}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 8)}
                          value={row.total_issued !== null && row.total_issued !== undefined ? row.total_issued : ''}
                          onChange={(e) => handleCellChange(idx, 'total_issued', e.target.value)}
                          style={cellInputStyle}
                        />
                      </td>

                      {/* 9. NO OF CASES */}
                      <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        <input
                          type="number"
                          data-row={idx}
                          data-col={9}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 9)}
                          value={row.cases_count !== null && row.cases_count !== undefined ? row.cases_count : ''}
                          onChange={(e) => handleCellChange(idx, 'cases_count', e.target.value)}
                          style={cellInputStyle}
                        />
                      </td>

                      {/* 10. COLLECTED EFT RS */}
                      <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        <input
                          type="number"
                          data-row={idx}
                          data-col={10}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 10)}
                          value={row.collected_amount !== null && row.collected_amount !== undefined ? row.collected_amount : ''}
                          onChange={(e) => handleCellChange(idx, 'collected_amount', e.target.value)}
                          style={{ ...cellInputStyle, textAlign: 'right', paddingRight: '2px' }}
                        />
                      </td>

                      {/* 11. GST CASES */}
                      <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        <input
                          type="number"
                          data-row={idx}
                          data-col={11}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 11)}
                          value={row.gst_cases !== null && row.gst_cases !== undefined ? row.gst_cases : ''}
                          onChange={(e) => handleCellChange(idx, 'gst_cases', e.target.value)}
                          style={cellInputStyle}
                        />
                      </td>

                      {/* 12. GST AMOUNT */}
                      <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        <input
                          type="number"
                          data-row={idx}
                          data-col={12}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 12)}
                          value={row.gst_amount !== null && row.gst_amount !== undefined ? row.gst_amount : ''}
                          onChange={(e) => handleCellChange(idx, 'gst_amount', e.target.value)}
                          style={{ ...cellInputStyle, textAlign: 'right', paddingRight: '2px' }}
                        />
                      </td>

                      {/* 13. TOTAL AMOUNT */}
                      <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        <input
                          type="number"
                          data-row={idx}
                          data-col={13}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 13)}
                          value={row.total_amount !== null && row.total_amount !== undefined ? row.total_amount : ''}
                          onChange={(e) => handleCellChange(idx, 'total_amount', e.target.value)}
                          style={{ ...cellInputStyle, textAlign: 'right', fontWeight: 'bold', paddingRight: '2px' }}
                        />
                      </td>

                      {/* 14. REMITTANCE STATION */}
                      <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        <input
                          type="text"
                          data-row={idx}
                          data-col={14}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 14)}
                          value={row.remit_station || ''}
                          onChange={(e) => handleCellChange(idx, 'remit_station', e.target.value)}
                          style={cellInputStyle}
                        />
                      </td>

                      {/* 15. REMITTANCE MR NO */}
                      <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        <input
                          type="text"
                          data-row={idx}
                          data-col={15}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 15)}
                          value={row.remit_mr_no || ''}
                          onChange={(e) => handleCellChange(idx, 'remit_mr_no', e.target.value)}
                          style={cellInputStyle}
                        />
                      </td>

                      {/* 16. REMITTANCE DATE */}
                      <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        <input
                          type="text"
                          data-row={idx}
                          data-col={16}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 16)}
                          value={row.remit_date || ''}
                          onChange={(e) => handleCellChange(idx, 'remit_date', e.target.value)}
                          style={cellInputStyle}
                        />
                      </td>

                      {/* 17. REMITTANCE AMOUNT */}
                      <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        <input
                          type="number"
                          data-row={idx}
                          data-col={17}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 17)}
                          value={row.remit_amount !== null && row.remit_amount !== undefined ? row.remit_amount : ''}
                          onChange={(e) => handleCellChange(idx, 'remit_amount', e.target.value)}
                          style={{ ...cellInputStyle, textAlign: 'right', fontWeight: 'bold', paddingRight: '2px' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Page 1 Subtotals Footer */}
                <tfoot>
                  <tr style={{ background: '#ffffff', fontWeight: 'bold', borderTop: '1.5px solid #000', height: '22px' }}>
                    <td colSpan="8" style={{ border: '1px solid #000', textAlign: 'center', fontSize: '9.5px' }}>TOTAL (PAGE 1)</td>
                    <td style={{ border: '1px solid #000', fontSize: '9.5px' }}>{page1Totals.total_issued || ''}</td>
                    <td style={{ border: '1px solid #000', fontSize: '9.5px' }}>{page1Totals.total_cases || ''}</td>
                    <td style={{ border: '1px solid #000', fontSize: '9.5px', textAlign: 'right', paddingRight: '2px' }}>{page1Totals.total_collected || ''}</td>
                    <td style={{ border: '1px solid #000', fontSize: '9.5px' }}>{page1Totals.total_gst_cases || ''}</td>
                    <td style={{ border: '1px solid #000', fontSize: '9.5px', textAlign: 'right', paddingRight: '2px' }}>{page1Totals.total_gst_amount || ''}</td>
                    <td style={{ border: '1px solid #000', fontSize: '9.5px', textAlign: 'right', paddingRight: '2px', background: 'rgba(212, 161, 92, 0.08)' }}>{page1Totals.grand_total_amount || ''}</td>
                    <td colSpan="3" style={{ border: '1px solid #000' }}></td>
                    <td style={{ border: '1px solid #000', fontSize: '9.5px', textAlign: 'right', paddingRight: '2px' }}>{page1Totals.total_remit_amount || ''}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>


          {/* ====================================================
             PAGE 2 OF 2 (LEGAL LANDSCAPE - 100% FULL PAGE FILL)
             ==================================================== */}
          <div className="diary-page-sheet" style={{
            background: '#ffffff',
            color: '#000000',
            width: '100%',
            maxWidth: '355.6mm',
            padding: '12px 14px 14px 14px',
            borderRadius: '4px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '9.5px',
            lineHeight: 1.2,
            boxSizing: 'border-box',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header Title Row */}
            <div style={{
              flex: '0 0 auto',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 'bold',
              fontSize: '11.5px',
              marginBottom: '6px',
              paddingBottom: '2px'
            }}>
              <div>
                <span>Month of {diaryData.month_name} {diaryData.year}</span>
              </div>
              <div>
                <span>page-2</span>
              </div>
            </div>

            {/* 18-Column Official Table (Page 2) */}
            <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}>
              <table style={{
                width: '100%',
                tableLayout: 'fixed',
                borderCollapse: 'collapse',
                border: '1.5px solid #000',
                textAlign: 'center',
                fontSize: '9px'
              }}>
                <thead>
                  <tr style={{ background: '#ffffff', borderBottom: '1px solid #000', fontWeight: 'bold' }}>
                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '4.5%' }}>DATE</th>
                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '5.5%' }}>TRAIN<br/>NO.</th>
                    <th colSpan="2" style={{ border: '1px solid #000', padding: '1px', width: '9%' }}>STATIONS</th>
                    <th colSpan="2" style={{ border: '1px solid #000', padding: '1px', width: '9%' }}>TIME</th>
                    <th colSpan="2" style={{ border: '1px solid #000', padding: '1px', width: '11.5%' }}>EFT'S ISSUED</th>
                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '5%' }}>TOTAL<br/>ISSUED</th>
                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '5%' }}>No. Of<br/>Cases</th>
                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '6.5%' }}>Collected<br/>E.F.T'S<br/>RS</th>
                    <th colSpan="2" style={{ border: '1px solid #000', padding: '1px', width: '10%' }}>GST</th>
                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '7.5%' }}>Total<br/>Amount of<br/>E.F.T'S &amp;<br/>Coupons</th>
                    <th colSpan="4" style={{ border: '1px solid #000', padding: '1px', width: '26.5%' }}>REMITTANCE PARTICULARS</th>
                  </tr>
                  <tr style={{ background: '#ffffff', borderBottom: '1.5px solid #000', fontWeight: 'bold' }}>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '4.5%' }}>FROM</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '4.5%' }}>TO</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '4.5%' }}>DEP</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '4.5%' }}>ARR</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '6%' }}>FROM</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '5.5%' }}>TO</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '4.5%' }}>TOTAL<br/>CASES</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '5.5%' }}>AMOUNT</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '5.5%' }}>Station</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '8.5%' }}>M.R. NO.</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '5.5%' }}>Date</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '7%' }}>AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {/* B/F row */}
                  <tr style={{ height: '21px', fontWeight: 'bold', background: 'rgba(212, 161, 92, 0.04)' }}>
                    <td colSpan="8" style={{ border: '1px solid #000', textAlign: 'center', fontSize: '9.5px' }}>B/F (BROUGHT FORWARD FROM PAGE 1)</td>
                    <td style={{ border: '1px solid #000', fontSize: '9.5px' }}>{page1Totals.total_issued || ''}</td>
                    <td style={{ border: '1px solid #000', fontSize: '9.5px' }}>{page1Totals.total_cases || ''}</td>
                    <td style={{ border: '1px solid #000', fontSize: '9.5px', textAlign: 'right', paddingRight: '2px' }}>{page1Totals.total_collected || ''}</td>
                    <td style={{ border: '1px solid #000', fontSize: '9.5px' }}>{page1Totals.total_gst_cases || ''}</td>
                    <td style={{ border: '1px solid #000', fontSize: '9.5px', textAlign: 'right', paddingRight: '2px' }}>{page1Totals.total_gst_amount || ''}</td>
                    <td style={{ border: '1px solid #000', fontSize: '9.5px', textAlign: 'right', paddingRight: '2px' }}>{page1Totals.grand_total_amount || ''}</td>
                    <td colSpan="3" style={{ border: '1px solid #000' }}></td>
                    <td style={{ border: '1px solid #000', fontSize: '9.5px', textAlign: 'right', paddingRight: '2px' }}>{page1Totals.total_remit_amount || ''}</td>
                  </tr>

                  {page2Rows.map((row, p2Idx) => {
                    const actualIdx = PAGE1_ROW_COUNT + p2Idx;
                    return (
                      <tr key={`p2-${p2Idx}`} style={{ height: '21px' }}>
                        {/* 0. DATE */}
                        <td className="diary-cell" style={{ border: '1px solid #000', padding: 0, fontWeight: row.is_same_date_as_prev ? 'normal' : 'bold' }}>
                          <input
                            type="text"
                            data-row={actualIdx}
                            data-col={0}
                            onKeyDown={(e) => handleCellKeyDown(e, actualIdx, 0)}
                            value={row.is_same_date_as_prev ? '"' : (row.date_str || '')}
                            onChange={(e) => handleCellChange(actualIdx, 'date_str', e.target.value)}
                            style={cellInputStyle}
                          />
                        </td>

                        {/* 1. TRAIN NO */}
                        <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          <input
                            type="text"
                            data-row={actualIdx}
                            data-col={1}
                            onKeyDown={(e) => handleCellKeyDown(e, actualIdx, 1)}
                            value={row.train_no || ''}
                            onChange={(e) => handleCellChange(actualIdx, 'train_no', e.target.value)}
                            style={cellInputStyle}
                          />
                        </td>

                        {/* 2. STATION FROM */}
                        <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          <input
                            type="text"
                            data-row={actualIdx}
                            data-col={2}
                            onKeyDown={(e) => handleCellKeyDown(e, actualIdx, 2)}
                            value={row.from_station || ''}
                            onChange={(e) => handleCellChange(actualIdx, 'from_station', e.target.value)}
                            style={cellInputStyle}
                          />
                        </td>

                        {/* 3. STATION TO */}
                        <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          <input
                            type="text"
                            data-row={actualIdx}
                            data-col={3}
                            onKeyDown={(e) => handleCellKeyDown(e, actualIdx, 3)}
                            value={row.to_station || ''}
                            onChange={(e) => handleCellChange(actualIdx, 'to_station', e.target.value)}
                            style={cellInputStyle}
                          />
                        </td>

                        {/* 4. TIME DEP */}
                        <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          <input
                            type="text"
                            data-row={actualIdx}
                            data-col={4}
                            onKeyDown={(e) => handleCellKeyDown(e, actualIdx, 4)}
                            value={row.dep_time || ''}
                            onChange={(e) => handleCellChange(actualIdx, 'dep_time', e.target.value)}
                            style={cellInputStyle}
                          />
                        </td>

                        {/* 5. TIME ARR */}
                        <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          <input
                            type="text"
                            data-row={actualIdx}
                            data-col={5}
                            onKeyDown={(e) => handleCellKeyDown(e, actualIdx, 5)}
                            value={row.arr_time || ''}
                            onChange={(e) => handleCellChange(actualIdx, 'arr_time', e.target.value)}
                            style={cellInputStyle}
                          />
                        </td>

                        {/* 6. EFT FROM */}
                        <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          <input
                            type="text"
                            data-row={actualIdx}
                            data-col={6}
                            onKeyDown={(e) => handleCellKeyDown(e, actualIdx, 6)}
                            value={row.eft_from || ''}
                            onChange={(e) => handleCellChange(actualIdx, 'eft_from', e.target.value)}
                            style={cellInputStyle}
                          />
                        </td>

                        {/* 7. EFT TO */}
                        <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          <input
                            type="text"
                            data-row={actualIdx}
                            data-col={7}
                            onKeyDown={(e) => handleCellKeyDown(e, actualIdx, 7)}
                            value={row.eft_to || ''}
                            onChange={(e) => handleCellChange(actualIdx, 'eft_to', e.target.value)}
                            style={cellInputStyle}
                          />
                        </td>

                        {/* 8. TOTAL ISSUED */}
                        <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          <input
                            type="number"
                            data-row={actualIdx}
                            data-col={8}
                            onKeyDown={(e) => handleCellKeyDown(e, actualIdx, 8)}
                            value={row.total_issued !== null && row.total_issued !== undefined ? row.total_issued : ''}
                            onChange={(e) => handleCellChange(actualIdx, 'total_issued', e.target.value)}
                            style={cellInputStyle}
                          />
                        </td>

                        {/* 9. NO OF CASES */}
                        <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          <input
                            type="number"
                            data-row={actualIdx}
                            data-col={9}
                            onKeyDown={(e) => handleCellKeyDown(e, actualIdx, 9)}
                            value={row.cases_count !== null && row.cases_count !== undefined ? row.cases_count : ''}
                            onChange={(e) => handleCellChange(actualIdx, 'cases_count', e.target.value)}
                            style={cellInputStyle}
                          />
                        </td>

                        {/* 10. COLLECTED EFT RS */}
                        <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          <input
                            type="number"
                            data-row={actualIdx}
                            data-col={10}
                            onKeyDown={(e) => handleCellKeyDown(e, actualIdx, 10)}
                            value={row.collected_amount !== null && row.collected_amount !== undefined ? row.collected_amount : ''}
                            onChange={(e) => handleCellChange(actualIdx, 'collected_amount', e.target.value)}
                            style={{ ...cellInputStyle, textAlign: 'right', paddingRight: '2px' }}
                          />
                        </td>

                        {/* 11. GST CASES */}
                        <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          <input
                            type="number"
                            data-row={actualIdx}
                            data-col={11}
                            onKeyDown={(e) => handleCellKeyDown(e, actualIdx, 11)}
                            value={row.gst_cases !== null && row.gst_cases !== undefined ? row.gst_cases : ''}
                            onChange={(e) => handleCellChange(actualIdx, 'gst_cases', e.target.value)}
                            style={cellInputStyle}
                          />
                        </td>

                        {/* 12. GST AMOUNT */}
                        <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          <input
                            type="number"
                            data-row={actualIdx}
                            data-col={12}
                            onKeyDown={(e) => handleCellKeyDown(e, actualIdx, 12)}
                            value={row.gst_amount !== null && row.gst_amount !== undefined ? row.gst_amount : ''}
                            onChange={(e) => handleCellChange(actualIdx, 'gst_amount', e.target.value)}
                            style={{ ...cellInputStyle, textAlign: 'right', paddingRight: '2px' }}
                          />
                        </td>

                        {/* 13. TOTAL AMOUNT */}
                        <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          <input
                            type="number"
                            data-row={actualIdx}
                            data-col={13}
                            onKeyDown={(e) => handleCellKeyDown(e, actualIdx, 13)}
                            value={row.total_amount !== null && row.total_amount !== undefined ? row.total_amount : ''}
                            onChange={(e) => handleCellChange(actualIdx, 'total_amount', e.target.value)}
                            style={{ ...cellInputStyle, textAlign: 'right', fontWeight: 'bold', paddingRight: '2px' }}
                          />
                        </td>

                        {/* 14. REMITTANCE STATION */}
                        <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          <input
                            type="text"
                            data-row={actualIdx}
                            data-col={14}
                            onKeyDown={(e) => handleCellKeyDown(e, actualIdx, 14)}
                            value={row.remit_station || ''}
                            onChange={(e) => handleCellChange(actualIdx, 'remit_station', e.target.value)}
                            style={cellInputStyle}
                          />
                        </td>

                        {/* 15. REMITTANCE MR NO */}
                        <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          <input
                            type="text"
                            data-row={actualIdx}
                            data-col={15}
                            onKeyDown={(e) => handleCellKeyDown(e, actualIdx, 15)}
                            value={row.remit_mr_no || ''}
                            onChange={(e) => handleCellChange(actualIdx, 'remit_mr_no', e.target.value)}
                            style={cellInputStyle}
                          />
                        </td>

                        {/* 16. REMITTANCE DATE */}
                        <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          <input
                            type="text"
                            data-row={actualIdx}
                            data-col={16}
                            onKeyDown={(e) => handleCellKeyDown(e, actualIdx, 16)}
                            value={row.remit_date || ''}
                            onChange={(e) => handleCellChange(actualIdx, 'remit_date', e.target.value)}
                            style={cellInputStyle}
                          />
                        </td>

                        {/* 17. REMITTANCE AMOUNT */}
                        <td className="diary-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          <input
                            type="number"
                            data-row={actualIdx}
                            data-col={17}
                            onKeyDown={(e) => handleCellKeyDown(e, actualIdx, 17)}
                            value={row.remit_amount !== null && row.remit_amount !== undefined ? row.remit_amount : ''}
                            onChange={(e) => handleCellChange(actualIdx, 'remit_amount', e.target.value)}
                            style={{ ...cellInputStyle, textAlign: 'right', fontWeight: 'bold', paddingRight: '2px' }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Page 2 Grand Totals Footer */}
                <tfoot>
                  <tr style={{ background: '#ffffff', fontWeight: 'bold', borderTop: '1.5px solid #000', height: '22px' }}>
                    <td colSpan="8" style={{ border: '1px solid #000', textAlign: 'center', fontSize: '9.5px' }}>GRAND TOTAL</td>
                    <td style={{ border: '1px solid #000', fontSize: '9.5px' }}>{grandTotals.total_issued || ''}</td>
                    <td style={{ border: '1px solid #000', fontSize: '9.5px' }}>{grandTotals.total_cases || ''}</td>
                    <td style={{ border: '1px solid #000', fontSize: '9.5px', textAlign: 'right', paddingRight: '2px' }}>{grandTotals.total_collected || ''}</td>
                    <td style={{ border: '1px solid #000', fontSize: '9.5px' }}>{grandTotals.total_gst_cases || ''}</td>
                    <td style={{ border: '1px solid #000', fontSize: '9.5px', textAlign: 'right', paddingRight: '2px' }}>{grandTotals.total_gst_amount || ''}</td>
                    <td style={{ border: '1px solid #000', fontSize: '9.5px', textAlign: 'right', paddingRight: '2px', background: 'rgba(212, 161, 92, 0.08)' }}>{grandTotals.grand_total_amount || ''}</td>
                    <td colSpan="3" style={{ border: '1px solid #000' }}></td>
                    <td style={{ border: '1px solid #000', fontSize: '9.5px', textAlign: 'right', paddingRight: '2px' }}>{grandTotals.total_remit_amount || ''}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Bottom Summary Grid Breakdown & Signatures (Page 2) pinned flush to bottom */}
            <div style={{ flex: '0 0 auto', paddingTop: '8px' }}>
              <table style={{
                width: '100%',
                tableLayout: 'fixed',
                borderCollapse: 'collapse',
                border: '1.5px solid #000',
                textAlign: 'center',
                fontSize: '9.5px',
                fontWeight: 'bold',
                marginBottom: '8px'
              }}>
                <tbody>
                  <tr style={{ height: '21px' }}>
                    <td style={{ border: '1px solid #000', width: '85px', background: '#f8fafc' }}>N/W/DAYS</td>
                    <td style={{ border: '1px solid #000', width: '50px' }}>
                      <input
                        type="number"
                        value={summaryMeta.nw_days}
                        onChange={(e) => { setHasUnsavedChanges(true); setSummaryMeta({ ...summaryMeta, nw_days: parseInt(e.target.value, 10) || 0 }); }}
                        style={{ ...cellInputStyle, fontWeight: 'bold' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', width: '45px', background: '#f8fafc' }}>HP</td>
                    <td style={{ border: '1px solid #000', width: '45px' }}>
                      <input
                        type="number"
                        value={summaryMeta.hp_cases}
                        onChange={(e) => { setHasUnsavedChanges(true); setSummaryMeta({ ...summaryMeta, hp_cases: parseInt(e.target.value, 10) || 0 }); }}
                        style={{ ...cellInputStyle, fontWeight: 'bold' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', width: '70px' }}>
                      <input
                        type="number"
                        value={summaryMeta.hp_amount}
                        onChange={(e) => { setHasUnsavedChanges(true); setSummaryMeta({ ...summaryMeta, hp_amount: parseFloat(e.target.value) || 0 }); }}
                        style={{ ...cellInputStyle, fontWeight: 'bold', textAlign: 'right', paddingRight: '2px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', width: '70px' }}>
                      <input
                        type="number"
                        value={summaryMeta.hp_gst}
                        onChange={(e) => { setHasUnsavedChanges(true); setSummaryMeta({ ...summaryMeta, hp_gst: parseFloat(e.target.value) || 0 }); }}
                        style={{ ...cellInputStyle, fontWeight: 'bold', textAlign: 'right', paddingRight: '2px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', width: '70px' }}>
                      <input
                        type="number"
                        value={summaryMeta.hp_total}
                        onChange={(e) => { setHasUnsavedChanges(true); setSummaryMeta({ ...summaryMeta, hp_total: parseFloat(e.target.value) || 0 }); }}
                        style={{ ...cellInputStyle, fontWeight: 'bold', textAlign: 'right', paddingRight: '2px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', width: '45px', background: '#f8fafc' }}>I/T</td>
                    <td style={{ border: '1px solid #000', width: '45px' }}>
                      <input
                        type="number"
                        value={summaryMeta.it_cases}
                        onChange={(e) => { setHasUnsavedChanges(true); setSummaryMeta({ ...summaryMeta, it_cases: parseInt(e.target.value, 10) || 0 }); }}
                        style={{ ...cellInputStyle, fontWeight: 'bold' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', width: '70px' }}>
                      <input
                        type="number"
                        value={summaryMeta.it_amount}
                        onChange={(e) => { setHasUnsavedChanges(true); setSummaryMeta({ ...summaryMeta, it_amount: parseFloat(e.target.value) || 0 }); }}
                        style={{ ...cellInputStyle, fontWeight: 'bold', textAlign: 'right', paddingRight: '2px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', width: '70px' }}>
                      <input
                        type="number"
                        value={summaryMeta.it_gst}
                        onChange={(e) => { setHasUnsavedChanges(true); setSummaryMeta({ ...summaryMeta, it_gst: parseFloat(e.target.value) || 0 }); }}
                        style={{ ...cellInputStyle, fontWeight: 'bold', textAlign: 'right', paddingRight: '2px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', width: '70px' }}>
                      <input
                        type="number"
                        value={summaryMeta.it_total}
                        onChange={(e) => { setHasUnsavedChanges(true); setSummaryMeta({ ...summaryMeta, it_total: parseFloat(e.target.value) || 0 }); }}
                        style={{ ...cellInputStyle, fontWeight: 'bold', textAlign: 'right', paddingRight: '2px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', width: '45px', background: '#f8fafc' }}>O/C</td>
                    <td style={{ border: '1px solid #000', width: '45px' }}>
                      <input
                        type="number"
                        value={summaryMeta.oc_cases}
                        onChange={(e) => { setHasUnsavedChanges(true); setSummaryMeta({ ...summaryMeta, oc_cases: parseInt(e.target.value, 10) || 0 }); }}
                        style={{ ...cellInputStyle, fontWeight: 'bold' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', width: '80px' }}>
                      <input
                        type="number"
                        value={summaryMeta.oc_amount}
                        onChange={(e) => { setHasUnsavedChanges(true); setSummaryMeta({ ...summaryMeta, oc_amount: parseFloat(e.target.value) || 0 }); }}
                        style={{ ...cellInputStyle, fontWeight: 'bold', textAlign: 'right', paddingRight: '2px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #000', width: '90px', background: 'rgba(212, 161, 92, 0.12)' }}>
                      TOTAL {grandTotals.total_cases || 79}
                    </td>
                    <td style={{ border: '1px solid #000', width: '95px', background: 'rgba(212, 161, 92, 0.12)', textAlign: 'right', paddingRight: '4px' }}>
                      {grandTotals.grand_total_amount || 64770}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Bottom Signatures pinned flush to bottom of Page 2 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                fontSize: '11px',
                fontWeight: 'bold',
                paddingTop: '4px',
                paddingBottom: '2px'
              }}>
                <div>
                  <span>Controlling Officer</span>
                </div>

                <div>
                  <span>Head of the Office</span>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <input
                    type="text"
                    value={editableMeta.name}
                    onChange={(e) => { setHasUnsavedChanges(true); setEditableMeta({ ...editableMeta, name: e.target.value }); }}
                    style={{ fontWeight: 'bold', textAlign: 'center', border: 'none', background: 'transparent', outline: 'none', fontSize: '11px', width: '160px' }}
                  />
                  <div>
                    <input
                      type="text"
                      value={`(${editableMeta.designation || 'CTI'}/SL/GNT)`}
                      onChange={(e) => { setHasUnsavedChanges(true); setEditableMeta({ ...editableMeta, designation: e.target.value }); }}
                      style={{ fontWeight: 'normal', textAlign: 'center', border: 'none', background: 'transparent', outline: 'none', fontSize: '10px', width: '160px' }}
                    />
                  </div>
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
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📔</div>
          <h3 style={{ color: 'var(--primary)', marginBottom: '8px' }}>Select an Employee to View Diary Statement</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 16px' }}>
            Choose a Category and Employee from the dropdown above to load and edit their E.F.T Earnings Statement and Remittance Diary.
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
