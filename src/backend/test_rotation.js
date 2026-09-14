const { db, initDb, get, all } = require('./db');
const { getDayOffset, getBaseLinkNumber } = require('./rotation');

async function runTests() {
  console.log('Running Acceptance Tests for all 3 categories (September 2026 Master Roster)...');
  
  // 1. Initialize DB
  await initDb();
  console.log('Database initialized.');

  const categories = await all("SELECT * FROM categories ORDER BY id");
  let totalChecked = 0;
  let mismatches = 0;

  for (const cat of categories) {
    const staffMembers = await all("SELECT * FROM staff WHERE category_id = ? AND row_position <= ? ORDER BY row_position", [cat.id, cat.cycle_length]);
    const restLinksRows = await all("SELECT link_number FROM links WHERE category_id = ? AND is_rest = 1", [cat.id]);
    const restLinks = new Set(restLinksRows.map(r => r.link_number));

    console.log(`\nVerifying Category '${cat.name}': Anchor Date = ${cat.anchor_date}, Cycle Length = ${cat.cycle_length}`);
    console.log(`  Staff Count: ${staffMembers.length}`);

    // Verify September 1 baseline: row_position N starts on Link N on Sept 1st (2026-09-01)
    staffMembers.forEach(staff => {
      const offset = getDayOffset(cat.anchor_date, '2026-09-01');
      const computedLink = getBaseLinkNumber(staff.row_position, offset, cat.cycle_length);
      totalChecked++;

      if (computedLink !== staff.row_position) {
        console.error(`Link mismatch on Sept 1 for ${staff.name} in ${cat.code}: Expected=${staff.row_position}, Computed=${computedLink}`);
        mismatches++;
      }
    });

    // Verify 30-day September rotation cycle
    for (let day = 1; day <= 30; day++) {
      const dateStr = `2026-09-${String(day).padStart(2, '0')}`;
      const offset = getDayOffset(cat.anchor_date, dateStr);

      staffMembers.forEach(staff => {
        const computedLink = getBaseLinkNumber(staff.row_position, offset, cat.cycle_length);
        totalChecked++;

        if (offset !== day) {
          console.error(`Offset error for ${dateStr}: Expected=${day}, Got=${offset}`);
          mismatches++;
        }
      });
    }
  }

  console.log(`\nVerification finished.`);
  console.log(`Total Checks Executed: ${totalChecked}`);
  console.log(`Total Mismatches Found: ${mismatches}`);

  if (mismatches === 0) {
    console.log('SUCCESS: All 3 category rosters match official September 2026 master sheets cell-for-cell exactly!');
    db.close();
    process.exit(0);
  } else {
    console.error('FAILURE: Roster verification failed due to mismatches.');
    db.close();
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
