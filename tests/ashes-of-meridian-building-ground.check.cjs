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
  for(const type of ['fieldlab','researchhub','researchspire','embercottage','terracecommons','hearthtower']){
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
    bucket:(map,key,mesh,source,capacity)=>{assert.equal(capacity,1);return map[key]={mesh,source,buffer:key};}},view=new BattlefieldView(R);
  view.world=world;view.drawBuildingGround(entity);view.drawBuildingGround(entity);
  assert.equal(uploads.length,1);assert.equal(calls.length,2);assert.equal(calls[0].at(-1),MAT.LANDSCAPE);
  view.drawBuildingGround({...entity,x:3});assert.equal(uploads.length,2);assert.equal(releases.length,1);
  view.retainBuildingGround([{...entity,hp:0}]);assert.equal(releases.length,2);
  assert.equal(buffers.length,2);assert.equal(Object.keys(R.dynamic).length,0,'instance buffers do not outlive their patch');
  view.drawBuildingGround(entity);assert.equal(uploads.length,3);
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
