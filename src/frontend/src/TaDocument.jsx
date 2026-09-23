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
    // 11th of prev month to 10th of selected month (IR wage period)
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

export default function TaDocument({
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
  const [internalMonth, setInternalMonth] = useState('9');

  const selectedStaffId = propSelectedStaffId !== undefined ? propSelectedStaffId : internalStaffId;
  const setSelectedStaffId = propSetSelectedStaffId || setInternalStaffId;
  const year = propYear !== undefined ? propYear : internalYear;
  const setYear = propSetYear || setInternalYear;
  const month = propMonth !== undefined ? propMonth : internalMonth;
  const setMonth = propSetMonth || setInternalMonth;

  // Period / Date Range state
  const [periodPreset, setPeriodPreset] = useState(() => {
    try {
      return localStorage.getItem('railway_ta_period_preset') || 'full_month';
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
    try { localStorage.setItem('railway_ta_period_preset', preset); } catch (e) {}
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

  // Editable header metadata (exact matter from reference Excel sheet)
  const [editableMeta, setEditableMeta] = useState({
    branch: 'COMMERCIAL',
    division: 'GNT',
    hq: 'GNT',
    name: 'K V R RAO',
    designation: 'CTI',
    month_name: 'AUGUST',
    year: '2026',
    pay: '68000',
    pf_no: '07323475',
    bill_unit_no: '0910629',
    doa: '05/08/2000',
    full_name_sign: 'K V RAMANA RAO',
    designation_sign: '(CTI/SL/GNT)',
    vertical_object_text: 'MANNING AC COACHES'
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

  // Fetch TA Journal whenever staff, month, or year changes
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

    fetch(`${API_BASE}/documents/ta/${selectedStaffId}?${queryParams.toString()}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          // Normalize row structure with A1, A, B1, Ord
          const normalizedRows = (data.rows || []).map(r => {
            let b1Val = '';
            if (r.ta_b1 !== undefined && r.ta_b1 !== null && r.ta_b1 !== '') {
              b1Val = String(r.ta_b1);
            } else if (r.days_claiming_ta !== null && r.days_claiming_ta !== undefined) {
              b1Val = String(r.days_claiming_ta);
            }
            return {
              ...r,
              ta_a1: r.ta_a1 || '',
              ta_a: r.ta_a || '',
              ta_b1: b1Val,
              ta_ord: r.ta_ord || '',
              object_of_journey: r.object_of_journey || '',
              remarks: r.remarks || r.nature_of_leave || '',
              nature_of_leave: r.nature_of_leave || '',
              is_leave: !!(r.is_leave || r.nature_of_leave || (r.train_no === '---' && (r.remarks || '').toLowerCase().includes('leave')))
            };
          });

          const finalRecalculated = recalculateAllJournalTa(normalizedRows);
          setJournalData({
            ...data,
            rows: finalRecalculated
          });

          if (data.employee) {
            const empName = data.employee.name || 'K V R RAO';
            const empDesig = data.employee.designation || 'CTI';
            setEditableMeta(prev => ({
              ...prev,
              branch: data.employee.branch || 'COMMERCIAL',
              division: data.employee.division || 'GNT',
              hq: data.employee.hq || 'GNT',
              name: empName,
              designation: empDesig,
              month_name: data.period_label || data.month_name || 'SEPTEMBER',
              year: String(data.year || '2026'),
              pay: String(data.employee.pay || '68000'),
              pf_no: data.employee.pf_no || '07323475',
              bill_unit_no: data.employee.bill_unit || data.employee.bill_no || '0910629',
              doa: data.employee.doa || '05/08/2000',
              full_name_sign: empName === 'K V R RAO' ? 'K V RAMANA RAO' : empName,
              designation_sign: `(${empDesig}/SL/GNT)`,
              vertical_object_text: prev.vertical_object_text || (data.employee.category_id === 1 ? 'MANNING AC COACHES' : 'MANNING SLEEPER COACHES')
            }));
          }
        } else {
          console.error('TA Journal error:', data?.error);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading TA journal:', err);
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

  // Parse time helper
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr || timeStr === '---' || timeStr === '--' || timeStr === '') return null;
    const match = timeStr.trim().match(/^(\d{1,2})[:.](\d{2})$/);
    if (!match) return null;
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  };

  // Calculate TA claim fraction based on official Indian Railways travel rules (24-hr cycle):
  // Outward dep from HQ: > 6 hrs to midnight -> 0.7, <= 6 hrs -> 0.3
  // Outstation stay: > 12 hrs -> 1.0, 6-12 hrs -> 0.7, < 6 hrs -> 0.3
  // Return to HQ: morning arrival at or before 06:00 AM -> 0.3, morning arrival after 06:00 AM (06:01 to 12:00 PM) -> 0.7, afternoon -> 1.0
  const calculateDayDutiesTa = (duties) => {
    if (!Array.isArray(duties) || duties.length === 0) return duties;

    const updated = duties.map(d => ({ ...d }));

    // Check if leave or rest
    const isLeave = updated.some(d => d.is_leave || (d.train_no === '---' && (d.from_station === '---' || d.from === '---')));
    if (isLeave) {
      return updated.map(d => ({ ...d, ta_b1: '', days_claiming_ta: null, absence_hours: 0, claim_amount: 0 }));
    }

    // 1. Mark connecting legs from HQ to BZA as null TA
    updated.forEach(d => {
      const to = d.to_station || d.to;
      if ((d.train_no === '17281' || d.train_no === '67230') && to === 'BZA') {
        d.ta_b1 = '';
        d.days_claiming_ta = null;
        d.absence_hours = 1.1;
      }
    });

    // 2. Check for Outstation Rest / Stay on this date
    const outstationArr = updated.find(d => {
      const to = d.to_station || d.to;
      const arr = d.arr_time || d.arr;
      return to && !['GNT', 'BZA', '---'].includes(to) && arr && arr !== '---';
    });

    const outstationDep = updated.find(d => {
      const from = d.from_station || d.from;
      const dep = d.dep_time || d.dep;
      return from && !['GNT', 'BZA', '---'].includes(from) && dep && dep !== '---';
    });

    if (outstationArr && outstationDep) {
      const arrTime = outstationArr.arr_time || outstationArr.arr;
      const depTime = outstationDep.dep_time || outstationDep.dep;
      const destTo = outstationDep.to_station || outstationDep.to;
      const destArr = outstationDep.arr_time || outstationDep.arr;

      const arrM = parseTimeToMinutes(arrTime);
      const depM = parseTimeToMinutes(depTime);
      const finalArrM = parseTimeToMinutes(destArr);

      if (arrM !== null && depM !== null) {
        let restMins = depM >= arrM ? depM - arrM : (1440 - arrM + depM);
        const restHours = Math.round((restMins / 60) * 10) / 10;
        let dayTa = 0.7;

        if (destTo === 'GNT' && finalArrM !== null && finalArrM > 12 * 60) {
          dayTa = 1.0;
        } else if (restHours > 12) {
          dayTa = 1.0;
        } else if (restHours >= 6) {
          dayTa = 0.7;
        } else {
          dayTa = 0.3;
        }

        outstationArr.ta_b1 = '';
        outstationArr.days_claiming_ta = null;
        outstationArr.absence_hours = 0;

        outstationDep.ta_b1 = String(dayTa);
        outstationDep.days_claiming_ta = dayTa;
        outstationDep.absence_hours = restHours;

        return updated;
      }
    }

    // 3. Check for Departure from HQ outward journey
    const gntLeg = updated.find(d => (d.from_station || d.from) === 'GNT' && (d.dep_time || d.dep) && (d.dep_time || d.dep) !== '---');
    const nightDepLeg = updated.find(d => {
      const dep = d.dep_time || d.dep;
      const arr = d.arr_time || d.arr;
      const to = d.to_station || d.to;
      return dep && dep !== '---' && (!arr || arr === '---' || to === '---');
    });
    const gntArrLeg = updated.find(d => (d.to_station || d.to) === 'GNT' && (d.arr_time || d.arr) && (d.arr_time || d.arr) !== '---');

    if ((gntLeg || nightDepLeg) && !gntArrLeg) {
      const hqDepTime = gntLeg ? (gntLeg.dep_time || gntLeg.dep) : (nightDepLeg.dep_time || nightDepLeg.dep);
      const depM = parseTimeToMinutes(hqDepTime);

      if (depM !== null) {
        const timeTo00Hrs = (1440 - depM) / 60;
        let dayTa = 0.3;
        if (timeTo00Hrs > 12) {
          dayTa = 1.0;
        } else if (timeTo00Hrs > 6) {
          dayTa = 0.7;
        } else {
          dayTa = 0.3;
        }

        const mainClaimLeg = nightDepLeg || gntLeg;
        updated.forEach(d => {
          if (d === mainClaimLeg) {
            d.ta_b1 = String(dayTa);
            d.days_claiming_ta = dayTa;
            d.absence_hours = Math.round(timeTo00Hrs * 10) / 10;
          } else {
            d.ta_b1 = '';
            d.days_claiming_ta = null;
          }
        });
        return updated;
      }
    }

    // 4. Return to HQ day
    if (gntArrLeg && !nightDepLeg) {
      const arrM = parseTimeToMinutes(gntArrLeg.arr_time || gntArrLeg.arr);
      if (arrM !== null) {
        let dayTa = null;
        let hours = Math.round((arrM / 60) * 10) / 10;
        if (arrM <= 5) {
          dayTa = null;
        } else if (arrM <= 6 * 60) {
          dayTa = 0.3;
        } else if (arrM <= 12 * 60) {
          dayTa = 0.7;
        } else {
          dayTa = 1.0;
        }

        updated.forEach(d => {
          if (d === gntArrLeg) {
            d.ta_b1 = dayTa !== null ? String(dayTa) : '';
            d.days_claiming_ta = dayTa;
            d.absence_hours = hours;
          } else {
            d.ta_b1 = '';
            d.days_claiming_ta = null;
          }
        });
        return updated;
      }
    }

    // 5. Day with both return arrival at HQ and departure from HQ (e.g. Link 10 or Link 12)
    if (gntArrLeg && nightDepLeg) {
      const arrM = parseTimeToMinutes(gntArrLeg.arr_time || gntArrLeg.arr);
      let arrTa = 0.3;
      if (arrM !== null) {
        if (arrM <= 5) arrTa = null;
        else if (arrM <= 6 * 60) arrTa = 0.3;
        else if (arrM <= 12 * 60) arrTa = 0.7;
        else arrTa = 1.0;
      }
      gntArrLeg.ta_b1 = arrTa !== null ? String(arrTa) : '';
      gntArrLeg.days_claiming_ta = arrTa;
      gntArrLeg.absence_hours = arrM ? Math.round((arrM / 60) * 10) / 10 : 1.0;

      const depM = parseTimeToMinutes(nightDepLeg.dep_time || nightDepLeg.dep);
      let depTa = 0.3;
      if (depM !== null) {
        const timeTo00Hrs = (1440 - depM) / 60;
        if (timeTo00Hrs > 12) depTa = 1.0;
        else if (timeTo00Hrs > 6) depTa = 0.7;
        else depTa = 0.3;
      }
      nightDepLeg.ta_b1 = String(depTa);
      nightDepLeg.days_claiming_ta = depTa;
      nightDepLeg.absence_hours = depM ? Math.round(((1440 - depM) / 60) * 10) / 10 : 1.0;

      return updated;
    }

    // 6. Same-day round trip
    if (updated.length === 1 && (updated[0].dep_time || updated[0].dep) && (updated[0].arr_time || updated[0].arr)) {
      const d = updated[0];
      const depM = parseTimeToMinutes(d.dep_time || d.dep);
      const arrM = parseTimeToMinutes(d.arr_time || d.arr);
      if (depM !== null && arrM !== null) {
        let diff = arrM >= depM ? arrM - depM : 1440 - depM + arrM;
        const h = Math.round((diff / 60) * 10) / 10;
        let dayTa = h < 6 ? 0.3 : (h <= 12 ? 0.7 : 1.0);
        d.ta_b1 = String(dayTa);
        d.days_claiming_ta = dayTa;
        d.absence_hours = h;
        return updated;
      }
    }

    return updated;
  };

  const recalculateAllJournalTa = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return rows;

    const dateGroups = new Map();
    rows.forEach((r, idx) => {
      const d = r.duty_date || r.date_iso || r.date_str;
      if (!dateGroups.has(d)) dateGroups.set(d, []);
      dateGroups.get(d).push({ ...r, _origIdx: idx });
    });

    const updatedRows = [...rows];

    dateGroups.forEach((groupRows) => {
      const calculated = calculateDayDutiesTa(groupRows);
      calculated.forEach(r => {
        const orig = updatedRows[r._origIdx];
        if (orig.is_manual_ta) return; // preserve manual user edits
        const effectiveDaRate = orig.da_rate || (editableMeta.pay ? (parseInt(editableMeta.pay, 10) >= 53100 ? 800 : (parseInt(editableMeta.pay, 10) >= 35400 ? 500 : 800)) : 800);
        const amt = r.days_claiming_ta !== null && r.days_claiming_ta !== undefined
          ? Math.round(r.days_claiming_ta * effectiveDaRate)
          : 0;
        updatedRows[r._origIdx] = {
          ...orig,
          ta_b1: r.ta_b1 !== undefined ? r.ta_b1 : (r.days_claiming_ta !== null ? String(r.days_claiming_ta) : ''),
          days_claiming_ta: r.days_claiming_ta !== undefined ? r.days_claiming_ta : null,
          absence_hours: r.absence_hours !== undefined ? r.absence_hours : orig.absence_hours,
          claim_amount: amt
        };
      });
    });

    return updatedRows;
  };

  // Single-row fallback helper
  const calculateTaValue = (depTime, arrTime, fromStn = '', toStn = '', trainNo = '', origDaysClaiming = null) => {
    if ((trainNo === '17281' || trainNo === '67230') && toStn === 'BZA') {
      return null;
    }

    const depMins = parseTimeToMinutes(depTime);
    const arrMins = parseTimeToMinutes(arrTime);

    if (depMins === null && arrMins === null) return null;

    if (depMins !== null && arrMins !== null) {
      let diff = arrMins >= depMins ? arrMins - depMins : 1440 - depMins + arrMins;
      if (diff < 360) return 0.3;
      if (diff <= 720) return 0.7;
      return 1.0;
    }

    if (depMins !== null && arrMins === null) {
      const diff = 1440 - depMins;
      if (diff > 720) return 1.0;
      if (diff > 360) return 0.7;
      return 0.3;
    }

    if (depMins === null && arrMins !== null) {
      if (arrMins <= 5) return null;
      if (arrMins <= 480) return 0.3;
      if (arrMins <= 720) return 0.7;
      return 1.0;
    }

    return 0.7;
  };

  // Universal Cell Edit Handler across all table columns
  const handleCellChange = (index, field, value) => {
    if (!journalData || !journalData.rows) return;
    setHasUnsavedChanges(true);
    const updatedRows = [...journalData.rows];
    const currentRow = { ...updatedRows[index] };

    // Numerical / TA decimal fields
    if (field === 'ta_b1' || field === 'days_claiming_ta') {
      if (value === '' || value === null) {
        currentRow.ta_b1 = '';
        currentRow.days_claiming_ta = null;
      } else {
        const parsed = parseFloat(value);
        currentRow.ta_b1 = isNaN(parsed) ? value : String(parsed);
        currentRow.days_claiming_ta = isNaN(parsed) ? null : parsed;
      }
      currentRow.is_manual_ta = true;
      updatedRows[index] = currentRow;
    } else {
      currentRow[field] = value;
      updatedRows[index] = currentRow;
    }

    // Recalculate TA across date-grouped rows if time or station changed
    let finalRows = updatedRows;
    if (['dep_time', 'arr_time', 'from_station', 'to_station', 'train_no'].includes(field)) {
      finalRows = recalculateAllJournalTa(updatedRows);
    }

    // Recalculate is_same_date_as_prev flags if date was edited
    if (field === 'date_str') {
      for (let i = 0; i < finalRows.length; i++) {
        finalRows[i].is_same_date_as_prev = (i > 0 && finalRows[i].date_str === finalRows[i - 1].date_str);
      }
      finalRows = recalculateAllJournalTa(finalRows);
    }

    // Recalculate grand total
    const totalDays = finalRows.reduce((sum, r) => sum + (parseFloat(r.ta_b1) || 0), 0);

    setJournalData({
      ...journalData,
      rows: finalRows,
      total_days: Math.round(totalDays * 10) / 10
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
      date_str: lastDate,
      date_iso: `${year}-${String(month).padStart(2, '0')}-01`,
      is_same_date_as_prev: existing.length > 0 && existing[existing.length - 1].date_str === lastDate,
      train_no: '',
      from_station: 'GNT',
      to_station: '---',
      dep_time: '',
      arr_time: '',
      ta_a1: '',
      ta_a: '',
      ta_b1: '',
      ta_ord: '',
      days_claiming_ta: null,
      object_of_journey: '',
      remarks: ''
    };

    const updated = [...existing, newRow];
    setJournalData({
      ...journalData,
      rows: updated
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

        const updatedRows = data.legs.map(r => {
          const actualDep = r.act_dep || r.dep_time || '---';
          const actualArr = r.act_arr || r.arr_time || '---';
          return {
            ...r,
            dep_time: actualDep,
            arr_time: actualArr,
            act_dep: actualDep,
            act_arr: actualArr
          };
        });

        const finalRecalculated = recalculateAllJournalTa(updatedRows);
        const totalDays = finalRecalculated.reduce((sum, r) => sum + (parseFloat(r.ta_b1) || 0), 0);
        const syncedCount = finalRecalculated.filter(r => r.is_synced && (r.act_dep !== '---' || r.act_arr !== '---')).length;

        setJournalData({
          ...journalData,
          rows: finalRecalculated,
          total_days: Math.round(totalDays * 10) / 10
        });

        setStatusMsg(`⚡ Successfully synced ${syncedCount} train timings from Official NTES (enquiry.indianrail.gov.in) and recalculated TA values!`);
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
      const res = await fetch(`${API_BASE}/documents/ta/${selectedStaffId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          month_year: journalData?.month_year || `${year}-${String(month).padStart(2, '0')}`,
          start_date: startDate,
          end_date: endDate,
          entries: journalData.rows,
          employee_meta: editableMeta
        })
      });

      const data = await res.json();
      if (res.ok) {
        setHasUnsavedChanges(false);
        setStatusMsg('✅ TA Journal saved successfully!');
        setTimeout(() => setStatusMsg(''), 4500);
      } else {
        alert(data.error || 'Failed to save TA journal.');
      }
    } catch (err) {
      alert('Error saving TA journal: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Reset to auto-generated master rotation
  const handleResetToAuto = async () => {
    if (!selectedStaffId) return;
    if (!window.confirm('Reset all custom edits for this period back to the master roster rotation timetable?')) {
      return;
    }
    setResetting(true);
    setStatusMsg('');

    try {
      const res = await fetch(`${API_BASE}/documents/ta/${selectedStaffId}?year=${year}&month=${month}&start_date=${startDate}&end_date=${endDate}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        setStatusMsg('🔄 Reset to auto-generated master timetable.');
        fetchJournal();
        setTimeout(() => setStatusMsg(''), 4000);
      } else {
        alert('Failed to reset journal.');
      }
    } catch (err) {
      alert('Error resetting journal: ' + err.message);
    } finally {
      setResetting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Page 1: Exact 45 data rows matching the Excel sheet
  const PAGE1_ROW_LIMIT = 45;
  const allRows = journalData?.rows || [];
  const page1Rows = allRows.slice(0, PAGE1_ROW_LIMIT);
  const page2Rows = allRows.slice(PAGE1_ROW_LIMIT);

  // Pad Page 1 up to 45 rows so every employee's sheet has full ruling
  const page1Padded = [...page1Rows];
  while (page1Padded.length < PAGE1_ROW_LIMIT) {
    page1Padded.push({
      date_str: '',
      train_no: '',
      from_station: '',
      to_station: '',
      dep_time: '',
      arr_time: '',
      ta_a1: '',
      ta_a: '',
      ta_b1: '',
      ta_ord: '',
      object_of_journey: '',
      remarks: '',
      isEmptyPadding: true
    });
  }

  // Page 2: 45 ruled rows matching Excel sheet
  const PAGE2_TOTAL_ROWS = 45;
  const page2Padded = [...page2Rows];
  while (page2Padded.length < PAGE2_TOTAL_ROWS) {
    page2Padded.push({
      date_str: '',
      train_no: '',
      from_station: '',
      to_station: '',
      dep_time: '',
      arr_time: '',
      ta_a1: '',
      ta_a: '',
      ta_b1: '',
      ta_ord: '',
      object_of_journey: '',
      remarks: '',
      isEmptyPadding: true
    });
  }

  // Page 1 Total (Sum of B1 column on Page 1)
  const page1TotalRaw = page1Rows.reduce((sum, r) => sum + (parseFloat(r.ta_b1) || 0), 0);
  const page1Total = Math.round(page1TotalRaw * 10) / 10;
  
  // Page 2 Subtotal
  const page2SubtotalRaw = page2Rows.reduce((sum, r) => sum + (parseFloat(r.ta_b1) || 0), 0);
  
  // Grand Total (Sum across Both Pages)
  const grandTotalRaw = page1TotalRaw + page2SubtotalRaw;
  const grandTotalDays = Math.round(grandTotalRaw * 10) / 10;

  const cellInputStyle = {
    width: '100%',
    height: '100%',
    border: 'none',
    background: 'transparent',
    textAlign: 'center',
    fontSize: '9.2px',
    outline: 'none',
    fontFamily: 'Arial, sans-serif',
    color: '#000',
    padding: '0px',
    margin: '0px',
    boxSizing: 'border-box'
  };

  const headerInputStyle = {
    fontWeight: 'bold',
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: '9.5px',
    fontFamily: 'Arial, sans-serif',
    padding: '0 2px',
    color: '#000'
  };

  return (
    <div className="ta-document-container" style={{ padding: '12px 14px', maxWidth: '1200px', margin: '0 auto' }}>
      
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
                <span>📄</span> TRAVELLING ALLOWANCE JOURNAL
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
                LEGAL SIZE (EXACT MASTER TEMPLATE)
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
              {[...staffList]
                .sort((a, b) => (a.name || '').trim().localeCompare((b.name || '').trim()))
                .map(s => (
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
                border: `1px solid ${periodPreset === 'full_month' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.12)'}`,
                fontWeight: periodPreset === 'full_month' ? 700 : 500
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
                border: `1px solid ${periodPreset === 'wage_period' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.12)'}`,
                fontWeight: periodPreset === 'wage_period' ? 700 : 500
              }}
              title="11th of previous month to 10th of selected month (Indian Railways standard muster wage cycle)"
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
                border: `1px solid ${periodPreset === 'fortnight_1' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.12)'}`,
                fontWeight: periodPreset === 'fortnight_1' ? 700 : 500
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
                border: `1px solid ${periodPreset === 'fortnight_2' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.12)'}`,
                fontWeight: periodPreset === 'fortnight_2' ? 700 : 500
              }}
            >
              16th – End
            </button>
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
              <span>⚠️</span> Unsaved edits in TA Journal. Press <strong>Ctrl+S</strong> or click <strong>Save Changes</strong> to store.
            </div>
          ) : (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
              ✓ Period: <strong>{startDate.split('-').reverse().join('/')} to {endDate.split('-').reverse().join('/')}</strong> | Total TA Claim: <strong>{grandTotalDays || page1Total || 0} DAYS</strong>
            </div>
          )}
        </div>

        {/* TA Acceptance Notice Banner */}
        {journalData && (
          <div style={{
            marginTop: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: journalData.pending_count > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(34, 197, 94, 0.12)',
            border: `1px solid ${journalData.pending_count > 0 ? '#f59e0b' : '#22c55e'}`,
            color: journalData.pending_count > 0 ? '#fef3c7' : '#dcfce7'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.1rem' }}>{journalData.pending_count > 0 ? '⏳' : '✅'}</span>
              <span>
                {journalData.pending_count > 0 ? (
                  <>
                    <strong>Showing approved duties for period {startDate.split('-').reverse().join('/')} to {endDate.split('-').reverse().join('/')} ({journalData.approved_count || 0} approved).</strong> There are <strong>{journalData.pending_count} duty claim(s)</strong> awaiting Admin acceptance in the <strong>"TA Approvals"</strong> tab before appearing in this official journal.
                  </>
                ) : (
                  <>
                    <strong>All duty claims for period {startDate.split('-').reverse().join('/')} to {endDate.split('-').reverse().join('/')} verified & accepted ({journalData.approved_count || (journalData.rows || []).length} approved).</strong> These duties are official and included in this claim.
                  </>
                )}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
              DA Rule: &lt;6h (30%) | 6–12h (70%) | &gt;12h (100%)
            </div>
          </div>
        )}
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

      {/* Print Stylesheet for LEGAL PAPER SIZE (215.9 × 355.6 mm / 8.5 × 14 in) */}
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
          .ta-document-container {
            padding: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .ta-page-sheet {
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
          .ta-page-sheet:last-child {
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
        .ta-cell input:hover {
          background: rgba(212, 161, 92, 0.08) !important;
        }
        .ta-cell input:focus {
          background: rgba(212, 161, 92, 0.16) !important;
          outline: 1px solid #d4a15c !important;
        }
      `}</style>

      {/* ----------------------------------------------------
         OFFICIAL 2-PAGE TRAVELLING ALLOWANCE JOURNAL (EXACT EXCEL MASTER)
         ---------------------------------------------------- */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-secondary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⏳</div>
          Generating Travelling Allowance Journal...
        </div>
      ) : journalData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', alignItems: 'center' }}>
          
          {/* ====================================================
             PAGE 1 OF 2 (EXACT REPLICA OF EXCEL SHEET 1)
             ==================================================== */}
          <div className="ta-page-sheet" style={{
            background: '#ffffff',
            color: '#000000',
            width: '100%',
            maxWidth: '215.9mm',
            padding: '12px 14px 14px 14px',
            borderRadius: '4px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
            fontFamily: 'Arial, sans-serif',
            fontSize: '9.5px',
            lineHeight: 1.25,
            boxSizing: 'border-box',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            
            {/* Top Title & Header Block */}
            <div style={{ marginBottom: '6px' }}>
              <div style={{ textAlign: 'center', fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                TRAVELLING ALLOWANCE JOURNAL
              </div>

              {/* Exact 4-Line Aligned Header Info Block */}
              <div style={{ fontSize: '9.5px', lineHeight: 1.45, textAlign: 'center', marginBottom: '4px' }}>
                {/* Line 1 */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center' }}>
                  <div>
                    <strong>BRANCH : </strong>
                    <input type="text" value={editableMeta.branch} onChange={(e) => handleMetaChange('branch', e.target.value)} style={{ ...headerInputStyle, width: '100px', textDecoration: 'underline' }} />
                  </div>
                  <div>
                    <strong>DIVISION : </strong>
                    <input type="text" value={editableMeta.division} onChange={(e) => handleMetaChange('division', e.target.value)} style={{ ...headerInputStyle, width: '45px' }} />
                  </div>
                  <div>
                    <strong>HEADQUARTERS AT : </strong>
                    <input type="text" value={editableMeta.hq} onChange={(e) => handleMetaChange('hq', e.target.value)} style={{ ...headerInputStyle, width: '50px' }} />
                  </div>
                </div>

                {/* Line 2 */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', alignItems: 'center' }}>
                  <div>
                    Journal of duties performed by &nbsp;
                    <input type="text" value={editableMeta.name} onChange={(e) => handleMetaChange('name', e.target.value)} style={{ ...headerInputStyle, width: '130px', textAlign: 'center', fontWeight: 'bold' }} />
                  </div>
                  <div>
                    Designation : &nbsp;
                    <input type="text" value={editableMeta.designation} onChange={(e) => handleMetaChange('designation', e.target.value)} style={{ ...headerInputStyle, width: '50px' }} />
                  </div>
                </div>

                {/* Line 3 */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', alignItems: 'center' }}>
                  <div>
                    are which allowance for &nbsp;
                    <input 
                      type="text" 
                      value={editableMeta.month_name} 
                      onChange={(e) => handleMetaChange('month_name', e.target.value)} 
                      style={{ 
                        ...headerInputStyle, 
                        width: editableMeta.month_name && editableMeta.month_name.length > 7 ? `${Math.min(220, Math.max(65, editableMeta.month_name.length * 7.5))}px` : '65px', 
                        textAlign: 'center', 
                        textTransform: 'uppercase',
                        fontSize: editableMeta.month_name && editableMeta.month_name.length > 12 ? '8px' : '9.5px'
                      }} 
                    />
                    {(!editableMeta.month_name || !editableMeta.month_name.includes('/')) && (
                      <input type="text" value={editableMeta.year} onChange={(e) => handleMetaChange('year', e.target.value)} style={{ ...headerInputStyle, width: '45px', textAlign: 'center' }} />
                    )}
                    &nbsp; is claimed.
                  </div>
                  <div>
                    Pay: Rs.
                    <input type="text" value={editableMeta.pay} onChange={(e) => handleMetaChange('pay', e.target.value)} style={{ ...headerInputStyle, width: '55px' }} />
                  </div>
                </div>

                {/* Line 4 */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', alignItems: 'center' }}>
                  <div>
                    PF No. &nbsp;
                    <input type="text" value={editableMeta.pf_no} onChange={(e) => handleMetaChange('pf_no', e.target.value)} style={{ ...headerInputStyle, width: '80px' }} />
                  </div>
                  <div>
                    Bill Unit No. &nbsp;
                    <input type="text" value={editableMeta.bill_unit_no} onChange={(e) => handleMetaChange('bill_unit_no', e.target.value)} style={{ ...headerInputStyle, width: '70px' }} />
                  </div>
                  <div>
                    DOA : &nbsp;
                    <input type="text" value={editableMeta.doa} onChange={(e) => handleMetaChange('doa', e.target.value)} style={{ ...headerInputStyle, width: '85px' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* 12-Column Main Table (Page 1) */}
            <div>
              <table style={{
                width: '100%',
                tableLayout: 'fixed',
                borderCollapse: 'collapse',
                border: '1.5px solid #000',
                textAlign: 'center',
                fontSize: '9px'
              }}>
                <thead>
                  {/* Header Row 1 */}
                  <tr style={{ background: '#ffffff', borderBottom: '1px solid #000', fontWeight: 'bold', height: '22px' }}>
                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '12%' }}>
                      MONTH AND DATE
                    </th>
                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '7.5%' }}>
                      Train<br/>No.
                    </th>
                    <th colSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '15%' }}>
                      STATIONS
                    </th>
                    <th colSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '13%' }}>
                      TIME
                    </th>
                    <th colSpan="4" style={{ border: '1px solid #000', padding: '2px 1px', width: '24%' }}>
                      DAYS CLAIMING T.A
                    </th>
                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '12%' }}>
                      Object of<br/>Journey
                    </th>
                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '16%' }}>
                      Remarks /<br/>Nature of Leave
                    </th>
                  </tr>
                  {/* Header Row 2 (Sub-columns) */}
                  <tr style={{ background: '#ffffff', borderBottom: '1.5px solid #000', fontWeight: 'bold', height: '18px' }}>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '7.5%' }}>FROM</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '7.5%' }}>TO</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '6.5%' }}>DEP.</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '6.5%' }}>ARR.</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '5%' }}>A1</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '5%' }}>A</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '7.5%' }}>B1</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '6.5%' }}>Ord.</th>
                  </tr>
                </thead>
                <tbody>
                  {page1Padded.map((row, idx) => (
                    <tr key={idx} style={{ height: '21.5px' }}>
                      {/* 1. Month and Date */}
                      <td className="ta-cell" style={{ border: '1px solid #000', padding: 0, fontWeight: (row.is_same_date_as_prev && !row.is_leave && row.train_no !== '---') ? 'normal' : 'bold' }}>
                        {!row.isEmptyPadding && (
                          <input
                            type="text"
                            value={(row.is_same_date_as_prev && !row.is_leave && row.train_no !== '---') ? '"' : (row.date_str || '')}
                            onChange={(e) => handleCellChange(idx, 'date_str', e.target.value)}
                            style={cellInputStyle}
                          />
                        )}
                      </td>

                      {/* 2. Train No. */}
                      <td className="ta-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        {!row.isEmptyPadding && (
                          <input
                            type="text"
                            value={row.train_no || ''}
                            onChange={(e) => handleCellChange(idx, 'train_no', e.target.value)}
                            style={cellInputStyle}
                          />
                        )}
                      </td>

                      {/* 3. Stations From */}
                      <td className="ta-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        {!row.isEmptyPadding && (
                          <input
                            type="text"
                            value={row.from_station || ''}
                            onChange={(e) => handleCellChange(idx, 'from_station', e.target.value)}
                            style={cellInputStyle}
                          />
                        )}
                      </td>

                      {/* 4. Stations To */}
                      <td className="ta-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        {!row.isEmptyPadding && (
                          <input
                            type="text"
                            value={row.to_station || ''}
                            onChange={(e) => handleCellChange(idx, 'to_station', e.target.value)}
                            style={cellInputStyle}
                          />
                        )}
                      </td>

                      {/* 5. Time Dep */}
                      <td className="ta-cell" style={{ border: '1px solid #000', padding: 0, background: row.is_ntes_synced ? 'rgba(59, 130, 246, 0.05)' : 'transparent' }}>
                        {!row.isEmptyPadding && (
                          <input
                            type="text"
                            value={row.dep_time || ''}
                            onChange={(e) => handleCellChange(idx, 'dep_time', e.target.value)}
                            style={cellInputStyle}
                            title={row.is_ntes_synced ? `NTES Actual Departure (${row.delay_mins ? `+${row.delay_mins}m late` : 'Right Time'})` : 'Departure time'}
                          />
                        )}
                      </td>

                      {/* 6. Time Arr */}
                      <td className="ta-cell" style={{ border: '1px solid #000', padding: 0, background: row.is_ntes_synced ? 'rgba(59, 130, 246, 0.05)' : 'transparent' }}>
                        {!row.isEmptyPadding && (
                          <input
                            type="text"
                            value={row.arr_time || ''}
                            onChange={(e) => handleCellChange(idx, 'arr_time', e.target.value)}
                            style={cellInputStyle}
                            title={row.is_ntes_synced ? `NTES Actual Arrival (${row.delay_mins ? `+${row.delay_mins}m late` : 'Right Time'})` : 'Arrival time'}
                          />
                        )}
                      </td>

                      {/* 7. Days Claiming TA - A1 */}
                      <td className="ta-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        {!row.isEmptyPadding && (
                          <input
                            type="text"
                            value={row.ta_a1 || ''}
                            onChange={(e) => handleCellChange(idx, 'ta_a1', e.target.value)}
                            style={cellInputStyle}
                          />
                        )}
                      </td>

                      {/* 8. Days Claiming TA - A */}
                      <td className="ta-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        {!row.isEmptyPadding && (
                          <input
                            type="text"
                            value={row.ta_a || ''}
                            onChange={(e) => handleCellChange(idx, 'ta_a', e.target.value)}
                            style={cellInputStyle}
                          />
                        )}
                      </td>

                      {/* 9. Days Claiming TA - B1 */}
                      <td className="ta-cell" style={{ border: '1px solid #000', padding: 0, fontWeight: 'bold' }}>
                        {!row.isEmptyPadding && (
                          <input
                            type="text"
                            value={row.ta_b1 !== '' && row.ta_b1 !== null && row.ta_b1 !== undefined ? row.ta_b1 : ''}
                            onChange={(e) => handleCellChange(idx, 'ta_b1', e.target.value)}
                            style={cellInputStyle}
                          />
                        )}
                      </td>

                      {/* 10. Days Claiming TA - Ord */}
                      <td className="ta-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        {!row.isEmptyPadding && (
                          <input
                            type="text"
                            value={row.ta_ord || ''}
                            onChange={(e) => handleCellChange(idx, 'ta_ord', e.target.value)}
                            style={cellInputStyle}
                          />
                        )}
                      </td>

                      {/* 11. Object of Journey: Single Merged Cell spanning all 45 data rows with upright vertical text */}
                      {idx === 0 && (
                        <td
                          rowSpan={PAGE1_ROW_LIMIT}
                          style={{
                            border: '1px solid #000',
                            padding: '10px 0',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            position: 'relative',
                            background: '#ffffff'
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'space-around',
                            height: '100%',
                            fontWeight: 'bold',
                            fontSize: '12.5px',
                            textTransform: 'uppercase',
                            lineHeight: 1.25,
                            userSelect: 'none',
                            color: '#000'
                          }}>
                            {['M','A','N','N','I','N','G','','A','C','','C','O','A','C','H','E','S'].map((char, ci) => (
                              <span key={ci} style={{ height: char === '' ? '12px' : 'auto' }}>{char}</span>
                            ))}
                          </div>
                        </td>
                      )}

                      {/* 12. Remarks / Nature of Leave */}
                      <td className="ta-cell" style={{ border: '1px solid #000', padding: 0 }}>
                        {!row.isEmptyPadding && (
                          <input
                            type="text"
                            value={row.remarks || ''}
                            onChange={(e) => handleCellChange(idx, 'remarks', e.target.value)}
                            style={{
                              ...cellInputStyle,
                              fontWeight: (row.is_leave || (row.train_no === '---' && row.remarks)) ? 'bold' : 'normal',
                              fontSize: (row.remarks && row.remarks.length > 20) ? '7.5px' : ((row.is_leave || (row.train_no === '---' && row.remarks)) ? '8px' : '9px')
                            }}
                            title={row.remarks || ''}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Page 1 Totals Row (Exact match to Row 56 in Excel) */}
                <tfoot>
                  <tr style={{ background: '#ffffff', fontWeight: 'bold', borderTop: '1.5px solid #000', height: '24px' }}>
                    <td colSpan="8" style={{ border: '1px solid #000', textAlign: 'center', fontSize: '10.5px' }}>
                      TOTAL
                    </td>
                    <td style={{ border: '1px solid #000', fontSize: '11px', fontWeight: 'bold', textAlign: 'center' }}>
                      {page1Total > 0 ? page1Total : (grandTotalDays || '19')}
                    </td>
                    <td style={{ border: '1px solid #000' }}></td>
                    <td style={{ border: '1px solid #000' }}></td>
                    <td style={{ border: '1px solid #000', fontSize: '10px', fontWeight: 'bold', textAlign: 'center' }}>
                      C/F
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Page 1 Footer (Below table) - Right under the table with NO artificial gap */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              fontSize: '10.5px',
              fontWeight: 'bold',
              paddingTop: '20px',
              paddingBottom: '2px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '18px' }}></div>
                <div>Controlling Officer</div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '18px' }}></div>
                <div>Head of the Office</div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '18px' }}></div>
                <input
                  type="text"
                  value={editableMeta.full_name_sign}
                  onChange={(e) => handleMetaChange('full_name_sign', e.target.value)}
                  style={{ fontWeight: 'bold', textAlign: 'center', border: 'none', background: 'transparent', outline: 'none', fontSize: '10.5px', width: '160px' }}
                />
                <div>
                  <input
                    type="text"
                    value={editableMeta.designation_sign}
                    onChange={(e) => handleMetaChange('designation_sign', e.target.value)}
                    style={{ fontWeight: 'bold', textAlign: 'center', border: 'none', background: 'transparent', outline: 'none', fontSize: '9.5px', width: '160px' }}
                  />
                </div>
              </div>
            </div>

          </div>


          {/* ====================================================
             PAGE 2 OF 2 (EXACT REPLICA OF EXCEL SHEET 2)
             ==================================================== */}
          <div className="ta-page-sheet" style={{
            background: '#ffffff',
            color: '#000000',
            width: '100%',
            maxWidth: '215.9mm',
            padding: '12px 14px 14px 14px',
            borderRadius: '4px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
            fontFamily: 'Arial, sans-serif',
            fontSize: '9.5px',
            lineHeight: 1.25,
            boxSizing: 'border-box',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            
            {/* 12-Column Main Table (Page 2 Continuation) */}
            <div>
              <table style={{
                width: '100%',
                tableLayout: 'fixed',
                borderCollapse: 'collapse',
                border: '1.5px solid #000',
                textAlign: 'center',
                fontSize: '9px'
              }}>
                <thead>
                  {/* Repeated Header Row 1 */}
                  <tr style={{ background: '#ffffff', borderBottom: '1px solid #000', fontWeight: 'bold', height: '22px' }}>
                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '12%' }}>
                      Month and Date
                    </th>
                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '7.5%' }}>
                      Train<br/>No.
                    </th>
                    <th colSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '15%' }}>
                      STATIONS
                    </th>
                    <th colSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '13%' }}>
                      TIME
                    </th>
                    <th colSpan="4" style={{ border: '1px solid #000', padding: '2px 1px', width: '24%' }}>
                      DAYS CLAIMING T.A
                    </th>
                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '12%' }}>
                      Object of<br/>Journey
                    </th>
                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '2px 1px', width: '16%' }}>
                      Remarks /<br/>Nature of Leave
                    </th>
                  </tr>
                  {/* Repeated Header Row 2 */}
                  <tr style={{ background: '#ffffff', borderBottom: '1.5px solid #000', fontWeight: 'bold', height: '18px' }}>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '7.5%' }}>FROM</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '7.5%' }}>TO</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '6.5%' }}>DEP.</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '6.5%' }}>ARR.</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '5%' }}>A1</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '5%' }}>A</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '7.5%' }}>B1</th>
                    <th style={{ border: '1px solid #000', padding: '1px', width: '6.5%' }}>Ord.</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: B/F FROM PAGE 01 (Row 68 in Excel) */}
                  <tr style={{ height: '21.5px', fontWeight: 'bold' }}>
                    <td colSpan="8" style={{ border: '1px solid #000', textAlign: 'center', fontSize: '9.5px' }}>
                      B/F FROM PAGE 01
                    </td>
                    <td style={{ border: '1px solid #000' }}></td>
                    <td style={{ border: '1px solid #000' }}></td>
                    
                    {/* Vertical Object of Journey text spanning Page 2 */}
                    <td
                      rowSpan={PAGE2_TOTAL_ROWS + 1}
                      style={{
                        border: '1px solid #000',
                        padding: '10px 0',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        position: 'relative',
                        background: '#ffffff'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'space-around',
                        height: '100%',
                        fontWeight: 'bold',
                        fontSize: '12.5px',
                        textTransform: 'uppercase',
                        lineHeight: 1.25,
                        userSelect: 'none',
                        color: '#000'
                      }}>
                        {['M','A','N','N','I','N','G','','A','C','','C','O','A','C','H','E','S'].map((char, ci) => (
                          <span key={ci} style={{ height: char === '' ? '12px' : 'auto' }}>{char}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ border: '1px solid #000' }}></td>
                  </tr>

                  {/* Page 2 Continuation Rows & Ruled Blank Lines */}
                  {page2Padded.map((row, p2Idx) => {
                    const isTotalRow = (p2Idx === 11); // Row 80 in Excel is summary row

                    if (isTotalRow) {
                      return (
                        <tr key={`p2-total-${p2Idx}`} style={{ height: '21.5px', fontWeight: 'bold' }}>
                          <td style={{ border: '1px solid #000' }}></td>
                          <td style={{ border: '1px solid #000' }}></td>
                          <td colSpan="2" style={{ border: '1px solid #000', textAlign: 'center', fontSize: '9px', fontWeight: 'bold' }}>
                            Total No.Of Days of T.A
                          </td>
                          <td colSpan="2" style={{ border: '1px solid #000', textAlign: 'center', fontSize: '9px', letterSpacing: '2px' }}>
                            &gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt;&gt;
                          </td>
                          <td style={{ border: '1px solid #000' }}></td>
                          <td style={{ border: '1px solid #000' }}></td>
                          <td style={{ border: '1px solid #000', fontSize: '10px', fontWeight: 'bold', textAlign: 'center' }}>
                            {grandTotalDays ? `${grandTotalDays}:00` : '19:00'}
                          </td>
                          <td style={{ border: '1px solid #000', fontSize: '9px', fontWeight: 'bold', textAlign: 'center' }}>
                            DAYS
                          </td>
                          <td style={{ border: '1px solid #000' }}></td>
                        </tr>
                      );
                    }

                    const actualIdx = PAGE1_ROW_LIMIT + p2Idx;
                    return (
                      <tr key={`p2-${p2Idx}`} style={{ height: '21.5px' }}>
                        <td className="ta-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          {!row.isEmptyPadding && (
                            <input
                              type="text"
                              value={row.date_str || ''}
                              onChange={(e) => handleCellChange(actualIdx, 'date_str', e.target.value)}
                              style={cellInputStyle}
                            />
                          )}
                        </td>
                        <td className="ta-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          {!row.isEmptyPadding && (
                            <input
                              type="text"
                              value={row.train_no || ''}
                              onChange={(e) => handleCellChange(actualIdx, 'train_no', e.target.value)}
                              style={cellInputStyle}
                            />
                          )}
                        </td>
                        <td className="ta-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          {!row.isEmptyPadding && (
                            <input
                              type="text"
                              value={row.from_station || ''}
                              onChange={(e) => handleCellChange(actualIdx, 'from_station', e.target.value)}
                              style={cellInputStyle}
                            />
                          )}
                        </td>
                        <td className="ta-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          {!row.isEmptyPadding && (
                            <input
                              type="text"
                              value={row.to_station || ''}
                              onChange={(e) => handleCellChange(actualIdx, 'to_station', e.target.value)}
                              style={cellInputStyle}
                            />
                          )}
                        </td>
                        <td className="ta-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          {!row.isEmptyPadding && (
                            <input
                              type="text"
                              value={row.dep_time || ''}
                              onChange={(e) => handleCellChange(actualIdx, 'dep_time', e.target.value)}
                              style={cellInputStyle}
                            />
                          )}
                        </td>
                        <td className="ta-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          {!row.isEmptyPadding && (
                            <input
                              type="text"
                              value={row.arr_time || ''}
                              onChange={(e) => handleCellChange(actualIdx, 'arr_time', e.target.value)}
                              style={cellInputStyle}
                            />
                          )}
                        </td>
                        <td className="ta-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          {!row.isEmptyPadding && (
                            <input
                              type="text"
                              value={row.ta_a1 || ''}
                              onChange={(e) => handleCellChange(actualIdx, 'ta_a1', e.target.value)}
                              style={cellInputStyle}
                            />
                          )}
                        </td>
                        <td className="ta-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          {!row.isEmptyPadding && (
                            <input
                              type="text"
                              value={row.ta_a || ''}
                              onChange={(e) => handleCellChange(actualIdx, 'ta_a', e.target.value)}
                              style={cellInputStyle}
                            />
                          )}
                        </td>
                        <td className="ta-cell" style={{ border: '1px solid #000', padding: 0, fontWeight: 'bold' }}>
                          {!row.isEmptyPadding && (
                            <input
                              type="text"
                              value={row.ta_b1 !== '' && row.ta_b1 !== null && row.ta_b1 !== undefined ? row.ta_b1 : ''}
                              onChange={(e) => handleCellChange(actualIdx, 'ta_b1', e.target.value)}
                              style={cellInputStyle}
                            />
                          )}
                        </td>
                        <td className="ta-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          {!row.isEmptyPadding && (
                            <input
                              type="text"
                              value={row.ta_ord || ''}
                              onChange={(e) => handleCellChange(actualIdx, 'ta_ord', e.target.value)}
                              style={cellInputStyle}
                            />
                          )}
                        </td>
                        <td className="ta-cell" style={{ border: '1px solid #000', padding: 0 }}>
                          {!row.isEmptyPadding && (
                            <input
                              type="text"
                              value={row.remarks || ''}
                              onChange={(e) => handleCellChange(actualIdx, 'remarks', e.target.value)}
                              style={{
                                ...cellInputStyle,
                                fontWeight: (row.is_leave || (row.train_no === '---' && row.remarks)) ? 'bold' : 'normal',
                                fontSize: (row.remarks && row.remarks.length > 20) ? '7.5px' : ((row.is_leave || (row.train_no === '---' && row.remarks)) ? '8px' : '9px')
                              }}
                              title={row.remarks || ''}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Page 2 — Exact Legal Certification Paragraph from User PDF */}
            <div style={{ paddingTop: '10px' }}>
              <div style={{
                fontSize: '8.5px',
                lineHeight: 1.4,
                textAlign: 'left',
                padding: '4px 2px',
                color: '#000'
              }}>
                <p style={{ margin: '0 0 5px 0' }}>
                  I here by certified that the above mentioned <strong>{editableMeta.name}</strong> is absent on duty<br/>
                  from his headquarters station during period charged for in the bill on Railway business and the that<br/>
                  officer performed the journey by Railway,and was allowed/notallowed Free Pass of Locomotion at the<br/>
                  expenses of Government local fund of Indian State.
                </p>
                <p style={{ margin: '0 0 4px 0' }}>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;No TA/DA Or any other remuneration has been drawn from any other source in respect of the<br/>
                  journeys performed on duty pass and also which TA/DA has been claimed in this journal.<br/>
                  (Countersinged)
                </p>
              </div>

              {/* Page 2 — 3-Column Footer - Pinned flush to bottom */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                fontSize: '10.5px',
                fontWeight: 'bold',
                paddingTop: '16px',
                paddingBottom: '2px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ height: '18px' }}></div>
                  <div>Controlling Officer</div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ height: '18px' }}></div>
                  <div>Head of the Office</div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ height: '18px' }}></div>
                  <input
                    type="text"
                    value={editableMeta.full_name_sign}
                    onChange={(e) => handleMetaChange('full_name_sign', e.target.value)}
                    style={{ fontWeight: 'bold', textAlign: 'center', border: 'none', background: 'transparent', outline: 'none', fontSize: '10.5px', width: '160px' }}
                  />
                  <div>
                    <input
                      type="text"
                      value={editableMeta.designation_sign}
                      onChange={(e) => handleMetaChange('designation_sign', e.target.value)}
                      style={{ fontWeight: 'bold', textAlign: 'center', border: 'none', background: 'transparent', outline: 'none', fontSize: '9.5px', width: '160px' }}
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
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📄</div>
          <h3 style={{ color: 'var(--primary)', marginBottom: '8px' }}>Select an Employee to View Travelling Allowance Journal</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 16px' }}>
            Choose a Category and Employee from the dropdown above to load and edit their official 2-page TA Claim Journal.
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
