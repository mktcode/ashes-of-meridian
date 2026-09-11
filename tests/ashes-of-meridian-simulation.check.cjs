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
