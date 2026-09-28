// Pure effect/combat state contracts: no generated battlefield, simulation steps or AI runs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts, SIMULATION_SCRIPTS } = require('./helpers/game-scripts.cjs');
const context = loadScripts(['core', 'content', 'effects', ...SIMULATION_SCRIPTS]);
const { MeridianGame, seeded } = vm.runInContext('({ MeridianGame, seeded })', context);
vm.runInContext('Math.random = () => { throw Error("Unexpected unseeded randomness"); }', context);
const json = value => JSON.parse(JSON.stringify(value));

function fixture(kind, visible) {
  const game = new MeridianGame({ upgrades: {} });
  const medic = { id: 1, team: 0, kind: 'unit', type: 'medic', x: 0, z: 0,
    hp: 100, maxHp: 100, cd: 0, order: { type: 'idle' } };
  const patient = { id: 2, team: 0, kind: 'unit', type: 'rifle', x: 1, z: 0, hp: 50, maxHp: 100 };
  const victim = { id: 3, team: 1, faction: 0, kind: 'unit', type: 'rifle', x: 5, z: 5,
    hp: 30, maxHp: 100, shield: 0 };
  game.s = { rules: kind === 'scenario' ? { kind, hostilities: [[false, true], [true, false]], duration: 1 } : { kind },
    entities: [medic, patient, victim], fields: [], time: 1,
    stats: { damage: 0, kills: 0, lost: 0 }, triggers: {} };
  game.resetRandom(1409);
  game.visible = () => visible;
  game.near = (x, z, radius, predicate) => game.s.entities.filter(predicate);
  return { game, medic, patient, victim };
}

test('scenario visibility changes cosmetic output, not damage, healing, cooldown or simulation RNG', () => {
  const observed = fixture('scenario', true), hidden = fixture('scenario', false);
  for (const { game, medic, victim } of [observed, hidden]) {
    game.damage(victim, 40, null);
    game.medic(medic, .1);
  }
  assert.ok(observed.game.effects.fx.length > 0);
  assert.equal(hidden.game.effects.fx.length, 0);
  assert.deepEqual(json(observed.game.s), json(hidden.game.s));
  assert.equal(hidden.medic.cd, .5);
  const reference = seeded(1409 + 77);
  for (let i = 0; i < 12; i++) {
    const expected = reference();
    assert.equal(observed.game.random(), expected);
    assert.equal(hidden.game.random(), expected);
  }
});

test('all random-consuming scenario effect producers leave the simulation stream untouched', () => {
  const { game, medic, patient } = fixture('scenario', true), effects = game.effects;
  let simulationDraws = 0;
  game.random = () => { simulationDraws++; return .5; };
  effects.explosion(0, 0, 2);
  effects.construction(medic, { ...patient, size: 4 }, 1);
  effects.mining(medic, patient, 1, () => true);
  effects.mining(medic, patient, 1, () => false);
  effects.tick(.05);
  assert.equal(simulationDraws, 0);
  assert.ok(effects.fx.length > 0);
});

test('effect provider follows mode and reset without retaining an earlier battle stream', () => {
  const { game } = fixture('scenario', true), effects = game.effects;
  effects.explosion(2, 3);
  const first = json(effects.fx);
  game.resetRandom(1409); effects.reset(); effects.explosion(2, 3);
  assert.deepEqual(json(effects.fx), first, 'cosmetic sequence restarts with the battle seed');
  let main = 0, cosmetic = 0;
  game.random = () => { main++; return .5; };
  game.cosmeticRandom = () => { cosmetic++; return .5; };
  effects.mining({}, {}, 0, () => false);
  assert.deepEqual([main, cosmetic], [0, 1]);
  game.s.rules = { kind: 'single-player', mission: {id:'hq-elimination'} };
  effects.mining({}, {}, 0, () => false);
  assert.deepEqual([main, cosmetic], [1, 1]);
  game.s.rules = { kind: 'scenario', hostilities: [], duration: 1 };
  effects.mining({}, {}, 0, () => false);
  assert.deepEqual([main, cosmetic], [1, 2]);
});

test('single-player retains its existing visibility gates and explosion RNG consumption', () => {
  const observed = fixture('single-player', true), hidden = fixture('single-player', false);
  for (const { game, medic, victim } of [observed, hidden]) {
    game.damage(victim, 40, null);
    game.medic(medic, .1);
  }
  assert.equal(observed.medic.cd, .5);
  assert.equal(hidden.medic.cd, 0);
  assert.equal(observed.patient.hp, hidden.patient.hp);
  const reference = seeded(1409 + 77);
  assert.equal(hidden.game.random(), reference());
  // Existing unit explosion: 12 particles × 6 draws, plus 4 smoke particles × 3 draws.
  const afterExplosion = seeded(1409 + 77);
  for (let i = 0; i < 84; i++) afterExplosion();
  assert.equal(observed.game.random(), afterExplosion());
});
