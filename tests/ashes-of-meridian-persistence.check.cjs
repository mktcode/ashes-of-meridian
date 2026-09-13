const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts } = require('./helpers/game-scripts.cjs');
const PROFILE = 'meridian.profile.v1', EXPEDITION = 'meridian.expedition.v1';
const json = value => JSON.parse(JSON.stringify(value));
const defaults = {
  version: 1, expeditionDepth: 0, aether: 0, upgrades: {},
  settings: { volume: 0.28, music: true, sfx: true, quality: 2, healthbars: false }
};
const benefitRules = {
  supplyCrate: {}, aetherAllocation: {}, pioneerSquad: { max: 5 }, commanderMandate: { max: 1 }
};

function setup(data = new Map()) {
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
    battlefields: { desert: {}, 'alien-planet': {}, mothership: {} },
    warn: (...args) => warnings.push(args)
  });
  return { data, trace, fail, warnings, service };
}

const expedition = {
  version: 1, faction: 1, depth: 8,
  benefits: { supplyCrate: 2, commanderMandate: 1 },
  encounter: { enemy: 2, map: 'desert', seed: 1409 },
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
    { ...expedition, faction: 3 }, { ...expedition, encounter: { enemy: 0, map: 'missing', seed: 1 } }]) {
    h.data.set(EXPEDITION, JSON.stringify(invalid));
    assert.equal(h.service.loadExpedition(), null);
  }
  h.data.set(EXPEDITION, JSON.stringify({ ...expedition, depth: '9.8',
    benefits: { supplyCrate: '3.9', pioneerSquad: 99, commanderMandate: 4, unknown: 7 },
    offers: ['commanderMandate', 'aetherAllocation', 'aetherAllocation', 'unknown', 'supplyCrate', 'pioneerSquad'],
    encounter: { enemy: 0, map: 'mothership', seed: -8 } }));
  assert.deepEqual(json(h.service.loadExpedition()), {
    version: 1, faction: 1, depth: 9,
    benefits: { supplyCrate: 3, pioneerSquad: 5, commanderMandate: 1 },
    encounter: { enemy: 0, map: 'mothership', seed: 1 },
    offers: ['aetherAllocation', 'supplyCrate']
  });
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
