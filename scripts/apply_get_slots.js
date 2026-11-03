const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'frontend', 'src', 'App.tsx');
let content = fs.readFileSync(appPath, 'utf8');

// Normalize line endings to \n for matching
const isCRLF = content.includes('\r\n');
if (isCRLF) {
  content = content.replace(/\r\n/g, '\n');
}

const oldGetSlots = `export function getMasterDailySlots(dateStr) {
  const baseSlots = (dateStr && dateStr < '2026-10-01')
    ? LEGACY_MASTER_DAILY_SLOTS
    : OCT_2026_MASTER_DAILY_SLOTS;`;

const newGetSlots = `export function getMasterDailySlots(dateStr) {
  if (dateStr && dateStr >= '2026-11-01') {
    return NOV_2026_MASTER_DAILY_SLOTS;
  }
  const baseSlots = (dateStr && dateStr < '2026-10-01')
    ? LEGACY_MASTER_DAILY_SLOTS
    : OCT_2026_MASTER_DAILY_SLOTS;`;

if (content.includes(oldGetSlots)) {
  content = content.replace(oldGetSlots, newGetSlots);
  console.log('Updated getMasterDailySlots');
} else {
  console.error('oldGetSlots not found');
}

const oldAllSlots = `const ALL_MASTER_SLOTS = [
  ...OCT_2026_MASTER_DAILY_SLOTS,
  ...OCT_2026_NON_DAILY_SLOTS,
  ...LEGACY_MASTER_DAILY_SLOTS,
  ...LEGACY_NON_DAILY_SLOTS
];`;

const newAllSlots = `const ALL_MASTER_SLOTS = [
  ...NOV_2026_MASTER_DAILY_SLOTS,
  ...OCT_2026_MASTER_DAILY_SLOTS,
  ...OCT_2026_NON_DAILY_SLOTS,
  ...LEGACY_MASTER_DAILY_SLOTS,
  ...LEGACY_NON_DAILY_SLOTS
];`;

if (content.includes(oldAllSlots)) {
  content = content.replace(oldAllSlots, newAllSlots);
  console.log('Updated ALL_MASTER_SLOTS');
} else {
  console.error('oldAllSlots not found');
}

if (isCRLF) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(appPath, content, 'utf8');
console.log('Saved App.tsx successfully');
