const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { RENDERER_SCRIPTS, loadScripts } = require('./helpers/game-scripts.cjs');

// API orchestration and shader-source contracts only: no GPU/GLSL execution in Node.
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
  assert.ok(FRAG.includes('world*14./pixels'), 'ground keeps equal source-texel density on both axes');
  assert.ok(FRAG.includes('vec3 t=groundBase(v_pos.xz);base=t;'), 'ground uses the aspect-correct Dirt source');
  assert.ok(FRAG.includes('base=t;vec4 rocks=groundDecor'), 'ground starts with the unchanged Dirt color');
  assert.ok(!FRAG.includes('base=mix(detail(base,t,.74),t,.32)'), 'biome tint is not mixed into the ground');
  assert.ok(FRAG.includes('float sh=shadow()'), 'ground still receives model shadows');
  for (const texture of ['u_rockClustersTex', 'u_desertShrubsTex'])
    assert.ok(FRAG.includes(`uniform sampler2D ${texture};`));
  assert.doesNotMatch(FRAG, /u_terrainOverlayTex/);
  assert.ok(FRAG.includes('groundDecor(u_rockClustersTex,v_pos.xz,false)'));
  assert.ok(FRAG.includes('groundDecor(u_desertShrubsTex,v_pos.xz,true)'));
  assert.ok(FRAG.includes('normalize(u_eye-v_pos)'));
  assert.ok(FRAG.includes('texture(u_fog,(v_pos.xz+u_extent)/(u_extent*2.))'));
});
test('ground decoration samples individual irregular atlas crops with stable world-cell variation', () => {
  const context = loadScripts(RENDERER_SCRIPTS);
  const { GROUND_DECOR_ATLAS: atlas, FRAG, MeridianRenderer } = vm.runInContext(
    '({GROUND_DECOR_ATLAS, FRAG, MeridianRenderer})', context);
  for (const [key, count] of [['rockClusters', 15], ['desertShrubs', 10]]) {
    assert.equal(atlas[key].length, count);
    assert.equal(new Set(atlas[key].map(r => r.join(','))).size, count);
    for (const [x, y, right, bottom] of atlas[key]) {
      assert.ok(x >= 0 && y >= 0 && right <= 1254 && bottom <= 1254);
      assert.ok(right > x && bottom > y);
    }
    assert.ok(FRAG.includes(`const vec4 ${key}Rects[${count}]`));
    const source = MeridianRenderer.toString();
    assert.equal(source.split(`this.loadTexture(this.${key}Tex, MERIDIAN_TEXTURES.${key}, false);`).length - 1, 1);
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
  assert.doesNotMatch(POSTF, /sampler2D\s+(?!u_tex\b)/);
  assert.ok(POSTF.includes('if(u_quality>.5){for(int i=0;i<8;i++)'), 'existing bloom stays on Balanced/High');
});

function setup(options = {}) {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS], { globals: {
    innerWidth: 800, innerHeight: 600, devicePixelRatio: 2
  } });
  const Renderer = vm.runInContext('MeridianRenderer', context), calls = [];
  const framebuffers = new Set(), buffers = new Set();
  let draw = null, read = null, buffer = null, program = null, next = 0;
  const api = {
    COLOR_BUFFER_BIT: 1, DEPTH_BUFFER_BIT: 2,
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
      assert.equal(c.samples, d.samples); assert.equal(c.width, d.width); assert.equal(c.height, d.height);
      return options.reject?.(c.samples) ? 'FRAMEBUFFER_INCOMPLETE_MULTISAMPLE' : 'FRAMEBUFFER_COMPLETE';
    },
    useProgram(p) { program = p; calls.push(['program', p]); },
    drawArrays() { calls.push(['quad', program, draw]); },
    blitFramebuffer(...args) { calls.push(['resolve', read, draw, ...args]); }
  };
  const g = new Proxy(api, { get(target, name) {
    if (!(name in target)) target[name] = /^[A-Z0-9_]+$/.test(name) ? name : (...args) => calls.push([name, ...args]);
    return target[name];
  } });
  const r = Object.assign(Object.create(Renderer.prototype), {
    gl: g, quality: 2, canvas: {}, sceneFbo: g.createFramebuffer(), sceneTex: {}, sceneDepth: g.createRenderbuffer(),
    sceneMSAAFbo: null, sceneMSAAColor: null, sceneMSAADepth: null, sceneSamples: 0,
    frame: 0, haze: [0, 0, 0], static: 'static', dynamic: 'dynamic', effects: 'effects',
    program: 'scene', depthProg: 'shadow', skyProg: 'sky', postProg: 'post', shadowFbo: 'shadow-target',
    upload() {}, uniform(p, name) { return name; },
    drawBatches(batch) { calls.push(['batch', batch, program, draw]); }
  });
  Object.defineProperty(r.canvas, 'getBoundingClientRect', { value: () => options.viewport ||
    ({ left: 0, top: 0, width: context.innerWidth, height: context.innerHeight }) });
  return { r, g, calls, options, framebuffers, buffers, context, bindings: () => ({ draw, read, buffer }) };
}

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
    assert.equal(h.framebuffers.size, expected ? 2 : 1);
    assert.equal(h.buffers.size, expected ? 3 : 1);
  }
});

test('incomplete 4x target is released before retrying supported 2x', () => {
  const h = setup({ reject: n => n === 4 }); h.r.resize();
  assert.equal(h.r.sceneSamples, 2);
  assert.deepEqual(h.calls.filter(c => c[0] === 'storage').map(c => c[1]), [4, 4, 2, 2]);
  assert.equal(h.framebuffers.size, 2); assert.equal(h.buffers.size, 3);
});

test('incomplete targets and null GPU allocations leave a clean single-sample fallback', () => {
  for (const failure of [{ reject: () => true }, { failFramebuffer: true }, { failRenderbuffer: true }]) {
    const h = setup(); Object.assign(h.options, failure); h.r.resize();
    assert.equal(h.r.sceneSamples, 0); assert.equal(h.r.sceneMSAAFbo, null);
    assert.equal(h.r.sceneMSAAColor, null); assert.equal(h.r.sceneMSAADepth, null);
    assert.equal(h.framebuffers.size, 1); assert.equal(h.buffers.size, 1);
    assert.deepEqual(h.bindings(), { draw: null, read: null, buffer: null });
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
  assert.equal(h.framebuffers.size, 2); assert.equal(h.buffers.size, 3);
});

test('scene geometry and blended effects resolve exactly once before post-processing', () => {
  const h = setup(); h.r.resize(); h.calls.length = 0; h.r.render(1);
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

test('low quality and unsupported hardware draw directly to the existing scene texture without resolve', () => {
  for (const quality of [0, 2]) {
    const h = setup({ color: [], depth: [] }); h.r.quality = quality; h.r.resize();
    h.calls.length = 0; h.r.render(1);
    assert.equal(h.calls.some(c => c[0] === 'resolve'), false);
    assert.equal(h.calls.find(c => c[0] === 'quad' && c[1] === 'sky')[2], h.r.sceneFbo);
    assert.equal(h.calls.find(c => c[0] === 'batch' && c[1] === 'effects')[3], h.r.sceneFbo);
    assert.equal(h.calls.find(c => c[0] === 'quad' && c[1] === 'post')[2], null);
  }
});
