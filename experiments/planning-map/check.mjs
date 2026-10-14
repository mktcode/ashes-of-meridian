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
function checkRamps(plan) {
  const ramps = sandbox.buildRoadRamps(plan);
  const differingRoads = plan.edges.filter((edge) => plan.cells[edge.a].offset !== plan.cells[edge.b].offset);
  assert.equal(ramps.length, differingRoads.length, 'one ramp per height-changing road');
  for (const ramp of ramps) {
    const high = plan.cells.find((cell) => cell.id === ramp.highCellId);
    const low = plan.cells.find((cell) => cell.id === ramp.lowCellId);
    const highRegion = plan.regions[plan.cells.indexOf(high)];
    assert.equal(high.offset - low.offset, 8);
    assert.equal(ramp.run, ramp.greenDistance / 2, 'ends halfway along the exposed road');
    assert.ok(ramp.run > 0);
    const area = sandbox.polygonArea(ramp.points);
    assert.ok(Math.abs(sandbox.polygonArea(sandbox.clipPolygon(ramp.points, high.points)) - area) < 1e-6, 'entire ramp inside higher cell');
    assert.ok(sandbox.polygonArea(sandbox.clipPolygon(ramp.points, low.points)) < 1e-6, 'no ramp in lower cell');
    assert.ok(sandbox.polygonArea(sandbox.clipPolygon(highRegion.points, ramp.points)) < 1e-6, 'green footprint untouched');
    for (const p of ramp.points.slice(0, 2)) assert.ok(Math.abs(sandbox.rampHeight(ramp, p) - ramp.lowHeight) < 1e-8, 'continuous lower lip');
    for (const p of ramp.points.slice(2)) assert.ok(Math.abs(sandbox.rampHeight(ramp, p) - ramp.highHeight) < 1e-8, 'continuous upper lip');
    const midpoint = { x: ramp.crossing.x + ramp.direction.x * ramp.run / 2, y: ramp.crossing.y + ramp.direction.y * ramp.run / 2 };
    assert.ok(Math.abs(sandbox.rampHeight(ramp, midpoint) - (ramp.lowHeight + ramp.highHeight) / 2) < 1e-8, 'linear slope');
  }
  for (const cell of plan.cells) {
    const cuts = ramps.filter((ramp) => ramp.highCellId === cell.id);
    let plateaus = [cell.points];
    for (const cut of cuts) plateaus = plateaus.flatMap((polygon) => sandbox.subtractPolygon(polygon, cut.points));
    const area = plateaus.reduce((sum, polygon) => sum + sandbox.polygonArea(polygon), 0) + cuts.reduce((sum, ramp) => sum + sandbox.polygonArea(ramp.points), 0);
    assert.ok(Math.abs(area - sandbox.polygonArea(cell.points)) < 1e-5, 'no overlapping cuts or missing plateau area');
    for (const cut of cuts) for (const polygon of plateaus) assert.ok(sandbox.polygonArea(sandbox.clipPolygon(polygon, cut.points)) < 1e-6, 'no horizontal lid over ramp');
  }
  return ramps.length;
}
for (const seed of [0, 2, 42, 4294967295]) {
  for (const curved of [false, true]) {
      const options = { curved };
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
        if (geometry.has(key)) assert.equal(signature, geometry.get(key), 'display options preserve cell heights and lattice');
        geometry.set(key, signature);
      }
      assert.equal(plan.edges.filter((edge) => !edge.loop).length, 18);
      assert.equal(plan.edges.filter((edge) => edge.loop).length, 6);
      assert.deepEqual(Object.keys(plan).sort(), ['border', 'cells', 'edges', 'heightSteps', 'regions', 'seed', 'warp'], 'plan contains only active planning data');
      const reachable = new Set([0]);
      for (let pass = 0; pass < plan.regions.length; pass++) {
        for (const edge of plan.edges) {
          if (reachable.has(edge.a)) reachable.add(edge.b);
          if (reachable.has(edge.b)) reachable.add(edge.a);
        }
      }
      assert.equal(reachable.size, plan.regions.length, 'roads connect all regions');
      const beforeDrawing = JSON.stringify(plan);
      const rampCount = checkRamps(plan);
      const mesh = sandbox.buildPlanningMesh(plan);
      if (rampCount) {
        let slopedRoad = false;
        for (let i = 0; i < mesh.triangles.length; i += 18) {
          const color = mesh.triangles[i + 3];
          if (Math.abs(color - 0.8) < 1e-6 || Math.abs(color - 0.66) < 1e-6) {
            if (Math.abs(mesh.triangles[i + 2] - mesh.triangles[i + 8]) > 1e-4) slopedRoad = true;
          }
        }
        assert.ok(slopedRoad, 'road mesh follows ramp slope');
      }
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
// Exhaust every possible outer peak, not just those selected by the test seeds.
const template = sandbox.makePlan(2, { curved: false });
for (const peakId of template.cells.filter((cell) => ring(cell) === 2).map((cell) => cell.id)) {
  const cells = JSON.parse(JSON.stringify(template.cells));
  checkHeights(cells, sandbox.assignSteppedHeights(cells, cells.find((cell) => cell.id === peakId)));
}
// More deterministic layouts exercise road jitter and nearby ramp cuts without meshing.
for (let seed = 3; seed < 35; seed++) checkRamps(sandbox.makePlan(seed));
const levelPlan = JSON.parse(JSON.stringify(template));
for (const cell of levelPlan.cells) cell.offset = 0;
assert.equal(sandbox.buildRoadRamps(levelPlan).length, 0, 'level roads need no ramp');
const low = sandbox.project3D({ x: 150, y: 150 }, 8);
const high = sandbox.project3D({ x: 150, y: 150 }, 40);
assert.ok(high.y < low.y, 'higher offsets project visibly upwards');
assert.equal(high.x, low.x);
console.log('Planning map: 8 deterministic plans, all 12 outer peaks, fixed height steps, guaranteed ascents, high-cell-only road ramps, topology and 3D meshes passed.');
