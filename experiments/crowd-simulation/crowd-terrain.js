'use strict';

const CrowdTerrain = (() => {
  const halfSize = 64, cellSize = 0.5, cells = halfSize * 2 / cellSize;
  const stride = cells + 1, points = [], normals = [], vertices = [];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const normalize = v => {
    const length = Math.hypot(...v);
    return v.map(value => value / length);
  };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  function hills(x, z) {
    return 2.1 * Math.exp(-((x + 4) ** 2 / 20 + (z + 3) ** 2 / 16))
      + 1.7 * Math.exp(-((x - 5) ** 2 / 18 + (z - 4) ** 2 / 24))
      + 1.2 * Math.exp(-((x - 1) ** 2 / 18 + (z + 7) ** 2 / 14))
      - 0.55 * Math.exp(-((x - 4) ** 2 / 14 + (z + 1) ** 2 / 18))
      + 0.16 * Math.sin(x * 0.5) * Math.cos(z * 0.4)
      + 0.85 * Math.max(0, Math.max(Math.abs(x), Math.abs(z)) - (halfSize - 3.5)) ** 2;
  }
  for (let iz = 0; iz <= cells; iz++) for (let ix = 0; ix <= cells; ix++) {
    const x = -halfSize + ix * cellSize, z = -halfSize + iz * cellSize;
    points.push([x, Math.fround(hills(x, z)), z]);
  }
  // Lighting/ground alignment use interpolated vertex normals; heights remain triangular.
  for (let iz = 0; iz <= cells; iz++) for (let ix = 0; ix <= cells; ix++) {
    const left = points[iz * stride + Math.max(0, ix - 1)], right = points[iz * stride + Math.min(cells, ix + 1)];
    const back = points[Math.max(0, iz - 1) * stride + ix], front = points[Math.min(cells, iz + 1) * stride + ix];
    normals.push(normalize([-(right[1] - left[1]) / (right[0] - left[0]), 1, -(front[1] - back[1]) / (front[2] - back[2])]));
  }
  function triangle(a, b, c) {
    for (const index of [a, b, c]) vertices.push(...points[index], ...normals[index]);
  }
  for (let iz = 0; iz < cells; iz++) for (let ix = 0; ix < cells; ix++) {
    const a = iz * stride + ix, b = a + 1, c = a + stride, d = c + 1;
    triangle(a, c, b);
    triangle(b, c, d);
  }
  const mesh = new Float32Array(vertices);

  function sample(x, z) {
    const gx = clamp((x + halfSize) / cellSize, 0, cells), gz = clamp((z + halfSize) / cellSize, 0, cells);
    const ix = Math.min(cells - 1, Math.floor(gx)), iz = Math.min(cells - 1, Math.floor(gz));
    const u = gx - ix, v = gz - iz;
    const a = iz * stride + ix, b = a + 1, c = a + stride, d = c + 1;
    const indices = u + v <= 1 ? [a, b, c] : [d, c, b];
    const weights = u + v <= 1 ? [1 - u - v, u, v] : [u + v - 1, 1 - u, 1 - v];
    let y = 0;
    const normal = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      y += points[indices[i]][1] * weights[i];
      for (let axis = 0; axis < 3; axis++) normal[axis] += normals[indices[i]][axis] * weights[i];
    }
    return { y, normal: normalize(normal) };
  }
  function heightAt(x, z) {
    const gx = clamp((x + halfSize) / cellSize, 0, cells), gz = clamp((z + halfSize) / cellSize, 0, cells);
    const ix = Math.min(cells - 1, Math.floor(gx)), iz = Math.min(cells - 1, Math.floor(gz));
    const u = gx - ix, v = gz - iz, a = iz * stride + ix, b = a + 1, c = a + stride, d = c + 1;
    return u + v <= 1
      ? points[a][1] * (1 - u - v) + points[b][1] * u + points[c][1] * v
      : points[d][1] * (u + v - 1) + points[c][1] * (1 - u) + points[b][1] * (1 - v);
  }
  function slopeAt(x, z) {
    const gx = clamp((x + halfSize) / cellSize, 0, cells), gz = clamp((z + halfSize) / cellSize, 0, cells);
    const ix = Math.min(cells - 1, Math.floor(gx)), iz = Math.min(cells - 1, Math.floor(gz));
    const a = iz * stride + ix, b = a + 1, c = a + stride, d = c + 1;
    // Physical triangle slope, not the smoothed lighting normal.
    return gx - ix + gz - iz <= 1
      ? Math.hypot(points[b][1] - points[a][1], points[c][1] - points[a][1]) / cellSize
      : Math.hypot(points[d][1] - points[c][1], points[d][1] - points[b][1]) / cellSize;
  }
  function transform(x, z, y, yaw) {
    const up = sample(x, z).normal;
    const horizontal = [Math.sin(yaw), 0, Math.cos(yaw)];
    const slope = -(up[0] * horizontal[0] + up[2] * horizontal[2]) / up[1];
    const forward = normalize([horizontal[0], slope, horizontal[2]]);
    const right = normalize(cross(up, forward));
    return [...right, 0, ...up, 0, ...forward, 0, x, y, z, 1];
  }

  function pick(ndcX, ndcY, camera) {
    if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY) || Math.abs(camera.eye[1]) < 1e-5) return null;
    const origin = camera.right.map((value, i) => value * ndcX / camera.scale[0] + camera.up[i] * ndcY / camera.scale[1] + camera.eye[i] * camera.depth + camera.center[i]);
    const direction = camera.eye.map(value => -value);
    let nearest = Infinity;
    function testTriangle(ai, bi, ci) {
      const a = points[ai], b = points[bi], c = points[ci];
      const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2];
      const fx = c[0] - a[0], fy = c[1] - a[1], fz = c[2] - a[2];
      const px = direction[1] * fz - direction[2] * fy;
      const py = direction[2] * fx - direction[0] * fz;
      const pz = direction[0] * fy - direction[1] * fx;
      const determinant = ex * px + ey * py + ez * pz;
      if (Math.abs(determinant) < 1e-10) return;
      const tx = origin[0] - a[0], ty = origin[1] - a[1], tz = origin[2] - a[2];
      const u = (tx * px + ty * py + tz * pz) / determinant;
      if (u < -1e-8 || u > 1 + 1e-8) return;
      const qx = ty * ez - tz * ey, qy = tz * ex - tx * ez, qz = tx * ey - ty * ex;
      const v = (direction[0] * qx + direction[1] * qy + direction[2] * qz) / determinant;
      if (v < -1e-8 || u + v > 1 + 1e-8) return;
      const distance = (fx * qx + fy * qy + fz * qz) / determinant;
      if (distance >= 0 && distance < nearest) nearest = distance;
    }
    let entry = 0, exit = Infinity;
    for (const axis of [0, 2]) {
      if (Math.abs(direction[axis]) < 1e-12) {
        if (Math.abs(origin[axis]) > halfSize + 1e-8) return null;
      } else {
        const a = (-halfSize - 1e-8 - origin[axis]) / direction[axis];
        const b = (halfSize + 1e-8 - origin[axis]) / direction[axis];
        entry = Math.max(entry, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
      }
    }
    if (entry > exit) return null;
    let ix = clamp(Math.floor((origin[0] + direction[0] * entry + halfSize) / cellSize), 0, cells - 1);
    let iz = clamp(Math.floor((origin[2] + direction[2] * entry + halfSize) / cellSize), 0, cells - 1);
    const sx = Math.sign(direction[0]), sz = Math.sign(direction[2]);
    const deltaX = Math.abs(direction[0]) < 1e-12 ? Infinity : cellSize / Math.abs(direction[0]);
    const deltaZ = Math.abs(direction[2]) < 1e-12 ? Infinity : cellSize / Math.abs(direction[2]);
    let nextX = deltaX === Infinity ? Infinity : (-halfSize + (ix + (sx > 0 ? 1 : 0)) * cellSize - origin[0]) / direction[0];
    let nextZ = deltaZ === Infinity ? Infinity : (-halfSize + (iz + (sz > 0 ? 1 : 0)) * cellSize - origin[2]) / direction[2];
    // Grid traversal bounds the query by ray length. Neighbour cells preserve triangle-edge tolerance.
    for (let steps = 0; steps <= cells * 2 + 2; steps++) {
      for (let z = Math.max(0, iz - 1); z <= Math.min(cells - 1, iz + 1); z++) {
        for (let x = Math.max(0, ix - 1); x <= Math.min(cells - 1, ix + 1); x++) {
          const a = z * stride + x, b = a + 1, c = a + stride, d = c + 1;
          testTriangle(a, c, b); testTriangle(b, c, d);
        }
      }
      const next = Math.min(nextX, nextZ);
      if (nearest <= next + 1e-8 || next > exit || !Number.isFinite(next)) break;
      if (nextX <= next + 1e-10) { ix += sx; nextX += deltaX; }
      if (nextZ <= next + 1e-10) { iz += sz; nextZ += deltaZ; }
      if (ix < 0 || iz < 0 || ix >= cells || iz >= cells) break;
    }
    if (!Number.isFinite(nearest)) return null;
    const x = clamp(origin[0] + direction[0] * nearest, -halfSize, halfSize);
    const z = clamp(origin[2] + direction[2] * nearest, -halfSize, halfSize);
    return { x, y: heightAt(x, z), z };
  }
  return { halfSize, cellSize, vertices: mesh, heightAt, slopeAt, sample, transform, pick };
})();
