const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('src/backend/roster.db');

function generateDigitalSignatureSvg(name, designation, pfNo) {
  const cleanName = (name || 'Railway Employee').trim();
  const cleanDesig = (designation || 'Staff').trim();
  const cleanPf = (pfNo && String(pfNo).trim() !== '07323475') ? String(pfNo).trim() : 'IR-VERIFIED';

  // Capitalize properly (e.g. K V RAMANA RAO -> K. V. Ramana Rao)
  const titleCaseName = cleanName
    .split(' ')
    .filter(Boolean)
    .map(w => w.length <= 2 ? w.toUpperCase() : (w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 82" width="280" height="82">
    <text x="140" y="34" font-family="'Brush Script MT', 'Caveat', 'Segoe Script', 'Apple Chancery', cursive" font-size="26" font-style="italic" font-weight="bold" fill="#002b66" text-anchor="middle">
      ${titleCaseName}
    </text>
    <path d="M 45 42 Q 140 47, 235 41" fill="none" stroke="#002b66" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
    <rect x="20" y="49" width="240" height="28" rx="4" fill="#f0fdf4" stroke="#16a34a" stroke-width="0.8" stroke-dasharray="3,2"/>
    <text x="140" y="61" font-family="Arial, sans-serif" font-size="8" font-weight="bold" fill="#15803d" text-anchor="middle" letter-spacing="0.6">
      ✓ DIGITALLY SIGNED • INDIAN RAILWAYS
    </text>
    <text x="140" y="72" font-family="Arial, sans-serif" font-size="7" font-weight="600" fill="#374151" text-anchor="middle">
      ${cleanDesig} • PF: ${cleanPf}
    </text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

db.serialize(() => {
  db.run('ALTER TABLE staff ADD COLUMN signature_data TEXT', (err) => {
    if (err && !err.message.includes('duplicate column')) console.log('ALTER signature_data:', err.message);
  });
  db.run('ALTER TABLE staff ADD COLUMN signature_updated_at TEXT', (err) => {
    if (err && !err.message.includes('duplicate column')) console.log('ALTER signature_updated_at:', err.message);
  });

  db.all('SELECT id, name, designation, pf_no FROM staff', (err, rows) => {
    if (err) {
      console.error('Error querying staff:', err);
      return;
    }
    console.log(`Found ${rows.length} staff members.`);
    const stmt = db.prepare('UPDATE staff SET signature_data = ?, signature_updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    let count = 0;
    for (const s of rows) {
      const sig = generateDigitalSignatureSvg(s.name, s.designation, s.pf_no);
      stmt.run(sig, s.id);
      count++;
    }
    stmt.finalize(() => {
      console.log(`Successfully populated digital signatures for all ${count} employees in roster.db!`);
      db.get('SELECT count(*) as total, count(signature_data) as signed FROM staff', (err, res) => {
        console.log('Verification:', res);
        db.close();
      });
    });
  });
});
