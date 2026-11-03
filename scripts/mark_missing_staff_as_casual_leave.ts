import { all, run, initDb } from '../src/backend/db.js';

async function main() {
  await initDb();
  
  const workingIds = [89, 107, 61, 25, 99, 84, 112, 6, 90, 10, 59, 38, 3, 109, 73, 41, 55, 45, 14, 82, 135, 12, 20, 24, 31, 102, 108, 115, 54, 76];
  const dateStr = '2026-11-01';

  const allStaff = await all(`
    SELECT id, name, category_id, designation
    FROM staff
    WHERE (active = 1 OR active IS NULL)
  `);

  const nonWorking = allStaff.filter(s => !workingIds.includes(Number(s.id)));
  console.log(`Setting ${nonWorking.length} staff to Casual Leave (CL) on ${dateStr}...`);

  for (const s of nonWorking) {
    const sId = Number(s.id);
    
    // 1. Update/Insert into muster_records
    const existingMuster = await all(`SELECT id FROM muster_records WHERE staff_id = ? AND date = ?`, [sId, dateStr]);
    if (existingMuster && existingMuster.length > 0) {
      await run(`UPDATE muster_records SET code = 'CL', remarks = 'Casual Leave' WHERE staff_id = ? AND date = ?`, [sId, dateStr]);
    } else {
      await run(`INSERT INTO muster_records (staff_id, date, code, remarks) VALUES (?, ?, 'CL', 'Casual Leave')`, [sId, dateStr]);
    }

    // 2. Update/Insert into overrides
    const existingOverride = await all(`SELECT id FROM overrides WHERE staff_id = ? AND date = ?`, [sId, dateStr]);
    if (existingOverride && existingOverride.length > 0) {
      await run(`
        UPDATE overrides 
        SET status = 'LEAVE', leave_type = 'CL', reason = 'Casual Leave', overridden_link_number = NULL,
            train_out = NULL, coach_out = NULL, train_return = NULL, coach_return = NULL, duty_label = NULL
        WHERE staff_id = ? AND date = ?
      `, [sId, dateStr]);
    } else {
      await run(`
        INSERT INTO overrides (staff_id, date, status, leave_type, reason, overridden_link_number)
        VALUES (?, ?, 'LEAVE', 'CL', 'Casual Leave', NULL)
      `, [sId, dateStr]);
    }

    // 3. Update/Insert into leave_requests
    const existingLeave = await all(`SELECT id FROM leave_requests WHERE staff_id = ? AND (date = ? OR (? BETWEEN from_date AND to_date))`, [sId, dateStr, dateStr]);
    if (!existingLeave || existingLeave.length === 0) {
      await run(`
        INSERT INTO leave_requests (staff_id, type, from_date, to_date, date, status, reason)
        VALUES (?, 'CL', ?, ?, ?, 'APPROVED', 'Casual Leave')
      `, [sId, dateStr, dateStr, dateStr]);
    } else {
      await run(`UPDATE leave_requests SET type = 'CL', status = 'APPROVED', reason = 'Casual Leave' WHERE id = ?`, [existingLeave[0].id]);
    }
  }

  // Ensure the 30 working staff are marked Present (P) in muster_records and not on leave in overrides
  for (const wId of workingIds) {
    const existingMuster = await all(`SELECT id FROM muster_records WHERE staff_id = ? AND date = ?`, [wId, dateStr]);
    if (existingMuster && existingMuster.length > 0) {
      await run(`UPDATE muster_records SET code = 'P', remarks = NULL WHERE staff_id = ? AND date = ?`, [wId, dateStr]);
    } else {
      await run(`INSERT INTO muster_records (staff_id, date, code, remarks) VALUES (?, ?, 'P', NULL)`, [wId, dateStr]);
    }
    // Delete any false leave overrides for working staff
    await run(`DELETE FROM overrides WHERE staff_id = ? AND date = ? AND status IN ('LEAVE', 'SICK', 'REST', 'ABSENT', 'CR')`, [wId, dateStr]);
    await run(`DELETE FROM leave_requests WHERE staff_id = ? AND (date = ? OR (? BETWEEN from_date AND to_date))`, [wId, dateStr, dateStr]);
  }

  console.log('Successfully marked all non-working staff as Casual Leave (CL) and confirmed working staff as Present (P).');
  process.exit(0);
}

main().catch(console.error);
