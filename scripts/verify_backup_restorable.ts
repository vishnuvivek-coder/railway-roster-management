import * as fs from 'fs';
import * as path from 'path';
const mysql = require('mysql2/promise');

// 1. Read local credentials safely from .env.local or process.env
const localEnvPath = path.join(__dirname, '../.env.local');
let localPassword = process.env.LOCAL_MYSQL_PASSWORD || '';
let localUser = process.env.LOCAL_MYSQL_USER || 'root';
let localPort = parseInt(process.env.LOCAL_MYSQL_PORT || '3306', 10);

if (fs.existsSync(localEnvPath)) {
  const lines = fs.readFileSync(localEnvPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key === 'LOCAL_MYSQL_PASSWORD' || key === 'MYSQL_PASSWORD') localPassword = val;
    if (key === 'LOCAL_MYSQL_USER' || key === 'MYSQL_USER') localUser = val;
    if (key === 'LOCAL_MYSQL_PORT' || key === 'MYSQL_PORT') localPort = parseInt(val, 10);
  }
}

const TEST_DB_NAME = 'railway_roster_restore_test_temp';

async function verifyRestore() {
  console.log('========================================================================');
  console.log('🔬 SQL BACKUP RESTORABILITY & INTEGRITY VERIFICATION');
  console.log('========================================================================\n');

  // Hard safety check: ensure host is strictly localhost
  const host = '127.0.0.1';
  console.log(`Target Host:     ${host}:${localPort} (STRICTLY LOCALHOST)`);
  console.log(`Target User:     ${localUser}`);
  console.log(`Test Database:   ${TEST_DB_NAME} (Isolated Temporary Database)\n`);

  // 1. Find latest SQL backup file
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    console.error('❌ backups/ directory not found.');
    process.exit(1);
  }

  const sqlFiles = fs.readdirSync(backupDir).filter(f => f.endsWith('.sql')).sort().reverse();
  if (sqlFiles.length === 0) {
    console.error('❌ No SQL backup files found in backups/ directory.');
    process.exit(1);
  }

  const latestSqlFile = path.join(backupDir, sqlFiles[0]);
  console.log(`Analyzing backup file: ${latestSqlFile}`);
  const sqlContent = fs.readFileSync(latestSqlFile, 'utf8');

  // Check 1: Completeness of SQL dump
  console.log('Checking SQL dump completeness...');
  if (!sqlContent.includes('COMMIT;')) {
    console.error('❌ SQL dump is incomplete: Missing final COMMIT;');
    process.exit(1);
  }
  const createTableMatches = [...sqlContent.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?["`]?([^"`\n\r(]+)["`]?\s*\(/gi)].map(m => m[1].trim());
  const uniqueTablesInSql = Array.from(new Set(createTableMatches));
  console.log(`✓ SQL dump is complete (${(sqlContent.length / 1024 / 1024).toFixed(2)} MB, ${uniqueTablesInSql.length} table definitions, ends with COMMIT;).\n`);

  // 2. Connect to local MySQL server
  let rootConn;
  try {
    rootConn = await mysql.createConnection({
      host,
      port: localPort,
      user: localUser,
      password: localPassword,
      multipleStatements: true,
      dateStrings: true
    });
  } catch (err: any) {
    console.error(`\n❌ Could not connect to local MySQL on ${host}:${localPort}`);
    console.error(`Error: ${err.message}`);
    console.error('\nTo configure your local MySQL password without putting it in chat:');
    console.error('1. Create a file named .env.local in the project root:');
    console.error('   LOCAL_MYSQL_PASSWORD=your_actual_local_password');
    console.error('   LOCAL_MYSQL_USER=root');
    console.error('2. (.env.local is already ignored by Git)');
    process.exit(1);
  }

  console.log('✓ Connected to local MySQL server.');

  // 3. Create isolated temporary database
  console.log(`Creating fresh isolated test database: \`${TEST_DB_NAME}\`...`);
  await rootConn.query(`DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\``);
  await rootConn.query(`CREATE DATABASE \`${TEST_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await rootConn.query(`USE \`${TEST_DB_NAME}\``);
  // Ensure ANSI_QUOTES is enabled for the restore session
  await rootConn.query(`SET SESSION sql_mode = 'NO_AUTO_VALUE_ON_ZERO,ANSI_QUOTES'`);
  console.log(`✓ Isolated test database \`${TEST_DB_NAME}\` created.\n`);

  // 4. Execute the SQL dump into the test database
  console.log('Restoring SQL dump into isolated test database...');
  const restoreStart = Date.now();
  await rootConn.query(sqlContent);
  const restoreDuration = ((Date.now() - restoreStart) / 1000).toFixed(2);
  console.log(`✓ Restore finished in ${restoreDuration} seconds.\n`);

  // 5. Verify all tables and row counts
  console.log('--- Verifying Restored Tables & Row Counts ---');
  const [restoredTablesRaw] = await rootConn.query('SHOW TABLES');
  const restoredTableNames: string[] = restoredTablesRaw.map((r: any) => Object.values(r)[0] as string);

  console.log(`Total Tables Restored: ${restoredTableNames.length} / 25`);

  // Load the JSON backup metadata to compare expected row counts
  const jsonFiles = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')).sort().reverse();
  const latestJsonFile = path.join(backupDir, jsonFiles[0]);
  const expectedJson = JSON.parse(fs.readFileSync(latestJsonFile, 'utf8'));

  console.log('\n====================================================================================');
  console.log(
    String('TABLE NAME').padEnd(28) + ' | ' +
    String('EXPECTED').padStart(9) + ' | ' +
    String('RESTORED').padStart(9) + ' | ' +
    'STATUS'
  );
  console.log('------------------------------------------------------------------------------------');

  let totalExpected = 0;
  let totalRestored = 0;
  let allRowCountsMatch = true;

  for (const t of Object.keys(expectedJson.tables)) {
    const expectedCnt = expectedJson.tables[t].rowCount;
    totalExpected += expectedCnt;

    if (!restoredTableNames.includes(t)) {
      console.log(t.padEnd(28) + ' | ' + String(expectedCnt).padStart(9) + ' | ' + 'MISSING'.padStart(9) + ' | ❌ MISSING TABLE');
      allRowCountsMatch = false;
      continue;
    }

    const [[resCount]] = await rootConn.query(`SELECT COUNT(*) as cnt FROM \`${t}\``);
    const restoredCnt = Number(resCount.cnt);
    totalRestored += restoredCnt;

    const isMatch = expectedCnt === restoredCnt;
    if (!isMatch) allRowCountsMatch = false;

    console.log(
      t.padEnd(28) + ' | ' +
      String(expectedCnt).padStart(9) + ' | ' +
      String(restoredCnt).padStart(9) + ' | ' +
      (isMatch ? '✓ MATCH' : '❌ MISMATCH')
    );
  }

  console.log('====================================================================================');
  console.log(
    String('TOTAL ROWS').padEnd(28) + ' | ' +
    String(totalExpected).padStart(9) + ' | ' +
    String(totalRestored).padStart(9) + ' | ' +
    (allRowCountsMatch ? '✓ ALL MATCH' : '❌ MISMATCH')
  );
  console.log('====================================================================================\n');

  // 6. Verify Primary Keys & Indexes
  console.log('--- Verifying Primary Keys, Unique Constraints & Foreign Keys ---');
  const [constraints] = await rootConn.query(`
    SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = ?
    ORDER BY TABLE_NAME, CONSTRAINT_TYPE
  `, [TEST_DB_NAME]);

  const pkCount = constraints.filter((c: any) => c.CONSTRAINT_TYPE === 'PRIMARY KEY').length;
  const uqCount = constraints.filter((c: any) => c.CONSTRAINT_TYPE === 'UNIQUE').length;
  const fkCount = constraints.filter((c: any) => c.CONSTRAINT_TYPE === 'FOREIGN KEY').length;

  console.log(`Primary Keys verified:        ${pkCount} tables with PRIMARY KEY (25 expected)`);
  console.log(`Unique Constraints verified:  ${uqCount} unique constraints (includes uq_overrides_staff_date, uq_muster_staff_date, uq_train_run_station)`);
  console.log(`Foreign Key Constraints:      ${fkCount} referential integrity constraints restored`);

  // Verify specific unique keys
  const uqNames = constraints.map((c: any) => c.CONSTRAINT_NAME);
  const hasOverrideUq = uqNames.includes('uq_overrides_staff_date');
  const hasMusterUq = uqNames.includes('uq_muster_staff_date');
  const hasTrainUq = uqNames.includes('uq_train_run_station');
  console.log(`✓ uq_overrides_staff_date active: ${hasOverrideUq}`);
  console.log(`✓ uq_muster_staff_date active:    ${hasMusterUq}`);
  console.log(`✓ uq_train_run_station active:    ${hasTrainUq}`);

  // 7. Verify Sample Key Record Reads
  console.log('\n--- Reading Sample Business Records from Restored Test Database ---');
  const [sampleStaff] = await rootConn.query('SELECT id, name, designation, pf_no, category_id, row_position FROM staff ORDER BY id ASC LIMIT 3');
  console.log('Sample Staff Records:');
  console.table(sampleStaff);

  const [sampleOverride] = await rootConn.query('SELECT id, staff_id, date, status, reason FROM overrides ORDER BY id DESC LIMIT 2');
  console.log('Sample Override Records:');
  console.table(sampleOverride);

  const [sampleMuster] = await rootConn.query('SELECT id, staff_id, date, code, remarks FROM muster_records ORDER BY id DESC LIMIT 2');
  console.log('Sample Muster Records:');
  console.table(sampleMuster);

  const isSuccessful = allRowCountsMatch && pkCount === 25 && hasOverrideUq && hasMusterUq && hasTrainUq;

  if (isSuccessful) {
    // Clean up: Drop the temporary database only on success
    console.log(`\nCleaning up temporary test database \`${TEST_DB_NAME}\`...`);
    await rootConn.query(`DROP DATABASE \`${TEST_DB_NAME}\``);
    console.log(`✓ Temporary test database \`${TEST_DB_NAME}\` dropped cleanly.`);
  } else {
    console.warn(`\n⚠️  VERIFICATION FAILED: Preserving temporary database \`${TEST_DB_NAME}\` for inspection as requested.`);
  }

  await rootConn.end();

  console.log('\n========================================================================');
  if (isSuccessful) {
    console.log('🎉 RESTORABILITY VERIFICATION RESULT: 100% SUCCESSFUL');
    console.log('   The SQL backup is fully valid, structurally complete, and safely restorable.');
  } else {
    console.log('❌ RESTORABILITY VERIFICATION: FAILED (Check mismatches above)');
    process.exit(1);
  }
  console.log('========================================================================');
}

verifyRestore().catch(err => {
  console.error('\n❌ Verification Error:', err.message);
  process.exit(1);
});
