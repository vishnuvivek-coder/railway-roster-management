require('dotenv').config();
import http from 'http';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'railway_roster_luxury_editorial_secret_2026';
const adminToken = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, JWT_SECRET);

function getJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    };
    http.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          } else {
            resolve(JSON.parse(data));
          }
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('PHASE 2.1 VERIFICATION SUITE: OCT / NOV DATA ISOLATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean, detail: string = '') {
    if (condition) {
      console.log(`✅ PASS: ${desc} ${detail ? `(${detail})` : ''}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  try {
    // 1. Roster Versions
    console.log('--- 1. Testing /api/roster-versions ---');
    const versions = await getJson('http://localhost:5000/api/roster-versions');
    assert('Roster versions endpoint returns array', Array.isArray(versions) && versions.length >= 2);
    const octVer = versions.find((v: any) => v.version_code === 'OCT_2026');
    const novVer = versions.find((v: any) => v.version_code === 'NOV_2026');
    assert('October version present with correct effective dates', octVer && octVer.effective_from === '2026-10-01' && octVer.effective_to === '2026-10-31');
    assert('November version present with open effective_to', novVer && novVer.effective_from === '2026-11-01' && novVer.effective_to === null);

    // 2. Muster Roll (Muster Grid)
    console.log('\n--- 2. Testing /api/muster (October vs November) ---');
    const octMuster = await getJson('http://localhost:5000/api/muster?cycle_start=2026-10-11');
    const novMuster = await getJson('http://localhost:5000/api/muster?cycle_start=2026-11-11');

    assert('October muster returns staff rows', octMuster && octMuster.staff && octMuster.staff.length > 0, `Count: ${octMuster.staff.length}`);
    assert('November muster returns staff rows', novMuster && novMuster.staff && novMuster.staff.length > 0, `Count: ${novMuster.staff.length}`);
    assert('October muster has grandTotals', octMuster.grandTotals && octMuster.grandTotals.P > 0, `P: ${octMuster.grandTotals.P}`);
    assert('November muster has grandTotals', novMuster.grandTotals && novMuster.grandTotals.P > 0, `P: ${novMuster.grandTotals.P}`);

    // Verify MV PRASAD / P PRATHAP exist in both
    const octPrasad = octMuster.staff.find((s: any) => s.name.includes('PRASAD'));
    const novPrasad = novMuster.staff.find((s: any) => s.name.includes('PRASAD'));
    assert('MV PRASAD preserved across both muster cycles', !!octPrasad && !!novPrasad);

    // 3. Leave Reserve (LR) Sheet
    console.log('\n--- 3. Testing /api/lr-sheet (October vs November) ---');
    const octLr = await getJson('http://localhost:5000/api/lr-sheet?year=2026&month=10');
    const novLr = await getJson('http://localhost:5000/api/lr-sheet?year=2026&month=11');

    assert('October LR sheet returns staff list', octLr && octLr.staff && octLr.staff.length > 0, `Count: ${octLr.staff.length}`);
    assert('November LR sheet returns staff list', novLr && novLr.staff && novLr.staff.length > 0, `Count: ${novLr.staff.length}`);
    assert('October LR days match 31 days', octLr.days && octLr.days.length === 31);
    assert('November LR days match 30 days', novLr.days && novLr.days.length === 30);

    // 4. Daily Booking Chart
    console.log('\n--- 4. Testing /api/documents/daily-booking-chart ---');
    const octBooking = await getJson('http://localhost:5000/api/documents/daily-booking-chart?date=2026-10-15');
    const novBooking = await getJson('http://localhost:5000/api/documents/daily-booking-chart?date=2026-11-05');

    assert('October daily booking chart generated', octBooking && Array.isArray(octBooking.train_blocks));
    assert('November daily booking chart generated', novBooking && Array.isArray(novBooking.train_blocks));
    assert('October daily booking summary present', octBooking.summary && octBooking.summary.grand_total > 0, `Total: ${octBooking.summary.grand_total}`);
    assert('November daily booking summary present', novBooking.summary && novBooking.summary.grand_total > 0, `Total: ${novBooking.summary.grand_total}`);

    // 5. Daily Earnings (Daily & Monthly)
    console.log('\n--- 5. Testing /api/documents/daily-earnings & monthly earnings ---');
    const octEarnings = await getJson('http://localhost:5000/api/documents/daily-earnings?date=2026-10-15');
    const novEarnings = await getJson('http://localhost:5000/api/documents/daily-earnings?date=2026-11-05');

    assert('October daily earnings returns rows', octEarnings && octEarnings.rows && octEarnings.rows.length > 0, `Rows: ${octEarnings.rows.length}`);
    assert('November daily earnings returns rows', novEarnings && novEarnings.rows && novEarnings.rows.length > 0, `Rows: ${novEarnings.rows.length}`);

    // Test a specific cyclic staff member monthly earnings (Staff ID 13: M KESHAVULU)
    const testStaffId = 13;
    const octMonthlyEarn = await getJson(`http://localhost:5000/api/documents/daily-earnings/staff/${testStaffId}?year=2026&month=10`);
    const novMonthlyEarn = await getJson(`http://localhost:5000/api/documents/daily-earnings/staff/${testStaffId}?year=2026&month=11`);
    assert('October monthly earnings generated', octMonthlyEarn && Array.isArray(octMonthlyEarn.days) && octMonthlyEarn.days.length === 31, `Days: ${octMonthlyEarn?.days?.length}`);
    assert('November monthly earnings generated', novMonthlyEarn && Array.isArray(novMonthlyEarn.days) && novMonthlyEarn.days.length > 0, `Days: ${novMonthlyEarn?.days?.length}`);

    // 6. NDA Journal
    console.log('\n--- 6. Testing /api/documents/nda/:staffId ---');
    const octNda = await getJson(`http://localhost:5000/api/documents/nda/${testStaffId}?year=2026&month=10`);
    const novNda = await getJson(`http://localhost:5000/api/documents/nda/${testStaffId}?year=2026&month=11`);
    assert('October NDA journal generated', octNda && Array.isArray(octNda.rows) && octNda.rows.length > 0);
    assert('November NDA journal generated', novNda && Array.isArray(novNda.rows) && novNda.rows.length > 0);

    // 7. Staff Diary
    console.log('\n--- 7. Testing /api/documents/diary/:staffId ---');
    const octDiary = await getJson(`http://localhost:5000/api/documents/diary/${testStaffId}?year=2026&month=10`);
    const novDiary = await getJson(`http://localhost:5000/api/documents/diary/${testStaffId}?year=2026&month=11`);
    assert('October Staff Diary generated', octDiary && Array.isArray(octDiary.rows) && octDiary.rows.length > 0, `Rows: ${octDiary?.rows?.length}`);
    assert('November Staff Diary generated', novDiary && Array.isArray(novDiary.rows) && novDiary.rows.length > 0, `Rows: ${novDiary?.rows?.length}`);

    // 8. Roster Grid Month Switching (October vs November)
    console.log('\n--- 8. Testing /api/roster (Grid isolation) ---');
    const octRoster = await getJson('http://localhost:5000/api/roster?category_id=1&year=2026&month=10');
    const novRoster = await getJson('http://localhost:5000/api/roster?category_id=1&year=2026&month=11');
    assert('October roster returns 21 conductor staff', octRoster && octRoster.rows && octRoster.rows.length === 21);
    assert('November roster returns 21 conductor staff', novRoster && novRoster.rows && novRoster.rows.length === 21);
    assert('October roster dates count equals 31', octRoster.dates && octRoster.dates.length === 31);
    assert('November roster dates count equals 30', novRoster.dates && novRoster.dates.length === 30);

    const octRow1 = octRoster.rows[0];
    const novRow1 = novRoster.rows[0];
    console.log(`October Category 1 Row 1: Staff ID ${octRow1.staffId} - ${octRow1.staffName}`);
    console.log(`November Category 1 Row 1: Staff ID ${novRow1.staffId} - ${novRow1.staffName}`);
    assert('October and November row 1 staff are different per version assignments', octRow1.staffId !== novRow1.staffId);

    console.log('\n====================================================');
    console.log(`VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during test suite:', err);
    process.exit(1);
  }
}

runTests();
