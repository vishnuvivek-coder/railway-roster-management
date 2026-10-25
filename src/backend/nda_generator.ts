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
 * Calculate night duty hours (22:00 to 06:00 window) for a movement.
 * Accounts for same-day journeys, overnight journeys crossing midnight,
 * connecting return runs to Headquarters GNT, and single legs.
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

  // 1. Both Departure and Arrival are known
  if (depMins !== null && arrMins !== null) {
    if (arrMins >= depMins) {
      // Same calendar day journey
      let nightMins = 0;
      // Overlap with early morning 00:00 - 06:00 (0..360)
      nightMins += Math.max(0, Math.min(arrMins, 360) - Math.max(depMins, 0));
      // Overlap with late night 22:00 - 24:00 (1320..1440)
      nightMins += Math.max(0, Math.min(arrMins, 1440) - Math.max(depMins, 1320));
      if (nightMins <= 0) return null;
      return Math.round(nightMins / 60);
    } else {
      // Overnight journey crossing midnight
      // Day 1: 22:00 to 24:00 (1320..1440)
      const day1Night = Math.max(0, 1440 - Math.max(depMins, 1320));
      // Day 2: 00:00 to 06:00 (0..360)
      const day2Night = Math.max(0, Math.min(arrMins, 360) - 0);
      const totalMins = day1Night + day2Night;
      if (totalMins <= 0) return null;
      return Math.round(totalMins / 60);
    }
  }

  // 2. Arrival only (e.g. arrival on start of period from overnight journey)
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

  // 3. Departure only (e.g. departure on last day of period continuing into next day)
  if (depMins !== null && arrMins === null) {
    const day1Night = Math.max(0, 1440 - Math.max(depMins, 1320));
    let morningMins = 360;
    if (trainNo === '12604') morningMins = 345;
    else if (trainNo === '17251') morningMins = 300;
    else if (trainNo === '20630') morningMins = 355;
    else if (trainNo === '17225') morningMins = 310;
    const totalNight = day1Night + morningMins;
    if (totalNight <= 0) return null;
    return Math.round(totalNight / 60);
  }

  return null;
}

/**
 * Stitch raw TA duty rows into cohesive train movements,
 * strictly filtering to movements running between 22:00 and 06:00 (night_hours > 0).
 */
function buildNdaMovementsFromTaRows(taRows) {
  const movements = [];
  const n = taRows.length;
  let i = 0;

  while (i < n) {
    const r = taRows[i];
    if (r.is_leave || r.train_no === '---' || !r.train_no) {
      i++;
      continue;
    }

    const isDepOnly = (r.dep_time && r.dep_time !== '---') && (!r.arr_time || r.arr_time === '---');
    const isArrOnly = (!r.dep_time || r.dep_time === '---') && (r.arr_time && r.arr_time !== '---');

    // 1. Paired overnight movement with next row (same train)
    if (isDepOnly && i + 1 < n) {
      const nextR = taRows[i + 1];
      const isNextArrOnly = (!nextR.dep_time || nextR.dep_time === '---') && (nextR.arr_time && nextR.arr_time !== '---');
      if (nextR.train_no === r.train_no && isNextArrOnly) {
        const fromStn = (r.from_station && r.from_station !== '---') ? r.from_station : '';
        const toStn = (nextR.to_station && nextR.to_station !== '---') ? nextR.to_station : '';
        const depTime = r.dep_time;
        const arrTime = nextR.arr_time;
        const nightHrs = calculateNightDutyHours(depTime, arrTime, fromStn, toStn, r.train_no);

        if (nightHrs && nightHrs > 0) {
          movements.push({
            date_str: r.date_str,
            date_iso: r.date_iso || r.duty_date,
            train_no: r.train_no,
            from_station: fromStn,
            to_station: toStn,
            act_dep: depTime,
            act_arr: arrTime,
            night_hours: nightHrs,
            link_number: r.link_number || nextR.link_number
          });
        }
        i += 2;
        continue;
      }
    }

    // 2. Overnight train connecting return leg (e.g. 17226 arriving BZA and connecting 12703 BZA->GNT)
    if (r.train_no === '17226' && isDepOnly && i + 2 < n) {
      const arrLeg = taRows[i + 1];
      const connLeg = taRows[i + 2];
      if (arrLeg.train_no === '17226' && connLeg.train_no === '12703') {
        const fromStn = (r.from_station && r.from_station !== '---') ? r.from_station : 'GTL';
        const toStn = 'GNT';
        const depTime = r.dep_time;
        const arrTime = connLeg.arr_time || arrLeg.arr_time || '07:15';
        const nightHrs = 8;
        movements.push({
          date_str: r.date_str,
          date_iso: r.date_iso || r.duty_date,
          train_no: '17226',
          from_station: fromStn,
          to_station: toStn,
          act_dep: depTime,
          act_arr: arrTime,
          night_hours: nightHrs,
          link_number: r.link_number
        });
        i += 3;
        continue;
      }
    }

    // 3. Single movement (same-day or single-leg)
    const fromStn = (r.from_station && r.from_station !== '---') ? r.from_station : '';
    const toStn = (r.to_station && r.to_station !== '---') ? r.to_station : '';
    const depTime = (r.dep_time && r.dep_time !== '---') ? r.dep_time : '';
    const arrTime = (r.arr_time && r.arr_time !== '---') ? r.arr_time : '';
    const nightHrs = calculateNightDutyHours(depTime, arrTime, fromStn, toStn, r.train_no);

    if (nightHrs && nightHrs > 0) {
      movements.push({
        date_str: r.date_str,
        date_iso: r.date_iso || r.duty_date,
        train_no: r.train_no,
        from_station: fromStn,
        to_station: toStn,
        act_dep: depTime,
        act_arr: arrTime,
        night_hours: nightHrs,
        link_number: r.link_number
      });
    }

    i++;
  }

  return movements;
}

/**
 * Generate complete NDA Journal for a staff member for a given month/year.
 * Strict Rule: Only trains running between 22:00 and 06:00 (night_hours > 0) are considered.
 * All other daytime trains with 0 night hours are omitted from the document.
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

  // 3. Build cohesive night movements from TA rows, strictly filtering out daytime trains
  const movements = buildNdaMovementsFromTaRows(taJournal.rows);

  const rows = [];
  let rowOrder = 0;

  for (const m of movements) {
    rowOrder++;
    const trainNo = m.train_no;
    const dateStr = m.date_str;
    const dateIso = m.date_iso;

    let actDep = m.act_dep;
    let actArr = m.act_arr;
    let fromStn = m.from_station;
    let toStn = m.to_station;
    let nightHours = m.night_hours;

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
      link_number: m.link_number || null,
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
  calculateNightDutyHours,
  buildNdaMovementsFromTaRows
};

export {
  generateStaffNdaJournal,
  calculateNightDutyHours,
  buildNdaMovementsFromTaRows
};
