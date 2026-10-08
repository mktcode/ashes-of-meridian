/* Local-only diagnostic adapter. Explicit metadata allowlist, no persistence/telemetry. */
'use strict';
interface DiagnosticContext {
  view: string; paused: boolean; map: string | null; seed: number | null;
  simulationTime: number | null; speed: number | null; entities: number; effects: number;
}
function diagnosticResources(R: MeridianRenderer) {
  let meshes = 0, geometryBytes = 0, buckets = 0, instances = 0, instanceCapacityBytes = 0;
  for (const mesh of Object.values(R.meshes)) { meshes++; geometryBytes += mesh.count * 9 * 4; }
  for (const map of [R.static, R.dynamic, R.effects, R.occlusion]) for (const b of Object.values(map ?? {})) {
    buckets++; instances += b.n; instanceCapacityBytes += b.data.byteLength;
  }
  // Depth storage is estimated at four bytes/pixel; driver allocation/padding is unknown.
  const sceneBytes = R.width * R.height * 8,
    msaaBytes = R.sceneSamples > 1 ? sceneBytes * R.sceneSamples : 0,
    bloomBytes = R.bloomTargets.length * R.bloomWidth * R.bloomHeight * 4,
    shadowBytes = R.shadowTex ? R.shadowSize * R.shadowSize * 4 : 0;
  return { quality: R.quality, width: R.width, height: R.height, msaaSamples: R.sceneSamples,
    meshes, geometryBytesEstimate: geometryBytes, buckets, instances, instanceCapacityBytes,
    residentMaterialTextures: Object.values(R.textureResources).filter(t => t.resident).length,
    renderTargetBytesEstimate: sceneBytes + msaaBytes + bloomBytes + shadowBytes + (R.menuShadowBytes ?? 0),
    materialTextureBytes: null };
}
// Installed only on opt-in instance methods, never on shared simulation/world prototypes.
function instrumentDiagnosticMethod<T extends object, K extends keyof T>(recorder: MeridianDiagnosticRecorder,
    target: T, key: K, name: DiagnosticCpuDetail): () => void {
  const original = target[key];
  if (typeof original !== 'function') return () => {};
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  const wrapped = function(this: unknown, ...args: unknown[]) {
    const scope = recorder.beginDetail(name);
    try { return Reflect.apply(original, this, args); }
    finally { recorder.endDetail(scope); }
  };
  Object.defineProperty(target, key, { value: wrapped, configurable: true, writable: true, enumerable: descriptor?.enumerable ?? false });
  return () => {
    if (target[key] !== wrapped) return; // Do not overwrite a later owner's replacement.
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else Reflect.deleteProperty(target, key);
  };
}
function createMeridianDiagnostics(R: MeridianRenderer, context: () => DiagnosticContext,
    targets?: { game: MeridianGame; worldView: BattlefieldView; ui: MeridianUI; thumbnails?: MeridianModelThumbnails }) {
  const recorder = new MeridianDiagnosticRecorder(() => performance.now()), probe = new MeridianRenderProbe(R.gl, recorder);
  R.diagnostics = probe;
  const releases: (() => void)[] = [], worldReleases: (() => void)[] = [];
  let world: Battlefield | null | undefined;
  releases.push(instrumentDiagnosticMethod(recorder, R, 'upload', 'instanceUploads'),
    instrumentDiagnosticMethod(recorder, R, 'drawBatches', 'drawSubmission'));
  if (targets) {
    const { game, worldView, ui } = targets;
    for (const [method, name] of [
      ['step', 'tick'], ['move', 'movement'], ['moveYield', 'movement'],
      ['unitFits', 'collision'], ['yieldUnitSpace', 'collision'], ['pathTo', 'pathPreparation'],
      ['updateSettlements', 'settlements'], ['refreshSettlementLayouts', 'settlementLayout'], ['growSettlement', 'settlementGrowth'],
      ['rehash', 'spatialHash'], ['aiTick', 'ai'], ['snapshotBattle', 'snapshot']
    ] as const) releases.push(instrumentDiagnosticMethod(recorder, game, method, name));
    for (const [method, name] of [
      ['sync', 'worldSync'], ['updateWorkerRoads', 'workerRoads'],
      ['retainBuildingGround', 'buildingGround'], ['drawBuildingGround', 'buildingGround']
    ] as const) releases.push(instrumentDiagnosticMethod(recorder, worldView, method, name));
    releases.push(instrumentDiagnosticMethod(recorder, ui, 'tick', 'hud'),
      instrumentDiagnosticMethod(recorder, ui, 'saveBattle', 'saveBattle'));
    if (targets.thumbnails) releases.push(instrumentDiagnosticMethod(recorder, targets.thumbnails, 'update', 'thumbnails'));
  }
  function syncWorld() {
    const next = targets?.game.world;
    if (next === world) return;
    for (const release of worldReleases.splice(0)) release();
    world = next;
    if (world) for (const [method, name] of [
      ['path', 'pathfinding'], ['rebuild', 'navigationRebuild'], ['reveal', 'visibility']
    ] as const) worldReleases.push(instrumentDiagnosticMethod(recorder, world, method, name));
  }
  const samples: { atMs: number; hidden: boolean; context: DiagnosticContext; resources: ReturnType<typeof diagnosticResources> }[] = [];
  let lastSample = -Infinity;
  const controls = document.createElement('div'), download = document.createElement('button'), halt = document.createElement('button');
  controls.id = 'diagnosticControls';
  download.textContent = 'Export diagnostic JSON';
  halt.textContent = 'Stop recording';
  download.type = halt.type = 'button';
  controls.append(download, halt);
  document.body.appendChild(controls);
  function report() {
    return { schema: 2, applicationVersion: window.Meridian?.version ?? '1.0.0',
      environment: { browser: navigator.userAgent, devicePixelRatio },
      notes: [
        'Local opt-in recording; no URLs, credentials, player names or game snapshots.',
        'CPU values are elapsed callback/phase time including diagnostic overhead; GL submission is not GPU time.',
        'cpuDetails are exclusive nested CPU times/call counts within each parent phase; do not add them to cpuMs.',
        'Detail summaries include zeros for uncalled methods in measured parent phases. Calls are method invocations, not entity counts.',
        'Only synchronous work inside recorded rAF phases is attributed; input handlers, loading and idle work outside rAF are not measured.',
        'Frame intervals distinguish rAF callbacks from actual renders; the 60 FPS cap still applies.',
        'GPU measurements are sparse and asynchronous. Missing timings are not zero. Scene includes MSAA resolve.',
        'Resources are sampled after rendering at most once/second, last 120 samples. Byte estimates are not driver memory.',
        'Texture bytes, browser compositor, OS/GPU memory and device temperature are not measured.',
        'Summaries cover retained callbacks and may mix menus, quality levels, pauses and background gaps.'
      ], recording: recorder.report(), gpu: probe.report(), samples: samples.slice() };
  }
  function exportReport() {
    const blob = new Blob([JSON.stringify(report(), null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = 'ashes-of-meridian-diagnostics.json';
    document.body.appendChild(link);
    try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
  function stop(reason = 'manual') {
    if (recorder.stopped) return;
    recorder.stop(reason);
    probe.stop(reason === 'context-lost');
    R.diagnostics = undefined;
    for (const release of worldReleases.splice(0)) release();
    for (const release of releases.splice(0)) release();
    world = undefined;
    halt.disabled = true;
    halt.textContent = 'Recording stopped';
  }
  download.onclick = exportReport;
  halt.onclick = () => stop();
  addEventListener('pagehide', () => stop('page-hidden'));
  return { recorder, report, exportReport, stop,
    beginFrame(timestamp: number) {
      if (recorder.stopped) return;
      syncWorld();
      recorder.beginFrame(timestamp);
    },
    finishFrame(rendered: boolean) {
      const frame = recorder.current;
      recorder.phase(); // Resource sampling belongs to callback overhead, not the overlay phase.
      if (frame && rendered && frame.atMs - lastSample >= 1000) {
        lastSample = frame.atMs;
        samples.push({ atMs: frame.atMs, hidden: document.hidden, context: context(), resources: diagnosticResources(R) });
        if (samples.length > 120) samples.shift();
      }
      recorder.finishFrame(rendered);
    }
  };
}
