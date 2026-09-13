    /* MeridianGame combat methods. Loaded after simulation/game.js. */
    'use strict';
    const combatMethods = {
      damage(this: MeridianGame, e: Entity | null | undefined, amount: number, source: CombatSource | null | undefined, quiet = false) {
        if (!e || e.hp <= 0) return;
        amount = Math.max(0.05, amount);
        e.lastHit = this.s!.time;
        e.lastSource = source?.id;
        if (e.shield > 0) {
          let absorbed = Math.min(e.shield, amount);
          e.shield -= absorbed;
          amount -= absorbed;
          e.shieldFlash = this.s!.time + 0.18;
        }
        e.hp -= amount;
        if (source?.team === 0) this.s!.stats.damage += amount;
        if (!quiet && amount > 25 && this.visible(e)) this.effects.damageNumber(e, amount);
        if (e.hp <= 0) this.kill(e, source);
        if (
          e.team === 0 &&
          e.kind === 'building' &&
          e.hp > 0 &&
          this.s!.time - (this.s!.triggers.baseAlert || -100) > 14
        ) {
          this.s!.triggers.baseAlert = this.s!.time;
          this.emit('alert', {
            text:
              e.type === 'hq' ? 'Command center under attack!' : 'Your structures are under attack.',
            danger: true,
            x: e.x,
            z: e.z
          });
        }
      },
      kill(this: MeridianGame, e: Entity, source: CombatSource | null | undefined) {
        e.hp = 0;
        e.deathAt = this.s!.time;
        e.target = null;
        if (e.kind === 'building') this.navDirty = true;
        if (e.team === 1) {
          this.s!.stats.kills++;
          if (source && source.team === 0) {
            source.kills!++;
            if (source.kills === 5) {
              source.maxHp! *= 1.12;
              source.hp = Math.min(source.maxHp!, source.hp! + source.maxHp! * 0.25);
              this.emit('alert', {
                text: unitName(source.type!, source.faction!) + ' promoted to veteran.'
              });
            }
          }
        }
        if (e.team === 0 && e.kind === 'unit') {
          this.s!.stats.lost++;
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
            e.faction === FACTION_ID.SECOND ? 0xaee2ac : 0xf3b17c
          );
          this.emit('explosion', { x: e.x, z: e.z, big: e.kind === 'building' || e.type === 'tank' });
        }
        if (e.team === 1 && e.type === 'hq')
          this.emit('alert', { text: 'Enemy command center destroyed.', x: e.x, z: e.z });
      },
      rangedStats(this: MeridianGame, e: UnitEntity | BuildingEntity): RangedStats {
        let d: BuildingDefinitionShape | UnitDefinitionShape = e.kind === 'building'
          ? BUILDINGS[e.type]
          : UNITS[e.type],
          s = this.s!;
        let range = d.range || 0,
          damage =
            (d.damage || 0) *
            (e.faction === FACTION_ID.THIRD ? 1.12 : 1) *
            (e.kills >= 5 ? 1.12 : 1);
        return { ...d, range, damage };
      },
      fire(this: MeridianGame, e: UnitEntity | BuildingEntity, target: Entity) {
        let d = this.rangedStats(e);
        e.cd = d.reload || 1;
        let dx = target.x - e.x,
          dz = target.z - e.z;
        e.rot = Math.atan2(dx, dz);
        if (e.type === 'artillery') {
          let travel = 0.85;
          this.s!.strikes.push({
            x: target.x,
            z: target.z,
            at: this.s!.time + travel,
            damage: d.damage,
            radius: d.splash!,
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
      },
      acquire(this: MeridianGame, e: UnitEntity | BuildingEntity): Entity | null {
        let d = this.rangedStats(e);
        if (!d.damage) return null;
        let radius = Math.max(d.range + (e.kind === 'building' ? 3 : 6), e.team === 1 ? 19 : 16);
        let a = this.near(
          e.x,
          e.z,
          radius,
          n =>
            this.enemy(e, n) &&
            (!d.groundOnly || !(UNITS as Partial<Record<EntityType, UnitDefinitionShape>>)[n.type]?.flying) &&
            (e.team === 1 || this.visible(n))
        );
        if (e.order.type === 'guard')
          a = a.filter(n => distance(n, { x: e.order.x!, z: e.order.z! }) < 28);
        a.sort((a, b) => {
          let ca = distance(e, a) - a.size + (a.kind === 'building' ? 3 : 0),
            cb = distance(e, b) - b.size + (b.kind === 'building' ? 3 : 0);
          return ca - cb;
        });
        return a[0] || null;
      },
      combat(this: MeridianGame, e: UnitEntity | BuildingEntity, dt: number) {
        let d = this.rangedStats(e),
          o = e.order;
        if (e.nextThink <= this.s!.time) {
          e.nextThink = this.s!.time + 0.28 + (e.id % 3) * 0.035;
          let target = o.type === 'attack' ? this.get(o.id) : this.get(e.target);
          if (
            target &&
            (!this.enemy(e, target) ||
              (!this.visible(target) && e.team !== 1) ||
              (d.groundOnly && (UNITS as Partial<Record<EntityType, UnitDefinitionShape>>)[target.type]?.flying) ||
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
            this.move(e, { x: e.x + (dx / len) * 5, z: e.z + (dz / len) * 5 }, dt, 0.3, false);
          // Combat must reach weapon range, not the extra tolerance for crowded move goals.
          } else this.move(e, t, dt, d.range + t.size * 0.65 - 0.6, false);
          return true;
        }
        return false;
      },
      medic(this: MeridianGame, e: UnitEntity, dt: number) {
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
              distance(n, e.order as Position) < distance(e, e.order as Position)
          );
          if (front.length && distance(e, front[0]) > 6) this.move(e, front[0], dt, 5.5);
          else if (!front.length) this.move(e, e.order as Position, dt, 2);
          return true;
        }
        return false;
      },
    };
    type CombatMethods = typeof combatMethods;
    interface MeridianGame extends CombatMethods {}
    defineMeridianGameMethods(combatMethods);
