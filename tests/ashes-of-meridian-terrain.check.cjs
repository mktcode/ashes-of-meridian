// Run without build/browser: node --max-old-space-size=128 --test --test-concurrency=1 tests/ashes-of-meridian-terrain.check.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { BATTLEFIELD_SCRIPTS, readScripts, loadScripts } = require('./helpers/game-scripts.cjs');

const scripts = readScripts();
const context = loadScripts(['core', 'renderer-assets', 'renderer-geometry', 'renderer-terrain-models', 'renderer-alien-terrain', 'renderer-mothership-terrain', 'content', ...BATTLEFIELD_SCRIPTS, 'world'], { scripts });
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

test('larger worlds navigate, rebuild blockers and reveal both teams beyond the old edges', () => {
  const definition=BATTLEFIELDS['alien-planet'], original=definition.size;
  try {
    definition.size={extent:135,cellSize:2.5};
    const w=new Battlefield(43015,'alien-planet'); w.staticGrid.fill(0); w.rebuild([]);
    assert.equal(w.blockedAt(120,110),false); assert.equal(w.blockedAt(133,0),true);
    assert.deepEqual(JSON.parse(JSON.stringify(w.nearest(999,-999))),{x:131,z:-131});
    assert.deepEqual(JSON.parse(JSON.stringify(w.path(0,0,999,-999,true))),[{x:130,z:-130}]);
    w.rebuild([{hp:100,kind:'building',x:110,z:110,size:5}]);
    const start={x:95,z:110}, end={x:125,z:110}, path=w.path(start.x,start.z,end.x,end.z);
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
    const path=w.path(start.x,start.z,end.x,end.z);
    assert.ok(path.length>50); assert.deepEqual(JSON.parse(JSON.stringify(path.at(-1))),end);
    let anchor=start;
    for (const p of path) { assert.ok(w.lineFree(anchor,p)); anchor=p; }
  } finally { definition.size=original; }
});

test('boundary mesh follows a larger extent without scaling terrain height or producing invalid faces', () => {
  const mesh=TerrainModels.mountainRing(43015,135);
  let max=0;
  for (let i=0;i<mesh.length;i+=9) {
    const edge=Math.max(Math.abs(mesh[i]),Math.abs(mesh[i+2]));
    assert.ok(edge>=132-1e-8); max=Math.max(max,edge);
    for (let k=0;k<9;k++) assert.ok(Number.isFinite(mesh[i+k]));
    assert.ok(Math.abs(Math.hypot(mesh[i+3],mesh[i+4],mesh[i+5])-1)<1e-6);
  }
  assert.equal(max,168);
});

test('embedded skybox preserves the canonical WebP bytes and is wired as a non-repeating texture', () => {
  const url = vm.runInContext('MERIDIAN_TEXTURES.sky', context);
  assert.match(url, /^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/);
  const payload = url.split(',')[1], image = Buffer.from(payload, 'base64');
  assert.equal(image.toString('base64'), payload);
  assert.deepEqual(image, readFileSync(join(__dirname, '../assets/textures/skybox.webp')));
  assert.equal(image.toString('ascii', 0, 4), 'RIFF');
  assert.equal(image.toString('ascii', 8, 12), 'WEBP');
  assert.ok(scripts.find(s => s.name === 'renderer-runtime').source.includes(
    'this.loadTexture(this.skyTex, MERIDIAN_TEXTURES.sky, false);'
  ));
});

test('embedded ground textures preserve the canonical WebP bytes without conversion', () => {
  for (const [key, file] of Object.entries({
    ground: 'texture-ground-dirt-base.webp',
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
  assert.equal(vm.runInContext("'terrainOverlay' in MERIDIAN_TEXTURES", context), false);
  assert.ok(scripts.find(s => s.name === 'renderer-runtime').source.includes(
    'this.loadTexture(this.groundTex, MERIDIAN_TEXTURES.ground);'
  ));
});

test('embedded material textures preserve the canonical WebP bytes without conversion', () => {
  for (const [key, file] of Object.entries({
    metal: 'texture-floor-mothership.webp',
    bio: 'texture-floor-alien-planet.webp'
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

function layoutHash(w) {
  const originalGrid = new Uint8Array(w.staticGrid.length);
  for (const rock of w.rocks) w.mark(originalGrid, rock.x, rock.z, rock.r);
  for (let i = 0; i < originalGrid.length; i++)
    assert.equal(w.staticGrid[i], originalGrid[i] | w.terrainFeatureGrid[i], 'only massif footprints add blockers');
  return createHash('sha256').update(originalGrid).update(w.terrainColors)
    .update(JSON.stringify(w.rocks)).digest('hex');
}

// Original small-rock layout/colors remain fixed; large massif footprints are an intentional addition.
const originalLayouts = {
  1409: 'e008f2827368d27fda1bbbd04e3a8002f751ccd797edd7858becbd5f68419ce6',
  7012: 'c412c4ca92c24b7f53758ae1ada2974b7789ee240c88d6259729b7cc4155058a',
  2219: '6481a6efd6af94048a5401f63d89c0aa3b00be9aa796cb63df477985a74b8818',
  1144: 'b8f035efd8e8be2e6cf71e93017ed948a582d2d2d460e7fa3b88f022858e8040',
  8141: '43b394c16cdb8b0699964394572f391828f5ff426f28c1e424fc8a06e2b0b902',
  9897: '7a53e344e8d1fbea4f16999d5e39a6e3c27bd673ac5bb6fbb98e1d913e66bb48',
  11007: '40a49b63ddd50aa35023fde1f1e0439d9a567f266956a70267f222bd60942171',
  24080: '5afb1bf9af3ad0851b6c512f29cac192ffa863b176217fdad3d547f42123815c',
};

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

test('wide massif mesh is detailed, deterministic and matches its CPU footprint', () => {
  const world = new Battlefield(43015, 'desert'), m = world.renderData.features[0],
    mesh = TerrainModels.massif(m), before = JSON.stringify(m);
  assert.deepEqual(mesh, TerrainModels.massif(m));
  assert.notDeepEqual(mesh, TerrainModels.massif({ ...m, seed: m.seed ^ 1 }));
  assert.equal(JSON.stringify(m), before);
  assert.equal(mesh.length / 27, 11712);
  // Exhaustive raster/outline agreement once; all 11 layouts retain fixed navigation references.
  for (let i = 0; i < world.terrainFeatureGrid.length; i++) {
    const p = world.point(i), covered = world.renderData.features.some(m => insidePolygon(p, m.outline) ||
      m.outline.some((a, j) => pointSegment(p, a, m.outline[(j + 1) % m.outline.length]) < 2.5 * Math.SQRT1_2));
    assert.equal(world.terrainFeatureGrid[i], +covered, 'raster follows irregular outlines, not bounding circles');
  }
  let high = 0;
  for (let i = 0; i < mesh.length; i += 9) {
    assert.ok(mesh.slice(i, i + 9).every(Number.isFinite));
    assert.ok(mesh[i + 1] >= -.3 && mesh[i + 1] <= m.height * 1.3);
    assert.ok(world.blockedAt(mesh[i], mesh[i + 2]), 'no visible mountain slope over walkable cells');
    assert.ok(Math.abs(Math.hypot(...mesh.slice(i + 3, i + 6)) - 1) < 1e-9);
    high = Math.max(high, mesh[i + 1]);
  }
  assert.ok(high > m.height * .8);
  const vertices = new Set();
  for (let i = 0; i < mesh.length; i += 9) vertices.add(`${mesh[i]},${mesh[i + 1]},${mesh[i + 2]}`);
  for (const p of m.outline) assert.ok(vertices.has(`${p.x},-0.14,${p.z}`), 'continuous exact ground-level perimeter');
});

test('mountain belt is seeded, continuous and outside the playable ground', () => {
  const mesh = TerrainModels.mountainRing(43015, 90), edges = new Map(), surfaceTriangles = 384 * 40 * 2;
  assert.deepEqual(mesh, TerrainModels.mountainRing(43015, 90));
  assert.notDeepEqual(mesh, TerrainModels.mountainRing(43016, 90));
  assert.equal(mesh.length / 27, surfaceTriangles + 80 * 72);
  assert.ok(mesh.length / 27 <= 40000, 'bounded detail budget for the entire belt including scree');
  let peak = 0;
  for (let i = 0; i < mesh.length; i += 27) {
    const vertices = [0, 9, 18].map(k => mesh.slice(i + k, i + k + 3));
    assert.ok([0, 2].some(axis => [-1, 1].some(sign => vertices.every(v => sign * v[axis] >= 87))),
      'whole triangles stay outside playable ground, including square corners and scree');
    for (let j = 0; j < 3; j++) {
      const [x, y, z] = vertices[j]; peak = Math.max(peak, y);
      assert.ok([x, y, z].every(Number.isFinite));
      assert.ok(Math.max(Math.abs(x), Math.abs(z)) >= 87, 'no mountain vertex in walkable ground');
      assert.ok(Math.max(Math.abs(x), Math.abs(z)) <= 123);
      const normal = mesh.slice(i + j * 9 + 3, i + j * 9 + 6);
      assert.ok(Math.abs(Math.hypot(...normal) - 1) < 1e-9);
      if (i < surfaceTriangles * 27) {
        assert.ok(normal[1] > 0, 'non-degenerate, upward-facing heightfield facets');
        const pair = [vertices[j], vertices[(j + 1) % 3]].map(v => JSON.stringify(v)).sort(),
          key = pair.join('|');
        edges.set(key, (edges.get(key) || 0) + 1);
      }
    }
  }
  assert.ok(peak > 40 && peak <= 52);
  const boundary = [...edges].filter(([, count]) => count === 1);
  assert.equal(boundary.length, 768, 'only the inner and outer perimeter are open');
  for (const [edge, count] of edges) {
    assert.ok(count <= 2);
    if (count === 1) {
      const [a, b] = edge.split('|').map(v => JSON.parse(v));
      assert.ok(a[1] === b[1] && [-.25, -8].includes(a[1]), 'no cracks or side seams');
    }
  }
});

// Desert keeps its original digests; redesigned maps use independent geometric/access checks.
const terrainCases = [[1409,'desert'],[2219,'desert'],[24080,'desert']];
for (const [seed, map] of terrainCases) {
  test(`terrain ${seed} (${map}): original layout and varied textured rocks`, () => {
    const battlefield = new Battlefield(seed, map), placements = battlefield.renderData.placements;
    assert.equal(layoutHash(battlefield), originalLayouts[seed]);
    assert.deepEqual(battlefield.blocked, battlefield.staticGrid);
    const belts = placements.filter(p => p.mesh === 'mountainRing');
    assert.equal(belts.length, 1);
    assert.equal(belts[0].material, 'MASSIF', 'boundary uses the same unstriped rock material as interior massifs');
    for (const rock of battlefield.rocks) {
      assert.ok(battlefield.blockedAt(rock.x, rock.z), 'interior formations are real blockers');
    }
    const massifs = battlefield.renderData.features;
    assert.equal(massifs.length, 2, 'two suitable broad landforms in each reference world');
    for (const m of massifs) {
      assert.ok(m.width >= 29 && m.width <= 38 && m.depth >= 17 && m.depth <= 23);
      assert.ok(m.height >= 20 && m.height <= 27);
      assert.equal(m.outline.length, 96);
      assert.ok(m.outline.every(p => Math.max(Math.abs(p.x), Math.abs(p.z)) <= 81));
    }
    const { playerStart, enemySites, resourceSites } = battlefield.layout;
    const reserved = [{ ...playerStart, r: 20 }, { ...enemySites[0], r: 21 },
      ...resourceSites.map(p => ({ ...p, r: 10 })),
      ...resourceSites.map((p, i) => ({ x: p.x + (i ? 7 : 5), z: p.z + (i ? 7 : 18), r: 7 }))];
    for (const p of reserved) for (const m of massifs) {
      assert.ok(!insidePolygon(p, m.outline));
      assert.ok(m.outline.every((a, i) => pointSegment(p, a, m.outline[(i + 1) % 96]) >= p.r));
    }
    // Independent flood fill with a one-cell clearance margin around every obstacle.
    const seen = new Set([battlefield.idx(playerStart.x, playerStart.z)]), queue = [...seen];
    for (let h = 0; h < queue.length; h++) for (const j of [queue[h] - 1, queue[h] + 1, queue[h] - 72, queue[h] + 72]) {
      if (j % 72 < 1 || j % 72 > 70 || j < 72 || j >= 71 * 72 || seen.has(j)) continue;
      if ([-73, -72, -71, -1, 0, 1, 71, 72, 73].some(d => battlefield.staticGrid[j + d])) continue;
      seen.add(j); queue.push(j);
    }
    for (const p of reserved) assert.ok(queue.some(i => {
      const q = battlefield.point(i); return Math.hypot(q.x - p.x, q.z - p.z) <= 5;
    }), 'bases and all resource approaches remain connected with clearance');
    assert.equal(placements.filter(p => p.mesh.startsWith('massif') && p.material === 'MASSIF').length, 2);
    const rocks = placements.filter(p => p.mesh.startsWith('rock'));
    assert.equal(new Set(rocks.map(p => p.mesh)).size, 4);
    assert.ok(rocks.every(p => p.layer === 'static' && p.material === 'ROCK'));
    assert.ok(!placements.some(p => p.mesh === 'hex'), 'no hexagonal terrain columns');
    assert.ok(!battlefield.renderData.placements.some(p => p.mesh === 'plane'),
      'no road surfaces, edge strips or dashed center markings');
    assert.ok(placements.every(p => [...p.position, ...p.scale].every(Number.isFinite)));
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
  assert.ok(w.lineFree(w.layout.playerStart,w.layout.enemySites[0]),'wide direct diagonal remains open');
  for(const route of w.layout.corridors) for(let i=1;i<route.length;i++)
    assert.ok(w.lineFree({x:route[i-1][0],z:route[i-1][1]},{x:route[i][0],z:route[i][1]}),'flank routes remain open');
}
for(const seed of [9017,1905,6633,4442,38744,43015]) test(`Alien Planet ${seed}: larger living terrain with protected routes and resources`,()=>{
  const w=new Battlefield(seed,'alien-planet'),p=w.renderData.placements;
  assert.deepEqual([w.extent,w.gridSize,w.cellSize],[135,108,2.5]);
  assert.equal((w.extent/BATTLEFIELDS.desert.size.extent)**2,2.25);
  assert.equal(w.definition.render.groundTexture,'bio');assert.equal(w.definition.render.groundMirror,true);
  assert.equal(w.definition.render.rockDecor.opacity,0);assert.equal(w.definition.render.shrubDecor.opacity,0);
  const edge=p=>Math.max(Math.abs(p.position[0]),Math.abs(p.position[2])),
    trees=p.filter(p=>p.mesh.startsWith('alienTree')||p.mesh==='alienSapling'),
    interior=trees.filter(p=>edge(p)<135),exterior=trees.filter(p=>edge(p)>135),
    solid=[...interior,...p.filter(p=>p.mesh==='alienPod')];
  assert.ok(interior.length>=100&&interior.length<=300);assert.ok(exterior.length>=480&&exterior.length<=650);
  assert.ok(p.length>=1800&&p.length<=3200);
  assert.equal(w.rocks.length,solid.length);
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
    alienPod:2200,alienFern:100,alienSpore:350,alienSapling:500},triangles={};
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
  assert.ok(total<=550000,`whole planted world budget (excluding units/shadow repetition): ${total}`);
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

for(const seed of [43015,74408,90001]) test(`Mothership ${seed}: closed architecture with open deck, flanks and resource docks`,()=>{
  const w=new Battlefield(seed,'mothership'),p=w.renderData.placements;
  assert.deepEqual([w.extent,w.gridSize,w.cellSize],[90,72,2.5]);
  assert.equal(w.definition.render.groundTexture,'metal');assert.equal(w.definition.render.groundMirror,true);
  assert.equal(w.definition.render.rockDecor.opacity,0);assert.equal(w.definition.render.shrubDecor.opacity,0);
  assert.equal(w.definition.worldEvent,'solarFlare');assert.equal(w.rocks.length,0);
  assert.equal(w.renderData.features.length,6);
  for(const f of w.renderData.features) {
    assert.equal(f.outline.length,4);
    const body=p.find(p=>p.position[0]===f.x&&p.position[2]===f.z&&['shipHangar','shipPlant'].includes(p.mesh));
    assert.ok(body);assert.deepEqual(Array.from(body.scale),[f.width,f.height,f.depth]);assert.equal(body.rotation[0],f.yaw);
    assert.ok(f.outline.every(q=>Math.max(Math.abs(q.x),Math.abs(q.z))<83));
    assert.ok(w.blockedAt(f.x,f.z),'doors and plant islands are solid, not fake open portals');
  }
  for(let i=0;i<w.staticGrid.length;i++) {
    const q=w.point(i),pad=w.cellSize*.5;
    const blocked=w.renderData.features.some(f=>q.x>=Math.min(...f.outline.map(p=>p.x))-pad&&q.x<=Math.max(...f.outline.map(p=>p.x))+pad&&
      q.z>=Math.min(...f.outline.map(p=>p.z))-pad&&q.z<=Math.max(...f.outline.map(p=>p.z))+pad);
    assert.equal(w.staticGrid[i],+blocked);assert.equal(w.terrainFeatureGrid[i],+blocked);
  }
  assertMapAccess(w);
  assert.equal(p.filter(p=>p.mesh==='shipCargoPad').length,8);assert.equal(p.filter(p=>p.mesh==='shipVentDock').length,8);
  for(const [i,site] of w.layout.resourceSites.entries()) {
    assert.ok(p.some(p=>p.mesh==='shipCargoPad'&&p.position[0]===site.x&&p.position[2]===site.z));
    assert.ok(p.some(p=>p.mesh==='shipVentDock'&&p.position[0]===site.x+(i?7:5)&&p.position[2]===site.z+(i?7:18)));
  }
  assert.equal(p.filter(p=>p.mesh==='shipTransport').length,2);assert.equal(p.filter(p=>p.mesh==='shipBridge').length,1);
  assert.equal(p.filter(p=>p.mesh==='shipHangar').length,12,'same modules continue outside the playable deck');
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

test('Mothership reusable architecture has finite normals, bounded meshes and a modest instanced budget',()=>{
  const w=new Battlefield(43015,'mothership'),triangles={},budgets={shipHangar:900,shipHangarLights:100,shipPlant:600,
    shipCrate:300,shipTransport:600,shipTransportLights:150,shipBridge:600,shipCargoPad:300,shipVentDock:150,
    shipOuterDeck:8,shipHull:3500,shipDeckPaint:3500};
  for(const d of w.renderData.geometries) {
    const mesh=TerrainModels.geometry(d);assert.equal(mesh.length%27,0);
    triangles[d.mesh]=mesh.length/27;assert.ok(triangles[d.mesh]>0&&triangles[d.mesh]<=budgets[d.model],d.model);
    assert.deepEqual(mesh,TerrainModels.geometry(d));
    const large=['shipOuterDeck','shipHull','shipDeckPaint'].includes(d.model),pad=['shipCargoPad','shipVentDock'].includes(d.model);
    for(let i=0;i<mesh.length;i+=9) {
      for(let j=0;j<9;j++)assert.ok(Number.isFinite(mesh[i+j]));
      assert.ok(Math.abs(Math.hypot(...mesh.slice(i+3,i+6))-1)<1e-6);
      assert.ok(Math.abs(mesh[i])<=(large?190:pad?6.1:1.1));assert.ok(Math.abs(mesh[i+2])<=(large?220:pad?6:1.1));
      assert.ok(mesh[i+1]>=(large?-17:-.1)&&mesh[i+1]<=1.4);
      if(d.model==='shipOuterDeck') {assert.equal(mesh[i+1],-.13);assert.equal(mesh[i+4],1);}
    }
    for(let i=0;i<mesh.length;i+=27) {
      const a=mesh.slice(i,i+3),u=mesh.slice(i+9,i+12).map((v,j)=>v-a[j]),v=mesh.slice(i+18,i+21).map((v,j)=>v-a[j]);
      assert.ok(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-10,'nondegenerate architecture');
    }
  }
  assert.ok(w.renderData.placements.reduce((n,p)=>n+(triangles[p.mesh]||0),0)+w.gridSize**2*2<60000);
});

test('navigation goes around a broad massif instead of crossing its slopes', () => {
  const w = new Battlefield(43015, 'desert'), m = w.renderData.features[0],
    dx = Math.sin(m.yaw) * (m.depth + 8), dz = Math.cos(m.yaw) * (m.depth + 8),
    start = { x: m.x - dx, z: m.z - dz }, target = { x: m.x + dx, z: m.z + dz };
  assert.ok(!w.blockedAt(start.x, start.z) && !w.blockedAt(target.x, target.z));
  assert.ok(!w.lineFree(start, target));
  const path = w.path(start.x, start.z, target.x, target.z);
  assert.ok(path.length > 1);
  let previous = start;
  for (const point of path) { assert.ok(w.lineFree(previous, point)); previous = point; }
  assert.ok(Math.hypot(previous.x - target.x, previous.z - target.z) < 3);
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
