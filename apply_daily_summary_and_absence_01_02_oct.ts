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
    WHERE s.name NOT LIKE '%VACANT%'
  `);

  function findStaffId(hint: string): number {
    const clean = hint.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    for (const s of allStaff) {
      const sClean = s.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (sClean === clean) return s.id;
    }
    const dict: Record<string, number> = {
      'MVRREDDY': 111,
      'MVRAMAREDDY': 111,
      'TSKUMAR': 43,
      'TSIVAKUMAR': 43,
      'BPSINGH': 117,
      'SHMBABU': 83,
      'SHMADHUBABU': 83,
      'NRCREDDY': 26,
      'TARAO': 110,
      'TANKAMMARAO': 110,
      'BVSREDDY': 24,
      'SKSALEEM': 11,
      'VUMADEVI': 85,
      'SHTULASI': 118,
      'SHYMATULASI': 118,
      'LPKUMAR': 15,
      'LPRASANNAKUMAR': 15,
      'SVSRKRISHNA': 22,
      'PKMOHAN': 71,
      'PKRISHNAMOHAN': 71,
      'MSRINIVASULU': 8,
      'PGRAO': 53,
      'PGOPALARAO': 53,
      'KSRAO': 1,
      'KAKISRINIVASARAO': 1,
      'MNRAJU': 36,
      'MNAGARAJU': 36,
      'NSBABU': 50,
      'NSWARNABABU': 50,
      'AVREDDY': 78,
      'AVENKIREDDY': 78,
      'PRMKHAN': 19,
      'PRMALIKHAN': 19,
      'MVENKATESWARLU': 45,
      'VSRAO': 115,
      'VSRINIVASARAO': 115,
      'BVRAO': 17,
      'BPRKUMAR': 4,
      'BPRAJAKUMAR': 4,
      'UBJOJI': 39,
      'UBALAJOJI': 39,
      'SKKARIMULLA': 32,
      'SKKARIMULLAH': 32,
      'GSHIVAN': 101,
      'ELNRAO': 114,
      'RBANGARAIAH': 18,
      'MVSNREDDY': 102,
      'MVSNAGIREDDY': 102,
      'TKRAO': 108,
      'TKANTHARAO': 108,
      'NVENKATESH': 42,
      'YSRIKANTH': 51,
      'MVANJANEYULU': 112,
      'RNRNAIK': 25,
      'SKMBASHA': 46,
      'SKMASTANBASHA': 46,
      'JVKUMAR': 23,
      'JVINAYKUMAR': 23,
      'KVRRAO': 10,
      'KVRAMANARAO': 10,
      'MSKUMARI': 87,
      'MSIVAKUMARI': 87,
      'EVRAMANAMMA': 91,
      'SNAGALINGAPPA': 14,
      'KKKUMAR': 84,
      'KKRANTHIKUMAR': 84,
      'KGOPI': 70,
      'CHRBABU': 7,
      'CHRAMESHBABU': 7,
      'DVANIL': 59,
      'DVANILKUMAR': 59,
      'MNRAO': 21,
      'YKBABU': 73,
      'YKORNELUBABU': 73,
      'PBKRISHNA': 28,
      'PBALAKRISHNA': 28,
      'DKBASHA': 77,
      'DKHADERBASH': 77,
      'KVBSANKAR': 44,
      'KUBSANKAR': 44,
      'SVSKUMAR': 113,
      'SVSSKUMAR': 113,
      'SVSIVAKUMAR': 113,
      'DRAKESH': 100,
      'SPRAO': 16,
      'SPRAKASARAO': 16,
      'IDASARADHI': 3,
      'VACHAKRAVARTHI': 56,
      'VACHAKRAVARTHY': 56,
      'MSURESH': 38,
      'OANIL': 80,
      'SANJAY': 106,
      'SANJAYKUMAR': 106,
      'NCMEENA': 107,
      'RSNAIK': 89,
      'RSAIDANAIK': 89,
      'YMKRISHNA': 62,
      'YMURALIKRISHNA': 62,
      'TSHARSHA': 64,
      'TSRIHARSHA': 64,
      'TSHANHA': 64,
      'AGKRISHNA': 99,
      'VVPKUMAR': 9,
      'VVPAVANKUMAR': 9,
      'VSCHANDRIKA': 86,
      'BKKUMARI': 90,
      'BKEZIAKUMARI': 90,
      'MKESHAVULU': 13,
      'KNARESH': 58,
      'DANVESH': 72,
      'VANREDDY': 20,
      'KVSURESH': 34,
      'SSMANYAM': 76,
      'SSUBRAHMANYAM': 76,
      'SSRINU': 41,
      'SUVVADASRINU': 41,
      'KRAMANAIAH': 2,
      'PVSRAO': 55,
      'PVSUBBARAO': 55,
      'SKKHASIM': 30,
      'PRKUMAR': 79,
      'PRAVIKUMAR': 79,
      'BRMEENA': 109,
      'BVREDDY': 103,
      'BVENKATREDDY': 103,
      'MSARAJU': 104,
      'MSNAGARAJU': 104,
      'KDRAO': 31,
      'KDURGARAO': 31,
      'GVRAJULU': 75,
      'GVARADARAJULU': 75,
      'KSPARVATHI': 88,
      'KSIVAPARVATHI': 88,
      'KKREDDY': 54,
      'KKOTIREDDY': 54,
      'URAMAKRISHNA': 37,
      'TRSREDDY': 5,
      'BPKUMAR': 40,
      'BPAVANKUMAR': 40,
      'SKJHA': 82,
      'NKKUMAR': 61,
      'NKISHANKUMAR': 61,
      'BSURESH': 47,
      'KRMREDDY': 6
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
    // 01-10-26 THURSDAY (Pages 48 & 49)
    // ==========================================
    {
      date: '2026-10-01',
      page_number: 48,
      entries: [
        // Page 48 (Day)
        { staff_names: ['K. NARESH'], train_out: '17253', coach_out: 'AC+SL', train_return: '17252', coach_return: 'AC+SL' },
        { staff_names: ['T. A. RAO'], train_out: '17239', coach_out: 'AC+2S', train_return: '17240', coach_return: 'AC+2S' },
        { staff_names: ['BR MEENA'], train_out: '17646', coach_out: 'AC+SL', train_return: '12796', coach_return: 'AC+2S' },
        { staff_names: ['Y. K. BABU'], train_out: '12805', coach_out: 'AC+2S', train_return: '12806', coach_return: 'AC+2S' },
        { staff_names: ['M. V. S. N. REDDY'], train_out: '12795', coach_out: 'AC+2S', train_return: '17645', coach_return: 'AC+SL' },
        { staff_names: ['D. VANIL'], train_out: '17251', coach_out: 'AC+SL', train_return: '17254', coach_return: 'AC+SL' },
        { staff_names: ['SVSR KRISHNA'], train_out: '17281', coach_out: '2S', train_return: '17282', coach_return: '2S' },
        { staff_names: ['SP RAO'], train_out: '17261', coach_out: 'AC', train_return: '12733', coach_return: 'COR-1' },
        { staff_names: ['V. S. CHANDRIKA'], train_out: '17261', coach_out: 'S1-S5', train_return: '17262', coach_return: 'S1-S5' },
        { staff_names: ['B. K. KUMARI'], train_out: '17261', coach_out: 'S10-S14', train_return: '17262', coach_return: 'S10-S14' },
        { staff_names: ['VAN REDDY'], train_out: '20629', coach_out: 'AC', train_return: '12733', coach_return: 'COR-2' },
        { staff_names: ['S. S. MANYAM'], train_out: '20629', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['M. KESHAVULU'], train_out: '17225', coach_out: 'AC', train_return: '17226', coach_return: 'AC' },
        { staff_names: ['Y. SRIKANTH'], train_out: '17225', coach_out: 'SL', train_return: '17226', coach_return: 'SL' },
        { staff_names: ['P. R. KUMAR'], train_out: '17225', coach_out: 'SL', train_return: '17226', coach_return: 'SL' },
        { staff_names: ['KRM REDDY'], train_out: '17225', coach_out: 'AC', train_return: '18048', coach_return: 'AC' },
        { staff_names: ['S. SRINU'], train_out: '17225', coach_out: 'SL', train_return: '18048', coach_return: 'SL' },
        { staff_names: ['SH. M. BABU'], train_out: '17626', coach_out: 'AC+SL', train_return: '17625', coach_return: 'AC+SL' },
        { staff_names: ['K. V. SURESH'], train_out: '17626', coach_out: 'SL', train_return: '17625', coach_return: 'SL' },

        // Page 49 (Night)
        { staff_names: ['I. DASARADHI'], train_out: '12604', coach_out: 'AC', train_return: '12603', coach_return: 'AC' },
        { staff_names: ['BVS REDDY'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL' },
        { staff_names: ['B. P. SINGH'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL' },
        { staff_names: ['K. S. RAO'], train_out: '12734', coach_out: 'COR-1', train_return: '20630', coach_return: 'AC' },
        { staff_names: ['V. V. P. KUMAR'], train_out: '12734', coach_out: 'COR-2', train_return: '17262', coach_return: 'COR' },
        { staff_names: ['K. B. RAO'], train_out: '12734', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['J. V. KUMAR'], train_out: '17243', coach_out: 'AC+SL', train_return: '17244', coach_return: 'AC+SL' },
        { staff_names: ['SANJAY'], train_out: '17243', coach_out: 'SL', train_return: '17244', coach_return: 'SL' },
        { staff_names: ['SH. TULASI'], train_out: '12755', coach_out: 'AC+SL', train_return: 'Pilot', coach_return: 'SL', notes: 'Pilot return to BZA' },
        { staff_names: ['G. SHIVAN'], train_out: '12604', coach_out: 'SL', train_return: '16357', coach_return: 'SL' },
        { staff_names: ['KVB SANKAR'], train_out: '07001', coach_out: 'AC+SL', train_return: '17070', coach_return: 'AC+SL' },
        { staff_names: ['D. ANVESH'], train_out: '07001', coach_out: 'SL', train_return: '07002', coach_return: 'AC+SL' }
      ]
    },

    // ==========================================
    // 02-10-26 FRIDAY (Pages 50 & 51)
    // ==========================================
    {
      date: '2026-10-02',
      page_number: 50,
      entries: [
        // Page 50 (Day)
        { staff_names: ['B. V. REDDY'], train_out: '17253', coach_out: 'AC+SL', train_return: '17252', coach_return: 'AC+SL' },
        { staff_names: ['B. SURESH'], train_out: '17239', coach_out: 'AC+2S', train_return: '17240', coach_return: 'AC+2S' },
        { staff_names: ['K. GOPI'], train_out: '17646', coach_out: 'AC+SL', train_return: '12796', coach_return: 'AC+2S' },
        { staff_names: ['K. K. REDDY'], train_out: '12805', coach_out: 'AC+2S', train_return: '12806', coach_return: 'AC+2S' },
        { staff_names: ['SK. KHASIM'], train_out: '12795', coach_out: 'AC+2S', train_return: '17645', coach_return: 'AC+SL' },
        { staff_names: ['K. NARESH'], train_out: '17251', coach_out: 'AC+SL', train_return: '17254', coach_return: 'AC+SL' },
        { staff_names: ['P. B. KRISHNA'], train_out: '17281', coach_out: '2S', train_return: '17282', coach_return: '2S' },
        { staff_names: ['L. P. KUMAR'], train_out: '17261', coach_out: 'AC', train_return: '12733', coach_return: 'COR-2' },
        { staff_names: ['V. UMA DEVI'], train_out: '17261', coach_out: 'S1-S5', train_return: '17262', coach_return: 'S1-S5' },
        { staff_names: ['K. S. PARVATHI'], train_out: '17261', coach_out: 'S10-S14', train_return: '17262', coach_return: 'S10-S14' },
        { staff_names: ['PRM KHAN'], train_out: '20629', coach_out: 'AC', train_return: '12733', coach_return: 'COR-1' },
        { staff_names: ['NRC REDDY'], train_out: '20629', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['G. V. RAJULU'], train_out: '20629', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['T. S. HARSHA'], train_out: '17225', coach_out: 'AC', train_return: '17226', coach_return: 'AC' },
        { staff_names: ['A. V. REDDY'], train_out: '17225', coach_out: 'SL', train_return: '17226', coach_return: 'SL' },
        { staff_names: ['TRS REDDY'], train_out: '18047', coach_out: 'AC', train_return: '17226', coach_return: 'AC' },
        { staff_names: ['B. P. KUMAR'], train_out: '18047', coach_out: 'SL', train_return: '17226', coach_return: 'SL' },
        { staff_names: ['SK. JHA'], train_out: '17626', coach_out: 'AC+SL', train_return: '17625', coach_return: 'AC+SL' },
        { staff_names: ['N. K. KUMAR'], train_out: '17626', coach_out: 'SL', train_return: '17625', coach_return: 'SL' },

        // Page 51 (Night)
        { staff_names: ['K. RAMANAIAH'], train_out: '12604', coach_out: 'AC', train_return: '12603', coach_return: 'AC' },
        { staff_names: ['VA CHAKRAVARTHI'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL' },
        { staff_names: ['V. S. RAO'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL' },
        { staff_names: ['M. N. RAO'], train_out: '12734', coach_out: 'COR-2', train_return: '20630', coach_return: 'AC' },
        { staff_names: ['K. V. R. RAO'], train_out: '12734', coach_out: 'COR-1', train_return: '17262', coach_return: 'COR' },
        { staff_names: ['SV S. KUMAR'], train_out: '12734', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['M. N. RAJU'], train_out: '17243', coach_out: 'AC+SL', train_return: '17244', coach_return: 'AC+SL' },
        { staff_names: ['SVSR KRISHNA'], train_out: '17243', coach_out: 'SL', train_return: '17244', coach_return: 'SL' },
        { staff_names: ['A. G. KRISHNA'], train_out: '17231', coach_out: 'AC+SL', train_return: '17232', coach_return: 'AC+SL' },
        { staff_names: ['N. C. MEENA'], train_out: '18063', coach_out: 'AC', train_return: '18064', coach_return: 'AC' },
        { staff_names: ['D. RAKESH'], train_out: '17607', coach_out: 'AC+SL', train_return: '17608', coach_return: 'AC+SL' },
        { staff_names: ['T. S. KUMAR'], train_out: '07191', coach_out: 'AC+SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['U. RAMA KRISHNA'], train_out: '07535', coach_out: 'AC+SL', train_return: '12603', coach_return: 'SL' }
      ]
    }
  ];

  // Set of all staff working on each date
  const allWorkedStaffByDate: Record<string, Set<number>> = {
    '2026-10-01': new Set(),
    '2026-10-02': new Set()
  };

  for (const day of dailyData) {
    const date = day.date;
    console.log(`\n======================================================`);
    console.log(`PROCESSING DAILY SUMMARY FOR ${date} (PAGE ${day.page_number})`);
    console.log(`======================================================`);

    // 1. Clear prior duty register for this date
    const priorEntries = await all(`SELECT id FROM duty_register_entry WHERE date = ?`, [date]);
    if (priorEntries && priorEntries.length > 0) {
      const ids = priorEntries.map(e => e.id);
      await run(`DELETE FROM duty_register_staff WHERE entry_id IN (${ids.join(',')})`);
      await run(`DELETE FROM duty_register_entry WHERE date = ?`, [date]);
      console.log(`Cleared ${priorEntries.length} prior duty register entries for ${date}`);
    }

    // 2. Insert entries
    for (const ent of day.entries) {
      const trainOut = ent.train_out ? ent.train_out.trim() : '';
      const trainRet = ent.train_return ? ent.train_return.trim() : '';
      const coachOut = ent.coach_out ? ent.coach_out.trim() : '';
      const coachRet = ent.coach_return ? ent.coach_return.trim() : '';
      const dutyLabel = (ent as any).duty_label || (trainOut ? (trainRet ? `${trainOut} / ${trainRet}` : trainOut) : 'DUTY');
      const notes = ent.notes || '';

      const entRes = await run(
        `INSERT INTO duty_register_entry (date, page_number, train_out, coach_out, train_return, coach_return, duty_label, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [date, day.page_number, trainOut, coachOut, trainRet, coachRet, dutyLabel, notes]
      );
      const entryId = (entRes as any).lastID || (entRes as any).insertId;

      for (const rawName of ent.staff_names) {
        const staffId = findStaffId(rawName);
        if (!staffId) {
          console.error(`ERROR: Could not find staff ID for "${rawName}"!`);
          continue;
        }

        allWorkedStaffByDate[date].add(staffId);
        const staffObj = allStaff.find(s => s.id === staffId);

        await run(
          `INSERT INTO duty_register_staff (entry_id, staff_id)
           VALUES (?, ?)`,
          [entryId, staffId]
        );

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

  // 3. IDENTIFY GENUINE ABSENTEES FOR OCT 01, OCT 02, AND OCT 29
  const OUTWARD_TRAINS = [
    '17253', '17239', '17646', '12805', '12795', '17251', '17281',
    '17261', '20629', '17225', '18047', '17626', '12604', '12734', '17243'
  ];

  console.log('\n======================================================');
  console.log('IDENTIFYING ABSENT EMPLOYEES (01-02 OCT & 29 OCT)');
  console.log('======================================================');

  // Also include 2026-10-29 worked staff
  allWorkedStaffByDate['2026-10-29'] = new Set();
  const worked29 = await all(`
    SELECT DISTINCT ds.staff_id 
    FROM duty_register_staff ds 
    JOIN duty_register_entry de ON ds.entry_id = de.id 
    WHERE de.date = '2026-10-29'
  `);
  for (const w of worked29) {
    allWorkedStaffByDate['2026-10-29'].add(w.staff_id);
  }

  const links = await all(`SELECT * FROM links WHERE status != 'draft' OR status IS NULL`);
  const absentList: { date: string; staff: any; link: any; reason: string }[] = [];

  for (const dateStr of ['2026-10-01', '2026-10-02', '2026-10-29']) {
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

  console.log(`\nIdentified ${absentList.length} Absent staff instances on Oct 01, 02, and 29:`);
  for (const ab of absentList) {
    console.log(`  [${ab.date}] Staff [${ab.staff.id}] ${ab.staff.name} (cat ${ab.staff.category_id}): ${ab.reason}`);

    // Update overrides to ABSENT
    await run(
      `INSERT INTO overrides (staff_id, date, status, reason, created_by)
       VALUES (?, ?, 'ABSENT', ?, 'Absence Analysis')
       ON DUPLICATE KEY UPDATE status = 'ABSENT', reason = VALUES(reason)`,
      [ab.staff.id, ab.date, ab.reason]
    ).catch(async () => {
      await run(
        `INSERT OR REPLACE INTO overrides (staff_id, date, status, reason, created_by)
         VALUES (?, ?, 'ABSENT', ?, 'Absence Analysis')`,
        [ab.staff.id, ab.date, ab.reason]
      );
    });

    // Update muster code to 'O' (Absent)
    await run(
      `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by)
       VALUES (?, ?, 'O', ?, 'Admin')
       ON DUPLICATE KEY UPDATE code = 'O', remarks = VALUES(remarks)`,
      [ab.staff.id, ab.date, ab.reason]
    ).catch(async () => {
      await run(
        `INSERT OR REPLACE INTO muster_records (staff_id, date, code, remarks, updated_by)
         VALUES (?, ?, 'O', ?, 'Admin')`,
        [ab.staff.id, ab.date, ab.reason]
      );
    });
  }

  // 4. Regenerate TA for all staff for October 2026 to ensure 100% synchronization
  console.log('\n--- Regenerating TA claims for October 2026 ---');
  const dbObj = { run, get, all };
  await generatePendingTaClaimsForMonth(dbObj, 2026, 10);
  console.log('TA claims for October 2026 refreshed and synchronized successfully!');

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error applying daily summary for Oct 01-02:', err);
  process.exit(1);
});
