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

async function run() {
  const allStaff = await fetchJson('/api/staff?year=2026&month=11');
  const khasim = allStaff.filter((s: any) => s.name && s.name.includes('KHASIM'));
  console.log('KHASIM in Nov staff:', khasim);

  const saida = allStaff.filter((s: any) => s.name && s.name.includes('SAIDA NAIK'));
  console.log('SAIDA NAIK in Nov staff:', saida);

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
