/* CPU cosmetic effects. Never defer RNG-consuming work to rendering. */
'use strict';

class MeridianEffects {
      declare random: () => number;
      declare fx: BattlefieldEffect[];
      declare floats: FloatingText[];
      // Only short-lived particles/smoke are reused. Simulation entities and shell identities are not pooled.
      private freeParticles: Extract<BattlefieldEffect, { type: 'particle' }>[] = [];
      private freeSmoke: Extract<BattlefieldEffect, { type: 'smoke' }>[] = [];
      private pooled = new WeakSet<BattlefieldEffect>();
      // View-only combat marker/hull radius: keep serialized effects and RNG samples unchanged.
      readonly combatBeams = new WeakMap<BattlefieldEffect, number>();
      readonly weaponFactions = new WeakMap<BattlefieldEffect, FactionId>();
      // Detailed Pact infantry own their animated muzzle flash; keep common impacts.
      readonly modelMuzzleBeams = new WeakSet<BattlefieldEffect>();
      groundHeight: (x: number, z: number) => number = () => 0;
      entityHeight: (e: Pick<EffectPose, 'x' | 'z' | 'type' | 'exit'>) => number = e => this.groundHeight(e.x,e.z);

      constructor(random: () => number) {
        // The provider resolves the current game's selected effect RNG after each start.
        this.random = random;
        this.reset();
      }
      reset() {
        this.fx = [];
        this.floats = [];
        this.freeParticles.length = this.freeSmoke.length = 0;
        this.pooled = new WeakSet();
      }
      private recycle(f: BattlefieldEffect) {
        if (!this.pooled.has(f) || this.freeParticles.length + this.freeSmoke.length >= 500) return;
        if (f.type === 'particle') this.freeParticles.push(f);
        else if (f.type === 'smoke') this.freeSmoke.push(f);
      }
      trim(limit: number) {
        const count = this.fx.length - limit;
        if (count <= 0) return;
        for (let i = 0; i < count; i++) this.recycle(this.fx[i]);
        this.fx.copyWithin(0, count);
        this.fx.length = limit;
      }
      explosion(x: number, z: number, size = 1, color = 0xefb17c) {
        this.fx.push({ type: 'blast', x, z, size, life: 0.45, maxLife: 0.45, color });
        let n = Math.min(22, Math.round(8 + size * 3));
        for (let i = 0; i < n; i++) {
          let a = this.random() * 6.28,
            sp = (1 + this.random() * 4) * Math.sqrt(size);
          let f = this.freeParticles.pop();
          if (!f) {
            f = { type: 'particle', x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, size: 0, color: 0, life: 0, maxLife: 1.4 };
            this.pooled.add(f);
          }
          // Keep the existing sample order, including hidden single-player effects.
          f.x = x; f.y = this.groundHeight(x,z) + 0.8 + this.random() * size; f.z = z;
          f.vx = Math.sin(a) * sp; f.vz = Math.cos(a) * sp;
          f.vy = 3 + this.random() * 6;
          f.size = 0.08 + this.random() * 0.17;
          f.color = i % 3 ? color : 0x667278;
          f.life = 0.65 + this.random() * 0.7; f.maxLife = 1.4;
          this.fx.push(f);
        }
        for (let i = 0; i < 4; i++) {
          let f = this.freeSmoke.pop();
          if (!f) {
            f = { type: 'smoke', x: 0, y: 0, z: 0, vy: 1, life: 0, maxLife: 2.5, size: 0, color: 0 };
            this.pooled.add(f);
          }
          f.x = x + (this.random() - 0.5) * size;
          f.y = this.groundHeight(x,z) + 0.6 + this.random();
          f.z = z + (this.random() - 0.5) * size;
          f.vy = 1; f.life = f.maxLife = 2.5;
          f.size = size * 0.6 + 0.5; f.color = 0x64707c;
          this.fx.push(f);
        }
        this.trim(500);
      }
      damageNumber(e: Pick<EntityBase, 'x' | 'z' | 'team'>, amount: number, localTeam: PlayerTeam = 0) {
        if (this.floats.length < 35)
          this.floats.push({
            x: e.x,
            z: e.z,
            y: this.groundHeight(e.x,e.z) + 2.4,
            text: Math.round(amount).toString(),
            color: e.team === localTeam ? '#f8a88d' : '#f0cd93',
            life: 0.8,
            maxLife: 0.8
          });
      }
      supplyNumber(cache: SupplyCache) {
        // Local collection feedback has its own deterministic style, never draws RNG.
        if (this.floats.length >= 35) this.floats.shift();
        this.floats.push({
          x: cache.x, z: cache.z,
          y: this.groundHeight(cache.x,cache.z) + (cache.tier === 1 ? 2.1 : 3.5),
          text: `+${cache.amount} ${cache.resource === 'alloy' ? 'Cinder' : 'Echo'}`,
          color: cache.resource === 'alloy' ? '#f1ae45' : '#65e5e9',
          style: 'supply', life: 1.6, maxLife: 1.6
        });
      }
      shell(e: EffectPose, target: EffectPose, travel: number) {
        const height = this.entityHeight(e) + (isFlyingUnitType(e.type) ? 4.5 : e.kind === 'building' ? 3 : 1.45);
        const endY = this.groundHeight(target.x,target.z);
        this.fx.push({
            type: 'shell',
            x: e.x,
            y: height,
            z: e.z,
            tx: target.x,
            tz: target.z,
            startY: height,
            ...(endY ? {endY} : {}),
            life: travel,
            maxLife: travel,
            color: e.faction === FACTION_ID.SECOND ? 0xb8eba3 : 0xffce8f
          });
        this.weaponFactions.set(this.fx[this.fx.length - 1], e.faction);
      }
      shot(e: EffectPose, target: EffectPose, localTeam: PlayerTeam = 0) {
        const height = this.entityHeight(e) + (isFlyingUnitType(e.type) ? 4.5 : e.kind === 'building' ? 3 : 1.45),
          th = this.entityHeight(target) + (isFlyingUnitType(target.type) ? 4.5 : target.kind === 'building' ? 2.4 : 1),
          pactInfantry = e.kind === 'unit' && ['rifle','hero'].includes(e.type) && e.faction === FACTION_ID.FIRST,
          marshal = pactInfantry && e.type === 'hero';
        // Match authored +Z muzzles and the Marshal's cosmetic scale, without new RNG/effects.
        const scale = marshal ? 1.18 : 1, forward = marshal ? 1.3 : 1.155,
          muzzleX = pactInfantry ? (Math.cos(e.rot) * .24 + Math.sin(e.rot) * forward) * scale : Math.sin(e.rot) * .7,
          muzzleZ = pactInfantry ? (-Math.sin(e.rot) * .24 + Math.cos(e.rot) * forward) * scale : Math.cos(e.rot) * .7;
        this.fx.push({
              type: 'beam',
              x: e.x + muzzleX,
              y: pactInfantry ? this.entityHeight(e) + 1.425 * scale : height,
              z: e.z + muzzleZ,
              tx: target.x,
              ty: th,
              tz: target.z,
              life: e.faction === FACTION_ID.THIRD ? 0.19 : 0.1,
              maxLife: 0.19,
              color: pactInfantry ? 0x38d9e8 :
                e.faction === FACTION_ID.SECOND
                  ? 0xafe8a6
                  : e.faction === FACTION_ID.THIRD
                    ? 0xd9bfff
                    : e.team !== localTeam
                      ? 0xf49685
                      : 0xffd2a0,
              width: e.type === 'tank' || e.type === 'destroyer' ? 0.075 : 0.035
            });
        if (pactInfantry) this.modelMuzzleBeams.add(this.fx[this.fx.length - 1]);
        this.combatBeams.set(this.fx[this.fx.length - 1], target.size);
        this.weaponFactions.set(this.fx[this.fx.length - 1], e.faction);
      }
      construction(e: EffectPose, b: EffectPose, dt: number) {
        if (this.random() < dt * 4)
          this.fx.push({
              type: 'beam',
              x: e.x,
              y: this.entityHeight(e) + 1.1,
              z: e.z,
              tx: b.x + (this.random() - 0.5) * b.size,
              ty: this.entityHeight(b) + 1.2,
              tz: b.z + (this.random() - 0.5) * b.size,
              life: 0.15,
              maxLife: 0.15,
              color: 0x83e6d2,
              width: 0.035
            });
      }
      mining(e: EffectPose, n: EffectPose, dt: number, visible: () => boolean) {
        // Preserve short-circuit order: RNG first, visibility only on success.
        if (this.random() < dt * 3 && visible())
          this.fx.push({
            type: 'beam',
            x: e.x,
            y: this.entityHeight(e) + 1,
            z: e.z,
            tx: n.x,
            ty: this.entityHeight(n) + 1.5,
            tz: n.z,
            life: 0.1,
            maxLife: 0.1,
            color: 0xf0d39b,
            width: 0.025
          });
      }
      healing(e: EffectPose, t: EffectPose) {
        this.fx.push({
              type: 'beam',
              x: e.x,
              y: this.entityHeight(e) + 1.2,
              z: e.z,
              tx: t.x,
              ty: this.entityHeight(t) + (isFlyingUnitType(t.type) ? 4 : 1.1),
              tz: t.z,
              life: 0.25,
              maxLife: 0.25,
              color: 0x94efd0,
              width: 0.028
            });
      }
      drop(loc: Position, color: number, team: PlayerTeam = 0) {
        this.fx.push({
              type: 'drop', ...(team !== 0 ? {team} : {}),
              x: loc.x,
              z: loc.z,
              life: 1.0,
              maxLife: 1,
              color
            });
      }
      tick(dt: number) {
        for (let f of this.fx) {
          f.life -= dt;
          if (f.type === 'particle') {
            f.x += f.vx * dt;
            f.z += f.vz * dt;
            f.y += f.vy * dt;
            f.vy -= dt * 12;
            const floor = this.groundHeight(f.x,f.z) + .05;
            if (f.y < floor) {
              f.y = floor;
              f.vy = Math.abs(f.vy) * 0.25;
              f.vx *= 0.8;
              f.vz *= 0.8;
            }
          }
          if (f.type === 'smoke') f.y += dt * f.vy;
        }
        // Stable compaction preserves draw order without allocating two arrays every tick.
        let live = 0;
        for (const f of this.fx) {
          if (f.life > 0) this.fx[live++] = f;
          else this.recycle(f);
        }
        this.fx.length = live;
        live = 0;
        for (let f of this.floats) {
          f.life -= dt;
          f.y += dt * 1.5;
          if (f.life > 0) this.floats[live++] = f;
        }
        this.floats.length = live;
      }
}
