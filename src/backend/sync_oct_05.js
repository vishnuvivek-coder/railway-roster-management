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

async function syncOctober05() {
  const date = '2026-10-05';
  console.log('=== SYNCING OFFICIAL PHYSICAL REGISTER FOR 05-10-2026 (MONDAY) ===');

  // Exact assignments from Pages 56 and 57 of the physical daily duty register
  const assignments = [
    // Slot 1: Train 17253 / 17252 (GNT - DHNE - GNT) -> Y. SRIKANTH
    { staff_id: 51, link: 15, cat: 2, train: '17253', reason: 'Link #15 (17253/17252 AC+SL)' },

    // Slot 2: Train 17239 / 17240 (Simhadri Exp: GNT - VSKP - GNT) -> KVB SANKAR
    { staff_id: 44, link: 1, cat: 2, train: '17239', reason: 'Link #1 (17239/17240 AC+2S)' },

    // Slot 3: Train 17646 / 12796 (GNT - SC - BZA) -> BR MEENA (LR draft)
    { staff_id: 108, link: 17, cat: 2, train: '17646', reason: 'Link #17 (17646/12796 AC+SL)' },

    // Slot 4: Train 12805 / 12806 (Janmabhoomi Exp: GNT - SC) -> G.V. RAJULU (G VARADARAJULU)
    { staff_id: 75, link: 19, cat: 2, train: '12805', reason: 'Link #19 (12805/12806 AC+2S)' },

    // Slot 5: Train 12795 / 17645 (BZA - SC - GNT) -> K.B. RAO (KB RAO, LR draft)
    { staff_id: 104, link: 40, cat: 2, train: '12795', reason: 'Link #40 (12795/17645 AC+2S)' },

    // Slot 6: Train 17251 / 17254 (Dhone Exp: GNT - DHNE) -> P.V.S. RAO (PV SUBBA RAO)
    { staff_id: 55, link: 5, cat: 2, train: '17251', reason: 'Link #5 (17251/17254 AC+SL)' },

    // Slot 7: Train 17281 / 17282 (GNT - NS Exp) -> RNR NAIK
    { staff_id: 25, link: 38, cat: 2, train: '17281', reason: 'Link #38 (17281/17282 2S)' },

    // Slot 8: Train 17261 / 12733 / 17262 (GNT - TPTY)
    // BRK REDDY (AC / COR-1), V.S. CHANDRIKA (SL-S5), K.S. PARVATHI (S10-S14)
    { staff_id: 12, link: 4, cat: 1, train: '17261', reason: 'COR Link #4 (17261/12733 AC COR-1)' },
    { staff_id: 86, link: 1, cat: 3, train: '17261', reason: 'Ladies Link #1 (17261/17262 SL-S5)' },
    { staff_id: 88, link: 4, cat: 3, train: '17261', reason: 'Ladies Link #4 (17261/17262 S10-S14)' },

    // Slot 9: Train 20629 / 12733 / 20630 (Tirupati Exp: GNT - TPTY)
    // S.P. RAO (AC / COR-2), J.V. KUMAR (SL), D. ANVESH (SL)
    { staff_id: 16, link: 8, cat: 1, train: '20629', reason: 'COR Link #8 (20629/12733 AC COR-2)' },
    { staff_id: 23, link: 36, cat: 2, train: '20629', reason: 'Link #36 (20629/12733 SL)' },
    { staff_id: 72, link: 22, cat: 2, train: '20629', reason: 'Link #22 (20629/20630 SL)' },

    // Slot 10: Train 17225 / 17226 (Amaravati Exp: BZA - GTL)
    // V.V.P. KUMAR (AC), K.K. REDDY (SL)
    { staff_id: 9, link: 1, cat: 1, train: '17225', reason: 'COR Link #1 (17225/17226 AC)' },
    { staff_id: 54, link: 11, cat: 2, train: '17225', reason: 'Link #11 (17225/17226 SL)' },

    // Slot 11: Train 18047 / 18048 (Amaravati Exp: BZA - GTL)
    // K. RAMANAIAH (AC), U. RAMA KRISHNA (SL)
    { staff_id: 2, link: 15, cat: 1, train: '18047', reason: 'COR Link #15 (18047/18048 AC)' },
    { staff_id: 37, link: 50, cat: 2, train: '18047', reason: 'Link #50 (18047/18048 SL)' },

    // Slot 12: Train 17626 / 17625 (RAL - SC)
    // SK KHASIM (AC+SL), P.R. KUMAR (SL)
    { staff_id: 30, link: 29, cat: 2, train: '17626', reason: 'Link #29 (17626/17625 AC+SL)' },
    { staff_id: 79, link: 43, cat: 2, train: '17626', reason: 'Link #43 (17626/17625 SL)' },

    // Slot 13: Train 12604 / 12603 (Chennai Exp: GNT - MAS)
    // SK. M. BASHA (AC), M.V. ANJANEYULU (SL / Extra Crew), R.S. NAIK (Extra Crew)
    { staff_id: 46, link: 3, cat: 2, train: '12604', reason: 'Link #3 (12604/12603 AC)' },
    { staff_id: 111, is_extra: 1, train: '12604', reason: 'Extra Crew: Train 12604/12603 SL' },
    { staff_id: 117, is_extra: 1, train: '12604', reason: 'Extra Crew: Train 12604/12603' },

    // Slot 14: Train 12734 / 20630 / 17262 (Narayanadri Exp: GNT - TPTY)
    // TRS REDDY (COR-1), K. NARESH (COR-2, Upgraded), B.R. KUMAR (SL)
    // PRM ALI KHAN IS NOT ON THIS TRAIN!
    { staff_id: 5, link: 11, cat: 1, train: '12734', reason: 'COR Link #11 (12734 COR-1 / 17262)' },
    { staff_id: 58, link: 18, cat: 1, train: '12734', reason: 'Upgraded to COR Link #18 (12734 COR-2 / 20630)' },
    { staff_id: 68, link: 8, cat: 2, train: '12734', reason: 'Link #8 (12734 SL / 20630)' },

    // Slot 15: Train 17243 / 17244 (Rayagada Exp: GNT - VSKP)
    // SK JHA (AC+SL), N.K. KUMAR (SL)
    { staff_id: 82, link: 32, cat: 2, train: '17243', reason: 'Link #32 (17243/17244 AC+SL)' },
    { staff_id: 61, link: 46, cat: 2, train: '17243', reason: 'Link #46 (17243/17244 SL)' },

    // Special Service / Extra: Train 17637 / 17638 -> SANJAY (LR draft)
    { staff_id: 105, is_extra: 1, train: '17637', reason: 'Extra Crew: Train 17637/17638 AC+SL' },

    // PRM ALI KHAN -> Weekly Rest / Off
    { staff_id: 19, status: 'REST', reason: 'Weekly Rest / Off' }
  ];

  for (const a of assignments) {
    await run(
      'INSERT INTO overrides (staff_id, date, overridden_link_number, target_category_id, status, reason, is_extra, extra_train_no) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(staff_id, date) DO UPDATE SET overridden_link_number = excluded.overridden_link_number, target_category_id = excluded.target_category_id, status = excluded.status, reason = excluded.reason, is_extra = excluded.is_extra, extra_train_no = excluded.extra_train_no',
      [
        a.staff_id,
        date,
        a.link || null,
        a.cat || null,
        a.status || (a.is_extra ? 'EXTRA_CREW' : 'CHANGED_LINK'),
        a.reason || '',
        a.is_extra || 0,
        a.is_extra ? a.train : null
      ]
    );
  }

  // Clear any conflicting 'R' muster record for SK MASTAN BASHA (46) on this date
  await run('DELETE FROM muster_records WHERE staff_id = 46 AND date = ?', [date]);

  console.log(`Successfully synced all ${assignments.length} assignments from the physical register for ${date}!`);
  db.close();
}

syncOctober05();
