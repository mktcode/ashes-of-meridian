'use strict';
// Standalone topology, rivers, bridges and per-grid-cell height offsets.
// Extracted from aom-map-generator 77cf9b9; no terrain generation or browser state.
const SIZE = 300,
  PIXELS = 900,
  ROAD_RADIUS = 7,
  HEX_RADIUS = 145;
const RIVER_RADIUS = 2.8,
  BANK_WIDTH = 3,
  FLOW_GRADE = 0.07;
const WATER_DROP = 1.4,
  RIVER_SUPPORT = RIVER_RADIUS + BANK_WIDTH;
const BRIDGE_BUFFER = 1.8,
  BRIDGE_REACH = RIVER_SUPPORT + BRIDGE_BUFFER;
function insideMap(x, y) {
  x = Math.abs(x - SIZE / 2);
  y = Math.abs(y - SIZE / 2);
  return (
    y <= (HEX_RADIUS * Math.sqrt(3)) / 2 + 1e-8 &&
    Math.sqrt(3) * x + y <= Math.sqrt(3) * HEX_RADIUS + 1e-8
  );
}
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function segmentDistance(x, y, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
}
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
  // Bound the entire footprint, keeping room for rivers between nodes.
  const scale = Math.min(
    1,
    (region.radius * 1.22) / Math.max(...local.map((p) => Math.hypot(p.x, p.y))),
  );
  region.points = local.map((p) => ({
    x: region.x + scale * (Math.cos(rotation) * p.x - Math.sin(rotation) * p.y),
    y: region.y + scale * (Math.sin(rotation) * p.x + Math.cos(rotation) * p.y),
  }));
  region.sides = region.points.map((a, i) => {
    const b = region.points[(i + 1) % region.points.length],
      dx = b.x - a.x,
      dy = b.y - a.y;
    return { a, dx, dy, length2: dx * dx + dy * dy };
  });
  region.bounds = {
    minX: Math.min(...region.points.map((p) => p.x)),
    maxX: Math.max(...region.points.map((p) => p.x)),
    minY: Math.min(...region.points.map((p) => p.y)),
    maxY: Math.max(...region.points.map((p) => p.y)),
  };
}
function polygonDistance(region, x, y) {
  // Exact signed Euclidean distance to the same convex polygon drawn on the map.
  let squared = Infinity,
    inside = true;
  for (const e of region.sides) {
    const dx = x - e.a.x,
      dy = y - e.a.y;
    if (e.dx * dy - e.dy * dx < -1e-8) inside = false;
    const t = Math.max(0, Math.min(1, (dx * e.dx + dy * e.dy) / e.length2));
    squared = Math.min(squared, (dx - t * e.dx) ** 2 + (dy - t * e.dy) ** 2);
  }
  return Math.sqrt(squared) * (inside ? -1 : 1);
}
function polygonGap(a, b) {
  let gap = Math.max(
    0,
    Math.min(
      ...a.points.map((p) => polygonDistance(b, p.x, p.y)),
      ...b.points.map((p) => polygonDistance(a, p.x, p.y)),
    ),
  );
  for (const e of a.sides)
    for (const f of b.sides) {
      const cross = e.dx * f.dy - e.dy * f.dx;
      if (Math.abs(cross) < 1e-9) continue;
      const dx = f.a.x - e.a.x,
        dy = f.a.y - e.a.y,
        t = (dx * f.dy - dy * f.dx) / cross,
        u = (dx * e.dy - dy * e.dx) / cross;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) gap = 0;
    }
  return gap;
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
function unwarpPoint(plan, p) {
  let q = { x: p.x, y: p.y };
  // Fixed-point inversion converges because the displacement is contractive.
  for (let i = 0; i < 12 && plan.warp.enabled; i++) {
    const mapped = warpPoint(plan, q);
    q = { x: p.x - (mapped.x - q.x), y: p.y - (mapped.y - q.y) };
  }
  return q;
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
  const river = plan.river;
  for (const e of river.dual.links)
    e.points = curvePath(plan, [river.dual.nodes[e.a], e.mid, river.dual.nodes[e.b]]);
  river.curves = river.paths.map((points) =>
    points.map((source) => ({
      ...warpPoint(plan, source),
      source,
      height: waterHeight(river, source.x, source.y),
    })),
  );
  river.outlines = river.segments.map((e) => capsuleOutline(plan, e.a, e.b, RIVER_RADIUS));
  river.bridgeOutlines = river.segments.map((e) => capsuleOutline(plan, e.a, e.b, BRIDGE_REACH));
  for (const b of river.bridges) {
    b.outline = curvePath(
      plan,
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([u, v]) => ({
        x: b.center.x + u * b.halfLength * b.ux - v * b.halfWidth * b.uy,
        y: b.center.y + u * b.halfLength * b.uy + v * b.halfWidth * b.ux,
      })),
      true,
    );
  }
}
function latticeNeighbor(a, b) {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.q + a.r - b.q - b.r)) === 1;
}
function edgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}
function project(p, direction) {
  return p.x * direction.x + p.y * direction.y;
}
function dualNetwork(regions) {
  const nodes = [],
    links = [],
    facesByEdge = new Map();
  for (let a = 0; a < regions.length; a++)
    for (let b = a + 1; b < regions.length; b++) {
      if (!latticeNeighbor(regions[a], regions[b])) continue;
      for (let c = b + 1; c < regions.length; c++) {
        if (!latticeNeighbor(regions[a], regions[c]) || !latticeNeighbor(regions[b], regions[c]))
          continue;
        const index = nodes.length,
          points = [regions[a], regions[b], regions[c]];
        nodes.push({
          x: points.reduce((s, p) => s + p.x, 0) / 3,
          y: points.reduce((s, p) => s + p.y, 0) / 3,
          boundary: false,
        });
        for (const [i, j] of [
          [a, b],
          [b, c],
          [a, c],
        ]) {
          const key = edgeKey(i, j);
          if (!facesByEdge.has(key)) facesByEdge.set(key, { a: i, b: j, faces: [] });
          facesByEdge.get(key).faces.push(index);
        }
      }
    }
  for (const [key, edge] of facesByEdge) {
    const a = regions[edge.a],
      b = regions[edge.b],
      mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const first = edge.faces[0];
    let second = edge.faces[1];
    if (second === undefined) {
      const from = nodes[first],
        dx = mid.x - from.x,
        dy = mid.y - from.y;
      let lo = 1,
        hi = 20;
      for (let step = 0; step < 40; step++) {
        const t = (lo + hi) / 2;
        if (insideMap(from.x + dx * t, from.y + dy * t)) lo = t;
        else hi = t;
      }
      second = nodes.length;
      nodes.push({ x: from.x + dx * lo, y: from.y + dy * lo, boundary: true });
    }
    links.push({ a: first, b: second, mid, key });
  }
  return { nodes, links };
}
// Route selection supplies topology only. Degree-two dual nodes are NOT curve
// anchors: spans run directly between road crossings and shared junctions.
function smoothRiverRoutes(dual, selected, direction, rounded) {
  const outgoing = dual.nodes.map(() => []),
    incoming = new Map(),
    paths = [],
    cubics = [];
  for (const e of selected) {
    outgoing[e.a].push(e);
    incoming.set(e.b, e);
  }
  const tangent = (e) => {
    const a = dual.nodes[e.a],
      b = dual.nodes[e.b],
      length = distance(a, b);
    return { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  };
  if (!rounded)
    return { paths: selected.map((e) => [dual.nodes[e.a], e.mid, dual.nodes[e.b]]), cubics };
  for (let node = 0; node < outgoing.length; node++) {
    if (incoming.has(node) && outgoing[node].length === 1) continue;
    for (const first of outgoing[node]) {
      const chain = [first];
      let last = first;
      while (outgoing[last.b].length === 1) {
        last = outgoing[last.b][0];
        chain.push(last);
      }
      const anchors = [
        { p: dual.nodes[node], t: tangent(incoming.get(node) || first) },
        ...chain.map((e) => ({ p: e.mid, t: tangent(e) })),
        { p: dual.nodes[last.b], t: tangent(last) },
      ];
      const points = [anchors[0].p];
      for (let i = 1; i < anchors.length; i++) {
        const start = anchors[i - 1],
          end = anchors[i],
          a = start.p,
          d = end.p,
          length = distance(a, d),
          downstream = project(d, direction) - project(a, direction);
        // Ordered control projections prove strict downstream motion for the
        // entire cubic, not just its endpoints. Junction tangents are shared.
        const h1 = Math.min(length * 0.45, (downstream * 0.4) / project(start.t, direction)),
          h2 = Math.min(length * 0.45, (downstream * 0.4) / project(end.t, direction)),
          b = { x: a.x + start.t.x * h1, y: a.y + start.t.y * h1 },
          c = { x: d.x - end.t.x * h2, y: d.y - end.t.y * h2 };
        cubics.push({ a, b, c, d });
        const steps = Math.ceil(
          (3 * Math.max(distance(a, b), distance(b, c), distance(c, d))) / 0.7,
        );
        for (let j = 1; j <= steps; j++) {
          const t = j / steps,
            u = 1 - t;
          points.push(
            j === steps
              ? d
              : {
                  x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x,
                  y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y,
                },
          );
        }
      }
      paths.push(points);
    }
  }
  return { paths, cubics };
}
function planRiver(plan) {
  const random = rng(plan.seed ^ 0x52495652),
    dual = dualNetwork(plan.regions);
  // Downstream scalar orders EVERY leg, including both halves of a dual edge.
  const angle = (Math.floor(random() * 6) * Math.PI) / 3 + 0.12 + random() * 0.12,
    direction = { x: Math.cos(angle), y: Math.sin(angle) },
    outgoing = dual.nodes.map(() => []);
  for (const link of dual.links) {
    let a = link.a,
      b = link.b;
    if (project(dual.nodes[a], direction) > project(dual.nodes[b], direction)) [a, b] = [b, a];
    const p = project(dual.nodes[a], direction),
      m = project(link.mid, direction),
      q = project(dual.nodes[b], direction);
    if (m <= p + 1e-6 || q <= m + 1e-6) continue;
    outgoing[a].push({
      ...link,
      a,
      b,
      score: distance(dual.nodes[a], link.mid) + distance(link.mid, dual.nodes[b]) + random() * 12,
    });
  }
  function route(start, forbidden) {
    const memo = new Map();
    function visit(node) {
      if (forbidden.has(node)) return null;
      if (dual.nodes[node].boundary) return { score: 0, links: [] };
      if (memo.has(node)) return memo.get(node);
      let best = null;
      for (const edge of outgoing[node]) {
        const tail = visit(edge.b);
        if (tail && (!best || edge.score + tail.score > best.score))
          best = { score: edge.score + tail.score, links: [edge, ...tail.links] };
      }
      memo.set(node, best);
      return best;
    }
    return visit(start);
  }
  let trunk = null,
    source = null;
  for (let i = 0; i < dual.nodes.length; i++) {
    if (!dual.nodes[i].boundary) continue;
    for (const inlet of outgoing[i]) {
      const tail = route(inlet.b, new Set([i]));
      if (tail && (!trunk || inlet.score + tail.score > trunk.score)) {
        source = i;
        trunk = { score: inlet.score + tail.score, links: [inlet, ...tail.links] };
      }
    }
  }
  if (!trunk) throw Error('Das duale Netz besitzt keinen durchgehend abfallenden Flussweg.');
  const selected = [...trunk.links],
    used = new Set([source]),
    branchNodes = new Set();
  for (const e of selected) used.add(e.b);
  const wantedSplits = 1 + Math.floor(random() * 2);
  for (let split = 0; split < wantedSplits; split++) {
    const alternatives = [];
    for (const node of used) {
      if (dual.nodes[node].boundary || branchNodes.has(node)) continue;
      for (const edge of outgoing[node]) {
        if (used.has(edge.b)) continue;
        const tail = route(edge.b, used);
        if (tail) alternatives.push({ node, links: [edge, ...tail.links] });
      }
    }
    if (!alternatives.length) break;
    const branch = alternatives[Math.floor(random() * alternatives.length)];
    selected.push(...branch.links);
    branchNodes.add(branch.node);
    for (const e of branch.links) used.add(e.b);
  }
  const { paths, cubics } = smoothRiverRoutes(dual, selected, direction, plan.rounded);
  const segments = paths
    .flatMap((points) => points.slice(1).map((b, i) => ({ a: points[i], b })))
    .map((e) => ({ ...e, dx: e.b.x - e.a.x, dy: e.b.y - e.a.y, length2: distance(e.a, e.b) ** 2 }));
  const selectedByKey = new Map(selected.map((e) => [e.key, e]));
  const crossings = plan.edges
    .filter((e) => selectedByKey.has(edgeKey(e.a, e.b)))
    .map((e) => {
      const a = plan.regions[e.a],
        b = plan.regions[e.b],
        length = distance(a, b),
        crossing = selectedByKey.get(edgeKey(e.a, e.b));
      const ux = (b.x - a.x) / length,
        uy = (b.y - a.y) / length,
        halfWidth = ROAD_RADIUS + 0.5;
      // Recompute from the curve tangent at the retained crossing anchor.
      const from = dual.nodes[crossing.a],
        to = dual.nodes[crossing.b],
        dx = to.x - from.x,
        dy = to.y - from.y,
        tangentLength = Math.hypot(dx, dy),
        across = Math.abs(ux * dy - uy * dx) / tangentLength,
        along = Math.abs(ux * dx + uy * dy) / tangentLength,
        halfLength = (BRIDGE_REACH + halfWidth * along) / across + 2;
      // The rectangle is only a bound; decks are clipped to the rounded corridor.
      return { key: crossing.key, center: crossing.mid, ux, uy, halfLength, halfWidth };
    });
  const { bridges, reduction } = selectBridges(plan, crossings);
  const exits = [...used].filter((i) => dual.nodes[i].boundary && i !== source);
  return {
    dual,
    direction,
    selected,
    paths,
    cubics,
    segments,
    bridges,
    reduction,
    source: dual.nodes[source],
    exits: exits.map((i) => dual.nodes[i]),
    splits: branchNodes.size,
    phase: plan.phase,
    spatial: riverSpatialTree(segments),
  };
}
// Contract dry ROAD components, not all visually dry terrain: only the planned
// passages guarantee access. A reverse-delete pass finds a jointly removable
// pool; individually redundant crossings must never be deleted all at once.
function selectBridges(plan, crossings, percent) {
  const random = rng(plan.seed ^ 0x42524447),
    seededPercent = Math.floor(random() * 101);
  const removalPercent = percent ?? seededPercent;
  const parent = plan.regions.map((_, i) => i),
    crossingKeys = new Set(crossings.map((b) => b.key));
  function root(i) {
    return parent[i] === i ? i : (parent[i] = root(parent[i]));
  }
  for (const e of plan.edges)
    if (!crossingKeys.has(edgeKey(e.a, e.b))) parent[root(e.a)] = root(e.b);
  const roads = new Map(plan.edges.map((e) => [edgeKey(e.a, e.b), e]));
  const links = crossings.map((bridge) => {
    const e = roads.get(bridge.key),
      a = root(e.a),
      b = root(e.b);
    return { bridge, a, b, pair: edgeKey(a, b), tie: random() };
  });
  const adjacency = plan.regions.map(() => []);
  for (const link of links) {
    adjacency[link.a].push(link);
    adjacency[link.b].push(link);
  }
  const excluded = new Set(),
    candidates = [];
  function hasBypass(link) {
    const visited = new Set([link.a]),
      queue = [link.a];
    for (let head = 0; head < queue.length; head++) {
      const node = queue[head];
      if (node === link.b) return true;
      for (const e of adjacency[node]) {
        if (e === link || excluded.has(e.bridge.key)) continue;
        const next = e.a === node ? e.b : e.a;
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    return false;
  }
  while (true) {
    const active = links.filter((e) => !excluded.has(e.bridge.key));
    let best = null;
    for (const link of active) {
      if (!hasBypass(link)) continue;
      // Prefer proximity to another crossing of the same dry component pair.
      // Otherwise consider nearby crossings along alternative connection cycles.
      const parallel = active.filter((e) => e !== link && e.pair === link.pair),
        neighbors = parallel.length ? parallel : active.filter((e) => e !== link),
        gap = Math.min(...neighbors.map((e) => distance(link.bridge.center, e.bridge.center)));
      // Reference-space distances keep selection stable under the warp toggle.
      if (!best || gap < best.gap || (gap === best.gap && link.tie < best.link.tie))
        best = { link, gap };
    }
    if (!best) break;
    candidates.push(best.link.bridge.key);
    excluded.add(best.link.bridge.key);
  }
  const removed = candidates.slice(0, Math.round((candidates.length * removalPercent) / 100)),
    removedKeys = new Set(removed);
  return {
    bridges: crossings.filter((b) => !removedKeys.has(b.key)),
    reduction: { percent: removalPercent, total: crossings.length, candidates, removed },
  };
}
function riverSpatialTree(segments) {
  const node = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const e of segments) {
    node.minX = Math.min(node.minX, e.a.x, e.b.x);
    node.minY = Math.min(node.minY, e.a.y, e.b.y);
    node.maxX = Math.max(node.maxX, e.a.x, e.b.x);
    node.maxY = Math.max(node.maxY, e.a.y, e.b.y);
  }
  if (segments.length <= 8) node.segments = segments;
  else {
    const axis = node.maxX - node.minX > node.maxY - node.minY ? 'x' : 'y',
      sorted = [...segments].sort((a, b) => a.a[axis] + a.b[axis] - b.a[axis] - b.b[axis]),
      mid = sorted.length >> 1;
    node.left = riverSpatialTree(sorted.slice(0, mid));
    node.right = riverSpatialTree(sorted.slice(mid));
  }
  return node;
}
function riverBoxGap(node, x, y) {
  const dx = Math.max(node.minX - x, 0, x - node.maxX),
    dy = Math.max(node.minY - y, 0, y - node.maxY);
  return dx * dx + dy * dy;
}
function riverDistance(river, x, y) {
  let squared = Infinity;
  const stack = [river.spatial];
  while (stack.length) {
    const node = stack.pop();
    if (riverBoxGap(node, x, y) >= squared) continue;
    if (!node.segments) {
      // Visit the nearer child first; bounding boxes prune the distant curves.
      if (riverBoxGap(node.left, x, y) < riverBoxGap(node.right, x, y))
        stack.push(node.right, node.left);
      else stack.push(node.left, node.right);
      continue;
    }
    for (const e of node.segments) {
      const dx = x - e.a.x,
        dy = y - e.a.y,
        t = Math.max(0, Math.min(1, (dx * e.dx + dy * e.dy) / e.length2));
      squared = Math.min(squared, (dx - t * e.dx) ** 2 + (dy - t * e.dy) ** 2);
    }
  }
  return Math.sqrt(squared);
}
function bridgeAt(river, x, y, gap = riverDistance(river, x, y)) {
  if (gap > BRIDGE_REACH) return false;
  return river.bridges.some((b) => {
    const dx = x - b.center.x,
      dy = y - b.center.y;
    return (
      Math.abs(dx * b.ux + dy * b.uy) <= b.halfLength &&
      Math.abs(-dx * b.uy + dy * b.ux) <= b.halfWidth
    );
  });
}
function riverDatum(river, x, y) {
  const downstream = project({ x: x - SIZE / 2, y: y - SIZE / 2 }, river.direction);
  // Stronger broad relief, without adding local noise or deepening the bed.
  // Derivative along flow is -FLOW_GRADE +/- 1/80: strictly falling.
  return 40 - FLOW_GRADE * downstream + Math.sin(downstream / 80 + river.phase);
}
function waterHeight(river, x, y) {
  return riverDatum(river, x, y) - WATER_DROP;
}
function riverPolygonGap(region, river) {
  let gap = Infinity;
  for (const e of river.segments) {
    gap = Math.min(
      gap,
      Math.max(0, polygonDistance(region, e.a.x, e.a.y)),
      Math.max(0, polygonDistance(region, e.b.x, e.b.y)),
    );
    for (const p of region.points) gap = Math.min(gap, segmentDistance(p.x, p.y, e.a, e.b));
    for (const side of region.sides) {
      const cross = e.dx * side.dy - e.dy * side.dx;
      if (Math.abs(cross) < 1e-9) continue;
      const dx = side.a.x - e.a.x,
        dy = side.a.y - e.a.y,
        t = (dx * side.dy - dy * side.dx) / cross,
        u = (dx * e.dy - dy * e.dx) / cross;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) gap = 0;
    }
  }
  return Math.max(0, gap - RIVER_SUPPORT);
}
/**
 * Plan topology and independent full-cell heights; never read UI state.
 * @param {number} seed Unsigned 32-bit seed.
 * @param {{curved?: boolean, rounded?: boolean}} [options]
 */
function makePlan(seed, { curved = true, rounded = true } = {}) {
  const random = rng(seed),
    regions = [],
    edges = [];
  // Axial lattice: center + six inner + twelve outer regions, with bounded jitter.
  // All footprints retain a margin to the convex hex boundary.
  for (let r = -2; r <= 2; r++)
    for (let q = -2; q <= 2; q++) {
      if (Math.abs(q + r) > 2) continue;
      // Reserve enough space between the complete polygon footprints for water.
      regions.push({
        q,
        r,
        x: SIZE / 2 + 53 * (q + r / 2) + (random() - 0.5) * 6,
        y: SIZE / 2 + ((53 * Math.sqrt(3)) / 2) * r + (random() - 0.5) * 6,
        radius: 11 + random() * 4,
      });
    }
  // Separate shape RNG: polygon detail does not change the existing terrain/graph draws.
  const shapeRandom = rng(seed ^ 0x504f4c59);
  for (const region of regions) shapeRegion(region, shapeRandom);
  // Heights belong to full lattice cells, not the jittered green footprints.
  const heightRandom = rng(seed ^ 0x48454947);
  const cells = regions.map((region, index) => {
    const x = SIZE / 2 + 53 * (region.q + region.r / 2);
    const y = SIZE / 2 + (53 * Math.sqrt(3) / 2) * region.r;
    return {
      id: index + 1, q: region.q, r: region.r, x, y,
      offset: (heightRandom() * 2 - 1) * 16,
      points: Array.from({ length: 6 }, (_, i) => {
        const angle = Math.PI / 6 + i * Math.PI / 3;
        return { x: x + 53 / Math.sqrt(3) * Math.cos(angle), y: y + 53 / Math.sqrt(3) * Math.sin(angle) };
      }),
    };
  });
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
  const angle = random() * Math.PI * 2,
    phase = random() * Math.PI * 2;
  const waves = Array.from({ length: 7 }, () => ({
    angle: random() * Math.PI * 2,
    scale: 9 + random() * 24,
    phase: random() * Math.PI * 2,
    amplitude: 3 + random() * 6,
  }));
  const plan = { seed, cells, regions, edges, angle, phase, waves, rounded, warp: makeWarp(seed, curved) };
  plan.river = planRiver(plan);
  for (const cell of cells) cell.outline = curvePath(plan, cell.points, true);
  buildCurves(plan);
  return plan;
}
