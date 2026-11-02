import dotenv from 'dotenv';
dotenv.config();
import jwt from 'jsonwebtoken';

const BASE_URL = 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-do-not-use-in-production-change-me';

const token = jwt.sign(
  { id: 1, username: 'admin', role: 'admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};

async function timedFetch(url: string, label: string) {
  const start = performance.now();
  const res = await fetch(url, { headers });
  const duration = performance.now() - start;
  if (!res.ok) {
    console.error(`❌ [${res.status}] ${label} (${duration.toFixed(1)}ms): ${await res.text()}`);
    return { ok: false, duration };
  }
  const json = await res.json();
  console.log(`✅ ${label}: ${duration.toFixed(1)}ms`);
  return { ok: true, duration, data: json };
}

async function runBenchmark() {
  console.log('=== BENCHMARKING KEY ENDPOINTS (BEFORE OPTIMIZATIONS) ===\n');

  await timedFetch(`${BASE_URL}/api/roster?category_id=ALL&start_date=2026-10-01&end_date=2026-10-31`, 'Roster Oct 2026 (ALL)');
  await timedFetch(`${BASE_URL}/api/roster?category_id=1&start_date=2026-10-01&end_date=2026-10-31`, 'Roster Oct 2026 (COR)');
  await timedFetch(`${BASE_URL}/api/roster?category_id=ALL&start_date=2026-11-01&end_date=2026-11-30`, 'Roster Nov 2026 (ALL)');
  await timedFetch(`${BASE_URL}/api/roster?category_id=1&start_date=2026-11-01&end_date=2026-11-30`, 'Roster Nov 2026 (COR)');

  await timedFetch(`${BASE_URL}/api/reports/daily-view?date=2026-10-15`, 'Daily View Oct 15, 2026');
  await timedFetch(`${BASE_URL}/api/reports/daily-view?date=2026-11-05`, 'Daily View Nov 05, 2026');

  await timedFetch(`${BASE_URL}/api/muster?category_id=ALL&cycle_start=2026-10-01`, 'Muster Oct 2026 (ALL)');
  await timedFetch(`${BASE_URL}/api/muster?category_id=ALL&cycle_start=2026-11-01`, 'Muster Nov 2026 (ALL)');

  await timedFetch(`${BASE_URL}/api/lr-sheet?month=2026-10`, 'LR Sheet Oct 2026');
  await timedFetch(`${BASE_URL}/api/lr-sheet?month=2026-11`, 'LR Sheet Nov 2026');

  await timedFetch(`${BASE_URL}/api/staff/cr-balances?force=true`, 'CR Balances (force=true)');
}

runBenchmark().catch(console.error);
