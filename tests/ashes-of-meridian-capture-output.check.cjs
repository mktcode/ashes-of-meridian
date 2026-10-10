const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const root = resolve(__dirname, '..');

function sandbox(t) {
  const base = join(root, '.tmp/capture-output-tests');
  mkdirSync(base, { recursive: true });
  const directory = mkdtempSync(join(base, 'case-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('itch captures use unique worktree-local output and scratch directories', async t => {
  const { prepareItchCapturePaths } = await import('../scripts/capture-output.mjs');
  const worktree = sandbox(t);
  const a = await prepareItchCapturePaths(worktree), b = await prepareItchCapturePaths(worktree);
  for (const value of [a.output, a.scratch, b.output, b.scratch]) {
    assert.ok(value.startsWith(join(worktree, '.tmp') + '/'));
    assert.ok(existsSync(value));
  }
  assert.equal(new Set([a.output, a.scratch, b.output, b.scratch]).size, 4);
  assert.equal(existsSync(join(worktree, 'release')), false);
});

test('explicit release output refuses existing captures and paths outside approved worktree folders', async t => {
  const { prepareItchCapturePaths } = await import('../scripts/capture-output.mjs');
  const worktree = sandbox(t), requested = 'release/itch-media/acceptance';
  const { output, scratch } = await prepareItchCapturePaths(worktree, requested);
  assert.equal(output, join(worktree, requested));
  assert.ok(scratch.startsWith(join(worktree, '.tmp') + '/'));
  writeFileSync(join(output, 'old.webp'), 'keep me');
  await assert.rejects(prepareItchCapturePaths(worktree, requested), { code: 'EEXIST' });
  assert.equal(readFileSync(join(output, 'old.webp'), 'utf8'), 'keep me');
  for (const invalid of ['../foreign-output', 'src/capture', 'release/other', '.tmp/../../foreign-output', ''])
    await assert.rejects(prepareItchCapturePaths(worktree, invalid), /inside this worktree/);
  assert.equal(existsSync(join(worktree, 'src')), false);
});

test('capture paths reject symlink parents rather than writing into shared directories', async t => {
  const { prepareItchCapturePaths } = await import('../scripts/capture-output.mjs');
  const worktree = sandbox(t), other = join(worktree, 'other');
  mkdirSync(other); mkdirSync(join(worktree, '.tmp'));
  symlinkSync(other, join(worktree, '.tmp/redirect'), 'dir');
  await assert.rejects(prepareItchCapturePaths(worktree, '.tmp/redirect/new-run'), /symlink/);
  assert.equal(existsSync(join(other, 'new-run')), false);
});

function encoderPage(dataUrl, contextAvailable = true) {
  const calls = {}, png = Buffer.from('lossless screenshot bytes');
  const canvas = { getContext() { return contextAvailable ? { drawImage(image, x, y) {
    calls.source = image.src; calls.position = [x, y];
  } } : null; }, toDataURL(type, quality) { calls.type = type; calls.quality = quality; return dataUrl; } };
  return { calls, canvas, async screenshot(options) { calls.options = options; return png; },
    async evaluate(callback, base64) {
      return vm.runInNewContext(`(${callback.toString()})(base64)`, { base64,
        Image: class { width = 1920; height = 1080; async decode() { calls.decoded = true; } },
        document: { createElement(tag) { assert.equal(tag, 'canvas'); return canvas; } } });
    } };
}

test('shared screenshot encoder serializes and requests WebP quality 80 from lossless in-memory PNG', async () => {
  const { webpScreenshot } = await import('../scripts/capture-output.mjs');
  // Header-only mock: protects format/quality plumbing, not Chromium image encoding.
  const mockWebp = Buffer.from('RIFF\x04\0\0\0WEBP', 'binary');
  const page = encoderPage(`data:image/webp;base64,${mockWebp.toString('base64')}`);
  assert.ok((await webpScreenshot(page)).equals(mockWebp));
  assert.deepEqual(page.calls.options, { type: 'png', animations: 'disabled' });
  assert.equal(page.calls.decoded, true);
  assert.match(page.calls.source, /^data:image\/png;base64,/);
  assert.equal(page.canvas.width, 1920); assert.equal(page.canvas.height, 1080);
  assert.deepEqual(page.calls.position, [0, 0]);
  assert.equal(page.calls.type, 'image/webp'); assert.equal(page.calls.quality, .8);
});

test('shared screenshot encoder rejects canvas failure, PNG fallback and invalid WebP bytes', async () => {
  const { webpScreenshot } = await import('../scripts/capture-output.mjs');
  await assert.rejects(webpScreenshot(encoderPage('data:image/webp;base64,', false)), /Canvas encoder unavailable/);
  await assert.rejects(webpScreenshot(encoderPage('data:image/png;base64,aGVsbG8=')), /WebP encoder unavailable/);
  await assert.rejects(webpScreenshot(encoderPage('data:image/webp;base64,aGVsbG8=')), /Invalid WebP encoder output/);
});

test('itch CLI help and invalid scene checks require no Chromium launch', () => {
  const options = { cwd: root, timeout: 5000, env: { ...process.env, CHROMIUM_PATH: '/not-a-browser' } };
  const help = execFileSync(process.execPath, ['scripts/capture-itch-media.mjs', '--help'], options).toString();
  assert.match(help, /WebP quality 80/); assert.match(help, /02-desert-outpost/);
  assert.match(help, /only one desktop image/);
  assert.throws(() => execFileSync(process.execPath, ['scripts/capture-itch-media.mjs', '--scene', 'missing'],
    { ...options, stdio: 'pipe' }), error => /Unknown --scene/.test(error.stderr.toString()));
});
