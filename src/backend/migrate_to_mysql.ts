/**
 * ============================================================================
 * RAILWAY ROSTER MANAGER — SQLITE TO MYSQL DATA MIGRATION ENGINE
 * (`src/backend/migrate_to_mysql.js`)
 * ============================================================================
 * Usage:
 *   node src/backend/migrate_to_mysql.js
 * or via npm:
 *   npm run migrate:mysql
 * ============================================================================
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');

const sqliteDbPath = path.join(__dirname, 'roster.db');
const schemaSqlPath = path.join(__dirname, 'mysql_schema.sql');

async function migrate() {
  console.log('================================================================');
  console.log('🚆 RAILWAY ROSTER MANAGER — DEDICATED MYSQL MIGRATION');
  console.log('================================================================\n');

  if (!fs.existsSync(sqliteDbPath)) {
    console.error(`❌ SQLite source database not found at ${sqliteDbPath}`);
    process.exit(1);
  }

  const host = process.env.MYSQL_HOST || 'localhost';
  const port = parseInt(process.env.MYSQL_PORT, 10) || 3306;
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'railway_roster';

  // Build SSL config from MYSQL_SSL_CA env var (PEM string).
  // Required for Aiven and other managed MySQL providers that use a private CA.
  let sslConfig: any = undefined;
  if (process.env.MYSQL_SSL_CA) {
    sslConfig = { ca: process.env.MYSQL_SSL_CA, rejectUnauthorized: true };
    console.log(`TLS: Custom CA cert provided (rejectUnauthorized: true)`);
  }

  console.log(`Connecting to MySQL at ${host}:${port} as user '${user}', database '${database}'...`);
  console.log(`⚠️  WARNING: This migration DELETEs all rows from each target table before inserting.`);
  console.log(`   Only run this once against an empty or disposable MySQL database.`);
  console.log(`   Do NOT run against a database that already has production data.\n`);

  let rootConn;
  try {
    // Connect directly to the target database — do NOT run CREATE DATABASE.
    // Managed providers (Aiven) do not grant CREATE DATABASE to application users,
    // and the database already exists.
    rootConn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      multipleStatements: true,
      ...(sslConfig ? { ssl: sslConfig } : {})
    });
  } catch (err) {
    console.error('\n❌ Could not connect to MySQL:', err.message);
    console.log('\nCheck your .env variables:');
    console.log('  MYSQL_HOST=' + host);
    console.log('  MYSQL_PORT=' + port);
    console.log('  MYSQL_USER=' + user);
    console.log('  MYSQL_PASSWORD=your_password');
    console.log('  MYSQL_DATABASE=' + database);
    console.log('  MYSQL_SSL_CA=<PEM content of CA cert>  (required for Aiven)');
    process.exit(1);
  }

  console.log(`✓ Connected to MySQL. Using database '${database}'.`);

  // Execute schema definitions
  console.log(`Applying MySQL schema from mysql_schema.sql...`);
  const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
  await rootConn.query(schemaSql);
  console.log(`✓ MySQL tables and constraints created successfully.\n`);

  // Open SQLite database
  console.log(`Reading source data from SQLite (${sqliteDbPath})...`);
  const sqlite = new sqlite3.Database(sqliteDbPath);

  const sqliteAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      sqlite.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  const tablesInOrder = [
    'users',
    'categories',
    'link_sets',
    'links',
    'slot_customizations',
    'staff',
    'overrides',
    'leave_requests',
    'audit_logs',
    'duty_register_entry',
    'duty_register_staff',
    'ta_entries',
    'nda_entries',
    'diary_entries',
    'actual_train_runs',
    'muster_records',
    'daily_earnings_entries',
    'lr_duty_completions',
    'train_ta_nda_rules',
    'lr_sheet_records',
    'feedbacks',
    'ta_approvals',
    'non_daily_trains',
    'seniority_list'
  ];

  await rootConn.query('SET FOREIGN_KEY_CHECKS = 0');

  console.log('----------------------------------------------------------------');
  console.log(String('TABLE NAME').padEnd(30) + ' | ' + 'MIGRATED ROWS');
  console.log('----------------------------------------------------------------');

  let totalMigrated = 0;

  for (const tableName of tablesInOrder) {
    try {
      const selectSql = tableName === 'duty_register_staff'
        ? `SELECT * FROM ${tableName} WHERE entry_id IS NOT NULL`
        : `SELECT * FROM ${tableName}`;
      const rows: any[] = (await sqliteAll(selectSql)) as any[];
      if (!rows || rows.length === 0) {
        console.log(tableName.padEnd(30) + ' | 0 rows');
        continue;
      }

      // Truncate target table
      await rootConn.query(`DELETE FROM \`${tableName}\``);

      // Batch insert into MySQL
      const columns = Object.keys(rows[0]);
      const placeholders = `(${columns.map(() => '?').join(', ')})`;
      const colList = columns.map(c => `\`${c}\``).join(', ');

      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const values = [];
        const queryParts = [];

        for (const row of batch) {
          queryParts.push(placeholders);
          for (const col of columns) {
            let val = row[col];
            if (val === undefined || val === '') {
              if (col === 'effective_from') {
                val = '2026-08-01';
              } else if (col.includes('date') || col.includes('_at') || col === 'entry_id') {
                val = null;
              } else {
                val = val === '' ? '' : null;
              }
            } else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
              val = val.replace('T', ' ').replace(/\.\d+Z$/, '').replace(/Z$/, '');
            }
            values.push(val);
          }
        }

        const insertSql = `INSERT INTO \`${tableName}\` (${colList}) VALUES ${queryParts.join(', ')}`;
        await rootConn.query(insertSql, values);
      }

      totalMigrated += rows.length;
      console.log(tableName.padEnd(30) + ' | ' + String(rows.length).padStart(5) + ' rows');
    } catch (tblErr) {
      console.warn(tableName.padEnd(30) + ' | [SKIPPED / ERROR]: ' + tblErr.message);
    }
  }

  await rootConn.query('SET FOREIGN_KEY_CHECKS = 1');
  await rootConn.end();
  sqlite.close();

  console.log('----------------------------------------------------------------');
  console.log(`\n🎉 MIGRATION COMPLETE! Total ${totalMigrated} rows migrated into MySQL.`);
  console.log(`\nTo make your application use this MySQL database permanently:`);
  console.log(`1. In your .env file, set:`);
  console.log(`   DB_TYPE=mysql`);
  console.log(`   MYSQL_HOST=${host}`);
  console.log(`   MYSQL_PORT=${port}`);
  console.log(`   MYSQL_USER=${user}`);
  console.log(`   MYSQL_PASSWORD=${password ? '********' : '(blank)'}`);
  console.log(`   MYSQL_DATABASE=${database}`);
  console.log(`2. Restart backend: node src/backend/server.js`);
  console.log('================================================================\n');
}

migrate().catch(err => {
  console.error('\n❌ Fatal Migration Error:', err);
  process.exit(1);
});
