import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadLab } from './test-support.mjs';

// Checks only the pure core, mesh and audits, without game code or DOM stubs.
const context = loadLab();

for (const seed of [1, 2, 19, 16053245]) {
  const audit = vm.runInContext(`(() => {
    const plan = makePlan(${seed}), straight = makePlan(${seed}, false), river = plan.river;
    const terrain = makeMesh(plan), n = AUDIT_SIZE, mask = new Uint8Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      mask[y * n + x] = sampleWorld(plan, (x + .5) * SIZE / n, (y + .5) * SIZE / n).planned ? 1 : 0;
    }
    let roundTripError = 0, maxDeviation = 0, maxDepthError = 0;
    for (const edge of plan.edges) for (const p of edge.points) {
      const back = unwarpPoint(plan, p);
      roundTripError = Math.max(roundTripError, distance(back, p.source));
      maxDeviation = Math.max(maxDeviation, segmentDistance(p.x, p.y, edge.points[0], edge.points.at(-1)));
    }
    for (const points of river.curves) for (const p of points) {
      const s = sampleWorld(plan, p.x, p.y), back = unwarpPoint(plan, p);
      maxDepthError = Math.max(maxDepthError, Math.abs(sampleLand(plan, back.x, back.y).height - s.height - 2.5));
    }
    const keptBridges = new Set(river.bridges.map(b => b.key));
    const crossings = river.selected.every(e => {
      const road = plan.edges.find(road => edgeKey(road.a, road.b) === e.key);
      if (!road) return true;
      const anchor = warpPoint(plan, e.mid), bridge = sampleWorld(plan, anchor.x, anchor.y);
      return road.points.some(p => distance(p, anchor) < 1e-8) &&
        river.curves.some(points => points.some(p => distance(p, anchor) < 1e-8)) &&
        bridge.bridge === keptBridges.has(e.key) && bridge.planned === keptBridges.has(e.key);
    });
    const localBridges = river.bridges.every(b => {
      const e = plan.edges.find(e => edgeKey(e.a, e.b) === b.key), a = plan.regions[e.a], c = plan.regions[e.b];
      return [.2, .8].every(t => {
        const p = warpPoint(plan, { x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t });
        const s = sampleWorld(plan, p.x, p.y); return s.planned && !s.bridge;
      });
    });
    const nodeDegrees = new Map();
    for (const e of river.selected) nodeDegrees.set(e.b, (nodeDegrees.get(e.b) || 0) + 1);
    return {
      connected: checkConnected(mask, n), maxGrade: auditSurface(terrain),
      downhill: river.curves.every(points => points.every((p, i) => !i || points[i - 1].height > p.height)),
      splits: river.splits, exits: river.exits.length, noMerges: [...nodeDegrees.values()].every(n => n === 1),
      crossings, localBridges, roundTripError, maxDeviation, maxDepthError,
      sameTopology: JSON.stringify(plan.edges.map(e => [e.a, e.b])) === JSON.stringify(straight.edges.map(e => [e.a, e.b])) &&
        JSON.stringify(river.selected.map(e => [e.a, e.b])) === JSON.stringify(straight.river.selected.map(e => [e.a, e.b])),
      identity: straight.edges.every(e => e.points.every(p => distance(p, p.source) === 0)),
      boundaryMoved: plan.border.some(p => distance(p, p.source) > .5),
      boundaryAttached: [river.source, ...river.exits].every(p => {
        const back = unwarpPoint(plan, warpPoint(plan, p));
        const x = Math.abs(back.x - SIZE / 2), y = Math.abs(back.y - SIZE / 2);
        return Math.abs(Math.min(HEX_RADIUS * Math.sqrt(3) / 2 - y,
          (Math.sqrt(3) * HEX_RADIUS - Math.sqrt(3) * x - y) / 2)) < 2e-5;
      }),
    };
  })()`, context);
  assert.ok(audit.connected && audit.downhill && audit.noMerges);
  assert.ok(audit.maxGrade <= 0.45);
  assert.ok(audit.splits <= 2);
  assert.equal(audit.exits, audit.splits + 1);
  assert.ok(audit.crossings && audit.localBridges && audit.boundaryAttached);
  assert.ok(audit.sameTopology && audit.identity && audit.boundaryMoved);
  assert.ok(audit.roundTripError < 2e-5);
  assert.ok(audit.maxDepthError < 2e-5);
  assert.ok(audit.maxDeviation > 0.5);
  console.log(`Seed ${seed}: curved edges, shared crossings, boundary, downstream flow and connectivity OK; grade ${(audit.maxGrade * 100).toFixed(1)} %.`);
}
