import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { readRegularFile } from './files.mjs';

export function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd();
}

export function project(cwd) {
  let root;
  try { root = fs.realpathSync(git(cwd, 'rev-parse', '--show-toplevel')); }
  catch { throw new Error('Abra a pasta do projeto Git no terminal do VS Code.'); }
  return {
    root,
    id: createHash('sha256').update(root).digest('hex'),
    branch: git(root, 'branch', '--show-current'),
    revision: git(root, 'rev-parse', 'HEAD'),
  };
}

export function requireFeature(info) {
  if (!/^feature\/[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(info.branch)) {
    throw new Error('Escrita permitida somente em feature/*. Use: npm run millennium -- prepare --name meu-turno');
  }
}

export function prepare(cwd, name) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name ?? '')) {
    throw new Error('Use um nome simples, por exemplo: meu-primeiro-turno.');
  }
  const info = project(cwd);
  if (git(info.root, 'status', '--porcelain')) {
    throw new Error('Existem alteracoes. Preserve/revise os arquivos antes de trocar de branch.');
  }
  git(info.root, 'show-ref', '--verify', 'refs/heads/develop');
  try { git(info.root, 'show-ref', '--verify', `refs/heads/feature/${name}`); }
  catch {
    git(info.root, 'switch', 'develop');
    git(info.root, 'pull', '--ff-only');
    git(info.root, 'switch', '-c', `feature/${name}`);
    return project(cwd);
  }
  throw new Error(`feature/${name} ja existe. Abra essa branch ou escolha outro nome.`);
}

export function fingerprint(root) {
  const hash = createHash('sha256');
  hash.update(git(root, 'rev-parse', 'HEAD'));
  const files = new Set(git(root, 'ls-files', '-c', '-o', '--exclude-standard', '-z').split('\0').filter(Boolean));
  for (const file of [...files].sort()) {
    if (file.startsWith('.millennium/') || /(^|\/)\.env(?:\.|$)/.test(file)) continue;
    const full = path.join(root, file);
    hash.update(file + '\0');
    try {
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) hash.update('link:' + fs.readlinkSync(full));
      else if (stat.isFile()) hash.update(readRegularFile(full, { encoding: null }));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      hash.update('deleted');
    }
  }
  return hash.digest('hex');
}

export function diffEvidence(root) {
  let diff = git(root, 'diff', '--binary', 'HEAD', '--', '.', ':(exclude,glob)**/.env*');
  const files = git(root, 'ls-files', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean);
  for (const file of files) {
    if (file.startsWith('.millennium/') || /(^|\/)\.env(?:\.|$)/.test(file)) continue;
    try { diff += '\n' + git(root, 'diff', '--no-index', '--binary', '--', '/dev/null', file); }
    catch (error) {
      if (error.status !== 1 || !error.stdout) throw error;
      diff += '\n' + error.stdout;
    }
  }
  return diff;
}
