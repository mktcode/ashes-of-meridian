// Bounded salvage contracts, not autonomous matches or AI/simulation endurance runs.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {loadScripts,BATTLEFIELD_SCRIPTS,SIMULATION_SCRIPTS,RENDERER_SCRIPTS}=require('./helpers/game-scripts.cjs');
const c=loadScripts(['core','content','effects',...BATTLEFIELD_SCRIPTS,'world',...SIMULATION_SCRIPTS]);
const {MeridianGame,SALVAGE_RULES}=vm.runInContext('({MeridianGame,SALVAGE_RULES})',c);
function battle(enemies=[1,2]) {
  const events=[],g=new MeridianGame({upgrades:{}},(type,data)=>events.push({type,data}));
  g.start({mission:'echo-salvage',map:'aurelion',seed:1409,depth:3,enemies});
  g.s.parties.forEach(p=>p.controller={kind:'human'});events.length=0;
  const home=team=>g.alive(e=>e.team===team&&e.type==='hq')[0];
  const worker=team=>{const h=home(team),w=g.spawnUnit('worker',h.x+8,h.z+8,team,g.factionFor(team));assert.ok(w);return w;};
  const assign=w=>g.executeAction(w.team,{kind:'order',ids:[w.id],order:{type:'salvage',x:0,z:0}},false);
  return {g,mission:g.s.rules.mission,events,home,worker,assign};
}
test('salvage state is fresh, old hill and incompatible mission/map pairs are rejected',()=>{
  const {g,mission}=battle();assert.deepEqual(Array.from(mission.delivered),[0,0,0]);
  mission.delivered[0]=99;mission.site.radius=100;
  g.start({mission:'echo-salvage',map:'aurelion',enemies:[0,0,0],seed:1409});
  assert.deepEqual(Array.from(g.s.rules.mission.delivered),[0,0,0,0]);assert.equal(g.s.rules.mission.site.radius,20.5);
  const state=g.s;
  for(const opts of [{mission:'king-of-the-hill',map:'aurelion'},{mission:'echo-salvage',map:'desert'},{mission:'hq-elimination',map:'aurelion'}])
    assert.throws(()=>g.start(opts),/Unsupported/);
  assert.strictEqual(g.s,state);
});
test('only workers in this mission can receive salvage orders; no RNG or visibility grant',()=>{
  const {g,worker,assign,home}=battle(),w=worker(0),h=home(0),u=g.spawnUnit('rifle',h.x+12,h.z,0,0),fog=JSON.stringify(g.world.sight);
  g.random=()=>{throw Error('salvage RNG');};assert.equal(assign(w),true);assert.equal(assign(u),false);
  assert.equal(g.executeAction(1,{kind:'order',ids:[w.id],order:{type:'salvage',x:0,z:0}}),false);
  assert.equal(JSON.stringify(g.world.sight),fog);
  g.start({seed:1409});const standard=g.spawnUnit('worker',g.s.cam.x,g.s.cam.z,0,0);assert.equal(assign(standard),false);
});
test('extraction needs physical arrival, only completed own HQ delivery scores, cargo never becomes currency',()=>{
  const {g,mission,worker,assign,home}=battle(),w=worker(0),a=JSON.stringify(g.account(0)),stats=JSON.stringify(g.s.stats);
  assign(w);g.worker(w,.05);assert.equal(w.salvageCarry,undefined);
  Object.assign(w,w.salvagePoint);for(let i=0;i<100;i++)g.worker(w,.05);
  assert.ok(w.salvageCarry>9.99);g.worker(w,.05);assert.equal(w.salvageCarry,10);
  assert.equal(mission.delivered[0],0);assert.equal(JSON.stringify(g.account(0)),a);
  const h=home(0);Object.assign(w,{x:h.x+h.size+2,z:h.z});h.progress=.5;
  g.worker(w,.05);assert.equal(mission.delivered[0],0);
  h.progress=1;g.worker(w,.05);assert.equal(mission.delivered[0],10);assert.equal(w.salvageCarry,0);
  assert.equal(JSON.stringify(g.account(0)),a);assert.equal(JSON.stringify(g.s.stats),stats);
  g.worker(w,.05);assert.equal(mission.delivered[0],10,'no double delivery');
});
test('cargo survives changed orders, stays aboard without HQ and is lost with its worker',()=>{
  const {g,mission,worker,assign,home}=battle(),w=worker(0);w.salvageCarry=10;
  g.setOrder(w,{type:'move',x:80,z:80});assert.equal(w.salvageCarry,10);
  home(0).hp=0;assign(w);g.worker(w,.05);assert.equal(w.salvageCarry,10);assert.equal(mission.delivered[0],0);
  g.checkBattleResult();assert.equal(g.s.result,null,'worker permits HQ reconstruction');
  w.hp=0;g.worker(w,.05);g.checkBattleResult();assert.equal(mission.delivered[0],0);assert.equal(g.s.result.win,false);
});
test('ordinary Cinder cargo returns to its own account when switching to salvage, not to mission score',()=>{
  const {g,mission,worker,assign,home}=battle(),w=worker(0),h=home(0),alloy=g.account(0).alloy;
  w.carry=18;assign(w);Object.assign(w,{x:h.x+h.size+2,z:h.z});g.worker(w,.05);
  assert.equal(g.account(0).alloy,alloy+18);assert.equal(mission.delivered[0],0);assert.equal(w.carry,0);
});
test('HQ OR worker preserves a party, losing both withdraws stranded forces without kill credit or RNG',()=>{
  const {g,worker,home}=battle(),w=worker(1),h=home(1),u=g.spawnUnit('tank',h.x+10,h.z,1,1);
  g.random=()=>{throw Error('elimination RNG');};g.checkBattleResult();assert.equal(g.s.result,null);
  h.hp=0;g.checkBattleResult();assert.equal(g.party(1).eliminated,undefined);
  w.hp=0;g.checkBattleResult();assert.equal(g.party(1).eliminated,true);assert.equal(u.hp,0);assert.equal(g.s.stats.kills,0);
});
test('secured score persists without occupants; goal, elimination and simultaneous results resolve once',()=>{
  for(const scenario of ['player','opponent','tie','loss','all','enemies']) {
    const {g,mission,events}=battle();mission.delivered[0]=90;g.checkBattleResult();assert.equal(g.s.result,null);
    if(['player','tie','loss'].includes(scenario))mission.delivered[0]=100;
    if(['opponent','tie'].includes(scenario))mission.delivered[1]=100;
    if(['loss','all','enemies'].includes(scenario))for(const e of g.s.entities)
      if(e.type==='hq'&&(scenario==='all'||(scenario==='loss'?e.team===0:e.team!==0)))e.hp=0;
    g.step(.05);assert.equal(g.s.result.win,['player','enemies'].includes(scenario),scenario);
    g.checkBattleResult();assert.equal(events.filter(e=>e.type==='result').length,1);
  }
});
test('bounded worker-only round trips reach the core and deliver from each of four starts',()=>{
  const {g,mission,worker,assign}=battle([0,0,0]);
  const workers=[0,1,2,3].map(worker);
  g.random=()=>{throw Error('worker salvage RNG');};
  for(let team=0;team<4;team++) {
    const w=workers[team];assign(w);
    for(let i=0;i<2000&&mission.delivered[team]<10;i++){g.s.time+=.1;g.rehash();g.worker(w,.1);}
    assert.equal(mission.delivered[team],10,`team ${team}: ${JSON.stringify({x:w.x,z:w.z,order:w.order,cargo:w.salvageCarry,path:w.pathStatus})}`);
    g.setOrder(w,{type:'hold'});
  }
});
test('salvage AI keeps economic workers, sends collectors, escorts cargo and uses public terrain only',()=>{
  const {g,worker,home}=battle();g.enableAI(1);const h=home(1),workers=Array.from({length:8},()=>worker(1)),army=[];
  for(let i=0;i<4;i++)army.push(g.spawnUnit('rifle',h.x+8,h.z+i*3,1,1));
  const own=[h,...workers,...army];g.random=()=>{throw Error('strategy RNG');};
  g.aiSalvageStrategy(1,own,[],h);
  const collectors=workers.filter(w=>w.order.type==='salvage');assert.equal(collectors.length,3);
  assert.ok(workers.some(w=>w.order.type!=='salvage'));collectors[0].salvageCarry=10;
  g.aiSalvageStrategy(1,own,[],h);assert.ok(army.some(u=>u.order.type==='follow'&&u.order.id===collectors[0].id));
  assert.ok(army.filter(u=>u.order.type==='move').every(u=>Math.hypot(u.order.x,u.order.z)<25));
});
test('salvage AI remembers its own base through delayed observation and attempts paid HQ reconstruction',()=>{
  const {g,worker,home}=battle();g.enableAI(1);worker(1);const h=home(1),calls=[];
  g.aiEconomy=()=>0;g.aiProduction=()=>{};g.aiAbilities=()=>{};g.aiSalvageStrategy=()=>{};
  g.s.time=10;g.aiTick(1);g.s.time=g.aiFor(1).nextThink;g.aiTick(1);
  assert.deepEqual(JSON.parse(JSON.stringify(g.aiFor(1).salvageHome)),{x:h.x,z:h.z});
  h.hp=0;g.aiBuild=(team,type,p)=>{calls.push([team,type,p.x,p.z]);return false;};
  g.s.time=g.aiFor(1).nextThink;g.aiTick(1);assert.equal(calls.length,0,'reaction delay still applies');
  g.s.time=g.aiFor(1).nextThink;g.aiTick(1);assert.deepEqual(calls,[[1,'hq',h.x,h.z]]);
});
test('an unfinished HQ without any worker cannot keep an eliminated operation alive',()=>{
  const {g,home}=battle();home(0).progress=.5;g.checkBattleResult();assert.equal(g.s.result.win,false);
});
test('the detailed opaque relic is deterministic, finite, bounded by the protected plinth and modest in mesh cost',()=>{
  const r=loadScripts(['core',...RENDERER_SCRIPTS]);vm.runInContext('Math.random=()=>{throw Error("model RNG")}',r);
  const meshes=vm.runInContext('createAurelionRelic()',r),again=vm.runInContext('createAurelionRelic()',r);
  let triangles=0,top=0;
  for(let k=0;k<meshes.length;k++) {
    const data=meshes[k].data;assert.deepEqual(data,again[k].data);triangles+=data.length/27;
    for(let i=0;i<data.length;i+=9){assert.ok(Array.from(data.slice(i,i+9)).every(Number.isFinite));assert.ok(Math.hypot(data[i],data[i+2])<16);top=Math.max(top,data[i+1]);assert.ok(Math.abs(Math.hypot(...data.slice(i+3,i+6))-1)<1e-5);}
  }
  assert.ok(top>20&&top<27);assert.ok(triangles>3000&&triangles<12000,triangles);
  const gameplay=vm.runInContext('createAurelionBattlefieldMeshes()',r);
  assert.ok(gameplay.some(m=>m.name==='echoRelicCrystal'));
  assert.ok(!gameplay.some(m=>m.name==='aurelionHologram'||m.name==='aurelionHalo'));
});
