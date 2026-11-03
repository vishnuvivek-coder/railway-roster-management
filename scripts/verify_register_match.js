const http = require('http');

http.get('http://127.0.0.1:5000/api/reports/daily-view?date=2026-11-01', (res) => {
  let raw = '';
  res.on('data', chunk => raw += chunk);
  res.on('end', () => {
    const data = JSON.parse(raw);
    const staffDuties = (data.categories || []).flatMap(c => (c.staff || []).map(s => ({ ...s, categoryId: c.categoryId })));

    const checkStaff = [
      { id: 89, expected: '17253', name: 'R SAIDA NAIK' },
      { id: 107, expected: '17239', name: 'NC MEENA' },
      { id: 61, expected: '17646', name: 'N KISHAN KUMAR' },
      { id: 25, expected: '12805', name: 'RNR NAIK' },
      { id: 99, expected: '12795', name: 'AG KRISHNA' },
      { id: 84, expected: '17251', name: 'K KRANTHI KUMAR' },
      { id: 112, expected: '17281', name: 'MV ANJANEYULU' },
      { id: 6, expected: '17261', name: 'KRM REDDY' },
      { id: 90, expected: '17261', name: 'B KEZIA KUMARI' },
      { id: 10, expected: '20629', name: 'K V RAMANA RAO' },
      { id: 59, expected: '20629', name: 'D VANIL KUMAR' },
      { id: 38, expected: '20629', name: 'M SURESH' },
      { id: 3, expected: '17225', name: 'I DASARADHI' },
      { id: 109, expected: '17225', name: 'BR MEENA' },
      { id: 73, expected: '18047', name: 'Y KORNELU BABU' },
      { id: 41, expected: '18047', name: 'SUVVADA SRINU' },
      { id: 55, expected: '17626', name: 'PV SUBBA RAO' },
      { id: 45, expected: '17626', name: 'M VENKATESWARLU' },
      { id: 14, expected: '12604', name: 'S NAGALINGAPPA' },
      { id: 82, expected: '12604', name: 'SK JHA' },
      { id: 135, expected: '12604', name: 'K DANIAL' },
      { id: 12, expected: '12734', name: 'BRK REDDY' },
      { id: 20, expected: '12734', name: 'VAN REDDY' },
      { id: 24, expected: '12734', name: 'BVS REDDY' },
      { id: 31, expected: '17243', name: 'K DURGA RAO' },
      { id: 102, expected: '17243', name: 'MVS NAGI REDDY' },
      { id: 108, expected: '07811', name: 'T KANTHA RAO' },
      { id: 115, expected: '17231', name: 'V SRINIVASA RAO' },
      { id: 54, expected: '07487', name: 'K KOTI REDDY' },
      { id: 76, expected: '07193', name: 'S SUBRAHMANYAM' }
    ];

    let matchCount = 0;
    for (const item of checkStaff) {
      const duty = staffDuties.find(d => Number(d.staffId) === item.id);
      if (duty) {
        const train = duty.train_out || duty.train_numbers;
        const matches = train && train.includes(item.expected);
        if (matches) matchCount++;
        console.log(`${item.name} (${item.id}): Train = ${train} | Coach = ${duty.coach_out || duty.coaches} | Status = ${duty.status} [${matches ? 'MATCH' : 'MISMATCH'}]`);
      } else {
        console.log(`${item.name} (${item.id}): NOT FOUND in daily-view`);
      }
    }
    console.log(`\nVerified: ${matchCount} / ${checkStaff.length} match handwritten register!`);
  });
});
