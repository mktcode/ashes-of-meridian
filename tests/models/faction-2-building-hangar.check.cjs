const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const { checkBuilding } = require('../helpers/building-contract.cjs');
const { modelHarness } = require('../helpers/model-contract.cjs');
const { createRendererStub } = require('../helpers/renderer-stub.cjs');

test('Sky Sepulcher: low segmented basin, launch apron and horizontal portal', () => {
  checkBuilding({
    faction:2,type:'hangar',mesh:'faction2HangarHull',height:5.5,
    min:[-3.304,.039,-3.304],max:[3.304,1.03,3.62],
    minTriangles:600,maxTriangles:620,totalTriangles:850,maxInstances:4,
    features:[
      {name:'low segmented armor ring',min:[-3.31,.34,-3.31],max:[3.31,1.04,3.31],vertices:350},
      {name:'broad sloping launch apron',min:[-1.5,.12,2.1],max:[1.5,.75,3.63],vertices:20}
    ],
    extraMeshes:[
      {mesh:'faction2HangarPortal',min:[-2.31,.665,-2.31],max:[2.31,.665,2.31],minTriangles:48,maxTriangles:48},
      {mesh:'faction2HangarRibbons',min:[-3.032,.604,-3.032],max:[3.032,.77,3.527],minTriangles:132,maxTriangles:132}
    ]
  });
});

test('Sky Sepulcher portal is a fixed horizontal surface with shader-only motion', () => {
  const h=modelHarness(),d=h.BUILDINGS.hangar,
    entity={id:17,faction:2,kind:'building',type:'hangar',team:0,hp:d.hp,size:d.size,x:0,z:0,progress:1},
    {PORTAL_MATERIAL:moving,PORTAL_STILL_MATERIAL:still}=vm.runInContext('({PORTAL_MATERIAL,PORTAL_STILL_MATERIAL})',h.context);
  const meshes={},renderer={meshes,geometry(name,data){meshes[name]=data;}};h.EntityModels.upload(renderer);
  const membrane=meshes.faction2HangarPortal;
  for(let i=0;i<membrane.length;i+=9) {
    assert.equal(membrane[i+1],.665,'every portal vertex is horizontal');
    assert.ok(Math.abs(membrane[i+4]-1)<1e-12,'portal surface normals point upward');
  }
  const draw=(quality,cinema,time,options={})=>{
    const r=createRendererStub({record:true});r.quality=quality;r.cinema=cinema;
    h.renderEntity(r,Object.freeze(entity),time,options);return r.calls;
  };
  const live=draw(1,false,.75),portal=live.find(c=>c[0]==='faction2HangarPortal');
  assert.equal(portal[14],moving);
  assert.equal(live.filter(c=>c[0].startsWith('faction2Hangar')).length,3);
  assert.ok(!live.some(c=>c[0]==='ring'||c[0]==='octa'),'no legacy tower or orbital rings');
  for(const calls of [draw(0,false,.75),draw(1,true,.75),draw(1,false,.75,{ghost:true}),draw(1,false,.75,{tint:0xabcdef})])
    assert.equal(calls.find(c=>c[0]==='faction2HangarPortal')[14],still);
  const invisible=draw(1,false,.75,{tint:0xabcdef,alpha:0}).find(c=>c[0]==='faction2HangarPortal');
  assert.equal(invisible[7],0xabcdef);assert.equal(invisible[12],0);
});
