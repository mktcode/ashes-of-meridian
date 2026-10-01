    /* MeridianGame combat methods. Loaded after simulation/game.js. */
    'use strict';
    const combatMethods = {
      weaponRate(this: MeridianGame, e: UnitEntity | BuildingEntity) {
        const armed = e.kind === 'unit' ? UNITS[e.type].damage > 0 :
          !!(BUILDINGS[e.type] as BuildingDefinitionShape).damage;
        if (!armed) return 1;
        const active = this.s!.fields.filter(field => field.until > this.s!.time && distance(field, e) <= field.r),
          disrupted = e.kind === 'unit' ? active.filter(field => field.type === 'disruption' && this.enemy(field, e))
            .reduce((factor, field) => Math.min(factor, field.reload || 1), 1) : 1,
          surged = e.kind === 'unit' && e.type !== 'worker' ? active.filter(field => field.type === 'surge' && field.team === e.team)
            .reduce((factor, field) => Math.max(factor, field.reload || 1), 1) : 1;
        return disrupted * surged;
      },
      damage(this: MeridianGame, e: Entity | null | undefined, amount: number, source: CombatSource | null | undefined, quiet = false) {
        if (!e || e.hp <= 0) return;
        const bulwark = e.team === -1 ? 0 : this.s!.fields
          .filter(field => field.type === 'bulwark' && field.team === e.team && field.until > this.s!.time && distance(field, e) <= field.r)
          .reduce((reduction, field) => Math.max(reduction, field.power || 0), 0),
          reinforcement = e.reinforcedUntil! > this.s!.time ? .2 : 0;
        amount = Math.max(0.05, amount * (1 - bulwark) * (1 - reinforcement));
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
        if (!quiet && amount > 25 && this.visible(e)) this.effects.damageNumber(e, amount, this.localTeam);
        if (e.hp <= 0) this.kill(e, source);
        const alertKey = this.s!.rules.kind === 'scenario' ? `baseAlert:${e.team}` : 'baseAlert';
        if (
          (e.team === 0 || (this.s!.rules.kind === 'scenario' && e.team !== -1)) &&
          e.kind === 'building' &&
          e.hp > 0 &&
          this.s!.time - Number(this.s!.triggers[alertKey] || -100) > 14
        ) {
          this.s!.triggers[alertKey] = this.s!.time;
          this.notify(e.team as PlayerTeam, 'alert', {
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
        if (source?.team === 0 && this.enemy(source, e)) {
          this.s!.stats.kills++;
          if (e.kind === 'building' && e.progress >= 1) this.s!.stats.structuresDestroyed++;
        }
        if (source && source.id && this.enemy(source, e)) {
          source.kills!++;
          if (source.kills === 5) {
            source.maxHp! *= 1.12;
            source.hp = Math.min(source.maxHp!, source.hp! + source.maxHp! * 0.25);
            this.notify(source.team as PlayerTeam, 'alert', {
              text: unitName(source.type!, source.faction!) + ' promoted to veteran.'
            });
          }
        }
        if (e.team === 0 && e.kind === 'unit') this.s!.stats.lost++;
        if (e.team !== -1 && e.kind === 'unit' && e.type === 'hero')
          this.notify(e.team, 'radio',
            'Expedition command|The commander is down. We have a recovery signal. Reconstruct the command team at headquarters.');
        if (this.visible(e)) {
          this.effects.explosion(
            e.x,
            e.z,
            e.kind === 'building' ? 3.5 : e.type === 'destroyer' ? 3 : 1.2,
            e.faction === FACTION_ID.SECOND ? 0xaee2ac : e.faction === FACTION_ID.THIRD ? 0xb9a9e8 : 0xf3b17c
          );
          this.emit('explosion', { x: e.x, z: e.z, big: e.kind === 'building' || e.type === 'tank' || e.type === 'destroyer' });
        }
        if (e.type === 'hq' && this.enemy({ team: this.localTeam }, e) && this.visible(e))
          this.emit('alert', { text: 'Enemy command center destroyed.', x: e.x, z: e.z });
      },
      rangedStats(this: MeridianGame, e: UnitEntity | BuildingEntity): RangedStats {
        let d: BuildingDefinitionShape | UnitDefinitionShape = e.kind === 'building'
          ? BUILDINGS[e.type]
          : UNITS[e.type],
          s = this.s!;
        let range = d.range || 0,
          drillStacks = e.kind === 'unit' && e.type === 'rifle' && e.team !== -1
            ? s.parties[e.team]?.benefits.commandDrill || 0
            : 0,
          inCommand = drillStacks > 0 && s.entities.some(n =>
            n.hp > 0 && n.team === e.team && n.kind === 'unit' && n.type === 'hero' &&
            distance(e, n) <= COMMAND_DRILL.radius),
          damage =
            (d.damage || 0) *
            (e.faction === FACTION_ID.THIRD ? 1.12 : 1) *
            (e.kills >= 5 ? 1.12 : 1) *
            (inCommand ? 1 + drillStacks * COMMAND_DRILL.damagePerStack : 1);
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
            this.effects.shot(e, target, this.localTeam);
            this.emit('shot', { x: e.x, z: e.z, heavy: e.type === 'tank' || e.type === 'destroyer' });
          }
        }
      },
      acquire(this: MeridianGame, e: UnitEntity | BuildingEntity): Entity | null {
        let d = this.rangedStats(e);
        if (!d.damage) return null;
        let radius = Math.max(d.range + (e.kind === 'building' ? 3 : 6), 16);
        let a = this.near(
          e.x,
          e.z,
          radius,
          n =>
            this.enemy(e, n) &&
            (!d.groundOnly || !(UNITS as Partial<Record<EntityType, UnitDefinitionShape>>)[n.type]?.flying) &&
            this.canSee(e.team as PlayerTeam, n)
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
              !this.canSee(e.team as PlayerTeam, target) ||
              (d.groundOnly && (UNITS as Partial<Record<EntityType, UnitDefinitionShape>>)[target.type]?.flying) ||
              distance(e, target) > d.range + 14)
          )
            target = null;
          if (!target) target = this.acquire(e);
          e.target = target?.id || null;
        }
        let t = this.get(e.target);
        if (!t || !this.canSee(e.team as PlayerTeam, t)) return false;
        let dist = distance(e, t) - t.size * 0.72;
        if (dist <= d.range && dist >= (d.minRange || 0)) {
          const aim = Math.atan2(t.x - e.x, t.z - e.z);
          e.rot = angleLerp(e.rot, aim, dt * (e.type === 'destroyer' ? 2.5 : 8));
          if (e.cd <= 0 && (e.type !== 'destroyer' ||
            Math.abs(Math.atan2(Math.sin(aim - e.rot), Math.cos(aim - e.rot))) < .13)) this.fire(e, t);
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
          n => n.id !== e.id &&
            (this.s!.rules.kind === 'scenario' ? n.team === e.team : !this.enemy(e, n)) &&
            n.kind === 'unit' && n.hp < n.maxHp && n.hp > 0
        );
        allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
        let t = allies[0];
        if (t) {
          t.hp = Math.min(t.maxHp, t.hp + UNITS.medic.heal * dt);
          if (e.cd <= 0) {
            const visible = this.visible(e);
            // Scenario state must not depend on the observing client's sight.
            // Single-player keeps its established cooldown/visibility contract.
            if (visible || this.s!.rules.kind === 'scenario') e.cd = 0.5;
            if (visible) this.effects.healing(e, t);
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
