const fs = require('fs');

const filePath = 'src/backend/server.ts';
let code = fs.readFileSync(filePath, 'utf8');

const target = `    const txResult = await withTransaction(async () => {`;
const replacement = `    console.time('[CHANGE-STATUS] TOTAL TX');
    const txResult = await withTransaction(async () => {`;

const targetEnd = `    return txResult;`;
const replacementEnd = `    console.timeEnd('[CHANGE-STATUS] TOTAL TX');
    return txResult;`;

if (!code.includes(target)) {
  console.error('target not found');
  process.exit(1);
}

code = code.replace(target, replacement).replace(targetEnd, replacementEnd);
fs.writeFileSync(filePath, code, 'utf8');
console.log('Timing probes added');
