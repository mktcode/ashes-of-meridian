const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts, BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS, MULTIPLAYER_SCRIPTS } = require('./helpers/game-scripts.cjs');
const context = loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'effects', ...SIMULATION_SCRIPTS, ...MULTIPLAYER_SCRIPTS]);
const { multiplayerFrame, applyMultiplayerFog, multiplayerFog, queueMultiplayerAction, MeridianGame } = vm.runInContext(
  '({ multiplayerFrame, applyMultiplayerFog, multiplayerFog, queueMultiplayerAction, MeridianGame })', context);
const json = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const entity = (id, team, x) => ({ id, team, x, z: 0, hp: 100, maxHp: 100, kind: 'unit', type: 'worker',
    faction: 0, size: 1, rot: 0, progress: 1, walk: 0, shield: 0, maxShield: 0, carry: 0, lastHit: 0, kills: 0,
    queue: [], order: { type: 'idle' }, path: [{ x: 80, z: 80 }], target: 99, lastSource: 99 });
  const s = { time: 1, entities: [entity(1, 0, 0), entity(2, 1, 1), entity(3, 1, 2),
    { ...entity(4, -1, 1), kind: 'resource', type: 'crystal', amount: 500 }],
    scans: [{ team: 1, x: 2, z: 0, r: 10, until: 99 }], fields: [], strikes: [], parties: [{ id: 0 }, { id: 1 }], stats: { damage: 9999 }, triggers: { secret: true } };
  const sight = { visible: new Uint8Array([255, 255, 0]), explored: new Uint8Array([1, 1, 0]) };
  const game = { s, world: { sight: [sight], idx: x => x }, commandQueue: { tick: 7 },
    canSee: (team, e) => team === e.team || !!sight.visible[e.x],
    party: team => ({ id: team, faction: 0, account: { alloy: 100, gas: 0, energy: 10, abilities: {} } }) };
  return { game, sight };
}
test('party projection excludes hidden entities, opponent internals and hidden attack targets without mutating simulation', () => {
  const { game } = fixture();
  game.s.entities[0].order = { type: 'attack', id: 3, x: 2, z: 0 };
  game.s.entities[1].queue = [{ type: 'hero', time: 10, progress: 3, cost: 900, gas: 99 }];
  const before = json(game.s), view = json(multiplayerFrame(game, 0, new Map()));
  assert.deepEqual(view.entities.map(e => e.id), [1, 2, 4]);
  assert.deepEqual(view.entities[0].order, { type: 'idle' });
  assert.deepEqual(view.entities[1].queue, []); assert.deepEqual(view.entities[1].path, []);
  for (const e of view.entities) { assert.equal(e.target, undefined); assert.equal(e.lastSource, undefined); }
  assert.equal(view.stats, undefined); assert.equal(view.triggers, undefined); assert.equal(view.parties, undefined);
  assert.deepEqual(view.scans, []); assert.deepEqual(json(game.s), before);
});
test('hidden resource updates do not leak through explored fog; current sight refreshes or removes memory', () => {
  const { game, sight } = fixture(), memory = new Map();
  multiplayerFrame(game, 0, memory);
  sight.visible[1] = 0; game.s.entities[3].amount = 100;
  assert.equal(multiplayerFrame(game, 0, memory).entities.find(e => e.id === 4).amount, 500);
  sight.visible[1] = 255;
  assert.equal(multiplayerFrame(game, 0, memory).entities.find(e => e.id === 4).amount, 100);
  game.s.entities[3].hp = 0;
  assert.equal(multiplayerFrame(game, 0, memory).entities.some(e => e.id === 4), false);
});
test('strike warnings expose only owned or visible non-shell markers, never combat payloads', () => {
  const { game } = fixture();
  game.s.strikes = [
    { x: 2, z: 0, type: 'orbital', team: 0, at: 9, radius: 10, damage: 999, source: 42 },
    { x: 2, z: 0, type: 'orbital', team: 1, at: 9, radius: 10, damage: 999, source: 43 },
    { x: 1, z: 0, type: 'flare', team: -1, at: 9, radius: 8, damage: 999 },
    { x: 0, z: 0, type: 'shell', team: 0, at: 9, radius: 4, damage: 999, source: 42 }
  ];
  const strikes = multiplayerFrame(game, 0, new Map()).strikes;
  assert.deepEqual(json(strikes).map(s => s.type), ['orbital', 'flare']);
  assert.ok(strikes.every(s => s.damage === 0 && s.source === undefined));
});

test('wire admission limits do not disclose hidden entity counts', () => {
  const { game } = fixture(); let calls = 0;
  game.queueAction = () => { calls++; return { tick: 1, sequence: 1 }; };
  const excessive = { kind: 'order', ids: [1, 99], order: { type: 'hold' } };
  assert.equal(queueMultiplayerAction(game, 0, excessive), null);
  for (let i = 0; i < 100; i++) game.s.entities.push({ id: 100 + i, team: 1 });
  assert.equal(queueMultiplayerAction(game, 0, excessive), null);
  assert.equal(calls, 0);
  assert.ok(queueMultiplayerAction(game, 0, { ...excessive, ids: [1] }));
  assert.equal(calls, 1);
});

test('fog encoding round-trips only one party and rejects wrong dimensions and unbounded runs', () => {
  const visible = new Uint8Array([255, 0, 0, 255]), explored = new Uint8Array([1, 1, 0, 1]);
  const sight = () => ({ visible: new Uint8Array(4), explored: new Uint8Array(4) });
  const world = { sight: [sight(), sight()], fogPixels: new Uint8Array(4), fogVersion: 0 };
  applyMultiplayerFog(world, 1, multiplayerFog(visible, explored));
  assert.deepEqual(world.sight[1].visible, visible); assert.deepEqual(world.sight[1].explored, explored);
  assert.deepEqual(Array.from(world.sight[0].visible), [0, 0, 0, 0]);
  for (const runs of [[5, 255], [1, 255], [0, 0], [4, 77], [4]]) assert.throws(() => applyMultiplayerFog(world, 1, runs));
});
test('network mirror forwards copied actions only for its actor and never runs local simulation or execution', () => {
  const game = new MeridianGame({ upgrades: {} }, () => {}), sent = [];
  game.networkTeam = 1;
  game.world = { viewTeam: 1 };
  game.s = { entities: [{ id: 5 }], time: 7, parties: [{ id: 0 }, { id: 1 }], rules: { kind: 'scenario' } };
  game.networkSubmit = action => { sent.push(action); return true; };
  const action = { kind: 'order', ids: [5], order: { type: 'move', x: 1, z: 2 } };
  assert.equal(game.submitAction(0, action), false);
  assert.equal(game.submitAction(1, action), true);
  action.order.x = 99; assert.equal(sent[0].order.x, 1);
  assert.equal(game.queueAction(1, action), null); assert.equal(game.executeAction(1, action), false);
  assert.equal(game.beginCommandTick(), false); game.step(.05); assert.equal(game.s.time, 7);
  assert.equal(game.setPerspective(0), false); assert.equal(game.setPerspective(1), true);
});
