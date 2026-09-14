/* Fractured Desert landforms. All meshes are baked at world load with private RNGs;
 * their solid envelope stays inside the existing CPU footprint. */
'use strict';
(() => {
  type Point = number[];
  type Face = Point[];
  // Clip a convex stone by geological fracture planes. Polygon faces remain planar:
  // triangulating them must not create the alternating light/dark wedges of a radial heightfield.
  function stone(seed: number, sides = 8, bevel = true): Face[] {
    const rand = seeded(seed), phase = rand() * 6.28;
    const bottom = Array.from({ length: sides }, (_, i) => {
      const a = (i + (rand() - .5) * .22) * Math.PI * 2 / sides;
      return [Math.cos(a), -.06, Math.sin(a)];
    }), top = bottom.map(p => [p[0], 1.2, p[2]]);
    let faces: Face[] = [bottom, [...top].reverse()];
    for (let i = 0; i < sides; i++) faces.push([bottom[i], top[i], top[(i + 1) % sides], bottom[(i + 1) % sides]]);
    const cut = (n: Point, d: number) => {
      const next: Face[] = [], rim: Point[] = [];
      for (const face of faces) {
        const polygon: Point[] = [];
        for (let i = 0; i < face.length; i++) {
          const a = face[i], b = face[(i + 1) % face.length], da = V.dot(n, a) - d, db = V.dot(n, b) - d;
          if (da <= 0) polygon.push(a);
          if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
            const p = a.map((v, k) => v + (b[k] - v) * da / (da - db));
            polygon.push(p);
            if (!rim.some(q => Math.hypot(...V.sub(p, q)) < 1e-8)) rim.push(p);
          }
        }
        if (polygon.length >= 3) next.push(polygon);
      }
      if (rim.length >= 3) {
        const center = rim.reduce((a, p) => a.map((v, k) => v + p[k] / rim.length), [0, 0, 0]),
          u = V.norm(V.cross(Math.abs(n[1]) > .9 ? [1, 0, 0] : [0, 1, 0], n)), v = V.cross(n, u);
        rim.sort((a, b) => Math.atan2(V.dot(V.sub(a, center), v), V.dot(V.sub(a, center), u)) -
          Math.atan2(V.dot(V.sub(b, center), v), V.dot(V.sub(b, center), u)));
        next.push(rim);
      }
      faces = next;
    };
    if (bevel) for (let i = 0; i < sides; i++) {
      const a = i * Math.PI * 2 / sides + phase;
      cut([Math.cos(a), .08 + .30 * Math.cos(a + phase), Math.sin(a)], .90 + rand() * .09);
      cut([Math.cos(a), .65 + rand() * .25, Math.sin(a)], 1.19 + rand() * .17);
    }
    for (let i = 0; i < 3; i++) {
      const a = phase + i * 2.1;
      cut([Math.cos(a) * .65, 1, Math.sin(a) * .65], .88 + rand() * .15);
    }
    return faces;
  }
  function append(out: number[], faces: Face[], x: number, y: number, z: number,
    sx: number, sy: number, sz: number, yaw: number, shade = 1) {
    const ca = Math.cos(yaw), sa = Math.sin(yaw);
    for (const face of faces) {
      const points = face.map(p => [x + p[0] * sx * ca + p[2] * sz * sa,
        y + p[1] * sy, z - p[0] * sx * sa + p[2] * sz * ca]);
      // Constant per fracture face; depth tint is baked contact shading, not a new light pass.
      const tint = shade * (.87 + .13 * Math.min(1, Math.max(0, face.reduce((s, p) => s + p[1], 0) / face.length)));
      for (let i = 1; i < points.length - 1; i++)
        geom.tri(out, points[0], points[i], points[i + 1], [tint, tint * .985, tint * .96]);
    }
  }
  // Offset courses create ledges and broken shoulders rather than a field of tall prisms.
  // Every course (including its offset) fits inside the original enclosing circle.
  function outcrop(out: number[], blocks: Face[][], index: number, x: number, z: number,
    radius: number, h: number, yaw: number, detailed = true) {
    const dx = Math.cos(yaw + 1.1), dz = Math.sin(yaw + 1.1);
    append(out, blocks[index % blocks.length], x, .08, z, radius, h * .48, radius * .91, yaw, 1.01);
    append(out, blocks[(index + 3) % blocks.length], x + dx * radius * .11, h * .29, z + dz * radius * .11,
      radius * .87, h * (detailed ? .47 : .72), radius * .83, yaw + .43, 1.03);
    if (!detailed) return;
    append(out, blocks[(index + 5) % blocks.length], x - dx * radius * .19, h * .61, z - dz * radius * .19,
      radius * .69, h * .40, radius * .64, yaw - .29, 1.04);
    for (const sign of [-1, 1]) append(out, blocks[(index + 1) % blocks.length],
      x + sign * dx * radius * .67, h * .13, z + sign * dz * radius * .67,
      radius * .31, h * .27, radius * .28, yaw + sign * .8, .98);
  }
  const boundaryDistance = (p: Position, outline: Position[]) =>
    Math.min(...outline.map((a, i) => pointSegment(p, a, outline[(i + 1) % outline.length])));

  TerrainModels.massif = (m: WorldTerrainFeature) => {
    const rand = seeded(m.seed ^ 0x42524543), out: number[] = [], ca = Math.cos(m.yaw), sa = Math.sin(m.yaw),
      worldPoint = (u: number, v: number) => ({ x: m.x + u * ca + v * sa, z: m.z - u * sa + v * ca }),
      blocks = Array.from({ length: 9 }, (_, i) => stone(m.seed ^ (i * 3917 + 31))),
      rubble = Array.from({ length: 5 }, (_, i) => stone(m.seed ^ (i * 173 + 43), 5, false));
    // Low, continuous talus foundation follows every original outline vertex exactly.
    // The large silhouette comes from intersecting fracture volumes, not from this apron.
    const footHeight = (r: number) => -.14 + Math.min(1, (1 - r) * 5) * (.45 + (1 - r) * 1.1);
    let previous: Point[] | null = null;
    for (let row = 1; row <= 8; row++) {
      const r = row / 8, ring = m.outline.map(p => row === 8 ? [p.x, -.14, p.z] :
        [m.x + (p.x - m.x) * r, footHeight(r), m.z + (p.z - m.z) * r]);
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length, tint = [.95, .93, .90];
        if (previous) {
          geom.tri(out, previous[i], ring[j], ring[i], tint);
          geom.tri(out, previous[i], previous[j], ring[j], tint);
        } else geom.tri(out, [m.x, footHeight(0), m.z], ring[j], ring[i], tint);
        if (row === 8) geom.tri(out, [m.x, -.14, m.z], ring[i], ring[j], tint);
      }
      previous = ring;
    }
    // Staggered buttresses, asymmetric crest and overlapping lower shoulders.
    for (let row = -2; row <= 2; row++) for (let col = -4; col <= 4; col++) {
      const u = (col * .175 + (rand() - .5) * .16 + (row % 2) * .045) * m.width,
        v = (row * .25 + (rand() - .5) * .18) * m.depth,
        p = worldPoint(u, v);
      if (!insidePolygon(p, m.outline)) continue;
      const clearance = boundaryDistance(p, m.outline),
        radius = Math.min(clearance * .96, (4.4 + rand() * 2.9)),
        ridge = Math.exp(-(((u / m.width + .10) / .66) ** 2 + (v / m.depth / .56) ** 2)),
        h = Math.min(m.height, (3.3 + m.height * ridge * (.50 + rand() * .48))) * Math.min(1, clearance / 4);
      outcrop(out, blocks, col + 4 + (row + 2) * 3, p.x, p.z,
        radius, h, m.yaw + (rand() - .5) * 1.4);
    }
    // Embedded broken slabs bridge the cliffs to the exact, low collision perimeter.
    for (let i = 0; i < 240; i++) {
      const edge = m.outline[Math.floor(rand() * m.outline.length)], r = .64 + rand() * .34,
        p = { x: m.x + (edge.x - m.x) * r, z: m.z + (edge.z - m.z) * r },
        size = Math.min(boundaryDistance(p, m.outline) * .85, .35 + rand() * 1.3);
      append(out, rubble[i % rubble.length], p.x, footHeight(r) - .015, p.z,
        size, .15 + size * (.20 + rand() * .38), size * .68, rand() * 6.28, .95 + rand() * .12);
    }
    return out;
  };

  TerrainModels.mountainRing = (seed: number, extent: number) => {
    const rand = seeded(seed ^ 0x42454c54), out: number[] = [], inner = extent - 3,
      blocks = Array.from({ length: 8 }, (_, i) => stone(seed ^ (i * 173 + 63))),
      rubble = stone(seed ^ 0x54414c55, 5, false), columns: Point[][] = [], perSide = 24;
    const perimeter = (t: number) => {
      const side = Math.floor(t), u = (t - side) * 2 - 1;
      return [[u, -1], [1, u], [-u, 1], [-1, -u]][side];
    };
    for (let i = 0; i < perSide * 4; i++) {
      const p = perimeter(i / perSide);
      columns.push([[inner, -.25], [inner + 5, 1.1], [inner + 25, .7], [inner + 36, -8]]
        .map(([r, y]) => [p[0] * r, y, p[1] * r]));
    }
    for (let i = 0; i < columns.length; i++) for (let row = 0; row < 3; row++) {
      const a = columns[i][row], b = columns[(i + 1) % columns.length][row],
        c = columns[(i + 1) % columns.length][row + 1], d = columns[i][row + 1];
      geom.tri(out, a, b, c, [.95, .93, .90]); geom.tri(out, a, c, d, [.95, .93, .90]);
    }
    for (let side = 0; side < 4; side++) for (let i = 0; i < 24; i++) {
      const along = (i + .5) / 24 * inner * 2 - inner;
      for (let row = 0; row < 2; row++) {
        const radius = 5.5 + rand() * 3.7, across = inner + (row ? 23 : 10),
          x = side < 2 ? (side ? across : -across) : along,
          z = side >= 2 ? (side === 2 ? across : -across) : along,
          h = (row ? 23 : 12) + rand() * 15;
        outcrop(out, blocks, i + side + row * 3, x, z, radius, h, rand() * 6.28, false);
      }
      for (let j = 0; j < 5; j++) {
        const across = inner + 1.5 + rand() * 6, size = .45 + rand() * 1.0,
          x = side < 2 ? (side ? across : -across) : along + (rand() - .5) * 7,
          z = side >= 2 ? (side === 2 ? across : -across) : along + (rand() - .5) * 7;
        append(out, rubble, x, .15, z, size, size * .5, size * .7, rand() * 6.28);
      }
    }
    for (const x of [-1, 1]) for (const z of [-1, 1])
      outcrop(out, blocks, 0, x * (inner + 18), z * (inner + 18), 14, 37, rand() * 6.28, false);
    return out;
  };
  TerrainModels.desertTalus = (seed: number) => {
    const out: number[] = [];
    append(out, stone(seed, 5, false), 0, 0, 0, 1, 1, .8, 0);
    return out;
  };
  TerrainModels.desertFlake = (seed: number) => {
    const out: number[] = [];
    append(out, stone(seed ^ 0x534c4142, 6, false), 0, 0, 0, 1, 1, .58, .3);
    return out;
  };
})();
