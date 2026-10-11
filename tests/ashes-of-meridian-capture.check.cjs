const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

test('capture recipes share the runtime validator and reject contradictory cameras', async () => {
  const { validateCapture, resolveShots } = await import('../scripts/capture-recipe.mjs');
  const base = {
    map: 'desert',
    seed: 1409,
    content: 'landscape',
    camera: { mode: 'game', fit: 'map' },
  };
  assert.equal(validateCapture(base), base);
  for (const patch of [
    { map: 'invalid-map' },
    { seed: NaN },
    { content: 'invalid' },
    { camera: { mode: 'game', zoom: 0 } },
    { camera: { mode: 'game', projection: 'perspective' } },
    { camera: { mode: 'orbit', fit: 'map', distance: 10 } },
    { camera: { mode: 'orbit', pitch: Math.PI } },
    { camera: { mode: 'lookAt', eye: [0, 1, 0], target: [0, 0, 0] } },
    { camera: { mode: 'lookAt', eye: [0, 0, 0], target: [0, 0, 0] } },
    { camera: { mode: 'orbit', near: 10, far: 1 } },
    { camera: { mode: 'orbit', projection: 'perspective', zoom: 20 } },
    { render: { units: 'false' } },
    { dpr: 3 },
    { entities: [{ kind: 'unit', type: 'worker', team: 0, x: 0, z: 0 }] },
  ])
    assert.throws(() => validateCapture({ ...base, ...patch }));
  const shots = resolveShots({
    ...base,
    shots: [{ name: 'front', render: { units: false }, hour: 13 }, { name: 'back' }],
  });
  assert.equal(shots[0].render.units, false);
  assert.equal(shots[1].render.units, true, 'shot overrides do not leak');
  assert.equal(shots[1].render.caches, false);
  assert.equal(shots[1].render.distanceMist, false);
  assert.equal(shots[1].render.horizonMist, false);
  assert.equal(shots[1].render.mapBoundary, false);
  assert.equal(
    resolveShots({ ...base, hud: false, shots: [{ render: { hud: true } }] })[0].render.hud,
    true,
  );
  assert.equal(shots[1].hour, undefined);
  assert.equal(shots[1].dpr, 1);
  assert.throws(
    () => resolveShots({ ...base, shots: [{ name: 'same' }, { name: 'same' }] }),
    /Duplicate/,
  );
});

test('orthographic and perspective fits enclose all bounds at headings, top and horizontal views', async () => {
  const { captureSchema } = await import('../scripts/capture-recipe.mjs');
  const { resolve, view, validate } = captureSchema();
  const points = [];
  for (const x of [-200, 200])
    for (const y of [-8, 85]) for (const z of [-200, 200]) points.push([x, y, z]);
  for (const projection of ['orthographic', 'perspective'])
    for (const yaw of [0, 0.8, Math.PI, 5])
      for (const pitch of [0, 0.4, Math.PI / 2])
        for (const aspect of [0.5, 16 / 9]) {
          const c = resolve(
              { mode: 'orbit', projection, fit: 'map', yaw, pitch },
              points,
              aspect,
              85,
            ),
            m = view(c);
          assert.ok([...m, ...c.eye].every(Number.isFinite));
          assert.ok(c.far > c.near);
          for (const p of points) {
            const axis = (i) => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i],
              x = axis(0),
              y = axis(1),
              depth = -axis(2);
            const half = projection === 'orthographic' ? c.height / 2 : depth * Math.tan(c.fov / 2);
            assert.ok(Math.abs(x) <= half * aspect + 1e-3);
            assert.ok(Math.abs(y) <= half + 1e-3);
            assert.ok(depth > c.near && depth < c.far);
          }
        }
  const c = resolve(
    { mode: 'lookAt', eye: [80, 3, -7], target: [0, 0, 0], projection: 'perspective' },
    [],
    1,
    40,
  );
  assert.deepEqual(Array.from(c.eye), [80, 3, -7]);
  const narrow = resolve(
    { mode: 'orbit', projection: 'perspective', fit: 'map', padding: 1, fov: 0.05, pitch: 0.2 },
    points,
    64 / 4096,
    85,
  );
  validate(
    {
      camera: {
        mode: 'lookAt',
        projection: 'perspective',
        eye: narrow.eye,
        target: narrow.target,
        up: narrow.up,
        fov: narrow.fov,
        near: narrow.near,
        far: narrow.far,
      },
    },
    true,
  );
  const distant = resolve(
    {
      mode: 'orbit',
      target: [100000, 0, 0],
      distance: 100000,
      zoom: 20,
      yaw: Math.PI / 2,
      pitch: 0,
      near: 999999,
    },
    [],
    1,
    40,
  );
  assert.ok(distant.far > distant.near);
  validate(
    {
      camera: {
        mode: 'lookAt',
        eye: distant.eye,
        target: distant.target,
        up: distant.up,
        zoom: distant.height,
        near: distant.near,
        far: distant.far,
      },
    },
    true,
  );
});

function fixture() {
  const elements = new Map(),
    el = (id) => {
      if (!elements.has(id)) elements.set(id, { classList: { add() {}, toggle() {} } });
      return elements.get(id);
    };
  const r = {
    frame: 0,
    quality: 2,
    viewport: { width: 1280, height: 720 },
    vp: new Float32Array(16),
    battlefieldHour: 12,
    gl: { getError: () => 0 },
    prepareBattlefieldTextures: async () => true,
    frameReady: () => true,
    resize() {},
    camera() {},
  };
  const surface = {
    heights: new Float32Array([0, 10]),
    maxHeight: 10,
    heightAt: () => 4,
    entityHeight: () => 4,
  };
  const game = {
    world: {
      extent: 100,
      surface,
      renderProfile: {},
      rebuild() {},
      reveal(entities, scans) {
        this.scans = scans;
      },
    },
    start(options) {
      this.s = {
        map: options.map,
        seed: options.seed,
        time: 0,
        cam: { x: 0, z: 0, zoom: 57, yaw: 0 },
        entities: [
          { kind: 'unit', type: 'worker', team: 0, id: 1, x: 10, z: 20, size: 1 },
          { kind: 'unit', type: 'worker', team: 1, id: 2, x: -10, z: -20, size: 1 },
          { kind: 'resource', id: 3, x: 0, z: 0, size: 1 },
        ],
      };
    },
    alive(fn) {
      return this.s.entities.filter(fn);
    },
    rehash() {},
    factionFor: (t) => t,
    spawnUnit(type, x, z, team) {
      const e = { kind: 'unit', id: 4, type, x, z, team, size: 1 };
      this.s.entities.push(e);
      return e;
    },
  };
  const ui = { touchPoints: new Map(), pointer: {}, renderActions() {}, updateHUD() {},
    clampCameraPoint(point) { this.cameraClamped = true; return {x:point.x,z:point.z}; } };
  let controller;
  const context = vm.createContext({
    BATTLEFIELDS: { desert: {} },
    UNITS: { rifle: { size: 1 } },
    BUILDINGS: {},
    $: el,
    performance: { now: () => 0 },
    innerWidth: 1280,
    innerHeight: 720,
    requestAnimationFrame: (callback) =>
      queueMicrotask(() => {
        r.frame++;
        controller.renderedRequest = controller.request;
        callback();
      }),
  });
  vm.runInContext(readFileSync(join(__dirname, '../dist/src/capture.js'), 'utf8'), context);
  const Controller = vm.runInContext('MeridianCapture', context);
  controller = new Controller(game, ui, r, () => {});
  return { controller, game, ui, r };
}

test('landscape setup keeps resources and anchors, resets scene options and permits paused navigation', async () => {
  const { controller: c, game, ui } = fixture();
  await c.prepare({ map: 'desert', seed: 1409, content: 'landscape' });
  assert.equal(game.s.entities.length, 1);
  assert.equal(game.s.entities[0].kind, 'resource');
  assert.equal(c.anchors.player.x, 10);
  assert.equal(c.render.horizonMist, false);
  assert.equal(c.renderer.horizonMist, false);
  assert.equal(ui.paused, true);
  assert.equal(ui.viewing, true);
  assert.equal(ui.viewingCameraLocked, false);
  assert.equal(ui.cameraClamped, true, 'viewer fit passes through finite scenery bounds');
  assert.ok(game.s.cam.zoom > 115);
  await c.apply({
    render: { units: false },
    camera: { mode: 'orbit', projection: 'perspective', fit: 'map', pitch: 0 },
  });
  assert.equal(ui.viewingCameraLocked, true);
  assert.equal(c.render.units, false);
  await c.prepare({
    map: 'desert',
    seed: 1409,
    content: 'arranged',
    entities: [{ kind: 'unit', type: 'rifle', team: 0, anchor: 'player', x: 3, z: 0 }],
  });
  assert.equal(c.placed[0].x, 13);
  assert.equal(c.render.units, true);
  assert.equal(c.renderer.horizonMist, true);
  assert.equal(c.report().units, 1);
  await c.apply({ render: { units: false } });
  assert.equal(c.report().units, 1, 'render filter does not remove simulation entities');
  assert.equal(c.visible({ kind: 'unit' }), false);
  assert.equal(game.s.time, 0);
});

test('map boundary uses terrain at the logical extent, caches world geometry and respects visibility', () => {
  const { controller: c, r, game } = fixture(),
    projected = [],
    widths = [];
  let samples = 0,
    dash;
  game.world.surface.heightAt = () => {
    samples++;
    return 4;
  };
  r.project = (...p) => {
    projected.push(p);
    return { x: p[0], y: p[2] };
  };
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    setLineDash(v) {
      dash = Array.from(v);
    },
    stroke() {
      widths.push(this.lineWidth);
    },
  };
  c.render.mapBoundary = true;
  c.drawMapBoundary(ctx);
  assert.equal(projected.length, 0, 'normal gameplay has no capture frame');
  c.active = true;
  c.render.mapBoundary = false;
  c.drawMapBoundary(ctx);
  assert.equal(projected.length, 0);
  c.render.mapBoundary = true;
  c.drawMapBoundary(ctx);
  assert.deepEqual(dash, [8, 6]);
  assert.deepEqual(widths, [4, 2]);
  assert.ok(projected.length > 4);
  for (const [x, y, z] of projected) {
    assert.ok(Math.abs(x) <= 100 + 1e-8 && Math.abs(z) <= 100 + 1e-8);
    assert.ok(Math.abs(Math.abs(x) - 100) < 1e-8 || Math.abs(Math.abs(z) - 100) < 1e-8);
    assert.ok(Math.abs(y - 4.12) < 1e-8);
  }
  const previous = samples;
  c.drawMapBoundary(ctx);
  assert.equal(samples, previous, 'pan/rotate only reprojects cached terrain points');
  game.world = { ...game.world, extent: 200 };
  projected.length = 0;
  c.drawMapBoundary(ctx);
  assert.ok(samples > previous);
  assert.ok(projected.some((p) => p[0] === 200));
});

test('prepared GL errors abort instead of being consumed by a second report', async () => {
  const { controller: c, r } = fixture();
  let reads = 0;
  r.gl.getError = () => (++reads === 1 ? 1282 : 0);
  await assert.rejects(
    c.prepare({ map: 'desert', seed: 7, content: 'landscape' }),
    /WebGL error 1282/,
  );
});
