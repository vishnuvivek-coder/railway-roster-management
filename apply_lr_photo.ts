import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'railway_roster_luxury_editorial_secret_2026';
const adminToken = jwt.sign(
  { id: 1, username: 'admin', name: 'Administrator', role: 'Admin' },
  JWT_SECRET,
  { expiresIn: '7d' }
);

// Photo entries for October 2026
// Keys are staffId, values are { dayNum: dutyCode, ... }
const PHOTO_DATA: Record<number, Record<number, string>> = {
  // 1. AG KRISHNA (staffId 99, Rest TUE)
  99: {
    1: 'TPTY', 2: '20630', 3: 'SC', 4: '17232', 5: 'Pilot', 6: 'R', 7: 'CR',
    8: '12805', 9: '12806', 10: '07227', 11: 'SC', 12: '07228', 13: 'R', 14: 'CL',
    15: '12755', 16: '12756', 26: 'L'
  },
  // 2. D RAKESH (staffId 100, Rest FRI)
  100: {
    1: '17246', 2: '17007', 3: '17648', 4: '07193', 5: 'KPD', 6: '07194', 7: '12604',
    8: '12603', 9: '07191', 10: '20630', 11: '17281', 12: '17282', 13: 'L', 14: '18047',
    15: 'CR', 16: '18048', 26: 'L'
  },
  // 3. G SHIVAN (staffId 101, Rest MON)
  101: {
    1: '12604', 2: '16357', 3: '17207', 4: '17254', 5: 'R', 6: '17243', 7: 'VSKP',
    8: '17244', 9: 'TPTY', 10: '12733', 11: '12756', 12: 'R', 13: '07227', 14: 'TPTY',
    15: '17262', 16: '17603', 17: '17604', 18: '17252', 19: 'R', 20: 'L', 21: 'L', 22: 'L'
  },
  // 4. MVS NAGI REDDY (staffId 102, Rest MON)
  102: {
    1: '12795', 2: '17647', 3: '17253', 4: '17252', 5: '12603', 6: '17077', 7: 'TPTY',
    8: '17078', 9: 'CR', 10: 'CR', 11: '12604', 12: '12603', 13: '17077', 14: 'TPTY',
    15: '17078', 21: 'L', 22: 'L', 23: 'L'
  },
  // 5. B VENKAT REDDY (staffId 103, Rest TUE)
  103: {
    1: 'CR', 2: '17253', 3: '17252', 4: '12603', 5: 'CL', 6: 'R', 7: 'CC',
    8: '07001', 9: 'TPTY', 10: '07070', 11: '17645', 12: 'CR', 13: 'R', 14: '17233', 15: '17240'
  },
  // 6. MSA RAJU (staffId 104, Rest MON)
  104: {
    1: 'WADI', 2: '22881', 3: '17646', 4: '12796', 5: 'R', 6: 'LAP', 7: 'LAP',
    8: 'LAP', 9: 'LAP', 10: 'LAP', 11: 'LAP', 12: 'LAP', 13: 'LAP', 14: 'LAP',
    15: 'LAP', 16: 'LAP', 17: 'LAP'
  },
  // 7. KB RAO (staffId 105, Rest FRI)
  105: {
    1: '12734', 2: 'TPTY', 3: '20630', 4: '12603', 5: '12795', 6: '17645', 7: 'CR',
    8: 'CR', 9: '12604', 10: '12603', 11: '17243', 12: 'VSKP', 13: '17244', 14: '12604',
    15: '12603', 16: 'R', 17: '20629', 18: 'VSKP', 21: 'CR', 22: 'CR', 23: 'R', 24: 'CL', 25: 'CL'
  },
  // 8. SANJAY KUMAR (staffId 106, Rest MON)
  106: {
    1: '17243', 2: 'VSKP', 3: '17244', 4: '12756', 5: 'R', 6: '17637', 7: '22882',
    8: 'WADI', 9: '22881', 10: '12733', 11: '17032', 12: 'Pilot', 13: '17251', 14: '17254',
    15: '17024', 16: 'R', 17: '17025'
  },
  // 9. NC MEENA (staffId 107, Rest MON)
  107: {
    1: '12603', 2: '18062', 3: '18064', 4: '17239', 5: '17240', 6: 'CR', 7: '17221',
    8: 'WADI', 9: '17222', 10: '17281', 11: '17282', 12: 'R', 13: '17637', 14: '17221',
    15: 'WADI', 16: '17222'
  },
  // 10. T KANTHA RAO (staffId 108, Rest TUE)
  108: {
    1: 'GTL', 2: '18048', 3: '17626', 4: 'SC', 5: '17625', 6: 'R', 7: '17253',
    8: '17252', 9: 'SC', 10: '07228', 11: '02811', 12: '04892', 13: 'R', 14: '12805', 15: '12806'
  },
  // 11. BR MEENA (staffId 109, Rest WED)
  109: {
    1: '17646', 2: '12796', 3: '16358', 4: '17646', 5: '12796', 6: 'R', 7: '07535',
    8: 'Pilot', 9: '17224', 10: 'WADI', 11: '17222', 12: '08061', 13: '08064', 14: '17224',
    15: 'TPTY', 16: '20630'
  },
  // 12. T ANKAMMA RAO (staffId 110, Rest MON)
  110: {
    1: '17239', 2: '17240', 3: '20629', 4: '07192', 5: 'R', 6: '17251', 7: '17254',
    8: '12604', 9: '16357', 10: '17253', 11: '17252', 12: 'R', 13: '12604', 14: '12603',
    15: '07001', 16: 'TPTY', 17: '07010'
  },
  // 13. MV RAMA REDDY (staffId 111, Rest FRI)
  111: {
    1: '12806', 2: 'R', 3: 'LAP', 4: 'LAP', 5: 'LAP', 6: '17253', 7: '17252',
    8: '17239', 9: '17240', 10: '20629', 11: '07192', 12: '12604', 13: '12603', 14: '12795',
    15: '17645', 16: '17239', 17: '17240', 18: '17251', 19: '17254', 20: 'NH', 21: 'CR', 22: 'CR'
  },
  // 14. MV ANJANEYULU (staffId 112, Rest FRI)
  112: {
    1: '17078', 2: 'R', 3: '17221', 4: 'WADI', 5: '17222', 6: '12603', 7: '12805',
    8: '12806', 9: '17225', 10: 'GTL', 11: '17226', 12: '17239', 13: '17240', 14: '17009',
    15: 'TPTY', 16: '20630'
  },
  // 15. SV SIVA KUMAR (staffId 113, Rest SUN)
  113: {
    1: '17042', 2: '12734', 3: 'TPTY', 4: '20630', 5: '12603', 6: 'CR', 7: '12604',
    8: '12603', 9: '18063', 10: '18064', 11: '17626', 12: 'SC', 13: '17625', 14: 'CR',
    15: '07001', 16: 'TPTY', 17: '07010', 24: 'L', 25: 'CR', 26: 'R', 27: 'L', 28: 'L', 29: 'L'
  },
  // 16. ELN RAO (staffId 114, Rest MON)
  114: {
    1: 'TPTY', 2: '17262', 3: '12795', 4: '17645', 5: 'R', 6: '17041', 7: 'RU',
    8: '17042', 9: '17231', 10: 'WADI', 11: '17232', 12: '12604', 13: '12603', 14: 'CR',
    15: '17646', 16: '12796', 19: 'R'
  },
  // 17. V SRINIVASA RAO (staffId 115, Rest THU)
  115: {
    1: '17226', 2: '12604', 3: '12603', 4: '17626', 5: 'SC', 6: '17625', 7: '12603',
    8: 'R', 9: '17603', 10: '17604', 11: '17235', 12: '17240', 13: '17041', 14: 'RU',
    15: '17042', 16: 'CR', 17: 'CL', 18: 'CL', 19: 'CL', 20: 'NH'
  },
  // 18. B P SINGH (staffId 117, Rest WED)
  117: {
    1: '12625', 2: '12603', 3: 'CR', 4: '02811', 5: '02812', 6: '17646', 7: '12796',
    8: '07001', 9: 'TPTY', 10: '07002', 11: '12805', 12: '12806', 13: '12604', 14: '12603',
    15: '16358', 16: '16357'
  },
  // 19. R SAIDA NAIK (staffId 89, Rest SAT)
  89: {
    1: 'WADI', 2: '17222', 3: 'R', 4: '17253', 5: '17252', 6: '12603', 7: '17009',
    8: 'TPTY', 9: '17262', 10: '16358', 11: '07536', 12: '17646', 13: '12796', 14: '22882',
    15: 'WADI', 16: '22881', 17: 'R', 18: 'CR', 19: 'LAP', 20: '12795', 21: '17645'
  }
};

async function applyPhotoEntries() {
  const updates: any[] = [];
  const year = 2026;
  const month = 10;

  for (const [staffIdStr, daysMap] of Object.entries(PHOTO_DATA)) {
    const staffId = parseInt(staffIdStr, 10);
    for (let day = 1; day <= 31; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const code = daysMap[day] || '';
      updates.push({
        staff_id: staffId,
        date: dateStr,
        duty_code: code,
        remarks: code ? `As per physical LR sheet photo (${code})` : ''
      });
    }
  }

  console.log(`Sending batch update with ${updates.length} entries for October 2026...`);
  const res = await fetch('http://localhost:5000/api/lr-sheet/batch-update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ updates })
  });

  const json = await res.json();
  console.log('Result:', json);
}

applyPhotoEntries().catch(err => {
  console.error('Error applying photo entries:', err);
  process.exit(1);
});
