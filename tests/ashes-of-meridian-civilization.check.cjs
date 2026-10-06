// Bounded local building/result contracts; no AI matches or simulation tick loop.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {loadScripts,BATTLEFIELD_SCRIPTS,SIMULATION_SCRIPTS}=require('./helpers/game-scripts.cjs');
const context=loadScripts(['core','content','expedition',...BATTLEFIELD_SCRIPTS,'world',...SIMULATION_SCRIPTS,'ui-core','ui-templates','ui-actions','world-view']);
const {MeridianGame,MeridianUI,Battlefield,BattlefieldSurface,BUILDINGS,FACTIONS,PlacementGuideSampler,civilizationScoreForBuildings,expeditionCivilizationScore,civilizationScoreRequirement,expeditionStageUnlocked,renderHomeScreen}=vm.runInContext(
 '({MeridianGame,MeridianUI,Battlefield,BattlefieldSurface,BUILDINGS,FACTIONS,PlacementGuideSampler,civilizationScoreForBuildings,expeditionCivilizationScore,civilizationScoreRequirement,expeditionStageUnlocked,renderHomeScreen})',context);
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
  s:{time:0,nextId:3,rules:{kind:'single-player'},stats:{kills:0,damage:0,lost:0},supplyCaches:[],fields:[],scans:[],recalls:[],entities:[
   {id:1,team:0,faction,kind:'unit',type:'worker',hp:100,maxHp:100,progress:1,size:.65,x:-20,z:-20,order:{type:'idle'}}],
   parties:[{id:0,faction,account:{alloy:0,gas:100},meta:{},benefits:{},loadout:['drop'],deploymentPending:false},
    {id:1,faction:1,account:{alloy:0,gas:0},meta:{},benefits:{},loadout:[],deploymentPending:false}]}});
 return {game,world};
}
test('seven civilian structures are the last build choices, Echo-only, identical across factions and nonproductive',()=>{
 assert.deepEqual(Object.keys(BUILDINGS).slice(-7),allTypes);
 allTypes.forEach((type,i)=>{
  const d=BUILDINGS[type];assert.equal(d.cost,0);assert.equal(d.gas,i===6?25:[5,10,15][i%3]);assert.equal(d.civilizationPoints,i===6?30:[5,10,15][i%3]);
  assert.equal(d.civilizationUnlockStage,i===6?4:i%3+1);
  assert.equal(d.vision,BUILDINGS.depot.vision);assert.equal(d.damage,undefined);assert.equal(d.cap,undefined);assert.equal(d.requires,undefined);
  assert.ok(FACTIONS.every(f=>f.buildings[type]===FACTIONS[0].buildings[type]));
 });
});
test('civilian stage permissions block direct construction before payment and work across old worlds',()=>{
 const {game}=fixture();game.civilizationStage=1;
 for(const [i,type] of types.entries()){
  const allowed=i%3===0,gas=game.account(0).gas;
  if(allowed) assert.equal(game.canBuild(type,null),'');
  else {
   assert.match(game.canBuild(type,null),/Unlock Stage/);
   assert.equal(game.submitAction(0,{kind:'build',building:type,position:{x:0,z:0},selected:[]}),false);
   assert.equal(game.account(0).gas,gas);assert.equal(game.s.entities.length,1);
  }
 }
 game.civilizationStage=2;game.s.rules.completed=true;game.s.depth=0;
 for(const type of ['researchhub','terracecommons'])assert.equal(game.canBuild(type,null),'');
 for(const type of ['researchspire','hearthtower'])assert.match(game.canBuild(type,null),/Stage 3/);
 game.civilizationStage=3;
 for(const type of types)assert.equal(game.canBuild(type,null),'','old-world depth does not reset expedition permissions');
 const echo=game.account(0).gas;
 assert.match(game.canBuild('meridianforum',null),/Stage 4/);
 assert.equal(game.submitAction(0,{kind:'build',building:'meridianforum',position:{x:0,z:0},selected:[]}),false);
 assert.equal(game.account(0).gas,echo);assert.equal(game.s.entities.length,1);
 game.civilizationStage=4;
 for(const type of allTypes)assert.equal(game.canBuild(type,null),'','Stage 4 adds just the shared forum');
 game.civilizationStage=null;
 for(const type of allTypes)assert.equal(game.canBuild(type,null),'','isolated non-expedition worlds have no campaign gate');
});
test('civilian placement accepts uneven slopes and cliff cells but protects obstacles, occupancy, exploration and worker access/payment',()=>{
 for(const faction of [0,1,2])for(const type of allTypes){
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
  assert.match(game.canBuild('fieldlab',next),/stairs/);
 }
 assert.ok(game.canBuild('fieldlab',at(0,0)),'the large hull cannot intersect another civic building');
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
 assert.equal(b.progress,1);assert.equal(worker.order.type,'idle');assert.equal(civilizationScoreForBuildings(game.s.entities,0),30);
 assert.equal(game.account(0).gas,75);assert.equal(world.surface.fits(p.x,p.z),false);
});
test('ordinary worker construction completes Echo-only civilian foundations and then releases the worker',()=>{
 for(const type of allTypes){
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
 game.checkHQElimination();assert.equal(game.s.result.win,false);assert.equal(game.s.result.civilizationScore,45);assert.equal(a.hp,0);
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
 const {game}=fixture(),writes=[];
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
