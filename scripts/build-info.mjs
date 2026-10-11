import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const outputName = 'dist/src/diagnostics/build-info.js';

// Fingerprint runtime code and local assets, not maps, scratch or this stamp.
// No wall clock: identical payloads remain reproducible, including ZIP builds.
export function buildInfo(root) {
  const paths = ['index.html'];
  function visit(directory, javascriptOnly = false) {
    for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
      const name = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) throw Error(`Runtime fingerprint rejects symlink: ${name}`);
      if (entry.isDirectory()) visit(name, javascriptOnly);
      else if (entry.isFile() && name !== outputName && (!javascriptOnly || name.endsWith('.js')))
        paths.push(name);
    }
  }
  visit('dist/src', true);
  for (const directory of ['styles', 'assets', 'audio']) visit(directory);
  const hash = createHash('sha256');
  for (const name of paths.sort()) {
    const data = readFileSync(join(root, name));
    hash.update(`${name}\0${data.length}\0`).update(data);
  }
  let commit = null;
  let dirty = null;
  const git = (args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    }).trim();
  try {
    // A source archive inside another repository must not borrow its identity.
    if (resolve(git(['rev-parse', '--show-toplevel'])) === resolve(root)) {
      commit = git(['rev-parse', '--verify', 'HEAD']);
      dirty = git(['status', '--porcelain', '--untracked-files=normal']).length > 0;
    }
  } catch {
    commit = dirty = null;
  }
  return { id: `sha256:${hash.digest('hex')}`, commit, dirty };
}

export function writeBuildInfo(root) {
  const info = buildInfo(root);
  const output = join(root, outputName);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(
    output,
    `'use strict';\nconst MERIDIAN_BUILD_INFO = Object.freeze(${JSON.stringify(info)});\n`,
  );
  return info;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, '..');
  const info = writeBuildInfo(root);
  console.log(`Stamped ${relative(root, join(root, outputName))}: ${info.id}`);
}
