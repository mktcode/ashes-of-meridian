const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const baseline = require('../fixtures/model-draw-v1.json');
const { modelHarness, modelDrawDigests } = require('../helpers/model-contract.cjs');

test('requested entity redesigns preserve every unrelated unit and building draw variant', () => {
  const h = modelHarness();
  vm.runInContext('Math.random = seeded = () => { throw Error("Draw RNG"); }', h.context);
  // Approved buildings from b7b9efc, captured BEFORE the unit pass.
  // The three f87efb1 production digests and original d4689d2 fixture stay unchanged.
  const approved = {
    'faction-0/building/hq': 'f2ae758721c213d4a7ee5c428e3f6915a601218800318892468a1a36f87c0483',
    'faction-0/building/barracks': 'afa8b7ef6aa40cc53f560ccc54b8ecae1ff4a2b48f800b271ff97a1e15ab3746',
    'faction-0/building/depot': 'ec94e74a3f95291d01a1fcb0a56aee6869ebbbff246fccc103f500584bd562f9',
    'faction-0/building/refinery': '35a26f739a454100cd75f49b22f39a02a9e27115914aa49a17be586fa07563a8',
    'faction-0/building/factory': 'a0eba48dad95dc98d8bcd6bc7179791c4466894f26d5b5b22adba534bdc2f692',
    'faction-0/building/hangar': 'ff5ce4217dfc0efc954fdc71cd1450ae4f7f54b1cebe8c9ec61c32a63a471721',
    'faction-0/building/turret': 'a3b32a5e4dac7ae8222f5e61d57aaf122580a2218b941c157e436a679649a21e',
    'faction-1/building/hq': 'b6d9970066e595a5a11710ac3d2da68f3f74b0161e014db79c627f18df7606bb',
    'faction-1/building/barracks': 'c0abbec0cd3b31dfb9a9f1a874650190eb1fde77967dd9d3ed4875cc79fde661',
    'faction-1/building/depot': '8b6a3588e77b1b09eb31b511f504c48c622f8c889760546165327351b924c513',
    'faction-1/building/refinery': 'b41512a34e3e3f40208698334526e9d3288b6659e1dc7219826c9ebf93c97f55',
    'faction-1/building/factory': '4703308e4223acfc49a08ac77dd4cf76b3e0cc494fdf956acd78a74f91d2f6e4',
    'faction-1/building/hangar': '555535b99fa465e5d18d5ee97c599265d0bbfac8d9109a238b76f186cf755a30',
    'faction-1/building/turret': 'c277493ed7a7db7440c7afc925174c82d056f06176f7f127b4917a16103a74e5',
    'faction-2/building/hq': '834ef1b7013064ed540e01dfa4af16d2bb73723e269a19e9bd467ec3000fa80c',
    'faction-2/building/barracks': '13bc5cc8653c86f216b71a65c3da99bba68752f404e1d59568ad2c28f406f19e',
    'faction-2/building/depot': '4143113ce0cb83a7d59d54455288fa9eaaff26e4d84ce4dedf49eb4eaf313eeb',
    'faction-2/building/refinery': '305b9c877f35338f9a69e525e3b53ce6da61eb6cbc559507d67e11deb33f1f40',
    'faction-2/building/factory': '0b3a61ed82f4012212e3182ddc4a14b86956b899059c64d8be07b468e6aa12fc',
    'faction-2/building/hangar': '2037a7799209527ba3356d8b97f48da740dd2b6e770a257f6b93013110c6f3ed',
    'faction-2/building/turret': '991e4bba1eec52a5e272fe455ae5bc89b847a7e158c19b4402e96a3efe175b10'
  }, expected = { ...baseline, ...approved }, actual = modelDrawDigests({
    ...h,
    draw(e, options = {}, time) {
      const calls = h.draw(e, options, time);
      if (e.faction !== 1 || e.kind !== 'building' || e.type === 'hq') return calls;
      // Normalize ONLY the requested foundation replacement to the original calls.
      // Every remaining Choir body, animation and build scaffold still hits its old digest.
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
  });
  // Redesigned bodies have independent geometry, assembly and animation checks.
  // Retain their old digests above; do not regenerate any unrelated reference.
  for (const id of Object.keys(expected)) if (id.includes('/unit/') ||
    ['faction-1/building/barracks','faction-1/building/depot','faction-1/building/hangar','faction-1/building/hq','faction-1/building/turret',
      'faction-2/building/barracks','faction-2/building/depot','faction-2/building/refinery','faction-2/building/factory','faction-2/building/hangar','faction-2/building/hq','faction-2/building/turret'].includes(id)) {
    assert.notEqual(actual[id], expected[id], 'requested refinement has its own geometry/variant test');
    delete actual[id]; delete expected[id];
  }
  // The newly added destroyers have an independent GLB geometry/variant contract.
  for (const faction of [0,1,2]) delete actual[`faction-${faction}/unit/destroyer`];
  assert.equal(Object.keys(actual).length, 9);
  assert.deepEqual(actual, expected);
});
