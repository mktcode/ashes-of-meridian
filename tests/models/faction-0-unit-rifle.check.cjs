const {test} = require('node:test');
const assert = require('node:assert/strict');
const {checkUnit,assertRecessedMuzzle} = require('../helpers/unit-contract.cjs');

test('faction-0 rifle: fitted armor, open muzzle, original two-leg walk phase and colors', () => {
  const {h,e,normal,uploaded}=checkUnit({
    type:'rifle', min:[-0.7,.01,-0.56], max:[0.7,1.9,1.21], totalTriangles:3600, maxInstances:5,
    meshes:[
      {mesh:'faction0RifleHull',min:[-0.7,.54,-0.56],max:[0.7,1.9,1.21],minTriangles:2400,maxTriangles:2700},
      {mesh:'faction0RifleLeg',min:[-.17,.01,-.18],max:[.17,.69,.36],minTriangles:250,maxTriangles:300},
      {mesh:'faction0RifleLivery',min:[-.6,1.12,.19],max:[.6,1.4,.31],minTriangles:250,maxTriangles:260},
      {mesh:'faction0RifleVisor',min:[-.16,-.04,-.023],max:[.16,.04,.023],minTriangles:64,maxTriangles:64}
    ],
    features:[
      {name:'beveled helmet',min:[-.35,1.45,-.25],max:[.35,1.9,.36],vertices:120},
      {name:'left shoulder armor',min:[-0.7,1.1,-.3],max:[-.33,1.8,.3],vertices:130},
      {name:'right weapon and recessed muzzle',min:[.35,.8,.8],max:[.65,1.3,1.21],vertices:100},
      {name:'backpack cooling ribs',min:[-.26,.7,-.56],max:[.26,1.45,-.38],vertices:100},
      {name:'segmented abdomen',min:[-.21,.85,.18],max:[.21,1.07,.27],vertices:180},
      {name:'weapon magazine',min:[.42,.78,.52],max:[.58,1.05,.74],vertices:120}
    ]
  });
  assertRecessedMuzzle(uploaded.faction0RifleHull,{x:.5,y:1.12,z:.98,front:.21,recess:.08});
  for(const rot of [-2.1,0,.7]) for(const walk of [undefined,0,Math.PI/14,3*Math.PI/14,2.6]) {
    const calls=h.draw({...e,rot,walk}), still=h.draw({...e,rot}), legs=calls.filter(c=>c[0]==='faction0RifleLeg'), step=Math.sin((walk||0)*7)*.23;
    assert.equal(legs.length,2);
    for(const [i,side] of [-1,1].entries()) {
      assert.ok(Math.abs(legs[i][1]-(e.x+side*.24*Math.cos(rot)+side*step*Math.sin(rot)))<1e-12);
      assert.ok(Math.abs(legs[i][3]-(e.z-side*.24*Math.sin(rot)+side*step*Math.cos(rot)))<1e-12);
      assert.deepEqual(legs[i].slice(4),[1,1,1,h.FACTIONS[0].dark,rot,0,0,0,1,'dynamic',h.MAT.METAL]);
    }
    assert.deepEqual(calls.filter(c=>c[0]!== 'faction0RifleLeg'),still.filter(c=>c[0]!== 'faction0RifleLeg'),'upper body and +Z weapon never gain a new phase');
  }
  const visor=normal.find(c=>c[11]===.85);
  assert.equal(visor[2],1.65*1);
  assert.equal(visor[7],0x8ce1e2);
  assert.equal(visor[0],'faction0RifleVisor');
  for(const options of [{ghost:true},{tint:0x99e4c6},{ghost:true,tint:0x99e4c6}]) {
    const preview=h.draw(e,options).find(c=>c[0]==='faction0RifleVisor');
    assert.equal(preview[7],options.ghost?0x68717d:options.tint,'visor follows the shared surface-color contract');
  }
});
