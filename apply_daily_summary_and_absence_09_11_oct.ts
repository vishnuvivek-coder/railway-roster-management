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
      'KARNAKOTIREDDY': 54,
      'KKREDDY': 54,
      'KKOTIREDDY': 54,
      'KOTIREDDY': 54,
      'BONDURIPAVANKUMAR': 40,
      'BANDORIPAVANKUMAR': 40,
      'BOLUMURIPAVANKUMAR': 40,
      'BPKUMAR': 40,
      'BPAVANKUMAR': 40,
      'PAVANKUMAR': 40,
      'JANGAMVINAYKUMAR': 23,
      'JVINAYKUMAR': 23,
      'JVKUMAR': 23,
      'VINAYKUMAR': 23,
      'YADALASRIKANTH': 51,
      'YSRIKANTH': 51,
      'SRIKANTH': 51,
      'URAMAKRISHNA': 37,
      'RAMAKRISHNA': 37,
      'KOMMANARAPUVBSHANKOR': 44,
      'KOMMANARAPUVBSHANKAR': 44,
      'KOMMANARAPUVBSHANKER': 44,
      'VBSHANKER': 44,
      'VBSHANKAR': 44,
      'KVBHAVANISHANKER': 44,
      'KVBSANKAR': 44,
      'BHAVANISHANKAR': 44,
      'KKRANTIKUMAR': 84,
      'KKRANTHIKUMAR': 84,
      'KRANTHIKUMAR': 84,
      'MSRINIVASULU': 8,
      'SRINIVASULU': 8,
      'KSIVAPARVATHI': 88,
      'SIVAPARVATHI': 88,
      'VUMADEVI': 85,
      'UMADEVI': 85,
      'BRADAKRISHNAREDDY': 12,
      'BRAMAKRISHNAREDDY': 12,
      'BRKREDDY': 12,
      'SANTOSHKUMARJHA': 82,
      'SKJHA': 82,
      'JHA': 82,
      'BELLAMRAJAKUMAR': 4,
      'BPRAJAKUMAR': 4,
      'BPRKUMAR': 4,
      'RAJAKUMAR': 4,
      'TRAJASHEKARREDDY': 5,
      'TRSREDDY': 5,
      'RAJASHEKARREDDY': 5,
      'MVEERANJANEYULU': 112,
      'MVANJANEYULU': 112,
      'ANJANEYULU': 112,
      'PATHANRMDALIKHAN': 19,
      'PRMALIKHAN': 19,
      'PRMKHAN': 19,
      'NKISHANKUMAR': 61,
      'KISHANKUMAR': 61,
      'GVARADARAJULU': 75,
      'GVRAJULU': 75,
      'VARADARAJULU': 75,
      'NRAVICHANDRAREDDY': 26,
      'NRCREDDY': 26,
      'RAVICHANDRAREDDY': 26,
      'NVENKATESH': 42,
      'VENKATESH': 42,
      'KBRAO': 105,
      'BRAHMANDAMRAO': 105,
      'KBRAHMANANDARAO': 105,
      'MSURESH': 38,
      'SURESH': 38,
      'KAKISRINIVASARAO': 1,
      'KSRAO': 1,
      'MNAGARAJU': 36,
      'MNRAJU': 36,
      'NAGARAJU': 36,
      'NSWAPNABABU': 50,
      'NSWARNABABU': 50,
      'NSBABU': 50,
      'SWARNABABU': 50,
      'AVENKIREDDY': 78,
      'AVREDDY': 78,
      'VENKIREDDY': 78,
      'SVSIVAKUMAR': 113,
      'SVSKUMAR': 113,
      'ELNRAO': 114,
      'ELNARSIMHARAO': 114,
      'VSRINIVASARAO': 115,
      'VSRINIVASRAO': 115,
      'VEMULASRINIYASRAO': 115,
      'VSRAO': 115,
      'SRINIVASARAO': 115,
      'DASARIRAKESH': 100,
      'DRAKESH': 100,
      'RAKESH': 100,
      'SANJAYKUMAR': 106,
      'SANJAYKUMARSHARMA': 106,
      'SANJAY': 106,
      'TANKAMMARAO': 110,
      'TARAO': 110,
      'ANKAMMARAO': 110,
      'UBALAJOJI': 39,
      'UBJOJI': 39,
      'BALAJOJI': 39,
      'YMURALIKRISHNA': 62,
      'YMKRISHNA': 62,
      'MURALIKRISHNA': 62,
      'TAMMINENISRIHARSHA': 64,
      'TSRIHARSHA': 64,
      'TSHARSHA': 64,
      'SRIHARSHA': 64,
      'BODIPATIVENKATREDDY': 103,
      'BVENKATREDDY': 103,
      'BVREDDY': 103,
      'VENKATREDDY': 103,
      'TSIVAKUMAR': 43,
      'TSKUMAR': 43,
      'SIVAKUMAR': 43,
      'NARESHCHANDMEENA': 107,
      'NCMEENA': 107,
      'CHRAMESHBABU': 7,
      'CHRBABU': 7,
      'RAMESHBABU': 7,
      'SHTULASI': 118,
      'SHYMATULASI': 118,
      'TULASI': 118,
      'EVRAMANAMMA': 91,
      'RAMANAMMA': 91,
      'SKSALEEM': 11,
      'SALEEM': 11,
      'KADEPALLIRAO': 31,
      'KDURGARAO': 31,
      'KDRAO': 31,
      'DURGARAO': 31,
      'VACHAKRAVARTHY': 56,
      'VACHAKRAVARTHI': 56,
      'CHAKRAVARTHY': 56,
      'RBANGARAIAH': 18,
      'BANGARAIAH': 18,
      'SKKARIMULLA': 32,
      'SKKARIMULLAH': 32,
      'KARIMULLA': 32,
      'RNRNAIK': 25,
      'RNAGESWARRAONAIK': 25,
      'PASUPULETIGOPALRAO': 53,
      'PGOPALARAO': 53,
      'PGRAO': 53,
      'GOPALARAO': 53,
      'LPRASANNAKUMAR': 15,
      'LPKUMAR': 15,
      'SUVVADASRINU': 41,
      'SSRINU': 41,
      'SRINU': 41,
      'SKMASTANBASHA': 46,
      'SKMBASHA': 46,
      'MASTANBASHA': 46,
      'MNRAO': 21,
      'MNAGESWARRAO': 21,
      'PKRISHNAMOHAN': 71,
      'KRISHNAMOHAN': 71,
      'PBALAKRISHNA': 28,
      'PBKRISHNA': 28,
      'BALAKRISHNA': 28,
      'DKHADERBASHA': 77,
      'DKHADERBASH': 77,
      'DKBASHA': 77,
      'KHADERBASHA': 77,
      'AGOUTHAMKRISHNA': 99,
      'AGKRISHNA': 99,
      'GUGULOTHUSHIVAN': 101,
      'GSHIVAN': 101,
      'SHIVAN': 101,
      'BABURAMMEENA': 109,
      'BRMEENA': 109,
      'RAMAVATHSAIDANAIK': 89,
      'RSAIDANAIK': 89,
      'RSNAIK': 89,
      'SAIDANAIK': 89,
      'MANDAVRAMAREDDY': 111,
      'MVRAMAREDDY': 111,
      'MVRREDDY': 111,
      'RAMAREDDY': 111,
      'SHMADHUBABU': 83,
      'MADHUBABU': 83,
      'DVANILKUMAR': 59,
      'DVANIL': 59,
      'VANIL': 59,
      'BHANUPRATAPSINGH': 117,
      'BPSINGH': 117,
      'SINGH': 117,
      'MSIVAKUMARI': 87,
      'SIVAKUMARI': 87,
      'KVRAMANARAO': 10,
      'KVRRAO': 10,
      'RAMANARAO': 10,
      'DEVARAPATTIANIL': 80,
      'OANIL': 80,
      'ANIL': 80,
      'INDURTHIDASARADHI': 3,
      'IDASARADHI': 3,
      'DASARADHI': 3,
      'PVSUBBARAO': 55,
      'PVSRAO': 55,
      'BVENKATESWARRAO': 17,
      'BVRAO': 17,
      'YKORNELUBABU': 73,
      'YKBABU': 73,
      'KORNELUBABU': 73,
      'SINGAMVSIVAKUMAR': 113,
      'MVSNAGIREDDY': 102,
      'MVSNREDDY': 102,
      'NAGIREDDY': 102,
      'YATHMANANDAREDDY': 20,
      'VANREDDY': 20,
      'MVENKATESWARLU': 45,
      'VENKATESWARLU': 45,
      'SWARNASUBRAMANYAM': 76,
      'SSUBRAHMANYAM': 76,
      'SUBRAHMANYAM': 76,
      'KVENKATASURESH': 34,
      'KVSURESH': 34,
      'TKANTHARAO': 108,
      'TKRAO': 108,
      'KANTHARAO': 108
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
    // 09-10-26 FRIDAY (Pages 64 & 65)
    // ==========================================
    {
      date: '2026-10-09',
      page_number: 64,
      entries: [
        // Page 64 (Day)
        { staff_names: ['KARNA KOTI REDDY'], train_out: '17253', coach_out: 'AC+SL', train_return: '17252', coach_return: 'AC+SL' },
        { staff_names: ['BONDURI PAVAN KUMAR'], train_out: '17239', coach_out: 'AC+2S', train_return: '17240', coach_return: 'AC+2S' },
        { staff_names: ['JANGAM VINAY KUMAR'], train_out: '17646', coach_out: 'AC+SL', train_return: '12796', coach_return: 'AC+2S', notes: 'Return 12796 / 12805' },
        { staff_names: ['YADALA SRIKANTH'], train_out: '12805', coach_out: 'AC+2S', train_return: '12806', coach_return: 'AC+2S' },
        { staff_names: ['U. RAMA KRISHNA'], train_out: '12795', coach_out: 'AC+2S', train_return: '17645', coach_return: 'AC+SL', notes: 'Swapped from J. Vinay Kumar' },
        { staff_names: ['KOMMANARAPU. V. B. SHANKER'], train_out: '17251', coach_out: 'AC+SL', train_return: '17254', coach_return: 'AC+SL' },
        { staff_names: ['K. KRANTI KUMAR'], train_out: '17281', coach_out: '2S', train_return: '17282', coach_return: '2S' },
        { staff_names: ['M. SRINIVASULU'], train_out: '17261', coach_out: 'COR', train_return: '12733', coach_return: 'II nd COR' },
        { staff_names: ['K. SIVA PARVATHI'], train_out: '17261', coach_out: 'SL', train_return: '17262', coach_return: 'SL' },
        { staff_names: ['V. UMA DEVI'], train_out: '17261', coach_out: 'SL', train_return: '17262', coach_return: 'SL' },
        { staff_names: ['B. RAMA KRISHNA REDDY'], train_out: '20629', coach_out: 'COR', train_return: '12733', coach_return: 'I st COR' },
        { staff_names: ['SANTOSH KUMAR JHA'], train_out: '20629', coach_out: 'SL', train_return: '12733', coach_return: 'SL' },
        { staff_names: ['BELLAM RAJA KUMAR'], train_out: '20629', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['T. RAJA SHEKAR REDDY'], train_out: '17225', coach_out: 'COR', train_return: '17226', coach_return: 'COR' },
        { staff_names: ['M. VEER ANJANEYULU'], train_out: '17225', coach_out: 'SL', train_return: '17226', coach_return: 'SL' },
        { staff_names: ['PATHAN. RMD. ALI KHAN'], train_out: '18047', coach_out: 'COR', train_return: '18048', coach_return: 'COR' },
        { staff_names: ['N. KISHAN KUMAR'], train_out: '18047', coach_out: 'SL', train_return: '18048', coach_return: 'SL' },
        { staff_names: ['G. VARADARAJULU'], train_out: '17626', coach_out: 'AC+SL', train_return: '17625', coach_return: 'AC+SL' },
        { staff_names: ['N. RAVI CHANDRA REDDY'], train_out: '17626', coach_out: 'SL', train_return: '17645', coach_return: 'SL' },

        // Page 65 (Night)
        { staff_names: ['N. VENKATESH'], train_out: '12604', coach_out: 'COR', train_return: '12603', coach_return: 'COR' },
        { staff_names: ['K. BRAHMANDAM RAO'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL' },
        { staff_names: ['M. SURESH'], train_out: '12734', coach_out: 'II nd COR', train_return: '20630', coach_return: 'COR' },
        { staff_names: ['KAKI SRINIVASA RAO'], train_out: '12734', coach_out: 'I st COR', train_return: '17262', coach_return: 'COR' },
        { staff_names: ['M. NAGA RAJU'], train_out: '12734', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['N. SWARNA BABU'], train_out: '17243', coach_out: 'AC+SL', train_return: '17244', coach_return: 'AC+SL' },
        { staff_names: ['A. VENKI REDDY'], train_out: '17243', coach_out: 'SL', train_return: '17244', coach_return: 'SL' },
        { staff_names: ['S. V. SIVA KUMAR'], train_out: '18063', coach_out: 'AC', train_return: '18064', coach_return: 'AC', notes: 'GNT-DMM-BZA' },
        { staff_names: ['E. L. N. RAO'], train_out: '17231', coach_out: 'AC+SL', train_return: '17232', coach_return: 'AC+SL', notes: '(BZA-CHZ-BZA)-(NS-NSL) EXP' },
        { staff_names: ['V. SRINIVAS RAO'], train_out: '17607', coach_out: 'AC+SL', train_return: '17608', coach_return: 'AC+SL', notes: 'GNT-RU-GNT' },
        { staff_names: ['DASARI RAKESH'], train_out: '07191', coach_out: 'AC+SL', train_return: '20630', coach_return: 'SL', notes: 'GNT-RU-GNT' },
        { staff_names: ['SANJAY KUMAR SHARMA'], train_out: '07535', coach_out: 'AC+SL', train_return: '12603', coach_return: 'SL', notes: '00:30 hrs of Saturday GNT-MS-GNT' }
      ]
    },

    // ==========================================
    // 10-10-26 SATURDAY (Pages 66 & 67)
    // ==========================================
    {
      date: '2026-10-10',
      page_number: 66,
      entries: [
        // Page 66 (Day)
        { staff_names: ['T. ANKAMMA RAO'], train_out: '17253', coach_out: 'AC+SL', train_return: '17252', coach_return: 'AC+SL' },
        { staff_names: ['U. BALA JOJI'], train_out: '17239', coach_out: 'AC+2S', train_return: '17240', coach_return: 'AC+2S' },
        { staff_names: ['Y. MURALI KRISHNA'], train_out: '17646', coach_out: 'AC+SL', train_return: '12796', coach_return: 'AC+2S', notes: 'Return 12796 / 12805' },
        { staff_names: ['TAMMINENI SRI HARSHA'], train_out: '12805', coach_out: 'AC+2S', train_return: '12806', coach_return: 'AC+2S' },
        { staff_names: ['BODIPATI VENKAT REDDY'], train_out: '12795', coach_out: 'AC+2S', train_return: '17645', coach_return: 'AC+SL' },
        { staff_names: ['T. SIVA KUMAR'], train_out: '17251', coach_out: 'AC+SL', train_return: '17254', coach_return: 'AC+SL' },
        { staff_names: ['NARESH CHAND MEENA'], train_out: '17281', coach_out: '2S', train_return: '17282', coach_return: '2S' },
        { staff_names: ['CH. RAMESH BABU'], train_out: '17261', coach_out: 'COR', train_return: '12733', coach_return: 'I st COR' },
        { staff_names: ['SH. TULASI'], train_out: '17261', coach_out: 'SL', train_return: '17262', coach_return: 'SL' },
        { staff_names: ['E.V. RAMANAMMA'], train_out: '17261', coach_out: 'SL', train_return: '17262', coach_return: 'SL' },
        { staff_names: ['SK. SALEEM'], train_out: '20629', coach_out: 'COR', train_return: '12733', coach_return: 'II nd COR' },
        { staff_names: ['KADEPALLI RAO'], train_out: '20629', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['B.P. RAJA KUMAR'], train_out: '17225', coach_out: 'I st COR', train_return: '17226', coach_return: 'COR' },
        { staff_names: ['V. A. CHAKRAVARTHY'], train_out: '17225', coach_out: 'SL', train_return: '17226', coach_return: 'SL' },
        { staff_names: ['R. BANGARAIAH'], train_out: '17225', coach_out: 'II nd COR', train_return: '18048', coach_return: 'COR' },
        { staff_names: ['SK. KARIMULLA'], train_out: '17225', coach_out: 'SL', train_return: '18048', coach_return: 'SL' },
        { staff_names: ['R. NAGESWAR RAO NAIK'], train_out: '17626', coach_out: 'AC+SL', train_return: '17625', coach_return: 'AC+SL' },
        { staff_names: ['PASUPULETI GOPAL RAO'], train_out: '17626', coach_out: 'SL', train_return: '17646', coach_return: 'SL' },

        // Page 67 (Night)
        { staff_names: ['L. PRASANNA KUMAR'], train_out: '12604', coach_out: 'COR', train_return: '12603', coach_return: 'COR' },
        { staff_names: ['SUVVADA SRINU'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL' },
        { staff_names: ['SK. MASTAN BASHA'], train_out: '12734', coach_out: 'II nd COR', train_return: '20630', coach_return: 'COR' },
        { staff_names: ['M. NAGESWAR RAO'], train_out: '12734', coach_out: 'I st COR', train_return: '17262', coach_return: 'COR' },
        { staff_names: ['P. KRISHNA MOHAN'], train_out: '12734', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['P. BALA KRISHNA'], train_out: '17243', coach_out: 'AC+SL', train_return: '17244', coach_return: 'AC+SL' },
        { staff_names: ['D. KHADER BASHA'], train_out: '17243', coach_out: 'SL', train_return: '17244', coach_return: 'SL' },
        { staff_names: ['A. GOUTHAM KRISHNA'], train_out: '07227', coach_out: 'AC+SL', train_return: '07228', coach_return: 'AC+SL' },
        { staff_names: ['GUGULOTHU SHIVAN'], train_out: 'Pilot', coach_out: 'SL', train_return: '12756', coach_return: 'AC+SL', notes: 'Pilot to BZA' },
        { staff_names: ['BABU RAM MEENA'], train_out: '17221', coach_out: 'AC+SL', train_return: '17222', coach_return: 'AC+SL' },
        { staff_names: ['RAMAVATH SAIDA NAIK'], train_out: '16358', coach_out: 'AC+SL', train_return: '07536', coach_return: 'AC+SL', notes: 'GNT-MS-GNT' },
        { staff_names: ['MANDA. V. RAMA REDDY'], train_out: '20629', coach_out: 'SL', train_return: '07191', coach_return: 'AC+SL', notes: 'GNT-RU-GNT' },
        { staff_names: ['SH. MADHU BABU'], train_out: '07193', coach_out: 'AC+SL', train_return: '07194', coach_return: 'AC+SL', notes: 'Early hours of Sunday GNT-KPD-GNT' }
      ]
    },

    // ==========================================
    // 11-10-26 SUNDAY (Pages 68 & 69)
    // ==========================================
    {
      date: '2026-10-11',
      page_number: 68,
      entries: [
        // Page 68 (Day)
        { staff_names: ['D. VANIL KUMAR'], train_out: '17253', coach_out: 'AC+SL', train_return: '17252', coach_return: 'AC+SL' },
        { staff_names: ['VEMULA SRINIYAS RAO'], train_out: '17239', coach_out: 'AC+2S', train_return: '17240', coach_return: 'AC+2S' },
        { staff_names: ['KARNA KOTI REDDY'], train_out: '17646', coach_out: 'AC+SL', train_return: '12796', coach_return: 'AC+2S', notes: 'Return 12796 / 12805' },
        { staff_names: ['BHANU PRATAP SINGH'], train_out: '12805', coach_out: 'AC+2S', train_return: '12806', coach_return: 'AC+2S' },
        { staff_names: ['K. KRANTHI KUMAR'], train_out: '12795', coach_out: 'AC+2S', train_return: '17645', coach_return: 'AC+SL' },
        { staff_names: ['N. VENKATESH'], train_out: '17251', coach_out: 'AC+SL', train_return: '17254', coach_return: 'AC+SL' },
        { staff_names: ['DASARI RAKESH'], train_out: '17281', coach_out: '2S', train_return: '17282', coach_return: '2S' },
        { staff_names: ['V. UMA DEVI'], train_out: '17261', coach_out: 'COR', train_return: '12733', coach_return: 'II nd COR' },
        { staff_names: ['M. SIVA KUMARI'], train_out: '17261', coach_out: 'SL', train_return: '17262', coach_return: 'SL' },
        { staff_names: ['K.V. RAMANA RAO'], train_out: '20629', coach_out: 'COR', train_return: '12733', coach_return: 'I st COR' },
        { staff_names: ['DEVARAPATTI ANIL'], train_out: '20629', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['INDURTHI DASARADHI'], train_out: '17225', coach_out: 'COR', train_return: '17226', coach_return: 'COR-II' },
        { staff_names: ['P.V. SUBBA RAO'], train_out: '17225', coach_out: 'SL', train_return: '17226', coach_return: 'SL' },
        { staff_names: ['B. VENKATESWAR RAO'], train_out: '18047', coach_out: 'COR', train_return: '17226', coach_return: 'COR-I' },
        { staff_names: ['M. SURESH'], train_out: '18047', coach_out: 'SL', train_return: '17226', coach_return: 'SL' },
        { staff_names: ['Y. KORNELU BABU'], train_out: '17626', coach_out: 'AC+SL', train_return: '17625', coach_return: 'AC+SL' },
        { staff_names: ['SINGAM. V. SIVA KUMAR'], train_out: '17626', coach_out: 'SL', train_return: '17646', coach_return: 'SL' },

        // Page 69 (Night)
        { staff_names: ['BOLUMURI PAVAN KUMAR'], train_out: '12604', coach_out: 'COR', train_return: '12603', coach_return: 'COR' },
        { staff_names: ['SANTOSH KUMAR JHA'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL' },
        { staff_names: ['M.V.S.N. REDDY'], train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL' },
        { staff_names: ['B. RAMA KRISHNA REDDY'], train_out: '12734', coach_out: 'I st COR', train_return: '20630', coach_return: 'COR' },
        { staff_names: ['Y. ATHMANANDA REDDY'], train_out: '12734', coach_out: 'II nd COR', train_return: '17262', coach_return: 'COR' },
        { staff_names: ['M. VENKATESWARLU'], train_out: '12734', coach_out: 'SL', train_return: '20630', coach_return: 'SL' },
        { staff_names: ['SWARNA SUBRAMANYAM'], train_out: '17243', coach_out: 'AC+SL', train_return: '17244', coach_return: 'AC+SL' },
        { staff_names: ['K. BRAHMANANDA RAO'], train_out: '17243', coach_out: 'SL', train_return: '17244', coach_return: 'SL' },
        { staff_names: ['K. VENKATA SURESH'], train_out: '17231', coach_out: 'AC+SL', train_return: '17232', coach_return: 'AC+SL', notes: '(NS-NSL-NS) EXP. BZA-CHZ-BZA' },
        { staff_names: ['T. KANTHA RAO'], train_out: '02811', coach_out: 'AC', train_return: '02812', coach_return: 'AC', notes: '(BBS-YPR-BBS) EXP. (GNT-DMM-BZA)' },
        { staff_names: ['SANJAY KUMAR SHARMA'], train_out: '17032', coach_out: 'AC', train_return: 'Pilot', coach_return: 'AC', notes: '(BZA-CHZ) PILOT. AC. (AH-CO2) EXP.' }
      ]
    }
  ];

  const allWorkedStaffByDate: Record<string, Set<number>> = {
    '2026-10-09': new Set(),
    '2026-10-10': new Set(),
    '2026-10-11': new Set()
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
  console.log('IDENTIFYING ABSENT EMPLOYEES (09-11 OCT)');
  console.log('======================================================');

  const links = await all(`SELECT * FROM links WHERE status != 'draft' OR status IS NULL`);
  const absentList: { date: string; staff: any; link: any; reason: string }[] = [];

  for (const dateStr of ['2026-10-09', '2026-10-10', '2026-10-11']) {
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

  console.log(`\nIdentified ${absentList.length} Absent staff instances on Oct 09-11:`);
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
  console.error('Fatal error applying daily summary for Oct 09-11:', err);
  process.exit(1);
});
