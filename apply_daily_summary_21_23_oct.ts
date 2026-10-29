import { initDb, all, run, get } from './src/backend/db';
const { generatePendingTaClaimsForMonth } = require('./src/backend/ta_generator');

async function main() {
  console.log('Connecting to database...');
  await initDb();

  const allStaff = await all("SELECT id, name, category_id, pf_no FROM staff");

  function findStaffId(hint: string): number {
    const clean = hint.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    for (const s of allStaff) {
      const sClean = s.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (sClean === clean) return s.id;
    }
    // Specific exact mapping dictionary
    const dict: Record<string, number> = {
      'NVENKATESH': 42,
      'BPSINGH': 117,
      'TKRAO': 108,
      'KANTHARAO': 108,
      'TKANTHARAO': 108,
      'SKMBASHA': 46,
      'MASTANBASHA': 46,
      'KVBSANKAR': 44,
      'VSRAO': 115,
      'SRINIVASARAO': 115,
      'VSRINIVASARAO': 115,
      'KKSINGH': 60,
      'KKUSHWANTHSINGH': 60,
      'BVSREDDY': 24,
      'EVRAMANAMMA': 91,
      'MNRAO': 21,
      'KGOPI': 70,
      'SNAGALINGAPPA': 14,
      'MSURESH': 38,
      'CHRBABU': 7,
      'CHRAMESHBABU': 7,
      'KKKUMAR': 84,
      'KRANTHIKUMAR': 84,
      'KKRANTHIKUMAR': 84,
      'DKBASHA': 77,
      'DKHADERBASH': 77,
      'RNRNAIK': 25,
      'BPRKUMAR': 4,
      'BPRAJAKUMAR': 4,
      'DANVESH': 72,
      'BVRAO': 17,
      'DVANIL': 59,
      'VANILKUMAR': 59,
      'DVANILKUMAR': 59,
      'SVSKUMAR': 113,
      'SVSSKUMAR': 113,
      'SVSIVAKUMAR': 113,
      'VACHAKRAVARTHY': 56,
      'VACHAKRAVARTHI': 56,
      'CHAKRAVARTHI': 56,
      'OANIL': 80,
      'AGKRISHNA': 99,
      'TARAO': 110,
      'ANKAMMARAO': 110,
      'TANKAMMARAO': 110,
      'SANJAY': 106,
      'SANJAYKUMAR': 106,
      'PBKRISHNA': 28,
      'BALAKRISHNA': 28,
      'PBALAKRISHNA': 28,
      'SSRINU': 41,
      'SUVVADASRINU': 41,
      'DRAKESH': 100,
      'TSIVAKUMAR': 43,
      'TSKUMAR': 43,
      'MVENKATESWARLU': 45,
      'YKBABU': 73,
      'KORNELUBABU': 73,
      'YKORNELUBABU': 73,
      'KDRAO': 31,
      'DURGARAO': 31,
      'KDURGARAO': 31,
      'PKMOHAN': 71,
      'KRISHNAMOHAN': 71,
      'PKRISHNAMOHAN': 71,
      'SPRAO': 16,
      'PRAKASARAO': 16,
      'SPRAKASARAO': 16,
      'VSCHANDRIKA': 86,
      'BKKUMARI': 90,
      'KEZIAKUMARI': 90,
      'BKEZIAKUMARI': 90,
      'VANREDDY': 20,
      'PVSRAO': 55,
      'PVSUBBARAO': 55,
      'MKESHAVULU': 13,
      'URAMAKRISHNA': 37,
      'KSRAO': 1,
      'KAKISRINIVASARAO': 1,
      'SHMBABU': 83,
      'MADHUBABU': 83,
      'SHMADHUBABU': 83,
      'SSMANYAN': 76,
      'SUBRAHMANYAM': 76,
      'SSUBRAHMANYAM': 76,
      'YMKRISHNA': 62,
      'MURALIKRISHNA': 62,
      'YMURALIKRISHNA': 62,
      'IDASARADHI': 3,
      'GDASARADHI': 3,
      'NSBABU': 50,
      'SWARNABABU': 50,
      'NSWARNABABU': 50,
      'MSKUMARI': 87,
      'MSIVAKUMARI': 87,
      'KRMREDDY': 6,
      'VVPKUMAR': 9,
      'VVPAVANKUMAR': 9,
      'KVSURESH': 34,
      'KNARESH': 58,
      'JVKUMAR': 23,
      'JVINAYKUMAR': 23,
      'RSNAIK': 89,
      'SAIDANAIK': 89,
      'RSAIDANAIK': 89,
      'ELNRAO': 114,
      'YSRIKANTH': 51,
      'BPKUMAR': 40,
      'BPAVANKUMAR': 40,
      'NRCREDDY': 26,
      'SKKHASIM': 30,
      'MVRREDDY': 111,
      'MVRAMAREDDY': 111,
      'LPKUMAR': 15,
      'VUMADEVI': 85,
      'KSPARVATHI': 88,
      'SIVAPARVATHI': 88,
      'KSIVAPARVATHI': 88,
      'PRMKHAN': 19,
      'PRMALIKHAN': 19,
      'BRKUMAR': 68,
      'BRAJAKUMAR': 68,
      'BSURESH': 47,
      'BRKREDDY': 12,
      'MNRAJU': 36,
      'NAGARAJU': 36,
      'MNAGARAJU': 36,
      'TRSREDDY': 5,
      'SKJHA': 82,
      'GVRAJULU': 75,
      'GVARADARAJULU': 75,
      'KKREDDY': 54,
      'KOTIREDDY': 54,
      'KKOTIREDDY': 54,
      'KRAMANAIAH': 2,
      'MSARAJU': 104,
      'MSRINIVASULU': 8,
      'NKKUMAR': 61,
      'NKISHANKUMAR': 61,
      'TSHARSHA': 64,
      'TSRIHARSHA': 64,
      'AVREDDY': 78,
      'AVENKIREDDY': 78,
      'PRKUMAR': 79,
      'PRAVIKUMAR': 79,
      'KVRRAO': 10,
      'RAMANARAO': 10,
      'KVRAMANARAO': 10,
      'GSHIVAN': 101,
      'SVSRKRISHNA': 22,
      'MVNREDDY': 102,
      'MVSNREDDY': 102,
      'MVSNAGIREDDY': 102
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
    // 21-10-26 WEDNESDAY (Pages 88 & 89)
    // ==========================================
    {
      date: '2026-10-21',
      page_number: 88,
      entries: [
        // Page 88
        { staff_names: ['N. VENKATESH'], train_out: '17253', coach_out: 'AC+SL', train_return: '17252', coach_return: 'AC+SL' },
        { staff_names: ['B.P. SINGH'], train_out: '17239', coach_out: 'AC+2S', train_return: '17240', coach_return: 'AC+2S' },
        { staff_names: ['T.K. RAO'], train_out: '17646', coach_out: 'AC+SL', train_return: '12796', coach_return: 'AC+2S' },
        { staff_names: ['SK. M. BASHA'], train_out: '12805', coach_out: 'AC D1-D2', train_return: '12806', coach_return: 'AC D1-D2' },
        { staff_names: ['KVB SANKAR'], train_out: '12795', coach_out: 'AC+2S', train_return: '17645', coach_return: 'AC+SL' },
        { staff_names: ['V.S. RAO'], train_out: '17251', coach_out: 'AC+SL', train_return: '17254', coach_return: 'AC+SL' },
        { staff_names: ['K.K. SINGH'], train_out: '17281', coach_out: '2S', train_return: '17282', coach_return: '2S' },
        { staff_names: ['BVS REDDY'], train_out: '17261', coach_out: 'AC', train_return: '12733', coach_return: 'COR-1' },
        { staff_names: ['EV RAMANAMMA'], train_out: '17261', coach_out: 'SL', train_return: '17262', coach_return: 'SL' },
        { staff_names: ['M.N. RAO'], train_out: '20629', coach_out: 'AC', train_return: '12733', coach_return: 'COR-2' },
        { staff_names: ['K. GOPI'], train_out: '20629', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['S. NAGALINGAPPA'], train_out: '17225', coach_out: 'AC', train_return: '17226', coach_return: 'AC' },
        { staff_names: ['M. SURESH'], train_out: '17225', coach_out: 'SL', train_return: '17226', coach_return: 'SL' },
        { staff_names: ['CH. R. BABU'], train_out: '18047', coach_out: 'AC', train_return: '18048', coach_return: 'AC' },
        { staff_names: ['K.K. KUMAR'], train_out: '18047', coach_out: 'SL', train_return: '18048', coach_return: 'SL' },
        { staff_names: ['D.K. BASHA'], train_out: '17626', coach_out: 'AC+SL', train_return: '17625', coach_return: 'AC+SL' },
        { staff_names: ['RNR NAIK'], train_out: '17626', coach_out: 'SL', train_return: '17625', coach_return: 'SL' },
        // Page 89
        { staff_names: ['BPR KUMAR'], train_out: '12604', coach_out: 'AC', train_return: '12603', coach_return: 'AC' },
        { staff_names: ['D. ANVESH'], train_out: '12604', coach_out: 'S1-S5', train_return: '12603', coach_return: 'S6-S10' },
        { staff_names: ['B.V. RAO'], train_out: '12734', coach_out: 'COR-1', train_return: '20630', coach_return: 'AC' },
        { staff_names: ['D. VANIL'], train_out: '12734', coach_out: 'COR-2', train_return: '17262', coach_return: 'SL' },
        { staff_names: ['S.V.S. KUMAR'], train_out: '12734', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['VA CHAKRAVARTHY'], train_out: '17243', coach_out: 'AC+SL', train_return: '17244', coach_return: 'AC+SL' },
        { staff_names: ['O. ANIL'], train_out: '17243', coach_out: 'SL', train_return: '17244', coach_return: 'SL' },
        { staff_names: ['A.G. KRISHNA'], train_out: '22882', coach_out: 'AC+SL', train_return: '22881', coach_return: 'AC+SL' },
        { staff_names: ['T.A. RAO'], train_out: '17221', coach_out: 'AC+SL', train_return: '17222', coach_return: 'AC+SL' },
        { staff_names: ['SANJAY'], train_out: '17069', coach_out: 'AC+SL', train_return: '17262', coach_return: 'SL' },
        { staff_names: ['P.B. KRISHNA'], train_out: '07227', coach_out: 'AC+SL', train_return: '07228', coach_return: 'AC+SL' }
      ]
    },

    // ==========================================
    // 22-10-26 THURSDAY (Pages 90 & 91)
    // ==========================================
    {
      date: '2026-10-22',
      page_number: 90,
      entries: [
        // Page 90
        { staff_names: ['S. SRINU'], train_out: '17253', coach_out: 'AC+SL', train_return: '17252', coach_return: 'AC+SL' },
        { staff_names: ['D. RAKESH'], train_out: '17239', coach_out: 'AC+2S', train_return: '17240', coach_return: 'AC+2S' },
        { staff_names: ['T. SIVA KUMAR'], train_out: '17646', coach_out: 'AC+SL', train_return: '12796', coach_return: 'AC+2S' },
        { staff_names: ['M. VENKATESWARLU'], train_out: '12805', coach_out: 'AC D1-D2', train_return: '12806', coach_return: 'AC D1-D2' },
        { staff_names: ['Y.K. BABU'], train_out: '12795', coach_out: 'AC+2S', train_return: '17645', coach_return: 'AC+SL' },
        { staff_names: ['K.D. RAO'], train_out: '17251', coach_out: 'AC+SL', train_return: '17254', coach_return: 'AC+SL' },
        { staff_names: ['P.K. MOHAN'], train_out: '17281', coach_out: '2S', train_return: '17282', coach_return: '2S' },
        { staff_names: ['S.P. RAO'], train_out: '17261', coach_out: 'AC', train_return: '12733', coach_return: 'COR-1' },
        { staff_names: ['V.S. CHANDRIKA'], train_out: '17261', coach_out: 'S1-S5', train_return: '17262', coach_return: 'S1-S5' },
        { staff_names: ['B.K. KUMARI'], train_out: '17261', coach_out: 'S10-S14', train_return: '17262', coach_return: 'S10-S14' },
        { staff_names: ['VAN REDDY'], train_out: '20629', coach_out: 'AC', train_return: '12733', coach_return: 'COR-2' },
        { staff_names: ['PVS RAO'], train_out: '20629', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['M. KESHAVULU'], train_out: '17225', coach_out: 'AC', train_return: '17226', coach_return: 'AC' },
        { staff_names: ['U. RAMA KRISHNA'], train_out: '17225', coach_out: 'SL', train_return: '17226', coach_return: 'SL' },
        { staff_names: ['K.S. RAO'], train_out: '17225', coach_out: 'AC', train_return: '18048', coach_return: 'AC' },
        { staff_names: ['SH. M. BABU'], train_out: '17225', coach_out: 'SL', train_return: '18048', coach_return: 'SL' },
        { staff_names: ['S.S. MANYAN'], train_out: '17626', coach_out: 'AC+SL', train_return: '17625', coach_return: 'AC+SL' },
        { staff_names: ['Y.M. KRISHNA'], train_out: '17626', coach_out: 'SL', train_return: '17625', coach_return: 'SL' },
        // Page 91
        { staff_names: ['I. DASARADHI'], train_out: '12604', coach_out: 'AC', train_return: '12603', coach_return: 'AC' },
        { staff_names: ['N.S. BABU'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL' },
        { staff_names: ['M.S. KUMARI'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL' },
        { staff_names: ['KRM REDDY'], train_out: '12734', coach_out: 'COR-1', train_return: '20630', coach_return: 'AC' },
        { staff_names: ['VVP KUMAR'], train_out: '12734', coach_out: 'COR-2', train_return: '17262', coach_return: 'SL' },
        { staff_names: ['K.V. SURESH'], train_out: '12734', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['K. NARESH'], train_out: '17243', coach_out: 'AC+SL', train_return: '17244', coach_return: 'AC+SL' },
        { staff_names: ['T.K. RAO'], train_out: '17243', coach_out: 'SL', train_return: '17244', coach_return: 'SL' },
        { staff_names: ['J.V. KUMAR'], train_out: '12755', coach_out: 'AC+SL', train_return: '17625', coach_return: 'AC+SL' },
        { staff_names: ['R.S. NAIK'], train_out: '12604', coach_out: 'SL', train_return: '16357', coach_return: 'SL' },
        { staff_names: ['ELN RAO'], train_out: '07001', coach_out: 'AC+SL', train_return: '17070', coach_return: 'AC+SL' },
        { staff_names: ['B.P. SINGH'], train_out: '07001', coach_out: 'SL', train_return: '07002', coach_return: 'AC+SL' },
        { staff_names: ['Y. SRIKANTH'], train_out: '07424', coach_out: 'AC+SL', train_return: '20630', coach_return: 'SL', notes: '2:55 AM (FRIDAY/23)' }
      ]
    },

    // ==========================================
    // 23-10-26 FRIDAY (Pages 92 & 93)
    // ==========================================
    {
      date: '2026-10-23',
      page_number: 92,
      entries: [
        // Page 92
        { staff_names: ['B.P. KUMAR'], train_out: '17253', coach_out: 'AC+SL', train_return: '17252', coach_return: 'AC+SL' },
        { staff_names: ['NRC REDDY'], train_out: '17239', coach_out: 'AC+2S', train_return: '17240', coach_return: 'AC+2S' },
        { staff_names: ['N. VENKATESH'], train_out: '17646', coach_out: 'AC+SL', train_return: '12796', coach_return: 'AC+2S' },
        { staff_names: ['KVB SANKAR'], train_out: '12805', coach_out: 'AC D1-D2', train_return: '12806', coach_return: 'AC D1-D2' },
        { staff_names: ['D. ANVESH'], train_out: '12795', coach_out: 'AC+2S', train_return: '17645', coach_return: 'AC+SL' },
        { staff_names: ['SK. KHASIM'], train_out: '17251', coach_out: 'AC+SL', train_return: '17254', coach_return: 'AC+SL' },
        { staff_names: ['M.V.R. REDDY'], train_out: '17281', coach_out: '2S', train_return: '17282', coach_return: '2S' },
        { staff_names: ['L.P. KUMAR'], train_out: '17261', coach_out: 'AC', train_return: '12733', coach_return: 'COR-2' },
        { staff_names: ['V. UMA DEVI'], train_out: '17261', coach_out: 'S1-S5', train_return: '17262', coach_return: 'S1-S5' },
        { staff_names: ['K.S. PARVATHI'], train_out: '17261', coach_out: 'S10-S14', train_return: '17262', coach_return: 'S10-S14' },
        { staff_names: ['PRM KHAN'], train_out: '20629', coach_out: 'AC', train_return: '12733', coach_return: 'COR-1' },
        { staff_names: ['B.R. KUMAR'], train_out: '20629', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['B. SURESH'], train_out: '20629', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['BRK REDDY'], train_out: '17225', coach_out: 'AC', train_return: '17226', coach_return: 'AC' },
        { staff_names: ['M.N. RAJU'], train_out: '17225', coach_out: 'SL', train_return: '17226', coach_return: 'SL' },
        { staff_names: ['TRS REDDY'], train_out: '18047', coach_out: 'AC', train_return: '17226', coach_return: 'AC' },
        { staff_names: ['SK. JHA'], train_out: '18047', coach_out: 'SL', train_return: '17226', coach_return: 'SL' },
        { staff_names: ['G.V. RAJULU'], train_out: '17626', coach_out: 'AC+SL', train_return: '17625', coach_return: 'AC+SL' },
        { staff_names: ['K.K. REDDY'], train_out: '17626', coach_out: 'SL', train_return: '17625', coach_return: 'SL' },
        // Page 93
        { staff_names: ['K. RAMANAIAH'], train_out: '12604', coach_out: 'AC', train_return: '12603', coach_return: 'AC' },
        { staff_names: ['P.B. KRISHNA'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL' },
        { staff_names: ['MSA RAJU'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL' },
        { staff_names: ['M.N. RAO'], train_out: '12734', coach_out: 'COR-2', train_return: '20630', coach_return: 'AC' },
        { staff_names: ['M. SRINIVASULU'], train_out: '12734', coach_out: 'COR-1', train_return: '17262', coach_return: 'SL' },
        { staff_names: ['N.K. KUMAR'], train_out: '12734', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['T. SRIHARSHA'], train_out: '17243', coach_out: 'AC+SL', train_return: '17244', coach_return: 'AC+SL' },
        { staff_names: ['A.V. REDDY'], train_out: '17243', coach_out: 'SL', train_return: '17244', coach_return: 'SL' },
        { staff_names: ['P.R. KUMAR'], train_out: '17607', coach_out: 'AC+SL', train_return: '17608', coach_return: 'AC+SL' },
        { staff_names: ['K.V.R. RAO'], train_out: '18063', coach_out: 'AC', train_return: '18064', coach_return: 'AC' },
        { staff_names: ['G. SHIVAN'], train_out: '18063', coach_out: 'SL', train_return: '18064', coach_return: 'SL' },
        { staff_names: ['SVSR KRISHNA'], train_out: '17231', coach_out: 'AC+SL', train_return: '17232', coach_return: 'AC+SL' },
        { staff_names: ['MVN REDDY'], train_out: '07191', coach_out: 'AC+SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['J.V. KUMAR'], train_out: '07535', coach_out: 'AC+SL', train_return: '12603', coach_return: 'SL' }
      ]
    }
  ];

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

    // 2. Clear old muster and overrides for staff in this day's entries
    for (const item of entries) {
      const trainOut = item.train_out ? item.train_out.trim() : '';
      const trainRet = item.train_return ? item.train_return.trim() : '';
      const coachOut = item.coach_out ? item.coach_out.trim() : '';
      const coachRet = item.coach_return ? item.coach_return.trim() : '';
      const dutyLabel = (item as any).duty_label || (trainOut ? (trainRet ? `${trainOut} / ${trainRet}` : trainOut) : 'DUTY');
      const notes = (item as any).notes || '';
      const isLeave = dutyLabel.toUpperCase() === 'LEAVE' || notes.toUpperCase().includes('LEAVE');

      // Insert duty_register_entry
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

        await run('INSERT INTO duty_register_staff (entry_id, staff_id) VALUES (?, ?)', [entryId, staffId]);

        const staffObj = await get('SELECT id, name, category_id FROM staff WHERE id = ?', [staffId]);

        if (isLeave) {
          await run(
            `INSERT INTO overrides (staff_id, date, status, reason, created_by)
             VALUES (?, ?, 'LEAVE', 'Daily Register: Leave', 'Daily Register')
             ON DUPLICATE KEY UPDATE status = 'LEAVE', reason = 'Daily Register: Leave'`,
            [staffId, date]
          ).catch(async () => {
            await run(
              `INSERT OR REPLACE INTO overrides (staff_id, date, status, reason, created_by)
               VALUES (?, ?, 'LEAVE', 'Daily Register: Leave', 'Daily Register')`,
              [staffId, date]
            );
          });

          await run(
            `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by)
             VALUES (?, ?, 'LAP', 'Leave as per Daily Summary Register', 'Admin')
             ON DUPLICATE KEY UPDATE code = 'LAP', remarks = 'Leave as per Daily Summary Register'`,
            [staffId, date]
          ).catch(async () => {
            await run(
              `INSERT OR REPLACE INTO muster_records (staff_id, date, code, remarks, updated_by)
               VALUES (?, ?, 'LAP', 'Leave as per Daily Summary Register', 'Admin')`,
              [staffId, date]
            );
          });

          await run("UPDATE ta_approvals SET status = 'REJECTED', claim_amount = 0, remarks = 'On Leave as per Daily Summary' WHERE staff_id = ? AND duty_date = ?", [staffId, date]);
          await run("DELETE FROM ta_entries WHERE staff_id = ? AND duty_date = ?", [staffId, date]);
          console.log(`  Staff [${staffId}] ${staffObj.name}: MARKED LEAVE (No TA)`);
        } else {
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
  }

  // Regenerate TA for all staff for October 2026 to ensure 100% synchronization
  console.log('\n--- Regenerating TA claims for October 2026 ---');
  const dbObj = { run, get, all };
  await generatePendingTaClaimsForMonth(dbObj, 2026, 10);
  console.log('TA claims for October 2026 refreshed and synchronized successfully!');

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error applying daily summary for Oct 21-23:', err);
  process.exit(1);
});
