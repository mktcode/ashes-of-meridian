import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
for (const file of ['marine-model.js', 'crowd-terrain.js', 'crowd-navigation.js', 'crowd-recovery.js', 'crowd-core.js', 'marine-instances.js']) vm.runInThisContext(readFileSync(new URL(file, import.meta.url), 'utf8'));
const { model, terrain, core, renderer } = vm.runInThisContext('({ model: MarineModel, terrain: CrowdTerrain, core: CrowdSimulation, renderer: MarineInstances })');
const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
}
const translate = p => { const m = identity(); m.splice(12, 3, ...p); return m; };
function rotate([x, y, z]) {
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  return multiply(multiply([cz, sz, 0, 0, -sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], [cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1]), [1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1]);
}
function oracle(m, pose) {
  const root = multiply(translate([m.x, m.y, m.z]), rotate([0, m.yaw, 0])), joints = {}, packed = [];
  for (const p of model.parts) {
    const animation = pose[p.name] || {}, offset = animation.offset || [0, 0, 0];
    const local = multiply(translate(p.pivot.map((v, i) => v + offset[i])), animation.matrix || rotate(animation.rotation || [0, 0, 0]));
    const joint = multiply(p.parent ? joints[p.parent] : root, local); joints[p.name] = joint;
    const scale = identity(); [scale[0], scale[5], scale[10]] = p.size;
    packed.push(...multiply(multiply(joint, translate(p.center)), scale).map(Math.fround), ...p.color.map(Math.fround));
  }
  return packed;
}
const batch = renderer.create(), world = core.createWorld();
for (const [x, z] of [[0, 0], [-3, -2], [5, 4], [60.4, 0]]) for (const yaw of [0, 0.4, -2.7]) for (const run of [0, 0.35, 1]) for (const time of [0, 0.15, 0.4, 1.3]) {
  const m = core.createMarine(x, z); Object.assign(m, { yaw, runWeight: run, time });
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const ground = (lx, lz) => terrain.heightAt(x + c * lx + s * lz, z - s * lx + c * lz) - m.y;
  const pose = model.samplePose(time, run, ground), expected = oracle(m, pose);
  batch.begin(model.parts.length); batch.marine(m);
  assert.equal(batch.count, model.parts.length);
  for (let i = 0; i < expected.length; i++) assert.ok(Math.abs(batch.data[i] - expected[i]) < 1e-5, 'packed affine rig preserves original Euler hierarchy, pelvis and independent boot matrices');
  for (let i = 0; i < model.parts.length; i++) {
    const a = batch.data.subarray(i * renderer.stride, i * renderer.stride + 16);
    for (const lx of [-0.5, 0.5]) for (const ly of [-0.5, 0.5]) for (const lz of [-0.5, 0.5]) {
      const px = a[0] * lx + a[4] * ly + a[8] * lz + a[12], py = a[1] * lx + a[5] * ly + a[9] * lz + a[13], pz = a[2] * lx + a[6] * ly + a[10] * lz + a[14];
      assert.ok(Math.hypot(px - m.x, py - m.y, pz - m.z) <= renderer.radius, 'culling sphere contains actual animated boxes');
    }
  }
}
const data = batch.data; batch.begin(1); assert.equal(batch.data, data, 'reuse buffers without shrinking/reallocating each frame');
const m = core.createMarine(-3, -2), pose = model.samplePose(0.3, 0.4); pose.chest.rotation[1] += 0.2;
const frozen = JSON.stringify(m); batch.begin(model.parts.length); batch.marine(m, pose);
assert.equal(JSON.stringify(m), frozen, 'externally composed animation never mutates movement state');
const expected = oracle(m, pose); for (let i = 0; i < expected.length; i++) assert.ok(Math.abs(batch.data[i] - expected[i]) < 1e-5);
const camera = core.cameraFrame(0.55, 0.9, 20, 1160, 700, { x: m.x, z: m.z });
assert.ok(renderer.visible(m, camera)); assert.equal(renderer.visible(core.createMarine(50, -50), camera), false);
console.log('Instances: old-hierarchy matrix oracle, terrain boots/pelvis, all gait weights, animated bounds, buffer reuse, culling and independent animation composition checked.');
