const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const baseline = require('../fixtures/model-draw-v1.json');
const {checkUnit} = require('../helpers/unit-contract.cjs');

test('faction-0 worker: restrained fittings preserve the entire established assembly and cargo indicator', () => {
  const {h,e,normal,uploaded}=checkUnit({
    type:'worker',min:[-.95,0,-.9],max:[.98,1.7,1.4],totalTriangles:2600,maxInstances:22,
    meshes:[{mesh:'faction0WorkerFittings',min:[-.46,.93,-.41],max:[.36,1.3,.09],minTriangles:260,maxTriangles:300}],
    features:[
      {name:'roof service plate and slats',min:[-.01,1.22,-.3],max:[.31,1.3,.04],vertices:280},
      {name:'left maintenance cover',min:[-.46,.93,-.41],max:[-.4,1.13,-.13],vertices:210}
    ]
  });
  assert.deepEqual(h.draw({...e,walk:3.4}),normal,'no new drill or tread animation');
  assert.equal(h.draw({...e,carry:10}).length,normal.length+1);
  assert.deepEqual(h.draw({...e,carry:10}).at(-1),['octa',e.x-.4*Math.sin(e.rot),1.4,e.z-.4*Math.cos(e.rot),.32,.46,.3,0xecc88a,e.rot,0,0,.35,1,'dynamic',h.MAT.METAL]);
  const hash=data=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
  assert.equal(hash(uploaded.workerHull),'349f10a4615e80b42ca1c76276da2264c1ec01cabaae87572f51829477e76bd9');
  assert.equal(hash(uploaded.workerDrill),'629c173fd438a9f2e79445043b20a8ec217d728fa43c5be165b4783aff702a9e');
  const oldAssembly=createHash('sha256');
  for(const team of [0,1]) for(const progress of [0,.4,1])
    for(const options of [{},{ghost:true},{tint:0x99e4c6,alpha:.3,layer:'effects'}])
      oldAssembly.update(JSON.stringify(h.draw({...e,team,progress,walk:2,carry:10},options)
        .filter(c=>c[0]!=='faction0WorkerFittings').map(c=> {
          // Only the two existing front lenses intentionally change color/emission.
          if(c[0]==='box' && c[4]===.11 && c[5]===.07 && c[6]===.025) {
            c[7]=0xffe4aa; c[11]=.55;
          }
          return c;
        })));
  assert.equal(oldAssembly.digest('hex'),baseline['faction-0/unit/worker'],'all non-lamp parts retain the established 18 variants');
});
