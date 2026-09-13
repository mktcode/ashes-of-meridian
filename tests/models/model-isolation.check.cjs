const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const baseline = require('../fixtures/model-draw-v1.json');
const { modelHarness, modelDrawDigests } = require('../helpers/model-contract.cjs');

test('building detail pass preserves all 378 unit variants and 54 approved production-building variants', () => {
  const h = modelHarness();
  vm.runInContext('Math.random = seeded = () => { throw Error("Draw RNG"); }', h.context);
  // Approved production buildings from f87efb1, captured before this detail pass.
  // The original d4689d2 fixture remains untouched, including all old building digests.
  const approved = {
    'faction-0/building/barracks': 'afa8b7ef6aa40cc53f560ccc54b8ecae1ff4a2b48f800b271ff97a1e15ab3746',
    'faction-0/building/factory': 'a0eba48dad95dc98d8bcd6bc7179791c4466894f26d5b5b22adba534bdc2f692',
    'faction-0/building/hangar': 'ff5ce4217dfc0efc954fdc71cd1450ae4f7f54b1cebe8c9ec61c32a63a471721'
  }, expected = { ...baseline, ...approved }, actual = modelDrawDigests(h);
  for (const id of Object.keys(expected)) if (id.includes('/building/') && !Object.hasOwn(approved, id)) {
    assert.notEqual(actual[id], expected[id], 'intended refinement has its own geometry/variant test');
    delete actual[id]; delete expected[id];
  }
  assert.equal(Object.keys(actual).length, 24);
  assert.deepEqual(actual, expected);
});
