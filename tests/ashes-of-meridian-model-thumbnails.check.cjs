const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {modelHarness} = require('./helpers/model-contract.cjs');

function setup() {
  const h = modelHarness();
  Object.assign(h.context,{innerWidth:800,innerHeight:600,devicePixelRatio:2});
  const {Renderer,Thumbnails} = vm.runInContext('({Renderer:MeridianRenderer,Thumbnails:MeridianModelThumbnails})',h.context);
  const calls = [], deleted = [], gl = new Proxy({
    COLOR_BUFFER_BIT:1,DEPTH_BUFFER_BIT:2,
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
    quality:2,cinema:false,fogOn:true,extent:140,decorSeed:17,
    eye:[10,20,30],vp:new Float32Array(16),lightVP:new Float32Array(16),
    battlefieldProfile:{scenery:'aurelion'},canvas:{width:800,height:600},drawCalls:0,
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
    const copies=[];
    return {dataset:{modelFaction:String(faction),modelKind:kind,modelType:type},
      width:300,height:150,copies,getBoundingClientRect:()=>bounds,
      getContext(kind){assert.equal(kind,'2d');return {drawImage(...args){copies.push(args);}};}};
  }
  return {h,r,tile,thumbs:new Thumbnails(r),calls,deleted,rect};
}

test('model tiles borrow meshes, fit complete geometry and isolate world/profile/instance state', () => {
  const {h,r,tile,thumbs,calls,deleted} = setup();
  const state=[r.surface,r.battlefieldProfile,r.eye,r.vp,r.lightVP,r.dynamic,r.effects,r.static,r.occlusion];
  vm.runInContext('Math.random = seeded = () => { throw Error("Tile RNG"); };',h.context);
  const meshes=r.meshes;
  for(const faction of [0,1,2]) for(const [kind,types] of [['unit',Object.keys(h.UNITS).filter(t=>t!=='destroyer')],['building',Object.keys(h.BUILDINGS)]]) {
    for(const type of types) {
      const canvas=tile(faction,kind,type);
      assert.equal(thumbs.draw(canvas,4),true,`${faction}/${kind}/${type}`);
      assert.equal(canvas.copies.length,1);
      assert.equal(canvas.width,256);assert.equal(canvas.height,256);
      assert.deepEqual(canvas.copies[0],[r.canvas,0,344,256,256,0,0,256,256]);
      const p=thumbs.preview;
      for(const batches of [p.dynamic,p.effects]) for(const b of Object.values(batches)) {
        if(!b.n) continue;
        assert.ok(b.bounds,`missing mesh bounds: ${b.mesh}`);
        for(let i=0;i<8;i++) {
          const a=b.bounds,point=vm.runInContext('M4',h.context).point(p.vp,i&1?a[3]:a[0],i&2?a[4]:a[1],i&4?a[5]:a[2]);
          assert.ok(Math.abs(point[0])<point[3] && Math.abs(point[1])<point[3],'full transformed mesh bounds fit the tile');
        }
      }
    }
  }
  assert.deepEqual([r.surface,r.battlefieldProfile,r.eye,r.vp,r.lightVP,r.dynamic,r.effects,r.static,r.occlusion],state);
  assert.equal(r.meshes,meshes); assert.equal(r.fogOn,true);assert.equal(r.cinema,false);
  assert.ok(calls.some(c=>c[0]==='uniform1f' && c[2]===0),'no battlefield shadows in tiles');
  assert.deepEqual(calls.filter(c=>c[0]==='disable').at(-2),['disable','SCISSOR_TEST']);
  const count=calls.filter(c=>c[0]==='createBuffer').length;
  thumbs.draw(tile(),5);assert.equal(calls.filter(c=>c[0]==='createBuffer').length,count,'buffers are reused');
  thumbs.dispose();assert.equal(deleted.length,count);assert.equal(new Set(deleted).size,count);
  thumbs.dispose();assert.equal(deleted.length,count,'disposal is idempotent and leaves shared meshes alone');
});

test('model tile scheduling skips clipped tiles, limits updates and fills each visible tile fairly', () => {
  const {thumbs,tile,rect} = setup();
  const first=tile(),second=tile(0,'building','hq'),hidden=tile(0,'unit','tank',{...rect,left:900,right:1060});
  const root={getBoundingClientRect:()=>({left:0,top:0,right:800,bottom:600}),querySelectorAll:()=>[first,hidden,second]};
  thumbs.update(root,0);assert.equal(first.copies.length,1);assert.equal(second.copies.length,0);
  thumbs.update(root,.02);assert.equal(second.copies.length,1);assert.equal(hidden.copies.length,0);
  thumbs.update(root,.04);assert.equal(first.copies.length,1);assert.equal(second.copies.length,1);
  thumbs.update(root,.2);assert.equal(first.copies.length,2);assert.equal(second.copies.length,1);
  const replacement=tile(2,'unit','air');root.querySelectorAll=()=>[replacement];
  thumbs.update(root,.21);assert.equal(replacement.copies.length,1,'new DOM node does not inherit an obsolete faction image');
  const rectangular=tile(0,'building','hangar',{...rect,width:160,height:80,bottom:100});
  assert.equal(thumbs.draw(rectangular,1),true);assert.equal(rectangular.width,256);assert.equal(rectangular.height,128);
  for(const invalid of [tile(3),tile(0,'resource','crystal'),tile(0,'unit','bogus')]) assert.equal(thumbs.draw(invalid,1),false);
});
