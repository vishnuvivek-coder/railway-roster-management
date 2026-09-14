const { getDayOffset, getBaseLinkNumber } = require('./rotation');

function parseMinutes(timeStr) {
  if (!timeStr || timeStr === '---') return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function calculateAbsenceAndTa(depTime, arrTime, fromStn, toStn, trainNo, baseTa) {
  if ((trainNo === '17281' || trainNo === '67230') && toStn === 'BZA') {
    return { absence_hours: 1.1, ta_percentage: null };
  }

  const depM = parseMinutes(depTime);
  const arrM = parseMinutes(arrTime);

  if (depM === null && arrM === null) {
    const defaultHours = baseTa === 1.0 ? 24.0 : (baseTa === 0.7 ? 8.0 : (baseTa === 0.3 ? 4.0 : 0));
    return { absence_hours: defaultHours, ta_percentage: baseTa };
  }

  // 1. Arrival only at HQ / GNT (Return leg reaching HQ)
  if (depM === null && arrM !== null && (toStn === 'GNT' || toStn === '---')) {
    const hours = Math.round((arrM / 60) * 10) / 10;
    if (arrM <= 5) return { absence_hours: hours, ta_percentage: null };
    if (hours <= 8.0) return { absence_hours: hours, ta_percentage: 0.3 };
    if (hours <= 12.0) return { absence_hours: hours, ta_percentage: 0.7 };
    return { absence_hours: hours, ta_percentage: 1.0 };
  }

  // 2. Same day journey (or known Dep & Arr)
  if (depM !== null && arrM !== null) {
    let diff = arrM >= depM ? arrM - depM : 1440 - depM + arrM;
    const hours = Math.round((diff / 60) * 10) / 10;
    if (hours < 6.0) return { absence_hours: hours, ta_percentage: 0.3 };
    if (hours <= 12.0) return { absence_hours: hours, ta_percentage: 0.7 };
    return { absence_hours: hours, ta_percentage: 1.0 };
  }

  // 3. Departure only from HQ (Departing outstation into night)
  if (depM !== null && arrM === null) {
    const diff = 1440 - depM;
    const hours = Math.round((diff / 60) * 10) / 10;
    if (hours > 12.0) return { absence_hours: hours, ta_percentage: 1.0 };
    if (hours > 6.0) return { absence_hours: hours, ta_percentage: 0.7 };
    return { absence_hours: hours, ta_percentage: 0.3 };
  }

  return { absence_hours: 8.0, ta_percentage: baseTa };
}

function computeDynamicTa(depTime, arrTime, fromStn, toStn, trainNo, baseTa) {
  const res = calculateAbsenceAndTa(depTime, arrTime, fromStn, toStn, trainNo, baseTa);
  return res.ta_percentage;
}

/**
 * Date-aware TA calculation for a single day's duty duties
 * Rules:
 * - 24-hr cycle per calendar day.
 * - Outward departure from HQ: > 6 hrs to midnight -> 0.7, <= 6 hrs -> 0.3 (connecting leg e.g. 17281 is 0 TA).
 * - Outstation stay: counted strictly between arrival and departure at outstation. > 12 hrs -> 1.0, 6-12 hrs -> 0.7, < 6 hrs -> 0.3.
 * - Return arrival at HQ: morning arrival (before 8 AM) -> 0.3, 8 AM - 12 PM -> 0.7, afternoon -> 1.0.
 */
function calculateDayDutiesTa(duties) {
  if (!Array.isArray(duties) || duties.length === 0) return duties;

  const updated = duties.map(d => ({ ...d }));

  // Check if leave or rest
  const isLeave = updated.some(d => d.is_leave || (d.train_no === '---' && (d.from === '---' || d.from_station === '---')));
  if (isLeave) {
    return updated.map(d => ({ ...d, ta_b1: '', days_claiming_ta: null, ta: null, ta_percentage: null, absence_hours: 0, claim_amount: 0 }));
  }

  // 1. Mark connecting legs from HQ to BZA as null TA
  updated.forEach(d => {
    const to = d.to || d.to_station;
    if ((d.train_no === '17281' || d.train_no === '67230') && to === 'BZA') {
      d.ta_b1 = '';
      d.days_claiming_ta = null;
      d.ta = null;
      d.ta_percentage = null;
      d.absence_hours = 1.1;
    }
  });

  // 2. Check for Outstation Rest / Stay on this date
  const outstationArr = updated.find(d => {
    const to = d.to || d.to_station;
    const arr = d.arr || d.arr_time;
    return to && !['GNT', 'BZA', '---'].includes(to) && arr && arr !== '---';
  });

  const outstationDep = updated.find(d => {
    const from = d.from || d.from_station;
    const dep = d.dep || d.dep_time;
    return from && !['GNT', 'BZA', '---'].includes(from) && dep && dep !== '---';
  });

  if (outstationArr && outstationDep) {
    const arrTime = outstationArr.arr || outstationArr.arr_time;
    const depTime = outstationDep.dep || outstationDep.dep_time;
    const destTo = outstationDep.to || outstationDep.to_station;
    const destArr = outstationDep.arr || outstationDep.arr_time;

    const arrM = parseMinutes(arrTime);
    const depM = parseMinutes(depTime);
    const finalArrM = parseMinutes(destArr);

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
      outstationArr.ta = null;
      outstationArr.ta_percentage = null;
      outstationArr.absence_hours = 0;

      outstationDep.ta_b1 = String(dayTa);
      outstationDep.days_claiming_ta = dayTa;
      outstationDep.ta = dayTa;
      outstationDep.ta_percentage = dayTa;
      outstationDep.absence_hours = restHours;

      return updated;
    }
  }

  // 3. Check for Departure from HQ outward journey
  const gntLeg = updated.find(d => (d.from || d.from_station) === 'GNT' && (d.dep || d.dep_time) && (d.dep || d.dep_time) !== '---');
  const nightDepLeg = updated.find(d => {
    const dep = d.dep || d.dep_time;
    const arr = d.arr || d.arr_time;
    const to = d.to || d.to_station;
    return dep && dep !== '---' && (!arr || arr === '---' || to === '---');
  });
  const gntArrLeg = updated.find(d => (d.to || d.to_station) === 'GNT' && (d.arr || d.arr_time) && (d.arr || d.arr_time) !== '---');

  if ((gntLeg || nightDepLeg) && !gntArrLeg) {
    const hqDepTime = gntLeg ? (gntLeg.dep || gntLeg.dep_time) : (nightDepLeg.dep || nightDepLeg.dep_time);
    const depM = parseMinutes(hqDepTime);

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
          d.ta = dayTa;
          d.ta_percentage = dayTa;
          d.absence_hours = Math.round(timeTo00Hrs * 10) / 10;
        } else {
          d.ta_b1 = '';
          d.days_claiming_ta = null;
          d.ta = null;
          d.ta_percentage = null;
        }
      });
      return updated;
    }
  }

  // 4. Return to HQ day
  if (gntArrLeg && !nightDepLeg) {
    const arrM = parseMinutes(gntArrLeg.arr || gntArrLeg.arr_time);
    if (arrM !== null) {
      let dayTa = null;
      let hours = Math.round((arrM / 60) * 10) / 10;
      if (arrM <= 5) {
        dayTa = null;
      } else if (arrM <= 8 * 60) {
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
          d.ta = dayTa;
          d.ta_percentage = dayTa;
          d.absence_hours = hours;
        } else {
          d.ta_b1 = '';
          d.days_claiming_ta = null;
          d.ta = null;
          d.ta_percentage = null;
        }
      });
      return updated;
    }
  }

  // 5. Day with both return arrival at HQ and departure from HQ (e.g. Link 10 or Link 12)
  if (gntArrLeg && nightDepLeg) {
    const arrM = parseMinutes(gntArrLeg.arr || gntArrLeg.arr_time);
    let arrTa = 0.3;
    if (arrM !== null) {
      if (arrM <= 5) arrTa = null;
      else if (arrM <= 8 * 60) arrTa = 0.3;
      else if (arrM <= 12 * 60) arrTa = 0.7;
      else arrTa = 1.0;
    }
    gntArrLeg.ta_b1 = arrTa !== null ? String(arrTa) : '';
    gntArrLeg.days_claiming_ta = arrTa;
    gntArrLeg.ta = arrTa;
    gntArrLeg.ta_percentage = arrTa;
    gntArrLeg.absence_hours = arrM ? Math.round((arrM / 60) * 10) / 10 : 1.0;

    const depM = parseMinutes(nightDepLeg.dep || nightDepLeg.dep_time);
    let depTa = 0.3;
    if (depM !== null) {
      const timeTo00Hrs = (1440 - depM) / 60;
      if (timeTo00Hrs > 12) depTa = 1.0;
      else if (timeTo00Hrs > 6) depTa = 0.7;
      else depTa = 0.3;
    }
    nightDepLeg.ta_b1 = String(depTa);
    nightDepLeg.days_claiming_ta = depTa;
    nightDepLeg.ta = depTa;
    nightDepLeg.ta_percentage = depTa;
    nightDepLeg.absence_hours = depM ? Math.round(((1440 - depM) / 60) * 10) / 10 : 1.0;

    return updated;
  }

  // 6. Same-day round trip
  if (updated.length === 1 && (updated[0].dep || updated[0].dep_time) && (updated[0].arr || updated[0].arr_time)) {
    const d = updated[0];
    const depM = parseMinutes(d.dep || d.dep_time);
    const arrM = parseMinutes(d.arr || d.arr_time);
    if (depM !== null && arrM !== null) {
      let diff = arrM >= depM ? arrM - depM : 1440 - depM + arrM;
      const h = Math.round((diff / 60) * 10) / 10;
      let dayTa = h < 6 ? 0.3 : (h <= 12 ? 0.7 : 1.0);
      d.ta_b1 = String(dayTa);
      d.days_claiming_ta = dayTa;
      d.ta = dayTa;
      d.ta_percentage = dayTa;
      d.absence_hours = h;
      return updated;
    }
  }

  return updated;
}

/**
 * Groups an entire array of journal rows by date and applies the 24-hr TA calculation rules
 */
function recalculateJournalRowsTa(rows) {
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
      const effectiveDaRate = orig.da_rate || (orig.pay_amount ? (orig.pay_amount >= 53100 ? 800 : (orig.pay_amount >= 35400 ? 500 : 800)) : 800);
      const amt = r.days_claiming_ta !== null && r.days_claiming_ta !== undefined
        ? Math.round(r.days_claiming_ta * effectiveDaRate)
        : (orig.claim_amount || 0);
      updatedRows[r._origIdx] = {
        ...orig,
        ta_b1: r.ta_b1 !== undefined ? r.ta_b1 : (r.days_claiming_ta !== null ? String(r.days_claiming_ta) : ''),
        days_claiming_ta: r.days_claiming_ta !== undefined ? r.days_claiming_ta : null,
        ta_percentage: r.days_claiming_ta !== undefined ? r.days_claiming_ta : null,
        absence_hours: r.absence_hours !== undefined ? r.absence_hours : orig.absence_hours,
        claim_amount: amt
      };
    });
  });

  return updatedRows;
}

/**
 * Exact Link-to-Duty Mapping for Conductors (COR), TTI Sleeper, Ladies Staff, and LR Staff
 */
function getDutyRowsForLinkNumber(categoryId, linkNumber, link) {
  if (!link || link.is_rest || !link.train_numbers || link.train_numbers === 'REST' || link.train_numbers === 'OFF') {
    return [];
  }

  // Category 1: Conductors (COR) - 21-day cycle
  if (categoryId === 1) {
    switch (linkNumber) {
      case 1:
        return [
          { train_no: '17281', from: 'GNT', to: 'BZA', dep: '17:45', arr: '18:50', ta: null },
          { train_no: '17225', from: 'BZA', to: '---', dep: '20:00', arr: '---', ta: 0.7 }
        ];
      case 2:
        return [
          { train_no: '17225', from: '---', to: 'GTL', dep: '---', arr: '5:10', ta: null },
          { train_no: '17226', from: 'GTL', to: '---', dep: '19:00', arr: '---', ta: 1.0 }
        ];
      case 3:
        return [
          { train_no: '17226', from: '---', to: 'BZA', dep: '---', arr: '3:55', ta: null },
          { train_no: '12703', from: 'BZA', to: 'GNT', dep: '5:45', arr: '6:25', ta: 0.3 }
        ];
      case 4:
        return [
          { train_no: '17261', from: 'GNT', to: '---', dep: '16:30', arr: '---', ta: 0.7 }
        ];
      case 5:
        return [
          { train_no: '17261', from: '---', to: 'TPTY', dep: '---', arr: '3:55', ta: null },
          { train_no: '12733', from: 'TPTY', to: '---', dep: '18:20', arr: '---', ta: 1.0 }
        ];
      case 6:
        return [
          { train_no: '12733', from: '---', to: 'GNT', dep: '---', arr: '00:50', ta: 0.3 }
        ];
      case 7:
        return []; // REST
      case 8:
        return [
          { train_no: '20629', from: 'GNT', to: '---', dep: '19:15', arr: '---', ta: 0.3 }
        ];
      case 9:
        return [
          { train_no: '20629', from: '---', to: 'TPTY', dep: '---', arr: '1:45', ta: null },
          { train_no: '12733', from: 'TPTY', to: '---', dep: '18:20', arr: '---', ta: 1.0 }
        ];
      case 10:
        return [
          { train_no: '12733', from: '---', to: 'GNT', dep: '---', arr: '00:45', ta: 0.3 },
          { train_no: '12734', from: 'GNT', to: '---', dep: '22:50', arr: '---', ta: 0.3 }
        ];
      case 11:
        return [
          { train_no: '12734', from: '---', to: 'TPTY', dep: '---', arr: '6:05', ta: null },
          { train_no: '20630', from: 'TPTY', to: '---', dep: '23:30', arr: '---', ta: 1.0 }
        ];
      case 12:
        return [
          { train_no: '20630', from: '---', to: 'GNT', dep: '---', arr: '5:50', ta: 0.3 },
          { train_no: '12604', from: 'GNT', to: '---', dep: '22:40', arr: '---', ta: 0.3 }
        ];
      case 13:
        return [
          { train_no: '12604', from: '---', to: 'MAS', dep: '---', arr: '5:45', ta: null },
          { train_no: '12603', from: 'MAS', to: 'GNT', dep: '16:45', arr: '23:50', ta: 1.0 }
        ];
      case 14:
        return []; // REST
      case 15:
        return [
          { train_no: '67230', from: 'GNT', to: 'BZA', dep: '16:25', arr: '18:05', ta: null },
          { train_no: '18047', from: 'BZA', to: '---', dep: '19:45', arr: '---', ta: 0.7 }
        ];
      case 16:
        return [
          { train_no: '18047', from: '---', to: 'GTL', dep: '---', arr: '3:50', ta: null },
          { train_no: '17226', from: 'GTL', to: '---', dep: '19:00', arr: '---', ta: 1.0 }
        ];
      case 17:
        return [
          { train_no: '17226', from: '---', to: 'BZA', dep: '---', arr: '3:45', ta: null },
          { train_no: '57201', from: 'BZA', to: 'GNT', dep: '6:20', arr: '7:35', ta: 0.3 }
        ];
      case 18:
        return [
          { train_no: '12734', from: 'GNT', to: '---', dep: '23:30', arr: '---', ta: 0.3 }
        ];
      case 19:
        return [
          { train_no: '12734', from: '---', to: 'TPTY', dep: '---', arr: '6:05', ta: null },
          { train_no: '17262', from: 'TPTY', to: '---', dep: '19:30', arr: '---', ta: 1.0 }
        ];
      case 20:
        return [
          { train_no: '17262', from: '---', to: 'GNT', dep: '---', arr: '6:55', ta: 0.3 }
        ];
      case 21:
        return []; // REST
    }
  }

  // Category 2: TTI / Sleeper Staff - 63-day cycle
  if (categoryId === 2) {
    switch (linkNumber) {
      case 1:
      case 15:
        return [{ train_no: '17253', from: 'GNT', to: 'DHNE', dep: '06:15', arr: '14:20', ta: 0.7 }];
      case 2:
      case 16:
        return [{ train_no: '17252', from: 'DHNE', to: 'GNT', dep: '15:30', arr: '23:10', ta: 0.7 }];
      case 3:
        return [{ train_no: '12604', from: 'GNT', to: '---', dep: '22:40', arr: '---', ta: 0.3 }];
      case 4:
      case 46:
        return [
          { train_no: '12604', from: '---', to: 'MAS', dep: '---', arr: '5:45', ta: null },
          { train_no: '12603', from: 'MAS', to: 'GNT', dep: '16:45', arr: '23:50', ta: 1.0 }
        ];
      case 5:
      case 47:
        return [{ train_no: '17251', from: 'GNT', to: '---', dep: '16:30', arr: '---', ta: 0.7 }];
      case 6:
        return [
          { train_no: '17251', from: '---', to: 'DHNE', dep: '---', arr: '05:00', ta: null },
          { train_no: '17252', from: 'DHNE', to: 'GNT', dep: '15:30', arr: '23:10', ta: 1.0 }
        ];
      case 7:
      case 14:
      case 21:
      case 28:
      case 35:
      case 42:
      case 49:
      case 56:
      case 63:
        return []; // REST
      case 8:
      case 22:
        return [
          { train_no: '17215', from: 'GNT', to: '---', dep: '22:35', arr: '---', ta: 0.3 }
        ];
      case 9:
      case 23:
        return [
          { train_no: '17215', from: '---', to: 'DMM', dep: '---', arr: '08:30', ta: null },
          { train_no: '17216', from: 'DMM', to: '---', dep: '17:30', arr: '---', ta: 1.0 }
        ];
      case 10:
      case 24:
        return [
          { train_no: '17216', from: '---', to: 'GNT', dep: '---', arr: '06:15', ta: 0.3 }
        ];
      case 11:
      case 25:
      case 39:
      case 53:
        return [
          { train_no: '12747', from: 'GNT', to: 'VKB', dep: '05:45', arr: '12:00', ta: null },
          { train_no: '12748', from: 'VKB', to: 'GNT', dep: '14:40', arr: '21:10', ta: 0.7 }
        ];
      case 12:
      case 26:
        return [
          { train_no: '17201', from: 'GNT', to: 'KZJ', dep: '06:00', arr: '12:00', ta: null },
          { train_no: '17202', from: 'KZJ', to: 'GNT', dep: '15:45', arr: '21:30', ta: 0.7 }
        ];
      case 13:
      case 27:
        return [{ train_no: '17255', from: 'GNT', to: 'KCG', dep: '23:20', arr: '05:40', ta: 0.7 }];
      case 17:
      case 31:
        return [
          { train_no: '17228', from: 'GNT', to: 'DHNE', dep: '13:00', arr: '20:30', ta: 0.7 }
        ];
      case 18:
      case 32:
        return [
          { train_no: '17227', from: 'DHNE', to: 'GNT', dep: '06:00', arr: '14:00', ta: 0.7 }
        ];
      case 19:
      case 33:
        return [
          { train_no: '12734', from: 'GNT', to: '---', dep: '22:50', arr: '---', ta: 0.3 }
        ];
      case 20:
      case 34:
        return [
          { train_no: '12734', from: '---', to: 'TPTY', dep: '---', arr: '06:05', ta: null },
          { train_no: '17262', from: 'TPTY', to: '---', dep: '19:30', arr: '---', ta: 1.0 }
        ];
      default:
        if (link && link.train_numbers && link.train_numbers !== 'REST' && link.train_numbers !== 'OFF') {
          return [
            {
              train_no: link.train_numbers.split('/')[0] || link.train_numbers,
              from: link.from_station || 'GNT',
              to: link.to_station || '---',
              dep: '17:45',
              arr: '---',
              ta: 0.7
            }
          ];
        }
        return [];
    }
  }

  // Category 3: Ladies Staff / TTE - 7-day cycle
  if (categoryId === 3) {
    switch (linkNumber) {
      case 1:
        return [
          { train_no: '17281', from: 'GNT', to: 'BZA', dep: '17:45', arr: '18:50', ta: null },
          { train_no: '12703', from: 'BZA', to: 'GNT', dep: '20:30', arr: '21:15', ta: 0.3 }
        ];
      case 2:
        return [
          { train_no: '12747', from: 'GNT', to: 'SC', dep: '05:45', arr: '10:45', ta: null },
          { train_no: '12748', from: 'SC', to: 'GNT', dep: '15:30', arr: '21:10', ta: 0.7 }
        ];
      case 3:
        return [
          { train_no: '17201', from: 'GNT', to: 'BZA', dep: '06:00', arr: '07:00', ta: null },
          { train_no: '17202', from: 'BZA', to: 'GNT', dep: '20:30', arr: '21:30', ta: 0.3 }
        ];
      case 4:
        return [
          { train_no: '67230', from: 'GNT', to: 'BZA', dep: '16:25', arr: '18:05', ta: null },
          { train_no: '57201', from: 'BZA', to: 'GNT', dep: '19:30', arr: '20:45', ta: 0.3 }
        ];
      case 5:
        return [
          { train_no: '17253', from: 'GNT', to: 'DKD', dep: '06:15', arr: '09:30', ta: null },
          { train_no: '17254', from: 'DKD', to: 'GNT', dep: '16:30', arr: '20:00', ta: 0.7 }
        ];
      case 6:
        return [
          { train_no: '12604', from: 'GNT', to: 'TEL', dep: '22:40', arr: '23:15', ta: 0.3 }
        ];
      case 7:
        return []; // REST
    }
  }

  // Category 4: Leave Reserve (LR) Staff
  if (categoryId === 4) {
    if (linkNumber % 7 === 0) return []; // REST
    return [
      { train_no: '17281', from: 'GNT', to: 'BZA', dep: '17:45', arr: '18:50', ta: null },
      { train_no: '17225', from: 'BZA', to: '---', dep: '20:00', arr: '---', ta: 0.7 }
    ];
  }

  return [];
}

/**
 * Generate complete Travelling Allowance Journal for a staff member
/**
 * Generate pending TA claims into ta_approvals for a given month
 */
async function generatePendingTaClaimsForMonth(db, year, month, staffId = null) {
  const { get, all, run } = db;
  const monthYearStr = `${year}-${String(month).padStart(2, '0')}`;

  let staffQuery = 'SELECT * FROM staff';
  const params = [];
  if (staffId) {
    staffQuery += ' WHERE id = ?';
    params.push(staffId);
  } else {
    staffQuery += ' ORDER BY category_id ASC, row_position ASC';
  }
  const allStaff = await all(staffQuery, params);

  const categories = await all('SELECT * FROM categories');
  const catMap = {};
  categories.forEach(c => { catMap[c.id] = c; });

  const links = await all('SELECT * FROM links ORDER BY category_id ASC, link_number ASC');
  const linkMap = {};
  links.forEach(l => {
    linkMap[`${l.category_id}_${l.link_number}`] = l;
  });

  // Cached train runs for live timings
  const cachedRuns = await all(
    'SELECT * FROM actual_train_runs WHERE run_date LIKE ?',
    [`${monthYearStr}%`]
  );
  const cacheMap = {};
  if (Array.isArray(cachedRuns)) {
    cachedRuns.forEach(r => {
      cacheMap[`${r.train_no}_${r.run_date}_${r.station_code}`] = r;
    });
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  let maxDay = daysInMonth;
  if (year > currentYear || (year === currentYear && month > currentMonth)) {
    maxDay = 0;
  } else if (year === currentYear && month === currentMonth) {
    maxDay = Math.min(daysInMonth, currentDay);
  }

  for (const staff of allStaff) {
    if (staff.name === '(VACANT)') continue;
    const category = catMap[staff.category_id];
    if (!category) continue;

    // Daily NDA matches if any
    const ndaEntries = await all(
      'SELECT * FROM nda_entries WHERE staff_id = ? AND month_year = ? ORDER BY row_order ASC',
      [staff.id, monthYearStr]
    );
    const ndaMap = {};
    if (Array.isArray(ndaEntries)) {
      ndaEntries.forEach(r => {
        ndaMap[`${r.date_str}_${r.train_no}`] = r;
      });
    }

    // Daily Muster records if any
    const musterRecords = await all(
      'SELECT * FROM muster_records WHERE staff_id = ? AND date >= ? AND date <= ?',
      [staff.id, `${year}-${String(month).padStart(2, '0')}-01`, `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`]
    );
    const musterMap = {};
    if (Array.isArray(musterRecords)) {
      musterRecords.forEach(m => {
        musterMap[m.date] = m;
      });
    }

    // Daily Overrides records if any
    const overrides = await all(
      'SELECT * FROM overrides WHERE staff_id = ? AND date >= ? AND date <= ?',
      [staff.id, `${year}-${String(month).padStart(2, '0')}-01`, `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`]
    );
    const overrideMap = {};
    if (Array.isArray(overrides)) {
      overrides.forEach(o => {
        overrideMap[o.date] = o;
      });
    }

    const daRate = staff.pay_amount >= 53100 ? 800 : (staff.pay_amount >= 35400 ? 500 : 800);

    let rowOrder = 0;
    for (let d = 1; d <= maxDay; d++) {
      const dateStrIso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dateStrDisplay = `${d}/${month}/${String(year).slice(-2)}`;

      const muster = musterMap[dateStrIso];
      const musterCode = muster ? muster.code.toUpperCase() : null;
      const isMusterLeave = muster && ['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'SICK', 'CR', 'R', 'O', 'NH'].includes(musterCode);

      const override = overrideMap[dateStrIso];
      const isOverrideLeave = override && (['LEAVE', 'SICK', 'CR', 'REST', 'ABSENT'].includes(override.status) || override.leave_type);
      const isEffectiveLeave = isMusterLeave || isOverrideLeave;

      let duties = [];
      let linkNum = null;

      if (override && (override.status === 'CHANGED_LINK' || override.status === 'SUBSTITUTE')) {
        const targetCatId = override.target_category_id || category.id;
        linkNum = override.overridden_link_number;
        duties = getDutyRowsForLinkNumber(targetCatId, linkNum, linkMap[`${targetCatId}_${linkNum}`] || linkMap[linkNum]);
      } else if (override && (override.status === 'EXTRA_CREW' || override.is_extra === 1 || override.extra_train_no)) {
        const trNo = override.extra_train_no || 'EXTRA';
        duties = [{ train_no: trNo, from: 'GNT', to: '---', dep: '17:45', arr: '---', ta: 0.7 }];
      } else if (override && (override.status === 'UTILISED_ADVANCE' || override.advance_train_no)) {
        const trNo = override.advance_train_no || 'ADVANCE';
        duties = [{ train_no: trNo, from: 'GNT', to: '---', dep: '17:45', arr: '---', ta: 0.7 }];
      } else {
        const offset = getDayOffset(category.anchor_date, dateStrIso);
        linkNum = getBaseLinkNumber(staff.row_position, offset, category.cycle_length);
        const link = linkMap[`${category.id}_${linkNum}`];
        duties = getDutyRowsForLinkNumber(category.id, linkNum, link);
      }
      const dutiesWithTimings = duties.map(duty => {
        let actualDep = duty.dep || '---';
        let actualArr = duty.arr || '---';

        // Check NDA or cache
        const ndaMatch = ndaMap[`${dateStrDisplay}_${duty.train_no}`];
        if (ndaMatch) {
          if (ndaMatch.act_dep && ndaMatch.act_dep !== '---') actualDep = ndaMatch.act_dep;
          if (ndaMatch.act_arr && ndaMatch.act_arr !== '---') actualArr = ndaMatch.act_arr;
        } else {
          if (duty.from && cacheMap[`${duty.train_no}_${dateStrIso}_${duty.from}`]) {
            const cached = cacheMap[`${duty.train_no}_${dateStrIso}_${duty.from}`];
            if (cached.act_dep && cached.act_dep !== '---') actualDep = cached.act_dep;
          }
          if (duty.to && cacheMap[`${duty.train_no}_${dateStrIso}_${duty.to}`]) {
            const cached = cacheMap[`${duty.train_no}_${dateStrIso}_${duty.to}`];
            if (cached.act_arr && cached.act_arr !== '---') actualArr = cached.act_arr;
          }
        }

        return {
          ...duty,
          from_station: duty.from,
          to_station: duty.to,
          dep_time: actualDep,
          arr_time: actualArr,
          is_leave: isEffectiveLeave
        };
      });

      const calculatedDuties = isEffectiveLeave
        ? dutiesWithTimings.map(d => ({ ...d, ta_percentage: null, absence_hours: 0 }))
        : calculateDayDutiesTa(dutiesWithTimings);

      for (const duty of calculatedDuties) {
        rowOrder++;
        const taPct = duty.ta_percentage !== undefined ? duty.ta_percentage : (duty.days_claiming_ta !== undefined ? duty.days_claiming_ta : duty.ta);
        const absenceHours = duty.absence_hours || 0;
        const claimAmt = taPct !== null && taPct !== undefined ? Math.round(taPct * daRate) : 0;
        const effLeaveCode = musterCode || (override ? (override.leave_type || override.status) : 'LEAVE');
        const claimStatus = isEffectiveLeave ? 'REJECTED' : 'PENDING';
        const claimRemark = isEffectiveLeave ? `Disallowed: On Leave/Absent as per Muster/Override (${effLeaveCode})` : '';

        await run(
          `INSERT OR IGNORE INTO ta_approvals (
            staff_id, month_year, duty_date, date_str, link_number, train_no,
            from_station, to_station, dep_time, arr_time, absence_hours, ta_percentage,
            da_rate, claim_amount, status, object_of_journey, row_order, remarks
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            staff.id, monthYearStr, dateStrIso, dateStrDisplay, linkNum, duty.train_no,
            duty.from_station, duty.to_station, duty.dep_time, duty.arr_time, absenceHours, taPct,
            daRate, claimAmt, claimStatus, category.id === 1 ? 'MANNING AC COACHES' : 'MANNING SLEEPER COACHES', rowOrder, claimRemark
          ]
        );
      }
    }
  }
}

/**
 * Helper: get all (year, month) pairs spanning between startDate and endDate
 */
function getMonthsBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const months = [];
  let curr = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (curr <= last) {
    const y = curr.getFullYear();
    const m = curr.getMonth() + 1;
    months.push({
      year: y,
      month: m,
      monthYearStr: `${y}-${String(m).padStart(2, '0')}`
    });
    curr.setMonth(curr.getMonth() + 1);
  }
  return months;
}

/**
 * Generate complete Travelling Allowance Journal for a staff member.
 * Supports full month or arbitrary date range (startDate to endDate).
 * STRICT RULE: Only Admin-accepted (status='APPROVED') TAs appear in the official TA Document!
 */
async function generateStaffTaJournal(db, staffId, year, month, startDate, endDate) {
  const { get, all } = db;
  const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
  if (!staff) throw new Error(`Staff with ID ${staffId} not found`);

  const category = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
  if (!category) throw new Error(`Category for staff ID ${staffId} not found`);

  const y = parseInt(year, 10) || new Date().getFullYear();
  const m = parseInt(month, 10) || (new Date().getMonth() + 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const actualStart = startDate || `${y}-${String(m).padStart(2, '0')}-01`;
  const actualEnd = endDate || `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
  const monthYearStr = `${y}-${String(m).padStart(2, '0')}`;

  // 1. Ensure pending claims exist in ta_approvals for all months covered in the range
  const monthsCovered = getMonthsBetween(actualStart, actualEnd);
  for (const mInfo of monthsCovered) {
    const existingClaims = await all(
      'SELECT id FROM ta_approvals WHERE staff_id = ? AND month_year = ? LIMIT 1',
      [staffId, mInfo.monthYearStr]
    );
    if (!existingClaims || existingClaims.length === 0) {
      await generatePendingTaClaimsForMonth(db, mInfo.year, mInfo.month, staffId);
    }
  }

  // 2. Fetch count of pending claims in date range
  const pendingRes = await all(
    "SELECT COUNT(*) as count FROM ta_approvals WHERE staff_id = ? AND duty_date >= ? AND duty_date <= ? AND status = 'PENDING'",
    [staffId, actualStart, actualEnd]
  );
  const pendingCount = pendingRes[0]?.count || 0;

  // 3. Fetch count of rejected claims in date range
  const rejectedRes = await all(
    "SELECT COUNT(*) as count FROM ta_approvals WHERE staff_id = ? AND duty_date >= ? AND duty_date <= ? AND status = 'REJECTED'",
    [staffId, actualStart, actualEnd]
  );
  const rejectedCount = rejectedRes[0]?.count || 0;

function resolveDutyDateIso(r) {
  if (r.duty_date && /^\d{4}-\d{2}-\d{2}$/.test(r.duty_date)) return r.duty_date;
  if (r.date_iso && /^\d{4}-\d{2}-\d{2}$/.test(r.date_iso)) return r.date_iso;
  if (r.date_str) {
    const parts = r.date_str.trim().split('/');
    if (parts.length === 3) {
      let [d, m, y] = parts;
      if (y.length === 2) y = '20' + y;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  return null;
}

function getAdjacentDateIso(dIso, offsetDays) {
  if (!dIso || typeof dIso !== 'string') return null;
  const parts = dIso.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const dt = new Date(Date.UTC(y, m, d + offsetDays));
  return dt.toISOString().slice(0, 10);
}

function formatNatureOfLeave(code, rawDetail) {
  const cleanCode = (code || '').trim().toUpperCase();
  const dict = {
    'LAP': 'LEAVE ON AVERAGE PAY (LAP)',
    'CL': 'CASUAL LEAVE (CL)',
    'CCL': 'CHILD CARE LEAVE (CCL)',
    'SCL': 'SPECIAL CASUAL LEAVE (SCL)',
    'LHAP': 'LEAVE ON HALF AVERAGE PAY (LHAP)',
    'SICK': 'SICK / MEDICAL LEAVE',
    'CR': 'COMPENSATORY REST (CR)',
    'R': 'WEEKLY REST (R)',
    'O': 'ABSENT'
  };

  const baseName = dict[cleanCode] || (cleanCode ? `LEAVE (${cleanCode})` : 'ON LEAVE');
  if (!rawDetail) return baseName;

  let detail = rawDetail.trim();
  detail = detail.replace(/^(Muster:\s*|Muster Chart:\s*|Approved Leave:\s*|LEAVE\s*\[.*?\]\s*\(?|\(?LAP Leave\)?|\(?CL Leave\)?)/i, '').replace(/\)$/, '').trim();
  const simplified = detail.replace(/\s*leave/i, '').trim().toUpperCase();
  if (detail && simplified !== cleanCode && detail.toLowerCase() !== baseName.toLowerCase()) {
    return `${baseName} - ${detail}`;
  }
  return baseName;
}

  // 4. Fetch APPROVED claims and claims disallowed by muster in date range
  const approvedClaims = await all(
    `SELECT * FROM ta_approvals 
     WHERE staff_id = ? AND duty_date >= ? AND duty_date <= ? 
       AND (status = 'APPROVED' OR (status = 'REJECTED' AND (remarks LIKE 'Disallowed: On Leave/Absent%' OR remarks LIKE 'Muster%')))
     ORDER BY duty_date ASC, row_order ASC`,
    [staffId, actualStart, actualEnd]
  );

  // 5. Check if custom saved entries exist in ta_entries table in date range
  const savedEntries = await all(
    `SELECT * FROM ta_entries 
     WHERE staff_id = ? AND duty_date >= ? AND duty_date <= ? 
     ORDER BY duty_date ASC, row_order ASC`,
    [staffId, actualStart, actualEnd]
  );

  // Fetch all leave records (muster_records, leave_requests, and overrides) to accurately collect Nature of Leave
  const queryStart = getAdjacentDateIso(actualStart, -2) || actualStart;
  const queryEnd = getAdjacentDateIso(actualEnd, 2) || actualEnd;

  const musterList = await all(
    'SELECT * FROM muster_records WHERE staff_id = ? AND date >= ? AND date <= ?',
    [staffId, queryStart, queryEnd]
  );
  const leaveRequests = await all(
    `SELECT * FROM leave_requests 
     WHERE staff_id = ? AND status IN ('APPROVED', 'PENDING') AND type = 'LEAVE'
       AND ((date >= ? AND date <= ?) OR (from_date <= ? AND to_date >= ?))`,
    [staffId, queryStart, queryEnd, queryEnd, queryStart]
  );
  const overrides = await all(
    `SELECT * FROM overrides 
     WHERE staff_id = ? AND date >= ? AND date <= ? 
       AND (status IN ('LEAVE', 'SICK', 'CR', 'REST', 'ABSENT') OR leave_type IS NOT NULL)`,
    [staffId, queryStart, queryEnd]
  );

  const leaveInfoMap = {};
  if (Array.isArray(musterList)) {
    musterList.forEach(m => {
      if (['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'SICK', 'CR', 'R', 'O'].includes(m.code.toUpperCase())) {
        leaveInfoMap[m.date] = {
          code: m.code.toUpperCase(),
          natureOfLeave: formatNatureOfLeave(m.code, m.remarks)
        };
      }
    });
  }
  if (Array.isArray(leaveRequests)) {
    leaveRequests.forEach(lr => {
      const d = lr.from_date || lr.date;
      if (!leaveInfoMap[d]) {
        const code = (lr.reason && lr.reason.match(/\b(LAP|CL|SICK|CCL|SCL|LHAP|CR)\b/i)) ? lr.reason.match(/\b(LAP|CL|SICK|CCL|SCL|LHAP|CR)\b/i)[1].toUpperCase() : 'LEAVE';
        leaveInfoMap[d] = {
          code,
          natureOfLeave: formatNatureOfLeave(code, lr.reason)
        };
      }
    });
  }
  if (Array.isArray(overrides)) {
    overrides.forEach(o => {
      if (!leaveInfoMap[o.date]) {
        const code = o.leave_type || (o.status === 'SICK' ? 'SICK' : (o.status === 'REST' ? 'R' : (o.status === 'CR' ? 'CR' : (o.status === 'ABSENT' ? 'O' : 'LEAVE'))));
        leaveInfoMap[o.date] = {
          code,
          natureOfLeave: formatNatureOfLeave(code, o.reason)
        };
      }
    });
  }

  let finalRows = [];
  const seenLeaveDates = new Set();

  if (savedEntries && savedEntries.length > 0) {
    for (let idx = 0; idx < savedEntries.length; idx++) {
      const r = savedEntries[idx];
      const dIso = resolveDutyDateIso(r);
      const leaveInfo = (dIso ? leaveInfoMap[dIso] : null) || (r.remarks && (r.remarks.startsWith('Disallowed: On Leave/Absent') || r.remarks.includes('(LAP)') || r.remarks.includes('(CL)') || r.remarks.includes('(SICK)')) ? {
        code: r.remarks.match(/\(([A-Z]+)\)/) ? r.remarks.match(/\(([A-Z]+)\)/)[1] : 'LEAVE',
        natureOfLeave: formatNatureOfLeave(r.remarks.match(/\(([A-Z]+)\)/) ? r.remarks.match(/\(([A-Z]+)\)/)[1] : 'LEAVE', r.remarks)
      } : null);

      if (leaveInfo) {
        if (seenLeaveDates.has(dIso)) {
          continue; // Deduplicate extra legs on same leave date so train movement is not shown
        }
        seenLeaveDates.add(dIso);

        finalRows.push({
          ...r,
          duty_date: dIso || r.duty_date,
          date_iso: dIso || r.date_iso,
          train_no: '---',
          from_station: '---',
          to_station: '---',
          dep_time: '---',
          arr_time: '---',
          ta_a1: '',
          ta_a: '',
          ta_b1: '',
          ta_ord: '',
          days_claiming_ta: null,
          claim_amount: 0,
          is_leave: true,
          leave_code: leaveInfo.code,
          nature_of_leave: leaveInfo.natureOfLeave,
          remarks: leaveInfo.natureOfLeave,
          is_same_date_as_prev: false
        });
      } else {
        finalRows.push({
          ...r,
          duty_date: dIso || r.duty_date,
          date_iso: dIso || r.date_iso,
          ta_b1: r.ta_b1 || (r.days_claiming_ta !== null && r.days_claiming_ta !== undefined ? String(r.days_claiming_ta) : ''),
          days_claiming_ta: r.days_claiming_ta,
          claim_amount: r.claim_amount,
          remarks: r.remarks || '',
          is_same_date_as_prev: finalRows.length > 0 && (dIso ? dIso === finalRows[finalRows.length - 1].duty_date : r.date_str === finalRows[finalRows.length - 1].date_str)
        });
      }
    }
  } else if (approvedClaims && approvedClaims.length > 0) {
    for (let idx = 0; idx < approvedClaims.length; idx++) {
      const claim = approvedClaims[idx];
      const dIso = claim.duty_date;
      const leaveInfo = leaveInfoMap[dIso] || (claim.remarks && claim.remarks.startsWith('Disallowed: On Leave/Absent') ? {
        code: claim.remarks.match(/\(([A-Z]+)\)/) ? claim.remarks.match(/\(([A-Z]+)\)/)[1] : 'LEAVE',
        natureOfLeave: formatNatureOfLeave(claim.remarks.match(/\(([A-Z]+)\)/) ? claim.remarks.match(/\(([A-Z]+)\)/)[1] : 'LEAVE', claim.remarks)
      } : null);

      if (leaveInfo) {
        if (seenLeaveDates.has(dIso)) {
          continue; // Suppress extra train movement rows on leave date
        }
        seenLeaveDates.add(dIso);

        finalRows.push({
          id: claim.id,
          row_order: finalRows.length + 1,
          link_number: claim.link_number,
          date_str: claim.date_str,
          date_iso: claim.duty_date,
          is_same_date_as_prev: false,
          train_no: '---',
          from_station: '---',
          to_station: '---',
          dep_time: '---',
          arr_time: '---',
          ta_a1: '',
          ta_a: '',
          ta_b1: '',
          ta_ord: '',
          days_claiming_ta: null,
          absence_hours: 0,
          claim_amount: 0,
          is_leave: true,
          leave_code: leaveInfo.code,
          nature_of_leave: leaveInfo.natureOfLeave,
          object_of_journey: claim.object_of_journey || (category.id === 1 ? 'MANNING AC COACHES' : 'MANNING SLEEPER COACHES'),
          remarks: leaveInfo.natureOfLeave
        });
      } else {
        finalRows.push({
          id: claim.id,
          row_order: finalRows.length + 1,
          link_number: claim.link_number,
          date_str: claim.date_str,
          date_iso: claim.duty_date,
          is_same_date_as_prev: finalRows.length > 0 && claim.duty_date === finalRows[finalRows.length - 1].date_iso,
          train_no: claim.train_no,
          from_station: claim.from_station,
          to_station: claim.to_station,
          dep_time: claim.dep_time,
          arr_time: claim.arr_time,
          ta_a1: '',
          ta_a: '',
          ta_b1: claim.ta_percentage !== null && claim.ta_percentage !== undefined ? String(claim.ta_percentage) : '',
          days_claiming_ta: claim.ta_percentage,
          absence_hours: claim.absence_hours,
          claim_amount: claim.claim_amount,
          object_of_journey: claim.object_of_journey || (category.id === 1 ? 'MANNING AC COACHES' : 'MANNING SLEEPER COACHES'),
          remarks: claim.remarks || ''
        });
      }
    }
  } else {
    // If no approved claims exist yet, load all generated claims for the period as draft journal
    const allClaims = await all(
      `SELECT * FROM ta_approvals 
       WHERE staff_id = ? AND duty_date >= ? AND duty_date <= ? 
       ORDER BY duty_date ASC, row_order ASC`,
      [staffId, actualStart, actualEnd]
    );
    if (allClaims && allClaims.length > 0) {
      for (let idx = 0; idx < allClaims.length; idx++) {
        const claim = allClaims[idx];
        const dIso = claim.duty_date;
        const leaveInfo = leaveInfoMap[dIso] || (claim.remarks && claim.remarks.startsWith('Disallowed: On Leave/Absent') ? {
          code: claim.remarks.match(/\(([A-Z]+)\)/) ? claim.remarks.match(/\(([A-Z]+)\)/)[1] : 'LEAVE',
          natureOfLeave: formatNatureOfLeave(claim.remarks.match(/\(([A-Z]+)\)/) ? claim.remarks.match(/\(([A-Z]+)\)/)[1] : 'LEAVE', claim.remarks)
        } : null);

        if (leaveInfo) {
          if (seenLeaveDates.has(dIso)) {
            continue; // Suppress extra train movement rows on leave date
          }
          seenLeaveDates.add(dIso);

          finalRows.push({
            id: claim.id,
            row_order: finalRows.length + 1,
            link_number: claim.link_number,
            date_str: claim.date_str,
            date_iso: claim.duty_date,
            is_same_date_as_prev: false,
            train_no: '---',
            from_station: '---',
            to_station: '---',
            dep_time: '---',
            arr_time: '---',
            ta_a1: '',
            ta_a: '',
            ta_b1: '',
            ta_ord: '',
            days_claiming_ta: null,
            absence_hours: 0,
            claim_amount: 0,
            is_leave: true,
            leave_code: leaveInfo.code,
            nature_of_leave: leaveInfo.natureOfLeave,
            object_of_journey: claim.object_of_journey || (category.id === 1 ? 'MANNING AC COACHES' : 'MANNING SLEEPER COACHES'),
            remarks: leaveInfo.natureOfLeave
          });
        } else {
          finalRows.push({
            id: claim.id,
            row_order: finalRows.length + 1,
            link_number: claim.link_number,
            date_str: claim.date_str,
            date_iso: claim.duty_date,
            is_same_date_as_prev: finalRows.length > 0 && claim.duty_date === finalRows[finalRows.length - 1].date_iso,
            train_no: claim.train_no,
            from_station: claim.from_station,
            to_station: claim.to_station,
            dep_time: claim.dep_time,
            arr_time: claim.arr_time,
            ta_a1: '',
            ta_a: '',
            ta_b1: claim.ta_percentage !== null && claim.ta_percentage !== undefined ? String(claim.ta_percentage) : '',
            days_claiming_ta: claim.ta_percentage,
            absence_hours: claim.absence_hours,
            claim_amount: claim.claim_amount,
            object_of_journey: claim.object_of_journey || (category.id === 1 ? 'MANNING AC COACHES' : 'MANNING SLEEPER COACHES'),
            remarks: claim.remarks || ''
          });
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Filter out orphaned overnight train legs and un-tallied single movements
  // Rule: "outgoing (moving from hq) incomming (return back to hq) should tallied, no single movement is printed on ta"
  // If an overnight train leg had its departure on a leave date, its arrival leg must not appear.
  // If an overnight train leg had its arrival on a leave date, its departure leg must not appear.
  // -------------------------------------------------------------
  let cleanedRows = [];
  for (let i = 0; i < finalRows.length; i++) {
    const r = finalRows[i];
    if (r.is_leave || r.train_no === '---') {
      cleanedRows.push(r);
      continue;
    }

    const dIso = r.duty_date || r.date_iso || resolveDutyDateIso(r);
    if (!dIso) {
      cleanedRows.push(r);
      continue;
    }

    const isDepOnly = (r.dep_time && r.dep_time !== '---') && (!r.arr_time || r.arr_time === '---');
    const isArrOnly = (!r.dep_time || r.dep_time === '---') && (r.arr_time && r.arr_time !== '---');

    // 1. Arrival-only leg: check if departure on preceding day was on leave or missing
    if (isArrOnly) {
      const prevIso = getAdjacentDateIso(dIso, -1);
      if (prevIso && leaveInfoMap[prevIso]) {
        // Departure on preceding day was canceled due to leave; cannot arrive on a train never departed on!
        continue;
      }
      if (prevIso && prevIso >= actualStart) {
        const hasDep = finalRows.some(x => {
          const xIso = x.duty_date || x.date_iso || resolveDutyDateIso(x);
          return xIso === prevIso && x.train_no === r.train_no && x.dep_time && x.dep_time !== '---';
        });
        if (!hasDep) {
          // Matching departure is missing on the previous day in this journal
          continue;
        }
      }
    }

    // 2. Departure-only leg: check if arrival on succeeding day is on leave or missing
    if (isDepOnly) {
      const nextIso = getAdjacentDateIso(dIso, 1);
      if (nextIso && leaveInfoMap[nextIso]) {
        // Arrival on next day is canceled due to leave; cannot depart on a train that arrives on leave date!
        continue;
      }
      if (nextIso && nextIso <= actualEnd) {
        const hasNextDayInRows = finalRows.some(x => {
          const xIso = x.duty_date || x.date_iso || resolveDutyDateIso(x);
          return xIso === nextIso;
        });
        if (hasNextDayInRows) {
          const hasArr = finalRows.some(x => {
            const xIso = x.duty_date || x.date_iso || resolveDutyDateIso(x);
            return xIso === nextIso && x.train_no === r.train_no && x.arr_time && x.arr_time !== '---';
          });
          if (!hasArr) {
            // Matching arrival is missing on the next day in this journal
            continue;
          }
        }
      }
    }

    cleanedRows.push(r);
  }

  // Recalculate TA claims across the finalized journal rows to ensure 24-hr cycle rules
  cleanedRows = recalculateJournalRowsTa(cleanedRows);

  // Re-index row order and is_same_date_as_prev
  finalRows = cleanedRows.map((r, idx) => ({
    ...r,
    row_order: idx + 1,
    is_same_date_as_prev: idx > 0 && !r.is_leave && !cleanedRows[idx - 1].is_leave && r.date_str === cleanedRows[idx - 1].date_str
  }));

  const totalDays = finalRows.reduce((sum, r) => sum + (parseFloat(r.days_claiming_ta || r.ta_b1) || 0), 0);
  const totalAmount = finalRows.reduce((sum, r) => sum + (parseFloat(r.claim_amount) || 0), 0);
  const periodLabel = `${actualStart.split('-').reverse().join('/')} TO ${actualEnd.split('-').reverse().join('/')}`;

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
    start_date: actualStart,
    end_date: actualEnd,
    period_label: periodLabel,
    month_year: monthYearStr,
    month_name: new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long' }).toUpperCase(),
    year: y,
    month: m,
    rows: finalRows,
    total_days: Math.round(totalDays * 10) / 10,
    total_amount: totalAmount,
    pending_count: pendingCount,
    rejected_count: rejectedCount,
    approved_count: finalRows.length
  };
}

module.exports = {
  calculateAbsenceAndTa,
  computeDynamicTa,
  calculateDayDutiesTa,
  recalculateJournalRowsTa,
  generatePendingTaClaimsForMonth,
  generateStaffTaJournal,
  getDutyRowsForLinkNumber
};

