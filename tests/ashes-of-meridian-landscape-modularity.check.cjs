// Small generation-stage contracts. No complete worlds, AI, browser or simulation ticks.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { BATTLEFIELD_SCRIPTS, loadScripts, readScripts } = require('./helpers/game-scripts.cjs');
const json = value => JSON.parse(JSON.stringify(value));
function scope() {
  return loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world']);
}

test('classic battlefield scripts completely mirror their document group in load order', () => {
  const actual = readScripts().filter(s => s.filename.startsWith('dist/src/battlefields/')).map(s => s.name);
  assert.deepEqual(actual, BATTLEFIELD_SCRIPTS);
});

test('a standalone family supplies materials, habitat and recipe-owned relief without registry branches', () => {
  const result = vm.runInContext(`(() => {
    const family={id:'test-family',name:'TEST FAMILY',materials:{groundTexture:'bio',rockSurface:{texture:'desertRock',metersPerTile:11}},
      relief:{mode:'recipe'},recipes:[{id:'test-terrace',name:'TEST TERRACE',terrain:{relief:'terraces',heightScale:.8},
        habitat:{biome:'rime',flora:'Reed',weather:'clear',leaf:0x123456}}]},
      before=JSON.stringify(family),definition=createDynamicBattlefield(family),
      resolved=resolveBattlefieldLandscape(family,definition.render,1409);
    return {sameFamily:definition.family===family,materials:definition.render,terrain:resolved.terrain,
      habitat:resolved.habitat,identity:resolved.presentation.variation,unchanged:before===JSON.stringify(family)};
  })()`, scope());
  assert.ok(result.sameFamily && result.unchanged);
  assert.equal(result.materials.groundTexture, 'bio');
  assert.equal(result.materials.rockSurface.metersPerTile, 11);
  assert.deepEqual(json(result.terrain), { relief: 'terraces', heightScale: .8 });
  assert.equal(result.habitat.flora, 'Reed');
  assert.equal(result.habitat.leaf, 0x123456);
  assert.equal(result.identity.family, 'test-family');
});

test('an independent family relief axis resolves without recipe terrain and reserves its original RNG sample', () => {
  const result = vm.runInContext(`(() => {
    const family={...LANDSCAPE_FAMILIES.alien,id:'test-axis',
      relief:{mode:'axis',forms:['dunes','terraces'],suffixes:[' DUNES',' TERRACES'],heightScale:.6}},
      definition=createDynamicBattlefield(family),factory=seeded,draws=[];
    seeded=seed=>{const random=factory(seed);return ()=>{draws.push(seed);return random();};};
    let resolved;try{resolved=resolveBattlefieldLandscape(family,definition.render,7);}finally{seeded=factory;}
    let missingTerrain=false;
    try{resolveBattlefieldLandscape({...family,relief:{mode:'recipe'}},definition.render,7);}
    catch(e){missingTerrain=/requires terrain parameters/.test(e.message);}
    return {terrain:resolved.terrain,name:resolved.presentation.variation.name,missingTerrain,
      draws,geologySeed:7^0x4d414352,ecologySeed:7^0x45434f4c};
  })()`, scope());
  assert.ok(['dunes', 'terraces'].includes(result.terrain.relief));
  assert.equal(result.terrain.heightScale, .6);
  assert.ok(result.name.endsWith(result.terrain.relief === 'dunes' ? ' DUNES' : ' TERRACES'));
  assert.ok(result.missingTerrain);
  const geology = result.draws.flatMap((seed, i) => seed === result.geologySeed ? [i] : []),
    ecology = result.draws.flatMap((seed, i) => seed === result.ecologySeed ? [i] : []);
  assert.equal(geology.length, 2);
  assert.ok(geology[0] < ecology[0] && geology[1] > ecology.at(-1));
});

test('morphology and economic shoulders preserve their conditional sampling order and height queries draw nothing', () => {
  const result = vm.runInContext(`(() => {
    const forms=['rolling','dunes','basin','folds','terraces','ridges','broken-crater'],results=[];
    for(const relief of forms){
      let draws=0;const cursor=seeded(3^0x4d4f5250),random=()=>{draws++;return cursor();},
        plan=sampleBattlefieldMorphology(3,180,{relief,heightScale:1},random),
        regions=battlefieldEconomyRegions([{x:10,z:20},{x:-20,z:-10}]),
        pads=sampleBattlefieldEconomyShoulders(regions,random),natural=battlefieldNaturalTerrain(plan),
        reference=seeded(3^0x4d4f5250);
      for(let i=0;i<8;i++)reference();
      if(relief!=='basin'&&relief!=='broken-crater')reference();
      const expected=regions.map(region=>{const angle=reference()*Math.PI;
        return {...region.center,cs:Math.cos(angle),sn:Math.sin(angle),stretch:.85+reference()*.3,phase:reference()*Math.PI*2};});
      const before=JSON.stringify(plan),factory=seeded;
      seeded=()=>{throw Error('Height query must not initialize RNG');};
      let heights;try{heights=[natural.height(0,0),natural.height(72,-33),natural.height(0,0)];}
      finally{seeded=factory;}
      results.push({relief,draws,pads,expected,heights,unchanged:before===JSON.stringify(plan),
        frozen:[plan,plan.hills,...plan.hills,plan.valley,plan.ridge,plan.plateaus,...plan.plateaus,pads,...pads].every(Object.isFrozen)});
    }
    return results;
  })()`, scope());
  for (const r of result) {
    assert.equal(r.draws, (['basin', 'broken-crater'].includes(r.relief) ? 8 : 9) + 6);
    assert.deepEqual(json(r.pads), json(r.expected));
    assert.ok(r.unchanged && r.frozen);
    assert.ok(r.heights.every(Number.isFinite));
    assert.equal(r.heights[0], r.heights[2]);
  }
});

test('the terrain pipeline reads explicit CPU parameters, never presentation or habitat', () => {
  const result = vm.runInContext(`(() => {
    const world={terrainSeed:1409,extent:160,cellSize:2.5,layout:{startSites:[],resourceSites:[],economyRegions:[],corridors:[]},
      landscape:{terrain:{relief:'terraces',heightScale:1},
        get presentation(){throw Error('Presentation is not a terrain input');},
        get habitat(){throw Error('Habitat is not a terrain input');}},
      get renderProfile(){throw Error('Render profile is not a terrain input');}},
      a=dynamicTerrainPlan(world).height,b=dynamicTerrainPlan(world).height;
    return [[0,0],[45,-17],[-110,90]].map(([x,z])=>[a(x,z),b(x,z)]);
  })()`, scope());
  for (const [a, b] of result) { assert.equal(a, b); assert.ok(Number.isFinite(a)); }
});

test('economic plans own immutable anchors and each protection margin without retaining mutable input', () => {
  const result = vm.runInContext(`(() => {
    const site={x:10,z:-20},region=battlefieldEconomyRegion(site),before=JSON.stringify(region),
      expected={vent:battlefieldGasPosition(site),hq:battlefieldSitePosition(site,-13,-6),
        deployment:battlefieldSitePosition(site,-6,6),crystals:Array.from({length:5},(_,j)=>battlefieldCrystalPosition(site,0,j))};
    site.x=999;site.z=999;
    const shifted={...region,vent:{x:80,z:80},crystals:[{x:70,z:70}]},
      world={layout:{economyRegions:[shifted]}};
    return {region,expected,unchanged:before===JSON.stringify(region),
      frozen:[region,region.center,region.vent,region.hq,region.deployment,region.crystals,...region.crystals,
        region.rampProtection,...region.rampProtection].every(Object.isFrozen),
      distance:battlefieldEconomyDistance(world,{x:80,z:80})};
  })()`, scope());
  assert.ok(result.unchanged && result.frozen);
  for (const key of ['vent', 'hq', 'deployment', 'crystals'])
    assert.deepEqual(json(result.region[key]), json(result.expected[key]));
  assert.deepEqual(json(result.region.rampProtection), [
    { ...json(result.region.center), radius: 10 }, { ...json(result.region.vent), radius: 12 },
    { ...json(result.region.hq), radius: 13 }
  ]);
  assert.equal(result.distance, 0, 'consumers use supplied geometry instead of rebuilding it from a center');
});

test('economic fitting consumes the supplied HQ and vent anchors and preserves already legal ground', () => {
  const result = vm.runInContext(`(() => {
    const size={extent:40,cellSize:2.5},region=battlefieldEconomyRegion({x:0,z:0}),
      layout={startSites:[],resourceSites:[region.center],economyRegions:[region],corridors:[]},
      natural={datum:(x,z)=>20+.03*x+.02*z,height:(x,z)=>20+.03*x+.02*z},
      pads=sampleBattlefieldEconomyShoulders(layout.economyRegions,seeded(7)),
      fitted=fitBattlefieldEconomy(size,layout,natural,pads,BUILDINGS.hq.size),
      surface=new BattlefieldSurface(40,2.5,fitted);
    return {hq:surface.foundation(region.hq,BUILDINGS.hq.size),vent:surface.foundation(region.vent,BUILDINGS.refinery.size),
      heights:[region.hq,region.vent,{x:30,z:30}].map(p=>[fitted(p.x,p.z),natural.height(p.x,p.z)])};
  })()`, scope());
  assert.ok(result.hq && result.vent);
  for (const [a, b] of result.heights) assert.equal(a, b);
});

test('relief presentation uses the audited interior and continues local edge repairs without changing CPU samples', () => {
  const result = vm.runInContext(`(() => {
    const natural=(x,z)=>20+.02*x+.01*z,surface=new BattlefieldSurface(20,2.5,(x,z)=>natural(x,z)+2),
      before=Array.from(surface.heights),field=battlefieldReliefField(20,surface,natural,60,5,20),checks=[];
    for(const [x,z]of [[0,0],[20,0],[25,0],[60,0]]){
      const i=((z+60)/5+1)*field.size+(x+60)/5+1,
        fade=clamp(1-(Math.max(Math.abs(x),Math.abs(z))-20)/32,0,1),
        expected=Math.max(Math.abs(x),Math.abs(z))<=20?surface.heightAt(x,z):natural(x,z)+2*fade*fade*(3-2*fade);
      checks.push([field.heights[i]+.13,expected]);
    }
    return {checks,unchanged:JSON.stringify(before)===JSON.stringify(Array.from(surface.heights)),innerExtent:field.innerExtent};
  })()`, scope());
  assert.ok(result.unchanged);
  assert.equal(result.innerExtent, 20);
  for (const [a, b] of result.checks) assert.ok(Math.abs(a - b) < 1e-5);
});
