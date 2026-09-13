const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { modelHarness, assertMesh, assertBuildingAssembly } = require('../helpers/model-contract.cjs');

test('hangar armor keeps an open bay, original hex apron and a port control tower', () => {
  const h = modelHarness();
  vm.runInContext('Math.random = seeded = () => { throw Error("Mesh RNG"); }', h.context);
  const mesh = assertMesh(() => {
    const r = { meshes: {}, geometry(n, d) { this.meshes[n] = d; } };
    h.EntityModels.upload(r); return r.meshes.faction0HangarHull;
  }, { minTriangles: 1400, maxTriangles: 2100, min: [-3.3, .1, -3.4], max: [3.3, 5.4, 6.1] });
  const vertices = [];
  for (let i = 0; i < mesh.length; i += 9) vertices.push(mesh.slice(i, i + 9));
  assert.ok(!vertices.some(([x,y,z]) => Math.abs(x) < 1.6 && y > 1.23 && y < 2.8 && z > -2.45), 'open forward bay');
  assert.ok(vertices.some(([x,y]) => x < -2 && y > 5.3), 'port tower');
  assert.ok(!vertices.some(([x,y]) => x > 0 && y > 4.3), 'low starboard roof');
  const apron = vertices.filter(([x,y,z]) => z > 1.85);
  assert.ok(apron.some(([x,y,z]) => z > 5.6));
  for (const [x,y,z] of apron) {
    assert.ok(y <= .5, 'apron remains shallow');
    assert.ok(Math.abs(z-3) <= 3.1*Math.sqrt(3)/2+1e-9);
    assert.ok(Math.abs(x) + Math.abs(z-3)/Math.sqrt(3) <= 3.1+1e-9, 'unchanged hexagonal deck outline');
  }
});

test('hangar preserves production yaw, deck guidance and preview/build variants', () => {
  const h = modelHarness(), calls = assertBuildingAssembly(h, {
    type: 'hangar', meshName: 'faction0HangarHull', frontZ: 1.667, hp: 1250
  });
  const deck = calls.filter(c => c[0] === 'box' && c[2] < .5);
  assert.equal(deck.length, 9, 'three H strokes plus six approach lamps');
  assert.ok(deck.every(c => c[7] === h.FACTIONS[0].color));
  assert.equal(deck.filter(c => c[11] === .65).length, 6);
  const glass = calls.filter(c => c[0] === 'box' && c[2] === 4.91);
  assert.equal(glass.length, 2, 'front/side control-tower glazing');
});
