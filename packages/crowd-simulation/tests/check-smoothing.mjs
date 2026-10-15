import { fixture } from './fixture.mjs';
import assert from 'node:assert/strict';

const { core, nav, terrain, createFixtureWorld } = fixture();
const angle = a => Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
const world = createFixtureWorld();
for (let i = 1; i < 20; i++) core.spawnAgent(world);
assert.ok(core.moveTo(world, { x: 6, z: 0 }));
let headingJumps = 0, tick = 0;
for (; tick < 1800; tick++) {
  const old = world.units.map(m => ({ yaw: m.yaw, vx: m.vx, vz: m.vz }));
  core.update(world, 1 / 60);
  for (let i = 0; i < old.length; i++) {
    const m = world.units[i], p = old[i];
    assert.ok(angle(m.yaw - p.yaw) <= 5 / 60 + 1e-10, 'body turning has a bounded angular speed');
    assert.ok(m.clearFor >= 0 && m.clearFor <= 0.18);
    if (Math.hypot(m.vx, m.vz) > 0.2 && Math.hypot(p.vx, p.vz) > 0.2
      && angle(Math.atan2(m.vx, m.vz) - Math.atan2(p.vx, p.vz)) > Math.PI / 18) headingJumps++;
  }
  for (const alpha of [0, 0.25, 0.5, 0.75, 1]) {
    const frame = { accumulator: alpha / 60 }, rendered = world.units.map(m => core.renderAgent(frame, m));
    for (let i = 0; i < rendered.length; i++) {
      const r = rendered[i], m = world.units[i], p = m.previous;
      assert.ok(Math.abs(r.x - (p.x + (m.x - p.x) * alpha)) < 1e-10);
      assert.ok(Math.abs(r.z - (p.z + (m.z - p.z) * alpha)) < 1e-10);
      assert.ok(Math.abs(r.time - (p.time + (m.time - p.time) * alpha)) < 1e-10);
      assert.ok(r.movementBlend >= 0 && r.movementBlend <= 1);
      assert.equal(r.y, terrain.heightAt(r.x, r.z), 'interpolated body still uses authoritative terrain height');
      for (let j = i + 1; j < rendered.length; j++) {
        assert.ok(Math.hypot(r.x - rendered[j].x, r.z - rendered[j].z) >= nav.radius * 2 - 0.02, 'interpolated neighbours retain separation within solver tolerance');
      }
    }
  }
  if (world.units.every(m => !m.moving && m.movementBlend < 0.001)) break;
}
assert.ok(tick < 1800, 'smoothed crowd still arrives');
assert.ok(headingJumps < (tick + 1) * world.units.length * 0.05, 'congested detour limits repeated large steering changes');
const frozen = JSON.stringify(world);
for (let i = 0; i < 10; i++) for (const m of world.units) core.renderAgent(world, m);
assert.equal(JSON.stringify(world), frozen, 'render interpolation never advances or changes the simulation');
const seam = core.createAgent();
seam.previous.yaw = Math.PI - 0.02; seam.yaw = -Math.PI + 0.02;
assert.ok(angle(core.renderAgent({ accumulator: 1 / 120 }, seam).yaw - Math.PI) < 1e-10, 'render turning crosses the angle seam along the short arc');
console.log('Smoothing: stable avoidance, bounded body turns, sub-tick pose/position interpolation, terrain contact, neighbour spacing, pause purity and arrival checked.');
