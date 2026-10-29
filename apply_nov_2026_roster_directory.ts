import { initDb, all, run, get } from './src/backend/db';

async function main() {
  await initDb();
  console.log('--- Applying November 1st, 2026 Roster Directory ---');

  // 1. Close prior active link sets
  console.log('1. Closing prior active link sets at 2026-10-31...');
  await run(`UPDATE link_sets SET effective_to = '2026-10-31', name = 'Conductors (COR) (July 2026 - Oct 2026)' WHERE id = 1`);
  await run(`UPDATE link_sets SET effective_to = '2026-10-31', name = 'TTI / Sleeper Staff (October 2026)' WHERE id = 7`);
  await run(`UPDATE link_sets SET effective_to = '2026-10-31', name = 'Ladies Staff / TTE (July 2026 - Oct 2026)' WHERE id = 3`);

  // Update existing links under those sets
  await run(`UPDATE links SET effective_to = '2026-10-31' WHERE link_set_id IN (1, 3, 7) AND (effective_to > '2026-10-31' OR effective_to IS NULL)`);

  // 2. Create new published link sets effective 2026-11-01
  console.log('2. Creating new published link sets effective 2026-11-01...');
  const corSetRes = await run(
    `INSERT INTO link_sets (category_id, name, status, effective_from, effective_to) VALUES (?, ?, ?, ?, ?)`,
    [1, 'Conductors (COR) (Effective Nov 1, 2026)', 'published', '2026-11-01', '9999-12-31']
  );
  const corSetId = corSetRes.lastID;

  const sleeperSetRes = await run(
    `INSERT INTO link_sets (category_id, name, status, effective_from, effective_to) VALUES (?, ?, ?, ?, ?)`,
    [2, 'TTI / Sleeper Staff (Effective Nov 1, 2026)', 'published', '2026-11-01', '9999-12-31']
  );
  const sleeperSetId = sleeperSetRes.lastID;

  const ladiesSetRes = await run(
    `INSERT INTO link_sets (category_id, name, status, effective_from, effective_to) VALUES (?, ?, ?, ?, ?)`,
    [3, 'Ladies Staff / TTE (Effective Nov 1, 2026)', 'published', '2026-11-01', '9999-12-31']
  );
  const ladiesSetId = ladiesSetRes.lastID;

  console.log(`Created link sets: COR=${corSetId}, Sleeper=${sleeperSetId}, Ladies=${ladiesSetId}`);

  // 3. Define new links for November 2026
  console.log('3. Inserting new links for November 2026...');

  // --- Category 1: Conductors (COR) Links (21) ---
  const corLinks = [
    { num: 1, tr: 'PILOT(67230), 17225', from: 'GNT, BZA', to: 'BZA, --', coaches: 'AC', isRest: 0, setType: '3-Day Set', setName: 'Amaravati Exp (17225/26)' },
    { num: 2, tr: '17225, 17226', from: '--, GTL', to: 'GTL, --', coaches: 'AC', isRest: 0, setType: '3-Day Set', setName: 'Amaravati Exp (17225/26)' },
    { num: 3, tr: '17226, PILOT(12703)', from: '--, BZA', to: 'BZA, GNT', coaches: 'AC', isRest: 0, setType: '3-Day Set', setName: 'Amaravati Exp (17225/26)' },
    { num: 4, tr: '17261', from: 'GNT', to: '--', coaches: 'AC', isRest: 0, setType: '3-Day Set', setName: 'GNT-TPTY Exp (17261/12733)' },
    { num: 5, tr: '17261, 12733', from: '--, TPTY', to: 'TPTY, --', coaches: 'H1, A1-A3 & B5', isRest: 0, setType: '3-Day Set', setName: 'GNT-TPTY Exp (17261/12733)' },
    { num: 6, tr: '12733', from: '--', to: 'GNT', coaches: 'H1, A1-A3 & B5', isRest: 0, setType: '3-Day Set', setName: 'GNT-TPTY Exp (17261/12733)' },
    { num: 7, tr: 'REST', from: '', to: '', coaches: '', isRest: 1, setType: 'Weekly Rest', setName: 'Weekly Rest 1' },
    { num: 8, tr: '20629', from: 'GNT', to: '---', coaches: 'AC', isRest: 0, setType: '6-Day Set', setName: 'VB & Narayanadri Circuit (20629/12733/12734/20630/12604/03)' },
    { num: 9, tr: '20629, 12733', from: '---, TPTY', to: 'TPTY, ---', coaches: 'M1 & B1-B4', isRest: 0, setType: '6-Day Set', setName: 'VB & Narayanadri Circuit (20629/12733/12734/20630/12604/03)' },
    { num: 10, tr: '12733, 12734', from: '---, GNT', to: 'GNT, ---', coaches: 'H1, A1-A3 & B5', isRest: 0, setType: '6-Day Set', setName: 'VB & Narayanadri Circuit (20629/12733/12734/20630/12604/03)' },
    { num: 11, tr: '12734, 20630', from: '---, TPTY', to: 'TPTY, ---', coaches: 'AC', isRest: 0, setType: '6-Day Set', setName: 'VB & Narayanadri Circuit (20629/12733/12734/20630/12604/03)' },
    { num: 12, tr: '20630, 12604', from: '---, GNT', to: 'GNT, --', coaches: 'AC', isRest: 0, setType: '6-Day Set', setName: 'VB & Narayanadri Circuit (20629/12733/12734/20630/12604/03)' },
    { num: 13, tr: '12604, 12603', from: '--, MAS', to: 'MAS, GNT', coaches: 'AC', isRest: 0, setType: '6-Day Set', setName: 'VB & Narayanadri Circuit (20629/12733/12734/20630/12604/03)' },
    { num: 14, tr: 'REST', from: '', to: '', coaches: '', isRest: 1, setType: 'Weekly Rest', setName: 'Weekly Rest 2' },
    { num: 15, tr: '17243', from: 'GNT', to: '--', coaches: 'AC', isRest: 0, setType: '3-Day Set', setName: 'Circar Exp (17243/44)' },
    { num: 16, tr: '17243, 17244', from: '--, VSKP', to: 'VSKP, --', coaches: 'AC', isRest: 0, setType: '3-Day Set', setName: 'Circar Exp (17243/44)' },
    { num: 17, tr: '17244', from: '--', to: 'GNT', coaches: 'AC', isRest: 0, setType: '3-Day Set', setName: 'Circar Exp (17243/44)' },
    { num: 18, tr: '12734', from: 'GNT', to: '--', coaches: 'M1 & B1-B4', isRest: 0, setType: '3-Day Set', setName: 'Narayanadri & TPTY Exp (12734/17262)' },
    { num: 19, tr: '12734, 17262', from: '--, TPTY', to: 'TPTY, --', coaches: 'AC', isRest: 0, setType: '3-Day Set', setName: 'Narayanadri & TPTY Exp (12734/17262)' },
    { num: 20, tr: '17262', from: 'TPTY', to: 'GNT', coaches: 'AC', isRest: 0, setType: '3-Day Set', setName: 'Narayanadri & TPTY Exp (12734/17262)' },
    { num: 21, tr: 'REST', from: '', to: '', coaches: '', isRest: 1, setType: 'Weekly Rest', setName: 'Weekly Rest 3' }
  ];

  for (const l of corLinks) {
    await run(
      `INSERT INTO links (category_id, link_set_id, link_number, train_numbers, from_station, to_station, coaches, is_rest, effective_from, effective_to, set_type, set_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '2026-11-01', '9999-12-31', ?, ?, 'published')`,
      [1, corSetId, l.num, l.tr, l.from, l.to, l.coaches, l.isRest, l.setType, l.setName]
    );
  }

  // --- Category 2: Sleeper Links (56) ---
  const sleeperLinks = [
    { num: 1, tr: '17239', from: 'GNT', to: 'VSKP', coaches: 'CC + 2S', isRest: 0, setType: '2-Day Set', setName: 'Simhadri Exp (17239/40)' },
    { num: 2, tr: '17240', from: 'VSKP', to: 'GNT', coaches: 'CC + 2S', isRest: 0, setType: '2-Day Set', setName: 'Simhadri Exp (17239/40)' },
    { num: 3, tr: '12604', from: 'GNT', to: '--', coaches: 'S1-S5', isRest: 0, setType: '2-Day Set', setName: 'Chennai Exp (12604/03)' },
    { num: 4, tr: '12604, 12603', from: '--, MAS', to: 'MAS, GNT', coaches: 'S1-S5', isRest: 0, setType: '2-Day Set', setName: 'Chennai Exp (12604/03)' },
    { num: 5, tr: '17251', from: 'GNT', to: '--', coaches: 'AC + SL', isRest: 0, setType: '2-Day Set', setName: 'GNT-DHNE Exp (17251/54)' },
    { num: 6, tr: '17251, 17254', from: '--, DHNE', to: 'DHNE, GNT', coaches: 'AC + SL', isRest: 0, setType: '2-Day Set', setName: 'GNT-DHNE Exp (17251/54)' },
    { num: 7, tr: 'REST', from: '', to: '', coaches: '', isRest: 1, setType: 'Weekly Rest', setName: 'Weekly Rest 1' },
    { num: 8, tr: '12734', from: 'GNT', to: '--', coaches: 'SL', isRest: 0, setType: '3-Day Set', setName: 'Narayanadri & VB Exp (12734/20630)' },
    { num: 9, tr: '12734, 20630', from: '--, TPTY', to: 'TPTY, --', coaches: 'SL', isRest: 0, setType: '3-Day Set', setName: 'Narayanadri & VB Exp (12734/20630)' },
    { num: 10, tr: '20630', from: '--', to: 'GNT', coaches: 'SL', isRest: 0, setType: '3-Day Set', setName: 'Narayanadri & VB Exp (12734/20630)' },
    { num: 11, tr: 'PILOT(67230), 17225', from: 'GNT, BZA', to: 'BZA, --', coaches: 'S1-S5', isRest: 0, setType: '3-Day Set', setName: 'Amaravati Exp (17225/26)' },
    { num: 12, tr: '17225, 17226', from: '--, GTL', to: 'GTL, --', coaches: 'S1-S5', isRest: 0, setType: '3-Day Set', setName: 'Amaravati Exp (17225/26)' },
    { num: 13, tr: '17226, PILOT(12703)', from: '--, BZA', to: 'BZA, GNT', coaches: 'S1-S5', isRest: 0, setType: '3-Day Set', setName: 'Amaravati Exp (17225/26)' },
    { num: 14, tr: 'REST', from: '', to: '', coaches: '', isRest: 1, setType: 'Weekly Rest', setName: 'Weekly Rest 2' },
    { num: 15, tr: '17253', from: 'GNT', to: 'DHNE', coaches: 'AC + SL', isRest: 0, setType: '2-Day Set', setName: 'GNT-DHNE Exp (17253/52)' },
    { num: 16, tr: '17252', from: 'DHNE', to: 'GNT', coaches: 'AC + SL', isRest: 0, setType: '2-Day Set', setName: 'GNT-DHNE Exp (17253/52)' },
    { num: 17, tr: '17646, 12796', from: 'GNT, SC', to: 'SC, BZA', coaches: 'AC + 2S', isRest: 0, setType: '2-Day Set', setName: '17646/12796' },
    { num: 18, tr: '12805', from: 'BZA', to: 'GNT', coaches: 'AC + D1-D2', isRest: 0, setType: '2-Day Set', setName: 'Janmabhoomi Exp (12805)' },
    { num: 19, tr: '12805', from: 'GNT', to: 'SC', coaches: 'AC + D1-D2', isRest: 0, setType: '2-Day Set', setName: 'Janmabhoomi Exp (12805/06)' },
    { num: 20, tr: '12806, PILOT(17240)', from: 'SC, BZA', to: 'BZA, GNT', coaches: 'AC + D1-D2', isRest: 0, setType: '2-Day Set', setName: 'Janmabhoomi Exp (12806/PILOT)' },
    { num: 21, tr: 'REST', from: '', to: '', coaches: '', isRest: 1, setType: 'Weekly Rest', setName: 'Weekly Rest 3' },
    { num: 22, tr: '20629', from: 'GNT', to: '--', coaches: 'S5-S8', isRest: 0, setType: '3-Day Set', setName: 'TPTY Exp (20629/30)' },
    { num: 23, tr: '20629, 20630', from: '--, TPTY', to: 'TPTY, --', coaches: 'S5-S8', isRest: 0, setType: '3-Day Set', setName: 'TPTY Exp (20629/30)' },
    { num: 24, tr: '20630', from: '--', to: 'GNT', coaches: 'S5-S8', isRest: 0, setType: '3-Day Set', setName: 'TPTY Exp (20629/30)' },
    { num: 25, tr: 'PILOT(67230), 18047', from: 'GNT, BZA', to: 'BZA, --', coaches: 'AC', isRest: 0, setType: '3-Day Set', setName: 'Amaravati Exp (18047/48 AC)' },
    { num: 26, tr: '18047, 18048', from: '--, GTL', to: 'GTL, --', coaches: 'AC', isRest: 0, setType: '3-Day Set', setName: 'Amaravati Exp (18047/48 AC)' },
    { num: 27, tr: '18048, PILOT(17244)', from: '--, BZA', to: 'BZA, GNT', coaches: 'AC', isRest: 0, setType: '3-Day Set', setName: 'Amaravati Exp (18047/48 AC)' },
    { num: 28, tr: 'REST', from: '', to: '', coaches: '', isRest: 1, setType: 'Weekly Rest', setName: 'Weekly Rest 4' },
    { num: 29, tr: '17645, 17626', from: 'GNT, RAL', to: 'RAL, --', coaches: 'AC + SL', isRest: 0, setType: '3-Day Set', setName: 'RAL / SC Circuit AC+SL (17645/26/25/46)' },
    { num: 30, tr: '17626, 17625', from: '--, KCG', to: 'SC, --', coaches: 'AC + SL', isRest: 0, setType: '3-Day Set', setName: 'RAL / SC Circuit AC+SL (17645/26/25/46)' },
    { num: 31, tr: '17625, 17646', from: '--, RAL', to: 'RAL, GNT', coaches: 'AC + SL', isRest: 0, setType: '3-Day Set', setName: 'RAL / SC Circuit AC+SL (17645/26/25/46)' },
    { num: 32, tr: '17243', from: 'GNT', to: '--', coaches: 'AC + SL', isRest: 0, setType: '3-Day Set', setName: 'Circar Exp AC+SL (17243/44)' },
    { num: 33, tr: '17243, 17244', from: '--, VSKP', to: 'VSKP, --', coaches: 'AC + SL', isRest: 0, setType: '3-Day Set', setName: 'Circar Exp AC+SL (17243/44)' },
    { num: 34, tr: '17244', from: '--', to: 'GNT', coaches: 'AC + SL', isRest: 0, setType: '3-Day Set', setName: 'Circar Exp AC+SL (17243/44)' },
    { num: 35, tr: 'REST', from: '', to: '', coaches: '', isRest: 1, setType: 'Weekly Rest', setName: 'Weekly Rest 5' },
    { num: 36, tr: '20629', from: 'GNT', to: '--', coaches: 'S1-S4', isRest: 0, setType: '3-Day Set', setName: '20629/12733' },
    { num: 37, tr: '20629, 12733', from: '--, TPTY', to: 'TPTY, --', coaches: 'S1-S4, SL', isRest: 0, setType: '3-Day Set', setName: '20629/12733' },
    { num: 38, tr: '12733, 17281', from: '--, GNT', to: 'GNT, NS', coaches: 'SL, D1-D2', isRest: 0, setType: '3-Day Set', setName: '12733 & NS Exp (17281)' },
    { num: 39, tr: '17282', from: 'NS', to: 'GNT', coaches: 'D1-D2', isRest: 0, setType: '2-Day Set', setName: 'NS Exp (17282)' },
    { num: 40, tr: 'PILOT(12705), 12795', from: 'GNT, BZA', to: 'BZA, SC', coaches: 'AC + 2S', isRest: 0, setType: '2-Day Set', setName: '12795/17645' },
    { num: 41, tr: '17645', from: 'SC', to: 'GNT', coaches: 'AC + SL', isRest: 0, setType: '2-Day Set', setName: '12795/17645' },
    { num: 42, tr: 'REST', from: '', to: '', coaches: '', isRest: 1, setType: 'Weekly Rest', setName: 'Weekly Rest 6' },
    { num: 43, tr: '17645, 17626', from: 'GNT, RAL', to: 'RAL, --', coaches: 'S1-S5', isRest: 0, setType: '3-Day Set', setName: 'RAL / SC Circuit (17645/26/25/46)' },
    { num: 44, tr: '17626, 17625', from: '--, KCG', to: 'SC, --', coaches: 'S1-S5', isRest: 0, setType: '3-Day Set', setName: 'RAL / SC Circuit (17645/26/25/46)' },
    { num: 45, tr: '17625, 17646', from: '--, RAL', to: 'RAL, GNT', coaches: 'S1-S5', isRest: 0, setType: '3-Day Set', setName: 'RAL / SC Circuit (17645/26/25/46)' },
    { num: 46, tr: '17243', from: 'GNT', to: '--', coaches: 'SL', isRest: 0, setType: '3-Day Set', setName: 'Circar Exp SL (17243/44)' },
    { num: 47, tr: '17243, 17244', from: '--, VSKP', to: 'VSKP, --', coaches: 'SL', isRest: 0, setType: '3-Day Set', setName: 'Circar Exp SL (17243/44)' },
    { num: 48, tr: '17244', from: '--', to: 'GNT', coaches: 'SL', isRest: 0, setType: '3-Day Set', setName: 'Circar Exp SL (17243/44)' },
    { num: 49, tr: 'REST', from: '', to: '', coaches: '', isRest: 1, setType: 'Weekly Rest', setName: 'Weekly Rest 7' },
    { num: 50, tr: 'PILOT(67230), 18047', from: 'GNT, BZA', to: 'BZA, --', coaches: 'SL', isRest: 0, setType: '3-Day Set', setName: 'Amaravati Exp (18047/48 SL)' },
    { num: 51, tr: '18047, 18048', from: '--, GTL', to: 'GTL, --', coaches: 'SL', isRest: 0, setType: '3-Day Set', setName: 'Amaravati Exp (18047/48 SL)' },
    { num: 52, tr: '18048, PILOT(17244)', from: '--, BZA', to: 'BZA, GNT', coaches: 'SL', isRest: 0, setType: '3-Day Set', setName: 'Amaravati Exp (18047/48 SL)' },
    { num: 53, tr: '22882, 22881', from: 'GNT', to: 'WADI', coaches: 'SL', isRest: 0, setType: 'Non-Daily', setName: 'Non Daily Link 1' },
    { num: 54, tr: '17221, 17222', from: 'GNT', to: 'WADI', coaches: 'SL', isRest: 0, setType: 'Non-Daily', setName: 'Non Daily Link 2' },
    { num: 55, tr: '17069, 17262', from: 'GNT', to: 'RU/TPTY', coaches: 'SL', isRest: 0, setType: 'Non-Daily', setName: 'Non Daily Link 3' },
    { num: 56, tr: 'REST', from: '', to: '', coaches: '', isRest: 1, setType: 'Weekly Rest', setName: 'Weekly Rest 8' }
  ];

  for (const l of sleeperLinks) {
    await run(
      `INSERT INTO links (category_id, link_set_id, link_number, train_numbers, from_station, to_station, coaches, is_rest, effective_from, effective_to, set_type, set_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '2026-11-01', '9999-12-31', ?, ?, 'published')`,
      [2, sleeperSetId, l.num, l.tr, l.from, l.to, l.coaches, l.isRest, l.setType, l.setName]
    );
  }

  // --- Category 3: Ladies Links (7) ---
  const ladiesLinks = [
    { num: 1, tr: '17261', from: 'GNT', to: '--', coaches: 'SL', isRest: 0, setType: '3-Day Set', setName: 'GNT-TPTY Exp (17261/62)' },
    { num: 2, tr: '17261, 17262', from: '--, TPTY', to: 'TPTY, --', coaches: 'SL', isRest: 0, setType: '3-Day Set', setName: 'GNT-TPTY Exp (17261/62)' },
    { num: 3, tr: '17262', from: '--', to: 'GNT', coaches: 'SL', isRest: 0, setType: '3-Day Set', setName: 'GNT-TPTY Exp (17261/62)' },
    { num: 4, tr: '17261', from: 'GNT', to: '--', coaches: 'SL', isRest: 0, setType: '3-Day Set', setName: 'GNT-TPTY Exp (17261/62)' },
    { num: 5, tr: '17261, 17262', from: '--, TPTY', to: 'TPTY, --', coaches: 'SL', isRest: 0, setType: '3-Day Set', setName: 'GNT-TPTY Exp (17261/62)' },
    { num: 6, tr: '17262', from: '--', to: 'GNT', coaches: 'SL', isRest: 0, setType: '3-Day Set', setName: 'GNT-TPTY Exp (17261/62)' },
    { num: 7, tr: 'REST', from: '', to: '', coaches: '', isRest: 1, setType: 'Weekly Rest', setName: 'Weekly Rest' }
  ];

  for (const l of ladiesLinks) {
    await run(
      `INSERT INTO links (category_id, link_set_id, link_number, train_numbers, from_station, to_station, coaches, is_rest, effective_from, effective_to, set_type, set_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '2026-11-01', '9999-12-31', ?, ?, 'published')`,
      [3, ladiesSetId, l.num, l.tr, l.from, l.to, l.coaches, l.isRest, l.setType, l.setName]
    );
  }

  // 4. Update Categories anchor dates & cycle lengths
  console.log('4. Updating categories table (anchor_date = 2026-11-01)...');
  await run(`UPDATE categories SET anchor_date = '2026-11-01', cycle_length = 21 WHERE id = 1`);
  await run(`UPDATE categories SET anchor_date = '2026-11-01', cycle_length = 56 WHERE id = 2`);
  await run(`UPDATE categories SET anchor_date = '2026-11-01', cycle_length = 7 WHERE id = 3`);

  // 5. Update Staff Row Positions for November 2026
  console.log('5. Updating staff row positions for November 2026...');

  // Avoid unique constraint issues: temporarily shift row positions
  await run(`UPDATE staff SET row_position = row_position + 1000 WHERE row_position > 0`);

  // --- Category 1 Staff (21) ---
  const corStaffPositions: [number, number][] = [
    [1, 3],   // Pos 1: I DASARADHI
    [2, 4],   // Pos 2: BP RAJA KUMAR
    [3, 5],   // Pos 3: TRS REDDY
    [4, 6],   // Pos 4: KRM REDDY
    [5, 9],   // Pos 5: VACANT (formerly VV PAVAN KUMAR / Vacant)
    [6, 8],   // Pos 6: M SRINIVASULU
    [7, 17],  // Pos 7: BV RAO
    [8, 10],  // Pos 8: K V RAMANA RAO
    [9, 11],  // Pos 9: SK SALEEM
    [10, 12], // Pos 10: BRK REDDY
    [11, 13], // Pos 11: M KESHAVULU
    [12, 14], // Pos 12: S NAGALINGAPPA
    [13, 15], // Pos 13: LP KUMAR
    [14, 16], // Pos 14: S PRAKASA RAO
    [15, 7],  // Pos 15: CH RAMESH BABU
    [16, 18], // Pos 16: R BANGARAIAH
    [17, 19], // Pos 17: PRM ALI KHAN
    [18, 20], // Pos 18: VAN REDDY
    [19, 21], // Pos 19: MN RAO
    [20, 1],  // Pos 20: KAKI SRINIVASARAO
    [21, 2]   // Pos 21: K RAMANAIAH
  ];

  for (const [pos, staffId] of corStaffPositions) {
    if (staffId === 9) {
      // Mark as VACANT (V)
      await run(`UPDATE staff SET category_id = 1, row_position = ?, name = 'VACANT (V)', designation = '' WHERE id = ?`, [pos, staffId]);
    } else {
      await run(`UPDATE staff SET category_id = 1, row_position = ? WHERE id = ?`, [pos, staffId]);
    }
  }

  // --- Category 2 Staff (56) ---
  const sleeperStaffPositions: [number, number][] = [
    [1, 80],   // Pos 1: O ANIL
    [2, 74],   // Pos 2: VACANT (V)
    [3, 82],   // Pos 3: SK JHA
    [4, 83],   // Pos 4: SH MADHU BABU
    [5, 84],   // Pos 5: K KRANTHI KUMAR
    [6, 22],   // Pos 6: SVSR KRISHNA
    [7, 23],   // Pos 7: J VINAY KUMAR
    [8, 24],   // Pos 8: BVS REDDY
    [9, 101],  // Pos 9: G SHIVAN (from LR to Cat 2)
    [10, 26],  // Pos 10: NRC REDDY
    [11, 69],  // Pos 11: VACANT (V)
    [12, 28],  // Pos 12: P BALA KRISHNA
    [13, 50],  // Pos 13: N SWARNA BABU
    [14, 30],  // Pos 14: SK KHASIM
    [15, 31],  // Pos 15: K DURGA RAO
    [16, 32],  // Pos 16: SK KARIMULLAH
    [17, 61],  // Pos 17: N KISHAN KUMAR
    [18, 34],  // Pos 18: KV SURESH
    [19, 25],  // Pos 19: RNR NAIK
    [20, 36],  // Pos 20: M NAGARAJU
    [21, 37],  // Pos 21: U RAMA KRISHNA
    [22, 38],  // Pos 22: M SURESH
    [23, 39],  // Pos 23: U BALA JOJI
    [24, 40],  // Pos 24: B PAVAN KUMAR
    [25, 41],  // Pos 25: SUVVADA SRINU
    [26, 42],  // Pos 26: N VENKATESH
    [27, 43],  // Pos 27: T SIVA KUMAR
    [28, 44],  // Pos 28: KVB SANKAR
    [29, 45],  // Pos 29: M VENKATESWARLU
    [30, 46],  // Pos 30: SK MASTAN BASHA
    [31, 47],  // Pos 31: B SURESH
    [32, 102], // Pos 32: MVS NAGI REDDY (from LR to Cat 2)
    [33, 56],  // Pos 33: VA CHAKRAVARTHI
    [34, 67],  // Pos 34: VACANT (V)
    [35, 58],  // Pos 35: K NARESH
    [36, 59],  // Pos 36: D VANIL KUMAR
    [37, 60],  // Pos 37: K KUSHWANTH SINGH
    [38, 54],  // Pos 38: K KOTI REDDY
    [39, 62],  // Pos 39: Y MURALI KRISHNA
    [40, 66],  // Pos 40: VACANT (V)
    [41, 64],  // Pos 41: T SRIHARSHA
    [42, 51],  // Pos 42: Y SRIKANTH
    [43, 55],  // Pos 43: PV SUBBA RAO
    [44, 65],  // Pos 44: VACANT (V)
    [45, 68],  // Pos 45: B RAJA KUMAR
    [46, 63],  // Pos 46: VACANT (V)
    [47, 70],  // Pos 47: K GOPI
    [48, 71],  // Pos 48: P KRISHNA MOHAN
    [49, 72],  // Pos 49: D ANVESH
    [50, 73],  // Pos 50: Y KORNELU BABU
    [51, 53],  // Pos 51: P GOPALA RAO
    [52, 75],  // Pos 52: G VARADARAJULU
    [53, 76],  // Pos 53: S SUBRAHMANYAM
    [54, 77],  // Pos 54: D KHADER BASH
    [55, 78],  // Pos 55: A VENKI REDDY
    [56, 79]   // Pos 56: P RAVI KUMAR
  ];

  for (const [pos, staffId] of sleeperStaffPositions) {
    await run(`UPDATE staff SET category_id = 2, row_position = ? WHERE id = ?`, [pos, staffId]);
  }

  // --- Category 3 Staff: Ladies (7) ---
  const ladiesStaffPositions: [number, number][] = [
    [1, 87],  // Pos 1: M SIVA KUMARI
    [2, 88],  // Pos 2: K SIVA PARVATHI
    [3, 134], // Pos 3: SD SHAHEDA
    [4, 90],  // Pos 4: B KEZIA KUMARI
    [5, 91],  // Pos 5: EV RAMANAMMA
    [6, 85],  // Pos 6: V UMADEVI
    [7, 86]   // Pos 7: VS CHANDRIKA
  ];

  for (const [pos, staffId] of ladiesStaffPositions) {
    await run(`UPDATE staff SET category_id = 3, row_position = ? WHERE id = ?`, [pos, staffId]);
  }

  // Handle staff who were shifted/unassigned in November:
  // ID 81 (SK ASHA BEGUM), ID 135 (K DANIAL), ID 57 (VACANT)
  await run(`UPDATE staff SET row_position = 0, category_id = NULL WHERE id IN (81, 135, 57)`);
  // ID 118 (S HYMA TULASI) moved to LR staff (Category 4)
  // Let's ensure LR staff has clean row_positions (1 to 21)
  await run(`UPDATE staff SET category_id = 4 WHERE id = 118`);

  // Reset any remaining > 1000 row positions back to regular for Category 4
  const cat4Staff = await all(`SELECT id FROM staff WHERE category_id = 4 ORDER BY row_position ASC`);
  for (let i = 0; i < cat4Staff.length; i++) {
    await run(`UPDATE staff SET row_position = ? WHERE id = ?`, [i + 1, cat4Staff[i].id]);
  }

  console.log('Successfully applied November 2026 links, categories, and staff positions!');
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
