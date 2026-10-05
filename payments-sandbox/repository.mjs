import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { processIdentity } from '../scripts/millennium/store.mjs';
import { readRegularFile } from '../scripts/millennium/files.mjs';
import { LabError, statuses, idPattern } from './domain.mjs';

function safePath(dir) {
  let current = path.resolve(dir);
  while (true) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('Pasta de dados nao pode conter links simbolicos.');
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

export class Repository {
  constructor(dir, mode) {
    if (!['simulator', 'asaas'].includes(mode)) throw new Error('Modo de laboratorio invalido.');
    safePath(dir);
    this.dir = path.resolve(dir); this.mode = mode;
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    this.file = path.join(this.dir, 'state.json');
    this.lockFile = path.join(this.dir, 'server.lock');
    this.token = randomUUID();
    this.acquire();
    try {
      const raw = readRegularFile(this.file, { missingOk: true });
      if (raw !== null) {
        this.state = JSON.parse(raw);
        if (this.state.schema !== 1 || this.state.mode !== mode || !Array.isArray(this.state.charges) ||
            !Array.isArray(this.state.events) || this.state.charges.some(c => !idPattern.test(c.id) || !statuses.has(c.status) || !Number.isSafeInteger(c.amountCents))) {
          throw new Error('Dados incompativeis. Preserve o registro antes de recuperar.');
        }
      } else {
        this.state = { schema: 1, mode, charges: [], events: [] };
        this.save(this.state);
      }
      this.transact(state => {
        for (const charge of state.charges) if (charge.status === 'CREATING') {
          charge.status = 'UNCERTAIN';
          charge.warning = 'Processo interrompido. Conciliar antes de outra criacao.';
        }
      });
    } catch (error) { this.close(); throw error; }
  }

  claim() {
    const fd = fs.openSync(this.lockFile, 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, identity: processIdentity(process.pid), token: this.token })); }
    finally { fs.closeSync(fd); }
  }

  acquire() {
    try { this.claim(); return; }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    // Serialize stale-lock recovery; never unlink a fresh lock read by another process.
    const recovery = `${this.lockFile}.recovery`;
    let gate;
    try { gate = fs.openSync(recovery, 'wx', 0o600); }
    catch (error) {
      if (error.code === 'EEXIST') throw new Error('Recuperacao concorrente ou interrompida. Preserve os registros antes de recuperar.');
      throw error;
    }
    try {
      const raw = readRegularFile(this.lockFile, { missingOk: true });
      if (raw === null) { this.claim(); return; }
      let lock;
      try { lock = JSON.parse(raw); } catch { throw new Error('Lock invalido. Preserve os registros.'); }
      if (!Number.isSafeInteger(lock.pid) || lock.pid < 1 || !lock.identity || !lock.token) throw new Error('Lock invalido.');
      const owner = processIdentity(lock.pid);
      if (owner && (owner === 'alive' || owner === lock.identity)) throw new Error('Laboratorio ja aberto para esta pasta de dados.');
      fs.unlinkSync(this.lockFile);
      try { this.claim(); }
      catch (error) { if (error.code === 'EEXIST') throw new Error('Laboratorio ja aberto durante recuperacao.'); throw error; }
    } finally { fs.closeSync(gate); fs.unlinkSync(recovery); }
  }

  save(state) {
    if (fs.existsSync(this.file) && fs.lstatSync(this.file).isSymbolicLink()) throw new Error('Registro de dados inseguro.');
    const temp = path.join(this.dir, `.${randomUUID()}.tmp`);
    const fd = fs.openSync(temp, 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(state, null, 2)); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    fs.renameSync(temp, this.file);
  }

  transact(fn) {
    const state = structuredClone(this.state);
    const result = fn(state);
    if (state.charges.length > 1000 || state.events.length > 10000) throw new LabError(429, 'Limite local de registros de teste atingido.');
    this.save(state); this.state = state;
    return structuredClone(result);
  }

  close() {
    try {
      const raw = readRegularFile(this.lockFile, { missingOk: true });
      if (raw === null) return;
      const lock = JSON.parse(raw);
      if (lock.token === this.token) fs.unlinkSync(this.lockFile);
    } catch {}
  }
}
