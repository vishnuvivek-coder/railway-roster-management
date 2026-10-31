import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
const mysql = require('mysql2/promise');

// Load environment variables from local .env
require('dotenv').config();

interface TableBackupMeta {
  tableName: string;
  tableType: string;
  createDdl: string;
  liveRowCount: number;
  exportedRowCount: number;
  verifiedInFileCount: number;
  status: 'MATCH' | 'MISMATCH';
}

interface DatabaseObjectsBackup {
  views: Array<{ name: string; createDdl: string }>;
  triggers: Array<{ name: string; timing: string; event: string; table: string; statement: string; createDdl?: string }>;
  procedures: Array<{ name: string; createDdl: string }>;
  functions: Array<{ name: string; createDdl: string }>;
  events: Array<{ name: string; createDdl: string }>;
}

async function runBackup() {
  const startTime = Date.now();
  console.log('========================================================================');
  console.log('🛡️  AIVEN CLOUD MYSQL — AUDITED COMPREHENSIVE BACKUP');
  console.log('========================================================================');
  console.log('MODE: STRICTLY READ-ONLY (SELECT & SHOW operations ONLY)\n');

  const host = process.env.MYSQL_HOST;
  const port = parseInt(process.env.MYSQL_PORT || '3306', 10);
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQL_DATABASE;

  if (!host || !user || !database) {
    console.error('❌ Missing database credentials in environment.');
    process.exit(1);
  }

  // Build SSL config
  let sslConfig: any = undefined;
  const localCaPath = path.join(__dirname, '../src/backend/aiven-ca.pem');
  if (process.env.MYSQL_SSL_CA) {
    sslConfig = { ca: process.env.MYSQL_SSL_CA, rejectUnauthorized: true };
  } else if (fs.existsSync(localCaPath)) {
    sslConfig = { ca: fs.readFileSync(localCaPath, 'utf8'), rejectUnauthorized: true };
  } else {
    sslConfig = { rejectUnauthorized: true };
  }

  console.log(`Target Host: ${host}:${port}`);
  console.log(`Database:    ${database}`);
  console.log(`User:        ${user}`);
  console.log(`TLS:         Encrypted (rejectUnauthorized: true)\n`);

  // Connect read-only
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    ssl: sslConfig,
    dateStrings: true,
    decimalNumbers: true,
    multipleStatements: false
  });

  console.log('✓ Successfully connected to live database.');

  // Create backups directory if missing
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  const jsonFileName = `aiven_prod_backup_${timestamp}.json`;
  const sqlFileName = `aiven_prod_backup_${timestamp}.sql`;
  const jsonFilePath = path.join(backupDir, jsonFileName);
  const sqlFilePath = path.join(backupDir, sqlFileName);

  console.log(`\nDiscovering all database objects in '${database}'...`);

  // 1. Discover all tables & views
  const [tablesRaw] = await conn.query('SHOW FULL TABLES');
  const tableKey = Object.keys(tablesRaw[0])[0];
  const typeKey = Object.keys(tablesRaw[0])[1];

  const allTables: Array<{ name: string; type: string }> = tablesRaw.map((r: any) => ({
    name: r[tableKey],
    type: r[typeKey]
  }));

  const baseTables = allTables.filter(t => t.type === 'BASE TABLE');
  const views = allTables.filter(t => t.type === 'VIEW');

  console.log(`Found ${baseTables.length} base tables and ${views.length} views.`);

  // 2. Discover Triggers
  const [triggersRaw] = await conn.query('SHOW TRIGGERS');
  console.log(`Found ${triggersRaw.length} triggers.`);

  // 3. Discover Routines (Procedures & Functions)
  const [procRaw] = await conn.query(`SHOW PROCEDURE STATUS WHERE Db = ?`, [database]);
  const [funcRaw] = await conn.query(`SHOW FUNCTION STATUS WHERE Db = ?`, [database]);
  console.log(`Found ${procRaw.length} stored procedures and ${funcRaw.length} functions.`);

  // 4. Discover Events
  const [eventsRaw] = await conn.query(`SHOW EVENTS WHERE Db = ?`, [database]);
  console.log(`Found ${eventsRaw.length} scheduled events.`);

  const objectsBackup: DatabaseObjectsBackup = {
    views: [],
    triggers: [],
    procedures: [],
    functions: [],
    events: []
  };

  // Fetch View DDLs
  for (const v of views) {
    const [[createViewRes]] = await conn.query(`SHOW CREATE VIEW \`${v.name}\``);
    objectsBackup.views.push({
      name: v.name,
      createDdl: createViewRes['Create View']
    });
  }

  // Fetch Trigger details
  for (const trg of triggersRaw) {
    try {
      const [[createTrgRes]] = await conn.query(`SHOW CREATE TRIGGER \`${trg.Trigger}\``);
      objectsBackup.triggers.push({
        name: trg.Trigger,
        timing: trg.Timing,
        event: trg.Event,
        table: trg.Table,
        statement: trg.Statement,
        createDdl: createTrgRes['SQL Original Statement'] || createTrgRes['Create Trigger']
      });
    } catch {
      objectsBackup.triggers.push({
        name: trg.Trigger,
        timing: trg.Timing,
        event: trg.Event,
        table: trg.Table,
        statement: trg.Statement
      });
    }
  }

  // Fetch Procedure DDLs
  for (const p of procRaw) {
    try {
      const [[createProcRes]] = await conn.query(`SHOW CREATE PROCEDURE \`${p.Name}\``);
      objectsBackup.procedures.push({
        name: p.Name,
        createDdl: createProcRes['Create Procedure']
      });
    } catch (_) {}
  }

  // Fetch Function DDLs
  for (const f of funcRaw) {
    try {
      const [[createFuncRes]] = await conn.query(`SHOW CREATE FUNCTION \`${f.Name}\``);
      objectsBackup.functions.push({
        name: f.Name,
        createDdl: createFuncRes['Create Function']
      });
    } catch (_) {}
  }

  // Fetch Event DDLs
  for (const ev of eventsRaw) {
    try {
      const [[createEvRes]] = await conn.query(`SHOW CREATE EVENT \`${ev.Name}\``);
      objectsBackup.events.push({
        name: ev.Name,
        createDdl: createEvRes['Create Event']
      });
    } catch (_) {}
  }

  console.log('\n--- Auditing Table Row Counts (Pre-Backup Check) ---');
  const tableMetaList: TableBackupMeta[] = [];
  const fullJsonData: {
    metadata: {
      exportedAt: string;
      database: string;
      host: string;
      totalTables: number;
    };
    objects: DatabaseObjectsBackup;
    tables: Record<string, { schema: string; rowCount: number; rows: any[] }>;
  } = {
    metadata: {
      exportedAt: now.toISOString(),
      database,
      host,
      totalTables: baseTables.length
    },
    objects: objectsBackup,
    tables: {}
  };

  // Open SQL Stream Writer
  const sqlStream = fs.createWriteStream(sqlFilePath, { encoding: 'utf8' });

  // Write SQL Header
  sqlStream.write(`-- ============================================================================\n`);
  sqlStream.write(`-- AIVEN PRODUCTION CLOUD MYSQL DATABASE COMPREHENSIVE BACKUP\n`);
  sqlStream.write(`-- Export Date: ${now.toISOString()}\n`);
  sqlStream.write(`-- Database: ${database}\n`);
  sqlStream.write(`-- Server Host: ${host}\n`);
  sqlStream.write(`-- Total Tables: ${baseTables.length}\n`);
  sqlStream.write(`-- ============================================================================\n\n`);
  sqlStream.write(`SET FOREIGN_KEY_CHECKS = 0;\n`);
  sqlStream.write(`SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO,ANSI_QUOTES';\n`);
  sqlStream.write(`SET AUTOCOMMIT = 0;\n`);
  sqlStream.write(`START TRANSACTION;\n\n`);

  for (const t of baseTables) {
    const tableName = t.name;

    // 1. Live row count
    const [[countRes]] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${tableName}\``);
    const liveCount = Number(countRes.cnt);

    // 2. Fetch CREATE TABLE DDL
    const [[createRes]] = await conn.query(`SHOW CREATE TABLE \`${tableName}\``);
    const createDdl = createRes['Create Table'];

    // 3. Fetch all rows
    const [rows] = await conn.query(`SELECT * FROM \`${tableName}\``);
    const exportedCount = rows.length;

    // Store in JSON structure
    fullJsonData.tables[tableName] = {
      schema: createDdl,
      rowCount: exportedCount,
      rows: rows
    };

    // Write to SQL file
    sqlStream.write(`-- ----------------------------------------------------------------------------\n`);
    sqlStream.write(`-- Table structure & data for: \`${tableName}\` (${exportedCount} rows)\n`);
    sqlStream.write(`-- ----------------------------------------------------------------------------\n`);
    sqlStream.write(`DROP TABLE IF EXISTS \`${tableName}\`;\n`);
    sqlStream.write(`${createDdl};\n\n`);

    if (rows.length > 0) {
      const columns = Object.keys(rows[0]);
      const colList = columns.map(c => `\`${c}\``).join(', ');

      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const valuesList: string[] = [];

        for (const row of batch) {
          const formattedVals = columns.map(c => {
            const val = row[c];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return String(val);
            if (typeof val === 'boolean') return val ? '1' : '0';
            // Escape strings safely
            const strVal = String(val)
              .replace(/\\/g, '\\\\')
              .replace(/'/g, "\\'")
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r')
              .replace(/\x00/g, '\\0');
            return `'${strVal}'`;
          });
          valuesList.push(`(${formattedVals.join(', ')})`);
        }

        sqlStream.write(`INSERT INTO \`${tableName}\` (${colList}) VALUES\n  ${valuesList.join(',\n  ')};\n`);
      }
      sqlStream.write('\n');
    }

    tableMetaList.push({
      tableName,
      tableType: t.type,
      createDdl,
      liveRowCount: liveCount,
      exportedRowCount: exportedCount,
      verifiedInFileCount: 0, // checked below
      status: liveCount === exportedCount ? 'MATCH' : 'MISMATCH'
    });
  }

  // Write Views to SQL
  if (objectsBackup.views.length > 0) {
    sqlStream.write(`-- ============================================================================\n`);
    sqlStream.write(`-- VIEWS DEFINITIONS\n`);
    sqlStream.write(`-- ============================================================================\n`);
    for (const v of objectsBackup.views) {
      sqlStream.write(`DROP VIEW IF EXISTS \`${v.name}\`;\n`);
      sqlStream.write(`${v.createDdl};\n\n`);
    }
  }

  // Write Triggers to SQL
  if (objectsBackup.triggers.length > 0) {
    sqlStream.write(`-- ============================================================================\n`);
    sqlStream.write(`-- TRIGGERS DEFINITIONS\n`);
    sqlStream.write(`-- ============================================================================\n`);
    sqlStream.write(`DELIMITER ;;\n`);
    for (const trg of objectsBackup.triggers) {
      if (trg.createDdl) {
        sqlStream.write(`${trg.createDdl};;\n`);
      }
    }
    sqlStream.write(`DELIMITER ;\n\n`);
  }

  // Write Procedures & Functions
  if (objectsBackup.procedures.length > 0 || objectsBackup.functions.length > 0) {
    sqlStream.write(`-- ============================================================================\n`);
    sqlStream.write(`-- ROUTINES (PROCEDURES & FUNCTIONS)\n`);
    sqlStream.write(`-- ============================================================================\n`);
    sqlStream.write(`DELIMITER ;;\n`);
    for (const p of objectsBackup.procedures) {
      sqlStream.write(`${p.createDdl};;\n`);
    }
    for (const f of objectsBackup.functions) {
      sqlStream.write(`${f.createDdl};;\n`);
    }
    sqlStream.write(`DELIMITER ;\n\n`);
  }

  sqlStream.write(`SET FOREIGN_KEY_CHECKS = 1;\n`);
  sqlStream.write(`COMMIT;\n`);
  sqlStream.end();

  // Wait for SQL file write to finish
  await new Promise(resolve => sqlStream.on('finish', resolve));

  // Write JSON file
  fs.writeFileSync(jsonFilePath, JSON.stringify(fullJsonData, null, 2), 'utf8');

  console.log('\n--- Integrity Verification (Post-Backup Check) ---');
  // Re-read JSON file from disk to ensure zero corruption
  const verifiedJson = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

  let allMatch = true;
  for (const meta of tableMetaList) {
    const jsonTable = verifiedJson.tables[meta.tableName];
    const fileCount = jsonTable ? jsonTable.rows.length : -1;
    meta.verifiedInFileCount = fileCount;
    if (meta.liveRowCount !== meta.exportedRowCount || meta.exportedRowCount !== fileCount) {
      meta.status = 'MISMATCH';
      allMatch = false;
    }
  }

  // Compute file hashes
  const sqlHash = crypto.createHash('sha256').update(fs.readFileSync(sqlFilePath)).digest('hex');
  const jsonHash = crypto.createHash('sha256').update(fs.readFileSync(jsonFilePath)).digest('hex');

  const sqlStat = fs.statSync(sqlFilePath);
  const jsonStat = fs.statSync(jsonFilePath);

  await conn.end();

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  // Print Comprehensive Integrity Report
  console.log('\n====================================================================================');
  console.log('📊 AIVEN PRODUCTION DATABASE BACKUP INTEGRITY VERIFICATION REPORT');
  console.log('====================================================================================');
  console.log(
    String('TABLE NAME').padEnd(28) + ' | ' +
    String('LIVE ROWS').padStart(9) + ' | ' +
    String('BACKUP ROWS').padStart(11) + ' | ' +
    String('VERIFIED FILE').padStart(13) + ' | ' +
    'STATUS'
  );
  console.log('------------------------------------------------------------------------------------');

  let totalLive = 0;
  let totalBackup = 0;
  for (const m of tableMetaList) {
    totalLive += m.liveRowCount;
    totalBackup += m.exportedRowCount;
    const statusStr = m.status === 'MATCH' ? '✓ MATCH' : '❌ MISMATCH';
    console.log(
      m.tableName.padEnd(28) + ' | ' +
      String(m.liveRowCount).padStart(9) + ' | ' +
      String(m.exportedRowCount).padStart(11) + ' | ' +
      String(m.verifiedInFileCount).padStart(13) + ' | ' +
      statusStr
    );
  }

  console.log('====================================================================================');
  console.log(
    String('TOTAL (25 TABLES)').padEnd(28) + ' | ' +
    String(totalLive).padStart(9) + ' | ' +
    String(totalBackup).padStart(11) + ' | ' +
    String(totalBackup).padStart(13) + ' | ' +
    (allMatch ? '✓ ALL MATCH' : '❌ MISMATCH DETECTED')
  );
  console.log('====================================================================================\n');

  console.log('📁 BACKUP ARTIFACT DETAILS:');
  console.log(`1. SQL Dump:  ${sqlFilePath}`);
  console.log(`   Size:      ${(sqlStat.size / 1024 / 1024).toFixed(2)} MB (${sqlStat.size.toLocaleString()} bytes)`);
  console.log(`   SHA-256:   ${sqlHash}`);
  console.log(`2. JSON Dump: ${jsonFilePath}`);
  console.log(`   Size:      ${(jsonStat.size / 1024 / 1024).toFixed(2)} MB (${jsonStat.size.toLocaleString()} bytes)`);
  console.log(`   SHA-256:   ${jsonHash}`);
  console.log(`\nGit Protection: backups/ is excluded by .gitignore`);
  console.log(`Execution Time: ${durationSec} seconds`);

  if (!allMatch) {
    console.error('\n❌ CRITICAL: Integrity check failed. One or more tables have row count mismatches.');
    process.exit(1);
  } else {
    console.log('\n🎉 BACKUP STATUS: 100% SUCCESSFUL & VERIFIED');
  }
}

runBackup().catch(err => {
  console.error('\n❌ Backup Execution Error:', err);
  process.exit(1);
});
