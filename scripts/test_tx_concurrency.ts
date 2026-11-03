import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT || '25101', 10),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl: { rejectUnauthorized: false },
    connectionLimit: 10
  });

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  console.log('Testing Promise.all on a single transaction connection in mysql2...');
  const t0 = performance.now();
  await Promise.all([
    conn.query('SELECT 1'),
    conn.query('SELECT 2'),
    conn.query('SELECT 3')
  ]);
  const t1 = performance.now();
  console.log(`Time taken on single connection: ${(t1 - t0).toFixed(0)} ms`);

  await conn.commit();
  conn.release();
  await pool.end();
}

main().catch(console.error);
