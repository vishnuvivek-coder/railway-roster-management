import { initDb, all, run, get } from './src/backend/db';
import { getDayOffset, getBaseLinkNumber } from './src/backend/rotation';
import { getCategoryParamsForDate } from './src/backend/services/helpers.service';
const { generatePendingTaClaimsForMonth } = require('./src/backend/ta_generator');

async function main() {
  console.log('Connecting to database...');
  await initDb();

  const allStaff = await all(`
    SELECT s.id, s.name, s.category_id, s.pf_no, s.row_position, s.rest_day, 
           c.anchor_date, c.cycle_length, c.code as category_code, c.name as category_name
    FROM staff s
    LEFT JOIN categories c ON s.category_id = c.id
  `);

  function findStaffId(hint: string): number {
    const clean = hint.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    for (const s of allStaff) {
      const sClean = s.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (sClean === clean) return s.id;
    }
    const dict: Record<string, number> = {
      'MVENKATESWARLU': 45,
      'MVRREDDY': 111,
      'MVRAMAREDDY': 111,
      'BSURESH': 47,
      'VACHAKRAVARTHY': 56,
      'VACHAKRAVARTHI': 56,
      'DKBASHA': 77,
      'DKHADERBASH': 77,
      'NSBABU': 50,
      'SWARNABABU': 50,
      'BVREDDY': 103,
      'VENKATREDDY': 103,
      'BVENKATREDDY': 103,
      'VANREDDY': 20,
      'BKKUMARI': 90,
      'KEZIAKUMARI': 90,
      'BKEZIAKUMARI': 90,
      'IDASARADHI': 3,
      'YKBABU': 73,
      'KORNELUBABU': 73,
      'BVRAO': 17,
      'YMKRISHNA': 62,
      'MURALIKRISHNA': 62,
      'OANIL': 80,
      'AGKRISHNA': 99,
      'DVANIL': 59,
      'MVANJANEYULU': 112,
      'CHRBABU': 7,
      'CHRAMESHBABU': 7,
      'ELNRAO': 114,
      'TRSREDDY': 5,
      'MKESHAVULU': 13,
      'MSURESH': 38,
      'MVSNREDDY': 102,
      'MVSNAGIREDDY': 102,
      'BPSINGH': 117,
      'NCMEENA': 107,
      'SVSKUMAR': 113,
      'SVSIVAKUMAR': 113,
      'TARAO': 110,
      'ANKAMMARAO': 110,
      'KBRAO': 105,
      'SKKHASIM': 30,
      'SKMBASHA': 46,
      'MASTANBASHA': 46,
      'URAMAKRISHNA': 37,
      'SSMANYAN': 76,
      'SUBRAHMANYAM': 76,
      'SSRINU': 41,
      'SUVVADASRINU': 41,
      'PGRAO': 53,
      'GOPALARAO': 53,
      'PRMKHAN': 19,
      'VSCHANDRIKA': 86,
      'KRAMANAIAH': 2,
      'DANVESH': 72,
      'SPRAO': 16,
      'PRAKASARAO': 16,
      'KKREDDY': 54,
      'KOTIREDDY': 54,
      'VVPKUMAR': 9,
      'VVPAVANKUMAR': 9,
      'JVKUMAR': 23,
      'JVINAYKUMAR': 23,
      'YSRIKANTH': 51,
      'PRKUMAR': 79,
      'PRAVIKUMAR': 79,
      'SHMBABU': 83,
      'MADHUBABU': 83,
      'SKKARIMULLA': 32,
      'SKKARIMULLAH': 32,
      'PVSRAO': 55,
      'PVSUBBARAO': 55,
      'BPRKUMAR': 4,
      'BPRAJAKUMAR': 4,
      'BRKREDDY': 12,
      'SANJAY': 106,
      'SANJAYKUMAR': 106,
      'BRKUMAR': 68,
      'BRAJAKUMAR': 68,
      'SKJHA': 82,
      'DRAKESH': 100,
      'RSNAIK': 89,
      'SAIDANAIK': 89,
      'NKKUMAR': 61,
      'NKISHANKUMAR': 61,
      'RBANGARAIAH': 18,
      'BANGARAIAH': 18,
      'VUMADEVI': 85,
      'UMADEVI': 85,
      'SHTULASI': 118,
      'HYMATULASI': 118,
      'KSRAO': 1,
      'KAKISRINIVASARAO': 1,
      'PKMOHAN': 71,
      'KRISHNAMOHAN': 71,
      'LPKUMAR': 15,
      'UBJOJI': 39,
      'UBALAJOJI': 39,
      'MSRINIVASULU': 8,
      'SVSRKRISHNA': 22,
      'TSHARSHA': 64,
      'TSRIHARSHA': 64,
      'TSKUMAR': 43,
      'TSIVAKUMAR': 43,
      'KDRAO': 31,
      'DURGARAO': 31,
      'SKSALEEM': 11,
      'MNRAJU': 36,
      'NAGARAJU': 36,
      'AVREDDY': 78,
      'AVENKIREDDY': 78,
      'BRMEENA': 109,
      'MSARAJU': 104
    };

    if (dict[clean]) return dict[clean];
    for (const [k, v] of Object.entries(dict)) {
      if (clean === k || clean.includes(k) || k.includes(clean)) return v;
    }
    console.warn('Unknown staff hint:', hint);
    return 0;
  }

  const dailyData = [
    // ==========================================
    // 18-10-26 SUNDAY (Pages 82 & 83)
    // ==========================================
    {
      date: '2026-10-18',
      page_number: 82,
      entries: [
        // Page 82
        { staff_names: ['M. VENKATESWARLU'], train_out: '17253', coach_out: 'AC+SL', train_return: '17252', coach_return: 'AC+SL' },
        { staff_names: ['M.V.R. REDDY'], train_out: '17239', coach_out: 'AC+2S', train_return: '17240', coach_return: 'AC+2S' },
        { staff_names: ['B. SURESH'], train_out: '17646', coach_out: 'AC+SL', train_return: '12796', coach_return: 'AC+2S' },
        { staff_names: ['VA CHAKRAVARTHY'], train_out: '12805', coach_out: 'AC+2S', train_return: '12806', coach_return: 'AC+2S' },
        { staff_names: ['D.K. BASHA'], train_out: '12795', coach_out: 'AC+2S', train_return: '17645', coach_return: 'AC+SL' },
        { staff_names: ['N.S. BABU'], train_out: '17251', coach_out: 'AC+SL', train_return: '17254', coach_return: 'AC+SL' },
        { staff_names: ['B.V. REDDY'], train_out: '17281', coach_out: '2S', train_return: '17282', coach_return: '2S' },
        { staff_names: ['VAN REDDY'], train_out: '17261', coach_out: 'AC', train_return: '12733', coach_return: 'COR-1' },
        { staff_names: ['B.K. KUMARI'], train_out: '17261', coach_out: 'SL', train_return: '17262', coach_return: 'SL' },
        { staff_names: ['I. DASARADHI'], train_out: '20629', coach_out: 'AC', train_return: '12733', coach_return: 'COR-2' },
        { staff_names: ['Y.K. BABU'], train_out: '20629', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['B.V. RAO'], train_out: '17225', coach_out: 'AC', train_return: '17226', coach_return: 'AC' },
        { staff_names: ['Y.M. KRISHNA'], train_out: '17225', coach_out: 'SL', train_return: '17226', coach_return: 'SL' },
        { staff_names: ['O. ANIL'], train_out: '18047', coach_out: 'AC', train_return: '17226', coach_return: 'AC' },
        { staff_names: ['A.G. KRISHNA'], train_out: '18047', coach_out: 'SL', train_return: '17226', coach_return: 'SL', notes: 'Replaced ELN Rao' },
        { staff_names: ['D. VANIL'], train_out: '17626', coach_out: 'AC+SL', train_return: '17625', coach_return: 'AC+SL' },
        { staff_names: ['M.V. ANJANEYULU'], train_out: '17626', coach_out: 'SL', train_return: '17625', coach_return: 'SL' },
        // Page 83
        { staff_names: ['CH. R. BABU'], train_out: '12604', coach_out: 'AC', train_return: '12603', coach_return: 'AC' },
        { staff_names: ['ELN RAO'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL', notes: 'Replaced AG Krishna' },
        { staff_names: ['TRS REDDY'], train_out: '12734', coach_out: 'COR-1', train_return: '20630', coach_return: 'AC' },
        { staff_names: ['M. KESHAVULU'], train_out: '12734', coach_out: 'COR-2', train_return: '17262', coach_return: 'SL' },
        { staff_names: ['M. SURESH'], train_out: '12734', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['M.V.S.N. REDDY'], train_out: '17243', coach_out: 'AC+SL', train_return: '17244', coach_return: 'AC+SL' },
        { staff_names: ['B.P. SINGH'], train_out: '17243', coach_out: 'SL', train_return: '17244', coach_return: 'SL' },
        { staff_names: ['N.C. MEENA'], train_out: '02811', coach_out: 'AC', train_return: '02812', coach_return: 'AC' },
        { staff_names: ['S.V.S. KUMAR'], train_out: '17231', coach_out: 'AC+SL', train_return: '17232', coach_return: 'AC+SL' },
        { staff_names: ['T.A. RAO'], train_out: '07193', coach_out: 'AC+SL', train_return: '07194', coach_return: 'AC+SL' }
      ]
    },

    // ==========================================
    // 19-10-26 MONDAY (Pages 84 & 85)
    // ==========================================
    {
      date: '2026-10-19',
      page_number: 84,
      entries: [
        // Page 84
        { staff_names: ['K.B. RAO'], train_out: '17253', coach_out: 'AC+SL', train_return: '17252', coach_return: 'AC+SL' },
        { staff_names: ['SK. KHASIM'], train_out: '17239', coach_out: 'AC+2S', train_return: '17240', coach_return: 'AC+2S' },
        { staff_names: ['SK. M. BASHA'], train_out: '17646', coach_out: 'AC+SL', train_return: '12796', coach_return: 'AC+2S' },
        { staff_names: ['U. RAMA KRISHNA'], train_out: '12805', coach_out: 'AC+2S', train_return: '12806', coach_return: 'AC+2S' },
        { staff_names: ['S.S. MANYAN'], train_out: '12795', coach_out: 'AC+2S', train_return: '17645', coach_return: 'AC+SL' },
        { staff_names: ['S. SRINU'], train_out: '17251', coach_out: 'AC+SL', train_return: '17254', coach_return: 'AC+SL' },
        { staff_names: ['P.G. RAO'], train_out: '17281', coach_out: '2S', train_return: '17282', coach_return: '2S' },
        { staff_names: ['PRM KHAN'], train_out: '17261', coach_out: 'AC', train_return: '12733', coach_return: 'COR-2' },
        { staff_names: ['V.S. CHANDRIKA'], train_out: '17261', coach_out: 'SL', train_return: '17262', coach_return: 'SL' },
        { staff_names: ['K. RAMANAIAH'], train_out: '20629', coach_out: 'AC', train_return: '12733', coach_return: 'COR-1' },
        { staff_names: ['D. ANVESH'], train_out: '20629', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['S.P. RAO'], train_out: '17225', coach_out: 'AC', train_return: '17226', coach_return: 'AC' },
        { staff_names: ['K.K. REDDY'], train_out: '17225', coach_out: 'SL', train_return: '17226', coach_return: 'SL' },
        { staff_names: ['VVP KUMAR'], train_out: '17225', coach_out: 'AC', train_return: '18048', coach_return: 'AC' },
        { staff_names: ['J.V. KUMAR'], train_out: '17225', coach_out: 'SL', train_return: '18048', coach_return: 'SL' },
        { staff_names: ['Y. SRIKANTH'], train_out: '17626', coach_out: 'AC+SL', train_return: '17625', coach_return: 'AC+SL' },
        { staff_names: ['P.R. KUMAR'], train_out: '17626', coach_out: 'SL', train_return: '17625', coach_return: 'SL' },
        // Page 85
        { staff_names: ['SH. M. BABU'], train_out: '12604', coach_out: 'AC', train_return: '12603', coach_return: 'AC' },
        { staff_names: ['SK. KARIMULLA'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL' },
        { staff_names: ['P.V.S. RAO'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL' },
        { staff_names: ['BPR KUMAR'], train_out: '12734', coach_out: 'COR-2', train_return: '20630', coach_return: 'AC' },
        { staff_names: ['BRK REDDY'], train_out: '12734', coach_out: 'COR-1', train_return: '17262', coach_return: 'SL' },
        { staff_names: ['SANJAY'], train_out: '12734', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['B.R. KUMAR'], train_out: '17243', coach_out: 'AC+SL', train_return: '17244', coach_return: 'AC+SL' },
        { staff_names: ['SK. JHA'], train_out: '17243', coach_out: 'SL', train_return: '17244', coach_return: 'SL' },
        { staff_names: ['D. RAKESH'], train_out: '17637', coach_out: 'AC+SL', train_return: '17638', coach_return: 'AC+SL' }
      ]
    },

    // ==========================================
    // 20-10-26 TUESDAY (Pages 86 & 87)
    // ==========================================
    {
      date: '2026-10-20',
      page_number: 86,
      entries: [
        // Page 86
        { staff_names: ['VA CHAKRAVARTHY'], train_out: '17253', coach_out: 'AC+SL', train_return: '17252', coach_return: 'AC+SL' },
        { staff_names: ['N.S. BABU'], train_out: '17239', coach_out: 'AC+2S', train_return: '17240', coach_return: 'AC+2S' },
        { staff_names: ['M. VENKATESWARLU'], train_out: '17646', coach_out: 'AC+SL', train_return: '12796', coach_return: 'AC+2S' },
        { staff_names: ['B. SURESH'], train_out: '12805', coach_out: 'AC+2S', train_return: '12806', coach_return: 'AC+2S' },
        { staff_names: ['R.S. NAIK'], train_out: '12795', coach_out: 'AC+2S', train_return: '17645', coach_return: 'AC+SL' },
        { staff_names: ['N.K. KUMAR'], train_out: '17251', coach_out: 'AC+SL', train_return: '17254', coach_return: 'AC+SL' },
        { staff_names: ['Y.K. BABU'], train_out: '17281', coach_out: '2S', train_return: '17282', coach_return: '2S' },
        { staff_names: ['R. BANGARAIAH'], train_out: '17261', coach_out: 'AC', train_return: '12733', coach_return: 'COR-1' },
        { staff_names: ['V. UMA DEVI'], train_out: '17261', coach_out: 'S1-S5', train_return: '17262', coach_return: 'S1-S5' },
        { staff_names: ['SH. TULASI'], train_out: '17261', coach_out: 'S10-S14', train_return: '17262', coach_return: 'S10-S14' },
        { staff_names: ['K.S. RAO'], train_out: '20629', coach_out: 'AC', train_return: '12733', coach_return: 'COR-2' },
        { staff_names: ['P.K. MOHAN'], train_out: '20629', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['L.P. KUMAR'], train_out: '17225', coach_out: 'AC', train_return: '17226', coach_return: 'AC' },
        { staff_names: ['U.B. JOJI'], train_out: '17225', coach_out: 'SL', train_return: '17226', coach_return: 'SL' },
        { staff_names: ['M. SRINIVASULU'], train_out: '18047', coach_out: 'AC', train_return: '17226', coach_return: 'AC' },
        { staff_names: ['SVSR KRISHNA'], train_out: '18047', coach_out: 'SL', train_return: '17226', coach_return: 'SL' },
        { staff_names: ['T.S. HARSHA'], train_out: '17626', coach_out: 'AC+SL', train_return: '17625', coach_return: 'AC+SL' },
        { staff_names: ['ELN RAO'], train_out: '17626', coach_out: 'SL', train_return: '17625', coach_return: 'SL' },
        // Page 87
        { staff_names: ['T.S. KUMAR'], train_out: '12604', coach_out: 'AC', train_return: '12603', coach_return: 'AC' },
        { staff_names: ['K.D. RAO'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL' },
        { staff_names: ['I. DASARADHI'], train_out: '12734', coach_out: 'COR-1', train_return: '20630', coach_return: 'AC' },
        { staff_names: ['SK. SALEEM'], train_out: '12734', coach_out: 'COR-2', train_return: '17262', coach_return: 'SL' },
        { staff_names: ['M.N. RAJU'], train_out: '12734', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['A.V. REDDY'], train_out: '17243', coach_out: 'AC+SL', train_return: '17244', coach_return: 'AC+SL' },
        { staff_names: ['MV ANJANEYULU'], train_out: '17243', coach_out: 'SL', train_return: '17244', coach_return: 'SL' },
        { staff_names: ['N.C. MEENA'], train_out: '17041', coach_out: 'SL', train_return: '17042', coach_return: 'SL' },
        { staff_names: ['BR MEENA'], train_out: '17077', coach_out: 'AC+SL', train_return: '17078', coach_return: 'AC+SL' },
        { staff_names: ['MSA RAJU'], train_out: '08063', coach_out: 'AC', train_return: '08064', coach_return: 'AC' }
      ]
    }
  ];

  const allWorkedStaffByDate: Record<string, Set<number>> = {
    '2026-10-18': new Set(),
    '2026-10-19': new Set(),
    '2026-10-20': new Set()
  };

  for (const day of dailyData) {
    const { date, page_number, entries } = day;
    console.log(`\n======================================================`);
    console.log(`Processing Date: ${date} (Pages ${page_number} & ${page_number + 1})`);
    console.log(`======================================================`);

    // 1. Clear previous duty_register_entry for this date
    const prevDreg = await all('SELECT id FROM duty_register_entry WHERE date = ?', [date]);
    for (const e of prevDreg) {
      await run('DELETE FROM duty_register_staff WHERE entry_id = ?', [e.id]);
    }
    await run('DELETE FROM duty_register_entry WHERE date = ?', [date]);

    // 2. Insert duty register entries & staff
    for (const item of entries) {
      const trainOut = item.train_out ? item.train_out.trim() : '';
      const trainRet = item.train_return ? item.train_return.trim() : '';
      const coachOut = item.coach_out ? item.coach_out.trim() : '';
      const coachRet = item.coach_return ? item.coach_return.trim() : '';
      const dutyLabel = (item as any).duty_label || (trainOut ? (trainRet ? `${trainOut} / ${trainRet}` : trainOut) : 'DUTY');
      const notes = (item as any).notes || '';

      const dregResult = await run(
        `INSERT INTO duty_register_entry (date, page_number, train_out, coach_out, train_return, coach_return, duty_label, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [date, page_number, trainOut, coachOut, trainRet, coachRet, dutyLabel, notes]
      );
      const entryId = dregResult.lastID;

      for (const nameHint of item.staff_names) {
        const staffId = findStaffId(nameHint);
        if (!staffId) {
          console.error(`Could not map staff: ${nameHint}`);
          continue;
        }

        allWorkedStaffByDate[date].add(staffId);
        await run('INSERT INTO duty_register_staff (entry_id, staff_id) VALUES (?, ?)', [entryId, staffId]);

        const staffObj = await get('SELECT id, name, category_id FROM staff WHERE id = ?', [staffId]);
        const dutyRemark = trainOut ? `Train ${trainOut}${trainRet ? ' / ' + trainRet : ''}` : dutyLabel;

        await run(
          `INSERT INTO overrides (staff_id, date, status, reason, train_out, coach_out, train_return, coach_return, created_by)
           VALUES (?, ?, 'DUTY', ?, ?, ?, ?, ?, 'Daily Register')
           ON DUPLICATE KEY UPDATE status = 'DUTY', reason = VALUES(reason), train_out = VALUES(train_out), coach_out = VALUES(coach_out), train_return = VALUES(train_return), coach_return = VALUES(coach_return)`,
          [staffId, date, dutyRemark, trainOut, coachOut, trainRet, coachRet]
        ).catch(async () => {
          await run(
            `INSERT OR REPLACE INTO overrides (staff_id, date, status, reason, train_out, coach_out, train_return, coach_return, created_by)
             VALUES (?, ?, 'DUTY', ?, ?, ?, ?, ?, 'Daily Register')`,
            [staffId, date, dutyRemark, trainOut, coachOut, trainRet, coachRet]
          );
        });

        await run(
          `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by)
           VALUES (?, ?, 'P', ?, 'Admin')
           ON DUPLICATE KEY UPDATE code = 'P', remarks = VALUES(remarks)`,
          [staffId, date, dutyRemark]
        ).catch(async () => {
          await run(
            `INSERT OR REPLACE INTO muster_records (staff_id, date, code, remarks, updated_by)
             VALUES (?, ?, 'P', ?, 'Admin')`,
            [staffId, date, dutyRemark]
          );
        });

        if (staffObj && staffObj.category_id === 4) {
          await run(
            `INSERT INTO lr_sheet_records (staff_id, date, duty_code, remarks)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE duty_code = VALUES(duty_code), remarks = VALUES(remarks)`,
            [staffId, date, dutyRemark, notes || 'Utilised as per Daily Register']
          ).catch(async () => {
            await run(
              `INSERT OR REPLACE INTO lr_sheet_records (staff_id, date, duty_code, remarks)
               VALUES (?, ?, ?, ?)`,
              [staffId, date, dutyRemark, notes || 'Utilised as per Daily Register']
            );
          });
        }

        await run(
          `INSERT INTO daily_earnings_entries (date, category_id, staff_id, staff_name, duty, remarks)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE duty = VALUES(duty), remarks = VALUES(remarks)`,
          [date, staffObj.category_id, staffId, staffObj.name, dutyRemark, notes]
        ).catch(async () => {
          await run(
            `INSERT OR REPLACE INTO daily_earnings_entries (date, category_id, staff_id, staff_name, duty, remarks)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [date, staffObj.category_id, staffId, staffObj.name, dutyRemark, notes]
          );
        });

        console.log(`  Staff [${staffId}] ${staffObj.name}: ${dutyRemark} (${coachOut} / ${coachRet})`);
      }
    }
  }

  // 3. IDENTIFY GENUINE ABSENTEES
  // Outward trains originating from HQ (GNT / BZA) that start a duty link
  const OUTWARD_TRAINS = [
    '17253', '17239', '17646', '12805', '12795', '17251', '17281',
    '17261', '20629', '17225', '18047', '17626', '12604', '12734', '17243'
  ];

  console.log('\n======================================================');
  console.log('IDENTIFYING ABSENT EMPLOYEES');
  console.log('======================================================');

  const links = await all(`SELECT * FROM links WHERE status != 'draft' OR status IS NULL`);
  const absentList: { date: string; staff: any; link: any; reason: string }[] = [];

  for (const dateStr of ['2026-10-18', '2026-10-19', '2026-10-20']) {
    const workedSet = allWorkedStaffByDate[dateStr];

    for (const s of allStaff) {
      if (!s.category_id || !s.row_position) continue;
      if (s.category_id === 4) continue; // LR staff are assigned on demand

      if (workedSet.has(s.id)) continue; // Attended and worked!

      // Check scheduled link
      const catParams = (s.category_id === 2 || s.category_code === 'TTI_SLEEPER')
        ? getCategoryParamsForDate(s, dateStr)
        : { anchor_date: s.anchor_date, cycle_length: s.cycle_length };
      const dayOffset = getDayOffset(catParams.anchor_date, dateStr);
      const linkNum = getBaseLinkNumber(s.row_position, dayOffset, catParams.cycle_length);
      if (linkNum === null) continue;

      const lDef = links.find(l => l.category_id === s.category_id && l.link_number === linkNum);
      if (!lDef) continue;
      if (lDef.is_rest === 1 || lDef.train_numbers === 'REST' || lDef.train_numbers === 'OFF') continue;

      // Check if this link starts with an outward train from HQ
      const trainFirst = (lDef.train_numbers || '').split(/[,/]/)[0].trim().replace(/[^0-9]/g, '');
      const isOutwardTrip = OUTWARD_TRAINS.some(t => trainFirst.includes(t) || t.includes(trainFirst));
      if (!isOutwardTrip) {
        // Return trip or pilot/halt from outstation — not an outward booking from HQ
        continue;
      }

      // Check if on leave
      const leaveReq = await get(
        `SELECT * FROM leave_requests WHERE staff_id = ? AND date = ? AND status = 'APPROVED'`,
        [s.id, dateStr]
      );
      if (leaveReq) continue; // Approved leave

      const existingOverride = await get(
        `SELECT * FROM overrides WHERE staff_id = ? AND date = ?`,
        [s.id, dateStr]
      );
      if (existingOverride && (existingOverride.status === 'LEAVE' || existingOverride.status === 'SICK' || existingOverride.status === 'CR' || existingOverride.status === 'REST')) {
        continue;
      }

      const existingMuster = await get(
        `SELECT * FROM muster_records WHERE staff_id = ? AND date = ?`,
        [s.id, dateStr]
      );
      if (existingMuster && ['LAP', 'CL', 'SICK', 'CR', 'R', 'NH'].includes(existingMuster.code)) {
        continue;
      }

      // If scheduled outward train was worked by someone else (or left vacant) and this staff did not take leave:
      absentList.push({
        date: dateStr,
        staff: s,
        link: lDef,
        reason: `Rostered for Train ${trainFirst} (Link ${lDef.link_number}), did not attend and was replaced in Daily Register`
      });
    }
  }

  console.log(`\nIdentified ${absentList.length} Absent staff instances on Oct 18-20:`);
  for (const item of absentList) {
    console.log(`  Date: ${item.date} | Staff [${item.staff.id}] ${item.staff.name.padEnd(20)} | ${item.reason}`);

    // Mark as ABSENT in overrides
    await run(
      `INSERT INTO overrides (staff_id, date, status, reason, created_by)
       VALUES (?, ?, 'ABSENT', ?, 'Daily Register Absence')
       ON DUPLICATE KEY UPDATE status = 'ABSENT', reason = VALUES(reason)`,
      [item.staff.id, item.date, item.reason]
    ).catch(async () => {
      await run(
        `INSERT OR REPLACE INTO overrides (staff_id, date, status, reason, created_by)
         VALUES (?, ?, 'ABSENT', ?, 'Daily Register Absence')`,
        [item.staff.id, item.date, item.reason]
      );
    });

    // Mark as 'O' (Absent) in muster_records
    await run(
      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by)
       VALUES (?, ?, 'O', ?, 'Admin')
       ON DUPLICATE KEY UPDATE code = 'O', remarks = VALUES(remarks)`,
      [item.staff.id, item.date, `ABSENT: ${item.reason}`]
    ).catch(async () => {
      await run(
        `INSERT OR REPLACE INTO muster_records (staff_id, date, code, remarks, updated_by)
         VALUES (?, ?, 'O', ?, 'Admin')`,
        [item.staff.id, item.date, `ABSENT: ${item.reason}`]
      );
    });

    // Strictly reject / zero TA
    await run("UPDATE ta_approvals SET status = 'REJECTED', claim_amount = 0, remarks = 'ABSENT: Disallowed' WHERE staff_id = ? AND duty_date = ?", [item.staff.id, item.date]);
    await run("DELETE FROM ta_entries WHERE staff_id = ? AND duty_date = ?", [item.staff.id, item.date]);
  }

  // 4. Regenerate TA for all staff for October 2026 to ensure 100% synchronization
  console.log('\n--- Regenerating TA claims for October 2026 ---');
  const dbObj = { run, get, all };
  await generatePendingTaClaimsForMonth(dbObj, 2026, 10);
  console.log('TA claims for October 2026 refreshed and synchronized successfully!');

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error applying daily summary & absence for Oct 18-20:', err);
  process.exit(1);
});
