const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { readScripts, loadScripts } = require('./helpers/game-scripts.cjs');
const { createRendererStub } = require('./helpers/renderer-stub.cjs');

const sample = `
<script data-meridian-script="base">const value = 41;</script>
<script data-meridian-script="unused">throw Error('must not execute');</script>
<script data-meridian-script='dependent'>const result = value + 1;</script>`;

function sandbox(t) {
  const directory = mkdtempSync(join(tmpdir(), 'meridian-loader-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const rootDir = join(directory, 'source');
  mkdirSync(rootDir);
  return { directory, rootDir };
}

test('content loads alone with reference catalog order, classic bindings and naming/icon helpers', () => {
  // First verified against a3568ae's inline content block, before extraction.
  const context = loadScripts(['content']);
  const { FACTIONS, UNITS, BUILDINGS, META, BIOMES, unitName, buildingName, icon } =
    vm.runInContext('({ FACTIONS, UNITS, BUILDINGS, META, BIOMES, unitName, buildingName, icon })', context);
  for (const name of ['M4', 'seeded', 'MeridianRenderer', 'document', 'window']) {
    assert.equal(vm.runInContext(`typeof ${name}`, context), 'undefined');
  }
  assert.equal(vm.runInContext('typeof CAMPAIGN + typeof ACTS', context), 'undefinedundefined');
  assert.strictEqual(context.icon, icon);
  assert.deepEqual([FACTIONS.length, Object.keys(META).length], [3, 6]);
  assert.equal(vm.runInContext('typeof TECH', context), 'undefined');
  assert.deepEqual(Object.keys(UNITS), ['worker', 'rifle', 'scout', 'medic', 'tank', 'artillery', 'air', 'hero']);
  assert.deepEqual(Object.keys(BUILDINGS), ['hq', 'barracks', 'depot', 'refinery', 'factory', 'hangar', 'turret']);
  assert.deepEqual(Object.keys(BIOMES), ['ash', 'rust', 'choir', 'court', 'star']);
  assert.equal(unitName('worker'), 'Prospector');
  assert.equal(unitName('worker', 1), 'Tender');
  assert.equal(unitName('worker', 2), 'Custodian');
  assert.equal(unitName('unknown-unit'), 'unknown-unit');
  assert.equal(buildingName('hq'), 'Command center');
  assert.equal(buildingName('hq', 1), 'Memory heart');
  assert.equal(buildingName('hq', 2), 'Silent throne');
  assert.equal(buildingName('unknown-building'), 'unknown-building');
  assert.equal(icon('unknown-icon'), icon('hero'));
  assert.match(icon('worker'), /^<svg viewBox="0 0 24 24".*<path d="M8 15l-4 5/);
});

test('loader selects explicit names in document order, skipping unrelated scripts', () => {
  const scripts = readScripts(sample);
  assert.deepEqual(scripts.map(s => s.name), ['base', 'unused', 'dependent']);
  const context = loadScripts(['dependent', 'base'], { scripts });
  assert.equal(vm.runInContext('result', context), 42);
});

test('loader rejects absent, duplicate, unnamed and non-classic script blocks', () => {
  assert.throws(() => readScripts(''), /No scripts/);
  assert.throws(() => readScripts('<script>const x = 1;</script>'), /missing a valid/);
  assert.throws(() => readScripts(sample + sample), /Duplicate script: base/);
  for (const attribute of ['type="module"', 'type="text/javascript"', 'async', 'defer', 'nomodule']) {
    assert.throws(() => readScripts(`<script data-meridian-script="base" ${attribute}></script>`), /synchronous classic/);
  }
  assert.throws(() => loadScripts(['missing'], { scripts: readScripts(sample) }), /Missing script: missing/);
});

test('VM contexts are isolated and browser globals are not silently mocked', () => {
  const scripts = readScripts('<script data-meridian-script="base">let value = input;</script>');
  const a = loadScripts(['base'], { scripts, globals: { input: 1 } });
  const b = loadScripts(['base'], { scripts, globals: { input: 2 } });
  vm.runInContext('value = 3', a);
  assert.equal(vm.runInContext('value', b), 2);
  assert.equal(vm.runInContext('typeof document', a), 'undefined');
  assert.equal(vm.runInContext('typeof window', a), 'undefined');
});

test('script failures identify the named source', () => {
  assert.throws(() => loadScripts(['unused'], { scripts: readScripts(sample) }), error => {
    assert.match(error.stack, /index\.html#unused/);
    return true;
  });
});

test('renderer stub records only when requested, copies fog and handles colors', () => {
  const renderer = createRendererStub({ record: true });
  renderer.add('box', 1, 2, 3);
  assert.deepEqual(renderer.calls, [['box', 1, 2, 3]]);
  renderer.clearStatic();
  assert.deepEqual(renderer.calls, []);
  const quiet = createRendererStub();
  quiet.add('box');
  assert.deepEqual(quiet.calls, []);
  const pixels = new Uint8Array([0, 80, 255]);
  renderer.fog(pixels);
  pixels[0] = 255;
  assert.deepEqual(Array.from(renderer.fogPixels), [0, 80, 255]);
  assert.deepEqual(renderer.color(0xff0080), [1, 0, 128 / 255]);
  assert.deepEqual(renderer.color('#ff0080'), renderer.color(0xff0080));
  const color = [.1, .2, .3];
  assert.strictEqual(renderer.color(color), color);
});

test('local files and inline scripts share lexical bindings in document order, relative to source root', t => {
  const { rootDir } = sandbox(t);
  mkdirSync(join(rootDir, 'lib'));
  writeFileSync(join(rootDir, 'lib/base.js'), 'const value = initial + 40;');
  writeFileSync(join(rootDir, 'index.html'), `<script data-meridian-script="initial">const initial = 1;</script>
<script data-meridian-script="base" src="./lib/base.js"></script>
<script data-meridian-script="unused">throw Error('must not execute');</script>
<script data-meridian-script="dependent">const result = value + 1;</script>`);
  const scripts = readScripts(undefined, { rootDir });
  assert.equal(scripts[1].filename, 'lib/base.js');
  const context = loadScripts(['dependent', 'base', 'initial'], { scripts });
  assert.equal(vm.runInContext('result', context), 42);
  assert.equal(context.value, undefined);
});

test('loader rejects URLs, traversal, ambiguous external content and base elements', () => {
  for (const path of ['https://example.invalid/code.js', '//example.invalid/code.js', 'file:///tmp/code.js', '/tmp/code.js', '../code.js', './lib/../code.js', '.\\code.js', './%63ode.js', './code.js?v=1', './code.js#hash', '']) {
    assert.throws(() => readScripts(`<script data-meridian-script="base" src="${path}"></script>`), /Invalid local script path/);
  }
  assert.throws(() => readScripts('<script data-meridian-script="base" src="./base.js">const ignored = 1;</script>'), /must not contain inline code/);
  assert.throws(() => readScripts('<base href="elsewhere/">' + sample), /Unsupported base element/);
});

test('loader rejects duplicate, unquoted, valueless and misleading attributes', () => {
  for (const attributes of ['data-meridian-script=base', 'data-meridian-script="base" src=base.js', 'data-meridian-script="base" data-meridian-script="other"', 'data-meridian-script="base" src="a.js" src="b.js"', 'data-meridian-script="base" src', 'data-meridian-script', 'data-other="data-meridian-script=base"']) {
    assert.throws(() => readScripts(`<script ${attributes}></script>`), /attribute|missing a valid|Invalid local script path/);
  }
});

test('loader reports missing local sources and rejects symlinks outside the source root', t => {
  const { directory, rootDir } = sandbox(t);
  const html = '<script data-meridian-script="base" src="./base.js"></script>';
  assert.throws(() => readScripts(html, { rootDir }), /Cannot read script base.*base\.js/);
  writeFileSync(join(directory, 'outside.js'), 'throw Error("must not execute");');
  symlinkSync(join(directory, 'outside.js'), join(rootDir, 'base.js'));
  assert.throws(() => readScripts(html, { rootDir }), /escapes source root/);
});

test('external script failures identify the local source file', t => {
  const { rootDir } = sandbox(t);
  writeFileSync(join(rootDir, 'base.js'), 'throw Error("external failure");');
  const scripts = readScripts('<script data-meridian-script="base" src="base.js"></script>', { rootDir });
  assert.throws(() => loadScripts(['base'], { scripts }), error => {
    assert.match(error.stack, /base\.js:1/);
    assert.match(error.message, /external failure/);
    return true;
  });
});
