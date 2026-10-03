// Shared Westmark art survives; the old authored map/bridge navigation recipe does not.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readFileSync}=require('node:fs'),{join}=require('node:path');
const {loadScripts,BATTLEFIELD_SCRIPTS,RENDERER_SCRIPTS}=require('./helpers/game-scripts.cjs');
const context=loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world',...RENDERER_SCRIPTS]);
const {Battlefield,BattlefieldBuilder,BattlefieldSurface,BATTLEFIELDS,TerrainModels,MeridianRenderer,MERIDIAN_TEXTURES}=
  vm.runInContext('({Battlefield,BattlefieldBuilder,BattlefieldSurface,BATTLEFIELDS,TerrainModels,MeridianRenderer,MERIDIAN_TEXTURES})',context);

test('foundation margins retain strict map bounds without blocking movement',()=>{
  const s=new BattlefieldSurface(10,2,()=>0);
  assert.equal(s.foundation({x:6.9,z:-2},2),true);
  assert.equal(s.foundation({x:7,z:-2},2),false);
  assert.equal(s.fits(7,-2,2),true);
});
test('private cosmetic randomness cannot relocate terrain, public candidates or resources',()=>{
  const a=new Battlefield(1409,'westmark'),original=BattlefieldBuilder.prototype.cosmeticRandom;
  try {
    BattlefieldBuilder.prototype.cosmeticRandom=()=>()=>.5;
    const b=new Battlefield(1409,'westmark');
    assert.deepEqual(a.staticGrid,b.staticGrid);assert.deepEqual(a.surface.heights,b.surface.heights);
    assert.deepEqual(a.layout,b.layout);
  }finally{BattlefieldBuilder.prototype.cosmeticRandom=original;}
});
test('water clips a single field without overlapping strips or degenerate shoreline triangles',()=>{
  const field={extent:1,step:1,size:5,innerExtent:0,heights:new Float32Array(25),colors:new Float32Array(75)},
    build=()=>TerrainModels.geometry({mesh:'westmarkWater',model:'westmarkWater',relief:field});
  const area=mesh=>{
    let total=0;for(let i=0;i<mesh.length;i+=27) {
      const cross=(mesh[i+9]-mesh[i])*(mesh[i+20]-mesh[i+2])-(mesh[i+11]-mesh[i+2])*(mesh[i+18]-mesh[i]);
      assert.ok(Math.abs(cross)>1e-9);total+=Math.abs(cross)/2;
      for(const j of [i,i+9,i+18])assert.ok(mesh[j+6]>=0&&Math.abs(mesh[j+4]-1)<1e-6);
    }return total;
  };
  for(let i=0;i<25;i++)field.colors.set([1,1,0],i*3);
  assert.equal(area(build()),4);
  for(let i=0;i<25;i++)field.colors[i*3]=i%5-2;
  assert.equal(area(build()),2);
  for(let i=0;i<25;i++)field.colors[i*3]=-1;
  assert.equal(build().length,0);
});
test('retained bridge masonry stays finite and leaves its central roadway clear',()=>{
  for(const b of [{x:0,z:0,yaw:0,width:12,depth:3.4,height:16,seed:1409,outline:[]},
    {x:20,z:-10,yaw:.4,width:14,depth:4,height:18,seed:7919,outline:[]}]) {
    const mesh=TerrainModels.geometry({mesh:'bridge',model:'westmarkBridge',feature:b});
    assert.ok(mesh.length/27<10000);assert.ok(mesh.every(Number.isFinite));
    let paving=0,raised=0;
    for(let i=0;i<mesh.length;i+=9) {
      const dx=mesh[i]-b.x,dz=mesh[i+2]-b.z,v=dx*Math.sin(b.yaw)+dz*Math.cos(b.yaw);
      if(Math.abs(v)<b.depth-1.05) {
        assert.ok(mesh[i+1]<=b.height);
        if(mesh[i+1]>b.height-.1)paving++;
      }else if(mesh[i+1]>b.height+.8)raised++;
    }
    assert.ok(paving>100&&raised>100);
  }
});
test('spruce crowns retain bounded deterministic geometry and full azimuth coverage',()=>{
  const build=seed=>TerrainModels.geometry({mesh:'westmarkSpruce',model:'westmarkSpruce',seed,extent:160});
  for(const seed of [1409,43015,7919]) {
    const mesh=build(seed),bands=Array.from({length:4},()=>Array(8).fill(0));
    assert.deepEqual(mesh,build(seed));assert.ok(mesh.length/27<=520);
    let minNY=1,maxNY=0;
    for(let i=0;i<mesh.length;i+=9) {
      const [x,y,z,nx,ny,nz,u,v,shade]=mesh.slice(i,i+9);
      assert.ok(Math.hypot(x,z)<=3&&y>=.4&&y<=11.5);
      assert.ok(Math.abs(Math.hypot(nx,ny,nz)-1)<1e-5);
      assert.ok(u>=0&&u<=1&&v>=0&&v<=1&&shade>=.8&&shade<=1);
      minNY=Math.min(minNY,Math.abs(ny));maxNY=Math.max(maxNY,Math.abs(ny));
    }
    for(let i=0;i<mesh.length;i+=27) {
      const x=(mesh[i]+mesh[i+9]+mesh[i+18])/3,y=(mesh[i+1]+mesh[i+10]+mesh[i+19])/3,
        z=(mesh[i+2]+mesh[i+11]+mesh[i+20])/3,band=Math.floor((y-2)/2),
        sector=Math.floor((Math.atan2(z,x)+Math.PI)/Math.PI*4)%8;
      if(band>=0&&band<4)bands[band][sector]++;
    }
    assert.ok(bands.every(b=>b.every(n=>n>=4)));assert.ok(minNY<.5&&maxNY>.9);
  }
  assert.notDeepEqual(build(1409),build(7919));
});
test('landscape profiles opt into shared materials and the untouched baked spruce asset',()=>{
  const profile={...BATTLEFIELDS.westmark.render,landscape:{...BATTLEFIELDS.westmark.render.landscape,foliage:'westmarkSpruce'}},
    names=MeridianRenderer.prototype.textureNames(profile);
  for(const key of ['westmarkMeadow','westmarkGranite','westmarkEarth','westmarkBark','westmarkSpruce'])assert.ok(names.has(key));
  assert.deepEqual(Buffer.from(MERIDIAN_TEXTURES.westmarkSpruce.split(',')[1],'base64'),
    readFileSync(join(__dirname,'../assets/textures/texture-westmark-spruce.webp')));
  const desert=BATTLEFIELDS.desert.render,desertTextures=MeridianRenderer.prototype.textureNames(desert);
  assert.ok(desertTextures.has('westmarkEarth')&&desertTextures.has('westmarkBark'));
  assert.ok(!desertTextures.has('westmarkSpruce')&&!desertTextures.has('westmarkMeadow'));
  assert.ok([...MeridianRenderer.prototype.textureNames({...desert,landscape:undefined})].every(name=>!name.startsWith('westmark')));
});
