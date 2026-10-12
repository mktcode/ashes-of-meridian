// Bounded local logic with a navigation stub: no generated maps, AI matches or long runs.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {loadScripts,SIMULATION_SCRIPTS,UI_SCRIPTS}=require('./helpers/game-scripts.cjs');
const copy=v=>JSON.parse(JSON.stringify(v));
function fixture(completed=true) {
  const nodes=new Map(),document={getElementById(id){if(!nodes.has(id)){const classes=new Set();nodes.set(id,{innerHTML:'',textContent:'',style:{},classList:{add(...v){v.forEach(x=>classes.add(x));},remove(...v){v.forEach(x=>classes.delete(x));},contains:v=>classes.has(v),toggle(v,on){on?classes.add(v):classes.delete(v);}},setAttribute(){},querySelectorAll(){return [];}});}return nodes.get(id);}};
  const context=loadScripts(['core','content','world','expedition','effects','persistence',...SIMULATION_SCRIPTS,...UI_SCRIPTS],{globals:{document,innerWidth:400,innerHeight:800,performance:{now:()=>0},matchMedia:()=>({matches:true}),BATTLEFIELDS:{desert:{name:'Desert'}}}});
  const rules=vm.runInContext('({factions:FACTIONS,MeridianGame,MeridianUI,createParty,createOutpostState,retireExpeditionOutpost,expeditionCivilizationUpgrades,validExpeditionBattle,createMeridianPersistence,clamp,upgrades:BATTLE_UPGRADES,benefits:EXPEDITION_BENEFITS,upgradeFamilies:CIVILIZATION_UPGRADE_FAMILIES,abilities:ABILITIES,units:UNITS,buildings:BUILDINGS,battlefields:{desert:{}},missions:MISSIONS,enemyCount:expeditionEnemyCount})',context);
  const g=new rules.MeridianGame({version:2,expeditionDepth:1}),events=[];g.emit=(...event)=>events.push(event);
  g.s={depth:0,seed:1409,map:'desert',time:0,parties:[rules.createParty(0,0,{},{}),rules.createParty(1,1,{},{})],
    rules:{kind:'single-player',mission:{id:'hq-elimination'},...(completed?{completed:true}:{})},stopped:false,nextId:1,entities:[],supplyCaches:[],scans:[],strikes:[],fields:[],recalls:[],
    stats:{kills:0,structuresDestroyed:0,lost:0,trained:0,gathered:0,built:0,damage:0},triggers:{},cam:{x:0,z:0,zoom:50,yaw:0},result:null,speed:1};
  g.enableAI(1);if(completed){g.s.parties[1].eliminated=true;g.s.outpost=rules.createOutpostState(0);}
  g.world={clearFog(){},extent:100,gridSize:4,blocked:new Uint8Array(16),pathVersion:0,sight:[0,1].map(()=>({visible:new Uint8Array(16).fill(1),explored:new Uint8Array(16).fill(1)})),
    deploymentReachable:new Uint8Array(16).fill(1),point:i=>({x:(i%4)*40-60,z:Math.floor(i/4)*40-60}),blockedAt:()=>false,terrainFree:()=>true,surface:{fits:()=>true,segment:()=>true}};
  const hq=g.spawnBuilding('hq',0,0,0,0),recipe={faction:0,depth:0,abilities:['orbital','repair','scan','drop'],upgrades:{},benefits:{},enemyBenefits:[{}],encounter:{map:'desert',seed:1409,mission:'hq-elimination',deployment:'exploration',enemies:[1]}};
  const run={version:12,...copy(recipe),depth:1,battle:null,worlds:[{stage:1,map:'desert',seed:1409,recipe:copy(recipe),battle:g.snapshotBattle()}]};
  const save=()=>{g.rehash();return g.snapshotBattle();};
  const data=new Map(),service=rules.createMeridianPersistence({...rules,getStorage:()=>({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}),warn(){}});
  function building(key='startingAlloy',rank=1) {
    const forum=g.alive(e=>e.type==='meridianforum')[0] || g.spawnBuilding('meridianforum',30,0,0,0,{settlementAt:999});
    const b=g.spawnBuilding(rank===3?'hearthtower':'embercottage',40,g.s.nextId*3,0,0,{forumId:forum.id});
    if(!b.upgradeOffers.includes(key))b.upgradeOffers=[key,...b.upgradeOffers.filter(x=>x!==key).slice(0,2)];
    b.upgrade=key;b.upgradeLevel=rank;return b;
  }
  return {g,hq,rules,run,recipe,save,building,events,nodes,service,data,document};
}

test('cleared outposts warn, vary entrances and grow successive waves without reviving eliminated AI',()=>{
  const {g,rules,events}=fixture(),rng=g.random.state;
  g.s.time=150;g.updateOutpost();assert.equal(g.s.outpost.warned,true);assert.equal(g.random.state,rng);
  assert.ok(g.s.outpost.entrance);assert.equal(events.filter(e=>e[0]==='alert').length,1);
  g.updateOutpost();assert.equal(events.length,1,'one warning only');
  g.s.time=180;g.updateOutpost();const first=g.alive(e=>e.wavePower);assert.equal(first.length,7);assert.equal(first[0].wavePower,1);
  assert.equal(g.s.parties[1].eliminated,true);assert.equal(g.s.outpost.nextWave,360);
  g.s.time=360;g.updateOutpost();const stronger=g.alive(e=>e.wavePower>1);
  assert.ok(stronger.length);assert.ok(g.rangedStats(stronger[0]).damage>g.rangedStats({...stronger[0],wavePower:1}).damage);
  assert.equal(g.s.outpost.wave,2);assert.equal(rules.validExpeditionBattle(g.snapshotBattle(),fixture().recipe,rules,true),true);
});

test('evacuation is actor-validated and irreversible; explicit HQ arrivals disappear without casualties',()=>{
  const {g,hq,save,rules,recipe}=fixture();
  assert.equal(g.submitAction(1,{kind:'startEvacuation',id:hq.id}),false);
  assert.equal(g.submitAction(0,{kind:'startEvacuation',id:hq.id}),true);
  assert.equal(g.startEvacuation(hq.id),false);assert.equal(g.s.outpost.evacuation.until,60);
  const boarded=g.spawnUnit('rifle',hq.size+3,0,0,0),defender=g.spawnUnit('worker',-hq.size-3,0,0,0);
  boarded.hp/=2;boarded.kills=7;
  assert.equal(g.submitAction(0,{kind:'order',ids:[boarded.id],order:{type:'smart',id:hq.id,x:0,z:0}},false),true);
  g.updateOutpost();assert.equal(g.get(boarded.id),null);assert.equal(g.s.entities.some(e=>e.id===boarded.id),false);
  assert.ok(g.get(defender.id),'nearby defenders are not boarded without a command');
  assert.deepEqual(copy(g.s.outpost.evacuation.units),[{type:'rifle',hp:.5,shield:0,kills:7}]);assert.equal(g.s.stats.lost,0);
  assert.equal(rules.validExpeditionBattle(save(),recipe,rules,true),true,'no dangling hash membership after boarding');
  const late=g.spawnUnit('tank',hq.size+3,0,0,0);g.orderEvacuation([late],hq,0);g.s.time=60;g.updateOutpost();
  assert.equal(g.s.outpost.finished,true);assert.equal(g.s.outpost.evacuation.units.length,1);assert.ok(g.get(late.id));
});

test('three building ranks can be secured, replaced and survive destruction; retirement is permanent and once-only',()=>{
  const h=fixture(),{g,hq,rules,run,building}=h;g.startEvacuation(hq.id);
  const a=building('startingAlloy',3),b=building('startingWorkers'),c=building('aetherAllocation'),d=building('repairLogistics');
  for(const e of [a,b,c])assert.equal(g.evacuateUpgrade(e.id),true);
  assert.equal(g.evacuateUpgrade(d.id),false);assert.equal(g.evacuateUpgrade(b.id),true);assert.equal(g.evacuateUpgrade(d.id),true);
  a.hp=0;hq.hp=0;g.updateOutpost();assert.equal(g.s.outpost.finished,true);
  run.worlds[0].battle=h.save();
  assert.equal(rules.retireExpeditionOutpost(run,1,g.s),true);assert.equal(run.worlds.length,1);
  assert.equal(run.worlds[0].retired,'evacuated');
  assert.equal(rules.retireExpeditionOutpost(run,1,g.s),false);
  assert.deepEqual(copy(run.rescuedUpgrades),{upgrades:{repairLogistics:1},benefits:{startingAlloy:3,aetherAllocation:1}});
  assert.deepEqual(copy(rules.expeditionCivilizationUpgrades(run)),copy(run.rescuedUpgrades));
  assert.equal(h.service.saveProgress({version:2},run),true);assert.deepEqual(copy(h.service.loadExpedition()),copy(run));
  assert.deepEqual(copy(h.service.loadStageHistory(run)).map(e=>e.stage),[1,2]);
});

test('loss without evacuation closes only the outpost, preserving its scene and another world',()=>{
  const {g,hq,rules,run}=fixture();run.worlds.push({...copy(run.worlds[0]),stage:2});
  hq.hp=0;g.updateOutpost();assert.equal(g.s.outpost.finished,true);
  assert.equal(rules.retireExpeditionOutpost(run,1,g.s),true);assert.deepEqual(run.worlds.map(w=>w.stage),[1,2]);
  assert.equal(run.worlds[0].retired,'lost');assert.equal(run.worlds[1].retired,undefined);
  assert.deepEqual(copy(run.rescuedArmy),[]);assert.equal(run.depth,1);
});

test('evacuation snapshots persist timer, selection, boarded army and hostile shells; malformed values are rejected',()=>{
  const {g,hq,rules,run,recipe,save,building,service,data}=fixture();
  g.startEvacuation(hq.id);g.evacuateUpgrade(building().id);
  g.s.outpost.evacuation.units.push({type:'tank',hp:.6,shield:0,kills:5});g.s.time=17;
  const attacker=g.spawnUnit('artillery',60,60,1,1,{wavePower:1.16});
  g.s.strikes.push({x:0,z:0,at:18,damage:100,radius:4,team:1,type:'shell',source:attacker.id});
  run.worlds[0].battle=save();assert.equal(rules.validExpeditionBattle(run.worlds[0].battle,recipe,rules,true),true);
  service.saveProgress({version:2},run);const restored=service.loadExpedition();
  assert.deepEqual(copy(restored.worlds[0].battle.state.outpost),copy(g.s.outpost));
  for(const mutate of [s=>{s.outpost.evacuation.until=-1;},s=>{s.outpost.evacuation.units[0].hp=0;},s=>{s.outpost.evacuation.units[0].type='invalid';},s=>{s.outpost.evacuation.upgrades.push(...s.outpost.evacuation.upgrades);},s=>{s.outpost.remaining=81;}]) {
    const bad=copy(run.worlds[0].battle);mutate(bad.state);assert.equal(rules.validExpeditionBattle(bad,recipe,rules,true),false);
  }
  const badRun=copy(run);badRun.rescuedArmy=[{type:'tank',hp:2,shield:0,kills:0}];service.saveProgress({version:2},badRun);
  assert.equal(service.loadExpedition(),null);assert.ok(data.size);
});

test('saved reinforcements retry bounded placement, retain hull and experience and never duplicate',()=>{
  const {g,rules,recipe,save}=fixture(false);g.s.reinforcements={units:[{type:'tank',hp:.4,shield:0,kills:8}],nextAttempt:0};
  const spawn=g.spawnUpgradeReinforcement.bind(g);let attempts=0;
  g.spawnUpgradeReinforcement=()=>{attempts++;return null;};g.deliverEvacuatedArmy();g.deliverEvacuatedArmy();
  assert.equal(attempts,1);assert.equal(g.s.reinforcements.units.length,1);assert.equal(rules.validExpeditionBattle(save(),recipe,rules),true);
  g.s.time=2;g.spawnUpgradeReinforcement=spawn;g.deliverEvacuatedArmy();
  const tank=g.alive(e=>e.type==='tank')[0];assert.equal(tank.hp/tank.maxHp,.4);assert.equal(tank.kills,8);
  g.deliverEvacuatedArmy();assert.equal(g.alive(e=>e.type==='tank').length,1);assert.equal(g.s.reinforcements.units.length,0);
});

test('finished outposts save their rescue before launching the highest battle and wait for in-flight transitions',()=>{
  const {g,hq,rules,run,service,nodes}=fixture();g.startEvacuation(hq.id);
  const boarded=g.spawnUnit('rifle',hq.size+3,0,0,0),remaining=g.spawnUnit('worker',-hq.size-3,0,0,0);
  g.orderEvacuation([boarded],hq,0);g.updateOutpost();g.s.time=60;g.updateOutpost();
  const calls=[],ui=Object.assign(Object.create(rules.MeridianUI.prototype),{game:g,view:'game',activeWorldStage:1,expedition:run,
    profile:{version:2},persistence:service,selected:[],launchingBattle:true,leavingBattle:false,
    notifyStorageFailure(){},rememberStage(){},toast(){},startExpeditionBattle(){
      calls.push('launch');
      const world=service.loadExpedition().worlds[0];
      assert.equal(world.retired,'evacuated','retirement is durable before launch');
      assert.equal(world.battle.state.time,60,'final scene is preserved, not the older autosave');
      assert.equal(world.battle.state.outpost.finished,true);
      assert.equal(world.battle.state.entities.some(e=>e.id===boarded.id),false,'boarded units leave the scene');
      assert.equal(world.battle.state.entities.some(e=>e.id===remaining.id),true,'unrescued units remain scenery');
      assert.equal(service.loadExpedition().rescuedArmy.length,1);
    }});
  assert.equal(ui.finishOutpost(),false);assert.equal(run.worlds.length,1);
  ui.launchingBattle=false;assert.equal(ui.finishOutpost(),true);assert.equal(ui.activeWorldStage,null);assert.equal(g.s,null);
  assert.equal(ui.finishOutpost(),false);assert.deepEqual(calls,['launch']);assert.equal(nodes.get('hud').classList.contains('hidden'),true);
});

test('a victory carries still-waiting rescue to the next highest stage, not into the cleared snapshot',()=>{
  const {g,rules,run}=fixture(false),saved={type:'tank',hp:.4,shield:0,kills:8};
  run.depth=0;run.worlds=[];g.s.reinforcements={units:[saved],nextAttempt:2};g.s.parties[1].eliminated=true;
  g.s.result={win:true,text:'Victory'};
  const process=vm.runInContext('createExpeditionResultProcessor()',loadScripts(['core','content','expedition']));
  process({version:2,expeditionDepth:0},run,g.s,true,{snapshotVictory:()=>g.snapshotBattle(true),createEncounter:()=>copy(run.encounter)});
  assert.deepEqual(copy(run.rescuedArmy),[saved]);assert.equal(run.worlds[0].battle.state.reinforcements,undefined);
  assert.equal(g.continueClearedWorld(),true);assert.equal(g.s.reinforcements,undefined);assert.equal(g.s.outpost.wave,0);
});

test('the start event consumes queued rescue once, persists blocked arrivals and does not transfer into another outpost',()=>{
  const {g,rules,run}=fixture(false),saved={type:'rifle',hp:.5,shield:0,kills:6};run.rescuedArmy=[saved];
  const ui=Object.assign(Object.create(rules.MeridianUI.prototype),{game:g,expedition:run,launchingWorld:null,
    audio:{resetBattleMusic(){},setMode(){}},clearMode(){},updateHUD(){},beginBattleTutorial(){return false;},saveBattle(){},
    selected:[],battleIntro:null,battleTutorial:null});
  g.spawnUpgradeReinforcement=()=>null;
  ui.event('start',{});assert.equal(run.rescuedArmy.length,0);assert.deepEqual(copy(g.s.reinforcements.units),[saved]);
  ui.event('start',{});assert.equal(g.s.reinforcements.units.length,1,'no duplicate on start retry');
  run.rescuedArmy=[saved];ui.launchingWorld={stage:1};ui.showPause=()=>{};ui.event('start',{restored:true});
  assert.equal(run.rescuedArmy.length,1,'a world visit is not the destination');
});

test('retired scenes remain previewable but cannot be entered or contribute live or saved bonuses',async()=>{
  const {g,hq,rules,run,building,save,service,document}=fixture();
  building('startingAlloy',3);hq.hp=0;g.updateOutpost();run.worlds[0].battle=save();
  const scene=run.worlds[0].battle;
  assert.equal(rules.retireExpeditionOutpost(run,1,g.s),true);
  assert.equal(run.worlds[0].battle,scene);
  assert.deepEqual(copy(rules.expeditionCivilizationUpgrades(run,g.s,1)),{upgrades:{},benefits:{}});
  service.saveProgress({version:2},run);
  const loaded=service.loadExpedition();assert.equal(loaded.worlds[0].retired,'lost');
  assert.deepEqual(copy(loaded.worlds[0].battle),copy(scene));
  const ui=Object.assign(Object.create(rules.MeridianUI.prototype),{expedition:loaded,view:'home',modalKind:'',
    stageHistory:service.loadStageHistory(loaded),stagePreviewIndex:0,stagePreviewBusy:false,launchingBattle:false,
    toast(){},onLaunchBattle(){throw Error('retired world must not launch');}});
  assert.deepEqual(copy(ui.stageBattle(1)),copy(scene));
  ui.enterSelectedStage();await ui.startExpeditionBattle(loaded.worlds[0]);
  const parts=new Map(),panel={classList:{toggle(){}},setAttribute(){},querySelector(s){if(!parts.has(s))parts.set(s,{});return parts.get(s);}},button={};
  document.getElementById('menu').querySelector=s=>s==='.expedition-stage'?panel:button;
  ui.updateStagePreview();
  assert.equal(button.disabled,true);
  assert.equal(parts.get('.stage-status').textContent,'OUTPOST LOST · VIEW ONLY');
  assert.equal(parts.get('[data-ui="nextStage"]').disabled,false,'archive browsing stays available');
  loaded.worlds[0].retired='evacuated';ui.updateStagePreview();
  assert.equal(parts.get('.stage-status').textContent,'EVACUATED · VIEW ONLY');
  const previews=[];ui.onPreview=async(map,seed,smooth,battle)=>{previews.push({map,seed,battle});return true;};
  await ui.browseStage(1);assert.equal(ui.stagePreviewIndex,1);
  await ui.browseStage(-1);assert.equal(ui.stagePreviewIndex,0);
  assert.deepEqual(copy(previews[1]),{map:'desert',seed:1409,battle:copy(scene)});
  ui.finishContinueBuilding();assert.equal(ui.activeWorldStage,undefined,'continue building excludes retired scenes');
});

test('retirement survives reload without duplicate rescue and rejects unknown archive markers',()=>{
  const {g,hq,rules,run,save,service,data}=fixture();g.startEvacuation(hq.id);
  g.s.outpost.evacuation.units.push({type:'rifle',hp:1,shield:0,kills:2});
  g.s.time=60;g.updateOutpost();run.worlds[0].battle=save();
  assert.equal(rules.retireExpeditionOutpost(run,1,g.s),true);service.saveProgress({version:2},run);
  const loaded=service.loadExpedition();
  assert.equal(rules.retireExpeditionOutpost(loaded,1,g.s),false);assert.equal(loaded.rescuedArmy.length,1);
  const record=JSON.parse(data.get('meridian.profile.v2'));record.expedition.worlds[0].retired='invalid';
  data.set('meridian.profile.v2',JSON.stringify(record));assert.equal(service.loadExpedition(),null);
});

test('HUD highlights evacuation, reports rescued ranks and clears the effect outside the outpost',()=>{
  const {g,hq,rules,nodes,run}=fixture();
  const ui=Object.assign(Object.create(rules.MeridianUI.prototype),{game:g,activeWorldStage:1,outpostMarkup:'',paused:false,expedition:run});
  ui.updateOutpostHUD();assert.equal(nodes.get('worldViewport').classList.contains('evacuating'),false);
  g.startEvacuation(hq.id);g.s.time=5;ui.updateOutpostHUD();assert.equal(nodes.get('worldViewport').classList.contains('evacuating'),true);
  assert.match(nodes.get('outpostStatus').innerHTML,/55s/);ui.activeWorldStage=null;ui.updateOutpostHUD();
  assert.equal(nodes.get('worldViewport').classList.contains('evacuating'),false);assert.equal(nodes.get('outpostStatus').classList.contains('hidden'),true);
});
