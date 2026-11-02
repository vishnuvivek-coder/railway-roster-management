import dotenv from 'dotenv';
dotenv.config();
import { initDb, all } from '../src/backend/db.js';

async function main() {
  await initDb();
  console.log('=== All Link Sets ===');
  const sets = await all(`
    SELECT ls.id, ls.category_id, c.name as category_name, ls.name, ls.status, 
           ls.effective_from, ls.effective_to, ls.cloned_from_id, ls.created_at, ls.updated_at,
           (SELECT COUNT(*) FROM links l WHERE l.link_set_id = ls.id) as link_count
    FROM link_sets ls
    LEFT JOIN categories c ON c.id = ls.category_id
    ORDER BY ls.category_id, ls.id
  `);
  console.table(sets);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
