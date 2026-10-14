'use strict';
// Standalone cell topology and heights; no terrain generation or browser state.
const SIZE = 300,
  PIXELS = 900,
  ROAD_RADIUS = 7;
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// One injective map transports all geometry, preserving shared boundaries.
// The displacement Jacobian has norm < .32 everywhere: no folding.
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
    const a = points[i], b = points[(i + 1) % points.length],
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
function latticeNeighbor(a, b) {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.q + a.r - b.q - b.r)) === 1;
}
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
// Every non-peak cell chooses a higher neighbor: a rooted ascent tree,
// rather than an independent spanning tree that may force downhill detours.
function buildConnections(cells, seed) {
  const random = rng(seed), edges = [];
  for (const [a, cell] of cells.entries()) {
    const higher = cells.map((other, b) => ({ other, b })).filter(({ other }) =>
      latticeNeighbor(cell, other) && other.offset === cell.offset + 8);
    if (higher.length) edges.push({ a, b: higher[Math.floor(random() * higher.length)].b, loop: false });
  }
  const pairs = [];
  for (let a = 0; a < cells.length; a++) for (let b = a + 1; b < cells.length; b++) {
    if (!latticeNeighbor(cells[a], cells[b]) ||
      edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) continue;
    pairs.push({ a, b, loop: true, score: random() });
  }
  pairs.sort((a, b) => a.score - b.score);
  edges.push(...pairs.slice(0, 6).map(({ a, b, loop }) => ({ a, b, loop })));
  return edges;
}
/** Full playable cells and their connections; never read UI state. */
function makePlan(seed, { curved = true } = {}) {
  const cells = [];
  for (let r = -2; r <= 2; r++) for (let q = -2; q <= 2; q++) {
    if (Math.abs(q + r) > 2) continue;
    const x = SIZE / 2 + 53 * (q + r / 2), y = SIZE / 2 + (53 * Math.sqrt(3) / 2) * r;
    cells.push({
      id: cells.length + 1, q, r, x, y,
      points: Array.from({ length: 6 }, (_, i) => {
        const angle = Math.PI / 6 + i * Math.PI / 3;
        return { x: x + 53 / Math.sqrt(3) * Math.cos(angle), y: y + 53 / Math.sqrt(3) * Math.sin(angle) };
      }),
    });
  }
  const heightRandom = rng(seed ^ 0x48454947);
  const outerCells = cells.filter((cell) => Math.max(Math.abs(cell.q), Math.abs(cell.r), Math.abs(cell.q + cell.r)) === 2);
  const heightSteps = assignSteppedHeights(cells, outerCells[Math.floor(heightRandom() * outerCells.length)]);
  const plan = { seed, cells, heightSteps, edges: buildConnections(cells, seed), warp: makeWarp(seed, curved) };
  for (const cell of cells) cell.outline = curvePath(plan, cell.points, true);
  return plan;
}
