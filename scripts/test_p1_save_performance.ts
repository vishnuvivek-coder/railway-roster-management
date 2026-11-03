import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { all, run, initDb } from '../src/backend/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'railway_roster_luxury_editorial_secret_2026';

async function main() {
  await initDb();
  const token = jwt.sign(
    { id: 1, username: 'admin', name: 'System Admin', role: 'Admin', status: 'APPROVED' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const testDate = '2026-12-25';
  console.log(`\n================================================================`);
  console.log(`BENCHMARKING P1: DUTY STATUS SAVE PERFORMANCE (< 1.0s TARGET)`);
  console.log(`Test Date: ${testDate} (isolated date to protect Nov/Oct data)`);
  console.log(`================================================================`);

  // Ensure clean state for testDate
  await run(`DELETE FROM overrides WHERE date = ?`, [testDate]);
  await run(`DELETE FROM muster_records WHERE date = ?`, [testDate]);
  await run(`DELETE FROM leave_requests WHERE date = ?`, [testDate]);

  const payload = {
    staff_id: 1, // KAKI SRINIVASA RAO
    staff_b_id: null,
    date: testDate,
    to_date: testDate,
    action: 'LEAVE',
    leave_type: 'CL',
    reason: 'P1 Performance Benchmark Test',
    replacement_type: 'NONE',
    target_link: null
  };

  console.log('Sending POST /api/duty/change-status...');
  const t0 = performance.now();
  const res = await fetch('http://localhost:5000/api/duty/change-status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  const t1 = performance.now();
  const dutyDuration = t1 - t0;
  const data = await res.json();

  console.log(`Response Status : ${res.status}`);
  console.log(`Response Message: ${data.message || data.error}`);
  console.log(`Save Duration   : ${dutyDuration.toFixed(0)} ms (${(dutyDuration / 1000).toFixed(3)}s)`);

  if (dutyDuration < 1000) {
    console.log(`\n🎉 TARGET ACHIEVED: Duty save is ${dutyDuration.toFixed(0)} ms (UNDER 1.0 SECOND)!`);
  } else {
    console.log(`\n⚠️ Exceeded 1s: ${dutyDuration.toFixed(0)} ms. Further query parallelization needed.`);
  }

  // Clean up test data completely
  console.log('\nCleaning up benchmark test data...');
  await run(`DELETE FROM overrides WHERE date = ?`, [testDate]);
  await run(`DELETE FROM muster_records WHERE date = ?`, [testDate]);
  await run(`DELETE FROM leave_requests WHERE date = ?`, [testDate]);
  console.log('Cleanup complete. Zero residual records.');

  console.log(`\n================================================================`);
  console.log(`BENCHMARKING P3: RECONCILIATION ENDPOINT SPEED (< 1.0s TARGET)`);
  console.log(`Date: 2026-11-01`);
  console.log(`================================================================`);

  const t0_rec = performance.now();
  const res_rec = await fetch('http://localhost:5000/api/duty-register/reconciliation?date=2026-11-01', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const t1_rec = performance.now();
  const recDuration = t1_rec - t0_rec;
  const recData = await res_rec.json();

  console.log(`Reconciliation Status  : ${res_rec.status}`);
  console.log(`Reconciliation Duration: ${recDuration.toFixed(0)} ms (${(recDuration / 1000).toFixed(3)}s)`);
  console.log(`Categories returned    : ${Array.isArray(recData) ? recData.length : 0}`);

  if (recDuration < 1000) {
    console.log(`\n🎉 TARGET ACHIEVED: Reconciliation is ${recDuration.toFixed(0)} ms (UNDER 1.0 SECOND)!`);
  } else {
    console.log(`\n⚠️ Reconciliation took: ${recDuration.toFixed(0)} ms.`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
