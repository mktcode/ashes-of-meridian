// Bounded local building/result contracts; no AI matches or simulation tick loop.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {loadScripts,BATTLEFIELD_SCRIPTS,SIMULATION_SCRIPTS}=require('./helpers/game-scripts.cjs');
const context=loadScripts(['core','content','expedition',...BATTLEFIELD_SCRIPTS,'world',...SIMULATION_SCRIPTS,'ui-core','ui-templates','ui-actions','world-view']);
const {MeridianGame,MeridianUI,Battlefield,BattlefieldSurface,BUILDINGS,FACTIONS,PlacementGuideSampler,civilizationUpgradesForBuildings}=vm.runInContext(
 '({MeridianGame,MeridianUI,Battlefield,BattlefieldSurface,BUILDINGS,FACTIONS,PlacementGuideSampler,civilizationUpgradesForBuildings})',context);
const {FORUM_SETTLEMENT,forumCorridors,buildingVisualYaw}=vm.runInContext('({FORUM_SETTLEMENT,forumCorridors,buildingVisualYaw})',context);
function forumFrame(forum){
 const yaw=buildingVisualYaw(forum),cs=Math.cos(yaw),sn=Math.sin(yaw);
 return {world:(x,z)=>({x:forum.x+x*cs+z*sn,z:forum.z-x*sn+z*cs}),
  local:p=>({x:(p.x-forum.x)*cs-(p.z-forum.z)*sn,z:(p.x-forum.x)*sn+(p.z-forum.z)*cs})};
}
const types=['fieldlab','researchhub','researchspire','embercottage','terracecommons','hearthtower'];
const allTypes=[...types,'meridianforum'];
function fixture(faction=0,height=(x,z)=>40+.35*x+.12*z+.06*Math.sin(x)){
 const game=Object.create(MeridianGame.prototype),world=Object.create(Battlefield.prototype),extent=80,n=64;
 Object.assign(world,{extent,cellSize:2.5,gridSize:n,viewTeam:0,pathVersion:0,surface:new BattlefieldSurface(extent,2.5,height),
  staticGrid:new Uint8Array(n*n),blocked:new Uint8Array(n*n),fogPixels:new Uint8Array(n*n),fogVersion:0,
  sight:Array.from({length:2},()=>({visible:new Uint8Array(n*n).fill(255),explored:new Uint8Array(n*n).fill(255)}))});
 world.visible=world.sight[0].visible;world.explored=world.sight[0].explored;world.staticGrid.set(world.surface.cliffs);
 world.path=()=>({status:'complete',points:[]});
 Object.assign(game,{world,ids:new Map(),random:()=>.5,notify(){},emit(){},setOrder(w,order){w.order=order;},
  s:{time:0,nextId:3,seed:1409,rules:{kind:'single-player',completed:true},stats:{kills:0,damage:0,lost:0,built:0,gathered:0},supplyCaches:[],fields:[],scans:[],recalls:[],entities:[
   {id:1,team:0,faction,kind:'unit',type:'worker',hp:100,maxHp:100,progress:1,size:.65,x:-20,z:-20,order:{type:'idle'}}],
   parties:[{id:0,faction,account:{alloy:0,gas:100},meta:{},benefits:{},loadout:['drop'],deploymentPending:false},
    {id:1,faction:1,account:{alloy:0,gas:0},meta:{},benefits:{},loadout:[],deploymentPending:false}]}});
 return {game,world};
}
test('seven civilian models retain their content values and faction-independent nonproductive role',()=>{
 assert.deepEqual(Object.keys(BUILDINGS).slice(-7),allTypes);
 allTypes.forEach((type,i)=>{
  const d=BUILDINGS[type];assert.equal(d.cost,0);assert.equal(d.gas,i===6?25:0);
  assert.equal(d.vision,BUILDINGS.depot.vision);assert.equal(d.damage,undefined);assert.equal(d.cap,undefined);assert.equal(d.requires,undefined);
  assert.ok(FACTIONS.every(f=>f.buildings[type]===FACTIONS[0].buildings[type]));
 });
});
test('only the Forum is directly buildable, from Stage 1 but strictly after victory',()=>{
 const {game}=fixture();game.civilizationStage=1;
 for(const stage of [1,4,null]) {
  game.civilizationStage=stage;
  for(const type of types){
   const gas=game.account(0).gas;
   assert.match(game.canBuild(type,null),/automatically/);
   assert.equal(game.submitAction(0,{kind:'build',building:type,position:{x:0,z:0},selected:[]}),false);
   assert.equal(game.account(0).gas,gas);assert.equal(game.s.entities.length,1);
  }
 }
 game.civilizationStage=1;game.s.rules.completed=false;
 assert.match(game.canBuild('meridianforum',null),/Win/);
 assert.equal(game.build('meridianforum',{x:0,z:0}),false);
 assert.equal(game.account(0).gas,100);
 game.s.rules.completed=true;assert.equal(game.canBuild('meridianforum',null),'');
 game.s.rules={kind:'local-pvp'};assert.match(game.canBuild('meridianforum',null),/Win/);
});
test('civilian placement accepts uneven slopes and cliff cells but protects obstacles, occupancy, exploration and worker access/payment',()=>{
 for(const faction of [0,1,2])for(const type of ['meridianforum']){
  const {game,world}=fixture(faction),p={x:0,z:0},before=Array.from(world.surface.heights),gas=game.account(0).gas;
  assert.equal(world.surface.foundation(p,BUILDINGS[type].size),false);
  assert.match(game.canBuild('depot',p),/stable ground/);assert.equal(game.canBuild(type,p),'');
  const sampler=new PlacementGuideSampler(game,type,0);sampler.refresh();assert.equal(sampler.sample(p),1);
  const blocked=world.blocked;assert.equal(game.build(type,p),true);assert.strictEqual(world.blocked,blocked);
  const b=game.s.entities.at(-1);assert.equal(b.type,type);assert.equal(b.vision,21);assert.equal(b.progress,.06);
  assert.equal(game.account(0).alloy,0);assert.equal(game.account(0).gas,gas-BUILDINGS[type].gas);
  assert.equal(game.s.entities[0].order.id,b.id);assert.equal(game.s.entities[0].order.type,'build');
  assert.deepEqual(Array.from(world.surface.heights),before);
  game.s.entities[0].order={type:'idle'};assert.match(game.canBuild(type,p),/room (around|between)/);
  game.cancelConstruction(b.id);assert.equal(game.account(0).gas,gas-BUILDINGS[type].gas*.25);
 }
 const {game,world}=fixture();world.path=()=>({status:'unreachable',points:[]});const gas=game.account(0).gas;
 assert.equal(game.build('meridianforum',{x:0,z:0}),false);assert.equal(game.account(0).gas,gas);assert.equal(game.s.entities.length,1);
 world.sight[0].explored[world.idx(0,0)]=0;assert.match(game.settlementPlacementReason('fieldlab',{x:0,z:0},0),/Scout/);
 world.sight[0].explored.fill(255);world.staticGrid[world.idx(0,0)]=1;assert.match(game.settlementPlacementReason('fieldlab',{x:0,z:0},0),/obstructs/);
 world.staticGrid.fill(0);world.staticGrid[world.idx(0,-2.5)]=1;
 assert.match(game.settlementPlacementReason('researchhub',{x:0,z:0},0),/obstructs/,'interior obstacles cannot hide between perimeter samples');
 world.staticGrid.fill(0);world.surface.cliffs[world.idx(0,0)]=1;world.staticGrid.set(world.surface.cliffs);
 assert.equal(game.settlementPlacementReason('fieldlab',{x:0,z:0},0),'');
 assert.ok(game.settlementPlacementReason('fieldlab',{x:79,z:0},0));
});
test('civilian complexes use close nonoverlapping deck outlines while reserving stairs, walkways and military clearance',()=>{
 const yaw=vm.runInContext('BUILDING_YAW',context),cs=Math.cos(yaw),sn=Math.sin(yaw),at=(x,z=0)=>({x:x*cs+z*sn,z:-x*sn+z*cs});
 for(const first of types)for(const next of types){
  const {game}=fixture(0,()=>40);game.spawnBuilding(first,0,0,0,0);
  const old=BUILDINGS[first].size+BUILDINGS[next].size+.8;
  let close;
  for(let x=4;x<old;x+=.25)if(!game.settlementPlacementReason(next,at(x),0)){close=at(x);break;}
  assert.ok(close,`${first}/${next} can form a tighter complex`);
  assert.equal(game.settlementPlacementReason(next,close,0),'');
  assert.ok(game.settlementPlacementReason(next,at(1),0),'models cannot intersect');
  assert.match(game.canBuild('depot',at(4.5)),/room around/,'military spacing is unchanged');
 }
 const {game}=fixture(0,()=>40);game.spawnBuilding('fieldlab',0,0,0,0);
 assert.match(game.settlementPlacementReason('fieldlab',at(0,4.8),0),/stairs/,'entry stairs are not just the main deck');
 const hub=fixture(0,()=>40).game;hub.spawnBuilding('researchhub',0,0,0,0);
 assert.match(hub.settlementPlacementReason('fieldlab',at(5.75),0),/walkways/,'the elevated side walkway keeps its footprint');
 const actual=fixture(0,()=>40);delete actual.world.path;actual.game.spawnBuilding('fieldlab',0,0,0,0);
 actual.world.rebuild(actual.game.s.entities);
 assert.equal(actual.game.settlementPlacementReason('fieldlab',at(10),0),'','reserved expansion space needs no worker route');
});
test('Forum clearance reserves the full platform and all three wider stair approaches',()=>{
 const {civilizationDeckFootprints,civilizationClearanceFootprints,civilizationFootprintsOverlap,BUILDING_YAW}=vm.runInContext('({civilizationDeckFootprints,civilizationClearanceFootprints,civilizationFootprintsOverlap,BUILDING_YAW})',context),
  cs=Math.cos(BUILDING_YAW),sn=Math.sin(BUILDING_YAW),at=(x,z)=>({x:x*cs+z*sn,z:-x*sn+z*cs}),p={x:0,z:0},
  deck=civilizationDeckFootprints(p,'meridianforum',0),clearance=civilizationClearanceFootprints(p,'meridianforum',0);
 assert.equal(clearance.length,4,'one connected deck and three entries');
 const {game}=fixture(0,()=>40);game.spawnBuilding('meridianforum',0,0,0,0);
 for(const x of [-5.1,0,5.1]){
  const next=at(x,8),small=civilizationClearanceFootprints(next,'fieldlab',0);
  assert.ok(deck.every(d=>small.every(s=>!civilizationFootprintsOverlap(d.polygon,s))),'candidate clears the platform');
  assert.ok(clearance.some(c=>small.some(s=>civilizationFootprintsOverlap(c,s))),'but overlaps a stair approach');
  assert.match(game.settlementPlacementReason('fieldlab',next,0),/stairs/);
 }
 assert.ok(game.settlementPlacementReason('fieldlab',at(0,0),0),'the large hull cannot intersect another civic building');
});
test('Forum cliff foundations are reachable without opening cliff paths for units',()=>{
 const {game,world}=fixture(0,(x,z)=>x>0?45:40);delete world.path;world.rebuild(game.s.entities);
 const p={x:1,z:0},worker=game.s.entities[0],radius=BUILDINGS.meridianforum.size+2.9;
 assert.equal(world.surface.fits(p.x,p.z),false);assert.equal(world.terrainFree(worker,p),false);
 assert.match(game.canBuild('depot',p),/stable ground/);assert.equal(game.canBuild('meridianforum',p),'');
 const sampler=new PlacementGuideSampler(game,'meridianforum',0);sampler.refresh();assert.equal(sampler.sample(p),1);
 assert.equal(game.build('meridianforum',p),true);const b=game.s.entities.at(-1);world.rebuild(game.s.entities);
 const area={...p,radius,terrainConnection:false},body=worker.size*vm.runInContext('UNIT_BODY_SCALE',context),
  path=world.path(worker.x,worker.z,p.x,p.z,false,area,body);
 assert.equal(path.status,'complete');assert.equal(world.surface.fits(path.goal.x,path.goal.z,body),true);
 assert.equal(world.blockedAt(path.goal.x,path.goal.z),false);assert.equal(world.terrainFree(path.goal,p),false);
 assert.notEqual(world.path(worker.x,worker.z,p.x,p.z,false,{...p,radius},body).status,'complete');
 Object.assign(worker,path.goal,{rot:0});game.effects={construction(){}};game.s.stats.built=0;
 assert.equal(game.move(worker,b,0,radius+.1,false,area),true,'movement stops at the reachable work area');
 game.worker(worker,BUILDINGS.meridianforum.time);assert.equal(b.progress,1);assert.equal(worker.order.type,'idle');
 assert.equal(world.surface.fits(p.x,p.z),false,'construction does not alter unit passability');
});
test('large Forum construction reaches a real cliff-side service point without making the cliff walkable',()=>{
 const {game,world}=fixture(0,(x,z)=>x>0?45:40);delete world.path;world.rebuild(game.s.entities);
 game.civilizationStage=4;
 const p={x:1,z:0},worker=game.s.entities[0],radius=BUILDINGS.meridianforum.size+2.9;
 assert.equal(world.surface.fits(p.x,p.z),false);
 assert.equal(game.canBuild('meridianforum',p),'');assert.equal(game.build('meridianforum',p),true);
 const b=game.s.entities.at(-1);world.rebuild(game.s.entities);
 const area={...p,radius,terrainConnection:false},body=worker.size*vm.runInContext('UNIT_BODY_SCALE',context),
  path=world.path(worker.x,worker.z,p.x,p.z,false,area,body);
 assert.equal(path.status,'complete');assert.equal(world.surface.fits(path.goal.x,path.goal.z,body),true);
 assert.equal(world.blockedAt(path.goal.x,path.goal.z),false);
 Object.assign(worker,path.goal,{rot:0});game.effects={construction(){}};game.s.stats.built=0;
 game.worker(worker,BUILDINGS.meridianforum.time);
 assert.equal(b.progress,1);assert.equal(worker.order.type,'idle');
 assert.equal(game.account(0).gas,75);assert.equal(world.surface.fits(p.x,p.z),false);
});
test('ordinary worker construction completes the Echo-only Forum and releases the worker',()=>{
 for(const type of ['meridianforum']){
  const {game}=fixture();game.effects={construction(){}};game.s.stats.built=0;
  assert.equal(game.build(type,{x:0,z:0}),true);const b=game.s.entities.at(-1),worker=game.s.entities[0];
  Object.assign(worker,{x:b.size+2.5,z:0,rot:0});const echo=game.account(0).gas;
  game.worker(worker,BUILDINGS[type].time);
  assert.equal(b.progress,1);assert.equal(b.hp,b.maxHp);assert.equal(worker.order.type,'idle');
  assert.equal(game.account(0).gas,echo);assert.equal(game.account(0).alloy,0);
  assert.equal(game.s.stats.built,1);
 }
});
test('civilian structures grant normal building vision, respecting terrain tiers, ownership and destruction',()=>{
 for(const type of allTypes)for(const team of [0,1])for(const progress of [.06,1]){
  const {game,world}=fixture(0,x=>x>10?10:0);
  world.surface=new BattlefieldSurface(80,2.5,x=>x>10?10:0,h=>h>=5?1:0);
  const normal=game.spawnBuilding('depot',0,0,team,0,{progress});world.reveal([normal]);
  const expected=world.sight.map(s=>Array.from(s.visible)),b=game.spawnBuilding(type,0,0,team,0,{progress});
  assert.equal(b.vision,normal.vision);world.reveal([b]);
  assert.deepEqual(world.sight.map(s=>Array.from(s.visible)),expected);
  assert.equal(world.sight[team].visible[world.idx(0,0)],255);
  assert.equal(world.sight[1-team].visible[world.idx(0,0)],0);
  assert.equal(world.sight[team].visible[world.idx(15,0)],0,'decorative roofs do not grant elevated sight');
  b.vision=0;world.reveal([b]);assert.deepEqual(world.sight.map(s=>Array.from(s.visible)),expected,'normal fallback also covers stored zero vision');
  b.hp=0;world.reveal([b]);assert.ok(world.sight.every(s=>s.visible.every(v=>v===0)));
 }
});
test('civilian structures still provide no supply and are not reinforcement anchors',()=>{
 for(const type of allTypes){
  const {game}=fixture(0,()=>0);game.s.entities=[];game.spawnBuilding(type,0,0,0,0);assert.equal(game.cap(),0);
  game.s.parties[0].account.energy=100;game.s.parties[0].account.abilities={drop:0};
  assert.equal(game.ability('drop',{x:0,z:0}),false);
 }
});
test('defeat withdrawal removes civilian structures along with the eliminated party',()=>{
 const {game}=fixture(),a=game.spawnBuilding('fieldlab',0,0,0,0);
 game.s.rules.completed=false;game.checkHQElimination();assert.equal(game.s.result.win,false);assert.equal(a.hp,0);
});
test('supplied Forums grow free mixed settlements on a saved clock, with no combat RNG draws or workers',()=>{
 const {game,world}=fixture(0,()=>40);game.s.entities=[];
 const forum=game.spawnBuilding('meridianforum',0,0,0,0),funds={...game.account(0)};
 game.random=()=>assert.fail('Settlement must not consume battle RNG');
 forum.cinderStock=2000;game.updateSettlements();assert.equal(game.s.entities.length,1);
 for(let i=1;i<=100;i++){game.s.time=i*10;game.updateSettlements(10);}
 const grown=game.s.entities.filter(e=>e.forumId===forum.id&&e.hp>0);
 assert.equal(grown.length,60);assert.deepEqual(game.account(0),funds);assert.ok(grown.every(b=>b.progress===1&&b.paid.cost===0&&b.paid.gas===0));
 assert.deepEqual([...new Set(grown.map(b=>b.type))].sort(),['embercottage','fieldlab']);
 for(const b of grown) {
  assert.ok(Math.hypot(b.x-forum.x,b.z-forum.z)<=60);
  assert.equal(game.forumAccessReason(b,b.size,undefined,b.type,b.team),'');
  assert.equal(game.canSellBuilding(b.id),'');
  if(b===grown[0]) { assert.equal(game.rotateBuilding(b.id,1),true);assert.equal(game.rotateBuilding(b.id,-1),true); }
 }
 assert.equal(game.s.stats.built,60);
 assert.deepEqual(JSON.parse(JSON.stringify(civilizationUpgradesForBuildings(game.s.entities))),{upgrades:{},benefits:{}},'new buildings need a purchased selection');
 const {settlementBuildingType,forumBuildingTarget}=vm.runInContext('({settlementBuildingType,forumBuildingTarget})',context);
 assert.equal(forumBuildingTarget({...forum,cinderStock:999}),29);
 assert.equal(forumBuildingTarget({...forum,cinderStock:1000}),30,'existing stock keeps its previous building target');
 assert.equal(forumBuildingTarget({...forum,cinderStock:500}),15);
 assert.equal(forumBuildingTarget({...forum,cinderStock:1999}),59);
 assert.equal(forumBuildingTarget({...forum,cinderStock:2000}),60);
 assert.equal(forumBuildingTarget({...forum,cinderStock:2001}),60,'target stays capped');
 assert.equal(settlementBuildingType(18,.5,.1),'embercottage');
 assert.equal(settlementBuildingType(60,.5,.9),'fieldlab');
 const blocked=fixture(0,()=>40);blocked.game.s.entities=[];
 const crowded=blocked.game.spawnBuilding('meridianforum',0,0,0,0);crowded.cinderStock=1000;
 blocked.world.staticGrid.fill(1);assert.equal(blocked.game.growSettlement(crowded),false);
 assert.equal(blocked.game.s.entities.length,1,'no space means no forced spawn');
 game.s.rules.completed=false;forum.cinderStock=500;game.s.time+=100;game.updateSettlements();
 assert.equal(game.s.entities.filter(e=>e.forumId===forum.id&&e.hp>0).length,60);
});
test('Forum street grids reserve three parallel axes, a cross-axis and a connected entrance plaza while leaving eight buildable parcels',()=>{
 const radius=FORUM_SETTLEMENT.radius,half=FORUM_SETTLEMENT.corridorWidth/2;
 for(const team of [0,1])for(const rotation of [0,1/3,2]){
  const {game}=fixture(0,()=>40);game.s.entities=[];
  const forum=game.spawnBuilding('meridianforum',7,-4,team,team);forum.visualRotation=rotation;
  const frame=forumFrame(forum),polygons=forumCorridors(forum).map(p=>p.map(frame.local));
  assert.equal(polygons.length,5,'four street axes plus the local Forum plaza, not radial spokes');
  for(const [i,x] of [-radius/2,0,radius/2].entries()){
   assert.ok(polygons[i].every(p=>Math.abs(Math.abs(p.x-x)-half)<1e-9));
   assert.ok(polygons[i].some(p=>p.z>Math.sqrt(radius*radius-x*x)));
   assert.ok(polygons[i].some(p=>p.z<-Math.sqrt(radius*radius-x*x)));
  }
  assert.ok(polygons[3].every(p=>Math.abs(Math.abs(p.z)-half)<1e-9));
  const plaza=forum.size+2.5+half;
  assert.equal(polygons[4].length,64,'a smooth convex round plaza replaces the square');
  assert.ok(polygons[4].every(p=>Math.abs(Math.hypot(p.x,p.z)-plaza)<1e-9));
  for(const sx of [-1,1])for(const sz of [-1,1])
   assert.equal(game.forumAccessReason(frame.world(sx*plaza*.85,sz*plaza*.85),0),'','former square corners outside the round plaza are no longer reserved');
  for(const [x,z] of [[-radius/2,33],[0,40],[radius/2,-33],[45,0]])
   assert.match(game.forumAccessReason(frame.world(x,z),BUILDINGS.depot.size),/streets/);
  const area=game.forumServiceArea(forum);
  for(let i=0;i<8;i++){
   const p={x:area.x+Math.sin(i*Math.PI/4)*area.radius,z:area.z+Math.cos(i*Math.PI/4)*area.radius};
   assert.match(game.forumAccessReason(p,0),/plaza/,'the entire delivery perimeter stays reserved');
  }
  for(const x of [-.75,-.25,.25,.75])for(const z of [-.55,.55]){
   const p=frame.world(x*radius,z*radius);
   assert.equal(game.settlementPlacementReason('fieldlab',p,team),'','each of the eight parcels admits a civilian foundation');
  }
 }
});
test('settlement candidates vary freely in radius and angle while the saved cursor remains deterministic and bounded',()=>{
 const {game}=fixture(0,()=>40);game.s.entities=[];
 const forum=game.spawnBuilding('meridianforum',0,0,0,0),samples=[];
 forum.settlementAttempt=64;game.random=()=>assert.fail('Placement must not consume battle RNG');
 game.settlementPlacementReason=(type,p)=>{samples.push({type,x:p.x,z:p.z});return 'occupied';};
 assert.equal(game.growSettlement(forum),false);assert.equal(samples.length,32);assert.equal(forum.settlementAttempt,96);
 const radii=samples.map(p=>Math.hypot(p.x,p.z)),yaw=vm.runInContext('buildingVisualYaw',context)(forum);
 assert.ok(radii.every(r=>r>=18&&r<=60));
 assert.ok(Math.max(...radii)-Math.min(...radii)>25,'one search spans the area rather than a thin ring');
 const offSlots=samples.filter((p,i)=>{
  const delta=Math.atan2(p.x,p.z)-yaw-i*Math.PI/16;
  return Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)))>.12;
 });
 assert.ok(offSlots.length>16,'angles are not tied to successive evenly spaced slots');
 const first=samples.slice();forum.settlementAttempt=64;
 assert.equal(game.growSettlement(forum),false);assert.deepEqual(samples.slice(32),first);
});
test('new settlements start small in both model families at every distance',()=>{
 const {settlementBuildingType}=vm.runInContext('({settlementBuildingType})',context),seen=new Set();
 for(const radius of [18,39,60])for(const roll of [0,.5,.99])for(const variant of [.25,.75])
  seen.add(settlementBuildingType(radius,roll,variant));
 assert.deepEqual([...seen].sort(),['embercottage','fieldlab']);
});
test('eight-parcel settlements populate every block and keep rotated street axes connected to the Forum delivery perimeter',()=>{
 const {UNITS,UNIT_BODY_SCALE}=vm.runInContext('({UNITS,UNIT_BODY_SCALE})',context);
 const seen=new Set();
 for(const [seed,rotation] of [[1409,0],[2718,1/3],[8123,2]]){
  const {game,world}=fixture(0,()=>40);game.s.entities=[];game.s.seed=seed;delete world.path;
  const forum=game.spawnBuilding('meridianforum',0,0,0,0);forum.visualRotation=rotation;forum.cinderStock=2000;
  game.random=()=>assert.fail('Settlement must not consume battle RNG');game.updateSettlements();
  for(let i=1;i<=100;i++){game.s.time=i*10;game.updateSettlements(10);}
  const buildings=game.s.entities.filter(e=>e.forumId===forum.id&&e.hp>0);
  assert.ok(buildings.length>0&&buildings.length<=FORUM_SETTLEMENT.buildings,'growth respects available expansion space and the population cap');
  const frame=forumFrame(forum),radius=FORUM_SETTLEMENT.radius,plaza=forum.size+2.5+FORUM_SETTLEMENT.corridorWidth/2,parcels=new Set();
  for(const b of buildings){
   seen.add(b.type);assert.equal(game.forumAccessReason(b,b.size,undefined,b.type,b.team),'');
   const p=frame.local(b),column=p.x<-radius/2?0:p.x<0?1:p.x<radius/2?2:3;
   parcels.add(column+(p.z<0?0:4));
  }
  assert.equal(parcels.size,8,'growth fills all eight parcels without using fixed building slots');
  const segments=[[[-radius/2,-48],[-radius/2,48]],[[radius/2,-48],[radius/2,48]],
   [[0,-55],[0,-plaza]],[[0,plaza],[0,55]],[[-55,0],[-plaza,0]],[[plaza,0],[55,0]]];
  const body=UNITS.worker.size*UNIT_BODY_SCALE;
  for(const [a,b] of segments)assert.equal(world.lineFree(frame.world(...a),frame.world(...b),body),true,'street centerlines remain clear of rasterized buildings');
  for(const [x,z] of [[-radius/2,-48],[-radius/2,48],[radius/2,-48],[radius/2,48],[0,-55],[0,55],[-55,0],[55,0]]){
   const worker={...frame.world(x,z),size:UNITS.worker.size};
   const area=game.forumServiceArea(forum),path=world.path(worker.x,worker.z,forum.x,forum.z,false,area,body);
   assert.equal(path.status,'complete',`each street arm reaches the delivery perimeter: seed=${seed}, rotation=${rotation}, start=${x},${z}`);
   assert.ok(game.forumDropoff({...worker,id:1,order:{type:'idle'}},forum));
  }
 }
 assert.deepEqual([...seen].sort(),['embercottage','fieldlab']);
});
test('all six settlement models build themselves over their normal construction time without workers, spending or effect RNG',()=>{
 for(const type of types){
  const {game}=fixture(0,()=>40);game.s.entities=[];
  const forum=game.spawnBuilding('meridianforum',0,0,0,0),p=forumFrame(forum).world(45,33),
   b=game.spawnBuilding(type,p.x,p.z,0,0,{progress:.06,paid:{cost:0,gas:0},forumId:forum.id});
  b.hp=b.maxHp*.06;const funds={...game.account(0)},events=[];
  game.random=()=>assert.fail('Automatic construction must not draw battle RNG');
  game.effects={construction(){assert.fail('No artificial worker construction beams');}};
  game.notify=(_team,type,data)=>events.push({type,data});
  assert.equal(game.s.stats.built,0);
  game.updateSettlements();assert.equal(b.progress,.06,'maintenance without elapsed time does not construct');
  game.updateSettlements(BUILDINGS[type].time/2);assert.equal(b.progress,.56);
  assert.ok(Math.abs(b.hp-b.maxHp*.56)<1e-9);
  assert.equal(game.s.stats.built,0);assert.equal(events.length,0);
  game.updateSettlements(BUILDINGS[type].time/2);assert.equal(b.progress,1);assert.equal(b.hp,b.maxHp);
  assert.equal(game.s.stats.built,1);assert.equal(events.length,1);assert.equal(events[0].type,'complete');
  game.updateSettlements(10);assert.equal(game.s.stats.built,1);assert.equal(events.length,1);
  assert.deepEqual(game.account(0),funds);assert.equal(forum.cinderStock,undefined);
 }
});
test('new automatic foundations reserve their slot, reject worker takeover and stop building when their Forum is lost',()=>{
 const {game}=fixture(0,()=>40),worker=game.s.entities[0];game.s.entities=[];
 const forum=game.spawnBuilding('meridianforum',0,0,0,0);forum.cinderStock=34;
 game.random=()=>assert.fail('Automatic foundation must not draw battle RNG');
 game.updateSettlements();game.s.time=10;game.updateSettlements(10);
 const b=game.s.entities.at(-1);assert.equal(b.forumId,forum.id);
 assert.equal(b.progress,.06);assert.equal(b.hp,b.maxHp*.06);assert.equal(game.s.stats.built,0);
 assert.equal(game.workerTask(b),null);worker.order={type:'build',id:b.id};
 game.worker(worker,10);assert.equal(worker.order.type,'idle');assert.equal(b.progress,.06);
 game.s.time=20;game.updateSettlements(1);assert.equal(game.s.entities.length,2,'a foundation already occupies its stock-supported slot');
 const progress=b.progress;assert.ok(progress>.06&&progress<1);assert.equal(forum.cinderStock,34);
 game.s.rules.completed=false;game.updateSettlements(1);assert.equal(b.progress,progress);
 game.s.rules.completed=true;forum.hp=0;game.updateSettlements(1);assert.equal(b.progress,progress);
 game.s.time+=10;game.updateSettlements(10);assert.equal(b.hp,0);assert.equal(game.s.stats.built,0);
});
test('multiple Forums keep independent stocks, overlapping radii share exclusions, and orphan buildings disappear one at a time',()=>{
 const {game}=fixture(0,()=>40);game.s.entities=[];
 const a=game.spawnBuilding('meridianforum',-25,0,0,0),b=game.spawnBuilding('meridianforum',25,0,0,0);
 a.cinderStock=100;b.cinderStock=0;game.updateSettlements();
 for(let i=1;i<=12;i++){game.s.time=i*10;game.updateSettlements(10);}
 const grown=game.s.entities.filter(e=>e.forumId===a.id&&e.hp>0);
 assert.ok(grown.every(e=>e.progress===1));assert.equal(grown.length,3);assert.ok(game.s.entities.every(e=>e.forumId!==b.id));
 for(const building of grown)assert.equal(game.forumAccessReason(building,building.size,undefined,building.type,0),'');
 assert.equal(game.sellBuilding(a.id),true);assert.equal(grown.filter(e=>e.hp>0).length,3);
 game.updateSettlements();game.s.time+=9;game.updateSettlements();assert.ok(grown.every(e=>e.hp>0));
 game.s.time++;game.updateSettlements();assert.equal(grown.filter(e=>e.hp>0).length,2);
 game.s.time+=10;game.updateSettlements();assert.equal(grown.filter(e=>e.hp>0).length,1);
 game.s.time+=10;game.updateSettlements();assert.equal(grown.filter(e=>e.hp>0).length,0);
 assert.equal(b.cinderStock,0);
});
test('Forum loss returns idle leftover cargo to HQ even when all deposits are exhausted',()=>{
 const {game}=fixture(0,()=>40),worker=game.s.entities[0],
  forum=game.spawnBuilding('meridianforum',0,0,0,0),hq=game.spawnBuilding('hq',-35,-35,0,0);
 Object.assign(worker,{carry:5,deliveryForum:forum.id,deliveryPoint:{x:10,z:10}});forum.hp=0;
 let destination=null;game.workerDropoff=()=>hq;game.move=(_worker,p)=>{destination=p;};
 assert.equal(game.worker(worker,.1),true);assert.equal(worker.deliveryForum,undefined);
 assert.equal(worker.deliveryPoint,undefined);assert.equal(worker.returning,true);
 assert.equal(worker.carry,5);assert.equal(destination,hq);assert.equal(game.account(0).alloy,0);
});
test('explicit smart commands assign prospectors, only Forum deliveries spend their cargo, and manual orders unassign them',()=>{
 const {game}=fixture(0,()=>40);delete game.setOrder;
 const worker=game.s.entities[0];game.ids.set(worker.id,worker);Object.assign(worker,{carry:18,returning:false,path:[],nextPath:0,rot:0});
 const forum=game.spawnBuilding('meridianforum',0,0,0,0),hq=game.spawnBuilding('hq',-35,-35,0,0);
 const node={id:90,kind:'resource',type:'crystal',amount:100,hp:1,team:-1,x:20,z:20,size:1};game.s.entities.push(node);game.ids.set(node.id,node);
 assert.equal(game.command([worker.id],{type:'smart',id:forum.id,x:0,z:0},0,false),true);
 assert.equal(worker.deliveryForum,forum.id);assert.equal(worker.returning,true);
 Object.assign(worker,servicePosition(game,forum));game.worker(worker,.1);
 assert.equal(forum.cinderStock,18);assert.equal(worker.carry,0);assert.equal(game.account(0).alloy,0);
 assert.equal(worker.order.id,node.id);assert.equal(worker.deliveryForum,forum.id);
 Object.assign(worker,{carry:18,returning:true});forum.cinderStock=1000;game.worker(worker,.1);
 assert.equal(forum.cinderStock,1018,'previously full Forums accept additional deliveries');assert.equal(worker.carry,0);
 Object.assign(worker,{carry:18,returning:true});forum.cinderStock=1995;game.worker(worker,.1);
 assert.equal(forum.cinderStock,2000);assert.equal(worker.carry,13);assert.equal(game.account(0).alloy,0);
 game.worker(worker,1);assert.equal(worker.carry,13);assert.equal(node.amount,100,'full Forum does not consume more Cinder');
 Object.assign(worker,{carry:2,returning:false});game.worker(worker,1);
 assert.equal(worker.carry,2);assert.equal(node.amount,100,'other partially loaded miners also wait when the Forum fills');
 assert.equal(game.command([worker.id],{type:'mine',id:node.id},0,false),true);assert.equal(worker.deliveryForum,undefined);
 Object.assign(worker,{x:hq.x+hq.size+2.5,z:hq.z,carry:18,returning:true});game.worker(worker,.1);
 assert.equal(game.account(0).alloy,18,'unassigned workers retain HQ economy');assert.equal(forum.cinderStock,2000);
 game.command([worker.id],{type:'smart',id:forum.id},0,false);assert.equal(worker.deliveryForum,forum.id);
 forum.hp=0;game.worker(worker,.1);assert.equal(worker.deliveryForum,undefined,'lost owner cannot steal cargo');
});
function deliveryFixture(){
 const {game,world}=fixture(0,()=>40);delete game.setOrder;
 const worker=game.s.entities[0],forum=game.spawnBuilding('meridianforum',0,0,0,0),warnings=[];
 game.ids.set(worker.id,worker);world.rebuild(game.s.entities);
 Object.assign(worker,{carry:18,returning:true,deliveryForum:forum.id,order:{type:'mine',id:forum.id},path:[],nextPath:0,pi:0});
 game.notify=(_team,type,message)=>{if(type==='toast')warnings.push(message);};
 return {game,world,worker,forum,warnings};
}
const serviceRoute=(_x,_z,tx,tz)=>({status:'complete',points:[{x:tx,z:tz}],goal:{x:tx,z:tz}});
function servicePosition(game,forum){return {x:forum.x,z:forum.z+game.forumServiceArea(forum).radius-.4};}
function blockServiceArea(game,forum,cliffs=false){
 const world=game.world,area=game.forumServiceArea(forum);
 for(let i=0;i<world.staticGrid.length;i++){
  const p=world.point(i);
  if(Math.hypot(p.x-area.x,p.z-area.z)<=area.radius+world.cellSize){
   world.staticGrid[i]=1;if(cliffs)world.surface.cliffs[i]=1;
  }
 }
}
test('Forum delivery is available around the entire perimeter regardless of model rotation',()=>{
 for(const rotation of [0,2.5])for(let i=0;i<8;i++){
  const {game,world,worker,forum}=deliveryFixture();forum.visualRotation=rotation;
  const area=game.forumServiceArea(forum),r=area.radius-.4,angle=i*Math.PI/4;
  Object.assign(worker,{x:forum.x+Math.sin(angle)*r,z:forum.z+Math.cos(angle)*r});
  assert.equal(world.blockedAt(worker.x,worker.z),false);
  world.path=()=>assert.fail('An already reached free perimeter position needs no search');
  game.random=()=>assert.fail('Delivery must not draw RNG');game.worker(worker,.05);
  assert.equal(worker.carry,0,`rotation=${rotation}, side=${i}`);assert.equal(forum.cinderStock,18);
  assert.deepEqual(game.forumServiceArea({...forum,visualRotation:rotation+1}),area);
 }
});
function blockFrontHalf(game,forum){
 const {world}=game,area=game.forumServiceArea(forum),frame=forumFrame(forum);
 for(let i=0;i<world.staticGrid.length;i++){
  const p=world.point(i);
  if(Math.hypot(p.x-forum.x,p.z-forum.z)<=area.radius+world.cellSize && frame.local(p).z>=0)
   world.staticGrid[i]=world.surface.cliffs[i]=1;
 }
 world.rebuild(game.s.entities);
}
test('Forum delivery finds a real rear route even with every front entrance blocked by cliffs',()=>{
 const {game,world,worker,forum}=deliveryFixture(),frame=forumFrame(forum);
 Object.assign(worker,{...frame.world(0,-35),rot:0,walk:0});blockFrontHalf(game,forum);delete world.path;
 let calls=0;const path=world.path.bind(world);world.path=(...args)=>{calls++;return path(...args);};
 game.worker(worker,0);assert.equal(calls,1);assert.equal(worker.pathStatus,'complete');assert.ok(worker.path.length);
 assert.ok(frame.local(worker.deliveryPoint).z<0,'use the free rear perimeter, not a front entrance');
 assert.deepEqual(worker.pathArea,game.forumServiceArea(forum));assert.equal(worker.carry,18);
 Object.assign(worker,worker.deliveryPoint);game.worker(worker,.05);
 assert.equal(calls,1);assert.equal(worker.carry,0);assert.equal(forum.cinderStock,18);
});
test('Forum delivery does not unload inside the blocked foundation or on a blocked rear approach',()=>{
 for(const position of [{x:0,z:0},{x:0,z:-12.9}]){
  const {game,world,worker,forum}=deliveryFixture();Object.assign(worker,position);
  world.staticGrid[world.idx(worker.x,worker.z)]=world.surface.cliffs[world.idx(worker.x,worker.z)]=1;
  world.rebuild(game.s.entities);world.path=()=>({status:'unreachable',points:[]});
  game.worker(worker,.05);assert.equal(worker.carry,18);assert.equal(forum.cinderStock,undefined);
 }
});
test('Forum delivery skips blocked service areas without A* or cargo loss, and warns only once',()=>{
 const {game,world,worker,forum,warnings}=deliveryFixture();
 blockServiceArea(game,forum);
 world.rebuild(game.s.entities);world.path=()=>assert.fail('No goal exists: do not run A*');
 game.random=()=>assert.fail('Delivery must not draw RNG');
 for(let i=0;i<100;i++){game.s.time=i*.05;game.worker(worker,.05);}
 assert.equal(worker.carry,18);assert.equal(worker.deliveryPoint,undefined);
 assert.equal(forum.cinderStock,undefined);assert.equal(game.account(0).alloy,0);assert.equal(warnings.length,1);
});
test('Forum delivery searches the whole perimeter once per cooldown and rejects partial and budget-exhausted paths',()=>{
 const {game,world,worker,forum,warnings}=deliveryFixture(),goals=[];
 world.path=(_x,_z,tx,tz,_air,area)=>{goals.push([tx,tz]);assert.deepEqual(area,game.forumServiceArea(forum));return {status:['partial','budget-exhausted','unreachable'][goals.length-1],points:[{x:tx,z:tz}]};};
 game.worker(worker,.05);for(let i=1;i<60;i++){game.s.time=i*.05;game.worker(worker,.05);}
 assert.equal(goals.length,1);
 game.s.time=3.2;game.worker(worker,.05);game.s.time=6.4;game.worker(worker,.05);
 assert.equal(goals.length,3);
 assert.equal(worker.deliveryPoint,undefined);assert.equal(worker.carry,18);assert.equal(forum.cinderStock,undefined);assert.equal(warnings.length,1);
});
test('Forum delivery staggers searches across workers rather than multiplying failures in one tick',()=>{
 const {game,world,worker}=deliveryFixture(),second={...worker,id:101,x:-25,path:[],order:{...worker.order}};game.s.entities.push(second);
 let calls=0;world.path=()=>{calls++;return {status:'unreachable',points:[]};};
 game.worker(worker,.05);game.worker(second,.05);assert.equal(calls,1);
 game.s.time=.24;game.worker(second,.05);assert.equal(calls,1);
 game.s.time=.25;game.worker(second,.05);assert.equal(calls,2);
 game.s.time=3.2;game.worker(worker,.05);assert.equal(calls,3);
 game.s.time=3.5;game.worker(second,.05);assert.equal(calls,4);assert.equal(worker.carry,18);assert.equal(second.carry,18);
});
test('Forum delivery reacts to navigation changes and reuses a successful path instead of searching twice',()=>{
 const {game,world,worker}=deliveryFixture();let calls=0,route;
 world.path=()=>{calls++;return {status:'unreachable',points:[]};};game.worker(worker,.05);assert.equal(calls,1);
 world.path=(...args)=>{calls++;return route=serviceRoute(...args);};world.rebuild(game.s.entities);game.s.time=.3;worker.recoveryAttempts=3;
 delete game.move;game.worker(worker,0);
 assert.equal(calls,2);assert.equal(worker.pathStatus,'complete');assert.strictEqual(worker.path,route.points);
 assert.deepEqual(worker.deliveryPoint,route.goal);assert.equal(worker.pathVersion,world.pathVersion);
 assert.equal(worker.nextPath,game.s.time+3.2,'Keep the movement recovery retry contract');
 game.worker(worker,0);assert.equal(calls,2,'Stable return trip keeps its route');
});
test('Forum delivery uses a real complete route once and unloads only on reaching its service area',()=>{
 const {game,world,worker,forum}=deliveryFixture();delete world.path;
 Object.assign(worker,{walk:0,rot:0});let calls=0;const path=world.path.bind(world);
 world.path=(...args)=>{calls++;return path(...args);};
 game.worker(worker,.05);assert.equal(calls,1);assert.equal(worker.pathStatus,'complete');
 assert.ok(worker.deliveryPoint);assert.equal(worker.carry,18);assert.equal(forum.cinderStock,undefined);
 assert.equal(world.surface.fits(worker.deliveryPoint.x,worker.deliveryPoint.z,worker.size*1.4),true);
 Object.assign(worker,worker.deliveryPoint);game.worker(worker,.05);
 assert.equal(calls,1);assert.equal(worker.carry,0);assert.equal(forum.cinderStock,18);
});
test('Forum delivery accepts a valid current perimeter position without requiring a walkable building center',()=>{
 const {game,world,worker,forum}=deliveryFixture();
 Object.assign(worker,servicePosition(game,forum));world.surface.fits=(x,z)=>x===worker.x&&z===worker.z;
 world.path=()=>assert.fail('Already at a valid service position');game.worker(worker,.05);
 assert.equal(worker.carry,0);assert.equal(forum.cinderStock,18);
});
test('Forum delivery keeps the service area fixed rather than expanding it around an offset saved goal',()=>{
 const {game,world,worker,forum}=deliveryFixture(),area=game.forumServiceArea(forum);
 Object.assign(worker,{x:forum.x,z:forum.z+area.radius+1,deliveryPoint:{x:forum.x,z:forum.z+area.radius-.1},pathStatus:'complete',pathVersion:world.pathVersion});
 let movedArea,stop;game.move=(_e,_p,_dt,s,_settle,a)=>{movedArea=a;stop=s;return false;};
 world.path=()=>assert.fail('The saved route remains usable');game.worker(worker,.05);
 assert.equal(worker.carry,18);assert.equal(forum.cinderStock,undefined);
 assert.deepEqual(movedArea,area);assert.equal(stop,0);
});
test('Forum delivery moves into the fixed area instead of stopping short of an offset return goal',()=>{
 const {game,world,worker,forum}=deliveryFixture(),area=game.forumServiceArea(forum),goal={x:forum.x,z:forum.z+area.radius-.1};
 Object.assign(worker,{x:forum.x,z:forum.z+area.radius+.2,rot:0,walk:0,deliveryPoint:goal,path:[goal],
  pathStatus:'complete',pathVersion:world.pathVersion,pathGoal:goal,pathArea:area});
 world.path=()=>assert.fail('Reuse the existing complete return path');
 for(let i=0;i<10 && worker.carry;i++){game.worker(worker,.05);game.s.time+=.05;}
 assert.equal(worker.carry,0);assert.equal(forum.cinderStock,18);
});
test('Forum delivery never unloads at a newly blocked goal and resumes when the layout becomes usable',()=>{
 const {game,world,worker,forum}=deliveryFixture();world.path=serviceRoute;game.move=()=>false;
 game.worker(worker,.05);const old=worker.deliveryPoint;
 world.staticGrid[world.idx(old.x,old.z)]=1;world.rebuild(game.s.entities);
 const other={x:forum.x,z:forum.z-game.forumServiceArea(forum).radius+.4};
 world.path=()=>({status:'complete',points:[other],goal:other});game.s.time=.3;game.worker(worker,.05);
 assert.notDeepEqual(worker.deliveryPoint,old);assert.equal(worker.carry,18);
 Object.assign(worker,worker.deliveryPoint);
 blockServiceArea(game,forum);
 world.rebuild(game.s.entities);game.s.time=.6;game.worker(worker,.05);
 assert.equal(worker.deliveryPoint,undefined);assert.equal(worker.carry,18);assert.equal(forum.cinderStock,undefined);
 world.staticGrid.fill(0);world.rebuild(game.s.entities);game.s.time=.9;game.worker(worker,.05);
 assert.equal(worker.carry,0);assert.equal(forum.cinderStock,18);
});
test('Forum delivery forgets retries on manual reassignment and on replacement of the owning world',()=>{
 const {game,world,worker,forum}=deliveryFixture();world.path=()=>({status:'unreachable',points:[]});game.worker(worker,.05);
 world.path=serviceRoute;game.s.time=.3;assert.equal(game.command([worker.id],{type:'smart',id:forum.id},0,false),true);
 game.move=()=>false;game.worker(worker,.05);assert.ok(worker.deliveryPoint);
 game.setOrder(worker,{type:'idle'});worker.deliveryForum=forum.id;worker.returning=true;
 world.path=()=>({status:'unreachable',points:[]});game.s.time=.6;game.worker(worker,.05);assert.equal(worker.deliveryPoint,undefined);
 game.world=Object.assign(Object.create(Battlefield.prototype),world,{path:serviceRoute});
 game.worker(worker,.05);assert.ok(worker.deliveryPoint,'A restored/new world cannot inherit the old negative cache');
});
test('Forum delivery preserves a restored valid complete route but discards blocked saved goals',()=>{
 const {game,world,worker,forum}=deliveryFixture(),point=servicePosition(game,forum),path=[point];
 Object.assign(worker,{deliveryPoint:point,path,pathStatus:'complete',pathVersion:world.pathVersion,
  pathGoal:point,pathArea:game.forumServiceArea(forum),nextPath:3});
 world.path=()=>assert.fail('Keep the valid saved route');delete game.move;game.worker(worker,0);
 assert.strictEqual(worker.path,path);assert.strictEqual(worker.deliveryPoint,point);
 blockServiceArea(game,forum);
 world.rebuild(game.s.entities);game.worker(worker,.05);assert.equal(worker.deliveryPoint,undefined);assert.equal(worker.carry,18);
});
test('Forum construction requires a complete route to the circular work and delivery area before payment or spawning',()=>{
 const {game,world}=fixture(0,()=>40),site={x:0,z:0,size:BUILDINGS.meridianforum.size,team:0};
 const blocked=world.blocked,gas=game.account(0).gas;
 let calls=0;world.path=(_x,_z,_tx,_tz,_air,area)=>{calls++;assert.deepEqual(area,game.forumServiceArea(site));return {status:'partial',points:[]};};
 assert.equal(game.canBuild('meridianforum',site),'');assert.equal(game.build('meridianforum',site),false);
 assert.strictEqual(world.blocked,blocked);assert.equal(game.account(0).gas,gas);assert.equal(game.s.entities.length,1);assert.equal(calls,1);
 blockServiceArea(game,site,true);
 world.rebuild(game.s.entities);world.path=()=>assert.fail('Blocked delivery access must reject before A*');
 assert.equal(game.canBuild('meridianforum',site),'','Grid preview stays a cheap approximation');
 assert.equal(game.build('meridianforum',site),false);assert.equal(game.account(0).gas,gas);
});
test('Forum construction can prove rear access with blocked front entrances using one real search',()=>{
 const {game,world}=fixture(0,()=>40),site={x:0,z:0,size:BUILDINGS.meridianforum.size,team:0},worker=game.s.entities[0];
 Object.assign(worker,forumFrame(site).world(0,-35));blockFrontHalf(game,site);delete world.path;
 let calls=0;const path=world.path.bind(world);world.path=(...args)=>{calls++;return path(...args);};
 assert.equal(game.canBuild('meridianforum',site),'');assert.equal(game.build('meridianforum',site),true);
 assert.equal(calls,1);assert.equal(worker.order.type,'build');assert.equal(game.account(0).gas,75);
});
test('Forum construction can use another reachable worker when the selected worker cannot reach the perimeter',()=>{
 const {game,world}=fixture(0,()=>40),selected=game.s.entities[0],other=game.spawnUnit('worker',-35,-20,0,0);
 world.path=(...args)=>args[0]===selected.x?{status:'unreachable',points:[]}:serviceRoute(...args);
 assert.equal(game.build('meridianforum',{x:0,z:0},[selected.id]),true);
 assert.equal(selected.order.type,'idle');assert.equal(other.order.type,'build');assert.equal(game.account(0).gas,75);
});
test('Forum rotation keeps a cached complete delivery route and does not trigger another worker search',()=>{
 const {game,world,worker,forum}=deliveryFixture();delete world.path;Object.assign(worker,{walk:0,rot:0});
 let calls=0;const path=world.path.bind(world);world.path=(...args)=>{calls++;return path(...args);};
 game.worker(worker,0);assert.equal(calls,1);const route=worker.path,goal=worker.deliveryPoint,area=worker.pathArea;
 assert.equal(game.rotateBuilding(forum.id,1),true);assert.equal(calls,2,'Rotation still proves live worker access');
 game.worker(worker,0);assert.equal(calls,2,'The circular delivery area did not change');
 assert.strictEqual(worker.path,route);assert.strictEqual(worker.deliveryPoint,goal);assert.strictEqual(worker.pathArea,area);
});
test('Forum rotation requires a worker to prove access, without changing the existing layout',()=>{
 const {game,world,forum}=deliveryFixture();game.s.entities=game.s.entities.filter(e=>e.kind!=='unit');
 world.path=()=>assert.fail('No worker can prove access');assert.equal(game.rotateBuilding(forum.id,1),false);
 assert.equal(forum.visualRotation,undefined);
});
test('Forum rotation rejects blocked or unreachable delivery access atomically, while reachable rotations remain allowed',()=>{
 const {game,world,worker,forum}=deliveryFixture(),point=servicePosition(game,forum);worker.deliveryPoint=point;worker.path=[point];
 const path=worker.path;
 blockServiceArea(game,forum);
 world.rebuild(game.s.entities);world.path=()=>assert.fail('All proposed service areas are blocked');
 assert.equal(game.rotateBuilding(forum.id,1),false);assert.equal(forum.visualRotation,undefined);
 assert.strictEqual(worker.deliveryPoint,point);assert.strictEqual(worker.path,path);
 world.staticGrid.fill(0);world.rebuild(game.s.entities);world.path=()=>({status:'partial',points:[]});
 assert.equal(game.rotateBuilding(forum.id,1),false);assert.strictEqual(worker.path,path);
 world.path=serviceRoute;assert.equal(game.rotateBuilding(forum.id,1),true);
 assert.equal(forum.visualRotation,1/3);assert.strictEqual(worker.deliveryPoint,point);assert.strictEqual(worker.path,path);
});

test('rotated Forum streets agree with placement guides and service paths while existing military blockers no longer prevent rotation',()=>{
 const {game,world}=fixture(0,()=>40);game.s.entities=[];delete world.path;
 const forum=game.spawnBuilding('meridianforum',0,0,0,0);forum.visualRotation=2;
 const worker=game.spawnUnit('worker',-50,-30,0,0);
 world.rebuild(game.s.entities);
 const service=game.forumDropoff(worker,forum);assert.ok(service);assert.ok(!world.blockedAt(service.x,service.z));
 const corridor=forumCorridors(forum)[0],p={x:(corridor[0].x+corridor[2].x)/2,z:(corridor[0].z+corridor[2].z)/2};
 assert.match(game.forumAccessReason(p,BUILDINGS.depot.size),/streets/);
 const sampler=new PlacementGuideSampler(game,'depot',0);sampler.refresh();assert.equal(sampler.sample(p),-1);
 const pos=forumFrame({...forum,visualRotation:7/3}).world(0,40),blocker=game.spawnBuilding('depot',pos.x,pos.z,0,0);
 worker.deliveryForum=forum.id;worker.deliveryPoint=service;worker.path=[service];
 assert.equal(game.rotateBuilding(forum.id,1),true);assert.equal(forum.visualRotation,7/3);
 assert.equal(blocker.hp,blocker.maxHp);assert.strictEqual(worker.deliveryPoint,service);assert.deepEqual(worker.path,[service]);
});
test('free Forum rotation schedules only misaligned settlement buildings, cancels on turn-back and regrows after the saved grace period without clearing resources or military structures',()=>{
 const {game,world}=fixture(0,()=>40);game.s.entities=[];
 const forum=game.spawnBuilding('meridianforum',0,0,0,0);forum.cinderStock=2000;
 game.spawnUnit('worker',-60,-60,0,0); // Forum rotation needs a real reachable ground delivery area.
 for(let i=0;i<=100;i++){game.s.time=i*10;game.updateSettlements(10);}
 const grown=game.s.entities.filter(e=>e.forumId===forum.id&&e.hp>0);assert.equal(grown.length,60);
 const p=forumFrame({...forum,visualRotation:1/3}).world(0,40),military=game.spawnBuilding('depot',p.x,p.z,0,0),
  resource=game.spawn('resource','crystal',p.x+1,p.z+1,-1,0,{amount:80});
 world.rebuild(game.s.entities);const funds={...game.account(0)},stats={...game.s.stats};
 game.random=()=>assert.fail('Rearrangement must not consume combat/effect RNG');
 assert.equal(game.rotateBuilding(forum.id,1),true);
 let pending=grown.filter(b=>b.settlementAt!==undefined);assert.ok(pending.length>0&&pending.length<60);
 assert.ok(pending.every(b=>b.settlementAt===1010));assert.ok(grown.every(b=>b.hp>0));
 assert.equal(game.rotateBuilding(forum.id,-1),true);assert.ok(grown.every(b=>b.settlementAt===undefined),'turning back cancels removals');
 assert.equal(game.rotateBuilding(forum.id,1),true);pending=grown.filter(b=>b.settlementAt!==undefined);
 const survivors=grown.filter(b=>b.settlementAt===undefined),positions=survivors.map(b=>[b.id,b.x,b.z]);
 game.s.time=1009;game.updateSettlements(1);assert.ok(grown.every(b=>b.hp>0));
 game.s.time=1010;game.updateSettlements(1);assert.ok(pending.every(b=>b.hp===0&&b.deathAt===1010));
 assert.ok(survivors.every(b=>b.hp>0));assert.deepEqual(survivors.map(b=>[b.id,b.x,b.z]),positions);
 assert.ok(grown.filter(b=>b.hp>0).length<60);assert.equal(game.s.stats.kills,stats.kills);assert.equal(game.s.stats.lost,stats.lost);
 const replacement=game.s.entities.find(b=>b.forumId===forum.id&&b.hp>0&&!grown.includes(b));
 assert.ok(replacement);assert.equal(replacement.progress,.06);assert.equal(replacement.paid.cost,0);assert.equal(replacement.paid.gas,0);
 for(let i=1;i<=100;i++){game.s.time=1010+i*10;game.updateSettlements(10);}
 const rebuilt=game.s.entities.filter(b=>b.forumId===forum.id&&b.hp>0);assert.equal(rebuilt.length,60);
 for(const b of rebuilt)assert.equal(game.forumAccessReason(b,b.size,undefined,b.type,b.team,b.visualRotation||0),'');
 assert.equal(military.hp,military.maxHp);assert.equal(resource.hp,resource.maxHp);assert.equal(resource.amount,80);
 assert.equal(forum.cinderStock,2000);assert.deepEqual(game.account(0),funds);
});
test('individual settlement buildings rotate, sell without minting refunds and allow free foundation cancellation with normal regrowth',()=>{
 const {game}=fixture(0,()=>40);game.s.entities=[];
 const forum=game.spawnBuilding('meridianforum',0,0,0,0);forum.cinderStock=34;
 game.random=()=>assert.fail('Civilian controls must not consume combat/effect RNG');
 game.updateSettlements();game.s.time=10;game.updateSettlements();const first=game.s.entities.at(-1),funds={...game.account(0)};
 assert.equal(game.submitAction(0,{kind:'cancelConstruction',id:first.id}),true);assert.equal(first.hp,0);assert.deepEqual(game.account(0),funds);
 game.s.time=20;game.updateSettlements();const second=game.s.entities.at(-1);assert.notEqual(second.id,first.id);
 game.s.time=30;game.updateSettlements(100);assert.equal(second.progress,1);
 assert.equal(game.submitAction(0,{kind:'rotateBuilding',id:second.id,direction:1}),true);assert.equal(second.visualRotation,1/3);
 delete second.paid;assert.equal(game.buildingSaleRefund(second.id).cost,0);assert.equal(game.buildingSaleRefund(second.id).gas,0);
 assert.equal(game.submitAction(1,{kind:'sell',id:second.id}),false);
 assert.equal(game.submitAction(0,{kind:'sell',id:second.id}),true);assert.equal(second.hp,0);assert.deepEqual(game.account(0),funds);
 game.s.time=40;game.updateSettlements();assert.equal(game.s.entities.filter(b=>b.forumId===forum.id&&b.hp>0).length,1);
});
test('expiring layout deadlines recheck removed Forum masks and still retire buildings outside their owning radius',()=>{
 const {game}=fixture(0,()=>40);game.s.entities=[];
 const forum=game.spawnBuilding('meridianforum',0,0,0,0),p=forumFrame(forum).world(45,33),
  b=game.spawnBuilding('fieldlab',p.x,p.z,0,0,{forumId:forum.id}),
  q=forumFrame(forum).world(65,40),outside=game.spawnBuilding('fieldlab',q.x,q.z,0,0,{forumId:forum.id}),
  other=game.spawnBuilding('meridianforum',p.x,p.z-40,0,0);
 forum.settlementAt=other.settlementAt=100;game.refreshSettlementLayouts();
 assert.equal(b.settlementAt,10);assert.equal(outside.settlementAt,10);
 other.hp=0;game.s.time=10;game.updateSettlements();
 assert.ok(b.hp>0);assert.equal(b.settlementAt,undefined,'expired deadlines cannot remove now-valid structures');assert.equal(outside.hp,0);
});
test('partial or still-stepping ticks cannot change the preview of new battle upgrades',()=>{
 const ui=Object.create(MeridianUI.prototype),forum={id:1,kind:'building',type:'meridianforum',team:0,hp:950,progress:1},
  b={id:2,kind:'building',type:'fieldlab',team:0,hp:500,progress:1,forumId:1,upgrade:'orbital',upgradeLevel:1},
  recipe={depth:0,encounter:{map:'desert',seed:1409}},world={stage:1,recipe,battle:{state:{entities:[forum,b]}}};
 Object.assign(ui,{view:'game',activeWorldStage:1,
  expedition:{worlds:[world]},game:{snapshotSafe:false,stepping:false,
   s:{depth:0,map:'desert',seed:1409,rules:{kind:'single-player',completed:true},entities:[forum,{...b,upgradeLevel:2}]}}});
 assert.equal(ui.expeditionUpgrades().upgrades.orbital,1);
 ui.game.snapshotSafe=true;ui.game.stepping=true;assert.equal(ui.expeditionUpgrades().upgrades.orbital,1);
 ui.game.stepping=false;assert.equal(ui.expeditionUpgrades().upgrades.orbital,2);
 assert.equal(b.upgradeLevel,1,'preview aggregation does not mutate archived buildings');
});
