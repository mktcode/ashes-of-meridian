import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadLab, VIEW_SCRIPTS } from './test-support.mjs';

// Exercise the full-resolution mesh and upload with a cheap synthetic height
// field. No production terrain queries, river carving or navigation raster.
const canvas = { width: 800, height: 600, getBoundingClientRect: () => ({ width: 800, height: 600 }), addEventListener() {} };
const elements = new Map([['height', canvas]]);
const context = loadLab({ scripts: VIEW_SCRIPTS, globals: {
  assert,
  document: { getElementById: id => {
    if (!elements.has(id)) elements.set(id, {
      listeners: new Map(), addEventListener(type, listener) { this.listeners.set(type, listener); }, checked: true,
    });
    return elements.get(id);
  }, addEventListener() {} },
  window: { addEventListener() {}, devicePixelRatio: 1 },
  ResizeObserver: class { observe() {} },
} });
const result = vm.runInContext(`(() => {
  assert.equal(preview.plan, null);
  assert.equal(preview.mesh, null);
  assert.equal(document.getElementById('heightZones').listeners.size, 0);
  bindLabControls();
  const sampleHeight = (plan, x, y) => {
    const height = 40 + .0005 * ((x - SIZE / 2) ** 2 + (y - SIZE / 2) ** 2);
    return { height, planned: true, bridge: false, deckHeight: height + .08, water: 38.6 };
  };
  const plan = { warp: makeWarp(2, true), river: { outlines: [], spatial: riverSpatialTree([]) } };
  const mesh = preview.mesh = makeMesh(plan, sampleHeight);
  assert.equal(TERRAIN_RESOLUTION, 96);
  assert.equal(mesh.baseFaceCount, 6 * 96 ** 2);
  assert.equal(mesh.terrainFaceCount, mesh.baseFaceCount);
  assert.equal(mesh.vertices.length, 3 * 96 * 97 + 1);
  assert.ok(auditSurface(mesh) < MAX_GRADE);
  const patch = { vertices: [{ x:0,y:0,z:0,walkZ:0 }, { x:1,y:0,z:10,walkZ:.1 }, { x:0,y:1,z:0,walkZ:0 }],
    triangles: [{ indices:[0,1,2], material:0, planned:true, bridge:true }] };
  assert.equal(auditSurface(patch), .1);
  patch.triangles[0].bridge = false;
  assert.equal(auditSurface(patch), 10);
  patch.triangles[0].planned = false;
  assert.equal(auditSurface(patch), 0);
  const auditPlan = { river: { curves: [[{ height:2 }, { height:1 }]] } };
  const beforeAudit = JSON.stringify(patch);
  assert.ok(auditMap(auditPlan, patch, 3, () => ({ planned:true })).connected);
  assert.ok(!auditMap(auditPlan, patch, 3, (p,x,y) => ({ planned:(x < 100 && y < 100) || (x > 200 && y > 200) })).connected);
  assert.equal(JSON.stringify(patch), beforeAudit);
  assert.ok(mesh.vertices.every(p => Number.isFinite(p.light) && p.light >= .45 && p.light <= 1));
  assert.ok(mesh.triangles.some(t => t.indices.some(i => Math.abs(mesh.vertices[i].light - t.light) > 1e-5)));
  for (const target of [0, Math.floor(mesh.vertices.length / 2), mesh.vertices.length - 1]) {
    let nx = 0, ny = 0, nz = 0;
    for (const triangle of mesh.triangles) {
      if (!triangle.indices.includes(target)) continue;
      const [a, b, c] = triangle.indices.map(i => mesh.vertices[i]);
      nx += (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y);
      ny += (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
      nz += (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    }
    const light = .45 + .55 * Math.max(0, (-.4 * nx - .5 * ny + .768 * nz) / Math.hypot(nx, ny, nz));
    assert.ok(Math.abs(mesh.vertices[target].light - light) < 1e-12);
  }
  assert.deepEqual(HEIGHT_BOUNDARIES, [0, 35, 45, 85]);
  assert.equal(heightBoundary(1), 35);
  assert.equal(heightBoundary(2), 45);
  for (const [height, expected] of [[-10, 0], [0, 0], [34.99, 0], [35, 1], [40, 1], [44.99, 1], [45, 2], [85, 2], [100, 2]]) {
    assert.equal(heightBand(height), expected);
  }
  // Entire cards may occupy one zone: do not normalize to their own extrema.
  for (const [heights, expected] of [[[5, 10, 34], 0], [[35, 40, 44], 1], [[45, 70, 80], 2]]) {
    assert.ok(heights.every(h => heightBand(h) === expected));
  }
  assert.ok(heightLegendHTML().includes('Mittelland: 35–45'));
  // Verify that GPU packing uses shared terrain attributes, but keeps water
  // and bridge decks separate. Extra material faces must not affect normals.
  const first = mesh.triangles[0];
  mesh.triangles.push({ ...first, material: 1, light: 1, height: 38.6, planned: false },
    { ...first, material: 2, light: .6, height: 40, planned: true });
  let uploaded, uploads = 0;
  const uniforms = {};
  const gl = {
    isContextLost: () => false, bindBuffer() {}, bufferData(target, data) { uploaded = data; uploads++; },
    viewport() {}, clear() {}, uniform4f() {}, uniform2f(name, x, y) { uniforms[name] = [x, y]; },
    uniform1i(name, value) { uniforms[name] = value; }, drawArrays() {},
    ARRAY_BUFFER: 1, STATIC_DRAW: 2, TRIANGLES: 4, COLOR_BUFFER_BIT: 8, DEPTH_BUFFER_BIT: 16,
  };
  preview.gpu = { gl, buffer: {}, uploaded: null, overlay: 'overlay', heightZones: 'heightZones',
    heightRange: 'heightRange', heightCuts: 'heightCuts' };
  draw3D();
  assert.equal(uploads, 1);
  assert.equal(uploaded.length, mesh.triangles.length * 21);
  let offset = 0;
  for (const triangle of mesh.triangles) for (const index of triangle.indices) {
    const p = mesh.vertices[index];
    const light = triangle.material === 0 ? p.light : triangle.material === 2 ? .9 : triangle.light;
    const height = triangle.material === 0 ? p.height : triangle.height;
    const z = triangle.material === 0 ? p.z : triangle.material === 1 ? p.waterZ : p.walkZ;
    assert.ok(Math.abs(uploaded[offset + 2] - z) < 1e-5);
    assert.ok(Math.abs(uploaded[offset + 3] - light) < 1e-6);
    assert.ok(Math.abs(uploaded[offset + 4] - height) < 1e-5);
    offset += 7;
  }
  draw3D();
  assert.equal(uploads, 1);
  assert.equal(uniforms.heightZones, 1);
  assert.deepEqual(uniforms.heightRange, [0, 85]);
  assert.deepEqual(uniforms.heightCuts, [35, 45]);
  preview.plan = plan;
  const originalMesh = mesh, toggle = document.getElementById('heightZones');
  for (const active of [false, true]) {
    toggle.checked = active;
    toggle.listeners.get('change')();
    assert.equal(document.getElementById('heightLegend').hidden, !active);
    assert.equal(document.getElementById('overlay').disabled, active);
    assert.equal(uniforms.heightZones, active ? 1 : 0);
    assert.equal(preview.mesh, originalMesh);
    assert.equal(preview.plan, plan);
    assert.equal(uploads, 1);
  }
  return { vertices: mesh.vertices.length, faces: mesh.terrainFaceCount };
})()`, context, { timeout: 5000 });
console.log(`Synthetic mesh: ${result.vertices} vertices, ${result.faces} terrain faces; area-weighted lighting, interpolated height, fixed height zones and cached upload on toggles OK. No generated-map/raster validation.`);
