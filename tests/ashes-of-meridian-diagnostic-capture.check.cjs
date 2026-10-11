const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const example = () =>
  JSON.parse(
    readFileSync(join(__dirname, '../scripts/diagnostics/recipes/dense-army.json'), 'utf8'),
  );

test('diagnostic recipe compiles bounded scenes without mutating the input; case/time overrides stay validated', async () => {
  const { resolveRecipe } = await import('../scripts/diagnostics/recipe.mjs');
  const input = example(),
    original = structuredClone(input);
  const recipe = resolveRecipe(input, { caseName: 'night-running', durationMs: 1000 });
  assert.deepEqual(input, original);
  assert.equal(recipe.cases.length, 1);
  assert.equal(recipe.cases[0].hour, 22);
  assert.equal(recipe.durationMs, 1000);
  assert.equal(recipe.scene.entities.length, 144);
  assert.equal(recipe.armyOffset, 0);
  assert.equal(recipe.scene.entities[0].x, -7.975);
  assert.equal(recipe.scene.entities[0].team, 0);
  assert.equal(recipe.scene.reveal, false);
  const extra = { kind: 'unit', type: 'worker', team: 0, x: 0, z: 0 };
  input.scene.entities = [extra];
  const expanded = resolveRecipe(input);
  assert.equal(expanded.armyOffset, 1);
  assert.deepEqual(expanded.scene.entities[0], extra);
  for (const patch of [
    { durationMs: 999 },
    { durationMs: 21000 },
    { warmupMs: 6000 },
    { unknown: true },
    { cases: [] },
    { cases: [input.cases[0], input.cases[0]] },
    { cases: [{ name: '../escape', hour: 10, paused: true }] },
    { army: { ...input.army, count: 200 } },
    { army: { ...input.army, spacing: NaN } },
    { scene: { ...input.scene, reveal: true } },
    { interactions: [{ at: 1, kind: 'selectArmy' }] },
    { interactions: [{ at: 0.2, kind: 'moveArmy', target: { x: 0, z: 0, anchor: 'invalid' } }] },
    {
      interactions: [
        { at: 0.2, kind: 'selectArmy' },
        { at: 0.1, kind: 'selectArmy' },
      ],
    },
  ])
    assert.throws(() => resolveRecipe({ ...input, ...patch }));
  assert.throws(() => resolveRecipe(input, { caseName: 'missing' }));
  assert.throws(() => resolveRecipe(input, { durationMs: NaN }));
});

test('graphics attribution distinguishes software, unknown and hardware-reported renderers without assuming Chromium means GPU', async () => {
  const { classifyGraphics } = await import('../scripts/diagnostics/results.mjs');
  assert.equal(
    classifyGraphics({ renderer: 'ANGLE (Google, Vulkan SwiftShader Device)' }),
    'software',
  );
  assert.equal(classifyGraphics({ renderer: 'Mesa llvmpipe (LLVM)' }), 'software');
  assert.equal(
    classifyGraphics({ renderer: 'ANGLE (Microsoft Basic Render Driver, D3D11)' }),
    'software',
  );
  assert.equal(classifyGraphics({ renderer: 'ANGLE (Microsoft, WARP)' }), 'software');
  assert.equal(classifyGraphics({ renderer: null, maskedRenderer: 'WebKit WebGL' }), 'unknown');
  assert.equal(
    classifyGraphics({ renderer: 'ANGLE (NVIDIA, RTX 3090, OpenGL)' }),
    'hardware-reported',
  );
});

function measurementFixture() {
  const measurement = {
    range: { afterFrameId: 1, throughFrameId: 3, afterInteractionId: 0, throughInteractionId: 1 },
    startState: {
      paused: true,
      time: 0,
      speed: 1,
      camera: { x: 0 },
      width: 800,
      height: 600,
      quality: 2,
      armyCount: 2,
    },
    endState: {
      paused: true,
      time: 0,
      speed: 1,
      camera: { x: 0 },
      width: 800,
      height: 600,
      quality: 2,
      armyCount: 2,
    },
  };
  const report = {
    gpu: { status: 'unavailable' },
    recording: {
      stopped: null,
      frames: [{ id: 2 }, { id: 3 }],
      summary: { rendered: 2 },
      interactions: { events: [{ failed: false, hidden: false }] },
    },
  };
  return { measurement, report };
}
test('measurement acceptance rejects incomplete rings, interrupted scenes and changed comparison context, not missing GPU timers', async () => {
  const { validateMeasurement } = await import('../scripts/diagnostics/results.mjs');
  const { measurement, report } = measurementFixture();
  assert.doesNotThrow(() => validateMeasurement(measurement, report, true));
  for (const change of [
    (f) => f.report.recording.frames.pop(),
    (f) => (f.report.recording.summary.rendered = 0),
    (f) => (f.report.recording.stopped = 'context-lost'),
    (f) => (f.report.recording.interactions.events[0].failed = true),
    (f) => f.measurement.endState.width++,
    (f) => f.measurement.endState.speed++,
    (f) => f.measurement.endState.camera.x++,
    (f) => f.measurement.endState.time++,
    (f) => (f.report.recording.interactions.events[0].hidden = true),
    (f) => (f.report.samples = [{ hidden: true }]),
  ]) {
    const fixture = measurementFixture();
    change(fixture);
    assert.throws(() => validateMeasurement(fixture.measurement, fixture.report, true));
  }
  measurement.startState.paused = measurement.endState.paused = false;
  assert.throws(() => validateMeasurement(measurement, report, false));
  measurement.endState.time = 1;
  assert.doesNotThrow(() => validateMeasurement(measurement, report, false));
});

async function runSerializedMeasurement({ paused, rejectCommand = false, hidePage = false }) {
  const { measureScene } = await import('../scripts/diagnostics/browser.mjs');
  let clock = 500,
    callbacks = 5,
    events = 0;
  const timers = [],
    cleared = new Set(),
    calls = [];
  const listeners = new Set(),
    document = {
      hidden: false,
      addEventListener(name, fn) {
        assert.equal(name, 'visibilitychange');
        listeners.add(fn);
      },
      removeEventListener(name, fn) {
        assert.equal(name, 'visibilitychange');
        listeners.delete(fn);
      },
    };
  const ui = {
    paused: true,
    view: 'game',
    selected: [],
    select(ids, group) {
      assert.equal(this, ui);
      assert.equal(group, true);
      this.selected = [...ids];
      events++;
      calls.push('select');
      if (hidePage) {
        document.hidden = true;
        for (const listener of listeners) listener();
      }
    },
    submitAction(action) {
      assert.equal(this, ui);
      assert.equal(action.order.type, 'move');
      assert.equal(action.order.x, 12);
      events++;
      calls.push('command');
      return !rejectCommand;
    },
  };
  const game = {
    s: { time: 0, speed: 1, cam: { x: 0, z: 0, zoom: 30 } },
    get: (id) => ({ id, hp: 100 }),
  };
  const recorder = {
    stopped: null,
    report: () => ({ callbacksSeen: callbacks, interactions: { eventsSeen: events } }),
  };
  const context = vm.createContext({
    window: {
      Meridian: {
        ui,
        game,
        diagnostics: { recorder },
        renderer: {
          battlefieldHour: 10,
          quality: 2,
          width: 800,
          height: 600,
          gl: { getError: () => 0, isContextLost: () => false },
        },
      },
    },
    document,
    performance: { now: () => clock },
    setTimeout(fn, delay) {
      const id = timers.length;
      timers.push({ fn, delay, id });
      return id;
    },
    clearTimeout(id) {
      cleared.add(id);
    },
    options: {
      durationMs: 1000,
      paused,
      armyIds: [1, 2],
      anchors: { player: { x: 10, z: 20 } },
      interactions: [
        { at: 0.1, kind: 'selectArmy' },
        { at: 0.3, kind: 'moveArmy', target: { anchor: 'player', x: 2, z: 3 } },
      ],
    },
  });
  const outcome = vm.runInContext(`(${measureScene.toString()})(options)`, context).then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  for (const timer of [...timers].sort((a, b) => a.delay - b.delay)) {
    if (cleared.has(timer.id)) continue;
    clock = 500 + timer.delay;
    if (!ui.paused) game.s.time = timer.delay / 1000;
    callbacks++;
    timer.fn();
    await Promise.resolve();
  }
  return { ...(await outcome), ui, calls, cleared, timers, listeners };
}
test('serialized measurement schedules real timer windows, preserves UI receivers and pauses/cleans up on success or rejection', async () => {
  for (const paused of [true, false]) {
    const result = await runSerializedMeasurement({ paused });
    assert.ifError(result.error);
    assert.equal(result.value.elapsedMs, 1000);
    assert.equal(result.value.startState.paused, paused);
    assert.equal(result.value.startState.speed, 1);
    assert.equal(result.value.endState.paused, paused);
    assert.equal(result.value.endState.time, paused ? 0 : 1);
    assert.equal(result.value.range.afterFrameId, 5);
    assert.equal(result.value.range.throughFrameId, 8);
    assert.equal(result.value.range.throughInteractionId, 2);
    assert.equal(result.value.operations[0].atMs, 100);
    assert.deepEqual(result.calls, ['select', 'command']);
    assert.equal(result.ui.paused, true);
    assert.equal(result.cleared.size, result.timers.length);
    assert.equal(result.listeners.size, 0);
  }
  const failed = await runSerializedMeasurement({ paused: false, rejectCommand: true });
  assert.match(failed.error.message, /command rejected/);
  assert.equal(failed.ui.paused, true);
  assert.equal(failed.cleared.size, failed.timers.length);
  assert.equal(failed.listeners.size, 0);
  const hidden = await runSerializedMeasurement({ paused: false, hidePage: true });
  assert.match(hidden.error.message, /page hidden/);
  assert.equal(hidden.ui.paused, true);
  assert.equal(hidden.listeners.size, 0);
});

test('serialized window export excludes warmup/drain samples and delegates summaries to the runtime recorder', async () => {
  const { collectWindow, graphicsInfo } = await import('../scripts/diagnostics/browser.mjs');
  const range = {
    afterFrameId: 3,
    throughFrameId: 5,
    afterInteractionId: 2,
    throughInteractionId: 3,
  };
  const context = vm.createContext({
    range,
    window: {
      Meridian: {
        diagnostics: {
          report: () => ({
            schema: 3,
            samples: [{ atMs: 0 }, { atMs: 10 }, { atMs: 20 }, { atMs: 30 }],
          }),
          recorder: {
            report(input) {
              assert.equal(input, range);
              return { frames: [{ atMs: 10 }, { atMs: 20 }], summary: { rendered: 2 } };
            },
          },
        },
        renderer: {
          gl: {
            RENDERER: 1,
            VERSION: 2,
            getExtension: () => null,
            getParameter: (p) => (p === 1 ? 'WebKit WebGL' : 'WebGL 2'),
          },
        },
      },
    },
  });
  const report = vm.runInContext(`(${collectWindow.toString()})(range)`, context);
  assert.equal(report.schema, 3);
  assert.deepEqual(
    Array.from(report.samples, (s) => s.atMs),
    [10, 20],
  );
  assert.equal(report.recording.summary.rendered, 2);
  const graphics = vm.runInContext(`(${graphicsInfo.toString()})()`, context);
  assert.equal(graphics.renderer, null);
  assert.equal(graphics.maskedRenderer, 'WebKit WebGL');
});

test('diagnostic CLI help is available without a build/browser and invalid recipes fail before output creation', () => {
  const root = join(__dirname, '..');
  const help = execFileSync(process.execPath, ['scripts/diagnose-scene.mjs', '--help'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.match(help, /--require-hardware/);
  assert.throws(
    () =>
      execFileSync(process.execPath, ['scripts/diagnose-scene.mjs', '--duration', '0'], {
        cwd: root,
        encoding: 'utf8',
        stdio: 'pipe',
      }),
    /Invalid durationMs/,
  );
});
