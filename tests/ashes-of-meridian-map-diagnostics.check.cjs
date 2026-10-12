const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { BATTLEFIELD_SCRIPTS, loadScripts } = require('./helpers/game-scripts.cjs');

function scope() {
  return loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'map-diagnostics', 'capture'], {
    globals: { MERIDIAN_BUILD_INFO: { id: 'diagnostic-test-build', commit: null, dirty: false } },
  });
}
const fixture = `const surface=new BattlefieldSurface(40,2.5,(x,z)=>20),
  world={extent:40,cellSize:2.5,gridSize:32,seed:101,terrainSeed:101,surface,
    definition:BATTLEFIELDS.frontier,renderProfile:{variation:{id:'test-recipe'}},
    layout:{economyRegions:battlefieldEconomyRegions([{x:0,z:0}]),corridors:[[[-20,-20],[20,20]]]},
    startSites:[{x:-20,z:-20},{x:20,z:20}],idx:Battlefield.prototype.idx,point:Battlefield.prototype.point},
  anchors={world:{x:0,z:0},player:{x:-20,z:-20},enemy:{x:20,z:20}};`;

test('map diagnostics use final terrain without RNG, generation or world mutation', () => {
  const result = vm.runInContext(`(()=>{${fixture}
    const before=JSON.stringify(world),old=seeded;
    seeded=()=>{throw Error('Diagnostics cannot draw RNG');};
    const data=analyzeMapDiagnostics(world,'frontier',anchors);
    seeded=old;
    return {report:data.report,unchanged:before===JSON.stringify(world),
      mainPaths:data.mainPaths.length,cliffPaths:data.cliffPaths.length,
      samples:data.foundations.map(p=>({suitable:p.suitable,point:p.point})),
      points:[...data.mainPaths.flat(),...data.corridors.flat(),...data.candidates]};
  })()`, scope());
  assert.equal(result.unchanged, true);
  const r = result.report;
  assert.equal(r.map, 'frontier');
  assert.equal(r.seed, 101);
  assert.equal(r.recipe, 'test-recipe');
  assert.deepEqual(JSON.parse(JSON.stringify(r.height)), { min: 20, max: 20 });
  assert.equal(r.broad.components, 1);
  assert.equal(r.broad.largestShare, 1);
  assert.equal(r.broad.interiorCoverage, 1);
  assert.equal(r.vehicle.components, 1);
  assert.equal(r.economy.anchors, 7);
  assert.equal(r.economy.accessibleAnchors, 7);
  assert.equal(r.economy.broadHubs, 1);
  assert.equal(r.deployment.candidates, 2);
  assert.equal(r.deployment.landings.length, 2);
  assert.equal(r.hqSample.spacing, 10);
  assert.equal(r.hqSample.tested, result.samples.length);
  assert.equal(r.hqSample.suitable, result.samples.filter(p => p.suitable).length);
  assert.equal(r.warnings.length, 0);
  assert.ok(result.mainPaths > 0);
  assert.equal(result.cliffPaths, 0);
  assert.ok(result.points.every(p => p.every(Number.isFinite) && Math.abs(p[1] - 20.2) < 1e-8));
});

test('disconnected and cliff regions remain visible and produce qualified warnings', () => {
  const result = vm.runInContext(`(()=>{${fixture}
    world.surface=new BattlefieldSurface(40,2.5,(x,z)=>x<0?20:50);
    const data=analyzeMapDiagnostics(world,'frontier',anchors);
    return {report:data.report,detached:data.detachedPaths.length,cliffs:data.cliffPaths.length};
  })()`, scope());
  assert.ok(result.report.broad.components >= 2);
  assert.ok(result.report.broad.largestShare < 0.94);
  assert.ok(result.report.cliffs.fraction > 0);
  assert.ok(result.detached > 0 && result.cliffs > 0);
  assert.ok(result.report.warnings.some(w => /disconnected/.test(w)));
  assert.ok(result.report.limitations.some(w => /terrain-only/.test(w)));
  assert.ok(result.report.limitations.some(w => /not actual paths/.test(w)));
});

test('cached annotations redraw without height queries and expire with the world', () => {
  const result = vm.runInContext(`(()=>{${fixture}
    const diagnostics=new MeridianMapDiagnostics(),first=diagnostics.analyze(world,'frontier',anchors),
      same=diagnostics.analyze(world,'frontier',anchors)===first,calls=[];
    surface.heightAt=()=>{throw Error('Drawing must use cached world points');};
    const ctx={save(){},restore(){},setLineDash(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},
      arc(){},stroke(){calls.push('stroke');},fill(){calls.push('fill');},strokeText(){},fillText(){}};
    for(const layer of MAP_DIAGNOSTIC_LAYERS)diagnostics.layers[layer]=true;
    diagnostics.draw(ctx,(x,y,z)=>({x,y:z}));const drawn=calls.length;
    calls.length=0;
    for(const layer of MAP_DIAGNOSTIC_LAYERS)diagnostics.layers[layer]=false;
    diagnostics.draw(ctx,(x,y,z)=>({x,y:z}));const off=calls.length;
    diagnostics.invalidate();diagnostics.draw(ctx,(x,y,z)=>({x,y:z}));
    world.surface=new BattlefieldSurface(40,2.5,()=>30);
    const next=diagnostics.analyze(world,'frontier',anchors);
    return {same,drawn,off,changed:next!==first,nextHeight:next.report.height.min};
  })()`, scope());
  assert.equal(result.same, true);
  assert.ok(result.drawn > 0);
  assert.equal(result.off, 0);
  assert.equal(result.changed, true);
  assert.equal(result.nextHeight, 30);
});

test('route reports compare resolved geometry, sampled earthworks and cached height profiles without mutation', () => {
  const result=vm.runInContext(`(()=>{${fixture}
    world.layout.corridors=[[[-20,-20],[0,20],[20,20]]];
    world.corridorPlan={links:[[[-20,-20],[20,20]]],corridors:world.layout.corridors,before:()=>24,height:()=>20,
      straightReference:()=>()=>18,expandedNodes:17,repairs:1};
    const before=JSON.stringify(world),diagnostics=new MeridianMapDiagnostics();
    seeded=()=>{throw Error('No analysis RNG');};
    const data=diagnostics.analyze(world,'frontier',anchors),report=data.report;
    world.corridorPlan.before=world.corridorPlan.height=world.corridorPlan.straightReference=()=>{throw Error('Drawing cannot refit terrain');};
    surface.heightAt=()=>{throw Error('Drawing cannot query terrain');};
    const calls=[],ctx={canvas:{width:480,height:160},clearRect(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},
      fillText(){},stroke(){calls.push('stroke');}};
    diagnostics.drawProfile(ctx);
    return {report,unchanged:before===JSON.stringify(world),cuts:data.cutPaths.length,fills:data.fillPaths.length,
      straightPoints:data.originalLinks[0].length,curvedPoints:data.corridors[0].length,drawn:calls.length};
  })()`,scope());
  assert.ok(result.unchanged && result.cuts>0);
  assert.equal(result.fills,0);
  assert.equal(result.report.schema,2);
  const r=result.report.corridors,m=r.modification;
  assert.equal(r.expandedNodes,17);assert.equal(r.repairs,1);assert.ok(r.allCoresClear && r.meanDetour>1);
  assert.equal(m.sampledCutVolume,25600);assert.equal(m.sampledFillVolume,0);
  assert.equal(m.sampledAbsoluteVolume,25600);assert.equal(m.changedFraction,1);
  assert.equal(m.straightDatumReference.sampledAbsoluteVolume,38400);
  assert.match(m.straightDatumReference.limitation,/before connectivity repairs/);
  assert.ok(r.routes[0].samples.every(p=>p.before===24&&p.planned===20&&p.final===20));
  assert.ok(result.curvedPoints>result.straightPoints && result.drawn===4);
});

test('report export includes build provenance, returns value copies and rejects stale or busy scenes', () => {
  const result = vm.runInContext(`(()=>{${fixture}
    const c=new MeridianCapture({world,s:{map:'frontier',seed:101}},{},{},()=>{});
    c.readyToDraw=true;c.mapDiagnostics=new MeridianMapDiagnostics();
    c.mapDiagnostics.analyze(world,'frontier',anchors);
    const report=c.exportMapDiagnostics();report.broad.sectorCoverage[0]=-1;
    const copy=c.exportMapDiagnostics();c.busy=true;
    let busy=false,stale=false;
    try{c.exportMapDiagnostics();}catch(e){busy=true;}
    c.busy=false;c.mapDiagnostics.invalidate();
    try{c.exportMapDiagnostics();}catch(e){stale=true;}
    return {copy,busy,stale};
  })()`, scope());
  assert.equal(result.copy.build.id, 'diagnostic-test-build');
  assert.equal(result.copy.broad.sectorCoverage[0], 1);
  assert.equal(result.busy, true);
  assert.equal(result.stale, true);
});
