import dotenv from 'dotenv';
dotenv.config();
import { initDb, all } from '../src/backend/db.js';

async function main() {
  await initDb();
  console.log('=== Finding SK KHASIM and R SAIDA NAIK ===');
  const khasim = await all("SELECT * FROM staff WHERE name LIKE '%KHASIM%'");
  console.log('KHASIM in staff:', khasim);

  const saida = await all("SELECT * FROM staff WHERE name LIKE '%SAIDA NAIK%'");
  console.log('SAIDA NAIK in staff:', saida);

  const khasimAssign = await all("SELECT * FROM staff_roster_assignments WHERE staff_name LIKE '%KHASIM%'");
  console.log('KHASIM in assignments:', khasimAssign);

  const saidaAssign = await all("SELECT * FROM staff_roster_assignments WHERE staff_name LIKE '%SAIDA NAIK%'");
  console.log('SAIDA NAIK in assignments:', saidaAssign);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
