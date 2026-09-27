const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts } = require('./helpers/game-scripts.cjs');

test('Aurelion study generates finite bounded scenery without browser, game or ambient RNG', () => {
  const context = loadScripts(['core','renderer-geometry','renderer-model-kit','renderer-aurelion-geometry']);
  vm.runInContext('Math.random = () => { throw Error("ambient RNG used"); }', context);
  const meshes = vm.runInContext('createAurelionGeometry()', context);
  assert.equal(meshes.length, 3);
  assert.equal(new Set(meshes.map(mesh => mesh.name)).size, meshes.length);
  let triangles = 0;
  for (const mesh of meshes) {
    const data = mesh.data;
    assert.ok(data.length > 0 && data.length % 27 === 0);
    triangles += data.length / 27;
    for (let i = 0; i < data.length; i += 9) {
      for (let k = 0; k < 9; k++) assert.ok(Number.isFinite(data[i+k]));
      assert.ok(Math.abs(data[i]) <= 800 && Math.abs(data[i+2]) <= 800);
      assert.ok(data[i+1] >= -157 && data[i+1] < 120);
      assert.ok(Math.abs(Math.hypot(data[i+3],data[i+4],data[i+5])-1) < 1e-5);
      for (let k = 6; k < 9; k++) assert.ok(data[i+k] >= 0 && data[i+k] <= 1);
    }
    for (let i = 0; i < data.length; i += 27) {
      const ax = data[i+9]-data[i], ay = data[i+10]-data[i+1], az = data[i+11]-data[i+2],
        bx = data[i+18]-data[i], by = data[i+19]-data[i+1], bz = data[i+20]-data[i+2];
      assert.ok(Math.hypot(ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx) > 1e-8, 'no collapsed triangles');
    }
  }
  assert.ok(triangles < 200000, 'bounded geometry-review budget, not a mobile performance claim');
  for (const name of ['MeridianGame','Battlefield','document','window'])
    assert.equal(vm.runInContext(`typeof ${name}`, context), 'undefined');
});
