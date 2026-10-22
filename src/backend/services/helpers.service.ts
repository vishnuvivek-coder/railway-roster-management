import { get, all, run } from '../db';
import { getDayOffset, getBaseLinkNumber } from '../rotation';
import { getDutyRowsForLinkNumber } from '../ta_generator';

export function formatDateDisplay(iso: any): string {
  if (!iso) return '';
  if (iso instanceof Date) {
    const y = iso.getFullYear();
    const m = String(iso.getMonth() + 1).padStart(2, '0');
    const d = String(iso.getDate()).padStart(2, '0');
    return `${d}/${m}/${y}`;
  }
  const isoStr = String(iso);
  const parts = isoStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return isoStr;
}

export function normalizeEffectiveDate(dateStr: any): string {
  if (!dateStr) return '2026-10-01';
  dateStr = String(dateStr).trim();
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2].length === 2 ? '20' + parts[2] : parts[2];
      return `${y}-${m}-${d}`;
    }
  }
  return dateStr;
}

// Helper to determine if date is an 18047 run day (Sunday, Tuesday, Wednesday, Friday)
// On remaining days (Monday, Thursday, Saturday), 17225 runs instead.
export function is18047Day(dStr: string | null | undefined): boolean {
  if (!dStr) return true;
  const d = new Date(dStr + (dStr.includes('T') ? '' : 'T00:00:00'));
  const day = d.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  return day === 0 || day === 2 || day === 3 || day === 5;
}

// Helper to determine if date is an 18048 run day from GTL (Sunday, Tuesday, Thursday, Friday)
// On remaining days (Monday, Wednesday, Saturday), 17226 runs instead.
export function is18048Day(dStr: string | null | undefined): boolean {
  if (!dStr) return true;
  const d = new Date(dStr + (dStr.includes('T') ? '' : 'T00:00:00'));
  const day = d.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  return day === 0 || day === 2 || day === 4 || day === 5;
}

// Helper: Get active link definition for a link number on a given date (strictly published only)
export async function getActiveLinkDef(categoryId: any, linkNumber: any, dateStr: string | null = null) {
  const catId = parseInt(categoryId, 10);
  let link: any = null;
  if (catId && catId !== 4) {
    link = await get(
      `SELECT * FROM links 
       WHERE category_id = ? AND link_number = ? 
         AND (status = 'published' OR status IS NULL OR status = '')
         AND (status != 'draft')
         AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = 'published' OR status IS NULL))
         AND date(effective_from) <= date(?) 
         AND date(effective_to) >= date(?)
       ORDER BY date(effective_from) DESC LIMIT 1`,
      [catId, linkNumber, dateStr, dateStr]
    );
  }
  if (!link) {
    link = await get(
      `SELECT * FROM links 
       WHERE link_number = ? 
         AND category_id != 4
         AND (status = 'published' OR status IS NULL OR status = '')
         AND (status != 'draft')
         AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = 'published' OR status IS NULL))
         AND date(effective_from) <= date(?) 
         AND date(effective_to) >= date(?)
       ORDER BY date(effective_from) DESC, category_id ASC LIMIT 1`,
      [linkNumber, dateStr, dateStr]
    );
  }
  if (link && dateStr) {
    // Clone link object so we don't mutate DB cache
    link = { ...link };
    const num = parseInt(link.link_number, 10);
    const cat = parseInt(link.category_id, 10);
    if ((cat === 1 && num === 15) || (cat === 2 && num === 50)) {
      const is18047 = is18047Day(dateStr);
      if (cat === 1) {
        link.train_numbers = is18047 ? '67230, 18047' : '67230, 17225';
      } else {
        link.train_numbers = is18047 ? 'PILOT(67230), 18047' : 'PILOT(67230), 17225';
      }
    } else if (cat === 1 && num === 16) {
      const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
      const dow = d.getDay();
      const inTrain = (dow === 0 || dow === 2 || dow === 5) ? '17225' : '18047';
      const retTrain = is18048Day(dateStr) ? '18048' : '17226';
      link.train_numbers = `${inTrain}, ${retTrain}`;
    } else if (cat === 1 && num === 17) {
      const retTrain = is18048Day(dateStr) ? '18048' : '17226';
      link.train_numbers = `${retTrain}, 57201`;
    } else if (cat === 2 && num === 51) {
      const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
      const dow = d.getDay();
      const inTrain = (dow === 0 || dow === 2 || dow === 5) ? '17225' : '18047';
      const retTrain = is18048Day(dateStr) ? '18048' : '17226';
      link.train_numbers = `${inTrain}, ${retTrain}`;
    } else if (cat === 2 && num === 52) {
      const retTrain = is18048Day(dateStr) ? '18048' : '17226';
      link.train_numbers = `${retTrain}, PILOT(12703)`;
    }
  }
  return link || { link_number: linkNumber, is_rest: 1, train_numbers: 'REST', from_station: '', to_station: '', coaches: '' };
}

// Helper: Get category parameters (anchor_date, cycle_length) for a given date
export function getCategoryParamsForDate(cat: any, dateStr: string | null = null) {
  if (!cat) return { anchor_date: '2020-01-01', cycle_length: 21 };
  if (cat.id === 2 || cat.code === 'TTI_SLEEPER') {
    if (dateStr && dateStr < '2026-10-01') {
      return { anchor_date: '2026-08-01', cycle_length: 63 };
    } else {
      return { anchor_date: '2026-10-01', cycle_length: 56 };
    }
  }
  return {
    anchor_date: cat.anchor_date || '2020-01-01',
    cycle_length: cat.cycle_length || 21
  };
}

// Link Set definitions for Indian Railways cyclic links
export const KNOWN_LINK_SETS: Record<number, number[][]> = {
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
    [29, 30, 31],
    [32, 33, 34],
    [36, 37, 38],
    [38, 39],
    [40, 41],
    [43, 44, 45],
    [46, 47, 48],
    [50, 51, 52]
  ],
  3: [
    [1, 2, 3],
    [4, 5, 6]
  ]
};

export function getLinkSetDetails(categoryId: any, linkNumber: any) {
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

// Helper: Check if staff took leave / sick on a 2 or 3 day link duty on previous day(s), making them available at HQ today
export async function checkMultiDayLeaveReturn(staffId: any, categoryId: any, rowPosition: any, cycleLength: any, anchorDate: any, targetDateStr: any) {
  async function checkStaffLeaveOnDate(dateStr: string) {
    // 1. Check overrides
    const override = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staffId, dateStr]);
    if (override) {
      if (override.status === 'AVAILABLE_FOR_BOOKING' || (override.reason && override.reason.toLowerCase().includes('available for booking'))) {
        return null;
      }
      if (['LEAVE', 'SICK', 'CR', 'ABSENT'].includes(override.status) || override.leave_type) {
        const isSick = override.status === 'SICK' || override.leave_type === 'SICK' || override.leave_type === 'LHAP' || (override.reason && override.reason.toLowerCase().includes('sick'));
        return { isLeave: true, status: isSick ? 'SICK' : (override.leave_type || override.status), isSick, reason: override.reason, substituteStaffId: override.substitute_staff_id, substituteName: override.substitute_name };
      }
      if (override.overridden_link_number === null && override.reason && (override.reason.toLowerCase().includes('leave') || override.reason.toLowerCase().includes('sick'))) {
        const isSick = override.reason.toLowerCase().includes('sick');
        return { isLeave: true, status: isSick ? 'SICK' : 'LEAVE', isSick, reason: override.reason, substituteStaffId: override.substitute_staff_id, substituteName: override.substitute_name };
      }
    }

    // 2. Check approved leave requests
    const leaveReq = await get(
      "SELECT * FROM leave_requests WHERE staff_id = ? AND status = 'APPROVED' AND (date = ? OR (from_date <= ? AND to_date >= ?))",
      [staffId, dateStr, dateStr, dateStr]
    );
    if (leaveReq) {
      const isSick = leaveReq.type === 'SICK' || (leaveReq.reason && leaveReq.reason.toLowerCase().includes('sick'));
      return { isLeave: true, status: isSick ? 'SICK' : 'LEAVE', isSick, reason: `Approved ${isSick ? 'Sick' : 'Leave'}: ${leaveReq.reason || 'Leave'}`, substituteStaffId: null, substituteName: null };
    }

    // 3. Check muster records
    const muster = await get("SELECT * FROM muster_records WHERE staff_id = ? AND date = ? AND code IN ('CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'NH', 'SICK', 'CR', 'O')", [staffId, dateStr]);
    if (muster) {
      const isSick = muster.code === 'SICK' || muster.code === 'LHAP';
      return { isLeave: true, status: isSick ? 'SICK' : muster.code, isSick, reason: `Muster ${isSick ? 'Sick' : 'Leave'} (${muster.code})`, substituteStaffId: null, substituteName: null };
    }

    return null;
  }

  // 1. If staff is on leave/sick TODAY, they are still on leave and not available for booking
  const todayLeave = await checkStaffLeaveOnDate(targetDateStr);
  if (todayLeave) return null;

  // 2. Check today's scheduled cyclic link
  const todayDayOffset = getDayOffset(anchorDate, targetDateStr);
  const todayLinkNum = getBaseLinkNumber(rowPosition, todayDayOffset, cycleLength);
  if (todayLinkNum === null) return null;
  const todayLinkDef = await getActiveLinkDef(categoryId, todayLinkNum, targetDateStr);
  if (!todayLinkDef || todayLinkDef.is_rest === 1) return null;

  // 3. Check multi-day link set details
  const todayLinkSet = getLinkSetDetails(categoryId, todayLinkNum);

  // If today's link is part of a multi-day link set and today is NOT the first day (i.e. dayIndexInSet > 1):
  if (todayLinkSet && todayLinkSet.dayIndexInSet > 1) {
    const daysSinceStart = todayLinkSet.dayIndexInSet - 1; // 1 for Day 2, 2 for Day 3
    for (let k = daysSinceStart; k >= 1; k--) {
      const prevD = new Date(targetDateStr + 'T12:00:00');
      prevD.setDate(prevD.getDate() - k);
      const prevDateStr = prevD.toISOString().split('T')[0];
      const prevLeave = await checkStaffLeaveOnDate(prevDateStr);

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
            : `Available for Booking Duty at HQ (Took leave on Link #${startLinkNum})`,
          substituteStaffId: prevLeave.substituteStaffId,
          substituteName: prevLeave.substituteName,
          originalPrevLink: startLinkNum
        };
      }
    }
  }

  // Fallback check for any link where departure is from an outstation
  const isOutstationDept = todayLinkDef && todayLinkDef.from_station && !todayLinkDef.from_station.startsWith('GNT') && todayLinkDef.from_station !== '---';
  if (isOutstationDept) {
    for (let k = 1; k <= 2; k++) {
      const prevD = new Date(targetDateStr + 'T12:00:00');
      prevD.setDate(prevD.getDate() - k);
      const prevDateStr = prevD.toISOString().split('T')[0];
      const prevLeave = await checkStaffLeaveOnDate(prevDateStr);

      if (prevLeave) {
        const prevDayOffset = getDayOffset(anchorDate, prevDateStr);
        const prevLinkNum = getBaseLinkNumber(rowPosition, prevDayOffset, cycleLength);
        const isSick = prevLeave.isSick || prevLeave.status === 'SICK';
        return {
          isAvailable: true,
          status: 'AVAILABLE_FOR_BOOKING',
          isSickReturn: isSick,
          reason: isSick
            ? `Available for Booking Duty at HQ (Came out of SICK leave on Link #${prevLinkNum})`
            : `Available for Booking Duty at HQ (Took leave on Link #${prevLinkNum})`,
          substituteStaffId: prevLeave.substituteStaffId,
          substituteName: prevLeave.substituteName,
          originalPrevLink: prevLinkNum
        };
      }
    }
  }

  return null;
}

// Standard arrival times for trains terminating / arriving at Headquarters GNT
export const STANDARD_GNT_ARRIVALS: Record<string, string> = {
  '12603': '23:50',
  '12703': '21:15',
  '12733': '00:45',
  '12748': '21:10',
  '17202': '21:30',
  '17216': '06:15',
  '17227': '14:00',
  '17252': '23:10',
  '17254': '20:00',
  '17262': '06:55',
  '20630': '05:50',
  '57201': '20:45',
  '07610': '10:00',
  '17426': '17:10',
  '07194': '10:40',
  '17042': '17:40',
  '22881': '02:05',
  '17222': '08:15',
  '16357': '21:10',
  '17070': '05:15',
  '18064': '19:25'
};

export function findGntArrivalForLink(catId: any, linkNum: any, lDef: any) {
  if (lDef) {
    const toStn = (lDef.to_station || '').toUpperCase();
    if (toStn === 'GNT' || toStn.endsWith('/GNT') || toStn.endsWith(', GNT')) {
      const trains = (lDef.train_numbers || '').split(',').map((t: string) => t.trim().replace(/[^0-9]/g, '')).filter(Boolean);
      const lastTrain = trains[trains.length - 1] || '20630';
      const stdArr = STANDARD_GNT_ARRIVALS[lastTrain] || (lastTrain === '20630' ? '05:50' : '23:10');
      return { trainNo: lastTrain, fromStation: lDef.from_station || '---', arrivalTime: stdArr };
    }
  }

  try {
    const linkObj = { train_numbers: 'TRAIN', ...(lDef || {}) };
    const rows = getDutyRowsForLinkNumber(catId, linkNum, linkObj);
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].to === 'GNT' && rows[i].arr && rows[i].arr !== '---') {
        return { trainNo: rows[i].train_no, fromStation: rows[i].from || '---', arrivalTime: rows[i].arr };
      }
    }
  } catch (err) {
    // Ignore error in duty rows calculation
  }
  if (lDef && (lDef.to_station === 'GNT' || (lDef.train_numbers && lDef.train_numbers.includes('GNT')))) {
    const firstTrain = (lDef.train_numbers || '').split(',')[0].replace(/[^0-9]/g, '');
    const stdArr = STANDARD_GNT_ARRIVALS[firstTrain] || '23:10';
    return { trainNo: firstTrain || lDef.train_numbers, fromStation: lDef.from_station || '---', arrivalTime: stdArr };
  }
  return null;
}

export const NON_DAILY_LINK_TRAINS: Record<number, string> = {
  53: '22882',
  54: '17221',
  55: '17069',
  56: 'R'
};

export const NON_DAILY_PAIRS_MAP: Record<string, any> = {
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
  '22882': { returnTrain: '22881', serviceName: 'BBS-PUNE Exp (Link #53)', from: 'GNT', via: 'WADI', to: 'GNT', depTime: '10:35', retDepTime: '16:55', arrHqTime: '02:05', totalDays: 3, restTill: '10:05', coaches: 'SL / AC' },
  '17221': { returnTrain: '17222', serviceName: 'COA-LTT Exp (Link #54)', from: 'GNT', via: 'WADI', to: 'GNT', depTime: '13:35', retDepTime: '23:00', arrHqTime: '08:15', totalDays: 3, restTill: '16:15', coaches: 'SL / AC' },
  '17069': { returnTrain: '17262', serviceName: 'GNT-TPTY / RU-GNT Exp (Link #55)', from: 'GNT', via: 'RU/TPTY', to: 'GNT', depTime: '22:40', retDepTime: '19:25', arrHqTime: '07:20', totalDays: 3, restTill: '15:20', coaches: 'SL / AC' },

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

export function getMultiDayNonDailyMatch(trainCodeOrReason: string | null | undefined) {
  if (!trainCodeOrReason) return null;
  const str = String(trainCodeOrReason).toUpperCase();
  for (const [outTrain, info] of Object.entries(NON_DAILY_PAIRS_MAP)) {
    if (str.includes(outTrain) || (info.returnTrain && str.includes(info.returnTrain))) {
      const isReturn = str.includes('RETURN') || str.includes('DAY 2') || (info.returnTrain && str.includes(info.returnTrain) && !str.includes(outTrain));
      return { ...info, outTrain, isReturn };
    }
  }
  return null;
}

export const NON_DAILY_MULTI_DAY_SERVICES = [
  {
    id: '22882_22881',
    name: 'BBS-PUNE Exp (Link #53)',
    linkNumber: 53,
    serviceDays: ['WED'],
    totalDays: 3,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (WED)', train: '22882', from: 'GNT', to: 'WADI', depTime: '10:35', arrTime: '21:10', coaches: 'SL / AC', dutyCode: '22882', remarks: 'BBS-PUNE Exp (GNT-WADI)' },
      { dayIndex: 2, dayLabel: 'Day 2 (THU)', train: '22881', from: 'WADI', to: 'GNT', depTime: '16:55', arrTime: '02:05', coaches: 'SL / AC', dutyCode: '22881', remarks: 'PUNE-BBS Exp (WADI-GNT)' },
      { dayIndex: 3, dayLabel: 'Day 3 (FRI)', train: '---', from: 'GNT', to: 'GNT', depTime: '', arrTime: '02:05', coaches: '-', dutyCode: 'AVL', remarks: 'Arr GNT 02:05 • 8h HQ Rest till 10:05 • Available (AVL)' }
    ]
  },
  {
    id: '17221_17222_WED',
    name: 'COA-LTT Exp (Link #54 - Wed Run)',
    linkNumber: 54,
    serviceDays: ['WED'],
    totalDays: 3,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (WED)', train: '17221', from: 'GNT', to: 'WADI', depTime: '13:35', arrTime: '00:05', coaches: 'SL / AC', dutyCode: '17221', remarks: 'COA-LTT Exp (GNT-WADI)' },
      { dayIndex: 2, dayLabel: 'Day 2 (THU)', train: '17222', from: 'WADI', to: 'GNT', depTime: '23:00', arrTime: '08:15', coaches: 'SL / AC', dutyCode: '17222', remarks: 'LTT-COA Exp (WADI-GNT)' },
      { dayIndex: 3, dayLabel: 'Day 3 (FRI)', train: '---', from: 'GNT', to: 'GNT', depTime: '', arrTime: '08:15', coaches: '-', dutyCode: 'AVL', remarks: 'Arr GNT 08:15 • 8h HQ Rest till 16:15 • Available (AVL)' }
    ]
  },
  {
    id: '17221_17222_SAT',
    name: 'COA-LTT Exp (Link #54 - Sat Run)',
    linkNumber: 54,
    serviceDays: ['SAT'],
    totalDays: 3,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (SAT)', train: '17221', from: 'GNT', to: 'WADI', depTime: '13:35', arrTime: '00:05', coaches: 'SL / AC', dutyCode: '17221', remarks: 'COA-LTT Exp (GNT-WADI)' },
      { dayIndex: 2, dayLabel: 'Day 2 (SUN)', train: '17222', from: 'WADI', to: 'GNT', depTime: '23:00', arrTime: '08:15', coaches: 'SL / AC', dutyCode: '17222', remarks: 'LTT-COA Exp (WADI-GNT)' },
      { dayIndex: 3, dayLabel: 'Day 3 (MON)', train: '---', from: 'GNT', to: 'GNT', depTime: '', arrTime: '08:15', coaches: '-', dutyCode: 'AVL', remarks: 'Arr GNT 08:15 • 8h HQ Rest till 16:15 • Available (AVL)' }
    ]
  },
  {
    id: '17069_17262',
    name: 'GNT-TPTY / RU-GNT Exp (Link #55)',
    linkNumber: 55,
    serviceDays: ['WED'],
    totalDays: 3,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (WED)', train: '17069', from: 'GNT', to: 'RU', depTime: '22:40', arrTime: '07:15', coaches: 'SL / AC', dutyCode: '17069', remarks: 'GNT-TPTY / RU Exp (GNT-RU)' },
      { dayIndex: 2, dayLabel: 'Day 2 (THU)', train: '17262', from: 'TPTY', to: 'GNT', depTime: '19:25', arrTime: '07:20', coaches: 'SL / AC', dutyCode: '17262', remarks: 'TPTY-GNT Exp (TPTY-GNT)' },
      { dayIndex: 3, dayLabel: 'Day 3 (FRI)', train: '---', from: 'GNT', to: 'GNT', depTime: '', arrTime: '07:20', coaches: '-', dutyCode: 'AVL', remarks: 'Arr GNT 07:20 • 8h HQ Rest till 15:20 • Available (AVL)' }
    ]
  },
  {
    id: '17261_17070',
    name: 'GNT-TPTY-RU-GNT Exp',
    linkNumber: null,
    serviceDays: ['THU'],
    totalDays: 3,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (THU)', train: '17261', from: 'GNT', to: 'TPTY', depTime: '16:30', arrTime: '03:50', coaches: 'SL / AC', dutyCode: '17261', remarks: 'GNT-TPTY Exp' },
      { dayIndex: 2, dayLabel: 'Day 2 (FRI)', train: '17070', from: 'RU', to: 'GNT', depTime: '22:40', arrTime: '05:15', coaches: 'SL / AC', dutyCode: '17070', remarks: 'RU-GNT Exp' },
      { dayIndex: 3, dayLabel: 'Day 3 (SAT)', train: '---', from: 'GNT', to: 'GNT', depTime: '', arrTime: '05:15', coaches: '-', dutyCode: 'AVL', remarks: 'Arr GNT 05:15 • 8h HQ Rest till 13:15 • Available (AVL)' }
    ]
  },
  {
    id: '17231_17232_SUN',
    name: 'BZA-CHZ-BZA Exp (Sun Run)',
    linkNumber: null,
    serviceDays: ['SUN'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (SUN)', train: '17231', from: 'BZA', to: 'CHZ', depTime: '13:50', arrTime: '20:40', coaches: 'SL / AC', dutyCode: '17231', remarks: 'BZA-CHZ Exp (or 07029)' },
      { dayIndex: 2, dayLabel: 'Day 2 (MON)', train: '17232', from: 'CHZ', to: 'BZA', depTime: '23:40', arrTime: '06:25', coaches: 'SL / AC', dutyCode: '17232', remarks: 'CHZ-BZA Exp (Arr 06:25)' }
    ]
  },
  {
    id: '17231_17232_FRI',
    name: 'BZA-CHZ-BZA Exp (Fri Run)',
    linkNumber: null,
    serviceDays: ['FRI'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (FRI)', train: '17231', from: 'BZA', to: 'CHZ', depTime: '13:50', arrTime: '20:40', coaches: 'SL / AC', dutyCode: '17231', remarks: 'BZA-CHZ Exp' },
      { dayIndex: 2, dayLabel: 'Day 2 (SAT)', train: '17232', from: 'CHZ', to: 'BZA', depTime: '23:40', arrTime: '06:25', coaches: 'SL / AC', dutyCode: '17232', remarks: 'CHZ-BZA Exp (Arr 06:25)' }
    ]
  },
  {
    id: '02811_02812',
    name: 'GNT-DMM-BZA Spl',
    linkNumber: null,
    serviceDays: ['SUN'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (SUN)', train: '02811', from: 'GNT', to: 'DMM', depTime: '08:30', arrTime: '21:00', coaches: 'SL / AC', dutyCode: '02811', remarks: 'GNT-DMM Spl' },
      { dayIndex: 2, dayLabel: 'Day 2 (MON)', train: '02812', from: 'DMM', to: 'BZA', depTime: '08:30', arrTime: '18:00', coaches: 'SL / AC', dutyCode: '02812', remarks: 'DMM-BZA Spl' }
    ]
  },
  {
    id: '07609_07610',
    name: 'GNT-RU-GNT Spl',
    linkNumber: null,
    serviceDays: ['MON'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (MON)', train: '07609', from: 'GNT', to: 'RU', depTime: '02:55', arrTime: '09:30', coaches: 'SL / AC', dutyCode: '07609', remarks: 'GNT-RU Spl' },
      { dayIndex: 2, dayLabel: 'Day 2 (TUE)', train: '07610', from: 'RU', to: 'GNT', depTime: '13:35', arrTime: '10:00', coaches: 'SL / AC', dutyCode: '07610', remarks: 'RU-GNT Spl (Arr 10:00)' }
    ]
  },
  {
    id: '07615_07616',
    name: 'GNT-RU-GNT Spl',
    linkNumber: null,
    serviceDays: ['TUE'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (TUE)', train: '07615', from: 'GNT', to: 'RU', depTime: '23:10', arrTime: '08:10', coaches: 'SL / AC', dutyCode: '07615', remarks: 'GNT-RU Spl' },
      { dayIndex: 2, dayLabel: 'Day 2 (WED)', train: '07616', from: 'RU', to: 'GNT', depTime: '07:30', arrTime: '15:05', coaches: 'SL / AC', dutyCode: '07616', remarks: 'RU-GNT Spl' }
    ]
  },
  {
    id: '17041_17042',
    name: 'GNT-RU-GNT Exp',
    linkNumber: null,
    serviceDays: ['TUE'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (TUE)', train: '17041', from: 'GNT', to: 'RU', depTime: '12:20', arrTime: '19:20', coaches: 'SL / AC', dutyCode: '17041', remarks: 'GNT-RU Exp' },
      { dayIndex: 2, dayLabel: 'Day 2 (WED)', train: '17042', from: 'RU', to: 'GNT', depTime: '10:40', arrTime: '17:40', coaches: 'SL / AC', dutyCode: '17042', remarks: 'RU-GNT Exp' }
    ]
  },
  {
    id: '12604_16357',
    name: 'GNT-MAS-MS-GNT Exp',
    linkNumber: null,
    serviceDays: ['THU'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (THU)', train: '12604', from: 'GNT', to: 'MAS', depTime: '22:00', arrTime: '05:40', coaches: 'SL / AC', dutyCode: '12604', remarks: 'GNT-MAS Exp' },
      { dayIndex: 2, dayLabel: 'Day 2 (FRI)', train: '16357', from: 'MS', to: 'GNT', depTime: '13:00', arrTime: '21:10', coaches: 'SL / AC', dutyCode: '16357', remarks: 'MS-GNT Exp' }
    ]
  },
  {
    id: '18063_18064',
    name: 'GNT-DMM-GNT Exp',
    linkNumber: null,
    serviceDays: ['FRI'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (FRI)', train: '18063', from: 'GNT', to: 'DMM', depTime: '09:45', arrTime: '20:30', coaches: 'SL / AC', dutyCode: '18063', remarks: 'GNT-DMM Exp' },
      { dayIndex: 2, dayLabel: 'Day 2 (SAT)', train: '18064', from: 'DMM', to: 'GNT', depTime: '08:15', arrTime: '19:25', coaches: 'SL / AC', dutyCode: '18064', remarks: 'DMM-GNT Exp' }
    ]
  },
  {
    id: '07193_07194',
    name: 'GNT-KPD-GNT Spl',
    linkNumber: null,
    serviceDays: ['SAT'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (SAT)', train: '07193', from: 'GNT', to: 'KPD', depTime: '05:30', arrTime: '16:30', coaches: 'SL / AC', dutyCode: '07193', remarks: 'GNT-KPD Spl' },
      { dayIndex: 2, dayLabel: 'Day 2 (SUN/TUE)', train: '07194', from: 'KPD', to: 'GNT', depTime: '01:00', arrTime: '10:40', coaches: 'SL / AC', dutyCode: '07194', remarks: 'KPD-GNT Spl' }
    ]
  },
  {
    id: '16358_12603',
    name: 'GNT-MS-MAS-GNT Exp',
    linkNumber: null,
    serviceDays: ['SAT'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (SAT)', train: '16358', from: 'GNT', to: 'MS', depTime: '14:00', arrTime: '22:55', coaches: 'SL / AC', dutyCode: '16358', remarks: 'GNT-MS Exp' },
      { dayIndex: 2, dayLabel: 'Day 2 (SUN)', train: '12603', from: 'MAS', to: 'GNT', depTime: '16:45', arrTime: '23:25', coaches: 'SL / AC', dutyCode: '12603', remarks: 'MAS-GNT Exp' }
    ]
  },
  {
    id: '17646_17625',
    name: 'GNT-SC-KCG-RAL Exp',
    linkNumber: null,
    serviceDays: ['MON'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (MON)', train: '17646', from: 'GNT', to: 'SC', depTime: '08:50', arrTime: '16:00', coaches: 'SL / AC', dutyCode: '17646', remarks: 'GNT-SC Exp' },
      { dayIndex: 2, dayLabel: 'Day 2 (TUE)', train: '17625', from: 'KCG', to: 'RAL', depTime: '22:20', arrTime: '06:25', coaches: 'SL / AC', dutyCode: '17625', remarks: 'KCG-RAL Exp' }
    ]
  },
  {
    id: '17425_17426',
    name: 'GNT-SC-GNT Exp',
    linkNumber: null,
    serviceDays: ['SUN'],
    totalDays: 2,
    coaches: 'SL / AC',
    legs: [
      { dayIndex: 1, dayLabel: 'Day 1 (SUN)', train: '17425', from: 'GNT', to: 'SC', depTime: '10:40', arrTime: '16:00', coaches: 'SL / AC', dutyCode: '17425', remarks: 'GNT-SC Exp' },
      { dayIndex: 2, dayLabel: 'Day 2 (MON)', train: '17426', from: 'SC', to: 'GNT', depTime: '11:40', arrTime: '17:10', coaches: 'SL / AC', dutyCode: '17426', remarks: 'SC-GNT Exp' }
    ]
  }
];

export async function getStaffLastDutyAndRestStatus(staffId: any, targetDateStr: any, customNow: any = null) {
  // 1. Check explicit manual/recorded entries in lr_duty_completions
  const manual = await get(
    `SELECT * FROM lr_duty_completions 
     WHERE staff_id = ? AND date(arrival_date) <= date(?)
     ORDER BY date(arrival_date) DESC, arrival_time DESC LIMIT 1`,
    [staffId, targetDateStr]
  );

  let lastDuty: any = null;
  if (manual) {
    lastDuty = {
      source: 'manual',
      trainNo: manual.train_no,
      fromStation: manual.from_station,
      arrivalDate: manual.arrival_date,
      arrivalTime: manual.arrival_time,
      dutyRemarks: manual.remarks,
      completedDateDisplay: formatDateDisplay(manual.arrival_date)
    };
  } else {
    // 2. Check Overrides / Daily Duty for this staff or where staff was substitute
    const dObj = new Date(targetDateStr + 'T12:00:00');
    for (let k = 1; k <= 7; k++) {
      const prevD = new Date(dObj);
      prevD.setDate(prevD.getDate() - k);
      const prevDateStr = prevD.toISOString().split('T')[0];

      const ov = await get(
        `SELECT * FROM overrides 
         WHERE (staff_id = ? OR substitute_staff_id = ?) AND date = ?`,
        [staffId, staffId, prevDateStr]
      );

      if (ov && !['REST', 'SICK', 'LEAVE', 'CR', 'ABSENT', 'AVAILABLE_FOR_BOOKING'].includes(ov.status)) {
        let trainNo = ov.extra_train_no || null;
        let fromStn = '---';
        let arrTime = '---';

        if (ov.overridden_link_number) {
          const lDef = await getActiveLinkDef(ov.target_category_id || 2, ov.overridden_link_number, prevDateStr);
          const gntArr = findGntArrivalForLink(ov.target_category_id || 2, ov.overridden_link_number, lDef);
          if (gntArr) {
            trainNo = gntArr.trainNo;
            fromStn = gntArr.fromStation;
            arrTime = gntArr.arrivalTime;
          }
        }

        if (trainNo) {
          lastDuty = {
            source: 'roster_override',
            trainNo: String(trainNo),
            fromStation: fromStn,
            arrivalDate: prevDateStr,
            arrivalTime: arrTime !== '---' ? arrTime : (STANDARD_GNT_ARRIVALS[String(trainNo)] || '23:10'),
            dutyRemarks: ov.reason || 'Completed Link / Extra Train Duty',
            completedDateDisplay: formatDateDisplay(prevDateStr)
          };
          break;
        }
      }
    }
  }

  if (!lastDuty) {
    return {
      hasDutyRecord: false,
      hasLastDuty: false,
      lastDuty: null,
      arrivalDateTime: null,
      arrivalTime: null,
      rest8hTime: null,
      rest12hTime: null,
      restElapsedHours: null,
      restStatus: 'AVAILABLE',
      isAvailableForBooking: true,
      statusBadgeText: 'Available',
      statusBadgeSubtext: 'No prior duty restrictions',
      badgeColor: '#16a34a',
      badgeBg: '#f0fdf4',
      remarksText: 'Fully available for booking duty'
    };
  }

  // Calculate elapsed rest time
  const arrTimeParts = (lastDuty.arrivalTime || '08:00').split(':');
  const arrHour = parseInt(arrTimeParts[0], 10) || 0;
  const arrMin = parseInt(arrTimeParts[1], 10) || 0;

  const arrDate = new Date(lastDuty.arrivalDate + 'T00:00:00');
  arrDate.setHours(arrHour, arrMin, 0, 0);

  const rest8h = new Date(arrDate.getTime() + 8 * 60 * 60 * 1000);
  const rest12h = new Date(arrDate.getTime() + 12 * 60 * 60 * 1000);

  const now = customNow ? new Date(customNow) : new Date(targetDateStr + 'T12:00:00');
  const elapsedMs = now.getTime() - arrDate.getTime();
  const elapsedHours = Math.round((elapsedMs / (1000 * 60 * 60)) * 10) / 10;

  let restStatus = 'RESTING';
  let isAvailableForBooking = false;
  let statusBadgeText = 'In Rest';
  let statusBadgeSubtext = '';
  let badgeColor = '#dc2626';
  let badgeBg = '#fef2f2';
  let remarksText = '';

  const formatClock = (d: Date) => {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const dStr = formatDateDisplay(d);
    return `${h}:${m} (${dStr})`;
  };

  const rest8hStr = formatClock(rest8h);
  const rest12hStr = formatClock(rest12h);

  if (now.getTime() < rest8h.getTime()) {
    const remainingMs = rest8h.getTime() - now.getTime();
    const remHours = Math.ceil(remainingMs / (1000 * 60 * 60));
    restStatus = 'IN_HQ_REST';
    isAvailableForBooking = false;
    statusBadgeText = 'Statutory HQ Rest';
    statusBadgeSubtext = `Under 8h rest (till ${rest8hStr})`;
    badgeColor = '#dc2626';
    badgeBg = '#fef2f2';
    remarksText = `Statutory HQ rest until ${rest8hStr} (${remHours}h remaining)`;
  } else if (now.getTime() >= rest8h.getTime() && now.getTime() < rest12h.getTime()) {
    restStatus = 'ELIGIBLE_FOR_CALL';
    isAvailableForBooking = true;
    statusBadgeText = 'Eligible (8h+ Rest)';
    statusBadgeSubtext = `8h completed at ${rest8hStr}; 12h full rest at ${rest12hStr}`;
    badgeColor = '#d97706';
    badgeBg = '#fffbeb';
    remarksText = `Available for urgent call-up (8h statutory rest completed at ${rest8hStr})`;
  } else {
    restStatus = 'FULL_REST_COMPLETED';
    isAvailableForBooking = true;
    statusBadgeText = 'Fully Available';
    statusBadgeSubtext = `12h+ rest completed (since ${rest12hStr})`;
    badgeColor = '#16a34a';
    badgeBg = '#f0fdf4';
    remarksText = `Fully rested and ready for any duty (12h rest completed at ${rest12hStr})`;
  }

  return {
    hasDutyRecord: true,
    hasLastDuty: true,
    lastDuty,
    arrivalDateTime: arrDate.toISOString(),
    arrivalTime: lastDuty.arrivalTime,
    rest8hTime: rest8hStr,
    rest12hTime: rest12hStr,
    restElapsedHours: elapsedHours,
    restStatus,
    isAvailableForBooking,
    statusBadgeText,
    statusBadgeSubtext,
    badgeColor,
    badgeBg,
    remarksText
  };
}

export async function calculateStaffCrBalances() {
  const staffMembers: any[] = await all('SELECT * FROM staff ORDER BY id');
  const categories: any[] = await all('SELECT * FROM categories');
  const catMap: Record<number, any> = {};
  categories.forEach(c => catMap[c.id] = c);

  const links: any[] = await all(`
    SELECT * FROM links 
    WHERE (status = 'published' OR status IS NULL OR status = '') 
      AND (status != 'draft')
      AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = 'published' OR status IS NULL))
  `);
  const linkRestMap: Record<string, any> = {};
  links.forEach(l => {
    linkRestMap[l.category_id + '_' + l.link_number] = l.is_rest;
  });

  const allOverrides: any[] = await all('SELECT * FROM overrides ORDER BY date ASC');
  const allMuster: any[] = await all("SELECT * FROM muster_records ORDER BY date ASC");
  const musterMap: Record<string, any> = {};
  allMuster.forEach(m => {
    musterMap[`${m.staff_id}_${m.date}`] = m;
  });
  const allLrSheet: any[] = await all("SELECT * FROM lr_sheet_records ORDER BY date ASC");
  const lrSheetMap: Record<string, any> = {};
  allLrSheet.forEach(l => {
    lrSheetMap[`${l.staff_id}_${l.date}`] = l;
  });

  const crMap: Record<number, any> = {};

  for (const staff of staffMembers) {
    const cat = catMap[staff.category_id];
    if (!cat) continue;

    const staffOverrides = allOverrides.filter(o => o.staff_id === staff.id);
    const staffMuster = allMuster.filter(m => m.staff_id === staff.id);
    const staffLr = allLrSheet.filter(l => l.staff_id === staff.id);
    const restForgoneRecords: any[] = [];
    const crRedeemedDates: any[] = [];

    const relevantDates = new Set<string>();
    staffOverrides.forEach(o => relevantDates.add(o.date));
    staffMuster.forEach(m => relevantDates.add(m.date));
    staffLr.forEach(l => relevantDates.add(l.date));
    const sortedDates = Array.from(relevantDates).sort();

    for (const dStr of sortedDates) {
      const o = staffOverrides.find(ov => ov.date === dStr);
      const m = musterMap[`${staff.id}_${dStr}`];
      const lr = lrSheetMap[`${staff.id}_${dStr}`];

      if ((o && (o.status === 'CR' || o.leave_type === 'CR')) || (m && m.code === 'CR') || (lr && lr.duty_code === 'CR')) {
        crRedeemedDates.push({
          date: dStr,
          dateDisplay: formatDateDisplay(dStr),
          reason: (o && o.reason) || (m && m.remarks) || (lr && lr.remarks) || 'Compensatory Rest Availed'
        });
        continue;
      }

      const { anchor_date: catAnchorDate, cycle_length: catCycleLength } = getCategoryParamsForDate(cat, dStr);
      const dayOffset = getDayOffset(catAnchorDate, dStr);
      const origLink = getBaseLinkNumber(staff.row_position, dayOffset, catCycleLength);

      let isOrigRest = false;
      const dObj = new Date(dStr + 'T12:00:00');
      const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const dayName = days[dObj.getDay()];

      let restTypeDesc = '';
      if (staff.category_id === 4) {
        if (staff.name.toUpperCase().includes(dayName + ' REST') || (staff.rest_day && staff.rest_day.toUpperCase() === dayName)) {
          isOrigRest = true;
          restTypeDesc = `Weekly Rest (${dayName})`;
        }
      } else {
        if (origLink === null || linkRestMap[cat.id + '_' + origLink] === 1) {
          isOrigRest = true;
          restTypeDesc = origLink ? `Cyclic Rest (Link #${origLink})` : `Cyclic Rest`;
        } else if (staff.rest_day && staff.rest_day.toUpperCase() === dayName) {
          isOrigRest = true;
          restTypeDesc = `Weekly Rest (${dayName})`;
        }
      }

      const isWorkingOverride = o && (
        o.overridden_link_number !== null ||
        o.is_extra === 1 ||
        o.extra_train_no ||
        o.advance_train_no ||
        o.shifted_place ||
        ['EXTRA_CREW', 'UTILISED_ADVANCE', 'CHANGED_LINK', 'SUBSTITUTE', 'DRAG_ASSIGN'].includes(o.status)
      );
      const isMusterPresent = m && m.code === 'P';
      const isLrWorking = lr && lr.duty_code && !['R', 'CR', 'S', 'SICK', 'L', 'CL', 'LAP', 'LHAP', 'AVL', 'O'].includes(lr.duty_code.toUpperCase());

      if (isOrigRest && (isWorkingOverride || isMusterPresent || isLrWorking)) {
        let workedDutyDesc = '';
        if (o) {
          if (o.extra_train_no) workedDutyDesc = `Worked Extra Train ${o.extra_train_no}`;
          else if (o.advance_train_no) workedDutyDesc = `Worked Advance Train ${o.advance_train_no}`;
          else if (o.overridden_link_number) workedDutyDesc = `Worked Link #${o.overridden_link_number}`;
          else workedDutyDesc = o.reason || 'Worked on Rest Day';
        } else if (lr && lr.duty_code) {
          workedDutyDesc = `Worked LR Duty (${lr.duty_code})`;
        } else if (m) {
          workedDutyDesc = m.remarks || 'Worked (Marked Present in Muster)';
        }

        restForgoneRecords.push({
          forgoneDate: dStr,
          forgoneDateDisplay: formatDateDisplay(dStr),
          forgoneDay: dayName,
          restType: restTypeDesc,
          workedDuty: workedDutyDesc,
          earnedCr: 1,
          isAvailed: false,
          availedDate: null,
          availedDateDisplay: null
        });
      }
    }

    const earnedCount = restForgoneRecords.length;
    const redeemedCount = crRedeemedDates.length;
    const balance = Math.max(0, earnedCount - redeemedCount);

    for (let i = 0; i < Math.min(redeemedCount, earnedCount); i++) {
      restForgoneRecords[i].isAvailed = true;
      restForgoneRecords[i].availedDate = crRedeemedDates[i].date;
      restForgoneRecords[i].availedDateDisplay = crRedeemedDates[i].dateDisplay;
      restForgoneRecords[i].availedReason = crRedeemedDates[i].reason;
    }

    crMap[staff.id] = {
      staffId: staff.id,
      staffName: staff.name,
      designation: staff.designation,
      categoryId: staff.category_id,
      categoryName: cat.name,
      crEarnedCount: earnedCount,
      crRedeemedCount: redeemedCount,
      crBalance: balance,
      forgoneRecords: restForgoneRecords,
      redeemedDates: crRedeemedDates
    };
  }

  return crMap;
}

export function parseTrainNumbers(trainStr: string | null | undefined): string[] {
  if (!trainStr || trainStr === 'REST') return [];
  return trainStr
    .split(',')
    .map(t => t.trim().replace(/^PILOT\((.*?)\)$/, '$1'))
    .filter(Boolean);
}

export function isCoachCompatible(plannedCoach: string | null | undefined, actualCoach: string | null | undefined): boolean {
  if (!plannedCoach || !actualCoach) return true;
  const p = plannedCoach.toUpperCase().replace(/\s+/g, '');
  const a = actualCoach.toUpperCase().replace(/\s+/g, '');
  if (p.includes(a) || a.includes(p)) return true;
  if ((p.includes('COR') || p.includes('AC')) && (a.includes('COR') || a.includes('AC'))) return true;
  if ((p.includes('SL') || p.includes('S1') || p.includes('S5')) && (a.includes('SL') || a.includes('S1') || a.includes('COR'))) return true;
  if ((p.includes('2S') || p.includes('CC')) && (a.includes('2S') || a.includes('CC') || a.includes('AC'))) return true;
  if (p.replace('+', '-') === a.replace('+', '-')) return true;
  return false;
}

export function resolveIsoDateFromDocRow(monthYear: any, dateStr: any, fallbackIso: any): string | null {
  if (fallbackIso && /^\d{4}-\d{2}-\d{2}$/.test(String(fallbackIso).trim())) {
    return String(fallbackIso).trim();
  }
  const s = String(dateStr || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const slashParts = s.split('/');
  if (slashParts.length >= 2 && monthYear && /^\d{4}-\d{2}$/.test(monthYear)) {
    const dayNum = parseInt(slashParts[0], 10);
    if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
      return `${monthYear}-${String(dayNum).padStart(2, '0')}`;
    }
  }
  return null;
}

export async function syncDailyEarningsItemToDiary(
  staffId: any, dateStr: any, twt_nc: any, twt_fare: any, twt_penalty: any,
  ir_nc: any, ir_fare: any, ir_penalty: any, ubl_nc: any, ubl_amt: any,
  gst: any, z652_amt: any, oc_amt: any, dutyStr?: any
) {
  if (!staffId || !dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
  const monthYear = dateStr.slice(0, 7);
  const parts = dateStr.split('-');
  const dNum = parseInt(parts[2], 10);
  const mNum = parseInt(parts[1], 10);
  const yy = parts[0].slice(-2);
  const ddPad = `${String(dNum).padStart(2, '0')}/${String(mNum).padStart(2, '0')}/${yy}`;
  const ddShort = `${dNum}/${mNum}/${yy}`;
  const ddFull = `${String(dNum).padStart(2, '0')}/${String(mNum).padStart(2, '0')}/${parts[0]}`;

  const totalCases = (twt_nc || 0) + (ir_nc || 0) + (ubl_nc || 0);
  const collectedRs = Math.round(((twt_fare || 0) + (twt_penalty || 0) + (ir_fare || 0) + (ir_penalty || 0) + (ubl_amt || 0) + (z652_amt || 0) + (oc_amt || 0)) * 100) / 100;
  const gstAmt = Math.round((gst || 0) * 100) / 100;
  const totalAmt = Math.round((collectedRs + gstAmt) * 100) / 100;

  if (totalCases > 0 || collectedRs > 0 || gstAmt > 0) {
    await run(
      `UPDATE diary_entries
       SET no_of_cases = ?,
           collected_rs = ?,
           gst_amount = ?,
           total_amount = ?,
           duty_carried = CASE WHEN (? IS NOT NULL AND ? != '') THEN ? ELSE duty_carried END
       WHERE staff_id = ? AND month_year = ? AND (date_str = ? OR date_str = ? OR date_str = ?)`,
      [totalCases, collectedRs, gstAmt, totalAmt, dutyStr || '', dutyStr || '', dutyStr || '', staffId, monthYear, ddPad, ddShort, ddFull]
    );
  }
}

export const ALLOWED_MUSTER_CODES = ['E', 'O', 'P', 'R', 'CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'CR', 'SICK', 'OD', 'NH'];

export function getMusterCycleDates(cycleStartStr: any = null) {
  let startDate: Date;
  if (cycleStartStr) {
    startDate = new Date(cycleStartStr + 'T00:00:00');
  } else {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();
    // If current date is before 11th, cycle started on 11th of previous month
    if (now.getDate() < 11) {
      month -= 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
    }
    startDate = new Date(year, month, 11);
  }

  let endYear = startDate.getFullYear();
  let endMonth = startDate.getMonth() + 1;
  if (endMonth > 11) {
    endMonth = 0;
    endYear += 1;
  }
  const endDate = new Date(endYear, endMonth, 10);

  const dates: any[] = [];
  let curr = new Date(startDate);
  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  while (curr <= endDate) {
    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, '0');
    const d = String(curr.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    dates.push({
      dateStr,
      dayNumber: curr.getDate(),
      dayOfWeek: daysOfWeek[curr.getDay()],
      isSunday: curr.getDay() === 0,
      monthLabel: curr.toLocaleString('default', { month: 'short' })
    });
    curr.setDate(curr.getDate() + 1);
  }

  // Calculate previous and next cycle starts for navigation
  const prevDate = new Date(startDate);
  prevDate.setMonth(prevDate.getMonth() - 1);
  const prevCycleStart = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-11`;

  const nextDate = new Date(startDate);
  nextDate.setMonth(nextDate.getMonth() + 1);
  const nextCycleStart = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-11`;

  return {
    cycleStart: dates[0].dateStr,
    cycleEnd: dates[dates.length - 1].dateStr,
    startDateStr: dates[0].dateStr,
    endDateStr: dates[dates.length - 1].dateStr,
    prevCycleStart,
    nextCycleStart,
    periodLabel: `${dates[0].monthLabel} 11 - ${dates[dates.length - 1].monthLabel} 10, ${dates[dates.length - 1].dateStr.split('-')[0]}`,
    totalDays: dates.length,
    dates
  };
}

export function formatTrainString(str: any): string {
  if (!str) return '';
  let s = String(str).trim();
  if (s.toUpperCase() === 'REST') return 'R';
  if (s.toUpperCase() === 'NON DAILY' || s.toUpperCase() === 'NON-DAILY') return 'NON DAILY';
  s = s.replace(/PILOT\([^\)]+\)/gi, 'PILOT');
  s = s.replace(/,/g, ' / ');
  s = s.replace(/\s*\/\s*/g, ' / ');
  return s.trim();
}

export function extractTrainsFromText(text: any): string | null {
  if (!text) return null;
  const str = String(text);
  const multiMatch = str.match(/\b(\d{4,5})\s*[\/\-]\s*(\d{4,5})\b/);
  if (multiMatch) {
    return `${multiMatch[1]} / ${multiMatch[2]}`;
  }
  const trainMatches: string[] = [];
  const re = /(?:Train\s*(\d{4,5}))|(?:\b(\d{4,5})\b)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(str)) !== null) {
    const num = match[1] || match[2];
    const idx = match.index;
    const prefix = str.substring(Math.max(0, idx - 10), idx).toLowerCase();
    if (prefix.includes('link #') || prefix.includes('link#') || prefix.includes('link ') || prefix.includes('page ')) {
      continue;
    }
    if (num === '2026' || num === '2025' || num === '2027') continue;
    trainMatches.push(num);
  }
  if (trainMatches.length >= 2) {
    return `${trainMatches[0]} / ${trainMatches[1]}`;
  }
  if (trainMatches.length === 1) {
    return trainMatches[0];
  }
  const linkParen = str.match(/Link\s*#?(\d+)/i);
  if (linkParen) {
    const lNum = parseInt(linkParen[1], 10);
    if (NON_DAILY_LINK_TRAINS[lNum]) return NON_DAILY_LINK_TRAINS[lNum];
  }
  const stnMatch = str.match(/\b(GTL|SC|VSKP|TPTY|BZA|RU|KPD|GNT|NS)\b/i);
  if (stnMatch) {
    return stnMatch[1].toUpperCase();
  }
  return null;
}

export async function resolveDutyCodeForLRStaff(staffId: any, dateStr: string, dayOfWeek: string, staffRestDay: string, dataPool: any = null) {
  let overrides: any[], links: any[], nonDaily: any[], dutyRegister: any[], muster: any[], dailyEarnings: any[];
  if (dataPool) {
    overrides = dataPool.overrides;
    links = dataPool.links;
    nonDaily = dataPool.nonDaily;
    dutyRegister = dataPool.dutyRegister;
    muster = dataPool.muster;
    dailyEarnings = dataPool.dailyEarnings;
  } else {
    const dMinus2Obj = new Date(dateStr + 'T12:00:00');
    dMinus2Obj.setDate(dMinus2Obj.getDate() - 2);
    const dMinus2Start = dMinus2Obj.toISOString().split('T')[0];
    overrides = await all(`
      SELECT o.*, s1.name as staff_name, s1.category_id as staff_cat
      FROM overrides o
      JOIN staff s1 ON o.staff_id = s1.id
      WHERE o.date >= ? AND o.date <= ?
    `, [dMinus2Start, dateStr]);
    links = await all(`
      SELECT * FROM links 
      WHERE (status = 'published' OR status IS NULL OR status = '') 
        AND (status != 'draft')
        AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = 'published' OR status IS NULL))
    `);
    nonDaily = await all('SELECT * FROM non_daily_trains');
    dutyRegister = await all(`
      SELECT dre.*, drs.staff_id
      FROM duty_register_entry dre
      JOIN duty_register_staff drs ON dre.id = drs.entry_id
      WHERE dre.date = ?
    `, [dateStr]);
    muster = await all('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staffId, dateStr]);
    dailyEarnings = await all('SELECT * FROM daily_earnings_entries WHERE staff_id = ? AND date = ?', [staffId, dateStr]);
  }

  // 1. Direct override on LR staff or where LR staff is the substitute
  const direct = overrides ? overrides.find(o => o.staff_id === staffId && o.date === dateStr) : null;
  const sub = overrides ? overrides.find(o => o.substitute_staff_id === staffId && o.staff_id !== staffId && o.date === dateStr && o.status !== 'SUBSTITUTE') : null;
  const ov = (direct && !(direct.status === 'AVAILABLE_FOR_BOOKING' && sub)) ? direct : (sub || direct);

  if (ov) {
    if (ov === direct) {
      if (ov.status === 'REST') return { code: 'R', remarks: ov.reason || '' };
      if (ov.status === 'SICK') return { code: 'S', remarks: ov.reason || '' };
      if (ov.status === 'LEAVE') return { code: ov.leave_type || 'L', remarks: ov.reason || '' };
      if (ov.status === 'CR') return { code: 'CR', remarks: ov.reason || '' };
      if (ov.status === 'ABSENT') return { code: 'O', remarks: ov.reason || 'Absent' };
      if (ov.status === 'AVAILABLE_FOR_BOOKING') return { code: 'AVL', remarks: ov.reason || 'Available for Duty' };
      if (ov.status === 'UTILISED_ADVANCE') return { code: `ADV (${ov.advance_train_no || 'TR'})`, remarks: ov.reason || 'Utilised in Advance' };
    }

    if (ov.extra_train_no) {
      return { code: formatTrainString(ov.extra_train_no), remarks: ov.reason || '' };
    }

    const fromReason = extractTrainsFromText(ov.reason);
    if (fromReason) {
      return { code: fromReason, remarks: ov.reason || '' };
    }

    const linkNum = ov === direct
      ? (ov.overridden_link_number !== null && ov.overridden_link_number !== undefined ? ov.overridden_link_number : (sub ? (sub.original_link_number || sub.overridden_link_number) : null))
      : (sub ? (sub.original_link_number || sub.overridden_link_number) : ov.overridden_link_number);

    if (linkNum !== null && linkNum !== undefined) {
      const num = parseInt(linkNum, 10);
      if (NON_DAILY_LINK_TRAINS[num]) {
        return { code: NON_DAILY_LINK_TRAINS[num], remarks: ov.reason || '' };
      }
      const rawCat = ov.target_category_id ? parseInt(ov.target_category_id, 10) : null;
      const catId = (rawCat && rawCat !== 4) ? rawCat : (sub ? (sub.staff_cat || sub.target_category_id || 2) : 2);
      const link = links.find(l => l.category_id === catId && l.link_number === num)
        || links.find(l => l.category_id !== 4 && l.link_number === num);
      if (link) {
        if (link.is_rest) return { code: 'R', remarks: ov.reason || '' };
        if (link.train_numbers && link.train_numbers.toUpperCase() !== 'NON DAILY') {
          return { code: formatTrainString(link.train_numbers), remarks: ov.reason || '' };
        }
        if (link.train_numbers && link.train_numbers.toUpperCase() === 'NON DAILY') {
          if (NON_DAILY_LINK_TRAINS[num]) {
            return { code: NON_DAILY_LINK_TRAINS[num], remarks: ov.reason || '' };
          }
          if (dayOfWeek) {
            const nd = nonDaily ? nonDaily.find(n => n.assigned_staff_id === staffId && n.day_of_week && n.day_of_week.toUpperCase().startsWith(dayOfWeek.substring(0, 3))) : null;
            if (nd) return { code: nd.train_number, remarks: nd.remarks || ov.reason || '' };
          }
          return { code: 'NON DAILY', remarks: ov.reason || '' };
        }
      }
    }

    if (ov === direct && ov.reason && ov.reason.toLowerCase().includes('rest')) {
      return { code: 'R', remarks: ov.reason };
    }
  }

  // 1.5. Check multi-day link and multi-day non-daily continuation (2-day & 3-day services)
  if (!ov && overrides) {
    const dMinus1 = new Date(dateStr + 'T12:00:00');
    dMinus1.setDate(dMinus1.getDate() - 1);
    const dMinus1Str = dMinus1.toISOString().split('T')[0];
    const prev1Direct = overrides.find(o => o.staff_id === staffId && o.date === dMinus1Str);
    const prev1Sub = overrides.find(o => o.substitute_staff_id === staffId && o.staff_id !== staffId && o.date === dMinus1Str && o.status !== 'SUBSTITUTE');
    const prev1Ov = (prev1Direct && prev1Direct.status !== 'AVAILABLE_FOR_BOOKING') ? prev1Direct : (prev1Sub || prev1Direct);

    const prev1IsWorked = prev1Ov && (
      prev1Ov === prev1Sub ||
      !['REST', 'SICK', 'LEAVE', 'CR', 'ABSENT', 'AVAILABLE_FOR_BOOKING'].includes(prev1Ov.status)
    );

    if (prev1IsWorked) {
      const prev1TrainStr = prev1Ov.extra_train_no || prev1Ov.reason || (prev1Ov.overridden_link_number ? NON_DAILY_LINK_TRAINS[prev1Ov.overridden_link_number] : '');
      const ndMatch1 = getMultiDayNonDailyMatch(prev1TrainStr);
      if (ndMatch1 && !ndMatch1.isReturn) {
        return {
          code: ndMatch1.returnTrain,
          remarks: `Day 2 Return of ${ndMatch1.outTrain} (${ndMatch1.serviceName}) • ${ndMatch1.via} ➔ ${ndMatch1.to}`,
          multiDayInfo: {
            serviceName: ndMatch1.serviceName,
            dayNumber: 2,
            totalDays: ndMatch1.totalDays,
            dayRole: 'Return Leg',
            trainNo: ndMatch1.returnTrain,
            route: `${ndMatch1.via} ➔ ${ndMatch1.to}`,
            depTime: ndMatch1.retDepTime,
            arrTime: ndMatch1.arrHqTime,
            coaches: ndMatch1.coaches
          }
        };
      }

      if (links) {
        const prev1Link = prev1Ov === prev1Sub
          ? (prev1Ov.original_link_number || prev1Ov.overridden_link_number)
          : (prev1Ov.overridden_link_number !== null && prev1Ov.overridden_link_number !== undefined ? prev1Ov.overridden_link_number : null);
        const rawPrev1Cat = prev1Ov.target_category_id ? parseInt(prev1Ov.target_category_id, 10) : null;
        const prev1Cat = (rawPrev1Cat && rawPrev1Cat !== 4) ? rawPrev1Cat : (prev1Ov === prev1Sub ? (prev1Ov.staff_cat || 2) : 2);
        const setInfo1 = getLinkSetDetails(prev1Cat, prev1Link);
        if (setInfo1 && setInfo1.dayIndexInSet < setInfo1.setLength) {
          const nextLegIndex = setInfo1.dayIndexInSet;
          const nextLegLinkNum = setInfo1.setLinks[nextLegIndex];
          const nextLink = links.find(l => l.category_id === prev1Cat && l.link_number === nextLegLinkNum)
            || links.find(l => l.category_id !== 4 && l.link_number === nextLegLinkNum);
          if (nextLink && nextLink.train_numbers) {
            return { code: formatTrainString(nextLink.train_numbers), remarks: `Day ${nextLegIndex + 1} of Link #${setInfo1.setLinks[0]} (${setInfo1.setLength}-day link set)` };
          }
        }
      }
    }

    const dMinus2 = new Date(dateStr + 'T12:00:00');
    dMinus2.setDate(dMinus2.getDate() - 2);
    const dMinus2Str = dMinus2.toISOString().split('T')[0];
    const prev2Direct = overrides.find(o => o.staff_id === staffId && o.date === dMinus2Str);
    const prev2Sub = overrides.find(o => o.substitute_staff_id === staffId && o.staff_id !== staffId && o.date === dMinus2Str && o.status !== 'SUBSTITUTE');
    const prev2Ov = (prev2Direct && prev2Direct.status !== 'AVAILABLE_FOR_BOOKING') ? prev2Direct : (prev2Sub || prev2Direct);

    const prev2IsWorked = prev2Ov && (
      prev2Ov === prev2Sub ||
      !['REST', 'SICK', 'LEAVE', 'CR', 'ABSENT', 'AVAILABLE_FOR_BOOKING'].includes(prev2Ov.status)
    );

    if (prev2IsWorked) {
      const prev2TrainStr = prev2Ov.extra_train_no || prev2Ov.reason || (prev2Ov.overridden_link_number ? NON_DAILY_LINK_TRAINS[prev2Ov.overridden_link_number] : '');
      const ndMatch2 = getMultiDayNonDailyMatch(prev2TrainStr);
      if (ndMatch2 && !ndMatch2.isReturn && ndMatch2.totalDays === 3) {
        return {
          code: 'AVL',
          arrivalTime: ndMatch2.arrHqTime,
          remarks: `Day 3: Arrived GNT ${ndMatch2.arrHqTime} on ${ndMatch2.returnTrain} • 8h HQ Rest till ${ndMatch2.restTill} • Available for duty`,
          multiDayInfo: {
            serviceName: ndMatch2.serviceName,
            dayNumber: 3,
            totalDays: 3,
            dayRole: 'Arrival & Statutory HQ Rest',
            trainNo: '---',
            route: 'GNT (At Headquarters)',
            arrTime: ndMatch2.arrHqTime,
            restTill: ndMatch2.restTill,
            coaches: '-'
          }
        };
      }

      if (links) {
        const prev2Link = prev2Ov === prev2Sub
          ? (prev2Ov.original_link_number || prev2Ov.overridden_link_number)
          : (prev2Ov.overridden_link_number !== null && prev2Ov.overridden_link_number !== undefined ? prev2Ov.overridden_link_number : null);
        const rawPrev2Cat = prev2Ov.target_category_id ? parseInt(prev2Ov.target_category_id, 10) : null;
        const prev2Cat = (rawPrev2Cat && rawPrev2Cat !== 4) ? rawPrev2Cat : (prev2Ov === prev2Sub ? (prev2Ov.staff_cat || 2) : (prev2Link && prev2Link <= 21 ? 1 : 2));
        const setInfo2 = getLinkSetDetails(prev2Cat, prev2Link);
        if (setInfo2 && setInfo2.dayIndexInSet + 1 < setInfo2.setLength) {
          const leg3Index = setInfo2.dayIndexInSet + 1;
          const leg3LinkNum = setInfo2.setLinks[leg3Index];
          const link3 = links.find(l => l.category_id === prev2Cat && l.link_number === leg3LinkNum)
            || links.find(l => l.category_id !== 4 && l.link_number === leg3LinkNum);
          if (link3 && link3.train_numbers) {
            return { code: formatTrainString(link3.train_numbers), remarks: `Day ${leg3Index + 1} of Link #${setInfo2.setLinks[0]} (${setInfo2.setLength}-day link set)` };
          }
        }
      }
    }
  }

  // 2. Check daily earnings entries
  const earn = dailyEarnings ? dailyEarnings.find(e => e.staff_id === staffId && e.date === dateStr) : null;
  if (earn && earn.duty) {
    const fromEarn = extractTrainsFromText(earn.duty) || formatTrainString(earn.duty);
    if (fromEarn && fromEarn !== 'REST') {
      return { code: fromEarn, remarks: earn.remarks || 'Daily Duty Allotment' };
    }
    if (fromEarn === 'REST') {
      return { code: 'R', remarks: earn.remarks || 'Weekly Rest' };
    }
  }

  // 3. Check duty register
  const reg = dutyRegister ? dutyRegister.find(r => r.staff_id === staffId && r.date === dateStr) : null;
  if (reg) {
    if (reg.train_out) {
      const trainCode = reg.train_out + (reg.train_return ? ` / ${reg.train_return}` : '');
      return { code: formatTrainString(trainCode), remarks: reg.duty_label || reg.notes || '' };
    }
    if (reg.duty_label) {
      return { code: reg.duty_label.trim(), remarks: reg.notes || '' };
    }
  }

  // 4. Check muster records
  const mr = muster ? muster.find(m => m.staff_id === staffId && m.date === dateStr) : null;
  if (mr && mr.code) {
    const cleanCode = mr.code.toUpperCase();
    if (['R', 'CR', 'SICK', 'S', 'CL', 'LAP', 'LHAP', 'CAP', 'L'].includes(cleanCode)) {
      return { code: cleanCode === 'SICK' ? 'S' : cleanCode, remarks: mr.remarks || '' };
    }
  }

  // 5. Default rest
  if (dayOfWeek && staffRestDay && dayOfWeek === staffRestDay) {
    return { code: 'R', remarks: 'Scheduled Weekly Rest' };
  }

  return null;
}

export const COR_REST_DAYS_MAP: Record<number, string> = {
  1: 'MON', 2: 'SUN', 3: 'SAT', 4: 'FRI', 5: 'THU', 6: 'WED', 7: 'TUE',
  8: 'MON', 9: 'SUN', 10: 'SAT', 11: 'FRI', 12: 'THU', 13: 'WED', 14: 'TUE',
  15: 'MON', 16: 'SUN', 17: 'SAT', 18: 'FRI', 19: 'THU', 20: 'WED', 21: 'TUE'
};

export function getCorRestDay(rowPosition: number): string {
  const norm = ((rowPosition - 1) % 21) + 1;
  return COR_REST_DAYS_MAP[norm] || 'MON';
}
