// node --max-old-space-size=128 --test --test-concurrency=1 tests/ashes-of-meridian-crystals.check.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts } = require('./helpers/game-scripts.cjs');
const { createRendererStub } = require('./helpers/renderer-stub.cjs');
const context = loadScripts(['core', 'renderer', 'content', 'world', 'world-view']);
const { geom, renderEntity, MAT } = vm.runInContext('({geom, renderEntity, MAT})', context);
const deposit = (id = 1, amount = 1800) => Object.freeze({
  id, amount, kind: 'resource', type: 'crystal', x: 12, z: -7,
  hp: 1, size: 1.3, team: -1, faction: 0, rot: 0,
});
function render(e, time = 0, options = {}) {
  const renderer = createRendererStub({ record: true });
  renderEntity(renderer, e, time, options);
  return renderer.calls;
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

const simContext = loadScripts(['core', 'content', 'world', 'effects', 'simulation'], { globals: { structuredClone } });
vm.runInContext('Math.random = () => { throw Error("Unexpected unseeded randomness"); }', simContext);
const { MeridianGame, BIOMES } = vm.runInContext('({MeridianGame, BIOMES})', simContext);
const json = value => JSON.parse(JSON.stringify(value));
const crystals = game => game.s.entities.filter(e => e.kind === 'resource' && e.type === 'crystal' && e.hp > 0);
const fresh = () => new MeridianGame({ upgrades: {} });
function separated(game) {
  const nodes = crystals(game);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    assert.ok(Math.hypot(nodes[i].x - nodes[j].x, nodes[i].z - nodes[j].z) >= nodes[i].size + nodes[j].size + .8,
      `crystals ${nodes[i].id} and ${nodes[j].id} overlap`);
  }
}

test('all factions and biomes retain 40 distinct accessible crystals in five-slot ellipses', () => {
  for (const faction of [0,1,2]) for (const [i, biome] of Object.keys(BIOMES).entries()) {
    const game = fresh(); game.start({ seed: 12345 + i * 31, faction, enemy: i % 3, biome });
    const nodes = crystals(game); assert.equal(nodes.length, 40); separated(game);
    assert.equal(game.s.entities.filter(e => e.type === 'gas').length, 8);
    for (let i = 0; i < 8; i++) {
      const group = nodes.slice(i * 5, i * 5 + 5);
      const cx = group.reduce((sum, e) => sum + e.x, 0) / 5, cz = group.reduce((sum, e) => sum + e.z, 0) / 5;
      for (const e of group) {
        assert.ok(Math.abs(((e.x-cx)/3.9)**2 + ((e.z-cz)/3)**2 - 1) < 1e-12);
        assert.equal(game.world.blockedAt(e.x, e.z), false, `battle ${biome}/${faction}, crystal ${e.id}`);
        for (const b of game.s.entities.filter(b => b.kind === 'building' && b.hp > 0))
          assert.ok(Math.hypot(e.x-b.x, e.z-b.z) >= e.size + b.size, `crystal ${e.id} intersects ${b.type} in battle ${biome}/${faction}`);
        assert.equal(e.size, 1.3); assert.ok(e.amount >= 1800 && e.amount < 2700);
      }
    }
  }
});

test('full test loadout preserves the existing seed 9897 crystal-amount reference', () => {
  // Captured from 187c936 before research removal; do not regenerate to mask RNG shifts.
  const game = fresh(); game.start({ seed: 9897 });
  assert.equal(game.alive(e => e.type === 'lab').length, 0);
  assert.deepEqual(json(crystals(game).map(e => e.amount)), [2009,1898,2252,1862,2134,2163,2441,1808,2452,1987,2118,2596,2622,2599,2559,2307,1910,2364,2159,2190,2230,2244,2523,2412,2023,2596,1997,1844,2478,2381,2625,2226,2309,1994,1835,1836,2011,2361,2026,2065]);
});

test('new-layout saves round-trip without moving resources or resetting valid mining paths', () => {
  const game = fresh(); game.start({ seed: 1409 });
  for (let i = 0; i < 100; i++) { game.step(.05); game.effects.tick(.05); }
  const saved = game.snapshot(), restored = fresh(); restored.restore(saved);
  assert.deepEqual(json(restored.s.entities), json(saved.entities));
});

test('aether vents retain their existing shapes and animated effects', () => {
  const e = { ...deposit(), type: 'gas' }, calls = render(e);
  assert.deepEqual(calls.map(c => c[0]), ['hex', 'hex', 'octa', 'sphere', 'sphere', 'sphere']);
  assert.notDeepEqual(calls, render(e, 2));
});
