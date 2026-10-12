// Small, isolated navigation regressions; no autonomous battle or long-run suite.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readScripts, loadScripts, BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS } = require('./helpers/game-scripts.cjs');
const scripts = readScripts();

function arena() {
  const context = loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'effects', ...SIMULATION_SCRIPTS], { scripts });
  const Game = vm.runInContext('MeridianGame', context), game = new Game({ upgrades: {} });
  game.start({ seed: 1409, map: 'alien-planet' });
  game.s.entities = []; game.ids.clear();
  // This synthetic work-radius arena is deliberately level, not a random Alien hillside.
  const Surface=vm.runInContext('BattlefieldSurface',context);
  game.world.surface=new Surface(game.world.extent,game.world.cellSize,()=>0);
  game.world.terrainFeatureGrid.fill(0);
  game.world.staticGrid.fill(0); game.world.rebuild([]); game.world.sight[0].explored.fill(1);
  return game;
}

function wall(game, axis) {
  const world = game.world, cell = Math.floor(world.gridSize / 2);
  for (let i = 0; i < world.gridSize; i++) {
    world.staticGrid[axis === 'x' ? i * world.gridSize + cell : (cell - 1) * world.gridSize + i] = 1;
  }
  world.rebuild(game.s.entities);
}

function tickWorkers(game, workers) {
  game.s.time += .05;
  for (const w of workers) {
    if (w.yieldTo) game.moveYield(w, .05);
    else game.worker(w, .05);
  }
  for (const w of workers) assert.ok(game.unitFits(w, w.x, w.z), `invalid body position for ${w.id}`);
}

for (const [angle, dz] of [[0, -2], [.4, 2]]) {
  test(`both workers deliver beside a neighbouring depot: ${angle}/${dz}`, () => {
    const game = arena(), offset = 1.2;
    game.spawnBuilding('hq', offset, offset, 0, 0);
    game.spawnBuilding('depot', offset + Math.cos(angle) * 7.6, offset + Math.sin(angle) * 7.6, 0, 0);
    const node = game.spawnResource('crystal', offset + 19, offset + dz, 1000);
    game.world.rebuild(game.s.entities);
    const workers = [game.spawnUnit('worker', offset + 10, offset + dz - 1, 0, 0),
      game.spawnUnit('worker', offset + 12, offset + dz + 1, 0, 0)];
    for (const w of workers) { w.order = { type: 'mine', id: node.id }; w.carry = 18; w.returning = true; }
    const trips = [0, 0];
    for (let i = 0; i < 900 && trips.some(n => n < 3); i++) {
      const before = workers.map(w => w.carry);
      tickWorkers(game, workers);
      workers.forEach((w, j) => { if (before[j] > 0 && w.carry === 0) trips[j]++; });
    }
    assert.ok(trips.every(n => n >= 3), JSON.stringify({ trips, workers }));
  });
}

test('service tolerance does not extend the existing outer HQ delivery range', () => {
  const game = arena(), hq = game.spawnBuilding('hq', 0, 0, 0, 0), outerRange = hq.size + 3.1 + 1.5;
  const w = game.spawnUnit('worker', outerRange + .5, 0, 0, 0), node = game.spawnResource('crystal', 20, 0, 1000);
  game.world.rebuild(game.s.entities);
  w.order = { type: 'mine', id: node.id }; w.carry = 18; w.returning = true;
  const alloy = game.account(0).alloy;
  assert.ok(Math.hypot(w.x-hq.x,w.z-hq.z)>outerRange);
  for(let i=0;i<200&&w.carry;i++) {
    const outside=Math.hypot(w.x-hq.x,w.z-hq.z)>outerRange;
    tickWorkers(game, [w]);
    if(outside) {
      assert.equal(w.carry,18); assert.equal(game.account(0).alloy,alloy);
    }
  }
  assert.equal(w.carry, 0); assert.equal(game.account(0).alloy, alloy + 18);
});

test('area search reaches an accessible work side instead of an isolated preferred point', () => {
  const game = arena();
  game.spawnBuilding('hq', 0, 0, 0, 0); wall(game, 'z');
  const preferred = { x: 0, z: 6.9 }, area = { x: 0, z: 0, radius: 7.4 };
  assert.notEqual(game.world.path(0, -12, preferred.x, preferred.z).status, 'complete');
  const route = game.world.path(0, -12, preferred.x, preferred.z, false, area);
  assert.equal(route.status, 'complete');
  assert.ok(route.goal.z < -2.5 && Math.hypot(route.goal.x, route.goal.z) <= area.radius);
  let from = { x: 0, z: -12 };
  for (const p of route.points) { assert.ok(game.world.lineFree(from, p)); from = p; }
});

test('empty routes enter bounded recovery and a changed layout bypasses the retry cooldown', () => {
  const game = arena(), w = game.spawnUnit('worker', -20, 0, 0, 0), goal = { x: 20, z: 0 };
  wall(game, 'x'); game.setOrder(w, { type: 'move', ...goal });
  let searches = 0;
  const path = game.world.path;
  game.world.path = function (...args) { searches++; return path.apply(this, args); };
  const grid = game.world.blocked, before = Array.from(grid);
  game.random = () => { throw Error('Navigation must not consume RNG'); };
  for (let i = 0; i < 100; i++) {
    game.s.time += .05;
    assert.equal(game.move(w, goal, .05), false);
  }
  assert.equal(w.pathStatus, 'unreachable'); assert.ok(w.recoveryAttempts >= 2);
  assert.ok(searches <= 10, `unbounded retries: ${searches}`);
  assert.strictEqual(game.world.blocked, grid); assert.deepEqual(Array.from(grid), before);
  game.world.staticGrid.fill(0); game.world.rebuild(game.s.entities);
  game.s.time += .05; game.move(w, goal, .05);
  assert.equal(w.pathStatus, 'complete'); assert.ok(w.x > -20);
  let arrived = false;
  for (let i = 0; i < 220 && !arrived; i++) { game.s.time += .05; arrived = game.move(w, goal, .05); }
  assert.ok(arrived && Math.hypot(w.x - goal.x, w.z - goal.z) < 1);
  game.setOrder(w, { type: 'hold' });
  assert.equal(w.recoveryAttempts, undefined); assert.equal(w.pathStatus, undefined);
});

test('a partial route to a blocked building is not reported as arrival', () => {
  const game = arena(), w = game.spawnUnit('worker', -10, 0, 0, 0), b = game.spawnBuilding('depot', 6, 0, 0, 0);
  wall(game, 'x'); game.setOrder(w, { type: 'move', x: b.x, z: b.z });
  assert.equal(game.world.path(w.x, w.z, b.x, b.z).status, 'partial');
  for (let i = 0; i < 160; i++) {
    game.s.time += .05;
    assert.equal(game.move(w, b, .05), false);
  }
  assert.equal(w.pathStatus, 'unreachable'); assert.ok(w.recoveryAttempts > 0);
  assert.ok(w.x < 0); assert.ok(game.unitFits(w, w.x, w.z));
});

for (const task of ['build', 'repair']) {
  test(`${task} uses a reachable work area without changing work rates`, () => {
    const game = arena(), b = game.spawnBuilding('depot', 0, 1, 0, 0), w = game.spawnUnit('worker', 0, -10, 0, 0);
    if (task === 'build') { b.progress = .06; b.hp = b.maxHp * .06; }
    else b.hp -= 38;
    wall(game, 'z'); game.setOrder(w, { type: task, id: b.id, x: b.x, z: b.z });
    const alloy = game.account(0).alloy;
    for (let i = 0; i < 500 && w.order.type === task; i++) tickWorkers(game, [w]);
    assert.equal(w.order.type, 'idle'); assert.equal(b.progress, 1); assert.ok(Math.abs(b.hp - b.maxHp) < 1e-8);
    assert.ok(w.z < -2.5 && Math.hypot(w.x - b.x, w.z - b.z) <= b.size + 3);
    assert.ok(Math.abs(game.account(0).alloy - alloy + (task === 'repair' ? 3.8 : 0)) < 1e-8);
  });
}

test('building selects the first worker that can reach the work radius around the planned foundation', () => {
  const game = arena(), blockedWorker = game.spawnUnit('worker', -8, 0, 0, 0),
    reachableWorker = game.spawnUnit('worker', 36, 0, 0, 0), position = { x: 12, z: 0 };
  wall(game, 'x');
  assert.ok(Math.hypot(blockedWorker.x - position.x, blockedWorker.z - position.z) <
    Math.hypot(reachableWorker.x - position.x, reachableWorker.z - position.z));
  const alloy = game.account(0).alloy;
  assert.equal(game.build('depot', position), true);
  const foundation = game.alive(e => e.kind === 'building' && e.type === 'depot')[0];
  assert.ok(foundation); assert.equal(reachableWorker.order.type, 'build'); assert.equal(reachableWorker.order.id, foundation.id);
  assert.equal(blockedWorker.order.type, 'idle'); assert.ok(game.account(0).alloy < alloy);
});

test('building rejects an unreachable work radius before payment or foundation creation', () => {
  const game = arena(), worker = game.spawnUnit('worker', -8, 0, 0, 0), position = { x: 12, z: 0 };
  wall(game, 'x'); game.random = () => { throw Error('Build reachability must not consume RNG'); };
  const alloy = game.account(0).alloy, nextId = game.s.nextId, blocked = game.world.blocked;
  assert.equal(game.build('depot', position, [worker.id]), false);
  assert.equal(game.account(0).alloy, alloy); assert.equal(game.s.nextId, nextId);
  assert.equal(game.alive(e => e.kind === 'building').length, 0);
  assert.strictEqual(game.world.blocked, blocked); assert.equal(worker.order.type, 'idle');
});

test('a stalled miner can change passing side without pushing a holding blocker', () => {
  const game = arena(); wall(game, 'x');
  const w = game.spawnUnit('worker', 2.55, 0, 0, 0), blocker = game.spawnUnit('worker', 2.55, 1.83, 0, 0),
    goal = { x: 2.55, z: 10 };
  game.setOrder(w, { type: 'mine', id: 999 }); game.setOrder(blocker, { type: 'hold' });
  game.random = () => { throw Error('Recovery must not consume RNG'); };
  for (let i = 0; i < 10; i++) { game.s.time += .05; game.move(w, goal, .05); }
  assert.deepEqual([w.x, w.z], [2.55, 0], 'ordinary mining keeps its initial side');
  let arrived = false, sidestep = 0;
  for (let i = 0; i < 160 && !arrived; i++) {
    game.s.time += .05; arrived = game.move(w, goal, .05);
    sidestep = Math.max(sidestep, w.x - 2.55);
    assert.ok(game.unitFits(w, w.x, w.z));
  }
  assert.ok(arrived && sidestep > 1);
  assert.deepEqual([blocker.x, blocker.z, blocker.order.type], [2.55, 1.83, 'hold']);
});

test('production exit still ignores only its own building and keeps its reservation', () => {
  const game = arena(), h = game.spawnBuilding('hq', 0, 0, 0, 0);
  game.spawnBuilding('hq', 60, 60, 1, 1); game.world.rebuild(game.s.entities);
  const w = game.produceUnit(h, 'worker'); assert.ok(w?.exit);
  assert.equal(game.produceUnit(h, 'worker'), null);
  const end = { x: w.exit.x, z: w.exit.z };
  game.aiTick = () => {};
  for (let i = 0; i < 160 && w.exit; i++) game.step(.05);
  assert.equal(w.exit, undefined); assert.ok(game.unitFits(w, w.x, w.z));
  assert.ok(Math.hypot(w.x - end.x, w.z - end.z) < .001);
});

// Group destinations use a tiny authored arena, not procedural starts or AI matches.
function groupArena() {
  const context = loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'effects', ...SIMULATION_SCRIPTS], { scripts });
  const { Game, World, Surface, slots, party, scale } = vm.runInContext(
    '({Game:MeridianGame,World:Battlefield,Surface:BattlefieldSurface,slots:formationSlots,party:createParty,scale:UNIT_BODY_SCALE})', context);
  const game = new Game({ upgrades: {} }), gridSize = 32, extent = 40, cellSize = 2.5;
  game.world = Object.assign(Object.create(World.prototype), {
    gridSize, extent, cellSize, staticGrid: new Uint8Array(gridSize * gridSize),
    blocked: new Uint8Array(gridSize * gridSize), pathVersion: 0, viewTeam: 0,
    surface: new Surface(extent, cellSize, () => 0)
  });
  game.s = { entities: [], nextId: 1, time: 0, seed: 1409, fields: [], rules: { kind: 'single-player', completed: false },
    parties: [party(0, 0, {}, {}), party(1, 1, {}, {})] };
  return { game, slots, scale };
}
function groupUnits(game, types = ['rifle', 'rifle', 'rifle', 'rifle']) {
  return types.map((type, i) => game.spawn('unit', type, -20 + i % 2 * 5, -10 + Math.floor(i / 2) * 5, 0, 0));
}
function orderGroup(game, units, p, type = 'move') {
  assert.equal(game.command(units.map(e => e.id), { type, ...p }, 0, false), true);
}
function assertGroupGoalsFit(game, units, scale) {
  const departing = new Set(units);
  for (const e of units) {
    assert.ok(game.unitFits({ type: e.type, size: e.size }, e.order.x, e.order.z, departing), `invalid goal for ${e.id}`);
    for (const other of units) if (other !== e && !!(['air', 'destroyer'].includes(other.type)) === !!(['air', 'destroyer'].includes(e.type)))
      assert.ok(Math.hypot(e.order.x-other.order.x, e.order.z-other.order.z) >= (e.size+other.size)*scale-1e-9,
        `overlapping goals ${e.id}/${other.id}`);
  }
}

function finishGroupMoves(game, units) {
  const targets = units.map(e => ({ x: e.order.x, z: e.order.z })), arrivalLimits = units.map(() => 1);
  for (let i = 0; i < 600 && units.some(e => e.order.type !== 'idle'); i++) {
    game.s.time += .05;
    units.forEach((e, j) => {
      if (e.order.type !== 'move' || !game.move(e, e.order, .05, 1)) return;
      // Ordinary moves already allow stopping beside a temporarily occupied goal.
      // Preserve that contract, but require actual occupancy for the extra tolerance.
      if (Math.hypot(e.x-targets[j].x, e.z-targets[j].z) >= 1) {
        assert.equal(game.unitFits(e, targets[j].x, targets[j].z), false);
        arrivalLimits[j] += e.size * 1.4 * 2;
      }
      game.finishOrder(e);
    });
    for (const e of units) assert.ok(game.unitFits(e, e.x, e.z), `invalid moving body ${e.id}`);
  }
  assert.ok(units.every(e => e.order.type === 'idle'), JSON.stringify(units));
  units.forEach((e, i) => assert.ok(Math.hypot(e.x-targets[i].x, e.z-targets[i].z) < arrivalLimits[i]));
  assert.ok(units.every(e => e.formationGoal === undefined));
}

test('group moves preserve free formation slots, departing bodies and navigation RNG', () => {
  const { game, slots, scale } = groupArena(), units = groupUnits(game), goal = { x: 12, z: 8 },
    expected = pathValue(slots(units, goal));
  // Already standing at the requested formation is not a reason to move its slots.
  units.forEach((e, i) => Object.assign(e, expected[i]));
  game.random = () => { throw Error('Goal correction must not consume RNG'); };
  game.world.path = () => { throw Error('Goal correction must not start A*'); };
  orderGroup(game, units, goal);
  assert.deepEqual(units.map(e => ({ x: e.order.x, z: e.order.z })), expected);
  assert.ok(units.every(e => e.formationGoal === undefined));
  assertGroupGoalsFit(game, units, scale);
  game.stepping = true;
  orderGroup(game, units, goal);
  assert.deepEqual(units.map(e => ({ x: e.order.x, z: e.order.z })), expected, 'indexed probes also ignore departing centers');
  game.unitCollisionIndex.clear(); game.stepping = false;
  finishGroupMoves(game, units);
});

test('group goal correction reserves later valid slots before replacing an occupied slot', () => {
  const { game, slots, scale } = groupArena(), units = groupUnits(game), goal = { x: 12, z: 8 },
    expected = pathValue(slots(units, goal));
  const blocker = game.spawn('unit', 'rifle', expected[0].x, expected[0].z, 0, 0);
  game.setOrder(blocker, { type: 'hold' });
  assert.equal(game.unitFits(units[0], expected[0].x, expected[0].z), false, 'uncorrected slot is occupied');
  orderGroup(game, units, goal);
  assert.notDeepEqual({ x: units[0].order.x, z: units[0].order.z }, expected[0]);
  for (let i = 1; i < units.length; i++) assert.deepEqual({ x: units[i].order.x, z: units[i].order.z }, expected[i]);
  assert.deepEqual(pathValue(units[0].formationGoal), expected[0]);
  assertGroupGoalsFit(game, units, scale);
  finishGroupMoves(game, units);
  assert.deepEqual([blocker.x, blocker.z, blocker.order.type], [expected[0].x, expected[0].z, 'hold']);
});

test('group goals beside a building are fitted and complete their ordinary move orders', () => {
  const { game, scale } = groupArena(), units = groupUnits(game), goal = { x: 10, z: 0 };
  game.spawnBuilding('depot', 12.5, 0, 0, 0); game.world.rebuild(game.s.entities);
  orderGroup(game, units, goal);
  assert.ok(units.some(e => e.formationGoal), 'fixture actually requires a building correction');
  assertGroupGoalsFit(game, units, scale);
  finishGroupMoves(game, units);
});

test('group attack-move fits mixed body radii and flight layers without changing worker orders', () => {
  const { game, slots, scale } = groupArena(), units = groupUnits(game, ['worker', 'tank', 'rifle', 'air']),
    goal = { x: 12, z: 8 }, expected = slots(units, goal);
  const airBlocker = game.spawn('unit', 'air', expected[3].x, expected[3].z, 0, 0);
  game.setOrder(airBlocker, { type: 'hold' });
  game.spawnBuilding('depot', expected[1].x, expected[1].z, 0, 0); game.world.rebuild(game.s.entities);
  orderGroup(game, units, goal, 'attackMove');
  assert.deepEqual(units.map(e => e.order.type), ['move', 'attackMove', 'attackMove', 'attackMove']);
  assertGroupGoalsFit(game, units, scale);
  assert.ok(units[1].formationGoal && units[3].formationGoal);
  assert.deepEqual(pathValue(units[0].formationGoal), pathValue(expected[0]), 'worker retains its original slot intent');
});

test('group correction respects selected production exit reservations', () => {
  const { game, slots, scale } = groupArena(), units = groupUnits(game), goal = { x: 12, z: 8 },
    expected = slots(units, goal);
  units[3].exit = { building: 999, ...expected[0], length: 20 };
  orderGroup(game, units, goal);
  assert.ok(units[0].formationGoal, 'departure does not remove the exit reservation');
  assertGroupGoalsFit(game, units, scale);
});

test('group goal correction respects cliff footprints and map edges', () => {
  const { game, slots, scale } = groupArena(), units = groupUnits(game, ['tank', 'rifle']),
    goal = { x: 34.5, z: 8 }, expected = slots(units, goal), world = game.world;
  world.surface.cliffs[world.idx(expected[0].x, expected[0].z)] = 1;
  orderGroup(game, units, goal);
  assert.ok(units.every(e => e.formationGoal), 'one goal is a cliff and the other exceeds the movement boundary');
  assertGroupGoalsFit(game, units, scale);
  assert.ok(units.every(e => Math.abs(e.order.x) <= world.extent-5));
});

test('fully blocked group goals keep their requested slots after a bounded local search', () => {
  const { game, slots } = groupArena(), units = groupUnits(game), goal = { x: 12, z: 8 },
    expected = pathValue(slots(units, goal)), grid = game.world.blocked;
  grid.fill(1);
  let probes = 0;
  const fits = game.unitFits;
  game.unitFits = function (...args) { probes++; return fits.apply(this, args); };
  orderGroup(game, units, goal);
  assert.equal(probes, units.length * 136, 'one original slot plus at most 135 nearby candidates per unit');
  assert.deepEqual(units.map(e => ({ x: e.order.x, z: e.order.z })), expected);
  assert.ok(units.every(e => !e.formationGoal));
  assert.strictEqual(game.world.blocked, grid); assert.ok(grid.every(v => v === 1));
});

test('solo and non-movement commands do not acquire group corrections', () => {
  const { game } = groupArena(), units = groupUnits(game), goal = { x: 12, z: 8 };
  game.world.blocked.fill(1);
  orderGroup(game, [units[0]], goal);
  assert.deepEqual({ x: units[0].order.x, z: units[0].order.z }, goal);
  orderGroup(game, units, goal, 'guard');
  assert.ok(units.every(e => e.order.type === 'guard' && e.order.x === goal.x && e.order.z === goal.z && !e.formationGoal));
});

for (const attack of [false, true]) test(`AI compares corrected group intent without repeated resets, restored intent and partial renewals: ${attack}`, () => {
  const { game } = groupArena(), units = groupUnits(game), goal = { x: 10, z: 0 };
  game.spawnBuilding('depot', 12.5, 0, 0, 0); game.world.rebuild(game.s.entities);
  game.aiOrder(0, units, goal, attack, .1);
  assert.ok(units.some(e => e.formationGoal));
  units.find(e => e.formationGoal).pathStatus = 'unreachable';
  const orders = units.map(e => pathValue(e.order)), paths = units.map(e => e.path);
  game.aiOrder(0, units, goal, attack, .1);
  units.forEach((e, i) => { assert.deepEqual(pathValue(e.order), orders[i]); assert.strictEqual(e.path, paths[i]); });
  // Snapshots preserve the requested slot along with the corrected order; no transient cache is required.
  game.s.entities = pathValue(game.s.entities); game.ids = new Map(game.s.entities.map(e => [e.id, e]));
  const restored = units.map(e => game.get(e.id)), restoredPaths = restored.map(e => e.path);
  game.unitFits = () => { throw Error('Repeated AI intent comparison must not inspect live blockers'); };
  game.aiOrder(0, restored, goal, attack, .1);
  restored.forEach((e, i) => assert.strictEqual(e.path, restoredPaths[i]));
  game.setOrder(restored[0], { type: 'hold' });
  game.aiOrder(0, restored, goal, attack, .1);
  assert.equal(restored[0].order.type, attack ? 'attackMove' : 'move');
  restored.slice(1).forEach((e, i) => assert.strictEqual(e.path, restoredPaths[i+1]));
  game.setOrder(restored[1], { type: 'follow', id: restored[0].id });
  assert.equal(restored[1].formationGoal, undefined, 'replacing an order discards the old intent');
});

// Pure navigation fixtures: no world generation or simulation tick required.
function pathArena() {
  const context = loadScripts(['world'], { scripts });
  const { Battlefield, Heap } = vm.runInContext('({Battlefield,Heap})', context);
  const world = Object.assign(Object.create(Battlefield.prototype), {
    gridSize: 24, extent: 30, cellSize: 2.5, surface: null, blocked: new Uint8Array(24 * 24)
  });
  // Force A* around a short wall, while leaving both sides connected.
  for (let z = 7; z <= 16; z++) world.blocked[z * 24 + 12] = 1;
  return { world, Heap };
}
const pathValue = value => JSON.parse(JSON.stringify(value));
function assertWorkspaceReset(workspace) {
  assert.equal(workspace.busy, false); assert.equal(workspace.touchedCount, 0);
  assert.equal(workspace.heap.length, 0);
  assert.ok(workspace.cost.every(v => v === Infinity));
  assert.ok(workspace.parent.every(v => v === -1));
  assert.ok(workspace.closed.every(v => v === 0));
}

test('path workspace preserves heap ties and reuses entries after pop and clear', () => {
  const { Heap } = pathArena(), heap = new Heap();
  for (let i = 0; i < 6; i++) heap.push(i, 1);
  const entries = new Set(heap.a), popped = [];
  while (heap.length) popped.push(heap.pop());
  assert.deepEqual(popped, [0, 5, 4, 3, 2, 1]);
  for (let i = 0; i < 6; i++) heap.push(i, 6 - i);
  assert.equal(heap.pop(), 5); heap.push(6, 0); assert.equal(heap.pop(), 6);
  heap.clear(); assert.equal(heap.length, 0);
  for (let i = 0; i < 6; i++) heap.push(i, i);
  assert.equal(heap.a.length, 6); assert.ok(heap.a.every(entry => entries.has(entry)));
  assert.deepEqual(Array.from({ length: 6 }, () => heap.pop()), [0, 1, 2, 3, 4, 5]);
});

test('path workspace stays lazy on fast paths and reuses clean fields without retaining routes', () => {
  const { world } = pathArena();
  assert.equal(world.path(-20, -20, -10, -20).status, 'complete');
  assert.equal(world.path(-20, 0, 20, 0, true).status, 'complete');
  assert.equal(world.pathWorkspace, undefined);
  const first = world.path(-20, 0, 20, 0), expected = pathValue(first), workspace = world.pathWorkspace;
  assert.equal(first.status, 'complete'); assertWorkspaceReset(workspace);
  const fields = [workspace.cost, workspace.parent, workspace.closed, workspace.touched],
    entries = new Set(workspace.heap.a);
  assert.deepEqual(pathValue(world.path(-20, 0, 20, 0)), expected);
  assert.strictEqual(world.pathWorkspace, workspace);
  [workspace.cost, workspace.parent, workspace.closed, workspace.touched].forEach((field, i) => assert.strictEqual(field, fields[i]));
  assert.ok(workspace.heap.a.every(entry => entries.has(entry)));
  // Closed layout, partial result, reopened layout and independent output ownership.
  for (let z = 0; z < 24; z++) world.blocked[z * 24 + 12] = 1;
  assert.equal(world.path(-20, 0, 20, 0).status, 'unreachable'); assertWorkspaceReset(workspace);
  assert.equal(world.path(-20, 0, 6, 0).status, 'partial'); assertWorkspaceReset(workspace);
  world.blocked.fill(0);
  assert.equal(world.path(-20, 0, 20, 0).points.length, 1);
  assert.deepEqual(pathValue(first), expected, 'later searches cannot mutate returned paths');
  const other = pathArena().world; other.path(-20, 0, 20, 0);
  assert.notStrictEqual(other.pathWorkspace.cost, workspace.cost, 'worlds never share scratch');
});

test('path workspace is isolated during nested searches and cleared after terrain errors', () => {
  const { world } = pathArena(), forward = pathValue(world.path(-20, 0, 20, 0)),
    reverse = pathValue(world.path(20, 0, -20, 0)), workspace = world.pathWorkspace;
  let nested = false, inner;
  world.terrainFree = () => {
    if (!nested && workspace.busy && workspace.touchedCount > 2) {
      nested = true; inner = pathValue(world.path(20, 0, -20, 0));
      assert.equal(workspace.busy, true, 'inner cleanup must not release outer scratch');
    }
    return true;
  };
  assert.deepEqual(pathValue(world.path(-20, 0, 20, 0)), forward);
  assert.ok(nested); assert.deepEqual(inner, reverse); assertWorkspaceReset(workspace);
  world.terrainFree = () => {
    if (workspace.busy && workspace.touchedCount > 2) throw Error('terrain failure');
    return true;
  };
  assert.throws(() => world.path(-20, 0, 20, 0), /terrain failure/);
  assertWorkspaceReset(workspace);
  delete world.terrainFree;
  assert.deepEqual(pathValue(world.path(-20, 0, 20, 0)), forward);
});

test('cosmetic callers can bound path work without changing the default route or poisoning later searches', () => {
  const { world } = pathArena();
  const expected = pathValue(world.path(-20, 0, 20, 0));
  assert.equal(world.path(-20, 0, 20, 0, false, undefined, 0, false, 1).status, 'budget-exhausted');
  assertWorkspaceReset(world.pathWorkspace);
  assert.deepEqual(pathValue(world.path(-20, 0, 20, 0)), expected);
  assert.deepEqual(pathValue(world.path(-20, 0, 20, 0, false, undefined, 0, false, Infinity)), expected);
});

test('cosmetic road costs prefer modest existing detours without changing ordinary navigation',()=>{
 const {world}=pathArena();world.blocked.fill(0);
 const from={x:-21.25,z:1.25},to={x:21.25,z:1.25};
 const ordinary=pathValue(world.path(from.x,from.z,to.x,to.z));
 const roadCost=(x,z)=>Math.abs(z-3.75)<1.3?1:1.3;
 const preferred=world.path(from.x,from.z,to.x,to.z,false,undefined,.2,false,600,roadCost);
 assert.equal(preferred.status,'complete');
 assert.ok(preferred.points.some(p=>p.z>2.5),'smoothing retains the nearby road instead of cutting straight across it');
 assert.deepEqual(pathValue(world.path(from.x,from.z,to.x,to.z)),ordinary);
 const distant=world.path(from.x,from.z,to.x,to.z,false,undefined,.2,false,600,
  (x,z)=>z>16?1:1.3);
 assert.equal(distant.status,'complete');assert.ok(distant.points.every(p=>p.z<16),'not worth a large detour');
 const fallback=world.path(from.x,from.z,to.x,to.z,false,undefined,.2,false,1,roadCost);
 assert.equal(fallback.status,'complete');assert.deepEqual(pathValue(fallback),ordinary,'bounded preference falls back to a proven direct route');
 assertWorkspaceReset(world.pathWorkspace);
});

test('path workspace discards pending heap entries on search budget exhaustion', () => {
  const { world, Heap } = pathArena(), pop = Heap.prototype.pop;
  let pops = 0;
  // Keep a duplicate pending: closed-node pops must still count against the old budget.
  Heap.prototype.pop = function () { const id = pop.call(this); pops++; this.push(id, 0); return id; };
  try {
    assert.equal(world.path(-20, 0, 20, 0).status, 'budget-exhausted');
    assert.equal(pops, Math.ceil(5600 * (24 / 72) ** 2));
    assertWorkspaceReset(world.pathWorkspace);
  } finally { Heap.prototype.pop = pop; }
  assert.equal(world.path(-20, 0, 20, 0).status, 'complete');
  assertWorkspaceReset(world.pathWorkspace);
});
