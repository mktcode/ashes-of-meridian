    /* Deterministic fixed-step RTS simulation. Rendering and UI are independent. */
    'use strict';
    const UNIT_BODY_SCALE = 1.4;
    class MeridianGame {
      constructor(profile, emit = () => {}, createEffects = random => new MeridianEffects(random)) {
        this.profile = profile;
        this.emit = emit;
        this.s = null;
        this.world = null;
        this.ids = new Map();
        this.spatial = new Map();
        this.acc = 0;
        this.fogClock = 0;
        this.objectiveClock = 0;
        this.navDirty = false;
        this.random = seeded(1);
        this.effects = createEffects(() => this.random());
      }
    }
    function defineMeridianGameMethods(methods) {
      for (const [name, method] of Object.entries(methods))
        Object.defineProperty(MeridianGame.prototype, name, {
          value: method,
          configurable: true,
          writable: true
        });
    }
    defineMeridianGameMethods({
      start(opts = {}) {
        let faction = FACTIONS[opts.faction] ? opts.faction : 0,
          enemy = FACTIONS[opts.enemy] ? opts.enemy : 2,
          biome = BIOMES[opts.biome] ? opts.biome : 'ash',
          savedMeta = this.profile.upgrades || {},
          meta = Object.fromEntries(
            Object.keys(META).filter(key => Object.hasOwn(savedMeta, key)).map(key =>
              [key, clamp(Math.floor(Number(savedMeta[key]) || 0), 0, META[key].max)])
          ),
          seed = opts.seed || Math.floor(Math.random() * 1e8);
        this.s = {
          seed, faction, enemy, biome, meta,
          time: 0,
          alloy: 250,
          gas: 0,
          energy: 100,
          nextId: 1,
          entities: [], scans: [], strikes: [], fields: [],
          abilities: { orbital: 0, repair: 0, scan: 0, drop: 0 },
          wave: 0,
          nextWave: 95,
          enemyBudget: 900,
          stats: { kills: 0, lost: 0, trained: 0, gathered: 0, built: 0, damage: 0 },
          triggers: {},
          cam: { x: HOME.x + 5, z: HOME.z - 2, zoom: 57 },
          result: null,
          speed: 1
        };
        this.random = seeded(seed + 77);
        this.world = new Battlefield(seed, biome);
        this.ids.clear();
        this.effects.reset();
        this.acc = 0;
        this.fogClock = 0;
        this.objectiveClock = 0;
        let s = this.s;
        // The base starts with an HQ; upgrade workers are added after the seeded setup.
        this.spawnBuilding('hq', HOME.x, HOME.z, 0, faction);
        // Keep the former default loadout's RNG entry point for crystal amounts and enemy spawns.
        for (let i = 0; i < 24; i++) this.random();
        for (let [i, site] of RESOURCE_SITES.entries()) {
          for (let j = 0; j < 5; j++) {
            let p = this.crystalPosition(i, j);
            this.spawnResource('crystal', p.x, p.z, 1800 + Math.floor(this.random() * 900));
          }
          this.spawnResource('gas', site.x + (i === 0 ? 5 : 7), site.z + (i === 0 ? 18 : 7), 999999);
        }
        let site = ENEMY_SITES[0];
        this.spawnBuilding('hq', site.x, site.z, 1, enemy);
        this.spawnBuilding('turret', site.x - 6, site.z + 7, 1, enemy);
        this.spawnBuilding('turret', site.x + 7, site.z + 4, 1, enemy);
        this.spawnBuilding('barracks', site.x - 10, site.z - 1, 1, enemy);
        this.spawnBuilding('factory', site.x + 7, site.z - 8, 1, enemy);
        for (let j = 0; j < 7; j++) {
          let u = this.spawnUnit(j === 6 ? 'tank' : j === 5 ? 'artillery' : 'rifle',
            site.x - 8 + (j % 4) * 3, site.z + 12 + Math.floor(j / 4) * 2, 1, enemy);
          if (u) u.order = { type: 'guard', x: u.x, z: u.z };
        }
        this.world.rebuild(s.entities);
        this.rehash();
        for (let e of s.entities)
          if (e.kind === 'unit') {
            let p = this.unitPosition(e);
            if (!p) throw new Error('No free space for starting units.');
            Object.assign(e, p);
          }
        // Add bonus workers only after the original layout and enemy RNG draws.
        for (let i = 0; i < (meta.startingWorkers || 0); i++)
          if (!this.spawnUnit('worker', HOME.x - 7, HOME.z - 4 + i * 2, 0, faction))
            throw new Error('No free space for starting workers.');
        this.rehash();
        this.world.reveal(s.entities);
        this.emit('start', {});
        this.emit('radio', meta.startingWorkers
          ? 'Expedition command|Your starting workers will harvest alloy automatically. Expand your economy, then destroy the enemy command center.'
          : 'Expedition command|Recruit your first worker from Infanterie to establish your economy, then destroy the enemy command center.');
        return s;
      },
      spawn(kind, type, x, z, team, faction = 0, extra = {}) {
        let s = this.s,
          d = kind === 'building' ? BUILDINGS[type] : UNITS[type] || {},
          hp = d.hp || 1000;
        if (kind === 'unit') {
          if (faction === 1) hp *= 0.9;
          if (faction === 2) hp *= 0.85;
          if (faction === 0 && ['tank', 'artillery'].includes(type)) hp *= 1.15;
        }
        let e = {
          id: s.nextId++,
          kind,
          type,
          x,
          z,
          team,
          faction,
          hp,
          maxHp: hp,
          size: d.size || 2,
          vision: d.vision || (kind === 'building' ? 21 : 17),
          rot: team === 1 ? Math.PI : 0,
          progress: 1,
          queue: [],
          order: { type: 'idle' },
          path: [],
          pi: 0,
          walk: 0,
          cd: this.random() * 0.5,
          nextThink: 0,
          nextPath: 0,
          lastHit: -100,
          kills: 0,
          carry: 0,
          work: 0,
          shield: faction === 2 && kind === 'unit' ? hp * 0.32 : 0,
          maxShield: faction === 2 && kind === 'unit' ? hp * 0.32 : 0,
          ...extra
        };
        s.entities.push(e);
        this.ids.set(e.id, e);
        return e;
      },
      spawnBuilding(type, x, z, team, faction, extra = {}) {
        return this.spawn('building', type, x, z, team, faction, extra);
      },
      spawnUnit(type, x, z, team, faction, extra = {}) {
        const p = this.unitPosition({ type, size: UNITS[type].size, x, z, ...extra });
        if (!p) return null;
        return this.spawn('unit', type, p.x, p.z, team, faction, { ...extra, ...p });
      },
      crystalPosition(siteIndex, depositIndex) {
        // Leave a gap toward the adjacent starting factory at the eastern site.
        const phase = siteIndex === 5 ? 4.7 : siteIndex * 0.8;
        const site = RESOURCE_SITES[siteIndex], a = (depositIndex * Math.PI * 2) / 5 + phase;
        return { x: site.x + Math.sin(a) * 3.9, z: site.z + Math.cos(a) * 3.0 };
      },
      spawnResource(type, x, z, amount) {
        return this.spawn('resource', type, x, z, -1, 0, { amount, size: type === 'gas' ? 1.5 : 1.3 });
      },
      get(id) {
        let e = this.ids.get(id);
        return e && e.hp > 0 ? e : null;
      },
      alive(filter = () => true) {
        return this.s.entities.filter(e => e.hp > 0 && filter(e));
      },
      closest(pos, filter) {
        let best = null,
          d = Infinity;
        for (let e of this.s.entities)
          if (e.hp > 0 && filter(e)) {
            let dd = distance(pos, e);
            if (dd < d) {
              d = dd;
              best = e;
            }
          }
        return best;
      },
      rehash() {
        this.spatial.clear();
        for (let e of this.s.entities) {
          if (e.hp <= 0 || !['building', 'unit'].includes(e.kind)) continue;
          let key = Math.floor((e.x + 90) / 10) + Math.floor((e.z + 90) / 10) * 32;
          if (!this.spatial.has(key)) this.spatial.set(key, []);
          this.spatial.get(key).push(e);
        }
      },
      near(x, z, r, filter = () => true) {
        let out = [],
          a = Math.floor((x - r + 90) / 10),
          b = Math.floor((x + r + 90) / 10),
          c = Math.floor((z - r + 90) / 10),
          d = Math.floor((z + r + 90) / 10),
          rr = r * r;
        for (let j = c; j <= d; j++)
          for (let i = a; i <= b; i++) {
            let arr = this.spatial.get(i + j * 32);
            if (arr)
              for (let e of arr)
                if (e.hp > 0 && (e.x - x) ** 2 + (e.z - z) ** 2 < rr && filter(e))
                  out.push(e);
          }
        return out;
      },
      enemy(a, b) {
        return a.team === 1 ? b.team === 0 : b.team === 1;
      },
      visible(e) {
        return e.team === 0 || !!this.world.visible[this.world.idx(e.x, e.z)];
      },
    });
