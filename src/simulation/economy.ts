    /* MeridianGame economy methods. Loaded after simulation/game.js. */
    'use strict';
    const REFINERY_PLACEMENT_RANGE = 6;
    const economyMethods = {
      produceUnit(this: MeridianGame, b: BuildingEntity, type: UnitType): UnitEntity | null {
        if (this.s!.entities.some(e => e.hp > 0 && e.exit?.building === b.id)) return null;
        const yaw = BUILDING_YAW + (b.team === 1 ? Math.PI : 0),
          dx = Math.sin(yaw), dz = Math.cos(yaw), reach = b.size + UNITS[type].size * UNIT_BODY_SCALE + 1.5,
          end = this.unitPosition({type, size: UNITS[type].size, x: b.x + dx * reach, z: b.z + dz * reach});
        if (!end || (!(UNITS[type] as UnitDefinitionShape).flying &&
          !this.world!.terrainFree(b, end, UNITS[type].size * UNIT_BODY_SCALE))) return null;
        const x = b.x - dx * 0.5, z = b.z - dz * 0.5,
          exit = {building: b.id, ...end, length: Math.hypot(end.x - x, end.z - z)};
        if (!this.unitFits({type, size: UNITS[type].size, exit}, x, z)) return null;
        return this.spawn('unit', type, x, z, b.team, b.faction, {rot: yaw, exit});
      },
      cap(this: MeridianGame, team: PlayerTeam = 0) {
        return Math.min(
          180,
          this.alive(e => e.team === team && e.kind === 'building' && e.progress >= 1).reduce(
            (a, e) => a + ((BUILDINGS[e.type as BuildingType] as BuildingDefinitionShape).cap || 0),
            (this.party(team).meta.logisticsFrame || 0) * FLEET_EFFECTS.supply
          )
        );
      },
      supply(this: MeridianGame, team: PlayerTeam = 0) {
        let n = 0;
        for (let e of this.s!.entities)
          if (e.hp > 0 && e.team === team) {
            if (e.kind === 'unit') n += UNITS[e.type].supply || 0;
            for (let q of e.queue || []) n += UNITS[q.type]?.supply || 0;
          }
        return n;
      },
      cost(this: MeridianGame, type: UnitType | BuildingType, kind: 'unit' | 'building' = 'unit', team: PlayerTeam = 0): Cost {
        let d: BuildingDefinitionShape | UnitDefinitionShape = kind === 'building'
          ? BUILDINGS[type as BuildingType]
          : UNITS[type as UnitType],
          mul = kind === 'unit' && type !== 'worker'
            ? (this.factionFor(team) === FACTION_ID.SECOND ? 0.85 : this.factionFor(team) === FACTION_ID.THIRD ? 1.12 : 1)
            : 1;
        return { cost: Math.ceil(d.cost * mul), gas: d.gas || 0 };
      },
      afford(this: MeridianGame, c: Cost, team: PlayerTeam = 0) {
        return this.account(team).alloy >= c.cost && this.account(team).gas >= c.gas;
      },
      spend(this: MeridianGame, c: Cost, team: PlayerTeam = 0) {
        if (!this.afford(c, team)) {
          this.notify(team,
            'toast',
            this.account(team).alloy < c.cost
              ? 'Insufficient Cinder. Assign more workers to crystals.'
              : 'Insufficient Echo. Build a refinery beside a vent.'
          );
          return false;
        }
        this.account(team).alloy -= c.cost;
        this.account(team).gas -= c.gas;
        return true;
      },
      has(this: MeridianGame, type: BuildingType, team: PlayerTeam = 0) {
        return (
          this.alive(e => e.team === team && e.kind === 'building' && e.type === type && e.progress >= 1)
            .length > 0
        );
      },
      availableProducers(this: MeridianGame, buildingType: BuildingType, team: PlayerTeam = 0): BuildingEntity[] {
        return this.alive(e => e.team === team && e.kind === 'building' &&
          e.type === buildingType && e.progress >= 1 && e.queue.length < 5) as BuildingEntity[];
      },
      train(this: MeridianGame, type: UnitType, team: PlayerTeam = 0) {
        if (this.s!.stopped) return false;
        let s = this.s!,
          d = UNITS[type];
        if (!d) return false;
        if (
          type === 'hero' &&
          (this.alive(e => e.team === team && e.type === 'hero').length ||
            this.alive(e => e.team === team).some(e => e.queue?.some(q => q.type === 'hero')))
        ) {
          this.notify(team, 'toast', 'Your commander is already deployed or in reconstruction.');
          return false;
        }
        let producers = this.availableProducers(d.from, team);
        // Global recruitment: assign to the shortest queue, independent of selection.
        producers.sort((a, b) => a.queue.length - b.queue.length || a.id - b.id);
        let b = producers[0];
        if (!b) {
          this.notify(team,
            'toast',
            this.has(d.from, team)
              ? 'Production queues are full (five orders per structure).'
              : `Construct a ${buildingName(d.from, this.factionFor(team))} first.`
          );
          return false;
        }
        if (this.supply(team) + d.supply > this.cap(team)) {
          this.notify(team, 'toast', 'Supply limit. Complete another logistics depot.');
          return false;
        }
        let c = this.cost(type, 'unit', team);
        if (!this.spend(c, team)) return false;
        b.queue.push({ type, progress: 0, time: d.time, ...c });
        this.notify(team, 'queued', type);
        return true;
      },
      cancelQueue(this: MeridianGame, id: number, index: number, team: PlayerTeam = 0) {
        if (this.s!.stopped) return;
        let b = this.get(id);
        if (!b || b.team !== team || !b.queue[index]) return;
        let q = b.queue.splice(index, 1)[0];
        this.account(team).alloy += q.cost;
        this.account(team).gas += q.gas;
        this.notify(team, 'toast', 'Recruitment canceled. Resources refunded.');
      },
      availableWorkers(this: MeridianGame, team: PlayerTeam = 0): UnitEntity[] {
        return this.alive(e => e.team === team && e.kind === 'unit' && e.type === 'worker' &&
          e.order.type !== 'build' && e.order.type !== 'repair') as UnitEntity[];
      },
      workerTask(this: MeridianGame, target: Entity | null, team: PlayerTeam = 0): 'build' | 'repair' | null {
        if (!this.s || this.s.result || this.s.stopped || !target || target.hp <= 0 || target.team !== team) return null;
        if (target.kind === 'building' && target.progress < 1) return 'build';
        if ((target.kind === 'building' || target.kind === 'unit') &&
          target.progress >= 1 && target.hp < target.maxHp) return 'repair';
        return null;
      },
      refineryVent(this: MeridianGame, p: Position, team: PlayerTeam = 0): ResourceEntity | null {
        const gas = this.closest(p, e => e.kind === 'resource' && e.type === 'gas' &&
          !!this.world!.sight[team].explored[this.world!.idx(e.x, e.z)]) as ResourceEntity | null;
        return gas && distance(p, gas) <= REFINERY_PLACEMENT_RANGE ? gas : null;
      },
      foundationPosition(this: MeridianGame, type: BuildingType, p: Position, team: PlayerTeam = 0): Position {
        const gas = type === 'refinery' ? this.refineryVent(p, team) : null;
        return gas ? { x: gas.x, z: gas.z } : p;
      },
      canBuild(this: MeridianGame, type: BuildingType, p?: Position | null, team: PlayerTeam = 0) {
        let s = this.s!,
          d: BuildingDefinitionShape = BUILDINGS[type];
        if (!d) return 'Unknown structure.';
        if (d.requires && !this.has(d.requires as BuildingType, team))
          return `Requires ${buildingName(d.requires, this.factionFor(team))}.`;
        if (!this.alive(e => e.team === team && e.type === 'worker').length)
          return 'Recruit a worker at your command center first.';
        if (!this.availableWorkers(team).length) return 'No free worker. Workers are building or repairing.';
        if (!p) return '';
        const gas = type === 'refinery' ? this.refineryVent(p, team) : null;
        if (type === 'refinery' && !gas)
          return `Place within ${REFINERY_PLACEMENT_RANGE} meters of an explored Echo vent.`;
        p = gas ? { x: gas.x, z: gas.z } : p;
        let r = d.size;
        if (this.world!.surface) {
          if (!this.world!.surface.foundation(p, r))
            return 'Build on stable ground or a gentle slope, away from cliffs.';
          const yaw = BUILDING_YAW + (team === 1 ? Math.PI : 0);
          for (const unit of Object.values(UNITS) as UnitDefinitionShape[]) {
            if (unit.from !== type || unit.flying) continue;
            const body = unit.size * UNIT_BODY_SCALE, reach = r + body + 1.5,
              exit = {x:p.x+Math.sin(yaw)*reach,z:p.z+Math.cos(yaw)*reach};
            if (!this.world!.terrainFree(p,exit,body)) return 'Leave clear terrain for production exits.';
          }
        }
        // Match the foundation's one-meter margin instead of reserving a wide empty border.
        const limit = this.world!.extent - 1 - r;
        if (Math.abs(p.x) > limit || Math.abs(p.z) > limit)
          return 'Too close to the battlefield boundary.';
        if (!this.world!.sight[team].explored[this.world!.idx(p.x, p.z)])
          return 'Scout this location before building.';
        for (let i = 0; i < 12; i++) {
          let a = (i / 12) * Math.PI * 2;
          if (this.world!.staticGrid[this.world!.idx(p.x + Math.sin(a) * r, p.z + Math.cos(a) * r)])
            return 'Terrain obstructs the foundation.';
        }
        if (this.world!.staticGrid[this.world!.idx(p.x, p.z)]) return 'Terrain obstructs the foundation.';
        if (this.s!.supplyCaches.some(cache => !cache.collected && distance(p, cache) < r + 3))
          return 'Recover nearby supply caches before building here.';
        for (let e of this.s!.entities) {
          if (e.hp <= 0) continue;
          if (e.kind === 'unit') {
            const clearance = r + e.size * UNIT_BODY_SCALE + 1;
            if (distance(p, e) < clearance || (e.exit && distance(p, e.exit) < clearance))
              return 'Leave room around units and production exits.';
            continue;
          }
          if (e === gas) continue;
          if (distance(p, e) < r + e.size + 0.8) return 'Leave room around structures and resources.';
        }
        if (gas && this.alive(e => e.type === 'refinery' && e.gasId === gas.id).length)
          return 'This vent already supplies a refinery.';
        return '';
      },
      build(this: MeridianGame, type: BuildingType, p: Position, selected: number[] = [], team: PlayerTeam = 0) {
        if (this.s!.stopped) return false;
        p = this.foundationPosition(type, p, team);
        let reason = this.canBuild(type, p, team);
        if (reason) {
          this.notify(team, 'toast', reason);
          return false;
        }
        let workers = this.availableWorkers(team);
        workers.sort(
          (a, b) =>
            distance(a, p) -
            distance(b, p) +
            (selected.includes(a.id) ? -100 : 0) -
            (selected.includes(b.id) ? -100 : 0)
        );
        const world = this.world!, blocked = world.blocked;
        let w: UnitEntity | undefined;
        try {
          // Validate the same reachable work area used after placement, with the
          // planned foundation already blocking its footprint.
          world.blocked = blocked.slice();
          world.mark(world.blocked, p.x, p.z, BUILDINGS[type].size + 0.35);
          const area = { x: p.x, z: p.z, radius: BUILDINGS[type].size + 2.9 };
          w = workers.find(worker => world.path(worker.x, worker.z, p.x, p.z, false,
            area, worker.size * UNIT_BODY_SCALE).status === 'complete');
        } finally {
          world.blocked = blocked;
        }
        if (!w) {
          this.notify(team, 'toast', 'A worker cannot reach this location.');
          return false;
        }
        let c = this.cost(type, 'building', team);
        if (!this.spend(c, team)) return false;
        let b = this.spawnBuilding(type, p.x, p.z, team, this.factionFor(team), { progress: 0.06, paid: c });
        const party = this.party(team),
          workshop = party.benefits.fieldWorkshop && !party.fieldWorkshopUsed,
          buildRate = 1 + (party.meta.constructionProtocols || 0) * FLEET_EFFECTS.constructionSpeed + (workshop ? EXPEDITION_EFFECTS.workshopSpeed : 0);
        // Add both bonuses to base speed once; changing builders never changes the foundation.
        if (buildRate !== 1) b.buildRate = buildRate;
        if (workshop) party.fieldWorkshopUsed = true;
        b.hp = b.maxHp * 0.06;
        if (type === 'refinery')
          b.gasId = this.closest(p, e => e.type === 'gas' && e.kind === 'resource')?.id;
        this.world!.rebuild(this.s!.entities);
        this.setOrder(w, { type: 'build', id: b.id, x: p.x, z: p.z });
        this.notify(team, 'build', b);
        return true;
      },
      cancelConstruction(this: MeridianGame, id: number, team: PlayerTeam = 0) {
        if (this.s!.stopped) return;
        let e = this.get(id);
        if (!e || e.team !== team || e.kind !== 'building' || e.progress >= 1) return;
        let c = e.paid || this.cost(e.type, 'building', team);
        this.account(team).alloy += c.cost * 0.75;
        this.account(team).gas += c.gas * 0.75;
        e.hp = 0;
        e.deathAt = this.s!.time;
        this.navDirty = true;
        this.notify(team, 'toast', 'Foundation canceled. 75% of resources recovered.');
      },
      managedBuilding(this: MeridianGame, id: number, team: PlayerTeam = 0): BuildingEntity | null {
        let b = this.get(id);
        return this.s && !this.s!.result && !this.s.stopped && b?.kind === 'building' && b.team === team &&
          b.progress >= 1 ? b : null;
      },
      buildingRepairers(this: MeridianGame, id: number, team: PlayerTeam = 0): UnitEntity[] {
        return this.alive(e => e.team === team && e.kind === 'unit' && e.type === 'worker' &&
          e.order.type === 'repair' && e.order.id === id) as UnitEntity[];
      },
      canRepairBuilding(this: MeridianGame, id: number, team: PlayerTeam = 0) {
        let b = this.managedBuilding(id, team);
        if (!b) return 'Select a completed own structure.';
        if (b.hp >= b.maxHp) return 'Hull full';
        if (!this.availableWorkers(team).length) return 'No free worker';
        if (this.account(team).alloy <= 0.1) return 'No Cinder';
        return '';
      },
      toggleBuildingRepair(this: MeridianGame, id: number, team: PlayerTeam = 0) {
        let b = this.managedBuilding(id, team);
        if (!b) return false;
        let repairing = this.buildingRepairers(id, team);
        if (repairing.length) {
          for (let w of repairing) this.setOrder(w, { type: 'idle' });
          this.notify(team, 'toast', 'Building repair stopped.');
          return true;
        }
        let reason = this.canRepairBuilding(id, team);
        if (reason) {
          this.notify(team, 'toast', reason);
          return false;
        }
        let worker = this.availableWorkers(team).sort((a, c) => distance(a, b) - distance(c, b) || a.id - c.id)[0];
        this.command([worker.id], { type: 'repair', id: b.id, x: b.x, z: b.z }, team);
        this.notify(team, 'toast', 'Nearest free worker assigned to repair.');
        return true;
      },
      canSellBuilding(this: MeridianGame, id: number, team: PlayerTeam = 0) {
        let b = this.managedBuilding(id, team);
        if (!b) return 'Select a completed own structure.';
        if (b.type === 'hq' && this.alive(e => e.team === team && e.type === 'hq' && e.progress >= 1).length <= 1)
          return 'Last command center';
        return '';
      },
      buildingSaleRefund(this: MeridianGame, id: number, team: PlayerTeam = 0): Cost | null {
        let b = this.managedBuilding(id, team);
        if (!b) return null;
        let paid = b.paid || this.cost(b.type, 'building', team),
          refund = { cost: paid.cost * 0.5, gas: paid.gas * 0.5 };
        for (let q of b.queue) {
          refund.cost += q.cost;
          refund.gas += q.gas;
        }
        return refund;
      },
      sellBuilding(this: MeridianGame, id: number, team: PlayerTeam = 0) {
        let reason = this.canSellBuilding(id, team);
        if (reason) {
          this.notify(team, 'toast', reason);
          return false;
        }
        let b = this.get(id), refund = this.buildingSaleRefund(id, team);
        this.account(team).alloy += refund!.cost;
        this.account(team).gas += refund!.gas;
        b!.queue.length = 0;
        b!.hp = 0;
        b!.deathAt = this.s!.time;
        for (let w of this.buildingRepairers(id, team)) this.setOrder(w, { type: 'idle' });
        // Selling is not a combat kill: no explosion, kill credit or effect RNG draws.
        this.world!.rebuild(this.s!.entities);
        this.notify(team, 'toast', 'Structure sold. Recruitment canceled and refunded.');
        return true;
      },
      miningResource(this: MeridianGame, e: UnitEntity): ResourceEntity | null {
        const loads = new Map();
        for (const w of this.s!.entities) if (w !== e && w.hp > 0 && w.type === 'worker' &&
          w.team === e.team && w.order?.type === 'mine')
          loads.set(w.order.id, (loads.get(w.order.id) || 0) + 1);
        let best: ResourceEntity | null = null, score = Infinity;
        for (const n of this.s!.entities) if (n.hp > 0 && n.kind === 'resource' && n.type === 'crystal' && n.amount > 0 && this.world!.sight[e.team as PlayerTeam].explored[this.world!.idx(n.x,n.z)]) {
          const cost = distance(e, n) + (loads.get(n.id) || 0) * 8;
          if (cost < score) { best = n; score = cost; }
        }
        return best;
      },
      workerDropoff(this: MeridianGame, e: UnitEntity, h: Entity): Position {
        const source = e.order.type === 'mine' ? this.get(e.order.id) : null,
          toward = source || e,
          base = Math.atan2(toward.x-h.x,toward.z-h.z),
          slots = 3,
          offset = ((e.id % slots) - 1) * 0.28,
          radius = h.size + 2.5,
          angle = base + offset,
          p = {x:h.x+Math.sin(angle)*radius,z:h.z+Math.cos(angle)*radius};
        const snapped = this.world!.nearest(p.x,p.z);
        // A neighbour may push the nearest free cell to its far side. Such a
        // point is not an HQ service position; let area navigation find a side.
        return distance(snapped, h) <= h.size + 3.1 ? snapped : p;
      },
      workerMiningPoint(this: MeridianGame, e: UnitEntity, n: ResourceEntity): Position {
        const h = this.closest(n, target => target.team === e.team && target.type === 'hq' && target.progress >= 1),
          toward = h || e,
          base = Math.atan2(toward.x-n.x,toward.z-n.z),
          offset = ((e.id % 3) - 1) * 0.5,
          angle = base + offset,
          p = {x:n.x+Math.sin(angle)*1.9,z:n.z+Math.cos(angle)*1.9};
        const snapped = this.world!.nearest(p.x,p.z);
        return distance(snapped, n) <= 2.15 ? snapped : p;
      },
      worker(this: MeridianGame, e: UnitEntity, dt: number) {
        const team = e.team as PlayerTeam;
        let o = e.order,
          s = this.s!;
        if (['move', 'attackMove', 'hold', 'stop', 'attack', 'follow'].includes(o.type)) return false;
        if (o.type === 'build' || o.type === 'repair') {
          let b = this.get(o.id) as BuildingEntity | null;
          if (!b || b.team !== team || (o.type === 'repair' && b.progress < 1)) {
            this.finishOrder(e);
            return true;
          }
          let need = b.size + 3.0;
          if (distance(e, b) > need || !this.world!.terrainFree(e, b)) {
            this.move(e, b, dt, need, false, { x: b.x, z: b.z, radius: need - 0.1 });
            return true;
          }
          e.rot = angleLerp(e.rot, Math.atan2(b.x - e.x, b.z - e.z), dt * 5);
          if (b.progress < 1) {
            let rate = dt * (b.buildRate || 1) / (BUILDINGS[b.type] as BuildingDefinitionShape).time;
            let old = b.progress;
            b.progress = Math.min(1, b.progress + rate);
            b.hp = Math.min(b.maxHp, b.hp + (b.progress - old) * b.maxHp);
            if (b.progress >= 1) {
              if (b.type === 'hq') this.party(team).deploymentPending = false;
              if (team === 0) s.stats.built++;
              this.notify(team, 'complete', { type: b.type, x: b.x, z: b.z });
              this.finishOrder(e);
            }
          } else if (b.hp < b.maxHp && this.account(team).alloy > 0.1) {
            const repairFactor = 1 - (this.party(team).meta.repairLogistics || 0) * FLEET_EFFECTS.repairDiscount,
              amount = Math.min(dt * 38, b.maxHp - b.hp, this.account(team).alloy * 10 / repairFactor);
            b.hp += amount;
            this.account(team).alloy -= amount * .1 * repairFactor;
          } else this.finishOrder(e);
          this.effects.construction(e, b, dt);
          return true;
        }
        if (o.type === 'idle') {
          let target = this.miningResource(e);
          if (target) e.order = { type: 'mine', id: target.id };
        }
        if (e.order.type !== 'mine') return false;
        let maxCarry = 18;
        if (e.carry >= maxCarry || e.returning) {
          e.returning = true;
          let h = this.closest(e, n => n.team === e.team && n.type === 'hq' && n.progress >= 1);
          if (!h) return true;
          const hqRange = h.size + 3.1,
            hqDistance = distance(e,h);
          const dropoff = this.workerDropoff(e,h);
          // One stable goal for the whole return trip: switching back to the HQ
          // centre when a detour leaves the near zone creates an endless loop.
          if (hqDistance > hqRange + 1.5 || (hqDistance > hqRange &&
            (this.world!.blockedAt(dropoff.x, dropoff.z) || distance(e, dropoff) > e.size * UNIT_BODY_SCALE * 2.5)) || !this.world!.terrainFree(e, h)) {
            this.move(e, dropoff, dt, 0.45, false, { x: h.x, z: h.z, radius: hqRange - 0.1 });
            return true;
          }
          if (e.team === team) {
            this.account(team).alloy += e.carry;
            if (team === 0) s.stats.gathered += e.carry;
          }
          e.carry = 0;
          e.returning = false;
          e.recoveryAttempts = 0;
          e.nextRecovery = 0;
          e.stuck = 0;
          e.path = [];
          e.nextPath = 0;
          return true;
        }
        let n = this.get(e.order.id) as ResourceEntity | null;
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
        const miningPoint = this.workerMiningPoint(e,n);
        if ((distance(e, n) > 2.15 && (this.world!.blockedAt(miningPoint.x, miningPoint.z) ||
          distance(e,miningPoint) > e.size*UNIT_BODY_SCALE)) || !this.world!.terrainFree(e, n)) {
          this.move(e, miningPoint, dt, 0.35, false, { x: n.x, z: n.z, radius: 2.05 });
          return true;
        }
        e.recoveryAttempts = 0;
        e.nextRecovery = 0;
        e.stuck = 0;
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
    };
    type EconomyMethods = typeof economyMethods;
    interface MeridianGame extends EconomyMethods {}
    defineMeridianGameMethods(economyMethods);
