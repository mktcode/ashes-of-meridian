import { createHeightfield } from '../dist/index.js';

// Independent, deterministic inputs, not generated/imported by a terrain application.
export function syntheticTerrain({
  width = 48,
  depth = 72,
  cellSize = 2,
  origin = { x: 11, z: -93 },
  rowOrder = 'increasing-z',
  diagonal = 'b-c',
  height = (x, z) => 0.04 * x + 0.08 * z,
} = {}) {
  const columns = width / cellSize,
    rows = depth / cellSize;
  const heights = new Float64Array((columns + 1) * (rows + 1));
  for (let row = 0; row <= rows; row++)
    for (let col = 0; col <= columns; col++) {
      const x = origin.x + col * cellSize;
      const z = origin.z + (rowOrder === 'increasing-z' ? row : rows - row) * cellSize;
      heights[row * (columns + 1) + col] = height(x, z);
    }
  const options = {
    width,
    depth,
    cellSize,
    origin,
    rowOrder,
    diagonal,
    boundary: 'reject',
    heights,
  };
  return { surface: createHeightfield(options), options };
}

export const profiles = Object.freeze({
  small: Object.freeze({ radius: 0.4, maxSlope: 0.6, maxSpeed: 2 }),
  large: Object.freeze({ radius: 1.4, maxSlope: 0.6, maxSpeed: 2, traffic: 'independent-detour' }),
});
