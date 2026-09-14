/* Permanent profile and between-battle expedition checkpoint persistence. */
'use strict';

// Dependencies are supplied by the app. Access storage lazily: even reading the
// browser's localStorage property can throw. Each instance owns its fallback.
function createMeridianPersistence(
  { getStorage, clamp, upgrades, benefits, battlefields, warn }: PersistenceDependencies
): MeridianPersistence {
    const PROFILE_KEY = 'meridian.profile.v1', EXPEDITION_KEY = 'meridian.expedition.v2';
    const memoryStore: Record<string, string> = {};
    const Store = {
      available: true,
      get(k: string) {
        try {
          return getStorage().getItem(k);
        } catch (e) {
          this.available = false;
          return memoryStore[k] || null;
        }
      },
      set(k: string, v: string) {
        memoryStore[k] = v;
        try {
          getStorage().setItem(k, v);
          return true;
        } catch (e) {
          this.available = false;
          return false;
        }
      },
      remove(k: string) {
        delete memoryStore[k];
        try {
          const storage = getStorage();
          if (storage.removeItem) storage.removeItem(k);
          else storage.setItem(k, '');
          return true;
        } catch (e) {
          this.available = false;
          return false;
        }
      }
    };
    function defaultProfile(): MeridianProfile {
      return {
        version: 1,
        expeditionDepth: 0,
        aether: 0,
        upgrades: {},
        settings: {
          volume: 0.28,
          music: true,
          sfx: true,
          quality: 2,
          healthbars: false
        }
      };
    }
    function loadProfile() {
      let d: MeridianProfile = defaultProfile();
      try {
        let p = JSON.parse(Store.get(PROFILE_KEY) || 'null');
        if (p && p.version === 1) {
          d.expeditionDepth = clamp(Math.floor(Number(p.expeditionDepth) || 0), 0, 999999);
          d.aether = clamp(Math.floor(Number(p.aether) || 0), 0, 999999);
          for (let k in upgrades)
            d.upgrades[k] = clamp(Math.floor(Number(p.upgrades?.[k]) || 0), 0, upgrades[k].max);
          for (let key of Object.keys(d.settings))
            if (Object.hasOwn(p.settings || {}, key)) d.settings[key] = p.settings[key];
          d.settings.volume = clamp(Number(d.settings.volume) || 0, 0, 1);
          d.settings.quality = clamp(Number(d.settings.quality) || 0, 0, 2);
        }
      } catch (e) {
        warn('Profile reset:', e instanceof Error ? e.message : String(e));
      }
      return d;
    }
    function loadExpedition(): MeridianExpedition | null {
      try {
        const p = JSON.parse(Store.get(EXPEDITION_KEY) || 'null');
        if (!p || p.version !== 2 || !Number.isInteger(p.faction) || p.faction < 0 || p.faction > 2 ||
          !p.encounter || !Number.isInteger(p.encounter.enemy) || p.encounter.enemy < 0 || p.encounter.enemy > 2 ||
          !Object.hasOwn(battlefields, p.encounter.map)) return null;
        const normalized: MeridianExpedition = {
          version: 2,
          faction: p.faction,
          depth: clamp(Math.floor(Number(p.depth) || 0), 0, 999999),
          benefits: {},
          enemyBenefits: {},
          encounter: {
            enemy: p.encounter.enemy,
            map: p.encounter.map,
            seed: clamp(Math.floor(Number(p.encounter.seed) || 1), 1, 99999999)
          },
          offers: []
        };
        for (const side of ['benefits', 'enemyBenefits'] as const)
          for (const key of Object.keys(benefits)) {
            const max = benefits[key].max ?? 999999;
            const count = clamp(Math.floor(Number(p[side]?.[key]) || 0), 0, max);
            if (count) normalized[side][key] = count;
          }
        if (Array.isArray(p.offers)) normalized.offers = [...new Set<unknown>(p.offers)]
          .filter((key): key is string => typeof key === 'string' && Object.hasOwn(benefits, key) &&
            (benefits[key].max === undefined || (normalized.benefits[key] || 0) < benefits[key].max))
          .slice(0, 3);
        return normalized;
      } catch (e) {
        warn('Expedition reset:', e instanceof Error ? e.message : String(e));
        return null;
      }
    }
    return {
      get available() { return Store.available; },
      loadProfile,
      saveProfile(profile: MeridianProfile) {
        return Store.set(PROFILE_KEY, JSON.stringify(profile));
      },
      loadExpedition,
      saveExpedition(expedition: MeridianExpedition) {
        return Store.set(EXPEDITION_KEY, JSON.stringify(expedition));
      },
      clearExpedition() {
        return Store.remove(EXPEDITION_KEY);
      }
    };
}
