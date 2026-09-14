const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { BATTLEFIELD_SCRIPTS, RENDERER_SCRIPTS, SIMULATION_SCRIPTS, loadScripts } = require('./game-scripts.cjs');
const { createRendererStub } = require('./renderer-stub.cjs');
const { populateBase } = require('./populated-battle.cjs');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const context = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'world-view', 'effects', ...SIMULATION_SCRIPTS], { globals: { structuredClone } });
vm.runInContext('Math.random = () => { throw Error("Unseeded presentation randomness"); }', context);
const { Battlefield, BattlefieldView, MeridianGame } = vm.runInContext('({Battlefield, BattlefieldView, MeridianGame})', context);

function worldSample(seed, map) {
  const renderer = createRendererStub({ record: true });
  let terrain;
  renderer.geometry = (name, data) => { if (name === 'terrain') terrain = digest(data); };
  const world = new Battlefield(seed, map);
  new BattlefieldView(renderer).sync(world);
  const entities = [
    { kind: 'building', team: 0, x: -51, z: 49, size: 5, hp: 100 },
    { kind: 'unit', team: 0, x: 10, z: 15, hp: 20, vision: 12 },
    { kind: 'unit', team: 1, x: 60, z: -60, hp: 20 }
  ];
  world.rebuild(entities);
  const paths = [[-51, 49, 50, -51], [0, 0, -51, 49], [88, 88, -100, -100]]
    .map(args => world.path(...args));
  world.reveal(entities, [{ x: -20, z: -10, r: 7 }]);
  world.reveal([]);
  // Preserve the fixture serializer key, not a runtime alias, after the generic feature rename.
  // Normalize only the commissioned Desert mesh substitution/pebble grounding for the old
  // placement digest. Independent terrain tests compare all other descriptors and CPU grids.
  const rockNames = { desertBoulder: 'rockBoulder', desertCrag: 'rockCrag', desertRidge: 'rockRidge', desertShelf: 'rockShelf' };
  // New, independently checked foot dressing is outside the historical placement contract.
  const calls = renderer.calls.filter(call => !['desertTalus', 'desertFlake'].includes(call[0])).map(call => {
    if (rockNames[call[0]]) return [rockNames[call[0]], ...call.slice(1)];
    if (call[0] === 'desertPebble' || call[0] === 'desertChip') {
      const old = call.slice(0, 14); old[0] = call[0] === 'desertPebble' ? 'octa' : 'box'; old[2] = call[4] * .27;
      return old;
    }
    return call;
  });
  return { terrain, placements: digest({ calls, massifs: world.renderData.features }), navigation: digest({ paths,
    nearest: world.nearest(-51, 49), blocked: Array.from(world.blocked),
    visible: Array.from(world.visible), explored: Array.from(world.explored), fog: Array.from(world.fogPixels) }) };
}

function effectSample(kind) {
  const game = new MeridianGame({ upgrades: {} });
  game.start({ seed: 1409, map: 'desert', faction: 0 });
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
    game.s.teams[0].energy = 1000; game.ability('drop', { x: -45, z: 45 });
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
