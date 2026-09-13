const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { modelHarness, assertMesh, assertBuildingAssembly } = require('../helpers/model-contract.cjs');

test('factory armor keeps bounded open bay, cooling banks and hollow-topped exhausts', () => {
  const h = modelHarness();
  vm.runInContext('Math.random = seeded = () => { throw Error("Mesh RNG"); }', h.context);
  const mesh = assertMesh(() => {
    const r = { meshes: {}, geometry(n, d) { this.meshes[n] = d; } };
    h.EntityModels.upload(r); return r.meshes.faction0FactoryHull;
  }, { minTriangles: 1400, maxTriangles: 2100, min: [-3.3, .1, -3.4], max: [3.3, 6, 1.85] });
  const vertices = [];
  for (let i = 0; i < mesh.length; i += 9) vertices.push(mesh.slice(i, i + 9));
  assert.ok(vertices.some(([x,y,z]) => Math.abs(x) > 2.1 && y > 2 && z > 1.65), 'forward portal sides');
  assert.ok(!vertices.some(([x,y,z]) => Math.abs(x) < 1.6 && y > 1.21 && y < 2.8 && z > -2.45), 'clear central assembly bay');
  assert.ok(vertices.filter(([x,y]) => Math.abs(x) > 3.24 && y > 1.4 && y < 2.65).length > 200, 'paired cooling banks');
  for (const [x, top, radius] of [[-2.5, 5.95, .36], [-1.45, 5.05, .31]]) {
    const lip = vertices.filter(([px,y,pz]) => Math.abs(y-top) < 1e-9 && Math.hypot(px-x,pz+1.65) < radius*1.01);
    assert.ok(lip.length > 20);
    assert.ok(lip.every(([px,y,pz]) => Math.hypot(px-x,pz+1.65) >= radius*.65-1e-9), 'hollow mouth, not a solid cap');
    assert.ok(vertices.some(([px,y,pz]) => px===x && Math.abs(y-(top-.32))<1e-9 && pz===-1.65), 'recessed exhaust floor');
  }
});

test('factory preserves production yaw and preview/build variants with a fixed truss crane', () => {
  const h = modelHarness(), calls = assertBuildingAssembly(h, {
    type: 'factory', meshName: 'faction0FactoryHull', frontZ: 1.657, hp: 1450
  });
  const crane = calls.filter(c => c[0] === 'box' && c[2] >= 4.9);
  assert.equal(crane.length, 6, 'two rails and four truss diagonals');
  assert.ok(crane.every(c => c[7] === h.FACTIONS[0].accent));
  assert.equal(crane.filter(c => Math.abs(c[10]) === .9).length, 4);
});
