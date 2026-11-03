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

  console.log('Querying existing reconciliation endpoint...');
  const t0 = performance.now();
  const res = await fetch('http://localhost:5000/api/duty-register/reconciliation?date=2026-11-01', { headers });
  const t1 = performance.now();
  const data = await res.json();
  console.log(`Original Time: ${(t1 - t0).toFixed(0)} ms`);
  console.log('Categories count:', data.categories?.length);
  const totalStaff = data.categories?.reduce((acc: number, c: any) => acc + (c.reconciliation?.length || 0), 0);
  console.log('Total reconciliation staff items:', totalStaff);
  const mismatches = data.categories?.reduce((acc: number, c: any) => acc + (c.reconciliation?.filter((r: any) => r.isMismatch).length || 0), 0);
  console.log('Total mismatches detected:', mismatches);
}

main().catch(console.error);
