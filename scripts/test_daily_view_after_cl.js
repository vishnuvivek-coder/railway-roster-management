const http = require('http');

http.get('http://127.0.0.1:5000/api/reports/daily-view?date=2026-11-01', (res) => {
  let raw = '';
  res.on('data', chunk => raw += chunk);
  res.on('end', () => {
    const data = JSON.parse(raw);
    const staffDuties = (data.categories || []).flatMap(c => (c.staff || []).map(s => ({ ...s, categoryId: c.categoryId })));

    const workingIds = [89, 107, 61, 25, 99, 84, 112, 6, 90, 10, 59, 38, 3, 109, 73, 41, 55, 45, 14, 82, 135, 12, 20, 24, 31, 102, 108, 115, 54, 76];
    
    const onDuty = staffDuties.filter(s => s.status === 'DUTY');
    console.log(`On Duty count: ${onDuty.length}`);

    const extraOnDuty = onDuty.filter(s => !workingIds.includes(Number(s.staffId)));
    console.log(`Extra On Duty (not in register photo): ${extraOnDuty.length}`);
    for (const s of extraOnDuty) {
      console.log(`  Staff ${s.staffId} (${s.name}) Cat ${s.categoryId} Train: ${s.train_out || s.train_numbers} Reason: ${s.overrideReason} Muster: ${s.muster_code}`);
    }
  });
});
