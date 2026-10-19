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

  console.log(`Connecting to MySQL Server on ${host}:${port} as user '${user}'...`);

  let rootConn;
  try {
    rootConn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true
    });
  } catch (err) {
    console.error('\n❌ Could not connect to MySQL server:', err.message);
    console.log('\nTip: Make sure MySQL is running and your credentials in .env are correct:');
    console.log('  MYSQL_HOST=' + host);
    console.log('  MYSQL_PORT=' + port);
    console.log('  MYSQL_USER=' + user);
    console.log('  MYSQL_PASSWORD=your_password');
    console.log('  MYSQL_DATABASE=' + database);
    process.exit(1);
  }

  console.log(`✓ Connected to MySQL server.`);
  console.log(`Creating database '${database}' if not exists...`);
  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await rootConn.changeUser({ database });
  console.log(`✓ Using database '${database}'.`);

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
