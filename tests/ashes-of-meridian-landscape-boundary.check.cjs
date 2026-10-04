const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts } = require('./helpers/game-scripts.cjs');

function setup() {
  const context = loadScripts(['core', 'renderer-materials', 'renderer-geometry',
    'renderer-terrain-models', 'renderer-landscape', 'world-view'],
    { globals: { innerHeight: 1000 } });
  return vm.runInContext('({TerrainModels, BattlefieldView})', context);
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
