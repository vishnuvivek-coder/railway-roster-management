import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';

const sqliteDbPath = path.join(__dirname, 'roster.db');
const sqlDumpPath = path.join(__dirname, 'database_dump.sql');

async function syncMysqlToSqlite() {
  console.log('================================================================');
  console.log('🚆 RAILWAY ROSTER MANAGER — MYSQL TO SQLITE & DUMP SYNC');
  console.log('================================================================\n');

  const host = process.env.MYSQL_HOST || 'localhost';
  const port = parseInt(process.env.MYSQL_PORT, 10) || 3306;
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'defaultdb';

  console.log(`Connecting to MySQL at ${host}:${port}/${database}...`);
  const mysqlConn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    dateStrings: true
  });
  console.log('✓ Connected to MySQL successfully.\n');

  // Open SQLite database
  console.log(`Opening SQLite target at ${sqliteDbPath}...`);
  const sqlite = new sqlite3.Database(sqliteDbPath);

  const sqliteRun = (sql: string, params: any[] = []): Promise<any> => {
    return new Promise((resolve, reject) => {
      sqlite.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  };

  const sqliteAll = (sql: string, params: any[] = []): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      sqlite.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  };

  await sqliteRun('PRAGMA foreign_keys = OFF;');
  await sqliteRun('PRAGMA busy_timeout = 10000;');

  // Fetch all MySQL tables
  const [tablesResult]: any = await mysqlConn.query('SHOW TABLES');
  const tableKey = Object.keys(tablesResult[0])[0];
  const tables: string[] = tablesResult.map((t: any) => t[tableKey]);

  console.log(`Found ${tables.length} tables in MySQL:`, tables.join(', '));
  console.log('\nSynchronizing tables and data...\n');

  const dumpSqlLines: string[] = [
    `-- ============================================================================`,
    `-- RAILWAY ROSTER MANAGER — COMPLETE DATABASE SNAPSHOT DUMP`,
    `-- Exported At: ${new Date().toISOString()}`,
    `-- Source Database: ${database} (${host})`,
    `-- ============================================================================`,
    `SET FOREIGN_KEY_CHECKS = 0;\n`
  ];

  for (const tableName of tables) {
    // 1. Get MySQL table columns and types
    const [cols]: any = await mysqlConn.query(`DESCRIBE \`${tableName}\``);
    const colDefsSqlite: string[] = [];
    const colNames: string[] = [];

    for (const col of cols) {
      colNames.push(col.Field);
      let sqliteType = 'TEXT';
      const mType = (col.Type || '').toLowerCase();
      if (mType.includes('int')) sqliteType = 'INTEGER';
      else if (mType.includes('decimal') || mType.includes('float') || mType.includes('double')) sqliteType = 'REAL';
      else if (mType.includes('blob')) sqliteType = 'BLOB';
      
      let def = `\`${col.Field}\` ${sqliteType}`;
      if (col.Key === 'PRI' && cols.filter((c: any) => c.Key === 'PRI').length === 1 && sqliteType === 'INTEGER') {
        def += ' PRIMARY KEY';
        if (col.Extra && col.Extra.includes('auto_increment')) {
          def += ' AUTOINCREMENT';
        }
      }
      colDefsSqlite.push(def);
    }

    // 2. Ensure table exists in SQLite
    await sqliteRun(`CREATE TABLE IF NOT EXISTS \`${tableName}\` (${colDefsSqlite.join(', ')});`);

    // Ensure all columns exist in SQLite (if table existed with fewer columns)
    const sqliteCols = await sqliteAll(`PRAGMA table_info(\`${tableName}\`);`);
    const existingColNames = new Set(sqliteCols.map((c: any) => c.name));
    for (const col of cols) {
      if (!existingColNames.has(col.Field)) {
        let sqliteType = 'TEXT';
        const mType = (col.Type || '').toLowerCase();
        if (mType.includes('int')) sqliteType = 'INTEGER';
        else if (mType.includes('decimal') || mType.includes('float') || mType.includes('double')) sqliteType = 'REAL';
        console.log(`Adding missing column \`${col.Field}\` to SQLite table \`${tableName}\`...`);
        try {
          await sqliteRun(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${col.Field}\` ${sqliteType};`);
        } catch (e: any) {
          console.warn(`  Warning adding column ${col.Field}:`, e.message);
        }
      }
    }

    // 3. Clear SQLite table
    await sqliteRun(`DELETE FROM \`${tableName}\`;`);

    // 4. Fetch all rows from MySQL
    const [rows]: any = await mysqlConn.query(`SELECT * FROM \`${tableName}\``);
    
    // Dump table creation & data
    const [createTableResult]: any = await mysqlConn.query(`SHOW CREATE TABLE \`${tableName}\``);
    const createTableSql = createTableResult[0]['Create Table'] || createTableResult[0]['Create View'];
    if (createTableSql) {
      dumpSqlLines.push(`DROP TABLE IF EXISTS \`${tableName}\`;`);
      dumpSqlLines.push(createTableSql + ';\n');
    }

    if (rows && rows.length > 0) {
      const rowColumns = Object.keys(rows[0]);
      const placeholders = `(${rowColumns.map(() => '?').join(', ')})`;
      const colList = rowColumns.map(c => `\`${c}\``).join(', ');
      const insertSql = `INSERT OR REPLACE INTO \`${tableName}\` (${colList}) VALUES ${placeholders}`;

      await sqliteRun('BEGIN TRANSACTION;');
      const stmt = sqlite.prepare(insertSql);
      for (const row of rows) {
        const values = rowColumns.map(col => {
          const val = row[col];
          if (val === undefined || val === null) return null;
          return val;
        });
        await new Promise((resolve, reject) => {
          stmt.run(values, (err) => {
            if (err) reject(err);
            else resolve(true);
          });
        });
      }
      await new Promise((resolve, reject) => {
        stmt.finalize((err) => {
          if (err) reject(err);
          else resolve(true);
        });
      });
      await sqliteRun('COMMIT;');

      // Add to SQL dump in batches of 500
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        const valStrings = batch.map((r: any) => {
          const formattedVals = rowColumns.map(col => {
            const v = r[col];
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
          });
          return `(${formattedVals.join(', ')})`;
        });
        dumpSqlLines.push(`INSERT INTO \`${tableName}\` (${colList}) VALUES\n${valStrings.join(',\n')};\n`);
      }
    }

    console.log(`✓ ${tableName.padEnd(28)} | ${String(rows.length).padStart(6)} rows synced`);
  }

  dumpSqlLines.push(`SET FOREIGN_KEY_CHECKS = 1;\n`);

  // Write SQL dump file
  console.log(`\nWriting full SQL dump to ${sqlDumpPath}...`);
  fs.writeFileSync(sqlDumpPath, dumpSqlLines.join('\n'), 'utf8');
  console.log(`✓ SQL dump saved successfully (${(fs.statSync(sqlDumpPath).size / 1024 / 1024).toFixed(2)} MB).`);

  // Optimize SQLite
  await sqliteRun('PRAGMA foreign_keys = ON;');
  await sqliteRun('VACUUM;');
  await sqliteRun('PRAGMA wal_checkpoint(TRUNCATE);');

  await mysqlConn.end();
  await new Promise((resolve) => sqlite.close(resolve));

  console.log('\n================================================================');
  console.log('✅ ALL DATABASE CHANGES SUCCESSFULLY SYNCED TO SQLITE & DUMP');
  console.log('================================================================\n');
}

syncMysqlToSqlite().catch(err => {
  console.error('\n❌ Error during database synchronization:', err);
  process.exit(1);
});
