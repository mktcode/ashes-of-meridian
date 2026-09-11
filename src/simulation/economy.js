    /* MeridianGame economy methods. Loaded after simulation/game.js. */
    'use strict';
    defineMeridianGameMethods({
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
      },
      cap() {
        return Math.min(
          180,
          this.alive(e => e.team === 0 && e.kind === 'building' && e.progress >= 1).reduce(
            (a, e) => a + (BUILDINGS[e.type].cap || 0),
            0
          )
        );
      },
      supply() {
        let n = 0;
        for (let e of this.s.entities)
          if (e.hp > 0 && e.team === 0) {
            if (e.kind === 'unit') n += UNITS[e.type].supply || 0;
            for (let q of e.queue || []) n += UNITS[q.type]?.supply || 0;
          }
        return n;
      },
      cost(type, kind = 'unit') {
        let d = kind === 'building' ? BUILDINGS[type] : UNITS[type],
          mul = kind === 'unit' && type !== 'worker'
            ? (this.s.faction === 1 ? 0.85 : this.s.faction === 2 ? 1.12 : 1)
            : 1;
        return { cost: Math.ceil(d.cost * mul), gas: d.gas || 0 };
      },
      afford(c) {
        return this.s.alloy >= c.cost && this.s.gas >= c.gas;
      },
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
      },
      has(type) {
        return (
          this.alive(e => e.team === 0 && e.kind === 'building' && e.type === type && e.progress >= 1)
            .length > 0
        );
      },
      availableProducers(buildingType) {
        return this.alive(e => e.team === 0 && e.kind === 'building' &&
          e.type === buildingType && e.progress >= 1 && e.queue.length < 5);
      },
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
        let producers = this.availableProducers(d.from);
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
      },
      cancelQueue(id, index) {
        let b = this.get(id);
        if (!b || b.team !== 0 || !b.queue[index]) return;
        let q = b.queue.splice(index, 1)[0];
        this.s.alloy += q.cost;
        this.s.gas += q.gas;
        this.emit('toast', 'Recruitment canceled. Resources refunded.');
      },
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
      },
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
      },
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
      },
      managedBuilding(id) {
        let b = this.get(id);
        return this.s && !this.s.result && b?.kind === 'building' && b.team === 0 &&
          b.progress >= 1 ? b : null;
      },
      buildingRepairers(id) {
        return this.alive(e => e.team === 0 && e.kind === 'unit' && e.type === 'worker' &&
          e.order.type === 'repair' && e.order.id === id);
      },
      canRepairBuilding(id) {
        let b = this.managedBuilding(id);
        if (!b) return 'Select a completed own structure.';
        if (b.hp >= b.maxHp) return 'Hull full';
        if (!this.alive(e => e.team === 0 && e.kind === 'unit' && e.type === 'worker').length)
          return 'No workers';
        if (this.s.alloy <= 0.1) return 'No alloy';
        return '';
      },
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
      },
      canSellBuilding(id) {
        let b = this.managedBuilding(id);
        if (!b) return 'Select a completed own structure.';
        if (b.type === 'hq' && this.alive(e => e.team === 0 && e.type === 'hq' && e.progress >= 1).length <= 1)
          return 'Last command center';
        return '';
      },
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
      },
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
      },
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
      },
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
            let rate = dt / BUILDINGS[b.type].time;
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
      },
    });
