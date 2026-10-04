const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {modelHarness,assertMesh}=require('../helpers/model-contract.cjs');
const {createRendererStub}=require('../helpers/renderer-stub.cjs');
const types=['fieldlab','researchhub','researchspire'];
test('shared chamfered research meshes are cached, finite, nondegenerate and have three distinct sizes',()=>{
 const h=modelHarness(),meshes={};h.EntityModels.upload({meshes:{},geometry(name,data){if(name.startsWith('civil'))meshes[name]=data;}});
 assert.equal(Object.keys(meshes).length,17);
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
  solid.forEach((c,i)=>{assert.equal(c[9],0);assert.equal(c[10],0);assert.deepEqual(c.slice(1,7),ghost[i].slice(1,7));});
  const feet=solid.filter(c=>c[0]==='box'&&c[4]===.55&&c[6]===.55);assert.ok(feet.length>=12);
  for(const c of feet)assert.ok(Math.abs(c[2]-.04-surface.heightAt(c[1],c[3]))<1e-9,'foot lies on actual terrain');
  const legs=solid.filter(c=>c[0]==='box'&&c[4]===.23);assert.equal(legs.length,feet.length);assert.ok(Math.max(...legs.map(c=>c[5]))-Math.min(...legs.map(c=>c[5]))>.5);
 }
 assert.deepEqual(Array.from(surface.heights),before);
});
