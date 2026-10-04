const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { BATTLEFIELD_SCRIPTS, RENDERER_SCRIPTS, loadScripts } = require('./helpers/game-scripts.cjs');

// API orchestration and shader-source contracts only: no GPU/GLSL execution in Node.
test('scene material variants share every material and lighting formula with the general shader', () => {
  const context = loadScripts(RENDERER_SCRIPTS);
  const { FRAG, MAT, sceneMaterialFragment } = vm.runInContext('({FRAG, MAT, sceneMaterialFragment})', context);
  for (const material of [MAT.LANDSCAPE, MAT.LEAF]) {
    const shader = sceneMaterialFragment(material), define = `#define SCENE_MATERIAL ${material}.\n`;
    assert.ok(shader.startsWith('#version 300 es\n' + define));
    assert.equal(shader.replace(define, ''), FRAG, 'specialization only supplies a compile-time material');
  }
});

test('upload tracks eligible homogeneous materials and clears stale specialization on reuse', () => {
  const context = loadScripts(RENDERER_SCRIPTS), Renderer = vm.runInContext('MeridianRenderer', context);
  const uploads = [], r = Object.assign(Object.create(Renderer.prototype), { gl: {
    bindBuffer() {}, bufferData(target, data) { uploads.push(data.length); }
  } });
  const b = { n: 2, data: new Float32Array(44), buffer: {}, dirty: true };
  const upload = (...materials) => {
    b.n = materials.length; materials.forEach((m, i) => b.data[i * 22 + 21] = m); b.dirty = true; r.upload({ b });
  };
  upload(8, 8); assert.equal(b.sceneMaterial, 8);
  r.upload({ b }); assert.equal(uploads.length, 1, 'unchanged static buckets are not uploaded/rescanned');
  upload(8, 13); assert.equal(b.sceneMaterial, undefined, 'mixed instanced material values cannot specialize');
  upload(13, 13); assert.equal(b.sceneMaterial, 13);
  upload(2); assert.equal(b.sceneMaterial, undefined, 'models retain the general shader');
  upload(8); upload(); assert.equal(b.sceneMaterial, undefined, 'empty reuse clears the old material');
  upload(13); assert.equal(b.sceneMaterial, 13);
});

test('specialized scene draws preserve order, filter before binding and leave other passes alone', () => {
  const context = loadScripts(RENDERER_SCRIPTS), Renderer = vm.runInContext('MeridianRenderer', context);
  const bindings = [], draws = []; let active = 'depth';
  const gl = new Proxy({ drawArraysInstanced() { draws.push(active); } }, {
    get: (o, key) => key in o ? o[key] : () => {}
  });
  const r = Object.assign(Object.create(Renderer.prototype), { gl, quality: 2, meshes: { mesh: { vao: {}, count: 3 } },
    materialPrograms: { 8: 'landscape', 13: 'leaf' }, program: 'general', drawCalls: 0,
    bindSceneProgram(time, modelTime, program) {
      bindings.push([time, modelTime, program]); active = this.activeSceneProgram = program;
    }
  });
  const bucket = (material, source = 'visible') => ({ mesh: 'mesh', source, n: 1, buffer: {}, sceneMaterial: material });
  const map = { a: bucket(8), b: bucket(8), hidden: bucket(13, 'skip'), c: bucket(13), d: bucket(undefined) };
  r.drawBatches(map, undefined, 'skip', undefined, 12, 7);
  assert.deepEqual(draws, ['landscape', 'landscape', 'leaf', 'general']);
  assert.deepEqual(bindings, [[12, 7, 'landscape'], [12, 7, 'leaf'], [12, 7, 'general']]);
  bindings.length = draws.length = 0; active = 'depth';
  r.drawBatches(map, undefined, 'skip');
  assert.deepEqual(bindings, [], 'depth/occlusion/custom passes do not opt into material binding');
  assert.deepEqual(draws, ['depth', 'depth', 'depth', 'depth']);
});

test('metal/bio sampling uses scaled mesh-local positions and normals, not world coordinates', () => {
  const context = loadScripts(RENDERER_SCRIPTS);
  const { VERT, FRAG } = vm.runInContext('({VERT, FRAG})', context);
  assert.ok(VERT.includes('vec3 textureScale=max(vec3(length(a_model[0].xyz),length(a_model[1].xyz),length(a_model[2].xyz)),vec3(.00001));'));
  assert.ok(VERT.includes('v_modelPos=a_pos*textureScale;'));
  assert.ok(VERT.includes('v_modelN=a_normal/textureScale;'));
  for (const varying of ['v_modelPos', 'v_modelN']) {
    assert.ok(VERT.includes(`out vec3 ${varying};`));
    assert.ok(FRAG.includes(`in vec3 ${varying};`));
  }
  assert.ok(FRAG.includes('tri(u_metalTex,v_modelPos,normalize(v_modelN),.33)'));
  assert.ok(FRAG.includes('tri(u_bioTex,v_modelPos,normalize(v_modelN),.17)'));
  assert.ok(FRAG.includes('tri(u_groundTex,v_pos,n,.28)'));
  assert.ok(FRAG.includes('tri(u_groundTex,v_pos,n,.012)'));
  assert.ok(FRAG.includes('world/u_groundTile+u_surfaceOffset'), 'physical tile size is independent of bake resolution');
  assert.ok(FRAG.includes('vec3 t=groundBase(v_pos.xz);base=t;'), 'ground uses the procedural recipe');
  assert.ok(FRAG.includes('base=t;vec4 rocks=groundDecor'), 'decals overlay the surface recipe');
  assert.ok(FRAG.includes('float sh=shadow()'), 'ground still receives model shadows');
  for (const texture of ['u_rockClustersTex', 'u_desertShrubsTex'])
    assert.ok(FRAG.includes(`uniform sampler2D ${texture};`));
  assert.ok(FRAG.includes('groundDecor(u_rockClustersTex,v_pos.xz,false)'));
  assert.ok(FRAG.includes('groundDecor(u_desertShrubsTex,v_pos.xz,true)'));
  assert.ok(FRAG.includes('normalize(u_eye-v_pos)'));
  assert.ok(FRAG.includes('texture(u_fog,(v_pos.xz+u_extent)/(u_extent*2.))'));
});
test('ground decoration samples individual irregular atlas crops with stable world-cell variation', () => {
  const context = loadScripts(RENDERER_SCRIPTS);
  const { GROUND_DECOR_ATLAS: atlas, FRAG, MeridianRenderer } = vm.runInContext(
    '({GROUND_DECOR_ATLAS, FRAG, MeridianRenderer})', context);
  for (const [key, count] of [['rockClusters', 16], ['desertShrubs', 10]]) {
    assert.equal(atlas[key].length, count);
    assert.equal(new Set(atlas[key].map(r => r.join(','))).size, count);
    for (const [x, y, right, bottom] of atlas[key]) {
      assert.ok(x >= 0 && y >= 0 && right <= 1254 && bottom <= 1254);
      assert.ok(right > x && bottom > y);
    }
    for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
      const a = atlas[key][i], b = atlas[key][j];
      assert.ok(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1], 'motif crops do not overlap');
    }
    assert.ok(FRAG.includes(`const vec4 ${key}Rects[${count}]`));
    assert.ok(FRAG.includes(`${key}Rects[int(r.z*${count}.)]`), 'all supplied motifs are selectable');
  }
  const decor = FRAG.slice(FRAG.indexOf('vec4 decorRandom'), FRAG.indexOf('vec3 detail'));
  assert.doesNotMatch(decor, /u_time|u_eye/);
  assert.ok(FRAG.includes('precision highp int;'), '32-bit cell hash also on mobile GPUs');
  assert.ok(decor.includes('u_decorSeed'));
  assert.ok(decor.includes('cell=floor(p)'));
  assert.ok(decor.includes('pixels/max(pixels.x,pixels.y)'), 'preserve crop aspect ratio');
  assert.ok(decor.includes('textureLod(tex,uv,lod)'));
  assert.ok(decor.includes('dFdx(p)/span*pixels'), 'LOD excludes atlas/cell discontinuities');
  assert.ok(decor.includes('return vec4(0.)'), 'outside a crop and unoccupied cells stay transparent');
});
test('tilt-shift is High-only with a sharp center, normalized kernel and resolution-relative radius', () => {
  const context = loadScripts(RENDERER_SCRIPTS);
  const POSTF = vm.runInContext('POSTF', context);
  assert.ok(POSTF.includes('if(u_quality>1.5)c=tiltShift(c,px);'));
  assert.ok(POSTF.includes('smoothstep(.20,.48,abs(uv.y-.5))'));
  assert.ok(POSTF.includes('if(amount<=0.)return sharp;'));
  assert.ok(POSTF.includes('px*(min(u_size.x,u_size.y)*.006*amount)'));
  const kernel = POSTF.slice(POSTF.indexOf('vec3 tiltShift'), POSTF.indexOf('void main()'));
  assert.equal((kernel.match(/texture\(u_tex,/g) || []).length, 8);
  assert.ok(kernel.includes('blurred=sharp*4.;'));
  assert.ok(kernel.includes(')).rgb)*2.;'));
  assert.ok(kernel.includes('return blurred/16.;'));
  assert.doesNotMatch(kernel, /texture\((?!u_tex,)/);
  assert.ok(POSTF.includes('if(u_bloomOn>.5)c+=texture(u_bloom,uv)'), 'bloom composites a separate low-resolution texture');
});

test('renderer reuses typed geometry and uploads a bucket transition to empty only once', () => {
  const context = loadScripts(RENDERER_SCRIPTS), Renderer = vm.runInContext('MeridianRenderer', context), uploads = [];
  const gl = new Proxy({
    ARRAY_BUFFER: 'ARRAY_BUFFER', STATIC_DRAW: 'STATIC_DRAW', DYNAMIC_DRAW: 'DYNAMIC_DRAW',
    createVertexArray: () => ({}), createBuffer: () => ({}), bindVertexArray() {}, bindBuffer() {},
    bufferData(target, data, usage) { uploads.push({ target, data, usage }); }
  }, { get(target, name) {
    if (!(name in target)) target[name] = () => {};
    return target[name];
  } });
  const renderer = Object.assign(Object.create(Renderer.prototype), { gl, meshes: {}, meshParts: {}, dynamic: {}, effects: {} });
  const typed = vm.runInContext('new Float32Array(27)', context);
  renderer.geometry('typed', typed);
  assert.strictEqual(uploads.at(-1).data, typed, 'typed mesh storage is passed directly to WebGL');
  renderer.geometry('array', Array(27).fill(0));
  assert.ok(ArrayBuffer.isView(uploads.at(-1).data), 'plain mesh arrays are still converted for WebGL');

  const occupied = { data: new Float32Array(44), n: 2, buffer: {}, dirty: false },
    empty = { data: new Float32Array(22), n: 0, buffer: {}, dirty: false };
  renderer.dynamic = { occupied, empty };
  uploads.length = 0;
  renderer.begin();
  assert.equal(occupied.dirty, true); assert.equal(empty.dirty, false);
  renderer.upload(renderer.dynamic);
  assert.equal(uploads.length, 1); assert.equal(uploads[0].data.length, 0, 'occupied bucket releases its old upload once');
  renderer.begin(); renderer.upload(renderer.dynamic);
  assert.equal(uploads.length, 1, 'persistently empty buckets cause no repeated upload');
  occupied.n = 1; occupied.dirty = true;
  renderer.upload(renderer.dynamic);
  assert.equal(uploads.at(-1).data.length, 22, 'a reused bucket uploads new instances normally');
});

test('streamed viewport geometry retains GPU storage and updates bounds without static chunking', () => {
  const context=loadScripts(RENDERER_SCRIPTS), Renderer=vm.runInContext('MeridianRenderer',context);
  const buffers=new Set(), vaos=new Set(), uploads=[], updates=[];let bound;
  const gl={ARRAY_BUFFER:1,STATIC_DRAW:2,DYNAMIC_DRAW:3,FLOAT:4,
    createBuffer(){const b={};buffers.add(b);return b;},createVertexArray(){const v={};vaos.add(v);return v;},
    bindBuffer(target,b){bound=b;},bindVertexArray(){},enableVertexAttribArray(){},vertexAttribPointer(){},
    bufferData(target,data,usage){uploads.push({bound,data,usage});},
    bufferSubData(target,offset,data){updates.push({bound,offset,data});},
    deleteBuffer(b){assert.ok(buffers.delete(b));},deleteVertexArray(v){assert.ok(vaos.delete(v));}};
  const r=Object.assign(Object.create(Renderer.prototype),{gl,meshes:{},meshParts:{}});
  const data=new Float32Array(200*27);data[0]=-100;data[9]=100;data[10]=4;
  r.streamGeometry('guide',data);
  const {vao,vbo}=r.meshes.guide;
  assert.deepEqual(Array.from(r.meshParts.guide),['guide'],'viewport mesh is not repartitioned');
  assert.equal(buffers.size,1);assert.equal(vaos.size,1);assert.equal(uploads[0].usage,gl.DYNAMIC_DRAW);
  data[0]=-120;data[10]=8;r.streamGeometry('guide',data);
  assert.strictEqual(r.meshes.guide.vao,vao);assert.strictEqual(r.meshes.guide.vbo,vbo);
  assert.equal(uploads.length,1);assert.equal(updates.length,1);assert.equal(updates[0].offset,0);
  assert.strictEqual(updates[0].data,data);assert.equal(r.meshes.guide.bounds[0],-120);assert.equal(r.meshes.guide.bounds[4],8);
  r.streamGeometry('guide',new Float32Array(27));
  assert.equal(buffers.size,1);assert.equal(vaos.size,1);assert.equal(uploads.length,2);
  r.releaseGeometry('guide');assert.equal(buffers.size,0);assert.equal(vaos.size,0);
  assert.equal(r.meshParts.guide,undefined);
});

function geometryResidency(context) {
  const Renderer = vm.runInContext('MeridianRenderer', context), buffers = new Map(), vaos = new Set();
  let bound, uploads = 0, releases = 0;
  const gl = new Proxy({
    createBuffer() { const buffer = {}; buffers.set(buffer, 0); return buffer; },
    createVertexArray() { const vao = {}; vaos.add(vao); return vao; },
    bindBuffer(target, buffer) { bound = buffer; },
    bufferData(target, data) { assert.ok(buffers.has(bound)); buffers.set(bound, data.byteLength); uploads++; },
    deleteBuffer(buffer) { assert.ok(buffers.delete(buffer), 'delete a live VBO exactly once'); releases++; },
    deleteVertexArray(vao) { assert.ok(vaos.delete(vao), 'delete a live VAO exactly once'); }
  }, { get(target, name) {
    if (!(name in target)) target[name] = () => {};
    return target[name];
  } });
  const renderer = Object.assign(Object.create(Renderer.prototype), { gl, meshes: {}, meshParts: {}, static: {},
    battlefieldProfile: vm.runInContext('DEFAULT_TERRAIN_RENDER_PROFILE', context) });
  return { renderer, buffers, vaos, get uploads() { return uploads; }, get releases() { return releases; },
    get bytes() { return [...buffers.values()].reduce((sum, size) => sum + size, 0); } };
}

test('geometry replacement and release dispose every chunk without touching shared meshes', () => {
  const context = loadScripts(RENDERER_SCRIPTS), h = geometryResidency(context), r = h.renderer;
  const small = new Float32Array(27), vertices = [];
  for (const x of [0, 64]) for (let triangle = 0; triangle < 32; triangle++)
    for (const [px, pz] of [[x, 0], [x + .2, 0], [x, .2]]) vertices.push(px, 0, pz, 0, 1, 0, 1, 1, 1);
  const wide = new Float32Array(vertices);
  r.geometry('sharedUnit', small);
  const shared = r.meshes.sharedUnit;
  for (const data of [wide, small, wide]) {
    r.geometry('world', data);
    const parts = data === wide ? 2 : 1;
    assert.equal(r.meshParts.world.length, parts);
    assert.equal(h.buffers.size, parts + 1);
    assert.equal(h.vaos.size, parts + 1);
    assert.equal(Object.keys(r.meshes).length, parts + 1);
    assert.equal(h.bytes, small.byteLength + data.byteLength);
    assert.strictEqual(r.meshes.sharedUnit, shared);
  }
  r.releaseGeometry('world');
  r.releaseGeometry('world');
  r.releaseGeometry('absent');
  assert.deepEqual(Object.keys(r.meshParts), ['sharedUnit']);
  assert.deepEqual(Object.keys(r.meshes), ['sharedUnit']);
  assert.equal(h.buffers.size, 1); assert.equal(h.vaos.size, 1);
  assert.equal(h.bytes, small.byteLength);
});

test('map switches keep only current world meshes plus shared geometry, including returning to Desert', () => {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'world-view']);
  const { Battlefield, BattlefieldView, TerrainModels } = vm.runInContext('({Battlefield, BattlefieldView, TerrainModels})', context);
  const h = geometryResidency(context), r = h.renderer, view = new BattlefieldView(r);
  // Real map descriptors/ownership and GPU lifecycle; expensive model geometry has separate coverage.
  TerrainModels.geometry = () => new Float32Array(27);
  r.add = () => {}; r.fog = (pixels,size) => {assert.equal(pixels.length,size*size);r.fogSize=size;};
  r.geometry('sharedUnit', new Float32Array(27));
  const shared = r.meshes.sharedUnit;
  let firstDesertBytes;
  for (const [map,seed=1409] of [['desert'], ['frontier',3], ['frontier'], ['haven'], ['westmark'], ['mothership'], ['alien-planet'], ['desert']]) {
    const world = new Battlefield(seed, map), before = JSON.stringify(world.renderData);
    const expected = new Set(['sharedUnit', 'terrain', ...world.renderData.geometries.map(d => d.mesh)]);
    view.sync(world, false);
    assert.deepEqual(new Set(Object.keys(r.meshParts)), expected, `${map}: no preceding map remains resident`);
    const parts = Object.values(r.meshParts).flat();
    assert.deepEqual(new Set(Object.keys(r.meshes)), new Set(parts));
    assert.equal(h.buffers.size, parts.length); assert.equal(h.vaos.size, parts.length);
    assert.strictEqual(r.meshes.sharedUnit, shared, 'shared model is never replaced or released');
    const uploads = h.uploads, releases = h.releases;
    view.sync(world, true); view.sync(world, false);
    assert.equal(r.extent,world.extent);assert.equal(r.fogSize,world.gridSize);assert.strictEqual(r.surface,world.surface);
    assert.equal(!!r.environment, false, 'retained worlds use the shared renderer');
    assert.equal(h.uploads, uploads); assert.equal(h.releases, releases, 'unchanged layout/fog changes do not churn geometry');
    assert.equal(JSON.stringify(world.renderData), before, 'CPU terrain descriptors remain unchanged');
    if (map === 'desert') {
      if (firstDesertBytes === undefined) firstDesertBytes = h.bytes;
      else assert.equal(h.bytes, firstDesertBytes, 'returning to Desert restores the original synthetic residency');
    }
  }
});

test('battlefield texture residency retains shared materials and releases map-only assets', async () => {
  const context = loadScripts(RENDERER_SCRIPTS), Renderer = vm.runInContext('MeridianRenderer', context), loads = [], releases = [];
  const names = ['ground', 'desertRock', 'rockClusters', 'desertShrubs', 'metal', 'bio', 'sky'];
  const renderer = Object.assign(Object.create(Renderer.prototype), {
    textureResources: Object.fromEntries(names.map(name => [name, { resident: false }])),
    textureLoads: {}, desiredTextures: new Set(), textureGeneration: 0,
    loadResidentTexture: async name => {
      if (renderer.textureResources[name].resident) return true;
      loads.push(name); renderer.textureResources[name].resident = true; return true;
    },
    releaseResidentTexture: name => { releases.push(name); renderer.textureResources[name].resident = false; }
  });
  const profile = (groundTexture, decor = false, rockSurface) => ({ groundTexture, skyTexture: 'sky',
    rockSurface, rockDecor: { density: decor ? .5 : 0, opacity: 1 },
    shrubDecor: { density: decor ? .1 : 0, opacity: 1 }, haze: [0, 0, 0] });
  const desert = profile('ground', true, { texture: 'desertRock', metersPerTile: 18 });
  await renderer.prepareBattlefieldTextures(desert);
  assert.deepEqual(new Set(loads), new Set(names));
  assert.equal(renderer.hasBattlefieldTextures(desert), true);
  loads.length = 0;
  await renderer.prepareBattlefieldTextures(profile('bio'));
  assert.deepEqual(loads, [], 'shared bio, metal and sky textures stay resident across maps');
  assert.deepEqual(new Set(releases), new Set(['ground', 'desertRock', 'rockClusters', 'desertShrubs']));
  assert.deepEqual(names.filter(name => renderer.textureResources[name].resident).sort(), ['bio', 'metal', 'sky']);
});

test('large static geometry and placements are chunked and conservatively culled', () => {
  const context = loadScripts(RENDERER_SCRIPTS), Renderer = vm.runInContext('MeridianRenderer', context), draws = [];
  const gl = new Proxy({
    ARRAY_BUFFER: 'ARRAY_BUFFER', STATIC_DRAW: 'STATIC_DRAW', DYNAMIC_DRAW: 'DYNAMIC_DRAW', FLOAT: 'FLOAT', TRIANGLES: 'TRIANGLES',
    createVertexArray: () => ({}), createBuffer: () => ({}), bindVertexArray() {}, bindBuffer() {}, bufferData() {},
    drawArraysInstanced(mode, first, count, instances) { draws.push({ mode, first, count, instances }); }
  }, { get(target, name) {
    if (!(name in target)) target[name] = () => {};
    return target[name];
  } });
  const renderer = Object.assign(Object.create(Renderer.prototype), {
    gl, meshes: {}, meshParts: {}, static: {}, dynamic: {}, effects: {}, colors: new Map(), drawCalls: 0
  });
  const vertices = [];
  for (const x of [0, 64]) for (let triangle = 0; triangle < 32; triangle++)
    for (const [px, pz] of [[x, 0], [x + .2, 0], [x, .2]]) vertices.push(px, 0, pz, 0, 1, 0, 1, 1, 1);
  renderer.geometry('wide', new Float32Array(vertices));
  assert.equal(renderer.meshParts.wide.length, 2, 'wide triangle data is split into local meshes');
  assert.equal(renderer.meshParts.wide.reduce((sum, part) => sum + renderer.meshes[part].count, 0), vertices.length / 9,
    'chunking preserves every source vertex');
  renderer.add('wide', 0, 0, 0, 1, 1, 1, 0xffffff, 0, 0, 0, 0, 1, 'static');
  assert.equal(Object.keys(renderer.static).length, 2);
  assert.equal(Object.values(renderer.static).reduce((sum, bucket) => sum + bucket.n, 0), 2,
    'one logical placement is retained for every geometry part');
  renderer.upload(renderer.static);
  const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  renderer.drawBatches(renderer.static, identity);
  assert.deepEqual(draws.map(draw => draw.instances), [1], 'only the origin chunk reaches the identity frustum');
  draws.length = 0; identity[12] = -64;
  renderer.drawBatches(renderer.static, identity);
  assert.deepEqual(draws.map(draw => draw.instances), [1], 'moving the frustum selects the distant chunk without loss');
});

function setup(options = {}) {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS, 'battlefield-ecology', ...(options.scripts ?? [])], { globals: {
    innerWidth: 800, innerHeight: 600, devicePixelRatio: 2
  } });
  const Renderer = vm.runInContext('MeridianRenderer', context), calls = [];
  const framebuffers = new Set(), buffers = new Set(), textures = new Set(), textureUnits = new Map();
  let activeUnit = 'TEXTURE0';
  let draw = null, read = null, buffer = null, program = null, next = 0;
  const api = {
    COLOR_BUFFER_BIT: 1, DEPTH_BUFFER_BIT: 2,
    getParameter(name) { if(name==='MAX_TEXTURE_SIZE')return 4096; },
    createTexture() { if(options.failTexture||options.failTextureAt===textures.size+1)return null;const t={id:++next};textures.add(t);return t; },
    deleteTexture(t) { assert.ok(textures.delete(t)); },
    activeTexture(unit) { activeUnit=unit;calls.push(['activeTexture',unit]); },
    bindTexture(target,t) { textureUnits.set(activeUnit,t);calls.push(['bindTexture',target,t]); },
    texImage2D(...args) { Object.assign(textureUnits.get(activeUnit),{width:args[3],height:args[4]});calls.push(['texImage2D',...args]); },
    createFramebuffer() {
      if (options.failFramebuffer) return null;
      const f = { id: ++next, attachments: {} }; framebuffers.add(f); return f;
    },
    createRenderbuffer() {
      if (options.failRenderbuffer) return null;
      const b = { id: ++next }; buffers.add(b); return b;
    },
    deleteFramebuffer(f) { assert.ok(framebuffers.delete(f)); },
    deleteRenderbuffer(b) { assert.ok(buffers.delete(b)); },
    bindFramebuffer(target, f) {
      if (target !== 'READ_FRAMEBUFFER') draw = f;
      if (target !== 'DRAW_FRAMEBUFFER') read = f;
      calls.push(['bindFramebuffer', target, f]);
    },
    bindRenderbuffer(target, b) { buffer = b; },
    getInternalformatParameter(target, format) {
      return format === 'RGBA8' ? (options.color ?? [8, 2, 4]) : (options.depth ?? [4, 2]);
    },
    renderbufferStorage(target, format, width, height) {
      Object.assign(buffer, { format, width, height, samples: 0 });
    },
    renderbufferStorageMultisample(target, samples, format, width, height) {
      Object.assign(buffer, { format, width, height, samples });
      calls.push(['storage', samples, format, width, height]);
    },
    framebufferRenderbuffer(target, attachment, rbTarget, b) { draw.attachments[attachment] = b; },
    framebufferTexture2D(target, attachment, texTarget, tex) { draw.attachments[attachment] = tex; },
    checkFramebufferStatus() {
      const c = draw.attachments.COLOR_ATTACHMENT0, d = draw.attachments.DEPTH_ATTACHMENT;
      if(!d) { assert.ok(c.width>0&&c.height>0);return options.rejectBloom ? 'FRAMEBUFFER_UNSUPPORTED' : 'FRAMEBUFFER_COMPLETE'; }
      if(!c) { assert.equal(d.format,'DEPTH_COMPONENT24');return options.rejectShadow ? 'FRAMEBUFFER_UNSUPPORTED' : 'FRAMEBUFFER_COMPLETE'; }
      assert.equal(c.samples, d.samples); assert.equal(c.width, d.width); assert.equal(c.height, d.height);
      return options.reject?.(c.samples) ? 'FRAMEBUFFER_INCOMPLETE_MULTISAMPLE' : 'FRAMEBUFFER_COMPLETE';
    },
    useProgram(p) { program = p; calls.push(['program', p]); },
    drawArrays() {
      if(program==='bloom') assert.notEqual(textureUnits.get('TEXTURE0'),draw.attachments.COLOR_ATTACHMENT0,'no texture feedback');
      calls.push(['quad', program, draw]);
    },
    blitFramebuffer(...args) { calls.push(['resolve', read, draw, ...args]); }
  };
  const g = new Proxy(api, { get(target, name) {
    if (!(name in target)) target[name] = /^[A-Z0-9_]+$/.test(name) ? name : (...args) => calls.push([name, ...args]);
    return target[name];
  } });
  const r = Object.assign(Object.create(Renderer.prototype), {
    gl: g, quality: 2, canvas: {}, sceneFbo: g.createFramebuffer(), sceneTex: {}, sceneDepth: g.createRenderbuffer(),
    sceneMSAAFbo: null, sceneMSAAColor: null, sceneMSAADepth: null, sceneSamples: 0,
    bloomTargets: [], bloomProg: 'bloom',
    surfaceStyle: vm.runInContext("surfaceWorldStyle('ground', 0)", context),
    battlefieldProfile: vm.runInContext('DEFAULT_TERRAIN_RENDER_PROFILE', context),
    frame: 0, shadowSize: 1536, shadowBias: .00022, lightVP: vm.runInContext('M4.identity()',context), haze: [0, 0, 0], static: 'static', dynamic: 'dynamic', effects: 'effects',
    program: 'scene', depthProg: 'shadow', skyProg: 'sky', postProg: 'post', shadowFbo: 'shadow-target',
    upload() {}, uniform(p, name) { return name; },
    drawBatches(batch, matrix, excludedNames, includedName) {
      calls.push(['batch', batch, program, draw, matrix, excludedNames, includedName]);
    }
  });
  Object.defineProperty(r.canvas, 'getBoundingClientRect', { value: () => options.viewport ||
    ({ left: 0, top: 0, width: context.innerWidth, height: context.innerHeight }) });
  return { r, g, calls, options, framebuffers, buffers, textures, context, bindings: () => ({ draw, read, buffer }) };
}

test('occlusion reuses model transforms in bounded growing buckets and resets without stale contacts', () => {
  const {r} = setup();
  Object.assign(r, {meshParts:{piece:['piece0','piece1']}, meshes:{}, colors:new Map(),
    static:{},dynamic:{},effects:{},occlusion:{},occlusionInstances:0});
  const part = () => r.add('piece',3,4,5,2,.4,3,0xffffff,.3,.2,.1,.8,1);
  part(); r.recordOcclusion('piece',0x65e5e9);
  for (const name of ['piece0','piece1']) {
    const actual = r.occlusion[name], source = r.dynamic[name];
    assert.deepEqual(Array.from(actual.data.slice(0,16)),Array.from(source.data.slice(0,16)));
    assert.deepEqual(Array.from(actual.data.slice(19,22)),Array.from(source.data.slice(19,22)));
    assert.ok(Math.abs(actual.data[16]-101/255)<1e-6);
    assert.equal(actual.data.length,32*22,'small independent start capacity, not 1024 duplicated instances');
  }
  const first = r.occlusion.piece0;
  for (let i=0;i<40;i++) {part();r.recordOcclusion('piece',0x65e5e9);}
  assert.equal(first.n,41);assert.equal(first.data.length,64*22,'capacity grows only as needed');
  assert.equal(r.occlusionInstances,82);
  r.begin();
  assert.equal(r.occlusionInstances,0);assert.equal(first.n,0);assert.equal(first.dirty,true);
  r.upload = Object.getPrototypeOf(r).upload;
  r.upload(r.occlusion);r.begin();
  assert.equal(first.dirty,false,'no repeated empty uploads');
  part();r.recordOcclusion('piece',0xe98680);
  assert.strictEqual(r.occlusion.piece0,first);
  assert.equal(first.n,1,'only newly observed parts remain');
});

test('occlusion draws against static depth before entities, never into shadows, and restores city program/state', () => {
  for (const quality of [0,1,2]) {
    const h=setup(),r=h.r;r.quality=quality;r.resize();
    r.occlusion='occlusion';r.occlusionInstances=1;r.occlusionProg='contours';r.eye=[0,60,50];
    h.calls.length=0;r.render(0);
    const contours=h.calls.filter(c=>c[0]==='batch'&&c[1]==='occlusion');
    assert.equal(contours.length,1);assert.equal(contours[0][2],'contours');
    const i=h.calls.indexOf(contours[0]);
    assert.ok(i>h.calls.findIndex(c=>c[0]==='batch'&&c[1]==='static'&&c[2]==='scene'));
    assert.ok(i<h.calls.findIndex(c=>c[0]==='batch'&&c[1]==='dynamic'&&c[2]==='scene'));
    assert.ok(h.calls.slice(0,i).some(c=>c[0]==='depthFunc'&&c[1]==='GREATER'));
    const restored=h.calls.slice(i+1);
    assert.ok(restored.some(c=>c[0]==='depthMask'&&c[1]===true));
    assert.ok(restored.some(c=>c[0]==='depthFunc'&&c[1]==='LEQUAL'));
    assert.ok(restored.some(c=>c[0]==='disable'&&c[1]==='CULL_FACE'));
    assert.ok(restored.some(c=>c[0]==='program'&&c[1]==='scene'));
    r.activeSceneProgram='city';h.calls.length=0;r.drawOcclusion();
    assert.deepEqual(h.calls.at(-1),['program','city'],'preserve cached city binding without a GL query');
    r.occlusionInstances=0;h.calls.length=0;r.drawOcclusion();assert.equal(h.calls.length,0);
    r.occlusionInstances=1;r.cinema=true;r.drawOcclusion();assert.equal(h.calls.length,0);
  }
});

test('tile callback runs before the full scene and is counted in its own diagnostic pass', () => {
  const {r,calls} = setup(), hooks=[];
  r.diagnostics={beginFrame(){hooks.push('frame');},beginPass(pass){hooks.push(pass);},endPass(){},draw(){},upload(){}};
  calls.length=0;
  r.render(3,2,()=>{
    hooks.push('tile');
    r.gl.bindFramebuffer(r.gl.FRAMEBUFFER,null);
    r.gl.viewport(0,0,64,64);
    calls.push(['tile']);
  });
  assert.deepEqual(hooks.slice(0,3),['frame','thumbnails','tile']);
  const at=calls.findIndex(c=>c[0]==='tile');
  assert.ok(at>=0);
  assert.ok(calls.slice(at+1).some(c=>c[0]==='viewport'&&c[3]===r.width&&c[4]===r.height),'full-size scene replaces scratch rectangle');
  assert.ok(calls.slice(at+1).some(c=>c[0]==='batch'&&c[1]==='dynamic'&&c[2]==='scene'));
});

test('diagnostic hooks bracket real render passes without changing GL work, including Performance exclusions', () => {
  for (const quality of [0, 2]) {
    const { r, calls } = setup(); r.quality = quality; r.resize();
    calls.length = 0; r.render(3, 2);
    const baseline = calls.slice(), hooks = [];
    r.diagnostics = { beginFrame() { hooks.push('frame'); },
      beginPass(pass) { hooks.push(pass); }, endPass() {}, draw() { hooks.push('draw'); },
      upload(bytes) { hooks.push(bytes); } };
    calls.length = 0; r.render(3, 2);
    assert.deepEqual(calls, baseline, 'diagnostic hooks must not change GL submissions/state');
    assert.deepEqual(hooks.filter(v => v !== 'draw'), quality === 0 ? ['frame', 'scene', 'post'] : ['frame', 'shadow', 'scene', 'bloom', 'post']);
    assert.equal(hooks.filter(v => v === 'draw').length, quality === 0 ? 2 : 5, 'fullscreen triangles are counted too');
    const bucket = { dirty: true, n: 2, data: new Float32Array(44), mesh: 'box', source: 'box' };
    Object.getPrototypeOf(r).upload.call(r, { box: bucket });
    assert.equal(hooks.at(-1), 176, 'instance upload bytes use the actual submitted slice');
    r.meshes = { box: { count: 3, vao: {} } };
    let submitted;
    r.diagnostics.draw = (...args) => { submitted = args; };
    Object.getPrototypeOf(r).drawBatches.call(r, { box: bucket });
    assert.deepEqual(submitted, [3, 2]);
  }
});

test('crystal shader preserves facets and adds texture-free internal depth', () => {
  const {context}=setup(),shader=vm.runInContext('FRAG',context);
  assert.match(shader,/float facet=\.58\+\.42\*abs\(dot\(localN/);
  assert.match(shader,/float caustic=pow\(\.5\+\.5\*sin\(dot\(v_modelPos/);
  assert.match(shader,/glowMix=clamp\(v_glow,0\.,1\.\)\*\(1\.-crystal\*\.58\)/);
  assert.ok(shader.includes('float mask=1.-smoothstep(.02,.5,length(v_modelPos.xz));'));
  assert.ok(shader.includes('v_col.a*mask*.16*visible'));
  assert.doesNotMatch(shader,/sampler2D u_crystal/,'crystal depth adds no texture or render pass');
});

test('portal surface clock follows simulation time, not wall time, and freezes in Performance and menus', () => {
  const {r,calls}=setup();r.resize();
  for (const [quality,cinema,wall,simulation,expected] of [
    [1,false,80,4,4],[1,false,81,4,4],[2,false,82,5,5],[0,false,83,6,0],[1,true,84,7,0]
  ]) {
    r.quality=quality;r.cinema=cinema;calls.length=0;r.render(wall,simulation);
    assert.ok(calls.some(c=>c[0]==='uniform1f'&&c[1]==='u_portalTime'&&c[2]===expected));
    assert.ok(calls.some(c=>c[0]==='uniform1f'&&c[1]==='u_time'&&c[2]===wall), 'other shader clocks remain unchanged');
  }
});

test('scenery fog extent is bound independently from the playable map extent',()=>{
  const {r,calls}=setup();r.extent=90;r.resize();r.camera(0,0,57);r.fogTex={};r.fogSize=1;
  const extent=r.extent;r.fog(new Uint8Array(16),4,extent+20);calls.length=0;r.bindSceneProgram(0,0);
  assert.ok(calls.some(c=>c[0]==='uniform1f'&&c[1]==='u_extent'&&c[2]===extent));
  assert.ok(calls.some(c=>c[0]==='uniform1f'&&c[1]==='u_fogExtent'&&c[2]===extent+20));
  assert.equal(r.extent,extent);
});

test('fog texture reallocates only on grid-size changes, including odd row widths', () => {
  const {r,calls}=setup();r.fogTex={};r.fogSize=1;
  let previous=1;
  for(const size of [72,72,108,108,109,72]) {
    calls.length=0;
    const data=new Uint8Array(size*size);r.fog(data,size);
    assert.equal(r.fogSize,size);
    assert.deepEqual(calls[0],['bindTexture','TEXTURE_2D',r.fogTex]);
    assert.deepEqual(calls[1],['pixelStorei','UNPACK_ALIGNMENT',1]);
    assert.deepEqual(calls[2], previous===size
      ? ['texSubImage2D','TEXTURE_2D',0,0,0,size,size,'RED','UNSIGNED_BYTE',data]
      : ['texImage2D','TEXTURE_2D',0,'R8',size,size,0,'RED','UNSIGNED_BYTE',data]);
    assert.equal(calls.length,3);previous=size;
  }
});

test('map render profiles select cached textures and independent decor uniforms without uploads', () => {
  const h = setup(); h.r.resize();
  h.r.groundTex = 'dirt'; h.r.metalTex = 'metal'; h.r.bioTex = 'bio'; h.r.skyTex = 'sky';
  for (const texture of ['ground', 'metal', 'bio']) {
    h.calls.length = 0;
    h.r.setBattlefieldProfile({ groundTexture: texture, skyTexture: 'sky', groundMetersPerTile: [9, 12],
      rockDecor: { density: 0, opacity: .3 }, shrubDecor: { density: .6, opacity: 0 }, haze: [0, 0, 0] }, 1409);
    h.r.render(0);
    assert.ok(h.calls.some(c => JSON.stringify(c) === JSON.stringify(['uniform2fv', 'u_groundTile', [9, 12]])));
    const style = vm.runInContext(`surfaceWorldStyle('${texture}', 1409)`, h.context);
    assert.ok(h.calls.some(c => JSON.stringify(c) === JSON.stringify(['uniform3fv', 'u_surfaceTint', style.tint])));
    assert.ok(h.calls.some(c => JSON.stringify(c) === JSON.stringify(['uniform4f', 'u_groundDecor', 0, .6, .3, 0])));
    const slot = h.calls.findIndex(c => c[0] === 'activeTexture' && c[1] === 'TEXTURE2');
    assert.deepEqual(h.calls[slot + 1], ['bindTexture', 'TEXTURE_2D', h.r[`${texture}Tex`]]);
    assert.ok(!h.calls.some(c => ['texImage2D', 'createTexture'].includes(c[0])));
  }
  const frag = vm.runInContext('FRAG', h.context);
  for (const component of ['x','y','z','w']) assert.ok(frag.includes('u_groundDecor.' + component));
});

test('atmosphere uniforms follow the world on all qualities and reset for previews without resource uploads', () => {
  const h=setup();h.r.resize();
  const base=h.r.battlefieldProfile, atmosphere={timeOfDay:7,horizon:[.68,.34,.23],zenith:[.12,.20,.34]};
  for(const quality of [0,1,2]) for(const active of [true,false]) {
    h.r.quality=quality;
    h.r.setBattlefieldProfile(active?{...base,atmosphere}:base);
    h.calls.length=0;h.r.render(0);
    const flags=h.calls.filter(c=>c[0]==='uniform1f'&&c[1]==='u_atmosphereOn');
    assert.ok(flags.length>=2,'scene and post use the same profile');
    assert.ok(flags.every(c=>c[2]===(active?1:0)));
    if(active) assert.ok(h.calls.some(c=>JSON.stringify(c)===JSON.stringify(['uniform3fv','u_atmosphereHorizon',atmosphere.horizon])));
    assert.ok(!h.calls.some(c=>['texImage2D','createTexture','bufferData'].includes(c[0])));
  }
  h.r.setBattlefieldProfile({...base,atmosphere});h.r.useModelPreview();
  assert.equal(h.r.battlefieldProfile.atmosphere,undefined);
});

test('dedicated rock material is opt-in and resets on profile changes without texture uploads', () => {
  const h = setup(); h.r.resize();
  h.r.desertRockTex = 'desert-stone'; h.r.groundTex = 'dirt'; h.r.bioTex = 'bio'; h.r.metalTex = 'metal';
  const rockSurface = { texture: 'desertRock', metersPerTile: 18 };
  for (const [groundTexture, surface] of [['ground', rockSurface], ['bio', undefined], ['ground', rockSurface], ['metal', undefined], ['ground', undefined]]) {
    h.r.battlefieldProfile = { ...h.r.battlefieldProfile, groundTexture, rockSurface: surface };
    h.calls.length = 0; h.r.render(0);
    assert.ok(h.calls.some(c => c[0] === 'uniform1f' && c[1] === 'u_rockScale' && c[2] === (surface ? 1 / 18 : 0)));
    const slot = h.calls.findIndex(c => c[0] === 'activeTexture' && c[1] === 'TEXTURE7');
    assert.deepEqual(h.calls[slot + 1], ['bindTexture', 'TEXTURE_2D', h.r[`${surface?.texture ?? groundTexture}Tex`]]);
    assert.ok(h.calls.some(c => c[0] === 'uniform1i' && c[1] === 'u_rockTex' && c[2] === 7));
    assert.ok(!h.calls.some(c => ['texImage2D', 'createTexture'].includes(c[0])));
  }
  const { FRAG } = vm.runInContext('({FRAG})', h.context);
  assert.ok(FRAG.includes('if(u_rockScale>0.&&((v_mat>3.5&&v_mat<4.5&&v_glow<.2&&v_col.a>.96)||(v_mat>5.5&&v_mat<6.5)))'));
  const material = FRAG.slice(FRAG.indexOf('vec3 rockSurface'), FRAG.indexOf('const vec4 rockClustersRects'));
  assert.ok(material.includes('vec3 p=v_pos*u_rockScale;'));
  for (const projection of ['zy', 'xz', 'xy']) assert.ok(material.includes(`texture(u_rockTex,p.${projection})`));
  assert.ok(material.includes('groundBase(v_pos.xz)'), 'rock foot blends with the local ground');
  assert.doesNotMatch(material, /mod\(|fract\(|u_time|u_eye|u_decorSeed/, 'no mirrored tiling or moving detail');
});

test('upland weathering is opt-in, resets on map changes and needs no foliage image',()=>{
  const h=setup(),maps=loadScripts(['core','content',...BATTLEFIELD_SCRIPTS]);h.r.resize();
  for(const map of ['frontier','mothership','westmark','desert','haven','frontier']) {
    const profile=vm.runInContext(`BATTLEFIELDS['${map}'].render`,maps);
    h.r.setBattlefieldProfile(profile,1409);h.calls.length=0;h.r.render(0);
    assert.ok(h.calls.some(c=>c[0]==='uniform1f'&&c[1]==='u_upland'&&c[2]===(profile.upland?1:0)));
    const textures=h.r.textureNames(profile);
    if(profile.upland) {
      assert.ok(textures.has('westmarkEarth')&&textures.has('westmarkBark'));
      assert.ok(!textures.has('westmarkSpruce'),'opaque procedural crowns do not decode branch cards');
      assert.deepEqual(h.r.textureNames({...profile,landscape:{...profile.landscape,foliage:undefined}}),textures);
    }
    assert.ok(!h.calls.some(c=>['texImage2D','createTexture','bufferData'].includes(c[0])));
  }
});

test('ecology uniforms reset, leaf shadows share displacement and Performance omits only detail meshes',()=>{
  const h=setup();h.r.cinema=false;
  const profile=vm.runInContext("battlefieldEcology({...DEFAULT_TERRAIN_RENDER_PROFILE,wilderness:'rime'},1409)",h.context);
  h.r.setBattlefieldProfile(profile,1409);
  for(const quality of [0,1,2]){
    h.r.quality=quality;h.r.resize();h.calls.length=0;h.r.render(1,7.5);
    const winds=h.calls.filter(c=>c[0]==='uniform2f'&&c[1]==='u_wind');
    assert.equal(winds.length,quality?2:1,'scene and optional shadow pass, without a gameplay sky');
    assert.ok(winds.every(c=>c[2]===(quality?profile.ecology.wind:0)&&c[3]===7.5));
    assert.ok(h.calls.some(c=>c[0]==='uniform4f'&&c[1]==='u_ecology'&&c[2]===3&&c[3]===3));
    assert.ok(!h.calls.some(c=>['texImage2D','createTexture','bufferData'].includes(c[0])));
  }
  const {VERT,DEPTHV,ECOLOGY_WIND}=vm.runInContext('({VERT,DEPTHV,ECOLOGY_WIND})',h.context);
  assert.ok(VERT.includes(ECOLOGY_WIND)&&DEPTHV.includes(ECOLOGY_WIND));
  h.r.setBattlefieldProfile(vm.runInContext('DEFAULT_TERRAIN_RENDER_PROFILE',h.context));h.calls.length=0;h.r.render(1,7.5);
  assert.ok(h.calls.filter(c=>c[0]==='uniform4f'&&c[1]==='u_ecology').every(c=>c.slice(2).every(v=>v===0)));
  assert.ok(h.calls.filter(c=>c[0]==='uniform2f'&&c[1]==='u_wind').every(c=>c[2]===0));
  h.r.meshes={tuft:{count:6,vao:{}},landmark:{count:12,vao:{}}};h.r.detailMeshes=new Set(['tuft']);
  const buckets={tuft:{n:1,source:'tuft',mesh:'tuft'},landmark:{n:1,source:'landmark',mesh:'landmark'}};
  for(const quality of [0,1,2]){
    h.r.quality=quality;h.calls.length=0;Object.getPrototypeOf(h.r).drawBatches.call(h.r,buckets);
    assert.deepEqual(h.calls.filter(c=>c[0]==='drawArraysInstanced').map(c=>c[3]),quality?[6,12]:[12]);
  }
});

test('lighting profiles override shader colors without additional textures or render passes',()=>{
  const {r,calls,context}=setup();r.resize();r.camera(0,0,57);
  const defaults=vm.runInContext('DEFAULT_LIGHTING',context);
  for(const lighting of [undefined,{sun:[1.12,.94,.76],sky:[.38,.47,.56],bounce:[.23,.18,.16]}]) {
    r.battlefieldProfile={...r.battlefieldProfile,lighting};calls.length=0;r.render(0);
    for(const [uniform,key] of [['u_sun','sun'],['u_skyLight','sky'],['u_bounce','bounce']])
      assert.deepEqual(Array.from(calls.find(c=>c[0]==='uniform3fv'&&c[1]===uniform)[2]),Array.from((lighting||defaults)[key]));
    assert.ok(calls.some(c=>c[0]==='uniform1f'&&c[1]==='u_shadowBias'&&c[2]===r.shadowBias));
    assert.equal(calls.filter(c=>c[0]==='program'&&c[1]==='shadow').length,1);
    assert.ok(!calls.some(c=>['texImage2D','createTexture'].includes(c[0])));
  }
  const override={sun:[.8,.9,1.3],sky:[.5,.3,.7],bounce:[.1,.2,.4]},
    profileBefore=JSON.stringify(r.battlefieldProfile);
  for (const quality of [0,1,2]) {
    r.quality=quality;
    for (const light of [override,undefined]) {
      calls.length=0;r.bindSceneProgram(12,4,r.program,light);
      for (const [uniform,key] of [['u_sun','sun'],['u_skyLight','sky'],['u_bounce','bounce']])
        assert.deepEqual(Array.from(calls.find(c=>c[0]==='uniform3fv'&&c[1]===uniform)[2]),
          Array.from((light||r.battlefieldProfile.lighting)[key]),'binding overrides never leak to subsequent default bindings');
    }
  }
  assert.equal(JSON.stringify(r.battlefieldProfile),profileBefore);
  const {FRAG,VERT}=vm.runInContext('({FRAG,VERT})',context);
  assert.match(FRAG,/float metal=.*v_mat>1.5/);assert.match(FRAG,/strength=\.008\+metal/);
  assert.ok(FRAG.indexOf('lit=finishLighting(lit)')<FRAG.indexOf('float field='),'compress highlights before fog and RGBA8 storage');
  assert.match(FRAG,/over\/\(1\.\+over\/\.35\)/);
  assert.match(VERT,/if\(a_material==-1\.\|\|a_material==-4\.\)v_modelPos=a_pos/);
  const contact=FRAG.slice(FRAG.indexOf('if(v_mat==-1.)'),FRAG.indexOf('if(v_mat==-4.)'));
  assert.match(contact,/smoothstep\(\.05,1\.,length\(v_modelPos.xz\*2\.\)\)/);
  assert.match(contact,/smoothstep\(\.35,\.8,sight\)/);
  assert.doesNotMatch(contact,/shadow\(|u_metalTex|u_groundTex/);
});

test('placement guide remains fog-gated and derivative-filtered without shading the cell interior', () => {
  const {context}=setup(), fragment=vm.runInContext('FRAG',context);
  const guide=fragment.slice(fragment.indexOf('if(v_mat==-9.)'),fragment.indexOf('if(v_mat==-1.)'));
  assert.match(guide,/battlefieldFog\(v_pos\.xz\)/);
  assert.match(guide,/step\(\.75,sight\)/);
  assert.match(guide,/fract\(/);
  assert.match(guide,/fwidth\(/);
  assert.match(guide,/line=.*smoothstep\(/);
  assert.match(guide,/q=v_pos\.xz\/3\./);
  assert.match(guide,/finePixel=pixel\*2\./);
  assert.match(guide,/max\(finePixel\.x,finePixel\.y\)/,'fine lines have their own density filter');
  assert.match(guide,/line=max\(line,fineLine\*u_placementGridDetail\)/,'nested lines do not double opacity');
  assert.match(guide,/frag=vec4\(v_col\.rgb,v_col\.a\*line\*/);
  assert.doesNotMatch(guide,/shadow\(|groundBase|u_groundTex/);
});

test('placement guide fades in half-spacing lines between gameplay zoom endpoints', () => {
  const {r}=setup();r.resize();
  const values=[];
  for(const zoom of [150,115,71.1,27.2,20]) {
    r.camera(0,0,zoom);values.push(r.placementGridDetail);
  }
  assert.equal(values[0],0);assert.equal(values[1],0);
  assert.ok(Math.abs(values[2]-.5)<1e-9);
  assert.equal(values[3],1);assert.equal(values[4],1);
  r.camera(0,0,27.2,true);assert.equal(r.placementGridDetail,0,'menu cameras do not enable finer lines');
});

test('menu camera keeps its gentle orbit at the increased rate', () => {
  const h = setup(), speed = vm.runInContext('CINEMA_ORBIT_SPEED', h.context);
  assert.equal(speed, .04);
  h.r.resize();
  h.r.camera(0, 0, 65, true, Math.PI / (2 * speed));
  assert.ok(Math.abs(h.r.eye[0] - 70) < 1e-9);
  assert.ok(Math.abs(h.r.eye[2] - 78) < 1e-9);
});

test('menu camera follows raised terrain at its target and stays above hills throughout its orbit', () => {
  const {r}=setup();r.resize();
  for(const sample of [()=>36,(x,z)=>Math.hypot(x,z)>70?65:12]) {
    r.surface={heightAt:sample};
    for(const t of [0,25,50,75,100,125,150]) {
      r.camera(0,0,65,true,t);
      assert.ok(r.eye[1]>=sample(r.eye[0],r.eye[2])+24,'never orbit under the terrain');
      assert.ok(r.eye[1]>=sample(0,-4)+24,'retain height above the preview target');
      const p=r.project(0,sample(0,-4)+7,-4);
      assert.ok(Math.abs(p.x-(r.viewport.left+r.viewport.width/2))<1e-3);
      assert.ok(Math.abs(p.y-(r.viewport.top+r.viewport.height/2))<1e-3);
      assert.ok(Array.from(r.lightVP).every(Number.isFinite));
    }
  }
  r.camera(3,7,65);
  assert.deepEqual(Array.from(r.eye),[3,65*1.1,7+65*.82],'gameplay camera is unchanged');
});

test('rotated gameplay camera preserves its pivot and projection/picking roundtrips', () => {
  const {r}=setup(); r.resize();
  for (const yaw of [0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    r.camera(3,7,57,false,0,yaw);
    assert.ok(Math.abs(r.eye[0] - (3 + Math.sin(yaw) * 57 * .82)) < 1e-9);
    assert.ok(Math.abs(r.eye[2] - (7 + Math.cos(yaw) * 57 * .82)) < 1e-9);
    const pivot = r.project(3,0,7);
    assert.ok(Math.abs(pivot.x - (r.viewport.left + r.viewport.width / 2)) < 1e-3);
    assert.ok(Math.abs(pivot.y - (r.viewport.top + r.viewport.height / 2)) < 1e-3);
    for (const [x,z] of [[3,7],[-10,15],[20,-8]]) {
      const p=r.project(x,0,z), ground=r.ground(p.x,p.y,false);
      assert.ok(Math.abs(ground.x-x)<1e-3 && Math.abs(ground.z-z)<1e-3);
    }
    assert.ok(Array.from(r.lightVP).every(Number.isFinite));
  }
});

test('camera rotation holds the central terrain anchor across heights, slopes and consecutive input before rendering', () => {
  const {r,context}=setup({viewport:{left:17,top:63,width:800,height:428},
    scripts:['battlefield-surface','world','ui-core','ui-actions','ui-input']}),
    Surface=vm.runInContext('BattlefieldSurface',context), UI=vm.runInContext('MeridianUI',context);
  r.resize();
  const ui=Object.create(UI.prototype);
  ui.R=r;ui.game={world:{extent:180},s:{cam:{x:3,z:7,zoom:57,yaw:0}}};
  const v=r.viewport,sx=v.left+v.width/2,sy=v.top+v.height/2;
  for(const sample of [()=>0,()=>20,(x,z)=>30+.1*x+.2*z]) {
    r.surface=new Surface(180,2.5,sample);
    const cam=ui.game.s.cam;Object.assign(cam,{x:3,z:7,zoom:57,yaw:0});
    r.camera(cam.x,cam.z,cam.zoom,false,0,cam.yaw);
    const anchor=r.ground(sx,sy),height=r.surface.heightAt(anchor.x,anchor.z);
    // Zoom changes and stale projections must not displace the anchor.
    for(const [delta,zoom] of [[Math.PI/2,27.2],[-.3,115],[Math.PI,57],[.2,57]]) {
      cam.zoom=zoom;ui.rotateCamera(delta);
      r.camera(cam.x,cam.z,cam.zoom,false,0,cam.yaw);
      const p=r.project(anchor.x,height,anchor.z);
      assert.ok(Math.hypot(p.x-sx,p.y-sy)<.003,'original terrain point stays central');
      // Leave the renderer stale for the next input.
      r.camera(-20,-30,40,false,0,0);
    }
    // A pan changes the anchor; rotation must use that new camera position.
    cam.x+=5;cam.z-=4;
    r.camera(cam.x,cam.z,cam.zoom,false,0,cam.yaw);
    const panned=r.ground(sx,sy),pannedHeight=r.surface.heightAt(panned.x,panned.z);
    r.camera(-20,-30,40,false,0,0);
    ui.rotateCamera(.6);r.camera(cam.x,cam.z,cam.zoom,false,0,cam.yaw);
    const p=r.project(panned.x,pannedHeight,panned.z);
    assert.ok(Math.hypot(p.x-sx,p.y-sy)<.003,'panned terrain anchor stays central');
    assert.ok(Math.abs(cam.x)<162&&Math.abs(cam.z)<162);
  }
  r.surface=new Surface(180,2.5,()=>20);
  ui.game.world.surface=r.surface;
  Object.assign(ui.game.s.cam,{x:162,z:162,yaw:0});
  ui.rotateCamera(Math.PI);
  r.camera(ui.game.s.cam.x,ui.game.s.cam.z,ui.game.s.cam.zoom,false,0,ui.game.s.cam.yaw);
  const center=r.ground(sx,sy);
  assert.ok(Math.abs(center.x)<180&&Math.abs(center.z)<180,'bounds take precedence and keep the central terrain anchor on-map');
});

test('terrain camera focus frames elevated start and home targets at every heading', () => {
  const {r,context}=setup({viewport:{left:0,top:63,width:800,height:428},
    scripts:['battlefield-surface','world','ui-core','ui-actions']}),
    Surface=vm.runInContext('BattlefieldSurface',context), UI=vm.runInContext('MeridianUI',context),
    ui=Object.create(UI.prototype);
  r.resize();ui.R=r;ui.game={world:{extent:180},s:{cam:{zoom:57,yaw:0}}};
  const target={x:10,z:30},v=r.viewport;
  for(const height of [0,20,72]) for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/4]) {
    r.surface=new Surface(180,2.5,()=>height);ui.game.s.cam.yaw=yaw;
    const point=ui.terrainCameraPoint(target,height);
    r.camera(point.x,point.z,57,false,0,yaw);
    const p=r.project(target.x,height,target.z);
    assert.ok(Math.hypot(p.x-(v.left+v.width/2),p.y-(v.top+v.height/2))<.003,
      'elevated focus is centered rather than projecting toward the upper edge');
  }
});

test('camera can reach all map edges without centering exterior scenery across zoom, elevation and headings', () => {
  for (const viewport of [{left:0,top:55,width:390,height:518},{left:17,top:63,width:1000,height:401.5}]) {
    const {r,context}=setup({viewport,scripts:['battlefield-surface','world','ui-core','ui-actions']}),
      Surface=vm.runInContext('BattlefieldSurface',context), UI=vm.runInContext('MeridianUI',context),
      ui=Object.create(UI.prototype);
    r.resize();ui.R=r;ui.game={world:{extent:180},s:{cam:{zoom:115,yaw:0}}};
    for (const height of [0,20,72]) {
      r.surface=new Surface(180,2.5,()=>height);ui.game.world.surface=r.surface;
      for (const yaw of [0,Math.PI/4,Math.PI/2,Math.PI,-Math.PI/2]) {
        ui.game.s.cam.yaw=yaw;
        for (const [x,z] of [[-180,-180],[180,-180],[-180,180],[180,180],[0,-180],[0,180]]) {
          for (const zoom of [115,27.2]) {
            const cam=ui.game.s.cam;cam.zoom=zoom;
            const focus=ui.terrainCameraPoint({x,z},height);
            ui.center(focus.x,focus.z);r.camera(cam.x,cam.z,zoom,false,0,yaw);
            const p=r.project(x,height,z),v=r.viewport;
            assert.ok(p.x>v.left&&p.x<v.right&&p.y>v.top&&p.y<v.bottom,
              'map edge remains reachable inside the visible rectangle');
            // Stay inside the surface for ray intersections at floating-point boundaries.
            const px=x*.98,pz=z*.98,pick=r.project(px,height,pz),hit=r.ground(pick.x,pick.y);
            assert.ok(Math.hypot(hit.x-px,hit.z-pz)<.003,'buildable edge terrain remains pickable');
          }
        }
        ui.center(1e6,-1e6);
        const cam=ui.game.s.cam,v=r.viewport;
        r.camera(cam.x,cam.z,cam.zoom,false,0,yaw);
        const anchor=r.ground(v.left+v.width/2,v.top+v.height/2);
        assert.ok(Math.abs(anchor.x)<=180.003&&Math.abs(anchor.z)<=180.003,'central terrain anchor stays on-map');
      }
    }
  }
});

test('bottom camera limit uses local terrain and viewport size, not the highest mountain', () => {
  const {r,context}=setup({viewport:{left:0,top:63,width:1600,height:428},
    scripts:['battlefield-surface','world','ui-core','ui-actions']}),
    Surface=vm.runInContext('BattlefieldSurface',context), UI=vm.runInContext('MeridianUI',context),ui=Object.create(UI.prototype);
  r.resize();r.surface=new Surface(180,2.5,(x,z)=>z<0?72:20);
  ui.R=r;ui.game={world:{extent:180,surface:r.surface},s:{cam:{zoom:115,yaw:0}}};
  for(const zoom of [115,27.2]) {
    ui.game.s.cam.zoom=zoom;ui.center(0,1e6);
    const cam=ui.game.s.cam,v=r.viewport;r.camera(cam.x,cam.z,zoom);
    let outside=0,total=0;
    for(let y=0;y<20;y++)for(let x=0;x<20;x++) {
      const p=r.ground(v.left+(x+.5)*v.width/20,v.top+(y+.5)*v.height/20);
      total++;if(Math.abs(p.x)>180||Math.abs(p.z)>180)outside++;
    }
    assert.ok(outside/total<=.15,'exterior cannot occupy most of the view at the lower limit');
    const edge=r.project(0,20,176);
    assert.ok(edge.y>v.top&&edge.y<v.bottom,'buildable bottom edge stays visible');
  }
  ui.zoomCamera(115);
  const before=ui.game.s.cam.z;ui.zoomCamera(27.2);ui.center(0,1e6);
  assert.ok(ui.game.s.cam.z>before,'close zoom allows approaching the edge again');
});

test('orthographic close zoom keeps raised terrain ahead of the camera without changing framing or picking',()=>{
  const maps=loadScripts(['core','content',...BATTLEFIELD_SCRIPTS]),Surface=vm.runInContext('BattlefieldSurface',maps);
  for(const height of [72,140])for(const viewport of [{left:0,top:55,width:390,height:518},{left:17,top:63,width:1000,height:401.5}]) {
    const {r,context}=setup({viewport}),M4=vm.runInContext('M4',context),surface=new Surface(180,2.5,()=>height);r.resize();
    for(const zoom of [27.2,57,115])for(const yaw of [0,Math.PI/4,Math.PI/2,Math.PI]) {
      r.surface=undefined;r.camera(3,7,zoom,false,0,yaw);
      const before=r.project(5,height,10);
      r.surface=surface;r.camera(3,7,zoom,false,0,yaw);
      assert.ok(r.eye[1]>height+24,'virtual eye stays above terrain and decorations at closest zoom');
      const p=r.project(5,height,10),hit=r.ground(p.x,p.y);
      assert.ok(Math.abs(p.x-before.x)<.001&&Math.abs(p.y-before.y)<.001,'retreat preserves screen framing');
      assert.ok(Math.hypot(hit.x-5,hit.z-10)<.001,'raised surface picking roundtrips');
      for(const [sx,sy] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        const a=M4.point(r.inverseVP,sx,sy,-1),b=M4.point(r.inverseVP,sx,sy,1);
        for(let i=0;i<3;i++){a[i]/=a[3];b[i]/=b[3];}
        for(const y of [0,height,height+24]) {
          const t=(y-a[1])/(b[1]-a[1]);
          assert.ok(t>0&&t<1,'every visible terrain/decoration height fits between the near and far planes');
        }
      }
    }
  }
});

test('fitted shadow projection covers ground and elevated view corners at zoom limits and different viewport shapes',()=>{
  for(const receiverHeight of [undefined,46]) for(const viewport of [{left:0,top:55,width:390,height:518},{left:17,top:63,width:1000,height:401.5}]) {
    const {r,context}=setup({viewport}),M4=vm.runInContext('M4',context);
    r.battlefieldProfile=receiverHeight?{terrainReceiverHeight:receiverHeight}:undefined; r.resize();
    for(const zoom of [27.2,57,115])for(const [x,z] of [[0,0],[-83,83],[83,-83]])for(const yaw of [0,Math.PI/4,Math.PI/2]) {
      r.camera(x,z,zoom,false,0,yaw);
      assert.ok(Array.from(r.lightVP).every(Number.isFinite));assert.ok(r.shadowBias>0&&r.shadowBias<.001);
      for(const [sx,sy] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        const a=M4.point(r.inverseVP,sx,sy,-1),b=M4.point(r.inverseVP,sx,sy,1);
        for(let i=0;i<3;i++){a[i]/=a[3];b[i]/=b[3];}
        for(const height of [0,receiverHeight??32]) {
          const t=(height-a[1])/(b[1]-a[1]),p=[a[0]+(b[0]-a[0])*t,height,a[2]+(b[2]-a[2])*t],q=M4.point(r.lightVP,...p);
          for(let i=0;i<3;i++)assert.ok(Math.abs(q[i]/q[3])<1,`clipped receiver ${p}: ${q}`);
        }
      }
    }
    r.camera(0,0,48);
    const scale=Math.hypot(r.lightVP[0],r.lightVP[4],r.lightVP[8]);
    assert.ok(scale>1/78,'closer views spend the same 1536 shadow texels on a smaller area');
    const before=Array.from(r.lightVP);r.camera(0,0,48);assert.deepEqual(Array.from(r.lightVP),before);
    let previous=M4.point(r.lightVP,0,0,0);
    for(let i=1;i<=60;i++) {
      r.camera(i*.003,i*.002,48);
      const q=M4.point(r.lightVP,0,0,0);
      for(let axis=0;axis<2;axis++) {
        const pixels=(q[axis]-previous[axis])*r.shadowSize/2;
        assert.ok(Math.abs(pixels-Math.round(pixels))<.005,'panning moves the shadow grid only in whole texels');
      }
      previous=q;
    }
    assert.equal(r.shadowSize,1536);
    r.quality=0;r.fitShadow=()=>{throw Error('Performance should skip shadow fitting');};
    r.camera(0,0,48);assert.deepEqual(Array.from(r.lightVP),Array.from(M4.identity()));
  }
});

test('medium/high select the largest common sample count up to 4 and retain resolution scaling', () => {
  for (const [quality, width, height] of [[1, 800, 600], [2, 1280, 960]]) {
    const h = setup(); h.r.quality = quality; h.r.resize();
    assert.equal(h.r.sceneSamples, 4);
    assert.deepEqual(h.calls.filter(c => c[0] === 'storage'), [
      ['storage', 4, 'RGBA8', width, height], ['storage', 4, 'DEPTH_COMPONENT24', width, height]
    ]);
    assert.deepEqual(h.r.canvas, { width, height });
    assert.deepEqual(h.bindings(), { draw: null, read: null, buffer: null });
  }
});

test('scene targets use canvas CSS bounds, while projection and picking retain client coordinates at every quality', () => {
  for (const viewport of [
    { left: 0, top: 55, width: 390, height: 518 },
    { left: 17, top: 63, width: 1000, height: 401.5 }
  ]) for (const quality of [0, 1, 2]) {
    const h = setup({ viewport }), r = h.r; r.quality = quality; r.resize();
    const scale = quality === 0 ? .75 : quality === 1 ? 1 : 1.6;
    assert.equal(r.width, Math.round(viewport.width * scale));
    assert.equal(r.height, Math.round(viewport.height * scale));
    assert.equal(r.sceneDepth.width, r.width); assert.equal(r.sceneDepth.height, r.height);
    r.camera(-48, 40, 57);
    const center = r.project(-48, 0, 40);
    assert.ok(Math.abs(center.x - viewport.left - viewport.width / 2) < .001);
    assert.ok(Math.abs(center.y - viewport.top - viewport.height / 2) < .001);
    assert.ok(Math.abs(r.project(-47, 0, 40).x - center.x - h.context.innerHeight / 57) < .001,
      'shorter viewport must not shrink units at the same zoom');
    const v = r.viewport;
    for (const [x, y] of [[v.left,v.top], [v.right,v.top], [v.right,v.bottom],
      [v.left,v.bottom], [center.x,center.y], [v.left-50,v.bottom+50]]) {
      const world = r.ground(x, y), screen = r.project(world.x, 0, world.z);
      assert.ok(Math.abs(screen.x - x) < .001); assert.ok(Math.abs(screen.y - y) < .001);
    }
    assert.equal(r.containsPoint(center.x, center.y), true);
    for (const [x,y] of [[v.left,center.y], [v.right,center.y], [center.x,v.top],
      [center.x,v.bottom], [center.x,v.top-1], [center.x,v.bottom+1]])
      assert.equal(r.containsPoint(x,y), false);
    // A position-only layout change must refresh offsets, not just buffer size.
    h.options.viewport = { ...viewport, top: viewport.top + 12 };
    r.resize(); r.camera(-48, 40, 57);
    assert.ok(Math.abs(r.project(-48, 0, 40).y - center.y - 12) < .001);
    h.options.viewport = { ...viewport, height: viewport.height / 2 };
    r.resize(); r.camera(-48, 40, 57);
    assert.ok(Math.abs(r.project(-47, 0, 40).x - r.project(-48, 0, 40).x - h.context.innerHeight / 57) < .001);
  }
});

test('sample selection respects both formats and falls back without supported multisampling', () => {
  for (const [color, depth, expected] of [
    [[4, 2], [2], 2], [[4], [2], 0], [[], [], 0], [[8], [8], 0], [[1], [1], 0]
  ]) {
    const h = setup({ color, depth }); h.r.resize(); assert.equal(h.r.sceneSamples, expected);
    assert.equal(!!h.r.sceneMSAAFbo, expected > 0);
    assert.equal(h.framebuffers.size, expected ? 4 : 3);
    assert.equal(h.buffers.size, expected ? 3 : 1);
  }
});

test('incomplete 4x target is released before retrying supported 2x', () => {
  const h = setup({ reject: n => n === 4 }); h.r.resize();
  assert.equal(h.r.sceneSamples, 2);
  assert.deepEqual(h.calls.filter(c => c[0] === 'storage').map(c => c[1]), [4, 4, 2, 2]);
  assert.equal(h.framebuffers.size, 4); assert.equal(h.buffers.size, 3);
});

test('incomplete targets and null GPU allocations leave a clean single-sample fallback', () => {
  for (const failure of [{ reject: () => true }, { failFramebuffer: true }, { failRenderbuffer: true }]) {
    const h = setup(); Object.assign(h.options, failure); h.r.resize();
    assert.equal(h.r.sceneSamples, 0); assert.equal(h.r.sceneMSAAFbo, null);
    assert.equal(h.r.sceneMSAAColor, null); assert.equal(h.r.sceneMSAADepth, null);
    assert.equal(h.framebuffers.size, failure.failFramebuffer ? 1 : 3); assert.equal(h.buffers.size, 1);
    assert.deepEqual(h.bindings(), { draw: null, read: null, buffer: null });
  }
});

test('unchanged resize preserves targets and fallbacks while refreshing client offsets', () => {
  for (const failure of [{}, { reject: () => true, rejectBloom: true }]) {
    const h = setup(failure), r = h.r;
    h.context.devicePixelRatio = 1;
    r.resize();
    const targets = [r.sceneMSAAFbo, r.sceneMSAAColor, r.sceneMSAADepth, ...r.bloomTargets],
      counts = [h.framebuffers.size, h.buffers.size, h.textures.size];
    let environmentResizes = 0;
    r.environment = { resize() { environmentResizes++; } };
    h.calls.length = 0;
    h.options.viewport = { left: 17, top: 63, width: 800, height: 600 };
    r.resize(); r.resize();
    assert.deepEqual([r.sceneMSAAFbo, r.sceneMSAAColor, r.sceneMSAADepth, ...r.bloomTargets], targets);
    assert.deepEqual([h.framebuffers.size, h.buffers.size, h.textures.size], counts);
    assert.equal(h.calls.length, 0, 'same-sized resize performs no GL work, even after fallback');
    assert.equal(environmentResizes, 0, 'city depth target is not invalidated');
    r.camera(0, 0, 57);
    const center = r.project(0, 0, 0);
    assert.ok(Math.abs(center.x - 417) < .001 && Math.abs(center.y - 363) < .001);
    const ground = r.ground(center.x, center.y);
    assert.ok(Math.abs(ground.x) < .001 && Math.abs(ground.z) < .001);
    h.calls.length = 0;
    r.quality = 1; r.resize();
    assert.ok(h.calls.some(c => c[0] === 'texImage2D'), 'quality change rebuilds even at DPR 1 with unchanged dimensions');
    assert.equal(environmentResizes, 1);
  }
});

test('resize and quality switches release old attachments and rebuild matching dimensions', () => {
  const h = setup(); h.r.resize(); const old = h.r.sceneMSAAFbo;
  h.context.innerWidth = 1000; h.context.innerHeight = 700; h.r.resize();
  assert.ok(!h.framebuffers.has(old));
  assert.equal(h.r.sceneMSAAColor.width, 1600); assert.equal(h.r.sceneMSAADepth.height, 1120);
  h.r.quality = 0; h.r.resize();
  assert.equal(h.r.sceneSamples, 0); assert.deepEqual(h.r.canvas, { width: 750, height: 525 });
  assert.equal(h.framebuffers.size, 1); assert.equal(h.buffers.size, 1);
  h.r.quality = 1; h.r.resize();
  assert.equal(h.r.sceneSamples, 4); assert.equal(h.r.sceneMSAAColor.width, 1000);
  assert.equal(h.framebuffers.size, 4); assert.equal(h.buffers.size, 3);
});

test('local diffuse lighting respects current fog visibility and has a no-light fast path',()=>{
  const context=loadScripts(RENDERER_SCRIPTS),shader=vm.runInContext('FRAG',context);
  assert.ok(shader.includes('if(u_pointLightCount==0)return vec3(0.);'));
  assert.ok(shader.includes('if(u_fogOn>.5)result*=smoothstep(.75,1.,sceneryFog(position.xz));'));
});

test('spatial light grid retains all lamps in battle, performance and cinema without extra passes',()=>{
  const h=setup(), r=h.r;
  Object.assign(r,{dynamic:{},effects:{},occlusion:{},colors:new Map(),extent:64});
  for(const quality of [0,1,2]) for(const cinema of [false,true]) {
    r.begin();r.quality=quality;r.cinema=cinema;
    for(let i=0;i<40;i++)r.addPointLight(i-20,2,0,8,0x75dce9,3);
    assert.equal(r.pointLightCount,40,'no lamp is evicted by another entity');
    r.preparePointLights();
    const state=r.lightGrid, cellWidth=r.extent*2/state.size;
    for(let i=0;i<40;i++) {
      const x=i-20;
      for(const receiver of [x-7.9,x,x+7.9]) {
        const cx=Math.floor((receiver+r.extent)/cellWidth),cz=Math.floor(r.extent/cellWidth),
          o=(cz*state.size+cx)*4,offset=state.gridData[o],count=state.gridData[o+1];
        const lamps=Array.from({length:count},(_,j)=>state.lampData[(offset+j*2)*4]);
        assert.ok(lamps.includes(x),'lamp reaches all intersecting receiver cells');
      }
    }
    const grid=state.grid,lamps=state.lamps;
    h.calls.length=0;r.bindSceneProgram(0,0);
    assert.ok(!h.calls.some(c=>c[0]==='texImage2D'||c[0]==='texSubImage2D'),'shader switches reuse uploads');
    r.begin();assert.equal(r.pointLightCount,0);
    r.addPointLight(0,2,0,8,0xffffff,3);r.preparePointLights();
    assert.equal(r.lightGrid.grid,grid);assert.equal(r.lightGrid.lamps,lamps,'texture objects are reused');
  }
  r.quality=2;r.cinema=false;r.resize();h.calls.length=0;r.render(0);
  assert.ok(h.calls.some(c=>c[0]==='uniform1i'&&c[1]==='u_pointLightCount'&&c[2]===1));
  assert.ok(h.calls.some(c=>c[0]==='uniform1f'&&c[1]==='u_lampPrefilter'&&c[2]===1));
  assert.equal(h.calls.filter(c=>c[0]==='quad'&&c[1]==='bloom').length,3);
  const p=Object.create(r);p.dynamic={};p.effects={};p.occlusion={};p.cinema=true;p.begin();
  assert.notEqual(p.pointLightPositions,r.pointLightPositions,'preview owns CPU storage');
  assert.equal(p.lightGrid,null,'preview does not inherit live GPU light storage');
  assert.equal(r.pointLightCount,1);assert.equal(p.pointLightCount,0);
  r.begin();r.vp=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  r.addPointLight(5,0,0,1,0xffffff,1);assert.equal(r.pointLightCount,0,'fully off-screen influence is culled');
  r.addPointLight(5,0,0,6,0xffffff,1);assert.equal(r.pointLightCount,1,'off-screen emitter can illuminate visible ground');
  r.setBattlefieldProfile(r.battlefieldProfile);assert.equal(r.pointLightCount,0,'world switch clears lights');
  const textures=h.textures.size;r.releasePointLights();assert.equal(h.textures.size,textures-2);
  r.releasePointLights();assert.equal(h.textures.size,textures-2,'release is idempotent');
});

test('light grid allocation failures are explicit and release partial resources',()=>{
  for(const failure of [{failTexture:true},{failTextureAt:2}]) {
    const h=setup(failure),r=h.r;
    Object.assign(r,{dynamic:{},effects:{},colors:new Map(),extent:64});r.begin();
    r.addPointLight(0,2,0,8,0xffffff,3);
    assert.throws(()=>r.preparePointLights(),/Could not allocate local light textures/);
    assert.equal(h.textures.size,0,'no orphaned partial allocation');
    assert.equal(r.lightGrid,null);assert.equal(r.lightGridDirty,true);
  }
  const h=setup(),r=h.r;
  h.g.getParameter=()=>4;
  Object.assign(r,{dynamic:{},effects:{},colors:new Map(),extent:64});r.begin();
  r.addPointLight(0,2,0,8,0xffffff,3);
  assert.throws(()=>r.preparePointLights(),/exceeds GPU texture capacity/);
  assert.equal(h.textures.size,0);
});

test('night bloom strengthens smoothly without changing passes or retaining preview lighting',()=>{
  const h=setup(); h.r.resize();
  const base=h.r.battlefieldProfile, targets=[...h.r.bloomTargets];
  for(const [hour,strength] of [[0,1.65],[5,1.65],[5.5,1.15],[6,.65],[12,.65],[18,.65],[18.5,1.15],[19,1.65]]) {
    h.r.setBattlefieldProfile({...base,atmosphere:{timeOfDay:hour,horizon:[.1,.1,.1],zenith:[.05,.05,.05]}});
    for(const cinema of [false,true]) {
      h.r.cinema=cinema;
      assert.ok(Math.abs(h.r.bloomStrength-strength)<1e-12,'night strength also applies in cinema');
      h.r.cinema=false;
      h.calls.length=0; h.r.render(0);
      const uniform=h.calls.find(c=>c[0]==='uniform1f'&&c[1]==='u_bloomStrength');
      assert.ok(Math.abs(uniform[2]-strength)<1e-12);
      assert.equal(h.calls.filter(c=>c[0]==='quad'&&c[1]==='bloom').length,3);
      assert.equal(h.r.bloomTargets.length,targets.length);
      h.r.bloomTargets.forEach((target,i)=>assert.equal(target,targets[i],'no extra targets for stronger night glow'));
    }
  }
  h.r.useModelPreview(); h.calls.length=0; h.r.render(0);
  assert.ok(h.calls.some(c=>c[0]==='uniform1f'&&c[1]==='u_bloomStrength'&&c[2]===.65));
});

test('bloom uses two quarter-size targets, three ordered passes and a clean allocation fallback',()=>{
  const h=setup();h.r.resize();
  assert.equal(h.r.bloomWidth,320);assert.equal(h.r.bloomHeight,240);assert.equal(h.textures.size,2);
  h.calls.length=0;h.r.render(0);
  const quads=h.calls.filter(c=>c[0]==='quad'&&c[1]==='bloom');
  assert.deepEqual(quads.map(c=>c[2]),[h.r.bloomTargets[0].fbo,h.r.bloomTargets[1].fbo,h.r.bloomTargets[0].fbo]);
  assert.ok(h.calls.indexOf(quads[0])>h.calls.findIndex(c=>c[0]==='resolve'));
  assert.ok(h.calls.indexOf(quads[2])<h.calls.findIndex(c=>c[0]==='quad'&&c[1]==='post'));
  assert.deepEqual(h.calls.filter(c=>c[0]==='uniform2f'&&c[1]==='u_step').map(c=>c.slice(2)),[[1/1280,1/960],[1/320,0],[0,1/240]]);
  for(const quality of [0,1,2,0,2]) {
    h.r.quality=quality;h.r.resize();assert.equal(h.textures.size,quality?2:0);
    h.calls.length=0;h.r.render(0);assert.equal(h.calls.filter(c=>c[0]==='quad'&&c[1]==='bloom').length,quality?3:0);
    assert.ok(h.calls.some(c=>c[0]==='uniform1f'&&c[1]==='u_bloomOn'&&c[2]===(quality?1:0)));
  }
  for(const failure of [{failTexture:true},{failTextureAt:2},{rejectBloom:true},{failFramebuffer:true}]) {
    const f=setup();Object.assign(f.options,failure);f.r.resize();
    assert.equal(f.textures.size,0);assert.equal(f.r.bloomTargets.length,0);
    f.calls.length=0;f.r.render(0);assert.ok(!f.calls.some(c=>c[0]==='quad'&&c[1]==='bloom'));
    assert.ok(f.calls.some(c=>c[0]==='uniform1f'&&c[1]==='u_bloomOn'&&c[2]===0));
  }
  h.options.viewport={left:0,top:0,width:1,height:1};h.r.quality=1;h.r.resize();
  assert.equal(h.r.bloomWidth,1);assert.equal(h.r.bloomHeight,1);
  const shader=vm.runInContext('BLOOMF',h.context);
  assert.match(shader,/smoothstep\(\.76,\.90,peak\)\*smoothstep\(\.48,\.74,lum\)/);
  assert.ok(Math.abs(.227027+2*.316216+2*.070270-1)<.00001);
});

test('menu shadows reuse only static depth while dynamic casters and the scene remain live', () => {
  const h=setup(),r=h.r;r.resize();
  Object.assign(r,{cinema:true,static:{},lightVP:new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])});
  const draw=(time=0)=>{h.calls.length=0;r.render(time,0);},
    staticShadow=()=>h.calls.filter(c=>c[0]==='batch'&&c[1]===r.static&&c[2]==='shadow');
  draw();assert.equal(staticShadow().length,1);assert.equal(r.menuShadowBytes,1536*1536*4);
  const cache=r.menuShadows;
  draw(1);assert.equal(staticShadow().length,0);assert.strictEqual(r.menuShadows,cache);
  assert.ok(h.calls.some(c=>c[0]==='resolve'&&c[1]===cache.fbo&&c[2]===r.shadowFbo&&c.at(-2)===h.g.DEPTH_BUFFER_BIT));
  assert.ok(h.calls.some(c=>c[0]==='batch'&&c[1]===r.dynamic&&c[2]==='shadow'));
  assert.ok(h.calls.some(c=>c[0]==='batch'&&c[1]===r.static&&c[2]==='scene'));
  r.lightVP[12]=1;draw();assert.equal(staticShadow().length,1);
  r.static={};draw();assert.equal(staticShadow().length,1);
  r.static.test={dirty:true};draw();assert.equal(staticShadow().length,1);
  r.static.test.dirty=false;draw();assert.equal(staticShadow().length,0);
  h.calls.length=0;r.render(3,1);assert.equal(staticShadow().length,1,'vegetation time invalidates depth');
  r.setBattlefieldProfile(r.battlefieldProfile);assert.equal(r.menuShadowBytes,0);
  assert.ok(!h.framebuffers.has(cache.fbo));assert.ok(!h.buffers.has(cache.depth));
  draw();r.cinema=false;draw();assert.equal(r.menuShadowBytes,0);assert.equal(staticShadow().length,1);
});

test('menu shadow allocation failure falls back without retrying every frame', () => {
  const h=setup({rejectShadow:true}),r=h.r;r.resize();
  Object.assign(r,{cinema:true,static:{},lightVP:new Float32Array(16)});
  let attempts=0;const create=h.g.createFramebuffer;h.g.createFramebuffer=()=>{attempts++;return create();};
  const sizes=[h.framebuffers.size,h.buffers.size];
  for(let i=0;i<3;i++)r.render(i,0);
  assert.equal(attempts,1);assert.equal(r.menuShadowBytes,0);
  assert.deepEqual([h.framebuffers.size,h.buffers.size],sizes);
  assert.equal(h.calls.filter(c=>c[0]==='batch'&&c[1]===r.static&&c[2]==='shadow').length,3);
  r.quality=1;r.render(4,0);assert.equal(attempts,2);
  r.quality=0;r.render(5,0);assert.equal(r.menuShadowAttempt,undefined);
});

test('retained result scene redraws post only and invalidates on target or profile changes', () => {
  const h=setup(),r=h.r;r.resize();r.render(1,7);
  h.calls.length=0;r.render(2,7,undefined,true);
  assert.deepEqual(h.calls.filter(c=>c[0]==='quad').map(c=>c[1]),['post']);
  assert.ok(!h.calls.some(c=>c[0]==='batch'||c[0]==='resolve'));
  assert.ok(h.calls.some(c=>c[0]==='uniform1f'&&c[1]==='u_time'&&c[2]===2),'grain keeps its live clock');
  r.quality=1;r.resize();h.calls.length=0;r.render(3,7,undefined,true);
  assert.ok(h.calls.some(c=>c[0]==='batch'));
  r.setBattlefieldProfile(r.battlefieldProfile);h.calls.length=0;r.render(4,7,undefined,true);
  assert.ok(h.calls.some(c=>c[0]==='batch'));
  r.static={water:{source:'westmarkWater',n:1}};
  assert.equal(r.canRetainScene,false,'wall-clock water must remain live even at a result');
  h.calls.length=0;r.render(5,7,undefined,true);assert.ok(h.calls.some(c=>c[0]==='batch'));
  r.static={};r.environment={};assert.equal(r.canRetainScene,false,'custom animation needs its own retention contract');
});

test('scene geometry and blended effects resolve exactly once before post-processing', () => {
  const h = setup(); h.r.resize(); h.calls.length = 0; h.r.render(1);
  assert.deepEqual(Array.from(h.calls.find(c => c[0] === 'batch' && c[1] === 'static' && c[2] === 'shadow')[5]),
    ['terrain','alienLanternPool','westmarkWater'],'flat ground, projected light and water are not submitted as shadow casters');
  const staticScene=h.calls.filter(c => c[0] === 'batch' && c[1] === 'static' && c[2] === 'scene');
  assert.strictEqual(staticScene[0][4], h.r.vp,'static scene chunks use the camera projection for culling');
  assert.deepEqual(Array.from(staticScene[0][5]),['alienLanternPool','westmarkWater'],'translucent surfaces are excluded from the opaque static pass');
  assert.equal(staticScene[1][6],'westmarkWater','water blends after opaque ground, bridge and units');
  assert.equal(staticScene[2][6],'alienLanternPool','projected light retains its own blended static pass');
  assert.ok(h.calls.findIndex(c=>c[0]==='batch'&&c[1]==='dynamic'&&c[2]==='scene')<h.calls.indexOf(staticScene[1]));
  assert.ok(h.calls.findIndex(c=>c[0]==='depthMask'&&c[1]===false)<h.calls.indexOf(staticScene[1]),
    'water and projected lights blend without depth writes');
  const resolve = h.calls.findIndex(c => c[0] === 'resolve');
  assert.equal(h.calls.filter(c => c[0] === 'resolve').length, 1);
  assert.deepEqual(h.calls[resolve], ['resolve', h.r.sceneMSAAFbo, h.r.sceneFbo,
    0, 0, 1280, 960, 0, 0, 1280, 960, 1, 'NEAREST']);
  for (const batch of ['static', 'dynamic', 'effects']) {
    const index = h.calls.findIndex(c => c[0] === 'batch' && c[1] === batch && c[2] === 'scene');
    assert.ok(index >= 0 && index < resolve);
    assert.equal(h.calls[index][3], h.r.sceneMSAAFbo);
  }
  assert.ok(h.calls.findIndex(c => c[0] === 'quad' && c[1] === 'post' && c[2] === null) > resolve);
  assert.deepEqual(h.bindings(), { draw: null, read: null, buffer: null });
});

test('sky rendering is restricted to the menu camera, even with a stale menu seed', () => {
  const h=setup();h.r.resize();
  const menu=[];h.r.menuSky={draw:(...args)=>menu.push(args)};
  for (const cinema of [false,true]) {
    h.r.cinema=cinema;h.r.menuSkySeed=null;h.calls.length=0;h.r.render(1);
    assert.equal(h.calls.some(c=>c[0]==='quad'&&c[1]==='sky'),cinema);
    h.r.menuSkySeed=1409;h.r.menuSkyFamily='ground';menu.length=0;
    h.calls.length=0;h.r.render(1);
    assert.equal(menu.length,cinema?1:0);
    assert.equal(h.calls.some(c=>c[0]==='quad'&&c[1]==='sky'),false);
  }
});

test('low quality and unsupported hardware draw directly to the existing scene texture without resolve', () => {
  for (const quality of [0, 2]) {
    const h = setup({ color: [], depth: [] }); h.r.quality = quality; h.r.resize();
    h.calls.length = 0; h.r.render(1);
    assert.equal(h.calls.some(c => c[0] === 'resolve'), false);
    assert.equal(h.calls.some(c => c[0] === 'quad' && c[1] === 'sky'), false);
    assert.equal(h.calls.find(c => c[0] === 'batch' && c[1] === 'effects')[3], h.r.sceneFbo);
    assert.equal(h.calls.find(c => c[0] === 'quad' && c[1] === 'post')[2], null);
  }
});
