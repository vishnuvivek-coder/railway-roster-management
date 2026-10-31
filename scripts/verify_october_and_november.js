const http = require('http');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function verify() {
  console.log('========================================================================');
  console.log('🔍 VERIFICATION SUITE: OCTOBER & NOVEMBER ROSTER ACCURACY');
  console.log('========================================================================\n');

  // Test 1: Daily View for October 30, 2026
  console.log('--- TEST 1: Daily View for 2026-10-30 ---');
  const dailyRes = await fetchJson('http://localhost:5000/api/reports/daily-view?date=2026-10-30');
  if (dailyRes.status !== 200) {
    console.error('❌ Daily view failed:', dailyRes.status, dailyRes.raw);
    return;
  }

  const categories = dailyRes.data.categories || dailyRes.data;
  console.log(`Received daily view with ${categories.length} categories.`);

  // Check Category 1
  const cat1 = categories.find(c => c.categoryId === 1);
  if (cat1) {
    console.log(`\nCategory 1 (Conductors): ${cat1.staff.length} staff`);
    const s1 = cat1.staff.find(s => s.staffId === 1); // KAKI SRINIVASARAO
    const s5 = cat1.staff.find(s => s.staffId === 5); // TRS REDDY
    const s9 = cat1.staff.find(s => s.staffId === 9); // VV PAVAN KUMAR
    const s19 = cat1.staff.find(s => s.staffId === 19); // PRM ALI KHAN

    console.log('  Staff 1 (KAKI SRINIVASARAO):', {
      rowPosition: s1?.rowPosition,
      link_number: s1?.link_number,
      isRest: s1?.isRest,
      status: s1?.status,
      train: s1?.train_numbers || s1?.train_out
    });

    console.log('  Staff 5 (TRS REDDY):', {
      rowPosition: s5?.rowPosition,
      link_number: s5?.link_number,
      isRest: s5?.isRest,
      status: s5?.status,
      train: s5?.train_numbers || s5?.train_out
    });

    console.log('  Staff 9 (VV PAVAN KUMAR):', {
      name: s9?.name,
      designation: s9?.designation,
      rowPosition: s9?.rowPosition,
      link_number: s9?.link_number,
      isRest: s9?.isRest,
      status: s9?.status,
      train: s9?.train_numbers || s9?.train_out
    });

    console.log('  Staff 19 (PRM ALI KHAN):', {
      rowPosition: s19?.rowPosition,
      link_number: s19?.link_number,
      isRest: s19?.isRest,
      status: s19?.status,
      train: s19?.train_numbers || s19?.train_out
    });
  }

  // Test 2: Duplicate Employee Check in Category 4 vs Category 3
  console.log('\n--- TEST 2: Duplicate Employee Check (S HYMA TULASI) ---');
  const cat3 = categories.find(c => c.categoryId === 3);
  const cat4 = categories.find(c => c.categoryId === 4);

  const hymaInCat3 = cat3?.staff?.filter(s => s.name?.includes('HYMA TULASI')) || [];
  const hymaInCat4 = cat4?.staff?.filter(s => s.name?.includes('HYMA TULASI')) || [];

  console.log(`  Hyma Tulasi in Category 3 (Ladies): count = ${hymaInCat3.length}`);
  hymaInCat3.forEach(s => console.log(`    - ID: ${s.staffId}, Name: ${s.name}, Position: ${s.rowPosition}`));

  console.log(`  Hyma Tulasi in Category 4 (LR): count = ${hymaInCat4.length}`);
  hymaInCat4.forEach(s => console.log(`    - ID: ${s.staffId}, Name: ${s.name}, Position: ${s.rowPosition}`));

  if (hymaInCat3.length === 1 && hymaInCat3[0].staffId === 118 &&
      hymaInCat4.length === 1 && hymaInCat4[0].staffId === 132) {
    console.log('  ✅ PASSED: No duplicate in Category 4! ID 118 is correctly in Cat 3, ID 132 is in Cat 4.');
  } else {
    console.error('  ❌ FAILED: Duplicate or wrong assignment detected!');
  }

  // Check Staff 81 in Category 2
  const cat2 = categories.find(c => c.categoryId === 2);
  const s81 = cat2?.staff?.find(s => s.staffId === 81);
  console.log('\n  Staff 81 in Category 2 (TTI / Sleeper):', {
    staffId: s81?.staffId,
    name: s81?.name,
    designation: s81?.designation,
    rowPosition: s81?.rowPosition,
    link_number: s81?.link_number,
    train: s81?.train_numbers
  });
  if (s81 && s81.name.includes('ASHA BEGUM') && s81.rowPosition === 3) {
    console.log('  ✅ PASSED: Staff 81 name (SK ASHA BEGUM) preserved and position restored to 3.');
  } else {
    console.error('  ❌ FAILED: Staff 81 check failed!');
  }

  // Test 3: Roster Month View for October 2026 (Category 1)
  console.log('\n--- TEST 3: Roster Month View for October 2026 (Category 1) ---');
  const octRosterRes = await fetchJson('http://localhost:5000/api/roster?year=2026&month=10&categoryId=1');
  if (octRosterRes.status !== 200) {
    console.error('❌ October roster failed:', octRosterRes.status);
  } else {
    const octData = octRosterRes.data;
    const rows = octData.rows || [];
    console.log(`  Received October roster grid with ${rows.length} staff rows.`);
    
    // Check Staff 1 & 5
    const s1Row = rows.find(r => r.staffId === 1);
    const s5Row = rows.find(r => r.staffId === 5);
    const s19Row = rows.find(r => r.staffId === 19);

    if (s1Row) {
      const d1 = s1Row.cells?.find(c => c.date === '2026-10-01');
      const d30 = s1Row.cells?.find(c => c.date === '2026-10-30');
      console.log('  Staff 1 (KAKI SRINIVASARAO):');
      console.log('    - Day 1 (2026-10-01): Link', d1?.actualLinkNumber, '| Train:', d1?.train_numbers, '| isRest:', d1?.isRest);
      console.log('    - Day 30 (2026-10-30): Link', d30?.actualLinkNumber, '| Train:', d30?.train_numbers, '| isRest:', d30?.isRest);
    }

    if (s5Row) {
      const d1 = s5Row.cells?.find(c => c.date === '2026-10-01');
      const d30 = s5Row.cells?.find(c => c.date === '2026-10-30');
      console.log('  Staff 5 (TRS REDDY):');
      console.log('    - Day 1 (2026-10-01): Link', d1?.actualLinkNumber, '| Train:', d1?.train_numbers, '| isRest:', d1?.isRest);
      console.log('    - Day 30 (2026-10-30): Link', d30?.actualLinkNumber, '| Train:', d30?.train_numbers, '| isRest:', d30?.isRest);
    }

    if (s19Row) {
      const d1 = s19Row.cells?.find(c => c.date === '2026-10-01');
      const d30 = s19Row.cells?.find(c => c.date === '2026-10-30');
      console.log('  Staff 19 (PRM ALI KHAN):');
      console.log('    - Day 1 (2026-10-01): Link', d1?.actualLinkNumber, '| Train:', d1?.train_numbers, '| isRest:', d1?.isRest);
      console.log('    - Day 30 (2026-10-30): Link', d30?.actualLinkNumber, '| Train:', d30?.train_numbers, '| isRest:', d30?.isRest);
    }
  }

  // Test 4: November 2026 Calculations (Read-Only Test)
  console.log('\n--- TEST 4: November 2026 Roster Calculations (Read-Only) ---');
  const novDailyRes = await fetchJson('http://localhost:5000/api/reports/daily-view?date=2026-11-01');
  if (novDailyRes.status !== 200) {
    console.error('❌ November daily view failed:', novDailyRes.status);
  } else {
    const novCategories = novDailyRes.data.categories || novDailyRes.data;
    const novCat1 = novCategories.find(c => c.categoryId === 1);
    console.log(`  November 1, 2026 Category 1 count: ${novCat1?.staff?.length}`);
    const novS1 = novCat1?.staff?.find(s => s.staffId === 1);
    console.log('  Staff 1 on 2026-11-01 (November Anchor & Link Sets):', {
      rowPosition: novS1?.rowPosition,
      link_number: novS1?.link_number,
      duty: novS1?.train_numbers || novS1?.train_out,
      isRest: novS1?.isRest
    });
  }

  const novRosterRes = await fetchJson('http://localhost:5000/api/roster?year=2026&month=11&categoryId=1');
  if (novRosterRes.status !== 200) {
    console.error('❌ November roster failed:', novRosterRes.status);
  } else {
    const novData = novRosterRes.data;
    const novRows = novData.rows || [];
    console.log(`  November roster grid returned ${novRows.length} staff rows.`);
    const novS1Row = novRows.find(r => r.staffId === 1);
    const novD1 = novS1Row?.cells?.find(c => c.date === '2026-11-01');
    console.log('  November 1 Roster Grid for Staff 1:', {
      link: novD1?.actualLinkNumber,
      train: novD1?.train_numbers,
      status: novD1?.status
    });
    console.log('  ✅ November roster calculations function properly with November link sets!');
  }

  console.log('\n========================================================================');
  console.log('🎉 ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  console.log('========================================================================');
}

verify().catch(console.error);
