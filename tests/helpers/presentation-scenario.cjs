const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { BATTLEFIELD_SCRIPTS, RENDERER_SCRIPTS, loadScripts } = require('./game-scripts.cjs');
const { createRendererStub } = require('./renderer-stub.cjs');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function worldSample(seed, map) {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'world-view']);
  vm.runInContext('Math.random = () => { throw Error("Unseeded presentation randomness"); }', context);
  const { Battlefield, BattlefieldView } = vm.runInContext('({Battlefield, BattlefieldView})', context);
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
    .map(args => world.path(...args).points);
  world.reveal(entities, [{ x: -20, z: -10, r: 7 }]);
  world.reveal([]);
  return { terrain, placements: digest({ calls: renderer.calls, features: world.renderData.features,
    reliefs: world.renderData.geometries.filter(d => d.relief).map(d => ({ mesh: d.mesh, relief: digest(Array.from(d.relief.heights)) })) }), navigation: digest({ paths,
    nearest: world.nearest(-51, 49), blocked: Array.from(world.blocked),
    visible: Array.from(world.visible), explored: Array.from(world.explored), fog: Array.from(world.fogPixels) }) };
}
module.exports = { worldSample };
