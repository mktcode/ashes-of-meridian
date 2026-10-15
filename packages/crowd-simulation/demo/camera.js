'use strict';
const CrowdCamera = (() => {
  const halfSize = CrowdTerrain.halfSize, nav = { obstacles: CrowdObstacles };
  function cameraFrame(yaw, pitch, zoom, width, height, focus = null) {
    const c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const scale = 2 * zoom / (halfSize * 2 * Math.SQRT2 + 8) * Math.min(width, height);
    return { right: [c, 0, -s], up: [-s * sp, cp, -c * sp], eye: [s * cp, sp, c * cp], scale: [scale / width, scale / height],
      center: focus ? [focus.x, CrowdTerrain.heightAt(focus.x, focus.z), focus.z] : [0, 0, 0], depth: halfSize * 4 + 32 };
  }
  function groundPoint(ndcX, ndcY, camera) {
    const ground = CrowdTerrain.pick(ndcX, ndcY, camera);
    if (!ground) return null;
    const origin = camera.right.map((value, i) => value * ndcX / camera.scale[0] + camera.up[i] * ndcY / camera.scale[1] + camera.eye[i] * camera.depth + camera.center[i]);
    const direction = camera.eye.map(value => -value);
    const point = [ground.x, ground.y, ground.z];
    const groundDistance = point.reduce((sum, value, i) => sum + (value - origin[i]) * direction[i], 0);
    for (const box of nav.obstacles) {
      const min = [box.x - box.width / 2, box.baseY, box.z - box.depth / 2];
      const max = [box.x + box.width / 2, box.baseY + box.height, box.z + box.depth / 2];
      let near = 0, far = groundDistance;
      for (let axis = 0; axis < 3; axis++) {
        if (Math.abs(direction[axis]) < 1e-10) {
          if (origin[axis] < min[axis] || origin[axis] > max[axis]) far = -1;
        } else {
          const a = (min[axis] - origin[axis]) / direction[axis], b = (max[axis] - origin[axis]) / direction[axis];
          near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
        }
      }
      if (near <= far) return { x: box.x, z: box.z, y: box.baseY + box.height };
    }
    return ground;
  }
  return { cameraFrame, groundPoint };
})();
