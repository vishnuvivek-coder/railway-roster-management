const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'src', 'backend', 'server.ts');
let content = fs.readFileSync(serverPath, 'utf8');

// 1. Add extraStaff inclusion after dregEntries7d prefetch
const target1 = `       all(\`SELECT e.*, ds.staff_id
           FROM duty_register_entry e
           JOIN duty_register_staff ds ON ds.entry_id = e.id
           WHERE e.date >= ? AND e.date <= ?
           ORDER BY e.date DESC\`, [dMinus7Str, targetDateStr])
    ]);`;

const repl1 = `       all(\`SELECT e.*, ds.staff_id
           FROM duty_register_entry e
           JOIN duty_register_staff ds ON ds.entry_id = e.id
           WHERE e.date >= ? AND e.date <= ?
           ORDER BY e.date DESC\`, [dMinus7Str, targetDateStr])
    ]);

    // Ensure any staff in dregList is included in allStaff if not already present
    for (const dr of dregList) {
      if (!allStaff.some((s: any) => String(s.id) === String(dr.staff_id))) {
        const [extraStaff] = await all('SELECT * FROM staff WHERE id = ?', [dr.staff_id]);
        if (extraStaff) {
          allStaff.push({
            ...extraStaff,
            row_position: extraStaff.row_position || 999
          });
        }
      }
    }`;

// 2. Map key types (String and Number)
const target2 = `    const lrMap = new Map();
    for (const lr of lrList) {
      lrMap.set(lr.staff_id, lr);
    }

    const dregMap = new Map();
    for (const dr of dregList) {
      dregMap.set(dr.staff_id, dr);
    }`;

const repl2 = `    const lrMap = new Map();
    for (const lr of lrList) {
      lrMap.set(String(lr.staff_id), lr);
      lrMap.set(Number(lr.staff_id), lr);
    }

    const dregMap = new Map();
    for (const dr of dregList) {
      dregMap.set(String(dr.staff_id), dr);
      dregMap.set(Number(dr.staff_id), dr);
    }`;

// 3. Lookups in Cat 4
const target3 = `          const lrRecord = lrMap.get(staff.id);
          const override = overridesMap[\`\${staff.id}_\${targetDateStr}\`];
          const musterRecord = musterMap[\`\${staff.id}_\${targetDateStr}\`];
          const dregRecord = dregMap.get(staff.id);`;

const repl3 = `          const lrRecord = lrMap.get(String(staff.id)) || lrMap.get(Number(staff.id));
          const override = overridesMap[\`\${staff.id}_\${targetDateStr}\`];
          const musterRecord = musterMap[\`\${staff.id}_\${targetDateStr}\`];
          const dregRecord = dregMap.get(String(staff.id)) || dregMap.get(Number(staff.id));`;

// 4. Coaches in Cat 4
const target4 = `coaches: (status === 'AVAILABLE_FOR_BOOKING' || status === 'REST' || status === 'LEAVE' || status === 'SICK' || status === 'CR' || status === 'ABSENT') ? '-' : (activeExtraTrain ? 'SL / AC' : 'SL'),`;
const repl4 = `coaches: (status === 'AVAILABLE_FOR_BOOKING' || status === 'REST' || status === 'LEAVE' || status === 'SICK' || status === 'CR' || status === 'ABSENT') ? '-' : (effCoachOut || (activeExtraTrain ? 'SL / AC' : 'SL')),`;

// 5. Lookup in Cats 1-3
const target5 = `        const override = overridesMap[\`\${staff.id}_\${targetDateStr}\`];
        const dregRecord = dregMap.get(staff.id);`;

const repl5 = `        const override = overridesMap[\`\${staff.id}_\${targetDateStr}\`];
        const dregRecord = dregMap.get(String(staff.id)) || dregMap.get(Number(staff.id));`;

let replaced = 0;
// Normalize line endings for replacement
const normalize = s => s.replace(/\r\n/g, '\n');

if (normalize(content).includes(normalize(target1))) {
  content = normalize(content).replace(normalize(target1), normalize(repl1));
  replaced++;
  console.log('Target 1 matched and replaced');
} else {
  console.log('Target 1 NOT matched');
}

if (normalize(content).includes(normalize(target2))) {
  content = normalize(content).replace(normalize(target2), normalize(repl2));
  replaced++;
  console.log('Target 2 matched and replaced');
} else {
  console.log('Target 2 NOT matched');
}

if (normalize(content).includes(normalize(target3))) {
  content = normalize(content).replace(normalize(target3), normalize(repl3));
  replaced++;
  console.log('Target 3 matched and replaced');
} else {
  console.log('Target 3 NOT matched');
}

if (normalize(content).includes(normalize(target4))) {
  content = normalize(content).replace(normalize(target4), normalize(repl4));
  replaced++;
  console.log('Target 4 matched and replaced');
} else {
  console.log('Target 4 NOT matched');
}

if (normalize(content).includes(normalize(target5))) {
  content = normalize(content).replace(normalize(target5), normalize(repl5));
  replaced++;
  console.log('Target 5 matched and replaced');
} else {
  console.log('Target 5 NOT matched');
}

fs.writeFileSync(serverPath, content, 'utf8');
console.log(`Finished applying fixes. ${replaced}/5 applied.`);
