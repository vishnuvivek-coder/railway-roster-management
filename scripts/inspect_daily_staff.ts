import http from 'http';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'railway_roster_luxury_editorial_secret_2026';
const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, JWT_SECRET);

function fetchJson(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get({
      hostname: 'localhost',
      port: 5000,
      path,
      headers: { 'Authorization': `Bearer ${token}` }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function inspectDailyStaff() {
  const daily = await fetchJson('/api/reports/daily-view?date=2026-10-15');
  console.log('Daily category 0 staff length:', daily.categories[0].staff.length);
  console.log('Sample daily staff[0]:', daily.categories[0].staff[0]);
  console.log('Sample daily staff[1]:', daily.categories[0].staff[1]);
  process.exit(0);
}

inspectDailyStaff().catch(e => {
  console.error(e);
  process.exit(1);
});
