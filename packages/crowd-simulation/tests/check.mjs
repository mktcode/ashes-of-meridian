import assert from 'node:assert/strict';
import { loadDemo } from './fixture.mjs';
const { parts, samplePose, runCycleDuration } = loadDemo().model;
const partByName = Object.fromEntries(parts.map(part => [part.name, part]));

// Forward kinematics checks the rendered joints, not the IK's requested targets.
function legAt(time, weight, side) {
  const pose = samplePose(time, weight);
  let angle = 0;
  let y = partByName.hips.pivot[1] + pose.hips.offset[1], z = 0;
  for (const suffix of ['Thigh', 'Shin', 'Boot']) {
    const name = side + suffix;
    const pivot = partByName[name].pivot;
    y += pivot[1] * Math.cos(angle) - pivot[2] * Math.sin(angle);
    z += pivot[1] * Math.sin(angle) + pivot[2] * Math.cos(angle);
    angle += pose[name].rotation[0];
  }
  const boot = partByName[side + 'Boot'];
  let lowest = Infinity;
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const localY = boot.center[1] + sy * boot.size[1] / 2;
    const localZ = boot.center[2] + sz * boot.size[2] / 2;
    lowest = Math.min(lowest, y + localY * Math.cos(angle) - localZ * Math.sin(angle));
  }
  return { y, z, angle, lowest, pose };
}
const names = new Set();
for (const part of parts) {
  assert.ok(!names.has(part.name), 'unique part names');
  assert.ok(part.parent === null || names.has(part.parent), 'parent precedes child');
  assert.ok(part.size.every(value => value > 0), 'non-degenerate geometry');
  names.add(part.name);
}
for (const weight of [0, 0.25, 0.5, 0.75, 1]) {
  for (let tick = 0; tick < 120; tick++) {
    const pose = samplePose(tick / 60, weight);
    for (const [name, transform] of Object.entries(pose)) {
      assert.ok(names.has(name));
      for (const values of Object.values(transform)) assert.ok(values.every(Number.isFinite));
    }
    assert.equal(pose.hips.offset[0], 0, 'no lateral root motion');
    assert.equal(pose.hips.offset[2], 0, 'no forward root motion');
    for (const side of ['left', 'right']) {
      const knee = pose[side + 'Shin'].rotation[0];
      assert.ok(knee >= 0 && knee < 2.5, 'knee bends anatomically, without hyperextension');
      const leg = legAt(tick / 60, weight, side);
      assert.ok(leg.lowest >= -0.009, `no additional penetration beyond idle breathing at weight ${weight}, tick ${tick}: ${leg.lowest}`);
    }
  }
}
assert.notDeepEqual(samplePose(0, 0), samplePose(0.3, 0), 'idle is animated');
assert.notDeepEqual(samplePose(0, 1), samplePose(0.3, 1), 'run is animated');
assert.deepEqual(samplePose(0.2, -1), samplePose(0.2, 0));
assert.deepEqual(samplePose(0.2, 2), samplePose(0.2, 1));
for (let tick = 0; tick <= 300; tick++) {
  const t = tick / 300 * runCycleDuration;
  const left = legAt(t, 1, 'left');
  const rightNext = legAt(t + runCycleDuration / 2, 1, 'right');
  assert.ok(Math.abs(left.z - rightNext.z) < 1e-10, 'legs alternate half a cycle apart');
  assert.ok(left.lowest >= 0.0049, 'full run keeps boot corners clear of the floor');
  if (tick / 300 < 0.38) assert.ok(Math.abs(left.lowest - 0.005) < 1e-10, 'support foot stays on the floor through body bob and toe roll');
  const next = legAt(t + runCycleDuration, 1, 'left');
  assert.ok(Math.abs(left.y - next.y) + Math.abs(left.z - next.z) < 1e-10, 'periodic gait');
}
const at = phase => legAt(phase * runCycleDuration, 1, 'left');
assert.ok(at(0.05).z > at(0.20).z && at(0.20).z > at(0.35).z, 'support foot travels backwards');
assert.ok(at(0.55).z < at(0.80).z, 'recovery foot travels forwards');
assert.ok(at(0.65).lowest > 0.20, 'heel lifts during recovery');
assert.ok(at(0.55).pose.leftShin.rotation[0] > at(0.20).pose.leftShin.rotation[0], 'recovery bends the knee more than support');
assert.ok(at(0).pose.leftArm.rotation[0] > 0 && at(0).pose.rightArm.rotation[0] < 0, 'arms oppose the landing leg');
for (const seam of [0, 0.38, 0.5, 0.88, 1]) {
  const before = at(seam - 1e-5), after = at(seam + 1e-5);
  assert.ok(Math.abs(before.y - after.y) + Math.abs(before.z - after.z) + Math.abs(before.angle - after.angle) < 0.001, 'no pop at gait phase boundaries');
}
console.log('Marine: hierarchy, idle/run blending, anatomical knees, foot clearance, forward gait, cycle continuity and stationary root checked.');
