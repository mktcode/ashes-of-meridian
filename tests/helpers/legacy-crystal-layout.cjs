// Explicit input arrangement for historical simulation/effect characterizations.
// The unchanged ab92a12 fixture records the old (overlapping) resource positions.
// New-start and migration tests must NOT use this helper.
const assert = require('node:assert/strict');
const fixture = require('../fixtures/operation-v1.json');
const positions = fixture.entities.filter(e => e.kind === 'resource' && e.type === 'crystal');
function useLegacyCrystalLayout(game) {
  const crystals = game.s.entities.filter(e => e.kind === 'resource' && e.type === 'crystal');
  assert.equal(crystals.length, positions.length);
  crystals.forEach((e, i) => { e.x = positions[i].x; e.z = positions[i].z; });
  game.rehash();
}
module.exports = { useLegacyCrystalLayout };
