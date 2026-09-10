// Run without build/browser: node --max-old-space-size=128 --test --test-concurrency=1 tests/ashes-of-meridian-terrain.check.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const vm = require('node:vm');
const { readScripts, loadScripts } = require('./helpers/game-scripts.cjs');
const { createRendererStub } = require('./helpers/renderer-stub.cjs');

const scripts = readScripts();
const context = loadScripts(['core', 'renderer', 'content', 'world'], { scripts });
const { geom, Battlefield, CAMPAIGN, MAT } = vm.runInContext('({geom, Battlefield, CAMPAIGN, MAT})', context);

function world(seed, biome) {
  const renderer = createRendererStub({ record: true });
  return { battlefield: new Battlefield(renderer, seed, biome), calls: renderer.calls };
}
function layoutHash(w) {
  return createHash('sha256').update(w.staticGrid).update(w.terrainColors)
    .update(JSON.stringify(w.rocks)).digest('hex');
}

// Captured before the visual terrain change. Protect save-game navigation and obstacle footprints.
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

for (const { seed, biome } of CAMPAIGN) {
  test(`campaign ${seed} (${biome}): original layout and varied textured rocks`, () => {
    const { battlefield, calls } = world(seed, biome);
    assert.equal(layoutHash(battlefield), originalLayouts[seed]);
    assert.deepEqual(battlefield.blocked, battlefield.staticGrid);
    const rocks = calls.filter(c => c[0].startsWith('rock'));
    assert.equal(new Set(rocks.map(c => c[0])).size, 4);
    assert.ok(rocks.every(c => c[13] === 'static' && c[14] === MAT.ROCK));
    assert.ok(!calls.some(c => c[0] === 'hex'), 'no hexagonal terrain columns');
    assert.ok(calls.every(c => c.slice(1, 7).every(Number.isFinite)));
  });
}

test('regenerating a skirmish seed reproduces all visual placements', () => {
  const first = world(123456, 'ash'), second = world(123456, 'ash');
  assert.equal(layoutHash(first.battlefield), layoutHash(second.battlefield));
  assert.deepEqual(first.calls, second.calls);
});
