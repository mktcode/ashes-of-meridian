// Build first (npm run build), then run without a browser: node --max-old-space-size=128 --test --test-concurrency=1 tests/ashes-of-meridian-terrain.check.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { BATTLEFIELD_SCRIPTS, readScripts, loadScripts } = require('./helpers/game-scripts.cjs');

const scripts = readScripts();
const context = loadScripts(['core', 'renderer-assets', 'renderer-geometry', 'renderer-terrain-models', 'renderer-desert-landscape', 'renderer-desert-terrain', 'renderer-alien-terrain', 'renderer-mothership-terrain', 'content', ...BATTLEFIELD_SCRIPTS, 'world'], { scripts });
const { geom, TerrainModels, Battlefield, insidePolygon, pointSegment, BATTLEFIELDS } =
  vm.runInContext('({geom, TerrainModels, Battlefield, insidePolygon, pointSegment, BATTLEFIELDS})', context);

test('map dimensions are instance-local, validated and keep square cells at larger extents', () => {
  const definition = BATTLEFIELDS['alien-planet'], original = definition.size;
  try {
    for (const [extent, cellSize, grid] of [[90,2.5,72], [135,2.5,108], [135,3,90], [136.25,2.5,109]]) {
      definition.size = { extent, cellSize };
      const w = new Battlefield(43015, 'alien-planet');
      assert.deepEqual([w.extent,w.cellSize,w.gridSize], [extent,cellSize,grid]);
      for (const data of [w.blocked,w.staticGrid,w.terrainFeatureGrid,w.fogPixels,
        ...w.sight.flatMap(v => [v.visible,v.explored])]) assert.equal(data.length, grid*grid);
      assert.equal(w.terrainColors.length, grid*grid*4);
      assert.equal(w.renderData.groundColors.length, grid*grid*2);
      assert.equal(w.renderData.geometries[0].extent, extent);
      const slab = w.renderData.placements.find(p => p.mesh === 'box' && p.position[1] === -8);
      assert.deepEqual(Array.from(slab.scale), [extent*2,15,extent*2]);
      for (let i=0;i<grid*grid;i++) { const p=w.point(i); assert.equal(w.idx(p.x,p.z),i); }
      assert.equal(w.idx(-extent,-extent),0); assert.equal(w.idx(extent,extent),grid*grid-1);
      definition.size = { extent: 90, cellSize: 2.5 };
      assert.equal(w.extent,extent, 'active worlds snapshot dimensions');
    }
    assert.equal(new Battlefield(43015, 'desert').gridSize,72);
    for (const size of [{extent:NaN,cellSize:2.5},{extent:135,cellSize:0},
      {extent:135,cellSize:Infinity},{extent:135,cellSize:4},{extent:10,cellSize:2.5}]) {
      definition.size=size;
      assert.throws(()=>new Battlefield(1,'alien-planet'), /Battlefield size/);
    }
  } finally { definition.size=original; }
});

test('four party sight buffers remain isolated, while the presentation view still belongs to party zero', () => {
  const w = new Battlefield(1409, 'mothership', 4), sites = w.layout.startSites;
  assert.equal(w.sight.length, 4);
  assert.strictEqual(w.visible, w.sight[0].visible);
  assert.strictEqual(w.explored, w.sight[0].explored);
  w.reveal([], sites.map((p, team) => ({ ...p, team, r: 5 })));
  for (let team = 0; team < 4; team++) for (let other = 0; other < 4; other++) {
    assert.equal(w.sight[team].visible[w.idx(sites[other].x, sites[other].z)], team === other ? 255 : 0);
    if (team !== other) assert.notStrictEqual(w.sight[team].explored, w.sight[other].explored);
  }
  w.reveal([]);
  assert.equal(w.sight[3].visible[w.idx(sites[3].x, sites[3].z)], 0);
  assert.equal(w.sight[3].explored[w.idx(sites[3].x, sites[3].z)], 1);
  assert.equal(w.selectView(3), true);
  assert.strictEqual(w.visible, w.sight[3].visible);
  assert.equal(w.fogPixels[w.idx(sites[3].x, sites[3].z)], 80);
  const version = w.fogVersion;
  w.explore(0, sites[2], 5);
  assert.equal(w.fogVersion, version, 'another party exploration does not update local fog');
  w.explore(3, sites[0], 5);
  assert.equal(w.fogPixels[w.idx(sites[0].x, sites[0].z)], 80);
  assert.equal(w.fogVersion, version + 1);
  const fresh = new Battlefield(1409, 'mothership');
  assert.equal(fresh.viewTeam, 0);
  assert.equal(fresh.sight.length, 2);
  assert.ok(fresh.sight.every(view => !view.explored.some(Boolean)));
  for (const count of [0, 1, 5, 2.5, NaN]) assert.throws(() => new Battlefield(1409, 'mothership', count));
});

test('larger worlds navigate, rebuild blockers and reveal both teams beyond the old edges', () => {
  const definition=BATTLEFIELDS['alien-planet'], original=definition.size;
  try {
    definition.size={extent:135,cellSize:2.5};
    const w=new Battlefield(43015,'alien-planet'); w.staticGrid.fill(0); w.rebuild([]);
    assert.equal(w.blockedAt(120,110),false); assert.equal(w.blockedAt(133,0),true);
    assert.deepEqual(JSON.parse(JSON.stringify(w.nearest(999,-999))),{x:131,z:-131});
    assert.deepEqual(JSON.parse(JSON.stringify(w.path(0,0,999,-999,true).points)),[{x:130,z:-130}]);
    w.rebuild([{hp:100,kind:'building',x:110,z:110,size:5}]);
    const start={x:95,z:110}, end={x:125,z:110}, path=w.path(start.x,start.z,end.x,end.z).points;
    assert.equal(w.lineFree(start,end),false); assert.ok(path.length>1);
    assert.deepEqual(JSON.parse(JSON.stringify(path.at(-1))),end);
    let anchor=start;
    for (const p of path) { assert.ok(w.lineFree(anchor,p)); anchor=p; }
    w.reveal([], [{team:0,x:120,z:110,r:7},{team:1,x:-120,z:-110,r:7}]);
    assert.equal(w.visible[w.idx(120,110)],255); assert.equal(w.visible[w.idx(-120,-110)],0);
    assert.equal(w.sight[1].visible[w.idx(-120,-110)],255);
    w.reveal([]); assert.equal(w.fogPixels[w.idx(120,110)],80);
    assert.equal(w.sight[1].explored[w.idx(-120,-110)],1);
  } finally { definition.size=original; }
});

test('large-grid path budget traverses a winding route requiring more than 5600 cells', () => {
  const definition=BATTLEFIELDS['alien-planet'], original=definition.size;
  try {
    definition.size={extent:135,cellSize:2.5};
    const w=new Battlefield(43015,'alien-planet'), n=w.gridSize;
    w.blocked.fill(1);
    for (let z=1;z<n-1;z+=2) {
      for (let x=1;x<n-1;x++) w.blocked[z*n+x]=0;
      if (z+1<n-1) w.blocked[(z+1)*n+(((z-1)/2)%2 ? 1 : n-2)]=0;
    }
    const start=w.point(n+1), end={x:130,z:w.point(105*n+106).z};
    const path=w.path(start.x,start.z,end.x,end.z).points;
    assert.ok(path.length>50); assert.deepEqual(JSON.parse(JSON.stringify(path.at(-1))),end);
    let anchor=start;
    for (const p of path) { assert.ok(w.lineFree(anchor,p)); anchor=p; }
  } finally { definition.size=original; }
});

test('embedded skybox preserves the canonical WebP bytes and is wired as a non-repeating texture', () => {
  const url = vm.runInContext('MERIDIAN_TEXTURES.sky', context);
  assert.match(url, /^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/);
  const payload = url.split(',')[1], image = Buffer.from(payload, 'base64');
  assert.equal(image.toString('base64'), payload);
  assert.deepEqual(image, readFileSync(join(__dirname, '../assets/textures/skybox.webp')));
  assert.equal(image.toString('ascii', 0, 4), 'RIFF');
  assert.equal(image.toString('ascii', 8, 12), 'WEBP');
  const runtime = scripts.find(s => s.name === 'renderer-runtime').source;
  assert.ok(runtime.includes("sky: { texture: this.skyTex, fallback: [5, 9, 16], repeat: false, resident: false }"));
  assert.ok(runtime.includes('img.src = MERIDIAN_TEXTURES[name];'));
});

test('embedded ground atlases preserve the canonical WebP bytes without conversion', () => {
  for (const [key, file] of Object.entries({
    rockClusters: 'texture-ground-rock-clusters.webp',
    desertShrubs: 'texture-ground-desert-shrubs.webp'
  })) {
    const url = vm.runInContext(`MERIDIAN_TEXTURES.${key}`, context);
    assert.match(url, /^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/);
    const payload = url.split(',')[1], image = Buffer.from(payload, 'base64');
    assert.equal(image.toString('base64'), payload);
    assert.deepEqual(image, readFileSync(join(__dirname, '..', 'assets/textures', file)));
    assert.equal(image.toString('ascii', 0, 4), 'RIFF');
    assert.equal(image.toString('ascii', 8, 12), 'WEBP');
  }
});

test('Desert opts into its dedicated rock surface', () => {
  const desert = BATTLEFIELDS.desert.render;
  assert.equal(desert.groundTexture, 'ground');
  assert.equal(desert.rockSurface.texture, 'desertRock');
  assert.ok(Number.isFinite(desert.rockSurface.metersPerTile) && desert.rockSurface.metersPerTile > 0);
  for (const map of ['alien-planet', 'mothership']) {
    assert.equal(BATTLEFIELDS[map].render.rockSurface, undefined);
    assert.notEqual(BATTLEFIELDS[map].render.groundTexture, 'ground');
    assert.equal(BATTLEFIELDS[map].render.rockDecor.opacity, 0);
    assert.equal(BATTLEFIELDS[map].render.shrubDecor.opacity, 0);
  }
});

function layoutHash(w) {
  const rockGrid = new Uint8Array(w.staticGrid.length);
  for (const rock of w.rocks) w.mark(rockGrid, rock.x, rock.z, rock.r);
  for (let i = 0; i < rockGrid.length; i++)
    assert.equal(w.staticGrid[i], rockGrid[i] | w.terrainFeatureGrid[i], 'only sampled relief and solid stones block');
  return createHash('sha256').update(rockGrid).update(w.terrainFeatureGrid).update(w.terrainColors)
    .update(JSON.stringify(w.rocks)).digest('hex');
}

test('all named classic scripts parse, including local files and scripts not executed by these tests', () => {
  for (const { source, filename } of scripts) new vm.Script(source, { filename });
});

test('rock meshes are deterministic, finite, bounded and inexpensive', () => {
  const hashes = new Set();
  for (const [kind, seed] of [['boulder', 173], ['crag', 397], ['ridge', 619], ['shelf', 853]]) {
    const mesh = geom.rock(seed, kind);
    assert.deepEqual(mesh, geom.rock(seed, kind));
    assert.notDeepEqual(mesh, geom.rock(seed + 1, kind));
    assert.equal(mesh.length % 27, 0);
    assert.ok(mesh.length / 27 <= 100, 'at most 100 triangles per shared mesh');
    for (let i = 0; i < mesh.length; i += 9) {
      assert.ok(mesh.slice(i, i + 9).every(Number.isFinite));
      assert.ok(Math.hypot(mesh[i], mesh[i + 2]) <= 1.000001);
      assert.ok(mesh[i + 1] >= 0 && mesh[i + 1] <= 1.3);
      assert.ok(Math.abs(Math.hypot(...mesh.slice(i + 3, i + 6)) - 1) < 1e-9);
    }
    hashes.add(createHash('sha256').update(JSON.stringify(mesh)).digest('hex'));
  }
  assert.equal(hashes.size, 4, 'four distinct silhouettes');
});

test('Desert rock meshes are closed, bounded and crease-shaded within a small fixed upload budget', () => {
  const budgets = { desertBoulder: 320, desertCrag: 320, desertRidge: 320, desertShelf: 156, desertPebble: 42, desertChip: 42 };
  let bytes = 0;
  for (const [model, budget] of Object.entries(budgets)) {
    const mesh = TerrainModels[model](43015);
    assert.deepEqual(mesh, TerrainModels[model](43015));
    assert.notDeepEqual(mesh, TerrainModels[model](43016));
    assert.equal(mesh.length / 27, budget); bytes += mesh.length * 4;
    const edges = new Map(); let maxY = -Infinity, minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < mesh.length; i += 27) {
      const points = [0, 9, 18].map(k => mesh.slice(i + k, i + k + 3));
      const a = points[1].map((v, k) => v - points[0][k]), b = points[2].map((v, k) => v - points[0][k]);
      const cross = [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
      assert.ok(Math.hypot(...cross) > 1e-9, 'no degenerate faces');
      for (let j = 0; j < 3; j++) {
        const p = points[j], normal = mesh.slice(i + j * 9 + 3, i + j * 9 + 6);
        assert.ok(mesh.slice(i + j * 9, i + j * 9 + 9).every(Number.isFinite));
        assert.ok(Math.hypot(p[0], p[2]) <= 1.000001, 'inside the unchanged radial envelope');
        assert.ok(p[1] >= -.13 && p[1] <= 1.1, 'no taller shadow casters');
        assert.ok(Math.abs(Math.hypot(...normal) - 1) < 1e-6);
        assert.ok(normal.reduce((s, v, k) => s + v * cross[k], 0) > 0, 'shading normal follows face winding');
        maxY = Math.max(maxY, p[1]); minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
        const edge = [p, points[(j + 1) % 3]].map(v => JSON.stringify(v)).sort().join('|');
        edges.set(edge, (edges.get(edge) || 0) + 1);
      }
    }
    assert.ok([...edges.values()].every(n => n === 2), 'each interlocking stone is a closed mesh');
    if (!['desertPebble', 'desertChip'].includes(model)) assert.ok(maxX - minX > 1.5, 'broad readable blocker foot');
    if (model === 'desertShelf') assert.ok(maxY < .35, 'slabs, not upright pillars');
  }
  assert.ok(bytes < 150000, 'six reusable meshes, not geometry per instance/frame');
});

test('Desert cosmetic scatter cannot relocate cliffs, solid stones, routes or ground samples', () => {
  const Builder = vm.runInContext('BattlefieldBuilder', context), original = Builder.prototype.cosmeticRandom;
  const before = new Battlefield(1409, 'desert');
  try {
    Builder.prototype.cosmeticRandom = () => () => .5;
    const after = new Battlefield(1409, 'desert');
    for (const key of ['rocks', 'layout', 'staticGrid', 'blocked', 'terrainFeatureGrid', 'terrainColors']) assert.deepEqual(after[key], before[key], key);
    assert.deepEqual(after.renderData.geometries, before.renderData.geometries);
    assert.deepEqual(after.renderData.groundColors, before.renderData.groundColors);
    assert.notDeepEqual(after.renderData.placements, before.renderData.placements);
    for (const map of ['alien-planet', 'mothership']) assert.ok(!new Battlefield(43015, map).renderData.geometries.some(d => d.model.startsWith('desert')));
  } finally { Builder.prototype.cosmeticRandom = original; }
});

function assertClosedFractures(mesh) {
  const edges = new Map(); let volume = 0;
  for (let i = 0; i < mesh.length; i += 27) {
    const p = [0, 9, 18].map(k => mesh.slice(i + k, i + k + 3));
    const a = p[1].map((v, k) => v - p[0][k]), b = p[2].map((v, k) => v - p[0][k]);
    const cross = [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    assert.ok(Math.hypot(...cross) > 1e-10, 'no collapsed fracture triangles');
    volume += p[0][0]*(p[1][1]*p[2][2]-p[1][2]*p[2][1]) +
      p[0][1]*(p[1][2]*p[2][0]-p[1][0]*p[2][2]) + p[0][2]*(p[1][0]*p[2][1]-p[1][1]*p[2][0]);
    for (let j = 0; j < 3; j++) {
      const n = mesh.slice(i + j * 9 + 3, i + j * 9 + 6);
      assert.ok(n.every(Number.isFinite) && Math.abs(Math.hypot(...n) - 1) < 1e-8);
      assert.ok(n.reduce((s, v, k) => s + v * cross[k], 0) > 0);
      const [a, b] = [p[j], p[(j + 1) % 3]].map(v => v.map(x => x.toFixed(7)).join(','));
      const key = [a, b].sort().join('|'), edge = edges.get(key) || { count: 0, winding: 0 };
      edge.count++; edge.winding += a < b ? 1 : -1; edges.set(key, edge);
    }
  }
  assert.ok(volume > 0, 'outward closed solid volume');
  assert.ok([...edges.values()].every(e => e.count === 2 && e.winding === 0), 'no open cuts or reversed cap edges');
}

test('stone grounding interpolates the actual rendered triangles, including both diagonals', () => {
  const surface = { extent:1, step:1, size:5, innerExtent:0, heights:new Float32Array(25) };
  surface.heights[12] = 4;
  const mesh = TerrainModels.geometry({mesh:'test', model:'desertRelief', relief:surface}),
    height = vm.runInContext('desertReliefHeight',context);
  for (let i=0; i<mesh.length; i+=27) for (const weights of [[1/3,1/3,1/3],[.1,.2,.7]]) {
    const p = [0,1,2].map(axis=>weights.reduce((sum,w,k)=>sum+w*mesh[i+k*9+axis],0));
    assert.ok(Math.abs(height(surface,p[0],p[2])-p[1])<1e-6, 'not bilinear or unsampled analytic noise');
  }
});

test('Desert dressing is closed and rooted; taller fragments stay entirely on blocked ground', () => {
  for (const seed of [1409, 2219, 24080, 43015]) {
    const w = new Battlefield(seed, 'desert'), names = ['desertTalus', 'desertFlake', 'desertPebble', 'desertChip'],
      extras = w.renderData.placements.filter(p => names.includes(p.mesh));
    assert.ok(extras.length > 1000 && extras.length < 9000);
    let prominent = 0, low = 0;
    const surfaces = w.renderData.geometries.filter(d=>d.relief).map(d=>d.relief), sample = vm.runInContext('desertReliefHeight',context),
      height = (x,z)=>sample(Math.max(Math.abs(x),Math.abs(z))<=w.extent?surfaces[0]:surfaces[1],x,z);
    for (const p of extras) {
      assert.equal(p.material, 'ROCK'); assert.equal(p.layer, 'static');
      const [x, y, z] = p.position, r = p.scale[0];
      assert.ok(p.scale[1] > 0 && r <= 2 && y >= -.166);
      assert.equal(y,Math.min(height(x,z),height(x+r,z),height(x-r,z),height(x,z+r),height(x,z-r))-.025,'embedded in the rendered surface');
      if (p.scale[1] * 1.2 > .28) {
        prominent++;
        const a = w.idx(x-r,z-r), b = w.idx(x+r,z+r), n = w.gridSize;
        for (let row = Math.floor(a/n); row <= Math.floor(b/n); row++) for (let col = a%n; col <= b%n; col++)
          assert.equal(w.staticGrid[row*n+col], 1, 'no decorative tall stone over navigable ground');
      } else low++;
      for (const s of w.layout.startSites) assert.ok(Math.hypot(x-s.x,z-s.z) > 10, 'quiet HQ core');
    }
    assert.ok(prominent > 100 && low > 100, 'both stronger embedded detail and traversable valley scatter');
    for (const name of names.slice(0,2)) {
      const mesh = TerrainModels[name](seed);
      assert.deepEqual(mesh, TerrainModels[name](seed)); assert.notDeepEqual(mesh, TerrainModels[name](seed ^ 1));
      for (let i = 0; i < mesh.length; i += 9) {
        assert.ok(Math.hypot(mesh[i],mesh[i+2]) <= 1.000001);
        assert.ok(mesh[i+1] >= -.060001 && mesh[i+1] <= 1.200001);
      }
      assertClosedFractures(mesh);
    }
  }
});

test('Desert wall-foot debris is closed, grounded and low unless its whole footprint is blocked', () => {
  const names=['desertButtress','desertScree'], sample=vm.runInContext('desertReliefHeight',context);
  for(const seed of [1409,2219,24080,43015]) {
    const w=new Battlefield(seed,'desert'), surfaces=w.renderData.geometries.filter(d=>d.relief).map(d=>d.relief),
      height=(x,z)=>sample(Math.max(Math.abs(x),Math.abs(z))<=w.extent?surfaces[0]:surfaces[1],x,z), peaks=new Map();
    let bytes=0, prominent=0, low=0;
    for(const name of names) {
      const descriptor=w.renderData.geometries.find(d=>d.model===name), mesh=TerrainModels.geometry(descriptor);
      assert.deepEqual(mesh,TerrainModels.geometry(descriptor));
      assert.notDeepEqual(mesh,TerrainModels[name](descriptor.seed^1));
      assertClosedFractures(mesh); bytes+=mesh.length*4;
      let peak=0;
      for(let i=0;i<mesh.length;i+=9) {
        assert.ok(mesh.slice(i,i+9).every(Number.isFinite));
        assert.ok(Math.hypot(mesh[i],mesh[i+2])<=1.000001);
        assert.ok(mesh[i+1]>=-.13 && mesh[i+1]<=1.2);
        peak=Math.max(peak,mesh[i+1]);
      }
      peaks.set(name,peak);
    }
    assert.ok(bytes<80000,'two shared meshes, no unique geometry per deposit');
    const deposits=w.renderData.placements.filter(p=>names.includes(p.mesh));
    assert.ok(deposits.length>500 && deposits.length<4000,'substantial, bounded wall-foot dressing');
    for(const p of deposits) {
      const [x,y,z]=p.position, r=p.scale[0];
      assert.equal(p.material,'ROCK'); assert.equal(p.layer,'static');
      assert.ok(r>0 && r<2 && p.scale[1]>0 && p.scale[1]<=r*1.7,'no slope-compensating vertical pillars');
      assert.equal(y,Math.min(height(x,z),height(x+r,z),height(x-r,z),height(x,z+r),height(x,z-r))-.025);
      for(const s of w.layout.startSites) assert.ok(Math.hypot(x-s.x,z-s.z)>22,'quiet construction cores');
      if(y+p.scale[1]*peaks.get(p.mesh)>.28) {
        prominent++;
        assert.ok(Math.max(Math.abs(x)+r,Math.abs(z)+r)<=w.extent);
        const a=w.idx(x-r,z-r), b=w.idx(x+r,z+r), n=w.gridSize;
        for(let row=Math.floor(a/n);row<=Math.floor(b/n);row++) for(let col=a%n;col<=b%n;col++)
          assert.equal(w.staticGrid[row*n+col],1,'no tall decoration in a free cell');
      } else low++;
    }
    assert.ok(prominent>100 && low>100,'embedded boulder groups and shallow outwash');
  }
});

test('Desert relief draws CPU samples exactly, with finite normals and upward nondegenerate faces', () => {
  const w = new Battlefield(43015, 'desert'), descriptors = w.renderData.geometries.filter(d => d.relief);
  assert.equal(descriptors.length, 2);
  let triangles = 0;
  const seam = new Map();
  for (const descriptor of descriptors) {
    const s = descriptor.relief, before = Buffer.from(s.heights.buffer).toString('base64'), mesh = TerrainModels.geometry(descriptor);
    assert.ok(ArrayBuffer.isView(mesh), 'large meshes use preallocated typed storage, not growable JS arrays');
    assert.deepEqual(mesh, TerrainModels.geometry(descriptor));
    assert.equal(Buffer.from(s.heights.buffer).toString('base64'), before, 'renderer never modifies CPU relief');
    assert.equal(s.size, s.extent * 2 / s.step + 3, 'one-vertex halo for shared-edge normals');
    assert.equal(mesh.length % 27, 0); triangles += mesh.length / 27;
    for (let i = 0; i < mesh.length; i += 9) {
      const [x,y,z,nx,ny,nz] = mesh.subarray(i,i+6), row = Math.round((z+s.extent)/s.step)+1, col = Math.round((x+s.extent)/s.step)+1;
      for (let k = 0; k < 9; k++) assert.ok(Number.isFinite(mesh[i+k]));
      assert.equal(y, s.heights[row*s.size+col]);
      assert.ok(Math.abs(Math.hypot(nx,ny,nz)-1) < 1e-6 && ny > 0);
      assert.ok(y >= -.141 && y < w.definition.render.terrainReceiverHeight);
      assert.ok(Math.max(Math.abs(x),Math.abs(z)) <= s.extent);
      if (!s.innerExtent && y > .18) assert.ok(w.blockedAt(x,z), 'no rendered slope over walkable cells');
      if (Math.max(Math.abs(x),Math.abs(z)) === w.extent) {
        const key = `${x},${z}`, value = Array.from(mesh.subarray(i+1,i+9));
        if (seam.has(key)) assert.deepEqual(value,seam.get(key),'matching heights, normals and color across technical border');
        else seam.set(key,value);
      }
    }
    for (let i = 0; i < mesh.length; i += 27) {
      const ax=mesh[i+9]-mesh[i], az=mesh[i+11]-mesh[i+2], bx=mesh[i+18]-mesh[i], bz=mesh[i+20]-mesh[i+2];
      assert.ok(az*bx-ax*bz > 0, 'upward winding and nonzero projected area');
      if (!s.innerExtent && (mesh[i+1]+mesh[i+10]+mesh[i+19])/3 > .18)
        assert.ok(w.blockedAt((mesh[i]+mesh[i+9]+mesh[i+18])/3,(mesh[i+2]+mesh[i+11]+mesh[i+20])/3),'triangle interiors also block');
      if (s.innerExtent) assert.ok([0,2].some(axis => [-1,1].some(sign => [0,9,18].every(k => sign*mesh[i+k+axis] >= s.innerExtent))),
        'no overlapping triangles between interior and exterior');
    }
  }
  assert.ok(seam.size > 500, 'a continuous shared edge rather than four separately closed walls');
  assert.ok(triangles > 700000 && triangles < 900000, 'dense relief, no accidental duplicated tiles');
  layoutHash(w);
});

test('Desert basin rims erode the reserved envelope and meet the floor with shallow continuous feet', () => {
  const {desertCanyonPlan,desertElevation}=vm.runInContext('({desertCanyonPlan,desertElevation})',context);
  for (const seed of [1409,1420,43015,6633]) {
    const plan=desertCanyonPlan(BATTLEFIELDS.desert.layout,seed), basins=plan.sites.filter(s=>s.planes);
    assert.equal(basins.length,4);
    const shapes=new Set();
    for (const basin of basins) {
      assert.equal(basin.planes.length,8);
      shapes.add(JSON.stringify(basin.planes));
      const radii=[];
      let curvedFaces=0;
      for(let i=0;i<360;i++) {
        const angle=i*Math.PI/180, x=Math.cos(angle), z=Math.sin(angle);
        assert.ok(plan.siteClearance(basin,basin.x+x*28,basin.z+z*28)<=1e-9,'entire old reserve remains free');
        let lo=28, hi=44;
        for(let j=0;j<16;j++) {
          const r=(lo+hi)/2;
          if(plan.siteClearance(basin,basin.x+x*r,basin.z+z*r)>0) hi=r; else lo=r;
        }
        radii.push((lo+hi)/2);
      }
      assert.ok(Math.max(...radii)-Math.min(...radii)>3,'no circular outline');
      assert.ok(Math.max(...radii)<42,'bounded local erosion');
      for(const p of basin.planes) {
        const depths=[-3,0,3].map(along=>plan.siteClearance(basin,
          basin.x+p.x*p.offset-p.z*along,basin.z+p.z*p.offset+p.x*along));
        assert.ok(depths.every(d=>d<-.39),'the planning envelope is no longer a cut wall');
        if(Math.abs(depths[0]+depths[2]-2*depths[1])>.15) curvedFaces++;
      }
      assert.ok(curvedFaces>=3,'alcoves, not merely another rotated polygon');
    }
    assert.equal(shapes.size,4,'different rock faces at each start');
    const envelopeClearance=(s,x,z)=>s.planes?
      Math.max(...s.planes.map(p=>(x-s.x)*p.x+(z-s.z)*p.z-p.offset)):plan.circleClearance(s,x,z),
      elevation=desertElevation(seed,90,plan), unweathered=desertElevation(seed,90,{...plan,siteClearance:envelopeClearance},false);
    let changed=0, shallow=0;
    for(let z=-90;z<=90;z+=2) for(let x=-90;x<=90;x+=2) {
      const before=unweathered(x,z), after=elevation(x,z);
      assert.ok(after<=before+1e-9,'rim shaping can only open, never obstruct, the existing relief');
      if(basins.every(s=>Math.hypot(x-s.x,z-s.z)>s.bound)) assert.equal(after,before,'other landforms stay unchanged');
      if(Math.abs(before-after)>.1) changed++;
      const d=Math.min(...basins.map(s=>plan.siteClearance(s,x,z)));
      if(d>0 && d<1 && before>2) {
        assert.ok(after<.02,'no tall first sample row / triangular wall-foot teeth'); shallow++;
      }
    }
    assert.ok(changed>30,'visible rim shaping');
    assert.ok(shallow>15,'a shallow foot on actual formerly raised wall segments');
  }
});

test('Desert rim refinement cannot reshuffle solid-rock proposals outside the basins', () => {
  const originalPlan=vm.runInContext('desertCanyonPlan',context);
  context.testCanyonPlan=originalPlan;
  try {
    for(const seed of [1409,43015]) {
      const shaped=new Battlefield(seed,'desert'), plan=originalPlan(shaped.layout,seed), basins=plan.sites.filter(s=>s.planes),
        relief=shaped.renderData.geometries.find(d=>d.relief&&!d.relief.innerExtent).relief,
        elevation=vm.runInContext('desertElevation',context)(seed,shaped.extent,plan);
      for(let row=0;row<relief.size;row++) for(let col=0;col<relief.size;col++)
        assert.equal(relief.heights[row*relief.size+col],Math.fround(elevation(-relief.extent+(col-1)*relief.step,-relief.extent+(row-1)*relief.step)),
          'bounded refinement visits every changed sample, including the halo');
      vm.runInContext('desertCanyonPlan=(...args)=>{const p=testCanyonPlan(...args);return {...p,siteClearance:p.circleClearance};}',context);
      const round=new Battlefield(seed,'desert');
      vm.runInContext('desertCanyonPlan=testCanyonPlan',context);
      assert.ok(shaped.staticGrid.every((cell,i)=>cell<=round.staticGrid[i]),'no formerly free navigation cell becomes blocked');
      const proposals=new Map(round.rocks.map(r=>[`${r.x},${r.z}`,r.r]));
      for(const r of shaped.rocks) assert.equal(proposals.get(`${r.x},${r.z}`),r.r,'only omit proposals, never reroll');
      const remote=r=>basins.every(s=>Math.hypot(r.x-s.x,r.z-s.z)>s.bound+r.r);
      assert.equal(JSON.stringify(shaped.rocks.filter(remote)),JSON.stringify(round.rocks.filter(remote)));
      const names=['desertBoulder','desertCrag','desertRidge','desertShelf'], placements=w=>w.renderData.placements.filter(p=>
        names.includes(p.mesh)&&remote({x:p.position[0],z:p.position[2],r:p.scale[0]}));
      assert.equal(JSON.stringify(placements(shaped)),JSON.stringify(placements(round)),'remote model, rotation, scale and grounding stay identical');
      assert.equal(JSON.stringify(shaped.layout.corridors),JSON.stringify(round.layout.corridors));
    }
  } finally {
    vm.runInContext('desertCanyonPlan=testCanyonPlan',context); delete context.testCanyonPlan;
  }
});

test('Desert basin loops retain another approach when the central exit is obstructed', () => {
  const w = new Battlefield(1409,'desert');
  for (const route of w.layout.corridors.slice(0,4)) {
    w.rebuild([]); w.mark(w.blocked,route[2][0],route[2][1],10);
    const start = {x:route[0][0],z:route[0][1]}, target = {x:0,z:0}, path = w.path(start.x,start.z,0,0).points;
    let previous = start;
    for (const point of path) { assert.ok(w.lineFree(previous,point)); previous=point; }
    assert.ok(Math.hypot(previous.x-target.x,previous.z-target.z)<3,'a second basin exit, not a dead-end tree');
  }
});

test('Desert relief is distributed inside the world and its edges continue naturally through all corners', () => {
  const w = new Battlefield(1409, 'desert'), s = w.renderData.geometries.find(d => d.relief && !d.relief.innerExtent).relief;
  const at = (x,z) => s.heights[(Math.round((z+s.extent)/s.step)+1)*s.size+Math.round((x+s.extent)/s.step)+1];
  for (const sx of [-1,1]) for (const sz of [-1,1]) {
    let raised = 0, lows = 0, peak = 0;
    for (let x = 8; x < 68; x += 3) for (let z = 8; z < 68; z += 3) {
      const h = at(x*sx,z*sz); if (h > .18) raised++; if (h < .18) lows++;
      peak = Math.max(peak,h);
    }
    // Broad low aprons are still raised relief, not missing landforms. Check the
    // occupied area separately from tall cores, rather than requiring steep feet.
    assert.ok(raised > 30 && lows > 30, 'both landforms and usable valleys in every quadrant');
    assert.ok(peak > 10, 'retain tall interior cores, not only low bumps or an outer rim');
    assert.ok(at(87*sx,87*sz) > 10, 'corner mountains, not an exposed right-angle arena edge');
  }
  const next = new Battlefield(1410,'desert');
  assert.notDeepEqual(w.terrainFeatureGrid,next.terrainFeatureGrid);
  assert.notDeepEqual(w.layout.corridors,next.layout.corridors);
  assert.notStrictEqual(w.layout,w.definition.layout,'seed-specific routes never mutate the shared map definition');
  assert.deepEqual(w.layout.startSites,next.layout.startSites);
  assert.deepEqual(w.layout.resourceSites,next.layout.resourceSites);
});

for (const seed of [1409,2219,24080,43015,...Array.from({length:16},(_,i)=>(i+1)*7919)]) {
  test(`Desert ${seed}: all four starts, resources and vents share a body-clear canyon network`, () => {
    const w = new Battlefield(seed,'desert'), n = w.gridSize,
      sites = [...vm.runInContext('battlefieldStartSites',context)(w),...w.layout.resourceSites,
        ...w.layout.resourceSites.map((p,i)=>({x:p.x+(i?7:5),z:p.z+(i?7:18)}))],
      seen = new Uint8Array(n*n), queue = [w.idx(sites[0].x,sites[0].z)];
    seen[queue[0]] = 1;
    for (let head = 0; head < queue.length; head++) for (const i of [queue[head]-1,queue[head]+1,queue[head]-n,queue[head]+n]) {
      if (i%n<1 || i%n>=n-1 || i<n || i>=(n-1)*n || seen[i]) continue;
      if ([-n-1,-n,-n+1,-1,0,1,n-1,n,n+1].some(d=>w.staticGrid[i+d])) continue;
      seen[i]=1; queue.push(i);
    }
    for (const p of sites) {
      assert.ok(!w.blockedAt(p.x,p.z));
      assert.ok(queue.some(i=>{const q=w.point(i);return Math.hypot(q.x-p.x,q.z-p.z)<=5;}),'connected with one-cell clearance');
    }
    for (const route of w.layout.corridors) for (let i=1;i<route.length;i++)
      assert.ok(w.lineFree({x:route[i-1][0],z:route[i-1][1]},{x:route[i][0],z:route[i][1]}));
    assert.deepEqual(w.blocked,w.staticGrid); layoutHash(w);
    for (const rock of w.rocks) assert.ok(w.blockedAt(rock.x,rock.z),'every freestanding solid stone blocks its containing cell');
    const placements = w.renderData.placements;
    assert.ok(placements.every(p=>[...p.position,...p.scale,...p.rotation].every(Number.isFinite)));
    assert.equal(new Set(placements.filter(p=>['desertBoulder','desertCrag','desertRidge','desertShelf'].includes(p.mesh)).map(p=>p.mesh)).size,4);
    assert.ok(!placements.some(p=>p.mesh==='hex'||p.mesh==='plane'||p.mesh==='mountainRing'), 'no columns, drawn roads or square ring');
  });
}

function assertMapAccess(w) {
  const n=w.gridSize, sites=[w.layout.playerStart,...w.layout.enemySites.slice(0,1),...w.layout.resourceSites,
    ...w.layout.resourceSites.map((p,i)=>({x:p.x+(i?7:5),z:p.z+(i?7:18)}))];
  const seen=new Uint8Array(n*n), queue=[w.idx(sites[0].x,sites[0].z)];seen[queue[0]]=1;
  for(let head=0;head<queue.length;head++) for(const i of [queue[head]-1,queue[head]+1,queue[head]-n,queue[head]+n]) {
    if(i%n<1||i%n>=n-1||i<n||i>=(n-1)*n||seen[i])continue;
    if([-n-1,-n,-n+1,-1,0,1,n-1,n,n+1].some(d=>w.staticGrid[i+d]))continue;
    seen[i]=1;queue.push(i);
  }
  for(const p of sites) {
    assert.equal(w.blockedAt(p.x,p.z),false,'unobstructed base/resource/vent');
    assert.ok(queue.some(i=>{const q=w.point(i);return Math.hypot(q.x-p.x,q.z-p.z)<=5;}),'connected with body clearance');
  }
  if (w.surface) {
    const a=w.layout.playerStart,b=w.layout.enemySites[0];
    assert.equal(w.path(a.x,a.z,b.x,b.z).status,'complete','opposite high decks connect through ramps');
  } else assert.ok(w.lineFree(w.layout.playerStart,w.layout.enemySites[0]),'wide direct diagonal remains open');
  for(const route of w.layout.corridors) for(let i=1;i<route.length;i++)
    assert.ok(w.lineFree({x:route[i-1][0],z:route[i-1][1]},{x:route[i][0],z:route[i][1]}),'flank routes remain open');
}
for(const seed of [9017,1905,6633,4442,38744,43015]) test(`Alien Planet ${seed}: larger living terrain with protected routes and resources`,()=>{
  const w=new Battlefield(seed,'alien-planet'),p=w.renderData.placements;
  assert.deepEqual([w.extent,w.gridSize,w.cellSize],[135,108,2.5]);
  assert.equal((w.extent/BATTLEFIELDS.desert.size.extent)**2,2.25);
  assert.equal(w.definition.render.groundTexture,'bio');
  assert.equal(w.definition.render.rockDecor.opacity,0);assert.equal(w.definition.render.shrubDecor.opacity,0);
  const edge=p=>Math.max(Math.abs(p.position[0]),Math.abs(p.position[2])),
    trees=p.filter(p=>p.mesh.startsWith('alienTree')||p.mesh==='alienSapling'),
    interior=trees.filter(p=>edge(p)<135),exterior=trees.filter(p=>edge(p)>135),
    solid=[...interior,...p.filter(p=>p.mesh==='alienPod')];
  assert.ok(interior.length>=100&&interior.length<=300);assert.ok(exterior.length>=480&&exterior.length<=650);
  assert.ok(p.length>=2800&&p.length<=3500);
  assert.equal(w.rocks.length,solid.length);
  const gills=p.filter(p=>p.mesh.startsWith('alienCapGills')),understory=p.filter(p=>
    ['alienFern','alienSpore','alienGlowTuft'].includes(p.mesh));
  assert.ok(gills.length>=200&&gills.every(p=>p.glow>=2.5),'mature caps carry strongly blooming beaded lamellae');
  const pools=p.filter(p=>p.mesh==='alienLanternPool'&&p.material==='ALIEN_LIGHT');
  assert.ok(pools.length>=175&&pools.every(p=>p.alpha===.72),'inland lantern caps project translucent light onto the ground');
  assert.deepEqual(new Set(pools.map(p=>p.color)),new Set([0x6be8d1,0xd264dd]),'cyan and plum lantern pools coexist');
  assert.ok(p.filter(p=>p.mesh==='alienGlowTuft'&&p.glow>=1).length>=200,'fluorescent ground plants remain abundant');
  const planted=interior.filter(tree=>understory.filter(p=>Math.hypot(p.position[0]-tree.position[0],
    p.position[2]-tree.position[2])<tree.scale[0]*1.55).length>=3);
  assert.ok(planted.length/interior.length>.95,'understory is concentrated around inland mushroom trees');
  for(const [axis,sign] of [[0,1],[0,-1],[2,1],[2,-1]]) for(let sector=0;sector<6;sector++) {
    const lo=-135+sector*45;
    assert.ok(exterior.filter(p=>p.position[axis]*sign>=137&&p.position[2-axis]>=lo&&p.position[2-axis]<lo+45).length>=8,
      'deep exterior forest covers every section of all four sides');
  }
  assert.ok(interior.filter(p=>edge(p)>=110).length/(135**2-110**2)>
    interior.filter(p=>edge(p)<75).length/75**2,'sparser inland, denser toward the exterior');
  assert.ok(new Set(interior.map(p=>p.mesh)).size>=3,'mixed reusable plants inside and outside');
  assert.ok(exterior.every(p=>edge(p)>=137&&p.scale[0]>=3.97));
  const reconstructed=new Uint8Array(w.staticGrid.length);
  for(const plant of solid) {
    const [x,,z]=plant.position,r=plant.scale[0]*(plant.mesh==='alienPod'?1:.6),q={x,z};
    assert.ok(edge(plant)+r<=131,'solid roots stay within the playable boundary');
    assert.ok(w.rocks.some(p=>p.x===x&&p.z===z&&p.r===r));assert.ok(w.blockedAt(x,z),'solid stems');
    w.mark(reconstructed,x,z,r);
    for(const route of w.layout.corridors) for(let i=1;i<route.length;i++)
      assert.ok(pointSegment(q,{x:route[i-1][0],z:route[i-1][1]},{x:route[i][0],z:route[i][1]})>=r+7);
  }
  assert.deepEqual(Buffer.from(w.staticGrid),Buffer.from(reconstructed),'only individual root footprints block, no invisible grove mats');
  for(let i=0;i<w.staticGrid.length;i++) for(let c=0;c<3;c++) {
    const byte=new Uint8ClampedArray([w.renderData.groundColors[i*2][c]*[175,190,200][c]]);
    if(w.staticGrid[i])byte[0]*=.65;
    assert.equal(w.terrainColors[i*4+c],byte[0],'minimap marks actual solid ground');
  }
  assert.equal(p.filter(p=>p.mesh==='alienForestFloor'&&p.material==='GROUND').length,1);
  assertMapAccess(w);
  assert.ok(p.every(p=>[...p.position,...p.scale,...p.rotation].every(Number.isFinite)));
});

test('Alien layout remains accessible over 40 additional seeds and repeats its private streams exactly',()=>{
  for(let seed=1;seed<=40;seed++) {
    const w=new Battlefield(seed*7919,'alien-planet');assertMapAccess(w);
  }
  const a=new Battlefield(43015,'alien-planet'),b=new Battlefield(43015,'alien-planet'),other=new Battlefield(43016,'alien-planet');
  assert.deepEqual(a.renderData,b.renderData);assert.deepEqual(a.staticGrid,b.staticGrid);
  assert.notDeepEqual(a.renderData.placements,other.renderData.placements);
  assert.deepEqual(a.layout,other.layout,'seed variation preserves strategic anchor points');
});

test('Alien mesh factories are deterministic, finite, bounded and remain below explicit budgets',()=>{
  const w=new Battlefield(43015,'alien-planet');
  const budgets={alienForestFloor:8,alienTreePlum:500,alienTreeJade:500,alienTreeUmbrella:500,
    alienPod:2200,alienFern:100,alienSpore:350,alienGlowTuft:120,alienLanternPool:180,
    alienCapGillsPlum:2500,alienCapGillsJade:2500,alienCapGillsUmbrella:2500,alienSapling:500},triangles={};
  for(const descriptor of w.renderData.geometries) {
    const mesh=TerrainModels.geometry(descriptor);assert.equal(mesh.length%27,0);
    assert.ok(mesh.length/27>0&&mesh.length/27<=budgets[descriptor.model],`${descriptor.model}: ${mesh.length/27}`);
    assert.deepEqual(mesh,TerrainModels.geometry(descriptor));
    triangles[descriptor.mesh]=mesh.length/27;
    const floor=descriptor.model==='alienForestFloor',limit=floor?w.extent+100:4;
    if(floor) for(let i=0;i<mesh.length;i+=9) {
      assert.equal(mesh[i+1],-.13,'seamless flat extension of the soil, no bank');
      assert.equal(mesh[i+4],1);assert.ok(Math.max(Math.abs(mesh[i]),Math.abs(mesh[i+2]))>=w.extent);
    }
    for(let i=0;i<mesh.length;i+=9) {
      for(let k=0;k<9;k++)assert.ok(Number.isFinite(mesh[i+k]));
      assert.ok(Math.abs(mesh[i])<=limit&&Math.abs(mesh[i+2])<=limit);
      assert.ok(mesh[i+1]>=-8&&mesh[i+1]<=28);
      assert.ok(Math.abs(Math.hypot(mesh[i+3],mesh[i+4],mesh[i+5])-1)<1e-5);
    }
    for(let i=0;i<mesh.length;i+=27){
      const a=mesh.slice(i,i+3),b=mesh.slice(i+9,i+12),c=mesh.slice(i+18,i+21),
        u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]);
      assert.ok(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-9,'nondegenerate faces');
    }
  }
  const total=w.renderData.placements.reduce((n,p)=>n+(triangles[p.mesh]||0),0)+w.gridSize**2*2;
  assert.ok(total<=1250000,`whole planted world budget (excluding units/shadow repetition): ${total}`);
});

test('Alien exterior and understory randomness cannot relocate solid roots',()=>{
  const Builder=vm.runInContext('BattlefieldBuilder',context),original=Builder.prototype.cosmeticRandom;
  const a=new Battlefield(43015,'alien-planet');
  try {
    Builder.prototype.cosmeticRandom=()=>()=>.5;
    const b=new Battlefield(43015,'alien-planet');
    assert.deepEqual(a.staticGrid,b.staticGrid);assert.deepEqual(a.rocks,b.rocks);
    assert.deepEqual(a.terrainColors,b.terrainColors);assert.deepEqual(a.renderData.groundColors,b.renderData.groundColors);
    assert.notDeepEqual(a.renderData.placements,b.renderData.placements);
  } finally {Builder.prototype.cosmeticRandom=original;}
});

for(const seed of [43015,74408,90001]) test(`Mothership ${seed}: rounded high decks, chamfered architecture and open service lanes`,()=>{
  const w=new Battlefield(seed,'mothership'),p=w.renderData.placements;
  assert.deepEqual([w.extent,w.gridSize,w.cellSize],[120,96,2.5]);
  assert.equal(w.definition.render.groundTexture,'metal');
  assert.equal(w.definition.render.rockDecor.opacity,0);assert.equal(w.definition.render.shrubDecor.opacity,0);
  assert.equal(w.definition.worldEvent,'solarFlare');assert.equal(w.rocks.length,0);
  assert.equal(w.renderData.features.length,8);
  for(const f of w.renderData.features) {
    assert.equal(f.outline.length,8,'blockers expose their chamfered visible footprint');
    const body=p.find(p=>p.position[0]===f.x&&p.position[2]===f.z&&['shipHangar','shipPlant'].includes(p.mesh));
    assert.ok(body);assert.deepEqual(Array.from(body.scale),[f.width,f.height,f.depth]);assert.equal(body.rotation[0],f.yaw);
    assert.ok(f.outline.every(q=>Math.max(Math.abs(q.x),Math.abs(q.z))<w.extent));
    assert.ok(w.blockedAt(f.x,f.z),'doors and plant islands are solid, not fake open portals');
  }
  for(let i=0;i<w.staticGrid.length;i++) {
    const q=w.point(i),clearance=w.cellSize*Math.SQRT1_2,
      blocked=w.renderData.features.some(f=>insidePolygon(q,f.outline)||f.outline.some((a,j)=>
        pointSegment(q,a,f.outline[(j+1)%f.outline.length])<=clearance)),
      solid=+(blocked||!!w.surface.cliffs[i]);
    assert.equal(w.staticGrid[i],solid);assert.equal(w.terrainFeatureGrid[i],solid);
  }
  assertMapAccess(w);
  assert.equal(p.filter(p=>p.mesh==='shipCargoPad').length,8);assert.equal(p.filter(p=>p.mesh==='shipVentDock').length,8);
  for(const [i,site] of w.layout.resourceSites.entries()) {
    assert.ok(p.some(p=>p.mesh==='shipCargoPad'&&p.position[0]===site.x&&p.position[2]===site.z));
    assert.ok(p.some(p=>p.mesh==='shipVentDock'&&p.position[0]===site.x+(i?7:5)&&p.position[2]===site.z+(i?7:18)));
  }
  assert.equal(p.filter(p=>p.mesh==='shipTransport').length,4);assert.equal(p.filter(p=>p.mesh==='shipBridge').length,1);
  assert.equal(p.filter(p=>p.mesh==='shipHangar').length,16,'the same detailed modules continue onto all four outer arms');
  assert.ok(p.some(p=>p.mesh==='shipDeckLights'&&p.glow>1));
  assert.ok(!p.some(p=>/rock|mountain|massif|alien/.test(p.mesh)));
});

test('Mothership exterior variety is deterministic and cannot alter its strategic layout or blockers',()=>{
  const Builder=vm.runInContext('BattlefieldBuilder',context),original=Builder.prototype.cosmeticRandom;
  const a=new Battlefield(43015,'mothership'),b=new Battlefield(43015,'mothership'),other=new Battlefield(74408,'mothership');
  assert.deepEqual(a.renderData,b.renderData);assert.deepEqual(a.staticGrid,other.staticGrid);
  assert.notDeepEqual(a.renderData.placements,other.renderData.placements);
  try {
    Builder.prototype.cosmeticRandom=()=>()=>.5;
    const c=new Battlefield(43015,'mothership');
    assert.deepEqual(a.staticGrid,c.staticGrid);assert.deepEqual(a.renderData.features,c.renderData.features);
    assert.deepEqual(a.layout,c.layout);assert.notDeepEqual(a.renderData.placements,c.renderData.placements);
  } finally {Builder.prototype.cosmeticRandom=original;}
});

test('Mothership reusable architecture has finite normals, bounded meshes and a deliberate detail budget',()=>{
  const w=new Battlefield(43015,'mothership'),triangles={},budgets={shipHangar:2000,shipHangarLights:300,shipPlant:1400,
    shipCrate:350,shipTransport:700,shipTransportLights:200,shipBridge:900,shipCargoPad:350,shipVentDock:350,
    shipDeckMarks:2700,shipDeckLights:4700,shipOuterDeck:8,shipHull:6000};
  for(const d of w.renderData.geometries) {
    const mesh=TerrainModels.geometry(d);assert.equal(mesh.length%27,0);
    triangles[d.mesh]=mesh.length/27;assert.ok(triangles[d.mesh]>0&&triangles[d.mesh]<=budgets[d.model],d.model);
    assert.deepEqual(mesh,TerrainModels.geometry(d));
    const large=['shipOuterDeck','shipHull','shipDeckMarks','shipDeckLights'].includes(d.model),
      pad=['shipCargoPad','shipVentDock'].includes(d.model);
    if(['shipDeckMarks','shipDeckLights'].includes(d.model)) assert.equal(d.grounded,true);
    for(let i=0;i<mesh.length;i+=9) {
      for(let j=0;j<9;j++)assert.ok(Number.isFinite(mesh[i+j]));
      assert.ok(Math.abs(Math.hypot(...mesh.slice(i+3,i+6))-1)<1e-6);
      assert.ok(Math.abs(mesh[i])<=(large?210:pad?6.1:1.2));assert.ok(Math.abs(mesh[i+2])<=(large?230:pad?6:1.2));
      assert.ok(mesh[i+1]>=(large?-17:-.1)&&mesh[i+1]<=(large?.5:1.65));
      if(d.model==='shipOuterDeck') {assert.equal(mesh[i+1],-.13);assert.equal(mesh[i+4],1);}
    }
    for(let i=0;i<mesh.length;i+=27) {
      const a=mesh.slice(i,i+3),u=mesh.slice(i+9,i+12).map((v,j)=>v-a[j]),v=mesh.slice(i+18,i+21).map((v,j)=>v-a[j]);
      assert.ok(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-10,'nondegenerate architecture');
    }
  }
  const floorTriangles=(w.surface.size-1)**2*2,
    total=w.renderData.placements.reduce((n,p)=>n+(triangles[p.mesh]||0),0)+floorTriangles;
  assert.ok(total<165000,`detailed carrier budget excluding entities/shadow repetition: ${total}`);
});

test('navigation follows canyon bends instead of crossing the relief', () => {
  const w = new Battlefield(43015, 'desert'), sites = [...w.layout.startSites, ...w.layout.resourceSites];
  let detours = 0;
  for (const start of w.layout.startSites) for (const target of sites) {
    const path = w.path(start.x, start.z, target.x, target.z).points;
    let previous = start;
    for (const point of path) { assert.ok(w.lineFree(previous, point)); previous = point; }
    assert.ok(Math.hypot(previous.x - target.x, previous.z - target.z) < 3);
    if (!w.lineFree(start, target)) { assert.ok(path.length > 1); detours++; }
  }
  assert.ok(detours >= 8, 'new landforms meaningfully shape routes, not just their appearance');
});

test('map recipes and new cosmetic streams are isolated without shifting existing terrain samples', () => {
  const local = loadScripts(['core', ...BATTLEFIELD_SCRIPTS, 'world']);
  const { Battlefield: World, BATTLEFIELDS: maps } = vm.runInContext('({Battlefield, BATTLEFIELDS})', local);
  const snapshot = id => {
    const w = new World(1409, id);
    return JSON.stringify([w.renderData, Array.from(w.staticGrid), Array.from(w.terrainColors)]);
  };
  const before = Object.fromEntries(Object.keys(maps).map(id => [id, snapshot(id)]));
  const generate = maps.desert.generate;
  maps.desert.generate = builder => {
    const cosmetic = builder.cosmeticRandom(0x4445434f), repeated = builder.cosmeticRandom(0x4445434f);
    for (let i = 0; i < 1000; i++) assert.equal(cosmetic(), repeated());
    generate(builder);
  };
  assert.equal(snapshot('desert'), before.desert, 'private cosmetic samples do not consume layout RNG');
  maps.desert.palette.rock = 0xff0000;
  assert.notEqual(snapshot('desert'), before.desert);
  assert.equal(snapshot('alien-planet'), before['alien-planet']);
  assert.equal(snapshot('mothership'), before.mothership);
});

test('terrain feature validation accepts non-mountain polygons and rasterizes their corners', () => {
  const local = loadScripts(['core', ...BATTLEFIELD_SCRIPTS, 'world']);
  const { Battlefield: World, BattlefieldBuilder: Builder } = vm.runInContext('({Battlefield, BattlefieldBuilder})', local);
  const w = new World(1409, 'desert');
  w.staticGrid.fill(0); w.terrainFeatureGrid.fill(0);
  const builder = new Builder(w);
  const polygon = { x: 0, z: 0, width: 12, depth: 12, height: 10, yaw: 0, seed: 5,
    outline: [{x:-12,z:-12}, {x:12,z:-12}, {x:12,z:12}, {x:-12,z:12}] };
  builder.features(() => polygon, 'testHangar', 'METAL');
  assert.equal(w.renderData.features.length, 1, 'overlapping candidates are rejected');
  assert.equal(w.renderData.geometries[0].model, 'testHangar');
  assert.equal(w.renderData.placements[0].material, 'METAL');
  assert.equal(w.terrainFeatureGrid[w.idx(11, 11)], 1, 'no mountain-radius shortcut cuts off polygon corners');
  for (let i = 0; i < w.staticGrid.length; i++) {
    const p = w.point(i), expected = insidePolygon(p, polygon.outline) || polygon.outline.some((a,j) =>
      pointSegment(p, a, polygon.outline[(j+1)%4]) < 2.5*Math.SQRT1_2);
    assert.equal(w.staticGrid[i], +expected);
  }
});

test('regenerating a battle seed reproduces all visual placements', () => {
  const first = new Battlefield(123456, 'desert'), second = new Battlefield(123456, 'desert');
  assert.equal(layoutHash(first), layoutHash(second));
  assert.deepEqual(first.renderData, second.renderData);
  assert.deepEqual(first.terrainFeatureGrid, second.terrainFeatureGrid);
});
