const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { BATTLEFIELD_SCRIPTS, RENDERER_SCRIPTS, SIMULATION_SCRIPTS, loadScripts } = require('./game-scripts.cjs');
const { createRendererStub } = require('./renderer-stub.cjs');
const { populateBase } = require('./populated-battle.cjs');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const context = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'world-view', 'effects', ...SIMULATION_SCRIPTS], { globals: { structuredClone } });
vm.runInContext('Math.random = () => { throw Error("Unseeded presentation randomness"); }', context);
const { Battlefield, BattlefieldView, MeridianGame, BATTLEFIELDS, DESERT_BATTLEFIELD } =
  vm.runInContext('({Battlefield, BattlefieldView, MeridianGame, BATTLEFIELDS, DESERT_BATTLEFIELD})', context);
// Historical ground/effect fixtures describe the uncomposed, flat playable recipe.
// Keep those inputs exact; composed worlds are sampled separately, never normalized back.
function originalDesert(run) {
  const current=BATTLEFIELDS.desert;
  try {BATTLEFIELDS.desert=DESERT_BATTLEFIELD;return run();}
  finally {BATTLEFIELDS.desert=current;}
}
function worldSample(seed, map, uncomposed = false) {
  const renderer = createRendererStub({ record: true });
  let terrain;
  renderer.geometry = (name, data) => { if (name === 'terrain') terrain = digest(data); };
  const world = uncomposed ? originalDesert(()=>new Battlefield(seed,map)) : new Battlefield(seed, map);
  new BattlefieldView(renderer).sync(world);
  const entities = [
    { kind: 'building', team: 0, x: -51, z: 49, size: 5, hp: 100 },
    { kind: 'unit', team: 0, x: 10, z: 15, hp: 20, vision: 12 },
    { kind: 'unit', team: 1, x: 60, z: -60, hp: 20 }
  ];
  world.rebuild(entities);
  const paths = [[-51, 49, 50, -51], [0, 0, -51, 49], [88, 88, -100, -100]]
    .map(args => world.path(...args).points);
  world.reveal(entities, [{ x: -20, z: -10, r: 7 }]);
  world.reveal([]);
  // Compare the actual new landscape, without translating it back to old mesh names.
  return { terrain, placements: digest({ calls: renderer.calls, features: world.renderData.features,
    reliefs: world.renderData.geometries.filter(d => d.relief).map(d => ({ mesh: d.mesh, relief: digest(Array.from(d.relief.heights)) })) }), navigation: digest({ paths,
    nearest: world.nearest(-51, 49), blocked: Array.from(world.blocked),
    visible: Array.from(world.visible), explored: Array.from(world.explored), fog: Array.from(world.fogPixels) }) };
}

function effectSample(kind) {
  const game = new MeridianGame({ upgrades: {} });
  originalDesert(()=>game.start({ seed: 1409, map: 'desert', faction: 0 }));
  populateBase(game);
  // Fixed effect-test RNG entry point from presentation-v1, independent of battle loadout.
  game.random = vm.runInContext('seeded(1486)', context);
  for (let i = 0; i < 104; i++) game.random();
  game.world.visible.fill(255);
  const player = type => game.alive(e => e.team === 0 && e.type === type)[0];
  if (kind === 'explosion') {
    for (const size of [.2, 1, 7]) game.effects.explosion(3, 4, size);
  } else if (kind === 'cap-bounce') {
    for (let i = 0; i < 25; i++) game.effects.explosion(i, -i, 7);
    const particle = game.effects.fx.find(f => f.type === 'particle');
    particle.y = .01; particle.vy = -10;
  } else if (kind === 'damage') {
    const target = player('hero');
    for (let i = 0; i < 40; i++) { target.hp = target.maxHp; game.damage(target, 30, null); }
  } else if (kind === 'workers') {
    const worker = player('worker'), hq = player('hq');
    hq.hp -= 200; worker.x = hq.x; worker.z = hq.z;
    worker.order = { type: 'build', id: hq.id };
    for (let i = 0; i < 20; i++) { game.worker(worker, .05); game.effects.tick(.05); }
    const resource = game.alive(e => e.type === 'crystal')[0];
    worker.x = resource.x; worker.z = resource.z; worker.order = { type: 'mine', id: resource.id };
    for (let i = 0; i < 40; i++) { game.worker(worker, .05); game.effects.tick(.05); }
  } else if (kind === 'heal-drop') {
    const target = player('rifle'); target.hp -= 40;
    // Fixed emitter position isolates effect behavior from spawn-spacing tests.
    const medic = game.spawn('unit', 'medic', target.x, target.z, 0, 0); medic.cd = 0;
    game.medic(medic, .05);
    game.s.parties[0].account.energy = 1000; game.ability('drop', { x: -45, z: 45 });
  } else throw Error('Unknown effect case: ' + kind);
  const before = digest({ fx: game.effects.fx, floats: game.effects.floats });
  game.effects.tick(.05);
  const after = digest({ fx: game.effects.fx, floats: game.effects.floats });
  const counts = { fx: game.effects.fx.length, floats: game.effects.floats.length };
  const nextRandom = Array.from({ length: 5 }, () => game.random());
  game.effects.tick(5);
  return { before, after, counts, nextRandom, expired: digest({ fx: game.effects.fx, floats: game.effects.floats }) };
}
module.exports = { worldSample, effectSample, digest };
