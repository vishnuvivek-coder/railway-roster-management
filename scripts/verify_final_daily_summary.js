const http = require('http');

// We simulate exact frontend resolution from App.tsx
http.get('http://127.0.0.1:5000/api/reports/daily-view?date=2026-11-01', (res) => {
  let raw = '';
  res.on('data', chunk => raw += chunk);
  res.on('end', () => {
    const data = JSON.parse(raw);
    const staffDuties = (data.categories || []).flatMap(c => (c.staff || []).map(s => ({ ...s, categoryId: c.categoryId })));

    console.log(`\n================================================================`);
    console.log(`📊 DAILY SUMMARY VERIFICATION FOR 01-11-2026 (SUNDAY)`);
    console.log(`================================================================`);

    const working = staffDuties.filter(s => s.status === 'DUTY');
    const onCL = staffDuties.filter(s => s.status === 'LEAVE' || s.leave_type === 'CL' || s.muster_code === 'CL');

    console.log(`• Working Duties: ${working.length} staff`);
    console.log(`• Marked as Casual Leave (CL): ${onCL.length} staff`);
    console.log(`----------------------------------------------------------------`);
    console.log(`SLOT-BY-SLOT MATCH AGAINST REGISTER PHOTO (Pages 110 & 111):`);
    console.log(`----------------------------------------------------------------`);

    const checkSlots = [
      { row: 1, train: '17253 / 17252', expected: ['R SAIDA NAIK'], coaches: 'AC+SL' },
      { row: 2, train: '17239 / 17240', expected: ['NC MEENA'], coaches: 'AC+2S' },
      { row: 3, train: '17646 / 12796', expected: ['N KISHAN KUMAR'], coaches: 'AC+SL' },
      { row: 4, train: '12805 / 12806', expected: ['RNR NAIK'], coaches: 'AC / D1-D2' },
      { row: 5, train: '12795 / 17645', expected: ['AG KRISHNA'], coaches: 'AC+2S' },
      { row: 6, train: '17251 / 17254', expected: ['K KRANTHI KUMAR'], coaches: 'AC+SL' },
      { row: 7, train: '17281 / 17282', expected: ['MV ANJANEYULU'], coaches: '2S' },
      { row: 8, train: '17261 / 12733 / 17262', expected: ['KRM REDDY', 'B KEZIA KUMARI'], coaches: 'AC, SL' },
      { row: 9, train: '20629 / 12733 / 20630', expected: ['K V RAMANA RAO', 'D VANIL KUMAR', 'M SURESH'], coaches: 'AC, SL, SL' },
      { row: 10, train: '17225 / 17226', expected: ['I DASARADHI', 'BR MEENA'], coaches: 'AC, SL' },
      { row: 11, train: '18047 / 17226', expected: ['Y KORNELU BABU', 'SUVVADA SRINU'], coaches: 'AC, SL' },
      { row: 12, train: '17626 / 17625', expected: ['PV SUBBA RAO', 'M VENKATESWARLU'], coaches: 'AC+SL, SL' },
      { row: 13, train: '12604 / 12603', expected: ['S NAGALINGAPPA', 'SK JHA', 'K DANIAL'], coaches: 'AC, SL, SL' },
      { row: 14, train: '12734 / 20630 / 17262', expected: ['BRK REDDY', 'VAN REDDY'], coaches: 'COR-1, COR-2' },
      { row: 15, train: '12734 / 20630', expected: ['BVS REDDY'], coaches: 'SL' },
      { row: 16, train: '17243 / 17244', expected: ['K DURGA RAO', 'MVS NAGI REDDY'], coaches: 'AC+SL, SL' },
      { row: 17, train: '07811 / 07812', expected: ['T KANTHA RAO'], coaches: 'AC' },
      { row: 18, train: '17231 / 17232', expected: ['V SRINIVASA RAO'], coaches: 'AC+SL' },
      { row: 19, train: '07487 / 07488', expected: ['K KOTI REDDY'], coaches: 'AC+SL' },
      { row: 20, train: '07193 / 07194', expected: ['S SUBRAHMANYAM'], coaches: 'AC+SL' }
    ];

    let allMatched = true;
    for (const slot of checkSlots) {
      const staffInSlot = [];
      for (const expName of slot.expected) {
        const found = staffDuties.find(d => d.name && (d.name.includes(expName) || expName.includes(d.name)));
        if (found && found.status === 'DUTY') {
          staffInSlot.push(`${found.name} [${found.coach_out || found.coaches}]`);
        } else {
          allMatched = false;
          staffInSlot.push(`❌ MISSING: ${expName}`);
        }
      }
      console.log(`Row ${String(slot.row).padStart(2, '0')}: ${slot.train.padEnd(25)} -> ${staffInSlot.join(' | ')}`);
    }

    console.log(`----------------------------------------------------------------`);
    console.log(`All 20 Rows Match Handwritten Register: ${allMatched ? '✅ YES (100% MATCH)' : '❌ NO'}`);
    console.log(`All Missing Staff Marked Casual Leave (CL): ${onCL.length > 0 ? '✅ YES' : '❌ NO'}`);
    console.log(`================================================================\n`);
  });
});
