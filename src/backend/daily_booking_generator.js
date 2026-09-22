const defaultDb = require('./db');
const { getDayOffset, getBaseLinkNumber } = require('./rotation');

/**
 * Standard known train metadata (departure times, standard route display, return train pairs)
 */
const KNOWN_TRAIN_METADATA = {
  '12747': { depTime: '05:45', route: 'GNT/VKB/GNT', retTrain: '12748', coaches: 'SL / AC' },
  '17201': { depTime: '06:00', route: 'GNT/KZJ/GNT', retTrain: '17202', coaches: 'SL / AC' },
  '17227': { depTime: '06:00', route: 'DHNE/GNT/GNT', retTrain: '12603', coaches: 'SL' },
  '12733': { depTime: '06:00', route: 'TPTY/GNT/SC', retTrain: '12734', coaches: 'AC / SL' },
  '17253': { depTime: '06:15', route: 'GNT/DHNE/GNT', retTrain: '17252', coaches: 'SL' },
  '17239': { depTime: '07:45', route: 'GNT/VSKP/GNT', retTrain: '17240', coaches: 'AC+2S' },
  '12805': { depTime: '08:15', route: 'BZA/GNT/BZA', retTrain: '12806', coaches: 'AC+2S' },
  '12795': { depTime: '09:10', route: 'BZA/SC/BZA', retTrain: '17645', coaches: 'AC+2S' },
  '22882': { depTime: '10:35', route: 'GNT/WADI/GNT', retTrain: '22881', coaches: 'SL / AC' },
  '17228': { depTime: '13:00', route: 'GNT/DHNE/GNT', retTrain: '17227', coaches: 'SL' },
  '17221': { depTime: '13:35', route: 'GNT/WADI/GNT', retTrain: '17222', coaches: 'SL / AC' },
  '20630': { depTime: '14:30', route: 'TPTY/GNT/MAS', retTrain: '20629', coaches: 'VB / AC' },
  '67230': { depTime: '16:25', route: 'GNT/BZA/GTL', retTrain: '17226', coaches: 'AC / SL' },
  '17225': { depTime: '16:25', route: 'BZA/GTL/BZA', retTrain: '17226', coaches: 'AC / SL' },
  '17261': { depTime: '16:30', route: 'GNT/TPTY/GNT', retTrain: '12733', coaches: 'AC / SL' },
  '17251': { depTime: '16:30', route: 'GNT/DHNE/GNT', retTrain: '17252', coaches: 'SL' },
  '12603': { depTime: '16:45', route: 'MAS/GNT/HYB', retTrain: '12604', coaches: 'AC / SL' },
  '17281': { depTime: '17:45', route: 'GNT/BZA/NS', retTrain: '17282', coaches: 'AC / SL' },
  '17252': { depTime: '17:45', route: 'DHNE/GNT/GNT', retTrain: '17252', coaches: 'SL' },
  '17254': { depTime: '17:45', route: 'DHNE/GNT/GNT', retTrain: '17254', coaches: 'AC+SL' },
  '17244': { depTime: '17:45', route: 'VSKP/GNT/GNT', retTrain: '17244', coaches: 'SL' },
  '17625, 17646': { depTime: '17:45', route: 'SC, RAL/RAL, GNT/GNT', retTrain: '17646', coaches: 'SL / AC' },
  '17645, 17626': { depTime: '17:45', route: 'GNT, RAL/RAL, KCG/GNT', retTrain: '17626', coaches: 'AC+SL' },
  '17645': { depTime: '17:45', route: 'SC/GNT/GNT', retTrain: '17645', coaches: 'AC+SL' },
  '17646': { depTime: '17:45', route: 'GNT/RAL/GNT', retTrain: '12796', coaches: 'AC+SL' },
  '17626': { depTime: '17:45', route: 'RAL/KCG/RAL', retTrain: '17625', coaches: 'AC+SL' },
  '17626, 17625': { depTime: '17:45', route: 'RAL/KCG/RAL', retTrain: '17625', coaches: 'AC+SL' },
  '18047': { depTime: '17:45', route: 'BZA/GTL/BZA', retTrain: '18048', coaches: 'AC / SL' },
  '18048, PILOT(12727)': { depTime: '17:45', route: 'BZA/GNT/GNT', retTrain: 'PILOT(12703)', coaches: 'AC / SL' },
  '18048': { depTime: '17:45', route: 'BZA/GNT/GNT', retTrain: 'PILOT(12703)', coaches: 'AC / SL' },
  '17262': { depTime: '19:30', route: 'TPTY/GNT/TPTY', retTrain: '17261', coaches: 'SL / AC' },
  '20629': { depTime: '19:10', route: 'GNT/TPTY/GNT', retTrain: '12733', coaches: 'VB / AC' },
  '17215': { depTime: '22:35', route: 'GNT/DMM/GNT', retTrain: '17216', coaches: 'SL' },
  '17069': { depTime: '22:40', route: 'GNT/TPTY/GNT', retTrain: '17262', coaches: 'SL / AC' },
  '12604': { depTime: '22:40', route: 'GNT/MAS/GNT', retTrain: '12603', coaches: 'AC / SL' },
  '12734': { depTime: '23:10', route: 'GNT/TPTY/GNT', retTrain: '20630', coaches: 'AC / SL' },
  '17243': { depTime: '23:20', route: 'GNT/VSKP/GNT', retTrain: '17244', coaches: 'SL' },
  '17255': { depTime: '23:20', route: 'GNT/KCG/GNT', retTrain: '17256', coaches: 'SL' },
  'SPARE': { depTime: '17:45', route: 'GNT/---/GNT', retTrain: 'SPARE / NON-DAILY', coaches: 'SL / AC' }
};

/**
 * Generate the Daily Amenity Staff Booking Chart / Daily Summary
 * Pulls directly from the Daily Summary Table / daily-view logic
 */
async function generateDailyBookingChart(dbHelper, dateStr, categoryId = null) {
  const get = dbHelper?.get || defaultDb.get;
  const all = dbHelper?.all || defaultDb.all;

  if (!dateStr) {
    const today = new Date();
    dateStr = today.toISOString().split('T')[0];
  }

  // Parse Date Info
  const [y, m, d] = dateStr.split('-').map(v => parseInt(v, 10));
  const dObj = new Date(y, m - 1, d);
  const dayNamesShort = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dayNamesFull = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const dayOfWeekShort = dayNamesShort[dObj.getDay()];
  const dayOfWeekFull = dayNamesFull[dObj.getDay()];
  const formattedDate = `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;

  // 1. Fetch Categories & Staff
  const categories = await all('SELECT * FROM categories ORDER BY id ASC');

  // 2. Fetch Overrides, Muster, and Non-Daily Trains for this date
  const overrides = await all('SELECT * FROM overrides WHERE date = ?', [dateStr]);
  const overrideMap = new Map();
  if (Array.isArray(overrides)) {
    overrides.forEach(ov => overrideMap.set(ov.staff_id, ov));
  }

  const musterRecords = await all('SELECT * FROM muster_records WHERE date = ?', [dateStr]);
  const musterMap = new Map();
  if (Array.isArray(musterRecords)) {
    musterRecords.forEach(mr => musterMap.set(mr.staff_id, mr));
  }

  const nonDailyAssignments = await all(
    'SELECT * FROM non_daily_trains WHERE day_of_week = ?',
    [dayOfWeekFull]
  );
  const nonDailyStaffMap = new Map();
  if (Array.isArray(nonDailyAssignments)) {
    nonDailyAssignments.forEach(nd => {
      if (nd.assigned_staff_id) {
        nonDailyStaffMap.set(nd.assigned_staff_id, nd);
      }
    });
  }

  // Collect all staff duties
  const allStaffDuties = [];

  for (const cat of categories) {
    const staffMembers = await all(
      'SELECT * FROM staff WHERE category_id = ? ORDER BY row_position ASC',
      [cat.id]
    );
    const dayOffset = getDayOffset(cat.anchor_date, dateStr);

    for (const staff of staffMembers) {
      if (!staff.name || staff.name.toUpperCase().includes('VACANT') || staff.name.trim() === 'V' || staff.name.trim() === '(V)') continue;

      const override = overrideMap.get(staff.id);
      const musterRecord = musterMap.get(staff.id);
      const nonDaily = nonDailyStaffMap.get(staff.id);

      // Determine Role Badge
      let roleBadge = 'TTI';
      if (cat.id === 1) roleBadge = 'COR';
      else if (cat.id === 2) roleBadge = staff.designation === 'CTI' ? 'CTI' : (staff.designation?.includes('COR') ? 'COR/SL' : 'TTI');
      else if (cat.id === 3) roleBadge = 'LADIES';
      else if (cat.id === 4) roleBadge = 'LR';

      let activeLink = null;
      let isOverridden = false;
      let status = 'DUTY';
      let substituteStaffId = null;
      let substituteName = null;
      let overrideReason = '';
      let targetCategoryId = null;
      let leaveType = null;

      // A. Muster Check
      let musterCode = null;
      if (musterRecord) {
        musterCode = musterRecord.code.toUpperCase();
        if (['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'OD', 'NH'].includes(musterCode)) {
          status = 'LEAVE';
          isOverridden = true;
          leaveType = musterCode;
          overrideReason = `Muster: ${musterCode}`;
        } else if (musterCode === 'SICK') {
          status = 'SICK';
          isOverridden = true;
          overrideReason = 'Muster: SICK';
        } else if (musterCode === 'CR') {
          status = 'CR';
          isOverridden = true;
          overrideReason = 'Muster: Compensatory Rest (CR)';
        } else if (musterCode === 'R') {
          status = 'REST';
          isOverridden = true;
          overrideReason = 'Muster: Weekly Rest (R)';
        } else if (musterCode === 'O') {
          status = 'ABSENT';
          isOverridden = true;
          overrideReason = 'Muster: Absent (O)';
        }
      }

      // B. Override Check
      if (!musterCode && override) {
        activeLink = override.overridden_link_number;
        isOverridden = true;
        status = override.status || (override.overridden_link_number === null ? 'REST' : 'CHANGED_LINK');
        substituteStaffId = override.substitute_staff_id;
        substituteName = override.substitute_name;
        overrideReason = override.reason || '';
        targetCategoryId = override.target_category_id || (override.status === 'SUBSTITUTE' ? 1 : cat.id);
        leaveType = override.leave_type;
      } else if (!musterCode) {
        activeLink = getBaseLinkNumber(staff.row_position, dayOffset, cat.cycle_length);
      }

      // C. Category 4 Weekly Rest
      if (!override && !musterRecord && cat.id === 4) {
        if ((staff.rest_day && staff.rest_day.toUpperCase() === dayOfWeekShort) ||
            (staff.name && staff.name.toUpperCase().includes(dayOfWeekShort + ' REST'))) {
          status = 'REST';
          activeLink = null;
        }
      }

      // D. Multi-day leave return check
      const d1 = new Date(dateStr);
      d1.setDate(d1.getDate() - 1);
      const prevDateStr = d1.toISOString().split('T')[0];
      const prevOverride = overrideMap.get(staff.id);
      if (prevOverride && ['LEAVE', 'SICK', 'CR'].includes(prevOverride.status)) {
        const prevDayOffset = getDayOffset(staff.anchor_date, prevDateStr);
        const prevLinkNum = getBaseLinkNumber(staff.row_position, prevDayOffset, staff.cycle_length);
        if (activeLink === prevLinkNum + 1 || activeLink === prevLinkNum + 2) {
          status = 'STANDBY';
          overrideReason = 'Available at HQ (Resumed from leave)';
        }
      }

      // Non-Daily Train direct booking
      if (nonDaily && status === 'DUTY') {
        allStaffDuties.push({
          staffId: staff.id,
          name: staff.name,
          designation: staff.designation || 'TTI',
          categoryId: cat.id,
          categoryCode: cat.code,
          roleBadge,
          status: 'DUTY',
          link_number: activeLink,
          train_numbers: nonDaily.train_number,
          from_station: nonDaily.departure_station || 'GNT',
          to_station: nonDaily.arrival_station || '---',
          coaches: nonDaily.coaches || 'SL / AC',
          last_train: nonDaily.last_day_train_number || nonDaily.train_number,
          dep_time: nonDaily.departure_time || '10:00',
          remarks: nonDaily.remarks || 'Non-Daily Service',
          isOverridden,
          isNonDaily: true,
          target_category_id: targetCategoryId
        });
        continue;
      }

      // Regular Link Lookup
      const targetCat = targetCategoryId || cat.id;
      let linkDef = null;
      if (activeLink !== null && status !== 'REST' && status !== 'LEAVE' && status !== 'SICK' && status !== 'CR' && status !== 'ABSENT') {
        linkDef = await get(
          `SELECT * FROM links 
           WHERE category_id = ? AND link_number = ? AND date(effective_from) <= date(?) AND date(effective_to) >= date(?)
           LIMIT 1`,
          [targetCat, activeLink, dateStr, dateStr]
        );
        if (!linkDef) {
          linkDef = await get(
            `SELECT * FROM links 
             WHERE category_id = ? AND link_number = ? 
             ORDER BY effective_from ASC LIMIT 1`,
            [targetCat, activeLink]
          );
        }
      }

      let trainNumbers = 'REST';
      let fromStation = '';
      let toStation = '';
      let coaches = '';
      let lastTrain = '';
      let depTime = '17:45';

      if (linkDef && linkDef.is_rest !== 1 && linkDef.train_numbers && linkDef.train_numbers !== 'REST' && linkDef.train_numbers !== 'OFF') {
        trainNumbers = linkDef.train_numbers;
        fromStation = linkDef.from_station || 'GNT';
        toStation = linkDef.to_station || '---';
        coaches = linkDef.coaches || '';
        lastTrain = linkDef.train_numbers.split(/[,/]/).pop()?.trim() || linkDef.train_numbers;
        if (linkDef.dep && linkDef.dep !== '---') depTime = linkDef.dep;
      } else if (status === 'AVAILABLE_FOR_BOOKING' || (override && override.status === 'AVAILABLE_FOR_BOOKING')) {
        trainNumbers = 'SPARE (HQ)';
        fromStation = 'GNT';
        toStation = 'GNT';
        coaches = '-';
        status = 'STANDBY';
      }

      allStaffDuties.push({
        staffId: staff.id,
        name: staff.name,
        designation: staff.designation || 'TTI',
        categoryId: cat.id,
        categoryCode: cat.code,
        roleBadge,
        status,
        link_number: activeLink,
        original_link_number: (override && override.original_link_number !== null && override.original_link_number !== undefined) ? override.original_link_number : getBaseLinkNumber(staff.row_position, dayOffset, cat.cycle_length),
        train_numbers: trainNumbers,
        from_station: fromStation,
        to_station: toStation,
        coaches,
        last_train: lastTrain,
        dep_time: depTime,
        remarks: overrideReason || (linkDef ? linkDef.set_name : ''),
        isOverridden,
        target_category_id: targetCategoryId,
        leaveType
      });
    }
  }

  // 3. Group Staff into Booked Train Services, Standby, Rest, and Leave Pools
  const trainMap = new Map();
  const standbyStaff = [];
  const restStaff = [];
  const leaveStaff = [];

  allStaffDuties.forEach(s => {
    // Filter by category if requested
    if (categoryId && categoryId !== 'all' && String(s.categoryId) !== String(categoryId)) {
      return;
    }

    if (s.status === 'LEAVE' || s.status === 'SICK' || s.status === 'CR' || s.status === 'ABSENT' || s.leaveType) {
      leaveStaff.push({
        id: s.staffId,
        name: s.name,
        designation: s.designation,
        category_id: s.categoryId,
        category_code: s.categoryCode,
        roleBadge: s.roleBadge,
        status: s.leaveType || s.status,
        remarks: s.remarks || s.status
      });
      return;
    }

    if (s.status === 'REST' || s.isRest || !s.train_numbers || s.train_numbers === 'REST' || s.train_numbers === 'OFF') {
      restStaff.push({
        id: s.staffId,
        name: s.name,
        designation: s.designation,
        category_id: s.categoryId,
        category_code: s.categoryCode,
        roleBadge: s.roleBadge,
        status: 'REST',
        remarks: s.remarks || 'Scheduled Rest'
      });
      return;
    }

    if (s.status === 'AVAILABLE_FOR_BOOKING' || s.status === 'STANDBY' || s.train_numbers === 'SPARE (HQ)') {
      standbyStaff.push({
        id: s.staffId,
        name: s.name,
        designation: s.designation,
        category_id: s.categoryId,
        category_code: s.categoryCode,
        roleBadge: s.roleBadge,
        status: 'STANDBY',
        remarks: s.remarks || 'Available at HQ for booking'
      });
      return;
    }

    // Active Train duty - normalize train group keys
    let tKey = s.train_numbers.trim();
    if (s.categoryId === 4 && (tKey.startsWith('LR-') || tKey.startsWith('LR '))) {
      tKey = '17281';
    } else if (tKey.includes('67230')) {
      tKey = '67230';
    } else if (tKey.includes('18048') && tKey.includes('PILOT')) {
      tKey = '18048, PILOT(12727)';
    } else if (tKey.includes('17625') && tKey.includes('17646')) {
      tKey = '17625, 17646';
    } else if (tKey.includes('17645') && tKey.includes('17626')) {
      tKey = '17645, 17626';
    } else if (tKey.includes('17281') && tKey.includes('17225')) {
      tKey = '17281';
    }

    const primaryTrain = tKey.split(/[,/]/)[0].replace(/PILOT\s*\(/i, '').replace(/\)/g, '').trim();
    const meta = KNOWN_TRAIN_METADATA[tKey] || KNOWN_TRAIN_METADATA[primaryTrain] || {
      depTime: s.dep_time || '17:45',
      route: `${s.from_station || 'GNT'}/${s.to_station || '---'}/GNT`,
      retTrain: s.last_train || primaryTrain
    };

    if (!trainMap.has(tKey)) {
      trainMap.set(tKey, {
        trainNumber: tKey,
        depTime: meta.depTime,
        route: meta.route,
        retTrain: meta.retTrain,
        isSpecial: !!meta.isSpecial,
        coaches: s.coaches || meta.coaches,
        crew: []
      });
    }

    trainMap.get(tKey).crew.push({
      id: s.staffId,
      name: s.name,
      designation: s.designation,
      roleBadge: s.roleBadge,
      categoryId: s.categoryId,
      coachTag: meta.retTrain || s.coaches || '',
      isCancelled: false,
      remarks: s.remarks || ''
    });
  });

  // Convert train map to sorted list by departure time
  const trainBlocks = Array.from(trainMap.values()).sort((a, b) => {
    const parseM = t => {
      if (!t || t === '---') return 9999;
      const m = t.match(/(\d{1,2}):(\d{2})/);
      return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 9999;
    };
    return parseM(a.depTime) - parseM(b.depTime);
  });

  // Calculate 4 Balanced Columns for the print/document grid
  const columns = [[], [], [], []];
  trainBlocks.forEach((block, idx) => {
    columns[idx % 4].push(block);
  });

  // Generate WhatsApp Plain-Text Skeleton
  const totalBookedCrew = trainBlocks.reduce((sum, t) => sum + t.crew.length, 0);

  let whatsappText = `🚆 *SOUTH COAST RAILWAY • GUNTUR DIVISION*\n`;
  whatsappText += `*TENTATIVE AMENITY STAFF BOOKING ON ${dayOfWeekShort} (${formattedDate})*\n`;
  whatsappText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  whatsappText += `📋 *BOOKED TRAIN SERVICES (${trainBlocks.length} Services • ${totalBookedCrew} Staff):*\n\n`;

  trainBlocks.forEach(tb => {
    whatsappText += `🔹 *Train ${tb.trainNumber}* | ${tb.depTime} @ ${tb.route} | Ret: ${tb.retTrain || '-'}\n`;
    tb.crew.forEach(c => {
      const cancelStr = c.isCancelled ? ' ❌ [CANCELLED]' : '';
      whatsappText += `   • ${c.roleBadge}: ${c.name}${c.coachTag ? ` (${c.coachTag})` : ''}${cancelStr}\n`;
    });
    whatsappText += `\n`;
  });

  if (standbyStaff.length > 0) {
    whatsappText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    whatsappText += `🛡️ *STANDBY / SPARE STAFF AT HQ (${standbyStaff.length}):*\n`;
    standbyStaff.forEach(s => {
      whatsappText += ` • ${s.name} (${s.roleBadge}) - ${s.remarks}\n`;
    });
    whatsappText += `\n`;
  }

  if (restStaff.length > 0) {
    whatsappText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    whatsappText += `🛌 *STAFF ON REST (${restStaff.length}):*\n`;
    restStaff.forEach(s => {
      whatsappText += ` • ${s.name} (${s.roleBadge}) - ${s.remarks}\n`;
    });
    whatsappText += `\n`;
  }

  if (leaveStaff.length > 0) {
    whatsappText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    whatsappText += `🏥 *STAFF ON LEAVE / SICK / OD (${leaveStaff.length}):*\n`;
    leaveStaff.forEach(s => {
      whatsappText += ` • ${s.name} (${s.roleBadge}) [${s.status}] - ${s.remarks}\n`;
    });
    whatsappText += `\n`;
  }

  whatsappText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  whatsappText += `📊 *SUMMARY TOTALS:*\n`;
  whatsappText += `Booked: ${totalBookedCrew} | Standby: ${standbyStaff.length} | Rest: ${restStaff.length} | Leave: ${leaveStaff.length} | Total: ${totalBookedCrew + standbyStaff.length + restStaff.length + leaveStaff.length}\n`;
  whatsappText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  whatsappText += `_Generated by Railway Duty Roster Manager_`;

  return {
    zone: 'SOUTH COAST RAILWAY',
    division: 'GUNTUR DIVISION',
    depot_title: 'GNT ATY-1D2',
    date: dateStr,
    date_formatted: formattedDate,
    day_of_week_short: dayOfWeekShort,
    day_of_week_full: dayOfWeekFull,
    title: `TENTATIVE AMENITY STAFF BOOKING ON ${dayOfWeekShort}`,
    train_blocks: trainBlocks,
    columns,
    standby_staff: standbyStaff,
    rest_staff: restStaff,
    leave_staff: leaveStaff,
    summary: {
      total_trains: trainBlocks.length,
      total_booked_crew: totalBookedCrew,
      total_standby: standbyStaff.length,
      total_rest: restStaff.length,
      total_leave: leaveStaff.length,
      grand_total: totalBookedCrew + standbyStaff.length + restStaff.length + leaveStaff.length
    },
    whatsapp_text: whatsappText
  };
}

module.exports = {
  generateDailyBookingChart,
  KNOWN_TRAIN_METADATA
};
