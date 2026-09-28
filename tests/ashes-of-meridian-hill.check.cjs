// Bounded mission/AI contracts. No autonomous matches or long simulation runs.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {loadScripts, BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS} = require('./helpers/game-scripts.cjs');
const c = loadScripts(['core','content','effects',...BATTLEFIELD_SCRIPTS,'world',...SIMULATION_SCRIPTS]);
const {MeridianGame, UNITS, UNIT_BODY_SCALE} = vm.runInContext('({MeridianGame, UNITS, UNIT_BODY_SCALE})', c);
function battle(enemies = [1,2]) {
  const events = [], g = new MeridianGame({upgrades:{}}, (type,data) => events.push({type,data}));
  g.start({mission:'king-of-the-hill', map:'aurelion', seed:1409, depth:3, enemies});
  g.s.parties.forEach(p => {p.controller = {kind:'human'};});
  events.length = 0;
  const unit = (type,team,x=19,z=0) => {
    const hq = g.alive(e => e.team===team && e.type==='hq')[0];
    const u = g.spawnUnit(type,hq.x+8,hq.z+8,team,g.factionFor(team));
    assert.ok(u); Object.assign(u,{x,z,exit:undefined,order:{type:'hold'}}); return u;
  };
  const check = time => {g.s.time=time; g.checkBattleResult();};
  return {g, mission:g.s.rules.mission, unit, check, events};
}

test('hill starts at zero with independent state; public zone is half the plaza radius', () => {
  const {g,mission} = battle();
  assert.equal(mission.zone.radius,20.5);
  assert.equal(mission.leader,null); assert.equal(mission.heldSeconds,0);
  assert.deepEqual(Array.from(mission.counts),[0,0,0]);
  assert.equal(g.s.parties.length,3);
  mission.heldSeconds=59; mission.zone.radius=100;
  g.start({mission:'king-of-the-hill',map:'aurelion',seed:1409,enemies:[0,0,0]});
  assert.equal(g.s.rules.mission.zone.radius,20.5);
  assert.equal(g.s.rules.mission.heldSeconds,0);
  assert.equal(g.s.rules.mission.counts.length,4);
  const state=g.s;
  assert.throws(()=>g.start({mission:'king-of-the-hill',map:'desert'}),/Unsupported/);
  assert.throws(()=>g.start({mission:'hq-elimination',map:'aurelion'}),/Unsupported/);
  assert.strictEqual(g.s,state);
});

test('unit centers count equally on the inclusive planar boundary; buildings and dead units do not', () => {
  const {g,mission,unit,check}=battle([0,0,0]);
  unit('worker',0); unit('hero',0,20.5); unit('air',0,0,0);
  unit('tank',1,-20.5); unit('rifle',1,-20.5001);
  const dead=unit('rifle',2); dead.hp=0;
  g.spawnBuilding('depot',19,0,3,0);
  const state = JSON.stringify(g.s.entities);
  g.random=()=>{throw Error('Objective must not draw RNG');};
  check(0);
  assert.deepEqual(Array.from(mission.counts),[3,1,0,0]);
  assert.equal(mission.leader,0);
  assert.equal(JSON.stringify(g.s.entities),state,'counting does not mutate entities');
});

test('a unique plurality, not an absolute majority, wins only after 60 uninterrupted seconds', () => {
  const {g,mission,unit,check,events}=battle([0,0,0]);
  for (let i=0;i<3;i++) unit('rifle',0);
  for (const team of [1,2,3]) for (let i=0;i<2;i++) unit('rifle',team);
  check(10); check(69.999);
  assert.equal(mission.leader,0); assert.equal(g.s.result,null);
  check(70); assert.equal(g.s.result.win,true); assert.equal(mission.heldSeconds,60);
  check(80); assert.equal(events.filter(e=>e.type==='result').length,1);
  assert.equal(mission.heldSeconds,60,'finished mission cannot advance');
});

test('ties, empty hills and changes of leader reset rather than pause or transfer progress', () => {
  const {g,mission,unit,check}=battle(), a=unit('worker',0), b=unit('worker',1,25);
  check(0); check(59); assert.equal(mission.heldSeconds,59);
  b.x=19; check(59.05); assert.equal(mission.leader,null); assert.equal(mission.heldSeconds,0);
  a.x=25; check(59.1); assert.equal(mission.leader,1); assert.equal(mission.heldSeconds,0);
  check(80); assert.ok(mission.heldSeconds<21);
  b.x=25; check(81); assert.equal(mission.leader,null); assert.equal(mission.controlledSince,null);
  a.x=19; check(82); check(141.999); assert.equal(g.s.result,null);
  check(142); assert.equal(g.s.result.win,true);
});

test('an opponent can win the hill; units and buildings both preserve parties without HQs', () => {
  const {g,unit,check}=battle(), survivor=unit('worker',0,25);
  unit('rifle',1);
  const hq=g.alive(e=>e.team===0&&e.type==='hq')[0]; hq.hp=0;
  check(0); assert.equal(g.party(0).eliminated,undefined); assert.equal(survivor.hp>0,true);
  check(60); assert.equal(g.s.result.win,false); assert.match(g.s.result.text,/Opponent 1/);
  const h=battle();
  h.g.alive(e=>e.team===1&&e.type==='hq')[0].hp=0;
  const foundation=h.g.spawnBuilding('depot',50,60,1,1,{progress:.1});
  h.check(0); assert.equal(h.g.party(1).eliminated,undefined);
  foundation.hp=0; h.check(.05); assert.equal(h.g.party(1).eliminated,true);
});

test('complete elimination bypasses the timer, simultaneous total loss is defeat, and neither draws RNG', () => {
  for (const everyone of [false,true]) {
    const {g,check,events}=battle();
    for(const e of g.s.entities) if(e.team>=0 && (everyone || e.team!==0)) e.hp=0;
    g.random=()=>{throw Error('Elimination RNG');};
    check(0); assert.equal(g.s.result.win,!everyone);
    assert.equal(g.s.stats.kills,0); assert.equal(g.s.stats.structuresDestroyed,0);
    check(1); assert.equal(events.filter(e=>e.type==='result').length,1);
  }
});

test('every simulation tick samples control even between legacy HQ result intervals', () => {
  const {g,mission,unit,check}=battle(), a=unit('rifle',0), b=unit('rifle',1,30);
  g.combat=()=>false;
  check(0); check(59.9);
  b.x=19; g.step(.05);
  assert.equal(mission.leader,null); assert.equal(mission.heldSeconds,0);
  b.x=30; g.step(.05);
  assert.equal(mission.leader,0); assert.equal(mission.heldSeconds,0); assert.equal(g.s.result,null);
  assert.equal(a.hp>0,true);
});

test('hill AI targets reachable inner-ring positions, including ranged units, without objective RNG', () => {
  const {g,unit,mission}=battle();
  g.enableAI(1);
  const home=g.alive(e=>e.team===1&&e.type==='hq')[0], own=[home];
  for(const type of ['rifle','tank','artillery','medic','air','destroyer']) own.push(unit(type,1,home.x+8,home.z+8));
  g.random=()=>{throw Error('Strategy RNG');};
  g.aiHillStrategy(1,own,[],home);
  for(const u of own.slice(1)) {
    assert.equal(u.order.type,'move',u.type);
    assert.ok(Math.hypot(u.order.x,u.order.z)<mission.zone.radius,u.type);
    if(!UNITS[u.type].flying) {
      assert.ok(g.world.terrainFree(u.order,u.order,u.size*UNIT_BODY_SCALE),u.type);
      const path=g.world.path(u.x,u.z,u.order.x,u.order.z,false,undefined,u.size*UNIT_BODY_SCALE);
      assert.equal(path.status,'complete',u.type);
    }
    Object.assign(u,{x:u.order.x,z:u.order.z});
  }
  g.aiHillStrategy(1,own,[],home);
  assert.ok(own.slice(1).every(u=>u.order.type==='hold'),'occupiers fight without chasing outside');
});

test('hill AI keeps the objective ahead of an undefended enemy HQ and continues after its own HQ is gone', () => {
  const {g,unit}=battle(); g.enableAI(1);
  const worker=unit('worker',1,70,70), home=g.alive(e=>e.team===1&&e.type==='hq')[0];
  home.hp=0;
  // Exercise the delayed observation path, without running a match or purchasing anything.
  g.aiEconomy=()=>{throw Error('No base remains');}; g.aiProduction=()=>{}; g.aiAbilities=()=>{};
  g.s.time=10; g.aiTick(1);
  assert.equal(worker.order.type,'hold');
  g.s.time=g.aiFor(1).nextThink; g.aiTick(1);
  assert.equal(worker.order.type,'move'); assert.ok(Math.hypot(worker.order.x,worker.order.z)<20.5);
  const contact={id:999,team:0,type:'hq',kind:'building',x:140,z:-130,hp:100,maxHp:100,progress:1,size:5,areaVisible:true};
  g.aiFor(1).contacts[999]=contact;
  g.aiHillStrategy(1,[worker],[contact]);
  assert.ok(Math.hypot(worker.order.x,worker.order.z)<20.5);
});
