const assert = require('node:assert/strict');
const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');
const { modelHarness } = require('../helpers/model-contract.cjs');

test('Veiled Court turret: forked projector, armored bastion and capacitor details', () => {
  checkBuilding({
    faction:2,type:'turret',mesh:'faction2TurretHull',height:4.27,
    min:[-1.682,.01,-1.682],max:[1.682,1.391,1.682],
    minTriangles:780,maxTriangles:780,totalTriangles:1800,maxInstances:9,
    features:[
      {name:'three-tier octagonal bastion',min:[-1.7,0,-1.7],max:[1.7,1.391,1.7],vertices:1500}
    ],
    extraMeshes:[
      {mesh:'faction2TurretHead',min:[-.913,1.38,-1.404],max:[.913,4,2.42],minTriangles:728,maxTriangles:728},
      {mesh:'faction2TurretLights',min:[-.819,.352,-.868],max:[.819,1.523,1.708],minTriangles:84,maxTriangles:84},
      {mesh:'faction2TurretHeadLights',min:[-.778,2.82,-1.253],max:[.778,3.608,1.864],minTriangles:108,maxTriangles:108}
    ]
  });
});

test('Veiled Court turret tracks targets with its complete upper assembly', () => {
  const h=modelHarness(),d=h.BUILDINGS.turret,
    entity={id:17,faction:2,kind:'building',type:'turret',team:0,hp:d.hp,size:d.size,x:0,z:0,progress:1,rot:.7},
    draw=(rot,time=0,options={})=>h.draw({...entity,rot},options,time);
  const left=draw(-2.1),right=draw(.7),calls=right,crystals=calls.filter(c=>c[0]==='octa');
  assert.deepEqual(left.find(c=>c[0]==='faction2TurretHull'),right.find(c=>c[0]==='faction2TurretHull'),
    'foundation remains fixed');
  assert.equal(left.find(c=>c[0]==='faction2TurretHead')[8],-2.1);
  assert.equal(right.find(c=>c[0]==='faction2TurretHead')[8],.7);
  assert.equal(left.find(c=>c[0]==='faction2TurretHeadLights')[8],-2.1);
  assert.notDeepEqual(left.filter(c=>c[0]==='octa').slice(2),right.filter(c=>c[0]==='octa').slice(2),
    'rear crystal, lance and muzzle follow the weapon');
  assert.equal(crystals.length,5,'two capacitor caps, rear charge crystal, lance and muzzle crystal');
  assert.ok(crystals.every(c=>c[14]===h.MAT.CRYSTAL),'all luminous prisms use faceted crystal shading');
  assert.equal(calls.filter(c=>c[0]==='faction2TurretLights'||c[0]==='faction2TurretHeadLights').length,2);
  assert.ok(!calls.some(c=>c[0]==='hex'||c[0]==='ring'),'model owns its angular foundation');
  const rearAt=time=>draw(.7,time).find(c=>c[0]==='octa'&&c[2]===4.27),start=rearAt(0),later=rearAt(5);
  assert.ok(Math.abs(later[8]-start[8]-.6)<1e-12);
  assert.deepEqual(later.map((v,i)=>i===8?start[i]:v),start,'only rear crystal yaw changes');
  for(const alpha of [0,.3,1]) {
    const rendered=draw(.7,0,{tint:0xabcdef,alpha});
    for(const name of ['faction2TurretLights','faction2TurretHeadLights']) {
      const light=rendered.find(c=>c[0]===name);
      assert.equal(light[7],0xabcdef);assert.equal(light[12],alpha);
    }
  }
  assert.equal(h.BUILDINGS.turret.size,1.7,'gameplay footprint remains unchanged');
});
