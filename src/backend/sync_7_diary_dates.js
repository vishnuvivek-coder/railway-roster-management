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

const DATES_CONFIG = [
  // =========================================================================
  // DATE 1: 01.09.26 TUESDAY (Pages 170 & 171)
  // =========================================================================
  {
    date: '2026-09-01',
    label: '01.09.26 Tuesday (Pages 170 & 171)',
    overrides: [
      { staff_id: 22, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Link #1 (17253/17252 AC+SL)', target_category_id: 2 },
      { staff_id: 50, overridden_link_number: 29, status: 'CHANGED_LINK', reason: 'Link #29 (17239/17240 AC+2S)', target_category_id: 2 },
      { staff_id: 38, overridden_link_number: 17, status: 'CHANGED_LINK', reason: 'Link #17 (17646/12796 AC+SL)', target_category_id: 2 },
      { staff_id: 40, overridden_link_number: 19, status: 'CHANGED_LINK', reason: 'Link #19 (12805/12806 AC+2S)', target_category_id: 2 },
      { staff_id: 54, overridden_link_number: 47, status: 'CHANGED_LINK', reason: 'Link #47 (12795/17645 AC+2S)', target_category_id: 2 },
      { staff_id: 26, overridden_link_number: 5, status: 'CHANGED_LINK', reason: 'Link #5 (17251/17254 AC+SL)', target_category_id: 2 },
      { staff_id: 36, overridden_link_number: 45, status: 'CHANGED_LINK', reason: 'Link #45 (17281/17282 2S)', target_category_id: 2 },
      { staff_id: 4, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'COR Link #8 (17261/12733 COR-2)', target_category_id: 1 },
      { staff_id: 85, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Ladies Link #1 (17261/17262 SL)', target_category_id: 3 },
      { staff_id: 88, overridden_link_number: 4, status: 'CHANGED_LINK', reason: 'Ladies Link #4 (17261/17262 SL)', target_category_id: 3 },
      { staff_id: 8, overridden_link_number: 4, status: 'CHANGED_LINK', reason: 'COR Link #4 (20629/12733 COR-1)', target_category_id: 1 },
      { staff_id: 64, overridden_link_number: 43, status: 'CHANGED_LINK', reason: 'Link #43 (20629/20630 SL)', target_category_id: 2 },
      { staff_id: 43, overridden_link_number: 43, status: 'CHANGED_LINK', reason: 'Link #43 (20629/20630 SL-2)', target_category_id: 2 },
      { staff_id: 1, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'COR Link #1 (17225/17226 AC)', target_category_id: 1 },
      { staff_id: 32, overridden_link_number: 11, status: 'CHANGED_LINK', reason: 'Link #11 (17225/17226 SL)', target_category_id: 2 },
      { staff_id: 15, overridden_link_number: 57, status: 'SUBSTITUTE', reason: 'COR Link #57 (18047/17226 AC)', target_category_id: 1 },
      { staff_id: 46, overridden_link_number: 57, status: 'CHANGED_LINK', reason: 'Link #57 (18047/17226 SL)', target_category_id: 2 },
      { staff_id: 71, overridden_link_number: 36, status: 'CHANGED_LINK', reason: 'Link #36 (17626/17625 AC+SL)', target_category_id: 2 },
      { staff_id: 51, overridden_link_number: 50, status: 'CHANGED_LINK', reason: 'Link #50 (17626/17625 SL)', target_category_id: 2 },
      // Page 171
      { staff_id: 44, overridden_link_number: 12, status: 'SUBSTITUTE', reason: 'Upgraded to COR Link 12 (12604/12603 AC)', target_category_id: 1 },
      { staff_id: 24, overridden_link_number: 3, status: 'CHANGED_LINK', reason: 'Link #3 (12604/12603 SL)', target_category_id: 2 },
      { staff_id: 104, overridden_link_number: 31, status: 'CHANGED_LINK', reason: 'Link #31 (12604/12603 SL)', target_category_id: 2 },
      { staff_id: 9, overridden_link_number: 18, status: 'CHANGED_LINK', reason: 'COR Link #18 (12734/20630 COR-1)', target_category_id: 1 },
      { staff_id: 18, overridden_link_number: 10, status: 'CHANGED_LINK', reason: 'COR Link #10 (12734 COR-2 / 17262 AC)', target_category_id: 1 },
      { staff_id: 72, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'Link #8 (12734/20630 SL)', target_category_id: 2 },
      { staff_id: 60, overridden_link_number: 39, status: 'CHANGED_LINK', reason: 'Link #39 (17243/17244 AC+SL)', target_category_id: 2 },
      { staff_id: 109, overridden_link_number: 53, status: 'CHANGED_LINK', reason: 'Link #53 (17243/17244 SL)', target_category_id: 2 },
      // Non-Daily
      { staff_id: 113, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '17041/17042', shifted_place: 'Train 17041/17042 SL', reason: 'Amrit Bharat Exp 17041/17042 (GNT-RU-GNT)', target_category_id: 4 },
      { staff_id: 100, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '17077/17078', shifted_place: 'Train 17077/17078 AC+SL', reason: 'Special Train 17077/17078 (GNT-RU-GNT)', target_category_id: 4 }
    ],
    lr: [
      { staff_id: 104, duty_code: '12604', remarks: 'Link #31 (SL)' },
      { staff_id: 109, duty_code: '17243', remarks: 'Link #53 (SL)' },
      { staff_id: 113, duty_code: '17041', remarks: 'Amrit Bharat 17041/17042' },
      { staff_id: 100, duty_code: '17077', remarks: 'Special 17077/17078' }
    ]
  },

  // =========================================================================
  // DATE 2: 02.09.26 WEDNESDAY (Pages 172 & 173)
  // =========================================================================
  {
    date: '2026-09-02',
    label: '02.09.26 Wednesday (Pages 172 & 173)',
    overrides: [
      { staff_id: 84, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Link #1 (17253/17252 AC+SL)', target_category_id: 2 },
      { staff_id: 79, overridden_link_number: 29, status: 'CHANGED_LINK', reason: 'Link #29 (17239/17240 AC+2S)', target_category_id: 2 },
      { staff_id: 37, overridden_link_number: 17, status: 'CHANGED_LINK', reason: 'Link #17 (17646/12796 AC+SL)', target_category_id: 2 },
      { staff_id: 39, overridden_link_number: 19, status: 'CHANGED_LINK', reason: 'Link #19 (12805/12806 AC+2S)', target_category_id: 2 },
      { staff_id: 99, overridden_link_number: 47, status: 'CHANGED_LINK', reason: 'Link #47 (12795/17645 AC+2S)', target_category_id: 2 },
      { staff_id: 25, overridden_link_number: 5, status: 'CHANGED_LINK', reason: 'Link #5 (17251/17254 AC+SL)', target_category_id: 2 },
      { staff_id: 101, overridden_link_number: 45, status: 'CHANGED_LINK', reason: 'Link #45 (17281/17282 2S)', target_category_id: 2 },
      { staff_id: 3, overridden_link_number: 4, status: 'CHANGED_LINK', reason: 'COR Link #4 (17261/12733 COR-1)', target_category_id: 1 },
      { staff_id: 91, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Ladies Link #1 (17261/17262 SL)', target_category_id: 3 },
      { staff_id: 87, overridden_link_number: 4, status: 'CHANGED_LINK', reason: 'Ladies Link #4 (17261/17262 SL)', target_category_id: 3 },
      { staff_id: 7, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'COR Link #8 (20629/12733 COR-2)', target_category_id: 1 },
      { staff_id: 42, overridden_link_number: 43, status: 'CHANGED_LINK', reason: 'Link #43 (20629/20630 SL)', target_category_id: 2 },
      { staff_id: 21, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'COR Link #1 (17225/17226 AC)', target_category_id: 1 },
      { staff_id: 31, overridden_link_number: 11, status: 'CHANGED_LINK', reason: 'Link #11 (17225/17226 SL)', target_category_id: 2 },
      { staff_id: 14, overridden_link_number: 57, status: 'SUBSTITUTE', reason: 'COR Link #57 (18047/18048 AC)', target_category_id: 1 },
      { staff_id: 45, overridden_link_number: 57, status: 'CHANGED_LINK', reason: 'Link #57 (18047/18048 SL)', target_category_id: 2 },
      { staff_id: 77, overridden_link_number: 36, status: 'CHANGED_LINK', reason: 'Link #36 (17626/17625 AC+SL)', target_category_id: 2 },
      { staff_id: 70, overridden_link_number: 50, status: 'CHANGED_LINK', reason: 'Link #50 (17626/17625 SL)', target_category_id: 2 },
      // Page 173
      { staff_id: 11, overridden_link_number: 12, status: 'CHANGED_LINK', reason: 'COR Link #12 (12604/12603 AC)', target_category_id: 1 },
      { staff_id: 23, overridden_link_number: 3, status: 'CHANGED_LINK', reason: 'Link #3 (12604/12603 SL)', target_category_id: 2 },
      { staff_id: 103, overridden_link_number: 31, status: 'CHANGED_LINK', reason: 'Link #31 (12604/12603 SL)', target_category_id: 2 },
      { staff_id: 5, overridden_link_number: 18, status: 'CHANGED_LINK', reason: 'COR Link #18 (12734/20630 COR-1)', target_category_id: 1 },
      { staff_id: 17, overridden_link_number: 10, status: 'CHANGED_LINK', reason: 'COR Link #10 (12734 COR-2 / 17262 SL)', target_category_id: 1 },
      { staff_id: 118, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'Link #8 (12734/20630 SL)', target_category_id: 2 },
      { staff_id: 78, overridden_link_number: 39, status: 'CHANGED_LINK', reason: 'Link #39 (17243/17244 AC+SL)', target_category_id: 2 },
      { staff_id: 73, overridden_link_number: 53, status: 'CHANGED_LINK', reason: 'Link #53 (17243/17244 SL)', target_category_id: 2 },
      // Non-Daily
      { staff_id: 80, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '22882/22881', shifted_place: 'Train 22882/22881 AC+SL', reason: '3-Day Non-Daily Link 22882/22881 (GNT-WADI-GNT)', target_category_id: 2 },
      { staff_id: 98, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '17221/17222', shifted_place: 'Train 17221/17222 AC+SL', reason: 'Non-Daily Train 17221/17222 (GNT-LPI-GNT)', target_category_id: 4 },
      { staff_id: 107, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '17069/17262', shifted_place: 'Train 17069/17262 AC+SL', reason: 'Non-Daily Train 17069/17262 (GNT-KCG-GNT)', target_category_id: 4 },
      { staff_id: 47, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: 'Pilot/07218', shifted_place: 'Pilot / Train 07218 AC+SL', reason: 'Special Train Pilot/07218', target_category_id: 2 }
    ],
    lr: [
      { staff_id: 99, duty_code: '12795', remarks: 'Link #47' },
      { staff_id: 101, duty_code: '17281', remarks: 'Link #45' },
      { staff_id: 103, duty_code: '12604', remarks: 'Link #31' },
      { staff_id: 118, duty_code: '12734', remarks: 'Link #8' },
      { staff_id: 98, duty_code: '17221', remarks: 'Non-Daily 17221' },
      { staff_id: 107, duty_code: '17069', remarks: 'Non-Daily 17069' }
    ]
  },

  // =========================================================================
  // DATE 3: 03.09.26 THURSDAY (Pages 174 & 175)
  // =========================================================================
  {
    date: '2026-09-03',
    label: '03.09.26 Thursday (Pages 174 & 175)',
    overrides: [
      { staff_id: 75, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Link #1 (17253/17252 AC+SL)', target_category_id: 2 },
      { staff_id: 106, overridden_link_number: 29, status: 'CHANGED_LINK', reason: 'Link #29 (17239/17240 AC+2S)', target_category_id: 2 },
      { staff_id: 36, overridden_link_number: 17, status: 'CHANGED_LINK', reason: 'Link #17 (17646/12796 AC+SL)', target_category_id: 2 },
      { staff_id: 58, overridden_link_number: 19, status: 'CHANGED_LINK', reason: 'Link #19 (12805/12806 AC+2S)', target_category_id: 2 },
      { staff_id: 112, overridden_link_number: 47, status: 'CHANGED_LINK', reason: 'Link #47 (12795/17645 AC+2S)', target_category_id: 2 },
      { staff_id: 24, overridden_link_number: 5, status: 'CHANGED_LINK', reason: 'Link #5 (17251/17254 AC+SL)', target_category_id: 2 },
      { staff_id: 114, overridden_link_number: 45, status: 'CHANGED_LINK', reason: 'Link #45 (17281/17282 2S)', target_category_id: 2 },
      { staff_id: 2, overridden_link_number: 4, status: 'CHANGED_LINK', reason: 'COR Link #4 (17261/12733 COR-1)', target_category_id: 1 },
      { staff_id: 90, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Ladies Link #1 (17261/17262 SL)', target_category_id: 3 },
      { staff_id: 41, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'COR Link #8 (20629/12733 COR-2)', target_category_id: 1 },
      { staff_id: 109, overridden_link_number: 43, status: 'CHANGED_LINK', reason: 'Link #43 (20629/20630 SL)', target_category_id: 2 },
      { staff_id: 20, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'COR Link #1 (17225/17226 AC)', target_category_id: 1 },
      { staff_id: 30, overridden_link_number: 11, status: 'CHANGED_LINK', reason: 'Link #11 (17225/17226 SL)', target_category_id: 2 },
      { staff_id: 13, overridden_link_number: 57, status: 'SUBSTITUTE', reason: 'COR Link #57 (17225/18048 AC)', target_category_id: 1 },
      { staff_id: 76, overridden_link_number: 57, status: 'CHANGED_LINK', reason: 'Link #57 (17225/18048 SL)', target_category_id: 2 },
      { staff_id: 55, overridden_link_number: 36, status: 'CHANGED_LINK', reason: 'Link #36 (17626/17625 AC+SL)', target_category_id: 2 },
      { staff_id: 64, overridden_link_number: 50, status: 'CHANGED_LINK', reason: 'Link #50 (17626/17625 SL)', target_category_id: 2 },
      // Page 175
      { staff_id: 10, overridden_link_number: 12, status: 'CHANGED_LINK', reason: 'COR Link #12 (12604/12603 AC)', target_category_id: 1 },
      { staff_id: 22, overridden_link_number: 3, status: 'CHANGED_LINK', reason: 'Link #3 (12604/12603 SL)', target_category_id: 2 },
      { staff_id: 50, overridden_link_number: 31, status: 'CHANGED_LINK', reason: 'Link #31 (12604/12603 SL)', target_category_id: 2 },
      { staff_id: 86, overridden_link_number: 18, status: 'SUBSTITUTE', reason: 'COR Link #18 (12734/20630 COR-1)', target_category_id: 1 },
      { staff_id: 16, overridden_link_number: 10, status: 'CHANGED_LINK', reason: 'COR Link #10 (12734 COR-2 / 17262 AC)', target_category_id: 1 },
      { staff_id: 79, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'Link #8 (12734/20630 SL)', target_category_id: 2 },
      { staff_id: 44, overridden_link_number: 39, status: 'CHANGED_LINK', reason: 'Link #39 (17243/17244 AC+SL)', target_category_id: 2 },
      { staff_id: 84, overridden_link_number: 53, status: 'CHANGED_LINK', reason: 'Link #53 (17243/17244 SL)', target_category_id: 2 },
      // Non-Daily
      { staff_id: 105, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '12755/17625', shifted_place: 'Train 12755 AC+SL / 17625 SL', reason: 'Non-Daily Train 12755/17625 (GNT-COA-GNT)', target_category_id: 4 },
      { staff_id: 101, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '12704/16357', shifted_place: 'Train 12704 SL / 16357 SL', reason: 'Non-Daily Train 12704/16357', target_category_id: 4 },
      { staff_id: 102, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '07001/17070', shifted_place: 'Train 07001/17070 AC+SL', reason: 'Special Train 07001/17070', target_category_id: 4 },
      { staff_id: 116, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '07001/07002', shifted_place: 'Train 07001 SL / 07002 AC+SL', reason: 'Special Train 07001/07002', target_category_id: 4 }
    ],
    lr: [
      { staff_id: 106, duty_code: '17239', remarks: 'Link #29' },
      { staff_id: 112, duty_code: '12795', remarks: 'Link #47' },
      { staff_id: 114, duty_code: '17281', remarks: 'Link #45' },
      { staff_id: 109, duty_code: '20629', remarks: 'Link #43' },
      { staff_id: 105, duty_code: '12755', remarks: 'Non-Daily 12755/17625' },
      { staff_id: 101, duty_code: '12704', remarks: 'Non-Daily 12704/16357' },
      { staff_id: 102, duty_code: '07001', remarks: 'Special 07001/17070' },
      { staff_id: 116, duty_code: '07001', remarks: 'Special 07001/07002' }
    ]
  },

  // =========================================================================
  // DATE 4: 04.09.26 FRIDAY (Pages 176 & 177)
  // =========================================================================
  {
    date: '2026-09-04',
    label: '04.09.26 Friday (Pages 176 & 177)',
    overrides: [
      { staff_id: 82, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Link #1 (17253/17252 AC+SL)', target_category_id: 2 },
      { staff_id: 47, overridden_link_number: 29, status: 'CHANGED_LINK', reason: 'Link #29 (17239/17240 AC+2S)', target_category_id: 2 },
      { staff_id: 51, overridden_link_number: 17, status: 'CHANGED_LINK', reason: 'Link #17 (17646/12796 AC+SL)', target_category_id: 2 },
      { staff_id: 100, overridden_link_number: 19, status: 'CHANGED_LINK', reason: 'Link #19 (12805/12806 AC+2S)', target_category_id: 2 },
      { staff_id: 107, overridden_link_number: 47, status: 'CHANGED_LINK', reason: 'Link #47 (12795/17645 AC+2S)', target_category_id: 2 },
      { staff_id: 23, overridden_link_number: 5, status: 'CHANGED_LINK', reason: 'Link #5 (17251/17254 AC+SL)', target_category_id: 2 },
      { staff_id: 37, overridden_link_number: 45, status: 'CHANGED_LINK', reason: 'Link #45 (17281/17282 2S)', target_category_id: 2 },
      { staff_id: 85, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'COR Link #8 (17261/12733 COR-2)', target_category_id: 1 },
      { staff_id: 118, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Ladies Link #1 (17261/17262 SL)', target_category_id: 3 },
      { staff_id: 7, overridden_link_number: 4, status: 'CHANGED_LINK', reason: 'COR Link #4 (20629/12733 COR-1)', target_category_id: 1 },
      { staff_id: 61, overridden_link_number: 43, status: 'CHANGED_LINK', reason: 'Link #43 (20629/20630 SL)', target_category_id: 2 },
      { staff_id: 19, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'COR Link #1 (17225/17226 AC)', target_category_id: 1 },
      { staff_id: 43, overridden_link_number: 11, status: 'CHANGED_LINK', reason: 'Link #11 (17225/17226 SL)', target_category_id: 2 },
      { staff_id: 75, overridden_link_number: 57, status: 'CHANGED_LINK', reason: 'Link #57 (18047/17226 SL)', target_category_id: 2 },
      { staff_id: 98, overridden_link_number: 57, status: 'SUBSTITUTE', reason: 'COR Link #57 (18047/17226 AC/SL)', target_category_id: 1 },
      { staff_id: 68, overridden_link_number: 36, status: 'CHANGED_LINK', reason: 'Link #36 (17626/17625 AC+SL)', target_category_id: 2 },
      { staff_id: 54, overridden_link_number: 50, status: 'CHANGED_LINK', reason: 'Link #50 (17626/17625 SL)', target_category_id: 2 },
      // Page 177
      { staff_id: 84, overridden_link_number: 12, status: 'SUBSTITUTE', reason: 'Upgraded to COR Link 12 (12604/12603 AC)', target_category_id: 1 },
      { staff_id: 103, overridden_link_number: 3, status: 'CHANGED_LINK', reason: 'Link #3 (12604/12603 SL)', target_category_id: 2 },
      { staff_id: 105, overridden_link_number: 31, status: 'CHANGED_LINK', reason: 'Link #31 (12604/12603 SL)', target_category_id: 2 },
      { staff_id: 9, overridden_link_number: 18, status: 'CHANGED_LINK', reason: 'COR Link #18 (12734/20630 COR-1)', target_category_id: 1 },
      { staff_id: 15, overridden_link_number: 10, status: 'CHANGED_LINK', reason: 'COR Link #10 (12734 COR-2 / 17262 AC)', target_category_id: 1 },
      { staff_id: 26, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'Link #8 (12734/20630 SL)', target_category_id: 2 },
      { staff_id: 71, overridden_link_number: 39, status: 'CHANGED_LINK', reason: 'Link #39 (17243/17244 AC+SL)', target_category_id: 2 },
      { staff_id: 53, overridden_link_number: 53, status: 'CHANGED_LINK', reason: 'Link #53 (17243/17244 SL)', target_category_id: 2 },
      // Non-Daily
      { staff_id: 99, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '17231/17232', shifted_place: 'Train 17231/17232 AC+SL', reason: 'Non-Daily Train 17231/17232 (GNT-NS-GNT)', target_category_id: 4 },
      { staff_id: 117, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '18063/18064', shifted_place: 'Train 18063/18064 AC', reason: 'Non-Daily Train 18063/18064 (GNT-BAM-GNT)', target_category_id: 4 },
      { staff_id: 4, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '17607/17608', shifted_place: 'Train 17607/17608 AC+SL', reason: 'Special Train 17607/17608', target_category_id: 1 },
      { staff_id: 113, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '07195/20630', shifted_place: 'Train 07195 AC+SL / 20630 SL', reason: 'Special Train 07195/20630', target_category_id: 4 },
      { staff_id: 78, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '07125/07126', shifted_place: 'Train 07125/07126 AC+SL', reason: 'Special Train 07125/07126', target_category_id: 2 },
      { staff_id: 106, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '07025/07026', shifted_place: 'Train 07025/07026 AC+SL', reason: 'Special Train 07025/07026', target_category_id: 4 }
    ],
    lr: [
      { staff_id: 100, duty_code: '12805', remarks: 'Link #19' },
      { staff_id: 107, duty_code: '12795', remarks: 'Link #47' },
      { staff_id: 118, duty_code: '17261', remarks: 'Ladies Link #1' },
      { staff_id: 98, duty_code: '18047', remarks: 'Link #57' },
      { staff_id: 103, duty_code: '12604', remarks: 'Link #3' },
      { staff_id: 105, duty_code: '12604', remarks: 'Link #31' },
      { staff_id: 99, duty_code: '17231', remarks: 'Non-Daily 17231/17232' },
      { staff_id: 117, duty_code: '18063', remarks: 'Non-Daily 18063/18064' },
      { staff_id: 113, duty_code: '07195', remarks: 'Non-Daily 07195/20630' },
      { staff_id: 106, duty_code: '07025', remarks: 'Special 07025/07026' }
    ]
  },

  // =========================================================================
  // DATE 5: 05.09.26 SATURDAY (Pages 178 & 179)
  // =========================================================================
  {
    date: '2026-09-05',
    label: '05.09.26 Saturday (Pages 178 & 179)',
    overrides: [
      { staff_id: 50, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Link #1 (17253/17252 AC+SL)', target_category_id: 2 },
      { staff_id: 46, overridden_link_number: 29, status: 'CHANGED_LINK', reason: 'Link #29 (17239/17240 AC+2S)', target_category_id: 2 },
      { staff_id: 101, overridden_link_number: 17, status: 'CHANGED_LINK', reason: 'Link #17 (17646/12796 AC+SL)', target_category_id: 2 },
      { staff_id: 36, overridden_link_number: 19, status: 'CHANGED_LINK', reason: 'Link #19 (12805/12806 AC+2S)', target_category_id: 2 },
      { staff_id: 32, overridden_link_number: 47, status: 'CHANGED_LINK', reason: 'Link #47 (12795/17645 AC+2S)', target_category_id: 2 },
      { staff_id: 22, overridden_link_number: 5, status: 'CHANGED_LINK', reason: 'Link #5 (17251/17254 AC+SL)', target_category_id: 2 },
      { staff_id: 62, overridden_link_number: 45, status: 'CHANGED_LINK', reason: 'Link #45 (17281/17282 2S)', target_category_id: 2 },
      { staff_id: 88, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'COR Link #8 (17261/12733 COR-2)', target_category_id: 1 },
      { staff_id: 91, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Ladies Link #1 (17261/17262 SL)', target_category_id: 3 },
      { staff_id: 4, overridden_link_number: 4, status: 'CHANGED_LINK', reason: 'COR Link #4 (20629/12733 COR-1)', target_category_id: 1 },
      { staff_id: 60, overridden_link_number: 43, status: 'CHANGED_LINK', reason: 'Link #43 (20629/20630 SL)', target_category_id: 2 },
      { staff_id: 42, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'COR Link #1 (17225/17226 AC)', target_category_id: 1 },
      { staff_id: 77, overridden_link_number: 11, status: 'CHANGED_LINK', reason: 'Link #11 (17225/17226 SL)', target_category_id: 2 },
      { staff_id: 11, overridden_link_number: 57, status: 'SUBSTITUTE', reason: 'COR Link #57 (17225/18048 AC)', target_category_id: 1 },
      { staff_id: 113, overridden_link_number: 57, status: 'CHANGED_LINK', reason: 'Link #57 (17225/18048 SL)', target_category_id: 2 },
      { staff_id: 39, overridden_link_number: 36, status: 'CHANGED_LINK', reason: 'Link #36 (17626/17625 AC+SL)', target_category_id: 2 },
      { staff_id: 31, overridden_link_number: 50, status: 'CHANGED_LINK', reason: 'Link #50 (17626/17625 SL)', target_category_id: 2 },
      // Page 179
      { staff_id: 8, overridden_link_number: 12, status: 'CHANGED_LINK', reason: 'COR Link #12 (12604/12603 AC)', target_category_id: 1 },
      { staff_id: 83, overridden_link_number: 3, status: 'CHANGED_LINK', reason: 'Link #3 (12604/12603 SL)', target_category_id: 2 },
      { staff_id: 102, overridden_link_number: 31, status: 'CHANGED_LINK', reason: 'Link #31 (12604/12603 SL)', target_category_id: 2 },
      { staff_id: 25, overridden_link_number: 18, status: 'SUBSTITUTE', reason: 'COR Link #18 (12734/20630 COR-1)', target_category_id: 1 },
      { staff_id: 14, overridden_link_number: 10, status: 'CHANGED_LINK', reason: 'COR Link #10 (12734 COR-2 / 17262 AC)', target_category_id: 1 },
      { staff_id: 38, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'Link #8 (12734/20630 SL)', target_category_id: 2 },
      { staff_id: 56, overridden_link_number: 39, status: 'CHANGED_LINK', reason: 'Link #39 (17243/17244 AC+SL)', target_category_id: 2 },
      { staff_id: 70, overridden_link_number: 53, status: 'CHANGED_LINK', reason: 'Link #53 (17243/17244 SL)', target_category_id: 2 },
      // Non-Daily
      { staff_id: 109, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '17221/17222', shifted_place: 'Train 17221/17222 AC+SL', reason: 'Non-Daily Train 17221/17222 (GNT-LPI-GNT)', target_category_id: 4 },
      { staff_id: 100, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: 'Pilot/12756', shifted_place: 'Pilot / Train 12756 AC+SL', reason: 'Special Train Pilot/12756', target_category_id: 4 },
      { staff_id: 112, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '16358/12603', shifted_place: 'Train 16358/12603 SL', reason: 'Non-Daily Train 16358/12603 (GNT-CAPE-GNT)', target_category_id: 4 },
      { staff_id: 116, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '20629/07196', shifted_place: 'Train 20629 SL / 07196 AC+SL', reason: 'Special Train 20629/07196', target_category_id: 4 },
      { staff_id: 107, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '07193/07194', shifted_place: 'Train 07193/07194 AC+SL', reason: 'Special Train 07193/07194', target_category_id: 4 }
    ],
    lr: [
      { staff_id: 101, duty_code: '17646', remarks: 'Link #17' },
      { staff_id: 113, duty_code: '17225', remarks: 'Link #57 (SL)' },
      { staff_id: 102, duty_code: '12604', remarks: 'Link #31' },
      { staff_id: 109, duty_code: '17221', remarks: 'Non-Daily 17221/17222' },
      { staff_id: 100, duty_code: 'Pilot', remarks: 'Non-Daily Pilot/12756' },
      { staff_id: 112, duty_code: '16358', remarks: 'Non-Daily 16358/12603' },
      { staff_id: 116, duty_code: '20629', remarks: 'Special 20629/07196' },
      { staff_id: 107, duty_code: '07193', remarks: 'Special 07193/07194' }
    ]
  },

  // =========================================================================
  // DATE 6: 06.09.26 SUNDAY (Pages 180 & 181)
  // =========================================================================
  {
    date: '2026-09-06',
    label: '06.09.26 Sunday (Pages 180 & 181)',
    overrides: [
      { staff_id: 111, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Link #1 (17253/17252 AC+SL)', target_category_id: 2 },
      { staff_id: 45, overridden_link_number: 29, status: 'CHANGED_LINK', reason: 'Link #29 (17239/17240 AC+2S)', target_category_id: 2 },
      { staff_id: 98, overridden_link_number: 17, status: 'CHANGED_LINK', reason: 'Link #17 (17646/12796 AC+SL)', target_category_id: 2 },
      { staff_id: 105, overridden_link_number: 19, status: 'CHANGED_LINK', reason: 'Link #19 (12805/12806 AC+2S)', target_category_id: 2 },
      { staff_id: 117, overridden_link_number: 47, status: 'CHANGED_LINK', reason: 'Link #47 (12795/17645 AC+2S)', target_category_id: 2 },
      { staff_id: 84, overridden_link_number: 5, status: 'CHANGED_LINK', reason: 'Link #5 (17251/17254 AC+SL)', target_category_id: 2 },
      { staff_id: 61, overridden_link_number: 45, status: 'CHANGED_LINK', reason: 'Link #45 (17281/17282 2S)', target_category_id: 2 },
      { staff_id: 87, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'COR Link #8 (17261/12733 COR-2)', target_category_id: 1 },
      { staff_id: 90, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Ladies Link #1 (17261/17262 SL)', target_category_id: 3 },
      { staff_id: 3, overridden_link_number: 4, status: 'CHANGED_LINK', reason: 'COR Link #4 (20629/12733 COR-1)', target_category_id: 1 },
      { staff_id: 59, overridden_link_number: 43, status: 'CHANGED_LINK', reason: 'Link #43 (20629/20630 SL)', target_category_id: 2 },
      { staff_id: 17, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'COR Link #1 (17225/17226 AC)', target_category_id: 1 },
      { staff_id: 41, overridden_link_number: 11, status: 'CHANGED_LINK', reason: 'Link #11 (17225/17226 SL)', target_category_id: 2 },
      { staff_id: 10, overridden_link_number: 57, status: 'SUBSTITUTE', reason: 'COR Link #57 (18047/17226 AC)', target_category_id: 1 },
      { staff_id: 73, overridden_link_number: 57, status: 'CHANGED_LINK', reason: 'Link #57 (18047/17226 SL)', target_category_id: 2 },
      { staff_id: 80, overridden_link_number: 36, status: 'CHANGED_LINK', reason: 'Link #36 (17626/17625 AC+SL)', target_category_id: 2 },
      { staff_id: 31, overridden_link_number: 50, status: 'CHANGED_LINK', reason: 'Link #50 (17626/17625 SL)', target_category_id: 2 },
      // Page 181
      { staff_id: 7, overridden_link_number: 12, status: 'CHANGED_LINK', reason: 'COR Link #12 (12604/12603 AC)', target_category_id: 1 },
      { staff_id: 82, overridden_link_number: 3, status: 'CHANGED_LINK', reason: 'Link #3 (12604/12603 SL)', target_category_id: 2 },
      { staff_id: 47, overridden_link_number: 31, status: 'CHANGED_LINK', reason: 'Link #31 (12604/12603 SL)', target_category_id: 2 },
      { staff_id: 5, overridden_link_number: 18, status: 'CHANGED_LINK', reason: 'COR Link #18 (12734/20630 COR-1)', target_category_id: 1 },
      { staff_id: 13, overridden_link_number: 10, status: 'CHANGED_LINK', reason: 'COR Link #10 (12734 COR-2 / 17262 AC)', target_category_id: 1 },
      { staff_id: 85, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'Link #8 (12734/20630 SL)', target_category_id: 2 },
      { staff_id: 55, overridden_link_number: 39, status: 'CHANGED_LINK', reason: 'Link #39 (17243/17244 AC+SL)', target_category_id: 2 },
      { staff_id: 103, overridden_link_number: 53, status: 'CHANGED_LINK', reason: 'Link #53 (17243/17244 SL)', target_category_id: 2 },
      // Non-Daily
      { staff_id: 99, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '17032/Pilot', shifted_place: 'Train 17032 AC+SL / Pilot', reason: 'Non-Daily Train 17032/Pilot (GNT-HYB-GNT)', target_category_id: 4 },
      { staff_id: 76, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '17231/17232', shifted_place: 'Train 17231/17232 AC+SL', reason: 'Non-Daily Train 17231/17232 (GNT-NS-GNT)', target_category_id: 2 },
      { staff_id: 114, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '02811/02812', shifted_place: 'Train 02811/02812 AC', reason: 'Special Train 02811/02812 (GNT-BBS-GNT)', target_category_id: 4 },
      { staff_id: 106, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '07227/07228', shifted_place: 'Train 07227/07228 AC+SL', reason: 'Special Train 07227/07228', target_category_id: 4 }
    ],
    lr: [
      { staff_id: 111, duty_code: '17253', remarks: 'Link #1' },
      { staff_id: 98, duty_code: '17646', remarks: 'Link #17' },
      { staff_id: 105, duty_code: '12805', remarks: 'Link #19' },
      { staff_id: 117, duty_code: '12795', remarks: 'Link #47' },
      { staff_id: 103, duty_code: '17243', remarks: 'Link #53' },
      { staff_id: 99, duty_code: '17032', remarks: 'Non-Daily 17032/Pilot' },
      { staff_id: 114, duty_code: '02811', remarks: 'Special 02811/02812' },
      { staff_id: 106, duty_code: '07227', remarks: 'Special 07227/07228' }
    ]
  },

  // =========================================================================
  // DATE 7: 07.09.26 MONDAY (Pages 182 & 183)
  // =========================================================================
  {
    date: '2026-09-07',
    label: '07.09.26 Monday (Pages 182 & 183)',
    overrides: [
      { staff_id: 30, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Link #1 (17253/17252 AC+SL)', target_category_id: 2 },
      { staff_id: 116, overridden_link_number: 29, status: 'CHANGED_LINK', reason: 'Link #29 (17239/17240 AC+2S)', target_category_id: 2 },
      { staff_id: 32, overridden_link_number: 17, status: 'CHANGED_LINK', reason: 'Link #17 (17646/12796 AC+SL)', target_category_id: 2 },
      { staff_id: 101, overridden_link_number: 19, status: 'CHANGED_LINK', reason: 'Link #19 (12805/12806 AC+2S)', target_category_id: 2 },
      { staff_id: 62, overridden_link_number: 47, status: 'CHANGED_LINK', reason: 'Link #47 (12795/17645 AC+2S)', target_category_id: 2 },
      { staff_id: 83, overridden_link_number: 5, status: 'CHANGED_LINK', reason: 'Link #5 (17251/17254 AC+SL)', target_category_id: 2 },
      { staff_id: 102, overridden_link_number: 45, status: 'CHANGED_LINK', reason: 'Link #45 (17281/17282 2S)', target_category_id: 2 },
      { staff_id: 19, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'COR Link #8 (17261/12733 COR-2)', target_category_id: 1 },
      { staff_id: 86, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'Ladies Link #1 (17261/17262 AC)', target_category_id: 3 },
      { staff_id: 2, overridden_link_number: 4, status: 'CHANGED_LINK', reason: 'COR Link #4 (20629/12733 COR-1)', target_category_id: 1 },
      { staff_id: 58, overridden_link_number: 43, status: 'CHANGED_LINK', reason: 'Link #43 (20629/20630 SL)', target_category_id: 2 },
      { staff_id: 68, overridden_link_number: 43, status: 'CHANGED_LINK', reason: 'Link #43 (20629/20630 SL-2)', target_category_id: 2 },
      { staff_id: 16, overridden_link_number: 1, status: 'CHANGED_LINK', reason: 'COR Link #1 (17225/17226 AC)', target_category_id: 1 },
      { staff_id: 26, overridden_link_number: 11, status: 'CHANGED_LINK', reason: 'Link #11 (17225/17226 SL)', target_category_id: 2 },
      { staff_id: 9, overridden_link_number: 57, status: 'SUBSTITUTE', reason: 'COR Link #57 (17225/18048 AC)', target_category_id: 1 },
      { staff_id: 40, overridden_link_number: 57, status: 'CHANGED_LINK', reason: 'Link #57 (17225/18048 SL)', target_category_id: 2 },
      { staff_id: 72, overridden_link_number: 36, status: 'CHANGED_LINK', reason: 'Link #36 (17626/17625 AC+SL)', target_category_id: 2 },
      { staff_id: 75, overridden_link_number: 50, status: 'CHANGED_LINK', reason: 'Link #50 (17626/17625 SL)', target_category_id: 2 },
      // Page 183
      { staff_id: 44, overridden_link_number: 12, status: 'SUBSTITUTE', reason: 'Upgraded to COR Link 12 (12604/12603 AC)', target_category_id: 1 },
      { staff_id: 99, overridden_link_number: 3, status: 'CHANGED_LINK', reason: 'Link #3 (12604/12603 SL)', target_category_id: 2 },
      { staff_id: 46, overridden_link_number: 31, status: 'CHANGED_LINK', reason: 'Link #31 (12604/12603 SL)', target_category_id: 2 },
      { staff_id: 4, overridden_link_number: 18, status: 'CHANGED_LINK', reason: 'COR Link #18 (12734/20630 COR-1)', target_category_id: 1 },
      { staff_id: 23, overridden_link_number: 10, status: 'CHANGED_LINK', reason: 'COR Link #10 (12734 COR-2 / 17262 SL)', target_category_id: 1 },
      { staff_id: 118, overridden_link_number: 8, status: 'CHANGED_LINK', reason: 'Link #8 (12734/20630 SL)', target_category_id: 2 },
      { staff_id: 37, overridden_link_number: 39, status: 'CHANGED_LINK', reason: 'Link #39 (17243/17244 AC+SL)', target_category_id: 2 },
      { staff_id: 54, overridden_link_number: 53, status: 'CHANGED_LINK', reason: 'Link #53 (17243/17244 SL)', target_category_id: 2 },
      // Non-Daily
      { staff_id: 100, status: 'EXTRA_CREW', is_extra: 1, extra_train_no: '17687/17688', shifted_place: 'Train 17687/17688 AC+SL', reason: 'Non-Daily Train 17687/17688 (GNT-DHNE-GNT)', target_category_id: 4 }
    ],
    lr: [
      { staff_id: 116, duty_code: '17239', remarks: 'Link #29' },
      { staff_id: 101, duty_code: '12805', remarks: 'Link #19' },
      { staff_id: 102, duty_code: '17281', remarks: 'Link #45' },
      { staff_id: 99, duty_code: '12604', remarks: 'Link #3' },
      { staff_id: 118, duty_code: '12734', remarks: 'Link #8' },
      { staff_id: 100, duty_code: '17687', remarks: 'Non-Daily 17687/17688' }
    ]
  }
];

async function syncAll() {
  console.log('Starting sync for complete 7-day Diary dataset (01.09.26 to 07.09.26)...');

  for (const item of DATES_CONFIG) {
    const d = item.date;
    console.log(`\n========================================\nSYNCING: ${item.label} (${d})\n========================================`);

    // Clean existing overrides for date
    await run('DELETE FROM overrides WHERE date = ?', [d]);

    // Insert overrides
    for (const ov of item.overrides) {
      await run(`
        INSERT INTO overrides (
          staff_id, date, original_link_number, overridden_link_number,
          status, is_extra, extra_train_no, shifted_place, reason, target_category_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        ov.staff_id,
        d,
        ov.original_link_number || null,
        ov.overridden_link_number || null,
        ov.status || 'CHANGED_LINK',
        ov.is_extra || 0,
        ov.extra_train_no || null,
        ov.shifted_place || null,
        ov.reason || 'Diary duty assignment',
        ov.target_category_id || null
      ]);
    }
    console.log(`✓ Inserted ${item.overrides.length} overrides for ${d}`);

    // Insert / update LR sheet records
    if (item.lr && item.lr.length > 0) {
      for (const lr of item.lr) {
        await run(`
          INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(staff_id, date) DO UPDATE SET
            duty_code = excluded.duty_code,
            remarks = excluded.remarks
        `, [lr.staff_id, d, lr.duty_code, lr.remarks]);
      }
      console.log(`✓ Synchronized ${item.lr.length} LR Sheet records for ${d}`);
    }
  }

  console.log('\n========================================\nALL 7 DATES (01.09.26 - 07.09.26) SYNCHRONIZED SUCCESSFULLY!\n========================================');
  db.close();
}

syncAll().catch(err => {
  console.error('Fatal Sync Error:', err);
  db.close();
});
