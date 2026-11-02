import fs from 'fs';
import path from 'path';

// 1. Scan Backend Endpoints
const serverCode = fs.readFileSync('src/backend/server.ts', 'utf8');
const routeRegex = /app\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/g;
let match;
const backendRoutes: { method: string; path: string; line: number }[] = [];
const lines = serverCode.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const m = line.match(/app\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/);
  if (m) {
    backendRoutes.push({ method: m[1].toUpperCase(), path: m[2], line: i + 1 });
  }
}

console.log('=== 1. BACKEND ROUTES ===');
console.log(`Total Backend Routes in server.ts: ${backendRoutes.length}`);

// Group by prefix
const routeCategories: Record<string, typeof backendRoutes> = {};
for (const r of backendRoutes) {
  const parts = r.path.split('/').filter(Boolean);
  const prefix = parts.length > 1 ? `/${parts[0]}/${parts[1]}` : `/${parts[0] || ''}`;
  if (!routeCategories[prefix]) routeCategories[prefix] = [];
  routeCategories[prefix].push(r);
}

for (const [prefix, rList] of Object.entries(routeCategories)) {
  console.log(`  ${prefix.padEnd(25)} : ${rList.length} endpoints`);
}

// 2. Scan Frontend Components & Buttons
const frontendDir = 'src/frontend/src';
const frontendFiles = fs.readdirSync(frontendDir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));

interface ButtonInfo {
  file: string;
  line: number;
  text: string;
  hasOnClick: boolean;
  onClickContent?: string;
  disabled?: boolean;
}

const allButtons: ButtonInfo[] = [];

for (const file of frontendFiles) {
  const content = fs.readFileSync(path.join(frontendDir, file), 'utf8');
  const fileLines = content.split('\n');
  
  // Find <button ... > tags
  const btnTagRegex = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  let btnMatch;
  while ((btnMatch = btnTagRegex.exec(content)) !== null) {
    const attrs = btnMatch[1];
    const inner = btnMatch[2].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
    const hasOnClick = /onClick\s*=/i.test(attrs);
    const disabled = /disabled\b/i.test(attrs);
    
    // Find line number
    const index = btnMatch.index;
    const lineNumber = content.substring(0, index).split('\n').length;
    
    let onClickSnippet = '';
    const clickMatch = attrs.match(/onClick=\{([^}]+)\}/);
    if (clickMatch) {
      onClickSnippet = clickMatch[1].trim();
    }
    
    allButtons.push({
      file,
      line: lineNumber,
      text: inner.substring(0, 40) || '(icon/element)',
      hasOnClick,
      onClickContent: onClickSnippet.substring(0, 50),
      disabled
    });
  }
}

console.log('\n=== 2. FRONTEND BUTTONS ===');
console.log(`Total Buttons detected across frontend: ${allButtons.length}`);
const buttonsWithoutOnClick = allButtons.filter(b => !b.hasOnClick && !b.disabled);
console.log(`Buttons without onClick handler: ${buttonsWithoutOnClick.length}`);
if (buttonsWithoutOnClick.length > 0) {
  console.log('Sample buttons without onClick:');
  buttonsWithoutOnClick.slice(0, 10).forEach(b => {
    console.log(`  - [${b.file}:${b.line}] "${b.text}"`);
  });
}

// Save detailed inventory JSON
fs.writeFileSync('scripts/audit_inventory.json', JSON.stringify({
  totalRoutes: backendRoutes.length,
  backendRoutes,
  totalButtons: allButtons.length,
  buttonsWithoutOnClickCount: buttonsWithoutOnClick.length,
  buttonsWithoutOnClick,
  allButtons
}, null, 2));

console.log('\nSaved full inventory to scripts/audit_inventory.json');
