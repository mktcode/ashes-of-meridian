'use strict';

// CPU rig sampling and packed instance transforms are independent of WebGL and movement decisions.
const MarineInstances = (() => {
  const stride = 19, parts = MarineModel.parts, armor = parts.find(p => p.name === 'chest').color;
  const names = new Map(parts.map((p, i) => [p.name, i]));
  const parents = parts.map((p, i) => {
    if (!p.parent) return -1;
    const parent = names.get(p.parent);
    if (parent === undefined || parent >= i) throw new Error(`Invalid rig parent: ${p.name}`);
    return parent;
  });
  const pivotDistance = [];
  let radius = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    pivotDistance[i] = (parents[i] < 0 ? 0 : pivotDistance[parents[i]]) + Math.hypot(...p.pivot);
    radius = Math.max(radius, pivotDistance[i] + Math.hypot(...p.center) + Math.hypot(...p.size) / 2 + 1);
  }
  function visible(marine, camera, boundsRadius = radius) {
    const x = marine.x - camera.center[0], y = marine.y - camera.center[1], z = marine.z - camera.center[2];
    const dot = axis => x * axis[0] + y * axis[1] + z * axis[2];
    return Math.abs(dot(camera.right)) * camera.scale[0] <= 1 + boundsRadius * camera.scale[0]
      && Math.abs(dot(camera.up)) * camera.scale[1] <= 1 + boundsRadius * camera.scale[1]
      && Math.abs(dot(camera.eye)) <= camera.depth + boundsRadius;
  }
  function identity(out) {
    out.fill(0); out[0] = out[5] = out[10] = out[15] = 1;
  }
  function rotation(out, angles) {
    const [x, y, z] = angles, cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
    identity(out);
    out[0] = cz * cy; out[1] = sz * cy; out[2] = -sy;
    out[4] = cz * sy * sx - sz * cx; out[5] = sz * sy * sx + cz * cx; out[6] = cy * sx;
    out[8] = cz * sy * cx + sz * sx; out[9] = sz * sy * cx - cz * sx; out[10] = cy * cx;
  }
  function multiply(out, a, b) {
    for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) {
      out[col * 4 + row] = a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] + a[8 + row] * b[col * 4 + 2];
    }
    for (let row = 0; row < 3; row++) out[12 + row] = a[row] * b[12] + a[4 + row] * b[13] + a[8 + row] * b[14] + a[12 + row];
    out[3] = out[7] = out[11] = 0; out[15] = 1;
  }
  function create() {
    const root = new Float64Array(16), local = new Float64Array(16), joints = parts.map(() => new Float64Array(16));
    const zero = [0, 0, 0];
    const batch = {
      data: new Float32Array(0), count: 0,
      begin(capacity) {
        if (capacity * stride > this.data.length) {
          let boxes = Math.max(64, this.data.length / stride);
          while (boxes < capacity) boxes *= 2;
          this.data = new Float32Array(boxes * stride);
        }
        this.count = 0;
      },
      box(transform, center, size, color) {
        const offset = this.count++ * stride, out = this.data;
        if (offset + stride > out.length) throw new Error('Instance batch capacity exceeded');
        for (let col = 0; col < 3; col++) for (let row = 0; row < 4; row++) out[offset + col * 4 + row] = transform[col * 4 + row] * size[col];
        for (let row = 0; row < 3; row++) out[offset + 12 + row] = transform[row] * center[0] + transform[4 + row] * center[1] + transform[8 + row] * center[2] + transform[12 + row];
        out[offset + 15] = 1;
        out.set(color, offset + 16);
      },
      tank(unit, armorColor = null) {
        const transform = TankModel.sampleRoot(unit);
        for (const part of TankModel.parts) this.box(transform, part.center, part.size,
          armorColor && part.color === TankModel.armor ? armorColor : part.color);
      },
      marine(marine, pose = null, armorColor = null) {
        const c = Math.cos(marine.yaw), s = Math.sin(marine.yaw);
        if (!pose) {
          const ground = (x, z) => CrowdTerrain.heightAt(marine.x + c * x + s * z, marine.z - s * x + c * z) - marine.y;
          pose = MarineModel.samplePose(marine.time, marine.movementBlend, ground);
        }
        identity(root); root[0] = root[10] = c; root[2] = -s; root[8] = s;
        root[12] = marine.x; root[13] = marine.y; root[14] = marine.z;
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i], animation = pose[part.name], offset = animation?.offset || zero;
          if (animation?.matrix) local.set(animation.matrix);
          else rotation(local, animation?.rotation || zero);
          local[12] = part.pivot[0] + offset[0]; local[13] = part.pivot[1] + offset[1]; local[14] = part.pivot[2] + offset[2];
          multiply(joints[i], parents[i] < 0 ? root : joints[parents[i]], local);
          this.box(joints[i], part.center, part.size, armorColor && part.color === armor ? armorColor : part.color);
        }
      },
    };
    return batch;
  }
  return { stride, radius, visible, create };
})();
