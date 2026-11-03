import { all, initDb } from '../src/backend/db.js';

async function run() {
  await initDb();
  const res = await all(`SELECT * FROM staff_roster_assignments WHERE staff_id = 135 OR staff_name LIKE '%DANIAL%'`);
  console.log('K Danial in staff_roster_assignments:', res);
  process.exit(0);
}

run().catch(console.error);
