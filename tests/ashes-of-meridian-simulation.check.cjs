// CPU tests with fixed start expectations and uninterrupted run scenarios.
// Scope: docs/reference-tests.md.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { SIMULATION_SCRIPTS, readScripts, loadScripts } = require('./helpers/game-scripts.cjs');
const { createRendererStub } = require('./helpers/renderer-stub.cjs');
const { populateBase } = require('./helpers/populated-battle.cjs');

const scripts = readScripts();
// Normalize VM prototypes when comparing state in tests; no runtime save API.
const json = value => JSON.parse(JSON.stringify(value));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≈ ${expected}`);

function createGame() {
  const context = loadScripts(['core', 'renderer', 'content', 'world', 'world-view', 'effects', ...SIMULATION_SCRIPTS], {
    scripts, globals: { structuredClone },
  });
  vm.runInContext('Math.random = () => { throw Error("Unexpected unseeded randomness in simulation test"); }', context);
  const MeridianGame = vm.runInContext('MeridianGame', context);
  const renderer = createRendererStub();
  const events = [];
  const View = vm.runInContext('BattlefieldView', context), view = new View(renderer);
  const game = new MeridianGame({ upgrades: {} }, (type, data) => {
    if (type === 'start') view.sync(game.world);
    events.push({ type, data: json(data) });
  });
  return { game, renderer, events };
}

function freshBattle(faction = 0, seed = 1409) {
  const runtime = createGame();
  runtime.game.start({ seed, biome: 'rust', faction });
  return runtime;
}

// Production, repair and crowd tests explicitly need a developed base, not a fresh start.
function battle(faction = 0, seed = 1409) {
  const runtime = freshBattle(faction, seed);
  populateBase(runtime.game);
  return runtime;
}

function spacingArena() {
  const { game } = battle();
  game.s.entities = game.s.entities.filter(e => e.kind === 'building');
  game.ids = new Map(game.s.entities.map(e => [e.id, e]));
  game.world.staticGrid.fill(0); game.world.rebuild(game.s.entities); game.rehash();
  return game;
}

function assertUnitSpacing(game) {
  const units = game.alive(e => e.kind === 'unit');
  for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) {
    const a = units[i], b = units[j];
    if ((a.type === 'air') !== (b.type === 'air')) continue;
    assert.ok(Math.hypot(a.x-b.x,a.z-b.z) + 1e-8 >= (a.size+b.size)*1.4,
      `units ${a.id}/${b.id} overlap`);
  }
}

function advance(game, steps) {
  for (let i = 0; i < steps; i++) {
    game.step(.05);
    game.effects.tick(.05);
  }
}

const player = (game, type) => game.alive(e => e.team === 0 && e.type === type)[0];
const rifleCount = game => game.alive(e => e.team === 0 && e.type === 'rifle').length;

test('single battle starts with only the own HQ, one hostile base and no mission state', () => {
  const { game, renderer, events } = freshBattle(), s = game.s;
  assert.deepEqual([s.seed,s.biome,s.faction,s.enemy,s.time], [1409,'rust',0,2,0]);
  assert.equal('version' in s, false); assert.equal(game.snapshot, undefined); assert.equal(game.restore, undefined);
  assert.deepEqual([s.alloy,s.gas,s.energy,s.entities.length,s.nextId,game.supply(),game.cap()], [250,0,100,61,62,0,24]);
  assert.equal(game.alive(e => e.team === 1 && e.type === 'hq').length, 1);
  assert.deepEqual(Array.from(game.alive(e => e.team === 0), e => e.type), ['hq']);
  assert.ok(s.entities.every(e => ['unit','building','resource'].includes(e.kind)));
  for (const key of ['m','index','practice','upgrades','research','difficulty']) assert.equal(key in s, false);
  assert.equal(game.objectiveRows().length, 1); assert.match(game.objectiveRows()[0].text, /enemy base/);
  assert.equal(renderer.fogOn, true); assert.deepEqual(events.map(e => e.type), ['start','radio']);
});

test('no workers means no alloy or aether income, and 250 alloy buys exactly five workers for every faction', () => {
  for(const faction of [0,1,2]) {
    const {game}=freshBattle(faction);
    assert.deepEqual(json(game.cost('worker')),{cost:50,gas:0});
    advance(game,1200);
    assert.deepEqual([game.s.alloy,game.s.gas,game.s.stats.gathered],[250,0,0]);
    for(let i=0;i<5;i++)assert.equal(game.train('worker'),true);
    assert.deepEqual([game.s.alloy,game.s.gas,game.supply(),player(game,'hq').queue.length],[0,0,5,5]);
    assert.equal(game.train('worker'),false);
  }
});

test('the first worker must be paid for and recruited, then enables mining and the first new building', () => {
  for (const faction of [0,1,2]) {
    const {game}=freshBattle(faction);
    advance(game,40);
    assert.deepEqual(Array.from(game.alive(e=>e.team===0),e=>e.type),['hq']);
    assert.match(game.canBuild('barracks'),/Recruit a worker/);
    const before=game.s.alloy, cost=game.cost('worker');
    assert.equal(game.train('worker'),true); close(game.s.alloy,before-cost.cost);
    assert.equal(game.supply(),1); assert.equal(player(game,'hq').queue[0].type,'worker');
    advance(game,100); assert.equal(player(game,'worker'),undefined);
    advance(game,700);
    const worker=player(game,'worker'); assert.ok(worker); assert.equal(worker.exit,undefined);
    assert.equal(game.alive(e=>e.team===0&&e.kind==='unit').length,1);
    assert.ok(game.s.stats.gathered>0); assert.equal(game.canBuild('barracks'), '');
    const p={x:-39,z:53}; assert.equal(game.canBuild('barracks',p),'');
    assert.equal(game.build('barracks',p,[worker.id]),true);
    advance(game,900); assert.equal(player(game,'barracks').progress,1);
    assert.equal(game.s.result,null);
  }
});

test('retired start-unit and reserve bonuses never affect a new battle', () => {
  const {game}=createGame(); game.profile.upgrades={logistics:3,veterans:3,stores:3};
  game.start({seed:1409});
  assert.deepEqual(Array.from(game.alive(e=>e.team===0),e=>e.type),['hq']);
  assert.deepEqual(json(game.s.meta),{}); assert.deepEqual([game.s.alloy,game.s.gas],[250,0]);
});

test('fresh starts with the same seed reproduce state; another seed changes resource amounts', () => {
  const a = freshBattle().game, b = freshBattle().game, other = freshBattle(0, 1410).game;
  assert.deepEqual(json(a.s), json(b.s));
  assert.deepEqual(Array.from(a.world.explored),Array.from(b.world.explored));
  assert.notDeepEqual(json(a.alive(e => e.type === 'crystal').map(e => e.amount)), json(other.alive(e => e.type === 'crystal').map(e => e.amount)));
});

test('all factions and biomes start without mission definitions or research', () => {
  const { game } = createGame();
  for (const faction of [0,1,2]) for (const biome of ['ash','rust','choir','court','star']) {
    game.start({ seed: 1409, faction, enemy: faction, biome });
    assert.deepEqual(Array.from(game.alive(e => e.team === 0), e => e.type), ['hq']);
    advance(game, 2);
    assert.deepEqual(Array.from(game.alive(e => e.team === 0), e => e.type), ['hq']);
    assert.equal(game.s.biome, biome); assert.equal(game.s.enemy, faction);
    assert.ok(game.alive(e => e.team === 1).every(e => e.faction === faction));
    assert.ok(game.s.entities.every(e => Number.isFinite(e.hp) && !['ward','avatar','convoy','lab'].includes(e.type)));
    assert.equal('m' in game.s, false); assert.equal('research' in game.s, false);
  }
});

test('removed labs and mission-only ward generators cannot be built or spend resources', () => {
  const { game } = battle(), before = json(game.s);
  assert.match(game.canBuild('lab'), /Unknown structure/);
  assert.match(game.canBuild('ward'), /Unknown structure/);
  for (const type of ['lab', 'ward']) assert.equal(game.build(type, { x: -30, z: 40 }), false);
  assert.deepEqual(json(game.s), before);
});

test('only enemy HQ destruction wins; loss of the last own HQ loses, without stars or rewards', () => {
  for (const win of [true,false]) {
    const { game, events } = battle();
    game.s.time = 3600; game.objectiveTick(.2); assert.equal(game.s.result, null);
    const hq = game.alive(e => e.type === 'hq' && e.team === (win ? 1 : 0))[0];
    game.damage(hq, 999999, null, true); game.objectiveTick(.2);
    assert.equal(game.s.result.win, win); assert.equal('stars' in game.s.result, false);
    assert.deepEqual(json(game.profile), {upgrades:{}});
    const ended = json(game.s); advance(game, 10); assert.deepEqual(json(game.s), ended);
    assert.equal(events.filter(e => e.type === 'result').length, 1);
  }
});

test('ground attack-move preserves mixed formations and worker movement without setting building rally', () => {
  const { game } = battle();
  const rifle = game.spawnUnit('rifle', 0, 0, 0, 0), worker = game.spawnUnit('worker', 1, 0, 0, 0);
  const hq = game.alive(e => e.team === 0 && e.type === 'hq')[0];
  game.command([rifle.id,worker.id,hq.id], {type:'attackMove',x:10,z:20});
  assert.equal(rifle.order.type,'attackMove'); assert.equal(worker.order.type,'move');
  close(rifle.order.x,9.04); close(worker.order.x,10.96);
  assert.equal(rifle.order.z,20); assert.equal(worker.order.z,20);
  assert.equal(hq.rally, undefined);
  const crystal = game.alive(e => e.kind === 'resource' && e.type === 'crystal')[0];
  game.command([worker.id], {type:'smart',id:crystal.id,x:crystal.x,z:crystal.z});
  assert.deepEqual(json(worker.order),{type:'mine',id:crystal.id});
  const enemy = game.alive(e => e.team === 1 && e.type === 'rifle')[0];
  game.command([rifle.id], {type:'smart',id:enemy.id,x:enemy.x,z:enemy.z});
  assert.equal(rifle.order.type,'attack'); assert.equal(rifle.order.id,enemy.id);
});

test('fixed wave sizing and timing retain the former standard rules', () => {
  for (const [wave, count, interval] of [[1,8,79.2],[10,14,72],[40,24,54.4]]) {
    const { game, events } = battle();
    assert.equal(game.s.nextWave, 95);
    game.s.wave = wave-1; game.s.time = 95; game.s.enemyBudget = 100000;
    game.wave();
    assert.equal(events.at(-1).data.n, count);
    close(game.s.nextWave,95+interval);
  }
});

test('waves originate at the enemy base and stop without it', () => {
  const { game, events } = battle(); const before = game.alive(e => e.team === 1 && e.kind === 'unit').length;
  game.wave(); assert.ok(game.alive(e => e.team === 1 && e.kind === 'unit').length > before);
  assert.ok(events.some(e => e.type === 'wave'));
  const hq = game.alive(e => e.team === 1 && e.type === 'hq')[0]; hq.hp = 0;
  const count = game.s.entities.length; game.wave(); assert.equal(game.s.entities.length, count);
});

test('populated army fixtures and two minutes of mining, combat and waves keep unit spacing', () => {
  for (const [faction,seed,biome] of [[0,1409,'rust'],[1,7012,'ash'],[2,9017,'choir'],[0,43015,'star']]) {
    const { game } = createGame(); game.start({faction,seed,biome}); populateBase(game); assertUnitSpacing(game);
    if (seed !== 1409) continue;
    for (let i=0;i<2400;i++) {
      game.step(.05); game.effects.tick(.05);
      if (i%20===0) assertUnitSpacing(game);
    }
    assertUnitSpacing(game); assert.ok(game.s.stats.gathered>0); assert.ok(game.s.wave>0);
  }
});

test('coincident spawns use deterministic free positions, stay separate at rest and preserve RNG calls', () => {
  const a = spacingArena(), b = spacingArena();
  let samples = 0; a.random = () => { samples++; return .5; }; b.random = () => .5;
  for (let i = 0; i < 3; i++) for (const type of ['worker','rifle','medic','tank','artillery','hero','air']) {
    const first = a.spawnUnit(type,0,0,0,0), second = b.spawnUnit(type,0,0,0,0);
    assert.ok(first); assert.deepEqual(json(first),json(second));
    assertUnitSpacing(a); assert.ok(a.unitFits(first,first.x,first.z));
  }
  assert.equal(samples,21); // Only the existing spawn cooldown sample, no search randomness.
  const positions = a.alive(e=>e.kind==='unit').map(e=>[e.x,e.z]);
  advance(a,40); assertUnitSpacing(a);
  assert.deepEqual(a.alive(e=>e.kind==='unit').map(e=>[e.x,e.z]),positions);
});

test('repeated production without rally spawns distinct idle units at the assigned building', () => {
  const game = spacingArena(), barracks = player(game,'barracks');
  for (let i=0;i<5;i++) assert.equal(game.train('rifle'),true);
  for (const q of barracks.queue) q.time=.05;
  for (let i=0;i<400;i++) { game.step(.05); assertUnitSpacing(game); }
  const units = game.alive(e=>e.kind==='unit');
  assert.equal(units.length,5); assert.equal(barracks.queue.length,0);
  for (const e of units) {
    assert.equal(e.order.type,'idle'); assert.equal(e.exit,undefined); assert.ok(game.unitFits(e,e.x,e.z));
    assert.ok(Math.hypot(e.x-barracks.x,e.z-barracks.z)<10);
  }
});

test('movement sidesteps stationary units and oncoming units without interpenetration', () => {
  const game = spacingArena();
  const obstacle = game.spawnUnit('tank',0,0,1,0), runner = game.spawnUnit('rifle',-6,0,0,0);
  runner.path = [{x:0,z:0},{x:6,z:0}]; runner.pathVersion = game.world.pathVersion;
  const a = game.spawnUnit('rifle',-6,8,0,0), b = game.spawnUnit('rifle',6,8,1,0);
  const goals = [{e:runner,x:6,z:0},{e:a,x:6,z:8},{e:b,x:-6,z:8}];
  let sidestep = 0;
  for (let i=0;i<400;i++) {
    game.s.time += .05;
    for (const p of goals) if (!p.done) p.done=game.move(p.e,p,.05);
    sidestep=Math.max(sidestep,Math.abs(runner.z)); assertUnitSpacing(game);
    for (const {e} of goals) assert.ok(game.unitFits(e,e.x,e.z));
  }
  assert.ok(sidestep>.5); assert.deepEqual([obstacle.x,obstacle.z],[0,0]);
  for (const p of goals) assert.ok(p.done && Math.hypot(p.e.x-p.x,p.e.z-p.z)<2);
});

test('idle allies can yield only into free space; enemies and assigned units do not get pushed', () => {
  const game=spacingArena(), mover=game.spawnUnit('rifle',0,0,0,0), other=game.spawnUnit('rifle',2,0,0,0);
  game.random=()=>{throw Error('Collision must not consume RNG');};
  game.yieldUnitSpace(mover,.22,0); assert.equal(other.x,2); assert.equal(other.z,0);
  assert.ok(other.yieldTo.z>0); assert.equal(other.order.type,'idle'); assertUnitSpacing(game);
  delete other.yieldTo; other.yieldUntil=0; const blockedAt=game.world.blockedAt; game.world.blockedAt=(x,z)=>z>0;
  game.yieldUnitSpace(mover,.22,0); assert.equal(other.yieldTo,undefined); game.world.blockedAt=blockedAt;
  other.team=1; game.yieldUnitSpace(mover,.22,0); assert.equal(other.yieldTo,undefined);
  other.team=0; other.order={type:'hold'}; game.yieldUnitSpace(mover,.22,0); assert.equal(other.yieldTo,undefined);
  other.order={type:'idle'}; game.random=()=>.5;
  const blocker=game.spawnUnit('rifle',2,1.9,0,0); blocker.order={type:'hold'};
  game.yieldUnitSpace(mover,.22,0); assert.equal(other.yieldTo,undefined); assert.equal(blocker.z,1.9);
  blocker.hp=0; game.yieldUnitSpace(mover,.22,0);
  for(let i=0;i<100;i++) {
    game.s.time+=.05; game.move(mover,{x:6,z:0},.05);
    if(other.yieldTo) game.moveYield(other,.05);
    // The mover may curve around it, but must not carry it down the route.
    assert.ok(Math.abs(other.x-2)<.5); assertUnitSpacing(game);
  }
  assert.ok(mover.x>5); assert.ok(other.z>0 && other.z<2);
});

test('troops settle beside a shared rally destination without stacking or circling', () => {
  const game=spacingArena(), units=[];
  for(let i=0;i<5;i++) {
    const e=game.spawnUnit('rifle',-10+i*2,-10,0,0);
    e.order={type:'attackMove',x:0,z:0}; units.push(e);
  }
  advance(game,400); assertUnitSpacing(game);
  for(const e of units) { assert.equal(e.order.type,'idle'); assert.ok(Math.hypot(e.x,e.z)<5); }
  const positions=units.map(e=>[e.x,e.z]); advance(game,100);
  assert.deepEqual(units.map(e=>[e.x,e.z]),positions); assertUnitSpacing(game);
});

test('placement respects terrain, map edges and flight layers; dead units do not occupy space', () => {
  const game = spacingArena();
  game.world.mark(game.world.staticGrid,0,0,4); game.world.rebuild(game.s.entities);
  const tank=game.spawnUnit('tank',0,0,0,0), air=game.spawnUnit('air',0,0,0,0);
  assert.ok(!game.world.blockedAt(tank.x,tank.z)); assert.deepEqual([air.x,air.z],[0,0]);
  const ground=game.spawnUnit('rifle',20,0,0,0), above=game.spawnUnit('air',20,0,0,0);
  assert.deepEqual([above.x,above.z],[ground.x,ground.z]);
  ground.hp=0; const replacement=game.spawnUnit('rifle',20,0,0,0);
  assert.deepEqual([replacement.x,replacement.z],[20,0]);
  for(let i=0;i<8;i++) {
    const e=game.spawnUnit(i%2?'air':'tank',85,85,i%2,0);
    assert.ok(e && game.unitFits(e,e.x,e.z)); assertUnitSpacing(game);
  }
});

test('blocked production keeps its paid order until space is free', () => {
  const game = spacingArena(), barracks = player(game,'barracks');
  assert.equal(game.train('rifle'),true); barracks.queue[0].time=.05;
  const blockedAt = game.world.blockedAt; game.world.blockedAt=()=>true;
  let samples=0; game.random=()=>{samples++;return .5;};
  advance(game,2);
  assert.equal(barracks.queue.length,1); assert.equal(barracks.queue[0].progress,1);
  assert.equal(game.alive(e=>e.kind==='unit').length,0); assert.equal(samples,0);
  game.world.blockedAt=blockedAt; game.step(.05);
  assert.equal(barracks.queue.length,0); assert.equal(game.s.stats.trained,1);
  assertUnitSpacing(game);
});

for (const [seed,biome,faction,count,forced] of [
  [1409,'rust',0,8,false], [7012,'ash',1,12,false], [9017,'choir',2,12,false], [1409,'rust',0,8,true]
]) test(`worker traffic stays productive for six minutes: ${seed}/${faction}/${count}, forced node ${forced}`, () => {
  const {game}=createGame();
  game.start({seed,biome,faction}); populateBase(game,count); game.s.nextWave=1e9;
  for(const e of game.s.entities) if(e.kind==='unit'&&e.team===1)e.hp=0;
  let workers=game.alive(e=>e.team===0&&e.type==='worker');
  if(forced) for(const w of workers) w.order={type:'mine',id:game.closest(w,n=>n.type==='crystal').id};
  const trips=workers.map(()=>0), previous=workers.map(()=>0), velocities=workers.map(()=>null), reversals=workers.map(()=>0);
  for(let i=0;i<7200;i++) {
    const before=workers.map(w=>({x:w.x,z:w.z,carry:w.carry,returning:w.returning,id:w.order.id}));
    game.step(.05); game.effects.tick(.05);
    workers.forEach((w,j)=>{
      if(before[j].carry>0&&w.carry===0)trips[j]++;
      const dx=w.x-before[j].x,dz=w.z-before[j].z,len=Math.hypot(dx,dz),v=velocities[j];
      const reversal=len>.01&&v&&v.len>.01&&(dx*v.dx+dz*v.dz)/(len*v.len)<-.8&&
        w.returning===before[j].returning&&w.order.id===before[j].id;
      reversals[j]=reversal?reversals[j]+1:0;
      assert.ok(reversals[j]<4,`sustained jitter: worker ${w.id}, step ${i}`);
      velocities[j]={dx,dz,len};
    });
    if(i%20===0)assertUnitSpacing(game);
    if(i%1200===1199)workers.forEach((w,j)=>{
      assert.ok(trips[j]>previous[j],`worker ${w.id} stopped delivering in minute ${(i+1)/1200}`);
      previous[j]=trips[j];
    });
  }
  assertUnitSpacing(game);
});

test('movement speed preserves faction modifiers and strict slow expiry without mutation or RNG', () => {
  const { game } = freshBattle();
  game.s.time = 10;
  game.random = () => { throw Error('Speed calculation must not consume RNG'); };
  for (const [type, speeds] of [['worker', [4.5, 4.95, 4.5]], ['air', [7, 7.7, 7]]]) {
    for (const faction of [0, 1, 2]) {
      for (const slowed of [undefined, 9, 10, 11]) {
        const entity = Object.freeze({ type, faction, slowed });
        const before = json(game.s);
        close(game.movementSpeed(entity), speeds[faction] * (slowed === 11 ? 0.65 : 1));
        assert.deepEqual(json(game.s), before);
      }
    }
  }
});

test('loaded workers have priority while yielding moves continuously and preserves the pending order', () => {
  const game=spacingArena(), incoming=game.spawnUnit('worker',2,0,0,0), loaded=game.spawnUnit('worker',0,0,0,0);
  incoming.order={type:'mine',id:999}; loaded.order={type:'mine',id:999}; loaded.carry=18;
  game.yieldUnitSpace(loaded,.22,0); assert.equal(incoming.x,2); assert.equal(incoming.z,0);
  const goal=json(incoming.yieldTo); assert.ok(goal.z>1); assert.equal(goal.x,2);
  for(let i=0;i<5;i++) {
    const before=incoming.z, walk=incoming.walk;
    game.step(.05);
    assert.equal(incoming.x,2); assert.ok(incoming.z>before && incoming.z-before<=4.5*.05+1e-9);
    assert.ok(incoming.walk>walk); assert.deepEqual(incoming.order,{type:'mine',id:999});
    assert.deepEqual(json(incoming.yieldTo),goal); assertUnitSpacing(game);
  }
  for(let i=0;i<30&&incoming.yieldTo;i++) { game.s.time+=.05; game.move(incoming,{x:-5,z:0},.05); }
  assert.equal(incoming.yieldTo,undefined); close(incoming.z,goal.z);
  game.move(incoming,{x:-5,z:0},.05); assert.ok(incoming.x<2);
});

test('yielding idle units animate and abandon a newly blocked manoeuvre', () => {
  const game=spacingArena(), mover=game.spawnUnit('rifle',0,0,0,0), other=game.spawnUnit('rifle',2,0,0,0);
  other.rot=Math.PI/2;
  game.yieldUnitSpace(mover,.22,0); const goal=json(other.yieldTo), rot=other.rot;
  game.step(.05); assert.ok(other.z>0 && other.z<goal.z); assert.notEqual(other.rot,rot);
  assert.ok(other.walk>0); assert.equal(other.order.type,'idle');
  assert.deepEqual(json(other.yieldTo),goal);
  const before=[other.x,other.z]; game.world.blockedAt=()=>true;
  game.s.time=1; game.moveYield(other,.05);
  assert.equal(other.yieldTo,undefined); assert.deepEqual([other.x,other.z],before);
  assert.equal(other.order.type,'idle');
});

test('a blocked unit does not turn or animate a zero-length terrain slide', () => {
  const game=spacingArena(), worker=game.spawnUnit('worker',0,0,0,0);
  worker.path=[{x:0,z:-10}]; worker.pathVersion=game.world.pathVersion; worker.nextPath=100;
  worker.rot=1.5; worker.walk=10; game.world.blockedAt=()=>true;
  game.move(worker,{x:0,z:-10},.05);
  assert.deepEqual([worker.x,worker.z,worker.rot,worker.walk],[0,0,1.5,10]);
});

test('detour planning restores the navigation grid and never consumes RNG', () => {
  const game=spacingArena(), worker=game.spawnUnit('worker',0,0,0,0);
  game.spawnUnit('worker',3,0,0,0);
  const grid=game.world.blocked, bytes=Array.from(grid), version=game.world.pathVersion;
  game.random=()=>{throw Error('Path planning must not use RNG');};
  game.pathTo(worker,{x:8,z:0},true);
  assert.ok(worker.path.length); assert.strictEqual(game.world.blocked,grid);
  assert.deepEqual(Array.from(grid),bytes); assert.equal(game.world.pathVersion,version);
  const path=game.world.path; game.world.path=()=>{throw Error('probe');};
  assert.throws(()=>game.pathTo(worker,{x:8,z:0},true),/probe/);
  assert.strictEqual(game.world.blocked,grid); game.world.path=path;
});

test('all produced unit types physically leave their building before working or following rally', () => {
  for(const [i,type] of ['worker','rifle','medic','tank','artillery','air','hero'].entries()) {
    const game=spacingArena(), faction=i%3;
    game.s.alloy=10000; game.s.gas=10000;
    let b=player(game,['hq','barracks','barracks','factory','factory','hangar','hq'][i]);
    if(!b)b=game.spawnBuilding('hangar',0,10,0,faction);
    b.faction=faction; b.rally={x:b.x+18,z:b.z-10}; game.world.rebuild(game.s.entities);
    if(type==='worker')game.spawnResource('crystal',b.x+12,b.z,1000);
    assert.equal(game.train(type),true); b.queue[0].progress=1;
    game.step(.05);
    let unit=game.alive(e=>e.kind==='unit')[0]; assert.ok(unit?.exit);
    if(type==='worker')assert.equal(unit.order.type,'idle');
    assert.equal(unit.exit.building,b.id); assert.ok(Math.hypot(unit.x-b.x,unit.z-b.z)<1);
    const destination={x:unit.exit.x,z:unit.exit.z}, pending=json(unit.order);
    assert.equal(unit.carry,0); assert.equal(game.s.stats.gathered,0);
    for(let t=0;t<240&&unit.exit;t++) {
      const before={x:unit.x,z:unit.z}; game.step(.05);
      const speed=[4.5,4.4,4.7,2.9,2.5,7,5][i]*(faction===1?1.1:1);
      assert.ok(Math.hypot(unit.x-before.x,unit.z-before.z)<=speed*.05+.051,'no teleport at exit');
      assertUnitSpacing(game);
    }
    assert.equal(unit.exit,undefined,type); close(unit.x,destination.x); close(unit.z,destination.z);
    assert.ok(game.unitFits(unit,unit.x,unit.z)); assert.deepEqual(json(unit.order),pending);
    game.step(.05);
    if(type==='worker')assert.equal(unit.order.type,'mine');
    else assert.equal(unit.order.type,'attackMove');
  }
});

test('exit space is reserved and selling the producer does not strand its unit', () => {
  const game=spacingArena(), b=player(game,'barracks'); game.train('rifle'); b.queue[0].progress=1;
  game.step(.05); const unit=game.alive(e=>e.kind==='unit')[0];
  assert.ok(unit.exit); assert.equal(game.produceUnit(b,'rifle'),null);
  const other=game.spawnUnit('rifle',0,0,0,0);
  assert.equal(game.unitFits(other,unit.exit.x,unit.exit.z),false);
  assert.equal(game.sellBuilding(b.id),true);
  advance(game,240); assert.ok(game.get(unit.id)); assert.equal(unit.exit,undefined); assertUnitSpacing(game);
});

test('base combat/movement stats retain faction, shields and unit-veterancy modifiers without difficulty scaling', () => {
  const { game } = battle();
  for (const team of [0, 1, 2]) for (const faction of [0, 1, 2]) {
    const e = game.spawnUnit('rifle', 0, 0, team, faction);
    const stats = game.rangedStats(e);
    close(stats.damage, 13 * (faction === 2 ? 1.12 : 1));
    assert.equal(stats.range, 9); assert.equal(e.vision, 17);
    close(e.maxHp, game.spawnUnit('rifle', 10, 10, 0, faction).maxHp);
    close(game.spawnBuilding('hq', 20, 20, team, faction).maxHp, 2600);
    e.kills = 5; close(game.rangedStats(e).damage, stats.damage * 1.12);
    const hp = e.hp, shield = e.shield;
    game.damage(e, 20, null, true);
    close(e.hp, hp - Math.max(0, 20 - shield)); close(e.shield, Math.max(0, shield - 20));
    const z = team * 12 + faction * 4; // Separate flight lanes: measure speed, not avoidance.
    const air = game.spawnUnit('air', 0, z, team, faction);
    air.path = [{ x: 20, z }]; air.nextPath = 100;
    game.move(air, { x: 20, z }, .1);
    close(air.x, .7 * (faction === 1 ? 1.1 : 1)); close(air.z, z);
  }
});

test('retained weapons apply direct damage and schedule artillery shells without a boss weapon', () => {
  const { game } = battle(), target = game.alive(e => e.team === 1 && e.type === 'hq')[0];
  const hp = target.hp; game.world.visible.fill(255);
  for (const [type,faction] of [['rifle',0],['tank',1],['rifle',2],['artillery',0]]) {
    const unit = game.spawnUnit(type,target.x-10,target.z,0,faction); game.fire(unit,target);
  }
  close(target.hp, hp - 13 - 58 - 13*1.12);
  assert.equal(game.s.strikes.length, 1);
  const shell = game.s.strikes[0];
  assert.deepEqual([shell.at,shell.damage,shell.radius,shell.type], [.85,100,4.5,'shell']);
  assert.ok(game.effects.fx.length > 0);
});

test('base mining, refinery income, medic healing and faction regeneration work without research state', () => {
  const { game } = battle();
  const worker = player(game, 'worker'), node = game.alive(e => e.type === 'crystal')[0];
  worker.x = node.x; worker.z = node.z; worker.order = { type: 'mine', id: node.id };
  for (let i = 0; i < 3; i++) game.worker(worker, 1.25);
  assert.equal(worker.carry, 18);
  const medic = game.spawnUnit('medic', 75, 75, 0, 0), patient = game.spawnUnit('rifle', 75, 75, 2, 0);
  patient.hp -= 80; game.rehash(); game.medic(medic, 1);
  close(patient.hp, patient.maxHp - 60);
  medic.hp = 0; patient.hp = 0;
  const troops = [0, 1, 2].map(f => game.spawnUnit('rifle', 75, 75, 0, f));
  for (const troop of troops) troop.hp = troop.maxHp - 50;
  const gas = game.s.gas; advance(game, 1);
  close(game.s.gas, gas + .05 * 1.7);
  for (const troop of troops) close(troop.hp, troop.maxHp - 50 + (troop.faction === 1 ? 2.1 * .05 : 0));
});

test('starting worker levels 0–5 preserve seeded setup and place free, spaced workers for every faction and biome', () => {
  for (const faction of [0, 1, 2]) for (const biome of ['ash', 'rust', 'choir', 'court', 'star']) {
    const { game } = createGame(), opts = { seed: 1409, faction, biome };
    game.start(opts);
    const original = json(game.s.entities), terrain = Array.from(game.world.staticGrid),
      samples = Array.from({ length: 6 }, () => game.random());
    for (let level = 0; level <= 5; level++) {
      game.profile.upgrades = { startingWorkers: level };
      game.start(opts);
      const workers = game.alive(e => e.team === 0 && e.type === 'worker');
      assert.equal(workers.length, level);
      assert.deepEqual([game.s.alloy, game.s.gas, game.supply(), game.cap()], [250, 0, level, 24]);
      assert.equal(player(game, 'hq').queue.length, 0);
      assert.equal(game.s.stats.trained, 0);
      assert.deepEqual(json(game.s.entities.filter(e => e.team !== 0 || e.kind === 'building')), original);
      assert.deepEqual(Array.from(game.world.staticGrid), terrain);
      assert.equal(game.random(), samples[level], 'only one normal spawn RNG draw per bonus worker');
      for (const [i, w] of workers.entries()) {
        assert.equal(w.faction, faction); assert.equal(w.cd, samples[i] * .5);
        assert.equal(w.hp, w.maxHp); assert.equal(w.order.type, 'idle');
        assert.equal(w.exit, undefined); assert.ok(game.unitFits(w, w.x, w.z));
        assert.ok(Math.hypot(w.x + 51, w.z - 49) < 24);
      }
      assertUnitSpacing(game);
    }
  }
});

test('starting worker upgrades affect only the next battle and reproduce on restart', () => {
  const { game } = createGame(), opts = { seed: 9897, faction: 1, biome: 'rust' };
  game.profile.upgrades = { startingWorkers: 2 }; game.start(opts);
  const before = json(game.s);
  game.profile.upgrades.startingWorkers = 5;
  assert.deepEqual(json(game.s), before);
  game.start(opts);
  assert.equal(game.alive(e => e.team === 0 && e.type === 'worker').length, 5);
  assert.deepEqual(json(game.s.meta), { startingWorkers: 5 });
  assert.notStrictEqual(game.s.meta, game.profile.upgrades);
  const restarted = json(game.s);
  game.start(opts); assert.deepEqual(json(game.s), restarted);
});

test('starting worker count is an integer bounded to 0–5 even for direct profile input', () => {
  const { game } = createGame();
  for (const [value, count] of [[-2, 0], ['3.9', 3], [99, 5], ['bad', 0]]) {
    game.profile.upgrades = { startingWorkers: value }; game.start({ seed: 90001 });
    assert.equal(game.s.meta.startingWorkers, count);
    assert.equal(game.alive(e => e.team === 0 && e.type === 'worker').length, count);
  }
});

test('five starting workers begin mining and deliver alloy without recruitment for every faction', () => {
  for (const faction of [0, 1, 2]) {
    const { game } = createGame(); game.profile.upgrades = { startingWorkers: 5 };
    game.start({ seed: 1409, faction, biome: 'rust' });
    advance(game, 1200);
    assert.equal(game.alive(e => e.team === 0 && e.type === 'worker').length, 5);
    assert.ok(game.s.alloy > 250); assert.ok(game.s.stats.gathered > 0);
    assert.ok(game.alive(e => e.team === 0 && e.type === 'worker').every(w => w.order.type === 'mine'));
    assert.equal(game.s.gas, 0); assert.equal(player(game, 'hq').queue.length, 0);
    assert.equal(game.canBuild('barracks'), '');
  }
});

test('retired command, resolve and industry upgrades no longer change energy, hull or production and construction rates', () => {
  const { game } = createGame();
  game.profile.upgrades = { command: 3, resolve: 3, industry: 3 };
  game.start({ seed: 1409 });
  assert.deepEqual(json(game.s.meta), {});
  game.s.energy = 0;
  assert.equal(game.train('worker'), true);
  const own = player(game, 'hq'), enemy = game.alive(e => e.team === 1 && e.type === 'hq')[0];
  enemy.queue.push({ type: 'worker', progress: 0, time: 9, cost: 50, gas: 0 });
  game.step(.5);
  close(game.s.energy, .5 * .8);
  for (const b of [own, enemy]) close(b.queue[0].progress, .5 / 9);
  assert.equal(game.spawnUnit('hero', -35, 45, 0, 0).maxHp, 850);
  const foundation = game.spawnBuilding('depot', -35, 40, 0, 0, { progress: .1 }),
    worker = game.spawnUnit('worker', -35, 40, 0, 0);
  foundation.hp = foundation.maxHp * .1;
  worker.x = foundation.x; worker.z = foundation.z;
  game.setOrder(worker, { type: 'build', id: foundation.id });
  game.worker(worker, .5);
  close(foundation.progress, .1 + .5 / 16);
  close(foundation.hp, foundation.maxHp * foundation.progress);
});

test('building repair assigns only the nearest living own worker and repairs through normal travel/work', () => {
  const { game } = battle(), b = player(game, 'barracks'); b.hp -= 100;
  const workers = game.alive(e => e.team === 0 && e.type === 'worker');
  const nearest = [...workers].sort((a, c) => Math.hypot(a.x-b.x,a.z-b.z)-Math.hypot(c.x-b.x,c.z-b.z))[0];
  game.spawnUnit('worker', b.x, b.z, 1, 0); game.spawnUnit('worker', b.x, b.z, 2, 0);
  game.spawnUnit('worker', b.x, b.z, 0, 0).hp = 0;
  const before = new Map(workers.map(w => [w.id, json(w.order)])), alloy = game.s.alloy, x = nearest.x, z = nearest.z;
  assert.equal(game.toggleBuildingRepair(b.id), true);
  assert.deepEqual(Array.from(game.buildingRepairers(b.id), w => w.id), [nearest.id]);
  close(game.s.alloy, alloy); assert.equal(b.hp, b.maxHp - 100);
  for (const w of workers) if (w !== nearest) assert.deepEqual(json(w.order), before.get(w.id));
  advance(game, 500);
  assert.ok(Math.hypot(nearest.x-x,nearest.z-z) > 1, 'worker actually travelled');
  assert.equal(b.hp, b.maxHp); assert.equal(game.buildingRepairers(b.id).length, 0);
});

test('repair toggle stops assigned workers; a dead worker is not automatically replaced', () => {
  const { game } = battle(), b = player(game, 'barracks'); b.hp -= 100;
  game.toggleBuildingRepair(b.id); const w = game.buildingRepairers(b.id)[0];
  assert.equal(game.toggleBuildingRepair(b.id), true);
  assert.equal(w.order.type, 'idle'); assert.equal(game.buildingRepairers(b.id).length, 0);
  game.toggleBuildingRepair(b.id); w.hp = 0;
  advance(game, 5); assert.equal(game.buildingRepairers(b.id).length, 0);
  assert.equal(game.toggleBuildingRepair(b.id), true);
  assert.notEqual(game.buildingRepairers(b.id)[0].id, w.id);
});

test('repair rejects no workers, no alloy, full hull and ineligible targets without changing state', () => {
  for (const mode of ['workers', 'alloy', 'full', 'enemy', 'foundation', 'unit', 'dead', 'result', 'missing']) {
    const { game } = battle(); let b = player(game, 'barracks'); b.hp -= 100;
    if (mode === 'workers') for (const w of game.alive(e => e.team === 0 && e.type === 'worker')) w.hp = 0;
    if (mode === 'alloy') game.s.alloy = .1;
    if (mode === 'full') b.hp = b.maxHp;
    if (mode === 'enemy') b.team = 1;
    if (mode === 'foundation') b.progress = .5;
    if (mode === 'unit') b = player(game, 'hero');
    if (mode === 'dead') b.hp = 0;
    if (mode === 'result') game.s.result = { win: true };
    const id = mode === 'missing' ? -1 : b.id, before = json(game.s);
    assert.ok(game.canRepairBuilding(id), mode);
    assert.equal(game.toggleBuildingRepair(id), false, mode);
    assert.deepEqual(json(game.s), before, mode);
  }
});

test('selling refunds actual paid value and all queued recruitment, removes navigation and stops repairs without combat/RNG effects', () => {
  const { game } = battle(), b = player(game, 'barracks');
  b.paid = { cost: 101, gas: 13 }; b.hp -= 100;
  assert.equal(game.train('rifle'), true); assert.equal(game.train('medic'), true);
  b.queue[0].progress = .8; game.toggleBuildingRepair(b.id);
  const worker = game.buildingRepairers(b.id)[0], count = rifleCount(game), supply = game.supply(), stats = json(game.s.stats);
  const alloy = game.s.alloy, gas = game.s.gas, refund = { cost: 225.5, gas: 41.5 };
  assert.deepEqual(json(game.buildingSaleRefund(b.id)), refund);
  assert.equal(game.world.blockedAt(b.x,b.z), true);
  const random = game.random; game.random = () => { throw Error('Selling must not use RNG'); };
  assert.equal(game.sellBuilding(b.id), true); game.random = random;
  close(game.s.alloy, alloy + refund.cost); close(game.s.gas, gas + refund.gas);
  assert.equal(game.get(b.id), null); assert.equal(b.queue.length, 0); assert.equal(worker.order.type, 'idle');
  assert.equal(game.world.blockedAt(b.x,b.z), false); assert.equal(game.supply(), supply - 4);
  assert.deepEqual(json(game.s.stats), stats);
  const beforeRepeat = json(game.s); assert.equal(game.sellBuilding(b.id), false);
  assert.deepEqual(json(game.s), beforeRepeat);
  advance(game, 300);
  assert.equal(rifleCount(game), count); assert.equal(game.get(b.id), null);
});

test('start structures sell for half their normal cost; supply loss keeps existing troops but blocks new recruitment', () => {
  const { game } = battle(), depot = game.spawnBuilding('depot', -27, 61, 0, 0);
  for (let i = 0; i < 12; i++) game.spawnUnit('rifle', -45, 35, 0, 0);
  const supply = game.supply(), troops = rifleCount(game), cap = game.cap();
  assert.deepEqual(json(game.buildingSaleRefund(depot.id)), { cost: 42.5, gas: 0 });
  assert.equal(game.sellBuilding(depot.id), true);
  assert.equal(game.cap(), cap - 16); assert.equal(game.supply(), supply); assert.equal(rifleCount(game), troops);
  assert.equal(game.train('rifle'), false);
});

test('last completed HQ and ineligible buildings cannot be sold; an unfinished replacement HQ does not remove protection', () => {
  const { game } = battle(), hq = player(game, 'hq');
  const next = game.spawnBuilding('hq', -20, 60, 0, 0, { progress: .5 });
  assert.match(game.canSellBuilding(hq.id), /Last command center/);
  assert.equal(game.sellBuilding(hq.id), false);
  next.progress = 1; assert.equal(game.sellBuilding(hq.id), true);
  assert.match(game.canSellBuilding(next.id), /Last command center/);
  for (const target of [player(game, 'hero'), game.alive(e => e.team === 1 && e.kind === 'building')[0],
    game.spawnBuilding('depot', 0, 0, 0, 0, { progress: .5 }), { id: -1 }]) {
    const before = json(game.s);
    assert.equal(game.sellBuilding(target.id), false); assert.deepEqual(json(game.s), before);
  }
});

test('selling a refinery frees its vent for a new foundation', () => {
  const { game } = battle(), b = player(game, 'refinery'), p = {x:b.x,z:b.z};
  assert.ok(game.canBuild('refinery', p)); assert.equal(game.sellBuilding(b.id), true);
  assert.equal(game.canBuild('refinery', p), '');
});

test('assigned building repair workers finish over uninterrupted simulation steps', () => {
  const { game } = battle(), b = player(game, 'barracks'); b.hp -= 100;
  game.toggleBuildingRepair(b.id); const id = game.buildingRepairers(b.id)[0].id;
  assert.deepEqual(Array.from(game.buildingRepairers(b.id), w => w.id), [id]);
  advance(game, 500); assert.equal(game.get(b.id).hp, b.maxHp);
});

test('commands replace unit orders, ignore enemies and never change building rally points', () => {
  const { game, events } = battle();
  const hero = player(game, 'hero'), barracks = player(game, 'barracks');
  const enemy = game.alive(e => e.team === 1 && e.kind === 'unit')[0];
  const enemyBefore = json(enemy);
  const move = Object.freeze({ type: 'move', x: -10, z: 32 });
  game.command([hero.id, enemy.id, 99999], move);
  assert.deepEqual(json(hero.order), move);
  assert.notStrictEqual(hero.order, move);
  assert.deepEqual(json(enemy), enemyBefore);
  assert.equal(events.find(e => e.type === 'order').data.count, 1);
  hero.path = [{ x: -20, z: 30 }]; hero.pi = 1; hero.target = enemy.id;
  hero.nextPath = 20; hero.stuck = 1;
  game.command([hero.id], { type: 'hold' });
  assert.deepEqual(json(hero.order), { type: 'hold' });
  assert.deepEqual(json(hero.path), []);
  assert.deepEqual([hero.pi, hero.target, hero.nextPath, hero.stuck], [0, null, 0, 0]);
  game.finishOrder(hero);
  assert.deepEqual(json(hero.order), { type: 'idle' });
  assert.deepEqual(json(hero.path), []); assert.equal(hero.pi, 0);
  game.command([hero.id], { type: 'move', x: -15, z: 10 });
  game.command([hero.id], { type: 'stop' });
  assert.deepEqual(json(hero.order), { type: 'stop' });
  assert.equal('orders' in hero, false);
  barracks.rally = { x: 5, z: 6 };
  const before = json(barracks), count = events.length;
  for (const order of [move, {type:'attackMove',x:20,z:30}, {type:'smart',id:hero.id,x:30,z:40}]) {
    game.command([barracks.id], order);
    game.setOrder(barracks, order);
    assert.deepEqual(json(barracks), before);
  }
  assert.equal(events.length, count);
});

test('new construction assigns one worker, pays once and still completes normally', () => {
  const { game, events } = battle();
  const worker = player(game, 'worker'), beforeAlloy = game.s.alloy;
  const cost = game.cost('depot', 'building');
  let built = false;
  for (let z = 30; z < 60 && !built; z += 3) for (let x = -65; x < -25 && !built; x += 3) {
    if (!game.canBuild('depot', { x, z })) built = game.build('depot', { x, z }, [worker.id]);
  }
  assert.equal(built, true);
  const foundation = game.alive(e => e.type === 'depot' && e.progress < 1)[0];
  const builders = game.alive(e => e.order?.type === 'build' && e.order.id === foundation.id);
  assert.deepEqual(Array.from(builders, e => e.id), [worker.id]);
  close(game.s.alloy, beforeAlloy - cost.cost);
  worker.x = foundation.x; worker.z = foundation.z;
  const beforeProgress = foundation.progress, paidAlloy = game.s.alloy;
  game.worker(worker, .5);
  assert.ok(foundation.progress > beforeProgress);
  close(game.s.alloy, paidAlloy);
  foundation.progress = .999; foundation.hp = foundation.maxHp * .999;
  game.worker(worker, 1);
  assert.equal(foundation.progress, 1); assert.equal(foundation.hp, foundation.maxHp);
  assert.equal(worker.order.type, 'idle'); assert.equal(game.s.stats.built, 1);
  assert.equal(events.filter(e => e.type === 'complete' && e.data.type === 'depot').length, 1);
});

test('context and repair orders cannot add builders to unfinished structures', () => {
  const { game } = battle();
  const worker = player(game, 'worker');
  const foundation = game.spawnBuilding('depot', worker.x, worker.z, 0, 0, { progress: .1 });
  foundation.hp = foundation.maxHp * .1;
  const before = [foundation.progress, foundation.hp, game.s.alloy];
  game.command([worker.id], { type: 'smart', id: foundation.id, x: foundation.x, z: foundation.z });
  assert.equal(worker.order.type, 'move');
  game.worker(worker, 1);
  assert.deepEqual([foundation.progress, foundation.hp, game.s.alloy], before);
  game.command([worker.id], { type: 'repair', id: foundation.id });
  game.worker(worker, 1);
  assert.equal(worker.order.type, 'idle');
  assert.deepEqual([foundation.progress, foundation.hp, game.s.alloy], before);
});

test('workers still repair completed damaged structures and units for the same alloy cost', () => {
  for (const kind of ['building', 'unit']) {
    const { game } = battle(); const worker = player(game, 'worker');
    const target = kind === 'building'
      ? game.spawnBuilding('depot', worker.x, worker.z, 0, 0)
      : game.spawnUnit('rifle', worker.x, worker.z, 0, 0);
    target.hp = target.maxHp - 50;
    const alloy = game.s.alloy;
    game.command([worker.id], { type: 'smart', id: target.id, x: target.x, z: target.z });
    assert.equal(worker.order.type, 'repair');
    game.worker(worker, 1);
    close(target.hp, target.maxHp - 12); close(game.s.alloy, alloy - 3.8);
  }
});

for (const [faction, cost] of [[0, 75], [1, 64], [2, 85]]) {
  test(`faction ${faction}: recruitment spends reference cost, reserves supply and refunds cancellation`, () => {
    const { game, events } = battle(faction);
    const barracks = player(game, 'barracks');
    assert.equal(game.train('rifle'), true);
    assert.deepEqual(json(barracks.queue), [{ type: 'rifle', progress: 0, time: 11, cost, gas: 0 }]);
    assert.deepEqual([game.s.alloy, game.s.gas, game.supply(), rifleCount(game)], [1100 - cost, 400, 33, 7]);
    advance(game, 20);
    assert.ok(barracks.queue[0].progress > 0 && barracks.queue[0].progress < 1);
    const beforeCancel = game.s.alloy;
    game.cancelQueue(barracks.id, 0);
    close(game.s.alloy, beforeCancel + cost);
    assert.equal(game.supply(), 31);
    assert.equal(barracks.queue.length, 0);
    assert.ok(events.some(e => e.type === 'queued' && e.data === 'rifle'));
  });
}

for (const [reason, setup] of [
  ['insufficient alloy', game => { game.s.alloy = 74; }],
  ['full production queue', game => { for (let i = 0; i < 5; i++) assert.equal(game.train('rifle'), true); }],
  ['supply limit', game => { for (let i = 0; i < 12; i++) game.spawnUnit('rifle', -45, 35, 0, 0); }],
]) {
  test(`recruitment rejected for ${reason} leaves run state unchanged`, () => {
    const { game, events } = battle();
    setup(game);
    const before = json(game.s);
    assert.equal(game.train('rifle'), false);
    assert.deepEqual(json(game.s), before);
    assert.equal(events.at(-1).type, 'toast');
  });
}

test('available producers preserve entity order and exclude dead, foreign, unfinished and full structures', () => {
  const { game } = createGame();
  const building = (id, extra = {}) => ({
    id, hp: 100, team: 0, kind: 'building', type: 'barracks', progress: 1, queue: [], ...extra
  });
  const a = building(30, { queue: Array.from({ length: 4 }, () => ({ type: 'rifle' })) }),
    b = building(10);
  game.s = { entities: [a, building(2, { hp: 0 }), building(3, { team: 1 }),
    building(4, { team: -1 }), building(5, { kind: 'unit' }),
    building(6, { progress: .99 }), building(7, { queue: Array(5).fill({ type: 'rifle' }) }),
    building(8, { type: 'factory' }), b] };
  game.random = () => { throw Error('Producer lookup must not consume RNG'); };
  const before = json(game.s), producers = game.availableProducers('barracks');
  assert.deepEqual(Array.from(producers, e => e.id), [30, 10]);
  assert.equal(producers[0], a); assert.equal(producers[1], b);
  producers.reverse();
  assert.deepEqual(Array.from(game.availableProducers('barracks'), e => e.id), [30, 10]);
  assert.deepEqual(Array.from(game.availableProducers('factory'), e => e.id), [8]);
  assert.equal(game.availableProducers('hangar').length, 0);
  assert.deepEqual(json(game.s), before);
});

test('recruitment distributes globally and produces in parallel at assigned buildings', () => {
  const {game,events} = battle(), a = player(game,'barracks'),
    b = game.spawnBuilding('barracks',-15,55,0,0),
    unfinished = game.spawnBuilding('barracks',-5,55,0,0);
  unfinished.progress = .5;
  game.s.alloy = 10000; game.s.gas = 10000;
  a.rally = {x:-30,z:40}; b.rally = {x:-5,z:40};
  for (const type of ['rifle','rifle','medic','rifle']) assert.equal(game.train(type), true);
  assert.deepEqual(json(a.queue.map(q=>q.type)), ['rifle','medic']);
  assert.deepEqual(json(b.queue.map(q=>q.type)), ['rifle','rifle']);
  assert.equal(unfinished.queue.length, 0);
  advance(game,40);
  close(a.queue[0].progress,2/11); close(b.queue[0].progress,2/11);
  advance(game,181);
  const trained = events.filter(e=>e.type==='trained').map(e=>e.data);
  assert.equal(trained.length, 2);
  for (const [i,e] of trained.entries()) {
    assert.equal(e.exit.building,[a.id,b.id][i]);
    assert.ok(Math.hypot(e.x-[a,b][i].x,e.z-[a,b][i].z)<1);
    assert.ok(Math.hypot(e.exit.x-[a,b][i].x,e.exit.z-[a,b][i].z)>[a,b][i].size);
    assert.deepEqual(e.order,{type:'attackMove',...[a.rally,b.rally][i]});
  }
  assert.deepEqual(json(game.get(a.id).queue.map(q=>q.type)), ['medic']);
  assert.deepEqual(json(game.get(b.id).queue.map(q=>q.type)), ['rifle']);
});

test('removed scout cannot be recruited and no faction starts or deploys it in waves', () => {
  for (const faction of [0,1,2]) {
    const {game} = createGame(); game.start({seed:1409,faction,enemy:faction});
    const before = json(game.s);
    assert.equal(game.train('scout'), false); assert.deepEqual(json(game.s), before);
    for (let i=0;i<4;i++) {game.s.enemyBudget=10000;game.wave();}
    assert.ok(game.s.entities.every(e => e.type !== 'scout'));
  }
});

test('fixed steps finish production once, retain reserved supply and account only for mining and refinery income', () => {
  const { game, events } = battle();
  const barracks = player(game, 'barracks');
  barracks.rally = { x: -35, z: 48 };
  assert.equal(game.train('rifle'), true);
  advance(game, 200);
  assert.equal(rifleCount(game), 7);
  close(barracks.queue[0].progress, 10 / 11);
  advance(game, 21);
  assert.equal(barracks.queue.length, 0);
  assert.equal(rifleCount(game), 8);
  assert.equal(game.supply(), 33);
  assert.equal(game.s.stats.trained, 1);
  const trained = events.filter(e => e.type === 'trained');
  assert.equal(trained.length, 1);
  assert.deepEqual(trained[0].data.order, { type: 'attackMove', x: -35, z: 48 });
  assert.equal(game.get(trained[0].data.id).type, 'rifle');
  assert.ok(game.s.stats.gathered > 0, 'workers actually delivered alloy');
  close(game.s.alloy, 1100 - 75 + game.s.stats.gathered);
  close(game.s.gas, 400 + 11.05 * 1.7);
});

for (const [kind, energy, cooldown] of [
  ['orbital', 85, 48], ['repair', 45, 28], ['scan', 25, 17], ['drop', 95, 75]
]) test(`ability ${kind} retains energy threshold, exact payment and cooldown`, () => {
  const { game } = freshBattle();
  game.s.time = 10;
  game.world.explored.fill(1);
  const target = { x: 0, z: 0 };
  game.s.energy = energy - 1;
  const before = json(game.s);
  assert.equal(game.ability(kind, target), false);
  assert.deepEqual(json(game.s), before);
  game.s.energy = energy;
  assert.equal(game.ability(kind, target), true);
  assert.equal(game.s.energy, 0);
  assert.equal(game.s.abilities[kind], 10 + cooldown);
  game.s.energy = 100;
  const recharging = json(game.s);
  assert.equal(game.ability(kind, target), false);
  assert.deepEqual(json(game.s), recharging);
  game.s.time = 10 + cooldown;
  assert.equal(game.ability(kind, target), true);
  assert.equal(game.s.energy, 100 - energy);
});

test('restarting discards the previous run and rebuilds fresh navigation, indexes and fog', () => {
  const {game,renderer,events}=battle();
  const hero=player(game,'hero'); game.command([hero.id],{type:'move',x:-10,z:32});
  game.train('rifle'); game.ability('scan',{x:20,z:-20}); advance(game,100);
  game.s.cam={x:-42,z:40,zoom:64};
  const old=game.s, oldWorld=game.world, hq=player(game,'hq');
  game.damage(hq,999999,null,true); game.objectiveTick(.2); assert.equal(game.s.result.win,false);
  events.length=0;
  game.start({seed:1409,biome:'rust',faction:0});
  assert.notStrictEqual(game.s,old); assert.notStrictEqual(game.world,oldWorld);
  assert.deepEqual(json(game.s),json(freshBattle().game.s));
  for(const e of game.s.entities)assert.strictEqual(game.get(e.id),e);
  const freshHQ=player(game,'hq'), cell=game.world.idx(freshHQ.x,freshHQ.z);
  assert.equal(game.world.staticGrid[cell],0); assert.equal(game.world.blocked[cell],1);
  assert.ok(game.near(freshHQ.x,freshHQ.z,3).includes(freshHQ));
  assert.deepEqual(Array.from(renderer.fogPixels),Array.from(game.world.fogPixels));
  assert.equal(renderer.fogOn,true); assert.deepEqual(events.map(e=>e.type),['start','radio']);
  assert.equal(game.effects.fx.length,0);
});
