import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT || '25101', 10),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl: { rejectUnauthorized: false }
  });

  console.log('EXPLAIN SELECT * FROM overrides WHERE date = ?');
  const [exp1]: [any[], any] = await conn.query('EXPLAIN SELECT * FROM overrides WHERE date = ?', ['2026-11-01']);
  console.table(exp1.map(r => ({ table: r.table, type: r.type, possible_keys: r.possible_keys, key: r.key, rows: r.rows })));

  console.log('\nEXPLAIN duty_register_entry JOIN duty_register_staff JOIN staff:');
  const sql = `
    SELECT e.id, e.date, drs.staff_id, s.name, s.category_id
    FROM duty_register_entry e
    JOIN duty_register_staff drs ON e.id = drs.entry_id
    JOIN staff s ON drs.staff_id = s.id
    WHERE e.date = ?
  `;
  const [exp2]: [any[], any] = await conn.query(`EXPLAIN ${sql}`, ['2026-11-01']);
  console.table(exp2.map(r => ({ table: r.table, type: r.type, possible_keys: r.possible_keys, key: r.key, rows: r.rows })));

  await conn.end();
}

main().catch(console.error);
