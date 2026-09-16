const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const { checkBuilding } = require('../helpers/building-contract.cjs');
const { modelHarness } = require('../helpers/model-contract.cjs');
const { createRendererStub } = require('../helpers/renderer-stub.cjs');

test('faction 2 barracks: swept pylons, split arch, ramp and bounded cached veil meshes', () => {
  checkBuilding({
    faction: 2, type: 'barracks', mesh: 'faction2BarracksHull', height: 5.5,
    min: [-2.73, .06, -1.85], max: [2.73, 5.681, 2.722],
    minTriangles: 1200, maxTriangles: 1300, maxInstances: 12, totalTriangles: 1600,
    features: [
      { name: 'sloped production ramp', min: [-1, .1, 2.4], max: [1, .5, 2.73], vertices: 20 },
      { name: 'tall twin spires', min: [-2.2, 4.5, -.75], max: [2.2, 5.7, .4], vertices: 80 }
    ],
    extraMeshes: [
      { mesh: 'faction2BarracksPortal', min: [-1.12, .74, -.22], max: [1.12, 4.85, -.22], minTriangles: 9, maxTriangles: 9 },
      { mesh: 'faction2BarracksRibbons', min: [-1.661, .415, -1.2], max: [1.661, 5.195, 2.7], minTriangles: 140, maxTriangles: 140 }
    ]
  });
});

test('gate membrane stays fixed; surface animation respects previews, quality, opacity and construction', () => {
  const h=modelHarness(), d=h.BUILDINGS.barracks,
    e={id:17,faction:2,type:'barracks',kind:'building',team:0,hp:d.hp,size:d.size,x:12,z:-7,progress:1},
    { PORTAL_MATERIAL: moving, PORTAL_STILL_MATERIAL: still }=vm.runInContext('({PORTAL_MATERIAL,PORTAL_STILL_MATERIAL})',h.context);
  const draw=(quality,cinema,options={},time=0,entity=e)=>{
    const r=createRendererStub({record:true});r.quality=quality;r.cinema=cinema;
    h.renderEntity(r,Object.freeze(entity),time,options);
    return r.calls.find(c=>c[0]==='faction2BarracksPortal');
  };
  assert.deepEqual(draw(1,false),draw(1,false,{},12), 'no shifting or scaling of the membrane');
  assert.equal(draw(1,false)[14],moving);
  assert.equal(draw(2,false)[14],moving);
  for(const c of [draw(0,false),draw(1,true),draw(1,false,{ghost:true}),draw(1,false,{tint:0xabcdef}),draw(1,false,{alpha:.3})])
    assert.equal(c[14],still);
  assert.equal(draw(1,false,{alpha:0})[12],0, 'invisible previews remain invisible');
  const preview=draw(1,false,{tint:0xabcdef,alpha:.3});
  assert.equal(preview[7],0xabcdef);assert.equal(preview[12],.3);
  assert.equal(draw(1,false,{ghost:true})[7],0x68717d);
  const built=draw(1,false,{},0,{...e,progress:.4});
  assert.equal(built[5],.4);
  for(const team of [0,1]) {
    const c=draw(1,false,{},0,{...e,team});
    assert.equal(c[8],h.BUILDING_YAW+team*Math.PI);
  }
});
