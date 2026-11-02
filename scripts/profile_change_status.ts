import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  console.log('Testing raw MySQL ping / query round-trip latency to Aiven Cloud...');
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT || '25101', 10),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl: { rejectUnauthorized: false }
  });

  const pings: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await connection.query('SELECT 1');
    const t1 = performance.now();
    pings.push(t1 - t0);
  }
  console.log('5 ping latencies (ms):', pings.map(p => p.toFixed(1)).join(', '));
  const avgPing = pings.reduce((a, b) => a + b, 0) / pings.length;
  console.log(`Average network round-trip time per single query: ${avgPing.toFixed(1)} ms`);

  // Test 10 sequential queries vs Promise.all(10 queries)
  const tSeq0 = performance.now();
  for (let i = 0; i < 10; i++) {
    await connection.query('SELECT * FROM categories WHERE id = 1');
  }
  const tSeq1 = performance.now();
  console.log(`10 sequential queries: ${(tSeq1 - tSeq0).toFixed(0)} ms`);

  const tPar0 = performance.now();
  await Promise.all(Array.from({ length: 10 }).map(() => connection.query('SELECT * FROM categories WHERE id = 1')));
  const tPar1 = performance.now();
  console.log(`10 concurrent queries (Promise.all): ${(tPar1 - tPar0).toFixed(0)} ms`);

  await connection.end();
}

main();
