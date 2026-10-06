// Bounded local building/result contracts; no AI matches or simulation tick loop.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {loadScripts,BATTLEFIELD_SCRIPTS,SIMULATION_SCRIPTS}=require('./helpers/game-scripts.cjs');
const context=loadScripts(['core','content','expedition',...BATTLEFIELD_SCRIPTS,'world',...SIMULATION_SCRIPTS,'ui-core','ui-templates','ui-actions','world-view']);
const {MeridianGame,MeridianUI,Battlefield,BattlefieldSurface,BUILDINGS,FACTIONS,PlacementGuideSampler,civilizationScoreForBuildings,expeditionCivilizationScore,civilizationScoreRequirement,expeditionStageUnlocked,renderHomeScreen}=vm.runInContext(
 '({MeridianGame,MeridianUI,Battlefield,BattlefieldSurface,BUILDINGS,FACTIONS,PlacementGuideSampler,civilizationScoreForBuildings,expeditionCivilizationScore,civilizationScoreRequirement,expeditionStageUnlocked,renderHomeScreen})',context);
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
  const d=BUILDINGS[type];assert.equal(d.cost,0);assert.equal(d.gas,i===6?25:[5,10,15][i%3]);assert.equal(d.civilizationPoints,i===6?0:[5,10,15][i%3]);
  assert.equal(d.civilizationUnlockStage,i===6?1:i%3+1);
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
 assert.equal(actual.game.settlementPlacementReason('fieldlab',at(4.9),0),'','automatic compact buildings need no worker route');
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
 assert.equal(b.progress,1);assert.equal(worker.order.type,'idle');assert.equal(civilizationScoreForBuildings(game.s.entities,0),0);
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
  assert.equal(game.s.stats.built,1);assert.equal(civilizationScoreForBuildings(game.s.entities,0),BUILDINGS[type].civilizationPoints);
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
test('score counts completed surviving own buildings only and defeat withdrawal preserves their tally',()=>{
 const {game}=fixture();const a=game.spawnBuilding('fieldlab',0,0,0,0);
 game.spawnBuilding('researchhub',10,0,0,0);game.spawnBuilding('researchspire',20,0,0,0,{progress:.8});
 game.spawnBuilding('fieldlab',30,0,1,1);game.spawnBuilding('researchhub',40,0,0,0,{hp:0});
 for(const type of types.slice(3))game.spawnBuilding(type,0,20,0,0);
 game.spawnBuilding('embercottage',0,30,0,0,{progress:.8});game.spawnBuilding('terracecommons',10,30,0,0,{hp:0});
 game.spawnBuilding('hearthtower',20,30,1,1);
 assert.equal(civilizationScoreForBuildings(game.s.entities,0),45);
 game.s.rules.completed=false;game.checkHQElimination();assert.equal(game.s.result.win,false);assert.equal(game.s.result.civilizationScore,45);assert.equal(a.hp,0);
});
test('supplied Forums grow free mixed settlements on a saved clock, with no combat RNG draws or workers',()=>{
 const {game,world}=fixture(0,()=>40);game.s.entities=[];
 const forum=game.spawnBuilding('meridianforum',0,0,0,0),funds={...game.account(0)};
 game.random=()=>assert.fail('Settlement must not consume battle RNG');
 forum.cinderStock=2000;game.updateSettlements();assert.equal(game.s.entities.length,1);
 for(let i=1;i<=100;i++){game.s.time=i*10;game.updateSettlements(10);}
 const grown=game.s.entities.filter(e=>e.forumId===forum.id&&e.hp>0);
 assert.equal(grown.length,60);assert.deepEqual(game.account(0),funds);assert.ok(grown.every(b=>b.progress===1&&b.paid.cost===0&&b.paid.gas===0));
 assert.ok(new Set(grown.map(b=>b.type)).size>=4,'all classes mix rather than unlock by stage');
 for(const b of grown) {
  assert.ok(Math.hypot(b.x-forum.x,b.z-forum.z)<=60);
  assert.equal(game.forumAccessReason(b,b.size,undefined,b.type,b.team),'');
  assert.equal(game.canSellBuilding(b.id),'Managed by its forum');
  assert.equal(game.rotateBuilding(b.id,1),false);
 }
 assert.equal(game.s.stats.built,60);assert.ok(civilizationScoreForBuildings(grown,0)>0);
 assert.equal(civilizationScoreForBuildings([forum],0),0);
 const {settlementBuildingType,forumBuildingTarget}=vm.runInContext('({settlementBuildingType,forumBuildingTarget})',context);
 assert.equal(forumBuildingTarget({...forum,cinderStock:999}),29);
 assert.equal(forumBuildingTarget({...forum,cinderStock:1000}),30,'existing stock keeps its previous building target');
 assert.equal(forumBuildingTarget({...forum,cinderStock:500}),15);
 assert.equal(forumBuildingTarget({...forum,cinderStock:1999}),59);
 assert.equal(forumBuildingTarget({...forum,cinderStock:2000}),60);
 assert.equal(forumBuildingTarget({...forum,cinderStock:2001}),60,'target stays capped');
 assert.equal(settlementBuildingType(18,.5,.1),'hearthtower');
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
  for(const [x,z] of [[-radius/2,33],[0,40],[radius/2,-33],[45,0]])
   assert.match(game.forumAccessReason(frame.world(x,z),BUILDINGS.depot.size),/streets/);
  for(const p of game.forumServicePoints(forum)){
   assert.match(game.forumAccessReason(p,0),/plaza/);
   assert.deepEqual(p,game.world.point(game.world.idx(p.x,p.z)),'service areas contain an actual navigation-cell goal for detours');
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
test('mid-rise settlement variants remain common at every distance while tall and small preferences change outward',()=>{
 const {settlementBuildingType}=vm.runInContext('({settlementBuildingType})',context),counts=[],seen=new Set();
 for(const radius of [18,39,60]){
  const count={5:0,10:0,15:0};
  for(let i=0;i<100;i++)for(const variant of [.25,.75]){
   const type=settlementBuildingType(radius,(i+.5)/100,variant);seen.add(type);count[BUILDINGS[type].civilizationPoints]++;
  }
  assert.ok(count[10]>=60,'at least a substantial minority of both medium variants throughout the radius');counts.push(count);
 }
 assert.ok(counts[0][15]>counts[0][5]);assert.ok(counts[2][5]>counts[2][15]);
 assert.ok(counts[1][10]>=counts[1][5]&&counts[1][10]>=counts[1][15]);
 assert.deepEqual([...seen].sort(),[...types].sort());
});
test('eight-parcel settlements populate every block and keep rotated street axes and all Forum entries navigable for workers',()=>{
 const {UNITS,UNIT_BODY_SCALE}=vm.runInContext('({UNITS,UNIT_BODY_SCALE})',context);
 let total=0,medium=0;const seen=new Set();
 for(const [seed,rotation] of [[1409,0],[2718,1/3],[8123,2]]){
  const {game,world}=fixture(0,()=>40);game.s.entities=[];game.s.seed=seed;delete world.path;
  const forum=game.spawnBuilding('meridianforum',0,0,0,0);forum.visualRotation=rotation;forum.cinderStock=2000;
  game.random=()=>assert.fail('Settlement must not consume battle RNG');game.updateSettlements();
  for(let i=1;i<=100;i++){game.s.time=i*10;game.updateSettlements(10);}
  const buildings=game.s.entities.filter(e=>e.forumId===forum.id&&e.hp>0);assert.equal(buildings.length,60);
  total+=buildings.length;medium+=buildings.filter(e=>BUILDINGS[e.type].civilizationPoints===10).length;
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
   for(const p of game.forumServicePoints(forum)){
    const path=world.path(worker.x,worker.z,p.x,p.z,false,{...p,radius:1.2,terrainConnection:false},body);
    assert.equal(path.status,'complete',`each street arm connects to every entry: seed=${seed}, rotation=${rotation}, start=${x},${z}, entry=${p.x},${p.z}`);
   }
   assert.ok(game.forumDropoff(worker,forum));
  }
 }
 assert.ok(medium>=total/4,'medium buildings also remain common after real placement exclusions');
 assert.deepEqual([...seen].sort(),[...types].sort());
});
test('all six settlement models build themselves over their normal construction time without workers, spending or effect RNG',()=>{
 for(const type of types){
  const {game}=fixture(0,()=>40);game.s.entities=[];
  const forum=game.spawnBuilding('meridianforum',0,0,0,0),
   b=game.spawnBuilding(type,30,30,0,0,{progress:.06,paid:{cost:0,gas:0},forumId:forum.id});
  b.hp=b.maxHp*.06;const funds={...game.account(0)},events=[];
  game.random=()=>assert.fail('Automatic construction must not draw battle RNG');
  game.effects={construction(){assert.fail('No artificial worker construction beams');}};
  game.notify=(_team,type,data)=>events.push({type,data});
  assert.equal(civilizationScoreForBuildings([b],0),0);assert.equal(game.s.stats.built,0);
  game.updateSettlements();assert.equal(b.progress,.06,'maintenance without elapsed time does not construct');
  game.updateSettlements(BUILDINGS[type].time/2);assert.equal(b.progress,.56);
  assert.ok(Math.abs(b.hp-b.maxHp*.56)<1e-9);assert.equal(civilizationScoreForBuildings([b],0),0);
  assert.equal(game.s.stats.built,0);assert.equal(events.length,0);
  game.updateSettlements(BUILDINGS[type].time/2);assert.equal(b.progress,1);assert.equal(b.hp,b.maxHp);
  assert.equal(civilizationScoreForBuildings([b],0),BUILDINGS[type].civilizationPoints);
  assert.equal(game.s.stats.built,1);assert.equal(events.length,1);assert.equal(events[0].type,'complete');
  game.updateSettlements(10);assert.equal(game.s.stats.built,1);assert.equal(events.length,1);
  assert.deepEqual(game.account(0),funds);assert.equal(forum.cinderStock,undefined);
 }
});
test('new automatic foundations reserve their slot, reject worker takeover and cancellation, and stop building when their Forum is lost',()=>{
 const {game}=fixture(0,()=>40),worker=game.s.entities[0];game.s.entities=[];
 const forum=game.spawnBuilding('meridianforum',0,0,0,0);forum.cinderStock=34;
 game.random=()=>assert.fail('Automatic foundation must not draw battle RNG');
 game.updateSettlements();game.s.time=10;game.updateSettlements(10);
 const b=game.s.entities.at(-1);assert.equal(b.forumId,forum.id);
 assert.equal(b.progress,.06);assert.equal(b.hp,b.maxHp*.06);assert.equal(game.s.stats.built,0);
 assert.equal(game.workerTask(b),null);worker.order={type:'build',id:b.id};
 game.worker(worker,10);assert.equal(worker.order.type,'idle');assert.equal(b.progress,.06);
 game.cancelConstruction(b.id);assert.ok(b.hp>0);
 assert.equal(game.submitAction(0,{kind:'cancelConstruction',id:b.id}),false);
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
 const score=civilizationScoreForBuildings(game.s.entities,0);
 assert.equal(game.sellBuilding(a.id),true);assert.equal(civilizationScoreForBuildings(game.s.entities,0),score);
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
 Object.assign(worker,game.forumServicePoints(forum)[0]);game.worker(worker,.1);
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
test('rotated Forum streets agree with placement guides and service paths and reject blocking rotation',()=>{
 const {game,world}=fixture(0,()=>40);game.s.entities=[];delete world.path;
 const forum=game.spawnBuilding('meridianforum',0,0,0,0);forum.visualRotation=2;
 const worker=game.spawnUnit('worker',-50,-30,0,0);
 world.rebuild(game.s.entities);
 const service=game.forumDropoff(worker,forum);assert.ok(service);assert.ok(!world.blockedAt(service.x,service.z));
 const corridor=forumCorridors(forum)[0],p={x:(corridor[0].x+corridor[2].x)/2,z:(corridor[0].z+corridor[2].z)/2};
 assert.match(game.forumAccessReason(p,BUILDINGS.depot.size),/streets/);
 const sampler=new PlacementGuideSampler(game,'depot',0);sampler.refresh();assert.equal(sampler.sample(p),-1);
 let blocker;
 for(let angle=0;angle<Math.PI*2;angle+=.05){
  const pos={x:Math.sin(angle)*40,z:Math.cos(angle)*40};
  if(game.forumAccessReason(pos,2))continue;
  blocker=game.spawnBuilding('depot',pos.x,pos.z,0,0);
  if(game.forumRotationReason(forum,7/3))break;
  blocker.hp=0;blocker=undefined;
 }
 assert.ok(blocker);assert.equal(game.rotateBuilding(forum.id,1),false);assert.equal(forum.visualRotation,2);
});
const civil = (type='fieldlab',extra={}) => ({kind:'building',type,team:0,hp:500,progress:1,...extra});
const scoreSave = entities => ({version:1,state:{entities},tutorial:null});
const scoreRecipe = depth => ({depth,encounter:{map:'desert',seed:1409}});

test('live score replaces exactly one snapshot, sums every world and ignores incomplete, lost and foreign buildings',()=>{
 const first={stage:1,recipe:scoreRecipe(0),battle:scoreSave([civil(),civil('embercottage')])},
  second={stage:2,recipe:scoreRecipe(1),battle:scoreSave([civil(),civil('researchhub'),civil('researchspire')])},
  damaged={stage:3,error:'damaged',recipe:scoreRecipe(2),battle:scoreSave([civil()])};
 const expedition={...scoreRecipe(3),worlds:[first,second,damaged],battle:scoreSave([civil()])};
 const before=JSON.stringify(expedition),live={...scoreRecipe(0).encounter,depth:0,rules:{kind:'single-player',completed:true},
  entities:[civil('hearthtower'),civil('researchspire',{progress:.9}),civil('researchhub',{hp:0}),civil('embercottage',{team:1})]};
 assert.equal(expeditionCivilizationScore(expedition),45);
 assert.equal(expeditionCivilizationScore(expedition,live,1),50,'visited world replaces its saved score, not the current battle');
 live.entities.push(civil());assert.equal(expeditionCivilizationScore(expedition,live,1),55);
 live.entities[0].hp=0;assert.equal(expeditionCivilizationScore(expedition,live,1),40);
 live.rules.completed=undefined;live.depth=3;live.entities=[];
 assert.equal(expeditionCivilizationScore(expedition,live),40,'current losses replace its older autosave');
 assert.equal(JSON.stringify(expedition),before,'calculation does not mutate any archived world');
});

test('score gates use 25 times three, require military clearance and never revoke an unlocked stage',()=>{
 assert.deepEqual([1,2,3,4,5,6].map(civilizationScoreRequirement),[0,25,75,225,675,2025]);
 assert.ok(Number.isSafeInteger(civilizationScoreRequirement(32)));
 assert.equal(civilizationScoreRequirement(33),Infinity,'overflow cannot grant a cheaper unlock');
 assert.equal(civilizationScoreRequirement(999999),Infinity);
 const world={stage:1,recipe:scoreRecipe(0),battle:scoreSave(Array.from({length:50},()=>civil()))},ui=Object.create(MeridianUI.prototype);
 Object.assign(ui,{view:'home',activeWorldStage:null,game:{s:null,snapshotSafe:true},profile:{},
  expedition:{...scoreRecipe(1),unlockedStage:1,civilizationScore:9999,battle:null,worlds:[world]}});
 assert.equal(ui.refreshCivilizationScore(),250);assert.equal(ui.expedition.unlockedStage,2);
 assert.equal(expeditionStageUnlocked(ui.expedition),true,'surplus score does not require buildings on the next map');
 ui.expedition.depth=2;assert.equal(expeditionStageUnlocked(ui.expedition),false,'score alone cannot skip a military stage');
 ui.refreshCivilizationScore();assert.equal(ui.expedition.unlockedStage,3);
 ui.view='game';ui.activeWorldStage=1;ui.game.s={map:'desert',seed:1409,depth:0,rules:{kind:'single-player',completed:true},entities:[]};
 assert.equal(ui.refreshCivilizationScore(),0);assert.equal(ui.expedition.unlockedStage,3);
 ui.expedition.depth=3;ui.refreshCivilizationScore();assert.equal(expeditionStageUnlocked(ui.expedition),false);
});

test('a partial or still-stepping tick cannot contribute score or unlock a stage',()=>{
 const ui=Object.create(MeridianUI.prototype),world={stage:1,recipe:scoreRecipe(0),battle:scoreSave([])};
 Object.assign(ui,{view:'game',activeWorldStage:1,profile:{},
  expedition:{...scoreRecipe(1),civilizationScore:0,unlockedStage:1,battle:null,worlds:[world]},
  game:{snapshotSafe:false,stepping:false,s:{map:'desert',seed:1409,depth:0,rules:{kind:'single-player',completed:true},
    entities:Array.from({length:10},()=>civil())}}});
 assert.equal(ui.refreshCivilizationScore(),0);assert.equal(ui.expedition.unlockedStage,1);
 ui.game.snapshotSafe=true;ui.game.stepping=true;
 assert.equal(ui.refreshCivilizationScore(),0);assert.equal(ui.expedition.unlockedStage,1);
 ui.game.stepping=false;assert.equal(ui.refreshCivilizationScore(),50);assert.equal(ui.expedition.unlockedStage,2);
});

test('military results save current world totals once instead of awarding score, and last-run display survives defeat',()=>{
 const {game}=fixture(),writes=[];game.s.rules.completed=false;
 game.snapshotSafe=true;Object.assign(game.s,{depth:0,map:'desert',seed:1409});
 for(let i=0;i<3;i++)game.spawnBuilding('fieldlab',i*10,0,0,0);
 game.snapshotBattle=archive=>{assert.equal(archive,true);return {version:1,tutorial:null,
  state:JSON.parse(JSON.stringify({...game.s,result:null,rules:{kind:'single-player',completed:true}}))};};
 const ui=Object.create(MeridianUI.prototype);
 Object.assign(ui,{view:'game',game,activeWorldStage:null,profile:{aether:0,expeditionDepth:0,lastCivilizationScore:0},
  expedition:{...scoreRecipe(0),faction:0,abilities:['drop'],battle:null,civilizationScore:9999,unlockedStage:1,benefits:{},enemyBenefits:[{}]},
  audio:{setMode(){},sound(){}},persistence:{saveProgress(profile,expedition){writes.push(JSON.parse(JSON.stringify({profile,expedition})));}},
  unlockedFactionForDepth:()=>0,rememberStage(){},createEncounter:()=>({map:'desert',seed:1410,enemies:[1]}),createBenefitOffers:()=>[],notifyStorageFailure(){},showResult(){}});
 game.s.stats.structuresDestroyed=0;
 const win={win:true,civilizationScore:999};ui.event('result',win);ui.event('result',win);
 assert.equal(ui.expedition.civilizationScore,15);assert.equal(ui.profile.lastCivilizationScore,15);assert.equal(writes.length,1);
 assert.equal(ui.expedition.unlockedStage,1);assert.match(renderHomeScreen(ui.expedition),/15<\/strong>/);
 ui.expedition.unlockedStage=2;game.s={...game.s,depth:1,seed:1410,entities:[civil()]};
 assert.equal(ui.refreshCivilizationScore(),20);
 game.s.entities[0].hp=0;
 ui.event('result',{win:false,civilizationScore:999});ui.event('result',{win:false,civilizationScore:999});
 assert.equal(ui.expedition,null);assert.equal(ui.profile.lastCivilizationScore,15);assert.equal(writes.length,2);
 assert.equal(writes[1].expedition,null);assert.equal(writes[1].profile.lastCivilizationScore,15);
 assert.match(renderHomeScreen(null,false,'',15),/15<\/strong>/);
 assert.match(renderHomeScreen({depth:0,civilizationScore:0},false,'',15),/0<\/strong>/);
});
