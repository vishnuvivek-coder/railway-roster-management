import { all, initDb } from '../src/backend/db.js';

async function run() {
  await initDb();
  
  const novAssignments = await all(`
    SELECT category_id, COUNT(*) as count, MAX(row_position) as max_pos
    FROM staff_roster_assignments
    WHERE '2026-11-01' BETWEEN effective_from AND COALESCE(effective_to, '2099-12-31')
    GROUP BY category_id
  `);
  console.log('Nov assignments by category:', novAssignments);

  const cat2Nov = await all(`
    SELECT sra.id, sra.staff_id, sra.staff_name, sra.row_position, sra.effective_from, sra.effective_to
    FROM staff_roster_assignments sra
    WHERE category_id = 2
      AND '2026-11-01' BETWEEN sra.effective_from AND COALESCE(sra.effective_to, '2099-12-31')
    ORDER BY sra.row_position ASC
  `);
  console.log('Nov Category 2 assignments count:', cat2Nov.length);
  for (const s of cat2Nov) {
    if (s.row_position >= 50 || s.staff_name.includes('DANIAL') || s.staff_id === 135) {
      console.log(`Pos ${s.row_position}: Staff ${s.staff_id} - ${s.staff_name}`);
    }
  }

  process.exit(0);
}

run().catch(console.error);
