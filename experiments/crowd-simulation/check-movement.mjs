import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('./crowd-core.js', import.meta.url), 'utf8') + '\nthis.core = CrowdSimulation;', context);
const core = context.core;
const world = core.createWorld();
const marine = world.marines[0];
assert.equal(world.destination, null);
core.update(world, 0.5);
assert.equal(marine.x, 0);
assert.equal(marine.z, 0);
assert.equal(marine.runWeight, 0);
assert.equal(marine.moving, false);
assert.ok(core.moveTo(world, { x: 3, z: 4 }));
let previousDistance = 5;
for (let tick = 0; tick < 400; tick++) {
  core.update(world, 1 / 60);
  const distance = Math.hypot(3 - marine.x, 4 - marine.z);
  assert.ok(distance <= previousDistance, 'movement never overshoots');
  assert.ok(Math.abs(4 * marine.x - 3 * marine.z) < 1e-10, 'straight path');
  assert.ok(marine.runWeight >= 0 && marine.runWeight <= 1);
  assert.ok(Math.abs(marine.yaw - Math.atan2(3, 4)) < 1e-10, 'model faces the destination');
  previousDistance = distance;
}
assert.equal(marine.x, 3);
assert.equal(marine.z, 4);
assert.equal(marine.moving, false);
assert.ok(marine.runWeight < 1e-8, 'idle blends in after arrival');

core.moveTo(world, { x: 10, z: 0 });
core.update(world, 0.25);
assert.ok(marine.moving && marine.runWeight > 0);
const beforeRedirect = { x: marine.x, z: marine.z };
core.moveTo(world, { x: -3, z: -4 });
core.update(world, 0.1);
assert.ok(marine.x < beforeRedirect.x && marine.z < beforeRedirect.z, 'new command redirects immediately');
const frozen = JSON.stringify(world);
for (const dt of [0, -1, NaN, Infinity]) core.update(world, dt);
assert.equal(JSON.stringify(world), frozen, 'pause and invalid deltas do not advance movement or animation');
for (const point of [null, { x: NaN, z: 0 }, { x: 0, z: Infinity }, { x: core.halfSize + 1, z: 0 }]) {
  assert.equal(core.moveTo(world, point), false);
  assert.equal(JSON.stringify(world), frozen, 'invalid commands preserve the existing destination');
}

world.marines.push(core.createMarine(-5, 7), core.createMarine(2, -1));
core.moveTo(world, { x: 1, z: 1 });
assert.ok(world.marines.every(unit => unit.moving), 'commands apply to every marine, without selection');
core.update(world, 100);
core.update(world, 1);
for (const unit of world.marines) {
  assert.equal(unit.x, 1);
  assert.equal(unit.z, 1);
  assert.equal(unit.moving, false);
  assert.ok(unit.runWeight < 0.001);
}
core.moveTo(world, { x: 1, z: 1 });
assert.ok(world.marines.every(unit => !unit.moving), 'same-position commands remain idle');

const slow = core.createWorld(), fast = core.createWorld();
core.moveTo(slow, { x: 11, z: 0 });
core.moveTo(fast, { x: 11, z: 0 });
for (let tick = 0; tick < 30; tick++) {
  core.update(slow, 1 / 60);
  core.update(fast, 2 / 60);
}
assert.ok(fast.marines[0].x > slow.marines[0].x, 'scaled tempo affects movement');
assert.ok(Math.abs(fast.marines[0].time - slow.marines[0].time * 2) < 1e-10, 'animation uses the same clock');

const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
for (const [width, height] of [[1200, 600], [400, 700]]) {
  for (const yaw of [-1.3, 0.55, Math.PI / 2]) for (const pitch of [0.35, 0.9, 1.35]) for (const zoom of [0.7, 1, 3]) {
    const camera = core.cameraFrame(yaw, pitch, zoom, width, height);
    for (const [x, z] of [[0, 0], [5, -8], [-11, 11], [13, 0]]) {
      const p = [x, 0, z];
      const point = core.groundPoint(dot(p, camera.right) * camera.scale[0], dot(p, camera.up) * camera.scale[1], camera);
      if (Math.abs(x) > core.halfSize) assert.equal(point, null, 'off-field clicks do not command');
      else {
        assert.ok(Math.abs(point.x - x) < 1e-10 && Math.abs(point.z - z) < 1e-10, 'ground picking inverts rotated/zoomed camera projection');
      }
    }
    const hidpi = core.cameraFrame(yaw, pitch, zoom, width * 2, height * 2);
    assert.equal(hidpi.scale[0], camera.scale[0]);
    assert.equal(hidpi.scale[1], camera.scale[1]);
  }
}
assert.equal(core.groundPoint(0, 0, core.cameraFrame(0, 0, 1, 800, 600)), null, 'edge-on camera cannot pick the floor');
console.log('Movement: shared commands, facing, exact arrival/idle, redirect, pause/tempo, bounds and ground picking checked.');
