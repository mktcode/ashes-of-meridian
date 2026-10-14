'use strict';
// Standalone topology and per-grid-cell height offsets.
// Extracted from aom-map-generator 77cf9b9; no terrain generation or browser state.
const SIZE = 300,
  PIXELS = 900,
  ROAD_RADIUS = 7,
  HEX_RADIUS = 145;
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function shapeRegion(region, random) {
  const rotation = random() * Math.PI * 2,
    stretch = 1 + random() * 0.16,
    phase2 = random() * Math.PI * 2,
    phase3 = random() * Math.PI * 2,
    amplitude2 = 0.05 + random() * 0.05,
    amplitude3 = 0.015 + random() * 0.015;
  // Smooth radial variation instead of six corner anchors. For r(theta),
  // r >= .87 and r'' <= .67, so r² + 2r'² - r*r'' stays positive.
  // The subsequent ellipse transform preserves convexity and road access.
  const local = Array.from({ length: 32 }, (_, i) => {
    const angle = (i * Math.PI * 2) / 32,
      radius =
        region.radius *
        (1 + amplitude2 * Math.cos(2 * angle + phase2) + amplitude3 * Math.cos(3 * angle + phase3));
    return { x: Math.cos(angle) * radius * stretch, y: (Math.sin(angle) * radius) / stretch };
  });
  // Bound the entire footprint, keeping the cell rim clear.
  const scale = Math.min(
    1,
    (region.radius * 1.22) / Math.max(...local.map((p) => Math.hypot(p.x, p.y))),
  );
  region.points = local.map((p) => ({
    x: region.x + scale * (Math.cos(rotation) * p.x - Math.sin(rotation) * p.y),
    y: region.y + scale * (Math.sin(rotation) * p.x + Math.cos(rotation) * p.y),
  }));
}
// Geometry is transported from a reference network by one injective map.
// The displacement Jacobian has norm < .32 everywhere: no folding, and
// lengths/widths shrink by at most 32%. Heights travel with the same map.
function makeWarp(seed, enabled) {
  const random = rng(seed ^ 0x43555256);
  return { enabled, phases: Array.from({ length: 4 }, () => random() * Math.PI * 2) };
}
function warpPoint(plan, p) {
  if (!plan.warp.enabled) return { x: p.x, y: p.y };
  const [a, b, c, d] = plan.warp.phases;
  return {
    x: p.x + 4 * Math.sin((p.x + 0.4 * p.y) / 20 + a) + Math.sin((p.y - 0.3 * p.x) / 47 + b),
    y: p.y + 4 * Math.sin((p.y - 0.4 * p.x) / 22 + c) + Math.sin((p.x + 0.3 * p.y) / 49 + d),
  };
}
function curvePath(plan, points, closed = false) {
  const curve = [],
    count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      steps = Math.ceil(distance(a, b) / 3);
    for (let j = 0; j < steps; j++) {
      const p = { x: a.x + ((b.x - a.x) * j) / steps, y: a.y + ((b.y - a.y) * j) / steps };
      curve.push({ ...warpPoint(plan, p), source: p });
    }
  }
  if (!closed) {
    const p = points[points.length - 1];
    curve.push({ ...warpPoint(plan, p), source: p });
  }
  return curve;
}
function capsuleOutline(plan, a, b, radius) {
  const angle = Math.atan2(b.y - a.y, b.x - a.x),
    points = [];
  for (const [center, start] of [
    [b, angle + Math.PI / 2],
    [a, angle - Math.PI / 2],
  ]) {
    for (let i = 0; i <= 12; i++) {
      const t = start - (Math.PI * i) / 12;
      points.push({ x: center.x + radius * Math.cos(t), y: center.y + radius * Math.sin(t) });
    }
  }
  return curvePath(plan, points, true);
}
function buildCurves(plan) {
  plan.border = curvePath(
    plan,
    Array.from({ length: 6 }, (_, i) => ({
      x: SIZE / 2 + HEX_RADIUS * Math.cos((i * Math.PI) / 3),
      y: SIZE / 2 + HEX_RADIUS * Math.sin((i * Math.PI) / 3),
    })),
    true,
  );
  for (const r of plan.regions) r.outline = curvePath(plan, r.points, true);
  for (const e of plan.edges) {
    const a = plan.regions[e.a],
      b = plan.regions[e.b],
      mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    e.points = curvePath(plan, [a, mid, b]);
    e.outline = capsuleOutline(plan, a, b, ROAD_RADIUS);
  }
}
function latticeNeighbor(a, b) {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.q + a.r - b.q - b.r)) === 1;
}
// BFS layers guarantee a one-step ascent from every cell to the unique peak.
function assignSteppedHeights(cells, peak) {
  const step = 8, peakOffset = 16;
  const distances = new Map([[peak, 0]]), queue = [peak];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    for (const neighbor of cells) {
      if (distances.has(neighbor) || !latticeNeighbor(current, neighbor)) continue;
      distances.set(neighbor, distances.get(current) + 1);
      queue.push(neighbor);
    }
  }
  if (queue.length !== cells.length) throw Error('Disconnected height lattice.');
  for (const cell of cells) {
    cell.distanceToPeak = distances.get(cell);
    cell.offset = peakOffset - cell.distanceToPeak * step;
  }
  return { step, peakCellId: peak.id };
}
/**
 * Plan topology and independent full-cell heights; never read UI state.
 * @param {number} seed Unsigned 32-bit seed.
 * @param {{curved?: boolean}} [options]
 */
function makePlan(seed, { curved = true } = {}) {
  const random = rng(seed),
    regions = [],
    edges = [];
  // Axial lattice: center + six inner + twelve outer regions, with bounded jitter.
  // All footprints retain a margin to the convex hex boundary.
  for (let r = -2; r <= 2; r++)
    for (let q = -2; q <= 2; q++) {
      if (Math.abs(q + r) > 2) continue;
      regions.push({
        q,
        r,
        x: SIZE / 2 + 53 * (q + r / 2) + (random() - 0.5) * 6,
        y: SIZE / 2 + ((53 * Math.sqrt(3)) / 2) * r + (random() - 0.5) * 6,
        radius: 11 + random() * 4,
      });
    }
  // Separate shape RNG: polygon detail does not change the existing graph draws.
  const shapeRandom = rng(seed ^ 0x504f4c59);
  for (const region of regions) shapeRegion(region, shapeRandom);
  // Heights belong to full lattice cells, not the jittered green footprints.
  const heightRandom = rng(seed ^ 0x48454947);
  const cells = regions.map((region, index) => {
    const x = SIZE / 2 + 53 * (region.q + region.r / 2);
    const y = SIZE / 2 + (53 * Math.sqrt(3) / 2) * region.r;
    return {
      id: index + 1, q: region.q, r: region.r, x, y,
      points: Array.from({ length: 6 }, (_, i) => {
        const angle = Math.PI / 6 + i * Math.PI / 3;
        return { x: x + 53 / Math.sqrt(3) * Math.cos(angle), y: y + 53 / Math.sqrt(3) * Math.sin(angle) };
      }),
    };
  });
  // A separate seed stream selects the outer peak without changing roads.
  const outerCells = cells.filter((cell) => Math.max(Math.abs(cell.q), Math.abs(cell.r), Math.abs(cell.q + cell.r)) === 2);
  const heightSteps = assignSteppedHeights(cells, outerCells[Math.floor(heightRandom() * outerCells.length)]);
  // Prim's minimum spanning tree: connected by construction, with no retries.
  const connected = new Set([0]);
  while (connected.size < regions.length) {
    let best;
    for (const a of connected)
      for (let b = 0; b < regions.length; b++) {
        if (connected.has(b) || !latticeNeighbor(regions[a], regions[b])) continue;
        const length = distance(regions[a], regions[b]);
        if (!best || length < best.length) best = { a, b, length, loop: false };
      }
    edges.push(best);
    connected.add(best.b);
  }
  const pairs = [];
  for (let a = 0; a < regions.length; a++)
    for (let b = a + 1; b < regions.length; b++) {
      if (
        !latticeNeighbor(regions[a], regions[b]) ||
        edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))
      )
        continue;
      pairs.push({ a, b, length: distance(regions[a], regions[b]), loop: true });
    }
  // Choose short extra connections, slightly randomized for different cycles.
  for (const p of pairs) p.score = p.length * (0.8 + random() * 0.4);
  pairs.sort((a, b) => a.score - b.score);
  edges.push(...pairs.slice(0, 6));
  const plan = { seed, cells, heightSteps, regions, edges, warp: makeWarp(seed, curved) };
  for (const cell of cells) cell.outline = curvePath(plan, cell.points, true);
  buildCurves(plan);
  return plan;
}
