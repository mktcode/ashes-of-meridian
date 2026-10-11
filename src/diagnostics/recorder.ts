/* Optional, bounded measurements. No game state, DOM, storage or network access. */
'use strict';
declare const MERIDIAN_BUILD_INFO: Readonly<{ id: string; commit: string | null; dirty: boolean | null }>;
type DiagnosticInteractionKind = 'pointerRelease' | 'selection' | 'command' | 'action' | 'target';
type DiagnosticDetailPhase = DiagnosticCpuPhase | 'input';
type DiagnosticCpuPhase = 'simulation' | 'ui' | 'audio' | 'sceneBuild' | 'glSubmission' | 'overlay';
type DiagnosticGpuPass = 'thumbnails' | 'shadow' | 'scene' | 'bloom' | 'post';
type DiagnosticCpuDetail = 'tick' | 'movement' | 'collision' | 'pathPreparation' | 'pathfinding' |
  'settlements' | 'settlementLayout' | 'settlementGrowth' | 'navigationRebuild' | 'visibility' | 'spatialHash' | 'ai' |
  'hud' | 'saveBattle' | 'snapshot' | 'worldSync' | 'workerRoads' | 'buildingGround' | 'entities' | 'effects' | 'guides' |
  'instanceUploads' | 'drawSubmission' | 'thumbnails' | 'entityPicking' | 'targetPicking' | DiagnosticInteractionKind;
type DiagnosticCpuDetails = Partial<Record<DiagnosticDetailPhase,
  Partial<Record<DiagnosticCpuDetail, { ms: number; calls: number }>>>>;
interface DiagnosticInteraction {
  id: number; kind: DiagnosticInteractionKind; atMs: number; durationMs: number; failed: boolean;
  cpuDetails: DiagnosticCpuDetails;
  context?: DiagnosticContext;
  hidden?: boolean;
  renderSettings?: { quality: number; width: number; height: number; devicePixelRatio: number };
}
interface DiagnosticCpuScope {
  measurement: DiagnosticFrame | DiagnosticInteraction; phase: DiagnosticDetailPhase; name: DiagnosticCpuDetail;
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
  private interactions: DiagnosticInteraction[] = [];
  private interactionCursor = 0;
  private interactionSequence = 0;
  private interactionStarted = 0;
  private interaction?: DiagnosticInteraction;
  current?: DiagnosticFrame;
  stopped: string | null = null;
  constructor(private readonly clock: () => number, readonly capacity = 6000, readonly interactionCapacity = 512) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 6000) throw Error('Invalid diagnostic capacity');
    if (!Number.isInteger(interactionCapacity) || interactionCapacity < 1 || interactionCapacity > 512)
      throw Error('Invalid interaction capacity');
  }
  beginInteraction(kind: DiagnosticInteractionKind): DiagnosticInteraction | undefined {
    // Nested UI methods belong to one root call. Calls during rAF stay in their frame phase.
    if (this.stopped || this.current || this.interaction) return;
    const now = this.clock();
    this.origin ??= now;
    this.interactionStarted = now;
    this.detail = undefined;
    return this.interaction = { id: ++this.interactionSequence, kind, atMs: now-this.origin,
      durationMs: 0, failed: false, cpuDetails: {} };
  }
  finishInteraction(event: DiagnosticInteraction | undefined, failed = false) {
    if (!event || this.interaction !== event) return;
    event.durationMs = Math.max(0, this.clock()-this.interactionStarted);
    event.failed = failed;
    this.interactions[this.interactionCursor] = event;
    this.interactionCursor = (this.interactionCursor+1) % this.interactionCapacity;
    this.interaction = undefined;
    this.detail = undefined;
  }
  beginFrame(timestamp: number) {
    if (this.stopped || this.interaction) return;
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
    const measurement = this.current ?? this.interaction, phase = this.current ? this.activePhase : 'input';
    if (!measurement || !phase) return;
    const details = measurement.cpuDetails[phase] ??= {}, value = details[name] ??= { ms: 0, calls: 0 };
    value.calls++;
    return this.detail = { measurement, phase, name, started: this.clock(), childMs: 0, parent: this.detail };
  }
  endDetail(scope: DiagnosticCpuScope | undefined) {
    if (!scope || (this.current ?? this.interaction) !== scope.measurement || this.detail !== scope) return;
    const elapsed = Math.max(0, this.clock() - scope.started);
    // Exclusive nested times: movement excludes pathfinding/collision, including recursive Yield.
    scope.measurement.cpuDetails[scope.phase]![scope.name]!.ms += Math.max(0, elapsed - scope.childMs);
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
    this.interaction = undefined;
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
    const events = this.interactions.length < this.interactionCapacity ? this.interactions.slice() :
      this.interactions.slice(this.interactionCursor).concat(this.interactions.slice(0, this.interactionCursor));
    const interactionSummary: Partial<Record<DiagnosticInteractionKind, {
      durationMs: ReturnType<typeof distribution>; failed: number;
      cpuDetails: Partial<Record<DiagnosticCpuDetail, { ms: ReturnType<typeof distribution>; calls: ReturnType<typeof distribution> }>>;
    }>> = {};
    for (const kind of ['pointerRelease', 'selection', 'command', 'action', 'target'] as const) {
      const measured = events.filter(e => e.kind === kind);
      if (!measured.length) continue;
      const names = new Set(measured.flatMap(e => Object.keys(e.cpuDetails.input ?? {})) as DiagnosticCpuDetail[]);
      const details: NonNullable<(typeof interactionSummary)[DiagnosticInteractionKind]>['cpuDetails'] = {};
      for (const name of names) details[name] = {
        ms: distribution(measured.map(e => e.cpuDetails.input?.[name]?.ms ?? 0)),
        calls: distribution(measured.map(e => e.cpuDetails.input?.[name]?.calls ?? 0))
      };
      interactionSummary[kind] = { durationMs: distribution(measured.map(e => e.durationMs)),
        failed: measured.filter(e => e.failed).length, cpuDetails: details };
    }
    return { capacity: this.capacity, callbacksSeen: this.sequence, stopped: this.stopped,
      interactions: { capacity: this.interactionCapacity, eventsSeen: this.interactionSequence, summary: interactionSummary, events },
      summary: { callbacks: frames.length, rendered: frames.filter(f => f.rendered).length,
        callbackWorkMs: distribution(frames.map(f => f.callbackMs)),
        rafIntervalMs: distribution(frames.flatMap(f => f.rafIntervalMs === null ? [] : [f.rafIntervalMs])),
        renderIntervalMs: distribution(frames.flatMap(f => f.renderIntervalMs === null ? [] : [f.renderIntervalMs])),
        rafGapsOver50ms: frames.filter(f => (f.rafIntervalMs ?? 0) > 50).length,
        cpuMs: cpu, cpuDetails, gpuMs: gpu }, frames };
  }
}
