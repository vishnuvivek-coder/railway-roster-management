import { getDayOffset, getBaseLinkNumber } from './rotation';

export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export type WeekdayName = typeof WEEKDAY_NAMES[number];

export interface RestAdjustmentItem {
  date: string;
  linkNumber: number | null;
  status: string;
  isRest: boolean;
  originalLinkNumber: number | null;
  reason: string;
}

export interface ComputeRestAdjustmentParams {
  staffRowPosition: number;
  anchorDateStr: string;
  cycleLength: number;
  scheduledRestDateStr: string;
  newRestDateStr: string;
  mode?: 'SHIFT' | 'SWAP';
  restLinks?: number[];
}

// Helper to format Date into YYYY-MM-DD using local time (avoid UTC shifting)
export function formatDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Add days safely without timezone drift
export function addDays(dateStr: string, days: number): string {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2] + days);
  return formatDateLocal(d);
}

// Get 3-letter weekday name
export function getWeekday(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return WEEKDAY_NAMES[d.getDay()];
}

// Check if a link number represents REST
export function isLinkRest(linkNum: number, cycleLength: number, restLinkNumbers: number[] | null = null): boolean {
  if (restLinkNumbers && Array.isArray(restLinkNumbers) && restLinkNumbers.length > 0) {
    return restLinkNumbers.includes(linkNum);
  }
  // Default: every 7th link in cyclic rotation is rest
  return linkNum % 7 === 0;
}

/**
 * Finds the scheduled rest date for a staff member nearest to targetDateStr (within +-6 days).
 */
export function findScheduledRestDate(
  staffRowPosition: number,
  targetDateStr: string,
  anchorDateStr: string,
  cycleLength: number,
  restLinks: number[] = [7, 14, 21]
): string {
  const targetOffset = getDayOffset(anchorDateStr, targetDateStr);
  
  let bestDate: string | null = null;
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
 */
export function computeRestAdjustment({
  staffRowPosition,
  anchorDateStr,
  cycleLength,
  scheduledRestDateStr,
  newRestDateStr,
  mode = 'SHIFT',
  restLinks = [7, 14, 21]
}: ComputeRestAdjustmentParams): RestAdjustmentItem[] {
  if (scheduledRestDateStr === newRestDateStr) {
    return [];
  }

  const dStart = scheduledRestDateStr < newRestDateStr ? scheduledRestDateStr : newRestDateStr;
  const dEnd = scheduledRestDateStr < newRestDateStr ? newRestDateStr : scheduledRestDateStr;

  // Build the list of affected calendar dates in chronological order
  const affectedDates: Array<{
    date: string;
    dayOffset: number;
    weekday: string;
    origLink: number;
    origIsRest: boolean;
  }> = [];
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

  const adjustments: RestAdjustmentItem[] = [];

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
export function getWeeklyRestWeekday(
  staffRowPosition: number,
  anchorDateStr: string,
  cycleLength: number,
  restLinks: number[] = [7, 14, 21]
): string {
  const targetDateStr = anchorDateStr; // Start from anchor date
  const restDate = findScheduledRestDate(staffRowPosition, targetDateStr, anchorDateStr, cycleLength, restLinks);
  return getWeekday(restDate);
}

// CommonJS backward compatibility
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
