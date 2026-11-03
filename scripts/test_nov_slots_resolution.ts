const http = require('http');

const NOV_2026_MASTER_DAILY_SLOTS = [
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

http.get('http://127.0.0.1:5000/api/reports/daily-view?date=2026-11-01', (res) => {
  let raw = '';
  res.on('data', chunk => raw += chunk);
  res.on('end', () => {
    const data = JSON.parse(raw);
    const staffDuties = (data.categories || []).flatMap(c => (c.staff || []).map(s => ({ ...s, categoryId: c.categoryId })));

    const activeWorkedStaffIds = new Set();
    const resolvedRows = [];

    NOV_2026_MASTER_DAILY_SLOTS.forEach(slot => {
      const dutiesInSlot = [];
      slot.links.forEach(lDef => {
        const matchesTrainBooking = (duty) => {
          if (!duty) return false;
          if (duty.status !== 'DUTY' && duty.status !== 'SUBSTITUTE') return false;
          const dTrain = duty.train_out ? String(duty.train_out).trim() : null;
          const dNums = duty.train_numbers ? String(duty.train_numbers).trim() : null;
          const sFirst = String(slot.firstTrain || '').trim();

          const trainMatches = (dTrain && (dTrain === sFirst || (sFirst && dTrain.includes(sFirst)))) ||
            (sFirst && dNums && (dNums === sFirst || dNums.startsWith(sFirst + ',') || dNums.startsWith(sFirst + ' ') || dNums.startsWith(sFirst + '/')));
          if (!trainMatches) return false;

          const targetCat = duty.target_category_id != null ? parseInt(duty.target_category_id, 10) : (duty.categoryId === 1 ? 1 : (duty.categoryId === 3 ? 3 : 2));
          const slotCat = parseInt(lDef.categoryId, 10);
          if (slotCat === 1) {
            return targetCat === 1 || duty.categoryId === 1 || (duty.coach_out && duty.coach_out.toUpperCase().includes('COR'));
          } else if (slotCat === 3) {
            return targetCat === 3 || duty.categoryId === 3;
          } else {
            return targetCat === 2 || duty.categoryId === 2 || duty.categoryId === 4;
          }
        };

        let staffDuty = staffDuties.find(d => 
          !activeWorkedStaffIds.has(d.staffId) &&
          matchesTrainBooking(d) &&
          d.name && !d.name.includes('VACANT') && d.name.trim() !== 'V' && !d.isVacant
        );

        if (staffDuty) {
          activeWorkedStaffIds.add(staffDuty.staffId);
          dutiesInSlot.push({
            staffId: staffDuty.staffId,
            name: staffDuty.name,
            train_out: staffDuty.train_out || slot.firstTrain,
            coach_out: staffDuty.coach_out || lDef.firstCoach,
            train_return: staffDuty.train_return || slot.lastTrain,
            coach_return: staffDuty.coach_return || lDef.lastCoach
          });
        }
      });

      resolvedRows.push({
        slotId: slot.slotId,
        title: slot.title,
        duties: dutiesInSlot
      });
    });

    console.log(`\n=== RESOLVED 20 ROWS FOR NOVEMBER 1, 2026 ===`);
    let totalDuties = 0;
    resolvedRows.forEach((r, idx) => {
      console.log(`Row ${idx + 1} (Slot ${r.slotId}): ${r.title}`);
      r.duties.forEach(d => {
        totalDuties++;
        console.log(`   Staff: ${d.name} (${d.staffId}) -> Out: ${d.train_out} [${d.coach_out}] | Ret: ${d.train_return} [${d.coach_return}]`);
      });
    });

    console.log(`\nTotal duties placed into the 20 slots: ${totalDuties} / 30`);
  });
});
