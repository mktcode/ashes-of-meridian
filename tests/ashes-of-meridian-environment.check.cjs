const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {loadScripts,RENDERER_SCRIPTS}=require('./helpers/game-scripts.cjs');

function runtime() {
  const context=loadScripts(['core','battlefield-design',...RENDERER_SCRIPTS],{globals:{devicePixelRatio:1}});
  const api=vm.runInContext('({Renderer:MeridianRenderer,Thumbnails:MeridianModelThumbnails,defaultLighting:DEFAULT_LIGHTING,factories:BattlefieldEnvironments,profile:DEFAULT_TERRAIN_RENDER_PROFILE})',context);
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
  factories.fixture=renderer=>{
    assert.equal(renderer,r);created++;
    return {skyProg:'citySky',postProg:'cityPost',
      beginFrame:t=>calls.push(['begin',t]),endFrame:()=>calls.push(['end']),
      drawSceneBatches(time,modelTime,...args){assert.equal(time,12);assert.equal(modelTime,4);r.bindSceneProgram(time,modelTime,'city');r.drawBatches(...args);},
      preparePost:()=>calls.push(['preparePost']),frameReady:()=>!pending,
      resize(){resized++;},dispose(){disposed++;}};
  };
  r.setBattlefieldProfile(profile);r.render(12,4);
  const standard=calls.splice(0);assert.equal(created,0);assert.equal(r.frameReady(),true);
  const city={...profile,scenery:'fixture'};
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

test('renderer binds cycle lighting, sky and haze without changing the world profile or preview defaults',()=>{
  const {r,profile,context,Thumbnails,defaultLighting}=runtime();
  const api=vm.runInContext('({battlefieldAtmosphere,battlefieldDayCycle})',context),
    origin=api.battlefieldAtmosphere(profile,{timeOfDay:12},1), before=JSON.stringify(origin), uniforms={};
  r.eye=[0,0,0];
  r.gl.uniform3fv=(name,value)=>{uniforms[name]=Array.from(value);};
  r.setBattlefieldProfile(origin);r.setBattlefieldTime(300);
  r.bindSceneProgram(0,0);
  const night=api.battlefieldDayCycle(origin,300);
  assert.deepEqual(uniforms.u_sun,Array.from(night.lighting.sun));
  assert.deepEqual(uniforms.u_skyLight,Array.from(night.lighting.sky));
  assert.deepEqual(uniforms.u_bounce,Array.from(night.lighting.bounce));
  assert.deepEqual(uniforms.u_atmosphereHorizon,Array.from(night.atmosphere.horizon));
  assert.deepEqual(uniforms.u_haze,Array.from(night.haze));
  assert.equal(JSON.stringify(origin),before);assert.strictEqual(r.battlefieldProfile,origin);
  r.setBattlefieldTime(0);assert.deepEqual(Array.from(r.haze),Array.from(origin.haze));
  r.setBattlefieldTime(300);r.setBattlefieldProfile(origin);
  assert.deepEqual(Array.from(r.haze),Array.from(origin.haze));
  r.useModelPreview();r.setBattlefieldTime(300);
  assert.strictEqual(r.battlefieldProfile,profile);assert.strictEqual(r.haze,profile.haze);
  const thumbnails=new Thumbnails(r);
  r.setBattlefieldProfile(origin);r.setBattlefieldTime(300);
  thumbnails.preview.bindSceneProgram(0,0);
  assert.deepEqual(uniforms.u_sun,Array.from(defaultLighting.sun), 'thumbnail facade never inherits live night lighting');
  r.bindSceneProgram(0,0);
  assert.deepEqual(uniforms.u_sun,Array.from(night.lighting.sun));
});

test('failed or missing environment factories do not silently select the wrong renderer or change the active profile',()=>{
  const {r,factories,profile}=runtime(),city={...profile,scenery:'fixture'};
  delete factories.fixture;
  assert.throws(()=>r.setBattlefieldProfile(city),/Missing render environment/);
  factories.fixture=()=>{throw Error('allocation failed');};
  assert.throws(()=>r.setBattlefieldProfile(city),/allocation failed/);
  assert.equal(r.battlefieldProfile,profile);assert.equal(r.frameReady(),true);
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
