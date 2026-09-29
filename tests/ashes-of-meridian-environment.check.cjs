const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {loadScripts,RENDERER_SCRIPTS}=require('./helpers/game-scripts.cjs');

function runtime() {
  const context=loadScripts(['core',...RENDERER_SCRIPTS],{globals:{devicePixelRatio:1}});
  const api=vm.runInContext('({Renderer:MeridianRenderer,factories:BattlefieldEnvironments,profile:DEFAULT_TERRAIN_RENDER_PROFILE})',context);
  const calls=[];let program;
  const gl=new Proxy({useProgram:p=>{program=p;},drawArrays:()=>calls.push(['quad',program])},
    {get:(o,k)=>k in o?o[k]:/^[A-Z0-9_]+$/.test(k)?k:()=>{}});
  const r=Object.assign(Object.create(api.Renderer.prototype),{gl,battlefieldProfile:api.profile,
    program:'standard',skyProg:'sky',postProg:'post',depthProg:'shadow',frame:0,quality:1,
    static:{},dynamic:{},effects:{},bloomTargets:[],sceneSamples:0,haze:api.profile.haze,
    canvas:{getBoundingClientRect:()=>({left:0,top:0,width:100,height:80})},
    upload(){},uniform:(_,name)=>name,drawBatches:()=>calls.push(['batch',program])});
  return {...api,context,r,calls};
}

test('common renderer lazily owns map presentation, keeps shadow passes, and restores normal/model previews',()=>{
  const {r,calls,factories,profile}=runtime();let created=0,disposed=0,resized=0,pending=true;
  factories.aurelion=renderer=>{
    assert.equal(renderer,r);created++;
    return {skyProg:'citySky',postProg:'cityPost',
      beginFrame:t=>calls.push(['begin',t]),endFrame:()=>calls.push(['end']),
      drawSceneBatches(time,modelTime,...args){assert.equal(time,12);assert.equal(modelTime,4);r.bindSceneProgram(time,modelTime,'city');r.drawBatches(...args);},
      preparePost:()=>calls.push(['preparePost']),frameReady:()=>!pending,
      resize(){resized++;},dispose(){disposed++;}};
  };
  r.setBattlefieldProfile(profile);r.render(12,4);
  const standard=calls.splice(0);assert.equal(created,0);assert.equal(r.frameReady(),true);
  const city={...profile,scenery:'aurelion'};
  r.setBattlefieldProfile(city);r.setBattlefieldProfile({...city});
  assert.equal(created,1,'same environment is reused across worlds with the same scenery');
  assert.equal(r.frameReady(),false);pending=false;assert.equal(r.frameReady(),true);
  r.resize();assert.equal(resized,1);r.render(12,4);
  assert.deepEqual(calls.filter(c=>c[0]==='batch').map(c=>c[1]),['shadow','shadow','city','city','city','city','city']);
  assert.deepEqual(calls.filter(c=>c[0]==='quad').map(c=>c[1]),['citySky','cityPost']);
  assert.deepEqual(calls[0],['begin',4]);assert.deepEqual(calls.at(-1),['end']);
  assert.ok(calls.findIndex(c=>c[0]==='preparePost')<calls.findIndex(c=>c[1]==='cityPost'));
  assert.equal(r.program,'standard');assert.equal(r.skyProg,'sky');assert.equal(r.postProg,'post');
  r.setBattlefieldProfile(profile);assert.equal(disposed,1);assert.equal(r.frameReady(),true);
  calls.length=0;r.render(12,4);assert.deepEqual(calls,standard,'normal pass ordering and program selection are unchanged');
  r.setBattlefieldProfile(city);r.surface={};r.useModelPreview();
  assert.equal(created,2);assert.equal(disposed,2);assert.equal(r.surface,null);
  assert.equal(r.battlefieldProfile,profile);
  r.setBattlefieldProfile(city);r.releaseEnvironment();r.releaseEnvironment();assert.equal(disposed,3);
  r.setBattlefieldProfile(city);assert.equal(created,4,'explicit release can be followed by reactivation');
});

test('failed or missing environment factories do not silently select the wrong renderer or change the active profile',()=>{
  const {r,factories,profile}=runtime(),city={...profile,scenery:'aurelion'};
  delete factories.aurelion;
  assert.throws(()=>r.setBattlefieldProfile(city),/Missing render environment/);
  factories.aurelion=()=>{throw Error('allocation failed');};
  assert.throws(()=>r.setBattlefieldProfile(city),/allocation failed/);
  assert.equal(r.battlefieldProfile,profile);assert.equal(r.frameReady(),true);
});

test('Aurelion owns and releases only its programs, textures, depth targets and fences, including partial construction',()=>{
  for(const failure of [null,'program1','program2','program3','texture1','texture2','atlas']) {
    const {context,r}=runtime(),programs=new Set(),textures=new Set(),fbos=new Set(),fences=new Set();
    let programCount=0,textureCount=0;
    vm.runInContext(`createAurelionAdvertisingAtlas=()=>{${failure==='atlas'?'throw Error("atlas failed");':'return {};'}}`,context);
    const Atmosphere=vm.runInContext('AurelionAtmosphere',context);
    r.uniformCache=new Map([['shared',{}]]);
    r.programOf=()=>{if(failure===`program${++programCount}`)throw Error('program failed');const p={};programs.add(p);r.uniformCache.set(p,{});return p;};
    r.gl=new Proxy({
      createTexture(){if(failure===`texture${++textureCount}`)return null;const t={};textures.add(t);return t;},
      createFramebuffer(){const f={};fbos.add(f);return f;},
      deleteTexture(t){if(t)assert.ok(textures.delete(t));},deleteFramebuffer(f){if(f)assert.ok(fbos.delete(f));},
      deleteProgram(p){assert.ok(programs.delete(p));},
      fenceSync(){const f={};fences.add(f);return f;},deleteSync(f){assert.ok(fences.delete(f));},
      checkFramebufferStatus:()=> 'FRAMEBUFFER_COMPLETE',getError:()=> 'NO_ERROR'
    },{get:(o,k)=>k in o?o[k]:/^[A-Z0-9_]+$/.test(k)?k:()=>{}});
    if(failure)assert.throws(()=>new Atmosphere(r),/failed|allocate/);
    else {
      const atmosphere=new Atmosphere(r);assert.equal(programs.size,3);assert.equal(textures.size,2);
      r.width=100;r.height=80;r.quality=0;
      atmosphere.beginFrame();atmosphere.preparePost();atmosphere.endFrame();
      assert.equal(textures.size,2,'first Performance frame allocates no depth target');assert.equal(fences.size,1);
      r.quality=2;atmosphere.preparePost();assert.equal(textures.size,3);assert.equal(fbos.size,1);
      atmosphere.resize();assert.equal(textures.size,2);assert.equal(fbos.size,0);
      atmosphere.dispose();atmosphere.dispose();
    }
    assert.equal(programs.size+textures.size+fbos.size+fences.size,0,failure||'normal disposal');
    assert.deepEqual([...r.uniformCache.keys()],['shared'],'common program/uniform ownership stays with the renderer');
  }
});

test('program compilation releases intermediate shaders on success and every allocation/compile/link failure',()=>{
  for(const failure of [null,'program','shader1','shader2','compile','link']) {
    const {r}=runtime(),shaders=new Set(),attached=new Set();let alive=false,count=0;
    r.gl={VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,
      createProgram(){if(failure==='program')return null;alive=true;return {};},
      createShader(){if(failure===`shader${++count}`)return null;const s={};shaders.add(s);return s;},
      attachShader:(_,s)=>attached.add(s),detachShader(_,s){assert.equal(alive,true);assert.ok(attached.delete(s));},
      deleteShader:s=>shaders.delete(s),deleteProgram(){assert.equal(attached.size,0);alive=false;},
      shaderSource(){},compileShader(){},linkProgram(){},getShaderParameter:()=>failure!=='compile',
      getProgramParameter:()=>failure!=='link',getShaderInfoLog:()=>null,getProgramInfoLog:()=>null};
    if(failure)assert.throws(()=>r.programOf('vertex','fragment'),/allocate|failed/);
    else assert.ok(r.programOf('vertex','fragment'));
    assert.equal(shaders.size,0);assert.equal(attached.size,0);assert.equal(alive,failure===null);
  }
});
