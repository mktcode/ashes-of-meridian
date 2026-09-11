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
      start(opts = {}) {
        let faction = FACTIONS[opts.faction] ? opts.faction : 0,
          enemy = FACTIONS[opts.enemy] ? opts.enemy : 2,
          biome = BIOMES[opts.biome] ? opts.biome : 'ash',
          savedMeta = this.profile.upgrades || {},
          meta = Object.fromEntries(
            Object.keys(META).filter(key => Object.hasOwn(savedMeta, key)).map(key => [key, savedMeta[key]])
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
        // Build the economy from the HQ; even the first worker must be recruited.
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
        this.rehash();
        this.world.reveal(s.entities);
        this.emit('start', {});
        this.emit('radio', 'Expedition command|Recruit your first worker from Infanterie to establish your economy, then destroy the enemy command center.');
        return s;
      }
      spawn(kind, type, x, z, team, faction = 0, extra = {}) {
        let s = this.s,
          d = kind === 'building' ? BUILDINGS[type] : UNITS[type] || {},
          hp = d.hp || 1000;
        if (kind === 'unit') {
          if (faction === 1) hp *= 0.9;
          if (faction === 2) hp *= 0.85;
          if (faction === 0 && ['tank', 'artillery'].includes(type)) hp *= 1.15;
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
      unitFits(e, x, z) {
        const flying = !!UNITS[e.type].flying;
        if (Math.abs(x) > 85 || Math.abs(z) > 85) return false;
        if (!flying && this.world.blockedAt(x, z)) {
          if (!e.exit || this.world.staticGrid[this.world.idx(x, z)]) return false;
          const cell = this.world.point(this.world.idx(x, z));
          if (this.s.entities.some(b => b.hp > 0 && b.kind === 'building' && b.id !== e.exit.building &&
            distance(cell, b) < b.size + 0.35 + CELL * 0.4)) return false;
        }
        // Read live positions: the combat hash is only rebuilt once per step.
        return !this.s.entities.some(other => other !== e && other.hp > 0 && other.kind === 'unit' &&
          !!UNITS[other.type].flying === flying &&
          ((other.x - x) ** 2 + (other.z - z) ** 2 < ((e.size + other.size) * UNIT_BODY_SCALE) ** 2 - 1e-9 ||
            (other.exit && (other.exit.x - x) ** 2 + (other.exit.z - z) ** 2 <
              ((e.size + other.size) * UNIT_BODY_SCALE) ** 2 - 1e-9)));
      }
      unitPosition(e) {
        const x = clamp(e.x, -85, 85), z = clamp(e.z, -85, 85);
        if (this.unitFits(e, x, z)) return { x, z };
        // Deterministic nearby rings, without consuming simulation/effect RNG.
        for (let r = 1; r <= 24; r++) {
          const count = Math.ceil(2 * Math.PI * r);
          for (let i = 0; i < count; i++) {
            const angle = i * 2 * Math.PI / count,
              nx = x + Math.cos(angle) * r, nz = z + Math.sin(angle) * r;
            if (this.unitFits(e, nx, nz)) return { x: nx, z: nz };
          }
        }
        return null;
      }
      yieldUnitSpace(e, x, z, priority = e, chain = [], side = null) {
        if (chain.length >= 4 || chain.includes(e.id)) return;
        const step = Math.hypot(x - e.x, z - e.z);
        if (!side && step < 1e-9) return;
        side ??= { x: -(z - e.z) / step, z: (x - e.x) / step };
        const nextChain = [...chain, e.id];
        if (Math.abs(x) > 85 || Math.abs(z) > 85 ||
          (!UNITS[e.type].flying && this.world.blockedAt(x, z))) return;
        for (const other of this.s.entities) {
          if (other === e || other.hp <= 0 || other.kind !== 'unit' || other.team !== e.team || other.exit ||
            other.yieldTo || other.yieldUntil > this.s.time || !['idle', 'mine', 'move', 'attackMove', 'follow'].includes(other.order.type) ||
            !!UNITS[other.type].flying !== !!UNITS[e.type].flying) continue;
          // Loaded workers get out first. Otherwise a stable ID priority prevents mutual pushing.
          const loaded = priority.type === 'worker' && (priority.returning || priority.carry >= 18),
            otherLoaded = other.type === 'worker' && (other.returning || other.carry >= 18);
          if (nextChain.includes(other.id) ||
            (other.order.type !== 'idle' && (loaded !== otherLoaded ? !loaded : priority.id > other.id))) continue;
          const dx = other.x - x, dz = other.z - z, d = Math.hypot(dx, dz),
            min = (e.size + other.size) * UNIT_BODY_SCALE;
          if (d >= min || d < 1e-9) continue;
          // Clear the whole lane in one lateral manoeuvre, not a series of tiny pushes.
          const lateral = dx * side.x + dz * side.z, forward = dx * side.z - dz * side.x;
          // In a crowd, a smaller step may be all the space available.
          for (const clearance of [min, Math.sqrt(Math.max(0, min * min - forward * forward))]) {
            const shift = (lateral < 0 ? -1 : 1) * (clearance - Math.abs(lateral) + 1e-6),
              nx = other.x + side.x * shift, nz = other.z + side.z * shift;
            if (!UNITS[other.type].flying && !this.world.lineFree(other, {x:nx,z:nz})) continue;
            // A short queue keeps the same lateral axis and the original mover's priority.
            if (!this.unitFits(other, nx, nz)) this.yieldUnitSpace(other, nx, nz, priority, nextChain, side);
            if (this.unitFits(other, nx, nz)) {
              other.yieldTo = { x: nx, z: nz };
              other.yieldUntil = this.s.time + 0.35;
              break;
            }
          }
        }
      }
      moveYield(e, dt) {
        const p = e.yieldTo, dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz),
          speed = UNITS[e.type].speed * (e.faction === 1 ? 1.1 : 1) *
            (e.slowed > this.s.time ? 0.65 : 1),
          step = Math.min(d, speed * dt);
        if (d < 1e-9) { delete e.yieldTo; return; }
        const nx = e.x + dx / d * step, nz = e.z + dz / d * step;
        if (step > 0 && this.unitFits(e, nx, nz)) {
          e.x = nx; e.z = nz;
          e.rot = angleLerp(e.rot, Math.atan2(dx, dz), dt * 9);
          e.walk += step;
          if (step >= d) delete e.yieldTo;
        } else if (this.s.time >= e.yieldUntil) {
          // An occupied/newly blocked route must not strand the original order.
          delete e.yieldTo;
        }
      }
      spawnUnit(type, x, z, team, faction, extra = {}) {
        const p = this.unitPosition({ type, size: UNITS[type].size, x, z, ...extra });
        if (!p) return null;
        return this.spawn('unit', type, p.x, p.z, team, faction, { ...extra, ...p });
      }
      produceUnit(b, type) {
        if (this.s.entities.some(e => e.hp > 0 && e.exit?.building === b.id)) return null;
        const yaw = BUILDING_YAW + (b.team === 1 ? Math.PI : 0),
          dx = Math.sin(yaw), dz = Math.cos(yaw), reach = b.size + UNITS[type].size * UNIT_BODY_SCALE + 1.5,
          end = this.unitPosition({type, size: UNITS[type].size, x: b.x + dx * reach, z: b.z + dz * reach});
        if (!end) return null;
        const x = b.x - dx * 0.5, z = b.z - dz * 0.5,
          exit = {building: b.id, ...end, length: Math.hypot(end.x - x, end.z - z)};
        if (!this.unitFits({type, size: UNITS[type].size, exit}, x, z)) return null;
        return this.spawn('unit', type, x, z, b.team, b.faction, {rot: yaw, exit});
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
      get(id) {
        let e = this.ids.get(id);
        return e && e.hp > 0 ? e : null;
      }
      alive(filter = () => true) {
        return this.s.entities.filter(e => e.hp > 0 && filter(e));
      }
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
      }
      rehash() {
        this.spatial.clear();
        for (let e of this.s.entities) {
          if (e.hp <= 0 || !['building', 'unit'].includes(e.kind)) continue;
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
                if (e.hp > 0 && (e.x - x) ** 2 + (e.z - z) ** 2 < rr && filter(e))
                  out.push(e);
          }
        return out;
      }
      enemy(a, b) {
        return a.team === 1 ? b.team === 0 : b.team === 1;
      }
      visible(e) {
        return e.team === 0 || !!this.world.visible[this.world.idx(e.x, e.z)];
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
          mul = kind === 'unit' && type !== 'worker'
            ? (this.s.faction === 1 ? 0.85 : this.s.faction === 2 ? 1.12 : 1)
            : 1;
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
      train(type) {
        let s = this.s,
          d = UNITS[type];
        if (!d) return false;
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
        // Global recruitment: assign to the shortest queue, independent of selection.
        producers.sort((a, b) => a.queue.length - b.queue.length || a.id - b.id);
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
      canBuild(type, p) {
        let s = this.s,
          d = BUILDINGS[type];
        if (!d) return 'Unknown structure.';
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
      managedBuilding(id) {
        let b = this.get(id);
        return this.s && !this.s.result && b?.kind === 'building' && b.team === 0 &&
          b.progress >= 1 ? b : null;
      }
      buildingRepairers(id) {
        return this.alive(e => e.team === 0 && e.kind === 'unit' && e.type === 'worker' &&
          e.order.type === 'repair' && e.order.id === id);
      }
      canRepairBuilding(id) {
        let b = this.managedBuilding(id);
        if (!b) return 'Select a completed own structure.';
        if (b.hp >= b.maxHp) return 'Hull full';
        if (!this.alive(e => e.team === 0 && e.kind === 'unit' && e.type === 'worker').length)
          return 'No workers';
        if (this.s.alloy <= 0.1) return 'No alloy';
        return '';
      }
      toggleBuildingRepair(id) {
        let b = this.managedBuilding(id);
        if (!b) return false;
        let repairing = this.buildingRepairers(id);
        if (repairing.length) {
          for (let w of repairing) this.setOrder(w, { type: 'idle' });
          this.emit('toast', 'Building repair stopped.');
          return true;
        }
        let reason = this.canRepairBuilding(id);
        if (reason) {
          this.emit('toast', reason);
          return false;
        }
        let worker = this.closest(b, e => e.team === 0 && e.kind === 'unit' && e.type === 'worker');
        this.command([worker.id], { type: 'repair', id: b.id, x: b.x, z: b.z });
        this.emit('toast', 'Nearest worker assigned to repair.');
        return true;
      }
      canSellBuilding(id) {
        let b = this.managedBuilding(id);
        if (!b) return 'Select a completed own structure.';
        if (b.type === 'hq' && this.alive(e => e.team === 0 && e.type === 'hq' && e.progress >= 1).length <= 1)
          return 'Last command center';
        return '';
      }
      buildingSaleRefund(id) {
        let b = this.managedBuilding(id);
        if (!b) return null;
        let paid = b.paid || this.cost(b.type, 'building'),
          refund = { cost: paid.cost * 0.5, gas: paid.gas * 0.5 };
        for (let q of b.queue) {
          refund.cost += q.cost;
          refund.gas += q.gas;
        }
        return refund;
      }
      sellBuilding(id) {
        let reason = this.canSellBuilding(id);
        if (reason) {
          this.emit('toast', reason);
          return false;
        }
        let b = this.get(id), refund = this.buildingSaleRefund(id);
        this.s.alloy += refund.cost;
        this.s.gas += refund.gas;
        b.queue.length = 0;
        b.hp = 0;
        b.deathAt = this.s.time;
        for (let w of this.buildingRepairers(id)) this.setOrder(w, { type: 'idle' });
        // Selling is not a combat kill: no explosion, kill credit or effect RNG draws.
        this.world.rebuild(this.s.entities);
        this.emit('toast', 'Structure sold. Recruitment canceled and refunded.');
        return true;
      }
      setOrder(e, order) {
        if (e.kind === 'building') return;
        e.order = { ...order };
        e.target = null;
        e.path = [];
        e.pi = 0;
        e.nextPath = 0;
        e.stuck = 0;
      }
      command(ids, order) {
        let units = ids.map(id => this.get(id)).filter(e => e && e.team === 0);
        let mobile = units.filter(e => e.kind === 'unit');
        let cols = Math.max(1, Math.ceil(Math.sqrt(mobile.length))),
          spacing = Math.max(0, ...mobile.map(e => e.size)) * UNIT_BODY_SCALE * 2 + 0.1,
          i = 0;
        for (let e of units) {
          let o = { ...order };
          if (e.kind === 'unit') {
            if (['move', 'attackMove'].includes(o.type)) {
              let j = i++;
              o.x += ((j % cols) - (cols - 1) / 2) * spacing;
              o.z += (Math.floor(j / cols) - (Math.ceil(mobile.length / cols) - 1) / 2) * spacing;
            }
            // Ground taps attack-move combat units without turning workers into attackers.
            if (e.type === 'worker' && o.type === 'attackMove') o.type = 'move';
            if (o.type === 'smart') {
              let target = this.get(o.id);
              if (target && this.enemy(e, target))
                o = { type: 'attack', id: target.id, x: target.x, z: target.z };
              else if (target?.kind === 'resource' && target.type === 'crystal' && e.type === 'worker')
                o = { type: 'mine', id: target.id };
              else if (
                target &&
                e.type === 'worker' &&
                target.team === 0 &&
                target.progress >= 1 &&
                target.hp < target.maxHp
              )
                o = { type: 'repair', id: target.id };
              else if (target && target.kind === 'unit' && target.team === 0)
                o = { type: 'follow', id: target.id };
              else o = { type: 'move', x: order.x, z: order.z };
            }
          }
          this.setOrder(e, o);
        }
        if (mobile.length)
          this.emit('order', { type: order.type, x: order.x, z: order.z, count: mobile.length });
      }
      pathTo(e, p, avoidUnits = false) {
        if (!avoidUnits && e.nextPath > this.s.time) return;
        const blocked = this.world.blocked, flying = !!UNITS[e.type].flying;
        try {
          if (e.exit && !flying) {
            this.world.blocked = this.world.staticGrid.slice();
            for (const b of this.s.entities) if (b.hp > 0 && b.kind === 'building' && b.id !== e.exit.building)
              this.world.mark(this.world.blocked, b.x, b.z, b.size + 0.35);
          }
          if (avoidUnits) {
            this.world.blocked = flying ? new Uint8Array(blocked.length) : this.world.blocked.slice();
            for (const other of this.s.entities) if (other !== e && other.hp > 0 && other.kind === 'unit' &&
              !!UNITS[other.type].flying === flying) {
              const radius = (e.size + other.size) * UNIT_BODY_SCALE + 0.4 - CELL * 0.4;
              this.world.mark(this.world.blocked, other.x, other.z, radius);
              if (other.exit) this.world.mark(this.world.blocked, other.exit.x, other.exit.z, radius);
            }
            this.world.blocked[this.world.idx(e.x, e.z)] = 0;
          }
          e.path = this.world.path(e.x, e.z, p.x, p.z, flying && !avoidUnits);
        } finally {
          this.world.blocked = blocked;
        }
        e.pi = 0;
        e.nextPath = this.s.time + 0.8;
        e.pathGoal = { x: p.x, z: p.z };
        e.pathVersion = this.world.pathVersion;
      }
      move(e, p, dt, stop = 1) {
        if (e.yieldTo) { this.moveYield(e, dt); return false; }
        if (distance(e, p) < stop || (!e.exit && ['move', 'attackMove'].includes(e.order.type) &&
          distance(e, p) < stop + e.size * UNIT_BODY_SCALE * 2 && !this.unitFits(e, p.x, p.z))) {
          // Stop beside an occupied destination instead of trying to stand at its center.
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
        if (d < (e.exit ? 0.04 : 0.65) || (e.pi + 1 < e.path.length && d < 3.8 &&
          !this.unitFits(e, q.x, q.z) && this.world.lineFree(e, e.path[e.pi + 1]))) {
          // An occupied intermediate waypoint must not trap us circling an idle unit.
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
            (e.slowed > this.s.time ? 0.65 : 1),
          step = Math.min(d, speed * dt),
          vx = dx / (d || 1),
          vz = dz / (d || 1);
        if (step < 1e-9) return false;
        // Let an ally finish clearing our next step instead of following it sideways.
        const waitingForYield = this.s.entities.some(other => other !== e && other.hp > 0 && other.yieldTo &&
          other.team === e.team && !!UNITS[other.type].flying === !!u.flying &&
          Math.hypot(other.x - e.x - vx * step, other.z - e.z - vz * step) <
            (e.size + other.size) * UNIT_BODY_SCALE);
        let moved = false, heading = Math.atan2(vx, vz);
        // Consistent passing side: never alternate left/right on consecutive frames.
        for (const angle of waitingForYield ? [] : [0, Math.PI / 6, Math.PI / 3, Math.PI / 2]) {
          const nx = e.x + (vx * Math.cos(angle) - vz * Math.sin(angle)) * step,
            nz = e.z + (vx * Math.sin(angle) + vz * Math.cos(angle)) * step;
          if (!this.unitFits(e, nx, nz)) continue;
          e.x = nx;
          e.z = nz;
          heading -= angle;
          moved = true;
          break;
        }
        // Only ask for space when we cannot pass; schedule one manoeuvre, not one per trial angle.
        if (!moved && !waitingForYield) this.yieldUnitSpace(e, e.x + vx * step, e.z + vz * step);
        // The terrain path samples can graze a grid corner: slide along it, not into it.
        if (!moved && !u.flying && this.world.blockedAt(e.x + vx * step, e.z + vz * step)) {
          for (const [nx, nz] of [[e.x + vx * step, e.z], [e.x, e.z + vz * step]]) {
            if ((nx === e.x && nz === e.z) || !this.unitFits(e, nx, nz)) continue;
            heading = Math.atan2(nx - e.x, nz - e.z);
            e.x = nx; e.z = nz; moved = true; break;
          }
        }
        e.stuck = moved && Math.hypot(q.x - e.x, q.z - e.z) < d - step * 0.1 ? 0 : (e.stuck || 0) + dt;
        if (e.stuck > 0.65) {
          this.pathTo(e, p, true);
          if (!u.flying && this.world.blockedAt(e.x, e.z)) {
            const p = this.unitPosition(e);
            if (p) Object.assign(e, p);
          }
          e.stuck = 0;
        }
        if (moved) {
          e.rot = angleLerp(e.rot, heading, dt * 9);
          e.walk += dt * speed;
        }
        return false;
      }
      finishOrder(e) {
        e.order = { type: 'idle' };
        e.path = [];
        e.pi = 0;
      }
      damage(e, amount, source, quiet = false) {
        if (!e || e.hp <= 0) return;
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
        if (e.team === 0 && e.kind === 'unit') {
          this.s.stats.lost++;
          if (e.type === 'hero') {
            this.emit(
              'radio',
              'Expedition command|The commander is down. We have a recovery signal. Reconstruct the command team at headquarters.'
            );
          }
        }
        if (this.visible(e)) {
          this.effects.explosion(
            e.x,
            e.z,
            e.kind === 'building' ? 3.5 : 1.2,
            e.faction === 1 ? 0xaee2ac : 0xf3b17c
          );
          this.emit('explosion', { x: e.x, z: e.z, big: e.kind === 'building' || e.type === 'tank' });
        }
        if (e.team === 1 && e.type === 'hq')
          this.emit('alert', { text: 'Enemy command center destroyed.', x: e.x, z: e.z });
      }
      rangedStats(e) {
        let d = e.kind === 'building' ? BUILDINGS[e.type] : UNITS[e.type],
          s = this.s;
        let range = d.range || 0,
          damage =
            (d.damage || 0) *
            (e.faction === 2 ? 1.12 : 1) *
            (e.kills >= 5 ? 1.12 : 1);
        return { ...d, range, damage };
      }
      fire(e, target) {
        let d = this.rangedStats(e);
        e.cd = d.reload || 1;
        let dx = target.x - e.x,
          dz = target.z - e.z;
        e.rot = Math.atan2(dx, dz);
        if (e.type === 'artillery') {
          let travel = 0.85;
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
              a => a.id !== target.id && this.enemy(e, a)
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
      miningResource(e) {
        const loads = new Map();
        for (const w of this.s.entities) if (w !== e && w.hp > 0 && w.type === 'worker' &&
          w.team === e.team && w.order?.type === 'mine')
          loads.set(w.order.id, (loads.get(w.order.id) || 0) + 1);
        let best = null, score = Infinity;
        for (const n of this.s.entities) if (n.hp > 0 && n.kind === 'resource' && n.type === 'crystal' && n.amount > 0) {
          const cost = distance(e, n) + (loads.get(n.id) || 0) * 8;
          if (cost < score) { best = n; score = cost; }
        }
        return best;
      }
      worker(e, dt) {
        let o = e.order,
          s = this.s;
        if (['move', 'attackMove', 'hold', 'stop', 'attack', 'follow'].includes(o.type)) return false;
        if (o.type === 'build' || o.type === 'repair') {
          let b = this.get(o.id);
          if (!b || b.team !== 0 || (o.type === 'repair' && b.progress < 1)) {
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
          let target = this.miningResource(e);
          if (target) e.order = { type: 'mine', id: target.id };
        }
        if (e.order.type !== 'mine') return false;
        let maxCarry = 18;
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
          n = this.miningResource(e);
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
          t.hp = Math.min(t.maxHp, t.hp + UNITS.medic.heal * dt);
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
              if (e.faction === 0)
                for (let n of this.near(
                  e.x,
                  e.z,
                  11,
                  a => a.team === 0 && s.time - a.lastHit > 4 && a.hp < a.maxHp
                ))
                  n.hp = Math.min(n.maxHp, n.hp + dt * 3);
            }
            if (e.type === 'refinery') s.gas += dt * 1.7;
          }
          if (e.team === 1)
            s.enemyBudget += dt * (e.type === 'hq' ? 2.8 : e.type === 'barracks' ? 0.8 : 0);
        }
        for (let e of s.entities) {
          if (e.hp <= 0 || e.kind === 'resource') continue;
          e.cd -= dt;
          if (e.maxShield && s.time - e.lastHit > 7)
            e.shield = Math.min(e.maxShield, e.shield + dt * e.maxShield * 0.075);
          if (e.kind === 'unit' && s.time - e.lastHit > 6) {
            let regen = e.faction === 1 ? 2.1 : 0;
            e.hp = Math.min(e.maxHp, e.hp + regen * dt);
          }
          if (e.kind === 'building') {
            if (e.progress < 1) continue;
            if (e.queue.length) {
              let q = e.queue[0];
              q.progress = Math.min(1, q.progress + (dt / q.time) * (1 + (s.meta.industry || 0) * 0.1));
              if (q.progress >= 1) {
                let u = this.produceUnit(e, q.type);
                if (!u) continue; // Keep the paid order until there is room at the exit.
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
          if (e.exit) {
            if (this.move(e, e.exit, dt, 0.05) && this.unitFits(e, e.exit.x, e.exit.z)) {
              e.x = e.exit.x; e.z = e.exit.z;
              delete e.exit;
              e.path = []; e.nextPath = 0;
            }
            continue;
          }
          if (e.yieldTo) { this.moveYield(e, dt); continue; }
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
              this.move(e, t, dt, (this.rangedStats(e).range || 2) + t.size * 0.5);
            } else this.finishOrder(e);
          } else if (o.type === 'follow') {
            let t = this.get(o.id);
            if (t) this.move(e, t, dt, 4);
            else this.finishOrder(e);
          } else if (o.type === 'guard' && distance(e, o) > 5) this.move(e, o, dt, 3.5);
        }
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
            field.type === 'bloom' ? e.team === 1 : e.team === 0
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
          s.biome === 'star' &&
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
        this.objectiveClock += dt;
        if (this.objectiveClock >= 0.2) {
          this.objectiveTick();
          this.objectiveClock = 0;
        }
        this.fogClock += dt;
        if (this.fogClock >= 0.35) {
          this.world.reveal(s.entities, s.scans);
          this.fogClock = 0;
        }
        if (s.entities.some(e => e.hp <= 0 && s.time - e.deathAt > 9)) {
          s.entities = s.entities.filter(e => e.hp > 0 || s.time - e.deathAt <= 9);
          this.ids = new Map(s.entities.map(e => [e.id, e]));
        }
      }
      wave() {
        let s = this.s,
          bases = this.alive(e => e.team === 1 && e.type === 'hq');
        s.wave++;
        s.nextWave = s.time + 80 * Math.max(0.68, 1 - s.wave * 0.01);
        if (!bases.length) return;
        let site = bases[(s.wave - 1) % bases.length], faction = site.faction,
          n = Math.min(24, Math.ceil(6.75 + s.wave * 0.65)),
          goal = this.closest(site, e => e.team === 0 && e.type === 'hq') || HOME;
        let deployed = 0;
        for (let i = 0; i < n; i++) {
          if (this.alive(e => e.team === 1 && e.kind === 'unit').length >= 130) break;
          let r = this.random(),
            type = 'rifle';
          if (s.wave >= 3 && r < 0.1) type = 'air';
          else if (s.wave >= 2 && r < 0.19) type = 'artillery';
          else if (r < 0.38) type = 'tank';
          else if (r < 0.48) type = 'medic';
          let c = UNITS[type].cost * 0.5;
          if (s.enemyBudget < c && i > 1) break;
          let p = this.world.nearest(site.x - 8 + (i % 4) * 2.3, site.z + 10 + Math.floor(i / 4) * 2.3);
          let u = this.spawnUnit(type, p.x, p.z, 1, faction);
          if (!u) continue;
          s.enemyBudget = Math.max(0, s.enemyBudget - c);
          u.order = { type: 'attackMove', x: goal.x + ((i % 3) - 1) * 2, z: goal.z };
          deployed++;
        }
        if (deployed) this.emit('wave', { wave: s.wave, x: site.x, z: site.z, n: deployed });
      }
      objectiveTick() {
        if (this.s.result) return;
        if (!this.alive(e => e.team === 0 && e.type === 'hq').length)
          this.finish(false, 'Your last command center has fallen.');
        else if (!this.alive(e => e.team === 1 && e.type === 'hq').length)
          this.finish(true, 'The enemy base has been destroyed.');
      }
      objectiveRows() {
        let done = !this.alive(e => e.team === 1 && e.type === 'hq').length;
        return [{ text: 'Destroy the enemy base', current: done ? 1 : 0, max: 1, sub: '', done }];
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
          for (let e of this.near(p.x, p.z, 12, a => a.team === 0)) {
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
          integrity = h.length ? Math.max(...h.map(e => e.hp / e.maxHp)) : 0;
        s.result = {
          win,
          text,
          time: s.time,
          score: Math.floor(
            s.stats.kills * 80 +
              s.stats.damage * 0.04 +
              (win ? 2500 : 0) -
              s.stats.lost * 35
          ),
          integrity
        };
        this.emit('result', s.result);
      }
    }
    function formatTime(s) {
      s = Math.max(0, Math.floor(s || 0));
      return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }
