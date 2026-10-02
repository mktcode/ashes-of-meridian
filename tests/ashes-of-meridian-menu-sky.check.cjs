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
  createVertexArray:()=>fail==='vao'?null:create('vao'),createBuffer:()=>create('buffer'),
  deleteProgram:remove,deleteBuffer:remove,deleteVertexArray:remove,
  bindVertexArray:()=>{},bindBuffer:()=>{},bufferData:()=>{},enableVertexAttribArray:()=>{},vertexAttribPointer:()=>{},useProgram:()=>{},
  uniform2f:(k,...v)=>uniforms[k]=v,uniform3fv:(k,v)=>uniforms[k]=Array.from(v),
  uniform1f:(k,v)=>uniforms[k]=v,uniform4f:(k,...v)=>uniforms[k]=v,
  drawArrays:(_mode,_start,count)=>events.push(['draw',count]),
  enable:v=>events.push(['enable',v]),disable:v=>events.push(['disable',v]),clear:v=>events.push(['clear',v])
 };
 const r={gl,width:1920,height:1080,drawCalls:0,fullVao:{},uniformCache:new Map(),
  uniform:(_p,k)=>k,programOf:()=>{if(fail==='program'&&++programCount===2)throw Error('compile failure');return create('program');}};
 return {r,live,events,uniforms};
}
test('menu sky shares one sphere mesh, caches recipes, isolates depth and releases only owned resources',()=>{
 const {MeridianMenuSky}=api(),{r,live,events,uniforms}=fixture(),sky=new MeridianMenuSky(r);
 assert.equal(live.size,4);sky.draw(7,'ground');const first=sky.recipe;
 assert.deepEqual(events.at(-2),['clear',r.gl.DEPTH_BUFFER_BIT]);
 assert.deepEqual(events.at(-1),['disable',r.gl.DEPTH_TEST]);
 assert.equal(events.filter(e=>e[0]==='draw').length,1+first.bodies.length);
 assert.ok(events.some(e=>e[0]==='draw'&&e[1]===48*24*6));
 assert.equal(uniforms.u_aspect,1920/1080);
 sky.draw(7,'ground');assert.strictEqual(sky.recipe,first);assert.equal(live.size,4);
 sky.draw(8,'ground');assert.notStrictEqual(sky.recipe,first);
 r.uniformCache.set(sky.sky,{});r.uniformCache.set(sky.body,{});
 sky.dispose();assert.equal(live.size,0);assert.equal(r.uniformCache.size,0);
});
test('menu backdrop allocation failures clean up earlier GPU allocations',()=>{
 const {MeridianMenuSky}=api();
 for(const fail of ['program','vao']){
  const {r,live}=fixture(fail);assert.throws(()=>new MeridianMenuSky(r));assert.equal(live.size,0);
 }
});
