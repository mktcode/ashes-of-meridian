'use strict';

const CrowdSimulation = (() => {
  const nav = CrowdNavigation, halfSize = CrowdTerrain.halfSize;
  const moveSpeed = 2, fixedStep = 1 / 60, diameter = nav.radius * 2;
  const bucketSize = 1.5, bucketCount = Math.ceil(halfSize * 2 / bucketSize);
  const turns = [0, ...Array.from({ length: 11 }, (_, i) => [i + 1, -i - 1]).flat(), 12]
    .map(n => [Math.cos(n * Math.PI / 12), Math.sin(n * Math.PI / 12)]);
  function createMarine(x = 0, z = 0) {
    return { x, y: CrowdTerrain.heightAt(x, z), z, yaw: 0, moving: false, time: 0, runWeight: 0, vx: 0, vz: 0,
      avoidSide: 1, avoidCos: 1, avoidSin: 0, clearFor: 0, target: null, directCell: -1, direct: false, bestDistance: Infinity, stalledFor: 0,
      previous: { x, z, yaw: 0, time: 0, runWeight: 0 } };
  }
  function createWorld() {
    return { marines: [createMarine()], destination: null, field: null, slots: [], arrivalRadius: 0, arrivalDirection: null, arrivalFront: 0, accumulator: 0,
      stats: { fieldBuilds: 0, neighbourChecks: 0, steps: 0 }, scratch: null, notice: '' };
  }
  function setTarget(marine, target) {
    marine.target = target; marine.directCell = -1; marine.direct = false;
    marine.bestDistance = Infinity; marine.stalledFor = 0;
    marine.avoidCos = 1; marine.avoidSin = 0; marine.clearFor = 0;
    marine.moving = Math.hypot(target.x - marine.x, target.z - marine.z) > 0.03;
  }
  function spawnMarine(world) {
    const point = nav.spawnSites.find(site => world.marines.every(m => Math.hypot(m.x - site.x, m.z - site.z) >= diameter + 0.03));
    if (!point) return null;
    const slots = world.field ? nav.places(world.destination, world.marines.length + 1, world.field, true, world.arrivalDirection) : [];
    if (world.field && slots.length <= world.marines.length) return null;
    const marine = createMarine(point.x, point.z);
    if (world.field) {
      const target = slots.find(slot => !world.slots.some(old => Math.hypot(old.x - slot.x, old.z - slot.z) < 0.01));
      if (!target) return null;
      target.row = arrivalRow(target, world.arrivalDirection, world.arrivalFront);
      setTarget(marine, target);
      world.slots.push(target);
      world.arrivalRadius = Math.max(world.arrivalRadius, Math.hypot(target.x - world.destination.x, target.z - world.destination.z) + 1.5);
    }
    world.marines.push(marine);
    return marine;
  }
  const depth = (point, direction) => point.x * direction.x + point.z * direction.z;
  const lateral = (point, direction) => point.z * direction.x - point.x * direction.z;
  const arrivalRow = (point, direction, front) => Math.floor((front - depth(point, direction)) / (diameter + 0.05) + 1e-8);
  function arrivalDirection(marines, point) {
    let x = 0, z = 0;
    for (const marine of marines) { x += point.x - marine.x; z += point.z - marine.z; }
    if (Math.hypot(x, z) < nav.cellSize * Math.max(1, marines.length)) {
      // Symmetric approaches have no dominant direction: use a deterministic nonzero fallback.
      let farthest = 0;
      x = 0; z = 1;
      for (const marine of marines) {
        const distance = Math.hypot(point.x - marine.x, point.z - marine.z);
        if (distance > farthest + 1e-8) { farthest = distance; x = point.x - marine.x; z = point.z - marine.z; }
      }
    }
    const length = Math.hypot(x, z) || 1;
    return { x: x / length, z: z / length };
  }
  function moveTo(world, point) {
    if (!point || !nav.canStand(point.x, point.z)) return false;
    if (world.destination && point.x === world.destination.x && point.z === world.destination.z) return true;
    const field = nav.buildField(point);
    if (!field || world.marines.some(m => !Number.isFinite(field.cost[nav.indexAt(m.x, m.z)]))) return false;
    const direction = arrivalDirection(world.marines, point);
    const slots = nav.places(point, world.marines.length, field, true, direction);
    if (slots.length !== world.marines.length) return false;
    const front = Math.max(depth(point, direction), ...slots.map(slot => depth(slot, direction)));
    for (const slot of slots) slot.row = arrivalRow(slot, direction, front);
    // Fill the far side first; match lateral order within each depth band rather than crossing lanes.
    const ordered = world.marines.slice().sort((a, b) => depth(b, direction) - depth(a, direction) || lateral(a, direction) - lateral(b, direction));
    const ranked = slots.slice().sort((a, b) => a.row - b.row || lateral(a, direction) - lateral(b, direction));
    for (let start = 0; start < ranked.length;) {
      let end = start + 1;
      while (end < ranked.length && ranked[end].row === ranked[start].row) end++;
      const group = ordered.slice(start, end).sort((a, b) => lateral(a, direction) - lateral(b, direction));
      for (let i = start; i < end; i++) setTarget(group[i - start], ranked[i]);
      start = end;
    }
    world.destination = { x: point.x, z: point.z }; world.field = field; world.slots = slots;
    world.arrivalDirection = direction; world.arrivalFront = front;
    world.arrivalRadius = Math.max(...slots.map(slot => Math.hypot(slot.x - point.x, slot.z - point.z))) + 1.5;
    world.stats.fieldBuilds++;
    return true;
  }
  function reassignPending(world) {
    // Rare last-metre recovery, not navigation replanning: exchange only unoccupied reservations.
    const pending = world.marines.filter(m => m.moving && m.direct);
    for (let i = 0; i < pending.length; i++) for (let j = i + 1; j < pending.length; j++) {
      const a = pending[i], b = pending[j], at = a.target, bt = b.target;
      // Recovery may fix crossed lanes, but must never swap front and rear rows.
      if (at.row !== bt.row || (lateral(a, world.arrivalDirection) - lateral(b, world.arrivalDirection))
        * (lateral(bt, world.arrivalDirection) - lateral(at, world.arrivalDirection)) < -1e-8) continue;
      const before = Math.hypot(a.x - at.x, a.z - at.z) + Math.hypot(b.x - bt.x, b.z - bt.z);
      const after = Math.hypot(a.x - bt.x, a.z - bt.z) + Math.hypot(b.x - at.x, b.z - at.z);
      if (after + 0.1 < before && nav.canTravel(a.x, a.z, bt.x, bt.z) && nav.canTravel(b.x, b.z, at.x, at.z)) {
        setTarget(a, bt); setTarget(b, at);
      }
    }
    for (const marine of pending) marine.stalledFor = 0;
  }
  function scratchFor(world) {
    const n = world.marines.length;
    if (!world.scratch || world.scratch.links.length !== n) {
      world.scratch = { heads: new Int32Array(bucketCount ** 2), links: new Int32Array(n),
        startX: new Float64Array(n), startZ: new Float64Array(n), vx: new Float64Array(n), vz: new Float64Array(n),
        pushX: new Float64Array(n), pushZ: new Float64Array(n), remaining: new Float64Array(n) };
    }
    return world.scratch;
  }
  const bucket = value => Math.max(0, Math.min(bucketCount - 1, Math.floor((value + halfSize) / bucketSize)));
  function buildBuckets(units, scratch) {
    scratch.heads.fill(-1);
    for (let i = 0; i < units.length; i++) {
      const key = bucket(units[i].z) * bucketCount + bucket(units[i].x);
      scratch.links[i] = scratch.heads[key]; scratch.heads[key] = i;
    }
  }
  function pairs(world, scratch, visit) {
    const units = world.marines;
    for (let i = 0; i < units.length; i++) {
      const bx = bucket(units[i].x), bz = bucket(units[i].z);
      for (let z = Math.max(0, bz - 1); z <= Math.min(bucketCount - 1, bz + 1); z++) {
        for (let x = Math.max(0, bx - 1); x <= Math.min(bucketCount - 1, bx + 1); x++) {
          for (let j = scratch.heads[z * bucketCount + x]; j >= 0; j = scratch.links[j]) {
            if (j <= i) continue;
            world.stats.neighbourChecks++; visit(i, j);
          }
        }
      }
    }
  }
  function slide(marine, dx, dz) {
    if (nav.canTravel(marine.x, marine.z, marine.x + dx, marine.z + dz)) { marine.x += dx; marine.z += dz; return; }
    if (nav.canTravel(marine.x, marine.z, marine.x + dx, marine.z)) marine.x += dx;
    if (nav.canTravel(marine.x, marine.z, marine.x, marine.z + dz)) marine.z += dz;
  }
  function safeVelocity(units, s, i, nearby, vx, vz, speed, straight) {
    const horizon = Math.min(0.15, s.remaining[i] / speed);
    if (!nav.canTravel(units[i].x, units[i].z, units[i].x + vx * horizon, units[i].z + vz * horizon)) return false;
    for (const j of nearby) {
      const otherSpeed = Math.hypot(units[j].vx, units[j].vz);
      const otherHorizon = Math.min(0.15, s.remaining[j] / (otherSpeed || 1));
      const preview = straight && otherSpeed < 0.05 ? Math.min(0.6, s.remaining[i] / speed) : horizon;
      const dx = units[i].x - units[j].x, dz = units[i].z - units[j].z;
      const px = vx * preview - units[j].vx * otherHorizon, pz = vz * preview - units[j].vz * otherHorizon;
      const t = Math.max(0, Math.min(1, -(dx * px + dz * pz) / (px * px + pz * pz || 1)));
      if (Math.hypot(dx + px * t, dz + pz * t) < Math.min(diameter + 0.015, Math.hypot(dx, dz)) - 1e-5) return false;
    }
    return true;
  }
  function tick(world) {
    const units = world.marines, s = scratchFor(world), dt = fixedStep;
    s.vx.fill(0); s.vz.fill(0); s.pushX.fill(0); s.pushZ.fill(0); s.remaining.fill(0);
    for (let i = 0; i < units.length; i++) {
      const marine = units[i];
      s.startX[i] = marine.x; s.startZ[i] = marine.z;
      const previous = marine.previous;
      previous.x = marine.x; previous.z = marine.z; previous.yaw = marine.yaw;
      previous.time = marine.time; previous.runWeight = marine.runWeight;
      marine.time += dt;
      if (!marine.target) continue;
      const dx = marine.target.x - marine.x, dz = marine.target.z - marine.z, distance = Math.hypot(dx, dz);
      s.remaining[i] = distance;
      if (distance <= 0.03) continue;
      const cell = nav.indexAt(marine.x, marine.z);
      if (cell !== marine.directCell || !marine.direct && cell === world.field.goal) {
        marine.directCell = cell;
        marine.direct = Math.hypot(marine.x - world.destination.x, marine.z - world.destination.z) <= world.arrivalRadius
          && nav.canTravel(marine.x, marine.z, marine.target.x, marine.target.z);
      }
      const direction = marine.direct ? { x: dx / distance, z: dz / distance } : nav.direction(world.field, marine.x, marine.z);
      const speed = Math.min(moveSpeed * Math.min(1, marine.runWeight + dt * 10), marine.direct ? distance * 5 : moveSpeed);
      s.vx[i] = direction.x * speed; s.vz[i] = direction.z * speed;
    }
    buildBuckets(units, s);
    for (let i = 0; i < units.length; i++) {
      const speed = Math.hypot(s.vx[i], s.vz[i]);
      if (speed < 1e-6) continue;
      const nearby = [], bx = bucket(units[i].x), bz = bucket(units[i].z);
      for (let z = Math.max(0, bz - 1); z <= Math.min(bucketCount - 1, bz + 1); z++) {
        for (let x = Math.max(0, bx - 1); x <= Math.min(bucketCount - 1, bx + 1); x++) {
          for (let j = s.heads[z * bucketCount + x]; j >= 0; j = s.links[j]) {
            if (j === i) continue;
            world.stats.neighbourChecks++;
            if (Math.hypot(units[i].x - units[j].x, units[i].z - units[j].z) < 1.4) nearby.push(j);
          }
        }
      }
      const marine = units[i], clear = safeVelocity(units, s, i, nearby, s.vx[i], s.vz[i], speed, true);
      marine.clearFor = clear ? Math.min(0.18, marine.clearFor + dt) : 0;
      const heldX = s.vx[i] * marine.avoidCos + s.vz[i] * marine.avoidSin;
      const heldZ = s.vz[i] * marine.avoidCos - s.vx[i] * marine.avoidSin;
      // A brief clear gap must not undo a safe passing manoeuvre on the very next tick.
      if (marine.avoidCos < 0.999 && marine.clearFor < 0.18
        && safeVelocity(units, s, i, nearby, heldX, heldZ, speed, false)) {
        s.pushX[i] = heldX; s.pushZ[i] = heldZ;
        continue;
      }
      for (const [c, candidateTurn] of turns) {
        const turn = candidateTurn * marine.avoidSide;
        const vx = s.vx[i] * c + s.vz[i] * turn, vz = s.vz[i] * c - s.vx[i] * turn;
        if (c === 1 ? !clear : !safeVelocity(units, s, i, nearby, vx, vz, speed, false)) continue;
        s.pushX[i] = vx; s.pushZ[i] = vz;
        marine.avoidCos = c; marine.avoidSin = turn;
        if (Math.abs(turn) > 1e-4) marine.avoidSide = Math.sign(turn);
        break;
      }
    }
    // All steering reads the old positions/velocities before any marine advances.
    for (let i = 0; i < units.length; i++) slide(units[i], s.pushX[i] * dt, s.pushZ[i] * dt);
    for (let pass = 0; pass < 4; pass++) {
      buildBuckets(units, s); s.pushX.fill(0); s.pushZ.fill(0);
      let overlaps = false;
      pairs(world, s, (i, j) => {
        let dx = units[i].x - units[j].x, dz = units[i].z - units[j].z, distance = Math.hypot(dx, dz);
        if (distance >= diameter - 1e-5) return;
        overlaps = true;
        if (distance < 1e-6) { const angle = i * 2.4 + j; dx = Math.cos(angle); dz = Math.sin(angle); }
        else { dx /= distance; dz /= distance; }
        const fixedI = units[i].target && !units[i].moving, fixedJ = units[j].target && !units[j].moving;
        const share = fixedI && !fixedJ ? 0 : fixedJ && !fixedI ? 1 : 0.5;
        const push = diameter - distance + 1e-5;
        s.pushX[i] += dx * push * share; s.pushZ[i] += dz * push * share;
        s.pushX[j] -= dx * push * (1 - share); s.pushZ[j] -= dz * push * (1 - share);
      });
      if (!overlaps) break;
      for (let i = 0; i < units.length; i++) slide(units[i], s.pushX[i], s.pushZ[i]);
    }
    for (let i = 0; i < units.length; i++) {
      const marine = units[i];
      const distance = marine.target ? Math.hypot(marine.target.x - marine.x, marine.target.z - marine.z) : 0;
      marine.moving = distance > 0.03;
      if (!marine.moving || distance < marine.bestDistance - 0.05) { marine.bestDistance = distance; marine.stalledFor = 0; }
      else marine.stalledFor += dt;
      if (marine.target && !marine.moving && nav.canTravel(marine.x, marine.z, marine.target.x, marine.target.z)) {
        marine.x = marine.target.x; marine.z = marine.target.z;
      }
      const dx = marine.x - s.startX[i], dz = marine.z - s.startZ[i], travelled = Math.hypot(dx, dz);
      marine.vx = dx / dt; marine.vz = dz / dt;
      const animation = Math.min(1, travelled / (moveSpeed * dt));
      marine.runWeight += (animation - marine.runWeight) * (1 - Math.exp(-dt * 10));
      // Face meaningful locomotion, not tiny alternating overlap corrections.
      if (travelled > moveSpeed * dt * 0.08) {
        const angle = Math.atan2(dx, dz) - marine.yaw;
        const turn = Math.atan2(Math.sin(angle), Math.cos(angle)) * (1 - Math.exp(-dt * 12));
        marine.yaw += Math.max(-5 * dt, Math.min(5 * dt, turn));
      }
      marine.y = CrowdTerrain.heightAt(marine.x, marine.z);
    }
    if (units.some(m => m.moving && m.direct && m.stalledFor > 2)) reassignPending(world);
    world.stats.steps++;
  }
  function update(world, dt) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    world.stats.neighbourChecks = 0;
    world.accumulator += Math.min(dt, 0.25);
    while (world.accumulator >= fixedStep - 1e-10) { tick(world); world.accumulator -= fixedStep; }
  }
  function renderMarine(world, marine) {
    const alpha = Math.max(0, Math.min(1, world.accumulator / fixedStep)), previous = marine.previous;
    const blend = key => previous[key] + (marine[key] - previous[key]) * alpha;
    const x = blend('x'), z = blend('z'), angle = marine.yaw - previous.yaw;
    // A shared tick fraction keeps neighbouring bodies temporally aligned, without individual position lag.
    return { x, y: CrowdTerrain.heightAt(x, z), z,
      yaw: previous.yaw + Math.atan2(Math.sin(angle), Math.cos(angle)) * alpha,
      time: blend('time'), runWeight: blend('runWeight') };
  }
  function cameraFrame(yaw, pitch, zoom, width, height) {
    const c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const scale = 2 * zoom / (halfSize * 2 * Math.SQRT2 + 8) * Math.min(width, height);
    return { right: [c, 0, -s], up: [-s * sp, cp, -c * sp], eye: [s * cp, sp, c * cp], scale: [scale / width, scale / height] };
  }
  function groundPoint(ndcX, ndcY, camera) {
    const ground = CrowdTerrain.pick(ndcX, ndcY, camera);
    if (!ground) return null;
    const origin = camera.right.map((value, i) => value * ndcX / camera.scale[0] + camera.up[i] * ndcY / camera.scale[1] + camera.eye[i] * 80);
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
  return { halfSize, createMarine, createWorld, spawnMarine, moveTo, update, renderMarine, cameraFrame, groundPoint };
})();
