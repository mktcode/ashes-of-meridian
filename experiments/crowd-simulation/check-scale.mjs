import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';

for (const file of ['crowd-terrain.js', 'crowd-navigation.js', 'crowd-recovery.js', 'crowd-core.js']) vm.runInThisContext(readFileSync(new URL(file, import.meta.url), 'utf8'));
const { core, nav, terrain } = vm.runInThisContext('({ core: CrowdSimulation, nav: CrowdNavigation, terrain: CrowdTerrain })');
const batch = core.createWorld(), serial = core.createWorld();
assert.equal(core.spawnMarines(batch, 100).length, 100);
for (let i = 0; i < 100; i++) assert.ok(core.spawnMarine(serial));
assert.deepEqual(batch.marines, serial.marines, 'batch retains exact original site order and per-unit state');
for (const count of [0, -1, 0.5, Infinity, NaN, '10']) assert.deepEqual(core.spawnMarines(batch, count), []);
assert.equal(batch.marines.length, 101);
assert.ok(nav.spawnSites.length >= 2000, 'larger map has real capacity, not smaller bodies');
assert.equal(nav.radius, 0.4); assert.equal(nav.cellSize, 0.5);
const empty = core.createWorld(); empty.marines = [];
assert.ok(core.moveTo(empty, { x: 10, z: 5 }));
assert.equal(core.spawnMarines(empty, 10).length, 10);
assert.equal(new Set(empty.marines.map(m => `${m.target.x}:${m.target.z}`)).size, 10, 'empty-world command retains a nonzero lattice orientation for future spawns');

function validate(world, parked) {
  const buckets = new Map(), width = 0.8;
  for (const m of world.marines) {
    assert.ok(Number.isFinite(m.x + m.y + m.z + m.yaw + m.time));
    assert.ok(nav.canStand(m.x, m.z), 'every body retains static footprint and slope clearance');
    assert.equal(m.y, terrain.heightAt(m.x, m.z));
    const bx = Math.floor(m.x / width), bz = Math.floor(m.z / width);
    for (let z = bz - 1; z <= bz + 1; z++) for (let x = bx - 1; x <= bx + 1; x++) {
      for (const other of buckets.get(`${x}:${z}`) || []) assert.ok(Math.hypot(m.x - other.x, m.z - other.z) >= 0.78 - 1e-8, 'physical spacing keeps the existing 2 cm solver tolerance');
    }
    const key = `${bx}:${bz}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(m);
    const old = parked.get(m);
    if (old) {
      assert.equal(m.moving, false); assert.equal(m.target, old.target);
      assert.equal(m.x, old.x); assert.equal(m.z, old.z);
    } else if (!m.moving) {
      assert.equal(m.x, m.target.x); assert.equal(m.z, m.target.z);
      parked.set(m, { x: m.x, z: m.z, target: m.target });
    }
  }
  assert.equal(new Set(world.marines.map(m => m.target)).size, world.marines.length);
  assert.equal(world.reservedSlots.size, world.marines.length);
}
function settle(world, goal, seconds, label) {
  assert.ok(core.moveTo(world, goal), `${label}: command accepted at actual crowd size`);
  const field = world.field, rows = new Map(world.marines.map(m => [m, m.target.row])), costs = [];
  const parked = new Map(world.marines.filter(m => !m.moving && m.x === m.target.x && m.z === m.target.z)
    .map(m => [m, { x: m.x, z: m.z, target: m.target }]));
  let tick = 0, peakNeighbours = 0;
  for (; tick < seconds * 60; tick++) {
    const start = performance.now(); core.update(world, 1 / 60); costs.push(performance.now() - start);
    assert.equal(world.field, field, 'recovery does not rebuild the primary field');
    peakNeighbours = Math.max(peakNeighbours, world.stats.neighbourChecks);
    for (const m of world.marines) assert.equal(m.target.row, rows.get(m), 'all rescue paths and spare reservations retain arrival rows');
    if (tick % 15 === 0) validate(world, parked);
    if (world.marines.every(m => !m.moving && m.runWeight < 0.001)) break;
  }
  if (tick === seconds * 60) console.error(JSON.stringify({ scenario: label, stats: world.stats,
    pending: world.marines.filter(m => m.moving).slice(0, 20).map(m => ({ x: m.x, z: m.z, target: m.target, stalledFor: m.stalledFor, route: m.route })) }));
  assert.ok(tick < seconds * 60, `${label}: every marine truly arrives, without increasing arrival tolerance`);
  validate(world, parked);
  assert.equal(parked.size, world.marines.length);
  assert.ok(peakNeighbours < world.marines.length * 256, 'bounded local neighbour work, including collision passes and final snaps');
  costs.sort((a, b) => a - b);
  console.log(JSON.stringify({ scenario: label, count: world.marines.length, arrivalSeconds: (tick + 1) / 60,
    tickP50Ms: costs[Math.floor(costs.length * 0.5)], tickP95Ms: costs[Math.floor(costs.length * 0.95)], tickMaxMs: costs.at(-1), peakNeighbours,
    primaryFields: world.stats.fieldBuilds, recoveryAttempts: world.stats.recoveryAttempts, recoveryFields: world.stats.recoveryFields, recoveryNodes: world.stats.recoveryNodes }));
}
for (const [count, goal, seconds] of [[100, { x: -32, z: 32 }, 100], [500, { x: 0, z: 7 }, 120], [1000, { x: 32, z: -32 }, 120], [2000, { x: 32, z: -32 }, 120]]) {
  const world = core.createWorld(); assert.equal(core.spawnMarines(world, count - 1).length, count - 1);
  settle(world, goal, seconds, `${count}-arrival`);
  assert.equal(world.stats.fieldBuilds, 1);
  if (count === 1000) {
    const frozen = JSON.stringify(world.marines); core.update(world, 0); assert.equal(JSON.stringify(world.marines), frozen);
    const oldField = world.field, oldTargets = world.marines.map(m => m.target);
    assert.equal(core.spawnMarines(world, 10).length, 10);
    assert.equal(world.field, oldField);
    for (let i = 0; i < oldTargets.length; i++) assert.equal(world.marines[i].target, oldTargets[i]);
    // Branch the fixture: test filled-formation access without weakening the in-flight redirect case.
    const late = structuredClone(world);
    settle(late, goal, 180, '1010-late-spawn-with-1000-parked');
    assert.equal(late.stats.fieldBuilds, 1);
    settle(world, { x: -32, z: 32 }, 150, '1010-redirect-with-late-spawn');
    assert.equal(world.stats.fieldBuilds, 2);
  }
}
const central = core.createWorld(); assert.equal(core.spawnMarines(central, 1999).length, 1999);
settle(central, { x: 0, z: 7 }, 180, '2000-central-occluded-arrival');
const hidden = central.marines.filter(m => !nav.canTravel(central.destination.x, central.destination.z, m.target.x, m.target.z));
assert.ok(hidden.length > 200, 'the central crowd actually occupies reachable obstacle shadows');
assert.equal(central.stats.fieldBuilds, 1);
console.log(`Scale: actual 100/500/1000/2000 arrivals, 1010-unit late arrival and redirect, ${hidden.length} occluded reservations in the central 2000-unit crowd, local work, terrain, separation, immutable parked bodies, rows, pause and batch/late-spawn semantics checked. CPU timings are not GPU/FPS guarantees.`);
