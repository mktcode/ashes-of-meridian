/* Profile and checkpoint persistence. No DOM, renderer or simulation access. */
'use strict';

// Dependencies are supplied by app.js. Access storage lazily: even reading the
// browser's localStorage property can throw. Each instance owns its fallback.
function createMeridianPersistence({ getStorage, clamp, upgrades, difficulties, warn }) {
    const SAVE_KEY = 'meridian.operation.v1',
      PROFILE_KEY = 'meridian.profile.v1';
    const memoryStore = {};
    const Store = {
      available: true,
      get(k) {
        try {
          return getStorage().getItem(k);
        } catch (e) {
          this.available = false;
          return memoryStore[k] || null;
        }
      },
      set(k, v) {
        memoryStore[k] = v;
        try {
          getStorage().setItem(k, v);
          return true;
        } catch (e) {
          this.available = false;
          return false;
        }
      },
      remove(k) {
        delete memoryStore[k];
        try {
          getStorage().removeItem(k);
        } catch (e) {}
      }
    };
    function defaultProfile() {
      return {
        version: 1,
        unlocked: 0,
        credits: 0,
        medals: {},
        best: {},
        upgrades: {},
        skirmishBest: 0,
        ending: null,
        settings: {
          volume: 0.28,
          music: true,
          sfx: true,
          quality: 2,
          edge: false,
          tips: true,
          healthbars: false,
          difficulty: 'standard',
          cameraSpeed: 1
        }
      };
    }
    function loadProfile() {
      let d = defaultProfile();
      try {
        let p = JSON.parse(Store.get(PROFILE_KEY) || 'null');
        if (p && p.version === 1) {
          d.unlocked = clamp(Number(p.unlocked) || 0, 0, 15);
          d.credits = clamp(Number(p.credits) || 0, 0, 999);
          d.medals = p.medals || {};
          d.best = p.best || {};
          d.upgrades = p.upgrades || {};
          for (let k in upgrades) d.upgrades[k] = clamp(Number(d.upgrades[k]) || 0, 0, upgrades[k].max);
          d.ending = ['seal', 'open'].includes(p.ending) ? p.ending : null;
          d.skirmishBest = Number(p.skirmishBest) || 0;
          Object.assign(d.settings, p.settings || {});
          // Version-1 profiles may contain this obsolete camera toggle.
          delete d.settings.wasd;
          d.settings.volume = clamp(Number(d.settings.volume) || 0, 0, 1);
          d.settings.quality = clamp(Number(d.settings.quality) || 0, 0, 2);
          if (!difficulties[d.settings.difficulty]) d.settings.difficulty = 'standard';
        }
      } catch (e) {
        warn('Profile reset:', e.message);
      }
      return d;
    }
    return {
      get available() { return Store.available; },
      loadProfile,
      saveProfile(profile) {
        return Store.set(PROFILE_KEY, JSON.stringify(profile));
      },
      hasCheckpoint() {
        return !!Store.get(SAVE_KEY);
      },
      readCheckpoint() {
        const raw = Store.get(SAVE_KEY);
        // JSON null is a present checkpoint and must still reach restore().
        return { exists: !!raw, state: raw ? JSON.parse(raw) : null };
      },
      saveCheckpoint(state) {
        return Store.set(SAVE_KEY, JSON.stringify(state));
      },
      removeCheckpoint() {
        Store.remove(SAVE_KEY);
      },
      serializeBackup(profile, operation) {
        if (!operation) {
          try {
            operation = JSON.parse(Store.get(SAVE_KEY) || 'null');
          } catch (e) {}
        }
        return JSON.stringify({ format: 'ashes-of-meridian', version: 1, profile, operation });
      },
      parseBackup(text) {
        let d = JSON.parse(text);
        if (d.format !== 'ashes-of-meridian' || d.version !== 1 || d.profile?.version !== 1)
          throw Error('Not a Meridian backup.');
        if (d.operation) {
          if (
            !Array.isArray(d.operation.entities) ||
            d.operation.entities.length > 1500 ||
            d.operation.version !== 1
          )
            throw Error('Operation data is invalid.');
        }
        // Validation only: UI applies profile/settings/checkpoint in the old
        // order. Combining these writes would change partial-failure behavior.
        return d;
      }
    };
}
