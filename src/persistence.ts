/* Permanent profile persistence only. Runs are never stored. */
'use strict';

// Dependencies are supplied by app.js. Access storage lazily: even reading the
// browser's localStorage property can throw. Each instance owns its fallback.
function createMeridianPersistence(
  { getStorage, clamp, upgrades, warn }: PersistenceDependencies
): MeridianPersistence {
    const PROFILE_KEY = 'meridian.profile.v1';
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
      }
    };
    function defaultProfile(): MeridianProfile {
      return {
        version: 1,
        factionsUnlocked: false,
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
          d.factionsUnlocked = p.factionsUnlocked === true;
          for (let k in upgrades)
            d.upgrades[k] = clamp(Math.floor(Number(p.upgrades?.[k]) || 0), 0, upgrades[k].max);
          for (let key of Object.keys(d.settings))
            if (Object.hasOwn(p.settings || {}, key)) d.settings[key] = p.settings[key];
          d.settings.volume = clamp(Number(d.settings.volume) || 0, 0, 1);
          d.settings.quality = clamp(Number(d.settings.quality) || 0, 0, 2);
        }
      } catch (e: any) {
        warn('Profile reset:', e.message);
      }
      return d;
    }
    return {
      get available() { return Store.available; },
      loadProfile,
      saveProfile(profile: MeridianProfile) {
        return Store.set(PROFILE_KEY, JSON.stringify(profile));
      }
    };
}
