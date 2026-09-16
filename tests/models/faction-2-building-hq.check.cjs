const assert = require('node:assert/strict');
const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');
const { modelHarness } = require('../helpers/model-contract.cjs');

test('Silent Throne: six-pylon command terrace, stairs and four-bladed crown', () => {
  checkBuilding({
    faction:2,type:'hq',mesh:'faction2HqHull',height:7.8,
    min:[-4.14,.03,-4.135],max:[4.14,7.92,4.37],
    minTriangles:1330,maxTriangles:1350,totalTriangles:1800,maxInstances:14,
    features:[
      {name:'front stair flights',min:[-3.9,.15,3.35],max:[3.9,.65,4.38],vertices:100},
      {name:'six tall crystal pylons',min:[-3.9,.25,-3.9],max:[3.9,4.55,3.9],vertices:400},
      {name:'four swept crown blades',min:[-1.55,4.45,-1.55],max:[1.55,7.93,1.55],vertices:100}
    ],
    extraMeshes:[
      {mesh:'faction2HqRibbons',min:[-3.027,.6,-3.48],max:[3.027,7.52,3.48],minTriangles:44,maxTriangles:44}
    ]
  });
});

test('Silent Throne suspends one reliquary inside six crystal pylons and three tilted orbits', () => {
  const h=modelHarness(),d=h.BUILDINGS.hq,
    entity={id:17,faction:2,kind:'building',type:'hq',team:0,hp:d.hp,size:d.size,x:0,z:0,progress:1};
  for(const time of [0,2,9]) {
    const calls=h.draw(entity,{},time),rings=calls.filter(c=>c[0]==='ring'),crystals=calls.filter(c=>c[0]==='octa');
    assert.equal(calls.filter(c=>c[0]==='faction2HqHull').length,1);
    assert.equal(calls.filter(c=>c[0]==='faction2HqRibbons').length,1);
    assert.equal(rings.length,3);assert.deepEqual(rings.map(c=>c[2]),[4.72,5.72,6.62]);
    assert.deepEqual(rings.map(c=>c[9]),[.08,.2,.34]);
    assert.equal(crystals.length,9,'dark reliquary, six pylon caps and two central crystals');
    assert.ok(crystals.some(c=>c[2]===4.62&&c[4]===2.04));
    assert.equal(crystals.filter(c=>Math.abs(c[2]-4.79)<1e-12).length,6);
  }
  const a=h.draw(entity,{},0).filter(c=>c[0]==='ring').map(c=>c[8]),
    b=h.draw(entity,{},4).filter(c=>c[0]==='ring').map(c=>c[8]);
  assert.notDeepEqual(a,b,'tilted orbital planes precess with simulation time');
  assert.equal(h.BUILDINGS.hq.size,4.4,'gameplay footprint remains unchanged');
});
