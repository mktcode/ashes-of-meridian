    /* MeridianGame movement methods. Loaded after simulation/game.js. */
    'use strict';
    const movementMethods = {
      unitFits(this: MeridianGame, e: UnitBody, x: number, z: number) {
        const flying = !!(UNITS[e.type] as UnitDefinitionShape).flying;
        if (Math.abs(x) > 85 || Math.abs(z) > 85) return false;
        if (!flying && this.world!.blockedAt(x, z)) {
          if (!e.exit || this.world!.staticGrid[this.world!.idx(x, z)]) return false;
          const cell = this.world!.point(this.world!.idx(x, z));
          if (this.s!.entities.some(b => b.hp > 0 && b.kind === 'building' && b.id !== e.exit!.building &&
            distance(cell, b) < b.size + 0.35 + CELL * 0.4)) return false;
        }
        // Read live positions: the combat hash is only rebuilt once per step.
        return !this.s!.entities.some(other => other !== e && other.hp > 0 && other.kind === 'unit' &&
          !!(UNITS[other.type] as UnitDefinitionShape).flying === flying &&
          ((other.x - x) ** 2 + (other.z - z) ** 2 < ((e.size + other.size) * UNIT_BODY_SCALE) ** 2 - 1e-9 ||
            (other.exit && (other.exit.x - x) ** 2 + (other.exit.z - z) ** 2 <
              ((e.size + other.size) * UNIT_BODY_SCALE) ** 2 - 1e-9)));
      },
      unitPosition(this: MeridianGame, e: UnitPlacement): Position | null {
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
      },
      yieldUnitSpace(this: MeridianGame, e: UnitEntity, x: number, z: number, priority: UnitEntity = e, chain: number[] = [], side: Position | null = null) {
        if (chain.length >= 4 || chain.includes(e.id)) return;
        const step = Math.hypot(x - e.x, z - e.z);
        if (!side && step < 1e-9) return;
        side ??= { x: -(z - e.z) / step, z: (x - e.x) / step };
        const nextChain = [...chain, e.id];
        if (Math.abs(x) > 85 || Math.abs(z) > 85 ||
          (!(UNITS[e.type] as UnitDefinitionShape).flying && this.world!.blockedAt(x, z))) return;
        for (const other of this.s!.entities) {
          if (other === e || other.hp <= 0 || other.kind !== 'unit' || other.team !== e.team || other.exit ||
            other.yieldTo || other.yieldUntil! > this.s!.time || !['idle', 'mine', 'move', 'attackMove', 'follow'].includes(other.order.type) ||
            !!(UNITS[other.type] as UnitDefinitionShape).flying !== !!(UNITS[e.type] as UnitDefinitionShape).flying) continue;
          // Loaded workers get out first. Otherwise a stable ID priority prevents mutual pushing.
          const loaded = priority.type === 'worker' && (priority.returning || priority.carry >= 18),
            otherLoaded = other.type === 'worker' && (other.returning || other.carry >= 18);
          if (nextChain.includes(other.id) ||
            (other.order.type !== 'idle' && (loaded !== otherLoaded ? !loaded : priority.id > other.id))) continue;
          const dx = other.x - x, dz = other.z - z, d = Math.hypot(dx, dz),
            min = (e.size + other.size) * UNIT_BODY_SCALE;
          if (d >= min || d < 1e-9) continue;
          // Clear the whole lane in one lateral manoeuvre, not a series of tiny pushes.
          const lateral = dx * side!.x + dz * side!.z, forward = dx * side!.z - dz * side!.x;
          // In a crowd, a smaller step may be all the space available.
          for (const clearance of [min, Math.sqrt(Math.max(0, min * min - forward * forward))]) {
            const shift = (lateral < 0 ? -1 : 1) * (clearance - Math.abs(lateral) + 1e-6),
              nx = other.x + side!.x * shift, nz = other.z + side!.z * shift;
            if (!(UNITS[other.type] as UnitDefinitionShape).flying && !this.world!.lineFree(other, {x:nx,z:nz})) continue;
            // A short queue keeps the same lateral axis and the original mover's priority.
            if (!this.unitFits(other, nx, nz)) this.yieldUnitSpace(other, nx, nz, priority, nextChain, side);
            if (this.unitFits(other, nx, nz)) {
              other.yieldTo = { x: nx, z: nz };
              other.yieldUntil = this.s!.time + 0.35;
              break;
            }
          }
        }
      },
      movementSpeed(this: MeridianGame, e: UnitEntity) {
        return UNITS[e.type].speed * (e.faction === 1 ? 1.1 : 1) *
          (e.slowed! > this.s!.time ? 0.65 : 1);
      },
      moveYield(this: MeridianGame, e: UnitEntity, dt: number) {
        const p = e.yieldTo!, dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz),
          speed = this.movementSpeed(e),
          step = Math.min(d, speed * dt);
        if (d < 1e-9) { delete e.yieldTo; return; }
        const nx = e.x + dx / d * step, nz = e.z + dz / d * step;
        if (step > 0 && this.unitFits(e, nx, nz)) {
          e.x = nx; e.z = nz;
          e.rot = angleLerp(e.rot, Math.atan2(dx, dz), dt * 9);
          e.walk += step;
          if (step >= d) delete e.yieldTo;
        } else if (this.s!.time >= e.yieldUntil!) {
          // An occupied/newly blocked route must not strand the original order.
          delete e.yieldTo;
        }
      },
      pathTo(this: MeridianGame, e: UnitEntity, p: Position, avoidUnits = false) {
        if (!avoidUnits && e.nextPath > this.s!.time) return;
        const blocked = this.world!.blocked, flying = !!(UNITS[e.type] as UnitDefinitionShape).flying;
        try {
          if (e.exit && !flying) {
            this.world!.blocked = this.world!.staticGrid.slice();
            for (const b of this.s!.entities) if (b.hp > 0 && b.kind === 'building' && b.id !== e.exit!.building)
              this.world!.mark(this.world!.blocked, b.x, b.z, b.size + 0.35);
          }
          if (avoidUnits) {
            this.world!.blocked = flying ? new Uint8Array(blocked.length) : this.world!.blocked.slice();
            for (const other of this.s!.entities) if (other !== e && other.hp > 0 && other.kind === 'unit' &&
              !!(UNITS[other.type] as UnitDefinitionShape).flying === flying) {
              const radius = (e.size + other.size) * UNIT_BODY_SCALE + 0.4 - CELL * 0.4;
              this.world!.mark(this.world!.blocked, other.x, other.z, radius);
              if (other.exit) this.world!.mark(this.world!.blocked, other.exit.x, other.exit.z, radius);
            }
            this.world!.blocked[this.world!.idx(e.x, e.z)] = 0;
          }
          e.path = this.world!.path(e.x, e.z, p.x, p.z, flying && !avoidUnits);
        } finally {
          this.world!.blocked = blocked;
        }
        e.pi = 0;
        e.nextPath = this.s!.time + 0.8;
        e.pathGoal = { x: p.x, z: p.z };
        e.pathVersion = this.world!.pathVersion;
      },
      move(this: MeridianGame, e: UnitEntity, p: Position, dt: number, stop = 1, settleBesideOccupiedGoal = true) {
        if (e.yieldTo) { this.moveYield(e, dt); return false; }
        if (distance(e, p) < stop || (settleBesideOccupiedGoal && !e.exit && ['move', 'attackMove'].includes(e.order.type) &&
          distance(e, p) < stop + e.size * UNIT_BODY_SCALE * 2 && !this.unitFits(e, p.x, p.z))) {
          // Stop beside an occupied destination instead of trying to stand at its center.
          e.path = [];
          e.pi = 0;
          return true;
        }
        if (
          !e.path?.length ||
          e.pi >= e.path.length ||
          e.pathVersion !== this.world!.pathVersion ||
          (e.pathGoal && distance(e.pathGoal, p) > 3)
        )
          this.pathTo(e, p);
        let q = e.path[e.pi];
        if (!q) return false;
        let dx = q.x - e.x,
          dz = q.z - e.z,
          d = Math.hypot(dx, dz);
        // The last work waypoint may only just enter build/repair range: don't skip it early.
        const waypointTolerance = e.exit ? 0.04 :
          e.pi + 1 === e.path.length && (e.order.type === 'build' || e.order.type === 'repair') ? 1e-9 : 0.65;
        if (d < waypointTolerance || (e.pi + 1 < e.path.length && d < 3.8 &&
          !this.unitFits(e, q.x, q.z) && this.world!.lineFree(e, e.path[e.pi + 1]))) {
          // An occupied intermediate waypoint must not trap us circling an idle unit.
          e.pi++;
          q = e.path[e.pi];
          if (!q) return distance(e, p) < stop + 1 || this.world!.blockedAt(p.x, p.z);
          dx = q.x - e.x;
          dz = q.z - e.z;
          d = Math.hypot(dx, dz);
        }
        let u: UnitDefinitionShape = UNITS[e.type],
          speed = this.movementSpeed(e),
          step = Math.min(d, speed * dt),
          vx = dx / (d || 1),
          vz = dz / (d || 1);
        if (step < 1e-9) return false;
        // Let an ally finish clearing our next step instead of following it sideways.
        const waitingForYield = this.s!.entities.some(other => other !== e && other.hp > 0 && other.yieldTo &&
          other.team === e.team && !!(UNITS[(other as UnitEntity).type] as UnitDefinitionShape).flying === !!u.flying &&
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
        if (!moved && !u.flying && this.world!.blockedAt(e.x + vx * step, e.z + vz * step)) {
          for (const [nx, nz] of [[e.x + vx * step, e.z], [e.x, e.z + vz * step]]) {
            if ((nx === e.x && nz === e.z) || !this.unitFits(e, nx, nz)) continue;
            heading = Math.atan2(nx - e.x, nz - e.z);
            e.x = nx; e.z = nz; moved = true; break;
          }
        }
        e.stuck = moved && Math.hypot(q.x - e.x, q.z - e.z) < d - step * 0.1 ? 0 : (e.stuck || 0) + dt;
        if (e.stuck > 0.65) {
          this.pathTo(e, p, true);
          if (!u.flying && this.world!.blockedAt(e.x, e.z)) {
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
      },
      setOrder(this: MeridianGame, e: Entity, order: UnitOrder) {
        if (e.kind === 'building') return;
        e.order = { ...order };
        e.target = null;
        e.path = [];
        e.pi = 0;
        e.nextPath = 0;
        e.stuck = 0;
      },
      command(this: MeridianGame, ids: number[], order: CommandOrder) {
        if (!this.s || this.s.result) return;
        let units = ids.map(id => this.get(id)).filter(e => e && e.team === 0) as Entity[];
        let mobile = units.filter(e => e.kind === 'unit') as UnitEntity[];
        const target = 'id' in order ? this.get(order.id) : null,
          task = this.workerTask(target);
        if (target && task && (order.type === 'smart' || order.type === task)) {
          const worker = mobile.filter(e => e.type === 'worker' && e.id !== target.id)
            .sort((a, b) => distance(a, target) - distance(b, target) || a.id - b.id)[0];
          if (worker) {
            if (task === 'repair' && this.s.alloy <= 0.1) {
              this.emit('toast', 'No alloy');
              return;
            }
            // Explicit orders may replace a builder, but never add construction speed.
            if (task === 'build')
              for (const other of this.alive(e => e.kind === 'unit' && e.type === 'worker' &&
                e.team === 0 && e.id !== worker.id && e.order.type === 'build' && e.order.id === target.id))
                this.setOrder(other, { type: 'idle' });
            this.setOrder(worker, { type: task, id: target.id, x: target.x, z: target.z });
            this.emit('order', { type: task, x: target.x, z: target.z, count: 1 });
            return;
          }
        }
        if (order.type === 'build' || order.type === 'repair') return;
        let cols = Math.max(1, Math.ceil(Math.sqrt(mobile.length))),
          spacing = Math.max(0, ...mobile.map(e => e.size)) * UNIT_BODY_SCALE * 2 + 0.1,
          i = 0;
        for (let e of units) {
          let o: CommandOrder = { ...order };
          if (e.kind === 'unit') {
            if (o.type === 'move' || o.type === 'attackMove') {
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
              else if (target && target.kind === 'unit' && target.team === 0)
                o = { type: 'follow', id: target.id };
              else o = { type: 'move', x: o.x, z: o.z };
            }
          }
          this.setOrder(e, o as UnitOrder);
        }
        if (mobile.length)
          this.emit('order', { type: order.type, x: order.x, z: order.z, count: mobile.length });
      },
      finishOrder(this: MeridianGame, e: UnitEntity) {
        e.order = { type: 'idle' };
        e.path = [];
        e.pi = 0;
      },
    };
    type MovementMethods = typeof movementMethods;
    interface MeridianGame extends MovementMethods {}
    defineMeridianGameMethods(movementMethods);
