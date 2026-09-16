const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const { checkBuilding } = require('../helpers/building-contract.cjs');
const { modelHarness } = require('../helpers/model-contract.cjs');
const { createRendererStub } = require('../helpers/renderer-stub.cjs');

test('Votive Pillar: star terrace, four contacts and two bounded charge chambers', () => {
  checkBuilding({
    faction:2,type:'depot',mesh:'faction2DepotHull',height:3.3,
    min:[-2.625,.07,-2.625],max:[2.625,4.62,2.625],
    minTriangles:1050,maxTriangles:1100,totalTriangles:1200,maxInstances:14,
    features:[
      {name:'tall outer contacts',min:[1,3.7,1],max:[2.2,4.43,2.2],vertices:30},
      {name:'stepped star foundation',min:[-2.63,.06,-2.63],max:[2.63,.46,2.63],vertices:380}
    ],
    extraMeshes:[
      {mesh:'faction2DepotCharge',min:[-1,-.5,-1],max:[1,.5,1],minTriangles:24,maxTriangles:24},
      {mesh:'faction2DepotBolt',min:[.78,-.135,0],max:[1.62,.135,0],minTriangles:10,maxTriangles:10}
    ]
  });
});

test('Votive Pillar charges animate in the shader while cached bolts flicker only in live quality rendering', () => {
  const h=modelHarness(),d=h.BUILDINGS.depot,
    entity={id:17,faction:2,kind:'building',type:'depot',team:0,hp:d.hp,size:d.size,x:0,z:0,progress:1},
    {PORTAL_MATERIAL:moving,PORTAL_STILL_MATERIAL:still}=vm.runInContext('({PORTAL_MATERIAL,PORTAL_STILL_MATERIAL})',h.context);
  const draw=(quality,cinema,time,options={})=>{
    const r=createRendererStub({record:true});r.quality=quality;r.cinema=cinema;
    h.renderEntity(r,Object.freeze(entity),time,options);return r.calls;
  };
  const live=draw(1,false,.75),charges=live.filter(c=>c[0]==='faction2DepotCharge');
  assert.equal(charges.length,2);assert.ok(charges.every(c=>c[14]===moving));
  const activeTimes=Array.from({length:80},(_,i)=>i/20), counts=activeTimes.map(t=>
    draw(1,false,t).filter(c=>c[0]==='faction2DepotBolt').length);
  assert.ok(Math.max(...counts)>0,'at least one contact flashes');
  assert.ok(Math.min(...counts)<Math.max(...counts),'fixed bolt paths flicker instead of remaining lit');
  for(const calls of [draw(0,false,.75),draw(1,true,.75),draw(1,false,.75,{ghost:true}),draw(1,false,.75,{tint:0xabcdef})]) {
    assert.equal(calls.filter(c=>c[0]==='faction2DepotBolt').length,0);
    assert.ok(calls.filter(c=>c[0]==='faction2DepotCharge').every(c=>c[14]===still));
  }
  const invisible=draw(1,false,.75,{tint:0xabcdef,alpha:0}).filter(c=>c[0]==='faction2DepotCharge');
  assert.ok(invisible.every(c=>c[7]===0xabcdef&&c[12]===0));
});
