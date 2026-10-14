'use strict';

// Standalone landscape composition; no gameplay, DOM, or navigation constraints.
const LandscapeCore = (() => {
  const WIDTH = 520, LENGTH = 640, NX = 52, NY = 64;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  function rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function noise(seed, x, y) {
    const hash = (i, j) => {
      let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ seed;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967295 * 2 - 1;
    };
    const i = Math.floor(x), j = Math.floor(y);
    const u = smooth(0, 1, x - i), v = smooth(0, 1, y - j);
    return mix(mix(hash(i, j), hash(i + 1, j), u), mix(hash(i, j + 1), hash(i + 1, j + 1), u), v);
  }
  const point = (x, y, h, w, s = 24) => ({ x, y, h, w, s });
  function catmull(a, b, c, d, t) {
    return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t
      + (-a + 3 * b - 3 * c + d) * t * t * t);
  }
  function sampleCurve(controls, transform) {
    const result = [];
    for (let i = 0; i < controls.length - 1; i++) {
      const a = controls[Math.max(0, i - 1)], b = controls[i];
      const c = controls[i + 1], d = controls[Math.min(controls.length - 1, i + 2)];
      const steps = Math.max(4, Math.ceil(Math.hypot(c.x - b.x, c.y - b.y) / 6));
      for (let j = 0; j < steps; j++) {
        const t = j / steps;
        const p = {};
        for (const key of ['x', 'y', 'h', 'w', 's']) p[key] = catmull(a[key], b[key], c[key], d[key], t);
        p.w = Math.max(1, p.w); p.s = Math.max(1, p.s); p.h = Math.max(0, p.h);
        result.push({ ...p, ...transform(p) });
      }
    }
    const end = controls[controls.length - 1];
    result.push({ ...end, ...transform(end) });
    return result;
  }

  function makePlan(seed, { branches = 6 } = {}) {
    const complexity = clamp(Math.round(Number(branches) || 0), 0, 12);
    // Separate streams keep the ascent and mountain composition stable when adding branches.
    const random = rng(seed ^ 0x4c414e44), topology = rng(seed ^ 0x5350494e);
    const branchRandom = rng(seed ^ 0x4252414e), geology = rng(seed ^ 0x47454f4c);
    const vary = (value, amount) => value + (random() * 2 - 1) * amount;
    const rock = (value, amount) => value + (geology() * 2 - 1) * amount;
    const mirror = random() < 0.5 ? -1 : 1;
    const angle = vary(0, 0.07), c = Math.cos(angle), s = Math.sin(angle);
    const transform = p => ({ x: mirror * p.x * c - p.y * s, y: mirror * p.x * s + p.y * c });
    const toLocal = (x, y) => ({ x: mirror * (x * c + y * s), y: -x * s + y * c });
    const upperHeight = vary(116, 12);
    const datum = y => mix(10, upperHeight, smooth(-180, 225, y));
    const phase = random() * Math.PI * 2, spread = vary(0.96, 0.07);
    const cells = [], rows = 6, cols = 5;
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const y = vary(-213 + row * 85, 17);
      const drift = 17 * Math.sin(row * 0.9 + phase);
      cells.push({ id: `r${row}c${col}`, row, col, neighbors: [], onSpine: false,
        name: 'Seitental', ...point(clamp(vary((col - 2) * 103 * spread + drift, 17), -224, 224),
          y, 0, vary(14, 5), vary(19, 4)) });
    }
    const at = (row, col) => cells[row * cols + col];
    function neighbors(a, b) { a.neighbors.push(b); b.neighbors.push(a); }
    for (const cell of cells) {
      if (cell.col + 1 < cols) neighbors(cell, at(cell.row, cell.col + 1));
      if (cell.row + 1 < rows) neighbors(cell, at(cell.row + 1, cell.col));
      if (cell.row + 1 < rows && cell.col + 1 < cols) {
        // One diagonal per face keeps the candidate graph planar.
        if ((cell.row + cell.col) % 2 === 0) neighbors(cell, at(cell.row + 1, cell.col + 1));
        else neighbors(at(cell.row, cell.col + 1), at(cell.row + 1, cell.col));
      }
    }
    const sideways = Array(rows - 1).fill(0);
    const turns = 4 + Math.floor(topology() * 4);
    for (let i = 0; i < turns; i++) {
      const available = sideways.map((n, row) => ({ n, row })).filter(p => p.n < 2);
      sideways[available[Math.floor(topology() * available.length)].row]++;
    }
    let col = 1 + Math.floor(topology() * 3), direction = topology() < 0.5 ? -1 : 1;
    const spine = [];
    for (let row = 0; row < rows; row++) {
      spine.push(at(row, col));
      if (row === rows - 1) break;
      const count = sideways[row];
      if (topology() < 0.8) direction = -direction;
      if (col + direction * count < 0 || col + direction * count >= cols) direction = -direction;
      for (let i = 0; i < count; i++) { col += direction; spine.push(at(row, col)); }
    }
    const low = { id: 'low', name: 'Offenes Tal', label: true,
      ...point(spine[0].x * 0.45, -282, 10, 62, 30) };
    const high = { id: 'high', name: 'Hochfläche', label: true,
      ...point(vary(spine[spine.length - 1].x * 0.35, 15), 284, upperHeight, 83, 32) };
    let previousHeight = 10;
    const landmarks = new Map([[0, 'Schluchtentor'], [Math.floor(spine.length * 0.3), 'Verdecktes Tal'],
      [Math.floor(spine.length * 0.65), 'Innerer Sattel'], [spine.length - 1, 'Letzter Pass']]);
    for (let i = 0; i < spine.length; i++) {
      const p = spine[i];
      p.onSpine = true;
      p.h = Math.max(previousHeight, datum(p.y) - 12 + vary(0, 3));
      previousHeight = p.h;
      p.w = i % 3 === 1 ? vary(27, 5) : vary(13, 3);
      p.label = landmarks.has(i); p.name = landmarks.get(i) || 'Gewundener Aufstieg';
    }
    const ascent = [low, ...spine, high], localNodes = [...ascent];
    const used = new Set(spine), edges = [], edgeKeys = new Set();
    const key = (a, b) => [a.id, b.id].sort().join('/');
    function edge(a, b, guaranteed = false, loop = false) {
      const id = key(a, b);
      if (edgeKeys.has(id)) return;
      edgeKeys.add(id); edges.push({ a, b, guaranteed, loop });
    }
    // Never prune this chain: every complexity setting retains low -> high.
    for (let i = 1; i < ascent.length; i++) edge(ascent[i - 1], ascent[i], true);
    const branchNodes = [];
    for (let i = 0; i < complexity; i++) {
      const frontier = [];
      for (const target of cells) {
        if (used.has(target)) continue;
        for (const parent of target.neighbors) if (used.has(parent)) {
          frontier.push({ target, parent, score: branchRandom() + (parent.onSpine ? 0 : 0.35) });
        }
      }
      frontier.sort((a, b) => b.score - a.score);
      const { target, parent } = frontier[0];
      target.h = clamp(mix(parent.h, datum(target.y) - 9, 0.55) + branchRandom() * 12 - 5,
        10, upperHeight - 8);
      target.name = ['Seitental', 'Felsengasse', 'Verborgener Kessel'][i % 3] + ` ${i + 1}`;
      if (i % 3 === 2) target.w = 24 + branchRandom() * 6;
      target.parent = parent;
      used.add(target); localNodes.push(target); branchNodes.push(target);
      edge(parent, target);
    }
    function graphDistance(from, to) {
      const queue = [{ node: from, distance: 0 }], seen = new Set([from]);
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        if (item.node === to) return item.distance;
        for (const e of edges) {
          const next = e.a === item.node ? e.b : e.b === item.node ? e.a : null;
          if (next && !seen.has(next)) { seen.add(next); queue.push({ node: next, distance: item.distance + 1 }); }
        }
      }
      return Infinity;
    }
    const loopRandom = rng(seed ^ 0x4c4f4f50), candidates = [], candidateKeys = new Set();
    for (const a of used) for (const b of a.neighbors) {
      const id = key(a, b);
      if (!used.has(b) || edgeKeys.has(id) || candidateKeys.has(id) || (a.onSpine && b.onSpine)) continue;
      candidateKeys.add(id); candidates.push({ a, b, score: loopRandom() });
    }
    candidates.sort((a, b) => a.score - b.score);
    let loopCount = 0;
    for (const candidate of candidates) {
      if (loopCount >= Math.floor(complexity / 3)) break;
      if (graphDistance(candidate.a, candidate.b) < 3) continue;
      edge(candidate.a, candidate.b, false, true); loopCount++;
    }
    const degree = p => edges.filter(e => e.a === p || e.b === p).length;
    for (const p of branchNodes) p.label = degree(p) === 1 || branchNodes.indexOf(p) % 3 === 0;
    const features = [];
    function feature(kind, name, controls, secondary = false) {
      const result = { id: features.length, kind, name, secondary, points: sampleCurve(controls, transform) };
      features.push(result);
      return result;
    }
    const west = [point(-240, -335, 0, 48), point(rock(-207, 13), -185, rock(112, 17), 64),
      point(rock(-185, 18), -22, rock(148, 20), 57), point(rock(-201, 15), 141, rock(128, 17), 61),
      point(-235, 310, 0, 50)];
    const east = [point(235, -330, 0, 48), point(rock(199, 15), -173, rock(142, 20), 67),
      point(rock(185, 19), 14, rock(155, 22), 58), point(rock(211, 12), 165, rock(106, 17), 62),
      point(239, 317, 0, 46)];
    const ridges = [west, east];
    const barrierCount = 3 + Math.floor(geology() * 2);
    for (let i = 0; i < barrierCount; i++) {
      const y = rock(-162 + i * 315 / (barrierCount - 1), 17);
      ridges.push([point(-295, y - 32, 0, 25), point(-185, rock(y, 24), rock(111, 18), rock(34, 5)),
        point(-62, rock(y + 27, 25), rock(145, 25), rock(34, 6)),
        point(66, rock(y - 20, 23), rock(126, 24), rock(32, 6)),
        point(192, rock(y + 15, 27), rock(106, 20), rock(38, 5)), point(295, y + 42, 0, 26)]);
    }
    for (let i = 0; i < ridges.length; i++) {
      const controls = ridges[i];
      feature('ridge', i < 2 ? 'Äußerer Hauptkamm' : 'Gewundener Gebirgsriegel', controls);
      const root = controls[1 + Math.floor(geology() * (controls.length - 2))];
      const sign = i === 0 ? 1 : i === 1 ? -1 : geology() < 0.5 ? -1 : 1;
      feature('ridge', 'Verbundener Gebirgsausläufer', [point(root.x, root.y, root.h * 0.85, root.w * 0.8),
        point(root.x + sign * rock(38, 10), root.y + rock(40, 16), root.h * 0.48, 26),
        point(root.x + sign * rock(75, 15), root.y + rock(90, 20), 0, 14)], true);
    }
    feature('valley', 'Offenes Eingangstal', [point(low.x - 14, -365, 10, 85, 34), low]);
    feature('valley', 'Obere Hochfläche', [high, point(high.x + 18, 365, upperHeight, 120, 34)]);
    const routes = [];
    for (const e of edges) {
      let hash = seed ^ 0x45444745;
      for (const char of key(e.a, e.b)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
      const edgeRandom = rng(hash);
      const a = e.a, b = e.b, dx = b.x - a.x, dy = b.y - a.y;
      const length = Math.hypot(dx, dy), nx = -dy / length, ny = dx / length;
      const bend = (edgeRandom() * 2 - 1) * 13;
      const width = 6 + edgeRandom() * 5, shoulder = 14 + edgeRandom() * 7;
      const controls = [a,
        point(mix(a.x, b.x, 0.32) + nx * bend, mix(a.y, b.y, 0.32) + ny * bend,
          mix(a.h, b.h, 0.32), width, shoulder),
        point(mix(a.x, b.x, 0.68) - nx * bend * 0.65, mix(a.y, b.y, 0.68) - ny * bend * 0.65,
          mix(a.h, b.h, 0.68), width * 1.15, shoulder), b];
      const valley = feature('valley', e.guaranteed ? 'Gewundener Aufstieg' : e.loop ? 'Seitlicher Rundweg' : 'Erkundungsast', controls);
      // Terrain and route use the identical curve, including every shared endpoint.
      routes.push({ from: a.id, to: b.id, guaranteed: e.guaranteed, loop: e.loop, points: valley.points });
    }
    for (const p of branchNodes) if (degree(p) === 1) {
      const dx = p.x - p.parent.x, dy = p.y - p.parent.y, length = Math.hypot(dx, dy);
      feature('valley', 'Auslaufender Talabschluss', [p,
        point(clamp(p.x + dx / length * 23, -237, 237), clamp(p.y + dy / length * 23, -259, 259), p.h + 22, p.w * 0.55, p.s),
        point(clamp(p.x + dx / length * 48, -244, 244), clamp(p.y + dy / length * 48, -266, 266), p.h + 90, 1, p.s)]);
    }
    const nodes = localNodes.map(({ neighbors, parent, ...p }) => ({ ...p, ...transform(p) }));
    const ascentLength = routes.filter(e => e.guaranteed).reduce((sum, route) => sum + route.points.slice(1)
      .reduce((length, p, i) => length + Math.hypot(p.x - route.points[i].x, p.y - route.points[i].y), 0), 0);
    return { seed, complexity, branchCount: branchNodes.length, loopCount, features, nodes, routes,
      toLocal, upperHeight, ascentLength };
  }

  function createField(plan, stage) {
    const features = plan.features.filter(f => stage === 'landscape' || !f.secondary);
    const cell = 32, cols = Math.ceil(WIDTH / cell), rows = Math.ceil(LENGTH / cell);
    const buckets = Array.from({ length: cols * rows }, () => []);
    const segments = [];
    for (let id = 0; id < features.length; id++) {
      const feature = features[id];
      for (let i = 1; i < feature.points.length; i++) {
        const a = feature.points[i - 1], b = feature.points[i];
        const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
        if (length2 < 0.0001) continue;
        const radius = feature.kind === 'ridge' ? Math.max(a.w, b.w) * 3.2 + 8
          : Math.max(a.w, b.w) + Math.max(a.s, b.s) * 4 + 12;
        const index = segments.length;
        segments.push({ id, a, b, dx, dy, length2 });
        const x0 = clamp(Math.floor((Math.min(a.x, b.x) - radius + WIDTH / 2) / cell), 0, cols - 1);
        const x1 = clamp(Math.floor((Math.max(a.x, b.x) + radius + WIDTH / 2) / cell), 0, cols - 1);
        const y0 = clamp(Math.floor((Math.min(a.y, b.y) - radius + LENGTH / 2) / cell), 0, rows - 1);
        const y1 = clamp(Math.floor((Math.max(a.y, b.y) + radius + LENGTH / 2) / cell), 0, rows - 1);
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) buckets[y * cols + x].push(index);
      }
    }
    const bestD = new Float64Array(features.length), bestT = new Float64Array(features.length);
    const bestSegment = new Int32Array(features.length);
    function height(x, y) {
      bestD.fill(Infinity); bestSegment.fill(-1);
      const bx = clamp(Math.floor((x + WIDTH / 2) / cell), 0, cols - 1);
      const by = clamp(Math.floor((y + LENGTH / 2) / cell), 0, rows - 1);
      for (const index of buckets[by * cols + bx]) {
        const segment = segments[index];
        const t = clamp(((x - segment.a.x) * segment.dx + (y - segment.a.y) * segment.dy) / segment.length2, 0, 1);
        const px = segment.a.x + segment.dx * t, py = segment.a.y + segment.dy * t;
        const d2 = (x - px) ** 2 + (y - py) ** 2;
        if (d2 < bestD[segment.id]) {
          bestD[segment.id] = d2; bestT[segment.id] = t; bestSegment[segment.id] = index;
        }
      }
      const local = plan.toLocal(x, y);
      let ridge = 0, floor = Infinity;
      for (let id = 0; id < features.length; id++) {
        if (bestSegment[id] < 0) continue;
        const segment = segments[bestSegment[id]], t = bestT[id];
        const d = Math.sqrt(bestD[id]);
        let w = mix(segment.a.w, segment.b.w, t);
        const h = mix(segment.a.h, segment.b.h, t);
        if (features[id].kind === 'ridge') {
          const side = segment.dx * (y - segment.a.y) - segment.dy * (x - segment.a.x);
          w *= side > 0 ? 1.1 : 0.86;
          const q = d / w;
          let contribution = h * Math.exp(-Math.pow(q, 1.45)) * (1 - smooth(2, 2.7, q));
          if (stage === 'landscape') {
            contribution *= 1 + 0.1 * noise(plan.seed ^ 0x464c414e, local.x / 65, local.y / 73);
          }
          // Smooth union at spur junctions; no additive stacks of mountain stamps.
          const k = Math.min(9, 2 * Math.min(ridge, contribution));
          const blend = k > 0 ? Math.max(k - Math.abs(ridge - contribution), 0) / k : 0;
          ridge = Math.max(ridge, contribution) + blend * blend * k * 0.25;
        } else {
          if (stage === 'landscape') w *= 1 + 0.08 * noise(plan.seed ^ 0x54414c, local.x / 53, local.y / 59);
          const shoulder = mix(segment.a.s, segment.b.s, t);
          const bank = Math.max(0, d - w) / shoulder;
          floor = Math.min(floor, h + 38 * Math.pow(bank, 1.7));
        }
      }
      const datum = mix(10, plan.upperHeight, smooth(-180, 225, local.y));
      let result = datum + ridge;
      if (stage === 'landscape') {
        result += Math.min(1, ridge / 45) * 4 * noise(plan.seed ^ 0x52454c49, local.x / 38, local.y / 48);
      }
      // Merge all cuts once. Equal-height plains stay planar, including at joins.
      if (floor < result) result = mix(result, floor, smooth(0, 7, result - floor));
      return result;
    }
    return height;
  }

  function buildMesh(plan, stage) {
    const height = createField(plan, stage);
    const heights = new Float32Array((NX + 1) * (NY + 1));
    const dx = WIDTH / NX, dy = LENGTH / NY;
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
      heights[j * (NX + 1) + i] = height(i * dx - WIDTH / 2, j * dy - LENGTH / 2);
    }
    const vertices = new Float32Array(heights.length * 7);
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
      const k = j * (NX + 1) + i;
      const l = Math.max(0, i - 1), r = Math.min(NX, i + 1);
      const b = Math.max(0, j - 1), f = Math.min(NY, j + 1);
      const sx = (heights[j * (NX + 1) + r] - heights[j * (NX + 1) + l]) / ((r - l) * dx);
      const sy = (heights[f * (NX + 1) + i] - heights[b * (NX + 1) + i]) / ((f - b) * dy);
      const length = Math.hypot(sx, sy, 1);
      let surround = 0;
      for (const [di, dj] of [[-6, 0], [6, 0], [0, -6], [0, 6]]) {
        surround += heights[clamp(j + dj, 0, NY) * (NX + 1) + clamp(i + di, 0, NX)];
      }
      const cavity = clamp((surround / 4 - heights[k]) / 22, 0, 0.35);
      vertices.set([i * dx - WIDTH / 2, j * dy - LENGTH / 2, heights[k],
        -sx / length, -sy / length, 1 / length, 1 - cavity], k * 7);
    }
    const indices = new Uint32Array(NX * NY * 6);
    let cursor = 0;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
      indices.set([a, b, c, b, d, c], cursor); cursor += 6;
    }
    // Overlay sampling follows the actual piecewise-linear mesh, not another surface.
    function sampleHeight(x, y) {
      const gx = clamp((x + WIDTH / 2) / dx, 0, NX - 0.000001);
      const gy = clamp((y + LENGTH / 2) / dy, 0, NY - 0.000001);
      const i = Math.floor(gx), j = Math.floor(gy), u = gx - i, v = gy - j;
      const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
      return u + v <= 1 ? heights[a] + u * (heights[b] - heights[a]) + v * (heights[c] - heights[a])
        : heights[d] + (1 - u) * (heights[c] - heights[d]) + (1 - v) * (heights[b] - heights[d]);
    }
    return { vertices, indices, sampleHeight };
  }
  return { makePlan, buildMesh, WIDTH, LENGTH };
})();
