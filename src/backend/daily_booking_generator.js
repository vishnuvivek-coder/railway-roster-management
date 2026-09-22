const { getDayOffset, getBaseLinkNumber } = require('./rotation');
const { getDutyRowsForLinkNumber } = require('./ta_generator');

/**
 * Standard known train metadata (departure times, standard route display, return train pairs)
 */
const KNOWN_TRAIN_METADATA = {
  '12727': { depTime: '06:00', route: 'HYB/BPQ/HYB', retTrain: '12727', coaches: 'AC' },
  '12791': { depTime: '09:25', route: 'SC/BPQ/SC', retTrain: '12772', coaches: 'AC' },
  '12602': { depTime: '06:45', route: 'GQC/BPQ/HYD', retTrain: '12876', coaches: 'AC' },
  '12806': { depTime: '08:15', route: 'SC/BPQ/BCO', retTrain: '12805', coaches: 'AC' },
  '22707': { depTime: '13:45', route: 'SC/BPQ/KZJ', retTrain: 'INST', isSpecial: true, coaches: 'AC / SL' },
  '17207': { depTime: '22:50', route: 'CHZ/BPQ/CHZ', retTrain: '17006', coaches: 'AC / SL' },
  '22717': { depTime: '23:31', route: 'SC/BPQ/KZJ', retTrain: '17023', coaches: 'AC' },
  '12286': { depTime: '23:45', route: 'SC/ATT/SC', retTrain: '12219', coaches: 'AC' },
  '12792': { depTime: '14:55', route: 'HYB/BZA/HYB', retTrain: '22132', coaches: 'AC' },
  '12745': { depTime: '23:45', route: 'SC/MUGR/SC', retTrain: '12746', coaches: 'AC' },
  '11019': { depTime: '00:25', route: 'SC/BZA/SC', retTrain: '12805', coaches: 'AC / SL' },
  '18046': { depTime: '08:40', route: 'CHZ/BZA/HYB', retTrain: '12727', coaches: 'AC' },
  '12728': { depTime: '17:05', route: 'HYB/BZA/HYB', retTrain: '12759', coaches: 'AC' },
  '12760': { depTime: '18:00', route: 'HYB/BZA/SC', retTrain: '11020', coaches: 'AC' },
  '12862': { depTime: '17:05', route: 'SC/GTP/SC', retTrain: '12775', coaches: 'AC' },
  '18520': { depTime: '20:40', route: 'SC/BZA/CHZ', retTrain: '18045', coaches: 'AC / SL' },
  '12706': { depTime: '19:01', route: 'SC/BZA/SC', retTrain: '11020', coaches: 'AC' },
  '12738': { depTime: '20:30', route: 'LPI/RYP/LPI', retTrain: '12737', coaches: 'AC' },
  '17256': { depTime: '21:00', route: 'LPI/BZA/LPI', retTrain: '17255', coaches: 'AC / SL' },
  '12710': { depTime: '22:05', route: 'SC/BZA/SC', retTrain: '12709', coaches: 'AC' },
  '20810': { depTime: '21:40', route: 'CHZ/BZA/SC', retTrain: '11019', coaches: 'AC / SL' },
  '17008': { depTime: '15:00', route: 'HYB/BZA/HYB', retTrain: '17049', coaches: 'AC / SL' },
  '22117': { depTime: '22:45', route: 'HYB/BZA/HYB', retTrain: '12791', coaches: 'AC' },
  '22118': { depTime: '13:05', route: 'SC/MUDP/SC', retTrain: '2086', coaches: 'AC' },
  '20820': { depTime: '14:25', route: 'SC/GNT/SC', retTrain: '20820', coaches: 'AC' },
  '12804': { depTime: '17:20', route: 'CHZ/GNT/CHZ', retTrain: '12803', coaches: 'AC' },
  '12714': { depTime: '17:30', route: 'LPI/GNT/LPI', retTrain: '12733', coaches: 'AC' },
  '12764': { depTime: '18:41', route: 'SC/BZA/SC', retTrain: '20833', coaches: 'AC' },
  '12708': { depTime: '23:45', route: 'CHZ/BZA/CHZ', retTrain: '12787', coaches: 'AC' },
  '17005': { depTime: '24:55', route: 'CHZ/FTP/CHZ', retTrain: 'NST', coaches: 'AC' },
  '17047': { depTime: '07:15', route: 'CHZ/GNT/CHZ', retTrain: 'NST', coaches: 'AC' },
  '17011': { depTime: '04:35', route: 'HYB/SKZR/SC', retTrain: '17012', coaches: 'AC' },
  '17406': { depTime: '05:45', route: 'SC/BZA/SC', retTrain: '12733', coaches: 'AC' },
  '12740': { depTime: '07:45', route: 'SC/GNT/MST', retTrain: '17028', coaches: 'AC' },
  '12717': { depTime: '08:10', route: 'SC/SAZ/SC', retTrain: '12718', coaches: 'AC' },
  '17202': { depTime: '12:30', route: 'SC/GNT/SC', retTrain: '17201', coaches: 'AC / SL' },
  '17230': { depTime: '15:25', route: 'SC/SKZR/SC', retTrain: '17229', coaches: 'AC' },
  '17030': { depTime: '17:15', route: 'HYB/KZJ/HYB', retTrain: '17029', coaches: 'AC' },
  '12776': { depTime: '19:00', route: 'LPI/RYP/SC', retTrain: '12775', coaches: 'AC' },
  '20707': { depTime: '05:00', route: 'SC/VSAP/SC', retTrain: '22701', coaches: 'VB' },
  '12772': { depTime: '00:01', route: 'SC/PIL/SC', retTrain: '12771', coaches: 'AC' },
  '17017': { depTime: '17:20', route: 'CHZ/SKT/SC', retTrain: 'INST', isSpecial: true, coaches: 'AC / SL' },
  // Core Division Trains (Guntur / South Coast Railway)
  '20629': { depTime: '19:10', route: 'GNT/TPTY/GNT', retTrain: '12733', coaches: 'VB / AC' },
  '12734': { depTime: '23:10', route: 'GNT/TPTY/GNT', retTrain: '20630', coaches: 'AC / SL' },
  '12604': { depTime: '22:40', route: 'GNT/MAS/GNT', retTrain: '12603', coaches: 'AC / SL' },
  '17261': { depTime: '16:30', route: 'GNT/TPTY/GNT', retTrain: '12733', coaches: 'AC / SL' },
  '17281': { depTime: '17:45', route: 'GNT/BZA/NS', retTrain: '17282', coaches: 'AC / SL' },
  '67230': { depTime: '16:25', route: 'GNT/BZA/GTL', retTrain: '17226', coaches: 'AC / SL' },
  '17253': { depTime: '06:15', route: 'GNT/DHNE/GNT', retTrain: '17252', coaches: 'SL' },
  '17251': { depTime: '16:30', route: 'GNT/DHNE/GNT', retTrain: '17252', coaches: 'SL' },
  '17215': { depTime: '22:35', route: 'GNT/DMM/GNT', retTrain: '17216', coaches: 'SL' },
  '12747': { depTime: '05:45', route: 'GNT/VKB/GNT', retTrain: '12748', coaches: 'SL / AC' },
  '17201': { depTime: '06:00', route: 'GNT/KZJ/GNT', retTrain: '17202', coaches: 'SL / AC' },
  '17255': { depTime: '23:20', route: 'GNT/KCG/GNT', retTrain: '17256', coaches: 'SL' },
  '17228': { depTime: '13:00', route: 'GNT/DHNE/GNT', retTrain: '17227', coaches: 'SL' },
  '22882': { depTime: '10:35', route: 'GNT/WADI/GNT', retTrain: '22881', coaches: 'SL / AC' },
  '17221': { depTime: '13:35', route: 'GNT/WADI/GNT', retTrain: '17222', coaches: 'SL / AC' },
  '17069': { depTime: '22:40', route: 'GNT/TPTY/GNT', retTrain: '17262', coaches: 'SL / AC' }
};

/**
 * Generate the Daily Amenity Staff Booking Chart / Daily Summary
 */
async function generateDailyBookingChart(db, dateStr, categoryId = null) {
  const { get, all } = db;
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

  // 1. Fetch categories
  let categoryFilter = '';
  const params = [];
  if (categoryId && categoryId !== 'all') {
    categoryFilter = 'WHERE s.category_id = ?';
    params.push(categoryId);
  }

  const staffMembers = await all(
    `SELECT s.*, c.code as cat_code, c.name as cat_name, c.anchor_date, c.cycle_length 
     FROM staff s 
     JOIN categories c ON s.category_id = c.id 
     ${categoryFilter}
     ORDER BY s.category_id ASC, s.row_position ASC`,
    params
  );

  // 2. Fetch overrides & muster for dateStr
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

  // 3. Fetch non-daily train assignments for this day of week
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

  // 4. Data pools
  const trainMap = new Map(); // trainNumber -> { trainNumber, depTime, route, retTrain, isSpecial, crew: [] }
  const standbyStaff = [];
  const restStaff = [];
  const leaveStaff = [];

  for (const staff of staffMembers) {
    if (staff.name.includes('VACANT')) continue;

    const dayOffset = getDayOffset(staff.anchor_date, dateStr);
    const override = overrideMap.get(staff.id);
    const musterRecord = musterMap.get(staff.id);
    const nonDaily = nonDailyStaffMap.get(staff.id);

    // Determine Role Badge
    let roleBadge = 'TTI';
    if (staff.category_id === 1) roleBadge = 'COR';
    else if (staff.category_id === 2) roleBadge = staff.designation === 'CTI' ? 'CTI' : (staff.designation?.includes('COR') ? 'COR/SL' : 'TTI');
    else if (staff.category_id === 3) roleBadge = 'LADIES';
    else if (staff.category_id === 4) roleBadge = 'LR';

    // A. Check Muster Leaves
    if (musterRecord && ['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'SICK', 'CR', 'R', 'O', 'NH'].includes(musterRecord.code.toUpperCase())) {
      const code = musterRecord.code.toUpperCase();
      leaveStaff.push({
        id: staff.id,
        name: staff.name,
        designation: staff.designation || 'TTI',
        category_id: staff.category_id,
        category_code: staff.cat_code,
        roleBadge,
        status: code === 'SICK' ? 'SICK' : code,
        remarks: `Muster: ${code}`
      });
      continue;
    }

    // B. Check Override
    if (override) {
      if (['LEAVE', 'SICK', 'CR', 'ABSENT'].includes(override.status) || override.leave_type) {
        const st = override.leave_type || override.status;
        leaveStaff.push({
          id: staff.id,
          name: staff.name,
          designation: staff.designation || 'TTI',
          category_id: staff.category_id,
          category_code: staff.cat_code,
          roleBadge,
          status: st,
          remarks: override.reason || st
        });
        continue;
      }

      if (override.status === 'REST' || override.overridden_link_number === null) {
        restStaff.push({
          id: staff.id,
          name: staff.name,
          designation: staff.designation || 'TTI',
          category_id: staff.category_id,
          category_code: staff.cat_code,
          roleBadge,
          status: 'REST',
          remarks: override.reason || 'Rest Day'
        });
        continue;
      }

      if (override.status === 'AVAILABLE_FOR_BOOKING' || (override.reason && override.reason.toLowerCase().includes('available for booking'))) {
        standbyStaff.push({
          id: staff.id,
          name: staff.name,
          designation: staff.designation || 'TTI',
          category_id: staff.category_id,
          category_code: staff.cat_code,
          roleBadge,
          status: 'STANDBY',
          remarks: override.reason || 'Available at HQ for booking'
        });
        continue;
      }
    }

    // C. Non-Daily Train direct booking
    if (nonDaily) {
      const tNum = nonDaily.train_number;
      const meta = KNOWN_TRAIN_METADATA[tNum] || {
        depTime: nonDaily.departure_time || '10:00',
        route: `${nonDaily.departure_station || 'GNT'}/${nonDaily.arrival_station || '---'}/GNT`,
        retTrain: nonDaily.last_day_train_number || tNum,
        coaches: nonDaily.coaches || 'SL / AC'
      };

      if (!trainMap.has(tNum)) {
        trainMap.set(tNum, {
          trainNumber: tNum,
          depTime: meta.depTime,
          route: meta.route,
          retTrain: meta.retTrain,
          isSpecial: !!meta.isSpecial,
          coaches: meta.coaches,
          crew: []
        });
      }

      trainMap.get(tNum).crew.push({
        id: staff.id,
        name: staff.name,
        designation: staff.designation || 'TTI',
        roleBadge,
        category_id: staff.category_id,
        coachTag: nonDaily.coaches || meta.retTrain,
        isCancelled: false,
        remarks: nonDaily.remarks || 'Non-Daily Service'
      });
      continue;
    }

    // D. Regular Cyclic Link Calculation
    let activeLink = override && override.overridden_link_number !== undefined
      ? override.overridden_link_number
      : getBaseLinkNumber(staff.row_position, dayOffset, staff.cycle_length);

    // Multi-day leave return check
    const d1 = new Date(dateStr);
    d1.setDate(d1.getDate() - 1);
    const prevDateStr = d1.toISOString().split('T')[0];
    const prevOverride = overrideMap.get(staff.id);
    if (prevOverride && ['LEAVE', 'SICK', 'CR'].includes(prevOverride.status)) {
      const prevDayOffset = getDayOffset(staff.anchor_date, prevDateStr);
      const prevLinkNum = getBaseLinkNumber(staff.row_position, prevDayOffset, staff.cycle_length);
      if (activeLink === prevLinkNum + 1 || activeLink === prevLinkNum + 2) {
        standbyStaff.push({
          id: staff.id,
          name: staff.name,
          designation: staff.designation || 'TTI',
          category_id: staff.category_id,
          category_code: staff.cat_code,
          roleBadge,
          status: 'STANDBY',
          remarks: 'Available at HQ (Resumed from leave)'
        });
        continue;
      }
    }

    // Fetch Link Definition
    let linkDef = await get(
      `SELECT * FROM links 
       WHERE category_id = ? AND link_number = ? AND date(effective_from) <= date(?) AND date(effective_to) >= date(?)
       LIMIT 1`,
      [staff.category_id, activeLink, dateStr, dateStr]
    );
    if (!linkDef) {
      linkDef = await get(
        `SELECT * FROM links 
         WHERE category_id = ? AND link_number = ? 
         ORDER BY effective_from ASC LIMIT 1`,
        [staff.category_id, activeLink]
      );
    }

    if (!linkDef || linkDef.is_rest === 1 || !linkDef.train_numbers || linkDef.train_numbers === 'REST' || linkDef.train_numbers === 'OFF') {
      restStaff.push({
        id: staff.id,
        name: staff.name,
        designation: staff.designation || 'TTI',
        category_id: staff.category_id,
        category_code: staff.cat_code,
        roleBadge,
        status: 'REST',
        remarks: linkDef ? (linkDef.set_name || 'Weekly Rest') : 'Scheduled Rest'
      });
      continue;
    }

    // Resolve duties for this link
    const dutyRows = getDutyRowsForLinkNumber(staff.category_id, activeLink, linkDef);
    const firstLeg = dutyRows.length > 0 ? dutyRows[0] : null;

    if (firstLeg && firstLeg.train_no && firstLeg.train_no !== '---') {
      const tNum = firstLeg.train_no;
      const meta = KNOWN_TRAIN_METADATA[tNum] || {
        depTime: firstLeg.dep || '18:00',
        route: `${firstLeg.from || 'GNT'}/${firstLeg.to || '---'}/GNT`,
        retTrain: linkDef.train_numbers.split(',').pop()?.trim() || tNum,
        coaches: linkDef.coaches || 'AC'
      };

      if (!trainMap.has(tNum)) {
        trainMap.set(tNum, {
          trainNumber: tNum,
          depTime: firstLeg.dep && firstLeg.dep !== '---' ? firstLeg.dep : meta.depTime,
          route: meta.route,
          retTrain: meta.retTrain,
          isSpecial: !!meta.isSpecial,
          coaches: meta.coaches,
          crew: []
        });
      }

      trainMap.get(tNum).crew.push({
        id: staff.id,
        name: staff.name,
        designation: staff.designation || 'TTI',
        roleBadge,
        category_id: staff.category_id,
        coachTag: meta.retTrain || linkDef.coaches || '',
        isCancelled: false,
        remarks: `Link #${activeLink} (${linkDef.set_name || 'Regular Service'})`
      });
    } else {
      standbyStaff.push({
        id: staff.id,
        name: staff.name,
        designation: staff.designation || 'TTI',
        category_id: staff.category_id,
        category_code: staff.cat_code,
        roleBadge,
        status: 'STANDBY',
        remarks: `Link #${activeLink} Standby Duty`
      });
    }
  }

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
