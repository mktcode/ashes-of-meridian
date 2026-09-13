const {test} = require('node:test');
const assert = require('node:assert/strict');
const {checkUnit} = require('../helpers/unit-contract.cjs');

test('faction-0 air: delta silhouette, twin engines, original bobbing and exit climb', () => {
  const {h,e,normal,uploaded}=checkUnit({
    type:'air',min:[-3.01,0,-2],max:[3.01,1.66,2.5],totalTriangles:1800,maxInstances:20,
    meshes:[{mesh:'faction0AirHull',min:[-3.01,0,-2],max:[3.01,1.66,2.5],minTriangles:900,maxTriangles:1400}],
    features:[
      {name:'pointed nose',min:[-.05,.6,2.4],max:[.05,.7,2.5],vertices:40},
      {name:'left wing tip',min:[-3.01,.3,-.3],max:[-2.8,.6,-.1],vertices:4},
      {name:'right wing tip',min:[2.8,.3,-.3],max:[3.01,.6,-.1],vertices:4},
      {name:'paired intake grilles',min:[-1.4,.65,-.75],max:[1.4,.69,-.1],vertices:300},
      {name:'tail fins',min:[-.7,.7,-1.7],max:[.7,1.66,-.7],vertices:300}
    ]
  });
  assert.deepEqual(h.draw({...e,walk:3.4,carry:10}),normal,'no new flapping or wheel animation');
  for(const time of [0,9,20]) for(const distance of [0,.25,1,2]) {
    const exit=Object.freeze({x:e.x,z:e.z+distance,length:1}), calls=h.draw({...e,exit},{},time), base=h.draw(e,{},time), drop=3*Math.min(1,distance);
    calls.forEach((c,i)=>{assert.ok(Math.abs(c[2]-(base[i][2]-drop))<1e-12);
      assert.deepEqual(c.filter((_,k)=>k!==2),base[i].filter((_,k)=>k!==2));});
  }
  const jets=normal.filter(c=>c[0]==='cylinder');
  assert.equal(jets.length,2);
  for(const c of jets) assert.deepEqual(c.slice(4,12),[.23,.12,.23,h.FACTIONS[0].accent,e.rot,Math.PI/2,0,1.3]);
  // The first 80 triangles are the closed, outward-wound custom fuselage.
  const mesh=uploaded.faction0AirHull.slice(0,80*27), edges=new Map(); let volume=0;
  const key=p=>p.map(v=>v.toFixed(8)).join(',');
  for(let i=0;i<mesh.length;i+=27) {
    const p=[0,9,18].map(j=>mesh.slice(i+j,i+j+3));
    volume+=p[0][0]*(p[1][1]*p[2][2]-p[1][2]*p[2][1])+p[0][1]*(p[1][2]*p[2][0]-p[1][0]*p[2][2])+p[0][2]*(p[1][0]*p[2][1]-p[1][1]*p[2][0]);
    for(let j=0;j<3;j++) {const a=key(p[j]),b=key(p[(j+1)%3]),edge=[a,b].sort().join('|'),old=edges.get(edge)||[0,0];
      edges.set(edge,[old[0]+1,old[1]+(a<b?1:-1)]);}
  }
  assert.ok(volume>0,'outward fuselage');
  for(const value of edges.values()) assert.deepEqual(value,[2,0],'closed oppositely wound shared edges');
});
