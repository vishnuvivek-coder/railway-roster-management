import { get, all } from '../db';
import { getDayOffset, getBaseLinkNumber } from '../rotation';
import { ApiError } from '../utils/api_error';
import {
  getActiveLinkDef,
  getCategoryParamsForDate,
  checkMultiDayLeaveReturn,
  getMultiDayNonDailyMatch,
  getStaffLastDutyAndRestStatus,
  calculateStaffCrBalances
} from './helpers.service';

export async function getWhoIsWorking(query: any) {
  const { category_id, link_number, date } = query;
  if (!category_id || !link_number || !date) {
    throw new ApiError(400, 'category_id, link_number and date are required' );
  }
    const category = await get('SELECT * FROM categories WHERE id = ?', [category_id]);
    if (!category) throw new ApiError(404, 'Category not found' );

    const staffMembers = await all('SELECT * FROM staff WHERE category_id = ? ORDER BY row_position', [category_id]);
    const dayOffset = getDayOffset(category.anchor_date, date);
    const linkTarget = parseInt(link_number, 10);

    const matches = [];
    for (const staff of staffMembers) {
      // check override
      const override = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, date]);
      let activeLink = null;
      if (override) {
        activeLink = override.overridden_link_number;
      } else {
        activeLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);
      }

      if (activeLink === linkTarget) {
        matches.push(staff);
      }
    }

    return ({ date, link_number: linkTarget, matches });
}

export async function getWhatIsPersonWorking(query: any) {
  const { staff_id, date } = query;
  if (!staff_id || !date) {
    throw new ApiError(400, 'staff_id and date are required' );
  }
    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) throw new ApiError(404, 'Staff member not found' );

    const category = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
    const dayOffset = getDayOffset(category.anchor_date, date);

    const override = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, date]);
    let activeLink = null;
    let isOverridden = false;
    let status = 'DUTY';
    let substituteStaffId = null;
    let substituteName = null;
    let overrideReason = '';

    let targetCategoryId = null;
    if (override) {
      activeLink = override.overridden_link_number;
      isOverridden = true;
      status = override.status || (override.overridden_link_number === null ? 'REST' : 'CHANGED_LINK');
      substituteStaffId = override.substitute_staff_id;
      substituteName = override.substitute_name;
      overrideReason = override.reason;
      targetCategoryId = override.target_category_id || (override.status === 'SUBSTITUTE' ? 1 : null);
    } else {
      activeLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);
    }

    let dutyDetails = null;
    if (activeLink !== null) {
      dutyDetails = await getActiveLinkDef(targetCategoryId || staff.category_id, activeLink, date);
    }

    return ({
      staff,
      date,
      dayOffset,
      activeLink,
      target_category_id: targetCategoryId,
      isRest: activeLink === null || (dutyDetails && dutyDetails.is_rest === 1),
      isOverridden,
      status,
      substituteStaffId,
      substituteName,
      overrideReason,
      duty: dutyDetails ? {
        train_numbers: dutyDetails.train_numbers,
        from_station: dutyDetails.from_station,
        to_station: dutyDetails.to_station,
        coaches: dutyDetails.coaches
      } : { train_numbers: status === 'SICK' ? 'SICK' : status === 'LEAVE' ? 'LEAVE' : status === 'CR' ? 'CR' : 'REST', from_station: '', to_station: '', coaches: '' }
    });
}

export async function getDailyView(query: any) {
  const { date } = query;
  if (!date) throw new ApiError(400, 'Date is required' );
    const categories = await all('SELECT * FROM categories');
    const crBalances = await calculateStaffCrBalances();
    const result = [];

    for (const cat of categories) {
      const staffMembers = await all(
        'SELECT * FROM staff WHERE category_id = ? ORDER BY row_position',
        [cat.id]
      );
      if (cat.id === 4) {
        // ==========================================
        // LEAVE RESERVE (LR / CATEGORY 4) RESOLUTION
        // Must match the LR Sheet (lr_sheet_records)
        // ==========================================
        const staffDuties = [];
        for (const staff of staffMembers) {
          const lrRecord = await get('SELECT * FROM lr_sheet_records WHERE staff_id = ? AND date = ?', [staff.id, date]);
          const override = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, date]);
          const musterRecord = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff.id, date]);

          let activeLink = null;
          let isOverridden = Boolean(lrRecord || override || musterRecord);
          let status = 'AVAILABLE_FOR_BOOKING';
          let substituteStaffId = null;
          let substituteName = null;
          let overrideReason = '';
          let targetCategoryId = null;
          let leaveType = null;
          let resolvedTrainNumbers = 'SPARE (HQ)';
          let resolvedFromStation = 'GNT';
          let resolvedToStation = 'GNT';
          let resolvedSetType = 'Spare / HQ';
          let activeExtraTrain = null;
          let isRest = false;
          let musterCode = musterRecord ? musterRecord.code.toUpperCase() : null;
          let musterRemarks = musterRecord ? musterRecord.remarks || '' : null;

          const dObj = new Date(date + 'T12:00:00');
          const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
          const dayOfWeek = dayNames[dObj.getDay()];
          const isScheduledRestDay = (staff.rest_day && staff.rest_day.toUpperCase() === dayOfWeek) ||
            (staff.name && staff.name.toUpperCase().includes(dayOfWeek + ' REST'));

          if (lrRecord && lrRecord.duty_code && lrRecord.duty_code.trim() !== '') {
            const code = lrRecord.duty_code.trim();
            const upper = code.toUpperCase();
            const remarks = lrRecord.remarks || '';
            overrideReason = remarks;

            if (upper === 'R' || upper === 'REST') {
              status = 'REST';
              isRest = true;
              resolvedTrainNumbers = 'REST';
              resolvedSetType = 'Weekly Rest';
              overrideReason = remarks || 'Weekly Rest (LR Sheet)';
            } else if (upper === 'S' || upper === 'SICK') {
              status = 'SICK';
              isRest = true;
              leaveType = 'SICK';
              resolvedTrainNumbers = 'SICK';
              resolvedSetType = 'Sick / Medical';
              overrideReason = remarks || 'Sick / Medical (LR Sheet)';
            } else if (upper.startsWith('CR')) {
              status = 'CR';
              isRest = true;
              leaveType = 'CR';
              resolvedTrainNumbers = 'CR';
              resolvedSetType = 'Compensatory Rest';
              overrideReason = remarks || `Compensatory Rest [${code}] (LR Sheet)`;
            } else if (upper === 'O' || upper === 'ABSENT') {
              status = 'ABSENT';
              isRest = true;
              resolvedTrainNumbers = 'ABSENT';
              resolvedSetType = 'Absent';
              overrideReason = remarks || 'Absent (LR Sheet)';
            } else if (['CL', 'LAP', 'LHAP', 'CCL', 'SCL', 'OD', 'NH', 'L', 'CAP'].includes(upper)) {
              status = 'LEAVE';
              isRest = true;
              leaveType = (upper === 'L' || upper === 'CAP') ? 'LAP' : upper;
              resolvedTrainNumbers = `LEAVE (${leaveType})`;
              resolvedSetType = 'Leave';
              overrideReason = remarks || `Leave [${leaveType}] (LR Sheet)`;
            } else if (['AVL', 'SPARE', 'REST_HQ', 'STANDBY', 'AVAILABLE', 'P'].includes(upper)) {
              status = 'AVAILABLE_FOR_BOOKING';
              isRest = true;
              resolvedTrainNumbers = 'SPARE (HQ)';
              resolvedSetType = 'Spare / HQ';
              overrideReason = remarks || 'Available for Booking / Standby (LR Sheet)';
            } else {
              // Working Train or Link duty as recorded in LR Sheet
              isRest = false;
              resolvedTrainNumbers = code;

              const linkMatch = (override && override.overridden_link_number !== null && override.overridden_link_number !== undefined)
                ? [null, String(override.overridden_link_number)]
                : (code.match(/^(?:(?:COR|SL|CONDUCTOR|SLEEPER)\s*)?(?:LINK|L)[\s#-]*(\d+)$/i)
                  || (remarks ? remarks.match(/Link\s*#?(\d+)/i) : null));

              if (linkMatch) {
                const linkNum = parseInt(linkMatch[1], 10);
                activeLink = linkNum;
                status = (override && override.status) ? override.status : 'CHANGED_LINK';
                const isCor = (override && override.target_category_id)
                  ? parseInt(override.target_category_id, 10) === 1
                  : (/COR|CONDUCTOR/i.test(code) || /COR/i.test(remarks) || staff.category_id === 1);
                targetCategoryId = (override && override.target_category_id)
                  ? parseInt(override.target_category_id, 10)
                  : (isCor ? 1 : 2);
                const linkDef = await getActiveLinkDef(targetCategoryId, linkNum, date);
                if (linkDef) {
                  resolvedFromStation = linkDef.from_station || 'GNT';
                  resolvedToStation = linkDef.to_station || '---';
                  resolvedSetType = linkDef.set_type || `Link #${linkNum}`;
                  if (/^(?:LINK|L)[\s#-]*\d+$/i.test(code) && linkDef.train_numbers) {
                    resolvedTrainNumbers = linkDef.train_numbers;
                  }
                }
                overrideReason = remarks || `Assigned to ${isCor ? 'COR' : 'SL'} Link #${linkNum}`;
              } else {
                status = 'EXTRA_CREW';
                activeExtraTrain = code;
                const ndMatch = getMultiDayNonDailyMatch(code) || (remarks ? getMultiDayNonDailyMatch(remarks) : null);
                if (ndMatch) {
                  resolvedFromStation = ndMatch.isReturn ? (ndMatch.via || 'OUTSTATION') : (ndMatch.from || 'GNT');
                  resolvedToStation = ndMatch.isReturn ? (ndMatch.to || 'GNT') : (ndMatch.via || ndMatch.to || '---');
                  resolvedSetType = `${ndMatch.totalDays}-Day Non-Daily (${ndMatch.isReturn ? 'Return' : 'Outward'})`;
                } else {
                  resolvedFromStation = 'GNT';
                  resolvedToStation = '---';
                  resolvedSetType = 'LR Assigned Train';
                }
                overrideReason = remarks || `LR Assigned Train ${code}`;
              }
            }
          } else if (override) {
            activeLink = override.overridden_link_number;
            status = override.status || (override.overridden_link_number === null ? 'REST' : 'CHANGED_LINK');
            substituteStaffId = override.substitute_staff_id;
            substituteName = override.substitute_name;
            overrideReason = override.reason || '';
            targetCategoryId = override.target_category_id || (activeLink ? (activeLink > 21 ? 2 : (staff.category_id === 1 ? 1 : 2)) : null);
            leaveType = override.leave_type;
            activeExtraTrain = override.extra_train_no;
            isRest = ['REST', 'AVAILABLE_FOR_BOOKING'].includes(status);

            if (activeLink) {
              const linkDef = await getActiveLinkDef(targetCategoryId || 1, activeLink, date);
              resolvedTrainNumbers = linkDef ? linkDef.train_numbers : `Link #${activeLink}`;
              resolvedFromStation = linkDef?.from_station || 'GNT';
              resolvedToStation = linkDef?.to_station || '---';
              resolvedSetType = linkDef?.set_type || `Link #${activeLink}`;
            } else if (activeExtraTrain) {
              resolvedTrainNumbers = activeExtraTrain;
              resolvedSetType = 'Extra Crew';
            } else if (status === 'REST') {
              resolvedTrainNumbers = 'REST';
              resolvedSetType = 'Weekly Rest';
            } else if (status === 'AVAILABLE_FOR_BOOKING') {
              resolvedTrainNumbers = 'SPARE (HQ)';
              resolvedSetType = 'Spare / HQ';
            } else if (status === 'LEAVE' || status === 'SICK' || status === 'CR' || status === 'ABSENT') {
              resolvedTrainNumbers = leaveType || status;
              resolvedSetType = status;
            }
          } else if (musterRecord && ['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'OD', 'NH', 'SICK', 'CR', 'R', 'O'].includes(musterCode)) {
            if (['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'OD', 'NH'].includes(musterCode)) {
              status = 'LEAVE';
              leaveType = musterCode;
              resolvedTrainNumbers = `LEAVE (${musterCode})`;
              isRest = true;
            } else if (musterCode === 'SICK') {
              status = 'SICK';
              resolvedTrainNumbers = 'SICK';
              isRest = true;
            } else if (musterCode === 'CR') {
              status = 'CR';
              resolvedTrainNumbers = 'CR';
              isRest = true;
            } else if (musterCode === 'R') {
              status = 'REST';
              resolvedTrainNumbers = 'REST';
              isRest = true;
            } else if (musterCode === 'O') {
              status = 'ABSENT';
              resolvedTrainNumbers = 'ABSENT';
              isRest = true;
            }
            overrideReason = `Muster: ${musterCode}${musterRemarks ? ` (${musterRemarks})` : ''}`;
          } else {
            if (isScheduledRestDay) {
              status = 'REST';
              isRest = true;
              resolvedTrainNumbers = 'REST';
              resolvedSetType = 'Weekly Rest';
              overrideReason = 'Scheduled Weekly Rest';
            } else {
              status = 'AVAILABLE_FOR_BOOKING';
              isRest = true;
              resolvedTrainNumbers = 'SPARE (HQ)';
              resolvedSetType = 'Spare / HQ';
              overrideReason = 'LR Standby Pool • Full HQ Rest Available • Ready for Booking';
            }
          }

          const crInfo = crBalances[staff.id] || { count: 0, dates: [], display: null, shortDisplay: '-' };
          let lrRestInfo = await getStaffLastDutyAndRestStatus(staff.id, date);

          staffDuties.push({
            staffId: staff.id,
            name: staff.name,
            designation: staff.designation,
            rowPosition: staff.row_position,
            categoryId: cat.id,
            categoryName: cat.name,
            target_category_id: targetCategoryId,
            rest_day: staff.rest_day,
            link_number: activeLink,
            original_link_number: null,
            isRest: isRest || status === 'REST' || status === 'AVAILABLE_FOR_BOOKING',
            isOverridden,
            status,
            muster_code: musterCode,
            muster_remarks: musterRemarks,
            substituteStaffId,
            substituteName,
            overrideReason,
            extra_train_no: activeExtraTrain,
            is_extra: activeExtraTrain ? 1 : (override?.is_extra || 0),
            shifted_place: override?.shifted_place || null,
            shifted_from_link: override?.shifted_from_link || null,
            shifted_from_train: override?.shifted_from_train || null,
            advance_train_no: override?.advance_train_no || null,
            is_advance_duty: override?.is_advance_duty || 0,
            leave_type: leaveType,
            cr_available: crInfo.display,
            cr_short_display: crInfo.shortDisplay,
            cr_count: crInfo.count,
            cr_dates: crInfo.dates,
            lr_rest_info: lrRestInfo,
            train_numbers: resolvedTrainNumbers,
            from_station: resolvedFromStation,
            to_station: resolvedToStation,
            coaches: (status === 'AVAILABLE_FOR_BOOKING' || status === 'REST' || status === 'LEAVE' || status === 'SICK' || status === 'CR' || status === 'ABSENT') ? '-' : (activeExtraTrain ? 'SL / AC' : 'SL'),
            set_type: resolvedSetType
          });
        }

        // Keep Category 4 ordered by row_position ASC to match LR Sheet
        staffDuties.sort((a, b) => (a.rowPosition || 0) - (b.rowPosition || 0));

        result.push({
          categoryId: cat.id,
          categoryName: cat.name,
          categoryCode: cat.code,
          staff: staffDuties
        });
        continue;
      }

      const { anchor_date: catAnchorDate, cycle_length: catCycleLength } = getCategoryParamsForDate(cat, date);
      const dayOffset = getDayOffset(catAnchorDate, date);

      const staffDuties = [];
      for (const staff of staffMembers) {
        const override = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, date]);
        let activeLink = null;
        let isOverridden = false;
        let status = 'DUTY';
        let substituteStaffId = null;
        let substituteName = null;
        let overrideReason = '';
        let targetCategoryId = null;
        let leaveType = null;

        let multiDayContinuation = null;
        if (override) {
          activeLink = override.overridden_link_number;
          isOverridden = true;
          status = override.status || (override.overridden_link_number === null ? 'REST' : 'CHANGED_LINK');
          substituteStaffId = override.substitute_staff_id;
          substituteName = override.substitute_name;
          overrideReason = override.reason;
          let resolvedTargetCat = override.target_category_id || (override.status === 'SUBSTITUTE' ? 1 : null);
          if (!resolvedTargetCat && activeLink !== null) {
            const ownLink = await get('SELECT 1 FROM links WHERE category_id = ? AND link_number = ? AND (status = \'published\' OR status IS NULL OR status = \'\') AND (status != \'draft\') AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = \'published\' OR status IS NULL))', [cat.id, activeLink]);
            if (ownLink) {
              resolvedTargetCat = cat.id;
            } else {
              const anyLink = await get('SELECT category_id FROM links WHERE link_number = ? AND (status = \'published\' OR status IS NULL OR status = \'\') AND (status != \'draft\') AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = \'published\' OR status IS NULL)) ORDER BY category_id ASC LIMIT 1', [activeLink]);
              resolvedTargetCat = anyLink ? anyLink.category_id : cat.id;
            }

          }
          targetCategoryId = resolvedTargetCat || cat.id;
          leaveType = override.leave_type;
        } else {
          activeLink = getBaseLinkNumber(staff.row_position, dayOffset, catCycleLength);
          const multiDayLeaveReturn = await checkMultiDayLeaveReturn(staff.id, cat.id, staff.row_position, catCycleLength, catAnchorDate, date);
          if (multiDayLeaveReturn) {
            isOverridden = true;
            status = 'AVAILABLE_FOR_BOOKING';
            overrideReason = multiDayLeaveReturn.reason;
            substituteStaffId = multiDayLeaveReturn.substituteStaffId;
            substituteName = multiDayLeaveReturn.substituteName;
            activeLink = null;
          } else {
            // Check yesterday for multi-day return leg (2-Day and 3-Day services)
            const dMinus1 = new Date(date + 'T12:00:00');
            dMinus1.setDate(dMinus1.getDate() - 1);
            const dMinus1Str = dMinus1.toISOString().split('T')[0];
            const prev1Ov = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, dMinus1Str]);

            if (prev1Ov && !['REST', 'SICK', 'LEAVE', 'CR', 'ABSENT'].includes(prev1Ov.status)) {
              const prev1TrainStr = prev1Ov.extra_train_no || prev1Ov.reason;
              const ndMatch1 = getMultiDayNonDailyMatch(prev1TrainStr);
              if (ndMatch1 && !ndMatch1.isReturn && (ndMatch1.totalDays || 2) >= 2) {
                isOverridden = true;
                status = 'EXTRA_CREW';
                overrideReason = `Day 2 Return of ${ndMatch1.outTrain} (${ndMatch1.returnTrain}${ndMatch1.via ? ` ${ndMatch1.via}` : ''} ➔ ${ndMatch1.to || 'GNT'})`;
                activeLink = null;
                multiDayContinuation = {
                  type: 'RETURN',
                  train: ndMatch1.returnTrain,
                  outTrain: ndMatch1.outTrain,
                  via: ndMatch1.via || 'WADI',
                  to: ndMatch1.to || 'GNT',
                  totalDays: ndMatch1.totalDays
                };
              }
            }

            if (!multiDayContinuation) {
              const dMinus2 = new Date(date + 'T12:00:00');
              dMinus2.setDate(dMinus2.getDate() - 2);
              const dMinus2Str = dMinus2.toISOString().split('T')[0];
              const prev2Ov = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, dMinus2Str]);

              if (prev2Ov && !['REST', 'SICK', 'LEAVE', 'CR', 'ABSENT'].includes(prev2Ov.status)) {
                const prev2TrainStr = prev2Ov.extra_train_no || prev2Ov.reason;
                const ndMatch2 = getMultiDayNonDailyMatch(prev2TrainStr);
                if (ndMatch2 && !ndMatch2.isReturn && ndMatch2.totalDays === 3) {
                  isOverridden = true;
                  status = 'REST';
                  overrideReason = `Day 3: Arrived GNT ${ndMatch2.arrHqTime || ''} on ${ndMatch2.returnTrain} • 8h HQ Rest till ${ndMatch2.restTill || ''}`;
                  activeLink = null;
                  multiDayContinuation = {
                    type: 'REST',
                    train: null,
                    returnTrain: ndMatch2.returnTrain,
                    arrHqTime: ndMatch2.arrHqTime,
                    restTill: ndMatch2.restTill,
                    totalDays: 3
                  };
                }
              }
            }
          }
        }

        // Check muster roll
        const musterRecord = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff.id, date]);
        let musterCode = null;
        let musterRemarks = null;
        if (musterRecord) {
          musterCode = musterRecord.code.toUpperCase();
          musterRemarks = musterRecord.remarks || '';
          if (['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'OD', 'NH'].includes(musterCode)) {
            status = 'LEAVE';
            activeLink = null;
            isOverridden = true;
            leaveType = musterCode;
            overrideReason = `Muster: ${musterCode === 'OD' ? 'OD (On Duty)' : musterCode}${musterRemarks ? ` (${musterRemarks})` : ''}`;
          } else if (musterCode === 'SICK') {
            status = 'SICK';
            activeLink = null;
            isOverridden = true;
            overrideReason = `Muster: SICK${musterRemarks ? ` (${musterRemarks})` : ''}`;
          } else if (musterCode === 'CR') {
            status = 'CR';
            activeLink = null;
            isOverridden = true;
            overrideReason = `Muster: Compensatory Rest (CR)${musterRemarks ? ` (${musterRemarks})` : ''}`;
          } else if (musterCode === 'R') {
            status = 'REST';
            activeLink = null;
            isOverridden = true;
            overrideReason = `Muster: Weekly Rest (R)${musterRemarks ? ` (${musterRemarks})` : ''}`;
          } else if (musterCode === 'O') {
            status = 'ABSENT';
            activeLink = null;
            isOverridden = true;
            overrideReason = `Muster: Absent (O)${musterRemarks ? ` (${musterRemarks})` : ''}`;
          } else if (musterCode === 'P' || musterCode === 'E') {
            status = 'DUTY';
            if (override && ['LEAVE', 'SICK', 'CR', 'ABSENT', 'MARK_LATER'].includes(override.status)) {
              status = 'AVAILABLE_FOR_BOOKING';
              overrideReason = 'Reported fit / Available at HQ (Muster: P)';
              leaveType = null;
            }
          }
        }

        let isCat4RestDay = false;
        if (!override && !musterRecord && cat.id === 4) {
          const dObj = new Date(date);
          const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
          const dayNameUpper = days[dObj.getDay()];
          if ((staff.rest_day && staff.rest_day.toUpperCase() === dayNameUpper) ||
            (staff.name && staff.name.toUpperCase().includes(dayNameUpper + ' REST'))) {
            isCat4RestDay = true;
            status = 'REST';
          }
        }

        let dutyDetails = null;
        if (activeLink !== null) {
          dutyDetails = await getActiveLinkDef(targetCategoryId || cat.id, activeLink, date);
        }

        const crInfo = crBalances[staff.id] || { count: 0, dates: [], display: null, shortDisplay: '-' };

        let lrRestInfo = null;
        if (cat.id === 4 || activeLink === null || status === 'AVAILABLE_FOR_BOOKING') {
          lrRestInfo = await getStaffLastDutyAndRestStatus(staff.id, date);
        }

        const activeExtraTrain = override?.extra_train_no || (multiDayContinuation?.type === 'RETURN' ? multiDayContinuation.train : null);
        const activeShiftedPlace = override?.shifted_place || (multiDayContinuation?.type === 'RETURN' ? 'NON_DAILY_RETURN' : (multiDayContinuation?.type === 'REST' ? 'NON_DAILY_REST' : null));

        let resolvedTrainNumbers = status === 'UTILISED_ADVANCE' ? `ADVANCE (${override?.advance_train_no || (overrideReason ? (overrideReason.match(/(?:train\s*(?:no\.?|#)?\s*|tr\.?\s*)(\d{4,5})/i)?.[1] || overrideReason.match(/(\d{4,5})/)?.[1]) : 'TR')})` : (status === 'AVAILABLE_FOR_BOOKING' ? 'SPARE (HQ)' : (dutyDetails ? dutyDetails.train_numbers : (status === 'MARK_LATER' ? 'REASON LATER' : (status === 'SICK' ? 'SICK' : status === 'LEAVE' ? `LEAVE (${musterCode || 'LV'})` : status === 'CR' ? 'CR' : status === 'ABSENT' ? 'ABSENT' : 'REST'))));
        let resolvedFromStation = (status === 'AVAILABLE_FOR_BOOKING' || status === 'UTILISED_ADVANCE') ? 'GNT' : (dutyDetails ? dutyDetails.from_station : '');
        let resolvedToStation = (status === 'AVAILABLE_FOR_BOOKING' || status === 'UTILISED_ADVANCE') ? 'GNT' : (dutyDetails ? dutyDetails.to_station : '');
        let resolvedSetType = status === 'UTILISED_ADVANCE' ? 'Advance Utilisation' : (status === 'AVAILABLE_FOR_BOOKING' ? 'Spare / HQ' : (dutyDetails ? dutyDetails.set_type : (status === 'MARK_LATER' ? 'Reason Later (Muster Blank)' : 'Other / REST')));

        if (activeShiftedPlace === 'NON_DAILY_RETURN' && activeExtraTrain) {
          const ndMatch = getMultiDayNonDailyMatch(activeExtraTrain) || (overrideReason ? getMultiDayNonDailyMatch(overrideReason) : null);
          resolvedTrainNumbers = activeExtraTrain;
          resolvedFromStation = ndMatch?.via || 'OUTSTATION';
          resolvedToStation = ndMatch?.to || 'GNT';
          resolvedSetType = 'Non-Daily Return';
        } else if (activeShiftedPlace === 'NON_DAILY_REST') {
          resolvedTrainNumbers = 'HQ Rest (Day 3)';
          resolvedFromStation = 'GNT';
          resolvedToStation = 'GNT';
          resolvedSetType = 'HQ Rest (Day 3)';
        } else if (activeExtraTrain) {
          const ndMatch = getMultiDayNonDailyMatch(activeExtraTrain);
          resolvedTrainNumbers = activeExtraTrain;
          resolvedFromStation = ndMatch?.from || 'GNT';
          resolvedToStation = ndMatch?.via || ndMatch?.to || '---';
          resolvedSetType = 'Non-Daily';
        }

        staffDuties.push({
          staffId: staff.id,
          name: staff.name,
          designation: staff.designation,
          rowPosition: staff.row_position,
          categoryId: cat.id,
          categoryName: cat.name,
          target_category_id: targetCategoryId,
          rest_day: staff.rest_day,
          link_number: activeLink,
          original_link_number: (override && override.original_link_number !== null && override.original_link_number !== undefined) ? override.original_link_number : getBaseLinkNumber(staff.row_position, dayOffset, catCycleLength),
          isRest: isCat4RestDay || (activeShiftedPlace === 'NON_DAILY_REST') || activeLink === null || (dutyDetails && dutyDetails.is_rest === 1) || status === 'AVAILABLE_FOR_BOOKING' || status === 'UTILISED_ADVANCE',
          isOverridden,
          status,
          muster_code: musterCode,
          muster_remarks: musterRemarks,
          substituteStaffId,
          substituteName,
          overrideReason,
          extra_train_no: activeExtraTrain,
          is_extra: activeExtraTrain ? 1 : (override?.is_extra || 0),
          shifted_place: activeShiftedPlace,
          shifted_from_link: override?.shifted_from_link || null,
          shifted_from_train: override?.shifted_from_train || null,
          advance_train_no: (status === 'UTILISED_ADVANCE' || override?.is_advance_duty === 1 || (status !== 'EXTRA_CREW' && status !== 'SHIFTED' && status !== 'CHANGED_LINK' && /utili[sz]ed\s+advance/i.test(overrideReason || '')))
            ? (override?.advance_train_no || (overrideReason ? (overrideReason.match(/(?:train\s*(?:no\.?|#)?\s*|tr\.?\s*)(\d{4,5})/i)?.[1] || overrideReason.match(/(\d{4,5})/)?.[1]) : null))
            : null,
          is_advance_duty: (status === 'UTILISED_ADVANCE' || override?.is_advance_duty === 1 || (status !== 'EXTRA_CREW' && status !== 'SHIFTED' && status !== 'CHANGED_LINK' && /utili[sz]ed\s+advance/i.test(overrideReason || ''))) ? 1 : 0,
          leave_type: leaveType,
          cr_available: crInfo.display,
          cr_short_display: crInfo.shortDisplay,
          cr_count: crInfo.count,
          cr_dates: crInfo.dates,
          lr_rest_info: lrRestInfo,
          train_numbers: resolvedTrainNumbers,
          from_station: resolvedFromStation,
          to_station: resolvedToStation,
          coaches: (status === 'AVAILABLE_FOR_BOOKING' || status === 'UTILISED_ADVANCE' || activeShiftedPlace === 'NON_DAILY_REST') ? '-' : (dutyDetails ? dutyDetails.coaches : 'SL / AC'),
          set_type: resolvedSetType
        });
      }

      // Sort daily duties by link number ascending to keep a fixed order of trains/links
      staffDuties.sort((a, b) => {
        const linkA = a.link_number === null ? 999999 : a.link_number;
        const linkB = b.link_number === null ? 999999 : b.link_number;
        return linkA - linkB;
      });

      result.push({
        categoryId: cat.id,
        categoryName: cat.name,
        categoryCode: cat.code,
        staff: staffDuties
      });
    }

    // Calculate Deployment Tally across all categories (counting only named employees, excluding VACANT posts)
    let grandBooked = 0;
    let grandOutstation = 0;
    let grandLeave = 0;
    let grandSick = 0;
    let grandHq = 0;
    let grandTotalStaff = 0;

    const isVacant = (name) => {
      if (!name) return true;
      const n = String(name).trim().toUpperCase();
      return n.includes('VACANT') || n === 'V' || n === '(V)';
    };

    const categoryTallies = result.map(cat => {
      let booked = 0;
      let outstation = 0;
      let leave = 0;
      let sick = 0;
      let hq = 0;
      let namedCount = 0;

      for (const s of cat.staff) {
        // Skip vacant posts
        if (isVacant(s.name)) {
          continue;
        }

        namedCount++;

        if (s.status === 'SICK' || s.status === 'ABSENT' || s.isSick) {
          sick++;
        } else if (s.status === 'LEAVE' || s.isLeave) {
          leave++;
        } else if (s.status === 'REST' || s.status === 'CR' || s.status === 'AVAILABLE_FOR_BOOKING' || ((s.isRest || s.link_number === null) && !s.extra_train_no && s.status !== 'EXTRA_CREW' && s.status !== 'DUTY')) {
          hq++; // Weekly Rest / CR / Standby at HQ / Available for booking duty
        } else if (s.from_station && s.from_station !== 'GNT' && s.from_station !== '---') {
          outstation++; // Working from outstation / outstation halt
        } else {
          // Working train departing from HQ or assigned train duty
          booked++;
        }
      }

      const total = namedCount;
      const sum = booked + outstation + leave + sick + hq;

      grandBooked += booked;
      grandOutstation += outstation;
      grandLeave += leave;
      grandSick += sick;
      grandHq += hq;
      grandTotalStaff += total;

      return {
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        categoryCode: cat.categoryCode,
        booked_to_duty: booked,
        outstation: outstation,
        leave: leave,
        sick: sick,
        headquarters: hq,
        total_staff: total,
        sum: sum,
        is_tallied: sum === total
      };
    });

    const grandSum = grandBooked + grandOutstation + grandLeave + grandSick + grandHq;
    const tallySummary = {
      categories: categoryTallies,
      grand_total: {
        booked_to_duty: grandBooked,
        outstation: grandOutstation,
        leave: grandLeave,
        sick: grandSick,
        headquarters: grandHq,
        total_staff: grandTotalStaff,
        sum: grandSum,
        is_tallied: grandSum === grandTotalStaff
      }
    };

    const dObj = new Date(date);
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const currentDayName = days[dObj.getDay()];
    const nonDailyTrains = await all(
      'SELECT * FROM non_daily_trains WHERE UPPER(day_of_week) = ? ORDER BY id',
      [currentDayName]
    );

    return ({ date, dayOfWeek: currentDayName, categories: result, nonDailyTrains, tally_summary: tallySummary });
}

export async function getAvailabilitySheet(query: any) {
  const formatLocalDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const targetDate = query.date || formatLocalDate(new Date());

    const categories = await all('SELECT * FROM categories ORDER BY id');
    const crBalances = await calculateStaffCrBalances();

    const isVacant = (name) => {
      if (!name) return true;
      const n = String(name).trim().toUpperCase();
      return n.includes('VACANT') || n === 'V' || n === '(V)';
    };

    const dObj = new Date(targetDate);
    const weekdayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const currentDayName = weekdayNames[dObj.getDay()];

    const categoryData = [];
    let grandTotalStaff = 0;
    let grandAvailable = 0;
    let grandNotAvailable = 0;
    const grandBreakdown = {
      available_standby: 0,
      available_12h_rest: 0,
      available_8h_rest: 0,
      available_sick_return: 0,
      available_leave_return: 0,
      available_weekly_rest: 0,
      booked_to_duty: 0,
      outstation: 0,
      on_leave: 0,
      sick: 0,
      in_hq_rest: 0,
      availing_cr: 0
    };

    for (const cat of categories) {
      const staffMembers = await all(
        'SELECT * FROM staff WHERE category_id = ? ORDER BY row_position',
        [cat.id]
      );
      const { anchor_date: catAnchorDate, cycle_length: catCycleLength } = getCategoryParamsForDate(cat, targetDate);
      const dayOffset = getDayOffset(catAnchorDate, targetDate);

      let catAvailable = 0;
      let catNotAvailable = 0;
      let catNamedCount = 0;
      const catBreakdown = {
        available_standby: 0,
        available_12h_rest: 0,
        available_8h_rest: 0,
        available_sick_return: 0,
        available_leave_return: 0,
        available_weekly_rest: 0,
        booked_to_duty: 0,
        outstation: 0,
        on_leave: 0,
        sick: 0,
        in_hq_rest: 0,
        availing_cr: 0
      };

      const staffList = [];

      for (const staff of staffMembers) {
        const vacant = isVacant(staff.name);

        // Check override
        const override = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, targetDate]);
        let activeLink = null;
        let isOverridden = false;
        let status = 'DUTY';
        let substituteStaffId = null;
        let substituteName = null;
        let overrideReason = '';
        let isSickReturn = false;

        if (override) {
          activeLink = override.overridden_link_number;
          isOverridden = true;
          status = override.status || (override.overridden_link_number === null ? 'REST' : 'CHANGED_LINK');
          substituteStaffId = override.substitute_staff_id;
          substituteName = override.substitute_name;
          overrideReason = override.reason;
          if (override.status === 'AVAILABLE_FOR_BOOKING' && (/sick/i.test(override.reason || '') || override.leave_type === 'SICK')) {
            isSickReturn = true;
          }
        } else {
          activeLink = getBaseLinkNumber(staff.row_position, dayOffset, catCycleLength);
          const multiDayLeaveReturn = await checkMultiDayLeaveReturn(staff.id, cat.id, staff.row_position, catCycleLength, catAnchorDate, targetDate);
          if (multiDayLeaveReturn) {
            isOverridden = true;
            status = 'AVAILABLE_FOR_BOOKING';
            overrideReason = multiDayLeaveReturn.reason;
            substituteStaffId = multiDayLeaveReturn.substituteStaffId;
            substituteName = multiDayLeaveReturn.substituteName;
            isSickReturn = !!multiDayLeaveReturn.isSickReturn;
            activeLink = null;
          }
        }

        // Check Category 4 designated weekly rest
        let isCat4RestDay = false;
        if (!override && cat.id === 4) {
          const dayNameUpper = currentDayName.slice(0, 3).toUpperCase();
          if ((staff.rest_day && staff.rest_day.toUpperCase() === dayNameUpper) ||
            (staff.name && staff.name.toUpperCase().includes(dayNameUpper + ' REST'))) {
            isCat4RestDay = true;
            status = 'REST';
          }
        }

        let dutyDetails = null;
        if (activeLink !== null) {
          const targetCatId = override?.target_category_id || cat.id;
          dutyDetails = await getActiveLinkDef(targetCatId, activeLink, targetDate);
          if (!dutyDetails) {
            dutyDetails = await get("SELECT * FROM links WHERE link_number = ? AND (status = 'published' OR status IS NULL OR status = '') AND (status != 'draft') AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = 'published' OR status IS NULL))", [activeLink]);
          }

        }

        const isRest = isCat4RestDay || activeLink === null || (dutyDetails && dutyDetails.is_rest === 1) || status === 'AVAILABLE_FOR_BOOKING';

        // Check leave requests or muster records for leave
        const approvedLeave = await get(
          "SELECT * FROM leave_requests WHERE staff_id = ? AND status = 'APPROVED' AND type = 'LEAVE' AND (date = ? OR (from_date <= ? AND to_date >= ?))",
          [staff.id, targetDate, targetDate, targetDate]
        );
        if (approvedLeave) {
          status = 'LEAVE';
        }

        // Check muster roll
        const musterRecord = await get(
          "SELECT * FROM muster_records WHERE staff_id = ? AND date = ?",
          [staff.id, targetDate]
        );
        let musterCode = null;
        let musterRemarks = null;
        if (musterRecord) {
          musterCode = musterRecord.code.toUpperCase();
          musterRemarks = musterRecord.remarks || '';
          if (['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'NH'].includes(musterCode)) {
            status = 'LEAVE';
            activeLink = null;
            dutyDetails = null;
            isOverridden = true;
          } else if (musterCode === 'SICK') {
            status = 'SICK';
            activeLink = null;
            dutyDetails = null;
            isOverridden = true;
          } else if (musterCode === 'CR') {
            status = 'CR';
            activeLink = null;
            dutyDetails = null;
            isOverridden = true;
          } else if (musterCode === 'R') {
            status = 'REST';
            activeLink = null;
            dutyDetails = null;
            isOverridden = true;
          } else if (musterCode === 'O') {
            status = 'ABSENT';
            activeLink = null;
            dutyDetails = null;
            isOverridden = true;
          } else if (musterCode === 'P' || musterCode === 'E') {
            status = 'DUTY';
            if (override && ['LEAVE', 'SICK', 'CR', 'ABSENT', 'MARK_LATER'].includes(override.status)) {
              status = 'AVAILABLE_FOR_BOOKING';
              overrideReason = 'Reported fit / Available at HQ (Muster: P)';
              leaveType = null;
            }
          }
        }

        // LR rest calculation
        let lrRestInfo = null;
        if (cat.id === 4 || activeLink === null || status === 'AVAILABLE_FOR_BOOKING') {
          lrRestInfo = await getStaffLastDutyAndRestStatus(staff.id, targetDate);
        }

        const crInfo = crBalances[staff.id] || { count: 0, dates: [], display: null, shortDisplay: '-' };

        // Train and route resolution
        const trainNumbers = status === 'AVAILABLE_FOR_BOOKING' ? 'SPARE (HQ)' : (dutyDetails ? dutyDetails.train_numbers : (status === 'MARK_LATER' ? 'REASON LATER' : (status === 'SICK' ? 'SICK' : status === 'LEAVE' ? 'LEAVE' : status === 'CR' ? 'CR' : status === 'ABSENT' ? 'ABSENT' : 'REST')));
        const fromStation = status === 'AVAILABLE_FOR_BOOKING' ? 'GNT' : (dutyDetails ? dutyDetails.from_station : '');
        const toStation = status === 'AVAILABLE_FOR_BOOKING' ? 'GNT' : (dutyDetails ? dutyDetails.to_station : '');
        const coaches = status === 'AVAILABLE_FOR_BOOKING' ? '-' : (dutyDetails ? dutyDetails.coaches : '-');

        // Determine Availability, Dot Status (GREEN vs RED), Category, Label, and Reason
        let isAvailable = false;
        let dotStatus = 'RED'; // 'GREEN' | 'RED'
        let statusCategory = 'NOT_AVAILABLE_BOOKED';
        let statusLabel = 'Not Available';
        let statusReason = '';
        let currentLocation = 'GNT (Headquarters)';

        if (vacant) {
          isAvailable = false;
          dotStatus = 'RED';
          statusCategory = 'VACANT';
          statusLabel = 'Vacant Post';
          statusReason = 'Post currently unoccupied';
          currentLocation = '---';
        } else if (status === 'SICK') {
          isAvailable = false;
          dotStatus = 'RED';
          statusCategory = 'NOT_AVAILABLE_SICK';
          statusLabel = 'Not Available (Sick)';
          statusReason = (musterCode ? `Muster: SICK${musterRemarks ? ` (${musterRemarks})` : ''}` : 'Reported sick') + (substituteName ? ` (Relief: ${substituteName})` : '');
          currentLocation = '🏠 GNT (Sick Leave)';
          catBreakdown.sick++;
        } else if (status === 'LEAVE') {
          isAvailable = false;
          dotStatus = 'RED';
          statusCategory = 'NOT_AVAILABLE_LEAVE';
          statusLabel = musterCode ? `Not Available (Leave: ${musterCode})` : 'Not Available (On Leave)';
          statusReason = musterCode
            ? `Muster: ${musterCode}${musterRemarks ? ` (${musterRemarks})` : ' (Sanctioned Leave)'}`
            : ('On sanctioned leave' + (substituteName ? ` (Relief: ${substituteName})` : ''));
          currentLocation = '🏖️ On Leave';
          catBreakdown.on_leave++;
        } else if (status === 'CR') {
          isAvailable = false;
          dotStatus = 'RED';
          statusCategory = 'NOT_AVAILABLE_CR';
          statusLabel = 'Not Available (Availing CR)';
          statusReason = musterCode ? `Muster: Compensatory Rest (CR)${musterRemarks ? ` (${musterRemarks})` : ''}` : 'Availing Compensatory Rest (CR)';
          currentLocation = '🏠 GNT (Availing CR)';
          catBreakdown.availing_cr++;
        } else if (status === 'ABSENT') {
          isAvailable = false;
          dotStatus = 'RED';
          statusCategory = 'NOT_AVAILABLE_ABSENT';
          statusLabel = 'Not Available (Absent)';
          statusReason = musterRemarks ? `Muster: Absent (O) (${musterRemarks})` : 'Unauthorized absence / Not attended for duty (Muster Code O)';
          currentLocation = '❌ Absent';
          catBreakdown.sick++;
        } else if (cat.id === 4 && lrRestInfo && lrRestInfo.restStatus === 'IN_HQ_REST' && !override) {
          isAvailable = false;
          dotStatus = 'RED';
          statusCategory = 'NOT_AVAILABLE_IN_REST';
          statusLabel = 'Not Available (In HQ Rest)';
          statusReason = lrRestInfo.remarksText || 'In statutory HQ rest (< 8h required before next booking)';
          currentLocation = '🏠 GNT (In HQ Rest)';
          catBreakdown.in_hq_rest++;
        } else if (status === 'AVAILABLE_FOR_BOOKING') {
          isAvailable = true;
          dotStatus = 'GREEN';
          if (isSickReturn || (overrideReason && /sick/i.test(overrideReason))) {
            statusCategory = 'AVAILABLE_SICK_RETURN';
            statusLabel = 'Available (Sick Return)';
            statusReason = overrideReason || 'Reported fit / came out of sick leave; spare at HQ GNT available for duty booking';
            currentLocation = '🏠 GNT (Headquarters)';
            catBreakdown.available_sick_return++;
          } else {
            statusCategory = 'AVAILABLE_LEAVE_RETURN';
            statusLabel = 'Available (1-Day Leave Return)';
            statusReason = overrideReason || 'Completed 1-day leave on multi-day link; spare at HQ GNT available for duty booking';
            currentLocation = '🏠 GNT (Headquarters)';
            catBreakdown.available_leave_return++;
          }
        } else if (cat.id === 4 && !override && !isCat4RestDay) {
          // LR Staff on regular standby day
          const arrTimeStr = (lrRestInfo && lrRestInfo.arrivalTime) ? ` (Arr GNT ${lrRestInfo.arrivalTime})` : '';
          if (lrRestInfo && lrRestInfo.restStatus === 'REST_COMPLETED_12H') {
            isAvailable = true;
            dotStatus = 'GREEN';
            statusCategory = 'AVAILABLE_12H_REST';
            statusLabel = `Available${arrTimeStr || ' (12h Rest Complete)'}`;
            statusReason = lrRestInfo.remarksText || `12h full HQ rest complete; available for duty booking${arrTimeStr}`;
            currentLocation = `🏠 GNT${arrTimeStr}`;
            catBreakdown.available_12h_rest++;
          } else if (lrRestInfo && lrRestInfo.restStatus === 'REST_COMPLETED_8H') {
            isAvailable = true;
            dotStatus = 'GREEN';
            statusCategory = 'AVAILABLE_8H_REST';
            statusLabel = `Available${arrTimeStr || ' (Min 8h Rest Complete)'}`;
            statusReason = lrRestInfo.remarksText || `Statutory min 8h HQ rest complete; ready for duty booking${arrTimeStr}`;
            currentLocation = `🏠 GNT${arrTimeStr}`;
            catBreakdown.available_8h_rest++;
          } else {
            isAvailable = true;
            dotStatus = 'GREEN';
            statusCategory = 'AVAILABLE_STANDBY';
            statusLabel = `Available${arrTimeStr || ' (HQ Standby Pool)'}`;
            statusReason = lrRestInfo?.remarksText || 'In LR Standby Pool at HQ; full rest available';
            currentLocation = `🏠 GNT${arrTimeStr}`;
            catBreakdown.available_standby++;
          }
        } else if (isRest || status === 'REST') {
          // Weekly Rest at HQ
          isAvailable = true;
          dotStatus = 'GREEN';
          statusCategory = 'AVAILABLE_WEEKLY_REST';
          statusLabel = 'Available (Weekly Rest at HQ)';
          statusReason = 'Weekly rest day at Headquarters GNT; available for call-up / emergency booking (earns CR)';
          currentLocation = '🏠 GNT (Weekly Rest)';
          catBreakdown.available_weekly_rest++;
        } else if (((!targetDate || targetDate >= '2026-10-01') ? [53, 54, 55] : [60, 61, 62]).includes(activeLink) || (dutyDetails && dutyDetails.train_numbers && String(dutyDetails.train_numbers).toUpperCase().includes('NON DAILY'))) {
          // Category 2 Non-Daily Links (53, 54, 55 from Oct 1, 2026)
          if (override && (override.extra_train_no || override.advance_train_no)) {
            isAvailable = false;
            dotStatus = 'RED';
            statusCategory = 'NOT_AVAILABLE_BOOKED';
            statusLabel = `Not Available (Working Extra Tr. ${override.extra_train_no || override.advance_train_no})`;
            statusReason = `Assigned to Non-Daily Train ${override.extra_train_no || override.advance_train_no}`;
            currentLocation = `🚆 Working Train (${override.extra_train_no || override.advance_train_no})`;
            catBreakdown.booked_to_duty++;
          } else if (override && override.shifted_place === 'NON_DAILY_RETURN') {
            isAvailable = false;
            dotStatus = 'RED';
            statusCategory = 'NOT_AVAILABLE_OUTSTATION';
            statusLabel = 'Not Available (Return Leg)';
            statusReason = override.reason || 'Working Day 2 Return Leg of Non-Daily Service';
            currentLocation = '🚆 Outstation Return';
            catBreakdown.outstation++;
          } else if (override && override.shifted_place === 'NON_DAILY_REST') {
            isAvailable = false;
            dotStatus = 'YELLOW';
            statusCategory = 'NOT_AVAILABLE_REST';
            statusLabel = 'In Statutory HQ Rest';
            statusReason = override.reason || '8h HQ Rest after 3-day non-daily service';
            currentLocation = '🏠 GNT (HQ Rest)';
            catBreakdown.available_weekly_rest++;
          } else {
            isAvailable = true;
            dotStatus = 'GREEN';
            statusCategory = 'AVAILABLE_NON_DAILY';
            statusLabel = `Available (Non-Daily Link #${activeLink})`;
            statusReason = `In Non-Daily Link #${activeLink} pool at HQ; available for duty booking`;
            currentLocation = '🏠 GNT (Non-Daily Pool)';
            catBreakdown.available_standby++;
          }
        } else if (fromStation && fromStation !== 'GNT' && fromStation !== '---') {
          isAvailable = false;
          dotStatus = 'RED';
          statusCategory = 'NOT_AVAILABLE_OUTSTATION';
          statusLabel = 'Not Available (Outstation)';
          statusReason = `Working Link #${activeLink} (${trainNumbers}) from outstation ${fromStation}`;
          currentLocation = `🚆 Outstation (${fromStation})`;
          catBreakdown.outstation++;
        } else {
          // Booked to train departing from GNT
          isAvailable = false;
          dotStatus = 'RED';
          statusCategory = 'NOT_AVAILABLE_BOOKED';
          statusLabel = `Not Available (Working Tr. ${trainNumbers})`;
          statusReason = `Assigned Link #${activeLink} on Train ${trainNumbers} (${fromStation || 'GNT'} ➔ ${toStation || '---'})`;
          currentLocation = `🚆 Working Train (${fromStation || 'GNT'} ➔ ${toStation || '---'})`;
          catBreakdown.booked_to_duty++;
        }

        if (!vacant) {
          catNamedCount++;
          if (isAvailable) {
            catAvailable++;
          } else {
            catNotAvailable++;
          }
        }

        staffList.push({
          staffId: staff.id,
          name: staff.name,
          designation: staff.designation,
          rowPosition: staff.row_position,
          categoryId: cat.id,
          categoryName: cat.name,
          categoryCode: cat.code,
          target_category_id: override?.target_category_id || cat.id,
          rest_day: staff.rest_day,
          pf_no: staff.pf_no,
          is_vacant: vacant,
          is_available: isAvailable,
          dot_status: dotStatus,
          status_category: statusCategory,
          status_label: statusLabel,
          status_reason: statusReason,
          current_location: currentLocation,
          link_number: activeLink,
          original_link_number: getBaseLinkNumber(staff.row_position, dayOffset, catCycleLength),
          isOverridden,
          status,
          muster_code: musterCode,
          muster_remarks: musterRemarks,
          overrideReason,
          substituteStaffId,
          substituteName,
          train_numbers: trainNumbers,
          from_station: fromStation,
          to_station: toStation,
          coaches: coaches,
          cr_available: crInfo.display,
          cr_count: crInfo.count,
          cr_dates: crInfo.dates,
          lr_rest_info: lrRestInfo
        });
      }

      // Sort staff: available first (GREEN), then not available (RED), by rowPosition
      staffList.sort((a, b) => {
        if (a.is_vacant !== b.is_vacant) return a.is_vacant ? 1 : -1;
        if (a.is_available !== b.is_available) return a.is_available ? -1 : 1;
        return a.rowPosition - b.rowPosition;
      });

      grandTotalStaff += catNamedCount;
      grandAvailable += catAvailable;
      grandNotAvailable += catNotAvailable;
      Object.keys(catBreakdown).forEach(k => grandBreakdown[k] += catBreakdown[k]);

      categoryData.push({
        categoryId: cat.id,
        categoryName: cat.name,
        categoryCode: cat.code,
        total_staff: catNamedCount,
        available_count: catAvailable,
        not_available_count: catNotAvailable,
        availability_percentage: catNamedCount > 0 ? Math.round((catAvailable / catNamedCount) * 100) : 0,
        breakdown: catBreakdown,
        staff: staffList
      });
    }

    const grandPercentage = grandTotalStaff > 0 ? Math.round((grandAvailable / grandTotalStaff) * 100) : 0;

    return ({
      date: targetDate,
      dayOfWeek: currentDayName,
      summary: {
        total_staff: grandTotalStaff,
        available_count: grandAvailable,
        not_available_count: grandNotAvailable,
        availability_percentage: grandPercentage,
        percentage: grandPercentage,
        breakdown: grandBreakdown
      },
      categories: categoryData
    });
}
