import assert from 'node:assert/strict';
import { fixture } from './fixture.mjs';
const { core, recovery, terrain, createFixtureWorld } = fixture();
function setup() {
  const world = createFixtureWorld(),
    goal = { x: -8, z: 8 };
  core.spawnAgents(world, 24);
  assert.ok(core.moveTo(world, goal));
  const mover = world.units.find(
    (m) => Math.hypot(m.target.x - goal.x, m.target.z - goal.z) < 1e-8,
  );
  for (const m of world.units) {
    const p = m === mover ? { x: goal.x + 6, z: goal.z } : m.target;
    Object.assign(m, {
      x: p.x,
      y: terrain.heightAt(p.x, p.z),
      z: p.z,
      moving: m === mover,
      vx: 0,
      vz: 0,
    });
    Object.assign(m.previous, { x: m.x, z: m.z });
  }
  const first = recovery.plan(world, mover);
  assert.equal(first.status, 'pending', 'fixture really has an unfinished bounded local search');
  mover.stalledFor = 3;
  mover.waitingForRoute = true;
  mover.yieldUntil = 10;
  world.recoveryCandidate = mover;
  world.recoveryWork = 1;
  return { world, mover };
}
const { world, mover } = setup(),
  group = world.groups[0],
  field = group.field,
  target = mover.target;
const removed = world.units.find((m) => m !== mover),
  fixed = new Map(
    world.units.filter((m) => m !== mover && m !== removed).map((m) => [m, [m.x, m.z, m.target]]),
  );
assert.equal(core.removeAgents(world, [removed.id]), 1);
assert.equal(group.reservedSlots.size, 24);
assert.equal(group.field, field);
assert.equal(world.recoveryCandidate, null);
assert.equal(mover.waitingForRoute, false);
assert.equal(mover.yieldUntil, 0);
let tick = 0;
for (; tick < 2400; tick++) {
  core.update(world, 1 / 60);
  for (const [m, p] of fixed) assert.deepEqual([m.x, m.z, m.target], p);
  if (!mover.moving && mover.movementBlend < 0.001) break;
}
assert.ok(tick < 2400);
assert.equal(mover.target, target);
assert.equal(mover.x, target.x);
assert.equal(mover.z, target.z);
assert.equal(group.field, field);
assert.equal(world.stats.fieldBuilds, 1);
const second = setup();
assert.equal(core.removeAgents(second.world, [second.mover.id]), 1);
assert.equal(second.world.recoveryCandidate, null);
assert.equal(second.world.groups[0].reservedSlots.size, 24);
for (let i = 0; i < 60; i++) core.update(second.world, 1 / 60);
assert.ok(second.world.units.every((m) => !m.moving && m.target));
console.log(
  'Lifecycle: remove parked blocker or active candidate during an unfinished local search; release slots/caches, preserve fixed survivors/primary field and complete the remaining arrival.',
);
