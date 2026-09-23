// Local view contracts on synthetic state: no terrain generation, simulation ticks or AI runs.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts, SIMULATION_SCRIPTS } = require('./helpers/game-scripts.cjs');
const context = loadScripts(['core', 'content', 'world', 'effects', ...SIMULATION_SCRIPTS]);
const { MeridianGame, Battlefield, seeded } = vm.runInContext('({ MeridianGame, Battlefield, seeded })', context);
vm.runInContext('Math.random = () => { throw Error("Unexpected unseeded randomness"); }', context);
const json = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const events = [], game = new MeridianGame({ upgrades: {} }, (...event) => events.push(json(event)));
  const world = Object.assign(Object.create(Battlefield.prototype), {
    viewTeam: 0, fogVersion: 1, fogPixels: new Uint8Array([255]), idx: () => 0,
    sight: Array.from({ length: 4 }, (_, team) => ({ visible: new Uint8Array([team === 0 ? 255 : 0]), explored: new Uint8Array([team === 2 ? 1 : 0]) }))
  });
  world.visible = world.sight[0].visible; world.explored = world.sight[0].explored;
  game.world = world;
  const medic = { id: 1, team: 0, kind: 'unit', type: 'medic', x: 0, z: 0, hp: 100, maxHp: 100, cd: 0, order: { type: 'idle' } };
  const patient = { id: 2, team: 0, kind: 'unit', type: 'rifle', x: 1, z: 0, hp: 50, maxHp: 100 };
  const victim = { id: 3, team: 1, faction: 0, kind: 'unit', type: 'rifle', x: 5, z: 5, hp: 30, maxHp: 100, shield: 0 };
  const base = { id: 4, team: 2, kind: 'building', type: 'hq', x: 0, z: 0, hp: 100, maxHp: 100, shield: 0 };
  game.s = { rules: { kind: 'scenario', hostilities: Array.from({ length: 4 }, (_, a) => Array.from({ length: 4 }, (_, b) => a !== b)), duration: 1 },
    parties: Array.from({ length: 4 }, (_, id) => ({ id, controller: { kind: 'human' } })),
    entities: [medic, patient, victim, base], fields: [], time: 1,
    stats: { damage: 0, kills: 0, lost: 0 }, triggers: {} };
  game.near = (x, z, radius, predicate) => game.s.entities.filter(predicate);
  game.resetRandom(1409);
  return { game, world, events, medic, patient, victim, base };
}

test('scenario view switching aliases only the selected sight, refreshes fog, and clears old local effects', () => {
  const { game, world, events } = fixture(), before = json(game.s), sight = json(world.sight);
  game.effects.explosion(0, 0); game.effects.damageNumber(game.s.entities[0], 40);
  let simDraws = 0, cosmeticDraws = 0;
  game.random = () => { simDraws++; return .5; }; game.cosmeticRandom = () => { cosmeticDraws++; return .5; };
  assert.equal(game.setPerspective(2), true);
  assert.equal(game.localTeam, 2);
  assert.strictEqual(world.visible, world.sight[2].visible); assert.strictEqual(world.explored, world.sight[2].explored);
  assert.deepEqual(Array.from(world.fogPixels), [80]); assert.equal(world.fogVersion, 2);
  assert.deepEqual(json(world.sight), sight); assert.deepEqual(json(game.s), before);
  assert.equal(game.effects.fx.length, 0); assert.equal(game.effects.floats.length, 0);
  assert.deepEqual([simDraws, cosmeticDraws], [0, 0]);
  assert.equal(game.visible({ team: 2, x: 0, z: 0 }), true);
  assert.equal(game.visible({ team: 0, x: 0, z: 0 }), false);
  assert.equal(game.observed({ team: -1, x: 0, z: 0 }), true, 'resource exploration belongs to the view');
  game.notify(0, 'toast', 'other'); game.notify(2, 'toast', 'own');
  assert.deepEqual(events, [['toast', 'own']]);
  assert.equal(game.setPerspective(2), true); assert.equal(world.fogVersion, 2);
  assert.equal(game.setPerspective(3), true); assert.deepEqual(Array.from(world.fogPixels), [0]);
  assert.equal(game.observed({ team: -1, x: 0, z: 0 }), false);
  assert.equal(game.setPerspective(0), true); assert.deepEqual(Array.from(world.fogPixels), [255]);
});

test('invalid, missing and single-player perspective requests cannot change the view', () => {
  const { game, world } = fixture();
  for (const team of [-1, 4, .5, NaN, '2']) assert.equal(game.setPerspective(team), false);
  assert.equal(world.viewTeam, 0); assert.equal(world.fogVersion, 1);
  game.s.rules = { kind: 'single-player' };
  assert.equal(game.setPerspective(2), false); assert.equal(game.setPerspective(0), true);
  game.s = null; assert.equal(game.setPerspective(0), false);
  assert.equal(world.viewTeam, 0);
});

test('real perspective changes preserve combat state, per-party alert clocks and simulation RNG', () => {
  const a = fixture(), b = fixture();
  b.game.setPerspective(2);
  for (const { game, medic, victim, base } of [a, b]) {
    game.damage(victim, 40, null);
    game.medic(medic, .1);
    game.damage(base, 10, null);
  }
  assert.deepEqual(json(a.game.s), json(b.game.s));
  assert.equal(a.game.s.triggers['baseAlert:2'], 1);
  assert.equal(a.events.some(e => e[0] === 'alert' && e[1].text === 'Command center under attack!'), false);
  assert.equal(b.events.some(e => e[0] === 'alert' && e[1].text === 'Command center under attack!'), true);
  const reference = seeded(1409 + 77);
  for (let i = 0; i < 12; i++) { const expected = reference(); assert.equal(a.game.random(), expected); assert.equal(b.game.random(), expected); }
});
