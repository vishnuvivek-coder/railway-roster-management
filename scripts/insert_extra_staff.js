const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'src', 'backend', 'server.ts');
let content = fs.readFileSync(serverPath, 'utf8');

const target = `    const nonDailyTrains = allNonDailyTrains.filter((t: any) => (t.day_of_week || '').toUpperCase() === currentDayName);`;

const extra = `    // Ensure any staff in dregList is included in allStaff if not already present
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
    }

    const nonDailyTrains = allNonDailyTrains.filter((t: any) => (t.day_of_week || '').toUpperCase() === currentDayName);`;

if (content.includes(target)) {
  content = content.replace(target, extra);
  fs.writeFileSync(serverPath, content, 'utf8');
  console.log('extraStaff logic inserted successfully!');
} else {
  console.error('Target not found!');
}
