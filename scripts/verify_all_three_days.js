const http = require('http');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
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

async function main() {
  const dates = ['2026-11-01', '2026-11-02', '2026-11-03'];
  for (const d of dates) {
    const data = await fetchJson(`http://127.0.0.1:5000/api/reports/daily-view?date=${d}`);
    const staffDuties = (data.categories || []).flatMap(c => (c.staff || []).map(s => ({ ...s, categoryId: c.categoryId })));
    const onDuty = staffDuties.filter(s => s.status === 'DUTY');
    const onLeave = staffDuties.filter(s => s.status === 'LEAVE' || s.muster_code === 'CL');
    console.log(`\nDate: ${d}`);
    console.log(`  Total Staff tracked: ${staffDuties.length}`);
    console.log(`  On Duty: ${onDuty.length}`);
    console.log(`  On Leave / CL: ${onLeave.length}`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
