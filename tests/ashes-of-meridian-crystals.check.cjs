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
const { MeridianGame, CAMPAIGN, BIOMES } = vm.runInContext('({MeridianGame, CAMPAIGN, BIOMES})', simContext);
const legacySave = require('./fixtures/operation-v1.json');
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

test('all campaign and varied skirmish starts have 40 distinct, accessible crystals in five-slot ellipses', () => {
  const cases = CAMPAIGN.map((m, i) => [i, { seed: m.seed, faction: i % 3 }]);
  for (const [i, biome] of Object.keys(BIOMES).entries())
    cases.push([-1, { seed: 12345 + i * 31, faction: i % 3, enemy: 'mixed', mission: { type: 'conquest', biome, tier: 3, bases: 3 } }]);
  for (const [index, opts] of cases) {
    const game = fresh(); game.start(index, opts);
    const nodes = crystals(game); assert.equal(nodes.length, 40); separated(game);
    assert.equal(game.s.entities.filter(e => e.type === 'gas').length, 8);
    for (let i = 0; i < 8; i++) {
      const group = nodes.slice(i * 5, i * 5 + 5);
      const cx = group.reduce((sum, e) => sum + e.x, 0) / 5, cz = group.reduce((sum, e) => sum + e.z, 0) / 5;
      for (const e of group) {
        assert.ok(Math.abs(((e.x-cx)/3.9)**2 + ((e.z-cz)/3)**2 - 1) < 1e-12);
        assert.equal(game.world.blockedAt(e.x, e.z), false, `mission ${index}, crystal ${e.id}`);
        for (const b of game.s.entities.filter(b => b.kind === 'building' && b.hp > 0))
          assert.ok(Math.hypot(e.x-b.x, e.z-b.z) >= e.size + b.size, `crystal ${e.id} intersects ${b.type} in mission ${index}`);
        assert.equal(e.size, 1.3); assert.ok(e.amount >= 1800 && e.amount < 2700);
      }
    }
  }
});

test('corrected placement preserves all initial amounts and the fixed pre-fix RNG continuation', () => {
  // Recorded once from unchanged 2817f5d; not regenerated by the test.
  const game = fresh(); game.start(0, { seed: 1409 });
  assert.deepEqual(json(crystals(game).map(e => e.amount)), [2606,2331,2019,2308,2569,2001,2004,2069,1940,2499,2034,2543,2550,2556,1803,1912,2632,2053,2535,2309,2012,2647,2064,2603,2119,1911,1837,2609,1897,1915,1988,2634,2433,1837,2468,2665,2574,2564,2611,2404]);
  assert.deepEqual(Array.from({ length: 5 }, () => game.random()), [.3494525582063943,.934567065211013,.6150092391762882,.8877889793366194,.5110084267798811]);
  assert.deepEqual(json(crystals(game).map(e => e.id)), Array.from({ length: 40 }, (_, k) => 12 + k + Math.floor(k / 5)));
});

test('new-layout saves round-trip without moving resources or resetting valid mining paths', () => {
  const game = fresh(); game.start(0, { seed: 1409 });
  for (let i = 0; i < 100; i++) { game.step(.05); game.tickEffects(.05); }
  const saved = game.snapshot(), restored = fresh(); restored.restore(saved);
  assert.deepEqual(json(restored.s.entities), json(saved.entities));
  const before = json(restored.s);
  restored.random = () => { throw Error('Repair consumed RNG'); };
  restored.repairLegacyCrystalPositions(); assert.deepEqual(json(restored.s), before);
});

test('legacy migration preserves IDs, remaining alloy, exhausted/missing/custom nodes and orders; it is idempotent', () => {
  const saved = structuredClone(legacySave);
  saved.entities.find(e => e.id === 13).amount = 31;
  Object.assign(saved.entities.find(e => e.id === 14), { amount: 0, hp: 0 });
  saved.entities = saved.entities.filter(e => e.id !== 21);
  const custom = { ...structuredClone(saved.entities.find(e => e.id === 12)), id: saved.nextId++, x: -68, z: 48, amount: 19 };
  saved.entities.push(custom);
  const workers = saved.entities.filter(e => e.type === 'worker');
  Object.assign(workers[0], { order: { type: 'mine', id: 13 }, carry: 5, returning: false, path: [{x: -63, z: 41}], pi: 0, nextPath: 999, pathGoal: {x: -63, z: 41} });
  Object.assign(workers[1], { order: { type: 'mine', id: 13 }, returning: true, carry: 18 });
  const before = json(saved), game = fresh(); game.restore(saved);
  assert.deepEqual(json(saved), before);
  assert.equal(game.s.nextId, saved.nextId);
  assert.deepEqual(json(game.s.entities.map(e => [e.id, e.amount, e.hp, e.carry, e.order, e.orders])),
    json(saved.entities.map(e => [e.id, e.amount, e.hp, e.carry, e.order, e.orders])));
  assert.deepEqual(json(game.get(custom.id)), json(custom));
  assert.deepEqual(json(game.s.entities.find(e => e.id === 14)), json(saved.entities.find(e => e.id === 14)));
  assert.equal(game.get(21), null);
  const miner = game.get(workers[0].id);
  assert.deepEqual(json(miner.path), []); assert.equal(miner.nextPath, 0); assert.equal(miner.pi, 0); assert.equal(miner.pathGoal, undefined);
  assert.deepEqual(json(game.get(workers[1].id)), json(workers[1]));
  const migrated = game.snapshot(), again = fresh(); again.restore(migrated);
  assert.deepEqual(json(again.s.entities), json(game.s.entities));
});

test('legacy repair avoids a legally placed building without changing its data or losing crystals', () => {
  const game = fresh(); game.start(0, { seed: 1409 });
  // Arrange the original saved layout to check its building clearance before loading.
  game.s = structuredClone(legacySave); game.rehash();
  assert.equal(game.canBuild('depot', { x: -60.3, z: 45.3 }), '');
  const building = game.spawnBuilding('depot', -60.3, 45.3, 0, 0), saved = game.snapshot();
  const a = fresh(), b = fresh(); a.restore(saved); b.restore(saved);
  assert.deepEqual(json(a.s), json(b.s)); separated(a);
  assert.deepEqual(json(a.get(building.id)), json(building));
  assert.equal(crystals(a).length, 40);
  for (const e of crystals(a)) {
    assert.ok(Math.hypot(e.x-building.x, e.z-building.z) >= e.size + building.size + .8);
    assert.equal(a.world.blockedAt(e.x, e.z), false, `relocated crystal ${e.id} must remain accessible`);
  }
  assert.deepEqual(json(crystals(a).map(e => [e.id, e.amount])), json(crystals(game).map(e => [e.id, e.amount])));
  const again = fresh(); again.restore(a.snapshot()); assert.deepEqual(json(again.s.entities), json(a.s.entities));
});

test('repair leaves a site intact if a safe arrangement is impossible, without RNG consumption', () => {
  const game = fresh(); game.start(0, { seed: 1409 }); game.s = structuredClone(legacySave);
  const before = json(game.s); game.world.blockedAt = () => true;
  game.random = () => { throw Error('Repair consumed RNG'); };
  game.repairLegacyCrystalPositions(); assert.deepEqual(json(game.s), before);
});

test('miners reach relocated crystal IDs and deliver alloy after loading a legacy path', () => {
  const saved = structuredClone(legacySave), target = saved.entities.find(e => e.id === 16);
  const worker = saved.entities.find(e => e.type === 'worker');
  Object.assign(worker, { x: target.x, z: target.z, carry: 0, returning: false, order: { type: 'mine', id: target.id },
    path: [{ x: target.x, z: target.z }], pi: 0, nextPath: 1e9, pathGoal: { x: target.x, z: target.z } });
  const game = fresh(); game.restore(saved); separated(game);
  for (let i = 0; i < 1000; i++) { game.step(.05); game.tickEffects(.05); }
  assert.ok(game.get(target.id).amount < target.amount);
  assert.ok(game.s.stats.gathered > saved.stats.gathered);
  assert.ok(game.s.entities.every(e => [e.x, e.z, e.hp].every(Number.isFinite)));
});

test('aether vents retain their existing shapes and animated effects', () => {
  const e = { ...deposit(), type: 'gas' }, calls = render(e);
  assert.deepEqual(calls.map(c => c[0]), ['hex', 'hex', 'octa', 'sphere', 'sphere', 'sphere']);
  assert.notDeepEqual(calls, render(e, 2));
});
