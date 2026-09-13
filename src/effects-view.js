/* Rendering only: no effect generation, ticking or RNG calls. */
'use strict';
        function drawEffectRing(R, x, z, r, color, alpha = 0.65, y = 0.1, rot = 0) {
          R.add('ring', x, y, z, r, 1, r, color, rot, 0, 0, 0.45, alpha, 'effects');
        }
        function renderBattlefieldEffects(R, effects, world, s, pings, t) {
          const ring = (...args) => drawEffectRing(R, ...args);
          for (let f of effects.fx) {
            if (!world.visible[world.idx(f.x, f.z)] && (f.type !== 'drop' || f.team === 1)) continue;
            let life = clamp(f.life / f.maxLife, 0, 1),
              age = 1 - life;
            if (f.type === 'beam')
              R.beam([f.x, f.y, f.z], [f.tx, f.ty, f.tz], f.width, f.color, 1.6, Math.min(1, life * 3));
            else if (f.type === 'shell') {
              let x = f.x + (f.tx - f.x) * age,
                z = f.z + (f.tz - f.z) * age,
                y = f.startY * (1 - age) + Math.sin(age * Math.PI) * 12;
              R.add('sphere', x, y, z, 0.22, 0.22, 0.22, f.color, 0, 0, 0, 2);
              R.beam(
                [x, y, z],
                [x - (f.tx - f.x) * 0.03, y + 0.3, z - (f.tz - f.z) * 0.03],
                0.07,
                f.color,
                1.4,
                0.65
              );
            } else if (f.type === 'blast') {
              let r = (0.4 + age * 1.8) * f.size;
              R.add(
                'sphere',
                f.x,
                0.6 + age * f.size * 0.6,
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
              R.add('sphere', f.x, f.y, f.z, r, r * 0.8, r, f.color, 0, 0, 0, 0, life * 0.2, 'effects');
            } else if (f.type === 'drop') {
              R.beam([f.x, 0.2, f.z], [f.x, life * 24 + 2, f.z], life * 0.24, f.color, 1.3, life);
              ring(f.x, f.z, 1 + age * 2.5, f.color, life);
            }
          }
          for (let p of pings)
            ring(p.x, p.z, 1 + (1 - p.life / p.maxLife) * 4, p.color || 0x9fe9d6, p.life / p.maxLife);
          for (let f of s.fields) {
            if (f.team === 1 && !world.visible[world.idx(f.x,f.z)]) continue;
            let left = f.until - s.time;
            if (left <= 0) continue;
            ring(
              f.x,
              f.z,
              f.r || 12,
              f.type === 'bloom' ? 0xb5e794 : 0x91e5d3,
              0.3 + 0.15 * Math.sin(t * 3)
            );
            R.add(
              'sphere',
              f.x,
              0.25,
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
            if (scan.team === 1) continue;
            let left = scan.until - s.time;
            if (left > 0)
              ring(scan.x, scan.z, scan.r || 32, 0x9bc6ea, 0.1 + (0.5 + 0.5 * Math.sin(t * 2)) * 0.1);
          }
          for (let a of s.strikes) {
            if (a.type === 'shell' || (a.team !== 0 && !world.visible[world.idx(a.x,a.z)])) continue;
            let wait = a.at - s.time,
              col = a.team === 0 ? 0x9fe3d1 : 0xf4ad84,
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
            R.beam([a.x, 0.1, a.z], [a.x, 10 + Math.sin(t * 4) * 1, a.z], 0.045, col, 1.2, 0.5);
          }
        }
