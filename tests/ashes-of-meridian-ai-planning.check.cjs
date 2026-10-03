// Short synthetic decision contracts. No autonomous matches or simulation loops.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts, SIMULATION_SCRIPTS } = require('./helpers/game-scripts.cjs');
const context = loadScripts(['core', 'content', 'world', ...SIMULATION_SCRIPTS]);
const { MeridianGame, UNITS, BUILDINGS, aiRulesFor, AI_TUNING } =
  vm.runInContext('({ MeridianGame, UNITS, BUILDINGS, aiRulesFor, AI_TUNING })', context);
const json = x => JSON.parse(JSON.stringify(x));
function fixture(faction = 0, depth = 0) {
  const g = Object.create(MeridianGame.prototype), orders = [];
  g.s = { time: 100, depth, rules: { kind: 'single-player', mission: {id:'hq-elimination'} }, entities: [], parties:
    Array.from({ length: 4 }, (_, id) => ({ id, faction, controller: { kind: 'human' } })) };
  g.world = { cellSize: 2, idx: () => 0, startSites: [{x:60,z:0},{x:0,z:60}],
    layout: {resourceSites:[]}, sight: Array.from({length:4}, () => ({visible:[0],explored:[1]})) };
  g.canSee = () => true;
  g.random = () => { throw Error('Planning must not consume RNG'); };
  g.enableAI(1);
  let id = 0;
  function entity(type, team = 1, x = 0, z = 0) {
    const kind = UNITS[type] ? 'unit' : 'building', d = (kind === 'unit' ? UNITS : BUILDINGS)[type];
    const e = {id:++id,kind,type,team,x,z,hp:d.hp,maxHp:d.hp,progress:1,size:d.size,
      shield:100,maxShield:100,queue:[],order:{type:'idle'}};
    g.s.entities.push(e); return e;
  }
  const home = entity('hq',1,-100,-100), ai = g.aiFor(1);
  g.aiOrder = (team, units, p, attack = true) => orders.push({team,ids:units.map(e=>e.id),x:p.x,z:p.z,attack});
  const own = () => g.s.entities.filter(e=>e.team===1 && e.hp>0);
  function contact(e, areaVisible = false) {
    const c = {id:e.id,kind:e.kind,type:e.type,team:e.team,x:e.x,z:e.z,hp:e.hp,maxHp:e.maxHp,
      progress:e.progress,size:e.size,seenAt:g.s.time,areaVisible};
    ai.contacts[c.id] = c; return c;
  }
  function launch(troops, target) {
    g.aiAttackGoal(1,troops,{contact:target,defense:0,finish:false,score:85});
  }
  return {g,ai,home,orders,entity,contact,own,launch};
}

function deploymentFixture() {
  const f = fixture(), {g,ai,entity} = f, worker = entity('worker');
  g.s.entities = [worker];
  ai.contacts[99] = {id:99,kind:'resource',type:'crystal',x:2,z:0,seenAt:100};
  Object.assign(g.world, {gridSize:13, deploymentReachable:new Uint8Array(169).fill(1),
    idx:(x,z) => (Math.round(z / 2) + 4) * 13 + Math.round(x / 2) + 4,
    point:i => ({x:(i % 13 - 4) * 2,z:(Math.floor(i / 13) - 4) * 2}),
    surface:{fits:() => true}});
  g.world.sight[1].explored = new Uint8Array(169).fill(1);
  const actions = []; let searches = 0;
  g.aiBuild = () => { searches++; ai.buildAttempts.hq = g.s.time; return false; };
  g.executeAction = (team, action) => { actions.push(json(action)); worker.order = {...action.order}; return true; };
  return {...f,worker,actions,searches:() => searches};
}

test('deployment relocates after a failed HQ search even on fully explored terrain, then retries', () => {
  const {g,ai,worker,actions,searches} = deploymentFixture();
  g.aiDeployment(1,[worker]);
  assert.equal(searches(),1); assert.equal(actions.length,1);
  assert.equal(actions[0].order.type,'move');
  assert.ok(Math.hypot(ai.deploymentGoal.x,ai.deploymentGoal.z) > 6);
  g.s.time++;
  g.aiDeployment(1,[worker]);
  assert.equal(searches(),1,'an ongoing relocation must not restart the old HQ search');
  assert.equal(actions.length,1,'preserve movement/path progress');
  Object.assign(worker,ai.deploymentGoal);
  g.aiBuild = () => { assert.equal(worker.x,ai.deploymentGoal.x); return true; };
  g.aiDeployment(1,[worker]);
  assert.equal(ai.deploymentGoal,undefined);
  assert.equal(actions.length,1,'successful construction must not issue a move');
});

test('deployment does not relocate when HQ search is skipped by cooldown or prerequisites', () => {
  const {g,ai,worker,actions} = deploymentFixture();
  ai.buildAttempts.hq = 99;
  g.aiBuild = () => false;
  g.aiDeployment(1,[worker]);
  assert.equal(actions.length,0);
});

test('deployment can replace unreachable relocation and still prioritizes existing foundations', () => {
  const {g,ai,worker,actions,entity,searches} = deploymentFixture();
  ai.deploymentGoal = {x:0,z:8}; ai.deploymentGoalAt = 100;
  worker.order = {type:'move',...ai.deploymentGoal}; worker.pathStatus = 'unreachable';
  g.aiDeployment(1,[worker]);
  assert.equal(searches(),1); assert.equal(actions.length,1);
  assert.notDeepEqual(json(ai.deploymentGoal),{x:0,z:8});
  const foundation = entity('hq',1,7,0); foundation.progress = .06;
  g.aiDeployment(1,[worker,foundation]);
  assert.equal(actions[1].order.type,'build');
  assert.equal(actions[1].order.id,foundation.id);
  assert.equal(searches(),1);
});

test('AI stage knobs saturate and enforce reaction/decision floors without random draws', () => {
  for (const faction of [0,1,2]) {
    let previous;
    for (const depth of [-10,0,3,4,8,12,16,1000000,Infinity,NaN]) {
      const r = aiRulesFor(faction,depth);
      assert.ok(r.reactionDelay >= .6); assert.ok(r.think >= 1 && r.think >= r.reactionDelay);
      assert.ok(r.stage >= 0 && r.stage <= 4); assert.ok(r.attackWait >= 30);
      if (previous && Number.isFinite(depth) && depth >= 0) {
        assert.ok(r.think <= previous.think); assert.ok(r.reactionDelay <= previous.reactionDelay);
      }
      previous = r;
    }
    assert.deepEqual(json(aiRulesFor(faction,16)),json(aiRulesFor(faction,1000000)));
  }
  const reaction = [...AI_TUNING.reactionSeconds], decision = [...AI_TUNING.decisionSeconds];
  try {
    AI_TUNING.reactionSeconds.fill(0); AI_TUNING.decisionSeconds.fill(0);
    assert.equal(aiRulesFor(0,1000000).reactionDelay,.6);
    assert.equal(aiRulesFor(0,1000000).think,1);
  } finally {
    reaction.forEach((n,i)=>AI_TUNING.reactionSeconds[i]=n);
    decision.forEach((n,i)=>AI_TUNING.decisionSeconds[i]=n);
  }
});

test('armed search parties leave reserves at home and keep a distant goal between scouting intervals', () => {
  const {g,ai,entity,own,home,orders} = fixture();
  const troops = Array.from({length:10},()=>entity('rifle',1,home.x,home.z));
  const first = {x:60,z:0}; let searches = 0;
  g.aiScoutGoal = () => { searches++; return searches===1 ? first : {x:0,z:60}; };
  g.aiStrategy(1,own(),[],home);
  assert.equal(searches,1);
  let search = orders.find(o=>o.x===first.x && o.z===first.z);
  assert.equal(search.ids.length,3); assert.equal(search.attack,true);
  const rally = orders.find(o=>o.x!==first.x);
  assert.equal(rally.ids.length,7);
  assert.ok(rally.ids.every(id=>!search.ids.includes(id)),'rally must not cancel reconnaissance');
  assert.ok(troops.slice(1,4).every(u=>rally.ids.includes(u.id)),'doctrine reserves remain home');
  orders.length = 0; g.s.time += 20;
  g.aiStrategy(1,own(),[],home);
  assert.equal(searches,1,'a timer alone cannot redirect the search party');
  assert.ok(orders.some(o=>o.x===first.x && o.ids.length===3));
  Object.assign(troops[0],first); g.s.time += 20;
  g.aiStrategy(1,own(),[],home);
  assert.equal(searches,2); assert.equal(ai.scoutSite,1);
});

test('search replaces an unreachable destination and an injured scout without consuming RNG', () => {
  const {g,ai,entity,own,home,orders} = fixture();
  const troops = Array.from({length:8},()=>entity('rifle',1,home.x,home.z));
  g.aiScoutGoal = () => ({x:60,z:ai.scoutSite || 0});
  g.aiStrategy(1,own(),[],home);
  troops[0].pathStatus = 'unreachable'; g.s.time += 20;
  g.aiStrategy(1,own(),[],home);
  assert.equal(ai.scoutSite,1); assert.equal(ai.scoutGoal.z,1);
  troops[0].hp = troops[0].maxHp*.3; orders.length = 0;
  g.aiStrategy(1,own(),[],home);
  assert.notEqual(ai.scout,troops[0].id);
  const search = orders.find(o=>o.x===60);
  assert.equal(search.ids.length,3); assert.ok(!search.ids.includes(troops[0].id));
});

test('scouting prioritizes unexplored public landing regions, then reachable fog, never hidden entities', () => {
  const {g,ai,home,entity} = fixture();
  const hidden = entity('hq',0,60,0);
  Object.assign(g.world,{gridSize:13, deploymentReachable:new Uint8Array(169).fill(1),
    point:i=>({x:i%13,z:Math.floor(i/13)}), idx:(x,z)=>z===60?1:z===0?2:3});
  g.world.sight[1].explored = new Uint8Array(169);
  const first = json(g.aiScoutGoal(1,home));
  assert.ok(g.world.startSites.some(p=>p.x===first.x && p.z===first.z));
  hidden.x = -80; hidden.z = 80;
  assert.deepEqual(json(g.aiScoutGoal(1,home)),first,'hidden enemy assignment cannot guide search');
  g.world.sight[1].explored[g.world.idx(first.x,first.z)] = 1;
  const next = json(g.aiScoutGoal(1,home));
  assert.notDeepEqual(next,first);
  g.world.sight[1].explored[1] = g.world.sight[1].explored[2] = 1;
  const frontier = g.aiScoutGoal(1,home);
  assert.equal(g.world.deploymentReachable[frontier.z*13+frontier.x],1);
  assert.equal(g.world.sight[1].explored[frontier.z*13+frontier.x],0);
  ai.scoutSite = (ai.scoutSite || 0)+1;
  assert.notDeepEqual(json(g.aiScoutGoal(1,home)),json(frontier),'failed candidates can be skipped');
});

test('nearby replacement goals renew unreachable orders without resetting an ongoing path', () => {
  const {g,entity} = fixture(), troop = entity('rifle'), actions = [];
  troop.order = {type:'attackMove',x:60,z:0};
  g.executeAction = (team,action) => actions.push(json(action));
  MeridianGame.prototype.aiOrder.call(g,1,[troop],{x:60,z:8});
  assert.equal(actions.length,0,'preserve an ongoing formation/path');
  troop.pathStatus = 'unreachable';
  MeridianGame.prototype.aiOrder.call(g,1,[troop],{x:60,z:0});
  assert.equal(actions.length,0,'do not retry the same blocked goal every tick');
  MeridianGame.prototype.aiOrder.call(g,1,[troop],{x:60,z:8});
  assert.equal(actions.length,1); assert.equal(actions[0].order.z,8);
});

test('a viable observed target launches the main wave rather than reserving all search escorts', () => {
  const {g,ai,entity,contact,own,home,orders} = fixture();
  Array.from({length:8},()=>entity('rifle',1,home.x,home.z));
  const worker = contact(entity('worker',0,60,0));
  g.aiStrategy(1,own(),[worker],home);
  assert.equal(ai.mode,'attack'); assert.equal(ai.squad.length,4);
  assert.equal(orders.length,1); assert.equal(orders[0].x,worker.x);
});

test('productive attacks survive the old 150 second limit without resetting sortie age', () => {
  const {g,ai,entity,contact,own,home,launch} = fixture();
  const troop = entity('rifle',1,8,0), hq = contact(entity('hq',0));
  launch([troop],hq); ai.launched = 10;
  for (const time of [120,140,160,180,200,220,240,260,280]) {
    g.s.time = time; hq.hp -= 30;
    g.aiStrategy(1,own(),[hq],home);
    assert.equal(ai.mode,'attack'); assert.equal(ai.attackStartedAt,100);
    assert.equal(ai.launched,10, 'losses alone do not force retreat from an undefended HQ');
  }
  assert.equal(ai.failedGoal,undefined);
});

test('approach is progress; a stalled attack retreats and does not reset its patience each tick', () => {
  const {g,ai,entity,contact,own,home,launch} = fixture();
  const troop = entity('rifle',1,70,0), hq = contact(entity('hq',0));
  launch([troop],hq);
  g.s.time = 140; troop.x = 60; g.aiStrategy(1,own(),[hq],home);
  assert.equal(ai.attackProgress.at,140);
  g.s.time = 180; g.aiStrategy(1,own(),[hq],home); assert.equal(ai.mode,'attack');
  g.s.time = 185; g.aiStrategy(1,own(),[hq],home); assert.equal(ai.mode,'recover');
  assert.equal(ai.failedGoal.until,185 + AI_TUNING.failedGoalSeconds);
  g.s.time = 186; g.aiStrategy(1,own(),[],home); assert.equal(ai.mode,'recover');
  g.s.time = ai.recoverUntil; g.aiStrategy(1,own(),[],home); assert.notEqual(ai.mode,'recover');
});

test('visible damage at the patience boundary wins over the stall timeout', () => {
  const {g,ai,entity,contact,own,home,launch} = fixture();
  const troop = entity('rifle',1,8,0), hq = contact(entity('hq',0)); launch([troop],hq);
  g.s.time = 145; hq.hp -= 10; g.aiStrategy(1,own(),[hq],home);
  assert.equal(ai.mode,'attack'); assert.equal(ai.attackProgress.at,145);
});

test('observed damage to nearby defenders counts as progress, but hidden damage does not', () => {
  const {g,ai,entity,contact,own,home,launch} = fixture();
  const troops = Array.from({length:8},()=>entity('rifle',1,8,0)), hq = contact(entity('hq',0));
  const turret = entity('turret',2,12,0); contact(turret); launch(troops,hq);
  g.s.time = 145; turret.hp -= 20;
  const visible = g.aiObserve(1); g.aiStrategy(1,own(),visible,home);
  assert.equal(ai.mode,'attack'); assert.equal(ai.attackProgress.at,145);
  g.s.time = 190; turret.hp -= 20; g.canSee = () => false;
  g.aiStrategy(1,own(),g.aiObserve(1),home);
  assert.equal(ai.mode,'recover'); assert.equal(ai.combatProgressAt,145);
});

test('real danger and faction exhaustion still retreat despite damage progress', () => {
  for (const faction of [0,1,2]) {
    const {g,ai,entity,contact,own,home,launch} = fixture(faction);
    const troop = entity('rifle',1,8,0), hq = contact(entity('hq',0)); launch([troop],hq);
    if (faction===1) troop.hp *= .5;
    if (faction===2) troop.shield = 0;
    const threats = Array.from({length:faction===0?2:1},()=>contact(entity(faction===0?'tank':'rifle',2,12,0)));
    g.s.time = 110; hq.hp -= 10; g.aiStrategy(1,own(),[hq,...threats],home);
    assert.equal(ai.mode,'recover');
  }
});

test('one armed unit can finish only a currently observed HQ with its surroundings scouted', () => {
  for (const variant of ['clear','fog','memory','rival-defense','medic']) {
    const {g,ai,entity,contact,own,home} = fixture();
    entity(variant==='medic'?'medic':'rifle',1,8,0);
    const hq = contact(entity('hq',0),variant!=='fog'), visible = variant==='memory'?[]:[hq];
    if (variant==='rival-defense') visible.push(contact(entity('turret',2,15,0)));
    g.s.time = AI_TUNING.finishWaitSeconds;
    g.aiStrategy(1,own(),visible,home);
    assert.equal(ai.mode==='attack',variant==='clear',variant);
  }
});

test('destroying an objective continues locally to the HQ without a fresh wave or failure penalty', () => {
  const {g,ai,entity,contact,own,home,launch} = fixture();
  const troop = entity('rifle',1,8,0), factory = contact(entity('factory',0)); launch([troop],factory);
  delete ai.contacts[factory.id];
  const hq = contact(entity('hq',0,12,0));
  g.s.time = 110; g.aiStrategy(1,own(),[hq],home);
  assert.equal(ai.mode,'attack'); assert.equal(ai.attackProgress.targetId,hq.id);
  assert.equal(ai.attackStartedAt,100); assert.equal(ai.failedGoal,undefined);
});

test('small score changes cannot flip an active target; a much better objective needs commitment time', () => {
  const {g,ai,entity,contact,own,home,launch} = fixture();
  const troops = Array.from({length:8},()=>entity('rifle',1,8,0)), hq = contact(entity('hq',0));
  const factory = contact(entity('factory',2,0,8)); launch(troops,hq);
  g.s.time = 105; g.aiStrategy(1,own(),[hq,factory],home);
  assert.equal(ai.attackProgress.targetId,hq.id);
  const exposed = contact(entity('hq',3,0,12),true);
  g.s.time = 106; g.aiStrategy(1,own(),[hq,factory,exposed],home);
  assert.equal(ai.attackProgress.targetId,hq.id);
  g.s.time = 112; g.aiStrategy(1,own(),[hq,factory,exposed],home);
  assert.equal(ai.attackProgress.targetId,exposed.id);
});

test('reserves handle a small base raid while a major threat recalls the army', () => {
  const {g,ai,entity,contact,own,home,launch,orders} = fixture();
  const troops = Array.from({length:6},()=>entity('rifle',1,8,0)), hq = contact(entity('hq',0));
  const guards = Array.from({length:4},()=>entity('rifle',1,home.x+8,home.z)); launch(troops,hq);
  const raid = contact(entity('rifle',2,home.x+15,home.z));
  g.s.time = 110; g.aiStrategy(1,own(),[hq,raid],home);
  assert.equal(ai.mode,'attack');
  assert.ok(orders.some(o=>o.x===raid.x && o.ids.length===guards.length));
  const invasion = Array.from({length:5},()=>contact(entity('tank',2,raid.x,raid.z)));
  g.s.time = 112; g.aiStrategy(1,own(),[hq,...invasion],home);
  assert.equal(ai.mode,'defend'); assert.equal(ai.squad.length,0);
});

test('ground-only reserves cannot pretend to cover a base air raid', () => {
  const {g,ai,entity,contact,own,home,launch} = fixture();
  const troops = Array.from({length:6},()=>entity('rifle',1,8,0)), hq = contact(entity('hq',0));
  for (let i=0;i<4;i++) entity('tank',1,home.x+8,home.z);
  launch(troops,hq);
  const raid = contact(entity('air',2,home.x+15,home.z));
  g.s.time = 110; g.aiStrategy(1,own(),[hq,raid],home);
  assert.equal(ai.mode,'defend');
});

test('elimination cancels the effect of a pending decision', () => {
  const {g,ai} = fixture();
  g.s.time=0; g.aiTick(1); assert.ok(ai.observation);
  g.party(1).eliminated=true; g.s.time=ai.nextThink;
  g.aiEconomy=()=>{throw Error('An eliminated controller must not execute its pending plan');};
  g.aiTick(1);
});

test('observation and decision are separated at every tier, including own damage and moved/hidden enemies', () => {
  for (const depth of [0,4,8,12,16,1000000]) {
    const {g,ai,entity,home} = fixture(0,depth), enemy = entity('rifle',0,0,0), records=[];
    const rules = aiRulesFor(0,depth);
    g.aiEconomy = () => 0; g.aiProduction = () => {}; g.aiAbilities = () => {};
    g.aiStrategy = (team,own,visible) => records.push({own,visible});
    g.s.time = 0; g.aiTick(1); assert.equal(records.length,0);
    const observedHP = home.hp;
    home.hp -= 100; enemy.x = 50; enemy.hp -= 10; g.canSee = () => false;
    g.s.time = rules.reactionDelay-.001; g.aiTick(1); assert.equal(records.length,0);
    g.s.time = rules.reactionDelay; g.aiTick(1);
    assert.equal(records.length,1); assert.equal(records[0].own[0].hp,observedHP);
    assert.equal(records[0].visible[0].x,0); assert.notEqual(records[0].visible[0].hp,enemy.hp);
    assert.notStrictEqual(records[0].own[0],home); assert.notStrictEqual(records[0].own[0].order,home.order);
    g.s.time = ai.nextThink; g.aiTick(1); assert.equal(records.length,1);
    assert.equal(ai.observation.visible.length,0);
    g.s.time = ai.nextThink; g.aiTick(1); assert.equal(records.length,2);
    assert.ok(g.s.time >= rules.think + rules.reactionDelay);
    assert.equal(records[1].own[0].hp,home.hp);
    assert.equal(ai.contacts[enemy.id].x,0,'hidden live motion must not update contact memory');
  }
});

test('finish knowledge is captured from the whole neighborhood, not just the HQ cell', () => {
  const {g,entity} = fixture(), hq = entity('hq',0);
  g.canSee = (team,p) => p.team===team || Math.hypot(p.x,p.z)<20;
  let visible = g.aiObserve(1);
  assert.equal(visible.find(e=>e.id===hq.id).areaVisible,false);
  g.canSee = () => true; visible = g.aiObserve(1);
  assert.equal(visible.find(e=>e.id===hq.id).areaVisible,true);
});

test('scouts revisit different known sites rather than remaining at the first explored corner', () => {
  const {g,ai,entity,own,home} = fixture();
  const scout = entity('rifle'); entity('rifle'); entity('rifle');
  g.aiStrategy(1,own(),[],home); const first = json(ai.scoutGoal);
  scout.x=first.x; scout.z=first.z; g.s.time += 20;
  g.aiStrategy(1,own(),[],home);
  assert.notDeepEqual(json(ai.scoutGoal),first);
});
