const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { modelHarness, modelDrawDigests } = require('../helpers/model-contract.cjs');

// Fixed references for models whose assembly is not otherwise fixed as a whole.
// Other models have their current geometry/assembly contracts in this directory.
const expected = {
  'faction-0/building/hq': 'f2ae758721c213d4a7ee5c428e3f6915a601218800318892468a1a36f87c0483',
  'faction-0/building/barracks': 'afa8b7ef6aa40cc53f560ccc54b8ecae1ff4a2b48f800b271ff97a1e15ab3746',
  'faction-0/building/depot': 'ec94e74a3f95291d01a1fcb0a56aee6869ebbbff246fccc103f500584bd562f9',
  'faction-0/building/refinery': '35a26f739a454100cd75f49b22f39a02a9e27115914aa49a17be586fa07563a8',
  'faction-0/building/factory': 'a0eba48dad95dc98d8bcd6bc7179791c4466894f26d5b5b22adba534bdc2f692',
  'faction-0/building/hangar': 'ff5ce4217dfc0efc954fdc71cd1450ae4f7f54b1cebe8c9ec61c32a63a471721',
  'faction-0/building/turret': 'a3b32a5e4dac7ae8222f5e61d57aaf122580a2218b941c157e436a679649a21e',
  'faction-1/building/refinery': 'b41512a34e3e3f40208698334526e9d3288b6659e1dc7219826c9ebf93c97f55',
  'faction-1/building/factory': '4703308e4223acfc49a08ac77dd4cf76b3e0cc494fdf956acd78a74f91d2f6e4'
};

test('fixed building assemblies retain all team, construction and preview variants', () => {
  const h = modelHarness();
  vm.runInContext('Math.random = seeded = () => { throw Error("Draw RNG"); }', h.context);
  const actual = modelDrawDigests({
    ...h,
    draw(e, options = {}, time) {
      const calls = h.draw(e, options, time);
      if (e.faction !== 1) return calls;
      // These references isolate the body from the separately checked choirMound.
      // Translate only that first foundation call; the body/scaffold remain exact.
      assert.equal(calls[0][0], 'choirMound');
      const build = Math.max(.15, e.progress), yaw = h.BUILDING_YAW + e.team*Math.PI,
        color = options.tint || (e.team ? 0xe98680 : h.FACTIONS[1].color),
        tail = [options.alpha??1, options.layer||'dynamic', options.material??h.MAT.BIO];
      return [
        ['hex',e.x,.15*build,e.z,e.size*1.09,.3*build,e.size*1.09,0x384552,yaw+.12,0,0,0,...tail],
        ['ring',e.x,.33*build,e.z,e.size*1.03,.1*build,e.size*1.03,color,yaw,0,0,.4,...tail],
        ...calls.slice(1)
      ];
    }
  }, Object.keys(expected));
  assert.deepEqual(actual, expected);
});
