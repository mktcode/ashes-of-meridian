import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const core = readFileSync(new URL('./planning-core.js', import.meta.url), 'utf8');
const view = readFileSync(new URL('./planning-view.js', import.meta.url), 'utf8');
const sandbox = vm.createContext({});
vm.runInContext(`${core}\n${view}`, sandbox);
const geometry = new Map();
const ring = (cell) => Math.max(Math.abs(cell.q), Math.abs(cell.r), Math.abs(cell.q + cell.r));
function checkHeights(cells, heightSteps) {
  assert.equal(heightSteps.step, 8);
  const peak = cells.find((cell) => cell.id === heightSteps.peakCellId);
  assert.equal(ring(peak), 2, 'peak is on outer ring');
  assert.equal(cells.filter((cell) => cell.offset === 16).length, 1, 'unique maximum');
  const minimum = Math.min(...cells.map((cell) => cell.offset));
  assert.equal(minimum, -16);
  assert.ok(cells.filter((cell) => cell.offset === minimum).every((cell) => ring(cell) === 2), 'all minima outside');
  let branching = false;
  for (const cell of cells) {
    // Independent axial-distance oracle for this convex, hole-free hex grid.
    const dq = cell.q - peak.q, dr = cell.r - peak.r;
    assert.equal(cell.distanceToPeak, (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2);
    assert.equal(cell.offset, 16 - cell.distanceToPeak * 8);
    const neighbors = cells.filter((other) => sandbox.latticeNeighbor(cell, other));
    for (const neighbor of neighbors) assert.ok([0, 8].includes(Math.abs(cell.offset - neighbor.offset)), 'no multi-step cliffs');
    const higher = neighbors.filter((other) => other.offset === cell.offset + 8);
    if (cell !== peak) assert.ok(higher.length > 0, 'every non-peak has an ascent');
    if (higher.length > 1) branching = true;
    let current = cell, steps = 0;
    while (current !== peak) {
      current = cells.find((other) => sandbox.latticeNeighbor(current, other) && other.offset === current.offset + 8);
      assert.ok(current, 'continuous stepwise ascent exists');
      assert.ok(++steps < cells.length, 'no ascent cycle');
    }
    assert.equal(steps, cell.distanceToPeak);
  }
  assert.ok(branching, 'alternative ascending routes exist');
}
for (const seed of [0, 2, 42, 4294967295]) {
  for (const curved of [false, true]) {
    for (const rounded of [false, true]) {
      const options = { curved, rounded };
      const plan = sandbox.makePlan(seed, options);
      assert.equal(JSON.stringify(plan), JSON.stringify(sandbox.makePlan(seed, options)));
      assert.equal(plan.regions.length, 19);
      assert.equal(plan.cells.length, 19);
      checkHeights(plan.cells, plan.heightSteps);
      assert.ok(plan.regions.every((region) => !('offset' in region)), 'green footprints own no height offset');
      for (const [index, cell] of plan.cells.entries()) {
        assert.ok(cell.offset >= -16 && cell.offset <= 16);
        assert.equal(cell.q, plan.regions[index].q);
        assert.equal(cell.r, plan.regions[index].r);
        assert.equal(cell.points.length, 6);
        for (const point of cell.points) assert.ok(Math.abs(Math.hypot(point.x - cell.x, point.y - cell.y) - 53 / Math.sqrt(3)) < 1e-8);
        const points = sandbox.clipPolygon(plan.regions[index].points, cell.points);
        assert.equal(points.length, plan.regions[index].points.length, 'entire green footprint fits its lattice cell');
        const key = `${seed}:${index}`;
        const signature = JSON.stringify({ points: cell.points, offset: cell.offset });
        if (geometry.has(key)) assert.equal(signature, geometry.get(key), 'display/river options preserve cell heights and lattice');
        geometry.set(key, signature);
      }
      assert.equal(plan.edges.filter((edge) => !edge.loop).length, 18);
      assert.equal(plan.edges.filter((edge) => edge.loop).length, 6);
      assert.equal(plan.landforms, undefined);
      const retained = new Set(plan.river.bridges.map((bridge) => bridge.key));
      const reachable = new Set([0]);
      const crossingKeys = new Set(plan.river.selected.map((edge) => edge.key));
      for (let pass = 0; pass < plan.regions.length; pass++) {
        for (const edge of plan.edges) {
          const key = sandbox.edgeKey(edge.a, edge.b);
          if (crossingKeys.has(key) && !retained.has(key)) continue;
          if (reachable.has(edge.a)) reachable.add(edge.b);
          if (reachable.has(edge.b)) reachable.add(edge.a);
        }
      }
      assert.equal(reachable.size, plan.regions.length, 'retained bridges connect all regions');
      for (const path of plan.river.curves) {
        for (let i = 1; i < path.length; i++) {
          assert.ok(path[i].height < path[i - 1].height, 'water flows downhill');
        }
      }
      const beforeDrawing = JSON.stringify(plan);
      const mesh = sandbox.buildPlanningMesh(plan);
      assert.ok(mesh.triangles.length > 0 && mesh.lines.length > 0);
      assert.equal(mesh.triangles.length % 18, 0);
      assert.ok(mesh.triangles.every(Number.isFinite));
      assert.ok(mesh.lines.every(Number.isFinite));
      assert.equal(JSON.stringify(plan), beforeDrawing, 'meshing is read-only');
      const frame = sandbox.fixedFrame(plan);
      assert.ok(frame.scale > 0);
      for (const cell of plan.cells) for (const point of cell.outline) for (const z of [0, 24 + cell.offset]) for (const yaw of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const p = sandbox.project3D(point, z, yaw);
        assert.ok(Math.abs((p.x - frame.x) * frame.scale) <= 450);
        assert.ok(Math.abs((p.y - frame.y) * frame.scale) <= 300);
      }
    }
  }
}
// Exhaust every possible outer peak, not just those selected by the test seeds.
const template = sandbox.makePlan(2, { curved: false, rounded: false });
for (const peakId of template.cells.filter((cell) => ring(cell) === 2).map((cell) => cell.id)) {
  const cells = JSON.parse(JSON.stringify(template.cells));
  checkHeights(cells, sandbox.assignSteppedHeights(cells, cells.find((cell) => cell.id === peakId)));
}
const low = sandbox.project3D({ x: 150, y: 150 }, 8);
const high = sandbox.project3D({ x: 150, y: 150 }, 40);
assert.ok(high.y < low.y, 'higher offsets project visibly upwards');
assert.equal(high.x, low.x);
console.log('Planning map: 16 deterministic plans, all 12 outer peaks, fixed height steps, guaranteed ascents, lattice geometry, topology and 3D meshes passed.');
