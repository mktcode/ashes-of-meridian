// Bounded local contracts: a shared immutable terrain fixture and two isolated ticks, no AI matches.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {loadScripts,BATTLEFIELD_SCRIPTS,SIMULATION_SCRIPTS}=require('./helpers/game-scripts.cjs');
const context=loadScripts(['core','content','expedition',...BATTLEFIELD_SCRIPTS,'world',...SIMULATION_SCRIPTS,'effects','persistence']);
const rules=vm.runInContext('({MeridianGame,BUILDINGS,CIVILIZATION_UPGRADE_COSTS,CIVILIZATION_UPGRADES,CIVILIZATION_UPGRADE_FAMILIES,civilizationBuildingFamily,civilizationUpgradeAllowed,civilizationBuildingTier,settlementReservedRadius,settlementReservedFootprints,settlementBuildingType,civilizationUpgradesForBuildings,expeditionCivilizationUpgrades,createMeridianPersistence,clamp,upgrades:BATTLE_UPGRADES,benefits:EXPEDITION_BENEFITS,abilities:ABILITIES,units:UNITS,buildings:BUILDINGS,battlefields:BATTLEFIELDS,missions:MISSIONS,enemyCount:expeditionEnemyCount})',context);
const copy=v=>JSON.parse(JSON.stringify(v));
const profile={version:2,expeditionDepth:1,tutorialComplete:true,settings:{volume:.28,music:true,sfx:true,quality:2,healthbars:false,showFps:false}};
const recipe={faction:0,depth:0,abilities:['orbital','repair','scan','drop'],upgrades:{orbital:1},benefits:{supplyCrate:1},enemyBenefits:[{}],encounter:{map:'desert',seed:1409,mission:'hq-elimination',deployment:'exploration',enemies:[2]}};
const game=new rules.MeridianGame(copy(profile));game.start({...recipe,...recipe.encounter});
const base=copy(game.snapshotBattle());
function fixture(type='embercottage'){
  const g=Object.assign(Object.create(rules.MeridianGame.prototype),game);
  g.s=copy(base.state);g.ids=new Map(g.s.entities.map(e=>[e.id,e]));g.spatial=new Map();g.rehash();
  g.s.rules.completed=true;g.s.parties.forEach(p=>{p.controller={kind:'human'};});
  const forum=g.spawnBuilding('meridianforum',0,0,0,0,{progress:1,cinderStock:100,settlementAt:999});
  const b=g.spawnBuilding(type,24,24,0,0,{progress:1,forumId:forum.id,size:rules.settlementReservedRadius(type)});
  g.account(0).gas=1000;
  return {g,forum,b};
}
function persistence(){
  const data=new Map();
  const service=rules.createMeridianPersistence({...rules,warn(){},getStorage:()=>({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)})});
  return {data,service};
}
test('local Echo buys ranks, effect changes retain rank and expansion preserves HP and reserved geometry without RNG',()=>{
  const {g,b}=fixture(),size=b.size,version=g.world.pathVersion,random=g.random;
  g.random=()=>assert.fail('upgrade actions cannot consume RNG');
  assert.equal(g.configureSettlementUpgrade(b.id,'startingAlloy'),true);assert.equal(g.account(0).gas,960);
  assert.equal(g.configureSettlementUpgrade(b.id,'logisticsFrame'),true);assert.equal(g.account(0).gas,960);
  b.hp=b.maxHp*.5;
  assert.equal(g.submitAction(0,{kind:'expandSettlementBuilding',id:b.id}),true);
  assert.equal(b.type,'terracecommons');assert.equal(b.upgradeLevel,2);assert.equal(b.hp/b.maxHp,.5);
  assert.equal(g.account(0).gas,880);
  assert.equal(g.expandSettlementBuilding(b.id),true);assert.equal(b.type,'hearthtower');assert.equal(b.upgradeLevel,3);
  assert.equal(g.account(0).gas,740);assert.equal(g.expandSettlementBuilding(b.id),false);
  assert.equal(g.submitAction(0,{kind:'configureSettlementUpgrade',id:b.id,upgrade:null}),true);
  assert.equal(b.upgrade,undefined);assert.equal(b.upgradeLevel,3);
  assert.equal(g.configureSettlementUpgrade(b.id,'repairLogistics'),true);assert.equal(g.account(0).gas,740);
  assert.equal(b.size,size);assert.equal(g.world.pathVersion,version);g.random=random;
});
test('ineligible, unfinished, foreign, retiring and unsupplied buildings reject upgrades without spending',()=>{
  const {g,b,forum}=fixture();
  for(const change of [()=>{g.s.rules.completed=false;},()=>{b.progress=.9;},()=>{b.team=1;},()=>{b.settlementAt=50;},()=>{forum.hp=0;},()=>{b.type='depot';}]){
    g.s.rules.completed=true;b.type='embercottage';b.progress=1;b.team=0;delete b.settlementAt;forum.hp=forum.maxHp;change();
    assert.equal(g.configureSettlementUpgrade(b.id,'startingAlloy'),false);assert.equal(g.account(0).gas,1000);
  }
  b.type='embercottage';forum.hp=forum.maxHp;g.account(0).gas=39;
  assert.equal(g.configureSettlementUpgrade(b.id,'startingAlloy'),false);assert.equal(b.upgradeLevel,undefined);
  assert.equal(g.submitAction(0,{kind:'configureSettlementUpgrade',id:b.id,upgrade:'missing'}),false);
});
test('every effect belongs to exactly one civilian family across all three model tiers',()=>{
  const residential=['startingAlloy','startingWorkers','constructionProtocols','logisticsFrame','repairLogistics',
    'supplyCrate','pioneerSquad','commanderMandate','commandDrill'],
    research=['orbital','repair','scan','drop','disruption','bulwark','surge','recall',
      'aetherAllocation','surveyDrones','fieldWorkshop','commandCapacitor'];
  assert.deepEqual(Object.keys(rules.CIVILIZATION_UPGRADES).sort(),[...residential,...research].sort());
  assert.deepEqual(Object.keys(rules.CIVILIZATION_UPGRADE_FAMILIES).sort(),Object.keys(rules.CIVILIZATION_UPGRADES).sort());
  for(const [family,types,keys] of [['residential',['embercottage','terracecommons','hearthtower'],residential],
    ['research',['fieldlab','researchhub','researchspire'],research]]){
    for(const type of types){
      assert.equal(rules.civilizationBuildingFamily(type),family);
      const {g,b}=fixture(type);b.upgradeLevel=rules.civilizationBuildingTier(type);
      for(const key of Object.keys(rules.CIVILIZATION_UPGRADES)){
        const allowed=keys.includes(key),before=copy(b),echo=g.account(0).gas;
        assert.equal(rules.civilizationUpgradeAllowed(type,key),allowed);
        assert.equal(g.submitAction(0,{kind:'configureSettlementUpgrade',id:b.id,upgrade:key}),allowed,`${type}/${key}`);
        assert.equal(g.account(0).gas,echo,'switching or rejecting never charges a purchased rank');
        if(allowed)assert.equal(b.upgrade,key);else assert.deepEqual(copy(b),before);
      }
    }
  }
  for(const type of ['meridianforum','hq'])for(const key of Object.keys(rules.CIVILIZATION_UPGRADES))
    assert.equal(rules.civilizationUpgradeAllowed(type,key),false);
});
test('research expansion retains its exclusive choices and a rejected first choice spends nothing',()=>{
  const {g,b}=fixture('fieldlab');
  assert.equal(g.configureSettlementUpgrade(b.id,'startingAlloy'),false);assert.equal(g.account(0).gas,1000);
  assert.equal(b.upgradeLevel,undefined);assert.equal(g.configureSettlementUpgrade(b.id,'orbital'),true);
  assert.equal(g.expandSettlementBuilding(b.id),true);assert.equal(b.type,'researchhub');
  assert.equal(g.configureSettlementUpgrade(b.id,'scan'),true);
  assert.equal(g.expandSettlementBuilding(b.id),true);assert.equal(b.type,'researchspire');
  assert.equal(g.configureSettlementUpgrade(b.id,'repairLogistics'),false);
  assert.equal(b.upgrade,'scan');assert.equal(g.account(0).gas,740);
});
test('stored off-family choices remain editable but cannot expand or contribute to new battles',()=>{
  const {g,b}=fixture();b.upgrade='orbital';b.upgradeLevel=1;
  delete g.s.rules.completed;g.s.parties[1].controller=copy(base.state.parties[1].controller);
  const {service}=persistence(),run={version:8,...copy(recipe),worlds:[],battle:copy(g.snapshotBattle())};
  service.saveProgress(profile,run);const loaded=service.loadExpedition();
  assert.ok(loaded,service.expeditionError);assert.equal(loaded.battle.state.entities.find(e=>e.id===b.id).upgrade,'orbital');
  assert.equal(loaded.battle.state.parties[0].meta.orbital,1,'frozen recipe bonuses are unchanged');
  assert.deepEqual(copy(rules.civilizationUpgradesForBuildings(g.s.entities)),{upgrades:{},benefits:{}});
  g.s.rules.completed=true;assert.equal(g.expandSettlementBuilding(b.id),false);assert.equal(g.account(0).gas,1000);
  assert.equal(g.configureSettlementUpgrade(b.id,null),true);assert.equal(b.upgradeLevel,1);
  assert.equal(g.configureSettlementUpgrade(b.id,'startingAlloy'),true);assert.equal(g.account(0).gas,1000);
  assert.equal(rules.civilizationUpgradesForBuildings(g.s.entities).upgrades.startingAlloy,1);
});
test('new growth starts small and reserves all intermediate and tower footprints',()=>{
  for(const radius of [10,30,60])for(const roll of [0,.5,.99])for(const variant of [0,1]){
    const type=rules.settlementBuildingType(radius,roll,variant);
    assert.equal(type,variant===0?'embercottage':'fieldlab');
    const footprints=rules.settlementReservedFootprints({x:0,z:0},type,0);
    assert.ok(footprints.length>=6);assert.ok(rules.settlementReservedRadius(type)>rules.BUILDINGS[type].size);
  }
});
test('cleared-world effects stack across worlds, unique bonuses do not duplicate, and live identity is checked',()=>{
  const {g,b,forum}=fixture();g.configureSettlementUpgrade(b.id,'supplyCrate');g.expandSettlementBuilding(b.id);
  const world={stage:1,map:'desert',seed:1409,recipe:copy(recipe),battle:copy(g.snapshotBattle())};
  const second=copy(world);second.stage=2;second.recipe.depth=1;second.battle.state.depth=1;
  const run={worlds:[world,second]};
  assert.equal(rules.expeditionCivilizationUpgrades(run).benefits.supplyCrate,4);
  b.upgradeLevel=3;
  assert.equal(rules.expeditionCivilizationUpgrades(run,g.s,1).benefits.supplyCrate,5);
  g.s.seed++;assert.equal(rules.expeditionCivilizationUpgrades(run,g.s,1).benefits.supplyCrate,4);g.s.seed--;
  b.upgrade='commanderMandate';second.battle.state.entities.find(e=>e.id===b.id).upgrade='commanderMandate';
  assert.equal(rules.expeditionCivilizationUpgrades(run,g.s,1).benefits.commanderMandate,1);
  forum.hp=0;assert.deepEqual(copy(rules.civilizationUpgradesForBuildings(g.s.entities)),{upgrades:{},benefits:{}});
});
test('an existing battle restores its original recipe even after the civilization selection changes',()=>{
  const {g,b}=fixture('fieldlab');g.configureSettlementUpgrade(b.id,'orbital');g.expandSettlementBuilding(b.id);
  const newTotals=rules.civilizationUpgradesForBuildings(g.s.entities);
  assert.equal(newTotals.upgrades.orbital,2);
  const restored=new rules.MeridianGame(copy(profile));restored.restoreBattle({...recipe,battle:copy(base)});
  assert.deepEqual(copy(restored.snapshotBattle()),base);assert.equal(restored.s.parties[0].meta.orbital,1);
  const next=new rules.MeridianGame(copy(profile));next.start({...recipe,...recipe.encounter,upgrades:newTotals.upgrades,benefits:newTotals.benefits});
  assert.equal(next.s.parties[0].meta.orbital,2);
});
test('finite Echo extraction clamps the last tick and exhausted deposits remain empty',()=>{
  const {g}=fixture(),vent=g.alive(e=>e.kind==='resource'&&e.type==='gas')[0];
  assert.equal(vent.amount,900);vent.amount=.01;
  g.spawnBuilding('refinery',vent.x,vent.z,0,0,{progress:1,gasId:vent.id});
  const before=g.account(0).gas;g.step(.05);
  assert.equal(vent.amount,0);assert.ok(Math.abs(g.account(0).gas-before-.01)<1e-9);
  const depleted=g.account(0).gas;g.step(.05);assert.equal(g.account(0).gas,depleted);assert.equal(g.get(vent.id).amount,0);
});
test('building upgrades and frozen recipes round-trip; corrupt ranks, selections and battle metadata are rejected',()=>{
  const {g,b}=fixture('fieldlab');g.configureSettlementUpgrade(b.id,'orbital');g.expandSettlementBuilding(b.id);
  // A running save with civilian buildings exercises the same strict entity validator as archived saves.
  delete g.s.rules.completed;g.s.parties[1].controller=copy(base.state.parties[1].controller);
  const run={version:8,...copy(recipe),worlds:[],battle:copy(g.snapshotBattle())};
  const {service,data}=persistence();assert.equal(service.saveProgress(profile,run),true);
  const loaded=service.loadExpedition();assert.ok(loaded,service.expeditionError);assert.deepEqual(copy(loaded),run);
  assert.equal(JSON.parse(data.get('meridian.profile.v2')).version,2);
  for(const change of [e=>{e.upgrade='missing';},e=>{e.upgradeLevel=3;},e=>{delete e.upgradeLevel;}]){
    const damaged=copy(run);change(damaged.battle.state.entities.find(e=>e.id===b.id));service.saveProgress(profile,damaged);
    assert.equal(service.loadExpedition(),null);assert.ok(service.expeditionError);
  }
  const damaged=copy(run);damaged.battle.state.parties[0].meta.orbital=3;service.saveProgress(profile,damaged);
  assert.equal(service.loadExpedition(),null);
});
