// One height per X/Z; each cell uses triangles (a,c,b) and (b,c,d).
export function createHeightfield({ halfSize, cellSize, heights }) {
  const cells = halfSize * 2 / cellSize;
  if (!(halfSize > 0) || !(cellSize > 0) || !Number.isSafeInteger(cells) || cells < 2
    || !heights || heights.length !== (cells + 1) ** 2) throw new RangeError('Invalid heightfield dimensions');
  const points = Float64Array.from(heights);
  if (!points.every(Number.isFinite)) throw new RangeError('Heightfield heights must be finite');
  const stride = cells + 1;
  function heightAt(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) throw new RangeError('Finite surface coordinates required');
    const gx = Math.max(0, Math.min(cells, (x + halfSize) / cellSize)), gz = Math.max(0, Math.min(cells, (z + halfSize) / cellSize));
    const ix = Math.min(cells - 1, Math.floor(gx)), iz = Math.min(cells - 1, Math.floor(gz));
    const a = iz * stride + ix, u = gx - ix, v = gz - iz, b = a + 1, c = a + stride, d = c + 1;
    return u + v <= 1
      ? points[a] * (1 - u - v) + points[b] * u + points[c] * v
      : points[d] * (u + v - 1) + points[c] * (1 - u) + points[b] * (1 - v);
  }
  function slopeAt(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) throw new RangeError('Finite surface coordinates required');
    const gx = Math.max(0, Math.min(cells, (x + halfSize) / cellSize)), gz = Math.max(0, Math.min(cells, (z + halfSize) / cellSize));
    const ix = Math.min(cells - 1, Math.floor(gx)), iz = Math.min(cells - 1, Math.floor(gz));
    const a = iz * stride + ix, u = gx - ix, v = gz - iz, b = a + 1, c = a + stride, d = c + 1;
    return u + v <= 1
      ? Math.hypot(points[b] - points[a], points[c] - points[a]) / cellSize
      : Math.hypot(points[d] - points[c], points[d] - points[b]) / cellSize;
  }
  return Object.freeze({ halfSize, cellSize, heightAt, slopeAt });
}
