import dotenv from 'dotenv';
dotenv.config();
import { initDb, all } from '../src/backend/db.js';

async function main() {
  await initDb();
  console.log('=== Comparing Links for Set 10 vs Set 11 ===');
  const links10 = await all('SELECT link_no, train_no, from_station, to_station, dep_time, arr_time FROM links WHERE link_set_id = 10 ORDER BY link_no');
  const links11 = await all('SELECT link_no, train_no, from_station, to_station, dep_time, arr_time FROM links WHERE link_set_id = 11 ORDER BY link_no');
  
  let diffCount = 0;
  for (let i = 0; i < Math.max(links10.length, links11.length); i++) {
    const l10 = links10[i] || {};
    const l11 = links11[i] || {};
    const s10 = JSON.stringify(l10);
    const s11 = JSON.stringify(l11);
    if (s10 !== s11) {
      console.log(`Diff at index ${i}: Set 10 =`, l10, `vs Set 11 =`, l11);
      diffCount++;
    }
  }
  if (diffCount === 0) {
    console.log('Sets 10 and 11 have IDENTICAL link definitions!');
  } else {
    console.log(`Found ${diffCount} differences between Set 10 and Set 11.`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
