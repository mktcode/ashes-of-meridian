import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const outputName = 'dist/src/diagnostics/build-info.js';

// Fingerprint runtime code and local assets, not maps, scratch or this stamp.
// No wall clock: identical payloads remain reproducible, including ZIP builds.
export function buildInfo(root) {
  const paths = readdirSync(root)
    .filter((name) => name.endsWith('.html'))
    .sort();
  function visit(directory, runtimeOnly = false) {
    for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
      const name = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) throw Error(`Runtime fingerprint rejects symlink: ${name}`);
      if (entry.isDirectory()) visit(name, runtimeOnly);
      else if (
        entry.isFile() &&
        name !== outputName &&
        (!runtimeOnly || /\.(?:js|html)$/.test(name))
      )
        paths.push(name);
    }
  }
  visit('dist', true);
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

export function sourceFingerprint(root) {
  if (!existsSync(join(root, 'src')) || !existsSync(join(root, 'tsconfig.json'))) return null;
  const paths = ['tsconfig.json'];
  function visit(directory) {
    for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
      const name = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) throw Error(`Source fingerprint rejects symlink: ${name}`);
      if (entry.isDirectory()) visit(name);
      else if (/\.(?:ts|js)$/.test(name)) paths.push(name);
    }
  }
  visit('src');
  for (const name of ['crowd-simulation', 'landscape']) {
    const workspace = `packages/${name}`;
    if (!existsSync(join(root, workspace))) continue;
    visit(`${workspace}/src`);
    visit(`${workspace}/demo`);
    paths.push(
      `${workspace}/demo/index.html`,
      `${workspace}/package.json`,
      `${workspace}/tsconfig.json`,
      `${workspace}/build.mjs`,
    );
    if (name === 'landscape') paths.push(`${workspace}/tests/fixtures/strata-417.zip`);
  }
  if (
    existsSync(join(root, 'packages/crowd-simulation')) ||
    existsSync(join(root, 'packages/landscape'))
  )
    for (const manifest of ['package.json', 'package-lock.json'])
      if (existsSync(join(root, manifest))) paths.push(manifest);
  const hash = createHash('sha256');
  for (const name of paths.sort()) {
    const data = readFileSync(join(root, name));
    hash.update(`${name}\0${data.length}\0`).update(data);
  }
  return `sha256:${hash.digest('hex')}`;
}

export function verifyCaptureBuild(root) {
  let stamp;
  try {
    stamp = JSON.parse(readFileSync(join(root, 'dist/capture-source.json'), 'utf8'));
  } catch {
    throw Error('Capture build stamp missing; run npm run build or omit --reuse-build');
  }
  if (stamp.sourceId !== sourceFingerprint(root) || stamp.runtimeId !== buildInfo(root).id)
    throw Error('Build is stale; omit --reuse-build or run npm run build');
  return stamp;
}

export function writeBuildInfo(root) {
  const info = buildInfo(root);
  const output = join(root, outputName);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(
    output,
    `'use strict';\nconst MERIDIAN_BUILD_INFO = Object.freeze(${JSON.stringify(info)});\n`,
  );
  writeFileSync(
    join(root, 'dist/capture-source.json'),
    JSON.stringify({ sourceId: sourceFingerprint(root), runtimeId: info.id }) + '\n',
  );
  return info;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, '..');
  const info = writeBuildInfo(root);
  console.log(`Stamped ${relative(root, join(root, outputName))}: ${info.id}`);
}
