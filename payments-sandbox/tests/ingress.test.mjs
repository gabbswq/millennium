import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { createApplication } from '../app.mjs';
import { createWebhookReceiver } from '../webhook-receiver.mjs';
import { ProviderError } from '../providers.mjs';

const host = '127.0.0.1:4311';
const token = 'ingress-fixture-token-not-a-real-secret';
const requestLimit = 120;
const mutationLimit = 20;
const windowMs = 60000;

async function fixture(t, { receiver = false, beforeReady } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'millennium-ingress-test-'));
  const lab = createApplication({ dataDir: dir, webhookToken: token,
    ...(receiver ? { mode: 'asaas', provider: { mode: 'asaas', key: 'fixture-api-key' } } : {}),
  });
  const endpoint = receiver ? createWebhookReceiver(lab) : lab.app;
  t.after(async () => {
    await lab.app.close();
    assert.equal(path.dirname(dir), os.tmpdir());
    assert.ok(path.basename(dir).startsWith('millennium-ingress-test-'));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  beforeReady?.(endpoint);
  await lab.app.ready();
  if (receiver) await endpoint.ready();
  return { ...lab, endpoint, dir,
    get: (url = '/api/session', headers = {}) => endpoint.inject({ url, headers: { host, ...headers } }),
  };
}

function assertLimited(response, retryAfter) {
  assert.equal(response.statusCode, 429);
  assert.match(response.json().error, /requisicoes/i);
  assert.equal(response.headers['retry-after'], String(retryAfter));
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['access-control-allow-origin'], undefined);
  assert.doesNotMatch(response.body, /fixture|csrf|asaas-access-token/);
}

test('ingresso bloqueia a requisicao 121 com Retry-After antes dos handlers', async t => {
  const now = Date.now(); t.mock.method(Date, 'now', () => now);
  const f = await fixture(t);
  for (let n = 0; n < requestLimit; n++) assert.equal((await f.get()).statusCode, 200);
  assertLimited(await f.get(), 60);
  assert.equal(f.repo.state.charges.length, 0);
});

test('URLs, query strings, enderecos e headers inventados nao renovam o orcamento', async t => {
  const now = Date.now(); t.mock.method(Date, 'now', () => now);
  const f = await fixture(t);
  const request = n => f.app.inject({ url: `/missing-${n}?request=${n}`, remoteAddress: `192.0.2.${n % 250 + 1}`,
    headers: { host, 'x-forwarded-for': `198.51.100.${n % 250 + 1}`, 'x-real-ip': `203.0.113.${n % 250 + 1}`,
      'x-user-id': `user-${n}`, 'x-user-tier': 'premium' },
  });
  for (let n = 0; n < requestLimit; n++) assert.equal((await request(n)).statusCode, 404);
  assertLimited(await request(requestLimit), 60);
  assertLimited(await f.get(), 60);
});

test('origens invalidas tambem gastam o limite antes de validacao ou leitura de corpo', async t => {
  const now = Date.now(); t.mock.method(Date, 'now', () => now);
  const f = await fixture(t);
  for (let n = 0; n < requestLimit; n++) assert.equal((await f.get('/api/session', { host: 'evil.fixture.invalid' })).statusCode, 403);
  assertLimited(await f.get(), 60);
});

test('mutacoes compartilham limite 20; bloqueio nao chama o provedor nem cria registro', async t => {
  const now = Date.now(); t.mock.method(Date, 'now', () => now);
  const f = await fixture(t);
  let calls = 0;
  f.payments.provider.create = async () => { calls++; throw new ProviderError('fixture-denied', false); };
  const session = (await f.get()).json();
  const request = () => f.app.inject({ method: 'POST', url: '/api/charges',
    headers: { host, origin: `http://${host}`, 'x-millennium-csrf': session.csrf, 'idempotency-key': randomUUID() },
    payload: { description: 'Pedido sintetico', amount: '1.00', dueDate: '2099-01-01' },
  });
  for (let n = 0; n < mutationLimit; n++) assert.equal((await request()).statusCode, 422);
  assertLimited(await request(), 60);
  assert.equal(calls, mutationLimit);
  assert.equal(f.repo.state.charges.length, mutationLimit);
  assert.equal((await f.get('/api/charges')).statusCode, 200);
});

test('bloqueio de mutacao ocorre antes de JSON, schema e rotas inexistentes', async t => {
  const now = Date.now(); t.mock.method(Date, 'now', () => now);
  let parsed = 0;
  const f = await fixture(t, { beforeReady: app => app.addHook('preParsing', async (request, reply, payload) => { parsed++; return payload; }) });
  const session = (await f.get()).json();
  parsed = 0;
  const send = url => f.app.inject({ method: 'POST', url,
    headers: { host, origin: `http://${host}`, 'x-millennium-csrf': session.csrf, 'content-type': 'application/json' }, payload: '{broken',
  });
  for (let n = 0; n < mutationLimit; n++) assert.equal((await send('/api/charges')).statusCode, 400);
  assert.equal(parsed, mutationLimit);
  assertLimited(await send('/api/charges'), 60);
  assertLimited(await send('/different-route'), 60);
  assert.equal(parsed, mutationLimit);
  assert.equal(f.repo.state.charges.length, 0);
});

test('janela expira no prazo real sem ser renovada por tentativas recusadas', async t => {
  let now = Date.now(); t.mock.method(Date, 'now', () => now);
  const f = await fixture(t);
  for (let n = 0; n < requestLimit; n++) await f.get();
  now += 41000;
  assertLimited(await f.get(), 19);
  now += 18999;
  assertLimited(await f.get(), 1);
  now += 1;
  assert.equal((await f.get()).statusCode, 200);
});

test('receptor limita inclusive token invalido antes de autenticar e ler JSON', async t => {
  const now = Date.now(); t.mock.method(Date, 'now', () => now);
  let authorized = 0, parsed = 0;
  const f = await fixture(t, { receiver: true, beforeReady: app => app.addHook('preParsing', async (request, reply, payload) => { parsed++; return payload; }) });
  const authorize = f.payments.authorizeWebhook.bind(f.payments);
  f.payments.authorizeWebhook = (...args) => { authorized++; return authorize(...args); };
  const send = secret => f.endpoint.inject({ method: 'POST', url: '/webhooks/asaas',
    headers: { host: 'receiver.fixture.invalid', 'asaas-access-token': secret, 'content-type': 'application/json' }, payload: '{broken',
  });
  for (let n = 0; n < requestLimit; n++) assert.equal((await send('invalid-fixture-token')).statusCode, 401);
  assertLimited(await send(token), 60);
  assert.equal(authorized, requestLimit); assert.equal(parsed, 0);
  assert.equal(f.repo.state.events.length, 0);
  assert.equal((await f.app.inject({ url: '/api/session', headers: { host } })).statusCode, 200);
});

test('saturacao do painel nao consome a janela independente do receptor', async t => {
  const now = Date.now(); t.mock.method(Date, 'now', () => now);
  const f = await fixture(t, { receiver: true });
  for (let n = 0; n < requestLimit; n++) await f.app.inject({ url: '/api/session', headers: { host } });
  assertLimited(await f.app.inject({ url: '/api/session', headers: { host } }), 60);
  const reply = await f.endpoint.inject({ method: 'POST', url: '/webhooks/asaas',
    headers: { host: 'receiver.fixture.invalid', 'asaas-access-token': 'invalid-fixture-token' }, payload: {},
  });
  assert.equal(reply.statusCode, 401);
  assert.equal(f.repo.state.events.length, 0);
});

test('assets recusados nao leem disco e HEAD compartilha o limite de GET', async t => {
  const now = Date.now(); t.mock.method(Date, 'now', () => now);
  const f = await fixture(t);
  for (let n = 0; n < requestLimit; n++) await f.get();
  let reads = 0;
  const read = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (...args) => { reads++; return read(...args); });
  assertLimited(await f.get('/app.js'), 60);
  const head = await f.app.inject({ method: 'HEAD', url: '/style.css', headers: { host } });
  assert.equal(head.statusCode, 429); assert.equal(head.body, '');
  assert.equal(head.headers['retry-after'], '60'); assert.equal(reads, 0);
});

test('rajada concorrente admite somente 120 requisicoes, sem ultrapassar janela', async t => {
  const now = Date.now(); t.mock.method(Date, 'now', () => now);
  const f = await fixture(t);
  const replies = await Promise.all(Array.from({ length: requestLimit + 5 }, () => f.get()));
  assert.equal(replies.filter(reply => reply.statusCode === 200).length, requestLimit);
  assert.equal(replies.filter(reply => reply.statusCode === 429).length, 5);
  for (const reply of replies.filter(reply => reply.statusCode === 429)) assertLimited(reply, 60);
});

test('bloqueio real em TCP responde sem aguardar corpo declarado pelo cliente', async t => {
  const now = Date.now(); t.mock.method(Date, 'now', () => now);
  let parsed = 0;
  const f = await fixture(t, { beforeReady: app => app.addHook('preParsing', async (request, reply, payload) => { parsed++; return payload; }) });
  for (let n = 0; n < requestLimit; n++) await f.get();
  parsed = 0;
  const address = await f.app.listen({ host: '127.0.0.1', port: 0 });
  const response = await new Promise((resolve, reject) => {
    const request = httpRequest(`${address}/api/charges`, { method: 'POST', agent: false,
      headers: { 'content-type': 'application/json', 'content-length': '100000' },
    }, reply => {
      const chunks = [];
      reply.on('data', chunk => chunks.push(chunk));
      reply.on('error', reject);
      reply.on('end', () => {
        request.destroy();
        resolve({ statusCode: reply.statusCode, headers: reply.headers, body: Buffer.concat(chunks).toString('utf8'),
          json() { return JSON.parse(this.body); } });
      });
    });
    t.after(() => request.destroy());
    request.on('error', reject);
    request.setTimeout(2000, () => request.destroy(new Error('Limiter esperou pelo corpo HTTP.')));
    request.flushHeaders();
  });
  assertLimited(response, 60);
  assert.equal(parsed, 0); assert.equal(f.repo.state.charges.length, 0);
});

test('janela de mutacao recupera sem nova sessao e mantem leitura disponivel', async t => {
  let now = Date.now(); t.mock.method(Date, 'now', () => now);
  const f = await fixture(t);
  const session = (await f.get()).json();
  const request = () => f.app.inject({ method: 'POST', url: '/api/charges', payload: {},
    headers: { host, origin: `http://${host}`, 'x-millennium-csrf': session.csrf },
  });
  for (let n = 0; n < mutationLimit; n++) assert.equal((await request()).statusCode, 400);
  now += windowMs - 1;
  assertLimited(await request(), 1);
  assert.equal((await f.get()).statusCode, 200);
  now += 1;
  assert.equal((await request()).statusCode, 400);
  assert.equal(f.repo.state.charges.length, 0);
});
