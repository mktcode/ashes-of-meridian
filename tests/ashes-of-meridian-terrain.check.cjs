// Run without build/browser: node --max-old-space-size=128 --test --test-concurrency=1 tests/ashes-of-meridian-terrain.check.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { readScripts, loadScripts } = require('./helpers/game-scripts.cjs');

const scripts = readScripts();
const context = loadScripts(['core', 'renderer-assets', 'renderer-geometry', 'content', 'world'], { scripts });
const { geom, Battlefield, insidePolygon, pointSegment, HOME, ENEMY_SITES, RESOURCE_SITES } =
  vm.runInContext('({geom, Battlefield, insidePolygon, pointSegment, HOME, ENEMY_SITES, RESOURCE_SITES})', context);

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
    metal: 'texture-floor-metal.webp',
    bio: 'texture-floor-bio.webp'
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
    assert.equal(w.staticGrid[i], originalGrid[i] | w.massifGrid[i], 'only massif footprints add blockers');
  return createHash('sha256').update(originalGrid).update(w.terrainColors)
    .update(JSON.stringify(w.rocks)).digest('hex');
}

// Original small-rock layout/colors remain fixed; large massif footprints are an intentional addition.
const originalLayouts = {
  1409: 'e008f2827368d27fda1bbbd04e3a8002f751ccd797edd7858becbd5f68419ce6',
  7012: 'c412c4ca92c24b7f53758ae1ada2974b7789ee240c88d6259729b7cc4155058a',
  9017: 'ee6cdab2e6cfc5b2f823c2e087cbe0ea86cea8da4d7a316c1306c3c3e7eedd9b',
  1905: '93e0e9dbf23c432e6d5f1097c227f5609d3af614648af4ea5cf723a653a117da',
  2219: '6481a6efd6af94048a5401f63d89c0aa3b00be9aa796cb63df477985a74b8818',
  6633: '652ac00dd426772122f7e590331c35d1469e6461ea19fa3a227e23ded01645b1',
  1144: 'b8f035efd8e8be2e6cf71e93017ed948a582d2d2d460e7fa3b88f022858e8040',
  4442: '55e5916aaec4307167d13169bd786a9d6ee5118100b297173bc7111d495ca287',
  8141: '43b394c16cdb8b0699964394572f391828f5ff426f28c1e424fc8a06e2b0b902',
  9897: '7a53e344e8d1fbea4f16999d5e39a6e3c27bd673ac5bb6fbb98e1d913e66bb48',
  11007: '40a49b63ddd50aa35023fde1f1e0439d9a567f266956a70267f222bd60942171',
  24080: '5afb1bf9af3ad0851b6c512f29cac192ffa863b176217fdad3d547f42123815c',
  38744: '8d4ccde2f441981ca7e40e79e3021279ed87f860ebfb050ba81eb83723c4d80a',
  43015: 'e07ff802b2668fbd173ed1ce465d1136adb9a09f05149b5e2c915bccd6f9cac6',
  74408: '8b53d0c255a50ab3d344919f919c7f860517e8e1be50d747d98d18bccb0d88cf',
  90001: '765c115f340f522ad28aa67e996f2ccb8bb07b7012c443cb51ecafb13989792c',
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
  const world = new Battlefield(43015, 'rust'), m = world.renderData.massifs[0],
    mesh = geom.massif(m), before = JSON.stringify(m);
  assert.deepEqual(mesh, geom.massif(m));
  assert.notDeepEqual(mesh, geom.massif({ ...m, seed: m.seed ^ 1 }));
  assert.equal(JSON.stringify(m), before);
  assert.equal(mesh.length / 27, 11712);
  // Exhaustive raster/outline agreement once; all 16 layouts retain fixed navigation references.
  for (let i = 0; i < world.massifGrid.length; i++) {
    const p = world.point(i), covered = world.renderData.massifs.some(m => insidePolygon(p, m.outline) ||
      m.outline.some((a, j) => pointSegment(p, a, m.outline[(j + 1) % m.outline.length]) < 2.5 * Math.SQRT1_2));
    assert.equal(world.massifGrid[i], +covered, 'raster follows irregular outlines, not bounding circles');
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
  const mesh = geom.mountainRing(43015), edges = new Map(), surfaceTriangles = 384 * 40 * 2;
  assert.deepEqual(mesh, geom.mountainRing(43015));
  assert.notDeepEqual(mesh, geom.mountainRing(43016));
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

// Fixed terrain inputs cover every biome.
const terrainCases = [[1409,'rust'],[7012,'ash'],[9017,'choir'],[1905,'choir'],[2219,'rust'],[6633,'choir'],[1144,'court'],[4442,'choir'],[8141,'court'],[9897,'court'],[11007,'ash'],[24080,'rust'],[38744,'choir'],[43015,'star'],[74408,'star'],[90001,'star']];
for (const [seed, biome] of terrainCases) {
  test(`terrain ${seed} (${biome}): original layout and varied textured rocks`, () => {
    const battlefield = new Battlefield(seed, biome), placements = battlefield.renderData.placements;
    assert.equal(layoutHash(battlefield), originalLayouts[seed]);
    assert.deepEqual(battlefield.blocked, battlefield.staticGrid);
    const belts = placements.filter(p => p.mesh === 'mountainRing');
    assert.equal(belts.length, 1);
    assert.equal(belts[0].material, 'MASSIF', 'boundary uses the same unstriped rock material as interior massifs');
    for (const rock of battlefield.rocks) {
      assert.ok(battlefield.blockedAt(rock.x, rock.z), 'interior formations are real blockers');
    }
    const massifs = battlefield.renderData.massifs;
    assert.equal(massifs.length, 2, 'two suitable broad landforms in each reference world');
    for (const m of massifs) {
      assert.ok(m.width >= 29 && m.width <= 38 && m.depth >= 17 && m.depth <= 23);
      assert.ok(m.height >= 20 && m.height <= 27);
      assert.equal(m.outline.length, 96);
      assert.ok(m.outline.every(p => Math.max(Math.abs(p.x), Math.abs(p.z)) <= 81));
    }
    const reserved = [{ ...HOME, r: 20 }, { ...ENEMY_SITES[0], r: 21 },
      ...RESOURCE_SITES.map(p => ({ ...p, r: 10 })),
      ...RESOURCE_SITES.map((p, i) => ({ x: p.x + (i ? 7 : 5), z: p.z + (i ? 7 : 18), r: 7 }))];
    for (const p of reserved) for (const m of massifs) {
      assert.ok(!insidePolygon(p, m.outline));
      assert.ok(m.outline.every((a, i) => pointSegment(p, a, m.outline[(i + 1) % 96]) >= p.r));
    }
    // Independent flood fill with a one-cell clearance margin around every obstacle.
    const seen = new Set([battlefield.idx(HOME.x, HOME.z)]), queue = [...seen];
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

test('navigation goes around a broad massif instead of crossing its slopes', () => {
  const w = new Battlefield(43015, 'rust'), m = w.renderData.massifs[0],
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

test('regenerating a battle seed reproduces all visual placements', () => {
  const first = new Battlefield(123456, 'ash'), second = new Battlefield(123456, 'ash');
  assert.equal(layoutHash(first), layoutHash(second));
  assert.deepEqual(first.renderData, second.renderData);
  assert.deepEqual(first.massifGrid, second.massifGrid);
});
