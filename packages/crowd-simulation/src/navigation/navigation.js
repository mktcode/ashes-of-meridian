export function createNavigation(surface, obstacles, profiles, cellSize = surface.cellSize) {
  const { bounds, columns, rows, width, depth } = surface, classes = new Map();
  const { minX, minZ, maxX, maxZ } = bounds;
  const center = { x: minX + width / 2, z: minZ + depth / 2 };
  const count = columns * rows;
  const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  function indexAt(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || x < minX || z < minZ || x >= maxX || z >= maxZ) return -1;
    return Math.floor((z - minZ) / cellSize) * columns + Math.floor((x - minX) / cellSize);
  }
  function pointAt(index) {
    return { x: minX + (index % columns + 0.5) * cellSize, z: minZ + (Math.floor(index / columns) + 0.5) * cellSize };
  }
  function create(profile) {
  const { radius, maxSlope, maxSpeed, traffic } = profile;
  const steep = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const { x, z } = pointAt(i);
    steep[i] = surface.cellSlopeAt(x, z) > maxSlope ? 1 : 0;
  }
  const parkingSpacing = radius * 4 + 0.15, clearance = Math.ceil(radius / cellSize);
  const walkable = new Uint8Array(count), neighbours = new Int32Array(count * 8).fill(-1);
  // Conservative footprint clearance: whole navigation cells stay clear of blocked triangles/boxes.
  for (let iz = clearance; iz < rows - clearance; iz++) for (let ix = clearance; ix < columns - clearance; ix++) {
    const i = iz * columns + ix, { x, z } = pointAt(i);
    let blocked = false;
    for (let dz = -clearance; dz <= clearance; dz++) for (let dx = -clearance; dx <= clearance; dx++) blocked ||= Boolean(steep[(iz + dz) * columns + ix + dx]);
    for (const box of obstacles) blocked ||= Math.abs(x - box.x) <= box.width / 2 + radius + cellSize / 2
      && Math.abs(z - box.z) <= box.depth / 2 + radius + cellSize / 2;
    walkable[i] = blocked ? 0 : 1;
  }
  for (let i = 0; i < count; i++) {
    if (!walkable[i]) continue;
    const ix = i % columns, iz = Math.floor(i / columns);
    for (let n = 0; n < offsets.length; n++) {
      const [dx, dz] = offsets[n], j = (iz + dz) * columns + ix + dx;
      if (!walkable[j]) continue;
      if (dx && dz && (!walkable[iz * columns + ix + dx] || !walkable[(iz + dz) * columns + ix])) continue;
      neighbours[i * 8 + n] = j;
    }
  }
  const canStand = (x, z) => indexAt(x, z) >= 0 && Boolean(walkable[indexAt(x, z)]);
  function canTravel(x, z, tx, tz) {
    const steps = Math.max(1, Math.ceil(Math.hypot(tx - x, tz - z) / (cellSize / 4)));
    let previous = indexAt(x, z);
    if (previous < 0 || !walkable[previous]) return false;
    for (let step = 1; step <= steps; step++) {
      const t = step / steps, next = indexAt(x + (tx - x) * t, z + (tz - z) * t);
      if (next < 0 || !walkable[next]) return false;
      const dx = next % columns - previous % columns, dz = Math.floor(next / columns) - Math.floor(previous / columns);
      if (dx && dz && (!walkable[previous + dx] || !walkable[previous + dz * columns])) return false;
      previous = next;
    }
    return true;
  }
  function buildField(point) {
    const goal = indexAt(point.x, point.z);
    if (goal < 0 || !walkable[goal]) return null;
    const cost = new Float64Array(count).fill(Infinity), next = new Int32Array(count).fill(-1);
    const flowX = new Float32Array(count), flowZ = new Float32Array(count), heap = [];
    function push(index, value) {
      let i = heap.length;
      heap.push({ index, value });
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (heap[parent].value <= value) break;
        heap[i] = heap[parent]; i = parent;
      }
      heap[i] = { index, value };
    }
    function pop() {
      const first = heap[0], last = heap.pop();
      if (heap.length) {
        let i = 0;
        while (i * 2 + 1 < heap.length) {
          let child = i * 2 + 1;
          if (child + 1 < heap.length && heap[child + 1].value < heap[child].value) child++;
          if (last.value <= heap[child].value) break;
          heap[i] = heap[child]; i = child;
        }
        heap[i] = last;
      }
      return first;
    }
    cost[goal] = 0; push(goal, 0);
    while (heap.length) {
      const item = pop(), i = item.index;
      if (item.value !== cost[i]) continue;
      for (let n = 0; n < 8; n++) {
        const j = neighbours[i * 8 + n];
        if (j < 0) continue;
        const value = item.value + (n < 4 ? cellSize : cellSize * Math.SQRT2);
        if (value >= cost[j]) continue;
        cost[j] = value; next[j] = i; push(j, value);
      }
    }
    for (let i = 0; i < count; i++) if (next[i] >= 0) {
      const dx = next[i] % columns - i % columns, dz = Math.floor(next[i] / columns) - Math.floor(i / columns), length = Math.hypot(dx, dz);
      flowX[i] = dx / length; flowZ[i] = dz / length;
    }
    return { goal, point: { x: point.x, z: point.z }, cost, next, flowX, flowZ };
  }
  function direction(field, x, z) {
    const index = indexAt(x, z);
    if (index < 0 || !Number.isFinite(field.cost[index])) return { x: 0, z: 0 };
    const gx = (x - minX) / cellSize - 0.5, gz = (z - minZ) / cellSize - 0.5;
    const ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, v = gz - iz;
    let dx = 0, dz = 0;
    for (let oz = 0; oz <= 1; oz++) for (let ox = 0; ox <= 1; ox++) {
      if (ix + ox < 0 || ix + ox >= columns || iz + oz < 0 || iz + oz >= rows) continue;
      const i = (iz + oz) * columns + ix + ox;
      const weight = (ox ? u : 1 - u) * (oz ? v : 1 - v);
      dx += field.flowX[i] * weight; dz += field.flowZ[i] * weight;
    }
    const length = Math.hypot(dx, dz);
    if (length > 1e-6 && canTravel(x, z, x + dx / length * 0.3, z + dz / length * 0.3)) return { x: dx / length, z: dz / length };
    // Near walls/flow seams, follow the safe descending graph edge instead of cutting a corner.
    const target = field.next[index] >= 0 ? pointAt(field.next[index]) : field.point;
    dx = target.x - x; dz = target.z - z;
    const distance = Math.hypot(dx, dz);
    return distance > 1e-6 ? { x: dx / distance, z: dz / distance } : { x: 0, z: 0 };
  }
  function prepareTarget(field, target) {
    if (target.approach) return target.approach;
    // Reverse the existing destination tree; no per-unit grid search or extra global field.
    const raw = [{ x: target.x, z: target.z }];
    if (!canTravel(field.point.x, field.point.z, target.x, target.z)) {
      for (let i = indexAt(target.x, target.z); i >= 0; i = field.next[i]) {
        raw.push(pointAt(i));
        if (i === field.goal) break;
      }
    }
    raw.push({ x: field.point.x, z: field.point.z }); raw.reverse();
    const points = [raw[0]];
    let anchor = raw[0], last = anchor;
    for (let i = 1; i < raw.length; i++) {
      const p = raw[i];
      if (!canTravel(anchor.x, anchor.z, p.x, p.z)) { points.push(last); anchor = last; }
      last = p;
    }
    if (Math.hypot(last.x - anchor.x, last.z - anchor.z) > 1e-8) points.push(last);
    let remaining = 0;
    for (let i = points.length - 1; i >= 0; i--) {
      points[i].remaining = remaining;
      if (i) remaining += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    }
    target.approach = points;
    return points;
  }
  function travelDistance(field, target, x, z) {
    if (canTravel(x, z, target.x, target.z)) return Math.hypot(x - target.x, z - target.z);
    const points = prepareTarget(field, target);
    let distance = field.cost[indexAt(x, z)] + points[0].remaining;
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i];
      if (canTravel(x, z, p.x, p.z)) distance = Math.min(distance, Math.hypot(x - p.x, z - p.z) + p.remaining);
    }
    return distance;
  }
  function places(point, limit, field = null, direction = null, passage = null) {
    const passageRadius = passage?.radius || radius, canPass = passage?.canStand || canStand;
    const laneSpacing = radius * 2 + Math.max(radius, passageRadius) * 2 + 0.15;
    // Small bodies park in compact islands, with crossing aisles for much larger bodies.
    // Three-column/row bands limit detours instead of creating a crowd-wide wall of parked bodies.
    const islands = passageRadius > radius * 2, spacing = islands ? parkingSpacing : laneSpacing;
    const rowSpacing = spacing * Math.sqrt(3) / 2;
    const widen = (value, pitch, gap) => value + Math.floor(value / pitch + 0.5) * gap;
    const candidates = [], rings = Math.ceil(Math.max(width, depth) * 2 / spacing);
    for (let q = -rings; q <= rings; q++) for (let r = -rings; r <= rings; r++) {
      const rawX = spacing * (q + r / 2), rawZ = rowSpacing * r;
      const dx = islands ? widen(rawX, spacing * 3, laneSpacing - spacing / 2) : rawX;
      const dz = islands ? widen(rawZ, rowSpacing * 3, laneSpacing - rowSpacing) : rawZ;
      const x = point.x + (direction ? direction.x * dx - direction.z * dz : dx);
      const z = point.z + (direction ? direction.z * dx + direction.x * dz : dz);
      if (!canStand(x, z) || field && !Number.isFinite(field.cost[indexAt(x, z)])) continue;
      // Park away from walls/cliffs so a resting marine cannot seal the last passing lane.
      if (offsets.some(([dx, dz]) => !canPass(x + dx * (radius + passageRadius + 0.05), z + dz * (radius + passageRadius + 0.05)))) continue;
      const center = field ? pointAt(indexAt(x, z)) : null, end = field ? pointAt(field.goal) : null;
      // Direct paths keep exact symmetric distances; hidden slots use the shared walking distance.
      const distance = field && !canTravel(point.x, point.z, x, z)
        ? field.cost[indexAt(x, z)] + Math.hypot(x - center.x, z - center.z) + Math.hypot(point.x - end.x, point.z - end.z)
        : Math.hypot(x - point.x, z - point.z);
      candidates.push({ x, z, distance });
    }
    candidates.sort((a, b) => {
      const walking = field ? a.distance - b.distance : 0;
      if (Math.abs(walking) > 1e-8) return walking;
      const radial = (a.x - point.x) ** 2 + (a.z - point.z) ** 2 - (b.x - point.x) ** 2 - (b.z - point.z) ** 2;
      if (!direction || Math.abs(radial) > 1e-8) return radial || a.z - b.z || a.x - b.x;
      // Equal-radius slots fill the far side first; ignore roundoff from rotating the lattice.
      const forward = (b.x - a.x) * direction.x + (b.z - a.z) * direction.z;
      return Math.abs(forward) > 1e-8 ? forward : (a.z - b.z) * direction.x - (a.x - b.x) * direction.z;
    });
    return candidates.slice(0, limit).map(({ x, z }) => ({ x, z }));
  }
  const spawnSites = places(center, count);
  return { bounds, width, depth, columns, rows, center, cellSize, radius, maxSlope, maxSpeed, traffic, parkingSpacing, obstacles, walkable, neighbours, indexAt, pointAt, canStand, canTravel, buildField, direction, prepareTarget, travelDistance, places, spawnSites };
  }
  function forProfile(id) {
    if (typeof id !== 'string' || !Object.hasOwn(profiles, id)) return null;
    if (!classes.has(id)) classes.set(id, create(profiles[id]));
    return classes.get(id);
  }
  const defaultProfile = Object.keys(profiles).sort((a, b) => profiles[a].radius - profiles[b].radius)[0];
  return { ...forProfile(defaultProfile), defaultProfile, forProfile, surface };
}
