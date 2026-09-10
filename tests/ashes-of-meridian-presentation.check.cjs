// Fixed references recorded once from 97bfda6 before world/effect decoupling.
const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/presentation-v1.json');
const { worldSample, effectSample } = require('./helpers/presentation-scenario.cjs');
for (const { seed, biome, ...expected } of fixture.worlds) {
  test(`world presentation/navigation reference: ${seed} (${biome})`, () => {
    assert.deepEqual(worldSample(seed, biome), expected);
  });
}
for (const [kind, expected] of Object.entries(fixture.effects)) {
  test(`effect payload, lifetime, gameplay and RNG reference: ${kind}`, () => {
    assert.deepEqual(effectSample(kind), expected);
  });
}
