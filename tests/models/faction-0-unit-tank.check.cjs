const {test} = require('node:test');
const assert = require('node:assert/strict');
const {checkUnit,assertRecessedMuzzle} = require('../helpers/unit-contract.cjs');

test('faction-0 tank: tracked chassis, service deck and recessed fixed weapon', () => {
  const {h,e,normal,uploaded}=checkUnit({
    type:'tank',min:[-1.75,.14,-1.8],max:[1.75,2.2,2.72],totalTriangles:3000,maxInstances:20,
    meshes:[{mesh:'faction0TankHull',min:[-1.75,.14,-1.8],max:[1.75,2.2,2.72],minTriangles:2200,maxTriangles:2800}],
    features:[
      {name:'left track shoes and hubs',min:[-1.75,.14,-1.7],max:[-1.2,1.01,1.7],vertices:1300},
      {name:'right track shoes and hubs',min:[1.2,.14,-1.7],max:[1.75,1.01,1.7],vertices:1300},
      {name:'rear engine grille',min:[-.65,1.2,-1.4],max:[.65,1.31,-.8],vertices:200},
      {name:'muzzle lip',min:[-.37,1.38,2.5],max:[.37,2.2,2.72],vertices:180}
    ]
  });
  assertRecessedMuzzle(uploaded.faction0TankHull,{x:0,y:1.63,z:2.48,rx:0,front:0.21,recess:.12});
  assert.deepEqual(h.draw({...e,walk:3.4,carry:10}),normal,'no new wheel/track or cargo animation');
  assert.equal(normal.filter(c=>c[7]===0xffe4aa).length,2,'paired inset headlights');
});
