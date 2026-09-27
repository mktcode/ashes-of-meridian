const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts } = require('./helpers/game-scripts.cjs');

// Intersect actual upward mesh triangles, not a second hand-built height recipe.
function surfaceHeight(data, x, z) {
  let height = -Infinity;
  for (let i = 0; i < data.length; i += 27) {
    if (data[i+4] < .2) continue;
    const ax = data[i], az = data[i+2], bx = data[i+9], bz = data[i+11], cx = data[i+18], cz = data[i+20];
    if (x < Math.min(ax,bx,cx) || x > Math.max(ax,bx,cx) || z < Math.min(az,bz,cz) || z > Math.max(az,bz,cz)) continue;
    const determinant = (bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
    if (Math.abs(determinant) < 1e-9) continue;
    const a = ((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/determinant,
      b = ((cz-az)*(x-cx)+(ax-cx)*(z-cz))/determinant, c = 1-a-b;
    if (Math.min(a,b,c) >= -1e-6) height = Math.max(height,a*data[i+1]+b*data[i+10]+c*data[i+19]);
  }
  return height;
}

test('Aurelion has bounded CPU-only geometry, four broad elevated precincts and continuous sloped approaches', () => {
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
  assert.ok(triangles < 200000, `bounded geometry-review budget (${triangles}), not a mobile performance claim`);
  const structure = meshes.find(mesh => mesh.name === 'aurelionStructure').data;
  for (const sx of [-1,1]) for (const sz of [-1,1]) {
    for (const [x,z] of [[55,90],[83,52],[130,48],[145,110],[72,119],[90,112]]) {
      const height = surfaceHeight(structure,sx*x,sz*z);
      assert.ok(Math.abs(height-14)<.2, `whole corner precinct is raised, including former bridge/interstitial areas: ${sx*x}/${sz*z} -> ${height}`);
    }
    let area = 0;
    for (let i = 0; i < structure.length; i += 27) {
      if (structure[i]*sx<0 || structure[i+2]*sz<0 || structure[i+4]<.99 ||
          [1,10,19].some(k => Math.abs(structure[i+k]-14) > 1e-6)) continue;
      area += Math.abs((structure[i+9]-structure[i])*(structure[i+20]-structure[i+2])-
        (structure[i+18]-structure[i])*(structure[i+11]-structure[i+2]))/2;
    }
    assert.ok(area>9000 && area<11000, 'one broad upper district, not a small pedestal');
    for (const [ax,az,bx,bz,low] of [[112,40,112,18,2],[47,103,24,103,2],[60.5,53.5,43,36,0]]) {
      const length = Math.hypot(bx-ax,bz-az), nx = (bz-az)/length, nz = -(bx-ax)/length;
      for (const t of [.03,.1,.25,.5,.75,.95]) for (const offset of [-4,0,4]) {
        const x = sx*(ax+(bx-ax)*t+nx*offset), z = sz*(az+(bz-az)*t+nz*offset),
          height = surfaceHeight(structure,x,z);
        assert.ok(Math.abs(height-(14+(low-14)*t))<.2, `continuous central ramp lane without cornice obstructions: ${x}/${z} -> ${height}`);
      }
    }
  }
  assert.ok(surfaceHeight(structure,20,6)<1, 'the central plaza remains below the four corner districts');
  for (const name of ['MeridianGame','Battlefield','document','window'])
    assert.equal(vm.runInContext(`typeof ${name}`, context), 'undefined');
});
