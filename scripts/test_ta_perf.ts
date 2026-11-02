import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT || '25101', 10),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl: { rejectUnauthorized: false }
  });

  const db = {
    all: async (sql: string, params: any[] = []) => {
      const [rows] = await connection.query(sql, params);
      return rows;
    },
    get: async (sql: string, params: any[] = []) => {
      const [rows] = await connection.query(sql, params);
      return (rows as any[])[0] || null;
    },
    run: async (sql: string, params: any[] = []) => {
      const [result] = await connection.query(sql, params);
      return result;
    }
  };

  const { generatePendingTaClaimsForMonth } = require('../src/backend/ta_generator');
  console.log('Testing generatePendingTaClaimsForMonth for staff 89 (R SAIDA NAIK) in Nov 2026...');
  const t0 = performance.now();
  await generatePendingTaClaimsForMonth(db, 2026, 11, 89);
  const t1 = performance.now();
  console.log(`generatePendingTaClaimsForMonth took: ${(t1 - t0).toFixed(0)} ms`);

  await connection.end();
}

main();
