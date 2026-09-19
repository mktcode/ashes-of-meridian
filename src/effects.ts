/* CPU cosmetic effects. Never defer RNG-consuming work to rendering. */
'use strict';

class MeridianEffects {
      declare random: () => number;
      declare fx: BattlefieldEffect[];
      declare floats: FloatingText[];
      // View-only combat marker/hull radius: keep serialized effects and RNG samples unchanged.
      readonly combatBeams = new WeakMap<BattlefieldEffect, number>();

      constructor(random: () => number) {
        // The provider resolves the current game's selected effect RNG after each start.
        this.random = random;
        this.reset();
      }
      reset() {
        this.fx = [];
        this.floats = [];
      }
      explosion(x: number, z: number, size = 1, color = 0xefb17c) {
        this.fx.push({ type: 'blast', x, z, size, life: 0.45, maxLife: 0.45, color });
        let n = Math.min(22, Math.round(8 + size * 3));
        for (let i = 0; i < n; i++) {
          let a = this.random() * 6.28,
            sp = (1 + this.random() * 4) * Math.sqrt(size);
          this.fx.push({
            type: 'particle',
            x,
            y: 0.8 + this.random() * size,
            z,
            vx: Math.sin(a) * sp,
            vz: Math.cos(a) * sp,
            vy: 3 + this.random() * 6,
            size: 0.08 + this.random() * 0.17,
            color: i % 3 ? color : 0x667278,
            life: 0.65 + this.random() * 0.7,
            maxLife: 1.4
          });
        }
        for (let i = 0; i < 4; i++)
          this.fx.push({
            type: 'smoke',
            x: x + (this.random() - 0.5) * size,
            y: 0.6 + this.random(),
            z: z + (this.random() - 0.5) * size,
            vy: 1,
            life: 2.5,
            maxLife: 2.5,
            size: size * 0.6 + 0.5,
            color: 0x64707c
          });
        if (this.fx.length > 500) this.fx.splice(0, this.fx.length - 500);
      }
      damageNumber(e: Pick<EntityBase, 'x' | 'z' | 'team'>, amount: number, localTeam: PlayerTeam = 0) {
        if (this.floats.length < 35)
          this.floats.push({
            x: e.x,
            z: e.z,
            y: 2.4,
            text: Math.round(amount).toString(),
            color: e.team === localTeam ? '#f8a88d' : '#f0cd93',
            life: 0.8,
            maxLife: 0.8
          });
      }
      shell(e: UnitEntity | BuildingEntity, target: Entity, travel: number) {
        const height = e.type === 'air' ? 4.5 : e.kind === 'building' ? 3 : 1.45;
        this.fx.push({
            type: 'shell',
            x: e.x,
            y: height,
            z: e.z,
            tx: target.x,
            tz: target.z,
            startY: height,
            life: travel,
            maxLife: travel,
            color: e.faction === FACTION_ID.SECOND ? 0xb8eba3 : 0xffce8f
          });
      }
      shot(e: UnitEntity | BuildingEntity, target: Entity, localTeam: PlayerTeam = 0) {
        const height = e.type === 'air' ? 4.5 : e.kind === 'building' ? 3 : 1.45,
          th = target.type === 'air' ? 4.5 : target.kind === 'building' ? 2.4 : 1;
        this.fx.push({
              type: 'beam',
              x: e.x + Math.sin(e.rot) * 0.7,
              y: height,
              z: e.z + Math.cos(e.rot) * 0.7,
              tx: target.x,
              ty: th,
              tz: target.z,
              life: e.faction === FACTION_ID.THIRD ? 0.19 : 0.1,
              maxLife: 0.19,
              color:
                e.faction === FACTION_ID.SECOND
                  ? 0xafe8a6
                  : e.faction === FACTION_ID.THIRD
                    ? 0xd9bfff
                    : e.team !== localTeam
                      ? 0xf49685
                      : 0xffd2a0,
              width: e.type === 'tank' ? 0.075 : 0.035
            });
        this.combatBeams.set(this.fx[this.fx.length - 1], target.size);
      }
      construction(e: UnitEntity, b: BuildingEntity, dt: number) {
        if (this.random() < dt * 4)
          this.fx.push({
              type: 'beam',
              x: e.x,
              y: 1.1,
              z: e.z,
              tx: b.x + (this.random() - 0.5) * b.size,
              ty: 1.2,
              tz: b.z + (this.random() - 0.5) * b.size,
              life: 0.15,
              maxLife: 0.15,
              color: 0x83e6d2,
              width: 0.035
            });
      }
      mining(e: UnitEntity, n: ResourceEntity, dt: number, visible: () => boolean) {
        // Preserve short-circuit order: RNG first, visibility only on success.
        if (this.random() < dt * 3 && visible())
          this.fx.push({
            type: 'beam',
            x: e.x,
            y: 1,
            z: e.z,
            tx: n.x,
            ty: 1.5,
            tz: n.z,
            life: 0.1,
            maxLife: 0.1,
            color: 0xf0d39b,
            width: 0.025
          });
      }
      healing(e: UnitEntity, t: Entity) {
        this.fx.push({
              type: 'beam',
              x: e.x,
              y: 1.2,
              z: e.z,
              tx: t.x,
              ty: t.type === 'air' ? 4 : 1.1,
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
            if (f.y < 0.05) {
              f.y = 0.05;
              f.vy = Math.abs(f.vy) * 0.25;
              f.vx *= 0.8;
              f.vz *= 0.8;
            }
          }
          if (f.type === 'smoke') f.y += dt * f.vy;
        }
        this.fx = this.fx.filter(f => f.life > 0);
        for (let f of this.floats) {
          f.life -= dt;
          f.y += dt * 1.5;
        }
        this.floats = this.floats.filter(f => f.life > 0);
      }
}
