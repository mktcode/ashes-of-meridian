import { fixture } from './fixture.mjs';
import assert from 'node:assert/strict';

const { core, nav, terrain, createFixtureWorld } = fixture();
const projection = (p, axis) => p.x * axis.x + p.z * axis.z;
function valid(world) {
  for (const m of world.units) {
    assert.ok(nav.canStand(m.x, m.z));
    assert.equal(m.y, terrain.heightAt(m.x, m.z));
  }
  for (let i = 0; i < world.units.length; i++) for (let j = i + 1; j < world.units.length; j++) {
    const a = world.units[i], b = world.units[j];
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= nav.radius * 2 - 0.02);
  }
}
function arrive(world, firstArrival = null) {
  const rows = world.units.map(m => m.target.row), field = world.groups[0].field;
  const parked = new Map();
  let first = true;
  for (let tick = 0; tick < 2400; tick++) {
    core.update(world, 1 / 60); valid(world);
    assert.equal(world.groups[0].field, field);
    for (let i = 0; i < rows.length; i++) {
      const m = world.units[i];
      assert.equal(m.target.row, rows[i], 'recovery cannot undo the front-to-rear row allocation');
      if (parked.has(m)) assert.equal(m.target, parked.get(m), 'occupied reservations remain fixed');
      if (!m.moving) {
        if (first && firstArrival) firstArrival(m);
        first = false; parked.set(m, m.target);
      }
    }
    if (world.units.every(m => !m.moving && m.movementBlend < 0.001)) return;
  }
  assert.fail('Ordered crowd did not arrive');
}
for (const [goal, axis] of [
  [{ x: 0, z: 10 }, { x: 0, z: 1 }], [{ x: 0, z: -10 }, { x: 0, z: -1 }],
  [{ x: 8, z: 8 }, { x: 1, z: 0 }], [{ x: -8, z: -8 }, { x: -1, z: 0 }],
  [{ x: -8, z: 8 }, { x: 0.6, z: 0.8 }], [{ x: 8, z: -8 }, { x: -0.6, z: -0.8 }],
]) {
  const world = createFixtureWorld();
  world.units = Array.from({ length: 7 }, (_, i) => core.createAgent(goal.x - axis.x * (3 + i * 2), goal.z - axis.z * (3 + i * 2)));
  valid(world);
  assert.ok(core.moveTo(world, goal));
  assert.ok(Math.abs(world.groups[0].arrivalDirection.x - axis.x) < 1e-10 && Math.abs(world.groups[0].arrivalDirection.z - axis.z) < 1e-10);
  assert.ok(projection(world.units[0].target, axis) > projection(goal, axis), 'leading marine continues beyond the clicked point');
  assert.ok(projection(world.units.at(-1).target, axis) < projection(goal, axis), 'rear marine gets the approach side');
  for (let i = 1; i < world.units.length; i++) assert.ok(world.units[i].target.row >= world.units[i - 1].target.row);
  const reservations = world.units.map(m => m.target);
  assert.ok(core.moveTo(world, goal));
  assert.deepEqual(world.units.map(m => m.target), reservations);
  assert.equal(world.stats.fieldBuilds, 1);
  arrive(world, m => assert.ok(projection(m.target, axis) > projection(goal, axis), 'first parked marine does not seal the approach side'));
}

const lanes = createFixtureWorld();
lanes.units = [6, 4, 2, 0].flatMap(z => [-0.875, 0.875].map(x => core.createAgent(x, z)));
assert.ok(core.moveTo(lanes, { x: 0, z: 10 }));
const initialX = new Map(lanes.units.map(m => [m, m.x]));
for (const a of lanes.units) for (const b of lanes.units) {
  if (a.target.row === b.target.row && initialX.get(a) < initialX.get(b)) assert.ok(a.target.x <= b.target.x, 'lateral ordering within an arrival row does not cross lanes');
}
arrive(lanes);

const large = createFixtureWorld();
for (let i = 1; i < 50; i++) assert.ok(core.spawnAgent(large));
assert.ok(core.moveTo(large, { x: 6, z: 0 }));
const d = large.groups[0].arrivalDirection;
const ordered = large.units.slice().sort((a, b) => projection(b, d) - projection(a, d)
  || (a.z - b.z) * d.x - (a.x - b.x) * d.z);
for (let i = 1; i < ordered.length; i++) assert.ok(ordered[i].target.row >= ordered[i - 1].target.row);
arrive(large);
assert.equal(large.stats.fieldBuilds, 1, 'large crowd still shares a single field');

// Force the old shortest-distance recovery to prefer an invalid front/rear exchange.
const recovery = createFixtureWorld();
recovery.units = [core.createAgent(0, 6), core.createAgent(0, 4)];
assert.ok(core.moveTo(recovery, { x: 0, z: 10 }));
const targets = recovery.units.map(m => m.target);
assert.ok(targets[0].z > recovery.groups[0].destination.z, 'even a two-marine arrival reserves the far side first');
assert.notEqual(targets[0].row, targets[1].row);
function putAt(m, target, stalled = true) {
  m.x = target.x; m.z = target.z; m.y = terrain.heightAt(m.x, m.z);
  m.vx = 0; m.vz = 0; m.moving = stalled;
  m.direct = true; m.directCell = nav.indexAt(m.x, m.z);
  m.bestDistance = 0; m.stalledFor = stalled ? 3 : 0;
}
putAt(recovery.units[0], targets[1]); putAt(recovery.units[1], targets[0]);
core.update(recovery, 1 / 60);
assert.equal(recovery.units[0].target, targets[0]);
assert.equal(recovery.units[1].target, targets[1]);
assert.ok(recovery.stats.recoveryAttempts > 0, 'recovery was actually invoked');
arrive(recovery);

// Recovery remains available for genuinely crossed lateral lanes in the same row.
const lateralRecovery = createFixtureWorld();
for (let i = 1; i < 7; i++) core.spawnAgent(lateralRecovery);
assert.ok(core.moveTo(lateralRecovery, { x: 0, z: 10 }));
let pair;
for (const a of lateralRecovery.units) for (const b of lateralRecovery.units) {
  if (a !== b && a.target.row === b.target.row && a.target.x !== b.target.x) pair = [a, b];
}
assert.ok(pair);
for (const m of lateralRecovery.units) putAt(m, m.target, false);
const [a, b] = pair, at = a.target, bt = b.target;
putAt(a, bt); putAt(b, at);
core.update(lateralRecovery, 1 / 60);
assert.equal(a.target, bt); assert.equal(b.target, at);
arrive(lateralRecovery);
console.log('Arrival: far-side-first allocation in six directions, lateral lanes, first parking, 50-marine detour, fixed rows during recovery, safe lateral exchanges and stable arrival checked.');
