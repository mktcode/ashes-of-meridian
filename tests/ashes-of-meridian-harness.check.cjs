const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readInlineScripts, loadScripts } = require('./helpers/inline-scripts.cjs');
const { createRendererStub } = require('./helpers/renderer-stub.cjs');

const sample = `
<script data-meridian-script="base">const value = 41;</script>
<script data-meridian-script="unused">throw Error('must not execute');</script>
<script data-meridian-script='dependent'>const result = value + 1;</script>`;

test('loader selects explicit names in document order, skipping unrelated scripts', () => {
  const scripts = readInlineScripts(sample);
  assert.deepEqual(scripts.map(s => s.name), ['base', 'unused', 'dependent']);
  const context = loadScripts(['dependent', 'base'], { scripts });
  assert.equal(vm.runInContext('result', context), 42);
});

test('loader rejects absent, duplicate, unnamed and non-classic script blocks', () => {
  assert.throws(() => readInlineScripts(''), /No inline scripts/);
  assert.throws(() => readInlineScripts('<script>const x = 1;</script>'), /missing a valid/);
  assert.throws(() => readInlineScripts(sample + sample), /Duplicate inline script: base/);
  for (const attribute of ['src="other.js"', 'type="module"']) {
    assert.throws(() => readInlineScripts(`<script data-meridian-script="base" ${attribute}></script>`), /classic inline/);
  }
  assert.throws(() => loadScripts(['missing'], { scripts: readInlineScripts(sample) }), /Missing inline script: missing/);
});

test('VM contexts are isolated and browser globals are not silently mocked', () => {
  const scripts = readInlineScripts('<script data-meridian-script="base">let value = input;</script>');
  const a = loadScripts(['base'], { scripts, globals: { input: 1 } });
  const b = loadScripts(['base'], { scripts, globals: { input: 2 } });
  vm.runInContext('value = 3', a);
  assert.equal(vm.runInContext('value', b), 2);
  assert.equal(vm.runInContext('typeof document', a), 'undefined');
  assert.equal(vm.runInContext('typeof window', a), 'undefined');
});

test('script failures identify the named source', () => {
  assert.throws(() => loadScripts(['unused'], { scripts: readInlineScripts(sample) }), error => {
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
