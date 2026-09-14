/* Desert-only rock silhouettes. Baked once per world, with a private geometry RNG.
 * Shared geom.rock stays unchanged for resource pedestals and mountain scree. */
'use strict';
(() => {
  type Lobe = { x: number; z: number; sx: number; sz: number; h: number; yaw: number; sides: number; top: number };
  function rock(seed: number, lobes: Lobe[], low = false) {
    const out: number[] = [], rand = seeded(seed ^ 0x53544f4e);
    for (const l of lobes) {
      const n = l.sides, phase = rand() * Math.PI * 2,
        ca = Math.cos(l.yaw), sa = Math.sin(l.yaw),
        angles = Array.from({ length: n }, (_, i) => (i + (rand() - .5) * .24) * Math.PI * 2 / n),
        radii = angles.map(a => .87 + .08 * Math.sin(a * 3 + phase) + rand() * .05),
        // Broad buried foot, small weathered shoulder, broken sloping cap.
        profiles = low ? [[-.12,.90],[.32,1],[1,l.top]] : [[-.025,.92],[.12,1],[.57,.91],[.88,.76],[1,l.top]];
      const point = (a: number, radius: number, t: number, i: number) => {
        const lean = Math.max(0, t),
          px = Math.cos(a) * radius * radii[i] * l.sx + lean * l.sx * .16,
          pz = Math.sin(a) * radius * radii[i] * l.sz - lean * l.sz * .09,
          x = l.x + px * ca - pz * sa, z = l.z + px * sa + pz * ca,
          bound = Math.max(1, Math.hypot(x, z)),
          // Uneven roof edges, not a rotationally symmetric pole or cone.
          y = l.h * (t + lean * (.10 * Math.cos(a + phase) + .055 * Math.sin(a * 2 + phase)));
        return [x / bound, y, z / bound];
      };
      const rings = profiles.map(([t, r]) => angles.map((a, i) => point(a, r, t, i)));
      for (let row = 0; row < rings.length - 1; row++) for (let i = 0; i < n; i++) {
        const k = (i + 1) % n, a = rings[row][i], b = rings[row][k], c = rings[row + 1][k], d = rings[row + 1][i],
          shade = .93 + row * .012 + .025 * Math.sin(angles[i] * 2 + phase), tint = [shade, shade, shade];
        geom.tri(out, a, d, c, tint); geom.tri(out, a, c, b, tint);
      }
      // Closed, irregular caps; no floating satellite pieces outside the collider envelope.
      for (const [row, top] of [[0, false], [rings.length - 1, true]] as const) {
        const ring = rings[row], center = ring.reduce((sum, p) => sum.map((v, k) => v + p[k] / n), [0, 0, 0]);
        for (let i = 0; i < n; i++) {
          const k = (i + 1) % n;
          geom.tri(out, center, top ? ring[k] : ring[i], top ? ring[i] : ring[k], top ? [1, 1, 1] : [.86, .86, .86]);
        }
      }
    }
    // Smooth only shallow joins. Large fracture planes keep their hard silhouette/lighting edges.
    const normals = new Map<string, number[][]>();
    for (let i = 0; i < out.length; i += 9) {
      const key = out.slice(i, i + 3).map(v => v.toFixed(7)).join(','), list = normals.get(key) || [];
      list.push(out.slice(i + 3, i + 6)); normals.set(key, list);
    }
    for (let i = 0; i < out.length; i += 9) {
      const key = out.slice(i, i + 3).map(v => v.toFixed(7)).join(','), n = out.slice(i + 3, i + 6), sum = [0, 0, 0];
      for (const other of normals.get(key)!) if (V.dot(n, other) > .88)
        for (let k = 0; k < 3; k++) sum[k] += other[k];
      const normal = V.norm(sum);
      for (let k = 0; k < 3; k++) out[i + 3 + k] = normal[k];
    }
    return out;
  }
  TerrainModels.desertBoulder = (seed: number) => rock(seed, [
    { x: -.19, z: -.10, sx: .76, sz: .76, h: .60, yaw: .3, sides: 14, top: .61 },
    { x: .43, z: .03, sx: .49, sz: .63, h: .37, yaw: -.5, sides: 10, top: .68 },
    { x: -.17, z: .51, sx: .56, sz: .39, h: .23, yaw: .4, sides: 8, top: .72 }
  ]);
  TerrainModels.desertCrag = (seed: number) => rock(seed, [
    { x: -.17, z: -.17, sx: .65, sz: .69, h: .89, yaw: -.4, sides: 14, top: .33 },
    { x: .35, z: .12, sx: .58, sz: .65, h: .55, yaw: .6, sides: 10, top: .49 },
    { x: -.38, z: .43, sx: .42, sz: .47, h: .29, yaw: -.5, sides: 8, top: .70 }
  ]);
  TerrainModels.desertRidge = (seed: number) => rock(seed, [
    { x: -.35, z: -.03, sx: .58, sz: .70, h: .57, yaw: -.2, sides: 12, top: .53 },
    { x: .30, z: -.13, sx: .62, sz: .61, h: .44, yaw: .4, sides: 12, top: .60 },
    { x: .12, z: .52, sx: .58, sz: .33, h: .19, yaw: -.3, sides: 8, top: .80 }
  ]);
  TerrainModels.desertShelf = (seed: number) => rock(seed, [
    { x: -.04, z: .05, sx: .96, sz: .85, h: .15, yaw: .2, sides: 14, top: .85 },
    { x: -.16, z: -.18, sx: .70, sz: .60, h: .29, yaw: -.3, sides: 12, top: .71 }
  ], true);
  TerrainModels.desertPebble = (seed: number) => rock(seed, [
    { x: -.02, z: 0, sx: .54, sz: .49, h: .85, yaw: .3, sides: 7, top: .53 }
  ], true);
  TerrainModels.desertChip = (seed: number) => rock(seed, [
    { x: 0, z: 0, sx: .60, sz: .46, h: .52, yaw: -.2, sides: 7, top: .79 }
  ], true);
})();
