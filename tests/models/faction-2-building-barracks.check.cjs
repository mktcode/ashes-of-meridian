const assert = require('node:assert/strict');
const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');
const { modelHarness } = require('../helpers/model-contract.cjs');

test('faction 2 barracks: open processional gate, bounded detailing and preserved building contracts', () => {
  checkBuilding({
    faction: 2,
    type: 'barracks',
    mesh: 'faction2BarracksHull',
    height: 5.5,
    min: [-2.55, .205, -2.116],
    max: [2.55, 5.7, 2.725],
    minTriangles: 1300,
    maxTriangles: 1450,
    features: [
      {
        name: 'forward processional ramp',
        min: [-1, .85, 2.35],
        max: [1, 1.3, 2.725],
        vertices: 20
      },
      {
        name: 'separated tall gate pylons',
        min: [-2.2, 4.5, -.75],
        max: [2.2, 5.7, .4],
        vertices: 80
      }
    ],
    extraMeshes: [{
      mesh: 'faction2BarracksPortal',
      min: [-.76, -1.45, 0],
      max: [.76, 1.55, 0],
      minTriangles: 14,
      maxTriangles: 14
    }]
  });
});

test('faction 2 barracks: violet portal has layered deterministic motion and crystal material', () => {
  const h = modelHarness(), d = h.BUILDINGS.barracks,
    entity = { id: 17, faction: 2, type: 'barracks', kind: 'building', team: 0,
      hp: d.hp, size: d.size, x: 12, z: -7, progress: 1, rot: 0 };
  const portals = time => h.draw(entity, {}, time).filter(c => c[0] === 'faction2BarracksPortal');
  const atZero = portals(0), atOne = portals(1);
  assert.equal(atZero.length, 2, 'two translucent field layers');
  assert.deepEqual(atZero.map(c => [c[11], c[12], c[14]]), [
    [.85, .62, h.MAT.CRYSTAL],
    [1.05, .28, h.MAT.CRYSTAL]
  ]);
  assert.notDeepEqual(atZero.map(c => c.slice(1, 7)), atOne.map(c => c.slice(1, 7)), 'portal wavers over time');
  assert.deepEqual(portals(1), atOne, 'portal motion does not use RNG');
});
