// Scheduler/state tests only: no battlefield generation, autonomous AI or combat.
// Tick-guard cases use empty worlds and stubbed runtime phases.
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

test('local recruitment copies and revalidates its producer without rerouting', () => {
  const { game } = fixture(); game.account(0).alloy = 10000;
  const other = {...game.get(1), id:5, queue:[]}; game.s.entities.push(other); game.ids.set(5,other);
  const input = {kind:'train',unit:'worker',producerId:1};
  assert.ok(game.queueAction(0,input)); input.producerId=5;
  game.beginCommandTick(); assert.equal(game.get(1).queue.length,1);assert.equal(other.queue.length,0);
  for(const blocked of ['full','unfinished','enemy','dead','wrong-type']) {
    const b=game.ids.get(1); Object.assign(b,{hp:100,team:0,progress:1,type:'hq',queue:[]});
    if(blocked==='full')b.queue=Array.from({length:5},()=>({type:'worker',time:10,progress:0}));
    if(blocked==='unfinished')b.progress=.5;
    if(blocked==='enemy')b.team=1;
    if(blocked==='dead')b.hp=0;
    if(blocked==='wrong-type')b.type='barracks';
    const funds=game.account(0).alloy;
    assert.ok(game.queueAction(0,{kind:'train',unit:'worker',producerId:1}));game.beginCommandTick();
    assert.equal(game.commandQueue.lastResults[0].status,'rejected',blocked);
    assert.equal(other.queue.length,0,blocked); assert.equal(game.account(0).alloy,funds,blocked);
  }
  assert.ok(game.queueAction(0,{kind:'train',unit:'worker'}));game.beginCommandTick();
  assert.equal(other.queue.length,1,'global recruitment still chooses an available producer');
});

test('local recruitment rejects malformed producer IDs before queue admission', () => {
  const {game}=fixture();
  for(const producerId of [0,-1,1.5,'1',null,Number.MAX_SAFE_INTEGER+1])
    assert.equal(game.queueAction(0,{kind:'train',unit:'worker',producerId}),null);
  assert.equal(game.commandQueue.pending.length,0);
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
    game.step(.05);
    assert.equal(game.s.time, 0, 'queue callbacks cannot enter runtime phases');
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
  const { game } = fixture(); game.s.rules = { kind: 'single-player', mission: {id:'hq-elimination'} };
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

function emptyRuntime() {
  const { game } = fixture();
  Object.assign(game.s, { entities: [], supplyCaches: [], strikes: [], fields: [], scans: [], recalls: [], triggers: {} });
  game.world.definition = {};
  game.world.reveal = () => {};
  game.rehash = game.resolveRecalls = () => {};
  return game;
}

test('the whole scenario tick rejects recursion and defers late callback inputs to the next tick', () => {
  const game = emptyRuntime(); let callbacks = 0;
  game.executeAction = () => true;
  game.resolveRecalls = () => {
    callbacks++;
    assert.equal(game.commandQueue.processing, false, 'the command batch has already finished');
    assert.ok(game.queueAction(0, { kind: 'train', unit: 'worker' }));
    game.step(.05);
  };
  const energy = game.account(0).energy;
  game.step(.05);
  assert.equal(callbacks, 1); assert.equal(game.s.time, .05);
  assert.equal(game.commandQueue.tick, 1);
  assert.equal(game.commandQueue.pending.length, 1);
  assert.equal(game.commandQueue.pending[0].tick, 2);
  assert.equal(game.account(0).energy, energy + .05 * vm.runInContext('COMMAND_ENERGY.regeneration', context));
  assert.equal(game.stepping, false);
  game.resolveRecalls = () => {};
  game.step(.05);
  assert.equal(game.s.time, .1); assert.equal(game.commandQueue.tick, 2);
  assert.deepEqual(Array.from(game.commandQueue.lastResults, r => r.status), ['applied']);
});

test('tick guard survives callback state replacement and releases after runtime errors', () => {
  const game = emptyRuntime(), replacement = emptyRuntime(), failure = Error('phase failed');
  game.resolveRecalls = () => {
    game.s = replacement.s; game.commandQueue = replacement.commandQueue;
    game.step(.05);
    assert.equal(game.s.time, 0); assert.equal(game.commandQueue.tick, 0);
    throw failure;
  };
  assert.throws(() => game.step(.05), error => error === failure);
  assert.equal(game.stepping, false);
  game.resolveRecalls = () => {};
  game.step(.05);
  assert.equal(game.s.time, .05); assert.equal(game.commandQueue.tick, 1);
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
  assert.equal(game.stepping, false);
  game.step(.05); assert.equal(game.commandQueue.tick, 0);
});
