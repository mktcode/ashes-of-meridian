/* Optional, bounded measurements. No game state, DOM, storage or network access. */
'use strict';
type DiagnosticCpuPhase = 'simulation' | 'networkPresentation' | 'ui' | 'audio' | 'sceneBuild' | 'glSubmission' | 'overlay';
type DiagnosticGpuPass = 'shadow' | 'scene' | 'bloom' | 'post';
interface DiagnosticFrame {
  id: number;
  atMs: number;
  rafIntervalMs: number | null;
  renderIntervalMs: number | null;
  rendered: boolean;
  callbackMs: number;
  cpuMs: Partial<Record<DiagnosticCpuPhase, number>>;
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
      renderIntervalMs: null, rendered: false, callbackMs: 0, cpuMs: {}, gpuMs: {} };
    this.previousRaf = timestamp;
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
  }
  stop(reason: string) {
    this.stopped ??= reason;
    // A failed/incomplete callback must not masquerade as a completed frame.
    this.current = undefined;
    this.activePhase = undefined;
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
    for (const phase of ['simulation', 'networkPresentation', 'ui', 'audio', 'sceneBuild', 'glSubmission', 'overlay'] as const)
      cpu[phase] = distribution(frames.flatMap(f => f.cpuMs[phase] === undefined ? [] : [f.cpuMs[phase]!]));
    for (const pass of ['shadow', 'scene', 'bloom', 'post'] as const)
      gpu[pass] = distribution(frames.flatMap(f => f.gpuMs[pass] === undefined ? [] : [f.gpuMs[pass]!]));
    return { capacity: this.capacity, callbacksSeen: this.sequence, stopped: this.stopped,
      summary: { callbacks: frames.length, rendered: frames.filter(f => f.rendered).length,
        callbackWorkMs: distribution(frames.map(f => f.callbackMs)),
        rafIntervalMs: distribution(frames.flatMap(f => f.rafIntervalMs === null ? [] : [f.rafIntervalMs])),
        renderIntervalMs: distribution(frames.flatMap(f => f.renderIntervalMs === null ? [] : [f.renderIntervalMs])),
        rafGapsOver50ms: frames.filter(f => (f.rafIntervalMs ?? 0) > 50).length,
        cpuMs: cpu, gpuMs: gpu }, frames };
  }
}
