/* Local-only diagnostic adapter. Explicit metadata allowlist, no persistence/telemetry. */
'use strict';
interface DiagnosticContext {
  view: string; paused: boolean; map: string | null; seed: number | null;
  simulationTime: number | null; speed: number | null; entities: number; effects: number;
  units: number | null; localUnits: number | null; localMilitaryUnits: number | null; selectedEntities: number | null;
  timeOfDayHours: number | null;
  camera: { x: number; z: number; zoom: number; yaw: number } | null;
}
function diagnosticContext(R: MeridianRenderer, game: MeridianGame, ui: MeridianUI,
    world: Battlefield | null, previewEntities: number): DiagnosticContext {
  const s = ui.view === 'game' ? game.s : null, localTeam = game.localTeam;
  let units = 0, localUnits = 0, localMilitaryUnits = 0;
  if (s) for (const e of s.entities) if (e.kind === 'unit' && e.hp > 0) {
    units++;
    if (e.team === localTeam) { localUnits++; if (e.type !== 'worker') localMilitaryUnits++; }
  }
  return { view: ui.view, paused: ui.paused, map: s?.map ?? world?.definition.name ?? null, seed: world?.seed ?? null,
    simulationTime: s?.time ?? null, speed: s?.speed ?? null,
    entities: s?.entities.length ?? previewEntities, effects: s ? game.effects.fx.length : 0,
    units: s ? units : null, localUnits: s ? localUnits : null, localMilitaryUnits: s ? localMilitaryUnits : null,
    selectedEntities: s ? ui.selected.length : null, timeOfDayHours: R.battlefieldHour ?? null,
    camera: s ? { x: s.cam.x, z: s.cam.z, zoom: s.cam.zoom, yaw: s.cam.yaw ?? 0 } : null };
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
  return { quality: R.quality, width: R.width, height: R.height, devicePixelRatio: typeof devicePixelRatio === 'number' ? devicePixelRatio : null,
    viewportWidth: R.viewport?.width ?? null, viewportHeight: R.viewport?.height ?? null, msaaSamples: R.sceneSamples,
    meshes, geometryBytesEstimate: geometryBytes, buckets, instances, instanceCapacityBytes,
    residentMaterialTextures: Object.values(R.textureResources).filter(t => t.resident).length,
    renderTargetBytesEstimate: sceneBytes + msaaBytes + bloomBytes + shadowBytes + (R.menuShadowBytes ?? 0),
    materialTextureBytes: null };
}
// Installed only on opt-in instance methods, never on shared simulation/world prototypes.
function instrumentDiagnosticMethod<T extends object, K extends keyof T>(recorder: MeridianDiagnosticRecorder,
    target: T, key: K, name: DiagnosticCpuDetail,
    interaction?: { kind: DiagnosticInteractionKind; capture: (event: DiagnosticInteraction) => void }): () => void {
  const original = target[key];
  if (typeof original !== 'function') return () => {};
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  const wrapped = function(this: unknown, ...args: unknown[]) {
    const event = interaction ? recorder.beginInteraction(interaction.kind) : undefined;
    if (event) {
      try { interaction!.capture(event); } catch { /* Missing metadata must not prevent an input. */ }
    }
    const scope = recorder.beginDetail(name);
    let failed = true;
    try { const result = Reflect.apply(original, this, args); failed = false; return result; }
    finally { recorder.endDetail(scope); recorder.finishInteraction(event, failed); }
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
      instrumentDiagnosticMethod(recorder, ui, 'updateHUD', 'hud'),
      instrumentDiagnosticMethod(recorder, ui, 'renderActions', 'hud'),
      instrumentDiagnosticMethod(recorder, ui, 'saveBattle', 'saveBattle'),
      instrumentDiagnosticMethod(recorder, ui, 'pick', 'entityPicking'),
      instrumentDiagnosticMethod(recorder, ui, 'targetPosition', 'targetPicking'));
    for (const [method, kind] of [['pointerUp', 'pointerRelease'], ['selectRectangle', 'selection'], ['select', 'selection'],
      ['submitAction', 'command'], ['perform', 'action'], ['applyTarget', 'target']] as const)
      releases.push(instrumentDiagnosticMethod(recorder, ui, method, kind, { kind, capture: event => {
        syncWorld();
        event.context = context();
        event.hidden = document.hidden;
        event.renderSettings = { quality: R.quality, width: R.width, height: R.height, devicePixelRatio };
      } }));
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
  const controls = document.createElement('div'), download = document.createElement('button'), halt = document.createElement('button'),
    status = document.createElement('span');
  controls.id = 'diagnosticControls';
  download.textContent = 'Export diagnostic JSON';
  halt.textContent = 'Stop recording';
  download.type = halt.type = 'button';
  const updateStatus = () => { status.textContent = `Build ${MERIDIAN_BUILD_INFO.id.slice(-12)} · GPU timing: ${probe.status}`; };
  updateStatus();
  controls.append(download, halt, status);
  document.body.appendChild(controls);
  function report() {
    updateStatus();
    return { schema: 3, build: MERIDIAN_BUILD_INFO, applicationVersion: window.Meridian?.version ?? '1.0.0',
      environment: { browser: navigator.userAgent, devicePixelRatio },
      notes: [
        'Local opt-in recording; no URLs, credentials, player names or game snapshots.',
        'CPU values are elapsed callback/phase time including diagnostic overhead; GL submission is not GPU time.',
        'cpuDetails are exclusive nested CPU times/call counts within each parent phase; do not add them to cpuMs.',
        'Detail summaries include zeros for uncalled methods in measured parent phases. Calls are method invocations, not entity counts.',
        'Interactions are a separate bounded stream of synchronous root UI calls outside rAF, not frame CPU samples. Nested calls have exclusive input cpuDetails; never add them to the inclusive root duration.',
        'Root context is captured before the call. Pointer release includes picking/selection/command work; action includes panel handling. Event counts are root calls, not clicks or successfully executed commands.',
        'Input queueing delay, async continuation, hover/move handlers, loading and idle work outside these hooks are not measured. Interaction hooks called during rAF stay in the active frame phase.',
        'Frame intervals distinguish rAF callbacks from actual renders; the 60 FPS cap still applies.',
        'GPU measurements are sparse and asynchronous. Missing timings are not zero. Scene includes MSAA resolve.',
        'Scene context/resources are sampled after rendering at most once/second, last 120 samples; interactions also capture context and render settings before the root call. Sampling cost is diagnostic overhead. Byte estimates are not driver memory.',
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
    updateStatus();
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
        updateStatus();
        samples.push({ atMs: frame.atMs, hidden: document.hidden, context: context(), resources: diagnosticResources(R) });
        if (samples.length > 120) samples.shift();
      }
      recorder.finishFrame(rendered);
    }
  };
}
