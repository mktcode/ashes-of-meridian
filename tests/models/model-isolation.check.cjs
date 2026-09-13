const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const baseline = require('../fixtures/model-draw-v1.json');
const { modelHarness, modelDrawDigests } = require('../helpers/model-contract.cjs');

test('factory/hangar refinement preserves 720 unrelated draw variants including the approved barracks', () => {
  const h = modelHarness();
  vm.runInContext('Math.random = seeded = () => { throw Error("Draw RNG"); }', h.context);
  // Approved barracks from 19dd176; original fixture remains untouched.
  const expected = { ...baseline,
    'faction-0/building/barracks': 'afa8b7ef6aa40cc53f560ccc54b8ecae1ff4a2b48f800b271ff97a1e15ab3746' };
  const actual = modelDrawDigests(h);
  for (const type of ['factory', 'hangar']) {
    const id = `faction-0/building/${type}`;
    assert.notEqual(actual[id], expected[id], 'intended refinement has dedicated mesh/assembly tests');
    delete actual[id]; delete expected[id];
  }
  assert.deepEqual(actual, expected);
});
