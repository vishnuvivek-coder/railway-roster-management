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

async function inspectNov1Divergence() {
  const roster = await fetchJson('/api/roster?category_id=1&year=2026&month=11');
  const daily = await fetchJson('/api/reports/daily-view?date=2026-11-01');

  for (const staffId of ['14', '17']) {
    const rRow = roster.rows.find((r: any) => String(r.staffId) === staffId);
    const rCell = rRow ? rRow.cells.find((c: any) => c.date === '2026-11-01') : null;
    const dStaff = daily.categories[0].staff.find((s: any) => String(s.staffId) === staffId);

    console.log(`\n=== Staff ${staffId} (${rRow?.staffName}): ===`);
    console.log('Roster cell:', {
      link: rCell?.calculatedLinkNumber,
      actualLink: rCell?.actualLinkNumber,
      status: rCell?.status,
      train: rCell?.train_numbers,
      effectiveTrain: rCell?.effective_train_numbers,
      isRest: rCell?.isRest,
      isOverridden: rCell?.isOverridden,
      overrideReason: rCell?.overrideReason
    });
    console.log('Daily staff:', {
      link: dStaff?.link_number,
      originalLink: dStaff?.original_link_number,
      status: dStaff?.status,
      duty_group: dStaff?.duty_group,
      train_out: dStaff?.train_out,
      train_return: dStaff?.train_return,
      train_numbers: dStaff?.train_numbers,
      isRest: dStaff?.is_rest,
      isOverridden: dStaff?.isOverridden,
      overrideReason: dStaff?.overrideReason
    });
  }
  process.exit(0);
}

inspectNov1Divergence().catch(e => {
  console.error(e);
  process.exit(1);
});
