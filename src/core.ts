/* Shared matrix/vector math and seeded RNG; classic script, no browser dependencies. */
'use strict';
const M4 = {
  identity: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  mul(a: ArrayLike<number>, b: ArrayLike<number>) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++)
        o[c * 4 + r] =
          a[r] * b[c * 4] +
          a[4 + r] * b[c * 4 + 1] +
          a[8 + r] * b[c * 4 + 2] +
          a[12 + r] * b[c * 4 + 3];
    return o;
  },
  ortho(l: number, r: number, b: number, t: number, n: number, f: number) {
    return new Float32Array([
      2 / (r - l),
      0,
      0,
      0,
      0,
      2 / (t - b),
      0,
      0,
      0,
      0,
      -2 / (f - n),
      0,
      -(r + l) / (r - l),
      -(t + b) / (t - b),
      -(f + n) / (f - n),
      1
    ]);
  },
  perspective(fov: number, a: number, n: number, f: number) {
    const s = 1 / Math.tan(fov / 2);
    return new Float32Array([
      s / a,
      0,
      0,
      0,
      0,
      s,
      0,
      0,
      0,
      0,
      (f + n) / (n - f),
      -1,
      0,
      0,
      (2 * f * n) / (n - f),
      0
    ]);
  },
  look(eye: readonly number[], target: readonly number[]) {
    let z = V.norm(V.sub(eye, target)),
      x = V.norm(V.cross([0, 1, 0], z)),
      y = V.cross(z, x);
    return new Float32Array([
      x[0],
      y[0],
      z[0],
      0,
      x[1],
      y[1],
      z[1],
      0,
      x[2],
      y[2],
      z[2],
      0,
      -V.dot(x, eye),
      -V.dot(y, eye),
      -V.dot(z, eye),
      1
    ]);
  },
  inverse(a: ArrayLike<number>) {
    let m = Array.from(a),
      o = Array.from(this.identity());
    for (let i = 0; i < 4; i++) {
      let p = i;
      for (let j = i + 1; j < 4; j++) if (Math.abs(m[i * 4 + j]) > Math.abs(m[i * 4 + p])) p = j;
      if (Math.abs(m[i * 4 + p]) < 1e-10) return this.identity();
      if (p !== i)
        for (let c = 0; c < 4; c++) {
          [m[c * 4 + i], m[c * 4 + p]] = [m[c * 4 + p], m[c * 4 + i]];
          [o[c * 4 + i], o[c * 4 + p]] = [o[c * 4 + p], o[c * 4 + i]];
        }
      let d = m[i * 4 + i];
      for (let c = 0; c < 4; c++) {
        m[c * 4 + i] /= d;
        o[c * 4 + i] /= d;
      }
      for (let j = 0; j < 4; j++) {
        if (j === i) continue;
        let f = m[i * 4 + j];
        for (let c = 0; c < 4; c++) {
          m[c * 4 + j] -= m[c * 4 + i] * f;
          o[c * 4 + j] -= o[c * 4 + i] * f;
        }
      }
    }
    return new Float32Array(o);
  },
  point(m: ArrayLike<number>, x: number, y: number, z: number, w = 1) {
    let r = [
      m[0] * x + m[4] * y + m[8] * z + m[12] * w,
      m[1] * x + m[5] * y + m[9] * z + m[13] * w,
      m[2] * x + m[6] * y + m[10] * z + m[14] * w,
      m[3] * x + m[7] * y + m[11] * z + m[15] * w
    ];
    return r;
  }
};
const V = {
  sub: (a: readonly number[], b: readonly number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  dot: (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: readonly number[], b: readonly number[]) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ],
  norm(a: readonly number[]) {
    let d = Math.hypot(...a) || 1;
    return a.map(x => x / d);
  }
};
function seeded(seed: number) {
  let a = seed | 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
