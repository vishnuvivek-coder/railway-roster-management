// Production entry point for Render / Node.js
// Enables transparent execution of TypeScript backend (server.ts) on plain 'node' commands

try {
  require('tsx/cjs');
  require('./server.ts');
} catch (err) {
  const { spawn } = require('child_process');
  const path = require('path');
  const tsxCli = require.resolve('tsx/cli');
  const serverTs = path.join(__dirname, 'server.ts');
  const child = spawn(process.execPath, [tsxCli, serverTs], {
    stdio: 'inherit',
    env: process.env
  });
  child.on('exit', (code, signal) => {
    process.exit(code ?? (signal ? 1 : 0));
  });
}
