const { getDayOffset, getBaseLinkNumber } = require('./rotation');
const { getDutyRowsForLinkNumber } = require('./ta_generator');
const { compareDutyAndResolve, isRestString } = require('./duty_comparator');

/**
 * Generate complete DIARY / E.F.T Earnings Statement for a staff member for a given month/year or date range
 * Synced departure & arrival timings from TA document are automatically copied!
 */
async function generateStaffDiary(db, staffId, year, month, startDate = null, endDate = null) {
  const { get, all } = db;
  const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
  if (!staff) {
    return {
      notFound: true,
      employee: { id: staffId, name: 'Staff Member Removed', designation: '' },
      rows: [],
      period_label: '',
      year,
      month
    };
  }

  const category = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
  if (!category) {
    return {
      notFound: true,
      employee: staff,
      rows: [],
      period_label: '',
      year,
      month
    };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const todayIso = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;

  const y = parseInt(year, 10) || currentYear;
  const m = parseInt(month, 10) || currentMonth;
  const daysInMonth = new Date(y, m, 0).getDate();
  const monthYearStr = `${y}-${String(m).padStart(2, '0')}`;

  const isCurrentMonth = (y === currentYear && m === currentMonth);
  const isFutureMonth = (y > currentYear || (y === currentYear && m > currentMonth));

  // Determine up-to-date cutoff for current/past/future month
  const maxDay = isCurrentMonth ? Math.min(daysInMonth, currentDay) : (isFutureMonth ? 0 : daysInMonth);
  const upToDateIso = `${y}-${String(m).padStart(2, '0')}-${String(maxDay > 0 ? maxDay : 1).padStart(2, '0')}`;

  const prevYr = m === 1 ? y - 1 : y;
  const prevMo = m === 1 ? 12 : m - 1;
  const maxDaysPrev = new Date(prevYr, prevMo, 0).getDate();
  const prev30thDay = Math.min(30, maxDaysPrev);
  const prevMonth30thIso = `${prevYr}-${String(prevMo).padStart(2, '0')}-${String(prev30thDay).padStart(2, '0')}`;

  let actualStart = (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) ? startDate : prevMonth30thIso;
  let actualEnd = (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) ? endDate : (isCurrentMonth ? upToDateIso : `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`);

  // Enforce: Diary should be shown up to date only; do not show estimation for the whole month
  if (isCurrentMonth && actualEnd > todayIso) {
    actualEnd = todayIso;
  }
  if (isFutureMonth) {
    return {
      employee: {
        id: staff.id,
        name: staff.name,
        designation: staff.designation || 'CTI',
        branch: 'COMMERCIAL',
        division: 'GNT',
        hq: staff.hq_station || 'GNT',
        pay: staff.pay_amount || 68000,
        pf_no: (staff.pf_no && staff.pf_no !== '07323475') ? String(staff.pf_no) : '',
        bill_unit: (staff.bill_unit && staff.bill_unit !== '0910629') ? String(staff.bill_unit) : '',
        t_code_no: staff.t_code_no || '2410',
        category_name: category.name,
        category_code: category.code
      },
      month_year: monthYearStr,
      month_name: new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long' }).toUpperCase(),
      period_label: `${actualStart.split('-').reverse().join('/')} to ${todayIso.split('-').reverse().join('/')}`,
      start_date: actualStart,
      end_date: todayIso,
      year: y,
      month: m,
      rows: [],
      totals: {
        total_issued: 0,
        no_of_cases: 0,
        collected_rs: 0,
        gst_cases: 0,
        gst_amount: 0,
        total_amount: 0,
        remit_amount: 0
      }
    };
  }

  const rawLinks = await all('SELECT * FROM links ORDER BY category_id ASC, link_number ASC, effective_from ASC');
  const allLinks = rawLinks.filter(l =>
    l.status !== 'draft' &&
    (!l.effective_from || l.effective_from <= actualEnd) &&
    (!l.effective_to || l.effective_to >= actualStart)
  );
  const linkMap = {};
  allLinks.forEach(l => {
    linkMap[`${l.category_id}_${l.link_number}`] = l;
    if (l.category_id === category.id) {
      linkMap[l.link_number] = l;
    }
  });

  const getLinkNumForDate = (dateIso) => {
    const curAnchor = category.id === 2
      ? (dateIso < '2026-10-01' ? '2026-08-01' : '2026-10-01')
      : category.anchor_date;
    const curCycle = category.id === 2
      ? (dateIso < '2026-10-01' ? 63 : 56)
      : category.cycle_length;
    const offset = getDayOffset(curAnchor, dateIso);
    return getBaseLinkNumber(staff.row_position, offset, curCycle);
  };

  function resolveDutyDateIso(r) {
    if (r.duty_date && /^\d{4}-\d{2}-\d{2}$/.test(r.duty_date)) return r.duty_date;
    if (r.date_iso && /^\d{4}-\d{2}-\d{2}$/.test(r.date_iso)) return r.date_iso;
    if (r.date_str) {
      const parts = r.date_str.trim().split('/');
      if (parts.length === 3) {
        let [d, mStr, yr] = parts;
        if (yr.length === 2) yr = '20' + yr;
        return `${yr}-${mStr.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }
    return null;
  }

  // 1. Fetch saved custom entries from diary_entries if present (for full-month view)
  const allSavedEntries = await all(
    `SELECT * FROM diary_entries 
     WHERE staff_id = ? ORDER BY id ASC`,
    [staffId]
  );
  const savedEntries = (allSavedEntries || []).filter(r => {
    const dIso = resolveDutyDateIso(r);
    return dIso && dIso >= actualStart && dIso <= actualEnd;
  });

  // 2. Fetch TA entries for this staff in date range to copy synced timings
  const taEntries = await all(
    `SELECT * FROM ta_entries 
     WHERE staff_id = ? AND (
       (duty_date >= ? AND duty_date <= ?) OR 
       month_year = ?
     ) ORDER BY row_order ASC`,
    [staffId, actualStart, actualEnd, monthYearStr]
  );
  const taMap = {};
  if (Array.isArray(taEntries)) {
    taEntries.forEach((r, idx) => {
      taMap[`${r.date_str}_${r.train_no}`] = r;
      taMap[`${r.duty_date}_${r.train_no}`] = r;
      taMap[`row_${r.row_order}`] = r;
      taMap[`idx_${idx}`] = r;
    });
  }

  // SQLite cache lookup for live train runs
  const cachedRuns = await all(
    'SELECT * FROM actual_train_runs WHERE run_date >= ? AND run_date <= ?',
    [actualStart, actualEnd]
  );
  const cacheMap = {};
  if (Array.isArray(cachedRuns)) {
    cachedRuns.forEach(r => {
      cacheMap[`${r.train_no}_${r.run_date}_${r.station_code}`] = r;
    });
  }

  // Fetch muster records for this staff in date range
  const musterRecords = await all(
    'SELECT * FROM muster_records WHERE staff_id = ? AND date >= ? AND date <= ?',
    [staff.id, actualStart, actualEnd]
  );
  const musterMap = {};
  if (Array.isArray(musterRecords)) {
    musterRecords.forEach(m => {
      musterMap[m.date] = m;
    });
  }

  // Fetch direct & substitute overrides for this staff in date range
  const overridesRecords = await all(
    'SELECT * FROM overrides WHERE (staff_id = ? OR substitute_staff_id = ?) AND date >= ? AND date <= ?',
    [staff.id, staff.id, actualStart, actualEnd]
  );
  const directOverrideMap = {};
  const subOverrideMap = {};
  if (Array.isArray(overridesRecords)) {
    overridesRecords.forEach(o => {
      if (o.staff_id === staff.id) directOverrideMap[o.date] = o;
      if (o.substitute_staff_id === staff.id) subOverrideMap[o.date] = o;
    });
  }

  // Fetch LR Sheet records & Daily Earnings entries for universal linkage
  const lrRecords = await all(
    'SELECT * FROM lr_sheet_records WHERE staff_id = ? AND date >= ? AND date <= ?',
    [staff.id, actualStart, actualEnd]
  );
  const lrMap = {};
  if (Array.isArray(lrRecords)) {
    lrRecords.forEach(r => {
      lrMap[r.date] = r;
    });
  }

  const earnRecords = await all(
    'SELECT * FROM daily_earnings_entries WHERE staff_id = ? AND date >= ? AND date <= ?',
    [staff.id, actualStart, actualEnd]
  );
  const earnMap = {};
  if (Array.isArray(earnRecords)) {
    earnRecords.forEach(e => {
      earnMap[e.date] = e;
    });
  }

  // Index saved entries by ISO date so any date updated in Daily Summary / Muster / LR Sheet regenerates cleanly
  const savedByDateMap = {};
  if (Array.isArray(savedEntries)) {
    savedEntries.forEach(r => {
      const dIso = resolveDutyDateIso(r);
      if (dIso) {
        if (!savedByDateMap[dIso]) savedByDateMap[dIso] = [];
        savedByDateMap[dIso].push(r);
      }
    });
  }

  // Generate date list between actualStart and actualEnd
  const dateList = [];
  const curD = new Date(actualStart + 'T12:00:00');
  const endD = new Date(actualEnd + 'T12:00:00');

  while (curD <= endD) {
    const cy = curD.getFullYear();
    const cm = String(curD.getMonth() + 1).padStart(2, '0');
    const cd = String(curD.getDate()).padStart(2, '0');
    dateList.push(`${cy}-${cm}-${cd}`);
    curD.setDate(curD.getDate() + 1);
  }

  const rows = [];
  let rowOrder = 0;

  // Check previous day if start date is 1st of month and ends on overnight train
  if (actualStart.endsWith('-01')) {
    const prevMonthLastDate = new Date(year, month - 1, 0);
    const prevIso = `${prevMonthLastDate.getFullYear()}-${String(prevMonthLastDate.getMonth() + 1).padStart(2, '0')}-${String(prevMonthLastDate.getDate()).padStart(2, '0')}`;
    const prevLinkNum = getLinkNumForDate(prevIso);

    const firstDayLinkNum = getLinkNumForDate(actualStart);
    if (category.id === 1 && firstDayLinkNum === 11) {
      rowOrder++;
      const prevDateDisplay = `${prevMonthLastDate.getDate()}/${prevMonthLastDate.getMonth() + 1}/${String(prevMonthLastDate.getFullYear()).slice(-2)}`;
      
      let actualDep = '22:50';
      const taMatch = taMap[`${prevDateDisplay}_12734`] || taMap[`row_1`] || taMap[`idx_0`];
      if (taMatch && taMatch.dep_time && taMatch.dep_time !== '---') {
        actualDep = taMatch.dep_time;
      } else {
        const cached = cacheMap[`12734_${prevIso}_GNT`];
        if (cached && cached.act_dep && cached.act_dep !== '---') {
          actualDep = cached.act_dep;
        }
      }

      rows.push({
        id: null,
        row_order: rowOrder,
        link_number: prevLinkNum || 10,
        date_str: prevDateDisplay,
        date_iso: prevIso,
        is_same_date_as_prev: false,
        train_no: '12734',
        dep_time: actualDep,
        arr_time: '---',
        from_station: 'GNT',
        to_station: '---',
        eft_from: '',
        eft_to: '',
        total_issued: null,
        no_of_cases: null,
        collected_rs: null,
        gst_cases: null,
        gst_amount: null,
        total_amount: null,
        remit_station: '',
        remit_mr_no: '',
        remit_date: '',
        remit_amount: null
      });
    }
  }

  for (const dateStrIso of dateList) {
    const dParts = dateStrIso.split('-');
    const dateStrDisplay = `${parseInt(dParts[2], 10)}/${parseInt(dParts[1], 10)}/${dParts[0].slice(-2)}`;

    const muster = musterMap[dateStrIso];
    const musterCode = muster ? muster.code.toUpperCase() : null;
    const directOverride = directOverrideMap[dateStrIso];
    const subOverride = subOverrideMap[dateStrIso];
    const lrEntry = lrMap[dateStrIso];
    const earnEntry = earnMap[dateStrIso];
    const override = directOverride || subOverride || (earnEntry && earnEntry.duty && earnEntry.duty !== 'REST' && !isRestString(earnEntry.duty) ? {
      extra_train_no: (/^\d{4,5}(?:\/\d{4,5})?$/.test(earnEntry.duty.trim()) ? earnEntry.duty.trim() : null),
      overridden_link_number: (earnEntry.duty.match(/(?:Link|link)\s*#?\s*(\d+)/i) ? parseInt(earnEntry.duty.match(/(?:Link|link)\s*#?\s*(\d+)/i)[1], 10) : null),
      reason: earnEntry.remarks || earnEntry.duty,
      status: 'DUTY'
    } : (earnEntry && (earnEntry.duty === 'REST' || isRestString(earnEntry.duty)) ? {
      status: 'REST',
      reason: earnEntry.remarks || 'Rest Day'
    } : null));

    const isMusterLeave = muster && ['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'SICK', 'CR', 'R', 'O', 'NH'].includes(musterCode);
    const isDirectLeave = directOverride && (['LEAVE', 'SICK', 'CR', 'REST', 'ABSENT', 'MARK_LATER'].includes(directOverride.status) || directOverride.leave_type);

    // If custom Diary rows were saved for this date and the staff member was not subsequently marked on leave/rest/standby
    if (savedByDateMap[dateStrIso] && savedByDateMap[dateStrIso].length > 0 && !isMusterLeave && !isDirectLeave) {
      for (const sRow of savedByDateMap[dateStrIso]) {
        rowOrder++;
        rows.push({
          ...sRow,
          row_order: rowOrder,
          date_iso: dateStrIso,
          is_same_date_as_prev: rows.length > 0 && rows[rows.length - 1].date_str === sRow.date_str
        });
      }
      continue;
    }

    let origLinkNum = null;
    let origTrain = null;
    let origIsRest = false;

    if (category.id !== 4) {
      origLinkNum = getLinkNumForDate(dateStrIso);
      const link = linkMap[origLinkNum];
      origIsRest = !link || link.is_rest === 1 || isRestString(link.train_numbers);
      origTrain = origIsRest ? 'REST' : (link.train_numbers || 'REST');
    } else {
      const lrCode = (lrEntry && lrEntry.duty_code)
        ? lrEntry.duty_code
        : (directOverride && (directOverride.extra_train_no || directOverride.advance_train_no || (directOverride.overridden_link_number ? `Link #${directOverride.overridden_link_number}` : directOverride.reason)))
          ? (directOverride.extra_train_no || directOverride.advance_train_no || (directOverride.overridden_link_number ? `Link #${directOverride.overridden_link_number}` : directOverride.reason))
          : (subOverride && (subOverride.extra_train_no || (subOverride.overridden_link_number ? `Link #${subOverride.overridden_link_number}` : (subOverride.original_link_number ? `Link #${subOverride.original_link_number}` : subOverride.reason))))
            ? (subOverride.extra_train_no || (subOverride.overridden_link_number ? `Link #${subOverride.overridden_link_number}` : (subOverride.original_link_number ? `Link #${subOverride.original_link_number}` : subOverride.reason)))
            : (earnEntry && earnEntry.duty ? earnEntry.duty : null);
      const dutyCode = lrCode;
      origIsRest = !dutyCode ? (isRestString(override ? override.status : null) || isRestString(musterCode)) : isRestString(dutyCode);
      origTrain = origIsRest ? 'REST' : (dutyCode || 'SPARE (HQ)');
    }

    const remarksStr = (override && override.reason) || (earnEntry && earnEntry.remarks) || (muster ? muster.remarks : '') || (lrEntry ? lrEntry.remarks : '') || '';

    const cmp = compareDutyAndResolve({
      origTrain,
      origIsRest,
      origLinkNum,
      actualLinkNum: override?.overridden_link_number !== undefined ? override.overridden_link_number : null,
      targetCategoryId: override?.target_category_id || category.id,
      remarks: remarksStr,
      overrideDuty: override,
      muster,
      allLinks: Object.values(linkMap),
      categoryId: category.id,
      dateStr: dateStrIso
    });

    // Condition 3: If employee rest day and both columns declared rest -> Skip in DIARY!
    if (cmp.action === 'SKIP' || cmp.isRest) {
      continue;
    }

    if (cmp.action === 'STANDBY') {
      continue;
    }

    if (cmp.action === 'LEAVE') {
      rowOrder++;
      rows.push({
        id: null,
        row_order: rowOrder,
        link_number: null,
        date_str: dateStrDisplay,
        date_iso: dateStrIso,
        is_same_date_as_prev: false,
        train_no: '-',
        dep_time: '---',
        arr_time: '---',
        from_station: 'GNT',
        to_station: '---',
        eft_from: '',
        eft_to: '',
        total_issued: null,
        no_of_cases: null,
        collected_rs: null,
        gst_cases: null,
        gst_amount: null,
        total_amount: null,
        remit_station: '',
        remit_mr_no: '',
        remit_date: '',
        remit_amount: null,
        remarks: `ON LEAVE (${cmp.leaveCode})`
      });
      continue;
    }

    let duties = cmp.duty_rows;
    if (!duties || duties.length === 0) {
      if (cmp.train_no) {
        duties = [{ train_no: cmp.train_no, from: 'GNT', to: '---', dep: '17:45', arr: '---' }];
      } else {
        continue;
      }
    }

    const effectiveLinkNum = (override && override.overridden_link_number) ? override.overridden_link_number : origLinkNum;

    // Extract linked earnings from Daily Earnings Sheet if available for this date
    let dayCases = null;
    let dayCollected = null;
    let dayGstAmt = null;
    let dayTotalAmt = null;
    if (earnEntry) {
      const c = (parseInt(earnEntry.twt_nc, 10) || 0) + (parseInt(earnEntry.ir_nc, 10) || 0) + (parseInt(earnEntry.ubl_nc, 10) || 0) + (parseInt(earnEntry.z652_nc, 10) || 0) + (parseInt(earnEntry.oc_nc, 10) || 0);
      const col = (parseFloat(earnEntry.twt_fare) || 0) + (parseFloat(earnEntry.twt_penalty) || 0) + (parseFloat(earnEntry.ir_fare) || 0) + (parseFloat(earnEntry.ir_penalty) || 0) + (parseFloat(earnEntry.ubl_amt) || 0) + (parseFloat(earnEntry.z652_amt) || 0) + (parseFloat(earnEntry.oc_amt) || 0);
      const g = parseFloat(earnEntry.gst) || 0;
      const tot = col + g;
      if (c > 0) dayCases = c;
      if (col > 0) dayCollected = col;
      if (g > 0) dayGstAmt = g;
      if (tot > 0) dayTotalAmt = tot;
    }

    for (let dIdx = 0; dIdx < duties.length; dIdx++) {
      const duty = duties[dIdx];
      rowOrder++;
      
      let actualDep = duty.dep || '---';
      let actualArr = duty.arr || '---';

      // 1. Inherit from synced TA entry if available!
      const taMatch = taMap[`${dateStrDisplay}_${duty.train_no}`] || taMap[`${dateStrIso}_${duty.train_no}`] || taMap[`row_${rowOrder}`];
      if (taMatch) {
        if (duty.dep && duty.dep !== '---' && taMatch.dep_time && taMatch.dep_time !== '---') actualDep = taMatch.dep_time;
        if (duty.arr && duty.arr !== '---' && taMatch.arr_time && taMatch.arr_time !== '---') actualArr = taMatch.arr_time;
      } else {
        // 2. Or from actual_train_runs cache
        if (duty.dep && duty.dep !== '---' && duty.from && duty.from !== '---' && cacheMap[`${duty.train_no}_${dateStrIso}_${duty.from}`]) {
          const cached = cacheMap[`${duty.train_no}_${dateStrIso}_${duty.from}`];
          if (cached.act_dep && cached.act_dep !== '---') actualDep = cached.act_dep;
        }
        if (duty.arr && duty.arr !== '---' && duty.to && duty.to !== '---' && cacheMap[`${duty.train_no}_${dateStrIso}_${duty.to}`]) {
          const cached = cacheMap[`${duty.train_no}_${dateStrIso}_${duty.to}`];
          if (cached.act_arr && cached.act_arr !== '---') actualArr = cached.act_arr;
        }
      }

      if (!duty.dep || duty.dep === '---') actualDep = '---';
      if (!duty.arr || duty.arr === '---') actualArr = '---';

      rows.push({
        id: null,
        row_order: rowOrder,
        link_number: effectiveLinkNum,
        date_str: dateStrDisplay,
        date_iso: dateStrIso,
        is_same_date_as_prev: rows.length > 0 && rows[rows.length - 1].date_str === dateStrDisplay,
        train_no: duty.train_no,
        dep_time: actualDep,
        arr_time: actualArr,
        from_station: duty.from || '',
        to_station: duty.to || '',
        eft_from: '',
        eft_to: '',
        total_issued: null,
        no_of_cases: dIdx === 0 ? dayCases : null,
        collected_rs: dIdx === 0 ? dayCollected : null,
        gst_cases: null,
        gst_amount: dIdx === 0 ? dayGstAmt : null,
        total_amount: dIdx === 0 ? dayTotalAmt : null,
        remit_station: '',
        remit_mr_no: '',
        remit_date: '',
        remit_amount: null
      });
    }
  }

  const totalIssued = rows.reduce((sum, r) => sum + (parseInt(r.total_issued, 10) || 0), 0);
  const totalCases = rows.reduce((sum, r) => sum + (parseInt(r.no_of_cases, 10) || 0), 0);
  const totalCollected = rows.reduce((sum, r) => sum + (parseFloat(r.collected_rs) || 0), 0);
  const totalGstCases = rows.reduce((sum, r) => sum + (parseInt(r.gst_cases, 10) || 0), 0);
  const totalGstAmount = rows.reduce((sum, r) => sum + (parseFloat(r.gst_amount) || 0), 0);
  const grandTotal = rows.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
  const totalRemit = rows.reduce((sum, r) => sum + (parseFloat(r.remit_amount) || 0), 0);

  return {
    employee: {
      id: staff.id,
      name: staff.name,
      designation: staff.designation || 'CTI',
      t_code_no: staff.t_code_no || '7133',
      branch: 'COMMERCIAL',
      division: 'GNT',
      hq: staff.hq_station || 'GNT',
      pay: staff.pay_amount || 68000,
      pf_no: (staff.pf_no && staff.pf_no !== '07323475') ? String(staff.pf_no) : '',
      bill_unit: (staff.bill_unit && staff.bill_unit !== '0910629') ? String(staff.bill_unit) : '',
      category_name: category.name,
      category_code: category.code
    },
    month_year: monthYearStr,
    month_name: new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long' }).toUpperCase(),
    period_label: `${actualStart.split('-').reverse().join('/')} to ${actualEnd.split('-').reverse().join('/')}`,
    start_date: actualStart,
    end_date: actualEnd,
    year: y,
    month: m,
    rows,
    totals: {
      total_issued: totalIssued,
      total_cases: totalCases,
      total_collected: totalCollected,
      total_gst_cases: totalGstCases,
      total_gst_amount: totalGstAmount,
      grand_total_amount: grandTotal,
      total_remit_amount: totalRemit
    }
  };
}

module.exports = {
  generateStaffDiary
};

export {
  generateStaffDiary
};

