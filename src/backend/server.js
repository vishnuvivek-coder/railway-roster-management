const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { initDb, run, all, get } = require('./db');
const { getDayOffset, getBaseLinkNumber } = require('./rotation');
const { findScheduledRestDate, computeRestAdjustment, getWeekday, getWeeklyRestWeekday } = require('./restAdjustment');
const { getDutyRowsForLinkNumber } = require('./ta_generator');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'railway_roster_luxury_editorial_secret_2026';

app.use(cors());
app.use(bodyParser.json());

// Initialize Database on startup
initDb().then(async () => {
  console.log('Database loaded and ready.');
  // Purge any stale dummy cache records, stale pre-calculated approval claims, and stale ta/nda entries
  try {
    await run("DELETE FROM actual_train_runs");
    await run("DELETE FROM ta_approvals");
    await run("DELETE FROM ta_entries");
    await run("DELETE FROM nda_entries");
    console.log('Purged actual_train_runs, ta_approvals, ta_entries, and nda_entries for fresh dynamic calculation.');
  } catch (e) {
    console.error('Failed to clean caches on startup:', e);
  }
  // Auto-sync LR sheet records with any existing Daily Duty allotments
  try {
    await backfillLRSheetFromOverrides();
  } catch (e) {
    console.error('Failed to backfill LR sheet overrides on startup:', e);
  }
}).catch(err => {
  console.error('Database initialization failed:', err);
});

function formatDateDisplay(iso) {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
}

// Helper: Log audit action
async function logAudit(role, actionType, description, undoData = null) {
  try {
    const undoJson = undoData ? (typeof undoData === 'string' ? undoData : JSON.stringify(undoData)) : null;
    await run(
      'INSERT INTO audit_logs (user_role, action_type, description, undo_data, is_undone) VALUES (?, ?, ?, ?, 0)',
      [role, actionType, description, undoJson]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// Auth Middleware: Extract JWT user if present
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    req.user = null;
    return next();
  }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) req.user = null;
    else req.user = user;
    next();
  });
}

// Middleware: Enforce Admin Role for Write/Edit Operations
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Permission denied: Administrator privileges required to modify data.' });
  }
  next();
}

app.use(authenticateToken);

// Helper: Get active link definition for a link number on a given date
async function getActiveLinkDef(categoryId, linkNumber, dateStr) {
  const catId = parseInt(categoryId, 10);
  let link = null;
  if (catId && catId !== 4) {
    link = await get(
      `SELECT * FROM links 
       WHERE category_id = ? AND link_number = ? 
         AND date(effective_from) <= date(?) 
         AND date(effective_to) >= date(?)`,
      [catId, linkNumber, dateStr, dateStr]
    );
  }
  if (!link) {
    link = await get(
      `SELECT * FROM links 
       WHERE link_number = ? 
         AND category_id != 4
         AND date(effective_from) <= date(?) 
         AND date(effective_to) >= date(?)
       ORDER BY category_id ASC LIMIT 1`,
      [linkNumber, dateStr, dateStr]
    );
  }
  return link || { link_number: linkNumber, is_rest: 1, train_numbers: 'REST', from_station: '', to_station: '', coaches: '' };
}


// Link Set definitions for Indian Railways cyclic links
const KNOWN_LINK_SETS = {
  1: [
    [1, 2, 3],
    [4, 5, 6],
    [8, 9],
    [10, 11],
    [12, 13],
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

// Helper: Check if staff took leave / sick on a 2 or 3 day link duty on previous day(s), making them available at HQ today
async function checkMultiDayLeaveReturn(staffId, categoryId, rowPosition, cycleLength, anchorDate, targetDateStr) {
  // Helper: Check if staff was on leave / sick on a given date (across overrides, leave requests, and muster records)
  async function checkStaffLeaveOnDate(dateStr) {
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
    // Check all previous days of this link set (starting from Day 1)
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

  // Fallback check for any link where departure is from an outstation (where from_station !== 'GNT' and !== '---')
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
const STANDARD_GNT_ARRIVALS = {
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

function findGntArrivalForLink(catId, linkNum, lDef) {
  if (lDef) {
    const toStn = (lDef.to_station || '').toUpperCase();
    if (toStn === 'GNT' || toStn.endsWith('/GNT') || toStn.endsWith(', GNT')) {
      const trains = (lDef.train_numbers || '').split(',').map(t => t.trim().replace(/[^0-9]/g, '')).filter(Boolean);
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

/**
 * Computes last duty completion and Headquarters (GNT) rest status for LR staff.
 * Railway Rule: Minimum 8 to 12 hours rest at headquarters GNT after completing last duty
 * before being available for booking.
 */
async function getStaffLastDutyAndRestStatus(staffId, targetDateStr, customNow) {
  // 1. Check explicit manual/recorded entries in lr_duty_completions
  const manual = await get(
    `SELECT * FROM lr_duty_completions 
     WHERE staff_id = ? AND date(arrival_date) <= date(?)
     ORDER BY date(arrival_date) DESC, arrival_time DESC LIMIT 1`,
    [staffId, targetDateStr]
  );

  let lastDuty = null;
  if (manual) {
    lastDuty = {
      trainNo: manual.last_train_no,
      fromStation: manual.from_station || '---',
      toStation: manual.to_station || 'GNT',
      arrivalDate: manual.arrival_date,
      arrivalTime: manual.arrival_time,
      restHoursRequired: manual.rest_hours_required || 12,
      source: 'RECORDED_COMPLETION',
      notes: manual.notes || ''
    };
  }

  // 2. Check overrides for staff_id (substitute duty or changed link on previous dates up to 7 days)
  if (!lastDuty) {
    const overrides = await all(
      `SELECT * FROM overrides 
       WHERE staff_id = ? AND date(date) <= date(?)
       ORDER BY date(date) DESC LIMIT 7`,
      [staffId, targetDateStr]
    );

    for (const ov of overrides) {
      if (ov.status === 'REST' || ov.status === 'SICK' || ov.status === 'LEAVE' || ov.status === 'CR') {
        continue;
      }
      const linkNum = ov.overridden_link_number;
      if (linkNum !== null && linkNum !== undefined) {
        let catId = 1;
        if (ov.substitute_staff_id) {
          const origStaff = await get('SELECT category_id FROM staff WHERE id = ?', [ov.substitute_staff_id]);
          if (origStaff) catId = origStaff.category_id;
        } else {
          const me = await get('SELECT category_id FROM staff WHERE id = ?', [staffId]);
          if (me && me.category_id !== 4) catId = me.category_id;
        }

        const lDef = await getActiveLinkDef(catId, linkNum, ov.date);
        if (lDef) {
          const trainArr = findGntArrivalForLink(catId, linkNum, lDef);
          if (trainArr) {
            lastDuty = {
              trainNo: trainArr.trainNo,
              fromStation: trainArr.fromStation,
              toStation: 'GNT',
              arrivalDate: ov.date,
              arrivalTime: trainArr.arrivalTime,
              restHoursRequired: 12,
              source: `SUBSTITUTE_LINK_${linkNum}`,
              notes: ov.reason || ''
            };
            break;
          }
        }
      }
    }
  }

  // 3. Check non-daily trains
  if (!lastDuty) {
    const ndTrains = await all(
      `SELECT * FROM non_daily_trains 
       WHERE assigned_staff_id = ? AND arrival_station = 'GNT'`,
      [staffId]
    );
    if (ndTrains && ndTrains.length > 0) {
      const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      for (let daysBack = 0; daysBack <= 6; daysBack++) {
        const d = new Date(targetDateStr);
        d.setDate(d.getDate() - daysBack);
        const dStr = d.toISOString().split('T')[0];
        const dayOfWeek = dayNames[d.getDay()];
        const matchedTrain = ndTrains.find(t => (t.day_of_week || '').toUpperCase() === dayOfWeek);
        if (matchedTrain) {
          lastDuty = {
            trainNo: matchedTrain.train_number,
            fromStation: matchedTrain.departure_station || '---',
            toStation: 'GNT',
            arrivalDate: dStr,
            arrivalTime: matchedTrain.arrival_time || '23:00',
            restHoursRequired: 12,
            source: 'NON_DAILY_TRAIN',
            notes: matchedTrain.remarks || ''
          };
          break;
        }
      }
    }
  }

  // 4. Check duty_register_entry
  if (!lastDuty) {
    const drEntry = await get(
      `SELECT e.* FROM duty_register_entry e
       JOIN duty_register_staff s ON e.id = s.entry_id
       WHERE s.staff_id = ? AND date(e.date) <= date(?)
       ORDER BY date(e.date) DESC LIMIT 1`,
      [staffId, targetDateStr]
    );
    if (drEntry && (drEntry.train_return || drEntry.train_out)) {
      const trainNo = drEntry.train_return || drEntry.train_out;
      const arrTime = STANDARD_GNT_ARRIVALS[trainNo] || '23:00';
      lastDuty = {
        trainNo,
        fromStation: '---',
        toStation: 'GNT',
        arrivalDate: drEntry.date,
        arrivalTime: arrTime,
        restHoursRequired: 12,
        source: 'DUTY_REGISTER',
        notes: drEntry.notes || ''
      };
    }
  }

  // Fallback: If no recent duty on record -> stationed at HQ on standby
  if (!lastDuty) {
    return {
      hasLastDuty: false,
      lastTrainNo: null,
      fromStation: '---',
      toStation: 'GNT',
      arrivalDate: null,
      arrivalTime: null,
      rest8hTime: null,
      rest12hTime: null,
      restElapsedHours: null,
      restStatus: 'HQ_STANDBY',
      isAvailableForBooking: true,
      statusBadgeText: '⚡ Available for Booking',
      statusBadgeSubtext: 'HQ Standby Pool',
      badgeColor: '#10b981',
      badgeBg: 'rgba(16, 185, 129, 0.15)',
      remarksText: 'LR Standby Pool • Full HQ Rest Available • Ready for Booking'
    };
  }

  // Normalize arrival time e.g. "6:55" -> "06:55"
  let cleanTime = (lastDuty.arrivalTime || '23:00').trim();
  if (cleanTime.length === 4 && cleanTime.indexOf(':') === 1) {
    cleanTime = '0' + cleanTime;
  }
  const arrIso = `${lastDuty.arrivalDate}T${cleanTime}:00`;
  const arrDateTime = new Date(arrIso);

  const rest8hDateTime = new Date(arrDateTime.getTime() + 8 * 3600 * 1000);
  const rest12hDateTime = new Date(arrDateTime.getTime() + 12 * 3600 * 1000);

  const formatTimeWithDate = (d) => {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const mon = d.toLocaleString('en-GB', { month: 'short' });
    return `${hh}:${mm} (${dd}-${mon})`;
  };

  const rest8hStr = formatTimeWithDate(rest8hDateTime);
  const rest12hStr = formatTimeWithDate(rest12hDateTime);

  // Determine current evaluation point
  const now = customNow || new Date();
  const formatLocalDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const todayStr = formatLocalDate(now);
  const isToday = targetDateStr === todayStr || targetDateStr === now.toISOString().split('T')[0];
  const evalPoint = isToday ? now : new Date(`${targetDateStr}T12:00:00`);

  const elapsedMs = evalPoint.getTime() - arrDateTime.getTime();
  const elapsedHours = Math.max(0, Math.round((elapsedMs / (3600 * 1000)) * 10) / 10);

  let restStatus = 'REST_COMPLETED_12H';
  let isAvailableForBooking = true;
  let statusBadgeText = '⚡ Available for Booking';
  let statusBadgeSubtext = '12h Rest Completed';
  let badgeColor = '#10b981';
  let badgeBg = 'rgba(16, 185, 129, 0.18)';
  let remarksText = `Tr. ${lastDuty.trainNo} arr GNT ${cleanTime} (${lastDuty.arrivalDate}) • ${elapsedHours}h HQ Rest Given • Ready for Booking`;

  if (evalPoint.getTime() < rest8hDateTime.getTime()) {
    restStatus = 'IN_HQ_REST';
    isAvailableForBooking = false;
    statusBadgeText = '⏳ In HQ Rest';
    statusBadgeSubtext = `Resting until ${rest8hStr}`;
    badgeColor = '#f59e0b';
    badgeBg = 'rgba(245, 158, 11, 0.18)';
    const remainingMs = rest8hDateTime.getTime() - evalPoint.getTime();
    const remainingHours = Math.max(0.1, Math.round((remainingMs / (3600 * 1000)) * 10) / 10);
    remarksText = `Tr. ${lastDuty.trainNo} arr GNT ${cleanTime} (${lastDuty.arrivalDate}) • In HQ Rest (${remainingHours}h left until 8h at ${rest8hStr}, 12h at ${rest12hStr})`;
  } else if (evalPoint.getTime() < rest12hDateTime.getTime()) {
    restStatus = 'REST_COMPLETED_8H';
    isAvailableForBooking = true;
    statusBadgeText = '⚡ Available for Booking';
    statusBadgeSubtext = 'Min 8h Rest Completed';
    badgeColor = '#059669';
    badgeBg = 'rgba(5, 150, 105, 0.18)';
    remarksText = `Tr. ${lastDuty.trainNo} arr GNT ${cleanTime} (${lastDuty.arrivalDate}) • Min 8h Rest Done (${elapsedHours}h elapsed) • Full 12h at ${rest12hStr}`;
  }

  return {
    hasLastDuty: true,
    lastTrainNo: lastDuty.trainNo,
    fromStation: lastDuty.fromStation,
    toStation: 'GNT',
    arrivalDate: lastDuty.arrivalDate,
    arrivalTime: cleanTime,
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

// Helper: Calculate Compensatory Rest (CR) balances for all staff
// When an employee is booked for duty outside their link duty and forgoes their rest day,
// they earn 1 CR with the date of the rest they forwent.
async function calculateStaffCrBalances() {
  const staffMembers = await all('SELECT * FROM staff ORDER BY id');
  const categories = await all('SELECT * FROM categories');
  const catMap = {};
  categories.forEach(c => catMap[c.id] = c);

  const links = await all('SELECT * FROM links');
  const linkRestMap = {};
  links.forEach(l => {
    linkRestMap[l.category_id + '_' + l.link_number] = l.is_rest;
  });

  const allOverrides = await all('SELECT * FROM overrides ORDER BY date ASC');
  const allMuster = await all("SELECT * FROM muster_records ORDER BY date ASC");
  const musterMap = {};
  allMuster.forEach(m => {
    musterMap[`${m.staff_id}_${m.date}`] = m;
  });
  const allLrSheet = await all("SELECT * FROM lr_sheet_records ORDER BY date ASC");
  const lrSheetMap = {};
  allLrSheet.forEach(l => {
    lrSheetMap[`${l.staff_id}_${l.date}`] = l;
  });
  
  function formatDateDisplay(iso) {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return iso;
  }

  const crMap = {};

  for (const staff of staffMembers) {
    const cat = catMap[staff.category_id];
    if (!cat) continue;

    const staffOverrides = allOverrides.filter(o => o.staff_id === staff.id);
    const staffMuster = allMuster.filter(m => m.staff_id === staff.id);
    const staffLr = allLrSheet.filter(l => l.staff_id === staff.id);
    const restForgoneRecords = [];
    const crRedeemedDates = [];

    // Collect all unique dates with overrides, muster records, or LR sheet for this staff
    const relevantDates = new Set();
    staffOverrides.forEach(o => relevantDates.add(o.date));
    staffMuster.forEach(m => relevantDates.add(m.date));
    staffLr.forEach(l => relevantDates.add(l.date));
    const sortedDates = Array.from(relevantDates).sort();

    for (const dStr of sortedDates) {
      const o = staffOverrides.find(ov => ov.date === dStr);
      const m = musterMap[`${staff.id}_${dStr}`];
      const lr = lrSheetMap[`${staff.id}_${dStr}`];

      // Check if CR was redeemed / availed on this date
      if ((o && (o.status === 'CR' || o.leave_type === 'CR')) || (m && m.code === 'CR') || (lr && lr.duty_code === 'CR')) {
        crRedeemedDates.push({
          date: dStr,
          dateDisplay: formatDateDisplay(dStr),
          reason: (o && o.reason) || (m && m.remarks) || (lr && lr.remarks) || 'Compensatory Rest Availed'
        });
        continue;
      }

      // Check if original scheduled duty for this staff on this date was REST
      const dayOffset = getDayOffset(cat.anchor_date, dStr);
      const origLink = getBaseLinkNumber(staff.row_position, dayOffset, cat.cycle_length);

      let isOrigRest = false;
      const dObj = new Date(dStr + 'T12:00:00');
      const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const dayNamesLong = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = days[dObj.getDay()];
      const dayLong = dayNamesLong[dObj.getDay()];

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

      // Check if employee worked on this date (via override, muster Present, or LR duty)
      const isWorkingOverride = o && (
        o.overridden_link_number !== null ||
        o.is_extra === 1 ||
        o.extra_train_no ||
        o.advance_train_no ||
        o.shifted_place ||
        o.status === 'EXTRA_CREW' ||
        o.status === 'CHANGED_LINK' ||
        o.status === 'SUBSTITUTE'
      ) && o.status !== 'REST' && o.status !== 'LEAVE' && o.status !== 'SICK' && o.status !== 'CR' && o.status !== 'ABSENT';

      const isWorkingMuster = m && m.code === 'P';
      const isWorkingLr = lr && lr.duty_code && !['R', 'REST', 'L', 'SICK', 'CR', 'O', 'S'].includes(lr.duty_code.toUpperCase());

      const explicitRestWorked = (o && o.reason && /rest day worked|cr credit|cr against rest/i.test(o.reason)) ||
                                (m && m.remarks && /rest day worked|cr credit|cr against rest/i.test(m.remarks)) ||
                                (lr && lr.remarks && /rest day worked|cr credit|cr against rest/i.test(lr.remarks));

      if ((isOrigRest && (isWorkingOverride || isWorkingMuster || isWorkingLr)) || explicitRestWorked) {
        let dutyDesc = '';
        if (o && o.extra_train_no) dutyDesc = `Train ${o.extra_train_no} (Extra)`;
        else if (o && o.advance_train_no) dutyDesc = `Train ${o.advance_train_no} (Advance)`;
        else if (o && o.overridden_link_number) dutyDesc = `Link #${o.overridden_link_number}`;
        else if (o && o.shifted_place) dutyDesc = `Shifted to ${o.shifted_place}`;
        else if (o && o.status === 'SUBSTITUTE') dutyDesc = `Substitute${o.substitute_name ? ` for ${o.substitute_name}` : ''}`;
        else if (lr && lr.duty_code) dutyDesc = `Duty ${lr.duty_code}`;
        else if (m && m.remarks) dutyDesc = m.remarks;
        else dutyDesc = 'Duty Performed';

        const recordReason = (o && o.reason) || (m && m.remarks) || (lr && lr.remarks) || 'Worked without availing scheduled rest';

        if (!restForgoneRecords.some(r => r.date === dStr)) {
          restForgoneRecords.push({
            date: dStr,
            dateDisplay: formatDateDisplay(dStr),
            dayOfWeek: dayName,
            dayOfWeekLong: dayLong,
            duty: dutyDesc,
            restType: restTypeDesc || 'Scheduled Rest',
            reason: recordReason
          });
        }
      }
    }

    // Unredeemed rest forgone records (FIFO deduction)
    const unredeemedRecords = restForgoneRecords.slice(crRedeemedDates.length);
    const count = unredeemedRecords.length;
    const unredeemedDates = unredeemedRecords.map(r => r.date);

    if (count > 0) {
      const datesStr = unredeemedRecords.map(r => r.dateDisplay).join(', ');
      crMap[staff.id] = {
        count,
        dates: unredeemedDates,
        due_dates: unredeemedRecords,
        all_forgone_records: restForgoneRecords,
        redeemed_dates: crRedeemedDates,
        display: count === 1 ? `1 CR (Rest forgone on ${datesStr})` : `${count} CRs (Rest forgone on ${datesStr})`,
        shortDisplay: count === 1 ? `1 CR (${datesStr})` : `${count} CRs (${datesStr})`
      };
    } else {
      crMap[staff.id] = {
        count: 0,
        dates: [],
        due_dates: [],
        all_forgone_records: restForgoneRecords,
        redeemed_dates: crRedeemedDates,
        display: null,
        shortDisplay: '-'
      };
    }
  }

  return crMap;
}

// ----------------------------------------------------
// AUTHENTICATION & USER MANAGEMENT API
// ----------------------------------------------------

// Register New Employee / User
app.post('/api/auth/register', async (req, res) => {
  const { username, name, email, password, role, staff_id } = req.body;
  if (!username || !name || !password) {
    return res.status(400).json({ error: 'Username, Full Name, and Password are required.' });
  }

  if (password.length < 5) {
    return res.status(400).json({ error: 'Password must be at least 5 characters long.' });
  }

  const cleanUsername = username.trim().toLowerCase();

  try {
    // Check if username already taken
    const existing = await get('SELECT id FROM users WHERE username = ?', [cleanUsername]);
    if (existing) {
      return res.status(400).json({ error: 'This username is already registered. Please choose another.' });
    }

    if (email && email.trim()) {
      const existingEmail = await get('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
      if (existingEmail) {
        return res.status(400).json({ error: 'This email is already associated with an account.' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const assignedRole = role === 'Admin' ? 'Staff' : (role || 'Staff'); // Only Master Admin can elevate to Admin

    const result = await run(
      `INSERT INTO users (username, name, email, password_hash, role, status, staff_id, created_at)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, CURRENT_TIMESTAMP)`,
      [cleanUsername, name.trim(), email ? email.trim().toLowerCase() : null, passwordHash, assignedRole, staff_id || null]
    );

    await logAudit('System', 'USER_REGISTER', `New user registration: ${cleanUsername} (${name}) - Status: PENDING`);

    res.json({
      success: true,
      message: 'Account registration submitted successfully! Your account is pending administrator verification.',
      status: 'PENDING',
      userId: result.lastID
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const cleanUsername = username.trim().toLowerCase();

  try {
    const user = await get(
      'SELECT id, username, name, email, password_hash, role, status, staff_id, created_at, approved_at, approved_by FROM users WHERE username = ? OR email = ?',
      [cleanUsername, cleanUsername]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Status verification check
    if (user.status === 'PENDING') {
      return res.status(403).json({
        error: 'Your account is currently PENDING verification by the Administrator. Please contact the Master Admin to approve your account.',
        status: 'PENDING'
      });
    }

    if (user.status === 'REJECTED') {
      return res.status(403).json({
        error: 'Your account registration was not approved or has been suspended. Please contact the administrator.',
        status: 'REJECTED'
      });
    }

    // Issue JWT Token for approved user
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        status: user.status
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    await logAudit(user.role, 'USER_LOGIN', `User ${user.username} (${user.name}) logged in`);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        staff_id: user.staff_id
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// Verify Current User Session
app.get('/api/auth/me', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await get(
      'SELECT id, username, name, email, role, status, staff_id, created_at, approved_at FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!user || user.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Account not active or not approved' });
    }

    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session token' });
  }
});

// Admin: List all registered users with verification status
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await all(`
      SELECT u.id, u.username, u.name, u.email, u.role, u.status, u.staff_id, 
             u.created_at, u.approved_at, u.approved_by,
             s.name as staff_name, s.designation as staff_designation
      FROM users u
      LEFT JOIN staff s ON u.staff_id = s.id
      ORDER BY 
        CASE 
          WHEN u.status = 'PENDING' THEN 0 
          WHEN u.status = 'APPROVED' THEN 1 
          ELSE 2 
        END, 
        u.created_at DESC
    `);

    const counts = {
      total: users.length,
      pending: users.filter(u => u.status === 'PENDING').length,
      approved: users.filter(u => u.status === 'APPROVED').length,
      rejected: users.filter(u => u.status === 'REJECTED').length
    };

    res.json({ users, counts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Approve a user registration
app.put('/api/admin/users/:id/approve', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const approver = req.user ? req.user.username : 'Admin';

  try {
    const targetUser = await get('SELECT username, name FROM users WHERE id = ?', [id]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    await run(
      `UPDATE users SET status = 'APPROVED', approved_at = CURRENT_TIMESTAMP, approved_by = ? WHERE id = ?`,
      [approver, id]
    );

    await logAudit('Admin', 'APPROVE_USER', `Approved user account: ${targetUser.username} (${targetUser.name}) by ${approver}`);

    res.json({ success: true, message: `User ${targetUser.name} (${targetUser.username}) has been approved and can now log in.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Reject a user registration
app.put('/api/admin/users/:id/reject', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const rejecter = req.user ? req.user.username : 'Admin';

  try {
    const targetUser = await get('SELECT username, name FROM users WHERE id = ?', [id]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.username === 'admin') {
      return res.status(400).json({ error: 'Cannot reject the Master Admin account.' });
    }

    await run(
      `UPDATE users SET status = 'REJECTED', approved_at = CURRENT_TIMESTAMP, approved_by = ? WHERE id = ?`,
      [rejecter, id]
    );

    await logAudit('Admin', 'REJECT_USER', `Rejected user account: ${targetUser.username} (${targetUser.name}) by ${rejecter}`);

    res.json({ success: true, message: `User ${targetUser.name} (${targetUser.username}) registration has been rejected.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Update user role
app.put('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!role || !['Admin', 'Staff', 'Viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be Admin, Staff, or Viewer.' });
  }

  try {
    const targetUser = await get('SELECT username, name, role FROM users WHERE id = ?', [id]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    await run('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    await logAudit('Admin', 'CHANGE_USER_ROLE', `Changed role for ${targetUser.username} from ${targetUser.role} to ${role}`);

    res.json({ success: true, message: `Role for ${targetUser.username} updated to ${role}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Delete a user
app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const targetUser = await get('SELECT username, name FROM users WHERE id = ?', [id]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.username === 'admin') {
      return res.status(400).json({ error: 'Cannot delete the Master Admin account.' });
    }

    await run('DELETE FROM users WHERE id = ?', [id]);
    await logAudit('Admin', 'DELETE_USER', `Deleted user account: ${targetUser.username} (${targetUser.name})`);

    res.json({ success: true, message: `User ${targetUser.username} deleted successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// CATEGORY API
// ----------------------------------------------------
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await all('SELECT * FROM categories');
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', requireAdmin, async (req, res) => {
  const { name, code, cycle_length, anchor_date } = req.body;
  if (!name || !code || !cycle_length || !anchor_date) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  try {
    const result = await run(
      'INSERT INTO categories (name, code, cycle_length, anchor_date) VALUES (?, ?, ?, ?)',
      [name, code, cycle_length, anchor_date]
    );
    await logAudit('Admin', 'CREATE_CATEGORY', `Created category ${name} (${code})`);
    res.json({ id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/categories/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, code, cycle_length, anchor_date } = req.body;
  try {
    await run(
      'UPDATE categories SET name = ?, code = ?, cycle_length = ?, anchor_date = ? WHERE id = ?',
      [name, code, cycle_length, anchor_date, id]
    );
    await logAudit('Admin', 'UPDATE_CATEGORY', `Updated category ID ${id} to ${name}`);
    res.json({ message: 'Category updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const category = await get('SELECT name FROM categories WHERE id = ?', [id]);
    await run('DELETE FROM categories WHERE id = ?', [id]);
    await logAudit('Admin', 'DELETE_CATEGORY', `Deleted category ${category?.name} (ID: ${id})`);
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// SENIORITY LIST API (139 STAFF MEMBERS OF GUNTUR DIVISION)
// ----------------------------------------------------
app.get('/api/seniority-list', async (req, res) => {
  const { q, designation, sort } = req.query;
  try {
    let sql = 'SELECT * FROM seniority_list WHERE 1=1';
    const params = [];
    if (designation && designation !== 'ALL') {
      if (designation === 'TTI') {
        // VS Chandrika is kept in TTI list for working purpose
        sql += " AND (designation = 'TTI' OR working_designation = 'TTI' OR name LIKE '%CHANDRIKA%')";
      } else if (designation === 'COR') {
        sql += " AND designation = 'COR' AND name NOT LIKE '%CHANDRIKA%'";
      } else {
        sql += ' AND designation = ?';
        params.push(designation);
      }
    }
    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      sql += ' AND (name LIKE ? OR designation LIKE ? OR working_designation LIKE ? OR pf_number LIKE ? OR contact_number LIKE ? OR cug_number LIKE ? OR email LIKE ? OR CAST(sl_no AS TEXT) LIKE ?)';
      params.push(term, term, term, term, term, term, term, term);
    }
    if (sort === 'hierarchy') {
      sql += ' ORDER BY hierarchy_tier ASC, desg_rank ASC, sl_no ASC';
    } else {
      sql += ' ORDER BY sl_no ASC';
    }
    const list = await all(sql, params);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/seniority-list/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, designation, cug_number, contact_number, pf_number, email } = req.body;
  try {
    await run(
      `UPDATE seniority_list 
       SET name = COALESCE(?, name),
           designation = COALESCE(?, designation),
           cug_number = COALESCE(?, cug_number),
           contact_number = COALESCE(?, contact_number),
           pf_number = COALESCE(?, pf_number),
           email = COALESCE(?, email)
       WHERE id = ?`,
      [name, designation, cug_number, contact_number, pf_number, email, id]
    );
    await logAudit(req.user?.name || 'Admin', 'UPDATE_SENIORITY', `Updated Seniority record ID ${id} (${name || ''})`);
    res.json({ message: 'Seniority record updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// STAFF API
// ----------------------------------------------------
app.get('/api/staff', async (req, res) => {
  const { category_id } = req.query;
  try {
    let sql = 'SELECT * FROM staff';
    let params = [];
    if (category_id) {
      sql += ' WHERE category_id = ? ORDER BY row_position';
      params.push(category_id);
    } else {
      sql += ' ORDER BY category_id, row_position';
    }
    const staff = await all(sql, params);
    const crBalances = await calculateStaffCrBalances();
    const staffWithCr = staff.map(s => {
      const cr = crBalances[s.id];
      return {
        ...s,
        cr_available: cr ? cr.display : null,
        cr_short_display: cr ? cr.shortDisplay : '-',
        cr_count: cr ? cr.count : 0,
        cr_dates: cr ? cr.dates : [],
        cr_due_dates: cr ? cr.due_dates : []
      };
    });
    res.json(staffWithCr);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/staff/cr-balances', async (req, res) => {
  try {
    const balances = await calculateStaffCrBalances();
    res.json(balances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/staff/:id/cr-details - Detailed CR balance, due records, and redemption history for an employee
app.get('/api/staff/:id/cr-details', async (req, res) => {
  try {
    const staffId = parseInt(req.params.id, 10);
    const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });
    const crBalances = await calculateStaffCrBalances();
    const cr = crBalances[staffId] || {
      count: 0,
      dates: [],
      due_dates: [],
      all_forgone_records: [],
      redeemed_dates: [],
      display: null,
      shortDisplay: '-'
    };
    res.json({
      staff_id: staff.id,
      staff_name: staff.name,
      designation: staff.designation,
      category_id: staff.category_id,
      rest_day: staff.rest_day,
      count: cr.count,
      dates: cr.dates,
      due_dates: cr.due_dates,
      all_forgone_records: cr.all_forgone_records,
      redeemed_dates: cr.redeemed_dates,
      display: cr.display,
      shortDisplay: cr.shortDisplay
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/staff/:id/recent-duties - Returns recent duties performed by a staff member before a target date
app.get('/api/staff/:id/recent-duties', async (req, res) => {
  try {
    const staffId = parseInt(req.params.id, 10);
    const beforeDateStr = req.query.date || new Date().toISOString().split('T')[0];
    const limit = Math.min(parseInt(req.query.limit, 10) || 7, 30);

    const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });
    const category = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
    const allLinks = await all('SELECT * FROM links ORDER BY category_id ASC, link_number ASC');
    
    const results = [];
    const curr = new Date(beforeDateStr + 'T12:00:00');
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    
    // Look back up to 21 days to find up to `limit` records
    for (let i = 1; i <= 21 && results.length < limit; i++) {
      const d = new Date(curr);
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const dow = dayNames[d.getDay()];
      
      // 1. Check override directly for this staff
      const ov = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staffId, dStr]);
      // 2. Check substitute override where this staff worked as substitute
      const subOv = await get('SELECT * FROM overrides WHERE substitute_staff_id = ? AND date = ?', [staffId, dStr]);
      // 3. Check non-daily assignment
      const nd = await get('SELECT * FROM non_daily_trains WHERE assigned_staff_id = ? AND UPPER(day_of_week) = ?', [staffId, dow]);
      // 4. Check manual duty completion
      const manual = await get('SELECT * FROM lr_duty_completions WHERE staff_id = ? AND arrival_date = ?', [staffId, dStr]);
      
      let dutyText = '';
      let dutyType = 'WORK'; // 'WORK', 'REST', 'LEAVE', 'SICK', 'ABSENT', 'STANDBY'
      let trainNo = '';
      let route = '';
      let linkNum = null;
      let coaches = '';
      let notes = '';
      
      if (ov) {
        if (ov.status === 'LEAVE') {
          dutyText = `Leave (${ov.leave_type || 'CL'})`;
          dutyType = 'LEAVE';
          notes = ov.reason || '';
        } else if (ov.status === 'SICK') {
          dutyText = `Sick (${ov.leave_type || 'MC'})`;
          dutyType = 'SICK';
          notes = ov.reason || '';
        } else if (ov.status === 'ABSENT') {
          dutyText = 'Absent [O]';
          dutyType = 'ABSENT';
          notes = ov.reason || '';
        } else if (ov.status === 'REST') {
          dutyText = 'Weekly Rest';
          dutyType = 'REST';
        } else if (ov.extra_train_no) {
          dutyText = `Train ${ov.extra_train_no} (Special/Non-Daily)`;
          trainNo = ov.extra_train_no;
          dutyType = 'WORK';
          notes = ov.reason || '';
        } else if (ov.shifted_place) {
          dutyText = `Shifted: ${ov.shifted_place}`;
          dutyType = 'WORK';
          notes = ov.reason || '';
        } else if (ov.overridden_link_number !== null && ov.overridden_link_number !== undefined) {
          linkNum = ov.overridden_link_number;
          const lDef = allLinks.find(l => l.link_number === linkNum && l.category_id === (ov.target_category_id || staff.category_id))
                     || allLinks.find(l => l.link_number === linkNum);
          if (lDef && lDef.is_rest) {
            dutyText = 'Weekly Rest';
            dutyType = 'REST';
          } else {
            trainNo = lDef ? lDef.train_numbers : '';
            route = lDef ? `${lDef.from_station} ➔ ${lDef.to_station}` : '';
            coaches = lDef ? lDef.coaches : '';
            dutyText = `Link #${linkNum}${trainNo ? ` (${trainNo})` : ''}`;
            dutyType = 'WORK';
          }
          notes = ov.reason || '';
        }
      } else if (subOv) {
        linkNum = subOv.overridden_link_number;
        const lDef = allLinks.find(l => l.link_number === linkNum);
        trainNo = lDef ? lDef.train_numbers : '';
        route = lDef ? `${lDef.from_station} ➔ ${lDef.to_station}` : '';
        coaches = lDef ? lDef.coaches : '';
        dutyText = `Relief on Link #${linkNum}${trainNo ? ` (${trainNo})` : ''}`;
        dutyType = 'WORK';
        notes = subOv.reason || 'Relief duty';
      } else if (nd) {
        dutyText = `Non-Daily Train ${nd.train_number}${nd.last_day_train_number ? '/' + nd.last_day_train_number : ''}`;
        trainNo = nd.train_number;
        route = `${nd.departure_station || ''} ➔ ${nd.arrival_station || ''}`;
        coaches = nd.coaches || '';
        dutyType = 'WORK';
        notes = nd.remarks || '';
      } else if (manual) {
        dutyText = `Train ${manual.last_train_no}`;
        trainNo = manual.last_train_no;
        route = `${manual.from_station || '---'} ➔ ${manual.to_station || 'GNT'}`;
        dutyType = 'WORK';
        notes = manual.notes || '';
      } else if (staff.category_id && staff.category_id !== 4 && category) {
        const offset = getDayOffset(category.anchor_date, dStr);
        linkNum = getBaseLinkNumber(staff.row_position, offset, category.cycle_length);
        const lDef = allLinks.find(l => l.link_number === linkNum && l.category_id === category.id);
        if (lDef && lDef.is_rest) {
          dutyText = 'Weekly Rest';
          dutyType = 'REST';
        } else if (lDef) {
          trainNo = lDef.train_numbers || '';
          route = `${lDef.from_station || ''} ➔ ${lDef.to_station || ''}`;
          coaches = lDef.coaches || '';
          dutyText = `Link #${linkNum}${trainNo ? ` (${trainNo})` : ''}`;
          dutyType = 'WORK';
        } else {
          dutyText = `Link #${linkNum}`;
          dutyType = 'WORK';
        }
      } else if (staff.category_id === 4) {
        // LR staff
        const restDay = (staff.rest_day || '').toUpperCase().trim();
        if (restDay && (restDay === dow || restDay === dow.substring(0, 3))) {
          dutyText = 'Designated Weekly Rest';
          dutyType = 'REST';
        } else {
          dutyText = 'LR Standby / Available at HQ';
          dutyType = 'STANDBY';
        }
      }
      
      results.push({
        date: dStr,
        day_of_week: dow,
        duty_text: dutyText,
        duty_type: dutyType,
        train_number: trainNo,
        route,
        link_number: linkNum,
        coaches,
        notes
      });
    }

    res.json({
      staff: {
        id: staff.id,
        name: staff.name,
        designation: staff.designation,
        category_id: staff.category_id,
        category_name: category ? category.name : 'Staff'
      },
      target_date: beforeDateStr,
      recent_duties: results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record or adjust LR staff duty completion (arrival at GNT & HQ rest)
app.post('/api/staff/lr-duty-completion', requireAdmin, async (req, res) => {
  const { staff_id, last_train_no, arrival_date, arrival_time, rest_hours_required, notes } = req.body;
  if (!staff_id || !arrival_date || !arrival_time) {
    return res.status(400).json({ error: 'staff_id, arrival_date, and arrival_time are required' });
  }

  try {
    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    await run(
      `INSERT INTO lr_duty_completions (staff_id, last_train_no, from_station, to_station, arrival_date, arrival_time, rest_hours_required, notes, updated_by)
       VALUES (?, ?, '---', 'GNT', ?, ?, ?, ?, 'Admin')
       ON CONFLICT(staff_id, arrival_date) DO UPDATE SET
         last_train_no = excluded.last_train_no,
         arrival_time = excluded.arrival_time,
         rest_hours_required = excluded.rest_hours_required,
         notes = excluded.notes,
         updated_by = 'Admin',
         updated_at = CURRENT_TIMESTAMP`,
      [staff_id, last_train_no || 'MANUAL', arrival_date, arrival_time, rest_hours_required || 12, notes || '']
    );

    await logAudit('Admin', 'LR_DUTY_COMPLETION', `Recorded duty completion for ${staff.name}: Train ${last_train_no || 'Duty'} arr GNT ${arrival_time} on ${arrival_date}`);

    const evalDate = req.body.target_date || new Date().toISOString().split('T')[0];
    const updatedRest = await getStaffLastDutyAndRestStatus(staff_id, evalDate);
    res.json({ success: true, message: `Recorded duty completion and HQ rest for ${staff.name}`, restInfo: updatedRest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List recorded LR duty completions
app.get('/api/staff/lr-duty-completions', async (req, res) => {
  const { staff_id, date } = req.query;
  try {
    let sql = 'SELECT c.*, s.name as staff_name, s.designation FROM lr_duty_completions c JOIN staff s ON c.staff_id = s.id';
    const params = [];
    const conditions = [];
    if (staff_id) {
      conditions.push('c.staff_id = ?');
      params.push(staff_id);
    }
    if (date) {
      conditions.push('c.arrival_date = ?');
      params.push(date);
    }
    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY date(c.arrival_date) DESC, c.arrival_time DESC LIMIT 50';

    const rows = await all(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get detailed HQ rest status for a specific staff member
app.get('/api/staff/lr-rest-status/:staffId', async (req, res) => {
  const { staffId } = req.params;
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];
  try {
    const restInfo = await getStaffLastDutyAndRestStatus(staffId, targetDate);
    res.json(restInfo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/staff', requireAdmin, async (req, res) => {
  const { name, designation, category_id, row_position, rest_day } = req.body;
  if (!name || !category_id) {
    return res.status(400).json({ error: 'Name and Category ID are required' });
  }
  try {
    let pos = row_position;
    if (!pos) {
      const maxPos = await get('SELECT MAX(row_position) as maxPos FROM staff WHERE category_id = ?', [category_id]);
      pos = (maxPos.maxPos || 0) + 1;
    } else {
      // Shift other staff members down if row_position is manually specified
      await run(
        'UPDATE staff SET row_position = row_position + 1 WHERE category_id = ? AND row_position >= ?',
        [category_id, pos]
      );
    }

    const result = await run(
      'INSERT INTO staff (name, designation, category_id, row_position, rest_day) VALUES (?, ?, ?, ?, ?)',
      [name, designation || null, category_id, pos, rest_day || null]
    );

    await logAudit('Admin', 'ADD_STAFF', `Added staff member '${name}' at position ${pos}${rest_day ? ` with Rest Day: ${rest_day}` : ''}`);
    res.json({ id: result.lastID, row_position: pos, rest_day });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/staff/reorder', requireAdmin, async (req, res) => {
  const { reorders } = req.body; // Array of { id, row_position }
  if (!Array.isArray(reorders)) {
    return res.status(400).json({ error: 'Invalid reorders data' });
  }
  try {
    for (const item of reorders) {
      await run('UPDATE staff SET row_position = ? WHERE id = ?', [item.row_position, item.id]);
    }
    await logAudit('Admin', 'REORDER_STAFF', 'Reordered staff seniority/row positions');
    res.json({ message: 'Staff reordered successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/staff/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, designation, row_position, active, pf_no, bill_unit, pay_amount, doa, hq_station, rest_day, hrms_id, seniority_no } = req.body;
  try {
    const currentStaff = await get('SELECT * FROM staff WHERE id = ?', [id]);
    if (!currentStaff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    if (row_position && row_position !== currentStaff.row_position) {
      const catId = currentStaff.category_id;
      // Shift others
      if (row_position > currentStaff.row_position) {
        await run(
          'UPDATE staff SET row_position = row_position - 1 WHERE category_id = ? AND row_position > ? AND row_position <= ?',
          [catId, currentStaff.row_position, row_position]
        );
      } else {
        await run(
          'UPDATE staff SET row_position = row_position + 1 WHERE category_id = ? AND row_position >= ? AND row_position < ?',
          [catId, row_position, currentStaff.row_position]
        );
      }
    }

    const targetName = name !== undefined ? name.trim() : currentStaff.name;
    const targetDesg = designation !== undefined ? designation.trim() : currentStaff.designation;
    const targetHrms = hrms_id !== undefined ? hrms_id.trim() : currentStaff.hrms_id;
    const targetPf = pf_no !== undefined ? pf_no.trim() : currentStaff.pf_no;

    await run(
      `UPDATE staff 
       SET name = ?, 
           designation = ?, 
           row_position = COALESCE(?, row_position), 
           active = COALESCE(?, active),
           pf_no = ?,
           bill_unit = COALESCE(?, bill_unit),
           pay_amount = COALESCE(?, pay_amount),
           doa = COALESCE(?, doa),
           hq_station = COALESCE(?, hq_station),
           rest_day = COALESCE(?, rest_day),
           hrms_id = ?,
           seniority_no = COALESCE(?, seniority_no)
       WHERE id = ?`,
      [targetName, targetDesg, row_position || null, active !== undefined ? active : null, targetPf, bill_unit || null, pay_amount || null, doa || null, hq_station || null, rest_day || null, targetHrms, seniority_no || null, id]
    );

    // Sync seniority_list if matching pf_no or seniority_no exists
    try {
      if (currentStaff.seniority_no || currentStaff.pf_no || targetPf) {
        await run(`UPDATE seniority_list 
                   SET name = ?,
                       designation = ?,
                       pf_number = ?
                   WHERE sl_no = ? OR pf_number = ? OR pf_number = ?`,
          [targetName, targetDesg, targetPf, currentStaff.seniority_no, currentStaff.pf_no, targetPf]
        );
      }
    } catch (e) {}

    const updated = await get('SELECT * FROM staff WHERE id = ?', [id]);
    await logAudit('Admin', 'UPDATE_STAFF', `Updated staff member ID ${id} (${targetName}, PF: ${targetPf}, Desg: ${targetDesg}, HRMS: ${targetHrms})`);
    res.json({ message: 'Staff updated successfully', staff: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/staff/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const staff = await get('SELECT * FROM staff WHERE id = ?', [id]);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    await run('DELETE FROM staff WHERE id = ?', [id]);
    
    // Shift all subsequent staff up to close the gap
    await run(
      'UPDATE staff SET row_position = row_position - 1 WHERE category_id = ? AND row_position > ?',
      [staff.category_id, staff.row_position]
    );

    await logAudit('Admin', 'DELETE_STAFF', `Deleted staff member '${staff.name}'`);
    res.json({ message: 'Staff member deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Formula for COR rest day by row position
const COR_REST_DAYS_MAP = {
  1: 'MON', 2: 'SUN', 3: 'SAT', 4: 'FRI', 5: 'THU', 6: 'WED', 7: 'TUE',
  8: 'MON', 9: 'SUN', 10: 'SAT', 11: 'FRI', 12: 'THU', 13: 'WED', 14: 'TUE',
  15: 'MON', 16: 'SUN', 17: 'SAT', 18: 'FRI', 19: 'THU', 20: 'WED', 21: 'TUE'
};

function getCorRestDay(rowPosition) {
  const norm = ((rowPosition - 1) % 21) + 1;
  return COR_REST_DAYS_MAP[norm] || 'MON';
}

// GET /api/staff/cor-links-summary
// Summary of all links in COR (Category 1), with their current occupant and whether vacant
app.get('/api/staff/cor-links-summary', async (req, res) => {
  try {
    const corCategory = await get('SELECT * FROM categories WHERE id = 1');
    if (!corCategory) {
      return res.status(404).json({ error: 'COR category not found' });
    }

    const corLinks = await all(
      `SELECT * FROM links WHERE category_id = 1 ORDER BY link_number ASC`
    );
    const corStaff = await all(
      `SELECT * FROM staff WHERE category_id = 1 ORDER BY row_position ASC`
    );

    const isVacant = (name) => {
      if (!name) return true;
      const n = name.trim().toUpperCase();
      return n.includes('VACANT') || n === 'V' || n === '(V)';
    };

    const linksSummary = corLinks.map(link => {
      const staffAtPos = corStaff.find(s => s.row_position === link.link_number);
      const vacant = !staffAtPos || isVacant(staffAtPos.name);
      return {
        link_number: link.link_number,
        train_numbers: link.train_numbers,
        from_station: link.from_station,
        to_station: link.to_station,
        coaches: link.coaches,
        is_rest: link.is_rest === 1,
        scheduled_rest_day: getCorRestDay(link.link_number),
        occupant: staffAtPos ? {
          id: staffAtPos.id,
          name: staffAtPos.name,
          designation: staffAtPos.designation,
          pf_no: staffAtPos.pf_no,
          rest_day: staffAtPos.rest_day || getCorRestDay(link.link_number),
          is_vacant: vacant
        } : null,
        is_vacant: vacant
      };
    });

    res.json({
      category: corCategory,
      total_links: corLinks.length,
      links: linksSummary
    });
  } catch (err) {
    console.error('Error in /api/staff/cor-links-summary:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/staff/upgrade-to-cor
// Upgrade an employee from another category to COR (Category 1).
// Preserves their old slot as VACANT (V) and adjusts their link, rest day, and designation in COR.
app.post('/api/staff/upgrade-to-cor', requireAdmin, async (req, res) => {
  const {
    staff_id,
    target_cor_row,
    target_action = 'FILL_VACANT', // 'FILL_VACANT' | 'REPLACE_TO_VACANT' | 'SWAP' | 'INSERT_SHIFT'
    new_designation = 'CTI',
    new_rest_day
  } = req.body;

  if (!staff_id || !target_cor_row) {
    return res.status(400).json({ error: 'staff_id and target_cor_row are required' });
  }

  const targetRowInt = parseInt(target_cor_row, 10);
  if (isNaN(targetRowInt) || targetRowInt < 1) {
    return res.status(400).json({ error: 'Invalid target_cor_row' });
  }

  const isVacant = (name) => {
    if (!name) return true;
    const n = name.trim().toUpperCase();
    return n.includes('VACANT') || n === 'V' || n === '(V)';
  };

  try {
    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const oldCatId = staff.category_id;
    const oldRowPos = staff.row_position;
    const oldStaffName = staff.name;
    const oldRestDay = staff.rest_day;

    if (oldCatId === 1) {
      return res.status(400).json({ error: 'Employee is already in Conductors (COR) category' });
    }

    const oldCategory = await get('SELECT * FROM categories WHERE id = ?', [oldCatId]);

    // Check existing occupant at target_cor_row in Category 1
    const currentOccupant = await get(
      'SELECT * FROM staff WHERE category_id = 1 AND row_position = ?',
      [targetRowInt]
    );

    const calculatedRestDay = new_rest_day || getCorRestDay(targetRowInt);
    const updatedDesignation = new_designation || 'CTI';

    await run('BEGIN TRANSACTION');

    try {
      if (currentOccupant) {
        const occupantIsVacant = isVacant(currentOccupant.name);

        if (occupantIsVacant || target_action === 'FILL_VACANT') {
          // Delete vacant placeholder in COR
          await run('DELETE FROM staff WHERE id = ?', [currentOccupant.id]);
        } else if (target_action === 'REPLACE_TO_VACANT') {
          // Replace occupant (outgoing conductor can be replaced and deleted from slot)
          await run('DELETE FROM staff WHERE id = ?', [currentOccupant.id]);
        } else if (target_action === 'SWAP') {
          // Current occupant moves to the old place in old category
          await run('UPDATE staff SET row_position = -999 WHERE id = ?', [currentOccupant.id]);
          await run(
            `UPDATE staff 
             SET category_id = 1, row_position = ?, designation = ?, rest_day = ?
             WHERE id = ?`,
            [targetRowInt, updatedDesignation, calculatedRestDay, staff_id]
          );
          await run(
            `UPDATE staff 
             SET category_id = ?, row_position = ?, designation = ?
             WHERE id = ?`,
            [oldCatId, oldRowPos, currentOccupant.designation || '', currentOccupant.id]
          );
          await run('COMMIT');
          await logAudit(
            'Admin',
            'UPGRADE_TO_COR_SWAP',
            `Swapped employee '${oldStaffName}' into COR Link ${targetRowInt} and '${currentOccupant.name}' to ${oldCategory?.name || 'Category ' + oldCatId} (Row ${oldRowPos})`
          );
          return res.json({
            success: true,
            message: `Successfully swapped '${oldStaffName}' to COR Link ${targetRowInt}`,
            upgraded_staff: { id: staff_id, name: oldStaffName, category_id: 1, row_position: targetRowInt },
            swapped_staff: { id: currentOccupant.id, name: currentOccupant.name, category_id: oldCatId, row_position: oldRowPos }
          });
        } else if (target_action === 'INSERT_SHIFT') {
          // Shift existing staff down
          const staffToShift = await all(
            'SELECT id, row_position FROM staff WHERE category_id = 1 AND row_position >= ? ORDER BY row_position DESC',
            [targetRowInt]
          );
          for (const s of staffToShift) {
            await run('UPDATE staff SET row_position = row_position + 1 WHERE id = ?', [s.id]);
          }
        }
      }

      // 1. Move upgraded employee into Category 1 (COR) at targetRowInt
      await run(
        `UPDATE staff 
         SET category_id = 1, 
             row_position = ?, 
             designation = ?, 
             rest_day = ?
         WHERE id = ?`,
        [targetRowInt, updatedDesignation, calculatedRestDay, staff_id]
      );

      // 2. Preserve older place in old category as VACANT (V)
      await run(
        `INSERT INTO staff (name, designation, category_id, row_position, rest_day, active)
         VALUES (?, ?, ?, ?, ?, 1)`,
        ['VACANT (V)', '', oldCatId, oldRowPos, oldRestDay || null]
      );

      await run('COMMIT');

      const upgradedStaff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
      const vacantPlaceholder = await get(
        'SELECT * FROM staff WHERE category_id = ? AND row_position = ?',
        [oldCatId, oldRowPos]
      );

      await logAudit(
        'Admin',
        'UPGRADE_TO_COR',
        `Upgraded employee '${oldStaffName}' from ${oldCategory?.name || 'Category ' + oldCatId} (Row ${oldRowPos}) to Conductors (COR) at Link ${targetRowInt}. Older place preserved as VACANT (V).`
      );

      res.json({
        success: true,
        message: `Successfully upgraded '${oldStaffName}' to Conductors (COR) Link ${targetRowInt}. Older slot at Row ${oldRowPos} in ${oldCategory?.name || 'Old Category'} is now VACANT (V).`,
        upgraded_staff: upgradedStaff,
        vacant_record: vacantPlaceholder
      });
    } catch (txErr) {
      await run('ROLLBACK');
      throw txErr;
    }
  } catch (err) {
    console.error('Error upgrading employee to COR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// LINK MASTER API
// ----------------------------------------------------
app.get('/api/links', async (req, res) => {
  const { category_id } = req.query;
  try {
    let sql = 'SELECT * FROM links';
    let params = [];
    if (category_id) {
      sql += ' WHERE category_id = ? ORDER BY link_number, effective_from';
      params.push(category_id);
    } else {
      sql += ' ORDER BY category_id, link_number, effective_from';
    }
    const links = await all(sql, params);
    res.json(links);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/links/reorder', requireAdmin, async (req, res) => {
  const { reorders } = req.body;
  if (!Array.isArray(reorders)) {
    return res.status(400).json({ error: 'Invalid reorders data' });
  }
  try {
    for (const item of reorders) {
      await run('UPDATE links SET link_number = ? WHERE id = ?', [item.link_number, item.id]);
    }
    await logAudit('Admin', 'REORDER_LINKS', 'Reordered train roster / link numbers');
    res.json({ message: 'Links reordered successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/links', requireAdmin, async (req, res) => {
  const { category_id, link_number, train_numbers, from_station, to_station, coaches, is_rest, effective_from, set_type, set_name } = req.body;
  if (!category_id || !link_number || !effective_from) {
    return res.status(400).json({ error: 'Category ID, Link Number and Effective From date are required' });
  }
  try {
    // Check if there is an overlapping link definition and set its effective_to
    const previous = await get(
      `SELECT * FROM links 
       WHERE category_id = ? AND link_number = ? AND effective_to = '9999-12-31' 
         AND date(effective_from) < date(?)`,
      [category_id, link_number, effective_from]
    );
    if (previous) {
      // Calculate one day before effective_from
      const prevEnd = new Date(new Date(effective_from) - 86400000).toISOString().split('T')[0];
      await run('UPDATE links SET effective_to = ? WHERE id = ?', [prevEnd, previous.id]);
    }

    const result = await run(
      `INSERT INTO links (category_id, link_number, train_numbers, from_station, to_station, coaches, is_rest, effective_from, set_type, set_name) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [category_id, link_number, train_numbers, from_station, to_station, coaches, is_rest ? 1 : 0, effective_from, set_type || '2-Day Set', set_name || null]
    );

    await logAudit('Admin', 'CREATE_LINK', `Created Link ${link_number} for Category ${category_id}`);
    res.json({ id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/links/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  console.log('PUT /api/links/:id body:', req.body);
  const { train_numbers, from_station, to_station, coaches, is_rest, effective_from, effective_to, set_type, set_name } = req.body;
  try {
    await run(
      `UPDATE links 
       SET train_numbers = ?, from_station = ?, to_station = ?, coaches = ?, is_rest = ?, effective_from = ?, effective_to = ?, set_type = ?, set_name = ? 
       WHERE id = ?`,
      [train_numbers, from_station, to_station, coaches, is_rest ? 1 : 0, effective_from, effective_to || '9999-12-31', set_type || '2-Day Set', set_name !== undefined ? set_name : null, id]
    );
    await logAudit('Admin', 'UPDATE_LINK', `Updated Link ID ${id}`);
    res.json({ message: 'Link updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/links/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await run('DELETE FROM links WHERE id = ?', [id]);
    await logAudit('Admin', 'DELETE_LINK', `Deleted Link ID ${id}`);
    res.json({ message: 'Link deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/links/clear-all', requireAdmin, async (req, res) => {
  try {
    await run('DELETE FROM links');
    await logAudit('Admin', 'CLEAR_ALL_LINKS', 'Cleared all roster links / train entries');
    res.json({ message: 'All links cleared successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// NON-DAILY TRAINS API
// ----------------------------------------------------
app.get('/api/non-daily-trains', async (req, res) => {
  const { day_of_week, date } = req.query;
  try {
    let day = day_of_week;
    if (date && !day) {
      const parts = String(date).split('-');
      if (parts.length === 3) {
        const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
        const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        day = days[dObj.getDay()];
      }
    }

    let sql = 'SELECT * FROM non_daily_trains';
    let params = [];
    if (day) {
      sql += ' WHERE UPPER(day_of_week) = ? ORDER BY id';
      params.push(day.toUpperCase());
    } else {
      sql += ' ORDER BY CASE day_of_week ' +
             "WHEN 'SUNDAY' THEN 1 WHEN 'MONDAY' THEN 2 WHEN 'TUESDAY' THEN 3 " +
             "WHEN 'WEDNESDAY' THEN 4 WHEN 'THURSDAY' THEN 5 WHEN 'FRIDAY' THEN 6 WHEN 'SATURDAY' THEN 7 ELSE 8 END, id";
    }

    const trains = await all(sql, params);
    res.json(trains);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/non-daily-trains', requireAdmin, async (req, res) => {
  const { day_of_week, train_number, last_day_train_number, departure_station, departure_time, arrival_station, arrival_time, coaches, last_day_coaches, remarks, assigned_staff_id, assigned_staff_name } = req.body;
  if (!day_of_week || !train_number) {
    return res.status(400).json({ error: 'Day of week and Train number are required' });
  }
  try {
    const result = await run(
      `INSERT INTO non_daily_trains 
       (day_of_week, train_number, last_day_train_number, departure_station, departure_time, arrival_station, arrival_time, coaches, last_day_coaches, remarks, assigned_staff_id, assigned_staff_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        day_of_week.toUpperCase(), 
        train_number, 
        last_day_train_number || null, 
        departure_station || '', 
        departure_time || '', 
        arrival_station || '', 
        arrival_time || '', 
        coaches || 'SL / AC', 
        last_day_coaches || coaches || 'SL / AC', 
        remarks || null, 
        assigned_staff_id || null, 
        assigned_staff_name || null
      ]
    );
    await logAudit('Admin', 'ADD_NON_DAILY_TRAIN', `Added non-daily train ${train_number}${last_day_train_number ? '/' + last_day_train_number : ''} for ${day_of_week}`);
    res.json({ id: result.lastID, message: 'Non-daily train added successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/non-daily-trains/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { day_of_week, train_number, last_day_train_number, departure_station, departure_time, arrival_station, arrival_time, coaches, last_day_coaches, remarks, assigned_staff_id, assigned_staff_name } = req.body;
  try {
    const existingTrain = await get('SELECT * FROM non_daily_trains WHERE id = ?', [id]);
    if (!existingTrain) return res.status(404).json({ error: 'Non-daily train not found' });
    const oldTrainNo = existingTrain.train_number;

    await run(
      `UPDATE non_daily_trains
       SET day_of_week = COALESCE(?, day_of_week),
           train_number = COALESCE(?, train_number),
           last_day_train_number = ?,
           departure_station = COALESCE(?, departure_station),
           departure_time = COALESCE(?, departure_time),
           arrival_station = COALESCE(?, arrival_station),
           arrival_time = COALESCE(?, arrival_time),
           coaches = COALESCE(?, coaches),
           last_day_coaches = ?,
           remarks = ?,
           assigned_staff_id = ?,
           assigned_staff_name = ?
       WHERE id = ?`,
      [
        day_of_week ? day_of_week.toUpperCase() : (day_of_week === null ? null : existingTrain.day_of_week),
        train_number !== undefined ? train_number : existingTrain.train_number,
        last_day_train_number !== undefined ? last_day_train_number : existingTrain.last_day_train_number,
        departure_station !== undefined ? departure_station : existingTrain.departure_station,
        departure_time !== undefined ? departure_time : existingTrain.departure_time,
        arrival_station !== undefined ? arrival_station : existingTrain.arrival_station,
        arrival_time !== undefined ? arrival_time : existingTrain.arrival_time,
        coaches !== undefined ? coaches : existingTrain.coaches,
        last_day_coaches !== undefined ? last_day_coaches : existingTrain.last_day_coaches,
        remarks !== undefined ? remarks : existingTrain.remarks,
        assigned_staff_id !== undefined ? assigned_staff_id : existingTrain.assigned_staff_id,
        assigned_staff_name !== undefined ? assigned_staff_name : existingTrain.assigned_staff_name,
        id
      ]
    );

    if (train_number && oldTrainNo && oldTrainNo !== train_number) {
      await run('UPDATE overrides SET extra_train_no = ? WHERE extra_train_no = ?', [train_number, oldTrainNo]);
    }

    await logAudit('Admin', 'UPDATE_NON_DAILY_TRAIN', `Updated non-daily train ID ${id} (${oldTrainNo} ➔ ${train_number || oldTrainNo})`);

    // Sync with LR sheet if assigned staff is Category 4
    if (assigned_staff_id) {
      const staffObj = await get('SELECT category_id FROM staff WHERE id = ?', [assigned_staff_id]);
      if (staffObj && staffObj.category_id === 4) {
        const trainObj = await get('SELECT * FROM non_daily_trains WHERE id = ?', [id]);
        if (trainObj && trainObj.train_number && trainObj.day_of_week) {
          const dowUpper = trainObj.day_of_week.toUpperCase().substring(0, 3);
          const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
          for (let d = 1; d <= 30; d++) {
            const dObj = new Date(2026, 8, d);
            const dStr = `2026-09-${String(d).padStart(2, '0')}`;
            if (dayNames[dObj.getDay()] === dowUpper) {
              await syncLRSheetRecord(assigned_staff_id, dStr, trainObj.train_number, trainObj.remarks || `Non-daily train ${trainObj.train_number}`);
            }
          }
        }
      }
    }
    res.json({ message: 'Non-daily train updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/non-daily-trains/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  try {
    const existingTrain = await get('SELECT * FROM non_daily_trains WHERE id = ?', [id]);
    if (!existingTrain) return res.status(404).json({ error: 'Non-daily train not found' });

    const new1stTrain = updates.train_number !== undefined ? updates.train_number : existingTrain.train_number;
    const newLastTrain = updates.last_day_train_number !== undefined ? updates.last_day_train_number : existingTrain.last_day_train_number;
    const new1stCoach = updates.coaches !== undefined ? updates.coaches : existingTrain.coaches;
    const newLastCoach = updates.last_day_coaches !== undefined ? updates.last_day_coaches : existingTrain.last_day_coaches;
    const newRemarks = updates.remarks !== undefined ? updates.remarks : existingTrain.remarks;

    await run(
      `UPDATE non_daily_trains
       SET train_number = ?,
           last_day_train_number = ?,
           coaches = ?,
           last_day_coaches = ?,
           remarks = ?
       WHERE id = ?`,
      [new1stTrain, newLastTrain, new1stCoach, newLastCoach, newRemarks, id]
    );

    if (updates.train_number && existingTrain.train_number && existingTrain.train_number !== updates.train_number) {
      await run('UPDATE overrides SET extra_train_no = ? WHERE extra_train_no = ?', [updates.train_number, existingTrain.train_number]);
    }

    await logAudit('Admin', 'PATCH_NON_DAILY_TRAIN', `Quick-edited non-daily train ID ${id}`);
    res.json({ message: 'Non-daily train updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/non-daily-trains/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const train = await get('SELECT * FROM non_daily_trains WHERE id = ?', [id]);
    await run('DELETE FROM non_daily_trains WHERE id = ?', [id]);
    await logAudit('Admin', 'DELETE_NON_DAILY_TRAIN', `Deleted non-daily train ${train?.train_number} for ${train?.day_of_week}`);
    res.json({ message: 'Non-daily train deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// MANUAL OVERRIDES & AUDIT TRAIL API
// ----------------------------------------------------
app.post('/api/overrides', requireAdmin, async (req, res) => {
  const { staff_id, date, overridden_link_number, reason, target_category_id } = req.body;
  if (!staff_id || !date || reason === undefined || reason === null) {
    return res.status(400).json({ error: 'Staff ID, date and reason are required' });
  }
  try {
    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    const category = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
    
    // Compute original link number using rotation formula
    const dayOffset = getDayOffset(category.anchor_date, date);
    const originalLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);

    const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, date]);
    const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, date]);

    // Upsert override
    await run(
      `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, reason, target_category_id) 
       VALUES (?, ?, ?, ?, ?, ?) 
       ON CONFLICT(staff_id, date) 
       DO UPDATE SET overridden_link_number = excluded.overridden_link_number, reason = excluded.reason, target_category_id = excluded.target_category_id`,
      [staff_id, date, originalLink, overridden_link_number, reason, target_category_id || null]
    );

    // Multi-module synchronization
    await syncDutyChangeAcrossAllModules({ get, all, run }, staff_id, date, {
      targetLink: overridden_link_number,
      isLeave: false,
      isRest: overridden_link_number === null,
      remarks: reason
    });

    const undoData = {
      action: 'MANUAL_OVERRIDE',
      staff_id,
      staff_name: staff.name,
      date,
      previous_override: existingOverride || null,
      previous_muster: existingMuster || null
    };

    const targetDesc = overridden_link_number === null ? 'REST' : `Link ${overridden_link_number}`;
    await logAudit(
      'Admin',
      'MANUAL_OVERRIDE',
      `Overrode ${staff.name} on ${date} from Link ${originalLink} to ${targetDesc}. Reason: ${reason}`,
      undoData
    );

    res.json({ message: 'Override applied successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// COMPREHENSIVE DUTY STATUS & REPLACEMENT API
// Supports: SICK, LEAVE, CHANGED_LINK, RESET
// ----------------------------------------------------
app.post('/api/duty/change-status', requireAdmin, async (req, res) => {
  const {
    staff_id,
    date,
    to_date, // Optional multi-day range
    action, // 'SICK', 'LEAVE', 'CR', 'CHANGED_LINK', 'RESET'
    leave_type, // 'CL', 'LAP', 'LHAP', 'CCL', 'SCL', 'SICK', 'CR'
    day_wise_leaves, // Optional day-wise map or array: { [date]: { leave_type, reason, cr_earned_date } }
    reason,
    new_link_number,
    target_category_id,
    replacement_type, // 'OTHER_COLUMN', 'LR', 'UPGRADE_SLEEPER', 'CUSTOM', 'NONE'
    replacement_staff_id,
    replacement_name
  } = req.body;

  if (!staff_id || !date || !action) {
    return res.status(400).json({ error: 'staff_id, date, and action are required' });
  }

  try {
    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const category = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
    
    // Determine dates array to update (supports single date or date range)
    const datesToProcess = [];
    const startDate = new Date(date + 'T12:00:00');
    const endDate = (to_date && to_date >= date) ? new Date(to_date + 'T12:00:00') : startDate;
    const curDate = new Date(startDate);
    while (curDate <= endDate) {
      const y = curDate.getFullYear();
      const m = String(curDate.getMonth() + 1).padStart(2, '0');
      const d = String(curDate.getDate()).padStart(2, '0');
      datesToProcess.push(`${y}-${m}-${d}`);
      curDate.setDate(curDate.getDate() + 1);
    }
    if (datesToProcess.length === 0) datesToProcess.push(date);

    if (action === 'RESET' || action === 'CANCEL_LEAVE') {
      const undoSnapshots = [];
      for (const dStr of datesToProcess) {
        const existing = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
        const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
        let subOverride = null;
        let subMuster = null;
        if (existing && existing.substitute_staff_id) {
          subOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [existing.substitute_staff_id, dStr]);
          subMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [existing.substitute_staff_id, dStr]);
        }
        undoSnapshots.push({
          date: dStr,
          override: existing || null,
          muster: existingMuster || null,
          subOverride,
          subMuster
        });

        if (existing && existing.substitute_staff_id) {
          if (existing.status === 'SUBSTITUTE') {
            // If this staff was a substitute, clear substitute reference on original staff's override
            await run('UPDATE overrides SET substitute_staff_id = NULL, substitute_name = NULL WHERE staff_id = ? AND date = ?', [existing.substitute_staff_id, dStr]);
          } else {
            // If this staff was sick/leave, remove the substitute's override & reset their muster record
            await run('DELETE FROM overrides WHERE staff_id = ? AND date = ? AND status = "SUBSTITUTE"', [existing.substitute_staff_id, dStr]);
            await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [existing.substitute_staff_id, dStr]);
            // If substitute was an LR employee, clear their LR sheet record
            await run('DELETE FROM lr_sheet_records WHERE staff_id = ? AND date = ?', [existing.substitute_staff_id, dStr]);
          }
        }
        await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
        // Also delete from muster_records so attendance reverts to cyclic baseline
        await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);

        // If staff is an LR employee, clear their LR sheet record
        if (staff.category_id === 4) {
          await run('DELETE FROM lr_sheet_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
        }

        // Restore TA approvals and entries for both main staff and substitute
        const dateParts = dStr.split('-');
        const altDateStr = dateParts.length === 3 ? `${parseInt(dateParts[2], 10)}/${parseInt(dateParts[1], 10)}/${dateParts[0].slice(-2)}` : dStr;
        await restoreMusterTaApprovalsAndEntries(staff_id, dStr, altDateStr);
        if (existing && existing.substitute_staff_id) {
          await restoreMusterTaApprovalsAndEntries(existing.substitute_staff_id, dStr, altDateStr);
        }

        // Automatically cancel any approved leave_requests for this staff on this date
        await run(
          `UPDATE leave_requests SET status = 'CANCELLED' 
           WHERE staff_id = ? AND ((from_date <= ? AND to_date >= ?) OR date = ?) AND status = 'APPROVED'`,
          [staff_id, dStr, dStr, dStr]
        );

        // Also check if this staff was on 1-day leave on Day 1 of a multi-day link set on dStr,
        // which generated AVAILABLE_FOR_BOOKING overrides on subsequent days:
        const resetDayOffset = getDayOffset(category.anchor_date, dStr);
        const resetOrigLink = getBaseLinkNumber(staff.row_position, resetDayOffset, category.cycle_length);
        const resetLinkSet = getLinkSetDetails(staff.category_id, resetOrigLink);
        if (resetLinkSet && resetLinkSet.isFirstDayOfSet && resetLinkSet.remainingLinks.length > 0) {
          for (let k = 0; k < resetLinkSet.remainingLinks.length; k++) {
            const nextDate = new Date(dStr + 'T12:00:00');
            nextDate.setDate(nextDate.getDate() + k + 1);
            const y = nextDate.getFullYear();
            const m = String(nextDate.getMonth() + 1).padStart(2, '0');
            const d = String(nextDate.getDate()).padStart(2, '0');
            const nextDateStr = `${y}-${m}-${d}`;

            const subOv = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, nextDateStr]);
            if (subOv && subOv.status === 'AVAILABLE_FOR_BOOKING') {
              if (subOv.substitute_staff_id) {
                await run('DELETE FROM overrides WHERE staff_id = ? AND date = ? AND status = "SUBSTITUTE"', [subOv.substitute_staff_id, nextDateStr]);
                await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [subOv.substitute_staff_id, nextDateStr]);
              }
              await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, nextDateStr]);
              await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, nextDateStr]);
            }
          }
        }
      }

      const logMsg = action === 'CANCEL_LEAVE'
        ? `Cancelled leave for ${staff.name} between ${datesToProcess[0]} and ${datesToProcess[datesToProcess.length - 1]} and restored cyclic duty`
        : `Reset duty status and muster records for ${staff.name} between ${datesToProcess[0]} and ${datesToProcess[datesToProcess.length - 1]} to cyclic roster`;
      
      const undoData = {
        action,
        staff_id,
        staff_name: staff.name,
        dates: datesToProcess,
        snapshots: undoSnapshots
      };
      await logAudit('Admin', action === 'CANCEL_LEAVE' ? 'CANCEL_LEAVE' : 'RESET_DUTY', logMsg, undoData);

      const userMsg = action === 'CANCEL_LEAVE'
        ? `Leave cancelled successfully. ${staff.name} returned to original cyclic link duty!`
        : `Duty and muster records reset to cyclic roster for ${staff.name}`;
      return res.json({ success: true, message: userMsg });
    }

    if (action === 'WRONG_ALLOTMENT') {
      const undoSnapshots = [];
      const linkNum = req.body.link_number || req.body.new_link_number;
      const targetCatId = target_category_id || staff.category_id;
      const subAction = req.body.wrong_allotment_action || (replacement_staff_id ? 'REPLACE' : (replacement_type === 'RESET' ? 'RESET' : 'VACANT'));

      for (const dStr of datesToProcess) {
        const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
        const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
        let existingSubOverride = null;
        let existingSubMuster = null;
        if (replacement_staff_id) {
          existingSubOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [replacement_staff_id, dStr]);
          existingSubMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [replacement_staff_id, dStr]);
        }
        undoSnapshots.push({
          date: dStr,
          override: existingOverride || null,
          muster: existingMuster || null,
          subOverride: existingSubOverride || null,
          subMuster: existingSubMuster || null
        });

        // 1. Relieve the wrongly allotted employee (staff_id)
        if (existingOverride && (existingOverride.status === 'CHANGED_LINK' || existingOverride.status === 'SUBSTITUTE')) {
          // If staff_id was a substitute or placed on this link via override, clear that assignment
          if (existingOverride.substitute_staff_id) {
            await run('UPDATE overrides SET substitute_staff_id = NULL, substitute_name = NULL WHERE staff_id = ? AND date = ?', [existingOverride.substitute_staff_id, dStr]);
          }
          await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          if (staff.category_id === 4) {
            await run('DELETE FROM lr_sheet_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          }
        } else if (subAction === 'RESET') {
          await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          if (staff.category_id === 4) {
            await run('DELETE FROM lr_sheet_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
          }
        } else {
          // staff_id was cyclic occupant of this link, relieve them as AVAILABLE_FOR_BOOKING at HQ
          const dayOffset = getDayOffset(category.anchor_date, dStr);
          const origLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);
          await run(
            `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id)
             VALUES (?, ?, ?, NULL, 'AVAILABLE_FOR_BOOKING', ?, ?)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               overridden_link_number = NULL,
               status = 'AVAILABLE_FOR_BOOKING',
               reason = excluded.reason`,
            [
              staff_id,
              dStr,
              origLink,
              reason || 'Wrong allotment removed (Available at HQ)',
              staff.category_id
            ]
          );
          await run(
            `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
             VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               code = 'P',
               remarks = excluded.remarks,
               updated_by = excluded.updated_by,
               updated_at = CURRENT_TIMESTAMP`,
            [staff_id, dStr, 'Available at HQ (Wrong allotment removed)']
          );
        }

        // 2. If replacement employee is selected, assign them to this link
        if (replacement_staff_id) {
          const subStaff = await get('SELECT * FROM staff WHERE id = ?', [replacement_staff_id]);
          if (subStaff) {
            const subCat = await get('SELECT * FROM categories WHERE id = ?', [subStaff.category_id]);
            const subOrigLink = getBaseLinkNumber(subStaff.row_position, getDayOffset(subCat.anchor_date, dStr), subCat.cycle_length);
            const targetLinkVal = linkNum ? parseInt(linkNum, 10) : (existingOverride?.overridden_link_number || existingOverride?.original_link_number || null);

            await run(
              `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id)
               VALUES (?, ?, ?, ?, 'CHANGED_LINK', ?, ?)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 overridden_link_number = excluded.overridden_link_number,
                 status = 'CHANGED_LINK',
                 reason = excluded.reason,
                 target_category_id = excluded.target_category_id`,
              [
                subStaff.id,
                dStr,
                subOrigLink,
                targetLinkVal,
                reason || `Assigned to Link #${targetLinkVal} (Replaced wrong allotment of ${staff.name})`,
                targetCatId
              ]
            );

            await run(
              `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
               VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 code = 'P',
                 remarks = excluded.remarks,
                 updated_by = excluded.updated_by,
                 updated_at = CURRENT_TIMESTAMP`,
              [subStaff.id, dStr, `Working Link #${targetLinkVal}`]
            );

            if (subStaff.category_id === 4) {
              const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
              const dObj = new Date(dStr + 'T12:00:00');
              const dayOfWeek = dayNames[dObj.getDay()];
              const resolvedSubDuty = await resolveDutyCodeForLRStaff(subStaff.id, dStr, dayOfWeek, subStaff.rest_day);
              if (resolvedSubDuty && resolvedSubDuty.code) {
                await syncLRSheetRecord(subStaff.id, dStr, resolvedSubDuty.code, `Link #${targetLinkVal}`);
              }
            }
          }
        }
      }

      const auditMsg = replacement_staff_id
        ? `Removed wrong allotment for ${staff.name} on ${date} and replaced with ${replacement_name || 'selected employee'}`
        : `Removed wrong allotment for ${staff.name} on ${date}`;

      await logAudit('Admin', 'WRONG_ALLOTMENT', auditMsg, {
        staff_id,
        staff_name: staff.name,
        action: 'WRONG_ALLOTMENT',
        subAction,
        replacement_staff_id,
        snapshots: undoSnapshots
      });

      const returnMsg = replacement_staff_id
        ? `Wrong allotment removed! ${staff.name} relieved and replaced by ${replacement_name || 'selected employee'}.`
        : (subAction === 'RESET'
          ? `Wrong allotment removed! Restored to regular cyclic roster.`
          : `Wrong allotment removed! ${staff.name} relieved from this duty.`);

      return res.json({ success: true, message: returnMsg });
    }

    if (action === 'SICK' || action === 'LEAVE' || action === 'CR' || action === 'ABSENT' || action === 'REST') {
      let finalSubstituteName = replacement_name;
      if (!finalSubstituteName && replacement_staff_id) {
        const subStaffObj = await get('SELECT name FROM staff WHERE id = ?', [replacement_staff_id]);
        finalSubstituteName = subStaffObj ? subStaffObj.name : null;
      }

      // Determine leave type and muster code
      let effectiveLeaveType = leave_type;
      if (action === 'LEAVE') {
        effectiveLeaveType = leave_type || 'CL';
      } else if (action === 'SICK') {
        effectiveLeaveType = leave_type || 'LHAP';
      } else if (action === 'CR') {
        effectiveLeaveType = 'CR';
      } else if (action === 'ABSENT') {
        effectiveLeaveType = 'ABSENT';
      } else if (action === 'REST') {
        effectiveLeaveType = leave_type || 'REST';
      }

      let musterCode = effectiveLeaveType.toUpperCase();
      if (action === 'ABSENT') {
        musterCode = 'O';
      } else if (action === 'REST' || effectiveLeaveType === 'REST' || effectiveLeaveType === 'R') {
        musterCode = 'R';
      } else if (!ALLOWED_MUSTER_CODES.includes(musterCode)) {
        musterCode = action === 'LEAVE' ? 'CL' : (action === 'SICK' ? 'LHAP' : 'CR');
      }

      const undoSnapshots = [];

      for (const dStr of datesToProcess) {
        const dayOffset = getDayOffset(category.anchor_date, dStr);
        const originalLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);

        // Determine day-specific leave type and reason
        let dayLeaveType = effectiveLeaveType;
        let dayReason = reason;
        let dayAction = action;

        if (day_wise_leaves) {
          let dayConfig = null;
          if (Array.isArray(day_wise_leaves)) {
            dayConfig = day_wise_leaves.find(item => item && item.date === dStr);
          } else if (typeof day_wise_leaves === 'object') {
            dayConfig = day_wise_leaves[dStr];
          }

          if (dayConfig) {
            if (typeof dayConfig === 'string') {
              dayLeaveType = dayConfig.toUpperCase();
            } else if (typeof dayConfig === 'object') {
              if (dayConfig.leave_type) dayLeaveType = dayConfig.leave_type.toUpperCase();
              if (dayConfig.reason) dayReason = dayConfig.reason;
            }
          }
        }

        if (action === 'LEAVE' && dayLeaveType === 'CR') {
          dayAction = 'CR';
        } else if (action === 'LEAVE' && (dayLeaveType === 'REST' || dayLeaveType === 'R')) {
          dayAction = 'REST';
        } else if (action === 'CR' && dayLeaveType !== 'CR') {
          dayAction = (dayLeaveType === 'REST' || dayLeaveType === 'R') ? 'REST' : 'LEAVE';
        } else if (action === 'REST' && (dayLeaveType !== 'REST' && dayLeaveType !== 'R')) {
          dayAction = dayLeaveType === 'CR' ? 'CR' : 'LEAVE';
        }

        let dayMusterCode = dayLeaveType.toUpperCase();
        if (dayAction === 'ABSENT') {
          dayMusterCode = 'O';
        } else if (dayAction === 'REST' || dayLeaveType === 'REST' || dayLeaveType === 'R') {
          dayMusterCode = 'R';
        } else if (!ALLOWED_MUSTER_CODES.includes(dayMusterCode)) {
          dayMusterCode = dayAction === 'LEAVE' ? 'CL' : (dayAction === 'SICK' ? 'LHAP' : 'CR');
        }

        const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
        const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
        let existingSubOverride = null;
        let existingSubMuster = null;
        if (replacement_staff_id) {
          existingSubOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [replacement_staff_id, dStr]);
          existingSubMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [replacement_staff_id, dStr]);
        }
        undoSnapshots.push({
          date: dStr,
          override: existingOverride || null,
          muster: existingMuster || null,
          subOverride: existingSubOverride || null,
          subMuster: existingSubMuster || null
        });

        // 1. Mark main staff member
        await run(
          `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id, leave_type)
           VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             overridden_link_number = NULL,
             status = excluded.status,
             substitute_staff_id = excluded.substitute_staff_id,
             substitute_name = excluded.substitute_name,
             reason = excluded.reason,
             target_category_id = excluded.target_category_id,
             leave_type = excluded.leave_type`,
          [
            staff_id,
            dStr,
            originalLink,
            dayAction,
            replacement_staff_id || null,
            finalSubstituteName || null,
            dayReason || `${dayAction} - ${dayLeaveType}`,
            staff.category_id,
            dayLeaveType
          ]
        );

        // 2. Automatically sync with muster_records table
        const musterRemarks = `${dayAction} [${dayLeaveType}]${finalSubstituteName ? ` - Sub: ${finalSubstituteName}` : ''}${dayReason ? ` (${dayReason})` : ''}`;
        await run(
          `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
           VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             code = excluded.code,
             remarks = excluded.remarks,
             updated_by = excluded.updated_by,
             updated_at = CURRENT_TIMESTAMP`,
          [staff_id, dStr, dayMusterCode, musterRemarks]
        );

        // Sync main staff with LR sheet if staff is in Category 4
        if (staff.category_id === 4) {
          const lrMusterCode = dayMusterCode === 'SICK' ? 'S' : dayMusterCode;
          await syncLRSheetRecord(staff.id, dStr, lrMusterCode, dayReason || `${dayAction} - ${dayLeaveType}`);
        }

        // Synchronize TA approvals for main staff on leave/sick/rest
        const dateParts = dStr.split('-');
        const altDateStr = dateParts.length === 3 ? `${parseInt(dateParts[2], 10)}/${parseInt(dateParts[1], 10)}/${dateParts[0].slice(-2)}` : dStr;
        const disallowRemark = `Disallowed: On Leave/Absent as per Daily Duty (${dayMusterCode})`;
        await run(
          `UPDATE ta_approvals 
           SET status = 'REJECTED', 
               claim_amount = 0, 
               ta_percentage = NULL, 
               remarks = ?
           WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)`,
          [disallowRemark, staff.id, dStr, dStr, altDateStr]
        );
        await run(
          `UPDATE ta_entries 
           SET ta_b1 = '', 
               days_claiming_ta = NULL, 
               remarks = ?
           WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)`,
          [disallowRemark, staff.id, dStr, dStr, altDateStr]
        );

        // If replacement is an existing staff member in another column or LR pool
        if (replacement_staff_id) {
          const subStaff = await get('SELECT * FROM staff WHERE id = ?', [replacement_staff_id]);
          if (subStaff) {
            const subCat = await get('SELECT * FROM categories WHERE id = ?', [subStaff.category_id]);
            const subOrigLink = getBaseLinkNumber(subStaff.row_position, getDayOffset(subCat.anchor_date, dStr), subCat.cycle_length);
            
            const isUpgrade = replacement_type === 'UPGRADE_SLEEPER' || staff.category_id === 1;
            const subReason = isUpgrade
              ? `Upgraded to COR Link ${originalLink} in place of ${staff.name} (${dayLeaveType})`
              : `Substitute for ${staff.name} (${dayLeaveType}) on Link ${originalLink}`;

            await run(
              `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
               VALUES (?, ?, ?, ?, 'SUBSTITUTE', ?, ?, ?, ?)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 overridden_link_number = excluded.overridden_link_number,
                 status = excluded.status,
                 substitute_staff_id = excluded.substitute_staff_id,
                 substitute_name = excluded.substitute_name,
                 reason = excluded.reason,
                 target_category_id = excluded.target_category_id`,
              [
                subStaff.id,
                dStr,
                subOrigLink,
                originalLink,
                staff.id,
                staff.name,
                subReason,
                target_category_id || staff.category_id
              ]
            );

            // Substitute is working duty on this date: record 'P' in muster roll
            await run(
              `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
               VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 code = 'P',
                 remarks = excluded.remarks,
                 updated_by = excluded.updated_by,
                 updated_at = CURRENT_TIMESTAMP`,
              [subStaff.id, dStr, `Working as substitute for ${staff.name}`]
            );

            // Regenerate TA claims for substitute
            await run(
              `DELETE FROM ta_approvals WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?) AND (status = 'PENDING' OR remarks LIKE 'Disallowed%')`,
              [subStaff.id, dStr, dStr, altDateStr]
            );
            const subY = parseInt(dateParts[0], 10);
            const subM = parseInt(dateParts[1], 10);
            try {
              const { generatePendingTaClaimsForMonth } = require('./ta_generator');
              await generatePendingTaClaimsForMonth({ run, get, all }, subY, subM, subStaff.id);
            } catch (err) {}

            // Sync substitute with LR sheet if substitute is in Category 4
            if (subStaff.category_id === 4) {
              const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
              const dObj = new Date(dStr + 'T12:00:00');
              const dayOfWeek = dayNames[dObj.getDay()];
              const resolvedSubDuty = await resolveDutyCodeForLRStaff(subStaff.id, dStr, dayOfWeek, subStaff.rest_day);
              if (resolvedSubDuty && resolvedSubDuty.code) {
                await syncLRSheetRecord(subStaff.id, dStr, resolvedSubDuty.code, subReason);
              }

              // If original link is part of a multi-day link set, automatically book LR substitute for the entire link!
              if (datesToProcess.length === 1) {
                const subLinkSet = getLinkSetDetails(staff.category_id, originalLink);
                if (subLinkSet && subLinkSet.remainingLinks && subLinkSet.remainingLinks.length > 0) {
                  for (let k = 0; k < subLinkSet.remainingLinks.length; k++) {
                    const remLinkNum = subLinkSet.remainingLinks[k];
                    const nextDate = new Date(dStr + 'T12:00:00');
                    nextDate.setDate(nextDate.getDate() + k + 1);
                    const y = nextDate.getFullYear();
                    const m = String(nextDate.getMonth() + 1).padStart(2, '0');
                    const d = String(nextDate.getDate()).padStart(2, '0');
                    const nextDateStr = `${y}-${m}-${d}`;

                    const subLegReason = `Substitute for ${staff.name} on Link #${remLinkNum} (Day ${subLinkSet.dayIndexInSet + k + 1} of ${subLinkSet.setLength}-day link set)`;

                    await run(
                      `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
                       VALUES (?, ?, NULL, ?, 'SUBSTITUTE', ?, ?, ?, ?)
                       ON CONFLICT(staff_id, date) DO UPDATE SET
                         overridden_link_number = excluded.overridden_link_number,
                         status = excluded.status,
                         substitute_staff_id = excluded.substitute_staff_id,
                         substitute_name = excluded.substitute_name,
                         reason = excluded.reason,
                         target_category_id = excluded.target_category_id`,
                      [subStaff.id, nextDateStr, remLinkNum, staff.id, staff.name, subLegReason, target_category_id || staff.category_id]
                    );

                    await run(
                      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
                       VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
                       ON CONFLICT(staff_id, date) DO UPDATE SET
                         code = 'P',
                         remarks = excluded.remarks,
                         updated_by = excluded.updated_by,
                         updated_at = CURRENT_TIMESTAMP`,
                      [subStaff.id, nextDateStr, `Working as substitute for ${staff.name} on Link #${remLinkNum}`]
                    );

                    const nextDObj = new Date(nextDateStr + 'T12:00:00');
                    const nextDayOfWeek = dayNames[nextDObj.getDay()];
                    const resolvedNextDuty = await resolveDutyCodeForLRStaff(subStaff.id, nextDateStr, nextDayOfWeek, subStaff.rest_day);
                    if (resolvedNextDuty && resolvedNextDuty.code) {
                      await syncLRSheetRecord(subStaff.id, nextDateStr, resolvedNextDuty.code, subLegReason);
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Multi-Day Link Leave/Sick Automation:
      // If employee takes leave or sick on Day 1 (or Days 1..M) of an N-day link set (where M < N),
      // they did not travel outstation on Day 1, so they remain physically present at HQ (GNT).
      // For any remaining days of the link set:
      // - Main staff is automatically marked AVAILABLE_FOR_BOOKING at HQ (Muster: 'P').
      // - The scheduled link slot on that day is vacated for relief allotment ([UNMANNED / VACANT] with Assign Staff button).
      // - If a substitute was assigned, the substitute works the train for the return legs as well.
      let multiDaySetNotice = '';
      if (action === 'LEAVE' || action === 'SICK' || action === 'CR' || action === 'REST') {
        const firstDate = datesToProcess[0];
        const lastDate = datesToProcess[datesToProcess.length - 1];
        const firstDayOffset = getDayOffset(category.anchor_date, firstDate);
        const firstOriginalLink = getBaseLinkNumber(staff.row_position, firstDayOffset, category.cycle_length);
        const linkSet = getLinkSetDetails(staff.category_id, firstOriginalLink);

        if (linkSet && linkSet.setLinks) {
          const startIndex = linkSet.setLinks.indexOf(firstOriginalLink);
          const daysCovered = datesToProcess.length;
          const remainingSetLinks = linkSet.setLinks.slice(startIndex + daysCovered);

          if (remainingSetLinks.length > 0) {
            multiDaySetNotice = ` Multi-Day Link detected (${linkSet.setLength}-day link #${firstOriginalLink}): On the remaining ${remainingSetLinks.length} day(s), staff is marked Available for Booking at HQ [Muster: P], and Link #${remainingSetLinks.join(', #')} vacated for relief allotment.`;

            for (let k = 0; k < remainingSetLinks.length; k++) {
              const remLink = remainingSetLinks[k];
              const nextDate = new Date(lastDate + 'T12:00:00');
              nextDate.setDate(nextDate.getDate() + k + 1);
              const y = nextDate.getFullYear();
              const m = String(nextDate.getMonth() + 1).padStart(2, '0');
              const d = String(nextDate.getDate()).padStart(2, '0');
              const remDateStr = `${y}-${m}-${d}`;

              // Record snapshot for undo
              const existingSubDayOv = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, remDateStr]);
              const existingSubDayMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, remDateStr]);
              let existingSubDaySubOv = null;
              let existingSubDaySubMuster = null;
              if (replacement_staff_id) {
                existingSubDaySubOv = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [replacement_staff_id, remDateStr]);
                existingSubDaySubMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [replacement_staff_id, remDateStr]);
              }
              undoSnapshots.push({
                date: remDateStr,
                override: existingSubDayOv || null,
                muster: existingSubDayMuster || null,
                subOverride: existingSubDaySubOv || null,
                subMuster: existingSubDaySubMuster || null
              });

              // 1. Mark main staff as AVAILABLE_FOR_BOOKING at HQ
              await run(
                `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
                 VALUES (?, ?, ?, NULL, 'AVAILABLE_FOR_BOOKING', ?, ?, ?, ?)
                 ON CONFLICT(staff_id, date) DO UPDATE SET
                   overridden_link_number = NULL,
                   status = 'AVAILABLE_FOR_BOOKING',
                   substitute_staff_id = excluded.substitute_staff_id,
                   substitute_name = excluded.substitute_name,
                   reason = excluded.reason,
                   target_category_id = excluded.target_category_id`,
                [
                  staff_id,
                  remDateStr,
                  remLink,
                  replacement_staff_id || null,
                  finalSubstituteName || null,
                  `Available for Booking Duty at HQ (Came out of ${action} on Link #${firstOriginalLink})`,
                  staff.category_id
                ]
              );

              // 2. Mark main staff muster as 'P' (Present at HQ)
              await run(
                `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
                 VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
                 ON CONFLICT(staff_id, date) DO UPDATE SET
                   code = 'P',
                   remarks = excluded.remarks,
                   updated_by = excluded.updated_by,
                   updated_at = CURRENT_TIMESTAMP`,
                [
                  staff_id,
                  remDateStr,
                  `Present at HQ (Available for booking - Came out of ${action} on Link #${firstOriginalLink})`
                ]
              );

              // 3. If substitute assigned on Day 1, they work return leg as well
              if (replacement_staff_id) {
                const subStaff = await get('SELECT * FROM staff WHERE id = ?', [replacement_staff_id]);
                if (subStaff) {
                  const subCat = await get('SELECT * FROM categories WHERE id = ?', [subStaff.category_id]);
                  const subOrigLink = getBaseLinkNumber(subStaff.row_position, getDayOffset(subCat.anchor_date, remDateStr), subCat.cycle_length);
                  const subReason = `Substitute for ${staff.name} on return Link #${remLink}`;

                  await run(
                    `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
                     VALUES (?, ?, ?, ?, 'SUBSTITUTE', ?, ?, ?, ?)
                     ON CONFLICT(staff_id, date) DO UPDATE SET
                       overridden_link_number = excluded.overridden_link_number,
                       status = excluded.status,
                       substitute_staff_id = excluded.substitute_staff_id,
                       substitute_name = excluded.substitute_name,
                       reason = excluded.reason,
                       target_category_id = excluded.target_category_id`,
                    [
                      subStaff.id,
                      remDateStr,
                      subOrigLink,
                      remLink,
                      staff.id,
                      staff.name,
                      subReason,
                      staff.category_id
                    ]
                  );

                  await run(
                    `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
                     VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
                     ON CONFLICT(staff_id, date) DO UPDATE SET
                       code = 'P',
                       remarks = excluded.remarks,
                       updated_by = excluded.updated_by,
                       updated_at = CURRENT_TIMESTAMP`,
                    [subStaff.id, remDateStr, `Working as substitute for ${staff.name} on Link #${remLink}`]
                  );
                }
              }
            }
          }
        }
      }

      let dayWiseSummary = '';
      if (day_wise_leaves && datesToProcess.length > 1) {
        const parts = datesToProcess.map(dStr => {
          let t = effectiveLeaveType;
          if (Array.isArray(day_wise_leaves)) {
            const f = day_wise_leaves.find(x => x && x.date === dStr);
            if (f && f.leave_type) t = f.leave_type;
          } else if (typeof day_wise_leaves === 'object' && day_wise_leaves[dStr]) {
            t = typeof day_wise_leaves[dStr] === 'string' ? day_wise_leaves[dStr] : (day_wise_leaves[dStr].leave_type || t);
          }
          const dParts = dStr.split('-');
          return `${dParts[2]}/${dParts[1]}: ${t}`;
        });
        dayWiseSummary = ` (${parts.join(', ')})`;
      }

      const dateRangeStr = datesToProcess.length > 1 ? `${datesToProcess[0]} to ${datesToProcess[datesToProcess.length - 1]}` : date;
      const undoData = {
        action,
        staff_id,
        staff_name: staff.name,
        dates: datesToProcess,
        replacement_staff_id: replacement_staff_id || null,
        snapshots: undoSnapshots
      };
      await logAudit(
        'Admin',
        `STAFF_${action}`,
        `Marked ${staff.name} as ${action}${dayWiseSummary || ` (${effectiveLeaveType})`} on ${dateRangeStr}. Replacement: ${finalSubstituteName || 'None'}. Reason: ${reason || action}.${multiDaySetNotice ? ' ' + multiDaySetNotice : ''} Updated Muster Sheet.`,
        undoData
      );

      return res.json({
        success: true,
        message: `Updated ${staff.name} to ${action}${dayWiseSummary || ` [${effectiveLeaveType}]`} with replacement ${finalSubstituteName || 'None'}${multiDaySetNotice ? ' - ' + multiDaySetNotice : ''} and updated Muster Sheet!`
      });
    }

    if (action === 'CHANGED_LINK') {
      const targetLink = (new_link_number === '' || new_link_number === null || new_link_number === undefined) ? null : parseInt(new_link_number, 10);
      const linkStatus = targetLink === null ? 'REST' : 'CHANGED_LINK';
      const dayOffset = getDayOffset(category.anchor_date, date);
      const originalLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);
      
      // Resolve target_category_id
      let resolvedTargetCat = target_category_id ? parseInt(target_category_id, 10) : null;
      if (!resolvedTargetCat && targetLink !== null) {
        const ownLink = await get('SELECT category_id FROM links WHERE category_id = ? AND link_number = ?', [staff.category_id, targetLink]);
        if (ownLink) {
          resolvedTargetCat = staff.category_id;
        } else {
          const anyLink = await get('SELECT category_id FROM links WHERE link_number = ? ORDER BY category_id ASC LIMIT 1', [targetLink]);
          if (anyLink) resolvedTargetCat = anyLink.category_id;
        }
      }
      if (!resolvedTargetCat) resolvedTargetCat = staff.category_id;

      const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, date]);
      const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, date]);

      await run(
        `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           overridden_link_number = excluded.overridden_link_number,
           status = excluded.status,
           substitute_staff_id = NULL,
           substitute_name = NULL,
           reason = excluded.reason,
           target_category_id = excluded.target_category_id`,
        [staff_id, date, originalLink, targetLink, linkStatus, reason || `Changed to Link ${targetLink === null ? 'REST' : targetLink}`, resolvedTargetCat]
      );

      // Clear any previous substitute reference for this staff on this date so their previous slot shows vacant
      await run(
        'UPDATE overrides SET substitute_staff_id = NULL, substitute_name = NULL WHERE substitute_staff_id = ? AND date = ?',
        [staff_id, date]
      );

      // Keep non_daily_trains template table clean
      await run(
        'UPDATE non_daily_trains SET assigned_staff_id = NULL, assigned_staff_name = NULL WHERE assigned_staff_id = ?',
        [staff_id]
      );

      // Check if Day 1 was a scheduled REST day
      const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const dObj = new Date(date + 'T12:00:00');
      const dayOfWeek = dayNames[dObj.getDay()];
      let isDay1Rest = false;
      if (staff.rest_day && staff.rest_day.toUpperCase() === dayOfWeek) isDay1Rest = true;
      if (staff.category_id !== 4) {
        const origLinkDef = await getActiveLinkDef(staff.category_id, originalLink, date);
        if (originalLink === null || (origLinkDef && origLinkDef.is_rest === 1)) isDay1Rest = true;
      }
      const day1RestRemark = (isDay1Rest && targetLink !== null) ? ` - Rest day worked (CR credited for ${formatDateDisplay(date)})` : '';
      const baseRemark = reason || (targetLink === null ? 'Assigned Rest Day' : `Assigned Link #${targetLink}`);
      const musterRemark = baseRemark + day1RestRemark;

      // Sync with muster records: P for duty, R for rest
      const musterCode = targetLink === null ? 'R' : 'P';
      await run(
        `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
         VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           code = excluded.code,
           remarks = excluded.remarks,
           updated_by = excluded.updated_by,
           updated_at = CURRENT_TIMESTAMP`,
        [staff_id, date, musterCode, musterRemark]
      );

      // Sync with Leave Reserve (LR) sheet if staff is Category 4
      if (staff.category_id === 4) {
        const resolvedDuty = await resolveDutyCodeForLRStaff(staff.id, date, dayOfWeek, staff.rest_day);
        if (resolvedDuty && resolvedDuty.code) {
          await syncLRSheetRecord(staff.id, date, resolvedDuty.code, musterRemark);
        } else if (targetLink === null) {
          await syncLRSheetRecord(staff.id, date, 'R', reason || 'Assigned Rest Day');
        }
      }

      // Multi-Day Link Set Assignment for ALL staff (Categories 1, 2, 3, 4):
      // If assigned to a multi-day link set (2-day, 3-day, or 4-day link), assign to entire beat!
      if (targetLink !== null) {
        const linkSet = getLinkSetDetails(resolvedTargetCat, targetLink);
        if (linkSet && linkSet.remainingLinks && linkSet.remainingLinks.length > 0) {
          for (let k = 0; k < linkSet.remainingLinks.length; k++) {
            const remLinkNum = linkSet.remainingLinks[k];
            const nextDate = new Date(date + 'T12:00:00');
            nextDate.setDate(nextDate.getDate() + k + 1);
            const y = nextDate.getFullYear();
            const m = String(nextDate.getMonth() + 1).padStart(2, '0');
            const d = String(nextDate.getDate()).padStart(2, '0');
            const nextDateStr = `${y}-${m}-${d}`;

            // Check if this date was a scheduled REST day for this staff member
            let isNextDayRest = false;
            const nextDObj = new Date(nextDateStr + 'T12:00:00');
            const nextDayOfWeek = dayNames[nextDObj.getDay()];
            if (staff.rest_day && staff.rest_day.toUpperCase() === nextDayOfWeek) isNextDayRest = true;
            if (staff.category_id !== 4) {
              const nextDayOffset = getDayOffset(category.anchor_date, nextDateStr);
              const nextOrigLink = getBaseLinkNumber(staff.row_position, nextDayOffset, category.cycle_length);
              const nextLinkDef = await getActiveLinkDef(staff.category_id, nextOrigLink, nextDateStr);
              if (nextOrigLink === null || (nextLinkDef && nextLinkDef.is_rest === 1)) isNextDayRest = true;
            }

            const restRemark = isNextDayRest ? ` - Rest day worked (CR credited for ${formatDateDisplay(nextDateStr)})` : '';
            const nextReason = `Assigned Link #${remLinkNum} (Day ${k + 2} of Link #${targetLink})${restRemark}`;

            await run(
              `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
               VALUES (?, ?, NULL, ?, 'CHANGED_LINK', NULL, NULL, ?, ?)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 overridden_link_number = excluded.overridden_link_number,
                 status = 'CHANGED_LINK',
                 reason = excluded.reason,
                 target_category_id = excluded.target_category_id`,
              [staff.id, nextDateStr, remLinkNum, nextReason, resolvedTargetCat]
            );

            await run(
              `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
               VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 code = 'P',
                 remarks = excluded.remarks,
                 updated_by = excluded.updated_by,
                 updated_at = CURRENT_TIMESTAMP`,
              [staff.id, nextDateStr, nextReason]
            );

            // If staff is LR, sync with LR sheet
            if (staff.category_id === 4) {
              const resolvedNextDuty = await resolveDutyCodeForLRStaff(staff.id, nextDateStr, nextDayOfWeek, staff.rest_day);
              if (resolvedNextDuty && resolvedNextDuty.code) {
                await syncLRSheetRecord(staff.id, nextDateStr, resolvedNextDuty.code, nextReason);
              }
            }

            // Sync across all modules (TA, NDA, Diary)
            await syncDutyChangeAcrossAllModules({ get, all, run }, staff.id, nextDateStr, {
              targetLink: remLinkNum,
              targetCat: resolvedTargetCat,
              isLeave: false
            });
          }
        }
      }

      const undoData = {
        action: 'CHANGED_LINK',
        staff_id,
        staff_name: staff.name,
        date,
        previous_override: existingOverride || null,
        previous_muster: existingMuster || null
      };

      await logAudit(
        'Admin',
        'CHANGED_LINK',
        `Changed link for ${staff.name} on ${date} from Link ${originalLink} to ${targetLink === null ? 'REST' : `Link ${targetLink}`} (Category ${resolvedTargetCat}). Reason: ${reason}`,
        undoData
      );

      return res.json({ success: true, message: `Changed link for ${staff.name} to ${targetLink === null ? 'REST' : `Link ${targetLink}`} and updated Muster Sheet` });
    }

    if (action === 'AVAILABLE_FOR_BOOKING' || action === 'REPORTED_FIT' || action === 'MARK_AVAILABLE' || action === 'REMOVE_FROM_LINK' || action === 'REMOVE') {
      const dayOffset = getDayOffset(category.anchor_date, date);
      const originalLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);
      const isReportedFit = action === 'REPORTED_FIT' || (reason && /sick|fit/i.test(reason));
      const finalReason = reason || (isReportedFit
        ? 'Reported fit / came out of sick leave; spare at HQ GNT available for duty booking'
        : (action === 'AVAILABLE_FOR_BOOKING' ? 'Available for Booking Duty at HQ GNT' : `Removed from Link #${originalLink} - Available for other duty / booking`));

      const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, date]);
      const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, date]);

      await run(
        `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
         VALUES (?, ?, ?, NULL, 'AVAILABLE_FOR_BOOKING', NULL, NULL, ?, ?)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           overridden_link_number = NULL,
           status = 'AVAILABLE_FOR_BOOKING',
           substitute_staff_id = NULL,
           substitute_name = NULL,
           reason = excluded.reason,
           target_category_id = excluded.target_category_id`,
        [staff_id, date, originalLink, finalReason, staff.category_id]
      );

      // In muster records, they are on duty at HQ available for booking
      await run(
        `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
         VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           code = 'P',
           remarks = excluded.remarks,
           updated_by = excluded.updated_by,
           updated_at = CURRENT_TIMESTAMP`,
        [staff_id, date, finalReason]
      );

      // If Category 4 (LR), update LR sheet
      if (staff.category_id === 4) {
        await syncLRSheetRecord(staff.id, date, 'SPARE', reason || 'Available for other duty');
      }

      const undoData = {
        action,
        staff_id,
        staff_name: staff.name,
        date,
        original_link: originalLink,
        previous_override: existingOverride || null,
        previous_muster: existingMuster || null
      };

      await logAudit(
        'Admin',
        'REMOVE_FROM_LINK',
        `Removed ${staff.name} from Link #${originalLink} on ${date}. Marked Available for Booking at HQ. Reason: ${reason || 'Available for other duty'}`,
        undoData
      );

      return res.json({
        success: true,
        message: `${staff.name} has been removed from Link #${originalLink} on ${date} and is now Available for Booking at HQ!`
      });
    }

    // UPGRADE_TO_COR: Upgrade Sleeper Staff to Conductor (COR / Category 1)
    if (action === 'UPGRADE_TO_COR' || action === 'UPGRADE_COR') {
      const targetCorLink = req.body.target_cor_link !== undefined && req.body.target_cor_link !== null && req.body.target_cor_link !== ''
        ? parseInt(req.body.target_cor_link, 10)
        : (new_link_number ? parseInt(new_link_number, 10) : 1);
      const targetDate = req.body.target_date || date;
      const trainInfo = req.body.cor_train_info || '';

      const dayOffset = getDayOffset(category.anchor_date, targetDate);
      const originalLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);

      const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, targetDate]);
      const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, targetDate]);

      // Assign to COR link with status 'SUBSTITUTE' and target_category_id = 1
      await run(
        `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
         VALUES (?, ?, ?, ?, 'SUBSTITUTE', NULL, NULL, ?, 1)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           overridden_link_number = excluded.overridden_link_number,
           status = 'SUBSTITUTE',
           substitute_staff_id = NULL,
           substitute_name = NULL,
           reason = excluded.reason,
           target_category_id = 1`,
        [staff_id, targetDate, originalLink, targetCorLink, reason || `Upgraded to COR on Link #${targetCorLink}${trainInfo ? ` (${trainInfo})` : ''}`]
      );

      // In muster records: P for working duty
      await run(
        `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
         VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           code = 'P',
           remarks = excluded.remarks,
           updated_by = excluded.updated_by,
           updated_at = CURRENT_TIMESTAMP`,
        [staff_id, targetDate, `Upgraded to COR Link #${targetCorLink}`]
      );

      const undoData = {
        action: 'UPGRADE_TO_COR',
        staff_id,
        staff_name: staff.name,
        date: targetDate,
        original_link: originalLink,
        target_cor_link: targetCorLink,
        previous_override: existingOverride || null,
        previous_muster: existingMuster || null
      };

      await logAudit(
        'Admin',
        'UPGRADE_TO_COR',
        `Upgraded ${staff.name} from Sleeper Link #${originalLink} to Conductor (COR) Link #${targetCorLink} on ${targetDate}. Original sleeper slot vacated.`,
        undoData
      );

      return res.json({
        success: true,
        message: `${staff.name} successfully upgraded to Conductor (COR) on Link #${targetCorLink} for ${targetDate}! Their original Sleeper slot has been marked as Vacant.`
      });
    }

    // UTILISED_ADVANCE: Employee utilised for advance duty out-of-turn for emergency utilisation
    if (action === 'UTILISED_ADVANCE' || action === 'ADVANCE_DUTY' || action === 'ADVANCE_BOOKED') {
      const advanceTrainNo = req.body.advance_train_no ? String(req.body.advance_train_no).trim() : '';
      const vacateNextLink = Boolean(req.body.vacate_next_link);
      const advanceLinkNumber = req.body.advance_link_number !== undefined && req.body.advance_link_number !== null && req.body.advance_link_number !== ''
        ? parseInt(req.body.advance_link_number, 10)
        : null;

      // 1. If assigned to an advance link today, record that assignment
      if (advanceLinkNumber !== null) {
        const dayOffset = getDayOffset(category.anchor_date, date);
        const originalLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);
        await run(
          `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
           VALUES (?, ?, ?, ?, 'CHANGED_LINK', NULL, NULL, ?, ?)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             overridden_link_number = excluded.overridden_link_number,
             status = 'CHANGED_LINK',
             reason = excluded.reason,
             target_category_id = excluded.target_category_id`,
          [staff_id, date, originalLink, advanceLinkNumber, `Assigned Advance Duty (Train ${advanceTrainNo || 'Emergency'})`, staff.category_id]
        );
        await run(
          `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
           VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             code = 'P',
             remarks = excluded.remarks,
             updated_by = excluded.updated_by,
             updated_at = CURRENT_TIMESTAMP`,
          [staff_id, date, `Advance Duty on Link #${advanceLinkNumber} (Tr. ${advanceTrainNo})`]
        );
      }

      // 2. Determine target date to vacate with UTILISED_ADVANCE (next cyclic link date or specified date)
      let targetVacateDate = date;
      if (vacateNextLink) {
        const curD = new Date(date + 'T12:00:00');
        curD.setDate(curD.getDate() + 1);
        const y = curD.getFullYear();
        const m = String(curD.getMonth() + 1).padStart(2, '0');
        const d = String(curD.getDate()).padStart(2, '0');
        targetVacateDate = `${y}-${m}-${d}`;
      }

      const vacateDayOffset = getDayOffset(category.anchor_date, targetVacateDate);
      const vacateOrigLink = getBaseLinkNumber(staff.row_position, vacateDayOffset, category.cycle_length);

      const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, targetVacateDate]);
      const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, targetVacateDate]);

      const advanceReason = reason || (advanceTrainNo ? `UTILISED ADVANCE BY TRAIN NO ${advanceTrainNo}` : 'UTILISED ADVANCE');

      await run(
        `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, advance_train_no, is_advance_duty, reason, target_category_id)
         VALUES (?, ?, ?, NULL, 'UTILISED_ADVANCE', ?, 1, ?, ?)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           overridden_link_number = NULL,
           status = 'UTILISED_ADVANCE',
           advance_train_no = excluded.advance_train_no,
           is_advance_duty = 1,
           substitute_staff_id = NULL,
           substitute_name = NULL,
           reason = excluded.reason,
           target_category_id = excluded.target_category_id`,
        [staff_id, targetVacateDate, vacateOrigLink, advanceTrainNo || null, advanceReason, staff.category_id]
      );

      // On the vacated date, muster is P (Present/On duty)
      await run(
        `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
         VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           code = 'P',
           remarks = excluded.remarks,
           updated_by = excluded.updated_by,
           updated_at = CURRENT_TIMESTAMP`,
        [staff_id, targetVacateDate, `Utilised in Advance (Tr. ${advanceTrainNo || 'Emergency'})`]
      );

      // If replacement staff is provided to cover this vacated link:
      if (replacement_staff_id) {
        const subStaff = await get('SELECT * FROM staff WHERE id = ?', [replacement_staff_id]);
        if (subStaff) {
          const subCat = await get('SELECT * FROM categories WHERE id = ?', [subStaff.category_id]);
          const subOrigLink = getBaseLinkNumber(subStaff.row_position, getDayOffset(subCat.anchor_date, targetVacateDate), subCat.cycle_length);
          const subReason = `Substitute for ${staff.name} (Advance Booked Tr. ${advanceTrainNo || ''}) on Link #${vacateOrigLink}`;

          await run(
            `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
             VALUES (?, ?, ?, ?, 'SUBSTITUTE', ?, ?, ?, ?)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               overridden_link_number = excluded.overridden_link_number,
               status = excluded.status,
               substitute_staff_id = excluded.substitute_staff_id,
               substitute_name = excluded.substitute_name,
               reason = excluded.reason,
               target_category_id = excluded.target_category_id`,
            [subStaff.id, targetVacateDate, subOrigLink, vacateOrigLink, staff.id, staff.name, subReason, staff.category_id]
          );

          await run(
            `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
             VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               code = 'P',
               remarks = excluded.remarks,
               updated_by = excluded.updated_by,
               updated_at = CURRENT_TIMESTAMP`,
            [subStaff.id, targetVacateDate, `Working as substitute for ${staff.name} on Link #${vacateOrigLink}`]
          );

          if (subStaff.category_id === 4) {
            const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
            const targetDObj = new Date(targetVacateDate + 'T12:00:00');
            const targetDayOfWeek = dayNames[targetDObj.getDay()];
            const resolvedDuty = await resolveDutyCodeForLRStaff(subStaff.id, targetVacateDate, targetDayOfWeek, subStaff.rest_day);
            if (resolvedDuty && resolvedDuty.code) {
              await syncLRSheetRecord(subStaff.id, targetVacateDate, resolvedDuty.code, subReason);
            }
          }
        }
      }

      const undoData = {
        action: 'UTILISED_ADVANCE',
        staff_id,
        staff_name: staff.name,
        date: targetVacateDate,
        original_link: vacateOrigLink,
        advance_train_no: advanceTrainNo,
        replacement_staff_id: replacement_staff_id || null,
        previous_override: existingOverride || null,
        previous_muster: existingMuster || null
      };

      await logAudit(
        'Admin',
        'UTILISED_ADVANCE',
        `Marked ${staff.name} as Utilised in Advance (Tr. ${advanceTrainNo || 'Emergency'}). Vacated Link #${vacateOrigLink} on ${targetVacateDate} with blinking notice.`,
        undoData
      );

      return res.json({
        success: true,
        message: `Marked ${staff.name} as Utilised in Advance (Tr. ${advanceTrainNo || 'Emergency'}). Link #${vacateOrigLink} on ${targetVacateDate} is now Vacant with blinking notice.`
      });
    }

    // SHIFTED / SHIFTED_PLACE: Shift employee away from this link slot to another place / duty / link
    if (action === 'SHIFTED' || action === 'SHIFTED_PLACE') {
      const shiftedPlace = req.body.shifted_place ? String(req.body.shifted_place).trim() : '';
      const shiftedLinkNum = req.body.shifted_link_number !== undefined && req.body.shifted_link_number !== null && req.body.shifted_link_number !== ''
        ? parseInt(req.body.shifted_link_number, 10)
        : null;
      const shiftedCatId = req.body.shifted_category_id ? parseInt(req.body.shifted_category_id, 10) : staff.category_id;

      const datesToProcess = [];
      const fromD = new Date(date + 'T12:00:00');
      const toD = to_date ? new Date(to_date + 'T12:00:00') : new Date(date + 'T12:00:00');
      if (toD < fromD) toD.setTime(fromD.getTime());
      for (let cur = new Date(fromD); cur <= toD; cur.setDate(cur.getDate() + 1)) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        datesToProcess.push(`${y}-${m}-${d}`);
      }

      const shiftDesc = shiftedLinkNum ? `Link #${shiftedLinkNum}${shiftedPlace ? ` (${shiftedPlace})` : ''}` : (shiftedPlace || 'Another Place / Duty');
      const shiftReason = reason || `Shifted to ${shiftDesc}`;

      const undoSnapshots = [];
      for (const dStr of datesToProcess) {
        const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
        const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, dStr]);
        let subOverride = null;
        let subMuster = null;
        if (replacement_staff_id) {
          subOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [replacement_staff_id, dStr]);
          subMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [replacement_staff_id, dStr]);
        }
        undoSnapshots.push({
          date: dStr,
          override: existingOverride || null,
          muster: existingMuster || null,
          subOverride,
          subMuster
        });

        const dayOffset = getDayOffset(category.anchor_date, dStr);
        const originalLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);

        const newStatus = shiftedLinkNum !== null ? 'CHANGED_LINK' : 'SHIFTED';

        await run(
          `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
           VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             overridden_link_number = excluded.overridden_link_number,
             status = excluded.status,
             substitute_staff_id = NULL,
             substitute_name = NULL,
             reason = excluded.reason,
             target_category_id = excluded.target_category_id`,
          [staff_id, dStr, originalLink, shiftedLinkNum, newStatus, shiftReason, shiftedCatId]
        );

        // Muster record: P (Present on duty at the shifted place)
        await run(
          `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
           VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
           ON CONFLICT(staff_id, date) DO UPDATE SET
             code = 'P',
             remarks = excluded.remarks,
             updated_by = excluded.updated_by,
             updated_at = CURRENT_TIMESTAMP`,
          [staff_id, dStr, shiftReason]
        );

        // If replacement staff is provided to take over this original link slot:
        if (replacement_staff_id) {
          const subStaff = await get('SELECT * FROM staff WHERE id = ?', [replacement_staff_id]);
          if (subStaff) {
            const subCat = await get('SELECT * FROM categories WHERE id = ?', [subStaff.category_id]);
            const subOrigLink = getBaseLinkNumber(subStaff.row_position, getDayOffset(subCat.anchor_date, dStr), subCat.cycle_length);
            const subReason = `Substitute for ${staff.name} (${shiftReason}) on Link #${originalLink}`;

            await run(
              `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
               VALUES (?, ?, ?, ?, 'SUBSTITUTE', ?, ?, ?, ?)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 overridden_link_number = excluded.overridden_link_number,
                 status = excluded.status,
                 substitute_staff_id = excluded.substitute_staff_id,
                 substitute_name = excluded.substitute_name,
                 reason = excluded.reason,
                 target_category_id = excluded.target_category_id`,
              [subStaff.id, dStr, subOrigLink, originalLink, staff.id, staff.name, subReason, staff.category_id]
            );

            await run(
              `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
               VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
               ON CONFLICT(staff_id, date) DO UPDATE SET
                 code = 'P',
                 remarks = excluded.remarks,
                 updated_by = excluded.updated_by,
                 updated_at = CURRENT_TIMESTAMP`,
              [subStaff.id, dStr, subReason]
            );

            if (subStaff.category_id === 4) {
              const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
              const targetDObj = new Date(dStr + 'T12:00:00');
              const targetDayOfWeek = dayNames[targetDObj.getDay()];
              const resolvedDuty = await resolveDutyCodeForLRStaff(subStaff.id, dStr, targetDayOfWeek, subStaff.rest_day);
              if (resolvedDuty && resolvedDuty.code) {
                await syncLRSheetRecord(subStaff.id, dStr, resolvedDuty.code, subReason);
              }
            }
          }
        }
      }

      const undoData = {
        action: 'SHIFTED',
        staff_id,
        staff_name: staff.name,
        dates: datesToProcess,
        replacement_staff_id: replacement_staff_id || null,
        snapshots: undoSnapshots
      };

      await logAudit(
        'Admin',
        'SHIFTED',
        `Shifted ${staff.name} to ${shiftDesc} on ${date}. Original slot updated.`,
        undoData
      );

      return res.json({
        success: true,
        message: `Shifted ${staff.name} to ${shiftDesc} on ${date}! Original slot updated.`
      });
    }

    // UNDO_SHIFT: Revert shift and restore original employee
    if (action === 'UNDO_SHIFT') {
      await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [staff_id, date]);
      await run('DELETE FROM overrides WHERE substitute_staff_id = ? AND date = ?', [staff_id, date]);
      await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, date]);
      return res.json({ success: true, message: 'Shift undone and staff restored to original cyclic link.' });
    }

    return res.status(400).json({ error: 'Invalid action specified' });
  } catch (err) {
    console.error('Error changing duty status:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/duty/exchange-staff - Exchange / Swap duties between two employees on a date
app.post('/api/duty/exchange-staff', requireAdmin, async (req, res) => {
  const { staff_a_id, staff_b_id, date, reason, duty_a_link, duty_a_category_id, duty_b_link, duty_b_category_id } = req.body;
  if (!staff_a_id || !staff_b_id || !date) {
    return res.status(400).json({ error: 'staff_a_id, staff_b_id, and date are required' });
  }
  if (parseInt(staff_a_id, 10) === parseInt(staff_b_id, 10)) {
    return res.status(400).json({ error: 'Cannot exchange duties with the same employee' });
  }

  try {
    const staffA = await get('SELECT * FROM staff WHERE id = ?', [staff_a_id]);
    const staffB = await get('SELECT * FROM staff WHERE id = ?', [staff_b_id]);
    if (!staffA || !staffB) {
      return res.status(404).json({ error: 'One or both staff members not found' });
    }

    const catA = await get('SELECT * FROM categories WHERE id = ?', [staffA.category_id]);
    const catB = await get('SELECT * FROM categories WHERE id = ?', [staffB.category_id]);

    const dayOffsetA = getDayOffset(catA.anchor_date, date);
    const dayOffsetB = getDayOffset(catB.anchor_date, date);

    const origLinkA = getBaseLinkNumber(staffA.row_position, dayOffsetA, catA.cycle_length);
    const origLinkB = getBaseLinkNumber(staffB.row_position, dayOffsetB, catB.cycle_length);

    const existingOverrideA = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staffA.id, date]);
    const existingOverrideB = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staffB.id, date]);

    const existingMusterA = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staffA.id, date]);
    const existingMusterB = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staffB.id, date]);

    // Determine current effective duty of Staff A
    let currentDutyA = null;
    let targetCatA = staffA.category_id;
    if (duty_a_link !== undefined && duty_a_link !== null && duty_a_link !== '') {
      currentDutyA = parseInt(duty_a_link, 10);
      if (duty_a_category_id) targetCatA = parseInt(duty_a_category_id, 10);
    } else if (existingOverrideA) {
      if (existingOverrideA.overridden_link_number !== null) {
        currentDutyA = existingOverrideA.overridden_link_number;
        targetCatA = existingOverrideA.target_category_id || staffA.category_id;
      } else {
        // Fallback: If relieved/spare, use their original duty link
        currentDutyA = existingOverrideA.original_link_number || origLinkA;
        targetCatA = existingOverrideA.target_category_id || staffA.category_id;
      }
    } else {
      currentDutyA = origLinkA;
      const linkDefA = await get('SELECT * FROM links WHERE category_id = ? AND link_number = ?', [staffA.category_id, origLinkA]);
      if (!linkDefA || linkDefA.is_rest) currentDutyA = null;
    }

    // Determine current effective duty of Staff B
    let currentDutyB = null;
    let targetCatB = staffB.category_id;
    if (duty_b_link !== undefined && duty_b_link !== null && duty_b_link !== '') {
      currentDutyB = parseInt(duty_b_link, 10);
      if (duty_b_category_id) targetCatB = parseInt(duty_b_category_id, 10);
    } else if (existingOverrideB) {
      if (existingOverrideB.overridden_link_number !== null) {
        currentDutyB = existingOverrideB.overridden_link_number;
        targetCatB = existingOverrideB.target_category_id || staffB.category_id;
      } else {
        // Fallback: If relieved/spare, use their original duty link
        currentDutyB = existingOverrideB.original_link_number || origLinkB;
        targetCatB = existingOverrideB.target_category_id || staffB.category_id;
      }
    } else {
      currentDutyB = origLinkB;
      const linkDefB = await get('SELECT * FROM links WHERE category_id = ? AND link_number = ?', [staffB.category_id, origLinkB]);
      if (!linkDefB || linkDefB.is_rest) currentDutyB = null;
    }

    // Exchange: Staff A receives Staff B's duty, Staff B receives Staff A's duty
    const newDutyA = currentDutyB;
    let newCatA = targetCatB;
    if (newDutyA !== null) {
      const linkDef = await get(
        'SELECT category_id FROM links WHERE link_number = ? ORDER BY (category_id = ?) DESC LIMIT 1',
        [newDutyA, targetCatB || staffB.category_id]
      );
      if (linkDef) newCatA = linkDef.category_id;
    }
    const newStatusA = newDutyA === null ? 'REST' : 'CHANGED_LINK';
    const reasonA = reason ? `Exchange with ${staffB.name}: ${reason}` : `Exchanged duty with ${staffB.name}`;

    const newDutyB = currentDutyA;
    let newCatB = targetCatA;
    if (newDutyB !== null) {
      const linkDef = await get(
        'SELECT category_id FROM links WHERE link_number = ? ORDER BY (category_id = ?) DESC LIMIT 1',
        [newDutyB, targetCatA || staffA.category_id]
      );
      if (linkDef) newCatB = linkDef.category_id;
    }
    const newStatusB = newDutyB === null ? 'REST' : 'CHANGED_LINK';
    const reasonB = reason ? `Exchange with ${staffA.name}: ${reason}` : `Exchanged duty with ${staffA.name}`;

    const effectiveOrigA = existingOverrideA?.original_link_number || origLinkA;
    const effectiveOrigB = existingOverrideB?.original_link_number || origLinkB;

    // Apply override for Staff A
    await run(
      `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id, leave_type)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         overridden_link_number = excluded.overridden_link_number,
         status = excluded.status,
         substitute_staff_id = NULL,
         substitute_name = NULL,
         leave_type = NULL,
         reason = excluded.reason,
         target_category_id = excluded.target_category_id`,
      [staffA.id, date, effectiveOrigA, newDutyA, newStatusA, reasonA, newCatA]
    );

    // Apply override for Staff B
    await run(
      `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id, leave_type)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         overridden_link_number = excluded.overridden_link_number,
         status = excluded.status,
         substitute_staff_id = NULL,
         substitute_name = NULL,
         leave_type = NULL,
         reason = excluded.reason,
         target_category_id = excluded.target_category_id`,
      [staffB.id, date, effectiveOrigB, newDutyB, newStatusB, reasonB, newCatB]
    );

    // Muster updates: P for duty, R for rest
    const musterCodeA = newDutyA === null ? 'R' : 'P';
    const musterCodeB = newDutyB === null ? 'R' : 'P';

    await run(
      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
       VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         code = excluded.code,
         remarks = excluded.remarks,
         updated_by = excluded.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
      [staffA.id, date, musterCodeA, reasonA]
    );

    await run(
      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
       VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         code = excluded.code,
         remarks = excluded.remarks,
         updated_by = excluded.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
      [staffB.id, date, musterCodeB, reasonB]
    );

    // Sync with Leave Reserve (LR) sheet if staffA or staffB is Category 4
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dObj = new Date(date + 'T12:00:00');
    const dayOfWeek = dayNames[dObj.getDay()];

    if (staffA.category_id === 4) {
      const resA = await resolveDutyCodeForLRStaff(staffA.id, date, dayOfWeek, staffA.rest_day);
      if (resA && resA.code) {
        await syncLRSheetRecord(staffA.id, date, resA.code, reasonA);
      } else if (newDutyA === null) {
        await syncLRSheetRecord(staffA.id, date, 'R', reasonA);
      }
    }

    if (staffB.category_id === 4) {
      const resB = await resolveDutyCodeForLRStaff(staffB.id, date, dayOfWeek, staffB.rest_day);
      if (resB && resB.code) {
        await syncLRSheetRecord(staffB.id, date, resB.code, reasonB);
      } else if (newDutyB === null) {
        await syncLRSheetRecord(staffB.id, date, 'R', reasonB);
      }
    }

    // Synchronize across TA approvals and documents for both staff
    await syncDutyChangeAcrossAllModules({ get, all, run }, staffA.id, date, {
      targetLink: newDutyA,
      isLeave: false,
      isRest: newDutyA === null,
      remarks: reasonA
    });
    await syncDutyChangeAcrossAllModules({ get, all, run }, staffB.id, date, {
      targetLink: newDutyB,
      isLeave: false,
      isRest: newDutyB === null,
      remarks: reasonB
    });

    const undoData = {
      action: 'EXCHANGE_STAFF',
      date,
      staff_a: {
        id: staffA.id,
        name: staffA.name,
        previous_override: existingOverrideA || null,
        previous_muster: existingMusterA || null
      },
      staff_b: {
        id: staffB.id,
        name: staffB.name,
        previous_override: existingOverrideB || null,
        previous_muster: existingMusterB || null
      }
    };

    const labelA = newDutyA === null ? 'REST' : `Link ${newDutyA}`;
    const labelB = newDutyB === null ? 'REST' : `Link ${newDutyB}`;
    await logAudit(
      'Admin',
      'EXCHANGE_STAFF',
      `Exchanged duties between ${staffA.name} (${labelA}) and ${staffB.name} (${labelB}) on ${date}`,
      undoData
    );

    res.json({
      success: true,
      message: `Successfully exchanged duties: ${staffA.name} is now on ${labelA} and ${staffB.name} is now on ${labelB}!`
    });
  } catch (err) {
    console.error('Error exchanging staff:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper to synchronize any duty change / deviation across TA, NDA, Diary, Muster, Overrides, and LR Sheet
async function syncDutyChangeAcrossAllModules(db, staffId, date, details = {}) {
  const { run, get, all } = db;
  const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
  if (!staff) return;

  const { targetTrain, targetLink, isLeave, leaveCode, remarks, substituteStaffId, isRest, isAvailable } = details;

  // 1. Sync Muster Records
  if (isLeave) {
    const code = (leaveCode || 'LEAVE').toUpperCase() === 'SICK' ? 'SICK' : (leaveCode || 'CL').toUpperCase();
    await run(
      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
       VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         code = excluded.code,
         remarks = excluded.remarks,
         updated_by = 'Admin',
         updated_at = CURRENT_TIMESTAMP`,
      [staffId, date, code, remarks || code]
    );
  } else if (isRest) {
    await run(
      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
       VALUES (?, ?, 'R', ?, 'Admin', CURRENT_TIMESTAMP)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         code = 'R',
         remarks = excluded.remarks,
         updated_by = 'Admin',
         updated_at = CURRENT_TIMESTAMP`,
      [staffId, date, remarks || 'Assigned Rest Day']
    );
  } else {
    // If working duty or available at HQ
    const remark = targetTrain ? `Train ${targetTrain}` : (targetLink ? `Link #${targetLink}` : (isAvailable ? 'Available at HQ' : (remarks || 'Present')));
    await run(
      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
       VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         code = 'P',
         remarks = excluded.remarks,
         updated_by = 'Admin',
         updated_at = CURRENT_TIMESTAMP`,
      [staffId, date, remark]
    );
  }

  // 2. Sync LR Sheet Records if staff is LR (category_id = 4)
  if (staff.category_id === 4) {
    if (isLeave) {
      const lrCode = (leaveCode || 'L').toUpperCase() === 'SICK' ? 'S' : (leaveCode || 'L').toUpperCase();
      await syncLRSheetRecord(staffId, date, lrCode, remarks || lrCode, 'Universal Sync');
    } else if (isRest) {
      await syncLRSheetRecord(staffId, date, 'R', remarks || 'Rest Day', 'Universal Sync');
    } else if (isAvailable) {
      await syncLRSheetRecord(staffId, date, 'AVL', remarks || 'Available at HQ', 'Universal Sync');
    } else {
      const train = targetTrain || (targetLink ? `Link ${targetLink}` : 'Duty');
      await syncLRSheetRecord(staffId, date, train, remarks || 'UTILISED', 'Universal Sync');
    }
  }

  // 3. Sync TA Approvals & TA Entries
  const dateParts = date.split('-');
  const altDateStr = dateParts.length === 3 ? `${parseInt(dateParts[2], 10)}/${parseInt(dateParts[1], 10)}/${dateParts[0].slice(-2)}` : date;
  if (isLeave || isRest) {
    const disallowRemark = `Disallowed: On Leave/Absent as per Muster/Daily Duty (${leaveCode || (isRest ? 'REST' : 'LEAVE')})`;
    await run(
      `UPDATE ta_approvals 
       SET status = 'REJECTED', 
           claim_amount = 0, 
           ta_percentage = NULL, 
           remarks = ?
       WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)`,
      [disallowRemark, staffId, date, date, altDateStr]
    );
    await run(
      `UPDATE ta_entries 
       SET ta_b1 = '', 
           days_claiming_ta = NULL, 
           remarks = ?
       WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)`,
      [disallowRemark, staffId, date, date, altDateStr]
    );
  } else {
    // Delete pending/disallowed claims for this staff on this date so they can be regenerated cleanly
    await run(
      `DELETE FROM ta_approvals WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?) AND (status = 'PENDING' OR remarks LIKE 'Disallowed%')`,
      [staffId, date, date, altDateStr]
    );
    const y = parseInt(dateParts[0], 10);
    const m = parseInt(dateParts[1], 10);
    try {
      const { generatePendingTaClaimsForMonth } = require('./ta_generator');
      await generatePendingTaClaimsForMonth({ run, get, all }, y, m, staffId);
    } catch (err) {
      console.warn('Error regenerating TA claims in sync:', err.message);
    }
  }
}

// POST /api/duty/drag-assign-train - Drag and drop employee assignment across trains
app.post('/api/duty/drag-assign-train', requireAdmin, async (req, res) => {
  const {
    staff_id,
    date,
    source_link,
    source_category_id,
    source_train,
    target_train,
    target_slot_id,
    target_link,
    target_category_id,
    is_extra
  } = req.body;

  if (!staff_id || !date || !target_train) {
    return res.status(400).json({ error: 'staff_id, date, and target_train are required' });
  }

  try {
    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });

    const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, date]);
    const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff.id, date]);

    const cat = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
    const dayOffset = getDayOffset(cat.anchor_date, date);
    const origLink = getBaseLinkNumber(staff.row_position, dayOffset, cat.cycle_length);

    const isExtraCrew = is_extra === 1 || !target_link;
    const status = isExtraCrew ? 'EXTRA_CREW' : 'CHANGED_LINK';
    const effectiveLink = isExtraCrew ? null : parseInt(target_link, 10);
    const effectiveTargetCat = isExtraCrew ? staff.category_id : (target_category_id || (target_link ? 2 : 1));
    const shiftedPlace = isExtraCrew ? 'EXTRA_DOWN_BELOW' : `Link #${effectiveLink}`;
    const reason = isExtraCrew
      ? `Shifted from Train ${source_train || origLink || ''} to Train ${target_train} as Extra Staff (down below)`
      : `Shifted from Train ${source_train || origLink || ''} to Train ${target_train} (Link #${effectiveLink})`;

    await run(
      `INSERT INTO overrides (
        staff_id, date, overridden_link_number, status, target_category_id,
        reason, original_link_number, extra_train_no, is_extra,
        shifted_from_link, shifted_from_train, shifted_place,
        advance_train_no, is_advance_duty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0)
      ON CONFLICT(staff_id, date) DO UPDATE SET
        overridden_link_number = excluded.overridden_link_number,
        status = excluded.status,
        target_category_id = excluded.target_category_id,
        reason = excluded.reason,
        original_link_number = COALESCE(overrides.original_link_number, excluded.original_link_number),
        extra_train_no = excluded.extra_train_no,
        is_extra = excluded.is_extra,
        shifted_from_link = excluded.shifted_from_link,
        shifted_from_train = excluded.shifted_from_train,
        shifted_place = excluded.shifted_place,
        advance_train_no = NULL,
        is_advance_duty = 0`,
      [
        staff.id,
        date,
        effectiveLink,
        status,
        effectiveTargetCat,
        reason,
        origLink,
        target_train,
        isExtraCrew ? 1 : 0,
        source_link || origLink || null,
        source_train || null,
        shiftedPlace
      ]
    );

    // Clear any previous substitute reference for this staff on this date so their previous slot shows vacant
    await run(
      'UPDATE overrides SET substitute_staff_id = NULL, substitute_name = NULL WHERE substitute_staff_id = ? AND date = ?',
      [staff.id, date]
    );

    // Check if Day 1 was a scheduled REST day
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dObj = new Date(date + 'T12:00:00');
    const dayOfWeek = dayNames[dObj.getDay()];
    let isDay1Rest = false;
    if (staff.rest_day && staff.rest_day.toUpperCase() === dayOfWeek) isDay1Rest = true;
    if (staff.category_id !== 4) {
      const origLinkDef = await getActiveLinkDef(staff.category_id, origLink, date);
      if (origLink === null || (origLinkDef && origLinkDef.is_rest === 1)) isDay1Rest = true;
    }
    const day1RestRemark = (isDay1Rest) ? ` - Rest day worked (CR credited for ${formatDateDisplay(date)})` : '';
    const musterRemark = reason + day1RestRemark;

    // Multi-module synchronization across Muster, TA, NDA, Diary, LR Sheet
    await syncDutyChangeAcrossAllModules({ get, all, run }, staff.id, date, {
      targetTrain: target_train,
      targetLink: effectiveLink,
      isLeave: false
    });

    await run(
      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
       VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         code = 'P',
         remarks = excluded.remarks,
         updated_by = excluded.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
      [staff.id, date, musterRemark]
    );

    // Multi-Day Link Set Assignment for ALL staff (Categories 1, 2, 3, 4):
    // If assigned to a multi-day link set (2-day, 3-day, or 4-day link), assign to entire beat!
    if (effectiveLink !== null) {
      const linkSet = getLinkSetDetails(effectiveTargetCat, effectiveLink);
      if (linkSet && linkSet.isFirstDayOfSet && linkSet.remainingLinks.length > 0) {
        for (let k = 0; k < linkSet.remainingLinks.length; k++) {
          const remLinkNum = linkSet.remainingLinks[k];
          const nextDate = new Date(date + 'T12:00:00');
          nextDate.setDate(nextDate.getDate() + k + 1);
          const y = nextDate.getFullYear();
          const m = String(nextDate.getMonth() + 1).padStart(2, '0');
          const d = String(nextDate.getDate()).padStart(2, '0');
          const nextDateStr = `${y}-${m}-${d}`;

          // Check if this date was a scheduled REST day for this staff member
          let isNextDayRest = false;
          const nextDObj = new Date(nextDateStr + 'T12:00:00');
          const nextDayOfWeek = dayNames[nextDObj.getDay()];
          if (staff.rest_day && staff.rest_day.toUpperCase() === nextDayOfWeek) isNextDayRest = true;
          if (staff.category_id !== 4) {
            const nextDayOffset = getDayOffset(cat.anchor_date, nextDateStr);
            const nextOrigLink = getBaseLinkNumber(staff.row_position, nextDayOffset, cat.cycle_length);
            const nextLinkDef = await getActiveLinkDef(staff.category_id, nextOrigLink, nextDateStr);
            if (nextOrigLink === null || (nextLinkDef && nextLinkDef.is_rest === 1)) isNextDayRest = true;
          }

          const restRemark = isNextDayRest ? ` - Rest day worked (CR credited for ${formatDateDisplay(nextDateStr)})` : '';
          const nextReason = `Assigned Link #${remLinkNum} (Day ${k + 2} of Link #${effectiveLink})${restRemark}`;

          await run(
            `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, substitute_staff_id, substitute_name, reason, target_category_id)
             VALUES (?, ?, NULL, ?, 'CHANGED_LINK', NULL, NULL, ?, ?)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               overridden_link_number = excluded.overridden_link_number,
               status = 'CHANGED_LINK',
               reason = excluded.reason,
               target_category_id = excluded.target_category_id`,
            [staff.id, nextDateStr, remLinkNum, nextReason, effectiveTargetCat]
          );

          await run(
            `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
             VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
             ON CONFLICT(staff_id, date) DO UPDATE SET
               code = 'P',
               remarks = excluded.remarks,
               updated_by = excluded.updated_by,
               updated_at = CURRENT_TIMESTAMP`,
            [staff.id, nextDateStr, nextReason]
          );

          // Multi-module synchronization across Muster, TA, NDA, Diary, LR Sheet
          await syncDutyChangeAcrossAllModules({ get, all, run }, staff.id, nextDateStr, {
            targetTrain: target_train,
            targetLink: remLinkNum,
            isLeave: false
          });
        }
      }
    }

    // Record audit log with undo data
    const undoData = {
      action: 'DRAG_ASSIGN_DUTY',
      date,
      staff_id: staff.id,
      staff_name: staff.name,
      previous_override: existingOverride || null,
      previous_muster: existingMuster || null
    };

    const targetDesc = isExtraCrew
      ? `Train ${target_train} as Extra Crew (down below)`
      : `Train ${target_train} (Link #${effectiveLink})`;

    await logAudit(
      'Admin',
      'DRAG_ASSIGN_DUTY',
      `Assigned ${staff.name} to ${targetDesc} on ${date}`,
      undoData
    );

    res.json({
      success: true,
      message: `Assigned ${staff.name} to ${targetDesc}!`,
      is_extra: isExtraCrew,
      target_train,
      target_link: effectiveLink
    });
  } catch (err) {
    console.error('Error in drag-assign-train:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/duty/assign-non-daily-train - Assign staff to a non-daily train service
app.post('/api/duty/assign-non-daily-train', requireAdmin, async (req, res) => {
  const { staff_id, date, non_daily_train_id, train_number, source_link } = req.body;
  if (!staff_id || !date || (!non_daily_train_id && !train_number)) {
    return res.status(400).json({ error: 'staff_id, date, and train_number or non_daily_train_id are required' });
  }
  try {
    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });

    let trainObj = null;
    if (non_daily_train_id) {
      trainObj = await get('SELECT * FROM non_daily_trains WHERE id = ?', [non_daily_train_id]);
    } else if (train_number) {
      trainObj = await get('SELECT * FROM non_daily_trains WHERE train_number = ?', [train_number]);
    }
    const finalTrainNo = trainObj ? trainObj.train_number : train_number;
    const cat = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
    const dayOffset = getDayOffset(cat.anchor_date, date);
    const origLink = getBaseLinkNumber(staff.row_position, dayOffset, cat.cycle_length);

    const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, date]);
    const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staff.id, date]);

    const reason = `Assigned to Non-Daily Train ${finalTrainNo}${trainObj && trainObj.departure_station ? ` (${trainObj.departure_station} ➔ ${trainObj.arrival_station})` : ''}`;
    await run(
      `INSERT INTO overrides (
        staff_id, date, overridden_link_number, status, target_category_id,
        reason, original_link_number, extra_train_no, is_extra,
        shifted_from_link, shifted_from_train, shifted_place,
        advance_train_no, is_advance_duty
      ) VALUES (?, ?, NULL, 'EXTRA_CREW', ?, ?, ?, ?, 1, ?, 'NON_DAILY', 'NON_DAILY_TRAIN', NULL, 0)
      ON CONFLICT(staff_id, date) DO UPDATE SET
        overridden_link_number = NULL,
        status = 'EXTRA_CREW',
        target_category_id = excluded.target_category_id,
        reason = excluded.reason,
        original_link_number = COALESCE(overrides.original_link_number, excluded.original_link_number),
        extra_train_no = excluded.extra_train_no,
        is_extra = 1,
        shifted_from_link = excluded.shifted_from_link,
        shifted_from_train = excluded.shifted_from_train,
        shifted_place = 'NON_DAILY_TRAIN',
        advance_train_no = NULL,
        is_advance_duty = 0`,
      [
        staff.id,
        date,
        staff.category_id,
        reason,
        origLink,
        finalTrainNo,
        source_link || origLink || null
      ]
    );

    // Sync muster to Present (P)
    await run(
      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
       VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         code = 'P',
         remarks = excluded.remarks,
         updated_by = 'Admin',
         updated_at = CURRENT_TIMESTAMP`,
      [staff.id, date, `Train ${finalTrainNo}`]
    );

    // Clear any previous substitute reference for this staff on this date so their previous slot shows vacant
    await run(
      'UPDATE overrides SET substitute_staff_id = NULL, substitute_name = NULL WHERE substitute_staff_id = ? AND date = ?',
      [staff.id, date]
    );

    // Keep non_daily_trains template table clean (assignments are date-specific in overrides)
    await run(
      'UPDATE non_daily_trains SET assigned_staff_id = NULL, assigned_staff_name = NULL WHERE assigned_staff_id = ?',
      [staff.id]
    );

    // Sync TA, NDA, Diary
    await syncDutyChangeAcrossAllModules({ get, all, run }, staff.id, date, {
      targetTrain: finalTrainNo,
      isLeave: false
    });

    const undoData = {
      action: 'ASSIGN_NON_DAILY_TRAIN',
      staff_id: staff.id,
      staff_name: staff.name,
      date,
      train_number: finalTrainNo,
      previous_override: existingOverride || null,
      previous_muster: existingMuster || null
    };

    await logAudit('Admin', 'ASSIGN_NON_DAILY_TRAIN', `Assigned ${staff.name} to Non-Daily Train ${finalTrainNo} on ${date}`, undoData);

    res.json({
      success: true,
      message: `Assigned ${staff.name} to Non-Daily Train ${finalTrainNo}!`,
      train_number: finalTrainNo,
      staff_name: staff.name
    });
  } catch (err) {
    console.error('Error in assign-non-daily-train:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/duty/unassign-non-daily-train - Remove staff from non-daily train and reset duty
app.post('/api/duty/unassign-non-daily-train', requireAdmin, async (req, res) => {
  const { staff_id, date, non_daily_train_id } = req.body;
  try {
    let resolvedStaffId = staff_id;
    if (!resolvedStaffId && non_daily_train_id) {
      const trainRecord = await get('SELECT assigned_staff_id FROM non_daily_trains WHERE id = ?', [non_daily_train_id]);
      if (trainRecord && trainRecord.assigned_staff_id) resolvedStaffId = trainRecord.assigned_staff_id;
    }
    let existingOverride = null;
    let existingMuster = null;
    if (resolvedStaffId && date) {
      existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [resolvedStaffId, date]);
      existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [resolvedStaffId, date]);
      await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [resolvedStaffId, date]);
      await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [resolvedStaffId, date]);
      await run(
        'UPDATE non_daily_trains SET assigned_staff_id = NULL, assigned_staff_name = NULL WHERE assigned_staff_id = ?',
        [resolvedStaffId]
      );
      await syncDutyChangeAcrossAllModules({ get, all, run }, resolvedStaffId, date, {
        targetTrain: null,
        isLeave: false
      });
    }
    if (non_daily_train_id) {
      await run(
        'UPDATE non_daily_trains SET assigned_staff_id = NULL, assigned_staff_name = NULL WHERE id = ?',
        [non_daily_train_id]
      );
    }
    const undoData = {
      action: 'UNASSIGN_NON_DAILY_TRAIN',
      staff_id: resolvedStaffId,
      date,
      non_daily_train_id,
      previous_override: existingOverride || null,
      previous_muster: existingMuster || null
    };
    await logAudit('Admin', 'UNASSIGN_NON_DAILY_TRAIN', `Unassigned staff ${staff_id || ''} from Non-Daily Train ID ${non_daily_train_id || ''} on ${date || ''}`, undoData);
    res.json({ success: true, message: 'Unassigned staff from non-daily train successfully' });
  } catch (err) {
    console.error('Error in unassign-non-daily-train:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/overrides/audit', async (req, res) => {
  try {
    const logs = await all(`
      SELECT o.*, s.name as staff_name, s.designation as staff_desg, c.name as category_name 
      FROM overrides o 
      JOIN staff s ON o.staff_id = s.id 
      JOIN categories c ON s.category_id = c.id 
      ORDER BY o.created_at DESC
    `);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/audit-logs', async (req, res) => {
  try {
    const logs = await all('SELECT id, user_role, action_type, description, timestamp, undo_data, is_undone FROM audit_logs ORDER BY timestamp DESC, id DESC LIMIT 200');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Restore or delete override and muster records cleanly
async function restoreOverrideAndMuster(staffId, date, prevOverride, prevMuster) {
  if (prevOverride) {
    await run(
      `INSERT INTO overrides (
        staff_id, date, original_link_number, overridden_link_number, status,
        substitute_staff_id, substitute_name, reason, target_category_id,
        extra_train_no, is_extra, shifted_from_link, shifted_from_train,
        shifted_place, advance_train_no, is_advance_duty, leave_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(staff_id, date) DO UPDATE SET
        original_link_number = excluded.original_link_number,
        overridden_link_number = excluded.overridden_link_number,
        status = excluded.status,
        substitute_staff_id = excluded.substitute_staff_id,
        substitute_name = excluded.substitute_name,
        reason = excluded.reason,
        target_category_id = excluded.target_category_id,
        extra_train_no = excluded.extra_train_no,
        is_extra = excluded.is_extra,
        shifted_from_link = excluded.shifted_from_link,
        shifted_from_train = excluded.shifted_from_train,
        shifted_place = excluded.shifted_place,
        advance_train_no = excluded.advance_train_no,
        is_advance_duty = excluded.is_advance_duty,
        leave_type = excluded.leave_type`,
      [
        prevOverride.staff_id, date, prevOverride.original_link_number, prevOverride.overridden_link_number,
        prevOverride.status, prevOverride.substitute_staff_id, prevOverride.substitute_name,
        prevOverride.reason, prevOverride.target_category_id, prevOverride.extra_train_no,
        prevOverride.is_extra, prevOverride.shifted_from_link, prevOverride.shifted_from_train,
        prevOverride.shifted_place, prevOverride.advance_train_no, prevOverride.is_advance_duty,
        prevOverride.leave_type
      ]
    );
  } else {
    await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [staffId, date]);
  }

  if (prevMuster) {
    await run(
      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         code = excluded.code,
         remarks = excluded.remarks,
         updated_by = excluded.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
      [prevMuster.staff_id, date, prevMuster.code, prevMuster.remarks, prevMuster.updated_by || 'Admin']
    );
  } else {
    await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [staffId, date]);
  }

  // Clear substitute reference if this staff was substituting
  await run(
    'UPDATE overrides SET substitute_staff_id = NULL, substitute_name = NULL WHERE substitute_staff_id = ? AND date = ?',
    [staffId, date]
  );

  // Sync across modules (TA, NDA, Diary)
  await syncDutyChangeAcrossAllModules({ get, all, run }, staffId, date, {
    targetLink: prevOverride?.overridden_link_number || null,
    targetTrain: prevOverride?.extra_train_no || null,
    isLeave: ['LEAVE', 'SICK', 'CR', 'ABSENT'].includes(prevOverride?.status)
  });

  // If LR staff, sync LR sheet record
  const s = await get('SELECT category_id, rest_day FROM staff WHERE id = ?', [staffId]);
  if (s && s.category_id === 4) {
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dObj = new Date(date + 'T12:00:00');
    const dayOfWeek = dayNames[dObj.getDay()];
    const resolvedDuty = await resolveDutyCodeForLRStaff(staffId, date, dayOfWeek, s.rest_day);
    if (resolvedDuty && resolvedDuty.code) {
      await syncLRSheetRecord(staffId, date, resolvedDuty.code, prevOverride?.reason || 'Restored duty');
    } else {
      await run('DELETE FROM lr_sheet_records WHERE staff_id = ? AND date = ?', [staffId, date]);
    }
  }
}

// POST /api/audit-logs/:id/undo - Undo an audited operation and revert its effects
app.post('/api/audit-logs/:id/undo', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const log = await get('SELECT * FROM audit_logs WHERE id = ?', [id]);
    if (!log) {
      return res.status(404).json({ error: 'Audit log entry not found' });
    }
    if (log.is_undone) {
      return res.status(400).json({ error: 'This action has already been undone.' });
    }

    let undoData = null;
    if (log.undo_data) {
      try {
        undoData = JSON.parse(log.undo_data);
      } catch (e) {}
    }

    let undoneSuccess = false;
    let detailsMsg = '';

    if (undoData) {
      if (undoData.action === 'EXCHANGE_STAFF') {
        const { date, staff_a, staff_b } = undoData;
        await restoreOverrideAndMuster(staff_a.id, date, staff_a.previous_override, staff_a.previous_muster);
        await restoreOverrideAndMuster(staff_b.id, date, staff_b.previous_override, staff_b.previous_muster);
        undoneSuccess = true;
        detailsMsg = `Reverted duty exchange between ${staff_a.name} and ${staff_b.name} on ${date}`;
      } else if (['CHANGED_LINK', 'MANUAL_OVERRIDE', 'REMOVE_FROM_LINK', 'UPGRADE_TO_COR'].includes(undoData.action)) {
        const { staff_id, staff_name, date, previous_override, previous_muster } = undoData;
        await restoreOverrideAndMuster(staff_id, date, previous_override, previous_muster);
        undoneSuccess = true;
        detailsMsg = `Reverted ${undoData.action} for ${staff_name || `staff ID ${staff_id}`} on ${date}`;
      } else if (undoData.action === 'DRAG_ASSIGN_DUTY') {
        const { staff_id, staff_name, date, previous_override, previous_muster } = undoData;
        await restoreOverrideAndMuster(staff_id, date, previous_override, previous_muster);
        undoneSuccess = true;
        detailsMsg = `Reverted drag duty assignment for ${staff_name || `staff ID ${staff_id}`} on ${date}`;
      } else if (undoData.action === 'ASSIGN_NON_DAILY_TRAIN') {
        const { staff_id, staff_name, date, train_number, previous_override, previous_muster } = undoData;
        await restoreOverrideAndMuster(staff_id, date, previous_override, previous_muster);
        await run('UPDATE non_daily_trains SET assigned_staff_id = NULL, assigned_staff_name = NULL WHERE assigned_staff_id = ?', [staff_id]);
        undoneSuccess = true;
        detailsMsg = `Reverted Non-Daily Train ${train_number || ''} assignment for ${staff_name || `staff ID ${staff_id}`} on ${date}`;
      } else if (undoData.action === 'UNASSIGN_NON_DAILY_TRAIN') {
        const { staff_id, date, previous_override, previous_muster } = undoData;
        if (staff_id && date) {
          await restoreOverrideAndMuster(staff_id, date, previous_override, previous_muster);
        }
        undoneSuccess = true;
        detailsMsg = `Reverted unassign of Non-Daily Train for staff ID ${staff_id || ''} on ${date || ''}`;
      } else if (['SICK', 'LEAVE', 'CR', 'ABSENT', 'STAFF_SICK', 'STAFF_LEAVE', 'STAFF_CR', 'STAFF_ABSENT'].includes(undoData.action)) {
        const { staff_id, staff_name, dates, replacement_staff_id, snapshots } = undoData;
        for (const snap of (snapshots || [])) {
          const dStr = snap.date;
          if (replacement_staff_id) {
            await restoreOverrideAndMuster(replacement_staff_id, dStr, snap.subOverride, snap.subMuster);
          }
          await restoreOverrideAndMuster(staff_id, dStr, snap.override, snap.muster);
        }
        undoneSuccess = true;
        detailsMsg = `Reverted ${undoData.action} for ${staff_name || `staff ID ${staff_id}`} on ${dates ? dates.join(', ') : 'selected dates'}`;
      } else if (['RESET', 'CANCEL_LEAVE', 'RESET_DUTY'].includes(undoData.action)) {
        const { staff_id, staff_name, dates, snapshots } = undoData;
        for (const snap of (snapshots || [])) {
          const dStr = snap.date;
          await restoreOverrideAndMuster(staff_id, dStr, snap.override, snap.muster);
          if (snap.subOverride || snap.subMuster) {
            const subId = snap.subOverride?.staff_id || snap.subMuster?.staff_id;
            if (subId) {
              await restoreOverrideAndMuster(subId, dStr, snap.subOverride, snap.subMuster);
            }
          }
        }
        undoneSuccess = true;
        detailsMsg = `Reverted reset/cancellation and restored previous duty for ${staff_name || `staff ID ${staff_id}`}`;
      } else if (['SHIFTED', 'SHIFTED_PLACE'].includes(undoData.action)) {
        const { staff_id, staff_name, dates, replacement_staff_id, snapshots } = undoData;
        for (const snap of (snapshots || [])) {
          const dStr = snap.date;
          await restoreOverrideAndMuster(staff_id, dStr, snap.override, snap.muster);
          if (replacement_staff_id) {
            await restoreOverrideAndMuster(replacement_staff_id, dStr, snap.subOverride, snap.subMuster);
          }
        }
        undoneSuccess = true;
        detailsMsg = `Reverted shift for ${staff_name || `staff ID ${staff_id}`} on ${dates ? dates.join(', ') : 'date'}`;
      } else if (['UTILISED_ADVANCE', 'ADVANCE_DUTY', 'ADVANCE_BOOKED'].includes(undoData.action)) {
        const { staff_id, staff_name, date, replacement_staff_id, previous_override, previous_muster } = undoData;
        await restoreOverrideAndMuster(staff_id, date, previous_override, previous_muster);
        if (replacement_staff_id) {
          await run('DELETE FROM overrides WHERE staff_id = ? AND date = ? AND status = "SUBSTITUTE"', [replacement_staff_id, date]);
          await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [replacement_staff_id, date]);
        }
        undoneSuccess = true;
        detailsMsg = `Reverted advance utilisation for ${staff_name || `staff ID ${staff_id}`} on ${date}`;
      } else if (undoData.action === 'APPROVE_LEAVE') {
        const { staff_id, staff_name, from_date, to_date, request_id, snapshots } = undoData;
        for (const snap of (snapshots || [])) {
          await restoreOverrideAndMuster(staff_id, snap.date, snap.override, snap.muster);
        }
        if (request_id) {
          await run("UPDATE leave_requests SET status = 'PENDING', approved_by = NULL, approved_at = NULL WHERE id = ?", [request_id]);
        }
        undoneSuccess = true;
        detailsMsg = `Reverted approved leave for ${staff_name || `staff ID ${staff_id}`} from ${from_date} to ${to_date}`;
      } else if (undoData.action === 'APPROVE_SWAP') {
        const { date, staff_a, staff_b, request_id } = undoData;
        await restoreOverrideAndMuster(staff_a.id, date, staff_a.previous_override, staff_a.previous_muster);
        await restoreOverrideAndMuster(staff_b.id, date, staff_b.previous_override, staff_b.previous_muster);
        if (request_id) {
          await run("UPDATE leave_requests SET status = 'PENDING', approved_by = NULL, approved_at = NULL WHERE id = ?", [request_id]);
        }
        undoneSuccess = true;
        detailsMsg = `Reverted approved swap between ${staff_a.name} and ${staff_b.name} on ${date}`;
      } else if (undoData.action === 'MUSTER_CELL_UPDATE' || undoData.action === 'MUSTER_CELL_RESET') {
        const { staff_id, date, previous_code, previous_remarks } = undoData;
        if (previous_code) {
          await run(
            `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at) VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
             ON CONFLICT(staff_id, date) DO UPDATE SET code = excluded.code, remarks = excluded.remarks`,
            [staff_id, date, previous_code, previous_remarks]
          );
        } else {
          await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, date]);
        }
        undoneSuccess = true;
        detailsMsg = `Reverted muster cell for staff ID ${staff_id} on ${date}`;
      }
    }

    // Fallback: Parse description if undoData is not set (e.g. legacy logs)
    if (!undoneSuccess) {
      const desc = log.description || '';
      const nonDailyMatch = desc.match(/Assigned (.+?) to Non-Daily Train (\w+) on (\d{4}-\d{2}-\d{2})/i);
      const dragMatch = desc.match(/Assigned (.+?) to (?:Train|Link) (.+?) on (\d{4}-\d{2}-\d{2})/i);
      const linkMatch = desc.match(/Changed link for (.+?) on (\d{4}-\d{2}-\d{2})/i);
      const leaveMatch = desc.match(/Marked (.+?) as (LEAVE|SICK|CR|ABSENT).*?on (\d{4}-\d{2}-\d{2})/i);
      const exchMatch = desc.match(/Exchanged duties between (.+?) .*? and (.+?) .*? on (\d{4}-\d{2}-\d{2})/i);
      const shiftMatch = desc.match(/Shifted (.+?) to (.+?) on (\d{4}-\d{2}-\d{2})/i);
      const resetMatch = desc.match(/Reset duty status and muster records for (.+?) between (\d{4}-\d{2}-\d{2}) and (\d{4}-\d{2}-\d{2})/i);
      const cancelLeaveMatch = desc.match(/Cancelled leave for (.+?) between (\d{4}-\d{2}-\d{2}) and (\d{4}-\d{2}-\d{2})/i);
      const advanceMatch = desc.match(/Marked (.+?) as Utilised in Advance.*?on (\d{4}-\d{2}-\d{2})/i);
      const upgradeMatch = desc.match(/Upgraded (.+?) from Sleeper Link.*?on (\d{4}-\d{2}-\d{2})/i);
      const appLeaveMatch = desc.match(/Approved leave for (.+?) from (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/i);
      const appSwapMatch = desc.match(/Approved swap between (.+?) and (.+?) on (\d{4}-\d{2}-\d{2})/i);
      const musterMatch = desc.match(/Assigned muster code '(.+?)' for staff ID (\d+) on (\d{4}-\d{2}-\d{2})/i);

      if (nonDailyMatch) {
        const staffName = nonDailyMatch[1].trim();
        const trainNo = nonDailyMatch[2].trim();
        const dStr = nonDailyMatch[3];
        const s = await get('SELECT id FROM staff WHERE name = ?', [staffName]);
        if (s) {
          await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [s.id, dStr]);
          await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [s.id, dStr]);
          await run('UPDATE non_daily_trains SET assigned_staff_id = NULL, assigned_staff_name = NULL WHERE assigned_staff_id = ?', [s.id]);
          await syncDutyChangeAcrossAllModules({ get, all, run }, s.id, dStr, { targetTrain: null, targetLink: null, isLeave: false });
          undoneSuccess = true;
          detailsMsg = `Reverted Non-Daily Train ${trainNo} assignment for ${staffName} on ${dStr}`;
        }
      } else if (dragMatch) {
        const staffName = dragMatch[1].trim();
        const dStr = dragMatch[3];
        const s = await get('SELECT id FROM staff WHERE name = ?', [staffName]);
        if (s) {
          await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [s.id, dStr]);
          await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [s.id, dStr]);
          await syncDutyChangeAcrossAllModules({ get, all, run }, s.id, dStr, { targetTrain: null, targetLink: null, isLeave: false });
          undoneSuccess = true;
          detailsMsg = `Reverted drag assignment for ${staffName} on ${dStr}`;
        }
      } else if (linkMatch) {
        const staffName = linkMatch[1].trim();
        const dStr = linkMatch[2];
        const s = await get('SELECT id FROM staff WHERE name = ?', [staffName]);
        if (s) {
          await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [s.id, dStr]);
          await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [s.id, dStr]);
          await syncDutyChangeAcrossAllModules({ get, all, run }, s.id, dStr, { targetTrain: null, targetLink: null, isLeave: false });
          undoneSuccess = true;
          detailsMsg = `Reverted link change for ${staffName} on ${dStr}`;
        }
      } else if (leaveMatch) {
        const staffName = leaveMatch[1].trim();
        const dStr = leaveMatch[3];
        const s = await get('SELECT id FROM staff WHERE name = ?', [staffName]);
        if (s) {
          const ovr = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [s.id, dStr]);
          if (ovr && ovr.substitute_staff_id) {
            await run('DELETE FROM overrides WHERE staff_id = ? AND date = ? AND status = "SUBSTITUTE"', [ovr.substitute_staff_id, dStr]);
            await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [ovr.substitute_staff_id, dStr]);
          }
          await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [s.id, dStr]);
          await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [s.id, dStr]);
          await syncDutyChangeAcrossAllModules({ get, all, run }, s.id, dStr, { targetTrain: null, targetLink: null, isLeave: false });
          undoneSuccess = true;
          detailsMsg = `Reverted leave for ${staffName} on ${dStr}`;
        }
      } else if (exchMatch) {
        const staffAName = exchMatch[1].trim();
        const staffBName = exchMatch[2].trim();
        const dStr = exchMatch[3];
        const sA = await get('SELECT id FROM staff WHERE name = ?', [staffAName]);
        const sB = await get('SELECT id FROM staff WHERE name = ?', [staffBName]);
        if (sA) {
          await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [sA.id, dStr]);
          await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [sA.id, dStr]);
          await syncDutyChangeAcrossAllModules({ get, all, run }, sA.id, dStr, { targetTrain: null, targetLink: null, isLeave: false });
        }
        if (sB) {
          await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [sB.id, dStr]);
          await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [sB.id, dStr]);
          await syncDutyChangeAcrossAllModules({ get, all, run }, sB.id, dStr, { targetTrain: null, targetLink: null, isLeave: false });
        }
        undoneSuccess = true;
        detailsMsg = `Reverted duty exchange between ${staffAName} and ${staffBName} on ${dStr}`;
      } else if (shiftMatch) {
        const staffName = shiftMatch[1].trim();
        const dStr = shiftMatch[3];
        const s = await get('SELECT id FROM staff WHERE name = ?', [staffName]);
        if (s) {
          await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [s.id, dStr]);
          await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [s.id, dStr]);
          await syncDutyChangeAcrossAllModules({ get, all, run }, s.id, dStr, { targetTrain: null, targetLink: null, isLeave: false });
          undoneSuccess = true;
          detailsMsg = `Reverted shift for ${staffName} on ${dStr}`;
        }
      } else if (resetMatch || cancelLeaveMatch) {
        const m = resetMatch || cancelLeaveMatch;
        const staffName = m[1].trim();
        const fromD = m[2];
        const toD = m[3];
        const s = await get('SELECT id FROM staff WHERE name = ?', [staffName]);
        if (s) {
          undoneSuccess = true;
          detailsMsg = `Reverted reset for ${staffName} between ${fromD} and ${toD}`;
        }
      } else if (advanceMatch) {
        const staffName = advanceMatch[1].trim();
        const dStr = advanceMatch[2];
        const s = await get('SELECT id FROM staff WHERE name = ?', [staffName]);
        if (s) {
          await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [s.id, dStr]);
          await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [s.id, dStr]);
          await syncDutyChangeAcrossAllModules({ get, all, run }, s.id, dStr, { targetTrain: null, targetLink: null, isLeave: false });
          undoneSuccess = true;
          detailsMsg = `Reverted advance duty for ${staffName} on ${dStr}`;
        }
      } else if (upgradeMatch) {
        const staffName = upgradeMatch[1].trim();
        const dStr = upgradeMatch[2];
        const s = await get('SELECT id FROM staff WHERE name = ?', [staffName]);
        if (s) {
          await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [s.id, dStr]);
          await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [s.id, dStr]);
          await syncDutyChangeAcrossAllModules({ get, all, run }, s.id, dStr, { targetTrain: null, targetLink: null, isLeave: false });
          undoneSuccess = true;
          detailsMsg = `Reverted COR upgrade for ${staffName} on ${dStr}`;
        }
      } else if (appLeaveMatch) {
        const staffName = appLeaveMatch[1].trim();
        const fromD = appLeaveMatch[2];
        const toD = appLeaveMatch[3];
        const s = await get('SELECT id FROM staff WHERE name = ?', [staffName]);
        if (s) {
          await run('DELETE FROM overrides WHERE staff_id = ? AND date >= ? AND date <= ?', [s.id, fromD, toD]);
          await run('DELETE FROM muster_records WHERE staff_id = ? AND date >= ? AND date <= ?', [s.id, fromD, toD]);
          undoneSuccess = true;
          detailsMsg = `Reverted approved leave for ${staffName} from ${fromD} to ${toD}`;
        }
      } else if (appSwapMatch) {
        const staffAName = appSwapMatch[1].trim();
        const staffBName = appSwapMatch[2].trim();
        const dStr = appSwapMatch[3];
        const sA = await get('SELECT id FROM staff WHERE name = ?', [staffAName]);
        const sB = await get('SELECT id FROM staff WHERE name = ?', [staffBName]);
        if (sA) {
          await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [sA.id, dStr]);
          await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [sA.id, dStr]);
        }
        if (sB) {
          await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [sB.id, dStr]);
          await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [sB.id, dStr]);
        }
        undoneSuccess = true;
        detailsMsg = `Reverted approved swap between ${staffAName} and ${staffBName} on ${dStr}`;
      } else if (musterMatch) {
        const sId = parseInt(musterMatch[2], 10);
        const dStr = musterMatch[3];
        await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [sId, dStr]);
        undoneSuccess = true;
        detailsMsg = `Reverted muster cell for staff ID ${sId} on ${dStr}`;
      }
    }

    if (!undoneSuccess) {
      return res.status(400).json({ error: 'Unable to automatically undo this action type.' });
    }

    // Mark as undone
    await run('UPDATE audit_logs SET is_undone = 1 WHERE id = ?', [id]);
    await logAudit('Admin', 'UNDO', `Undid ${log.action_type}: ${detailsMsg || log.description}`);

    res.json({
      success: true,
      message: `Successfully undone: ${detailsMsg || log.description}`
    });
  } catch (err) {
    console.error('Error undoing audit log action:', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// LEAVE & SWAP REQUESTS API
// ----------------------------------------------------
app.get('/api/leave-requests', async (req, res) => {
  try {
    const requests = await all(`
      SELECT lr.*, 
             s.name as staff_name, s.designation as staff_desg, s.category_id,
             ss.name as swap_staff_name, ss.designation as swap_staff_desg 
      FROM leave_requests lr
      JOIN staff s ON lr.staff_id = s.id
      LEFT JOIN staff ss ON lr.swap_staff_id = ss.id
      ORDER BY COALESCE(lr.from_date, lr.date) DESC, lr.id DESC
    `);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leave-requests', async (req, res) => {
  const { staff_id, date, from_date, to_date, type, swap_staff_id, reason } = req.body;
  const fromDate = from_date || date;
  const toDate = to_date || fromDate;
  if (!staff_id || !fromDate || !type) {
    return res.status(400).json({ error: 'Staff ID, from_date/date and type are required' });
  }
  try {
    const result = await run(
      'INSERT INTO leave_requests (staff_id, date, from_date, to_date, type, swap_staff_id, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [staff_id, fromDate, fromDate, toDate, type.toUpperCase(), swap_staff_id || null, reason || '', 'PENDING']
    );
    res.json({ id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leave-requests/:id/approve', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const request = await get('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const staffA = await get('SELECT * FROM staff WHERE id = ?', [request.staff_id]);
    const cat = await get('SELECT * FROM categories WHERE id = ?', [staffA.category_id]);

    // Apply the leave or swap logic to create overrides
    if (request.type === 'LEAVE') {
      const fromD = request.from_date || request.date;
      const toD = request.to_date || fromD;

      const undoSnapshots = [];
      // Iterate through each date from fromD to toD (inclusive)
      const start = new Date(fromD + 'T00:00:00Z');
      const end = new Date(toD + 'T00:00:00Z');
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const curDateStr = d.toISOString().split('T')[0];
        const existingOverride = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staffA.id, curDateStr]);
        const existingMuster = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staffA.id, curDateStr]);
        undoSnapshots.push({
          date: curDateStr,
          override: existingOverride || null,
          muster: existingMuster || null
        });

        const dayOffset = getDayOffset(cat.anchor_date, curDateStr);
        const origLink = getBaseLinkNumber(staffA.row_position, dayOffset, cat.cycle_length);

        await run(
          `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason) 
           VALUES (?, ?, ?, NULL, 'LEAVE', ?) 
           ON CONFLICT(staff_id, date) DO UPDATE SET overridden_link_number = NULL, status = 'LEAVE', reason = excluded.reason`,
          [staffA.id, curDateStr, origLink, `Approved Leave: ${request.reason || 'On Leave'}`]
        );
      }

      if (fromD === toD) {
        const dayOffset = getDayOffset(cat.anchor_date, fromD);
        const origLink = getBaseLinkNumber(staffA.row_position, dayOffset, cat.cycle_length);
        const linkSet = getLinkSetDetails(staffA.category_id, origLink);
        if (linkSet && linkSet.isFirstDayOfSet && linkSet.remainingLinks.length > 0) {
          for (let k = 0; k < linkSet.remainingLinks.length; k++) {
            const remLink = linkSet.remainingLinks[k];
            const nextDate = new Date(fromD + 'T12:00:00');
            nextDate.setDate(nextDate.getDate() + k + 1);
            const y = nextDate.getFullYear();
            const m = String(nextDate.getMonth() + 1).padStart(2, '0');
            const d = String(nextDate.getDate()).padStart(2, '0');
            const remDateStr = `${y}-${m}-${d}`;

            await run(
              `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) 
               VALUES (?, ?, ?, NULL, 'AVAILABLE_FOR_BOOKING', ?, ?) 
               ON CONFLICT(staff_id, date) DO UPDATE SET overridden_link_number = NULL, status = 'AVAILABLE_FOR_BOOKING', reason = excluded.reason, target_category_id = excluded.target_category_id`,
              [staffA.id, remDateStr, remLink, `Available for Booking Duty at HQ (Took 1-day leave on Link #${origLink})`, staffA.category_id]
            );

            await run(
              `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
               VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
               ON CONFLICT(staff_id, date) DO UPDATE SET code = 'P', remarks = excluded.remarks, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
              [staffA.id, remDateStr, `Present at HQ (Available for booking - 1-day leave on Link #${origLink})`]
            );
          }
        }
      }

      const undoData = {
        action: 'APPROVE_LEAVE',
        request_id: id,
        staff_id: staffA.id,
        staff_name: staffA.name,
        from_date: fromD,
        to_date: toD,
        snapshots: undoSnapshots
      };

      await logAudit('Admin', 'APPROVE_LEAVE', `Approved leave for ${staffA.name} from ${fromD} to ${toD}`, undoData);
    } else if (request.type === 'SWAP') {
      const swapDate = request.from_date || request.date;
      const dayOffset = getDayOffset(cat.anchor_date, swapDate);
      const staffB = await get('SELECT * FROM staff WHERE id = ?', [request.swap_staff_id]);
      if (!staffB) {
        return res.status(400).json({ error: 'Swap staff member not found' });
      }

      // Compute original links on that day
      const origLinkA = getBaseLinkNumber(staffA.row_position, dayOffset, cat.cycle_length);
      const origLinkB = getBaseLinkNumber(staffB.row_position, dayOffset, cat.cycle_length);

      // Check if there are already overrides to resolve
      const activeOverrideA = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staffA.id, swapDate]);
      const activeOverrideB = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staffB.id, swapDate]);
      const existingMusterA = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staffA.id, swapDate]);
      const existingMusterB = await get('SELECT * FROM muster_records WHERE staff_id = ? AND date = ?', [staffB.id, swapDate]);

      const dutyA = (activeOverrideA && activeOverrideA.overridden_link_number !== undefined) ? activeOverrideA.overridden_link_number : origLinkA;
      const dutyB = (activeOverrideB && activeOverrideB.overridden_link_number !== undefined) ? activeOverrideB.overridden_link_number : origLinkB;

      // Swap their current active duties on this date
      await run(
        `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, reason) 
         VALUES (?, ?, ?, ?, ?) 
         ON CONFLICT(staff_id, date) DO UPDATE SET overridden_link_number = excluded.overridden_link_number, reason = excluded.reason`,
        [staffA.id, swapDate, origLinkA, dutyB, `Swap with ${staffB.name}`]
      );

      await run(
        `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, reason) 
         VALUES (?, ?, ?, ?, ?) 
         ON CONFLICT(staff_id, date) DO UPDATE SET overridden_link_number = excluded.overridden_link_number, reason = excluded.reason`,
        [staffB.id, swapDate, origLinkB, dutyA, `Swap with ${staffA.name}`]
      );

      const undoData = {
        action: 'APPROVE_SWAP',
        request_id: id,
        date: swapDate,
        staff_a: { id: staffA.id, name: staffA.name, previous_override: activeOverrideA || null, previous_muster: existingMusterA || null },
        staff_b: { id: staffB.id, name: staffB.name, previous_override: activeOverrideB || null, previous_muster: existingMusterB || null }
      };

      await logAudit('Admin', 'APPROVE_SWAP', `Approved swap between ${staffA.name} and ${staffB.name} on ${swapDate}`, undoData);
    }

    // Update request status
    await run(
      "UPDATE leave_requests SET status = 'APPROVED', approved_by = 'Admin', approved_at = datetime('now') WHERE id = ?",
      [id]
    );

    res.json({ message: 'Request approved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leave-requests/:id/reject', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    await run(
      "UPDATE leave_requests SET status = 'REJECTED', reason = ? WHERE id = ?",
      [reason || 'Rejected by Admin', id]
    );
    res.json({ message: 'Request rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// ROSTER GENERATION API
// ----------------------------------------------------
app.get('/api/roster', async (req, res) => {
  const category_id = req.query.category_id || req.query.categoryId;
  const year = req.query.year;
  const month = req.query.month;
  const start_date = req.query.start_date || req.query.startDate;
  const end_date = req.query.end_date || req.query.endDate;
  if (!category_id || (!start_date && (!year || !month))) {
    return res.status(400).json({ error: 'Category ID and date parameters are required' });
  }

  try {
    const category = await get('SELECT * FROM categories WHERE id = ?', [category_id]);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const staffMembers = await all(
      'SELECT * FROM staff WHERE category_id = ? ORDER BY row_position',
      [category_id]
    );

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
      allLinks = await all('SELECT * FROM links');
      
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
      dates.push({
        dayOfMonth: curDate.getDate(),
        dateString: dateStr,
        dayOfWeek: weekdayNames[curDate.getDay()],
        dayOffset: getDayOffset(category.anchor_date, dateStr)
      });
      curDate.setDate(curDate.getDate() + 1);
    }

    const isCat4Category = parseInt(category_id, 10) === 4;

    // Build the grid
    const gridRows = [];
    for (const staff of staffMembers) {
      const rowCells = [];
      let lastAssignedLink = null;
      let lastTargetCat = null;
      
      for (const d of dates) {
        const key = `${staff.id}_${d.dateString}`;
        const muster = musterMap[key];
        const directOv = directOverrideMap[key];
        const subOv = subOverrideMap[key];
        const lrRec = lrMap[key];
        const earn = earningsMap[key];
        const dreg = dutyRegisterMap[key];

        let linkNum = null;
        let targetCatId = isCat4Category ? 1 : parseInt(category_id, 10);
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
          // 1. Muster attendance
          if (muster && ['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'SICK', 'CR', 'R', 'O', 'NH', 'OD'].includes(musterCode)) {
            isOverridden = true;
            linkNum = null;
            lastAssignedLink = null;
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
          } else if (directOv) {
            isOverridden = true;
            substituteStaffId = directOv.substitute_staff_id;
            substituteName = directOv.substitute_name;
            overrideReason = directOv.reason;
            leaveType = directOv.leave_type;

            if (['LEAVE', 'SICK', 'CR', 'REST', 'ABSENT'].includes(directOv.status)) {
              status = directOv.status;
              isRest = directOv.status === 'REST';
              linkNum = null;
              lastAssignedLink = null;
            } else if (directOv.status === 'AVAILABLE_FOR_BOOKING') {
              status = 'AVAILABLE_FOR_BOOKING';
              isRest = true;
              linkNum = null;
              lastAssignedLink = null;
            } else if (directOv.status === 'EXTRA_CREW' || directOv.extra_train_no || directOv.advance_train_no) {
              status = 'DUTY';
              linkNum = null;
              lastAssignedLink = null;
              customTrainNo = directOv.extra_train_no || directOv.advance_train_no || 'EXTRA';
              customFrom = 'GNT';
              customTo = '---';
              customCoaches = '-';
              customSetType = 'Extra Crew';
              overrideReason = directOv.reason || `Assigned to Extra Train ${customTrainNo}`;
            } else if (directOv.overridden_link_number !== null && directOv.overridden_link_number !== undefined) {
              linkNum = directOv.overridden_link_number;
              targetCatId = directOv.target_category_id || (linkNum > 21 ? 2 : 1);
              status = 'DUTY';
              lastAssignedLink = linkNum;
              lastTargetCat = targetCatId;
            } else {
              status = directOv.status || 'DUTY';
              linkNum = directOv.overridden_link_number;
            }
          } else if (subOv && subOv.status !== 'AVAILABLE_FOR_BOOKING') {
            // Worked as substitute for regular staff
            isOverridden = true;
            const assignedLink = subOv.overridden_link_number !== null && subOv.overridden_link_number !== undefined
              ? subOv.overridden_link_number
              : subOv.original_link_number;

            if (assignedLink) {
              linkNum = assignedLink;
              targetCatId = subOv.target_category_id || subOv.regular_staff_category || (linkNum > 21 ? 2 : 1);
              status = 'DUTY';
              overrideReason = subOv.reason || `Substitute for ${subOv.regular_staff_name || 'Staff'} on Link #${linkNum} (${subOv.leave_type || subOv.status || 'Leave'})`;
              lastAssignedLink = linkNum;
              lastTargetCat = targetCatId;
            } else {
              status = 'DUTY';
              overrideReason = subOv.reason || `Substitute for ${subOv.regular_staff_name || 'Staff'}`;
              lastAssignedLink = null;
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

          // If not yet assigned by Muster/Override/Continuation, check LR Sheet / Daily Earnings / Duty Register
          if (linkNum === null && status === 'DUTY' && !customTrainNo && !isOverridden) {
            if (lrRec && lrRec.duty_code) {
              const code = lrRec.duty_code.trim();
              isOverridden = true;
              if (code === 'R' || code === 'REST') {
                status = 'REST';
                isRest = true;
                overrideReason = lrRec.remarks || 'LR Sheet: Weekly Rest';
                lastAssignedLink = null;
              } else if (code === 'AVL' || code === 'REST_HQ') {
                status = 'AVAILABLE_FOR_BOOKING';
                isRest = true;
                overrideReason = lrRec.remarks || 'Available for Booking';
                lastAssignedLink = null;
              } else if (['CL', 'LAP', 'LHAP', 'CR', 'OD', 'S', 'SICK', 'CCL', 'SCL', 'NH'].includes(code.toUpperCase())) {
                status = ['S', 'SICK'].includes(code.toUpperCase()) ? 'SICK' : 'LEAVE';
                leaveType = code.toUpperCase();
                overrideReason = lrRec.remarks || `LR Sheet: ${code}`;
                lastAssignedLink = null;
              } else if (/^\d+$/.test(code)) {
                linkNum = parseInt(code, 10);
                const matchedLink = allLinks.find(l => l.link_number === linkNum && l.category_id !== 4);
                targetCatId = matchedLink ? matchedLink.category_id : (linkNum > 21 ? 2 : 1);
                status = 'DUTY';
                overrideReason = lrRec.remarks || `Daily Duty: Link #${linkNum}`;
                lastAssignedLink = linkNum;
                lastTargetCat = targetCatId;
              } else {
                const matchedLink = allLinks.find(l => l.category_id !== 4 && l.train_numbers && (l.train_numbers.includes(code) || code.includes(l.train_numbers)));
                if (matchedLink) {
                  linkNum = matchedLink.link_number;
                  targetCatId = matchedLink.category_id;
                  status = 'DUTY';
                  overrideReason = lrRec.remarks || `Daily Duty: Train ${code} (Link #${linkNum})`;
                  lastAssignedLink = linkNum;
                  lastTargetCat = targetCatId;
                } else {
                  customTrainNo = code;
                  customFrom = 'GNT';
                  customTo = '---';
                  customCoaches = '-';
                  status = 'DUTY';
                  overrideReason = lrRec.remarks || `Daily Duty: Train ${code}`;
                  lastAssignedLink = null;
                }
              }
            } else if (earn && earn.duty) {
              isOverridden = true;
              if (earn.duty === 'REST') {
                status = 'REST';
                isRest = true;
                overrideReason = earn.remarks || 'Weekly Rest';
                lastAssignedLink = null;
              } else {
                status = 'DUTY';
                customTrainNo = earn.duty;
                customFrom = earn.from_station || 'GNT';
                customTo = earn.to_station || '---';
                customCoaches = earn.coaches || '-';
                overrideReason = earn.remarks || `Daily Duty Allotment: ${earn.duty}`;
                lastAssignedLink = null;
              }
            } else if (dreg && (dreg.train_out || dreg.duty_label)) {
              isOverridden = true;
              status = 'DUTY';
              customTrainNo = (dreg.train_out ? (dreg.train_out + (dreg.train_return ? ` / ${dreg.train_return}` : '')) : dreg.duty_label);
              customFrom = 'GNT';
              customTo = '---';
              customCoaches = '-';
              overrideReason = dreg.duty_label || dreg.notes || 'Duty Register Entry';
              lastAssignedLink = null;
            } else {
              // Check scheduled rest day
              const dayNameUpper = d.dayOfWeek.toUpperCase();
              if ((staff.rest_day && staff.rest_day.toUpperCase() === dayNameUpper) ||
                  (staff.name && staff.name.toUpperCase().includes(dayNameUpper + ' REST'))) {
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
            }
          }

          let dutyDetails = null;
          if (linkNum !== null) {
            if (linkNum <= 100) {
              dutyDetails = allLinks.find(l => l.category_id === targetCatId && l.link_number === linkNum)
                         || allLinks.find(l => l.link_number === linkNum && l.category_id !== 4);
              if (!dutyDetails) {
                dutyDetails = await getActiveLinkDef(targetCatId, linkNum, d.dateString);
              }
            } else {
              // linkNum is a train number (e.g. 7227, 12756, 22882)
              const ndt = nonDailyTrains.find(n => String(n.train_number).includes(String(linkNum)) || String(linkNum).includes(String(n.train_number)));
              customTrainNo = ndt ? ndt.train_number : String(linkNum);
              customFrom = ndt ? (ndt.from_station || 'GNT') : 'GNT';
              customTo = ndt ? (ndt.to_station || '---') : '---';
              customCoaches = ndt ? (ndt.coaches || '-') : '-';
              customSetType = 'Non-Daily Train';
              linkNum = null;
            }
          }

          let lrRestInfo = null;
          if (status === 'AVAILABLE_FOR_BOOKING') {
            lrRestInfo = await getStaffLastDutyAndRestStatus(staff.id, d.dateString);
          }

          rowCells.push({
            date: d.dateString,
            dayOffset: d.dayOffset,
            calculatedLinkNumber: null,
            actualLinkNumber: linkNum,
            target_category_id: targetCatId,
            isRest: status === 'REST' || status === 'AVAILABLE_FOR_BOOKING',
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
            train_numbers: status === 'AVAILABLE_FOR_BOOKING' ? 'SPARE (HQ)' : (dutyDetails ? dutyDetails.train_numbers : (customTrainNo || (status === 'SICK' ? 'SICK' : status === 'LEAVE' ? (leaveType || 'LEAVE') : status === 'CR' ? 'CR' : status === 'ABSENT' ? 'ABSENT' : 'REST'))),
            from_station: status === 'AVAILABLE_FOR_BOOKING' ? 'GNT' : (dutyDetails ? dutyDetails.from_station : (customFrom || '')),
            to_station: status === 'AVAILABLE_FOR_BOOKING' ? 'GNT' : (dutyDetails ? dutyDetails.to_station : (customTo || '')),
            coaches: status === 'AVAILABLE_FOR_BOOKING' ? '-' : (dutyDetails ? dutyDetails.coaches : (customCoaches || '')),
            set_type: status === 'AVAILABLE_FOR_BOOKING' ? 'Spare / HQ' : (dutyDetails ? dutyDetails.set_type : (customSetType || (status === 'REST' ? 'Weekly Rest' : 'Train Duty')))
          });

        } else {
          // ==========================================
          // REGULAR CATEGORIES (Category 1, 2, 3)
          // ==========================================
          // 1. Direct connection to Muster Chart attendance
          if (muster && ['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'SICK', 'CR', 'R', 'O', 'NH', 'OD'].includes(musterCode)) {
            isOverridden = true;
            linkNum = null;
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
              overrideReason = directOv.reason || 'Available for Booking Duty at HQ';
            } else if (['LEAVE', 'SICK', 'CR', 'REST', 'ABSENT'].includes(directOv.status)) {
              status = directOv.status;
              linkNum = null;
            } else if (directOv.status === 'EXTRA_CREW' || directOv.extra_train_no || directOv.advance_train_no) {
              status = 'DUTY';
              linkNum = null;
              customTrainNo = directOv.extra_train_no || directOv.advance_train_no || 'EXTRA';
              customFrom = 'GNT';
              customTo = '---';
              customCoaches = '-';
              customSetType = 'Extra Crew';
              overrideReason = directOv.reason || `Assigned to Extra Train ${customTrainNo}`;
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
              targetCatId = subOv.target_category_id || (assignedLink > 21 ? 2 : parseInt(category_id, 10));
              status = 'DUTY';
              overrideReason = subOv.reason || `Substitute for ${subOv.regular_staff_name || 'Staff'} on Link #${linkNum}`;
            }
          } else {
            linkNum = getBaseLinkNumber(staff.row_position, d.dayOffset, category.cycle_length);
            const multiDayLeaveReturn = await checkMultiDayLeaveReturn(staff.id, category_id, staff.row_position, category.cycle_length, category.anchor_date, d.dateString);
            if (multiDayLeaveReturn) {
              isOverridden = true;
              status = 'AVAILABLE_FOR_BOOKING';
              overrideReason = multiDayLeaveReturn.reason;
              substituteStaffId = multiDayLeaveReturn.substituteStaffId;
              substituteName = multiDayLeaveReturn.substituteName;
              linkNum = null;
            }
          }

          let dutyDetails = null;
          if (linkNum !== null) {
            dutyDetails = await getActiveLinkDef(targetCatId || category_id, linkNum, d.dateString);
          }

          let lrRestInfo = null;
          if (status === 'AVAILABLE_FOR_BOOKING') {
            lrRestInfo = await getStaffLastDutyAndRestStatus(staff.id, d.dateString);
          }

          rowCells.push({
            date: d.dateString,
            dayOffset: d.dayOffset,
            calculatedLinkNumber: getBaseLinkNumber(staff.row_position, d.dayOffset, category.cycle_length),
            actualLinkNumber: linkNum,
            target_category_id: targetCatId || parseInt(category_id, 10),
            isRest: linkNum === null || (dutyDetails && dutyDetails.is_rest === 1) || status === 'AVAILABLE_FOR_BOOKING',
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
            train_numbers: status === 'AVAILABLE_FOR_BOOKING' ? 'SPARE (HQ)' : (dutyDetails ? dutyDetails.train_numbers : (customTrainNo || (status === 'SICK' ? 'SICK' : status === 'LEAVE' ? (leaveType || 'LEAVE') : status === 'CR' ? 'CR' : status === 'ABSENT' ? 'ABSENT' : 'REST'))),
            from_station: status === 'AVAILABLE_FOR_BOOKING' ? 'GNT' : (dutyDetails ? dutyDetails.from_station : (customFrom || '')),
            to_station: status === 'AVAILABLE_FOR_BOOKING' ? 'GNT' : (dutyDetails ? dutyDetails.to_station : (customTo || '')),
            coaches: status === 'AVAILABLE_FOR_BOOKING' ? '-' : (dutyDetails ? dutyDetails.coaches : (customCoaches || '')),
            set_type: status === 'AVAILABLE_FOR_BOOKING' ? 'Spare / HQ' : (dutyDetails ? dutyDetails.set_type : (customSetType || (status === 'REST' ? 'Weekly Rest' : 'Train Duty')))
          });
        }
      }

      gridRows.push({
        staffId: staff.id,
        staffName: staff.name,
        designation: staff.designation,
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

    res.json({
      category,
      dates,
      rows: gridRows,
      startDate,
      endDate
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// REST DAY CHANGE & AUTOMATIC LINK ADJUSTMENT API
// ----------------------------------------------------

// Preview link changes before applying
app.get('/api/roster/preview-rest-change', async (req, res) => {
  const { staff_id, new_rest_date, mode = 'SHIFT' } = req.query;
  if (!staff_id || !new_rest_date) {
    return res.status(400).json({ error: 'staff_id and new_rest_date are required' });
  }

  try {
    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });
    const category = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
    const restLinks = await all('SELECT link_number FROM links WHERE category_id = ? AND is_rest = 1', [category.id]);
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

    res.json({
      success: true,
      staffName: staff.name,
      staffId: staff.id,
      scheduledRestDate,
      newRestDate: new_rest_date,
      mode,
      adjustments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Apply rest day change with automatic link adjustments
app.post('/api/roster/change-rest-day', requireAdmin, async (req, res) => {
  const { staff_id, new_rest_date, mode = 'SHIFT', reason } = req.body;
  if (!staff_id || !new_rest_date) {
    return res.status(400).json({ error: 'staff_id and new_rest_date are required' });
  }

  try {
    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });
    const category = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
    const restLinks = await all('SELECT link_number FROM links WHERE category_id = ? AND is_rest = 1', [category.id]);
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
      return res.json({ success: true, message: 'This date is already the scheduled rest day.', adjustments: [] });
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

    res.json({
      success: true,
      message: `Rest day changed to ${new_rest_date} with ${mode} link adjustments applied successfully!`,
      scheduledRestDate,
      newRestDate: new_rest_date,
      mode,
      adjustments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset rest adjustments for a specific date range
app.post('/api/roster/reset-rest-adjustment', requireAdmin, async (req, res) => {
  const { staff_id, start_date, end_date } = req.body;
  if (!staff_id || !start_date || !end_date) {
    return res.status(400).json({ error: 'staff_id, start_date, and end_date are required' });
  }

  try {
    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });

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

    res.json({ success: true, message: `Rest adjustments reset for ${staff.name}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change regular weekly rest day for staff member (rotation position swap)
app.post('/api/staff/:id/change-weekly-rest', requireAdmin, async (req, res) => {
  const staffId = req.params.id;
  const { new_rest_weekday } = req.body;
  if (!new_rest_weekday) {
    return res.status(400).json({ error: 'new_rest_weekday is required' });
  }

  try {
    const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });
    const category = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
    const allCategoryStaff = await all('SELECT * FROM staff WHERE category_id = ? ORDER BY row_position', [category.id]);
    
    // Find staff member in this category whose current weekly rest is new_rest_weekday
    const targetStaff = allCategoryStaff.find(s => {
      const restDate = findScheduledRestDate(s.row_position, category.anchor_date, category.anchor_date, category.cycle_length);
      return getWeekday(restDate).toLowerCase() === new_rest_weekday.toLowerCase();
    });

    if (targetStaff && targetStaff.id !== staff.id) {
      const posA = staff.row_position;
      const posB = targetStaff.row_position;
      await run('UPDATE staff SET row_position = ? WHERE id = ?', [posB, staff.id]);
      await run('UPDATE staff SET row_position = ? WHERE id = ?', [posA, targetStaff.id]);
      
      await logAudit(
        'Admin',
        'CHANGE_WEEKLY_REST',
        `Swapped rotation position of ${staff.name} (pos ${posA} -> ${posB}) with ${targetStaff.name} (pos ${posB} -> ${posA}) for ${new_rest_weekday} weekly rest.`
      );

      return res.json({
        success: true,
        message: `Weekly rest changed to ${new_rest_weekday} by exchanging roster position with ${targetStaff.name}.`,
        new_row_position: posB
      });
    } else {
      return res.json({
        success: true,
        message: targetStaff ? `${staff.name} already has weekly rest on ${new_rest_weekday}.` : `Weekly rest ${new_rest_weekday} assigned.`
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// REPORTING LOOKUPS API
// ----------------------------------------------------

// "Who is working link X on date Y?"
app.get('/api/reports/who-is-working', async (req, res) => {
  const { category_id, link_number, date } = req.query;
  if (!category_id || !link_number || !date) {
    return res.status(400).json({ error: 'category_id, link_number and date are required' });
  }

  try {
    const category = await get('SELECT * FROM categories WHERE id = ?', [category_id]);
    if (!category) return res.status(404).json({ error: 'Category not found' });

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

    res.json({ date, link_number: linkTarget, matches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// "What is person Z working on date Y?"
app.get('/api/reports/what-is-person-working', async (req, res) => {
  const { staff_id, date } = req.query;
  if (!staff_id || !date) {
    return res.status(400).json({ error: 'staff_id and date are required' });
  }

  try {
    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });

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

    res.json({
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Daily view: for a chosen date, list every staff member and their assigned link/duty
app.get('/api/reports/daily-view', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Date is required' });

  try {
    const categories = await all('SELECT * FROM categories');
    const crBalances = await calculateStaffCrBalances();
    const result = [];

    for (const cat of categories) {
      const staffMembers = await all(
        'SELECT * FROM staff WHERE category_id = ? ORDER BY row_position',
        [cat.id]
      );
      const dayOffset = getDayOffset(cat.anchor_date, date);

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
        
        if (override) {
          activeLink = override.overridden_link_number;
          isOverridden = true;
          status = override.status || (override.overridden_link_number === null ? 'REST' : 'CHANGED_LINK');
          substituteStaffId = override.substitute_staff_id;
          substituteName = override.substitute_name;
          overrideReason = override.reason;
          let resolvedTargetCat = override.target_category_id || (override.status === 'SUBSTITUTE' ? 1 : null);
          if (!resolvedTargetCat && activeLink !== null) {
            const ownLink = await get('SELECT 1 FROM links WHERE category_id = ? AND link_number = ?', [cat.id, activeLink]);
            if (ownLink) {
              resolvedTargetCat = cat.id;
            } else {
              const anyLink = await get('SELECT category_id FROM links WHERE link_number = ? ORDER BY category_id ASC LIMIT 1', [activeLink]);
              resolvedTargetCat = anyLink ? anyLink.category_id : cat.id;
            }
          }
          targetCategoryId = resolvedTargetCat || cat.id;
          leaveType = override.leave_type;
        } else {
          activeLink = getBaseLinkNumber(staff.row_position, dayOffset, cat.cycle_length);
          const multiDayLeaveReturn = await checkMultiDayLeaveReturn(staff.id, cat.id, staff.row_position, cat.cycle_length, cat.anchor_date, date);
          if (multiDayLeaveReturn) {
            isOverridden = true;
            status = 'AVAILABLE_FOR_BOOKING';
            overrideReason = multiDayLeaveReturn.reason;
            substituteStaffId = multiDayLeaveReturn.substituteStaffId;
            substituteName = multiDayLeaveReturn.substituteName;
            activeLink = null;
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
          } else if (musterCode === 'E') {
            status = 'DUTY';
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
          original_link_number: (override && override.original_link_number !== null && override.original_link_number !== undefined) ? override.original_link_number : getBaseLinkNumber(staff.row_position, dayOffset, cat.cycle_length),
          isRest: isCat4RestDay || activeLink === null || (dutyDetails && dutyDetails.is_rest === 1) || status === 'AVAILABLE_FOR_BOOKING' || status === 'UTILISED_ADVANCE',
          isOverridden,
          status,
          muster_code: musterCode,
          muster_remarks: musterRemarks,
          substituteStaffId,
          substituteName,
          overrideReason,
          extra_train_no: override?.extra_train_no || null,
          is_extra: override?.is_extra || 0,
          shifted_place: override?.shifted_place || null,
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
          train_numbers: status === 'UTILISED_ADVANCE' ? `ADVANCE (${override?.advance_train_no || (overrideReason ? (overrideReason.match(/(?:train\s*(?:no\.?|#)?\s*|tr\.?\s*)(\d{4,5})/i)?.[1] || overrideReason.match(/(\d{4,5})/)?.[1]) : 'TR')})` : (status === 'AVAILABLE_FOR_BOOKING' ? 'SPARE (HQ)' : (dutyDetails ? dutyDetails.train_numbers : (status === 'SICK' ? 'SICK' : status === 'LEAVE' ? `LEAVE (${musterCode || 'LV'})` : status === 'CR' ? 'CR' : status === 'ABSENT' ? 'ABSENT' : 'REST'))),
          from_station: (status === 'AVAILABLE_FOR_BOOKING' || status === 'UTILISED_ADVANCE') ? 'GNT' : (dutyDetails ? dutyDetails.from_station : ''),
          to_station: (status === 'AVAILABLE_FOR_BOOKING' || status === 'UTILISED_ADVANCE') ? 'GNT' : (dutyDetails ? dutyDetails.to_station : ''),
          coaches: (status === 'AVAILABLE_FOR_BOOKING' || status === 'UTILISED_ADVANCE') ? '-' : (dutyDetails ? dutyDetails.coaches : ''),
          set_type: status === 'UTILISED_ADVANCE' ? 'Advance Utilisation' : (status === 'AVAILABLE_FOR_BOOKING' ? 'Spare / HQ' : (dutyDetails ? dutyDetails.set_type : 'Other / REST'))
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
        } else if (s.isRest || s.link_number === null || s.status === 'REST' || s.status === 'CR' || s.status === 'AVAILABLE_FOR_BOOKING') {
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

    res.json({ date, dayOfWeek: currentDayName, categories: result, nonDailyTrains, tally_summary: tallySummary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// STAFF AVAILABILITY SHEET API
// Categorized for: COR, TTE, LADIES, LR with Glowing Dot status
// ----------------------------------------------------
app.get('/api/reports/availability-sheet', async (req, res) => {
  const formatLocalDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const targetDate = req.query.date || formatLocalDate(new Date());

  try {
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
      const dayOffset = getDayOffset(cat.anchor_date, targetDate);

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
          activeLink = getBaseLinkNumber(staff.row_position, dayOffset, cat.cycle_length);
          const multiDayLeaveReturn = await checkMultiDayLeaveReturn(staff.id, cat.id, staff.row_position, cat.cycle_length, cat.anchor_date, targetDate);
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
            dutyDetails = await get('SELECT * FROM links WHERE link_number = ?', [activeLink]);
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
          } else if (musterCode === 'E') {
            status = 'DUTY';
          }
        }

        // LR rest calculation
        let lrRestInfo = null;
        if (cat.id === 4 || activeLink === null || status === 'AVAILABLE_FOR_BOOKING') {
          lrRestInfo = await getStaffLastDutyAndRestStatus(staff.id, targetDate);
        }

        const crInfo = crBalances[staff.id] || { count: 0, dates: [], display: null, shortDisplay: '-' };

        // Train and route resolution
        const trainNumbers = status === 'AVAILABLE_FOR_BOOKING' ? 'SPARE (HQ)' : (dutyDetails ? dutyDetails.train_numbers : (status === 'SICK' ? 'SICK' : status === 'LEAVE' ? 'LEAVE' : status === 'CR' ? 'CR' : status === 'ABSENT' ? 'ABSENT' : 'REST'));
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
        } else if ([60, 61, 62].includes(activeLink) || (dutyDetails && dutyDetails.train_numbers && String(dutyDetails.train_numbers).toUpperCase().includes('NON DAILY'))) {
          // Category 2 Non-Daily Links (60, 61, 62)
          if (override && (override.extra_train_no || override.advance_train_no)) {
            isAvailable = false;
            dotStatus = 'RED';
            statusCategory = 'NOT_AVAILABLE_BOOKED';
            statusLabel = `Not Available (Working Extra Tr. ${override.extra_train_no || override.advance_train_no})`;
            statusReason = `Assigned to Non-Daily Train ${override.extra_train_no || override.advance_train_no}`;
            currentLocation = `🚆 Working Train (${override.extra_train_no || override.advance_train_no})`;
            catBreakdown.booked_to_duty++;
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
          original_link_number: getBaseLinkNumber(staff.row_position, dayOffset, cat.cycle_length),
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

    res.json({
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
  } catch (err) {
    console.error('Error in /api/reports/availability-sheet:', err);
    res.status(500).json({ error: err.message });
  }
});

// Fetch register entries for a selected date
app.get('/api/duty-register', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Date is required' });

  try {
    const entries = await all('SELECT * FROM duty_register_entry WHERE date = ?', [date]);
    for (const entry of entries) {
      const staff = await all(
        'SELECT s.* FROM staff s JOIN duty_register_staff drs ON s.id = drs.staff_id WHERE drs.entry_id = ?',
        [entry.id]
      );
      entry.staff = staff;
    }
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create/Update register entries for a selected date (Transaction based)
app.post('/api/duty-register', requireAdmin, async (req, res) => {
  const { date, page_number, entries } = req.body;
  if (!date) return res.status(400).json({ error: 'Date is required' });
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'Entries must be an array' });

  try {
    await run('BEGIN TRANSACTION');
    // Fetch and delete existing entries for this date
    const existing = await all('SELECT id FROM duty_register_entry WHERE date = ?', [date]);
    for (const e of existing) {
      await run('DELETE FROM duty_register_staff WHERE entry_id = ?', [e.id]);
    }
    await run('DELETE FROM duty_register_entry WHERE date = ?', [date]);

    for (const item of entries) {
      const result = await run(
        `INSERT INTO duty_register_entry 
         (date, page_number, train_out, coach_out, train_return, coach_return, duty_label, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          date,
          page_number ? parseInt(page_number, 10) : null,
          item.train_out || '',
          item.coach_out || '',
          item.train_return || '',
          item.coach_return || '',
          item.duty_label || '',
          item.notes || ''
        ]
      );
      const entryId = result.lastID;
      if (Array.isArray(item.staff_ids)) {
        for (const staffId of item.staff_ids) {
          await run(
            'INSERT INTO duty_register_staff (entry_id, staff_id) VALUES (?, ?)',
            [entryId, staffId]
          );
          // Sync with LR sheet if staff is Category 4
          const staffObj = await get('SELECT category_id FROM staff WHERE id = ?', [staffId]);
          if (staffObj && staffObj.category_id === 4) {
            let regCode = '';
            if (item.train_out) {
              regCode = item.train_out + (item.train_return ? ` / ${item.train_return}` : '');
            } else if (item.duty_label) {
              regCode = item.duty_label;
            }
            if (regCode) {
              await syncLRSheetRecord(staffId, date, regCode, item.notes || item.duty_label || '');
            }
          }
        }
      }
    }
    await run('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await run('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// Delete a register entry
app.delete('/api/duty-register/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await run('DELETE FROM duty_register_staff WHERE entry_id = ?', [id]);
    await run('DELETE FROM duty_register_entry WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pre-populate actual duty register from planned roster
app.post('/api/duty-register/populate-from-roster', requireAdmin, async (req, res) => {
  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'Date is required' });

  try {
    const existingEntries = await all('SELECT id FROM duty_register_entry WHERE date = ?', [date]);
    if (existingEntries.length > 0) {
      const ids = existingEntries.map(e => e.id).join(',');
      await run(`DELETE FROM duty_register_staff WHERE entry_id IN (${ids})`);
      await run(`DELETE FROM duty_register_entry WHERE id IN (${ids})`);
    }

    const categories = await all('SELECT * FROM categories');
    
    for (const cat of categories) {
      const staffMembers = await all(
        'SELECT * FROM staff WHERE category_id = ? ORDER BY row_position',
        [cat.id]
      );
      const dayOffset = getDayOffset(cat.anchor_date, date);

      for (const staff of staffMembers) {
        const override = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, date]);
        let activeLink = null;

        if (override) {
          activeLink = override.overridden_link_number;
        } else {
          activeLink = getBaseLinkNumber(staff.row_position, dayOffset, cat.cycle_length);
        }

        let dutyDetails = null;
        if (activeLink !== null) {
          dutyDetails = await getActiveLinkDef(cat.id, activeLink, date);
        }

        const isRest = activeLink === null || (dutyDetails && dutyDetails.is_rest === 1);
        
        let train_out = '';
        let coach_out = '';
        let train_return = '';
        let coach_return = '';
        let duty_label = isRest ? 'REST' : '';

        if (!isRest && dutyDetails) {
          const trains = parseTrainNumbers(dutyDetails.train_numbers);
          train_out = trains[0] || '';
          train_return = trains[1] || trains[0] || '';
          coach_out = dutyDetails.coaches || '';
          coach_return = dutyDetails.coaches || '';
          duty_label = `Link #${activeLink}`;
        }

        const result = await run(
          `INSERT INTO duty_register_entry 
           (date, page_number, train_out, coach_out, train_return, coach_return, duty_label, notes)
           VALUES (?, 1, ?, ?, ?, ?, ?, ?)`,
          [date, train_out, coach_out, train_return, coach_return, duty_label, 'Auto-populated from roster']
        );
        
        const entryId = result.lastID;
        await run(
          `INSERT INTO duty_register_staff (entry_id, staff_id) VALUES (?, ?)`,
          [entryId, staff.id]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function parseTrainNumbers(trainStr) {
  if (!trainStr || trainStr === 'REST') return [];
  return trainStr
    .split(',')
    .map(t => t.trim().replace(/^PILOT\((.*?)\)$/, '$1'))
    .filter(Boolean);
}

function isCoachCompatible(plannedCoach, actualCoach) {
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

// Reconciliation comparison endpoint
app.get('/api/duty-register/reconciliation', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Date is required' });

  try {
    const categories = await all('SELECT * FROM categories');
    const result = [];

    for (const cat of categories) {
      const staffMembers = await all(
        'SELECT * FROM staff WHERE category_id = ? ORDER BY row_position',
        [cat.id]
      );
      const dayOffset = getDayOffset(cat.anchor_date, date);

      // Fetch all entries joined with staff for this category on this date
      const entries = await all(
        `SELECT e.*, s.id as staff_id 
         FROM duty_register_entry e
         JOIN duty_register_staff drs ON e.id = drs.entry_id
         JOIN staff s ON drs.staff_id = s.id
         WHERE e.date = ? AND s.category_id = ?`,
        [date, cat.id]
      );

      // Map entry crew members
      const entryCrewMap = {};
      for (const e of entries) {
        if (!entryCrewMap[e.id]) {
          const crew = await all(
            `SELECT s.name FROM staff s
             JOIN duty_register_staff drs ON s.id = drs.staff_id
             WHERE drs.entry_id = ?`,
            [e.id]
          );
          entryCrewMap[e.id] = crew.map(c => c.name);
        }
      }

      const list = [];
      for (const staff of staffMembers) {
        const override = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, date]);
        let activeLink = null;
        let isOverridden = false;

        if (override) {
          activeLink = override.overridden_link_number;
          isOverridden = true;
        } else {
          activeLink = getBaseLinkNumber(staff.row_position, dayOffset, cat.cycle_length);
        }

        let dutyDetails = null;
        if (activeLink !== null) {
          dutyDetails = await getActiveLinkDef(cat.id, activeLink, date);
        }

        const planned = {
          link_number: activeLink,
          isRest: activeLink === null || (dutyDetails && dutyDetails.is_rest === 1),
          isOverridden,
          train_numbers: dutyDetails ? dutyDetails.train_numbers : 'REST',
          from_station: dutyDetails ? dutyDetails.from_station : '',
          to_station: dutyDetails ? dutyDetails.to_station : '',
          coaches: dutyDetails ? dutyDetails.coaches : '',
          set_type: dutyDetails ? dutyDetails.set_type : 'Other / REST'
        };

        const actualEntry = entries.find(e => e.staff_id === staff.id);
        const actual = actualEntry ? {
          entryId: actualEntry.id,
          train_out: actualEntry.train_out,
          coach_out: actualEntry.coach_out,
          train_return: actualEntry.train_return,
          coach_return: actualEntry.coach_return,
          duty_label: actualEntry.duty_label,
          notes: actualEntry.notes,
          crew: entryCrewMap[actualEntry.id] || []
        } : null;

        let isMismatch = false;
        let mismatchReason = '';

        if (planned.isRest) {
          if (actual) {
            isMismatch = true;
            mismatchReason = `Rostered for REST but worked: ${actual.duty_label || actual.train_out}`;
          }
        } else {
          if (!actual) {
            isMismatch = true;
            mismatchReason = `Rostered for duty (${planned.train_numbers}) but absent in register`;
          } else {
            const pTrains = parseTrainNumbers(planned.train_numbers);
            const actTrains = [];
            if (actual.train_out) actTrains.push(actual.train_out);
            if (actual.train_return) actTrains.push(actual.train_return);

            // Match train numbers
            const trainMismatch = pTrains.length > 0 && actTrains.length > 0 &&
              !pTrains.some(pt => actTrains.some(at => at.includes(pt) || pt.includes(at)));
            
            // Match coaches
            const coachMismatch = planned.coaches && actual.coach_out && !isCoachCompatible(planned.coaches, actual.coach_out);

            if (trainMismatch) {
              isMismatch = true;
              mismatchReason = `Train mismatch: Planned ${planned.train_numbers} vs Actual ${actTrains.join('/')}`;
            } else if (coachMismatch) {
              isMismatch = true;
              mismatchReason = `Coach mismatch: Planned ${planned.coaches} vs Actual ${actual.coach_out}`;
            }
          }
        }

        list.push({
          staffId: staff.id,
          name: staff.name,
          designation: staff.designation,
          planned,
          actual,
          isMismatch,
          mismatchReason
        });
      }

      result.push({
        categoryId: cat.id,
        categoryName: cat.name,
        categoryCode: cat.code,
        reconciliation: list
      });
    }

    res.json({ date, categories: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch register history logs
app.get('/api/duty-register/history', async (req, res) => {
  const { q, startDate, endDate } = req.query;

  try {
    let sql = `
      SELECT DISTINCT e.*
      FROM duty_register_entry e
      LEFT JOIN duty_register_staff drs ON e.id = drs.entry_id
      LEFT JOIN staff s ON drs.staff_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      sql += ' AND e.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND e.date <= ?';
      params.push(endDate);
    }
    if (q) {
      sql += ' AND (s.name LIKE ? OR e.train_out LIKE ? OR e.train_return LIKE ? OR e.duty_label LIKE ?)';
      const queryParam = `%${q}%`;
      params.push(queryParam, queryParam, queryParam, queryParam);
    }
    sql += ' ORDER BY e.date DESC, e.id ASC';

    const entries = await all(sql, params);
    for (const entry of entries) {
      const staff = await all(
        'SELECT s.* FROM staff s JOIN duty_register_staff drs ON s.id = drs.staff_id WHERE drs.entry_id = ?',
        [entry.id]
      );
      entry.staff = staff;
    }
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// DOCUMENTS: Travelling Allowance (TA) Journal API
// -------------------------------------------------------------

const { generateStaffTaJournal, generatePendingTaClaimsForMonth, calculateAbsenceAndTa } = require('./ta_generator');

// GET /api/documents/ta/:staffId?year=2026&month=8&start_date=2026-09-01&end_date=2026-09-30
app.get('/api/documents/ta/:staffId', authenticateToken, async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId, 10);
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
    const startDate = req.query.start_date || req.query.startDate || null;
    const endDate = req.query.end_date || req.query.endDate || null;

    const journal = await generateStaffTaJournal({ get, all, run }, staffId, year, month, startDate, endDate);
    res.json(journal);
  } catch (err) {
    console.error('Error generating TA journal:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/documents/ta/:staffId - Save custom TA row edits (Validates 0 < days_claiming_ta <= 1.0)
app.post('/api/documents/ta/:staffId', authenticateToken, async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId, 10);
    const { month_year, start_date, end_date, entries, employee_meta } = req.body;

    if (!Array.isArray(entries)) {
      return res.status(400).json({ error: 'Invalid payload. entries array required.' });
    }

    // Update employee profile metadata if provided
    if (employee_meta) {
      const { name, designation, pay, pf_no, bill_unit, doa, hq } = employee_meta;
      if (name) {
        await run('UPDATE staff SET name = ? WHERE id = ?', [name, staffId]);
      }
      if (designation) {
        await run('UPDATE staff SET designation = ? WHERE id = ?', [designation, staffId]);
      }
      await run(
        `UPDATE staff SET pay_amount = ?, pf_no = ?, bill_unit = ?, doa = ?, hq_station = ? WHERE id = ?`,
        [pay || 68000, pf_no || '07323475', bill_unit || '0910629', doa || '05/08/2000', hq || 'GNT', staffId]
      );
    }

    // Delete existing saved entries for this staff in range or month
    if (start_date && end_date) {
      await run('DELETE FROM ta_entries WHERE staff_id = ? AND duty_date >= ? AND duty_date <= ?', [staffId, start_date, end_date]);
    } else if (month_year) {
      await run('DELETE FROM ta_entries WHERE staff_id = ? AND month_year = ?', [staffId, month_year]);
    }

    // Save all current rows & propagate timings
    for (let i = 0; i < entries.length; i++) {
      const item = entries[i];
      let daysClaiming = item.days_claiming_ta !== null && item.days_claiming_ta !== undefined && item.days_claiming_ta !== ''
        ? parseFloat(item.days_claiming_ta)
        : null;
      if (daysClaiming !== null && !isNaN(daysClaiming)) {
        daysClaiming = Math.min(1.0, Math.max(0.01, daysClaiming));
      } else {
        daysClaiming = null;
      }

      const dutyDate = item.date_iso || item.duty_date || null;
      const rowMonthYear = item.month_year || month_year || (dutyDate ? dutyDate.slice(0, 7) : '2026-09');

      await run(
        `INSERT INTO ta_entries (staff_id, month_year, duty_date, date_str, train_no, from_station, to_station, dep_time, arr_time, ta_a1, ta_a, ta_b1, days_claiming_ta, object_of_journey, remarks, row_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          staffId,
          rowMonthYear,
          dutyDate,
          item.date_str || '',
          item.train_no || '',
          item.from_station || '',
          item.to_station || '',
          item.dep_time || '',
          item.arr_time || '',
          item.ta_a1 || '',
          item.ta_a || '',
          item.ta_b1 || '',
          daysClaiming,
          item.object_of_journey || 'MANNING AC COACHES',
          item.remarks || '',
          i + 1
        ]
      );

      // Save to actual_train_runs cache so all document generators pick it up
      if (item.train_no && item.date_iso) {
        if (item.from_station && item.dep_time && item.dep_time !== '---') {
          await run(
            `INSERT OR REPLACE INTO actual_train_runs (train_no, run_date, station_code, sched_arr, sched_dep, act_arr, act_dep, delay_arr_mins, delay_dep_mins, source)
             VALUES (?, ?, ?, '---', ?, '---', ?, 0, 0, 'TA_SYNC')`,
            [item.train_no, item.date_iso, item.from_station, item.sched_dep || item.dep_time, item.dep_time]
          );
        }
        if (item.to_station && item.arr_time && item.arr_time !== '---') {
          await run(
            `INSERT OR REPLACE INTO actual_train_runs (train_no, run_date, station_code, sched_arr, sched_dep, act_arr, act_dep, delay_arr_mins, delay_dep_mins, source)
             VALUES (?, ?, ?, ?, '---', ?, '---', 0, 0, 'TA_SYNC')`,
            [item.train_no, item.date_iso, item.to_station, item.sched_arr || item.arr_time, item.arr_time]
          );
        }
      }
    }

    res.json({ success: true, message: 'Travelling Allowance journal saved and synced to NDA & Diary successfully.' });
  } catch (err) {
    console.error('Error saving TA journal entries:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/documents/ta/:staffId?year=2026&month=8 - Reset custom entries to auto-generated master rotation
app.delete('/api/documents/ta/:staffId', authenticateToken, async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId, 10);
    const startDate = req.query.start_date || req.query.startDate;
    const endDate = req.query.end_date || req.query.endDate;
    if (startDate && endDate) {
      await run('DELETE FROM ta_entries WHERE staff_id = ? AND duty_date >= ? AND duty_date <= ?', [staffId, startDate, endDate]);
    } else {
      const year = parseInt(req.query.year, 10) || new Date().getFullYear();
      const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
      const monthYearStr = `${year}-${String(month).padStart(2, '0')}`;
      await run('DELETE FROM ta_entries WHERE staff_id = ? AND month_year = ?', [staffId, monthYearStr]);
    }
    res.json({ success: true, message: 'TA Journal reset to master roster rotation.' });
  } catch (err) {
    console.error('Error resetting TA journal:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// TA APPROVALS API ENDPOINTS
// ==========================================

// Helper: sync an approved claim into ta_entries so it appears in the employee's TA document
async function syncClaimToTaEntries(claimId) {
  const claim = await get('SELECT * FROM ta_approvals WHERE id = ?', [claimId]);
  if (!claim || claim.status !== 'APPROVED') return;

  const existing = await get(
    `SELECT id FROM ta_entries 
     WHERE staff_id = ? AND duty_date = ? AND train_no = ? AND from_station = ? AND to_station = ?`,
    [claim.staff_id, claim.duty_date, claim.train_no, claim.from_station, claim.to_station]
  ) || await get(
    `SELECT id FROM ta_entries 
     WHERE staff_id = ? AND month_year = ? AND date_str = ? AND train_no = ? AND from_station = ? AND to_station = ?`,
    [claim.staff_id, claim.month_year, claim.date_str, claim.train_no, claim.from_station, claim.to_station]
  );

  if (existing) {
    await run(
      `UPDATE ta_entries SET
        dep_time = ?, arr_time = ?, ta_b1 = ?, days_claiming_ta = ?, object_of_journey = ?, remarks = ?, row_order = ?, duty_date = ?
       WHERE id = ?`,
      [
        claim.dep_time, claim.arr_time, claim.ta_percentage !== null && claim.ta_percentage !== undefined ? String(claim.ta_percentage) : '',
        claim.ta_percentage, claim.object_of_journey, claim.remarks || '', claim.row_order, claim.duty_date, existing.id
      ]
    );
  } else {
    await run(
      `INSERT INTO ta_entries (
        staff_id, month_year, duty_date, date_str, train_no, from_station, to_station,
        dep_time, arr_time, ta_a1, ta_a, ta_b1, days_claiming_ta, object_of_journey, remarks, row_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, ?, ?)`,
      [
        claim.staff_id, claim.month_year, claim.duty_date, claim.date_str, claim.train_no, claim.from_station, claim.to_station,
        claim.dep_time, claim.arr_time, claim.ta_percentage !== null && claim.ta_percentage !== undefined ? String(claim.ta_percentage) : '',
        claim.ta_percentage, claim.object_of_journey, claim.remarks || '', claim.row_order
      ]
    );
  }
}

// Helper: remove claim from ta_entries if rejected or reverted
async function removeClaimFromTaEntries(claimId) {
  const claim = await get('SELECT * FROM ta_approvals WHERE id = ?', [claimId]);
  if (!claim) return;
  await run(
    `DELETE FROM ta_entries 
     WHERE staff_id = ? AND duty_date = ? AND train_no = ? AND from_station = ? AND to_station = ?`,
    [claim.staff_id, claim.duty_date, claim.train_no, claim.from_station, claim.to_station]
  );
  await run(
    `DELETE FROM ta_entries 
     WHERE staff_id = ? AND month_year = ? AND date_str = ? AND train_no = ? AND from_station = ? AND to_station = ?`,
    [claim.staff_id, claim.month_year, claim.date_str, claim.train_no, claim.from_station, claim.to_station]
  );
}

// GET /api/ta-approvals - List TA claims with filters and statistics
app.get('/api/ta-approvals', authenticateToken, async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
    const startDate = req.query.start_date || req.query.startDate || null;
    const endDate = req.query.end_date || req.query.endDate || null;
    const categoryId = req.query.category_id && req.query.category_id !== 'ALL' ? parseInt(req.query.category_id, 10) : null;
    const status = req.query.status && req.query.status !== 'ALL' ? req.query.status.toUpperCase() : null;
    const search = req.query.search ? req.query.search.trim().toLowerCase() : '';

    const monthYearStr = `${year}-${String(month).padStart(2, '0')}`;

    // Auto-generate pending claims if none exist for this month or range
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      let curr = new Date(start.getFullYear(), start.getMonth(), 1);
      const last = new Date(end.getFullYear(), end.getMonth(), 1);
      while (curr <= last) {
        const mStr = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}`;
        const existing = await get('SELECT id FROM ta_approvals WHERE month_year = ? LIMIT 1', [mStr]);
        if (!existing) {
          await generatePendingTaClaimsForMonth({ get, all, run }, curr.getFullYear(), curr.getMonth() + 1);
        }
        curr.setMonth(curr.getMonth() + 1);
      }
    } else {
      const existing = await get('SELECT id FROM ta_approvals WHERE month_year = ? LIMIT 1', [monthYearStr]);
      if (!existing) {
        await generatePendingTaClaimsForMonth({ get, all, run }, year, month);
      }
    }

    // Fetch summary statistics
    let statsSql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN a.status = 'PENDING' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN a.status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN a.status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN a.status = 'PENDING' THEN a.claim_amount ELSE 0 END) as total_pending_amount,
        SUM(CASE WHEN a.status = 'APPROVED' THEN a.claim_amount ELSE 0 END) as total_approved_amount
      FROM ta_approvals a
      JOIN staff s ON a.staff_id = s.id
      WHERE ${(startDate && endDate) ? 'a.duty_date >= ? AND a.duty_date <= ?' : 'a.month_year = ?'}
    `;
    const statsParams = (startDate && endDate) ? [startDate, endDate] : [monthYearStr];
    if (categoryId) {
      statsSql += ' AND s.category_id = ?';
      statsParams.push(categoryId);
    }
    const stats = await get(statsSql, statsParams);

    // Fetch filtered claims list
    let listSql = `
      SELECT 
        a.*,
        s.name as staff_name,
        s.designation as staff_designation,
        s.pf_no as staff_pf_no,
        s.category_id,
        c.name as category_name
      FROM ta_approvals a
      JOIN staff s ON a.staff_id = s.id
      JOIN categories c ON s.category_id = c.id
      WHERE ${(startDate && endDate) ? 'a.duty_date >= ? AND a.duty_date <= ?' : 'a.month_year = ?'}
    `;
    const listParams = (startDate && endDate) ? [startDate, endDate] : [monthYearStr];

    if (categoryId) {
      listSql += ' AND s.category_id = ?';
      listParams.push(categoryId);
    }
    if (status) {
      listSql += ' AND a.status = ?';
      listParams.push(status);
    }
    if (search) {
      listSql += ' AND (LOWER(s.name) LIKE ? OR LOWER(s.designation) LIKE ? OR a.train_no LIKE ? OR LOWER(a.from_station) LIKE ? OR LOWER(a.to_station) LIKE ?)';
      const sPattern = `%${search}%`;
      listParams.push(sPattern, sPattern, sPattern, sPattern, sPattern);
    }

    listSql += ' ORDER BY a.duty_date ASC, s.row_position ASC, a.row_order ASC';

    const claims = await all(listSql, listParams);

    res.json({
      success: true,
      year,
      month,
      month_year: monthYearStr,
      stats: {
        total: stats?.total || 0,
        pending: stats?.pending || 0,
        approved: stats?.approved || 0,
        rejected: stats?.rejected || 0,
        total_pending_amount: stats?.total_pending_amount || 0,
        total_approved_amount: stats?.total_approved_amount || 0
      },
      claims
    });
  } catch (err) {
    console.error('Error fetching TA approvals:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ta-approvals/sync - Force re-generation of pending claims
app.post('/api/ta-approvals/sync', requireAdmin, async (req, res) => {
  try {
    const { year, month } = req.body;
    const y = parseInt(year, 10) || new Date().getFullYear();
    const m = parseInt(month, 10) || (new Date().getMonth() + 1);

    await generatePendingTaClaimsForMonth({ get, all, run }, y, m);
    res.json({ success: true, message: `Synced TA claims for ${m}/${y}` });
  } catch (err) {
    console.error('Error syncing TA claims:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ta-approvals/accept - Accept a single TA claim
app.post('/api/ta-approvals/accept', requireAdmin, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Claim id required' });

    const claim = await get('SELECT a.*, s.name as staff_name FROM ta_approvals a JOIN staff s ON a.staff_id = s.id WHERE a.id = ?', [id]);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });

    const adminName = req.user?.name || req.user?.username || 'Admin';
    await run(
      `UPDATE ta_approvals SET
        status = 'APPROVED',
        approved_by = ?,
        approved_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [adminName, id]
    );

    await syncClaimToTaEntries(id);
    await logAudit(adminName, 'ACCEPT_TA', `Accepted TA for ${claim.staff_name} on ${claim.date_str} (${claim.train_no})`);

    res.json({ success: true, message: `TA claim accepted for ${claim.staff_name}` });
  } catch (err) {
    console.error('Error accepting TA claim:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ta-approvals/accept-batch - Accept multiple claims by ID
app.post('/api/ta-approvals/accept-batch', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of claim ids required' });
    }

    const adminName = req.user?.name || req.user?.username || 'Admin';
    for (const id of ids) {
      await run(
        `UPDATE ta_approvals SET
          status = 'APPROVED',
          approved_by = ?,
          approved_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [adminName, id]
      );
      await syncClaimToTaEntries(id);
    }

    await logAudit(adminName, 'ACCEPT_TA_BATCH', `Batch accepted ${ids.length} TA claims`);
    res.json({ success: true, count: ids.length, message: `Accepted ${ids.length} TA claims` });
  } catch (err) {
    console.error('Error batch accepting TA claims:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ta-approvals/accept-all - Accept all pending claims matching filters
app.post('/api/ta-approvals/accept-all', requireAdmin, async (req, res) => {
  try {
    const { year, month, category_id } = req.body;
    const y = parseInt(year, 10) || new Date().getFullYear();
    const m = parseInt(month, 10) || (new Date().getMonth() + 1);
    const monthYearStr = `${y}-${String(m).padStart(2, '0')}`;

    let sql = `
      SELECT a.id FROM ta_approvals a
      JOIN staff s ON a.staff_id = s.id
      WHERE a.month_year = ? AND a.status = 'PENDING'
    `;
    const params = [monthYearStr];
    if (category_id && category_id !== 'ALL') {
      sql += ' AND s.category_id = ?';
      params.push(parseInt(category_id, 10));
    }

    const pendingClaims = await all(sql, params);
    const adminName = req.user?.name || req.user?.username || 'Admin';

    for (const claim of pendingClaims) {
      await run(
        `UPDATE ta_approvals SET
          status = 'APPROVED',
          approved_by = ?,
          approved_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [adminName, claim.id]
      );
      await syncClaimToTaEntries(claim.id);
    }

    await logAudit(adminName, 'ACCEPT_TA_ALL', `Accepted all ${pendingClaims.length} pending TAs for ${m}/${y}`);
    res.json({ success: true, count: pendingClaims.length, message: `Accepted all ${pendingClaims.length} pending TA claims` });
  } catch (err) {
    console.error('Error accepting all TA claims:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ta-approvals/reject - Reject single or batch claims
app.post('/api/ta-approvals/reject', requireAdmin, async (req, res) => {
  try {
    const { id, ids, reason } = req.body;
    const targetIds = Array.isArray(ids) ? ids : (id ? [id] : []);
    if (targetIds.length === 0) {
      return res.status(400).json({ error: 'Claim id or ids required' });
    }

    const adminName = req.user?.name || req.user?.username || 'Admin';
    for (const claimId of targetIds) {
      await run(
        `UPDATE ta_approvals SET
          status = 'REJECTED',
          rejection_reason = ?,
          approved_by = ?,
          approved_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [reason || 'Rejected by Admin', adminName, claimId]
      );
      await removeClaimFromTaEntries(claimId);
    }

    await logAudit(adminName, 'REJECT_TA', `Rejected ${targetIds.length} TA claims: ${reason || 'No reason specified'}`);
    res.json({ success: true, count: targetIds.length, message: `Rejected ${targetIds.length} TA claims` });
  } catch (err) {
    console.error('Error rejecting TA claims:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ta-approvals/revert - Revert claim back to PENDING
app.post('/api/ta-approvals/revert', requireAdmin, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Claim id required' });

    await run(
      `UPDATE ta_approvals SET
        status = 'PENDING',
        approved_by = NULL,
        approved_at = NULL,
        rejection_reason = NULL
       WHERE id = ?`,
      [id]
    );

    await removeClaimFromTaEntries(id);
    res.json({ success: true, message: 'Claim reverted to PENDING' });
  } catch (err) {
    console.error('Error reverting TA claim:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// NDA (NIGHT DUTY ALLOWANCE) API ENDPOINTS
// ==========================================
const { generateStaffNdaJournal } = require('./nda_generator');

// GET /api/documents/nda/:staffId?year=2026&month=8
app.get('/api/documents/nda/:staffId', authenticateToken, async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId, 10);
    let year = parseInt(req.query.year, 10);
    let month = parseInt(req.query.month, 10);
    if (req.query.month && String(req.query.month).includes('-')) {
      const parts = String(req.query.month).split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    }
    if (!year) year = new Date().getFullYear();
    if (!month) month = new Date().getMonth() + 1;

    const startDate = req.query.start_date || null;
    const endDate = req.query.end_date || null;

    const journal = await generateStaffNdaJournal({ get, all, run }, staffId, year, month, startDate, endDate);
    res.json(journal);
  } catch (err) {
    console.error('Error generating NDA journal:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/documents/nda/:staffId - Save custom NDA row edits
app.post('/api/documents/nda/:staffId', authenticateToken, async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId, 10);
    const { month_year, entries, employee_meta } = req.body;

    if (!month_year || !Array.isArray(entries)) {
      return res.status(400).json({ error: 'Invalid payload. month_year and entries array required.' });
    }

    // Update employee profile metadata if provided
    if (employee_meta) {
      const { name, designation, pay, pf_no, bill_unit, doa, hq } = employee_meta;
      await run(
        `UPDATE staff 
         SET name = COALESCE(?, name),
             designation = COALESCE(?, designation),
             pay_amount = COALESCE(?, pay_amount),
             pf_no = COALESCE(?, pf_no),
             bill_unit = COALESCE(?, bill_unit),
             doa = COALESCE(?, doa),
             hq_station = COALESCE(?, hq_station)
         WHERE id = ?`,
        [name, designation, pay, pf_no, bill_unit, doa, hq, staffId]
      );
    }

    // Clear previous entries for this staff & month
    await run('DELETE FROM nda_entries WHERE staff_id = ? AND month_year = ?', [staffId, month_year]);

    // Save all current rows
    for (let i = 0; i < entries.length; i++) {
      const item = entries[i];
      let nightHours = item.night_hours !== null && item.night_hours !== undefined && item.night_hours !== ''
        ? parseFloat(item.night_hours)
        : null;
      if (nightHours !== null && !isNaN(nightHours)) {
        nightHours = Math.max(0, nightHours);
      } else {
        nightHours = null;
      }

      await run(
        `INSERT INTO nda_entries (staff_id, month_year, date_str, train_no, sched_dep, sched_arr, act_dep, act_arr, from_station, to_station, night_hours, row_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          staffId,
          month_year,
          item.date_str || '',
          item.train_no || '',
          item.sched_dep || '',
          item.sched_arr || '',
          item.act_dep || '',
          item.act_arr || '',
          item.from_station || '',
          item.to_station || '',
          nightHours,
          i + 1
        ]
      );

      // Save to actual_train_runs cache so TA and Diary pick it up
      if (item.train_no && item.date_iso) {
        if (item.from_station && item.act_dep && item.act_dep !== '---') {
          await run(
            `INSERT OR REPLACE INTO actual_train_runs (train_no, run_date, station_code, sched_arr, sched_dep, act_arr, act_dep, delay_arr_mins, delay_dep_mins, source)
             VALUES (?, ?, ?, '---', ?, '---', ?, 0, 0, 'NDA_SYNC')`,
            [item.train_no, item.date_iso, item.from_station, item.sched_dep || item.act_dep, item.act_dep]
          );
        }
        if (item.to_station && item.act_arr && item.act_arr !== '---') {
          await run(
            `INSERT OR REPLACE INTO actual_train_runs (train_no, run_date, station_code, sched_arr, sched_dep, act_arr, act_dep, delay_arr_mins, delay_dep_mins, source)
             VALUES (?, ?, ?, ?, '---', ?, '---', 0, 0, 'NDA_SYNC')`,
            [item.train_no, item.date_iso, item.to_station, item.sched_arr || item.act_arr, item.act_arr]
          );
        }
      }

      // Update matching ta_entries row if present
      await run(
        `UPDATE ta_entries 
         SET dep_time = CASE WHEN ? != '' AND ? != '---' THEN ? ELSE dep_time END,
             arr_time = CASE WHEN ? != '' AND ? != '---' THEN ? ELSE arr_time END
         WHERE staff_id = ? AND month_year = ? AND (row_order = ? OR (date_str = ? AND train_no = ?))`,
        [
          item.act_dep || '', item.act_dep || '', item.act_dep || '',
          item.act_arr || '', item.act_arr || '', item.act_arr || '',
          staffId, month_year, i + 1, item.date_str || '', item.train_no || ''
        ]
      );
    }

    res.json({ success: true, message: 'Night Duty Allowance journal saved and synced to TA & Diary successfully.' });
  } catch (err) {
    console.error('Error saving NDA journal entries:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/documents/nda/:staffId?year=2026&month=8 - Reset custom entries to auto-generated master rotation
app.delete('/api/documents/nda/:staffId', authenticateToken, async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId, 10);
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
    const monthYearStr = `${year}-${String(month).padStart(2, '0')}`;

    await run('DELETE FROM nda_entries WHERE staff_id = ? AND month_year = ?', [staffId, monthYearStr]);
    res.json({ success: true, message: 'NDA Journal reset to master roster rotation.' });
  } catch (err) {
    console.error('Error resetting NDA journal:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// DIARY (E.F.T EARNINGS STATEMENT) ENDPOINTS
// ==========================================
const { generateStaffDiary } = require('./diary_generator');

// GET /api/documents/diary/:staffId?year=2026&month=6
app.get('/api/documents/diary/:staffId', authenticateToken, async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId, 10);
    let year = parseInt(req.query.year, 10);
    let month = parseInt(req.query.month, 10);
    if (req.query.month && String(req.query.month).includes('-')) {
      const parts = String(req.query.month).split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    }
    if (!year) year = new Date().getFullYear();
    if (!month) month = new Date().getMonth() + 1;

    const startDate = req.query.start_date || null;
    const endDate = req.query.end_date || null;

    const diary = await generateStaffDiary({ get, all, run }, staffId, year, month, startDate, endDate);
    res.json(diary);
  } catch (err) {
    console.error('Error generating Diary:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/documents/diary/:staffId - Save custom Diary row edits
app.post('/api/documents/diary/:staffId', authenticateToken, async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId, 10);
    const { month_year, entries, employee_meta } = req.body;

    if (!month_year || !Array.isArray(entries)) {
      return res.status(400).json({ error: 'Invalid payload. month_year and entries array required.' });
    }

    // Update employee profile metadata if provided
    if (employee_meta) {
      const { name, designation, pay, pf_no, bill_unit, t_code_no } = employee_meta;
      await run(
        `UPDATE staff 
         SET name = COALESCE(?, name),
             designation = COALESCE(?, designation),
             pay_amount = COALESCE(?, pay_amount),
             pf_no = COALESCE(?, pf_no),
             bill_unit = COALESCE(?, bill_unit),
             t_code_no = COALESCE(?, t_code_no)
         WHERE id = ?`,
        [name, designation, pay, pf_no, bill_unit, t_code_no, staffId]
      );
    }

    // Clear previous entries for this staff & month
    await run('DELETE FROM diary_entries WHERE staff_id = ? AND month_year = ?', [staffId, month_year]);

    // Save all current rows
    for (let i = 0; i < entries.length; i++) {
      const item = entries[i];
      await run(
        `INSERT INTO diary_entries (staff_id, month_year, date_str, train_no, dep_time, arr_time, from_station, to_station, eft_from, eft_to, total_issued, no_of_cases, collected_rs, gst_cases, gst_amount, total_amount, remit_station, remit_mr_no, remit_date, remit_amount, row_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          staffId,
          month_year,
          item.date_str || '',
          item.train_no || '',
          item.dep_time || '',
          item.arr_time || '',
          item.from_station || '',
          item.to_station || '',
          item.eft_from || '',
          item.eft_to || '',
          item.total_issued !== null && item.total_issued !== undefined && item.total_issued !== '' ? parseInt(item.total_issued, 10) : null,
          item.no_of_cases !== null && item.no_of_cases !== undefined && item.no_of_cases !== '' ? parseInt(item.no_of_cases, 10) : null,
          item.collected_rs !== null && item.collected_rs !== undefined && item.collected_rs !== '' ? parseFloat(item.collected_rs) : null,
          item.gst_cases !== null && item.gst_cases !== undefined && item.gst_cases !== '' ? parseInt(item.gst_cases, 10) : null,
          item.gst_amount !== null && item.gst_amount !== undefined && item.gst_amount !== '' ? parseFloat(item.gst_amount) : null,
          item.total_amount !== null && item.total_amount !== undefined && item.total_amount !== '' ? parseFloat(item.total_amount) : null,
          item.remit_station || '',
          item.remit_mr_no || '',
          item.remit_date || '',
          item.remit_amount !== null && item.remit_amount !== undefined && item.remit_amount !== '' ? parseFloat(item.remit_amount) : null,
          i + 1
        ]
      );
    }

    res.json({ success: true, message: 'Diary entries saved successfully.' });
  } catch (err) {
    console.error('Error saving Diary entries:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/documents/diary/:staffId?year=2026&month=6 - Reset custom entries to auto-generated master rotation
app.delete('/api/documents/diary/:staffId', authenticateToken, async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId, 10);
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
    const monthYearStr = `${year}-${String(month).padStart(2, '0')}`;

    await run('DELETE FROM diary_entries WHERE staff_id = ? AND month_year = ?', [staffId, monthYearStr]);
    res.json({ success: true, message: 'Diary reset to master roster rotation.' });
  } catch (err) {
    console.error('Error resetting Diary:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// DAILY EARNINGS SHEET API ENDPOINTS
// ==========================================
const { generateDailyEarnings, generateStaffMonthlyEarnings, generateRangeDailyEarnings } = require('./daily_earnings_generator');

// GET /api/documents/daily-earnings?date=2026-08-01&category_id=all
app.get('/api/documents/daily-earnings', authenticateToken, async (req, res) => {
  try {
    const { date, category_id } = req.query;
    const earningsSheet = await generateDailyEarnings({ get, all, run }, date, category_id);
    res.json(earningsSheet);
  } catch (err) {
    console.error('Error generating Daily Earnings Sheet:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/documents/daily-earnings/range?start_date=2026-08-28&end_date=2026-08-30&category_id=all - Continuous multi-day register
app.get('/api/documents/daily-earnings/range', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, category_id } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date query parameters are required.' });
    }
    const rangeData = await generateRangeDailyEarnings({ get, all, run }, start_date, end_date, category_id);
    res.json(rangeData);
  } catch (err) {
    console.error('Error generating Multi-Day Daily Earnings Range:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/documents/daily-earnings/range - Save entries across multiple days
app.post('/api/documents/daily-earnings/range', authenticateToken, async (req, res) => {
  try {
    const { days } = req.body;
    if (!Array.isArray(days)) {
      return res.status(400).json({ error: 'days array is required.' });
    }

    await run('BEGIN TRANSACTION');

    for (const day of days) {
      if (!day.date || !Array.isArray(day.entries)) continue;
      for (let i = 0; i < day.entries.length; i++) {
        const item = day.entries[i];
        if (!item.staff_id) continue;

        const twt_nc = parseInt(item.twt_nc, 10) || 0;
        const twt_fare = parseFloat(item.twt_fare) || 0;
        const twt_penalty = parseFloat(item.twt_penalty) || 0;

        const ir_nc = parseInt(item.ir_nc, 10) || 0;
        const ir_fare = parseFloat(item.ir_fare) || 0;
        const ir_penalty = parseFloat(item.ir_penalty) || 0;

        const ubl_nc = parseInt(item.ubl_nc, 10) || 0;
        const ubl_amt = parseFloat(item.ubl_amt) || 0;

        const gst = parseFloat(item.gst) || 0;

        const z652_nc = parseInt(item.z652_nc, 10) || 0;
        const z652_amt = parseFloat(item.z652_amt) || 0;

        const oc_nc = parseInt(item.oc_nc, 10) || 0;
        const oc_amt = parseFloat(item.oc_amt) || 0;

        await run(
          `INSERT OR REPLACE INTO daily_earnings_entries 
           (date, category_id, staff_id, staff_name, designation, depot_title, twt_nc, twt_fare, twt_penalty, ir_nc, ir_fare, ir_penalty, ubl_nc, ubl_amt, gst, z652_nc, z652_amt, oc_nc, oc_amt, duty, remarks, row_order, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            day.date,
            item.category_id || null,
            item.staff_id,
            item.staff_name || '',
            item.designation || 'TTI',
            item.depot_title || 'GNT ATY-1D2',
            twt_nc,
            twt_fare,
            twt_penalty,
            ir_nc,
            ir_fare,
            ir_penalty,
            ubl_nc,
            ubl_amt,
            gst,
            z652_nc,
            z652_amt,
            oc_nc,
            oc_amt,
            item.duty || '',
            item.remarks || '',
            i + 1
          ]
        );
      }
    }

    await run('COMMIT');
    res.json({ success: true, message: 'Multi-day earnings saved successfully.' });
  } catch (err) {
    await run('ROLLBACK');
    console.error('Error saving Multi-Day Daily Earnings:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/documents/daily-earnings/staff/:staffId?year=2026&month=9 - Fetch whole month earnings for one staff member
app.get('/api/documents/daily-earnings/staff/:staffId', authenticateToken, async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId, 10);
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);

    const monthlyEarnings = await generateStaffMonthlyEarnings({ get, all, run }, staffId, year, month);
    res.json(monthlyEarnings);
  } catch (err) {
    console.error('Error generating Staff Monthly Earnings:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/documents/daily-earnings/staff/:staffId - Save staff member's monthly earnings entries (seamless 2-way sync with daily sheet)
app.post('/api/documents/daily-earnings/staff/:staffId', authenticateToken, async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId, 10);
    const { entries, year, month } = req.body;
    if (!Array.isArray(entries)) {
      return res.status(400).json({ error: 'Entries array is required.' });
    }

    const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }

    await run('BEGIN TRANSACTION');

    for (let i = 0; i < entries.length; i++) {
      const item = entries[i];
      if (!item.date) continue;

      const twt_nc = parseInt(item.twt_nc, 10) || 0;
      const twt_fare = parseFloat(item.twt_fare) || 0;
      const twt_penalty = parseFloat(item.twt_penalty) || 0;

      const ir_nc = parseInt(item.ir_nc, 10) || 0;
      const ir_fare = parseFloat(item.ir_fare) || 0;
      const ir_penalty = parseFloat(item.ir_penalty) || 0;

      const ubl_nc = parseInt(item.ubl_nc, 10) || 0;
      const ubl_amt = parseFloat(item.ubl_amt) || 0;

      const gst = parseFloat(item.gst) || 0;

      const z652_nc = parseInt(item.z652_nc, 10) || 0;
      const z652_amt = parseFloat(item.z652_amt) || 0;

      const oc_nc = parseInt(item.oc_nc, 10) || 0;
      const oc_amt = parseFloat(item.oc_amt) || 0;

      await run(
        `INSERT OR REPLACE INTO daily_earnings_entries 
         (date, category_id, staff_id, staff_name, designation, depot_title, twt_nc, twt_fare, twt_penalty, ir_nc, ir_fare, ir_penalty, ubl_nc, ubl_amt, gst, z652_nc, z652_amt, oc_nc, oc_amt, duty, remarks, row_order, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          item.date,
          staff.category_id,
          staff.id,
          staff.name,
          staff.designation || 'TTI',
          item.depot_title || 'GNT ATY-1D2',
          twt_nc,
          twt_fare,
          twt_penalty,
          ir_nc,
          ir_fare,
          ir_penalty,
          ubl_nc,
          ubl_amt,
          gst,
          z652_nc,
          z652_amt,
          oc_nc,
          oc_amt,
          item.duty || '',
          item.remarks || '',
          i + 1
        ]
      );
    }

    await run('COMMIT');
    res.json({ success: true, message: 'Monthly earnings saved and synced to daily sheets successfully.' });
  } catch (err) {
    await run('ROLLBACK');
    console.error('Error saving Staff Monthly Earnings:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/documents/daily-earnings/staff/:staffId?year=2026&month=9 - Reset staff entries for month
app.delete('/api/documents/daily-earnings/staff/:staffId', authenticateToken, async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId, 10);
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
    const monthStr = String(month).padStart(2, '0');
    const startDateStr = `${year}-${monthStr}-01`;
    const endDateStr = `${year}-${monthStr}-31`;

    await run(
      'DELETE FROM daily_earnings_entries WHERE staff_id = ? AND date >= ? AND date <= ?',
      [staffId, startDateStr, endDateStr]
    );

    res.json({ success: true, message: 'Staff monthly earnings reset to roster duties.' });
  } catch (err) {
    console.error('Error resetting Staff Monthly Earnings:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/documents/daily-earnings - Save/Update all row entries for a given date
app.post('/api/documents/daily-earnings', authenticateToken, async (req, res) => {
  try {
    const { date, depot_title, entries } = req.body;
    if (!date || !Array.isArray(entries)) {
      return res.status(400).json({ error: 'Date and entries array are required.' });
    }

    await run('BEGIN TRANSACTION');

    for (let i = 0; i < entries.length; i++) {
      const item = entries[i];
      if (!item.staff_id) continue;

      const twt_nc = parseInt(item.twt_nc, 10) || 0;
      const twt_fare = parseFloat(item.twt_fare) || 0;
      const twt_penalty = parseFloat(item.twt_penalty) || 0;

      const ir_nc = parseInt(item.ir_nc, 10) || 0;
      const ir_fare = parseFloat(item.ir_fare) || 0;
      const ir_penalty = parseFloat(item.ir_penalty) || 0;

      const ubl_nc = parseInt(item.ubl_nc, 10) || 0;
      const ubl_amt = parseFloat(item.ubl_amt) || 0;

      const gst = parseFloat(item.gst) || 0;

      const z652_nc = parseInt(item.z652_nc, 10) || 0;
      const z652_amt = parseFloat(item.z652_amt) || 0;

      const oc_nc = parseInt(item.oc_nc, 10) || 0;
      const oc_amt = parseFloat(item.oc_amt) || 0;

      await run(
        `INSERT OR REPLACE INTO daily_earnings_entries 
         (date, category_id, staff_id, staff_name, designation, depot_title, twt_nc, twt_fare, twt_penalty, ir_nc, ir_fare, ir_penalty, ubl_nc, ubl_amt, gst, z652_nc, z652_amt, oc_nc, oc_amt, duty, remarks, row_order, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          date,
          item.category_id || null,
          item.staff_id,
          item.staff_name || '',
          item.designation || 'TTI',
          depot_title || item.depot_title || 'GNT ATY-1D2',
          twt_nc,
          twt_fare,
          twt_penalty,
          ir_nc,
          ir_fare,
          ir_penalty,
          ubl_nc,
          ubl_amt,
          gst,
          z652_nc,
          z652_amt,
          oc_nc,
          oc_amt,
          item.duty || '',
          item.remarks || '',
          i + 1
        ]
      );
    }

    await run('COMMIT');
    res.json({ success: true, message: 'Daily Earnings Sheet saved successfully.' });
  } catch (err) {
    await run('ROLLBACK');
    console.error('Error saving Daily Earnings entries:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/documents/daily-earnings?date=2026-08-01 - Reset custom entries for date
app.delete('/api/documents/daily-earnings', authenticateToken, async (req, res) => {
  try {
    const { date, category_id } = req.query;
    if (!date) return res.status(400).json({ error: 'Date is required' });

    if (category_id && category_id !== 'all') {
      await run('DELETE FROM daily_earnings_entries WHERE date = ? AND category_id = ?', [date, category_id]);
    } else {
      await run('DELETE FROM daily_earnings_entries WHERE date = ?', [date]);
    }

    res.json({ success: true, message: 'Daily Earnings Sheet reset to master roster rotation.' });
  } catch (err) {
    console.error('Error resetting Daily Earnings:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================
// OFFICIAL NTES & MULTI-SOURCE LIVE TRAIN RUNNING TRACKER
// Queries live arrival & departure timings from WhereIsMyTrain, RailYatri, and NTES
// ==============================================================
const { syncJourneyLegsMultiSource, fetchMultiSourceTrainTimings } = require('./services/multi_source_tracker');
const { syncJourneyLegsWithNtes, fetchTrainRunningFromNtes } = require('./services/ntes_service');

// Multi-Source Live Sync Endpoint
app.post('/api/train-timings/sync-multi', authenticateToken, async (req, res) => {
  try {
    const { legs, forceRefresh } = req.body;
    if (!Array.isArray(legs)) {
      return res.status(400).json({ error: 'Array of journey legs required.' });
    }

    const shouldForce = forceRefresh !== false;
    const updatedLegs = await syncJourneyLegsMultiSource(legs, { get, all, run }, shouldForce);
    res.json({ success: true, legs: updatedLegs, engine: 'Official NTES & Live Railway Tracker' });
  } catch (err) {
    console.error('Error syncing multi timings:', err);
    res.status(500).json({ error: err.message });
  }
});

// Dedicated /api/train-timings/sync-ntes route
app.post('/api/train-timings/sync-ntes', authenticateToken, async (req, res) => {
  try {
    const { legs, forceRefresh } = req.body;
    if (!Array.isArray(legs)) {
      return res.status(400).json({ error: 'Array of journey legs required.' });
    }

    const shouldForce = forceRefresh !== false;
    const updatedLegs = await syncJourneyLegsMultiSource(legs, { get, all, run }, shouldForce);
    res.json({ success: true, legs: updatedLegs, engine: 'Official NTES & Live Railway Tracker' });
  } catch (err) {
    console.error('Error syncing NTES timings:', err);
    res.status(500).json({ error: err.message });
  }
});

// Query single train running status
app.get('/api/train-timings/multi/:trainNo', authenticateToken, async (req, res) => {
  try {
    const { trainNo } = req.params;
    const dateIso = req.query.date || new Date().toISOString().split('T')[0];
    const timings = await fetchMultiSourceTrainTimings(trainNo, dateIso, { get, all, run }, true);
    res.json({ success: true, train_no: trainNo, date: dateIso, stations: timings, engine: 'Multi-Source Live Tracker' });
  } catch (err) {
    console.error('Error fetching train status:', err);
    res.status(500).json({ error: err.message });
  }
});

// Query single train running status on Official NTES
app.get('/api/train-timings/ntes/:trainNo', authenticateToken, async (req, res) => {
  try {
    const { trainNo } = req.params;
    const dateIso = req.query.date || new Date().toISOString().split('T')[0];
    const timings = await fetchMultiSourceTrainTimings(trainNo, dateIso, { get, all, run }, true);
    res.json({ success: true, train_no: trainNo, date: dateIso, stations: timings, engine: 'Official NTES & Live Tracker' });
  } catch (err) {
    console.error('Error fetching single train NTES status:', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// MUSTER ROLL API (11th to 10th Wage Period Cycle)
// Supported codes: E, O, P, R, CL, CCL, SCL, LAP, LHAP, CR, SICK, OD, NH
// ----------------------------------------------------
const ALLOWED_MUSTER_CODES = ['E', 'O', 'P', 'R', 'CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'CR', 'SICK', 'OD', 'NH'];

function getMusterCycleDates(cycleStartStr) {
  let startDate;
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

  const dates = [];
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
    startDateStr: dates[0].dateStr,
    endDateStr: dates[dates.length - 1].dateStr,
    prevCycleStart,
    nextCycleStart,
    periodLabel: `${dates[0].monthLabel} 11 - ${dates[dates.length - 1].monthLabel} 10, ${dates[dates.length - 1].dateStr.split('-')[0]}`,
    totalDays: dates.length,
    dates
  };
}

// GET /api/muster - Fetch complete muster details for a cycle
app.get('/api/muster', async (req, res) => {
  try {
    const { cycle_start, category_id } = req.query;
    const cycle = getMusterCycleDates(cycle_start);

    let staffSql = `
      SELECT s.*, c.name as category_name, c.code as category_code, c.cycle_length, c.anchor_date 
      FROM staff s 
      LEFT JOIN categories c ON s.category_id = c.id
      WHERE (s.name NOT LIKE '%VACANT%')
    `;
    let staffParams = [];
    if (category_id && category_id !== 'ALL') {
      staffSql += ' AND s.category_id = ?';
      staffParams.push(category_id);
    }
    staffSql += `
      ORDER BY 
        CASE WHEN s.seniority_no IS NOT NULL AND s.seniority_no > 0 THEN s.seniority_no ELSE 9999 END,
        s.category_id, 
        s.row_position
    `;

    const staffMembers = await all(staffSql, staffParams);
    const links = await all('SELECT * FROM links');
    const linkMap = {};
    links.forEach(l => {
      linkMap[`${l.category_id}_${l.link_number}`] = l;
    });

    const overrides = await all('SELECT * FROM overrides WHERE date >= ? AND date <= ?', [cycle.startDateStr, cycle.endDateStr]);
    const overrideMap = {};
    overrides.forEach(o => {
      overrideMap[`${o.staff_id}_${o.date}`] = o;
    });

    const musterRecords = await all('SELECT * FROM muster_records WHERE date >= ? AND date <= ?', [cycle.startDateStr, cycle.endDateStr]);
    const musterMap = {};
    musterRecords.forEach(m => {
      musterMap[`${m.staff_id}_${m.date}`] = m;
    });

    const crBalances = await calculateStaffCrBalances();
    const grandTotals = { P: 0, R: 0, O: 0, E: 0, CR: 0, CL: 0, CCL: 0, SCL: 0, LAP: 0, LHAP: 0, SICK: 0, OD: 0, NH: 0, totalLeaves: 0 };
    const staffRows = [];

    for (const staff of staffMembers) {
      const days = {};
      const counts = { P: 0, R: 0, O: 0, E: 0, CR: 0, CL: 0, CCL: 0, SCL: 0, LAP: 0, LHAP: 0, SICK: 0, OD: 0, NH: 0 };
      const staffCr = crBalances[staff.id];

      for (const d of cycle.dates) {
        const key = `${staff.id}_${d.dateStr}`;
        let code = 'P';
        let isManual = false;
        let remarks = '';

        if (musterMap[key]) {
          code = musterMap[key].code;
          isManual = true;
          remarks = musterMap[key].remarks || '';
        } else if (overrideMap[key]) {
          const o = overrideMap[key];
          if (o.status === 'CR') code = 'CR';
          else if (o.status === 'SICK') code = o.leave_type || 'LHAP';
          else if (o.status === 'LEAVE') code = o.leave_type || 'CL';
          else if (o.status === 'REST') code = 'R';
          else if (o.overridden_link_number !== null) {
            // All assigned train duties and outstation halt count as P (Present)
            code = 'P';
          }
        } else {
          // Cyclic baseline
          let isRest = false;
          if (staff.category_id && staff.anchor_date && staff.cycle_length && staff.row_position) {
            const dayOffset = getDayOffset(staff.anchor_date, d.dateStr);
            const linkNum = getBaseLinkNumber(staff.row_position, dayOffset, staff.cycle_length);
            
            if (staff.category_id === 4) {
              if (staff.rest_day && staff.rest_day.toUpperCase() === d.dayOfWeek) isRest = true;
              else if (staff.name.toUpperCase().includes(`${d.dayOfWeek} REST`)) isRest = true;
            } else {
              const lDef = linkNum !== null ? linkMap[`${staff.category_id}_${linkNum}`] : null;
              if (linkNum === null || (lDef && lDef.is_rest === 1)) isRest = true;
            }
          } else {
            // Staff without roster grid baseline (e.g. MV PRASAD, P PRATHAP)
            if (staff.rest_day && staff.rest_day.toUpperCase() === d.dayOfWeek) {
              isRest = true;
            } else if (d.dayOfWeek === 'SUN') {
              isRest = true;
            }
          }

          if (isRest) {
            code = 'R';
          } else {
            // Outstation Duty / Halt is now P (Present)
            code = 'P';
          }
        }

        if (counts[code] !== undefined) counts[code]++;
        if (grandTotals[code] !== undefined) grandTotals[code]++;
        const isRestDayWorked = (staffCr && staffCr.dates && staffCr.dates.includes(d.dateStr)) ||
                                (remarks && /rest day worked|cr credit|cr against rest/i.test(remarks));
        days[d.dateStr] = { code, isManual, remarks, isRestDayWorked };
      }

      const totalLeaves = counts.CL + counts.CCL + counts.SCL + counts.LAP + counts.LHAP + counts.SICK + (counts.NH || 0);
      grandTotals.totalLeaves += totalLeaves;

      staffRows.push({
        id: staff.id,
        name: staff.name,
        designation: staff.designation || '',
        pf_no: staff.pf_no || '',
        hrms_id: staff.hrms_id || '',
        seniority_no: staff.seniority_no || null,
        categoryId: staff.category_id,
        categoryName: staff.category_name,
        categoryCode: staff.category_code,
        rowPosition: staff.row_position,
        cr_available: staffCr ? staffCr.display : null,
        cr_short_display: staffCr ? staffCr.shortDisplay : '-',
        cr_count: staffCr ? staffCr.count : 0,
        cr_dates: staffCr ? staffCr.dates : [],
        counts: {
          ...counts,
          totalLeaves,
          totalDays: cycle.totalDays
        },
        days
      });
    }

    res.json({
      success: true,
      cycle,
      staff: staffRows,
      grandTotals: {
        ...grandTotals,
        staffCount: staffMembers.length
      }
    });
  } catch (err) {
    console.error('Error in /api/muster:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Synchronize Muster Record status across Overrides, TA Approvals, LR Sheet, and TA Entries
 */
async function syncMusterToSchedulesAndApprovals(staffId, dateStr, cleanCode, remarks = '') {
  const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
  const isLeave = ['CL', 'CCL', 'SCL', 'LAP', 'LHAP', 'OD', 'NH'].includes(cleanCode);
  const isSick = cleanCode === 'SICK';
  const isCr = cleanCode === 'CR';
  const isRest = cleanCode === 'R';
  const isAbsent = cleanCode === 'O';

  const dateParts = dateStr.split('-');
  const altDateStr = dateParts.length === 3 ? `${parseInt(dateParts[2], 10)}/${parseInt(dateParts[1], 10)}/${dateParts[0].slice(-2)}` : dateStr;

  if (isLeave || isSick || isCr || isRest || isAbsent) {
    const status = isLeave ? 'LEAVE' : (isSick ? 'SICK' : (isCr ? 'CR' : (isRest ? 'REST' : 'ABSENT')));
    const reason = `Muster: ${cleanCode}${remarks ? ` (${remarks})` : ''}`;
    const leaveType = isLeave ? cleanCode : null;
    const disallowRemark = `Disallowed: On Leave/Absent as per Muster Chart (${cleanCode})`;

    // 1. Upsert into overrides
    await run(
      `INSERT INTO overrides (staff_id, date, overridden_link_number, status, reason, leave_type)
       VALUES (?, ?, NULL, ?, ?, ?)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         overridden_link_number = NULL,
         status = excluded.status,
         reason = excluded.reason,
         leave_type = excluded.leave_type`,
      [staffId, dateStr, status, reason, leaveType]
    );

    // 2. Disallow TA claims on leave/sick/rest/absent days in ta_approvals
    await run(
      `UPDATE ta_approvals 
       SET status = 'REJECTED', 
           claim_amount = 0, 
           ta_percentage = NULL, 
           remarks = ?
       WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)`,
      [disallowRemark, staffId, dateStr, dateStr, altDateStr]
    );

    // 3. Disallow in ta_entries as well if custom entries exist
    await run(
      `UPDATE ta_entries 
       SET ta_b1 = '', 
           days_claiming_ta = NULL, 
           remarks = ?
       WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)`,
      [disallowRemark, staffId, dateStr, dateStr, altDateStr]
    );

    // 4. If staff is Category 4 (LR), synchronize to lr_sheet_records
    if (staff && staff.category_id === 4) {
      const lrCode = cleanCode === 'SICK' ? 'S' : cleanCode;
      await syncLRSheetRecord(staffId, dateStr, lrCode, reason, 'Muster Roll Sync');
    }
  } else if (cleanCode === 'P' || cleanCode === 'E') {
    // If an automated muster override existed, clean it up so regular duty resumes
    await run(
      `DELETE FROM overrides 
       WHERE staff_id = ? AND date = ? AND (reason LIKE 'Muster:%' OR reason LIKE 'Muster Chart:%')`,
      [staffId, dateStr]
    );

    await restoreMusterTaApprovalsAndEntries(staffId, dateStr, altDateStr);

    // If staff is Category 4 (LR), resolve duty or set available
    if (staff && staff.category_id === 4) {
      const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const dObj = new Date(dateStr + 'T12:00:00');
      const dayOfWeek = dayNames[dObj.getDay()];
      const resolved = await resolveDutyCodeForLRStaff(staffId, dateStr, dayOfWeek, staff.rest_day);
      if (resolved && resolved.code) {
        await syncLRSheetRecord(staffId, dateStr, resolved.code, resolved.remarks || 'Muster: Present', 'Muster Roll Sync');
      } else {
        await syncLRSheetRecord(staffId, dateStr, 'AVL', 'Present at HQ', 'Muster Roll Sync');
      }
    }
  }
}

async function restoreMusterTaApprovalsAndEntries(staffId, dateStr, altDateStr) {
  const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
  const daRate = (staff && staff.pay_amount >= 53100) ? 800 : ((staff && staff.pay_amount >= 35400) ? 500 : 800);

  const disallowedClaims = await all(
    `SELECT * FROM ta_approvals 
     WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?) 
       AND (remarks LIKE 'Disallowed: On Leave/Absent as per Muster Chart%' OR remarks LIKE 'Disallowed: On Leave/Absent as per LR Sheet%' OR status = 'REJECTED')`,
    [staffId, dateStr, dateStr, altDateStr]
  );

  for (const c of disallowedClaims) {
    const calc = calculateAbsenceAndTa(c.dep_time, c.arr_time, c.from_station, c.to_station, c.train_no);
    const taPct = calc.ta_percentage;
    const absenceHours = calc.absence_hours;
    const claimAmt = taPct !== null && taPct !== undefined ? Math.round(taPct * daRate) : 0;
    const restoredStatus = 'APPROVED';

    await run(
      `UPDATE ta_approvals 
       SET status = ?, 
           ta_percentage = ?, 
           absence_hours = ?, 
           claim_amount = ?, 
           remarks = '' 
       WHERE id = ?`,
      [restoredStatus, taPct, absenceHours, claimAmt, c.id]
    );

    await run(
      `UPDATE ta_entries 
       SET ta_b1 = ?, 
           days_claiming_ta = ?, 
           remarks = '' 
       WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?) AND train_no = ?`,
      [taPct !== null && taPct !== undefined ? String(taPct) : '', taPct, staffId, dateStr, dateStr, altDateStr, c.train_no]
    );
  }
}

async function revertMusterFromSchedulesAndApprovals(staffId, dateStr) {
  const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
  const dateParts = dateStr.split('-');
  const altDateStr = dateParts.length === 3 ? `${parseInt(dateParts[2], 10)}/${parseInt(dateParts[1], 10)}/${dateParts[0].slice(-2)}` : dateStr;

  await run(
    `DELETE FROM overrides 
     WHERE staff_id = ? AND date = ? AND (reason LIKE 'Muster:%' OR reason LIKE 'Muster Chart:%')`,
    [staffId, dateStr]
  );
  await restoreMusterTaApprovalsAndEntries(staffId, dateStr, altDateStr);

  // If staff is Category 4 (LR), resolve baseline or delete override record
  if (staff && staff.category_id === 4) {
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dObj = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = dayNames[dObj.getDay()];
    const resolved = await resolveDutyCodeForLRStaff(staffId, dateStr, dayOfWeek, staff.rest_day);
    if (resolved && resolved.code) {
      await syncLRSheetRecord(staffId, dateStr, resolved.code, resolved.remarks || 'Baseline', 'Muster Roll Sync');
    } else {
      await run('DELETE FROM lr_sheet_records WHERE staff_id = ? AND date = ?', [staffId, dateStr]);
    }
  }
}

// POST /api/muster/update-cell - Update or assign code for a single employee cell
app.post('/api/muster/update-cell', requireAdmin, async (req, res) => {
  try {
    const { staff_id, date, code, remarks } = req.body;
    if (!staff_id || !date || !code) {
      return res.status(400).json({ error: 'staff_id, date, and code are required' });
    }

    const cleanCode = code.trim().toUpperCase();
    if (!ALLOWED_MUSTER_CODES.includes(cleanCode)) {
      return res.status(400).json({ error: `Invalid code. Must be one of: ${ALLOWED_MUSTER_CODES.join(', ')}` });
    }

    await run(
      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
       VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         code = excluded.code,
         remarks = excluded.remarks,
         updated_by = excluded.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
      [staff_id, date, cleanCode, remarks || null]
    );

    // Synchronize to Overrides, Daily View, and TA Approvals
    await syncMusterToSchedulesAndApprovals(staff_id, date, cleanCode, remarks);

    await logAudit('Admin', 'MUSTER_CELL_UPDATE', `Assigned muster code '${cleanCode}' for staff ID ${staff_id} on ${date}`);
    res.json({ success: true, message: `Muster cell updated to ${cleanCode} and synchronized across all sheets & documents` });
  } catch (err) {
    console.error('Error updating muster cell:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/muster/reset-cell - Reset muster cell back to cyclic baseline
app.post('/api/muster/reset-cell', requireAdmin, async (req, res) => {
  try {
    const { staff_id, date } = req.body;
    if (!staff_id || !date) {
      return res.status(400).json({ error: 'staff_id and date are required' });
    }

    await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [staff_id, date]);
    await revertMusterFromSchedulesAndApprovals(staff_id, date);

    await logAudit('Admin', 'MUSTER_CELL_RESET', `Reset muster cell for staff ID ${staff_id} on ${date} to baseline`);
    res.json({ success: true, message: 'Cell reset to cyclic baseline and synchronized' });
  } catch (err) {
    console.error('Error resetting muster cell:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/muster/batch-update - Batch update multiple cells
app.post('/api/muster/batch-update', requireAdmin, async (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Array of updates required' });
    }

    await run('BEGIN TRANSACTION');
    for (const item of updates) {
      if (!item.staff_id || !item.date || !item.code) continue;
      const cleanCode = item.code.trim().toUpperCase();
      if (!ALLOWED_MUSTER_CODES.includes(cleanCode)) continue;

      await run(
        `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
         VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
         ON CONFLICT(staff_id, date) DO UPDATE SET
           code = excluded.code,
           remarks = excluded.remarks,
           updated_by = excluded.updated_by,
           updated_at = CURRENT_TIMESTAMP`,
        [item.staff_id, item.date, cleanCode, item.remarks || null]
      );

      await syncMusterToSchedulesAndApprovals(item.staff_id, item.date, cleanCode, item.remarks);
    }
    await run('COMMIT');

    await logAudit('Admin', 'MUSTER_BATCH_UPDATE', `Batch updated ${updates.length} muster records`);
    res.json({ success: true, message: `Successfully updated ${updates.length} muster records and synchronized across all sheets & documents` });
  } catch (err) {
    await run('ROLLBACK');
    console.error('Error batch updating muster records:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/muster/reorder - Reorder staff rows in Muster Roll (persists custom order / seniority_no)
app.post('/api/muster/reorder', requireAdmin, async (req, res) => {
  try {
    const { staff_ids } = req.body; // Array of staff IDs in the new order [id1, id2, id3, ...]
    if (!Array.isArray(staff_ids) || staff_ids.length === 0) {
      return res.status(400).json({ error: 'staff_ids array is required' });
    }

    await run('BEGIN TRANSACTION');
    for (let index = 0; index < staff_ids.length; index++) {
      const staffId = staff_ids[index];
      const newSeniorityNo = index + 1;
      await run('UPDATE staff SET seniority_no = ? WHERE id = ?', [newSeniorityNo, staffId]);
    }
    await run('COMMIT');

    await logAudit('Admin', 'MUSTER_REORDER', `Reordered ${staff_ids.length} staff members in Muster Roll`);
    res.json({ success: true, message: 'Muster roll staff order updated successfully' });
  } catch (err) {
    await run('ROLLBACK');
    console.error('Error reordering muster staff:', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// LEAVE RESERVE (LR) SHEET / LIST ENDPOINTS & HELPERS
// ----------------------------------------------------

function formatTrainString(str) {
  if (!str) return '';
  let s = str.trim();
  if (s.toUpperCase() === 'REST') return 'R';
  if (s.toUpperCase() === 'NON DAILY' || s.toUpperCase() === 'NON-DAILY') return 'NON DAILY';
  s = s.replace(/PILOT\([^\)]+\)/gi, 'PILOT');
  s = s.replace(/,/g, ' / ');
  s = s.replace(/\s*\/\s*/g, ' / ');
  return s.trim();
}

function extractTrainsFromText(text) {
  if (!text) return null;
  // Match patterns like "17069/17262" or "12795/17645" or "17281/17282"
  const multiMatch = text.match(/\b(\d{4,5})\s*[\/\-]\s*(\d{4,5})\b/);
  if (multiMatch) {
    return `${multiMatch[1]} / ${multiMatch[2]}`;
  }
  const trainMatches = [];
  const re = /(?:Train\s*(\d{4,5}))|(?:\b(\d{4,5})\b)/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    const num = match[1] || match[2];
    const idx = match.index;
    const prefix = text.substring(Math.max(0, idx - 10), idx).toLowerCase();
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
  // Check for non-daily rotation link mention in reason text
  const linkParen = text.match(/Link\s*#?(\d+)/i);
  if (linkParen) {
    const lNum = parseInt(linkParen[1], 10);
    if (NON_DAILY_LINK_TRAINS[lNum]) return NON_DAILY_LINK_TRAINS[lNum];
  }

  // Check for stations (e.g. VSKP, SC, GTL, TPTY, BZA, RU, KPD)
  const stnMatch = text.match(/\b(GTL|SC|VSKP|TPTY|BZA|RU|KPD|GNT|NS)\b/i);
  if (stnMatch) {
    return stnMatch[1].toUpperCase();
  }
  return null;
}

const NON_DAILY_LINK_TRAINS = {
  60: '22882',
  61: '17221',
  62: '17069',
  63: 'R'
};

async function resolveDutyCodeForLRStaff(staffId, dateStr, dayOfWeek, staffRestDay, dataPool = null) {
  let overrides, links, nonDaily, dutyRegister, muster, dailyEarnings;
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
    links = await all('SELECT * FROM links');
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
  const sub = overrides ? overrides.find(o => o.substitute_staff_id === staffId && o.date === dateStr && o.status !== 'LEAVE' && o.status !== 'SICK') : null;
  const ov = direct || sub;

  if (ov) {
    if (ov.status === 'REST') return { code: 'R', remarks: ov.reason || '' };
    if (ov.status === 'SICK') return { code: 'S', remarks: ov.reason || '' };
    if (ov.status === 'LEAVE') return { code: ov.leave_type || 'L', remarks: ov.reason || '' };
    if (ov.status === 'CR') return { code: 'CR', remarks: ov.reason || '' };
    if (ov.status === 'ABSENT') return { code: 'O', remarks: ov.reason || 'Absent' };
    if (ov.status === 'AVAILABLE_FOR_BOOKING') return { code: 'AVL', remarks: ov.reason || 'Available for Duty' };
    if (ov.status === 'UTILISED_ADVANCE') return { code: `ADV (${ov.advance_train_no || 'TR'})`, remarks: ov.reason || 'Utilised in Advance' };

    // Try extract train numbers from reason
    const fromReason = extractTrainsFromText(ov.reason);
    if (fromReason) {
      return { code: fromReason, remarks: ov.reason || '' };
    }

    // Try link number
    const linkNum = ov.overridden_link_number !== null && ov.overridden_link_number !== undefined
      ? ov.overridden_link_number
      : (sub ? (sub.original_link_number || sub.overridden_link_number) : null);

    if (linkNum !== null && linkNum !== undefined) {
      const num = parseInt(linkNum, 10);
      if (NON_DAILY_LINK_TRAINS[num]) {
        return { code: NON_DAILY_LINK_TRAINS[num], remarks: ov.reason || '' };
      }
      const catId = ov.target_category_id || (sub ? (sub.staff_cat || sub.target_category_id || 2) : 2);
      const link = links.find(l => l.category_id === catId && l.link_number === linkNum)
                || links.find(l => l.link_number === linkNum);
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

    if (ov.reason && ov.reason.toLowerCase().includes('rest')) {
      return { code: 'R', remarks: ov.reason };
    }
  }

  // 1.5. Check multi-day link continuation (2-day, 3-day, or 4-day link sets)
  if (!ov && overrides && links) {
    const dMinus1 = new Date(dateStr + 'T12:00:00');
    dMinus1.setDate(dMinus1.getDate() - 1);
    const dMinus1Str = dMinus1.toISOString().split('T')[0];
    const prev1Ov = overrides.find(o => o.staff_id === staffId && o.date === dMinus1Str)
                 || overrides.find(o => o.substitute_staff_id === staffId && o.date === dMinus1Str && o.status !== 'LEAVE' && o.status !== 'SICK' && o.status !== 'REST');

    if (prev1Ov && prev1Ov.status !== 'REST' && prev1Ov.status !== 'SICK' && prev1Ov.status !== 'LEAVE' && prev1Ov.status !== 'CR' && prev1Ov.status !== 'ABSENT') {
      const prev1Link = prev1Ov.overridden_link_number !== null && prev1Ov.overridden_link_number !== undefined
        ? prev1Ov.overridden_link_number
        : (prev1Ov.substitute_staff_id === staffId ? (prev1Ov.original_link_number || prev1Ov.overridden_link_number) : null);
      const prev1Cat = prev1Ov.target_category_id || 2;
      const setInfo1 = getLinkSetDetails(prev1Cat, prev1Link);
      if (setInfo1 && setInfo1.dayIndexInSet < setInfo1.setLength) {
        const nextLegIndex = setInfo1.dayIndexInSet;
        const nextLegLinkNum = setInfo1.setLinks[nextLegIndex];
        const nextLink = links.find(l => l.category_id === prev1Cat && l.link_number === nextLegLinkNum)
                      || links.find(l => l.link_number === nextLegLinkNum);
        if (nextLink && nextLink.train_numbers) {
          return { code: formatTrainString(nextLink.train_numbers), remarks: `Day ${nextLegIndex + 1} of Link #${setInfo1.setLinks[0]} (${setInfo1.setLength}-day link set)` };
        }
      }
    }

    const dMinus2 = new Date(dateStr + 'T12:00:00');
    dMinus2.setDate(dMinus2.getDate() - 2);
    const dMinus2Str = dMinus2.toISOString().split('T')[0];
    const prev2Ov = overrides.find(o => o.staff_id === staffId && o.date === dMinus2Str)
                 || overrides.find(o => o.substitute_staff_id === staffId && o.date === dMinus2Str && o.status !== 'LEAVE' && o.status !== 'SICK' && o.status !== 'REST');

    if (prev2Ov && prev2Ov.status !== 'REST' && prev2Ov.status !== 'SICK' && prev2Ov.status !== 'LEAVE' && prev2Ov.status !== 'CR' && prev2Ov.status !== 'ABSENT') {
      const prev2Link = prev2Ov.overridden_link_number !== null && prev2Ov.overridden_link_number !== undefined
        ? prev2Ov.overridden_link_number
        : (prev2Ov.substitute_staff_id === staffId ? (prev2Ov.original_link_number || prev2Ov.overridden_link_number) : null);
      const prev2Cat = prev2Ov.target_category_id || 2;
      const setInfo2 = getLinkSetDetails(prev2Cat, prev2Link);
      if (setInfo2 && setInfo2.dayIndexInSet + 1 < setInfo2.setLength) {
        const leg3Index = setInfo2.dayIndexInSet + 1;
        const leg3LinkNum = setInfo2.setLinks[leg3Index];
        const link3 = links.find(l => l.category_id === prev2Cat && l.link_number === leg3LinkNum)
                   || links.find(l => l.link_number === leg3LinkNum);
        if (link3 && link3.train_numbers) {
          return { code: formatTrainString(link3.train_numbers), remarks: `Day ${leg3Index + 1} of Link #${setInfo2.setLinks[0]} (${setInfo2.setLength}-day link set)` };
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

async function syncLRSheetRecord(staffId, dateStr, dutyCode, remarks = '', updatedBy = 'Daily Duty Management') {
  if (!staffId || !dateStr) return;
  try {
    const staff = await get('SELECT id, category_id FROM staff WHERE id = ?', [staffId]);
    if (!staff || staff.category_id !== 4) return;

    if (!dutyCode || dutyCode.trim() === '') {
      await run('DELETE FROM lr_sheet_records WHERE staff_id = ? AND date = ?', [staffId, dateStr]);
      return;
    }

    const clean = dutyCode.trim();
    await run(`
      INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(staff_id, date) DO UPDATE SET
        duty_code = excluded.duty_code,
        remarks = excluded.remarks,
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `, [staffId, dateStr, clean, remarks || null, updatedBy]);
  } catch (err) {
    console.error(`Error syncing LR sheet record for staff ${staffId} on ${dateStr}:`, err);
  }
}

// Master function: Check Daily Duty Sheet up to date and synchronize all LR employee duties
async function syncLRSheetFromDailyDuty(targetYear = 2026, targetMonth = 9) {
  try {
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const startDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const endDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    const cat4Staff = await all('SELECT * FROM staff WHERE category_id = 4 ORDER BY row_position ASC');
    const monthOverrides = await all(`
      SELECT o.*, s1.name as staff_name, s1.category_id as staff_cat
      FROM overrides o
      JOIN staff s1 ON o.staff_id = s1.id
      WHERE o.date >= ? AND o.date <= ?
    `, [startDateStr, endDateStr]);
    const linksList = await all('SELECT * FROM links');
    const nonDailyList = await all('SELECT * FROM non_daily_trains');
    const dutyRegisterEntries = await all(`
      SELECT dre.*, drs.staff_id
      FROM duty_register_entry dre
      JOIN duty_register_staff drs ON dre.id = drs.entry_id
      WHERE dre.date >= ? AND dre.date <= ?
    `, [startDateStr, endDateStr]);
    const musterList = await all(`
      SELECT mr.*
      FROM muster_records mr
      JOIN staff s ON mr.staff_id = s.id
      WHERE s.category_id = 4 AND mr.date >= ? AND mr.date <= ?
    `, [startDateStr, endDateStr]);
    const earningsList = await all(`
      SELECT * FROM daily_earnings_entries
      WHERE date >= ? AND date <= ?
    `, [startDateStr, endDateStr]);

    const dataPool = {
      overrides: monthOverrides,
      links: linksList,
      nonDaily: nonDailyList,
      dutyRegister: dutyRegisterEntries,
      muster: musterList,
      dailyEarnings: earningsList
    };

    let syncedCount = 0;

    for (const staff of cat4Staff) {
      if (staff.id === 115) continue; // Skip K NAGA NAIK (relieved)

      for (let d = 1; d <= daysInMonth; d++) {
        const dObj = new Date(targetYear, targetMonth - 1, d);
        const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOfWeek = dayNames[dObj.getDay()];
        const hasDirectOv = monthOverrides.some(o => o.staff_id === staff.id && o.date === dateStr);
        const hasSubOv = monthOverrides.some(o => o.substitute_staff_id === staff.id && o.date === dateStr);
        const hasDutyReg = dutyRegisterEntries.some(r => r.staff_id === staff.id && r.date === dateStr);
        const hasEarn = earningsList.some(e => e.staff_id === staff.id && e.date === dateStr);
        const hasMuster = musterList.some(m => m.staff_id === staff.id && m.date === dateStr && ['R', 'CR', 'SICK', 'S', 'CL', 'LAP', 'LHAP', 'CAP', 'L'].includes(m.code.toUpperCase()));

        const dMinus1 = new Date(targetYear, targetMonth - 1, d);
        dMinus1.setDate(dMinus1.getDate() - 1);
        const prev1Str = `${dMinus1.getFullYear()}-${String(dMinus1.getMonth() + 1).padStart(2, '0')}-${String(dMinus1.getDate()).padStart(2, '0')}`;
        const dMinus2 = new Date(targetYear, targetMonth - 1, d);
        dMinus2.setDate(dMinus2.getDate() - 2);
        const prev2Str = `${dMinus2.getFullYear()}-${String(dMinus2.getMonth() + 1).padStart(2, '0')}-${String(dMinus2.getDate()).padStart(2, '0')}`;

        const hasPrevOv = monthOverrides.some(o => (o.staff_id === staff.id || (o.substitute_staff_id === staff.id && o.status !== 'LEAVE' && o.status !== 'SICK')) && (o.date === prev1Str || o.date === prev2Str) && o.status !== 'REST' && o.status !== 'SICK' && o.status !== 'LEAVE' && o.status !== 'CR');

        if (hasDirectOv || hasSubOv || hasDutyReg || hasEarn || hasMuster || hasPrevOv) {
          const resolved = await resolveDutyCodeForLRStaff(staff.id, dateStr, dayOfWeek, staff.rest_day, dataPool);
          if (resolved && resolved.code) {
            const existing = await get('SELECT * FROM lr_sheet_records WHERE staff_id = ? AND date = ?', [staff.id, dateStr]);
            // If cell had generic 'NON DAILY', or was not manually edited by Admin, update to resolved train
            const isNonDailyPlaceholder = existing && String(existing.duty_code).toUpperCase().startsWith('NON DAILY');
            if (!existing || isNonDailyPlaceholder || existing.updated_by !== 'Admin' || hasDirectOv || hasSubOv || hasPrevOv) {
              await syncLRSheetRecord(staff.id, dateStr, resolved.code, resolved.remarks, 'Daily Duty Management');
              syncedCount++;
            }
          }
        }
      }
    }

    const monthDate = new Date(targetYear, targetMonth - 1, 1);
    const monthName = monthDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    console.log(`[LR Sync] Checked Daily Duty Sheet up to date. Synchronized ${syncedCount} duties for ${monthName}.`);
    return { success: true, count: syncedCount, monthName };
  } catch (err) {
    console.error('Error in syncLRSheetFromDailyDuty:', err);
    return { success: false, error: err.message };
  }
}

// Keep alias for backward compatibility
const backfillLRSheetFromOverrides = syncLRSheetFromDailyDuty;

// POST /api/lr-sheet/sync-from-daily-duty - Check Daily Duty Sheet up to date and auto-update LR Sheet
app.post('/api/lr-sheet/sync-from-daily-duty', async (req, res) => {
  try {
    const year = parseInt(req.body.year, 10) || 2026;
    const month = parseInt(req.body.month, 10) || 9;
    const result = await syncLRSheetFromDailyDuty(year, month);
    res.json({
      success: true,
      message: `Checked Daily Duty Sheet up to date! Synchronized ${result.count} LR duties for ${result.monthName}.`,
      ...result
    });
  } catch (err) {
    console.error('Error syncing LR sheet from daily duty:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/lr-sheet - Fetch complete Leave Reserve sheet for a month (auto-synced with daily duty sheet)
app.get('/api/lr-sheet', async (req, res) => {
  try {
    let year = parseInt(req.query.year, 10);
    let month = parseInt(req.query.month, 10);
    if (req.query.month && String(req.query.month).includes('-')) {
      const parts = String(req.query.month).split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    }
    if (!year) year = 2026;
    if (!month || month < 1 || month > 12) month = 9;

    // Automatically check and synchronize with daily duty sheet
    await syncLRSheetFromDailyDuty(year, month);

    const daysInMonth = new Date(year, month, 0).getDate();
    const days = [];
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = dayNames[dateObj.getDay()];
      days.push({
        dayNum: d,
        dateStr,
        dayOfWeek,
        isSunday: dayOfWeek === 'SUN'
      });
    }

    const allCat4Staff = await all('SELECT * FROM staff WHERE category_id = 4 ORDER BY row_position ASC');

    // Official order from physical register
    const targetStaffOrder = [
      { id: 97, name: 'CH SRINIVASA RAO', desg: 'CTI', rest: 'SUN' },
      { id: 98, name: 'AG KRISHNA', desg: 'Sr.CCTC', rest: 'TUE' },
      { id: 99, name: 'D RAKESH', desg: 'Sr.CCTC', rest: 'FRI' },
      { id: 100, name: 'G SHIVAN', desg: 'Sr.CCTC', rest: 'MON' },
      { id: 101, name: 'MVS NAGI REDDY', desg: 'Sr.CCTC', rest: 'MON' },
      { id: 102, name: 'B VENKAT REDDY', desg: 'Sr.CCTC', rest: 'TUE' },
      { id: 103, name: 'MSA RAJU', desg: 'Sr.CCTC', rest: 'MON' },
      { id: 104, name: 'KB RAO', desg: 'Sr.CCTC', rest: 'FRI' },
      { id: 105, name: 'SANJAY KUMAR', desg: 'Sr.CCTC', rest: 'MON' },
      { id: 106, name: 'NC MEENA', desg: 'Sr.CCTC', rest: 'MON' },
      { id: 107, name: 'T KANTHA RAO', desg: 'Sr.CCTC', rest: 'TUE' },
      { id: 108, name: 'BR MEENA', desg: 'Sr.CCTC', rest: 'WED' },
      { id: 109, name: 'T ANKAMMA RAO', desg: 'Sr.CCTC', rest: 'MON' },
      { id: 110, name: 'MV RAMA REDDY', desg: 'Sr.CCTC', rest: 'FRI' },
      { id: 111, name: 'MV ANJANEYULU', desg: 'Sr.CCTC', rest: 'FRI' },
      { id: 112, name: 'SV SIVA KUMAR', desg: 'CCTC', rest: 'SUN' },
      { id: 113, name: 'ELN RAO', desg: 'CCTC', rest: 'MON' },
      { id: 114, name: 'V SRINIVASA RAO', desg: 'CCTC', rest: 'THU' },
      { id: 116, name: 'B P SINGH', desg: 'CCTC', rest: 'WED' },
      { id: 117, name: 'R SAIDA NAIK', desg: 'CCTC', rest: 'THU' },
      { id: 118, name: 'S HYMA TULASI', desg: 'Sr.CCTC', rest: 'THU' },
      { id: 115, name: 'K NAGA NAIK', desg: 'CCTC', rest: '-', isRelieved: true, relievedNote: 'RELIEVED TO ZRTI / MLY' }
    ];

    const staffList = targetStaffOrder.map((t, idx) => {
      const found = allCat4Staff.find(s => s.id === t.id);
      return {
        slNo: idx + 1,
        staffId: t.id,
        name: found?.name || t.name,
        designation: found?.designation || t.desg,
        restDay: found?.rest_day || t.rest,
        isRelieved: !!t.isRelieved,
        relievedNote: t.relievedNote || ''
      };
    });

    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const records = await all(
      'SELECT * FROM lr_sheet_records WHERE date >= ? AND date <= ?',
      [startDateStr, endDateStr]
    );

    const recordsMap = {};
    records.forEach(r => {
      recordsMap[`${r.staff_id}_${r.date}`] = {
        id: r.id,
        dutyCode: r.duty_code,
        remarks: r.remarks || '',
        updatedBy: r.updated_by
      };
    });

    // Real-time synchronization pool: overrides, links, non-daily, duty-register, muster, and daily earnings
    const monthOverrides = await all(`
      SELECT o.*, s1.name as staff_name, s1.category_id as staff_cat
      FROM overrides o
      JOIN staff s1 ON o.staff_id = s1.id
      WHERE o.date >= ? AND o.date <= ?
    `, [startDateStr, endDateStr]);
    const linksList = await all('SELECT * FROM links');
    const nonDailyList = await all('SELECT * FROM non_daily_trains');
    const dutyRegisterEntries = await all(`
      SELECT dre.*, drs.staff_id
      FROM duty_register_entry dre
      JOIN duty_register_staff drs ON dre.id = drs.entry_id
      WHERE dre.date >= ? AND dre.date <= ?
    `, [startDateStr, endDateStr]);
    const musterList = await all(`
      SELECT mr.*
      FROM muster_records mr
      JOIN staff s ON mr.staff_id = s.id
      WHERE s.category_id = 4 AND mr.date >= ? AND mr.date <= ?
    `, [startDateStr, endDateStr]);
    const earningsList = await all(`
      SELECT * FROM daily_earnings_entries
      WHERE date >= ? AND date <= ?
    `, [startDateStr, endDateStr]);

    const dataPool = {
      overrides: monthOverrides,
      links: linksList,
      nonDaily: nonDailyList,
      dutyRegister: dutyRegisterEntries,
      muster: musterList,
      dailyEarnings: earningsList
    };

    // Dynamically overlay live daily duty allotments for LR staff
    for (const staff of staffList) {
      if (staff.isRelieved) continue;
      for (const day of days) {
        const key = `${staff.staffId}_${day.dateStr}`;
        const existing = recordsMap[key];

        const hasDirectOv = monthOverrides.some(o => o.staff_id === staff.staffId && o.date === day.dateStr);
        const hasSubOv = monthOverrides.some(o => o.substitute_staff_id === staff.staffId && o.date === day.dateStr);
        const hasDutyReg = dutyRegisterEntries.some(r => r.staff_id === staff.staffId && r.date === day.dateStr);
        const hasEarn = earningsList.some(e => e.staff_id === staff.staffId && e.date === day.dateStr);
        const hasMuster = musterList.some(m => m.staff_id === staff.staffId && m.date === day.dateStr && ['R', 'CR', 'SICK', 'S', 'CL', 'LAP', 'LHAP', 'CAP', 'L', 'O'].includes(m.code.toUpperCase()));

        // Check multi-day continuation from previous day
        const dObj = new Date(day.dateStr + 'T12:00:00');
        dObj.setDate(dObj.getDate() - 1);
        const prev1Str = dObj.toISOString().split('T')[0];
        const hasPrevOv = monthOverrides.some(o => (o.staff_id === staff.staffId || o.substitute_staff_id === staff.staffId) && o.date === prev1Str);

        // If an override, duty register, daily earnings, or muster record exists:
        const isNonDailyPlaceholder = existing && String(existing.dutyCode).toUpperCase().startsWith('NON DAILY');
        if (hasDirectOv || hasSubOv || hasDutyReg || hasEarn || hasPrevOv || isNonDailyPlaceholder || (!existing && hasMuster)) {
          const resolved = await resolveDutyCodeForLRStaff(staff.staffId, day.dateStr, day.dayOfWeek, staff.restDay, dataPool);
          if (resolved && resolved.code) {
            recordsMap[key] = {
              id: existing?.id || null,
              dutyCode: resolved.code,
              remarks: resolved.remarks || existing?.remarks || '',
              updatedBy: 'Daily Duty Management'
            };
          }
        }

        // Check 8-Hour HQ Rest & Available for Duty status
        const curEntry = recordsMap[key];
        const isRestDay = day.dayOfWeek === staff.restDay;
        const hasDutyOrLeave = curEntry && curEntry.dutyCode && curEntry.dutyCode !== 'SPARE' && curEntry.dutyCode !== 'AVL' && curEntry.dutyCode !== 'REST_HQ';

        if (!hasDutyOrLeave && !isRestDay) {
          const restInfo = await getStaffLastDutyAndRestStatus(staff.staffId, day.dateStr);
          if (restInfo && restInfo.hasLastDuty) {
            if (restInfo.restStatus === 'IN_HQ_REST') {
              recordsMap[key] = {
                id: curEntry?.id || null,
                dutyCode: 'REST_HQ',
                isInHqRest: true,
                remarks: restInfo.remarksText || 'In statutory HQ rest (< 8h required)',
                updatedBy: 'System'
              };
            } else if (restInfo.isAvailableForBooking) {
              recordsMap[key] = {
                id: curEntry?.id || null,
                dutyCode: 'AVL',
                isAvailable: true,
                arrivalTime: restInfo.arrivalTime || null,
                remarks: restInfo.remarksText || 'Min 8h HQ rest completed. Available for Duty booking.',
                updatedBy: 'System'
              };
            }
          } else if (restInfo && !restInfo.hasLastDuty && restInfo.isAvailableForBooking) {
            recordsMap[key] = {
              id: curEntry?.id || null,
              dutyCode: 'AVL',
              isAvailable: true,
              arrivalTime: null,
              remarks: 'LR Standby Pool • Full HQ Rest Available • Ready for Booking',
              updatedBy: 'System'
            };
          }
        }
      }
    }

    const monthDate = new Date(year, month - 1, 1);
    const monthName = monthDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    res.json({
      success: true,
      year,
      month,
      monthName,
      days,
      staff: staffList,
      records: recordsMap
    });
  } catch (err) {
    console.error('Error fetching LR sheet:', err);
    res.status(500).json({ error: err.message });
  }
});

// Centralized helper for bidirectional synchronization when an LR Sheet cell is modified or cleared
async function syncLRSheetCellChange(staffId, dateStr, dutyCode, remarks = '') {
  if (!staffId || !dateStr) return;
  const staff = await get('SELECT * FROM staff WHERE id = ?', [staffId]);
  if (!staff) return;

  const dateParts = dateStr.split('-');
  const altDateStr = dateParts.length === 3 ? `${parseInt(dateParts[2], 10)}/${parseInt(dateParts[1], 10)}/${dateParts[0].slice(-2)}` : dateStr;

  if (!dutyCode || dutyCode.trim() === '') {
    // 1. Cleared / Reset cell
    await run('DELETE FROM lr_sheet_records WHERE staff_id = ? AND date = ?', [staffId, dateStr]);
    await run('DELETE FROM overrides WHERE staff_id = ? AND date = ?', [staffId, dateStr]);
    await run('DELETE FROM muster_records WHERE staff_id = ? AND date = ?', [staffId, dateStr]);
    await restoreMusterTaApprovalsAndEntries(staffId, dateStr, altDateStr);
    return;
  }

  const clean = dutyCode.trim();
  const upper = clean.toUpperCase();

  // 1. Upsert LR Sheet Record
  await run(`
    INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks, updated_by, updated_at)
    VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
    ON CONFLICT(staff_id, date) DO UPDATE SET
      duty_code = excluded.duty_code,
      remarks = excluded.remarks,
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
  `, [staffId, dateStr, clean, remarks || null]);

  // 2. Classify duty code
  const isSick = upper === 'S' || upper === 'SICK';
  const isLeave = ['CL', 'LAP', 'LHAP', 'CCL', 'SCL', 'OD', 'NH', 'L', 'CAP'].includes(upper);
  const isRest = upper === 'R' || upper === 'REST';
  const isCr = upper === 'CR';
  const isAbsent = upper === 'O' || upper === 'ABSENT';
  const isAvailable = ['AVL', 'SPARE', 'REST_HQ', 'STANDBY', 'AVAILABLE'].includes(upper);

  if (isSick || isLeave || isRest || isCr || isAbsent) {
    const musterCode = isSick ? 'SICK' : (isLeave ? (upper === 'L' || upper === 'CAP' ? 'LAP' : upper) : (isRest ? 'R' : (isCr ? 'CR' : 'O')));
    const status = isLeave ? 'LEAVE' : (isSick ? 'SICK' : (isCr ? 'CR' : (isRest ? 'REST' : 'ABSENT')));
    const reason = `LR Sheet: ${clean}${remarks ? ` (${remarks})` : ''}`;
    const leaveType = isLeave ? musterCode : null;

    await run(
      `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id, leave_type)
       VALUES (?, ?, NULL, NULL, ?, ?, 4, ?)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         overridden_link_number = NULL,
         status = excluded.status,
         reason = excluded.reason,
         target_category_id = 4,
         leave_type = excluded.leave_type`,
      [staffId, dateStr, status, reason, leaveType]
    );

    await run(
      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
       VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         code = excluded.code,
         remarks = excluded.remarks,
         updated_by = excluded.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
      [staffId, dateStr, musterCode, reason]
    );

    const disallowRemark = `Disallowed: On Leave/Absent as per LR Sheet (${clean})`;
    await run(
      `UPDATE ta_approvals 
       SET status = 'REJECTED', 
           claim_amount = 0, 
           ta_percentage = NULL, 
           remarks = ?
       WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)`,
      [disallowRemark, staffId, dateStr, dateStr, altDateStr]
    );
    await run(
      `UPDATE ta_entries 
       SET ta_b1 = '', 
           days_claiming_ta = NULL, 
           remarks = ?
       WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?)`,
      [disallowRemark, staffId, dateStr, dateStr, altDateStr]
    );
  } else if (isAvailable) {
    const reason = `LR Standby at HQ: ${clean}${remarks ? ` (${remarks})` : ''}`;
    await run(
      `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id)
       VALUES (?, ?, NULL, NULL, 'AVAILABLE_FOR_BOOKING', ?, 4)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         overridden_link_number = NULL,
         status = 'AVAILABLE_FOR_BOOKING',
         reason = excluded.reason,
         target_category_id = 4`,
      [staffId, dateStr, reason]
    );
    await run(
      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
       VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         code = 'P',
         remarks = excluded.remarks,
         updated_by = excluded.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
      [staffId, dateStr, reason]
    );
    await restoreMusterTaApprovalsAndEntries(staffId, dateStr, altDateStr);
  } else {
    // Train duty (e.g. 12747, 17281, 12734, GTL, etc.)
    const reason = `LR Assigned Train ${clean}${remarks ? ` (${remarks})` : ''}`;
    await run(
      `INSERT INTO overrides (
        staff_id, date, overridden_link_number, status, target_category_id,
        reason, original_link_number, extra_train_no, is_extra,
        shifted_from_link, shifted_from_train, shifted_place,
        advance_train_no, is_advance_duty
      ) VALUES (?, ?, NULL, 'EXTRA_CREW', 4, ?, NULL, ?, 1, NULL, NULL, 'LR_SHEET', NULL, 0)
      ON CONFLICT(staff_id, date) DO UPDATE SET
        overridden_link_number = NULL,
        status = 'EXTRA_CREW',
        target_category_id = 4,
        reason = excluded.reason,
        extra_train_no = excluded.extra_train_no,
        is_extra = 1,
        shifted_place = 'LR_SHEET'`,
      [staffId, dateStr, reason, clean]
    );
    await run(
      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
       VALUES (?, ?, 'P', ?, 'Admin', CURRENT_TIMESTAMP)
       ON CONFLICT(staff_id, date) DO UPDATE SET
         code = 'P',
         remarks = excluded.remarks,
         updated_by = excluded.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
      [staffId, dateStr, reason]
    );

    await run(
      `DELETE FROM ta_approvals WHERE staff_id = ? AND (duty_date = ? OR date_str = ? OR date_str = ?) AND (status = 'PENDING' OR remarks LIKE 'Disallowed%')`,
      [staffId, dateStr, dateStr, altDateStr]
    );
    const y = parseInt(dateParts[0], 10);
    const m = parseInt(dateParts[1], 10);
    try {
      const { generatePendingTaClaimsForMonth } = require('./ta_generator');
      await generatePendingTaClaimsForMonth({ run, get, all }, y, m, staffId);
    } catch (err) {
      console.warn('Error regenerating TA claims in LR sync:', err.message);
    }
  }
}

// POST /api/lr-sheet/cell - Update or clear duty cell for an LR staff (Universally synchronized)
app.post('/api/lr-sheet/cell', requireAdmin, async (req, res) => {
  try {
    const { staff_id, date, duty_code, remarks } = req.body;
    if (!staff_id || !date) {
      return res.status(400).json({ error: 'staff_id and date are required' });
    }

    await syncLRSheetCellChange(staff_id, date, duty_code, remarks);

    await logAudit('Admin', 'LR_CELL_UPDATE', `Updated LR duty cell for staff ID ${staff_id} on ${date} to '${duty_code || 'CLEARED'}'`);
    res.json({ success: true, message: `Updated and synchronized LR cell for ${date}` });
  } catch (err) {
    console.error('Error updating LR cell:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/lr-sheet/batch-update - Batch update multiple LR cells (Universally synchronized)
app.post('/api/lr-sheet/batch-update', requireAdmin, async (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Array of updates required' });
    }

    await run('BEGIN TRANSACTION');
    for (const item of updates) {
      if (!item.staff_id || !item.date) continue;
      await syncLRSheetCellChange(item.staff_id, item.date, item.duty_code, item.remarks);
    }
    await run('COMMIT');

    await logAudit('Admin', 'LR_BATCH_UPDATE', `Batch updated ${updates.length} LR records with universal sync`);
    res.json({ success: true, message: `Successfully updated and synchronized ${updates.length} records` });
  } catch (err) {
    await run('ROLLBACK');
    console.error('Error batch updating LR records:', err);
    res.status(500).json({ error: err.message });
  }
});

// Serve compiled frontend in production (Single-Server Cloud Architecture)
const possibleDistPaths = [
  path.join(__dirname, '..', 'frontend', 'dist'),
  path.join(process.cwd(), 'src', 'frontend', 'dist'),
  path.join(process.cwd(), 'dist'),
  path.join(__dirname, 'dist')
];

let frontendDistPath = possibleDistPaths.find(p => fs.existsSync(path.join(p, 'index.html')));

// Disable caching for HTML and Service Worker so asset hash updates load instantly
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html') || req.path === '/sw.js') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

if (frontendDistPath) {
  console.log(`[Production] Serving frontend from: ${frontendDistPath}`);
  app.use(express.static(frontendDistPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  console.warn('[Production] Frontend dist directory not found yet.');
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Railway Duty Roster Manager</title>
        <meta http-equiv="refresh" content="5">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0D0D0F; color: #F2F0EB; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1A1A1D; border: 1px solid #D4A15C; border-radius: 16px; padding: 32px; max-width: 480px; text-align: center; box-shadow: 0 12px 40px rgba(0,0,0,0.7); }
          h2 { color: #D4A15C; margin-top: 0; }
          .btn { background: #D4A15C; color: #0D0D0F; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; text-decoration: none; display: inline-block; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>🚆 Railway Duty Roster Manager</h2>
          <p>The backend server is online! Frontend assets are initializing. This page will refresh automatically in 5 seconds...</p>
          <a class="btn" href="javascript:location.reload()">Refresh Page</a>
        </div>
      </body>
      </html>
    `);
  });
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Roster backend server is running on port ${PORT}`);
});
