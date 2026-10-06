const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {modelHarness,assertMesh}=require('../helpers/model-contract.cjs');
const {createRendererStub}=require('../helpers/renderer-stub.cjs');
const types=['fieldlab','researchhub','researchspire','embercottage','terracecommons','hearthtower'];
test('shared research and warm residential meshes are cached, finite and nondegenerate',()=>{
 const h=modelHarness(),meshes={};h.EntityModels.upload({meshes:{},geometry(name,data){if(name.startsWith('civil'))meshes[name]=data;}});
 assert.equal(Object.keys(meshes).length,44);
 for(const [name,mesh]of Object.entries(meshes)){
  assertMesh(()=>mesh,{minTriangles:1,maxTriangles:8000,min:[-3.6,-.05,-3],max:[4.2,14,4.2]});
  assert.ok(mesh.length/27<8000,name);
 }
 for(const type of types){
  const e={id:1,kind:'building',type,team:0,faction:0,x:0,z:0,hp:500,size:h.BUILDINGS[type].size,progress:1};
  const base=h.draw(e);
  assert.ok(base.some(c=>c[0].startsWith('civil')));assert.ok(!base.some(c=>['choirMound','hex','ring'].includes(c[0])));
  for(const faction of [0,1,2])assert.deepEqual(h.draw({...e,faction}),base,'same hulls/colors for all factions');
  assert.ok(h.draw(e,{material:h.MAT.AUTO}).every(c=>c[14]===h.MAT.AUTO),'explicit diagnostic material overrides civic metal');
  for(const options of [{ghost:true},{tint:0x89eac5,alpha:.3,layer:'effects'}]){
   const calls=h.draw(e,options);assert.ok(calls.every(c=>c[7]===(options.ghost?0x68717d:options.tint)));
  }
 }
});
test('all six civilian models use normal progress-scaled construction animation and temporary build markers',()=>{
 const h=modelHarness();vm.runInContext('Math.random=seeded=()=>{throw Error("Construction view RNG");};',h.context);
 for(const type of types){
  const e={id:1,kind:'building',type,team:0,faction:0,x:0,z:0,hp:500,size:h.BUILDINGS[type].size,forumId:7},
   draw=progress=>{const R=createRendererStub({record:true});h.renderEntity(R,{...e,progress},0);return R.calls;},
   complete=draw(1),hull=complete.find(c=>c[0].startsWith('civil')&&c[0].endsWith('Steel'));
  for(const progress of [.2,.6]){
   const calls=draw(progress),part=calls.find(c=>c[0]===hull[0]);
   assert.equal(part[5],hull[5]*progress,'height rises continuously with construction progress');
   assert.equal(part[4],hull[4]);assert.equal(part[6],hull[6]);
   assert.ok(calls.some(c=>c[0]==='ring'&&c[13]==='effects'),'construction marker remains until completion');
  }
  assert.ok(!complete.some(c=>c[0]==='ring'&&c[13]==='effects'));
 }
});
test('residential window meshes and posed lights are warm cream, isolated from cyan laboratory glazing',()=>{
 const h=modelHarness();
 for(const type of types){
  const R=createRendererStub({record:true}),lights=[];Object.assign(R,{quality:1,battlefieldHour:22,addPointLight:(...args)=>lights.push(args)});
  h.renderEntity(R,{id:1,kind:'building',type,team:0,faction:0,x:0,z:0,hp:500,size:h.BUILDINGS[type].size,progress:1},0);
  const housing=types.indexOf(type)>=3,windows=R.calls.filter(c=>c[0].endsWith(housing?'Warm':'Window'));
  assert.equal(windows.length,1);assert.equal(windows[0][7],housing?0xffdab0:0x55ccdf);assert.ok(windows[0][11]>0);
  assert.equal(lights[0][4],housing?0xffdab0:0x55d9e9);
  if(housing){
   assert.ok(lights.every(l=>l[4]===0xffdab0),'all residential emitters use the window warmth, including the tower crown');
   const dim=R.calls.find(c=>c[0].endsWith('Dim'));assert.equal(dim[7],0x806e58,'dimmer rooms retain the same natural warm hue');
  }
 }
});
test('civilian decks use minimal height directly under their authored footprints, not nearby uphill peaks',()=>{
 const h=modelHarness(),{BattlefieldSurface,CIVILIZATION_MODEL_SCALE,BUILDING_YAW}=vm.runInContext('({BattlefieldSurface,CIVILIZATION_MODEL_SCALE,BUILDING_YAW})',h.context);
 for(const type of types)for(const team of [0,1]){
  const flat=new BattlefieldSurface(60,2.5,()=>40),e={x:0,z:0,type,team},pose=flat.buildingPose(e,h.BUILDINGS[type].size);
  assert.ok(Math.abs(pose.height-40.1)<1e-9,'flat ground needs only a short footing');
  const surface=new BattlefieldSurface(60,2.5,(x,z)=>40+.8*x+.25*z),d=h.BUILDINGS[type],cs=Math.cos(BUILDING_YAW+(team===1?Math.PI:0)),sn=Math.sin(BUILDING_YAW+(team===1?Math.PI:0));
  let needed=-Infinity;
  for(const deck of d.civilizationDecks){
   const w=(deck.w+.76)/2,depth=(deck.d+.76)/2,cut=.51;
   for(const [x,z]of[[-w+cut,-depth],[w-cut,-depth],[w,-depth+cut],[w,depth-cut],[w-cut,depth],[-w+cut,depth],[-w,depth-cut],[-w,-depth+cut]])
    needed=Math.max(needed,surface.heightAt(CIVILIZATION_MODEL_SCALE*((deck.x+x)*cs+(deck.z+z)*sn),CIVILIZATION_MODEL_SCALE*(-(deck.x+x)*sn+(deck.z+z)*cs))-(deck.top||0)*CIVILIZATION_MODEL_SCALE);
  }
  assert.ok(Math.abs(surface.buildingPose(e,d.size).height-needed-.1)<1e-5,'deck clears the actual slope without extra rectangular margins');
 }
 const peak=new BattlefieldSurface(60,2.5,(x,z)=>40+9*Math.exp(-((x-4)**2+(z-4)**2)/.1));
 assert.ok(peak.buildingPose({x:0,z:0,type:'fieldlab'},h.BUILDINGS.fieldlab.size).height<40.12,'a peak outside the hull cannot hoist the building');
});
test('level civilian decks, posed lights and each footing track the original hillside without grading, mutation or frame geometry',()=>{
 const h=modelHarness(),{BattlefieldSurface,buildingGroundGeometry}=vm.runInContext('({BattlefieldSurface,buildingGroundGeometry})',h.context);
 const surface=new BattlefieldSurface(60,2.5,(x,z)=>40+.35*x+.12*z),before=Array.from(surface.heights);
 vm.runInContext('Math.random=seeded=()=>{throw Error("View RNG");};for(const k of Object.keys(geom))geom[k]=()=>{throw Error("Frame geometry");};',h.context);
 for(const type of types)for(const team of [0,1]){
  const e={id:1,kind:'building',type,team,faction:2,x:1.3,z:.7,hp:500,size:h.BUILDINGS[type].size,progress:1};
  const pose=surface.buildingPose(e,e.size);assert.equal(pose.dx,0);assert.equal(pose.dz,0);assert.equal(pose.fill,0);
  assert.equal(surface.entityHeight(e),pose.height);
  assert.equal(buildingGroundGeometry({surface},e).geometry.length,0);
  const draw=options=>{const R=createRendererStub({record:true});Object.assign(R,{surface,quality:0,battlefieldHour:22});h.renderEntity(R,Object.freeze(e),9,options);return R.calls;};
  const solid=draw({}),ghost=draw({ghost:true});assert.equal(solid.length,ghost.length);
  solid.forEach((c,i)=>{
   if(!(c[0]==='box'&&c[4]===.55&&c[6]===.55)){assert.equal(c[9],0);assert.equal(c[10],0);}
   assert.deepEqual(c.slice(1,7),ghost[i].slice(1,7));assert.deepEqual(c.slice(8,11),ghost[i].slice(8,11));
  });
  const feet=solid.filter(c=>c[0]==='box'&&c[4]===.55&&c[6]===.55);assert.ok(feet.length>=12);
  for(const c of feet){
   assert.ok(Math.abs(c[2]-.04-surface.heightAt(c[1],c[3]))<1e-9,'foot lies on actual terrain');
   const cy=Math.cos(c[8]),sy=Math.sin(c[8]),cx=Math.cos(c[9]),sx=Math.sin(c[9]),cz=Math.cos(c[10]),sz=Math.sin(c[10]),
    nx=-cy*sz+sy*sx*cz,ny=cx*cz,nz=sy*sz+cy*sx*cz;
   assert.ok(Math.abs(nx/ny+.35)<1e-5&&Math.abs(nz/ny+.12)<1e-5,'foot pad follows the local terrain normal');
  }
  const legs=solid.filter(c=>c[0]==='box'&&c[4]===.23);assert.equal(legs.length,feet.length);assert.ok(Math.max(...legs.map(c=>c[5]))-Math.min(...legs.map(c=>c[5]))>.5);
 }
 assert.deepEqual(Array.from(surface.heights),before);
});
