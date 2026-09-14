/* Desert relief is sampled by the CPU recipe. Draw exactly those heights, without
 * rerunning world generation or introducing a second, approximate collision shape. */
'use strict';
(() => {
  TerrainModels.desertRelief = (surface: WorldRelief) => {
    const { size, step, extent, heights, innerExtent } = surface;
    const visible = (x: number, z: number) => {
      const wx = -extent + (x - 1) * step, wz = -extent + (z - 1) * step;
      if (innerExtent && wx >= -innerExtent && wz >= -innerExtent && wx + step <= innerExtent && wz + step <= innerExtent) return false;
      const i = z * size + x;
      return Math.max(heights[i], heights[i + 1], heights[i + size], heights[i + size + 1]) > -.135;
    };
    let cells = 0;
    for (let z = 1; z < size - 2; z++) for (let x = 1; x < size - 2; x++) if (visible(x, z)) cells++;
    const vertices = new Float32Array(size * size * 9), out = new Float32Array(cells * 54);
    for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
      const i = z * size + x, h = heights[i],
        left = heights[z * size + Math.max(0, x - 1)], right = heights[z * size + Math.min(size - 1, x + 1)],
        back = heights[Math.max(0, z - 1) * size + x], front = heights[Math.min(size - 1, z + 1) * size + x],
        nx = left - right, ny = step * 2, nz = back - front, length = Math.hypot(nx, ny, nz),
        cavity = Math.max(0, Math.min(.15, (left + right + back + front - h * 4) * .045)),
        tint = .96 + Math.min(.10, Math.max(0, h) * .003) - cavity, offset = i * 9;
      vertices.set([-extent + (x - 1) * step, h, -extent + (z - 1) * step, nx / length, ny / length, nz / length,
        tint, tint * .985, tint * .96], offset);
    }
    let offset = 0;
    for (let z = 1; z < size - 2; z++) for (let x = 1; x < size - 2; x++) {
      if (!visible(x, z)) continue;
      const a = z * size + x, b = a + 1, c = a + size + 1, d = a + size;
      // Alternate diagonals in a Cartesian mesh: no star-shaped rings, poles or radial folds.
      const order = (x + z) % 2 ? [a, d, b, b, d, c] : [a, d, c, a, c, b];
      for (const i of order) { out.set(vertices.subarray(i * 9, i * 9 + 9), offset); offset += 9; }
    }
    return out;
  };

  // Retain the positively reviewed broken ground stones. These are genuinely closed
  // clipped solids; larger instances can be embedded in the new relief.
  type Point = number[];
  type Face = Point[];
  function stone(seed: number, sides: number): Face[] {
    const rand = seeded(seed), phase = rand() * 6.28;
    const bottom = Array.from({ length: sides }, (_, i) => {
      const a = (i + (rand() - .5) * .22) * Math.PI * 2 / sides;
      return [Math.cos(a), -.06, Math.sin(a)];
    }), top = bottom.map(p => [p[0], 1.2, p[2]]);
    let faces: Face[] = [bottom, [...top].reverse()];
    for (let i = 0; i < sides; i++) faces.push([bottom[i], top[i], top[(i + 1) % sides], bottom[(i + 1) % sides]]);
    for (let plane = 0; plane < 3; plane++) {
      const angle = phase + plane * 2.1, n = [Math.cos(angle) * .65, 1, Math.sin(angle) * .65], d = .88 + rand() * .15,
        next: Face[] = [], rim: Point[] = [];
      for (const face of faces) {
        const polygon: Point[] = [];
        for (let i = 0; i < face.length; i++) {
          const a = face[i], b = face[(i + 1) % face.length], da = V.dot(n, a) - d, db = V.dot(n, b) - d;
          if (da <= 0) polygon.push(a);
          if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
            const p = a.map((v, k) => v + (b[k] - v) * da / (da - db)); polygon.push(p);
            if (!rim.some(q => Math.hypot(...V.sub(p, q)) < 1e-8)) rim.push(p);
          }
        }
        if (polygon.length >= 3) next.push(polygon);
      }
      if (rim.length >= 3) {
        const center = rim.reduce((a, p) => a.map((v, k) => v + p[k] / rim.length), [0, 0, 0]),
          u = V.norm(V.cross([1, 0, 0], n)), v = V.cross(n, u);
        rim.sort((a, b) => Math.atan2(V.dot(V.sub(a, center), v), V.dot(V.sub(a, center), u)) -
          Math.atan2(V.dot(V.sub(b, center), v), V.dot(V.sub(b, center), u)));
        next.push(rim);
      }
      faces = next;
    }
    return faces;
  }
  function fragment(seed: number, sides: number, depth: number, yaw: number) {
    const out: number[] = [], ca = Math.cos(yaw), sa = Math.sin(yaw);
    for (const face of stone(seed, sides)) {
      const points = face.map(p => [p[0] * ca + p[2] * depth * sa, p[1], -p[0] * sa + p[2] * depth * ca]),
        tint = .87 + .13 * Math.min(1, Math.max(0, face.reduce((s, p) => s + p[1], 0) / face.length));
      for (let i = 1; i < points.length - 1; i++) geom.tri(out, points[0], points[i], points[i + 1], [tint, tint * .985, tint * .96]);
    }
    return out;
  }
  TerrainModels.desertTalus = (seed: number) => fragment(seed, 5, .8, 0);
  TerrainModels.desertFlake = (seed: number) => fragment(seed ^ 0x534c4142, 6, .58, .3);
})();
