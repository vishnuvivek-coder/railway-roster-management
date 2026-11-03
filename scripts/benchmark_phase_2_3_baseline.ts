import 'dotenv/config';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'railway_roster_luxury_editorial_secret_2026';

async function main() {
  const token = jwt.sign(
    { id: 1, username: 'admin', name: 'System Admin', role: 'Admin', status: 'APPROVED' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };

  console.log('================================================================');
  console.log('PHASE 2.3 BASELINE BENCHMARK');
  console.log('================================================================');

  // Benchmark 1: GET /api/duty-register/reconciliation?date=2026-11-01
  console.log('\nBenchmarking GET /api/duty-register/reconciliation?date=2026-11-01...');
  const t0_rec = performance.now();
  const res_rec = await fetch('http://localhost:5000/api/duty-register/reconciliation?date=2026-11-01', { headers });
  const t1_rec = performance.now();
  const rec_data = await res_rec.json();
  const rec_duration = t1_rec - t0_rec;
  console.log(`Reconciliation Status: ${res_rec.status}`);
  console.log(`Reconciliation Time  : ${rec_duration.toFixed(0)} ms (${(rec_duration / 1000).toFixed(2)} seconds)`);
  console.log(`Reconciliation Result: ${Array.isArray(rec_data) ? rec_data.length : Object.keys(rec_data)} items returned`);

  // Benchmark 2: POST /api/duty/change-status
  // Test payload: Mark K DURGA RAO (staff 31) on CL on 2026-11-01 with replacement R SAIDA NAIK (staff 89) on Link 15
  console.log('\nBenchmarking POST /api/duty/change-status...');
  const payload = {
    staff_id: 31,
    staff_b_id: null,
    date: '2026-11-01',
    to_date: '2026-11-01',
    action: 'LEAVE',
    leave_type: 'CL',
    day_wise_leaves: null,
    advance_train_no: '',
    vacate_next_link: false,
    target_cor_link: 1,
    original_staff_action: 'SPARE_HQ',
    shifted_mode: 'LINK',
    shifted_place: null,
    shifted_link_number: null,
    shifted_category_id: null,
    shifted_non_daily_id: null,
    extra_train_no: null,
    is_extra: 0,
    target_link: 15,
    link_number: 15,
    target_category_id: 2,
    reason: 'CL Leave Baseline Benchmark',
    new_link_number: null,
    replacement_type: 'OTHER_COLUMN',
    replacement_staff_id: 89,
    replacement_name: 'R SAIDA NAIK',
    wrong_allotment_action: 'REPLACE'
  };

  const t0_duty = performance.now();
  const res_duty = await fetch('http://localhost:5000/api/duty/change-status', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  const t1_duty = performance.now();
  const duty_data = await res_duty.json();
  const duty_duration = t1_duty - t0_duty;
  console.log(`Duty Save Status: ${res_duty.status}`);
  console.log(`Duty Save Time  : ${duty_duration.toFixed(0)} ms (${(duty_duration / 1000).toFixed(2)} seconds)`);
  console.log(`Duty Save Result: ${duty_data.message || duty_data.error}`);

  console.log('\n================================================================');
  console.log('BASELINE RESULTS SUMMARY');
  console.log(`1. Reconciliation : ${rec_duration.toFixed(0)} ms`);
  console.log(`2. Duty Save      : ${duty_duration.toFixed(0)} ms`);
  console.log('================================================================\n');
}

main().catch(console.error);
