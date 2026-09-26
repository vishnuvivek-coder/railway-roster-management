const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'roster.db'));

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

async function fix10thSep() {
  const d = '2026-09-10';
  console.log(`Applying complete and accurate fixes for ${d} (Thursday, Pages 6 & 7)...`);

  // Delete previous overrides for this date to ensure clean state
  await run('DELETE FROM overrides WHERE date = ?', [d]);

  // Overrides list based on physical register Pages 6 & 7
  const overrides = [
    // Left Page (Page 6)
    // Line 1: NC MEENA (106) on 17253/17252 -> Link 1
    { staff_id: 106, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Link #1 (17253/17252 AC+SL)', target_category_id: 2 },
    // Line 2: SUVVADA SRINU (41) is cyclic base Link 29 -> no override needed
    // Line 3: D RAKESH (99) on 17646/12796 -> Link 17
    { staff_id: 99, overridden_link_number: 17, status: 'CHANGED_LINK', reason: 'Link #17 (17646/12796 AC+SL)', target_category_id: 2 },
    // Line 4: B P SINGH (116) on 12805/12806 -> Link 19
    { staff_id: 116, overridden_link_number: 19, status: 'CHANGED_LINK', reason: 'Link #19 (12805/12806 AC+2S)', target_category_id: 2 },
    // Line 5: D VANIL KUMAR (59) is cyclic base Link 47 (12795/17645) -> no override needed
    // Line 6: O ANIL (80) is cyclic base Link 5 (17251/17254) -> no override needed
    // Line 7: R SAIDA NAIK (117) on 17281/17282 -> Link 45
    { staff_id: 117, overridden_link_number: 45, status: 'CHANGED_LINK', reason: 'Link #45 (17281/17282 2S)', target_category_id: 2 },
    // Line 8: S PRAKASA RAO (16) is cyclic base Conductor Link 4; B KEZIA KUMARI (90) is cyclic base Ladies Link 1; VS CHANDRIKA (86) on Link 1
    { staff_id: 86, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Ladies Link #1 (17261/17262 SL)', target_category_id: 3 },
    // Line 9: VAN REDDY (20) is cyclic base Conductor Link 8; KV SURESH (34) on Link 43
    { staff_id: 34, overridden_link_number: 43, status: 'CHANGED_LINK', reason: 'Link #43 (20629/20630 SL)', target_category_id: 2 },
    // Line 10: J VINAY KUMAR (23) is cyclic base Link 11; U RAMA KRISHNA (37) on Link 11
    { staff_id: 37, overridden_link_number: 11, status: 'CHANGED_LINK', reason: 'Link #11 (17225/17226 SL)', target_category_id: 2 },
    // Line 11: PRM ALI KHAN (19) on Link 57 AC; MV ANJANEYULU (111) on Link 57 SL
    { staff_id: 19, overridden_link_number: 57, status: 'SUBSTITUTE', reason: 'COR Link #57 (17225/18048 AC)', target_category_id: 1 },
    { staff_id: 111, overridden_link_number: 57, status: 'CHANGED_LINK', reason: 'Link #57 (17225/18048 SL)', target_category_id: 2 },
    // Line 12: SH MADHU BABU (83) on Link 36; AG KRISHNA (98) on Link 50
    { staff_id: 83, overridden_link_number: 36, status: 'CHANGED_LINK', reason: 'Link #36 (17626/17625 AC+SL)', target_category_id: 2 },
    { staff_id: 98, overridden_link_number: 50, status: 'CHANGED_LINK', reason: 'Link #50 (17626/17625 SL)', target_category_id: 2 },

    // Right Page (Page 7)
    // Line 1: T SIVA KUMAR (43) on Conductor Link 12; ELN RAO (113) on Link 3; A VENKI REDDY (78) on Link 31
    { staff_id: 43, overridden_link_number: 12, status: 'SUBSTITUTE', reason: 'COR Link #12 (12604/12603 AC)', target_category_id: 1 },
    { staff_id: 113, overridden_link_number: 3, status: 'CHANGED_LINK', reason: 'Link #3 (12604/12603 SL)', target_category_id: 2 },
    { staff_id: 78, overridden_link_number: 31, status: 'CHANGED_LINK', reason: 'Link #31 (12604/12603 SL)', target_category_id: 2 },
    // Line 2: SVSR KRISHNA (1, KS RAO) is cyclic base Conductor Link 10; VV PAVAN KUMAR (9) is cyclic base Conductor Link 18 -> no override needed
    // Line 3: S HYMA TULASI (118) on Link 8
    { staff_id: 118, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'Link #8 (12734/20630 SL)', target_category_id: 2 },
    // Line 4: D ANVESH (72) on Link 39; Y SRIKANTH (51) on Link 53
    { staff_id: 72, overridden_link_number: 39, status: 'CHANGED_LINK', reason: 'Link #39 (17243/17244 AC+SL)', target_category_id: 2 },
    { staff_id: 51, overridden_link_number: 53, status: 'CHANGED_LINK', reason: 'Link #53 (17243/17244 SL)', target_category_id: 2 },
    // Line 5: S SUBRAHMANYAM (76) on Non-Daily Train 12755/17625
    { staff_id: 76, overridden_link_number: null, status: 'EXTRA_CREW', extra_train_no: '12755/17625', reason: 'Non-Daily Train 12755/17625' },
    // Line 6: V SRINIVASA RAO (114) on Non-Daily Train 12604/16357
    { staff_id: 114, overridden_link_number: null, status: 'EXTRA_CREW', extra_train_no: '12604/16357', reason: 'Non-Daily Train 12604/16357' },
    // Line 7: KB RAO (104) on Special Train 07001/17070
    { staff_id: 104, overridden_link_number: null, status: 'EXTRA_CREW', extra_train_no: '07001/17070', reason: 'Special Train 07001/17070' },
    // Line 8: SANJAY KUMAR (105) on Special Train 07001 Pilot / 07002
    { staff_id: 105, overridden_link_number: null, status: 'EXTRA_CREW', extra_train_no: '07001/07002', reason: 'Special Train 07001 Pilot / 07002' },

    // Leaves / Sickness
    { staff_id: 31, overridden_link_number: null, status: 'LEAVE', leave_type: 'SCL', reason: 'SCL Leave' },
    { staff_id: 55, overridden_link_number: null, status: 'LEAVE', leave_type: 'CL', reason: 'CL Leave' },
    { staff_id: 6, overridden_link_number: null, status: 'SICK', leave_type: 'SICK', reason: 'Sick Leave' },
    { staff_id: 13, overridden_link_number: null, status: 'LEAVE', leave_type: 'LAP', reason: 'LAP Leave' },
    { staff_id: 3, overridden_link_number: null, status: 'AVAILABLE_FOR_BOOKING', reason: 'Available for booking / Spare' }
  ];

  for (const o of overrides) {
    await run(
      `INSERT INTO overrides (staff_id, date, overridden_link_number, status, extra_train_no, reason, target_category_id, leave_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [o.staff_id, d, o.overridden_link_number || null, o.status, o.extra_train_no || null, o.reason, o.target_category_id || null, o.leave_type || null]
    );
  }

  // Update muster_records for leave / sickness
  const musterUpdates = [
    { staff_id: 31, code: 'SCL', remarks: 'SCL Leave' },
    { staff_id: 55, code: 'CL', remarks: 'CL Leave' },
    { staff_id: 6, code: 'SICK', remarks: 'Sick Leave' },
    { staff_id: 13, code: 'LAP', remarks: 'LAP Leave' }
  ];

  for (const m of musterUpdates) {
    await run(
      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by, updated_at)
       VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
       ON CONFLICT(staff_id, date) DO UPDATE SET code = excluded.code, remarks = excluded.remarks, updated_at = CURRENT_TIMESTAMP`,
      [m.staff_id, d, m.code, m.remarks]
    );
  }

  // LR Sheet records for Category 4 staff on 2026-09-10
  const lrDuties = [
    { staff_id: 106, duty_code: '17253', remarks: '17253/17252 (Link 1)' },
    { staff_id: 99, duty_code: '17646', remarks: '17646/12796 (Link 17)' },
    { staff_id: 116, duty_code: '12805', remarks: '12805/12806 (Link 19)' },
    { staff_id: 117, duty_code: '17281', remarks: '17281/17282 (Link 45)' },
    { staff_id: 111, duty_code: '17225', remarks: '17225/18048 SL (Link 57)' },
    { staff_id: 98, duty_code: '17626', remarks: '17626/17625 SL (Link 50)' },
    { staff_id: 113, duty_code: '12604', remarks: '12604/12603 SL (Link 3)' },
    { staff_id: 118, duty_code: '12734', remarks: '12734/20630 SL (Link 8)' },
    { staff_id: 114, duty_code: '12604', remarks: 'Non-Daily 12604/16357' },
    { staff_id: 104, duty_code: '07001', remarks: 'Special 07001/17070' },
    { staff_id: 105, duty_code: '07001', remarks: 'Special 07001 Pilot/07002' }
  ];

  for (const lr of lrDuties) {
    await run(
      `INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks, updated_by, updated_at)
       VALUES (?, ?, ?, ?, 'Admin', CURRENT_TIMESTAMP)
       ON CONFLICT(staff_id, date) DO UPDATE SET duty_code = excluded.duty_code, remarks = excluded.remarks, updated_at = CURRENT_TIMESTAMP`,
      [lr.staff_id, d, lr.duty_code, lr.remarks]
    );
  }

  console.log(`Successfully updated ${overrides.length} overrides, ${musterUpdates.length} muster records, and ${lrDuties.length} LR movement records for ${d}.`);
}

fix10thSep().then(() => {
  db.close();
}).catch(err => {
  console.error(err);
  db.close();
});
