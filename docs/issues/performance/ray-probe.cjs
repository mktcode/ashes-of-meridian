'use strict';
// Isolated reproduction of BattlefieldSurface.ray from commit d83d79a9.
// NOT a game/browser/FPS benchmark. Only candidate-cell traversal is changed.
const {performance} = require('node:perf_hooks');
let seed = 40517;
function random() { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }
function makeSurface(size=65,extent=64) {
  const heights=new Float32Array(size*size);let maxHeight=0;
  for(let i=0;i<heights.length;i++) {heights[i]=random()*40;maxHeight=Math.max(maxHeight,heights[i]);}
  return {size,extent,step:2*extent/(size-1),heights,maxHeight};
}
function candidatesDDA(s,a,b,near,far,left,right,top,bottom) {
  const dx=b[0]-a[0],dz=b[2]-a[2];
  let t0=near,t1=far;
  for (const [p,d] of [[a[0],dx],[a[2],dz]]) {
    if(Math.abs(d)<1e-15) {if(p< -s.extent || p>s.extent)return [];}
    else {const p0=(-s.extent-p)/d,p1=(s.extent-p)/d;t0=Math.max(t0,Math.min(p0,p1));t1=Math.min(t1,Math.max(p0,p1));}
  }
  if(t0>t1)return [];
  const col=v=>Math.floor((v+s.extent)/s.step);
  let x=col(a[0]+dx*t0),z=col(a[2]+dz*t0);
  const sx=Math.sign(dx),sz=Math.sign(dz),seen=new Set();
  function add() {
    // One-cell conservative guard preserves original +/-1e-7 edge tolerance.
    for(let zz=z-1;zz<=z+1;zz++)for(let xx=x-1;xx<=x+1;xx++)
      if(xx>=left&&xx<=right&&zz>=top&&zz<=bottom)seen.add(zz*s.size+xx);
  }
  const tx=()=>sx?(((x+(sx>0?1:0))*s.step-s.extent-a[0])/dx):Infinity;
  const tz=()=>sz?(((z+(sz>0?1:0))*s.step-s.extent-a[2])/dz):Infinity;
  add();
  for(let count=0;count<2*s.size+12;count++) {
    const nx=tx(),nz=tz(),t=Math.min(nx,nz);
    if(t>t1 || !Number.isFinite(t))break;
    if(nx<=nz)x+=sx;
    if(nz<=nx)z+=sz;
    add();
  }
  // Same row-major order as original implementation (not needed to reduce min t,
  // retained to make the comparison conservative).
  return [...seen].sort((a,b)=>a-b);
}
function ray(s,a,b,dda=false,stats=null) {
  const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];
  if(Math.abs(dy)<1e-9)return null;
  const t0=-a[1]/dy,t1=(s.maxHeight-a[1])/dy,
    near=Math.max(0,Math.min(t0,t1)),far=Math.min(1,Math.max(t0,t1));
  if(near>far)return null;
  const col=v=>Math.floor((v+s.extent)/s.step),
    left=Math.max(0,col(Math.min(a[0]+dx*near,a[0]+dx*far))),
    right=Math.min(s.size-2,col(Math.max(a[0]+dx*near,a[0]+dx*far))),
    top=Math.max(0,col(Math.min(a[2]+dz*near,a[2]+dz*far))),
    bottom=Math.min(s.size-2,col(Math.max(a[2]+dz*near,a[2]+dz*far)));
  let best=Infinity;
  function cell(row,x) {
    if(stats)stats.cells++;
    const i=row*s.size+x,h=s.heights,wx=x*s.step-s.extent,wz=row*s.step-s.extent;
    for(const [gx,gz,upper] of [[(h[i+s.size+1]-h[i+s.size])/s.step,(h[i+s.size]-h[i])/s.step,1],
      [(h[i+1]-h[i])/s.step,(h[i+s.size+1]-h[i+1])/s.step,0]]) {
      const denominator=dy-gx*dx-gz*dz;
      if(Math.abs(denominator)<1e-9)continue;
      const t=(h[i]+gx*(a[0]-wx)+gz*(a[2]-wz)-a[1])/denominator,
        u=(a[0]+dx*t-wx)/s.step,v=(a[2]+dz*t-wz)/s.step;
      if(t>=0&&t<=1&&t<best&&u>=-1e-7&&u<=1+1e-7&&v>=-1e-7&&v<=1+1e-7&&
        (upper?v>=u-1e-7:u>=v-1e-7))best=t;
    }
  }
  if(dda) for(const i of candidatesDDA(s,a,b,near,far,left,right,top,bottom))cell(Math.floor(i/s.size),i%s.size);
  else for(let row=top;row<=bottom;row++)for(let x=left;x<=right;x++)cell(row,x);
  return Number.isFinite(best)?{x:a[0]+dx*best,z:a[2]+dz*best}:null;
}
const surface=makeSurface();let cases=0,failures=0,oldCells=0,newCells=0;
function check(s,a,b){
  const sa={cells:0},sb={cells:0},x=ray(s,a,b,false,sa),y=ray(s,a,b,true,sb);
  cases++;oldCells+=sa.cells;newCells+=sb.cells;
  if(JSON.stringify(x)!==JSON.stringify(y)){ failures++; if(failures<=3)console.log('mismatch',{a,b,x,y}); }
}
for(let k=0;k<5000;k++) {
  const a=[(random()*2-1)*110,45+random()*90,(random()*2-1)*110],
    b=[(random()*2-1)*110,-5-random()*20,(random()*2-1)*110];
  check(surface,a,b);
}
// Vertical, axis-aligned, exactly diagonal and epsilon-adjacent rays.
for(let k=0;k<65;k++) for(const eps of [0,1e-8,-1e-8]) {
  const x=-64+k*2+eps;
  check(surface,[x,80,x],[x,-5,x]);
  check(surface,[-70,80,x],[70,-5,x]);
  check(surface,[x,80,-70],[x,-5,70]);
  check(surface,[-70,80,-70+eps],[70,-5,70+eps]);
}
const stress=makeSurface(129),a=[-60,80,-60],b=[60,-5,60],sa={cells:0},sb={cells:0};
ray(stress,a,b,false,sa);ray(stress,a,b,true,sb);
for(let k=0;k<400;k++){ray(stress,a,b,false);ray(stress,a,b,true);}
function measure(dda) {const start=performance.now();for(let i=0;i<1000;i++)ray(stress,a,b,dda);return (performance.now()-start)/1000;}
const runs=[];for(let k=0;k<5;k++) runs.push(k%2?{dda:measure(true),rectangle:measure(false)}:{rectangle:measure(false),dda:measure(true)});
console.log(JSON.stringify({runtime:process.version,sourceCommit:'d83d79a90afee1e50704cb9a2b0b2dc830d034c7',
 test:'synthetic heightfield ray query; not game/browser/FPS',cases,failures,
 totalTriangleCandidateCells:{rectangle:oldCells,dda:newCells},
 stressCandidateCells:{rectangle:sa.cells,dda:sb.cells},millisecondsPerQuery:runs},null,2));
if(failures)process.exitCode=1;
