// Bounded procedural terrain/deployment contracts. No autonomous AI or simulation run.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS, readScripts, loadScripts } = require('./helpers/game-scripts.cjs');
const scripts = readScripts();
function scope(extra = []) {
  const context = loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world', ...extra], { scripts });
  return vm.runInContext('({Battlefield, BattlefieldSurface, BATTLEFIELDS, BUILDINGS, allocateBattlefieldStarts, battlefieldGasPosition, battlefieldEconomyDistance, battlefieldDeploymentSpace, dynamicBattlefieldLayout, Game:typeof MeridianGame === "undefined" ? null : MeridianGame})', context);
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const json = value => JSON.parse(JSON.stringify(value));
function topology(world) {
  return createHash('sha256').update(Buffer.from(world.surface.heights.buffer)).update(world.staticGrid)
    .update(world.terrainColors).update(JSON.stringify(world.layout)).update(JSON.stringify(world.renderData.placements)).digest('hex');
}
for (const map of ['desert', 'alien-planet', 'mothership', 'westmark', 'frontier', 'haven']) {
  test(`${map}: public terrain provides connected economy, buildable spaces and separated exploration starts`, () => {
    const api = scope(), w = new api.Battlefield(1409, map, 4), minimum = Math.min(65, w.extent * .55);
    assert.ok(w.startSites.length > 4, 'candidate pool is not four authored bases');
    assert.ok(w.layout.resourceSites.length >= 8 && w.layout.resourceSites.length <= 9);
    assert.ok(w.surface.maxHeight > 12 && w.surface.maxHeight <= 72);
    const connectedHeights = [...w.deploymentReachable].flatMap((free,i) => free ? [w.surface.heightAt(w.point(i).x,w.point(i).z)] : []);
    const low = Math.min(...connectedHeights), high = Math.max(...connectedHeights);
    assert.ok(high - low > 15, 'connected vehicle terrain includes genuinely different elevations');
    assert.ok(connectedHeights.filter(h => h > low + 10).length > 100, 'elevated ground has explorable area, not just pointed summits');
    assert.deepEqual(w.staticGrid, w.surface.cliffs, 'decorations never create a second obstacle distribution');
    assert.ok(w.renderProfile.variation && w.renderProfile.ecology && w.renderProfile.atmosphere);
    for (const site of w.layout.resourceSites) {
      const gas = api.battlefieldGasPosition(site);
      assert.ok(w.deploymentReachable[w.idx(site.x, site.z)]);
      assert.ok(w.deploymentReachable[w.idx(gas.x, gas.z)]);
      assert.ok(w.surface.foundation(gas, api.BUILDINGS.refinery.size), 'vents support real foundations');
    }
    for (const mode of ['resource-start', 'exploration']) {
      const starts = api.allocateBattlefieldStarts(w, 9017, 4, mode);
      if (mode === 'resource-start') assert.ok(api.battlefieldEconomyDistance(w, starts[0]) < 10);
      for (let i = 0; i < starts.length; i++) {
        assert.ok(api.battlefieldDeploymentSpace(w, starts[i]));
        if (mode === 'exploration' || i > 0) assert.ok(api.battlefieldEconomyDistance(w, starts[i]) > 24);
        for (let j = 0; j < i; j++) assert.ok(distance(starts[i], starts[j]) >= minimum);
        const route = w.path(starts[i].x, starts[i].z, w.layout.resourceSites[0].x, w.layout.resourceSites[0].z,
          false, undefined, 2.6);
        assert.equal(route.status, 'complete', 'vehicle-clear route reaches shared economy');
      }
    }
    const skin = w.renderData.geometries.find(d => d.mesh === 'terrain').relief;
    for (let row = 1; row < skin.size - 1; row += 13) for (let col = 1; col < skin.size - 1; col += 13) {
      const x = (col - 1) * skin.step - skin.extent, z = (row - 1) * skin.step - skin.extent;
      assert.ok(Math.abs(skin.heights[row * skin.size + col] + .13 - w.surface.heightAt(x, z)) < 1e-5);
    }
    if (map === 'mothership') {
      assert.ok(w.renderData.geometries.some(d => d.model === 'shipHangar'));
      assert.ok(!w.renderData.geometries.some(d => /Deck|Ramp/.test(d.model)), 'no old authored deck/ramp skin');
      assert.ok(skin.colors.some(v => v > .5), 'metal geometry carries actual albedo tint, not landscape weights');
    }
  });
}

test('saved alien exploration seed can deploy four parties on the enlarged terrain', () => {
  const api = scope(), w = new api.Battlefield(52920759, 'alien-planet', 4);
  assert.ok(w.extent >= 140);
  for (const count of [2,4]) {
    const starts = api.allocateBattlefieldStarts(w, 52920759, count, 'exploration');
    assert.equal(starts.length, count);
    for (let i = 0; i < starts.length; i++) {
      assert.ok(api.battlefieldDeploymentSpace(w, starts[i]));
      assert.ok(api.battlefieldEconomyDistance(w, starts[i]) > 24);
      for (let j = 0; j < i; j++) assert.ok(distance(starts[i], starts[j]) >= Math.min(65, w.extent * .55));
    }
  }
});

test('deployment refinement finds off-grid shelves even when a large coarse pool is clustered', () => {
  for (const clustered of [false,true]) {
    const context = loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world'], { scripts });
    const result = vm.runInContext(`(() => {
      const world = {extent:100,gridSize:80,layout:{resourceSites:[]},surface:{fits:()=>true},
        point:Battlefield.prototype.point,idx:Battlefield.prototype.idx,cellSize:2.5};
      battlefieldEconomyDistance = () => 30;
      battlefieldDeploymentSpace = (w,p) => {
        const x = Math.round((p.x+100)/2.5-.5), z = Math.round((p.z+100)/2.5-.5);
        return ([14,17,62,65].includes(x) && [14,17,62,65].includes(z)) ||
          (${clustered} && [4,8,12].includes(x) && [4,8,12].includes(z));
      };
      const coarse = [];
      for(let z=4;z<76;z+=4)for(let x=4;x<76;x+=4) {
        const p = world.point(z*80+x);
        if(battlefieldDeploymentSpace(world,p))coarse.push(p);
      }
      const rng = seeded;
      seeded = () => { throw Error('Public refinement must not draw private RNG'); };
      world.startSites = battlefieldDeploymentCandidates(world);
      seeded = rng;
      const starts = allocateBattlefieldStarts(world,52920759,4,'exploration');
      battlefieldDeploymentSpace = (w,p) => p.x < -40 && p.z < -40;
      let rejected = false;
      try { battlefieldDeploymentCandidates(world); } catch(e) { rejected = /Insufficient exploration/.test(e.message); }
      return {coarse,starts,rejected};
    })()`, context);
    assert.equal(result.coarse.length, clustered ? 9 : 0);
    assert.equal(result.starts.length,4);
    assert.equal(result.rejected,true,'refinement never relaxes separation or accepts an unplayable pool');
    for(let i=0;i<4;i++)for(let j=0;j<i;j++)assert.ok(distance(result.starts[i],result.starts[j])>=55);
  }
});

test('party count and private deployment draws cannot reshape terrain, resources or decorations', () => {
  const api = scope(), two = new api.Battlefield(9017, 'frontier', 2), four = new api.Battlefield(9017, 'frontier', 4);
  assert.equal(topology(two), topology(four));
  const before = topology(four), a = api.allocateBattlefieldStarts(four, 19, 4, 'exploration'),
    b = api.allocateBattlefieldStarts(four, 9017, 4, 'exploration');
  assert.notDeepEqual(json(a), json(b));
  assert.deepEqual(json(a), json(api.allocateBattlefieldStarts(four, 19, 4, 'exploration')));
  assert.equal(topology(four), before);
});

test('resource regions scatter across seeds and every family has variable dimensions', () => {
  const api = scope();
  assert.notDeepEqual(json(api.dynamicBattlefieldLayout(1409, 120).resourceSites),
    json(api.dynamicBattlefieldLayout(9017, 120).resourceSites));
  for (const definition of Object.values(api.BATTLEFIELDS)) {
    const sizes = new Set(Array.from({ length: 40 }, (_, seed) => definition.createSize(seed + 1).extent));
    assert.deepEqual([...sizes].sort((a, b) => a - b), [140, 160, 180]);
  }
  const original = api.BATTLEFIELDS.frontier.createSize;
  try {
    for (const size of [{extent:NaN,cellSize:2.5},{extent:120,cellSize:0},{extent:120,cellSize:Infinity},
      {extent:120,cellSize:7},{extent:10,cellSize:2.5}]) {
      api.BATTLEFIELDS.frontier.createSize = () => size;
      assert.throws(() => new api.Battlefield(1, 'frontier'), /Battlefield size/);
    }
  } finally { api.BATTLEFIELDS.frontier.createSize = original; }
  for (const count of [0, 1, 5, 2.5, NaN]) assert.throws(() => new api.Battlefield(1, 'frontier', count));
});

test('gentle planar slopes support upright buildings while steep slopes, roughness and build-only masks reject them', () => {
  const { BattlefieldSurface } = scope(), p = {x:0,z:0},
    gentle = new BattlefieldSurface(20, 2.5, (x,z) => 20 + x * .08 + z * .04),
    steep = new BattlefieldSurface(20, 2.5, x => 20 + x * .2),
    bump = new BattlefieldSurface(20, 2.5, (x,z) => 20 + (x === 3.75 && z === 3.75 ? .4 : 0));
  assert.ok(gentle.foundation(p, 4));
  assert.ok(gentle.fits(0, 0, 4));
  assert.equal(steep.foundation(p, 4), false);
  assert.equal(bump.foundation(p, 4), false, 'conservative vertex coverage catches interior extrema');
  const bounds = gentle.foundationBounds(p, 4);
  assert.ok(bounds.min < 20 && bounds.max > 20);
  assert.equal(gentle.entityHeight({...p,type:'hq',kind:'building',size:4}), bounds.max);
  assert.equal(gentle.entityHeight({...p,type:'worker',kind:'unit',size:.65}), 20);
  gentle.buildBlocked = new Uint8Array(16 * 16); gentle.buildBlocked[8 * 16 + 8] = 1;
  assert.ok(gentle.fits(0, 0, 4), 'build-only restrictions do not change movement');
  assert.equal(gentle.foundation(p, 4), false);
  assert.equal(gentle.foundation({x:19,z:0}, 1), false);
});

test('four sight buffers remain isolated and terrain queries do not reevaluate the generation field', () => {
  const api = scope(), w = new api.Battlefield(1409, 'mothership', 4),
    starts = api.allocateBattlefieldStarts(w, 19, 4, 'exploration');
  assert.strictEqual(w.visible, w.sight[0].visible);
  w.reveal([], starts.map((p, team) => ({...p,team,r:5})));
  for (let team = 0; team < 4; team++) for (let other = 0; other < 4; other++) {
    assert.equal(w.sight[team].visible[w.idx(starts[other].x, starts[other].z)], team === other ? 255 : 0);
    if (team !== other) assert.notStrictEqual(w.sight[team].explored, w.sight[other].explored);
  }
  w.reveal([]); w.selectView(3);
  assert.strictEqual(w.visible, w.sight[3].visible);
  assert.equal(w.fogPixels[w.idx(starts[3].x, starts[3].z)], 80);
  let reads = 0;
  const surface = new api.BattlefieldSurface(20, 2.5, x => { reads++; return 20 + x * .08; }, h => Math.floor(h / 6)), baked = reads;
  for (let i = 0; i < 20; i++) {
    surface.heightAt(i / 2, 0); surface.visibilityLevelAt(i / 2, 0);
    surface.entityHeight({type:'air',x:i / 2,z:0});
  }
  assert.equal(reads, baked);
});

test('maximal deployment bonuses retain every worker and commander in reachable collision-free space', () => {
  const api=scope(['effects',...SIMULATION_SCRIPTS]),g=new api.Game({upgrades:{startingWorkers:5}}),
    benefits={pioneerSquad:5,commanderMandate:1};
  g.start({seed:1409,map:'mothership',deployment:'resource-start',enemies:[1,2,0],benefits,
    enemyBenefits:[benefits,benefits,benefits]});
  assert.equal(g.alive(e=>e.kind==='building').length,0);
  for(let team=0;team<4;team++) {
    const units=g.alive(e=>e.kind==='unit'&&e.team===team);
    assert.equal(units.filter(e=>e.type==='worker').length,team===0?11:6);
    assert.equal(units.filter(e=>e.type==='hero').length,1);
    assert.ok(g.s.parties[team].deploymentPending);
    assert.ok(g.s.parties[team].account.alloy>=api.BUILDINGS.hq.cost);
    for(const unit of units) {
      assert.ok(g.world.deploymentReachable[g.world.idx(unit.x,unit.z)]);
      assert.ok(g.unitFits(unit,unit.x,unit.z));
    }
  }
});

test('classic loading and embedded shared WebP assets survive procedural map replacement unchanged', () => {
  for (const { source, filename } of scripts) new vm.Script(source, { filename });
  const context = loadScripts(['renderer-assets'], { scripts });
  for (const [key, file] of Object.entries({ sky:'skybox.webp', rockClusters:'texture-ground-rock-clusters.webp',
    desertShrubs:'texture-ground-desert-shrubs.webp' })) {
    const url = vm.runInContext(`MERIDIAN_TEXTURES.${key}`, context);
    assert.match(url, /^data:image\/webp;base64,/);
    assert.deepEqual(Buffer.from(url.split(',')[1], 'base64'), readFileSync(join(__dirname, '..', 'assets/textures', file)));
  }
});

test('retained rock art stays deterministic, finite, bounded and normalized', () => {
  const context = loadScripts(['core', 'renderer-geometry'], { scripts }), geom = vm.runInContext('geom', context);
  for (const [kind, seed] of [['boulder',173],['crag',397],['ridge',619],['shelf',853]]) {
    const mesh = geom.rock(seed, kind);
    assert.deepEqual(mesh, geom.rock(seed, kind));
    assert.notDeepEqual(mesh, geom.rock(seed + 1, kind));
    assert.ok(mesh.length / 27 <= 100);
    for (let i = 0; i < mesh.length; i += 9) {
      assert.ok(mesh.slice(i, i + 9).every(Number.isFinite));
      assert.ok(Math.hypot(mesh[i], mesh[i + 2]) <= 1.000001);
      assert.ok(Math.abs(Math.hypot(...mesh.slice(i + 3, i + 6)) - 1) < 1e-9);
    }
  }
});
