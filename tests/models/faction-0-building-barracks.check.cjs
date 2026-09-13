const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { modelHarness, assertMesh } = require('../helpers/model-contract.cjs');
const modelId = 'faction-0/building/barracks', meshName = 'faction0BarracksHull';
const entity = { id: 17, faction: 0, kind: 'building', type: 'barracks',
  x: 12, z: -7, hp: 1150, size: 3, progress: 1 };

function noRng(h) {
  vm.runInContext('Math.random = seeded = () => { throw Error("Model RNG"); }', h.context);
}

test('barracks armor has bounded deterministic geometry and readable portal/roof detail', () => {
  const h = modelHarness(); noRng(h);
  const factory = () => {
    const r = { meshes: {}, geometry(n, data) { this.meshes[n] = data; } };
    h.EntityModels.upload(r); return r.meshes[meshName];
  };
  const mesh = assertMesh(factory, { minTriangles: 900, maxTriangles: 1500,
    min: [-3.1, .1, -2.2], max: [3.1, 4.6, 2.25] });
  const vertices = [];
  for (let i = 0; i < mesh.length; i += 9) vertices.push(mesh.slice(i, i + 9));
  assert.ok(vertices.some(([x, y, z]) => Math.abs(x) < 1.1 && y > 1 && z > 1.7 && z < 1.85), 'recessed front door');
  assert.ok(vertices.some(([x, y, z]) => Math.abs(x) > 1.1 && Math.abs(x) < 1.6 && y > 2 && z > 2.1), 'armored portal');
  assert.ok(vertices.some(([x, y]) => Math.abs(x) < .4 && y > 3.4), 'raised roof spine');
  assert.ok(vertices.filter(([x, y]) => Math.abs(x) > 1.2 && Math.abs(x) < 1.9 && y > 3.14 && y < 3.22).length > 200, 'broad cooling slats');
  assert.ok(vertices.some(([x]) => x < -2.9) && vertices.some(([x]) => x > 2.9), 'paired side modules');
});

test('barracks dispatch retains tint, yaw, construction, isolation and instance budget without per-frame geometry', () => {
  const h = modelHarness(); noRng(h);
  assert.equal(h.BUILDINGS.barracks.size, entity.size);
  assert.equal(h.BUILDINGS.barracks.hp, entity.hp);
  const model = h.EntityModels.find(entity);
  assert.equal(model.id, modelId); assert.equal(Object.isFrozen(model), true);
  for (const faction of [1, 2]) assert.equal(h.EntityModels.find({ ...entity, faction }), undefined);
  for (const type of Object.keys(h.BUILDINGS).filter(t => t !== 'barracks'))
    assert.notEqual(h.EntityModels.find({ ...entity, type })?.id, modelId);
  assert.equal(h.EntityModels.find({ ...entity, kind: 'unit' }), undefined);
  // Any accidental invocation of the hull factory during draw must fail.
  vm.runInContext('geom.box = geom.cylinder = () => { throw Error("Per-frame geometry"); }', h.context);
  const normal = h.draw(entity), hull = calls => calls.find(c => c[0] === meshName);
  assert.equal(normal.filter(c => c[0] === meshName).length, 1);
  assert.ok(normal.length <= 20);
  assert.deepEqual(normal.slice(0, 2).map(c => c[0]), ['hex', 'ring']);
  assert.deepEqual(hull(normal), [meshName, 12, 0, -7, 1, 1, 1, h.FACTIONS[0].metal,
    h.BUILDING_YAW, 0, 0, 0, 1, 'dynamic', h.MAT.METAL]);
  assert.deepEqual(normal, h.draw(entity, {}, 0), 'no new animation');
  for (const team of [0, 1]) for (const progress of [0, .4, 1]) {
    const e = { ...entity, team, progress }, calls = h.draw(e), b = Math.max(.15, progress),
      yaw = h.BUILDING_YAW + team * Math.PI, lintel = calls[3];
    assert.equal(hull(calls)[5], b);
    assert.equal(hull(calls)[8], yaw);
    assert.equal(calls.length, normal.length + (progress < 1 ? 5 : 0), 'common scaffold');
    assert.ok(Math.abs(lintel[1] - (e.x + Math.sin(yaw) * 2.256)) < 1e-9, 'front X follows production yaw');
    assert.ok(Math.abs(lintel[3] - (e.z + Math.cos(yaw) * 2.256)) < 1e-9, 'front Z follows production yaw');
    assert.equal(lintel[2], 2.53 * b);
    assert.equal(lintel[7], team ? 0xe98680 : h.FACTIONS[0].color);
    assert.equal(calls[1][7], lintel[7], 'same team color on platform');
    const preview = h.draw(e, { tint: 0x99e4c6, alpha: .3, layer: 'effects', material: h.MAT.AUTO });
    assert.equal(hull(preview)[7], 0x99e4c6);
    assert.deepEqual(hull(preview).slice(12), [.3, 'effects', h.MAT.AUTO]);
    assert.equal(preview[3][7], 0x99e4c6);
    assert.equal(hull(h.draw(e, { ghost: true }))[7], 0x68717d);
    assert.equal(hull(h.draw(e, { ghost: true, tint: 0x99e4c6 }))[7], 0x68717d);
  }
  assert.deepEqual(h.draw({ ...entity, hp: 0 }), []);
});
