import { run, initDb } from '../src/backend/db.js';

async function main() {
  await initDb();
  
  console.log('Cleaning benchmark muster records for 2026-11-01...');
  // Staff 31 (K DURGA RAO) should be Present (P) working 17243, not CL
  await run(`UPDATE muster_records SET code = 'P', remarks = NULL WHERE staff_id = 31 AND date = '2026-11-01'`);
  
  // Staff 89 (R SAIDA NAIK) is working 17253, not working as substitute for K Durga Rao
  await run(`UPDATE muster_records SET remarks = NULL WHERE staff_id = 89 AND date = '2026-11-01'`);
  
  console.log('Muster records updated successfully.');
  process.exit(0);
}

main().catch(console.error);
