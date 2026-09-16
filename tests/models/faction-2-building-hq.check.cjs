const assert = require('node:assert/strict');
const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');
const { modelHarness } = require('../helpers/model-contract.cjs');

test('Silent Throne: swept ivory mantle, buttresses and raised stair terrace', () => {
  checkBuilding({
    faction:2,type:'hq',mesh:'faction2HqHull',height:7.8,
    min:[-4.306,.03,-4.39],max:[4.306,8.5,4.39],
    minTriangles:2300,maxTriangles:2320,totalTriangles:2800,maxInstances:13,
    features:[
      {name:'raised stair flights',min:[-3.9,.15,3.35],max:[3.9,1.15,4.39],vertices:100},
      {name:'broad swept ivory mantle',min:[-1.85,4.55,-1.85],max:[1.85,8.51,1.85],vertices:200},
      {name:'flying buttress shoulders',min:[-3.5,1.15,-3.5],max:[3.5,3.65,3.5],vertices:100}
    ],
    extraMeshes:[
      {mesh:'faction2HqRibbons',min:[-3.421,.86,-3.93],max:[3.421,8.51,3.93],minTriangles:68,maxTriangles:68},
      {mesh:'faction2HqCore',min:[-1.86,2.05,-1.86],max:[1.86,5.2,1.86],minTriangles:16,maxTriangles:16},
      {mesh:'faction2HqOrbits',min:[-2.65,4.388,-2.642],max:[2.65,6.848,2.642],minTriangles:320,maxTriangles:320}
    ]
  });
});

test('Silent Throne mantle and inverted reliquary have outward normals; orbits obey model previews', () => {
  const h=modelHarness(),d=h.BUILDINGS.hq,
    entity={id:17,faction:2,kind:'building',type:'hq',team:0,hp:d.hp,size:d.size,x:0,z:0,progress:1};
  const meshes={};h.EntityModels.upload({meshes,geometry(name,data){meshes[name]=data;}});
  for(const mesh of ['faction2HqHull','faction2HqCore']) {
    const data=meshes[mesh];let checked=0;
    for(let i=0;i<data.length;i+=27) {
      const center=[0,1,2].map(k=>(data[i+k]+data[i+9+k]+data[i+18+k])/3);
      if(mesh==='faction2HqHull'&&center[1]<5.3) continue;
      assert.ok(center[0]*data[i+3]+center[2]*data[i+5]>0,'outward radial surface normal');checked++;
    }
    assert.ok(checked>=16);
  }
  const live=h.draw(entity),crystals=live.filter(c=>c[0]==='octa');
  assert.equal(crystals.length,8,'six pylon caps and two central crystals');
  assert.ok(!live.some(c=>c[0]==='ring'),'no separate unscaled legacy effect rings');
  for(const alpha of [0,.3,1]) {
    const call=h.draw(entity,{tint:0xabcdef,alpha}).find(c=>c[0]==='faction2HqOrbits');
    assert.equal(call[7],0xabcdef);assert.equal(call[12],alpha);
  }
  assert.equal(h.draw(entity,{ghost:true}).find(c=>c[0]==='faction2HqOrbits')[7],0x68717d);
  const build=h.draw({...entity,progress:.4}).find(c=>c[0]==='faction2HqOrbits');
  assert.equal(build[5],.4,'orbital paths lower with the construction instead of hovering above it');
  const orbitAt=time=>h.draw(entity,{},time).find(c=>c[0]==='faction2HqOrbits');
  const start=orbitAt(0),later=orbitAt(4);
  assert.ok(Math.abs(later[8]-start[8]-.6)<1e-12,'rings precess with simulation time');
  assert.deepEqual(orbitAt(4),later,'paused simulation preserves the orbital pose');
  assert.deepEqual(later.map((v,i)=>i===8?start[i]:v),start,'only orbital yaw changes');
  assert.equal(h.BUILDINGS.hq.size,4.4,'gameplay footprint remains unchanged');
});
