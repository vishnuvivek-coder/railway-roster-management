/**
 * Helper to calculate days between two YYYY-MM-DD strings (1-based offset)
 */
export function getDayOffset(anchorDateStr: string, targetDateStr: string): number {
  const d1 = new Date(anchorDateStr + 'T00:00:00');
  const d2 = new Date(targetDateStr + 'T00:00:00');
  const diffMs = d2.getTime() - d1.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays + 1; // Anchor date itself is Day 1
}

/**
 * Calculate the base link number using the rotation formula
 */
export function getBaseLinkNumber(rowPosition: number, dayOffset: number, cycleLength: number): number {
  // ((person_row - 1) + (day_offset - 1)) mod cycle_length + 1
  const result = ((rowPosition - 1) + (dayOffset - 1)) % cycleLength;
  // Handle potential negative offsets (mod wraps correctly in JS)
  const wrapped = result < 0 ? (result + cycleLength) : result;
  return wrapped + 1;
}

/**
 * Returns date-aware anchor_date and cycle_length for a category based on the duty date.
 * Isolates October 2026 and prior from November 2026 onwards.
 */
export function getCategoryParamsForDate(cat: any, dateStr: string | null): { anchor_date: string; cycle_length: number } {
  if (!cat) return { anchor_date: '2020-01-01', cycle_length: 21 };
  const catId = typeof cat === 'number' ? cat : (cat.id || (cat.code === 'TTI_SLEEPER' ? 2 : (cat.code === 'COR' ? 1 : (cat.code === 'LADIES_TTE' ? 3 : 4))));

  if (catId === 1 || cat.code === 'COR') {
    if (dateStr && dateStr < '2026-11-01') {
      return { anchor_date: '2026-10-01', cycle_length: 21 };
    }
    return { anchor_date: '2026-11-01', cycle_length: 21 };
  }

  if (catId === 2 || cat.code === 'TTI_SLEEPER') {
    if (dateStr && dateStr < '2026-10-01') {
      return { anchor_date: '2026-08-01', cycle_length: 63 };
    } else if (dateStr && dateStr < '2026-11-01') {
      return { anchor_date: '2026-10-01', cycle_length: 56 };
    } else {
      return { anchor_date: '2026-11-01', cycle_length: 56 };
    }
  }

  if (catId === 3 || cat.code === 'LADIES_TTE') {
    if (dateStr && dateStr < '2026-11-01') {
      return { anchor_date: '2026-10-01', cycle_length: 7 };
    }
    return { anchor_date: '2026-11-01', cycle_length: 7 };
  }

  if (catId === 4 || cat.code === 'LR') {
    return { anchor_date: '2026-10-01', cycle_length: 21 };
  }

  return { anchor_date: cat.anchor_date || '2026-10-01', cycle_length: cat.cycle_length || 21 };
}

// CommonJS backward compatibility
module.exports = {
  getDayOffset,
  getBaseLinkNumber,
  getCategoryParamsForDate
};
