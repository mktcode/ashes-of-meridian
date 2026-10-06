    /* MeridianGame runtime methods. Loaded after simulation/game.js. */
    'use strict';
    const runtimeMethods = {
      step(this: MeridianGame, dt: number) {
        if (this.stepping || this.dispatchingResult) return;
        this.stepping = true;
        this.snapshotSafe = false;
        try {
          this.stepTick(dt);
          this.snapshotSafe = true;
        } finally {
          this.stepping = false;
          if (!this.snapshotSafe) this.pendingResult = null;
        }
        const pending = this.pendingResult;
        this.pendingResult = null;
        if (pending && pending.state === this.s) {
          // Snapshot-safe boundary, but still reject recursive ticks from subscribers.
          this.dispatchingResult = true;
          try { this.emit('result', pending.result); }
          finally { this.dispatchingResult = false; }
        }
      },
      stepTick(this: MeridianGame, dt: number) {
        if (!this.s || this.s.result || this.s.stopped) return;
        let s = this.s!;
        if (s.rules.kind === 'scenario') {
          if (!Number.isFinite(dt) || dt <= 0) return;
          dt = Math.min(dt, Math.max(0, s.rules.duration - s.time));
          if (!dt) { s.stopped = true; this.cancelQueuedActions(); return; }
          if (!this.beginCommandTick()) return;
        }
        s.time += dt;
        for (const { account } of s.parties) account.energy = Math.min(COMMAND_ENERGY.max, account.energy + dt * COMMAND_ENERGY.regeneration);
        this.resolveRecalls();
        this.rehash();
        if (this.navDirty) {
          this.world!.rebuild(s.entities);
          this.navDirty = false;
        }
        this.updateSettlements(dt);
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
          e.cd -= dt * this.weaponRate(e);
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
        this.collectSupplyCaches();
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
          if (strike.type === 'orbital' && !this.party(strike.team as PlayerTeam).eliminated &&
              this.factionFor(strike.team as PlayerTeam) === FACTION_ID.SECOND)
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
            } else if (field.type === 'repair') e.hp = Math.min(e.maxHp, e.hp + dt * (field.power || 10));
          }
        }
        s.fields = s.fields.filter(f => f.until > s.time);
        s.scans = s.scans.filter(a => a.until > s.time);
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
        if (!s.result) for (const party of s.parties) if (!party.eliminated && party.controller.kind === 'ai') this.aiTick(party.id);
        if (s.entities.some(e => e.hp <= 0 && s.time - e.deathAt! > 9)) {
          s.entities = s.entities.filter(e => e.hp > 0 || s.time - e.deathAt! <= 9);
          this.ids = new Map(s.entities.map(e => [e.id, e]));
        }
        if (s.rules.kind === 'scenario' && s.time >= s.rules.duration) {
          s.stopped = true;
          this.cancelQueuedActions();
        }
      },
      collectSupplyCaches(this: MeridianGame) {
        const s = this.s!, world = this.world!;
        for (const cache of s.supplyCaches) {
          if (cache.collected) continue;
          // Nearest eligible ground unit wins; entity order breaks exact ties.
          let collector: UnitEntity | undefined, best = 4;
          for (const e of s.entities) {
            if (e.hp <= 0 || e.kind !== 'unit' || e.team === -1 || e.exit || isFlyingUnitType(e.type) ||
                this.party(e.team as PlayerTeam).eliminated || !this.canSee(e.team as PlayerTeam, cache)) continue;
            const d = distance(e, cache);
            if (d < best && world.surface!.segment(e, cache, .5)) { collector = e; best = d; }
          }
          if (!collector) continue;
          cache.collected = true;
          const team = collector.team as PlayerTeam;
          this.account(team)[cache.resource] += cache.amount;
          if (team === this.localTeam) this.effects.supplyNumber(cache);
          this.notify(team, 'supplyCollected', { x: cache.x, z: cache.z, resource: cache.resource, amount: cache.amount });
        }
      },
      checkBattleResult(this: MeridianGame) {
        const s = this.s!;
        if (s.result || s.rules.kind === 'scenario' || s.rules.completed) return;
        return this.checkHQElimination();
      },
      checkHQElimination(this: MeridianGame) {
        const s = this.s!, mission = MISSIONS['hq-elimination'];
        // Deployment is not an HQ loss. Once established, the normal HQ rule resumes.
        for (const party of s.parties)
          if (party.deploymentPending && this.has('hq', party.id)) party.deploymentPending = false;
        // Resolve all losses together; simultaneous player elimination is always a loss.
        const eliminated = s.parties.filter(p => !p.eliminated &&
          !this.alive(e => e.team === p.id && (p.deploymentPending ? e.type === 'worker' : e.type === 'hq')).length);
        // Tally before defeated parties withdraw; withdrawal is not building destruction.
        const civilization = eliminated.length ? civilizationScoreForBuildings(s.entities, 0) : 0;
        for (const party of eliminated) {
          party.eliminated = true;
          // Withdrawal, not combat kills: no score, promotions, explosions or RNG draws.
          for (const e of this.alive(e => e.team === party.id)) {
            e.hp = 0;
            e.deathAt = s.time;
            e.target = null;
            e.queue = [];
            if (e.kind === 'building') this.navDirty = true;
          }
          s.fields = s.fields.filter(f => f.team !== party.id);
          s.scans = s.scans.filter(scan => scan.team !== party.id);
          s.recalls = s.recalls.filter(recall => recall.team !== party.id);
          if (party.id !== 0) this.emit('alert', { text: `Opponent ${party.id} eliminated.` });
        }
        if (eliminated.length) this.world!.reveal(s.entities, s.scans);
        if (this.party(0).eliminated)
          this.finish(false, mission.defeat, civilization);
        else if (s.parties.every(p => p.id === 0 || p.eliminated))
          this.finish(true, mission.victory, civilization);
      },
      abilityStats(this: MeridianGame, kind: AbilityType, team: PlayerTeam = 0): AbilityStats {
        return abilityStats(kind, this.party(team).meta[kind] || 0);
      },
      resolveRecalls(this: MeridianGame) {
        const s = this.s!;
        for (const recall of s.recalls.filter(item => item.at <= s.time)) {
          const hq = this.get(recall.hq), reserved: UnitPlacement[] = [];
          if (!hq || hq.hp <= 0 || hq.team !== recall.team || hq.kind !== 'building' ||
              hq.type !== 'hq' || hq.progress < 1) continue;
          for (const id of recall.ids) {
            const unit = this.get(id);
            if (!unit || unit.team !== recall.team || unit.kind !== 'unit' || unit.type === 'worker' ||
                (UNITS[unit.type] as UnitDefinitionShape).flying) continue;
            const old = { x: unit.x, z: unit.z };
            unit.x = hq.x; unit.z = hq.z;
            const position = this.unitPosition(unit, reserved);
            if (!position) { unit.x = old.x; unit.z = old.z; continue; }
            unit.x = position.x; unit.z = position.z;
            this.setOrder(unit, { type: 'idle' });
            reserved.push({ type: unit.type, size: unit.size, ...position });
            this.effects.drop(position, FACTIONS[this.factionFor(recall.team)].color, recall.team);
          }
        }
        s.recalls = s.recalls.filter(recall => recall.at > s.time);
      },
      abilityRequirement(this: MeridianGame, kind: AbilityType, team: PlayerTeam = 0): string | null {
        if (!this.party(team).loadout.includes(kind)) return 'Ability not equipped for this expedition.';
        if (kind === 'orbital' && !this.alive(e => e.team === team && e.kind === 'building' &&
          e.type === ABILITY_RULES.orbitalBuilding && e.progress >= 1).length)
          return 'Requires a completed ' + buildingName(ABILITY_RULES.orbitalBuilding, this.factionFor(team)) + '.';
        return null;
      },
      recallSelection(this: MeridianGame, p: Position, team: PlayerTeam, supply: number) {
        const hq = this.alive(e => e.team === team && e.kind === 'building' && e.type === 'hq' && e.progress >= 1)
          .sort((a, b) => distance(a, p) - distance(b, p) || a.id - b.id)[0] as BuildingEntity | undefined;
        if (!hq) return null;
        const candidates = this.alive(e => e.team === team && e.kind === 'unit' && e.type !== 'worker' &&
          !(UNITS[e.type] as UnitDefinitionShape).flying && distance(e, p) <= 9)
          .sort((a, b) => distance(a, p) - distance(b, p) || a.id - b.id) as UnitEntity[];
        const units: UnitEntity[] = [];
        let used = 0;
        for (const unit of candidates) {
          const cost = UNITS[unit.type].supply;
          if (used + cost > supply) continue;
          used += cost; units.push(unit);
        }
        if (!units.length) return null;
        const reserved: UnitPlacement[] = [];
        for (const unit of units) {
          const body: UnitPlacement = { type: unit.type, size: unit.size, x: hq.x, z: hq.z },
            position = this.unitPosition(body, reserved);
          if (!position) return null;
          reserved.push({ ...body, ...position });
        }
        return { hq, units };
      },
      ability(this: MeridianGame, kind: AbilityType, p: Position, team: PlayerTeam = 0) {
        if (this.s!.stopped || this.party(team).eliminated) return false;
        const s = this.s!, account = this.account(team), faction = this.factionFor(team),
          d = this.abilityStats(kind, team), requirement = this.abilityRequirement(kind, team);
        if (requirement) { this.notify(team, 'toast', requirement); return false; }
        if (account.abilities[kind] > s.time) {
          this.notify(team, 'toast', 'Ability recharging: ' + Math.ceil(account.abilities[kind] - s.time) + ' seconds.');
          return false;
        }
        if (account.energy < d.energy) { this.notify(team, 'toast', 'Insufficient command energy.'); return false; }
        if (kind !== 'scan' && !this.world!.sight[team].explored[this.world!.idx(p.x, p.z)]) {
          this.notify(team, 'toast', 'Scout or scan this location first.'); return false;
        }
        if (kind === 'orbital' && !this.world!.sight[team].visible[this.world!.idx(p.x, p.z)]) {
          this.notify(team, 'toast', 'Orbital strike requires current vision at the target.'); return false;
        }
        if (kind === 'drop' && !this.alive(e => e.team === team &&
          (e.kind === 'unit' || (e.kind === 'building' && e.progress >= 1 && !isCivilizationBuildingType(e.type))) &&
          distance(e, p) <= ABILITY_RULES.reinforcementRange).length) {
          this.notify(team, 'toast', `Reinforcements require own troops or a completed structure within ${ABILITY_RULES.reinforcementRange} meters.`);
          return false;
        }
        if (kind === 'drop' && this.supply(team) + d.supply! > this.cap(team)) {
          this.notify(team, 'toast', `Reinforcements require ${d.supply} free supply.`); return false;
        }
        let landings: UnitPlacement[] | null = null;
        const landingOffset = (index: number) => index < 4
          ? { x: (index % 2) * 2 - 1, z: Math.floor(index / 2) * 2 - 1 } : { x: 0, z: 3 };
        if (kind === 'drop' && this.world!.surface) {
          landings = [];
          for (let i = 0; i < d.unitTypes!.length; i++) {
            const type = d.unitTypes![i], offset = landingOffset(i), body: UnitPlacement = {
              type, size: UNITS[type].size, x: p.x + offset.x, z: p.z + offset.z },
              loc = this.unitPosition(body, landings);
            if (!loc || !this.world!.terrainFree(p, loc, body.size * UNIT_BODY_SCALE)) {
              this.notify(team, 'toast', 'Reinforcements need clear ground away from cliffs.'); return false;
            }
            landings.push({ ...body, ...loc });
          }
        }
        const recall = kind === 'recall' ? this.recallSelection(p, team, d.recallSupply!) : null;
        if (kind === 'recall' && !recall) {
          this.notify(team, 'toast', 'Emergency recall needs ground troops and clear space at a completed command center.');
          return false;
        }
        account.energy -= d.energy;
        account.abilities[kind] = s.time + d.cd;
        if (kind === 'orbital') {
          s.strikes.push({ x: p.x, z: p.z, at: s.time + d.strikeDelay!,
            ...(d.strikeDelay !== 2.2 ? { warning: d.strikeDelay } : {}),
            radius: faction === FACTION_ID.THIRD ? 8 : 10,
            damage: (faction === FACTION_ID.THIRD ? 440 : faction === FACTION_ID.SECOND ? 260 : 355) * d.damageMultiplier!,
            team, type: 'orbital' });
          s.scans.push({ ...p, team, r: 17, until: s.time + 8 });
          this.notify(team, 'radio', 'Orbital command|Target solution confirmed. Clear the impact zone.');
        } else if (kind === 'repair') {
          for (const e of this.near(p.x, p.z, d.radius!, a => a.team === team)) {
            e.hp = Math.min(e.maxHp, e.hp + d.instantHull!);
            if (e.maxShield) e.shield = Math.min(e.maxShield, e.shield + d.instantShield!);
          }
          s.fields.push({ type: 'repair', team, x: p.x, z: p.z, r: d.radius!,
            until: s.time + d.duration!, power: d.healing });
          this.notify(team, 'heal', p);
        } else if (kind === 'scan') {
          s.scans.push({ ...p, team, r: d.scanRadius!, until: s.time + d.duration! });
          this.notify(team, 'scan', p); this.world!.reveal(s.entities, s.scans);
        } else if (kind === 'drop') {
          for (let i = 0; i < d.unitTypes!.length; i++) {
            const type = d.unitTypes![i], offset = landingOffset(i),
              loc = landings?.[i] ?? this.world!.nearest(p.x + offset.x, p.z + offset.z),
              unit = this.spawnUnit(type, loc.x, loc.z, team, faction);
            if (unit && d.landingProtection) unit.reinforcedUntil = s.time + d.landingProtection;
            this.effects.drop(loc, FACTIONS[faction].color, team);
          }
          this.notify(team, 'radio', 'Reinforcement channel|Boots on the ground. Point us at the trouble.');
        } else if (kind === 'recall') {
          s.recalls.push({ ...p, team, hq: recall!.hq.id, at: s.time + d.recallDelay!, ids: recall!.units.map(e => e.id) });
          this.notify(team, 'radio', 'Emergency recall|Extraction lock confirmed. Hold for transit.');
        } else {
          s.fields.push({ type: kind, team, x: p.x, z: p.z, r: d.radius!,
            until: s.time + d.duration!, power: kind === 'bulwark' ? d.damageReduction : d.moveMultiplier,
            ...(kind === 'disruption' || kind === 'surge' ? { reload: d.reloadMultiplier } : {}) });
          this.notify(team, kind === 'bulwark' ? 'heal' : 'scan', p);
        }
        return true;
      },
      finish(this: MeridianGame, win: boolean, text: string, civilizationScore = civilizationScoreForBuildings(this.s!.entities, 0)) {
        if (this.s!.result || this.s!.rules.kind === 'scenario' || this.s!.rules.completed) return;
        let s = this.s!,
          h = this.alive(e => e.team === 0 && e.type === 'hq') as BuildingEntity[],
          integrity = h.length ? Math.max(...h.map(e => e.hp / e.maxHp)) : 0;
        s.result = {
          civilizationScore,
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
        if (win) this.world!.clearFog();
        if (this.stepping) this.pendingResult = { state: s, result: s.result };
        else this.emit('result', s.result);
      },
    };
    type RuntimeMethods = typeof runtimeMethods;
    interface MeridianGame extends RuntimeMethods {}
    defineMeridianGameMethods(runtimeMethods);

    function formatTime(s: number) {
      s = Math.max(0, Math.floor(s || 0));
      return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }
