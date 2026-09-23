const { getDayOffset, getBaseLinkNumber } = require('./rotation');
const { getDutyRowsForLinkNumber } = require('./ta_generator');

/**
 * Generate complete DIARY / E.F.T Earnings Statement for a staff member for a given month/year or date range
 * Synced departure & arrival timings from TA document are automatically copied!
 */
async function generateStaffDiary(db, staffId, year, month, startDate = null, endDate = null) {
  const { get, all } = db;
  const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
  if (!staff) throw new Error(`Staff with ID ${staffId} not found`);

  const category = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
  if (!category) throw new Error(`Category for staff ID ${staffId} not found`);

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
  let actualEnd = (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) ? endDate : `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  const allLinks = await all('SELECT * FROM links ORDER BY category_id ASC, link_number ASC');
  const linkMap = {};
  allLinks.forEach(l => {
    linkMap[`${l.category_id}_${l.link_number}`] = l;
    if (l.category_id === category.id) {
      linkMap[l.link_number] = l;
    }
  });

  const getLinkNumForDate = (dateIso) => {
    const offset = getDayOffset(category.anchor_date, dateIso);
    return getBaseLinkNumber(staff.row_position, offset, category.cycle_length);
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

  // If saved entries exist for this period and no custom date range is requested, return them
  if (savedEntries && savedEntries.length > 0 && !startDate && !endDate) {
    const totalIssued = savedEntries.reduce((sum, r) => sum + (parseInt(r.total_issued, 10) || 0), 0);
    const totalCases = savedEntries.reduce((sum, r) => sum + (parseInt(r.no_of_cases, 10) || 0), 0);
    const totalCollected = savedEntries.reduce((sum, r) => sum + (parseFloat(r.collected_rs) || 0), 0);
    const totalGstCases = savedEntries.reduce((sum, r) => sum + (parseInt(r.gst_cases, 10) || 0), 0);
    const totalGstAmount = savedEntries.reduce((sum, r) => sum + (parseFloat(r.gst_amount) || 0), 0);
    const grandTotal = savedEntries.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    const totalRemit = savedEntries.reduce((sum, r) => sum + (parseFloat(r.remit_amount) || 0), 0);

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
        pf_no: staff.pf_no || '07323475',
        bill_unit: staff.bill_unit || '0910629',
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
      rows: savedEntries.map((r, idx) => ({
        ...r,
        is_same_date_as_prev: idx > 0 && r.date_str === savedEntries[idx - 1].date_str
      })),
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

  // Fetch overrides for this staff in date range
  const overridesRecords = await all(
    'SELECT * FROM overrides WHERE staff_id = ? AND date >= ? AND date <= ?',
    [staff.id, actualStart, actualEnd]
  );
  const overrideMap = {};
  if (Array.isArray(overridesRecords)) {
    overridesRecords.forEach(o => {
      overrideMap[o.date] = o;
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
    const isMusterLeave = muster && ['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'SICK', 'CR', 'R', 'O', 'NH'].includes(musterCode);

    const override = overrideMap[dateStrIso];

    if (isMusterLeave || (override && (['LEAVE', 'SICK', 'CR', 'REST', 'ABSENT'].includes(override.status) || override.leave_type))) {
      rowOrder++;
      const effCode = musterCode || (override ? (override.leave_type || override.status) : 'LEAVE');
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
        remarks: `ON LEAVE / REST (${effCode})`
      });
      continue;
    }

    let duties = [];
    let linkNum = null;

    if (override && (override.status === 'CHANGED_LINK' || override.status === 'SUBSTITUTE')) {
      const targetCatId = override.target_category_id || category.id;
      linkNum = override.overridden_link_number;
      duties = getDutyRowsForLinkNumber(targetCatId, linkNum, linkMap[`${targetCatId}_${linkNum}`] || linkMap[linkNum]);
    } else if (override && (override.status === 'EXTRA_CREW' || override.is_extra === 1 || override.extra_train_no)) {
      const trNo = override.extra_train_no || 'EXTRA';
      duties = [{ train_no: trNo, from: 'GNT', to: '---', dep: '17:45', arr: '---' }];
    } else if (override && (override.status === 'UTILISED_ADVANCE' || override.advance_train_no)) {
      const trNo = override.advance_train_no || 'ADVANCE';
      duties = [{ train_no: trNo, from: 'GNT', to: '---', dep: '17:45', arr: '---' }];
    } else {
      linkNum = getLinkNumForDate(dateStrIso);
      const link = linkMap[linkNum];
      duties = getDutyRowsForLinkNumber(category.id, linkNum, link);
    }

    for (const duty of duties) {
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
        link_number: linkNum,
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
      pf_no: staff.pf_no || '07323475',
      bill_unit: staff.bill_unit || '0910629',
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
      total_issued: 0,
      total_cases: 0,
      total_collected: 0,
      total_gst_cases: 0,
      total_gst_amount: 0,
      grand_total_amount: 0,
      total_remit_amount: 0
    }
  };
}

module.exports = {
  generateStaffDiary
};
