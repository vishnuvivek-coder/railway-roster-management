const http = require('http');

http.get('http://127.0.0.1:5000/api/reports/daily-view?date=2026-11-01', (res) => {
  let raw = '';
  res.on('data', chunk => raw += chunk);
  res.on('end', () => {
    const data = JSON.parse(raw);
    const staffDuties = (data.categories || []).flatMap(c => (c.staff || []).map(s => ({ ...s, categoryId: c.categoryId })));

    console.log('Total duties in daily-view:', staffDuties.length);

    // Check each of the 20 rows corresponding to Pages 110 & 111
    const expectedSlots = [
      { row: 1, trains: '17253 / 17252', staff: ['R SAIDA NAIK'] },
      { row: 2, trains: '17239 / 17240', staff: ['NC MEENA'] },
      { row: 3, trains: '17646 / 12796', staff: ['N KISHAN KUMAR'] },
      { row: 4, trains: '12805 / 12806', staff: ['RNR NAIK'] },
      { row: 5, trains: '12795 / 17645', staff: ['AG KRISHNA'] },
      { row: 6, trains: '17251 / 17254', staff: ['K KRANTHI KUMAR'] },
      { row: 7, trains: '17281 / 17282', staff: ['MV ANJANEYULU'] },
      { row: 8, trains: '17261 / 12733 / 17262', staff: ['KRM REDDY', 'B KEZIA KUMARI'] },
      { row: 9, trains: '20629 / 12733 / 20630', staff: ['K V RAMANA RAO', 'D VANIL KUMAR', 'M SURESH'] },
      { row: 10, trains: '17225 / 17226', staff: ['I DASARADHI', 'BR MEENA'] },
      { row: 11, trains: '18047 / 17226', staff: ['Y KORNELU BABU', 'SUVVADA SRINU'] },
      { row: 12, trains: '17626 / 17625', staff: ['PV SUBBA RAO', 'M VENKATESWARLU'] },
      { row: 13, trains: '12604 / 12603', staff: ['S NAGALINGAPPA', 'SK JHA', 'K DANIAL'] },
      { row: 14, trains: '12734 / 20630 / 17262', staff: ['BRK REDDY', 'VAN REDDY'] },
      { row: 15, trains: '12734 / 20630', staff: ['BVS REDDY'] },
      { row: 16, trains: '17243 / 17244', staff: ['K DURGA RAO', 'MVS NAGI REDDY'] },
      { row: 17, trains: '07811 / 07812', staff: ['T KANTHA RAO'] },
      { row: 18, trains: '17231 / 17232', staff: ['V SRINIVASA RAO'] },
      { row: 19, trains: '07487 / 07488', staff: ['K KOTI REDDY'] },
      { row: 20, trains: '07193 / 07194', staff: ['S SUBRAHMANYAM'] }
    ];

    console.log('\n--- VERIFYING ROWS IN DAILY-VIEW ---');
    for (const slot of expectedSlots) {
      console.log(`\nRow ${slot.row} [${slot.trains}]:`);
      for (const name of slot.staff) {
        const found = staffDuties.find(d => d.name && (d.name.includes(name) || name.includes(d.name)));
        if (found) {
          console.log(`  ✓ ${found.name} (Cat ${found.categoryId}) -> Train: ${found.train_out || found.train_numbers} | Coach: ${found.coach_out || found.coaches}`);
        } else {
          console.log(`  ✗ MISSING: ${name}`);
        }
      }
    }
  });
});
