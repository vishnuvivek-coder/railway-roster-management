// Helper to calculate days between two YYYY-MM-DD strings (1-based offset)
function getDayOffset(anchorDateStr, targetDateStr) {
  const d1 = new Date(anchorDateStr + 'T00:00:00');
  const d2 = new Date(targetDateStr + 'T00:00:00');
  const diffMs = d2 - d1;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays + 1; // Anchor date itself is Day 1
}

// Calculate the base link number using the rotation formula
function getBaseLinkNumber(rowPosition, dayOffset, cycleLength) {
  // ((person_row - 1) + (day_offset - 1)) mod cycle_length + 1
  const result = ((rowPosition - 1) + (dayOffset - 1)) % cycleLength;
  // Handle potential negative offsets (mod wraps correctly in JS)
  const wrapped = result < 0 ? (result + cycleLength) : result;
  return wrapped + 1;
}

module.exports = {
  getDayOffset,
  getBaseLinkNumber
};
