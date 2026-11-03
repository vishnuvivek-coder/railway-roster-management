import { generateStaffTaJournal } from '../src/backend/ta_generator.js';
import { get, all, run, initDb } from '../src/backend/db.js';

async function testTA() {
  await initDb();
  
  const testStaffIds = [10, 31, 89, 3, 14, 54, 76];
  for (const sId of testStaffIds) {
    const journal = await generateStaffTaJournal({ get, all, run }, sId, 2026, 10, '2026-10-01', '2026-10-31');
    const rows = journal?.rows || [];
    
    // Check for duplicates
    const seen = new Set();
    const dups = [];
    for (const r of rows) {
      const key = `${r.duty_date}_${r.train_no}_${r.from_station}_${r.to_station}`;
      if (seen.has(key)) {
        dups.push(key);
      }
      seen.add(key);
    }
    
    console.log(`Staff ${sId} (${journal?.employee?.name || journal?.staff_name}): ${rows.length} rows, Duplicates: ${dups.length}`);
    if (dups.length > 0) {
      console.log('  Duplicates found:', dups);
    }
  }
  
  process.exit(0);
}

testTA().catch(console.error);
