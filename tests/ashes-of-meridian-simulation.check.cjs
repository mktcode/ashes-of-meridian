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

function battle(faction = 0, seed = 1409) {
  const runtime = createGame();
  runtime.game.start({ seed, biome: 'rust', faction });
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

test('single battle starts with full test arsenal, one hostile base and no mission state', () => {
  const { game, renderer, events } = battle(), s = game.s;
  assert.deepEqual([s.version,s.seed,s.biome,s.faction,s.enemy,s.time], [3,1409,'rust',0,2,0]);
  assert.deepEqual([s.alloy,s.gas,s.energy,s.entities.length,s.nextId,game.supply(),game.cap()], [1100,400,100,84,85,33,56]);
  assert.equal(game.alive(e => e.team === 1 && e.type === 'hq').length, 1);
  assert.equal(game.alive(e => e.team === 0 && e.kind === 'building').length, 6);
  assert.ok(s.entities.every(e => ['unit','building','resource'].includes(e.kind)));
  for (const key of ['m','index','practice','upgrades','research','difficulty']) assert.equal(key in s, false);
  assert.equal(game.objectiveRows().length, 1); assert.match(game.objectiveRows()[0].text, /enemy base/);
  assert.equal(renderer.fogOn, true); assert.deepEqual(events.map(e => e.type), ['start','radio']);
});

test('fresh starts with the same seed reproduce state; another seed changes resource amounts', () => {
  const a = battle().game, b = battle().game, other = battle(0, 1410).game;
  assert.deepEqual(json(a.snapshot()), json(b.snapshot()));
  assert.notDeepEqual(json(a.alive(e => e.type === 'crystal').map(e => e.amount)), json(other.alive(e => e.type === 'crystal').map(e => e.amount)));
});

test('all factions and biomes start and restore without mission definitions or research', () => {
  const { game } = createGame();
  for (const faction of [0,1,2]) for (const biome of ['ash','rust','choir','court','star']) {
    game.start({ seed: 1409, faction, enemy: faction, biome });
    const saved = game.snapshot(); game.restore(saved); advance(game, 2);
    assert.equal(game.s.biome, biome); assert.equal(game.s.enemy, faction);
    assert.ok(game.alive(e => e.team === 1).every(e => e.faction === faction));
    assert.ok(game.s.entities.every(e => Number.isFinite(e.hp) && !['ward','avatar','convoy','lab'].includes(e.type)));
    assert.equal('m' in game.s, false); assert.equal('research' in game.s, false);
  }
});

test('removed labs and mission-only ward generators cannot be built or spend resources', () => {
  const { game } = battle(), before = json(game.snapshot());
  assert.match(game.canBuild('lab'), /Unknown structure/);
  assert.match(game.canBuild('ward'), /Unknown structure/);
  for (const type of ['lab', 'ward']) assert.equal(game.build(type, { x: -30, z: 40 }), false);
  assert.deepEqual(json(game.snapshot()), before);
});

test('only enemy HQ destruction wins; loss of the last own HQ loses, without stars or rewards', () => {
  for (const win of [true,false]) {
    const { game, events } = battle();
    game.s.time = 3600; game.objectiveTick(.2); assert.equal(game.s.result, null);
    const hq = game.alive(e => e.type === 'hq' && e.team === (win ? 1 : 0))[0];
    game.damage(hq, 999999, null, true); game.objectiveTick(.2);
    assert.equal(game.s.result.win, win); assert.equal('stars' in game.s.result, false);
    assert.deepEqual(json(game.profile), {upgrades:{}});
    const saved = json(game.snapshot()); advance(game, 10); assert.deepEqual(json(game.snapshot()), saved);
    assert.equal(events.filter(e => e.type === 'result').length, 1);
  }
});

test('fixed wave sizing and timing retain the former standard rules', () => {
  for (const [wave, count, interval] of [[1,8,79.2],[10,14,72],[40,24,54.4]]) {
    const { game, events } = battle();
    assert.equal(game.s.nextWave, 95);
    game.s.wave = wave-1; game.s.time = 95; game.s.enemyBudget = 100000;
    game.wave();
    assert.equal(events.at(-1).data.n, count);
    close(game.s.nextWave,95+interval);
  }
});

test('waves originate at the enemy base and stop without it', () => {
  const { game, events } = battle(); const before = game.alive(e => e.team === 1 && e.kind === 'unit').length;
  game.wave(); assert.ok(game.alive(e => e.team === 1 && e.kind === 'unit').length > before);
  assert.ok(events.some(e => e.type === 'wave'));
  const hq = game.alive(e => e.team === 1 && e.type === 'hq')[0]; hq.hp = 0;
  const count = game.s.entities.length; game.wave(); assert.equal(game.s.entities.length, count);
});

test('base combat/movement stats retain faction, shields and unit-veterancy modifiers without difficulty scaling', () => {
  const { game } = battle();
  for (const team of [0, 1, 2]) for (const faction of [0, 1, 2]) {
    const e = game.spawnUnit('rifle', 0, 0, team, faction);
    const stats = game.rangedStats(e);
    close(stats.damage, 13 * (faction === 2 ? 1.12 : 1));
    assert.equal(stats.range, 9); assert.equal(e.vision, 17);
    close(e.maxHp, game.spawnUnit('rifle', 10, 10, 0, faction).maxHp);
    close(game.spawnBuilding('hq', 20, 20, team, faction).maxHp, 2600);
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

test('retained weapons apply direct damage and schedule artillery shells without a boss weapon', () => {
  const { game } = battle(), target = game.alive(e => e.team === 1 && e.type === 'hq')[0];
  const hp = target.hp; game.world.visible.fill(255);
  for (const [type,faction] of [['rifle',0],['tank',1],['rifle',2],['artillery',0]]) {
    const unit = game.spawnUnit(type,target.x-10,target.z,0,faction); game.fire(unit,target);
  }
  close(target.hp, hp - 13 - 58 - 13*1.12);
  assert.equal(game.s.strikes.length, 1);
  const shell = game.s.strikes[0];
  assert.deepEqual([shell.at,shell.damage,shell.radius,shell.type], [.85,100,4.5,'shell']);
  assert.ok(game.effects.fx.length > 0);
});

test('base mining, refinery income, medic healing and faction regeneration work without research state', () => {
  const { game } = battle();
  const worker = player(game, 'worker'), node = game.alive(e => e.type === 'crystal')[0];
  worker.x = node.x; worker.z = node.z; worker.order = { type: 'mine', id: node.id };
  for (let i = 0; i < 3; i++) game.worker(worker, 1.25);
  assert.equal(worker.carry, 18);
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

test('all six permanent fleet upgrades apply to every new battle', () => {
  const { game } = createGame();
  const meta = { veterans: 2, stores: 2, logistics: 1, command: 1, resolve: 1, industry: 1 };
  game.profile.upgrades = meta; game.start({ seed: 1409 });
  assert.deepEqual(json(game.s.meta), meta); assert.notStrictEqual(game.s.meta, meta);
  assert.equal(game.s.alloy, 1300); assert.equal(rifleCount(game), 9);
  assert.equal(game.alive(e => e.team === 0 && e.type === 'worker').length, 6);
  assert.equal(player(game, 'hero').maxHp, 1000);
  game.s.energy = 0; assert.equal(game.train('rifle'), true); advance(game, 10);
  close(game.s.energy, .5 * .8 * 1.15);
  close(player(game, 'barracks').queue[0].progress, .5 / 11 * 1.1);
  game.start({ seed: 1409 });
  assert.deepEqual(json(game.s.meta), meta); assert.equal(game.s.alloy, 1300);
});

test('building repair assigns only the nearest living own worker and repairs through normal travel/work', () => {
  const { game } = battle(), b = player(game, 'barracks'); b.hp -= 100;
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
  const { game } = battle(), b = player(game, 'barracks'); b.hp -= 100;
  game.toggleBuildingRepair(b.id); const w = game.buildingRepairers(b.id)[0];
  assert.equal(game.toggleBuildingRepair(b.id), true);
  assert.equal(w.order.type, 'idle'); assert.equal(game.buildingRepairers(b.id).length, 0);
  game.toggleBuildingRepair(b.id); w.hp = 0;
  advance(game, 5); assert.equal(game.buildingRepairers(b.id).length, 0);
  assert.equal(game.toggleBuildingRepair(b.id), true);
  assert.notEqual(game.buildingRepairers(b.id)[0].id, w.id);
});

test('repair rejects no workers, no alloy, full hull and ineligible targets without changing state', () => {
  for (const mode of ['workers', 'alloy', 'full', 'enemy', 'foundation', 'unit', 'dead', 'result', 'missing']) {
    const { game } = battle(); let b = player(game, 'barracks'); b.hp -= 100;
    if (mode === 'workers') for (const w of game.alive(e => e.team === 0 && e.type === 'worker')) w.hp = 0;
    if (mode === 'alloy') game.s.alloy = .1;
    if (mode === 'full') b.hp = b.maxHp;
    if (mode === 'enemy') b.team = 1;
    if (mode === 'foundation') b.progress = .5;
    if (mode === 'unit') b = player(game, 'hero');
    if (mode === 'dead') b.hp = 0;
    if (mode === 'result') game.s.result = { win: true };
    const id = mode === 'missing' ? -1 : b.id, before = json(game.snapshot());
    assert.ok(game.canRepairBuilding(id), mode);
    assert.equal(game.toggleBuildingRepair(id), false, mode);
    assert.deepEqual(json(game.snapshot()), before, mode);
  }
});

test('selling refunds actual paid value and all queued recruitment, removes navigation and stops repairs without combat/RNG effects', () => {
  const { game } = battle(), b = player(game, 'barracks');
  b.paid = { cost: 101, gas: 13 }; b.hp -= 100;
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
  const { game } = battle(), depot = game.spawnBuilding('depot', -27, 61, 0, 0);
  for (let i = 0; i < 12; i++) game.spawnUnit('rifle', -45, 35, 0, 0);
  const supply = game.supply(), troops = rifleCount(game), cap = game.cap();
  assert.deepEqual(json(game.buildingSaleRefund(depot.id)), { cost: 42.5, gas: 0 });
  assert.equal(game.sellBuilding(depot.id), true);
  assert.equal(game.cap(), cap - 16); assert.equal(game.supply(), supply); assert.equal(rifleCount(game), troops);
  assert.equal(game.train('rifle'), false);
});

test('last completed HQ and ineligible buildings cannot be sold; an unfinished replacement HQ does not remove protection', () => {
  const { game } = battle(), hq = player(game, 'hq');
  const next = game.spawnBuilding('hq', -20, 60, 0, 0, { progress: .5 });
  assert.match(game.canSellBuilding(hq.id), /Last command center/);
  assert.equal(game.sellBuilding(hq.id), false);
  next.progress = 1; assert.equal(game.sellBuilding(hq.id), true);
  assert.match(game.canSellBuilding(next.id), /Last command center/);
  for (const target of [player(game, 'hero'), game.alive(e => e.team === 1 && e.kind === 'building')[0],
    game.spawnBuilding('depot', 0, 0, 0, 0, { progress: .5 }), { id: -1 }]) {
    const before = json(game.snapshot());
    assert.equal(game.sellBuilding(target.id), false); assert.deepEqual(json(game.snapshot()), before);
  }
});

test('selling a refinery frees its vent for a new foundation', () => {
  const { game } = battle(), b = player(game, 'refinery'), p = {x:b.x,z:b.z};
  assert.ok(game.canBuild('refinery', p)); assert.equal(game.sellBuilding(b.id), true);
  assert.equal(game.canBuild('refinery', p), '');
});

test('current checkpoints preserve assigned building repair workers', () => {
  const { game } = battle(), b = player(game, 'barracks'); b.hp -= 100;
  game.toggleBuildingRepair(b.id); const id = game.buildingRepairers(b.id)[0].id;
  const saved = game.snapshot(); game.restore(saved);
  assert.deepEqual(Array.from(game.buildingRepairers(b.id), w => w.id), [id]);
  advance(game, 500); assert.equal(game.get(b.id).hp, b.maxHp);
});

test('commands replace the current order, ignore enemies and set building rally points', () => {
  const { game, events } = battle();
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
  const { game, events } = battle();
  const worker = player(game, 'worker'), beforeAlloy = game.s.alloy;
  const cost = game.cost('depot', 'building');
  let built = false;
  for (let z = 30; z < 60 && !built; z += 3) for (let x = -65; x < -25 && !built; x += 3) {
    if (!game.canBuild('depot', { x, z })) built = game.build('depot', { x, z }, [worker.id]);
  }
  assert.equal(built, true);
  const foundation = game.alive(e => e.type === 'depot' && e.progress < 1)[0];
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

test('context and repair orders cannot add builders to unfinished structures', () => {
  const { game } = battle();
  const worker = player(game, 'worker');
  const foundation = game.spawnBuilding('depot', worker.x, worker.z, 0, 0, { progress: .1 });
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
});

test('workers still repair completed damaged structures and units for the same alloy cost', () => {
  for (const kind of ['building', 'unit']) {
    const { game } = battle(); const worker = player(game, 'worker');
    const target = kind === 'building'
      ? game.spawnBuilding('depot', worker.x, worker.z, 0, 0)
      : game.spawnUnit('rifle', worker.x, worker.z, 0, 0);
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
    const { game, events } = battle(faction);
    const barracks = player(game, 'barracks');
    assert.equal(game.train('rifle', barracks.id), true);
    assert.deepEqual(json(barracks.queue), [{ type: 'rifle', progress: 0, time: 11, cost, gas: 0 }]);
    assert.deepEqual([game.s.alloy, game.s.gas, game.supply(), rifleCount(game)], [1100 - cost, 400, 35, 7]);
    advance(game, 20);
    assert.ok(barracks.queue[0].progress > 0 && barracks.queue[0].progress < 1);
    const beforeCancel = game.s.alloy;
    game.cancelQueue(barracks.id, 0);
    close(game.s.alloy, beforeCancel + cost);
    assert.equal(game.supply(), 33);
    assert.equal(barracks.queue.length, 0);
    assert.ok(events.some(e => e.type === 'queued' && e.data === 'rifle'));
  });
}

for (const [reason, setup] of [
  ['insufficient alloy', game => { game.s.alloy = 74; }],
  ['full production queue', game => { for (let i = 0; i < 5; i++) assert.equal(game.train('rifle'), true); }],
  ['supply limit', game => { for (let i = 0; i < 12; i++) game.spawnUnit('rifle', -45, 35, 0, 0); }],
]) {
  test(`recruitment rejected for ${reason} leaves saved state unchanged`, () => {
    const { game, events } = battle();
    setup(game);
    const before = json(game.snapshot());
    assert.equal(game.train('rifle'), false);
    assert.deepEqual(json(game.snapshot()), before);
    assert.equal(events.at(-1).type, 'toast');
  });
}

test('fixed steps finish production once, retain reserved supply and account for HQ income and mining deliveries', () => {
  const { game, events } = battle();
  const barracks = player(game, 'barracks');
  game.command([barracks.id], { type: 'move', x: -35, z: 48 });
  assert.equal(game.train('rifle', barracks.id), true);
  advance(game, 200);
  assert.equal(rifleCount(game), 7);
  close(barracks.queue[0].progress, 10 / 11);
  advance(game, 21);
  assert.equal(barracks.queue.length, 0);
  assert.equal(rifleCount(game), 8);
  assert.equal(game.supply(), 35);
  assert.equal(game.s.stats.trained, 1);
  const trained = events.filter(e => e.type === 'trained');
  assert.equal(trained.length, 1);
  assert.deepEqual(trained[0].data.order, { type: 'attackMove', x: -35, z: 48 });
  assert.equal(game.get(trained[0].data.id).type, 'rifle');
  assert.ok(game.s.stats.gathered > 0, 'workers actually delivered alloy');
  close(game.s.alloy, 1100 - 75 + 11.05 + game.s.stats.gathered);
  close(game.s.gas, 400 + 11.05 * 1.95);
});

function currentCheckpoint() {
  const { game } = battle();
  checkpointScenario(game);
  return json(game.snapshot());
}

test('snapshot detaches nested entity, queue, camera and explored data from live state', () => {
  const { game } = battle();
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
  close(game.s.gas, fixture.gas + .05 * 1.95);
  close(player(game, 'barracks').queue[0].progress, progress + .05 / 11);
  assert.equal(game.s.result, null);
  assert.ok(game.s.entities.every(e => [e.x, e.z, e.hp].every(Number.isFinite)));
});

test('restore rejects unsupported save versions and unknown unit types', () => {
  const { game } = createGame();
  const wrongVersion = currentCheckpoint();
  wrongVersion.version = 999;
  assert.throws(() => game.restore(wrongVersion), /not a valid Meridian operation/);
  for (const version of [1,2]) {
    const oldSave = currentCheckpoint(); oldSave.version = version;
    assert.throws(() => game.restore(oldSave), /not a valid Meridian operation/);
  }
  for (const type of ['convoy','avatar','ward']) {
    const removed = currentCheckpoint();
    const entity = removed.entities.find(e => e.kind === (type === 'ward' ? 'building' : 'unit'));
    entity.type = type;
    assert.throws(() => game.restore(removed), /Unknown entity/);
  }
  const allied = currentCheckpoint(); allied.entities[0].team = 2;
  assert.throws(() => game.restore(allied), /entity in this save is invalid/);
  const unknownUnit = currentCheckpoint();
  unknownUnit.entities.find(e => e.kind === 'unit').type = 'unknown-unit';
  assert.throws(() => game.restore(unknownUnit), /Unknown entity in save/);
  assert.equal(game.s, null);
});
