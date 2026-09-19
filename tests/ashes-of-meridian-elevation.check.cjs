// Bounded surface/navigation/presentation checks, not autonomous AI or simulation long runs.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {createRendererStub} = require('./helpers/renderer-stub.cjs');
const {loadScripts, BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS, RENDERER_SCRIPTS} = require('./helpers/game-scripts.cjs');
const context = loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world','effects',...SIMULATION_SCRIPTS,
  ...RENDERER_SCRIPTS,'world-view','effects-view','multiplayer-presentation'], {globals:{innerHeight:800}});
const {Battlefield, BattlefieldSurface, MeridianGame, MeridianRenderer, MeridianEffects, BattlefieldView, renderEntity,
  battlefieldStartSites, UNITS, UNIT_BODY_SCALE, MultiplayerTimeline} = vm.runInContext(
  '({Battlefield, BattlefieldSurface, MeridianGame, MeridianRenderer, MeridianEffects, BattlefieldView, renderEntity, battlefieldStartSites, UNITS, UNIT_BODY_SCALE, MultiplayerTimeline})',context);
function game() {
  const g = new MeridianGame({upgrades:{}}); g.start({seed:1409,map:'mothership'});
  g.s.parties.forEach(p=>p.controller={kind:'human'});
  return g;
}

test('surface height and ray use the same diagonal, including non-planar quads',()=>{
  const s = new BattlefieldSurface(10,2.5,(x,z)=>x===0&&z===0?4:0);
  for (const [x,z,expected] of [[0,0,4],[.625,.625,2],[.625,0,2],[0,.625,2]]) {
    assert.equal(s.heightAt(x,z),expected);
    const hit = s.ray([x,20,z],[x,-20,z]); assert.ok(hit);
    assert.ok(Math.abs(hit.x-x)<1e-8 && Math.abs(hit.z-z)<1e-8);
  }
  assert.equal(s.ray([30,20,30],[30,-20,30]),null);
  assert.ok(Number.isFinite(s.heightAt(1e6,-1e6)));
});

test('four high Mothership starts, flat initial economy and connected low central battlefield',()=>{
  const w = new Battlefield(1409,'mothership'), sites = battlefieldStartSites(w);
  assert.equal(w.surface.heightAt(0,0),0);
  for (const site of sites) {
    assert.equal(w.surface.heightAt(site.x,site.z),6);
    assert.ok(w.surface.foundation(site,7));
    const route = w.path(site.x,site.z,0,0,false,undefined,UNITS.tank.size*UNIT_BODY_SCALE);
    assert.equal(route.status,'complete',JSON.stringify(site));
    let from = site;
    for (const p of route.points) { assert.ok(w.lineFree(from,p,UNITS.tank.size*UNIT_BODY_SCALE)); from=p; }
  }
  for (const [i,p] of w.layout.resourceSites.entries()) {
    const vent={x:p.x+(i?7:5),z:p.z+(i?7:18)};
    assert.ok(w.surface.foundation(vent,2.3),`vent ${i}`);
  }
  assert.ok(Math.abs(w.surface.heightAt(42,28)-3)<1e-6);
  assert.ok(w.terrainFree({x:42,z:10},{x:42,z:50},2));
  assert.equal(w.terrainFree({x:80,z:20},{x:80,z:50}),false);
  assert.equal(w.terrainFree({x:80,z:50},{x:80,z:20}),false);
});

test('surface transition mask survives replacement of dynamic occupancy, and paths cannot smooth across cliffs',()=>{
  const w = new Battlefield(1409,'mothership'); w.blocked.fill(0);
  const a={x:80,z:25}, b={x:80,z:50};
  assert.equal(w.lineFree(a,b),false);
  const route=w.path(a.x,a.z,b.x,b.z,false,undefined,1);
  assert.equal(route.status,'complete'); assert.ok(route.points.length>1);
  let from=a; for(const p of route.points) {assert.ok(w.terrainFree(from,p,1));from=p;}
  assert.equal(w.surface.fits(80,34,2),false,'body clearance before the cliff');
  for(const radius of [1,2,3]) for(let x=-80;x<=80;x+=7) for(let z=-80;z<=80;z+=7) {
    if(w.surface.fits(x,z,radius)) assert.ok(w.surface.segment({x,z},{x,z},radius),'accepted positions are not trapped in expanded cliff bounds');
  }
});

test('ground step, yield and placement cannot tunnel across a cliff; aircraft can cross',()=>{
  const g=game(); g.s.entities=[];g.ids.clear();g.world.rebuild([]);
  const w=g.spawnUnit('worker',80,30,0,0), air=g.spawnUnit('air',80,30,0,0);
  assert.ok(w&&air);
  assert.equal(g.canStep(w,80,45),false);
  assert.equal(g.canStep(air,80,45),true);
  w.yieldTo={x:80,z:45};w.yieldUntil=10;g.moveYield(w,10);
  assert.equal(w.z,30,'large dt must not tunnel');
  assert.equal(g.unitPosition({type:'worker',size:UNITS.worker.size,x:80,z:36}),null,'no teleport from a cliff into a nearby plateau');
  const height=g.world.surface;
  assert.equal(height.entityHeight(air),6);
  air.z=50;assert.equal(height.entityHeight(air),6,'fixed cruise height across a cliff');
});

test('worker crosses a ramp up and down using ordinary orders',()=>{
  const g=game();g.s.entities=[];g.ids.clear();g.world.rebuild([]);
  const w=g.spawnUnit('worker',42,10,0,0); assert.ok(w);
  for (const goal of [{x:42,z:50},{x:42,z:10}]) {
    g.setOrder(w,{type:'move',...goal}); let arrived=false;
    for(let i=0;i<220&&!arrived;i++) {g.s.time+=.05;arrived=g.move(w,goal,.05);assert.ok(g.unitFits(w,w.x,w.z));}
    assert.ok(arrived,JSON.stringify(w));
  }
});

test('foundations reject slopes/cliff edges; legal plateau production exits remain on its level',()=>{
  const g=game();g.world.sight[0].explored.fill(1);
  g.s.entities=[];g.ids.clear();g.world.rebuild([]);
  const worker=g.spawnUnit('worker',42,55,0,0);assert.ok(worker);
  assert.match(g.canBuild('depot',{x:42,z:28}),/level ground/);
  assert.match(g.canBuild('depot',{x:80,z:40}),/level ground/);
  assert.equal(g.canBuild('depot',{x:42,z:46}),'');
  assert.ok(g.world.surface.foundation({x:76,z:-47},4.4));
  assert.match(g.canBuild('hq',{x:76,z:-47}),/production exits/);
  const h=g.spawnBuilding('hq',42,50,0,0);g.world.rebuild(g.s.entities);
  const u=g.produceUnit(h,'worker');assert.ok(u?.exit);
  assert.equal(g.world.surface.heightAt(u.exit.x,u.exit.z),6);
  assert.ok(g.world.terrainFree(u,u.exit,u.size*UNIT_BODY_SCALE));
});

test('close worker cannot repair or deliver through a cliff and area navigation seeks the accessible level',()=>{
  const g=game();g.s.entities=[];g.ids.clear();g.world.rebuild([]);
  const b=g.spawnBuilding('hq',80,40,0,0), w=g.spawnUnit('worker',80,33,0,0);
  assert.ok(w);b.hp-=100;w.order={type:'repair',id:b.id};
  const hp=b.hp;g.worker(w,.05);assert.equal(b.hp,hp);
  w.order={type:'mine',id:999};w.carry=18;w.returning=true;
  const alloy=g.account(0).alloy;g.worker(w,.05);assert.equal(g.account(0).alloy,alloy);
  assert.equal(w.carry,18);
  const route=g.world.path(80,30,80,40,false,{x:80,z:40,radius:8});
  assert.equal(route.status,'complete');assert.ok(route.goal.z>=40);
});

test('CPU effect origins, targets, shell landing and particle floor include surface height without extra RNG draws',()=>{
  const g=game(), a={x:42,z:50,type:'tank',kind:'unit',team:0,faction:0,rot:0,size:1},
    b={...a,x:0,z:0}; let draws=0;
  g.effects.random=()=>{draws++;return .5;};
  g.effects.shot(a,b);let f=g.effects.fx.at(-1);
  assert.equal(f.y,7.45);assert.equal(f.ty,1);
  g.effects.shell(b,a,.85);f=g.effects.fx.at(-1);assert.equal(f.endY,6);
  assert.equal(draws,0);
  g.effects.explosion(42,50);const before=draws;
  const flat=new MeridianEffects(()=>.5);flat.explosion(42,50);
  for(const [i,fx] of g.effects.fx.slice(2).entries()) if('y' in fx) assert.equal(fx.y-flat.fx[i].y,6);
  g.effects.tick(.05);assert.equal(draws,before);
});

test('terrain picking roundtrips both plateaus and ramp while camera drag keeps its flat plane',()=>{
  const w=new Battlefield(1409,'mothership'),r=Object.create(MeridianRenderer.prototype);
  Object.assign(r,{viewport:{left:0,top:0,right:1200,bottom:800,width:1200,height:800},quality:0,surface:w.surface});
  r.camera(42,30,85);
  for(const [x,z] of [[42,50],[42,28],[0,0],[-42,-50]]) {
    const screen=r.project(x,w.surface.heightAt(x,z),z),hit=r.ground(screen.x,screen.y);
    assert.ok(Math.hypot(hit.x-x,hit.z-z)<1e-4,JSON.stringify({x,z,hit}));
    const flat=r.ground(screen.x,screen.y,false),p=r.project(flat.x,0,flat.z);
    assert.ok(Math.hypot(p.x-screen.x,p.y-screen.y)<1e-4);
  }
});

test('network interpolated ground poses sample the ramp rather than a chord through the terrain',()=>{
  const w=new Battlefield(1409,'mothership'),timeline=new MultiplayerTimeline(),
    unit={id:1,x:42,z:16,rot:0,walk:0,kind:'unit',type:'rifle'};
  // Use a short accepted interpolation interval around the lower ramp corner.
  timeline.push({time:1,entities:[{...unit,z:16}],effects:[]},1000);
  timeline.push({time:1.2,entities:[{...unit,z:22}],effects:[]},1200);
  timeline.advance(1220,()=>{});
  const pose=timeline.poses.get(1);assert.ok(Math.abs(pose.z-19)<1e-7);
  assert.ok(Math.abs(w.surface.entityHeight(pose)-.3)<1e-6);
  assert.equal(unit.z,16,'no mutation of authoritative entities');
});

test('rendered floor samples and models use the CPU surface, and changing maps clears it',()=>{
  const w=new Battlefield(1409,'mothership'),r=createRendererStub({record:true}),meshes=new Map();
  r.geometry=(name,data)=>{meshes.set(name,data);};r.quality=0;r.cinema=false;
  const view=new BattlefieldView(r);view.sync(w);
  const mesh=meshes.get('terrain'),floorVertices=(w.surface.size-1)**2*6;
  for(let i=0;i<floorVertices*9;i+=9) {
    assert.ok(Math.abs(mesh[i+1]+.13-w.surface.heightAt(mesh[i],mesh[i+2]))<1e-6);
    assert.ok(Math.abs(Math.hypot(mesh[i+3],mesh[i+4],mesh[i+5])-1)<1e-6);
  }
  for(const e of [{id:1,x:42,z:50,kind:'unit',type:'worker',hp:100,faction:0,team:0,size:.65},
    {id:2,x:42,z:50,kind:'resource',type:'gas',hp:100,faction:0,team:-1,size:2},
    {id:3,x:42,z:50,kind:'building',type:'depot',hp:100,faction:0,team:0,size:2.3,progress:.3}]) {
    r.calls=[];r.surface=null;renderEntity(r,e,1);const flat=r.calls;
    r.calls=[];r.surface=w.surface;renderEntity(r,e,1);
    assert.equal(r.calls.length,flat.length);
    r.calls.forEach((call,i)=>assert.ok(Math.abs(call[2]-flat[i][2]-6)<1e-6));
  }
  view.sync(new Battlefield(1409,'alien-planet'));assert.equal(r.surface,null);
});

test('all eight vents admit real refinery placement and air recovery ignores cliff masks',()=>{
  const g=game();g.world.sight[0].explored.fill(1);assert.ok(g.spawnUnit('worker',0,0,0,0));
  for(const vent of g.s.entities.filter(e=>e.type==='gas'))
    assert.equal(g.canBuild('refinery',vent),'',`vent at ${vent.x},${vent.z}`);
  const air=g.spawnUnit('air',80,30,0,0);assert.ok(air);
  g.pathTo(air,{x:80,z:50},true);
  assert.equal(air.pathStatus,'complete');
  assert.equal(air.path.length,1,'unit-avoidance recovery still flies straight over the cliff');
});

test('cliff drops reject before spending; a plateau drop reserves four real landing bodies',()=>{
  const g=game();g.s.entities=[];g.ids.clear();g.world.rebuild([]);
  g.spawnBuilding('hq',42,60,0,0);g.spawnUnit('worker',80,30,0,0);g.world.rebuild(g.s.entities);
  g.world.sight[0].explored.fill(1);g.account(0).energy=200;
  const energy=g.account(0).energy, cooldown=g.account(0).abilities.drop, count=g.s.entities.length;
  assert.equal(g.ability('drop',{x:80,z:36},0),false);
  assert.equal(g.account(0).energy,energy);assert.equal(g.account(0).abilities.drop,cooldown);
  assert.equal(g.s.entities.length,count);
  assert.equal(g.ability('drop',{x:42,z:48},0),true);
  const units=g.s.entities.filter(e=>e.type==='rifle');assert.equal(units.length,4);
  for(const e of units) {assert.equal(g.world.surface.heightAt(e.x,e.z),6);assert.ok(g.unitFits(e,e.x,e.z));}
});
