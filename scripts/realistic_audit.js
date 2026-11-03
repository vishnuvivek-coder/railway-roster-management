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
  { row: 1, train: '17253', staff: ['SK KHASIM'] },
  { row: 2, train: '17239', staff: ['P RAVI KUMAR'] },
  { row: 3, train: '17646', staff: ['SK KARIMULLAH'] },
  { row: 4, train: '12805', staff: ['KV SURESH'] },
  { row: 5, train: '12795', staff: ['Y MURALI KRISHNA'] },
  { row: 6, train: '17251', staff: ['SH MADHU BABU'] },
  { row: 7, train: '17281', staff: ['KB RAO'] },
  { row: 8, train: '17261', staff: ['TRS REDDY', 'VS CHANDRIKA', 'SD SHAHEDA'] },
  { row: 9, train: '20629', staff: ['U RAMA KRISHNA', 'ELN RAO'] },
  { row: 10, train: '17225', staff: ['K RAMANAIAH', 'NRC REDDY'] },
  { row: 11, train: '18047', staff: ['D ANVESH', 'B PAVAN KUMAR'] },
  { row: 12, train: '17626', staff: ['KVB SANKAR', 'Y SRIKANTH'] },
  { row: 13, train: '12604', staff: ['D RAKESH', 'MV RAMA REDDY'] },
  { row: 14, train: '12734', staff: ['SK SALEEM', 'PRM ALI KHAN'] },
  { row: 15, train: '12734', staff: ['J VINAY KUMAR'] },
  { row: 16, train: '17243', staff: ['B SURESH', 'G VARADARAJULU'] },
  { row: 17, train: '17637', staff: ['MSA RAJU'] },
  { row: 18, train: '17646', staff: ['SANJAY KUMAR'] }
];

const nov3Register = [
  { row: 1, train: '17253', staff: ['N SWARNA BABU'] },
  { row: 2, train: '17239', staff: ['A VENKI REDDY'] },
  { row: 3, train: '17646', staff: ['NC MEENA'] },
  { row: 4, train: '12805', staff: ['N KISHAN KUMAR'] },
  { row: 5, train: '12795', staff: ['BR MEENA'] },
  { row: 6, train: '17251', staff: ['SK JHA'] },
  { row: 7, train: '17281', staff: ['D VANIL KUMAR'] },
  { row: 8, train: '17261', staff: ['BP RAJA KUMAR', 'K SIVA PARVATHI'] },
  { row: 9, train: '20629', staff: ['M SRINIVASULU', 'M NAGARAJU'] },
  { row: 10, train: '17225', staff: ['KAKI SRINIVASA RAO', 'G SHIVAN'] },
  { row: 11, train: '18047', staff: ['P KRISHNA MOHAN', 'U BALA JOJI'] },
  { row: 12, train: '17626', staff: ['T SRIHARSHA', 'T SIVA KUMAR'] },
  { row: 13, train: '12604', staff: ['BRK REDDY', 'O ANIL'] },
  { row: 14, train: '12734', staff: ['K V RAMANA RAO', 'R BANGARAIAH'] },
  { row: 15, train: '12734', staff: ['SVSR KRISHNA'] },
  { row: 16, train: '17243', staff: ['LP KUMAR', 'SK MASTAN BASHA'] },
  { row: 17, train: '17041', staff: ['MV ANJANEYULU'] },
  { row: 18, train: '17077', staff: ['S PRAKASA RAO', 'P GOPALA RAO'] },
  { row: 19, train: '08513', staff: ['K DURGA RAO'] }
];

async function runAudit() {
  const dv2 = await getDailyView('2026-11-02');
  const staff2 = (dv2.categories || []).flatMap(c => (c.staff || []).map(s => ({ ...s, categoryId: c.categoryId })));
  
  console.log('\n======================================================');
  console.log('REALISTIC AUDIT FOR NOVEMBER 2, 2026 (MONDAY)');
  console.log('======================================================');
  let match2 = 0;
  let total2 = 0;
  const matches2 = [];
  const mismatches2 = [];

  for (const item of nov2Register) {
    for (const st of item.staff) {
      total2++;
      const found = staff2.find(s => s.name && (s.name.includes(st) || st.includes(s.name)));
      const predictedTrain = found ? (found.train_out || found.train_numbers) : 'NONE';
      const isM = predictedTrain && predictedTrain.includes(item.train);
      if (isM) {
        match2++;
        matches2.push({ row: item.row, train: item.train, staff: st, predicted: predictedTrain });
      } else {
        mismatches2.push({ row: item.row, train: item.train, staff: st, predicted: predictedTrain, cat: found ? found.categoryId : '?' });
      }
    }
  }

  console.log(`✅ MATCHES (${match2} / ${total2} = ${Math.round(match2/total2*100)}%):`);
  matches2.forEach(m => console.log(`   Row ${m.row} [${m.train}]: ${m.staff} -> predicted on ${m.predicted}`));

  console.log(`\n❌ MISMATCHES (${mismatches2.length} / ${total2}):`);
  mismatches2.forEach(m => console.log(`   Row ${m.row} [${m.train}]: ${m.staff} (Cat ${m.cat}) -> predicted on ${m.predicted}`));

  const dv3 = await getDailyView('2026-11-03');
  const staff3 = (dv3.categories || []).flatMap(c => (c.staff || []).map(s => ({ ...s, categoryId: c.categoryId })));

  console.log('\n======================================================');
  console.log('REALISTIC AUDIT FOR NOVEMBER 3, 2026 (TUESDAY)');
  console.log('======================================================');
  let match3 = 0;
  let total3 = 0;
  const matches3 = [];
  const mismatches3 = [];

  for (const item of nov3Register) {
    for (const st of item.staff) {
      total3++;
      const found = staff3.find(s => s.name && (s.name.includes(st) || st.includes(s.name)));
      const predictedTrain = found ? (found.train_out || found.train_numbers) : 'NONE';
      const isM = predictedTrain && predictedTrain.includes(item.train);
      if (isM) {
        match3++;
        matches3.push({ row: item.row, train: item.train, staff: st, predicted: predictedTrain });
      } else {
        mismatches3.push({ row: item.row, train: item.train, staff: st, predicted: predictedTrain, cat: found ? found.categoryId : '?' });
      }
    }
  }

  console.log(`✅ MATCHES (${match3} / ${total3} = ${Math.round(match3/total3*100)}%):`);
  matches3.forEach(m => console.log(`   Row ${m.row} [${m.train}]: ${m.staff} -> predicted on ${m.predicted}`));

  console.log(`\n❌ MISMATCHES (${mismatches3.length} / ${total3}):`);
  mismatches3.forEach(m => console.log(`   Row ${m.row} [${m.train}]: ${m.staff} (Cat ${m.cat}) -> predicted on ${m.predicted}`));
}

runAudit().catch(console.error);
