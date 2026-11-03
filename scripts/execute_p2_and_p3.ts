import { all, run, initDb } from '../src/backend/db.js';

async function main() {
  await initDb();

  console.log('================================================================');
  console.log('EXECUTING P2: RELATIONAL INTEGRITY CLEANUP');
  console.log('================================================================');

  // Check orphaned overrides
  const orphans = await all(`
    SELECT o.id, o.staff_id, o.date, o.reason, o.status, o.created_at
    FROM overrides o
    LEFT JOIN staff s ON o.staff_id = s.id
    WHERE s.id IS NULL
  `);

  console.log(`Found ${orphans.length} orphaned override records (where staff_id no longer exists):`);
  console.table(orphans);

  if (orphans.length > 0) {
    const orphanIds = orphans.map((o: any) => o.id);
    console.log(`Deleting ${orphans.length} orphaned overrides: IDs [${orphanIds.join(', ')}]...`);
    const delResult = await run(`
      DELETE FROM overrides
      WHERE id IN (${orphanIds.join(',')})
    `);
    console.log('Delete result:', delResult);

    // Verify 0 orphans remain
    const remaining = await all(`
      SELECT o.id
      FROM overrides o
      LEFT JOIN staff s ON o.staff_id = s.id
      WHERE s.id IS NULL
    `);
    console.log(`Remaining orphaned overrides: ${remaining.length} (Target: 0)`);
    if (remaining.length === 0) {
      console.log('✅ P2 Completed: 100% Relational Integrity achieved.');
    }
  } else {
    console.log('No orphaned overrides found. Relational integrity is already 100%.');
  }

  console.log('\n================================================================');
  console.log('EXECUTING P3: DATABASE INDEXES FOR RECONCILIATION SPEED');
  console.log('================================================================');

  // Check existing indexes on duty_register_entry
  const entryIndexes = await all(`SHOW INDEX FROM duty_register_entry`);
  console.log('Current indexes on duty_register_entry:');
  console.table(entryIndexes.map((idx: any) => ({
    Table: idx.Table,
    Key_name: idx.Key_name,
    Column_name: idx.Column_name,
    Non_unique: idx.Non_unique
  })));

  const hasDateIndex = entryIndexes.some((idx: any) => idx.Column_name === 'date');
  if (!hasDateIndex) {
    console.log('Adding index idx_duty_register_entry_date on duty_register_entry(date)...');
    try {
      await run(`CREATE INDEX idx_duty_register_entry_date ON duty_register_entry(date)`);
      console.log('✅ Index idx_duty_register_entry_date created successfully.');
    } catch (err: any) {
      console.warn('Index creation notice:', err.message);
    }
  } else {
    console.log('Index on duty_register_entry(date) already exists.');
  }

  // Check existing indexes on duty_register_staff
  const staffIndexes = await all(`SHOW INDEX FROM duty_register_staff`);
  console.log('\nCurrent indexes on duty_register_staff:');
  console.table(staffIndexes.map((idx: any) => ({
    Table: idx.Table,
    Key_name: idx.Key_name,
    Column_name: idx.Column_name,
    Non_unique: idx.Non_unique
  })));

  const hasStaffIdIndex = staffIndexes.some((idx: any) => idx.Column_name === 'staff_id');
  if (!hasStaffIdIndex) {
    console.log('Adding index idx_duty_register_staff_staff_id on duty_register_staff(staff_id)...');
    try {
      await run(`CREATE INDEX idx_duty_register_staff_staff_id ON duty_register_staff(staff_id)`);
      console.log('✅ Index idx_duty_register_staff_staff_id created successfully.');
    } catch (err: any) {
      console.warn('Index creation notice:', err.message);
    }
  } else {
    console.log('Index on duty_register_staff(staff_id) already exists.');
  }

  // Check existing indexes on overrides
  const overrideIndexes = await all(`SHOW INDEX FROM overrides`);
  console.log('\nCurrent indexes on overrides:');
  console.table(overrideIndexes.map((idx: any) => ({
    Table: idx.Table,
    Key_name: idx.Key_name,
    Column_name: idx.Column_name,
    Non_unique: idx.Non_unique
  })));

  const hasOverrideDateIndex = overrideIndexes.some((idx: any) => idx.Column_name === 'date');
  if (!hasOverrideDateIndex) {
    console.log('Adding index idx_overrides_date on overrides(date)...');
    try {
      await run(`CREATE INDEX idx_overrides_date ON overrides(date)`);
      console.log('✅ Index idx_overrides_date created successfully.');
    } catch (err: any) {
      console.warn('Index creation notice:', err.message);
    }
  } else {
    console.log('Index on overrides(date) already exists.');
  }

  console.log('\nRunning EXPLAIN on reconciliation queries:');
  const explain1 = await all(`
    EXPLAIN SELECT e.*, s.id as staff_id, s.category_id as staff_category_id 
    FROM duty_register_entry e
    JOIN duty_register_staff drs ON e.id = drs.entry_id
    JOIN staff s ON drs.staff_id = s.id
    WHERE e.date = '2026-11-01'
  `);
  console.table(explain1.map((r: any) => ({
    table: r.table,
    type: r.type,
    possible_keys: r.possible_keys,
    key: r.key,
    rows: r.rows,
    Extra: r.Extra
  })));

  console.log('\n✅ P2 and P3 database updates complete.');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
