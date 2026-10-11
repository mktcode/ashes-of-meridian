// Generation-only topology fixtures: no decoration, AI or simulation ticks.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { BATTLEFIELD_SCRIPTS, loadScripts } = require('./helpers/game-scripts.cjs');
function scope() {
  return loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world']);
}
const synthetic = `const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);},
  world={extent:100,cellSize:2.5,layout:{resourceSites:[],corridors:[]}};`;

test('a substantial isolated shelf receives a broad graded connection without flattening the map', () => {
  const result = vm.runInContext(`(()=>{${synthetic}
    const height=(x,z)=>20+26*(1-smooth((Math.hypot(x-25,z-20)-28)/10)),
      original=new BattlefieldSurface(100,2.5,height),before=battlefieldTerrainRegions(original),
      surface=connectBattlefieldTerrain(world,height),after=battlefieldTerrainRegions(surface);
    let changed=0;
    for(let i=0;i<surface.heights.length;i++)if(Math.abs(surface.heights[i]-original.heights[i])>.01)changed++;
    return {before:before.groups.map(g=>g.length),after:after.groups.map(g=>g.length),
      changed:changed/surface.heights.length,max:surface.maxHeight,coverage:battlefieldTerrainCoverage(surface,after)};
  })()`, scope());
  assert.ok(result.before[1] >= 64, 'fixture really contains a detached usable shelf');
  assert.ok(result.after.slice(1).every(n => n < 64));
  assert.ok(result.after[0] / result.after.reduce((a,b) => a+b,0) >= .94);
  assert.ok(result.changed > 0 && result.changed < .25, 'repair remains a local passage');
  assert.equal(result.max, 46, 'keep high terrain, not just the low network');
  assert.ok(result.coverage.fraction >= .55 && result.coverage.sectors.every(p => p >= .25));
});

test('a single-file notch does not count as a broad pass and is replaced by a usable connection', () => {
  const result = vm.runInContext(`(()=>{${synthetic}
    const height=(x,z)=>20+26*(1-smooth((Math.abs(x)-5)/10))*smooth((Math.abs(z)-6)/6),
      original=new BattlefieldSurface(100,2.5,height),narrow=battlefieldTerrainRegions(original,2.6),
      broad=battlefieldTerrainRegions(original),surface=connectBattlefieldTerrain(world,height),
      after=battlefieldTerrainRegions(surface);
    return {narrow:narrow.groups.map(g=>g.length),broad:broad.groups.map(g=>g.length),after:after.groups.map(g=>g.length),
      vehiclePass:original.segment({x:-30,z:0},{x:30,z:0},2.6),armyPass:original.segment({x:-30,z:0},{x:30,z:0},6)};
  })()`, scope());
  assert.equal(result.vehiclePass, true, 'vehicles individually fit the old notch');
  assert.equal(result.armyPass, false, 'the same physical crossing lacks army-route clearance');
  assert.ok(result.narrow[0] / result.narrow.reduce((a,b) => a+b,0) >= .94);
  assert.ok(result.broad[1] >= 64, 'the same notch is too narrow for the army-route contract');
  assert.ok(result.after.slice(1).every(n => n < 64));
  assert.ok(result.after[0] / result.after.reduce((a,b) => a+b,0) >= .94);
});

test('plateaus and open massifs have distinct morphology while rolling hills remain available', () => {
  const result = vm.runInContext(`(()=>{
    const world={extent:180,cellSize:2.5,terrainSeed:3,layout:{resourceSites:[],corridors:[]},renderProfile:{}},
      forms=['rolling','terraces','massifs'];
    return forms.map(relief=>{
      world.renderProfile={variation:{family:'alpine',relief,heightScale:1}};
      const h=dynamicTerrainPlan(world).height;let quietHigh=0,sum=0;
      for(let z=-150;z<=150;z+=5)for(let x=-150;x<=150;x+=5){
        const y=h(x,z),slope=Math.hypot((h(x+1,z)-h(x-1,z))/2,(h(x,z+1)-h(x,z-1))/2);
        if(y>55&&slope<.12)quietHigh++;sum+=y;
      }
      return {relief,quietHigh,sum};
    });
  })()`, scope());
  assert.ok(result[1].quietHigh > 50, 'plateaus have substantial quiet high ground');
  assert.ok(result[1].quietHigh > result[2].quietHigh, 'isolated masses do not reproduce the same wide shelves');
  assert.equal(new Set(result.map(p => p.sum)).size, 3);
  const available = vm.runInContext(`Array.from({length:12},(_,i)=>battlefieldVariation(BATTLEFIELDS.westmark.render,i+1).variation.relief)`, scope());
  for (const form of ['rolling','terraces','massifs']) assert.ok(available.includes(form));
});

for (const map of ['desert','alien-planet','mothership','westmark','frontier','haven']) {
  test(`${map}: enlarged terrain distributes broad reachable ground and protects economic foundations`, () => {
    const result = vm.runInContext(`(()=>{
      const seed=1409,definition=BATTLEFIELDS[${JSON.stringify(map)}],size=definition.createSize(seed),
        world={...size,terrainSeed:seed,renderProfile:battlefieldVariation(definition.render,seed),layout:definition.createLayout(seed,size)},
        height=dynamicTerrainPlan(world).height,original=new BattlefieldSurface(world.extent,world.cellSize,height),
        surface=connectBattlefieldTerrain(world,height),regions=battlefieldTerrainRegions(surface);
      let protectedDelta=0;
      const foundations=world.layout.resourceSites.map(site=>{
        const hq=battlefieldSitePosition(site,-13,-6),gas=battlefieldGasPosition(site);
        for(const p of [hq,gas])for(let z=-7;z<=7;z+=2.5)for(let x=-7;x<=7;x+=2.5)
          protectedDelta=Math.max(protectedDelta,Math.abs(surface.heightAt(p.x+x,p.z+z)-original.heightAt(p.x+x,p.z+z)));
        return surface.foundation(hq,BUILDINGS.hq.size)&&surface.foundation(gas,BUILDINGS.refinery.size);
      });
      return {coverage:battlefieldTerrainCoverage(surface,regions),groups:regions.groups.map(g=>g.length),foundations,protectedDelta};
    })()`, scope());
    assert.ok(result.coverage.fraction >= .55);
    assert.ok(result.coverage.sectors.every(p => p >= .25), 'no entire third of the map is sacrificed');
    assert.ok(result.groups.slice(1).every(n => n < 64), 'substantial wide shelves share the main network');
    assert.ok(result.groups[0] / result.groups.reduce((a,b) => a+b,0) >= .94);
    assert.ok(result.foundations.every(Boolean));
    assert.equal(result.protectedDelta, 0);
  });
}

test('spatial coverage detects an inaccessible upper map even with a large connected lower area', () => {
  const result = vm.runInContext(`(()=>{
    const surface=new BattlefieldSurface(100,2.5,(x,z)=>z<25?20:20+(z-25)*2),regions=battlefieldTerrainRegions(surface);
    let rejected=false;
    try{connectBattlefieldTerrain({extent:100,cellSize:2.5,layout:{resourceSites:[],corridors:[]}},(x,z)=>z<25?20:20+(z-25)*2);}
    catch(e){rejected=/Insufficient spatial terrain coverage/.test(e.message);}
    return {...battlefieldTerrainCoverage(surface,regions),rejected};
  })()`, scope());
  assert.ok(result.fraction > .55, 'global area alone would overlook the problem');
  assert.ok(result.sectors.some(p => p < .25), 'sector coverage catches the missing north');
  assert.equal(result.rejected, true, 'generation rejects the invalid landscape, not its seed or navigation rules');
});
