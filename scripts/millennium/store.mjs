import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { project, requireFeature, fingerprint, git } from './project.mjs';
import { readRegularFile } from './files.mjs';

const now = () => new Date().toISOString();
const states = new Set(['planejada', 'executando', 'aguardando_usuario', 'em_revisao', 'precisa_correcao', 'concluida', 'bloqueada', 'cancelada', 'interrompida']);

export function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} nao pode estar vazio.`);
  return value.trim();
}

export function processIdentity(pid) {
  try {
    process.kill(pid, 0);
    if (process.platform !== 'linux') return 'alive';
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    return ['Z', 'X'].includes(fields[0]) ? null : fields[19];
  } catch (error) {
    if (error.code === 'EPERM') return 'alive';
    return null;
  }
}

export class Store {
  constructor(cwd) {
    this.info = project(cwd);
    this.dir = path.join(this.info.root, '.millennium');
  }

  file(name) { return path.join(this.dir, name); }

  init() {
    if (fs.existsSync(this.dir) && fs.lstatSync(this.dir).isSymbolicLink()) throw new Error('.millennium nao pode ser um link simbolico.');
    try { git(this.info.root, 'check-ignore', '-q', '.millennium/state.json'); }
    catch { throw new Error('Inclua .millennium/ no .gitignore antes de salvar conversas privadas.'); }
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    if (fs.lstatSync(this.dir).isSymbolicLink()) throw new Error('.millennium nao pode ser um link simbolico.');
  }

  read(name) {
    if (fs.existsSync(this.dir) && fs.lstatSync(this.dir).isSymbolicLink()) throw new Error('.millennium nao pode ser um link simbolico.');
    const file = this.file(name);
    const raw = readRegularFile(file, { missingOk: true });
    if (raw === null) return null;
    try { return JSON.parse(raw); }
    catch { throw new Error(`Registro ${name} invalido. Preserve o arquivo antes de recuperar.`); }
  }

  write(name, value) {
    this.init();
    const temp = this.file(`.${randomUUID()}.tmp`);
    fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    fs.renameSync(temp, this.file(name));
  }

  state() {
    const state = this.read('state.json');
    if (!state) return null;
    if (state.schema_version !== 1 || state.project_id !== this.info.id || !state.turn ||
        !state.task || !Array.isArray(state.attempts) || !Array.isArray(state.checks) ||
        !states.has(state.task.status)) throw new Error('Estado incompativel. Nao sobrescreva os registros.');
    return state;
  }

  locked(fn) {
    this.init();
    let fd;
    try { fd = fs.openSync(this.file('mutation.lock'), 'wx', 0o600); }
    catch (error) {
      if (error.code === 'EEXIST') {
        let stale;
        try { stale = this.read('mutation.lock'); } catch {}
        const owner = stale?.pid ? processIdentity(stale.pid) : null;
        if (stale?.pid && stale.identity && (!owner || (owner !== 'alive' && owner !== stale.identity))) {
          const current = this.read('mutation.lock');
          if (current?.token === stale.token) {
            fs.unlinkSync(this.file('mutation.lock'));
            return this.locked(fn);
          }
        }
        throw new Error('Outra operacao esta atualizando o turno. Tente novamente.');
      }
      throw error;
    }
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, identity: processIdentity(process.pid), token: randomUUID() }));
    try { return fn(); }
    finally { fs.closeSync(fd); fs.unlinkSync(this.file('mutation.lock')); }
  }

  running() {
    const lock = this.read('run.lock');
    if (!lock) return false;
    if (!Number.isSafeInteger(lock.pid) || lock.pid < 1 || !lock.identity || typeof lock.attempt_id !== 'string') {
      throw new Error('Lock de execucao invalido. Preserve os registros.');
    }
    return processIdentity(lock.pid) === lock.identity ||
      (lock.child_pid && processIdentity(lock.child_pid) === lock.child_identity);
  }

  recover() {
    if (!fs.existsSync(this.dir)) return;
    this.locked(() => {
      const lock = this.read('run.lock');
      if (!lock || this.running()) return;
      const state = this.state();
      const attempt = state?.attempts.find(item => item.id === lock.attempt_id);
      if (!attempt || attempt.status !== 'executando') throw new Error('Lock sem tentativa correspondente. Preserve os registros.');
      attempt.status = 'interrompida';
      attempt.ended_at = now();
      attempt.error = 'Processo encerrado sem fechamento; nenhuma acao foi repetida.';
      state.task.status = 'interrompida';
      this.write('state.json', state);
      fs.unlinkSync(this.file('run.lock'));
      this.removeCancel();
    });
  }

  requireOpen(state) {
    this.info = project(this.info.root);
    if (!state || state.turn.status !== 'aberto') throw new Error('Abra um turno ou use resume para retomar.');
    if (this.read('run.lock')) throw new Error('Ha uma execucao em andamento. Use status ou stop.');
    if (state.task.status === 'concluida') throw new Error('Tarefa ja aceita. Encerre o turno antes de abrir outra.');
    if (state.task.branch !== this.info.branch) throw new Error(`Abra a branch da tarefa: ${state.task.branch}.`);
    requireFeature(this.info);
  }

  start(objective, acceptance) {
    requireFeature(this.info);
    const taskObjective = text(objective, 'Objetivo');
    const criterion = text(acceptance, 'Criterio de aceite');
    return this.locked(() => {
      this.info = project(this.info.root);
      requireFeature(this.info);
      const previous = this.state();
      if (this.read('run.lock')) throw new Error('Ha uma execucao em andamento.');
      if (previous && (previous.turn.status === 'aberto' || previous.task.status !== 'concluida')) {
        throw new Error('O turno anterior tem trabalho pendente. Use status, close ou resume.');
      }
      if (previous) this.write(`turn-${previous.turn.id}.json`, previous);
      const state = {
        schema_version: 1, project_id: this.info.id,
        turn: { id: randomUUID(), status: 'aberto', started_at: now(), next_action: null },
        task: { id: randomUUID(), objective: taskObjective, acceptance: criterion, branch: this.info.branch, status: 'planejada' },
        attempts: [], checks: [], accepted_evidence: null,
      };
      this.write('state.json', state);
      return state;
    });
  }

  begin(mode, model) {
    return this.locked(() => {
      const state = this.state();
      this.requireOpen(state);
      if (!['plan', 'work', 'review', 'check'].includes(mode)) throw new Error('Modo invalido.');
      if (mode === 'review' && !state.attempts.some(item => item.mode === 'work' && item.status === 'em_revisao')) {
        throw new Error('Execute a tarefa antes de revisar.');
      }
      const attempt = {
        id: randomUUID(), turn_id: state.turn.id, task_id: state.task.id,
        mode, provider: mode === 'check' ? null : 'codex', model_requested: model ?? null,
        model_used: null, started_at: now(), ended_at: null, status: 'executando',
        revision: this.info.revision, before_fingerprint: fingerprint(this.info.root),
        usage: null, cost: null, error: null,
      };
      const dir = this.file(`attempt-${attempt.id}`);
      fs.mkdirSync(dir, { mode: 0o700 });
      attempt.artifacts = path.relative(this.info.root, dir);
      state.attempts.push(attempt);
      state.task.status = 'executando';
      this.write('run.lock', { pid: process.pid, identity: processIdentity(process.pid), attempt_id: attempt.id });
      this.write('state.json', state);
      return { state, attempt, dir };
    });
  }

  finish(id, result) {
    return this.locked(() => {
      const state = this.state();
      const attempt = state.attempts.find(item => item.id === id);
      if (!attempt) throw new Error('Tentativa nao encontrada.');
      Object.assign(attempt, result, { ended_at: now(), after_fingerprint: fingerprint(this.info.root) });
      state.task.status = attempt.status;
      if (attempt.mode === 'check') state.checks.push({ attempt_id: id, script: result.script, exit_code: result.exit_code, fingerprint: attempt.after_fingerprint });
      this.write('state.json', state);
      fs.unlinkSync(this.file('run.lock'));
      this.removeCancel();
      return state;
    });
  }

  attachChild(child) {
    this.locked(() => {
      const lock = this.read('run.lock');
      this.write('run.lock', { ...lock, child_pid: child.pid, child_identity: processIdentity(child.pid) });
    });
  }

  removeCancel() {
    if (fs.existsSync(this.file('cancel.json'))) fs.unlinkSync(this.file('cancel.json'));
  }

  stop() {
    return this.locked(() => {
      const lock = this.read('run.lock');
      if (!lock || !this.running()) throw new Error('Nenhuma execucao ativa. Use status para conferir o turno.');
      this.write('cancel.json', { attempt_id: lock.attempt_id });
    });
  }

  accept(evidence) {
    const statement = text(evidence, 'Evidencia de aceite');
    return this.locked(() => {
      const state = this.state();
      this.requireOpen(state);
      const workIndex = state.attempts.findLastIndex(item => item.mode === 'work');
      const review = state.attempts.findLast(item => item.mode === 'review');
      const check = state.checks.at(-1);
      const checkAttempt = state.attempts.find(item => item.id === check?.attempt_id);
      const current = fingerprint(this.info.root);
      if (workIndex < 0 || state.attempts[workIndex].status !== 'em_revisao' || !review ||
          state.attempts.indexOf(review) < workIndex || review.status !== 'em_revisao' ||
          review.after_fingerprint !== current || !check || check.exit_code !== 0 || checkAttempt?.status !== 'em_revisao' ||
          state.attempts.findIndex(item => item.id === check.attempt_id) < workIndex || check.fingerprint !== current) {
        throw new Error('Aceite exige execucao, revisao e teste aprovados sobre os arquivos atuais.');
      }
      state.task.status = 'concluida';
      state.accepted_evidence = { statement, at: now(), fingerprint: current, review_id: review.id, check_id: check.attempt_id };
      this.write('state.json', state);
      return state;
    });
  }

  close(summary, next) {
    const done = text(summary, 'Resumo');
    const nextAction = text(next, 'Proxima acao');
    return this.locked(() => {
      this.info = project(this.info.root);
      const state = this.state();
      if (!state || state.turn.status !== 'aberto') throw new Error('Nenhum turno aberto.');
      if (this.read('run.lock')) throw new Error('Pare a execucao antes de encerrar.');
      requireFeature(this.info);
      if (state.task.branch !== this.info.branch) throw new Error(`Abra ${state.task.branch} antes de encerrar.`);
      state.turn = { ...state.turn, status: 'encerrado', ended_at: now(), summary: done, next_action: nextAction };
      this.write('state.json', state);
      const body = `# Passagem de turno Millennium\n\nObjetivo: ${state.task.objective}\n\nAceite: ${state.task.acceptance}\n\nEstado: ${state.task.status}\n\nResumo: ${done}\n\nProxima acao: ${nextAction}\n\nBranch: ${state.task.branch}\n\n` +
        state.attempts.map(item => `- ${item.mode}: ${item.status}; evidencias em ${item.artifacts}`).join('\n') + '\n';
      fs.writeFileSync(this.file('handoff.md'), body, { mode: 0o600 });
      return state;
    });
  }

  resume() {
    return this.locked(() => {
      this.info = project(this.info.root);
      const state = this.state();
      if (!state || state.task.status === 'concluida') throw new Error('Nao ha tarefa pendente para retomar.');
      if (this.read('run.lock')) throw new Error('Execucao ainda ativa.');
      requireFeature(this.info);
      if (state.task.branch !== this.info.branch) throw new Error(`Abra ${state.task.branch} antes de retomar.`);
      state.turn.status = 'aberto';
      this.write('state.json', state);
      return state;
    });
  }
}
