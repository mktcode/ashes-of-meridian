// Bounded local building/result contracts; no AI matches or simulation tick loop.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {loadScripts,BATTLEFIELD_SCRIPTS,SIMULATION_SCRIPTS}=require('./helpers/game-scripts.cjs');
const context=loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world',...SIMULATION_SCRIPTS,'ui-core','ui-templates','ui-actions','world-view']);
const {MeridianGame,MeridianUI,Battlefield,BattlefieldSurface,BUILDINGS,FACTIONS,PlacementGuideSampler,civilizationScoreForBuildings,renderHomeScreen}=vm.runInContext(
 '({MeridianGame,MeridianUI,Battlefield,BattlefieldSurface,BUILDINGS,FACTIONS,PlacementGuideSampler,civilizationScoreForBuildings,renderHomeScreen})',context);
const types=['fieldlab','researchhub','researchspire','embercottage','terracecommons','hearthtower'];
function fixture(faction=0,height=(x,z)=>40+.35*x+.12*z+.06*Math.sin(x)){
 const game=Object.create(MeridianGame.prototype),world=Object.create(Battlefield.prototype),extent=80,n=64;
 Object.assign(world,{extent,cellSize:2.5,gridSize:n,viewTeam:0,pathVersion:0,surface:new BattlefieldSurface(extent,2.5,height),
  staticGrid:new Uint8Array(n*n),blocked:new Uint8Array(n*n),fogPixels:new Uint8Array(n*n),fogVersion:0,
  sight:Array.from({length:2},()=>({visible:new Uint8Array(n*n).fill(255),explored:new Uint8Array(n*n).fill(255)}))});
 world.visible=world.sight[0].visible;world.explored=world.sight[0].explored;world.staticGrid.set(world.surface.cliffs);
 world.path=()=>({status:'complete',points:[]});
 Object.assign(game,{world,ids:new Map(),random:()=>.5,notify(){},emit(){},setOrder(w,order){w.order=order;},
  s:{time:0,nextId:3,rules:{kind:'single-player'},stats:{kills:0,damage:0,lost:0},supplyCaches:[],fields:[],scans:[],recalls:[],entities:[
   {id:1,team:0,faction,kind:'unit',type:'worker',hp:100,maxHp:100,progress:1,size:.65,x:-20,z:-20,order:{type:'idle'}}],
   parties:[{id:0,faction,account:{alloy:0,gas:100},meta:{},benefits:{},loadout:['drop'],deploymentPending:false},
    {id:1,faction:1,account:{alloy:0,gas:0},meta:{},benefits:{},loadout:[],deploymentPending:false}]}});
 return {game,world};
}
test('six civilian structures are the last build choices, cheap Echo-only, identical across factions and nonproductive',()=>{
 assert.deepEqual(Object.keys(BUILDINGS).slice(-6),types);
 types.forEach((type,i)=>{
  const d=BUILDINGS[type];assert.equal(d.cost,0);assert.equal(d.gas,[5,10,15][i%3]);assert.equal(d.civilizationPoints,5);
  assert.equal(d.vision,0);assert.equal(d.damage,undefined);assert.equal(d.cap,undefined);assert.equal(d.requires,undefined);
  assert.ok(FACTIONS.every(f=>f.buildings[type]===FACTIONS[0].buildings[type]));
 });
});
test('civilian placement accepts uneven slopes and cliff cells but protects obstacles, occupancy, exploration and worker access/payment',()=>{
 for(const faction of [0,1,2])for(const type of types){
  const {game,world}=fixture(faction),p={x:0,z:0},before=Array.from(world.surface.heights),gas=game.account(0).gas;
  assert.equal(world.surface.foundation(p,BUILDINGS[type].size),false);
  assert.match(game.canBuild('depot',p),/stable ground/);assert.equal(game.canBuild(type,p),'');
  const sampler=new PlacementGuideSampler(game,type,0);sampler.refresh();assert.equal(sampler.sample(p),1);
  const blocked=world.blocked;assert.equal(game.build(type,p),true);assert.strictEqual(world.blocked,blocked);
  const b=game.s.entities.at(-1);assert.equal(b.type,type);assert.equal(b.vision,0);assert.equal(b.progress,.06);
  assert.equal(game.account(0).alloy,0);assert.equal(game.account(0).gas,gas-BUILDINGS[type].gas);
  assert.equal(game.s.entities[0].order.id,b.id);assert.equal(game.s.entities[0].order.type,'build');
  assert.deepEqual(Array.from(world.surface.heights),before);
  game.s.entities[0].order={type:'idle'};assert.match(game.canBuild(type,p),/room (around|between)/);
  game.cancelConstruction(b.id);assert.equal(game.account(0).gas,gas-BUILDINGS[type].gas*.25);
 }
 const {game,world}=fixture();world.path=()=>({status:'unreachable',points:[]});const gas=game.account(0).gas;
 assert.equal(game.build('fieldlab',{x:0,z:0}),false);assert.equal(game.account(0).gas,gas);assert.equal(game.s.entities.length,1);
 world.sight[0].explored[world.idx(0,0)]=0;assert.match(game.canBuild('fieldlab',{x:0,z:0}),/Scout/);
 world.sight[0].explored.fill(255);world.staticGrid[world.idx(0,0)]=1;assert.match(game.canBuild('fieldlab',{x:0,z:0}),/obstructs/);
 world.staticGrid.fill(0);world.staticGrid[world.idx(0,-2.5)]=1;
 assert.match(game.canBuild('researchhub',{x:0,z:0}),/obstructs/,'interior obstacles cannot hide between perimeter samples');
 const sampler=new PlacementGuideSampler(game,'researchhub',0);sampler.refresh();assert.equal(sampler.sample({x:0,z:0}),-1);
 world.staticGrid.fill(0);world.surface.cliffs[world.idx(0,0)]=1;world.staticGrid.set(world.surface.cliffs);
 assert.equal(game.canBuild('fieldlab',{x:0,z:0}),'');
 assert.ok(game.canBuild('fieldlab',{x:79,z:0}));
});
test('civilian complexes use close nonoverlapping deck outlines while reserving stairs, walkways and military clearance',()=>{
 const yaw=vm.runInContext('BUILDING_YAW',context),cs=Math.cos(yaw),sn=Math.sin(yaw),at=(x,z=0)=>({x:x*cs+z*sn,z:-x*sn+z*cs});
 for(const first of types)for(const next of types){
  const {game}=fixture(0,()=>40);game.spawnBuilding(first,0,0,0,0);
  const old=BUILDINGS[first].size+BUILDINGS[next].size+.8;
  let close;
  for(let x=4;x<old;x+=.25)if(!game.canBuild(next,at(x))){close=at(x);break;}
  assert.ok(close,`${first}/${next} can form a tighter complex`);
  const sampler=new PlacementGuideSampler(game,next,0);sampler.refresh();assert.equal(sampler.sample(close),1);
  assert.ok(game.canBuild(next,at(1)),'models cannot intersect');
  assert.match(game.canBuild('depot',at(4.5)),/room around/,'military spacing is unchanged');
 }
 const {game}=fixture(0,()=>40);game.spawnBuilding('fieldlab',0,0,0,0);
 assert.match(game.canBuild('fieldlab',at(0,4.8)),/stairs/,'entry stairs are not just the main deck');
 const hub=fixture(0,()=>40).game;hub.spawnBuilding('researchhub',0,0,0,0);
 assert.match(hub.canBuild('fieldlab',at(5.75)),/walkways/,'the elevated side walkway keeps its footprint');
 const actual=fixture(0,()=>40);delete actual.world.path;actual.game.spawnBuilding('fieldlab',0,0,0,0);
 actual.world.rebuild(actual.game.s.entities);
 assert.equal(actual.game.build('fieldlab',at(4.9)),true,'a real worker route still permits the compact complex');
});
test('civilian cliff foundations are actually reachable and buildable from a safe service point without opening cliff paths for units',()=>{
 const {game,world}=fixture(0,(x,z)=>x>0?45:40);delete world.path;world.rebuild(game.s.entities);
 const p={x:1,z:0},worker=game.s.entities[0],radius=BUILDINGS.fieldlab.size+2.9;
 assert.equal(world.surface.fits(p.x,p.z),false);assert.equal(world.terrainFree(worker,p),false);
 assert.match(game.canBuild('depot',p),/stable ground/);assert.equal(game.canBuild('fieldlab',p),'');
 const sampler=new PlacementGuideSampler(game,'fieldlab',0);sampler.refresh();assert.equal(sampler.sample(p),1);
 assert.equal(game.build('fieldlab',p),true);const b=game.s.entities.at(-1);world.rebuild(game.s.entities);
 const area={...p,radius,terrainConnection:false},body=worker.size*vm.runInContext('UNIT_BODY_SCALE',context),
  path=world.path(worker.x,worker.z,p.x,p.z,false,area,body);
 assert.equal(path.status,'complete');assert.equal(world.surface.fits(path.goal.x,path.goal.z,body),true);
 assert.equal(world.blockedAt(path.goal.x,path.goal.z),false);assert.equal(world.terrainFree(path.goal,p),false);
 assert.notEqual(world.path(worker.x,worker.z,p.x,p.z,false,{...p,radius},body).status,'complete');
 Object.assign(worker,path.goal,{rot:0});game.effects={construction(){}};game.s.stats.built=0;
 assert.equal(game.move(worker,b,0,radius+.1,false,area),true,'movement stops at the reachable work area');
 game.worker(worker,BUILDINGS.fieldlab.time);assert.equal(b.progress,1);assert.equal(worker.order.type,'idle');
 assert.equal(world.surface.fits(p.x,p.z),false,'construction does not alter unit passability');
});
test('ordinary worker construction completes Echo-only civilian foundations and then releases the worker',()=>{
 for(const type of types){
  const {game}=fixture();game.effects={construction(){}};game.s.stats.built=0;
  assert.equal(game.build(type,{x:0,z:0}),true);const b=game.s.entities.at(-1),worker=game.s.entities[0];
  Object.assign(worker,{x:b.size+2.5,z:0,rot:0});const echo=game.account(0).gas;
  game.worker(worker,BUILDINGS[type].time);
  assert.equal(b.progress,1);assert.equal(b.hp,b.maxHp);assert.equal(worker.order.type,'idle');
  assert.equal(game.account(0).gas,echo);assert.equal(game.account(0).alloy,0);
  assert.equal(game.s.stats.built,1);assert.equal(civilizationScoreForBuildings(game.s.entities,0),5);
 }
});
test('civilian structures provide no vision or supply and are not reinforcement anchors',()=>{
 const {game,world}=fixture(0,()=>0);game.s.entities=[];
 const b=game.spawnBuilding('fieldlab',0,0,0,0);world.reveal(game.s.entities);
 assert.equal(b.vision,0);assert.ok(world.visible.every(v=>v===0));assert.equal(game.cap(),0);
 game.s.parties[0].account.energy=100;game.s.parties[0].account.abilities={drop:0};
 assert.equal(game.ability('drop',{x:0,z:0}),false);
});
test('score counts completed surviving own buildings only and defeat withdrawal preserves their tally',()=>{
 const {game}=fixture();const a=game.spawnBuilding('fieldlab',0,0,0,0);
 game.spawnBuilding('researchhub',10,0,0,0);game.spawnBuilding('researchspire',20,0,0,0,{progress:.8});
 game.spawnBuilding('fieldlab',30,0,1,1);game.spawnBuilding('researchhub',40,0,0,0,{hp:0});
 for(const type of types.slice(3))game.spawnBuilding(type,0,20,0,0);
 game.spawnBuilding('embercottage',0,30,0,0,{progress:.8});game.spawnBuilding('terracecommons',10,30,0,0,{hp:0});
 game.spawnBuilding('hearthtower',20,30,1,1);
 assert.equal(civilizationScoreForBuildings(game.s.entities,0),25);
 game.checkHQElimination();assert.equal(game.s.result.win,false);assert.equal(game.s.result.civilizationScore,25);assert.equal(a.hp,0);
});
test('result credit is added once per battle, persisted with the expedition and retained on defeat; home shows current or last run',()=>{
 const {game}=fixture();const writes=[];
 const ui=Object.create(MeridianUI.prototype);
 Object.assign(ui,{game,profile:{aether:0,expeditionDepth:0,lastCivilizationScore:0},
  expedition:{depth:0,civilizationScore:10,encounter:{map:'desert'},benefits:{},enemyBenefits:[{}]},
  audio:{setMode(){},sound(){}},persistence:{saveProgress(profile,expedition){writes.push(JSON.parse(JSON.stringify({profile,expedition})));}},
  unlockedFactionForDepth:()=>0,rememberStage(){},createEncounter:()=>({map:'desert',enemies:[1]}),createBenefitOffers:()=>[],notifyStorageFailure(){},showResult(){}});
 game.s.stats.structuresDestroyed=0;
 const win={win:true,civilizationScore:15};ui.event('result',win);ui.event('result',win);
 assert.equal(ui.expedition.civilizationScore,25);assert.equal(ui.profile.lastCivilizationScore,25);assert.equal(writes.length,1);
 assert.match(renderHomeScreen(ui.expedition),/25<\/strong>/);
 ui.resultAetherRecovered=undefined;ui.event('result',{win:false,civilizationScore:5});ui.event('result',{win:false,civilizationScore:5});
 assert.equal(ui.expedition,null);assert.equal(ui.profile.lastCivilizationScore,30);assert.equal(writes.length,2);
 assert.equal(writes[1].expedition,null);assert.equal(writes[1].profile.lastCivilizationScore,30);
 assert.match(renderHomeScreen(null,false,'',30),/30<\/strong>/);
 assert.match(renderHomeScreen({depth:0,civilizationScore:0},false,'',30),/0<\/strong>/);
});
