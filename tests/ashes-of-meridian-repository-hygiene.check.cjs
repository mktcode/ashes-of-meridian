const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdir, mkdtemp, writeFile, rm, symlink } = require('node:fs/promises');
const { resolve, join } = require('node:path');

test('artifact classification rejects generated roots but preserves authored assets and similarly named source files', async () => {
  const { trackedArtifacts } = await import('../scripts/check-repository.mjs');
  assert.deepEqual(
    trackedArtifacts([
      'dist/a.js',
      '.tmp/log',
      'node_modules/a',
      'dist',
      'release/shot.webp',
      'docs/dist.md',
      'src/distinct.ts',
    ]),
    ['dist/a.js', '.tmp/log', 'node_modules/a', 'dist'],
  );
});

test('repository guard detects tracked outputs and shared writable symlinks without deleting them', async () => {
  const { checkRepository } = await import('../scripts/check-repository.mjs');
  const parent = resolve(__dirname, '../.tmp/repository-hygiene-tests');
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(parent, 'case-'));
  const git = (args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  try {
    git(['init', '-q']);
    await writeFile(join(root, '.gitignore'), '.tmp/\ndist/\nnode_modules/\n');
    git(['add', '.gitignore']);
    assert.equal(checkRepository(root), 1);
    await mkdir(join(root, 'dist'));
    await writeFile(join(root, 'dist', 'accident.js'), 'generated');
    git(['add', '-f', 'dist/accident.js']);
    assert.throws(() => checkRepository(root), /Generated\/scratch paths are tracked/);
    git(['rm', '--cached', '-q', 'dist/accident.js']);
    await symlink(join(root, 'dist'), join(root, 'node_modules'), 'dir');
    assert.throws(() => checkRepository(root), /directory is a symlink/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
