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
      'KATTANARESH': 58,
      'KNARESH': 58,
      'NARESH': 58,
      'MVEERANJANEYULU': 112,
      'MVANJANEYULU': 112,
      'ANJANEYULU': 112,
      'RAMAVATHUSAIDANAIK': 89,
      'RSAIDANAIK': 89,
      'SAIDANAIK': 89,
      'RSNAIK': 89,
      'RNRNAIK': 25,
      'YMURALIKRISHNA': 62,
      'YMKRISHNA': 62,
      'MURALIKRISHNA': 62,
      'URAMAKRISHNA': 37,
      'RAMAKRISHNA': 37,
      'DRAMAKRISHNA': 37,
      'SUVVADASRINU': 41,
      'SSRINU': 41,
      'SRINU': 41,
      'NKISHANKUMAR': 61,
      'KISHANKUMAR': 61,
      'TRAJASHEKARREDDY': 5,
      'TRSREDDY': 5,
      'RAJASHEKARREDDY': 5,
      'VSATYACHANDRIKA': 86,
      'VSCHANDRIKA': 86,
      'CHANDRIKA': 86,
      'KSIVAPARVATHI': 88,
      'SIVAPARVATHI': 88,
      'KSPARVATHI': 88,
      'VVPAVANKUMAR': 9,
      'VVPKUMAR': 9,
      'PATCHOLARAVIKUMAR': 79,
      'PRAVIKUMAR': 79,
      'PRKUMAR': 79,
      'RAVIKUMAR': 79,
      'YADALASRIKANTH': 51,
      'YSRIKANTH': 51,
      'SRIKANTH': 51,
      'KATTARAMANAIAH': 2,
      'KRAMANAIAH': 2,
      'RAMANAIAH': 2,
      'BSURESH': 47,
      'SURESH': 47,
      'SPRAKASHKUMAR': 16,
      'SPRAKASARAO': 16,
      'PRAKASARAO': 16,
      'SKKHASIM': 30,
      'KHASIM': 30,
      'JANGAMVINAYKUMAR': 23,
      'JVINAYKUMAR': 23,
      'JVKUMAR': 23,
      'VINAYKUMAR': 23,
      'DARAANVESH': 72,
      'DANVESH': 72,
      'ANVESH': 72,
      'UBALAJOJI': 39,
      'UBJOJI': 39,
      'BALAJOJI': 39,
      'ELNARSIMHARAO': 114,
      'ELNRAO': 114,
      'MVRREDDY': 111,
      'MVRAMAREDDY': 111,
      'SKSALEEM': 11,
      'SALEEM': 11,
      'PATHANRMDALIKHAN': 19,
      'PRMALIKHAN': 19,
      'PRMKHAN': 19,
      'KVBHAVANISHANKER': 44,
      'KVBSANKAR': 44,
      'BHAVANISHANKAR': 44,
      'GVARADARAJULU': 75,
      'GVRAJULU': 75,
      'VARADARAJULU': 75,
      'NRAVICHANDRAREDDY': 26,
      'NRCREDDY': 26,
      'RAVICHANDRAREDDY': 26,
      'NARESHCHANDMEENA': 107,
      'NCMEENA': 107,
      'BPKUMAR': 40,
      'BPAVANKUMAR': 40,
      'PAVANKUMAR': 40,
      'MNRAJU': 36,
      'MNAGARAJU': 36,
      'NAGARAJU': 36,
      'DVANIL': 59,
      'DVANILKUMAR': 59,
      'VANIL': 59,
      'KKREDDY': 54,
      'KKOTIREDDY': 54,
      'KOTIREDDY': 54,
      'SKJHA': 82,
      'JHA': 82,
      'SANJAY': 106,
      'SANJAYKUMAR': 106,
      'OANIL': 80,
      'ANIL': 80,
      'BPRKUMAR': 4,
      'BPRAJAKUMAR': 4,
      'RAJAKUMAR': 4,
      'SHTULASI': 118,
      'SHYMATULASI': 118,
      'TULASI': 118,
      'MSRINIVASULU': 8,
      'SRINIVASULU': 8,
      'AVREDDY': 78,
      'AVENKIREDDY': 78,
      'VENKIREDDY': 78,
      'TSHARSHA': 64,
      'TSRIHARSHA': 64,
      'SRIHARSHA': 64,
      'KSRAO': 1,
      'KAKISRINIVASARAO': 1,
      'SKMBASHA': 46,
      'SKMASTANBASHA': 46,
      'MASTANBASHA': 46,
      'LPKUMAR': 15,
      'NSBABU': 50,
      'NSWARNABABU': 50,
      'SWARNABABU': 50,
      'SKKARIMULLA': 32,
      'SKKARIMULLAH': 32,
      'KARIMULLA': 32,
      'NVSRKRISHNA': 22,
      'SVSRKRISHNA': 22,
      'BRKREDDY': 12,
      'TARAO': 110,
      'TANKAMMARAO': 110,
      'ANKAMMARAO': 110,
      'BPSINGH': 117,
      'SINGH': 117,
      'KVRRAO': 10,
      'KVRAMANARAO': 10,
      'RAMANARAO': 10,
      'KURRAO': 10,
      'RBANGARAIAH': 18,
      'BANGARAIAH': 18,
      'TSKUMAR': 43,
      'TSIVAKUMAR': 43,
      'SIVAKUMAR': 43,
      'PGRAO': 53,
      'PGOPALARAO': 53,
      'GOPALARAO': 53,
      'VSRAO': 115,
      'VSRINIVASARAO': 115,
      'SRINIVASARAO': 115,
      'MVSNREDDY': 102,
      'MVSNAGIREDDY': 102,
      'NAGIREDDY': 102,
      'BRMEENA': 109,
      'GSHIVAN': 101,
      'SHIVAN': 101,
      'VACHAKRAVARTHY': 56,
      'VACHAKRAVARTHI': 56,
      'CHAKRAVARTHY': 56,
      'BVREDDY': 103,
      'BVENKATREDDY': 103,
      'VENKATREDDY': 103,
      'TKRAO': 108,
      'TKANTHARAO': 108,
      'KANTHARAO': 108,
      'IDASARADHI': 3,
      'DASARADHI': 3,
      'EVRAMANAMMA': 91,
      'RAMANAMMA': 91,
      'CHRBABU': 7,
      'CHRAMESHBABU': 7,
      'RAMESHBABU': 7,
      'DKBASHA': 77,
      'DKHADERBASH': 77,
      'KHADERBASHA': 77,
      'MNRAO': 21,
      'MVENKATESWARLU': 45,
      'VENKATESWARLU': 45,
      'PBKRISHNA': 28,
      'PBALAKRISHNA': 28,
      'BALAKRISHNA': 28,
      'DRAKESH': 100,
      'RAKESH': 100,
      'KDRAO': 31,
      'KDURGARAO': 31,
      'DURGARAO': 31,
      'KGOPI': 70,
      'GOPI': 70,
      'KBRAO': 105,
      'DVRAO': 17,
      'BVRAO': 17,
      'NVENKATESH': 42,
      'VENKATESH': 42,
      'YKBABU': 73,
      'YKORNELUBABU': 73,
      'KORNELUBABU': 73,
      'BVSREDDY': 24
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
    // 12-10-26 MONDAY (Pages 70 & 71)
    // ==========================================
    {
      date: '2026-10-12',
      page_number: 70,
      entries: [
        // Page 70 (Day)
        { staff_names: ['KATTA NARESH'], train_out: '17253', coach_out: 'AC+SL', train_return: '17252', coach_return: 'AC+SL' },
        { staff_names: ['M. VEER ANJANEYULU'], train_out: '17239', coach_out: 'AC+2S', train_return: '17240', coach_return: 'AC+2S' },
        { staff_names: ['RAMAVATHU SAIDA NAIK'], train_out: '17646', coach_out: 'AC+SL', train_return: '12796', coach_return: 'AC+2S', notes: 'Return 12796 / 12805' },
        { staff_names: ['Y. MURALI KRISHNA'], train_out: '12805', coach_out: 'AC+2S', train_return: '12806', coach_return: 'AC+2S' },
        { staff_names: ['U. RAMA KRISHNA'], train_out: '12795', coach_out: 'AC+2S', train_return: '17645', coach_return: 'AC+SL' },
        { staff_names: ['SUVVADA SRINU'], train_out: '17251', coach_out: 'AC+SL', train_return: '17254', coach_return: 'AC+SL' },
        { staff_names: ['N. KISHAN KUMAR'], train_out: '17281', coach_out: '2S', train_return: '17282', coach_return: '2S', notes: 'BVS Reddy replaced' },
        { staff_names: ['T. RAJA SHEKAR REDDY'], train_out: '17261', coach_out: 'COR', train_return: '12733', coach_return: 'II nd COR' },
        { staff_names: ['V. SATYA CHANDRIKA'], train_out: '17261', coach_out: 'SL', train_return: '17262', coach_return: 'SL' },
        { staff_names: ['K. SIVA PARVATHI'], train_out: '17261', coach_out: 'SL', train_return: '17262', coach_return: 'SL' },
        { staff_names: ['V. V. PAVAN KUMAR'], train_out: '20629', coach_out: 'COR', train_return: '12733', coach_return: 'I st COR' },
        { staff_names: ['PATCHOLA RAVI KUMAR'], train_out: '20629', coach_out: 'SL', train_return: '12733', coach_return: 'SL' },
        { staff_names: ['YADALA SRIKANTH'], train_out: '20629', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['KATTA RAMANAIAH'], train_out: '17225', coach_out: 'I st COR', train_return: '17226', coach_return: 'COR' },
        { staff_names: ['B. SURESH'], train_out: '17225', coach_out: 'SL', train_return: '17226', coach_return: 'SL' },
        { staff_names: ['S. PRAKASH KUMAR'], train_out: '17225', coach_out: 'II nd COR', train_return: '18048', coach_return: 'COR' },
        { staff_names: ['SK. KHASIM'], train_out: '17225', coach_out: 'SL', train_return: '18048', coach_return: 'SL' },
        { staff_names: ['JANGAM VINAY KUMAR'], train_out: '17626', coach_out: 'AC+SL', train_return: '17625', coach_return: 'AC+SL' },
        { staff_names: ['DARA ANVESH'], train_out: '17626', coach_out: 'SL', train_return: '17645', coach_return: 'SL' },

        // Page 71 (Night)
        { staff_names: ['U. BALA JOJI'], train_out: '12604', coach_out: 'COR', train_return: '12603', coach_return: 'COR' },
        { staff_names: ['E.L. NARSIMHA RAO'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL' },
        { staff_names: ['M.V.R. REDDY'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL' },
        { staff_names: ['SK. SALEEM'], train_out: '12734', coach_out: 'II nd COR', train_return: '20630', coach_return: 'COR' },
        { staff_names: ['PATHAN. RMD. ALI KHAN'], train_out: '12734', coach_out: 'I st COR', train_return: '17262', coach_return: 'COR' },
        { staff_names: ['K.V. BHAVANI SHANKER'], train_out: '12734', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['G. VARADA RAJULU'], train_out: '17243', coach_out: 'AC+SL', train_return: '17244', coach_return: 'AC+SL' },
        { staff_names: ['N. RAVI CHANDRA REDDY'], train_out: '17243', coach_out: 'SL', train_return: '17244', coach_return: 'SL' },
        { staff_names: ['NARESH CHAND MEENA'], train_out: '17637', coach_out: 'AC+SL', train_return: '17638', coach_return: 'AC+SL', notes: 'Early hours of Tuesday (BZA-RU-GNT)' }
      ]
    },

    // ==========================================
    // 13-10-26 TUESDAY (Pages 72 & 73)
    // ==========================================
    {
      date: '2026-10-13',
      page_number: 72,
      entries: [
        // Page 72 (Day)
        { staff_names: ['B.P. KUMAR'], train_out: '17253', coach_out: 'AC+SL', train_return: '17252', coach_return: 'AC+SL' },
        { staff_names: ['M.N. RAJU'], train_out: '17239', coach_out: 'AC+2S', train_return: '17240', coach_return: 'AC+2S' },
        { staff_names: ['D. VANIL'], train_out: '17646', coach_out: 'AC+SL', train_return: '12796', coach_return: 'AC+2S' },
        { staff_names: ['K.K. REDDY'], train_out: '12805', coach_out: 'AC+2S', train_return: '12806', coach_return: 'AC+2S' },
        { staff_names: ['SK JHA'], train_out: '12795', coach_out: 'AC+2S', train_return: '17645', coach_return: 'AC+SL' },
        { staff_names: ['SANJAY'], train_out: '17251', coach_out: 'AC+SL', train_return: '17254', coach_return: 'AC+SL' },
        { staff_names: ['O. ANIL'], train_out: '17281', coach_out: '2S', train_return: '17282', coach_return: '2S' },
        { staff_names: ['B.P.R. KUMAR'], train_out: '17261', coach_out: 'AC', train_return: '12733', coach_return: 'COR-2' },
        { staff_names: ['SH. TULASI'], train_out: '17261', coach_out: 'SL', train_return: '17262', coach_return: 'S1-S5' },
        { staff_names: ['M. SRINIVASULU'], train_out: '20629', coach_out: 'AC', train_return: '12733', coach_return: 'COR-1' },
        { staff_names: ['A.V. REDDY'], train_out: '20629', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['T. S. HARSHA'], train_out: '20629', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['K.S. RAO'], train_out: '17225', coach_out: 'AC', train_return: '17226', coach_return: 'AC' },
        { staff_names: ['SK M BASHA'], train_out: '17225', coach_out: 'SL', train_return: '17226', coach_return: 'SL' },
        { staff_names: ['L.P. KUMAR'], train_out: '18047', coach_out: 'AC', train_return: '17226', coach_return: 'AC' },
        { staff_names: ['N.S. BABU'], train_out: '18047', coach_out: 'SL', train_return: '17226', coach_return: 'SL' },
        { staff_names: ['SK KARIMULLA'], train_out: '17626', coach_out: 'AC+SL', train_return: '17625', coach_return: 'AC+SL' },
        { staff_names: ['NVSR KRISHNA'], train_out: '17626', coach_out: 'SL', train_return: '17625', coach_return: 'SL' },

        // Page 73 (Night)
        { staff_names: ['BRK REDDY'], train_out: '12604', coach_out: 'AC', train_return: '12603', coach_return: 'AC' },
        { staff_names: ['T.A. RAO'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL' },
        { staff_names: ['B.P. SINGH'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL' },
        { staff_names: ['KVR RAO'], train_out: '12734', coach_out: 'COR-1', train_return: '20630', coach_return: 'AC' },
        { staff_names: ['R. BANGARAIAH'], train_out: '12734', coach_out: 'COR-2', train_return: '17262', coach_return: 'COR' },
        { staff_names: ['T. S. KUMAR'], train_out: '12734', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['RNR NAIK'], train_out: '17243', coach_out: 'AC+SL', train_return: '17244', coach_return: 'AC+SL' },
        { staff_names: ['P.G. RAO'], train_out: '17243', coach_out: 'SL', train_return: '17244', coach_return: 'SL' },
        { staff_names: ['V. S. RAO'], train_out: '17041', coach_out: 'SL', train_return: '17042', coach_return: 'SL' },
        { staff_names: ['M.V.S.N. REDDY'], train_out: '17017', coach_out: 'AC+SL', train_return: '17018', coach_return: 'AC+SL' },
        { staff_names: ['BR MEENA'], train_out: '08063', coach_out: 'AC+SL', train_return: '08064', coach_return: 'AC+SL' },
        { staff_names: ['G. SHIVAN'], train_out: '07227', coach_out: 'AC+SL', train_return: '17262', coach_return: 'S10-S14' }
      ]
    },

    // ==========================================
    // 14-10-26 WEDNESDAY (Pages 74 & 75)
    // ==========================================
    {
      date: '2026-10-14',
      page_number: 74,
      entries: [
        // Page 74 (Day)
        { staff_names: ['V.A. CHAKRAVARTHY'], train_out: '17253', coach_out: 'AC+SL', train_return: '17252', coach_return: 'AC+SL' },
        { staff_names: ['B.V. REDDY'], train_out: '17239', coach_out: 'AC+2S', train_return: '17240', coach_return: 'AC+2S' },
        { staff_names: ['K. NARESH'], train_out: '17646', coach_out: 'AC+SL', train_return: '12796', coach_return: 'AC+2S' },
        { staff_names: ['T. K. RAO'], train_out: '12805', coach_out: 'AC+2S', train_return: '12806', coach_return: 'AC+2S' },
        { staff_names: ['M.V.R. REDDY'], train_out: '12795', coach_out: 'AC+2S', train_return: '17645', coach_return: 'AC+SL' },
        { staff_names: ['U.B. JOJI'], train_out: '17251', coach_out: 'AC+SL', train_return: '17254', coach_return: 'AC+SL' },
        { staff_names: ['P. R. KUMAR'], train_out: '17281', coach_out: '2S', train_return: '17282', coach_return: '2S' },
        { staff_names: ['I. DASARADHI'], train_out: '17261', coach_out: 'AC', train_return: '12733', coach_return: 'COR-1' },
        { staff_names: ['E.V. RAMANAMMA'], train_out: '17261', coach_out: 'SL', train_return: '17262', coach_return: 'SL' },
        { staff_names: ['CH. R. BABU'], train_out: '20629', coach_out: 'AC', train_return: '12733', coach_return: 'COR-2' },
        { staff_names: ['D. K. BASHA'], train_out: '20629', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['M.N. RAO'], train_out: '17225', coach_out: 'AC', train_return: '17226', coach_return: 'AC' },
        { staff_names: ['M. VENKATESWARLU'], train_out: '17225', coach_out: 'SL', train_return: '17226', coach_return: 'SL' },
        { staff_names: ['P.B. KRISHNA'], train_out: '18047', coach_out: 'AC', train_return: '18048', coach_return: 'AC' },
        { staff_names: ['D. RAKESH'], train_out: '18047', coach_out: 'SL', train_return: '18048', coach_return: 'SL' },
        { staff_names: ['K. D. RAO'], train_out: '17626', coach_out: 'AC+SL', train_return: '17625', coach_return: 'AC+SL' },
        { staff_names: ['K. GOPI'], train_out: '17626', coach_out: 'SL', train_return: '17625', coach_return: 'SL' },

        // Page 75 (Night)
        { staff_names: ['SK. SALEEM'], train_out: '12604', coach_out: 'AC', train_return: '12603', coach_return: 'AC' },
        { staff_names: ['U. RAMA KRISHNA'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL' },
        { staff_names: ['K.B. RAO'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL' },
        { staff_names: ['V.V.P. KUMAR'], train_out: '12734', coach_out: 'COR-1', train_return: '20630', coach_return: 'AC' },
        { staff_names: ['B.V. RAO'], train_out: '12734', coach_out: 'COR-2', train_return: '17262', coach_return: 'COR' },
        { staff_names: ['N. VENKATESH'], train_out: '12734', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['Y.K. BABU'], train_out: '17243', coach_out: 'AC+SL', train_return: '17244', coach_return: 'AC+SL' },
        { staff_names: ['BVS REDDY'], train_out: '17243', coach_out: 'SL', train_return: '17244', coach_return: 'SL' },
        { staff_names: ['R. S. NAIK'], train_out: '22882', coach_out: 'AC+SL', train_return: '22881', coach_return: 'AC+SL' },
        { staff_names: ['N. C. MEENA'], train_out: '17221', coach_out: 'AC+SL', train_return: '17222', coach_return: 'AC+SL' },
        { staff_names: ['M. V. ANJANEYULU'], train_out: '17069', coach_out: 'AC+SL', train_return: '17262', coach_return: 'SL' }
      ]
    }
  ];

  const allWorkedStaffByDate: Record<string, Set<number>> = {
    '2026-10-12': new Set(),
    '2026-10-13': new Set(),
    '2026-10-14': new Set()
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
  const OUTWARD_TRAINS = [
    '17253', '17239', '17646', '12805', '12795', '17251', '17281',
    '17261', '20629', '17225', '18047', '17626', '12604', '12734', '17243'
  ];

  console.log('\n======================================================');
  console.log('IDENTIFYING ABSENT EMPLOYEES (12-14 OCT)');
  console.log('======================================================');

  const links = await all(`SELECT * FROM links WHERE status != 'draft' OR status IS NULL`);
  const absentList: { date: string; staff: any; link: any; reason: string }[] = [];

  for (const dateStr of ['2026-10-12', '2026-10-13', '2026-10-14']) {
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

  console.log(`\nIdentified ${absentList.length} Absent staff instances on Oct 12-14:`);
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
  console.error('Fatal error applying daily summary for Oct 12-14:', err);
  process.exit(1);
});
