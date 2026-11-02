import dotenv from 'dotenv';
dotenv.config();
import { initDb, run, all } from '../src/backend/db';

async function main() {
  await initDb();
  console.log('--- Applying justified indexes for Phase 2.2 ---');

  // 1. overrides(substitute_staff_id, date)
  try {
    const existing = await all(`
      SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'overrides' AND INDEX_NAME = 'idx_overrides_sub_date'
    `);
    if (existing.length === 0) {
      await run('CREATE INDEX idx_overrides_sub_date ON overrides(substitute_staff_id, date)');
      console.log('✅ Created index idx_overrides_sub_date on overrides(substitute_staff_id, date)');
    } else {
      console.log('ℹ️ Index idx_overrides_sub_date already exists');
    }
  } catch (e: any) {
    console.warn('⚠️ Note on idx_overrides_sub_date:', e.message);
  }

  // 2. lr_duty_completions(arrival_date, arrival_time)
  try {
    const existing = await all(`
      SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lr_duty_completions' AND INDEX_NAME = 'idx_lrdc_arrival'
    `);
    if (existing.length === 0) {
      await run('CREATE INDEX idx_lrdc_arrival ON lr_duty_completions(arrival_date, arrival_time)');
      console.log('✅ Created index idx_lrdc_arrival on lr_duty_completions(arrival_date, arrival_time)');
    } else {
      console.log('ℹ️ Index idx_lrdc_arrival already exists');
    }
  } catch (e: any) {
    console.warn('⚠️ Note on idx_lrdc_arrival:', e.message);
  }

  // 3. ta_approvals(staff_id, duty_date)
  try {
    const existing = await all(`
      SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ta_approvals' AND INDEX_NAME = 'idx_ta_approvals_staff_date'
    `);
    if (existing.length === 0) {
      await run('CREATE INDEX idx_ta_approvals_staff_date ON ta_approvals(staff_id, duty_date)');
      console.log('✅ Created index idx_ta_approvals_staff_date on ta_approvals(staff_id, duty_date)');
    } else {
      console.log('ℹ️ Index idx_ta_approvals_staff_date already exists');
    }
  } catch (e: any) {
    console.warn('⚠️ Note on idx_ta_approvals_staff_date:', e.message);
  }

  console.log('--- Done applying indexes ---');
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error applying indexes:', err);
  process.exit(1);
});
