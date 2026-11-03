const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'frontend', 'src', 'App.tsx');
let content = fs.readFileSync(appPath, 'utf8');

const novSlotsDef = `
// Master Daily Slots for November 2026 onwards (Matching physical register Pages 110 & 111)
export const NOV_2026_MASTER_DAILY_SLOTS = [
  // 1. Train 17253 / 17252 (GNT ➔ DHNE ➔ GNT) [Page 110 Row 1]
  {
    slotId: 1,
    page: 110,
    firstTrain: '17253',
    lastTrain: '17252',
    title: '17253 / 17252 (Guntur – Dhone Express: GNT ➔ DHNE)',
    links: [
      { categoryId: 2, linkNum: 15, firstCoach: 'AC + SL', lastTrain: '17252', lastCoach: 'AC + SL' }
    ]
  },
  // 2. Train 17239 / 17240 (Simhadri Express: GNT ➔ VSKP) [Page 110 Row 2]
  {
    slotId: 2,
    page: 110,
    firstTrain: '17239',
    lastTrain: '17240',
    title: '17239 / 17240 (Simhadri Express: GNT ➔ VSKP)',
    links: [
      { categoryId: 2, linkNum: 1, firstCoach: 'AC + 2S', lastTrain: '17240', lastCoach: 'AC + 2S' }
    ]
  },
  // 3. Train 17646 / 12796 (GNT ➔ SC ➔ BZA) [Page 110 Row 3]
  {
    slotId: 3,
    page: 110,
    firstTrain: '17646',
    lastTrain: '12796',
    title: '17646 / 12796 (GNT ➔ SC ➔ BZA)',
    links: [
      { categoryId: 2, linkNum: 17, firstCoach: 'AC + SL', lastTrain: '12796', lastCoach: 'AC + 2S' }
    ]
  },
  // 4. Train 12805 / 12806 (Janmabhoomi Express: GNT ➔ SC) [Page 110 Row 4]
  {
    slotId: 4,
    page: 110,
    firstTrain: '12805',
    lastTrain: '12806',
    title: '12805 / 12806 (Janmabhoomi Express: GNT ➔ SC)',
    links: [
      { categoryId: 2, linkNum: 19, firstCoach: 'AC / D1-D2', lastTrain: '12806', lastCoach: 'AC / D1-D2' }
    ]
  },
  // 5. Train 12795 / 17645 (Intercity Express: GNT ➔ BZA ➔ SC) [Page 110 Row 5]
  {
    slotId: 5,
    page: 110,
    firstTrain: '12795',
    lastTrain: '17645',
    title: '12795 / 17645 (Intercity Express: GNT ➔ BZA ➔ SC)',
    links: [
      { categoryId: 2, linkNum: 40, firstCoach: 'AC + 2S', lastTrain: '17645', lastCoach: 'AC + SL' }
    ]
  },
  // 6. Train 17251 / 17254 (Dhone Express: GNT ➔ DHNE) [Page 110 Row 6]
  {
    slotId: 6,
    page: 110,
    firstTrain: '17251',
    lastTrain: '17254',
    title: '17251 / 17254 (Dhone Express: GNT ➔ DHNE)',
    links: [
      { categoryId: 2, linkNum: 5, firstCoach: 'AC + SL', lastTrain: '17254', lastCoach: 'AC + SL' }
    ]
  },
  // 7. Train 17281 / 17282 (GNT ➔ NS Express) [Page 110 Row 7]
  {
    slotId: 7,
    page: 110,
    firstTrain: '17281',
    lastTrain: '17282',
    title: '17281 / 17282 (GNT ➔ NS Express)',
    links: [
      { categoryId: 2, linkNum: 38, firstCoach: '2S', lastTrain: '17282', lastCoach: '2S' }
    ]
  },
  // 8. Train 17261 / 12733 / 17262 (GNT ➔ TPTY) [Page 110 Row 8]
  {
    slotId: 8,
    page: 110,
    firstTrain: '17261',
    lastTrain: '12733',
    title: '17261 / 12733 / 17262 (GNT ➔ TPTY)',
    links: [
      { categoryId: 1, linkNum: 4, firstCoach: 'AC', lastTrain: '12733', lastCoach: 'COR-2' },
      { categoryId: 3, linkNum: 1, firstCoach: 'SL', lastTrain: '17262', lastCoach: 'SL' }
    ]
  },
  // 9. Train 20629 / 12733 / 20630 (Tirupati Express: GNT ➔ TPTY) [Page 110 Row 9]
  {
    slotId: 9,
    page: 110,
    firstTrain: '20629',
    lastTrain: '12733',
    title: '20629 / 12733 / 20630 (Tirupati Express: GNT ➔ TPTY)',
    links: [
      { categoryId: 1, linkNum: 8, firstCoach: 'AC', lastTrain: '12733', lastCoach: 'COR-1' },
      { categoryId: 2, linkNum: 36, firstCoach: 'SL', lastTrain: '12733', lastCoach: 'SL' },
      { categoryId: 2, linkNum: 22, firstCoach: 'SL', lastTrain: '20630', lastCoach: 'SL' }
    ]
  },
  // 10. Train 17225 / 17226 (Amaravati Express: BZA ➔ GTL) [Page 110 Row 10]
  {
    slotId: 10,
    page: 110,
    firstTrain: '17225',
    lastTrain: '17226',
    title: '17225 / 17226 (Amaravati Express: BZA ➔ GTL)',
    links: [
      { categoryId: 1, linkNum: 1, firstCoach: 'AC', lastTrain: '17226', lastCoach: 'AC' },
      { categoryId: 2, linkNum: 11, firstCoach: 'SL', lastTrain: '17226', lastCoach: 'SL' }
    ]
  },
  // 11. Train 18047 / 17226 (Amaravati Express: BZA ➔ GTL) [Page 110 Row 11]
  {
    slotId: 11,
    page: 110,
    firstTrain: '18047',
    lastTrain: '17226',
    title: '18047 / 17226 (Amaravati Express: BZA ➔ GTL)',
    links: [
      { categoryId: 2, linkNum: 50, firstCoach: 'AC', lastTrain: '17226', lastCoach: 'SL' },
      { categoryId: 2, linkNum: 25, firstCoach: 'SL', lastTrain: '17226', lastCoach: 'SL' }
    ]
  },
  // 12. Train 17626 / 17625 (Circar Express: GNT ➔ RAL ➔ SC) [Page 110 Row 12]
  {
    slotId: 12,
    page: 110,
    firstTrain: '17626',
    lastTrain: '17625',
    title: '17626 / 17625 (Circar Express: GNT ➔ RAL ➔ SC)',
    links: [
      { categoryId: 2, linkNum: 43, firstCoach: 'AC + SL', lastTrain: '17625', lastCoach: 'AC + SL' },
      { categoryId: 2, linkNum: 29, firstCoach: 'SL', lastTrain: '17625', lastCoach: 'SL' }
    ]
  },
  // 13. Train 12604 / 12603 (Chennai Express: GNT ➔ MAS) [Page 111 Row 13]
  {
    slotId: 13,
    page: 111,
    firstTrain: '12604',
    lastTrain: '12603',
    title: '12604 / 12603 (Chennai Express: GNT ➔ MAS)',
    links: [
      { categoryId: 1, linkNum: 12, firstCoach: 'AC', lastTrain: '12603', lastCoach: 'AC' },
      { categoryId: 2, linkNum: 3, firstCoach: 'SL', lastTrain: '12603', lastCoach: 'SL' },
      { categoryId: 2, linkNum: 4, firstCoach: 'SL', lastTrain: '12603', lastCoach: 'SL' }
    ]
  },
  // 14. Train 12734 / 20630 / 17262 (Narayanadri Express AC: GNT ➔ TPTY) [Page 111 Row 14]
  {
    slotId: 14,
    page: 111,
    firstTrain: '12734',
    lastTrain: '20630',
    title: '12734 / 20630 / 17262 (Narayanadri Express AC: GNT ➔ TPTY)',
    links: [
      { categoryId: 1, linkNum: 10, firstCoach: 'COR-1', lastTrain: '20630', lastCoach: 'AC' },
      { categoryId: 1, linkNum: 18, firstCoach: 'COR-2', lastTrain: '17262', lastCoach: 'AC' }
    ]
  },
  // 15. Train 12734 / 20630 (Narayanadri Express Sleeper: GNT ➔ TPTY) [Page 111 Row 15]
  {
    slotId: 15,
    page: 111,
    firstTrain: '12734',
    lastTrain: '20630',
    title: '12734 / 20630 (Narayanadri Express Sleeper: GNT ➔ TPTY)',
    links: [
      { categoryId: 2, linkNum: 8, firstCoach: 'SL', lastTrain: '20630', lastCoach: 'SL' }
    ]
  },
  // 16. Train 17243 / 17244 (Rayagada Express: GNT ➔ VSKP) [Page 111 Row 16]
  {
    slotId: 16,
    page: 111,
    firstTrain: '17243',
    lastTrain: '17244',
    title: '17243 / 17244 (Rayagada Express: GNT ➔ VSKP)',
    links: [
      { categoryId: 2, linkNum: 32, firstCoach: 'AC + SL', lastTrain: '17244', lastCoach: 'AC + SL' },
      { categoryId: 2, linkNum: 46, firstCoach: 'SL', lastTrain: '17244', lastCoach: 'SL' }
    ]
  },
  // 17. Train 07811 / 07812 [Page 111 Row 17]
  {
    slotId: 17,
    page: 111,
    firstTrain: '07811',
    lastTrain: '07812',
    title: '07811 / 07812 (Special Express)',
    links: [
      { categoryId: 2, linkNum: 51, firstCoach: 'AC', lastTrain: '07812', lastCoach: 'AC' }
    ]
  },
  // 18. Train 17231 / 17232 [Page 111 Row 18]
  {
    slotId: 18,
    page: 111,
    firstTrain: '17231',
    lastTrain: '17232',
    title: '17231 / 17232 (Express)',
    links: [
      { categoryId: 2, linkNum: 52, firstCoach: 'AC + SL', lastTrain: '17232', lastCoach: 'AC + SL' }
    ]
  },
  // 19. Train 07487 / 07488 [Page 111 Row 19]
  {
    slotId: 19,
    page: 111,
    firstTrain: '07487',
    lastTrain: '07488',
    title: '07487 / 07488 (Special Express)',
    links: [
      { categoryId: 2, linkNum: 53, firstCoach: 'AC + SL', lastTrain: '07488', lastCoach: 'AC + SL' }
    ]
  },
  // 20. Train 07193 / 07194 [Page 111 Row 20]
  {
    slotId: 20,
    page: 111,
    firstTrain: '07193',
    lastTrain: '07194',
    title: '07193 / 07194 (Special Express)',
    links: [
      { categoryId: 2, linkNum: 54, firstCoach: 'AC + SL', lastTrain: '07194', lastCoach: 'AC + SL' }
    ]
  }
];
`;

// Insert NOV_2026_MASTER_DAILY_SLOTS before export const LEGACY_MASTER_DAILY_SLOTS
const legacyTarget = 'export const LEGACY_MASTER_DAILY_SLOTS = [';
if (content.includes(legacyTarget)) {
  content = content.replace(legacyTarget, novSlotsDef + '\n' + legacyTarget);
  console.log('Inserted NOV_2026_MASTER_DAILY_SLOTS');
} else {
  console.error('legacyTarget not found');
}

// Update getMasterDailySlots
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

// Update ALL_MASTER_SLOTS
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

fs.writeFileSync(appPath, content, 'utf8');
console.log('Applied frontend Nov slots successfully.');
