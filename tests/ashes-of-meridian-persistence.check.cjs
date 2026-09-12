const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { UI_SCRIPTS, loadScripts } = require('./helpers/game-scripts.cjs');
const PROFILE = 'meridian.profile.v1';
const json = value => JSON.parse(JSON.stringify(value));
const defaults = {
  version: 1, factionUnlockLevel: 0, aether: 0, upgrades: {},
  settings: { volume: 0.28, music: true, sfx: true, quality: 2, healthbars: false }
};

function setup(data = new Map()) {
  const trace = [], fail = {}, warnings = [];
  const context = loadScripts(['core', 'content', 'persistence', ...UI_SCRIPTS]);
  const service = vm.runInContext('createMeridianPersistence', context)({
    getStorage() {
      if (fail.access) throw Error('storage getter denied');
      return {
        getItem(k) { trace.push(['get', k]); if (fail.get) throw Error('get denied'); return data.get(k) ?? null; },
        setItem(k, v) { trace.push(['set', k, v]); if (fail.set) throw Error('set denied'); data.set(k, v); }
      };
    },
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    upgrades: vm.runInContext('META', context), warn: (...args) => warnings.push(args)
  });
  const ui = Object.create(vm.runInContext('MeridianUI.prototype', context));
  ui.persistence = service; ui.profile = service.loadProfile(); trace.length = 0;
  return { data, trace, fail, warnings, ui, service, readProfile: service.loadProfile };
}

test('profile defaults are complete, fresh and do not write storage', () => {
  const h = setup(), a = h.readProfile(), b = h.readProfile();
  assert.deepEqual(json(a), defaults);
  a.settings.music = false; a.upgrades.startingWorkers = 3;
  assert.deepEqual(json(b), defaults);
  assert.ok(h.trace.every(([kind]) => kind === 'get'));
});

test('profile normalization keeps only current integer upgrade levels and known settings', () => {
  const h = setup();
  h.data.set(PROFILE, JSON.stringify({ version: 1, unlocked: 19, credits: '12.5', aether: '120.9',
    medals: [3], best: 'invalid', upgrades: { startingWorkers: '3.9', command: 9, resolve: 3, stores: -1, industry: '1.5', extra: 8 },
    ending: 'open', skirmishBest: -4, settings: { volume: '0.6', quality: 1.5, difficulty: 'missing', music: 'yes', extra: 9 } }));
  assert.deepEqual(json(h.readProfile()), { ...defaults, aether: 120,
    upgrades: { startingAlloy: 0, startingWorkers: 3, aetherEvacuation: 0 },
    settings: { ...defaults.settings, volume: 0.6, quality: 1.5, music: 'yes' } });
});

test('invalid profile JSON/version resets; malformed upgrade values become zero and counts are bounded', () => {
  const h = setup();
  for (const text of ['{', 'null', '[]', '{"version":2}', '{"version":"1"}']) {
    h.data.set(PROFILE, text); assert.deepEqual(json(h.readProfile()), defaults);
  }
  h.data.set(PROFILE, '{"version":1,"factionUnlockLevel":"yes","factionsUnlocked":true,"unlocked":4,"credits":17,"upgrades":"bad"}');
  assert.deepEqual(json(h.readProfile()), { ...defaults, upgrades: { startingAlloy: 0, startingWorkers: 0, aetherEvacuation: 0 } });
  for (const [value, expected] of [[-2, 0], [1.9, 1], [99, 2], ['bad', 0], [null, 0]]) {
    h.data.set(PROFILE, JSON.stringify({ ...defaults, factionUnlockLevel: value }));
    assert.equal(h.readProfile().factionUnlockLevel, expected);
  }
  for (const [value, expected] of [[-2, 0], [1000000, 999999], ['bad', 0], [null, 0]]) {
    h.data.set(PROFILE, JSON.stringify({ ...defaults, aether: value }));
    assert.equal(h.readProfile().aether, expected);
  }
  for (const key of ['startingAlloy', 'startingWorkers'])
    for (const [value, expected] of [[-2, 0], [1.9, 1], [99, 5], ['bad', 0], [null, 0]]) {
      h.data.set(PROFILE, JSON.stringify({ ...defaults, upgrades: { [key]: value } }));
      assert.equal(h.readProfile().upgrades[key], expected);
    }
  assert.equal(h.warnings.length, 1);
  assert.ok(h.warnings.every(w => w[0] === 'Profile reset:'));
});

test('permanent upgrades, faction progress and settings persist across instances using only the unchanged profile key', () => {
  const data = new Map([['meridian.operation.v3', '{"version":3,"entities":[]}']]);
  const h = setup(data); h.ui.profile.upgrades.startingAlloy = 3; h.ui.profile.upgrades.startingWorkers = 2; h.ui.profile.factionUnlockLevel = 2; h.ui.profile.aether = 321; h.ui.profile.settings.quality = 0; h.ui.persist();
  assert.deepEqual(h.trace, [['set', PROFILE, JSON.stringify(h.ui.profile)]]);
  const reloaded = setup(data);
  assert.equal(reloaded.ui.profile.upgrades.startingAlloy, 3); assert.equal(reloaded.ui.profile.upgrades.startingWorkers, 2); assert.equal(reloaded.ui.profile.factionUnlockLevel, 2); assert.equal(reloaded.ui.profile.aether, 321); assert.equal(reloaded.ui.profile.settings.quality, 0);
  reloaded.readProfile(); assert.deepEqual(reloaded.trace, [['get', PROFILE]]);
  assert.equal(data.get('meridian.operation.v3'), '{"version":3,"entities":[]}', 'old run data is ignored, not migrated');
  assert.deepEqual(Object.keys(h.service).sort(), ['available','loadProfile','saveProfile']);
  for (const method of ['save','load','exportBackup','importBackup']) assert.equal(h.ui[method], undefined);
});

test('denied storage getter keeps only a volatile profile; new instances lose the fallback', () => {
  const h = setup(); h.fail.access = true;
  h.ui.profile.upgrades.startingWorkers = 2;
  assert.equal(h.service.saveProfile(h.ui.profile), false);
  assert.equal(h.readProfile().upgrades.startingWorkers, 2); assert.equal(h.service.available, false);
  const other = setup(); other.fail.access = true;
  assert.deepEqual(json(other.readProfile()), defaults);
});

test('write failure with successful reads still prefers the native profile; availability stays sticky', () => {
  const h = setup(); h.data.set(PROFILE, JSON.stringify({ ...defaults, upgrades: { startingWorkers: 1 } }));
  h.ui.profile.upgrades.startingWorkers = 2; h.fail.set = true;
  assert.equal(h.service.saveProfile(h.ui.profile), false);
  assert.equal(h.readProfile().upgrades.startingWorkers, 1);
  h.fail.get = true; assert.equal(h.readProfile().upgrades.startingWorkers, 2);
  h.fail.get = false; assert.equal(h.readProfile().upgrades.startingWorkers, 1);
  assert.equal(h.service.available, false);
});

test('persistence is standalone, lazy and uses injected profile rules', () => {
  const context = loadScripts(['persistence']), data = new Map(); let accesses = 0;
  const service = vm.runInContext('createMeridianPersistence', context)({
    getStorage() { accesses++; return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) }; },
    clamp: (v,min,max) => Math.max(min,Math.min(max,v)), upgrades: { custom: { max: 2 } }, warn() {}
  });
  assert.equal(accesses, 0); assert.equal(service.available, true);
  assert.equal(vm.runInContext('typeof Store + ":" + typeof defaultProfile + ":" + typeof localStorage', context), 'undefined:undefined:undefined');
  service.saveProfile({ version: 1, upgrades: { custom: 7 }, settings: { quality: 1 } });
  const p = json(service.loadProfile());
  assert.deepEqual(p.upgrades, { custom: 2 }); assert.equal(p.settings.quality, 1);
  assert.deepEqual([...data.keys()], [PROFILE]);
});

test('UI constructor needs only profile persistence, with no storage or run codec globals', () => {
  const context = loadScripts(UI_SCRIPTS, { globals: { innerWidth: 800, innerHeight: 600 } });
  const UI = vm.runInContext('MeridianUI', context), calls = [];
  class TestUI extends UI { bind() {} }
  const service = { saveProfile: p => calls.push(['profile', p]) }, profile = json(defaults);
  const ui = new TestUI({ s: null }, {}, {}, profile, service);
  assert.equal(ui.persistence, service); ui.persist();
  assert.deepEqual(calls, [['profile', profile]]); assert.equal('lastSaveTime' in ui, false);
  assert.equal(vm.runInContext('typeof localStorage + ":" + typeof createMeridianPersistence', context), 'undefined:undefined');
});
