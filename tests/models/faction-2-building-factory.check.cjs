const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkBuilding } = require('../helpers/building-contract.cjs');
const { modelHarness } = require('../helpers/model-contract.cjs');

test('Tomb Forge: broad portal, angular foundation and vented forge shoulders retain building contracts', () => {
  checkBuilding({
    faction: 2, type: 'factory', mesh: 'faction2FactoryHull', height: 5.5,
    min: [-3.7,.06,-2.266], max: [3.7,5.681,3.212],
    minTriangles: 2600, maxTriangles: 2700, totalTriangles: 3000, maxInstances: 12,
    features: [
      {name:'outer cooling banks',min:[2.56,.8,-.26],max:[3.21,1.4,-.13],vertices:100},
      {name:'wide vehicle ramp',min:[-1.26,.1,2.9],max:[1.26,.6,3.212],vertices:20}
    ],
    extraMeshes: [
      {mesh:'faction2FactoryPortal',min:[-1.512,.74,-.2596],max:[1.512,4.85,-.2596],minTriangles:9,maxTriangles:9},
      {mesh:'faction2FactoryRibbons',min:[-3.075,.415,-1.765],max:[3.075,5.195,3.186],minTriangles:216,maxTriangles:216}
    ]
  });
});

test('Tomb Forge widens the gate without making it taller or changing portal motion and previews', () => {
  const h=modelHarness(),meshes={};
  h.EntityModels.upload({meshes,geometry(name,data){meshes[name]=data;}});
  const barracks=meshes.faction2BarracksPortal,forge=meshes.faction2FactoryPortal;
  assert.equal(forge.length,barracks.length);
  for(let i=0;i<forge.length;i+=9) {
    assert.ok(Math.abs(forge[i]-barracks[i]*1.35)<1e-10);
    assert.equal(forge[i+1],barracks[i+1]);
    assert.ok(Math.abs(forge[i+2]-barracks[i+2]*1.18)<1e-10);
  }
  const entity={id:17,faction:2,kind:'building',type:'factory',hp:100,team:0,size:h.BUILDINGS.factory.size,x:0,z:0,progress:1};
  const membrane=(options={},time=0)=>h.draw(entity,options,time).find(c=>c[0]==='faction2FactoryPortal');
  assert.deepEqual(membrane({},0),membrane({},12),'no CPU motion of the membrane');
  for(const alpha of [0,.3,1]) {
    const c=membrane({tint:0xabcdef,alpha});
    assert.equal(c[7],0xabcdef);assert.equal(c[12],alpha);
  }
  assert.equal(membrane({ghost:true})[7],0x68717d);
  assert.equal(h.BUILDINGS.factory.size,3.8,'unchanged gameplay footprint');
});
