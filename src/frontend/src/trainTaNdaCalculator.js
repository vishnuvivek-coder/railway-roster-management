/**
 * Railway Duty Roster Manager - Train Movement TA & NDA Calculator Utility
 * 
 * Provides official Railway baseline rates, timings, and cumulative link formulas:
 * - TA Calculator: 100% (1.0), 70% (0.7 >6h Outstation), 30% (0.3 <=6h Short Run), 0% (Connecting / Local)
 * - Extra Next Day TA (+0.3): For trains delayed past 00:00 midnight into next day account
 * - Morning Boundary Auto-Change (0.3 -> 0.7): For trains delayed past 06:00 morning (>6h absence)
 * - NDA Calculator: Night Window 22:00 to 06:00 IST (1 hr = 1 NDA point)
 * - Cumulative Total for Entire Train Link: Aggregates all legs/movements for each Seniority Link
 */

export const DEFAULT_DA_RATE = 800; // Level 6-8 default (CTI / TTI)
export const DEFAULT_NDA_HOURLY_RATE = 168; // Standard Railway NDA hourly rate

/**
 * Standard Railway Schedules with sensitive midnight (00:00) and morning (06:00) boundaries
 */
export const STANDARD_TRAIN_SCHEDULES = {
  '12603': {
    trainNo: '12603',
    name: 'Chennai – Hyderabad Express',
    route: 'MAS ➔ GNT',
    schedArr: '23:50',
    isReturnToHq: true,
    boundary: 'midnight',
    boundaryThreshold: '00:00',
    defaultTa: 1.0,
    boundaryDesc: 'Arrival near 00:00 Midnight. If delayed on/after 00:10, spills into next calendar day granting +0.3 Extra TA on next day account.',
    nextDayTaOnDelay: 0.3
  },
  '20630': {
    trainNo: '20630',
    name: 'Vande Bharat / Tirupati Express',
    route: 'TPTY ➔ GNT',
    schedArr: '05:50',
    isReturnToHq: true,
    boundary: 'morning',
    boundaryThreshold: '06:00',
    defaultTa: 0.3,
    delayedTa: 0.7,
    boundaryDesc: 'Arrival near 06:00 Morning. Sched arrival ≤6h gives 0.3 TA. If delayed on/after 06:10, absence exceeds 6 hrs, auto-upgrading to 0.7 TA.',
    nextDayTaOnDelay: 0
  },
  '17252': {
    trainNo: '17252',
    name: 'Guntur – Dhone Express (Return)',
    route: 'DHNE ➔ GNT',
    schedArr: '23:10',
    isReturnToHq: true,
    boundary: 'midnight',
    boundaryThreshold: '00:00',
    defaultTa: 0.7,
    boundaryDesc: 'Arrival near 23:10. If delayed past 00:00, spills into next calendar day granting +0.3 Extra TA.',
    nextDayTaOnDelay: 0.3
  },
  '17070': {
    trainNo: '17070',
    name: 'Bhadrachalam – Guntur Express',
    route: 'BDCR ➔ GNT',
    schedArr: '05:15',
    isReturnToHq: true,
    boundary: 'morning',
    boundaryThreshold: '06:00',
    defaultTa: 0.3,
    delayedTa: 0.7,
    boundaryDesc: 'Arrival near 05:15. If delayed past 06:00, absence exceeds 6 hrs, upgrading TA to 0.7.',
    nextDayTaOnDelay: 0
  },
  '12733': {
    trainNo: '12733',
    name: 'Narayanadri Express',
    route: 'TPTY ➔ GNT',
    schedArr: '05:35',
    isReturnToHq: true,
    boundary: 'morning',
    boundaryThreshold: '06:00',
    defaultTa: 0.3,
    delayedTa: 0.7,
    boundaryDesc: 'Early morning arrival. If delayed past 06:00, absence exceeds 6 hrs, upgrading TA to 0.7.',
    nextDayTaOnDelay: 0
  },
  '17216': {
    trainNo: '17216',
    name: 'Dharmavaram – Guntur Express',
    route: 'DMM ➔ GNT',
    schedArr: '06:15',
    isReturnToHq: true,
    boundary: 'morning',
    boundaryThreshold: '06:00',
    defaultTa: 0.7,
    boundaryDesc: 'Morning arrival at 06:15. Absence from midnight exceeds 6 hours, granting 0.7 TA.',
    nextDayTaOnDelay: 0
  },
  '17262': {
    trainNo: '17262',
    name: 'Tirupati – Guntur Express',
    route: 'TPTY ➔ GNT',
    schedArr: '06:55',
    isReturnToHq: true,
    boundary: 'morning',
    boundaryThreshold: '06:00',
    defaultTa: 0.7,
    boundaryDesc: 'Morning arrival at 06:55. Absence exceeds 6 hours, granting 0.7 TA.',
    nextDayTaOnDelay: 0
  },
  '57210': {
    trainNo: '57210',
    name: 'BZA – GNT Passenger',
    route: 'BZA ➔ GNT',
    schedArr: '07:35',
    isReturnToHq: true,
    boundary: 'morning',
    boundaryThreshold: '06:00',
    defaultTa: 0.7,
    boundaryDesc: 'Morning arrival at 07:35. Absence exceeds 6 hours, granting 0.7 TA.',
    nextDayTaOnDelay: 0
  },
  '57201': {
    trainNo: '57201',
    name: 'BZA – GNT Passenger',
    route: 'BZA ➔ GNT',
    schedArr: '07:35',
    isReturnToHq: true,
    boundary: 'morning',
    boundaryThreshold: '06:00',
    defaultTa: 0.7,
    boundaryDesc: 'Morning arrival at 07:35. Absence exceeds 6 hours, granting 0.7 TA.',
    nextDayTaOnDelay: 0
  },
  '17244': {
    trainNo: '17244',
    name: 'Rayagada – Guntur Express',
    route: 'VSKP ➔ GNT',
    schedArr: '07:45',
    isReturnToHq: true,
    boundary: 'morning',
    boundaryThreshold: '06:00',
    defaultTa: 0.7,
    boundaryDesc: 'Morning arrival at 07:45. Absence exceeds 6 hours, granting 0.7 TA.',
    nextDayTaOnDelay: 0
  },
  '17282': {
    trainNo: '17282',
    name: 'Narsapur – Guntur Express',
    route: 'NS ➔ GNT',
    schedArr: '11:50',
    isReturnToHq: true,
    boundary: 'morning',
    boundaryThreshold: '06:00',
    defaultTa: 0.7,
    boundaryDesc: 'Day arrival before noon. Absence 6h to 12h, granting 0.7 TA.',
    nextDayTaOnDelay: 0
  },
  '17227': {
    trainNo: '17227',
    name: 'Dhone – Guntur Express',
    route: 'DHNE ➔ GNT',
    schedArr: '14:00',
    isReturnToHq: true,
    boundary: 'daytime',
    boundaryThreshold: '12:00',
    defaultTa: 0.7,
    boundaryDesc: 'Afternoon arrival. Outstation return run.',
    nextDayTaOnDelay: 0
  },
  '17254': {
    trainNo: '17254',
    name: 'Dhone – Guntur Express (Night)',
    route: 'DHNE ➔ GNT',
    schedArr: '20:00',
    isReturnToHq: true,
    boundary: 'daytime',
    boundaryThreshold: '12:00',
    defaultTa: 1.0,
    boundaryDesc: 'Night return arrival. Outstation stay >12h grants 100% TA (1.0).',
    nextDayTaOnDelay: 0
  },
  '12748': {
    trainNo: '12748',
    name: 'Palnadu Express (Return)',
    route: 'VKB ➔ GNT',
    schedArr: '21:10',
    isReturnToHq: true,
    boundary: 'daytime',
    boundaryThreshold: '12:00',
    defaultTa: 0.7,
    boundaryDesc: 'Evening return arrival at HQ.',
    nextDayTaOnDelay: 0
  },
  '17202': {
    trainNo: '17202',
    name: 'Golconda Express (Return)',
    route: 'KZJ ➔ GNT',
    schedArr: '21:30',
    isReturnToHq: true,
    boundary: 'daytime',
    boundaryThreshold: '12:00',
    defaultTa: 0.7,
    boundaryDesc: 'Night return arrival at HQ.',
    nextDayTaOnDelay: 0
  },
  '17645': {
    trainNo: '17645',
    name: 'Secunderabad – Guntur Express',
    route: 'SC ➔ GNT',
    schedArr: '22:30',
    isReturnToHq: true,
    boundary: 'daytime',
    boundaryThreshold: '12:00',
    defaultTa: 0.7,
    boundaryDesc: 'Late night return arrival at HQ.',
    nextDayTaOnDelay: 0
  }
};

/**
 * Detects whether a train movement represents staff reaching Headquarters (HQ - GNT) on a return run
 */
export function isReturnTrainReachingHq(trainNumber, toStation = '', fromStation = '') {
  const tNum = String(trainNumber || '').trim();
  const to = String(toStation || '').toUpperCase().trim();
  
  if (to.includes('GNT') || to === 'HEADQUARTERS' || to.endsWith('/GNT') || to.endsWith(', GNT')) {
    return true;
  }
  
  const std = STANDARD_TRAIN_SCHEDULES[tNum];
  if (std && std.isReturnToHq) {
    return true;
  }
  
  const gntReturnTrains = [
    '12603', '17252', '20630', '12733', '17070', '17216', '17262', '57210', '57201',
    '17244', '17282', '17227', '17254', '12748', '17202', '17645', '07610', '17426',
    '17042', '18064', '12703', '22881'
  ];
  return gntReturnTrains.includes(tNum);
}

/**
 * Official Railway TA Rules for Reaching Headquarters (HQ - GNT) by Return Train:
 * 
 * TA Claim is governed by total absence on the return calendar day from midnight (00:00) to HQ arrival:
 * 1. Early Morning Arrival (00:00 to 06:00, absence <= 6 hrs):
 *    -> Awards 0.3 TA (30%).
 * 2. Late Morning Arrival (06:01 to 12:00, absence > 6 hrs and <= 12 hrs):
 *    -> Awards 0.7 TA (70%).
 * 3. Afternoon / Evening Arrival (After 12:00, absence > 12 hrs):
 *    -> Awards 1.0 TA (100%).
 * 4. Midnight Boundary Trains (e.g. 12603 sched 23:50, 17252 sched 23:10):
 *    -> If arrives on-time before 00:00: Main tour TA on departure day, Next Day TA = 0.
 *    -> If delayed past 00:00 (e.g. 00:10): Duty spills into next calendar day <= 6 hrs -> +0.3 Extra Next Day TA!
 *    -> If delayed past 06:00 (e.g. 06:10): Duty spills into next calendar day > 6 hrs -> +0.7 Extra Next Day TA!
 */
export function calculateReturnTrainHqTa(trainNumber, actualOrSchedArrTime, schedArrTime = null) {
  const tNum = String(trainNumber || '').trim();
  const std = STANDARD_TRAIN_SCHEDULES[tNum] || null;
  const sched = schedArrTime || std?.schedArr || null;
  const arrStr = String(actualOrSchedArrTime || sched || '').trim();

  if (!arrStr || !arrStr.includes(':')) {
    return {
      isReturnToHq: true,
      arrTime: null,
      taPct: std?.defaultTa !== undefined ? std.defaultTa : 0.7,
      extraNextDayTa: 0,
      badgeText: null,
      ruleDesc: 'Standard Return Run'
    };
  }

  const [aH, aM] = arrStr.split(':').map(v => parseInt(v, 10) || 0);
  const arrMinsFromMidnight = aH * 60 + aM;

  // 1. Midnight Boundary Return Trains (scheduled near midnight, e.g. 12603 at 23:50 or 17252 at 23:10)
  if (std?.boundary === 'midnight' || (sched && sched >= '22:00' && sched <= '23:59')) {
    if (aH >= 0 && aH < 6) {
      return {
        isReturnToHq: true,
        arrTime: arrStr,
        taPct: std?.defaultTa !== undefined ? std.defaultTa : 1.0,
        extraNextDayTa: 0.3,
        isDelayed: true,
        badgeText: `🏠 Reached HQ at ${arrStr} (Past Midnight 00:00) ➔ +0.3 Extra Next Day TA`,
        ruleDesc: `Return Train ${tNum} arrived at HQ after 00:00 at ${arrStr}. Next day absence ≤6h qualifies for +0.3 TA on Next Day Account.`
      };
    } else if (aH >= 6 && aH < 12) {
      return {
        isReturnToHq: true,
        arrTime: arrStr,
        taPct: std?.defaultTa !== undefined ? std.defaultTa : 1.0,
        extraNextDayTa: 0.7,
        isDelayed: true,
        badgeText: `🏠 Reached HQ at ${arrStr} (Past 06:00) ➔ +0.7 Extra Next Day TA`,
        ruleDesc: `Return Train ${tNum} arrived at HQ heavily delayed at ${arrStr}. Next day absence >6h qualifies for +0.7 TA on Next Day Account.`
      };
    } else {
      return {
        isReturnToHq: true,
        arrTime: arrStr,
        taPct: std?.defaultTa !== undefined ? std.defaultTa : 1.0,
        extraNextDayTa: 0,
        isDelayed: false,
        badgeText: `🏠 Reached HQ on-time at ${arrStr} (No Next Day Claim)`,
        ruleDesc: `Return Train ${tNum} reached HQ before midnight at ${arrStr}. Duty completed on same calendar day.`
      };
    }
  }

  // 2. Overnight Return Trains arriving early morning / morning (e.g. 20630, 12733, 17070, 17216, 17262, 57210)
  if (std?.boundary === 'morning' || (sched && sched >= '04:00' && sched <= '11:59') || (aH >= 0 && aH < 12)) {
    if (arrMinsFromMidnight <= 360) { // 360 mins = 06:00
      return {
        isReturnToHq: true,
        arrTime: arrStr,
        taPct: 0.3,
        extraNextDayTa: 0,
        isDelayed: false,
        badgeText: `🏠 Reached HQ at ${arrStr} (≤06:00) ➔ 0.3 TA (≤6h Return Absence)`,
        ruleDesc: `Return Train ${tNum} reached HQ at ${arrStr}. Total absence from midnight is ≤ 6 hours, granting 0.3 TA (30%).`
      };
    } else if (arrMinsFromMidnight > 360 && arrMinsFromMidnight <= 720) { // 06:01 to 12:00
      const isDelayTriggered = std?.boundaryThreshold === '06:00' && sched <= '06:00';
      return {
        isReturnToHq: true,
        arrTime: arrStr,
        taPct: 0.7,
        extraNextDayTa: 0,
        isDelayed: isDelayTriggered,
        badgeText: isDelayTriggered
          ? `⚡ Reached HQ at ${arrStr} (Delayed past 06:00) ➔ Auto-Changed to 0.7 TA (>6h Absence)`
          : `🏠 Reached HQ at ${arrStr} (06:00–12:00) ➔ 0.7 TA (6h–12h Absence)`,
        ruleDesc: `Return Train ${tNum} reached HQ at ${arrStr}. Absence from midnight exceeds 6 hours, qualifying for 0.7 TA (70%).`
      };
    } else {
      return {
        isReturnToHq: true,
        arrTime: arrStr,
        taPct: 1.0,
        extraNextDayTa: 0,
        isDelayed: true,
        badgeText: `🏠 Reached HQ at ${arrStr} (>12:00) ➔ 1.0 TA (>12h Absence)`,
        ruleDesc: `Return Train ${tNum} reached HQ after 12:00 at ${arrStr}. Absence exceeds 12 hours, granting 1.0 TA (100%).`
      };
    }
  }

  // 3. Daytime / Evening Return Trains (e.g. 17227, 17254, 12748, 17202, 17645)
  return {
    isReturnToHq: true,
    arrTime: arrStr,
    taPct: std?.defaultTa !== undefined ? std.defaultTa : (arrMinsFromMidnight > 720 ? 1.0 : 0.7),
    extraNextDayTa: 0,
    isDelayed: false,
    badgeText: `🏠 Reached HQ at ${arrStr} (Return Run)`,
    ruleDesc: `Return Train ${tNum} reached HQ at ${arrStr}.`
  };
}

export function evaluateNtesTaRule(trainNumber, actualArrTime, schedArrTime = null) {
  const tNum = String(trainNumber || '').trim();
  const std = STANDARD_TRAIN_SCHEDULES[tNum] || null;
  const sched = schedArrTime || std?.schedArr || null;

  if (!actualArrTime) {
    return {
      isDelayed: false,
      boundaryType: std?.boundary || null,
      schedArr: sched,
      actualArr: null,
      extraNextDayTa: 0,
      autoAdjustedTa: null,
      badgeText: null,
      explanation: null
    };
  }

  const actStr = String(actualArrTime).trim();
  const [aH, aM] = actStr.split(':').map(v => parseInt(v, 10) || 0);
  const actMinsFromMidnight = aH * 60 + aM;

  // 1. Midnight Boundary Check (e.g. 12603 sched 23:50 or 17252 sched 23:10)
  const isMidnightBoundaryTrain = std?.boundary === 'midnight' || (sched && sched >= '22:00' && sched <= '23:59');
  if (isMidnightBoundaryTrain) {
    // If actual arrival is between 00:00 and 06:00 (i.e. morning after midnight)
    if (aH >= 0 && aH < 6) {
      return {
        isDelayed: true,
        boundaryType: 'midnight',
        schedArr: sched || '23:50',
        actualArr: actStr,
        extraNextDayTa: 0.3,
        autoAdjustedTa: null,
        badgeText: `⚡ NTES: Arrived ${actStr} (>00:00) ➔ +0.3 Extra Next Day Account`,
        explanation: `Train ${tNum} scheduled at ${sched || '23:50'} arrived at ${actStr} past midnight (00:00). Next day calendar duty (00:00–${actStr} ≤ 6 hrs) qualifies for +0.3 Extra TA on next day account.`
      };
    } else {
      return {
        isDelayed: false,
        boundaryType: 'midnight',
        schedArr: sched || '23:50',
        actualArr: actStr,
        extraNextDayTa: 0,
        autoAdjustedTa: null,
        badgeText: `✓ NTES: Arrived earlier / on-time (${actStr}) ➔ TA Updated as Earlier (No Next Day Claim)`,
        explanation: `Train ${tNum} arrived before midnight at ${actStr}. No extra next-day TA applicable.`
      };
    }
  }

  // 2. Morning Boundary Check (e.g. 20630 sched 05:50, 17070 sched 05:15)
  const isMorningBoundaryTrain = std?.boundary === 'morning' || (sched && sched >= '04:00' && sched < '06:00');
  if (isMorningBoundaryTrain) {
    // If actual arrival is on or after 06:00 (e.g. 06:10) and before 12:00
    if (actMinsFromMidnight >= 360 && actMinsFromMidnight < 720) { // 360 mins = 06:00
      return {
        isDelayed: true,
        boundaryType: 'morning',
        schedArr: sched || '05:50',
        actualArr: actStr,
        extraNextDayTa: 0,
        autoAdjustedTa: 0.7,
        badgeText: `⚡ NTES: Arrived ${actStr} (≥06:00) ➔ TA Auto-Changed to 0.7 (>6h Absence)`,
        explanation: `Train ${tNum} scheduled at ${sched || '05:50'} arrived delayed at ${actStr}. Absence from midnight exceeds 6 hours, automatically elevating TA claim to 0.7 (>6h absence).`
      };
    } else {
      return {
        isDelayed: false,
        boundaryType: 'morning',
        schedArr: sched || '05:50',
        actualArr: actStr,
        extraNextDayTa: 0,
        autoAdjustedTa: 0.3,
        badgeText: `✓ NTES: Arrived earlier / on-time (${actStr}) ➔ TA Updated as Earlier (0.3)`,
        explanation: `Train ${tNum} arrived before 06:00 at ${actStr}. Absence ≤ 6 hours qualifies for baseline 0.3 TA.`
      };
    }
  }

  return {
    isDelayed: false,
    boundaryType: std?.boundary || null,
    schedArr: sched,
    actualArr: actStr,
    extraNextDayTa: 0,
    autoAdjustedTa: null,
    badgeText: `✓ NTES: On-Time (${actStr})`,
    explanation: `Train ${tNum} arrived on schedule at ${actStr}.`
  };
}

/**
 * Standard Railway Baseline TA % and NDA hours for every train in each category & seniority link
 */
export function getDefaultTaNdaForTrain(categoryId, linkNumber, trainNumber) {
  const cId = parseInt(categoryId, 10);
  const lNum = parseInt(linkNumber, 10);
  const tNum = String(trainNumber || '').trim();

  // Category 1: Conductors (COR) - 21-Day Seniority Cycle
  if (cId === 1) {
    if (lNum === 1) {
      if (tNum === '17281') return { ta_pct: 0, nda_hrs: 0, desc: 'Connecting to BZA (No TA)' };
      if (tNum === '17225') return { ta_pct: 0.7, nda_hrs: 7.0, desc: 'Outstation Night Run (70% TA)' };
    }
    if (lNum === 2) {
      if (tNum === '17225') return { ta_pct: 0, nda_hrs: 0, desc: 'Morning Arrival GTL' };
      if (tNum === '17226') return { ta_pct: 1.0, nda_hrs: 6.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if (lNum === 3) {
      if (tNum === '17226') return { ta_pct: 0, nda_hrs: 0, desc: 'Morning Arrival BZA' };
      if (tNum === '57210') return { ta_pct: 0.7, nda_hrs: 0, desc: 'Return Arrival to HQ (70% TA)' };
    }
    if (lNum === 4 && tNum === '17261') return { ta_pct: 0.7, nda_hrs: 6.0, desc: 'Night Run GNT-TPTY (70% TA)' };
    if (lNum === 5) {
      if (tNum === '17261') return { ta_pct: 0, nda_hrs: 0, desc: 'Morning Arrival TPTY' };
      if (tNum === '12733') return { ta_pct: 1.0, nda_hrs: 3.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if (lNum === 6 && tNum === '12733') return { ta_pct: 0.3, nda_hrs: 1.0, desc: 'Early Morning Return to HQ (30% TA)' };
    if (lNum === 8 && tNum === '20629') return { ta_pct: 0.3, nda_hrs: 4.0, desc: 'Evening Dep <=6h to Midnight (30% TA)' };
    if (lNum === 9) {
      if (tNum === '20629') return { ta_pct: 0, nda_hrs: 0, desc: 'Arrival TPTY' };
      if (tNum === '12733') return { ta_pct: 1.0, nda_hrs: 3.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if (lNum === 10) {
      if (tNum === '12733') return { ta_pct: 0.3, nda_hrs: 1.0, desc: 'Early Morning Return to HQ (30% TA)' };
      if (tNum === '12734') return { ta_pct: 0.3, nda_hrs: 7.0, desc: 'Night Dep <=6h to Midnight (30% TA)' };
    }
    if (lNum === 11) {
      if (tNum === '12734') return { ta_pct: 0, nda_hrs: 0, desc: 'Morning Arrival TPTY' };
      if (tNum === '20630') return { ta_pct: 1.0, nda_hrs: 7.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if (lNum === 12) {
      if (tNum === '20630') return { ta_pct: 0.3, nda_hrs: 0, desc: 'Morning Return to HQ (30% TA)' };
      if (tNum === '12604') return { ta_pct: 0.3, nda_hrs: 8.0, desc: 'Night Run GNT-MAS (30% TA)' };
    }
    if (lNum === 13) {
      if (tNum === '12604') return { ta_pct: 0, nda_hrs: 0, desc: 'Morning Arrival MAS' };
      if (tNum === '12603') return { ta_pct: 1.0, nda_hrs: 2.0, desc: 'Outstation Return to HQ (100% TA)' };
    }
    if (lNum === 15) {
      if (tNum === '67230') return { ta_pct: 0, nda_hrs: 0, desc: 'Connecting to BZA (No TA)' };
      if (tNum === '18047') return { ta_pct: 0.7, nda_hrs: 6.0, desc: 'Night Run BZA-GTL (70% TA)' };
    }
    if (lNum === 16) {
      if (tNum === '18047') return { ta_pct: 0, nda_hrs: 0, desc: 'Arrival GTL' };
      if (tNum === '17226') return { ta_pct: 1.0, nda_hrs: 6.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if (lNum === 17) {
      if (tNum === '17226') return { ta_pct: 0, nda_hrs: 0, desc: 'Morning Arrival BZA' };
      if (tNum === '57201') return { ta_pct: 0.7, nda_hrs: 0, desc: 'Return Arrival to HQ (70% TA)' };
    }
    if (lNum === 18 && tNum === '12734') return { ta_pct: 0.3, nda_hrs: 7.0, desc: 'Night Dep <=6h (30% TA)' };
    if (lNum === 19) {
      if (tNum === '12734') return { ta_pct: 0, nda_hrs: 0, desc: 'Arrival TPTY' };
      if (tNum === '17262') return { ta_pct: 1.0, nda_hrs: 8.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if (lNum === 20 && tNum === '17262') return { ta_pct: 0.7, nda_hrs: 1.0, desc: 'Return Arrival to HQ (70% TA)' };
  }

  // Category 2: TTI / Sleeper Staff - 63-Day Seniority Cycle
  if (cId === 2) {
    if ([1, 15, 29].includes(lNum) && tNum === '17253') return { ta_pct: 0.7, nda_hrs: 0, desc: 'Day Run GNT-DHNE (70% TA)' };
    if ([2, 16, 30].includes(lNum) && tNum === '17252') return { ta_pct: 0.7, nda_hrs: 1.0, desc: 'Return Run DHNE-GNT (70% TA)' };
    if ([3].includes(lNum) && tNum === '12604') return { ta_pct: 0.3, nda_hrs: 8.0, desc: 'Night Dep GNT-MAS (30% TA)' };
    if ([4, 46].includes(lNum)) {
      if (tNum === '12604') return { ta_pct: 0, nda_hrs: 0, desc: 'Morning Arrival MAS' };
      if (tNum === '12603') return { ta_pct: 1.0, nda_hrs: 2.0, desc: 'Outstation Return to HQ (100% TA)' };
    }
    if ([5, 47].includes(lNum) && tNum === '17251') return { ta_pct: 0.7, nda_hrs: 7.0, desc: 'Night Run GNT-DHNE (70% TA)' };
    if ([6].includes(lNum)) {
      if (tNum === '17251') return { ta_pct: 0, nda_hrs: 0, desc: 'Morning Arrival DHNE' };
      if (tNum === '17252') return { ta_pct: 1.0, nda_hrs: 1.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if ([8, 22].includes(lNum) && tNum === '17215') return { ta_pct: 0.3, nda_hrs: 7.0, desc: 'Night Dep GNT-DMM (30% TA)' };
    if ([9, 23].includes(lNum)) {
      if (tNum === '17215') return { ta_pct: 0, nda_hrs: 0, desc: 'Arrival DMM' };
      if (tNum === '17216') return { ta_pct: 1.0, nda_hrs: 6.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if ([10, 24].includes(lNum) && tNum === '17216') return { ta_pct: 0.3, nda_hrs: 0, desc: 'Morning Return to HQ (30% TA)' };
    if ([11, 25, 39, 53].includes(lNum)) {
      if (tNum === '12747') return { ta_pct: 0, nda_hrs: 0, desc: 'Day Run GNT-VKB (Outbound)' };
      if (tNum === '12748') return { ta_pct: 0.7, nda_hrs: 0, desc: 'Day Return VKB-GNT (70% TA)' };
    }
    if ([12, 26].includes(lNum)) {
      if (tNum === '17201') return { ta_pct: 0, nda_hrs: 0, desc: 'Day Run GNT-KZJ (Outbound)' };
      if (tNum === '17202') return { ta_pct: 0.7, nda_hrs: 0, desc: 'Day Return KZJ-GNT (70% TA)' };
    }
    if ([13, 27].includes(lNum) && tNum === '17255') return { ta_pct: 0.7, nda_hrs: 6.0, desc: 'Night Run GNT-KCG (70% TA)' };
    if ([17, 31].includes(lNum) && tNum === '17228') return { ta_pct: 0.7, nda_hrs: 0, desc: 'Day Run GNT-DHNE (70% TA)' };
    if ([18, 32].includes(lNum) && tNum === '17227') return { ta_pct: 0.7, nda_hrs: 0, desc: 'Day Return DHNE-GNT (70% TA)' };
    if ([19, 33].includes(lNum) && tNum === '12734') return { ta_pct: 0.3, nda_hrs: 7.0, desc: 'Night Dep GNT-TPTY (30% TA)' };
    if ([20, 34].includes(lNum)) {
      if (tNum === '12734') return { ta_pct: 0, nda_hrs: 0, desc: 'Morning Arrival TPTY' };
      if (tNum === '17262') return { ta_pct: 1.0, nda_hrs: 8.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if ([36, 50].includes(lNum)) {
      if (tNum === '17645') return { ta_pct: 0, nda_hrs: 0, desc: 'Short Run GNT-RAL' };
      if (tNum === '17626') return { ta_pct: 0.3, nda_hrs: 7.0, desc: 'Night Run RAL-KCG (30% TA)' };
    }
    if ([37, 51].includes(lNum)) {
      if (tNum === '17626') return { ta_pct: 0, nda_hrs: 0, desc: 'Morning Arrival KCG' };
      if (tNum === '17625') return { ta_pct: 1.0, nda_hrs: 6.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if ([38, 52].includes(lNum)) {
      if (tNum === '17625') return { ta_pct: 0, nda_hrs: 0, desc: 'Arrival RAL' };
      if (tNum === '17646') return { ta_pct: 1.0, nda_hrs: 0, desc: 'Morning Return RAL-GNT (100% TA)' };
    }
    if ([40, 54].includes(lNum) && tNum === '17243') return { ta_pct: 0.3, nda_hrs: 7.0, desc: 'Night Run GNT-VSKP (30% TA)' };
    if ([41, 55].includes(lNum)) {
      if (tNum === '17243') return { ta_pct: 0, nda_hrs: 0, desc: 'Arrival VSKP' };
      if (tNum === '17244') return { ta_pct: 1.0, nda_hrs: 7.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if ([43].includes(lNum) && tNum === '20629') return { ta_pct: 0.3, nda_hrs: 4.0, desc: 'Night Dep GNT-TPTY (30% TA)' };
    if ([44].includes(lNum)) {
      if (tNum === '20629') return { ta_pct: 0, nda_hrs: 0, desc: 'Arrival TPTY' };
      if (tNum === '12733') return { ta_pct: 1.0, nda_hrs: 3.0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if ([45].includes(lNum)) {
      if (tNum === '12733') return { ta_pct: 0.3, nda_hrs: 1.0, desc: 'Early Morning Return to HQ (30% TA)' };
      if (tNum === '17281') return { ta_pct: 0.3, nda_hrs: 6.0, desc: 'Night Run GNT-NS (30% TA)' };
    }
    if ([48].includes(lNum) && tNum === '17646') return { ta_pct: 1.0, nda_hrs: 0, desc: 'Morning Return to GNT (100% TA)' };
    if ([57].includes(lNum)) {
      if (tNum === '67230') return { ta_pct: 0, nda_hrs: 0, desc: 'Connecting to BZA (No TA)' };
      if (tNum === '18047') return { ta_pct: 0.7, nda_hrs: 6.0, desc: 'Night Run BZA-GTL (70% TA)' };
    }
    if ([58].includes(lNum)) {
      if (tNum === '18047') return { ta_pct: 0, nda_hrs: 0, desc: 'Arrival GTL' };
      if (tNum === '18048') return { ta_pct: 1.0, nda_hrs: 0, desc: 'Outstation Stay >12h (100% TA)' };
    }
    if ([59].includes(lNum)) {
      if (tNum === '18048') return { ta_pct: 0, nda_hrs: 0, desc: 'Arrival BZA' };
      if (tNum === '12703') return { ta_pct: 1.0, nda_hrs: 0, desc: 'Connecting Return to GNT (100% TA)' };
    }
  }

  // Category 3: Ladies Staff / TTE
  if (cId === 3) {
    if ([1, 4].includes(lNum) && tNum === '17261') return { ta_pct: 0.7, nda_hrs: 6.0, desc: 'Night Run GNT-TPTY (70% TA)' };
    if ([2, 5].includes(lNum) && tNum === '17262') return { ta_pct: 1.0, nda_hrs: 8.0, desc: 'Outstation Stay >12h (100% TA)' };
    if ([3, 6].includes(lNum) && tNum === '17262') return { ta_pct: 0.7, nda_hrs: 1.0, desc: 'Morning Return to GNT (70% TA)' };
  }

  // Category 4: Leave Reserve (LR) Staff
  if (cId === 4) {
    if (tNum === '17281') return { ta_pct: 0, nda_hrs: 0, desc: 'Connecting to BZA' };
    if (tNum === '17225') return { ta_pct: 0.7, nda_hrs: 7.0, desc: 'Outstation Night Run (70% TA)' };
  }

  // Standard Railway Train Schedule lookup (including return trains reaching HQ)
  if (STANDARD_TRAIN_SCHEDULES[tNum]) {
    const std = STANDARD_TRAIN_SCHEDULES[tNum];
    return {
      ta_pct: std.defaultTa !== undefined ? std.defaultTa : 0.7,
      nda_hrs: std.defaultNda || 0,
      desc: std.boundaryDesc || (std.isReturnToHq ? `Return Arrival at HQ (${std.schedArr})` : 'Standard Duty Leg (70% TA)')
    };
  }

  // Generic fallback default
  return { ta_pct: 0.7, nda_hrs: 0, desc: 'Standard Duty Leg (70% TA)' };
}

/**
 * Finds all link numbers where a train number appears in a category
 */
export function findRepeatedTrainLinks(trainNumber, categoryId, linksList = []) {
  const tNum = String(trainNumber || '').trim();
  const cId = parseInt(categoryId, 10);
  if (!tNum || !Array.isArray(linksList)) return [];

  const matchedLinks = [];
  linksList.forEach(link => {
    if (link.is_rest || !link.train_numbers) return;
    if (cId && parseInt(link.category_id, 10) !== cId) return;
    const nums = String(link.train_numbers).split(/[\s,+/]+/).map(s => s.trim()).filter(Boolean);
    if (nums.includes(tNum)) {
      matchedLinks.push(parseInt(link.link_number, 10));
    }
  });

  return Array.from(new Set(matchedLinks)).sort((a, b) => a - b);
}

/**
 * Resolves the effective TA and NDA rule for a train movement:
 * When a repeated train appears (e.g. same train in later links 15, 29, etc.),
 * if it doesn't have an explicit custom override, it automatically inherits/updates
 * the TA and NDA from the EARLIER occurrence of that train ("Update TA as earlier").
 */
export function resolveEffectiveTrainRule(categoryId, linkNumber, trainNumber, trainTaNdaRules = {}) {
  const cId = parseInt(categoryId, 10);
  const lNum = parseInt(linkNumber, 10);
  const tNum = String(trainNumber || '').trim();
  const exactKey = `${cId}_${lNum}_${tNum}`;
  const exactRule = trainTaNdaRules[exactKey];

  // 1. Direct explicit rule saved for this exact link & train
  if (exactRule && (exactRule.ta_percentage !== undefined || exactRule.nda_hours !== undefined)) {
    const taPct = exactRule.ta_percentage !== undefined ? parseFloat(exactRule.ta_percentage) : 0.7;
    const ndaHrs = exactRule.nda_hours !== undefined ? parseFloat(exactRule.nda_hours) : 0;
    const extraDay = exactRule.extra_next_day_ta !== undefined ? parseFloat(exactRule.extra_next_day_ta) : 0;
    return {
      ...exactRule,
      isCustom: true,
      isInherited: false,
      sourceLink: lNum,
      effectiveTa: taPct,
      effectiveNda: ndaHrs,
      extraNextDay: extraDay
    };
  }

  // 2. Baseline default
  const defaultData = getDefaultTaNdaForTrain(cId, lNum, tNum);
  return {
    category_id: cId,
    link_number: lNum,
    train_number: tNum,
    ta_percentage: defaultData.ta_pct,
    nda_hours: defaultData.nda_hrs,
    extra_next_day_ta: 0,
    remarks: defaultData.desc,
    isCustom: false,
    isInherited: false,
    sourceLink: null,
    effectiveTa: defaultData.ta_pct,
    effectiveNda: defaultData.nda_hrs,
    extraNextDay: 0
  };
}

/**
 * Calculates cumulative TA and NDA totals for every Seniority Link (Pure TA units and NDA hours, no money/currency)
 * Includes extra next day TA (+0.3) for trains delayed past midnight (e.g. 12603)
 * Automatically incorporates earlier TA for repeated trains!
 */
export function calculateLinkCumulativeTotals(trainRosterItems, trainTaNdaRules = {}) {
  const linkTotals = {};
  let grandTotalTaUnits = 0;
  let grandTotalNda = 0;
  let grandTotalExtraNextDayTa = 0;

  trainRosterItems.forEach(item => {
    const linkKey = `${item.categoryId}_${item.linkNumber}`;
    if (!linkTotals[linkKey]) {
      linkTotals[linkKey] = {
        categoryId: item.categoryId,
        linkNumber: item.linkNumber,
        categoryName: item.categoryName,
        totalTaUnits: 0,
        totalExtraNextDayTa: 0,
        totalNdaHours: 0,
        trainCount: 0,
        trains: []
      };
    }

    const resolved = resolveEffectiveTrainRule(item.categoryId, item.linkNumber, item.trainNumber, trainTaNdaRules);
    const effTaPct = resolved.effectiveTa;
    const effNdaHrs = resolved.effectiveNda;
    const extraNextDay = resolved.extraNextDay;

    const rowTotalTa = effTaPct + extraNextDay;

    linkTotals[linkKey].totalTaUnits = Math.round((linkTotals[linkKey].totalTaUnits + rowTotalTa) * 100) / 100;
    linkTotals[linkKey].totalExtraNextDayTa = Math.round(((linkTotals[linkKey].totalExtraNextDayTa || 0) + extraNextDay) * 100) / 100;
    linkTotals[linkKey].totalNdaHours = Math.round((linkTotals[linkKey].totalNdaHours + effNdaHrs) * 10) / 10;
    linkTotals[linkKey].trainCount += 1;
    linkTotals[linkKey].trains.push(item.trainNumber);

    grandTotalTaUnits += rowTotalTa;
    grandTotalExtraNextDayTa += extraNextDay;
    grandTotalNda += effNdaHrs;
  });

  return {
    linkTotals,
    grandTotalTaUnits: Math.round(grandTotalTaUnits * 100) / 100,
    grandTotalExtraNextDayTa: Math.round(grandTotalExtraNextDayTa * 100) / 100,
    grandTotalNda: Math.round(grandTotalNda * 10) / 10
  };
}

/**
 * Export TA & NDA Master Rates to CSV file (TA Units & NDA Hours)
 */
export function exportTaNdaMasterCsv(trainRosterItems, trainTaNdaRules = {}) {
  const { linkTotals } = calculateLinkCumulativeTotals(trainRosterItems, trainTaNdaRules);

  const headers = [
    'Train Number',
    'Category',
    'Seniority Link',
    'Route',
    'Coaches',
    'Sched Arr',
    'Actual Arr (NTES)',
    'Base TA Claim (1 / 0.7 / 0.3 / 0)',
    'Extra Next Day TA (+0.3)',
    'Total Train TA',
    'Cumulative Link TA Total',
    'NDA Hours (22:00-06:00)',
    'Cumulative Link NDA Hours',
    'NTES Status / Rule Remarks'
  ];

  const rows = trainRosterItems.map(item => {
    const linkKey = `${item.categoryId}_${item.linkNumber}`;
    const linkTotal = linkTotals[linkKey] || {};
    const resolved = resolveEffectiveTrainRule(item.categoryId, item.linkNumber, item.trainNumber, trainTaNdaRules);

    const effTaPct = resolved.effectiveTa;
    const effNdaHrs = resolved.effectiveNda;
    const extraNextDay = resolved.extraNextDay;
    const rowTotalTa = Math.round((effTaPct + extraNextDay) * 100) / 100;

    const sched = resolved.sched_arr_time || STANDARD_TRAIN_SCHEDULES[item.trainNumber]?.schedArr || '-';
    const actual = resolved.actual_arr_time || '-';
    const remarks = resolved.ntes_status || resolved.remarks || (resolved.isInherited ? `Repeated train (Inherited from Link #${resolved.sourceLink})` : '');

    return [
      item.trainNumber,
      `"${item.categoryName}"`,
      `"Link #${item.linkNumber}"`,
      `"${item.from_station || ''} to ${item.to_station || ''}"`,
      `"${item.coaches || ''}"`,
      `"${sched}"`,
      `"${actual}"`,
      effTaPct,
      extraNextDay,
      rowTotalTa,
      linkTotal.totalTaUnits || 0,
      effNdaHrs,
      linkTotal.totalNdaHours || 0,
      `"${remarks}"`
    ];
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Daily_Trains_TA_NDA_Master_Chart_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
