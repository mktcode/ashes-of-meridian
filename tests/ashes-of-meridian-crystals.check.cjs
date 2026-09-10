// node --max-old-space-size=128 --test --test-concurrency=1 tests/ashes-of-meridian-crystals.check.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const html = readFileSync(join(__dirname, '../index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const context = vm.createContext({});
for (const source of scripts.slice(0, 3)) vm.runInContext(source, context);
const { geom, renderEntity, MAT } = vm.runInContext('({geom, renderEntity, MAT})', context);
const deposit = (id = 1, amount = 1800) => Object.freeze({
  id, amount, kind: 'resource', type: 'crystal', x: 12, z: -7,
  hp: 1, size: 1.3, team: -1, faction: 0, rot: 0,
});
function render(e, time = 0, options = {}) {
  const calls = [];
  renderEntity({ add(...args) { calls.push(args); } }, e, time, options);
  return calls;
}

test('crystal prism has 36 finite, non-degenerate triangles and flat unit normals', () => {
  const mesh = geom.crystal();
  assert.deepEqual(mesh, geom.crystal());
  assert.equal(mesh.length / 27, 36);
  for (let i = 0; i < mesh.length; i += 9) {
    const v = mesh.slice(i, i + 9);
    assert.ok(v.every(Number.isFinite));
    assert.ok(Math.hypot(v[0], v[2]) <= 1.000001);
    assert.ok(v[1] >= 0 && v[1] <= 1);
    assert.ok(Math.abs(Math.hypot(...v.slice(3, 6)) - 1) < 1e-9);
  }
});

test('deposits have 9–12 growths, three chips, and a rock base; stable across frames', () => {
  const counts = new Set(), silhouettes = new Set();
  for (let id = 1; id <= 80; id++) {
    const e = deposit(id), before = JSON.stringify(e), calls = render(e);
    assert.deepEqual(calls, render(e, 175));
    assert.equal(JSON.stringify(e), before);
    assert.equal(calls[0][0], 'rockShelf');
    assert.equal(calls[0][14], MAT.ROCK);
    const shards = calls.slice(1);
    assert.ok(shards.length >= 12 && shards.length <= 15);
    assert.ok(shards.every(c => c[0] === 'alloyShard' && c[14] === MAT.CRYSTAL));
    assert.ok(shards.every(c => c.slice(1, 12).every(Number.isFinite)));
    assert.ok(shards.every(c => Math.hypot(c[1] - e.x, c[3] - e.z) < 1.4));
    assert.ok(shards.every(c => c[4] > 0 && c[5] > 0 && c[6] > 0));
    assert.ok(shards.every(c => c[11] < .3 && c[12] === 1 && c[13] === 'dynamic'));
    counts.add(shards.length);
    silhouettes.add(JSON.stringify(shards));
  }
  assert.equal(counts.size, 4);
  assert.equal(silhouettes.size, 80);
});

test('mining shrinks crystals without reshuffling their positions or changing the entity', () => {
  const full = render(deposit(17, 1800));
  assert.deepEqual(full, render(deposit(17, 2700)));
  for (const amount of [900, 1, 0]) {
    const reduced = render(deposit(17, amount));
    assert.equal(reduced.length, full.length);
    assert.deepEqual(reduced[0], full[0]);
    for (let i = 1; i < full.length; i++) {
      assert.ok(reduced[i][5] < full[i][5]);
      for (const index of [0, 1, 2, 3, 7, 8, 9, 10, 11, 12, 13, 14]) {
        assert.equal(reduced[i][index], full[i][index]);
      }
    }
  }
});

test('preview layer and opacity are respected; absent amounts have a finite full-size fallback', () => {
  const e = { ...deposit(), amount: undefined };
  assert.deepEqual(render(e), render(deposit()));
  assert.ok(render(e, 0, { layer: 'effects', alpha: .3 }).every(c => c[12] === .3 && c[13] === 'effects'));
  assert.deepEqual(render({ ...e, hp: 0 }), []);
});

test('aether vents retain their existing shapes and animated effects', () => {
  const e = { ...deposit(), type: 'gas' }, calls = render(e);
  assert.deepEqual(calls.map(c => c[0]), ['hex', 'hex', 'octa', 'sphere', 'sphere', 'sphere']);
  assert.notDeepEqual(calls, render(e, 2));
});
