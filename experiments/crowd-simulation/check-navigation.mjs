import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
for (const file of ['crowd-terrain.js', 'crowd-navigation.js', 'crowd-core.js']) vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), context);
const { nav, terrain, core } = vm.runInContext('({ nav: CrowdNavigation, terrain: CrowdTerrain, core: CrowdSimulation })', context);
assert.equal(nav.cells, 48);
assert.ok(nav.canStand(0, 0));
for (const [x, z] of [[11, 0], [-11, 0], [0, 11], [0, -11], [11, 11], [2.5, 0]]) {
  assert.equal(nav.canStand(x, z), false, 'rock and steep rim are blocked');
  assert.equal(nav.buildField({ x, z }), null, 'blocked goals do not generate a flow field');
}
const obstacle = nav.obstacles[0];
for (let i = 0; i < nav.walkable.length; i++) {
  const p = nav.pointAt(i);
  if (!nav.walkable[i]) continue;
  for (const dx of [-0.249, 0, 0.249]) for (const dz of [-0.249, 0, 0.249]) {
    assert.ok(terrain.slopeAt(p.x + dx, p.z + dz) <= nav.maxSlope, 'walkable cells cover only physical gentle triangles');
    const cx = Math.max(obstacle.x - obstacle.width / 2, Math.min(obstacle.x + obstacle.width / 2, p.x + dx));
    const cz = Math.max(obstacle.z - obstacle.depth / 2, Math.min(obstacle.z + obstacle.depth / 2, p.z + dz));
    assert.ok(Math.hypot(p.x + dx - cx, p.z + dz - cz) >= nav.radius, 'whole cell has body clearance from the rendered obstacle');
  }
  for (let n = 0; n < 8; n++) {
    const next = nav.neighbours[i * 8 + n];
    if (next < 0) continue;
    const q = nav.pointAt(next);
    assert.ok(nav.canTravel(p.x, p.z, q.x, q.z), 'graph edges do not cut blocked corners');
  }
}
assert.equal(nav.canTravel(0, 0, 6, 0), false, 'direct route is obstructed');
for (const goal of [{ x: 6, z: 0 }, { x: -6, z: -2 }, { x: 0, z: 7 }]) {
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
  const slots = nav.places(goal, 20, field);
  assert.equal(slots.length, 20);
  for (let i = 0; i < slots.length; i++) {
    const a = slots[i];
    assert.ok(nav.canTravel(goal.x, goal.z, a.x, a.z), 'final slots are visible from the shared goal area');
    for (let j = i + 1; j < slots.length; j++) assert.ok(Math.hypot(a.x - slots[j].x, a.z - slots[j].z) >= 4 * nav.radius, 'parking leaves room to pass');
  }
}
const full = core.createWorld();
for (let i = 0; i <= nav.spawnSites.length; i++) core.spawnMarine(full);
assert.ok(full.marines.length > 30);
const snapshot = JSON.stringify(full);
assert.equal(core.spawnMarine(full), null, 'finite map capacity fails gracefully');
assert.equal(JSON.stringify(full), snapshot);
core.update(full, 1 / 60);
assert.ok(full.stats.neighbourChecks < full.marines.length * (full.marines.length - 1) / 2, 'spread idle crowd uses local buckets, not all-pairs collision checks');
console.log(`Navigation: ${nav.cells}×${nav.cells} shared grid, exact slope/footprint clearance, deterministic Dijkstra, safe flow edges, parking lanes, capacity and local neighbour search checked.`);
