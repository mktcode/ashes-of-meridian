// Real controllers and accounts; existing unit-rule fixtures intentionally disable the AI.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const { BATTLEFIELD_SCRIPTS, loadScripts,SIMULATION_SCRIPTS }=require('./helpers/game-scripts.cjs');
const context=loadScripts(['core','content',...BATTLEFIELD_SCRIPTS, 'world','effects','effects-view',...SIMULATION_SCRIPTS]);
const {MeridianGame,UNITS,BUILDINGS,ABILITIES,renderBattlefieldEffects}=vm.runInContext('({MeridianGame,UNITS,BUILDINGS,ABILITIES,renderBattlefieldEffects})',context);
vm.runInContext('Math.random=()=>{throw Error("Unseeded simulation RNG")}',context);
const json=x=>JSON.parse(JSON.stringify(x));
function battle(faction=0,enemy=2,seed=1409,map='desert') {
  const events=[],g=new MeridianGame({upgrades:{}},(type,data)=>events.push({type,data}));
  g.start({faction,enemy,seed,map});return {g,events};
}
function advance(g,seconds) {for(let i=0;i<seconds*20&&!g.s.result;i++){g.step(.05);g.effects.tick(.05);}}
function own(g,team,type){return Array.from(g.alive(e=>e.team===team&&(!type||e.type===type)));}
function close(a,b){assert.ok(Math.abs(a-b)<1e-7,`${a} ~= ${b}`);}

test('baseline starts are symmetric for all faction pairings, with separate accounts and no army',()=>{
  for(let faction=0;faction<3;faction++)for(let enemy=0;enemy<3;enemy++){
    const {g}=battle(faction,enemy);
    assert.deepEqual(own(g,0).map(e=>e.type),['hq']);assert.deepEqual(own(g,1).map(e=>e.type),['hq']);
    assert.deepEqual(json(g.account(0)),json(g.account(1)));assert.notStrictEqual(g.account(0),g.account(1));
    assert.deepEqual([g.cap(0),g.cap(1),g.supply(0),g.supply(1)],[24,24,0,0]);
  }
});

test('both teams pay faction prices, reserve supply, use real producer queues and cannot cancel foreign orders',()=>{
  for(let faction=0;faction<3;faction++)for(const team of [0,1]) {
    const {g}=battle(faction,faction);g.s.ai={};
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
  const {g}=battle();g.s.ai={};const before=json(g.account(0));
  assert.equal(g.train('worker',1),true);advance(g,65);
  assert.ok(g.account(1).alloy>200);assert.equal(g.account(0).alloy,before.alloy);
  const h=own(g,1,'hq')[0];g.spawnBuilding('refinery',h.x+12,h.z+12,1,2);
  const gas=g.account(1).gas;advance(g,2);close(g.account(1).gas,gas+3.4);assert.equal(g.account(0).gas,0);
});

test('both observers have fair combat acquisition and copied last-seen memory, not live enemy references',()=>{
  for(const team of [0,1]) {
    const {g}=battle();g.enableAI(team);g.s.ai[1-team]=undefined;
    const h=own(g,team,'hq')[0],e=g.spawnUnit('rifle',h.x+10,h.z,1-team,0);
    g.world.reveal(g.s.entities);g.rehash();g.aiObserve(team);
    const remembered=json(g.s.ai[team].contacts[e.id]);assert.ok(remembered);assert.equal('queue' in remembered,false);
    g.world.sight[team].visible.fill(0);e.x=0;e.z=0;e.hp-=30;
    g.aiObserve(team);assert.deepEqual(json(g.s.ai[team].contacts[e.id]),remembered);
    const u=g.spawnUnit('rifle',2,0,team,0);g.rehash();
    assert.equal(g.acquire(u),null);const order=json(u.order);
    g.command([u.id],{type:'attack',id:e.id,x:e.x,z:e.z},team);assert.deepEqual(json(u.order),order);
    g.world.sight[team].visible[g.world.idx(e.x,e.z)]=255;
    assert.equal(g.acquire(u).id,e.id);g.aiObserve(team);
    assert.deepEqual([g.s.ai[team].contacts[e.id].x,g.s.ai[team].contacts[e.id].hp],[0,e.hp]);
    e.x=40;e.z=40;g.aiObserve(team);assert.equal(g.s.ai[team].contacts[e.id],undefined,'vacated visible location invalidates memory');
  }
});

test('enemy scan does not reveal its target to the player or render a secret marker',()=>{
  const {g}=battle();g.s.ai={};const before=Array.from(g.world.visible);
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
    const {g}=battle(faction,faction);g.s.ai={};const p=own(g,team,'hq')[0],other=json(g.account(1-team));
    const d=ABILITIES[kind];g.account(team).energy=d.energy;
    assert.equal(g.ability(kind,p,team),true);assert.equal(g.account(team).energy,0);
    assert.equal(g.account(team).abilities[kind],d.cd);assert.equal(g.ability(kind,p,team),false);
    assert.deepEqual(json(g.account(1-team)),other);
    if(kind==='orbital') {const strike=g.s.strikes[0];assert.equal(strike.team,team);assert.equal(strike.damage,[355,260,440][faction]);}
    if(kind==='repair')assert.equal(g.s.fields[0].team,team);
    if(kind==='drop')assert.equal(own(g,team,'rifle').length,4);
  }
  const {g}=battle();g.s.ai={};
  assert.equal(g.ability('orbital',{x:0,z:0},1),false);assert.equal(g.account(1).energy,100);
  const h=own(g,1,'hq')[0];for(let i=0;i<10;i++)g.spawnUnit('rifle',h.x,h.z+8,1,2);
  assert.equal(g.ability('drop',h,1),false);assert.equal(g.account(1).energy,100);
});

test('repair and faction healing/bloom benefit or damage the correct side',()=>{
  for(const team of [0,1]) {
    const {g}=battle(1,1);g.s.ai={};const h=own(g,team,'hq')[0];
    const friend=g.spawnUnit('tank',h.x+10,h.z,team,1),enemy=g.spawnUnit('tank',h.x+14,h.z,1-team,1);
    friend.hp-=300;enemy.hp-=300;g.rehash();const hp=enemy.hp;
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
    if(kind==='orbital')for(let i=0;i<3;i++)g.spawnUnit('rifle',h.x+12,h.z+i*2,0,0);
    if(kind==='scan')g.spawnUnit('rifle',h.x-7,h.z,1,2);
    if(kind==='drop'){g.s.ai[1].mode='attack';g.s.ai[1].squad=[soldier.id];}
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
  assert.equal(g.s.ai[1].mode,'attack');assert.deepEqual(json(g.s.ai[1].goal),{x:0,z:0});
  // No spawn is required for the observer's copied visible threat in this controller-only test.
  g.aiStrategy(1,own(g,1),[{id:999,kind:'unit',type:'tank',team:0,x:h.x-12,z:h.z,hp:520,maxHp:520,progress:1,size:1.3,seenAt:100}],h);
  assert.equal(g.s.ai[1].mode,'defend');assert.equal(g.s.ai[1].squad.length,0);
});

test('autonomous orders retain formation behavior without leaking local command markers',()=>{
  const {g,events}=battle();g.s.ai={};const h=own(g,0,'hq')[0],goal={x:h.x+35,z:h.z};
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
  const {g}=battle();g.s.ai={};g.enableAI(1);
  const h=own(g,1,'hq')[0];g.spawnUnit('worker',h.x-7,h.z,1,2);g.world.reveal(g.s.entities);
  const before=json(g.account(1));g.world.staticGrid.fill(1);
  assert.equal(g.aiBuild(1,'barracks',h),false);assert.deepEqual(json(g.account(1)),before);
  g.world.staticGrid.fill(0);g.world.rebuild(g.s.entities);g.s.time=4;
  assert.equal(g.aiBuild(1,'barracks',h),true);
  g.s.ai={};g.train('worker',1);const count=own(g,1,'worker').length,paid=g.account(1).alloy;
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
      counts.built++;
    }
    return spawn.call(this,kind,type,x,z,team,faction,extra);
  };
  return counts;
}
for(let faction=0;faction<3;faction++)for(let enemy=0;enemy<3;enemy++)
  test(`autonomous ${faction} vs ${enemy}: paid economy, production, strategic pressure and completed battle`,()=>{
    const {g}=battle(faction,enemy,1409+faction*31+enemy*11,faction===2?'mothership':'desert');
    g.enableAI(0);const counts=audit(g);let attacks=0;
    for(let i=0;i<24000&&!g.s.result;i++) {
      g.step(.05);g.effects.tick(.05);
      if(i%100===0){
        attacks+=Object.values(g.s.ai).filter(a=>a.mode==='attack').length;
        for(const t of [0,1]){assert.ok(Number.isFinite(g.account(t).alloy)&&g.account(t).alloy>=0);assert.ok(g.account(t).gas>=0);}
        const units=g.alive(e=>e.kind==='unit');
        for(let a=0;a<units.length;a++)for(let b=a+1;b<units.length;b++){
          const x=units[a],y=units[b];if((x.type==='air')!==(y.type==='air'))continue;
          assert.ok(Math.hypot(x.x-y.x,x.z-y.z)+1e-8>=(x.size+y.size)*1.4,'body spacing');
        }
      }
    }
    assert.ok(counts.produced>=10);assert.ok(counts.built>=6);assert.ok(attacks>0);
    assert.ok(g.s.result,`no result at ${g.s.time}; ${JSON.stringify(g.s.ai)}`);
  });

test('seed 444213: the real opponent destroys an undefended HQ instead of stopping outside weapon range',()=>{
  const {g}=battle(0,2,444213,'desert');audit(g);advance(g,900);
  assert.equal(g.s.result?.win,false);assert.equal(own(g,0,'hq').length,0);
});

test('same seed and inputs reproduce an uninterrupted AI economy and the simulation RNG',()=>{
  const a=battle().g,b=battle().g;advance(a,120);advance(b,120);
  assert.deepEqual(json(a.s),json(b.s));assert.equal(a.random(),b.random());
});
