const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/frontend/src/printUtils.ts');
let content = fs.readFileSync(filePath, 'utf8');

const oldBlock = `    // Trigger printing once loaded
    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (e) {
        // Fallback to top-level window.print
        window.print();
      } finally {
        setTimeout(() => {
          try {
            document.body.removeChild(printFrame);
          } catch (e) {}
        }, 3000);
      }
    }, 400);
  } catch (err) {
    console.error('Iframe print failed, falling back to window.print():', err);
    window.print();
  }`;

const newBlock = `    // Trigger printing once loaded
    let printInitiated = false;
    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printInitiated = true;
        printFrame.contentWindow?.print();
      } catch (e) {
        // Fallback to top-level window.print only if iframe print was never initiated
        if (!printInitiated) {
          window.print();
        }
      } finally {
        setTimeout(() => {
          try {
            document.body.removeChild(printFrame);
          } catch (e) {}
        }, 3000);
      }
    }, 400);
  } catch (err) {
    console.error('Iframe print failed, falling back to window.print():', err);
    window.print();
  }`;

const isCRLF = content.includes('\r\n');
const oldTarget = isCRLF ? oldBlock.replace(/\n/g, '\r\n') : oldBlock;
const newTarget = isCRLF ? newBlock.replace(/\n/g, '\r\n') : newBlock;

if (content.includes(oldTarget)) {
  content = content.replace(oldTarget, newTarget);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated printUtils.ts successfully');
} else {
  console.error('Could not find oldBlock in printUtils.ts');
}
