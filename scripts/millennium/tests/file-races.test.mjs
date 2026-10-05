import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Store } from '../store.mjs';
import { fingerprint } from '../project.mjs';
import { Repository } from '../../../payments-sandbox/repository.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'millennium-file-race-'));
  t.after(() => {
    assert.equal(path.dirname(root), os.tmpdir());
    assert.ok(path.basename(root).startsWith('millennium-file-race-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}

function swapBeforeOpen(t, file, outside) {
  const open = fs.openSync;
  const read = fs.readFileSync;
  let swapped = false;
  let pathReads = 0;
  const swap = value => {
    if (value === file && !swapped) {
      swapped = true;
      fs.unlinkSync(file);
      fs.symlinkSync(outside, file);
    }
  };
  fs.openSync = (file, ...args) => { swap(file); return open(file, ...args); };
  fs.readFileSync = (file, ...args) => {
    swap(file);
    if (file === target) pathReads++;
    return read(file, ...args);
  };
  t.after(() => { fs.openSync = open; fs.readFileSync = read; });
  const target = file;
  const occurred = () => swapped;
  occurred.pathReads = () => pathReads;
  return occurred;
}

test('Store rejects a state file swapped for a symlink between check and read', { skip: process.platform === 'win32' }, t => {
  const root = fixture(t);
  const file = path.join(root, 'state.json');
  const outside = path.join(root, 'outside.json');
  fs.writeFileSync(file, '{"safe":true}');
  fs.writeFileSync(outside, '{"fixture":"must-not-be-read"}');
  const store = Object.assign(Object.create(Store.prototype), { dir: root });
  const swapped = swapBeforeOpen(t, file, outside);
  assert.throws(() => store.read('state.json'), /inseguro/);
  assert.equal(swapped(), true);
})

test('Pix state loading refuses a swapped symlink and preserves the outside fixture', { skip: process.platform === 'win32' }, t => {
  const root = fixture(t);
  const data = path.join(root, 'data');
  fs.mkdirSync(data);
  const file = path.join(data, 'state.json');
  const outside = path.join(root, 'outside.json');
  const state = JSON.stringify({ schema: 1, mode: 'simulator', charges: [], events: [] });
  fs.writeFileSync(file, state);
  fs.writeFileSync(outside, state);
  const swapped = swapBeforeOpen(t, file, outside);
  assert.throws(() => new Repository(data, 'simulator'), /inseguro/);
  assert.equal(swapped(), true);
  assert.equal(swapped.pathReads(), 0, 'The outside state must not be consumed before rejecting it');
  assert.equal(fs.readFileSync(outside, 'utf8'), state);
})

test('fingerprinting never follows a regular file swapped for a symlink', { skip: process.platform === 'win32' }, t => {
  const root = fixture(t);
  const project = path.join(root, 'project');
  fs.mkdirSync(project);
  const git = (...args) => execFileSync('git', ['-C', project, '-c', 'core.hooksPath=/dev/null',
    '-c', 'commit.gpgsign=false', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { stdio: 'ignore' });
  git('init', '-b', 'feature/fixture');
  const file = path.join(project, 'readme.txt');
  const outside = path.join(root, 'outside.txt');
  fs.writeFileSync(file, 'safe fixture');
  fs.writeFileSync(outside, 'outside fixture');
  git('add', 'readme.txt'); git('commit', '-m', 'fixture');
  const swapped = swapBeforeOpen(t, file, outside);
  assert.throws(() => fingerprint(project), /inseguro/);
  assert.equal(swapped(), true);
})
