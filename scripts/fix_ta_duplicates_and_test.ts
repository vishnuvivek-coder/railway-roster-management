import { all, run, initDb } from '../src/backend/db.js';

async function main() {
  await initDb();
  
  // 1. Check duplicate entries in ta_entries
  const dupes = await all(`
    SELECT staff_id, duty_date, train_no, from_station, to_station, COUNT(*) as c
    FROM ta_entries
    GROUP BY staff_id, duty_date, train_no, from_station, to_station
    HAVING c > 1
  `);
  console.log('Duplicate groups in ta_entries:', dupes.length);
  if (dupes.length > 0) {
    console.log('Sample duplicates:', dupes.slice(0, 5));
  }

  // 2. Remove exact duplicates in ta_entries
  const deleteResult = await run(`
    DELETE t1 FROM ta_entries t1
    INNER JOIN ta_entries t2
    WHERE t1.id > t2.id
      AND t1.staff_id = t2.staff_id
      AND t1.duty_date = t2.duty_date
      AND t1.train_no = t2.train_no
      AND COALESCE(t1.from_station, '') = COALESCE(t2.from_station, '')
      AND COALESCE(t1.to_station, '') = COALESCE(t2.to_station, '')
  `);
  console.log('Cleaned duplicates result:', deleteResult);

  // 3. Verify duplicates again
  const remaining = await all(`
    SELECT staff_id, duty_date, train_no, from_station, to_station, COUNT(*) as c
    FROM ta_entries
    GROUP BY staff_id, duty_date, train_no, from_station, to_station
    HAVING c > 1
  `);
  console.log('Remaining duplicate groups in ta_entries:', remaining.length);

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
