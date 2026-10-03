const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { BATTLEFIELD_SCRIPTS, RENDERER_SCRIPTS, SIMULATION_SCRIPTS, loadScripts } = require('./helpers/game-scripts.cjs');
const { createRendererStub } = require('./helpers/renderer-stub.cjs');
const context = loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'effects', ...SIMULATION_SCRIPTS], { globals: { structuredClone } });
const { MeridianGame, BATTLEFIELDS, battlefieldSupplyCaches, battlefieldEconomyDistance } = vm.runInContext(
  '({MeridianGame, BATTLEFIELDS, battlefieldSupplyCaches, battlefieldEconomyDistance})', context);
const json = value => JSON.parse(JSON.stringify(value));
const fresh = (map) => {
  const game = new MeridianGame({ upgrades: {} });
  game.start({ map, seed: 9897 });
  return game;
};

test('caches fill connected free terrain away from deposits on every expedition map without consuming battle RNG', () => {
  for (const map of Object.keys(BATTLEFIELDS)) {
    const game = fresh(map), world = game.world, caches = game.s.supplyCaches;
    assert.ok(caches.length >= 4, map);
    assert.ok(caches.filter(c => c.resource === 'gas').length < caches.filter(c => c.resource === 'alloy').length);
    const grid = Array.from(world.blocked), entities = json(game.s.entities), random = game.random;
    game.random = () => { throw Error('Cache generation must not draw battle RNG'); };
    assert.deepEqual(json(battlefieldSupplyCaches(world)), json(caches));
    assert.deepEqual(Array.from(world.blocked), grid);
    assert.deepEqual(json(game.s.entities), entities);
    game.random = random;
    for (const c of caches) {
      assert.ok(world.deploymentReachable[world.idx(c.x, c.z)]);
      assert.ok(world.surface.fits(c.x, c.z, 4));
      assert.ok(world.surface.foundation(c, 3.5));
      assert.ok(battlefieldEconomyDistance(world, c) >= 28);
      assert.equal(c.amount, (c.resource === 'gas' ? [15, 30, 50] : [60, 120, 200])[c.tier - 1]);
      for (const other of caches) if (other !== c) assert.ok(Math.hypot(c.x - other.x, c.z - other.z) >= 26);
    }
  }
});

test('only visible reachable caches pay once to the nearest living ground unit, including enemy collectors', () => {
  const game = fresh(), world = game.world, cache = game.s.supplyCaches[0];
  game.s.supplyCaches = [cache];
  world.sight[0].explored.fill(1);
  assert.equal(game.canBuild('depot', cache), 'Recover nearby supply caches before building here.');
  const worker = game.s.entities.find(e => e.type === 'worker' && e.team === 0);
  const enemy = game.s.entities.find(e => e.type === 'worker' && e.team === 1);
  Object.assign(worker, { x: cache.x + 2, z: cache.z });
  Object.assign(enemy, { x: cache.x + 1, z: cache.z });
  const start = game.account(1)[cache.resource];
  world.sight.forEach(s => s.visible.fill(0));
  game.collectSupplyCaches();
  assert.equal(cache.collected, false, 'exploration alone does not allow collection');
  world.sight.forEach(s => s.visible.fill(1));
  const segment = world.surface.segment;
  world.surface.segment = () => false;
  game.collectSupplyCaches();
  assert.equal(cache.collected, false, 'no collection through barriers');
  world.surface.segment = segment;
  enemy.hp = 0; worker.type = 'air';
  game.collectSupplyCaches();
  assert.equal(cache.collected, false, 'aircraft and dead units cannot collect');
  enemy.hp = 100;
  worker.type = 'worker';
  game.collectSupplyCaches();
  assert.equal(cache.collected, true);
  assert.equal(game.account(1)[cache.resource], start + cache.amount);
  game.collectSupplyCaches();
  assert.equal(game.account(1)[cache.resource], start + cache.amount);
  for (const e of game.s.entities) if (e.kind === 'unit') Object.assign(e, { x: world.extent + 100, z: world.extent + 100 });
  assert.equal(game.canBuild('depot', cache), '', 'collected caches no longer reserve construction space');
});

test('both cargo models render one, two or three reinforced crates with distinct markings and no mutation', () => {
  const ctx = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'world-view']);
  const render = vm.runInContext('renderSupplyCache', ctx), world = { surface: { heightAt: () => 2 } };
  for (const resource of ['alloy', 'gas']) for (const tier of [1, 2, 3]) {
    const cache = Object.freeze({ x: 0, z: 0, resource, tier, amount: 100, collected: false });
    const renderer = createRendererStub({ record: true });
    render(renderer, world, cache);
    assert.equal(renderer.calls.length, 9 * tier);
    assert.ok(renderer.calls.every(call => call[0] === 'box'));
    assert.ok(renderer.calls.some(call => call[7] === (resource === 'gas' ? 0x65e5e9 : 0xf1ae45)));
  }
});
