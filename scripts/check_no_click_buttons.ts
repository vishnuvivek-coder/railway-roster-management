import fs from 'fs';

const inv = JSON.parse(fs.readFileSync('scripts/audit_inventory.json', 'utf8'));
const appLines = fs.readFileSync('src/frontend/src/App.tsx', 'utf8').split('\n');

console.log('--- Inspecting the 8 buttons without onClick ---');
for (const b of inv.buttonsWithoutOnClick) {
  console.log(`\nButton at ${b.file}:${b.line} -> "${b.text}"`);
  const start = Math.max(0, b.line - 15);
  const end = Math.min(appLines.length - 1, b.line + 5);
  for (let l = start; l <= end; l++) {
    const text = appLines[l];
    if (l === b.line - 1) {
      console.log(`>>> L${l + 1}: ${text}`);
    } else if (text.includes('<form') || text.includes('onSubmit') || text.includes('type="submit"') || text.includes('<button')) {
      console.log(`    L${l + 1}: ${text.trim()}`);
    }
  }
}
