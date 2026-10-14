import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
for (const file of ['marine-model.js', 'crowd-terrain.js']) vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), context);
const { model, terrain } = vm.runInContext('({ model: MarineModel, terrain: CrowdTerrain })', context);
const parts = Object.fromEntries(model.parts.map(part => [part.name, part]));
const rotateX = (p, angle) => [p[0], Math.cos(angle) * p[1] - Math.sin(angle) * p[2], Math.sin(angle) * p[1] + Math.cos(angle) * p[2]];
const transform = (p, m) => [0, 1, 2].map(i => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2]);

function checkPose(time, weight, ground) {
  const pose = model.samplePose(time, weight, ground);
  const flat = model.samplePose(time, weight);
  assert.deepEqual(pose.chest, flat.chest, 'terrain does not tilt the torso');
  assert.deepEqual(pose.helmet, flat.helmet, 'terrain does not tilt the head');
  assert.equal(pose.hips.rotation, undefined, 'pelvis stays upright');
  assert.equal(pose.hips.offset[0], 0);
  assert.equal(pose.hips.offset[2], 0);
  assert.ok(pose.hips.offset[1] <= flat.hips.offset[1] + 1e-10, 'pelvis only lowers when reach requires it');
  assert.ok(pose.hips.offset[1] > -0.35, 'gentle slopes do not cause an extreme crouch');
  const result = {};
  for (const side of ['left', 'right']) {
    const thigh = pose[side + 'Thigh'].rotation[0], knee = pose[side + 'Shin'].rotation[0];
    assert.ok(knee >= 0 && knee < 2.8, 'anatomical knee bend');
    const shinOffset = rotateX(parts[side + 'Shin'].pivot, thigh);
    const ankleOffset = rotateX(parts[side + 'Boot'].pivot, thigh + knee);
    const ankle = [parts[side + 'Thigh'].pivot[0], parts.hips.pivot[1] + pose.hips.offset[1] + parts[side + 'Thigh'].pivot[1] + shinOffset[1] + ankleOffset[1], shinOffset[2] + ankleOffset[2]];
    const boot = parts[side + 'Boot'], matrix = pose[side + 'Boot'].matrix;
    assert.ok(matrix && matrix.length === 16 && matrix.every(Number.isFinite));
    const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(p => rotateX(transform(p, matrix), thigh + knee));
    for (const axis of axes) assert.ok(Math.abs(Math.hypot(...axis) - 1) < 1e-10, 'ankle rotation preserves mesh dimensions');
    assert.ok(axes[1][1] > 0.65, 'boot tilt is bounded');
    let min = Infinity;
    for (const sx of [-1, 0, 1]) for (const sz of [-1, 0, 1]) {
      const p = [boot.center[0] + sx * boot.size[0] / 2, boot.center[1] - boot.size[1] / 2, boot.center[2] + sz * boot.size[2] / 2];
      const offset = rotateX(transform(p, matrix), thigh + knee);
      const corner = offset.map((value, i) => value + ankle[i]);
      const clearance = corner[1] - ground(corner[0], corner[2]);
      min = Math.min(min, clearance);
      assert.ok(clearance >= 0.0049, `sole penetration: ${side}, weight ${weight}, time ${time}, clearance ${clearance}`);
    }
    const phase = ((time / model.runCycleDuration + (side === 'left' ? 0 : 0.5)) % 1 + 1) % 1;
    if (weight === 0 || phase < 0.38) assert.ok(Math.abs(min - 0.005) < 1e-8, 'support foot maintains contact while the torso breathes/bobs');
    result[side] = { clearance: min, ankle, axes };
  }
  return { pose, ...result };
}

for (const [sx, sz] of [[0, 0], [0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4], [0.3, -0.3]]) {
  const ground = (x, z) => sx * x + sz * z;
  for (const weight of [0, 0.25, 0.5, 0.75, 1]) for (let tick = 0; tick < 60; tick++) {
    const result = checkPose(tick / 60 * model.runCycleDuration, weight, ground);
    if (weight === 0) {
      const normal = [-sx, 1, -sz], length = Math.hypot(...normal);
      for (const side of ['left', 'right']) for (let i = 0; i < 3; i++) {
        assert.ok(Math.abs(result[side].axes[1][i] - normal[i] / length) < 1e-10, 'idle boot aligns to forward and cross slopes');
      }
    }
  }
}
const lateral = checkPose(0, 0, (x, z) => 0.4 * x);
assert.ok(lateral.right.ankle[1] > lateral.left.ankle[1] + 0.1, 'each foot has its own height');
assert.ok(lateral.pose.hips.offset[1] < -0.03, 'pelvis lowers for the downhill foot');
const breathing = checkPose(0.35, 0, (x, z) => 0.4 * x);
for (const side of ['left', 'right']) for (let i = 0; i < 3; i++) {
  assert.ok(Math.abs(lateral[side].ankle[i] - breathing[side].ankle[i]) < 1e-10, 'idle breathing does not move planted feet');
}
const swing = checkPose(model.runCycleDuration * 0.65, 1, (x, z) => -0.3 * z);
assert.ok(swing.left.clearance > 0.20, 'swing foot remains lifted above sloping terrain');

for (const [x, z] of [[0, 0], [-6, -3], [-4, -6], [5, 1], [7, 4], [4, -1], [1, -7]]) {
  const base = terrain.heightAt(x, z);
  for (const yaw of [0, 0.8, 2.4]) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const ground = (lx, lz) => terrain.heightAt(x + c * lx + s * lz, z - s * lx + c * lz) - base;
    for (const weight of [0, 0.5, 1]) for (let tick = 0; tick < 30; tick++) checkPose(tick / 30 * model.runCycleDuration, weight, ground);
  }
}
// Terrain motion and phase transitions must not introduce abrupt pose jumps.
const ground = (x, z) => 0.25 * x - 0.3 * z;
for (const seam of [0, 0.38, 0.5, 0.88, 1]) {
  const before = model.samplePose((seam - 1e-5) * model.runCycleDuration, 1, ground);
  const after = model.samplePose((seam + 1e-5) * model.runCycleDuration, 1, ground);
  for (const name of ['hips', 'leftThigh', 'rightThigh', 'leftShin', 'rightShin', 'leftBoot', 'rightBoot']) {
    for (const key of Object.keys(before[name])) {
      for (let i = 0; i < before[name][key].length; i++) assert.ok(Math.abs(before[name][key][i] - after[name][key][i]) < 0.002, 'continuous IK at gait boundaries');
    }
  }
}
console.log('Foot IK: upright torso, separate ground contact, boot pitch/roll, pelvis reach, swing clearance, hills/headings and continuous gait checked.');
