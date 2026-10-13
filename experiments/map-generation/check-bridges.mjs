import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadLab } from './test-support.mjs';

// Small graph fixtures and bounded real-plan queries; no mesh or raster sweep.
const context = loadLab({ scripts: ['terrain-core'] });
const { selectBridges, makePlan, edgeKey, sample, rng } = vm.runInContext(
  '({ selectBridges, makePlan, edgeKey, sample, rng })', context);
const keys = bridges => bridges.map(b => b.key);
const plain = value => JSON.parse(JSON.stringify(value));
function fixture(seed, dry, wet) {
  const edges = [...dry, ...wet.map(e => e.slice(0, 2))].map(([a, b]) => ({ a, b }));
  return { plan: { seed, regions: Array.from({ length: 1 + Math.max(...edges.flatMap(e => [e.a, e.b])) }), edges },
    crossings: wet.map(([a, b, x, y = 0]) => ({ key: edgeKey(a, b), center: { x, y } })) };
}
function connected(plan, crossings, bridges) {
  const wet = new Set(keys(crossings)), kept = new Set(keys(bridges)), visited = new Set([0]), queue = [0];
  for (let head = 0; head < queue.length; head++) for (const e of plan.edges) {
    const key = edgeKey(e.a, e.b);
    if (wet.has(key) && !kept.has(key)) continue;
    const next = e.a === queue[head] ? e.b : e.b === queue[head] ? e.a : -1;
    if (next >= 0 && !visited.has(next)) { visited.add(next); queue.push(next); }
  }
  return visited.size === plan.regions.length;
}

// Three parallel transitions of the same dry pair: remove a close neighbor
// first, but never both indispensable final connections in the resulting chain.
const clustered = fixture(7, [[0, 1], [2, 3]], [[0, 2, 0], [1, 2, 1], [1, 3, 100], [3, 4, 101]]);
const snapshot = JSON.stringify(clustered);
for (const percent of [0, 50, 100]) {
  const result = selectBridges(clustered.plan, clustered.crossings, percent);
  assert.equal(result.reduction.candidates.length, 2);
  assert.equal(result.reduction.removed.length, Math.round(2 * percent / 100));
  assert.ok(result.bridges.some(b => b.key === '3:4'), 'A nearby but necessary bridge must stay');
  assert.ok(connected(clustered.plan, clustered.crossings, result.bridges));
  assert.ok(['0:2', '1:2'].includes(result.reduction.candidates[0]), 'Prefer the close redundant pair over the distant crossing');
  if (percent === 0) assert.deepEqual(plain(keys(result.bridges)), keys(clustered.crossings));
}
assert.equal(JSON.stringify(clustered), snapshot, 'Selection must not mutate roads or crossing geometry');

// Every edge of a cycle is individually redundant; only one is jointly removable.
const cycle = fixture(11, [], [[0, 1, 0], [1, 2, 1], [0, 2, 30], [2, 3, 31]]);
const full = selectBridges(cycle.plan, cycle.crossings, 100);
assert.equal(full.reduction.candidates.length, 1);
assert.equal(full.bridges.length, 3);
assert.ok(full.bridges.some(b => b.key === '2:3'));
assert.ok(connected(cycle.plan, cycle.crossings, full.bridges));
for (const b of full.bridges) assert.ok(!connected(cycle.plan, cycle.crossings, full.bridges.filter(e => e !== b)),
  'At 100% every surviving bridge is needed by the road network');

const tree = fixture(1, [[0, 1]], [[1, 2, 0], [2, 3, 1]]);
assert.equal(selectBridges(tree.plan, tree.crossings, 100).bridges.length, 2);
assert.equal(selectBridges(tree.plan, tree.crossings, 100).reduction.candidates.length, 0);
const dryBypass = fixture(1, [[0, 1], [1, 2]], [[0, 2, 0]]);
assert.equal(selectBridges(dryBypass.plan, dryBypass.crossings, 100).bridges.length, 0);
assert.equal(selectBridges({ seed: 1, regions: [{}], edges: [] }, []).bridges.length, 0);

// Endpoint percentages are genuinely seed-reachable, not only test overrides.
const endpointSeeds = [0, 100].map(percent => {
  for (let seed = 0; seed < 2000; seed++) if (Math.floor(rng(seed ^ 0x42524447)() * 101) === percent) return seed;
  throw Error(`No seed found for ${percent}%`);
});
for (const [i, seed] of endpointSeeds.entries()) {
  const result = selectBridges({ ...clustered.plan, seed }, clustered.crossings);
  assert.equal(result.reduction.percent, i * 100);
  assert.equal(result.reduction.removed.length, i * 2);
}

for (const seed of [2, 17, ...endpointSeeds]) {
  const plan = makePlan(seed), copy = makePlan(seed), straight = makePlan(seed, false, false), river = plan.river;
  const roads = new Map(plan.edges.map(e => [edgeKey(e.a, e.b), e]));
  const crossings = river.selected.filter(e => roads.has(e.key)).map(e => ({ key: e.key, center: e.mid }));
  const all = selectBridges(plan, crossings, 0), minimum = selectBridges(plan, crossings, 100);
  assert.deepEqual(plain(river.reduction), plain(copy.river.reduction));
  assert.deepEqual(plain(river.reduction), plain(straight.river.reduction), 'Warp and rounding toggles preserve selection');
  assert.ok(connected(plan, crossings, river.bridges));
  assert.ok(connected(plan, crossings, minimum.bridges));
  assert.equal(river.reduction.total, all.bridges.length);
  assert.equal(river.bridges.length, river.reduction.total - river.reduction.removed.length);
  assert.equal(river.reduction.removed.length, Math.round(river.reduction.candidates.length * river.reduction.percent / 100));
  const kept = new Set(keys(river.bridges));
  for (const crossing of crossings) {
    const s = sample(plan, crossing.center.x, crossing.center.y);
    assert.equal(s.bridge, kept.has(crossing.key));
    assert.equal(s.planned, kept.has(crossing.key), 'Removed decks must leave an impassable water crossing');
  }
  for (const bridge of minimum.bridges) assert.ok(!connected(plan, crossings, minimum.bridges.filter(e => e !== bridge)));
  console.log(`Seed ${seed}: ${river.bridges.length}/${river.reduction.total} bridges, ${river.reduction.percent}% of redundant pool, ${river.reduction.removed.length}/${river.reduction.candidates.length} removed; road network connected.`);
}
console.log('Bridges: independent seed, 0/50/100%, clustered pairs, necessary transitions, cycles, dry bypass, deterministic toggles and blocked removed decks OK. No full mesh/raster.');
