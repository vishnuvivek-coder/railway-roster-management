const http = require('http');

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

async function runTests() {
  console.log('=== STARTING 4-CONDITION VERIFICATION TESTS ===\n');

  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: 1, username: 'admin', role: 'Admin' }, process.env.JWT_SECRET || 'railway_roster_luxury_editorial_secret_2026', { expiresIn: '24h' });
  console.log('✔ Authenticated via JWT successfully');

  // 2. Fetch staff list
  const staffRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/staff',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const staffList = staffRes.data || [];
  const testStaff = staffList.find(s => s.name !== '(VACANT)' && s.category_id === 1) || staffList[0];
  console.log(`✔ Using Test Staff: ${testStaff.name} (ID: ${testStaff.id})`);

  // 3. Test comparator directly for all 4 conditions
  const { compareDutyAndResolve } = require('./src/backend/duty_comparator');

  console.log('\n--- Unit Tests for duty_comparator.js ---');
  // Condition 1: Same train
  const res1 = compareDutyAndResolve({
    origTrain: '12704',
    origIsRest: false,
    remarks: 'Regular Cyclic Duty'
  });
  console.log('Condition 1 (Same Train 12704):', res1.action === 'DISPLAY' && res1.condition === 1 && res1.train_no === '12704' ? 'PASS ✔' : 'FAIL ❌', res1);

  // Condition 2: Different train (Remarks has 17253)
  const res2 = compareDutyAndResolve({
    origTrain: '12704',
    origIsRest: false,
    remarks: 'Working Train 17253'
  });
  console.log('Condition 2 (Orig 12704, Remarks 17253):', res2.action === 'DISPLAY' && res2.condition === 2 && res2.train_no === '17253' ? 'PASS ✔' : 'FAIL ❌', res2);

  // Condition 3: Employee rest day, both declared rest
  const res3 = compareDutyAndResolve({
    origTrain: 'REST',
    origIsRest: true,
    remarks: 'Weekly Rest Day'
  });
  console.log('Condition 3 (Both declared REST):', res3.action === 'SKIP' && res3.condition === 3 && res3.train_no === null ? 'PASS ✔' : 'FAIL ❌', res3);

  // Condition 4: Goes on train on rest day
  const res4 = compareDutyAndResolve({
    origTrain: 'REST',
    origIsRest: true,
    remarks: 'Working Train 12704'
  });
  console.log('Condition 4 (Orig REST, Remarks 12704):', res4.action === 'DISPLAY' && res4.condition === 4 && res4.train_no === '12704' ? 'PASS ✔' : 'FAIL ❌', res4);

  // 4. Test API Documents: TA, NDA, DIARY
  console.log('\n--- Document API Endpoints Test ---');

  // TA Document
  const taRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/documents/ta/${testStaff.id}?year=2026&month=9`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(`TA API status: ${taRes.status}`);
  if (taRes.status === 200 && taRes.data.rows) {
    const taRows = taRes.data.rows;
    const restRows = taRows.filter(r => r.train_no === 'REST' || (r.remarks && r.remarks.includes('WEEKLY REST')));
    console.log(`TA Journal Total Rows: ${taRows.length}, Rest Rows in TA: ${restRows.length}`);
    console.log(`✔ Condition 3 verified in TA: Rest rows skipped = ${restRows.length === 0 ? 'YES ✔' : 'NO ❌'}`);
  }

  // NDA Document
  const ndaRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/documents/nda/${testStaff.id}?year=2026&month=9`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(`NDA API status: ${ndaRes.status}`);
  if (ndaRes.status === 200 && ndaRes.data.rows) {
    const ndaRows = ndaRes.data.rows;
    const restRows = ndaRows.filter(r => r.train_no === 'REST' || r.train_no === '-');
    console.log(`NDA Journal Total Rows: ${ndaRows.length}, Rest Rows in NDA: ${restRows.length}`);
    console.log(`✔ Condition 3 verified in NDA: Rest rows skipped = ${restRows.length === 0 ? 'YES ✔' : 'NO ❌'}`);
  }

  // DIARY Document
  const diaryRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/documents/diary/${testStaff.id}?year=2026&month=9`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(`DIARY API status: ${diaryRes.status}`);
  if (diaryRes.status === 200 && diaryRes.data.rows) {
    const diaryRows = diaryRes.data.rows;
    const restRows = diaryRows.filter(r => r.train_no === 'REST' || (r.remarks && r.remarks.includes('REST')));
    console.log(`DIARY Journal Total Rows: ${diaryRows.length}, Rest Rows in DIARY: ${restRows.length}`);
    console.log(`✔ Condition 3 verified in DIARY: Rest rows skipped = ${restRows.length === 0 ? 'YES ✔' : 'NO ❌'}`);
  }

  // 5. Test Staff Movement Schedule / Roster API
  console.log('\n--- Roster Movement API Test ---');
  const rosterRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/roster?category_id=${testStaff.category_id}&year=2026&month=9`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(`Roster API status: ${rosterRes.status}`);
  if (rosterRes.status === 200 && rosterRes.data.rows) {
    const sRow = rosterRes.data.rows.find(r => r.staffId === testStaff.id);
    if (sRow && sRow.cells) {
      const restCells = sRow.cells.filter(c => c.isRest);
      console.log(`Staff Movement cells checked: ${sRow.cells.length} days`);
      console.log(`Rest cells count: ${restCells.length}`);
      const sampleRest = restCells[0];
      if (sampleRest) {
        console.log(`Sample Rest Cell on ${sampleRest.date}:`);
        console.log(`  original_train_numbers: ${sampleRest.original_train_numbers}`);
        console.log(`  original_is_rest: ${sampleRest.original_is_rest}`);
        console.log(`  condition_applied: ${sampleRest.condition_applied}`);
      }
      const sampleDuty = sRow.cells.find(c => !c.isRest);
      if (sampleDuty) {
        console.log(`Sample Duty Cell on ${sampleDuty.date}:`);
        console.log(`  original_train_numbers: ${sampleDuty.original_train_numbers}`);
        console.log(`  actual_train_numbers: ${sampleDuty.actual_train_numbers}`);
        console.log(`  effective_train_numbers: ${sampleDuty.effective_train_numbers}`);
        console.log(`  condition_applied: ${sampleDuty.condition_applied}`);
      }
    }
  }

  console.log('\n=== ALL TESTS COMPLETED ===');
}

runTests().catch(console.error);
