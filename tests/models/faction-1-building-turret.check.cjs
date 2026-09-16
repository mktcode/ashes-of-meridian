const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkBuilding } = require('../helpers/building-contract.cjs');
const { modelHarness } = require('../helpers/model-contract.cjs');
const { assertRecessedMuzzle } = require('../helpers/unit-contract.cjs');

test('Thorn spire: rooted cannon cradle and complete aimed weapon preserve building contracts', () => {
  checkBuilding({
    faction:1,type:'turret',mesh:'faction1TurretHull',height:3.7,
    min:[-1.43,-.09,-1.49],max:[1.55,3.11,1.49],minTriangles:1000,maxTriangles:1000,
    maxInstances:5,totalTriangles:2400,legacyChoirEffects:false,
    features:[{name:'four-leaf cannon cradle',min:[-.95,2.65,-.8],max:[.95,3.11,.25],vertices:16}],
    extraMeshes:[
      {mesh:'faction1TurretWeapon',min:[-.87,-.67,-1.44],max:[.87,.67,2.68],minTriangles:600,maxTriangles:600},
      {mesh:'faction1TurretBud',min:[-.23,-.29,-.23],max:[.23,.29,.23],minTriangles:280,maxTriangles:280}
    ]
  });
});

test('Thorn spire has a recessed forward muzzle and its whole seed cannon follows existing aim',()=>{
  const h=modelHarness(),meshes={};h.EntityModels.upload({meshes:{},geometry(name,data){meshes[name]=data;}});
  assertRecessedMuzzle(meshes.faction1TurretWeapon,{x:0,y:.05,z:.42,rx:Math.PI/2,front:2.25,recess:.34});
  const d=h.BUILDINGS.turret,base={id:17,faction:1,type:'turret',kind:'building',team:0,hp:d.hp,size:d.size,x:12,z:-7,progress:1};
  for(const rot of [-2.1,0,.7,3.14]) {
    const calls=h.draw({...base,rot}),hull=calls.find(c=>c[0]==='faction1TurretHull'),weapon=calls.find(c=>c[0]==='faction1TurretWeapon'),bud=calls.find(c=>c[0]==='faction1TurretBud');
    assert.equal(hull[8],h.BUILDING_YAW,'rooted base stays fixed');
    assert.ok(Math.abs(weapon[8]-rot)<1e-12,'pod, barrel and guard thorns aim together');
    assert.ok(Math.abs(Math.atan2(bud[1]-base.x,bud[3]-base.z)-rot)<1e-12,'glowing muzzle remains at the barrel tip');
    assert.deepEqual(calls.map(c=>c[0]),['choirMound','faction1TurretHull','faction1TurretWeapon','faction1TurretBud','ring']);
  }
});
