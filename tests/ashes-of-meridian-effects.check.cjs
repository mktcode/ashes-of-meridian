// Effect state on flat ground; no generated map or autonomous game loop.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts, SIMULATION_SCRIPTS } = require('./helpers/game-scripts.cjs');
const reference = require('./fixtures/effect-rng-v1.json');
function fixture() {
  const context = loadScripts(['core', 'content', 'world', 'effects', ...SIMULATION_SCRIPTS]);
  const api = vm.runInContext('({MeridianEffects, MeridianGame, singlePlayerParties, seeded})', context);
  vm.runInContext('Math.random = () => { throw Error("Unseeded effect randomness"); };', context);
  const random = api.seeded(reference.seed);
  for (let i = 0; i < reference.reservedDraws; i++) random();
  return { ...api, effects: new api.MeridianEffects(random) };
}
function checkRandom(effects, kind) {
  assert.deepEqual(Array.from({ length: 5 }, () => effects.random()), reference.nextRandom[kind]);
}
function checkExpiry(effects) {
  effects.tick(5);
  assert.equal(effects.fx.length, 0);
  assert.equal(effects.floats.length, 0);
}

test('explosions emit bounded particles above the ground and expire without drawing RNG', () => {
  const { effects } = fixture();
  effects.groundHeight = () => 7;
  for (const size of [.2, 1, 7]) effects.explosion(3, 4, size);
  assert.equal(effects.fx.length, 57);
  assert.equal(effects.fx.filter(f => f.type === 'blast').length, 3);
  assert.equal(effects.fx.filter(f => f.type === 'smoke').length, 12);
  for (const f of effects.fx) {
    for (const value of Object.values(f)) if (typeof value === 'number') assert.ok(Number.isFinite(value));
    if (f.type === 'particle' || f.type === 'smoke') assert.ok(f.y > 7);
    assert.ok(f.life > 0 && f.life <= f.maxLife);
  }
  const particle = effects.fx.find(f => f.type === 'particle'), { x, y, z, vx, vy, vz, life } = particle;
  effects.tick(.05);
  assert.equal(particle.x, x + vx * .05);
  assert.equal(particle.y, y + vy * .05);
  assert.equal(particle.z, z + vz * .05);
  assert.equal(particle.life, life - .05);
  checkExpiry(effects);
  checkRandom(effects, 'explosion');
});

test('crowded explosions retain the effect cap and particles bounce off the current ground', () => {
  const { effects } = fixture();
  effects.groundHeight = () => 7;
  for (let i = 0; i < 25; i++) effects.explosion(i, -i, 7);
  assert.equal(effects.fx.length, 500);
  const particle = effects.fx.find(f => f.type === 'particle');
  Object.assign(particle, { y: 7.01, vy: -10 });
  const { vx, vz } = particle;
  effects.tick(.05);
  assert.equal(particle.y, 7.05);
  assert.equal(particle.vy, 2.65);
  assert.equal(particle.vx, vx * .8);
  assert.equal(particle.vz, vz * .8);
  checkExpiry(effects);
  checkRandom(effects, 'cap-bounce');
});

test('damage labels are capped, terrain-relative and expire without drawing RNG', () => {
  const { effects } = fixture();
  effects.groundHeight = () => 7;
  for (let i = 0; i < 40; i++) effects.damageNumber({ x: 3, z: 4, team: 0 }, 29.6);
  assert.equal(effects.floats.length, 35);
  assert.ok(effects.floats.every(f => f.text === '30' && f.y === 9.4));
  checkExpiry(effects);
  checkRandom(effects, 'damage');
});

test('construction and mining emit short-lived beams with the reserved RNG sequence', () => {
  const { effects } = fixture(), worker = { x: 0, z: 0, type: 'worker' }, target = { x: 3, z: 4, type: 'hq', size: 4 };
  let construction = 0, mining = 0;
  for (const [kind, count] of [['construction', 20], ['mining', 40]]) {
    for (let i = 0; i < count; i++) {
      const before = effects.fx.length;
      if (kind === 'construction') effects.construction(worker, target, .05);
      else effects.mining(worker, target, .05, () => true);
      if (effects.fx.length > before) {
        const beam = effects.fx.at(-1);
        assert.equal(beam.type, 'beam');
        assert.equal(beam.x, worker.x);
        assert.equal(beam.z, worker.z);
        if (kind === 'construction') construction++;
        else { mining++; assert.equal(beam.tx, target.x); assert.equal(beam.tz, target.z); }
      }
      effects.tick(.05);
    }
  }
  assert.ok(construction > 0 && mining > 0);
  effects.tick(.05);
  assert.equal(effects.fx.length, 0);
  checkRandom(effects, 'workers');
});

test('healing and a reinforcement command create their effects without terrain-generation dependencies', () => {
  const { effects, MeridianGame, singlePlayerParties } = fixture(), game = new MeridianGame({ upgrades: {} });
  // Only placement is injected: this test owns effect/RNG behavior, not navigation.
  game.unitPosition = p => ({ x: p.x, z: p.z });
  game.world = { extent: 90, idx: () => 0, nearest: (x, z) => ({ x, z }),
    sight: [{ explored: new Uint8Array([255]), visible: new Uint8Array([255]) }] };
  game.s = { time: 0, nextId: 1, rules: { kind: 'single-player', mission: { id: 'hq-elimination' } },
    parties: singlePlayerParties({}, { faction: 0, enemies: [0], abilities: ['drop'] }), entities: [], fields: [] };
  game.random = () => .5;
  game.spawnBuilding('hq', -10, 0, 0, 0);
  const patient = game.spawn('unit', 'rifle', 0, 0, 0, 0);
  patient.hp -= 40;
  game.random = effects.random;
  game.effects = effects;
  game.visible = () => true;
  game.near = (x, z, r, predicate) => game.s.entities.filter(e => Math.hypot(e.x - x, e.z - z) < r && predicate(e));
  const medic = game.spawn('unit', 'medic', 1, 0, 0, 0);
  medic.cd = 0;
  const hp = patient.hp;
  game.medic(medic, .05);
  assert.ok(patient.hp > hp);
  game.account().energy = 1000;
  assert.equal(game.ability('drop', { x: 4, z: 0 }), true);
  assert.equal(effects.fx.filter(f => f.type === 'beam').length, 1);
  assert.equal(effects.fx.filter(f => f.type === 'drop').length, 4);
  assert.equal(game.alive(e => e.type === 'rifle').length, 5);
  checkExpiry(effects);
  checkRandom(effects, 'heal-drop');
});
