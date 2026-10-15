import { fixture } from './fixture.mjs';
import assert from 'node:assert/strict';

const { core, nav, terrain, createFixtureWorld } = fixture();
function advance(world, seconds) {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) core.update(world, 1 / 60);
}
function valid(world) {
  for (const marine of world.units) {
    assert.ok(nav.canStand(marine.x, marine.z), 'movement stays on walkable cells');
    assert.equal(marine.y, terrain.heightAt(marine.x, marine.z));
    assert.ok(Number.isFinite(marine.yaw) && marine.movementBlend >= 0 && marine.movementBlend <= 1);
  }
  for (let i = 0; i < world.units.length; i++) for (let j = i + 1; j < world.units.length; j++) {
    const a = world.units[i], b = world.units[j];
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= nav.radius * 2 - 0.02, 'moving bodies remain separated within the short solver tolerance');
  }
}
function arrive(world, seconds = 40) {
  for (let i = 0; i < seconds * 60; i++) {
    core.update(world, 1 / 60); valid(world);
    if (world.units.every(m => !m.moving && m.movementBlend < 0.001)) return;
  }
  assert.fail(`Crowd did not settle: ${JSON.stringify(world.units.filter(m => m.moving).map(m => ({ x: m.x, z: m.z, target: m.target })))}`);
}
const world = createFixtureWorld(), marine = world.units[0];
advance(world, 0.5);
assert.equal(marine.x, 0); assert.equal(marine.z, 0); assert.equal(marine.moving, false); assert.equal(marine.movementBlend, 0);
assert.ok(core.moveTo(world, { x: 6, z: 0 }));
const field = world.groups[0].field;
let detour = 0;
for (let tick = 0; tick < 900; tick++) {
  core.update(world, 1 / 60); valid(world);
  detour = Math.max(detour, Math.abs(marine.z));
  assert.equal(world.groups[0].field, field, 'field is reused, not rebuilt as units move');
}
assert.ok(detour >= 3.5, 'flow field detours around the rock instead of walking through it');
assert.equal(marine.x, 6); assert.equal(marine.z, 0); assert.equal(marine.moving, false);
assert.ok(marine.movementBlend < 0.001);
assert.equal(world.stats.fieldBuilds, 1);
assert.ok(core.moveTo(world, { x: 6, z: 0 }));
assert.equal(world.stats.fieldBuilds, 1, 'identical command does not rebuild the field');
const frozen = JSON.stringify(world);
for (const dt of [0, -1, NaN, Infinity]) core.update(world, dt);
for (const point of [null, { x: NaN, z: 0 }, { x: 0, z: Infinity }, { x: nav.bounds.maxX + 1, z: 0 }, { x: 2.5, z: 0 }, { x: nav.bounds.maxX - 1, z: 0 }]) {
  assert.equal(core.moveTo(world, point), false);
}
assert.equal(JSON.stringify(world), frozen, 'pause/invalid commands preserve movement, field and destination');

const crowd = createFixtureWorld();
for (let i = 0; i < 19; i++) assert.ok(core.spawnAgent(crowd));
assert.equal(crowd.units.length, 20);
valid(crowd);
for (let i = 0; i < crowd.units.length; i++) for (let j = i + 1; j < crowd.units.length; j++) {
  assert.ok(Math.hypot(crowd.units[i].x - crowd.units[j].x, crowd.units[i].z - crowd.units[j].z) >= nav.radius * 2, 'spawn respects existing bodies');
}
assert.ok(core.moveTo(crowd, { x: 6, z: 0 }));
advance(crowd, 0.5);
const oldTargets = crowd.units.map(m => m.target), oldField = crowd.groups[0].field;
assert.ok(core.spawnAgent(crowd));
assert.equal(crowd.groups[0].field, oldField, 'spawn inherits the field without a new Dijkstra search');
assert.ok(crowd.units.at(-1).moving);
for (let i = 0; i < oldTargets.length; i++) assert.equal(crowd.units[i].target, oldTargets[i], 'spawning does not reshuffle reserved slots');
arrive(crowd);
assert.equal(crowd.stats.fieldBuilds, 1);
for (let i = 0; i < crowd.units.length; i++) {
  const a = crowd.units[i];
  assert.equal(a.x, a.target.x); assert.equal(a.z, a.target.z);
  for (let j = i + 1; j < crowd.units.length; j++) {
    const b = crowd.units[j];
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= nav.radius * 2, 'arrived bodies do not overlap');
  }
}
const settled = crowd.units.map(m => [m.x, m.z]);
advance(crowd, 1);
assert.deepEqual(crowd.units.map(m => [m.x, m.z]), settled, 'arrival does not jitter');
assert.ok(core.moveTo(crowd, { x: -6, z: -2 }));
arrive(crowd);
assert.equal(crowd.stats.fieldBuilds, 2, 'redirect rebuilds one shared field');
const parkedTargets = crowd.units.map(m => m.target), parkedPositions = crowd.units.map(m => [m.x, m.z]);
assert.ok(core.spawnAgent(crowd), 'spawn works after the crowd has arrived');
arrive(crowd);
for (let i = 0; i < parkedTargets.length; i++) {
  assert.equal(crowd.units[i].target, parkedTargets[i], 'late arrival does not steal an occupied reservation');
  assert.deepEqual([crowd.units[i].x, crowd.units[i].z], parkedPositions[i], 'late arrival does not displace parked bodies');
}

const overlap = createFixtureWorld();
overlap.units.push(core.createAgent());
advance(overlap, 0.25);
assert.ok(Math.hypot(overlap.units[0].x - overlap.units[1].x, overlap.units[0].z - overlap.units[1].z) >= nav.radius * 2 - 1e-4, 'coincident bodies have a deterministic escape direction');
valid(overlap);
const distant = createFixtureWorld();
assert.ok(core.moveTo(distant, { x: 48, z: -46 }), 'new map area is reachable');
arrive(distant, 90);
assert.equal(distant.units[0].x, 48); assert.equal(distant.units[0].z, -46);
const converging = createFixtureWorld();
converging.units = Array.from({ length: 16 }, (_, i) => core.createAgent(10 * Math.cos(i * Math.PI / 8), 10 * Math.sin(i * Math.PI / 8)));
valid(converging);
assert.ok(core.moveTo(converging, { x: 0, z: 0 }));
arrive(converging);
const slow = createFixtureWorld(), fast = createFixtureWorld();
core.moveTo(slow, { x: -6, z: 0 }); core.moveTo(fast, { x: -6, z: 0 });
for (let i = 0; i < 30; i++) { core.update(slow, 1 / 60); core.update(fast, 2 / 60); }
assert.ok(fast.units[0].x < slow.units[0].x, 'tempo affects movement');
assert.ok(Math.abs(fast.units[0].time - slow.units[0].time * 2) < 1e-10);
const regular = createFixtureWorld(), batched = createFixtureWorld();
core.moveTo(regular, { x: 6, z: 0 }); core.moveTo(batched, { x: 6, z: 0 });
for (let i = 0; i < 120; i++) core.update(regular, 1 / 60);
for (let i = 0; i < 60; i++) core.update(batched, 1 / 30);
assert.deepEqual(regular.units, batched.units, 'fixed-step behaviour does not depend on render batching');
const capped = createFixtureWorld();
core.update(capped, 100);
assert.equal(capped.stats.steps, 15, 'a stalled frame has a bounded catch-up budget');

const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
for (const [width, height] of [[1200, 600], [400, 700]]) {
  for (const yaw of [-1.3, 0.55, Math.PI / 2]) for (const pitch of [0.35, 0.9, 1.35]) for (const zoom of [0.7, 1, 3]) {
    const camera = core.cameraFrame(yaw, pitch, zoom, width, height);
    for (const [x, z] of [[0, 0], [5, -8], [-11, 11]]) {
      const p = [x, terrain.heightAt(x, z), z];
      const point = terrain.pick(dot(p, camera.right) * camera.scale[0], dot(p, camera.up) * camera.scale[1], camera);
      assert.ok(point);
      const hit = [point.x, point.y, point.z];
      assert.ok(Math.abs(dot(hit, camera.right) - dot(p, camera.right)) < 1e-8 && Math.abs(dot(hit, camera.up) - dot(p, camera.up)) < 1e-8);
      assert.ok(dot(hit, camera.eye) >= dot(p, camera.eye) - 1e-8);
    }
    const hidpi = core.cameraFrame(yaw, pitch, zoom, width * 2, height * 2);
    assert.equal(hidpi.scale[0], camera.scale[0]); assert.equal(hidpi.scale[1], camera.scale[1]);
  }
}
const camera = core.cameraFrame(0.55, 0.9, 1, 1000, 700);
for (const x of [-terrain.halfSize, terrain.halfSize]) for (const z of [-terrain.halfSize, terrain.halfSize]) {
  const corner = [x, terrain.heightAt(x, z), z];
  assert.ok(Math.abs(dot(corner, camera.right) * camera.scale[0]) < 0.95 && Math.abs(dot(corner, camera.up) * camera.scale[1]) < 0.95, 'default camera frames the enlarged map including the mountain rim');
}
for (const box of nav.obstacles) {
  const top = [box.x, box.baseY + box.height, box.z];
  const blocked = core.groundPoint(dot(top, camera.right) * camera.scale[0], dot(top, camera.up) * camera.scale[1], camera);
  assert.equal(blocked.x, box.x); assert.equal(blocked.z, box.z);
  assert.equal(core.moveTo(world, blocked), false, 'clicking any rendered box does not issue a command behind it');
}
console.log('Movement: shared flow detour, safe spawn/slots, separation, stable arrival, redirect, pause/tempo, field reuse, bounded ticks and obstacle picking checked.');
