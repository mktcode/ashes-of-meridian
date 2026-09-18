// CPU tests with fixed start expectations and uninterrupted run scenarios.
// Scope: docs/reference-tests.md.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS, readScripts, loadScripts } = require('./helpers/game-scripts.cjs');
const { populateBase } = require('./helpers/populated-battle.cjs');

const scripts = readScripts();
// Normalize VM prototypes when comparing state in tests; no runtime save API.
const json = value => JSON.parse(JSON.stringify(value));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≈ ${expected}`);

function createGame(fixedStarts = false) {
  const context = loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'effects', ...SIMULATION_SCRIPTS], {
    scripts, globals: { structuredClone },
  });
  vm.runInContext('Math.random = () => { throw Error("Unexpected unseeded randomness in simulation test"); }', context);
  const MeridianGame = vm.runInContext('MeridianGame', context);
  const events = [];
  const game = new MeridianGame({ upgrades: {} }, (type, data) => {
    events.push({ type, data: json(data) });
  });
  // Unit-rule scenarios isolate the controller; autonomous play lives in the AI suite.
  game.aiTick = () => {};
  // Fixed-location economy/crowd arenas are not tests of the randomized start controller.
  if (fixedStarts) game.startingPositions = () => [game.world.layout.playerStart, game.world.layout.enemySites[0]];
  return { game, events, context };
}

function freshBattle(faction = 0, seed = 1409) {
  const runtime = createGame(true);
  runtime.game.start({ seed, map: 'desert', faction });
  return runtime;
}

// Production, repair and crowd tests explicitly need a developed base, not a fresh start.
function battle(faction = 0, seed = 1409) {
  const runtime = freshBattle(faction, seed);
  populateBase(runtime.game);
  // Explicit developed opponent fixture, not a privileged live starting loadout.
  const g=runtime.game, h=g.alive(e=>e.team===1&&e.type==='hq')[0];
  for (const [type,x,z] of [['turret',-6,7],['turret',7,4],['barracks',-10,-1],['factory',7,-8]])
    g.spawnBuilding(type,h.x+x,h.z+z,1,h.faction);
  for(let i=0;i<7;i++) g.spawnUnit(i===6?'tank':i===5?'artillery':'rifle',h.x-8+(i%4)*3,h.z+12+Math.floor(i/4)*2,1,h.faction);
  g.world.rebuild(g.s.entities);g.rehash();
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

for (const map of ['mothership', 'desert', 'alien-planet']) for (const count of [3, 4])
test(`internal ${count}-party scenario on ${map}: FFA starts, resource access and explicit stop without expedition result`, () => {
  const { game, events } = createGame(), options = {
    seed: 1409, map, duration: .1,
    parties: Array.from({ length: count }, (_, id) => ({ faction: id % 3, controller: id === 2 ? 'ai' : 'human', benefits: { pioneerSquad: 1 } })),
    hostilities: Array.from({ length: count }, (_, a) => Array.from({ length: count }, (_, b) => a !== b))
  };
  const profile = json(game.profile), dispatched = [];
  game.aiTick = team => dispatched.push(team);
  game.startScenario(options);
  assert.equal(events.length, 0, 'no start/radio/result UI flow');
  assert.equal(game.s.parties.length, count); assert.equal(game.world.sight.length, count);
  const bases = game.alive(e => e.type === 'hq');
  assert.equal(bases.length, count);
  assert.equal(new Set(bases.map(e => `${e.x}/${e.z}`)).size, count);
  for (let team = 0; team < count; team++) {
    const workers = game.alive(e => e.team === team && e.type === 'worker');
    assert.equal(workers.length, 1);
    const worker = workers[0], home = bases.find(e => e.team === team);
    assert.ok(game.unitFits(worker, worker.x, worker.z), `party ${team}: free worker placement`);
    const resource = game.miningResource(worker);
    assert.ok(resource && game.canSee(team, resource), `party ${team}: visible starting alloy`);
    const mining = game.workerMiningPoint(worker, resource), dropoff = game.workerDropoff(worker, home);
    for (const [from, to] of [[worker, mining], [mining, dropoff]]) {
      const path = game.world.path(from.x, from.z, to.x, to.z);
      assert.equal(path.status, 'complete', `party ${team}: alloy route`);
      assert.ok(Math.hypot(path.goal.x - to.x, path.goal.z - to.z) <= game.world.cellSize,
        `party ${team}: route reaches service point`);
    }
    for (let other = 0; other < count; other++)
      assert.equal(game.enemy({ team }, { team: other }), team !== other);
    assert.equal(game.account(team).alloy, 250);
  }
  const setup = json(game.s), nextRandom = game.random();
  game.startScenario(options);
  assert.deepEqual(json(game.s), setup); assert.equal(game.random(), nextRandom);
  // Loss of either former single-player HQ cannot silently end this scenario.
  for (const e of game.alive(e => e.type === 'hq' && e.team < 2)) { e.hp = 0; e.deathAt = 0; }
  game.checkBattleResult(); assert.equal(game.s.result, null);
  game.step(.05); game.step(.05);
  assert.deepEqual(dispatched, [2, 2]); assert.equal(game.s.stopped, true);
  assert.equal(game.s.time, .1); assert.equal(game.s.result, null);
  const stopped = json(game.s); game.step(.05); assert.deepEqual(json(game.s), stopped);
  assert.equal(events.some(e => e.type === 'result'), false);
  assert.deepEqual(json(game.profile), profile);
  game.start({ seed: 1409, map });
  assert.equal(game.s.parties.length, 2); assert.equal(game.world.sight.length, 2);
  assert.equal(game.s.stopped, false); assert.equal(game.s.rules.kind, 'single-player');
});

test('larger map supports outer-area spawns, paid construction, production, commands and restart', () => {
  const {game,context}=createGame(true);
  vm.runInContext(`BATTLEFIELDS['alien-planet'].size={extent:135,cellSize:2.5};
    BATTLEFIELDS['alien-planet'].layout.playerStart={x:-111,z:109};
    BATTLEFIELDS['alien-planet'].layout.startSites[0]={x:-111,z:109};
    BATTLEFIELDS['alien-planet'].layout.resourceSites[0]={x:-118,z:88};`,context);
  game.start({seed:43015,map:'alien-planet'});
  assert.deepEqual([player(game,'hq').x,player(game,'hq').z],[-111,109]);
  assert.equal(game.s.cam.x,-106);assert.equal(game.world.gridSize,108);
  game.world.staticGrid.fill(0);game.world.rebuild(game.s.entities);
  game.world.reveal(game.s.entities,[{x:110,z:105,r:31}]);
  game.account(0).alloy=1000;
  const worker=game.spawnUnit('worker',110,110,0,0);assert.ok(worker);
  assert.deepEqual([worker.x,worker.z],[110,110]);
  assert.match(game.canBuild('barracks',{x:134,z:105}),/boundary/);
  assert.equal(game.canBuild('barracks',{x:110,z:95}),'');
  const before=game.account(0).alloy, cost=game.cost('barracks','building').cost;
  assert.equal(game.build('barracks',{x:110,z:95},[worker.id]),true);
  assert.equal(game.account(0).alloy,before-cost);
  advance(game,1600);
  const barracks=player(game,'barracks');assert.equal(barracks.progress,1);
  assert.equal(game.train('rifle'),true);advance(game,600);
  const rifle=player(game,'rifle');assert.ok(rifle);assert.ok(rifle.x>90 && rifle.z>85);
  assert.equal(rifle.exit,undefined);
  game.command([rifle.id],{type:'move',x:120,z:115});advance(game,200);
  assert.ok(Math.hypot(rifle.x-120,rifle.z-115)<2);
  assert.equal(game.unitFits(rifle,131,115),false);
  const air=game.spawnUnit('air',120,-120,0,0);assert.ok(air);
  game.pathTo(air,{x:999,z:-999});assert.deepEqual(json(air.path),[{x:130,z:-130}]);
  for(const map of ['desert','alien-planet','mothership']) {
    game.start({seed:43015,map});assert.equal(game.world.gridSize,map==='alien-planet'?108:72);
    assert.ok(game.world.visible.includes(255));
  }
});

test('spatial queries retain stable order without row aliases on large maps or wide scans', () => {
  const {game,context}=createGame();
  vm.runInContext("BATTLEFIELDS['alien-planet'].size={extent:180,cellSize:2.5}",context);
  game.start({seed:43015,map:'alien-planet'});
  game.s.entities=[];game.ids.clear();game.world.staticGrid.fill(0);game.world.rebuild([]);
  const units=[[-170,-160],[150,-170],[120,110],[-100,100]].map(([x,z])=>game.spawnUnit('rifle',x,z,0,0));
  game.rehash();
  for(const u of units) assert.deepEqual(Array.from(game.near(u.x,u.z,5),e=>e.id),[u.id]);
  const ids=Array.from(game.near(0,0,600),e=>e.id);
  assert.deepEqual(ids,[units[1].id,units[0].id,units[3].id,units[2].id]);
  assert.equal(new Set(ids).size,units.length);
});

test('starts without a supplied seed draw a fresh random battlefield each time', () => {
  const { game, context } = createGame();
  vm.runInContext(`const samples = [.12345678, .87654321]; Math.random = () => {
    if (!samples.length) throw Error('Unexpected extra seed draw');
    return samples.shift();
  }`, context);
  for (const expected of [12345678, 87654321]) {
    const previous = game.world;
    game.start({ faction: 1, enemy: 2, map: 'desert' });
    assert.equal(game.s.seed, expected); assert.equal(game.world.seed, expected);
    assert.notStrictEqual(game.world, previous);
    assert.deepEqual([game.s.parties[0].faction, game.s.parties[1].faction, game.s.map], [1, 2, 'desert']);
  }
  game.start({ seed: 1409 }); // Internal deterministic scenarios still bypass the random draw.
  assert.equal(game.s.seed, 1409);
  assert.equal(game.s.map, 'desert', 'default map keeps the first catalog entry');
});

test('seeded starts use distinct corners, keep replay/RNG contracts and allow every ordered corner pair', () => {
  const {game}=createGame(), pairs=new Set();
  for (const map of ['desert','alien-planet','mothership']) {
    for (const seed of [1,2,3,4,5,6,7,8,9,10,1409,2219,24080]) {
      game.profile.upgrades={startingWorkers:5};
      const options={seed,map,benefits:{pioneerSquad:5,commanderMandate:1}};
      game.start(options);
      const sites=game.world.startSites, bases=[player(game,'hq'),game.alive(e=>e.team===1&&e.type==='hq')[0]];
      const indices=bases.map(b=>sites.findIndex(p=>p.x===b.x&&p.z===b.z));
      assert.ok(indices.every(i=>i>=0));assert.notEqual(indices[0],indices[1]);
      assert.deepEqual(json(game.s.cam),{x:bases[0].x+5,z:bases[0].z-2,zoom:57});
      assert.equal(game.canSee(0,bases[1]),false);assert.equal(game.canSee(1,bases[0]),false);
      for(const team of [0,1]) assert.ok(game.alive(e=>e.type==='crystal').some(e=>game.canSee(team,e)), 'starting minerals visible');
      assertUnitSpacing(game);
      for(const u of game.alive(e=>e.kind==='unit')) assert.ok(game.unitFits(u,u.x,u.z));
      const before=json(game.s), terrain=Array.from(game.world.staticGrid), next=game.random();
      game.start(options);assert.deepEqual(json(game.s),before);assert.equal(game.random(),next);
      const choose=game.startingPositions;
      game.startingPositions=()=>game.world.startSites.slice(0,2);
      game.start(options);game.startingPositions=choose;
      assert.equal(game.random(),next,'corner choice must not advance simulation RNG');
      assert.deepEqual(Array.from(game.world.staticGrid),terrain);
      assert.deepEqual(json(game.s.entities.filter(e=>e.kind==='resource')),before.entities.filter(e=>e.kind==='resource'));
    }
  }
  for(let seed=1;seed<=200;seed++) {
    const sites=game.startingPositions(seed);
    pairs.add(sites.map(p=>game.world.startSites.indexOf(p)).join('/'));
  }
  assert.equal(pairs.size,12,'all four player corners and all three remaining enemy corners');
});

test('single battle starts with only the own HQ, one hostile base and no mission state', () => {
  const { game, events } = freshBattle(), s = game.s;
  assert.deepEqual([s.seed,s.map,s.parties[0].faction,s.parties[1].faction,s.time], [1409,'desert',0,2,0]);
  assert.equal('version' in s, false); assert.equal(game.snapshot, undefined); assert.equal(game.restore, undefined);
  assert.deepEqual([s.parties[0].account.alloy,s.parties[0].account.gas,s.parties[0].account.energy,s.entities.length,s.nextId,game.supply(),game.cap()], [250,0,25,50,51,0,24]);
  assert.equal(game.alive(e => e.team === 1 && e.type === 'hq').length, 1);
  assert.deepEqual(Array.from(game.alive(e => e.team === 0), e => e.type), ['hq']);
  assert.ok(s.entities.every(e => ['unit','building','resource'].includes(e.kind)));
  for (const key of ['m','index','practice','upgrades','research','difficulty']) assert.equal(key in s, false);
  assert.deepEqual(events.map(e => e.type), ['start','radio']);
});

test('no workers means no alloy or aether income, and 250 alloy buys exactly five workers for every faction', () => {
  for(const faction of [0,1,2]) {
    const {game}=freshBattle(faction);
    assert.deepEqual(json(game.cost('worker')),{cost:50,gas:0});
    advance(game,1200);
    assert.deepEqual([game.s.parties[0].account.alloy,game.s.parties[0].account.gas,game.s.stats.gathered],[250,0,0]);
    for(let i=0;i<5;i++)assert.equal(game.train('worker'),true);
    assert.deepEqual([game.s.parties[0].account.alloy,game.s.parties[0].account.gas,game.supply(),player(game,'hq').queue.length],[0,0,5,5]);
    assert.equal(game.train('worker'),false);
  }
});

test('the first worker must be paid for and recruited, then enables mining and the first new building', () => {
  for (const faction of [0,1,2]) {
    const {game}=freshBattle(faction);
    advance(game,40);
    assert.deepEqual(Array.from(game.alive(e=>e.team===0),e=>e.type),['hq']);
    assert.match(game.canBuild('barracks'),/Recruit a worker/);
    const before=game.s.parties[0].account.alloy, cost=game.cost('worker');
    assert.equal(game.train('worker'),true); close(game.s.parties[0].account.alloy,before-cost.cost);
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

test('fresh starts with the same seed reproduce state; another seed changes resource amounts', () => {
  const a = freshBattle().game, b = freshBattle().game, other = freshBattle(0, 1410).game;
  assert.deepEqual(json(a.s), json(b.s));
  assert.deepEqual(Array.from(a.world.explored),Array.from(b.world.explored));
  assert.notDeepEqual(json(a.alive(e => e.type === 'crystal').map(e => e.amount)), json(other.alive(e => e.type === 'crystal').map(e => e.amount)));
});

test('battle starts cover every faction and map with valid entities', () => {
  const { game, context } = createGame(), maps = vm.runInContext('BATTLEFIELDS', context);
  // Maps change presentation, not faction rules: no redundant faction/map cross-product.
  for (const [faction, map] of [[0,'desert'],[1,'alien-planet'],[2,'mothership']]) {
    game.start({ seed: 1409, faction, enemy: faction, map });
    assert.deepEqual(Array.from(game.alive(e => e.team === 0), e => e.type), ['hq']);
    advance(game, 2);
    assert.deepEqual(Array.from(game.alive(e => e.team === 0), e => e.type), ['hq']);
    assert.equal(game.s.map, map); assert.equal(game.s.parties[1].faction, faction);
    assert.strictEqual(game.world.definition, maps[map], 'resolve each ID rather than silently falling back');
    assert.ok(game.alive(e => e.team === 1).every(e => e.faction === faction));
    assert.ok(game.s.entities.every(e => Number.isFinite(e.hp) && e.hp > 0));
    assert.equal('m' in game.s, false); assert.equal('research' in game.s, false);
  }
});

test('mothership alone retains its timed eruption after map display names change', () => {
  const { game, context } = createGame(), maps = vm.runInContext('BATTLEFIELDS', context);
  for (const b of Object.values(maps)) b.name = 'Same revised environment';
  for (const map of Object.keys(maps)) {
    game.start({ seed: 1409, map });
    game.spawnUnit('rifle', -40, 40, 0, 0);
    game.s.parties.forEach(p => { p.controller = { kind: 'human' }; });
    game.s.time = 151;
    advance(game, 1);
    const flares = game.s.strikes.filter(s => s.type === 'flare');
    assert.equal(flares.length, map === 'mothership' ? 1 : 0);
    if (flares.length) assert.deepEqual([flares[0].radius, flares[0].damage, flares[0].team], [8, 120, -1]);
  }
});

test('map layouts supply candidate spawns, resources, camera and unexplored AI scan/scout goals', () => {
  const { game, context } = createGame(), maps = vm.runInContext('BATTLEFIELDS', context);
  const desertBefore = json(maps.desert.layout), layout = maps.mothership.layout;
  layout.startSites[2] = { x: -34, z: -56 };
  layout.playerStart = { x: -45, z: 45 };
  layout.enemySites[0] = { x: 45, z: -45 };
  layout.resourceSites[0] = { x: -65, z: 35 };
  game.start({ seed: 1409, map: 'mothership' });
  assert.strictEqual(game.world.layout, layout);
  assert.deepEqual(json(game.s.cam), { x: -29, z: -58, zoom: 57 });
  for (const [team, site] of [[0, layout.startSites[2]], [1, game.world.startSites[0]]]) {
    const hq = game.alive(e => e.team === team && e.type === 'hq')[0];
    assert.deepEqual({ x: hq.x, z: hq.z }, json(site));
  }
  const crystal = game.alive(e => e.type === 'crystal')[0];
  assert.deepEqual({ x: crystal.x, z: crystal.z }, { x: -65, z: 38 });
  const vent = game.alive(e => e.type === 'gas')[0];
  assert.deepEqual({ x: vent.x, z: vent.z }, { x: -60, z: 53 });
  const scans = [], orders = [];
  game.ability = (kind, p, team) => scans.push([kind, json(p), team]);
  game.aiOrder = (team, units, p) => orders.push([team, units.map(e => e.id), json(p)]);
  game.canSee = () => false;
  game.s.time = 61;
  for (const team of [0, 1]) {
    game.enableAI(team);
    const home = game.alive(e => e.team === team && e.type === 'hq')[0];
    const own = [home, game.spawn('unit', 'rifle', home.x + 10, home.z, team),
      game.spawn('unit', 'rifle', home.x + 12, home.z, team)];
    game.world.sight[team].explored.fill(0);
    game.aiStrategy(team, own, [], home);
    game.aiAbilities(team, own, [], home);
    const goal = json(game.aiScoutGoal(team, home));
    assert.ok(orders.some(([t, ids, p]) => t === team && ids[0] === own[1].id && p.x === goal.x && p.z === goal.z));
    assert.deepEqual(scans.at(-1), ['scan', goal, team]);
  }
  assert.deepEqual(json(maps.desert.layout), desertBefore, 'editing one layout cannot mutate another map');
});

test('world events follow the map definition, not its ID', () => {
  const { game, context } = createGame(), maps = vm.runInContext('BATTLEFIELDS', context);
  maps.desert.worldEvent = 'solarFlare'; maps.mothership.worldEvent = null;
  for (const map of ['desert', 'mothership']) {
    game.start({ seed: 1409, map }); game.s.parties.forEach(p => { p.controller = { kind: 'human' }; });
    game.spawnUnit('rifle', -40, 40, 0, 0);
    game.s.time = 151; advance(game, 1);
    assert.equal(game.s.strikes.filter(s => s.type === 'flare').length, map === 'desert' ? 1 : 0);
  }
});

test('unknown structures cannot be built or spend resources', () => {
  const { game } = battle(), before = json(game.s);
  assert.match(game.canBuild('unknown-structure'), /Unknown structure/);
  assert.equal(game.build('unknown-structure', { x: -30, z: 40 }), false);
  assert.deepEqual(json(game.s), before);
});

test('only enemy HQ destruction wins; loss of the last own HQ loses, without stars or rewards', () => {
  for (const win of [true,false]) {
    const { game, events } = battle();
    game.s.time = 3600; game.checkBattleResult(); assert.equal(game.s.result, null);
    const hq = game.alive(e => e.type === 'hq' && e.team === (win ? 1 : 0))[0];
    game.damage(hq, 999999, null, true); game.checkBattleResult();
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
  game.world.visible[game.world.idx(enemy.x,enemy.z)] = 255;
  game.command([rifle.id], {type:'smart',id:enemy.id,x:enemy.x,z:enemy.z});
  assert.equal(rifle.order.type,'attack'); assert.equal(rifle.order.id,enemy.id);
});

test('populated army fixtures and two minutes of mining and combat keep unit spacing', () => {
  for (const [faction,seed,map] of [[0,1409,'desert'],[1,7012,'desert'],[2,9017,'alien-planet'],[0,43015,'mothership']]) {
    const { game } = createGame(true); game.start({faction,seed,map}); populateBase(game); assertUnitSpacing(game);
    if (seed !== 1409) continue;
    for (let i=0;i<2400;i++) {
      game.step(.05); game.effects.tick(.05);
      if (i%20===0) assertUnitSpacing(game);
    }
    assertUnitSpacing(game); assert.ok(game.s.stats.gathered>0);
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
  game.yieldUnitSpace(mover,.22,0); assert.ok(other.yieldTo.z<0, 'the open lane side remains usable');
  delete other.yieldTo; other.yieldUntil=0; game.world.blockedAt=blockedAt;
  other.team=1; game.yieldUnitSpace(mover,.22,0); assert.equal(other.yieldTo,undefined);
  other.team=0; other.order={type:'hold'}; game.yieldUnitSpace(mover,.22,0); assert.equal(other.yieldTo,undefined);
  other.order={type:'idle'}; game.random=()=>.5;
  const blocker=game.spawnUnit('rifle',2,1.9,0,0); blocker.order={type:'hold'};
  game.yieldUnitSpace(mover,.22,0); assert.ok(other.yieldTo.z<0); assert.equal(blocker.z,1.9);
  delete other.yieldTo; other.yieldUntil=0; blocker.hp=0; game.yieldUnitSpace(mover,.22,0);
  for(let i=0;i<100;i++) {
    game.s.time+=.05; game.move(mover,{x:6,z:0},.05);
    if(other.yieldTo) game.moveYield(other,.05);
    // The mover may curve around it, but must not carry it down the route.
    assert.ok(Math.abs(other.x-2)<.5); assertUnitSpacing(game);
  }
  assert.ok(mover.x>5); assert.ok(other.z>0 && other.z<2);
});

test('local steering tries the open side when a unit and terrain seal its preferred side', () => {
  const game=spacingArena();
  game.s.entities=[]; game.ids.clear(); game.world.staticGrid.fill(0); game.world.rebuild([]);
  const mover=game.spawnUnit('rifle',0,0,0,0), blocker=game.spawnUnit('rifle',0,2,1,1);
  assert.ok(mover && blocker);
  game.world.blockedAt=(x,z)=>x<0;
  mover.order={type:'move',x:0,z:10}; mover.path=[{x:0,z:10}];
  mover.pathVersion=game.world.pathVersion; mover.nextPath=Infinity;
  for(let i=0;i<10&&mover.x===0;i++) { game.s.time+=.05; game.move(mover,mover.order,.05); }
  assert.ok(mover.x>0,JSON.stringify({mover:{x:mover.x,z:mover.z,stuck:mover.stuck,path:mover.path},blocker:{x:blocker.x,z:blocker.z}}));
  assert.ok(mover.z>=0);
});

test('a ground formation clears a mothership hangar corner without losing its orders', () => {
  const { game } = createGame(true);
  game.start({seed:1409,map:'mothership',faction:0});
  game.s.entities=[]; game.ids.clear();
  game.spawnBuilding('hq',0,-75,0,0); game.spawnBuilding('hq',0,75,1,1);
  game.world.rebuild(game.s.entities); game.rehash();
  const units=[];
  for(let i=0;i<24;i++) {
    const e=game.spawnUnit(i%5===0?'tank':'rifle',-58+(i%6)*3,-27-Math.floor(i/6)*3,0,0);
    assert.ok(e); units.push(e);
  }
  game.command(units.map(e=>e.id),{type:'move',x:-35,z:28});
  const goals=units.map(e=>json(e.order));
  advance(game,1200);
  for(let i=0;i<units.length;i++) {
    assert.equal(units[i].order.type,'idle',JSON.stringify({unit:{id:units[i].id,type:units[i].type,
      x:units[i].x,z:units[i].z,order:units[i].order,path:units[i].path,pi:units[i].pi,
      nextPath:units[i].nextPath,stuck:units[i].stuck},formation:units.map(e=>({id:e.id,type:e.type,x:e.x,z:e.z,order:e.order}))}));
    assert.ok(Math.hypot(units[i].x-goals[i].x,units[i].z-goals[i].z)<6,
      JSON.stringify({id:units[i].id,type:units[i].type,x:units[i].x,z:units[i].z,goal:goals[i]}));
  }
  assertUnitSpacing(game);
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

test('foundations reject live unit bodies and production exits but ignore dead units', () => {
  const { game } = freshBattle();
  game.s.entities = [];
  game.ids.clear();
  game.world.staticGrid.fill(0);
  game.world.rebuild([]);
  game.world.sight[0].explored.fill(255);
  const worker = game.spawnUnit('worker', -20, -20, 0, 0), unit = game.spawnUnit('rifle', 0, 0, 1, 1);
  assert.ok(worker && unit);
  for (const type of ['depot', 'barracks']) {
    assert.match(game.canBuild(type, { x: unit.x, z: unit.z }), /units and production exits/);
    assert.equal(game.build(type, { x: unit.x, z: unit.z }, [worker.id]), false);
  }
  unit.hp = 0;
  assert.equal(game.canBuild('depot', { x: 0, z: 0 }), '');
  unit.hp = unit.maxHp;
  Object.assign(unit, { x: 20, z: 20, exit: { building: 99, x: 0, z: 0, length: 30 } });
  assert.match(game.canBuild('depot', { x: 0, z: 0 }), /production exits/);
  unit.exit = undefined;
  assert.equal(game.canBuild('depot', { x: 0, z: 0 }), '');
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

test('workers use distributed near-side mining and HQ service points without queueing at one point', () => {
  const game=spacingArena();
  game.s.entities=[]; game.ids.clear(); game.world.staticGrid.fill(0);
  const hq=game.spawnBuilding('hq',0,0,0,0), enemy=game.spawnBuilding('hq',60,60,1,1),
    node=game.spawnResource('crystal',-25,0,1000), workers=[];
  assert.ok(hq && enemy && node); game.world.rebuild(game.s.entities);
  for(let i=0;i<8;i++) {
    const w=game.spawnUnit('worker',-17-(i%2)*2,(i-3.5)*2,0,0);
    assert.ok(w); w.order={type:'mine',id:node.id}; w.carry=18; w.returning=true; workers.push(w);
  }
  const dropoffs=workers.map(w=>game.workerDropoff(w,hq)), miningPoints=workers.map(w=>game.workerMiningPoint(w,node));
  assert.equal(new Set(dropoffs.map(p=>`${p.x.toFixed(3)}/${p.z.toFixed(3)}`)).size,3);
  assert.equal(new Set(miningPoints.map(p=>`${p.x.toFixed(3)}/${p.z.toFixed(3)}`)).size,3);
  assert.ok(dropoffs.every(p=>p.x<=0&&Math.hypot(p.x-hq.x,p.z-hq.z)<hq.size+3.1),JSON.stringify(dropoffs));
  assert.ok(miningPoints.every(p=>p.x>-25&&Math.hypot(p.x-node.x,p.z-node.z)<2.15));
  const delivered=new Set();
  for(let i=0;i<400&&delivered.size<workers.length;i++) {
    const before=workers.map(w=>w.carry); game.step(.05); game.effects.tick(.05);
    workers.forEach((w,j)=>{if(before[j]>0&&w.carry===0)delivered.add(w.id);});
    if(i%20===0)assertUnitSpacing(game);
  }
  assert.equal(delivered.size,workers.length); assert.ok(game.s.stats.gathered>=workers.length*18);
  assertUnitSpacing(game);
});

for (const [seed,map,faction,count,forced] of [
  [1409,'desert',0,8,false], [7012,'desert',1,12,false], [9017,'alien-planet',2,12,false], [1409,'desert',0,8,true]
]) test(`worker traffic stays productive for six minutes: ${seed}/${faction}/${count}, forced node ${forced}`, () => {
  const {game}=createGame(true);
  game.start({seed,map,faction}); populateBase(game,count); game.s.parties.forEach(p => { p.controller = { kind: 'human' }; });
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
    game.s.parties[0].account.alloy=10000; game.s.parties[0].account.gas=10000;
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

test('attack-move closes to firing range against buildings and units on both teams', () => {
  for (const team of [0, 1]) for (const type of ['rifle', 'tank', 'artillery']) {
    for (const kind of ['building', 'unit']) {
      const game = spacingArena();
      game.s.parties.forEach(p => { p.controller = { kind: 'human' }; });
      const target = kind === 'building'
        ? game.spawnBuilding('hq', 0, 0, 1 - team, 0)
        : game.spawnUnit('tank', 0, 0, 1 - team, 0);
      target.order = { type: 'move', x: 0, z: 0 };
      target.cd = 1000;
      const attacker = game.spawnUnit(type, 30, 0, team, 0);
      attacker.order = { type: 'attackMove', x: -10, z: 0 };
      game.world.rebuild(game.s.entities);
      // Isolate range/movement, not fog updates or return fire.
      game.world.reveal = () => game.world.sight.forEach(view=>view.visible.fill(255));
      game.world.reveal();
      advance(game, 400);
      assert.ok(target.hp < target.maxHp, `${team}/${type}/${kind} must reach firing range`);
      assertUnitSpacing(game);
    }
  }
});

test('ordinary move can retreat from an enemy without switching to combat pursuit', () => {
  const game = spacingArena();
  const unit = game.spawnUnit('rifle', 0, 0, 0, 0);
  const enemy = game.spawnUnit('tank', -6, 0, 1, 0);
  enemy.order = { type: 'hold' }; enemy.cd = 1000;
  game.world.visible.fill(255);
  game.command([unit.id], { type: 'move', x: 20, z: 0 });
  advance(game, 120);
  assert.ok(unit.x > 19);
  assert.equal(unit.order.type, 'idle');
  assertUnitSpacing(game);
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
  const gas = game.s.parties[0].account.gas; advance(game, 1);
  close(game.s.parties[0].account.gas, gas + .05 * 1.7);
  for (const troop of troops) close(troop.hp, troop.maxHp - 50 + (troop.faction === 1 ? 2.1 * .05 : 0));
});

test('starting alloy levels 0–5 add exactly 50 alloy per level without changing seeded setup', () => {
  const { game } = createGame(), opts = { seed: 1409, faction: 0, map: 'desert' };
  game.start(opts);
  const original = json(game.s.entities), terrain = Array.from(game.world.staticGrid), nextRandom = game.random();
  for (let level = 0; level <= 5; level++) {
    game.profile.upgrades = { startingAlloy: level };
    game.start(opts);
    assert.deepEqual([game.s.parties[0].account.alloy, game.s.parties[0].account.gas, game.s.parties[0].meta.startingAlloy], [250 + level * 50, 0, level]);
    assert.deepEqual(json(game.s.entities), original);
    assert.deepEqual(Array.from(game.world.staticGrid), terrain);
    assert.equal(game.random(), nextRandom, 'starting alloy consumes no simulation RNG');
  }
});

test('starting alloy affects only the next battle, is bounded and reproduces on restart', () => {
  const { game } = createGame(), opts = { seed: 9897, faction: 1, map: 'desert' };
  game.profile.upgrades = { startingAlloy: 2 }; game.start(opts);
  const before = json(game.s);
  game.profile.upgrades.startingAlloy = 5;
  assert.deepEqual(json(game.s), before);
  game.start(opts);
  assert.equal(game.s.parties[0].account.alloy, 500); assert.deepEqual(json(game.s.parties[0].meta), { startingAlloy: 5 });
  assert.notStrictEqual(game.s.parties[0].meta, game.profile.upgrades);
  const restarted = json(game.s);
  game.start(opts); assert.deepEqual(json(game.s), restarted);
  for (const [value, level, alloy] of [[-2, 0, 250], ['3.9', 3, 400], [99, 5, 500], ['bad', 0, 250]]) {
    game.profile.upgrades = { startingAlloy: value }; game.start(opts);
    assert.deepEqual([game.s.parties[0].meta.startingAlloy, game.s.parties[0].account.alloy], [level, alloy]);
  }
});

test('starting worker levels 0–5 preserve seeded setup and free spacing for every faction', () => {
  for (const faction of [0, 1, 2]) {
    const { game } = createGame(), opts = { seed: 1409, faction, map: 'desert' };
    game.start(opts);
    const original = json(game.s.entities), terrain = Array.from(game.world.staticGrid),
      samples = Array.from({ length: 6 }, () => game.random());
    for (let level = 0; level <= 5; level++) {
      game.profile.upgrades = { startingWorkers: level };
      game.start(opts);
      const workers = game.alive(e => e.team === 0 && e.type === 'worker');
      assert.equal(workers.length, level);
      assert.deepEqual([game.s.parties[0].account.alloy, game.s.parties[0].account.gas, game.supply(), game.cap()], [250, 0, level, 24]);
      assert.equal(player(game, 'hq').queue.length, 0);
      assert.equal(game.s.stats.trained, 0);
      assert.deepEqual(json(game.s.entities.filter(e => e.team !== 0 || e.kind === 'building')), original);
      assert.deepEqual(Array.from(game.world.staticGrid), terrain);
      assert.equal(game.random(), samples[level], 'only one normal spawn RNG draw per bonus worker');
      for (const [i, w] of workers.entries()) {
        assert.equal(w.faction, faction); assert.equal(w.cd, samples[i] * .5);
        assert.equal(w.hp, w.maxHp); assert.equal(w.order.type, 'idle');
        assert.equal(w.exit, undefined); assert.ok(game.unitFits(w, w.x, w.z));
        assert.ok(Math.hypot(w.x - player(game, 'hq').x, w.z - player(game, 'hq').z) < 24);
      }
      assertUnitSpacing(game);
    }
  }
});

test('starting worker upgrades affect only the next battle and reproduce on restart', () => {
  const { game } = createGame(), opts = { seed: 9897, faction: 1, map: 'desert' };
  game.profile.upgrades = { startingWorkers: 2 }; game.start(opts);
  const before = json(game.s);
  game.profile.upgrades.startingWorkers = 5;
  assert.deepEqual(json(game.s), before);
  game.start(opts);
  assert.equal(game.alive(e => e.team === 0 && e.type === 'worker').length, 5);
  assert.deepEqual(json(game.s.parties[0].meta), { startingWorkers: 5 });
  assert.notStrictEqual(game.s.parties[0].meta, game.profile.upgrades);
  const restarted = json(game.s);
  game.start(opts); assert.deepEqual(json(game.s), restarted);
});

test('starting worker count is an integer bounded to 0–5 even for direct profile input', () => {
  const { game } = createGame();
  for (const [value, count] of [[-2, 0], ['3.9', 3], [99, 5], ['bad', 0]]) {
    game.profile.upgrades = { startingWorkers: value }; game.start({ seed: 90001 });
    assert.equal(game.s.parties[0].meta.startingWorkers, count);
    assert.equal(game.alive(e => e.team === 0 && e.type === 'worker').length, count);
  }
});

test('five starting workers begin mining and deliver alloy without recruitment for every faction', () => {
  for (const faction of [0, 1, 2]) {
    const { game } = createGame(); game.profile.upgrades = { startingWorkers: 5 };
    game.start({ seed: 1409, faction, map: 'desert' });
    advance(game, 1200);
    assert.equal(game.alive(e => e.team === 0 && e.type === 'worker').length, 5);
    assert.ok(game.s.parties[0].account.alloy > 250); assert.ok(game.s.stats.gathered > 0);
    assert.ok(game.alive(e => e.team === 0 && e.type === 'worker').every(w => w.order.type === 'mine'));
    assert.equal(game.s.parties[0].account.gas, 0); assert.equal(player(game, 'hq').queue.length, 0);
    assert.equal(game.canBuild('barracks'), '');
  }
});

test('expedition benefits combine with permanent start upgrades without helping the enemy', () => {
  const { game } = createGame();
  game.profile.upgrades = { startingAlloy: 1, startingWorkers: 2 };
  game.start({ seed: 1409, faction: 1, benefits: {
    supplyCrate: 2, aetherAllocation: 2, pioneerSquad: 3, commanderMandate: 1,
    unknown: 99
  } });
  assert.deepEqual(json(game.s.parties[0].benefits), {
    supplyCrate: 2, aetherAllocation: 2, pioneerSquad: 3, commanderMandate: 1
  });
  assert.deepEqual([game.s.parties[0].account.alloy, game.s.parties[0].account.gas], [400, 100]);
  assert.deepEqual([game.s.parties[1].account.alloy, game.s.parties[1].account.gas], [250, 0]);
  assert.equal(game.alive(e => e.team === 0 && e.type === 'worker').length, 5);
  assert.equal(game.alive(e => e.team === 0 && e.type === 'hero').length, 1);
  assert.equal(game.alive(e => e.team === 1 && (e.type === 'worker' || e.type === 'hero')).length, 0);
});

test('survey drones and capacitor preserve seeded setup, enemy sight and RNG across restarts',()=>{
  const {game}=createGame();
  for(const map of ['desert','alien-planet','mothership']) {
    const options={seed:1409,map};game.start(options);
    const entities=json(game.s.entities),terrain=Array.from(game.world.staticGrid),rng=game.random(),
      visible=Array.from(game.world.visible),enemyView=json(game.world.sight[1]),
      explored=Array.from(game.world.explored),version=game.world.fogVersion;
    for(const count of [1,2,99]) {
      const benefits={surveyDrones:99,commandCapacitor:count};game.start({...options,benefits});
      assert.deepEqual(json(game.s.entities),entities);assert.deepEqual(Array.from(game.world.staticGrid),terrain);
      assert.equal(game.random(),rng);assert.deepEqual(Array.from(game.world.visible),visible);
      assert.deepEqual(json(game.world.sight[1]),enemyView);assert.ok(game.world.fogVersion>version);
      assert.ok(game.world.explored.some((v,i)=>v&&!explored[i]));
      for(let i=0;i<visible.length;i++)assert.equal(game.world.fogPixels[i],visible[i]?255:game.world.explored[i]?80:0);
      assert.deepEqual([game.account(0).energy,game.account(1).energy],[count===1?40:55,25]);
      assert.deepEqual(json(game.s.parties[0].benefits),{surveyDrones:1,commandCapacitor:Math.min(2,count)});
      const saved=json(game.s);benefits.commandCapacitor=0;assert.deepEqual(json(game.s),saved);
      game.world.reveal(game.s.entities);assert.deepEqual(Array.from(game.world.visible),visible);
    }
  }
});

test('enemy benefits use the same effects, remain separate from fleet upgrades and snapshot without shifting resource RNG',()=>{
  const {game}=createGame(), perks={supplyCrate:8,aetherAllocation:4,surveyDrones:1,fieldWorkshop:1,commandCapacitor:2};
  game.profile.upgrades={startingAlloy:5,startingWorkers:2,logisticsFrame:5,constructionProtocols:5};
  game.start({seed:1409});
  const entities=json(game.s.entities),next=game.random(),playerSight=json(game.world.sight[0]),
    enemyVisible=Array.from(game.world.sight[1].visible),enemyExplored=Array.from(game.world.sight[1].explored);
  game.start({seed:1409,enemyBenefits:perks});
  assert.deepEqual(json(game.s.entities),entities);assert.equal(game.random(),next);
  assert.deepEqual(json(game.world.sight[0]),playerSight);
  assert.deepEqual(Array.from(game.world.sight[1].visible),enemyVisible);
  assert.ok(game.world.sight[1].explored.some((v,i)=>v&&!enemyExplored[i]));
  assert.deepEqual([game.account(1).alloy,game.account(1).gas,game.account(1).energy],[650,200,55]);
  assert.deepEqual([game.account(0).alloy,game.account(0).gas,game.account(0).energy],[500,0,25]);
  assert.equal(game.cap(0),34);assert.equal(game.cap(1),24);
  const snapshot=json(game.s.parties[1].benefits);perks.supplyCrate=0;
  assert.deepEqual(json(game.s.parties[1].benefits),snapshot);
  const options={seed:1409,faction:0,enemy:0,benefits:{pioneerSquad:3,commanderMandate:1},
    enemyBenefits:{pioneerSquad:99,commanderMandate:99,unknown:8}};
  game.start(options);
  assert.deepEqual(json(game.s.parties[1].benefits),{pioneerSquad:5,commanderMandate:1});
  for(const team of [0,1]) {
    assert.equal(game.alive(e=>e.team===team&&e.type==='worker').length,5);
    assert.equal(game.alive(e=>e.team===team&&e.type==='hero').length,1);
    assert.equal(game.supply(team),5);
  }
  assertUnitSpacing(game);
  const before=json(game.s);game.start(options);assert.deepEqual(json(game.s),before);
  game.start({seed:1409,benefits:null,enemyBenefits:null});
  assert.deepEqual(json(game.s.parties[0].benefits),{});assert.deepEqual(json(game.s.parties[1].benefits),{});
});

test('each team consumes its own paid first-foundation workshop; only the player gets fleet construction speed',()=>{
  const {game}=createGame(),options={seed:1409,benefits:{pioneerSquad:1,fieldWorkshop:1},enemyBenefits:{pioneerSquad:1,fieldWorkshop:1}};
  game.profile.upgrades={constructionProtocols:5};game.start(options);game.world.staticGrid.fill(0);
  for(const team of [0,1]) {
    const p={x:team?12:-12,z:0},w=game.alive(e=>e.team===team&&e.type==='worker')[0];
    Object.assign(w,{x:p.x,z:-6});game.world.sight[team].explored.fill(255);game.world.rebuild(game.s.entities);
    game.account(team).alloy=0;assert.equal(game.build('depot',p,[],team),false);assert.equal(game.s.parties[team].fieldWorkshopUsed,undefined);
    game.account(team).alloy=1000;assert.equal(game.build('depot',p,[],team),true);
    const b=game.get(w.order.id);assert.equal(b.buildRate,team?1.5:1.75);assert.equal(game.s.parties[team].fieldWorkshopUsed,true);
    assert.equal(game.account(team).alloy,915);
    game.cancelConstruction(b.id,team);game.worker(w,0);
    assert.equal(game.build('depot',p,[],team),true);
    assert.equal(game.get(w.order.id).buildRate,team?undefined:1.25);
  }
  game.start(options);assert.equal(game.s.parties[0].fieldWorkshopUsed,undefined);assert.equal(game.s.parties[1].fieldWorkshopUsed,undefined);
});

test('field workshop is paid, consumed only by successful placement and stays with one foundation',()=>{
  const {game}=createGame(),options={seed:1409,benefits:{fieldWorkshop:99}};
  game.profile.upgrades={startingWorkers:1};game.start(options);
  const worker=player(game,'worker');worker.x=0;worker.z=-5;
  game.world.staticGrid.fill(0);game.world.explored.fill(255);game.world.rebuild(game.s.entities);
  game.account(0).alloy=0;assert.equal(game.build('depot',{x:0,z:0}),false);
  assert.equal(game.s.parties[0].fieldWorkshopUsed,undefined);
  game.account(0).alloy=1000;assert.equal(game.build('depot',{x:0,z:0}),true);
  const b=game.get(worker.order.id);assert.equal(b.buildRate,1.5);assert.equal(game.s.parties[0].fieldWorkshopUsed,true);
  close(game.account(0).alloy,915);game.worker(worker,1);close(b.progress,.06+1.5/16);
  worker.x=-8;
  const replacement=game.spawnUnit('worker',0,-5,0,0);
  game.command([replacement.id],{type:'build',id:b.id,x:b.x,z:b.z});
  assert.equal(worker.order.type,'idle');game.worker(replacement,1);close(b.progress,.06+3/16);
  game.cancelConstruction(b.id);game.worker(replacement,0);
  close(game.account(0).alloy,915+85*.75);
  assert.equal(game.build('depot',{x:10,z:0}),true);
  const second=game.alive(e=>e.kind==='building'&&e.progress<1)[0];
  assert.equal(second.buildRate,undefined,'cancel does not return the workshop');
  const enemy=game.spawnUnit('worker',20,-6,1,2);game.world.sight[1].explored.fill(255);
  game.account(1).alloy=1000;assert.equal(game.build('depot',{x:20,z:0},[],1),true);
  assert.equal(game.get(enemy.order.id).buildRate,undefined);
  game.start(options);assert.equal(game.s.parties[0].fieldWorkshopUsed,undefined);
  assert.equal(game.s.parties[0].benefits.fieldWorkshop,1);
});

test('fleet logistics and construction levels are bounded snapshots with unchanged setup and RNG',()=>{
  const {game}=createGame(),options={seed:1409};game.start(options);
  const entities=json(game.s.entities),terrain=Array.from(game.world.staticGrid),rng=game.random();
  for(const [value,level] of [[-1,0],[1,1],[2.9,2],[3,3],[4,4],[99,5],[NaN,0]]) {
    game.profile.upgrades={constructionProtocols:value,logisticsFrame:value,repairLogistics:value};
    game.start(options);
    assert.deepEqual(json(game.s.parties[0].meta),{constructionProtocols:level,logisticsFrame:level,repairLogistics:level});
    assert.deepEqual(json(game.s.entities),entities);assert.deepEqual(Array.from(game.world.staticGrid),terrain);
    assert.equal(game.random(),rng);assert.deepEqual([game.cap(0),game.cap(1)],[24+level*2,24]);
    const snapshot=json(game.s);game.profile.upgrades.logisticsFrame=5;
    assert.deepEqual(json(game.s),snapshot);assert.equal(game.cap(0),24+level*2);
  }
  game.profile.upgrades={logisticsFrame:5};game.start(options);
  for(let i=0;i<12;i++)game.spawnBuilding('depot',0,0,0,0);
  assert.equal(game.cap(),180);
});

test('construction adds workshop once; repair discounts change cost, never speed or enemy rules',()=>{
  const {game}=createGame();
  for(let level=0;level<=5;level++) {
    game.profile.upgrades={constructionProtocols:level,repairLogistics:level};
    game.start({seed:1409,benefits:{fieldWorkshop:1}});
    game.world.staticGrid.fill(0);for(const view of game.world.sight)view.explored.fill(255);
    game.world.rebuild(game.s.entities);
    for(const team of [0,1]) {
      const x=team*20,w=game.spawnUnit('worker',x,-5,team,game.factionFor(team));
      Object.assign(game.account(team),{alloy:1000,gas:1000});
      assert.equal(game.build('depot',{x,z:0},[],team),true);
      const b=game.get(w.order.id),rate=team===0?1.5+level*.05:1;
      assert.equal(b.buildRate||1,rate);game.worker(w,1);close(b.progress,.06+rate/16);
      b.progress=1;b.hp=b.maxHp-100;
      game.setOrder(w,{type:'repair',id:b.id,x:b.x,z:b.z});
      const alloy=game.account(team).alloy;game.worker(w,1);
      close(b.hp,b.maxHp-62);close(game.account(team).alloy,alloy-3.8*(team===0?1-level*.05:1));
      // Also bound the actual hull repaired by the discounted remaining budget.
      game.account(team).alloy=1;const hp=b.hp;game.worker(w,1);
      close(b.hp-hp,10/(team===0?1-level*.05:1));close(game.account(team).alloy,0);
      b.hp=b.maxHp;game.worker(w,0);
      game.account(team).alloy=1000;
      assert.equal(game.build('depot',{x,z:12},[],team),true);
      assert.equal(game.get(w.order.id).buildRate||1,team===0?1+level*.05:1);
    }
  }
});

test('base energy, hull, production and construction rates match the current rules', () => {
  const { game } = createGame();
  game.start({ seed: 1409 });
  assert.deepEqual(json(game.s.parties[0].meta), {});
  game.s.parties[0].account.energy = 0;
  assert.equal(game.train('worker'), true);
  const own = player(game, 'hq'), enemy = game.alive(e => e.team === 1 && e.type === 'hq')[0];
  enemy.queue.push({ type: 'worker', progress: 0, time: 9, cost: 50, gas: 0 });
  game.step(.5);
  close(game.s.parties[0].account.energy, .5 * .8);
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
  assert.ok(Math.hypot(nearest.x-b.x,nearest.z-b.z)>b.size+4, 'starts outside repair range');
  game.spawnUnit('worker', b.x, b.z, 1, 0); game.spawnUnit('worker', b.x, b.z, 1, 2);
  game.spawnUnit('worker', b.x, b.z, 0, 0).hp = 0;
  const before = new Map(workers.map(w => [w.id, json(w.order)])), alloy = game.s.parties[0].account.alloy, x = nearest.x, z = nearest.z;
  assert.equal(game.toggleBuildingRepair(b.id), true);
  assert.deepEqual(Array.from(game.buildingRepairers(b.id), w => w.id), [nearest.id]);
  close(game.s.parties[0].account.alloy, alloy); assert.equal(b.hp, b.maxHp - 100);
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
    if (mode === 'alloy') game.s.parties[0].account.alloy = .1;
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
  const alloy = game.s.parties[0].account.alloy, gas = game.s.parties[0].account.gas, refund = { cost: 225.5, gas: 41.5 };
  assert.deepEqual(json(game.buildingSaleRefund(b.id)), refund);
  assert.equal(game.world.blockedAt(b.x,b.z), true);
  const random = game.random; game.random = () => { throw Error('Selling must not use RNG'); };
  assert.equal(game.sellBuilding(b.id), true); game.random = random;
  close(game.s.parties[0].account.alloy, alloy + refund.cost); close(game.s.parties[0].account.gas, gas + refund.gas);
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

test('nearby refinery placement snaps to the vent and selling frees it for a new foundation', () => {
  const { game } = battle(), b = player(game, 'refinery'), gas = game.get(b.gasId),
    nearby = {x:gas.x+5,z:gas.z};
  assert.ok(game.canBuild('refinery', nearby));
  assert.equal(game.sellBuilding(b.id), true);
  assert.deepEqual(game.foundationPosition('refinery', nearby), {x:gas.x,z:gas.z});
  assert.match(game.canBuild('refinery', {x:gas.x+6.01,z:gas.z}), /within 6 meters/);
  assert.equal(game.canBuild('refinery', nearby), '');
  assert.equal(game.build('refinery', nearby), true);
  const replacement = player(game, 'refinery');
  assert.deepEqual({x:replacement.x,z:replacement.z,gasId:replacement.gasId},
    {x:gas.x,z:gas.z,gasId:gas.id});
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
  const worker = player(game, 'worker'), beforeAlloy = game.s.parties[0].account.alloy;
  const cost = game.cost('depot', 'building');
  let built = false;
  for (let z = 30; z < 60 && !built; z += 3) for (let x = -65; x < -25 && !built; x += 3) {
    if (!game.canBuild('depot', { x, z })) built = game.build('depot', { x, z }, [worker.id]);
  }
  assert.equal(built, true);
  const foundation = game.alive(e => e.type === 'depot' && e.progress < 1)[0];
  const builders = game.alive(e => e.order?.type === 'build' && e.order.id === foundation.id);
  assert.deepEqual(Array.from(builders, e => e.id), [worker.id]);
  close(game.s.parties[0].account.alloy, beforeAlloy - cost.cost);
  worker.x = foundation.x; worker.z = foundation.z;
  const beforeProgress = foundation.progress, paidAlloy = game.s.parties[0].account.alloy;
  game.worker(worker, .5);
  assert.ok(foundation.progress > beforeProgress);
  close(game.s.parties[0].account.alloy, paidAlloy);
  foundation.progress = .999; foundation.hp = foundation.maxHp * .999;
  game.worker(worker, 1);
  assert.equal(foundation.progress, 1); assert.equal(foundation.hp, foundation.maxHp);
  assert.equal(worker.order.type, 'idle'); assert.equal(game.s.stats.built, 1);
  assert.equal(events.filter(e => e.type === 'complete' && e.data.type === 'depot').length, 1);
});

test('new foundations never steal travelling builders or repairers, even when selected', () => {
  const game = spacingArena(); game.world.explored.fill(255);
  const first = game.spawnUnit('worker', 0, -8, 0, 0);
  const second = game.spawnUnit('worker', 20, -8, 0, 0);
  const repairer = game.spawnUnit('worker', 10, -8, 0, 0);
  const damaged = player(game, 'barracks'); damaged.hp -= 100;
  game.setOrder(second, { type: 'mine', id: 999 });
  game.setOrder(repairer, { type: 'repair', id: damaged.id });
  assert.equal(game.build('depot', { x: 0, z: 0 }, [first.id]), true);
  const order = json(first.order), repair = json(repairer.order);
  assert.equal(game.build('depot', { x: 10, z: 0 }, [first.id, repairer.id]), true);
  assert.deepEqual(json(first.order), order);
  assert.deepEqual(json(repairer.order), repair);
  assert.equal(second.order.type, 'build'); assert.notEqual(second.order.id, first.order.id);
  const before = json(game.s);
  game.random = () => { throw Error('Rejected work must not consume RNG'); };
  assert.match(game.canBuild('depot'), /No free worker/);
  assert.equal(game.build('depot', { x: 20, z: 0 }), false);
  assert.deepEqual(json(game.s), before, 'no foundation, payment or stolen order');
});

test('automatic Repair uses free workers and remains stoppable when all workers are busy', () => {
  const game = spacingArena();
  const b = game.spawnBuilding('depot', 0, 0, 0, 0); b.hp -= 100;
  const builder = game.spawnUnit('worker', 0, -5, 0, 0);
  const repairer = game.spawnUnit('worker', 5, -5, 0, 0);
  const miner = game.spawnUnit('worker', 12, -5, 0, 0);
  game.setOrder(builder, { type: 'build', id: 999, x: 30, z: 0 });
  game.setOrder(repairer, { type: 'repair', id: player(game, 'barracks').id });
  game.setOrder(miner, { type: 'mine', id: 999 });
  const beforeBuilder = json(builder), beforeRepairer = json(repairer);
  game.random = () => { throw Error('Assignment must not consume RNG'); };
  assert.equal(game.toggleBuildingRepair(b.id), true);
  assert.deepEqual(Array.from(game.buildingRepairers(b.id), w => w.id), [miner.id]);
  assert.deepEqual(json(builder), beforeBuilder); assert.deepEqual(json(repairer), beforeRepairer);
  const other = player(game, 'factory'); other.hp -= 100;
  const before = json(game.s);
  assert.match(game.canRepairBuilding(other.id), /No free worker/);
  assert.equal(game.toggleBuildingRepair(other.id), false); assert.deepEqual(json(game.s), before);
  assert.equal(game.toggleBuildingRepair(b.id), true); assert.equal(miner.order.type, 'idle');
});

test('explicit construction resumes or replaces exactly one builder without extra cost or build speed', () => {
  for (const type of ['smart', 'build']) for (const occupied of [false, true]) {
    const game = spacingArena();
    const b = game.spawnBuilding('depot', 0, 0, 0, 0, { progress: .1 });
    b.hp = b.maxHp * .1;
    const old = game.spawnUnit('worker', 0, -5, 0, 0);
    const next = game.spawnUnit('worker', 0, -8, 0, 0);
    const farther = game.spawnUnit('worker', 12, -8, 0, 0);
    const soldier = game.spawnUnit('rifle', 12, -12, 0, 0);
    if (occupied) game.setOrder(old, { type: 'build', id: b.id, x: b.x, z: b.z });
    // Manual reassignment may interrupt another construction job.
    game.setOrder(next, { type: 'build', id: 999, x: 30, z: 0 });
    const beforeOthers = [json(farther), json(soldier)], alloy = game.s.parties[0].account.alloy;
    game.command([farther.id, soldier.id, next.id, next.id], { type, id: b.id, x: b.x, z: b.z });
    assert.deepEqual(Array.from(game.alive(e => e.order.type === 'build' && e.order.id === b.id), e => e.id), [next.id]);
    assert.equal(old.order.type, 'idle');
    assert.deepEqual([json(farther), json(soldier)], beforeOthers);
    assert.equal(game.s.parties[0].account.alloy, alloy);
    next.x = 0; next.z = -5;
    game.worker(next, .5);
    close(b.progress, .1 + .5 / 16);
    game.world.rebuild(game.s.entities);
    advance(game, 1000);
    assert.equal(b.progress, 1); assert.equal(game.s.stats.built, 1);
  }
});

test('explicit repair sends one selected worker, leaves others alone and rejects invalid work', () => {
  for (const kind of ['building', 'unit']) {
    const game = spacingArena();
    const target = kind === 'building' ? game.spawnBuilding('depot', 0, 0, 0, 0)
      : game.spawnUnit('rifle', 0, 0, 0, 0);
    target.hp -= 100;
    const next = game.spawnUnit('worker', 0, -3, 0, 0);
    const other = game.spawnUnit('worker', 15, -5, 0, 0);
    const soldier = game.spawnUnit('rifle', 15, -10, 0, 0);
    game.setOrder(next, { type: 'build', id: 999, x: 30, z: 0 });
    const before = [json(other), json(soldier)];
    game.command([other.id, soldier.id, next.id], { type: 'smart', id: target.id, x: 0, z: 0 });
    assert.equal(next.order.type, 'repair'); assert.equal(next.order.id, target.id);
    assert.deepEqual([json(other), json(soldier)], before);
    const alloy = game.s.parties[0].account.alloy;
    game.worker(next, .5); close(game.s.parties[0].account.alloy, alloy - 1.9); close(target.hp, target.maxHp - 81);
    for (const invalid of ['alloy', 'enemy', 'dead', 'foundation', 'full']) {
      target.team = invalid === 'enemy' ? 1 : 0;
      target.hp = invalid === 'dead' ? 0 : invalid === 'full' ? target.maxHp : target.maxHp - 100;
      target.progress = invalid === 'foundation' ? .1 : 1;
      game.s.parties[0].account.alloy = invalid === 'alloy' ? 0 : 100;
      const state = json(game.s);
      game.command([other.id], { type: 'repair', id: target.id });
      assert.deepEqual(json(game.s), state, invalid);
    }
  }
});

test('builders and repairers reach the final waypoint before giving up just outside work range', () => {
  for (const type of ['build', 'repair']) for (const [x, z, goalX, goalZ] of [
    [-4.14, -3.60, -3.75, -3.25], [-5.31, 0, -5.29, 0]
  ]) {
    const game = spacingArena();
    const b = game.spawnBuilding('depot', 0, 0, 0, 0, { progress: type === 'build' ? .1 : 1 });
    b.hp = b.maxHp * .1;
    const w = game.spawnUnit('worker', x, z, 0, 0);
    game.world.rebuild(game.s.entities);
    game.setOrder(w, { type, id: b.id, x: b.x, z: b.z });
    // A valid final grid point is in work range; the old 0.65 m waypoint tolerance isn't.
    w.path = [{ x: goalX, z: goalZ }]; w.pathVersion = game.world.pathVersion;
    w.nextPath = Infinity;
    const hp = b.hp;
    assert.ok(Math.hypot(w.x, w.z) > b.size + 3);
    for (let i = 0; i < 10; i++) {
      const beforeHp = b.hp, beforeDistance = Math.hypot(w.x, w.z);
      game.worker(w, .05);
      if (beforeDistance > b.size + 3) assert.equal(b.hp, beforeHp, 'work range is not extended');
    }
    assert.ok(b.hp > hp, `${type} must start work instead of stalling`);
    assert.ok(game.unitFits(w, w.x, w.z));
  }
});

test('workers still repair completed damaged structures and units for the same alloy cost', () => {
  for (const kind of ['building', 'unit']) {
    const { game } = battle(); const worker = player(game, 'worker');
    const target = kind === 'building'
      ? game.spawnBuilding('depot', worker.x, worker.z, 0, 0)
      : game.spawnUnit('rifle', worker.x, worker.z, 0, 0);
    target.hp = target.maxHp - 50;
    const alloy = game.s.parties[0].account.alloy;
    game.command([worker.id], { type: 'smart', id: target.id, x: target.x, z: target.z });
    assert.equal(worker.order.type, 'repair');
    game.worker(worker, 1);
    close(target.hp, target.maxHp - 12); close(game.s.parties[0].account.alloy, alloy - 3.8);
  }
});

for (const [faction, cost] of [[0, 75], [1, 64], [2, 85]]) {
  test(`faction ${faction}: recruitment spends reference cost, reserves supply and refunds cancellation`, () => {
    const { game, events } = battle(faction);
    const barracks = player(game, 'barracks');
    assert.equal(game.train('rifle'), true);
    assert.deepEqual(json(barracks.queue), [{ type: 'rifle', progress: 0, time: 11, cost, gas: 0 }]);
    assert.deepEqual([game.s.parties[0].account.alloy, game.s.parties[0].account.gas, game.supply(), rifleCount(game)], [1100 - cost, 400, 33, 7]);
    advance(game, 20);
    assert.ok(barracks.queue[0].progress > 0 && barracks.queue[0].progress < 1);
    const beforeCancel = game.s.parties[0].account.alloy;
    game.cancelQueue(barracks.id, 0);
    close(game.s.parties[0].account.alloy, beforeCancel + cost);
    assert.equal(game.supply(), 31);
    assert.equal(barracks.queue.length, 0);
    assert.ok(events.some(e => e.type === 'queued' && e.data === 'rifle'));
  });
}

for (const [reason, setup] of [
  ['insufficient alloy', game => { game.s.parties[0].account.alloy = 74; }],
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
  game.s.parties[0].account.alloy = 10000; game.s.parties[0].account.gas = 10000;
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

test('unknown units cannot be recruited; starts use the current unit catalog', () => {
  for (const faction of [0,1,2]) {
    const {game} = createGame(); game.start({seed:1409,faction,enemy:faction});
    const before = json(game.s);
    assert.equal(game.train('unknown-unit'), false); assert.deepEqual(json(game.s), before);
    const types = ['worker', 'rifle', 'medic', 'tank', 'artillery', 'air', 'hero'];
    assert.ok(game.s.entities.filter(e => e.kind === 'unit').every(e => types.includes(e.type)));
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
  close(game.s.parties[0].account.alloy, 1100 - 75 + game.s.stats.gathered);
  close(game.s.parties[0].account.gas, 400 + 11.05 * 1.7);
});

test('orbital strike requires own completed technology and current team vision; rejected actions are free of side effects',()=>{
  for(const team of [0,1]) {
    const {game}=freshBattle(),p={x:0,z:0};game.account(team).energy=200;
    game.world.sight[team].explored.fill(255);game.world.sight[team].visible.fill(255);
    const reject=()=>{
      const before=json(game.s),random=game.random;game.random=()=>{throw Error('Rejected ability consumed RNG');};
      assert.equal(game.ability('orbital',p,team),false);assert.deepEqual(json(game.s),before);game.random=random;
    };
    reject();
    const wrong=game.spawnBuilding('factory',25,25,1-team,0);reject();wrong.hp=0;
    const factory=game.spawnBuilding('factory',25,25,team,0,{progress:.99});reject();factory.progress=1;
    game.world.sight[team].visible.fill(0);game.world.sight[1-team].visible.fill(255);reject();
    assert.equal(game.ability('scan',p,team),true);
    assert.equal(game.ability('orbital',p,team),true);assert.equal(game.account(team).energy,90);
    assert.equal(game.s.strikes.length,1);assert.equal(game.s.strikes[0].team,team);
    game.s.parties[team].account.abilities.orbital=0;factory.hp=0;reject();
    factory.hp=factory.maxHp;game.s.scans=[];game.world.reveal(game.s.entities);reject();
  }
});

test('reinforcements require explored ground and a live own unit or completed building within 20 meters',()=>{
  for(const team of [0,1]) {
    const {game}=freshBattle(),p={x:0,z:0};game.account(team).energy=200;
    game.world.staticGrid.fill(0);game.world.rebuild(game.s.entities);
    game.world.sight[team].explored.fill(255);
    const reject=()=>{
      const before=json(game.s),random=game.random;game.random=()=>{throw Error('Rejected drop consumed RNG');};
      assert.equal(game.ability('drop',p,team),false);assert.deepEqual(json(game.s),before);game.random=random;
    };
    assert.equal(game.ability('scan',p,team),true);reject();
    const enemy=game.spawnUnit('worker',10,0,1-team,0);reject();enemy.hp=0;
    const b=game.spawnBuilding('depot',10,0,team,0,{progress:.99});reject();b.hp=0;
    const unit=game.spawnUnit('worker',20.01,0,team,0);reject();unit.x=20;
    game.world.sight[team].explored.fill(0);reject();game.world.sight[team].explored.fill(255);
    assert.equal(game.ability('drop',p,team),true);assert.equal(game.account(team).energy,80);
    assert.equal(game.alive(e=>e.team===team&&e.type==='rifle').length,4);
    for(const e of game.alive(e=>e.team===team&&e.kind==='unit'))e.hp=0;
    game.account(team).energy=200;game.account(team).abilities.drop=0;
    b.hp=b.maxHp;b.progress=1;assert.equal(game.ability('drop',p,team),true);
    assert.equal(game.account(team).energy,105);
  }
});

for (const [kind, energy, cooldown] of [
  ['orbital', 85, 48], ['repair', 45, 28], ['scan', 25, 17], ['drop', 95, 75]
]) test(`ability ${kind} retains energy threshold, exact payment and cooldown`, () => {
  const { game } = freshBattle();
  game.s.time = 10;
  game.world.explored.fill(1);
  const target = player(game,'hq');
  if (kind==='orbital') game.spawnBuilding('factory',target.x+12,target.z,0,0);
  game.s.parties[0].account.energy = energy - 1;
  const before = json(game.s);
  assert.equal(game.ability(kind, target), false);
  assert.deepEqual(json(game.s), before);
  game.s.parties[0].account.energy = energy;
  assert.equal(game.ability(kind, target), true);
  assert.equal(game.s.parties[0].account.energy, 0);
  assert.equal(game.s.parties[0].account.abilities[kind], 10 + cooldown);
  game.s.parties[0].account.energy = 100;
  const recharging = json(game.s);
  assert.equal(game.ability(kind, target), false);
  assert.deepEqual(json(game.s), recharging);
  game.s.time = 10 + cooldown;
  assert.equal(game.ability(kind, target), true);
  assert.equal(game.s.parties[0].account.energy, 100 - energy);
});

test('restarting discards the previous run and rebuilds fresh navigation, indexes and fog', () => {
  const {game,events}=battle();
  const hero=player(game,'hero'); game.command([hero.id],{type:'move',x:-10,z:32});
  game.train('rifle'); game.ability('scan',{x:20,z:-20}); advance(game,100);
  game.s.cam={x:-42,z:40,zoom:64}; game.s.speed=2;
  const old=game.s, oldWorld=game.world, hq=player(game,'hq');
  game.damage(hq,999999,null,true); game.checkBattleResult(); assert.equal(game.s.result.win,false);
  events.length=0;
  game.start({seed:1409,map:'desert',faction:0});
  assert.notStrictEqual(game.s,old); assert.notStrictEqual(game.world,oldWorld);
  assert.equal(game.s.speed,1);
  const fresh = freshBattle().game;
  assert.deepEqual(json(game.s),json(fresh.s));
  for(const e of game.s.entities)assert.strictEqual(game.get(e.id),e);
  const freshHQ=player(game,'hq'), cell=game.world.idx(freshHQ.x,freshHQ.z);
  assert.equal(game.world.staticGrid[cell],0); assert.equal(game.world.blocked[cell],1);
  assert.ok(game.near(freshHQ.x,freshHQ.z,3).includes(freshHQ));
  assert.deepEqual(Array.from(game.world.fogPixels),Array.from(fresh.world.fogPixels));
  assert.deepEqual(events.map(e=>e.type),['start','radio']);
  assert.equal(game.effects.fx.length,0);
});
