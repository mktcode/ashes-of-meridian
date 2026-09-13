/* CPU mesh factories dispatched by world descriptors, independent of map IDs. */
'use strict';
const TerrainModels = {
      // Continuous eroded boundary belt, three metres inside the world edge; private cosmetic RNG.
      mountainRing(seed, extent) {
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
        const innerEdge = extent - 3;
        const height = (x, z) => {
          const r = (Math.max(Math.abs(x), Math.abs(z)) - innerEdge) / 36, angle = Math.atan2(z, x);
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
          geom.tri(out, a, b, c, [shade, shade * .98, shade * .94], normal);
        };
        for (let i = 0; i < segments; i++) {
          // Keep corner columns exact: adjacent sides share vertices, including the ground-level foot.
          const p = perimeter((i + (i % perSide ? (rand() - .5) * .45 : 0)) / perSide), column = [];
          for (let j = 0; j <= levels; j++) {
            const r = j === 0 || j === levels ? j / levels : (j + (rand() - .5) * .45) / levels,
              radius = innerEdge + r * 36, x = p[0] * radius, z = p[1] * radius;
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
        const rubble = geom.rock(seed ^ 0x54414c55, 'boulder');
        for (let j = 0; j < 80; j++) {
          const p = perimeter(rand() * 4), radius = extent + .5 + rand() * 8,
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
          geom.tri(out, a, b, c, [shade, shade * .98, shade * .94], normal);
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
            if (level === levels) geom.tri(out, [m.x, -.14, m.z], ring[i], ring[next], [.75, .73, .7]);
          }
          previous = ring;
        }
        const rubble = geom.rock(m.seed ^ 0x524f434b, 'boulder');
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
            geom.tri(out, ...points, [.95, .93, .89]);
          }
        }
        return out;
      },
};
TerrainModels.geometry = descriptor => {
  const factory = Object.hasOwn(TerrainModels, descriptor.model) && TerrainModels[descriptor.model];
  if (typeof factory !== 'function' || descriptor.model === 'geometry')
    throw new Error('Unknown terrain model: ' + descriptor.model);
  return 'feature' in descriptor ? factory(descriptor.feature) : factory(descriptor.seed, descriptor.extent);
};
