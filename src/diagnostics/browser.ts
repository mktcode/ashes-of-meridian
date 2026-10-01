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
    renderTargetBytesEstimate: sceneBytes + msaaBytes + bloomBytes + shadowBytes,
    materialTextureBytes: null };
}
function createMeridianDiagnostics(R: MeridianRenderer, context: () => DiagnosticContext) {
  const recorder = new MeridianDiagnosticRecorder(() => performance.now()), probe = new MeridianRenderProbe(R.gl, recorder);
  R.diagnostics = probe;
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
    return { schema: 1, applicationVersion: window.Meridian?.version ?? '1.0.0',
      environment: { browser: navigator.userAgent, devicePixelRatio },
      notes: [
        'Local opt-in recording; no URLs, credentials, player names or game snapshots.',
        'CPU values are elapsed callback/phase time including diagnostic overhead; GL submission is not GPU time.',
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
    halt.disabled = true;
    halt.textContent = 'Recording stopped';
  }
  download.onclick = exportReport;
  halt.onclick = () => stop();
  addEventListener('pagehide', () => stop('page-hidden'));
  return { recorder, report, exportReport, stop,
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
