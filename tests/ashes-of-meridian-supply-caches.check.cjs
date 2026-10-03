const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { BATTLEFIELD_SCRIPTS, RENDERER_SCRIPTS, SIMULATION_SCRIPTS, UI_SCRIPTS, loadScripts } = require('./helpers/game-scripts.cjs');
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
    const budget = Math.min(9, Math.max(4, Math.round(world.extent / 20)));
    assert.ok(caches.length <= budget, `${map}: landscape density budget`);
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
  const game = fresh(), world = game.world, cache = game.s.supplyCaches[0], events = [];
  game.emit = (...event) => events.push(event);
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
  assert.equal(events.length, 0, 'enemy pickups do not announce themselves');
  assert.equal(game.effects.floats.length, 0, 'enemy pickups do not create local numbers');
  // Both cargo currencies use local feedback exactly once, without any RNG draw.
  game.random = () => { throw Error('Pickup feedback must not draw simulation RNG'); };
  enemy.hp = 0;
  for (const resource of ['alloy', 'gas']) {
    const localCache = { ...cache, resource, amount: resource === 'gas' ? 15 : 60, collected: false };
    game.s.supplyCaches = [localCache];
    const before = game.account(0)[resource], count = events.length;
    game.collectSupplyCaches(); game.collectSupplyCaches();
    assert.equal(game.account(0)[resource], before + localCache.amount);
    assert.equal(events.length, count + 1);
    assert.equal(events.at(-1)[0], 'supplyCollected');
    assert.equal(game.effects.floats.at(-1).text, `+${localCache.amount} ${resource === 'gas' ? 'Echo' : 'Cinder'}`);
    assert.equal(game.effects.floats.at(-1).style, 'supply');
  }
  const number = game.effects.floats[0], y = number.y;
  game.effects.tick(.4);
  assert.ok(number.y > y && number.life < number.maxLife, 'number rises and fades');
  game.effects.tick(2);
  assert.equal(game.effects.floats.length, 0, 'feedback expires');
  for (const e of game.s.entities) if (e.kind === 'unit') Object.assign(e, { x: world.extent + 100, z: world.extent + 100 });
  assert.equal(game.canBuild('depot', cache), '', 'collected caches no longer reserve construction space');
});

test('supply feedback uses outlined rising text and a sound, never a toast or radio dialog', () => {
  const ctx = loadScripts(['core', 'content', 'voice-content', ...UI_SCRIPTS]);
  const UI = vm.runInContext('MeridianUI', ctx), sounds = [], texts = [];
  const ui = { audio: { sound: name => sounds.push(name) },
    toast() { throw Error('Unexpected toast'); }, radio() { throw Error('Unexpected dialog'); } };
  UI.prototype.event.call(ui, 'supplyCollected', { x: 3, z: 4, resource: 'alloy', amount: 60 });
  assert.deepEqual(sounds, ['pickup']);
  Object.assign(ui, { view: 'game', selected: [], selectionIds: () => new Set(),
    game: { s: { entities: [] }, effects: { floats: [{ x: 3, z: 4, y: 3, text: '+60 Cinder', color: '#f1ae45', style: 'supply', life: .8, maxLife: 1.6 }] } },
    R: { viewport: { left: 0, top: 0, width: 500, height: 500, right: 500, bottom: 500 }, project: () => ({x: 200, y: 220}) } });
  const canvas = { clearRect() {}, save() {}, restore() {},
    strokeText(text, x, y) { texts.push(['outline',text,x,y]); },
    fillText(text, x, y) { texts.push(['fill',text,x,y,this.font,this.fillStyle,this.globalAlpha]); } };
  UI.prototype.drawOverlay.call(ui, canvas);
  assert.equal(texts[0][0], 'outline');
  assert.equal(texts[1][1], '+60 Cinder');
  assert.ok(texts[1][4].includes('18px'));
  assert.equal(texts[1][5], '#f1ae45');
  assert.equal(texts[1][6], .5);
});

test('cargo shell bevels form finite non-degenerate outward-facing triangles', () => {
  const ctx = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'world-view']);
  const mesh = vm.runInContext('geom.supplyCrateHull()', ctx);
  assert.ok(mesh.every(Number.isFinite));
  assert.equal(mesh.length, 64 * 3 * 9);
  for (let i = 0; i < mesh.length; i += 27) {
    const a = mesh.slice(i, i + 3), b = mesh.slice(i + 9, i + 12), c = mesh.slice(i + 18, i + 21), n = mesh.slice(i + 3, i + 6);
    const u = b.map((v, j) => v - a[j]), v = c.map((v, j) => v - a[j]);
    assert.ok(Math.hypot(u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]) > 1e-8);
    assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-6);
    assert.ok(n.reduce((sum, value, j) => sum + value * (a[j]+b[j]+c[j])/3, 0) > 0);
  }
});

test('cargo tiers have distinct single, stacked and piled assemblies within the reserved footprint', () => {
  const ctx = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'world-view']);
  const render = vm.runInContext('renderSupplyCache', ctx), world = { surface: { heightAt: () => 2 } };
  for (const resource of ['alloy', 'gas']) for (const tier of [1, 2, 3]) {
    const cache = Object.freeze({ x: 0, z: 0, resource, tier, amount: 100, collected: false });
    const renderer = createRendererStub({ record: true });
    render(renderer, world, cache);
    const shells = renderer.calls.filter(call => call[0] === 'supplyCrateHull' && call[4] === 1.5 && call[5] === 1.12);
    assert.equal(shells.length, [1, 3, 7][tier - 1]);
    assert.ok(shells.every(call => call[4] === 1.5 && call[6] === 1.16), 'same-sized containers, not scaled tier models');
    assert.equal(shells.some(call => call[2] > 3), tier > 1, 'higher tiers have upper stacked containers');
    assert.ok(renderer.calls.some(call => call[7] === (resource === 'gas' ? 0x65e5e9 : 0xf1ae45)));
    for (const call of renderer.calls) {
      assert.ok(call.slice(1, 7).every(Number.isFinite));
      const radius = Math.hypot(call[4], call[6]) / 2;
      assert.ok(Math.hypot(call[1], call[3]) + radius < 3, 'within unchanged reserved radius');
      assert.ok(call[2] - call[5] / 2 >= 2, 'no geometry below ground');
    }
    const again = createRendererStub({ record: true });
    render(again, world, cache);
    assert.deepEqual(again.calls, renderer.calls);
  }
});
