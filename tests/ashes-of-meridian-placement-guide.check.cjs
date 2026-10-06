// Read-only placement batches: no simulation steps, AI, world generation or WebGL.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {loadScripts,BATTLEFIELD_SCRIPTS,SIMULATION_SCRIPTS} = require('./helpers/game-scripts.cjs');
let cpuNow=0;
const context = loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world',...SIMULATION_SCRIPTS,'world-view','placement-guide'],
  {globals:{performance:{now:()=>cpuNow},PLACEMENT_GUIDE_MATERIAL:-9}});
const {MeridianGame,BattlefieldSurface,PlacementGuideSampler,PlacementGuideRings,BUILDINGS,distance,UNIT_BODY_SCALE} = vm.runInContext(
  '({MeridianGame,BattlefieldSurface,PlacementGuideSampler,PlacementGuideRings,BUILDINGS,distance,UNIT_BODY_SCALE})',context);
vm.runInContext('Math.random = seeded = () => { throw Error("Unexpected placement RNG"); }',context);
function fixture(team=0) {
  const game=Object.create(MeridianGame.prototype), n=90, length=n*n;
  const idx=(x,z)=>Math.max(0,Math.min(n-1,Math.floor((z+90)/2)))*n+Math.max(0,Math.min(n-1,Math.floor((x+90)/2)));
  const surface=new BattlefieldSurface(90,2.5,()=>0);
  const world={extent:90,cellSize:2,viewTeam:team,surface,staticGrid:new Uint8Array(length),idx,
    terrainFree:(a,b,r)=>surface.segment(a,b,r),
    sight:Array.from({length:2},()=>({visible:new Uint8Array(length).fill(1),explored:new Uint8Array(length).fill(1)}))};
  world.explored=world.sight[team].explored;
  const unit=(id,x,z,type='rifle',extra={})=>({id,team,kind:'unit',type,hp:100,size:1,x,z,order:{type:'idle'},...extra});
  const building=(id,x,z,type)=>({id,team,kind:'building',type,hp:100,size:BUILDINGS[type].size,x,z,progress:1});
  game.s={rules:{kind:'single-player'},parties:[{faction:0},{faction:0}],supplyCaches:[{x:50,z:50,collected:false}],entities:[
    building(1,-60,-60,'hq'),building(2,-45,-60,'barracks'),building(3,-30,-60,'factory'),unit(4,-60,-45,'worker'),
    unit(5,10,10),unit(6,40,0,'rifle',{exit:{x:-24,z:2,building:2}}),
    {id:7,team:-1,kind:'resource',type:'gas',hp:100,size:1.5,x:18,z:-10},
    {id:8,team:-1,kind:'resource',type:'crystal',hp:100,size:1.3,x:-20,z:30},
    unit(9,2,32,'rifle',{hp:0}),unit(10,-15,-20,'rifle',{size:6})
  ]};
  game.world=world;
  return {game,world,unit,building};
}
function originalSample(game,type,p) {
  const world=game.world, team=game.localTeam, size=BUILDINGS[type].size;
  if(Math.abs(p.x)>=world.extent-4||Math.abs(p.z)>=world.extent-4||!world.sight[team].visible[world.idx(p.x,p.z)]) return 0;
  if(game.s.entities.some(e=>e.hp>0&&!game.observed(e)&&(
    distance(p,e)<size+(e.kind==='unit'?e.size*UNIT_BODY_SCALE+1:e.size+.8)||
    (e.kind==='unit'&&e.exit&&distance(p,e.exit)<size+e.size*UNIT_BODY_SCALE+1)))) return 0;
  return game.canBuild(type,p,team)?-1:1;
}
test('batched placement matches live validation across terrain, bodies, exits, vents and teams',()=>{
  for(const team of [0,1]) {
    const {game,world}=fixture(team);
    world.staticGrid[world.idx(0,0)]=1;
    world.surface.cliffs[world.idx(-10,50)]=1;
    world.sight[team].explored[world.idx(35,35)]=0;
    const before=JSON.stringify(game.s);
    for(const type of ['depot','barracks','hq','refinery']) {
      const sampler=new PlacementGuideSampler(game,type,team);sampler.refresh(Infinity);
      for(let z=-84;z<=84;z+=6) for(let x=-84;x<=84;x+=6) {
        const p={x,z};assert.equal(sampler.sample(p),originalSample(game,type,p),`${type}, team ${team}, ${x},${z}`);
      }
      // Exact bucket boundaries and snapping radius; no coarse body approximation.
      for(const x of [-24,-20,-10,-.01,0,9.99,10,12,18,24,24.01]) for(const z of [-10,0,2,10]) {
        const p={x,z};assert.equal(sampler.sample(p),originalSample(game,type,p));
      }
    }
    assert.equal(JSON.stringify(game.s),before,'sampling does not mutate battle state');
  }
});
test('Forum streets update placement guides with the same live exclusion as direct construction',()=>{
  const {game,building}=fixture(), forum=building(20,0,0,'meridianforum');
  game.s.rules={kind:'single-player',completed:true};
  const corridor=vm.runInContext('forumCorridors',context)(forum)[0],
    p={x:(corridor[0].x+corridor[2].x)/2,z:(corridor[0].z+corridor[2].z)/2},
    sampler=new PlacementGuideSampler(game,'depot',0);
  sampler.refresh();assert.equal(sampler.sample(p),1);
  game.s.entities.push(forum);sampler.refresh();
  assert.match(game.canBuild('depot',p),/streets/);assert.equal(sampler.sample(p),-1);
  forum.visualRotation=1;sampler.refresh();assert.equal(sampler.sample(p),1,'the old street no longer excludes placement after rotation');
  const moved=vm.runInContext('forumCorridors',context)(forum)[0],
    q={x:(moved[0].x+moved[2].x)/2,z:(moved[0].z+moved[2].z)/2};
  assert.match(game.canBuild('depot',q),/streets/);assert.equal(sampler.sample(q),-1,'the rotated street is protected immediately');
  forum.hp=0;sampler.refresh();assert.equal(sampler.sample(p),1);assert.equal(sampler.sample(q),1);
});

test('terrain is cached but workers, blockers, supply caches and refinery occupancy stay live',()=>{
  const {game,world,unit,building}=fixture();let foundations=0,permissions=0;
  const foundation=world.surface.foundation.bind(world.surface), canBuild=game.canBuild.bind(game);
  world.surface.foundation=(...args)=>{foundations++;return foundation(...args);};
  game.canBuild=(...args)=>{permissions++;return canBuild(...args);};
  const sampler=new PlacementGuideSampler(game,'depot',0), p={x:0,z:0};
  sampler.refresh();assert.equal(sampler.sample(p),1);assert.equal(foundations,1);
  for(let i=0;i<100;i++) assert.equal(sampler.sample(p),1);
  assert.equal(permissions,1,'prerequisites checked once per batch');assert.equal(foundations,1);
  game.s.entities.push(unit(20,0,0));sampler.refresh();assert.equal(sampler.sample(p),-1);
  game.s.entities.at(-1).hp=0;sampler.refresh();assert.equal(sampler.sample(p),1);
  game.s.supplyCaches[0].x=0;game.s.supplyCaches[0].z=0;sampler.refresh();assert.equal(sampler.sample(p),-1);
  game.s.supplyCaches[0].collected=true;sampler.refresh();assert.equal(sampler.sample(p),1);
  game.s.entities.find(e=>e.type==='worker').order={type:'build'};sampler.refresh();assert.equal(sampler.sample(p),-1);
  game.s.entities.find(e=>e.type==='worker').order={type:'idle'};sampler.refresh();assert.equal(sampler.sample(p),1);
  assert.equal(foundations,1,'dynamic updates do not repeat terrain validation');
  const refinery=new PlacementGuideSampler(game,'refinery',0), vent=game.s.entities.find(e=>e.type==='gas');
  refinery.refresh();assert.equal(refinery.sample(vent),1);
  game.s.entities.push({...building(21,70,70,'refinery'),gasId:vent.id});
  refinery.refresh();assert.equal(refinery.sample(vent),-1,'occupied vent rejected even if refinery is far away');
});
test('cold terrain validation has a per-frame budget and completes without stale permissions',()=>{
  const {game,world}=fixture();let calls=0;
  const foundation=world.surface.foundation.bind(world.surface);
  world.surface.foundation=(...args)=>{calls++;return foundation(...args);};
  const sampler=new PlacementGuideSampler(game,'depot',0), points=[{x:0,z:0},{x:6,z:0},{x:12,z:0}];
  sampler.refresh(2);
  assert.deepEqual(points.map(p=>sampler.sample(p)),[1,1,0]);assert.equal(calls,2);assert.equal(sampler.pending,true);
  game.s.entities.find(e=>e.type==='worker').order={type:'build'};
  sampler.refresh(2);assert.deepEqual(points.map(p=>sampler.sample(p)),[-1,-1,-1]);
  assert.equal(calls,2);assert.equal(sampler.pending,false,'missing prerequisites end pending work');
  game.s.entities.find(e=>e.type==='worker').order={type:'idle'};
  sampler.refresh(2);assert.deepEqual(points.map(p=>sampler.sample(p)),[1,1,1]);
  assert.equal(calls,3);assert.equal(sampler.pending,false);
});

test('overlapping footprints reuse terrain, prune departed samples and keep blockers live',()=>{
  const {game,world,unit}=fixture();let calls=0;
  const foundation=world.surface.foundation.bind(world.surface);
  world.surface.foundation=(...args)=>{calls++;return foundation(...args);};
  const sampler=new PlacementGuideSampler(game,'depot',0), points=[{x:0,z:0},{x:6,z:0},{x:12,z:0}];
  sampler.refresh();assert.deepEqual(points.map(p=>sampler.sample(p)),[1,1,1]);
  assert.equal(calls,3);
  sampler.retainTerrainFootprint(0,-3,6,3);
  sampler.refresh(0);
  assert.deepEqual(points.map(p=>sampler.sample(p)),[1,1,0]);
  assert.equal(calls,3,'overlap needs no new terrain checks; departed sample is unknown');
  assert.equal(sampler.pending,true);
  game.s.entities.push(unit(20,0,0));
  sampler.refresh();assert.deepEqual(points.map(p=>sampler.sample(p)),[-1,1,1]);
  assert.equal(calls,4,'only the pruned sample is checked again');
});

test('refinery footprint retention includes snapped vents outside the rectangle',()=>{
  const {game,world}=fixture();let calls=0;
  const foundation=world.surface.foundation.bind(world.surface);
  world.surface.foundation=(...args)=>{calls++;return foundation(...args);};
  const sampler=new PlacementGuideSampler(game,'refinery',0), p={x:24,z:-10};
  sampler.refresh();assert.equal(sampler.sample(p),1);assert.equal(calls,1);
  sampler.retainTerrainFootprint(24,-10,30,-4);
  sampler.refresh(0);assert.equal(sampler.sample(p),1);
  assert.equal(calls,1);assert.equal(sampler.pending,false);
});

test('terrain time budget defers only cold queries, retaining live cached validation',()=>{
  const {game,world,unit}=fixture();cpuNow=0;let calls=0;
  const foundation=world.surface.foundation.bind(world.surface);
  world.surface.foundation=(...args)=>{calls++;cpuNow+=2;return foundation(...args);};
  const sampler=new PlacementGuideSampler(game,'depot',0);
  sampler.refresh(64,3);
  assert.equal(sampler.sample({x:0,z:0}),1);
  assert.equal(sampler.sample({x:6,z:0}),1);
  assert.equal(sampler.sample({x:12,z:0}),0);assert.equal(sampler.pending,true);assert.equal(calls,2);
  game.s.entities.push(unit(20,0,0));sampler.refresh(64,cpuNow);
  assert.equal(sampler.sample({x:0,z:0}),-1,'an expired cold-work deadline cannot leave cached permission stale');
  assert.equal(sampler.pending,false);assert.equal(calls,2);
});

function ringFixture(bounds={startX:-18,startZ:-18,endX:18,endZ:18},center={x:0,z:0}) {
  const {game,world}=fixture(),sampler=new PlacementGuideSampler(game,'depot',0),uploads=[],marks=[],releases=[];
  const renderer={streamGeometry:(name,data)=>uploads.push({name,data}),add:(...args)=>marks.push(args),releaseGeometry:name=>releases.push(name)};
  const field=new PlacementGuideRings(renderer,world,sampler,bounds,center);
  return {game,world,field,uploads,marks,releases};
}
test('concentric rings partition the viewport once, narrow outward and honor the chosen view center',()=>{
  const bounds={startX:-30,startZ:-30,endX:30,endZ:30},center={x:12,z:6},h=ringFixture(bounds,center);
  const tiles=Array.from(h.field.rings).flatMap(r=>Array.from(r.tiles));
  assert.equal(tiles.length,400);assert.equal(new Set(tiles).size,400,'no overlaps or holes between ring meshes');
  let previous=-Infinity;
  for(const ring of h.field.rings) {
    const distances=Array.from(ring.tiles,index=>{
      const x=bounds.startX+(index%21)*3,z=bounds.startZ+Math.floor(index/21)*3;
      return Math.max((x-center.x)**2,(x+3-center.x)**2)+Math.max((z-center.z)**2,(z+3-center.z)**2);
    });
    if(distances.length){assert.ok(Math.min(...distances)>=previous);previous=Math.max(...distances);}
  }
  cpuNow=0;for(let frame=0;frame<10&&!h.uploads.length;frame++)h.field.draw('a',frame*20,true);
  assert.equal(h.uploads.length,1);assert.equal(h.uploads[0].name,'placementGuide:0');
  const data=h.uploads[0].data;
  for(let i=0;i<data.length;i+=9) assert.ok((data[i]-center.x)**2+(data[i+2]-center.z)**2<=(42**2+36**2)/12+.01);
  const areaStep=(42**2+36**2)/12;
  assert.ok(Math.sqrt(areaStep)>Math.sqrt(2*areaStep)-Math.sqrt(areaStep),'initial disk is broader than the next annulus');
  assert.ok(Math.sqrt(2*areaStep)-Math.sqrt(areaStep)>Math.sqrt(3*areaStep)-Math.sqrt(2*areaStep));
});
test('cold rings appear before completion, obey a soft CPU budget and fade without mesh uploads',()=>{
  const h=ringFixture(),before=JSON.stringify(h.game.s);cpuNow=0;let calls=0,firstUpload=-1;
  const foundation=h.world.surface.foundation.bind(h.world.surface);
  h.world.surface.foundation=(...args)=>{calls++;cpuNow++;return foundation(...args);};
  let frame=0;
  for(;frame<100;frame++) {
    const count=calls;h.field.draw('a',frame*20,false);
    assert.ok(calls-count<=3,'new terrain work stops at the frame deadline');
    if(firstUpload<0 && h.uploads.length){firstUpload=frame;assert.ok(h.field.nextRing<12);}
    if(h.field.nextRing===12)break;
  }
  assert.ok(firstUpload>=0 && firstUpload<frame);assert.equal(h.field.nextRing,12,'bounded work must still finish');
  assert.ok(h.marks.some(m=>m[12]>0 && m[12]<.65),'independent eased fades');
  assert.ok(h.uploads.length<=12,'GPU batches are capped');
  const completed=h.uploads.length;
  h.field.draw('a',frame*20+200,false);h.field.draw('a',frame*20+220,false);
  assert.equal(h.uploads.length,completed,'animation alone never regenerates or uploads geometry');
  assert.ok(h.marks.at(-1)[12]===.65);
  assert.equal(JSON.stringify(h.game.s),before,'no simulation or RNG mutation');
  h.field.dispose();assert.deepEqual(new Set(h.releases),new Set(h.uploads.map(u=>u.name)));
});
test('shared fine-grid heights are evaluated once, not per triangle or ring revision',()=>{
  const h=ringFixture();cpuNow=0;let calls=0;
  h.field.sampler.refresh=()=>{h.field.sampler.pending=false;};h.field.sampler.sample=()=>1;
  h.world.surface.heightAt=()=>{calls++;return 3;};
  for(let frame=0;frame<30;frame++)h.field.draw('a',frame*20,true);
  assert.equal(calls,25*25,'one CPU height per shared fine vertex');
  h.field.sampler.sample=()=>-1;h.field.draw('b',600,true);
  assert.equal(calls,25*25,'new colors keep the original terrain mesh positions');
});

test('unseen rings allocate no GPU meshes but are prepared when visibility returns',()=>{
  const h=ringFixture();cpuNow=0;h.world.sight[0].visible.fill(0);
  for(let frame=0;frame<30;frame++)h.field.draw('hidden',frame*20,true);
  assert.equal(h.field.nextRing,12);assert.equal(h.uploads.length,0);assert.equal(h.marks.length,0);
  h.world.sight[0].visible.fill(1);
  for(let frame=0;frame<30;frame++)h.field.draw('visible',600+frame*20,true);
  assert.ok(h.uploads.length>0);assert.ok(h.marks.length>0);
});

test('ring revisions hide deferred live colors while retaining completed geometry and reduced motion skips fades',()=>{
  const h=ringFixture();cpuNow=0;
  for(let frame=0;frame<30;frame++)h.field.draw('a',frame*20,true);
  assert.ok(h.marks.every(m=>m[12]===.65));
  const storage=new Map(h.uploads.map(u=>[u.name,u.data])),complete=h.uploads.length;
  h.field.draw('b',600,true);assert.equal(h.uploads.length,complete,'unchanged revisions keep all buffers');
  h.world.sight[0].visible.fill(0);h.field.draw('c',620,true);
  assert.ok(h.uploads.slice(complete).every(u=>Array.from(u.data).filter((_,i)=>i%9>=6).every(v=>v===0)),
    'visibility loss cannot leave old build colors in any ring');
  h.world.sight[0].visible.fill(1);h.field.draw('d',640,true);
  assert.ok(h.uploads.every(u=>u.data===storage.get(u.name)),'revisions reuse geometry storage');
  const marks=h.marks.length;
  h.field.sampler.refresh=()=>{h.field.sampler.pending=true;};
  h.field.draw('e',660,true);assert.equal(h.marks.length,marks,'no stale ring is drawn when revalidation is deferred');
});

test('unseen blockers and exits remain transparent, before refinery snapping too',()=>{
  const {game,world,unit}=fixture();
  const hidden=unit(20,24,-10,'rifle',{team:1,exit:{x:-5,z:0,building:2}});
  game.s.entities.push(hidden);world.sight[0].visible[world.idx(hidden.x,hidden.z)]=0;
  for(const type of ['depot','refinery']) {
    const sampler=new PlacementGuideSampler(game,type,0);sampler.refresh();
    for(const p of [{x:22,z:-10},{x:-5,z:1},{x:24,z:-10}]) {
      assert.equal(sampler.sample(p),0,`${type}: no hidden occupancy hint`);
      assert.equal(sampler.sample(p),originalSample(game,type,p));
    }
    hidden.hp=0;sampler.refresh();assert.equal(sampler.sample({x:22,z:-10}),originalSample(game,type,{x:22,z:-10}));
    hidden.hp=100;
  }
});
