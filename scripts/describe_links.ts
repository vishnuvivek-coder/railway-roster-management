import dotenv from 'dotenv';
dotenv.config();
import { initDb, all } from '../src/backend/db.js';

async function main() {
  await initDb();
  console.log('=== Describe Links ===');
  const cols = await all('DESCRIBE links');
  console.table(cols);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
