import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('./marine-model.js', import.meta.url), 'utf8') + '\nthis.model = MarineModel;', context);
const { parts, samplePose } = context.model;
const names = new Set();
for (const part of parts) {
  assert.ok(!names.has(part.name), 'unique part names');
  assert.ok(part.parent === null || names.has(part.parent), 'parent precedes child');
  assert.ok(part.size.every(value => value > 0), 'non-degenerate geometry');
  names.add(part.name);
}
for (const weight of [0, 0.5, 1]) {
  for (let tick = 0; tick < 120; tick++) {
    const pose = samplePose(tick / 60, weight);
    for (const [name, transform] of Object.entries(pose)) {
      assert.ok(names.has(name));
      for (const values of Object.values(transform)) assert.ok(values.every(Number.isFinite));
    }
    assert.equal(pose.hips.offset[0], 0, 'no lateral root motion');
    assert.equal(pose.hips.offset[2], 0, 'no forward root motion');
    assert.ok(Math.abs(pose.leftThigh.rotation[0] + pose.rightThigh.rotation[0]) < 1e-12, 'opposing legs');
  }
}
assert.notDeepEqual(samplePose(0, 0), samplePose(0.3, 0), 'idle is animated');
assert.notDeepEqual(samplePose(0, 1), samplePose(0.3, 1), 'run is animated');
assert.deepEqual(samplePose(0.2, -1), samplePose(0.2, 0));
assert.deepEqual(samplePose(0.2, 2), samplePose(0.2, 1));
console.log('Marine: hierarchy, finite poses, idle/run, opposing legs and stationary root checked.');
