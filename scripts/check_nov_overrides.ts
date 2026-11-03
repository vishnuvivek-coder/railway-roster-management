import { all, initDb } from '../src/backend/db.js';

async function main() {
  await initDb();
  const overrides = await all('SELECT * FROM overrides WHERE date = ?', ['2026-11-01']);
  console.log('Overrides for 2026-11-01 count:', overrides.length);
  for (const o of overrides) {
    console.log(JSON.stringify(o));
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
