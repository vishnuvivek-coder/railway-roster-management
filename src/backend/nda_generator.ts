const { generateStaffTaJournal } = require('./ta_generator');

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
 * Generate complete NDA Journal for a staff member for a given month/year.
 * Uses generateStaffTaJournal as the definitive single source of truth for all
 * duties, link rotations, multi-day sets, non-daily/special trains, and timings.
 */
async function generateStaffNdaJournal(db, staffId, year, month, startDate = null, endDate = null) {
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

  // 1. Generate the authoritative TA Journal (Single Source of Truth)
  const taJournal = await generateStaffTaJournal(db, staffId, year, month, startDate, endDate);
  if (!taJournal || !taJournal.rows) {
    return {
      employee: staff,
      month_year: `${year}-${String(month).padStart(2, '0')}`,
      period_label: '',
      year,
      month,
      rows: [],
      total_night_hours: 0
    };
  }

  const monthYearStr = taJournal.month_year || `${year}-${String(month).padStart(2, '0')}`;

  // 2. Fetch saved custom entries from nda_entries for this staff member and month
  const allSavedEntries = await all(
    `SELECT * FROM nda_entries 
     WHERE staff_id = ? AND month_year = ? ORDER BY row_order ASC, id ASC`,
    [staffId, monthYearStr]
  );
  const savedEntries = allSavedEntries || [];

  const savedNdaMap = {};
  savedEntries.forEach(s => {
    if (s.date_str && s.train_no) {
      savedNdaMap[`${s.date_str}_${s.train_no}`] = s;
    }
  });

  const rows = [];
  let rowOrder = 0;

  for (const taRow of taJournal.rows) {
    // Railway Rule: Leave days and rest days are omitted from the official NDA journal (allowance only for worked train runs)
    if (taRow.is_leave || taRow.train_no === '---' || !taRow.train_no) {
      continue;
    }

    rowOrder++;
    const trainNo = taRow.train_no;
    const dateStr = taRow.date_str;
    const dateIso = taRow.date_iso || taRow.duty_date;

    let actDep = (taRow.dep_time && taRow.dep_time !== '---') ? taRow.dep_time : '';
    let actArr = (taRow.arr_time && taRow.arr_time !== '---') ? taRow.arr_time : '';
    let fromStn = (taRow.from_station && taRow.from_station !== '---') ? taRow.from_station : '';
    let toStn = (taRow.to_station && taRow.to_station !== '---') ? taRow.to_station : '';

    let nightHours = calculateNightDutyHours(actDep, actArr, fromStn, toStn, trainNo);

    // If there is an existing saved custom nda_entry matching this date and train, overlay custom edits
    const saved = savedNdaMap[`${dateStr}_${trainNo}`];
    if (saved) {
      if (saved.night_hours !== null && saved.night_hours !== undefined) {
        nightHours = parseFloat(saved.night_hours);
      }
      if (saved.act_dep && saved.act_dep !== '---') {
        actDep = saved.act_dep;
      }
      if (saved.act_arr && saved.act_arr !== '---') {
        actArr = saved.act_arr;
      }
      if (saved.from_station && saved.from_station !== '---') {
        fromStn = saved.from_station;
      }
      if (saved.to_station && saved.to_station !== '---') {
        toStn = saved.to_station;
      }
    }

    rows.push({
      id: saved ? saved.id : null,
      row_order: rowOrder,
      link_number: taRow.link_number || null,
      date_str: dateStr,
      date_iso: dateIso,
      is_same_date_as_prev: rows.length > 0 && rows[rows.length - 1].date_str === dateStr,
      train_no: trainNo,
      sched_dep: '', // Left blank in official document
      sched_arr: '', // Left blank in official document
      act_dep: actDep,
      act_arr: actArr,
      from_station: fromStn,
      to_station: toStn,
      night_hours: nightHours
    });
  }

  const totalHours = rows.reduce((sum, r) => sum + (parseFloat(r.night_hours) || 0), 0);

  return {
    employee: taJournal.employee || staff,
    month_year: monthYearStr,
    month_name: taJournal.month_name || '',
    period_label: taJournal.period_label || '',
    start_date: taJournal.start_date,
    end_date: taJournal.end_date,
    year: taJournal.year,
    month: taJournal.month,
    rows,
    total_night_hours: Math.round(totalHours)
  };
}

module.exports = {
  generateStaffNdaJournal,
  calculateNightDutyHours
};

export {
  generateStaffNdaJournal,
  calculateNightDutyHours
};
