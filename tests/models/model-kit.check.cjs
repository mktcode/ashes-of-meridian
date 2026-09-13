const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { modelHarness, assertMesh } = require('../helpers/model-contract.cjs');

test('model registry validates atomically, defers factories and uploads once per renderer', () => {
  const h = modelHarness(), registry = h.createEntityModelRegistry();
  let made = 0;
  const render = () => {}, id = 'faction-0/building/barracks';
  registry.register({ id, render, meshes: { testHull: () => { made++; return [1, 2, 3]; } } });
  assert.equal(made, 0, 'registration needs neither GPU nor mesh allocation');
  assert.equal(registry.find({ faction: 0, kind: 'building', type: 'barracks' }).render, render);
  assert.equal(registry.find({ faction: 1, kind: 'building', type: 'barracks' }), undefined);
  assert.throws(() => registry.register({ id, render }), /Duplicate entity model/);
  assert.throws(() => registry.register({ id: 'faction-0/unit/worker', render,
    meshes: { otherHull: () => [], testHull: () => [] } }), /Duplicate model mesh/);
  assert.equal(registry.find({ faction: 0, kind: 'unit', type: 'worker' }), undefined, 'no partial registration');
  assert.throws(() => registry.register({ id: 'display name', render }), /Invalid entity model/);
  assert.throws(() => registry.register({ id: 'faction-0/unit/worker', render, meshes: { bad: [] } }), /Invalid model mesh/);
  assert.throws(() => registry.upload({ meshes: { testHull: [] } }), /Duplicate renderer mesh/);
  assert.equal(made, 0, 'collision fails before invoking factories');
  for (let i = 1; i <= 2; i++) {
    const r = { meshes: {}, geometry(name, data) { this.meshes[name] = data; } };
    registry.upload(r);
    assert.equal(made, i);
    assert.deepEqual(r.meshes.testHull, [1, 2, 3]);
    assert.throws(() => registry.upload(r), /Duplicate renderer mesh/);
  }
});

test('organic shell is closed, outward, deterministic and nondegenerate at both poles', () => {
  const h = modelHarness(), options = { sx: 2, sy: 3, sz: 1 };
  vm.runInContext('Math.random = seeded = () => { throw Error("Shell RNG"); }', h.context);
  const mesh = assertMesh(() => {
    const out = []; h.ModelMesh.lobedShell(out, options); return out;
  }, { minTriangles: 336, maxTriangles: 336, min: [-2.12,-3,-1.06], max: [2.12,3,1.06] });
  const edges = new Map(); let volume = 0;
  for (let i = 0; i < mesh.length; i += 27) {
    const points = [0,9,18].map(k => mesh.slice(i+k,i+k+3)), [a,b,c] = points;
    volume += (a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
    assert.ok(a.reduce((n,v,k)=>n+v*mesh[i+3+k],0)>0, 'outward face');
    for(let j=0;j<3;j++) {
      const key=[points[j],points[(j+1)%3]].map(p=>p.map(v=>Math.round(v*1e9)).join(',')).sort().join('|');
      edges.set(key,(edges.get(key)||0)+1);
    }
  }
  assert.ok(volume > 20 && volume < 27);
  assert.ok([...edges.values()].every(n=>n===2), 'closed seam and poles');
  for(const bad of [{sx:0},{sy:-1},{sz:NaN},{depth:.3},{depth:NaN},{rings:2},{rings:3.5},{segments:12},{lobes:0}])
    assert.throws(()=>h.ModelMesh.lobedShell([],{...options,...bad}),/Invalid organic shell/);
});

test('mesh helpers produce outward closed armor and preserve transformed primitive normals/tints', () => {
  const h = modelHarness();
  vm.runInContext('Math.random = seeded = () => { throw Error("Mesh RNG"); }', h.context);
  const panel = () => {
    const out = []; h.ModelMesh.panel(out, { w: 4, h: 2, d: 3, bevel: .15 }); return out;
  };
  const mesh = assertMesh(panel, { minTriangles: 64, maxTriangles: 64, min: [-2, -1, -1.5], max: [2, 1, 1.5] });
  const edges = new Map();
  for (let i = 0; i < mesh.length; i += 27) {
    assert.ok(mesh.slice(i, i + 3).reduce((v, p, k) => v + p * mesh[i + 3 + k], 0) > 0, 'outward');
    const points = [0, 9, 18].map(k => mesh.slice(i + k, i + k + 3).join(','));
    for (let j = 0; j < 3; j++) {
      const a = points[j], b = points[(j + 1) % 3], key = [a, b].sort().join('|');
      const edge = edges.get(key) || { count: 0, winding: 0 };
      edge.count++; edge.winding += a < b ? 1 : -1; edges.set(key, edge);
    }
  }
  assert.ok([...edges.values()].every(e => e.count === 2 && e.winding === 0), 'closed opposite edge pairs');
  const transform = { x: 3, y: 4, z: -2, sx: 2, sy: .7, sz: 1.3, ry: .4, rx: .7, rz: -.2, tint: [.4, .6, .8] };
  const baked = assertMesh(() => {
    const out = []; h.ModelMesh.bake(out, h.geom.box(), transform); return out;
  }, { minTriangles: 12, maxTriangles: 12, min: [1, 2, -4], max: [5, 6, 0] });
  // Cross-check the rotation convention against the real instance matrix.
  const Renderer = vm.runInContext('MeridianRenderer', h.context), bucket = { data: new Float32Array(22), n: 0 };
  Renderer.prototype.add.call({ dynamic: {}, bucket: () => bucket, reserve: () => 0, color: () => [1, 1, 1] },
    'box', 3, 4, -2, 2, .7, 1.3, 0xffffff, .4, .7, -.2);
  const source = h.geom.box(), m = bucket.data;
  for (let i = 0; i < source.length; i += 9) for (let k = 0; k < 3; k++) {
    const expected = m[12 + k] + source[i] * m[k] + source[i + 1] * m[4 + k] + source[i + 2] * m[8 + k];
    assert.ok(Math.abs(baked[i + k] - expected) < 1e-6);
    assert.equal(baked[i + 6 + k], transform.tint[k]);
  }
  assert.throws(() => h.ModelMesh.bake([], [], { sx: -1 }), /Invalid model scale/);
  assert.throws(() => h.ModelMesh.panel([], { w: 1, h: 1, d: 1, bevel: 1 }), /Invalid armor/);
});

test('registered unit dispatch uses the common transform without touching entity state', () => {
  const h = modelHarness();
  vm.runInContext(`registerEntityModel({ id: 'faction-0/unit/rifle', render({part, metal}) {
    part('box', 0, 1, 0, 1, 1, 1, metal);
  } }); Math.random = seeded = () => { throw Error('Draw RNG'); };`, h.context);
  const e = { id: 1, faction: 0, kind: 'unit', type: 'rifle', hp: 100, x: 12, z: -7, rot: .7 };
  const calls = h.draw(e);
  assert.equal(calls.length, 1); assert.equal(calls[0][1], 12); assert.equal(calls[0][3], -7);
  assert.equal(calls[0][8], .7);
  assert.deepEqual(h.draw({ ...e, hp: 0 }), []);
});
