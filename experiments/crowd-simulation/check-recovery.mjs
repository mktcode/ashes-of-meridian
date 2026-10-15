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
sealed.world.slots = sealed.world.marines.map(m => m.target); sealed.world.reservedSlots = new Set(sealed.world.slots);
const pool = sealed.world.slotPool, original = sealed.mover.target;
sealed.world.slotPool = sealed.world.slots.slice(); // No legal spare yet.
sealed.mover.bestDistance = 0; sealed.mover.stalledFor = 3;
core.update(sealed.world, 1 / 60);
assert.ok(sealed.mover.stalledFor >= 3, 'unsuccessful recovery must not erase persistent lack of progress');
assert.equal(sealed.mover.target, original); assert.equal(sealed.mover.moving, true);
assert.ok(sealed.mover.yieldUntil > sealed.world.time, 'failed search waits quietly instead of oscillating');
const position = { x: sealed.mover.x, z: sealed.mover.z };
core.update(sealed.world, 0.2); assert.equal(sealed.mover.x, position.x); assert.equal(sealed.mover.z, position.z);
sealed.world.slotPool = pool; sealed.world.recoveryAfter = 0;
sealed.mover.recoverAfter = sealed.mover.yieldUntil = 0;
arrive(sealed.world, 35);
assert.notEqual(sealed.mover.target, original); assert.equal(sealed.mover.target.row, original.row);
assert.equal(sealed.world.stats.retargets, 1); assert.equal(sealed.world.reservedSlots.has(original), false);
const oldTargets = sealed.world.marines.map(m => m.target), field = sealed.world.field;
assert.ok(core.spawnMarine(sealed.world), 'spawning still works after a spare replaces a prefix reservation');
assert.equal(new Set(sealed.world.marines.map(m => m.target)).size, sealed.world.marines.length);
for (let i = 0; i < oldTargets.length; i++) assert.equal(sealed.world.marines[i].target, oldTargets[i]);
arrive(sealed.world, 40); assert.equal(sealed.world.field, field); assert.equal(sealed.world.stats.fieldBuilds, 1);
console.log('Recovery: fine-grid passing lanes, physical detours, cached search continuation, fixed bodies/rows, persistent failed progress, quiet waiting, same-row spare and safe spawn after reassignment checked.');
