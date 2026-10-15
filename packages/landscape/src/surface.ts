import { heightAt } from './map.js';
import type { GameMap, TerrainHit } from './contracts.js';
type Vector = readonly [number, number, number];

export function normalAt(map: GameMap, x: number, z: number): Vector | null {
  if (heightAt(map, x, z) === null) return null;
  const g = map.manifest.grid, size = g.step[0], stride = g.nx + 1;
  const u = (x - g.origin[0]) / size, v = (g.origin[2] - z) / size;
  const i = Math.min(g.nx - 1, Math.floor(u)), j = Math.min(g.ny - 1, Math.floor(v));
  const a = j * stride + i, b = a + 1, c = a + stride, d = c + 1, h = map.heights;
  const sx = u - i + v - j <= 1 ? h[b] - h[a] : h[d] - h[c];
  const sy = u - i + v - j <= 1 ? h[c] - h[a] : h[d] - h[b];
  const length = Math.hypot(sx, size, sy);
  return [-sx / length, size / length, sy / length];
}

// Traverse only cells crossed by the X/Z ray, with a one-cell edge tolerance.
// Heights, triangle split and winding are identical to createTerrainMesh().
export function raycastTerrain(map: GameMap, origin: Vector, direction: Vector): TerrainHit | null {
  if (![...origin, ...direction].every(Number.isFinite)) return null;
  const length = Math.hypot(...direction);
  if (!(length > 0)) return null;
  const ray = direction.map(v => v / length);
  const g = map.manifest.grid, size = g.step[0], stride = g.nx + 1;
  const minX = g.origin[0], maxX = minX + g.width, maxZ = g.origin[2], minZ = maxZ - g.length;
  let entry = 0, exit = Infinity, nearest = Infinity;
  for (const [axis, min, max] of [[0, minX, maxX], [2, minZ, maxZ]]) {
    if (Math.abs(ray[axis]) < 1e-12) {
      if (origin[axis] < min || origin[axis] > max) return null;
    } else {
      const a = (min - origin[axis]) / ray[axis], b = (max - origin[axis]) / ray[axis];
      entry = Math.max(entry, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
    }
  }
  if (entry > exit) return null;
  const clamp = (v: number, n: number) => Math.max(0, Math.min(n - 1, Math.floor(v)));
  let ix = clamp((origin[0] + ray[0] * entry - minX) / size, g.nx);
  let iz = clamp((origin[2] + ray[2] * entry - minZ) / size, g.ny);
  const sx = Math.sign(ray[0]), sz = Math.sign(ray[2]);
  const deltaX = Math.abs(ray[0]) < 1e-12 ? Infinity : size / Math.abs(ray[0]);
  const deltaZ = Math.abs(ray[2]) < 1e-12 ? Infinity : size / Math.abs(ray[2]);
  let nextX = deltaX === Infinity ? Infinity : (minX + (ix + (sx > 0 ? 1 : 0)) * size - origin[0]) / ray[0];
  let nextZ = deltaZ === Infinity ? Infinity : (minZ + (iz + (sz > 0 ? 1 : 0)) * size - origin[2]) / ray[2];
  const vertex = (k: number): number[] => [minX + (k % stride) * size, map.heights[k], maxZ - Math.floor(k / stride) * size];
  function test(ai: number, bi: number, ci: number): void {
    const a = vertex(ai), b = vertex(bi), c = vertex(ci);
    const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2];
    const fx = c[0] - a[0], fy = c[1] - a[1], fz = c[2] - a[2];
    const px = ray[1] * fz - ray[2] * fy, py = ray[2] * fx - ray[0] * fz, pz = ray[0] * fy - ray[1] * fx;
    const det = ex * px + ey * py + ez * pz;
    if (Math.abs(det) < 1e-12) return;
    const tx = origin[0] - a[0], ty = origin[1] - a[1], tz = origin[2] - a[2];
    const u = (tx * px + ty * py + tz * pz) / det;
    const qx = ty * ez - tz * ey, qy = tz * ex - tx * ez, qz = tx * ey - ty * ex;
    const v = (ray[0] * qx + ray[1] * qy + ray[2] * qz) / det;
    if (u < -1e-8 || v < -1e-8 || u + v > 1 + 1e-8) return;
    const t = (fx * qx + fy * qy + fz * qz) / det;
    if (t >= 0) nearest = Math.min(nearest, t);
  }
  for (let steps = 0; steps <= g.nx + g.ny + 2; steps++) {
    for (let z = Math.max(0, iz - 1); z <= Math.min(g.ny - 1, iz + 1); z++)
      for (let x = Math.max(0, ix - 1); x <= Math.min(g.nx - 1, ix + 1); x++) {
        const a = (g.ny - 1 - z) * stride + x;
        test(a, a + 1, a + stride); test(a + 1, a + stride + 1, a + stride);
      }
    const next = Math.min(nextX, nextZ);
    if (nearest <= next + 1e-8 || next > exit || !Number.isFinite(next)) break;
    if (nextX <= next + 1e-10) { ix += sx; nextX += deltaX; }
    if (nextZ <= next + 1e-10) { iz += sz; nextZ += deltaZ; }
    if (ix < 0 || iz < 0 || ix >= g.nx || iz >= g.ny) break;
  }
  if (!Number.isFinite(nearest)) return null;
  const x = Math.max(minX, Math.min(maxX, origin[0] + ray[0] * nearest));
  const z = Math.max(minZ, Math.min(maxZ, origin[2] + ray[2] * nearest));
  return { x, y: heightAt(map, x, z)!, z, distance: nearest };
}
