const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'roster.db'));

function getDayOffset(anchorDateStr, targetDateStr) {
  const anchor = new Date(anchorDateStr + 'T12:00:00');
  const target = new Date(targetDateStr + 'T12:00:00');
  const diffDays = Math.round((target - anchor) / (1000 * 60 * 60 * 24));
  return (diffDays % 1000 + 1000) % 1000;
}

function getBaseLinkNumber(rowPosition, dayOffset, cycleLength) {
  return ((rowPosition - 1 + dayOffset) % cycleLength) + 1;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function processAllDates() {
  const categories = await all('SELECT * FROM categories');
  const staffList = await all('SELECT * FROM staff');
  const linksList = await all('SELECT * FROM links');

  console.log('Categories:', categories.map(c => c.name));

  // =========================================================================
  // DATE 1: 12.09.26 SATURDAY (2026-09-12)
  // =========================================================================
  const d1 = '2026-09-12';
  console.log(`\n========================================\nPROCESSING DATE: ${d1} (SATURDAY)\n========================================`);

  // Page 10 & 11 data for 12.09.26 Saturday:
  // 1. RNR NAIK (25): 17253/17252 -> Link 1 (Cyclic base is Link 15 -> assigned Link 1)
  // 2. T.A. RAO (109): 17239/17240 -> Link 29
  // 3. T.K. RAO (107): 17646/12796 -> Link 17
  // 4. B.V. REDDY (102): 12805/12806 -> Link 18/19
  // 5. ELN RAO (113): 12795/17645 -> Link 47
  // 6. A.V. REDDY (78): 17251/17254 -> Link 5 (Cyclic base is Link 5)
  // 7. P.V.S. RAO (55): 17281/17282 -> Link 45
  // 8. S. NAGALINGAPPA (14) [AC] -> Link 4 (COR-1) & K.S. PARVATHI (88) [SL] -> Link 1 (Ladies)
  // 9. R. BANGARAIAH (18) [AC] -> Link 8 (COR-2) & E.V. RAMANAMMA (91) [SL] -> Link 4 (Ladies)
  // 10. K.K. KUMAR (84) [AC] & P.G. RAO (53) [SL] -> Link 11 (17225/17226)
  // 11. SK. KARIMULLAH (32) [AC] & A.G. KRISHNA (98) [SL] -> Link 57 (17225/18048)
  // 12. SK. M. BASHA (46) [AC+SL] & K.K. SINGH (60) [SL] -> Link 36/50 (17626/17625)
  // 13. K.S. RAO (1) [AC] (COR Link 12) & S.S. MANYAM (76) [SL] (Link 3) & S. SRINU (41) [SL] (Link 31) -> 12604/12603
  // 14. M.V. ANJANEYULU (111) [SL] (Link 8) & CH. R. BABU (7) [COR-2] (COR Link 10) -> 12734/20630 & 17262
  // 15. S.H. TULASI (118) [COR-1] (COR Link 18) -> 12734/20630
  // 16. K. GOPI (70) [AC+SL] & D. RAKESH (99) [SL] -> Link 39/53 (17243/17244)
  // 17. N.C. MEENA (106) [SL] -> Non-Daily / Extra 17646/17645 (or Link 48)
  // 18. S.V. SIVA KUMAR (112) [AC+SL] -> Non-Daily 17221/17222 (GNT-LPI-GNT)
  // 19. B.P. SINGH (116) [SL] -> Non-Daily 16858/12603
  // 20. U. BALA JOJI (39) [AC+SL] -> Non-Daily Special 07193/07194

  // Let's execute overrides for 12.09.26 Saturday:
  await run(`DELETE FROM overrides WHERE date = ?`, [d1]);

  // Overrides for 12.09.26:
  // 1. RNR NAIK (ID 25) -> Link 1 (17253/17252)
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (25, ?, 15, 1, 'CHANGED_LINK', 'Assigned to Link #1 (17253/17252)', 2)`, [d1]);
  // 2. T ANKAMMA RAO (ID 109) -> Link 29 (17239/17240)
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (109, ?, NULL, 29, 'CHANGED_LINK', 'Assigned to Link #29 (17239/17240)', 2)`, [d1]);
  // 3. T KANTHA RAO (ID 107) -> Link 17 (17646/12796)
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (107, ?, NULL, 17, 'CHANGED_LINK', 'Assigned to Link #17 (17646/12796)', 2)`, [d1]);
  // 4. B VENKAT REDDY (ID 102) -> Link 19 (12805/12806)
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (102, ?, NULL, 19, 'CHANGED_LINK', 'Assigned to Link #19 (12805/12806)', 2)`, [d1]);
  // 5. ELN RAO (ID 113) -> Link 47 (12795/17645)
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (113, ?, NULL, 47, 'CHANGED_LINK', 'Assigned to Link #47 (12795/17645)', 2)`, [d1]);
  // 8. S NAGALINGAPPA (ID 14) -> Conductor Link 4 (17261/12733 COR-1)
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (14, ?, 4, 4, 'CHANGED_LINK', 'Assigned to Link #4 (17261/12733 COR-1)', 1)`, [d1]);
  // 9. R BANGARAIAH (ID 18) -> Conductor Link 8 (20629/12733 COR-2)
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (18, ?, 8, 8, 'CHANGED_LINK', 'Assigned to Link #8 (20629/12733 COR-2)', 1)`, [d1]);
  // 10. K KRANTHI KUMAR (ID 84) -> Link 11 (17225/17226 AC) & P GOPALA RAO (ID 53) -> Link 11 (SL)
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (84, ?, 11, 11, 'CHANGED_LINK', 'Assigned to Link #11 (17225/17226 AC)', 2)`, [d1]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (53, ?, 43, 11, 'CHANGED_LINK', 'Assigned to Link #11 (17225/17226 SL)', 2)`, [d1]);
  // 11. SK KARIMULLAH (ID 32) -> Link 57 (17225/18048 AC) & AG KRISHNA (ID 98) -> Link 57 (SL)
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (32, ?, 22, 57, 'CHANGED_LINK', 'Assigned to Link #57 (17225/18048 AC)', 2)`, [d1]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (98, ?, NULL, 57, 'CHANGED_LINK', 'Assigned to Link #57 (17225/18048 SL)', 2)`, [d1]);
  // 12. SK MASTAN BASHA (ID 46) -> Link 36 (17626/17625 AC+SL) & K KUSHWANTH SINGH (ID 60) -> Link 50 (SL)
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (46, ?, 36, 36, 'CHANGED_LINK', 'Assigned to Link #36 (17626/17625 AC+SL)', 2)`, [d1]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (60, ?, 50, 50, 'CHANGED_LINK', 'Assigned to Link #50 (17626/17625 SL)', 2)`, [d1]);
  // 13. KAKI SRINIVASA RAO (ID 1) -> Conductor Link 12 (12604/12603 AC) & S SUBRAHMANYAM (ID 76) -> Link 3 (SL) & SUVVADA SRINU (ID 41) -> Link 31 (SL)
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (1, ?, 12, 12, 'SUBSTITUTE', 'Upgraded to COR Link 12 (12604/12603 AC)', 1)`, [d1]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (76, ?, 3, 3, 'CHANGED_LINK', 'Assigned to Link #3 (12604/12603 SL)', 2)`, [d1]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (41, ?, 31, 31, 'CHANGED_LINK', 'Assigned to Link #31 (12604/12603 SL)', 2)`, [d1]);
  // 14. MV ANJANEYULU (ID 111) -> Link 8 (12734/20630 SL) & CH RAMESH BABU (ID 7) -> Conductor Link 10 (12734 COR-2 / 17262 AC)
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (111, ?, NULL, 8, 'CHANGED_LINK', 'Assigned to Link #8 (12734/20630 SL)', 2)`, [d1]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (7, ?, 18, 10, 'CHANGED_LINK', 'Assigned to Link #10 (12734 COR-2 / 17262 AC)', 1)`, [d1]);
  // 15. S HYMA TULASI (ID 118) -> Conductor Link 18 (12734 COR-1 / 20630 AC)
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (118, ?, NULL, 18, 'CHANGED_LINK', 'Assigned to Link #18 (12734 COR-1 / 20630 AC)', 1)`, [d1]);
  // 16. K GOPI (ID 70) -> Link 39 (17243/17244 AC+SL) & D RAKESH (ID 99) -> Link 53 (SL)
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (70, ?, 47, 39, 'CHANGED_LINK', 'Assigned to Link #39 (17243/17244 AC+SL)', 2)`, [d1]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (99, ?, NULL, 53, 'CHANGED_LINK', 'Assigned to Link #53 (17243/17244 SL)', 2)`, [d1]);
  // 17. NC MEENA (ID 106) -> Non-Daily / Extra (17646/17645 SL)
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, is_extra, extra_train_no, shifted_place, reason, target_category_id) VALUES (106, ?, NULL, NULL, 'EXTRA_CREW', 1, '17646/17645', 'Train 17646/17645 SL', 'Extra Train 17646/17645', 4)`, [d1]);
  // 18. SV SIVA KUMAR (ID 112) -> Non-Daily Train 17221/17222 (GNT-LPI-GNT)
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, is_extra, extra_train_no, shifted_place, reason, target_category_id) VALUES (112, ?, NULL, NULL, 'EXTRA_CREW', 1, '17221/17222', 'Non-Daily Train 17221/17222', 'Non-Daily Train 17221/17222 (GNT-LPI-GNT)', 4)`, [d1]);
  // 19. B P SINGH (ID 116) -> Non-Daily Train 16858/12603
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, is_extra, extra_train_no, shifted_place, reason, target_category_id) VALUES (116, ?, NULL, NULL, 'EXTRA_CREW', 1, '16858/12603', 'Non-Daily Train 16858/12603', 'Non-Daily Train 16858/12603', 4)`, [d1]);
  // 20. U BALA JOJI (ID 39) -> Non-Daily Special Train 07193/07194
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, is_extra, extra_train_no, shifted_place, reason, target_category_id) VALUES (39, ?, NULL, NULL, 'EXTRA_CREW', 1, '07193/07194', 'Special Train 07193/07194', 'Special Train 07193/07194', 2)`, [d1]);

  // Sync LR Sheet for 12.09.26:
  await run(`INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks) VALUES (109, ?, '17239', 'Link #29') ON CONFLICT(staff_id, date) DO UPDATE SET duty_code='17239', remarks='Link #29'`, [d1]);
  await run(`INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks) VALUES (107, ?, '17646', 'Link #17') ON CONFLICT(staff_id, date) DO UPDATE SET duty_code='17646', remarks='Link #17'`, [d1]);
  await run(`INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks) VALUES (102, ?, '12805', 'Link #19') ON CONFLICT(staff_id, date) DO UPDATE SET duty_code='12805', remarks='Link #19'`, [d1]);
  await run(`INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks) VALUES (113, ?, '12795', 'Link #47') ON CONFLICT(staff_id, date) DO UPDATE SET duty_code='12795', remarks='Link #47'`, [d1]);
  await run(`INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks) VALUES (98, ?, '18047', 'Link #57 (SL)') ON CONFLICT(staff_id, date) DO UPDATE SET duty_code='18047', remarks='Link #57 (SL)'`, [d1]);
  await run(`INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks) VALUES (111, ?, '12734', 'Link #8') ON CONFLICT(staff_id, date) DO UPDATE SET duty_code='12734', remarks='Link #8'`, [d1]);
  await run(`INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks) VALUES (118, ?, '12734', 'Link #18') ON CONFLICT(staff_id, date) DO UPDATE SET duty_code='12734', remarks='Link #18'`, [d1]);
  await run(`INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks) VALUES (99, ?, '17243', 'Link #53') ON CONFLICT(staff_id, date) DO UPDATE SET duty_code='17243', remarks='Link #53'`, [d1]);
  await run(`INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks) VALUES (106, ?, '17646', 'Extra Train 17646') ON CONFLICT(staff_id, date) DO UPDATE SET duty_code='17646', remarks='Extra Train 17646'`, [d1]);
  await run(`INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks) VALUES (112, ?, '17221', 'Non-Daily 17221') ON CONFLICT(staff_id, date) DO UPDATE SET duty_code='17221', remarks='Non-Daily 17221'`, [d1]);
  await run(`INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks) VALUES (116, ?, '16858', 'Non-Daily 16858') ON CONFLICT(staff_id, date) DO UPDATE SET duty_code='16858', remarks='Non-Daily 16858'`, [d1]);

  console.log('✓ Synchronized 12.09.26 Saturday');


  // =========================================================================
  // DATE 2: 15.09.26 TUESDAY (2026-09-15)
  // =========================================================================
  const d2 = '2026-09-15';
  console.log(`\n========================================\nPROCESSING DATE: ${d2} (TUESDAY)\n========================================`);
  await run(`DELETE FROM overrides WHERE date = ?`, [d2]);

  // Page 16 & 17 data for 15.09.26 Tuesday:
  // 1. SVSR KRISHNA (22) -> Link 1 (17253/17252 AC+SL)
  // 2. ELN RAO (113) -> Link 29 (17239/17240 AC+2S)
  // 3. M NAGARAJU (36) -> Link 17 (17646/12796 AC+SL/AC+2S)
  // 4. SV SIVA KUMAR (112) -> Link 19 (12805/12806 AC+2S)
  // 5. K KOTI REDDY (54) -> Link 47 (12795/17645 AC+2S/AC+SL)
  // 6. G VARADARAJULU (75) -> Link 5 (17251/17254 AC+SL)
  // 7. BVS REDDY (24) -> Link 45 (17281/17282 2S)
  // 8. V UMA DEVI (85) [AC] -> Conductor Link 4 (17261/12733 COR-2) & K SIVA PARVATHI (88) [SL] -> Ladies Link 1 (17261/17262)
  // 9. LP KUMAR (15) [AC] -> Conductor Link 8 (20629/12733 COR-1) & N SWARNA BABU (50) [SL] -> Sleeper Link 43 (20629/20630)
  // 10. M SRINIVASULU (8) [AC] -> Conductor Link 1 (17225/17226 AC) & SK KARIMULLAH (32) [SL] -> Sleeper Link 11 (17225/17226 SL)
  // 11. KAKI SRINIVASA RAO (1) [AC] -> Link 57 (18047/17226 AC) & T SRIHARSHA (64) [SL] -> Link 57 (18047/17226 SL)
  // 12. T SIVA KUMAR (43) [AC+SL] -> Link 36 (17626/17625 AC+SL) & G SHIVAN (100) [SL] -> Link 50 (SL)
  // 13. PRM ALI KHAN (19) [AC] -> Conductor Link 12 (12604/12603 AC) & Y KORNELU BABU (73) [SL] (Link 3) & M SURESH (38) [SL] (Link 31) -> 12604/12603
  // 14. BV RAO (17) [COR-1] -> Conductor Link 10 (12734/20630) & BP RAJA KUMAR (4) [COR-2] -> Conductor Link 18 (12734/17262)
  // 15. A VENKI REDDY (78) [SL] -> Sleeper Link 8 (12734/20630 SL)
  // 16. SK MASTAN BASHA (46) [AC+SL] -> Sleeper Link 39 (17243/17244 AC+SL) & K KUSHWANTH SINGH (60) [SL] -> Link 53 (SL)
  // 17. D RAKESH (99) [SL] -> Non-Daily Train 17041/17042 (GNT-NED-GNT)
  // 18. MV ANJANEYULU (111) [AC+SL] -> Non-Daily Special Train 17077/17078

  // Overrides for 15.09.26:
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (113, ?, NULL, 29, 'CHANGED_LINK', 'Assigned to Link #29 (17239/17240)', 2)`, [d2]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (112, ?, NULL, 19, 'CHANGED_LINK', 'Assigned to Link #19 (12805/12806)', 2)`, [d2]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (85, ?, 1, 4, 'CHANGED_LINK', 'Assigned to Link #4 (17261/12733 COR-2)', 1)`, [d2]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (1, ?, 15, 57, 'CHANGED_LINK', 'Assigned to Link #57 (18047/17226 AC)', 2)`, [d2]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (64, ?, NULL, 57, 'CHANGED_LINK', 'Assigned to Link #57 (18047/17226 SL)', 2)`, [d2]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (100, ?, NULL, 50, 'CHANGED_LINK', 'Assigned to Link #50 (17626/17625 SL)', 2)`, [d2]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (19, ?, 12, 12, 'SUBSTITUTE', 'Upgraded to COR Link 12 (12604/12603 AC)', 1)`, [d2]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (73, ?, 3, 3, 'CHANGED_LINK', 'Assigned to Link #3 (12604/12603 SL)', 2)`, [d2]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (38, ?, 31, 31, 'CHANGED_LINK', 'Assigned to Link #31 (12604/12603 SL)', 2)`, [d2]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (4, ?, 18, 18, 'CHANGED_LINK', 'Assigned to Link #18 (12734/17262 COR-2)', 1)`, [d2]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (78, ?, 8, 8, 'CHANGED_LINK', 'Assigned to Link #8 (12734/20630 SL)', 2)`, [d2]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, is_extra, extra_train_no, shifted_place, reason, target_category_id) VALUES (99, ?, NULL, NULL, 'EXTRA_CREW', 1, '17041/17042', 'Non-Daily Train 17041/17042', 'Non-Daily Train 17041/17042', 4)`, [d2]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, is_extra, extra_train_no, shifted_place, reason, target_category_id) VALUES (111, ?, NULL, NULL, 'EXTRA_CREW', 1, '17077/17078', 'Special Train 17077/17078', 'Special Train 17077/17078', 4)`, [d2]);

  // Sync LR Sheet for 15.09.26:
  await run(`INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks) VALUES (113, ?, '17239', 'Link #29') ON CONFLICT(staff_id, date) DO UPDATE SET duty_code='17239', remarks='Link #29'`, [d2]);
  await run(`INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks) VALUES (112, ?, '12805', 'Link #19') ON CONFLICT(staff_id, date) DO UPDATE SET duty_code='12805', remarks='Link #19'`, [d2]);
  await run(`INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks) VALUES (100, ?, '17626', 'Link #50') ON CONFLICT(staff_id, date) DO UPDATE SET duty_code='17626', remarks='Link #50'`, [d2]);
  await run(`INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks) VALUES (99, ?, '17041', 'Non-Daily 17041') ON CONFLICT(staff_id, date) DO UPDATE SET duty_code='17041', remarks='Non-Daily 17041'`, [d2]);
  await run(`INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks) VALUES (111, ?, '17077', 'Special Train 17077') ON CONFLICT(staff_id, date) DO UPDATE SET duty_code='17077', remarks='Special Train 17077'`, [d2]);

  console.log('✓ Synchronized 15.09.26 Tuesday');


  // =========================================================================
  // DATE 3: 20.09.26 SUNDAY (2026-09-20)
  // =========================================================================
  const d3 = '2026-09-20';
  console.log(`\n========================================\nPROCESSING DATE: ${d3} (SUNDAY)\n========================================`);
  await run(`DELETE FROM overrides WHERE date = ?`, [d3]);

  // Page 26 & 27 data for 20.09.26 Sunday:
  // 1. O ANIL (80) -> Link 1 (17253/17252 AC+SL)
  // 2. K DURGA RAO (31) -> Link 29 (17239/17240 AC+2S)
  // 3. SK JHA (82) -> Link 17 (17646/12796 AC+SL/AC+2S)
  // 4. KK KUMAR (K KISHAN KUMAR 61) -> Link 19 (12805/12806 AC+2S)
  // 5. NC MEENA (106) -> Link 47 (12795/17645 AC+2S/AC+SL)
  // 6. K GOPI (70) -> Link 5 (17251/17254 AC+SL)
  // 7. B SURESH (47) -> Link 45 (17281/17282 2S)
  // 8. B KEZIA KUMARI (90) [AC] -> Link 4 (17261/12733 COR-2) & K SIVA PARVATHI (88) [SL] -> Ladies Link 1 (17261/17262)
  // 9. K V RAMANA RAO (10) [AC] -> Conductor Link 8 (20629/12733 COR-1) & M VENKATESWARLU (45) [SL] -> Sleeper Link 43 (20629/20630)
  // 10. I DASARADHI (3) [AC] -> Conductor Link 1 (17225/17226 AC) & S SUBRAHMANYAM (76) [SL] -> Sleeper Link 11 (17225/17226 SL)
  // 11. BV RAO (17) [AC] -> Link 57 (18047/17226 AC) & D VANIL KUMAR (59) [SL] -> Link 57 (18047/17226 SL)
  // 12. M SURESH (38) [AC+SL] -> Link 36 (17626/17625 AC+SL) & BP SINGH (116) [SL] -> Link 50 (SL)
  // 13. S NAGALINGAPPA (14) [AC] -> Conductor Link 12 (12604/12603 AC) & BP RAJA KUMAR (4) [SL] (Link 3) & RNR NAIK (25) [SL] (Link 31) -> 12604/12603
  // 14. BRK REDDY (12) [COR-1] -> Conductor Link 10 (12734/20630) & VAN REDDY (20) [COR-2] -> Conductor Link 18 (12734/17262)
  // 15. YK BABU (73) [SL] -> Sleeper Link 8 (12734/20630 SL)
  // 16. PV SUBBA RAO (55) [AC+SL] -> Sleeper Link 39 (17243/17244 AC+SL) & Y MURALI KRISHNA (62) [SL] -> Link 53 (SL)
  // 17. AG KRISHNA (98) [AC+SL] -> Non-Daily Train 17032/17232 (PILOT to GNT)
  // 18. BVS REDDY (24) -> Train 17231/17232 AC+SL
  // 19. BR MEENA (108) -> Special Train 02811/02812 (GNT-BBS-GNT AC)

  // Overrides for 20.09.26:
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (106, ?, NULL, 47, 'CHANGED_LINK', 'Assigned to Link #47 (12795/17645)', 2)`, [d3]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (90, ?, 5, 4, 'CHANGED_LINK', 'Assigned to Link #4 (17261/12733 COR-2)', 1)`, [d3]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (17, ?, 15, 57, 'CHANGED_LINK', 'Assigned to Link #57 (18047/17226 AC)', 2)`, [d3]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (59, ?, NULL, 57, 'CHANGED_LINK', 'Assigned to Link #57 (18047/17226 SL)', 2)`, [d3]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (116, ?, NULL, 50, 'CHANGED_LINK', 'Assigned to Link #50 (17626/17625 SL)', 2)`, [d3]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (14, ?, 12, 12, 'SUBSTITUTE', 'Upgraded to COR Link 12 (12604/12603 AC)', 1)`, [d3]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (4, ?, 3, 3, 'CHANGED_LINK', 'Assigned to Link #3 (12604/12603 SL)', 2)`, [d3]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (25, ?, 31, 31, 'CHANGED_LINK', 'Assigned to Link #31 (12604/12603 SL)', 2)`, [d3]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, reason, target_category_id) VALUES (20, ?, 18, 18, 'CHANGED_LINK', 'Assigned to Link #18 (12734/17262 COR-2)', 1)`, [d3]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, is_extra, extra_train_no, shifted_place, reason, target_category_id) VALUES (98, ?, NULL, NULL, 'EXTRA_CREW', 1, '17032/17232', 'Train 17032/17232', 'Non-Daily Train 17032/17232', 4)`, [d3]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, is_extra, extra_train_no, shifted_place, reason, target_category_id) VALUES (24, ?, NULL, NULL, 'EXTRA_CREW', 1, '17231/17232', 'Train 17231/17232', 'Non-Daily Train 17231/17232', 2)`, [d3]);
  await run(`INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, is_extra, extra_train_no, shifted_place, reason, target_category_id) VALUES (108, ?, NULL, NULL, 'EXTRA_CREW', 1, '02811/02812', 'Special Train 02811/02812', 'Special Train 02811/02812 (GNT-BBS-GNT AC)', 4)`, [d3]);

  // Sync LR Sheet for 20.09.26:
  await run(`INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks) VALUES (106, ?, '12795', 'Link #47') ON CONFLICT(staff_id, date) DO UPDATE SET duty_code='12795', remarks='Link #47'`, [d3]);
  await run(`INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks) VALUES (116, ?, '17626', 'Link #50') ON CONFLICT(staff_id, date) DO UPDATE SET duty_code='17626', remarks='Link #50'`, [d3]);
  await run(`INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks) VALUES (98, ?, '17032', 'Train 17032') ON CONFLICT(staff_id, date) DO UPDATE SET duty_code='17032', remarks='Train 17032'`, [d3]);
  await run(`INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks) VALUES (108, ?, '02811', 'Special Train 02811') ON CONFLICT(staff_id, date) DO UPDATE SET duty_code='02811', remarks='Special Train 02811'`, [d3]);

  console.log('✓ Synchronized 20.09.26 Sunday');

  console.log('\n========================================');
  console.log('ALL 3 DATES (12.09, 15.09, 20.09) SYNCHRONIZED SUCCESSFULLY!');
  console.log('========================================');
}

processAllDates().catch(console.error);
