/* Local profile and expedition saves; one write commits rewards and progression together. */
'use strict';

// Four binary cells per hex digit, without JSON typed-array objects or browser codecs.
function packBattleGrid(grid: Uint8Array): string {
  const chars: string[] = [];
  for (let i = 0; i < grid.length; i += 4) {
    let bits = 0;
    for (let j = 0; j < 4 && i + j < grid.length; j++) if (grid[i + j]) bits |= 1 << j;
    chars.push(bits.toString(16));
  }
  return chars.join('');
}
function unpackBattleGrid(text: string, length: number): Uint8Array {
  if (text.length !== Math.ceil(length / 4) || !/^[0-9a-f]+$/.test(text))
    throw Error('Invalid saved battlefield grid');
  const grid = new Uint8Array(length);
  for (let i = 0; i < length; i++) grid[i] = (parseInt(text[i >> 2], 16) >> (i & 3)) & 1;
  return grid;
}

// A saved simulation is rejected as a whole, never repaired into a fresh battle.
// Rules/content arrive from the app; this layer knows neither Game nor UI objects.
function validExpeditionBattle(value: unknown, expedition: MeridianExpedition,
  { abilities, units, buildings, upgrades, benefits }: PersistenceDependencies): value is ExpeditionBattleSave {
  type Check = (v: unknown) => boolean;
  const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const num: Check = v => typeof v === 'number' && Number.isFinite(v);
  const nonnegative: Check = v => num(v) && Number(v) >= 0;
  const integer: Check = v => Number.isSafeInteger(v) && Number(v) >= 0;
  const id: Check = v => integer(v) && Number(v) > 0;
  const bool: Check = v => typeof v === 'boolean';
  const text: Check = v => typeof v === 'string';
  const oneOf = (...values: unknown[]): Check => v => values.includes(v);
  const key = (catalog: Record<string, unknown>): Check => v => typeof v === 'string' && Object.hasOwn(catalog, v);
  const list = (check: Check, max = 100000): Check => v => Array.isArray(v) && v.length <= max && v.every(check);
  const shape = (required: Record<string, Check>, optional: Record<string, Check> = {}): Check => v =>
    record(v) && Object.entries(required).every(([k, c]) => Object.hasOwn(v, k) && c(v[k])) &&
    Object.entries(v).every(([k, item]) => Object.hasOwn(required, k) || (Object.hasOwn(optional, k) && optional[k](item)));
  const dictionary = (check: Check, known?: Record<string, unknown>): Check => v => record(v) &&
    Object.entries(v).every(([k, item]) => (!known || Object.hasOwn(known, k)) && check(item));
  const pos = shape({ x: num, z: num });
  const faction = oneOf(0, 1, 2), team = oneOf(0, 1, 2, 3), anyTeam = oneOf(-1, 0, 1, 2, 3);
  const cost = shape({ cost: nonnegative, gas: nonnegative });
  const pathStatus = oneOf('complete', 'partial', 'unreachable', 'budget-exhausted');
  const order: Check = v => record(v) && shape({ type: oneOf('idle', 'hold', 'stop', 'move', 'attackMove', 'guard',
    'attack', 'build', 'mine', 'follow', 'repair') }, { x: num, z: num, id })(v) &&
    (!['move', 'attackMove', 'guard', 'attack', 'build'].includes(String(v.type)) || (num(v.x) && num(v.z))) &&
    (!['attack', 'build', 'mine', 'follow', 'repair'].includes(String(v.type)) || id(v.id));
  const identity: Check = v => record(v) && faction(v.faction) && anyTeam(v.team) &&
    (v.kind === 'unit' ? key(units)(v.type) && v.team !== -1 :
      v.kind === 'building' ? key(buildings)(v.type) && v.team !== -1 :
        v.kind === 'resource' && ['crystal', 'gas'].includes(String(v.type)) && v.team === -1);
  const entity: Check = v => identity(v) && shape({
    id, kind: text, type: text, team: anyTeam, faction, x: num, z: num,
    hp: num, maxHp: nonnegative, size: nonnegative, vision: nonnegative, rot: num, progress: nonnegative,
    queue: list(shape({ type: key(units), progress: nonnegative, time: nonnegative, cost: nonnegative, gas: nonnegative })),
    order, path: list(pos), pi: integer, walk: num, cd: num, nextThink: num, nextPath: num, lastHit: num,
    kills: integer, carry: nonnegative, work: num, shield: nonnegative, maxShield: nonnegative
  }, {
    target: v => v === null || id(v), exit: shape({ x: num, z: num, building: id, length: nonnegative }),
    yieldTo: pos, yieldUntil: num, pathGoal: pos, pathVersion: integer,
    pathArea: shape({ x: num, z: num, radius: nonnegative }), pathStatus, pathResolvedGoal: pos,
    recoveryAttempts: integer, nextRecovery: num, stuck: num, steerSide: oneOf(-1, 1), steerLocked: bool,
    slowed: num, reinforcedUntil: num, returning: bool, lastSource: integer, shieldFlash: num,
    paid: cost, gasId: id, deathAt: num, rally: pos, label: text, buildRate: nonnegative, amount: nonnegative
  })(v) && record(v) && (v.kind !== 'resource' || nonnegative(v.amount));
  const contact: Check = v => record(v) && anyTeam(v.team) &&
    (v.kind === 'unit' ? key(units)(v.type) : v.kind === 'building' ? key(buildings)(v.type) :
      v.kind === 'resource' && oneOf('crystal', 'gas')(v.type)) && shape({
      id, team: anyTeam, kind: text, type: text, x: num, z: num, hp: num, maxHp: nonnegative,
      size: nonnegative, progress: nonnegative, seenAt: num
    }, { areaVisible: bool })(v);
  const ai = shape({
    nextThink: num, mode: oneOf('bootstrap', 'defend', 'assemble', 'attack', 'recover'),
    contacts: dictionary(contact), squad: list(id), attackStartedAt: num, restStartedAt: num,
    launched: integer, search: integer, nextBuild: num, buildWindowAt: num,
    buildAttempts: dictionary(num, buildings), lastScout: num
  }, {
    deploymentGoal: pos, deploymentGoalAt: num, observation: shape({ readyAt: num, own: list(entity), visible: list(contact) }),
    attackProgress: shape({ targetId: id, distance: nonnegative, hp: num, at: num, startedAt: num }),
    combatProgressAt: num, scoutSite: integer, scoutGoal: pos, scout: id, goal: pos,
    recoverUntil: num, failedGoal: shape({ x: num, z: num, until: num })
  });
  const loadout: Check = v => list(key(abilities), 4)(v) && Array.isArray(v) && v.length === 4 && new Set(v).size === 4;
  const party = shape({
    id: team, faction, loadout,
    account: shape({ alloy: nonnegative, gas: nonnegative, energy: nonnegative, abilities: dictionary(nonnegative, abilities) }),
    meta: dictionary(integer, upgrades), benefits: dictionary(integer, benefits),
    controller: v => shape({ kind: oneOf('human') })(v) || shape({ kind: oneOf('ai'), state: ai })(v)
  }, { fieldWorkshopUsed: bool, deploymentPending: bool, eliminated: bool });
  const state = shape({
    depth: integer, seed: id, map: oneOf(expedition.encounter.map), time: nonnegative, parties: list(party, 4),
    rules: shape({ kind: oneOf('single-player'), mission: shape({ id: oneOf(expedition.encounter.mission) }) }),
    stopped: oneOf(false), nextId: id, entities: list(entity),
    supplyCaches: list(shape({ x: num, z: num, resource: oneOf('alloy', 'gas'), tier: oneOf(1, 2, 3), amount: nonnegative, collected: bool }), 1000),
    scans: list(shape({ x: num, z: num, r: nonnegative, until: num }, { team })),
    strikes: list(shape({ x: num, z: num, at: num, damage: nonnegative, radius: nonnegative,
      team: anyTeam, type: oneOf('shell', 'orbital', 'flare') }, { source: integer, warning: num, done: bool })),
    fields: list(shape({ x: num, z: num, r: nonnegative, until: num, team,
      type: oneOf('bloom', 'repair', 'disruption', 'bulwark', 'surge') }, { power: num, reload: num })),
    recalls: list(shape({ x: num, z: num, team, hq: id, at: num, ids: list(id) })),
    stats: shape({ kills: integer, structuresDestroyed: integer, lost: integer, trained: integer,
      gathered: nonnegative, built: integer, damage: nonnegative }),
    triggers: dictionary(v => num(v) || bool(v)), cam: shape({ x: num, z: num, zoom: nonnegative, yaw: num }),
    result: oneOf(null), speed: oneOf(1, 2, 3)
  });
  const tutorialStep = oneOf('arrival', 'buildHQ', 'recon', 'trainWorker', 'buildRefinery', 'buildBarracks', 'trainRifle');
  if (!shape({
    version: oneOf(1), state, randomState: v => Number.isInteger(v) && Number(v) >= -2147483648 && Number(v) <= 2147483647,
    fogClock: nonnegative, resultClock: nonnegative, navDirty: bool, pathVersion: integer,
    gridSize: v => integer(v) && Number(v) >= 3 && Number(v) <= 2048,
    blocked: text, sight: list(shape({ visible: text, explored: text }), 4),
    spatial: list(v => Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && /^-?\d+,-?\d+$/.test(v[0]) && list(id)(v[1])),
    tutorial: v => v === null || shape({ step: tutorialStep, achieved: list(tutorialStep, 7), workersTrained: integer }, { cameraHome: pos })(v)
  })(value)) return false;
  const b = value as ExpeditionBattleSave, s = b.state, count = expedition.encounter.enemies.length + 1;
  if (s.depth !== expedition.depth || s.seed !== expedition.encounter.seed || s.parties.length !== count || b.sight.length !== count ||
    s.parties.some((p, i) => p.id !== i || p.faction !== (i ? expedition.encounter.enemies[i - 1] : expedition.faction) ||
      p.controller.kind !== (i ? 'ai' : 'human') || Object.keys(abilities).some(k => !Object.hasOwn(p.account.abilities, k))) ||
    JSON.stringify(s.parties[0].loadout) !== JSON.stringify(expedition.abilities) ||
    s.parties.some((p, i) => Object.keys(benefits).some(k => (p.benefits[k] || 0) !==
      ((i ? expedition.enemyBenefits[i - 1] : expedition.benefits)[k] || 0)) ||
      Object.entries(p.meta).some(([k, level]) => level > upgrades[k].max))) return false;
  const ids = new Set(s.entities.map(e => e.id));
  if (ids.size !== s.entities.length || s.entities.some(e => e.id >= s.nextId || e.team >= count) ||
    s.scans.some(e => (e.team ?? 0) >= count) || s.strikes.some(e => e.team >= count) ||
    s.fields.some(e => e.team >= count) || s.recalls.some(e => e.team >= count) ||
    b.spatial.some(([, members]) => members.some(id => !ids.has(id)))) return false;
  const grid = (v: string) => v.length === Math.ceil(b.gridSize ** 2 / 4) && /^[0-9a-f]+$/.test(v);
  return grid(b.blocked) && b.sight.every(v => grid(v.visible) && grid(v.explored));
}

// Cache successful reads too. After any Storage failure, never revive old records.
function createMeridianPersistence(deps: PersistenceDependencies): MeridianPersistence {
  const { getStorage, clamp, upgrades, benefits, abilities, battlefields, missions, enemyCount, warn } = deps;
  // The unchanged profile format now also owns an optional expedition. Old separate
  // recipe records are not read or migrated. Profile purchases/settings remain intact.
  const PROFILE_KEY = 'meridian.profile.v1', STAGE_HISTORY_KEY = 'meridian.stage-history.v1';
  const memoryStore: Record<string, string | null> = {};
  let savedExpedition: unknown = null, expeditionError: string | null = null, saveBytes = 0;
  const Store = {
    available: true,
    get(k: string) {
      if (!this.available) return memoryStore[k] ?? null;
      try { return memoryStore[k] = getStorage().getItem(k); }
      catch { this.available = false; return memoryStore[k] ?? null; }
    },
    set(k: string, v: string) {
      memoryStore[k] = v;
      if (!this.available) return false;
      try { getStorage().setItem(k, v); return true; }
      catch { this.available = false; return false; }
    },
    remove(k: string) {
      memoryStore[k] = null;
      if (!this.available) return false;
      try {
        const storage = getStorage();
        if (storage.removeItem) storage.removeItem(k); else storage.setItem(k, '');
        return true;
      } catch { this.available = false; return false; }
    }
  };
  function defaultProfile(): MeridianProfile {
    return { version: 1, expeditionDepth: 0, aether: 0, tutorialComplete: false, upgrades: {},
      settings: { volume: 0.28, music: true, sfx: true, quality: 2, healthbars: false, showFps: false } };
  }
  function loadProfile() {
    const d = defaultProfile();
    try {
      const p = JSON.parse(Store.get(PROFILE_KEY) || 'null');
      savedExpedition = p?.expedition ?? null;
      if (p && p.version === 1) {
        d.expeditionDepth = clamp(Math.floor(Number(p.expeditionDepth) || 0), 0, 999999);
        d.aether = clamp(Math.floor(Number(p.aether) || 0), 0, 999999);
        d.tutorialComplete = p.tutorialComplete === true;
        for (const k in upgrades) d.upgrades[k] = clamp(Math.floor(Number(p.upgrades?.[k]) || 0), 0, upgrades[k].max);
        for (const key of Object.keys(d.settings)) {
          const value = p.settings?.[key];
          if (Object.hasOwn(p.settings || {}, key) && typeof value === typeof d.settings[key] &&
            (typeof value !== 'number' || Number.isFinite(value))) d.settings[key] = value;
        }
        d.settings.volume = clamp(d.settings.volume, 0, 1);
        d.settings.quality = clamp(Math.floor(d.settings.quality), 0, 2);
      }
    } catch (e) {
      // Later settings writes must not turn an unreadable battle into a fresh recipe.
      savedExpedition = { damaged: true };
      warn('Profile could not be read:', e);
    }
    return d;
  }
  function loadExpedition(): MeridianExpedition | null {
    expeditionError = null;
    try {
      const profileRecord = JSON.parse(Store.get(PROFILE_KEY) || 'null'), p = profileRecord?.expedition;
      savedExpedition = p ?? null;
      if (p == null) return null;
      if (profileRecord.version !== 1) throw Error('Incompatible profile save');
      if (p.version !== 7 || !Number.isInteger(p.faction) || p.faction < 0 || p.faction > 2 ||
        !p.encounter || !Object.hasOwn(battlefields, p.encounter.map) ||
        typeof p.encounter.mission !== 'string' || !Object.hasOwn(missions, p.encounter.mission) ||
        !missions[p.encounter.mission].maps.includes(p.encounter.map) ||
        !['resource-start', 'exploration'].includes(p.encounter.deployment) || !Array.isArray(p.abilities) ||
        p.abilities.length !== 4 || new Set(p.abilities).size !== 4 ||
        p.abilities.some((key: unknown) => typeof key !== 'string' || !Object.hasOwn(abilities, key)) ||
        !Number.isInteger(p.depth) || p.depth < 0 || p.depth > 999999 ||
        !Number.isInteger(p.encounter.seed) || p.encounter.seed < 1 || p.encounter.seed > 99999999)
        throw Error('Incompatible expedition recipe');
      const count = enemyCount(p.depth);
      if (!Array.isArray(p.encounter.enemies) || p.encounter.enemies.length !== count ||
        p.encounter.enemies.some((f: unknown) => !Number.isInteger(f) || Number(f) < 0 || Number(f) > 2) ||
        !Array.isArray(p.enemyBenefits) || p.enemyBenefits.length !== count ||
        p.enemyBenefits.some((b: unknown) => !b || typeof b !== 'object' || Array.isArray(b)))
        throw Error('Invalid expedition parties');
      const copyBenefits = (input: unknown): Record<string, number> => {
        if (!input || typeof input !== 'object' || Array.isArray(input) ||
          Object.entries(input).some(([key, v]) => !Object.hasOwn(benefits, key) || !Number.isSafeInteger(v) ||
            Number(v) < 0 || Number(v) > (benefits[key].max ?? 999999))) throw Error('Invalid expedition benefits');
        return { ...input } as Record<string, number>;
      };
      const normalized: MeridianExpedition = {
        version: 7, faction: p.faction, abilities: [...p.abilities], depth: p.depth,
        benefits: copyBenefits(p.benefits), enemyBenefits: p.enemyBenefits.map(copyBenefits),
        encounter: { ...p.encounter, enemies: [...p.encounter.enemies] }, offers: [], battle: null
      };
      if (!Array.isArray(p.offers) || p.offers.length > 3 || new Set(p.offers).size !== p.offers.length ||
        p.offers.some((key: unknown) => typeof key !== 'string' || !Object.hasOwn(benefits, key) ||
          (benefits[key].max !== undefined && (normalized.benefits[key] || 0) >= benefits[key].max!)))
        throw Error('Invalid benefit offers');
      normalized.offers = [...p.offers];
      if (!Object.hasOwn(p, 'battle')) throw Error('Missing battle save');
      if (p.battle !== null) {
        if (normalized.offers.length || !validExpeditionBattle(p.battle, normalized, deps)) throw Error('Invalid battle save');
        normalized.battle = p.battle;
      }
      return normalized;
    } catch (e) {
      savedExpedition ??= { damaged: true };
      expeditionError = 'This expedition save is damaged or incompatible. It cannot be restarted from its battle beginning.';
      warn('Expedition could not be restored:', e);
      return null;
    }
  }
  function write(profile: MeridianProfile, expedition: unknown) {
    // Serialization failures have the same permanent volatile semantics as quota errors.
    try {
      const text = JSON.stringify({ ...profile, expedition });
      saveBytes = text.length * 2;
      return Store.set(PROFILE_KEY, text);
    }
    catch (e) { Store.available = false; warn('Save could not be serialized:', e); return false; }
  }
  function saveProgress(profile: MeridianProfile, expedition: MeridianExpedition | null) {
    savedExpedition = expedition;
    expeditionError = null;
    const saved = write(profile, expedition);
    if (!expedition) Store.remove(STAGE_HISTORY_KEY);
    return saved;
  }
  return {
    get available() { return Store.available; },
    get expeditionError() { return expeditionError; },
    get saveBytes() { return saveBytes; },
    loadProfile,
    saveProfile(profile) { return write(profile, savedExpedition); },
    loadExpedition,
    saveProgress,
    loadStageHistory(expedition) {
      if (!expedition) return [];
      const current = { stage: expedition.depth + 1, map: expedition.encounter.map, seed: expedition.encounter.seed };
      try {
        const record = JSON.parse(Store.get(STAGE_HISTORY_KEY) || 'null'), stages = record?.stages;
        // The archive is cosmetic; losing it cannot invalidate the authoritative save.
        if (record?.version !== 1 || !Array.isArray(stages) || !stages.length || stages.length > current.stage ||
          stages.some((s, index) => !s || !Number.isInteger(s.stage) || s.stage < 1 ||
            s.stage !== current.stage - stages.length + index + 1 ||
            typeof s.map !== 'string' || !Object.hasOwn(battlefields, s.map) ||
            !Number.isInteger(s.seed) || s.seed < 1 || s.seed > 99999999)) return [current];
        const last = stages[stages.length - 1];
        if (last.map !== current.map || last.seed !== current.seed) return [current];
        return stages.map(s => ({ stage: s.stage, map: s.map, seed: s.seed }));
      } catch (e) { warn('Stage history reset:', e); return [current]; }
    },
    saveStageHistory(stages) { return Store.set(STAGE_HISTORY_KEY, JSON.stringify({ version: 1, stages })); }
  };
}
