// CPU tests with fixed start expectations and current-checkpoint round-trips.
// Scope: docs/reference-tests.md.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readScripts, loadScripts } = require('./helpers/game-scripts.cjs');
const { createRendererStub } = require('./helpers/renderer-stub.cjs');

const scripts = readScripts();
// JSON transport is intentional: saves have JSON semantics, and VM objects have
// different prototypes. This is not a replacement for cloning live game state.
const json = value => JSON.parse(JSON.stringify(value));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≈ ${expected}`);

function createGame() {
  const context = loadScripts(['core', 'renderer', 'content', 'world', 'world-view', 'effects', 'simulation'], {
    scripts, globals: { structuredClone },
  });
  vm.runInContext('Math.random = () => { throw Error("Unexpected unseeded randomness in simulation test"); }', context);
  const MeridianGame = vm.runInContext('MeridianGame', context);
  const renderer = createRendererStub();
  const events = [];
  const View = vm.runInContext('BattlefieldView', context), view = new View(renderer);
  const game = new MeridianGame({ upgrades: {} }, (type, data) => {
    if (type === 'start') view.sync(game.world);
    events.push({ type, data: json(data) });
  });
  return { game, renderer, events };
}

function tutorial(faction = 0, seed = 1409) {
  const runtime = createGame();
  runtime.game.start(0, { seed, difficulty: 'standard', faction });
  return runtime;
}

function advance(game, steps) {
  for (let i = 0; i < steps; i++) {
    game.step(.05);
    game.effects.tick(.05);
  }
}

const player = (game, type) => game.alive(e => e.team === 0 && e.type === type)[0];
const rifleCount = game => game.alive(e => e.team === 0 && e.type === 'rifle').length;

function checkpointScenario(game) {
  const hero = player(game, 'hero'), barracks = player(game, 'barracks');
  game.command([hero.id], { type: 'move', x: -10, z: 32 });
  game.command([barracks.id], { type: 'move', x: -35, z: 48 });
  assert.equal(game.train('rifle', barracks.id), true);
  assert.equal(game.ability('scan', { x: 20, z: -20 }), true);
  // Camera position is normally assigned by the UI, which is not executed here.
  game.s.cam = { x: -42, z: 40, zoom: 64 };
  advance(game, 100);
}

test('tutorial seed 1409 retains reference resources, entity IDs, positions and layout-dependent relocation', () => {
  const { game, renderer, events } = tutorial();
  const s = game.s;
  assert.deepEqual([s.version, s.index, s.seed, s.difficulty, s.faction, s.time], [1, 0, 1409, 'standard', 0, 0]);
  assert.deepEqual([s.alloy, s.gas, s.energy, s.nextId, s.entities.length, game.supply(), game.cap()], [470, 80, 100, 65, 64, 11, 24]);
  const counts = {};
  for (const e of s.entities) counts[e.team] = (counts[e.team] || 0) + 1;
  assert.deepEqual(counts, { '0': 11, '1': 5, '-1': 48 });
  assert.deepEqual(json(game.alive(e => e.team === 0).map(e => [e.id, e.type, e.x, e.z, e.hp])), [
    [1, 'hq', -51, 49, 2600], [2, 'barracks', -39, 53, 1150],
    [3, 'hero', -45, 42, 850], [4, 'worker', -57, 46, 100],
    [5, 'worker', -55.2, 46, 100], [6, 'worker', -53.75, 43.75, 100],
    [7, 'worker', -56.25, 46.25, 100], [8, 'worker', -56.25, 46.25, 100],
    [9, 'rifle', -51, 38, 150], [10, 'rifle', -49.2, 38, 150], [11, 'rifle', -47.4, 38, 150],
  ]);
  assert.deepEqual(json(game.alive(e => e.type === 'crystal').slice(0, 5).map(e => [e.id, e.amount])), [
    [12, 2606], [13, 2331], [14, 2019], [15, 2308], [16, 2569],
  ]);
  assert.equal(game.world.explored.reduce((sum, cell) => sum + cell, 0), 389);
  assert.equal(renderer.fogOn, true);
  assert.deepEqual(events.map(e => e.type), ['start', 'radio']);
});

test('fresh starts with the same seed reproduce state; another seed changes resource amounts', () => {
  const a = tutorial().game, b = tutorial().game, other = tutorial(0, 1410).game;
  assert.deepEqual(json(a.snapshot()), json(b.snapshot()));
  assert.notDeepEqual(json(a.alive(e => e.type === 'crystal').map(e => e.amount)), json(other.alive(e => e.type === 'crystal').map(e => e.amount)));
});

test('campaign and skirmish starts/checkpoints contain no in-mission research or labs', () => {
  const { game } = createGame();
  assert.equal(game.tech, undefined);
  for (const index of [...Array(16).keys(), -1]) {
    game.start(index, { seed: 1409, ...(index < 0 ? { mission: { type: 'conquest', biome: 'rust', tier: 3, bases: 3 } } : {}) });
    const snapshot = game.snapshot();
    assert.equal('upgrades' in snapshot, false); assert.equal('research' in snapshot, false);
    assert.ok(snapshot.entities.every(e => e.type !== 'lab'));
    assert.ok(snapshot.entities.filter(e => e.type === 'ward').every(e => e.team === 1 && e.tag === 'generator'));
    game.restore(snapshot); advance(game, 2);
    assert.equal('upgrades' in game.s, false); assert.equal('research' in game.s, false);
    assert.ok(game.s.entities.every(e => Number.isFinite(e.hp)));
  }
});

test('removed labs and mission-only ward generators cannot be built or spend resources', () => {
  const { game } = tutorial(), before = json(game.snapshot());
  assert.match(game.canBuild('lab'), /Unknown structure/);
  assert.match(game.canBuild('ward'), /mission objective/);
  for (const type of ['lab', 'ward']) assert.equal(game.build(type, { x: -30, z: 40 }), false);
  assert.deepEqual(json(game.snapshot()), before);
});

test('both siege missions retain destructible ward footprints and the shield/victory sequence', () => {
  const { game, events } = createGame();
  for (const index of [6, 10]) {
    game.start(index, { seed: 1409 });
    assert.equal(game.s.m.type, 'siege');
    const wards = game.alive(e => e.tag === 'generator'), citadel = game.alive(e => e.tag === 'citadel')[0];
    assert.equal(wards.length, game.s.m.count);
    const hero = player(game, 'hero');
    for (const ward of wards) {
      assert.deepEqual([ward.kind, ward.type, ward.team, ward.hp, ward.size, ward.progress], ['building', 'ward', 1, 1050, 2.9, 1]);
      assert.equal(game.world.blockedAt(ward.x, ward.z), true);
      game.damage(citadel, 99999, hero, true); assert.equal(citadel.hp, citadel.maxHp);
      game.damage(ward, 1050, hero, true); assert.equal(ward.hp, 0);
      game.objectiveTick(.25);
      assert.equal(!!citadel.invulnerable, ward !== wards.at(-1));
      assert.equal(game.s.result, null);
    }
    assert.equal(game.objectiveRows().find(r => /ward generators/.test(r.text)).done, true);
    game.damage(citadel, 99999, hero, true); game.objectiveTick(.25);
    assert.equal(game.s.result.win, true);
    assert.ok(events.some(e => e.type === 'alert' && e.data.text === 'Ward generator destroyed.'));
  }
});

test('base combat/movement stats retain faction, difficulty, shields and veteran modifiers without research', () => {
  const { game } = tutorial(); game.s.difficulty = 'veteran';
  for (const team of [0, 1, 2]) for (const faction of [0, 1, 2]) {
    const e = game.spawnUnit('rifle', 0, 0, team, faction);
    const stats = game.rangedStats(e);
    close(stats.damage, 13 * (faction === 2 ? 1.12 : 1) * (team === 1 ? 1.22 : 1));
    assert.equal(stats.range, 9); assert.equal(e.vision, 17);
    e.kills = 5; close(game.rangedStats(e).damage, stats.damage * 1.12);
    const hp = e.hp, shield = e.shield;
    game.damage(e, 20, null, true);
    close(e.hp, hp - Math.max(0, 20 - shield)); close(e.shield, Math.max(0, shield - 20));
    const air = game.spawnUnit('air', 0, 0, team, faction);
    air.path = [{ x: 20, z: 0 }]; air.nextPath = 100;
    game.move(air, { x: 20, z: 0 }, .1);
    close(air.x, .7 * (faction === 1 ? 1.1 : 1)); close(air.z, 0);
  }
});

test('base mining, refinery income, medic healing and faction regeneration work without research state', () => {
  const { game } = tutorial();
  const worker = player(game, 'worker'), node = game.alive(e => e.type === 'crystal')[0];
  worker.x = node.x; worker.z = node.z; worker.order = { type: 'mine', id: node.id };
  for (let i = 0; i < 3; i++) game.worker(worker, 1.25);
  assert.equal(worker.carry, 18);
  game.spawnBuilding('refinery', -63, 60, 0, 0);
  const medic = game.spawnUnit('medic', 75, 75, 0, 0), patient = game.spawnUnit('rifle', 75, 75, 2, 0);
  patient.hp -= 80; game.rehash(); game.medic(medic, 1);
  close(patient.hp, patient.maxHp - 60);
  medic.hp = 0; patient.hp = 0;
  const troops = [0, 1, 2].map(f => game.spawnUnit('rifle', 75, 75, 0, f));
  for (const troop of troops) troop.hp = troop.maxHp - 50;
  const gas = game.s.gas; advance(game, 1);
  close(game.s.gas, gas + .05 * (1.7 + .25));
  for (const troop of troops) close(troop.hp, troop.maxHp - 50 + (troop.faction === 1 ? 2.1 * .05 : 0));
});

test('all six permanent fleet upgrades still apply to campaign operations but not practice/skirmish', () => {
  const { game } = createGame();
  const meta = { veterans: 2, stores: 2, logistics: 1, command: 1, resolve: 1, industry: 1 };
  game.profile.upgrades = meta; game.start(0, { seed: 1409 });
  assert.deepEqual(json(game.s.meta), meta); assert.notStrictEqual(game.s.meta, meta);
  assert.equal(game.s.alloy, 670); assert.equal(rifleCount(game), 5);
  assert.equal(game.alive(e => e.team === 0 && e.type === 'worker').length, 6);
  assert.equal(player(game, 'hero').maxHp, 1000);
  game.s.energy = 0; assert.equal(game.train('rifle'), true); advance(game, 10);
  close(game.s.energy, .5 * .8 * 1.15);
  close(player(game, 'barracks').queue[0].progress, .5 / 11 * 1.1);
  for (const [index, opts] of [[0, { practice: true }], [-1, {}]]) {
    game.start(index, { seed: 1409, ...opts });
    assert.deepEqual(json(game.s.meta), {}); assert.equal(game.s.alloy, 470);
    assert.equal(rifleCount(game), 3); assert.equal(player(game, 'hero').maxHp, 850);
  }
});

test('building repair assigns only the nearest living own worker and repairs through normal travel/work', () => {
  const { game } = tutorial(), b = player(game, 'barracks'); b.hp -= 100;
  const workers = game.alive(e => e.team === 0 && e.type === 'worker');
  const nearest = [...workers].sort((a, c) => Math.hypot(a.x-b.x,a.z-b.z)-Math.hypot(c.x-b.x,c.z-b.z))[0];
  game.spawnUnit('worker', b.x, b.z, 1, 0); game.spawnUnit('worker', b.x, b.z, 2, 0);
  game.spawnUnit('worker', b.x, b.z, 0, 0).hp = 0;
  const before = new Map(workers.map(w => [w.id, json(w.order)])), alloy = game.s.alloy, x = nearest.x, z = nearest.z;
  assert.equal(game.toggleBuildingRepair(b.id), true);
  assert.deepEqual(Array.from(game.buildingRepairers(b.id), w => w.id), [nearest.id]);
  close(game.s.alloy, alloy); assert.equal(b.hp, b.maxHp - 100);
  for (const w of workers) if (w !== nearest) assert.deepEqual(json(w.order), before.get(w.id));
  advance(game, 500);
  assert.ok(Math.hypot(nearest.x-x,nearest.z-z) > 1, 'worker actually travelled');
  assert.equal(b.hp, b.maxHp); assert.equal(game.buildingRepairers(b.id).length, 0);
});

test('repair toggle stops assigned workers; a dead worker is not automatically replaced', () => {
  const { game } = tutorial(), b = player(game, 'barracks'); b.hp -= 100;
  game.toggleBuildingRepair(b.id); const w = game.buildingRepairers(b.id)[0];
  assert.equal(game.toggleBuildingRepair(b.id), true);
  assert.equal(w.order.type, 'idle'); assert.equal(game.buildingRepairers(b.id).length, 0);
  game.toggleBuildingRepair(b.id); w.hp = 0;
  advance(game, 5); assert.equal(game.buildingRepairers(b.id).length, 0);
  assert.equal(game.toggleBuildingRepair(b.id), true);
  assert.notEqual(game.buildingRepairers(b.id)[0].id, w.id);
});

test('repair rejects no workers, no alloy, full hull and ineligible targets without changing state', () => {
  for (const mode of ['workers', 'alloy', 'full', 'enemy', 'ally', 'foundation', 'unit', 'ward', 'dead', 'result', 'missing']) {
    const { game } = tutorial(); let b = player(game, 'barracks'); b.hp -= 100;
    if (mode === 'workers') for (const w of game.alive(e => e.team === 0 && e.type === 'worker')) w.hp = 0;
    if (mode === 'alloy') game.s.alloy = .1;
    if (mode === 'full') b.hp = b.maxHp;
    if (mode === 'enemy') b.team = 1;
    if (mode === 'ally') b.team = 2;
    if (mode === 'foundation') b.progress = .5;
    if (mode === 'unit') b = player(game, 'hero');
    if (mode === 'ward') b = game.spawnBuilding('ward', 0, 0, 0, 0);
    if (mode === 'dead') b.hp = 0;
    if (mode === 'result') game.s.result = { win: true };
    const id = mode === 'missing' ? -1 : b.id, before = json(game.snapshot());
    assert.ok(game.canRepairBuilding(id), mode);
    assert.equal(game.toggleBuildingRepair(id), false, mode);
    assert.deepEqual(json(game.snapshot()), before, mode);
  }
});

test('selling refunds actual paid value and all queued recruitment, removes navigation and stops repairs without combat/RNG effects', () => {
  const { game } = tutorial(), b = player(game, 'barracks');
  game.s.m.tier = 1; b.paid = { cost: 101, gas: 13 }; b.hp -= 100;
  assert.equal(game.train('rifle', b.id), true); assert.equal(game.train('medic', b.id), true);
  b.queue[0].progress = .8; game.toggleBuildingRepair(b.id);
  const worker = game.buildingRepairers(b.id)[0], count = rifleCount(game), supply = game.supply(), stats = json(game.s.stats);
  const alloy = game.s.alloy, gas = game.s.gas, refund = { cost: 225.5, gas: 41.5 };
  assert.deepEqual(json(game.buildingSaleRefund(b.id)), refund);
  assert.equal(game.world.blockedAt(b.x,b.z), true);
  const random = game.random; game.random = () => { throw Error('Selling must not use RNG'); };
  assert.equal(game.sellBuilding(b.id), true); game.random = random;
  close(game.s.alloy, alloy + refund.cost); close(game.s.gas, gas + refund.gas);
  assert.equal(game.get(b.id), null); assert.equal(b.queue.length, 0); assert.equal(worker.order.type, 'idle');
  assert.equal(game.world.blockedAt(b.x,b.z), false); assert.equal(game.supply(), supply - 4);
  assert.deepEqual(json(game.s.stats), stats);
  const saved = game.snapshot(); assert.equal(game.sellBuilding(b.id), false);
  assert.deepEqual(json(game.snapshot()), json(saved));
  game.restore(saved); advance(game, 300);
  assert.equal(rifleCount(game), count); assert.equal(game.get(b.id), null);
});

test('start structures sell for half their normal cost; supply loss keeps existing troops but blocks new recruitment', () => {
  const { game } = tutorial(), depot = game.spawnBuilding('depot', -27, 61, 0, 0);
  for (let i = 0; i < 10; i++) game.spawnUnit('rifle', -45, 35, 0, 0);
  const supply = game.supply(), troops = rifleCount(game), cap = game.cap();
  assert.deepEqual(json(game.buildingSaleRefund(depot.id)), { cost: 42.5, gas: 0 });
  assert.equal(game.sellBuilding(depot.id), true);
  assert.equal(game.cap(), cap - 16); assert.equal(game.supply(), supply); assert.equal(rifleCount(game), troops);
  assert.equal(game.train('rifle'), false);
});

test('last completed HQ and ineligible buildings cannot be sold; an unfinished replacement HQ does not remove protection', () => {
  const { game } = tutorial(), hq = player(game, 'hq');
  const next = game.spawnBuilding('hq', -20, 60, 0, 0, { progress: .5 });
  assert.match(game.canSellBuilding(hq.id), /Last command center/);
  assert.equal(game.sellBuilding(hq.id), false);
  next.progress = 1; assert.equal(game.sellBuilding(hq.id), true);
  assert.match(game.canSellBuilding(next.id), /Last command center/);
  for (const target of [player(game, 'hero'), game.alive(e => e.team === 1 && e.kind === 'building')[0],
    game.spawnBuilding('depot', 0, 0, 2, 0), game.spawnBuilding('ward', 0, 0, 0, 0),
    game.spawnBuilding('depot', 0, 0, 0, 0, { progress: .5 }), { id: -1 }]) {
    const before = json(game.snapshot());
    assert.equal(game.sellBuilding(target.id), false); assert.deepEqual(json(game.snapshot()), before);
  }
});

test('selling a refinery frees its vent for a new foundation', () => {
  const { game } = tutorial(); let p;
  for (let z = 30; z < 80 && !p; z += 2) for (let x = -75; x < -25 && !p; x += 2)
    if (!game.canBuild('refinery', {x,z})) p = {x,z};
  assert.ok(p); assert.equal(game.build('refinery', p), true);
  const b = player(game, 'refinery'); b.progress = 1; b.hp = b.maxHp;
  assert.ok(game.canBuild('refinery', p)); assert.equal(game.sellBuilding(b.id), true);
  assert.equal(game.canBuild('refinery', p), '');
});

test('current checkpoints preserve assigned building repair workers', () => {
  const { game } = tutorial(), b = player(game, 'barracks'); b.hp -= 100;
  game.toggleBuildingRepair(b.id); const id = game.buildingRepairers(b.id)[0].id;
  const saved = game.snapshot(); game.restore(saved);
  assert.deepEqual(Array.from(game.buildingRepairers(b.id), w => w.id), [id]);
  advance(game, 500); assert.equal(game.get(b.id).hp, b.maxHp);
});

test('commands replace the current order, ignore enemies and set building rally points', () => {
  const { game, events } = tutorial();
  const hero = player(game, 'hero'), barracks = player(game, 'barracks');
  const enemy = game.alive(e => e.team === 1 && e.kind === 'unit')[0];
  const enemyBefore = json(enemy);
  const move = Object.freeze({ type: 'move', x: -10, z: 32 });
  game.command([hero.id, enemy.id, 99999], move);
  assert.deepEqual(json(hero.order), move);
  assert.notStrictEqual(hero.order, move);
  assert.deepEqual(json(enemy), enemyBefore);
  assert.equal(events.find(e => e.type === 'order').data.count, 1);
  hero.path = [{ x: -20, z: 30 }]; hero.pi = 1; hero.target = enemy.id;
  hero.nextPath = 20; hero.stuck = 1;
  game.command([hero.id], { type: 'hold' });
  assert.deepEqual(json(hero.order), { type: 'hold' });
  assert.deepEqual(json(hero.path), []);
  assert.deepEqual([hero.pi, hero.target, hero.nextPath, hero.stuck], [0, null, 0, 0]);
  game.finishOrder(hero);
  assert.deepEqual(json(hero.order), { type: 'idle' });
  assert.deepEqual(json(hero.path), []); assert.equal(hero.pi, 0);
  game.command([hero.id], { type: 'move', x: -15, z: 10 });
  game.command([hero.id], { type: 'stop' });
  assert.deepEqual(json(hero.order), { type: 'stop' });
  assert.equal('orders' in hero, false);
  game.command([barracks.id], move);
  assert.deepEqual(json(barracks.rally), { x: -10, z: 32 });
});

test('new construction assigns one worker, pays once and still completes normally', () => {
  const { game, events } = tutorial();
  const worker = player(game, 'worker'), beforeAlloy = game.s.alloy;
  const cost = game.cost('depot', 'building');
  let built = false;
  for (let z = 30; z < 60 && !built; z += 3) for (let x = -65; x < -25 && !built; x += 3) {
    if (!game.canBuild('depot', { x, z })) built = game.build('depot', { x, z }, [worker.id]);
  }
  assert.equal(built, true);
  const foundation = player(game, 'depot');
  const builders = game.alive(e => e.order?.type === 'build' && e.order.id === foundation.id);
  assert.deepEqual(Array.from(builders, e => e.id), [worker.id]);
  close(game.s.alloy, beforeAlloy - cost.cost);
  worker.x = foundation.x; worker.z = foundation.z;
  const beforeProgress = foundation.progress, paidAlloy = game.s.alloy;
  game.worker(worker, .5);
  assert.ok(foundation.progress > beforeProgress);
  close(game.s.alloy, paidAlloy);
  foundation.progress = .999; foundation.hp = foundation.maxHp * .999;
  game.worker(worker, 1);
  assert.equal(foundation.progress, 1); assert.equal(foundation.hp, foundation.maxHp);
  assert.equal(worker.order.type, 'idle'); assert.equal(game.s.stats.built, 1);
  assert.equal(events.filter(e => e.type === 'complete' && e.data.type === 'depot').length, 1);
});

test('context and repair orders cannot add builders to unfinished own or allied structures', () => {
  for (const team of [0, 2]) {
    const { game } = tutorial();
    const worker = player(game, 'worker');
    const foundation = game.spawnBuilding('depot', worker.x, worker.z, team, 0, { progress: .1 });
    foundation.hp = foundation.maxHp * .1;
    const before = [foundation.progress, foundation.hp, game.s.alloy];
    game.command([worker.id], { type: 'smart', id: foundation.id, x: foundation.x, z: foundation.z });
    assert.equal(worker.order.type, 'move');
    game.worker(worker, 1);
    assert.deepEqual([foundation.progress, foundation.hp, game.s.alloy], before);
    game.command([worker.id], { type: 'repair', id: foundation.id });
    game.worker(worker, 1);
    assert.equal(worker.order.type, 'idle');
    assert.deepEqual([foundation.progress, foundation.hp, game.s.alloy], before);
  }
});

test('workers still repair completed damaged structures and units for the same alloy cost', () => {
  for (const team of [0, 2]) for (const kind of ['building', 'unit']) {
    const { game } = tutorial(); const worker = player(game, 'worker');
    const target = kind === 'building'
      ? game.spawnBuilding('depot', worker.x, worker.z, team, 0)
      : game.spawnUnit('rifle', worker.x, worker.z, team, 0);
    target.hp = target.maxHp - 50;
    const alloy = game.s.alloy;
    game.command([worker.id], { type: 'smart', id: target.id, x: target.x, z: target.z });
    assert.equal(worker.order.type, 'repair');
    game.worker(worker, 1);
    close(target.hp, target.maxHp - 12); close(game.s.alloy, alloy - 3.8);
  }
});

for (const [faction, cost] of [[0, 75], [1, 64], [2, 85]]) {
  test(`faction ${faction}: recruitment spends reference cost, reserves supply and refunds cancellation`, () => {
    const { game, events } = tutorial(faction);
    const barracks = player(game, 'barracks');
    assert.equal(game.train('rifle', barracks.id), true);
    assert.deepEqual(json(barracks.queue), [{ type: 'rifle', progress: 0, time: 11, cost, gas: 0 }]);
    assert.deepEqual([game.s.alloy, game.s.gas, game.supply(), rifleCount(game)], [470 - cost, 80, 13, 3]);
    advance(game, 20);
    assert.ok(barracks.queue[0].progress > 0 && barracks.queue[0].progress < 1);
    const beforeCancel = game.s.alloy;
    game.cancelQueue(barracks.id, 0);
    close(game.s.alloy, beforeCancel + cost);
    assert.equal(game.supply(), 11);
    assert.equal(barracks.queue.length, 0);
    assert.ok(events.some(e => e.type === 'queued' && e.data === 'rifle'));
  });
}

for (const [reason, setup] of [
  ['insufficient alloy', game => { game.s.alloy = 74; }],
  ['full production queue', game => { for (let i = 0; i < 5; i++) assert.equal(game.train('rifle'), true); }],
  ['supply limit', game => { for (let i = 0; i < 6; i++) game.spawnUnit('rifle', -45, 35, 0, 0); }],
]) {
  test(`recruitment rejected for ${reason} leaves saved state unchanged`, () => {
    const { game, events } = tutorial();
    setup(game);
    const before = json(game.snapshot());
    assert.equal(game.train('rifle'), false);
    assert.deepEqual(json(game.snapshot()), before);
    assert.equal(events.at(-1).type, 'toast');
  });
}

test('fixed steps finish production once, retain reserved supply and account for HQ income and mining deliveries', () => {
  const { game, events } = tutorial();
  const barracks = player(game, 'barracks');
  game.command([barracks.id], { type: 'move', x: -35, z: 48 });
  assert.equal(game.train('rifle', barracks.id), true);
  advance(game, 200);
  assert.equal(rifleCount(game), 3);
  close(barracks.queue[0].progress, 10 / 11);
  advance(game, 21);
  assert.equal(barracks.queue.length, 0);
  assert.equal(rifleCount(game), 4);
  assert.equal(game.supply(), 13);
  assert.equal(game.s.stats.trained, 1);
  const trained = events.filter(e => e.type === 'trained');
  assert.equal(trained.length, 1);
  assert.deepEqual(trained[0].data.order, { type: 'attackMove', x: -35, z: 48 });
  assert.equal(game.get(trained[0].data.id).type, 'rifle');
  assert.ok(game.s.stats.gathered > 0, 'workers actually delivered alloy');
  close(game.s.alloy, 470 - 75 + 11.05 + game.s.stats.gathered);
  close(game.s.gas, 80 + 11.05 * .25);
});

function currentCheckpoint() {
  const { game } = tutorial();
  checkpointScenario(game);
  return json(game.snapshot());
}

test('snapshot detaches nested entity, queue, camera and explored data from live state', () => {
  const { game } = tutorial();
  assert.equal(game.train('rifle'), true);
  const snapshot = game.snapshot();
  assert.equal('groups' in snapshot, false);
  assert.ok(snapshot.entities.every(e => !('orders' in e)));
  snapshot.entities[1].queue[0].progress = .9;
  snapshot.entities[0].hp = 1;
  snapshot.cam.zoom = 99;
  const explored = game.world.idx(-51, 49);
  snapshot.explored[explored] = 0;
  assert.equal(player(game, 'barracks').queue[0].progress, 0);
  assert.equal(player(game, 'hq').hp, 2600);
  assert.equal(game.s.cam.zoom, 57);
  assert.equal(game.world.explored[explored], 1);
  game.s.entities[0].hp = 2000;
  assert.equal(snapshot.entities[0].hp, 1);
});

test('current checkpoint restores state and rebuilds navigation, indexes and fog', () => {
  const { game, renderer, events } = createGame();
  const fixture = currentCheckpoint(), before = json(fixture);
  game.restore(fixture);
  const { explored, ...savedState } = json(fixture);
  assert.deepEqual(json(game.s), savedState);
  assert.deepEqual(fixture, before);
  assert.notStrictEqual(game.s.entities, fixture.entities);
  assert.notStrictEqual(game.s.entities[1].queue, fixture.entities[1].queue);
  for (const entity of game.s.entities) assert.strictEqual(game.get(entity.id), entity);
  assert.equal('groups' in game.s, false);
  assert.ok(game.s.entities.every(e => !('orders' in e)));
  const hq = player(game, 'hq'), hero = player(game, 'hero');
  const baseCell = game.world.idx(hq.x, hq.z);
  assert.equal(game.world.staticGrid[baseCell], 0);
  assert.equal(game.world.blocked[baseCell], 1, 'building footprint rebuilt on clear terrain');
  assert.ok(game.near(hero.x, hero.z, 3).includes(hero), 'spatial index rebuilt');
  assert.ok(explored.every((cell, i) => !cell || game.world.explored[i] === 1), 'old exploration retained');
  // Restore reveals the current positions as well; exploration may grow.
  assert.deepEqual(Array.from(renderer.fogPixels), Array.from(game.world.fogPixels));
  assert.ok(renderer.fogPixels.includes(255));
  assert.equal(renderer.fogOn, true);
  assert.deepEqual(events.map(e => e.type), ['start']);
  assert.equal(events[0].data.resumed, true);
  assert.equal(game.effects.fx.length, 0);
});

test('restored checkpoint can advance production and time without promising identical RNG continuation', () => {
  const { game } = createGame();
  const fixture = currentCheckpoint();
  game.restore(fixture);
  const progress = player(game, 'barracks').queue[0].progress;
  advance(game, 1);
  close(game.s.time, fixture.time + .05);
  close(game.s.gas, fixture.gas + .05 * .25);
  close(player(game, 'barracks').queue[0].progress, progress + .05 / 11);
  assert.equal(game.s.result, null);
  assert.ok(game.s.entities.every(e => [e.x, e.z, e.hp].every(Number.isFinite)));
});

test('restore rejects unsupported save versions and unknown unit types', () => {
  const { game } = createGame();
  const wrongVersion = currentCheckpoint();
  wrongVersion.version = 999;
  assert.throws(() => game.restore(wrongVersion), /not a valid Meridian operation/);
  const unknownUnit = currentCheckpoint();
  unknownUnit.entities.find(e => e.kind === 'unit').type = 'unknown-unit';
  assert.throws(() => game.restore(unknownUnit), /Unknown entity in save/);
  assert.equal(game.s, null);
});
