const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {modelHarness} = require('./helpers/model-contract.cjs');

function setup(msaa={}) {
  const h = modelHarness();
  Object.assign(h.context,{innerWidth:800,innerHeight:600,devicePixelRatio:2});
  const {Renderer,Thumbnails} = vm.runInContext('({Renderer:MeridianRenderer,Thumbnails:MeridianModelThumbnails})',h.context);
  let framebuffers=0,statusChecks=0;
  const calls = [], deleted = [], gl = new Proxy({
    COLOR_BUFFER_BIT:1,DEPTH_BUFFER_BIT:2,
    getInternalformatParameter(target,format,samples) {
      calls.push(['getInternalformatParameter',target,format,samples]);
      return format==='RGBA8' ? msaa.colorSamples ?? [] : msaa.depthSamples ?? [];
    },
    getRenderbufferParameter(...args) {calls.push(['getRenderbufferParameter',...args]);return msaa.actualSamples ?? 2;},
    checkFramebufferStatus(...args) {calls.push(['checkFramebufferStatus',...args]);return (++statusChecks%2===0?msaa.resolveStatus:msaa.status) ?? 'FRAMEBUFFER_COMPLETE';},
    createFramebuffer() {const fbo={};calls.push(['createFramebuffer',fbo]);framebuffers++;return msaa.failAllocation==='framebuffer'||(msaa.failAllocation==='resolve'&&framebuffers%2===0)?null:fbo;},
    createRenderbuffer() {const buffer={};calls.push(['createRenderbuffer',buffer]);return msaa.failAllocation==='renderbuffer'?null:buffer;},
    createBuffer() { const buffer={}; calls.push(['createBuffer',buffer]); return buffer; },
    deleteBuffer(buffer) { deleted.push(buffer); }
  },{get(target,key) {
    if(key in target) return target[key];
    if(String(key).toUpperCase()===key) return key;
    return (...args)=>{calls.push([key,...args]);return {};};
  }});
  const r = Object.assign(Object.create(Renderer.prototype),{
    gl,meshes:{},meshParts:{},colors:new Map(),uniformCache:new Map(),program:{},
    dynamic:{},effects:{},static:{},occlusion:{},surface:{heightAt(){throw Error('Thumbnail sampled world');}},
    quality:2,cinema:false,fogOn:true,extent:140,
    eye:[10,20,30],vp:new Float32Array(16),lightVP:new Float32Array(16),
    battlefieldProfile:{scenery:'fixture'},canvas:{width:800,height:600},drawCalls:0,
    geometry(name,data) {
      const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
      for(let i=0;i<data.length;i+=9) for(let k=0;k<3;k++) {
        min[k]=Math.min(min[k],data[i+k]);max[k]=Math.max(max[k],data[i+k]);
      }
      this.meshes[name]={vao:{},count:data.length/9,bounds:[...min,...max]};
    }
  });
  for(const name of ['box','octa','sphere','ring','plane','workerHull','workerDrill','choirMound','commandHull']) r.geometry(name,h.geom[name]());
  r.geometry('hex',h.geom.cylinder(6)); r.geometry('cylinder',h.geom.cylinder(10)); r.geometry('cone',h.geom.cylinder(7,0));
  for(const [name,data] of Object.entries(h.geom.turretAssembly())) r.geometry(name,data);
  h.EntityModels.upload(r);
  const rect={left:20,top:20,right:180,bottom:180,width:160,height:160};
  function tile(faction=0,kind='unit',type='rifle',bounds=rect) {
    const copies=[],alphas=[],context={globalAlpha:1,drawImage(...args){copies.push(args);alphas.push(this.globalAlpha);}};
    return {dataset:{modelFaction:String(faction),modelKind:kind,modelType:type},
      width:300,height:150,copies,alphas,getBoundingClientRect:()=>bounds,
      getContext(kind){assert.equal(kind,'2d');return context;}};
  }
  const images=[];
  h.context.document={createElement(tag){assert.equal(tag,'canvas');const image=tile();images.push(image);return image;}};
  return {h,r,tile,thumbs:new Thumbnails(r),calls,deleted,rect,images};
}

test('model tiles borrow meshes, fit complete geometry and isolate world/profile/instance state', () => {
  const {h,r,tile,thumbs,calls,deleted,images} = setup();
  const state=[r.surface,r.battlefieldProfile,r.eye,r.vp,r.lightVP,r.dynamic,r.effects,r.static,r.occlusion];
  vm.runInContext('Math.random = seeded = () => { throw Error("Tile RNG"); };',h.context);
  const meshes=r.meshes;
  for(const faction of [0,1,2]) for(const [kind,types] of [['unit',Object.keys(h.UNITS).filter(t=>t!=='destroyer')],['building',Object.keys(h.BUILDINGS)]]) {
    for(const type of types) {
      const canvas=tile(faction,kind,type);
      assert.equal(thumbs.draw(canvas),'rendered',`${faction}/${kind}/${type}`);
      assert.equal(canvas.copies.length,1);
      assert.equal(canvas.width,256);assert.equal(canvas.height,256);
      assert.deepEqual(canvas.copies[0],[images.at(-1),0,0]);
      assert.deepEqual(images.at(-1).copies[0],[r.canvas,0,344,256,256,0,0,256,256]);
      const p=thumbs.preview;
      let occupied=0;
      for(const batches of [p.dynamic,p.effects]) for(const b of Object.values(batches)) {
        if(!b.n) continue;
        assert.ok(b.bounds,`missing mesh bounds: ${b.mesh}`);
        const a=p.meshes[b.mesh].bounds,M4=vm.runInContext('M4',h.context);
        for(let instance=0;instance<b.n;instance++) for(let i=0;i<8;i++) {
          const d=b.data,o=instance*22,x=i&1?a[3]:a[0],y=i&2?a[4]:a[1],z=i&4?a[5]:a[2],
            point=M4.point(p.vp,d[o]*x+d[o+4]*y+d[o+8]*z+d[o+12],
              d[o+1]*x+d[o+5]*y+d[o+9]*z+d[o+13],d[o+2]*x+d[o+6]*y+d[o+10]*z+d[o+14]);
          assert.ok(Math.abs(point[0])<point[3] && Math.abs(point[1])<point[3],'each full transformed part fits the tighter tile camera');
          occupied=Math.max(occupied,Math.abs(point[0]/point[3]),Math.abs(point[1]/point[3]));
        }
      }
      if(faction===0&&kind==='building'&&type==='hq')
        assert.ok(occupied>.95,'thumbnail framing fills the image instead of fitting a loose world AABB');
    }
  }
  assert.deepEqual([r.surface,r.battlefieldProfile,r.eye,r.vp,r.lightVP,r.dynamic,r.effects,r.static,r.occlusion],state);
  assert.equal(r.meshes,meshes); assert.equal(r.fogOn,true);assert.equal(r.cinema,false);
  assert.ok(calls.some(c=>c[0]==='uniform1f' && c[2]===0),'no battlefield shadows in tiles');
  assert.deepEqual(calls.filter(c=>c[0]==='disable').at(-2),['disable','SCISSOR_TEST']);
  const count=calls.filter(c=>c[0]==='createBuffer').length;
  const before=calls.length;
  assert.equal(thumbs.draw(tile()),'cached');
  assert.equal(calls.length,before,'cache hits do not touch WebGL');
  thumbs.dispose();assert.equal(deleted.length,count);assert.equal(new Set(deleted).size,count);
  assert.ok(images.every(image=>image.width===0&&image.height===0),'cached pixel storage is released');
  thumbs.dispose();assert.equal(deleted.length,count,'disposal is idempotent and leaves shared meshes alone');
});

test('model tile scheduling renders cold misses once and reuses cached snapshots across DOM replacement', () => {
  const {thumbs,tile,rect,calls,images,r} = setup();
  const first=tile(),second=tile(0,'building','hq'),hidden=tile(0,'unit','tank',{...rect,left:900,right:1060});
  const root={getBoundingClientRect:()=>({left:0,top:0,right:800,bottom:600}),querySelectorAll:()=>[first,hidden,second]};
  thumbs.update(root);assert.equal(first.copies.length,1);assert.equal(second.copies.length,0);
  thumbs.update(root);assert.equal(second.copies.length,1);assert.equal(hidden.copies.length,0);
  const settled=calls.length;
  for(let frame=0;frame<120;frame++) thumbs.update(root);
  assert.equal(first.copies.length,1);assert.equal(second.copies.length,1);
  assert.equal(calls.length,settled,'steady state has no thumbnail uploads, draws or WebGL-to-2D copies');
  const reopened=tile();root.querySelectorAll=()=>[reopened];
  thumbs.update(root);assert.equal(reopened.copies.length,1);assert.equal(calls.length,settled,'reopening a menu reuses its snapshot');
  const replacement=tile(2,'unit','air');root.querySelectorAll=()=>[replacement];
  thumbs.update(root);assert.equal(replacement.copies.length,1,'new faction needs its own snapshot');
  const rectangular=tile(0,'building','hangar',{...rect,width:160,height:80,bottom:100});
  assert.equal(thumbs.draw(rectangular),'rendered');assert.equal(rectangular.width,256);assert.equal(rectangular.height,128);
  for(const invalid of [tile(3),tile(0,'resource','crystal'),tile(0,'unit','bogus')]) assert.equal(thumbs.draw(invalid),false);
  const sameNode=tile();assert.equal(thumbs.draw(sameNode),'cached');
  sameNode.dataset.modelFaction='1';assert.equal(thumbs.draw(sameNode),'rendered','descriptor changes cannot leave the previous faction visible');
  r.quality=0;assert.equal(thumbs.draw(sameNode),'rendered','quality changes invalidate the image');
  r.textureResources={metal:{resident:true},bio:{resident:true}};
  assert.equal(thumbs.draw(sameNode),'rendered','newly ready model materials invalidate fallback pixels');
  assert.equal(thumbs.draw(sameNode),'unchanged');
  assert.equal(images.length,7);
  const times=calls.filter(c=>c[0]==='uniform1f');
  assert.ok(times.length>0);
  const pose=()=>JSON.stringify(Object.entries(thumbs.preview.dynamic).filter(([,b])=>b.n)
    .sort(([a],[b])=>a.localeCompare(b)).map(([mesh,b])=>[mesh,Array.from(b.data.subarray(0,b.n*22))]));
  const snapshot=pose();
  thumbs.dispose();r.quality=0;
  thumbs.draw(sameNode);
  assert.equal(pose(),snapshot,'recreated snapshots use the same fixed model pose and time');
});

test('HUD thumbnail scope includes the selection portrait above the command deck', () => {
  const app=require('node:fs').readFileSync(require('node:path').join(__dirname,'../src/app.ts'),'utf8');
  assert.match(app,/\(\) => thumbnails\.update\(\$\('hud'\)\)/);
  const {thumbs,tile,calls}=setup();
  const avatar=tile(0,'building','hq',{left:0,top:460,right:32,bottom:492,width:32,height:32});
  const action=tile(0,'unit','worker',{left:160,top:500,right:320,bottom:548,width:160,height:48});
  const nodes=()=>[avatar,action];
  thumbs.update({getBoundingClientRect:()=>({left:0,top:500,right:800,bottom:600}),querySelectorAll:nodes});
  assert.equal(avatar.copies.length,0,'selection portrait lies outside command deck clipping bounds');
  const hud={getBoundingClientRect:()=>({left:0,top:0,right:800,bottom:600}),querySelectorAll:nodes};
  thumbs.update(hud);assert.equal(avatar.copies.length,1);
  assert.deepEqual([avatar.width,avatar.height],[64,64]);
  const settled=calls.length;thumbs.update(hud);
  assert.equal(calls.length,settled,'unchanged selection remains cached');
});

test('wide HUD previews preserve vertical resolution, aspect and bounded capture sizes', () => {
  const {thumbs,tile,rect,r}=setup();r.canvas.width=3840;r.canvas.height=2160;
  const hud=(width,height)=>{const canvas=tile(0,'building','hq',{...rect,width,height});
    canvas.classList={contains:name=>name==='action-model'};return canvas;};
  const desktop=hud(480,48);assert.equal(thumbs.draw(desktop),'rendered');
  assert.deepEqual([desktop.width,desktop.height],[960,96]);
  const ultraWide=hud(960,48);assert.equal(thumbs.draw(ultraWide),'rendered');
  assert.deepEqual([ultraWide.width,ultraWide.height],[1024,51]);
  const mobile=hud(48,48);assert.equal(thumbs.draw(mobile),'rendered');
  assert.deepEqual([mobile.width,mobile.height],[96,96]);
  r.canvas.width=200;r.canvas.height=600;
  const constrained=hud(480,48);assert.equal(thumbs.draw(constrained),'rendered');
  assert.deepEqual([constrained.width,constrained.height],[200,20]);
});

test('HUD portrait zoom changes framing and cache identity without changing Codex defaults', () => {
  const {thumbs,tile}=setup(),canvas=tile(0,'building','hq');
  assert.equal(thumbs.draw(canvas),'rendered');const fit=Array.from(thumbs.preview.vp);
  canvas.dataset.modelZoom='1.35';assert.equal(thumbs.draw(canvas),'rendered');
  const cropped=Array.from(thumbs.preview.vp);
  for(const k of [0,1,4,5,8,9]) assert.ok(Math.abs(cropped[k]-fit[k]*1.35)<1e-5);
  assert.equal(thumbs.draw(canvas),'unchanged');
  const reopened=tile(0,'building','hq');reopened.dataset.modelZoom='1.35';
  assert.equal(thumbs.draw(reopened),'cached');
  delete canvas.dataset.modelZoom;assert.equal(thumbs.draw(canvas),'cached');
  assert.equal(thumbs.cache.size,2);
  canvas.dataset.modelZoom='NaN';assert.equal(thumbs.draw(canvas),'unchanged');
});

test('snapshot storage stays bounded across resized menus and releases evicted canvases', () => {
  const {thumbs,tile,rect,images} = setup();
  for(let width=10;width<112;width++) {
    assert.equal(thumbs.draw(tile(0,'building','hq',{...rect,width,height:80})),'rendered');
  }
  assert.equal(thumbs.cache.size,96);
  assert.ok(images.slice(0,6).every(image=>image.width===0&&image.height===0));
  thumbs.dispose();assert.equal(thumbs.cache.size,0);
  assert.ok(images.every(image=>image.width===0&&image.height===0));
});

test('preview MSAA uses exactly 2x, resolves once per cold image and reuses its own small target', () => {
  const {thumbs,r,tile,rect,calls,images}=setup({colorSamples:[4,2],depthSamples:[4,2]});
  r.quality=0;
  const scene={};r.sceneMSAAFbo=scene;r.sceneSamples=4;
  assert.equal(thumbs.draw(tile()),'rendered');
  const target=thumbs.msaa;
  assert.ok(target);
  assert.deepEqual(calls.filter(c=>c[0]==='renderbufferStorageMultisample'),[
    ['renderbufferStorageMultisample','RENDERBUFFER',2,'RGBA8',256,256],
    ['renderbufferStorageMultisample','RENDERBUFFER',2,'DEPTH_COMPONENT24',256,256]
  ]);
  assert.deepEqual(calls.filter(c=>c[0]==='blitFramebuffer'),[
    ['blitFramebuffer',0,0,256,256,0,0,256,256,1,'NEAREST'],
    ['blitFramebuffer',0,0,256,256,0,0,256,256,1,'NEAREST']
  ]);
  assert.ok(calls.some(c=>c[0]==='bindFramebuffer'&&c[1]==='DRAW_FRAMEBUFFER'&&c[2]===target.resolve),'MSAA resolves into matching RGBA8, not directly into the opaque default canvas');
  assert.ok(calls.some(c=>c[0]==='bindFramebuffer'&&c[1]==='READ_FRAMEBUFFER'&&c[2]===target.fbo));
  assert.ok(calls.some(c=>c[0]==='bindFramebuffer'&&c[1]==='DRAW_FRAMEBUFFER'&&c[2]===null));
  assert.deepEqual(calls.at(-1),['bindFramebuffer','FRAMEBUFFER',null]);
  const settled=calls.length;
  assert.equal(thumbs.draw(tile()),'cached');assert.equal(calls.length,settled);
  thumbs.draw(tile(0,'building','hq'));
  assert.equal(thumbs.msaa,target,'same dimensions reuse the MSAA target');
  assert.equal(calls.filter(c=>c[0]==='createFramebuffer').length,2);
  assert.equal(calls.filter(c=>c[0]==='blitFramebuffer').length,4);
  assert.equal(images.length,2);
  assert.ok(images.every(image=>image.copies.length===1),'one WebGL copy per resolved image, not per sample');
  thumbs.draw(tile(0,'building','hq',{...rect,width:160,height:80}));
  assert.notEqual(thumbs.msaa,target,'resize replaces the bounded scratch target');
  assert.equal(calls.filter(c=>c[0]==='deleteFramebuffer'&&c[1]===target.fbo).length,1);
  assert.equal(r.sceneMSAAFbo,scene);assert.equal(r.sceneSamples,4,'main-view settings and targets are untouched');
  thumbs.dispose();thumbs.dispose();
  assert.equal(calls.filter(c=>c[0]==='deleteFramebuffer').length,4);
  assert.equal(calls.filter(c=>c[0]==='deleteRenderbuffer').length,6);
  assert.equal(thumbs.msaa,null);
});

for(const [name,options] of Object.entries({
  '4x-only device':{colorSamples:[4],depthSamples:[4]},
  'mismatched attachment support':{colorSamples:[2],depthSamples:[4]},
  'incomplete target':{colorSamples:[2],depthSamples:[2],status:'FRAMEBUFFER_INCOMPLETE_ATTACHMENT'},
  'incomplete resolve target':{colorSamples:[2],depthSamples:[2],resolveStatus:'FRAMEBUFFER_INCOMPLETE_ATTACHMENT'},
  'missing resolve framebuffer':{colorSamples:[2],depthSamples:[2],failAllocation:'resolve'},
  'driver rounds up to 4x':{colorSamples:[2],depthSamples:[2],actualSamples:4},
  'missing framebuffer':{colorSamples:[2],depthSamples:[2],failAllocation:'framebuffer'},
  'missing renderbuffer':{colorSamples:[2],depthSamples:[2],failAllocation:'renderbuffer'}
})) test(`preview AA falls back cleanly without 4x for ${name}`, () => {
  const {thumbs,tile,calls,images}=setup(options);
  assert.equal(thumbs.draw(tile()),'rendered');assert.equal(thumbs.msaa,null);
  assert.equal(images[0].copies.length,2);
  assert.deepEqual(images[0].alphas,[1,.5],'two opaque subpixel samples are averaged equally');
  assert.equal(images[0].getContext('2d').globalAlpha,1);
  assert.ok(!calls.some(c=>c[0]==='blitFramebuffer'),'fallback averages two single-sample scratch images');
  const location=thumbs.preview.uniform(thumbs.preview.program,'u_vp'),
    matrices=calls.filter(c=>c[0]==='uniformMatrix4fv'&&c[1]===location).map(c=>c[3]);
  assert.equal(matrices.length,2);
  assert.ok(Math.abs(matrices[0][12]-matrices[1][12]-1/256)<1e-6);
  assert.ok(Math.abs(matrices[0][13]-matrices[1][13]-1/256)<1e-6);
  assert.deepEqual(calls.at(-1),['bindFramebuffer','FRAMEBUFFER',null]);
  assert.ok(calls.filter(c=>c[0]==='renderbufferStorageMultisample').every(c=>c[2]===2));
  assert.deepEqual(calls.at(-1),['bindFramebuffer','FRAMEBUFFER',null]);
  const allocations=calls.filter(c=>c[0]==='createFramebuffer').length;
  thumbs.draw(tile(0,'building','hq'));
  assert.equal(calls.filter(c=>c[0]==='createFramebuffer').length,allocations,'failed dimensions are not allocated repeatedly');
  thumbs.dispose();
  const deleted=calls.filter(c=>c[0]==='deleteFramebuffer'||c[0]==='deleteRenderbuffer').map(c=>c[1]);
  assert.equal(new Set(deleted).size,deleted.length,'partial resources are released only once');
});
