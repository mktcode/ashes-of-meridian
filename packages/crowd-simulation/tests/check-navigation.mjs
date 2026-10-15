import { fixture } from './fixture.mjs';
import assert from 'node:assert/strict';

const { nav, terrain, core, createFixtureWorld } = fixture();
assert.deepEqual(nav.bounds, { minX: -64, minZ: -64, maxX: 64, maxZ: 64 });
assert.equal(nav.columns, 256);
assert.equal(nav.rows, 256);
assert.equal(nav.obstacles.length, 9);
assert.ok(nav.canStand(0, 0));
const rim = nav.bounds.maxX - 1;
for (const [x, z] of [[rim, 0], [-rim, 0], [0, rim], [0, -rim], [rim, rim], ...nav.obstacles.map(b => [b.x, b.z])]) {
  assert.equal(nav.canStand(x, z), false, 'rock and steep rim are blocked');
  assert.equal(nav.buildField({ x, z }), null, 'blocked goals do not generate a flow field');
}
for (let i = 0; i < nav.walkable.length; i++) {
  const p = nav.pointAt(i);
  if (!nav.walkable[i]) continue;
  for (const dx of [-0.249, 0, 0.249]) for (const dz of [-0.249, 0, 0.249]) {
    assert.ok(terrain.slopeAt(p.x + dx, p.z + dz) <= nav.maxSlope, 'walkable cells cover only physical gentle triangles');
    for (const obstacle of nav.obstacles) {
      const cx = Math.max(obstacle.x - obstacle.width / 2, Math.min(obstacle.x + obstacle.width / 2, p.x + dx));
      const cz = Math.max(obstacle.z - obstacle.depth / 2, Math.min(obstacle.z + obstacle.depth / 2, p.z + dz));
      assert.ok(Math.hypot(p.x + dx - cx, p.z + dz - cz) >= nav.radius, 'whole cell has body clearance from every rendered obstacle');
    }
  }
  for (let n = 0; n < 8; n++) {
    const next = nav.neighbours[i * 8 + n];
    if (next < 0) continue;
    const q = nav.pointAt(next);
    assert.ok(nav.canTravel(p.x, p.z, q.x, q.z), 'graph edges do not cut blocked corners');
  }
}
assert.equal(nav.canTravel(0, 0, 6, 0), false, 'direct route is obstructed');
for (const goal of [{ x: 6, z: 0 }, { x: -6, z: -2 }, { x: 0, z: 7 }, { x: -23, z: 20 }, { x: 24, z: -23 }]) {
  const field = nav.buildField(goal), again = nav.buildField(goal);
  assert.ok(field);
  assert.deepEqual(Array.from(field.cost), Array.from(again.cost), 'deterministic shortest distances');
  assert.deepEqual(Array.from(field.next), Array.from(again.next));
  for (let i = 0; i < field.cost.length; i++) {
    if (!Number.isFinite(field.cost[i])) continue;
    if (i === field.goal) { assert.equal(field.cost[i], 0); continue; }
    const next = field.next[i];
    assert.ok(next >= 0 && field.cost[next] < field.cost[i], 'every reachable cell descends to the goal, never cycles');
    const p = nav.pointAt(i), q = nav.pointAt(next);
    assert.ok(Math.abs(field.cost[i] - field.cost[next] - Math.hypot(p.x - q.x, p.z - q.z)) < 1e-10);
    const direction = nav.direction(field, p.x, p.z);
    assert.ok(Math.abs(Math.hypot(direction.x, direction.z) - 1) < 1e-6);
    assert.ok(nav.canTravel(p.x, p.z, p.x + direction.x * 0.1, p.z + direction.z * 0.1));
  }
  for (const direction of [null, { x: 1, z: 0 }, { x: 0, z: 1 }, { x: 0.6, z: 0.8 }]) {
    const slots = nav.places(goal, 20, field, direction);
    assert.equal(slots.length, 20);
    assert.deepEqual(slots, nav.places(goal, 21, field, direction).slice(0, 20), 'adding a slot preserves existing rotated reservations');
    for (let i = 0; i < slots.length; i++) {
      const a = slots[i];
      assert.ok(Number.isFinite(field.cost[nav.indexAt(a.x, a.z)]), 'final slots are reachable, including indirect routes behind rocks');
      for (let j = i + 1; j < slots.length; j++) assert.ok(Math.hypot(a.x - slots[j].x, a.z - slots[j].z) >= 4 * nav.radius - 1e-10, 'rotated parking leaves room to pass');
    }
  }
}
const full = createFixtureWorld();
full.units = nav.spawnSites.map(p => core.createAgent(p.x, p.z));
assert.ok(full.units.length > 30);
const snapshot = JSON.stringify(full);
assert.equal(core.spawnAgent(full), null, 'finite map capacity fails gracefully');
assert.equal(JSON.stringify(full), snapshot);
core.update(full, 1 / 60);
assert.ok(full.stats.neighbourChecks < full.units.length * (full.units.length - 1) / 2, 'spread idle crowd uses local buckets, not all-pairs collision checks');
console.log(`Navigation: ${nav.columns}×${nav.rows} shared grid, exact slope/footprint clearance, deterministic Dijkstra, safe flow edges, parking lanes, capacity and local neighbour search checked.`);
