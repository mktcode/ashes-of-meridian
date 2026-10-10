const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {modelHarness,assertMesh}=require('../helpers/model-contract.cjs');
const {assertRecessedMuzzle}=require('../helpers/unit-contract.cjs');
const {createRendererStub}=require('../helpers/renderer-stub.cjs');
function setup(){
 const h=modelHarness(),e={id:17,kind:'unit',type:'hero',faction:0,team:0,x:12,z:-7,
  hp:h.UNITS.hero.hp,size:h.UNITS.hero.size,rot:0,walk:0,cd:0,order:{type:'stop'}};
 let descriptor;const isolated=vm.createContext({registerEntityModel:d=>descriptor=d});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../../dist/src/renderer/models/faction-0-unit-hero.js'),'utf8'),isolated);
 assert.equal(descriptor.id,'faction-0/unit/hero','registration without content, geometry, browser or GPU');
 isolated.geom=h.geom;isolated.ModelMesh=h.ModelMesh;
 const meshes=Object.fromEntries(Object.entries(descriptor.meshes).map(([n,f])=>[n,f()]));
 vm.runInContext('Math.random=seeded=()=>{throw Error("Model RNG")};for(const key of Object.keys(geom))geom[key]=()=>{throw Error("Per-frame geometry")}',h.context);
 function draw(entity=e,time=0,options={},extra={}){
  const r=createRendererStub({record:true});Object.assign(r,extra);
  const before=JSON.stringify(entity);h.renderEntity(r,entity,time,options);
  assert.equal(JSON.stringify(entity),before,'cosmetic scale/poses never mutate simulation');
  assert(r.calls.every(c=>c.slice(1,13).every(Number.isFinite)));
  return r.calls.filter(c=>c[0].startsWith('breachMarshal'));
 }
 return {h,e,descriptor,meshes,draw};
}
function transform(c,p){
 const x=p[0]*c[4],y=p[1]*c[5],z=p[2]*c[6],cy=Math.cos(c[8]),sy=Math.sin(c[8]),cx=Math.cos(c[9]),sx=Math.sin(c[9]),cz=Math.cos(c[10]),sz=Math.sin(c[10]),
  xx=x*cz-y*sz,yy=x*sz+y*cz,vy=yy*cx-z*sx,vz=yy*sx+z*cx;
 return [c[1]+xx*cy+vz*sy,c[2]+vy,c[3]-xx*sy+vz*cy];
}
test('Breach Marshal: independent detailed command armor, closed meshes, breach carbine and hollow muzzle',()=>{
 const {h,e,descriptor,meshes,draw}=setup();
 assert.equal(h.EntityModels.find(e).id,descriptor.id);
 for(const type of ['rifle','medic'])assert.notEqual(h.EntityModels.find({...e,type}).id,descriptor.id);
 for(const faction of [1,2])assert.notEqual(h.EntityModels.find({...e,faction}).id,descriptor.id);
 for(const [name,factory]of Object.entries(descriptor.meshes)){
  assertMesh(factory,{minTriangles:8,maxTriangles:4000,min:[-.8,0,-.65],max:[.8,2.08,1.52]});
  if(name.endsWith('Neutral'))for(let i=6;i<meshes[name].length;i+=9)assert.deepEqual(Array.from(meshes[name].slice(i,i+3)),[1,1,1]);
 }
 const normal=draw();assert.equal(normal.length,13);
 assert(normal.reduce((n,c)=>n+meshes[c[0]].length/27,0)<13000);
 assertRecessedMuzzle(meshes.breachMarshalCarbine,{x:.24,y:1.425,z:1.21,front:.09,recess:.08});
 const colors=new Set();for(const data of Object.values(meshes))for(let i=6;i<data.length;i+=9)colors.add(Array.from(data.slice(i,i+3)).join(','));
 for(const color of ['0.105,0.27,0.3','0.78,0.73,0.58','0.85,0.27,0.075','0.63,0.43,0.19'])assert(colors.has(color));
 assert.equal(normal.find(c=>c[0]==='breachMarshalOptics')[7],0x38d9e8);
 assert.deepEqual(draw({...e,hp:0}),[]);
});
test('Breach Marshal: modest visible enlargement over the old Marshal, without gameplay scaling',()=>{
 const {h,e,meshes,draw}=setup(),normal=draw();let top=0,bottom=Infinity;
 for(const c of normal){
  assert.deepEqual(c.slice(4,7),[1.18,1.18,1.18]);
  for(let i=0;i<meshes[c[0]].length;i+=9){const y=transform(c,meshes[c[0]].slice(i,i+3))[1];top=Math.max(top,y);bottom=Math.min(bottom,y);}
 }
 assert(top>2.35&&top<2.5,'old Marshal was about 2.19; new silhouette is roughly 11% taller');
 assert(bottom>=0&&bottom<.01,'scale is about the floor, not the body center');
 assert.equal(e.size,h.UNITS.hero.size);assert.equal(e.hp,h.UNITS.hero.hp);
});
test('Breach Marshal: team, neutral ghost/tint, alpha, layer and material overrides',()=>{
 const {h,e,draw}=setup();
 for(const rot of [-2.1,0,.7])for(const team of [0,1]){
  const state={...e,rot,team};
  assert.equal(draw(state).find(c=>c[0]==='breachMarshalTeam')[7],team?0xe98680:h.FACTIONS[0].color);
  for(const options of [{ghost:true},{tint:0x99e4c6},{ghost:true,tint:0x99e4c6},{tint:0x99e4c6,alpha:.3,layer:'effects',material:h.MAT.AUTO}]){
   const calls=draw(state,0,options),color=options.ghost?0x68717d:options.tint;
   assert(calls.every(c=>c[7]===color));
   assert(calls.filter(c=>!['breachMarshalOptics','breachMarshalTeam'].includes(c[0])).every(c=>c[0].endsWith('Neutral')));
   for(const c of calls)assert.deepEqual(c.slice(12),[options.alpha??1,options.layer||'dynamic',options.material??h.MAT.METAL]);
  }
  assert.equal(draw(state,0,{localTeam:team}).find(c=>c[0]==='breachMarshalTeam')[7],h.FACTIONS[0].color);
 }
});
test('Breach Marshal: measured walking cadence, articulated legs, idle breathing, stopping and pause',()=>{
 const {e,meshes,draw}=setup(),stand=draw(e,0);
 assert.notDeepEqual(draw(e,.1).find(c=>c[0]==='breachMarshalTorso'),stand.find(c=>c[0]==='breachMarshalTorso'));
 let moved=false;
 for(let i=1;i<=90;i++){
  e.walk+=.03;const calls=draw(e,.1+i*.05);
  if(i>5){
   moved ||= calls.some(c=>c[0]==='breachMarshalLeftShin'&&Math.abs(c[9])>.05);
   for(const name of ['breachMarshalLeftBoot','breachMarshalRightBoot']){
    const c=calls.find(c=>c[0]===name),data=meshes[name];
    for(let k=0;k<data.length;k+=9)assert(transform(c,data.slice(k,k+3))[1]>=-.002,'no feet through floor');
   }
  }
  assert.deepEqual(draw(e,.1+i*.05),calls,'same simulation time freezes pose');
 }
 assert(moved);
 for(let i=1;i<=8;i++)draw(e,4.6+i*.05);
 for(const c of draw(e,5).filter(c=>/Thigh|Shin|Boot/.test(c[0])))assert.deepEqual(c.slice(8,11),[0,0,0]);
 const demo={...e,order:undefined,walk:.4},loop=draw({...demo,walk:.4+Math.PI/2},0),initial=draw(demo,0);
 for(let i=0;i<loop.length;i++)for(const k of [1,2,3,8,9,10])assert(Math.abs(loop[i][k]-initial[i][k])<1e-10,'one cycle per pi/2 travelled, not the old tippy phase');
});
test('Breach Marshal: real-shot recoil and cyan flash preserve both hand and stock contacts',()=>{
 const {h,e,draw}=setup();
 for(const cd of [undefined,0,.1,.49,-3])assert(!draw({...e,cd}).some(c=>c[0]==='breachMarshalFlash'));
 for(const rot of [0,.7,-2.1])for(const age of [0,.02,.06,.12,.2]){
  const calls=draw({...e,rot,cd:h.UNITS.hero.reload-age},.5),weapon=calls.find(c=>c[0]==='breachMarshalCarbine');
  for(const name of ['breachMarshalTorso','breachMarshalLeftArm','breachMarshalRightArm','breachMarshalOptics']){
   const c=calls.find(c=>c[0]===name);assert.deepEqual(c.slice(1,7),weapon.slice(1,7));assert.deepEqual(c.slice(8,11),weapon.slice(8,11));
  }
  const flash=calls.find(c=>c[0]==='breachMarshalFlash');assert.equal(!!flash,age<.04);
  if(flash){assert.equal(flash[7],0x38d9e8);assert(flash[11]>1);}
 }
 assert.notDeepEqual(draw({...e,cd:h.UNITS.hero.reload},0).find(c=>c[0]==='breachMarshalCarbine').slice(8,11),
  draw({...e,cd:h.UNITS.hero.reload-.02},0).find(c=>c[0]==='breachMarshalCarbine').slice(8,11));
});
