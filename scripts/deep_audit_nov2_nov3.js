const http = require('http');

function getDailyView(dateStr) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:5000/api/reports/daily-view?date=${dateStr}`, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

const nov2Register = [
  { row: 1, train: '17253 / 17252', staff: ['SK KHASIM'], coaches: 'AC + SL' },
  { row: 2, train: '17239 / 17240', staff: ['P RAVI KUMAR'], coaches: 'AC + 2S' },
  { row: 3, train: '17646 / 12796', staff: ['SK KARIMULLAH'], coaches: 'AC + SL' },
  { row: 4, train: '12805 / 12806', staff: ['KV SURESH'], coaches: 'AC D1-D2' },
  { row: 5, train: '12795 / 17645', staff: ['Y MURALI KRISHNA'], coaches: 'AC + 2S' },
  { row: 6, train: '17251 / 17254', staff: ['SH MADHU BABU'], coaches: 'AC + SL' },
  { row: 7, train: '17281 / 17282', staff: ['KB RAO'], coaches: '2S' },
  { row: 8, train: '17261 / 12733 / 17262', staff: ['TRS REDDY', 'VS CHANDRIKA', 'SD SHAHEDA'], coaches: 'AC, S1-S5, S6-S10' },
  { row: 9, train: '20629 / 12733 / 20630', staff: ['U RAMA KRISHNA', 'ELN RAO'], coaches: 'AC, SL' },
  { row: 10, train: '17225 / 17226', staff: ['K RAMANAIAH', 'NRC REDDY'], coaches: 'AC, SL' },
  { row: 11, train: '18047 / 17226', staff: ['D ANVESH', 'B PAVAN KUMAR'], coaches: 'SL, AC' },
  { row: 12, train: '17626 / 17625', staff: ['KVB SANKAR', 'Y SRIKANTH'], coaches: 'AC + SL, SL' },
  { row: 13, train: '12604 / 12603', staff: ['D RAKESH', 'MV RAMA REDDY'], coaches: 'AC, S1-S5' },
  { row: 14, train: '12734 / 20630 / 17262', staff: ['SK SALEEM', 'PRM ALI KHAN'], coaches: 'COR-2, COR-1' },
  { row: 15, train: '12734 / 20630', staff: ['J VINAY KUMAR'], coaches: 'SL' },
  { row: 16, train: '17243 / 17244', staff: ['B SURESH', 'G VARADARAJULU'], coaches: 'AC + SL, SL' },
  { row: 17, train: '17637 / 17638', staff: ['MSA RAJU'], coaches: 'AC + SL' },
  { row: 18, train: '17646 / 08520', staff: ['SANJAY KUMAR'], coaches: 'SL, AC + SL' }
];

const nov3Register = [
  { row: 1, train: '17253 / 17252', staff: ['N SWARNA BABU'], coaches: 'AC + SL' },
  { row: 2, train: '17239 / 17240', staff: ['A VENKI REDDY'], coaches: 'AC + 2S' },
  { row: 3, train: '17646 / 12796', staff: ['NC MEENA'], coaches: 'AC + SL' },
  { row: 4, train: '12805 / 12806', staff: ['N KISHAN KUMAR'], coaches: 'AC D1-D2' },
  { row: 5, train: '12795 / 17645', staff: ['BR MEENA'], coaches: 'AC + 2S' },
  { row: 6, train: '17251 / 17254', staff: ['SK JHA'], coaches: 'AC + SL' },
  { row: 7, train: '17281 / 17282', staff: ['D VANIL KUMAR'], coaches: '2S' },
  { row: 8, train: '17261 / 12733 / 17262', staff: ['BP RAJA KUMAR', 'K SIVA PARVATHI'], coaches: 'AC, SL' },
  { row: 9, train: '20629 / 12733 / 20630', staff: ['M SRINIVASULU', 'M NAGARAJU'], coaches: 'AC, SL' },
  { row: 10, train: '17225 / 17226', staff: ['KAKI SRINIVASA RAO', 'G SHIVAN'], coaches: 'AC, SL' },
  { row: 11, train: '18047 / 17226', staff: ['P KRISHNA MOHAN', 'U BALA JOJI'], coaches: 'AC, SL' },
  { row: 12, train: '17626 / 17625', staff: ['T SRIHARSHA', 'T SIVA KUMAR'], coaches: 'AC + SL, SL' },
  { row: 13, train: '12604 / 12603', staff: ['BRK REDDY', 'O ANIL'], coaches: 'AC, S1-S5' },
  { row: 14, train: '12734 / 20630 / 17262', staff: ['K V RAMANA RAO', 'R BANGARAIAH'], coaches: 'COR-1, COR-2' },
  { row: 15, train: '12734 / 20630', staff: ['SVSR KRISHNA'], coaches: 'SL' },
  { row: 16, train: '17243 / 17244', staff: ['LP KUMAR', 'SK MASTAN BASHA'], coaches: 'AC, SL' },
  { row: 17, train: '17041 / 17042', staff: ['MV ANJANEYULU'], coaches: 'SL' },
  { row: 18, train: '17077 / 17078', staff: ['S PRAKASA RAO', 'P GOPALA RAO'], coaches: 'AC + SL, AC + SL' },
  { row: 19, train: '08513', staff: ['K DURGA RAO'], coaches: 'AC + SL' }
];

async function runAudit() {
  console.log('Auditing November 2nd and 3rd against Register photos...');
  
  const dv2 = await getDailyView('2026-11-02');
  const staff2 = (dv2.categories || []).flatMap(c => (c.staff || []).map(s => ({ ...s, categoryId: c.categoryId })));
  
  console.log('\n--- AUDIT FOR NOVEMBER 2, 2026 (MONDAY) ---');
  let match2 = 0;
  let total2 = 0;
  for (const item of nov2Register) {
    for (const st of item.staff) {
      total2++;
      const found = staff2.find(s => s.name && (s.name.includes(st) || st.includes(s.name)));
      const predictedTrain = found ? (found.train_out || found.train_numbers) : 'NONE';
      const isM = predictedTrain && item.train.split('/')[0].trim().includes(predictedTrain.split(/[/,]+/)[0].trim());
      if (isM) match2++;
      console.log(`Row ${item.row} [${item.train}]: Register = ${st} | System = ${found ? found.name : 'NOT FOUND'} on ${predictedTrain} [${isM ? 'MATCH' : 'MISMATCH'}]`);
    }
  }
  console.log(`Nov 2 Score: ${match2} / ${total2} (${Math.round(match2/total2*100)}%)`);

  const dv3 = await getDailyView('2026-11-03');
  const staff3 = (dv3.categories || []).flatMap(c => (c.staff || []).map(s => ({ ...s, categoryId: c.categoryId })));

  console.log('\n--- AUDIT FOR NOVEMBER 3, 2026 (TUESDAY) ---');
  let match3 = 0;
  let total3 = 0;
  for (const item of nov3Register) {
    for (const st of item.staff) {
      total3++;
      const found = staff3.find(s => s.name && (s.name.includes(st) || st.includes(s.name)));
      const predictedTrain = found ? (found.train_out || found.train_numbers) : 'NONE';
      const isM = predictedTrain && item.train.split('/')[0].trim().includes(predictedTrain.split(/[/,]+/)[0].trim());
      if (isM) match3++;
      console.log(`Row ${item.row} [${item.train}]: Register = ${st} | System = ${found ? found.name : 'NOT FOUND'} on ${predictedTrain} [${isM ? 'MATCH' : 'MISMATCH'}]`);
    }
  }
  console.log(`Nov 3 Score: ${match3} / ${total3} (${Math.round(match3/total3*100)}%)`);
}

runAudit().catch(console.error);
