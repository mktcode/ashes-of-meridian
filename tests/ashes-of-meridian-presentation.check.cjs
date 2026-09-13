// Fixed terrain/navigation/effect references; intentional visual deltas: docs/reference-tests.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/presentation-v1.json');
const { worldSample, effectSample } = require('./helpers/presentation-scenario.cjs');
const vm = require('node:vm');
const { RENDERER_SCRIPTS, SIMULATION_SCRIPTS, loadScripts } = require('./helpers/game-scripts.cjs');
const { createRendererStub } = require('./helpers/renderer-stub.cjs');
for (const { seed, biome, ...expected } of fixture.worlds) {
  test(`world presentation/navigation reference: ${seed} (${biome})`, () => {
    assert.deepEqual(worldSample(seed, biome), expected);
  });
}
test('world and simulation start and step without renderer, geometry or browser globals', () => {
  const context = loadScripts(['core', 'content', 'world', 'effects', ...SIMULATION_SCRIPTS], { globals: { structuredClone } });
  vm.runInContext('Math.random = () => { throw Error("Unseeded randomness"); }', context);
  const Game = vm.runInContext('MeridianGame', context), game = new Game({ upgrades: {} });
  game.start({ seed: 1409, faction: 0 });
  assert.deepEqual([game.s.alloy,game.s.gas],[250,0]);
  assert.equal(game.train('worker'), true);
  assert.equal('R' in game, false); assert.equal('R' in game.world, false);
  for (let i = 0; i < 1000; i++) { game.step(.05); game.effects.tick(.05); }
  assert.ok(Math.abs(game.s.time-50)<1e-8); assert.ok(game.s.stats.gathered > 0);
  assert.ok(game.world.fogPixels.includes(255));
  assert.equal(vm.runInContext('typeof geom + ":" + typeof MAT + ":" + typeof document', context), 'undefined:undefined:undefined');
});

test('world view uploads only changed layout/fog and does not mutate CPU data', () => {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', 'world', 'world-view']);
  const { Battlefield, BattlefieldView } = vm.runInContext('({Battlefield, BattlefieldView})', context);
  const world = new Battlefield(1409, 'biome1'), renderer = createRendererStub();
  let meshes = 0, fogs = 0, fogPixels;
  renderer.geometry = () => meshes++;
  renderer.fog = data => { fogs++; fogPixels = Array.from(data); };
  const view = new BattlefieldView(renderer), before = JSON.stringify(world.renderData);
  view.sync(world, false); view.sync(world, false);
  assert.equal(renderer.decorSeed, 1409);
  assert.equal(meshes, 2 + world.renderData.massifs.length); assert.equal(fogs, 0); assert.equal(renderer.fogOn, false);
  world.reveal([], [{ x: 0, z: 0, r: 7 }]); view.sync(world); view.sync(world);
  assert.equal(meshes, 2 + world.renderData.massifs.length); assert.equal(fogs, 1); assert.equal(renderer.fogOn, true);
  assert.deepEqual(fogPixels, Array.from(world.fogPixels)); assert.ok(fogPixels.includes(255));
  assert.equal(JSON.stringify(world.renderData), before);
  const next = new Battlefield(43015, 'biome1'); next.reveal([]);
  view.sync(next); view.sync(next);
  assert.equal(fogs, 2); assert.equal(renderer.fogOn, true);
  assert.deepEqual(fogPixels, Array.from(next.fogPixels)); assert.ok(fogPixels.every(v => v === 0));
  assert.equal(renderer.decorSeed, 43015, 'new world updates cosmetic seed without sampling world RNG');
  assert.equal(meshes, 4 + world.renderData.massifs.length + next.renderData.massifs.length);
});

test('produced aircraft rise smoothly from the hangar without changing draw state or RNG', () => {
  const context=loadScripts(['core',...RENDERER_SCRIPTS,'content','world','world-view']);
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

test('faction 0 HQ armor has bounded beveled panels with outward finite unit normals', () => {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS]);
  vm.runInContext('Math.random = seeded = () => { throw Error("Mesh RNG"); }', context);
  const geom = vm.runInContext('geom', context), mesh = geom.commandHull();
  assert.deepEqual(mesh, geom.commandHull());
  assert.ok(mesh.length / 27 >= 800 && mesh.length / 27 <= 1400);
  // Each convex panel has three eight-sided bands and two closed caps (64 triangles).
  assert.equal(mesh.length % (64 * 27), 0);
  for (let start = 0; start < mesh.length; start += 64 * 27) {
    const center = [0, 0, 0];
    for (let i = start; i < start + 64 * 27; i += 9)
      for (let k = 0; k < 3; k++) center[k] += mesh[i + k] / (64 * 3);
    for (let i = start; i < start + 64 * 27; i += 27) {
      const a = mesh.slice(i, i + 3), b = mesh.slice(i + 9, i + 12), c = mesh.slice(i + 18, i + 21),
        u = b.map((v, k) => v - a[k]), v = c.map((v, k) => v - a[k]),
        cross = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]],
        area = Math.hypot(...cross);
      assert.ok(area > 1e-8, 'no degenerate triangles');
      assert.ok(cross.reduce((sum, n, k) => sum + n * (a[k] - center[k]), 0) > 0, 'outward winding');
      for (let j = i; j < i + 27; j += 9) {
        const vertex = mesh.slice(j, j + 9);
        assert.ok(vertex.every(Number.isFinite));
        assert.ok(Math.abs(vertex[0]) <= 3.98 && vertex[1] >= .1 - 1e-9 && vertex[1] <= 3.55);
        assert.ok(vertex[2] >= -2.6 && vertex[2] <= 4, 'armor and step remain inside existing foundation');
        assert.ok(cross.every((n, k) => Math.abs(n / area - vertex[k + 3]) < 1e-9));
        assert.ok(vertex.slice(6).every(tint => tint > 0 && tint < 1.6));
      }
    }
  }
});

test('command hull is faction-specific and retains construction, team yaw, tint and draw isolation', () => {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', 'world', 'world-view']);
  vm.runInContext('Math.random = seeded = () => { throw Error("HQ draw RNG"); }', context);
  const { renderEntity, BUILDINGS, BUILDING_YAW, FACTIONS, MAT } =
    vm.runInContext('({renderEntity, BUILDINGS, BUILDING_YAW, FACTIONS, MAT})', context);
  const entity = Object.freeze({ id: 1, kind: 'building', type: 'hq', x: 12, z: -7,
    hp: BUILDINGS.hq.hp, size: BUILDINGS.hq.size, faction: 0, team: 0, progress: 1 });
  const render = (e = entity, options = {}, time = 0) => {
    const renderer = createRendererStub({ record: true }), before = JSON.stringify(e);
    renderEntity(renderer, Object.freeze(e), time, options);
    assert.equal(JSON.stringify(e), before);
    assert.ok(renderer.calls.every(c => c.slice(1, 13).every(Number.isFinite)));
    return renderer.calls;
  };
  const calls = render(), hull = list => list.find(c => c[0] === 'commandHull');
  assert.equal(calls.filter(c => c[0] === 'commandHull').length, 1);
  assert.deepEqual(hull(calls), ['commandHull', 12, 0, -7, 1, 1, 1,
    FACTIONS[0].metal, BUILDING_YAW, 0, 0, 0, 1, 'dynamic', MAT.METAL]);
  assert.deepEqual(calls, render());
  assert.deepEqual(hull(calls), hull(render(entity, {}, 9)), 'armor stays fixed while radar rotates');
  for (const progress of [0, .4, 1]) {
    const h = hull(render({ ...entity, progress }));
    assert.equal(h[5], Math.max(.15, progress));
    assert.equal(h[4], 1); assert.equal(h[6], 1);
  }
  const preview = hull(render(entity, { tint: 0x99e4c6, alpha: .3, layer: 'effects' }));
  assert.equal(preview[7], 0x99e4c6); assert.equal(preview[12], .3); assert.equal(preview[13], 'effects');
  assert.equal(hull(render(entity, { ghost: true }))[7], 0x68717d);
  const enemy = render({ ...entity, team: 1 });
  assert.equal(hull(enemy)[8], BUILDING_YAW + Math.PI);
  assert.equal(enemy[1][7], 0xe98680, 'foundation retains hostile team color');
  for (const faction of [1, 2]) assert.equal(hull(render({ ...entity, faction })), undefined);
  for (const type of Object.keys(BUILDINGS).filter(type => type !== 'hq'))
    assert.equal(hull(render({ ...entity, type })), undefined);
  assert.deepEqual(render({ ...entity, hp: 0 }), []);
});

test('faction 0 worker meshes are deterministic, bounded and non-degenerate with finite flat normals', () => {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS]);
  vm.runInContext('Math.random = seeded = () => { throw Error("Worker mesh RNG"); }', context);
  const geom = vm.runInContext('geom', context);
  for (const [name, min, max] of [['workerHull', 1200, 1800], ['workerDrill', 100, 160]]) {
    const mesh = geom[name](), colors = new Set();
    assert.deepEqual(mesh, geom[name]());
    assert.ok(mesh.length / 27 >= min && mesh.length / 27 <= max);
    let volume = 0;
    for (let i = 0; i < mesh.length; i += 27) {
      const a = mesh.slice(i, i+3), b = mesh.slice(i+9, i+12), c = mesh.slice(i+18, i+21),
        u = b.map((v,k) => v-a[k]), v = c.map((v,k) => v-a[k]),
        cross = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]],
        area = Math.hypot(...cross);
      assert.ok(area > 1e-9);
      volume += a.reduce((sum,n,k) => sum+n*cross[k], 0) / 6;
      for (let j = i; j < i+27; j += 9) {
        const p = mesh.slice(j, j+9);
        assert.ok(p.every(Number.isFinite));
        assert.ok(cross.every((n,k) => Math.abs(n/area-p[k+3]) < 1e-9));
        if (name === 'workerHull') {
          assert.ok(Math.abs(p[0]) <= .90 && Math.abs(p[2]) <= .87);
          assert.ok(p[1] >= .03 && p[1] <= 1.241, 'preserve compact crawler silhouette');
        } else {
          assert.ok(Math.hypot(p[0],p[2]) <= 1+1e-9 && Math.abs(p[1]) <= .5);
        }
        assert.ok(p.slice(6).every(tint => tint > 0 && tint <= 1.21));
        colors.add(p.slice(6).join(','));
      }
    }
    assert.ok(volume > 0, 'outward-oriented closed components');
    assert.ok(colors.size >= 3, 'facets and recesses have distinct tints');
  }
});

test('detailed faction 0 workers preserve yaw, cargo indication, team tint and read-only rendering', () => {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', 'world', 'world-view']);
  vm.runInContext('Math.random = seeded = geom.workerHull = geom.workerDrill = () => { throw Error("Per-frame mesh/RNG"); }', context);
  const { renderEntity, UNITS, MAT } = vm.runInContext('({renderEntity, UNITS, MAT})', context);
  const unit = Object.freeze({ id: 17, kind: 'unit', type: 'worker', faction: 0, team: 0,
    x: 12, z: -7, hp: UNITS.worker.hp, size: UNITS.worker.size, rot: .7, walk: 2, carry: 0,
    order: Object.freeze({ type: 'gather', id: 8 }) });
  const render = (e = unit, time = 0, options = {}) => {
    const renderer = createRendererStub({ record: true }), before = JSON.stringify(e);
    renderEntity(renderer, Object.freeze(e), time, options);
    assert.equal(JSON.stringify(e), before);
    assert.ok(renderer.calls.every(c => c.slice(1,13).every(Number.isFinite)));
    return renderer.calls;
  };
  const calls = render();
  assert.equal(calls.filter(c => c[0] === 'workerHull').length, 1);
  assert.equal(calls.filter(c => c[0] === 'workerDrill').length, 1);
  assert.ok(calls.length <= 16 && calls.every(c => c[14] === MAT.METAL));
  assert.deepEqual(calls, render({ ...unit, walk: 7 }, 20), 'no new time/walk-driven behavior');
  const drill = calls.find(c => c[0] === 'workerDrill');
  assert.ok(Math.abs(drill[1] - (unit.x + .67*Math.cos(.7) + Math.sin(.7))) < 1e-9);
  assert.ok(Math.abs(drill[3] - (unit.z - .67*Math.sin(.7) + Math.cos(.7))) < 1e-9);
  assert.equal(drill[8], .7); assert.equal(drill[9], -1.1);
  const loaded = render({ ...unit, carry: 10 });
  assert.deepEqual(loaded.slice(0,-1), calls);
  assert.equal(loaded.at(-1)[0], 'octa'); assert.equal(loaded.at(-1)[2], 1.4);
  assert.equal(loaded.at(-1)[7], 0xecc88a);
  const preview = render(unit, 0, { tint: 0x99e4c6, alpha: .3, layer: 'effects' });
  assert.equal(preview[0][7], 0x99e4c6);
  assert.ok(preview.every(c => c[12] === .3 && c[13] === 'effects'));
  assert.equal(render(unit, 0, { ghost: true })[0][7], 0x68717d);
  assert.ok(render({ ...unit, team: 1 }).some(c => c[7] === 0xe98680));
  for (const faction of [1,2])
    assert.ok(render({ ...unit, faction }).every(c => !['workerHull','workerDrill'].includes(c[0])));
  assert.deepEqual(render({ ...unit, hp: 0 }), []);
});

test('faction 0 turret meshes are deterministic, bounded and non-degenerate, including recessed twin muzzles', () => {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS]);
  vm.runInContext('Math.random = seeded = () => { throw Error("Turret mesh RNG"); }', context);
  const geom = vm.runInContext('geom', context), meshes = geom.turretAssembly();
  assert.deepEqual(meshes, geom.turretAssembly());
  for (const [name, mesh] of Object.entries(meshes)) {
    const base = name === 'turretBase', colors = new Set();
    assert.ok(mesh.length/27 >= (base ? 500 : 900) && mesh.length/27 <= (base ? 800 : 1300));
    let volume = 0;
    for (let i = 0; i < mesh.length; i += 27) {
      const a = mesh.slice(i,i+3), b = mesh.slice(i+9,i+12), c = mesh.slice(i+18,i+21),
        u = b.map((v,k) => v-a[k]), v = c.map((v,k) => v-a[k]),
        cross = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]],
        area = Math.hypot(...cross);
      assert.ok(area > 1e-9, 'no degenerate surfaces');
      volume += a.reduce((sum,n,k) => sum+n*cross[k],0)/6;
      for (let j = i; j < i+27; j += 9) {
        const p = mesh.slice(j,j+9);
        assert.ok(p.every(Number.isFinite));
        assert.ok(cross.every((n,k) => Math.abs(n/area-p[k+3]) < 1e-9));
        if (base) assert.ok(Math.hypot(p[0],p[2]) <= 1.35+1e-9 && p[1] >= .15 && p[1] <= 2.05);
        else assert.ok(Math.abs(p[0]) <= .98+1e-9 && p[1] >= 1.83-1e-9 && p[1] <= 2.77 && p[2] >= -.85-1e-9 && p[2] <= 1.85);
        assert.ok(p.slice(6).every(tint => tint > 0 && tint < 1.5));
        colors.add(p.slice(6).join(','));
      }
    }
    assert.ok(volume > 0); assert.ok(colors.size >= 3);
  }
  for (const side of [-1,1]) {
    const mesh = meshes.turretHead;
    assert.ok(mesh.some((v,i) => i%9 === 0 && Math.abs(v-side*.52) < 1e-9 &&
      Math.abs(mesh[i+1]-2.3) < 1e-9 && mesh[i+2] === 1.65), 'each barrel has a recessed bore end');
  }
});

test('faction 0 turret detail keeps its fixed base and independently aimed head through team and construction variants', () => {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', 'world', 'world-view']);
  vm.runInContext('Math.random = seeded = geom.turretAssembly = () => { throw Error("Per-frame turret mesh/RNG"); }', context);
  const { renderEntity, BUILDINGS, BUILDING_YAW, MAT } =
    vm.runInContext('({renderEntity, BUILDINGS, BUILDING_YAW, MAT})', context);
  const entity = { id: 17, kind: 'building', type: 'turret', faction: 0, team: 0,
    x: 12, z: -7, hp: BUILDINGS.turret.hp, size: BUILDINGS.turret.size, rot: .7, progress: 1 };
  const render = (e = entity, options = {}, time = 0) => {
    const renderer = createRendererStub({ record: true }), before = JSON.stringify(e);
    renderEntity(renderer, Object.freeze(e), time, options);
    assert.equal(JSON.stringify(e), before);
    assert.ok(renderer.calls.every(c => c.slice(1,13).every(Number.isFinite)));
    return renderer.calls;
  };
  const base = calls => calls.find(c => c[0] === 'turretBase'), head = calls => calls.find(c => c[0] === 'turretHead');
  const calls = render();
  assert.equal(calls.filter(c => c[0] === 'turretBase').length, 1);
  assert.equal(calls.filter(c => c[0] === 'turretHead').length, 1);
  assert.ok(calls.length <= 10); assert.deepEqual(calls, render(entity, {}, 19));
  for (const team of [0,1]) for (const rot of [0,.7,Math.PI,-2]) for (const progress of [0,.4,1]) {
    const next = render({ ...entity, team, rot, progress }), scale = Math.max(.15,progress);
    assert.equal(base(next)[8], BUILDING_YAW+team*Math.PI);
    assert.ok(Math.abs(head(next)[8]-rot) < 1e-9, 'aim is not added to building yaw');
    for (const c of [base(next),head(next)]) {
      assert.deepEqual(c.slice(1,7), [entity.x,0,entity.z,1,scale,1]);
      assert.equal(c[14], MAT.METAL);
    }
    const sensor = next.find(c => c[0] === 'box' && c[11] === 1.2);
    assert.ok(Math.abs(sensor[1]-(entity.x+Math.sin(rot)*.827)) < 1e-9);
    assert.ok(Math.abs(sensor[3]-(entity.z+Math.cos(rot)*.827)) < 1e-9);
    assert.equal(sensor[2], 2.3*scale);
    assert.equal(sensor[7], team ? 0xe98680 : 0x78ded3);
  }
  const preview = render(entity, { tint: 0x99e4c6, alpha: .3, layer: 'effects' });
  for (const c of [base(preview),head(preview)]) {
    assert.equal(c[7], 0x99e4c6); assert.equal(c[12], .3); assert.equal(c[13], 'effects');
  }
  assert.equal(head(render(entity, { ghost: true }))[7], 0x68717d);
  for (const faction of [1,2]) assert.equal(head(render({ ...entity, faction })), undefined);
  for (const type of Object.keys(BUILDINGS).filter(type => type !== 'turret'))
    assert.equal(head(render({ ...entity, type })), undefined);
  assert.deepEqual(render({ ...entity, hp: 0 }), []);
});

test('effects need only content, consume RNG synchronously and preserve visibility short-circuiting', () => {
  const context = loadScripts(['content', 'effects']);
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

test('shot and shell faction variants use stable IDs rather than display names', () => {
  const context = loadScripts(['content', 'effects']);
  vm.runInContext(`FACTIONS.forEach(f => { f.name = 'Same revised name'; });`, context);
  const Effects = vm.runInContext('MeridianEffects', context);
  const effects = new Effects(() => { throw Error('Shot RNG'); });
  const target = { kind: 'unit', type: 'rifle', x: 8, z: 9 };
  for (const [faction, color, life, shellColor] of [
    [0, 0xffd2a0, .1, 0xffce8f], [1, 0xafe8a6, .1, 0xb8eba3], [2, 0xd9bfff, .19, 0xffce8f]
  ]) {
    const e = Object.freeze({ kind: 'unit', type: 'rifle', x: 0, z: 0, rot: 0, team: 0, faction });
    effects.shot(e, target); effects.shell(e, target, .85);
    assert.equal(effects.fx.at(-2).color, color); assert.equal(effects.fx.at(-2).life, life);
    assert.equal(effects.fx.at(-1).color, shellColor);
  }
});

test('entity models stay identical when faction, unit and building display names change', () => {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', 'world-view']);
  const { renderEntity, UNITS, BUILDINGS } = vm.runInContext('({renderEntity, UNITS, BUILDINGS})', context);
  const draw = () => {
    const renderer = createRendererStub({ record: true });
    for (const faction of [0, 1, 2]) for (const team of [0, 1])
      for (const [kind, definitions] of [['unit', UNITS], ['building', BUILDINGS]])
        for (const [type, d] of Object.entries(definitions))
          renderEntity(renderer, Object.freeze({ id: 1, kind, type, faction, team,
            hp: d.hp, size: d.size, x: 0, z: 0, progress: 1, rot: .7, walk: 0, carry: 0 }), 0);
    return renderer.calls;
  };
  const before = draw();
  vm.runInContext(`FACTIONS.forEach(f => {
    f.name = f.short = 'Revised';
    for (const names of [f.units, f.buildings]) for (const key of Object.keys(names)) names[key] = 'Revised';
  });`, context);
  assert.deepEqual(draw(), before);
});

test('effect provider follows the current game RNG and resets on each new start', () => {
  const context = loadScripts(['core', 'content', 'world', 'effects', ...SIMULATION_SCRIPTS], { globals: { structuredClone } });
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
  test(`effect payload, lifetime and RNG reference: ${kind}`, () => {
    assert.deepEqual(effectSample(kind), expected);
  });
}
