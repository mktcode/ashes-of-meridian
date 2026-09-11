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
test('world and simulation start and step without renderer, geometry or browser globals', () => {
  const context = loadScripts(['core', 'content', 'world', 'effects', 'simulation'], { globals: { structuredClone } });
  vm.runInContext('Math.random = () => { throw Error("Unseeded randomness"); }', context);
  const Game = vm.runInContext('MeridianGame', context), game = new Game({ upgrades: {} });
  game.start({ seed: 1409, faction: 0 });
  assert.equal(game.s.alloy, 1100);
  assert.equal(game.train('worker'), true);
  assert.equal('R' in game, false); assert.equal('R' in game.world, false);
  for (let i = 0; i < 1000; i++) { game.step(.05); game.effects.tick(.05); }
  assert.ok(Math.abs(game.s.time-50)<1e-8); assert.ok(game.s.stats.gathered > 0);
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

test('produced aircraft rise smoothly from the hangar without changing draw state or RNG', () => {
  const context=loadScripts(['core','renderer','content','world','world-view']);
  vm.runInContext('Math.random = () => { throw Error("Draw RNG"); }',context);
  const render=vm.runInContext('renderEntity',context), renderer=createRendererStub({record:true});
  const unit={id:1,hp:245,kind:'unit',type:'air',team:0,faction:0,size:1,x:0,z:0,rot:0,
    exit:Object.freeze({building:2,x:10,z:0,length:10})};
  const height=(x,exit=unit.exit)=>{
    const e=Object.freeze({...unit,x,exit}), before=JSON.stringify(e); renderer.calls.length=0;
    render(renderer,e,0); assert.equal(JSON.stringify(e),before);
    return renderer.calls.find(c=>c[0]==='octa')[2];
  };
  const start=height(0), middle=height(5), end=height(10), normal=height(10,null);
  assert.ok(Math.abs(middle-start-1.5)<1e-9); assert.ok(Math.abs(end-start-3)<1e-9);
  assert.ok(Math.abs(end-normal)<1e-9);
});

test('effects execute alone, consume RNG synchronously and preserve visibility short-circuiting', () => {
  const context = loadScripts(['effects']);
  const Effects = vm.runInContext('MeridianEffects', context);
  let calls = 0, visibleCalls = 0;
  const effects = new Effects(() => { calls++; return .5; });
  effects.explosion(3, 4);
  assert.equal(calls, 78); assert.equal(effects.fx.length, 16);
  effects.tick(.5); assert.equal(calls, 78); assert.equal(effects.fx.length, 15);
  const e = Object.freeze({ x: 0, z: 0, team: 0 }), b = Object.freeze({ x: 1, z: 1, size: 3 });
  effects.construction(e, b, .05);
  effects.mining(e, b, .05, () => { visibleCalls++; return true; });
  assert.equal(calls, 80); assert.equal(visibleCalls, 0);
  for (let i = 0; i < 40; i++) effects.damageNumber(e, 30);
  assert.equal(effects.floats.length, 35);
  effects.reset(); assert.equal(effects.fx.length, 0); assert.equal(effects.floats.length, 0);
});

test('effect provider follows the current game RNG and resets on each new start', () => {
  const context = loadScripts(['core', 'content', 'world', 'effects', 'simulation'], { globals: { structuredClone } });
  const Game = vm.runInContext('MeridianGame', context), game = new Game({ upgrades: {} });
  const effects = game.effects;
  game.start({ seed: 1409 });
  game.random = () => .5; game.effects.explosion(0, 0);
  assert.equal(game.effects.fx[1].vy, 6);
  game.start({ seed: 1409 });
  assert.equal(game.effects, effects); assert.equal(game.effects.fx.length, 0);
  const restarted = JSON.stringify(game.s);
  game.random = () => .25; game.effects.explosion(0, 0);
  assert.equal(game.effects.fx[1].vy, 4.5);
  assert.equal(JSON.stringify(game.s), restarted);
});

test('effect drawing accepts frozen data without game/UI globals and matches the original draw calls', () => {
  const context = loadScripts(['effects-view'], { globals: { clamp: (v, a, b) => Math.max(a, Math.min(b, v)) } });
  vm.runInContext('Math.random = () => { throw Error("Rendering must not consume randomness"); }', context);
  const render = vm.runInContext('renderBattlefieldEffects', context);
  const { effectViewSample } = require('./helpers/effect-view-scenario.cjs');
  const { reference, ...expected } = require('./fixtures/effects-view-v1.json');
  assert.equal(reference, 'b9f0026');
  assert.deepEqual(effectViewSample(render), expected);
});

for (const [kind, expected] of Object.entries(fixture.effects)) {
  // The combined five-weapon reference included the removed boss weapon.
  if (kind === 'weapons') continue;
  test(`effect payload, lifetime and RNG reference: ${kind}`, () => {
    assert.deepEqual(effectSample(kind), expected);
  });
}
