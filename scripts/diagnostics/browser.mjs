// Serializable page callbacks. No imported closures, injected runtime modes or fake clocks.
export function graphicsInfo() {
  const gl = window.Meridian.renderer.gl,
    debug = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
    maskedRenderer: gl.getParameter(gl.RENDERER),
    version: gl.getParameter(gl.VERSION),
  };
}

export async function measureScene({ durationMs, interactions, armyIds, anchors, paused }) {
  const { game, ui, renderer, diagnostics } = window.Meridian,
    state = game.s;
  const recorder = diagnostics.recorder;
  function check() {
    if (
      game.s !== state ||
      state.result ||
      state.stopped ||
      ui.view !== 'game' ||
      document.hidden ||
      recorder.stopped ||
      renderer.gl.isContextLost()
    )
      throw Error('Diagnostic scene interrupted');
    if (armyIds.some((id) => !game.get(id) || game.get(id).hp <= 0))
      throw Error('Diagnostic army changed');
  }
  function sceneState() {
    return {
      time: state.time,
      speed: state.speed,
      paused: ui.paused,
      hour: renderer.battlefieldHour,
      camera: { ...state.cam },
      selected: ui.selected.length,
      quality: renderer.quality,
      width: renderer.width,
      height: renderer.height,
      armyCount: armyIds.length,
    };
  }
  check();
  if (renderer.gl.getError()) throw Error('WebGL error before measurement');
  const before = recorder.report();
  const startState = sceneState();
  startState.paused = paused;
  const operations = [],
    timers = [];
  let visibilityListener;
  const started = performance.now();
  ui.paused = paused;
  try {
    await new Promise((resolve, reject) => {
      visibilityListener = () => {
        if (document.hidden) reject(Error('Diagnostic page hidden'));
      };
      document.addEventListener('visibilitychange', visibilityListener);
      timers.push(setTimeout(resolve, durationMs));
      for (const [index, action] of interactions.entries())
        timers.push(
          setTimeout(() => {
            try {
              check();
              const atMs = performance.now() - started;
              if (action.kind === 'selectArmy') {
                ui.select(armyIds, true);
                if (ui.selected.length !== armyIds.length) throw Error('Incomplete army selection');
              } else {
                const anchor =
                  action.target.anchor === 'world' ? { x: 0, z: 0 } : anchors[action.target.anchor];
                const x = anchor.x + action.target.x,
                  z = anchor.z + action.target.z;
                if (
                  !ui.submitAction({ kind: 'order', ids: armyIds, order: { type: 'move', x, z } })
                )
                  throw Error('Movement command rejected');
              }
              operations.push({
                index,
                kind: action.kind,
                scheduledAtMs: action.at * durationMs,
                atMs,
                finishedAtMs: performance.now() - started,
              });
            } catch (error) {
              reject(error);
            }
          }, action.at * durationMs),
        );
    });
    const elapsedMs = performance.now() - started;
    const endState = sceneState();
    ui.paused = true; // Drain GPU queries without advancing the measured simulation further.
    check();
    if (operations.length !== interactions.length)
      throw Error('Measurement ended before all interactions executed');
    if (renderer.gl.getError()) throw Error('WebGL error during measurement');
    const after = recorder.report();
    return {
      requestedMs: durationMs,
      elapsedMs,
      startState,
      endState,
      operations,
      range: {
        afterFrameId: before.callbacksSeen,
        throughFrameId: after.callbacksSeen,
        afterInteractionId: before.interactions.eventsSeen,
        throughInteractionId: after.interactions.eventsSeen,
      },
    };
  } finally {
    timers.forEach(clearTimeout);
    if (visibilityListener) document.removeEventListener('visibilitychange', visibilityListener);
    ui.paused = true;
  }
}

export function collectWindow(range) {
  const { diagnostics } = window.Meridian,
    report = diagnostics.report();
  report.recording = diagnostics.recorder.report(range);
  const frames = report.recording.frames;
  report.samples = report.samples.filter(
    (s) => frames.length && s.atMs >= frames[0].atMs && s.atMs <= frames.at(-1).atMs,
  );
  return report;
}
