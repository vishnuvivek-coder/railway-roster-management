const { all } = require('./src/backend/db');

async function inspectAllNonDaily() {
  const rows = await all(`
    SELECT id, day_of_week, train_number, last_day_train_number, departure_station, departure_time, arrival_station, arrival_time, coaches, last_day_coaches, remarks, assigned_staff_id, assigned_staff_name 
    FROM non_daily_trains 
    ORDER BY CASE day_of_week 
      WHEN 'SUNDAY' THEN 1 
      WHEN 'MONDAY' THEN 2 
      WHEN 'TUESDAY' THEN 3 
      WHEN 'WEDNESDAY' THEN 4 
      WHEN 'THURSDAY' THEN 5 
      WHEN 'FRIDAY' THEN 6 
      WHEN 'SATURDAY' THEN 7 
    END, id
  `);

  console.log(`Total Non-Daily rows in DB: ${rows.length}\n`);
  const byDay = {};
  rows.forEach(r => {
    if (!byDay[r.day_of_week]) byDay[r.day_of_week] = [];
    byDay[r.day_of_week].push(r);
  });

  for (const [day, list] of Object.entries(byDay)) {
    console.log(`=== ${day} (${list.length} rows) ===`);
    list.forEach(r => {
      console.log(`  ID ${String(r.id).padStart(2)}: Train ${r.train_number.padEnd(6)} -> Return: ${(r.last_day_train_number || '-').padEnd(6)} | ${r.departure_station} (${r.departure_time || '--:--'}) ➔ ${r.arrival_station} (${r.arrival_time || '--:--'}) | ${r.remarks || ''}`);
    });
  }
}

inspectAllNonDaily();
