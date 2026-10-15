const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const vm = require('node:vm');

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'meridian-build-info-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const directory of ['dist/src/diagnostics', 'styles', 'assets', 'audio'])
    mkdirSync(join(root, directory), { recursive: true });
  writeFileSync(join(root, 'index.html'), '<!doctype html>');
  writeFileSync(join(root, 'dist/src/core.js'), 'const value = 1;');
  writeFileSync(join(root, 'styles/main.css'), 'body { color: white; }');
  writeFileSync(join(root, 'assets/example.webp'), Buffer.from([1, 2, 3]));
  writeFileSync(join(root, 'audio/example.mp3'), Buffer.from([4, 5]));
  return root;
}

test('runtime fingerprint is reproducible, detects code/assets and loads as a frozen classic binding without Git', async (t) => {
  const { writeBuildInfo } = await import('../scripts/build-info.mjs');
  const root = fixture(t),
    first = writeBuildInfo(root);
  assert.match(first.id, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.commit, null, 'a fixture inside a repository cannot borrow its parent commit');
  assert.equal(first.dirty, null);
  const file = join(root, 'dist/src/diagnostics/build-info.js'),
    original = readFileSync(file, 'utf8');
  assert.deepEqual(writeBuildInfo(root), first, 'stamp excludes itself');
  assert.equal(
    readFileSync(file, 'utf8'),
    original,
    'no build timestamp breaks reproducible delivery',
  );
  writeFileSync(join(root, 'dist/src/core.js.map'), 'unrelated debug map');
  mkdirSync(join(root, '.tmp'));
  writeFileSync(join(root, '.tmp/scratch'), 'ignored');
  assert.deepEqual(writeBuildInfo(root), first);
  writeFileSync(join(root, 'dist/src/core.js'), 'const value = 2;');
  const code = writeBuildInfo(root);
  assert.notEqual(code.id, first.id);
  writeFileSync(join(root, 'assets/example.webp'), Buffer.from([3, 2, 1]));
  const asset = writeBuildInfo(root);
  assert.notEqual(asset.id, code.id);
  writeFileSync(join(root, 'styles/main.css'), 'body { color: black; }');
  assert.notEqual(writeBuildInfo(root).id, asset.id);
  const context = vm.createContext({});
  vm.runInContext(readFileSync(file, 'utf8'), context);
  assert.equal(vm.runInContext('Object.isFrozen(MERIDIAN_BUILD_INFO)', context), true);
  assert.equal(vm.runInContext('MERIDIAN_BUILD_INFO.id', context), writeBuildInfo(root).id);
});

test('build provenance distinguishes clean/dirty Git sources without exporting paths, branch or identity', async (t) => {
  const { writeBuildInfo } = await import('../scripts/build-info.mjs');
  const root = fixture(t);
  const git = (args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  git(['init', '--quiet']);
  writeFileSync(join(root, '.gitignore'), 'dist/\n.tmp/\n');
  git(['add', '.']);
  git([
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '--quiet',
    '-m',
    'fixture',
  ]);
  const clean = writeBuildInfo(root);
  assert.equal(clean.commit, git(['rev-parse', 'HEAD']));
  assert.equal(clean.dirty, false);
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>changed</title>');
  const dirty = writeBuildInfo(root);
  assert.equal(dirty.commit, clean.commit);
  assert.equal(dirty.dirty, true);
  assert.notEqual(dirty.id, clean.id);
  assert.deepEqual(Object.keys(dirty).sort(), ['commit', 'dirty', 'id']);
  assert.ok(!JSON.stringify(dirty).includes(root));
  assert.ok(!JSON.stringify(dirty).includes('Fixture'));
});

test('viewer entry changes runtime identity and source stamps detect stale TypeScript', async (t) => {
  const { writeBuildInfo, sourceFingerprint, verifyCaptureBuild } =
    await import('../scripts/build-info.mjs');
  const root = fixture(t),
    first = writeBuildInfo(root);
  writeFileSync(join(root, 'map-viewer.html'), '<!doctype html><title>Viewer</title>');
  assert.notEqual(writeBuildInfo(root).id, first.id);
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'tsconfig.json'), '{}');
  writeFileSync(join(root, 'src/camera.ts'), 'const camera = 1;');
  writeBuildInfo(root);
  const stamp = JSON.parse(readFileSync(join(root, 'dist/capture-source.json'), 'utf8'));
  assert.equal(stamp.sourceId, sourceFingerprint(root));
  assert.equal(verifyCaptureBuild(root).runtimeId, stamp.runtimeId);
  writeFileSync(join(root, 'src/camera.ts'), 'const camera = 2;');
  assert.notEqual(stamp.sourceId, sourceFingerprint(root));
  assert.throws(() => verifyCaptureBuild(root), /stale/);
  writeBuildInfo(root);
  writeFileSync(join(root, 'map-viewer.html'), '<!doctype html><title>Changed viewer</title>');
  assert.throws(() => verifyCaptureBuild(root), /stale/);
});

test('crowd delivery and package sources participate in runtime/source identities', async (t) => {
  const { writeBuildInfo, sourceFingerprint, verifyCaptureBuild } =
    await import('../scripts/build-info.mjs');
  const root = fixture(t);
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'tsconfig.json'), '{}');
  const packageRoot = join(root, 'packages/crowd-simulation');
  mkdirSync(join(packageRoot, 'src'), { recursive: true });
  mkdirSync(join(packageRoot, 'demo'));
  for (const file of ['package.json', 'tsconfig.json'])
    writeFileSync(join(packageRoot, file), '{}');
  writeFileSync(join(packageRoot, 'build.mjs'), '// build');
  writeFileSync(join(packageRoot, 'src/index.ts'), 'export const value = 1;');
  writeFileSync(join(packageRoot, 'demo/index.html'), '<!doctype html>');
  writeFileSync(join(packageRoot, 'demo/view.js'), '// demo');
  mkdirSync(join(root, 'dist/crowd-simulation'), { recursive: true });
  writeFileSync(join(root, 'dist/crowd-simulation/index.html'), '<!doctype html>');
  writeFileSync(join(root, 'dist/crowd-simulation/crowd.js'), 'const crowd = 1;');
  const first = writeBuildInfo(root),
    source = sourceFingerprint(root);
  writeFileSync(join(root, 'dist/crowd-simulation/crowd.js'), 'const crowd = 2;');
  assert.throws(() => verifyCaptureBuild(root), /stale/);
  assert.notEqual(writeBuildInfo(root).id, first.id);
  writeFileSync(join(packageRoot, 'src/index.ts'), 'export const value = 2;');
  assert.notEqual(sourceFingerprint(root), source);
  assert.throws(() => verifyCaptureBuild(root), /stale/);
  writeBuildInfo(root);
  writeFileSync(join(packageRoot, 'demo/index.html'), '<title>new demo</title>');
  assert.throws(() => verifyCaptureBuild(root), /stale/);
});

test('landscape importer, embedded map and demo delivery participate in build identities', async (t) => {
  const { writeBuildInfo, sourceFingerprint, verifyCaptureBuild } =
    await import('../scripts/build-info.mjs');
  const root = fixture(t),
    workspace = join(root, 'packages/landscape');
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'tsconfig.json'), '{}');
  for (const directory of ['src', 'demo', 'tests/fixtures'])
    mkdirSync(join(workspace, directory), { recursive: true });
  for (const file of ['package.json', 'tsconfig.json']) writeFileSync(join(workspace, file), '{}');
  writeFileSync(join(workspace, 'build.mjs'), '// build');
  writeFileSync(join(workspace, 'src/index.ts'), 'export const importer = 1;');
  writeFileSync(join(workspace, 'demo/index.html'), '<!doctype html>');
  writeFileSync(join(workspace, 'demo/app.js'), '// demo');
  writeFileSync(join(workspace, 'tests/fixtures/strata-417.zip'), Buffer.from([1, 2, 3]));
  mkdirSync(join(root, 'dist/landscape/demo'), { recursive: true });
  writeFileSync(join(root, 'dist/landscape/demo/index.html'), '<!doctype html>');
  const first = writeBuildInfo(root),
    source = sourceFingerprint(root);
  writeFileSync(join(root, 'dist/landscape/demo/index.html'), '<title>terrain</title>');
  assert.notEqual(writeBuildInfo(root).id, first.id);
  writeFileSync(join(workspace, 'src/index.ts'), 'export const importer = 2;');
  assert.notEqual(sourceFingerprint(root), source);
  assert.throws(() => verifyCaptureBuild(root), /stale/);
  writeBuildInfo(root);
  writeFileSync(join(workspace, 'tests/fixtures/strata-417.zip'), Buffer.from([4, 5, 6]));
  assert.throws(() => verifyCaptureBuild(root), /stale/);
});
