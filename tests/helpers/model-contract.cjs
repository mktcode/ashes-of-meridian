const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { BATTLEFIELD_SCRIPTS, loadScripts, RENDERER_SCRIPTS } = require('./game-scripts.cjs');
const { createRendererStub } = require('./renderer-stub.cjs');

function modelHarness(options = {}) {
  // Other model contracts do not need the large destroyer mesh data. Its own model
  // contract explicitly opts in; keep the 128 MB test worker budget effective.
  const renderer = options.heavyModels ? RENDERER_SCRIPTS : RENDERER_SCRIPTS.filter(name =>
    name !== 'renderer-heavy-data' && name !== 'renderer-heavy-mesh' && !name.endsWith('-unit-destroyer'));
  const context = loadScripts(['core', ...renderer, 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'world-view'], options);
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
function modelDrawDigests(h, ids) {
  const result = {};
  for (const id of ids) {
    const [, factionId, kind, type] = /^faction-([0-2])\/(unit|building)\/([a-z]+)$/.exec(id) || [];
    const d = (kind === 'unit' ? h.UNITS : h.BUILDINGS)[type];
    assert.ok(d, `known model reference: ${id}`);
    const hash = createHash('sha256');
    for (const team of [0, 1]) for (const progress of [0, .4, 1])
      for (const options of [{}, { ghost: true }, { tint: 0x99e4c6, alpha: .3, layer: 'effects' }]) {
        hash.update(JSON.stringify(h.draw({ id: 17, kind, type, faction: Number(factionId), team, hp: d.hp,
          size: d.size, x: 12, z: -7, progress, rot: .7, walk: 2, carry: 10 }, options)));
      }
    result[id] = hash.digest('hex');
  }
  return result;
}
// Shared contract for static, single-hull production buildings with a +Z header light.
function assertBuildingAssembly(h, { type, meshName, frontZ, hp, maxInstances = 25 }) {
  vm.runInContext('Math.random = seeded = () => { throw Error("Model RNG"); }; geom.box = geom.cylinder = () => { throw Error("Per-frame geometry"); };', h.context);
  const e = { id: 17, faction: 0, team: 0, kind: 'building', type, x: 12, z: -7, hp, size: 3.8, progress: 1 },
    id = `faction-0/building/${type}`, model = h.EntityModels.find(e),
    hull = calls => calls.find(c => c[0] === meshName);
  assert.equal(h.BUILDINGS[type].size, e.size); assert.equal(h.BUILDINGS[type].hp, hp);
  assert.equal(model.id, id); assert.equal(Object.isFrozen(model), true);
  for (const faction of [1, 2]) assert.notEqual(h.EntityModels.find({ ...e, faction })?.id, id);
  for (const other of Object.keys(h.BUILDINGS).filter(t => t !== type))
    assert.notEqual(h.EntityModels.find({ ...e, type: other })?.id, id);
  assert.equal(h.EntityModels.find({ ...e, kind: 'unit' }), undefined);
  const normal = h.draw(e);
  assert.ok(normal.length <= maxInstances);
  assert.equal(normal.filter(c => c[0] === meshName).length, 1);
  assert.deepEqual(normal.slice(0, 2).map(c => c[0]), ['hex', 'ring']);
  assert.deepEqual(hull(normal), [meshName, 12, 0, -7, 1, 1, 1, h.FACTIONS[0].metal,
    h.BUILDING_YAW, 0, 0, 0, 1, 'dynamic', h.MAT.METAL]);
  assert.deepEqual(normal, h.draw(e, {}, 0), 'static model: no new animation');
  assert.deepEqual(normal, h.draw({ ...e, progress: undefined }), 'default is completed');
  for (const team of [0, 1]) for (const progress of [0, .4, 1]) {
    const state = { ...e, team, progress }, calls = h.draw(state), scale = Math.max(.15, progress),
      yaw = h.BUILDING_YAW + team * Math.PI, front = calls[3];
    assert.equal(hull(calls)[5], scale); assert.equal(hull(calls)[8], yaw);
    assert.equal(calls.length, normal.length + (progress < 1 ? 5 : 0), 'common scaffold');
    assert.ok(Math.abs(front[1] - (e.x + Math.sin(yaw) * frontZ)) < 1e-9, 'production front X');
    assert.ok(Math.abs(front[3] - (e.z + Math.cos(yaw) * frontZ)) < 1e-9, 'production front Z');
    assert.equal(front[2], 3.07 * scale);
    assert.equal(front[7], team ? 0xe98680 : h.FACTIONS[0].color);
    assert.equal(calls[1][7], front[7]);
    for (const alpha of [0, .3, 1]) {
      const preview = h.draw(state, { tint: 0x99e4c6, alpha, layer: 'effects', material: h.MAT.AUTO });
      assert.equal(hull(preview)[7], 0x99e4c6);
      assert.deepEqual(hull(preview).slice(12), [alpha, 'effects', h.MAT.AUTO]);
      assert.equal(preview[3][7], 0x99e4c6);
    }
    assert.equal(hull(h.draw(state, { ghost: true }))[7], 0x68717d);
    assert.equal(hull(h.draw(state, { ghost: true, tint: 0x99e4c6 }))[7], 0x68717d);
  }
  assert.deepEqual(h.draw({ ...e, hp: 0 }), []);
  return normal;
}
module.exports = { modelHarness, assertMesh, modelDrawDigests, assertBuildingAssembly };
