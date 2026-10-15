import { fixture } from './fixture.mjs';
import assert from 'node:assert/strict';

const { core, nav, terrain, createFixtureWorld } = fixture();
const goal = { x: 0, z: 7 }, field = nav.buildField(goal), slots = nav.places(goal, 1000, field);
const hidden = slots.filter(p => !nav.canTravel(goal.x, goal.z, p.x, p.z));
assert.ok(hidden.length > 100, 'reachable rock shadows must be occupied, not discarded by a straight-line mask');
assert.deepEqual(slots, nav.places(goal, 1001, field).slice(0, 1000), 'walking-distance order is prefix stable');
function cost(p) {
  if (nav.canTravel(goal.x, goal.z, p.x, p.z)) return Math.hypot(p.x - goal.x, p.z - goal.z);
  const center = nav.pointAt(nav.indexAt(p.x, p.z)), end = nav.pointAt(field.goal);
  return field.cost[nav.indexAt(p.x, p.z)] + Math.hypot(p.x - center.x, p.z - center.z) + Math.hypot(goal.x - end.x, goal.z - end.z);
}
for (let i = 1; i < slots.length; i++) assert.ok(cost(slots[i]) >= cost(slots[i - 1]) - 1e-8, 'slots grow by walkable route distance');
for (const target of hidden) {
  const points = nav.prepareTarget(field, target);
  assert.equal(nav.prepareTarget(field, target), points, 'an assigned branch is built once, not searched every tick');
  assert.equal(points[0].x, goal.x); assert.equal(points[0].z, goal.z);
  assert.equal(points.at(-1).x, target.x); assert.equal(points.at(-1).z, target.z);
  for (let i = 1; i < points.length; i++) {
    assert.ok(nav.canTravel(points[i - 1].x, points[i - 1].z, points[i].x, points[i].z), 'reversed shared-tree branches keep footprint and corner clearance');
    assert.ok(Math.abs(points[i - 1].remaining - points[i].remaining - Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)) < 1e-8);
  }
  assert.equal(points.at(-1).remaining, 0);
}
// Reachability is still mandatory, unlike straight visibility.
const disconnected = { ...field, cost: field.cost.slice() }, excluded = slots[10];
disconnected.cost[nav.indexAt(excluded.x, excluded.z)] = Infinity;
assert.ok(!nav.places(goal, 1000, disconnected).some(p => p.x === excluded.x && p.z === excluded.z));

// Isolate a genuinely occluded reservation: static routing must work without invoking body recovery.
const world = createFixtureWorld(); core.spawnAgents(world, 99); assert.ok(core.moveTo(world, goal));
const mover = world.units.find(m => !nav.canTravel(goal.x, goal.z, m.target.x, m.target.z));
assert.ok(mover); world.units = [mover];
mover.x = goal.x; mover.z = goal.z; mover.y = terrain.heightAt(mover.x, mover.z);
Object.assign(mover.previous, { x: mover.x, z: mover.z });
const target = mover.target, shared = world.groups[0].field;
let tick = 0;
for (; tick < 1800; tick++) {
  core.update(world, 1 / 60);
  assert.ok(nav.canStand(mover.x, mover.z)); assert.equal(mover.y, terrain.heightAt(mover.x, mover.z));
  assert.equal(mover.target, target); assert.equal(world.groups[0].field, shared);
  if (!mover.moving && mover.movementBlend < 0.001) break;
}
assert.ok(tick < 1800, 'the unit reaches its own hidden reservation instead of circling the shared click');
assert.equal(mover.x, target.x); assert.equal(mover.z, target.z);
assert.equal(world.stats.fieldBuilds, 1); assert.equal(world.stats.recoveryAttempts, 0, 'ordinary static detours do not consume exceptional body-recovery searches');
console.log(`Occluded arrival: ${hidden.length}/1000 reservations behind obstacles, walking-distance ordering, cached shared-tree branches, unreachable exclusion and exact arrival without recovery checked.`);
