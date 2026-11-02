import http from 'http';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'railway_roster_luxury_editorial_secret_2026';
const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, JWT_SECRET);

async function test() {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/roster?category_id=1&year=2026&month=11',
    headers: { 'Authorization': `Bearer ${token}` }
  };
  http.get(options, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const json = JSON.parse(data);
      console.log('Row 0 keys:', Object.keys(json.rows[0]));
      console.log('Row 0 sample:', {
        id: json.rows[0].id,
        name: json.rows[0].name,
        row_position: json.rows[0].row_position,
        designation: json.rows[0].designation,
        datesSample: Object.keys(json.rows[0]).filter(k => k.startsWith('2026-11')).slice(0, 3).map(k => ({ date: k, val: json.rows[0][k] }))
      });
      process.exit(0);
    });
  }).on('error', err => {
    console.error(err);
    process.exit(1);
  });
}
test();
