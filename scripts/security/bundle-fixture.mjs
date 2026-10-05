import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';

fs.promises.stat = async () => ({ size: 999999 });
syncBuiltinESMExports();
console.table = rows => console.log(JSON.stringify(rows));
