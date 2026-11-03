import 'dotenv/config';
import mysql from 'mysql2/promise';

function parseTrainNumbers(trainStr: string | null): string[] {
  if (!trainStr || trainStr === 'REST') return [];
  const matches = trainStr.match(/\d{4,5}/g);
  return matches ? Array.from(new Set(matches)) : [];
}

function isCoachCompatible(plannedCoaches: string, actualCoach: string): boolean {
  if (!plannedCoaches || !actualCoach) return true;
  const p = plannedCoaches.toUpperCase().replace(/\s+/g, '');
  const a = actualCoach.toUpperCase().replace(/\s+/g, '');
  if (p === a) return true;
  if (p.includes(a) || a.includes(p)) return true;
  return false;
}

function getDayOffset(anchorDateStr: string, targetDateStr: string): number {
  const a = new Date(anchorDateStr + 'T00:00:00Z');
  const t = new Date(targetDateStr + 'T00:00:00Z');
  const diffTime = t.getTime() - a.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function getBaseLinkNumber(rowPosition: number, dayOffset: number, cycleLength: number): number {
  if (!cycleLength || cycleLength <= 0) return 1;
  const zeroBasedRow = rowPosition - 1;
  const raw = (zeroBasedRow + (dayOffset % cycleLength)) % cycleLength;
  const normalized = (raw + cycleLength) % cycleLength;
  return normalized + 1;
}

function getCategoryParamsForDate(cat: any, dateStr: string) {
  if (!cat) return { anchor_date: '2020-01-01', cycle_length: 21 };
  const catId = typeof cat === 'number' ? cat : (cat.id || (cat.code === 'TTI_SLEEPER' ? 2 : (cat.code === 'COR' ? 1 : (cat.code === 'LADIES_TTE' ? 3 : 4))));

  if (catId === 1 || cat.code === 'COR') {
    if (dateStr && dateStr < '2026-11-01') {
      return { anchor_date: '2026-10-01', cycle_length: 21 };
    }
    return { anchor_date: '2026-11-01', cycle_length: 21 };
  }

  if (catId === 2 || cat.code === 'TTI_SLEEPER') {
    if (dateStr && dateStr < '2026-10-01') {
      return { anchor_date: '2026-08-01', cycle_length: 63 };
    } else if (dateStr && dateStr < '2026-11-01') {
      return { anchor_date: '2026-10-01', cycle_length: 56 };
    } else {
      return { anchor_date: '2026-11-01', cycle_length: 56 };
    }
  }

  if (catId === 3 || cat.code === 'LADIES_TTE') {
    if (dateStr && dateStr < '2026-11-01') {
      return { anchor_date: '2026-10-01', cycle_length: 7 };
    }
    return { anchor_date: '2026-11-01', cycle_length: 7 };
  }

  return {
    anchor_date: cat.anchor_date || '2020-01-01',
    cycle_length: cat.cycle_length || 21
  };
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT || '25101', 10),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl: { rejectUnauthorized: false }
  });

  const all = async (sql: string, params: any[] = []) => {
    const [rows] = await conn.query(sql, params);
    return rows as any[];
  };

  const date = '2026-11-01';
  console.log(`Testing batch-optimized reconciliation query for ${date}...`);

  const t0 = performance.now();

  // 1. Fetch categories, staff, overrides, entries, crew, and published links concurrently in parallel
  const [categories, allStaff, overrides, entries, crewRows, publishedLinks] = await Promise.all([
    all('SELECT * FROM categories ORDER BY id ASC'),
    all('SELECT * FROM staff WHERE (active = 1 OR active IS NULL) AND category_id IS NOT NULL ORDER BY category_id ASC, row_position ASC'),
    all('SELECT * FROM overrides WHERE date = ?', [date]),
    all(`
      SELECT e.*, s.id as staff_id, s.category_id as staff_category_id
      FROM duty_register_entry e
      JOIN duty_register_staff drs ON e.id = drs.entry_id
      JOIN staff s ON drs.staff_id = s.id
      WHERE e.date = ?
    `, [date]),
    all(`
      SELECT drs.entry_id, s.name
      FROM duty_register_staff drs
      JOIN staff s ON drs.staff_id = s.id
      JOIN duty_register_entry e ON drs.entry_id = e.id
      WHERE e.date = ?
    `, [date]),
    all(`
      SELECT * FROM links 
      WHERE (status = 'published' OR status IS NULL OR status = '') 
        AND status != 'draft' 
        AND (link_set_id IS NULL OR link_set_id IN (SELECT id FROM link_sets WHERE status = 'published' OR status IS NULL))
    `)
  ]);

  // 2. Build In-Memory Indexed Maps
  const overrideMap = new Map<number, any>();
  for (const o of overrides) {
    overrideMap.set(o.staff_id, o);
  }

  const entryCrewMap = new Map<number, string[]>();
  for (const c of crewRows) {
    const list = entryCrewMap.get(c.entry_id) || [];
    list.push(c.name);
    entryCrewMap.set(c.entry_id, list);
  }

  // Map entry by staff_id
  const actualEntryMap = new Map<number, any>();
  for (const e of entries) {
    actualEntryMap.set(e.staff_id, e);
  }

  // Link definitions map: key = `${categoryId}_${linkNumber}`
  const linkDefMap = new Map<string, any>();
  for (const l of publishedLinks) {
    const key = `${l.category_id}_${l.link_number}`;
    if (!linkDefMap.has(key)) {
      linkDefMap.set(key, l);
    }
  }

  // Group staff by category
  const staffByCat = new Map<number, any[]>();
  for (const s of allStaff) {
    const list = staffByCat.get(s.category_id) || [];
    list.push(s);
    staffByCat.set(s.category_id, list);
  }

  // 3. Assemble reconciliation
  const result: any[] = [];

  for (const cat of categories) {
    const staffMembers = staffByCat.get(cat.id) || [];
    const { anchor_date: catAnchorDate, cycle_length: catCycleLength } = getCategoryParamsForDate(cat, date);
    const dayOffset = getDayOffset(catAnchorDate, date);

    const list: any[] = [];
    for (const staff of staffMembers) {
      const override = overrideMap.get(staff.id);
      let activeLink = null;
      let isOverridden = false;

      if (override) {
        activeLink = override.overridden_link_number;
        isOverridden = true;
      } else {
        activeLink = getBaseLinkNumber(staff.row_position, dayOffset, catCycleLength);
      }

      let dutyDetails = null;
      if (activeLink !== null) {
        dutyDetails = linkDefMap.get(`${cat.id}_${activeLink}`) || null;
      }

      const planned = {
        link_number: activeLink,
        isRest: activeLink === null || (dutyDetails && dutyDetails.is_rest === 1),
        isOverridden,
        train_numbers: dutyDetails ? dutyDetails.train_numbers : 'REST',
        from_station: dutyDetails ? dutyDetails.from_station : '',
        to_station: dutyDetails ? dutyDetails.to_station : '',
        coaches: dutyDetails ? dutyDetails.coaches : '',
        set_type: dutyDetails ? dutyDetails.set_type : 'Other / REST'
      };

      const actualEntry = actualEntryMap.get(staff.id);
      const actual = actualEntry ? {
        entryId: actualEntry.id,
        train_out: actualEntry.train_out,
        coach_out: actualEntry.coach_out,
        train_return: actualEntry.train_return,
        coach_return: actualEntry.coach_return,
        duty_label: actualEntry.duty_label,
        notes: actualEntry.notes,
        crew: entryCrewMap.get(actualEntry.id) || []
      } : null;

      let isMismatch = false;
      let mismatchReason = '';

      if (planned.isRest) {
        if (actual) {
          isMismatch = true;
          mismatchReason = `Rostered for REST but worked: ${actual.duty_label || actual.train_out}`;
        }
      } else {
        if (!actual) {
          isMismatch = true;
          mismatchReason = `Rostered for duty (${planned.train_numbers}) but absent in register`;
        } else {
          const pTrains = parseTrainNumbers(planned.train_numbers);
          const actTrains: string[] = [];
          if (actual.train_out) actTrains.push(actual.train_out);
          if (actual.train_return) actTrains.push(actual.train_return);

          // Match train numbers
          const trainMismatch = pTrains.length > 0 && actTrains.length > 0 &&
            !pTrains.some(pt => actTrains.some(at => at.includes(pt) || pt.includes(at)));

          // Match coaches
          const coachMismatch = planned.coaches && actual.coach_out && !isCoachCompatible(planned.coaches, actual.coach_out);

          if (trainMismatch) {
            isMismatch = true;
            mismatchReason = `Train mismatch: Planned ${planned.train_numbers} vs Actual ${actTrains.join('/')}`;
          } else if (coachMismatch) {
            isMismatch = true;
            mismatchReason = `Coach mismatch: Planned ${planned.coaches} vs Actual ${actual.coach_out}`;
          }
        }
      }

      list.push({
        staffId: staff.id,
        name: staff.name,
        designation: staff.designation,
        planned,
        actual,
        isMismatch,
        mismatchReason
      });
    }

    result.push({
      categoryId: cat.id,
      categoryName: cat.name,
      categoryCode: cat.code,
      reconciliation: list
    });
  }

  const t1 = performance.now();
  console.log(`Optimized Time: ${(t1 - t0).toFixed(0)} ms (${((t1 - t0) / 1000).toFixed(2)}s)`);
  console.log('Categories count:', result.length);
  const totalStaff = result.reduce((acc: number, c: any) => acc + (c.reconciliation?.length || 0), 0);
  console.log('Total reconciliation staff items:', totalStaff);
  const mismatches = result.reduce((acc: number, c: any) => acc + (c.reconciliation?.filter((r: any) => r.isMismatch).length || 0), 0);
  console.log('Total mismatches detected:', mismatches);

  await conn.end();
}

main().catch(console.error);
