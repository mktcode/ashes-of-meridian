import assert from 'node:assert/strict';
import { createHeightfield, createNavigationWorld, createCrowd } from '../dist/index.js';
import { createNavigation } from '../src/navigation/navigation.js';
import { syntheticTerrain, profiles } from './synthetic-terrain.mjs';

const near = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-10, `${label}: ${a} != ${b}`);
// Barycentric coordinates and a 3D cross product form a mesh oracle independent of the sampler.
function triangleAt(options, col, row, u, v) {
  const { cellSize: size, width, depth, origin, rowOrder, diagonal, heights } = options;
  const stride = width / size + 1,
    a = row * stride + col;
  const vertex = (dx, dz) => [
    origin.x + (col + dx) * size,
    heights[a + dz * stride + dx],
    origin.z + (rowOrder === 'increasing-z' ? (row + dz) * size : depth - (row + dz) * size),
  ];
  const corners = [vertex(0, 0), vertex(1, 0), vertex(0, 1), vertex(1, 1)];
  const indices =
    diagonal === 'b-c' ? (u + v < 1 ? [0, 1, 2] : [1, 3, 2]) : u > v ? [0, 1, 3] : [0, 3, 2];
  const [p, q, r] = indices.map((i) => corners[i]);
  const x = origin.x + (col + u) * size;
  const z = origin.z + (rowOrder === 'increasing-z' ? (row + v) * size : depth - (row + v) * size);
  const den = (q[2] - r[2]) * (p[0] - r[0]) + (r[0] - q[0]) * (p[2] - r[2]);
  const w0 = ((q[2] - r[2]) * (x - r[0]) + (r[0] - q[0]) * (z - r[2])) / den;
  const w1 = ((r[2] - p[2]) * (x - r[0]) + (p[0] - r[0]) * (z - r[2])) / den;
  const e = q.map((n, i) => n - p[i]),
    f = r.map((n, i) => n - p[i]);
  const normal = [e[1] * f[2] - e[2] * f[1], e[2] * f[0] - e[0] * f[2], e[0] * f[1] - e[1] * f[0]];
  return {
    x,
    z,
    height: p[1] * w0 + q[1] * w1 + r[1] * (1 - w0 - w1),
    slope: Math.hypot(normal[0], normal[2]) / Math.abs(normal[1]),
  };
}

for (const rowOrder of ['increasing-z', 'decreasing-z'])
  for (const diagonal of ['b-c', 'a-d']) {
    const { surface, options } = syntheticTerrain({
      width: 6,
      depth: 8,
      rowOrder,
      diagonal,
      height: (x, z) => 0.2 * x * x + 0.3 * x * z + 0.4 * z * z,
    });
    assert.deepEqual(surface.bounds, { minX: 11, maxX: 17, minZ: -93, maxZ: -85 });
    assert.equal(surface.columns, 3);
    assert.equal(surface.rows, 4);
    assert.ok(Object.isFrozen(surface) && Object.isFrozen(surface.bounds));
    for (let row = 0; row < surface.rows; row++)
      for (let col = 0; col < surface.columns; col++) {
        const slopes = [];
        for (const [u, v] of [
          [0.17, 0.29],
          [0.81, 0.67],
          [0.72, 0.13],
          [0.22, 0.83],
        ]) {
          const expected = triangleAt(options, col, row, u, v);
          near(
            surface.heightAt(expected.x, expected.z),
            expected.height,
            'height matches mesh triangle',
          );
          near(
            surface.slopeAt(expected.x, expected.z),
            expected.slope,
            'slope matches mesh normal',
          );
          slopes.push(expected.slope);
        }
        const p = triangleAt(options, col, row, 0.3, 0.4);
        near(surface.cellSlopeAt(p.x, p.z), Math.max(...slopes), 'both triangles classified');
      }
    for (let row = 0; row <= surface.rows; row++)
      for (let col = 0; col <= surface.columns; col++) {
        const x = 11 + col * 2,
          z = -93 + (rowOrder === 'increasing-z' ? row : surface.rows - row) * 2;
        assert.equal(surface.heightAt(x, z), options.heights[row * 4 + col]);
        assert.ok(surface.contains(x, z));
      }
    for (const method of ['heightAt', 'slopeAt', 'cellSlopeAt']) {
      assert.throws(() => surface[method](10.999, -90), RangeError);
      assert.throws(() => surface[method](NaN, -90), RangeError);
    }
    assert.equal(surface.contains(10.999, -90), false);
    assert.equal(surface.contains(Infinity, -90), false);
  }

const input = syntheticTerrain({ width: 8, depth: 12, height: (x, z) => (x - 11) * (z + 93) });
const reversed = input.options.heights.slice(),
  stride = input.surface.columns + 1;
for (let row = 0; row <= input.surface.rows; row++)
  reversed.set(
    input.options.heights.subarray(row * stride, (row + 1) * stride),
    (input.surface.rows - row) * stride,
  );
const same = createHeightfield({
  ...input.options,
  heights: reversed,
  rowOrder: 'decreasing-z',
  diagonal: 'a-d',
});
const wrong = createHeightfield({ ...input.options, heights: reversed, rowOrder: 'decreasing-z' });
for (const [x, z] of [
  [11.4, -92.3],
  [14.3, -88.1],
  [18.2, -82.5],
]) {
  near(
    same.heightAt(x, z),
    input.surface.heightAt(x, z),
    'row reversal plus diagonal swap preserves physical surface',
  );
  near(same.slopeAt(x, z), input.surface.slopeAt(x, z), 'row reversal preserves physical slope');
}
assert.notEqual(
  wrong.heightAt(11.4, -92.3),
  same.heightAt(11.4, -92.3),
  'row reversal alone changes geometry',
);
const oldHeight = input.surface.heightAt(12, -91);
input.options.heights.fill(99);
input.options.origin.x = 999;
assert.equal(input.surface.heightAt(12, -91), oldHeight, 'input geometry and origin copied');
const clamped = createHeightfield({ width: 8, depth: 12, cellSize: 2, heights: reversed });
assert.equal(clamped.heightAt(-999, 999), clamped.heightAt(-4, 6));
assert.equal(clamped.contains(-999, 999), false, 'clamping does not extend playable bounds');

// With a-d the old two probes lie ON the diagonal and can miss its other triangle.
for (const rowOrder of ['increasing-z', 'decreasing-z'])
  for (const diagonal of ['b-c', 'a-d']) {
    const { options } = syntheticTerrain({
      width: 12,
      depth: 16,
      rowOrder,
      diagonal,
      height: () => 0,
    });
    options.heights[4 * 7 + 3] = 2;
    const surface = createHeightfield(options),
      nav = createNavigation(surface, [], profiles, 2);
    for (let i = 0; i < nav.walkable.length; i++)
      if (nav.walkable[i]) {
        const p = nav.pointAt(i);
        for (let dz = -1; dz <= 1; dz++)
          for (let dx = -1; dx <= 1; dx++)
            assert.ok(surface.cellSlopeAt(p.x + dx * 2, p.z + dz * 2) <= 0.6);
      }
    assert.equal(nav.canStand(17, -85), false, 'steep vertex is excluded regardless of convention');
    assert.equal(nav.canStand(5, -85), false, 'no square padding');
    assert.equal(nav.indexAt(23, -85), -1);
  }

// Coarse cells are conservatively cleared per radius; a small-body route is not a large-body guarantee.
for (const gap of [5, 8]) {
  const { surface } = syntheticTerrain({ width: 32, depth: 56, origin: { x: -16, z: -28 } });
  const width = 16 - gap / 2,
    x = gap / 2 + width / 2;
  const obstacles = [
    { x: -x, z: 0, width, depth: 8 },
    { x, z: 0, width, depth: 8 },
  ];
  const nav = createNavigation(surface, obstacles, profiles, 2);
  for (const name of ['small', 'large']) {
    const p = nav.forProfile(name),
      field = p.buildField({ x: 1, z: 20 });
    assert.equal(
      Number.isFinite(field.cost[p.indexAt(1, -20)]),
      name === 'small' || gap === 8,
      '2m graph reachability respects radius and does not cut diagonal corners',
    );
  }
}

const valid = { width: 8, depth: 12, cellSize: 2, heights: new Float32Array(35) };
for (const change of [
  { width: 7 },
  { depth: Infinity },
  { halfSize: 4 },
  { origin: { x: NaN, z: 0 } },
  { origin: { x: 0 } },
  { rowOrder: 'north' },
  { diagonal: 'alternating' },
  { boundary: 'zero' },
  { heights: [0] },
  { heights: new Float64Array(35).fill(NaN) },
])
  assert.throws(() => createHeightfield({ ...valid, ...change }), RangeError);
const surface = createHeightfield(valid);
assert.throws(
  () => createNavigationWorld({ surface, profiles, obstacles: [], cellSize: 0.5 }),
  RangeError,
);
const crowd = createCrowd({
  navigation: createNavigationWorld({ surface, profiles, obstacles: [] }),
});
assert.throws(
  () => crowd.createGroup({ profile: 'small', team: 0, spawnOrigin: { x: 5, z: 0 } }),
  RangeError,
);
crowd.dispose();
console.log(
  'Heightfield: rectangular/translatable bounds, both row orders and diagonals, independent mesh oracle, exact vertices, triangle slopes, boundary policies, input ownership and profile clearance.',
);
