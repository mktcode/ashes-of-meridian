const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { loadScripts, BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS } = require('./helpers/game-scripts.cjs');
const context = loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world','effects',...SIMULATION_SCRIPTS,
  'renderer-geometry','renderer-terrain-models','renderer-landscape']);
const { Battlefield, BATTLEFIELDS, MeridianGame, battlefieldStartSites, battlefieldDesign, battlefieldAtmosphere, TerrainModels } =
  vm.runInContext('({Battlefield,BATTLEFIELDS,MeridianGame,battlefieldStartSites,battlefieldDesign,battlefieldAtmosphere,TerrainModels})',context);
const json = value => JSON.parse(JSON.stringify(value));
function signature(world) {
  return createHash('sha256').update(JSON.stringify(world.layout)).update(world.staticGrid)
    .update(new Uint8Array(world.surface.heights.buffer)).digest('hex');
}
function connected(world) {
  const n=world.gridSize, reached=new Uint8Array(n*n), queue=[world.idx(world.layout.startSites[0].x,world.layout.startSites[0].z)];
  reached[queue[0]]=1;
  for(let at=0;at<queue.length;at++) {
    const i=queue[at],x=i%n,z=Math.floor(i/n);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const cx=x+dx,cz=z+dz,j=cz*n+cx;
      if(cx<0||cz<0||cx>=n||cz>=n||reached[j]||world.staticGrid[j])continue;
      const p=world.point(j);
      if(!world.surface.segment(world.point(i),p,2.5))continue;
      reached[j]=1;queue.push(j);
    }
  }
  return reached;
}
test('Frontier seeds change real layouts and terrain while retaining vehicle-wide connected starts and resources',()=>{
  const signatures=new Set(), definition=JSON.stringify(BATTLEFIELDS.frontier);
  for(const seed of [1,1409,40517,7919,0xffffffff]) {
    const w=new Battlefield(seed,'frontier',4), reached=connected(w);
    signatures.add(signature(w));
    assert.equal(w.layout.resourceSites.length,8);
    assert.equal(battlefieldStartSites(w).length,4);
    const points=[...w.layout.startSites,...w.layout.resourceSites,
      ...w.layout.resourceSites.map((p,i)=>({x:p.x+(i?7:5),z:p.z+(i?7:18)}))];
    for(const p of points) {
      assert.equal(reached[w.idx(p.x,p.z)],1,`seed ${seed}: disconnected ${JSON.stringify(p)}`);
      assert.ok(w.surface.fits(p.x,p.z,2.5));
    }
    for(const p of w.layout.startSites) assert.ok(w.surface.foundation(p,7));
    assert.ok(w.staticGrid.some(v=>v===1));
    assert.ok(w.renderData.placements.length<=242);
    assert.ok(w.surface.maxHeight<=24);
  }
  assert.equal(signatures.size,5);
  assert.equal(JSON.stringify(BATTLEFIELDS.frontier),definition,'no shared layout/profile mutation');
});
test('named designs pin landscape and material settings, not encounter seeds or team RNG',()=>{
  const a=new Battlefield(1,'haven'),b=new Battlefield(7919,'haven');
  assert.equal(a.seed,1);assert.equal(b.seed,7919);
  assert.equal(a.terrainSeed,40517);
  assert.equal(signature(a),signature(b));
  // First named Frontier-v1 design: retain its topology when adding future recipes.
  assert.equal(signature(a),'89873ccd25de7d66034ee1c1d5777e35de8d69e63034bce78462cfaed07a0712');
  assert.deepEqual(json(a.renderData),json(b.renderData));
  assert.equal(a.renderProfile.atmosphere.timeOfDay,18.5);
  assert.equal(BATTLEFIELDS.haven.design.atmosphere.materialSeed,40517);
  assert.equal(signature(new Battlefield(1409,'frontier')),signature(new Battlefield(1409,'frontier')));
});
test('atmosphere is a bounded independent per-world value and authored defaults remain exact',()=>{
  const profile=BATTLEFIELDS.aurelion.render, before=JSON.stringify(profile);
  assert.strictEqual(battlefieldAtmosphere(profile,undefined,1),profile);
  const night=battlefieldAtmosphere(profile,{timeOfDay:0},1),day=battlefieldAtmosphere(profile,{timeOfDay:12},1);
  assert.notDeepEqual(json(night.lighting),json(day.lighting));
  assert.equal(day.scenery,'aurelion');
  assert.equal(JSON.stringify(profile),before);
  const a=battlefieldAtmosphere(profile,{timeOfDay:'seeded'},1409),b=battlefieldAtmosphere(profile,{timeOfDay:'seeded'},1409);
  assert.deepEqual(json(a),json(b));
  for(const hour of [0,5,7,12,16,19,21,23.9999]) {
    const p=battlefieldAtmosphere(profile,{timeOfDay:hour},7);
    for(const color of [p.atmosphere.horizon,p.atmosphere.zenith,p.haze,...Object.values(p.lighting)])
      assert.ok(color.every(v=>Number.isFinite(v)&&v>=0&&v<=1.2));
  }
  for(const timeOfDay of [-1,24,NaN,Infinity]) assert.throws(()=>battlefieldDesign(BATTLEFIELDS.aurelion,'invalid',{atmosphere:{timeOfDay}}));
  for(const terrainSeed of [-1,1.5,NaN,0x100000000]) assert.throws(()=>battlefieldDesign(BATTLEFIELDS.frontier,'invalid',{terrainSeed}));
  const original=BATTLEFIELDS.frontier;
  try {
    BATTLEFIELDS.frontier=battlefieldDesign(original,'DAY',{atmosphere:{timeOfDay:12}});
    const dayWorld=new Battlefield(1409,'frontier'),dayGame=new MeridianGame({upgrades:{}},()=>{});
    dayGame.start({map:'frontier',seed:1409,faction:0,enemies:[1]});
    BATTLEFIELDS.frontier=battlefieldDesign(original,'NIGHT',{atmosphere:{timeOfDay:0}});
    const nightWorld=new Battlefield(1409,'frontier'),nightGame=new MeridianGame({upgrades:{}},()=>{});
    nightGame.start({map:'frontier',seed:1409,faction:0,enemies:[1]});
    assert.equal(signature(dayWorld),signature(nightWorld));
    assert.deepEqual(json(dayWorld.renderData),json(nightWorld.renderData));
    assert.deepEqual(json(dayGame.s),json(nightGame.s));
    assert.equal(dayGame.random(),nightGame.random(),'atmosphere cannot shift encounter RNG');
  } finally {BATTLEFIELDS.frontier=original;}
});
test('generated relief uses the CPU samples and shared mesh diagonal, never a second GPU landscape',()=>{
  const w=new Battlefield(1409,'frontier'),descriptor=w.renderData.geometries.find(g=>g.mesh==='terrain'),
    mesh=TerrainModels.geometry(descriptor),s=w.surface;
  assert.equal(mesh.length,(s.size-1)**2*54);
  for(let i=0;i<mesh.length;i+=9) {
    const x=mesh[i],y=mesh[i+1],z=mesh[i+2];
    assert.ok(Math.abs(y-(s.heightAt(x,z)-.13))<.00001);
    assert.ok(mesh[i+4]>0,'upward surface normal');
  }
});
test('battle initialization places both minerals and vents from the generated layout',()=>{
  const game=new MeridianGame({upgrades:{}},()=>{});
  game.start({map:'frontier',seed:1409,faction:0,enemies:[1,2,0],depth:7});
  const sites=game.world.layout.resourceSites, resources=game.s.entities.filter(e=>e.kind==='resource');
  assert.equal(resources.length,48);
  for(const [i,p] of sites.entries()) {
    const vent=resources.find(e=>e.type==='gas'&&e.x===p.x+(i?7:5)&&e.z===p.z+(i?7:18));
    assert.ok(vent,`missing generated vent ${i}`);
    assert.equal(game.world.surface.heightAt(vent.x,vent.z),0);
    for(let j=0;j<5;j++) {
      const q=game.crystalPosition(i,j);
      assert.ok(resources.some(e=>e.type==='crystal'&&e.x===q.x&&e.z===q.z));
      assert.equal(game.world.surface.heightAt(q.x,q.z),0);
    }
  }
  assert.equal(game.s.entities.filter(e=>e.kind==='building'&&e.type==='hq').length,4);
});
