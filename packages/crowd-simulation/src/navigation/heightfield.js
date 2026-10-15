// @ts-check
/** @param {import('../contracts.js').HeightfieldOptions} options */
export function createHeightfield(options) {
  const {
    cellSize,
    heights,
    rowOrder = 'increasing-z',
    diagonal = 'b-c',
    boundary = 'clamp',
  } = options;
  const square = options.halfSize !== undefined;
  if (
    square &&
    (!Number.isFinite(options.halfSize) ||
      !(options.halfSize > 0) ||
      options.width !== undefined ||
      options.depth !== undefined ||
      options.origin !== undefined)
  )
    throw new RangeError('Use either a centered halfSize or rectangular dimensions');
  const width = options.width ?? (options.halfSize ?? NaN) * 2;
  const depth = options.depth ?? (options.halfSize ?? NaN) * 2;
  const minX = options.origin?.x ?? -width / 2,
    minZ = options.origin?.z ?? -depth / 2;
  const columns = width / cellSize,
    rows = depth / cellSize;
  const maxX = minX + width,
    maxZ = minZ + depth;
  if (
    ![width, depth, cellSize, minX, minZ, maxX, maxZ].every(Number.isFinite) ||
    !(width > 0) ||
    !(depth > 0) ||
    !(cellSize > 0) ||
    !(maxX > minX) ||
    !(maxZ > minZ) ||
    !Number.isSafeInteger(columns) ||
    !Number.isSafeInteger(rows) ||
    columns < 2 ||
    rows < 2 ||
    !Number.isSafeInteger((columns + 1) * (rows + 1)) ||
    columns * rows > 0x7fffffff ||
    !heights ||
    heights.length !== (columns + 1) * (rows + 1)
  )
    throw new RangeError('Invalid heightfield dimensions');
  if (
    !['increasing-z', 'decreasing-z'].includes(rowOrder) ||
    !['b-c', 'a-d'].includes(diagonal) ||
    !['clamp', 'reject'].includes(boundary)
  )
    throw new RangeError('Invalid heightfield convention');
  if (
    options.origin !== undefined &&
    (!options.origin || !Number.isFinite(options.origin.x) || !Number.isFinite(options.origin.z))
  )
    throw new RangeError('Finite heightfield origin required');
  const points = Float64Array.from(heights);
  if (!points.every(Number.isFinite)) throw new RangeError('Heightfield heights must be finite');
  const bounds = Object.freeze({ minX, minZ, maxX, maxZ }),
    stride = columns + 1;
  /** @param {number} x @param {number} z */
  const contains = (x, z) =>
    Number.isFinite(x) && Number.isFinite(z) && x >= minX && x <= maxX && z >= minZ && z <= maxZ;
  /** @param {number} x @param {number} z */
  function cell(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z))
      throw new RangeError('Finite surface coordinates required');
    if (boundary === 'reject' && !contains(x, z))
      throw new RangeError('Surface query outside heightfield');
    const gx = Math.max(0, Math.min(columns, (x - minX) / cellSize));
    const gz = Math.max(
      0,
      Math.min(rows, (rowOrder === 'increasing-z' ? z - minZ : maxZ - z) / cellSize),
    );
    const ix = Math.min(columns - 1, Math.floor(gx)),
      iz = Math.min(rows - 1, Math.floor(gz));
    const a = iz * stride + ix;
    return { a, b: a + 1, c: a + stride, d: a + stride + 1, u: gx - ix, v: gz - iz };
  }
  /** @param {number} x @param {number} z */
  function heightAt(x, z) {
    const { a, b, c, d, u, v } = cell(x, z);
    if (diagonal === 'a-d')
      return u >= v
        ? points[a] * (1 - u) + points[b] * (u - v) + points[d] * v
        : points[a] * (1 - v) + points[d] * u + points[c] * (v - u);
    return u + v <= 1
      ? points[a] * (1 - u - v) + points[b] * u + points[c] * v
      : points[d] * (u + v - 1) + points[c] * (1 - u) + points[b] * (1 - v);
  }
  /** @param {ReturnType<typeof cell>} p @param {boolean} first */
  function triangleSlope({ a, b, c, d }, first) {
    if (diagonal === 'a-d')
      return first
        ? Math.hypot(points[b] - points[a], points[d] - points[b]) / cellSize
        : Math.hypot(points[d] - points[c], points[c] - points[a]) / cellSize;
    return first
      ? Math.hypot(points[b] - points[a], points[c] - points[a]) / cellSize
      : Math.hypot(points[d] - points[c], points[d] - points[b]) / cellSize;
  }
  /** @param {number} x @param {number} z */
  function slopeAt(x, z) {
    const p = cell(x, z);
    return triangleSlope(p, diagonal === 'a-d' ? p.u >= p.v : p.u + p.v <= 1);
  }
  /** @param {number} x @param {number} z */
  function cellSlopeAt(x, z) {
    const p = cell(x, z);
    return Math.max(triangleSlope(p, true), triangleSlope(p, false));
  }
  return Object.freeze({
    width,
    depth,
    bounds,
    columns,
    rows,
    cellSize,
    rowOrder,
    diagonal,
    boundary,
    contains,
    heightAt,
    slopeAt,
    cellSlopeAt,
  });
}
