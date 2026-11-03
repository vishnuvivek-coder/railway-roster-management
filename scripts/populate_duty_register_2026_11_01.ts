import { all, run, get, initDb } from '../src/backend/db.js';

interface DutyRegisterItem {
  page_number: number;
  train_out: string;
  coach_out: string;
  train_return: string;
  coach_return: string;
  duty_label: string;
  notes?: string;
  staffIds: number[];
}

const entries_2026_11_01: DutyRegisterItem[] = [
  // Page 110:
  // 1. R.S. NAIK | 17253 | AC+SL | 17252 | AC+SL
  { page_number: 110, train_out: '17253', coach_out: 'AC+SL', train_return: '17252', coach_return: 'AC+SL', duty_label: '17253 / 17252', staffIds: [89] },
  // 2. N.C. MEENA | 17239 | AC+2S | 17240 | AC+2S
  { page_number: 110, train_out: '17239', coach_out: 'AC+2S', train_return: '17240', coach_return: 'AC+2S', duty_label: '17239 / 17240', staffIds: [107] },
  // 3. N.K. KUMAR | 17646 | AC+SL | 12796 | AC+2S
  { page_number: 110, train_out: '17646', coach_out: 'AC+SL', train_return: '12796', coach_return: 'AC+2S', duty_label: '17646 / 12796', staffIds: [61] },
  // 4. RNR NAIK | 12805 | AC / D1-D2 | 12806 | AC / D1-D2
  { page_number: 110, train_out: '12805', coach_out: 'AC / D1-D2', train_return: '12806', coach_return: 'AC / D1-D2', duty_label: '12805 / 12806', staffIds: [25] },
  // 5. A.G. KRISHNA | 12795 | AC+2S | 17645 | AC+SL
  { page_number: 110, train_out: '12795', coach_out: 'AC+2S', train_return: '17645', coach_return: 'AC+SL', duty_label: '12795 / 17645', staffIds: [99] },
  // 6. K.K. KUMAR | 17251 | AC+SL | 17254 | AC+SL
  { page_number: 110, train_out: '17251', coach_out: 'AC+SL', train_return: '17254', coach_return: 'AC+SL', duty_label: '17251 / 17254', staffIds: [84] },
  // 7. M.V. ANJANEYULU | 17281 | 2S | 17282 | 2S
  { page_number: 110, train_out: '17281', coach_out: '2S', train_return: '17282', coach_return: '2S', duty_label: '17281 / 17282', staffIds: [112] },
  // 8. KRM REDDY & BK KUMARI | 17261
  { page_number: 110, train_out: '17261', coach_out: 'AC', train_return: '12733', coach_return: 'COR-2', duty_label: '17261 / 12733', staffIds: [6] },
  { page_number: 110, train_out: '17261', coach_out: 'SL', train_return: '17262', coach_return: 'SL', duty_label: '17261 / 17262', staffIds: [90] },
  // 9. KVR RAO, D. VANIL, M. SURESH | 20629
  { page_number: 110, train_out: '20629', coach_out: 'AC', train_return: '12733', coach_return: 'COR-1', duty_label: '20629 / 12733', staffIds: [10] },
  { page_number: 110, train_out: '20629', coach_out: 'SL', train_return: '17262', coach_return: 'SL', duty_label: '20629 / 17262', staffIds: [59] },
  { page_number: 110, train_out: '20629', coach_out: 'SL', train_return: '20630', coach_return: 'SL', duty_label: '20629 / 20630', staffIds: [38] },
  // 10. I. DASARADHI & B.R. MEENA | 17225
  { page_number: 110, train_out: '17225', coach_out: 'AC', train_return: '17226', coach_return: 'AC', duty_label: '17225 / 17226', staffIds: [3] },
  { page_number: 110, train_out: '17225', coach_out: 'SL', train_return: '17226', coach_return: 'SL', duty_label: '17225 / 17226', staffIds: [109] },
  // 11. Y.K. BABU & S. SRINU | 18047
  { page_number: 110, train_out: '18047', coach_out: 'AC', train_return: '17226', coach_return: 'SL', duty_label: '18047 / 17226', staffIds: [73] },
  { page_number: 110, train_out: '18047', coach_out: 'SL', train_return: '17226', coach_return: 'SL', duty_label: '18047 / 17226', staffIds: [41] },
  // 12. PVS RAO & M. VENKATESWARLU | 17626
  { page_number: 110, train_out: '17626', coach_out: 'AC+SL', train_return: '17625', coach_return: 'AC+SL', duty_label: '17626 / 17625', staffIds: [55] },
  { page_number: 110, train_out: '17626', coach_out: 'SL', train_return: '17625', coach_return: 'SL', duty_label: '17626 / 17625', staffIds: [45] },

  // Page 111:
  // 13. S. NAGALINGAPPA, SK JHA, K. DANIAL | 12604
  { page_number: 111, train_out: '12604', coach_out: 'AC', train_return: '12603', coach_return: 'AC', duty_label: '12604 / 12603', staffIds: [14] },
  { page_number: 111, train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL', duty_label: '12604 / 12603', staffIds: [82] },
  { page_number: 111, train_out: '12604', coach_out: 'SL', train_return: '12603', coach_return: 'SL', duty_label: '12604 / 12603', staffIds: [135] },
  // 14. BRK REDDY & VAN REDDY | 12734
  { page_number: 111, train_out: '12734', coach_out: 'COR-1', train_return: '20630', coach_return: 'AC', duty_label: '12734 / 20630', staffIds: [12] },
  { page_number: 111, train_out: '12734', coach_out: 'COR-2', train_return: '17262', coach_return: 'AC', duty_label: '12734 / 17262', staffIds: [20] },
  // 15. BVS REDDY | 12734
  { page_number: 111, train_out: '12734', coach_out: 'SL', train_return: '20630', coach_return: 'SL', duty_label: '12734 / 20630', staffIds: [24] },
  // 16. K D RAO & M.V.S.N. REDDY | 17243
  { page_number: 111, train_out: '17243', coach_out: 'AC+SL', train_return: '17244', coach_return: 'AC+SL', duty_label: '17243 / 17244', staffIds: [31] },
  { page_number: 111, train_out: '17243', coach_out: 'SL', train_return: '17244', coach_return: 'SL', duty_label: '17243 / 17244', staffIds: [102] },
  // 17. T.K. RAO | 07811 / 07812
  { page_number: 111, train_out: '07811', coach_out: 'AC', train_return: '07812', coach_return: 'AC', duty_label: '07811 / 07812', staffIds: [108] },
  // 18. V.S. RAO | 17231 / 17232
  { page_number: 111, train_out: '17231', coach_out: 'AC+SL', train_return: '17232', coach_return: 'AC+SL', duty_label: '17231 / 17232', staffIds: [115] },
  // 19. K K REDDY | 07487 / 07488
  { page_number: 111, train_out: '07487', coach_out: 'AC+SL', train_return: '07488', coach_return: 'AC+SL', duty_label: '07487 / 07488', staffIds: [54] },
  // 20. S.S. MANYAN | 07193 / 07194
  { page_number: 111, train_out: '07193', coach_out: 'AC+SL', train_return: '07194', coach_return: 'AC+SL', duty_label: '07193 / 07194', staffIds: [76] }
];

async function main() {
  await initDb();
  console.log('--- Step 1: Remove false benchmark overrides for 2026-11-01 (IDs 4181, 4188) ---');
  const delOv = await run('DELETE FROM overrides WHERE id IN (4181, 4188)');
  console.log('Removed dummy overrides:', delOv);

  console.log('--- Step 2: Ensure K DANIAL (135) is active in Category 2 (TTI) ---');
  await run('UPDATE staff SET category_id = 2, active = 1 WHERE id = 135');
  console.log('Staff 135 category updated to 2.');

  console.log('--- Step 3: Clear any existing duty_register entries for 2026-11-01 ---');
  const existingEntries: any[] = await all('SELECT id FROM duty_register_entry WHERE date = ?', ['2026-11-01']);
  for (const entry of existingEntries) {
    await run('DELETE FROM duty_register_staff WHERE entry_id = ?', [entry.id]);
    await run('DELETE FROM duty_register_entry WHERE id = ?', [entry.id]);
  }
  console.log(`Cleared ${existingEntries.length} old entries for 2026-11-01.`);

  console.log('--- Step 4: Insert 20 official register entries from Pages 110 & 111 ---');
  for (const item of entries_2026_11_01) {
    const res = await run(
      `INSERT INTO duty_register_entry (date, page_number, train_out, coach_out, train_return, coach_return, duty_label, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['2026-11-01', item.page_number, item.train_out, item.coach_out, item.train_return, item.coach_return, item.duty_label, item.notes || null]
    );
    const entryId = res.lastID;
    for (const sid of item.staffIds) {
      await run(
        'INSERT INTO duty_register_staff (entry_id, staff_id) VALUES (?, ?)',
        [entryId, sid]
      );
    }
  }
  console.log(`Successfully populated ${entries_2026_11_01.length} duty_register records for 2026-11-01.`);

  process.exit(0);
}

main().catch(err => {
  console.error('Error populating duty register:', err);
  process.exit(1);
});
