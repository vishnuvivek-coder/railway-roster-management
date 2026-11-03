import 'dotenv/config';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'railway_roster_luxury_editorial_secret_2026';

async function main() {
  const token = jwt.sign(
    { id: 1, username: 'admin', name: 'System Admin', role: 'Admin', status: 'APPROVED' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

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
    reason: 'CL Leave Breakdown Test',
    new_link_number: null,
    replacement_type: 'OTHER_COLUMN',
    replacement_staff_id: 89,
    replacement_name: 'R SAIDA NAIK',
    wrong_allotment_action: 'REPLACE'
  };

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
  console.log(`Status: ${res.status}`);
  console.log(`Total Time: ${(t1 - t0).toFixed(0)} ms`);
  const data = await res.json();
  console.log('Result:', data.message);
}

main().catch(console.error);
