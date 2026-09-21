const { getDayOffset, getBaseLinkNumber } = require('./rotation');
const { getDutyRowsForLinkNumber } = require('./ta_generator');

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
 * Calculate NDA Points (1 hour worked between 22:00 and 06:00 = 1 NDA point)
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
    if (trainNo === '12734') priorNight = 70; // 22:50 to 24:00
    else if (trainNo === '12733') priorNight = 120; // 22:00 to 24:00
    else if (trainNo === '18047') priorNight = 120;
    else if (trainNo === '17226') priorNight = 120;
    else if (trainNo === '17261') priorNight = 120;
    else if (trainNo === '20629') priorNight = 120;
    else if (trainNo === '20630') priorNight = 30; // 23:30 to 24:00
    else if (trainNo === '12604') priorNight = 80; // 22:40 to 24:00
    else priorNight = 120;

    const morningMins = Math.min(arrMins, 360);
    const totalNight = priorNight + morningMins;
    if (totalNight <= 0) return null;
    return Math.round(totalNight / 60);
  }

  return null;
}

/**
 * Generate complete NDA Journal for a staff member for a given month/year
 * SCHEDULE contains expected timetable times, ACTUAL contains synced/real NTES times
 */
async function generateStaffNdaJournal(db, staffId, year, month, startDate = null, endDate = null) {
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
  let actualEnd = (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) ? endDate : (isCurrentMonth ? upToDateIso : `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`);

  if (isCurrentMonth && actualEnd > todayIso) {
    actualEnd = todayIso;
  }
  if (isFutureMonth) {
    actualEnd = actualStart;
  }

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

  // 1. Fetch saved custom entries from nda_entries if present in date range
  const allSavedEntries = await all(
    `SELECT * FROM nda_entries 
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

  // If saved entries exist for this period, return them
  if (savedEntries && savedEntries.length > 0 && !startDate && !endDate) {
    const fixedRows = savedEntries.map((r, idx) => {
      let schedDep = r.sched_dep || '';
      let schedArr = r.sched_arr || '';
      let actDep = r.act_dep || '---';
      let actArr = r.act_arr || '---';

      const dIso = resolveDutyDateIso(r);
      const mRec = dIso ? musterMap[dIso] : null;
      const isMusterLeave = mRec && ['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'SICK', 'CR', 'R', 'O', 'NH'].includes(mRec.code.toUpperCase());

      return {
        ...r,
        sched_dep: schedDep,
        sched_arr: schedArr,
        act_dep: actDep,
        act_arr: actArr,
        night_hours: isMusterLeave ? null : r.night_hours,
        remarks: isMusterLeave ? `Disallowed: On Leave/Absent as per Muster Chart (${mRec.code.toUpperCase()})` : (r.remarks || ''),
        is_same_date_as_prev: idx > 0 && r.date_str === savedEntries[idx - 1].date_str
      };
    });

    const totalHours = fixedRows.reduce((sum, r) => sum + (parseFloat(r.night_hours) || 0), 0);
    return {
      employee: {
        id: staff.id,
        name: staff.name,
        designation: staff.designation || 'CTI',
        branch: 'COMMERCIAL',
        division: 'GNT',
        hq: staff.hq_station || 'GNT',
        pay: staff.pay_amount || 68000,
        pf_no: staff.pf_no || '07323475',
        bill_unit: staff.bill_unit || '0910629',
        doa: staff.doa || '05/08/2000',
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
      rows: fixedRows,
      total_night_hours: Math.round(totalHours)
    };
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

  for (const dateStrIso of dateList) {
    const dParts = dateStrIso.split('-');
    const dateStrDisplay = `${parseInt(dParts[2], 10)}/${parseInt(dParts[1], 10)}/${dParts[0].slice(-2)}`;

    const muster = musterMap[dateStrIso];
    const musterCode = muster ? muster.code.toUpperCase() : null;
    const isMusterLeave = muster && ['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'SICK', 'CR', 'R', 'O', 'NH'].includes(musterCode);

    const override = overrideMap[dateStrIso];

    if (isMusterLeave || (override && (['LEAVE', 'SICK', 'CR', 'REST', 'ABSENT'].includes(override.status) || override.leave_type))) {
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
      const schedDep = '';
      const schedArr = '';

      let actualDep = duty.dep || '---';
      let actualArr = duty.arr || '---';

      // 1. Inherit from synced TA entry if available
      const taMatch = taMap[`${dateStrDisplay}_${duty.train_no}`] || taMap[`${dateStrIso}_${duty.train_no}`] || taMap[`row_${rowOrder}`];
      if (taMatch) {
        if (taMatch.dep_time && taMatch.dep_time !== '---') actualDep = taMatch.dep_time;
        if (taMatch.arr_time && taMatch.arr_time !== '---') actualArr = taMatch.arr_time;
      } else {
        // 2. Or from actual_train_runs cache
        if (duty.from && cacheMap[`${duty.train_no}_${dateStrIso}_${duty.from}`]) {
          const cached = cacheMap[`${duty.train_no}_${dateStrIso}_${duty.from}`];
          if (cached.act_dep && cached.act_dep !== '---') actualDep = cached.act_dep;
        }
        if (duty.to && cacheMap[`${duty.train_no}_${dateStrIso}_${duty.to}`]) {
          const cached = cacheMap[`${duty.train_no}_${dateStrIso}_${duty.to}`];
          if (cached.act_arr && cached.act_arr !== '---') actualArr = cached.act_arr;
        }
      }

      const nightHours = calculateNightDutyHours(actualDep, actualArr, duty.from, duty.to, duty.train_no);

      rows.push({
        id: null,
        row_order: rowOrder,
        link_number: linkNum,
        date_str: dateStrDisplay,
        date_iso: dateStrIso,
        is_same_date_as_prev: rows.length > 0 && rows[rows.length - 1].date_str === dateStrDisplay,
        train_no: duty.train_no,
        sched_dep: schedDep,
        sched_arr: schedArr,
        act_dep: actualDep,
        act_arr: actualArr,
        from_station: duty.from,
        to_station: duty.to,
        night_hours: nightHours
      });
    }
  }

  const totalHours = rows.reduce((sum, r) => sum + (parseFloat(r.night_hours) || 0), 0);

  return {
    employee: {
      id: staff.id,
      name: staff.name,
      designation: staff.designation || 'CTI',
      branch: 'COMMERCIAL',
      division: 'GNT',
      hq: staff.hq_station || 'GNT',
      pay: staff.pay_amount || 68000,
      pf_no: staff.pf_no || '07323475',
      bill_unit: staff.bill_unit || '0910629',
      doa: staff.doa || '05/08/2000',
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
    total_night_hours: Math.round(totalHours)
  };
}

module.exports = {
  generateStaffNdaJournal,
  calculateNightDutyHours
};
