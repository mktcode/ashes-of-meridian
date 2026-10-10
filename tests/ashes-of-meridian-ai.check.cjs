// Real controllers and accounts; existing unit-rule fixtures intentionally disable the AI.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const { BATTLEFIELD_SCRIPTS, loadScripts,SIMULATION_SCRIPTS }=require('./helpers/game-scripts.cjs');
const { establishHeadquarters }=require('./helpers/developed-bases.cjs');
const context=loadScripts(['core','content',...BATTLEFIELD_SCRIPTS, 'world','effects','effects-view',...SIMULATION_SCRIPTS]);
const {MeridianGame,UNITS,BUILDINGS,ABILITIES,renderBattlefieldEffects}=vm.runInContext('({MeridianGame,UNITS,BUILDINGS,ABILITIES,renderBattlefieldEffects})',context);
vm.runInContext('Math.random=()=>{throw Error("Unseeded simulation RNG")}',context);
const json=x=>JSON.parse(JSON.stringify(x));
function freshBattle(faction=0,enemy=2,seed=1409,map='desert') {
  const events=[],g=new MeridianGame({upgrades:{}},(type,data)=>events.push({type,data}));
  g.start({faction,enemies:[enemy],seed,map});return {g,events};
}
// Local controller/economy rules need completed HQs, not a privileged runtime start.
function battle(...args) {
  const runtime=freshBattle(...args);
  establishHeadquarters(runtime.g);
  return runtime;
}
function advance(g,seconds) {for(let i=0;i<seconds*20&&!g.s.result;i++){g.step(.05);g.effects.tick(.05);}}
function own(g,team,type){return Array.from(g.alive(e=>e.team===team&&(!type||e.type===type)));}
function close(a,b){assert.ok(Math.abs(a-b)<1e-7,`${a} ~= ${b}`);}

test('scouting and scans visit unexplored candidate corners without reading the hidden enemy assignment',()=>{
  const {g}=battle();
  for(const team of [0,1]) {
    const home=own(g,team,'hq')[0], other=own(g,1-team,'hq')[0];
    g.world.sight[team].explored.fill(0);
    const first=json(g.aiScoutGoal(team,home));
    assert.ok(Math.hypot(first.x-home.x,first.z-home.z)>25);
    const original={x:other.x,z:other.z};other.x=0;other.z=0;
    assert.deepEqual(json(g.aiScoutGoal(team,home)),first,'hidden opponent movement cannot redirect search');
    Object.assign(other,original);
    g.world.sight[team].explored[g.world.idx(first.x,first.z)]=1;
    const next=json(g.aiScoutGoal(team,home));assert.notDeepEqual(next,first);
    assert.ok(g.world.startSites.some(p=>p.x===next.x&&p.z===next.z));
  }
});

test('depth is bounded and snapshots the battle without changing seeded setup or RNG',()=>{
  const {g}=freshBattle(), original=json(g.s.entities), terrain=Array.from(g.world.staticGrid), next=g.random();
  assert.equal(g.s.depth,0);
  for(const [depth,expected] of [[-2,0],[3.9,3],[4,4],[16,16],[1000000,999999],[NaN,0]]) {
    const options={seed:1409,depth};g.start(options);options.depth=100;
    assert.equal(g.s.depth,expected);assert.deepEqual(json(g.s.entities),original);
    assert.deepEqual(Array.from(g.world.staticGrid),terrain);assert.equal(g.random(),next);
  }
});

test('doctrine resolution has bounded monotonic execution stages without random draws',()=>{
  const resolve=vm.runInContext('aiRulesFor',context);
  for(const faction of [0,1,2]) {
    let previous;
    for(const depth of [0,3,4,7,8,11,12,15,16,25,999999]) {
      const rule=resolve(faction,depth);
      assert.equal(rule.stage,Math.min(4,Math.floor(depth/4)));
      if(previous) {
        assert.ok(rule.workers>=previous.workers);assert.ok(rule.attackWait<=previous.attackWait);
        assert.ok(rule.scoutInterval<=previous.scoutInterval);assert.ok(rule.forceRatio<=previous.forceRatio);
        assert.ok(rule.build.length>=previous.build.length);
      }
      previous=rule;
    }
    assert.deepEqual(json(resolve(faction,16)),json(resolve(faction,999999)));
    const rule=resolve(faction,8);rule.build.length=0;
    assert.ok(resolve(faction,8).build.length>0,'no mutable rule state retained');
  }
});

test('baseline deployment starts are symmetric for all faction pairings, with separate accounts and one worker',()=>{
  for(let faction=0;faction<3;faction++)for(let enemy=0;enemy<3;enemy++){
    const {g}=freshBattle(faction,enemy);
    assert.deepEqual(own(g,0).map(e=>e.type),['worker']);assert.deepEqual(own(g,1).map(e=>e.type),['worker']);
    assert.deepEqual(json(g.account(0)),json(g.account(1)));assert.notStrictEqual(g.account(0),g.account(1));
    assert.deepEqual([g.cap(0),g.cap(1),g.supply(0),g.supply(1)],[0,0,1,1]);
    for(const team of [0,1]) {
      assert.equal(g.party(team).deploymentPending,true);
      assert.equal(g.account(team).alloy,250+BUILDINGS.hq.cost,'normal starting funds plus paid HQ reserves');
      const worker=own(g,team,'worker')[0];
      assert.ok(g.unitFits(worker,worker.x,worker.z),'landing worker occupies valid free terrain');
    }
  }
});

test('both teams pay faction prices, reserve supply, use real producer queues and cannot cancel foreign orders',()=>{
  for(let faction=0;faction<3;faction++)for(const team of [0,1]) {
    const {g}=battle(faction,faction);g.s.parties.forEach(p => { p.controller = { kind: 'human' }; });
    const h=own(g,team,'hq')[0],other=json(g.account(1-team));
    const b=g.spawnBuilding('barracks',h.x+(team?-12:12),h.z,team,faction);g.world.rebuild(g.s.entities);
    Object.assign(g.account(team),{alloy:1000,gas:1000});
    const cost=g.cost('rifle','unit',team);
    assert.equal(cost.cost,Math.ceil(75*[1,.85,1.12][faction]));
    assert.equal(g.train('rifle',team),true);assert.equal(g.supply(team),2);
    close(g.account(team).alloy,1000-cost.cost);
    g.cancelQueue(b.id,0,1-team);assert.equal(b.queue.length,1);
    advance(g,14);assert.equal(own(g,team,'rifle').length,1);
    assert.equal(b.queue.length,0);close(g.account(1-team).energy,other.energy+14*.8);
    assert.deepEqual({...json(g.account(1-team)),energy:other.energy},other);
    assert.equal(g.train('rifle',team),true);g.cancelQueue(b.id,0,team);
    close(g.account(team).alloy,1000-cost.cost);assert.equal(g.supply(team),2);
  }
});

test('enemy worker income and refinery income belong to its account, without passive HQ money',()=>{
  const {g}=battle();g.s.parties.forEach(p => { p.controller = { kind: 'human' }; });const before=json(g.account(0));
  assert.equal(g.train('worker',1),true);advance(g,65);
  assert.ok(g.account(1).alloy>200);assert.equal(g.account(0).alloy,before.alloy);
  const h=own(g,1,'hq')[0];g.spawnBuilding('refinery',h.x+12,h.z+12,1,2);
  const gas=g.account(1).gas;advance(g,2);close(g.account(1).gas,gas+3.4);assert.equal(g.account(0).gas,0);
});

test('both observers have fair combat acquisition and copied last-seen memory, not live enemy references',()=>{
  for(const team of [0,1]) {
    const {g}=battle();g.enableAI(team);g.party(1-team).controller={kind:'human'};
    const h=own(g,team,'hq')[0],e=g.spawnUnit('rifle',h.x+10,h.z,1-team,0);
    g.world.reveal(g.s.entities);g.rehash();g.aiObserve(team);
    const remembered=json(g.aiFor(team).contacts[e.id]);assert.ok(remembered);assert.equal('queue' in remembered,false);
    g.world.sight[team].visible.fill(0);e.x=0;e.z=0;e.hp-=30;
    g.aiObserve(team);assert.deepEqual(json(g.aiFor(team).contacts[e.id]),remembered);
    const u=g.spawnUnit('rifle',2,0,team,0);g.rehash();
    assert.equal(g.acquire(u),null);const order=json(u.order);
    g.command([u.id],{type:'attack',id:e.id,x:e.x,z:e.z},team);assert.deepEqual(json(u.order),order);
    g.world.sight[team].visible[g.world.idx(e.x,e.z)]=255;
    assert.equal(g.acquire(u).id,e.id);g.aiObserve(team);
    assert.deepEqual([g.aiFor(team).contacts[e.id].x,g.aiFor(team).contacts[e.id].hp],[0,e.hp]);
    e.x=40;e.z=40;g.aiObserve(team);assert.equal(g.aiFor(team).contacts[e.id],undefined,'vacated visible location invalidates memory');
  }
});

test('enemy scan does not reveal its target to the player or render a secret marker',()=>{
  const {g}=battle();g.s.parties.forEach(p => { p.controller = { kind: 'human' }; });const before=Array.from(g.world.visible);
  assert.equal(g.ability('scan',{x:0,z:0},1),true);
  assert.ok(g.world.sight[1].visible[g.world.idx(0,0)]);assert.deepEqual(Array.from(g.world.visible),before);
  const calls=[],R={add:(...a)=>calls.push(a),beam:(...a)=>calls.push(a)};
  g.effects.fx=[];
  g.s.fields.push({type:'repair',team:1,x:0,z:0,r:12,until:10});
  g.s.strikes.push({type:'orbital',team:1,x:0,z:0,radius:10,at:5,damage:355});
  g.effects.drop({x:0,z:0},0xffffff,1);
  renderBattlefieldEffects(R,g.effects,g.world,g.s,[],0);assert.equal(calls.length,0);
  g.world.visible[g.world.idx(0,0)]=255;
  renderBattlefieldEffects(R,g.effects,g.world,g.s,[],0);assert.ok(calls.length>0);
});

test('all abilities charge only the acting team, obey cooldown/sight/supply, and use the actor faction',()=>{
  for(let faction=0;faction<3;faction++)for(const team of [0,1])for(const kind of Object.keys(ABILITIES)) {
    const {g}=battle(faction,faction);g.s.parties.forEach(p => { p.controller = { kind: 'human' }; });const p=own(g,team,'hq')[0],other=json(g.account(1-team));
    if(kind==='orbital')g.spawnBuilding('factory',p.x+12,p.z,team,faction);
    const d=ABILITIES[kind];g.account(team).energy=d.energy;
    assert.equal(g.ability(kind,p,team),true);assert.equal(g.account(team).energy,0);
    assert.equal(g.account(team).abilities[kind],d.cd);assert.equal(g.ability(kind,p,team),false);
    assert.deepEqual(json(g.account(1-team)),other);
    if(kind==='orbital') {const strike=g.s.strikes[0];assert.equal(strike.team,team);assert.equal(strike.damage,[355,260,440][faction]);}
    if(kind==='repair')assert.equal(g.s.fields[0].team,team);
    if(kind==='drop')assert.equal(own(g,team,'rifle').length,4);
  }
  const {g}=battle();g.s.parties.forEach(p => { p.controller = { kind: 'human' }; });g.account(1).energy=100;
  g.spawnBuilding('factory',own(g,1,'hq')[0].x+12,own(g,1,'hq')[0].z,1,2);
  assert.equal(g.ability('orbital',{x:0,z:0},1),false);assert.equal(g.account(1).energy,100);
  const h=own(g,1,'hq')[0];for(let i=0;i<10;i++)g.spawnUnit('rifle',h.x,h.z+8,1,2);
  assert.equal(g.ability('drop',h,1),false);assert.equal(g.account(1).energy,100);
});

test('repair and faction healing/bloom benefit or damage the correct side',()=>{
  for(const team of [0,1]) {
    const {g}=battle(1,1);g.s.parties.forEach(p => { p.controller = { kind: 'human' }; });const h=own(g,team,'hq')[0];
    const friend=g.spawnUnit('tank',h.x+10,h.z,team,1),enemy=g.spawnUnit('tank',h.x+14,h.z,1-team,1);
    friend.hp-=300;enemy.hp-=300;g.rehash();const hp=enemy.hp;
    g.account(team).energy=100;g.spawnBuilding('factory',h.x,h.z-12,team,1);
    assert.equal(g.ability('repair',h,team),true);assert.ok(friend.hp>friend.maxHp-300);assert.equal(enemy.hp,hp);
    g.account(team).energy=100;g.ability('orbital',h,team);advance(g,2.3);
    assert.ok(g.s.fields.some(f=>f.type==='bloom'&&f.team===team));
  }
});

test('controller heuristics actually choose all four abilities under appropriate observations',()=>{
  for (const kind of Object.keys(ABILITIES)) {
    const {g}=battle();g.s.time=70;const h=own(g,1,'hq')[0];
    const soldier=g.spawnUnit('tank',h.x+10,h.z,1,2);
    if(kind==='repair')soldier.hp-=300;
    if(kind==='orbital') {
      g.spawnBuilding('factory',h.x,h.z-12,1,2);
      for(let i=0;i<3;i++)g.spawnUnit('rifle',h.x+12,h.z+i*2,0,0);
    }
    if(kind==='scan')g.spawnUnit('rifle',h.x-7,h.z,1,2);
    if(kind==='drop'){g.aiFor(1).mode='attack';g.aiFor(1).squad=[soldier.id];}
    g.account(1).energy=ABILITIES[kind].energy;
    g.world.reveal(g.s.entities);g.rehash();
    const visible=g.aiObserve(1);g.aiAbilities(1,own(g,1),visible,h);
    assert.equal(g.account(1).abilities[kind],70+ABILITIES[kind].cd,kind);
  }
});

test('strategy prioritizes remembered economy without following hidden changes and reacts to visible defense threats',()=>{
  const {g}=battle(),h=own(g,1,'hq')[0];g.s.time=100;
  for(let i=0;i<12;i++)g.spawnUnit('rifle',h.x-10+(i%4)*2,h.z+8+Math.floor(i/4)*2,1,2);
  const refinery=g.spawnBuilding('refinery',0,0,0,0);
  g.world.sight[1].visible.fill(255);g.aiObserve(1);g.world.sight[1].visible.fill(0);
  refinery.x=-35;refinery.z=40;refinery.hp=1; // Cannot update last-seen information.
  g.random=()=>{throw Error('A strategy observation/order must not sample RNG');};
  g.aiStrategy(1,own(g,1),[],h);
  assert.equal(g.aiFor(1).mode,'attack');assert.deepEqual(json(g.aiFor(1).goal),{x:0,z:0});
  // No spawn is required for the observer's copied visible threat in this controller-only test.
  const threats=[999,1000].map(id=>({id,kind:'unit',type:'tank',team:0,x:h.x-12,z:h.z,hp:520,maxHp:520,progress:1,size:1.3,seenAt:100}));
  g.aiStrategy(1,own(g,1),threats,h);
  assert.equal(g.aiFor(1).mode,'defend');assert.equal(g.aiFor(1).squad.length,0);
});

test('Choir hull and Court shields trigger sustained but bounded recovery, not a one-tick retreat',()=>{
  for(const faction of [1,2]) {
    const {g}=battle(0,faction),h=own(g,1,'hq')[0],ai=g.aiFor(1);
    const troops=Array.from({length:8},()=>g.spawnUnit('rifle',0,0,1,faction));
    for(const e of troops) { if(faction===1)e.hp=e.maxHp*.55;else e.shield=0; }
    g.s.time=100;Object.assign(ai,{mode:'attack',squad:troops.map(e=>e.id),launched:8,attackStartedAt:70,goal:{x:-20,z:0}});
    const threat={id:999,kind:'unit',type:'rifle',team:0,x:4,z:0,hp:150,maxHp:150,progress:1,size:.65,seenAt:100};
    g.aiStrategy(1,own(g,1),[threat],h);
    assert.equal(ai.mode,'recover');assert.equal(ai.squad.length,8);
    assert.ok(troops.every(e=>e.order.type==='move'));
    g.s.time=101;g.aiStrategy(1,own(g,1),[],h);
    assert.equal(ai.mode,'recover');assert.ok(troops.every(e=>e.order.type==='move'));
    g.s.time=ai.recoverUntil;g.aiStrategy(1,own(g,1),[],h);
    assert.notEqual(ai.mode,'recover','failed regeneration cannot trap the controller');
    Object.assign(ai,{mode:'recover',squad:troops.map(e=>e.id),restStartedAt:100,recoverUntil:140});
    for(const e of troops){e.hp=e.maxHp;e.shield=e.maxShield;e.x=h.x+9;e.z=h.z;}
    g.s.time=110;g.aiStrategy(1,own(g,1),[],h);assert.notEqual(ai.mode,'recover');
  }
});

test('reassessing an arrived target preserves sortie age and the original loss threshold',()=>{
  for(const exhausted of [true,false]) {
    const {g}=battle(),h=own(g,1,'hq')[0],ai=g.aiFor(1);
    const troops=Array.from({length:8},()=>g.spawnUnit('rifle',0,0,1,2));
    if(exhausted)troops.forEach(e=>e.shield=0);
    const target={id:999,kind:'unit',type:'rifle',team:0,x:-12,z:-8,hp:150,maxHp:150,progress:1,size:.65,seenAt:100};
    Object.assign(ai,{mode:'attack',squad:troops.map(e=>e.id),launched:10,attackStartedAt:99,
      goal:{x:target.x,z:target.z},contacts:{999:target}});
    for(let time=100;time<=105;time++) {
      g.s.time=time;g.aiStrategy(1,own(g,1),[target],h);
      assert.equal(ai.mode,'attack');assert.equal(ai.attackStartedAt,99);assert.equal(ai.launched,10);
    }
    g.s.time=exhausted?106:250;g.aiStrategy(1,own(g,1),[target],h);
    assert.equal(ai.mode,'recover');assert.equal(ai.restStartedAt,g.s.time);
    assert.equal(ai.attackStartedAt,99);
  }
});

test('a failed assault temporarily lowers that observed area priority instead of repeating it blindly',()=>{
  const {g}=battle(),h=own(g,1,'hq')[0],ai=g.aiFor(1);
  for(let i=0;i<12;i++)g.spawnUnit('rifle',h.x-10,h.z+10,1,2);
  ai.contacts={
    901:{id:901,team:0,kind:'building',type:'refinery',x:0,z:0,hp:850,maxHp:850,progress:1,size:2.3,seenAt:500},
    902:{id:902,team:0,kind:'building',type:'factory',x:0,z:30,hp:1450,maxHp:1450,progress:1,size:3.8,seenAt:500}
  };
  g.s.time=500;ai.failedGoal={x:0,z:0,until:590};g.aiStrategy(1,own(g,1),[],h);
  assert.deepEqual(json(ai.goal),{x:0,z:30});
  g.aiSetMode(1,'assemble');g.s.time=600;g.aiStrategy(1,own(g,1),[],h);
  assert.deepEqual(json(ai.goal),{x:0,z:0});
});

test('occupied known vent does not starve a paid hangar and each plot search remains throttled',()=>{
  const {g}=battle(0,0),h=own(g,1,'hq')[0];
  const gas=g.alive(e=>e.type==='gas').sort((a,b)=>Math.hypot(a.x-h.x,a.z-h.z)-Math.hypot(b.x-h.x,b.z-h.z))[0];
  g.spawnBuilding('refinery',gas.x-4,gas.z,1,0,{gasId:gas.id});
  for(const [i,type] of ['barracks','turret','factory'].entries())g.spawnBuilding(type,i*15,0,1,0);
  g.spawnUnit('worker',h.x-7,h.z+3,1,0);g.world.rebuild(g.s.entities);g.world.reveal(g.s.entities);g.aiObserve(1);
  for(const [id,e] of Object.entries(g.aiFor(1).contacts))if(e.type==='gas'&&e.id!==gas.id)delete g.aiFor(1).contacts[id];
  Object.assign(g.account(1),{alloy:3000,gas:3000});
  const before=g.account(1).gas;g.aiEconomy(1,own(g,1),h);
  assert.equal(own(g,1,'hangar').length,1);close(g.account(1).gas,before-BUILDINGS.hangar.gas);
  assert.equal(own(g,1,'refinery').length,1);
  const ai=g.aiFor(1),search=ai.search;
  for(let i=0;i<10;i++)assert.equal(g.aiBuild(1,'refinery',h),false);
  assert.equal(ai.search,search,'cooldown skips repeated expensive searches');
  const worker=own(g,1,'worker')[0];g.setOrder(worker,{type:'idle'});
  g.s.time=1;assert.equal(g.aiBuild(1,'refinery',h),false);assert.equal(ai.search,search);
  g.s.time=3;assert.equal(g.aiBuild(1,'refinery',h),false);assert.notEqual(ai.search,search);
});

test('each faction chooses its own build, production and remembered target priorities',()=>{
  for(const faction of [0,1,2]) {
    const {g}=battle(0,faction),h=own(g,1,'hq')[0];
    g.spawnBuilding('barracks',h.x-12,h.z,1,faction);
    g.spawnBuilding('refinery',h.x,h.z+12,1,faction);
    Object.assign(g.account(1),{alloy:2000,gas:2000});
    const builds=[];g.aiBuild=(team,type)=>{builds.push(type);return true;};
    g.canBuild=()=>'';g.train=()=>true;
    g.aiEconomy(1,own(g,1),h);
    assert.equal(builds[0],['turret','barracks','factory'][faction]);
    for(const type of ['factory','hangar'])g.spawnBuilding(type,h.x-20,h.z+20,1,faction);
    for(const type of ['rifle','rifle','rifle','rifle','rifle','rifle','tank','tank','air','air','hero','medic'])
      assert.ok(g.spawnUnit(type,h.x-10,h.z+10,1,faction));
    const trained=[];g.train=(type)=>{trained.push(type);return true;};
    g.aiProduction(1,own(g,1),[],0);
    assert.deepEqual(trained,[["tank"],["medic"],["air"]][faction]);
    trained.length=0;g.aiProduction(1,own(g,1),[{type:'air',team:0}],0);
    assert.deepEqual(trained,['rifle'],'visible air overrides doctrine');
    const ai=g.aiFor(1);g.s.time=100;
    for(const [id,type,kind] of [[901,'worker','unit'],[902,'factory','building'],[903,'artillery','unit']])
      ai.contacts[id]={id,type,kind,team:0,x:0,z:0,hp:100,maxHp:100,progress:1,size:1,seenAt:100};
    // Separate equidistant goals so the chosen priority is observable.
    ai.contacts[901].x=1;ai.contacts[902].x=2;ai.contacts[903].x=3;
    g.random=()=>{throw Error('Doctrine decisions must not draw RNG');};
    g.aiStrategy(1,own(g,1),[],h);
    assert.equal(ai.mode,'attack');assert.equal(ai.goal.x,[2,1,3][faction]);
  }
});

test('autonomous orders retain formation behavior without leaking local command markers',()=>{
  const {g,events}=battle();g.s.parties.forEach(p => { p.controller = { kind: 'human' }; });const h=own(g,0,'hq')[0],goal={x:h.x+35,z:h.z};
  const units=Array.from({length:16},(_,i)=>g.spawnUnit('tank',h.x+(i%4),h.z+Math.floor(i/4),0,0));
  g.aiOrder(0,units,goal);assert.ok(units.every(u=>u.order.type==='attackMove'));
  for(const u of units){u.x=u.order.x;u.z=u.order.z;g.finishOrder(u);}
  g.aiOrder(0,units,goal);assert.ok(units.every(u=>u.order.type==='attackMove'),'controller may renew a completed holding order');
  assert.equal(events.filter(e=>e.type==='order').length,0,'controller decisions are not player input markers');
  g.command(units.map(u=>u.id),{type:'attackMove',x:goal.x+35,z:goal.z},0);
  assert.equal(events.filter(e=>e.type==='order').length,1,'ordinary local input still emits its marker');
});

test('real AI replaces a lost builder and completes its paid foundation without a free replacement',()=>{
  const {g}=battle();
  let foundation;
  for(let i=0;i<2400&&!foundation;i++){advance(g,.05);foundation=own(g,1).find(e=>e.kind==='building'&&e.progress<1);}
  assert.ok(foundation);const builder=own(g,1,'worker').find(w=>w.order.id===foundation.id);
  assert.ok(builder);g.kill(builder,null);advance(g,70);
  assert.equal(foundation.progress,1);assert.ok(own(g,1,'worker').length>=4);
});

test('invalid build candidates and a blocked producer neither mint units nor block future controller ticks',()=>{
  const {g}=battle();g.s.parties.forEach(p => { p.controller = { kind: 'human' }; });g.enableAI(1);
  const h=own(g,1,'hq')[0];g.spawnUnit('worker',h.x-7,h.z,1,2);g.world.reveal(g.s.entities);
  const before=json(g.account(1));g.world.staticGrid.fill(1);
  assert.equal(g.aiBuild(1,'barracks',h),false);assert.deepEqual(json(g.account(1)),before);
  g.world.staticGrid.fill(0);g.world.rebuild(g.s.entities);g.s.time=4;
  assert.equal(g.aiBuild(1,'barracks',h),true);
  g.s.parties.forEach(p => { p.controller = { kind: 'human' }; });g.train('worker',1);const count=own(g,1,'worker').length,paid=g.account(1).alloy;
  const original=g.produceUnit;g.produceUnit=()=>null;advance(g,12);
  assert.equal(own(g,1,'worker').length,count);assert.equal(h.queue[0].progress,1);
  g.produceUnit=original;advance(g,5);assert.equal(own(g,1,'worker').length,count+1);
  assert.ok(g.account(1).alloy>=paid,'only possible extra income is real harvesting');
});

function audit(g) {
  const spawn=g.spawn,ability=g.ability;let drop=false;const counts={produced:0,built:0,attacks:0};
  g.ability=function(...args){drop=args[0]==='drop';try{return ability.apply(this,args);}finally{drop=false;}};
  g.spawn=function(kind,type,x,z,team,faction,extra={}){
    if(kind==='unit'&&!drop){assert.ok(extra.exit,'no army spawn bypass');
      const b=this.get(extra.exit.building);assert.equal(b.type,UNITS[type].from);assert.equal(b.queue[0].type,type);assert.equal(b.queue[0].progress,1);counts.produced++;}
    if(kind==='building'){
      assert.ok(extra.paid);assert.ok(extra.progress<1);
      for(const u of this.alive(e=>e.kind==='unit'))
        assert.ok(Math.hypot(u.x-x,u.z-z)>=BUILDINGS[type].size+u.size*1.4+1-1e-8,'AI never builds over a body, including unseen enemies');
      if(type==='refinery'){
        const gas=this.closest({x,z},e=>e.kind==='resource'&&e.type==='gas');
        assert.deepEqual([x,z],[gas.x,gas.z],'AI refinery is centered on its observed vent');
      }
      counts.built++;
    }
    return spawn.call(this,kind,type,x,z,team,faction,extra);
  };
  return counts;
}
for(let faction=0;faction<3;faction++)for(let enemy=0;enemy<3;enemy++) {
  const boundedStalemate=faction===2&&enemy===0;
  test(`autonomous ${faction} vs ${enemy}: paid economy, production, strategic pressure and ${boundedStalemate?'bounded active stalemate':'completed battle'}`,()=>{
    const {g}=freshBattle(faction,enemy,1409+faction*31+enemy*11,faction===2?'mothership':'desert');
    g.enableAI(0);const counts=audit(g);let attacks=0;
    for(let i=0;i<24000&&!g.s.result;i++) {
      g.step(.05);g.effects.tick(.05);
      if(i%100===0){
        attacks+=g.s.parties.map(p=>g.aiFor(p.id)).filter(Boolean).filter(a=>a.mode==='attack').length;
        for(const t of [0,1]){assert.ok(Number.isFinite(g.account(t).alloy)&&g.account(t).alloy>=0);assert.ok(g.account(t).gas>=0);}
        const units=g.alive(e=>e.kind==='unit');
        for(let a=0;a<units.length;a++)for(let b=a+1;b<units.length;b++){
          const x=units[a],y=units[b];if((x.type==='air')!==(y.type==='air'))continue;
          assert.ok(Math.hypot(x.x-y.x,x.z-y.z)+1e-8>=(x.size+y.size)*1.4,'body spacing');
        }
      }
    }
    assert.ok(counts.produced>=10);assert.ok(counts.built>=6);assert.ok(attacks>0);
    if(boundedStalemate&&!g.s.result) {
      assert.ok(g.s.time>=1199.9);
      for(const team of [0,1]) {
        assert.ok(g.alive(e=>e.team===team&&e.type==='hq').length);
        assert.ok(g.alive(e=>e.team===team&&e.kind==='unit'&&e.type!=='worker').length);
      }
    } else assert.ok(g.s.result,`no result at ${g.s.time}; ${JSON.stringify(g.s.parties.map(p=>p.controller))}`);
  });
}

for(let faction=0;faction<3;faction++) test(`Alien Planet ${faction}: real economies cross the larger living map and finish a battle`,()=>{
  const {g}=freshBattle(faction,(faction+1)%3,43015+faction*97,'alien-planet');
  g.enableAI(0);const counts=audit(g);let attacks=0;
  // Porous woodland changes encounter timing; Choir/Court seed 43112 ends normally at ~24:31.
  // Keep the result requirement and original seeds, with a 30-minute bound for Alien only.
  for(let i=0;i<36000&&!g.s.result;i++) {
    g.step(.05);g.effects.tick(.05);
    if(i%100===0){
      attacks+=g.s.parties.map(p=>g.aiFor(p.id)).filter(Boolean).filter(a=>a.mode==='attack').length;
      for(const team of [0,1])assert.ok(g.account(team).alloy>=0&&g.account(team).gas>=0);
    }
  }
  assert.ok(counts.produced>=10&&counts.built>=6);assert.ok(attacks>0);
  assert.ok(g.s.result,`no result at ${g.s.time}`);
  assert.equal(g.world.extent,135);
});

for(const enemy of [0,1,2]) test(`depth 16 doctrine ${enemy}: paid autonomous battle finishes`,()=>{
  const {g}=freshBattle((enemy+1)%3,enemy,7109+enemy*31);
  g.s.depth=16;g.enableAI(0);const counts=audit(g);let attacks=0;
  for(let i=0;i<24000&&!g.s.result;i++) {
    g.step(.05);g.effects.tick(.05);
    if(i%100===0) {
      attacks+=g.s.parties.map(p=>g.aiFor(p.id)).filter(Boolean).filter(a=>a.mode==='attack').length;
      for(const team of [0,1])assert.ok(g.account(team).alloy>=0&&g.account(team).gas>=0);
    }
  }
  assert.ok(counts.produced>=10&&counts.built>=6);assert.ok(attacks>0);
  assert.ok(g.s.result,`no result for doctrine ${enemy} at ${g.s.time}`);
});

for(const enemy of [0,1,2]) test(`stage 21 benefits vs doctrine ${enemy}: declared starts and paid autonomous play finish`,()=>{
  const {g}=freshBattle((enemy+1)%3,enemy,1409),choose=vm.runInContext('chooseEnemyBenefit',context),enemyBenefits={};
  for(let depth=1;depth<=20;depth++) {
    const key=choose(depth===20?enemy:depth%3,enemyBenefits,1409+depth*7919,depth);
    enemyBenefits[key]=(enemyBenefits[key]||0)+1;
  }
  const benefits={supplyCrate:8,aetherAllocation:4,pioneerSquad:3,commanderMandate:1,surveyDrones:1,fieldWorkshop:1,commandCapacitor:2};
  g.start({seed:1409,faction:(enemy+1)%3,enemies:[enemy],depth:20,benefits,enemyBenefits:[enemyBenefits]});g.enableAI(0);
  assert.equal(Object.values(g.s.parties[1].benefits).reduce((a,b)=>a+b,0),20);
  const counts=audit(g);
  for(let i=0;i<24000&&!g.s.result;i++) {
    g.step(.05);g.effects.tick(.05);
    if(i%100===0)for(const team of [0,1])assert.ok(g.account(team).alloy>=0&&g.account(team).gas>=0);
  }
  assert.ok(counts.produced>=10&&counts.built>=6);
  assert.ok(g.s.result,`no result for stage 21 / doctrine ${enemy} at ${g.s.time}`);
});

test('seed 444213: the real opponent destroys an undefended HQ instead of stopping outside weapon range',()=>{
  const {g}=battle(0,2,444213,'desert');audit(g);advance(g,900);
  assert.equal(g.s.result?.win,false);assert.equal(own(g,0,'hq').length,0);
});

test('same seed and inputs reproduce an uninterrupted AI economy and the simulation RNG',()=>{
  const a=freshBattle().g,b=freshBattle().g;advance(a,120);advance(b,120);
  assert.deepEqual(json(a.s),json(b.s));assert.equal(a.random(),b.random());
});
