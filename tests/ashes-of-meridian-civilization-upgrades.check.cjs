// Bounded local contracts: one terrain fixture, no AI matches or long simulation runs.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {loadScripts,BATTLEFIELD_SCRIPTS,SIMULATION_SCRIPTS}=require('./helpers/game-scripts.cjs');
const context=loadScripts(['core','content','expedition',...BATTLEFIELD_SCRIPTS,'world',...SIMULATION_SCRIPTS,'effects','persistence']);
const rules=vm.runInContext('({MeridianGame,BUILDINGS,CIVILIZATION_UPGRADES,CIVILIZATION_UPGRADE_FAMILIES,civilizationBuildingFamily,civilizationUpgradeOffers,civilizationUpgradeAllowed,civilizationUpgradeOffered,settlementReservedRadius,civilizationUpgradesForBuildings,expeditionCivilizationUpgrades,createMeridianPersistence,validExpeditionBattle,clamp,upgrades:BATTLE_UPGRADES,benefits:EXPEDITION_BENEFITS,upgradeFamilies:CIVILIZATION_UPGRADE_FAMILIES,abilities:ABILITIES,units:UNITS,buildings:BUILDINGS,battlefields:BATTLEFIELDS,missions:MISSIONS,enemyCount:expeditionEnemyCount})',context);
const copy=v=>JSON.parse(JSON.stringify(v));
const profile={version:2,expeditionDepth:1,tutorialComplete:true,settings:{volume:.28,music:true,sfx:true,quality:2,healthbars:false,showFps:false}};
const recipe={faction:0,depth:0,abilities:['orbital','repair','scan','drop'],upgrades:{commandTraining:1},benefits:{startingAlloy:1},enemyBenefits:[{}],encounter:{map:'desert',seed:1409,mission:'hq-elimination',deployment:'exploration',enemies:[2]}};
const game=new rules.MeridianGame(copy(profile));game.start({...recipe,...recipe.encounter});
const base=copy(game.snapshotBattle());
function active(){
  const g=Object.assign(Object.create(rules.MeridianGame.prototype),game);
  g.s=copy(base.state);g.ids=new Map(g.s.entities.map(e=>[e.id,e]));g.spatial=new Map();g.rehash();
  g.random=vm.runInContext('seeded(123)',context);g.effects=Object.assign(Object.create(game.effects),{damageNumber(){},explosion(){},construction(){},healing(){}});g.emit=()=>{};
  return g;
}
function fixture(type='embercottage',key){
  const g=active();g.s.rules.completed=true;
  const forum=g.spawnBuilding('meridianforum',0,0,0,0,{progress:1,cinderStock:100,settlementAt:999});
  const b=g.spawnBuilding(type,24,24,0,0,{progress:1,forumId:forum.id,size:rules.settlementReservedRadius(type)});
  if(key)b.upgradeOffers=[key,...Object.keys(rules.CIVILIZATION_UPGRADES).filter(k=>k!==key&&rules.civilizationUpgradeAllowed(type,k)).slice(0,2)];
  g.account(0).gas=1000;return {g,forum,b};
}
function persistence(){
  const data=new Map(),service=rules.createMeridianPersistence({...rules,warn(){},getStorage:()=>({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)})});
  return {data,service};
}
function runFor(g){return {version:10,...copy(recipe),worlds:[],battle:copy(g.snapshotBattle())};}

test('six effects per family produce three distinct stable offers without battle RNG',()=>{
  const residential=['startingAlloy','startingWorkers','aetherAllocation','constructionProtocols','logisticsFrame','repairLogistics'],
    research=['weaponTechnology','protectionSystems','fieldMedicine','commandTraining','commandCapacitor','commanderMandate'];
  assert.deepEqual(Object.keys(rules.CIVILIZATION_UPGRADES).sort(),[...residential,...research].sort());
  for(const type of ['embercottage','terracecommons','hearthtower','fieldlab','researchhub','researchspire']){
    const seen=new Set();
    for(let id=1;id<=40;id++){
      const offers=copy(rules.civilizationUpgradeOffers(type,1409,id));
      assert.equal(offers.length,3);assert.equal(new Set(offers).size,3);
      assert.ok(offers.every(k=>rules.civilizationUpgradeAllowed(type,k)));
      assert.deepEqual(copy(rules.civilizationUpgradeOffers(type,1409,id)),offers);
      offers.forEach(k=>seen.add(k));
    }
    assert.equal(seen.size,6);
  }
  const {g,b}=fixture(),rng=g.random.state;
  assert.deepEqual(copy(b.upgradeOffers),copy(rules.civilizationUpgradeOffers(b.type,g.s.seed,b.id)));
  assert.equal(g.random.state,rng);
});

test('activation chooses an offer permanently; ranks preserve health, geometry, offers and RNG',()=>{
  for(const type of ['embercottage','fieldlab']){
    const {g,b}=fixture(type),key=b.upgradeOffers[0],offers=copy(b.upgradeOffers),size=b.size,rng=g.random.state;
    const excluded=Object.keys(rules.CIVILIZATION_UPGRADES).find(k=>rules.civilizationUpgradeAllowed(type,k)&&!offers.includes(k));
    assert.equal(g.configureSettlementUpgrade(b.id,excluded),false);assert.equal(g.account(0).gas,1000);
    assert.equal(g.configureSettlementUpgrade(b.id,key),true);assert.equal(g.account(0).gas,960);
    assert.equal(g.configureSettlementUpgrade(b.id,offers[1]),false);assert.equal(g.configureSettlementUpgrade(b.id,null),false);
    assert.equal(g.configureSettlementUpgrade(b.id,key),true);assert.equal(g.account(0).gas,960);
    b.hp=b.maxHp*.5;
    assert.equal(g.expandSettlementBuilding(b.id),true);assert.equal(b.upgradeLevel,2);
    assert.equal(g.expandSettlementBuilding(b.id),true);assert.equal(b.upgradeLevel,3);assert.equal(g.account(0).gas,740);
    assert.equal(b.hp/b.maxHp,.5);assert.equal(b.size,size);assert.deepEqual(copy(b.upgradeOffers),offers);
    assert.equal(g.random.state,rng);assert.equal(g.expandSettlementBuilding(b.id),false);
  }
});

test('ineligible, unfinished, foreign, retiring and unsupplied buildings reject without spending',()=>{
  const {g,b,forum}=fixture(),key=b.upgradeOffers[0];
  for(const change of [()=>{g.s.rules.completed=false;},()=>{b.progress=.9;},()=>{b.team=1;},()=>{b.settlementAt=50;},()=>{forum.hp=0;}]){
    g.s.rules.completed=true;b.progress=1;b.team=0;delete b.settlementAt;forum.hp=forum.maxHp;change();
    assert.equal(g.configureSettlementUpgrade(b.id,key),false);assert.equal(g.account(0).gas,1000);
  }
  forum.hp=forum.maxHp;g.account(0).gas=39;assert.equal(g.configureSettlementUpgrade(b.id,key),false);
});

test('building ranks stack through shared definitions; worker and command caps remain global',()=>{
  for(const [type,key,group,max] of [['embercottage','startingAlloy','benefits',8],['embercottage','startingWorkers','benefits',5],['fieldlab','commandTraining','upgrades',3],['fieldlab','commanderMandate','benefits',3]]){
    const {g,b}=fixture(type,key);assert.equal(g.configureSettlementUpgrade(b.id,key),true);g.expandSettlementBuilding(b.id);
    const world={stage:1,recipe:copy(recipe),battle:copy(g.snapshotBattle())},second=copy(world),third=copy(world);
    second.stage=2;third.stage=3;second.battle.state.entities.find(e=>e.id===b.id).upgradeLevel=3;third.battle.state.entities.find(e=>e.id===b.id).upgradeLevel=3;
    assert.equal(rules.expeditionCivilizationUpgrades({worlds:[world,second,third]})[group][key],max);
  }
});

const totals={upgrades:{constructionProtocols:2,logisticsFrame:2,repairLogistics:2,weaponTechnology:2,protectionSystems:2,fieldMedicine:2,commandTraining:3},
  benefits:{startingAlloy:3,aetherAllocation:2,startingWorkers:2,commanderMandate:2,commandCapacitor:1}};

test('return delivers only new ranks, updates all equipped commands, and never replaces fallen bonus units',()=>{
  const g=active(),before=copy(g.account(0)),enemy=copy(g.party(1)),workers=()=>g.alive(e=>e.team===0&&e.type==='worker').length;
  const oldCooldown=g.abilityStats('orbital').cd;g.account(0).abilities.orbital=g.s.time+60;
  g.synchronizeCivilizationUpgrades(totals);
  assert.equal(g.account(0).abilities.orbital,g.s.time+60*g.abilityStats('orbital').cd/oldCooldown);
  assert.equal(g.account(0).alloy,before.alloy+100);assert.equal(g.account(0).gas,before.gas+100);assert.equal(g.account(0).energy,before.energy+15);
  assert.equal(workers(),3);assert.equal(g.alive(e=>e.team===0&&e.type==='hero').length,1);
  assert.deepEqual(copy(g.party(1)),enemy);
  for(const kind of recipe.abilities)assert.deepEqual(copy(g.abilityStats(kind)),copy(vm.runInContext(`abilityStats('${kind}',3)`,context)));
  const snapshot=copy(g.s),rng=g.random.state;
  g.synchronizeCivilizationUpgrades(totals);assert.deepEqual(copy(g.s),snapshot);assert.equal(g.random.state,rng);
  for(const e of g.s.entities)if(e.team===0&&e.kind==='unit'&&e.type==='hero')e.hp=0;
  g.alive(e=>e.team===0&&e.type==='worker')[1].hp=0;
  g.synchronizeCivilizationUpgrades(totals);assert.equal(workers(),2);assert.equal(g.alive(e=>e.team===0&&e.type==='hero').length,0);
  // Removing and rebuilding contributors cannot repay previously credited ranks.
  g.synchronizeCivilizationUpgrades({upgrades:{},benefits:{}});const account=copy(g.account(0));
  g.synchronizeCivilizationUpgrades(totals);
  for(const resource of ['alloy','gas','energy'])assert.equal(g.account(0)[resource],account[resource]);
  assert.equal(workers(),2);
});

test('a queued commander postpones delivery; cancelling it does not consume the bonus',()=>{
  const g=active(),hq=g.spawnBuilding('hq',0,0,0,0,{progress:1,
    queue:[{type:'hero',progress:0,time:40,cost:300,gas:100}]}),spawn=g.spawnUpgradeReinforcement;
  g.spawnUpgradeReinforcement=()=>assert.fail('queued commander duplicated');
  g.synchronizeCivilizationUpgrades({upgrades:{},benefits:{commanderMandate:1}});
  assert.equal(g.party(0).upgradeDelivery.commander,true);assert.equal(g.alive(e=>e.team===0&&e.type==='hero').length,0);
  hq.queue=[];g.spawnUpgradeReinforcement=spawn;g.s.time=3;g.deliverUpgradeUnits(0);
  const heroes=g.alive(e=>e.team===0&&e.type==='hero');assert.equal(heroes.length,1);
  assert.equal(g.party(0).upgradeDelivery.commander,false);
  heroes[0].hp=0;g.s.time=6;g.deliverUpgradeUnits(0);assert.equal(g.alive(e=>e.team===0&&e.type==='hero').length,0);
});

test('blocked arrivals remain saved, retry once space opens and do not consume RNG while blocked',()=>{
  const g=active(),spawn=g.spawnUpgradeReinforcement,rng=g.random.state;
  g.spawnUpgradeReinforcement=()=>null;g.synchronizeCivilizationUpgrades(totals);
  assert.equal(g.party(0).upgradeDelivery.workers,2);assert.equal(g.party(0).upgradeDelivery.commander,true);assert.equal(g.random.state,rng);
  const run=runFor(g);run.upgrades=copy(g.party(0).meta);run.benefits=copy(g.party(0).benefits);
  const {service}=persistence();assert.equal(service.saveProgress(profile,run),true);assert.ok(service.loadExpedition(),service.expeditionError);
  g.restoreBattle(service.loadExpedition());
  assert.equal(g.party(0).upgradeDelivery.workers,2);assert.equal(g.party(0).upgradeDelivery.commander,true);
  g.spawnUpgradeReinforcement=spawn;g.s.time+=3;g.deliverUpgradeUnits(0);
  assert.equal(g.party(0).upgradeDelivery.workers,0);assert.equal(g.party(0).upgradeDelivery.commander,false);
  const count=g.s.entities.length;g.s.time+=3;g.deliverUpgradeUnits(0);assert.equal(g.s.entities.length,count);
});

test('blocked delivery attempts bound and rotate their anchors without RNG',()=>{
  const party={eliminated:false,faction:0,upgradeDelivery:{credited:{startingWorkers:1},workers:1,commander:false,nextAttempt:0}},
    anchors=Array.from({length:10},(_,id)=>({id,x:id,z:0})),seen=[],g=Object.create(rules.MeridianGame.prototype);
  Object.assign(g,{s:{time:0},party:()=>party,alive:()=>anchors,rehash:()=>{},random:()=>{throw Error('delivery RNG');},
    spawnUpgradeReinforcement:(_type,home)=>{seen.push(home.id);return home.id===9?{id:99}:null;}});
  g.deliverUpgradeUnits(0);assert.equal(seen.length,8);assert.equal(party.upgradeDelivery.workers,1);
  g.s.time=3;g.deliverUpgradeUnits(0);assert.deepEqual(seen.slice(8),[8,9]);assert.equal(party.upgradeDelivery.workers,0);
});

test('existing units and foundations immediately use damage, protection, medicine, build and repair bonuses',()=>{
  const g=active(),w=g.alive(e=>e.team===0&&e.type==='worker')[0],
    rifle=g.spawnUnit('rifle',w.x+10,w.z,0,0),patient=g.spawnUnit('rifle',w.x+16,w.z,0,0);
  assert.ok(rifle&&patient);const damage=g.rangedStats(rifle).damage;
  const foundation=g.spawnBuilding('depot',w.x+30,w.z,0,0,{progress:.2});
  g.party(0).meta={weaponTechnology:2,protectionSystems:2,fieldMedicine:2,constructionProtocols:2,repairLogistics:2};
  assert.equal(g.rangedStats(rifle).damage,damage*1.04);
  const hp=rifle.hp;g.damage(rifle,100,{team:1},true);assert.equal(rifle.hp,hp-96);
  assert.equal(g.healingFactor(0),1.1);
  patient.hp-=100;const medic=g.spawnUnit('medic',patient.x+3,patient.z,0,0);assert.ok(medic);g.rehash();
  const patientHp=patient.hp;g.medic(medic,1);assert.equal(patient.hp,patientHp+rules.units.medic.heal*1.1);
  g.advanceConstruction(foundation,1);assert.ok(Math.abs(foundation.progress-(.2+1.1/rules.BUILDINGS.depot.time))<1e-9);
  const b=g.spawnBuilding('depot',w.x,w.z,0,0,{progress:1});b.hp-=100;
  w.order={type:'repair',id:b.id};g.account(0).alloy=1000;
  const before=b.hp;g.worker(w,1);assert.ok(b.hp>before+38);assert.ok(g.account(0).alloy>1000-41.8*.1);
});

test('energy supply increases current regeneration and respects the energy cap',()=>{
  const g=active();g.s.parties.forEach(p=>p.controller={kind:'human'});
  g.synchronizeCivilizationUpgrades({upgrades:{},benefits:{commandCapacitor:2}});
  const energy=g.account(0).energy;g.step(.05);
  assert.ok(Math.abs(g.account(0).energy-(energy+.05*.8*1.2))<1e-9);
  g.account(0).energy=200;g.step(.05);assert.equal(g.account(0).energy,200);
});

test('restored battle synchronizes before start subscribers and persists the receipt with the updated recipe',()=>{
  const run={version:10,...copy(recipe),worlds:[],battle:copy(base)},g=new rules.MeridianGame(copy(profile));
  let observed=false;g.emit=(type)=>{if(type==='start'){
    observed=true;assert.equal(g.party(0).benefits.startingWorkers,2);
    assert.equal(g.party(0).upgradeDelivery.workers,0);
    assert.equal(run.battle.state.parties[0].upgradeDelivery.credited.startingAlloy,3);
  }};
  g.restoreBattle(run,false,totals);assert.equal(observed,true);
  assert.ok(rules.validExpeditionBattle(run.battle,run,rules));
  const {service}=persistence();service.saveProgress(profile,run);const loaded=service.loadExpedition();assert.ok(loaded,service.expeditionError);
  const count=g.s.entities.length,account=copy(g.account(0));
  g.restoreBattle(loaded,false,totals);assert.equal(g.s.entities.length,count);assert.deepEqual(copy(g.account(0)),account);
});

test('offers, selections and delivery receipts round-trip and reject corrupted save fields',()=>{
  const {g,b}=fixture();g.configureSettlementUpgrade(b.id,b.upgradeOffers[0]);
  delete g.s.rules.completed;const run=runFor(g),{service}=persistence();
  service.saveProgress(profile,run);assert.deepEqual(copy(service.loadExpedition()),run);
  const corruptions=[r=>{r.battle.state.entities.find(e=>e.id===b.id).upgradeOffers.push('startingAlloy');},
    r=>{r.battle.state.entities.find(e=>e.id===b.id).upgradeOffers[1]=r.battle.state.entities.find(e=>e.id===b.id).upgradeOffers[0];},
    r=>{r.battle.state.entities.find(e=>e.id===b.id).upgradeOffers[0]='weaponTechnology';},
    r=>{r.battle.state.parties[0].upgradeDelivery.workers=6;},r=>{r.battle.state.parties[0].upgradeDelivery.credited.startingWorkers=99;},
    r=>{r.battle.state.parties[0].upgradeDelivery.credited.startingAlloy=0;}];
  for(const damage of corruptions){const bad=copy(run);damage(bad);service.saveProgress(profile,bad);assert.equal(service.loadExpedition(),null);}
});
