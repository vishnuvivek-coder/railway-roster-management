import { all, run, initDb } from '../src/backend/db.js';

const nov2Duties = [
  { train_out: '17253', coach_out: 'AC + SL', train_return: '17252', coach_return: 'AC + SL', label: '17253 / 17252', staff: [{ id: 30, name: 'SK KHASIM' }] },
  { train_out: '17239', coach_out: 'AC + 2S', train_return: '17240', coach_return: 'AC + 2S', label: '17239 / 17240', staff: [{ id: 79, name: 'P RAVI KUMAR' }] },
  { train_out: '17646', coach_out: 'AC + SL', train_return: '12796', coach_return: 'AC + 2S', label: '17646 / 12796', staff: [{ id: 32, name: 'SK KARIMULLAH' }] },
  { train_out: '12805', coach_out: 'AC D1-D2', train_return: '12806', coach_return: 'AC D1-D2', label: '12805 / 12806', staff: [{ id: 34, name: 'KV SURESH' }] },
  { train_out: '12795', coach_out: 'AC + 2S', train_return: '17645', coach_return: 'AC + SL', label: '12795 / 17645', staff: [{ id: 62, name: 'Y MURALI KRISHNA' }] },
  { train_out: '17251', coach_out: 'AC + SL', train_return: '17254', coach_return: 'AC + SL', label: '17251 / 17254', staff: [{ id: 83, name: 'SH MADHU BABU' }] },
  { train_out: '17281', coach_out: '2S', train_return: '17282', coach_return: '2S', label: '17281 / 17282', staff: [{ id: 105, name: 'KB RAO' }] },
  { train_out: '17261', coach_out: 'AC', train_return: '12733', coach_return: 'COR-1', label: '17261 / 12733', staff: [{ id: 5, name: 'TRS REDDY' }] },
  { train_out: '17261', coach_out: 'S1-S5', train_return: '17262', coach_return: 'S1-S5', label: '17261 / 17262', staff: [{ id: 86, name: 'VS CHANDRIKA' }] },
  { train_out: '17261', coach_out: 'S6-S10', train_return: '17262', coach_return: 'S6-S10', label: '17261 / 17262', staff: [{ id: 134, name: 'SD SHAHEDA' }] },
  { train_out: '20629', coach_out: 'AC', train_return: '12733', coach_return: 'COR-2', label: '20629 / 12733', staff: [{ id: 37, name: 'U RAMA KRISHNA' }] },
  { train_out: '20629', coach_out: 'SL', train_return: '20630', coach_return: 'SL', label: '20629 / 20630', staff: [{ id: 114, name: 'ELN RAO' }] },
  { train_out: '17225', coach_out: 'AC', train_return: '17226', coach_return: 'AC', label: '17225 / 17226', staff: [{ id: 2, name: 'K RAMANAIAH' }] },
  { train_out: '17225', coach_out: 'SL', train_return: '17226', coach_return: 'SL', label: '17225 / 17226', staff: [{ id: 26, name: 'NRC REDDY' }] },
  { train_out: '18047', coach_out: 'SL', train_return: '17226', coach_return: 'AC', label: '18047 / 17226', staff: [{ id: 72, name: 'D ANVESH' }] },
  { train_out: '18047', coach_out: 'SL', train_return: '17226', coach_return: 'SL', label: '18047 / 17226', staff: [{ id: 40, name: 'B PAVAN KUMAR' }] },
  { train_out: '17626', coach_out: 'AC + SL', train_return: '17625', coach_return: 'AC + SL', label: '17626 / 17625', staff: [{ id: 44, name: 'KVB SANKAR' }] },
  { train_out: '17626', coach_out: 'SL', train_return: '17625', coach_return: 'SL', label: '17626 / 17625', staff: [{ id: 51, name: 'Y SRIKANTH' }] },
  { train_out: '12604', coach_out: 'AC', train_return: '12603', coach_return: 'AC', label: '12604 / 12603', staff: [{ id: 100, name: 'D RAKESH' }] },
  { train_out: '12604', coach_out: 'S1-S5', train_return: '12603', coach_return: 'S6-S10', label: '12604 / 12603', staff: [{ id: 111, name: 'MV RAMA REDDY' }] },
  { train_out: '12734', coach_out: 'COR-2', train_return: '20630', coach_return: 'AC', label: '12734 / 20630', staff: [{ id: 11, name: 'SK SALEEM' }] },
  { train_out: '12734', coach_out: 'COR-1', train_return: '17262', coach_return: 'AC', label: '12734 / 17262', staff: [{ id: 19, name: 'PRM ALI KHAN' }] },
  { train_out: '12734', coach_out: 'SL', train_return: '20630', coach_return: 'SL', label: '12734 / 20630', staff: [{ id: 23, name: 'J VINAY KUMAR' }] },
  { train_out: '17243', coach_out: 'AC + SL', train_return: '17244', coach_return: 'AC + SL', label: '17243 / 17244', staff: [{ id: 47, name: 'B SURESH' }] },
  { train_out: '17243', coach_out: 'SL', train_return: '17244', coach_return: 'SL', label: '17243 / 17244', staff: [{ id: 75, name: 'G VARADARAJULU' }] },
  { train_out: '17637', coach_out: 'AC + SL', train_return: '17638', coach_return: 'AC + SL', label: '17637 / 17638', staff: [{ id: 104, name: 'MSA RAJU' }] },
  { train_out: '17646', coach_out: 'SL', train_return: '08520', coach_return: 'AC + SL', label: '17646 / 08520', staff: [{ id: 106, name: 'SANJAY KUMAR' }] }
];

const nov3Duties = [
  { train_out: '17253', coach_out: 'AC + SL', train_return: '17252', coach_return: 'AC + SL', label: '17253 / 17252', staff: [{ id: 50, name: 'N SWARNA BABU' }] },
  { train_out: '17239', coach_out: 'AC + 2S', train_return: '17240', coach_return: 'AC + 2S', label: '17239 / 17240', staff: [{ id: 78, name: 'A VENKI REDDY' }] },
  { train_out: '17646', coach_out: 'AC + SL', train_return: '12796', coach_return: 'AC + 2S', label: '17646 / 12796', staff: [{ id: 107, name: 'NC MEENA' }] },
  { train_out: '12805', coach_out: 'AC D1-D2', train_return: '12806', coach_return: 'AC D1-D2', label: '12805 / 12806', staff: [{ id: 61, name: 'N KISHAN KUMAR' }] },
  { train_out: '12795', coach_out: 'AC + 2S', train_return: '17645', coach_return: 'AC + SL', label: '12795 / 17645', staff: [{ id: 109, name: 'BR MEENA' }] },
  { train_out: '17251', coach_out: 'AC + SL', train_return: '17254', coach_return: 'AC + SL', label: '17251 / 17254', staff: [{ id: 82, name: 'SK JHA' }] },
  { train_out: '17281', coach_out: '2S', train_return: '17282', coach_return: '2S', label: '17281 / 17282', staff: [{ id: 59, name: 'D VANIL KUMAR' }] },
  { train_out: '17261', coach_out: 'AC', train_return: '12733', coach_return: 'COR-2', label: '17261 / 12733', staff: [{ id: 4, name: 'BP RAJA KUMAR' }] },
  { train_out: '17261', coach_out: 'SL', train_return: '17262', coach_return: 'SL', label: '17261 / 17262', staff: [{ id: 88, name: 'K SIVA PARVATHI' }] },
  { train_out: '20629', coach_out: 'AC', train_return: '12733', coach_return: 'COR-1', label: '20629 / 12733', staff: [{ id: 8, name: 'M SRINIVASULU' }] },
  { train_out: '20629', coach_out: 'SL', train_return: '20630', coach_return: 'SL', label: '20629 / 20630', staff: [{ id: 36, name: 'M NAGARAJU' }] },
  { train_out: '17225', coach_out: 'AC', train_return: '17226', coach_return: 'AC', label: '17225 / 17226', staff: [{ id: 1, name: 'KAKI SRINIVASA RAO' }] },
  { train_out: '17225', coach_out: 'SL', train_return: '17226', coach_return: 'SL', label: '17225 / 17226', staff: [{ id: 101, name: 'G SHIVAN' }] },
  { train_out: '18047', coach_out: 'AC', train_return: '17226', coach_return: 'SL', label: '18047 / 17226', staff: [{ id: 71, name: 'P KRISHNA MOHAN' }] },
  { train_out: '18047', coach_out: 'SL', train_return: '17226', coach_return: 'SL', label: '18047 / 17226', staff: [{ id: 39, name: 'U BALA JOJI' }] },
  { train_out: '17626', coach_out: 'AC + SL', train_return: '17625', coach_return: 'AC + SL', label: '17626 / 17625', staff: [{ id: 64, name: 'T SRIHARSHA' }] },
  { train_out: '17626', coach_out: 'SL', train_return: '17625', coach_return: 'SL', label: '17626 / 17625', staff: [{ id: 43, name: 'T SIVA KUMAR' }] },
  { train_out: '12604', coach_out: 'AC', train_return: '12603', coach_return: 'AC', label: '12604 / 12603', staff: [{ id: 12, name: 'BRK REDDY' }] },
  { train_out: '12604', coach_out: 'S1-S5', train_return: '12603', coach_return: 'S6-S10', label: '12604 / 12603', staff: [{ id: 80, name: 'O ANIL' }] },
  { train_out: '12734', coach_out: 'COR-1', train_return: '20630', coach_return: 'AC', label: '12734 / 20630', staff: [{ id: 10, name: 'K V RAMANA RAO' }] },
  { train_out: '12734', coach_out: 'COR-2', train_return: '17262', coach_return: 'AC', label: '12734 / 17262', staff: [{ id: 18, name: 'R BANGARAIAH' }] },
  { train_out: '12734', coach_out: 'SL', train_return: '20630', coach_return: 'SL', label: '12734 / 20630', staff: [{ id: 22, name: 'SVSR KRISHNA' }] },
  { train_out: '17243', coach_out: 'AC', train_return: '17244', coach_return: 'AC + SL', label: '17243 / 17244', staff: [{ id: 15, name: 'LP KUMAR' }] },
  { train_out: '17243', coach_out: 'SL', train_return: '17244', coach_return: 'SL', label: '17243 / 17244', staff: [{ id: 46, name: 'SK MASTAN BASHA' }] },
  { train_out: '17041', coach_out: 'SL', train_return: '17042', coach_return: 'SL', label: '17041 / 17042', staff: [{ id: 112, name: 'MV ANJANEYULU' }] },
  { train_out: '17077', coach_out: 'AC + SL', train_return: '17078', coach_return: 'AC + SL', label: '17077 / 17078', staff: [{ id: 16, name: 'S PRAKASA RAO' }, { id: 53, name: 'P GOPALA RAO' }] },
  { train_out: '08513', coach_out: 'AC + SL', train_return: null, coach_return: null, label: '08513', staff: [{ id: 31, name: 'K DURGA RAO' }] }
];

async function populateDay(dateStr, dutiesList) {
  console.log(`\n=================================================`);
  console.log(`Populating official register duties for: ${dateStr}`);
  console.log(`=================================================`);

  // 1. Delete existing entries for this date
  const existingEntries = await all(`SELECT id FROM duty_register_entry WHERE date = ?`, [dateStr]);
  for (const ent of existingEntries) {
    await run(`DELETE FROM duty_register_staff WHERE entry_id = ?`, [ent.id]);
  }
  await run(`DELETE FROM duty_register_entry WHERE date = ?`, [dateStr]);
  console.log(`Cleaned existing duty register records for ${dateStr}.`);

  const workingStaffIds = new Set();

  // 2. Insert new entries
  for (const item of dutiesList) {
    const res = await run(
      `INSERT INTO duty_register_entry (date, train_out, coach_out, train_return, coach_return, duty_label)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [dateStr, item.train_out, item.coach_out, item.train_return, item.coach_return, item.label]
    );
    const entryId = res.lastID;

    for (const st of item.staff) {
      workingStaffIds.add(Number(st.id));
      await run(
        `INSERT INTO duty_register_staff (entry_id, staff_id)
         VALUES (?, ?)`,
        [entryId, st.id]
      );
    }
  }
  console.log(`Inserted ${dutiesList.length} train entries with ${workingStaffIds.size} working staff.`);

  // 3. Update Muster Roll and Overrides
  const allStaff = await all(`SELECT id, name FROM staff WHERE (active = 1 OR active IS NULL)`);
  
  // Working staff: Muster = P, remove any leave overrides
  for (const wId of workingStaffIds) {
    const exMus = await all(`SELECT id FROM muster_records WHERE staff_id = ? AND date = ?`, [wId, dateStr]);
    if (exMus && exMus.length > 0) {
      await run(`UPDATE muster_records SET code = 'P', remarks = NULL WHERE staff_id = ? AND date = ?`, [wId, dateStr]);
    } else {
      await run(`INSERT INTO muster_records (staff_id, date, code, remarks) VALUES (?, ?, 'P', NULL)`, [wId, dateStr]);
    }
    await run(`DELETE FROM overrides WHERE staff_id = ? AND date = ? AND status IN ('LEAVE', 'SICK', 'REST', 'ABSENT', 'CR')`, [wId, dateStr]);
    await run(`DELETE FROM leave_requests WHERE staff_id = ? AND (date = ? OR (? BETWEEN from_date AND to_date))`, [wId, dateStr, dateStr]);
  }

  // Missing staff: Muster = CL, overrides = LEAVE (CL)
  const nonWorking = allStaff.filter(s => !workingStaffIds.has(Number(s.id)));
  console.log(`Marking ${nonWorking.length} missing staff as Casual Leave (CL) on ${dateStr}...`);

  for (const nw of nonWorking) {
    const sId = Number(nw.id);
    
    // Muster
    const exMus = await all(`SELECT id FROM muster_records WHERE staff_id = ? AND date = ?`, [sId, dateStr]);
    if (exMus && exMus.length > 0) {
      await run(`UPDATE muster_records SET code = 'CL', remarks = 'Casual Leave' WHERE staff_id = ? AND date = ?`, [sId, dateStr]);
    } else {
      await run(`INSERT INTO muster_records (staff_id, date, code, remarks) VALUES (?, ?, 'CL', 'Casual Leave')`, [sId, dateStr]);
    }

    // Overrides
    const exOv = await all(`SELECT id FROM overrides WHERE staff_id = ? AND date = ?`, [sId, dateStr]);
    if (exOv && exOv.length > 0) {
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

    // Leave request
    const exLv = await all(`SELECT id FROM leave_requests WHERE staff_id = ? AND (date = ? OR (? BETWEEN from_date AND to_date))`, [sId, dateStr, dateStr]);
    if (!exLv || exLv.length === 0) {
      await run(`
        INSERT INTO leave_requests (staff_id, type, from_date, to_date, date, status, reason)
        VALUES (?, 'CL', ?, ?, ?, 'APPROVED', 'Casual Leave')
      `, [sId, dateStr, dateStr, dateStr]);
    } else {
      await run(`UPDATE leave_requests SET type = 'CL', status = 'APPROVED', reason = 'Casual Leave' WHERE id = ?`, [exLv[0].id]);
    }
  }

  console.log(`Completed database updates for ${dateStr}.`);
}

async function main() {
  await initDb();
  await populateDay('2026-11-02', nov2Duties);
  await populateDay('2026-11-03', nov3Duties);
  console.log('\nAll November 2nd and 3rd register entries successfully loaded!');
  process.exit(0);
}

main().catch(console.error);
