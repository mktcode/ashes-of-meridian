    /* Procedural meshes used by the WebGL renderer and battlefield view. */
    'use strict';
    const geom = {
      tri(out, a, b, c, col = [1, 1, 1], normal = null) {
        let n = normal || V.norm(V.cross(V.sub(b, a), V.sub(c, a)));
        for (let p of [a, b, c]) out.push(...p, ...n, ...col);
      },
      box() {
        let o = [];
        for (let [a, b, c, d] of [
          [
            [-0.5, 0.5, -0.5],
            [-0.5, 0.5, 0.5],
            [0.5, 0.5, 0.5],
            [0.5, 0.5, -0.5]
          ],
          [
            [-0.5, -0.5, 0.5],
            [-0.5, -0.5, -0.5],
            [0.5, -0.5, -0.5],
            [0.5, -0.5, 0.5]
          ],
          [
            [0.5, -0.5, -0.5],
            [0.5, 0.5, -0.5],
            [0.5, 0.5, 0.5],
            [0.5, -0.5, 0.5]
          ],
          [
            [-0.5, -0.5, 0.5],
            [-0.5, 0.5, 0.5],
            [-0.5, 0.5, -0.5],
            [-0.5, -0.5, -0.5]
          ],
          [
            [0.5, -0.5, 0.5],
            [0.5, 0.5, 0.5],
            [-0.5, 0.5, 0.5],
            [-0.5, -0.5, 0.5]
          ],
          [
            [-0.5, -0.5, -0.5],
            [-0.5, 0.5, -0.5],
            [0.5, 0.5, -0.5],
            [0.5, -0.5, -0.5]
          ]
        ]) {
          this.tri(o, a, b, c);
          this.tri(o, a, c, d);
        }
        return o;
      },
      cylinder(n = 10, top = 1) {
        let o = [];
        for (let i = 0; i < n; i++) {
          let a = (i / n) * Math.PI * 2,
            b = ((i + 1) / n) * Math.PI * 2,
            p = [Math.cos(a), -0.5, Math.sin(a)],
            q = [Math.cos(b), -0.5, Math.sin(b)],
            r = [Math.cos(b) * top, 0.5, Math.sin(b) * top],
            s = [Math.cos(a) * top, 0.5, Math.sin(a) * top];
          this.tri(o, p, r, q);
          if (top > 0) this.tri(o, p, s, r);
          this.tri(o, [0, -0.5, 0], p, q);
          if (top > 0) this.tri(o, [0, 0.5, 0], r, s);
        }
        return o;
      },
      octa() {
        let o = [],
          top = [0, 1, 0],
          bottom = [0, -1, 0],
          ring = [
            [1, 0, 0],
            [0, 0, 1],
            [-1, 0, 0],
            [0, 0, -1]
          ];
        for (let i = 0; i < 4; i++) {
          this.tri(o, top, ring[(i + 1) % 4], ring[i]);
          this.tri(o, bottom, ring[i], ring[(i + 1) % 4]);
        }
        return o;
      },
      sphere(n = 10, r = 6) {
        let o = [];
        for (let j = 0; j < r; j++)
          for (let i = 0; i < n; i++) {
            let p = (i, j) => {
              let a = (i / n) * Math.PI * 2,
                b = (j / r) * Math.PI;
              return [Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)];
            };
            let a = p(i, j),
              b = p(i + 1, j),
              c = p(i + 1, j + 1),
              d = p(i, j + 1);
            this.tri(o, a, b, c);
            this.tri(o, a, c, d);
          }
        return o;
      },
      // A rooted six-sided prism with a beveled foot and an asymmetric faceted tip.
      crystal() {
        const o = [],
          n = 6,
          angles = [0, 1.02, 2.13, 3.18, 4.25, 5.26],
          shoulders = [0.7, 0.76, 0.65, 0.72, 0.79, 0.68];
        const rings = [
          angles.map(a => [Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7]),
          angles.map(a => [Math.cos(a), 0.18, Math.sin(a)]),
          angles.map((a, i) => [Math.cos(a) * 0.83, shoulders[i], Math.sin(a) * 0.83])
        ];
        const shades = [0.86, 1, 0.9, 0.78, 0.95, 0.83],
          tint = (i, gain) => [shades[i] * gain, shades[i] * gain * 0.98, shades[i] * gain * 0.92];
        for (let i = 0; i < n; i++) {
          let k = (i + 1) % n;
          for (let j = 0; j < 2; j++) {
            let a = rings[j][i],
              b = rings[j][k],
              c = rings[j + 1][k],
              d = rings[j + 1][i];
            this.tri(o, a, d, c, tint(i, j === 0 ? 0.7 : 1));
            this.tri(o, a, c, b, tint(i, j === 0 ? 0.7 : 1));
          }
          this.tri(o, [0.18, 1, -0.13], rings[2][k], rings[2][i], tint(i, 1.08));
          this.tri(o, [0, 0, 0], rings[0][i], rings[0][k], tint(i, 0.65));
        }
        return o;
      },
      // Reusable, irregular rock meshes; this RNG never advances the map-layout stream.
      rock(seed, kind) {
        const rand = seeded(seed),
          o = [],
          n = 9,
          profiles = {
            boulder: [
              [0, 0.7],
              [0.24, 1],
              [0.64, 0.87],
              [0.91, 0.4]
            ],
            crag: [
              [0, 0.8],
              [0.27, 1],
              [0.65, 0.57],
              [1.12, 0.13]
            ],
            ridge: [
              [0, 0.83],
              [0.18, 1],
              [0.57, 0.78],
              [0.83, 0.34]
            ],
            shelf: [
              [0, 0.8],
              [0.1, 1],
              [0.23, 0.83],
              [0.34, 0.94],
              [0.46, 0.52]
            ]
          },
          profile = profiles[kind],
          angles = Array.from({ length: n }, (_, i) => ((i + (rand() - 0.5) * 0.36) * Math.PI * 2) / n);
        const rings = profile.map(([height, radius], level) =>
          angles.map(angle => {
            let a = angle + level * 0.045,
              r = radius * (0.79 + rand() * 0.21);
            let x = Math.cos(a) * r + height * 0.1,
              z = Math.sin(a) * r * (kind === 'ridge' ? 0.57 : 1);
            const bound = Math.max(1, Math.hypot(x, z));
            return [x / bound, level === 0 ? 0 : height + (rand() - 0.5) * 0.12, z / bound];
          })
        );
        const tint = level => {
          let c = 0.88 + (level / profile.length) * 0.18 + (rand() - 0.5) * 0.1;
          return [c, c * 0.98, c * 0.95];
        };
        for (let j = 0; j < rings.length - 1; j++)
          for (let i = 0; i < n; i++) {
            let k = (i + 1) % n,
              a = rings[j][i],
              b = rings[j][k],
              c = rings[j + 1][k],
              d = rings[j + 1][i];
            this.tri(o, a, d, c, tint(j));
            this.tri(o, a, c, b, tint(j));
          }
        const top = rings.at(-1),
          crown = [0.08, profile.at(-1)[0] + 0.09, -0.04];
        for (let i = 0; i < n; i++) {
          let k = (i + 1) % n;
          this.tri(o, crown, top[k], top[i], tint(profile.length));
          this.tri(o, [0, 0, 0], rings[0][i], rings[0][k], tint(0));
        }
        return o;
      },
      ring(n = 48, width = 0.055) {
        let o = [];
        for (let i = 0; i < n; i++) {
          let a = (i / n) * Math.PI * 2,
            b = ((i + 1) / n) * Math.PI * 2,
            p = [Math.cos(a), 0, Math.sin(a)],
            q = [Math.cos(b), 0, Math.sin(b)],
            r = [Math.cos(b) * (1 - width), 0, Math.sin(b) * (1 - width)],
            s = [Math.cos(a) * (1 - width), 0, Math.sin(a) * (1 - width)];
          this.tri(o, p, r, q, [1, 1, 1], [0, 1, 0]);
          this.tri(o, p, s, r, [1, 1, 1], [0, 1, 0]);
        }
        return o;
      },
      plane() {
        let o = [];
        this.tri(o, [-0.5, 0, -0.5], [-0.5, 0, 0.5], [0.5, 0, 0.5], [1, 1, 1], [0, 1, 0]);
        this.tri(o, [-0.5, 0, -0.5], [0.5, 0, 0.5], [0.5, 0, -0.5], [1, 1, 1], [0, 1, 0]);
        return o;
      }
    };
