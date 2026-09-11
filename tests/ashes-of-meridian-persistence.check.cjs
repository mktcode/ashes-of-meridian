const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts } = require('./helpers/game-scripts.cjs');

const PROFILE = 'meridian.profile.v1', SAVE = 'meridian.operation.v1';
const json = value => JSON.parse(JSON.stringify(value));
const defaults = {
  version: 1, unlocked: 0, credits: 0, medals: {}, best: {}, upgrades: {},
  skirmishBest: 0, ending: null,
  settings: { volume: 0.28, music: true, sfx: true, quality: 2,
    tips: true, healthbars: false, difficulty: 'standard' }
};
const backup = (profile = { version: 1 }, operation = null) =>
  JSON.stringify({ format: 'ashes-of-meridian', version: 1, profile, operation });

// Exercise existing UI entry points without constructing a DOM, renderer or game.
// Storage failure modes are independently switchable, including its global getter.
function setup() {
  const data = new Map(), trace = [], fail = {}, warnings = [], blobs = [];
  const storage = {
    getItem(k) { trace.push(['get', k]); if (fail.get) throw Error('get denied'); return data.get(k) ?? null; },
    setItem(k, v) { trace.push(['set', k, v]); if (fail.set) throw Error('set denied'); data.set(k, v); },
    removeItem(k) { trace.push(['remove', k]); if (fail.remove) throw Error('remove denied'); data.delete(k); }
  };
  const context = loadScripts(['core', 'content', 'world', 'simulation', 'persistence', 'ui'], { globals: {
    console: { warn: (...args) => warnings.push(args) }, Blob,
    URL: { createObjectURL: blob => { blobs.push(blob); return 'blob:test'; }, revokeObjectURL() {} },
    document: { createElement: () => ({ click() { trace.push(['download', this.download]); } }) },
    setTimeout() {}
  } });
  Object.defineProperty(context, 'localStorage', { get() {
    if (fail.access) throw Error('storage getter denied');
    return storage;
  } });
  const api = vm.runInContext(`(() => {
    const persistence = createMeridianPersistence({
      getStorage: () => localStorage, clamp, upgrades: META,
      difficulties: DIFFICULTY, warn: (...args) => console.warn(...args)
    });
    return { readProfile: persistence.loadProfile, persistence, UI: MeridianUI };
  })()`, context);
  const ui = Object.create(api.UI.prototype);
  const profile = api.readProfile();
  Object.assign(ui, {
    profile, persistence: api.persistence, selected: [99], actionSignature: 'old', lastSaveTime: 0,
    game: { s: { version: 1, time: 7, entities: [], result: null },
      snapshot() { trace.push(['snapshot']); return json(this.s); },
      restore(state) { trace.push(['restore', state]); if (fail.restore) throw Error('restore denied'); this.s = state; }
    },
    audio: { unlock() { trace.push(['unlock']); }, sound(s) { trace.push(['sound', s]); },
      updateSettings() { trace.push(['audio']); } },
    R: { resize() { trace.push(['resize']); if (fail.resize) throw Error('resize denied'); } },
    toast: s => trace.push(['toast', s]), radio: s => trace.push(['radio', s]),
    updateHUD: force => trace.push(['hud', force]), showHome: () => trace.push(['home'])
  });
  trace.length = 0;
  return { data, trace, fail, warnings, blobs, ui, readProfile: api.readProfile,
    importText: (text, size = text.length) => ui.importBackup({ size, text: async () => text }) };
}

test('profile defaults are complete, fresh and do not write storage', () => {
  const h = setup(), a = h.readProfile(), b = h.readProfile();
  assert.deepEqual(json(a), defaults);
  a.settings.music = false; a.medals[0] = 3;
  assert.deepEqual(json(b), defaults);
  assert.ok(h.trace.every(([kind]) => kind === 'get'));
});

test('profile normalization preserves current coercions, fractional values and unknown settings', () => {
  const h = setup();
  h.data.set(PROFILE, JSON.stringify({ version: 1, unlocked: 19, credits: '12.5',
    medals: [3], best: 'invalid', upgrades: { veterans: 9, stores: -1, logistics: '1.5', extra: 8 },
    ending: 'open', skirmishBest: -4, settings: { volume: '0.6', quality: 1.5, difficulty: 'missing', music: 'yes', extra: 9 } }));
  const p = json(h.readProfile());
  assert.deepEqual(p, { ...defaults, unlocked: 15, credits: 12.5, medals: [3], best: 'invalid',
    upgrades: { veterans: 3, stores: 0, logistics: 1.5, extra: 8, command: 0, resolve: 0, industry: 0 },
    ending: 'open', skirmishBest: -4,
    settings: { ...defaults.settings, volume: 0.6, quality: 1.5, music: 'yes', extra: 9 } });
});

test('invalid profile JSON/version resets; a mid-normalization error retains partial changes', () => {
  const h = setup();
  for (const text of ['{', 'null', '[]', '{"version":2}', '{"version":"1"}']) {
    h.data.set(PROFILE, text); assert.deepEqual(json(h.readProfile()), defaults);
  }
  h.data.set(PROFILE, '{"version":1,"unlocked":4,"credits":17,"upgrades":"bad"}');
  assert.deepEqual(json(h.readProfile()), { ...defaults, unlocked: 4, credits: 17, upgrades: 'bad' });
  assert.equal(h.warnings.length, 2);
  assert.ok(h.warnings.every(w => w[0] === 'Profile reset:'));
});

test('persist writes the unchanged version-1 profile JSON and key', () => {
  const h = setup(); h.ui.profile.credits = 8; h.ui.persist();
  assert.deepEqual(h.trace, [['set', PROFILE, JSON.stringify(h.ui.profile)]]);
});

test('save guards, snapshot serialization, announcement and timestamp stay ordered', () => {
  const h = setup();
  assert.equal(h.ui.save(), true);
  assert.deepEqual(h.trace, [['snapshot'], ['set', SAVE, JSON.stringify(h.ui.game.s)],
    ['toast', 'Operation checkpoint saved.'], ['sound', 'complete']]);
  assert.equal(h.ui.lastSaveTime, 7);
  h.trace.length = 0; h.ui.game.s.result = { win: true };
  assert.equal(h.ui.save(), false); h.ui.game.s = null;
  assert.equal(h.ui.save(), false); assert.deepEqual(h.trace, []);
});

test('denied storage getter uses volatile checkpoints; separate instances do not share them', () => {
  const h = setup(); h.fail.access = true;
  assert.equal(h.ui.save(), false);
  assert.match(h.trace.find(t => t[0] === 'toast')[1], /storage is unavailable/);
  h.ui.game.s = null; h.trace.length = 0; h.ui.load();
  assert.equal(h.ui.game.s.time, 7);
  assert.ok(h.trace.some(t => t[0] === 'restore'));
  const other = setup(); other.fail.access = true; other.ui.load();
  assert.deepEqual(other.trace, [['toast', 'No operation checkpoint found.']]);
});

test('write failure with successful reads does not prefer the memory copy', () => {
  const h = setup(); h.data.set(SAVE, '{"time":2}'); h.fail.set = true;
  assert.equal(h.ui.save(false), false);
  h.ui.load(); assert.equal(h.ui.game.s.time, 2);
  h.fail.get = true; h.ui.load(); assert.equal(h.ui.game.s.time, 7);
});

test('load distinguishes missing, malformed and JSON-null checkpoints, and catches restore errors', () => {
  const h = setup(); h.ui.load();
  assert.deepEqual(h.trace, [['get', SAVE], ['toast', 'No operation checkpoint found.']]);
  h.data.set(SAVE, '{'); h.trace.length = 0; h.ui.load();
  assert.match(h.trace[1][1], /^Checkpoint could not be loaded:/);
  assert.ok(!h.trace.some(t => t[0] === 'restore'));
  h.data.set(SAVE, 'null'); h.trace.length = 0; h.ui.load();
  assert.deepEqual(h.trace[1], ['restore', null]);
  assert.deepEqual(json(h.ui.selected), []); assert.equal(h.ui.actionSignature, '');
  h.fail.restore = true; h.trace.length = 0; h.ui.load();
  assert.deepEqual(h.trace, [['get', SAVE], ['restore', null], ['toast', 'Checkpoint could not be loaded: restore denied']]);
});

test('export prefers the active snapshot, otherwise saved JSON, and tolerates broken stored JSON', async () => {
  const h = setup(); h.data.set(SAVE, '{"time":2}');
  h.ui.exportBackup();
  assert.equal(await h.blobs[0].text(), backup(h.ui.profile, h.ui.game.s));
  assert.equal(h.blobs[0].type, 'application/json');
  assert.ok(!h.trace.some(t => t[0] === 'get'));
  h.ui.game.s.result = { win: true }; h.ui.exportBackup();
  assert.equal(await h.blobs[1].text(), backup(h.ui.profile, { time: 2 }));
  h.data.set(SAVE, '{'); h.ui.game.s = null; h.ui.exportBackup();
  assert.equal(await h.blobs[2].text(), backup(h.ui.profile));
});

test('backup rejection and size limit leave profile, checkpoint and active game untouched', async () => {
  const h = setup(), before = h.ui.game.s, profile = json(h.ui.profile);
  h.data.set(SAVE, 'old');
  for (const text of ['{', 'null', '{}', backup({ version: 2 }),
    backup({ version: 1 }, { version: 2, entities: [] }),
    backup({ version: 1 }, { version: 1, entities: {} }),
    backup({ version: 1 }, { version: 1, entities: Array(1501).fill({}) })]) {
    h.trace.length = 0; await h.importText(text);
    assert.equal(h.trace.length, 1); assert.match(h.trace[0][1], /^Import failed:/);
    assert.deepEqual(json(h.ui.profile), profile); assert.equal(h.ui.game.s, before);
    assert.equal(h.data.get(SAVE), 'old'); assert.equal(h.data.has(PROFILE), false);
  }
  h.trace.length = 0;
  await h.ui.importBackup(null);
  await h.ui.importBackup({ size: 4000001, text() { throw Error('must not read'); } });
  assert.deepEqual(h.trace, [['toast', 'Backup is too large.']]);
});

test('import preserves profile identity, writes raw data, normalizes in memory and applies in order', async () => {
  const h = setup(), identity = h.ui.profile;
  const p = { version: 1, credits: 2000, settings: { quality: 0 } };
  const op = { version: 1, entities: Array(1500).fill({}) };
  await h.importText(backup(p, op), 4000000);
  assert.equal(h.ui.profile, identity); assert.equal(identity.credits, 999);
  assert.equal(h.ui.audio.settings, identity.settings); assert.equal(h.ui.R.quality, 0);
  assert.equal(h.ui.game.s, null);
  assert.deepEqual(h.trace, [['set', PROFILE, JSON.stringify(p)], ['get', PROFILE],
    ['audio'], ['resize'], ['set', SAVE, JSON.stringify(op)], ['home'], ['toast', 'Campaign and checkpoint imported.']]);
});

test('profile-only imports preserve the old checkpoint, including falsey operation values', async () => {
  for (const operation of [null, false, 0, '']) {
    const h = setup(); h.data.set(SAVE, 'old');
    await h.importText(backup({ version: 1 }, operation));
    assert.equal(h.data.get(SAVE), 'old');
    assert.ok(!h.trace.some(t => t[0] === 'set' && t[1] === SAVE));
  }
});

test('import storage failures retain the existing non-transactional behavior', async () => {
  const h = setup(); h.fail.access = true;
  await h.importText(backup({ version: 1, credits: 6 }, { version: 1, entities: [] }));
  assert.equal(h.ui.profile.credits, 6); assert.equal(h.data.size, 0);
  assert.deepEqual(h.trace.at(-1), ['toast', 'Campaign and checkpoint imported.']);
  h.ui.load(); assert.deepEqual(json(h.ui.game.s), { version: 1, entities: [] });
  const partial = setup(); partial.fail.resize = true; partial.data.set(SAVE, 'old');
  const active = partial.ui.game.s;
  await partial.importText(backup({ version: 1, credits: 9 }, { version: 1, entities: [] }));
  assert.equal(partial.ui.profile.credits, 9); assert.equal(partial.data.get(SAVE), 'old');
  assert.equal(partial.ui.game.s, active);
  assert.deepEqual(partial.trace.at(-1), ['toast', 'Import failed: resize denied']);
});

// New boundary tests: only explicitly supplied rules, storage and logging.
// No content/world/simulation/UI scripts or browser globals are loaded here.
function isolatedPersistence(getStorage) {
  const context = loadScripts(['persistence']);
  const create = vm.runInContext('createMeridianPersistence', context);
  const warnings = [];
  const service = create({ getStorage, clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    upgrades: { custom: { max: 2 } }, difficulties: { sandbox: {} },
    warn: (...args) => warnings.push(args) });
  return { service, warnings, context };
}

test('persistence is standalone, lazy and uses injected profile rules', () => {
  const data = new Map(); let accesses = 0;
  const { service, context } = isolatedPersistence(() => {
    accesses++;
    return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
  });
  assert.equal(accesses, 0); assert.equal(service.available, true);
  assert.equal(vm.runInContext('typeof Store + ":" + typeof defaultProfile + ":" + typeof readProfile', context), 'undefined:undefined:undefined');
  service.saveProfile({ version: 1, upgrades: { custom: 7 }, settings: { difficulty: 'sandbox' } });
  const p = json(service.loadProfile());
  assert.deepEqual(p.upgrades, { custom: 2 }); assert.equal(p.settings.difficulty, 'sandbox');
  assert.deepEqual(json(service.readCheckpoint()), { exists: false, state: null });
  service.saveCheckpoint(null);
  assert.equal(service.hasCheckpoint(), true);
  assert.deepEqual(json(service.readCheckpoint()), { exists: true, state: null });
  service.removeCheckpoint(); assert.equal(service.hasCheckpoint(), false);
  assert.equal(data.get(PROFILE), '{"version":1,"upgrades":{"custom":7},"settings":{"difficulty":"sandbox"}}');
});

test('checkpoint removal clears fallback even if native removal fails; availability stays sticky', () => {
  const data = new Map(); let denyRead = false, denyRemove = false;
  const { service } = isolatedPersistence(() => ({
    getItem(k) { if (denyRead) throw Error('denied'); return data.get(k) ?? null; },
    setItem(k, v) { data.set(k, v); },
    removeItem(k) { if (denyRemove) throw Error('denied'); data.delete(k); }
  }));
  service.saveCheckpoint({ time: 2 }); denyRemove = true;
  service.removeCheckpoint();
  assert.equal(service.available, true); // Existing remove() does not flag failure.
  assert.equal(service.hasCheckpoint(), true); // Native copy is still there.
  denyRead = true;
  assert.equal(service.hasCheckpoint(), false); assert.equal(service.available, false);
  denyRead = false; denyRemove = false;
  service.removeCheckpoint(); assert.equal(service.available, false);
});

test('backup codec has no storage writes and retains exact validation errors', () => {
  const { service } = isolatedPersistence(() => { throw Error('must not access storage'); });
  const text = backup({ version: 1 }, { version: 1, entities: [] });
  const parsed = service.parseBackup(text);
  assert.equal(service.serializeBackup(parsed.profile, parsed.operation), text);
  assert.throws(() => service.parseBackup('{}'), { message: 'Not a Meridian backup.' });
  assert.throws(() => service.parseBackup(backup({ version: 1 }, { version: 1, entities: {} })),
    { message: 'Operation data is invalid.' });
  assert.equal(service.available, true);
});

test('UI constructor and checkpoint commands accept a fake service without storage or codec globals', () => {
  const context = loadScripts(['ui'], { globals: { innerWidth: 800, innerHeight: 600 } });
  const UI = vm.runInContext('MeridianUI', context), calls = [], state = { time: 4 };
  class TestUI extends UI {
    bind() {} setControlHints() {} toast() {} radio() {} updateHUD() {}
  }
  const service = {
    saveProfile: p => calls.push(['profile', p]),
    saveCheckpoint: s => { calls.push(['save', s]); return false; },
    readCheckpoint: () => ({ exists: true, state })
  };
  const profile = json(defaults), game = { s: state, snapshot: () => state,
    restore: s => calls.push(['restore', s]) };
  const ui = new TestUI(game, {}, { unlock() {} }, profile, service);
  assert.equal(ui.persistence, service);
  ui.persist(); assert.equal(ui.save(false), false); ui.load();
  assert.equal(ui.lastSaveTime, 4);
  assert.deepEqual(calls, [['profile', profile], ['save', state], ['restore', state]]);
  assert.equal(vm.runInContext('typeof localStorage + ":" + typeof createMeridianPersistence', context), 'undefined:undefined');
});
