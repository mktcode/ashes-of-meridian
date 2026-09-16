const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const { checkBuilding } = require('../helpers/building-contract.cjs');
const { modelHarness } = require('../helpers/model-contract.cjs');
const { createRendererStub } = require('../helpers/renderer-stub.cjs');

test('Votive Pillar: compact star terrace and two bounded charge chambers', () => {
  checkBuilding({
    faction:2,type:'depot',mesh:'faction2DepotHull',height:3.3,
    min:[-2.143,.07,-2.143],max:[2.143,3.93,2.143],
    minTriangles:550,maxTriangles:600,totalTriangles:800,maxInstances:6,
    features:[
      {name:'stepped star foundation',min:[-2.15,.06,-2.15],max:[2.15,.46,2.15],vertices:380},
      {name:'central chamber cage',min:[-.98,1,-.98],max:[.98,3.75,.98],vertices:150}
    ],
    extraMeshes:[
      {mesh:'faction2DepotCharge',min:[-1,-.5,-1],max:[1,.5,1],minTriangles:24,maxTriangles:24}
    ]
  });
});

test('Votive Pillar keeps only the central accumulator and its shader-driven charge', () => {
  const h=modelHarness(),d=h.BUILDINGS.depot,
    entity={id:17,faction:2,kind:'building',type:'depot',team:0,hp:d.hp,size:d.size,x:0,z:0,progress:1},
    {PORTAL_MATERIAL:moving,PORTAL_STILL_MATERIAL:still}=vm.runInContext('({PORTAL_MATERIAL,PORTAL_STILL_MATERIAL})',h.context);
  const draw=(quality,cinema,time,options={})=>{
    const r=createRendererStub({record:true});r.quality=quality;r.cinema=cinema;
    h.renderEntity(r,Object.freeze(entity),time,options);return r.calls;
  };
  const live=draw(1,false,.75),charges=live.filter(c=>c[0]==='faction2DepotCharge');
  assert.equal(charges.length,2);assert.ok(charges.every(c=>c[14]===moving));
  assert.equal(live.filter(c=>c[0]==='octa').length,1,'only the small embedded team marker remains');
  assert.ok(!live.some(c=>/Bolt/.test(c[0])),'no lightning without outer contacts');
  for(const calls of [draw(0,false,.75),draw(1,true,.75),draw(1,false,.75,{ghost:true}),draw(1,false,.75,{tint:0xabcdef})])
    assert.ok(calls.filter(c=>c[0]==='faction2DepotCharge').every(c=>c[14]===still));
  const invisible=draw(1,false,.75,{tint:0xabcdef,alpha:0}).filter(c=>c[0]==='faction2DepotCharge');
  assert.ok(invisible.every(c=>c[7]===0xabcdef&&c[12]===0));
});
