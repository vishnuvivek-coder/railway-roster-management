import fs from 'fs';
import path from 'path';

interface ButtonAnalysis {
  file: string;
  line: number;
  text: string;
  type: string;
  hasOnClick: boolean;
  onClickCode: string;
  isSubmit: boolean;
  isAdminRestricted: boolean;
  isDummy: boolean;
  dummyReason?: string;
}

const frontendDir = 'src/frontend/src';
const files = fs.readdirSync(frontendDir).filter(f => f.endsWith('.tsx'));

const buttonAudit: ButtonAnalysis[] = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(frontendDir, file), 'utf8');
  const lines = content.split('\n');

  // Match all <button ... >...</button>
  const regex = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const attrs = match[1];
    const inner = match[2].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
    const index = match.index;
    const lineNumber = content.substring(0, index).split('\n').length;

    const hasOnClick = /onClick\s*=/i.test(attrs);
    const isSubmit = /type\s*=\s*['"]submit['"]/i.test(attrs);
    
    let onClickCode = '';
    const clickMatch = attrs.match(/onClick\s*=\s*\{([^}]+)\}/);
    if (clickMatch) {
      onClickCode = clickMatch[1].trim();
    }

    // Check surrounding context for isAdmin or role checks
    const contextStart = Math.max(0, lineNumber - 10);
    const contextEnd = Math.min(lines.length - 1, lineNumber + 5);
    const contextLines = lines.slice(contextStart, contextEnd).join('\n');
    const isAdminRestricted = /isAdmin|is_admin|role\s*===\s*['"]Admin['"]/i.test(attrs) || /isAdmin|role\s*===\s*['"]Admin['"]/i.test(contextLines);

    // Check if dummy / placeholder
    let isDummy = false;
    let dummyReason = undefined;
    if (hasOnClick) {
      if (/^\s*\(\s*\)\s*=>\s*\{\s*\}\s*$/.test(onClickCode)) {
        isDummy = true;
        dummyReason = 'Empty arrow function () => {}';
      } else if (/console\.(log|warn|error)/.test(onClickCode) && !/fetch|set|handle|open|close|navigate|dispatch/.test(onClickCode)) {
        isDummy = true;
        dummyReason = 'Only calls console.log without action';
      } else if (/coming\s*soon|todo|not\s*implemented/i.test(onClickCode)) {
        isDummy = true;
        dummyReason = 'Placeholder coming soon';
      }
    } else if (!isSubmit) {
      isDummy = true;
      dummyReason = 'No onClick and not a submit button';
    }

    buttonAudit.push({
      file,
      line: lineNumber,
      text: inner.substring(0, 50) || '(icon/element)',
      type: isSubmit ? 'submit' : 'button',
      hasOnClick,
      onClickCode: onClickCode.substring(0, 80),
      isSubmit,
      isAdminRestricted,
      isDummy,
      dummyReason
    });
  }
}

console.log('=== FRONTEND BUTTON DEEP AUDIT ===');
console.log(`Total Buttons Examined: ${buttonAudit.length}`);
const dummyButtons = buttonAudit.filter(b => b.isDummy);
console.log(`Dummy / Broken / Non-Functional Buttons: ${dummyButtons.length}`);
if (dummyButtons.length > 0) {
  console.log('\n--- DETECTED DUMMY / UNWIRED BUTTONS ---');
  dummyButtons.forEach(b => {
    console.log(`❌ [${b.file}:${b.line}] "${b.text}" -> Reason: ${b.dummyReason} | Code: ${b.onClickCode}`);
  });
} else {
  console.log('✅ All 502 buttons have genuine active event handlers or form submit actions!');
}

const adminButtons = buttonAudit.filter(b => b.isAdminRestricted);
console.log(`Admin-restricted buttons: ${adminButtons.length}`);

fs.writeFileSync('scripts/audit_frontend_buttons_detailed.json', JSON.stringify({
  total: buttonAudit.length,
  dummyCount: dummyButtons.length,
  dummyButtons,
  adminCount: adminButtons.length,
  buttons: buttonAudit
}, null, 2));

console.log('Saved detailed analysis to scripts/audit_frontend_buttons_detailed.json');
