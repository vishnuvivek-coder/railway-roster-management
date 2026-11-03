const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/frontend/src/TaDocument.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update CSS
const oldCss = `.ta-page-sheet:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }`;
const newCss = `.ta-page-sheet:last-child,
          .ta-page-sheet:last-of-type,
          .ta-page-sheet.single-sheet {
            page-break-after: auto !important;
            break-after: auto !important;
          }`;

if (content.includes(oldCss)) {
  content = content.replace(oldCss, newCss);
  console.log('Updated print CSS in TaDocument.tsx');
} else {
  // Try CRLF
  const oldCssCRLF = oldCss.replace(/\n/g, '\r\n');
  const newCssCRLF = newCss.replace(/\n/g, '\r\n');
  if (content.includes(oldCssCRLF)) {
    content = content.replace(oldCssCRLF, newCssCRLF);
    console.log('Updated print CSS (CRLF) in TaDocument.tsx');
  } else {
    console.error('Could not find oldCss in TaDocument.tsx');
  }
}

// 2. Add single-sheet class to Page 1
const oldP1 = '<div className="ta-page-sheet ta-document-paper printable-document-sheet" style={{';
const newP1 = '<div className={`ta-page-sheet ta-document-paper printable-document-sheet ${page2Rows.length === 0 ? \'single-sheet\' : \'\'}`} style={{';
if (content.includes(oldP1)) {
  content = content.replace(oldP1, newP1);
  console.log('Added single-sheet class to Page 1');
} else {
  console.error('Could not find oldP1 in TaDocument.tsx');
}

// 3. Wrap Page 2 with page2Rows.length > 0
const p2Start = `{/* ====================================================
             PAGE 2 OF 2 (EXACT REPLICA OF EXCEL SHEET 2)
             ==================================================== */}`;
const p2StartCRLF = p2Start.replace(/\n/g, '\r\n');

const p2NewStart = `{/* ====================================================
             PAGE 2 OF 2 (EXACT REPLICA OF EXCEL SHEET 2)
             ==================================================== */}
          {page2Rows.length > 0 && (`.replace(/\n/g, content.includes('\r\n') ? '\r\n' : '\n');

if (content.includes(p2StartCRLF)) {
  content = content.replace(p2StartCRLF, p2NewStart);
  console.log('Added Page 2 opening guard');
} else if (content.includes(p2Start)) {
  content = content.replace(p2Start, p2NewStart);
  console.log('Added Page 2 opening guard (LF)');
} else {
  console.error('Could not find p2Start in TaDocument.tsx');
}

// Now find end of Page 2
const p2EndTarget = `                  <div>
                    <input
                      type="text"
                      value={editableMeta.designation_sign}
                      onChange={(e) => handleMetaChange('designation_sign', e.target.value)}
                      style={{ fontWeight: 'bold', textAlign: 'center', border: 'none', background: 'transparent', outline: 'none', fontSize: '9.5px', width: '160px' }}
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>`;

const p2EndTargetCRLF = p2EndTarget.replace(/\n/g, '\r\n');
const p2NewEnd = (p2EndTarget + '\n          )}').replace(/\n/g, content.includes('\r\n') ? '\r\n' : '\n');

if (content.includes(p2EndTargetCRLF)) {
  content = content.replace(p2EndTargetCRLF, p2NewEnd);
  console.log('Added Page 2 closing guard');
} else if (content.includes(p2EndTarget)) {
  content = content.replace(p2EndTarget, p2NewEnd);
  console.log('Added Page 2 closing guard (LF)');
} else {
  console.error('Could not find p2EndTarget in TaDocument.tsx');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Saved TaDocument.tsx successfully');
