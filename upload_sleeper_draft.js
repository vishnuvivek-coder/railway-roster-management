const db = require('./src/backend/db.js');

const SLEEPER_LINKS = [
  // Link 1-2: 17239/40 (Simhadri Exp)
  {
    link_number: 1,
    train_numbers: '17239',
    from_station: 'GNT',
    to_station: 'VSKP',
    coaches: 'CC + 2S',
    is_rest: 0,
    set_type: '2-Day Set',
    set_name: 'Simhadri Exp (17239/40)'
  },
  {
    link_number: 2,
    train_numbers: '17240',
    from_station: 'VSKP',
    to_station: 'GNT',
    coaches: 'CC + 2S',
    is_rest: 0,
    set_type: '2-Day Set',
    set_name: 'Simhadri Exp (17239/40)'
  },
  // Link 3-4: 12604/03 (Chennai Exp)
  {
    link_number: 3,
    train_numbers: '12604',
    from_station: 'GNT',
    to_station: '--',
    coaches: 'S1-S5',
    is_rest: 0,
    set_type: '2-Day Set',
    set_name: 'Chennai Exp (12604/03)'
  },
  {
    link_number: 4,
    train_numbers: '12604, 12603',
    from_station: '--, MAS',
    to_station: 'MAS, GNT',
    coaches: 'S1-S5',
    is_rest: 0,
    set_type: '2-Day Set',
    set_name: 'Chennai Exp (12604/03)'
  },
  // Link 5-6: 17251/54 (GNT-DHNE Exp)
  {
    link_number: 5,
    train_numbers: '17251',
    from_station: 'GNT',
    to_station: '--',
    coaches: 'SL',
    is_rest: 0,
    set_type: '2-Day Set',
    set_name: 'GNT-DHNE Exp (17251/54)'
  },
  {
    link_number: 6,
    train_numbers: '17251, 17254',
    from_station: '--, DHNE',
    to_station: 'DHNE, GNT',
    coaches: 'SL',
    is_rest: 0,
    set_type: '2-Day Set',
    set_name: 'GNT-DHNE Exp (17251/54)'
  },
  // Link 7: REST
  {
    link_number: 7,
    train_numbers: 'REST',
    from_station: '',
    to_station: '',
    coaches: '',
    is_rest: 1,
    set_type: 'Other / REST',
    set_name: 'Weekly Rest 1'
  },
  // Link 8-10: 12734/20630 (Narayanadri & VB Exp)
  {
    link_number: 8,
    train_numbers: '12734',
    from_station: 'GNT',
    to_station: '--',
    coaches: 'SL',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'Narayanadri & VB Exp (12734/20630)'
  },
  {
    link_number: 9,
    train_numbers: '12734, 20630',
    from_station: '--, TPTY',
    to_station: 'TPTY, --',
    coaches: 'SL',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'Narayanadri & VB Exp (12734/20630)'
  },
  {
    link_number: 10,
    train_numbers: '20630',
    from_station: '--',
    to_station: 'GNT',
    coaches: 'SL',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'Narayanadri & VB Exp (12734/20630)'
  },
  // Link 11-13: Amaravati Exp (17225/26) S1-S5
  {
    link_number: 11,
    train_numbers: 'PILOT(67230), 17225',
    from_station: 'GNT, BZA',
    to_station: 'BZA, --',
    coaches: 'S1-S5',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'Amaravati Exp (17225/26)'
  },
  {
    link_number: 12,
    train_numbers: '17225, 17226',
    from_station: '--, GTL',
    to_station: 'GTL, --',
    coaches: 'S1-S5',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'Amaravati Exp (17225/26)'
  },
  {
    link_number: 13,
    train_numbers: '17226, PILOT(12703)',
    from_station: '--, BZA',
    to_station: 'BZA, GNT',
    coaches: 'S1-S5',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'Amaravati Exp (17225/26)'
  },
  // Link 14: REST
  {
    link_number: 14,
    train_numbers: 'REST',
    from_station: '',
    to_station: '',
    coaches: '',
    is_rest: 1,
    set_type: 'Other / REST',
    set_name: 'Weekly Rest 2'
  },
  // Link 15-16: 17253/52 (GNT-DHNE Exp)
  {
    link_number: 15,
    train_numbers: '17253',
    from_station: 'GNT',
    to_station: 'DHNE',
    coaches: 'SL',
    is_rest: 0,
    set_type: '2-Day Set',
    set_name: 'GNT-DHNE Exp (17253/52)'
  },
  {
    link_number: 16,
    train_numbers: '17252',
    from_station: 'DHNE',
    to_station: 'GNT',
    coaches: 'SL',
    is_rest: 0,
    set_type: '2-Day Set',
    set_name: 'GNT-DHNE Exp (17253/52)'
  },
  // Link 17: 17646/12796
  {
    link_number: 17,
    train_numbers: '17646, 12796',
    from_station: 'GNT, SC',
    to_station: 'SC, BZA',
    coaches: 'AC + SL, AC + 2S',
    is_rest: 0,
    set_type: '2-Day Set',
    set_name: '17646/12796'
  },
  // Link 18-20: Janmabhoomi Exp (12805/06/PILOT)
  {
    link_number: 18,
    train_numbers: '12805',
    from_station: 'BZA',
    to_station: 'GNT',
    coaches: 'AC + 2S',
    is_rest: 0,
    set_type: '2-Day Set',
    set_name: 'Janmabhoomi Exp (12805)'
  },
  {
    link_number: 19,
    train_numbers: '12805',
    from_station: 'GNT',
    to_station: 'SC',
    coaches: 'AC + 2S',
    is_rest: 0,
    set_type: '2-Day Set',
    set_name: 'Janmabhoomi Exp (12805/06)'
  },
  {
    link_number: 20,
    train_numbers: '12806, PILOT(17240)',
    from_station: 'SC, BZA',
    to_station: 'BZA, GNT',
    coaches: 'AC + 2S',
    is_rest: 0,
    set_type: '2-Day Set',
    set_name: 'Janmabhoomi Exp (12806/PILOT)'
  },
  // Link 21: REST
  {
    link_number: 21,
    train_numbers: 'REST',
    from_station: '',
    to_station: '',
    coaches: '',
    is_rest: 1,
    set_type: 'Other / REST',
    set_name: 'Weekly Rest 3'
  },
  // Link 22-24: 20629/30 (TPTY Exp) S5-S8
  {
    link_number: 22,
    train_numbers: '20629',
    from_station: 'GNT',
    to_station: '--',
    coaches: 'S5-S8',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'TPTY Exp (20629/30)'
  },
  {
    link_number: 23,
    train_numbers: '20629, 20630',
    from_station: '--, TPTY',
    to_station: 'TPTY, --',
    coaches: 'S5-S8',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'TPTY Exp (20629/30)'
  },
  {
    link_number: 24,
    train_numbers: '20630',
    from_station: '--',
    to_station: 'GNT',
    coaches: 'S5-S8',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'TPTY Exp (20629/30)'
  },
  // Link 25-27: Amaravati Exp (17225/26) S6-S10
  {
    link_number: 25,
    train_numbers: 'PILOT(67230), 17225',
    from_station: 'GNT, BZA',
    to_station: 'BZA, --',
    coaches: 'S6-S10',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'Amaravati Exp (17225/26)'
  },
  {
    link_number: 26,
    train_numbers: '17225, 17226',
    from_station: '--, GTL',
    to_station: 'GTL, --',
    coaches: 'S6-S10',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'Amaravati Exp (17225/26)'
  },
  {
    link_number: 27,
    train_numbers: '17226, PILOT(12703)',
    from_station: '--, BZA',
    to_station: 'BZA, GNT',
    coaches: 'S6-S10',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'Amaravati Exp (17225/26)'
  },
  // Link 28: REST
  {
    link_number: 28,
    train_numbers: 'REST',
    from_station: '',
    to_station: '',
    coaches: '',
    is_rest: 1,
    set_type: 'Other / REST',
    set_name: 'Weekly Rest 4'
  },
  // Link 29-31: RAL / SC Circuit (17645/26/25/46) AC + SL
  {
    link_number: 29,
    train_numbers: '17645, 17626',
    from_station: 'GNT, RAL',
    to_station: 'RAL, --',
    coaches: 'AC + SL',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'RAL / SC Circuit (17645/26/25/46)'
  },
  {
    link_number: 30,
    train_numbers: '17626, 17625',
    from_station: '--, KCG',
    to_station: 'SC, --',
    coaches: 'AC + SL',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'RAL / SC Circuit (17645/26/25/46)'
  },
  {
    link_number: 31,
    train_numbers: '17625, 17646',
    from_station: '--, RAL',
    to_station: 'RAL, GNT',
    coaches: 'AC + SL',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'RAL / SC Circuit (17645/26/25/46)'
  },
  // Link 32-34: Circar Exp (17243/44) AC + SL
  {
    link_number: 32,
    train_numbers: '17243',
    from_station: 'GNT',
    to_station: '--',
    coaches: 'AC + SL',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'Circar Exp (17243/44)'
  },
  {
    link_number: 33,
    train_numbers: '17243, 17244',
    from_station: '--, VSKP',
    to_station: 'VSKP, --',
    coaches: 'AC + SL',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'Circar Exp (17243/44)'
  },
  {
    link_number: 34,
    train_numbers: '17244',
    from_station: '--',
    to_station: 'GNT',
    coaches: 'AC + SL',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'Circar Exp (17243/44)'
  },
  // Link 35: REST
  {
    link_number: 35,
    train_numbers: 'REST',
    from_station: '',
    to_station: '',
    coaches: '',
    is_rest: 1,
    set_type: 'Other / REST',
    set_name: 'Weekly Rest 5'
  },
  // Link 36-37: 20629/12733
  {
    link_number: 36,
    train_numbers: '20629',
    from_station: 'GNT',
    to_station: '--',
    coaches: 'S1-S4',
    is_rest: 0,
    set_type: '2-Day Set',
    set_name: '20629/12733'
  },
  {
    link_number: 37,
    train_numbers: '20629, 12733',
    from_station: '--, TPTY',
    to_station: 'TPTY, --',
    coaches: 'S1-S4, SL',
    is_rest: 0,
    set_type: '2-Day Set',
    set_name: '20629/12733'
  },
  // Link 38-39: 12733 & NS Exp (17281/82)
  {
    link_number: 38,
    train_numbers: '12733, 17281',
    from_station: '--, GNT',
    to_station: 'GNT, NS',
    coaches: 'SL, D1-D2',
    is_rest: 0,
    set_type: '2-Day Set',
    set_name: '12733 & NS Exp (17281)'
  },
  {
    link_number: 39,
    train_numbers: '17282',
    from_station: 'NS',
    to_station: 'GNT',
    coaches: 'D1-D2',
    is_rest: 0,
    set_type: '2-Day Set',
    set_name: 'NS Exp (17282)'
  },
  // Link 40-41: PILOT(12705)/12795 & 17645
  {
    link_number: 40,
    train_numbers: 'PILOT(12705)',
    from_station: 'GNT',
    to_station: 'BZA',
    coaches: 'AC + 2S',
    is_rest: 0,
    set_type: '2-Day Set',
    set_name: '12795/17645'
  },
  {
    link_number: 41,
    train_numbers: '12795, 17645',
    from_station: 'BZA, SC',
    to_station: 'SC, GNT',
    coaches: 'AC + 2S, AC + SL',
    is_rest: 0,
    set_type: '2-Day Set',
    set_name: '12795/17645'
  },
  // Link 42: REST
  {
    link_number: 42,
    train_numbers: 'REST',
    from_station: '',
    to_station: '',
    coaches: '',
    is_rest: 1,
    set_type: 'Other / REST',
    set_name: 'Weekly Rest 6'
  },
  // Link 43-45: RAL / SC Circuit (17645/26/25/46) S1-S5
  {
    link_number: 43,
    train_numbers: '17645, 17626',
    from_station: 'GNT, RAL',
    to_station: 'RAL, --',
    coaches: 'S1-S5',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'RAL / SC Circuit (17645/26/25/46)'
  },
  {
    link_number: 44,
    train_numbers: '17626, 17625',
    from_station: '--, KCG',
    to_station: 'SC, --',
    coaches: 'S1-S5',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'RAL / SC Circuit (17645/26/25/46)'
  },
  {
    link_number: 45,
    train_numbers: '17625, 17646',
    from_station: '--, RAL',
    to_station: 'RAL, GNT',
    coaches: 'S1-S5',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'RAL / SC Circuit (17645/26/25/46)'
  },
  // Link 46-48: Circar Exp (17243/44) SL
  {
    link_number: 46,
    train_numbers: '17243',
    from_station: 'GNT',
    to_station: '--',
    coaches: 'SL',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'Circar Exp (17243/44)'
  },
  {
    link_number: 47,
    train_numbers: '17243, 17244',
    from_station: '--, VSKP',
    to_station: 'VSKP, --',
    coaches: 'SL',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'Circar Exp (17243/44)'
  },
  {
    link_number: 48,
    train_numbers: '17244',
    from_station: '--',
    to_station: 'GNT',
    coaches: 'SL',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'Circar Exp (17243/44)'
  },
  // Link 49: REST
  {
    link_number: 49,
    train_numbers: 'REST',
    from_station: '',
    to_station: '',
    coaches: '',
    is_rest: 1,
    set_type: 'Other / REST',
    set_name: 'Weekly Rest 7'
  },
  // Link 50-52: Amaravati Exp (18047/48) SL
  {
    link_number: 50,
    train_numbers: 'PILOT(67230), 18047',
    from_station: 'GNT, BZA',
    to_station: 'BZA, --',
    coaches: 'SL',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'Amaravati Exp (18047/48)'
  },
  {
    link_number: 51,
    train_numbers: '18047, 18048',
    from_station: '--, GTL',
    to_station: 'GTL, --',
    coaches: 'SL',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'Amaravati Exp (18047/48)'
  },
  {
    link_number: 52,
    train_numbers: '18048, PILOT(12703)',
    from_station: '--, BZA',
    to_station: 'BZA, GNT',
    coaches: 'SL',
    is_rest: 0,
    set_type: '3-Day Set',
    set_name: 'Amaravati Exp (18047/48)'
  },
  // Link 53-55: Non Daily Links SL
  {
    link_number: 53,
    train_numbers: 'NON DAILY LINKS',
    from_station: 'GNT',
    to_station: '---',
    coaches: 'SL',
    is_rest: 0,
    set_type: 'Special / Spare',
    set_name: 'Non Daily Link 1'
  },
  {
    link_number: 54,
    train_numbers: 'NON DAILY LINKS',
    from_station: 'GNT',
    to_station: '---',
    coaches: 'SL',
    is_rest: 0,
    set_type: 'Special / Spare',
    set_name: 'Non Daily Link 2'
  },
  {
    link_number: 55,
    train_numbers: 'NON DAILY LINKS',
    from_station: 'GNT',
    to_station: '---',
    coaches: 'SL',
    is_rest: 0,
    set_type: 'Special / Spare',
    set_name: 'Non Daily Link 3'
  },
  // Link 56: REST
  {
    link_number: 56,
    train_numbers: 'REST',
    from_station: '',
    to_station: '',
    coaches: '',
    is_rest: 1,
    set_type: 'Other / REST',
    set_name: 'Weekly Rest 8'
  }
];

async function uploadDraft() {
  const targetLinkSetId = 7;
  const categoryId = 2;

  console.log(`Starting upload into Draft Copy Set #${targetLinkSetId} (Category ${categoryId})...`);

  // Verify target link set exists
  const linkSet = await db.get('SELECT * FROM link_sets WHERE id = ?', [targetLinkSetId]);
  if (!linkSet) {
    throw new Error(`Link set #${targetLinkSetId} not found!`);
  }
  console.log(`Found link set: "${linkSet.name}" (Status: ${linkSet.status})`);

  // Delete previous links in this draft set
  const delRes = await db.run('DELETE FROM links WHERE link_set_id = ?', [targetLinkSetId]);
  console.log(`Deleted existing links in set #${targetLinkSetId}`);

  // Insert all 56 links
  for (const item of SLEEPER_LINKS) {
    await db.run(
      `INSERT INTO links (
        category_id, link_set_id, link_number, train_numbers,
        from_station, to_station, coaches, is_rest,
        effective_from, effective_to, set_type, set_name, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [
        categoryId,
        targetLinkSetId,
        item.link_number,
        item.train_numbers,
        item.from_station,
        item.to_station,
        item.coaches,
        item.is_rest ? 1 : 0,
        '', // effective_from blank for draft
        '9999-12-31',
        item.set_type,
        item.set_name
      ]
    );
  }

  // Update timestamp on link set
  await db.run('UPDATE link_sets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [targetLinkSetId]);

  // Log in audit_logs
  await db.run(
    `INSERT INTO audit_logs (user_role, action_type, description, timestamp, undo_data, is_undone)
     VALUES ('Admin', 'UPDATE_DRAFT_LINKS', ?, CURRENT_TIMESTAMP, NULL, 0)`,
    [`Uploaded 56 Sleeper Links into Draft Set #${targetLinkSetId} "${linkSet.name}" from official chart`]
  );

  console.log(`✔ Successfully inserted ${SLEEPER_LINKS.length} links into Draft Set #${targetLinkSetId}!`);

  // Verify counts
  const check = await db.all('SELECT link_number, train_numbers, from_station, to_station, coaches, is_rest FROM links WHERE link_set_id = ? ORDER BY link_number ASC', [targetLinkSetId]);
  console.log(`Verification: Total rows in set #${targetLinkSetId} = ${check.length}`);
  console.log('First 3 links:');
  console.log(check.slice(0, 3));
  console.log('Last 3 links:');
  console.log(check.slice(-3));
}

uploadDraft()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error uploading draft:', err);
    process.exit(1);
  });
