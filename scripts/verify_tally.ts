import http from 'http';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'railway_roster_luxury_editorial_secret_2026';
const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, JWT_SECRET);

function fetchJson(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get({
      hostname: 'localhost',
      port: 5000,
      path,
      headers: { 'Authorization': `Bearer ${token}` }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

interface Discrepancy {
  staffId: string;
  name: string;
  category: string;
  rosterLink: any;
  dailyLink: any;
  rosterTrain: string;
  dailyTrain: string;
  rosterStatus: string;
  dailyStatus: string;
  issue: string;
}

async function verifyTallyForDate(dateStr: string) {
  const [year, month] = dateStr.split('-');
  console.log(`\n================================================================`);
  console.log(`🔍 DETAILED TALLY CHECK: ROSTER GRID vs DAILY SUMMARY (${dateStr})`);
  console.log(`================================================================`);

  // 1. Fetch Daily View
  const daily = await fetchJson(`/api/reports/daily-view?date=${dateStr}`);
  
  console.log(`\n--- 1. DAILY SUMMARY INTERNAL TALLY TABLE ---`);
  for (const ts of daily.tally_summary.categories) {
    const sum = ts.booked_to_duty + ts.outstation + ts.leave + ts.sick + ts.headquarters;
    const isOk = (sum === ts.total_staff) && ts.is_tallied;
    console.log(`[${isOk ? '✅ PASS' : '❌ FAIL'}] ${ts.categoryName.padEnd(25)}: Booked=${ts.booked_to_duty}, OS=${ts.outstation}, Leave=${ts.leave}, Sick=${ts.sick}, HQ=${ts.headquarters} => Sum=${sum} / Total=${ts.total_staff}`);
  }
  const gt = daily.tally_summary.grand_total;
  const gtSum = gt.booked_to_duty + gt.outstation + gt.leave + gt.sick + gt.headquarters;
  console.log(`[${gt.is_tallied ? '✅ PASS' : '❌ FAIL'}] ${'GRAND TOTAL'.padEnd(25)}: Booked=${gt.booked_to_duty}, OS=${gt.outstation}, Leave=${gt.leave}, Sick=${gt.sick}, HQ=${gt.headquarters} => Sum=${gtSum} / Total=${gt.total_staff}`);

  // 2. Compare with Roster Grid
  console.log(`\n--- 2. CROSS-MODULE ROSTER GRID vs DAILY SUMMARY COMPARISON ---`);
  const categories = [
    { id: 1, name: 'Conductors (COR)' },
    { id: 2, name: 'TTI / Sleeper Staff' },
    { id: 3, name: 'Ladies Staff / TTE' },
    { id: 4, name: 'Leave Reserve (LR) Staff' }
  ];

  let totalRosterStaff = 0;
  let totalDailyStaff = 0;
  let perfectMatches = 0;
  let dutyAligned = 0;
  const discrepancies: Discrepancy[] = [];

  for (const cat of categories) {
    const roster = await fetchJson(`/api/roster?category_id=${cat.id}&year=${year}&month=${month}`);
    const dailyCat = daily.categories.find((c: any) => c.categoryId === cat.id);
    
    const rosterRows = (roster.rows || []).filter((r: any) => !String(r.staffId).startsWith('vacant-') && r.staffName !== '(VACANT)');
    const dailyStaffList = (dailyCat ? dailyCat.staff : []).filter((s: any) => !String(s.staffId || s.id).startsWith('vacant-') && s.name !== '(VACANT)');

    totalRosterStaff += rosterRows.length;
    totalDailyStaff += dailyStaffList.length;

    // Index daily staff by staffId
    const dailyMap = new Map<string, any>();
    for (const s of dailyStaffList) {
      dailyMap.set(String(s.staffId || s.id), s);
    }

    let catMatches = 0;
    let catDiscrepancies = 0;

    for (const r of rosterRows) {
      const cell = r.cells ? r.cells.find((c: any) => c.date === dateStr) : null;
      const dStaff = dailyMap.get(String(r.staffId));

      if (!dStaff) {
        catDiscrepancies++;
        discrepancies.push({
          staffId: String(r.staffId),
          name: r.staffName,
          category: cat.name,
          rosterLink: cell ? (cell.actualLinkNumber ?? cell.calculatedLinkNumber) : '-',
          dailyLink: '-',
          rosterTrain: cell ? (cell.train_numbers || '-') : '-',
          dailyTrain: '-',
          rosterStatus: cell ? cell.status : 'N/A',
          dailyStatus: 'MISSING IN DAILY',
          issue: 'Staff found in Roster Grid but missing from Daily Summary category'
        });
        continue;
      }

      // Compare Link Number, Train Numbers, and Status
      const rLink = cell ? (cell.actualLinkNumber ?? cell.calculatedLinkNumber) : null;
      const dLink = dStaff.link_number ?? dStaff.original_link_number;

      const rTrain = cell ? (cell.effective_train_numbers || cell.train_numbers || cell.actual_train_numbers || '').trim() : '';
      const dTrain = (dStaff.train_numbers || dStaff.train_out || dStaff.duty_label || '').trim();

      const rStatus = cell ? cell.status : '';
      const dStatus = dStaff.status || (dStaff.is_rest ? 'REST' : 'DUTY');

      const isRestMatch = (cell?.isRest && (dStaff.is_rest || dStatus === 'REST' || dStaff.duty_group === 'HEADQUARTERS'));
      const isLeaveMatch = (['LEAVE', 'CL', 'LAP', 'LHAP', 'CR'].includes(rStatus) && (['LEAVE', 'CL', 'LAP', 'LHAP', 'CR'].includes(dStatus) || dStaff.duty_group === 'LEAVE'));
      const isSickMatch = (['SICK', 'S'].includes(rStatus) && (['SICK', 'S'].includes(dStatus) || dStaff.duty_group === 'SICK'));
      
      // Train Duty match: links match, or both are working duties, or overrides match
      const isDutyMatch = (!cell?.isRest && !dStaff.is_rest && (rLink === dLink || cell?.isOverridden || dStaff.isOverridden || rTrain === dTrain));

      if (isRestMatch || isLeaveMatch || isSickMatch || isDutyMatch) {
        catMatches++;
        dutyAligned++;
      } else {
        catDiscrepancies++;
        discrepancies.push({
          staffId: String(r.staffId),
          name: r.staffName,
          category: cat.name,
          rosterLink: rLink,
          dailyLink: dLink,
          rosterTrain: rTrain || (cell?.isRest ? 'REST' : '-'),
          dailyTrain: dTrain || (dStaff.is_rest ? 'REST' : '-'),
          rosterStatus: rStatus,
          dailyStatus: dStatus,
          issue: `Duty/Status divergence (Roster: ${rStatus}/${rTrain || 'REST'} vs Daily: ${dStatus}/${dTrain || 'REST'})`
        });
      }
    }

    console.log(`• ${cat.name.padEnd(25)}: Roster=${rosterRows.length} staff, Daily=${dailyStaffList.length} staff | Matches=${catMatches}, Discrepancies=${catDiscrepancies}`);
  }

  console.log(`\n--- 3. OVERALL TALLY SUMMARY FOR ${dateStr} ---`);
  console.log(`- Total Staff in Roster Grid:  ${totalRosterStaff}`);
  console.log(`- Total Staff in Daily Summary: ${totalDailyStaff}`);
  console.log(`- Duties Aligned / Tallied:    ${dutyAligned} (${((dutyAligned / totalRosterStaff) * 100).toFixed(1)}%)`);
  console.log(`- Discrepancies / Divergences: ${discrepancies.length}`);

  if (discrepancies.length === 0) {
    console.log(`\n🎉 PERFECT 100% TALLY: Every single staff member, train duty, and status in the Roster Grid matches the Daily Summary Table!`);
  } else {
    console.log(`\nDiscrepancy Details (Showing first 5):`);
    console.table(discrepancies.slice(0, 5));
  }
}

async function main() {
  await verifyTallyForDate('2026-10-15');
  await verifyTallyForDate('2026-10-31');
  await verifyTallyForDate('2026-11-01');
  await verifyTallyForDate('2026-11-02');
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
