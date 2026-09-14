/* Desert is a connected canyon country, not isolated obstacles inside a square wall. */
'use strict';
const DESERT_BATTLEFIELD: BattlefieldDefinition = {
  name: 'DESERT',
  size: { extent: 90, cellSize: 2.5 },
  layout: standardBattleLayout(),
  palette: { ground: 0x59443a, rock: 0x74544a, accent: 0xf0b67b, flora: 0x806348 },
  render: {
    groundTexture: 'ground', skyTexture: 'sky', groundPixelsPerMeter: 22,
    rockSurface: { texture: 'desertRock', metersPerTile: 18 },
    rockDecor: { density: .55, opacity: .72 }, shrubDecor: { density: .08, opacity: .78 },
    haze: [0.11, 0.085, 0.1], terrainReceiverHeight: 46,
    lighting: { sun: [1.20, 1.00, .80], sky: [.27, .34, .43], bounce: [.15, .12, .09] }
  },
  worldEvent: null,
  generate(builder) {
    builder.ground();
    populateDesertCanyons(builder);
  }
};

// Each corner has a sheltered basin connected to the valley network. Resource and
// vent approaches are part of that network, not holes cut out of otherwise sealed cliffs.
function desertCanyonPlan(layout: BattlefieldLayout, seed: number) {
  const rand = seeded(seed ^ 0x43414e59), routes: Position[][] = [];
  // Circumscribed, uneven rock faces retain the entire circular building reserve.
  // Their own stream must not change canyon bends when the basin outline is refined.
  const rimRandom = seeded(seed ^ 0x42415349);
  const basins = layout.startSites.map(p => {
    const r = 28, phase = rimRandom() * Math.PI * 2,
      angles = Array.from({ length: 8 }, (_, i) => phase + i * Math.PI / 4 + (rimRandom() - .5) * .24),
      planes = angles.map(a => ({ x: Math.cos(a), z: Math.sin(a), offset: r + .35 + rimRandom() * 1.75 })),
      gap = Math.max(...angles.map((a, i) => (angles[(i + 1) % angles.length] + (i === angles.length - 1 ? Math.PI * 2 : 0)) - a)),
      bound = (Math.max(...planes.map(p => p.offset)) + 5) / Math.cos(gap / 2);
    return { ...p, r, planes, bound };
  });
  const sites: (Position & { r: number; planes?: (typeof basins)[number]['planes']; bound?: number })[] = [...basins,
    ...layout.resourceSites.map(p => ({ ...p, r: 10 })),
    ...layout.resourceSites.map((p, i) => ({ x: p.x + (i ? 7 : 5), z: p.z + (i ? 7 : 18), r: 7 })),
    { x: 0, z: 0, r: 9 }];
  for (const start of layout.startSites) {
    const length = Math.hypot(start.x, start.z), bend = (rand() < .5 ? -1 : 1) * (8 + rand() * 8);
    routes.push(Array.from({ length: 9 }, (_, i) => {
      const t = i / 8, shift = Math.sin(t * Math.PI) * bend;
      return { x: start.x * (1 - t) - start.z / length * shift, z: start.z * (1 - t) + start.x / length * shift };
    }));
  }
  // A tree of valleys is not enough: production buildings can seal its single
  // entrance. A winding flank loop gives each basin independent ways in and out.
  const corners = [layout.startSites[0], layout.startSites[2], layout.startSites[1], layout.startSites[3]];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i], b = corners[(i + 1) % corners.length], dx = b.x - a.x, dz = b.z - a.z,
      length = Math.hypot(dx, dz), bend = 5 + rand() * 5;
    routes.push(Array.from({ length: 9 }, (_, j) => {
      const t = j / 8, shift = -Math.sin(t * Math.PI) * bend;
      return { x: a.x + dx * t - dz / length * shift, z: a.z + dz * t + dx / length * shift };
    }));
  }
  const trunks = routes.flatMap(route => route.slice(1).map((b, i) => [route[i], b] as const));
  for (const [i, resource] of layout.resourceSites.entries()) {
    let nearest = { x: 0, z: 0 }, best = Infinity;
    for (const [a, b] of trunks) {
      const dx = b.x - a.x, dz = b.z - a.z,
        t = clamp(((resource.x - a.x) * dx + (resource.z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1),
        p = { x: a.x + dx * t, z: a.z + dz * t }, d = distance(p, resource);
      if (d < best) { best = d; nearest = p; }
    }
    routes.push([resource, nearest]);
    routes.push([resource, { x: resource.x + (i ? 7 : 5), z: resource.z + (i ? 7 : 18) }]);
  }
  const circleClearance = (s: Position & { r: number }, x: number, z: number) => Math.hypot(x - s.x, z - s.z) - s.r;
  const siteClearance = (s: typeof sites[number], x: number, z: number) => {
    if (!s.planes) return circleClearance(s, x, z);
    let clearance = -Infinity;
    for (const plane of s.planes) clearance = Math.max(clearance, (x - s.x) * plane.x + (z - s.z) * plane.z - plane.offset);
    return clearance;
  };
  return { sites, routes, halfWidth: 8.5, siteClearance, circleClearance };
}

function desertElevation(seed: number, extent: number, plan: ReturnType<typeof desertCanyonPlan>) {
  const { Math } = globalThis;
  const hash = (x: number, z: number) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 2147483648 - 1;
  };
  const noise = (x: number, z: number) => {
    const ix = Math.floor(x), iz = Math.floor(z);
    let u = x - ix, v = z - iz; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    return (hash(ix, iz) * (1 - u) + hash(ix + 1, iz) * u) * (1 - v) +
      (hash(ix, iz + 1) * (1 - u) + hash(ix + 1, iz + 1) * u) * v;
  };
  const smooth = (a: number, b: number, value: number) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a))); return t * t * (3 - 2 * t);
  };
  const segments = plan.routes.flatMap(route => route.slice(1).map((b, i) => {
    const a = route[i], dx = b.x - a.x, dz = b.z - a.z, margin = plan.halfWidth + 5;
    return { a, dx, dz, length2: dx * dx + dz * dz || 1,
      left: Math.min(a.x, b.x) - margin, right: Math.max(a.x, b.x) + margin,
      top: Math.min(a.z, b.z) - margin, bottom: Math.max(a.z, b.z) + margin };
  }));
  return (x: number, z: number) => {
    let clearance = 5;
    if (Math.max(Math.abs(x), Math.abs(z)) < extent + 22) {
      for (const s of plan.sites) {
        const bound = s.bound ?? s.r + 5;
        if (Math.abs(x - s.x) < bound && Math.abs(z - s.z) < bound)
          clearance = Math.min(clearance, plan.siteClearance(s, x, z));
      }
      if (clearance <= 0) return -.14;
      for (const s of segments) {
        if (x < s.left || x > s.right || z < s.top || z > s.bottom) continue;
        const t = Math.max(0, Math.min(1, ((x - s.a.x) * s.dx + (z - s.a.z) * s.dz) / s.length2));
        clearance = Math.min(clearance, Math.hypot(x - s.a.x - t * s.dx, z - s.a.z - t * s.dz) - plan.halfWidth);
      }
      if (clearance <= 0) return -.14;
    }
    // Warped drainage/strata fields produce branching ridges and irregular openings.
    // Circular, lobed outskirts swallow the technical corners without a wall at +/-extent.
    const warp = noise(x * .023 + 71, z * .023 - 39), u = x + warp * 9, v = z + noise(x * .025, z * .025) * 7,
      angle = Math.atan2(z, x), rim = extent * (.93 + .065 * Math.sin(angle * 3 + seed % 7) + .04 * Math.cos(angle * 5)),
      border = smooth(rim - 17, rim + 16, Math.hypot(x, z)),
      geology = .37 + noise(u * .048 + 17, v * .048 - 31) * .72 + noise(u * .095 + 9, v * .095) * .30,
      support = Math.max(border, smooth(.10, .63, geology)),
      spine = .5 + .5 * Math.sin(u * .068 + v * .028 + warp * 2.6);
    if (support < .002) return -.14;
    let height = Math.pow(support, .95) * (8 + 17 * spine + border * 12 + noise(u * .067, v * .067) * 4);
    // Eroded shelves and narrow gullies, not stacks of identical polygonal blocks.
    const stratum = height / 2.8, fraction = stratum - Math.floor(stratum);
    height += (smooth(.20, .79, fraction) - fraction) * 1.6;
    const fissure = Math.abs(Math.sin(x * .31 + z * .17 + noise(x * .12, z * .12) * 2.8));
    height += support * (noise(x * .38, z * .38) * .85 + noise(x * .83, z * .83) * .22 - Math.exp(-fissure * 14) * 1.65);
    return -.14 + Math.max(0, Math.min(45, height)) * Math.pow(smooth(0, 4.5, clearance), .72);
  };
}

// Interpolate the very same alternating triangles drawn by desertRelief, not the
// analytic noise field: sub-grid noise peaks would leave small stones floating.
function desertReliefHeight(surface: WorldRelief, x: number, z: number) {
  const gx = (x + surface.extent) / surface.step + 1, gz = (z + surface.extent) / surface.step + 1,
    col = Math.floor(gx), row = Math.floor(gz), u = gx - col, v = gz - row,
    i = row * surface.size + col, h = surface.heights,
    a = h[i], b = h[i + 1], c = h[i + surface.size + 1], d = h[i + surface.size];
  if ((col + row) % 2) return u + v <= 1 ? a + (b - a) * u + (d - a) * v :
    c + (d - c) * (1 - u) + (b - c) * (1 - v);
  return v >= u ? a + (c - d) * u + (d - a) * v : a + (b - a) * u + (c - b) * v;
}

function populateDesertCanyons(builder: BattlefieldBuilder) {
  const { world, palette, place } = builder, extent = world.extent,
    plan = desertCanyonPlan(world.layout, world.seed), elevation = desertElevation(world.seed, extent, plan),
    proposalElevation = desertElevation(world.seed, extent, { ...plan, siteClearance: plan.circleClearance }),
    decor = builder.cosmeticRandom(0x53435245), rocks = seeded(world.seed ^ 0x524f434b);
  // Corridors are seed-specific, instance-local terrain data; never mutate the map definition.
  world.layout = { ...world.layout, corridors: plan.routes.map(route => route.map(p => [p.x, p.z])) };
  const surface = (radius: number, innerExtent: number): WorldRelief => {
    const step = .75, size = Math.round(radius * 2 / step) + 3, heights = new Float32Array(size * size);
    for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
      const x = -radius + (col - 1) * step, z = -radius + (row - 1) * step;
      heights[row * size + col] = innerExtent && Math.max(Math.abs(x), Math.abs(z)) < innerExtent - step * 2 ? -.14 : proposalElevation(x, z);
    }
    return { extent: radius, step, size, heights, innerExtent };
  };
  // Stone proposals use the round reserve before rim shaping. Otherwise a locally
  // rejected stone would shift conditional RNG draws and relocate rocks map-wide.
  // Only the refined samples below are published for drawing and collision.
  const refine = (s: WorldRelief): WorldRelief => {
    const heights = s.heights.slice();
    for (const basin of plan.sites) {
      const bound = basin.bound;
      if (bound === undefined) continue;
      const first = (v: number) => Math.max(0, Math.floor((v - bound + s.extent) / s.step) + 1),
        last = (v: number) => Math.min(s.size - 1, Math.ceil((v + bound + s.extent) / s.step) + 1),
        left = first(basin.x), right = last(basin.x), top = first(basin.z), bottom = last(basin.z);
      for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
        const x = -s.extent + (col - 1) * s.step, z = -s.extent + (row - 1) * s.step;
        if (s.innerExtent && Math.max(Math.abs(x), Math.abs(z)) < s.innerExtent - s.step * 2) continue;
        heights[row * s.size + col] = elevation(x, z);
      }
    }
    return { ...s, heights };
  };
  // Cover extreme in-game pan/zoom on wide displays, not only a narrow edge strip.
  const proposalInterior = surface(extent, 0), proposalExterior = surface(extent + 150, extent),
    interior = refine(proposalInterior), exterior = refine(proposalExterior),
    heightAt = (x: number, z: number) => desertReliefHeight(Math.max(Math.abs(x), Math.abs(z)) <= extent ? interior : exterior, x, z),
    proposalHeightAt = (x: number, z: number) => desertReliefHeight(Math.max(Math.abs(x), Math.abs(z)) <= extent ? proposalInterior : proposalExterior, x, z);
  for (const [mesh, relief] of [['desertInterior', interior], ['desertExterior', exterior]] as const) {
    world.renderData.geometries.push({ mesh, model: 'desertRelief', relief });
    place(mesh, 0, 0, 0, 1, 1, 1, palette.rock, 0, 0, 0, 0, 1, 'static', 'MASSIF');
  }
  // Conservatively rasterize the tiles touching each raised sample. A small circle
  // can miss the containing navigation cell at its corners; marking entire touched
  // cells covers triangle interiors too. The minimap uses this same relief mask.
  for (let row = 1; row < interior.size - 1; row++) for (let col = 1; col < interior.size - 1; col++) {
    if (interior.heights[row * interior.size + col] <= .18) continue;
    const x = -extent + (col - 1) * interior.step, z = -extent + (row - 1) * interior.step,
      a = world.idx(x - interior.step, z - interior.step), b = world.idx(x + interior.step, z + interior.step), n = world.gridSize;
    for (let rz = Math.floor(a / n); rz <= Math.floor(b / n); rz++) for (let cx = a % n; cx <= b % n; cx++)
      world.terrainFeatureGrid[rz * n + cx] = 1;
  }
  world.staticGrid.set(world.terrainFeatureGrid);
  const meshes = ['desertBoulder', 'desertCrag', 'desertRidge', 'desertShelf', 'desertTalus', 'desertFlake', 'desertPebble', 'desertChip'];
  for (const [i, model] of meshes.entries())
    world.renderData.geometries.push({ mesh: model, model, seed: world.seed ^ (0x524f434b + i), extent });
  const clear = (p: Position, margin: number, siteClearance = plan.siteClearance) => plan.sites.every(s => siteClearance(s, p.x, p.z) >= margin) &&
    plan.routes.every(route => route.slice(1).every((b, i) => pointSegment(p, route[i], b) >= plan.halfWidth + margin));
  // Distributed spurs and detached boulders at different scales, rooted in the relief.
  for (let z = -extent + 4; z < extent - 4; z += 5) for (let x = -extent + 4; x < extent - 4; x += 5) {
    const p = { x: x + rocks() * 4, z: z + rocks() * 4 }, h = heightAt(p.x, p.z), r = .85 + rocks() * 1.55;
    if (!clear(p, r + .6, plan.circleClearance) || rocks() > .57 || proposalHeightAt(p.x, p.z) > 15) continue;
    const base = Math.min(h, heightAt(p.x + r, p.z), heightAt(p.x - r, p.z), heightAt(p.x, p.z + r), heightAt(p.x, p.z - r));
    const type = meshes[Math.floor(rocks() * 4)], height = 1.2 + r * rocks() * 2, yaw = rocks() * 6.28;
    if (!clear(p, r + .6)) continue; // Consume the complete proposal before excluding the widened basin.
    place(type, p.x, base - .08, p.z, r, height, r * .86, palette.rock, yaw, 0, 0, 0, 1, 'static', 'ROCK');
    world.mark(world.staticGrid, p.x, p.z, r); world.rocks.push({ ...p, r });
  }
  // Keep the approved stone vocabulary, with prominent embedded slabs and lower,
  // traversable scatter in the valleys. Decoration never consumes the solid-rock RNG.
  const embeddedFoot = (x: number, z: number, r: number) => {
    const a = world.idx(x - r, z - r), b = world.idx(x + r, z + r), n = world.gridSize;
    for (let row = Math.floor(a / n); row <= Math.floor(b / n); row++) for (let col = a % n; col <= b % n; col++)
      if (!world.staticGrid[row * n + col]) return false;
    return true;
  };
  for (let i = 0; i < 9000; i++) {
    const x = (decor() - .5) * (extent * 2 + 36), z = (decor() - .5) * (extent * 2 + 36), p = { x, z },
      h = heightAt(x, z), near = Math.max(h, heightAt(x + 3, z), heightAt(x - 3, z), heightAt(x, z + 3), heightAt(x, z - 3));
    const valley = !clear(p, .5);
    if (h > 24 || (valley && (h > .4 || decor() > .24 || plan.sites.some(s => distance(p, s) < s.r * .55))) ||
      (!valley && near < .3 && decor() > .16)) continue;
    const size = .18 + decor() ** 2 * (h > .4 ? 1.8 : .85), tall = h > .4 && embeddedFoot(x, z, size),
      base = Math.min(h, heightAt(x + size, z), heightAt(x - size, z), heightAt(x, z + size), heightAt(x, z - size)),
      height = tall ? .24 + size * .70 : .07 + decor() * .16;
    const mesh = size < .45 ? (i % 2 ? 'desertPebble' : 'desertChip') : (i % 4 ? 'desertTalus' : 'desertFlake');
    place(mesh, x, base - .025, z, size, height, size * (.65 + decor() * .25),
      builder.color(palette.rock).map(v => v * (.92 + decor() * .18)), decor() * 6.28, 0, 0, 0, 1, 'static', 'ROCK');
  }
}
