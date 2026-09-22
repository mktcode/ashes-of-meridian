/* View-only embellishments: never mutate CPU effects or consume simulation RNG. */
'use strict';
interface MotionDustTrack {
  walk: number;
  emitted: number;
  puffs: { x: number; z: number; at: number }[];
}
const motionDustViews = new WeakMap<MeridianRenderer, { world: Battlefield; team: PlayerTeam; color: readonly number[]; tracks: Map<UnitEntity, MotionDustTrack> }>();
function renderMotionDust(R: MeridianRenderer, world: Battlefield, s: RunState, localTeam: PlayerTeam = 0) {
  if (!(R.quality > 0) || R.cinema) { motionDustViews.delete(R); return; }
  let view = motionDustViews.get(R);
  if (!view || view.world !== world || view.team !== localTeam) {
    view = { world, team: localTeam, color: Array.from(R.color(world.definition.palette.ground), c => c * .55 + .35), tracks: new Map() };
    motionDustViews.set(R, view);
  }
  const seen = new Set<UnitEntity>(), cap = R.quality > 1 ? 48 : 24, now = s.time;
  for (const e of s.entities) {
    if (seen.size >= cap) break;
    if (e.kind !== 'unit' || e.hp <= 0 || (e.type !== 'tank' && e.type !== 'artillery') || !world.visible[world.idx(e.x,e.z)]) continue;
    const p = R.project(e.x, world.surface?.heightAt(e.x,e.z) ?? 0, e.z), v = R.viewport;
    if (!p || p.x < v.left - 30 || p.x > v.right + 30 || p.y < v.top - 30 || p.y > v.bottom + 30) continue;
    seen.add(e);
    let track = view.tracks.get(e);
    if (!track) { track = { walk: e.walk, emitted: now, puffs: [] }; view.tracks.set(e, track); }
    if (e.walk > track.walk && now - track.emitted >= .18) {
      const side = Math.sin(e.id * 7 + Math.floor(e.walk * 3)) > 0 ? 1 : -1;
      track.puffs.push({ x: e.x - Math.sin(e.rot) * e.size + Math.cos(e.rot) * side * e.size * .65,
        z: e.z - Math.cos(e.rot) * e.size - Math.sin(e.rot) * side * e.size * .65, at: now });
      track.emitted = now;
    }
    track.walk = e.walk;
    track.puffs = track.puffs.filter(puff => now - puff.at < .42).slice(R.quality > 1 ? -2 : -1);
    for (const puff of track.puffs) {
      if (!world.visible[world.idx(puff.x,puff.z)]) continue;
      const age = clamp((now - puff.at) / .42, 0, 1), radius = .3 + age * .6;
      R.add('sphere', puff.x, (world.surface?.heightAt(puff.x,puff.z) ?? 0) + .18 + age * .35, puff.z, radius, radius * .45, radius,
        view.color, 0, 0, 0, 0, (1 - age) * .17, 'effects');
    }
  }
  for (const e of view.tracks.keys()) if (!seen.has(e)) view.tracks.delete(e);
}
// Conservative clip-plane test of a world AABB, padded for bloom/postprocessing.
// Missing camera data in CPU-only views means no culling, not an invisible effect.
function effectBoundsVisible(R: MeridianRenderer, x: number, y: number, z: number, rx: number, ry: number, rz: number) {
  const m = R.vp;
  if (!m || !Number.isFinite(x + y + z + rx + ry + rz)) return true;
  for (let axis = 0; axis < 3; axis++) {
    const pad = axis === 2 ? 1 : 1 + 128 / (axis === 0 ? R.viewport.width : R.viewport.height);
    for (let sign = -1; sign <= 1; sign += 2) {
      const a = pad * m[3] + sign * m[axis], b = pad * m[7] + sign * m[4 + axis],
        c = pad * m[11] + sign * m[8 + axis], d = pad * m[15] + sign * m[12 + axis];
      if (a * x + b * y + c * z + d + Math.abs(a) * rx + Math.abs(b) * ry + Math.abs(c) * rz < 0) return false;
    }
  }
  return true;
}
const effectSurfaceBounds = new WeakMap<BattlefieldSurface, { low: number; high: number }>();
// At most 192 segments plus the closing point; reused only within synchronous drawing.
const effectRingPoints = new WeakMap<MeridianRenderer, Float64Array>();
function effectGroundBounds(R: MeridianRenderer) {
  const surface = R.surface;
  if (!surface || R.cinema) return { low: 0, high: 0 };
  let bounds = effectSurfaceBounds.get(surface);
  if (!bounds) {
    let low = Infinity, high = -Infinity;
    // Heights are immutable for the lifetime of a battlefield surface. Include
    // negative terrain too; maxHeight alone is not a conservative lower bound.
    for (const h of surface.heights || []) { low = Math.min(low, h); high = Math.max(high, h); }
    bounds = { low, high };
    effectSurfaceBounds.set(surface, bounds);
  }
  return bounds;
}
function drawVisibleEffectBeam(R: MeridianRenderer, a: number[], b: number[], width: number, color: RenderColor, glow: number, alpha: number) {
  if (effectBoundsVisible(R, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2,
    Math.abs(a[0] - b[0]) / 2 + width, Math.abs(a[1] - b[1]) / 2 + width, Math.abs(a[2] - b[2]) / 2 + width))
    R.beam(a, b, width, color, glow, alpha);
}
        function drawEffectRing(R: MeridianRenderer, x: number, z: number, r: number, color: RenderColor, alpha = 0.65, y = 0.1, rot = 0) {
          const ground = effectGroundBounds(R), thickness = .05;
          if (!effectBoundsVisible(R, x, (ground.low + ground.high) / 2 + y, z,
            Math.abs(r) + thickness, (ground.high - ground.low) / 2 + thickness, Math.abs(r) + thickness)) return;
          if (R.surface && !R.cinema) {
            // Follow each local surface segment, rather than floating a large flat ring over ramps.
            const count = Math.min(192,Math.max(24,Math.ceil(r * Math.PI * 2 / 1.25)));
            let low = Infinity, high = -Infinity;
            let points = effectRingPoints.get(R);
            if (!points) { points = new Float64Array(193 * 3); effectRingPoints.set(R, points); }
            for (let i = 0; i <= count; i++) {
              const a = rot+i*Math.PI*2/count, px = x+Math.sin(a)*r, pz = z+Math.cos(a)*r,
                h = R.surface.heightAt(px,pz);
              points[i*3] = px; points[i*3+1] = h+y; points[i*3+2] = pz;
              if (i < count) { low = Math.min(low,h); high = Math.max(high,h); }
            }
            if (high-low < .01) {
              R.add('ring',x,high+y,z,r,1,r,color,rot,0,0,.45,alpha,'effects');
              return;
            }
            for (let i = 0; i < count; i++) {
              const a = i*3, b = (i+1)*3;
              R.beam([points[a],points[a+1],points[a+2]],[points[b],points[b+1],points[b+2]],.045,color,.45,alpha);
            }
          } else R.add('ring', x, y, z, r, 1, r, color, rot, 0, 0, 0.45, alpha, 'effects');
        }
        function renderBattlefieldEffects(R: MeridianRenderer, effects: MeridianEffects, world: Battlefield, s: RunState, pings: UIPing[], t: number, localTeam: PlayerTeam = 0) {
          const ring = (...args: EffectRingArgs) => drawEffectRing(R, ...args);
          renderMotionDust(R, world, s, localTeam);
          // Culling must not redistribute the existing accent budget to later effects.
          let accents = R.quality > 1 ? 48 : R.quality > 0 ? 16 : 0;
          for (let f of effects.fx) {
            if (!world.visible[world.idx(f.x, f.z)] && (f.type !== 'drop' || (f.team ?? 0) !== localTeam)) continue;
            let life = clamp(f.life / f.maxLife, 0, 1),
              age = 1 - life;
            if (f.type === 'beam') {
              drawVisibleEffectBeam(R, [f.x, f.y, f.z], [f.tx, f.ty, f.tz], f.width, f.color, 1.6, Math.min(1, life * 3));
              if (accents > 0 && effects.combatBeams.has(f)) {
                accents--;
                const flash = clamp(f.life / .1, 0, 1), radius = .14 + f.width * 2;
                if (effectBoundsVisible(R, f.x, f.y, f.z, radius, radius * .7, radius))
                  R.add('sphere', f.x, f.y, f.z, radius, radius * .7, radius, f.color, 0, 0, 0, 2, flash * .8, 'effects');
                // Place the accent at the approximate hull, not inside the target mesh.
                const dx = f.x - f.tx, dz = f.z - f.tz, distance = Math.max(.001, Math.hypot(dx,dz));
                const hitRadius = Math.min(effects.combatBeams.get(f) || .65, distance * .5);
                const hitX = f.tx + dx / distance * hitRadius, hitZ = f.tz + dz / distance * hitRadius;
                if (world.visible[world.idx(f.tx,f.tz)] && world.visible[world.idx(hitX,hitZ)]) {
                  for (let i = 0; i < (R.quality > 1 ? 3 : 1); i++) {
                    const angle = Math.atan2(dx,dz) + Math.sin(f.tx * 1.7 + f.tz * 2.3 + i * 2.39996) * .9, length = .15 + age * .8;
                    drawVisibleEffectBeam(R, [hitX, f.ty, hitZ], [hitX + Math.sin(angle) * length, f.ty + length * .7, hitZ + Math.cos(angle) * length],
                      .025, f.color, 1.5, life * .7);
                  }
                }
              }
            } else if (f.type === 'shell') {
              if (accents > 0 && age * f.maxLife < .1) {
                accents--;
                if (effectBoundsVisible(R, f.x, f.y, f.z, .27, .2, .27))
                  R.add('sphere', f.x, f.y, f.z, .27, .2, .27, f.color, 0, 0, 0, 2, (1 - age * f.maxLife / .1) * .8, 'effects');
              }
              let x = f.x + (f.tx - f.x) * age,
                z = f.z + (f.tz - f.z) * age,
                y = f.startY * (1 - age) + (f.endY ?? 0) * age + Math.sin(age * Math.PI) * 12;
              // Shell bodies and particles use the dynamic layer and may cast into view.
              R.add('sphere', x, y, z, 0.22, 0.22, 0.22, f.color, 0, 0, 0, 2);
              drawVisibleEffectBeam(R,
                [x, y, z],
                [x - (f.tx - f.x) * 0.03, y + 0.3, z - (f.tz - f.z) * 0.03],
                0.07,
                f.color,
                1.4,
                0.65
              );
            } else if (f.type === 'blast') {
              let r = (0.4 + age * 1.8) * f.size,
                y = (world.surface?.heightAt(f.x,f.z) ?? 0) + 0.6 + age * f.size * 0.6;
              if (effectBoundsVisible(R, f.x, y, f.z, r, r * .6, r)) R.add(
                'sphere',
                f.x,
                y,
                f.z,
                r,
                r * 0.6,
                r,
                f.color,
                0,
                0,
                0,
                1.6,
                life * 0.7,
                'effects'
              );
              ring(f.x, f.z, r * 1.7, f.color, life * 0.8, 0.16);
            } else if (f.type === 'particle')
              R.add(
                'box',
                f.x,
                f.y,
                f.z,
                f.size,
                f.size,
                f.size,
                f.color,
                age * 7,
                age * 5,
                0,
                life * 0.8
              );
            else if (f.type === 'smoke') {
              let r = f.size * (1 + age * 0.9);
              if (effectBoundsVisible(R, f.x, f.y, f.z, r, r * .8, r))
                R.add('sphere', f.x, f.y, f.z, r, r * 0.8, r, f.color, 0, 0, 0, 0, life * 0.2, 'effects');
            } else if (f.type === 'drop') {
              const base = world.surface?.heightAt(f.x,f.z) ?? 0;
              drawVisibleEffectBeam(R, [f.x, base + 0.2, f.z], [f.x, base + life * 24 + 2, f.z], life * 0.24, f.color, 1.3, life);
              ring(f.x, f.z, 1 + age * 2.5, f.color, life);
            }
          }
          for (let p of pings)
            ring(p.x, p.z, 1 + (1 - p.life / p.maxLife) * 4, p.color || 0x9fe9d6, p.life / p.maxLife);
          for (let f of s.fields) {
            if ((f.team ?? 0) !== localTeam && !world.visible[world.idx(f.x,f.z)]) continue;
            let left = f.until - s.time;
            if (left <= 0) continue;
            ring(
              f.x,
              f.z,
              f.r || 12,
              f.type === 'bloom' ? 0xb5e794 : 0x91e5d3,
              0.3 + 0.15 * Math.sin(t * 3)
            );
            const y = (world.surface?.heightAt(f.x,f.z) ?? 0) + 0.25, radius = f.r || 12;
            if (effectBoundsVisible(R, f.x, y, f.z, radius, .16, radius)) R.add(
              'sphere',
              f.x,
              y,
              f.z,
              f.r || 12,
              0.16,
              f.r || 12,
              f.type === 'bloom' ? 0xa3cc8b : 0x7ecebb,
              0,
              0,
              0,
              0.3,
              0.04,
              'effects'
            );
          }
          for (let scan of s.scans) {
            if ((scan.team ?? 0) !== localTeam) continue;
            let left = scan.until - s.time;
            if (left > 0)
              ring(scan.x, scan.z, scan.r || 32, 0x9bc6ea, 0.1 + (0.5 + 0.5 * Math.sin(t * 2)) * 0.1);
          }
          for (let a of s.strikes) {
            if (a.type === 'shell' || (a.team !== localTeam && !world.visible[world.idx(a.x,a.z)])) continue;
            let wait = a.at - s.time,
              col = a.team === localTeam ? 0x9fe3d1 : 0xf4ad84,
              rad = a.radius || 10;
            ring(a.x, a.z, rad, col, 0.58, 0.14);
            ring(
              a.x,
              a.z,
              rad * clamp(wait / (a.type === 'flare' ? 5 : 2.2), 0.05, 1),
              col,
              0.85,
              0.15
            );
            const base = world.surface?.heightAt(a.x,a.z) ?? 0;
            drawVisibleEffectBeam(R, [a.x, base + 0.1, a.z], [a.x, base + 10 + Math.sin(t * 4) * 1, a.z], 0.045, col, 1.2, 0.5);
          }
        }
