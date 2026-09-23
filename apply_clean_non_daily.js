const { run, all } = require('./src/backend/db');

async function cleanNonDailyTrains() {
  console.log('--- Cleaning up Non-Daily Trains table to unified Beat rows ---');

  // Define complete canonical list of Non-Daily Beats (1 row per beat / service pair)
  const canonicalBeats = [
    // SUNDAY
    { day: 'SUNDAY', train: '17032', last: '17031', dep_stn: 'BZA', dep_time: '11:05', arr_stn: 'CHZ', arr_time: '12:40', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },
    { day: 'SUNDAY', train: '17231', last: '17232', dep_stn: 'BZA', dep_time: '13:50', arr_stn: 'CHZ', arr_time: '20:40', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },
    { day: 'SUNDAY', train: '02811', last: '02812', dep_stn: 'GNT', dep_time: '08:30', arr_stn: 'DMM', arr_time: '21:00', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },
    { day: 'SUNDAY', train: '17425', last: '17426', dep_stn: 'GNT', dep_time: '10:40', arr_stn: 'SC', arr_time: '16:00', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },

    // MONDAY
    { day: 'MONDAY', train: '07609', last: '07610', dep_stn: 'GNT', dep_time: '02:55', arr_stn: 'RU', arr_time: '09:30', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: 'Runs TUE' },
    { day: 'MONDAY', train: '17646', last: '17625', dep_stn: 'GNT', dep_time: '08:50', arr_stn: 'SC', arr_time: '16:00', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },
    { day: 'MONDAY', train: '17637', last: '17638', dep_stn: 'GNT', dep_time: '07:00', arr_stn: 'RU', arr_time: '14:30', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },
    { day: 'MONDAY', train: '20629', last: '07198', dep_stn: 'GNT', dep_time: '19:10', arr_stn: 'RU', arr_time: '01:50', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },
    { day: 'MONDAY', train: '07227', last: '07228', dep_stn: 'GNT', dep_time: '06:00', arr_stn: 'CHZ', arr_time: '12:00', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },

    // TUESDAY
    { day: 'TUESDAY', train: '17041', last: '17042', dep_stn: 'GNT', dep_time: '12:20', arr_stn: 'RU', arr_time: '19:20', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },
    { day: 'TUESDAY', train: '07615', last: '07616', dep_stn: 'GNT', dep_time: '23:10', arr_stn: 'RU', arr_time: '08:10', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },
    { day: 'TUESDAY', train: '17077', last: '17078', dep_stn: 'GNT', dep_time: '18:00', arr_stn: 'TPTY', arr_time: '02:30', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },

    // WEDNESDAY
    { day: 'WEDNESDAY', train: '22882', last: '22881', dep_stn: 'GNT', dep_time: '10:35', arr_stn: 'WADI', arr_time: '21:10', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },
    { day: 'WEDNESDAY', train: '17221', last: '17222', dep_stn: 'GNT', dep_time: '13:35', arr_stn: 'WADI', arr_time: '00:05', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },
    { day: 'WEDNESDAY', train: '17069', last: '17262', dep_stn: 'GNT', dep_time: '22:40', arr_stn: 'RU', arr_time: '07:15', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },

    // THURSDAY
    { day: 'THURSDAY', train: '12755', last: '12756', dep_stn: 'BZA', dep_time: '08:40', arr_stn: 'SC', arr_time: '02:40', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },
    { day: 'THURSDAY', train: '12604', last: '16357', dep_stn: 'GNT', dep_time: '22:00', arr_stn: 'MAS', arr_time: '05:40', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },
    { day: 'THURSDAY', train: '17261', last: '17070', dep_stn: 'GNT', dep_time: '16:30', arr_stn: 'TPTY', arr_time: '03:50', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },
    { day: 'THURSDAY', train: '07001', last: '07002', dep_stn: 'GNT', dep_time: '16:30', arr_stn: 'TPTY', arr_time: '03:50', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },

    // FRIDAY
    { day: 'FRIDAY', train: '17231', last: '17232', dep_stn: 'BZA', dep_time: '13:50', arr_stn: 'CHZ', arr_time: '20:40', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },
    { day: 'FRIDAY', train: '18063', last: '18064', dep_stn: 'GNT', dep_time: '09:45', arr_stn: 'DMM', arr_time: '20:30', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },
    { day: 'FRIDAY', train: '07125', last: '07126', dep_stn: 'GNT', dep_time: '17:40', arr_stn: 'RU', arr_time: '01:10', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },
    { day: 'FRIDAY', train: '07195', last: '20630', dep_stn: 'GNT', dep_time: '19:10', arr_stn: 'RU', arr_time: '01:50', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },
    { day: 'FRIDAY', train: '17607', last: '17608', dep_stn: 'GNT', dep_time: '12:20', arr_stn: 'RU', arr_time: '19:20', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },

    // SATURDAY
    { day: 'SATURDAY', train: '17221', last: '17222', dep_stn: 'GNT', dep_time: '13:35', arr_stn: 'WADI', arr_time: '00:05', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },
    { day: 'SATURDAY', train: '17646', last: '17625', dep_stn: 'GNT', dep_time: '13:35', arr_stn: 'SC', arr_time: '00:05', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },
    { day: 'SATURDAY', train: '07193', last: '07194', dep_stn: 'GNT', dep_time: '05:30', arr_stn: 'KPD', arr_time: '16:30', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: 'Runs SUN' },
    { day: 'SATURDAY', train: '16358', last: '12603', dep_stn: 'GNT', dep_time: '14:00', arr_stn: 'MS', arr_time: '22:55', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' },
    { day: 'SATURDAY', train: '20629', last: '07196', dep_stn: 'GNT', dep_time: '19:10', arr_stn: 'RU', arr_time: '01:50', coaches: 'SL / AC', last_coaches: 'SL / AC', remarks: '' }
  ];

  // Preserve any existing staff assignments on the primary train number
  const existingAssignments = await all('SELECT day_of_week, train_number, assigned_staff_id, assigned_staff_name FROM non_daily_trains WHERE assigned_staff_id IS NOT NULL');
  const assignMap = {};
  existingAssignments.forEach(a => {
    assignMap[`${a.day_of_week}_${a.train_number}`] = a;
  });

  // Re-populate non_daily_trains
  await run('DELETE FROM non_daily_trains');
  
  for (const b of canonicalBeats) {
    const assigned = assignMap[`${b.day}_${b.train}`] || null;
    await run(
      `INSERT INTO non_daily_trains (day_of_week, train_number, last_day_train_number, departure_station, departure_time, arrival_station, arrival_time, coaches, last_day_coaches, remarks, assigned_staff_id, assigned_staff_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.day,
        b.train,
        b.last,
        b.dep_stn,
        b.dep_time,
        b.arr_stn,
        b.arr_time,
        b.coaches || 'SL / AC',
        b.last_coaches || 'SL / AC',
        b.remarks || null,
        assigned ? assigned.assigned_staff_id : null,
        assigned ? assigned.assigned_staff_name : null
      ]
    );
  }

  console.log(`✅ Successfully replaced table with ${canonicalBeats.length} clean beat services.`);
}

cleanNonDailyTrains().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
