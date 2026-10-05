// Action-boundary state tests: no world generation, simulation steps, autonomous AI or browser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts, BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS } = require('./helpers/game-scripts.cjs');
const context = loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world', ...SIMULATION_SCRIPTS]);
const { MeridianGame, scenarioSetup, parseBattleAction } = vm.runInContext('({ MeridianGame, scenarioSetup, parseBattleAction })', context);
vm.runInContext('Math.random = seeded = () => { throw Error("Unexpected action RNG"); }', context);
const json = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const g = Object.create(MeridianGame.prototype), events = [];
  const setup = scenarioSetup({ seed: 1409, map: 'desert', duration: 1,
    parties: Array.from({ length: 4 }, () => ({ faction: 0, controller: 'human' })),
    hostilities: Array.from({ length: 4 }, (_, a) => Array.from({ length: 4 }, (_, b) => a !== b)) });
  const building = team => ({ id: team + 1, team, faction: 0, kind: 'building', type: 'hq',
    x: team * 10, z: 0, hp: 100, maxHp: 100, progress: 1, queue: [], size: 4 });
  const worker = team => ({ id: team + 5, team, faction: 0, kind: 'unit', type: 'worker',
    x: team * 10, z: 7, hp: 100, maxHp: 100, progress: 1, queue: [], size: 1, order: { type: 'idle' } });
  g.s = { parties: setup.parties, rules: setup.rules, result: null, stopped: false, time: 0,
    entities: [...[0, 1, 2, 3].map(building), ...[0, 1, 2, 3].map(worker),
      { id: 9, team: -1, kind: 'resource', type: 'crystal', x: 5, z: 5, hp: 100 }] };
  g.ids = new Map(g.s.entities.map(e => [e.id, e]));
  g.world = { extent: 90, idx: () => 0,
    sight: Array.from({ length: 4 }, () => ({ visible: new Uint8Array([255]), explored: new Uint8Array([1]) })) };
  g.emit = (...event) => events.push(json(event));
  return { g, events };
}

test('building near the map edge retains only the foundation margin and still respects cliffs', () => {
  const { BattlefieldSurface, BUILDINGS } = vm.runInContext('({ BattlefieldSurface, BUILDINGS })', context);
  for (const type of ['turret', 'depot']) for (const axis of ['x', 'z']) for (const sign of [-1, 1]) {
    const { g } = fixture();
    g.s.supplyCaches = [];
    g.world.staticGrid = new Uint8Array(1);
    const radius = BUILDINGS[type].size, limit = g.world.extent - radius - 1,
      allowed = { x: 0, z: 0, [axis]: sign * (limit - .01) },
      outside = { x: 0, z: 0, [axis]: sign * (limit + .01) };
    assert.equal(g.canBuild(type, allowed), '', 'flat edge space is usable without a surface');
    assert.match(g.canBuild(type, outside), /boundary/);
    g.world.surface = new BattlefieldSurface(g.world.extent, 2.5, () => 0);
    assert.equal(g.canBuild(type, allowed), '', 'flat edge space is usable with a real foundation');
    assert.ok(g.canBuild(type, outside), 'foundation cannot cross the retained margin');
    g.world.surface.cliffs.fill(1);
    assert.match(g.canBuild(type, allowed), /stable ground/, 'cliff clearance is not relaxed');
  }
});

test('action parser copies known data and rejects malformed values before dispatch', () => {
  const action = { kind: 'order', ids: [1, 1, 2], team: 3, order: { type: 'move', x: 3, z: 4, team: 3 } };
  const parsed = parseBattleAction(action, 10);
  action.ids[0] = 99; action.order.x = 90;
  assert.deepEqual(json(parsed), { kind: 'order', ids: [1, 2], order: { type: 'move', x: 3, z: 4 } });
  for (const input of [null, [], {}, { kind: 'unknown' }, { kind: 'train', unit: '__proto__' },
    { kind: 'train', unit: 'hq' }, { kind: 'ability', ability: 'missing', position: { x: 0, z: 0 } },
    { kind: 'cancelQueue', id: 1, index: -1 }, { kind: 'cancelQueue', id: 1, index: .5 },
    { kind: 'cancelConstruction', id: NaN }, { kind: 'sell', id: 0 },
    { kind: 'rally', ids: new Array(2), position: { x: 0, z: 0 } },
    { kind: 'rally', ids: [1], position: { x: Infinity, z: 0 } },
    { kind: 'order', ids: [1], order: { type: 'move', x: NaN, z: 0 } },
    { kind: 'order', ids: [1], order: { type: 'repair', id: 1, x: 0 } },
    { kind: 'order', ids: [1], order: { type: 'teleport', x: 0, z: 0 } },
    { kind: 'order', ids: [1, 2, 3], order: { type: 'hold' } }
  ]) assert.equal(parseBattleAction(input, 2), null, JSON.stringify(input));
});

test('building rotation is immediate, free, bounded and cosmetic for every completed own building', () => {
  const {g,events}=fixture(),types=vm.runInContext('Object.keys(BUILDINGS)',context);
  g.s.rules={kind:'single-player'};g.navDirty=false;g.random=()=>{throw Error('Rotation consumed RNG');};
  g.get(1).rot=.7;
  for(const type of types){
    g.get(1).type=type;delete g.get(1).visualRotation;
    const before=json(g.s);
    assert.equal(g.submitAction(0,{kind:'rotateBuilding',id:1,direction:-1}),true);
    assert.equal(g.get(1).visualRotation,23/3);
    for(let i=0;i<25;i++)assert.equal(g.submitAction(0,{kind:'rotateBuilding',id:1,direction:1}),true);
    assert.equal(g.get(1).visualRotation,0);
    const after=json(g.s);delete after.entities[0].visualRotation;
    assert.deepEqual(after,before,'only cosmetic orientation may change');
  }
  g.get(1).visualRotation=3;
  assert.equal(g.submitAction(0,{kind:'rotateBuilding',id:1,direction:1}),true);
  assert.equal(g.get(1).visualRotation,10/3,'existing orientation advances by 15 degrees, not a new unit');
  assert.equal(g.submitAction(0,{kind:'rotateBuilding',id:1,direction:-1}),true);
  assert.equal(g.get(1).visualRotation,3);
  assert.equal(g.navDirty,false);assert.deepEqual(events,[]);
  for(const input of [{kind:'rotateBuilding',id:0,direction:1},...[-2,0,2,.5,NaN,Infinity,'1',null,undefined].map(direction=>({kind:'rotateBuilding',id:1,direction}))])
    assert.equal(parseBattleAction(input,10),null);
  for(const id of [2,5,99])assert.equal(g.executeAction(0,{kind:'rotateBuilding',id,direction:1}),false);
  const b=g.get(1);b.progress=.99;assert.equal(g.executeAction(0,{kind:'rotateBuilding',id:1,direction:1}),false);
  b.progress=1;b.hp=0;assert.equal(g.executeAction(0,{kind:'rotateBuilding',id:1,direction:1}),false);
});

test('inactive/missing actors and out-of-bounds actions leave state and events untouched', () => {
  const { g, events } = fixture(), action = { kind: 'train', unit: 'worker' };
  const before = json(g.s);
  for (const actor of [-1, 4, .5, NaN, '0']) assert.equal(g.executeAction(actor, action), false);
  assert.equal(g.executeAction(0, { kind: 'rally', ids: [1], position: { x: 91, z: 0 } }), false);
  assert.equal(g.executeAction(0, { kind: 'order', ids: [5], order: { type: 'move', x: 0, z: -91 } }), false);
  assert.deepEqual(json(g.s), before); assert.deepEqual(events, []);
  for (const stopped of [true, false]) {
    g.s.stopped = stopped; g.s.result = stopped ? null : { win: true };
    const ended = json(g.s);
    assert.equal(g.executeAction(0, action), false); assert.deepEqual(json(g.s), ended);
  }
  g.s = null; assert.equal(g.executeAction(0, action), false);
});

test('orders bind ownership to the supplied actor, validate targets and keep neutral resources separate', () => {
  const { g } = fixture();
  assert.equal(g.executeAction(2, { kind: 'order', team: 0, ids: [5, 7], order: { type: 'hold' } }), true);
  assert.equal(g.get(5).order.type, 'idle'); assert.equal(g.get(7).order.type, 'hold');
  const order = (type, id) => ({ kind: 'order', ids: [7], order: { type, id, x: 0, z: 0 } });
  assert.equal(g.executeAction(2, order('attack', 3)), false);
  assert.equal(g.executeAction(2, order('attack', 9)), false);
  assert.equal(g.executeAction(2, order('follow', 5)), false);
  assert.equal(g.executeAction(2, order('repair', 1)), false);
  assert.equal(g.executeAction(2, order('mine', 1)), false);
  assert.equal(g.executeAction(2, order('attack', 99)), false);
  g.world.sight[2].visible[0] = 0;
  assert.equal(g.executeAction(2, order('attack', 1)), false);
  assert.equal(g.executeAction(2, order('smart', 1)), false);
  assert.equal(g.executeAction(2, order('mine', 9)), true, 'explored resources do not require live sight');
  g.world.sight[2].explored[0] = 0;
  assert.equal(g.executeAction(2, order('smart', 9)), false);
  assert.equal(g.executeAction(2, order('mine', 9)), false);
  g.world.sight[2].visible[0] = 255;
  assert.equal(g.executeAction(2, order('attack', 1)), true);
  assert.equal(g.get(7).order.type, 'attack');
  g.get(3).hp = 50; g.account(2).alloy = 0;
  const previous = json(g.get(7).order);
  assert.equal(g.executeAction(2, order('repair', 3)), false, 'shared validator reports lack of alloy');
  assert.deepEqual(json(g.get(7).order), previous);
});

test('rally is simulation-owned, copied, and restricted to completed owned buildings', () => {
  const { g, events } = fixture(), point = { x: 12, z: 13 };
  g.get(2).progress = .5;
  assert.equal(g.executeAction(1, { kind: 'rally', ids: [2], position: point }), false);
  assert.equal(g.executeAction(0, { kind: 'rally', ids: [1, 2, 5], position: point }), true);
  point.x = 70;
  assert.deepEqual(json(g.get(1).rally), { x: 12, z: 13 });
  assert.equal(g.get(2).rally, undefined); assert.equal(g.get(5).rally, undefined);
  assert.deepEqual(events.at(-1), ['order', { type: 'move', count: 1, x: 12, z: 13 }]);
  const count = events.length;
  assert.equal(g.executeAction(0, { kind: 'rally', ids: [1], position: point }, false), true);
  assert.equal(events.length, count);
});

test('recruitment and cancellations use the actor account and existing economic rules', () => {
  const { g } = fixture(), other = json(g.account(0)), initial = json(g.account(3));
  assert.equal(g.executeAction(3, { kind: 'train', unit: 'worker' }), true);
  assert.equal(g.get(4).queue.length, 1); assert.equal(g.get(1).queue.length, 0);
  assert.ok(g.account(3).alloy < initial.alloy); assert.deepEqual(json(g.account(0)), other);
  assert.equal(g.executeAction(0, { kind: 'cancelQueue', id: 4, index: 0 }), false);
  assert.equal(g.executeAction(3, { kind: 'cancelQueue', id: 4, index: 1 }), false);
  assert.equal(g.executeAction(3, { kind: 'cancelQueue', id: 4, index: 0 }), true);
  assert.deepEqual(json(g.account(3)), initial);
  assert.equal(g.executeAction(3, { kind: 'sell', id: 4 }), false, 'last HQ is protected');
  g.get(4).progress = .1; g.get(4).paid = { cost: 100, gas: 20 };
  assert.equal(g.executeAction(0, { kind: 'cancelConstruction', id: 4 }), false);
  assert.equal(g.executeAction(3, { kind: 'cancelConstruction', id: 4 }), true);
  assert.equal(g.account(3).alloy, initial.alloy + 75); assert.equal(g.account(3).gas, initial.gas + 15);
  assert.equal(g.executeAction(3, { kind: 'cancelConstruction', id: 4 }), false, 'no double refund');
});

test('build, ability and repair actions forward copied data and the actor to shared validators', () => {
  const { g } = fixture(), calls = [];
  for (const name of ['build', 'ability', 'toggleBuildingRepair']) g[name] = (...args) => { calls.push([name, ...args]); return false; };
  const p = { x: 1, z: 2 }, selected = [7];
  assert.equal(g.executeAction(2, { kind: 'build', building: 'depot', position: p, selected }), false);
  assert.equal(g.executeAction(3, { kind: 'ability', ability: 'scan', position: p }), false);
  assert.equal(g.executeAction(1, { kind: 'toggleRepair', id: 2 }), false);
  p.x = 99; selected[0] = 8;
  assert.deepEqual(json(calls), [
    ['build', 'depot', { x: 1, z: 2 }, [7], 2], ['ability', 'scan', { x: 1, z: 2 }, 3], ['toggleBuildingRepair', 2, 1]
  ]);
});
