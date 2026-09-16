const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkBuilding } = require('../helpers/building-contract.cjs');
const { modelHarness } = require('../helpers/model-contract.cjs');

test('Chrysalis: four-wing moth canopy, cocoon seam and leaf runway preserve building contracts', () => {
  checkBuilding({
    faction:1,type:'hangar',mesh:'faction1HangarHull',height:4.57,
    min:[-3.53,.03,-2.38],max:[3.68,4.58,3.71],minTriangles:3000,maxTriangles:3100,
    maxInstances:4,totalTriangles:3500,legacyChoirEffects:false,
    features:[
      {name:'broad asymmetric moth-wing span',min:[3.15,2.75,-1.5],max:[3.68,3.35,-.65],vertices:12},
      {name:'forward leaf launch tongue',min:[-.2,.15,3.1],max:[.2,.5,3.71],vertices:8}
    ],
    extraMeshes:[{mesh:'faction1HangarMembrane',min:[-.44,1.13,.34],max:[.44,3.2,.52],minTriangles:280,maxTriangles:280}]
  });
});

test('Chrysalis replaces the Root hollow language with a wide static moth assembly',()=>{
  const h=modelHarness(),d=h.BUILDINGS.hangar,e={id:17,faction:1,type:'hangar',kind:'building',team:0,hp:d.hp,size:d.size,x:0,z:0,progress:1,rot:.7};
  const calls=h.draw(e,{},.2),later=h.draw(e,{},1.1);
  assert.deepEqual(calls.map(c=>c[0]),['choirMound','faction1HangarHull','faction1HangarMembrane','ring']);
  assert.deepEqual(calls.find(c=>c[0]==='faction1HangarHull'),later.find(c=>c[0]==='faction1HangarHull'),'wings and cocoon do not flap');
  assert.notEqual(calls.find(c=>c[0]==='faction1HangarMembrane')[11],later.find(c=>c[0]==='faction1HangarMembrane')[11],'only the emergence seam breathes');
});
