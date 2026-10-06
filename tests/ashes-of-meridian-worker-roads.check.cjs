const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {loadScripts,RENDERER_SCRIPTS} = require('./helpers/game-scripts.cjs');
const context = loadScripts(['core','content',...RENDERER_SCRIPTS,'world-view']);
const {WorkerRoadField,BuildingRoadField,BattlefieldView,MeridianRenderer,closeRoadGaps} = vm.runInContext('({WorkerRoadField,BuildingRoadField,BattlefieldView,MeridianRenderer,closeRoadGaps})',context);
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

test('building paths extend beyond the footprint, stay cached during pause and respect observation',()=>{
  const uploads=[],view=new BattlefieldView({workerRoads:(data,size)=>uploads.push({data:Array.from(data),size})});
  view.world={extent:20};
  const building={id:7,kind:'building',type:'hq',hp:100,x:0,z:0,size:4.4,team:0},
    hidden={...building,id:8,x:13},entities=[building,hidden],before=JSON.stringify(entities);
  view.updateWorkerRoads(0,entities,e=>e.id!==8);
  assert.equal(uploads.length,1,'stationary buildings need no worker travel');
  const {data,size}=uploads[0],at=(x,z)=>data[Math.floor(z+20)*size+Math.floor(x+20)];
  assert.equal(at(0,0),255);
  assert.ok(at(5,0)>0,'small apron peeks out beyond the building');
  assert.equal(at(9,0),0,'apron remains local');
  assert.equal(at(13,0),0,'unobserved buildings cannot mark terrain');
  view.updateWorkerRoads(0,entities,e=>e.id!==8);
  view.updateWorkerRoads(60,entities,e=>e.id!==8);
  assert.equal(uploads.length,1,'unchanged building mask neither fades nor uploads again');
  assert.equal(JSON.stringify(entities),before);
  view.updateWorkerRoads(60,[{...building,x:-10}],()=>true);
  assert.equal(uploads.length,2,'relocation is visible even while paused');
  assert.equal(uploads[1].data[Math.floor(20)*size+Math.floor(20)],0,'old footprint is removed');
  view.updateWorkerRoads(60,[{...building,hp:0}],()=>true);
  assert.ok(uploads.at(-1).data.every(p=>p===0),'destroyed buildings release their apron');
});

test('building apron edges are asymmetric, deterministic and leave the core covered',()=>{
  const field=new WorkerRoadField(20),a=new BuildingRoadField(field),b=new BuildingRoadField(field),
    building={id:7,kind:'building',type:'hq',hp:100,x:.5,z:.5,size:4.4,team:0},before=JSON.stringify(building);
  assert.equal(a.update([building]),true);
  assert.equal(a.update([building]),false,'shape stays cached across frames');
  b.update([building]);
  assert.deepEqual(Array.from(a.pixels),Array.from(b.pixels),'same footprint recreates the same contour');
  const at=(x,z)=>a.pixels[(20+z)*field.size+20+x];
  for(const [x,z] of [[0,0],[4,0],[-4,0],[0,4],[0,-4]])assert.equal(at(x,z),255);
  let asymmetric=0;
  for(let z=-9;z<=9;z++)for(let x=-9;x<=9;x++)if(at(x,z)!==at(-x,-z))asymmetric++;
  assert.ok(asymmetric>8,'outer contour must not be a symmetric rounded rectangle');
  b.update([{...building,id:8}]);
  assert.notDeepEqual(Array.from(a.pixels),Array.from(b.pixels),'buildings do not share one stamped shape');
  assert.equal(JSON.stringify(building),before);
});

test('nearby building fringes merge more strongly than either individual apron',()=>{
  const field=new WorkerRoadField(20),a=new BuildingRoadField(field),b=new BuildingRoadField(field),merged=new BuildingRoadField(field),
    first={id:7,kind:'building',type:'depot',hp:100,x:-.5,z:.5,size:2.3,team:0},
    second={...first,id:8,x:7.5};
  a.update([first]);b.update([second]);merged.update([first,second]);
  let blended=0;
  for(let i=0;i<field.pixels.length;i++){
    assert.ok(merged.pixels[i]>=Math.max(a.pixels[i],b.pixels[i]));
    if(a.pixels[i]>0&&a.pixels[i]<255&&b.pixels[i]>0&&b.pixels[i]<255&&merged.pixels[i]>Math.max(a.pixels[i],b.pixels[i]))blended++;
  }
  assert.ok(blended>0,'overlapping edges fill in rather than keeping the weaker seam');
});

test('road closing fills narrow gaps at the weaker wear level without widening isolated strips',()=>{
  const size=19,input=new Uint8Array(size*size),scratch=new Uint8Array(input.length),joined=new Uint8Array(input.length);
  const strip=(x,value)=>{for(let z=4;z<=14;z++)for(let dx=0;dx<2;dx++)input[z*size+x+dx]=value;};
  strip(4,220);strip(9,160);
  const before=Array.from(input);
  closeRoadGaps(input,scratch,joined,size);
  for(let x=6;x<=8;x++)assert.equal(joined[9*size+x],160,'three-cell gap inherits weaker road wear');
  assert.equal(joined[9*size+3],0);assert.equal(joined[9*size+11],0,'outer road edges are not dilated');
  assert.deepEqual(Array.from(input),before,'raw wear remains authoritative for fading');
  input.fill(0);strip(4,220);
  closeRoadGaps(input,scratch,joined,size);
  assert.deepEqual(Array.from(joined),Array.from(input),'isolated straight road keeps its width');
  strip(11,160);closeRoadGaps(input,scratch,joined,size);
  assert.equal(joined[9*size+8],0,'larger gaps remain open');
  input.fill(0);closeRoadGaps(input,scratch,joined,size);
  assert.ok(joined.every(p=>p===0),'expired roads leave no synthetic residue');
});

test('used HQ approaches join the apron without changing entities or worker rules',()=>{
  const view=new BattlefieldView({workerRoads(){}});
  view.world={extent:20,terrainFree:()=>true};
  const hq={id:7,kind:'building',type:'hq',hp:100,progress:1,x:.5,z:.5,size:4.4,team:0},
    miner=x=>({id:1,kind:'unit',type:'worker',hp:10,x,z:.5,team:0,order:{type:'mine',id:99}});
  view.updateWorkerRoads(0,[hq,miner(8.5)],()=>true);
  assert.ok(view.workerRoads.pixels.every(p=>p===0),'standing workers create no connection');
  for(let i=1;i<=40;i++){
    const entities=[hq,miner(i%2?9:8.5)],before=JSON.stringify(entities);
    view.updateWorkerRoads(i*.25,entities,()=>true);
    assert.equal(JSON.stringify(entities),before);
  }
  const field=view.workerRoads,at=x=>20*field.size+Math.floor(x+20);
  assert.ok(field.wear[at(6.5)]>.72,'wear bridges the gap inside the untravelled final approach');
  for(let x=.5;x<=8.5;x++)assert.ok(view.roadPixels[at(x)]>=184,'no break between mature road and apron');
  const before=Array.from(field.pixels);
  view.updateWorkerRoads(10,[hq,miner(8.5)],()=>true);
  assert.deepEqual(Array.from(field.pixels),before,'pause cannot strengthen connectors');
  view.updateWorkerRoads(132,[hq],()=>true);
  assert.ok(field.pixels.every(p=>p===0),'unused connections fade with worker roads');
});

test('HQ connectors exclude hidden, hostile, unfinished and inaccessible targets and non-mining workers',()=>{
  const hq={id:7,kind:'building',type:'hq',hp:100,progress:1,x:.5,z:.5,size:4.4,team:0},
    base={id:1,kind:'unit',type:'worker',hp:10,z:.5,team:0,order:{type:'mine',id:99}};
  for(const variant of [
    {hq:{...hq,team:1}}, {hq:{...hq,progress:.5}}, {hidden:true}, {blocked:true},
    {worker:{order:{type:'move'}}}, {worker:{deliveryForum:42}}, {offset:8}
  ]){
    const view=new BattlefieldView({workerRoads(){}}),expected=new WorkerRoadField(20);
    view.world={extent:20,terrainFree:()=>!variant.blocked};
    for(let i=0;i<=8;i++){
      const w={...base,...variant.worker,x:8.5+(variant.offset||0)+(i%2)*.5};
      view.updateWorkerRoads(i*.25,[variant.hq||hq,w],e=>!variant.hidden||e.id!==7);
      expected.update(i*.25,[w]);
    }
    assert.deepEqual(Array.from(view.workerRoads.pixels),Array.from(expected.pixels),JSON.stringify(variant));
  }
});

test('connection resolver never runs for idle, discontinuous or unobserved movement',()=>{
  const field=new WorkerRoadField(20);let calls=0;
  const connect=()=>{calls++;return {x:0,z:0};};
  field.update(0,[worker(8)],connect);
  field.update(.25,[worker(8)],connect);
  field.update(.5,[],connect);
  field.update(.75,[worker(9)],connect);
  field.update(1,[worker(-9)],connect);
  field.update(4,[worker(8)],connect);
  assert.equal(calls,0);
  assert.ok(field.pixels.every(p=>p===0));
});

test('removing a building apron preserves independent worker wear',()=>{
  const uploads=[],view=new BattlefieldView({workerRoads:data=>uploads.push(Array.from(data))});
  view.world={extent:20};
  const building={id:7,kind:'building',type:'hq',hp:100,x:0,z:0,size:4.4,team:0},
    unit=x=>({...worker(x),kind:'unit',type:'worker',hp:10}),expected=new WorkerRoadField(20);
  for(let i=0;i<=8;i++){
    const w=unit(i%2);
    view.updateWorkerRoads(i*.25,[building,w],()=>true);
    expected.update(i*.25,[w]);
  }
  view.updateWorkerRoads(2,[unit(0)],()=>true);
  assert.deepEqual(uploads.at(-1),Array.from(expected.pixels));
});
