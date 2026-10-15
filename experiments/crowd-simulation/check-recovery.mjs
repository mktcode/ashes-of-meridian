import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
for (const file of ['crowd-terrain.js', 'crowd-navigation.js', 'crowd-recovery.js', 'crowd-core.js']) vm.runInThisContext(readFileSync(new URL(file, import.meta.url), 'utf8'));
const { core, nav, terrain, recovery } = vm.runInThisContext('({ core: CrowdSimulation, nav: CrowdNavigation, terrain: CrowdTerrain, recovery: CrowdRecovery })');
function put(m, p, moving) {
  m.x = p.x; m.z = p.z; m.y = terrain.heightAt(p.x, p.z); m.moving = moving; m.vx = m.vz = 0;
  Object.assign(m.previous, { x: p.x, z: p.z });
}
function distanceToSegment(a, b, p) {
  const x = b.x - a.x, z = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * x + (p.z - a.z) * z) / (x * x + z * z || 1)));
  return Math.hypot(a.x + x * t - p.x, a.z + z * t - p.z);
}
function fixture(count) {
  const world = core.createWorld(), goal = { x: -8, z: 8 };
  core.spawnMarines(world, count - 1); assert.ok(core.moveTo(world, goal));
  const mover = world.marines.find(m => Math.hypot(m.target.x - goal.x, m.target.z - goal.z) < 1e-8);
  for (const m of world.marines) if (m !== mover) put(m, m.target, false);
  return { world, goal, mover };
}
function arrive(world, seconds) {
  const parked = new Map(world.marines.filter(m => !m.moving).map(m => [m, { x: m.x, z: m.z, target: m.target }]));
  for (let tick = 0; tick < seconds * 60; tick++) {
    core.update(world, 1 / 60);
    for (const [m, p] of parked) { assert.equal(m.x, p.x); assert.equal(m.z, p.z); assert.equal(m.target, p.target); }
    for (let i = 0; i < world.marines.length; i++) {
      const m = world.marines[i]; assert.ok(nav.canStand(m.x, m.z));
      for (let j = i + 1; j < world.marines.length; j++) assert.ok(Math.hypot(m.x - world.marines[j].x, m.z - world.marines[j].z) >= 0.78 - 1e-8);
    }
    if (world.marines.every(m => !m.moving && m.runWeight < 0.001)) return;
  }
  assert.fail('recovery must actually reach a safe exact reservation');
}

// A filled formation retains real 15 cm passing gaps; a coarse parked-cell mask would seal them.
const corridor = fixture(25), { world, goal, mover } = corridor;
put(mover, { x: goal.x + 6, z: goal.z }, true);
const fixed = world.marines.filter(m => m !== mover), target = mover.target, row = target.row;
assert.ok(fixed.some(m => distanceToSegment(mover, target, m) < 0.8), 'straight steering is blocked');
let result;
for (let i = 0; i < 10; i++) { result = recovery.plan(world, mover); if (result.status !== 'pending') break; }
assert.equal(result.status, 'ready');
assert.ok(result.route.points.length > 1, 'recovery supplies a real detour, not another straight probe');
let previous = mover;
for (const p of result.route.points) {
  assert.ok(nav.canTravel(previous.x, previous.z, p.x, p.z));
  for (const body of fixed) assert.ok(distanceToSegment(previous, p, body) >= 0.815 - 1e-6, 'route fits actual circle clearance');
  previous = p;
}
const builds = world.stats.recoveryFields, nodes = world.stats.recoveryNodes;
assert.equal(recovery.plan(world, mover).status, 'ready');
assert.equal(world.stats.recoveryFields, builds); assert.equal(world.stats.recoveryNodes, nodes, 'completed field is reused');
mover.bestDistance = 0; mover.stalledFor = 3;
arrive(world, 35);
assert.equal(mover.target, target); assert.equal(mover.target.row, row);
assert.equal(mover.x, target.x); assert.equal(mover.z, target.z);
assert.ok(world.stats.recoveryAttempts > 0); assert.equal(world.stats.fieldBuilds, 1);

// A physically sealed centre cannot be wished away: first wait, then choose an unreserved same-row spare.
const sealed = fixture(7), parked = sealed.world.marines.filter(m => m !== sealed.mover);
for (let i = 0; i < parked.length; i++) {
  const p = { x: sealed.goal.x + 0.8 * Math.cos(i * Math.PI / 3), z: sealed.goal.z + 0.8 * Math.sin(i * Math.PI / 3), row: parked[i].target.row };
  parked[i].target = p; put(parked[i], p, false);
}
put(sealed.mover, { x: sealed.goal.x, z: sealed.goal.z - 3 }, true);
const group = sealed.world.groups[0];
group.reservedSlots = new Set(sealed.world.marines.map(m => m.target));
const pool = group.slotPool, original = sealed.mover.target;
group.slotPool = Array.from(group.reservedSlots); // No legal spare yet.
sealed.mover.bestDistance = 0; sealed.mover.stalledFor = 3;
core.update(sealed.world, 1 / 60);
assert.ok(sealed.mover.stalledFor >= 3, 'unsuccessful recovery must not erase persistent lack of progress');
assert.equal(sealed.mover.target, original); assert.equal(sealed.mover.moving, true);
assert.ok(sealed.mover.yieldUntil > sealed.world.time, 'failed search waits quietly instead of oscillating');
const position = { x: sealed.mover.x, z: sealed.mover.z };
core.update(sealed.world, 0.2); assert.equal(sealed.mover.x, position.x); assert.equal(sealed.mover.z, position.z);
group.slotPool = pool; sealed.world.recoveryAfter = 0;
sealed.mover.recoverAfter = sealed.mover.yieldUntil = 0;
arrive(sealed.world, 35);
assert.notEqual(sealed.mover.target, original); assert.equal(sealed.mover.target.row, original.row);
assert.equal(sealed.world.stats.retargets, 1); assert.equal(group.reservedSlots.has(original), false);
const oldTargets = sealed.world.marines.map(m => m.target), field = group.field;
assert.ok(core.spawnMarine(sealed.world), 'spawning still works after a spare replaces a prefix reservation');
assert.equal(new Set(sealed.world.marines.map(m => m.target)).size, sealed.world.marines.length);
for (let i = 0; i < oldTargets.length; i++) assert.equal(sealed.world.marines[i].target, oldTargets[i]);
arrive(sealed.world, 40); assert.equal(group.field, field); assert.equal(sealed.world.stats.fieldBuilds, 1);
// Do not skip a nearly reached rock-corner waypoint while the next segment still clips the blocker.
const cornerWorld = core.createWorld(); cornerWorld.marines = [core.createMarine(20.945409942895157, 5.8874634553044585)];
assert.ok(core.moveTo(cornerWorld, { x: 28.787456622544205, z: 4.289863249735207 }));
const cornerMover = cornerWorld.marines[0]; cornerMover.runWeight = 1;
cornerMover.route = { index: 0, points: [{ x: 20.95, z: 6, remaining: 5.15 }, { x: 25, z: 6, remaining: 1.1 }, { x: 26, z: 5.55, remaining: 0 }] };
for (let tick = 0; tick < 3; tick++) core.update(cornerWorld, 1 / 60);
assert.equal(cornerMover.route.index, 0, 'the corner stays active until its successor is actually visible');
arrive(cornerWorld, 20); assert.equal(cornerWorld.stats.fieldBuilds, 1);

// A local route's last point can itself be the corner needed to see the individual reservation.
const exitWorld = core.createWorld(); exitWorld.marines = [core.createMarine(9.45, 13.95)];
assert.ok(core.moveTo(exitWorld, { x: 20, z: -6 }));
const exitGroup = exitWorld.groups[0], exitMover = exitWorld.marines[0], exitTarget = { x: 21.3834344874336, z: 23.255744889149195, row: 0 };
nav.prepareTarget(exitGroup.field, exitTarget); exitGroup.reservedSlots = new Set([exitTarget]); exitGroup.slotPool = [exitTarget];
exitGroup.arrivalRadius = exitTarget.approach[0].remaining + 1.5;
Object.assign(exitMover, { target: exitTarget, runWeight: 1, navigation: { points: exitTarget.approach, index: -1, bestDistance: Infinity },
  route: { index: 0, points: [{ x: 9.45, z: 14, remaining: 0 }] } });
core.update(exitWorld, 1 / 60); assert.ok(exitMover.z > 13.95, 'finish the exit instead of turning back toward the shared root');
arrive(exitWorld, 20); assert.equal(exitWorld.stats.fieldBuilds, 1);

// A permanently failed unit cannot monopolise the shared scheduler or keep probing while queued.
const queue = core.createWorld(); core.spawnMarines(queue, 2); core.moveTo(queue, { x: -8, z: 8 });
const queueGroup = queue.groups[0], queueField = queueGroup.field, seen = [], planner = recovery.plan;
queueGroup.slotPool = Array.from(queueGroup.reservedSlots);
for (let i = 0; i < queue.marines.length; i++) Object.assign(queue.marines[i], { stalledFor: 100 - i, bestDistance: 0, bestFieldDistance: 0 });
try {
  recovery.plan = (w, m) => { seen.push(m); return { status: 'blocked' }; };
  for (let tick = 0; tick < 150; tick++) core.update(queue, 1 / 60);
  assert.deepEqual(seen.slice(0, 3), queue.marines, 'least-recently-serviced queue reaches all stalled actors');
  assert.ok(queue.marines.every(m => m.waitingForRoute && m.state === 'waiting' && m.moving && m.runWeight < 0.001), 'failed searches stay physically quiet without pretending to arrive');
  const stopped = queue.marines.map(m => [m.x, m.z]);
  for (let tick = 0; tick < 60; tick++) core.update(queue, 1 / 60);
  assert.deepEqual(queue.marines.map(m => [m.x, m.z]), stopped);
} finally { recovery.plan = planner; }
assert.ok(core.moveTo(queue, { x: -8, z: 8 })); assert.ok(queue.marines.every(m => !m.waitingForRoute));
assert.equal(queueGroup.field, queueField); assert.equal(queue.stats.fieldBuilds, 1);
console.log('Recovery: fine-grid lanes, physical detours, cached continuation, fixed bodies/rows, persistent failure, quiet/fair retry queue, explicit retry, same-row spare and safe late spawn checked.');
