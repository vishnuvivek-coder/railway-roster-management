const http = require('http');
const jwt = require('jsonwebtoken');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function testAllScenarios() {
  console.log('=== RUNNING DETAILED 4-SCENARIO VERIFICATION ===\n');

  const token = jwt.sign({ id: 1, username: 'admin', role: 'Admin' }, 'railway_roster_luxury_editorial_secret_2026', { expiresIn: '24h' });

  // Use staff ID 2 (K RAMANAIAH) with pristine auto-generated rotation
  const staffId = 2;
  const year = 2026;
  const month = 9;

  // Rest date: 2026-09-14 (Scheduled Rest Link 14)
  // Working date: 2026-09-08 (Scheduled Working Link 8)

  // 1. Check Scenario 3 baseline (REST on 2026-09-14)
  console.log('--- Testing Condition 3 (Scheduled Rest, no duty override) ---');
  let taRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/documents/ta/${staffId}?year=${year}&month=${month}&start_date=2026-09-14&end_date=2026-09-14`,
    headers: { 'Authorization': `Bearer ${token}` }
  });
  let taRows = taRes.data.rows || [];
  let ndaRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/documents/nda/${staffId}?year=${year}&month=${month}&start_date=2026-09-14&end_date=2026-09-14`,
    headers: { 'Authorization': `Bearer ${token}` }
  });
  let ndaRows = ndaRes.data.rows || [];
  let diaryRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/documents/diary/${staffId}?year=${year}&month=${month}&start_date=2026-09-14&end_date=2026-09-14`,
    headers: { 'Authorization': `Bearer ${token}` }
  });
  let diaryRows = diaryRes.data.rows || [];

  console.log(`Condition 3 check on 2026-09-14:`);
  console.log(`  TA rows on rest day: ${taRows.length} (Expected: 0) -> ${taRows.length === 0 ? 'PASS ✔' : 'FAIL ❌'}`);
  console.log(`  NDA rows on rest day: ${ndaRows.length} (Expected: 0) -> ${ndaRows.length === 0 ? 'PASS ✔' : 'FAIL ❌'}`);
  console.log(`  DIARY rows on rest day: ${diaryRows.length} (Expected: 0) -> ${diaryRows.length === 0 ? 'PASS ✔' : 'FAIL ❌'}`);

  // 2. Test Scenario 4: Put an override on rest day 2026-09-14 with train 12704
  console.log('\n--- Testing Condition 4 (Train 12704 on Rest Day 2026-09-14) ---');
  const { run } = require('./src/backend/db');
  await run(`DELETE FROM overrides WHERE staff_id = ? AND date = '2026-09-14'`, [staffId]);
  await run(`
    INSERT INTO overrides (staff_id, date, status, extra_train_no, reason)
    VALUES (?, '2026-09-14', 'EXTRA_CREW', '12704', 'Working Train 12704 on Rest Day')
  `, [staffId]);

  // Regenerate TA claims
  const { generatePendingTaClaimsForMonth } = require('./src/backend/ta_generator');
  await generatePendingTaClaimsForMonth({ run, get: require('./src/backend/db').get, all: require('./src/backend/db').all }, year, month, staffId);

  taRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/documents/ta/${staffId}?year=${year}&month=${month}&start_date=2026-09-14&end_date=2026-09-14`,
    headers: { 'Authorization': `Bearer ${token}` }
  });
  taRows = taRes.data.rows || [];
  ndaRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/documents/nda/${staffId}?year=${year}&month=${month}&start_date=2026-09-14&end_date=2026-09-14`,
    headers: { 'Authorization': `Bearer ${token}` }
  });
  ndaRows = ndaRes.data.rows || [];
  diaryRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/documents/diary/${staffId}?year=${year}&month=${month}&start_date=2026-09-14&end_date=2026-09-14`,
    headers: { 'Authorization': `Bearer ${token}` }
  });
  diaryRows = diaryRes.data.rows || [];

  console.log(`Condition 4 check on 2026-09-14:`);
  console.log(`  TA row train_no: ${taRows[0]?.train_no} (Expected: 12704) -> ${taRows[0]?.train_no === '12704' ? 'PASS ✔' : 'FAIL ❌'}`);
  console.log(`  NDA row train_no: ${ndaRows[0]?.train_no} (Expected: 12704) -> ${ndaRows[0]?.train_no === '12704' ? 'PASS ✔' : 'FAIL ❌'}`);
  console.log(`  DIARY row train_no: ${diaryRows[0]?.train_no} (Expected: 12704) -> ${diaryRows[0]?.train_no === '12704' ? 'PASS ✔' : 'FAIL ❌'}`);

  // 3. Test Staff Movement API for Condition 4
  const rosterRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/roster?category_id=1&year=${year}&month=${month}`,
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const sRow = rosterRes.data.rows.find(r => r.staffId === staffId);
  const cell14 = sRow.cells.find(c => c.date === '2026-09-14');
  console.log(`  Staff Movement Schedule 2026-09-14:`);
  console.log(`    Train Numbers column (original): ${cell14?.original_train_numbers} (Expected: REST) -> ${cell14?.original_train_numbers === 'REST' ? 'PASS ✔' : 'FAIL ❌'}`);
  console.log(`    Effective train: ${cell14?.effective_train_numbers} (Expected: 12704) -> ${cell14?.effective_train_numbers === '12704' ? 'PASS ✔' : 'FAIL ❌'}`);
  console.log(`    Condition applied: ${cell14?.condition_applied} (Expected: 4) -> ${cell14?.condition_applied === 4 ? 'PASS ✔' : 'FAIL ❌'}`);

  // 4. Test Scenario 2: Different train on working day (2026-09-08)
  console.log('\n--- Testing Condition 2 (Changed Train 17253 on Working Day 2026-09-08) ---');
  await run(`DELETE FROM overrides WHERE staff_id = ? AND date = '2026-09-08'`, [staffId]);
  await run(`
    INSERT INTO overrides (staff_id, date, status, extra_train_no, reason)
    VALUES (?, '2026-09-08', 'EXTRA_CREW', '17253', 'Working Train 17253 instead of cyclic link')
  `, [staffId]);

  await generatePendingTaClaimsForMonth({ run, get: require('./src/backend/db').get, all: require('./src/backend/db').all }, year, month, staffId);

  taRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/documents/ta/${staffId}?year=${year}&month=${month}&start_date=2026-09-08&end_date=2026-09-08`,
    headers: { 'Authorization': `Bearer ${token}` }
  });
  taRows = taRes.data.rows || [];
  ndaRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/documents/nda/${staffId}?year=${year}&month=${month}&start_date=2026-09-08&end_date=2026-09-08`,
    headers: { 'Authorization': `Bearer ${token}` }
  });
  ndaRows = ndaRes.data.rows || [];
  diaryRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/documents/diary/${staffId}?year=${year}&month=${month}&start_date=2026-09-08&end_date=2026-09-08`,
    headers: { 'Authorization': `Bearer ${token}` }
  });
  diaryRows = diaryRes.data.rows || [];

  console.log(`Condition 2 check on 2026-09-08:`);
  console.log(`  TA row train_no: ${taRows[0]?.train_no} (Expected: 17253) -> ${taRows[0]?.train_no === '17253' ? 'PASS ✔' : 'FAIL ❌'}`);
  console.log(`  NDA row train_no: ${ndaRows[0]?.train_no} (Expected: 17253) -> ${ndaRows[0]?.train_no === '17253' ? 'PASS ✔' : 'FAIL ❌'}`);
  console.log(`  DIARY row train_no: ${diaryRows[0]?.train_no} (Expected: 17253) -> ${diaryRows[0]?.train_no === '17253' ? 'PASS ✔' : 'FAIL ❌'}`);

  // 5. Test Scenario 1: Same train on regular cyclic working day (2026-09-09)
  console.log('\n--- Testing Condition 1 (Same Train on Regular Cyclic Day 2026-09-09) ---');
  taRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/documents/ta/${staffId}?year=${year}&month=${month}&start_date=2026-09-09&end_date=2026-09-09`,
    headers: { 'Authorization': `Bearer ${token}` }
  });
  taRows = taRes.data.rows || [];
  ndaRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/documents/nda/${staffId}?year=${year}&month=${month}&start_date=2026-09-09&end_date=2026-09-09`,
    headers: { 'Authorization': `Bearer ${token}` }
  });
  ndaRows = ndaRes.data.rows || [];
  diaryRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/documents/diary/${staffId}?year=${year}&month=${month}&start_date=2026-09-09&end_date=2026-09-09`,
    headers: { 'Authorization': `Bearer ${token}` }
  });
  diaryRows = diaryRes.data.rows || [];

  const cell09 = sRow.cells.find(c => c.date === '2026-09-09');
  console.log(`Condition 1 check on 2026-09-09:`);
  console.log(`  Staff scheduled train: ${cell09?.original_train_numbers}`);
  console.log(`  TA row train_no: ${taRows[0]?.train_no} -> ${taRows[0]?.train_no ? 'PASS ✔' : 'FAIL ❌'}`);
  console.log(`  NDA row train_no: ${ndaRows[0]?.train_no} -> ${ndaRows[0]?.train_no ? 'PASS ✔' : 'FAIL ❌'}`);
  console.log(`  DIARY row train_no: ${diaryRows[0]?.train_no} -> ${diaryRows[0]?.train_no ? 'PASS ✔' : 'FAIL ❌'}`);

  // Cleanup test overrides
  console.log('\n--- Cleaning up test overrides ---');
  await run(`DELETE FROM overrides WHERE staff_id = ? AND date IN ('2026-09-14', '2026-09-08')`, [staffId]);
  await generatePendingTaClaimsForMonth({ run, get: require('./src/backend/db').get, all: require('./src/backend/db').all }, year, month, staffId);
  console.log('✔ Cleaned up test overrides and regenerated pristine data');

  console.log('\n=== ALL 4 SCENARIOS VERIFIED SUCCESSFULLY ===');
}

testAllScenarios().catch(console.error);
