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

async function inspect() {
  const roster = await fetchJson('/api/roster?category_id=1&year=2026&month=10');
  console.log('Roster dates count:', roster.dates ? roster.dates.length : 0);
  console.log('Roster dates[0]:', roster.dates ? roster.dates[0] : null);
  if (roster.rows && roster.rows[0]) {
    console.log('Row 0 cells length:', roster.rows[0].cells ? roster.rows[0].cells.length : 0);
    console.log('Row 0 cell 0:', roster.rows[0].cells ? roster.rows[0].cells[0] : null);
  }

  const daily = await fetchJson('/api/reports/daily-view?date=2026-10-15');
  console.log('Daily categories keys/names:');
  for (const c of daily.categories) {
    console.log(`Cat: ${c.name || c.categoryName || c.title || c.id}, keys:`, Object.keys(c));
    if (c.sections) {
      console.log('  Sections:', c.sections.map((s: any) => s.title || s.name));
    }
  }
  console.log('Daily tally_summary:', daily.tally_summary);
  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
