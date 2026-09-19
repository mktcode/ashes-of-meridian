// Scheduler/state tests only: no battlefield generation, autonomous AI or simulated combat ticks.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts, BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS } = require('./helpers/game-scripts.cjs');
const context = loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'effects', ...SIMULATION_SCRIPTS]);
const { MeridianGame, scenarioSetup, createCommandQueue, COMMAND_QUEUE_LIMIT } = vm.runInContext(
  '({ MeridianGame, scenarioSetup, createCommandQueue, COMMAND_QUEUE_LIMIT })', context);
vm.runInContext('Math.random = () => { throw Error("Unseeded randomness"); }', context);
const json = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const events = [], game = new MeridianGame({ upgrades: {} }, (...event) => events.push(json(event)));
  const setup = scenarioSetup({ seed: 1409, map: 'desert', duration: 1,
    parties: [{ faction: 0, controller: 'human' }, { faction: 0, controller: 'human' }],
    hostilities: [[false, true], [true, false]] });
  const hq = (id, team) => ({ id, team, kind: 'building', type: 'hq', hp: 100, maxHp: 100, progress: 1,
    queue: [], x: team * 10, z: 0, size: 4, faction: 0 });
  const worker = (id, team) => ({ id, team, kind: 'unit', type: 'worker', hp: 100, maxHp: 100, progress: 1,
    queue: [], x: team * 10, z: 7, size: 1, faction: 0, order: { type: 'idle' } });
  game.s = { parties: setup.parties, rules: setup.rules, time: 0, stopped: false, result: null,
    entities: [hq(1, 0), hq(2, 1), worker(3, 0), worker(4, 1)] };
  game.ids = new Map(game.s.entities.map(e => [e.id, e]));
  game.world = { extent: 90, viewTeam: 0, idx: () => 0, rebuild() {},
    sight: Array.from({ length: 2 }, () => ({ visible: new Uint8Array([255]), explored: new Uint8Array([1]) })) };
  game.random = game.cosmeticRandom = () => { throw Error('Unexpected scheduler RNG'); };
  return { game, events };
}
const hold = (id = 3) => ({ kind: 'order', ids: [id], order: { type: 'hold' } });

test('queue captures copied action/actor and authority-assigned order, not client tick or sequence', () => {
  const { game } = fixture(), before = json(game.s);
  const input = { kind: 'order', ids: [3], order: { type: 'move', x: 10, z: 12 }, team: 1, tick: 99, sequence: 999 };
  const ticket = game.queueAction(0, input);
  assert.deepEqual(json(ticket), { tick: 1, sequence: 1 });
  const second = game.queueAction(1, hold(4));
  assert.deepEqual(json(second), { tick: 1, sequence: 2 });
  assert.deepEqual(json(game.s), before);
  input.ids[0] = 4; input.order.x = 80; ticket.tick = 999; ticket.sequence = 999;
  game.world.viewTeam = 1;
  assert.equal(game.beginCommandTick(), true);
  assert.deepEqual(json(game.get(3).order), { type: 'move', x: 10, z: 12 });
  assert.equal(game.get(4).order.type, 'hold');
  assert.equal(game.s.time, 0, 'scheduler does not advance simulation time');
  assert.deepEqual(json(game.commandQueue.lastResults), [
    { tick: 1, sequence: 1, team: 0, status: 'applied' }, { tick: 1, sequence: 2, team: 1, status: 'applied' }
  ]);
  assert.equal(game.commandQueue.pending.length, 0);
  game.beginCommandTick(); assert.equal(game.commandQueue.tick, 2); assert.equal(game.commandQueue.lastResults.length, 0);
});

test('execution revalidates funds in arrival order; queue acceptance neither reserves nor spends resources', () => {
  const { game } = fixture(), cost = game.cost('worker');
  game.account(0).alloy = cost.cost;
  for (let i = 0; i < 2; i++) assert.equal(game.submitAction(0, { kind: 'train', unit: 'worker' }), true);
  assert.equal(game.account(0).alloy, cost.cost); assert.equal(game.get(1).queue.length, 0);
  game.beginCommandTick();
  assert.equal(game.get(1).queue.length, 1); assert.equal(game.account(0).alloy, 0);
  assert.deepEqual(Array.from(game.commandQueue.lastResults, r => r.status), ['applied', 'rejected']);
});

test('stale ownership and newly hidden targets are rejected at execution', () => {
  const { game } = fixture();
  game.queueAction(0, hold()); game.get(3).team = 1;
  game.beginCommandTick(); assert.equal(game.commandQueue.lastResults[0].status, 'rejected');
  assert.equal(game.get(3).order.type, 'idle');
  game.get(3).team = 0;
  game.queueAction(0, { kind: 'order', ids: [3], order: { type: 'attack', id: 4, x: 10, z: 7 } });
  game.world.sight[0].visible[0] = 0;
  game.beginCommandTick(); assert.equal(game.commandQueue.lastResults[0].status, 'rejected');
  assert.equal(game.get(3).order.type, 'idle');
});

test('commands admitted by callbacks wait for the following tick and cannot reenter the current batch', () => {
  const { game } = fixture(); let next;
  game.emit = () => {
    next = game.queueAction(1, hold(4));
    assert.equal(game.beginCommandTick(), false);
  };
  game.queueAction(0, { kind: 'train', unit: 'worker' });
  game.beginCommandTick();
  assert.deepEqual(json(next), { tick: 2, sequence: 2 });
  assert.equal(game.commandQueue.lastResults.length, 1); assert.equal(game.get(4).order.type, 'idle');
  game.beginCommandTick(); assert.equal(game.get(4).order.type, 'hold');
  assert.equal(game.commandQueue.lastResults[0].tick, 2);
});

test('navigation edits from earlier commands are flushed before later validation', () => {
  const { game } = fixture(), order = [];
  game.queueAction(0, hold()); game.queueAction(0, hold());
  game.world.rebuild = () => order.push('rebuild');
  game.executeAction = () => { order.push('action'); game.navDirty = true; return true; };
  game.beginCommandTick();
  assert.deepEqual(order, ['action', 'rebuild', 'action']);
});

test('invalid and over-capacity submissions consume no sequence and queue memory stays bounded', () => {
  const { game } = fixture();
  for (const team of [-1, 2, .5, NaN, '0']) assert.equal(game.queueAction(team, hold()), null);
  assert.equal(game.queueAction(0, { kind: 'unknown' }), null);
  assert.equal(game.queueAction(0, { kind: 'rally', ids: [1], position: { x: Infinity, z: 0 } }), null);
  assert.equal(game.queueAction(0, { kind: 'order', ids: [3], order: { type: 'move', x: 91, z: 0 } }), null);
  assert.equal(game.commandQueue.nextSequence, 1);
  for (let i = 0; i < COMMAND_QUEUE_LIMIT; i++) assert.ok(game.queueAction(0, hold()));
  assert.equal(game.queueAction(0, hold()), null);
  assert.equal(game.commandQueue.nextSequence, COMMAND_QUEUE_LIMIT + 1);
  game.s.stopped = true; game.cancelQueuedActions();
  assert.equal(game.commandQueue.pending.length, 0);
  assert.ok(game.commandQueue.lastResults.every(r => r.status === 'cancelled'));
  assert.equal(game.queueAction(0, hold()), null); assert.equal(game.beginCommandTick(), false);
});

test('single-player submissions stay immediate and fresh battle queues do not share pending data', () => {
  const { game } = fixture(); game.s.rules = { kind: 'single-player' };
  assert.equal(game.queueAction(0, hold()), null);
  assert.equal(game.submitAction(0, hold()), true); assert.equal(game.get(3).order.type, 'hold');
  assert.equal(game.commandQueue.tick, 0); assert.equal(game.commandQueue.pending.length, 0);
  const a = createCommandQueue(), b = createCommandQueue(); a.pending.push({});
  assert.equal(b.pending.length, 0); assert.equal(b.nextSequence, 1); assert.equal(b.tick, 0);
});

test('battle replacement during a callback abandons the old batch, never executing it in the new battle', () => {
  const { game } = fixture(), previous = game.commandQueue;
  game.queueAction(0, { kind: 'train', unit: 'worker' }); game.queueAction(0, hold());
  game.emit = () => {
    const replacement = fixture().game;
    game.s = replacement.s; game.world = replacement.world; game.ids = replacement.ids;
    game.commandQueue = replacement.commandQueue;
  };
  assert.equal(game.beginCommandTick(), false);
  assert.equal(game.commandQueue.tick, 0); assert.equal(game.get(3).order.type, 'idle');
  assert.equal(game.get(1).queue.length, 0);
  assert.deepEqual(Array.from(previous.lastResults, r => r.status), ['applied', 'cancelled']);
});

test('unexpected execution errors stop the scenario without retrying partially applied commands', () => {
  const { game } = fixture(), failure = new Error('event sink failed');
  game.queueAction(0, { kind: 'train', unit: 'worker' }); game.queueAction(0, hold());
  game.emit = () => { throw failure; };
  assert.throws(() => game.beginCommandTick(), error => error === failure);
  assert.equal(game.s.stopped, true); assert.equal(game.commandQueue.processing, false);
  assert.equal(game.get(1).queue.length, 1, 'partial mutation is not claimed to be rolled back');
  assert.equal(game.get(3).order.type, 'idle'); assert.equal(game.commandQueue.pending.length, 0);
  assert.deepEqual(Array.from(game.commandQueue.lastResults, r => r.status), ['failed', 'cancelled']);
  assert.equal(game.beginCommandTick(), false);
});

test('runtime gates the batch before advancing time; invalid or expired steps execute no commands', () => {
  const { game } = fixture(); let entered = 0;
  game.queueAction(0, hold());
  const begin = game.beginCommandTick;
  game.beginCommandTick = () => { entered++; assert.equal(game.s.time, 0); return false; };
  for (const dt of [0, -1, NaN, Infinity]) game.step(dt);
  assert.equal(entered, 0);
  game.step(.05); assert.equal(entered, 1); assert.equal(game.s.time, 0);
  game.beginCommandTick = begin;
  game.s.time = game.s.rules.duration;
  game.step(.05);
  assert.equal(game.s.stopped, true); assert.equal(game.commandQueue.tick, 0);
  assert.equal(game.get(3).order.type, 'idle'); assert.equal(game.commandQueue.pending.length, 0);
  assert.equal(game.commandQueue.lastResults[0].status, 'cancelled');
});
