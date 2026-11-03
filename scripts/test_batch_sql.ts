import { run, initDb, withTransaction } from '../src/backend/db.js';

async function main() {
  await initDb();
  console.log('Testing multi-statement execution...');
  await withTransaction(async () => {
    const multiSql = `
      DELETE FROM nda_entries WHERE staff_id = -999;
      DELETE FROM diary_entries WHERE staff_id = -999;
    `;
    const res = await run(multiSql);
    console.log('Multi-statement result:', res);
  });
  console.log('Multi-statement execution succeeded!');
  process.exit(0);
}

main().catch(err => {
  console.error('Multi-statement error:', err);
  process.exit(1);
});
