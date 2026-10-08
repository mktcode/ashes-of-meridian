const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {loadScripts,BATTLEFIELD_SCRIPTS,RENDERER_SCRIPTS} = require('./helpers/game-scripts.cjs');
const {createRendererStub} = require('./helpers/renderer-stub.cjs');
const context = loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world',...RENDERER_SCRIPTS,'world-view']);
const {BattlefieldSurface,buildingGroundGeometry,buildingGroundFrame,BattlefieldView,renderEntity,MAT} = vm.runInContext(
  '({BattlefieldSurface,buildingGroundGeometry,buildingGroundFrame,BattlefieldView,renderEntity,MAT})',context);
const entity = {id:7,kind:'building',type:'hq',x:.3,z:.7,size:4.4,hp:100,progress:1,team:0,faction:0};
function worldFor(slope,material='LANDSCAPE') {
  const extent=40,step=1.25,size=67,colors=new Float32Array(size*size*3);
  for(let i=0;i<colors.length;i+=3) colors.set([.2,.6,.1],i);
  return {surface:new BattlefieldSurface(extent,2.5,(x,z)=>20+slope*x+slope*.3*z),
    renderData:{groundColors:[],geometries:[{mesh:'terrain',relief:{extent,step,size,colors}}],placements:[{mesh:'terrain',material}]}};
}

test('building support balances a bounded lean with minimum fill, including off-grid footprint edges',()=>{
  for(const slope of [0,.025,.10]) {
    const world=worldFor(slope),surface=world.surface,heights=Array.from(surface.heights),pose=surface.buildingPose(entity,entity.size),
      frame=buildingGroundFrame(pose,1,0),r=entity.size*1.08;
    assert.ok(Math.hypot(pose.dx,pose.dz)<=.045+1e-12);
    for(const x of [entity.x-r,entity.x,entity.x+r])for(const z of [entity.z-r,entity.z,entity.z+r])
      assert.ok(pose.height+pose.dx*(x-entity.x)+pose.dz*(z-entity.z)>=surface.heightAt(x,z)-1e-6);
    if(slope===0)assert.equal(frame,null);
    else assert.ok(frame[4]>=1/Math.hypot(1,.045)-1e-12);
    if(slope<.04)assert.ok(Math.abs(pose.height-surface.heightAt(entity.x,entity.z))<1e-5,'gentle grade needs no raised platform');
    else assert.ok(pose.height<surface.foundationBounds(entity,entity.size).max-.2);
    assert.deepEqual(Array.from(surface.heights),heights);
    assert.equal(surface.entityHeight(entity),pose.height,'picking/effects and model datum agree');
  }
});

test('rotated civilian decks and adaptive feet follow visual terrain support without changing CPU clearance',()=>{
  const {civilizationClearanceFootprints,civilizationDeckFootprints}=vm.runInContext('({civilizationClearanceFootprints,civilizationDeckFootprints})',context);
  const surface=new BattlefieldSurface(40,2.5,(x,z)=>20+.4*x+.15*z),before=Array.from(surface.heights),R=createRendererStub({record:true});
  R.surface=surface;R.quality=0;
  for(const type of ['fieldlab','researchhub','researchspire','embercottage','terracecommons','hearthtower','meridianforum']){
    const e={...entity,type,size:4.2},clearance=JSON.stringify(civilizationClearanceFootprints(e,type,0));
    for(const visualRotation of [0,1/3,3,23/3]){
      const rotated=Object.freeze({...e,visualRotation}),pose=surface.buildingPose(rotated,rotated.size);
      assert.equal(pose.height,surface.entityHeight(rotated));
      for(const {polygon,top} of civilizationDeckFootprints(rotated,type,0,visualRotation))for(const p of polygon)
        assert.ok(pose.height+top>=surface.heightAt(p.x,p.z),'rotated decks do not sink into the slope');
      assert.equal(JSON.stringify(civilizationClearanceFootprints(rotated,type,0)),clearance,'CPU clearance remains fixed');
      R.calls.length=0;renderEntity(R,rotated,0);
      assert.ok(R.calls.length);assert.ok(R.calls.every(c=>c.slice(1,13).every(Number.isFinite)));
    }
  }
  assert.deepEqual(Array.from(surface.heights),before);
});

test('visual grading uses the terrain material/weights and blends into the original grid without walls',()=>{
  const world=worldFor(.10),before=Array.from(world.surface.heights),patch=buildingGroundGeometry(world,entity),step=world.surface.step,pose=world.surface.buildingPose(entity,entity.size);
  assert.equal(patch.material,MAT.LANDSCAPE);assert.ok(patch.geometry.length>0);
  assert.deepEqual(patch.geometry,buildingGroundGeometry(world,entity).geometry);
  let raised=0,rim=0;
  for(let i=0;i<patch.geometry.length;i+=9){
    const [x,y,z,nx,ny,nz,a,b,c]=patch.geometry.slice(i,i+9),base=world.surface.heightAt(x,z)-.13;
    assert.ok([x,y,z,nx,ny,nz,a,b,c].every(Number.isFinite));
    assert.ok(y>=base-1e-6);assert.ok(y-base<=pose.fill+1e-6);assert.ok(ny>.8,'only low, blended grading, not vertical walls');
    assert.ok(Math.abs((x+40)/step-Math.round((x+40)/step))<1e-9);
    assert.ok(Math.abs(a-.2)<1e-6&&Math.abs(b-.6)<1e-6&&Math.abs(c-.1)<1e-6);
    if(y-base>.01)raised++;
    if(Math.max(Math.abs(x-entity.x),Math.abs(z-entity.z))>=entity.size*1.18+3){assert.ok(Math.abs(y-base)<1e-6);rim++;}
  }
  assert.ok(raised&&rim);assert.deepEqual(Array.from(world.surface.heights),before);
  assert.equal(buildingGroundGeometry(worldFor(0),entity).geometry.length,0);
  assert.equal(buildingGroundGeometry(worldFor(.025),entity).geometry.length,0,'no gratuitous base on gentle planar ground');
  assert.equal(buildingGroundGeometry(worldFor(.10,'METAL'),entity).material,MAT.METAL,'deck keeps deck material');
});

test('graded terrain is cached and released when the building is removed or relocated',()=>{
  const world=worldFor(.10),uploads=[],releases=[],calls=[],buffers=[],R={dynamic:{},gl:{deleteBuffer:b=>buffers.push(b)},
    geometry:(...a)=>uploads.push(a),releaseGeometry:n=>releases.push(n),add:(...a)=>calls.push(a),
    releaseBucket(bucket){this.gl.deleteBuffer(bucket.buffer);},
    bucket:(map,key,mesh,source,capacity)=>{assert.equal(capacity,1);return map[key]={mesh,source,buffer:key};}},view=new BattlefieldView(R);
  view.world=world;view.drawBuildingGround(entity);view.drawBuildingGround(entity);
  assert.equal(uploads.length,1);assert.equal(calls.length,2);assert.equal(calls[0].at(-1),MAT.LANDSCAPE);
  view.drawBuildingGround({...entity,x:3});assert.equal(uploads.length,2);assert.equal(releases.length,1);
  view.retainBuildingGround([{...entity,hp:0}]);assert.equal(releases.length,2);
  assert.equal(buffers.length,2);assert.equal(Object.keys(R.dynamic).length,0,'instance buffers do not outlive their patch');
  view.drawBuildingGround(entity);assert.equal(uploads.length,3);
});

test('building support cache reuses exact terrain results and invalidates every pose input',()=>{
  const surface=worldFor(.10).surface,e={...entity},before=JSON.stringify(e),heightAt=surface.heightAt.bind(surface);
  let samples=0;surface.heightAt=(...args)=>{samples++;return heightAt(...args);};
  const initial=surface.buildingPose(e,e.size);
  assert.ok(samples>0);assert.ok(Object.isFrozen(initial));
  samples=0;
  assert.strictEqual(surface.buildingPose(e,e.size),initial);
  assert.equal(surface.entityHeight(e),initial.height);assert.equal(samples,0,'warm height lookup does not sample terrain');
  assert.equal(JSON.stringify(e),before,'cache never adds state to an entity');
  e.hp=55;e.progress=.5;e.rot=1.4;e.faction=2;
  assert.strictEqual(surface.buildingPose(e,e.size),initial,'damage, progress, faction and weapon angle do not alter support');
  for(const change of [{x:3.1},{z:-2.4},{size:5.7},{type:'fieldlab'},{team:1},{visualRotation:1/3},
    {type:'researchspire',size:4.2},{type:'meridianforum'},{type:'hq'}]) {
    const old=surface.buildingPose(e,e.size);Object.assign(e,change);samples=0;
    const pose=surface.buildingPose(e,e.size);
    assert.ok(samples>0);assert.notStrictEqual(pose,old);
    assert.deepEqual(pose,surface.computeBuildingPose(e,e.size),'cache miss retains the original formula');
    samples=0;assert.strictEqual(surface.buildingPose(e,e.size),pose);assert.equal(samples,0);
  }
  const old=surface.buildingPose(e,e.size),other=worldFor(.025).surface;
  assert.notStrictEqual(other.buildingPose(e,e.size),old,'same object cannot carry a pose into another world');
  assert.deepEqual(other.buildingPose(e,e.size),other.computeBuildingPose(e,e.size));
  const copy=Object.freeze({...e});
  assert.notStrictEqual(surface.buildingPose(copy,copy.size),old,'restore/new object with the same ID gets its own entry');
  assert.deepEqual(surface.buildingPose(copy,copy.size),old);
});

test('building contact shadows cache accepted and rejected footprints, never moving units',()=>{
  const {contactShadowPose,computeContactShadowPose}=vm.runInContext('({contactShadowPose,computeContactShadowPose})',context);
  for(const curved of [false,true]) {
    const surface=new BattlefieldSurface(40,2.5,(x,z)=>20+.025*x+(curved?.03*z*z:0)),e={...entity},heightAt=surface.heightAt.bind(surface);
    let samples=0;surface.heightAt=(...args)=>{samples++;return heightAt(...args);};
    const pose=contactShadowPose(surface,e,12,10,.3);
    assert.ok(samples>0);if(curved)assert.equal(pose,null);else assert.ok(Object.isFrozen(pose));
    samples=0;assert.strictEqual(contactShadowPose(surface,e,12,10,.3),pose);assert.equal(samples,0);
    for(const [change,width,depth,yaw] of [[{x:2},12,10,.3],[{z:3},12,10,.3],[{},14,10,.3],[{},14,8,.3],[{},14,8,.9]]) {
      Object.assign(e,change);samples=0;
      const result=contactShadowPose(surface,e,width,depth,yaw);assert.ok(samples>0);
      assert.deepEqual(result,computeContactShadowPose(surface,e,width,depth,yaw));
      samples=0;assert.strictEqual(contactShadowPose(surface,e,width,depth,yaw),result);assert.equal(samples,0);
    }
    const other=worldFor(.10).surface;
    assert.deepEqual(contactShadowPose(other,e,14,8,.9),computeContactShadowPose(other,e,14,8,.9));
    e.kind='unit';samples=0;contactShadowPose(surface,e,14,8,.9);assert.ok(samples>0);
    samples=0;contactShadowPose(surface,e,14,8,.9);assert.ok(samples>0,'units still sample on every draw');
  }
});

test('warm building poses preserve every submitted model transform, animation and preview',()=>{
  for(const type of ['hq','turret','fieldlab','hearthtower','meridianforum']) {
    const world=worldFor(.10),e=Object.freeze({...entity,type,visualRotation:1/3}),R=createRendererStub({record:true});
    R.surface=world.surface;R.quality=2;
    const original=world.surface.buildingPose.bind(world.surface);let poses=0,heightLookups=0;
    world.surface.buildingPose=(...args)=>{poses++;return original(...args);};
    world.surface.entityHeight=()=>{heightLookups++;throw Error('model resampled its shared datum');};
    const draw=(object,time,options)=>{R.calls.length=0;renderEntity(R,object,time,options);return R.calls.map(c=>[...c]);};
    for(const time of [0,3])for(const options of [{},{ghost:true},{tint:0x99e4c6,alpha:.3,layer:'effects'}]) {
      const cold=draw(Object.freeze({...e}),time,options);poses=0;
      assert.deepEqual(draw(e,time,options),cold);assert.equal(poses,1,'height and frame share one pose lookup');
      assert.deepEqual(draw(e,time,options),cold,'warm rendering matches a fresh uncached object');
    }
    assert.equal(heightLookups,0);
  }
});

function civilianGroundHarness(surface=worldFor(.10).surface) {
  const R=createRendererStub({record:true}),lamps=[],outlines=[];
  let samples=0;
  R.quality=0;
  R.addPointLight=(...args)=>lamps.push(args);
  R.recordOcclusion=(...args)=>outlines.push(args);
  const setSurface=surface=>{
    if(surface){const heightAt=surface.heightAt.bind(surface);surface.heightAt=(...args)=>{samples++;return heightAt(...args);};}
    R.surface=surface;
  };
  setSurface(surface);
  return {R,setSurface,get samples(){return samples;},resetSamples(){samples=0;},
    draw(e,time=0,options={}) {
      R.calls.length=lamps.length=outlines.length=0;
      renderEntity(R,e,time,options);
      return {parts:R.calls.map(c=>[...c]),lamps:lamps.map(c=>[...c]),outlines:outlines.map(c=>[...c])};
    }};
}

test('model ground recipes cache only raw parts, separate previews and keep unowned terrain callbacks live',()=>{
  const create=vm.runInContext('createModelGroundParts',context),drawGround=create(),calls=[];
  const pose=Object.freeze({height:2,dx:0,dz:0,fill:0});
  let builds=0,tint;
  const ctx={groundPose:pose,part:(...args)=>calls.push(args),surfaceColor:color=>tint??color};
  const build=p=>{builds++;p('box',1,2,3,.55,.15,.55,0x123456,0,.3,0,0,undefined,MAT.METAL);};
  drawGround(ctx,build);const original=[...calls[0]];assert.equal(builds,1);
  tint=0x99e4c6;calls.length=0;
  drawGround(ctx,()=>assert.fail('warm ground recipe was rebuilt'));
  assert.deepEqual(calls[0],original.map((value,index)=>index===7?tint:value));
  ctx.groundPreview=true;calls.length=0;drawGround(ctx,build);assert.equal(builds,2);
  tint=0xf39989;calls.length=0;drawGround(ctx,()=>assert.fail('preview tint invalidated geometry'));
  assert.deepEqual(calls[0],original.map((value,index)=>index===7?tint:value));
  ctx.groundPose=Object.freeze({...pose});drawGround(ctx,build);assert.equal(builds,3);
  delete ctx.groundPose;
  drawGround(ctx,build);drawGround(ctx,build);assert.equal(builds,5,'callbacks without a pose token are never cached');
});

test('civilian ground recipes reuse all six buildings and Forum feet, stairs and rails without terrain reads',()=>{
  const h=civilianGroundHarness(),before=Array.from(h.R.surface.heights);
  for(const type of ['fieldlab','researchhub','researchspire','embercottage','terracecommons','hearthtower','meridianforum']) {
    const e=Object.freeze({...entity,type,visualRotation:1/3}),saved=JSON.stringify(e);
    h.resetSamples();const cold=h.draw(e);assert.ok(h.samples>0);
    h.resetSamples();assert.deepEqual(h.draw(e),cold);
    assert.equal(h.samples,0,`${type}: unchanged support never samples terrain`);
    assert.equal(JSON.stringify(e),saved,'render recipes never add fields to buildings');
  }
  assert.deepEqual(Array.from(h.R.surface.heights),before);
});

test('civilian ground recipes follow placement, model, ownership, surface and restored object changes',()=>{
  for(const type of ['fieldlab','meridianforum']) {
    const h=civilianGroundHarness(),e={...entity,type,visualRotation:1/3};
    const check=()=>{
      h.resetSamples();const cold=h.draw(e);assert.ok(h.samples>0,'changed inputs rebuild terrain-dependent geometry');
      h.resetSamples();assert.deepEqual(h.draw(e),cold);assert.equal(h.samples,0);
      const fresh=Object.freeze({...e});h.resetSamples();assert.deepEqual(h.draw(fresh),cold);
      assert.ok(h.samples>0,'restored/new object with the same ID gets its own support recipe');
    };
    check();
    for(const change of [{x:3.1},{z:-2.4},{visualRotation:2/3},{team:1},{size:5.7},
      {type:'researchhub'},{type:'hearthtower'},{type:'meridianforum'}]) {Object.assign(e,change);check();}
    const other=worldFor(.025).surface;h.setSurface(other);check();
    const saved=JSON.stringify(e);h.setSurface(null);
    const flat=h.draw(e);assert.deepEqual(h.draw(e),flat,'terrain-free thumbnails preserve the direct model path');
    assert.equal(JSON.stringify(e),saved);
  }
});

test('civilian ground recipes keep progress, factions, night lamps, tint, alpha, materials and occlusion live',()=>{
  for(const type of ['fieldlab','hearthtower','meridianforum']) {
    const h=civilianGroundHarness(),e={...entity,type,visualRotation:1/3};
    h.R.quality=2;h.R.battlefieldHour=12;
    const day=h.draw(e,0,{occlusion:true});
    assert.ok(day.outlines.length);assert.equal(day.lamps.length,0);
    h.R.battlefieldHour=22;h.resetSamples();const night=h.draw(e,3,{occlusion:true});
    assert.equal(h.samples,0);assert.ok(night.lamps.length);assert.notDeepEqual(night.parts,day.parts);
    assert.deepEqual(night,h.draw(Object.freeze({...e}),3,{occlusion:true}));
    e.progress=.35;e.faction=2;e.hp=55;e.rot=1.4;
    h.resetSamples();const partial=h.draw(e,5);assert.equal(h.samples,0,'construction and faction do not rebuild terrain parts');
    assert.equal(partial.lamps.length,0);assert.deepEqual(partial,h.draw(Object.freeze({...e}),5));
    e.progress=1;
    h.resetSamples();const ghost=h.draw(e,5,{ghost:true});
    assert.ok(h.samples>0,'the first preview builds a separate recipe');assert.equal(ghost.lamps.length,0);
    assert.deepEqual(ghost,h.draw(Object.freeze({...e}),5,{ghost:true}));
    for(const options of [{tint:0x99e4c6,alpha:.3,layer:'effects'},
      {tint:0xf39989,alpha:.6,layer:'effects',material:MAT.ROCK},{ghost:true}]) {
      h.resetSamples();const warm=h.draw(e,7,options);assert.equal(h.samples,0,'preview colour changes never resample terrain');
      assert.equal(warm.lamps.length,0);assert.deepEqual(warm,h.draw(Object.freeze({...e}),7,options));
    }
    h.resetSamples();const solid=h.draw(e,9,{occlusion:true});assert.equal(h.samples,0,'previews leave the solid recipe intact');
    assert.deepEqual(solid,h.draw(Object.freeze({...e}),9,{occlusion:true}));
  }
});

test('buildings lean as rigid models without extra rock bases; placement ghosts share the pose',()=>{
  const world=worldFor(.10),R=createRendererStub({record:true});R.surface=world.surface;R.quality=0;
  const draw=options=>{R.calls.length=0;renderEntity(R,entity,0,options);return R.calls.map(c=>[...c]);};
  const solid=draw({}),ghost=draw({ghost:true}),pose=world.surface.buildingPose(entity,entity.size);
  assert.ok(solid.length);assert.ok(!solid.some(c=>c[0]==='terrainFooting'));
  assert.equal(solid.length,ghost.length);
  solid.forEach((c,i)=>{
    assert.deepEqual(c.slice(1,7),ghost[i].slice(1,7));assert.deepEqual(c.slice(8,11),ghost[i].slice(8,11));
    assert.ok(Math.abs(c[9])+Math.abs(c[10])>0,'all parts receive the shared lean');
  });
  assert.ok(pose.height<world.surface.foundationBounds(entity,entity.size).max);
});
