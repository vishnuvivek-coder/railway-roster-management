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

// CommonJS backward compatibility
module.exports = {
  getDayOffset,
  getBaseLinkNumber
};
