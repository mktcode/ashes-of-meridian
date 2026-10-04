const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts } = require('./helpers/game-scripts.cjs');

function setup() {
  const context = loadScripts(['core', 'renderer-materials', 'renderer-geometry',
    'renderer-terrain-models', 'renderer-landscape', 'content', 'battlefield-shared', 'world', 'world-view'],
    { globals: { innerHeight: 1000 } });
  return vm.runInContext('({TerrainModels, BattlefieldView, SceneryFogField, sceneryEdgeDecor})', context);
}
test('edge recon reveals only its clipped circular footprint, not a corridor inside the playable map', () => {
  const context=loadScripts(['core','world']),Battlefield=vm.runInContext('Battlefield',context),
    world=Object.create(Battlefield.prototype),extent=40,cellSize=2,gridSize=40,
    visible=new Uint8Array(gridSize*gridSize),explored=new Uint8Array(visible.length),
    scan={x:35,z:35,r:9,team:0};
  Object.assign(world,{extent,cellSize,gridSize,visible,explored,surface:null,
    sight:[{visible,explored}],fogPixels:new Uint8Array(visible.length),fogVersion:0});
  world.reveal([], [scan]);
  assert.ok(visible.some(v=>v===255));
  for(let z=0;z<gridSize;z++)for(let x=0;x<gridSize;x++) {
    const inside=Math.hypot((x+.5)*cellSize-extent-scan.x,(z+.5)*cellSize-extent-scan.z)<scan.r+cellSize*.4,
      i=z*gridSize+x;
    assert.equal(visible[i],inside?255:0);
    assert.equal(world.fogPixels[i],inside?255:0);
  }
});

test('scenery fog joins visible terrain with a circular cosmetic halo without altering playable fog', () => {
  const { SceneryFogField }=setup(),extent=40,cell=2,grid=40,source={x:35,z:35,r:9},
    data=new Uint8Array(grid*grid);
  for(let z=0;z<grid;z++)for(let x=0;x<grid;x++)
    if(Math.hypot((x+.5)*cell-extent-source.x,(z+.5)*cell-extent-source.z)<source.r+cell*.4)data[z*grid+x]=255;
  const before=Array.from(data),field=new SceneryFogField(extent,cell,grid),outer=field.update(data,[source]);
  const sample=(x,z)=>{
    const col=Math.floor((x+extent+field.padding*cell)/cell),row=Math.floor((z+extent+field.padding*cell)/cell);
    return col>=0&&col<field.size&&row>=0&&row<field.size?field.pixels[row*field.size+col]:0;
  };
  assert.ok(outer>=source.x+source.r);assert.ok(outer<source.x+source.r+cell*2);
  for(let z=0;z<grid;z++)for(let x=0;x<grid;x++)
    assert.equal(field.pixels[(z+field.padding)*field.size+x+field.padding],data[z*grid+x]);
  assert.equal(sample(39,35),255);assert.equal(sample(41,35),255);
  assert.equal(sample(45,35),0,'no straight visibility corridor after the circular footprint');
  assert.equal(sample(41,43),0,'halo is circular, not a rectangle');
  assert.deepEqual(Array.from(data),before);
  const pixels=field.pixels;field.update(data,[]);
  assert.strictEqual(field.pixels,pixels,'reuse the CPU halo storage');
  assert.equal(sample(41,35),80,'past exterior sight becomes cosmetic exploration, not live sight');
  field.update(data,[{...source,level:0}],(x,z,level)=>level>=1);
  assert.equal(sample(41,35),80,'ground observers cannot brighten higher exterior terrain');
  field.update(data,[{...source,level:Infinity}],(x,z,level)=>level>=1);
  assert.equal(sample(41,35),255,'scans and aircraft bypass the ground tier');
  const padding=field.padding;field.update(data,[{x:0,z:0,r:9}]);
  assert.equal(field.padding,padding);assert.equal(sample(41,35),80,'interior observers need no exterior work');
  field.update(data,[{x:-35,z:-35,r:22}]);
  assert.notStrictEqual(field.pixels,pixels,'grow only when sight actually reaches farther outside');
  assert.equal(sample(41,35),80,'growth preserves already explored exterior coordinates');
  assert.equal(sample(45,35),0);assert.equal(sample(-57,-35),255);
  assert.deepEqual(Array.from(data),before);
});

test('scenery halo uses only the local party sources and resets on perspective changes', () => {
  const {BattlefieldView}=setup(),uploads=[],renderer={viewport:{width:800,height:800},clearStatic(){},
    setBattlefieldProfile(){},geometry(){},releaseGeometry(){},fog:(pixels,size,extent)=>uploads.push({pixels:Array.from(pixels),size,extent})},
    world={extent:40,cellSize:2,gridSize:40,terrainSeed:1,seed:1,viewTeam:0,fogVersion:1,
      fogPixels:new Uint8Array(1600),surface:{maxHeight:20,heightAt:()=>20,visibilityLevelAt:()=>0,visibilityLevel:()=>0},renderProfile:{},definition:{},
      renderData:{placements:[],geometries:[{mesh:'terrain',model:'landscapeRelief',relief:relief(40)}]}},
    state={time:0,entities:[{x:-35,z:0,hp:100,kind:'unit',team:0,vision:9},{x:35,z:0,hp:100,kind:'unit',team:1,vision:9}],
      scans:[{x:35,z:30,r:9,team:0,until:8},{x:0,z:35,r:9,team:1,until:8}]},view=new BattlefieldView(renderer),
    sample=(x,z)=>{const u=uploads.at(-1),col=Math.floor((x+u.extent)/2),row=Math.floor((z+u.extent)/2);return u.pixels[row*u.size+col];};
  view.sync(world,true,state);
  assert.equal(sample(-41,1),255);assert.equal(sample(41,1),0,'enemy vision does not light the local halo');
  assert.equal(sample(41,31),255);assert.equal(sample(1,41),0,'foreign scans stay hidden');
  world.viewTeam=1;world.fogVersion++;view.sync(world,true,state);
  assert.equal(sample(-41,1),0,'previous party exploration is discarded');assert.equal(sample(41,1),255);
  assert.ok(world.fogPixels.every(v=>v===0));
});

test('edge decoration reuses complete existing clusters with a fixed small budget and no CPU mutation', () => {
  const {sceneryEdgeDecor}=setup(),placements=[];
  for(let z=-95;z<=95;z+=5)for(const mesh of ['ecologyTrunk0','ecologyGrove0'])
    placements.push({mesh,position:[-95,19.65,z],scale:[1,1,1],color:0xffffff,rotation:[0,0,0],glow:0,alpha:1,layer:'static',material:'LEAF'});
  placements.push({...placements[0],mesh:'hq'});
  const field=relief(125,100),world={extent:100,surface:{heightAt:()=>20},
    renderData:{placements,geometries:[{mesh:'backdrop',model:'landscapeRelief',relief:field}]}},before=JSON.stringify(world),
    decor=sceneryEdgeDecor(world),groups=new Map();
  for(const p of decor) {
    assert.ok(Math.max(Math.abs(p.position[0]),Math.abs(p.position[2]))>100);
    assert.ok(Math.max(Math.abs(p.position[0]),Math.abs(p.position[2]))<=124);
    assert.ok(p.mesh.startsWith('ecology'));
    const key=p.position.join(':');groups.set(key,[...(groups.get(key)||[]),p.mesh]);
  }
  assert.ok(groups.size>0&&groups.size<=24);
  for(const parts of groups.values())assert.deepEqual(parts.sort(),['ecologyGrove0','ecologyTrunk0']);
  assert.equal(JSON.stringify(world),before);
});

function relief(extent, innerExtent = 0) {
  const step = 5, size = extent * 2 / step + 3;
  return { extent, innerExtent, step, size,
    heights: new Float32Array(size * size).fill(20),
    colors: new Float32Array(size * size * 3).fill(.3) };
}
function bounds(mesh) {
  let extent = 0;
  for (let i = 0; i < mesh.length; i += 9) extent = Math.max(extent, Math.abs(mesh[i]), Math.abs(mesh[i + 2]));
  return extent;
}

test('landscape skin retains its top triangles and closes all raised edges to the exterior floor', () => {
  const { TerrainModels } = setup(), field = relief(10), before = JSON.stringify(field),
    mesh = TerrainModels.geometry({ mesh: 'terrain', model: 'landscapeRelief', relief: field }),
    topLength = (field.size - 3) ** 2 * 54;
  for (let i = 1; i < topLength; i += 9) assert.equal(mesh[i], 20);
  assert.equal(mesh.length - topLength, 4 * (field.size - 3) * 54);
  for (const [axis, value] of [[0,-10],[0,10],[2,-10],[2,10]]) {
    assert.ok(Array.from({ length: (mesh.length - topLength) / 9 }, (_, j) => topLength + j * 9)
      .some(i => mesh[i + axis] === value && Math.abs(mesh[i + 1] + .13) < 1e-6));
  }
  assert.equal(JSON.stringify(field), before);
});

test('exterior continuation preserves its inner mesh and has constant geometry cost regardless of width', () => {
  const { TerrainModels } = setup(), field = relief(20, 10), before = JSON.stringify(field),
    build = outerExtent => TerrainModels.geometry({ mesh: 'backdrop', model: 'landscapeRelief',
      relief: { ...field, outerExtent } }), base = build(20), small = build(40), wide = build(400);
  assert.deepEqual(wide.subarray(0, base.length), base);
  assert.equal(small.length, wide.length);
  assert.equal(wide.length - base.length, 4 * (field.size - 3) * 54);
  assert.equal(bounds(small), 40); assert.equal(bounds(wide), 400);
  assert.equal(JSON.stringify(field), before);
});

test('world view resizes only the sparse exterior for maximum zoom and releases excess coverage on narrower windows', () => {
  const { BattlefieldView } = setup(), uploads = [],
    renderer = { viewport: { width: 800, height: 800 }, clearStatic() {}, setBattlefieldProfile() {},
      geometry: (name, mesh) => uploads.push({ name, mesh }), releaseGeometry() {} },
    world = { extent: 10, cellSize: 5, gridSize: 4, terrainSeed: 1409, seed: 1409,
      surface: { maxHeight: 20 }, renderProfile: {}, definition: {}, fogVersion: 0,
      renderData: { geometries: [
        { mesh: 'terrain', model: 'landscapeRelief', relief: relief(10) },
        { mesh: 'backdrop', model: 'landscapeRelief', relief: relief(20, 10) }
      ], placements: [] } }, before = JSON.stringify(world), view = new BattlefieldView(renderer);
  view.sync(world, false); view.sync(world, false);
  assert.deepEqual(uploads.map(u => u.name), ['terrain', 'backdrop']);
  const narrow = uploads.at(-1);
  renderer.viewport.width = 4000;
  view.sync(world, false); view.sync(world, false);
  assert.deepEqual(uploads.map(u => u.name), ['terrain', 'backdrop', 'backdrop']);
  const wide = uploads.at(-1), radius = Math.hypot(115 * .5 * 4,
    115 * .5 * .8 * Math.hypot(1.1,.82) / 1.1 + 20 * .82 / 1.1);
  assert.ok(bounds(wide.mesh) >= world.extent + radius + 8);
  assert.ok(bounds(wide.mesh) < world.extent + radius + 12, 'only a few meters of padding');
  assert.equal(wide.mesh.length, narrow.mesh.length, 'wider coverage adds no terrain cells');
  renderer.viewport.width = 800;
  view.sync(world, false);
  assert.equal(uploads.at(-1).name, 'backdrop');
  assert.equal(bounds(uploads.at(-1).mesh), bounds(narrow.mesh));
  assert.equal(JSON.stringify(world), before, 'view never changes terrain, placements or simulation data');
});
