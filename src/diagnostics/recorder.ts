/* Optional, bounded measurements. No game state, DOM, storage or network access. */
'use strict';
type DiagnosticCpuPhase = 'simulation' | 'ui' | 'audio' | 'sceneBuild' | 'glSubmission' | 'overlay';
type DiagnosticGpuPass = 'thumbnails' | 'shadow' | 'scene' | 'bloom' | 'post';
type DiagnosticCpuDetail = 'tick' | 'movement' | 'collision' | 'pathPreparation' | 'pathfinding' |
  'settlements' | 'settlementLayout' | 'settlementGrowth' | 'navigationRebuild' | 'visibility' | 'spatialHash' | 'ai' |
  'hud' | 'saveBattle' | 'snapshot' | 'worldSync' | 'workerRoads' | 'buildingGround' | 'entities' | 'effects' | 'guides' |
  'instanceUploads' | 'drawSubmission' | 'thumbnails';
type DiagnosticCpuDetails = Partial<Record<DiagnosticCpuPhase,
  Partial<Record<DiagnosticCpuDetail, { ms: number; calls: number }>>>>;
interface DiagnosticCpuScope {
  frame: DiagnosticFrame; phase: DiagnosticCpuPhase; name: DiagnosticCpuDetail;
  started: number; childMs: number; parent?: DiagnosticCpuScope;
}
interface DiagnosticFrame {
  id: number;
  atMs: number;
  rafIntervalMs: number | null;
  renderIntervalMs: number | null;
  rendered: boolean;
  callbackMs: number;
  cpuMs: Partial<Record<DiagnosticCpuPhase, number>>;
  cpuDetails: DiagnosticCpuDetails;
  gpuMs: Partial<Record<DiagnosticGpuPass, number>>;
  render?: {
    instanceUploadBytes: number;
    passes: Partial<Record<DiagnosticGpuPass, { drawCalls: number; triangles: number; instances: number }>>;
  };
}
class MeridianDiagnosticRecorder {
  private frames: DiagnosticFrame[] = [];
  private cursor = 0;
  private sequence = 0;
  private origin: number | undefined;
  private previousRaf: number | undefined;
  private previousRender: number | undefined;
  private started = 0;
  private phaseStarted = 0;
  private activePhase?: DiagnosticCpuPhase;
  private detail?: DiagnosticCpuScope;
  current?: DiagnosticFrame;
  stopped: string | null = null;
  constructor(private readonly clock: () => number, readonly capacity = 6000) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 6000) throw Error('Invalid diagnostic capacity');
  }
  beginFrame(timestamp: number) {
    if (this.stopped) return;
    this.origin ??= timestamp;
    this.current = { id: ++this.sequence, atMs: timestamp - this.origin,
      rafIntervalMs: this.previousRaf === undefined ? null : timestamp - this.previousRaf,
      renderIntervalMs: null, rendered: false, callbackMs: 0, cpuMs: {}, cpuDetails: {}, gpuMs: {} };
    this.previousRaf = timestamp;
    this.detail = undefined;
    this.started = this.clock();
    this.phase('simulation');
  }
  phase(name?: DiagnosticCpuPhase) {
    if (!this.current) return;
    const now = this.clock();
    if (this.activePhase) this.current.cpuMs[this.activePhase] =
      (this.current.cpuMs[this.activePhase] || 0) + Math.max(0, now - this.phaseStarted);
    this.activePhase = name;
    this.phaseStarted = now;
  }
  beginDetail(name: DiagnosticCpuDetail): DiagnosticCpuScope | undefined {
    const frame = this.current, phase = this.activePhase;
    if (!frame || !phase) return;
    const details = frame.cpuDetails[phase] ??= {}, value = details[name] ??= { ms: 0, calls: 0 };
    value.calls++;
    return this.detail = { frame, phase, name, started: this.clock(), childMs: 0, parent: this.detail };
  }
  endDetail(scope: DiagnosticCpuScope | undefined) {
    if (!scope || this.current !== scope.frame || this.detail !== scope) return;
    const elapsed = Math.max(0, this.clock() - scope.started);
    // Exclusive nested times: movement excludes pathfinding/collision, including recursive Yield.
    scope.frame.cpuDetails[scope.phase]![scope.name]!.ms += Math.max(0, elapsed - scope.childMs);
    if (scope.parent) scope.parent.childMs += elapsed;
    this.detail = scope.parent;
  }
  finishFrame(rendered: boolean) {
    if (!this.current) return;
    this.phase();
    const frame = this.current;
    frame.rendered = rendered;
    if (rendered) {
      frame.renderIntervalMs = this.previousRender === undefined ? null : frame.atMs - this.previousRender;
      this.previousRender = frame.atMs;
    }
    frame.callbackMs = Math.max(0, this.clock() - this.started);
    this.frames[this.cursor] = frame;
    this.cursor = (this.cursor + 1) % this.capacity;
    this.current = undefined;
    this.detail = undefined;
  }
  stop(reason: string) {
    this.stopped ??= reason;
    // A failed/incomplete callback must not masquerade as a completed frame.
    this.current = undefined;
    this.activePhase = undefined;
    this.detail = undefined;
  }
  report() {
    const frames = this.frames.length < this.capacity ? this.frames.slice() :
      this.frames.slice(this.cursor).concat(this.frames.slice(0, this.cursor));
    const distribution = (values: number[]) => {
      if (!values.length) return null;
      values.sort((a, b) => a - b);
      const percentile = (p: number) => values[Math.max(0, Math.ceil(values.length * p) - 1)];
      return { samples: values.length, p50: percentile(.5), p95: percentile(.95), p99: percentile(.99), max: values[values.length - 1] };
    };
    const cpu: Partial<Record<DiagnosticCpuPhase, ReturnType<typeof distribution>>> = {},
      gpu: Partial<Record<DiagnosticGpuPass, ReturnType<typeof distribution>>> = {};
    for (const phase of ['simulation', 'ui', 'audio', 'sceneBuild', 'glSubmission', 'overlay'] as const)
      cpu[phase] = distribution(frames.flatMap(f => f.cpuMs[phase] === undefined ? [] : [f.cpuMs[phase]!]));
    const cpuDetails: Partial<Record<DiagnosticCpuPhase, Partial<Record<DiagnosticCpuDetail,
      { ms: ReturnType<typeof distribution>; calls: ReturnType<typeof distribution> }>>>> = {};
    for (const phase of ['simulation', 'ui', 'audio', 'sceneBuild', 'glSubmission', 'overlay'] as const) {
      const measured = frames.filter(f => f.cpuMs[phase] !== undefined), names = new Set<DiagnosticCpuDetail>();
      for (const frame of measured) for (const name of Object.keys(frame.cpuDetails[phase] ?? {})) names.add(name as DiagnosticCpuDetail);
      if (!names.size) continue;
      const details: NonNullable<(typeof cpuDetails)[DiagnosticCpuPhase]> = {};
      cpuDetails[phase] = details;
      for (const name of names) details[name] = {
        // A measured parent with no call has zero cost; skipped parent phases are not samples.
        ms: distribution(measured.map(f => f.cpuDetails[phase]?.[name]?.ms ?? 0)),
        calls: distribution(measured.map(f => f.cpuDetails[phase]?.[name]?.calls ?? 0))
      };
    }
    for (const pass of ['thumbnails', 'shadow', 'scene', 'bloom', 'post'] as const)
      gpu[pass] = distribution(frames.flatMap(f => f.gpuMs[pass] === undefined ? [] : [f.gpuMs[pass]!]));
    return { capacity: this.capacity, callbacksSeen: this.sequence, stopped: this.stopped,
      summary: { callbacks: frames.length, rendered: frames.filter(f => f.rendered).length,
        callbackWorkMs: distribution(frames.map(f => f.callbackMs)),
        rafIntervalMs: distribution(frames.flatMap(f => f.rafIntervalMs === null ? [] : [f.rafIntervalMs])),
        renderIntervalMs: distribution(frames.flatMap(f => f.renderIntervalMs === null ? [] : [f.renderIntervalMs])),
        rafGapsOver50ms: frames.filter(f => (f.rafIntervalMs ?? 0) > 50).length,
        cpuMs: cpu, cpuDetails, gpuMs: gpu }, frames };
  }
}
