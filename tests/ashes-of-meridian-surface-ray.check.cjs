// Candidate reduction versus the original rectangle scan; no world generation.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts } = require('./helpers/game-scripts.cjs');
const context = loadScripts(['core','battlefield-surface']);
const { Surface, seeded } = vm.runInContext('({Surface:BattlefieldSurface,seeded})',context);
const value = hit => hit && {x:hit.x,z:hit.z};
function field(size=65, height) {
  const random=seeded(40517),heights=Float32Array.from({length:size*size},(_,i)=>height?height(i%size,Math.floor(i/size)):random()*40);
  return Object.assign(Object.create(Surface.prototype),{extent:64,size,step:128/(size-1),heights,maxHeight:Math.max(0,...heights)});
}
// Retain the former production kernel as a test oracle, not shipping code.
function rectangle(s,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];
  if(Math.abs(dy)<1e-9)return null;
  const t0=-a[1]/dy,t1=(s.maxHeight-a[1])/dy,near=Math.max(0,Math.min(t0,t1)),far=Math.min(1,Math.max(t0,t1));
  if(near>far)return null;
  const col=v=>Math.floor((v+s.extent)/s.step),
    left=Math.max(0,col(Math.min(a[0]+dx*near,a[0]+dx*far))),right=Math.min(s.size-2,col(Math.max(a[0]+dx*near,a[0]+dx*far))),
    top=Math.max(0,col(Math.min(a[2]+dz*near,a[2]+dz*far))),bottom=Math.min(s.size-2,col(Math.max(a[2]+dz*near,a[2]+dz*far)));
  let best=Infinity;
  for(let row=top;row<=bottom;row++)for(let x=left;x<=right;x++) {
    const i=row*s.size+x,h=s.heights,wx=x*s.step-s.extent,wz=row*s.step-s.extent;
    for(const [gx,gz,upper] of [[(h[i+s.size+1]-h[i+s.size])/s.step,(h[i+s.size]-h[i])/s.step,1],
      [(h[i+1]-h[i])/s.step,(h[i+s.size+1]-h[i+1])/s.step,0]]) {
      const denominator=dy-gx*dx-gz*dz;if(Math.abs(denominator)<1e-9)continue;
      const t=(h[i]+gx*(a[0]-wx)+gz*(a[2]-wz)-a[1])/denominator,u=(a[0]+dx*t-wx)/s.step,v=(a[2]+dz*t-wz)/s.step;
      if(t>=0&&t<=1&&t<best&&u>=-1e-7&&u<=1+1e-7&&v>=-1e-7&&v<=1+1e-7&&(upper?v>=u-1e-7:u>=v-1e-7))best=t;
    }
  }
  return Number.isFinite(best)?{x:a[0]+dx*best,z:a[2]+dz*best}:null;
}
function check(s,a,b) { assert.deepEqual(value(s.ray(a,b)),rectangle(s,a,b),JSON.stringify({a,b})); }

test('row-span terrain rays preserve rectangle results for seeded heights, directions and segment ranges',()=>{
  const random=seeded(781);
  for(const s of [field(17),field(),field(129),field(33,(x,z)=>4+x*.01-z*.02),field(33,(x,z)=>Math.sin(x)*2+Math.cos(z))])
    for(let i=0;i<600;i++) {
      const a=[random()*220-110,random()*120-20,random()*220-110],b=[random()*220-110,random()*120-20,random()*220-110];
      check(s,a,b);
    }
});

test('vertical, axis, diagonal, grid-edge, tiny and horizontal rays retain their exact behavior',()=>{
  for(const s of [field(),field(65,()=>0),field(65,(x,z)=>10+(x-z)*.1)]) {
    for(let k=0;k<65;k++)for(const epsilon of [0,1e-8,-1e-8]) {
      const x=-64+k*2+epsilon;
      for(const [a,b] of [[[x,80,x],[x,-5,x]],[[-70,80,x],[70,-5,x]],[[x,80,-70],[x,-5,70]],
        [[-70,80,-70+epsilon],[70,-5,70+epsilon]],[[x,10,x],[x+epsilon,10-2e-9,x-epsilon]]]) {
        check(s,a,b);check(s,b,a);
      }
    }
    check(s,[0,10,0],[10,10,10]);check(s,[0,10,0],[0,10,0]);
    check(s,[200,80,200],[300,-5,300]);
  }
});

test('corner grazing keeps the old triangle tolerance, including the external DDA counterexample',()=>{
  const s=field(65,(x,z)=>x===32&&z===32?4:2);
  for(const span of [1,11])for(const epsilon of [0,5e-8,1e-7,3e-7]) {
    const a=[-64-span-epsilon,4,-64+span-epsilon],b=[-64+span-epsilon,0,-64-span-epsilon];
    check(s,a,b);check(s,b,a);
    if(epsilon<=5e-8)assert.ok(s.ray(a,b),'tolerated corner remains a hit');
  }
});

test('diagonal row spans reduce actual triangle candidate reads, while thin rectangles keep their fast path',()=>{
  const s=field(129),heights=s.heights;let reads=0;
  s.heights=new Proxy(heights,{get(target,key){if(/^\d+$/.test(String(key)))reads++;return Reflect.get(target,key,target);}});
  const a=[-60,80,-60],b=[60,-5,60],expected=rectangle(s,a,b),before=reads;
  reads=0;assert.deepEqual(value(s.ray(a,b)),expected);const after=reads;
  assert.ok(after<before*.1,`${before} -> ${after} height reads`);
  const axisA=[0,80,-60],axisB=[0,-5,60];reads=0;rectangle(s,axisA,axisB);const axisReads=reads;
  reads=0;s.ray(axisA,axisB);assert.equal(reads,axisReads,'no extra candidate work for thin rectangles');
});
