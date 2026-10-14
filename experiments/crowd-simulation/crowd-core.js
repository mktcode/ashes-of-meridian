'use strict';

const CrowdSimulation = (() => {
  const halfSize = 12;
  const moveSpeed = 2; // Matches the model's support-foot travel at normal cadence.
  function createMarine(x = 0, z = 0) {
    return { x, z, yaw: 0, moving: false, time: 0, runWeight: 0 };
  }
  function createWorld() {
    return { marines: [createMarine()], destination: null };
  }
  function contains(point) {
    return point && Number.isFinite(point.x) && Number.isFinite(point.z)
      && Math.abs(point.x) <= halfSize && Math.abs(point.z) <= halfSize;
  }
  function moveTo(world, point) {
    if (!contains(point)) return false;
    world.destination = { x: point.x, z: point.z };
    for (const marine of world.marines) marine.moving = Math.hypot(point.x - marine.x, point.z - marine.z) > 1e-6;
    return true;
  }
  function update(world, dt) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    for (const marine of world.marines) {
      marine.time += dt;
      const dx = world.destination ? world.destination.x - marine.x : 0;
      const dz = world.destination ? world.destination.z - marine.z : 0;
      const distance = Math.hypot(dx, dz);
      marine.moving = distance > 1e-6;
      marine.runWeight += ((marine.moving ? 1 : 0) - marine.runWeight) * (1 - Math.exp(-dt * 10));
      if (!marine.moving) continue;
      marine.yaw = Math.atan2(dx, dz);
      const step = Math.min(distance, moveSpeed * dt * marine.runWeight);
      if (step === distance) {
        marine.x = world.destination.x;
        marine.z = world.destination.z;
        marine.moving = false;
      } else {
        marine.x += dx / distance * step;
        marine.z += dz / distance * step;
      }
    }
  }
  function cameraFrame(yaw, pitch, zoom, width, height) {
    const c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const scale = 2 * zoom / 28 * Math.min(width, height);
    return {
      right: [c, 0, -s], up: [-s * sp, cp, -c * sp], eye: [s * cp, sp, c * cp],
      scale: [scale / width, scale / height],
    };
  }
  function groundPoint(ndcX, ndcY, camera) {
    if (Math.abs(camera.eye[1]) < 1e-5) return null;
    const horizontal = ndcX / camera.scale[0], vertical = ndcY / camera.scale[1];
    const p = camera.right.map((value, i) => value * horizontal + camera.up[i] * vertical);
    const depth = -p[1] / camera.eye[1];
    const point = { x: p[0] + depth * camera.eye[0], z: p[2] + depth * camera.eye[2] };
    return contains(point) ? point : null;
  }
  return { halfSize, createMarine, createWorld, moveTo, update, cameraFrame, groundPoint };
})();
