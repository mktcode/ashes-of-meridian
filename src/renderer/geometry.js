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
      // Free Marches command-center armor, baked at its existing world dimensions.
      // Vertex tints multiply the faction metal (also preserving preview/ghost tinting).
      commandHull() {
        const out = [], dark = [.4, .45, .5], metal = [1, 1, 1], roof = [1.42, 1.3, 1.17];
        const panel = (x, y, z, w, h, d, bevel, col) => {
          const ring = (inset, height) => {
            const a = w / 2 - inset, b = d / 2 - inset,
              c = Math.min(w, d) * .13;
            return [[-a+c,b], [a-c,b], [a,b-c], [a,-b+c],
              [a-c,-b], [-a+c,-b], [-a,-b+c], [-a,b-c]]
              .map(([px, pz]) => [x + px, height, z + pz]);
          };
          const rings = [ring(bevel, y-h/2), ring(0, y-h/2+bevel),
            ring(0, y+h/2-bevel), ring(bevel, y+h/2)];
          for (let i = 0; i < 8; i++) {
            const k = (i + 1) % 8;
            for (let j = 0; j < 3; j++) {
              const shade = col.map(v => v * (j === 0 ? .8 : j === 2 ? 1.12 : 1));
              this.tri(out, rings[j][i], rings[j][k], rings[j + 1][k], shade);
              this.tri(out, rings[j][i], rings[j + 1][k], rings[j + 1][i], shade);
            }
            this.tri(out, [x, y+h/2, z], rings[3][i], rings[3][k], col);
            this.tri(out, [x, y-h/2, z], rings[0][k], rings[0][i], dark);
          }
        };
        panel(0, .42, 0, 6.7, .38, 4.85, .1, dark);
        panel(0, 1.45, 0, 6.5, 2.6, 4.6, .22, metal);
        panel(0, 2.91, -.4, 5.65, .5, 4.2, .12, dark);
        panel(0, 3.25, -.5, 4.9, .35, 3.6, .10, metal);
        panel(0, 3.47, -.55, 4.25, .14, 2.9, .035, roof);
        for (const side of [-1, 1]) {
          panel(side * 3.4, 1.2, -.4, 1.15, 2.2, 3.7, .18, dark);
          for (let j = 0; j < 3; j++)
            panel(side * 3.43, 2.32, j * .95 - 1.35, 1.04, .24, .64, .06, metal);
          panel(side * 2.23, 1.36, 2.13, .72, 2.42, .96, .16, metal);
          panel(side * 2.23, 2.59, 2.12, .82, .22, 1.02, .06, roof);
        }
        panel(0, .22, 3.7, 2.45, .22, .55, .055, metal);
        return out;
      },
      // One reusable metal mesh: beveled deck, segmented apron and four retaining clamps.
      // Emissive rings and the animated crystal are drawn separately by renderEntity.
      aetherVent() {
        const out = [], box = this.box(), tau = Math.PI * 2,
          dark = [.16, .20, .24], metal = [.34, .40, .44], edge = [.48, .54, .55],
          deck = [.25, .30, .36];
        const point = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r * .9];
        const profile = (n, levels, colors) => {
          for (let i = 0; i < n; i++) {
            const a = (i + .5) / n * tau, b = (i + 1.5) / n * tau;
            for (let j = 0; j < levels.length - 1; j++) {
              const [r, y] = levels[j], [s, h] = levels[j + 1],
                p = point(r, y, a), q = point(r, y, b),
                u = point(s, h, a), v = point(s, h, b), col = colors[j];
              this.tri(out, p, q, v, col);
              this.tri(out, p, v, u, col);
            }
            const [r, y] = levels.at(-1);
            this.tri(out, [0, y, 0], point(r, y, a), point(r, y, b), colors.at(-1));
            const [br, by] = levels[0];
            this.tri(out, [0, by, 0], point(br, by, b), point(br, by, a), dark);
          }
        };
        const part = (a, r, y, w, h, d, col) => {
          const cs = Math.cos(a), sn = Math.sin(a);
          for (let i = 0; i < box.length; i += 27) {
            const points = [];
            for (let k = 0; k < 27; k += 9) {
              const x = box[i + k] * w, z = box[i + k + 2] * d + r;
              points.push([x * cs + z * sn, box[i + k + 1] * h + y, (-x * sn + z * cs) * .9]);
            }
            this.tri(out, ...points, col);
          }
        };
        profile(16, [[1.83, -.04], [1.95, .08], [1.95, .18], [1.78, .30]], [dark, metal, edge, metal]);
        profile(32, [[1.65, .22], [1.73, .34], [1.73, .44], [1.55, .48]], [dark, dark, metal, dark]);
        profile(8, [[1.48, .38], [1.57, .53], [1.57, .65], [1.36, .84]], [dark, dark, edge, deck]);
        // Recessed central plate and raised crystal socket.
        profile(8, [[1.10, .842], [1.03, .88]], [dark, metal]);
        profile(8, [[.48, .88], [.48, .94], [.36, .98]], [dark, edge, dark]);
        for (let i = 0; i < 16; i++) {
          const a = i / 16 * tau;
          part(a, 1.77, .26, .32, .13, .29, i % 2 ? metal : edge);
          part(a, 1.83, .332, .18, .014, .035, dark);
        }
        for (let i = 0; i < 4; i++) {
          const a = (i + .5) / 4 * tau;
          part(a, 1.66, .50, .29, .67, .28, dark);
          part(a, 1.72, .91, .20, .90, .20, metal);
          part(a, 1.69, 1.37, .24, .08, .24, edge);
          part(a, 1.49, .77, .32, .16, .40, edge);
          part(a, 1.18, .867, .08, .05, .08, edge);
        }
        return out;
      },
      // Continuous eroded boundary belt; all detail stays outside ±87, with private cosmetic RNG.
      mountainRing(seed) {
        // Resolve once: repeated global lookups are costly in the isolated Node test worlds.
        const { Math } = globalThis;
        const rand = seeded(seed ^ 0x4d524944), out = [], columns = [], perSide = 96,
          segments = perSide * 4, levels = 40,
          peaks = Array.from({ length: 20 }, (_, i) => ({
            angle: (i + rand() * .65) / 20 * Math.PI * 2 - Math.PI,
            height: 23 + rand() * 13, width: .095 + rand() * .055
          }));
        const hash = (x, z) => {
          let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ seed ^ 0x4d524944;
          h = Math.imul(h ^ (h >>> 13), 1274126177);
          return ((h ^ (h >>> 16)) >>> 0) / 4294967296 * 2 - 1;
        };
        const noise = (x, z) => {
          const ix = Math.floor(x), iz = Math.floor(z);
          let u = x - ix, v = z - iz;
          u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
          return (hash(ix, iz) * (1 - u) + hash(ix + 1, iz) * u) * (1 - v) +
            (hash(ix, iz + 1) * (1 - u) + hash(ix + 1, iz + 1) * u) * v;
        };
        const height = (x, z) => {
          const r = (Math.max(Math.abs(x), Math.abs(z)) - 87) / 36, angle = Math.atan2(z, x);
          let summit = 0;
          for (const p of peaks) {
            const d = Math.abs(angle - p.angle), distance = Math.min(d, Math.PI * 2 - d) / p.width;
            summit = Math.max(summit, p.height * Math.exp(-distance * distance));
          }
          summit += 11 + noise(x * .085, z * .085) * 3;
          const crest = .56 + noise(x * .025 + 80, z * .025 - 30) * .14,
            ridge = Math.exp(-(((r - crest) / .22) ** 2)),
            shoulder = Math.exp(-(((r - .27 - noise(x * .043, z * .043) * .045) / .17) ** 2)),
            rough = noise(x * .11, z * .11) * 3.2 + noise(x * .27, z * .27) * 1.4 +
              noise(x * .65, z * .65) * .5 + noise(x * 1.1, z * 1.1) * .2,
            gully = (.5 + .5 * Math.sin(angle * 43 + r * 7 + noise(x * .07, z * .07) * 3)) ** 8 * 3.5;
          let edge = Math.max(0, Math.min(1, r * 7, (1 - r) * 7));
          edge = edge * edge * (3 - 2 * edge);
          return -.25 - 7.75 * r ** 6 + edge * Math.max(0, summit * (.96 * ridge + .18 * shoulder) +
            rough - gully * (.3 + .7 * ridge));
        };
        const perimeter = t => {
          const side = Math.floor(t), u = (t - side) * 2 - 1;
          return [[u, -1], [1, u], [-u, 1], [-1, -u]][side];
        };
        const face = (a, b, c) => {
          const normal = V.norm(V.cross(V.sub(b, a), V.sub(c, a))),
            shade = .76 + Math.max(0, normal[1]) * .16 + (a[1] + b[1] + c[1]) / 600 +
              noise(a[0] * .17, a[2] * .17) * .09;
          this.tri(out, a, b, c, [shade, shade * .98, shade * .94], normal);
        };
        for (let i = 0; i < segments; i++) {
          // Keep corner columns exact: adjacent sides share vertices, including the ground-level foot.
          const p = perimeter((i + (i % perSide ? (rand() - .5) * .45 : 0)) / perSide), column = [];
          for (let j = 0; j <= levels; j++) {
            const r = j === 0 || j === levels ? j / levels : (j + (rand() - .5) * .45) / levels,
              radius = 87 + r * 36, x = p[0] * radius, z = p[1] * radius;
            column.push([x, j === 0 ? -.25 : j === levels ? -8 : height(x, z), z]);
          }
          columns.push(column);
        }
        for (let i = 0; i < segments; i++) {
          const next = (i + 1) % segments;
          for (let row = 0; row < levels; row++) {
            const a = columns[i][row], b = columns[next][row],
              c = columns[next][row + 1], d = columns[i][row + 1];
            if ((i + row) % 2) { face(a, b, d); face(b, c, d); }
            else { face(a, b, c); face(a, c, d); }
          }
        }
        // Embedded scree on the inner foothills, in the same mesh/charge as the belt.
        const rubble = this.rock(seed ^ 0x54414c55, 'boulder');
        for (let j = 0; j < 80; j++) {
          const p = perimeter(rand() * 4), radius = 90.5 + rand() * 8,
            x = p[0] * radius, z = p[1] * radius, size = .6 + rand() * 1.2,
            angle = rand() * Math.PI * 2, ca = Math.cos(angle), sa = Math.sin(angle);
          for (let i = 0; i < rubble.length; i += 27) {
            const points = [0, 9, 18].map(k => {
              const px = x + (rubble[i + k] * ca + rubble[i + k + 2] * sa) * size,
                pz = z + (-rubble[i + k] * sa + rubble[i + k + 2] * ca) * size;
              return [px, height(px, pz) - .35 + rubble[i + k + 1] * size * .7, pz];
            });
            face(...points);
          }
        }
        return out;
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
      // A continuous, eroded heightfield on the exact CPU collision outline, plus embedded talus.
      massif(m) {
        const rand = seeded(m.seed), out = [], n = m.outline.length, levels = 40,
          cs = Math.cos(m.yaw), sn = Math.sin(m.yaw), phase = rand() * Math.PI * 2,
          peaks = [-.48, -.15, .2, .5].map((x, i) => ({
            x: x + (rand() - .5) * .09, z: Math.sin(x * 6 + phase) * .13,
            h: [.67, 1, .86, .59][i], sx: .24 + rand() * .08, sz: .25 + rand() * .1
          }));
        const hash = (x, z) => {
          let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ m.seed;
          h = Math.imul(h ^ (h >>> 13), 1274126177);
          return ((h ^ (h >>> 16)) >>> 0) / 4294967296 * 2 - 1;
        };
        const noise = (x, z) => {
          const ix = Math.floor(x), iz = Math.floor(z);
          let u = x - ix, v = z - iz;
          u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
          return (hash(ix, iz) * (1 - u) + hash(ix + 1, iz) * u) * (1 - v) +
            (hash(ix, iz + 1) * (1 - u) + hash(ix + 1, iz + 1) * u) * v;
        };
        const height = (x, z, r) => {
          const u = ((x - m.x) * cs - (z - m.z) * sn) / m.width,
            v = ((x - m.x) * sn + (z - m.z) * cs) / m.depth,
            ridge = Math.max(...peaks.map(p => p.h * Math.exp(-(((u - p.x) / p.sx) ** 2 + ((v - p.z) / p.sz) ** 2)))),
            rough = noise(u * 4, v * 4) * .12 + noise(u * 11, v * 11) * .055 +
              noise(u * 27, v * 27) * .023 + noise(u * 65, v * 65) * .009,
            gully = Math.pow(.5 + .5 * Math.sin(Math.atan2(v, u) * 17 + r * 8 + rough * 24), 8) * .055 * (1 - r);
          let edge = Math.min(1, (1 - r) * 6);
          edge = edge * edge * (3 - 2 * edge);
          return -.14 + Math.max(0, .13 * (1 - r) + ridge * .92 + rough * (.3 + ridge) - gully) * edge * m.height;
        };
        const face = (a, b, c) => {
          const normal = V.norm(V.cross(V.sub(b, a), V.sub(c, a))),
            h = (a[1] + b[1] + c[1]) / (3 * m.height),
            shade = .76 + Math.max(0, normal[1]) * .16 + h * .2 + noise(a[0] * .17, a[2] * .17) * .09;
          this.tri(out, a, b, c, [shade, shade * .98, shade * .94], normal);
        };
        let previous = null;
        const center = [m.x, height(m.x, m.z, 0), m.z];
        for (let level = 1; level <= levels; level++) {
          const ring = m.outline.map((p, i) => {
            const r = level === levels ? 1 : (level + hash(i, level) * .24) / levels,
              x = m.x + (p.x - m.x) * r, z = m.z + (p.z - m.z) * r;
            return level === levels ? [p.x, -.14, p.z] : [x, height(x, z, r), z];
          });
          for (let i = 0; i < n; i++) {
            const next = (i + 1) % n;
            if (previous) {
              face(previous[i], ring[next], ring[i]);
              face(previous[i], previous[next], ring[next]);
            } else face(center, ring[next], ring[i]);
            if (level === levels) this.tri(out, [m.x, -.14, m.z], ring[i], ring[next], [.75, .73, .7]);
          }
          previous = ring;
        }
        const rubble = this.rock(m.seed ^ 0x524f434b, 'boulder');
        for (let j = 0; j < 56; j++) {
          const edge = m.outline[Math.floor(rand() * n)], r = .62 + rand() * .31,
            x = m.x + (edge.x - m.x) * r, z = m.z + (edge.z - m.z) * r,
            y = height(x, z, r) - .15, size = Math.min(.3 + rand() * .9, (1 - r) * m.depth * .4),
            angle = rand() * 6.28, ca = Math.cos(angle), sa = Math.sin(angle);
          for (let i = 0; i < rubble.length; i += 27) {
            const points = [0, 9, 18].map(k => [
              x + (rubble[i + k] * ca + rubble[i + k + 2] * sa) * size,
              y + rubble[i + k + 1] * size * .7,
              z + (-rubble[i + k] * sa + rubble[i + k + 2] * ca) * size
            ]);
            this.tri(out, ...points, [.95, .93, .89]);
          }
        }
        return out;
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
