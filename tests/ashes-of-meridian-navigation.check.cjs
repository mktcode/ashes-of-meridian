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
  const game = arena(); game.spawnBuilding('hq', 0, 0, 0, 0);
  const w = game.spawnUnit('worker', 9.05, 0, 0, 0), node = game.spawnResource('crystal', 20, 0, 1000);
  game.world.rebuild(game.s.entities);
  w.order = { type: 'mine', id: node.id }; w.carry = 18; w.returning = true;
  const alloy = game.account(0).alloy;
  tickWorkers(game, [w]);
  assert.equal(w.carry, 18); assert.equal(game.account(0).alloy, alloy);
  tickWorkers(game, [w]);
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
