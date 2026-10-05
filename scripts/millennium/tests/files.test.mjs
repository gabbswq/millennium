import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readRegularFile } from '../files.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'millennium-file-reader-'));
  const file = path.join(root, 'record.json');
  fs.writeFileSync(file, '{"text":"\u00e9"}', { mode: 0o600 });
  t.after(() => {
    assert.equal(path.dirname(root), os.tmpdir());
    assert.ok(path.basename(root).startsWith('millennium-file-reader-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { root, file };
}

test('regular descriptor reads preserve UTF-8 and optional binary output', t => {
  const { file } = fixture(t);
  assert.equal(readRegularFile(file), '{"text":"\u00e9"}');
  assert.deepEqual(readRegularFile(file, { encoding: null }), fs.readFileSync(file));
});

test('only an actually missing entry is optional', t => {
  const { root } = fixture(t);
  const file = path.join(root, 'missing.json');
  assert.equal(readRegularFile(file, { missingOk: true }), null);
  assert.throws(() => readRegularFile(file), { code: 'ENOENT' });
  assert.throws(() => readRegularFile(root, { missingOk: true }));
});

test('existing and dangling symlinks are never treated as state or as a missing entry', { skip: process.platform === 'win32' }, t => {
  const { root, file } = fixture(t);
  const link = path.join(root, 'link.json');
  const dangling = path.join(root, 'dangling.json');
  fs.symlinkSync(file, link);
  fs.symlinkSync(path.join(root, 'absent.json'), dangling);
  for (const value of [link, dangling]) assert.throws(() => readRegularFile(value, { missingOk: true }), /inseguro/);
});

test('descriptor identity mismatch is refused before reading bytes', t => {
  const { root, file } = fixture(t);
  const other = path.join(root, 'other.json');
  fs.writeFileSync(other, 'outside fixture');
  const lstat = fs.lstatSync;
  let reads = 0;
  const read = fs.readFileSync;
  fs.lstatSync = (value, ...args) => lstat(value === file ? other : value, ...args);
  fs.readFileSync = (...args) => { reads++; return read(...args); };
  t.after(() => { fs.lstatSync = lstat; fs.readFileSync = read; });
  assert.throws(() => readRegularFile(file), /inseguro/);
  assert.equal(reads, 0);
});

test('adjacent identities above Number precision cannot be considered the same file', t => {
  const { file } = fixture(t);
  const fstat = fs.fstatSync;
  const lstat = fs.lstatSync;
  const identity = 9007199254740992n;
  fs.fstatSync = (fd, options) => Object.assign(fstat(fd, options), {
    ino: options?.bigint ? identity : Number(identity),
  });
  fs.lstatSync = (value, options) => Object.assign(lstat(value, options), {
    ino: options?.bigint ? identity + 1n : Number(identity + 1n),
  });
  t.after(() => { fs.fstatSync = fstat; fs.lstatSync = lstat; });
  assert.throws(() => readRegularFile(file), /inseguro/);
});

test('a path replaced after validation cannot redirect the open descriptor', t => {
  const { root, file } = fixture(t);
  const read = fs.readFileSync;
  let replaced = false;
  fs.readFileSync = (value, ...args) => {
    if (typeof value === 'number' && !replaced) {
      replaced = true;
      fs.renameSync(file, path.join(root, 'opened.json'));
      fs.writeFileSync(file, 'replacement fixture');
    }
    return read(value, ...args);
  };
  t.after(() => { fs.readFileSync = read; });
  assert.equal(readRegularFile(file), '{"text":"\u00e9"}');
  assert.equal(replaced, true);
  assert.equal(read(file, 'utf8'), 'replacement fixture');
});

test('descriptors close on read errors and preserve the original failure', t => {
  const { file } = fixture(t);
  const open = fs.openSync;
  const read = fs.readFileSync;
  let descriptor;
  const failure = new Error('synthetic read failure');
  fs.openSync = (...args) => { descriptor = open(...args); return descriptor; };
  fs.readFileSync = () => { throw failure; };
  t.after(() => { fs.openSync = open; fs.readFileSync = read; });
  assert.throws(() => readRegularFile(file), error => error === failure);
  assert.throws(() => fs.fstatSync(descriptor), { code: 'EBADF' });
});

test('descriptors close after successful reads too', t => {
  const { file } = fixture(t);
  const open = fs.openSync;
  let descriptor;
  fs.openSync = (...args) => { descriptor = open(...args); return descriptor; };
  t.after(() => { fs.openSync = open; });
  readRegularFile(file);
  assert.throws(() => fs.fstatSync(descriptor), { code: 'EBADF' });
});
