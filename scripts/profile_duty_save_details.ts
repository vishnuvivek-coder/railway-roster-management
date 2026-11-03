import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { all, run, get, initDb } from '../src/backend/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'railway_roster_luxury_editorial_secret_2026';

async function main() {
  await initDb();
  const token = jwt.sign(
    { id: 1, username: 'admin', name: 'System Admin', role: 'Admin', status: 'APPROVED' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const testDate = '2026-12-25';
  await run(`DELETE FROM overrides WHERE date = ?`, [testDate]);
  await run(`DELETE FROM muster_records WHERE date = ?`, [testDate]);
  await run(`DELETE FROM leave_requests WHERE date = ?`, [testDate]);

  console.log('Testing single-day link staff (Staff 112: MV ANJANEYULU)...');
  const t0_single = performance.now();
  const res1 = await fetch('http://localhost:5000/api/duty/change-status', {
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
      reason: 'Single-day test',
      replacement_type: 'NONE'
    })
  });
  const t1_single = performance.now();
  const d1 = await res1.json();
  console.log(`Single-Day Staff Duration: ${(t1_single - t0_single).toFixed(0)} ms | Status: ${res1.status} | Msg: ${d1.message?.slice(0, 60)}`);

  console.log('\nTesting multi-day link staff (Staff 1: KAKI SRINIVASA RAO)...');
  const t0_multi = performance.now();
  const res2 = await fetch('http://localhost:5000/api/duty/change-status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      staff_id: 1,
      date: testDate,
      to_date: testDate,
      action: 'LEAVE',
      leave_type: 'CL',
      reason: 'Multi-day test',
      replacement_type: 'NONE'
    })
  });
  const t1_multi = performance.now();
  const d2 = await res2.json();
  console.log(`Multi-Day Staff Duration : ${(t1_multi - t0_multi).toFixed(0)} ms | Status: ${res2.status} | Msg: ${d2.message?.slice(0, 60)}`);

  await run(`DELETE FROM overrides WHERE date = ?`, [testDate]);
  await run(`DELETE FROM muster_records WHERE date = ?`, [testDate]);
  await run(`DELETE FROM leave_requests WHERE date = ?`, [testDate]);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
