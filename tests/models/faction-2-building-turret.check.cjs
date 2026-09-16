const assert = require('node:assert/strict');
const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');
const { modelHarness } = require('../helpers/model-contract.cjs');

test('Veiled Court turret: forked projector, armored bastion and capacitor details', () => {
  checkBuilding({
    faction:2,type:'turret',mesh:'faction2TurretHull',height:4.27,
    min:[-1.682,.01,-1.682],max:[1.682,4,2.42],
    minTriangles:1500,maxTriangles:1520,totalTriangles:1800,maxInstances:7,
    features:[
      {name:'three-tier octagonal bastion',min:[-1.7,0,-1.7],max:[1.7,1.2,1.7],vertices:1000},
      {name:'four long fork rails',min:[-1,2.65,.1],max:[1,3.9,2.42],vertices:700},
      {name:'armored rear counterweight',min:[-1.1,2.35,-1.45],max:[1.1,4.01,-.25],vertices:350}
    ],
    extraMeshes:[
      {mesh:'faction2TurretLights',min:[-.819,.352,-1.253],max:[.819,3.608,1.864],minTriangles:192,maxTriangles:192}
    ]
  });
});

test('Veiled Court turret preserves static orientation while crystal charging follows simulation time', () => {
  const h=modelHarness(),d=h.BUILDINGS.turret,
    entity={id:17,faction:2,kind:'building',type:'turret',team:0,hp:d.hp,size:d.size,x:0,z:0,progress:1,rot:.7},
    draw=(rot,time=0,options={})=>h.draw({...entity,rot},options,time);
  assert.deepEqual(draw(-2.1),draw(.7),'redesign does not introduce a new aiming mode');
  const calls=draw(.7),crystals=calls.filter(c=>c[0]==='octa');
  assert.equal(crystals.length,5,'two capacitor caps, rear charge crystal, lance and muzzle crystal');
  assert.equal(calls.filter(c=>c[0]==='faction2TurretLights').length,1);
  assert.ok(!calls.some(c=>c[0]==='hex'||c[0]==='ring'),'model owns its angular foundation');
  const rearAt=time=>draw(.7,time).find(c=>c[0]==='octa'&&c[2]===4.27),start=rearAt(0),later=rearAt(5);
  assert.ok(Math.abs(later[8]-start[8]-.6)<1e-12);
  assert.deepEqual(later.map((v,i)=>i===8?start[i]:v),start,'only rear crystal yaw changes');
  for(const alpha of [0,.3,1]) {
    const light=draw(.7,0,{tint:0xabcdef,alpha}).find(c=>c[0]==='faction2TurretLights');
    assert.equal(light[7],0xabcdef);assert.equal(light[12],alpha);
  }
  assert.equal(h.BUILDINGS.turret.size,1.7,'gameplay footprint remains unchanged');
});
