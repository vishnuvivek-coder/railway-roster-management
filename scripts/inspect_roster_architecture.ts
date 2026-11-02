import dotenv from 'dotenv';
dotenv.config();
import { initDb, all } from '../src/backend/db';

async function main() {
  await initDb();

  try {
    const sra = await all('DESCRIBE staff_roster_assignments');
    console.log('=== staff_roster_assignments ===');
    console.table(sra);
  } catch (e: any) {
    console.log('staff_roster_assignments error:', e.message);
  }

  try {
    const rv = await all('DESCRIBE roster_versions');
    console.log('=== roster_versions ===');
    console.table(rv);
  } catch (e: any) {
    console.log('roster_versions error:', e.message);
  }

  try {
    const versions = await all('SELECT * FROM roster_versions');
    console.log('=== roster_versions rows ===');
    console.table(versions);
  } catch (e: any) {
    console.log('roster_versions rows error:', e.message);
  }

  try {
    const sraCount = await all(
      'SELECT roster_version_id, effective_from, effective_to, count(*) as count FROM staff_roster_assignments GROUP BY roster_version_id, effective_from, effective_to'
    );
    console.log('=== staff_roster_assignments counts ===');
    console.table(sraCount);
  } catch (e: any) {
    console.log('sra count error:', e.message);
  }

  try {
    const linkSets = await all('SELECT * FROM link_sets');
    console.log('=== link_sets rows ===');
    console.table(linkSets);
  } catch (e: any) {
    console.log('link_sets error:', e.message);
  }
}

main().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
