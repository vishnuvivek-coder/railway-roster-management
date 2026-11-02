const { getDayOffset, getBaseLinkNumber, getCategoryParamsForDate } = require('./rotation');

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

  // 1. Fetch staff members with date-aware versioned assignments
  let categoryFilter = '';
  const params = [];
  if (categoryId && categoryId !== 'all') {
    categoryFilter = 'WHERE s.category_id = ?';
    params.push(categoryId);
  }

  let staffMembers = await all(
    `SELECT 
       sra.id as assignment_id,
       COALESCE(sra.staff_id, s.id) as id,
       sra.staff_name as name,
       COALESCE(sra.designation, s.designation, '') as designation,
       COALESCE(sra.category_id, s.category_id) as category_id,
       sra.row_position,
       COALESCE(sra.rest_day, s.rest_day) as rest_day,
       COALESCE(sra.pf_no, s.pf_no) as pf_no,
       COALESCE(s.active, 1) as active,
       s.hq_station,
       c.code as cat_code,
       c.name as cat_name
     FROM staff_roster_assignments sra
     LEFT JOIN staff s ON sra.staff_id = s.id
     JOIN categories c ON COALESCE(sra.category_id, s.category_id) = c.id
     WHERE date(sra.effective_from) <= date(?)
       AND (sra.effective_to IS NULL OR date(sra.effective_to) >= date(?))
       ${categoryId && categoryId !== 'all' ? 'AND sra.category_id = ?' : ''}
     ORDER BY sra.category_id ASC, sra.row_position ASC`,
    categoryId && categoryId !== 'all' ? [dateStr, dateStr, categoryId] : [dateStr, dateStr]
  );

  if (!staffMembers || staffMembers.length === 0) {
    staffMembers = await all(
      `SELECT s.*, c.code as cat_code, c.name as cat_name, c.anchor_date, c.cycle_length 
       FROM staff s 
       JOIN categories c ON s.category_id = c.id 
       ${categoryFilter}
       ORDER BY s.category_id ASC, s.row_position ASC`,
      params
    );
  }

  // 2. Fetch saved entries, overrides, muster, lr_sheet, and links in parallel
  const dPrev = new Date(dObj);
  dPrev.setDate(dPrev.getDate() - 1);
  const prevDateStr = dPrev.toISOString().split('T')[0];

  const [savedEntries, dateOverrides, dateMuster, dateLr, allPublishedLinks] = await Promise.all([
    all(
      'SELECT * FROM daily_earnings_entries WHERE date = ? ORDER BY row_order ASC, id ASC',
      [dateStr]
    ),
    all('SELECT * FROM overrides WHERE date >= ? AND date <= ?', [prevDateStr, dateStr]),
    all('SELECT * FROM muster_records WHERE date = ?', [dateStr]),
    all('SELECT * FROM lr_sheet_records WHERE date = ?', [dateStr]),
    all(`SELECT * FROM links 
         WHERE (status = 'published' OR status IS NULL OR status = '') 
           AND (status != 'draft')
           AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = 'published' OR status IS NULL))`)
  ]);

  const savedMap = new Map();
  if (Array.isArray(savedEntries)) {
    savedEntries.forEach(item => {
      savedMap.set(item.staff_id, item);
    });
  }

  // Pre-index overrides, muster, and LR sheet for O(1) in-memory lookups
  const directOvMap = new Map();
  const subOvMap = new Map();
  if (Array.isArray(dateOverrides)) {
    dateOverrides.forEach(ov => {
      if (ov.staff_id) directOvMap.set(`${ov.staff_id}_${ov.date}`, ov);
      if (ov.substitute_staff_id) subOvMap.set(`${ov.substitute_staff_id}_${ov.date}`, ov);
    });
  }

  const musterMap = new Map();
  if (Array.isArray(dateMuster)) {
    dateMuster.forEach(m => musterMap.set(m.staff_id, m));
  }

  const lrMap = new Map();
  if (Array.isArray(dateLr)) {
    dateLr.forEach(l => lrMap.set(l.staff_id, l));
  }

  // 3. Assemble all rows with roster duties (ZERO in-loop DB queries)
  const rows = [];
  let rowIdx = 1;

  for (const staff of staffMembers) {
    // Determine roster duty for this staff member on dateStr using date-aware cycle parameters
    const catParams = getCategoryParamsForDate(staff.category_id, dateStr);
    const dayOffset = getDayOffset(catParams.anchor_date, dateStr);
    const override = directOvMap.get(`${staff.id}_${dateStr}`);
    const subOverride = subOvMap.get(`${staff.id}_${dateStr}`);
    const musterRecord = musterMap.get(staff.id);
    const lrRecord = staff.category_id === 4 ? lrMap.get(staff.id) : null;

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
      if (override.extra_train_no) {
        dutyText = override.extra_train_no;
      } else if (override.advance_train_no) {
        dutyText = override.advance_train_no;
      } else if (override.status && override.status !== 'DUTY' && override.status !== 'CHANGED_LINK' && override.status !== 'SUBSTITUTE') {
        dutyText = override.leave_type || override.status;
      }
    } else if (subOverride && subOverride.status !== 'AVAILABLE_FOR_BOOKING') {
      activeLink = subOverride.overridden_link_number !== null && subOverride.overridden_link_number !== undefined
        ? subOverride.overridden_link_number
        : subOverride.original_link_number;
      isOverridden = true;
      if (!activeLink) {
        dutyText = subOverride.extra_train_no || 'SUBSTITUTE';
      }
    } else if (lrRecord && lrRecord.duty_code) {
      activeLink = null;
      isOverridden = true;
      dutyText = lrRecord.duty_code === 'R' ? 'REST' : lrRecord.duty_code;
    } else if (staff.category_id === 4) {
      activeLink = null;
      dutyText = 'SPARE (HQ)';
    } else {
      activeLink = getBaseLinkNumber(staff.row_position, dayOffset, catParams.cycle_length);
      const prevOverride = directOvMap.get(`${staff.id}_${prevDateStr}`);
      if (prevOverride && (prevOverride.status === 'LEAVE' || prevOverride.status === 'SICK' || prevOverride.status === 'CR')) {
        const prevCatParams = getCategoryParamsForDate(staff.category_id, prevDateStr);
        const prevDayOffset = getDayOffset(prevCatParams.anchor_date, prevDateStr);
        const prevLinkNum = getBaseLinkNumber(staff.row_position, prevDayOffset, prevCatParams.cycle_length);
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
      let linkDef = allPublishedLinks.find(l =>
        parseInt(l.category_id, 10) === staff.category_id &&
        parseInt(l.link_number, 10) === activeLink &&
        (!l.effective_from || l.effective_from <= dateStr) &&
        (!l.effective_to || l.effective_to >= dateStr)
      );
      if (!linkDef) {
        linkDef = allPublishedLinks.find(l =>
          parseInt(l.category_id, 10) === staff.category_id &&
          parseInt(l.link_number, 10) === activeLink
        );
      }
      if (!linkDef) {
        linkDef = allPublishedLinks.find(l =>
          parseInt(l.link_number, 10) === activeLink &&
          parseInt(l.category_id, 10) !== 4
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
    }

    if (!dutyText) {
      dutyText = 'SPARE (HQ)';
    }

    // Merge saved data or fallback to defaults
    const saved = savedMap.get(staff.id);

    rows.push({
      id: staff.id,
      row_order: saved?.row_order || rowIdx++,
      name: staff.name,
      designation: staff.designation,
      category_name: staff.cat_name,
      category_code: staff.cat_code,
      duty: saved?.duty || dutyText,
      from_station: saved?.from_station || fromStation,
      to_station: saved?.to_station || toStation,
      twt_nc: saved ? saved.twt_nc : 0,
      twt_fare: saved ? saved.twt_fare : 0,
      twt_penalty: saved ? saved.twt_penalty : 0,
      ir_nc: saved ? saved.ir_nc : 0,
      ir_fare: saved ? saved.ir_fare : 0,
      ir_penalty: saved ? saved.ir_penalty : 0,
      ubl_nc: saved ? saved.ubl_nc : 0,
      ubl_amt: saved ? saved.ubl_amt : 0,
      nc_eff_nc: saved ? saved.nc_eff_nc : 0,
      nc_eff_amt: saved ? saved.nc_eff_amt : 0,
      gst: saved ? saved.gst : 0,
      z652_nc: saved ? saved.z652_nc : 0,
      z652_amt: saved ? saved.z652_amt : 0,
      oc_nc: saved ? saved.oc_nc : 0,
      oc_amt: saved ? saved.oc_amt : 0,
      nc_gtot_nc: saved ? saved.nc_gtot_nc : 0,
      nc_gtot_amt: saved ? saved.nc_gtot_amt : 0,
      remarks: saved ? saved.remarks : '',
      is_modified: false
    });
  }

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
  const rawStaff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
  if (!rawStaff) {
    return {
      notFound: true,
      employee: { id: staffId, name: 'Staff Member Removed', designation: '' },
      rows: [],
      year,
      month
    };
  }

  const y = parseInt(year, 10) || new Date().getFullYear();
  const m = parseInt(month, 10) || (new Date().getMonth() + 1);
  const monthFirstDay = `${y}-${String(m).padStart(2, '0')}-01`;

  const assignment = await get(`
    SELECT * FROM staff_roster_assignments
    WHERE staff_id = ?
      AND date(effective_from) <= date(?)
      AND (effective_to IS NULL OR date(effective_to) >= date(?))
    LIMIT 1
  `, [staffId, monthFirstDay, monthFirstDay]);

  const staff = assignment ? {
    ...rawStaff,
    row_position: assignment.row_position,
    category_id: assignment.category_id || rawStaff.category_id,
    designation: assignment.designation || rawStaff.designation,
    rest_day: assignment.rest_day || rawStaff.rest_day
  } : rawStaff;

  const category = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
  if (!category) {
    return {
      notFound: true,
      employee: staff,
      rows: [],
      year,
      month
    };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

    const daysInMonth = new Date(y, m, 0).getDate();
  const daysOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const monthStr = String(m).padStart(2, '0');
  const monthName = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long' });

  const isCurrentMonth = (y === currentYear && m === currentMonth);
  const isFutureMonth = (y > currentYear || (y === currentYear && m > currentMonth));

  // Determine up-to-date cutoff: do not show estimation for the whole month
  const maxDay = isCurrentMonth ? Math.min(daysInMonth, currentDay) : (isFutureMonth ? 0 : daysInMonth);

  if (isFutureMonth) {
    return {
      employee: {
        id: staff.id,
        name: staff.name,
        designation: staff.designation || 'TTI',
        category_name: category.name,
        category_code: category.code,
        category_id: staff.category_id
      },
      year: y,
      month: m,
      month_name: monthName,
      days: [],
      totals: {
        twt_nc: 0,
        twt_fare: 0,
        twt_penalty: 0,
        ir_nc: 0,
        ir_fare: 0,
        ir_penalty: 0,
        ubl_nc: 0,
        ubl_amt: 0,
        nc_eff_nc: 0,
        nc_eff_amt: 0,
        gst: 0,
        z652_nc: 0,
        z652_amt: 0,
        oc_nc: 0,
        oc_amt: 0,
        nc_gtot_nc: 0,
        nc_gtot_amt: 0,
        total_days: 0,
        duty_days_count: 0,
        rest_days_count: 0,
        active_earnings_days: 0
      }
    };
  }

  // Fetch saved earnings entries, overrides, and links concurrently
  const startDateStr = `${y}-${monthStr}-01`;
  const endDateStr = `${y}-${monthStr}-${String(maxDay > 0 ? maxDay : 1).padStart(2, '0')}`;

  const dPrevMonth = new Date(y, m - 1, 1);
  dPrevMonth.setDate(dPrevMonth.getDate() - 1);
  const lookbackStartStr = dPrevMonth.toISOString().split('T')[0];

  const [savedEntries, staffOverrides, allPublishedLinks] = await Promise.all([
    all(
      `SELECT * FROM daily_earnings_entries 
       WHERE staff_id = ? AND date >= ? AND date <= ? 
       ORDER BY date ASC`,
      [staffId, startDateStr, endDateStr]
    ),
    all(
      'SELECT * FROM overrides WHERE staff_id = ? AND date >= ? AND date <= ?',
      [staffId, lookbackStartStr, endDateStr]
    ),
    all(`SELECT * FROM links 
         WHERE (status = 'published' OR status IS NULL OR status = '') 
           AND (status != 'draft')
           AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = 'published' OR status IS NULL))`)
  ]);

  const savedMap = new Map();
  if (Array.isArray(savedEntries)) {
    savedEntries.forEach(item => {
      savedMap.set(item.date, item);
    });
  }

  const ovMap = new Map();
  if (Array.isArray(staffOverrides)) {
    staffOverrides.forEach(ov => ovMap.set(ov.date, ov));
  }

  const days = [];
  for (let dayNum = 1; dayNum <= maxDay; dayNum++) {
    const dayStr = String(dayNum).padStart(2, '0');
    const dateIso = `${y}-${monthStr}-${dayStr}`;
    const dateFormatted = `${dayStr}-${monthStr}-${y}`;
    const dObj = new Date(y, m - 1, dayNum);
    const dayOfWeek = daysOfWeek[dObj.getDay()];

    // Determine planned roster duty for this day (ZERO in-loop DB queries)
    const catParams = getCategoryParamsForDate(category, dateIso);
    const dayOffset = getDayOffset(catParams.anchor_date, dateIso);
    const override = ovMap.get(dateIso);

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
      activeLink = getBaseLinkNumber(staff.row_position, dayOffset, catParams.cycle_length);
      const d1 = new Date(dateIso);
      d1.setDate(d1.getDate() - 1);
      const prevDateStr = d1.toISOString().split('T')[0];
      const prevOverride = ovMap.get(prevDateStr);
      if (prevOverride && (prevOverride.status === 'LEAVE' || prevOverride.status === 'SICK' || prevOverride.status === 'CR')) {
        const prevCatParams = getCategoryParamsForDate(category, prevDateStr);
        const prevDayOffset = getDayOffset(prevCatParams.anchor_date, prevDateStr);
        const prevLinkNum = getBaseLinkNumber(staff.row_position, prevDayOffset, prevCatParams.cycle_length);
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
      let linkDef = allPublishedLinks.find(l =>
        parseInt(l.category_id, 10) === staff.category_id &&
        parseInt(l.link_number, 10) === activeLink &&
        (!l.effective_from || l.effective_from <= dateIso) &&
        (!l.effective_to || l.effective_to >= dateIso)
      );
      if (!linkDef) {
        linkDef = allPublishedLinks.find(l =>
          parseInt(l.category_id, 10) === staff.category_id &&
          parseInt(l.link_number, 10) === activeLink
        );
      }
      if (!linkDef) {
        linkDef = allPublishedLinks.find(l =>
          parseInt(l.link_number, 10) === activeLink &&
          parseInt(l.category_id, 10) !== 4
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
    }

    if (!dutyText) {
      dutyText = 'SPARE (HQ)';
    }

    const saved = savedMap.get(dateIso);

    days.push({
      date: dateIso,
      date_formatted: dateFormatted,
      day_of_week: dayOfWeek,
      duty: saved?.duty || dutyText,
      from_station: saved?.from_station || fromStation,
      to_station: saved?.to_station || toStation,
      twt_nc: saved ? saved.twt_nc : 0,
      twt_fare: saved ? saved.twt_fare : 0,
      twt_penalty: saved ? saved.twt_penalty : 0,
      ir_nc: saved ? saved.ir_nc : 0,
      ir_fare: saved ? saved.ir_fare : 0,
      ir_penalty: saved ? saved.ir_penalty : 0,
      ubl_nc: saved ? saved.ubl_nc : 0,
      ubl_amt: saved ? saved.ubl_amt : 0,
      nc_eff_nc: saved ? saved.nc_eff_nc : 0,
      nc_eff_amt: saved ? saved.nc_eff_amt : 0,
      gst: saved ? saved.gst : 0,
      z652_nc: saved ? saved.z652_nc : 0,
      z652_amt: saved ? saved.z652_amt : 0,
      oc_nc: saved ? saved.oc_nc : 0,
      oc_amt: saved ? saved.oc_amt : 0,
      nc_gtot_nc: saved ? saved.nc_gtot_nc : 0,
      nc_gtot_amt: saved ? saved.nc_gtot_amt : 0,
      remarks: saved ? saved.remarks : '',
      is_rest: dutyText === 'REST' || (saved && saved.duty === 'REST'),
      has_earnings: saved ? (saved.nc_gtot_amt > 0 || saved.nc_gtot_nc > 0) : false
    });
  }

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
    total_days: maxDay,
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
      bill_unit: (staff.bill_unit && staff.bill_unit !== '0910629') ? String(staff.bill_unit) : '',
      pf_no: (staff.pf_no && staff.pf_no !== '07323475') ? String(staff.pf_no) : ''
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

export {
  generateDailyEarnings,
  generateStaffMonthlyEarnings,
  generateRangeDailyEarnings
};

