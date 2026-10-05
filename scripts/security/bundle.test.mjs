import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const checker = fileURLToPath(new URL('../../landing/scripts/check-bundle.mjs', import.meta.url));
const preload = new URL('./bundle-fixture.mjs', import.meta.url).href;

function fixture(t, assets) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'millennium-bundle-test-'));
  t.after(() => {
    assert.equal(path.dirname(dir), os.tmpdir());
    assert.ok(path.basename(dir).startsWith('millennium-bundle-test-'));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.mkdirSync(path.join(dir, 'dist', 'assets'), { recursive: true });
  fs.copyFileSync(checker, path.join(dir, 'scripts', 'check-bundle.mjs'));
  for (const [name, content] of Object.entries(assets)) fs.writeFileSync(path.join(dir, 'dist', 'assets', name), content);
  const result = spawnSync(process.execPath, ['--import', preload, path.join(dir, 'scripts', 'check-bundle.mjs')], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.error, undefined);
  assert.ok(result.stdout.trim(), result.stderr);
  return { ...result, rows: JSON.parse(result.stdout.split('\n')[0]) };
}

test('raw e gzip usam o mesmo buffer, sem metadados stat obsoletos', t => {
  const content = Buffer.from('fixture \u00e7 \u00e3');
  const result = fixture(t, { 'app.js': content });
  assert.equal(result.status, 0);
  assert.deepEqual(result.rows, [{ name: 'app.js', bytes: content.byteLength, gzip: gzipSync(content).byteLength }]);
});

test('soma somente JavaScript no budget, sem contar CSS ou imagem', t => {
  const content = Buffer.from('export const value = 1;');
  const result = fixture(t, { 'app.js': content, 'style.css': randomBytes(200000) });
  assert.equal(result.status, 0);
  assert.match(result.stdout, new RegExp(`JavaScript total \\(gzip\\): ${gzipSync(content).byteLength} bytes`));
});

test('bundle JavaScript acima de 150 KiB gzip falha sem aumentar o budget', t => {
  const result = fixture(t, { 'app.js': randomBytes(200000) });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /bundle exceeded/);
});

test('pasta sem assets mede zero, nao inventa bytes pelo stat', t => {
  const result = fixture(t, {});
  assert.equal(result.status, 0); assert.deepEqual(result.rows, []);
  assert.match(result.stdout, /JavaScript total \(gzip\): 0 bytes/);
});
