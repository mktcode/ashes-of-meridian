const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { DIAGNOSTIC_SCRIPTS, loadScripts } = require('./helpers/game-scripts.cjs');

function classes(globals = {}) {
  return vm.runInContext('({Recorder: MeridianDiagnosticRecorder, Probe: MeridianRenderProbe, create: createMeridianDiagnostics, resources: diagnosticResources})',
    loadScripts(DIAGNOSTIC_SCRIPTS, { globals }));
}
function gpuGL({ supported = true } = {}) {
  const ext = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 }, live = new Set(), calls = [];
  let active = null;
  return { calls, live, disjoint: false, lost: false, ready: false, external: false,
    QUERY_RESULT_AVAILABLE: 3, QUERY_RESULT: 4, CURRENT_QUERY: 5,
    getExtension(name) { assert.equal(name, 'EXT_disjoint_timer_query_webgl2'); return supported ? ext : null; },
    isContextLost() { return this.lost; },
    getParameter(name) { assert.equal(name, ext.GPU_DISJOINT_EXT); return this.disjoint; },
    getQuery() { return active || (this.external ? {} : null); },
    createQuery() { const q = {}; live.add(q); calls.push('create'); return q; },
    beginQuery(target, q) { assert.equal(active, null); assert.ok(live.has(q)); active = q; calls.push('begin'); },
    endQuery() { assert.ok(active); active = null; calls.push('end'); },
    getQueryParameter(q, parameter) {
      assert.ok(live.has(q));
      if (parameter === this.QUERY_RESULT_AVAILABLE) { calls.push('poll'); return this.ready; }
      assert.ok(this.ready, 'never read an unavailable result'); calls.push('result'); return 2500000;
    },
    deleteQuery(q) { assert.ok(live.delete(q), 'each query deleted once'); calls.push('delete'); }
  };
}
function fakeRenderer(gl) {
  return { gl, meshes: { box: { count: 36 } }, static: { box: { n: 3, data: new Float32Array(22 * 8) } },
    dynamic: {}, effects: {}, quality: 2, width: 800, height: 600, sceneSamples: 4,
    bloomTargets: [{}, {}], bloomWidth: 200, bloomHeight: 150, shadowTex: {}, shadowSize: 1536,
    textureResources: { a: { resident: true }, b: { resident: false } } };
}

test('resource estimates include reusable contour capacity and repeated draw instances', () => {
  const {resources} = classes(), R = fakeRenderer(gpuGL({supported:false}));
  const before = resources(R);
  R.occlusion = { box:{n:2,data:new Float32Array(22*32)} };
  const after = resources(R);
  assert.equal(after.buckets,before.buckets+1);
  assert.equal(after.instances,before.instances+2);
  assert.equal(after.instanceCapacityBytes,before.instanceCapacityBytes+22*32*4);
  assert.equal(after.renderTargetBytesEstimate,before.renderTargetBytesEstimate,'contours have no additional render targets');
  R.menuShadowBytes=1536*1536*4;
  assert.equal(resources(R).renderTargetBytesEstimate,after.renderTargetBytesEstimate+R.menuShadowBytes);
});

test('diagnostic recorder separates callback/render cadence and CPU phases in a bounded chronological ring', () => {
  const { Recorder } = classes(); let now = 0;
  const r = new Recorder(() => now, 3);
  for (let i = 0; i < 5; i++) {
    r.beginFrame(i * 10); now += 2; r.phase('ui'); now += 3;
    if (i % 2 === 0) { r.phase('glSubmission'); now += 4; }
    r.finishFrame(i % 2 === 0);
  }
  const report = r.report();
  assert.equal(report.frames.length, 3);
  assert.deepEqual(Array.from(report.frames, f => f.id), [3, 4, 5]);
  assert.deepEqual(Array.from(report.frames, f => f.renderIntervalMs), [20, null, 20]);
  assert.equal(report.summary.rafIntervalMs.p50, 10);
  assert.equal(report.summary.cpuMs.simulation.p50, 2);
  assert.equal(report.summary.cpuMs.ui.p50, 3);
  assert.equal(report.summary.cpuMs.glSubmission.samples, 2, 'skipped renders are not zero GPU/GL samples');
  assert.equal(report.summary.gpuMs.scene, null);
  r.beginFrame(2000); now += 1; r.finishFrame(true);
  assert.equal(r.report().summary.rafGapsOver50ms, 1, 'background gaps are reported rather than clamped to simulation dt');
  r.beginFrame(2010); r.stop('context-lost'); r.finishFrame(true); r.beginFrame(2020);
  assert.equal(r.current, undefined);
  assert.equal(r.report().frames.at(-1).atMs, 2000, 'incomplete callback is not recorded');
  assert.equal(r.report().stopped, 'context-lost');
});

test('GPU probe is sparse, asynchronous and counts submitted work independently of timer support', () => {
  const { Recorder, Probe } = classes(), r = new Recorder(() => 0), gl = gpuGL(), p = new Probe(gl, r);
  for (let i = 0; i <= 15; i++) {
    if (i === 15) gl.ready = true;
    r.beginFrame(i * 16); p.beginFrame(); p.upload(88);
    for (const pass of ['thumbnails', 'shadow', 'scene', 'bloom', 'post']) {
      p.beginPass(pass); p.draw(6, 3); p.endPass();
    }
    r.finishFrame(true);
    if (i < 15) assert.equal(gl.calls.filter(c => c === 'result').length, 0);
  }
  assert.equal(gl.calls.filter(c => c === 'create').length, 10);
  assert.equal(gl.calls.filter(c => c === 'result').length, 5);
  const first = r.report().frames[0];
  assert.equal(first.gpuMs.scene, 2.5);
  assert.equal(first.gpuMs.thumbnails, 2.5);
  assert.equal(first.render.passes.thumbnails.triangles, 6);
  assert.equal(r.report().summary.gpuMs.thumbnails.p50, 2.5);
  assert.equal(first.render.instanceUploadBytes, 88);
  assert.equal(first.render.passes.scene.drawCalls, 1);
  assert.equal(first.render.passes.scene.triangles, 6);
  assert.equal(first.render.passes.scene.instances, 3);
  assert.equal(Object.keys(r.report().frames[1].gpuMs).length, 0);
  p.stop(false); assert.equal(gl.live.size, 0);
  const unavailable = new Probe(gpuGL({ supported: false }), r);
  r.beginFrame(300); unavailable.beginFrame(); unavailable.beginPass('scene'); unavailable.draw(3); unavailable.endPass(); r.finishFrame(true);
  assert.equal(unavailable.report().status, 'unavailable');
  assert.equal(r.report().frames.at(-1).render.passes.scene.drawCalls, 1);
});

test('GPU probe discards disjoint queries, bounds backlog and avoids timers owned by other tools', () => {
  const { Recorder, Probe } = classes(), r = new Recorder(() => 0), gl = gpuGL(), p = new Probe(gl, r);
  function frame(i) {
    r.beginFrame(i * 16); p.beginFrame();
    for (const pass of ['shadow', 'scene', 'bloom', 'post']) { p.beginPass(pass); p.endPass(); }
    r.finishFrame(true);
  }
  for (let i = 0; i < 150; i++) frame(i);
  assert.equal(gl.live.size, 24); assert.ok(p.report().skipped > 0);
  gl.disjoint = true; gl.ready = true; frame(150);
  assert.equal(gl.live.size, 0); assert.equal(p.report().discarded, 24);
  assert.ok(r.report().frames.every(f => Object.keys(f.gpuMs).length === 0));
  gl.disjoint = false; gl.external = true;
  for (let i = 151; i <= 165; i++) frame(i);
  assert.equal(gl.live.size, 0);
  p.stop(false);
});

test('GPU loss and failed queries cannot read invalid results or propagate into the game', () => {
  const { Recorder, Probe } = classes(), r = new Recorder(() => 0), gl = gpuGL(), p = new Probe(gl, r);
  r.beginFrame(0); p.beginFrame(); p.beginPass('scene'); p.endPass(); r.finishFrame(true);
  const before = gl.calls.length;
  p.stop(true); assert.equal(gl.calls.length, before, 'lost context requires no GL cleanup/readback');
  assert.equal(p.report().status, 'context-lost'); assert.equal(p.report().pending, 0);
  const bad = gpuGL(), broken = new Probe(bad, r);
  bad.beginQuery = () => { throw Error('driver failure'); };
  r.beginFrame(20); broken.beginFrame();
  assert.doesNotThrow(() => broken.beginPass('scene'));
  assert.equal(broken.report().status, 'error');
  assert.equal(bad.live.size, 0, 'failed query creation is cleaned up even when no timer became active');
  r.finishFrame(true); r.beginFrame(40); broken.beginFrame(); broken.beginPass('scene'); broken.draw(3); broken.endPass(); r.finishFrame(true);
  assert.equal(r.report().frames.at(-1).render.passes.scene.drawCalls, 1, 'timer failure does not disable counters');
});

test('local adapter exports only allowlisted metadata and keeps export usable after graphics loss', () => {
  const elements = [], timers = [], events = {}, urls = [], downloads = [];
  const document = { hidden: false, body: { appendChild(e) { elements.push(e); } },
    createElement(tag) { return { tag, append(...items) { this.children = items; }, remove() {},
      click() { downloads.push(this.download); } }; } };
  let now = 0;
  const { create, resources } = classes({ document, navigator: { userAgent: 'local-test' }, devicePixelRatio: 1.5,
    window: { Meridian: { version: 'test', secret: 'SESSION-TOKEN' } }, performance: { now: () => now },
    addEventListener: (name, fn) => { events[name] = fn; }, Blob,
    URL: { createObjectURL(blob) { urls.push(blob); return 'blob:local'; }, revokeObjectURL(url) { urls.push(url); } },
    setTimeout: fn => timers.push(fn) });
  const R = fakeRenderer(gpuGL({ supported: false })), context = { view: 'game', paused: false,
    map: 'Desert', seed: 1, simulationTime: 20, speed: 1, entities: 4, effects: 0 };
  const d = create(R, () => ({ ...context }));
  for (let i = 0; i < 130; i++) {
    now = i * 1000; d.recorder.beginFrame(now); R.diagnostics.beginFrame(); d.finishFrame(true);
  }
  const report = d.report();
  assert.equal(report.samples.length, 120); assert.equal(report.samples[0].atMs, 10000);
  assert.equal(resources(R).geometryBytesEstimate, 36 * 36);
  assert.equal(resources(R).instanceCapacityBytes, 22 * 8 * 4);
  assert.equal(resources(R).residentMaterialTextures, 1);
  assert.equal(resources(R).materialTextureBytes, null);
  assert.ok(!JSON.stringify(report).includes('SESSION-TOKEN'));
  d.stop('context-lost'); assert.equal(R.diagnostics, undefined);
  assert.equal(d.report().recording.stopped, 'context-lost');
  assert.equal(d.report().gpu.status, 'context-lost');
  d.exportReport();
  assert.deepEqual(downloads, ['ashes-of-meridian-diagnostics.json']);
  assert.equal(urls[0].type, 'application/json');
  timers[0](); assert.equal(urls[1], 'blob:local');
  assert.equal(elements[0].children[1].disabled, true);
});
