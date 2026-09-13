const { test } = require('node:test');
const assert = require('node:assert/strict');
const { modelHarness } = require('../helpers/model-contract.cjs');

test('factory extraction preserves its assembly and common foundation/scaffold', () => {
  const h = modelHarness(), e = { id: 1, faction: 0, team: 0, kind: 'building', type: 'factory',
    x: 12, z: -7, hp: h.BUILDINGS.factory.hp, size: h.BUILDINGS.factory.size, progress: 1 };
  assert.equal(h.EntityModels.find(e).id, 'faction-0/building/factory');
  assert.equal(h.draw(e).length, 18);
  assert.deepEqual(h.draw(e).slice(0, 2).map(c => c[0]), ['hex', 'ring']);
  for (const progress of [0, .4]) assert.equal(h.draw({ ...e, progress }).length, 23);
  assert.deepEqual(h.draw({ ...e, hp: 0 }), []);
});
