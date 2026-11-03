const http = require('http');

function getDailyView(dateStr) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:5000/api/reports/daily-view?date=${dateStr}`, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function checkDays() {
  const dates = ['2026-11-02', '2026-11-03'];
  
  for (const dStr of dates) {
    console.log(`\n======================================================`);
    console.log(`CHECKING SYSTEM PREDICTIONS FOR DATE: ${dStr}`);
    console.log(`======================================================`);
    
    const data = await getDailyView(dStr);
    const staffDuties = (data.categories || []).flatMap(c => 
      (c.staff || []).map(s => ({ ...s, categoryId: c.categoryId, categoryName: c.categoryName }))
    );
    
    console.log(`Total staff in view: ${staffDuties.length}`);
    const onDuty = staffDuties.filter(s => s.status === 'DUTY');
    console.log(`On Duty: ${onDuty.length}`);
    
    // Group duties by train numbers or links
    const dutyMap = {};
    for (const s of onDuty) {
      const train = s.train_out || s.train_numbers || 'UNKNOWN';
      if (!dutyMap[train]) dutyMap[train] = [];
      dutyMap[train].push(`${s.name} (Cat ${s.categoryId}, Pos: ${s.rowPosition}) [${s.coach_out || s.coaches}]`);
    }
    
    for (const [tr, staffList] of Object.entries(dutyMap)) {
      console.log(`Train ${tr}:`);
      for (const st of staffList) {
        console.log(`   ${st}`);
      }
    }
  }
}

checkDays().catch(console.error);
