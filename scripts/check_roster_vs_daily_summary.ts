import http from 'http';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'railway_roster_luxury_editorial_secret_2026';
const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, JWT_SECRET);

function fetchJson(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    http.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          } else {
            resolve(JSON.parse(data));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function compareDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-');
  console.log(`\n======================================================`);
  console.log(`Comparing Roster Grid vs Daily Summary for Date: ${dateStr}`);
  console.log(`======================================================`);

  // 1. Fetch Daily View
  const dailyView = await fetchJson(`/api/reports/daily-view?date=${dateStr}`);
  
  // 2. Fetch Roster Grid for all 4 categories
  // Categories: 1 = COR, 2 = TTI/Sleeper, 3 = Ladies, 4 = LR
  const categories = [1, 2, 3, 4];
  const rosterStaffDuties = new Map<number | string, {
    name: string;
    category_id: number;
    linkNumber: number | null;
    status: string;
    train_numbers: string;
    isRest: boolean;
  }>();

  for (const catId of categories) {
    const roster = await fetchJson(`/api/roster?category_id=${catId}&year=${year}&month=${month}`);
    if (roster && roster.rows) {
      for (const r of roster.rows) {
        const dateCell = r.cells ? r.cells.find((c: any) => c.dateStr === dateStr) : null;
        if (dateCell) {
          rosterStaffDuties.set(r.staffId, {
            name: r.staffName,
            category_id: catId,
            linkNumber: dateCell.actualLinkNumber ?? dateCell.calculatedLinkNumber,
            status: dateCell.status,
            train_numbers: dateCell.train_numbers || '',
            isRest: dateCell.isRest
          });
        }
      }
    }
  }

  console.log(`Roster Grid: Found ${rosterStaffDuties.size} staff duty assignments for ${dateStr}.`);

  // Daily View structure:
  // Let's inspect what dailyView contains
  console.log(`Daily View response keys:`, Object.keys(dailyView));
  if (dailyView.summary) {
    console.log(`Daily View summary stats:`, dailyView.summary);
  }
  if (dailyView.sections) {
    console.log(`Daily View section names:`, dailyView.sections.map((s: any) => s.title || s.name || s.id));
  }
  if (dailyView.categories) {
    console.log(`Daily View categories count:`, dailyView.categories.length);
  }

  // Flatten all staff from Daily View
  const dailyStaffDuties = new Map<number | string, any>();
  
  // Daily view can have rows or sections. Let's inspect its exact structure
  if (Array.isArray(dailyView.rows)) {
    for (const row of dailyView.rows) {
      if (row.staff_id || row.id) {
        dailyStaffDuties.set(row.staff_id || row.id, row);
      }
    }
  } else if (dailyView.sections) {
    for (const sec of dailyView.sections) {
      const items = sec.items || sec.rows || sec.staff || [];
      for (const it of items) {
        if (it.staff_id || it.id) {
          dailyStaffDuties.set(it.staff_id || it.id, { ...it, section: sec.title || sec.name });
        }
      }
    }
  } else if (dailyView.categories) {
    for (const cat of dailyView.categories) {
      const items = cat.rows || cat.staff || cat.links || [];
      for (const it of items) {
        if (it.staff_id || it.id) {
          dailyStaffDuties.set(it.staff_id || it.id, { ...it, category: cat.name });
        }
      }
    }
  }

  console.log(`Daily View: Identified ${dailyStaffDuties.size} mapped staff records.`);

  // Let's print a sample comparison
  let matched = 0;
  let mismatched = 0;
  let missingInDaily = 0;
  let missingInRoster = 0;
  const mismatchDetails: any[] = [];

  for (const [staffId, rDuty] of rosterStaffDuties.entries()) {
    if (String(staffId).startsWith('vacant-')) continue;
    const dDuty = dailyStaffDuties.get(staffId);
    if (!dDuty) {
      missingInDaily++;
      // console.log(`Staff ${staffId} (${rDuty.name}) in Roster Grid but not found directly in Daily View`);
    } else {
      // Check duty alignment
      matched++;
    }
  }

  console.log(`Summary Comparison for ${dateStr}:`);
  console.log(`- Total Staff in Roster Grid: ${rosterStaffDuties.size}`);
  console.log(`- Matched in Daily View: ${matched}`);
  console.log(`- Missing in Daily View: ${missingInDaily}`);
  console.log(`- Mismatched: ${mismatched}`);
}

async function main() {
  await compareDate('2026-10-15');
  await compareDate('2026-11-02');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
