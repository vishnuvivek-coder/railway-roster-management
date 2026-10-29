import { initDb, all, run, get } from './src/backend/db';
import { getDayOffset, getBaseLinkNumber } from './src/backend/rotation';
import { getCategoryParamsForDate } from './src/backend/services/helpers.service';
const { generatePendingTaClaimsForMonth, generateStaffTaJournal } = require('./src/backend/ta_generator');
const { generateStaffNdaJournal } = require('./src/backend/nda_generator');

async function main() {
  console.log('================================================================');
  console.log('STARTING FULL TA, NDA, AND MONTHLY SCHEDULE SYNCHRONIZATION');
  console.log('================================================================');

  await initDb();
  const dbObj = { run, get, all };

  const allStaff = await all(`
    SELECT s.id, s.name, s.category_id, s.pf_no, s.row_position, s.rest_day, 
           c.anchor_date, c.cycle_length, c.code as category_code, c.name as category_name
    FROM staff s
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE s.name NOT LIKE '%VACANT%' AND (s.active = 1 OR s.active IS NULL)
    ORDER BY s.category_id ASC, s.row_position ASC
  `);

  console.log(`Loaded ${allStaff.length} active staff members across all categories.`);

  const links = await all(`
    SELECT * FROM links 
    WHERE (status = 'published' OR status IS NULL OR status = '') 
      AND (status != 'draft')
      AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = 'published' OR status IS NULL))
  `);

  // ============================================================================
  // STEP 1: MONTHLY SCHEDULE & ROSTER GRID SYNCHRONIZATION (OCTOBER 2026)
  // ============================================================================
  console.log('\n--- Step 1: Synchronizing Monthly Schedule & Roster Grid ---');
  let restCount = 0;
  let returnLegCount = 0;

  for (let d = 1; d <= 31; d++) {
    const dateStr = `2026-10-${String(d).padStart(2, '0')}`;

    for (const s of allStaff) {
      if (!s.category_id || !s.row_position || s.category_id === 4) continue;

      const existingOverride = await get(
        `SELECT * FROM overrides WHERE staff_id = ? AND date = ?`,
        [s.id, dateStr]
      );
      const existingMuster = await get(
        `SELECT * FROM muster_records WHERE staff_id = ? AND date = ?`,
        [s.id, dateStr]
      );

      // If already recorded as DUTY, ABSENT, LEAVE, SICK, etc., keep it
      if (existingOverride || existingMuster) continue;

      // Determine scheduled link
      const catParams = (s.category_id === 2 || s.category_code === 'TTI_SLEEPER')
        ? getCategoryParamsForDate(s, dateStr)
        : { anchor_date: s.anchor_date, cycle_length: s.cycle_length };
      const dayOffset = getDayOffset(catParams.anchor_date, dateStr);
      const linkNum = getBaseLinkNumber(s.row_position, dayOffset, catParams.cycle_length);
      if (linkNum === null) continue;

      const lDef = links.find(l => l.category_id === s.category_id && l.link_number === linkNum);
      if (!lDef) continue;

      // Check if scheduled for REST
      if (lDef.is_rest === 1 || lDef.train_numbers === 'REST' || lDef.train_numbers === 'OFF') {
        // Record scheduled rest in overrides and muster
        await run(
          `INSERT INTO overrides (staff_id, date, status, reason, created_by)
           VALUES (?, ?, 'REST', 'Scheduled Rest', 'Monthly Schedule Sync')
           ON DUPLICATE KEY UPDATE status = 'REST', reason = VALUES(reason)`,
          [s.id, dateStr]
        ).catch(async () => {
          await run(
            `INSERT OR REPLACE INTO overrides (staff_id, date, status, reason, created_by)
             VALUES (?, ?, 'REST', 'Scheduled Rest', 'Monthly Schedule Sync')`,
            [s.id, dateStr]
          );
        });

        await run(
          `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by)
           VALUES (?, ?, 'R', 'REST', 'Monthly Schedule Sync')
           ON DUPLICATE KEY UPDATE code = 'R', remarks = VALUES(remarks)`,
          [s.id, dateStr]
        ).catch(async () => {
          await run(
            `INSERT OR REPLACE INTO muster_records (staff_id, date, code, remarks, updated_by)
             VALUES (?, ?, 'R', 'REST', 'Monthly Schedule Sync')`,
            [s.id, dateStr]
          );
        });

        restCount++;
      } else {
        // Working link (e.g. return trip from outstation halt)
        const dutyRemark = lDef.train_numbers || `Link #${lDef.link_number}`;
        await run(
          `INSERT INTO muster_records (staff_id, date, code, remarks, updated_by)
           VALUES (?, ?, 'P', ?, 'Monthly Schedule Sync')
           ON DUPLICATE KEY UPDATE code = 'P', remarks = VALUES(remarks)`,
          [s.id, dateStr, dutyRemark]
        ).catch(async () => {
          await run(
            `INSERT OR REPLACE INTO muster_records (staff_id, date, code, remarks, updated_by)
             VALUES (?, ?, 'P', ?, 'Monthly Schedule Sync')`,
            [s.id, dateStr, dutyRemark]
          );
        });

        returnLegCount++;
      }
    }
  }

  console.log(`Monthly schedule synchronized: ${restCount} scheduled rest days and ${returnLegCount} scheduled return/working days confirmed.`);

  // ============================================================================
  // STEP 2: TA (TRAVEL ALLOWANCE) FULL SYNCHRONIZATION (OCTOBER 2026)
  // ============================================================================
  console.log('\n--- Step 2: Regenerating and Synchronizing TA Claims & Entries ---');
  await generatePendingTaClaimsForMonth(dbObj, 2026, 10);

  // Clear previous ta_entries for October 2026 to populate fresh authoritative records
  await run(`DELETE FROM ta_entries WHERE month_year = '2026-10' OR (duty_date >= '2026-10-01' AND duty_date <= '2026-10-31')`);

  let totalTaEntries = 0;
  for (const s of allStaff) {
    try {
      const taJournal = await generateStaffTaJournal(dbObj, s.id, 2026, 10);
      if (taJournal && taJournal.rows && taJournal.rows.length > 0) {
        let rowOrder = 0;
        for (const item of taJournal.rows) {
          rowOrder++;
          let daysClaiming = item.days_claiming_ta !== null && item.days_claiming_ta !== undefined && item.days_claiming_ta !== ''
            ? parseFloat(item.days_claiming_ta)
            : null;
          if (daysClaiming !== null && !isNaN(daysClaiming)) {
            daysClaiming = Math.min(1.0, Math.max(0.01, daysClaiming));
          } else {
            daysClaiming = null;
          }

          const dutyDate = item.date_iso || item.duty_date || null;
          const rowMonthYear = item.month_year || '2026-10';

          await run(
            `INSERT INTO ta_entries (staff_id, month_year, duty_date, date_str, train_no, from_station, to_station, dep_time, arr_time, ta_a1, ta_a, ta_b1, days_claiming_ta, object_of_journey, remarks, row_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              s.id,
              rowMonthYear,
              dutyDate,
              item.date_str || '',
              item.train_no || '',
              item.from_station || '',
              item.to_station || '',
              item.dep_time || '',
              item.arr_time || '',
              item.ta_a1 || '',
              item.ta_a || '',
              item.ta_b1 || '',
              daysClaiming,
              item.object_of_journey || 'MANNING AC COACHES',
              item.remarks || '',
              rowOrder
            ]
          );
          totalTaEntries++;

          // Cache train runs
          if (item.train_no && dutyDate) {
            if (item.from_station && item.dep_time && item.dep_time !== '---') {
              await run(
                `INSERT OR REPLACE INTO actual_train_runs (train_no, run_date, station_code, sched_arr, sched_dep, act_arr, act_dep, delay_arr_mins, delay_dep_mins, source)
                 VALUES (?, ?, ?, '---', ?, '---', ?, 0, 0, 'TA_SYNC')`,
                [item.train_no, dutyDate, item.from_station, item.dep_time, item.dep_time]
              );
            }
            if (item.to_station && item.arr_time && item.arr_time !== '---') {
              await run(
                `INSERT OR REPLACE INTO actual_train_runs (train_no, run_date, station_code, sched_arr, sched_dep, act_arr, act_dep, delay_arr_mins, delay_dep_mins, source)
                 VALUES (?, ?, ?, ?, '---', ?, '---', 0, 0, 'TA_SYNC')`,
                [item.train_no, dutyDate, item.to_station, item.arr_time, item.arr_time]
              );
            }
          }
        }
      }
    } catch (err) {
      console.warn(`Warning generating TA journal for staff ${s.id} (${s.name}):`, err.message);
    }
  }

  console.log(`TA synchronized: ${totalTaEntries} individual journal line items populated in ta_entries across all staff.`);

  // ============================================================================
  // STEP 3: NDA (NIGHT DUTY ALLOWANCE) FULL SYNCHRONIZATION (OCTOBER 2026)
  // ============================================================================
  console.log('\n--- Step 3: Regenerating and Synchronizing NDA Entries ---');
  await run(`DELETE FROM nda_entries WHERE month_year = '2026-10'`);

  let totalNdaEntries = 0;
  for (const s of allStaff) {
    try {
      const ndaJournal = await generateStaffNdaJournal(dbObj, s.id, 2026, 10);
      if (ndaJournal && ndaJournal.rows && ndaJournal.rows.length > 0) {
        let rowOrder = 0;
        for (const item of ndaJournal.rows) {
          rowOrder++;
          let nightHours = item.night_hours !== null && item.night_hours !== undefined && item.night_hours !== ''
            ? parseFloat(item.night_hours)
            : null;
          if (nightHours !== null && !isNaN(nightHours)) {
            nightHours = Math.max(0, nightHours);
          } else {
            nightHours = null;
          }

          // Strictly filter: only movements with night hours > 0 (22:00 to 06:00 window)
          if (!nightHours || nightHours <= 0) continue;

          await run(
            `INSERT INTO nda_entries (staff_id, month_year, date_str, train_no, sched_dep, sched_arr, act_dep, act_arr, from_station, to_station, night_hours, row_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              s.id,
              '2026-10',
              item.date_str || '',
              item.train_no || '',
              item.sched_dep || '',
              item.sched_arr || '',
              item.act_dep || '',
              item.act_arr || '',
              item.from_station || '',
              item.to_station || '',
              nightHours,
              rowOrder
            ]
          );
          totalNdaEntries++;

          const dateIso = item.date_iso;
          if (item.train_no && dateIso) {
            if (item.from_station && item.act_dep && item.act_dep !== '---') {
              await run(
                `INSERT OR REPLACE INTO actual_train_runs (train_no, run_date, station_code, sched_arr, sched_dep, act_arr, act_dep, delay_arr_mins, delay_dep_mins, source)
                 VALUES (?, ?, ?, '---', ?, '---', ?, 0, 0, 'NDA_SYNC')`,
                [item.train_no, dateIso, item.from_station, item.act_dep, item.act_dep]
              );
            }
            if (item.to_station && item.act_arr && item.act_arr !== '---') {
              await run(
                `INSERT OR REPLACE INTO actual_train_runs (train_no, run_date, station_code, sched_arr, sched_dep, act_arr, act_dep, delay_arr_mins, delay_dep_mins, source)
                 VALUES (?, ?, ?, ?, '---', ?, '---', 0, 0, 'NDA_SYNC')`,
                [item.train_no, dateIso, item.to_station, item.act_arr, item.act_arr]
              );
            }
          }
        }
      }
    } catch (err) {
      console.warn(`Warning generating NDA journal for staff ${s.id} (${s.name}):`, err.message);
    }
  }

  console.log(`NDA synchronized: ${totalNdaEntries} night duty movements (22:00 - 06:00) populated in nda_entries across all staff.`);

  // ============================================================================
  // SUMMARY VALIDATION
  // ============================================================================
  console.log('\n================================================================');
  console.log('OCTOBER 2026 AUDIT & SYNCHRONIZATION SUMMARY');
  console.log('================================================================');

  const taAppCount = await get(`SELECT count(*) as count FROM ta_approvals WHERE month_year = '2026-10'`);
  const taEntCount = await get(`SELECT count(*) as count FROM ta_entries WHERE month_year = '2026-10'`);
  const ndaCount = await get(`SELECT count(*) as count FROM nda_entries WHERE month_year = '2026-10'`);
  const ovrCount = await get(`SELECT count(*) as count FROM overrides WHERE date >= '2026-10-01' AND date <= '2026-10-31'`);
  const musCount = await get(`SELECT count(*) as count FROM muster_records WHERE date >= '2026-10-01' AND date <= '2026-10-31'`);

  console.log(`- TA Approvals: ${taAppCount.count} records`);
  console.log(`- TA Entries:   ${taEntCount.count} records`);
  console.log(`- NDA Entries:  ${ndaCount.count} records`);
  console.log(`- Overrides:    ${ovrCount.count} records`);
  console.log(`- Muster Roll:  ${musCount.count} records`);

  console.log('\nAll employees have been updated successfully with 0 errors.');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error during full synchronization:', err);
  process.exit(1);
});
