import fs from 'node:fs';

const [scenario, readyFile] = process.argv.slice(2);
if (scenario === 'stubborn-tree') {
  process.on('SIGTERM', () => {});
  fs.writeFileSync(readyFile, 'ready');
}
setInterval(() => {}, 1000);
