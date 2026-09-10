// Fixed references recorded once from 97bfda6 before world/effect decoupling.
const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/presentation-v1.json');
const { worldSample, effectSample } = require('./helpers/presentation-scenario.cjs');
const vm = require('node:vm');
const { loadScripts } = require('./helpers/game-scripts.cjs');
const { createRendererStub } = require('./helpers/renderer-stub.cjs');
for (const { seed, biome, ...expected } of fixture.worlds) {
  test(`world presentation/navigation reference: ${seed} (${biome})`, () => {
    assert.deepEqual(worldSample(seed, biome), expected);
  });
}
test('world and simulation start, step and restore without renderer, geometry or browser globals', () => {
  const context = loadScripts(['core', 'content', 'world', 'simulation'], { globals: { structuredClone } });
  vm.runInContext('Math.random = () => { throw Error("Unseeded randomness"); }', context);
  const Game = vm.runInContext('MeridianGame', context), game = new Game({ upgrades: {} });
  game.start(0, { seed: 1409, difficulty: 'standard', faction: 0 });
  assert.equal(game.s.alloy, 470);
  assert.equal('R' in game, false); assert.equal('R' in game.world, false);
  for (let i = 0; i < 1000; i++) { game.step(.05); game.tickEffects(.05); }
  const saved = game.snapshot(); game.restore(saved);
  assert.equal(game.s.time, saved.time); assert.ok(game.s.stats.gathered > 0);
  assert.ok(game.world.fogPixels.includes(255));
  assert.equal(vm.runInContext('typeof geom + ":" + typeof MAT + ":" + typeof document', context), 'undefined:undefined:undefined');
});

test('world view uploads only changed layout/fog and does not mutate CPU data', () => {
  const context = loadScripts(['core', 'renderer', 'content', 'world', 'world-view']);
  const { Battlefield, BattlefieldView } = vm.runInContext('({Battlefield, BattlefieldView})', context);
  const world = new Battlefield(1409, 'rust'), renderer = createRendererStub();
  let meshes = 0, fogs = 0;
  renderer.geometry = () => meshes++;
  renderer.fog = () => fogs++;
  const view = new BattlefieldView(renderer), before = JSON.stringify(world.renderData);
  view.sync(world, false); view.sync(world, false);
  assert.equal(meshes, 1); assert.equal(fogs, 0); assert.equal(renderer.fogOn, false);
  world.reveal([]); view.sync(world); view.sync(world);
  assert.equal(meshes, 1); assert.equal(fogs, 1); assert.equal(renderer.fogOn, true);
  assert.equal(JSON.stringify(world.renderData), before);
  view.sync(new Battlefield(1409, 'rust'));
  assert.equal(meshes, 2);
});

for (const [kind, expected] of Object.entries(fixture.effects)) {
  test(`effect payload, lifetime, gameplay and RNG reference: ${kind}`, () => {
    assert.deepEqual(effectSample(kind), expected);
  });
}
