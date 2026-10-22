import { get, all, run } from '../db';
import { getDayOffset, getBaseLinkNumber } from '../rotation';
import { ApiError } from '../utils/api_error';
import {
  getActiveLinkDef,
  getCategoryParamsForDate,
  getLinkSetDetails,
  checkMultiDayLeaveReturn,
  getMultiDayNonDailyMatch,
  getStaffLastDutyAndRestStatus,
  calculateStaffCrBalances
} from './helpers.service';
import { findScheduledRestDate, computeRestAdjustment } from '../restAdjustment';
import { compareDutyAndResolve, isRestString } from '../duty_comparator';
import { logAudit } from './audit.service';


export async function getRosterGrid(query: any) {
  const category_id = query.category_id || query.categoryId;
  const year = query.year;
  const month = query.month;
  const start_date = query.start_date || query.startDate;
  const end_date = query.end_date || query.endDate;
  if (!start_date && (!year || !month)) {
    throw new ApiError(400, 'Date parameters are required' );
  }
    const isAllCategories = (!category_id || String(category_id).toUpperCase() === 'ALL');
    let category = null;
    let categoriesList = [];
    if (isAllCategories) {
      categoriesList = await all('SELECT * FROM categories ORDER BY id ASC');
      category = { id: 'ALL', name: 'All Categories', anchor_date: '2020-01-01', cycle_length: 21 };
    } else {
      category = await get('SELECT * FROM categories WHERE id = ?', [category_id]);
      if (!category) {
        throw new ApiError(404, 'Category not found' );
      }
      categoriesList = [category];
    }

    const staffMembers = isAllCategories
      ? await all('SELECT * FROM staff WHERE (active = 1 OR active IS NULL) AND category_id IS NOT NULL ORDER BY category_id ASC, row_position ASC')
      : await all('SELECT * FROM staff WHERE category_id = ? AND (active = 1 OR active IS NULL) ORDER BY row_position ASC', [category_id]);

    const crBalances = await calculateStaffCrBalances();

    // Determine start and end dates
    let startDate = start_date;
    let endDate = end_date;

    if (!startDate || !endDate) {
      const y = parseInt(year, 10) || new Date().getFullYear();
      const m = parseInt(month, 10) || (new Date().getMonth() + 1);
      const numDays = new Date(y, m, 0).getDate();
      startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      endDate = `${y}-${String(m).padStart(2, '0')}-${String(numDays).padStart(2, '0')}`;
    }

    // Ensure valid chronological order
    if (startDate > endDate) {
      const temp = startDate;
      startDate = endDate;
      endDate = temp;
    }

    // Get all overrides and muster records for staff members in this category during this date range
    const staffIdsList = staffMembers.map(s => s.id).join(',');

    let overrides = [];
    let musterRecords = [];
    let lrRecords = [];
    let earningsList = [];
    let dutyRegisterEntries = [];
    let nonDailyTrains = [];
    let allLinks = [];

    if (staffMembers.length > 0) {
      allLinks = await all(`
        SELECT * FROM links 
        WHERE (status = 'published' OR status IS NULL OR status = '') 
          AND (status != 'draft')
          AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = 'published' OR status IS NULL))
      `);


      // Load direct overrides AND substitute overrides
      overrides = await all(
        `SELECT o.*, s1.name as regular_staff_name, s1.category_id as regular_staff_category
         FROM overrides o
         LEFT JOIN staff s1 ON o.staff_id = s1.id
         WHERE (o.staff_id IN (${staffIdsList}) OR o.substitute_staff_id IN (${staffIdsList}))
           AND date(o.date) >= date(?) AND date(o.date) <= date(?)`,
        [startDate, endDate]
      );

      musterRecords = await all(
        `SELECT * FROM muster_records 
         WHERE staff_id IN (${staffIdsList}) 
           AND date(date) >= date(?) AND date(date) <= date(?)`,
        [startDate, endDate]
      );

      lrRecords = await all(
        `SELECT * FROM lr_sheet_records
         WHERE staff_id IN (${staffIdsList})
           AND date >= ? AND date <= ?`,
        [startDate, endDate]
      );

      earningsList = await all(
        `SELECT * FROM daily_earnings_entries
         WHERE staff_id IN (${staffIdsList})
           AND date >= ? AND date <= ?`,
        [startDate, endDate]
      );

      dutyRegisterEntries = await all(
        `SELECT dre.*, drs.staff_id
         FROM duty_register_entry dre
         JOIN duty_register_staff drs ON dre.id = drs.entry_id
         WHERE drs.staff_id IN (${staffIdsList})
           AND dre.date >= ? AND dre.date <= ?`,
        [startDate, endDate]
      );

      nonDailyTrains = await all('SELECT * FROM non_daily_trains');
    }

    // Index muster records by staff_id + date
    const musterMap = {};
    musterRecords.forEach(m => {
      musterMap[`${m.staff_id}_${m.date}`] = m;
    });

    // Index direct overrides and substitute overrides
    const directOverrideMap = {};
    const subOverrideMap = {};
    overrides.forEach(o => {
      if (o.staff_id) {
        directOverrideMap[`${o.staff_id}_${o.date}`] = o;
      }
      if (o.substitute_staff_id) {
        subOverrideMap[`${o.substitute_staff_id}_${o.date}`] = o;
      }
    });

    // Index lr records
    const lrMap = {};
    lrRecords.forEach(r => {
      lrMap[`${r.staff_id}_${r.date}`] = r;
    });

    // Index daily earnings
    const earningsMap = {};
    earningsList.forEach(e => {
      earningsMap[`${e.staff_id}_${e.date}`] = e;
    });

    // Index duty register
    const dutyRegisterMap = {};
    dutyRegisterEntries.forEach(d => {
      dutyRegisterMap[`${d.staff_id}_${d.date}`] = d;
    });

    const dates = [];
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const [sy, sm, sd] = startDate.split('-').map(Number);
    const [ey, em, ed] = endDate.split('-').map(Number);
    const curDate = new Date(sy, sm - 1, sd);
    const stopDate = new Date(ey, em - 1, ed);

    // Limit to max 180 days to protect memory / performance
    let dayCount = 0;
    while (curDate <= stopDate && dayCount < 180) {
      dayCount++;
      const y = curDate.getFullYear();
      const m = String(curDate.getMonth() + 1).padStart(2, '0');
      const d = String(curDate.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const catForAnchor = (category.id === 2 ? getCategoryParamsForDate(category, dateStr) : category);
      dates.push({
        dayOfMonth: curDate.getDate(),
        dateString: dateStr,
        dayOfWeek: weekdayNames[curDate.getDay()],
        dayOffset: getDayOffset(catForAnchor.anchor_date, dateStr)
      });
      curDate.setDate(curDate.getDate() + 1);
    }

    // Build the grid
    const gridRows = [];
    for (const staff of staffMembers) {
      const staffCat = categoriesList.find(c => c.id === staff.category_id) || category;
      const isCat4Category = staff.category_id === 4;
      const currentCatId = staff.category_id;

      const rowCells = [];
      let lastAssignedLink = null;
      let lastTargetCat = null;
      let lastAssignedNonDaily = null;

      for (const d of dates) {
        const { anchor_date: curAnchorDate, cycle_length: curCycleLength } = getCategoryParamsForDate(staffCat, d.dateString);
        const staffDayOffset = getDayOffset(curAnchorDate, d.dateString);
        const key = `${staff.id}_${d.dateString}`;
        const muster = musterMap[key];
        const directOv = directOverrideMap[key];
        const subOv = subOverrideMap[key];
        const lrRec = lrMap[key];
        const earn = earningsMap[key];
        const dreg = dutyRegisterMap[key];

        let linkNum = null;
        let targetCatId = isCat4Category ? 1 : currentCatId;
        let isOverridden = false;
        let status = 'DUTY';
        let substituteStaffId = null;
        let substituteName = null;
        let overrideReason = '';
        let leaveType = null;
        let musterCode = muster ? muster.code.toUpperCase() : null;
        let isRest = false;
        let customTrainNo = null;
        let customFrom = null;
        let customTo = null;
        let customCoaches = null;
        let customSetType = null;

        if (isCat4Category) {
          // ==========================================
          // LR STAFF FULL DUTY RESOLVER (Category 4)
          // ==========================================
          const dayNameUpper = d.dayOfWeek.toUpperCase();
          const isScheduledWeeklyRestDay = Boolean(
            (staff.rest_day && staff.rest_day.toUpperCase() === dayNameUpper) ||
            (staff.name && staff.name.toUpperCase().includes(dayNameUpper + ' REST'))
          );

          const hasDirectActiveDuty = Boolean(
            directOv && (
              (directOv.overridden_link_number !== null && directOv.overridden_link_number !== undefined) ||
              directOv.extra_train_no ||
              directOv.advance_train_no ||
              directOv.status === 'EXTRA_CREW' ||
              directOv.status === 'UTILISED_ADVANCE' ||
              (directOv.status === 'SHIFTED' && directOv.shifted_place && directOv.shifted_place !== 'AVAILABLE_AT_HQ')
            )
          );
          const hasSubActiveDuty = Boolean(
            subOv && subOv.staff_id !== staff.id && subOv.status !== 'SUBSTITUTE'
          );
          const hasActiveOverrideDuty = hasDirectActiveDuty || hasSubActiveDuty;
          // 1. Leave Reserve (LR) Sheet record (Primary source of truth for Category 4)
          if (lrRec && lrRec.duty_code && lrRec.duty_code.trim() !== '') {
            const code = lrRec.duty_code.trim();
            const upper = code.toUpperCase();
            const remarks = lrRec.remarks || '';
            isOverridden = true;
            overrideReason = remarks;

            if (upper === 'R' || upper === 'REST') {
              status = 'REST';
              isRest = true;
              customTrainNo = 'REST';
              customSetType = 'Weekly Rest';
              overrideReason = remarks || 'LR Sheet: Weekly Rest';
            } else if (upper === 'S' || upper === 'SICK') {
              status = 'SICK';
              isRest = true;
              leaveType = 'SICK';
              customTrainNo = 'SICK';
              customSetType = 'Sick / Medical';
              overrideReason = remarks || 'LR Sheet: Sick';
            } else if (upper.startsWith('CR')) {
              status = 'CR';
              isRest = true;
              leaveType = 'CR';
              customTrainNo = 'CR';
              customSetType = 'Compensatory Rest';
              overrideReason = remarks || `LR Sheet: ${code}`;
            } else if (upper === 'O' || upper === 'ABSENT') {
              status = 'ABSENT';
              isRest = true;
              customTrainNo = 'ABSENT';
              customSetType = 'Absent';
              overrideReason = remarks || 'LR Sheet: Absent';
            } else if (['CL', 'LAP', 'LHAP', 'CCL', 'SCL', 'OD', 'NH', 'L', 'CAP'].includes(upper)) {
              status = 'LEAVE';
              isRest = true;
              leaveType = (upper === 'L' || upper === 'CAP') ? 'LAP' : upper;
              customTrainNo = leaveType;
              customSetType = 'Leave';
              overrideReason = remarks || `LR Sheet: ${code}`;
            } else if (['AVL', 'SPARE', 'REST_HQ', 'STANDBY', 'AVAILABLE', 'P'].includes(upper)) {
              status = 'AVAILABLE_FOR_BOOKING';
              isRest = true;
              customTrainNo = 'SPARE (HQ)';
              customSetType = 'Spare / HQ';
              overrideReason = remarks || 'LR Sheet: Available at HQ';
            } else {
              // Working Train or Link duty as recorded in LR Sheet
              isRest = false;
              customTrainNo = code;

              const linkMatch = code.match(/^(?:(?:COR|SL|CONDUCTOR|SLEEPER)\s*)?(?:LINK|L)[\s#-]*(\d+)$/i)
                || (remarks ? remarks.match(/Link\s*#?(\d+)/i) : null)
                || (directOv && directOv.overridden_link_number ? [null, String(directOv.overridden_link_number)] : null);

              if (linkMatch) {
                linkNum = parseInt(linkMatch[1], 10);
                const rawCat = directOv?.target_category_id ? parseInt(directOv.target_category_id, 10) : null;
                targetCatId = (rawCat && rawCat !== 4) ? rawCat : (/COR|CONDUCTOR/i.test(code) || /COR/i.test(remarks) ? 1 : (staff.category_id === 1 ? 1 : 2));
                status = 'CHANGED_LINK';
                customSetType = `Link #${linkNum}`;
                overrideReason = remarks || `Link #${linkNum}`;
              } else {
                status = 'DUTY';
                linkNum = null;
                const ndMatch = getMultiDayNonDailyMatch(code) || (remarks ? getMultiDayNonDailyMatch(remarks) : null);
                if (ndMatch) {
                  customFrom = ndMatch.isReturn ? (ndMatch.via || 'OUTSTATION') : (ndMatch.from || 'GNT');
                  customTo = ndMatch.isReturn ? (ndMatch.to || 'GNT') : (ndMatch.via || ndMatch.to || '---');
                  customCoaches = ndMatch.coaches || 'SL / AC';
                  customSetType = `${ndMatch.totalDays}-Day Non-Daily (${ndMatch.isReturn ? 'Return' : 'Outward'})`;
                } else {
                  customFrom = 'GNT';
                  customTo = '---';
                  customCoaches = 'SL / AC';
                  customSetType = 'Train Duty';
                }
                overrideReason = remarks || `Daily Duty: Train ${code}`;
              }
            }
          } else if (muster && ['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'SICK', 'CR', 'R', 'O', 'NH', 'OD'].includes(musterCode) && !(musterCode === 'R' && hasActiveOverrideDuty)) {
            isOverridden = true;
            linkNum = null;
            lastAssignedLink = null;
            lastAssignedNonDaily = null;
            if (['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'NH'].includes(musterCode)) {
              status = 'LEAVE';
              leaveType = musterCode;
              overrideReason = `Muster: ${musterCode}${muster.remarks ? ` (${muster.remarks})` : ''}`;
            } else if (musterCode === 'OD') {
              status = 'DUTY';
              leaveType = 'OD';
              customTrainNo = '-';
              customFrom = 'OFFICIAL';
              customTo = 'OTHER DUTY';
              overrideReason = `Muster: OD (On Duty)${muster.remarks ? ` (${muster.remarks})` : ''}`;
            } else if (musterCode === 'SICK') {
              status = 'SICK';
              overrideReason = `Muster: SICK${muster.remarks ? ` (${muster.remarks})` : ''}`;
            } else if (musterCode === 'CR') {
              status = 'CR';
              leaveType = 'CR';
              overrideReason = (directOv && directOv.reason) ? directOv.reason : `Muster: Compensatory Rest (CR)${muster.remarks ? ` (${muster.remarks})` : ''}`;
            } else if (musterCode === 'R') {
              status = 'REST';
              isRest = true;
              overrideReason = `Muster: Weekly Rest (R)${muster.remarks ? ` (${muster.remarks})` : ''}`;
            } else if (musterCode === 'O') {
              status = 'ABSENT';
              overrideReason = `Muster: Absent (O)${muster.remarks ? ` (${muster.remarks})` : ''}`;
            }
          } else if (directOv && !(directOv.status === 'AVAILABLE_FOR_BOOKING' && hasSubActiveDuty)) {
            isOverridden = true;
            substituteStaffId = directOv.substitute_staff_id;
            substituteName = directOv.substitute_name;
            overrideReason = directOv.reason;
            leaveType = directOv.leave_type;

            if (['LEAVE', 'SICK', 'CR', 'REST', 'ABSENT', 'MARK_LATER'].includes(directOv.status)) {
              status = directOv.status;
              isRest = directOv.status === 'REST';
              linkNum = null;
              lastAssignedLink = null;
              lastAssignedNonDaily = null;
            } else if (directOv.status === 'AVAILABLE_FOR_BOOKING' || directOv.shifted_place === 'NON_DAILY_REST') {
              status = 'AVAILABLE_FOR_BOOKING';
              isRest = true;
              linkNum = null;
              if (directOv.shifted_place === 'NON_DAILY_REST') {
                customFrom = 'GNT';
                customTo = 'GNT';
                customCoaches = '-';
                customSetType = '3-Day Non-Daily (Day 3 HQ Rest)';
              }
              lastAssignedLink = null;
              lastAssignedNonDaily = null;
            } else if (directOv.overridden_link_number !== null && directOv.overridden_link_number !== undefined) {
              linkNum = parseInt(directOv.overridden_link_number, 10);
              const rawCat = directOv.target_category_id ? parseInt(directOv.target_category_id, 10) : null;
              targetCatId = (rawCat && rawCat !== 4) ? rawCat : (staff.category_id === 1 ? 1 : 2);
              status = directOv.status || 'DUTY';
              lastAssignedLink = linkNum;
              lastTargetCat = targetCatId;
              lastAssignedNonDaily = null;
            } else if (directOv.status === 'EXTRA_CREW' || directOv.extra_train_no || directOv.status === 'SHIFTED') {
              status = directOv.status === 'SHIFTED' ? 'SHIFTED' : 'EXTRA_CREW';
              linkNum = null;
              lastAssignedLink = null;
              const trainStr = directOv.extra_train_no || directOv.shifted_place || directOv.reason || 'EXTRA';
              const ndMatch = getMultiDayNonDailyMatch(trainStr);
              if (ndMatch) {
                if (ndMatch.isReturn || directOv.shifted_place === 'NON_DAILY_RETURN') {
                  customTrainNo = `${ndMatch.outTrain}/${ndMatch.returnTrain}`;
                  customFrom = ndMatch.via || 'WADI';
                  customTo = ndMatch.to || 'GNT';
                  customCoaches = ndMatch.coaches || 'SL / AC';
                  customSetType = `${ndMatch.totalDays}-Day Non-Daily (Day 2 Return)`;
                  overrideReason = directOv.reason || `Day 2 Return: ${ndMatch.serviceName} ${ndMatch.returnTrain} (${ndMatch.via} ➔ ${ndMatch.to}) • SL / AC`;
                  lastAssignedNonDaily = {
                    service: ndMatch,
                    dayIndex: 2,
                    totalDays: ndMatch.totalDays,
                    pairNo: `${ndMatch.outTrain}/${ndMatch.returnTrain}`
                  };
                } else {
                  customTrainNo = `${ndMatch.outTrain}/${ndMatch.returnTrain}`;
                  customFrom = ndMatch.from || 'GNT';
                  customTo = ndMatch.via || '---';
                  customCoaches = ndMatch.coaches || 'SL / AC';
                  customSetType = `${ndMatch.totalDays}-Day Non-Daily (Day 1 Out)`;
                  overrideReason = directOv.reason || `Day 1: ${ndMatch.serviceName} ${ndMatch.outTrain} (${ndMatch.from}-${ndMatch.via}) • SL / AC`;
                  lastAssignedNonDaily = {
                    service: ndMatch,
                    dayIndex: 1,
                    totalDays: ndMatch.totalDays,
                    pairNo: `${ndMatch.outTrain}/${ndMatch.returnTrain}`
                  };
                }
              } else {
                const rawTr = String(directOv.extra_train_no || directOv.shifted_place || 'EXTRA').trim();
                const ndt = nonDailyTrains.find(n => String(n.train_number).includes(rawTr) || rawTr.includes(String(n.train_number)));
                const matchedLink = !ndt ? allLinks.find(l =>
                  l.category_id !== 4 &&
                  l.train_numbers &&
                  (l.train_numbers.includes(rawTr) || rawTr.includes(l.train_numbers)) &&
                  (!l.effective_from || l.effective_from <= d.dateString) &&
                  (!l.effective_to || l.effective_to >= d.dateString)
                ) : null;

                customTrainNo = rawTr;
                if (ndt) {
                  customFrom = ndt.departure_station || ndt.from_station || 'GNT';
                  customTo = ndt.arrival_station || ndt.to_station || '---';
                  customCoaches = ndt.coaches || 'SL / AC';
                  customSetType = 'Non-Daily Train';
                } else if (matchedLink) {
                  customFrom = matchedLink.from_station || 'GNT';
                  customTo = matchedLink.to_station || '---';
                  customCoaches = matchedLink.coaches || '-';
                  customSetType = directOv.is_extra ? `Extra Crew (Link #${matchedLink.link_number})` : (matchedLink.set_type || `Link #${matchedLink.link_number}`);
                } else {
                  customFrom = 'GNT';
                  customTo = '---';
                  customCoaches = '-';
                  customSetType = directOv.status === 'SHIFTED' ? 'Shifted Duty' : 'Extra Crew';
                }
                overrideReason = directOv.reason || `Assigned to Train ${customTrainNo}`;
                lastAssignedNonDaily = null;
              }
            } else if (directOv.status === 'UTILISED_ADVANCE') {
              status = 'DUTY';
              linkNum = null;
              lastAssignedLink = null;
              lastAssignedNonDaily = null;
              customTrainNo = directOv.advance_train_no || 'ADVANCE';
              customFrom = 'GNT';
              customTo = '---';
              customCoaches = '-';
              customSetType = 'Advance Utilisation';
              overrideReason = directOv.reason || `Utilised in Advance on ${customTrainNo}`;
            } else {
              status = directOv.status || 'DUTY';
              linkNum = directOv.overridden_link_number !== null && directOv.overridden_link_number !== undefined ? parseInt(directOv.overridden_link_number, 10) : null;
            }
          } else if (hasSubActiveDuty) {
            // Worked as substitute for regular staff
            isOverridden = true;
            const assignedLink = subOv.overridden_link_number !== null && subOv.overridden_link_number !== undefined
              ? parseInt(subOv.overridden_link_number, 10)
              : (subOv.original_link_number !== null && subOv.original_link_number !== undefined ? parseInt(subOv.original_link_number, 10) : null);

            if (assignedLink) {
              linkNum = assignedLink;
              const rawSubCat = subOv.target_category_id ? parseInt(subOv.target_category_id, 10) : null;
              const rawRegCat = subOv.regular_staff_category ? parseInt(subOv.regular_staff_category, 10) : null;
              targetCatId = (rawSubCat && rawSubCat !== 4)
                ? rawSubCat
                : ((rawRegCat && rawRegCat !== 4) ? rawRegCat : (staff.category_id === 1 ? 1 : 2));
              status = 'SUBSTITUTE';
              overrideReason = subOv.reason || `Substitute for ${subOv.regular_staff_name || 'Staff'} on Link #${linkNum} (${subOv.leave_type || subOv.status || 'Leave'})`;
              lastAssignedLink = linkNum;
              lastTargetCat = targetCatId;
              lastAssignedNonDaily = null;
            } else {
              status = 'SUBSTITUTE';
              overrideReason = subOv.reason || `Substitute for ${subOv.regular_staff_name || 'Staff'}`;
              lastAssignedLink = null;
              lastAssignedNonDaily = null;
            }
          } else if (lastAssignedNonDaily) {
            if (lastAssignedNonDaily.dayIndex === 1 && lastAssignedNonDaily.totalDays >= 2) {
              const nd = lastAssignedNonDaily.service;
              isOverridden = true;
              status = 'DUTY';
              linkNum = null;
              customTrainNo = lastAssignedNonDaily.pairNo || `${nd.outTrain}/${nd.returnTrain}`;
              customFrom = nd.via || 'WADI';
              customTo = nd.to || 'GNT';
              customCoaches = nd.coaches || 'SL / AC';
              customSetType = `${nd.totalDays}-Day Non-Daily (Day 2 Return)`;
              overrideReason = `Day 2 Return: ${nd.serviceName} ${nd.returnTrain} (${nd.via} ➔ ${nd.to}) • Dep ${nd.retDepTime || ''} Arr ${nd.arrHqTime || ''} • SL / AC`;
              lastAssignedNonDaily = {
                ...lastAssignedNonDaily,
                dayIndex: 2
              };
              lastAssignedLink = null;
            } else if (lastAssignedNonDaily.dayIndex === 2 && lastAssignedNonDaily.totalDays === 3) {
              const nd = lastAssignedNonDaily.service;
              isOverridden = true;
              status = 'AVAILABLE_FOR_BOOKING';
              linkNum = null;
              customTrainNo = lastAssignedNonDaily.pairNo || `${nd.outTrain}/${nd.returnTrain}`;
              customFrom = 'GNT';
              customTo = 'GNT';
              customCoaches = nd.coaches || 'SL / AC';
              customSetType = `3-Day Non-Daily (Day 3 HQ Rest)`;
              overrideReason = `Day 3: Arrived GNT ${nd.arrHqTime || '02:05'} on ${nd.returnTrain} • 8h Statutory HQ Rest till ${nd.restTill || '10:05'} • Available (AVL)`;
              lastAssignedNonDaily = null;
              lastAssignedLink = null;
            } else {
              lastAssignedNonDaily = null;
            }
          } else if (lastAssignedLink && getLinkSetDetails(lastTargetCat || 1, lastAssignedLink)) {
            // Multi-day link continuation (e.g. Day 2 / Day 3 return leg)
            const setDetails = getLinkSetDetails(lastTargetCat || 1, lastAssignedLink);
            if (setDetails && setDetails.remainingLinks && setDetails.remainingLinks.length > 0) {
              const nextLink = setDetails.remainingLinks[0];
              linkNum = nextLink;
              targetCatId = lastTargetCat || 1;
              status = 'DUTY';
              isOverridden = true;
              overrideReason = `Return Leg of Multi-Day Link #${nextLink} (Set: ${setDetails.setLinks.join('➔')})`;
              lastAssignedLink = nextLink;
            } else {
              lastAssignedLink = null;
            }
          }

          // If not yet assigned a working train by Muster/Override/Continuation, check LR Sheet / Daily Earnings / Duty Register
          const isUnbookedStandby = (linkNum === null && !customTrainNo && (!isOverridden || (directOv && directOv.status === 'AVAILABLE_FOR_BOOKING')));
          if (isUnbookedStandby) {
            if (lrRec && lrRec.duty_code) {
              const code = lrRec.duty_code.trim();
              const linkCodeMatch = code.match(/^(?:LINK\s*#?|L-)(\d+)$/i);
              const ndMatch = getMultiDayNonDailyMatch(code);
              if (ndMatch && !ndMatch.isReturn) {
                isOverridden = true;
                isRest = false;
                status = 'DUTY';
                customTrainNo = `${ndMatch.outTrain}/${ndMatch.returnTrain}`;
                customFrom = ndMatch.from || 'GNT';
                customTo = ndMatch.via || '---';
                customCoaches = ndMatch.coaches || 'SL / AC';
                customSetType = `${ndMatch.totalDays}-Day Non-Daily (Day 1 Out)`;
                overrideReason = lrRec.remarks || `Day 1: ${ndMatch.serviceName} ${ndMatch.outTrain}`;
                lastAssignedNonDaily = {
                  service: ndMatch,
                  dayIndex: 1,
                  totalDays: ndMatch.totalDays,
                  pairNo: `${ndMatch.outTrain}/${ndMatch.returnTrain}`
                };
                lastAssignedLink = null;
              } else if (code === 'R' || code === 'REST') {
                status = 'REST';
                isRest = true;
                overrideReason = lrRec.remarks || 'LR Sheet: Weekly Rest';
                lastAssignedLink = null;
                lastAssignedNonDaily = null;
              } else if (['AVL', 'REST_HQ', 'SPARE', 'P', 'DUTY'].includes(code.toUpperCase())) {
                status = 'AVAILABLE_FOR_BOOKING';
                isRest = true;
                overrideReason = (directOv && directOv.reason) || lrRec.remarks || 'Available for Booking';
                lastAssignedLink = null;
                lastAssignedNonDaily = null;
              } else if (['CL', 'LAP', 'LHAP', 'CR', 'OD', 'S', 'SICK', 'CCL', 'SCL', 'NH'].includes(code.toUpperCase())) {
                status = ['S', 'SICK'].includes(code.toUpperCase()) ? 'SICK' : 'LEAVE';
                leaveType = code.toUpperCase();
                overrideReason = lrRec.remarks || `LR Sheet: ${code}`;
                lastAssignedLink = null;
                lastAssignedNonDaily = null;
              } else if (linkCodeMatch || /^\d+$/.test(code)) {
                linkNum = parseInt(linkCodeMatch ? linkCodeMatch[1] : code, 10);
                const preferredCat = (staff.category_id === 1) ? 1 : 2;
                const matchedLink = allLinks.find(l =>
                  l.link_number === linkNum &&
                  l.category_id === preferredCat &&
                  (!l.effective_from || l.effective_from <= d.dateString) &&
                  (!l.effective_to || l.effective_to >= d.dateString)
                ) || allLinks.find(l =>
                  l.link_number === linkNum &&
                  l.category_id !== 4 &&
                  (!l.effective_from || l.effective_from <= d.dateString) &&
                  (!l.effective_to || l.effective_to >= d.dateString)
                );
                targetCatId = matchedLink ? matchedLink.category_id : preferredCat;
                status = 'DUTY';
                isRest = false;
                isOverridden = true;
                overrideReason = lrRec.remarks || `Daily Duty: Link #${linkNum}`;
                lastAssignedLink = linkNum;
                lastTargetCat = targetCatId;
                lastAssignedNonDaily = null;
              } else {
                const matchedLink = allLinks.find(l =>
                  l.category_id !== 4 &&
                  l.train_numbers &&
                  (l.train_numbers.includes(code) || code.includes(l.train_numbers)) &&
                  (!l.effective_from || l.effective_from <= d.dateString) &&
                  (!l.effective_to || l.effective_to >= d.dateString)
                );
                if (matchedLink) {
                  linkNum = matchedLink.link_number;
                  targetCatId = matchedLink.category_id;
                  status = 'DUTY';
                  isRest = false;
                  isOverridden = true;
                  overrideReason = lrRec.remarks || `Daily Duty: Train ${code} (Link #${linkNum})`;
                  lastAssignedLink = linkNum;
                  lastTargetCat = targetCatId;
                  lastAssignedNonDaily = null;
                } else {
                  const ndt = nonDailyTrains.find(n => String(n.train_number).includes(code) || code.includes(String(n.train_number)));
                  customTrainNo = code;
                  customFrom = ndt ? (ndt.departure_station || ndt.from_station || 'GNT') : 'GNT';
                  customTo = ndt ? (ndt.arrival_station || ndt.to_station || '---') : '---';
                  customCoaches = ndt ? (ndt.coaches || 'SL / AC') : '-';
                  customSetType = ndt ? 'Non-Daily Train' : 'Train Duty';
                  status = 'DUTY';
                  isRest = false;
                  isOverridden = true;
                  overrideReason = lrRec.remarks || `Daily Duty: Train ${code}`;
                  lastAssignedLink = null;
                  lastAssignedNonDaily = null;
                }
              }
            } else if (earn && earn.duty && !['AVL', 'SPARE', 'P'].includes(String(earn.duty).toUpperCase())) {
              isOverridden = true;
              if (earn.duty === 'REST') {
                status = 'REST';
                isRest = true;
                overrideReason = earn.remarks || 'Weekly Rest';
                lastAssignedLink = null;
                lastAssignedNonDaily = null;
              } else {
                const earnLinkMatch = String(earn.duty).trim().match(/^(?:LINK\s*#?|L-)(\d+)$/i);
                if (earnLinkMatch) {
                  linkNum = parseInt(earnLinkMatch[1], 10);
                  const preferredCat = (staff.category_id === 1) ? 1 : 2;
                  const matchedLink = allLinks.find(l =>
                    l.link_number === linkNum &&
                    l.category_id === preferredCat &&
                    (!l.effective_from || l.effective_from <= d.dateString) &&
                    (!l.effective_to || l.effective_to >= d.dateString)
                  ) || allLinks.find(l =>
                    l.link_number === linkNum &&
                    l.category_id !== 4 &&
                    (!l.effective_from || l.effective_from <= d.dateString) &&
                    (!l.effective_to || l.effective_to >= d.dateString)
                  );
                  targetCatId = matchedLink ? matchedLink.category_id : preferredCat;
                  status = 'DUTY';
                  isRest = false;
                  overrideReason = earn.remarks || `Daily Duty Allotment: Link #${linkNum}`;
                  lastAssignedLink = linkNum;
                  lastTargetCat = targetCatId;
                  lastAssignedNonDaily = null;
                } else {
                  status = 'DUTY';
                  isRest = false;
                  customTrainNo = earn.duty;
                  customFrom = earn.from_station || 'GNT';
                  customTo = earn.to_station || '---';
                  customCoaches = earn.coaches || '-';
                  overrideReason = earn.remarks || `Daily Duty Allotment: ${earn.duty}`;
                  lastAssignedLink = null;
                  lastAssignedNonDaily = null;
                }
              }
            } else if (dreg && (dreg.train_out || dreg.duty_label)) {
              isOverridden = true;
              isRest = false;
              status = 'DUTY';
              customTrainNo = (dreg.train_out ? (dreg.train_out + (dreg.train_return ? ` / ${dreg.train_return}` : '')) : dreg.duty_label);
              customFrom = 'GNT';
              customTo = '---';
              customCoaches = '-';
              overrideReason = dreg.duty_label || dreg.notes || 'Duty Register Entry';
              lastAssignedLink = null;
              lastAssignedNonDaily = null;
            } else if (!directOv) {
              // Check scheduled rest day
              if (isScheduledWeeklyRestDay) {
                status = 'REST';
                isRest = true;
                overrideReason = 'Weekly Rest Day';
              } else {
                // Default LR standby pool at HQ
                status = 'AVAILABLE_FOR_BOOKING';
                isRest = true;
                overrideReason = 'LR Standby Pool • Full HQ Rest Available • Ready for Booking';
              }
              lastAssignedLink = null;
              lastAssignedNonDaily = null;
            }
          }

          let dutyDetails = null;
          if (linkNum !== null) {
            if (linkNum <= 100) {
              dutyDetails = allLinks.find(l =>
                l.category_id === targetCatId &&
                l.link_number === linkNum &&
                (!l.effective_from || l.effective_from <= d.dateString) &&
                (!l.effective_to || l.effective_to >= d.dateString)
              ) || allLinks.find(l =>
                l.link_number === linkNum &&
                l.category_id !== 4 &&
                (!l.effective_from || l.effective_from <= d.dateString) &&
                (!l.effective_to || l.effective_to >= d.dateString)
              );
              if (dutyDetails && targetCatId === 4) {
                targetCatId = dutyDetails.category_id;
              }
              if (!dutyDetails) {
                dutyDetails = await getActiveLinkDef(targetCatId, linkNum, d.dateString);
              }
            } else {
              // linkNum is a train number (e.g. 7227, 12756, 22882)
              const ndt = nonDailyTrains.find(n => String(n.train_number).includes(String(linkNum)) || String(linkNum).includes(String(n.train_number)));
              customTrainNo = ndt ? ndt.train_number : String(linkNum);
              customFrom = ndt ? (ndt.departure_station || ndt.from_station || 'GNT') : 'GNT';
              customTo = ndt ? (ndt.arrival_station || ndt.to_station || '---') : '---';
              customCoaches = ndt ? (ndt.coaches || '-') : '-';
              customSetType = 'Non-Daily Train';
              linkNum = null;
            }
          }

          let lrRestInfo = null;
          if (status === 'AVAILABLE_FOR_BOOKING') {
            lrRestInfo = await getStaffLastDutyAndRestStatus(staff.id, d.dateString);
          }

          let origIsRest = isScheduledWeeklyRestDay || status === 'REST' || musterCode === 'R' || (directOv && directOv.status === 'REST');
          let origTrain = origIsRest ? 'REST' : 'SPARE (HQ)';
          let actualTrain = customTrainNo || (dutyDetails ? dutyDetails.train_numbers : (status === 'REST' ? 'REST' : (status === 'AVAILABLE_FOR_BOOKING' ? 'SPARE (HQ)' : (leaveType || status))));

          const cmp = compareDutyAndResolve({
            origTrain,
            origIsRest,
            origLinkNum: null,
            actualLinkNum: linkNum,
            targetCategoryId: targetCatId,
            remarks: overrideReason || (muster ? muster.remarks : null),
            overrideDuty: directOv || subOv,
            muster,
            allLinks,
            categoryId: targetCatId || staff.category_id || currentCatId,
            dateStr: d.dateString
          });

          const resolvedTrainNumbers = customTrainNo || (status === 'AVAILABLE_FOR_BOOKING' ? 'SPARE (HQ)' : (dutyDetails ? dutyDetails.train_numbers : (status === 'MARK_LATER' ? 'REASON LATER' : (status === 'SICK' ? 'SICK' : status === 'LEAVE' ? (leaveType || 'LEAVE') : status === 'CR' ? 'CR' : status === 'ABSENT' ? 'ABSENT' : 'REST'))));
          const resolvedFromStation = customFrom || (status === 'AVAILABLE_FOR_BOOKING' ? 'GNT' : (dutyDetails ? dutyDetails.from_station : ''));
          const resolvedToStation = customTo || (status === 'AVAILABLE_FOR_BOOKING' ? 'GNT' : (dutyDetails ? dutyDetails.to_station : ''));
          const resolvedCoaches = customCoaches || (status === 'AVAILABLE_FOR_BOOKING' ? '-' : (dutyDetails ? dutyDetails.coaches : ''));
          const resolvedSetType = customSetType || (status === 'AVAILABLE_FOR_BOOKING' ? 'Spare / HQ' : (dutyDetails ? dutyDetails.set_type : (status === 'MARK_LATER' ? 'Reason Later (Muster Blank)' : (status === 'REST' ? 'Weekly Rest' : 'Train Duty'))));
          const hasBookedDuty = Boolean((linkNum !== null || customTrainNo) && status !== 'AVAILABLE_FOR_BOOKING' && status !== 'REST');

          rowCells.push({
            date: d.dateString,
            dayOffset: d.dayOffset,
            calculatedLinkNumber: hasBookedDuty ? linkNum : null,
            actualLinkNumber: linkNum,
            target_category_id: targetCatId,
            isRest: status === 'REST' || (status === 'AVAILABLE_FOR_BOOKING' && !customTrainNo) || (linkNum === null && !customTrainNo && status !== 'DUTY'),
            isOverridden,
            status,
            muster_code: musterCode,
            muster_remarks: muster ? muster.remarks : null,
            lr_rest_info: lrRestInfo,
            cr_available: crBalances[staff.id] ? crBalances[staff.id].display : null,
            cr_short_display: crBalances[staff.id] ? crBalances[staff.id].shortDisplay : '-',
            substituteStaffId,
            substituteName,
            overrideReason,
            leave_type: leaveType,
            original_train_numbers: hasBookedDuty ? resolvedTrainNumbers : origTrain,
            original_is_rest: origIsRest,
            original_from_station: hasBookedDuty ? (resolvedFromStation || 'GNT') : (origIsRest ? '-' : 'GNT'),
            original_to_station: hasBookedDuty ? (resolvedToStation || '---') : (origIsRest ? '-' : 'GNT'),
            original_coaches: hasBookedDuty ? (resolvedCoaches || '-') : '-',
            original_set_type: hasBookedDuty ? resolvedSetType : (origIsRest ? 'Weekly Rest' : 'Spare / HQ'),
            actual_train_numbers: customTrainNo || actualTrain,
            effective_train_numbers: customTrainNo || cmp.train_no,
            condition_applied: customTrainNo ? null : cmp.condition,
            train_numbers: customTrainNo || resolvedTrainNumbers,
            from_station: resolvedFromStation,
            to_station: resolvedToStation,
            coaches: resolvedCoaches,
            set_type: resolvedSetType
          });


        } else {
          // ==========================================
          // REGULAR CATEGORIES (Category 1, 2, 3)
          // ==========================================
          // 1. Direct connection to Muster Chart attendance
          if (muster && ['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'SICK', 'CR', 'R', 'O', 'NH', 'OD'].includes(musterCode)) {
            isOverridden = true;
            linkNum = null;
            lastAssignedLink = null;
            lastAssignedNonDaily = null;
            if (['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'NH'].includes(musterCode)) {
              status = 'LEAVE';
              leaveType = musterCode;
              overrideReason = `Muster: ${musterCode}${muster.remarks ? ` (${muster.remarks})` : ''}`;
            } else if (musterCode === 'OD') {
              status = 'DUTY';
              leaveType = 'OD';
              overrideReason = `Muster: OD (On Duty)${muster.remarks ? ` (${muster.remarks})` : ''}`;
            } else if (musterCode === 'SICK') {
              status = 'SICK';
              overrideReason = `Muster: SICK${muster.remarks ? ` (${muster.remarks})` : ''}`;
            } else if (musterCode === 'CR') {
              status = 'CR';
              leaveType = 'CR';
              overrideReason = (directOv && directOv.reason) ? directOv.reason : `Muster: Compensatory Rest (CR)${muster.remarks ? ` (${muster.remarks})` : ''}`;
            } else if (musterCode === 'R') {
              status = 'REST';
              overrideReason = `Muster: Weekly Rest (R)${muster.remarks ? ` (${muster.remarks})` : ''}`;
            } else if (musterCode === 'O') {
              status = 'ABSENT';
              overrideReason = `Muster: Absent (O)${muster.remarks ? ` (${muster.remarks})` : ''}`;
            }
          } else if (directOv) {
            isOverridden = true;
            substituteStaffId = directOv.substitute_staff_id;
            substituteName = directOv.substitute_name;
            overrideReason = directOv.reason;
            leaveType = directOv.leave_type;

            if (directOv.status === 'AVAILABLE_FOR_BOOKING' || (directOv.reason && (directOv.reason.toLowerCase().includes('available for booking') || directOv.reason.toLowerCase().includes('available for other duty') || directOv.reason.toLowerCase().includes('removed from link') || directOv.reason.toLowerCase().includes('relieved to hq')))) {
              status = 'AVAILABLE_FOR_BOOKING';
              linkNum = null;
              lastAssignedLink = null;
              lastAssignedNonDaily = null;
              overrideReason = directOv.reason || 'Available for Booking Duty at HQ';
            } else if (['LEAVE', 'SICK', 'CR', 'REST', 'ABSENT', 'MARK_LATER'].includes(directOv.status)) {
              status = directOv.status;
              linkNum = null;
              lastAssignedLink = null;
              lastAssignedNonDaily = null;
            } else if (directOv.overridden_link_number !== null && directOv.overridden_link_number !== undefined) {
              linkNum = directOv.overridden_link_number;
              targetCatId = directOv.target_category_id || (currentCatId === 1 ? 1 : 2);
              status = directOv.status || 'CHANGED_LINK';
              lastAssignedLink = linkNum;
              lastTargetCat = targetCatId;
              lastAssignedNonDaily = null;
            } else if (directOv.status === 'EXTRA_CREW' || directOv.extra_train_no) {
              status = 'DUTY';
              linkNum = null;
              lastAssignedLink = null;
              const trainStr = directOv.extra_train_no || directOv.reason || 'EXTRA';
              const ndMatch = getMultiDayNonDailyMatch(trainStr);
              if (ndMatch) {
                customTrainNo = `${ndMatch.outTrain}/${ndMatch.returnTrain}`;
                customFrom = ndMatch.from || 'GNT';
                customTo = ndMatch.via || '---';
                customCoaches = ndMatch.coaches || 'SL / AC';
                customSetType = `${ndMatch.totalDays}-Day Non-Daily (Day 1 Out)`;
                overrideReason = directOv.reason || `Day 1: ${ndMatch.serviceName} ${ndMatch.outTrain} (${ndMatch.from}-${ndMatch.via}) • SL / AC`;
                lastAssignedNonDaily = {
                  service: ndMatch,
                  dayIndex: 1,
                  totalDays: ndMatch.totalDays,
                  pairNo: `${ndMatch.outTrain}/${ndMatch.returnTrain}`
                };
              } else {
                customTrainNo = directOv.extra_train_no || 'EXTRA';
                customFrom = 'GNT';
                customTo = '---';
                customCoaches = '-';
                customSetType = 'Extra Crew';
                overrideReason = directOv.reason || `Assigned to Extra Train ${customTrainNo}`;
                lastAssignedNonDaily = null;
              }
            } else if (directOv.status === 'UTILISED_ADVANCE') {
              status = 'DUTY';
              linkNum = null;
              lastAssignedLink = null;
              lastAssignedNonDaily = null;
              customTrainNo = directOv.advance_train_no || 'ADVANCE';
              customFrom = 'GNT';
              customTo = '---';
              customCoaches = '-';
              customSetType = 'Advance Utilisation';
              overrideReason = directOv.reason || `Utilised in Advance on ${customTrainNo}`;
            } else {
              linkNum = directOv.overridden_link_number;
              status = directOv.status || (directOv.overridden_link_number === null ? 'REST' : 'CHANGED_LINK');
              if (directOv.target_category_id) {
                targetCatId = directOv.target_category_id;
              }
            }
          } else if (subOv && subOv.status !== 'AVAILABLE_FOR_BOOKING') {
            isOverridden = true;
            const assignedLink = subOv.overridden_link_number !== null && subOv.overridden_link_number !== undefined
              ? subOv.overridden_link_number
              : subOv.original_link_number;
            if (assignedLink) {
              linkNum = assignedLink;
              targetCatId = subOv.target_category_id || (subOv.regular_staff_category || (currentCatId === 1 ? 1 : 2));
              status = 'DUTY';
              overrideReason = subOv.reason || `Substitute for ${subOv.regular_staff_name || 'Staff'} on Link #${linkNum}`;
              lastAssignedLink = linkNum;
              lastTargetCat = targetCatId;
              lastAssignedNonDaily = null;
            }
          } else if (lastAssignedNonDaily) {
            if (lastAssignedNonDaily.dayIndex === 1 && lastAssignedNonDaily.totalDays >= 2) {
              const nd = lastAssignedNonDaily.service;
              isOverridden = true;
              status = 'DUTY';
              linkNum = null;
              customTrainNo = lastAssignedNonDaily.pairNo || `${nd.outTrain}/${nd.returnTrain}`;
              customFrom = nd.via || 'WADI';
              customTo = nd.to || 'GNT';
              customCoaches = nd.coaches || 'SL / AC';
              customSetType = `${nd.totalDays}-Day Non-Daily (Day 2 Return)`;
              overrideReason = `Day 2 Return: ${nd.serviceName} ${nd.returnTrain} (${nd.via} ➔ ${nd.to}) • Dep ${nd.retDepTime || ''} Arr ${nd.arrHqTime || ''} • SL / AC`;
              lastAssignedNonDaily = {
                ...lastAssignedNonDaily,
                dayIndex: 2
              };
              lastAssignedLink = null;
            } else if (lastAssignedNonDaily.dayIndex === 2 && lastAssignedNonDaily.totalDays === 3) {
              const nd = lastAssignedNonDaily.service;
              isOverridden = true;
              status = 'AVAILABLE_FOR_BOOKING';
              linkNum = null;
              customTrainNo = lastAssignedNonDaily.pairNo || `${nd.outTrain}/${nd.returnTrain}`;
              customFrom = 'GNT';
              customTo = 'GNT';
              customCoaches = nd.coaches || 'SL / AC';
              customSetType = `3-Day Non-Daily (Day 3 HQ Rest)`;
              overrideReason = `Day 3: Arrived GNT ${nd.arrHqTime || '02:05'} on ${nd.returnTrain} • 8h Statutory HQ Rest till ${nd.restTill || '10:05'} • Available (AVL)`;
              lastAssignedNonDaily = null;
              lastAssignedLink = null;
            } else {
              lastAssignedNonDaily = null;
            }
          } else if (lastAssignedLink && getLinkSetDetails(lastTargetCat || currentCatId, lastAssignedLink)) {
            // Multi-day link continuation (e.g. Day 2 / Day 3 return leg)
            const setDetails = getLinkSetDetails(lastTargetCat || currentCatId, lastAssignedLink);
            if (setDetails && setDetails.remainingLinks && setDetails.remainingLinks.length > 0) {
              const nextLink = setDetails.remainingLinks[0];
              const normalBaseLink = getBaseLinkNumber(staff.row_position, staffDayOffset, curCycleLength);
              const isNaturalSchedule = (normalBaseLink === nextLink && (lastTargetCat || currentCatId) === currentCatId);
              linkNum = nextLink;
              targetCatId = lastTargetCat || currentCatId;
              status = 'DUTY';
              isOverridden = !isNaturalSchedule;
              overrideReason = isNaturalSchedule ? '' : ((muster && muster.remarks) ? `Muster: ${muster.remarks}` : `Return Leg of Multi-Day Link #${nextLink} (Set: ${setDetails.setLinks.join('➔')})`);
              lastAssignedLink = nextLink;
            } else {
              lastAssignedLink = null;
            }
          }

          if (linkNum === null && status === 'DUTY' && !isOverridden) {
            linkNum = getBaseLinkNumber(staff.row_position, staffDayOffset, curCycleLength);
            const multiDayLeaveReturn = await checkMultiDayLeaveReturn(staff.id, currentCatId, staff.row_position, curCycleLength, curAnchorDate, d.dateString);
            if (multiDayLeaveReturn) {
              isOverridden = true;
              status = 'AVAILABLE_FOR_BOOKING';
              overrideReason = multiDayLeaveReturn.reason;
              substituteStaffId = multiDayLeaveReturn.substituteStaffId;
              substituteName = multiDayLeaveReturn.substituteName;
              linkNum = null;
              lastAssignedLink = null;
            } else {
              lastAssignedLink = linkNum;
              lastTargetCat = currentCatId;
            }
          }

          let dutyDetails = null;
          if (linkNum !== null) {
            dutyDetails = await getActiveLinkDef(targetCatId || currentCatId, linkNum, d.dateString);
          }

          let lrRestInfo = null;
          if (status === 'AVAILABLE_FOR_BOOKING') {
            lrRestInfo = await getStaffLastDutyAndRestStatus(staff.id, d.dateString);
          }

          const origBaseLink = getBaseLinkNumber(staff.row_position, staffDayOffset, curCycleLength);
          let origDutyDef = null;
          if (origBaseLink !== null && origBaseLink !== undefined) {
            origDutyDef = await getActiveLinkDef(staff.category_id || currentCatId, origBaseLink, d.dateString);
          }
          const origIsRest = !origDutyDef || origDutyDef.is_rest === 1 || isRestString(origDutyDef.train_numbers);
          const origTrain = origIsRest ? 'REST' : (origDutyDef.train_numbers || 'REST');
          const actualTrain = customTrainNo || (dutyDetails ? dutyDetails.train_numbers : (status === 'REST' ? 'REST' : (status === 'AVAILABLE_FOR_BOOKING' ? 'SPARE (HQ)' : (leaveType || status))));

          const cmp = compareDutyAndResolve({
            origTrain,
            origIsRest,
            origLinkNum: origBaseLink,
            actualLinkNum: linkNum,
            targetCategoryId: targetCatId || currentCatId,
            remarks: overrideReason || (muster ? muster.remarks : null),
            overrideDuty: directOv || subOv,
            muster,
            allLinks,
            categoryId: staff.category_id || currentCatId,
            dateStr: d.dateString
          });

          rowCells.push({
            date: d.dateString,
            dayOffset: staffDayOffset,
            calculatedLinkNumber: origBaseLink,
            actualLinkNumber: linkNum,
            target_category_id: targetCatId || currentCatId,
            isRest: (linkNum === null && !customTrainNo) || (dutyDetails && dutyDetails.is_rest === 1) || (status === 'AVAILABLE_FOR_BOOKING' && !customTrainNo) || status === 'REST',
            isOverridden,
            status,
            muster_code: musterCode,
            muster_remarks: muster ? muster.remarks : null,
            lr_rest_info: lrRestInfo,
            cr_available: crBalances[staff.id] ? crBalances[staff.id].display : null,
            cr_short_display: crBalances[staff.id] ? crBalances[staff.id].shortDisplay : '-',
            substituteStaffId,
            substituteName,
            overrideReason,
            leave_type: leaveType,
            original_train_numbers: origTrain,
            original_is_rest: origIsRest,
            original_from_station: origIsRest ? '-' : (origDutyDef ? (origDutyDef.from_station || '-') : '-'),
            original_to_station: origIsRest ? '-' : (origDutyDef ? (origDutyDef.to_station || '-') : '-'),
            original_coaches: origIsRest ? '-' : (origDutyDef ? (origDutyDef.coaches || '-') : '-'),
            original_set_type: origIsRest ? 'Weekly Rest' : (origDutyDef ? (origDutyDef.set_type || 'Train Duty') : 'Train Duty'),
            actual_train_numbers: actualTrain,
            effective_train_numbers: cmp.train_no,
            condition_applied: cmp.condition,
            train_numbers: customTrainNo || (status === 'AVAILABLE_FOR_BOOKING' ? 'SPARE (HQ)' : (dutyDetails ? dutyDetails.train_numbers : (status === 'MARK_LATER' ? 'REASON LATER' : (status === 'SICK' ? 'SICK' : status === 'LEAVE' ? (leaveType || 'LEAVE') : status === 'CR' ? 'CR' : status === 'ABSENT' ? 'ABSENT' : 'REST')))),
            from_station: customFrom || (status === 'AVAILABLE_FOR_BOOKING' ? 'GNT' : (dutyDetails ? dutyDetails.from_station : '')),
            to_station: customTo || (status === 'AVAILABLE_FOR_BOOKING' ? 'GNT' : (dutyDetails ? dutyDetails.to_station : '')),
            coaches: customCoaches || (status === 'AVAILABLE_FOR_BOOKING' ? '-' : (dutyDetails ? dutyDetails.coaches : '')),
            set_type: customSetType || (status === 'AVAILABLE_FOR_BOOKING' ? 'Spare / HQ' : (dutyDetails ? dutyDetails.set_type : (status === 'MARK_LATER' ? 'Reason Later (Muster Blank)' : (status === 'REST' ? 'Weekly Rest' : 'Train Duty'))))
          });
        }
      }

      gridRows.push({
        staffId: staff.id,
        staffName: staff.name,
        designation: staff.designation,
        category_id: staff.category_id,
        pf_no: staff.pf_no,
        seniority_no: staff.seniority_no,
        rowPosition: staff.row_position,
        active: staff.active,
        rest_day: staff.rest_day,
        cr_available: crBalances[staff.id] ? crBalances[staff.id].display : null,
        cr_short_display: crBalances[staff.id] ? crBalances[staff.id].shortDisplay : '-',
        cr_count: crBalances[staff.id] ? crBalances[staff.id].count : 0,
        cr_dates: crBalances[staff.id] ? crBalances[staff.id].dates : [],
        cells: rowCells
      });
    }

    const activeCatParams = (category && (category.id === 2 || category.code === 'TTI_SLEEPER'))
      ? { ...category, ...getCategoryParamsForDate(category, startDate) }
      : category;

    return ({
      category: activeCatParams,
      dates,
      rows: gridRows,
      startDate,
      endDate
    });
}

export async function previewRestChange(query: any) {
  const { staff_id, new_rest_date, mode = 'SHIFT' } = query;
  if (!staff_id || !new_rest_date) {
    throw new ApiError(400, 'staff_id and new_rest_date are required' );
  }

    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) throw new ApiError(404, 'Staff member not found' );
    const category = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
    const restLinks = await all("SELECT link_number FROM links WHERE category_id = ? AND is_rest = 1 AND (status = 'published' OR status IS NULL OR status = '') AND (status != 'draft') AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = 'published' OR status IS NULL))", [category.id]);
    const restLinkNums = restLinks.map(l => l.link_number);

    const scheduledRestDate = findScheduledRestDate(
      staff.row_position,
      new_rest_date,
      category.anchor_date,
      category.cycle_length,
      restLinkNums
    );

    const adjustments = computeRestAdjustment({
      staffRowPosition: staff.row_position,
      anchorDateStr: category.anchor_date,
      cycleLength: category.cycle_length,
      scheduledRestDateStr: scheduledRestDate,
      newRestDateStr: new_rest_date,
      mode,
      restLinks: restLinkNums
    });

    return ({
      success: true,
      staffName: staff.name,
      staffId: staff.id,
      scheduledRestDate,
      newRestDate: new_rest_date,
      mode,
      adjustments
    });
}

export async function changeRestDay(data: any, currentUser: string = 'Admin') {
  const { staff_id, new_rest_date, mode = 'SHIFT', reason } = data;
  if (!staff_id || !new_rest_date) {
    throw new ApiError(400, 'staff_id and new_rest_date are required' );
  }

    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) throw new ApiError(404, 'Staff member not found' );
    const category = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
    const restLinks = await all("SELECT link_number FROM links WHERE category_id = ? AND is_rest = 1 AND (status = 'published' OR status IS NULL OR status = '') AND (status != 'draft') AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = 'published' OR status IS NULL))", [category.id]);

    const restLinkNums = restLinks.map(l => l.link_number);

    const scheduledRestDate = findScheduledRestDate(
      staff.row_position,
      new_rest_date,
      category.anchor_date,
      category.cycle_length,
      restLinkNums
    );

    const adjustments = computeRestAdjustment({
      staffRowPosition: staff.row_position,
      anchorDateStr: category.anchor_date,
      cycleLength: category.cycle_length,
      scheduledRestDateStr: scheduledRestDate,
      newRestDateStr: new_rest_date,
      mode,
      restLinks: restLinkNums
    });

    if (adjustments.length === 0) {
      return ({ success: true, message: 'This date is already the scheduled rest day.', adjustments: [] });
    }

    // Apply adjustments atomically in database
    for (const adj of adjustments) {
      const finalReason = reason ? `${adj.reason} (${reason})` : adj.reason;
      if (adj.isRest) {
        await run(
          `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, created_by)
           VALUES (?, ?, ?, NULL, 'REST', ?, 'Admin')
           ON CONFLICT(staff_id, date) DO UPDATE SET
             overridden_link_number = NULL,
             status = 'REST',
             reason = excluded.reason`,
          [staff_id, adj.date, adj.originalLinkNumber, finalReason]
        );
      } else {
        await run(
          `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, created_by)
           VALUES (?, ?, ?, ?, ?, ?, 'Admin')
           ON CONFLICT(staff_id, date) DO UPDATE SET
             overridden_link_number = excluded.overridden_link_number,
             status = excluded.status,
             reason = excluded.reason`,
          [staff_id, adj.date, adj.originalLinkNumber, adj.linkNumber, adj.status, finalReason]
        );
      }
    }

    await logAudit(
      'Admin',
      'REST_DAY_ADJUSTMENT',
      `Changed rest day for ${staff.name} to ${new_rest_date} (${mode} mode, scheduled was ${scheduledRestDate}). Adjusted ${adjustments.length} dates.`
    );

    return ({
      success: true,
      message: `Rest day changed to ${new_rest_date} with ${mode} link adjustments applied successfully!`,
      scheduledRestDate,
      newRestDate: new_rest_date,
      mode,
      adjustments
    });
}

export async function resetRestAdjustment(data: any, currentUser: string = 'Admin') {
  const { staff_id, start_date, end_date } = data;
  if (!staff_id || !start_date || !end_date) {
    throw new ApiError(400, 'staff_id, start_date, and end_date are required' );
  }

    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) throw new ApiError(404, 'Staff member not found' );

    await run(
      `DELETE FROM overrides 
       WHERE staff_id = ? AND date(date) >= date(?) AND date(date) <= date(?)
         AND (reason LIKE '%Rest day moved%' OR reason LIKE '%adjusted due to rest%' OR reason LIKE '%Duty Link%worked on scheduled rest%')`,
      [staff_id, start_date, end_date]
    );

    await logAudit(
      'Admin',
      'RESET_REST_ADJUSTMENT',
      `Reset rest adjustments for ${staff.name} between ${start_date} and ${end_date}`
    );

    return ({ success: true, message: `Rest adjustments reset for ${staff.name}` });
}
