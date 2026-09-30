/* Renderer probe: sparse asynchronous GPU queries and submitted-work counters. */
'use strict';
interface DiagnosticTimerExtension { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number; }
class MeridianRenderProbe {
  private extension: DiagnosticTimerExtension | null = null;
  private pending: { query: WebGLQuery; frame: DiagnosticFrame; pass: DiagnosticGpuPass }[] = [];
  private active?: { query: WebGLQuery; frame: DiagnosticFrame; pass: DiagnosticGpuPass };
  private pass?: DiagnosticGpuPass;
  private rendered = 0;
  private sample = false;
  private closed = false;
  status: 'available' | 'unavailable' | 'error' | 'context-lost' = 'unavailable';
  discarded = 0;
  skipped = 0;
  constructor(private readonly gl: WebGL2RenderingContext, private readonly recorder: MeridianDiagnosticRecorder) {
    try {
      this.extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (this.extension) this.status = 'available';
    } catch { this.status = 'error'; }
  }
  beginFrame() {
    const frame = this.recorder.current;
    if (!frame || this.closed) return;
    frame.render = { instanceUploadBytes: 0, passes: {} };
    // Passes every fifteenth rendered frame, never one query per rAF.
    this.sample = this.rendered++ % 15 === 0;
    if (this.sample && this.extension && this.status === 'available') {
      try {
        if (this.gl.isContextLost()) { this.stop(true); return; }
        if (this.gl.getParameter(this.extension.GPU_DISJOINT_EXT)) {
          this.discardPending(); this.sample = false; return;
        }
        for (let i = this.pending.length - 1; i >= 0; i--) {
          const item = this.pending[i];
          if (!this.gl.getQueryParameter(item.query, this.gl.QUERY_RESULT_AVAILABLE)) continue;
          const ns: number = this.gl.getQueryParameter(item.query, this.gl.QUERY_RESULT);
          if (Number.isFinite(ns) && ns >= 0) item.frame.gpuMs[item.pass] = ns / 1e6;
          this.gl.deleteQuery(item.query);
          this.pending.splice(i, 1);
        }
      } catch { this.fail(); }
    }
  }
  beginPass(pass: DiagnosticGpuPass) {
    this.pass = pass;
    const frame = this.recorder.current;
    if (!frame || !this.sample || !this.extension || this.status !== 'available' || this.closed) return;
    try {
      // Do not nest with another timer user (for example a graphics debugging tool).
      if (this.active || this.pending.length >= 24 || this.gl.getQuery(this.extension.TIME_ELAPSED_EXT, this.gl.CURRENT_QUERY)) {
        this.skipped++; return;
      }
      const query = this.gl.createQuery();
      if (!query) { this.skipped++; return; }
      this.active = { query, frame, pass };
      this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT, query);
    } catch { this.fail(); }
  }
  endPass() {
    this.pass = undefined;
    if (!this.active || !this.extension) return;
    try {
      this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);
      this.pending.push(this.active);
      this.active = undefined;
    } catch { this.fail(); }
  }
  draw(vertices: number, instances = 1) {
    const render = this.recorder.current?.render;
    if (!render || !this.pass) return;
    const count = render.passes[this.pass] ||= { drawCalls: 0, triangles: 0, instances: 0 };
    count.drawCalls++; count.triangles += vertices / 3 * instances; count.instances += instances;
  }
  upload(bytes: number) {
    const render = this.recorder.current?.render;
    if (render) render.instanceUploadBytes += bytes;
  }
  private discardPending() {
    this.discarded += this.pending.length;
    for (const item of this.pending) {
      try { this.gl.deleteQuery(item.query); } catch { this.status = 'error'; }
    }
    this.pending = [];
  }
  private fail() {
    this.status = 'error';
    this.stop(false);
    this.closed = false; // Keep work counters usable even if timing failed.
  }
  stop(contextLost: boolean) {
    this.closed = true;
    if (contextLost) this.status = 'context-lost';
    // On loss WebGL invalidates all query objects. Never read results afterwards.
    if (!contextLost) {
      if (this.active && this.extension) {
        try {
          if (this.gl.getQuery(this.extension.TIME_ELAPSED_EXT, this.gl.CURRENT_QUERY) === this.active.query)
            this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);
        } catch { /* A failed beginQuery need not have an active timer. */ }
        try { this.gl.deleteQuery(this.active.query); } catch { /* Driver/context failure. */ }
      }
      this.discardPending();
    } else this.discarded += this.pending.length + (this.active ? 1 : 0);
    this.pending = [];
    this.active = undefined;
  }
  report() {
    return { status: this.status, sampleEveryRenderedFrames: 15, pendingLimit: 24,
      pending: this.pending.length, discarded: this.discarded, skipped: this.skipped };
  }
}
