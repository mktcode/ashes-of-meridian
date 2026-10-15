'use strict';

// Rare, shared local routing around resting bodies. Static detours use the shared navigation tree.
const CrowdRecovery = (() => {
  const step = 0.05, radius = 6, side = Math.round(radius * 2 / step) + 1;
  const states = new WeakMap(), expansionBudget = 8192, cacheLimit = 8;
  const within = (p, center, nav) => Math.abs(p.x - center.x) <= radius + nav.radius + p.unit.radius + 0.02
    && Math.abs(p.z - center.z) <= radius + nav.radius + p.unit.radius + 0.02;
  function snapshot(world, marine) {
    return world.marines.filter(m => m !== marine && (!m.moving || m.waitingForRoute || m.yieldUntil > world.time
      || (marine.kind === 'tank' || m.kind === 'tank') && m.stalledFor > 1 && Math.hypot(m.vx, m.vz) < 0.05)).map(m => ({ unit: m, x: m.x, z: m.z }));
  }
  function same(a, b) {
    return a.length === b.length && a.every((p, i) => p.unit === b[i].unit && p.x === b[i].x && p.z === b[i].z);
  }
  function clearLine(a, b, parked, nav) {
    if (!nav.canTravel(a.x, a.z, b.x, b.z)) return false;
    const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
    for (const p of parked) {
      const ax = a.x - p.x, az = a.z - p.z;
      const t = Math.max(0, Math.min(1, -(ax * dx + az * dz) / (length || 1)));
      // Permit escape from existing solver contact, but never move closer into that body.
      if ((ax + dx * t) ** 2 + (az + dz * t) ** 2 < Math.min((nav.radius + p.unit.radius + 0.015) ** 2, ax * ax + az * az) - 1e-8) return false;
    }
    return true;
  }
  function createField(group, center, goal, parked, target) {
    const nav = CrowdNavigation.forKind(group.kind);
    const ox = center.x - radius, oz = center.z - radius, count = side * side;
    const blocked = new Uint8Array(count), cost = new Float64Array(count).fill(Infinity), next = new Int32Array(count).fill(-1);
    const closed = new Uint8Array(count), heapIndex = [], heapCost = [];
    const point = i => ({ x: ox + (i % side) * step, z: oz + Math.floor(i / side) * step });
    for (let i = 0; i < count; i++) {
      const p = point(i);
      blocked[i] = !nav.canStand(p.x, p.z) || !Number.isFinite(group.field.cost[nav.indexAt(p.x, p.z)]) ? 1 : 0;
    }
    const nearby = parked.filter(p => within(p, center, nav));
    for (const p of nearby) {
      const bodyRadius = nav.radius + p.unit.radius + 0.02;
      const left = Math.max(0, Math.ceil((p.x - bodyRadius - ox) / step)), right = Math.min(side - 1, Math.floor((p.x + bodyRadius - ox) / step));
      const back = Math.max(0, Math.ceil((p.z - bodyRadius - oz) / step)), front = Math.min(side - 1, Math.floor((p.z + bodyRadius - oz) / step));
      for (let z = back; z <= front; z++) for (let x = left; x <= right; x++) {
        if ((ox + x * step - p.x) ** 2 + (oz + z * step - p.z) ** 2 < bodyRadius ** 2) blocked[z * side + x] = 1;
      }
    }
    function push(index, value) {
      let i = heapIndex.length;
      heapIndex.push(index); heapCost.push(value);
      while (i) {
        const parent = (i - 1) >> 1;
        if (heapCost[parent] <= value) break;
        heapIndex[i] = heapIndex[parent]; heapCost[i] = heapCost[parent]; i = parent;
      }
      heapIndex[i] = index; heapCost[i] = value;
    }
    function pop() {
      const index = heapIndex[0], value = heapCost[0], lastIndex = heapIndex.pop(), lastCost = heapCost.pop();
      if (heapIndex.length) {
        let i = 0;
        while (i * 2 + 1 < heapIndex.length) {
          let child = i * 2 + 1;
          if (child + 1 < heapIndex.length && heapCost[child + 1] < heapCost[child]) child++;
          if (lastCost <= heapCost[child]) break;
          heapIndex[i] = heapIndex[child]; heapCost[i] = heapCost[child]; i = child;
        }
        heapIndex[i] = lastIndex; heapCost[i] = lastCost;
      }
      return { index, value };
    }
    const potential = p => nav.travelDistance(group.field, target, p.x, p.z);
    if (goal) {
      const i = Math.round((goal.z - oz) / step) * side + Math.round((goal.x - ox) / step);
      if (!blocked[i]) { cost[i] = 0; push(i, 0); }
    } else {
      // Arrival exits must approach the actual reservation, not pull a rear-row marine back to the crowd centre.
      for (let z = 0; z < side; z++) for (let x = 0; x < side; x++) {
        if (x && z && x !== side - 1 && z !== side - 1) continue;
        const i = z * side + x, p = point(i), value = potential(p);
        if (!blocked[i] && Number.isFinite(value)) { cost[i] = value; push(i, value); }
      }
    }
    return { ox, oz, blocked, cost, next, closed, heapIndex, point, nearby, push, pop, goal, potential };
  }
  function plan(world, marine, target = marine.target) {
    const group = world.groups[marine.group], nav = CrowdNavigation.forKind(group.kind);
    nav.prepareTarget(group.field, target);
    const now = world.time, parked = snapshot(world, marine);
    let state = states.get(group);
    if (!state || state.command !== group.slotPool) {
      state = { command: group.slotPool, fields: new Map() }; states.set(group, state);
    }
    const close = Math.hypot(target.x - marine.x, target.z - marine.z) <= radius - 0.5;
    const center = close ? target : { x: Math.round(marine.x / 4) * 4, z: Math.round(marine.z / 4) * 4 };
    const final = close || Math.max(Math.abs(target.x - center.x), Math.abs(target.z - center.z)) <= radius - 0.5;
    const key = close ? target : `tile:${center.x}:${center.z}:${target.x}:${target.z}`;
    const nearby = parked.filter(p => within(p, center, nav));
    let field = state.fields.get(key);
    // Do not discard unfinished work every time a distant marine parks or a short yield expires.
    if (field && (!field.pending && now - field.refreshed >= 0.5 || field.nearby.some(p => p.unit === marine)) && !same(field.nearby, nearby)) {
      state.fields.delete(key); field = null;
    }
    if (!field) {
      if (state.fields.size >= cacheLimit) state.fields.delete(state.fields.keys().next().value);
      field = createField(group, center, final ? target : null, nearby, target); field.refreshed = now;
      state.fields.set(key, field); world.stats.recoveryFields++;
    } else { state.fields.delete(key); state.fields.set(key, field); }
    function blockedResult() {
      field.pending = false;
      if (!same(field.nearby, nearby)) { state.fields.delete(key); return { status: 'pending', continue: true }; }
      return { status: 'blocked' };
    }
    function staleResult() {
      field.pending = false; state.fields.delete(key);
      return { status: 'pending', continue: true };
    }
    const cx = Math.round((marine.x - field.ox) / step), cz = Math.round((marine.z - field.oz) / step);
    let start = -1, nearest = Infinity;
    for (let z = Math.max(0, cz - 6); z <= Math.min(side - 1, cz + 6); z++) {
      for (let x = Math.max(0, cx - 6); x <= Math.min(side - 1, cx + 6); x++) {
        const i = z * side + x;
        if (field.blocked[i]) continue;
        const p = field.point(i), distance = (p.x - marine.x) ** 2 + (p.z - marine.z) ** 2;
        if (distance < nearest && clearLine(marine, p, nearby, nav)) { nearest = distance; start = i; }
      }
    }
    if (start < 0) return blockedResult();
    const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
    let expanded = 0;
    while (field.heapIndex.length && !field.closed[start] && expanded < expansionBudget) {
      const { index: i, value } = field.pop();
      if (field.closed[i] || value !== field.cost[i]) continue;
      field.closed[i] = 1; expanded++;
      const x = i % side, z = Math.floor(i / side);
      for (const [dx, dz] of offsets) {
        if (x + dx < 0 || x + dx >= side || z + dz < 0 || z + dz >= side) continue;
        const j = i + dx + dz * side;
        if (field.blocked[j] || field.closed[j] || dx && dz && (field.blocked[i + dx] || field.blocked[i + dz * side])) continue;
        const candidate = value + step * (dx && dz ? Math.SQRT2 : 1);
        if (candidate >= field.cost[j]) continue;
        field.cost[j] = candidate; field.next[j] = i; field.push(j, candidate);
      }
    }
    world.stats.recoveryNodes += expanded;
    field.pending = !field.closed[start] && field.heapIndex.length > 0;
    if (!field.closed[start]) return field.pending ? { status: 'pending', continue: true } : blockedResult();
    const raw = [field.point(start)];
    for (let i = start, count = 0; field.next[i] >= 0 && count < side * side; count++) {
      i = field.next[i]; raw.push(field.point(i));
    }
    if (!final && field.potential(raw.at(-1)) >= field.potential(marine) - 0.5) return blockedResult();
    if (final) raw.push({ x: target.x, z: target.z });
    const points = [];
    let anchor = marine, last = null;
    for (const p of raw) {
      if (!clearLine(anchor, p, nearby, nav)) {
        if (!last || !clearLine(anchor, last, nearby, nav)) return staleResult();
        points.push(last); anchor = last;
        if (!clearLine(anchor, p, nearby, nav)) return staleResult();
      }
      last = p;
    }
    if (last && Math.hypot(last.x - marine.x, last.z - marine.z) > 0.03) points.push(last);
    let remaining = 0;
    for (let i = points.length - 1; i >= 0; i--) {
      points[i].remaining = remaining;
      if (i) remaining += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    }
    return points.length ? { status: 'ready', route: { points, index: 0 } }
      : final && Math.hypot(target.x - marine.x, target.z - marine.z) <= 0.03 ? { status: 'pending' } : blockedResult();
  }
  return { plan };
})();
