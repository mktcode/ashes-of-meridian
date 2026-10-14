import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('./crowd-terrain.js', import.meta.url), 'utf8'), context);
vm.runInContext(readFileSync(new URL('./crowd-core.js', import.meta.url), 'utf8') + '\nthis.core = CrowdSimulation; this.terrain = CrowdTerrain;', context);
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
  assert.equal(marine.y, context.terrain.heightAt(marine.x, marine.z), 'movement follows the triangular terrain');
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

const crowd = core.createWorld();
for (let i = 1; i <= 120; i++) {
  const unit = core.spawnMarine(crowd);
  assert.equal(crowd.marines.length, i + 1, 'each spawn adds exactly one marine');
  assert.equal(crowd.marines[i], unit);
  assert.equal(unit.moving, false, 'spawning without a destination starts idle');
  assert.equal(unit.runWeight, 0);
  assert.equal(unit.y, context.terrain.heightAt(unit.x, unit.z), 'spawn samples terrain height');
  assert.ok(Math.abs(unit.x) <= core.halfSize - 1 && Math.abs(unit.z) <= core.halfSize - 1, 'spawn stays inside the field even with many units');
}
assert.equal(new Set(crowd.marines.map(unit => `${unit.x},${unit.z}`)).size, crowd.marines.length, 'initial spawn positions are distributed');
core.moveTo(crowd, { x: 6, z: -5 });
core.update(crowd, 0.25);
const existingUnits = JSON.stringify(crowd.marines), destination = crowd.destination;
const newcomer = core.spawnMarine(crowd);
assert.equal(newcomer.moving, true, 'newcomer inherits a running command immediately');
assert.equal(crowd.destination, destination, 'spawning preserves the existing destination');
assert.equal(JSON.stringify(crowd.marines.slice(0, -1)), existingUnits, 'spawning does not mutate existing units');
const pausedCrowd = JSON.stringify(crowd);
core.update(crowd, 0);
assert.equal(JSON.stringify(crowd), pausedCrowd, 'spawning while paused does not advance any unit');
core.update(crowd, 100);
core.update(crowd, 1);
assert.ok(crowd.marines.every(unit => unit.x === 6 && unit.z === -5 && !unit.moving && unit.runWeight < 0.001), 'all spawned units reach the shared goal and return to idle');
const latecomer = core.spawnMarine(crowd);
assert.equal(latecomer.moving, true, 'destination is retained for spawns after arrival');
core.moveTo(crowd, { x: -4, z: 3 });
core.update(crowd, 100);
core.update(crowd, 1);
assert.ok(crowd.marines.every(unit => unit.x === -4 && unit.z === 3 && !unit.moving), 'redirect includes every spawned unit');
const atSpawn = core.createWorld();
const nextSpawn = core.spawnMarine(core.createWorld());
core.moveTo(atSpawn, nextSpawn);
assert.equal(core.spawnMarine(atSpawn).moving, false, 'spawn directly at the goal stays idle');

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
    for (const [x, z] of [[0, 0], [5, -8], [-11, 11], [30, 0]]) {
      const p = [x, context.terrain.heightAt(x, z), z];
      const point = core.groundPoint(dot(p, camera.right) * camera.scale[0], dot(p, camera.up) * camera.scale[1], camera);
      if (Math.abs(x) > core.halfSize) assert.equal(point, null, 'off-field clicks do not command');
      else {
        assert.ok(point, 'visible terrain ray has a hit');
        const hit = [point.x, point.y, point.z];
        assert.ok(Math.abs(dot(hit, camera.right) - dot(p, camera.right)) < 1e-8
          && Math.abs(dot(hit, camera.up) - dot(p, camera.up)) < 1e-8, 'terrain picking inverts rotated/zoomed camera projection');
        assert.equal(point.y, context.terrain.heightAt(point.x, point.z));
        assert.ok(dot(hit, camera.eye) >= dot(p, camera.eye) - 1e-8, 'nearest visible slope wins over hidden ground');
      }
    }
    const hidpi = core.cameraFrame(yaw, pitch, zoom, width * 2, height * 2);
    assert.equal(hidpi.scale[0], camera.scale[0]);
    assert.equal(hidpi.scale[1], camera.scale[1]);
  }
}
assert.equal(core.groundPoint(0, 0, core.cameraFrame(0, 0, 1, 800, 600)), null, 'edge-on camera cannot pick the floor');
console.log('Movement: crowd spawning, inherited goals, shared commands, facing, exact arrival/idle, redirect, pause/tempo, bounds and ground picking checked.');
