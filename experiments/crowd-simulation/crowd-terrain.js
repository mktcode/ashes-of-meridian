'use strict';

const CrowdTerrain = (() => {
  const halfSize = 32, cellSize = 0.5, cells = halfSize * 2 / cellSize;
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
    const origin = camera.right.map((value, i) => value * ndcX / camera.scale[0] + camera.up[i] * ndcY / camera.scale[1] + camera.eye[i] * 80);
    const direction = camera.eye.map(value => -value);
    let nearest = Infinity;
    // Only on commands, not per frame. The first ray/triangle hit also handles hidden slopes.
    for (let i = 0; i < mesh.length; i += 18) {
      const a = [mesh[i], mesh[i + 1], mesh[i + 2]];
      const edge1 = [mesh[i + 6] - a[0], mesh[i + 7] - a[1], mesh[i + 8] - a[2]];
      const edge2 = [mesh[i + 12] - a[0], mesh[i + 13] - a[1], mesh[i + 14] - a[2]];
      const p = cross(direction, edge2);
      const determinant = edge1[0] * p[0] + edge1[1] * p[1] + edge1[2] * p[2];
      if (Math.abs(determinant) < 1e-10) continue;
      const t = origin.map((value, axis) => value - a[axis]);
      const u = (t[0] * p[0] + t[1] * p[1] + t[2] * p[2]) / determinant;
      if (u < -1e-8 || u > 1 + 1e-8) continue;
      const q = cross(t, edge1);
      const v = (direction[0] * q[0] + direction[1] * q[1] + direction[2] * q[2]) / determinant;
      if (v < -1e-8 || u + v > 1 + 1e-8) continue;
      const distance = (edge2[0] * q[0] + edge2[1] * q[1] + edge2[2] * q[2]) / determinant;
      if (distance >= 0 && distance < nearest) nearest = distance;
    }
    if (!Number.isFinite(nearest)) return null;
    const x = clamp(origin[0] + direction[0] * nearest, -halfSize, halfSize);
    const z = clamp(origin[2] + direction[2] * nearest, -halfSize, halfSize);
    return { x, y: heightAt(x, z), z };
  }
  return { halfSize, vertices: mesh, heightAt, slopeAt, sample, transform, pick };
})();
