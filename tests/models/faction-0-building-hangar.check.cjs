const { test } = require('node:test');
const assert = require('node:assert/strict');
const { modelHarness } = require('../helpers/model-contract.cjs');

test('hangar extraction preserves its assembly, forward deck and common scaffold', () => {
  const h = modelHarness(), e = { id: 1, faction: 0, team: 0, kind: 'building', type: 'hangar',
    x: 12, z: -7, hp: h.BUILDINGS.hangar.hp, size: h.BUILDINGS.hangar.size, progress: 1 };
  assert.equal(h.EntityModels.find(e).id, 'faction-0/building/hangar');
  assert.equal(h.draw(e).length, 19);
  assert.deepEqual(h.draw(e).slice(0, 2).map(c => c[0]), ['hex', 'ring']);
  const deck = h.draw(e).filter(c => c[0] === 'hex')[1];
  assert.equal(deck[1], e.x + Math.sin(h.BUILDING_YAW) * 3);
  for (const progress of [0, .4]) assert.equal(h.draw({ ...e, progress }).length, 24);
  assert.deepEqual(h.draw({ ...e, hp: 0 }), []);
});
