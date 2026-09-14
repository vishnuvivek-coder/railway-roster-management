const { getDayOffset, getBaseLinkNumber } = require('./rotation');

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Helper to format Date into YYYY-MM-DD using local time (avoid UTC shifting)
function formatDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Add days safely without timezone drift
function addDays(dateStr, days) {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2] + days);
  return formatDateLocal(d);
}

// Get 3-letter weekday name
function getWeekday(dateStr) {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return WEEKDAY_NAMES[d.getDay()];
}

// Check if a link number represents REST
function isLinkRest(linkNum, cycleLength, restLinkNumbers = null) {
  if (restLinkNumbers && Array.isArray(restLinkNumbers) && restLinkNumbers.length > 0) {
    return restLinkNumbers.includes(linkNum);
  }
  // Default: every 7th link in cyclic rotation is rest
  return linkNum % 7 === 0;
}

/**
 * Finds the scheduled rest date for a staff member nearest to targetDateStr (within +-6 days).
 */
function findScheduledRestDate(staffRowPosition, targetDateStr, anchorDateStr, cycleLength, restLinks = [7, 14, 21]) {
  const targetOffset = getDayOffset(anchorDateStr, targetDateStr);
  
  let bestDate = null;
  let minDiff = Infinity;

  for (let offsetDiff = -6; offsetDiff <= 6; offsetDiff++) {
    const curOffset = targetOffset + offsetDiff;
    const link = getBaseLinkNumber(staffRowPosition, curOffset, cycleLength);
    if (isLinkRest(link, cycleLength, restLinks)) {
      if (Math.abs(offsetDiff) < minDiff) {
        minDiff = Math.abs(offsetDiff);
        bestDate = addDays(targetDateStr, offsetDiff);
      }
    }
  }

  return bestDate || targetDateStr;
}

/**
 * Computes the link adjustments when rest day is moved between scheduledRestDateStr and newRestDateStr.
 * 
 * Supports two modes:
 * - 'SHIFT' (default): Shifts the intervening duty links so all duties (1..6) are worked in order.
 * - 'SWAP': Direct swap between newRestDateStr and scheduledRestDateStr.
 */
function computeRestAdjustment({
  staffRowPosition,
  anchorDateStr,
  cycleLength,
  scheduledRestDateStr,
  newRestDateStr,
  mode = 'SHIFT',
  restLinks = [7, 14, 21]
}) {
  if (scheduledRestDateStr === newRestDateStr) {
    return [];
  }

  const dStart = scheduledRestDateStr < newRestDateStr ? scheduledRestDateStr : newRestDateStr;
  const dEnd = scheduledRestDateStr < newRestDateStr ? newRestDateStr : scheduledRestDateStr;

  // Build the list of affected calendar dates in chronological order
  const affectedDates = [];
  let curDate = dStart;
  while (curDate <= dEnd) {
    const offset = getDayOffset(anchorDateStr, curDate);
    const origLink = getBaseLinkNumber(staffRowPosition, offset, cycleLength);
    const origIsRest = isLinkRest(origLink, cycleLength, restLinks);
    affectedDates.push({
      date: curDate,
      dayOffset: offset,
      weekday: getWeekday(curDate),
      origLink,
      origIsRest
    });
    curDate = addDays(curDate, 1);
  }

  const adjustments = [];

  if (mode === 'SWAP') {
    const newRestDay = affectedDates.find(d => d.date === newRestDateStr);
    const scheduledRestDay = affectedDates.find(d => d.date === scheduledRestDateStr);
    const dutyToWorkOnOldRest = newRestDay ? newRestDay.origLink : null;

    adjustments.push({
      date: newRestDateStr,
      linkNumber: null,
      status: 'REST',
      isRest: true,
      originalLinkNumber: newRestDay ? newRestDay.origLink : null,
      reason: `Rest day moved from ${scheduledRestDateStr} (Swap)`
    });

    adjustments.push({
      date: scheduledRestDateStr,
      linkNumber: dutyToWorkOnOldRest,
      status: 'DUTY',
      isRest: false,
      originalLinkNumber: scheduledRestDay ? scheduledRestDay.origLink : null,
      reason: `Duty Link #${dutyToWorkOnOldRest} worked in exchange for rest on ${newRestDateStr} (Swap)`
    });
  } else {
    // Mode: SHIFT
    // Extract the duty links in chronological order from affected dates (excluding the original rest slot)
    const dutyLinksInOrder = affectedDates.filter(d => !d.origIsRest).map(d => d.origLink);
    
    let dutyIdx = 0;
    for (const d of affectedDates) {
      if (d.date === newRestDateStr) {
        adjustments.push({
          date: d.date,
          linkNumber: null,
          status: 'REST',
          isRest: true,
          originalLinkNumber: d.origLink,
          reason: `Rest day moved from ${scheduledRestDateStr} (Shift adjustment)`
        });
      } else {
        const assignedLink = dutyLinksInOrder[dutyIdx++];
        adjustments.push({
          date: d.date,
          linkNumber: assignedLink,
          status: d.origIsRest ? 'DUTY' : (assignedLink !== d.origLink ? 'CHANGED_LINK' : 'DUTY'),
          isRest: false,
          originalLinkNumber: d.origLink,
          reason: d.origIsRest
            ? `Duty Link #${assignedLink} worked on scheduled rest day (Shift adjustment)`
            : (assignedLink !== d.origLink ? `Link #${assignedLink} adjusted due to rest move to ${newRestDateStr}` : 'Normal Duty')
        });
      }
    }
  }

  return adjustments;
}

/**
 * Returns the weekday of regular weekly rest for a given row position.
 */
function getWeeklyRestWeekday(staffRowPosition, anchorDateStr, cycleLength, restLinks = [7, 14, 21]) {
  const targetDateStr = anchorDateStr; // Start from anchor date
  const restDate = findScheduledRestDate(staffRowPosition, targetDateStr, anchorDateStr, cycleLength, restLinks);
  return getWeekday(restDate);
}

module.exports = {
  WEEKDAY_NAMES,
  formatDateLocal,
  addDays,
  getWeekday,
  isLinkRest,
  findScheduledRestDate,
  computeRestAdjustment,
  getWeeklyRestWeekday
};
