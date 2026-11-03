import { all, run, initDb } from '../src/backend/db.js';

async function main() {
  await initDb();
  const staff = await all('SELECT id, name, category_id, designation, row_position FROM staff WHERE id = 135 OR name LIKE ? OR name LIKE ?', ['%DAN%', '%DANY%']);
  console.log('Found staff:', staff);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
