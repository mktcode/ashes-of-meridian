// CPU-only characterization tests; provenance of fixed values/fixture:
// docs/reference-tests.md. Never regenerate expectations during a test run.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { readInlineScripts, loadScripts } = require('./helpers/inline-scripts.cjs');
const { createRendererStub } = require('./helpers/renderer-stub.cjs');

const scripts = readInlineScripts();
const fixtureText = readFileSync(join(__dirname, 'fixtures/operation-v1.json'), 'utf8');
// JSON transport is intentional: saves have JSON semantics, and VM objects have
// different prototypes. This is not a replacement for cloning live game state.
const json = value => JSON.parse(JSON.stringify(value));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≈ ${expected}`);

function createGame() {
  const context = loadScripts(['renderer', 'content', 'world', 'simulation'], {
    scripts, globals: { structuredClone },
  });
  vm.runInContext('Math.random = () => { throw Error("Unexpected unseeded randomness in simulation test"); }', context);
  const MeridianGame = vm.runInContext('MeridianGame', context);
  const renderer = createRendererStub();
  const events = [];
  const game = new MeridianGame(renderer, { upgrades: {} }, (type, data) => events.push({ type, data: json(data) }));
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
    game.tickEffects(.05);
  }
}

const player = (game, type) => game.alive(e => e.team === 0 && e.type === type)[0];
const rifleCount = game => game.alive(e => e.team === 0 && e.type === 'rifle').length;

function checkpointScenario(game) {
  const hero = player(game, 'hero'), barracks = player(game, 'barracks');
  game.command([hero.id], { type: 'move', x: -10, z: 32 });
  game.command([hero.id], { type: 'move', x: -15, z: 10 }, true);
  game.command([barracks.id], { type: 'move', x: -35, z: 48 });
  assert.equal(game.train('rifle', barracks.id), true);
  assert.equal(game.ability('scan', { x: 20, z: -20 }), true);
  // These fields are normally assigned by the UI, which is not executed here.
  game.s.groups = { '1': [hero.id] };
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

test('commands replace or append unit orders, ignore enemies and set building rally points', () => {
  const { game, events } = tutorial();
  const hero = player(game, 'hero'), barracks = player(game, 'barracks');
  const enemy = game.alive(e => e.team === 1 && e.kind === 'unit')[0];
  const enemyBefore = json(enemy);
  const move = Object.freeze({ type: 'move', x: -10, z: 32 });
  game.command([hero.id, enemy.id, 99999], move);
  game.command([hero.id], { type: 'hold' }, true);
  assert.deepEqual(json(hero.order), move);
  assert.deepEqual(json(hero.orders), [{ type: 'hold' }]);
  assert.deepEqual(json(enemy), enemyBefore);
  assert.equal(events.find(e => e.type === 'order').data.count, 1);
  game.finishOrder(hero);
  assert.deepEqual(json(hero.order), { type: 'hold' });
  game.command([hero.id], { type: 'move', x: -15, z: 10 }, true);
  game.command([hero.id], { type: 'stop' });
  assert.deepEqual(json(hero.order), { type: 'stop' });
  assert.deepEqual(json(hero.orders), []);
  assert.deepEqual(json(hero.path), []);
  game.command([barracks.id], move);
  assert.deepEqual(json(barracks.rally), { x: -10, z: 32 });
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

test('five-second command/production/scan scenario matches the fixed ab92a12 snapshot', () => {
  const { game } = tutorial();
  checkpointScenario(game);
  assert.deepEqual(json(game.snapshot()), JSON.parse(fixtureText));
});

test('snapshot detaches nested entity, queue, camera and explored data from live state', () => {
  const { game } = tutorial();
  assert.equal(game.train('rifle'), true);
  const snapshot = game.snapshot();
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

test('version-1 fixture restores persistent state and rebuilds navigation, indexes and fog without mutating input', () => {
  const { game, renderer, events } = createGame();
  const fixture = JSON.parse(fixtureText), before = json(fixture);
  game.restore(fixture);
  const { explored, ...savedState } = fixture;
  assert.deepEqual(json(game.s), savedState);
  assert.deepEqual(fixture, before);
  assert.notStrictEqual(game.s.entities, fixture.entities);
  assert.notStrictEqual(game.s.entities[1].queue, fixture.entities[1].queue);
  for (const entity of game.s.entities) assert.strictEqual(game.get(entity.id), entity);
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
  assert.equal(game.fx.length, 0);
});

test('restored fixture can advance production and time without promising identical RNG continuation', () => {
  const { game } = createGame();
  const fixture = JSON.parse(fixtureText);
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
  const wrongVersion = JSON.parse(fixtureText);
  wrongVersion.version = 999;
  assert.throws(() => game.restore(wrongVersion), /not a valid Meridian operation/);
  const unknownUnit = JSON.parse(fixtureText);
  unknownUnit.entities.find(e => e.kind === 'unit').type = 'unknown-unit';
  assert.throws(() => game.restore(unknownUnit), /Unknown entity in save/);
  assert.equal(game.s, null);
});
