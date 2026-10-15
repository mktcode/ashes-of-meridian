import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
for (const file of ['crowd-terrain.js', 'crowd-navigation.js', 'crowd-recovery.js', 'crowd-core.js']) vm.runInThisContext(readFileSync(new URL(file, import.meta.url), 'utf8'));
const { core, terrain } = vm.runInThisContext('({ core: CrowdSimulation, terrain: CrowdTerrain })');
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// Independent old-style whole-mesh oracle: no grid traversal, cell lookup or candidate pruning.
function brute(x, y, camera) {
  const origin = camera.right.map((v, i) => v * x / camera.scale[0] + camera.up[i] * y / camera.scale[1] + camera.eye[i] * camera.depth + camera.center[i]);
  const direction = camera.eye.map(v => -v), mesh = terrain.vertices;
  let nearest = Infinity;
  for (let i = 0; i < mesh.length; i += 18) {
    const a = [mesh[i], mesh[i + 1], mesh[i + 2]];
    const e = [mesh[i + 6] - a[0], mesh[i + 7] - a[1], mesh[i + 8] - a[2]], f = [mesh[i + 12] - a[0], mesh[i + 13] - a[1], mesh[i + 14] - a[2]];
    const p = cross(direction, f), det = dot(e, p); if (Math.abs(det) < 1e-10) continue;
    const t = origin.map((v, j) => v - a[j]), u = dot(t, p) / det; if (u < -1e-8 || u > 1 + 1e-8) continue;
    const q = cross(t, e), v = dot(direction, q) / det; if (v < -1e-8 || u + v > 1 + 1e-8) continue;
    const distance = dot(f, q) / det; if (distance >= 0 && distance < nearest) nearest = distance;
  }
  if (!Number.isFinite(nearest)) return null;
  return { x: origin[0] + direction[0] * nearest, z: origin[2] + direction[2] * nearest };
}
for (const [yaw, pitch, focus, zoom] of [[0, 0.08, null, 1], [Math.PI / 2, 1.2, null, 1], [0.55, 0.9, { x: -3, z: -2 }, 20], [-1.4, 0.35, { x: 44, z: -38 }, 2]]) {
  const camera = core.cameraFrame(yaw, pitch, zoom, 1160, 700, focus);
  assert.ok(camera.depth > terrain.halfSize * Math.SQRT2 + 12, 'large-map depth range includes bodies and rim');
  const rays = [[0, 0], [0.7, -0.6], [-0.8, 0.75], [10, 10]];
  for (const [x, z] of [[-64, 64], [64, -64], [64 + 4e-9, 0], [0, 0], [-3, -2]]) {
    const relative = [x - camera.center[0], terrain.heightAt(x, z) - camera.center[1], z - camera.center[2]];
    rays.push([dot(relative, camera.right) * camera.scale[0], dot(relative, camera.up) * camera.scale[1]]);
  }
  for (const [x, y] of rays) {
    const expected = brute(x, y, camera), actual = terrain.pick(x, y, camera);
    assert.equal(Boolean(actual), Boolean(expected), 'grid picking preserves misses and mesh-edge tolerance');
    if (actual) {
      assert.ok(Math.hypot(actual.x - expected.x, actual.z - expected.z) < 1e-7, 'nearest visible physical triangle agrees with brute force');
      assert.equal(actual.y, terrain.heightAt(actual.x, actual.z));
    }
  }
}
console.log('Picking: bounded grid traversal agrees with whole-mesh ray tests for hidden hills, near-parallel axes, focus/pan, zoom, sky, corners and edge tolerance.');
