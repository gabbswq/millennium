import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import { Store, processIdentity } from '../store.mjs';
import { project, prepare, fingerprint, diffEvidence } from '../project.mjs';
import { run, codexArgs, promptFor, resolveCodex } from '../runner.mjs';
import { main } from '../cli.mjs';
import { createSmokeRoot, main as liveSmoke } from './live-smoke.mjs';

const fake = fileURLToPath(new URL('./fake-provider.mjs', import.meta.url));
const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
const output = () => ({ text: '', write(chunk) { this.text += chunk; } });

function fixture(t, branch = 'feature/test', rootName = 'project') {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'millennium-test-'));
  const root = path.join(temp, rootName);
  fs.mkdirSync(root);
  const g = (...args) => execFileSync('git', ['-C', root, '-c', 'core.hooksPath=/dev/null',
    '-c', 'commit.gpgsign=false', '-c', 'user.name=Millennium Test', '-c', 'user.email=test@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  g('init', '-b', branch);
  fs.writeFileSync(path.join(root, '.gitignore'), '.millennium/\n');
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: {
    ok: 'node -e "console.log(123)"', bad: 'node -e "process.exit(2)"',
  } }));
  g('add', '.'); g('commit', '-m', 'test: initialize fixture');
  const store = new Store(root);
  t.after(() => {
    assert.equal(path.dirname(temp), os.tmpdir());
    assert.ok(path.basename(temp).startsWith('millennium-test-'));
    fs.rmSync(temp, { recursive: true, force: true });
  });
  return { temp, root, store, g };
}

function start(f) { return f.store.start('Validar um registro ficticio', 'Campo vazio gera erro; campo valido e aceito'); }
function simulated(f, mode, scenario = 'ok', extra = {}) {
  return run(f.store, mode, { executable: process.execPath, prefix: [fake, scenario], approved: true, output: output(), ...extra });
}
async function waitFor(fn) {
  const limit = Date.now() + 5000;
  while (!fn()) {
    if (Date.now() > limit) throw new Error('Condicao nao chegou ao estado esperado.');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

test('help funciona sem instalar dependencias ou acessar um provedor', async () => {
  const out = output();
  assert.equal(await main(['help'], os.tmpdir(), out), 0);
  assert.match(out.text, /prepare/);
  assert.match(out.text, /stop/);
});

test('ensaio real exige opt-in antes de criar arquivos ou chamar o provedor', async t => {
  const f = fixture(t);
  await assert.rejects(() => liveSmoke([], f.root), /approved/);
  assert.equal(fs.existsSync(f.store.dir), false);
});

test('evidencias do ensaio ficam no projeto privado, nao em tmp', t => {
  const f = fixture(t);
  const root = createSmokeRoot(f.root);
  assert.equal(path.dirname(root), f.store.dir);
  assert.ok(path.basename(root).startsWith('live-'));
  assert.equal(f.g('status', '--porcelain'), '');
  fs.writeFileSync(path.join(f.root, '.gitignore'), '');
  assert.throws(() => createSmokeRoot(f.root), /gitignore/);
});

test('descobre Codex em ~/.local/bin mesmo sem a entrada no PATH', t => {
  const f = fixture(t); const dir = path.join(f.temp, '.local', 'bin');
  fs.mkdirSync(dir, { recursive: true });
  const executable = path.join(dir, 'codex');
  fs.writeFileSync(executable, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
  assert.equal(resolveCodex({ searchPath: '', home: f.temp }), executable);
  assert.equal(resolveCodex({ searchPath: '', home: path.join(f.temp, 'missing') }), 'codex');
});

test('start persiste objetivo, criterio, projeto, branch e identificadores', t => {
  const f = fixture(t); const state = start(f);
  assert.equal(state.task.status, 'planejada');
  assert.equal(state.task.branch, 'feature/test');
  assert.notEqual(state.turn.id, state.task.id);
  assert.deepEqual(new Store(f.root).state(), state);
  assert.equal(f.g('status', '--porcelain'), '');
  assert.throws(() => start(f), /pendente/);
});

test('campos vazios nao criam estado e logs privados exigem gitignore', t => {
  const f = fixture(t);
  assert.throws(() => f.store.start(' ', 'teste'), /vazio/);
  assert.equal(fs.existsSync(f.store.dir), false);
  fs.writeFileSync(path.join(f.root, '.gitignore'), '');
  assert.throws(() => start(f), /gitignore/);
});

test('main, develop, preview, hotfix e detached recusam abertura de tarefa', t => {
  for (const branch of ['main', 'develop', 'preview', 'hotfix/test']) {
    const f = fixture(t, branch); const head = f.g('rev-parse', 'HEAD');
    assert.throws(() => start(f), /feature/);
    assert.equal(f.g('rev-parse', 'HEAD'), head);
    assert.equal(fs.existsSync(f.store.dir), false);
  }
  const f = fixture(t); f.g('switch', '--detach');
  assert.throws(() => new Store(f.root).start('x', 'y'), /feature/);
});

test('troca de branch apos abrir o Store nao burla a protecao de main', async t => {
  const f = fixture(t); start(f); f.g('switch', '-c', 'main');
  await assert.rejects(() => simulated(f, 'work'), /branch da tarefa/);
  assert.throws(() => f.store.close('feito', 'proximo'), /feature/);
  assert.equal(f.store.state().attempts.length, 0);
});

test('tarefas do VS Code usam args de processo e todas as entradas existem', () => {
  const tasks = JSON.parse(fs.readFileSync(new URL('../../../.vscode/tasks.json', import.meta.url), 'utf8'));
  const inputs = new Set(tasks.inputs.map(input => input.id));
  for (const task of tasks.tasks.filter(item => item.args?.[0] === 'scripts/millennium/cli.mjs')) {
    assert.equal(task.type, 'process'); assert.equal(task.command, 'node');
    assert.equal(task.options.cwd, '${workspaceFolder}');
    for (const arg of task.args) for (const [, id] of arg.matchAll(/\$\{input:([^}]+)\}/g)) assert.ok(inputs.has(id));
  }
  assert.equal(tasks.tasks.find(item => item.args?.[1] === 'run').args.at(-1), '--approved');
  assert.equal(tasks.tasks.find(item => item.args?.[1] === 'stop').presentation.panel, 'new');
});

test('prepare sincroniza develop e cria feature sem alterar main', t => {
  const f = fixture(t);
  f.g('branch', 'develop'); f.g('branch', 'main');
  const mainHead = f.g('rev-parse', 'main');
  const remote = path.join(f.temp, 'remote.git');
  execFileSync('git', ['init', '--bare', remote], { stdio: 'ignore' });
  f.g('remote', 'add', 'origin', remote); f.g('push', '-u', 'origin', 'develop');
  assert.equal(prepare(f.root, 'primeiro-turno').branch, 'feature/primeiro-turno');
  assert.equal(f.g('rev-parse', 'main'), mainHead);
  assert.equal(f.g('merge-base', 'develop', 'HEAD'), f.g('rev-parse', 'HEAD'));
  assert.throws(() => prepare(f.root, 'primeiro-turno'), /ja existe/);
});

test('prepare preserva checkout sujo e rejeita nomes injetados', t => {
  const f = fixture(t); fs.writeFileSync(path.join(f.root, 'mine.txt'), 'preservar');
  assert.throws(() => prepare(f.root, 'novo-turno'), /alteracoes/);
  assert.throws(() => prepare(f.root, 'novo;rm'), /nome simples/);
  assert.equal(project(f.root).branch, 'feature/test');
  assert.equal(fs.readFileSync(path.join(f.root, 'mine.txt'), 'utf8'), 'preservar');
});

test('plan e review sao read-only; work nao usa bypass e exige aprovacao', async t => {
  const f = fixture(t); start(f);
  const args = codexArgs(f.root, 'plan', 'response.md');
  assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
  assert.equal(codexArgs(f.root, 'work', 'r')[6], 'workspace-write');
  assert.ok(!args.some(arg => /danger|full-auto|bypass/.test(arg)));
  await assert.rejects(() => run(f.store, 'work'), /approved/);
  assert.equal(f.store.state().attempts.length, 0);
  await assert.rejects(() => simulated(f, 'plan', 'ok', { model: '--dangerous' }), /modelo invalido/);
});

test('planejamento salva prompt, eventos completos, resposta e uso reportado', async t => {
  const f = fixture(t); const initial = start(f);
  const state = await simulated(f, 'plan'); const attempt = state.attempts[0];
  assert.equal(state.task.status, 'aguardando_usuario');
  assert.equal(attempt.turn_id, initial.turn.id);
  assert.equal(attempt.task_id, initial.task.id);
  assert.equal(attempt.before_fingerprint, attempt.after_fingerprint);
  assert.deepEqual(attempt.usage, { input_tokens: 10, output_tokens: 5, cached_input_tokens: 0 });
  assert.equal(attempt.cost, null); assert.equal(attempt.model_used, null);
  for (const file of ['prompt.txt', 'events.jsonl', 'stderr.log', 'response.md', 'before.patch', 'after.patch']) {
    assert.ok(fs.existsSync(path.join(f.root, attempt.artifacts, file)), file);
  }
  assert.match(promptFor(f.store, initial, 'plan'), /somente leitura/);
  assert.equal(f.store.read('run.lock'), null);
});

test('revisao recebe referencias dos testes e nao pede escrita no sandbox read-only', async t => {
  const f = fixture(t); start(f); await simulated(f, 'work');
  await run(f.store, 'check', { script: 'ok', output: output() });
  const state = f.store.state();
  const prompt = promptFor(f.store, state, 'review');
  assert.match(prompt, /stdout.log/); assert.match(prompt, /Nao rode verificacoes que escrevam/);
  assert.ok(prompt.includes(state.attempts.at(-1).artifacts));
});

test('falha de acesso e executavel ausente ficam bloqueados, sem perder tarefa', async t => {
  const f = fixture(t); start(f);
  let state = await simulated(f, 'plan', 'fail');
  assert.equal(state.task.status, 'bloqueada');
  assert.equal(state.attempts[0].exit_code, 2);
  assert.match(fs.readFileSync(path.join(f.root, state.attempts[0].artifacts, 'stderr.log'), 'utf8'), /indisponivel/);
  state = await run(f.store, 'plan', { executable: path.join(f.temp, 'missing-codex'), output: output() });
  assert.equal(state.task.status, 'bloqueada');
  assert.equal(state.attempts.length, 2);
  assert.match(state.attempts[1].error, /ENOENT/);
  assert.equal(f.store.read('run.lock'), null);
});

test('exit zero sem resposta nao finge sucesso; texto JSONL serve de fallback', async t => {
  const f = fixture(t); start(f);
  assert.equal((await simulated(f, 'plan', 'empty')).task.status, 'bloqueada');
  const state = await simulated(f, 'plan', 'fallback');
  assert.equal(state.task.status, 'aguardando_usuario');
  assert.match(fs.readFileSync(path.join(f.root, state.attempts.at(-1).artifacts, 'response.md'), 'utf8'), /Revisao/);
});

test('fallback nao sobrescreve uma resposta criada por outro escritor', async t => {
  const f = fixture(t); start(f);
  const write = fs.writeFileSync;
  const winner = 'Resposta concorrente preservada.';
  let injected = false;
  fs.writeFileSync = (file, ...args) => {
    if (!injected && typeof file === 'string' && path.basename(file) === 'response.md' && file.startsWith(f.store.dir + path.sep)) {
      injected = true;
      write(file, winner, { flag: 'wx', mode: 0o600 });
    }
    return write(file, ...args);
  };
  t.after(() => { fs.writeFileSync = write; });
  const state = await simulated(f, 'plan', 'fallback');
  assert.equal(injected, true);
  assert.equal(state.task.status, 'aguardando_usuario');
  const response = path.join(f.root, state.attempts.at(-1).artifacts, 'response.md');
  assert.equal(fs.readFileSync(response, 'utf8'), winner);
});

test('fallback recusa symlink sem alterar o alvo e conclui o erro sem run.lock', { skip: process.platform === 'win32' }, async t => {
  const f = fixture(t); start(f);
  const outside = path.join(f.temp, 'outside.txt');
  const write = fs.writeFileSync;
  write(outside, 'outside fixture');
  let injected = false;
  fs.writeFileSync = (file, ...args) => {
    if (!injected && typeof file === 'string' && path.basename(file) === 'response.md' && file.startsWith(f.store.dir + path.sep)) {
      injected = true;
      fs.symlinkSync(outside, file);
    }
    return write(file, ...args);
  };
  t.after(() => { fs.writeFileSync = write; });
  const state = await simulated(f, 'plan', 'fallback');
  assert.equal(injected, true);
  assert.equal(state.task.status, 'bloqueada');
  assert.match(state.attempts.at(-1).error, /resposta inseguro/);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'outside fixture');
  assert.equal(f.store.read('run.lock'), null);
});

test('JSONL dividido dentro de caractere UTF-8 preserva texto da resposta', async t => {
  const f = fixture(t); start(f);
  const state = await simulated(f, 'plan', 'unicode');
  assert.equal(state.task.status, 'aguardando_usuario');
  assert.match(fs.readFileSync(path.join(f.root, state.attempts[0].artifacts, 'response.md'), 'utf8'), /a\u00e7\u00e3o/);
});

test('edicao concorrente em plan/review e detectada, nao revertida', async t => {
  const f = fixture(t); start(f);
  const state = await simulated(f, 'plan', 'mutate');
  assert.equal(state.task.status, 'bloqueada');
  assert.match(state.attempts[0].error, /somente leitura/);
  assert.equal(fs.readFileSync(path.join(f.root, 'unexpected.txt'), 'utf8'), 'not read-only');
});

test('lock impede dois executores e stop cancela filho sem apagar evidencias', async t => {
  const f = fixture(t); start(f);
  const pending = simulated(f, 'plan', 'hang');
  await waitFor(() => f.store.read('run.lock')?.child_pid);
  const child = f.store.read('run.lock').child_pid;
  await assert.rejects(() => simulated(f, 'plan'), /andamento/);
  assert.throws(() => f.store.close('x', 'y'), /Pare a execucao/);
  assert.throws(() => start(f), /andamento/);
  const out = output(); await main(['stop'], f.root, out);
  assert.match(out.text, /Cancelamento solicitado/);
  const state = await pending;
  assert.equal(state.task.status, 'cancelada');
  assert.equal(processIdentity(child), null);
  assert.equal(f.store.read('run.lock'), null);
  assert.ok(fs.existsSync(path.join(f.root, state.attempts[0].artifacts, 'events.jsonl')));
});

test('timeout salva interrupcao e nao repete execucao', async t => {
  const f = fixture(t); start(f);
  const state = await simulated(f, 'plan', 'hang', { timeout: 100 });
  assert.equal(state.task.status, 'interrompida');
  assert.match(state.attempts[0].error, /Tempo limite/);
  await main(['status'], f.root, output());
  assert.equal(f.store.state().attempts.length, 1);
});

test('stop encerra tambem descendentes que herdam o grupo de processos', async t => {
  const f = fixture(t); start(f);
  const pending = simulated(f, 'plan', 'tree');
  await waitFor(() => {
    const attempt = f.store.state().attempts[0];
    return attempt && fs.existsSync(path.join(f.root, attempt.artifacts, 'descendant.pid'));
  });
  const descendant = Number(fs.readFileSync(path.join(f.root, f.store.state().attempts[0].artifacts, 'descendant.pid'), 'utf8'));
  assert.ok(processIdentity(descendant));
  f.store.stop();
  assert.equal((await pending).task.status, 'cancelada');
  await waitFor(() => processIdentity(descendant) === null);
});

test('stop espera o encerramento forcado de descendente que ignora SIGTERM', async t => {
  const f = fixture(t, 'feature/test', 'project $ & (literal)'); start(f);
  const pending = simulated(f, 'plan', 'stubborn-tree');
  await waitFor(() => {
    const attempt = f.store.state().attempts[0];
    return attempt && fs.existsSync(path.join(f.root, attempt.artifacts, 'descendant.ready'));
  });
  const descendant = Number(fs.readFileSync(path.join(f.root, f.store.state().attempts[0].artifacts, 'descendant.pid'), 'utf8'));
  try {
    f.store.stop();
    assert.equal((await pending).task.status, 'cancelada');
    await waitFor(() => processIdentity(descendant) === null);
    assert.equal(f.store.read('run.lock'), null);
  } finally {
    if (processIdentity(descendant)) process.kill(descendant, 'SIGKILL');
  }
});

test('recuperacao de processo morto registra interrupcao e libera lock', t => {
  const f = fixture(t); start(f); const { attempt } = f.store.begin('work');
  f.store.write('run.lock', { pid: 2147483647, identity: 'dead', attempt_id: attempt.id });
  f.store.write('mutation.lock', { pid: 2147483647, identity: 'dead', token: 'fixture' });
  new Store(f.root).recover();
  assert.equal(f.store.state().task.status, 'interrompida');
  assert.equal(f.store.state().attempts.length, 1);
  assert.equal(f.store.read('run.lock'), null);
});

test('recuperacao nao libera lock de processo vivo', t => {
  const f = fixture(t); start(f); f.store.begin('work');
  f.store.recover();
  assert.equal(f.store.state().task.status, 'executando');
  assert.ok(f.store.read('run.lock'));
  f.store.finish(f.store.state().attempts[0].id, { status: 'cancelada' });
});

test('recuperacao espera filho orfao terminar antes de liberar a pasta', async t => {
  const f = fixture(t); start(f); const { attempt } = f.store.begin('work');
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
  const closed = new Promise(resolve => child.once('close', resolve));
  try {
    f.store.write('run.lock', { pid: 2147483647, identity: 'dead', attempt_id: attempt.id,
      child_pid: child.pid, child_identity: processIdentity(child.pid) });
    f.store.recover();
    assert.equal(f.store.state().task.status, 'executando');
    assert.ok(f.store.read('run.lock'));
  } finally { child.kill(); await closed; }
  f.store.recover();
  assert.equal(f.store.state().task.status, 'interrompida');
  assert.equal(f.store.read('run.lock'), null);
});

test('evidencias incluem arquivos novos e nao leem .env nao rastreado', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'new-code.mjs'), 'export const x = 1;\n');
  fs.writeFileSync(path.join(f.root, '.env.local'), 'PRIVATE_TEST_VALUE=not-a-real-key');
  const diff = diffEvidence(f.root);
  assert.match(diff, /new-code.mjs/);
  assert.match(diff, /export const x = 1/);
  assert.doesNotMatch(diff, /PRIVATE_TEST_VALUE/);
});

test('aceite exige work, review, teste valido, arquivos atuais e evidencia humana', async t => {
  const f = fixture(t); start(f);
  assert.throws(() => f.store.accept('conferido'), /execucao/);
  await simulated(f, 'work');
  assert.throws(() => f.store.accept('conferido'), /revisao/);
  await simulated(f, 'review');
  await run(f.store, 'check', { script: 'bad', output: output() });
  assert.throws(() => f.store.accept('conferido'), /teste/);
  await run(f.store, 'check', { script: 'ok', output: output() });
  assert.throws(() => f.store.accept(' '), /vazio/);
  const state = f.store.accept('Li a revisao e conferi os resultados do teste de validacao.');
  assert.equal(state.task.status, 'concluida');
  assert.equal(state.accepted_evidence.fingerprint, fingerprint(f.root));
  f.store.close('Tarefa revisada', 'Escolher outra tarefa');
  assert.match(fs.readFileSync(f.store.file('handoff.md'), 'utf8'), /Escolher outra tarefa/);
  const next = start(f); assert.equal(next.task.status, 'planejada');
  assert.equal(f.store.read(`turn-${state.turn.id}.json`).task.status, 'concluida');
});

test('alterar codigo depois da revisao/teste invalida o aceite', async t => {
  const f = fixture(t); start(f); await simulated(f, 'work'); await simulated(f, 'review');
  await run(f.store, 'check', { script: 'ok', output: output() });
  fs.writeFileSync(path.join(f.root, 'new-code.mjs'), 'export const x = 1;');
  assert.throws(() => f.store.accept('conferido'), /arquivos atuais/);
  await run(f.store, 'check', { script: 'ok', output: output() });
  assert.throws(() => f.store.accept('conferido'), /arquivos atuais/);
  await simulated(f, 'review');
  assert.equal(f.store.accept('Conferi novamente.').task.status, 'concluida');
});

test('check rejeita scripts ausentes/opcoes de shell antes de iniciar tentativa', async t => {
  const f = fixture(t); start(f);
  for (const script of ['missing', '--version', 'ok;rm', 'ok && bad']) {
    await assert.rejects(() => run(f.store, 'check', { script, output: output() }), /script existente/);
  }
  assert.equal(f.store.state().attempts.length, 0);
});

test('close de tarefa pendente preserva estado; resume nao executa comandos', async t => {
  const f = fixture(t); start(f); await simulated(f, 'plan');
  assert.throws(() => f.store.close('feito', ' '), /vazio/);
  f.store.close('Planejei, nao implementei', 'Conferir o plano');
  assert.equal(f.store.state().task.status, 'aguardando_usuario');
  assert.throws(() => start(f), /pendente/);
  await main(['resume'], f.root, output());
  assert.equal(f.store.state().turn.status, 'aberto');
  assert.equal(f.store.state().attempts.length, 1);
});

test('registro corrompido e link simbolico nao sao sobrescritos', t => {
  const f = fixture(t); start(f);
  fs.writeFileSync(f.store.file('state.json'), '{broken');
  assert.throws(() => f.store.state(), /invalido/);
  assert.throws(() => start(f), /invalido/);
  assert.equal(fs.readFileSync(f.store.file('state.json'), 'utf8'), '{broken');
  const other = fixture(t); const outside = path.join(other.temp, 'outside'); fs.mkdirSync(outside);
  fs.symlinkSync(outside, other.store.dir);
  assert.throws(() => start(other), /link simbolico/);
  assert.equal(fs.readdirSync(outside).length, 0);
});

test('CLI real grava estado, retorna codigo de erro e reabre historico', t => {
  const f = fixture(t);
  execFileSync(process.execPath, [cli, 'start', '--objective', 'Estudar Git', '--acceptance', 'Explicar diff'], { cwd: f.root });
  const status = execFileSync(process.execPath, [cli, 'status'], { cwd: f.root, encoding: 'utf8' });
  assert.match(status, /Estudar Git/); assert.match(status, /planejada/);
  assert.throws(() => execFileSync(process.execPath, [cli, 'run'], { cwd: f.root, stdio: 'pipe' }), error => error.status === 1 && /approved/.test(error.stderr.toString()));
  assert.equal(new Store(f.root).state().attempts.length, 0);
});
