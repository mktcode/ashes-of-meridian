// Bounded generation-only cases; no ecology, AI, simulation ticks or reference regeneration.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { BATTLEFIELD_SCRIPTS, loadScripts } = require('./helpers/game-scripts.cjs');
const json = value => JSON.parse(JSON.stringify(value));
const scope = () => loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world']);
const fixture = `const size={extent:100,cellSize:2.5},layout={startSites:[],resourceSites:[],economyRegions:[],corridors:[[[-65,0],[65,0]]]};`;

test('bounded routes detour around a hill without changing the graph or consuming RNG', () => {
  const r = vm.runInContext(`(()=>{${fixture}
    const before=(x,z)=>20+28*Math.exp(-(x*x+z*z)/300),signature=JSON.stringify(layout);
    seeded=()=>{throw Error('Route planning cannot draw RNG');};
    const p=planBattlefieldCorridors(size,layout,before),again=planBattlefieldCorridors(size,layout,before),
      route=p.corridors[0],s=new BattlefieldSurface(size.extent,size.cellSize,p.height),
      closest=Math.min(...route.slice(1).map(([x,z],i)=>pointSegment({x:0,z:0},{x:route[i][0],z:route[i][1]},{x,z})));
    return {same:JSON.stringify(p.corridors)===JSON.stringify(again.corridors),unchanged:signature===JSON.stringify(layout),
      route,links:p.links,expanded:p.expandedNodes,closest,clear:battlefieldCorridorsClear(s,p.corridors),hill:s.heightAt(0,0)};
  })()`, scope());
  assert.ok(r.same && r.unchanged && r.clear);
  assert.deepEqual(json(r.links), [[[-65, 0], [65, 0]]]);
  assert.deepEqual(json(r.route[0]), [-65, 0]);
  assert.deepEqual(json(r.route.at(-1)), [65, 0]);
  assert.ok(r.route.length > 2 && r.closest > 18);
  assert.ok(r.hill > 38, 'the avoided summit must not be flattened to the old datum');
  assert.ok(r.expanded > 0 && r.expanded <= 41 * 41);
});

test('width costs prefer the broad center of a natural pass and do not fill its floor', () => {
  const r = vm.runInContext(`(()=>{${fixture}layout.corridors=[[[-65,8],[65,8]]];
    const before=(x,z)=>20+24*Math.exp(-x*x/160)*battlefieldSmooth((Math.abs(z)-14)/12),
      p=planBattlefieldCorridors(size,layout,before),route=p.corridors[0],crossings=[];
    for(let i=1;i<route.length;i++){const [ax,az]=route[i-1],[bx,bz]=route[i];if(ax<=0&&bx>=0&&bx!==ax)crossings.push(az+(bz-az)*(-ax)/(bx-ax));}
    return {crossings,height:p.height(0,0),clear:battlefieldCorridorsClear(new BattlefieldSurface(size.extent,size.cellSize,p.height),p.corridors)};
  })()`, scope());
  assert.ok(r.clear && r.crossings.length);
  assert.ok(r.crossings.every(z => Math.abs(z) < 5));
  assert.equal(r.height, 20);
});

test('a flat centerline does not hide an expensive cross-slope', () => {
  const r = vm.runInContext(`(()=>{${fixture}
    const before=(x,z)=>30+.6*z*Math.exp(-(x*x+z*z)/1000),p=planBattlefieldCorridors(size,layout,before);
    return {lateral:Math.max(...p.corridors[0].map(p=>Math.abs(p[1]))),clear:battlefieldCorridorsClear(new BattlefieldSurface(size.extent,size.cellSize,p.height),p.corridors)};
  })()`, scope());
  assert.ok(r.clear);
  assert.ok(r.lateral > 12);
});

test('simplification and rounded corners cannot shortcut protected economic areas', () => {
  const r = vm.runInContext(`(()=>{${fixture}
    layout.economyRegions=battlefieldEconomyRegions([{x:-65,z:0},{x:65,z:0},{x:0,z:0}]);
    const before=()=>24,p=planBattlefieldCorridors(size,layout,before),route=p.corridors[0],foreign=layout.economyRegions[2];
    return {protected:foreign.rampProtection.every(site=>route.slice(1).every(([x,z],i)=>
      pointSegment(site,{x:route[i][0],z:route[i][1]},{x,z})>=site.radius+6)),
      preserved:layout.economyRegions.every(region=>[region.hq,region.vent,...region.crystals].every(q=>p.height(q.x,q.z)===24)),
      clear:battlefieldCorridorsClear(new BattlefieldSurface(size.extent,size.cellSize,p.height),p.corridors),points:route.length};
  })()`, scope());
  assert.ok(r.protected && r.preserved && r.clear);
  assert.ok(r.points > 2 && r.points <= 128);
});

test('all polyline legs are fitted; corner influences do not double-count one route', () => {
  const r = vm.runInContext(`(()=>{${fixture}
    layout.corridors=[[[-60,-30],[30,-30],[30,-30],[30,60]]];
    const field=fitBattlefieldCorridors(size,[],layout.corridors,()=>40,()=>20),
      legacy=fitBattlefieldEconomy(size,layout,{datum:()=>20,height:()=>40},[],BUILDINGS.hq.size);
    return {last:field(30,45),legacyLast:legacy(30,45),corner:field(15,-15),expected:20+20*battlefieldSmooth(3/24),
      outside:field(95,95),finite:[[30,-30],[15,-15],[30,45]].every(([x,z])=>Number.isFinite(field(x,z)))};
  })()`, scope());
  assert.equal(r.last, 20);
  assert.equal(r.legacyLast, 20);
  assert.equal(r.corner, r.expected);
  assert.equal(r.outside, 40);
  assert.ok(r.finite);
});

test('intersections share one height, and gently graded high terrain is not penalized by altitude', () => {
  const r = vm.runInContext(`(()=>{${fixture}
    const crossing=fitBattlefieldCorridors(size,[],[[[-60,0],[60,0]],[[0,-60],[0,60]]],x=>40+.1*x,x=>30+.1*x),
      before=x=>50+.1*x,p=planBattlefieldCorridors(size,layout,before),s=new BattlefieldSurface(size.extent,size.cellSize,p.height);
    return {crossing:crossing(0,0),outside:crossing(95,95),clear:battlefieldCorridorsClear(s,p.corridors),
      unchanged:[[-60,0],[0,0],[60,0]].every(([x,z])=>Math.abs(p.height(x,z)-before(x,z))<1e-9),points:p.corridors[0].length};
  })()`, scope());
  assert.equal(r.crossing, 30);
  assert.equal(r.outside, 49.5);
  assert.ok(r.clear && r.unchanged);
  assert.equal(r.points, 2);
});

test('a cheap serpentine cannot escape the cumulative detour budget', () => {
  const r=vm.runInContext(`(()=>{${fixture}layout.corridors=[[[-60,-30],[60,-30]]];
    const snake=[[-60,-30],[-60,55],[10,55],[10,-55],[60,-55],[60,-30]].map(([x,z])=>({x,z})),
      before=(x,z)=>20+40*battlefieldSmooth((Math.min(...snake.slice(1).map((q,i)=>pointSegment({x,z},snake[i],q)))-14)/12),
      grid=battlefieldCorridorGrid(size.extent,before),initial=routeBattlefieldCorridor(size,snake[0],snake.at(-1),[],grid),
      p=planBattlefieldCorridors(size,layout,before),route=p.corridors[0],
      length=route.slice(1).reduce((sum,b,i)=>sum+Math.hypot(b[0]-route[i][0],b[1]-route[i][1]),0);
    return {initial:initial.withinBudget,length,passes:p.searchPasses,constrained:p.lengthConstrainedRoutes,expanded:p.expandedNodes,
      clear:battlefieldCorridorsClear(new BattlefieldSurface(size.extent,size.cellSize,p.height),p.corridors)};
  })()`,scope());
  assert.equal(r.initial,false);
  assert.ok(r.clear && r.length<=280 && r.passes>1 && r.passes<=4);
  assert.equal(r.constrained,1);assert.ok(r.expanded<=4*41*41);
});

test('an impassable protected wall fails within the search budget, without a replacement seed', () => {
  const r = vm.runInContext(`(()=>{${fixture}
    const region=battlefieldEconomyRegion({x:0,z:0});layout.economyRegions=[{...region,
      rampProtection:Array.from({length:9},(_,i)=>({x:0,z:(i-4)*25,radius:20}))}];
    seeded=()=>{throw Error('No replacement seed');};
    try{planBattlefieldCorridors(size,layout,()=>24);return '';}catch(e){return e.message;}
  })()`, scope());
  assert.match(r, /Economic corridor search budget exhausted/);
});

test('three fixed family cases retain economic supports and final-surface contracts', () => {
  const context = scope();
  for (const [map, seed] of [['desert', 1409], ['westmark', 1409], ['haven', 19]]) {
    const r = vm.runInContext(`(()=>{
      const d=BATTLEFIELDS[${JSON.stringify(map)}],seed=${seed},size=d.createSize(seed),
        w={...size,terrainSeed:seed,layout:d.createLayout(seed,size),landscape:resolveBattlefieldLandscape(d.family,d.render,seed)},
        original=JSON.stringify(w.layout),p=dynamicTerrainPlan(w),s=connectBattlefieldTerrain(w,p.height,p),
        regions=battlefieldTerrainRegions(s),coverage=battlefieldTerrainCoverage(s,regions),
        footprintPreserved=w.layout.economyRegions.every(r=>[r.hq,r.vent].every(q=>[-4,0,4].every(dx=>[-4,0,4].every(dz=>
          p.height(q.x+dx,q.z+dz)===p.before(q.x+dx,q.z+dz)))));
      return {unchanged:original===JSON.stringify(w.layout),sameGraph:JSON.stringify(p.links)===JSON.stringify(w.layout.corridors),
        routes:p.corridors.length,expanded:p.expandedNodes,budget:4*(Math.round(w.extent*2/5)+1)**2*p.corridors.length,
        clear:battlefieldCorridorsClear(s,p.corridors),economy:battlefieldTerrainEconomyConnected(s,w.layout.economyRegions),
        hq:w.layout.economyRegions.every(r=>s.foundation(r.hq,BUILDINGS.hq.size)&&s.fits(r.hq.x,r.hq.z,9)),footprintPreserved,
        broadShare:regions.groups[0].length/regions.groups.reduce((sum,g)=>sum+g.length,0),
        significantIslands:regions.groups.slice(1).some(g=>g.length>=64),coverage,repairs:p.repairs};
    })()`, context);
    assert.ok(r.unchanged && r.sameGraph && r.clear && r.economy && r.hq && r.footprintPreserved, `${map}/${seed}`);
    assert.ok(r.expanded > 0 && r.expanded <= r.budget);
    assert.ok(r.broadShare >= .94 && !r.significantIslands);
    assert.ok(r.coverage.fraction >= .55 && r.coverage.sectors.every(p => p >= .25));
    assert.ok(r.repairs >= 0 && r.repairs <= 8);
  }
});
