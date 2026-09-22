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

async function syncAll() {
  const anchorDate = '2026-09-01';
  const staff = await all('SELECT * FROM staff');
  const staffByName = {};
  const staffById = {};
  staff.forEach(s => {
    staffById[s.id] = s;
    staffByName[s.name] = s;
  });

  const allDatesData = [
    // =========================================================================
    // DATE: 08-09-2026 TUESDAY (Pages 2 & 3)
    // =========================================================================
    {
      date: '2026-09-08',
      label: '08.09.26 Tuesday (Pages 2 & 3)',
      overrides: [
        { staff_id: 43, overridden_link_number: 29, status: 'CHANGED_LINK', reason: 'Link #29 (17239/17240)', target_category_id: 2 },
        { staff_id: 113, overridden_link_number: 17, status: 'CHANGED_LINK', reason: 'Link #17 (17646/12796)', target_category_id: 2 },
        { staff_id: 82, overridden_link_number: 19, status: 'CHANGED_LINK', reason: 'Link #19 (12805/12806)', target_category_id: 2 },
        { staff_id: 61, overridden_link_number: 47, status: 'CHANGED_LINK', reason: 'Link #47 (12795/17645)', target_category_id: 2 },
        { staff_id: 47, overridden_link_number: 5, status: 'CHANGED_LINK', reason: 'Link #5 (17251/17254)', target_category_id: 2 },
        { staff_id: 59, overridden_link_number: 45, status: 'CHANGED_LINK', reason: 'Link #45 (17281/17282)', target_category_id: 2 },
        { staff_id: 88, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Ladies Link #1 (17261/17262)', target_category_id: 3 },
        { staff_id: 36, overridden_link_number: 43, status: 'CHANGED_LINK', reason: 'Link #43 (20629/20630 SL)', target_category_id: 2 },
        { staff_id: 11, overridden_link_number: 11, status: 'SUBSTITUTE', reason: 'COR Link #11 (17225/17226 AC)', target_category_id: 1 },
        { staff_id: 45, overridden_link_number: 11, status: 'CHANGED_LINK', reason: 'Link #11 (17225/17226 SL)', target_category_id: 2 },
        { staff_id: 39, overridden_link_number: 11, status: 'CHANGED_LINK', reason: 'Link #11 (17225/17226 SL-2)', target_category_id: 2 },
        { staff_id: 8, overridden_link_number: 57, status: 'SUBSTITUTE', reason: 'COR Link #57 (18047/17226 AC)', target_category_id: 1 },
        { staff_id: 71, overridden_link_number: 57, status: 'CHANGED_LINK', reason: 'Link #57 (18047/17226 SL)', target_category_id: 2 },
        { staff_id: 50, overridden_link_number: 36, status: 'CHANGED_LINK', reason: 'Link #36 (17626/17625 AC+SL)', target_category_id: 2 },
        { staff_id: 64, overridden_link_number: 50, status: 'CHANGED_LINK', reason: 'Link #50 (17626/17625 SL)', target_category_id: 2 },
        { staff_id: 5, overridden_link_number: 12, status: 'SUBSTITUTE', reason: 'COR Link #12 (12604/12603 AC)', target_category_id: 1 },
        { staff_id: 117, overridden_link_number: 3, status: 'CHANGED_LINK', reason: 'Link #3 (12604/12603 SL)', target_category_id: 2 },
        { staff_id: 114, overridden_link_number: 31, status: 'CHANGED_LINK', reason: 'Link #31 (12604/12603 SL)', target_category_id: 2 },
        { staff_id: 3, overridden_link_number: 10, status: 'CHANGED_LINK', reason: 'COR Link #10 (12734/20630 COR-II)', target_category_id: 1 },
        { staff_id: 15, overridden_link_number: 18, status: 'CHANGED_LINK', reason: 'COR Link #18 (12734/17262 COR)', target_category_id: 1 },
        { staff_id: 22, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'Link #8 (12734/17262 SL)', target_category_id: 2 },
        { staff_id: 12, overridden_link_number: 39, status: 'SUBSTITUTE', reason: 'Link #39 (17243/17244 AC+SL)', target_category_id: 2 },
        { staff_id: 53, overridden_link_number: 53, status: 'CHANGED_LINK', reason: 'Link #53 (17243/17244 SL)', target_category_id: 2 },
        // Non-Daily / Extra
        { staff_id: 112, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '17041/17042', shifted_place: 'Train 17041/17042 SL', reason: 'Amrit Bharat Exp 17041/17042 (GNT-RU-GNT)', target_category_id: 4 },
        { staff_id: 109, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '17077/17078', shifted_place: 'Train 17077/17078 AC+SL', reason: 'Special Train 17077/17078 (GNT-RU-GNT)', target_category_id: 4 },
        { staff_id: 105, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '07127/07128', shifted_place: 'Train 07127/07128 AC+SL', reason: 'Special Fare Exp 07127/07128 (GNT-RU-GNT)', target_category_id: 4 }
      ],
      lr: [
        { staff_id: 113, duty_code: '17646', remarks: 'Link #17' },
        { staff_id: 117, duty_code: '12604', remarks: 'Link #3 (SL)' },
        { staff_id: 114, duty_code: '12604', remarks: 'Link #31 (SL)' },
        { staff_id: 112, duty_code: '17041', remarks: 'Amrit Bharat 17041/17042' },
        { staff_id: 109, duty_code: '17077', remarks: 'Special 17077/17078' },
        { staff_id: 105, duty_code: '07127', remarks: 'Special 07127/07128' }
      ]
    },

    // =========================================================================
    // DATE: 09-09-2026 WEDNESDAY (Pages 4 & 5)
    // =========================================================================
    {
      date: '2026-09-09',
      label: '09.09.26 Wednesday (Pages 4 & 5)',
      overrides: [
        { staff_id: 28, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Link #1 (17253/17252)', target_category_id: 2 },
        { staff_id: 42, overridden_link_number: 29, status: 'CHANGED_LINK', reason: 'Link #29 (17239/17240)', target_category_id: 2 },
        { staff_id: 30, overridden_link_number: 17, status: 'CHANGED_LINK', reason: 'Link #17 (17646/12796)', target_category_id: 2 },
        { staff_id: 32, overridden_link_number: 19, status: 'CHANGED_LINK', reason: 'Link #19 (12805/12806)', target_category_id: 2 },
        { staff_id: 60, overridden_link_number: 47, status: 'CHANGED_LINK', reason: 'Link #47 (12795/17645)', target_category_id: 2 },
        { staff_id: 46, overridden_link_number: 5, status: 'CHANGED_LINK', reason: 'Link #5 (17251/17254)', target_category_id: 2 },
        { staff_id: 58, overridden_link_number: 45, status: 'CHANGED_LINK', reason: 'Link #45 (17281/17282)', target_category_id: 2 },
        { staff_id: 87, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Ladies Link #1 (17261/17262 SL-2)', target_category_id: 3 },
        { staff_id: 85, overridden_link_number: 43, status: 'CHANGED_LINK', reason: 'Link #43 (20629/20630 SL)', target_category_id: 3 },
        { staff_id: 56, overridden_link_number: 43, status: 'CHANGED_LINK', reason: 'Link #43 (20629/20630 SL-2)', target_category_id: 2 },
        { staff_id: 14, overridden_link_number: 11, status: 'SUBSTITUTE', reason: 'COR Link #11 (17225/17226 AC)', target_category_id: 1 },
        { staff_id: 24, overridden_link_number: 11, status: 'CHANGED_LINK', reason: 'Link #11 (17225/17226 SL)', target_category_id: 2 },
        { staff_id: 38, overridden_link_number: 11, status: 'CHANGED_LINK', reason: 'Link #11 (17225/17226 SL-2)', target_category_id: 2 },
        { staff_id: 7, overridden_link_number: 57, status: 'SUBSTITUTE', reason: 'COR Link #57 (18047/18048 AC)', target_category_id: 1 },
        { staff_id: 70, overridden_link_number: 57, status: 'CHANGED_LINK', reason: 'Link #57 (18047/18048 SL)', target_category_id: 2 },
        { staff_id: 73, overridden_link_number: 36, status: 'CHANGED_LINK', reason: 'Link #36 (17626/17625 AC+SL)', target_category_id: 2 },
        { staff_id: 103, overridden_link_number: 50, status: 'CHANGED_LINK', reason: 'Link #50 (17626/17625 SL)', target_category_id: 2 },
        { staff_id: 44, overridden_link_number: 12, status: 'SUBSTITUTE', reason: 'COR Link #12 (12604/12603 AC)', target_category_id: 1 },
        { staff_id: 79, overridden_link_number: 3, status: 'CHANGED_LINK', reason: 'Link #3 (12604/12603 SL)', target_category_id: 2 },
        { staff_id: 31, overridden_link_number: 31, status: 'CHANGED_LINK', reason: 'Link #31 (12604/12603 SL)', target_category_id: 2 },
        { staff_id: 2, overridden_link_number: 10, status: 'CHANGED_LINK', reason: 'COR Link #10 (12734/20630 COR-I)', target_category_id: 1 },
        { staff_id: 10, overridden_link_number: 18, status: 'CHANGED_LINK', reason: 'COR Link #18 (12734/17262 COR-II)', target_category_id: 1 },
        { staff_id: 84, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'Link #8 (12734/20630 SL)', target_category_id: 2 },
        { staff_id: 45, overridden_link_number: 39, status: 'CHANGED_LINK', reason: 'Link #39 (17243/17244 AC+SL)', target_category_id: 2 },
        { staff_id: 100, overridden_link_number: 53, status: 'CHANGED_LINK', reason: 'Link #53 (17243/17244 SL)', target_category_id: 2 },
        // Non-Daily / Extra
        { staff_id: 98, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '22882/22881', shifted_place: 'Train 22882/22881 AC+SL', reason: 'BBS-PUNE Exp 22882/22881 (GNT-WADI-GNT)', target_category_id: 4 },
        { staff_id: 107, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '17221/17222', shifted_place: 'Train 17221/17222 AC+SL', reason: 'COA-LPI Exp 17221/17222 (GNT-WADI-GNT)', target_category_id: 4 },
        { staff_id: 101, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '17069/17262', shifted_place: 'Train 17069/17262 AC+SL', reason: 'Train 17069/17262 (GNT-RU-TPTY-GNT)', target_category_id: 4 }
      ],
      lr: [
        { staff_id: 103, duty_code: '17626', remarks: 'Link #50 (SL)' },
        { staff_id: 100, duty_code: '17243', remarks: 'Link #53 (SL)' },
        { staff_id: 98, duty_code: '22882', remarks: 'Exp 22882/22881' },
        { staff_id: 107, duty_code: '17221', remarks: 'Exp 17221/17222' },
        { staff_id: 101, duty_code: '17069', remarks: 'Train 17069/17262' }
      ]
    },

    // =========================================================================
    // DATE: 16-09-2026 WEDNESDAY (Pages 18 & 19)
    // =========================================================================
    {
      date: '2026-09-16',
      label: '16.09.26 Wednesday (Pages 18 & 19)',
      overrides: [
        { staff_id: 70, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Link #1 (17253/17252)', target_category_id: 2 },
        { staff_id: 105, overridden_link_number: 29, status: 'CHANGED_LINK', reason: 'Link #29 (17239/17240)', target_category_id: 2 },
        { staff_id: 104, overridden_link_number: 17, status: 'CHANGED_LINK', reason: 'Link #17 (17646/12796)', target_category_id: 2 },
        { staff_id: 25, overridden_link_number: 19, status: 'CHANGED_LINK', reason: 'Link #19 (12805/12806)', target_category_id: 2 },
        { staff_id: 53, overridden_link_number: 47, status: 'CHANGED_LINK', reason: 'Link #47 (12795/17645)', target_category_id: 2 },
        { staff_id: 39, overridden_link_number: 5, status: 'CHANGED_LINK', reason: 'Link #5 (17251/17254)', target_category_id: 2 },
        { staff_id: 114, overridden_link_number: 45, status: 'CHANGED_LINK', reason: 'Link #45 (17281/17282)', target_category_id: 2 },
        { staff_id: 10, overridden_link_number: 4, status: 'CHANGED_LINK', reason: 'COR Link #4 (17261/12733 COR-1)', target_category_id: 1 },
        { staff_id: 91, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Ladies Link #1 (17261/17262 S1-S5)', target_category_id: 3 },
        { staff_id: 87, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Ladies Link #1 (17261/17262 S10-S14)', target_category_id: 3 },
        { staff_id: 14, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'COR Link #8 (20629/12733 COR-2)', target_category_id: 1 },
        { staff_id: 28, overridden_link_number: 43, status: 'CHANGED_LINK', reason: 'Link #43 (20629/20630 SL)', target_category_id: 2 },
        { staff_id: 7, overridden_link_number: 11, status: 'SUBSTITUTE', reason: 'COR Link #11 (17225/17226 AC)', target_category_id: 1 },
        { staff_id: 80, overridden_link_number: 11, status: 'CHANGED_LINK', reason: 'Link #11 (17225/17226 SL)', target_category_id: 2 },
        { staff_id: 21, overridden_link_number: 57, status: 'SUBSTITUTE', reason: 'COR Link #57 (18047/18048 AC)', target_category_id: 1 },
        { staff_id: 106, overridden_link_number: 57, status: 'CHANGED_LINK', reason: 'Link #57 (18047/18048 SL)', target_category_id: 2 },
        { staff_id: 56, overridden_link_number: 36, status: 'CHANGED_LINK', reason: 'Link #36 (17626/17625 AC+SL)', target_category_id: 2 },
        { staff_id: 42, overridden_link_number: 50, status: 'CHANGED_LINK', reason: 'Link #50 (17626/17625 SL)', target_category_id: 2 },
        { staff_id: 18, overridden_link_number: 12, status: 'SUBSTITUTE', reason: 'COR Link #12 (12604/12603 AC)', target_category_id: 1 },
        { staff_id: 72, overridden_link_number: 3, status: 'CHANGED_LINK', reason: 'Link #3 (12604/12603 SL)', target_category_id: 2 },
        { staff_id: 37, overridden_link_number: 31, status: 'CHANGED_LINK', reason: 'Link #31 (12604/12603 SL)', target_category_id: 2 },
        { staff_id: 16, overridden_link_number: 10, status: 'CHANGED_LINK', reason: 'COR Link #10 (12734/20630 AC)', target_category_id: 1 },
        { staff_id: 3, overridden_link_number: 18, status: 'CHANGED_LINK', reason: 'COR Link #18 (12734/17262 AC)', target_category_id: 1 },
        { staff_id: 77, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'Link #8 (12734/20630 SL)', target_category_id: 2 },
        { staff_id: 59, overridden_link_number: 39, status: 'CHANGED_LINK', reason: 'Link #39 (17243/17244 AC+SL)', target_category_id: 2 },
        { staff_id: 45, overridden_link_number: 53, status: 'CHANGED_LINK', reason: 'Link #53 (17243/17244 SL)', target_category_id: 2 },
        // Non-Daily / Extra
        { staff_id: 117, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '22882/22881', shifted_place: 'Train 22882/22881 AC+SL', reason: 'BBS-PUNE Exp 22882/22881', target_category_id: 4 },
        { staff_id: 109, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '17221/17222', shifted_place: 'Train 17221/17222 AC+SL', reason: 'COA-LPI Exp 17221/17222', target_category_id: 4 },
        { staff_id: 98, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '17069/17262', shifted_place: 'Train 17069/17262 AC+SL', reason: 'Train 17069/17262', target_category_id: 4 }
      ],
      lr: [
        { staff_id: 105, duty_code: '17239', remarks: 'Link #29' },
        { staff_id: 104, duty_code: '17646', remarks: 'Link #17' },
        { staff_id: 114, duty_code: '17281', remarks: 'Link #45' },
        { staff_id: 106, duty_code: '18047', remarks: 'Link #57 (SL)' },
        { staff_id: 117, duty_code: '22882', remarks: 'Exp 22882/22881' },
        { staff_id: 109, duty_code: '17221', remarks: 'Exp 17221/17222' },
        { staff_id: 98, duty_code: '17069', remarks: 'Train 17069/17262' }
      ]
    },

    // =========================================================================
    // DATE: 17-09-2026 THURSDAY (Pages 20 & 21)
    // =========================================================================
    {
      date: '2026-09-17',
      label: '17.09.26 Thursday (Pages 20 & 21)',
      overrides: [
        { staff_id: 83, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Link #1 (17253/17252)', target_category_id: 2 },
        { staff_id: 107, overridden_link_number: 29, status: 'CHANGED_LINK', reason: 'Link #29 (17239/17240)', target_category_id: 2 },
        { staff_id: 22, overridden_link_number: 17, status: 'CHANGED_LINK', reason: 'Link #17 (17646/12796)', target_category_id: 2 },
        { staff_id: 24, overridden_link_number: 19, status: 'CHANGED_LINK', reason: 'Link #19 (12805/12806)', target_category_id: 2 },
        { staff_id: 31, overridden_link_number: 47, status: 'CHANGED_LINK', reason: 'Link #47 (12795/17645)', target_category_id: 2 },
        { staff_id: 73, overridden_link_number: 5, status: 'CHANGED_LINK', reason: 'Link #5 (17251/17254)', target_category_id: 2 },
        { staff_id: 103, overridden_link_number: 45, status: 'CHANGED_LINK', reason: 'Link #45 (17281/17282)', target_category_id: 2 },
        { staff_id: 9, overridden_link_number: 4, status: 'CHANGED_LINK', reason: 'COR Link #4 (17261/12733 COR-1)', target_category_id: 1 },
        { staff_id: 90, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Ladies Link #1 (17261/17262 SL)', target_category_id: 3 },
        { staff_id: 13, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'COR Link #8 (20629/12733 COR-2)', target_category_id: 1 },
        { staff_id: 86, overridden_link_number: 43, status: 'CHANGED_LINK', reason: 'Link #43 (20629/20630 SL)', target_category_id: 3 },
        { staff_id: 6, overridden_link_number: 11, status: 'SUBSTITUTE', reason: 'COR Link #11 (17225/17226 AC)', target_category_id: 1 },
        { staff_id: 79, overridden_link_number: 11, status: 'CHANGED_LINK', reason: 'Link #11 (17225/17226 SL)', target_category_id: 2 },
        { staff_id: 30, overridden_link_number: 57, status: 'CHANGED_LINK', reason: 'Link #57 (17225/18048 SL-1)', target_category_id: 2 },
        { staff_id: 62, overridden_link_number: 57, status: 'CHANGED_LINK', reason: 'Link #57 (17225/18048 SL-2)', target_category_id: 2 },
        { staff_id: 55, overridden_link_number: 36, status: 'CHANGED_LINK', reason: 'Link #36 (17626/17625 AC+SL)', target_category_id: 2 },
        { staff_id: 41, overridden_link_number: 50, status: 'CHANGED_LINK', reason: 'Link #50 (17626/17625 SL)', target_category_id: 2 },
        { staff_id: 71, overridden_link_number: 12, status: 'SUBSTITUTE', reason: 'COR Link #12 (12604/12603 AC)', target_category_id: 1 },
        { staff_id: 113, overridden_link_number: 3, status: 'CHANGED_LINK', reason: 'Link #3 (12604/12603 SL)', target_category_id: 2 },
        { staff_id: 36, overridden_link_number: 31, status: 'CHANGED_LINK', reason: 'Link #31 (12604/12603 SL)', target_category_id: 2 },
        { staff_id: 15, overridden_link_number: 10, status: 'CHANGED_LINK', reason: 'COR Link #10 (12734/20630 COR-2)', target_category_id: 1 },
        { staff_id: 2, overridden_link_number: 18, status: 'CHANGED_LINK', reason: 'COR Link #18 (12734/17262 COR-1)', target_category_id: 1 },
        { staff_id: 76, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'Link #8 (12734/20630 SL)', target_category_id: 2 },
        { staff_id: 58, overridden_link_number: 39, status: 'CHANGED_LINK', reason: 'Link #39 (17243/17244 AC+SL)', target_category_id: 2 },
        { staff_id: 44, overridden_link_number: 53, status: 'CHANGED_LINK', reason: 'Link #53 (17243/17244 SL)', target_category_id: 2 },
        // Non-Daily / Extra
        { staff_id: 102, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '12755/PILOT', shifted_place: 'Train 12755 AC+SL / PILOT', reason: 'Non-Daily Train 12755', target_category_id: 4 },
        { staff_id: 100, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '12604/16357', shifted_place: 'Train 12604/16357 SL', reason: 'Non-Daily Train 12604/16357', target_category_id: 4 },
        { staff_id: 101, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '07001/17030', shifted_place: 'Train 07001/17030 AC+SL', reason: 'Special Train 07001/17030', target_category_id: 4 },
        { staff_id: 108, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '07001/07002', shifted_place: 'Train 07001/07002 AC+SL', reason: 'Special Train 07001/07002', target_category_id: 4 }
      ],
      lr: [
        { staff_id: 107, duty_code: '17239', remarks: 'Link #29' },
        { staff_id: 103, duty_code: '17281', remarks: 'Link #45' },
        { staff_id: 113, duty_code: '12604', remarks: 'Link #3 (SL)' },
        { staff_id: 102, duty_code: '12755', remarks: 'Train 12755' },
        { staff_id: 100, duty_code: '12604', remarks: 'Train 12604/16357' },
        { staff_id: 101, duty_code: '07001', remarks: 'Special 07001/17030' },
        { staff_id: 108, duty_code: '07001', remarks: 'Special 07001/07002' }
      ]
    },

    // =========================================================================
    // DATE: 18-09-2026 FRIDAY (Pages 22 & 23)
    // =========================================================================
    {
      date: '2026-09-18',
      label: '18.09.26 Friday (Pages 22 & 23)',
      overrides: [
        { staff_id: 68, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Link #1 (17253/17252)', target_category_id: 2 },
        { staff_id: 116, overridden_link_number: 29, status: 'CHANGED_LINK', reason: 'Link #29 (17239/17240)', target_category_id: 2 },
        { staff_id: 23, overridden_link_number: 17, status: 'CHANGED_LINK', reason: 'Link #17 (17646/12796)', target_category_id: 2 },
        { staff_id: 82, overridden_link_number: 19, status: 'CHANGED_LINK', reason: 'Link #19 (12805/12806)', target_category_id: 2 },
        { staff_id: 51, overridden_link_number: 47, status: 'CHANGED_LINK', reason: 'Link #47 (12795/17645)', target_category_id: 2 },
        { staff_id: 37, overridden_link_number: 5, status: 'CHANGED_LINK', reason: 'Link #5 (17251/17254)', target_category_id: 2 },
        { staff_id: 106, overridden_link_number: 45, status: 'CHANGED_LINK', reason: 'Link #45 (17281/17282)', target_category_id: 2 },
        { staff_id: 8, overridden_link_number: 4, status: 'CHANGED_LINK', reason: 'COR Link #4 (17261/12733 COR-2)', target_category_id: 1 },
        { staff_id: 85, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Ladies Link #1 (17261/17262 S1-S5)', target_category_id: 3 },
        { staff_id: 89, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Ladies Link #1 (17261/17262 S10-S14)', target_category_id: 3 },
        { staff_id: 12, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'COR Link #8 (20629/12733 COR-1)', target_category_id: 1 },
        { staff_id: 47, overridden_link_number: 43, status: 'CHANGED_LINK', reason: 'Link #43 (20629/20630 SL-1)', target_category_id: 2 },
        { staff_id: 26, overridden_link_number: 43, status: 'CHANGED_LINK', reason: 'Link #43 (20629/20630 SL-2)', target_category_id: 2 },
        { staff_id: 5, overridden_link_number: 11, status: 'SUBSTITUTE', reason: 'COR Link #11 (17225/17226 AC)', target_category_id: 1 },
        { staff_id: 78, overridden_link_number: 11, status: 'CHANGED_LINK', reason: 'Link #11 (17225/17226 SL)', target_category_id: 2 },
        { staff_id: 19, overridden_link_number: 57, status: 'SUBSTITUTE', reason: 'COR Link #57 (18047/17226 AC)', target_category_id: 1 },
        { staff_id: 61, overridden_link_number: 57, status: 'CHANGED_LINK', reason: 'Link #57 (18047/17226 SL)', target_category_id: 2 },
        { staff_id: 64, overridden_link_number: 36, status: 'CHANGED_LINK', reason: 'Link #36 (17626/17625 AC+SL)', target_category_id: 2 },
        { staff_id: 54, overridden_link_number: 50, status: 'CHANGED_LINK', reason: 'Link #50 (17626/17625 SL)', target_category_id: 2 },
        { staff_id: 20, overridden_link_number: 12, status: 'SUBSTITUTE', reason: 'COR Link #12 (12604/12603 AC)', target_category_id: 1 },
        { staff_id: 70, overridden_link_number: 3, status: 'CHANGED_LINK', reason: 'Link #3 (12604/12603 SL)', target_category_id: 2 },
        { staff_id: 98, overridden_link_number: 31, status: 'CHANGED_LINK', reason: 'Link #31 (12604/12603 SL)', target_category_id: 2 },
        { staff_id: 14, overridden_link_number: 10, status: 'CHANGED_LINK', reason: 'COR Link #10 (12734/20630 AC)', target_category_id: 1 },
        { staff_id: 1, overridden_link_number: 18, status: 'CHANGED_LINK', reason: 'COR Link #18 (12734/17262 COR-1)', target_category_id: 1 },
        { staff_id: 75, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'Link #8 (12734/20630 SL)', target_category_id: 2 },
        { staff_id: 43, overridden_link_number: 39, status: 'CHANGED_LINK', reason: 'Link #39 (17243/17244 AC+SL)', target_category_id: 2 },
        { staff_id: 104, overridden_link_number: 53, status: 'CHANGED_LINK', reason: 'Link #53 (17243/17244 SL)', target_category_id: 2 },
        // Non-Daily / Extra
        { staff_id: 105, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '17231/17232', shifted_place: 'Train 17231/17232 AC+SL', reason: 'Non-Daily Train 17231/17232', target_category_id: 4 },
        { staff_id: 114, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '18043/18044', shifted_place: 'Train 18043/18044 AC', reason: 'Non-Daily Train 18043/18044', target_category_id: 4 },
        { staff_id: 40, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '17607/17608', shifted_place: 'Train 17607/17608 AC+SL', reason: 'Non-Daily Train 17607/17608', target_category_id: 2 }
      ],
      lr: [
        { staff_id: 116, duty_code: '17239', remarks: 'Link #29' },
        { staff_id: 106, duty_code: '17281', remarks: 'Link #45' },
        { staff_id: 98, duty_code: '12604', remarks: 'Link #31 (SL)' },
        { staff_id: 104, duty_code: '17243', remarks: 'Link #53 (SL)' },
        { staff_id: 105, duty_code: '17231', remarks: 'Train 17231/17232' },
        { staff_id: 114, duty_code: '18043', remarks: 'Train 18043/18044' }
      ]
    },

    // =========================================================================
    // DATE: 19-09-2026 SATURDAY (Pages 24 & 25)
    // =========================================================================
    {
      date: '2026-09-19',
      label: '19.09.26 Saturday (Pages 24 & 25)',
      overrides: [
        { staff_id: 46, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Link #1 (17253/17252)', target_category_id: 2 },
        { staff_id: 32, overridden_link_number: 29, status: 'CHANGED_LINK', reason: 'Link #29 (17239/17240)', target_category_id: 2 },
        { staff_id: 83, overridden_link_number: 17, status: 'CHANGED_LINK', reason: 'Link #17 (17646/12796)', target_category_id: 2 },
        { staff_id: 22, overridden_link_number: 19, status: 'CHANGED_LINK', reason: 'Link #19 (12805/12806)', target_category_id: 2 },
        { staff_id: 113, overridden_link_number: 47, status: 'CHANGED_LINK', reason: 'Link #47 (12795/17645)', target_category_id: 2 },
        { staff_id: 71, overridden_link_number: 5, status: 'CHANGED_LINK', reason: 'Link #5 (17251/17254)', target_category_id: 2 },
        { staff_id: 36, overridden_link_number: 45, status: 'CHANGED_LINK', reason: 'Link #45 (17281/17282)', target_category_id: 2 },
        { staff_id: 7, overridden_link_number: 4, status: 'CHANGED_LINK', reason: 'COR Link #4 (17261/12733 COR-1)', target_category_id: 1 },
        { staff_id: 118, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Ladies Link #1 (17261/17262 S1-S5)', target_category_id: 3 },
        { staff_id: 91, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Ladies Link #1 (17261/17262 S10-S14 / AC)', target_category_id: 3 },
        { staff_id: 11, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'COR Link #8 (20629/12733 COR-2)', target_category_id: 1 },
        { staff_id: 111, overridden_link_number: 43, status: 'CHANGED_LINK', reason: 'Link #43 (20629/20630 SL-1)', target_category_id: 2 },
        { staff_id: 100, overridden_link_number: 43, status: 'CHANGED_LINK', reason: 'Link #43 (20629/20630 SL-2)', target_category_id: 2 },
        { staff_id: 4, overridden_link_number: 11, status: 'SUBSTITUTE', reason: 'COR Link #11 (17225/17226 AC)', target_category_id: 1 },
        { staff_id: 77, overridden_link_number: 11, status: 'CHANGED_LINK', reason: 'Link #11 (17225/17226 SL-1)', target_category_id: 2 },
        { staff_id: 28, overridden_link_number: 11, status: 'CHANGED_LINK', reason: 'Link #11 (17225/17226 SL-2)', target_category_id: 2 },
        { staff_id: 18, overridden_link_number: 57, status: 'SUBSTITUTE', reason: 'COR Link #57 (17225/18048 AC)', target_category_id: 1 },
        { staff_id: 107, overridden_link_number: 57, status: 'CHANGED_LINK', reason: 'Link #57 (17225/18048 SL)', target_category_id: 2 },
        { staff_id: 39, overridden_link_number: 36, status: 'CHANGED_LINK', reason: 'Link #36 (17626/17625 AC+SL)', target_category_id: 2 },
        { staff_id: 53, overridden_link_number: 50, status: 'CHANGED_LINK', reason: 'Link #50 (17626/17625 SL)', target_category_id: 2 },
        { staff_id: 15, overridden_link_number: 12, status: 'SUBSTITUTE', reason: 'COR Link #12 (12604/12603 AC)', target_category_id: 1 },
        { staff_id: 99, overridden_link_number: 3, status: 'CHANGED_LINK', reason: 'Link #3 (12604/12603 SL)', target_category_id: 2 },
        { staff_id: 34, overridden_link_number: 31, status: 'CHANGED_LINK', reason: 'Link #31 (12604/12603 SL)', target_category_id: 2 },
        { staff_id: 21, overridden_link_number: 10, status: 'CHANGED_LINK', reason: 'COR Link #10 (12734/20630 COR-1)', target_category_id: 1 },
        { staff_id: 103, overridden_link_number: 18, status: 'CHANGED_LINK', reason: 'COR Link #18 (12734/17262 COR-2)', target_category_id: 1 },
        { staff_id: 102, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'Link #8 (12734/20630 SL)', target_category_id: 2 },
        { staff_id: 56, overridden_link_number: 39, status: 'CHANGED_LINK', reason: 'Link #39 (17243/17244 AC+SL)', target_category_id: 2 },
        { staff_id: 42, overridden_link_number: 53, status: 'CHANGED_LINK', reason: 'Link #53 (17243/17244 SL)', target_category_id: 2 },
        // Non-Daily / Extra
        { staff_id: 101, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: 'PILOT/12756', shifted_place: 'PILOT / Train 12756 AC+SL', reason: 'Non-Daily Train 12756', target_category_id: 4 },
        { staff_id: 60, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '17221/17222', shifted_place: 'Train 17221/17222 AC+SL', reason: 'Non-Daily Train 17221/17222', target_category_id: 2 },
        { staff_id: 109, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '16358/12603', shifted_place: 'Train 16358/12603 SL', reason: 'Non-Daily Train 16358/12603', target_category_id: 4 },
        { staff_id: 117, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '07193/07194', shifted_place: 'Special Train 07193/07194 AC+SL', reason: 'Special Train 07193/07194', target_category_id: 4 }
      ],
      lr: [
        { staff_id: 113, duty_code: '12795', remarks: 'Link #47' },
        { staff_id: 118, duty_code: '17261', remarks: 'Link #1 (Ladies)' },
        { staff_id: 111, duty_code: '20629', remarks: 'Link #43 (SL)' },
        { staff_id: 100, duty_code: '20629', remarks: 'Link #43 (SL)' },
        { staff_id: 107, duty_code: '17225', remarks: 'Link #57 (SL)' },
        { staff_id: 99, duty_code: '12604', remarks: 'Link #3 (SL)' },
        { staff_id: 103, duty_code: '12734', remarks: 'COR Link #18' },
        { staff_id: 102, duty_code: '12734', remarks: 'Link #8 (SL)' },
        { staff_id: 101, duty_code: '12756', remarks: 'Train 12756' },
        { staff_id: 109, duty_code: '16358', remarks: 'Train 16358/12603' },
        { staff_id: 117, duty_code: '07193', remarks: 'Special 07193/07194' }
      ]
    },

    // =========================================================================
    // DATE: 21-09-2026 MONDAY (Pages 28 & 29)
    // =========================================================================
    {
      date: '2026-09-21',
      label: '21.09.26 Monday (Pages 28 & 29)',
      overrides: [
        { staff_id: 112, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Link #1 (17253/17252)', target_category_id: 2 },
        { staff_id: 113, overridden_link_number: 29, status: 'CHANGED_LINK', reason: 'Link #29 (17239/17240)', target_category_id: 2 },
        { staff_id: 114, overridden_link_number: 17, status: 'CHANGED_LINK', reason: 'Link #17 (17646/12796)', target_category_id: 2 },
        { staff_id: 61, overridden_link_number: 19, status: 'CHANGED_LINK', reason: 'Link #19 (12805/12806)', target_category_id: 2 },
        { staff_id: 34, overridden_link_number: 47, status: 'CHANGED_LINK', reason: 'Link #47 (12795/17645)', target_category_id: 2 },
        { staff_id: 111, overridden_link_number: 5, status: 'CHANGED_LINK', reason: 'Link #5 (17251/17254)', target_category_id: 2 },
        { staff_id: 46, overridden_link_number: 45, status: 'CHANGED_LINK', reason: 'Link #45 (17281/17282)', target_category_id: 2 },
        { staff_id: 5, overridden_link_number: 4, status: 'CHANGED_LINK', reason: 'COR Link #4 (17261/12733 COR-2)', target_category_id: 1 },
        { staff_id: 86, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Ladies Link #1 (17261/17262 S1-S5)', target_category_id: 3 },
        { staff_id: 89, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Ladies Link #1 (17261/17262 S10-S14)', target_category_id: 3 },
        { staff_id: 9, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'COR Link #8 (20629/12733 COR-1)', target_category_id: 1 },
        { staff_id: 44, overridden_link_number: 43, status: 'CHANGED_LINK', reason: 'Link #43 (20629/20630 SL-1)', target_category_id: 2 },
        { staff_id: 23, overridden_link_number: 43, status: 'CHANGED_LINK', reason: 'Link #43 (20629/20630 SL-2)', target_category_id: 2 },
        { staff_id: 2, overridden_link_number: 11, status: 'SUBSTITUTE', reason: 'COR Link #11 (17225/17226 AC)', target_category_id: 1 },
        { staff_id: 75, overridden_link_number: 11, status: 'CHANGED_LINK', reason: 'Link #11 (17225/17226 SL-1)', target_category_id: 2 },
        { staff_id: 26, overridden_link_number: 11, status: 'CHANGED_LINK', reason: 'Link #11 (17225/17226 SL-2)', target_category_id: 2 },
        { staff_id: 16, overridden_link_number: 57, status: 'SUBSTITUTE', reason: 'COR Link #57 (17225/18048 AC)', target_category_id: 1 },
        { staff_id: 58, overridden_link_number: 57, status: 'CHANGED_LINK', reason: 'Link #57 (17225/18048 SL)', target_category_id: 2 },
        { staff_id: 37, overridden_link_number: 36, status: 'CHANGED_LINK', reason: 'Link #36 (17626/17625 AC+SL)', target_category_id: 2 },
        { staff_id: 51, overridden_link_number: 50, status: 'CHANGED_LINK', reason: 'Link #50 (17626/17625 SL)', target_category_id: 2 },
        { staff_id: 6, overridden_link_number: 12, status: 'SUBSTITUTE', reason: 'COR Link #12 (12604/12603 AC)', target_category_id: 1 },
        { staff_id: 99, overridden_link_number: 3, status: 'CHANGED_LINK', reason: 'Link #3 (12604/12603 SL)', target_category_id: 2 },
        { staff_id: 32, overridden_link_number: 31, status: 'CHANGED_LINK', reason: 'Link #31 (12604/12603 SL)', target_category_id: 2 },
        { staff_id: 11, overridden_link_number: 10, status: 'CHANGED_LINK', reason: 'COR Link #10 (12734/20630 COR-2)', target_category_id: 1 },
        { staff_id: 19, overridden_link_number: 18, status: 'CHANGED_LINK', reason: 'COR Link #18 (12734/17262 COR-1)', target_category_id: 1 },
        { staff_id: 72, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'Link #8 (12734/20630 SL)', target_category_id: 2 },
        { staff_id: 54, overridden_link_number: 39, status: 'CHANGED_LINK', reason: 'Link #39 (17243/17244 AC+SL)', target_category_id: 2 },
        { staff_id: 40, overridden_link_number: 53, status: 'CHANGED_LINK', reason: 'Link #53 (17243/17244 SL)', target_category_id: 2 },
        // Non-Daily / Extra
        { staff_id: 101, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '17657/17658', shifted_place: 'Train 17657/17658 AC+SL', reason: 'Non-Daily Train 17657/17658', target_category_id: 4 }
      ],
      lr: [
        { staff_id: 112, duty_code: '17253', remarks: 'Link #1' },
        { staff_id: 113, duty_code: '17239', remarks: 'Link #29' },
        { staff_id: 114, duty_code: '17646', remarks: 'Link #17' },
        { staff_id: 111, duty_code: '17251', remarks: 'Link #5' },
        { staff_id: 99, duty_code: '12604', remarks: 'Link #3 (SL)' },
        { staff_id: 101, duty_code: '17657', remarks: 'Train 17657/17658' }
      ]
    }
  ];

  for (const day of allDatesData) {
    const d = day.date;
    console.log(`\n========================================\nPROCESSING DATE: ${d} (${day.label})\n========================================`);

    // Clean overrides for this date
    await run('DELETE FROM overrides WHERE date = ?', [d]);

    const offset = getDayOffset(anchorDate, d);

    for (const ov of day.overrides) {
      const s = staffById[ov.staff_id];
      let origLink = null;
      if (s && s.category_id && s.row_position) {
        const cycle = s.category_id === 1 ? 21 : (s.category_id === 2 ? 84 : 7);
        origLink = getBaseLinkNumber(s.row_position, offset, cycle);
      }

      await run(
        `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, status, is_extra, extra_train_no, shifted_place, reason, target_category_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ov.staff_id,
          d,
          origLink,
          ov.overridden_link_number || null,
          ov.status || 'CHANGED_LINK',
          ov.is_extra ? 1 : 0,
          ov.extra_train_no || null,
          ov.shifted_place || null,
          ov.reason || '',
          ov.target_category_id || (s ? s.category_id : null)
        ]
      );
    }

    if (day.lr) {
      for (const lr of day.lr) {
        await run(
          `INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(staff_id, date) DO UPDATE SET duty_code=?, remarks=?`,
          [lr.staff_id, d, lr.duty_code, lr.remarks, lr.duty_code, lr.remarks]
        );
      }
    }

    console.log(`✓ Synchronized ${day.label}`);
  }

  console.log('\n======================================================');
  console.log('ALL 7 DATES SYNCHRONIZED SUCCESSFULLY IN ROSTER DATABASE!');
  console.log('======================================================\n');
}

syncAll().then(() => {
  db.close();
}).catch(err => {
  console.error(err);
  db.close();
});
