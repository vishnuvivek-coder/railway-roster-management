import { all, initDb } from '../src/backend/db.js';

async function run() {
  await initDb();
  
  console.log('=== DUTY REGISTER ENTRIES FOR 2026-11-01 ===');
  const entries = await all(`
    SELECT e.id, e.date, e.train_out, e.coach_out, e.train_return, e.coach_return, e.duty_label, s.id as staff_id, s.name, s.category_id, sra.row_position
    FROM duty_register_entry e
    JOIN duty_register_staff ds ON ds.entry_id = e.id
    JOIN staff s ON s.id = ds.staff_id
    LEFT JOIN staff_roster_assignments sra ON sra.staff_id = s.id AND '2026-11-01' BETWEEN sra.effective_from AND COALESCE(sra.effective_to, '2099-12-31')
    WHERE e.date = '2026-11-01'
    ORDER BY e.id, ds.staff_id
  `);
  console.log('Entries for 2026-11-01 count:', entries.length);
  for (const e of entries) {
    console.log(`Entry ${e.id}: ${e.train_out}/${e.train_return} [${e.coach_out}] -> Staff ${e.staff_id} (${e.name}) Cat: ${e.category_id} Pos: ${e.row_position}`);
  }

  console.log('\n=== CHECK OVERRIDES FOR 2026-11-01 ===');
  const ovs = await all(`SELECT * FROM overrides WHERE date = '2026-11-01'`);
  console.log('Overrides count:', ovs.length);
  for (const o of ovs) {
    console.log(`Override id ${o.id}: staff_id=${o.staff_id}, status=${o.status}, reason=${o.reason}, link=${o.overridden_link_number}`);
  }

  console.log('\n=== CHECK LEAVE REQUESTS FOR 2026-11-01 ===');
  const lrs = await all(`SELECT * FROM leave_requests WHERE '2026-11-01' BETWEEN from_date AND to_date OR date = '2026-11-01'`);
  console.log('Leave requests count:', lrs.length);
  for (const l of lrs) {
    console.log(`Leave id ${l.id}: staff_id=${l.staff_id}, type=${l.leave_type || l.type}, status=${l.status}`);
  }

  console.log('\n=== CHECK MUSTER RECORDS FOR 2026-11-01 ===');
  const mus = await all(`SELECT * FROM muster_records WHERE date = '2026-11-01'`);
  console.log('Muster records count:', mus.length);
  for (const m of mus) {
    console.log(`Muster id ${m.id}: staff_id=${m.staff_id}, code=${m.code}, remarks=${m.remarks}`);
  }

  console.log('\n=== CHECK K DANIAL (135) ===');
  const danialStaff = await all(`SELECT * FROM staff WHERE id = 135 OR name LIKE '%DANIAL%'`);
  console.log('Danial staff:', danialStaff);
  const danialSra = await all(`SELECT * FROM staff_roster_assignments WHERE staff_id = 135 OR staff_name LIKE '%DANIAL%'`);
  console.log('Danial assignments:', danialSra);

  process.exit(0);
}

run().catch(console.error);
