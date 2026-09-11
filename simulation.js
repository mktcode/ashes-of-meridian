    /* Deterministic fixed-step RTS simulation. Rendering and UI are independent. */
    'use strict';
    const DIFFICULTY = {
      story: { name: 'Story', damage: 0.67, hp: 0.84, spawn: 0.72, interval: 1.2, start: 1.2 },
      standard: { name: 'Standard', damage: 1, hp: 1, spawn: 1, interval: 1, start: 1 },
      veteran: { name: 'Veteran', damage: 1.22, hp: 1.17, spawn: 1.28, interval: 0.88, start: 0.95 }
    };
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
      start(index, opts = {}) {
        let m = structuredClone(opts.mission || CAMPAIGN[index] || CAMPAIGN[0]);
        let difficulty = DIFFICULTY[opts.difficulty] ? opts.difficulty : 'standard',
          faction = opts.faction || 0,
          meta = index >= 0 && !opts.practice ? structuredClone(this.profile.upgrades || {}) : {},
          seed = opts.seed || m.seed || Math.floor(Math.random() * 1e8),
          d = DIFFICULTY[difficulty];
        m.seed = seed;
        this.s = {
          version: 1,
          index,
          m,
          seed,
          difficulty,
          faction,
          meta,
          practice: !!opts.practice,
          enemyMode: opts.enemy || m.enemy,
          time: 0,
          alloy: Math.floor((m.startAlloy || 850) * d.start) + (meta.stores || 0) * 100,
          gas: Math.floor((m.startGas || 280) * d.start),
          energy: 100,
          nextId: 1,
          entities: [],
          upgrades: { weapons: 0, armor: 0, mining: 0, range: 0, healing: 0, engines: 0 },
          research: [],
          scans: [],
          strikes: [],
          fields: [],
          abilities: { orbital: 0, repair: 0, scan: 0, drop: 0 },
          wave: 0,
          nextWave: m.type === 'tutorial' ? 170 : 95 * d.interval,
          enemyBudget: 900,
          stats: {
            kills: 0,
            lost: 0,
            trained: 0,
            gathered: 0,
            built: 0,
            damage: 0,
            heroLost: false,
            caches: 0,
            relayHold: 0,
            evacuations: 0,
            convoys: 0
          },
          triggers: {},
          cam: { x: HOME.x + 5, z: HOME.z - 2, zoom: 57 },
          result: null,
          speed: 1
        };
        this.random = seeded(seed + 77);
        this.world = new Battlefield(seed, m.biome);
        this.ids.clear();
        this.effects.reset();
        this.acc = 0;
        this.fogClock = 0;
        this.objectiveClock = 0;
        let s = this.s;
        this.spawnBuilding('hq', HOME.x, HOME.z, 0, faction);
        this.spawnBuilding('barracks', -39, 53, 0, faction);
        if (m.type !== 'tutorial') this.spawnBuilding('depot', -51, 63, 0, faction);
        if (m.tier >= 2) {
          this.spawnBuilding('refinery', -63, 60, 0, faction);
          this.spawnBuilding('factory', -37, 67, 0, faction);
        }
        if (m.tier >= 3) {
          this.spawnBuilding('depot', -27, 61, 0, faction);
          this.spawnBuilding('lab', -27, 72, 0, faction);
        }
        this.spawnUnit('hero', -45, 42, 0, faction);
        let workers = 5 + (meta.logistics || 0);
        for (let i = 0; i < workers; i++)
          this.spawnUnit('worker', -57 + (i % 3) * 1.8, 46 + Math.floor(i / 3) * 1.8, 0, faction);
        let troops = (m.type === 'tutorial' ? 3 : m.tier >= 3 ? 7 : 5) + (meta.veterans || 0);
        for (let i = 0; i < troops; i++)
          this.spawnUnit('rifle', -51 + (i % 4) * 1.8, 38 - Math.floor(i / 4) * 1.8, 0, faction);
        if (m.tier >= 1 && m.type !== 'tutorial') this.spawnUnit('medic', -45, 39, 0, faction);
        if (m.tier >= 2) {
          this.spawnUnit('tank', -40, 37, 0, faction);
          this.spawnUnit('scout', -35, 42, 0, faction);
        }
        if (m.tier >= 3) {
          this.spawnUnit('tank', -36, 35, 0, faction);
          this.spawnUnit('medic', -42, 40, 0, faction);
        }
        for (let [i, site] of RESOURCE_SITES.entries()) {
          for (let j = 0; j < 5; j++) {
            let p = this.crystalPosition(i, j);
            this.spawnResource('crystal', p.x, p.z, 1800 + Math.floor(this.random() * 900));
          }
          this.spawnResource('gas', site.x + (i === 0 ? 5 : 7), site.z + (i === 0 ? 18 : 7), 999999);
        }
        for (let b of s.entities.filter(e => e.type === 'refinery'))
          b.gasId = this.closest(b, e => e.type === 'gas' && e.kind === 'resource')?.id;
        let count = m.bases || 2;
        for (let i = 0; i < count; i++) {
          let site = ENEMY_SITES[i],
            ef = opts.enemy === 'mixed' ? i % 3 : m.enemy === undefined ? 2 : m.enemy,
            base = this.spawnBuilding('hq', site.x, site.z, 1, ef, { tag: 'enemyHQ' });
          if (m.type === 'tutorial') {
            base.hp = base.maxHp = 1050;
          } else {
            this.spawnBuilding('turret', site.x - 6, site.z + 7, 1, ef);
            if (m.tier >= 3) this.spawnBuilding('turret', site.x + 7, site.z + 4, 1, ef);
          }
          this.spawnBuilding('barracks', site.x - 10, site.z - 1, 1, ef);
          if (m.tier >= 2) this.spawnBuilding('factory', site.x + 7, site.z - 8, 1, ef);
          let n = m.type === 'tutorial' ? 3 : 4 + m.tier;
          for (let j = 0; j < n; j++) {
            let u = this.spawnUnit(
              j === n - 1 && m.tier >= 2 ? 'tank' : j === n - 2 && m.tier >= 3 ? 'artillery' : 'rifle',
              site.x - 8 + (j % 4) * 3,
              site.z + 12 + Math.floor(j / 4) * 2,
              1,
              ef
            );
            u.order = { type: 'guard', x: u.x, z: u.z };
          }
        }
        let relays = ['capture', 'domination', 'signal', 'finale'].includes(m.type);
        if (relays) {
          for (let i = 0; i < (m.type === 'signal' ? 3 : m.count || 3); i++) {
            let p = RELAY_SITES[i];
            this.spawnObjective('relay', p.x, p.z, {
              label: (m.type === 'finale' ? 'ANCHOR ' : 'RELAY ') + String.fromCharCode(65 + i),
              owner: -1,
              capture: 0
            });
          }
        }
        if (['salvage', 'rescue', 'signal'].includes(m.type))
          for (let i = 0; i < (m.count || 4); i++) {
            let p = CACHE_SITES[i];
            this.spawnObjective('cache', p.x, p.z, {
              label: (m.type === 'rescue' ? 'SHELTER ' : 'MEMORY ') + (i + 1),
              progress: 0,
              tag: m.type === 'rescue' ? 'shelter' : 'cache'
            });
            for (let j = 0; j < 2 + m.tier; j++) {
              let u = this.spawnUnit(
                j === 0 && m.tier >= 2 ? 'scout' : 'rifle',
                p.x - 3 + (j % 3) * 3,
                p.z - 6 + Math.floor(j / 3) * 2,
                1,
                m.enemy
              );
              u.order = { type: 'guard', x: p.x, z: p.z };
            }
          }
        if (m.type === 'siege') {
          for (let i = 0; i < m.count; i++) {
            let p = RELAY_SITES[i];
            this.spawnBuilding('lab', p.x, p.z, 1, m.enemy, {
              tag: 'generator',
              label: 'WARD ' + (i + 1)
            });
            this.spawnBuilding('turret', p.x + 5, p.z + 4, 1, m.enemy);
          }
          let c = this.spawnBuilding('hq', 17, -65, 1, m.enemy, {
            tag: 'citadel',
            invulnerable: true,
            label: 'WARD CITADEL'
          });
          c.hp = c.maxHp = 4200 + m.tier * 450;
        }
        if (m.type === 'escort') {
          for (let i = 0; i < (m.count || 1); i++) {
            let path = ROUTES[i];
            this.spawnUnit('convoy', path[0][0], path[0][1], 0, faction, {
              tag: 'convoy',
              route: path,
              routeIndex: 1,
              evacuated: false,
              label: i ? 'ARCHIVE TWO' : 'CIVILIAN CRAWLER',
              lastEscort: 0
            });
          }
        }
        if (m.type === 'allydefense') {
          let h = this.spawnBuilding('hq', 0, 0, 2, 1, { tag: 'heart', label: 'THE MEMORY HEART' });
          h.hp = h.maxHp = 4200;
          for (let i = 0; i < 3; i++)
            this.spawnBuilding('turret', Math.sin(i * 2.1) * 8, Math.cos(i * 2.1) * 8, 2, 1);
          for (let i = 0; i < 6; i++) {
            let u = this.spawnUnit(i === 5 ? 'medic' : 'rifle', -5 + i * 2, 8, 2, 1);
            u.order = { type: 'guard', x: 0, z: 0 };
          }
        }
        if (m.type === 'finale') {
          let boss = this.spawnUnit('avatar', 17, -63, 1, 2, { tag: 'boss', invulnerable: true });
          boss.order = { type: 'guard', x: 17, z: -63 };
        }
        this.world.rebuild(s.entities);
        this.rehash();
        for (let e of s.entities)
          if (e.kind === 'unit') {
            let p = this.world.nearest(e.x, e.z);
            e.x = p.x;
            e.z = p.z;
          }
        this.rehash();
        this.world.reveal(s.entities);
        this.emit('start', { mission: m });
        this.emit(
          'radio',
          m.radio?.[0] ||
            'Expedition command|Your frontier is waiting. Establish your economy, secure expansions, and break the enemy command network.'
        );
        return s;
      }
      spawn(kind, type, x, z, team, faction = 0, extra = {}) {
        let s = this.s,
          d = kind === 'building' ? BUILDINGS[type] : UNITS[type] || {},
          hp = d.hp || 1000;
        if (team === 1) hp *= DIFFICULTY[s.difficulty].hp;
        if (kind === 'unit') {
          if (faction === 1) hp *= 0.9;
          if (faction === 2) hp *= 0.85;
          if (faction === 0 && ['tank', 'scout', 'artillery'].includes(type)) hp *= 1.15;
          if (team === 0 && type === 'hero') hp += (s.meta.resolve || 0) * 150;
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
      }
      spawnBuilding(type, x, z, team, faction, extra = {}) {
        return this.spawn('building', type, x, z, team, faction, extra);
      }
      spawnUnit(type, x, z, team, faction, extra = {}) {
        return this.spawn('unit', type, x, z, team, faction, extra);
      }
      crystalPosition(siteIndex, depositIndex) {
        // Leave a gap toward the adjacent starting factory at the eastern site.
        const phase = siteIndex === 5 ? 4.7 : siteIndex * 0.8;
        const site = RESOURCE_SITES[siteIndex], a = (depositIndex * Math.PI * 2) / 5 + phase;
        return { x: site.x + Math.sin(a) * 3.9, z: site.z + Math.cos(a) * 3.0 };
      }
      spawnResource(type, x, z, amount) {
        return this.spawn('resource', type, x, z, -1, 0, { amount, size: type === 'gas' ? 1.5 : 1.3 });
      }
      spawnObjective(type, x, z, extra = {}) {
        return this.spawn('objective', type, x, z, -1, 0, {
          size: 2.8,
          owner: -1,
          progress: 0,
          capture: 0,
          invulnerable: true,
          ...extra
        });
      }
      get(id) {
        let e = this.ids.get(id);
        return e && e.hp > 0 ? e : null;
      }
      alive(filter = () => true) {
        return this.s.entities.filter(e => e.hp > 0 && !e.evacuated && filter(e));
      }
      closest(pos, filter) {
        let best = null,
          d = Infinity;
        for (let e of this.s.entities)
          if (e.hp > 0 && !e.evacuated && filter(e)) {
            let dd = distance(pos, e);
            if (dd < d) {
              d = dd;
              best = e;
            }
          }
        return best;
      }
      rehash() {
        this.spatial.clear();
        for (let e of this.s.entities) {
          if (e.hp <= 0 || e.evacuated || !['building', 'unit'].includes(e.kind)) continue;
          let key = Math.floor((e.x + 90) / 10) + Math.floor((e.z + 90) / 10) * 32;
          if (!this.spatial.has(key)) this.spatial.set(key, []);
          this.spatial.get(key).push(e);
        }
      }
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
                if (e.hp > 0 && !e.evacuated && (e.x - x) ** 2 + (e.z - z) ** 2 < rr && filter(e))
                  out.push(e);
          }
        return out;
      }
      enemy(a, b) {
        return a.team === 1 ? b.team === 0 || b.team === 2 : b.team === 1;
      }
      visible(e) {
        return e.team === 0 || e.team === 2 || !!this.world.visible[this.world.idx(e.x, e.z)];
      }
      cap() {
        return Math.min(
          180,
          this.alive(e => e.team === 0 && e.kind === 'building' && e.progress >= 1).reduce(
            (a, e) => a + (BUILDINGS[e.type].cap || 0),
            0
          )
        );
      }
      supply() {
        let n = 0;
        for (let e of this.s.entities)
          if (e.hp > 0 && e.team === 0) {
            if (e.kind === 'unit') n += UNITS[e.type].supply || 0;
            for (let q of e.queue || []) n += UNITS[q.type]?.supply || 0;
          }
        return n;
      }
      cost(type, kind = 'unit') {
        let d = kind === 'building' ? BUILDINGS[type] : UNITS[type],
          mul = kind === 'unit' ? (this.s.faction === 1 ? 0.85 : this.s.faction === 2 ? 1.12 : 1) : 1;
        return { cost: Math.ceil(d.cost * mul), gas: d.gas || 0 };
      }
      afford(c) {
        return this.s.alloy >= c.cost && this.s.gas >= c.gas;
      }
      spend(c) {
        if (!this.afford(c)) {
          this.emit(
            'toast',
            this.s.alloy < c.cost
              ? 'Insufficient alloy. Assign more workers to crystals.'
              : 'Insufficient aether. Build a refinery beside a vent.'
          );
          return false;
        }
        this.s.alloy -= c.cost;
        this.s.gas -= c.gas;
        return true;
      }
      has(type) {
        return (
          this.alive(e => e.team === 0 && e.kind === 'building' && e.type === type && e.progress >= 1)
            .length > 0
        );
      }
      train(type, preferred) {
        let s = this.s,
          d = UNITS[type];
        if (!d) return false;
        if (d.tier > s.m.tier) {
          this.emit('toast', 'This unit is not yet available in this operation.');
          return false;
        }
        if (
          type === 'hero' &&
          (this.alive(e => e.team === 0 && e.type === 'hero').length ||
            this.alive(e => e.team === 0).some(e => e.queue?.some(q => q.type === 'hero')))
        ) {
          this.emit('toast', 'Your commander is already deployed or in reconstruction.');
          return false;
        }
        let producers = this.alive(
          e =>
            e.team === 0 &&
            e.kind === 'building' &&
            e.type === d.from &&
            e.progress >= 1 &&
            e.queue.length < 5
        );
        producers.sort(
          (a, b) =>
            (a.id === preferred ? -100 : a.queue.length) - (b.id === preferred ? -100 : b.queue.length)
        );
        let b = producers[0];
        if (!b) {
          this.emit(
            'toast',
            this.has(d.from)
              ? 'Production queues are full (five orders per structure).'
              : `Construct a ${buildingName(d.from, s.faction)} first.`
          );
          return false;
        }
        if (this.supply() + d.supply > this.cap()) {
          this.emit('toast', 'Supply limit. Complete another logistics depot.');
          return false;
        }
        let c = this.cost(type);
        if (!this.spend(c)) return false;
        b.queue.push({ type, progress: 0, time: d.time, ...c });
        this.emit('queued', type);
        return true;
      }
      cancelQueue(id, index) {
        let b = this.get(id);
        if (!b || b.team !== 0 || !b.queue[index]) return;
        let q = b.queue.splice(index, 1)[0];
        this.s.alloy += q.cost;
        this.s.gas += q.gas;
        this.emit('toast', 'Recruitment canceled. Resources refunded.');
      }
      tech(key) {
        let s = this.s,
          t = TECH[key];
        if (!t) return false;
        let level = s.upgrades[key] || 0;
        if (level >= t.max) {
          this.emit('toast', 'Research is already at maximum level.');
          return false;
        }
        if (s.research.some(r => r.key === key)) {
          this.emit('toast', 'This technology is already in research.');
          return false;
        }
        let lab = this.alive(e => e.team === 0 && e.type === 'lab' && e.progress >= 1).find(
          e => !s.research.some(r => r.building === e.id)
        );
        if (!lab) {
          this.emit(
            'toast',
            this.has('lab') ? 'All research annexes are busy.' : 'Complete a research annex first.'
          );
          return false;
        }
        let c = { cost: t.cost * (level + 1), gas: t.gas * (level + 1) };
        if (!this.spend(c)) return false;
        s.research.push({
          key,
          level: level + 1,
          building: lab.id,
          progress: 0,
          time: t.time * (1 + level * 0.25),
          ...c
        });
        this.emit('toast', 'Research initiated: ' + t.name);
        return true;
      }
      canBuild(type, p) {
        let s = this.s,
          d = BUILDINGS[type];
        if (!d) return 'Unknown structure.';
        if (d.tier > s.m.tier) return 'Unavailable in this operation.';
        if (d.requires && !this.has(d.requires))
          return `Requires ${buildingName(d.requires, s.faction)}.`;
        if (!this.alive(e => e.team === 0 && e.type === 'worker').length)
          return 'Recruit a worker at your command center first.';
        if (!p) return '';
        let r = d.size;
        if (Math.abs(p.x) > 83 - r || Math.abs(p.z) > 83 - r)
          return 'Too close to the battlefield boundary.';
        if (!this.world.explored[this.world.idx(p.x, p.z)])
          return 'Scout this location before building.';
        for (let i = 0; i < 12; i++) {
          let a = (i / 12) * Math.PI * 2;
          if (this.world.staticGrid[this.world.idx(p.x + Math.sin(a) * r, p.z + Math.cos(a) * r)])
            return 'Terrain obstructs the foundation.';
        }
        if (this.world.staticGrid[this.world.idx(p.x, p.z)]) return 'Terrain obstructs the foundation.';
        for (let e of this.s.entities) {
          if (e.hp <= 0 || e.kind === 'unit') continue;
          if (e.kind === 'resource' && e.type === 'gas' && type === 'refinery') continue;
          if (distance(p, e) < r + e.size + 0.8) return 'Leave room around structures and resources.';
        }
        if (type === 'refinery') {
          let gas = this.closest(p, e => e.kind === 'resource' && e.type === 'gas');
          if (!gas || distance(p, gas) > 8) return 'Place within 8 meters of an aether vent.';
          if (this.alive(e => e.type === 'refinery' && e.gasId === gas.id).length)
            return 'This vent already supplies a refinery.';
        }
        return '';
      }
      build(type, p, selected = []) {
        let reason = this.canBuild(type, p);
        if (reason) {
          this.emit('toast', reason);
          return false;
        }
        let workers = this.alive(e => e.team === 0 && e.type === 'worker');
        workers.sort(
          (a, b) =>
            distance(a, p) -
            distance(b, p) +
            (selected.includes(a.id) ? -100 : 0) -
            (selected.includes(b.id) ? -100 : 0)
        );
        let w = workers[0];
        let path = this.world.path(w.x, w.z, p.x, p.z);
        if (!path.length && distance(w, p) > 5) {
          this.emit('toast', 'A worker cannot reach this location.');
          return false;
        }
        let c = this.cost(type, 'building');
        if (!this.spend(c)) return false;
        let b = this.spawnBuilding(type, p.x, p.z, 0, this.s.faction, { progress: 0.06, paid: c });
        b.hp = b.maxHp * 0.06;
        if (type === 'refinery')
          b.gasId = this.closest(p, e => e.type === 'gas' && e.kind === 'resource')?.id;
        this.world.rebuild(this.s.entities);
        this.setOrder(w, { type: 'build', id: b.id, x: p.x, z: p.z });
        this.emit('build', b);
        return true;
      }
      cancelConstruction(id) {
        let e = this.get(id);
        if (!e || e.team !== 0 || e.kind !== 'building' || e.progress >= 1) return;
        let c = e.paid || this.cost(e.type, 'building');
        this.s.alloy += c.cost * 0.75;
        this.s.gas += c.gas * 0.75;
        e.hp = 0;
        e.deathAt = this.s.time;
        this.navDirty = true;
        this.emit('toast', 'Foundation canceled. 75% of resources recovered.');
      }
      setOrder(e, order) {
        if (e.type === 'convoy' || e.evacuated) return;
        if (e.kind === 'building') {
          if (e.team === 0 && ['move', 'attackMove'].includes(order.type)) {
            e.rally = { x: order.x, z: order.z };
            this.emit('rally', e.rally);
          }
          return;
        }
        e.order = { ...order };
        e.target = null;
        e.path = [];
        e.pi = 0;
        e.nextPath = 0;
        e.stuck = 0;
      }
      command(ids, order) {
        let units = ids.map(id => this.get(id)).filter(e => e && e.team === 0);
        let mobile = units.filter(e => e.kind === 'unit' && e.type !== 'convoy');
        let cols = Math.max(1, Math.ceil(Math.sqrt(mobile.length))),
          i = 0;
        for (let e of units) {
          let o = { ...order };
          if (e.kind === 'unit' && e.type !== 'convoy') {
            if (['move', 'attackMove'].includes(o.type)) {
              let j = i++,
                spacing = mobile.some(u => ['tank', 'artillery'].includes(u.type)) ? 2.4 : 1.7;
              o.x += ((j % cols) - (cols - 1) / 2) * spacing;
              o.z += (Math.floor(j / cols) - (Math.ceil(mobile.length / cols) - 1) / 2) * spacing;
            }
            if (o.type === 'smart') {
              let target = this.get(o.id);
              if (target && this.enemy(e, target))
                o = { type: 'attack', id: target.id, x: target.x, z: target.z };
              else if (target?.kind === 'resource' && target.type === 'crystal' && e.type === 'worker')
                o = { type: 'mine', id: target.id };
              else if (
                target &&
                e.type === 'worker' &&
                (target.team === 0 || target.team === 2) &&
                target.progress < 1
              )
                o = { type: 'build', id: target.id };
              else if (
                target &&
                e.type === 'worker' &&
                (target.team === 0 || target.team === 2) &&
                target.hp < target.maxHp
              )
                o = { type: 'repair', id: target.id };
              else if (target && target.kind === 'unit' && (target.team === 0 || target.team === 2))
                o = { type: 'follow', id: target.id };
              else o = { type: 'move', x: order.x, z: order.z };
            }
          } else if (o.type === 'smart') o = { type: 'move', x: order.x, z: order.z };
          this.setOrder(e, o);
        }
        if (mobile.length)
          this.emit('order', { type: order.type, x: order.x, z: order.z, count: mobile.length });
      }
      pathTo(e, p) {
        if (e.nextPath > this.s.time && e.path?.length && e.pi < e.path.length) return;
        e.path = this.world.path(e.x, e.z, p.x, p.z, UNITS[e.type]?.flying);
        e.pi = 0;
        e.nextPath = this.s.time + 0.8;
        e.pathGoal = { x: p.x, z: p.z };
        e.pathVersion = this.world.pathVersion;
      }
      move(e, p, dt, stop = 1) {
        if (distance(e, p) < stop) {
          e.path = [];
          e.pi = 0;
          return true;
        }
        if (
          !e.path?.length ||
          e.pi >= e.path.length ||
          e.pathVersion !== this.world.pathVersion ||
          (e.pathGoal && distance(e.pathGoal, p) > 3)
        )
          this.pathTo(e, p);
        let q = e.path[e.pi];
        if (!q) return false;
        let dx = q.x - e.x,
          dz = q.z - e.z,
          d = Math.hypot(dx, dz);
        if (d < 0.65) {
          e.pi++;
          q = e.path[e.pi];
          if (!q) return distance(e, p) < stop + 1 || this.world.blockedAt(p.x, p.z);
          dx = q.x - e.x;
          dz = q.z - e.z;
          d = Math.hypot(dx, dz);
        }
        let u = UNITS[e.type],
          speed =
            u.speed *
            (e.faction === 1 ? 1.1 : 1) *
            (e.team === 0 && this.s.upgrades.engines ? 1.18 : 1) *
            (e.slowed > this.s.time ? 0.65 : 1),
          step = Math.min(d, speed * dt),
          vx = dx / (d || 1),
          vz = dz / (d || 1);
        let ax = 0,
          az = 0;
        if (!u.flying) {
          for (let other of this.near(
            e.x,
            e.z,
            3.8,
            a => a.id !== e.id && a.kind === 'unit' && !UNITS[a.type]?.flying
          )) {
            let ddx = e.x - other.x,
              ddz = e.z - other.z,
              dd = Math.hypot(ddx, ddz),
              min = (e.size + other.size) * 0.82;
            if (dd < min && dd > 0.001) {
              let force = ((min - dd) / min) * 0.9;
              ax += (ddx / dd) * force;
              az += (ddz / dd) * force;
            }
          }
        }
        let nx = e.x + (vx + ax) * step,
          nz = e.z + (vz + az) * step;
        if (u.flying || !this.world.blockedAt(nx, nz)) {
          e.x = clamp(nx, -85, 85);
          e.z = clamp(nz, -85, 85);
          e.stuck = 0;
        } else {
          if (!this.world.blockedAt(nx, e.z)) e.x = nx;
          else if (!this.world.blockedAt(e.x, nz)) e.z = nz;
          else {
            e.stuck = (e.stuck || 0) + dt;
            if (e.stuck > 0.65) {
              let near = this.world.nearest(e.x + vx * 2, e.z + vz * 2);
              e.path = [];
              e.nextPath = 0;
              if (this.world.blockedAt(e.x, e.z)) {
                e.x = near.x;
                e.z = near.z;
              }
              e.stuck = 0;
            }
          }
        }
        e.rot = angleLerp(e.rot, Math.atan2(vx, vz), dt * 9);
        e.walk += dt * speed;
        return false;
      }
      finishOrder(e) {
        e.order = { type: 'idle' };
        e.path = [];
        e.pi = 0;
      }
      damage(e, amount, source, quiet = false) {
        if (!e || e.hp <= 0 || e.invulnerable) return;
        if (e.team === 0 || e.team === 2) amount *= 1 - (this.s.upgrades.armor || 0) * 0.1;
        amount = Math.max(0.05, amount);
        e.lastHit = this.s.time;
        e.lastSource = source?.id;
        if (e.shield > 0) {
          let absorbed = Math.min(e.shield, amount);
          e.shield -= absorbed;
          amount -= absorbed;
          e.shieldFlash = this.s.time + 0.18;
        }
        e.hp -= amount;
        if (source?.team === 0) this.s.stats.damage += amount;
        if (!quiet && amount > 25 && this.visible(e)) this.effects.damageNumber(e, amount);
        if (e.hp <= 0) this.kill(e, source);
        if (
          e.team === 0 &&
          e.kind === 'building' &&
          e.hp > 0 &&
          this.s.time - (this.s.triggers.baseAlert || -100) > 14
        ) {
          this.s.triggers.baseAlert = this.s.time;
          this.emit('alert', {
            text:
              e.type === 'hq' ? 'Command center under attack!' : 'Your structures are under attack.',
            danger: true,
            x: e.x,
            z: e.z
          });
        }
      }
      kill(e, source) {
        e.hp = 0;
        e.deathAt = this.s.time;
        e.target = null;
        if (e.kind === 'building') this.navDirty = true;
        if (e.team === 1) {
          this.s.stats.kills++;
          if (source && source.team === 0) {
            source.kills++;
            if (source.kills === 5) {
              source.maxHp *= 1.12;
              source.hp = Math.min(source.maxHp, source.hp + source.maxHp * 0.25);
              this.emit('alert', {
                text: unitName(source.type, source.faction) + ' promoted to veteran.'
              });
            }
          }
        }
        if (e.team === 0 && e.kind === 'unit' && e.type !== 'convoy') {
          this.s.stats.lost++;
          if (e.type === 'hero') {
            this.s.stats.heroLost = true;
            this.emit(
              'radio',
              'Chief Rook|The captain is down. We have a recovery signal. Reconstruct the command team at headquarters.'
            );
          }
        }
        if (this.visible(e)) {
          this.effects.explosion(
            e.x,
            e.z,
            e.kind === 'building' ? 3.5 : e.type === 'avatar' ? 7 : 1.2,
            e.faction === 1 ? 0xaee2ac : 0xf3b17c
          );
          this.emit('explosion', { x: e.x, z: e.z, big: e.kind === 'building' || e.type === 'tank' });
        }
        if (e.tag === 'enemyHQ')
          this.emit('alert', { text: 'Enemy command center destroyed.', x: e.x, z: e.z });
        if (e.tag === 'generator')
          this.emit('alert', { text: 'Ward generator destroyed.', x: e.x, z: e.z });
      }
      rangedStats(e) {
        let d = e.kind === 'building' ? BUILDINGS[e.type] : UNITS[e.type],
          s = this.s;
        let range = (d.range || 0) + ((e.team === 0 || e.team === 2) && s.upgrades.range ? 2 : 0),
          damage =
            (d.damage || 0) *
            (e.faction === 2 ? 1.12 : 1) *
            (e.team === 1 ? DIFFICULTY[s.difficulty].damage : 1 + (s.upgrades.weapons || 0) * 0.15) *
            (e.kills >= 5 ? 1.12 : 1);
        return { ...d, range, damage };
      }
      fire(e, target) {
        let d = this.rangedStats(e);
        e.cd = d.reload || 1;
        let dx = target.x - e.x,
          dz = target.z - e.z;
        e.rot = Math.atan2(dx, dz);
        if (e.type === 'artillery' || e.type === 'avatar') {
          let travel = e.type === 'artillery' ? 0.85 : 1.0;
          this.s.strikes.push({
            x: target.x,
            z: target.z,
            at: this.s.time + travel,
            damage: d.damage,
            radius: d.splash,
            source: e.id,
            team: e.team,
            type: 'shell'
          });
          this.effects.shell(e, target, travel);
        } else {
          this.damage(target, d.damage, e);
          if (d.splash)
            for (let n of this.near(
              target.x,
              target.z,
              d.splash,
              a => a.id !== target.id && this.enemy(e, a) && a.kind !== 'objective'
            ))
              this.damage(n, d.damage * 0.45, e, true);
          if (this.visible(e) || this.visible(target)) {
            this.effects.shot(e, target);
            this.emit('shot', { x: e.x, z: e.z, heavy: e.type === 'tank' });
          }
        }
      }
      acquire(e) {
        let d = this.rangedStats(e);
        if (!d.damage) return null;
        let radius = Math.max(d.range + (e.kind === 'building' ? 3 : 6), e.team === 1 ? 19 : 16);
        let a = this.near(
          e.x,
          e.z,
          radius,
          n =>
            this.enemy(e, n) &&
            !n.invulnerable &&
            (!d.groundOnly || !UNITS[n.type]?.flying) &&
            (e.team === 1 || this.visible(n))
        );
        if (e.order.type === 'guard')
          a = a.filter(n => distance(n, { x: e.order.x, z: e.order.z }) < 28);
        a.sort((a, b) => {
          let ca = distance(e, a) - a.size + (a.kind === 'building' ? 3 : 0),
            cb = distance(e, b) - b.size + (b.kind === 'building' ? 3 : 0);
          return ca - cb;
        });
        return a[0] || null;
      }
      combat(e, dt) {
        let d = this.rangedStats(e),
          o = e.order;
        if (e.nextThink <= this.s.time) {
          e.nextThink = this.s.time + 0.28 + (e.id % 3) * 0.035;
          let target = o.type === 'attack' ? this.get(o.id) : this.get(e.target);
          if (
            target &&
            (!this.enemy(e, target) ||
              target.invulnerable ||
              (!this.visible(target) && e.team !== 1) ||
              (d.groundOnly && UNITS[target.type]?.flying) ||
              distance(e, target) > d.range + 14)
          )
            target = null;
          if (!target) target = this.acquire(e);
          e.target = target?.id || null;
        }
        let t = this.get(e.target);
        if (!t) return false;
        let dist = distance(e, t) - t.size * 0.72;
        if (dist <= d.range && dist >= (d.minRange || 0)) {
          e.rot = angleLerp(e.rot, Math.atan2(t.x - e.x, t.z - e.z), dt * 8);
          if (e.cd <= 0) this.fire(e, t);
          return !['move', 'follow'].includes(o.type);
        }
        if (
          e.kind === 'unit' &&
          !['move', 'hold', 'stop', 'mine', 'repair', 'build', 'follow'].includes(o.type)
        ) {
          if (d.minRange && dist < d.minRange) {
            let dx = e.x - t.x,
              dz = e.z - t.z,
              len = Math.hypot(dx, dz) || 1;
            this.move(e, { x: e.x + (dx / len) * 5, z: e.z + (dz / len) * 5 }, dt, 0.3);
          } else this.move(e, t, dt, d.range + t.size * 0.65 - 0.6);
          return true;
        }
        return false;
      }
      worker(e, dt) {
        let o = e.order,
          s = this.s;
        if (['move', 'attackMove', 'hold', 'stop', 'attack', 'follow'].includes(o.type)) return false;
        if (o.type === 'build' || o.type === 'repair') {
          let b = this.get(o.id);
          if (!b || b.team === 1) {
            this.finishOrder(e);
            return true;
          }
          let need = b.size + 3.0;
          if (distance(e, b) > need) {
            this.move(e, b, dt, need);
            return true;
          }
          e.rot = angleLerp(e.rot, Math.atan2(b.x - e.x, b.z - e.z), dt * 5);
          if (b.progress < 1) {
            let rate = (dt / BUILDINGS[b.type].time) * (1 + (s.meta.industry || 0) * 0.1);
            let old = b.progress;
            b.progress = Math.min(1, b.progress + rate);
            b.hp = Math.min(b.maxHp, b.hp + (b.progress - old) * b.maxHp);
            if (b.progress >= 1) {
              s.stats.built++;
              this.emit('complete', { type: b.type, x: b.x, z: b.z });
              this.finishOrder(e);
            }
          } else if (b.hp < b.maxHp && s.alloy > 0.1) {
            let amount = Math.min(dt * 38, b.maxHp - b.hp, s.alloy * 10);
            b.hp += amount;
            s.alloy -= amount * 0.1;
          } else this.finishOrder(e);
          this.effects.construction(e, b, dt);
          return true;
        }
        if (o.type === 'idle' && e.team === 0) {
          let target = this.closest(
            e,
            n => n.kind === 'resource' && n.type === 'crystal' && n.amount > 0
          );
          if (target) e.order = { type: 'mine', id: target.id };
        }
        if (e.order.type !== 'mine') return false;
        let maxCarry = Math.round(18 * (1 + (s.upgrades.mining || 0) * 0.25));
        if (e.carry >= maxCarry || e.returning) {
          e.returning = true;
          let h = this.closest(e, n => n.team === e.team && n.type === 'hq' && n.progress >= 1);
          if (!h) return true;
          if (distance(e, h) > h.size + 3.1) {
            this.move(e, h, dt, h.size + 3.1);
            return true;
          }
          if (e.team === 0) {
            s.alloy += e.carry;
            s.stats.gathered += e.carry;
          }
          e.carry = 0;
          e.returning = false;
          e.path = [];
          e.nextPath = 0;
          return true;
        }
        let n = this.get(e.order.id);
        if (!n || n.amount <= 0) {
          n = this.closest(e, a => a.kind === 'resource' && a.type === 'crystal' && a.amount > 0);
          if (!n) {
            if (e.carry) e.returning = true;
            else e.order = { type: 'idle' };
            return true;
          }
          e.order.id = n.id;
          e.path = [];
        }
        if (distance(e, n) > 2.15) {
          this.move(e, n, dt, 2.15);
          return true;
        }
        e.rot = angleLerp(e.rot, Math.atan2(n.x - e.x, n.z - e.z), dt * 8);
        e.work += dt;
        if (e.work >= 1.25) {
          e.work = 0;
          let take = Math.min(maxCarry - e.carry, 6, n.amount);
          e.carry += take;
          n.amount -= take;
          if (n.amount <= 0) {
            n.hp = 0;
            n.deathAt = s.time;
          }
        }
        this.effects.mining(e, n, dt, () => this.visible(e));
        return true;
      }
      medic(e, dt) {
        let allies = this.near(
          e.x,
          e.z,
          UNITS.medic.range + 2,
          n => n.id !== e.id && !this.enemy(e, n) && n.kind === 'unit' && n.hp < n.maxHp && n.hp > 0
        );
        allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
        let t = allies[0];
        if (t) {
          t.hp = Math.min(t.maxHp, t.hp + UNITS.medic.heal * (this.s.upgrades.healing ? 1.4 : 1) * dt);
          if (e.cd <= 0 && this.visible(e)) {
            e.cd = 0.5;
            this.effects.healing(e, t);
          }
        }
        if (e.order.type === 'attackMove') {
          let front = this.near(
            e.x,
            e.z,
            19,
            n =>
              n.id !== e.id &&
              n.team === e.team &&
              n.kind === 'unit' &&
              UNITS[n.type]?.damage > 5 &&
              distance(n, e.order) < distance(e, e.order)
          );
          if (front.length && distance(e, front[0]) > 6) this.move(e, front[0], dt, 5.5);
          else if (!front.length) this.move(e, e.order, dt, 2);
          return true;
        }
        return false;
      }
      convoy(e, dt) {
        if (e.evacuated) return;
        let escort = this.near(
            e.x,
            e.z,
            13,
            a => (a.team === 0 || a.team === 2) && a.kind === 'unit' && (UNITS[a.type]?.damage || 0) > 5
          ),
          enemy = this.near(e.x, e.z, 10, a => a.team === 1 && a.kind === 'unit');
        e.escorted = escort.length > 0;
        e.blocked = enemy.length > 0;
        if (!e.escorted || e.blocked) {
          e.path = [];
          return;
        }
        let p = e.route[e.routeIndex];
        if (!p) {
          e.evacuated = true;
          this.s.stats.convoys++;
          this.emit('radio', 'Chief Rook|Crawler at extraction. Every passenger accounted for.');
          this.effects.explosion(e.x, e.z, 1, 0x99e8d8);
          return;
        }
        let target = { x: p[0], z: p[1] };
        if (this.move(e, target, dt, 2.7)) {
          e.routeIndex++;
          e.path = [];
          e.nextPath = 0;
        }
      }
      step(dt) {
        if (!this.s || this.s.result) return;
        let s = this.s;
        s.time += dt;
        s.energy = Math.min(200, s.energy + dt * 0.8 * (1 + (s.meta.command || 0) * 0.15));
        this.rehash();
        if (this.navDirty) {
          this.world.rebuild(s.entities);
          this.navDirty = false;
        }
        let economic = s.entities.filter(e => e.hp > 0 && e.kind === 'building' && e.progress >= 1);
        for (let e of economic) {
          if (e.team === 0) {
            if (e.type === 'hq') {
              s.alloy += dt * 1.0;
              s.gas += dt * 0.25;
              if (e.faction === 0)
                for (let n of this.near(
                  e.x,
                  e.z,
                  11,
                  a => a.team === 0 && s.time - a.lastHit > 4 && a.hp < a.maxHp
                ))
                  n.hp = Math.min(n.maxHp, n.hp + dt * 3);
            }
            if (e.type === 'refinery') s.gas += dt * 1.7 * (1 + (s.upgrades.mining || 0) * 0.25);
          }
          if (e.team === 1)
            s.enemyBudget += dt * (e.type === 'hq' ? 2.8 : e.type === 'barracks' ? 0.8 : 0);
        }
        for (let e of s.entities) {
          if (e.hp <= 0 || e.evacuated || e.kind === 'resource' || e.kind === 'objective') continue;
          e.cd -= dt;
          if (e.maxShield && s.time - e.lastHit > 7)
            e.shield = Math.min(e.maxShield, e.shield + dt * e.maxShield * 0.075);
          if (e.kind === 'unit' && s.time - e.lastHit > 6) {
            let regen = (e.faction === 1 ? 2.1 : 0) + (e.team === 0 && s.upgrades.healing ? 2 : 0);
            e.hp = Math.min(e.maxHp, e.hp + regen * dt);
          }
          if (e.kind === 'building') {
            if (e.progress < 1) continue;
            if (e.queue.length) {
              let q = e.queue[0];
              q.progress += (dt / q.time) * (1 + (s.meta.industry || 0) * 0.1);
              if (q.progress >= 1) {
                let loc = this.world.nearest(e.x + e.size + 1.8, e.z + 2),
                  u = this.spawnUnit(q.type, loc.x, loc.z, e.team, e.faction);
                e.queue.shift();
                if (q.type !== 'worker' && q.type !== 'hero') s.stats.trained++;
                if (e.rally && q.type !== 'worker')
                  u.order = { type: 'attackMove', x: e.rally.x, z: e.rally.z };
                this.emit('trained', u);
              }
            }
            if (BUILDINGS[e.type].damage) this.combat(e, dt);
            continue;
          }
          if (e.type === 'convoy') {
            this.convoy(e, dt);
            continue;
          }
          if (e.type === 'worker' && this.worker(e, dt)) continue;
          if (e.type === 'medic' && this.medic(e, dt)) continue;
          let fighting = UNITS[e.type].damage > 0 ? this.combat(e, dt) : false;
          if (fighting) continue;
          let o = e.order;
          if (o.type === 'move' || o.type === 'attackMove') {
            if (this.move(e, o, dt, 1.0)) this.finishOrder(e);
          } else if (o.type === 'attack') {
            let t = this.get(o.id);
            if (t) {
              if (t.invulnerable && e.team === 0 && s.time - (s.triggers.shieldWarning || -100) > 10) {
                this.emit('toast', 'The target is shielded. Complete the shield objectives first.');
                s.triggers.shieldWarning = s.time;
              }
              this.move(e, t, dt, (this.rangedStats(e).range || 2) + t.size * 0.5);
            } else this.finishOrder(e);
          } else if (o.type === 'follow') {
            let t = this.get(o.id);
            if (t) this.move(e, t, dt, 4);
            else this.finishOrder(e);
          } else if (o.type === 'guard' && distance(e, o) > 5) this.move(e, o, dt, 3.5);
        }
        for (let r of s.research) {
          let lab = this.get(r.building);
          if (!lab) {
            r.canceled = true;
            s.alloy += r.cost * 0.5;
            s.gas += r.gas * 0.5;
            continue;
          }
          r.progress += dt / r.time;
          if (r.progress >= 1) {
            s.upgrades[r.key] = r.level;
            r.done = true;
            this.emit('research', { name: TECH[r.key].name, level: r.level });
            if (r.key === 'range') for (let e of s.entities) if (e.team === 0) e.vision += 3;
          }
        }
        s.research = s.research.filter(r => !r.done && !r.canceled);
        for (let strike of s.strikes) {
          if (s.time < strike.at) continue;
          strike.done = true;
          let source = this.get(strike.source) || { id: 0, team: strike.team || 0 };
          for (let e of this.near(
            strike.x,
            strike.z,
            strike.radius + 4,
            a => (strike.team === -1 || this.enemy(source, a)) && ['unit', 'building'].includes(a.kind)
          )) {
            let dist = distance(e, strike);
            if (dist < strike.radius + e.size * 0.7)
              this.damage(e, strike.damage * (dist < strike.radius * 0.5 ? 1 : 0.65), source);
          }
          this.effects.explosion(
            strike.x,
            strike.z,
            strike.type === 'orbital' ? 5 : 2,
            strike.team === 0 ? 0xa2e3db : 0xf2b084
          );
          this.emit('explosion', { x: strike.x, z: strike.z, big: true });
          if (strike.type === 'orbital' && s.faction === 1)
            s.fields.push({ type: 'bloom', x: strike.x, z: strike.z, r: 10, until: s.time + 7 });
        }
        s.strikes = s.strikes.filter(a => !a.done);
        for (let field of s.fields) {
          if (field.until < s.time) continue;
          let targets = this.near(field.x, field.z, field.r, e =>
            field.type === 'bloom' ? e.team === 1 : e.team === 0 || e.team === 2
          );
          for (let e of targets) {
            if (field.type === 'bloom') {
              this.damage(e, dt * 23, { team: 0 }, true);
              e.slowed = s.time + 1;
            } else e.hp = Math.min(e.maxHp, e.hp + dt * 10);
          }
        }
        s.fields = s.fields.filter(f => f.until > s.time);
        s.scans = s.scans.filter(a => a.until > s.time);
        if (s.time >= s.nextWave) this.wave();
        let warning = s.nextWave - s.time;
        if (warning < 15 && !s.triggers['wave' + s.wave]) {
          s.triggers['wave' + s.wave] = true;
          this.emit('alert', { text: 'Hostile reinforcements inbound in 15 seconds.', danger: true });
        }
        if (
          s.m.biome === 'star' &&
          s.time > 150 &&
          Math.floor(s.time / 100) > (s.triggers.solar || 0)
        ) {
          s.triggers.solar = Math.floor(s.time / 100);
          let target = this.alive(e => e.team === 0 && e.kind === 'unit' && e.type !== 'worker')[
            Math.floor(
              this.random() *
                this.alive(e => e.team === 0 && e.kind === 'unit' && e.type !== 'worker').length
            )
          ];
          if (target) {
            s.strikes.push({
              x: target.x + 5,
              z: target.z,
              at: s.time + 5,
              radius: 8,
              damage: 120,
              team: -1,
              type: 'flare'
            });
            this.emit('alert', {
              text: 'Stellar eruption detected. Leave the marked area.',
              danger: true,
              x: target.x + 5,
              z: target.z
            });
          }
        }
        if (s.m.type === 'allydefense' && Math.floor(s.time / 75) > (s.triggers.choirAid || 0)) {
          s.triggers.choirAid = Math.floor(s.time / 75);
          for (let i = 0; i < 3; i++) {
            let u = this.spawnUnit(i === 2 ? 'medic' : 'rifle', -4 + i * 3, 6, 2, 1);
            u.order = { type: 'guard', x: 0, z: 0 };
          }
        }
        this.objectiveClock += dt;
        if (this.objectiveClock >= 0.2) {
          this.objectiveTick(this.objectiveClock);
          this.objectiveClock = 0;
        }
        this.fogClock += dt;
        if (this.fogClock >= 0.35) {
          this.world.reveal(s.entities, s.scans);
          this.fogClock = 0;
        }
        if (s.time > 40 && !s.triggers.radio1) {
          s.triggers.radio1 = true;
          if (s.m.radio?.[1]) this.emit('radio', s.m.radio[1]);
        }
        if (s.time > 185 && !s.triggers.radio2) {
          s.triggers.radio2 = true;
          if (s.m.radio?.[2]) this.emit('radio', s.m.radio[2]);
        }
        if (s.entities.some(e => e.hp <= 0 && s.time - e.deathAt > 9)) {
          s.entities = s.entities.filter(e => e.hp > 0 || s.time - e.deathAt <= 9);
          this.ids = new Map(s.entities.map(e => [e.id, e]));
        }
      }
      wave() {
        let s = this.s,
          d = DIFFICULTY[s.difficulty],
          bases = this.alive(e => e.team === 1 && e.tag === 'enemyHQ');
        s.wave++;
        s.nextWave = s.time + (s.m.waveInterval || 80) * d.interval * Math.max(0.68, 1 - s.wave * 0.01);
        let external = ['defend', 'survival', 'rescue', 'allydefense', 'endless'].includes(s.m.type);
        if (!external && !bases.length) return;
        let site = bases.length ? bases[(s.wave - 1) % bases.length] : ENEMY_SITES[s.wave % 3],
          faction = site.faction === undefined ? s.m.enemy : site.faction;
        let n =
          s.m.type === 'tutorial'
            ? Math.min(7, 2 + s.wave)
            : Math.min(24, Math.ceil((3 + s.m.tier * 1.25 + s.wave * 0.65) * d.spawn));
        if (!external) n = Math.max(2, Math.ceil(n * (0.5 + (0.5 * bases.length) / (s.m.bases || 2))));
        let baseGoal = this.closest(site, e => e.team === 0 && e.type === 'hq') || HOME,
          goal =
            s.m.type === 'allydefense' && s.wave % 3 !== 0
              ? this.alive(e => e.tag === 'heart')[0] || baseGoal
              : s.m.type === 'escort' && s.wave % 3 === 0
                ? this.alive(e => e.type === 'convoy')[0] || baseGoal
                : baseGoal;
        if (s.m.type === 'domination' || s.m.type === 'signal' || s.m.type === 'finale') {
          let relay = this.alive(e => e.kind === 'objective' && e.type === 'relay' && e.owner === 0);
          if (relay.length && s.wave % 2 === 0) goal = relay[s.wave % relay.length];
        }
        let deployed = 0;
        for (let i = 0; i < n; i++) {
          if (this.alive(e => e.team === 1 && e.kind === 'unit').length >= 130) break;
          let r = this.random(),
            type = 'rifle';
          if (s.m.tier >= 3 && s.wave >= 3 && r < 0.1) type = 'air';
          else if (s.m.tier >= 2 && s.wave >= 2 && r < 0.19) type = 'artillery';
          else if (s.m.tier >= 2 && r < 0.38) type = 'tank';
          else if (s.m.tier >= 1 && r < 0.48) type = 'medic';
          else if (s.m.tier >= 1 && r < 0.65) type = 'scout';
          let c = UNITS[type].cost * 0.5;
          if (!external && s.enemyBudget < c && i > 1) break;
          s.enemyBudget = Math.max(0, s.enemyBudget - c);
          let p = this.world.nearest(site.x - 8 + (i % 4) * 2.3, site.z + 10 + Math.floor(i / 4) * 2.3);
          let u = this.spawnUnit(type, p.x, p.z, 1, faction);
          u.order = { type: 'attackMove', x: goal.x + ((i % 3) - 1) * 2, z: goal.z };
          deployed++;
        }
        if (deployed) this.emit('wave', { wave: s.wave, x: site.x, z: site.z, n: deployed });
      }
      objectiveTick(dt) {
        let s = this.s,
          m = s.m;
        if (s.result) return;
        let objectives = this.alive(e => e.kind === 'objective'),
          combat = a => a.kind === 'unit' && a.type !== 'worker' && a.type !== 'convoy';
        for (let e of objectives) {
          let friendly = this.near(
              e.x,
              e.z,
              e.type === 'cache' ? 7 : 9,
              a => (a.team === 0 || a.team === 2) && combat(a)
            ),
            hostile = this.near(e.x, e.z, 9, a => a.team === 1 && combat(a));
          if (e.type === 'cache') {
            if (friendly.length && !hostile.length) e.progress = Math.min(1, e.progress + dt / 6);
            if (e.progress >= 1) {
              s.stats.caches++;
              e.hp = 0;
              e.deathAt = s.time;
              s.alloy += 150;
              s.gas += 75;
              this.emit('alert', {
                text:
                  e.tag === 'shelter'
                    ? 'Civilian shelter evacuated. Volunteers have joined.'
                    : 'Memory recovered. +150 alloy / +75 aether.',
                x: e.x,
                z: e.z
              });
              this.effects.explosion(e.x, e.z, 1.2, 0x99e6d0);
              if (e.tag === 'shelter') {
                for (let i = 0; i < 3; i++)
                  this.spawnUnit(i === 2 ? 'medic' : 'rifle', e.x - 2 + i * 2, e.z + 2, 0, s.faction);
              } else {
                for (let i = 0; i < 3; i++) {
                  let p = this.world.nearest(e.x + 12 + i * 2, e.z - 10),
                    u = this.spawnUnit('rifle', p.x, p.z, 1, m.enemy);
                  u.order = { type: 'attackMove', x: e.x, z: e.z };
                }
              }
            }
          } else if (e.type === 'relay') {
            let old = e.owner;
            if (friendly.length && !hostile.length) {
              e.capture = Math.min(
                1,
                e.capture + (dt / 28) * (1 + Math.min(friendly.length - 1, 4) * 0.15)
              );
              if (e.capture >= 1) e.owner = 0;
            } else if (hostile.length && !friendly.length) {
              e.capture = Math.max(
                0,
                e.capture - (dt / 32) * (1 + Math.min(hostile.length - 1, 4) * 0.12)
              );
              if (e.capture <= 0) e.owner = 1;
            }
            if (old !== e.owner && e.owner === 0) {
              s.alloy += 75;
              s.gas += 35;
              this.emit('alert', { text: e.label + ' secured.', x: e.x, z: e.z });
              this.emit('capture', e);
            } else if (old === 0 && e.owner === 1)
              this.emit('alert', {
                text: e.label + ' lost. Retake the relay.',
                danger: true,
                x: e.x,
                z: e.z
              });
            e.contested = !!(friendly.length && hostile.length);
          }
        }
        let relays = this.alive(e => e.type === 'relay'),
          owned = relays.filter(e => e.owner === 0).length,
          all = relays.length > 0 && owned === relays.length;
        if (
          (m.type === 'domination' || m.type === 'signal') &&
          all &&
          (m.type !== 'signal' || s.stats.caches >= m.count)
        )
          s.stats.relayHold += dt;
        if (m.type === 'siege') {
          let remaining = this.alive(e => e.tag === 'generator').length;
          for (let c of this.alive(e => e.tag === 'citadel')) {
            if (!remaining && c.invulnerable) {
              c.invulnerable = false;
              this.emit(
                'radio',
                'Chief Rook|Ward network down. Their citadel is exposed. Bring it down.'
              );
            }
          }
        }
        if (m.type === 'finale') {
          for (let b of this.alive(e => e.tag === 'boss')) {
            if (all && b.invulnerable) {
              b.invulnerable = false;
              b.order = { type: 'attackMove', x: 0, z: 0 };
              s.triggers.bossUnshielded = true;
              this.emit('radio', 'Elias Venn|It can’t hide behind us now. Mara. Finish it.');
            }
            if (s.triggers.bossUnshielded && b.hp / b.maxHp < 0.5 && !s.triggers.bossRage) {
              s.triggers.bossRage = true;
              this.emit('alert', {
                text: 'The avatar is destabilizing. Reinforcements detected.',
                danger: true
              });
              this.wave();
            }
          }
        }
        if (m.type === 'defend') {
          let n = Math.min(4, Math.floor(s.time / (m.duration / 4)));
          if (n > s.stats.evacuations) {
            s.stats.evacuations = n;
            this.emit(
              'radio',
              `Chief Rook|Lift ${n} is clear. ${n < 4 ? 'Keep that perimeter intact.' : 'All shuttles are away.'}`
            );
          }
        }
        if (!this.alive(e => e.team === 0 && e.type === 'hq').length) {
          this.finish(
            false,
            'Your last command center has fallen. The flotilla has lost its foothold.'
          );
          return;
        }
        if (
          m.type === 'escort' &&
          s.entities.filter(e => e.hp > 0 && e.tag === 'convoy').length < (m.count || 1)
        ) {
          this.finish(false, 'A civilian crawler was destroyed. Its passengers had no other way out.');
          return;
        }
        if (m.type === 'allydefense' && !this.alive(e => e.tag === 'heart').length) {
          this.finish(false, 'The Memory Heart has been silenced. Vesper’s voices are gone.');
          return;
        }
        if (m.type === 'finale' && s.time >= m.limit) {
          this.finish(false, 'The stellar rupture consumed the corridor. The dark star has opened.');
          return;
        }
        let win = false;
        switch (m.type) {
          case 'tutorial':
            win =
              s.stats.gathered >= 300 &&
              s.stats.trained >= 6 &&
              !this.alive(e => e.tag === 'enemyHQ').length;
            break;
          case 'conquest':
            win = !this.alive(e => e.tag === 'enemyHQ').length;
            break;
          case 'defend':
          case 'survival':
          case 'allydefense':
            win = s.time >= m.duration;
            break;
          case 'capture':
            win = all;
            break;
          case 'escort':
            win = s.stats.convoys >= m.count;
            break;
          case 'salvage':
            win = s.stats.caches >= m.count;
            break;
          case 'rescue':
            win = s.stats.caches >= m.count && s.time >= m.duration;
            break;
          case 'domination':
            win = s.stats.relayHold >= m.hold;
            break;
          case 'signal':
            win = s.stats.caches >= m.count && s.stats.relayHold >= m.hold;
            break;
          case 'siege':
            win = !this.alive(e => e.tag === 'generator' || e.tag === 'citadel').length;
            break;
          case 'finale':
            win = s.triggers.bossUnshielded && !this.alive(e => e.tag === 'boss').length;
            break;
        }
        if (win)
          this.finish(
            true,
            m.outro || 'The sector is secure. Your people have earned another sunrise.'
          );
      }
      objectiveRows() {
        let s = this.s,
          m = s.m,
          rows = [],
          add = (text, current, max, sub = '') =>
            rows.push({ text, current, max, sub, done: current >= max });
        let hqs = this.alive(e => e.tag === 'enemyHQ').length,
          relays = this.alive(e => e.type === 'relay'),
          owned = relays.filter(e => e.owner === 0).length;
        if (m.type === 'tutorial') {
          add('Harvest alloy', Math.min(300, Math.floor(s.stats.gathered)), 300);
          add('Recruit combat units', Math.min(6, s.stats.trained), 6);
          add('Destroy the raider command', hqs === 0 ? 1 : 0, 1);
        }
        if (m.type === 'conquest')
          add('Destroy enemy command centers', (m.bases || 2) - hqs, m.bases || 2);
        if (['defend', 'survival', 'allydefense'].includes(m.type))
          add(
            m.type === 'allydefense' ? 'Defend the Memory Heart' : 'Hold the perimeter',
            Math.min(s.time, m.duration),
            m.duration,
            formatTime(Math.max(0, m.duration - s.time)) + ' REMAINING'
          );
        if (m.type === 'defend') add('Evacuation lifts departed', s.stats.evacuations, 4);
        if (m.type === 'allydefense') {
          let e = this.alive(e => e.tag === 'heart')[0];
          rows.push({
            text: 'Memory Heart integrity',
            current: e?.hp || 0,
            max: e?.maxHp || 4200,
            sub: Math.ceil(((e?.hp || 0) / (e?.maxHp || 4200)) * 100) + '% HULL',
            done: false
          });
        }
        if (['capture', 'domination', 'signal', 'finale'].includes(m.type))
          add(
            m.type === 'finale' ? 'Secure the stellar anchors' : 'Control the signal relays',
            owned,
            relays.length || 3
          );
        if (['domination', 'signal'].includes(m.type))
          add(
            'Simultaneous signal alignment',
            Math.min(s.stats.relayHold, m.hold),
            m.hold,
            formatTime(s.stats.relayHold) + ' / ' + formatTime(m.hold)
          );
        if (['salvage', 'rescue', 'signal'].includes(m.type))
          add(
            m.type === 'rescue' ? 'Evacuate civilian shelters' : 'Recover memory fragments',
            s.stats.caches,
            m.count
          );
        if (m.type === 'rescue')
          add(
            'Hold until the corridor opens',
            Math.min(s.time, m.duration),
            m.duration,
            formatTime(Math.max(0, m.duration - s.time)) + ' REMAINING'
          );
        if (m.type === 'escort') {
          for (let [i, e] of s.entities.filter(a => a.hp > 0 && a.tag === 'convoy').entries())
            add(
              e.label || 'Crawler ' + (i + 1),
              e.evacuated ? e.route.length : e.routeIndex - 1,
              e.route.length,
              e.evacuated
                ? 'EXTRACTED'
                : e.blocked
                  ? 'HALTED · HOSTILES NEARBY'
                  : e.escorted
                    ? 'ESCORT IN POSITION'
                    : 'WAITING FOR COMBAT ESCORT'
            );
          if (s.stats.convoys > 0 && !rows.length) add('Crawlers extracted', s.stats.convoys, m.count);
        }
        if (m.type === 'siege') {
          let gen = this.alive(e => e.tag === 'generator').length,
            c = this.alive(e => e.tag === 'citadel')[0];
          add('Destroy the ward generators', m.count - gen, m.count);
          add(
            'Destroy the ward citadel',
            c ? 0 : 1,
            1,
            c?.invulnerable ? 'SHIELDED' : 'SHIELD DISABLED'
          );
        }
        if (m.type === 'finale') {
          let b = this.alive(e => e.tag === 'boss')[0];
          add(
            'Silence the Starbound Avatar',
            b ? b.maxHp - b.hp : 1,
            b?.maxHp || 1,
            b?.invulnerable ? 'SHIELDED' : b ? Math.ceil(b.hp) + ' HULL' : 'DESTROYED'
          );
          rows.push({
            text: 'Stellar rupture',
            current: Math.max(0, m.limit - s.time),
            max: m.limit,
            sub: formatTime(Math.max(0, m.limit - s.time)) + ' REMAINING',
            done: false
          });
        }
        if (m.type === 'endless') {
          rows.push({
            text: 'Survive the endless assault',
            current: s.wave,
            max: s.wave + 1,
            sub: 'WAVE ' + s.wave + ' · ' + formatTime(s.time),
            done: false
          });
          rows.push({
            text: 'Extract after 5 minutes',
            current: Math.min(s.time, 300),
            max: 300,
            sub:
              s.time >= 300
                ? 'EXTRACTION AVAILABLE IN PAUSE MENU'
                : 'OPTIONAL · STAY FOR A HIGHER SCORE',
            done: s.time >= 300
          });
        }
        return rows;
      }
      ability(kind, p) {
        let s = this.s,
          defs = {
            orbital: { energy: 85, cd: 48 },
            repair: { energy: 45, cd: 28 },
            scan: { energy: 25, cd: 17 },
            drop: { energy: 95, cd: 75 }
          },
          d = defs[kind];
        if (!d) return false;
        if (s.abilities[kind] > s.time) {
          this.emit(
            'toast',
            'Ability recharging: ' + Math.ceil(s.abilities[kind] - s.time) + ' seconds.'
          );
          return false;
        }
        if (s.energy < d.energy) {
          this.emit('toast', 'Insufficient command energy.');
          return false;
        }
        if (kind !== 'scan' && !this.world.explored[this.world.idx(p.x, p.z)]) {
          this.emit('toast', 'Scout or scan this location first.');
          return false;
        }
        if (kind === 'drop' && this.supply() + 8 > this.cap()) {
          this.emit('toast', 'Reinforcements require 8 free supply.');
          return false;
        }
        s.energy -= d.energy;
        s.abilities[kind] = s.time + d.cd;
        if (kind === 'orbital') {
          s.strikes.push({
            x: p.x,
            z: p.z,
            at: s.time + 2.2,
            radius: s.faction === 2 ? 8 : 10,
            damage: s.faction === 2 ? 440 : s.faction === 1 ? 260 : 355,
            team: 0,
            type: 'orbital'
          });
          s.scans.push({ ...p, r: 17, until: s.time + 8 });
          this.emit('radio', 'Orbital command|Target solution confirmed. Clear the impact zone.');
        }
        if (kind === 'repair') {
          for (let e of this.near(p.x, p.z, 12, a => a.team === 0 || a.team === 2)) {
            e.hp = Math.min(e.maxHp, e.hp + 180);
            if (e.maxShield) e.shield = Math.min(e.maxShield, e.shield + 100);
          }
          s.fields.push({ type: 'repair', x: p.x, z: p.z, r: 12, until: s.time + 8 });
          this.emit('heal', p);
        }
        if (kind === 'scan') {
          s.scans.push({ ...p, r: 32, until: s.time + 22 });
          this.emit('scan', p);
          this.world.reveal(s.entities, s.scans);
        }
        if (kind === 'drop') {
          for (let i = 0; i < 4; i++) {
            let loc = this.world.nearest(p.x + (i % 2) * 2 - 1, p.z + Math.floor(i / 2) * 2 - 1);
            this.spawnUnit('rifle', loc.x, loc.z, 0, s.faction);
            this.effects.drop(loc, FACTIONS[s.faction].color);
          }
          this.emit('radio', 'Reinforcement channel|Boots on the ground. Point us at the trouble.');
        }
        return true;
      }
      finish(win, text) {
        if (this.s.result) return;
        let s = this.s,
          h = this.alive(e => e.team === 0 && e.type === 'hq'),
          integrity = h.length ? Math.max(...h.map(e => e.hp / e.maxHp)) : 0,
          stars = win
            ? 1 +
              (integrity >= 0.5 ? 1 : 0) +
              (!s.stats.heroLost && s.stats.lost <= Math.max(12, 8 + s.m.tier * 8) ? 1 : 0)
            : 0;
        s.result = {
          win,
          text,
          stars,
          time: s.time,
          score: Math.floor(
            s.stats.kills * 80 +
              s.stats.caches * 400 +
              s.stats.convoys * 1000 +
              s.stats.damage * 0.04 +
              (win ? 2500 : 0) -
              s.stats.lost * 35
          ),
          integrity
        };
        this.emit('result', s.result);
      }
      snapshot() {
        let data = structuredClone(this.s);
        data.explored = Array.from(this.world.explored);
        return data;
      }
      restore(data) {
        if (!data || data.version !== 1 || !Array.isArray(data.entities) || data.entities.length > 1500)
          throw Error('This save is not a valid Meridian operation.');
        if (!Number.isFinite(data.time) || !Number.isFinite(data.seed) || !DIFFICULTY[data.difficulty])
          throw Error('Save data is invalid.');
        let validKinds = ['unit', 'building', 'objective', 'resource'];
        for (let e of data.entities) {
          if (
            !validKinds.includes(e.kind) ||
            !Number.isFinite(e.x) ||
            !Number.isFinite(e.z) ||
            Math.abs(e.x) > 150 ||
            Math.abs(e.z) > 150 ||
            !Number.isFinite(e.hp)
          )
            throw Error('An entity in this save is invalid.');
          if ((e.kind === 'unit' && !UNITS[e.type]) || (e.kind === 'building' && !BUILDINGS[e.type]))
            throw Error('Unknown entity in save.');
        }
        this.s = structuredClone(data);
        if (data.index >= 0) {
          if (!CAMPAIGN[data.index]) throw Error('Unknown campaign mission.');
          this.s.m = structuredClone(CAMPAIGN[data.index]);
        } else if (!['conquest', 'survival', 'endless', 'domination', 'escort'].includes(data.m?.type))
          throw Error('Unknown skirmish rules.');
        this.world = new Battlefield(data.seed, this.s.m.biome);
        this.world.rebuild(this.s.entities);
        if (data.explored?.length === GRID * GRID)
          this.world.explored.set(data.explored.map(x => (x ? 1 : 0)));
        delete this.s.explored;
        this.ids = new Map(this.s.entities.map(e => [e.id, e]));
        this.random = seeded(data.seed + Math.floor(data.time * 50));
        this.effects.reset();
        this.rehash();
        this.world.reveal(this.s.entities, this.s.scans);
        this.emit('start', { mission: this.s.m, resumed: true });
        return this.s;
      }
    }
    function formatTime(s) {
      s = Math.max(0, Math.floor(s || 0));
      return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }
