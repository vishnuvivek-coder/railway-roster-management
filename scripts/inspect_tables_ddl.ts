import dotenv from 'dotenv';
dotenv.config();
import { initDb, all } from '../src/backend/db.js';

async function main() {
  await initDb();
  console.log('=== SHOW CREATE TABLE roster_versions ===');
  const rv = await all('SHOW CREATE TABLE roster_versions');
  console.log(rv[0]['Create Table']);

  console.log('\n=== SHOW CREATE TABLE staff_roster_assignments ===');
  const sra = await all('SHOW CREATE TABLE staff_roster_assignments');
  console.log(sra[0]['Create Table']);

  console.log('\n=== SHOW CREATE TABLE link_sets ===');
  const ls = await all('SHOW CREATE TABLE link_sets');
  console.log(ls[0]['Create Table']);

  console.log('\n=== SHOW CREATE TABLE links ===');
  const l = await all('SHOW CREATE TABLE links');
  console.log(l[0]['Create Table']);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
