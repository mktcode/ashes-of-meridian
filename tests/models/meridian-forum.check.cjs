const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {modelHarness,assertMesh}=require('../helpers/model-contract.cjs');
const {createRendererStub}=require('../helpers/renderer-stub.cjs');
const entity=h=>({id:1,kind:'building',type:'meridianforum',team:0,faction:0,x:0,z:0,hp:950,size:h.BUILDINGS.meridianforum.size,progress:1});

test('Forum caches one shared, finite hull with terraced wings and an unobstructed marked roof landing pad',()=>{
 const h=modelHarness(),meshes={};
 h.EntityModels.upload({meshes:{},geometry(name,data){if(name.startsWith('meridianForum'))meshes[name]=data;}});
 assert.equal(Object.keys(meshes).length,14);
 let triangles=0;
 for(const mesh of Object.values(meshes)){
  assertMesh(()=>mesh,{minTriangles:1,maxTriangles:35000,min:[-8.75,-.05,-6.05],max:[8.75,20.94,6.05]});
  triangles+=mesh.length/27;
 }
 assert.ok(triangles<40000,'bounded static geometry budget');
 h.EntityModels.upload({meshes:{},geometry(name,data){if(name.startsWith('meridianForum'))assert.strictEqual(data,meshes[name],'hull factories reuse their cached arrays');}});
 const {FORUM_MODEL_SCALE:scale,FORUM_DECK_BASE:base}=vm.runInContext('({FORUM_MODEL_SCALE,FORUM_DECK_BASE})',h.context),roof=(35.9-base)*scale;
 const warm=meshes.meridianForumWarm,front=(-3.65+6.8/2+.094+.035/2)*scale;
 let panes=0;
 for(let i=0;i<warm.length;i+=27){
  const points=[0,9,18].map(k=>warm.slice(i+k,i+k+3));
  if(warm[i+5]>.99&&points.every(p=>Math.abs(p[2]-front)<1e-9&&p[1]>(30.3-base)*scale)){
   const span=k=>Math.max(...points.map(p=>p[k]))-Math.min(...points.map(p=>p[k]));
   assert.ok(Math.abs(span(0)-.62)<1e-9&&Math.abs(span(1)-.70)<1e-9,'occupied panes retain the residential window proportions and scale');panes++;
  }
 }
 assert.ok(panes>0,'penthouse has larger residential-style panes');
 for(const material of ['Light','Gold','Cyan'])assert.ok(meshes['meridianForum'+material].some((v,i)=>i%9===1&&v>roof),'landing marks and edge beacons are on the highest roof');
 for(const mesh of Object.values(meshes))for(let i=0;i<mesh.length;i+=9){
  if(Math.abs(mesh[i])<1.4*scale&&Math.abs(mesh[i+2]+3.65*scale)<1.4*scale)
   assert.ok(mesh[i+1]<(36.04-base)*scale,'central touchdown area has no machinery or raised sculpture');
 }
 const e=entity(h),baseDraw=h.draw(e);
 assert.ok(baseDraw.some(c=>c[0].startsWith('meridianForum')));
 for(const faction of [0,1,2])assert.deepEqual(h.draw({...e,faction}),baseDraw,'no research, residential or faction variant');
 assert.ok(baseDraw.every(c=>!['choirMound','hex','ring'].includes(c[0])));
 for(const options of [{ghost:true},{tint:0x89eac5,alpha:.3,layer:'effects'}])
  assert.ok(h.draw(e,options).every(c=>c[7]===(options.ghost?0x68717d:options.tint)));
 assert.ok(h.draw(e,{material:h.MAT.AUTO}).every(c=>c[14]===h.MAT.AUTO));
});

test('Forum terrain support and three wide stairs are level, adaptive, ghost-identical and RNG-neutral',()=>{
 const h=modelHarness(),{BattlefieldSurface,buildingGroundGeometry,civilizationBuildingEntries}=vm.runInContext('({BattlefieldSurface,buildingGroundGeometry,civilizationBuildingEntries})',h.context),
  surface=new BattlefieldSurface(80,2.5,(x,z)=>40+.35*x+.12*z),before=Array.from(surface.heights),e=entity(h);
 const pose=surface.buildingPose(e,e.size);assert.equal(pose.dx,0);assert.equal(pose.dz,0);assert.equal(pose.fill,0);
 assert.equal(buildingGroundGeometry({surface},e).geometry.length,0);
 vm.runInContext('Math.random=seeded=()=>{throw Error("View RNG");};for(const k of Object.keys(geom))geom[k]=()=>{throw Error("Frame geometry");};',h.context);
 const draw=options=>{const R=createRendererStub({record:true});Object.assign(R,{surface,quality:0});h.renderEntity(R,Object.freeze(e),9,options);return R.calls;};
 const solid=draw({}),ghost=draw({ghost:true});assert.equal(solid.length,ghost.length);
 solid.forEach((c,i)=>{assert.deepEqual(c.slice(1,7),ghost[i].slice(1,7));assert.deepEqual(c.slice(8,11),ghost[i].slice(8,11));});
 const feet=solid.filter(c=>c[0]==='box'&&c[4]===.55&&c[6]===.55);
 assert.equal(feet.length,15);
 for(const c of feet)assert.ok(Math.abs(c[2]-.04-surface.heightAt(c[1],c[3]))<1e-9);
 const legs=solid.filter(c=>c[0]==='box'&&c[4]===.23&&c[6]===.25);
 assert.equal(legs.length,15);assert.ok(Math.max(...legs.map(c=>c[5]))-Math.min(...legs.map(c=>c[5]))>1);
 const entries=civilizationBuildingEntries('meridianforum');assert.equal(entries.length,3);
 for(const entry of entries){
  const steps=solid.filter(c=>c[0]==='box'&&Math.abs(c[4]-entry.width)<1e-9);
  assert.ok(steps.length>=9);assert.ok(steps.every(c=>c[9]===0&&c[10]===0),'treads stay horizontal');
 }
 assert.deepEqual(Array.from(surface.heights),before);
});

test('Forum matches the civilian metal/window palette and night accents while retaining warm floors and cyan landing emitters',()=>{
 const h=modelHarness(),R=createRendererStub({record:true}),lights=[];
 Object.assign(R,{quality:1,battlefieldHour:22,addPointLight:(...args)=>lights.push(args)});
 h.renderEntity(R,entity(h),0);
 const warm=R.calls.find(c=>c[0]==='meridianForumWarm'),cyan=R.calls.find(c=>c[0]==='meridianForumCyan');
 const home=h.draw({...entity(h),type:'hearthtower',size:h.BUILDINGS.hearthtower.size}),lab=h.draw({...entity(h),type:'fieldlab',size:h.BUILDINGS.fieldlab.size}),forum=h.draw(entity(h));
 for(const [m,reference] of [['Steel','Steel'],['Wall','Steel'],['Edge','Edge'],['Light','Edge'],['Dark','Dark'],['Roof','Dark'],['Gold','Orange'],['Warm','Warm'],['Dim','Dim'],['Leaf','Leaf'],['Soil','Soil']])
  assert.equal(forum.find(c=>c[0]==='meridianForum'+m)[7],home.find(c=>c[0]==='civilHearthtower'+reference)[7],'shared civilian palette: '+m);
 assert.equal(cyan[7],lab.find(c=>c[0]==='civilFieldlabCyan')[7]);
 const nightHome=createRendererStub({record:true});Object.assign(nightHome,{quality:1,battlefieldHour:22});
 h.renderEntity(nightHome,{...entity(h),type:'hearthtower',size:h.BUILDINGS.hearthtower.size},0);
 assert.equal(warm[11],nightHome.calls.find(c=>c[0]==='civilHearthtowerWarm')[11],'same residential window emission');
 assert.ok(warm[11]>0&&cyan[11]>0);assert.notEqual(warm[7],cyan[7]);
 assert.equal(lights.length,3);assert.equal(lights[0][4],cyan[7]);assert.equal(lights[1][4],warm[7]);assert.equal(lights[2][4],cyan[7]);
 assert.ok(lights[2][1]>lights[1][1],'highest cyan lamp serves the roof pad');
});
