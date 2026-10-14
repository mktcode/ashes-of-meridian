import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./crowd-terrain.js', import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(source + '\nthis.terrain = CrowdTerrain;', context);
const terrain = context.terrain, mesh = terrain.vertices;
let min = Infinity, max = -Infinity;
for (let i = 0; i < mesh.length; i += 18) {
  let x = 0, y = 0, z = 0;
  for (const offset of [0, 6, 12]) {
    const vertex = i + offset;
    x += mesh[vertex] / 3;
    y += mesh[vertex + 1] / 3;
    z += mesh[vertex + 2] / 3;
    min = Math.min(min, mesh[vertex + 1]);
    max = Math.max(max, mesh[vertex + 1]);
    assert.ok(Math.abs(terrain.heightAt(mesh[vertex], mesh[vertex + 2]) - mesh[vertex + 1]) < 1e-10, 'mesh vertices and CPU height agree');
    assert.ok(Math.abs(Math.hypot(mesh[vertex + 3], mesh[vertex + 4], mesh[vertex + 5]) - 1) < 1e-6);
    assert.ok(mesh[vertex + 4] > 0.8, 'gentle walkable slopes');
  }
  assert.ok(Math.abs(terrain.heightAt(x, z) - y) < 1e-10, 'CPU height interpolates the actual rendered triangle, not a separate analytic surface');
}
assert.ok(max - min > 2, 'visible hills and depressions');
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
for (const [x, z] of [[0, 0], [-4, -3], [5, 4], [4, -1], [-12, 12], [12, -12], [1.2, 3.7]]) {
  for (const yaw of [-1.5, 0, 0.6, Math.PI]) {
    const y = terrain.heightAt(x, z), frame = terrain.transform(x, z, y, yaw);
    const right = frame.slice(0, 3), up = frame.slice(4, 7), forward = frame.slice(8, 11);
    assert.equal(frame[12], x);
    assert.equal(frame[13], y);
    assert.equal(frame[14], z);
    for (const vector of [right, up, forward]) assert.ok(Math.abs(Math.hypot(...vector) - 1) < 1e-10);
    assert.ok(Math.abs(dot(right, up)) + Math.abs(dot(up, forward)) + Math.abs(dot(right, forward)) < 1e-10, 'orthonormal slope-aligned marine/marker frame');
    assert.ok(Math.abs(forward[0] * Math.cos(yaw) - forward[2] * Math.sin(yaw)) < 1e-10, 'surface alignment preserves horizontal heading');
    assert.ok(Math.abs(dot(up, terrain.sample(x, z).normal) - 1) < 1e-10);
  }
  for (const [dx, dz] of [[1e-6, 0], [0, 1e-6], [1e-6, -1e-6]]) {
    assert.ok(Math.abs(terrain.heightAt(x + dx, z + dz) - terrain.heightAt(x - dx, z - dz)) < 1e-5, 'continuous height across vertices and triangle seams');
  }
}
const camera = {
  right: [1, 0, 0], up: [0, Math.cos(0.08), -Math.sin(0.08)], eye: [0, Math.sin(0.08), Math.cos(0.08)], scale: [0.05, 0.05],
};
const hidden = [5, terrain.heightAt(5, -5), -5];
const hit = terrain.pick(dot(hidden, camera.right) * camera.scale[0], dot(hidden, camera.up) * camera.scale[1], camera);
assert.ok(hit && hit.z > hidden[2] + 1, 'ray picking selects the front hill rather than terrain hidden behind it');
assert.equal(hit.y, terrain.heightAt(hit.x, hit.z));
assert.equal(terrain.pick(10, 10, camera), null, 'sky clicks miss the terrain');
assert.equal(terrain.pick(NaN, 0, camera), null);
const second = vm.createContext({});
vm.runInContext(source + '\nthis.mesh = CrowdTerrain.vertices;', second);
assert.deepEqual(Array.from(second.mesh), Array.from(mesh), 'terrain is reproducible without simulation RNG');
console.log('Terrain: hills, authoritative triangle heights, continuous seams, surface frames, nearest visible slope and deterministic mesh checked.');
