    /* MeridianGame runtime methods. Loaded after simulation/game.js. */
    'use strict';
    const runtimeMethods = {
      step(this: MeridianGame, dt: number) {
        if (!this.s || this.s.result || this.s.stopped) return;
        let s = this.s!;
        if (s.rules.kind === 'scenario') dt = Math.min(dt, Math.max(0, s.rules.duration - s.time));
        s.time += dt;
        for (const { account } of s.parties) account.energy = Math.min(COMMAND_ENERGY.max, account.energy + dt * COMMAND_ENERGY.regeneration);
        this.rehash();
        if (this.navDirty) {
          this.world!.rebuild(s.entities);
          this.navDirty = false;
        }
        for (const e of s.entities) {
          if (e.hp <= 0 || e.kind !== 'building' || e.progress < 1 || e.team === -1) continue;
          if (e.type === 'hq' && e.faction === FACTION_ID.FIRST)
            for (const n of this.near(e.x, e.z, 11,
              n => n.team === e.team && s.time - n.lastHit > 4 && n.hp < n.maxHp))
              n.hp = Math.min(n.maxHp, n.hp + dt * 3);
          if (e.type === 'refinery') this.account(e.team).gas += dt * 1.7;
        }
        for (let e of s.entities) {
          if (e.hp <= 0 || e.kind === 'resource') continue;
          e.cd -= dt;
          if (e.maxShield && s.time - e.lastHit > 7)
            e.shield = Math.min(e.maxShield, e.shield + dt * e.maxShield * 0.075);
          if (e.kind === 'unit' && s.time - e.lastHit > 6) {
            let regen = e.faction === FACTION_ID.SECOND ? 2.1 : 0;
            e.hp = Math.min(e.maxHp, e.hp + regen * dt);
          }
          if (e.kind === 'building') {
            if (e.progress < 1) continue;
            if (e.queue.length) {
              let q = e.queue[0];
              q.progress = Math.min(1, q.progress + dt / q.time);
              if (q.progress >= 1) {
                let u = this.produceUnit(e, q.type);
                if (!u) continue; // Keep the paid order until there is room at the exit.
                e.queue.shift();
                if (e.team === 0 && q.type !== 'worker' && q.type !== 'hero') s.stats.trained++;
                if (e.rally && q.type !== 'worker')
                  u.order = { type: 'attackMove', x: e.rally.x, z: e.rally.z };
                this.notify(e.team as PlayerTeam, 'trained', u);
              }
            }
            if ((BUILDINGS[e.type] as BuildingDefinitionShape).damage) this.combat(e, dt);
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
            if (t && this.canSee(e.team as PlayerTeam, t)) {
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
            strike.team === this.localTeam ? 0xa2e3db : 0xf2b084
          );
          if (this.canSee(this.localTeam, strike)) this.emit('explosion', { x: strike.x, z: strike.z, big: true });
          if (strike.type === 'orbital' && this.factionFor(strike.team as PlayerTeam) === FACTION_ID.SECOND)
            s.fields.push({ type: 'bloom', team: strike.team as PlayerTeam, x: strike.x, z: strike.z, r: 10, until: s.time + 7 });
        }
        s.strikes = s.strikes.filter(a => !a.done);
        for (let field of s.fields) {
          if (field.until < s.time) continue;
          let targets = this.near(field.x, field.z, field.r, e =>
            field.type === 'bloom' ? this.enemy(field, e) : e.team === field.team
          );
          for (let e of targets) {
            if (field.type === 'bloom') {
              this.damage(e, dt * 23, { team: field.team }, true);
              e.slowed = s.time + 1;
            } else e.hp = Math.min(e.maxHp, e.hp + dt * 10);
          }
        }
        s.fields = s.fields.filter(f => f.until > s.time);
        s.scans = s.scans.filter(a => a.until > s.time);
        if (
          this.world!.definition.worldEvent === 'solarFlare' &&
          s.time > 150 &&
          Math.floor(s.time / 100) > (s.triggers.solar || 0)
        ) {
          s.triggers.solar = Math.floor(s.time / 100);
          let target = this.alive(e => e.team !== -1 && e.kind === 'unit' && e.type !== 'worker')[
            Math.floor(
              this.random() *
                this.alive(e => e.team !== -1 && e.kind === 'unit' && e.type !== 'worker').length
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
        this.resultClock += dt;
        if (this.resultClock >= 0.2) {
          this.checkBattleResult();
          this.resultClock = 0;
        }
        this.fogClock += dt;
        if (this.fogClock >= 0.35) {
          this.world!.reveal(s.entities, s.scans);
          this.fogClock = 0;
        }
        if (!s.result) for (const party of s.parties) if (party.controller.kind === 'ai') this.aiTick(party.id);
        if (s.entities.some(e => e.hp <= 0 && s.time - e.deathAt! > 9)) {
          s.entities = s.entities.filter(e => e.hp > 0 || s.time - e.deathAt! <= 9);
          this.ids = new Map(s.entities.map(e => [e.id, e]));
        }
        if (s.rules.kind === 'scenario' && s.time >= s.rules.duration) s.stopped = true;
      },
      checkBattleResult(this: MeridianGame) {
        if (this.s!.result || this.s!.rules.kind === 'scenario') return;
        if (!this.alive(e => e.team === 0 && e.type === 'hq').length)
          this.finish(false, 'Your last command center has fallen.');
        else if (!this.alive(e => e.team === 1 && e.type === 'hq').length)
          this.finish(true, 'The enemy base has been destroyed.');
      },
      abilityRequirement(this: MeridianGame, kind: AbilityType, team: PlayerTeam = 0): string | null {
        if (kind === 'orbital' && !this.alive(e => e.team === team && e.kind === 'building' &&
          e.type === ABILITY_RULES.orbitalBuilding && e.progress >= 1).length)
          return 'Requires a completed ' + buildingName(ABILITY_RULES.orbitalBuilding, this.factionFor(team)) + '.';
        return null;
      },
      ability(this: MeridianGame, kind: AbilityType, p: Position, team: PlayerTeam = 0) {
        if (this.s!.stopped) return false;
        let s = this.s!, account = this.account(team), faction = this.factionFor(team),
          d = ABILITIES[kind];
        if (!d) return false;
        const requirement = this.abilityRequirement(kind, team);
        if (requirement) {
          this.notify(team, 'toast', requirement);
          return false;
        }
        if (account.abilities[kind] > s.time) {
          this.notify(team,
            'toast',
            'Ability recharging: ' + Math.ceil(account.abilities[kind] - s.time) + ' seconds.'
          );
          return false;
        }
        if (account.energy < d.energy) {
          this.notify(team, 'toast', 'Insufficient command energy.');
          return false;
        }
        if (kind !== 'scan' && !this.world!.sight[team].explored[this.world!.idx(p.x, p.z)]) {
          this.notify(team, 'toast', 'Scout or scan this location first.');
          return false;
        }
        if (kind === 'orbital' && !this.world!.sight[team].visible[this.world!.idx(p.x, p.z)]) {
          this.notify(team, 'toast', 'Orbital strike requires current vision at the target.');
          return false;
        }
        if (kind === 'drop' && !this.alive(e => e.team === team &&
          (e.kind === 'unit' || (e.kind === 'building' && e.progress >= 1)) &&
          distance(e, p) <= ABILITY_RULES.reinforcementRange).length) {
          this.notify(team, 'toast', `Reinforcements require own troops or a completed structure within ${ABILITY_RULES.reinforcementRange} meters.`);
          return false;
        }
        if (kind === 'drop' && this.supply(team) + 8 > this.cap(team)) {
          this.notify(team, 'toast', 'Reinforcements require 8 free supply.');
          return false;
        }
        account.energy -= d.energy;
        account.abilities[kind] = s.time + d.cd;
        if (kind === 'orbital') {
          s.strikes.push({
            x: p.x,
            z: p.z,
            at: s.time + 2.2,
            radius: faction === FACTION_ID.THIRD ? 8 : 10,
            damage: faction === FACTION_ID.THIRD ? 440 : faction === FACTION_ID.SECOND ? 260 : 355,
            team,
            type: 'orbital'
          });
          s.scans.push({ ...p, team, r: 17, until: s.time + 8 });
          this.notify(team, 'radio', 'Orbital command|Target solution confirmed. Clear the impact zone.');
        }
        if (kind === 'repair') {
          for (let e of this.near(p.x, p.z, 12, a => a.team === team)) {
            e.hp = Math.min(e.maxHp, e.hp + 180);
            if (e.maxShield) e.shield = Math.min(e.maxShield, e.shield + 100);
          }
          s.fields.push({ type: 'repair', team, x: p.x, z: p.z, r: 12, until: s.time + 8 });
          this.notify(team, 'heal', p);
        }
        if (kind === 'scan') {
          s.scans.push({ ...p, team, r: 32, until: s.time + 22 });
          this.notify(team, 'scan', p);
          this.world!.reveal(s.entities, s.scans);
        }
        if (kind === 'drop') {
          for (let i = 0; i < 4; i++) {
            let loc = this.world!.nearest(p.x + (i % 2) * 2 - 1, p.z + Math.floor(i / 2) * 2 - 1);
            this.spawnUnit('rifle', loc.x, loc.z, team, faction);
            this.effects.drop(loc, FACTIONS[faction].color, team);
          }
          this.notify(team, 'radio', 'Reinforcement channel|Boots on the ground. Point us at the trouble.');
        }
        return true;
      },
      finish(this: MeridianGame, win: boolean, text: string) {
        if (this.s!.result || this.s!.rules.kind === 'scenario') return;
        let s = this.s!,
          h = this.alive(e => e.team === 0 && e.type === 'hq') as BuildingEntity[],
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
      },
    };
    type RuntimeMethods = typeof runtimeMethods;
    interface MeridianGame extends RuntimeMethods {}
    defineMeridianGameMethods(runtimeMethods);

    function formatTime(s: number) {
      s = Math.max(0, Math.floor(s || 0));
      return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }
