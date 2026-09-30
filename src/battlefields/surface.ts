/* One CPU-owned playable surface. Props and roofs are not additional walkable layers. */
'use strict';
class BattlefieldSurface {
  readonly step: number;
  readonly size: number;
  readonly heights: Float32Array;
  readonly cliffs: Uint8Array;
  readonly maxHeight: number;
  // Immutable flight envelopes, baked with the terrain, never searched per unit/frame.
  private readonly flights: readonly { floor: Float32Array; cruise: Float32Array }[];
  /** Walkable structures may still forbid foundations (for example bridge decks). */
  buildBlocked?: Uint8Array;
  constructor(readonly extent: number, readonly cellSize: number, height: (x: number, z: number) => number,
      readonly visibilityLevel: (height: number, x: number, z: number) => number = () => 0) {
    this.step = cellSize / 2;
    this.size = Math.round(extent * 2 / this.step) + 1;
    this.heights = new Float32Array(this.size * this.size);
    this.cliffs = new Uint8Array((extent * 2 / cellSize) ** 2);
    let max = 0;
    for (let z = 0; z < this.size; z++) for (let x = 0; x < this.size; x++) {
      const h = height(x * this.step - extent, z * this.step - extent);
      this.heights[z * this.size + x] = h; max = Math.max(max, h);
    }
    this.maxHeight = max;
    const grid = extent * 2 / cellSize;
    for (let z = 0; z < this.size - 1; z++) for (let x = 0; x < this.size - 1; x++) {
      const i = z * this.size + x, a = this.heights[i], b = this.heights[i + 1],
        c = this.heights[i + this.size + 1], d = this.heights[i + this.size];
      // The two triangles are a-d-c and a-c-b, also used by heightAt and the view.
      if (Math.max(Math.hypot(c - d, d - a), Math.hypot(b - a, c - b)) / this.step > .65)
        this.cliffs[Math.floor(z / 2) * grid + Math.floor(x / 2)] = 1;
    }
    // Conservative yaw/animation footprints for the light aircraft and authored destroyers.
    this.flights = [this.flightEnvelope(3.5), this.flightEnvelope(10)];
  }
  private flightEnvelope(radius: number) {
    const n = this.size, reach = Math.ceil(radius / this.step) + 1,
      scratch = new Float32Array(this.heights.length), floor = new Float32Array(this.heights.length),
      queue = new Int32Array(n);
    // Separable sliding maxima cover the whole hull, including terrain triangle corners.
    const scan = (input: Float32Array, output: Float32Array, start: number, stride: number) => {
      let head = 0, tail = 0, right = 0;
      for (let i = 0; i < n; i++) {
        while (right < n && right <= i + reach) {
          while (tail > head && input[start + queue[tail - 1] * stride] <= input[start + right * stride]) tail--;
          queue[tail++] = right++;
        }
        while (queue[head] < i - reach) head++;
        output[start + i * stride] = input[start + queue[head] * stride];
      }
    };
    for (let z = 0; z < n; z++) scan(this.heights, scratch, z * n, 1);
    for (let x = 0; x < n; x++) scan(scratch, floor, x, n);
    const cruise = floor.slice(), rise = this.step * .5;
    // Max-plus distance transform: nearby peaks cause gradual approach/departure,
    // but a distant summit no longer dictates the altitude of the entire map.
    for (let z = 0; z < n; z++) {
      for (let x = 1; x < n; x++) { const i = z * n + x; cruise[i] = Math.max(cruise[i], cruise[i - 1] - rise); }
      for (let x = n - 2; x >= 0; x--) { const i = z * n + x; cruise[i] = Math.max(cruise[i], cruise[i + 1] - rise); }
    }
    for (let x = 0; x < n; x++) {
      for (let z = 1; z < n; z++) { const i = z * n + x; cruise[i] = Math.max(cruise[i], cruise[i - n] - rise); }
      for (let z = n - 2; z >= 0; z--) { const i = z * n + x; cruise[i] = Math.max(cruise[i], cruise[i + n] - rise); }
    }
    return { floor, cruise };
  }
  heightAt(x: number, z: number): number {
    return this.sampleHeight(this.heights, x, z);
  }
  private sampleHeight(heights: Float32Array, x: number, z: number): number {
    const gx = Math.max(0, Math.min(this.size - 1, (x + this.extent) / this.step)),
      gz = Math.max(0, Math.min(this.size - 1, (z + this.extent) / this.step)),
      col = Math.min(this.size - 2, Math.floor(gx)), row = Math.min(this.size - 2, Math.floor(gz)),
      u = gx - col, v = gz - row, i = row * this.size + col,
      a = heights[i], b = heights[i + 1], c = heights[i + this.size + 1], d = heights[i + this.size];
    return v >= u ? a + (c - d) * u + (d - a) * v : a + (b - a) * u + (c - b) * v;
  }
  visibilityLevelAt(x: number, z: number): number {
    const level = this.visibilityLevel(this.heightAt(x, z), x, z);
    return Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
  }
  ray(a: number[], b: number[]): Position | null {
    const dx = b[0]-a[0], dy = b[1]-a[1], dz = b[2]-a[2];
    if (Math.abs(dy) < 1e-9) return null;
    const t0 = -a[1]/dy, t1 = (this.maxHeight-a[1])/dy,
      near = Math.max(0,Math.min(t0,t1)), far = Math.min(1,Math.max(t0,t1));
    if (near > far) return null;
    const col = (v: number) => Math.floor((v+this.extent)/this.step),
      left = Math.max(0,col(Math.min(a[0]+dx*near,a[0]+dx*far))),
      right = Math.min(this.size-2,col(Math.max(a[0]+dx*near,a[0]+dx*far))),
      top = Math.max(0,col(Math.min(a[2]+dz*near,a[2]+dz*far))),
      bottom = Math.min(this.size-2,col(Math.max(a[2]+dz*near,a[2]+dz*far)));
    let best = Infinity;
    for (let row = top; row <= bottom; row++) for (let x = left; x <= right; x++) {
      const i = row*this.size+x, h = this.heights, wx = x*this.step-this.extent, wz = row*this.step-this.extent;
      for (const [gx,gz,upper] of [[(h[i+this.size+1]-h[i+this.size])/this.step,(h[i+this.size]-h[i])/this.step,1],
        [(h[i+1]-h[i])/this.step,(h[i+this.size+1]-h[i+1])/this.step,0]]) {
        const denominator = dy-gx*dx-gz*dz;
        if (Math.abs(denominator) < 1e-9) continue;
        const t = (h[i]+gx*(a[0]-wx)+gz*(a[2]-wz)-a[1])/denominator,
          u = (a[0]+dx*t-wx)/this.step, v = (a[2]+dz*t-wz)/this.step;
        if (t >= 0 && t <= 1 && t < best && u >= -1e-7 && u <= 1+1e-7 && v >= -1e-7 && v <= 1+1e-7 &&
          (upper ? v >= u-1e-7 : u >= v-1e-7)) best = t;
      }
    }
    return Number.isFinite(best) ? {x:a[0]+dx*best,z:a[2]+dz*best} : null;
  }
  entityHeight(e: Position & { type: string; exit?: Pick<ExitPath, 'x' | 'z' | 'length'>; flightLaunch?: number }): number {
    const floor = this.heightAt(e.x,e.z), index = e.type === 'air' ? 0 : e.type === 'destroyer' ? 1 : -1;
    if (index < 0) return floor;
    const profile = this.flights[index], cruise = this.sampleHeight(profile.cruise, e.x, e.z),
      hullFloor = this.sampleHeight(profile.floor, e.x, e.z),
      remaining = flightLaunchRemaining(e);
    // Include launch lowering here so effects, picking and models agree. Never blend
    // the hull into a hillside; the larger ships also need a higher belly datum.
    return Math.max(hullFloor, cruise + (floor-cruise)*remaining) + (index === 1 ? 3 : 0) - 3*remaining;
  }
  fits(x: number, z: number, radius = 0): boolean {
    const n = this.extent * 2 / this.cellSize, cell = this.cellSize;
    if (Math.abs(x) + radius >= this.extent || Math.abs(z) + radius >= this.extent) return false;
    const left = Math.max(0, Math.floor((x - radius + this.extent) / cell)),
      right = Math.min(n - 1, Math.floor((x + radius + this.extent) / cell)),
      top = Math.max(0, Math.floor((z - radius + this.extent) / cell)),
      bottom = Math.min(n - 1, Math.floor((z + radius + this.extent) / cell));
    for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
      if (!this.cliffs[row * n + col]) continue;
      const dx = Math.max(col * cell - this.extent - x, 0, x - ((col + 1) * cell - this.extent)),
        dz = Math.max(row * cell - this.extent - z, 0, z - ((row + 1) * cell - this.extent));
      // Use the same conservative square clearance as segment(), including corner contacts.
      // A position accepted here must not be trapped inside segment's expanded cliff bounds.
      if (dx <= radius && dz <= radius) return false;
    }
    return true;
  }
  segment(a: Position, b: Position, radius = 0): boolean {
    // Exact segment against radius-expanded cliff cells: no sub-step cliff tunnelling.
    const cell = this.cellSize, n = this.extent * 2 / cell;
    if (!this.fits(a.x, a.z, radius) || !this.fits(b.x, b.z, radius)) return false;
    const loX = Math.max(0, Math.floor((Math.min(a.x,b.x) - radius + this.extent) / cell)),
      hiX = Math.min(n-1, Math.floor((Math.max(a.x,b.x) + radius + this.extent) / cell)),
      loZ = Math.max(0, Math.floor((Math.min(a.z,b.z) - radius + this.extent) / cell)),
      hiZ = Math.min(n-1, Math.floor((Math.max(a.z,b.z) + radius + this.extent) / cell));
    for (let row = loZ; row <= hiZ; row++) for (let col = loX; col <= hiX; col++) {
      if (!this.cliffs[row * n + col]) continue;
      let enter = 0, leave = 1;
      for (const [start, delta, low] of [[a.x,b.x-a.x,col*cell-this.extent], [a.z,b.z-a.z,row*cell-this.extent]]) {
        if (Math.abs(delta) < 1e-12) {
          if (start < low-radius || start > low+cell+radius) { enter = 2; break; }
        } else {
          const p = (low-radius-start)/delta, q = (low+cell+radius-start)/delta;
          enter = Math.max(enter, Math.min(p,q)); leave = Math.min(leave, Math.max(p,q));
        }
      }
      if (enter <= leave) return false;
    }
    return true;
  }
  foundation(p: Position, radius: number): boolean {
    const h = this.heightAt(p.x,p.z), margin = radius + 1;
    if (!this.fits(p.x,p.z,margin)) return false;
    if (this.buildBlocked) {
      const n = this.extent * 2 / this.cellSize,
        cell = (v: number) => clamp(Math.floor((v + this.extent) / this.cellSize), 0, n - 1);
      for (let z = cell(p.z-margin); z <= cell(p.z+margin); z++)
        for (let x = cell(p.x-margin); x <= cell(p.x+margin); x++)
          if (this.buildBlocked[z*n+x]) return false;
    }
    // Cover all vertices of every touched triangle (conservative square footprint).
    // Off-grid sample rings can miss a height extremum inside a large foundation.
    const first = (v: number) => Math.floor((v-margin+this.extent)/this.step)*this.step-this.extent,
      last = (v: number) => Math.ceil((v+margin+this.extent)/this.step)*this.step-this.extent;
    for (let z = first(p.z); z <= last(p.z); z += this.step)
      for (let x = first(p.x); x <= last(p.x); x += this.step)
        if (Math.abs(this.heightAt(x,z)-h) > .05) return false;
    return true;
  }
}
