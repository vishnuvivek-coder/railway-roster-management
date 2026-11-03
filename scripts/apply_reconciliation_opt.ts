import fs from 'fs';

const filePath = 'src/backend/server.ts';
let code = fs.readFileSync(filePath, 'utf8');

const startTarget = "app.get('/api/duty-register/reconciliation', async (req, res) => {";
const endTarget = "// Fetch register history logs";

const startIndex = code.indexOf(startTarget);
if (startIndex === -1) {
  console.error('startTarget not found!');
  process.exit(1);
}

const endIndex = code.indexOf(endTarget, startIndex);
if (endIndex === -1) {
  console.error('endTarget not found!');
  process.exit(1);
}

const newFunction = `app.get('/api/duty-register/reconciliation', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Date is required' });

  try {
    // Optimized: Fetch all categories, staff, overrides, entries, and crew concurrently in parallel
    const [categories, allStaff, overrides, entries, crewRows] = await Promise.all([
      all('SELECT * FROM categories ORDER BY id ASC'),
      all('SELECT * FROM staff WHERE (active = 1 OR active IS NULL) AND category_id IS NOT NULL ORDER BY category_id ASC, row_position ASC'),
      all('SELECT * FROM overrides WHERE date = ?', [date]),
      all(\`
        SELECT e.*, s.id as staff_id, s.category_id as staff_category_id 
        FROM duty_register_entry e
        JOIN duty_register_staff drs ON e.id = drs.entry_id
        JOIN staff s ON drs.staff_id = s.id
        WHERE e.date = ?
      \`, [date]),
      all(\`
        SELECT drs.entry_id, s.name
        FROM duty_register_staff drs
        JOIN staff s ON drs.staff_id = s.id
        JOIN duty_register_entry e ON drs.entry_id = e.id
        WHERE e.date = ?
      \`, [date])
    ]);

    // Build In-Memory Indexed Maps for O(1) lookups
    const overrideMap = new Map();
    for (const o of overrides) {
      overrideMap.set(o.staff_id, o);
    }

    const entryCrewMap = {};
    for (const c of crewRows) {
      if (!entryCrewMap[c.entry_id]) {
        entryCrewMap[c.entry_id] = [];
      }
      entryCrewMap[c.entry_id].push(c.name);
    }

    const actualEntryMap = new Map();
    for (const e of entries) {
      actualEntryMap.set(e.staff_id, e);
    }

    const staffByCat = new Map();
    for (const s of allStaff) {
      const list = staffByCat.get(s.category_id) || [];
      list.push(s);
      staffByCat.set(s.category_id, list);
    }

    const result = [];

    for (const cat of categories) {
      const staffMembers = staffByCat.get(cat.id) || [];
      const { anchor_date: catAnchorDate, cycle_length: catCycleLength } = getCategoryParamsForDate(cat, date);
      const dayOffset = getDayOffset(catAnchorDate, date);

      const list = [];
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
          dutyDetails = await getActiveLinkDef(cat.id, activeLink, date);
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
          crew: entryCrewMap[actualEntry.id] || []
        } : null;

        let isMismatch = false;
        let mismatchReason = '';

        if (planned.isRest) {
          if (actual) {
            isMismatch = true;
            mismatchReason = \`Rostered for REST but worked: \${actual.duty_label || actual.train_out}\`;
          }
        } else {
          if (!actual) {
            isMismatch = true;
            mismatchReason = \`Rostered for duty (\${planned.train_numbers}) but absent in register\`;
          } else {
            const pTrains = parseTrainNumbers(planned.train_numbers);
            const actTrains = [];
            if (actual.train_out) actTrains.push(actual.train_out);
            if (actual.train_return) actTrains.push(actual.train_return);

            // Match train numbers
            const trainMismatch = pTrains.length > 0 && actTrains.length > 0 &&
              !pTrains.some(pt => actTrains.some(at => at.includes(pt) || pt.includes(at)));

            // Match coaches
            const coachMismatch = planned.coaches && actual.coach_out && !isCoachCompatible(planned.coaches, actual.coach_out);

            if (trainMismatch) {
              isMismatch = true;
              mismatchReason = \`Train mismatch: Planned \${planned.train_numbers} vs Actual \${actTrains.join('/')}\`;
            } else if (coachMismatch) {
              isMismatch = true;
              mismatchReason = \`Coach mismatch: Planned \${planned.coaches} vs Actual \${actual.coach_out}\`;
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

    res.json({ date, categories: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

`;

code = code.substring(0, startIndex) + newFunction + code.substring(endIndex);
fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully updated reconciliation endpoint in src/backend/server.ts');
