const db = require('./src/backend/db.js');

async function applyChanges() {
  console.log('=== APPLYING OCTOBER 2026 ROSTER CHANGES ===');

  // 1. Publish Draft Set #7 (56 Sleeper links) for Category 2
  console.log('\n--- 1. Publishing Draft Set #7 for Category 2 ---');
  const effDate = '2026-10-01';
  const prevEnd = '2026-09-30';

  await db.run(
    `UPDATE link_sets 
     SET status = 'published',
         effective_from = ?,
         effective_to = '9999-12-31',
         updated_at = CURRENT_TIMESTAMP
     WHERE id = 7`,
    [effDate]
  );

  await db.run(
    `UPDATE links 
     SET status = 'published',
         effective_from = ?,
         effective_to = '9999-12-31'
     WHERE link_set_id = 7`,
    [effDate]
  );

  await db.run(
    `UPDATE link_sets 
     SET effective_to = ? 
     WHERE category_id = 2 AND id != 7 AND status = 'published' AND date(effective_from) < date(?)`,
    [prevEnd, effDate]
  );

  await db.run(
    `UPDATE links 
     SET effective_to = ? 
     WHERE category_id = 2 AND (link_set_id != 7 OR link_set_id IS NULL) AND (status = 'published' OR status IS NULL OR status = '') AND date(effective_from) < date(?)`,
    [prevEnd, effDate]
  );
  console.log('✔ Published Link Set #7 and capped previous Sleeper links to 2026-09-30');

  // 2. Update Categories (Anchor dates and cycle length)
  console.log('\n--- 2. Updating Categories Anchor Dates and Cycle Lengths ---');
  await db.run('UPDATE categories SET anchor_date = ?, cycle_length = 21 WHERE id = 1', [effDate]);
  await db.run('UPDATE categories SET anchor_date = ?, cycle_length = 56 WHERE id = 2', [effDate]);
  await db.run('UPDATE categories SET anchor_date = ?, cycle_length = 7 WHERE id = 3', [effDate]);
  console.log('✔ Categories updated: Cat 1 (anchor: 2026-10-01, cycle: 21), Cat 2 (anchor: 2026-10-01, cycle: 56), Cat 3 (anchor: 2026-10-01, cycle: 7)');

  // 3. Update Category 1 (COR) Staff Row Positions & Designations
  console.log('\n--- 3. Updating Category 1 (COR) Staff ---');
  const cat1StaffOrder = [
    'M KESHAVULU', 'S NAGALINGAPPA', 'LP KUMAR', 'S PRAKASA RAO', 'BV RAO',
    'R BANGARAIAH', 'PRM ALI KHAN', 'VAN REDDY', 'MN RAO', 'KAKI SRINIVASARAO',
    'K RAMANAIAH', 'I DASARADHI', 'BP RAJA KUMAR', 'TRS REDDY', 'KRM REDDY',
    'CH RAMESH BABU', 'M SRINIVASULU', 'VV PAVAN KUMAR', 'K V RAMANA RAO', 'SK SALEEM',
    'BRK REDDY'
  ];

  // Temporarily shift row positions to avoid UNIQUE constraint
  await db.run('UPDATE staff SET row_position = -(id + 10000) WHERE category_id = 1');

  const currentCat1 = await db.all('SELECT id, name FROM staff WHERE category_id = 1');
  for (let i = 0; i < cat1StaffOrder.length; i++) {
    const targetName = cat1StaffOrder[i];
    const match = currentCat1.find(s => 
      s.name.toUpperCase().replace(/\s+/g, '') === targetName.toUpperCase().replace(/\s+/g, '')
    );
    if (match) {
      await db.run('UPDATE staff SET row_position = ? WHERE id = ?', [i + 1, match.id]);
    } else {
      console.warn('Could not find Cat 1 match for:', targetName);
    }
  }
  // Update BP RAJA KUMAR designation to CTI
  await db.run("UPDATE staff SET designation = 'CTI' WHERE category_id = 1 AND name LIKE '%RAJA KUMAR%'");
  console.log('✔ Category 1 staff row positions updated (1 to 21) starting with M KESHAVULU');

  // 4. Update Category 3 (Ladies) Staff
  console.log('\n--- 4. Updating Category 3 (Ladies) Staff ---');
  // S HYMA TULASI (id 118) moves to Cat 3, SD SHAHEDA (id 89) moves to Cat 4
  await db.run("UPDATE staff SET category_id = 3, designation = 'SRCCTC' WHERE name LIKE '%HYMA TULASI%'");
  await db.run("UPDATE staff SET category_id = 4, row_position = 22 WHERE name LIKE '%SHAHEDA%'");

  const cat3StaffOrder = [
    'B KEZIA KUMARI', 'EV RAMANAMMA', 'V UMADEVI', 'VS CHANDRIKA',
    'M SIVA KUMARI', 'S HYMA TULASI', 'K SIVA PARVATHI'
  ];

  // Temporarily shift row positions to avoid UNIQUE constraint
  await db.run('UPDATE staff SET row_position = -(id + 10000) WHERE category_id = 3');

  const currentCat3 = await db.all('SELECT id, name FROM staff WHERE category_id = 3');
  for (let i = 0; i < cat3StaffOrder.length; i++) {
    const targetName = cat3StaffOrder[i];
    const match = currentCat3.find(s => 
      s.name.toUpperCase().replace(/\s+/g, '') === targetName.toUpperCase().replace(/\s+/g, '')
    );
    if (match) {
      await db.run('UPDATE staff SET row_position = ? WHERE id = ?', [i + 1, match.id]);
    } else {
      console.warn('Could not find Cat 3 match for:', targetName);
    }
  }
  // Update VS CHANDRIKA designation to CTI
  await db.run("UPDATE staff SET designation = 'CTI' WHERE category_id = 3 AND name LIKE '%CHANDRIKA%'");
  console.log('✔ Category 3 staff updated: S HYMA TULASI added, row positions 1 to 7 set');

  // 5. Update Category 2 (Sleeper) Staff
  console.log('\n--- 5. Updating Category 2 (Sleeper) Staff ---');
  const octSleeperStaff = [
    { name: 'PV SUBBA RAO', isVacant: false },
    { name: 'VA CHAKRAVARTHI', isVacant: false },
    { name: 'VACANT (V)', isVacant: true },
    { name: 'K NARESH', isVacant: false },
    { name: 'D VANIL KUMAR', isVacant: false },
    { name: 'K KUSHWANTH SINGH', isVacant: false },
    { name: 'K KOTI REDDY', isVacant: false },
    { name: 'Y MURALI KRISHNA', isVacant: false },
    { name: 'VACANT (V)', isVacant: true },
    { name: 'T SRIHARSHA', isVacant: false },
    { name: 'Y SRIKANTH', isVacant: false },
    { name: 'VACANT (V)', isVacant: true },
    { name: 'VACANT (V)', isVacant: true },
    { name: 'B RAJA KUMAR', isVacant: false },
    { name: 'VACANT (V)', isVacant: true },
    { name: 'K GOPI', isVacant: false },
    { name: 'P KRISHNA MOHAN', isVacant: false },
    { name: 'D ANVESH', isVacant: false },
    { name: 'Y KORNELU BABU', isVacant: false },
    { name: 'P GOPALA RAO', isVacant: false },
    { name: 'G VARADARAJULU', isVacant: false },
    { name: 'S SUBRAHMANYAM', isVacant: false },
    { name: 'D KHADER BASH', isVacant: false },
    { name: 'A VENKI REDDY', isVacant: false },
    { name: 'P RAVI KUMAR', isVacant: false },
    { name: 'O ANIL', isVacant: false },
    { name: 'VACANT (V)', isVacant: true },
    { name: 'SK JHA', isVacant: false },
    { name: 'SH MADHU BABU', isVacant: false },
    { name: 'K KRANTHI KUMAR', isVacant: false },
    { name: 'SVSR KRISHNA', isVacant: false },
    { name: 'J VINAY KUMAR', isVacant: false },
    { name: 'BVS REDDY', isVacant: false },
    { name: 'RNR NAIK', isVacant: false },
    { name: 'NRC REDDY', isVacant: false },
    { name: 'VACANT (V)', isVacant: true },
    { name: 'P BALA KRISHNA', isVacant: false },
    { name: 'N SWARNA BABU', isVacant: false },
    { name: 'SK KHASIM', isVacant: false },
    { name: 'K DURGA RAO', isVacant: false },
    { name: 'SK KARIMULLAH', isVacant: false },
    { name: 'N KISHAN KUMAR', isVacant: false },
    { name: 'KV SURESH', isVacant: false },
    { name: 'VACANT (V)', isVacant: true },
    { name: 'M NAGARAJU', isVacant: false },
    { name: 'U RAMA KRISHNA', isVacant: false },
    { name: 'M SURESH', isVacant: false },
    { name: 'U BALA JOJI', isVacant: false },
    { name: 'B PAVAN KUMAR', isVacant: false },
    { name: 'SUVVADA SRINU', isVacant: false },
    { name: 'N VENKATESH', isVacant: false },
    { name: 'T SIVA KUMAR', isVacant: false },
    { name: 'KVB SANKAR', isVacant: false },
    { name: 'M VENKATESWARLU', isVacant: false },
    { name: 'SK MASTAN BASHA', isVacant: false },
    { name: 'B SURESH', isVacant: false }
  ];

  // Temporarily shift row positions to avoid UNIQUE constraint
  await db.run('UPDATE staff SET row_position = -(id + 10000) WHERE category_id = 2');

  const currentCat2 = await db.all('SELECT id, name, designation, row_position FROM staff WHERE category_id = 2');
  const usedStaffIds = new Set();
  const vacantStaffList = currentCat2.filter(s => s.name.startsWith('VACANT'));
  let vacantIdx = 0;

  for (let i = 0; i < octSleeperStaff.length; i++) {
    const item = octSleeperStaff[i];
    const targetRow = i + 1;
    if (item.isVacant) {
      if (vacantIdx < vacantStaffList.length) {
        const vStaff = vacantStaffList[vacantIdx++];
        usedStaffIds.add(vStaff.id);
        await db.run('UPDATE staff SET row_position = ?, active = 1 WHERE id = ?', [targetRow, vStaff.id]);
      }
    } else {
      const match = currentCat2.find(s => 
        !s.name.startsWith('VACANT') && (
          s.name.toUpperCase().replace(/\s+/g, '') === item.name.toUpperCase().replace(/\s+/g, '') ||
          s.name.toUpperCase().includes(item.name.toUpperCase()) ||
          item.name.toUpperCase().includes(s.name.toUpperCase())
        )
      );
      if (match) {
        usedStaffIds.add(match.id);
        await db.run('UPDATE staff SET row_position = ?, active = 1 WHERE id = ?', [targetRow, match.id]);
      } else {
        console.warn('Could not find Cat 2 staff match for:', item.name);
      }
    }
  }

  // Deactivate unused staff in Category 2 (the 7 excess vacant rows)
  for (const s of currentCat2) {
    if (!usedStaffIds.has(s.id)) {
      console.log(`Deleting unused excess vacant staff #${s.id} "${s.name}" from Cat 2`);
      await db.run('DELETE FROM staff WHERE id = ?', [s.id]);
    }
  }

  console.log(`✔ Category 2 staff row positions updated (1 to 56) matching October chart`);

  // Log in audit_logs
  await db.run(
    `INSERT INTO audit_logs (user_role, action_type, description, timestamp, undo_data, is_undone)
     VALUES ('Admin', 'APPLY_OCTOBER_ROSTER', 'Applied October 2026 official rotation chart changes across Categories 1, 2, 3', CURRENT_TIMESTAMP, NULL, 0)`
  );

  console.log('\n=== OCTOBER 2026 ROSTER CHANGES SUCCESSFULLY APPLIED! ===');
}

applyChanges()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error applying October roster changes:', err);
    process.exit(1);
  });
