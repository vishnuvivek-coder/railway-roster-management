import * as fs from 'fs';
import * as path from 'path';
const mysql = require('mysql2/promise');
require('dotenv').config();

interface StaffUpdate {
  id: number;
  expectedName?: string;
  category_id?: number;
  row_position: number;
  name?: string;
  designation?: string;
  comment: string;
}

const staffUpdates: StaffUpdate[] = [
  { id: 1, row_position: 10, comment: 'KAKI SRINIVASARAO' },
  { id: 2, row_position: 11, comment: 'K RAMANAIAH' },
  { id: 3, row_position: 12, comment: 'I DASARADHI' },
  { id: 4, row_position: 13, comment: 'BP RAJA KUMAR' },
  { id: 5, row_position: 14, comment: 'TRS REDDY' },
  { id: 6, row_position: 15, comment: 'KRM REDDY' },
  { id: 7, row_position: 16, comment: 'CH RAMESH BABU' },
  { id: 8, row_position: 17, comment: 'M SRINIVASULU' },
  { id: 9, name: 'VV PAVAN KUMAR', designation: 'CTI', category_id: 1, row_position: 18, comment: 'VV PAVAN KUMAR' },
  { id: 10, row_position: 19, comment: 'K V RAMANA RAO' },
  { id: 11, row_position: 20, comment: 'SK SALEEM' },
  { id: 12, row_position: 21, comment: 'BRK REDDY' },
  { id: 13, row_position: 1, comment: 'M KESHAVULU' },
  { id: 14, row_position: 2, comment: 'S NAGALINGAPPA' },
  { id: 15, row_position: 3, comment: 'LP KUMAR' },
  { id: 16, row_position: 4, comment: 'S PRAKASA RAO' },
  { id: 17, row_position: 5, comment: 'BV RAO' },
  { id: 18, row_position: 6, comment: 'R BANGARAIAH' },
  { id: 19, row_position: 7, comment: 'PRM ALI KHAN' },
  { id: 20, row_position: 8, comment: 'VAN REDDY' },
  { id: 21, row_position: 9, comment: 'MN RAO' },
  { id: 22, row_position: 31, comment: 'SVSR KRISHNA' },
  { id: 23, row_position: 32, comment: 'J VINAY KUMAR' },
  { id: 24, row_position: 33, comment: 'BVS REDDY' },
  { id: 25, row_position: 34, comment: 'RNR NAIK' },
  { id: 26, row_position: 35, comment: 'NRC REDDY' },
  { id: 28, row_position: 37, comment: 'P BALA KRISHNA' },
  { id: 30, row_position: 39, comment: 'SK KHASIM' },
  { id: 31, row_position: 40, comment: 'K DURGA RAO' },
  { id: 32, row_position: 41, comment: 'SK KARIMULLAH' },
  { id: 34, row_position: 43, comment: 'KV SURESH' },
  { id: 36, row_position: 45, comment: 'M NAGARAJU' },
  { id: 37, row_position: 46, comment: 'U RAMA KRISHNA' },
  { id: 38, row_position: 47, comment: 'M SURESH' },
  { id: 39, row_position: 48, comment: 'U BALA JOJI' },
  { id: 40, row_position: 49, comment: 'B PAVAN KUMAR' },
  { id: 41, row_position: 50, comment: 'SUVVADA SRINU' },
  { id: 42, row_position: 51, comment: 'N VENKATESH' },
  { id: 43, row_position: 52, comment: 'T SIVA KUMAR' },
  { id: 44, row_position: 53, comment: 'KVB SANKAR' },
  { id: 45, row_position: 54, comment: 'M VENKATESWARLU' },
  { id: 46, row_position: 55, comment: 'SK MASTAN BASHA' },
  { id: 47, row_position: 56, comment: 'B SURESH' },
  { id: 50, row_position: 38, comment: 'N SWARNA BABU' },
  { id: 51, row_position: 11, comment: 'Y SRIKANTH' },
  { id: 53, row_position: 20, comment: 'P GOPALA RAO' },
  { id: 54, row_position: 7, comment: 'K KOTI REDDY' },
  { id: 55, row_position: 1, comment: 'PV SUBBA RAO' },
  { id: 56, row_position: 2, comment: 'VA CHAKRAVARTHI' },
  { id: 57, category_id: 2, row_position: 44, comment: 'VACANT' },
  { id: 58, row_position: 4, comment: 'K NARESH' },
  { id: 59, row_position: 5, comment: 'D VANIL KUMAR' },
  { id: 60, row_position: 6, comment: 'K KUSHWANTH SINGH' },
  { id: 61, row_position: 42, comment: 'N KISHAN KUMAR' },
  { id: 62, row_position: 8, comment: 'Y MURALI KRISHNA' },
  { id: 63, row_position: 36, comment: 'VACANT (V)' },
  { id: 64, row_position: 10, comment: 'T SRIHARSHA' },
  { id: 65, row_position: 27, comment: 'VACANT (V)' },
  { id: 66, row_position: 15, comment: 'VACANT (V)' },
  { id: 67, row_position: 13, comment: 'VACANT (V)' },
  { id: 68, row_position: 14, comment: 'B RAJA KUMAR' },
  { id: 69, row_position: 12, comment: 'VACANT (V)' },
  { id: 70, row_position: 16, comment: 'K GOPI' },
  { id: 71, row_position: 17, comment: 'P KRISHNA MOHAN' },
  { id: 72, row_position: 18, comment: 'D ANVESH' },
  { id: 73, row_position: 19, comment: 'Y KORNELU BABU' },
  { id: 74, row_position: 9, comment: 'VACANT (V)' },
  { id: 75, row_position: 21, comment: 'G VARADARAJULU' },
  { id: 76, row_position: 22, comment: 'S SUBRAHMANYAM' },
  { id: 77, row_position: 23, comment: 'D KHADER BASH' },
  { id: 78, row_position: 24, comment: 'A VENKI REDDY' },
  { id: 79, row_position: 25, comment: 'P RAVI KUMAR' },
  { id: 80, row_position: 26, comment: 'O ANIL' },
  // ID 81: Preserving SK ASHA BEGUM name, restoring category_id = 2, row_position = 3
  { id: 81, category_id: 2, row_position: 3, comment: 'SK ASHA BEGUM (name preserved)' },
  { id: 82, row_position: 28, comment: 'SK JHA' },
  { id: 83, row_position: 29, comment: 'SH MADHU BABU' },
  { id: 84, row_position: 30, comment: 'K KRANTHI KUMAR' },
  { id: 85, row_position: 3, comment: 'V UMADEVI' },
  { id: 86, row_position: 4, comment: 'VS CHANDRIKA' },
  { id: 87, row_position: 5, comment: 'M SIVA KUMARI' },
  { id: 88, row_position: 7, comment: 'K SIVA PARVATHI' },
  { id: 89, row_position: 20, comment: 'R SAIDA NAIK' },
  { id: 90, row_position: 1, comment: 'B KEZIA KUMARI' },
  { id: 91, row_position: 2, comment: 'EV RAMANAMMA' },
  { id: 101, category_id: 4, row_position: 3, comment: 'G SHIVAN' },
  { id: 102, category_id: 4, row_position: 4, comment: 'MVS NAGI REDDY' },
  { id: 103, row_position: 5, comment: 'B VENKAT REDDY' },
  { id: 104, row_position: 6, comment: 'MSA RAJU' },
  { id: 105, row_position: 7, comment: 'KB RAO' },
  { id: 106, row_position: 8, comment: 'SANJAY KUMAR' },
  { id: 107, row_position: 9, comment: 'NC MEENA' },
  { id: 108, row_position: 10, comment: 'T KANTHA RAO' },
  { id: 109, row_position: 11, comment: 'BR MEENA' },
  { id: 110, row_position: 12, comment: 'T ANKAMMA RAO' },
  { id: 111, row_position: 13, comment: 'MV RAMA REDDY' },
  { id: 112, row_position: 14, comment: 'MV ANJANEYULU' },
  { id: 113, row_position: 15, comment: 'SV SIVA KUMAR' },
  { id: 114, row_position: 16, comment: 'ELN RAO' },
  { id: 115, row_position: 17, comment: 'V SRINIVASA RAO' },
  { id: 116, row_position: 18, comment: 'K NAGA NAIK' },
  { id: 117, row_position: 19, comment: 'B P SINGH' },
  { id: 118, category_id: 3, row_position: 6, comment: 'S HYMA TULASI (Ladies Staff)' },
  { id: 132, row_position: 21, comment: 'S HYMA TULASI (LR Staff)' }
];

async function main() {
  console.log('========================================================================');
  console.log('🛡️  AIVEN CLOUD MYSQL — OCTOBER 2026 ROSTER RESTORATION (TRANSACTIONAL)');
  console.log('========================================================================\n');

  const host = process.env.MYSQL_HOST;
  const port = parseInt(process.env.MYSQL_PORT || '3306', 10);
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQL_DATABASE;

  if (!host || !user || !database) {
    console.error('❌ Missing database credentials in environment.');
    process.exit(1);
  }

  const localCaPath = path.join(__dirname, '../src/backend/aiven-ca.pem');
  let sslConfig: any = undefined;
  if (process.env.MYSQL_SSL_CA) {
    sslConfig = { ca: process.env.MYSQL_SSL_CA, rejectUnauthorized: true };
  } else if (fs.existsSync(localCaPath)) {
    sslConfig = { ca: fs.readFileSync(localCaPath, 'utf8'), rejectUnauthorized: true };
  } else {
    sslConfig = { rejectUnauthorized: true };
  }

  console.log(`Connecting to ${host}:${port}/${database} as ${user}...`);
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    ssl: sslConfig,
    dateStrings: true
  });

  console.log('✅ Connected successfully.\n');

  try {
    // 1. Audit current baseline counts for transactional tables
    console.log('--- Step 1: Pre-Execution Baseline Counts ---');
    const transactionalTables = [
      'overrides',
      'muster_records',
      'ta_entries',
      'nda_entries',
      'duty_register_entry',
      'duty_register_staff',
      'actual_train_runs',
      'daily_earnings_entries',
      'ta_approvals',
      'users',
      'link_sets',
      'links'
    ];

    const baselineCounts: Record<string, number> = {};
    for (const t of transactionalTables) {
      const [rows]: any = await conn.query(`SELECT COUNT(*) as cnt FROM \`${t}\``);
      baselineCounts[t] = rows[0].cnt;
      console.log(`  Table \`${t}\`: ${baselineCounts[t]} rows`);
    }

    // Verify staff 81 current name before update
    const [staff81Rows]: any = await conn.query('SELECT id, name, designation, category_id, row_position FROM staff WHERE id = 81');
    console.log('\n  Current Staff 81 in DB:', staff81Rows[0]);
    if (!staff81Rows[0].name.includes('ASHA BEGUM')) {
      throw new Error(`Safety check failed: Staff 81 name is unexpected: ${staff81Rows[0].name}`);
    }

    console.log(`\nVerified: Exactly ${staffUpdates.length} staff updates planned.`);

    // 2. Begin Transaction
    console.log('\n--- Step 2: Beginning Transaction ---');
    await conn.beginTransaction();
    console.log('✅ Transaction started (START TRANSACTION).');

    // 3. Execute Categories Update
    console.log('\n--- Step 3: Updating Category Anchor Dates ---');
    const [catResult]: any = await conn.query(`
      UPDATE categories 
      SET anchor_date = '2026-10-01' 
      WHERE id IN (1, 2, 3)
    `);
    console.log(`  Categories updated: affectedRows = ${catResult.affectedRows}, changedRows = ${catResult.changedRows || catResult.affectedRows}`);

    // 4. Execute Staff Updates
    console.log('\n--- Step 4: Executing 103 Staff Updates ---');
    let staffUpdatedCount = 0;
    for (const u of staffUpdates) {
      let query = '';
      let params: any[] = [];

      if (u.name !== undefined && u.designation !== undefined && u.category_id !== undefined) {
        query = 'UPDATE staff SET name = ?, designation = ?, category_id = ?, row_position = ? WHERE id = ?';
        params = [u.name, u.designation, u.category_id, u.row_position, u.id];
      } else if (u.category_id !== undefined) {
        query = 'UPDATE staff SET category_id = ?, row_position = ? WHERE id = ?';
        params = [u.category_id, u.row_position, u.id];
      } else {
        query = 'UPDATE staff SET row_position = ? WHERE id = ?';
        params = [u.row_position, u.id];
      }

      const [res]: any = await conn.query(query, params);
      if (res.affectedRows !== 1) {
        throw new Error(`Failed to update staff ID ${u.id}: affectedRows = ${res.affectedRows}`);
      }
      staffUpdatedCount++;
    }
    console.log(`✅ All ${staffUpdatedCount} staff UPDATE statements executed successfully.`);

    // 5. In-Transaction Verification
    console.log('\n--- Step 5: In-Transaction Integrity Verification ---');

    // A. Verify Staff 81
    const [verify81]: any = await conn.query('SELECT id, name, designation, category_id, row_position FROM staff WHERE id = 81');
    console.log('  Staff 81 verified:', verify81[0]);
    if (verify81[0].name !== staff81Rows[0].name || verify81[0].category_id !== 2 || verify81[0].row_position !== 3) {
      throw new Error(`Staff 81 verification failed: ${JSON.stringify(verify81[0])}`);
    }

    // B. Verify Staff 9
    const [verify9]: any = await conn.query('SELECT id, name, designation, category_id, row_position FROM staff WHERE id = 9');
    console.log('  Staff 9 verified:', verify9[0]);
    if (verify9[0].name !== 'VV PAVAN KUMAR' || verify9[0].category_id !== 1 || verify9[0].row_position !== 18) {
      throw new Error(`Staff 9 verification failed: ${JSON.stringify(verify9[0])}`);
    }

    // C. Verify Staff 118 & 132 (Hyma Tulasi)
    const [verify118]: any = await conn.query('SELECT id, name, category_id, row_position FROM staff WHERE id = 118');
    const [verify132]: any = await conn.query('SELECT id, name, category_id, row_position FROM staff WHERE id = 132');
    console.log('  Staff 118 verified:', verify118[0]);
    console.log('  Staff 132 verified:', verify132[0]);
    if (verify118[0].category_id !== 3 || verify118[0].row_position !== 6) {
      throw new Error(`Staff 118 verification failed: ${JSON.stringify(verify118[0])}`);
    }
    if (verify132[0].category_id !== 4 || verify132[0].row_position !== 21) {
      throw new Error(`Staff 132 verification failed: ${JSON.stringify(verify132[0])}`);
    }

    // D. Verify Category 4 Staff List (No duplicate Hyma Tulasi)
    const [cat4Staff]: any = await conn.query('SELECT id, name, row_position FROM staff WHERE category_id = 4 ORDER BY row_position ASC');
    console.log(`  Category 4 Staff count: ${cat4Staff.length}`);
    const hymaTulasiInCat4 = cat4Staff.filter((s: any) => s.name.includes('HYMA TULASI'));
    if (hymaTulasiInCat4.length !== 1) {
      throw new Error(`Expected exactly 1 Hyma Tulasi in Category 4, found ${hymaTulasiInCat4.length}`);
    }
    console.log('  ✅ Category 4 contains exactly 1 Hyma Tulasi (ID: ' + hymaTulasiInCat4[0].id + ')');

    // E. Verify Categories Anchor Dates
    const [catRows]: any = await conn.query('SELECT id, name, anchor_date, cycle_length FROM categories ORDER BY id ASC');
    console.log('  Categories verified:', catRows);
    for (const c of catRows) {
      const anchorStr = String(c.anchor_date);
      if (c.id === 1 && !anchorStr.startsWith('2026-10-01')) throw new Error(`Category 1 anchor mismatch: ${anchorStr}`);
      if (c.id === 2 && !anchorStr.startsWith('2026-10-01')) throw new Error(`Category 2 anchor mismatch: ${anchorStr}`);
      if (c.id === 3 && !anchorStr.startsWith('2026-10-01')) throw new Error(`Category 3 anchor mismatch: ${anchorStr}`);
      if (c.id === 4 && !anchorStr.startsWith('2026-09-01')) throw new Error(`Category 4 anchor mismatch: ${anchorStr}`);
    }

    // F. Verify Transactional Tables are UNTOUCHED
    console.log('\n  Checking transactional tables row counts...');
    for (const t of transactionalTables) {
      const [rows]: any = await conn.query(`SELECT COUNT(*) as cnt FROM \`${t}\``);
      const postCount = rows[0].cnt;
      if (postCount !== baselineCounts[t]) {
        throw new Error(`Transactional table \`${t}\` was modified! Expected ${baselineCounts[t]}, got ${postCount}`);
      }
      console.log(`  ✅ Table \`${t}\`: row count unchanged (${postCount})`);
    }

    // 6. Commit Transaction
    console.log('\n--- Step 6: Committing Transaction ---');
    await conn.commit();
    console.log('🎉 TRANSACTION COMMITTED SUCCESSFULLY! All changes are permanent.');

  } catch (err: any) {
    console.error('\n❌ ERROR ENCOUNTERED! ROLLING BACK TRANSACTION...');
    console.error(err);
    await conn.rollback();
    console.log('🛡️ Transaction rolled back. Database is in its original state.');
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
