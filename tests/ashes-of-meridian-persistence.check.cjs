const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts } = require('./helpers/game-scripts.cjs');
const PROFILE = 'meridian.profile.v1', EXPEDITION = 'meridian.expedition.v3';
const json = value => JSON.parse(JSON.stringify(value));
const defaults = {
  version: 1, expeditionDepth: 0, aether: 0, tutorialComplete: false, upgrades: {},
  settings: { volume: 0.28, music: true, sfx: true, quality: 2, healthbars: false }
};
const benefitRules = {
  supplyCrate: {}, aetherAllocation: {}, pioneerSquad: { max: 5 }, commanderMandate: { max: 1 }, fieldWorkshop: { max: 1 }
};

function setup(data = new Map(), rules = {}) {
  const trace = [], fail = {}, warnings = [];
  const context = loadScripts(['persistence']);
  const service = vm.runInContext('createMeridianPersistence', context)({
    getStorage() {
      if (fail.access) throw Error('storage getter denied');
      return {
        getItem(k) { trace.push(['get', k]); if (fail.get) throw Error('get denied'); return data.get(k) ?? null; },
        setItem(k, v) { trace.push(['set', k, v]); if (fail.set) throw Error('set denied'); data.set(k, v); },
        removeItem(k) { trace.push(['remove', k]); if (fail.set) throw Error('remove denied'); data.delete(k); }
      };
    },
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    upgrades: { startingAlloy: { max: 5 }, startingWorkers: { max: 5 }, aetherEvacuation: { max: 5 } },
    benefits: benefitRules,
    enemyCount: vm.runInContext('expeditionEnemyCount', loadScripts(['content'])),
    ...rules,
    battlefields: { desert: {}, 'alien-planet': {}, mothership: {} },
    warn: (...args) => warnings.push(args)
  });
  return { data, trace, fail, warnings, service };
}

const expedition = {
  version: 3, faction: 1, depth: 8,
  benefits: { supplyCrate: 2, commanderMandate: 1 },
  enemyBenefits: [{ pioneerSquad: 2, fieldWorkshop: 1 }, { supplyCrate: 3 }, { aetherAllocation: 2 }],
  encounter: { enemies: [2, 1, 2], map: 'desert', seed: 1409 },
  offers: ['pioneerSquad', 'aetherAllocation']
};

test('profile defaults and normalization retain only permanent expedition progress', () => {
  const h = setup();
  assert.deepEqual(json(h.service.loadProfile()), defaults);
  h.data.set(PROFILE, JSON.stringify({ version: 1, expeditionDepth: '25.9', factionUnlockLevel: 2,
    aether: '120.9', upgrades: { startingWorkers: 99, extra: 8 },
    settings: { ...defaults.settings, volume: 7, quality: -2, extra: true } }));
  assert.deepEqual(json(h.service.loadProfile()), { ...defaults, expeditionDepth: 25, aether: 120,
    upgrades: { startingAlloy: 0, startingWorkers: 5, aetherEvacuation: 0 },
    settings: { ...defaults.settings, volume: 1, quality: 0 } });
});

test('tutorial completion persists only as an explicit boolean', () => {
  const h = setup();
  for (const value of [true, false, 1, 'true', {}, null]) {
    h.data.set(PROFILE, JSON.stringify({ ...defaults, tutorialComplete: value }));
    assert.equal(h.service.loadProfile().tutorialComplete, value === true);
  }
});

test('profile settings reject foreign types without losing valid fields or progress', () => {
  const h = setup();
  for (const invalid of ['false', '1', '', 0, 1, null, {}, []]) {
    h.data.set(PROFILE, JSON.stringify({ ...defaults, expeditionDepth: 12, aether: 321,
      upgrades: { startingWorkers: 2 }, settings: { volume: 0.6, quality: 1,
        music: invalid, sfx: invalid, healthbars: invalid, extra: true } }));
    const loaded = json(h.service.loadProfile());
    assert.deepEqual(loaded.settings, { ...defaults.settings, volume: 0.6, quality: 1 }, JSON.stringify(invalid));
    assert.equal(loaded.expeditionDepth, 12);
    assert.equal(loaded.aether, 321);
    assert.equal(loaded.upgrades.startingWorkers, 2);
  }
  for (const invalid of ['0.5', '', false, true, null, {}, [], [1]]) {
    h.data.set(PROFILE, JSON.stringify({ ...defaults, settings: {
      volume: invalid, quality: invalid, music: false, sfx: false, healthbars: true } }));
    assert.deepEqual(json(h.service.loadProfile().settings), {
      ...defaults.settings, music: false, sfx: false, healthbars: true
    }, JSON.stringify(invalid));
  }
  assert.deepEqual(h.warnings, []);
});

test('profile numeric settings stay finite and quality rounds down within the supported levels', () => {
  const h = setup();
  for (const [volume, quality, expectedVolume, expectedQuality] of [
    [0, 0, 0, 0], [0.37, 1, 0.37, 1], [1, 2, 1, 2],
    [-2, -2, 0, 0], [7, 7, 1, 2], [0.5, 0.9, 0.5, 0], [0.5, 1.5, 0.5, 1]
  ]) {
    h.data.set(PROFILE, JSON.stringify({ ...defaults, settings: { volume, quality } }));
    assert.deepEqual(json(h.service.loadProfile().settings), {
      ...defaults.settings, volume: expectedVolume, quality: expectedQuality
    });
  }
  // JSON numbers can overflow even though JSON.stringify(Infinity) produces null.
  for (const value of ['1e309', '-1e309']) {
    h.data.set(PROFILE, `{"version":1,"settings":{"volume":${value},"quality":${value}}}`);
    assert.deepEqual(json(h.service.loadProfile().settings), defaults.settings);
  }
});

test('missing or malformed settings containers retain defaults independently of expedition data', () => {
  const h = setup();
  h.service.saveExpedition(expedition);
  const checkpoint = h.data.get(EXPEDITION);
  for (const settings of [undefined, null, false, 1, 'settings', [], {}]) {
    h.data.set(PROFILE, JSON.stringify({ ...defaults, expeditionDepth: 12, settings }));
    const before = h.data.get(PROFILE);
    assert.deepEqual(json(h.service.loadProfile().settings), defaults.settings);
    assert.equal(h.service.loadProfile().expeditionDepth, 12);
    assert.equal(h.data.get(PROFILE), before, 'loading must not rewrite stored data');
    assert.equal(h.data.get(EXPEDITION), checkpoint);
  }
  assert.deepEqual(h.warnings, []);
});

test('the new expedition format resets old runs without migrating or changing the permanent profile', () => {
  const h=setup(), profile={...defaults,expeditionDepth:21,aether:432,upgrades:{startingAlloy:3}};
  h.service.saveProfile(profile);
  h.data.set('meridian.expedition.v2',JSON.stringify({...expedition,version:2,depth:21}));
  const before=JSON.stringify(h.service.loadProfile());
  assert.equal(h.service.loadExpedition(),null);
  assert.equal(JSON.stringify(h.service.loadProfile()),before);
  assert.ok(!h.trace.some(([op,key])=>op==='get'&&key==='meridian.expedition.v2'));
});

test('profile and expedition use separate local keys and survive service recreation', () => {
  const h = setup();
  const profile = { ...defaults, expeditionDepth: 12, aether: 321, upgrades: { startingWorkers: 2 } };
  assert.equal(h.service.saveProfile(profile), true);
  assert.equal(h.service.saveExpedition(expedition), true);
  const reloaded = setup(h.data);
  const normalizedProfile = { ...profile, upgrades: {
    startingAlloy: 0, startingWorkers: 2, aetherEvacuation: 0
  } };
  assert.deepEqual(json(reloaded.service.loadProfile()), normalizedProfile);
  assert.deepEqual(json(reloaded.service.loadExpedition()), expedition);
  assert.deepEqual([...h.data.keys()].sort(), [EXPEDITION, PROFILE]);
  assert.equal(reloaded.service.clearExpedition(), true);
  assert.equal(reloaded.service.loadExpedition(), null);
  assert.deepEqual(json(reloaded.service.loadProfile()), normalizedProfile);
});

test('expedition normalization rejects invalid encounters and bounds known benefits and offers', () => {
  const h = setup();
  for (const invalid of [null, {}, { ...expedition, version: 2 },
    { ...expedition, faction: 3 }, { ...expedition, encounter: { enemies: [0, 1, 2], map: 'missing', seed: 1 } },
    ...[[], [0], [0, 1], [0, 1, 2, 0], [0, 1, 3], [0, 1, null], [0, 1, '2']].map(enemies =>
      ({ ...expedition, encounter: { ...expedition.encounter, enemies } })),
    ...[{}, [], [{}], [{}, {}, null], [{}, {}, []]].map(enemyBenefits => ({ ...expedition, enemyBenefits }))]) {
    h.data.set(EXPEDITION, JSON.stringify(invalid));
    assert.equal(h.service.loadExpedition(), null);
  }
  h.data.set(EXPEDITION, JSON.stringify({ ...expedition, depth: '9.8',
    benefits: { supplyCrate: '3.9', pioneerSquad: 99, commanderMandate: 4, unknown: 7 },
    enemyBenefits: [{ supplyCrate: -3, pioneerSquad: 99, commanderMandate: 2.9, unknown: 7 }, {}, { supplyCrate: 4 }],
    offers: ['commanderMandate', 'aetherAllocation', 'aetherAllocation', 'unknown', 'supplyCrate', 'pioneerSquad'],
    encounter: { enemies: [0, 0, 1], map: 'mothership', seed: -8 } }));
  assert.deepEqual(json(h.service.loadExpedition()), {
    version: 3, faction: 1, depth: 9,
    benefits: { supplyCrate: 3, pioneerSquad: 5, commanderMandate: 1 },
    enemyBenefits: [{ pioneerSquad: 5, commanderMandate: 1 }, {}, { supplyCrate: 4 }],
    encounter: { enemies: [0, 0, 1], map: 'mothership', seed: 1 },
    offers: ['aetherAllocation', 'supplyCrate']
  });
});

test('new fleet upgrades normalize and reload through the real content catalog',()=>{
  const rules=vm.runInContext('({upgrades:META,benefits:EXPEDITION_BENEFITS})',loadScripts(['content']));
  const h=setup(new Map(),rules);
  h.service.saveProfile({...defaults,upgrades:{constructionProtocols:99,logisticsFrame:2.9,repairLogistics:-1}});
  const loaded=setup(h.data,rules).service.loadProfile();
  assert.deepEqual(json(loaded.upgrades),{startingAlloy:0,startingWorkers:0,aetherEvacuation:0,
    constructionProtocols:5,logisticsFrame:2,repairLogistics:0});
  assert.equal(loaded.aether,0);assert.equal(h.service.loadExpedition(),null);
});

test('new benefit keys round-trip with real content limits and exhausted offers disappear',()=>{
  const rules=vm.runInContext('({upgrades:META,benefits:EXPEDITION_BENEFITS})',loadScripts(['content']));
  const h=setup(new Map(),rules);
  h.service.saveExpedition({...expedition,benefits:{surveyDrones:99,fieldWorkshop:99,commandCapacitor:1.9,commandDrill:37},
    offers:['surveyDrones','fieldWorkshop','commandCapacitor','commandDrill','supplyCrate']});
  const loaded=setup(h.data,rules).service.loadExpedition();
  assert.deepEqual(json(loaded.benefits),{commandDrill:37,surveyDrones:1,fieldWorkshop:1,commandCapacitor:1});
  assert.deepEqual(json(loaded.offers),['commandCapacitor','commandDrill','supplyCrate']);
  assert.deepEqual(json(loaded.encounter),expedition.encounter);assert.equal(loaded.depth,8);
});

test('every stage boundary reloads exact opponent slots without rerolls or shared benefits', () => {
  const h = setup(), enemyCount = vm.runInContext('expeditionEnemyCount', loadScripts(['content']));
  for (const depth of [0, 1, 2, 3, 20]) {
    const count = enemyCount(depth), checkpoint = { ...expedition, depth,
      enemyBenefits: Array.from({ length: count }, (_, slot) => depth > slot ? { supplyCrate: depth - slot } : {}),
      encounter: { ...expedition.encounter, enemies: Array.from({ length: count }, (_, slot) => slot % 3) } };
    h.service.saveExpedition(checkpoint);
    const restored = setup(h.data).service.loadExpedition();
    assert.deepEqual(json(restored), checkpoint);
    restored.enemyBenefits[0].supplyCrate = 999;
    if (count > 1) assert.notEqual(restored.enemyBenefits[1].supplyCrate, 999);
    assert.deepEqual(json(h.service.loadExpedition()), checkpoint);
  }
});

test('denied storage remains a per-service volatile fallback for both records', () => {
  const h = setup(); h.fail.access = true;
  assert.equal(h.service.saveProfile({ ...defaults, expeditionDepth: 4 }), false);
  assert.equal(h.service.saveExpedition(expedition), false);
  assert.equal(h.service.loadProfile().expeditionDepth, 4);
  assert.deepEqual(json(h.service.loadExpedition()), expedition);
  assert.equal(h.service.available, false);
  const other = setup(); other.fail.access = true;
  assert.deepEqual(json(other.service.loadProfile()), defaults);
  assert.equal(other.service.loadExpedition(), null);
});

test('invalid JSON resets only the affected record and reports the failure', () => {
  const h = setup(new Map([[PROFILE, '{'], [EXPEDITION, '{']]));
  assert.deepEqual(json(h.service.loadProfile()), defaults);
  assert.equal(h.service.loadExpedition(), null);
  assert.deepEqual(h.warnings.map(w => w[0]), ['Profile reset:', 'Expedition reset:']);
});
