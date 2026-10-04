const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {loadScripts}=require('./helpers/game-scripts.cjs');
function api(){
 const context=loadScripts(['core','renderer-geometry','renderer-menu-sky']);
 return vm.runInContext('const FULLV="fullscreen vertex fixture"; ({menuSkyRecipe,MeridianMenuSky})',context);
}
const json=value=>JSON.parse(JSON.stringify(value));
test('home sky recipes are deterministic, varied and bounded to three planets plus an optional sun',()=>{
 const {menuSkyRecipe}=api(),modes=new Set(),palettes=new Set();
 for(let seed=0;seed<64;seed++){
  const recipe=menuSkyRecipe(seed,'ground');
  assert.deepEqual(json(recipe),json(menuSkyRecipe(seed,'ground')));
  assert.notDeepEqual(json(recipe),json(menuSkyRecipe(seed,'bio')));
  modes.add(recipe.space);palettes.add(JSON.stringify(recipe.horizon));
  const planets=recipe.bodies.filter(b=>b.kind!==2),suns=recipe.bodies.filter(b=>b.kind===2);
  assert.ok(planets.length>=2&&planets.length<=3);assert.ok(suns.length<=1);
  for(const b of recipe.bodies){
   assert.ok(b.distance>=125&&b.distance<400);
   assert.ok(b.radius>0&&b.radius<.3);
   assert.ok(Math.abs(b.x)<1&&Math.abs(b.y)<1);
   assert.ok(b.color.every(c=>Number.isFinite(c)&&c>=0&&c<=1));
  }
 }
 assert.equal(modes.size,2);assert.ok(palettes.size>=5);
});
function fixture(fail=''){
 let id=0,programCount=0;
 const live=new Set(),events=[],uniforms={},create=kind=>{const handle={kind,id:++id};live.add(handle);return handle;},
   remove=handle=>{assert.ok(live.delete(handle));};
 const gl={
  ARRAY_BUFFER:1,STATIC_DRAW:2,FLOAT:3,TRIANGLES:4,DEPTH_TEST:5,DEPTH_BUFFER_BIT:6,
  FRAMEBUFFER:7,READ_FRAMEBUFFER:8,DRAW_FRAMEBUFFER:9,FRAMEBUFFER_COMPLETE:10,
  TEXTURE0:11,TEXTURE_2D:12,RGBA8:13,RGBA:14,UNSIGNED_BYTE:15,NEAREST:16,
  TEXTURE_MIN_FILTER:17,TEXTURE_MAG_FILTER:18,TEXTURE_WRAP_S:19,TEXTURE_WRAP_T:20,
  CLAMP_TO_EDGE:21,COLOR_ATTACHMENT0:22,COLOR_BUFFER_BIT:23,
  createTexture:()=>{events.push(['allocate']);return fail==='texture'?null:create('texture');},
  createFramebuffer:()=>fail==='framebuffer'?null:create('fbo'),
  deleteTexture:remove,deleteFramebuffer:remove,
  activeTexture:()=>{},bindTexture:()=>{},texParameteri:()=>{},
  texImage2D:(...args)=>events.push(['image',...args]),
  bindFramebuffer:(...args)=>events.push(['bindFbo',...args]),framebufferTexture2D:()=>{},
  checkFramebufferStatus:()=>fail==='incomplete'?0:gl.FRAMEBUFFER_COMPLETE,
  blitFramebuffer:(...args)=>events.push(['blit',...args]),
  uniform1i:(k,v)=>uniforms[k]=v,
  createVertexArray:()=>fail==='vao'?null:create('vao'),createBuffer:()=>create('buffer'),
  deleteProgram:remove,deleteBuffer:remove,deleteVertexArray:remove,
  bindVertexArray:()=>{},bindBuffer:()=>{},bufferData:()=>{},enableVertexAttribArray:()=>{},vertexAttribPointer:()=>{},useProgram:()=>{},
  uniform2f:(k,...v)=>uniforms[k]=v,uniform3fv:(k,v)=>uniforms[k]=Array.from(v),
  uniform1f:(k,v)=>uniforms[k]=v,uniform4f:(k,...v)=>uniforms[k]=v,
  drawArrays:(_mode,_start,count)=>events.push(['draw',count]),
  enable:v=>events.push(['enable',v]),disable:v=>events.push(['disable',v]),clear:v=>events.push(['clear',v])
 };
 const r={gl,width:1920,height:1080,quality:2,sceneSamples:4,sceneMSAAFbo:{sceneMSAA:true},sceneFbo:{scene:true},
  drawCalls:0,fullVao:{},uniformCache:new Map(),
  uniform:(_p,k)=>k,programOf:()=>{if(['program','copy'].includes(fail)&&++programCount===(fail==='copy'?3:2))throw Error('compile failure');return create('program');}};
 return {r,live,events,uniforms};
}
test('menu sky shares one sphere mesh, caches recipes, isolates depth and releases only owned resources',()=>{
 const {MeridianMenuSky}=api(),{r,live,events,uniforms}=fixture(),sky=new MeridianMenuSky(r);
 assert.equal(live.size,5);sky.draw(7,'ground');const first=sky.recipe;
 assert.ok(events.some(e=>e[0]==='clear'&&e[1]===r.gl.DEPTH_BUFFER_BIT));
 assert.ok(events.some(e=>e[0]==='disable'&&e[1]===r.gl.DEPTH_TEST));
 assert.deepEqual(events.at(-1),['bindFbo',r.gl.FRAMEBUFFER,r.sceneMSAAFbo]);
 assert.equal(events.filter(e=>e[0]==='draw').length,1+first.bodies.length);
 assert.ok(events.some(e=>e[0]==='draw'&&e[1]===48*24*6));
 assert.equal(uniforms.u_aspect,1920/1080);
 const count=events.filter(e=>e[0]==='draw').length;
 sky.draw(7,'ground');assert.strictEqual(sky.recipe,first);assert.equal(live.size,7);
 assert.equal(events.filter(e=>e[0]==='draw').length,count+1,'warm frame only copies cached pixels');
 assert.equal(events.filter(e=>e[0]==='blit').length,1,'no warm resolve/readback');
 sky.draw(8,'ground');assert.notStrictEqual(sky.recipe,first);
 r.uniformCache.set(sky.sky,{});r.uniformCache.set(sky.body,{});r.uniformCache.set(sky.copy,{});
 sky.dispose();assert.equal(live.size,0);assert.equal(r.uniformCache.size,0);
});
test('menu sky invalidates pixels for recipes and targets while owning at most one cached image',()=>{
 const {MeridianMenuSky}=api(),{r,live,events}=fixture(),sky=new MeridianMenuSky(r);
 sky.draw(7,'ground');const texture=sky.cacheTexture;
 for(const [seed,family] of [[8,'ground'],[8,'bio']]){
  events.length=0;sky.draw(seed,family);
  assert.strictEqual(sky.cacheTexture,texture,'recipe changes reuse storage');
  assert.equal(events.filter(e=>e[0]==='blit').length,1);
 }
 for(const change of [()=>r.width=900,()=>r.height=1200,()=>r.quality=1,
   ()=>{r.sceneSamples=0;r.sceneMSAAFbo=null;}]){
  const old=sky.cacheTexture;change();events.length=0;sky.draw(8,'bio');
  assert.ok(!live.has(old));assert.equal(live.size,7);
  assert.equal(events.filter(e=>e[0]==='allocate').length,1);
  assert.deepEqual(events.find(e=>e[0]==='image').slice(4,6),[r.width,r.height]);
  assert.deepEqual(events.at(-1),['bindFbo',r.gl.FRAMEBUFFER,r.sceneMSAAFbo||r.sceneFbo]);
  events.length=0;sky.draw(8,'bio');
  assert.deepEqual(events,[['draw',3]],'unchanged frame does not allocate, resolve or modify depth');
 }
 sky.dispose();assert.equal(live.size,0);
});
test('menu sky cache failure keeps original rendering and does not retry each frame or seed',()=>{
 const {MeridianMenuSky}=api();
 for(const fail of ['texture','framebuffer','incomplete']){
  const {r,live,events}=fixture(fail),sky=new MeridianMenuSky(r);
  for(const seed of [7,7,8])sky.draw(seed,'ground');
  assert.equal(live.size,5,'partial cache resources released');
  assert.equal(events.filter(e=>e[0]==='allocate').length,1);
  assert.equal(events.filter(e=>e[0]==='blit').length,0);
  assert.equal(events.filter(e=>e[0]==='clear').length,3,'original planets and depth isolation retained');
  assert.equal(sky.cached,false);
  r.width++;sky.draw(8,'ground');
  assert.equal(events.filter(e=>e[0]==='allocate').length,2,'new size permits retry');
  sky.dispose();assert.equal(live.size,0);
 }
});
test('menu backdrop allocation failures clean up earlier GPU allocations',()=>{
 const {MeridianMenuSky}=api();
 for(const fail of ['program','copy','vao']){
  const {r,live}=fixture(fail);assert.throws(()=>new MeridianMenuSky(r));assert.equal(live.size,0);
 }
});
