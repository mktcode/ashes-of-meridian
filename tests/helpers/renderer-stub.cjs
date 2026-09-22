// CPU-only boundary for world/model tests. No geometry/GPU allocations are kept.
// Simulation tests leave recording off to avoid retaining visual placements.
function createRendererStub({ record = false } = {}) {
  return {
    calls: [],
    fogPixels: null,
    clearStatic() { this.calls.length = 0; },
    geometry() {},
    releaseGeometry() {},
    add(...args) { if (record) this.calls.push(args); },
    color(c) {
      if (Array.isArray(c) || c instanceof Float32Array) return c;
      if (typeof c === 'string') c = parseInt(c.replace('#', ''), 16);
      return [(c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255];
    },
    fog(data) { this.fogPixels = Uint8Array.from(data); },
  };
}

module.exports = { createRendererStub };
