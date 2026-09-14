const { getDayOffset, getBaseLinkNumber } = require('./rotation');

/**
 * Clean helper to parse train numbers
 */
function cleanTrainNumber(trainStr) {
  if (!trainStr || trainStr === 'REST') return 'REST';
  return trainStr
    .split(',')
    .map(t => t.trim().replace(/^PILOT\((.*?)\)$/, '$1'))
    .join('/');
}

/**
 * Generate complete Daily Earnings Sheet for a given date (YYYY-MM-DD)
 */
async function generateDailyEarnings(db, dateStr, categoryId = null) {
  const { get, all } = db;
  if (!dateStr) {
    const today = new Date();
    dateStr = today.toISOString().split('T')[0];
  }

  // Parse Date Info
  const [y, m, d] = dateStr.split('-').map(v => parseInt(v, 10));
  const dObj = new Date(y, m - 1, d);
  const daysOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const dayOfWeek = daysOfWeek[dObj.getDay()];
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

  // 2. Fetch saved daily earnings entries for this date
  const savedEntries = await all(
    'SELECT * FROM daily_earnings_entries WHERE date = ? ORDER BY row_order ASC, id ASC',
    [dateStr]
  );

  const savedMap = new Map();
  if (Array.isArray(savedEntries)) {
    savedEntries.forEach(item => {
      savedMap.set(item.staff_id, item);
    });
  }

  // 3. Assemble all rows with roster duties
  const rows = [];
  let rowIdx = 1;

  for (const staff of staffMembers) {
    // Determine roster duty for this staff member on dateStr
    const dayOffset = getDayOffset(staff.anchor_date, dateStr);
    const override = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, dateStr]);
    const musterRecord = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff.id, dateStr]);

    let activeLink = null;
    let isOverridden = false;
    let dutyText = '';

    if (musterRecord && ['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'SICK', 'CR', 'R', 'O', 'NH'].includes(musterRecord.code.toUpperCase())) {
      activeLink = null;
      isOverridden = true;
      dutyText = `Muster: ${musterRecord.code.toUpperCase()}`;
    } else if (override) {
      activeLink = override.overridden_link_number;
      isOverridden = true;
      if (override.status && override.status !== 'DUTY') {
        dutyText = override.status;
      }
    } else {
      activeLink = getBaseLinkNumber(staff.row_position, dayOffset, staff.cycle_length);
      const d1 = new Date(dateStr);
      d1.setDate(d1.getDate() - 1);
      const prevDateStr = d1.toISOString().split('T')[0];
      const prevOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, prevDateStr]);
      if (prevOverride && (prevOverride.status === 'LEAVE' || prevOverride.status === 'SICK' || prevOverride.status === 'CR')) {
        const prevDayOffset = getDayOffset(staff.anchor_date, prevDateStr);
        const prevLinkNum = getBaseLinkNumber(staff.row_position, prevDayOffset, staff.cycle_length);
        if (activeLink === prevLinkNum + 1 || activeLink === prevLinkNum + 2) {
          activeLink = null;
          isOverridden = true;
          dutyText = 'SPARE (HQ)';
        }
      }
    }

    let fromStation = '';
    let toStation = '';

    if (activeLink !== null) {
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
      if (!linkDef) {
        linkDef = await get(
          `SELECT * FROM links 
           WHERE link_number = ? 
           ORDER BY effective_from ASC LIMIT 1`,
          [activeLink]
        );
      }
      if (linkDef) {
        fromStation = linkDef.from_station || '';
        toStation = linkDef.to_station || '';
        if (linkDef.is_rest === 1) {
          dutyText = 'REST';
        } else {
          dutyText = cleanTrainNumber(linkDef.train_numbers);
        }
      } else {
        dutyText = `Link #${activeLink}`;
      }
    } else if (!dutyText) {
      dutyText = 'REST';
    }

    const saved = savedMap.get(staff.id);

    const twt_nc = saved ? (parseInt(saved.twt_nc, 10) || 0) : 0;
    const twt_fare = saved ? (parseFloat(saved.twt_fare) || 0) : 0;
    const twt_penalty = saved ? (parseFloat(saved.twt_penalty) || 0) : 0;

    const ir_nc = saved ? (parseInt(saved.ir_nc, 10) || 0) : 0;
    const ir_fare = saved ? (parseFloat(saved.ir_fare) || 0) : 0;
    const ir_penalty = saved ? (parseFloat(saved.ir_penalty) || 0) : 0;

    const ubl_nc = saved ? (parseInt(saved.ubl_nc, 10) || 0) : 0;
    const ubl_amt = saved ? (parseFloat(saved.ubl_amt) || 0) : 0;

    const gst = saved ? (parseFloat(saved.gst) || 0) : 0;

    const z652_nc = saved ? (parseInt(saved.z652_nc, 10) || 0) : 0;
    const z652_amt = saved ? (parseFloat(saved.z652_amt) || 0) : 0;

    const oc_nc = saved ? (parseInt(saved.oc_nc, 10) || 0) : 0;
    const oc_amt = saved ? (parseFloat(saved.oc_amt) || 0) : 0;

    const duty = saved && saved.duty !== undefined && saved.duty !== null && saved.duty !== ''
      ? saved.duty
      : dutyText;

    const depot_title = saved && saved.depot_title ? saved.depot_title : 'GNT ATY-1D2';

    // Computed columns
    const nc_eff_nc = twt_nc + ir_nc + ubl_nc;
    const nc_eff_amt = twt_fare + twt_penalty + ir_fare + ir_penalty + ubl_amt;

    const nc_gtot_nc = nc_eff_nc + z652_nc + oc_nc;
    const nc_gtot_amt = nc_eff_amt + gst + z652_amt + oc_amt;

    const fromStnUpper = (fromStation || '').trim().toUpperCase();
    const isRest = duty === 'REST' || staff.name.includes('VACANT');
    const isBookedToDuty = !isRest && (fromStnUpper.includes('GNT') || fromStnUpper === 'HQ' || staff.category_id === 4 || fromStnUpper === '');
    const isOutStation = !isRest && !isBookedToDuty;
    const statusType = isBookedToDuty ? 'BOOKED_TO_DUTY' : (isOutStation ? 'OUT_STATION' : 'REST');

    rows.push({
      id: saved ? saved.id : `temp_${staff.id}`,
      staff_id: staff.id,
      category_id: staff.category_id,
      category_code: staff.cat_code,
      category_name: staff.cat_name,
      staff_name: staff.name,
      designation: staff.designation || 'TTI',
      date: dateStr,
      date_formatted: formattedDate,
      day_of_week: dayOfWeek,
      depot_title,
      from_station: fromStation,
      to_station: toStation,
      is_booked_to_duty: isBookedToDuty,
      is_out_station: isOutStation,
      is_rest: isRest,
      status_type: statusType,
      twt_nc,
      twt_fare,
      twt_penalty,
      ir_nc,
      ir_fare,
      ir_penalty,
      ubl_nc,
      ubl_amt,
      nc_eff_nc,
      nc_eff_amt,
      gst,
      z652_nc,
      z652_amt,
      oc_nc,
      oc_amt,
      nc_gtot_nc,
      nc_gtot_amt,
      duty,
      remarks: saved ? (saved.remarks || '') : '',
      row_order: rowIdx++
    });
  }

  // 4. Calculate Column Totals for Bottom Summary Row
  const totals = {
    twt_nc: rows.reduce((s, r) => s + r.twt_nc, 0),
    twt_fare: rows.reduce((s, r) => s + r.twt_fare, 0),
    twt_penalty: rows.reduce((s, r) => s + r.twt_penalty, 0),
    ir_nc: rows.reduce((s, r) => s + r.ir_nc, 0),
    ir_fare: rows.reduce((s, r) => s + r.ir_fare, 0),
    ir_penalty: rows.reduce((s, r) => s + r.ir_penalty, 0),
    ubl_nc: rows.reduce((s, r) => s + r.ubl_nc, 0),
    ubl_amt: rows.reduce((s, r) => s + r.ubl_amt, 0),
    nc_eff_nc: rows.reduce((s, r) => s + r.nc_eff_nc, 0),
    nc_eff_amt: rows.reduce((s, r) => s + r.nc_eff_amt, 0),
    gst: rows.reduce((s, r) => s + r.gst, 0),
    z652_nc: rows.reduce((s, r) => s + r.z652_nc, 0),
    z652_amt: rows.reduce((s, r) => s + r.z652_amt, 0),
    oc_nc: rows.reduce((s, r) => s + r.oc_nc, 0),
    oc_amt: rows.reduce((s, r) => s + r.oc_amt, 0),
    nc_gtot_nc: rows.reduce((s, r) => s + r.nc_gtot_nc, 0),
    nc_gtot_amt: rows.reduce((s, r) => s + r.nc_gtot_amt, 0),
    total_staff_count: rows.length
  };

  return {
    date: dateStr,
    date_formatted: formattedDate,
    day_of_week: dayOfWeek,
    depot_title: rows.length > 0 ? rows[0].depot_title : 'GNT ATY-1D2',
    category_id: categoryId || 'all',
    rows,
    totals
  };
}

/**
 * Generate monthly earnings breakdown for a single staff member across all days of the month (1..30/31)
 */
async function generateStaffMonthlyEarnings(db, staffId, year, month) {
  const { get, all } = db;
  const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
  if (!staff) throw new Error(`Staff with ID ${staffId} not found`);

  const category = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
  if (!category) throw new Error(`Category for staff ID ${staffId} not found`);

  const y = parseInt(year, 10) || new Date().getFullYear();
  const m = parseInt(month, 10) || (new Date().getMonth() + 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const daysOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const monthStr = String(m).padStart(2, '0');
  const monthName = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long' });

  // Fetch all saved earnings entries for this staff in this month
  const startDateStr = `${y}-${monthStr}-01`;
  const endDateStr = `${y}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

  const savedEntries = await all(
    `SELECT * FROM daily_earnings_entries 
     WHERE staff_id = ? AND date >= ? AND date <= ? 
     ORDER BY date ASC`,
    [staffId, startDateStr, endDateStr]
  );

  const savedMap = new Map();
  if (Array.isArray(savedEntries)) {
    savedEntries.forEach(item => {
      savedMap.set(item.date, item);
    });
  }

  const days = [];
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const dayStr = String(dayNum).padStart(2, '0');
    const dateIso = `${y}-${monthStr}-${dayStr}`;
    const dateFormatted = `${dayStr}-${monthStr}-${y}`;
    const dObj = new Date(y, m - 1, dayNum);
    const dayOfWeek = daysOfWeek[dObj.getDay()];

    // Determine planned roster duty for this day
    const dayOffset = getDayOffset(category.anchor_date, dateIso);
    const override = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, dateIso]);

    let activeLink = null;
    let isOverridden = false;
    let dutyText = '';

    if (override) {
      activeLink = override.overridden_link_number;
      isOverridden = true;
      if (override.status && override.status !== 'DUTY') {
        dutyText = override.status;
      }
    } else {
      activeLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);
      const d1 = new Date(dateIso);
      d1.setDate(d1.getDate() - 1);
      const prevDateStr = d1.toISOString().split('T')[0];
      const prevOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, prevDateStr]);
      if (prevOverride && (prevOverride.status === 'LEAVE' || prevOverride.status === 'SICK' || prevOverride.status === 'CR')) {
        const prevDayOffset = getDayOffset(category.anchor_date, prevDateStr);
        const prevLinkNum = getBaseLinkNumber(staff.row_position, prevDayOffset, category.cycle_length);
        if (activeLink === prevLinkNum + 1 || activeLink === prevLinkNum + 2) {
          activeLink = null;
          isOverridden = true;
          dutyText = 'SPARE (HQ)';
        }
      }
    }

    if (activeLink !== null) {
      let linkDef = await get(
        `SELECT * FROM links 
         WHERE category_id = ? AND link_number = ? AND date(effective_from) <= date(?) AND date(effective_to) >= date(?)
         LIMIT 1`,
        [category.id, activeLink, dateIso, dateIso]
      );
      if (!linkDef) {
        linkDef = await get(
          `SELECT * FROM links 
           WHERE category_id = ? AND link_number = ? 
           ORDER BY effective_from ASC LIMIT 1`,
          [category.id, activeLink]
        );
      }
      if (!linkDef) {
        linkDef = await get(
          `SELECT * FROM links 
           WHERE link_number = ? 
           ORDER BY effective_from ASC LIMIT 1`,
          [activeLink]
        );
      }
      if (linkDef) {
        if (linkDef.is_rest === 1) {
          dutyText = 'REST';
        } else {
          dutyText = cleanTrainNumber(linkDef.train_numbers);
        }
      } else {
        dutyText = `Link #${activeLink}`;
      }
    } else if (!dutyText) {
      dutyText = 'REST';
    }

    const saved = savedMap.get(dateIso);

    const twt_nc = saved ? (parseInt(saved.twt_nc, 10) || 0) : 0;
    const twt_fare = saved ? (parseFloat(saved.twt_fare) || 0) : 0;
    const twt_penalty = saved ? (parseFloat(saved.twt_penalty) || 0) : 0;

    const ir_nc = saved ? (parseInt(saved.ir_nc, 10) || 0) : 0;
    const ir_fare = saved ? (parseFloat(saved.ir_fare) || 0) : 0;
    const ir_penalty = saved ? (parseFloat(saved.ir_penalty) || 0) : 0;

    const ubl_nc = saved ? (parseInt(saved.ubl_nc, 10) || 0) : 0;
    const ubl_amt = saved ? (parseFloat(saved.ubl_amt) || 0) : 0;

    const gst = saved ? (parseFloat(saved.gst) || 0) : 0;

    const z652_nc = saved ? (parseInt(saved.z652_nc, 10) || 0) : 0;
    const z652_amt = saved ? (parseFloat(saved.z652_amt) || 0) : 0;

    const oc_nc = saved ? (parseInt(saved.oc_nc, 10) || 0) : 0;
    const oc_amt = saved ? (parseFloat(saved.oc_amt) || 0) : 0;

    const duty = saved && saved.duty !== undefined && saved.duty !== null && saved.duty !== ''
      ? saved.duty
      : dutyText;

    // Computed columns
    const nc_eff_nc = twt_nc + ir_nc + ubl_nc;
    const nc_eff_amt = twt_fare + twt_penalty + ir_fare + ir_penalty + ubl_amt;

    const nc_gtot_nc = nc_eff_nc + z652_nc + oc_nc;
    const nc_gtot_amt = nc_eff_amt + gst + z652_amt + oc_amt;

    days.push({
      id: saved ? saved.id : `temp_${staff.id}_${dateIso}`,
      staff_id: staff.id,
      category_id: staff.category_id,
      staff_name: staff.name,
      designation: staff.designation || 'TTI',
      date: dateIso,
      date_formatted: dateFormatted,
      day_number: dayNum,
      day_of_week: dayOfWeek,
      depot_title: saved?.depot_title || 'GNT ATY-1D2',
      twt_nc,
      twt_fare,
      twt_penalty,
      ir_nc,
      ir_fare,
      ir_penalty,
      ubl_nc,
      ubl_amt,
      nc_eff_nc,
      nc_eff_amt,
      gst,
      z652_nc,
      z652_amt,
      oc_nc,
      oc_amt,
      nc_gtot_nc,
      nc_gtot_amt,
      duty,
      remarks: saved ? (saved.remarks || '') : '',
      is_rest: duty === 'REST',
      has_earnings: nc_gtot_amt > 0 || nc_gtot_nc > 0
    });
  }

  // Monthly totals
  const totals = {
    twt_nc: days.reduce((s, r) => s + r.twt_nc, 0),
    twt_fare: days.reduce((s, r) => s + r.twt_fare, 0),
    twt_penalty: days.reduce((s, r) => s + r.twt_penalty, 0),
    ir_nc: days.reduce((s, r) => s + r.ir_nc, 0),
    ir_fare: days.reduce((s, r) => s + r.ir_fare, 0),
    ir_penalty: days.reduce((s, r) => s + r.ir_penalty, 0),
    ubl_nc: days.reduce((s, r) => s + r.ubl_nc, 0),
    ubl_amt: days.reduce((s, r) => s + r.ubl_amt, 0),
    nc_eff_nc: days.reduce((s, r) => s + r.nc_eff_nc, 0),
    nc_eff_amt: days.reduce((s, r) => s + r.nc_eff_amt, 0),
    gst: days.reduce((s, r) => s + r.gst, 0),
    z652_nc: days.reduce((s, r) => s + r.z652_nc, 0),
    z652_amt: days.reduce((s, r) => s + r.z652_amt, 0),
    oc_nc: days.reduce((s, r) => s + r.oc_nc, 0),
    oc_amt: days.reduce((s, r) => s + r.oc_amt, 0),
    nc_gtot_nc: days.reduce((s, r) => s + r.nc_gtot_nc, 0),
    nc_gtot_amt: days.reduce((s, r) => s + r.nc_gtot_amt, 0),
    total_days: daysInMonth,
    duty_days_count: days.filter(d => !d.is_rest).length,
    rest_days_count: days.filter(d => d.is_rest).length,
    active_earnings_days: days.filter(d => d.has_earnings).length
  };

  return {
    employee: {
      id: staff.id,
      name: staff.name,
      designation: staff.designation || 'TTI',
      category_id: staff.category_id,
      category_name: category.name,
      category_code: category.code,
      hq_station: staff.hq_station || 'GNT',
      bill_unit: staff.bill_unit || '0910629',
      pf_no: staff.pf_no || '07323475'
    },
    year: y,
    month: m,
    month_name: monthName,
    month_str: monthStr,
    days,
    totals
  };
}

/**
 * Generate Multi-Day Continuous Daily Earnings Register (for a date range or whole month)
 */
async function generateRangeDailyEarnings(db, startDateStr, endDateStr, categoryId = null) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const days = [];

  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const dayData = await generateDailyEarnings(db, dateStr, categoryId);
    days.push(dayData);

    cur.setDate(cur.getDate() + 1);
  }

  // Grand totals across all days
  const grandTotal = {
    twt_nc: days.reduce((s, day) => s + (day.totals?.twt_nc || 0), 0),
    twt_fare: days.reduce((s, day) => s + (day.totals?.twt_fare || 0), 0),
    twt_penalty: days.reduce((s, day) => s + (day.totals?.twt_penalty || 0), 0),
    ir_nc: days.reduce((s, day) => s + (day.totals?.ir_nc || 0), 0),
    ir_fare: days.reduce((s, day) => s + (day.totals?.ir_fare || 0), 0),
    ir_penalty: days.reduce((s, day) => s + (day.totals?.ir_penalty || 0), 0),
    ubl_nc: days.reduce((s, day) => s + (day.totals?.ubl_nc || 0), 0),
    ubl_amt: days.reduce((s, day) => s + (day.totals?.ubl_amt || 0), 0),
    nc_eff_nc: days.reduce((s, day) => s + (day.totals?.nc_eff_nc || 0), 0),
    nc_eff_amt: days.reduce((s, day) => s + (day.totals?.nc_eff_amt || 0), 0),
    gst: days.reduce((s, day) => s + (day.totals?.gst || 0), 0),
    z652_nc: days.reduce((s, day) => s + (day.totals?.z652_nc || 0), 0),
    z652_amt: days.reduce((s, day) => s + (day.totals?.z652_amt || 0), 0),
    oc_nc: days.reduce((s, day) => s + (day.totals?.oc_nc || 0), 0),
    oc_amt: days.reduce((s, day) => s + (day.totals?.oc_amt || 0), 0),
    nc_gtot_nc: days.reduce((s, day) => s + (day.totals?.nc_gtot_nc || 0), 0),
    nc_gtot_amt: days.reduce((s, day) => s + (day.totals?.nc_gtot_amt || 0), 0)
  };

  return {
    start_date: startDateStr,
    end_date: endDateStr,
    days_count: days.length,
    days,
    grandTotal
  };
}

module.exports = {
  generateDailyEarnings,
  generateStaffMonthlyEarnings,
  generateRangeDailyEarnings
};
