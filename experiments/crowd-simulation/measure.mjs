import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';

// Native JS timings, no GPU/FPS claim. Deliberately short, deterministic windows.
const start = performance.now();
for (const name of ['marine-model.js', 'crowd-terrain.js', 'crowd-navigation.js', 'crowd-recovery.js', 'crowd-core.js']) vm.runInThisContext(readFileSync(new URL(name, import.meta.url), 'utf8'));
const { core, nav, terrain, model } = vm.runInThisContext('({ core: CrowdSimulation, nav: CrowdNavigation, terrain: CrowdTerrain, model: MarineModel })');
const setupMs = performance.now() - start;
const counts = process.argv.slice(2).map(Number);
if (!counts.length) counts.push(100, 500, 1000);
if (counts.some(n => !Number.isInteger(n) || n < 1 || n > 2000)) throw new Error('Counts must be integers from 1 to 2000');
const percentile = (samples, p) => samples.slice().sort((a, b) => a - b)[Math.floor((samples.length - 1) * p)];
console.log(JSON.stringify({ node: process.version, mapSize: nav.halfSize * 2, setupMs, spawnCapacity: nav.spawnSites.length }));
for (const count of counts) {
  const world = core.createWorld();
  let t = performance.now();
  core.spawnMarines(world, count - 1);
  const spawnMs = performance.now() - t, spawned = world.marines.length;
  t = performance.now();
  const accepted = core.moveTo(world, { x: nav.halfSize / 2, z: -nav.halfSize / 2 });
  const commandMs = performance.now() - t;
  const tick = [], neighbours = [], poses = [];
  for (let i = 0; i < 40; i++) {
    t = performance.now(); core.update(world, 1 / 60);
    if (i >= 10) { tick.push(performance.now() - t); neighbours.push(world.stats.neighbourChecks); }
  }
  for (let frame = 0; frame < 10; frame++) {
    t = performance.now();
    for (const m of world.marines) {
      const c = Math.cos(m.yaw), s = Math.sin(m.yaw);
      model.samplePose(m.time, m.runWeight, (x, z) => terrain.heightAt(m.x + c * x + s * z, m.z - s * x + c * z) - m.y);
    }
    if (frame >= 3) poses.push(performance.now() - t);
  }
  console.log(JSON.stringify({ requested: count, actual: world.marines.length, spawned, spawnMs, commandMs, accepted,
    moving: world.marines.filter(m => m.moving).length,
    tickP50Ms: percentile(tick, 0.5), tickP95Ms: percentile(tick, 0.95), neighbourP50: percentile(neighbours, 0.5),
    poseP50Ms: percentile(poses, 0.5), fieldBuilds: world.stats.fieldBuilds }));
}
