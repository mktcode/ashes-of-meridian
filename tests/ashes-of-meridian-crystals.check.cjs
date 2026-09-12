// node --max-old-space-size=128 --test --test-concurrency=1 tests/ashes-of-meridian-crystals.check.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { RENDERER_SCRIPTS, SIMULATION_SCRIPTS, loadScripts } = require('./helpers/game-scripts.cjs');
const { createRendererStub } = require('./helpers/renderer-stub.cjs');
const context = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', 'world', 'world-view']);
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

const simContext = loadScripts(['core', 'content', 'world', 'effects', ...SIMULATION_SCRIPTS], { globals: { structuredClone } });
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

test('HQ-only start preserves the existing seed 9897 crystal-amount reference', () => {
  // Captured from 187c936 before research removal; do not regenerate to mask RNG shifts.
  const game = fresh(); game.start({ seed: 9897 });
  assert.equal(game.alive(e => e.type === 'lab').length, 0);
  assert.deepEqual(json(crystals(game).map(e => e.amount)), [2009,1898,2252,1862,2134,2163,2441,1808,2452,1987,2118,2596,2622,2599,2559,2307,1910,2364,2159,2190,2230,2244,2523,2412,2023,2596,1997,1844,2478,2381,2625,2226,2309,1994,1835,1836,2011,2361,2026,2065]);
});

test('mining delivers alloy without moving the resource layout', () => {
  const game = fresh(); game.start({ seed: 1409 });
  const positions = () => json(crystals(game).map(e => [e.id,e.x,e.z]));
  const before = positions();
  assert.equal(game.train('worker'), true);
  for (let i = 0; i < 900; i++) { game.step(.05); game.effects.tick(.05); }
  assert.ok(game.s.stats.gathered > 0);
  assert.deepEqual(positions(), before);
});

test('aether vent housing is a bounded, deterministic beveled mesh with finite outward normals', () => {
  const mesh = geom.aetherVent();
  assert.deepEqual(mesh, geom.aetherVent());
  assert.ok(mesh.length / 27 >= 800 && mesh.length / 27 <= 1400, 'moderate reusable detail budget');
  const colors = new Set();
  let top = -Infinity;
  for (let i = 0; i < mesh.length; i += 27) {
    const a = mesh.slice(i, i + 3), b = mesh.slice(i + 9, i + 12), c = mesh.slice(i + 18, i + 21),
      u = b.map((v, k) => v - a[k]), v = c.map((v, k) => v - a[k]),
      cross = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]],
      area = Math.hypot(...cross);
    assert.ok(area > 1e-8, 'no degenerate faces');
    for (let j = i; j < i + 27; j += 9) {
      const vertex = mesh.slice(j, j + 9);
      assert.ok(vertex.every(Number.isFinite));
      assert.ok(Math.hypot(vertex[0], vertex[2] / .9) <= 1.96, 'retain original visual footprint');
      assert.ok(vertex[1] >= -.041 && vertex[1] <= 1.411);
      assert.ok(Math.abs(Math.hypot(...vertex.slice(3, 6)) - 1) < 1e-9);
      assert.ok(cross.every((n, k) => Math.abs(n / area - vertex[3 + k]) < 1e-9));
      if (vertex[1] < -.039) assert.ok(vertex[4] <= 0, 'bottom faces point down/out');
      if (vertex[1] > 1.409) assert.ok(vertex[4] >= 0, 'clamp caps point up/out');
      colors.add(vertex.slice(6).join(','));
      top = Math.max(top, vertex[1]);
    }
  }
  assert.equal(colors.size, 4, 'separate recess, panel and bevel colors');
  assert.ok(top > 1.4, 'raised retaining clamps');
});

test('aether vents use a shared metal housing, energy rings and crystal without mutating resources', () => {
  const e = Object.freeze({ ...deposit(), type: 'gas', size: 1.5, amount: 999999 }),
    before = JSON.stringify(e), calls = render(e), later = render(e, 2);
  assert.deepEqual(calls.map(c => c[0]), ['aetherVent', 'ring', 'ring', 'octa', 'sphere', 'sphere', 'sphere']);
  assert.equal(calls[0][14], MAT.METAL);
  assert.ok(calls.slice(1, 4).every(c => c[14] === MAT.CRYSTAL && c[11] > .4));
  assert.ok(calls[3][11] < 1, 'crystal retains directional facet lighting');
  assert.deepEqual(calls.slice(0, 3), later.slice(0, 3), 'housing and energy rings stay fixed');
  assert.notEqual(calls[3][8], later[3][8], 'central crystal rotates');
  assert.ok(calls[3][2] - calls[3][5] > .98, 'crystal clears its socket');
  assert.deepEqual(render(e), calls, 'repeated frame is deterministic');
  assert.equal(JSON.stringify(e), before);
  assert.ok(render(e, 0, { layer: 'effects', alpha: .3 }).slice(0, 4)
    .every(c => c[12] === .3 && c[13] === 'effects'));
  assert.deepEqual(render({ ...e, hp: 0 }), []);
  for (const time of [0, 2, 13]) {
    const vapor = render(e, time).slice(4);
    for (let i = 0; i < 3; i++) {
      const t = (time * .35 + i * .33) % 1;
      assert.deepEqual(vapor[i], ['sphere', e.x + Math.sin(time + i) * .3, .6 + t * 3, e.z,
        .35 + t * .8, .4 + t * .6, .35 + t * .8, 0x88ddd3, 0, 0, 0, .5, (1 - t) * .12, 'effects']);
    }
  }
});
