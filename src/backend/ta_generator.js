const { getDayOffset, getBaseLinkNumber } = require('./rotation');

const KNOWN_LINK_SETS = {
  1: [
    [1, 2, 3],
    [4, 5, 6],
    [8, 9, 10, 11, 12, 13],
    [15, 16, 17],
    [18, 19, 20]
  ],
  2: [
    [1, 2],
    [3, 4],
    [5, 6],
    [8, 9, 10],
    [11, 12, 13],
    [15, 16],
    [17, 18],
    [19, 20],
    [22, 23, 24],
    [25, 26, 27],
    [29, 30],
    [31, 32],
    [33, 34],
    [36, 37, 38],
    [39, 40, 41],
    [43, 44, 45, 46],
    [47, 48],
    [50, 51, 52],
    [53, 54, 55],
    [57, 58, 59]
  ],
  3: [
    [1, 2, 3],
    [4, 5, 6]
  ]
};

const NON_DAILY_LINK_TRAINS = {
  60: '22882',
  61: '17221',
  62: '17069',
  63: 'R'
};

const NON_DAILY_PAIRS_MAP = {
  // SUNDAY
  '17032': { returnTrain: '17031', serviceName: 'BZA-CHZ-BZA Exp', from: 'BZA', via: 'CHZ', to: 'BZA', depTime: '11:05', retDepTime: '12:40', arrHqTime: '12:40', totalDays: 2, restTill: '20:40', coaches: 'SL / AC' },
  '17231': { returnTrain: '17232', serviceName: 'BZA-CHZ-BZA Exp', from: 'BZA', via: 'CHZ', to: 'BZA', depTime: '13:50', retDepTime: '23:40', arrHqTime: '06:25', totalDays: 2, restTill: '14:25', coaches: 'SL / AC' },
  '07029': { returnTrain: '17232', serviceName: 'BZA-CHZ-BZA Exp', from: 'BZA', via: 'CHZ', to: 'BZA', depTime: '11:05', retDepTime: '23:40', arrHqTime: '06:25', totalDays: 2, restTill: '14:25', coaches: 'SL / AC' },
  '02811': { returnTrain: '02812', serviceName: 'GNT-DMM-BZA Spl', from: 'GNT', via: 'DMM', to: 'BZA', depTime: '08:30', retDepTime: '08:30', arrHqTime: '18:00', totalDays: 2, restTill: '02:00', coaches: 'SL / AC' },
  '17425': { returnTrain: '17426', serviceName: 'GNT-SC-GNT Exp', from: 'GNT', via: 'SC', to: 'GNT', depTime: '10:40', retDepTime: '11:40', arrHqTime: '17:10', totalDays: 2, restTill: '01:10', coaches: 'SL / AC' },

  // MONDAY
  '07609': { returnTrain: '07610', serviceName: 'GNT-RU-GNT Spl', from: 'GNT', via: 'RU', to: 'GNT', depTime: '02:55', retDepTime: '13:35', arrHqTime: '10:00', totalDays: 2, restTill: '18:00', coaches: 'SL / AC' },
  '17646': { returnTrain: '17625', serviceName: 'GNT-SC-KCG-RAL Exp', from: 'GNT', via: 'SC/KCG', to: 'RAL', depTime: '08:50', retDepTime: '22:20', arrHqTime: '06:25', totalDays: 2, restTill: '14:25', coaches: 'SL / AC' },
  '17637': { returnTrain: '17638', serviceName: 'GNT-RU-GNT Exp', from: 'GNT', via: 'RU', to: 'GNT', depTime: '07:00', retDepTime: '14:30', arrHqTime: '14:30', totalDays: 2, restTill: '22:30', coaches: 'SL / AC' },
  '20629': { returnTrain: '07198', serviceName: 'GNT-RU-GNT Exp', from: 'GNT', via: 'RU', to: 'GNT', depTime: '19:10', retDepTime: '01:50', arrHqTime: '01:50', totalDays: 2, restTill: '09:50', coaches: 'SL / AC' },
  '07227': { returnTrain: '07228', serviceName: 'GNT-CHZ-GNT Spl', from: 'GNT', via: 'CHZ', to: 'GNT', depTime: '06:00', retDepTime: '12:00', arrHqTime: '12:00', totalDays: 2, restTill: '20:00', coaches: 'SL / AC' },

  // TUESDAY
  '17041': { returnTrain: '17042', serviceName: 'GNT-RU-GNT Exp', from: 'GNT', via: 'RU', to: 'GNT', depTime: '12:20', retDepTime: '10:40', arrHqTime: '17:40', totalDays: 2, restTill: '01:40', coaches: 'SL / AC' },
  '07615': { returnTrain: '07616', serviceName: 'GNT-RU-GNT Spl', from: 'GNT', via: 'RU', to: 'GNT', depTime: '23:10', retDepTime: '07:30', arrHqTime: '15:05', totalDays: 2, restTill: '23:05', coaches: 'SL / AC' },
  '17077': { returnTrain: '17078', serviceName: 'GNT-TPTY-GNT Exp', from: 'GNT', via: 'TPTY', to: 'GNT', depTime: '18:00', retDepTime: '02:30', arrHqTime: '02:30', totalDays: 2, restTill: '10:30', coaches: 'SL / AC' },

  // WEDNESDAY (3-Day Beats)
  '22882': { returnTrain: '22881', serviceName: 'BBS-PUNE Exp (Link #60)', from: 'GNT', via: 'WADI', to: 'GNT', depTime: '10:35', retDepTime: '16:55', arrHqTime: '02:05', totalDays: 3, restTill: '10:05', coaches: 'SL / AC' },
  '17221': { returnTrain: '17222', serviceName: 'COA-LTT Exp (Link #61)', from: 'GNT', via: 'WADI', to: 'GNT', depTime: '13:35', retDepTime: '23:00', arrHqTime: '08:15', totalDays: 3, restTill: '16:15', coaches: 'SL / AC' },
  '17069': { returnTrain: '17262', serviceName: 'GNT-TPTY / RU-GNT Exp (Link #62)', from: 'GNT', via: 'RU/TPTY', to: 'GNT', depTime: '22:40', retDepTime: '19:25', arrHqTime: '07:20', totalDays: 3, restTill: '15:20', coaches: 'SL / AC' },

  // THURSDAY
  '12755': { returnTrain: '12756', serviceName: 'BZA-SC-BZA Exp', from: 'BZA', via: 'SC', to: 'BZA', depTime: '08:40', retDepTime: '06:40', arrHqTime: '12:50', totalDays: 2, restTill: '20:50', coaches: 'SL / AC' },
  '12604': { returnTrain: '16357', serviceName: 'GNT-MAS-MS-GNT Exp', from: 'GNT', via: 'MAS/MS', to: 'GNT', depTime: '22:00', retDepTime: '13:00', arrHqTime: '21:10', totalDays: 2, restTill: '05:10', coaches: 'SL / AC' },
  '17261': { returnTrain: '17070', serviceName: 'GNT-TPTY-RU-GNT Exp', from: 'GNT', via: 'TPTY/RU', to: 'GNT', depTime: '16:30', retDepTime: '22:40', arrHqTime: '05:15', totalDays: 3, restTill: '13:15', coaches: 'SL / AC' },
  '07001': { returnTrain: '07002', serviceName: 'GNT-TPTY-GNT Spl', from: 'GNT', via: 'TPTY', to: 'GNT', depTime: '16:30', retDepTime: '03:50', arrHqTime: '03:50', totalDays: 2, restTill: '11:50', coaches: 'SL / AC' },

  // FRIDAY
  '18063': { returnTrain: '18064', serviceName: 'GNT-DMM-GNT Exp', from: 'GNT', via: 'DMM', to: 'GNT', depTime: '09:45', retDepTime: '08:15', arrHqTime: '19:25', totalDays: 2, restTill: '03:25', coaches: 'SL / AC' },
  '07125': { returnTrain: '07126', serviceName: 'GNT-RU-GNT Spl', from: 'GNT', via: 'RU', to: 'GNT', depTime: '17:40', retDepTime: '01:10', arrHqTime: '01:10', totalDays: 2, restTill: '09:10', coaches: 'SL / AC' },
  '07195': { returnTrain: '20630', serviceName: 'GNT-RU-GNT Spl', from: 'GNT', via: 'RU', to: 'GNT', depTime: '19:10', retDepTime: '01:50', arrHqTime: '01:50', totalDays: 2, restTill: '09:50', coaches: 'SL / AC' },
  '17607': { returnTrain: '17608', serviceName: 'GNT-RU-GNT Exp', from: 'GNT', via: 'RU', to: 'GNT', depTime: '12:20', retDepTime: '19:20', arrHqTime: '19:20', totalDays: 2, restTill: '03:20', coaches: 'SL / AC' },

  // SATURDAY
  '07193': { returnTrain: '07194', serviceName: 'GNT-KPD-GNT Spl', from: 'GNT', via: 'KPD', to: 'GNT', depTime: '05:30', retDepTime: '01:00', arrHqTime: '10:40', totalDays: 2, restTill: '18:40', coaches: 'SL / AC' },
  '16358': { returnTrain: '12603', serviceName: 'GNT-MS-MAS-GNT Exp', from: 'GNT', via: 'MS/MAS', to: 'GNT', depTime: '14:00', retDepTime: '16:45', arrHqTime: '23:25', totalDays: 2, restTill: '07:25', coaches: 'SL / AC' }
};

function getMultiDayNonDailyMatch(trainCodeOrReason) {
  if (!trainCodeOrReason) return null;
  const str = String(trainCodeOrReason).toUpperCase();
  for (const [outTrain, info] of Object.entries(NON_DAILY_PAIRS_MAP)) {
    if (str.includes(outTrain) || (info.returnTrain && str.includes(info.returnTrain))) {
      const isReturn = info.returnTrain && str.includes(info.returnTrain) && !str.includes(outTrain);
      return { ...info, outTrain, isReturn };
    }
  }
  return null;
}

function getLinkSetDetails(categoryId, linkNumber) {
  const catId = parseInt(categoryId, 10);
  const linkNum = parseInt(linkNumber, 10);
  if (!catId || !linkNum) return null;

  const sets = KNOWN_LINK_SETS[catId];
  if (sets) {
    for (const s of sets) {
      const idx = s.indexOf(linkNum);
      if (idx !== -1) {
        return {
          setLength: s.length,
          dayIndexInSet: idx + 1,
          isFirstDayOfSet: idx === 0,
          setLinks: s,
          remainingLinks: s.slice(idx + 1)
        };
      }
    }
  }
  return null;
}

function checkMultiDayLeaveReturnSync(staffId, categoryId, rowPosition, cycleLength, anchorDate, targetDateStr, musterMap, overrideMap) {
  function checkStaffLeave(dateStr) {
    const muster = musterMap ? musterMap[dateStr] : null;
    if (muster && ['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'SICK', 'CR', 'R', 'O', 'NH'].includes(muster.code.toUpperCase())) {
      const isSick = muster.code.toUpperCase() === 'SICK' || muster.code.toUpperCase() === 'LHAP';
      return { isLeave: true, status: isSick ? 'SICK' : muster.code.toUpperCase(), isSick };
    }
    const ov = overrideMap ? overrideMap[dateStr] : null;
    if (ov) {
      if (ov.status === 'AVAILABLE_FOR_BOOKING' || (ov.reason && ov.reason.toLowerCase().includes('available for booking'))) {
        return null;
      }
      if (['LEAVE', 'SICK', 'CR', 'REST', 'ABSENT'].includes(ov.status) || ov.leave_type) {
        const isSick = ov.status === 'SICK' || ov.leave_type === 'SICK' || ov.leave_type === 'LHAP' || (ov.reason && ov.reason.toLowerCase().includes('sick'));
        return { isLeave: true, status: isSick ? 'SICK' : (ov.leave_type || ov.status), isSick };
      }
      if (ov.overridden_link_number === null && ov.reason && (ov.reason.toLowerCase().includes('leave') || ov.reason.toLowerCase().includes('sick'))) {
        const isSick = ov.reason.toLowerCase().includes('sick');
        return { isLeave: true, status: isSick ? 'SICK' : 'LEAVE', isSick };
      }
    }
    return null;
  }

  // 1. If staff is on leave today, return null
  const todayLeave = checkStaffLeave(targetDateStr);
  if (todayLeave) return null;

  // 2. Today's scheduled cyclic link
  const todayDayOffset = getDayOffset(anchorDate, targetDateStr);
  const todayLinkNum = getBaseLinkNumber(rowPosition, todayDayOffset, cycleLength);
  if (todayLinkNum === null) return null;

  // 3. Check multi-day link set details
  const todayLinkSet = getLinkSetDetails(categoryId, todayLinkNum);

  if (todayLinkSet && todayLinkSet.dayIndexInSet > 1) {
    const daysSinceStart = todayLinkSet.dayIndexInSet - 1;
    for (let k = daysSinceStart; k >= 1; k--) {
      const prevD = new Date(targetDateStr + 'T12:00:00');
      prevD.setDate(prevD.getDate() - k);
      const prevDateStr = prevD.toISOString().split('T')[0];
      const prevLeave = checkStaffLeave(prevDateStr);

      if (prevLeave) {
        const startDayOffset = getDayOffset(anchorDate, prevDateStr);
        const startLinkNum = getBaseLinkNumber(rowPosition, startDayOffset, cycleLength);
        const isSick = prevLeave.isSick || prevLeave.status === 'SICK';
        return {
          isAvailable: true,
          status: 'AVAILABLE_FOR_BOOKING',
          isSickReturn: isSick,
          reason: isSick
            ? `Available for Booking Duty at HQ (Came out of SICK leave on Link #${startLinkNum})`
            : `Available for Booking Duty at HQ (Took leave on Link #${startLinkNum})`
        };
      }
    }
  }

  return null;
}

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

  // 1. Return leg reaching HQ / GNT (whether dep is null or connecting morning leg from BZA e.g. 57210, 57201, 12703)
  if (arrM !== null && (toStn === 'GNT' || toStn === '---') && (depM === null || ['57210', '57201', '12703'].includes(trainNo) || fromStn === 'BZA')) {
    const hours = Math.round((arrM / 60) * 10) / 10;
    if (arrM <= 5) return { absence_hours: hours, ta_percentage: null };
    if (arrM <= 6 * 60) return { absence_hours: hours, ta_percentage: 0.3 };
    if (arrM <= 12 * 60) return { absence_hours: hours, ta_percentage: 0.7 };
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

      if (destTo === 'GNT' && (finalArrM === null || finalArrM === 0 || finalArrM >= 12 * 60 || destArr === '00:00' || destArr === '24:00')) {
        dayTa = 1.0;
      } else if (restHours > 12 || outstationDep.train_no === '12603') {
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
      else if (arrM <= 6 * 60) arrTa = 0.3;
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
          { train_no: '17225', from: 'BZA', to: '---', dep: '19:45', arr: '---', ta: 0.7 }
        ];
      case 2:
        return [
          { train_no: '17225', from: '---', to: 'GTL', dep: '---', arr: '05:10', ta: null },
          { train_no: '17226', from: 'GTL', to: '---', dep: '19:10', arr: '---', ta: 1.0 }
        ];
      case 3:
        return [
          { train_no: '17226', from: '---', to: 'BZA', dep: '---', arr: '03:50', ta: null },
          { train_no: '57210', from: 'BZA', to: 'GNT', dep: '06:20', arr: '07:35', ta: 0.7 }
        ];
      case 4:
        return [
          { train_no: '17261', from: 'GNT', to: '---', dep: '16:30', arr: '---', ta: 0.7 }
        ];
      case 5:
        return [
          { train_no: '17261', from: '---', to: 'TPTY', dep: '---', arr: '03:50', ta: null },
          { train_no: '12733', from: 'TPTY', to: '---', dep: '18:20', arr: '---', ta: 1.0 }
        ];
      case 6:
        return [
          { train_no: '12733', from: '---', to: 'GNT', dep: '---', arr: '00:35', ta: 0.3 }
        ];
      case 7:
        return []; // REST
      case 8:
        return [
          { train_no: '20629', from: 'GNT', to: '---', dep: '19:10', arr: '---', ta: 0.3 }
        ];
      case 9:
        return [
          { train_no: '20629', from: '---', to: 'TPTY', dep: '---', arr: '01:50', ta: null },
          { train_no: '12733', from: 'TPTY', to: '---', dep: '18:20', arr: '---', ta: 1.0 }
        ];
      case 10:
        return [
          { train_no: '12733', from: '---', to: 'GNT', dep: '---', arr: '00:50', ta: 0.3 },
          { train_no: '12734', from: 'GNT', to: '---', dep: '23:10', arr: '---', ta: 0.3 }
        ];
      case 11:
        return [
          { train_no: '12734', from: '---', to: 'TPTY', dep: '---', arr: '06:00', ta: null },
          { train_no: '20630', from: 'TPTY', to: '---', dep: '23:15', arr: '---', ta: 1.0 }
        ];
      case 12:
        return [
          { train_no: '20630', from: '---', to: 'GNT', dep: '---', arr: '05:55', ta: 0.3 },
          { train_no: '12604', from: 'GNT', to: '---', dep: '22:00', arr: '---', ta: 0.3 }
        ];
      case 13:
        return [
          { train_no: '12604', from: '---', to: 'MAS', dep: '---', arr: '05:45', ta: null },
          { train_no: '12603', from: 'MAS', to: 'GNT', dep: '16:45', arr: '23:30', ta: 1.0 }
        ];
      case 14:
        return []; // REST
      case 15:
        return [
          { train_no: '67230', from: 'GNT', to: 'BZA', dep: '16:25', arr: '18:10', ta: null },
          { train_no: '18047', from: 'BZA', to: '---', dep: '20:45', arr: '---', ta: 0.7 }
        ];
      case 16:
        return [
          { train_no: '18047', from: '---', to: 'GTL', dep: '---', arr: '04:00', ta: null },
          { train_no: '17226', from: 'GTL', to: '---', dep: '19:10', arr: '---', ta: 1.0 }
        ];
      case 17:
        return [
          { train_no: '17226', from: '---', to: 'BZA', dep: '---', arr: '03:55', ta: null },
          { train_no: '57201', from: 'BZA', to: 'GNT', dep: '06:20', arr: '07:35', ta: 0.7 }
        ];
      case 18:
        return [
          { train_no: '12734', from: 'GNT', to: '---', dep: '23:10', arr: '---', ta: 0.3 }
        ];
      case 19:
        return [
          { train_no: '12734', from: '---', to: 'TPTY', dep: '---', arr: '06:00', ta: null },
          { train_no: '17262', from: 'TPTY', to: '---', dep: '19:30', arr: '---', ta: 1.0 }
        ];
      case 20:
        return [
          { train_no: '17262', from: '---', to: 'GNT', dep: '---', arr: '06:55', ta: 0.7 }
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

  // Category 3: Ladies Staff / TTE - 7-day cycle (3-Day Link 17261/17262)
  if (categoryId === 3) {
    switch (linkNumber) {
      case 1:
      case 4:
        return [
          { train_no: '17261', from: 'GNT', to: 'TPTY', dep: '16:30', arr: '04:00', ta: 0.7 }
        ];
      case 2:
      case 5:
        return [
          { train_no: '17262', from: 'TPTY', to: '---', dep: '19:30', arr: '---', ta: 1.0 }
        ];
      case 3:
      case 6:
        return [
          { train_no: '17262', from: '---', to: 'GNT', dep: '---', arr: '06:55', ta: 0.7 }
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

function resolveDutyCodeToRows(dutyCode) {
  if (!dutyCode) return [];
  const code = String(dutyCode).trim();
  if (code === 'REST' || code === 'OFF' || code === 'AVL' || code === 'SPARE (HQ)' || code === '---' || code === '-') {
    return [];
  }
  if (code.includes('22882') && !code.includes('22881')) {
    return [{ train_no: '22882', from: 'GNT', to: 'WADI', dep: '10:35', arr: '21:10', ta: 0.7 }];
  }
  if (code.includes('22881')) {
    return [
      { train_no: '22881', from: 'WADI', to: '---', dep: '16:55', arr: '---', ta: 1.0 },
      { train_no: '22881', from: '---', to: 'GNT', dep: '---', arr: '02:05', ta: 0.3 }
    ];
  }
  if (code.includes('22882/22881') || code.includes('22882 / 22881')) {
    return [
      { train_no: '22882', from: 'GNT', to: 'WADI', dep: '10:35', arr: '21:10', ta: 0.7 }
    ];
  }
  if (code.includes('17221') && !code.includes('17222')) {
    return [{ train_no: '17221', from: 'GNT', to: 'WADI', dep: '13:35', arr: '00:05', ta: 0.7 }];
  }
  if (code.includes('17222')) {
    return [
      { train_no: '17222', from: 'WADI', to: '---', dep: '23:00', arr: '---', ta: 1.0 },
      { train_no: '17222', from: '---', to: 'GNT', dep: '---', arr: '08:15', ta: 0.7 }
    ];
  }
  if (code.includes('17069') && !code.includes('17262')) {
    return [{ train_no: '17069', from: 'GNT', to: 'RU', dep: '22:40', arr: '07:15', ta: 0.3 }];
  }
  if (code.includes('17070')) {
    return [
      { train_no: '17070', from: 'TPTY', to: '---', dep: '22:40', arr: '---', ta: 1.0 },
      { train_no: '17070', from: '---', to: 'GNT', dep: '---', arr: '05:15', ta: 0.3 }
    ];
  }
  if (code.includes('17231') && !code.includes('17232')) {
    return [{ train_no: '17231', from: 'BZA', to: 'CHZ', dep: '13:50', arr: '22:15', ta: 0.7 }];
  }
  if (code.includes('17232')) {
    return [
      { train_no: '17232', from: 'CHZ', to: 'BZA', dep: '23:40', arr: '06:25', ta: 1.0 }
    ];
  }
  if (code.includes('07029')) {
    return [{ train_no: '07029', from: 'BZA', to: 'CHZ', dep: '11:05', arr: '20:30', ta: 0.7 }];
  }
  if (code.includes('02811') && !code.includes('02812')) {
    return [{ train_no: '02811', from: 'GNT', to: 'DMM', dep: '08:30', arr: '18:00', ta: 0.7 }];
  }
  if (code.includes('02812')) {
    return [{ train_no: '02812', from: 'DMM', to: 'BZA', dep: '08:30', arr: '18:00', ta: 0.7 }];
  }
  if (code.includes('07609') && !code.includes('07610')) {
    return [{ train_no: '07609', from: 'GNT', to: 'RU', dep: '02:55', arr: '10:00', ta: 0.7 }];
  }
  if (code.includes('07610')) {
    return [{ train_no: '07610', from: 'RU', to: 'GNT', dep: '13:35', arr: '21:30', ta: 0.7 }];
  }
  if (code.includes('07615') && !code.includes('07616')) {
    return [{ train_no: '07615', from: 'GNT', to: 'RU', dep: '23:10', arr: '06:30', ta: 0.3 }];
  }
  if (code.includes('07616')) {
    return [{ train_no: '07616', from: 'RU', to: 'GNT', dep: '07:30', arr: '15:05', ta: 0.7 }];
  }
  if (code.includes('17041') && !code.includes('17042')) {
    return [{ train_no: '17041', from: 'GNT', to: 'RU', dep: '12:20', arr: '19:45', ta: 0.7 }];
  }
  if (code.includes('17042')) {
    return [{ train_no: '17042', from: 'RU', to: 'GNT', dep: '10:40', arr: '17:40', ta: 0.7 }];
  }
  if (code.includes('18063') && !code.includes('18064')) {
    return [{ train_no: '18063', from: 'GNT', to: 'DMM', dep: '09:45', arr: '17:30', ta: 0.7 }];
  }
  if (code.includes('18064')) {
    return [{ train_no: '18064', from: 'DMM', to: 'GNT', dep: '08:15', arr: '19:25', ta: 0.7 }];
  }
  if (code.includes('07193') && !code.includes('07194')) {
    return [{ train_no: '07193', from: 'GNT', to: 'KPD', dep: '05:30', arr: '14:30', ta: 0.7 }];
  }
  if (code.includes('07194')) {
    return [
      { train_no: '07194', from: 'KPD', to: '---', dep: '01:00', arr: '---', ta: 1.0 },
      { train_no: '07194', from: '---', to: 'GNT', dep: '---', arr: '10:40', ta: 0.7 }
    ];
  }
  if (code.includes('16358') && !code.includes('12603')) {
    return [{ train_no: '16358', from: 'GNT', to: 'MS', dep: '14:00', arr: '23:00', ta: 0.7 }];
  }
  if (code.includes('16357')) {
    return [{ train_no: '16357', from: 'MAS', to: 'GNT', dep: '13:00', arr: '21:10', ta: 0.7 }];
  }
  if (code.includes('17625')) {
    return [{ train_no: '17625', from: 'KCG', to: 'RAL', dep: '22:20', arr: '05:30', ta: 0.7 }];
  }
  if (code.includes('17626')) {
    return [{ train_no: '17626', from: 'RAL', to: 'KCG', dep: '23:30', arr: '06:45', ta: 0.7 }];
  }
  if (code.includes('17425')) {
    return [{ train_no: '17425', from: 'GNT', to: 'SC', dep: '10:40', arr: '17:30', ta: 0.7 }];
  }
  if (code.includes('17426')) {
    return [{ train_no: '17426', from: 'SC', to: 'GNT', dep: '11:40', arr: '17:10', ta: 0.7 }];
  }
  if (code.includes('12604 / 12603') || code.includes('12604/12603') || code === '12604') {
    return [{ train_no: '12604', from: 'GNT', to: '---', dep: '22:00', arr: '---', ta: 0.3 }];
  }
  if (code === '12603') {
    return [
      { train_no: '12604', from: '---', to: 'MAS', dep: '---', arr: '05:45', ta: null },
      { train_no: '12603', from: 'MAS', to: 'GNT', dep: '16:45', arr: '23:30', ta: 1.0 }
    ];
  }
  if (code === '17226') {
    return [
      { train_no: '17226', from: 'GTL', to: '---', dep: '19:10', arr: '---', ta: 1.0 }
    ];
  }
  if (code === '18047' || code.includes('18047')) {
    return [
      { train_no: '67230', from: 'GNT', to: 'BZA', dep: '16:25', arr: '18:10', ta: null },
      { train_no: '18047', from: 'BZA', to: '---', dep: '20:45', arr: '---', ta: 0.7 }
    ];
  }
  if (code === '18048' || code.includes('18048')) {
    return [
      { train_no: '18048', from: 'GTL', to: 'BZA', dep: '14:30', arr: '22:45', ta: 0.7 },
      { train_no: '12703', from: 'BZA', to: 'GNT', dep: '23:30', arr: '00:15', ta: 0.3 }
    ];
  }
  if (code === '12734' || code.includes('12734')) {
    return [{ train_no: '12734', from: 'GNT', to: '---', dep: '23:10', arr: '---', ta: 0.3 }];
  }
  if (code === '12733' || code.includes('12733')) {
    return [
      { train_no: '12734', from: '---', to: 'TPTY', dep: '---', arr: '06:00', ta: null },
      { train_no: '12733', from: 'TPTY', to: '---', dep: '18:20', arr: '---', ta: 1.0 }
    ];
  }
  if (code === '17261') {
    return [{ train_no: '17261', from: 'GNT', to: '---', dep: '16:30', arr: '---', ta: 0.7 }];
  }
  if (code === '17262') {
    return [
      { train_no: '17261', from: '---', to: 'TPTY', dep: '---', arr: '03:50', ta: null },
      { train_no: '17262', from: 'TPTY', to: '---', dep: '19:30', arr: '---', ta: 1.0 }
    ];
  }
  if (code === '20629') {
    return [{ train_no: '20629', from: 'GNT', to: '---', dep: '19:10', arr: '---', ta: 0.3 }];
  }
  if (code === '20630') {
    return [
      { train_no: '20629', from: '---', to: 'TPTY', dep: '---', arr: '01:50', ta: null },
      { train_no: '20630', from: 'TPTY', to: '---', dep: '23:15', arr: '---', ta: 1.0 }
    ];
  }
  if (code === '17253' || code.includes('17253')) {
    return [{ train_no: '17253', from: 'GNT', to: 'DHNE', dep: '06:15', arr: '14:20', ta: 0.7 }];
  }
  if (code === '17252' || code.includes('17252')) {
    return [{ train_no: '17252', from: 'DHNE', to: 'GNT', dep: '15:30', arr: '23:10', ta: 0.7 }];
  }
  if (code === '17251' || code.includes('17251')) {
    return [{ train_no: '17251', from: 'GNT', to: 'DHNE', dep: '16:30', arr: '05:00', ta: 0.7 }];
  }
  if (code === '17254' || code.includes('17254')) {
    return [{ train_no: '17254', from: 'DHNE', to: 'GNT', dep: '16:30', arr: '23:45', ta: 0.7 }];
  }
  if (code.includes('12747') || code.includes('12748')) {
    return [
      { train_no: '12747', from: 'GNT', to: 'VKB', dep: '05:45', arr: '12:00', ta: null },
      { train_no: '12748', from: 'VKB', to: 'GNT', dep: '14:40', arr: '21:10', ta: 0.7 }
    ];
  }
  if (code.includes('17201') || code.includes('17202')) {
    return [
      { train_no: '17201', from: 'GNT', to: 'KZJ', dep: '06:00', arr: '12:00', ta: null },
      { train_no: '17202', from: 'KZJ', to: 'GNT', dep: '15:45', arr: '21:30', ta: 0.7 }
    ];
  }
  if (code.includes('17281') || code.includes('17282')) {
    return [
      { train_no: '17281', from: 'GNT', to: 'NS', dep: '17:45', arr: '22:30', ta: 0.7 },
      { train_no: '17282', from: 'NS', to: 'GNT', dep: '06:00', arr: '10:45', ta: 0.7 }
    ];
  }
  if (code.includes('17255') || code.includes('17256')) {
    return [
      { train_no: '17255', from: 'GNT', to: 'HYB', dep: '22:30', arr: '05:00', ta: 0.7 },
      { train_no: '17256', from: 'HYB', to: 'GNT', dep: '21:45', arr: '04:15', ta: 0.7 }
    ];
  }
  if (code.includes('17645') || code.includes('17646')) {
    return [
      { train_no: '17646', from: 'GNT', to: 'SC', dep: '07:15', arr: '14:30', ta: 0.7 },
      { train_no: '17645', from: 'SC', to: 'GNT', dep: '16:00', arr: '23:15', ta: 0.7 }
    ];
  }
  if (code.includes('12705') || code.includes('12795')) {
    return [
      { train_no: '12705', from: 'GNT', to: 'SC', dep: '15:30', arr: '22:15', ta: 0.7 }
    ];
  }
  if (code.includes('12805') || code.includes('12806')) {
    return [
      { train_no: '12805', from: 'BZA', to: 'GNT', dep: '12:00', arr: '13:15', ta: 0.3 }
    ];
  }
  if (code.includes('12756')) {
    return [
      { train_no: '12756', from: 'SC', to: 'BZA', dep: '12:30', arr: '19:45', ta: 0.7 }
    ];
  }
  if (code.includes('07227') || code.includes('7227')) {
    return [
      { train_no: '07227', from: 'GNT', to: '---', dep: '19:30', arr: '---', ta: 0.7 }
    ];
  }
  if (code.includes('57201') || code.includes('57210')) {
    return [{ train_no: '57201', from: 'BZA', to: 'GNT', dep: '06:20', arr: '07:35', ta: 0.7 }];
  }
  if (code.includes('12703')) {
    return [{ train_no: '12703', from: 'BZA', to: 'GNT', dep: '05:45', arr: '06:25', ta: 0.3 }];
  }
  if (code.includes('17225')) {
    return [
      { train_no: '17281', from: 'GNT', to: 'BZA', dep: '17:45', arr: '18:50', ta: null },
      { train_no: '17225', from: 'BZA', to: '---', dep: '19:45', arr: '---', ta: 0.7 }
    ];
  }
  const singleMatch = code.match(/\b\d{4,5}\b/);
  if (singleMatch) {
    return [{ train_no: singleMatch[0], from: 'GNT', to: '---', dep: '17:45', arr: '---', ta: 0.7 }];
  }
  return [];
}

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

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const todayIso = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;

  const daysInMonth = new Date(year, month, 0).getDate();
  let maxDay = daysInMonth;
  if (year > currentYear || (year === currentYear && month > currentMonth)) {
    // Future month -> no duties performed yet
    maxDay = 0;
  } else if (year === currentYear && month === currentMonth) {
    // Current month -> strictly up to current date (today)
    maxDay = Math.min(daysInMonth, currentDay);
  } else {
    // Past month -> all days performed
    maxDay = daysInMonth;
  }

  const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(maxDay > 0 ? maxDay : 1).padStart(2, '0')}`;

  const allNdaEntries = await all(
    staffId
      ? 'SELECT * FROM nda_entries WHERE staff_id = ? AND month_year = ? ORDER BY row_order ASC'
      : 'SELECT * FROM nda_entries WHERE month_year = ? ORDER BY row_order ASC',
    staffId ? [staffId, monthYearStr] : [monthYearStr]
  );
  const ndaMapByStaff = {};
  if (Array.isArray(allNdaEntries)) {
    allNdaEntries.forEach(r => {
      if (!ndaMapByStaff[r.staff_id]) ndaMapByStaff[r.staff_id] = {};
      ndaMapByStaff[r.staff_id][`${r.date_str}_${r.train_no}`] = r;
    });
  }

  const allMusterRecords = await all(
    staffId
      ? 'SELECT * FROM muster_records WHERE staff_id = ? AND date >= ? AND date <= ?'
      : 'SELECT * FROM muster_records WHERE date >= ? AND date <= ?',
    staffId ? [staffId, startDateStr, endDateStr] : [startDateStr, endDateStr]
  );
  const musterMapByStaff = {};
  if (Array.isArray(allMusterRecords)) {
    allMusterRecords.forEach(m => {
      if (!musterMapByStaff[m.staff_id]) musterMapByStaff[m.staff_id] = {};
      musterMapByStaff[m.staff_id][m.date] = m;
    });
  }

  const allOverrides = await all(
    staffId
      ? 'SELECT o.*, s1.name as regular_staff_name, s1.category_id as regular_staff_category FROM overrides o LEFT JOIN staff s1 ON o.staff_id = s1.id WHERE (o.staff_id = ? OR o.substitute_staff_id = ?) AND o.date >= ? AND o.date <= ?'
      : 'SELECT o.*, s1.name as regular_staff_name, s1.category_id as regular_staff_category FROM overrides o LEFT JOIN staff s1 ON o.staff_id = s1.id WHERE o.date >= ? AND o.date <= ?',
    staffId ? [staffId, staffId, startDateStr, endDateStr] : [startDateStr, endDateStr]
  );
  const directOverrideMapByStaff = {};
  const subOverrideMapByStaff = {};
  if (Array.isArray(allOverrides)) {
    allOverrides.forEach(o => {
      if (o.staff_id) {
        if (!directOverrideMapByStaff[o.staff_id]) directOverrideMapByStaff[o.staff_id] = {};
        directOverrideMapByStaff[o.staff_id][o.date] = o;
      }
      if (o.substitute_staff_id) {
        if (!subOverrideMapByStaff[o.substitute_staff_id]) subOverrideMapByStaff[o.substitute_staff_id] = {};
        subOverrideMapByStaff[o.substitute_staff_id][o.date] = o;
      }
    });
  }

  const allLrRecords = await all(
    staffId
      ? 'SELECT * FROM lr_sheet_records WHERE staff_id = ? AND date >= ? AND date <= ?'
      : 'SELECT * FROM lr_sheet_records WHERE date >= ? AND date <= ?',
    staffId ? [staffId, startDateStr, endDateStr] : [startDateStr, endDateStr]
  );
  const lrMapByStaff = {};
  if (Array.isArray(allLrRecords)) {
    allLrRecords.forEach(r => {
      if (!lrMapByStaff[r.staff_id]) lrMapByStaff[r.staff_id] = {};
      lrMapByStaff[r.staff_id][r.date] = r;
    });
  }

  const allEarnings = await all(
    staffId
      ? 'SELECT * FROM daily_earnings_entries WHERE staff_id = ? AND date >= ? AND date <= ?'
      : 'SELECT * FROM daily_earnings_entries WHERE date >= ? AND date <= ?',
    staffId ? [staffId, startDateStr, endDateStr] : [startDateStr, endDateStr]
  );
  const earningsMapByStaff = {};
  if (Array.isArray(allEarnings)) {
    allEarnings.forEach(e => {
      if (!earningsMapByStaff[e.staff_id]) earningsMapByStaff[e.staff_id] = {};
      earningsMapByStaff[e.staff_id][e.date] = e;
    });
  }

  // Clear existing approvals for month before regenerating to keep data fresh and fast
  if (staffId) {
    await run('DELETE FROM ta_approvals WHERE staff_id = ? AND month_year = ?', [staffId, monthYearStr]);
  } else {
    await run('DELETE FROM ta_approvals WHERE month_year = ?', [monthYearStr]);
  }

  let inTx = false;
  try {
    await run('BEGIN TRANSACTION');
    inTx = true;
  } catch (e) {
    inTx = false;
  }
  try {
    for (const staff of allStaff) {
      if (staff.name === '(VACANT)') continue;
      const category = catMap[staff.category_id];
      if (!category) continue;

      const ndaMap = ndaMapByStaff[staff.id] || {};
      const musterMap = musterMapByStaff[staff.id] || {};
      const directOverrideMap = directOverrideMapByStaff[staff.id] || {};
      const subOverrideMap = subOverrideMapByStaff[staff.id] || {};
      const lrMap = lrMapByStaff[staff.id] || {};
      const earningsMap = earningsMapByStaff[staff.id] || {};

      const daRate = staff.pay_amount >= 53100 ? 800 : (staff.pay_amount >= 35400 ? 500 : 800);

      let rowOrder = 0;
      let lastAssignedLink = null;
      let lastTargetCat = null;
      let lastAssignedNonDaily = null;

      for (let d = 1; d <= maxDay; d++) {
        const dateStrIso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dateStrDisplay = `${d}/${month}/${String(year).slice(-2)}`;

        const muster = musterMap[dateStrIso];
        const musterCode = muster ? muster.code.toUpperCase() : null;
        const isMusterLeave = muster && ['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'SICK', 'CR', 'R', 'O', 'NH'].includes(musterCode);

        const directOverride = directOverrideMap[dateStrIso];
        const subOverride = subOverrideMap[dateStrIso];
        const lrEntry = lrMap[dateStrIso];
        const earnEntry = earningsMap[dateStrIso];

        const isDirectLeave = directOverride && (['LEAVE', 'SICK', 'CR', 'REST', 'ABSENT'].includes(directOverride.status) || directOverride.leave_type);
        const isEffectiveLeave = isMusterLeave || isDirectLeave;

        let duties = [];
        let linkNum = null;
        let isStandbyHq = false;

        if (isEffectiveLeave) {
          duties = [];
          lastAssignedLink = null;
          lastAssignedNonDaily = null;
        } else if (directOverride && (directOverride.status === 'AVAILABLE_FOR_BOOKING' || (directOverride.reason && (directOverride.reason.toLowerCase().includes('available for booking') || directOverride.reason.toLowerCase().includes('available for other duty') || directOverride.reason.toLowerCase().includes('removed from link') || directOverride.reason.toLowerCase().includes('relieved to hq'))))) {
          // Standby / Available at HQ -> 0 TA
          isStandbyHq = true;
          duties = [];
          lastAssignedLink = null;
          lastAssignedNonDaily = null;
        } else if (directOverride && (directOverride.overridden_link_number !== null && directOverride.overridden_link_number !== undefined)) {
          linkNum = directOverride.overridden_link_number;
          const targetCatId = directOverride.target_category_id || (linkNum > 21 ? 2 : category.id);
          duties = getDutyRowsForLinkNumber(targetCatId, linkNum, linkMap[`${targetCatId}_${linkNum}`] || linkMap[linkNum]);
          if (duties.length === 0 && linkNum > 100) {
            duties = resolveDutyCodeToRows(String(linkNum));
          }
          lastAssignedLink = linkNum;
          lastTargetCat = targetCatId;
          lastAssignedNonDaily = null;
        } else if (directOverride && (directOverride.status === 'EXTRA_CREW' || directOverride.is_extra === 1 || directOverride.extra_train_no)) {
          const trNo = directOverride.extra_train_no || directOverride.reason || 'EXTRA';
          const ndMatch = getMultiDayNonDailyMatch(trNo);
          if (ndMatch) {
            duties = resolveDutyCodeToRows(ndMatch.outTrain);
            lastAssignedNonDaily = { service: ndMatch, dayIndex: 1, totalDays: ndMatch.totalDays };
            lastAssignedLink = null;
          } else {
            duties = resolveDutyCodeToRows(trNo);
            if (duties.length === 0) duties = [{ train_no: trNo, from: 'GNT', to: '---', dep: '17:45', arr: '---', ta: 0.7 }];
            lastAssignedNonDaily = null;
            lastAssignedLink = null;
          }
        } else if (directOverride && (directOverride.status === 'UTILISED_ADVANCE' || directOverride.advance_train_no)) {
          const trNo = directOverride.advance_train_no || 'ADVANCE';
          duties = resolveDutyCodeToRows(trNo);
          if (duties.length === 0) duties = [{ train_no: trNo, from: 'GNT', to: '---', dep: '17:45', arr: '---', ta: 0.7 }];
          lastAssignedNonDaily = null;
          lastAssignedLink = null;
        } else if (subOverride && subOverride.status !== 'AVAILABLE_FOR_BOOKING') {
          // Staff worked as substitute for another employee
          const assignedLink = subOverride.overridden_link_number !== null && subOverride.overridden_link_number !== undefined
            ? subOverride.overridden_link_number
            : subOverride.original_link_number;
          if (assignedLink) {
            linkNum = assignedLink;
            const targetCatId = subOverride.target_category_id || subOverride.regular_staff_category || (linkNum > 21 ? 2 : 1);
            duties = getDutyRowsForLinkNumber(targetCatId, linkNum, linkMap[`${targetCatId}_${linkNum}`] || linkMap[linkNum]);
            if (duties.length === 0 && linkNum > 100) {
              duties = resolveDutyCodeToRows(String(linkNum));
            }
            lastAssignedLink = linkNum;
            lastTargetCat = targetCatId;
            lastAssignedNonDaily = null;
          }
        } else if (lastAssignedNonDaily) {
          if (lastAssignedNonDaily.dayIndex === 1 && lastAssignedNonDaily.totalDays >= 2) {
            const nd = lastAssignedNonDaily.service;
            duties = resolveDutyCodeToRows(nd.returnTrain);
            lastAssignedNonDaily = { ...lastAssignedNonDaily, dayIndex: 2 };
            lastAssignedLink = null;
          } else if (lastAssignedNonDaily.dayIndex === 2 && lastAssignedNonDaily.totalDays === 3) {
            duties = [];
            lastAssignedNonDaily = null;
            lastAssignedLink = null;
          } else {
            lastAssignedNonDaily = null;
          }
        } else if (lastAssignedLink && getLinkSetDetails(lastTargetCat || category.id, lastAssignedLink)?.remainingLinks?.length > 0) {
          const setDetails = getLinkSetDetails(lastTargetCat || category.id, lastAssignedLink);
          const nextLink = setDetails.remainingLinks[0];
          linkNum = nextLink;
          const targetCatId = lastTargetCat || category.id;
          duties = getDutyRowsForLinkNumber(targetCatId, nextLink, linkMap[`${targetCatId}_${nextLink}`] || linkMap[nextLink]);
          lastAssignedLink = nextLink;
        } else if (category.id === 4) {
          lastAssignedLink = null;
          // Category 4: LR Staff
          const dutyCode = lrEntry ? lrEntry.duty_code : (earnEntry ? earnEntry.duty : null);
          if (!dutyCode || ['AVL', 'OFF', 'REST', 'R', 'REST_HQ', 'SPARE', 'CL', 'LAP', 'LHAP', 'SICK', 'CR', 'OD', 'CCL', 'SCL', 'NH', '---', '-'].includes(dutyCode.trim().toUpperCase()) || isEffectiveLeave) {
            duties = [];
            lastAssignedLink = null;
            lastAssignedNonDaily = null;
          } else if (/^\d+$/.test(dutyCode.trim())) {
            const ln = parseInt(dutyCode.trim(), 10);
            if (ln <= 63) {
              const targetCat = (ln > 21 ? 2 : 1);
              duties = getDutyRowsForLinkNumber(targetCat, ln, linkMap[`${targetCat}_${ln}`] || linkMap[ln]);
              lastAssignedLink = ln;
              lastTargetCat = targetCat;
            } else {
              duties = resolveDutyCodeToRows(dutyCode);
              lastAssignedLink = null;
            }
          } else {
            const ndMatch = getMultiDayNonDailyMatch(dutyCode);
            if (ndMatch) {
              if (ndMatch.isReturn) {
                duties = resolveDutyCodeToRows(ndMatch.returnTrain);
                lastAssignedNonDaily = null;
              } else {
                duties = resolveDutyCodeToRows(ndMatch.outTrain);
                lastAssignedNonDaily = { service: ndMatch, dayIndex: 1, totalDays: ndMatch.totalDays };
              }
            } else {
              duties = resolveDutyCodeToRows(dutyCode);
              lastAssignedNonDaily = null;
            }
            lastAssignedLink = null;
          }
        } else {
          lastAssignedLink = null;
          // Regular staff: check multi-day leave return
          const multiDayLeaveReturn = checkMultiDayLeaveReturnSync(
            staff.id, category.id, staff.row_position, category.cycle_length, category.anchor_date, dateStrIso, musterMap, directOverrideMap
          );
          if (multiDayLeaveReturn) {
            isStandbyHq = true;
            duties = [];
            lastAssignedLink = null;
            lastAssignedNonDaily = null;
          } else {
            const offset = getDayOffset(category.anchor_date, dateStrIso);
            linkNum = getBaseLinkNumber(staff.row_position, offset, category.cycle_length);
            const link = linkMap[`${category.id}_${linkNum}`];
            duties = getDutyRowsForLinkNumber(category.id, linkNum, link);
            lastAssignedLink = linkNum;
            lastTargetCat = category.id;
          }
        }

        const dutiesWithTimings = duties.map(duty => {
          let actualDep = duty.dep || '---';
          let actualArr = duty.arr || '---';

          // Check NDA or cache
          const ndaMatch = ndaMap[`${dateStrDisplay}_${duty.train_no}`];
          if (ndaMatch) {
            if (duty.dep && duty.dep !== '---' && ndaMatch.act_dep && ndaMatch.act_dep !== '---') actualDep = ndaMatch.act_dep;
            if (duty.arr && duty.arr !== '---' && ndaMatch.act_arr && ndaMatch.act_arr !== '---') actualArr = ndaMatch.act_arr;
          } else {
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
          const effLeaveCode = musterCode || (directOverride ? (directOverride.leave_type || directOverride.status) : 'LEAVE');
          const claimStatus = isEffectiveLeave ? 'REJECTED' : 'APPROVED';
          const claimRemark = isEffectiveLeave ? `Disallowed: On Leave/Absent as per Muster/Override (${effLeaveCode})` : '';

          await run(
            `INSERT INTO ta_approvals (
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
    if (inTx) {
      try { await run('COMMIT'); } catch (e) {}
    }
  } catch (err) {
    if (inTx) {
      try { await run('ROLLBACK'); } catch (e) {}
    }
    throw err;
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

  // 1. Ensure claims exist in ta_approvals for all months covered in the range
  const monthsCovered = getMonthsBetween(actualStart, actualEnd);
  for (const mInfo of monthsCovered) {
    const totalDaysInMo = new Date(mInfo.year, mInfo.month, 0).getDate();
    const existingClaims = await all(
      'SELECT COUNT(DISTINCT duty_date) as cnt FROM ta_approvals WHERE staff_id = ? AND month_year = ?',
      [staffId, mInfo.monthYearStr]
    );
    const hasFullClaims = existingClaims && existingClaims[0] && existingClaims[0].cnt >= totalDaysInMo;
    if (!hasFullClaims) {
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
        let [d, m, yr] = parts;
        if (yr.length === 2) yr = '20' + yr;
        return `${yr}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }
    return null;
  }

  function getAdjacentDateIso(dIso, offsetDays) {
    if (!dIso || typeof dIso !== 'string') return null;
    const parts = dIso.split('-');
    if (parts.length !== 3) return null;
    const yr = parseInt(parts[0], 10);
    const mo = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const dt = new Date(Date.UTC(yr, mo, day + offsetDays));
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

  // 4. Fetch claims in date range
  const approvedClaims = await all(
    `SELECT * FROM ta_approvals 
     WHERE staff_id = ? AND duty_date >= ? AND duty_date <= ? 
       AND (status = 'APPROVED' OR status = 'PENDING' OR (status = 'REJECTED' AND (remarks LIKE 'Disallowed: On Leave/Absent%' OR remarks LIKE 'Muster%')))
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
  const allStaffOverrides = await all(
    'SELECT * FROM overrides WHERE (staff_id = ? OR substitute_staff_id = ?) AND date >= ? AND date <= ?',
    [staffId, staffId, queryStart, queryEnd]
  );
  const staffOverrideMap = {};
  if (Array.isArray(allStaffOverrides)) {
    allStaffOverrides.forEach(o => {
      if (o.staff_id === staffId) {
        staffOverrideMap[o.date] = o;
      }
    });
  }

  const musterMap = {};
  if (Array.isArray(musterList)) {
    musterList.forEach(m => {
      musterMap[m.date] = m;
    });
  }

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
  if (Array.isArray(allStaffOverrides)) {
    allStaffOverrides.forEach(o => {
      if (o.staff_id === staffId && !leaveInfoMap[o.date]) {
        if (['LEAVE', 'SICK', 'CR', 'REST', 'ABSENT'].includes(o.status) || o.leave_type) {
          const code = o.leave_type || (o.status === 'SICK' ? 'SICK' : (o.status === 'REST' ? 'R' : (o.status === 'CR' ? 'CR' : (o.status === 'ABSENT' ? 'O' : 'LEAVE'))));
          leaveInfoMap[o.date] = {
            code,
            natureOfLeave: formatNatureOfLeave(code, o.reason)
          };
        }
      }
    });
  }

  // Seamlessly merge savedEntries with approvedClaims for any dates not present in savedEntries
  const sourceRows = [];
  const savedDateSet = new Set();
  if (savedEntries && savedEntries.length > 0) {
    savedEntries.forEach(r => {
      const dIso = resolveDutyDateIso(r);
      if (dIso) {
        const ov = staffOverrideMap[dIso];
        const isStandby = ov && (ov.status === 'AVAILABLE_FOR_BOOKING' || (ov.reason && (ov.reason.toLowerCase().includes('available for booking') || ov.reason.toLowerCase().includes('available for other duty') || ov.reason.toLowerCase().includes('removed from link') || ov.reason.toLowerCase().includes('relieved to hq'))));
        const isMultiDayReturn = checkMultiDayLeaveReturnSync(staff.id, category.id, staff.row_position, category.cycle_length, category.anchor_date, dIso, musterMap, staffOverrideMap);
        const hasDutyOverride = ov && (ov.status === 'CHANGED_LINK' || ov.status === 'SUBSTITUTE' || ov.status === 'EXTRA_CREW' || ov.status === 'UTILISED_ADVANCE');

        // If duty was changed via roster override, or staff is on leave / standby at HQ, discard stale saved entry
        if (isStandby || isMultiDayReturn || leaveInfoMap[dIso] || hasDutyOverride) {
          return;
        }

        savedDateSet.add(dIso);
        sourceRows.push({ ...r, _isSaved: true });
      }
    });
  }
  if (approvedClaims && approvedClaims.length > 0) {
    approvedClaims.forEach(claim => {
      const dIso = claim.duty_date;
      if (!savedDateSet.has(dIso)) {
        sourceRows.push({ ...claim, _isSaved: false });
      }
    });
  }

  sourceRows.sort((a, b) => {
    const dateA = resolveDutyDateIso(a) || a.duty_date || '';
    const dateB = resolveDutyDateIso(b) || b.duty_date || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return (a.row_order || 0) - (b.row_order || 0);
  });

  let finalRows = [];
  const seenLeaveDates = new Set();

  for (let idx = 0; idx < sourceRows.length; idx++) {
    const item = sourceRows[idx];
    const dIso = resolveDutyDateIso(item) || item.duty_date;
    const leaveInfo = (dIso ? leaveInfoMap[dIso] : null) || (item.remarks && (item.remarks.startsWith('Disallowed: On Leave/Absent') || item.remarks.includes('(LAP)') || item.remarks.includes('(CL)') || item.remarks.includes('(SICK)')) ? {
      code: item.remarks.match(/\(([A-Z]+)\)/) ? item.remarks.match(/\(([A-Z]+)\)/)[1] : 'LEAVE',
      natureOfLeave: formatNatureOfLeave(item.remarks.match(/\(([A-Z]+)\)/) ? item.remarks.match(/\(([A-Z]+)\)/)[1] : 'LEAVE', item.remarks)
    } : null);

    if (leaveInfo) {
      if (seenLeaveDates.has(dIso)) {
        continue; // Suppress duplicate rows on same leave date
      }
      seenLeaveDates.add(dIso);

      finalRows.push({
        id: item.id || null,
        row_order: finalRows.length + 1,
        link_number: item.link_number || 1,
        date_str: item.date_str || (dIso ? `${parseInt(dIso.split('-')[2], 10)}/${parseInt(dIso.split('-')[1], 10)}/${dIso.split('-')[0].slice(-2)}` : ''),
        date_iso: dIso,
        duty_date: dIso,
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
        object_of_journey: item.object_of_journey || (category.id === 1 ? 'MANNING AC COACHES' : 'MANNING SLEEPER COACHES'),
        remarks: leaveInfo.natureOfLeave
      });
    } else {
      const b1Val = item.ta_b1 || (item.ta_percentage !== null && item.ta_percentage !== undefined ? String(item.ta_percentage) : (item.days_claiming_ta !== null && item.days_claiming_ta !== undefined ? String(item.days_claiming_ta) : ''));
      const daysClaim = item.days_claiming_ta !== undefined ? item.days_claiming_ta : (item.ta_percentage !== undefined ? item.ta_percentage : null);

      finalRows.push({
        id: item.id || null,
        row_order: finalRows.length + 1,
        link_number: item.link_number || null,
        date_str: item.date_str || (dIso ? `${parseInt(dIso.split('-')[2], 10)}/${parseInt(dIso.split('-')[1], 10)}/${dIso.split('-')[0].slice(-2)}` : ''),
        date_iso: dIso,
        duty_date: dIso,
        is_same_date_as_prev: finalRows.length > 0 && dIso === finalRows[finalRows.length - 1].date_iso,
        train_no: item.train_no || '---',
        from_station: item.from_station || '---',
        to_station: item.to_station || '---',
        dep_time: item.dep_time || '---',
        arr_time: item.arr_time || '---',
        ta_a1: item.ta_a1 || '',
        ta_a: item.ta_a || '',
        ta_b1: b1Val,
        ta_ord: item.ta_ord || '',
        days_claiming_ta: daysClaim,
        absence_hours: item.absence_hours || 0,
        claim_amount: item.claim_amount || 0,
        object_of_journey: item.object_of_journey || (category.id === 1 ? 'MANNING AC COACHES' : 'MANNING SLEEPER COACHES'),
        remarks: item.remarks || ''
      });
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
        const hasMatchingDep = finalRows.some(x => {
          const xIso = x.duty_date || x.date_iso || resolveDutyDateIso(x);
          if (xIso !== prevIso || x.is_leave || !x.dep_time || x.dep_time === '---') return false;
          return x.train_no === r.train_no || (r.to_station && (x.to_station === r.to_station || x.to_station === '---'));
        });
        if (!hasMatchingDep) {
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
          const hasMatchingArr = finalRows.some(x => {
            const xIso = x.duty_date || x.date_iso || resolveDutyDateIso(x);
            if (xIso !== nextIso || x.is_leave || !x.arr_time || x.arr_time === '---') return false;
            return x.train_no === r.train_no || (r.from_station && (x.from_station === r.from_station || x.from_station === '---'));
          });
          if (!hasMatchingArr) {
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
  getDutyRowsForLinkNumber,
  resolveDutyCodeToRows,
  getLinkSetDetails
};

