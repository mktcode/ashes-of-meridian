const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { loadScripts, RENDERER_SCRIPTS } = require('./game-scripts.cjs');
const { createRendererStub } = require('./renderer-stub.cjs');

function modelHarness(options) {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', 'world', 'world-view'], options);
  const api = vm.runInContext('({ geom, ModelMesh, EntityModels, createEntityModelRegistry, renderEntity, UNITS, BUILDINGS, FACTIONS, BUILDING_YAW, MAT })', context);
  return { context, ...api, draw(entity, options = {}, time = 9) {
    const before = JSON.stringify(entity), renderer = createRendererStub({ record: true });
    api.renderEntity(renderer, Object.freeze(entity), time, options);
    assert.equal(JSON.stringify(entity), before, 'drawing must not mutate input');
    for (const call of renderer.calls) assert.ok(call.slice(1, 13).every(Number.isFinite), 'finite draw data');
    return renderer.calls;
  } };
}

function assertMesh(factory, { minTriangles, maxTriangles, min, max }) {
  const mesh = factory();
  assert.deepEqual(mesh, factory(), 'deterministic mesh');
  assert.equal(mesh.length % 27, 0, 'triangles with position/normal/tint stride 9');
  assert.ok(mesh.length / 27 >= minTriangles && mesh.length / 27 <= maxTriangles, 'triangle budget');
  for (let i = 0; i < mesh.length; i += 27) {
    const a = mesh.slice(i, i + 3), b = mesh.slice(i + 9, i + 12), c = mesh.slice(i + 18, i + 21),
      u = b.map((v, k) => v - a[k]), v = c.map((v, k) => v - a[k]),
      cross = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]],
      area = Math.hypot(...cross);
    assert.ok(area > 1e-8, `nondegenerate triangle ${i / 27}`);
    for (let j = i; j < i + 27; j += 9) {
      assert.ok(mesh.slice(j, j + 9).every(Number.isFinite));
      for (let k = 0; k < 3; k++) {
        assert.ok(mesh[j + k] >= min[k] - 1e-9 && mesh[j + k] <= max[k] + 1e-9, 'local bounds');
        assert.ok(Math.abs(mesh[j + 3 + k] - cross[k] / area) < 1e-9, 'flat unit normal follows winding');
        assert.ok(mesh[j + 6 + k] > 0 && mesh[j + 6 + k] < 1.6, 'relative tint');
      }
    }
  }
  return mesh;
}

// Compact per-model baseline: all teams, build states and preview options, in fixed order.
function modelDrawDigests(h) {
  const result = {};
  for (const faction of [0, 1, 2]) for (const [kind, defs] of [['unit', h.UNITS], ['building', h.BUILDINGS]]) {
    for (const [type, d] of Object.entries(defs)) {
      const hash = createHash('sha256');
      for (const team of [0, 1]) for (const progress of [0, .4, 1])
        for (const options of [{}, { ghost: true }, { tint: 0x99e4c6, alpha: .3, layer: 'effects' }]) {
          hash.update(JSON.stringify(h.draw({ id: 17, kind, type, faction, team, hp: d.hp,
            size: d.size, x: 12, z: -7, progress, rot: .7, walk: 2, carry: 10 }, options)));
        }
      result[`faction-${faction}/${kind}/${type}`] = hash.digest('hex');
    }
  }
  return result;
}
module.exports = { modelHarness, assertMesh, modelDrawDigests };
