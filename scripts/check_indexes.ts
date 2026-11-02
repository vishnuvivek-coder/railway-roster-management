import dotenv from 'dotenv';
dotenv.config();
import { initDb, all } from '../src/backend/db';

async function main() {
  await initDb();
  const tables = [
    'overrides',
    'muster_records',
    'lr_sheet_records',
    'duty_register_entry',
    'duty_register_staff',
    'staff_roster_assignments',
    'daily_earnings_entries',
    'ta_entries',
    'ta_approvals',
    'lr_duty_completions'
  ];

  for (const t of tables) {
    try {
      const idxs = await all('SHOW INDEX FROM ' + t);
      console.log('=== ' + t + ' ===');
      idxs.forEach((i: any) => console.log(`  ${i.Key_name} (${i.Column_name}, seq: ${i.Seq_in_index})`));
    } catch (e: any) {
      console.error('Error for ' + t, e.message);
    }
  }
}

main().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
