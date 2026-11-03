import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { run, initDb } from '../src/backend/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'railway_roster_luxury_editorial_secret_2026';

async function main() {
  await initDb();
  const token = jwt.sign(
    { id: 1, username: 'admin', name: 'System Admin', role: 'Admin', status: 'APPROVED' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const testDates = ['2026-12-21', '2026-12-22', '2026-12-23'];
  for (const d of testDates) {
    await run(`DELETE FROM overrides WHERE date = ?`, [d]);
    await run(`DELETE FROM muster_records WHERE date = ?`, [d]);
  }

  console.log('================================================================');
  console.log('BENCHMARKING 3 CONSECUTIVE DUTY SAVES (P1)');
  console.log('================================================================');

  for (let i = 0; i < testDates.length; i++) {
    const testDate = testDates[i];
    const t0 = performance.now();
    const res = await fetch('http://localhost:5000/api/duty/change-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        staff_id: 112,
        date: testDate,
        to_date: testDate,
        action: 'LEAVE',
        leave_type: 'CL',
        reason: 'P1 Bench ' + i,
        replacement_type: 'NONE'
      })
    });
    const t1 = performance.now();
    const duration = t1 - t0;
    const data = await res.json();
    console.log(`Run ${i + 1} (${testDate}): ${duration.toFixed(0)} ms (${(duration / 1000).toFixed(3)}s) | Status: ${res.status}`);
  }

  for (const d of testDates) {
    await run(`DELETE FROM overrides WHERE date = ?`, [d]);
    await run(`DELETE FROM muster_records WHERE date = ?`, [d]);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
