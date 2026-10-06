const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {loadScripts,RENDERER_SCRIPTS} = require('./helpers/game-scripts.cjs');
const context = loadScripts([...RENDERER_SCRIPTS,'world-view']);
const {WorkerRoadField,BattlefieldView,MeridianRenderer} = vm.runInContext('({WorkerRoadField,BattlefieldView,MeridianRenderer})',context);
const worker = x => ({id:1,x,z:0});
function passage(field,start) {
  for(let i=0;i<=40;i++) field.update(start+i*.25,[worker(i%2 ? 0 : 1)]);
}

test('repeated travel builds soft wear, idle/pause do not, disuse removes it',()=>{
  const field = new WorkerRoadField(20);
  field.update(0,[worker(0)]);
  field.update(.25,[worker(1)]);
  const once=Math.max(...field.wear);
  assert.ok(once>0&&once<.18,'one traversal remains below established path threshold');
  passage(field,.5);
  assert.ok(Math.max(...field.wear)>.72,'repeated use establishes a path');
  const before=Array.from(field.pixels);
  assert.equal(field.update(10.5,[worker(1)]),false,'same simulation time is frozen');
  assert.deepEqual(Array.from(field.pixels),before);
  const peak=Math.max(...field.wear);
  field.update(11,[worker(1)]);
  assert.ok(Math.max(...field.wear)<peak,'stationary worker only allows decay');
  field.update(132,[]);
  assert.ok(field.pixels.every(p=>p===0));
});

test('visibility gaps, teleports and time reversal never join old positions',()=>{
  const field=new WorkerRoadField(20);
  field.update(0,[worker(-10)]);
  field.update(.25,[]);
  field.update(.5,[worker(10)]);
  field.update(.75,[worker(-10)]);
  field.update(4,[worker(0)]);
  assert.ok(field.pixels.every(p=>p===0));
  field.update(4.25,[worker(1)]);
  assert.ok(field.pixels.some(p=>p>0));
  field.update(0,[worker(0)]);
  assert.ok(field.pixels.every(p=>p===0));
});

test('wear is distance-based, isotropic and raster size remains bounded',()=>{
  const a=new WorkerRoadField(20),b=new WorkerRoadField(20);
  a.update(0,[worker(0)]);a.update(.5,[worker(2)]);
  b.update(0,[{id:1,x:0,z:0}]);b.update(.5,[{id:1,x:0,z:2}]);
  for(let z=0;z<a.size;z++)for(let x=0;x<a.size;x++)
    assert.equal(a.pixels[z*a.size+x],b.pixels[x*a.size+z]);
  assert.equal(new WorkerRoadField(1000).size,512);
});

test('road texture is reused, released and bound only on terrain scene draws',()=>{
  const calls=[],on=[];
  const gl=new Proxy({
    createTexture(){calls.push('create');return {};},
    texImage2D(){calls.push('allocate');},texSubImage2D(){calls.push('upload');},
    deleteTexture(){calls.push('delete');},uniform1f(name,value){if(name==='u_workerRoadOn')on.push(value);}
  },{get:(o,k)=>k in o?o[k]:()=>{}});
  const r=Object.assign(Object.create(MeridianRenderer.prototype),{
    gl,workerRoadTex:null,workerRoadSize:0,quality:2,meshes:{mesh:{vao:{},count:3}},
    materialPrograms:{},program:'scene',drawCalls:0,
    uniform(p,name){return name;},bindSceneProgram(t,mt,p){this.activeSceneProgram=p;}
  });
  const data=new Uint8Array(16);
  r.workerRoads(data,4);r.workerRoads(data,4);
  assert.deepEqual(calls,['create','allocate','upload']);
  const bucket=source=>({mesh:'mesh',source,n:1,buffer:{}});
  const batches={ground:bucket('terrain'),unit:bucket('workerHull'),fill:bucket('buildingGround:1')};
  r.drawBatches(batches,undefined,undefined,undefined,0,0);
  assert.deepEqual(on,[1,0,1],'models must not inherit terrain wear');
  on.length=0;r.drawBatches(batches);
  assert.deepEqual(on,[],'depth and occlusion passes remain unchanged');
  r.releaseWorkerRoads();r.releaseWorkerRoads();
  assert.equal(calls.filter(c=>c==='delete').length,1);
  assert.equal(r.workerRoadTex,null);
  r.workerRoads(data,4);
  assert.deepEqual(calls.slice(-2),['create','allocate']);
});

test('world, perspective and menu switches discard wear and GPU residency',()=>{
  let releases=0;
  const r={releaseWorkerRoads(){releases++;},workerRoads(){},fogOn:false};
  const view=new BattlefieldView(r),layout={geometries:[]},world={
    extent:20,cellSize:1,gridSize:40,viewTeam:0,fogVersion:0,renderData:layout
  };
  view.world=world;view.data=layout;view.sceneryTeam=0;
  const start=()=>{view.updateWorkerRoads(0,[{...worker(0),kind:'unit',type:'worker',hp:1}],()=>true);};
  start();view.sync(world,false,{entities:[],scans:[],time:0});
  assert.equal(releases,0,'same battle retains wear');
  world.viewTeam=1;view.sync(world,false,{entities:[],scans:[],time:0});
  assert.equal(releases,1);
  start();view.sync({...world},false,{entities:[],scans:[],time:0});
  assert.equal(releases,2);
  start();view.sync(view.world,false);
  assert.equal(releases,3,'menu snapshot has no live road history');
});

test('view filters workers before tracking, without mutating entities',()=>{
  const uploads=[],view=new BattlefieldView({workerRoads:(data,size)=>uploads.push({data:Array.from(data),size})});
  view.world={extent:20};
  const entities=[
    {id:1,kind:'unit',type:'worker',hp:10,x:0,z:0},
    {id:2,kind:'unit',type:'worker',hp:10,x:0,z:0},
    {id:3,kind:'unit',type:'soldier',hp:10,x:0,z:0},
    {id:4,kind:'unit',type:'worker',hp:0,x:0,z:0}
  ];
  view.updateWorkerRoads(0,entities,e=>e.id!==2);
  for(const e of entities)e.x=1;
  const before=JSON.stringify(entities);
  view.updateWorkerRoads(.25,entities,e=>e.id!==2);
  assert.equal(uploads.length,1);
  assert.equal(JSON.stringify(entities),before);
  const expected=new WorkerRoadField(20);
  expected.update(0,[worker(0)]);expected.update(.25,[worker(1)]);
  assert.deepEqual(uploads[0].data,Array.from(expected.pixels));
});
