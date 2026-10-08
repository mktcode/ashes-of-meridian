const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {loadScripts,BATTLEFIELD_SCRIPTS,SIMULATION_SCRIPTS,UI_SCRIPTS} = require('./helpers/game-scripts.cjs');
const PROFILE = 'meridian.profile.v2';
const copy = value => JSON.parse(JSON.stringify(value));

function harness(data = new Map()) {
  const node = () => ({style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];},
    querySelector(s){return (this.parts ||= {})[s] ||= node();},querySelectorAll(){return [];},
    get innerHTML(){return this.html || '';},set innerHTML(v){this.html=v;this.parts={};}});
  const elements = new Map(), document = {getElementById(id){if(!elements.has(id))elements.set(id,node());return elements.get(id);}};
  let now=0;
  const context = loadScripts(['core','content','expedition','voice-content',...BATTLEFIELD_SCRIPTS,'world',...SIMULATION_SCRIPTS,
    'effects','persistence',...UI_SCRIPTS], {globals:{document,innerWidth:1280,innerHeight:720,performance:{now:()=>now},matchMedia:()=>({matches:true})}});
  const deps = vm.runInContext('({clamp,upgrades:BATTLE_UPGRADES,benefits:EXPEDITION_BENEFITS,abilities:ABILITIES,units:UNITS,buildings:BUILDINGS,battlefields:BATTLEFIELDS,missions:MISSIONS,enemyCount:expeditionEnemyCount})',context);
  const writes=[],fail={set:false};
  const persistence=vm.runInContext('createMeridianPersistence',context)({...deps,warn(){},getStorage:()=>({
    getItem:k=>data.get(k)??null,setItem(k,v){if(fail.set)throw Error('quota');data.set(k,v);writes.push(k);},removeItem:k=>data.delete(k)
  })});
  const profile=persistence.loadProfile();profile.tutorialComplete=true;
  const Game=vm.runInContext('MeridianGame',context),UI=vm.runInContext('MeridianUI',context),game=new Game(profile);
  class TestUI extends UI {
    bind(){} updateHUD(){} drawMinimap(){} radio(){} alert(){} clearMode(){this.mode=null;}
    beginBattleTutorial(){return false;} terrainCameraPoint(p){return {x:p.x,z:p.z};} center(){}
    openModal(kind,html){this.modalKind=kind;this.modalHTML=html;}
    showResult(result){this.modalKind='result';this.lastResult=result;}
  }
  const ui=new TestUI(game,{viewport:{width:1280,height:720},fogOn:false},{unlock(){},sound(){},setMode(){}},profile,persistence);
  game.emit=(...event)=>ui.event(...event);
  return {context,game,ui,persistence,profile,data,writes,fail,document,Game,setTime:v=>{now=v;}};
}

// One deterministic victory tick, not a match, AI evaluation or long simulation.
let input;
function victoryFixture() {
  if(input)return copy(input);
  const h=harness(),{game,ui}=h;
  const recipe={faction:0,depth:0,abilities:['orbital','repair','scan','drop'],upgrades:{},benefits:{supplyCrate:1},enemyBenefits:[{}],
    encounter:{map:'desert',seed:1409,mission:'hq-elimination',deployment:'exploration',enemies:[2]}};
  ui.expedition={...copy(recipe),version:8,battle:null,worlds:[]};
  game.start({...recipe,...recipe.encounter});
  const worker=game.alive(e=>e.team===0&&e.type==='worker')[0];
  game.spawnBuilding('hq',worker.x,worker.z,0,0,{progress:1});
  const barracks=game.spawnBuilding('barracks',worker.x+12,worker.z,0,0,{progress:1,
    queue:[{type:'rifle',progress:.3,time:10,cost:50,gas:0}]});
  const foundation=game.spawnBuilding('depot',worker.x-12,worker.z,0,0,{progress:.4,paid:{cost:100,gas:0}});
  worker.x=foundation.x+foundation.size+2;worker.z=foundation.z;
  worker.order={type:'build',id:foundation.id,x:foundation.x,z:foundation.z};
  const vent=game.alive(e=>e.kind==='resource'&&e.type==='gas')[0];
  game.spawnBuilding('refinery',vent.x,vent.z,0,0,{progress:1,gasId:vent.id});
  game.s.parties[0].account.gas=321;
  game.s.time=12;game.s.speed=2;game.resultClock=.2;
  for(const e of game.alive(e=>e.team===1)){e.hp=0;e.deathAt=12;}
  const beforeWrites=h.writes.length;
  let emitted=false;
  game.emit=(...event)=>{if(event[0]==='result'){
    emitted=true;assert.equal(game.stepping,false);assert.equal(game.snapshotSafe,true);
    const tick=game.stepTick;game.stepTick=()=>assert.fail('result subscriber recursively entered a tick');
    game.step(.05);game.stepTick=tick;
  }ui.event(...event);};
  game.step(.05);
  assert.equal(emitted,true);assert.equal(game.s.result.win,true);
  assert.equal(game.world.fogCleared,true);
  assert.ok(game.world.visible.every(v=>v===1));
  assert.ok(game.world.explored.every(v=>v===1));
  assert.ok(game.world.fogPixels.every(v=>v===255));
  assert.equal(ui.expedition.depth,1);assert.equal(ui.expedition.worlds.length,1);
  assert.deepEqual(h.writes.slice(beforeWrites),[PROFILE],'archive and transition share one commit');
  const world=ui.expedition.worlds[0];
  assert.equal(world.battle.state.result,null);assert.equal(world.battle.state.rules.completed,true);
  assert.equal(world.recipe.depth,0);assert.equal(world.recipe.benefits.supplyCrate,1);
  assert.ok(world.battle.state.parties[1].eliminated);
  assert.equal(game.s.rules.completed,undefined,'visible result was not converted into a live world');
  const loaded=h.persistence.loadExpedition();assert.deepEqual(copy(loaded),copy(ui.expedition));
  const packed=JSON.parse(h.data.get(PROFILE)).expedition.worlds[0].battle;
  assert.equal(packed.encoding,'lzw-v1');
  assert.ok(JSON.stringify(packed).length < JSON.stringify(world.battle).length/2,'real snapshot benefits from compression');
  input={record:h.data.get(PROFILE),world:copy(world),running:copy(ui.expedition),foundation:foundation.id,barracks:barracks.id};
  return copy(input);
}

function restoredMenu() {
  const fixture=victoryFixture(),h=harness(new Map([[PROFILE,fixture.record]]));
  h.ui.onPreview=async()=>true;
  h.ui.showHome();
  return {...h,fixture};
}

test('world codec round-trips Unicode, dictionary resets and rejects malformed codes',()=>{
  const h=harness(),pack=vm.runInContext('packWorldText',h.context),unpack=vm.runInContext('unpackWorldText',h.context);
  let seed=1,text='';
  for(let i=0;i<160000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;text+=String.fromCharCode(32+(seed%95));}
  text+=' 👋 世界\u0000\ud800 Écho '.repeat(200);
  const packed=pack(text);assert.equal(unpack(packed),text);
  assert.ok(packed[1].includes(String.fromCharCode(52000+256)),'fixture exercises dictionary reset');
  assert.throws(()=>unpack([packed[0],'\u0000']),/Invalid/);
  assert.throws(()=>unpack(['aa','x']),/Invalid/);
  assert.throws(()=>unpack([packed[0],String.fromCharCode(51000+256)]),/Invalid/);
});

test('a real completed tick archives its final world atomically and freezes only the copied result',()=>{
  const fixture=victoryFixture();
  assert.equal(fixture.world.battle.tutorial,null);
  assert.equal(fixture.world.battle.state.time,12.05);
});

test('civilian worlds discard pending eliminated-party strikes on archive and restore without changing the battle',()=>{
  const fixture=victoryFixture(),h=harness(),{game}=h,world=copy(fixture.world);
  game.emit=()=>{};
  game.restoreBattle({...world.recipe,battle:world.battle},true);
  game.s.rules.completed=false;
  const hq=game.alive(e=>e.team===0&&e.type==='hq')[0];
  const hostile=['orbital','shell'].map(type=>({type,team:1,x:hq.x,z:hq.z,radius:10,damage:440,at:game.s.time+.05}));
  const retained=[{...hostile[0],team:0,at:50}];
  game.s.strikes.push(...hostile,...retained);
  game.finish(true,'Victory');
  const archive=game.snapshotBattle(true);
  assert.deepEqual(copy(archive.state.strikes),retained);
  assert.deepEqual(copy(game.s.strikes),[...hostile,...retained],'archiving does not mutate the frozen battle');
  // A saved cleared world can still contain impacts queued before its victory.
  archive.state.strikes.push(...copy(hostile));
  game.restoreBattle({...world.recipe,battle:archive},true);
  assert.deepEqual(copy(game.s.strikes),retained,'hostile warnings are gone even before resuming');
  assert.equal(game.ability('scan',hq,1),false,'eliminated opponents cannot issue new abilities');
  const restoredHQ=game.get(hq.id),hp=restoredHQ.hp,shield=restoredHQ.shield;
  game.step(.1);
  assert.equal(restoredHQ.hp,hp);assert.equal(restoredHQ.shield,shield);
  assert.deepEqual(copy(game.s.strikes),retained);
});

test('Continue building converts the live victory without loading and saves only its archived world',()=>{
  const fixture=victoryFixture(),h=harness(new Map([[PROFILE,fixture.record]])),{game,ui}=h;
  game.emit=()=>{};
  game.restoreBattle({...fixture.world.recipe,battle:fixture.world.battle},true);
  game.s.rules.completed=false;
  game.s.result={win:true,text:'Victory',time:game.s.time,integrity:1,score:1};
  ui.view='game';ui.paused=true;ui.modalKind='result';
  const state=game.s,world=game.world,random=game.random.state;
  const hq=game.alive(e=>e.team===0&&e.type==='hq')[0];
  state.strikes.push({type:'orbital',team:1,x:hq.x,z:hq.z,radius:10,damage:440,at:state.time+.05});
  ui.onLaunchBattle=()=>assert.fail('no launch or loading screen');
  ui.onPreview=()=>assert.fail('no menu preview');
  ui.onLeaveBattle=()=>assert.fail('no exit transition');
  ui.continueBuilding();
  assert.equal(ui.modalKind,'civilizationIntro');
  assert.ok(state.result);
  ui.startCivilizationBuilding();
  assert.strictEqual(game.s,state);assert.strictEqual(game.world,world);
  assert.equal(game.random.state,random);assert.equal(state.result,null);
  assert.equal(state.rules.completed,true);assert.equal(state.strikes.length,0);
  assert.equal(ui.activeWorldStage,1);assert.equal(ui.paused,false);assert.equal(ui.modalKind,'');
  assert.deepEqual(copy(ui.expedition.worlds[0].battle),copy(game.snapshotBattle()));
  const saved=h.persistence.loadExpedition();
  assert.equal(saved.depth,1);assert.equal(saved.battle,null);assert.equal(saved.worlds.length,1);
  assert.equal(h.persistence.loadProfile().civilizationIntroComplete,true);
  const hp=hq.hp;game.step(.1);assert.equal(hq.hp,hp);assert.equal(state.result,null);
  ui.event('result',{win:true,text:'duplicate',time:state.time,integrity:1,score:1});
  assert.equal(ui.expedition.depth,1);assert.equal(ui.expedition.worlds.length,1);
  ui.saveBattle();
  assert.equal(h.persistence.loadExpedition().worlds[0].battle.state.time,state.time);
  assert.equal(game.continueClearedWorld(),false,'conversion is one-shot');
});

test('mothership stays free of environmental attacks during battle and civilian development',()=>{
  const {game}=harness(),events=[];
  game.emit=(type,data)=>events.push({type,data});
  game.start({seed:1409,map:'mothership'});
  game.s.parties.forEach(p=>{p.controller={kind:'human'};});
  const home=game.alive(e=>e.team===0&&e.type==='worker')[0];
  game.spawn('unit','rifle',home.x+10,home.z,0,0);
  game.random=()=>assert.fail('peaceful ticks must not draw combat RNG for environmental attacks');
  events.length=0;
  for(const completed of [false,true]){
    game.s.rules.completed=completed;
    for(const time of [151,201,301]){
      game.s.time=time;
      game.step(.05);
      assert.equal(game.s.strikes.length,0);
      assert.equal(game.s.result,null);
    }
  }
  assert.equal(events.filter(e=>e.type==='alert').length,0);
});

test('completed worlds restore fully visible and stay clear through observation updates; new battles and defeats retain fog',()=>{
  const fixture=victoryFixture(),h=harness(),{game}=h,world=copy(fixture.world);
  // The completed phase, not cached sight, owns the rule even while paused.
  const pack=vm.runInContext('packBattleGrid',h.context);
  const blank=pack(new Uint8Array(world.battle.gridSize**2));
  world.battle.sight[0]={visible:blank,explored:blank};
  game.restoreBattle({...world.recipe,battle:world.battle},true);
  assert.equal(game.world.fogCleared,true);
  assert.ok(game.world.visible.every(v=>v===1));
  assert.ok(game.world.explored.every(v=>v===1));
  assert.ok(game.world.fogPixels.every(v=>v===255));
  game.step(.4);
  game.world.reveal(game.s.entities,game.s.scans);
  assert.ok(game.world.visible.every(v=>v===1));
  assert.ok(game.world.fogPixels.every(v=>v===255));
  game.start({...world.recipe,...world.recipe.encounter});
  assert.equal(game.world.fogCleared,false);
  assert.ok(game.world.visible.some(v=>v===0));
  game.finish(false,'Defeat');
  assert.equal(game.world.fogCleared,false);
  assert.ok(game.world.fogPixels.some(v=>v!==255));
});

test('failure after result detection cannot archive or pay out a partial tick',()=>{
  const h=harness(),game=h.game,before=copy(h.profile);let events=0;
  game.s={rules:{kind:'single-player',mission:{id:'hq-elimination'}},entities:[],stats:{kills:0,damage:0,lost:0},time:12};
  game.emit=()=>events++;
  game.world={clearFog(){}};
  game.stepTick=function(){this.finish(true,'Victory',0);throw Error('late tick failure');};
  assert.throws(()=>game.step(.05),/late tick/);
  assert.equal(events,0);assert.equal(game.pendingResult,null);assert.equal(game.snapshotSafe,false);
  assert.deepEqual(copy(h.profile),before);assert.equal(h.data.has(PROFILE),false);
  assert.throws(()=>game.snapshotBattle(true),/completed/);
});

test('selected old world resumes building and production, saves separately and never grants progression',async()=>{
  const h=restoredMenu(),{ui,game,persistence}=h;
  ui.expedition.upgrades.startingWorkers=5;ui.expedition.benefits.aetherAllocation=2;
  const current=copy({...ui.expedition,worlds:undefined}),profile=copy(h.profile),previews=[];
  ui.onPreview=async(...args)=>{previews.push(args);return true;};
  await ui.browseStage(-1);
  assert.equal(previews[0][3],ui.expedition.worlds[0].battle);
  const button=h.document.getElementById('menu').querySelector('[data-ui="enterSelectedStage"]');
  assert.ok(button.innerHTML.startsWith('Enter world'));assert.equal(button.disabled,false);
  ui.enterSelectedStage();await Promise.resolve();
  assert.equal(ui.activeWorldStage,1);assert.equal(ui.paused,true);assert.equal(ui.battleTutorial,null);
  assert.equal(game.s.parties[0].meta.startingWorkers,undefined,'later upgrades do not change an old world');
  assert.equal(game.s.parties[0].benefits.aetherAllocation,undefined,'later expedition benefits do not leak backwards');
  const queueBefore=game.get(h.fixture.barracks).queue[0].progress,
    foundationBefore=game.get(h.fixture.foundation).progress,gasBefore=game.account(0).gas;
  ui.resume();game.step(.05);
  assert.ok(game.get(h.fixture.barracks).queue[0].progress>queueBefore);
  assert.ok(game.get(h.fixture.foundation).progress>foundationBefore,'unfinished building continues with its saved worker');
  assert.ok(game.account(0).gas>gasBefore);
  game.checkBattleResult();game.finish(true,'repeat',999);ui.event('result',{win:true});
  assert.equal(game.s.result,null);
  assert.deepEqual(copy({...ui.expedition,worlds:undefined}),current);
  assert.deepEqual(copy(h.profile),profile);
  game.s.cam.x+=2;h.setTime(5000);ui.autosaveBattle();
  const after=persistence.loadExpedition();
  assert.deepEqual(copy({...after,worlds:undefined}),current);
  assert.equal(after.worlds[0].battle.state.cam.x,game.s.cam.x);
  ui.showHome();assert.equal(ui.stagePreviewIndex,0);
  assert.ok(button !== h.document.getElementById('menu').querySelector('[data-ui="enterSelectedStage"]'));
  ui.enterSelectedStage();await Promise.resolve();assert.equal(ui.activeWorldStage,1);
  assert.equal(game.get(h.fixture.foundation).progress,after.worlds[0].battle.state.entities.find(e=>e.id===h.fixture.foundation).progress);
  assert.equal(ui.expedition.battle,null,'visits do not create a future battle');
});

test('an actual saved current battle survives a visit and restores independently afterwards',async()=>{
  const h=restoredMenu(),ui=h.ui;
  await ui.startExpeditionBattle();
  assert.equal(ui.activeWorldStage,null);assert.equal(ui.view,'game');
  h.game.s.time=21;h.game.s.cam.x+=3;ui.saveBattle();
  const current=copy(ui.expedition.battle);
  ui.showHome();await ui.browseStage(-1);ui.enterSelectedStage();await Promise.resolve();
  assert.equal(ui.activeWorldStage,1);
  const forum=h.game.spawnBuilding('meridianforum',0,0,0,0,{progress:1,cinderStock:100,settlementAt:999});
  const b=h.game.spawnBuilding('fieldlab',24,24,0,0,{progress:1,forumId:forum.id});
  assert.equal(h.game.configureSettlementUpgrade(b.id,'orbital'),true);
  assert.equal(ui.expeditionUpgrades().upgrades.orbital,1);
  assert.equal(ui.expedition.upgrades.orbital,undefined,'saved battle recipe remains frozen');
  h.game.s.cam.yaw+=.1;ui.saveBattle();
  assert.deepEqual(copy(ui.expedition.battle),current);
  assert.deepEqual(copy(h.persistence.loadExpedition().battle),current);
  ui.showHome();await ui.browseStage(1);ui.enterSelectedStage();await Promise.resolve();
  assert.equal(ui.activeWorldStage,null);assert.equal(ui.paused,false);
  assert.equal(ui.modalKind,'');
  assert.deepEqual(copy(h.game.snapshotBattle()),current);
});

test('victory permits immediate travel and old-world upgrades apply only to a new battle',async()=>{
  const h=restoredMenu(),{ui,game}=h,encounter=copy(ui.expedition.encounter);
  assert.equal(ui.expedition.depth,1);
  const button=h.document.getElementById('menu').querySelector('[data-ui="enterSelectedStage"]');
  assert.equal(button.disabled,false);
  await ui.browseStage(-1);ui.enterSelectedStage();await Promise.resolve();
  assert.equal(ui.activeWorldStage,1);
  const forum=game.spawnBuilding('meridianforum',0,0,0,0,{progress:1,cinderStock:100,settlementAt:999});
  const b=game.spawnBuilding('fieldlab',24,24,0,0,{progress:1,forumId:forum.id});
  assert.equal(game.configureSettlementUpgrade(b.id,'orbital'),true);
  assert.equal(ui.expeditionUpgrades().upgrades.orbital,1);
  assert.deepEqual(copy(ui.expedition.encounter),encounter);
  assert.equal(ui.expedition.battle,null);
  ui.showHome();await ui.browseStage(1);ui.enterSelectedStage();await Promise.resolve();
  assert.equal(ui.activeWorldStage,null);assert.equal(game.s.depth,1);
  assert.equal(game.s.parties[0].meta.orbital,1);
  assert.equal(h.persistence.loadExpedition().upgrades.orbital,1);
});

test('preview preparation disables entry and stale completions cannot switch the selected target',async()=>{
  const h=restoredMenu(),ui=h.ui;let resolve;
  ui.onPreview=()=>new Promise(done=>{resolve=done;});
  const pending=ui.browseStage(-1);
  assert.equal(ui.stagePreviewBusy,true);
  assert.equal(h.document.getElementById('menu').querySelector('[data-ui="enterSelectedStage"]').disabled,true);
  ui.enterSelectedStage();assert.equal(h.game.s,null);
  ui.view='codex';resolve(true);await pending;
  assert.equal(ui.stagePreviewIndex,1);assert.equal(h.game.s,null);
  ui.onPreview=async()=>true;ui.showHome();
  await ui.browseStage(-1);await ui.browseStage(1);
  ui.enterSelectedStage();assert.equal(ui.view,'transition');assert.equal(h.game.s,null);
});

test('a corrupt archived snapshot is isolated, retained across writes and explicitly discardable',()=>{
  const f=victoryFixture(),record=JSON.parse(f.record);
  record.expedition.worlds[0].battle.data=['x','\u0000'];
  const original=copy(record.expedition.worlds[0]),h=harness(new Map([[PROFILE,JSON.stringify(record)]])),ui=h.ui;
  assert.equal(ui.battleSaveError,null);assert.ok(ui.expedition.worlds[0].error);
  h.persistence.saveProgress(h.profile,ui.expedition);h.persistence.saveProfile({...h.profile,tutorialComplete:true});
  assert.deepEqual(JSON.parse(h.data.get(PROFILE)).expedition.worlds[0],original);
  ui.onPreview=async()=>true;ui.showHome();ui.stagePreviewIndex=0;ui.updateStagePreview();ui.enterSelectedStage();
  assert.equal(ui.modalKind,'worldSaveError');assert.equal(h.game.s,null);
  ui.uiAction('discardWorldSave');assert.equal(ui.expedition.worlds.length,0);
  assert.equal(ui.expedition.depth,1);assert.equal(ui.expedition.battle,null);
  assert.equal(JSON.parse(h.data.get(PROFILE)).expedition.worlds.length,0);
});

test('world encoding failure keeps raw damaged records and updated usable worlds in volatile memory',()=>{
  const f=victoryFixture(),record=JSON.parse(f.record),second=copy(f.world);
  record.expedition.depth=2;
  second.stage=2;second.recipe.depth=1;second.battle.state.depth=1;
  record.expedition.worlds[0].battle.data=['x','\u0000'];record.expedition.worlds.push(second);
  const original=copy(record.expedition.worlds[0]),h=harness(new Map([[PROFILE,JSON.stringify(record)]]));
  const world=h.ui.expedition.worlds[1];world.battle=copy(world.battle);
  world.battle.state.entities[0].label=Array.from({length:53000},(_,i)=>String.fromCharCode(256+i)).join('');
  assert.equal(h.persistence.saveProgress(h.profile,h.ui.expedition),false);
  assert.equal(h.persistence.available,false);
  assert.equal(h.persistence.loadExpedition().worlds[1].battle.state.entities[0].label.length,53000);
  h.persistence.saveProfile(h.profile);
  // The persistent record is unchanged, and later in-tab saves still preserve the damaged payload.
  h.persistence.saveProgress(h.profile,h.ui.expedition);
  const volatile=h.persistence.loadExpedition();assert.ok(volatile.worlds[0].error);
  assert.equal(volatile.worlds[1].battle.state.entities[0].label.length,53000);
  assert.deepEqual(JSON.parse(h.data.get(PROFILE)).expedition.worlds[0],original);
});

test('completed-world validation isolates recipe or phase damage and rejects ambiguous archive identities',()=>{
  const f=victoryFixture();
  for(const change of [w=>{delete w.battle.state.rules.completed;},w=>{w.recipe.benefits={};},
    w=>{w.battle.state.parties[1].eliminated=false;},w=>{w.battle.state.seed++;},w=>{w.battle.tutorial={step:'arrival'};}]){
    const record=JSON.parse(f.record);record.expedition.worlds=[copy(f.world)];change(record.expedition.worlds[0]);
    const h=harness(new Map([[PROFILE,JSON.stringify(record)]]));
    assert.equal(h.ui.battleSaveError,null);assert.ok(h.ui.expedition.worlds[0].error);
    assert.equal(h.ui.expedition.depth,1);
  }
  for(const identity of ['duplicate','future']){
    const record=JSON.parse(f.record);
    if(identity==='duplicate')record.expedition.worlds.push(copy(record.expedition.worlds[0]));
    else record.expedition.worlds[0].stage=2;
    const h=harness(new Map([[PROFILE,JSON.stringify(record)]]));
    assert.equal(h.ui.expedition,null);assert.ok(h.ui.battleSaveError);
  }
});

test('archive quota failure preserves old durable data and updated in-tab world without deleting history',async()=>{
  const h=restoredMenu(),ui=h.ui;
  await ui.browseStage(-1);ui.enterSelectedStage();await Promise.resolve();
  const durable=h.data.get(PROFILE);h.game.s.cam.yaw=1.234;
  h.fail.set=true;ui.showHome();
  assert.equal(ui.modalKind,'saveUnavailable');assert.equal(ui.view,'game');
  assert.equal(h.persistence.available,false);assert.equal(h.data.get(PROFILE),durable);
  assert.equal(h.persistence.loadExpedition().worlds[0].battle.state.cam.yaw,1.234);
  const reload=harness(new Map(h.data));
  assert.notEqual(reload.ui.expedition.worlds[0].battle.state.cam.yaw,1.234);
  assert.equal(reload.ui.expedition.worlds.length,1);
  ui.uiAction('leaveUnsaved');assert.equal(ui.view,'home');assert.equal(ui.stagePreviewIndex,0);
});
