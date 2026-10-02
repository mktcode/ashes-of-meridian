const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { loadScripts, BATTLEFIELD_SCRIPTS } = require('./helpers/game-scripts.cjs');
const json = value => JSON.parse(JSON.stringify(value));
function scope(extra = []) {
  const context = loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world',...extra]);
  return vm.runInContext('({Battlefield,BattlefieldSurface,BATTLEFIELDS,MISSIONS,battlefieldDesign,battlefieldAtmosphere,battlefieldDayCycle,battlefieldVariation,platformBattlefieldPlan,platformBattlefieldHeight,platformOutline,platformContains,availableBattlefields,TerrainModels: typeof TerrainModels === "undefined" ? null : TerrainModels})', context);
}
function signature(world) {
  return createHash('sha256').update(JSON.stringify(world.layout)).update(world.staticGrid)
    .update(new Uint8Array(world.surface.heights.buffer)).digest('hex');
}
test('named seed overrides remain deterministic without pinning any catalog landscape', () => {
  const api = scope(), original = api.BATTLEFIELDS.haven;
  assert.equal(original.design?.terrainSeed, undefined);
  api.BATTLEFIELDS.haven = api.battlefieldDesign(original, 'NAMED TEST DESIGN',
    {terrainSeed:40517, atmosphere:{timeOfDay:18.5, materialSeed:40517}});
  const a = new api.Battlefield(1, 'haven'), b = new api.Battlefield(7919, 'haven');
  assert.equal(a.seed, 1); assert.equal(b.seed, 7919);
  assert.equal(a.terrainSeed, 40517); assert.equal(signature(a), signature(b));
  assert.deepEqual(json(a.renderData), json(b.renderData));
  assert.equal(a.renderProfile.atmosphere.timeOfDay, 18.5);
});
test('atmosphere remains bounded, deterministic and independent of terrain generation', () => {
  const api = scope(), profile = api.BATTLEFIELDS.mothership.render, before = JSON.stringify(profile);
  assert.strictEqual(api.battlefieldAtmosphere(profile, undefined, 1), profile);
  const night = api.battlefieldAtmosphere(profile, {timeOfDay:0}, 1),
    day = api.battlefieldAtmosphere(profile, {timeOfDay:12}, 1);
  assert.notDeepEqual(json(night.lighting), json(day.lighting));
  assert.equal(JSON.stringify(profile), before);
  assert.deepEqual(json(api.battlefieldAtmosphere(profile, {timeOfDay:'seeded'}, 1409)),
    json(api.battlefieldAtmosphere(profile, {timeOfDay:'seeded'}, 1409)));
  for (const hour of [0,5,7,12,16,19,21,23.9999]) {
    const p = api.battlefieldAtmosphere(profile, {timeOfDay:hour}, 7);
    for (const color of [p.atmosphere.horizon,p.atmosphere.zenith,p.haze,...Object.values(p.lighting)])
      assert.ok(color.every(v => Number.isFinite(v) && v >= 0 && v <= 1.2));
  }
  for (const timeOfDay of [-1,24,NaN,Infinity])
    assert.throws(() => api.battlefieldDesign(api.BATTLEFIELDS.frontier, 'invalid', {atmosphere:{timeOfDay}}));
  for (const terrainSeed of [-1,1.5,NaN,0x100000000])
    assert.throws(() => api.battlefieldDesign(api.BATTLEFIELDS.frontier, 'invalid', {terrainSeed}));
  const original = api.BATTLEFIELDS.frontier;
  api.BATTLEFIELDS.frontier = api.battlefieldDesign(original, 'DAY', {atmosphere:{timeOfDay:12}});
  const a = new api.Battlefield(1409, 'frontier');
  api.BATTLEFIELDS.frontier = api.battlefieldDesign(original, 'NIGHT', {atmosphere:{timeOfDay:0}});
  const b = new api.Battlefield(1409, 'frontier');
  assert.equal(signature(a), signature(b)); assert.deepEqual(json(a.renderData), json(b.renderData));
});
test('day cycle wraps after ten simulation minutes without mutating its seeded origin', () => {
  const api = scope(), start = api.battlefieldAtmosphere(api.BATTLEFIELDS.desert.render, {timeOfDay:23}, 1),
    before = JSON.stringify(start), cycle = seconds => api.battlefieldDayCycle(start, seconds);
  assert.equal(cycle(25).atmosphere.timeOfDay, 0);
  assert.equal(cycle(150).atmosphere.timeOfDay, 5);
  assert.deepEqual(json(cycle(600)), json(start));
  assert.deepEqual(json(cycle(1200)), json(start));
  assert.deepEqual(json(cycle(75)), json(cycle(675)));
  assert.deepEqual(json(cycle(75)), json(cycle(75)), 'a frozen simulation clock freezes lighting');
  assert.equal(JSON.stringify(start), before);
  assert.strictEqual(api.battlefieldDayCycle(api.BATTLEFIELDS.desert.render, 100), api.BATTLEFIELDS.desert.render);
  for (const hour of [0,6,12,18]) {
    const profile = api.battlefieldAtmosphere(start, {timeOfDay:hour}, 1),
      a = api.battlefieldDayCycle(profile, 599.999), b = api.battlefieldDayCycle(profile, 600.001);
    for (const key of ['sun','sky','bounce'])
      a.lighting[key].forEach((v,i) => assert.ok(Math.abs(v-b.lighting[key][i]) < .0001));
  }
});
test('all landscape families share a seed-owned starting hour and readable midnight fill', () => {
  const api = scope(), hours = new Set();
  for (const seed of [1,7,9,1409]) {
    const expected = api.battlefieldAtmosphere(api.BATTLEFIELDS.desert.render, {timeOfDay:'seeded'}, seed).atmosphere.timeOfDay;
    hours.add(expected);
    for (const recipe of Object.values(api.BATTLEFIELDS)) {
      const start = api.battlefieldAtmosphere(api.battlefieldVariation(recipe.render, seed), recipe.design?.atmosphere, seed);
      assert.equal(start.atmosphere.timeOfDay, expected);
      const night = api.battlefieldDayCycle(start, (24-expected)*25);
      assert.ok(Math.abs(night.atmosphere.timeOfDay) < 1e-10);
      assert.ok(night.lighting.sky.every(v => v >= .38));
      assert.ok(night.lighting.bounce.every(v => v >= .18));
    }
  }
  assert.equal(hours.size,4);
});
test('platform prototype has flat tiers, usable ramps and a closed technical environment',()=>{
  const api=scope(),w=new api.Battlefield(1409,'platform-deck',4),plan=api.platformBattlefieldPlan(1409,w.extent);
  assert.ok(w.startSites.length>=4);
  assert.ok(api.MISSIONS['hq-elimination'].maps.includes('platform-deck'),'explicit experiment mission supports the map');
  assert.equal(w.renderProfile.groundTexture,'metal');
  assert.equal(w.renderProfile.ecology,undefined);assert.equal(w.renderProfile.landscape,undefined);
  assert.equal(w.renderProfile.shrubDecor.opacity,0);
  assert.ok(!api.availableBattlefields().includes('platform-deck'),'prototype does not change encounter selection');
  for(const p of plan.platforms.filter(p=>p.height===18)){
    assert.equal(w.surface.heightAt(p.x,p.z),p.height);
    assert.ok(w.surface.foundation(p,6));
    assert.equal(w.surface.fits(p.x+p.width/2+.25,p.z+p.depth/2-5,1),false);
  }
  for(const r of plan.ramps){
    const a={x:r.x-r.dx*10,z:r.z-r.dz*10},b={x:r.x+r.dx*(r.length+10),z:r.z+r.dz*(r.length+10)};
    assert.equal(r.rise,3,'lower ramps still connect adjacent tiers only');
    assert.equal(r.length,12.5,'compact ramp length');
    assert.equal(w.surface.heightAt(a.x,a.z),r.base);
    assert.equal(w.surface.heightAt(b.x,b.z),r.base+3);
    const level=r.base===plan.floor?0:1;
    assert.equal(w.surface.visibilityLevelAt(a.x,a.z),level);
    assert.equal(w.surface.visibilityLevelAt(b.x,b.z),level+1);
    assert.ok(w.surface.segment(a,b,3),'vehicle clearance on ramp');
    const p={x:r.x+r.dx*r.length*.5,z:r.z+r.dz*r.length*.5};
    assert.ok(Math.abs(w.surface.heightAt(p.x,p.z)-(r.base+r.rise*.5))<1e-5);
    assert.equal(w.surface.foundation(p,3),false);
  }
  for(const site of w.layout.resourceSites)assert.ok(w.surface.fits(site.x,site.z,4));
  assert.deepEqual(json(plan),json(api.platformBattlefieldPlan(1409,w.extent)));
  assert.notDeepEqual(json(plan),json(api.platformBattlefieldPlan(1410,w.extent)));
});
test('platform scenery occupies only existing blocked edge cells without changing navigation or build space',()=>{
  const api=scope(),w=new api.Battlefield(3,'platform-deck',4),
    plan=w.renderData.geometries.find(d=>d.mesh==='terrain').plan;
  assert.ok(plan.scenery.length>0&&plan.scenery.length<=24);
  const original=new api.BattlefieldSurface(w.extent,w.cellSize,(x,z)=>api.platformBattlefieldHeight(plan,x,z));
  assert.deepEqual(Array.from(w.surface.cliffs),Array.from(original.cliffs));
  assert.deepEqual(Array.from(w.staticGrid),Array.from(original.cliffs));
  assert.equal(w.renderData.placements.find(p=>p.mesh==='terrain').material,'TECHNICAL');
  for(const p of plan.scenery){
    assert.equal(w.staticGrid[w.idx(p.x,p.z)],1);
    assert.equal(w.terrainFeatureGrid[w.idx(p.x,p.z)],1);
    assert.equal(w.surface.foundation(p,3),false);
    assert.equal(w.surface.segment({x:p.x-8,z:p.z},{x:p.x+8,z:p.z},1),false);
    for(const q of w.layout.resourceSites)assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>=32);
    const plinth=w.renderData.placements.find(q=>q.mesh==='box'&&q.position[0]===p.x&&q.position[2]===p.z&&q.scale[0]===p.width&&q.scale[2]===p.depth);
    assert.ok(plinth,'occupied footprint is rendered, not invisible');
    for(let i=0;i<w.staticGrid.length;i++){
      const q=w.point(i);
      if(Math.abs(q.x-p.x)<p.width/2&&Math.abs(q.z-p.z)<p.depth/2)
        assert.equal(w.surface.cliffs[i],1);
    }
  }
});
test('platform plans vary their partition and tier distribution without four player-slot pads',()=>{
  const api=scope(),counts=new Set(),shapes=new Set(),heights=new Set();
  for(const seed of [1,2,3,7,1409,1410,40517]){
    const size=api.BATTLEFIELDS['platform-deck'].createSize(seed),plan=api.platformBattlefieldPlan(seed,size.extent);
    counts.add(plan.platforms.length);shapes.add(JSON.stringify(plan.platforms));
    heights.add(plan.platforms.filter(p=>p.height===18).length);
    for(const r of plan.ramps){assert.equal(r.rise,3);assert.equal(r.length,12.5);assert.ok(r.base===12||r.base===15);}
    for(const p of plan.platforms.filter(p=>p.height===18))assert.equal(p.base,15);
  }
  assert.ok(counts.size>=3);assert.equal(shapes.size,7);assert.ok(heights.size>=2);
});
test('rounded platform outlines agree with CPU containment and cut back the box corners',()=>{
  const api=scope(),plan=api.platformBattlefieldPlan(3,180);
  let beveled=0;
  for(const p of plan.platforms){
    const outline=api.platformOutline(p);
    assert.ok(outline.length>=4&&outline.length<=20);
    for(const v of outline)assert.ok(api.platformContains(p,v.x,v.z));
    if(p.corners[0]>0){
      beveled++;assert.equal(api.platformContains(p,p.x-p.width/2,p.z-p.depth/2),false);
    }
  }
  assert.ok(beveled>0);
});
test('platform corner styles mix rounded arcs and single chamfers with matching CPU outlines',()=>{
  const api=scope(),styles=new Set();
  for(const seed of [3,7,1409])for(const p of api.platformBattlefieldPlan(seed,180).platforms){
    styles.add(p.cornerStyle);
    const outline=api.platformOutline(p);
    assert.ok(outline.length<=(p.cornerStyle==='chamfer'?8:20));
    for(const v of outline)assert.ok(api.platformContains(p,v.x,v.z));
    if(p.corners[0]>0){
      const radius=p.corners[0],x=p.x-p.width/2+radius*.35,z=p.z-p.depth/2+radius*.35;
      assert.ok(api.platformContains({...p,cornerStyle:'round'},x,z));
      assert.equal(api.platformContains({...p,cornerStyle:'chamfer'},x,z),false);
    }
  }
  assert.deepEqual([...styles].sort(),['chamfer','round']);
});
test('platform skyline surrounds all sides outside play bounds with finite bounded body/light meshes',()=>{
  const api=scope(['renderer-geometry','renderer-terrain-models','renderer-platform-skyline']),
    w=new api.Battlefield(3,'platform-deck',4),plan=w.renderData.geometries.find(d=>d.mesh==='terrain').plan,
    before=JSON.stringify(plan);
  assert.equal(plan.skyline.length,36);
  assert.ok(new Set(plan.skyline.map(p=>p.style)).size>=3);
  for(const side of [-1,1]){
    assert.ok(plan.skyline.some(p=>p.x*side>w.extent));
    assert.ok(plan.skyline.some(p=>p.z*side>w.extent));
  }
  for(const p of plan.skyline){
    assert.ok(Math.abs(p.x)-p.width/2>w.extent+15||Math.abs(p.z)-p.depth/2>w.extent+15);
    assert.ok(p.height>=28&&p.height<=76);
  }
  for(const model of ['platformSkyline','platformSkylineLights']){
    const mesh=api.TerrainModels.geometry({mesh:model,model,plan});
    assert.ok(mesh.length>0&&mesh.length<900000,'bounded exterior mesh budget');
    for(let i=0;i<mesh.length;i+=9){
      assert.ok(mesh.slice(i,i+9).every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(...mesh.slice(i+3,i+6))-1)<1e-6);
      assert.ok(Math.abs(mesh[i])>w.extent+12||Math.abs(mesh[i+2])>w.extent+12,'no geometry over the playable rectangle');
      assert.ok(Math.max(Math.abs(mesh[i]),Math.abs(mesh[i+2]))<w.renderProfile.sceneryBounds.extent);
      assert.ok(mesh[i+1]<w.renderProfile.sceneryBounds.maxHeight);
    }
  }
  assert.equal(JSON.stringify(plan),before);
  assert.equal(w.surface.maxHeight,18,'cosmetic skyline never enters terrain/flight envelopes');
});
test('platform floor zoning, routes and flush channels add detail without changing the CPU plan',()=>{
  const api=scope(['renderer-geometry','renderer-terrain-models','renderer-platform-terrain']),
    plan=api.platformBattlefieldPlan(3,180),before=JSON.stringify(plan),
    mesh=api.TerrainModels.geometry({mesh:'platformFloor',model:'platformFloor',plan}),colors=new Set();
  assert.equal(JSON.stringify(plan),before);
  assert.ok(mesh.length>0&&mesh.length<600000);
  for(let i=0;i<mesh.length;i+=9){
    assert.ok(mesh.slice(i,i+9).every(Number.isFinite));
    assert.ok(Math.abs(mesh[i+3])+Math.abs(mesh[i+4]-1)+Math.abs(mesh[i+5])<1e-5);
    if(i%90===0)colors.add(mesh.slice(i+6,i+9).map(v=>v.toFixed(2)).join(','));
  }
  assert.ok(colors.size>10,'graded material variation, not a uniform plane');
});
test('platform mesh uses flat deck and ramp normals rather than smoothed landscape shoulders',()=>{
  const api=scope(['renderer-geometry','renderer-terrain-models','renderer-platform-terrain']),
    plan=api.platformBattlefieldPlan(1409,160),mesh=api.TerrainModels.geometry({mesh:'terrain',model:'platformDeck',plan});
  assert.ok(mesh.length>0&&mesh.length<150000);
  for(let i=0;i<mesh.length;i+=9){
    assert.ok(mesh.slice(i,i+9).every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...mesh.slice(i+3,i+6))-1)<1e-6);
  }
  assert.ok(mesh.some((v,i)=>i%9===4&&v===1),'flat upper faces');
  assert.ok(mesh.some((v,i)=>i%9===4&&v>0&&v<1),'inclined ramps and rolled edges');
  const signals=api.TerrainModels.geometry({mesh:'platformSignals',model:'platformSignals',plan});
  assert.ok(signals.length>0&&signals.length<15000);
  assert.ok(signals.every(Number.isFinite));
});

test('generated geometry uses CPU samples and matching triangle interpolation with finite unit normals', () => {
  const api = scope(['renderer-geometry','renderer-terrain-models','renderer-landscape']),
    w = new api.Battlefield(1409, 'frontier'), descriptor = w.renderData.geometries.find(g => g.mesh === 'terrain'),
    mesh = api.TerrainModels.geometry(descriptor), s = w.surface;
  assert.equal(mesh.length, (s.size - 1) ** 2 * 54);
  for (let i = 0; i < mesh.length; i += 9 * 73) {
    assert.ok(Math.abs(mesh[i+1] - (s.heightAt(mesh[i],mesh[i+2]) - .13)) < 1e-5);
    assert.ok(mesh[i+4] > 0);
    assert.ok(Math.abs(Math.hypot(mesh[i+3],mesh[i+4],mesh[i+5]) - 1) < 1e-5);
  }
});
