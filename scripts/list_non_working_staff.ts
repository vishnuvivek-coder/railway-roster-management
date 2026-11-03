import { all, initDb } from '../src/backend/db.js';

async function main() {
  await initDb();
  
  const workingIds = [89, 107, 61, 25, 99, 84, 112, 6, 90, 10, 59, 38, 3, 109, 73, 41, 55, 45, 14, 82, 135, 12, 20, 24, 31, 102, 108, 115, 54, 76];
  
  const allStaff = await all(`
    SELECT id, name, category_id, designation
    FROM staff
    WHERE (active = 1 OR active IS NULL)
    ORDER BY category_id, id
  `);
  
  const nonWorking = allStaff.filter(s => !workingIds.includes(Number(s.id)));
  console.log(`Total active staff: ${allStaff.length}`);
  console.log(`Working on 2026-11-01: ${workingIds.length}`);
  console.log(`Missing from image (to mark as Casual Leave): ${nonWorking.length}`);
  
  for (const s of nonWorking) {
    console.log(`  Staff ${s.id} (${s.name}) Cat ${s.category_id}`);
  }

  process.exit(0);
}

main().catch(console.error);
