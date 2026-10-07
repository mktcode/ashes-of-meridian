// Command ability contracts on synthetic state: no generated terrain, AI or long simulation runs.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts, BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS } = require('./helpers/game-scripts.cjs');
const context = loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'effects', ...SIMULATION_SCRIPTS]);
const { MeridianGame, singlePlayerParties, abilityStats } = vm.runInContext(
  '({ MeridianGame, singlePlayerParties, abilityStats })', context);
const json = value => JSON.parse(JSON.stringify(value));

function entity(id, team, type, x, z, kind = 'unit') {
  return { id, team, faction: 0, kind, type, x, z, hp: 500, maxHp: 500, shield: 0, maxShield: 0,
    progress: 1, queue: [], size: kind === 'building' ? 4 : 1, cd: 0, lastHit: -100,
    order: { type: 'idle' }, walk: 0 };
}

function fixture(upgrades = {}, abilities = ['disruption', 'bulwark', 'surge', 'recall']) {
  const game = Object.create(MeridianGame.prototype), events = [], drops = [];
  const parties = singlePlayerParties({}, { upgrades, faction: 0, enemies: [0], abilities });
  const ownHq = entity(1, 0, 'hq', 0, 0, 'building'), own = entity(2, 0, 'rifle', 5, 0),
    worker = entity(3, 0, 'worker', 4, 0), enemy = entity(4, 1, 'rifle', 6, 0),
    turret = entity(5, 1, 'turret', 6, 1, 'building');
  game.s = { parties, rules: { kind: 'single-player', mission: {id:'hq-elimination'} }, result: null, stopped: false, time: 0,
    entities: [ownHq, own, worker, enemy, turret], fields: [], recalls: [], scans: [], strikes: [],
    stats: { damage: 0, kills: 0, lost: 0 }, triggers: {} };
  game.ids = new Map(game.s.entities.map(e => [e.id, e]));
  game.world = { viewTeam: 0, extent: 90, idx: () => 0,
    sight: Array.from({ length: 2 }, () => ({ visible: new Uint8Array([255]), explored: new Uint8Array([1]) })) };
  game.emit = (...event) => events.push(json(event));
  game.effects = { damageNumber() {}, drop(point) { drops.push({ ...point }); } };
  game.near = (x, z, radius, predicate = () => true) => game.s.entities.filter(e => e.hp > 0 &&
    Math.hypot(e.x - x, e.z - z) < radius && predicate(e));
  game.unitPosition = (body, reserved) => ({ x: body.x + reserved.length * 2, z: body.z + 5 });
  game.setOrder = (unit, order) => { unit.order = { ...order }; };
  game.account(0).energy = 500;
  return { game, events, drops, ownHq, own, worker, enemy, turret };
}

test('command ranks change only their documented ability statistics', () => {
  assert.deepEqual(json(abilityStats('orbital', 3)), {
    name: 'Orbital strike', icon: 'orbital', energy: 85, cd: 40,
    desc: 'Calls down a faction-specific orbital strike. Requires a completed vehicle factory and current vision.',
    rank: 3, damageMultiplier: 1.12, strikeDelay: 1.8
  });
  assert.equal(abilityStats('repair', 0).instantHull, 180);
  assert.deepEqual(json([
    abilityStats('repair', 3).instantHull, abilityStats('repair', 3).healing, abilityStats('repair', 3).radius,
    abilityStats('scan', 3).duration, abilityStats('scan', 3).scanRadius, abilityStats('scan', 3).energy,
    abilityStats('drop', 3).unitTypes, abilityStats('drop', 3).landingProtection, abilityStats('drop', 3).cd,
    abilityStats('disruption', 3).moveMultiplier, abilityStats('disruption', 3).reloadMultiplier, abilityStats('disruption', 3).duration,
    abilityStats('bulwark', 3).radius, abilityStats('bulwark', 3).damageReduction, abilityStats('bulwark', 3).duration,
    abilityStats('surge', 3).duration, abilityStats('surge', 3).moveMultiplier, abilityStats('surge', 3).cd,
    abilityStats('recall', 3).recallSupply, abilityStats('recall', 3).recallDelay, abilityStats('recall', 3).cd
  ]), [230, 15, 14, 28, 38, 18, ['rifle', 'rifle', 'rifle', 'rifle', 'medic'], 12, 62,
    .55, .8, 13, 12, .4, 13, 13, 1.3, 36, 16, 2, 48]);
});

test('simulation rejects unequipped abilities before spending energy or cooldown', () => {
  const { game, events } = fixture({}, ['disruption', 'bulwark', 'surge', 'recall']);
  const before = json(game.account(0));
  assert.equal(game.ability('scan', { x: 2, z: 2 }), false);
  assert.deepEqual(json(game.account(0)), before);
  assert.equal(game.s.scans.length, 0);
  assert.match(events.at(-1)[1], /not equipped/i);
});

test('fields apply strongest matching effects without stacking and preserve excluded targets', () => {
  const { game, own, worker, enemy, turret } = fixture({ disruption: 2, bulwark: 2, surge: 2 });
  const baseEnemySpeed = game.movementSpeed(enemy), baseOwnSpeed = game.movementSpeed(own);
  assert.equal(game.ability('disruption', enemy), true);
  assert.equal(game.movementSpeed(enemy), baseEnemySpeed * .55);
  assert.equal(game.weaponRate(enemy), .8);
  assert.equal(game.weaponRate(turret), 1, 'disruption affects enemy units, not buildings');

  assert.equal(game.ability('surge', own), true);
  assert.equal(game.movementSpeed(own), baseOwnSpeed * 1.3);
  assert.equal(game.weaponRate(own), 1.3);
  assert.equal(game.movementSpeed(worker), game.movementSpeed({ ...worker, x: 50 }), 'workers do not receive surge');

  assert.equal(game.ability('bulwark', own), true);
  const hp = own.hp;
  game.damage(own, 100, { team: 1 }, true);
  assert.equal(own.hp, hp - 60);
  game.account(0).abilities.bulwark = 0;
  assert.equal(game.ability('bulwark', own), true);
  const after = own.hp;
  game.damage(own, 100, { team: 1 }, true);
  assert.equal(own.hp, after - 60, 'overlapping bulwarks use the strongest reduction once');
});

test('recall snapshots eligible supply and moves only living placeable marked ground troops', () => {
  const { game, ownHq, worker, drops } = fixture({ recall: 1 });
  game.s.entities = [ownHq, worker];
  for (let i = 0; i < 9; i++) game.s.entities.push(entity(10 + i, 0, 'rifle', 1 + i * .6, 0));
  game.s.entities.push(entity(30, 0, 'air', 2, 0));
  game.ids = new Map(game.s.entities.map(e => [e.id, e]));
  assert.equal(game.ability('recall', { x: 4, z: 0 }), true);
  const recall = game.s.recalls[0];
  assert.equal(recall.ids.length, 8, 'rank one capacity recalls at most 16 rifle supply');
  assert.equal(recall.ids.includes(worker.id), false);
  assert.equal(recall.ids.includes(30), false);

  const stranded = game.get(recall.ids[1]), old = { x: stranded.x, z: stranded.z };
  game.unitPosition = (body, reserved) => body.id === stranded.id ? null :
    ({ x: ownHq.x + reserved.length * 2, z: ownHq.z + 5 });
  game.s.time = recall.at;
  game.resolveRecalls();
  assert.deepEqual({ x: stranded.x, z: stranded.z }, old, 'unplaceable marked unit remains at origin');
  const moved = recall.ids.filter(id => id !== stranded.id).map(id => game.get(id));
  assert.ok(moved.every(unit => unit.z === 5 && unit.order.type === 'idle'));
  assert.equal(new Set(moved.map(unit => `${unit.x},${unit.z}`)).size, moved.length);
  assert.equal(drops.length, moved.length);
  assert.equal(game.s.recalls.length, 0);
});
