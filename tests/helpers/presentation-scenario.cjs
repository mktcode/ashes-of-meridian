const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { loadScripts } = require('./game-scripts.cjs');
const { createRendererStub } = require('./renderer-stub.cjs');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const context = loadScripts(['core', 'renderer', 'content', 'world', 'world-view', 'simulation'], { globals: { structuredClone } });
vm.runInContext('Math.random = () => { throw Error("Unseeded presentation randomness"); }', context);
const { Battlefield, BattlefieldView, MeridianGame, CAMPAIGN } = vm.runInContext('({Battlefield, BattlefieldView, MeridianGame, CAMPAIGN})', context);

function worldSample(seed, biome) {
  const renderer = createRendererStub({ record: true });
  let terrain;
  renderer.geometry = (name, data) => { if (name === 'terrain') terrain = digest(data); };
  const world = new Battlefield(seed, biome);
  new BattlefieldView(renderer).sync(world);
  const entities = [
    { kind: 'building', team: 0, x: -51, z: 49, size: 5, hp: 100 },
    { kind: 'unit', team: 2, x: 10, z: 15, hp: 20, vision: 12 },
    { kind: 'unit', team: 1, x: 60, z: -60, hp: 20 }
  ];
  world.rebuild(entities);
  const paths = [[-51, 49, 50, -51], [0, 0, -51, 49], [88, 88, -100, -100]]
    .map(args => world.path(...args));
  world.reveal(entities, [{ x: -20, z: -10, r: 7 }]);
  world.reveal([]);
  return { terrain, placements: digest(renderer.calls), navigation: digest({ paths,
    nearest: world.nearest(-51, 49), blocked: Array.from(world.blocked),
    visible: Array.from(world.visible), explored: Array.from(world.explored), fog: Array.from(world.fogPixels) }) };
}

const effectCases = ['explosion', 'cap-bounce', 'damage', 'weapons', 'workers', 'heal-drop'];
function effectSample(kind) {
  const game = new MeridianGame({ upgrades: {} });
  game.start(0, { seed: 1409, difficulty: 'standard', faction: 0 });
  game.world.visible.fill(255);
  const player = type => game.alive(e => e.team === 0 && e.type === type)[0];
  if (kind === 'explosion') {
    for (const size of [.2, 1, 7]) game.explosion(3, 4, size);
  } else if (kind === 'cap-bounce') {
    for (let i = 0; i < 25; i++) game.explosion(i, -i, 7);
    const particle = game.fx.find(f => f.type === 'particle');
    particle.y = .01; particle.vy = -10;
  } else if (kind === 'damage') {
    const target = player('hero');
    for (let i = 0; i < 40; i++) { target.hp = target.maxHp; game.damage(target, 30, null); }
  } else if (kind === 'weapons') {
    const target = game.alive(e => e.team === 1 && e.kind === 'building')[0];
    target.hp = 100000;
    for (const [type, faction] of [['rifle', 0], ['tank', 1], ['rifle', 2], ['artillery', 0], ['avatar', 2]]) {
      const unit = game.spawnUnit(type, target.x - 10, target.z, 0, faction);
      game.fire(unit, target);
    }
  } else if (kind === 'workers') {
    const worker = player('worker'), hq = player('hq');
    hq.hp -= 200; worker.x = hq.x; worker.z = hq.z;
    worker.order = { type: 'build', id: hq.id };
    for (let i = 0; i < 20; i++) { game.worker(worker, .05); game.tickEffects(.05); }
    const resource = game.alive(e => e.type === 'crystal')[0];
    worker.x = resource.x; worker.z = resource.z; worker.order = { type: 'mine', id: resource.id };
    for (let i = 0; i < 40; i++) { game.worker(worker, .05); game.tickEffects(.05); }
  } else if (kind === 'heal-drop') {
    const target = player('rifle'); target.hp -= 40;
    const medic = game.spawnUnit('medic', target.x, target.z, 0, 0); medic.cd = 0;
    game.medic(medic, .05);
    game.s.energy = 1000; game.ability('drop', { x: -45, z: 45 });
  } else throw Error('Unknown effect case: ' + kind);
  const before = digest({ fx: game.fx, floats: game.floats });
  game.tickEffects(.05);
  const after = digest({ fx: game.fx, floats: game.floats });
  const counts = { fx: game.fx.length, floats: game.floats.length };
  const state = digest(game.snapshot());
  const nextRandom = Array.from({ length: 5 }, () => game.random());
  game.tickEffects(5);
  return { before, after, counts, state, nextRandom, expired: digest({ fx: game.fx, floats: game.floats }) };
}
module.exports = { worldSample, effectSample, effectCases, CAMPAIGN, digest };
