import { all, initDb } from '../src/backend/db.js';

async function main() {
  await initDb();
  const cols = await all('DESCRIBE leave_requests');
  console.log('leave_requests columns:', cols.map(c => c.Field));
  process.exit(0);
}

main().catch(console.error);
