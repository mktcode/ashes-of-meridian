const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS, loadScripts } = require('./helpers/game-scripts.cjs');
const PROFILE = 'meridian.profile.v1', HISTORY = 'meridian.stage-history.v1';
const json = value => JSON.parse(JSON.stringify(value));
const defaults = {
  version: 1, expeditionDepth: 0, lastCivilizationScore: 0, aether: 0, tutorialComplete: false, upgrades: {},
  settings: { volume: 0.28, music: true, sfx: true, quality: 2, healthbars: false, showFps: false }
};
const content = loadScripts(['content']);
const catalogs = vm.runInContext('({units:UNITS,buildings:BUILDINGS,abilities:ABILITIES,battlefields:Object.fromEntries(MISSIONS["hq-elimination"].maps.map(id=>[id,{}])),missions:MISSIONS,enemyCount:expeditionEnemyCount})', content);
const upgrades = { startingAlloy: { max: 5 }, startingWorkers: { max: 5 }, aetherEvacuation: { max: 5 } };
const benefits = { supplyCrate: {}, aetherAllocation: {}, pioneerSquad: { max: 5 }, commanderMandate: { max: 1 }, fieldWorkshop: { max: 1 } };
const expedition = {
  version: 7, battle: null, faction: 1, abilities: ['orbital', 'repair', 'scan', 'drop'], depth: 8, civilizationScore: 0,
  benefits: { supplyCrate: 2, commanderMandate: 1 },
  enemyBenefits: [{ pioneerSquad: 2, fieldWorkshop: 1 }, { supplyCrate: 3 }, { aetherAllocation: 2 }],
  encounter: { deployment: 'exploration', mission: 'hq-elimination', enemies: [2, 1, 2], map: 'desert', seed: 1409 },
  offers: ['pioneerSquad', 'aetherAllocation']
};
function setup(data = new Map(), rules = {}) {
  const trace = [], fail = {}, warnings = [], context = loadScripts(['persistence']);
  const service = vm.runInContext('createMeridianPersistence', context)({
    getStorage() {
      if (fail.access) throw Error('storage getter denied');
      return {
        getItem(k) { trace.push(['get', k]); if (fail.get) throw Error('get denied'); return data.get(k) ?? null; },
        setItem(k, v) { trace.push(['set', k, v]); if (fail.set) throw Error('quota exceeded'); data.set(k, v); },
        removeItem(k) { trace.push(['remove', k]); if (fail.remove) throw Error('remove denied'); data.delete(k); }
      };
    },
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)), ...catalogs, upgrades, benefits, ...rules,
    warn: (...args) => warnings.push(args)
  });
  return { data, trace, fail, warnings, service };
}
function put(h, run = expedition, profile = defaults) { return h.service.saveProgress(profile, run); }

// One bounded CPU fixture, not an AI match or a simulation/balance run.
function runningSave() {
  const context = loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world', ...SIMULATION_SCRIPTS, 'effects', 'persistence']);
  const Game = vm.runInContext('MeridianGame', context), game = new Game(json(defaults));
  const run = { ...json(expedition), faction: 0, depth: 0, benefits: {}, enemyBenefits: [{}], offers: [],
    encounter: { deployment: 'exploration', mission: 'hq-elimination', enemies: [2], map: 'desert', seed: 1409 } };
  game.start({ ...run.encounter, faction: run.faction, abilities: run.abilities, depth: run.depth });
  const worker = game.s.entities.find(e => e.team === 0 && e.type === 'worker');
  for (const [kind, team] of [['alloy', 0], ['gas', 0], ['alloy', 1]]) {
    const cache = game.s.supplyCaches.find(c => c.resource === kind && !c.collected);
    assert.ok(cache, `fixture has ${kind} cargo`);
    const collector = game.s.entities.find(e => e.team === team && e.type === 'worker'), before = game.account(team)[kind];
    Object.assign(collector, { x: cache.x, z: cache.z }); game.world.reveal(game.s.entities); game.collectSupplyCaches();
    assert.equal(cache.collected, true); assert.equal(game.account(team)[kind], before + cache.amount);
  }
  run.civilizationScore = 15;
  for (const [i,type] of ['fieldlab','researchhub','researchspire','embercottage','terracecommons','hearthtower'].entries())
    game.spawnBuilding(type,worker.x+12+(i%3)*10,worker.z+20+Math.floor(i/3)*12,0,0,{progress:i%3===2?.4:1,paid:{cost:0,gas:catalogs.buildings[type].gas}});
  const building = game.spawnBuilding('barracks', worker.x + 10, worker.z, 0, 0, { progress: .4 });
  building.hp /= 2; building.queue = [{ type: 'rifle', progress: .3, time: 10, cost: 50, gas: 0 }];
  worker.order = { type: 'build', id: building.id, x: building.x, z: building.z };
  worker.path = [{ x: worker.x + 2, z: worker.z }]; worker.pathVersion = game.world.pathVersion;
  game.s.time = 12; game.s.speed = 3; game.s.scans.push({ x: worker.x, z: worker.z, team: 0, r: 8, until: 20 });
  game.s.strikes.push({ x: worker.x + 4, z: worker.z, at: 15, damage: 100, radius: 5, team: 0, type: 'orbital' });
  game.s.fields.push({ x: worker.x, z: worker.z, r: 5, until: 22, team: 0, type: 'repair', power: 2 });
  game.s.recalls.push({ x: worker.x, z: worker.z, team: 0, hq: building.id, at: 18, ids: [worker.id] });
  const ai = game.s.parties[1].controller.state;
  ai.nextThink = 13;
  ai.observation = { readyAt: 13, own: json(game.s.entities.filter(e => e.team === 1)), visible: [] };
  game.fogClock = .1; game.resultClock = .05; game.navDirty = true;
  game.rehash(); // Save hash membership before a subsequent movement, not a fresh rehash on restore.
  worker.x += 20;
  run.battle = json(game.snapshotBattle());
  return { context, Game, game, run };
}

// No terrain construction in pure persistence cases; the running fixture is shared as immutable input.
let fixture;
const savedBattle = () => json((fixture ??= runningSave()).run);

test('cached civilization scores round-trip independently per expedition and reject damaged totals', () => {
  const h=setup(),run={...json(expedition),civilizationScore:35},profile={...defaults,lastCivilizationScore:20};
  put(h,run,profile);
  assert.equal(setup(h.data).service.loadExpedition().civilizationScore,35);
  assert.equal(setup(h.data).service.loadProfile().lastCivilizationScore,20);
  h.service.saveProgress({...profile,lastCivilizationScore:40},null);
  assert.equal(setup(h.data).service.loadProfile().lastCivilizationScore,40);
  for(const invalid of [-5,1.2,'5',null,Number.MAX_SAFE_INTEGER+1]){
    put(h,{...run,civilizationScore:invalid},profile);const reload=setup(h.data);
    assert.equal(reload.service.loadExpedition(),null);assert.ok(reload.service.expeditionError);
  }
});

test('stage unlocks round-trip independently of score and reject malformed or locked running saves',()=>{
  for(const unlockedStage of [8,9]){
    const h=setup();put(h,{...json(expedition),unlockedStage});
    assert.equal(setup(h.data).service.loadExpedition().unlockedStage,unlockedStage);
  }
  for(const unlockedStage of [0,7,10,8.5,'9',null,Number.MAX_SAFE_INTEGER]){
    const h=setup();put(h,{...json(expedition),unlockedStage});
    const loaded=setup(h.data);assert.equal(loaded.service.loadExpedition(),null);assert.ok(loaded.service.expeditionError);
  }
  const run=savedBattle();run.depth=1;run.battle.state.depth=1;
  const h=setup();put(h,{...run,unlockedStage:2});
  assert.equal(setup(h.data).service.loadExpedition().unlockedStage,2,'a running unlocked stage survives a lower score');
  put(h,{...run,unlockedStage:1});const loaded=setup(h.data);
  assert.equal(loaded.service.loadExpedition(),null);assert.ok(loaded.service.expeditionError);
});

test('profile and expedition commit together; settings writes preserve the battle and clearing preserves rewards', () => {
  const h = setup(), run = savedBattle(), profile = { ...defaults, aether: 123, upgrades: { startingWorkers: 2 } };
  assert.equal(put(h, run, profile), true);
  assert.deepEqual(h.trace.filter(c => c[0] === 'set').map(c => c[1]), [PROFILE]);
  assert.deepEqual([...h.data.keys()], [PROFILE]);
  const loaded = setup(h.data); loaded.service.loadProfile();
  assert.deepEqual(json(loaded.service.loadExpedition()), run);
  loaded.service.saveProfile({ ...profile, settings: { ...defaults.settings, music: false } });
  assert.deepEqual(json(setup(h.data).service.loadExpedition()), run);
  assert.equal(loaded.service.saveProgress({ ...profile, aether: 150 }, null), true);
  assert.equal(setup(h.data).service.loadExpedition(), null);
  assert.equal(setup(h.data).service.loadProfile().aether, 150);
});

test('running snapshot restores exact CPU state, RNG, fog and consumed cargo without applying new fleet upgrades', () => {
  const { game, Game, run } = fixture ??= runningSave(), h = setup(); put(h, run);
  const restored = new Game({ ...json(defaults), upgrades: { startingWorkers: 5, startingAlloy: 5 } });
  restored.restoreBattle(h.service.loadExpedition());
  assert.deepEqual(json(restored.snapshotBattle()), run.battle);
  for(const type of ['fieldlab','researchhub','researchspire'])assert.ok(restored.s.entities.some(e=>e.type===type));
  const observation = restored.s.parties[1].controller.state.observation.own[0];
  assert.notStrictEqual(observation, restored.get(observation.id), 'delayed observation remains a value copy');
  const accounts = json(restored.s.parties.map(p => p.account));
  restored.collectSupplyCaches();
  assert.deepEqual(json(restored.s.parties.map(p => p.account)), accounts, 'consumed cargo cannot pay again');
  assert.deepEqual([restored.random(), restored.random(), restored.random()], [game.random(), game.random(), game.random()]);
  game.step(.05); restored.step(.05);
  assert.deepEqual(json(restored.snapshotBattle()), json(game.snapshotBattle()), 'one bounded continuation tick stays identical');
  game.stepping = true; assert.throws(() => game.snapshotBattle(), /completed/); game.stepping = false;
  game.snapshotSafe = false; assert.throws(() => game.snapshotBattle(), /completed/); game.snapshotSafe = true;
});

test('supply tutorial goals round-trip in running saves and reject unknown goals', () => {
  for (const step of ['trainRifle', 'buildDepot']) {
    const run = savedBattle(), h = setup();
    run.battle.tutorial = { step, achieved: ['buildHQ', 'trainWorker', 'buildRefinery', 'buildBarracks', 'trainRifle'], workersTrained: 2 };
    assert.equal(put(h, run), true);
    assert.deepEqual(json(setup(h.data).service.loadExpedition().battle.tutorial), run.battle.tutorial);
  }
  const run = savedBattle(), h = setup();
  run.battle.tutorial = { step: 'trainWorker', achieved: ['buildHQ', 'buildDepot'], workersTrained: 1 };
  assert.equal(put(h, run), true, 'a depot completed ahead of its prompt remains remembered');
  assert.deepEqual(json(setup(h.data).service.loadExpedition().battle.tutorial), run.battle.tutorial);
  for (const corrupt of [{ ...run.battle.tutorial, step: 'unknown' },
    { ...run.battle.tutorial, achieved: ['unknown'] }]) {
    run.battle.tutorial = corrupt;
    const damaged = setup();
    put(damaged, run);
    const loaded = setup(damaged.data).service;
    assert.equal(loaded.loadExpedition(), null);
    assert.ok(loaded.expeditionError);
  }
});

test('residential buildings round-trip with unfinished state and paid Echo',()=>{
  const run=savedBattle(),h=setup();assert.equal(put(h,run),true);
  const restored=setup(h.data).service.loadExpedition();
  for(const type of ['embercottage','terracecommons','hearthtower']){
    const before=run.battle.state.entities.find(e=>e.type===type),after=restored.battle.state.entities.find(e=>e.type===type);
    assert.ok(before);assert.deepEqual(json(after),before);assert.equal(after.paid.cost,0);assert.equal(after.paid.gas,catalogs.buildings[type].gas);
  }
});
test('Forum construction round-trips as a known seventh civilian type with paid Echo and no new save format',()=>{
  const run=savedBattle(),h=setup(),forum=run.battle.state.entities.find(e=>e.type==='fieldlab'),d=catalogs.buildings.meridianforum;
  Object.assign(forum,{type:'meridianforum',size:d.size,hp:d.hp*.4,maxHp:d.hp,progress:.4,paid:{cost:0,gas:d.gas}});
  assert.equal(put(h,run),true);
  const loaded=setup(h.data).service.loadExpedition();assert.ok(loaded);
  assert.deepEqual(json(loaded.battle.state.entities.find(e=>e.id===forum.id)),forum);
  const restored=new fixture.Game(json(defaults));restored.restoreBattle(loaded);
  assert.deepEqual(json(restored.snapshotBattle()),run.battle);
});
test('cosmetic building rotation round-trips through save and restore and rejects malformed values',()=>{
  const run=savedBattle(),h=setup(),b=run.battle.state.entities.find(e=>e.type==='fieldlab');
  b.visualRotation=1/3;assert.equal(put(h,run),true);
  const loaded=h.service.loadExpedition();assert.equal(loaded.battle.state.entities.find(e=>e.id===b.id).visualRotation,1/3);
  const {Game}=fixture,restored=new Game(json(defaults));restored.restoreBattle(loaded);
  assert.deepEqual(json(restored.snapshotBattle()),run.battle);
  b.visualRotation=7;put(h,run);assert.equal(h.service.loadExpedition().battle.state.entities.find(e=>e.id===b.id).visualRotation,7);
  for(const invalid of [-1,8,Infinity,'1',null]){
    b.visualRotation=invalid;put(h,run);assert.equal(h.service.loadExpedition(),null);
    assert.ok(h.service.expeditionError);
  }
  delete b.visualRotation;const worker=run.battle.state.entities.find(e=>e.type==='worker');worker.visualRotation=1;
  put(h,run);assert.equal(h.service.loadExpedition(),null,'unit aim cannot carry a building-only cosmetic field');
});

test('civilian service areas preserve their center-connection exception in saves and reject invalid flags', () => {
  const run=savedBattle(),worker=run.battle.state.entities.find(e=>e.type==='worker'&&e.team===0),
    building=run.battle.state.entities.find(e=>e.type==='researchspire');
  worker.order={type:'build',id:building.id,x:building.x,z:building.z};
  worker.pathArea={x:building.x,z:building.z,radius:catalogs.buildings.researchspire.size+2.9,terrainConnection:false};
  const h=setup();put(h,run);
  assert.deepEqual(json(h.service.loadExpedition().battle.state.entities.find(e=>e.id===worker.id).pathArea),json(worker.pathArea));
  for(const invalid of [true,'false',null]){
    worker.pathArea.terrainConnection=invalid;put(h,run);
    assert.equal(h.service.loadExpedition(),null);assert.ok(h.service.expeditionError);
  }
});
test('damaged snapshots and mismatched recipes are blocked, never downgraded to a fresh battle', () => {
  const original = savedBattle();
  for (const change of [
    r => { delete r.battle; }, r => { r.battle.version++; }, r => { r.battle.state.seed++; },
    r => { r.battle.state.entities[0].type = 'missing'; }, r => { r.battle.state.entities.push(r.battle.state.entities[0]); },
    r => { r.battle.sight[0].visible = 'bad'; }, r => { r.battle.state.supplyCaches[0].collected = 'false'; },
    r => { r.battle.randomState = null; }, r => { r.battle.state.parties[1].controller.state.observation.readyAt = null; }
  ]) {
    const h = setup(), damaged = json(original); change(damaged); put(h, damaged);
    const before = h.data.get(PROFILE);
    assert.equal(h.service.loadExpedition(), null); assert.ok(h.service.expeditionError);
    assert.equal(h.data.get(PROFILE), before, 'reading does not rewrite the bad save');
    h.service.saveProfile({ ...defaults, aether: 90 });
    assert.equal(setup(h.data).service.loadExpedition(), null, 'settings writes preserve the blocked save');
    h.service.saveProgress(defaults, null); assert.equal(h.service.expeditionError, null);
  }
});

test('old separate recipes are ignored while permanent profile data survives', () => {
  const h = setup(new Map([[PROFILE, JSON.stringify({ ...defaults, aether: 250 })],
    ['meridian.expedition.v6', JSON.stringify({ ...expedition, version: 6 })]]));
  assert.equal(h.service.loadProfile().aether, 250); assert.equal(h.service.loadExpedition(), null);
  assert.equal(h.service.expeditionError, null);
});

test('invalid recipes, benefits and offers are rejected instead of silently repaired', () => {
  for (const invalid of [
    { ...expedition, version: 6 }, { ...expedition, faction: 3 }, { ...expedition, depth: '8' },
    { ...expedition, abilities: ['orbital', 'repair', 'scan', 'scan'] },
    { ...expedition, benefits: { pioneerSquad: 99 } }, { ...expedition, offers: ['pioneerSquad', 'pioneerSquad'] },
    { ...expedition, offers: ['missing'] }, { ...expedition, enemyBenefits: [{}] },
    { ...expedition, encounter: { ...expedition.encounter, seed: -1 } },
    { ...expedition, encounter: { ...expedition.encounter, deployment: 'unknown' } },
    { ...expedition, encounter: { ...expedition.encounter, mission: 'echo-salvage' } },
    { ...expedition, encounter: { ...expedition.encounter, map: 'aurelion' } }
  ]) {
    const h = setup(); put(h, invalid, { ...defaults, aether: 40 });
    assert.equal(h.service.loadExpedition(), null); assert.ok(h.service.expeditionError);
    assert.equal(h.service.loadProfile().aether, 40);
  }
  const restricted = setup(new Map(), { missions: { 'hq-elimination': { maps: ['mothership'] } } });
  put(restricted); assert.equal(restricted.service.loadExpedition(), null);
  put(restricted, { ...expedition, encounter: { ...expedition.encounter, map: 'mothership' } });
  assert.equal(restricted.service.loadExpedition().encounter.map, 'mothership');
});

test('removed map recipes and snapshots stay blocked while permanent profile data survives', () => {
  const profile = { ...defaults, aether: 250, expeditionDepth: 25, tutorialComplete: true,
    upgrades: { startingWorkers: 2 }, settings: { ...defaults.settings, music: false } };
  const running = savedBattle();
  running.encounter.map = running.battle.state.map = 'platform-deck';
  for (const run of [{ ...running, battle: null }, running]) {
    const h = setup(); put(h, run, profile);
    const before = h.data.get(PROFILE), permanent = json(h.service.loadProfile());
    assert.equal(h.service.loadExpedition(), null);
    assert.ok(h.service.expeditionError);
    assert.equal(h.data.get(PROFILE), before, 'no silent remapping or destructive read');
    h.service.saveProfile(permanent);
    const reloaded = setup(h.data);
    assert.deepEqual(json(reloaded.service.loadProfile()), permanent);
    assert.equal(reloaded.service.loadExpedition(), null);
    assert.ok(reloaded.service.expeditionError, 'settings writes do not resurrect the removed map');
    reloaded.service.saveProgress(permanent, null);
    assert.equal(reloaded.service.loadExpedition(), null);
    assert.equal(reloaded.service.expeditionError, null, 'explicit discard clears the blocked run');
    assert.deepEqual(json(setup(h.data).service.loadProfile()), permanent);
  }
});

test('deployment and opponent slots round-trip across stage boundaries without shared benefits', () => {
  for (const depth of [0, 1, 2, 3, 7, 20]) {
    const count = catalogs.enemyCount(depth), run = { ...json(expedition), depth,
      enemyBenefits: Array.from({ length: count }, (_, slot) => ({ supplyCrate: slot + 1 })),
      encounter: { ...expedition.encounter, deployment: 'resource-start', enemies: Array.from({ length: count }, (_, slot) => slot % 3) } };
    const h = setup(); put(h, run, { ...defaults, tutorialComplete: true });
    const restored = setup(h.data).service.loadExpedition(); assert.deepEqual(json(restored), run);
    restored.enemyBenefits[0].supplyCrate = 999; assert.deepEqual(json(h.service.loadExpedition()), run);
  }
});

test('landscape archive remains independent, discards foreign history and clears with the run', () => {
  const h = setup(), current = { stage: 9, map: 'desert', seed: 1409 }, previous = { stage: 8, map: 'mothership', seed: 82 };
  put(h); const before = h.data.get(PROFILE);
  h.service.saveStageHistory([previous, current]);
  assert.deepEqual(json(setup(h.data).service.loadStageHistory(expedition)), [previous, current]);
  for (const stages of [[], [previous], [{ ...previous, stage: 7 }, current], [previous, { ...current, seed: 1410 }],
    [{ ...previous, map: 'aurelion' }, current], [{ ...previous, map: 'platform-deck' }, current], [null, current]]) {
    h.service.saveStageHistory(stages); assert.deepEqual(json(h.service.loadStageHistory(expedition)), [current]);
    assert.equal(h.data.get(PROFILE), before);
  }
  h.service.saveProgress(defaults, null); assert.equal(h.data.has(HISTORY), false);
});

test('quota failure keeps payout and retired battle together in memory and old durable data together on reload', () => {
  const h = setup(); put(h, savedBattle(), { ...defaults, aether: 10 });
  h.fail.set = true;
  assert.equal(h.service.saveProgress({ ...defaults, aether: 110 }, null), false);
  const calls = h.trace.length;
  assert.equal(h.service.loadProfile().aether, 110); assert.equal(h.service.loadExpedition(), null);
  h.fail.set = false; h.service.saveProfile({ ...defaults, aether: 120 });
  assert.equal(h.trace.length, calls, 'volatile service never retries');
  const reloaded = setup(h.data);
  assert.equal(reloaded.service.loadProfile().aether, 10);
  assert.deepEqual(json(reloaded.service.loadExpedition()), savedBattle(), 'unpaid durable battle remains paired with old reserve');
});

test('storage access/read/delete failures stay volatile without reviving stale progress or archives', () => {
  const denied = setup(); denied.fail.access = true; assert.equal(put(denied), false);
  assert.deepEqual(json(denied.service.loadExpedition()), expedition); assert.equal(denied.service.available, false);
  const h = setup(); put(h, expedition, { ...defaults, aether: 40 }); h.service.loadProfile(); h.service.loadExpedition();
  h.data.set(PROFILE, JSON.stringify({ ...defaults, aether: 99, expedition: null })); h.fail.get = true;
  assert.equal(h.service.loadProfile().aether, 40); const calls = h.trace.length; h.fail.get = false;
  assert.deepEqual(json(h.service.loadExpedition()), expedition); assert.equal(h.trace.length, calls);
  const deletion = setup(); put(deletion); deletion.service.saveStageHistory([{ stage: 9, map: 'desert', seed: 1409 }]);
  deletion.fail.remove = true; deletion.service.saveProgress(defaults, null);
  assert.equal(deletion.service.available, false); assert.equal(deletion.service.loadExpedition(), null);
  assert.deepEqual(json(deletion.service.loadStageHistory(null)), []);
  assert.equal(setup(deletion.data).service.loadExpedition(), null, 'authoritative retirement was committed before cosmetic deletion failed');
});

test('invalid JSON reports a blocked save and later settings writes cannot resurrect a fresh run', () => {
  const h = setup(new Map([[PROFILE, '{']])); assert.deepEqual(json(h.service.loadProfile()), defaults);
  assert.equal(h.service.loadExpedition(), null); assert.ok(h.service.expeditionError);
  assert.equal(h.warnings.length, 2);
  h.service.saveProfile(defaults); assert.equal(setup(h.data).service.loadExpedition(), null);
  h.service.saveProgress(defaults, null);
  const cleared = setup(h.data); assert.equal(cleared.service.loadExpedition(), null); assert.equal(cleared.service.expeditionError, null);
});

test('profile defaults, upgrade normalization and explicit tutorial completion remain independent of expedition schema', () => {
  const h = setup(); assert.deepEqual(json(h.service.loadProfile()), defaults);
  h.data.set(PROFILE, JSON.stringify({ version: 1, expeditionDepth: '25.9', aether: '120.9',
    upgrades: { startingWorkers: 99, extra: 8 }, settings: { ...defaults.settings, volume: 7, quality: -2, extra: true } }));
  assert.deepEqual(json(h.service.loadProfile()), { ...defaults, expeditionDepth: 25, aether: 120,
    upgrades: { startingAlloy: 0, startingWorkers: 5, aetherEvacuation: 0 }, settings: { ...defaults.settings, volume: 1, quality: 0 } });
  for (const value of [true, false, 1, 'true', {}, null]) {
    h.data.set(PROFILE, JSON.stringify({ ...defaults, tutorialComplete: value }));
    assert.equal(h.service.loadProfile().tutorialComplete, value === true);
  }
});

test('profile settings reject foreign types and nonfinite values while valid numeric values stay bounded', () => {
  const h = setup();
  for (const invalid of ['false', '1', '', 0, 1, null, {}, []]) {
    h.data.set(PROFILE, JSON.stringify({ ...defaults, aether: 321, settings: { volume: .6, quality: 1,
      music: invalid, sfx: invalid, healthbars: invalid, showFps: invalid } }));
    assert.deepEqual(json(h.service.loadProfile().settings), { ...defaults.settings, volume: .6, quality: 1 });
    assert.equal(h.service.loadProfile().aether, 321);
  }
  for (const invalid of ['0.5', '', false, true, null, {}, [], [1]]) {
    h.data.set(PROFILE, JSON.stringify({ ...defaults, settings: { volume: invalid, quality: invalid } }));
    assert.deepEqual(json(h.service.loadProfile().settings), defaults.settings);
  }
  for (const [volume, quality, expectedVolume, expectedQuality] of [[0, 0, 0, 0], [.37, 1, .37, 1], [1, 2, 1, 2],
    [-2, -2, 0, 0], [7, 7, 1, 2], [.5, .9, .5, 0], [.5, 1.5, .5, 1]]) {
    h.data.set(PROFILE, JSON.stringify({ ...defaults, settings: { volume, quality } }));
    assert.deepEqual(json(h.service.loadProfile().settings), { ...defaults.settings, volume: expectedVolume, quality: expectedQuality });
  }
  for (const value of ['1e309', '-1e309']) {
    h.data.set(PROFILE, `{"version":1,"settings":{"volume":${value},"quality":${value}}}`);
    assert.deepEqual(json(h.service.loadProfile().settings), defaults.settings);
  }
  for (const settings of [undefined, null, false, 1, 'settings', [], {}]) {
    h.data.set(PROFILE, JSON.stringify({ ...defaults, settings })); const before = h.data.get(PROFILE);
    assert.deepEqual(json(h.service.loadProfile().settings), defaults.settings); assert.equal(h.data.get(PROFILE), before);
  }
});

test('fleet and command upgrades normalize through real content; valid benefit stacks and offers round-trip', () => {
  const rules = vm.runInContext('({upgrades:PERMANENT_UPGRADES,benefits:EXPEDITION_BENEFITS})', content), h = setup(new Map(), rules);
  h.service.saveProfile({ ...defaults, upgrades: { constructionProtocols: 99, logisticsFrame: 2.9, repairLogistics: -1, orbital: 2.9, repair: 99, recall: -4 } });
  const loaded = setup(h.data, rules).service.loadProfile();
  assert.equal(loaded.upgrades.constructionProtocols, 5); assert.equal(loaded.upgrades.logisticsFrame, 2);
  assert.equal(loaded.upgrades.orbital, 2); assert.equal(loaded.upgrades.repair, 3); assert.equal(loaded.upgrades.recall, 0);
  const run = { ...json(expedition), benefits: { surveyDrones: 1, fieldWorkshop: 1, commandCapacitor: 1, commandDrill: 37 },
    offers: ['commandCapacitor', 'commandDrill', 'supplyCrate'] };
  put(h, run, loaded); assert.deepEqual(json(setup(h.data, rules).service.loadExpedition()), run);
});
