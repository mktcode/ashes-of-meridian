const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { modelHarness, assertMesh } = require('../helpers/model-contract.cjs');
const { assertRecessedMuzzle } = require('../helpers/unit-contract.cjs');

// Independent design envelopes, including all limbs/cargo and their cosmetic motion.
// Triangle budgets include every instance, not just unique uploaded geometry; shadows repeat that work.
const specs = [
  [1,'worker',[-.95,-.12,-1.12],[.95,1.25,1.32],4000,14,'choirTenderBody'],
  [1,'rifle',[-.85,-.12,-.85],[.85,2.1,1.35],3200,7,'choirThornlingBody'],
  [1,'medic',[-1.12,-.12,-1.12],[1.12,2.1,1.12],3000,16,'choirLifesingerStem'],
  [1,'tank',[-1.65,-.18,-1.75],[1.65,1.95,2.05],6500,11,'choirRootbeastBody'],
  [1,'artillery',[-1.05,0,-1.55],[1.05,2.7,1.65],6500,6,'choirSporecallerBody'],
  [1,'air',[-2.85,-.15,-1.5],[2.85,1.5,1.5],8500,7,'choirMothwingBody'],
  [1,'hero',[-1.25,-.12,-1.2],[1.25,3.1,1.25],3500,9,'choirFirstVoiceBody'],
  [2,'worker',[-.95,.25,-.9],[.95,1.03,1.5],1400,7,'courtCustodianBody'],
  [2,'rifle',[-.65,.2,-.5],[.65,2.05,1.5],2600,5,'courtPallbearerBody'],
  [2,'medic',[-1,.08,-.5],[1,2.2,.5],1200,8,'courtAbsolverFrame'],
  [2,'tank',[-1.35,.24,-1.5],[1.35,1.5,1.9],2800,6,'courtSepulcherHull'],
  [2,'artillery',[-.9,.17,-1.5],[.9,3.23,1.95],2600,8,'courtElegistSled'],
  [2,'air',[-2.6,.1,-1.95],[2.6,1.3,2.4],1600,6,'courtSeraphHull'],
  [2,'hero',[-1.2,0,-.55],[1.2,2.85,.7],3400,8,'courtUnmaskedBody']
];

function altitude(e,time) {
  return e.type === 'air' ? 3.8+Math.sin(time*2+e.id)*.22 : e.faction===2 ? .3+Math.sin(time*2+e.id)*.08 : 0;
}
function bounds(calls, meshes, e, time) {
  const low=[Infinity,Infinity,Infinity], high=[-Infinity,-Infinity,-Infinity], yaw=e.rot||0;
  for(const c of calls) {
    const data=meshes[c[0]], ry=c[8]-yaw, cy=Math.cos(ry), sy=Math.sin(ry), cx=Math.cos(c[9]), sx=Math.sin(c[9]), cz=Math.cos(c[10]), sz=Math.sin(c[10]);
    const dx=c[1]-e.x, dz=c[3]-e.z, ox=dx*Math.cos(yaw)-dz*Math.sin(yaw), oz=dx*Math.sin(yaw)+dz*Math.cos(yaw);
    assert.ok(data, `uploaded ${c[0]}`);
    for(let i=0;i<data.length;i+=9) {
      const x=data[i]*c[4], y=data[i+1]*c[5], z=data[i+2]*c[6], xx=x*cz-y*sz, yy=x*sz+y*cz, yy2=yy*cx-z*sx, zz=yy*sx+z*cx;
      const p=[ox+xx*cy+zz*sy,c[2]-altitude(e,time)+yy2,oz-xx*sy+zz*cy];
      p.forEach((v,k)=>{low[k]=Math.min(low[k],v);high[k]=Math.max(high[k],v);});
    }
  }
  return {low,high};
}

for(const [faction,type,min,max,budget,instances,primary] of specs) test(`faction-${faction} ${type}: geometry, bounds, budgets, variants and RNG isolation`,()=>{
  const h=modelHarness();
  vm.runInContext('Math.random = seeded = () => { throw Error("Model RNG"); };',h.context);
  let descriptor;
  const isolated=vm.createContext({registerEntityModel:d=>{descriptor=d;}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,`../../dist/src/renderer/models/faction-${faction}-unit-${type}.js`),'utf8'),isolated);
  assert.equal(descriptor.id,`faction-${faction}/unit/${type}`,'registration requires neither content nor GPU');
  isolated.geom=h.geom;isolated.ModelMesh=h.ModelMesh;
  const meshes={};
  for(const [name,factory] of Object.entries(descriptor.meshes)) {
    meshes[name]=assertMesh(factory,{minTriangles:16,maxTriangles:budget,min:[-3,-1.5,-3],max:[3,3.5,3]});
    const data=meshes[name];let volume=0;
    for(let i=0;i<data.length;i+=27) {
      const a=data.slice(i,i+3),b=data.slice(i+9,i+12),c=data.slice(i+18,i+21);
      volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
    }
    assert.ok(volume>0,`${name}: outward closed solids, not inverted shells`);
  }
  for(const name of ['box','octa']) meshes[name]=h.geom[name]();
  const counts=Object.fromEntries(Object.entries(meshes).map(([name,data])=>[name,data.length/27]));
  vm.runInContext('for(const key of Object.keys(geom)) geom[key]=()=>{throw Error("Per-frame geometry");};',h.context);
  const d=h.UNITS[type], e={id:37,kind:'unit',type,faction,team:0,hp:d.hp,size:d.size,x:12,z:-7,rot:.6,walk:0,carry:0};
  assert.equal(h.EntityModels.find(e).id,descriptor.id);
  assert.ok(Object.isFrozen(h.EntityModels.find(e)));
  assert.deepEqual(h.draw({...e,hp:0}),[]);
  for(const time of [0,.7,2.1,9]) for(const walk of [0,.4,2]) {
    const state={...e,walk,carry:10}, calls=h.draw(state,{},time);
    assert.equal(calls.filter(c=>c[0]===primary).length,1);
    assert.ok(calls.length<=instances,`instance budget ${calls.length}/${instances}`);
    const triangles=calls.reduce((n,c)=>n+counts[c[0]],0);
    assert.ok(triangles<=budget,`triangle budget ${triangles}/${budget}`);
    const b=bounds(calls,meshes,state,time);
    b.low.forEach((v,k)=>assert.ok(v>=min[k]-1e-8 && b.high[k]<=max[k]+1e-8,`axis ${k}: ${v}..${b.high[k]} inside ${min[k]}..${max[k]}`));
    assert.deepEqual(calls,h.draw({...state,target:{x:-90,z:3}}, {},time),'no new targeting rule');
  }
  for(const team of [0,1]) for(const rot of [-2,0,.7]) for(const options of [{},{ghost:true},{tint:0x99e4c6,alpha:0},{tint:0x99e4c6,alpha:.3,layer:'effects',material:h.MAT.AUTO}]) {
    const state={...e,team,rot},calls=h.draw(state,options), primaryCall=calls.find(c=>c[0]===primary);
    assert.equal(primaryCall[7],options.ghost?0x68717d:options.tint||h.FACTIONS[faction].metal);
    assert.ok(calls.some(c=>c[7]===(options.tint||(team?0xe98680:h.FACTIONS[faction].color))), 'team signal');
    for(const c of calls) {
      assert.equal(c[12],options.alpha??1);assert.equal(c[13],options.layer||'dynamic');
      assert.equal(c[14],options.material??(faction===1?h.MAT.BIO:h.MAT.METAL));
      if(options.tint)assert.equal(c[7],options.tint,'all accent colors respect previews');
    }
    assert.deepEqual(calls,h.draw({...state,progress:.2},options),'units never acquire building construction scaling');
  }
  const loaded=h.draw({...e,carry:10}), empty=h.draw(e);
  assert.equal(loaded.length-empty.length,type==='worker'?1:0,'cargo is only drawn for loaded workers');
});

test('Tender walks on alternating tripods with visible foot travel and freezes when walk stops',()=>{
  const h=modelHarness(), e={id:37,kind:'unit',type:'worker',faction:1,team:0,hp:100,size:.65,x:0,z:0,rot:0,carry:10};
  vm.runInContext('Math.random = seeded = () => { throw Error("Gait RNG"); }; for(const key of Object.keys(geom)) geom[key]=()=>{throw Error("Gait geometry allocation");};',h.context);
  const draw=walk=>h.draw({...e,walk}), legs=calls=>calls.filter(c=>c[0]==='choirTenderLeg');
  // Center of the baked foot tip, transformed by the recorded hip yaw/roll.
  const toe=c=>{
    const x=.38*Math.cos(c[10])+.43*Math.sin(c[10]), y=.38*Math.sin(c[10])-.43*Math.cos(c[10]);
    return [c[1]+x*Math.cos(c[8])+.04*Math.sin(c[8]),c[2]+y,c[3]-x*Math.sin(c[8])+.04*Math.cos(c[8])];
  };
  const start=draw(0), half=draw(Math.PI/7), forward=legs(draw(Math.PI/14)), back=legs(draw(3*Math.PI/14));
  assert.equal(legs(start).length,6);
  const lifted=calls=>legs(calls).map((c,i)=>toe(c)[1]>.12?i:-1).filter(i=>i>=0);
  assert.deepEqual(lifted(start),[1,3,5],'left middle and right outer legs swing together');
  assert.deepEqual(lifted(half),[0,2,4],'opposite tripod supports the return stroke');
  for(let i=0;i<6;i++) {
    assert.ok(Math.abs(toe(forward[i])[2]-toe(back[i])[2])>.35,'clearly visible fore/aft travel, not just a tiny tilt');
    assert.deepEqual(forward[i].slice(1,4),back[i].slice(1,4),'hips stay attached to the body');
  }
  const stanceStart=legs(draw((Math.PI-.3)/7)), stanceEnd=legs(draw((Math.PI+.3)/7));
  for(const i of [1,3,5]) assert.ok(toe(stanceEnd[i])[2]<toe(stanceStart[i])[2],'planted feet push backward while the body advances along +Z');
  for(let i=0;i<=32;i++) {
    const calls=draw(i*Math.PI/112);
    assert.ok(legs(calls).filter(c=>toe(c)[1]<.04).length>=3,'at least three supporting feet throughout the cycle');
    assert.ok(legs(calls).every(c=>toe(c)[1]>=.029 && toe(c)[1]<.24),'no buried or excessively lifted foot tips');
    assert.deepEqual(calls.filter(c=>c[0]!=='choirTenderLeg'),start.filter(c=>c[0]!=='choirTenderLeg'),'body, baskets, cargo and tools stay unchanged');
  }
  assert.deepEqual(h.draw({...e,walk:.4},{},0),h.draw({...e,walk:.4},{},9),'no time-driven treadmill when stationary');
  assert.deepEqual(draw(undefined),start,'missing preview walk defaults to a finite pose');
});

test('new unit catalog has fourteen distinct assemblies and deliberately different flight animation',()=>{
  const h=modelHarness(), signatures=new Set();
  for(const [faction,type] of specs) {
    const e={id:37,kind:'unit',type,faction,team:0,hp:100,size:1,x:0,z:0,rot:0};
    const calls=h.draw(e);
    signatures.add(calls.map(c=>c[0]).join('|'));
  }
  assert.equal(signatures.size,14);
  const e={id:37,kind:'unit',type:'air',faction:1,team:0,hp:100,size:1,x:0,z:0,rot:0};
  const a=h.draw(e,{},0),b=h.draw(e,{},.2);
  assert.notEqual(a.find(c=>c[0]==='choirMothwingFore')[10],b.find(c=>c[0]==='choirMothwingFore')[10]);
  const right=b.find(c=>c[0]==='choirMothwingFore'),left=b.find(c=>c[0]==='choirMothwingForeLeft');
  assert.equal(right[10],-left[10]);assert.equal(right[3],left[3]);
  const meshes={};h.EntityModels.upload({meshes:{},geometry(name,data){meshes[name]=data;}});
  for(const [r,l] of [['choirMothwingFore','choirMothwingForeLeft'],['choirMothwingHind','choirMothwingHindLeft']]) {
    const points=data=>{const out=[];for(let i=0;i<data.length;i+=9)out.push([data[i],data[i+1],data[i+2]]);return out;};
    assert.deepEqual(points(meshes[r]).map(([x,y,z])=>[-x,y,z]).sort(),points(meshes[l]).sort(),'same wing outline and leading edge on both sides');
  }
  for(const [name,length] of [['choirThornlingMuzzle',.32],['choirRootbeastHorn',.63],['choirSporecallerTrumpet',1.1]])
    assertRecessedMuzzle(meshes[name],{x:0,y:0,z:0,rx:-Math.PI/2,front:length,recess:.15});
  const court0=h.draw({...e,faction:2},{},0),court1=h.draw({...e,faction:2},{},.2);
  assert.deepEqual(court0.map(c=>c.filter((_,i)=>i!==2)),court1.map(c=>c.filter((_,i)=>i!==2)),'Seraph remains rigid; only the existing global flight bob changes');
});
