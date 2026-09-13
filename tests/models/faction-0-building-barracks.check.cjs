const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const baseline = require('../fixtures/model-draw-v1.json');
const { modelHarness, modelDrawDigests } = require('../helpers/model-contract.cjs');

test('mechanical barracks extraction preserves all 756 entity draw variants', () => {
  const h = modelHarness();
  vm.runInContext('Math.random = seeded = () => { throw Error("Draw RNG"); }', h.context);
  assert.deepEqual(modelDrawDigests(h), baseline);
});

test('barracks dispatch is isolated and retains foundation, construction and dead-entity handling', () => {
  const h = modelHarness(), e = { id: 17, faction: 0, kind: 'building', type: 'barracks',
    x: 12, z: -7, hp: h.BUILDINGS.barracks.hp, size: 3, progress: 1 };
  vm.runInContext('Math.random = seeded = () => { throw Error("Draw RNG"); }', h.context);
  const model = h.EntityModels.find(e);
  assert.equal(model.id, 'faction-0/building/barracks');
  assert.equal(Object.isFrozen(model), true);
  for (const faction of [1, 2]) assert.equal(h.EntityModels.find({ ...e, faction }), undefined);
  for (const type of Object.keys(h.BUILDINGS).filter(t => t !== 'barracks'))
    assert.equal(h.EntityModels.find({ ...e, type }), undefined);
  assert.equal(h.EntityModels.find({ ...e, kind: 'unit' }), undefined);
  const normal = h.draw(e);
  assert.equal(normal.length, 15);
  assert.deepEqual(normal.slice(0, 2).map(c => c[0]), ['hex', 'ring']);
  for (const progress of [0, .4, 1]) {
    const calls = h.draw({ ...e, progress });
    assert.equal(calls[2][5], 2.5 * Math.max(.15, progress));
    assert.equal(calls.length, progress < 1 ? 20 : 15, 'construction scaffolding stays common');
  }
  assert.deepEqual(h.draw({ ...e, hp: 0 }), []);
});
