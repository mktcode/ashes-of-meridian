import { fixedDelta as fixedStep } from './constants.js';

export function createSolver(terrain, navigation, recovery, contactMode = 'hostile-stop') {
  const nav = navigation, halfSize = terrain.halfSize;
  const diameter = nav.radius * 2;
  const contactDistance = 1.3, contactRelease = 1.7;
  const bucketSize = 1.5, bucketCount = Math.ceil(halfSize * 2 / bucketSize);
  const turns = [0, ...Array.from({ length: 11 }, (_, i) => [i + 1, -i - 1]).flat(), 12]
    .map(n => [Math.cos(n * Math.PI / 12), Math.sin(n * Math.PI / 12)]);
  /** @returns {import('./internal-types.js').SolverAgent} */
  function createAgent(x = 0, z = 0, group = 0, profile = nav.defaultProfile) {
    return { id: 0, x, y: terrain.heightAt(x, z), z, group, profile, radius: nav.forProfile(profile).radius, state: 'idle', contact: null, disengage: false,
      yaw: 0, moving: false, time: 0, movementBlend: 0, vx: 0, vz: 0,
      avoidSide: 1, avoidCos: 1, avoidSin: 0, clearFor: 0, target: null, directCell: -1, direct: false, bestDistance: Infinity, stalledFor: 0,
      route: null, navigation: null, waitingForRoute: false, recoverAfter: 0, yieldUntil: 0, bestFieldDistance: Infinity, alternativeCursor: 0,
      previous: { x, z, yaw: 0, time: 0, movementBlend: 0 } };
  }
  const navigationFor = group => navigation.forProfile(group.profile);
  function createGroup(world, team = 0, spawn = { x: 0, z: 0 }, profile = nav.defaultProfile) {
    const nav = navigation.forProfile(profile);
    if (!nav || !Number.isSafeInteger(team) || team < 0 || !spawn || !nav.canStand(spawn.x, spawn.z)) return -1;
    const id = world.groups.length;
    world.groups.push({ id, team, profile, spawn: { x: spawn.x, z: spawn.z }, spawnSites: null, order: 'idle',
      destination: null, field: null, slotPool: [], reservedSlots: new Set(),
      arrivalRadius: 0, arrivalDirection: null, arrivalFront: 0, reassignAfter: 0 });
    return id;
  }
  /** @returns {import('./internal-types.js').SolverWorld} */
  function createWorld() {
    const world = { units: [], groups: [], revision: 0, nextAgentId: 1,
      time: 0, recoveryAfter: 0, recoveryCandidate: null, recoveryWork: 0, resumeAfter: 0,
      stats: { fieldBuilds: 0, neighbourChecks: 0, contactChecks: 0, contacts: 0, steps: 0,
        recoveryAttempts: 0, recoveryFields: 0, recoveryNodes: 0, reassignments: 0, retargets: 0 },
      scratch: null };
    return world;
  }
  function setTarget(unit, target, disengage = false) {
    unit.target = target; unit.contact = null; unit.disengage = disengage; unit.directCell = -1; unit.direct = false;
    unit.bestDistance = Infinity; unit.bestFieldDistance = Infinity; unit.stalledFor = 0;
    unit.route = null; unit.navigation = { points: target.approach, index: -1, bestDistance: Infinity };
    unit.waitingForRoute = false; unit.recoverAfter = 0; unit.yieldUntil = 0; unit.alternativeCursor = 0;
    unit.avoidCos = 1; unit.avoidSin = 0; unit.clearFor = 0;
    unit.moving = Math.hypot(target.x - unit.x, target.z - unit.z) > 0.03;
    unit.state = unit.moving ? 'moving' : 'idle';
  }
  function releaseTarget(group, unit, state) {
    group.reservedSlots.delete(unit.target);
    unit.target = null; unit.navigation = null; unit.route = null; unit.waitingForRoute = false; unit.moving = false;
    unit.state = state; unit.disengage = false; unit.stalledFor = 0; unit.vx = unit.vz = 0;
  }
  const bucket = value => Math.max(0, Math.min(bucketCount - 1, Math.floor((value + halfSize) / bucketSize)));
  function availableSlots(world, group, pool, count, used = group.reservedSlots, commanded = new Set()) {
    if (count <= 0) return [];
    const blockers = new Map(), ownRadius = navigationFor(group).radius;
    const passageRadius = Math.max(ownRadius, ...world.units.map(m => m.radius));
    let reach = 0;
    for (const m of world.units) {
      const p = m.group !== group.id ? m.target || (!m.moving ? m : null) : !m.target && !commanded.has(m) ? m : null;
      if (!p) continue;
      const key = bucket(p.z) * bucketCount + bucket(p.x);
      if (!blockers.has(key)) blockers.set(key, []);
      const clearance = m.target ? ownRadius + m.radius + passageRadius * 2 + 0.15 : ownRadius + m.radius + 0.05;
      reach = Math.max(reach, clearance); blockers.get(key).push({ point: p, clearance });
    }
    const slots = [];
    for (const p of pool) {
      if (used.has(p)) continue;
      let clear = true;
      for (let z = bucket(p.z - reach); z <= bucket(p.z + reach) && clear; z++) {
        for (let x = bucket(p.x - reach); x <= bucket(p.x + reach) && clear; x++) {
          for (const b of blockers.get(z * bucketCount + x) || []) {
            if (Math.hypot(p.x - b.point.x, p.z - b.point.z) < b.clearance - 1e-8) { clear = false; break; }
          }
        }
      }
      if (clear) { slots.push(p); if (slots.length >= count) break; }
    }
    return slots;
  }
  function reserve(group, unit, target) {
    const nav = navigationFor(group);
    target.row = arrivalRow(target, group.arrivalDirection, group.arrivalFront, nav.radius * 2);
    nav.prepareTarget(group.field, target); group.reservedSlots.add(target); setTarget(unit, target);
    group.arrivalRadius = Math.max(group.arrivalRadius, target.approach[0].remaining + 1.5);
  }
  function spawnAgents(world, count, groupId = 0) {
    const group = Number.isSafeInteger(groupId) ? world.groups[groupId] : null;
    if (!group || !Number.isSafeInteger(count) || count <= 0) return [];
    const nav = navigationFor(group);
    let largest = nav.radius;
    const limit = Math.min(count, nav.spawnSites.length, group.field ? group.slotPool.length - group.reservedSlots.size : Infinity);
    if (limit <= 0) return [];
    const targets = group.field ? availableSlots(world, group, group.slotPool, limit) : [];
    const capacity = group.field ? targets.length : limit;
    if (!capacity) return [];
    const added = [], heads = new Int32Array(bucketCount ** 2).fill(-1), links = new Int32Array(world.units.length + capacity);
    const insert = i => {
      const m = world.units[i], key = bucket(m.z) * bucketCount + bucket(m.x);
      largest = Math.max(largest, m.radius);
      links[i] = heads[key]; heads[key] = i;
    };
    for (let i = 0; i < world.units.length; i++) insert(i);
    const sites = group.spawnSites || (group.spawn.x === 0 && group.spawn.z === 0 ? nav.spawnSites
      : nav.spawnSites.slice().sort((a, b) => (a.x - group.spawn.x) ** 2 + (a.z - group.spawn.z) ** 2
        - (b.x - group.spawn.x) ** 2 - (b.z - group.spawn.z) ** 2 || a.z - b.z || a.x - b.x));
    // A batch scans the unchanged site order once; new bodies cannot free earlier sites.
    for (const point of sites) {
      const bx = bucket(point.x), bz = bucket(point.z), range = Math.ceil((nav.radius + largest + 0.03) / bucketSize);
      let occupied = false;
      for (let z = Math.max(0, bz - range); z <= Math.min(bucketCount - 1, bz + range) && !occupied; z++) {
        for (let x = Math.max(0, bx - range); x <= Math.min(bucketCount - 1, bx + range) && !occupied; x++) {
          for (let i = heads[z * bucketCount + x]; i >= 0; i = links[i]) {
            const m = world.units[i];
            if (Math.hypot(m.x - point.x, m.z - point.z) < nav.radius + m.radius + 0.03) { occupied = true; break; }
          }
        }
      }
      if (occupied) continue;
      const unit = createAgent(point.x, point.z, groupId, group.profile);
      unit.id = world.nextAgentId++;
      if (group.field) reserve(group, unit, targets[added.length]);
      else if (group.order === 'hold') unit.state = 'holding';
      world.units.push(unit); insert(world.units.length - 1); added.push(unit);
      if (added.length === capacity) break;
    }
    if (added.length) { group.spawnSites = sites; world.revision++; }
    return added;
  }
  const spawnAgent = (world, groupId = 0) => spawnAgents(world, 1, groupId)[0] || null;
  const depth = (point, direction) => point.x * direction.x + point.z * direction.z;
  const lateral = (point, direction) => point.z * direction.x - point.x * direction.z;
  const arrivalRow = (point, direction, front, bodyDiameter = diameter) => Math.floor((front - depth(point, direction)) / (bodyDiameter + 0.05) + 1e-8);
  function arrivalDirection(units, point) {
    let x = 0, z = 0;
    for (const unit of units) { x += point.x - unit.x; z += point.z - unit.z; }
    if (!units.length || Math.hypot(x, z) < nav.cellSize * Math.max(1, units.length)) {
      let farthest = 0;
      x = 0; z = 1;
      for (const unit of units) {
        const distance = Math.hypot(point.x - unit.x, point.z - unit.z);
        if (distance > farthest + 1e-8) { farthest = distance; x = point.x - unit.x; z = point.z - unit.z; }
      }
    }
    const length = Math.hypot(x, z) || 1;
    return { x: x / length, z: z / length };
  }
  function moveTo(world, point, groupId = 0) {
    const group = Number.isSafeInteger(groupId) ? world.groups[groupId] : null;
    if (!group || !point) return false;
    const nav = navigationFor(group);
    if (!nav.canStand(point.x, point.z)) return false;
    const members = world.units.filter(m => m.group === groupId);
    const same = group.destination && point.x === group.destination.x && point.z === group.destination.z;
    if (same && members.every(m => m.target)) {
      const waiting = members.filter(m => m.waitingForRoute);
      for (const m of waiting) setTarget(m, m.target);
      if (waiting.length) {
        if (world.recoveryCandidate?.group === groupId) { world.recoveryCandidate = null; world.recoveryWork = 0; }
        world.revision++;
      }
      return true;
    }
    const field = same ? group.field : nav.buildField(point);
    if (!field || members.some(m => !Number.isFinite(field.cost[nav.indexAt(m.x, m.z)]))) return false;
    const direction = same ? group.arrivalDirection : arrivalDirection(members, point);
    const passage = world.units.reduce((largest, m) => m.radius > largest.radius ? navigationFor(m) : largest, nav);
    const slotPool = same ? group.slotPool : nav.places(point, nav.walkable.length, field, direction, passage);
    const pending = same ? members.filter(m => !m.target) : members;
    const slots = availableSlots(world, group, slotPool, pending.length, same ? group.reservedSlots : new Set(), new Set(members));
    if (slots.length !== pending.length) return false;
    const front = same ? group.arrivalFront : Math.max(depth(point, direction), ...slots.map(slot => depth(slot, direction)));
    for (const slot of slots) { slot.row = arrivalRow(slot, direction, front, nav.radius * 2); nav.prepareTarget(field, slot); }
    const ordered = pending.slice().sort((a, b) => depth(b, direction) - depth(a, direction) || lateral(a, direction) - lateral(b, direction));
    const ranked = slots.slice().sort((a, b) => a.row - b.row || lateral(a, direction) - lateral(b, direction));
    for (let start = 0; start < ranked.length;) {
      let end = start + 1;
      while (end < ranked.length && ranked[end].row === ranked[start].row) end++;
      const band = ordered.slice(start, end).sort((a, b) => lateral(a, direction) - lateral(b, direction));
      for (let i = start; i < end; i++) {
        const m = band[i - start]; setTarget(m, ranked[i], m.contact !== null);
      }
      start = end;
    }
    group.order = 'move'; group.destination = { x: point.x, z: point.z }; group.field = field; group.slotPool = slotPool;
    group.reservedSlots = same ? new Set([...group.reservedSlots, ...slots]) : new Set(slots);
    group.arrivalDirection = direction; group.arrivalFront = front; group.reassignAfter = 0;
    group.arrivalRadius = Math.max(0, ...Array.from(group.reservedSlots, slot => slot.approach[0].remaining)) + 1.5;
    if (world.recoveryCandidate?.group === groupId) { world.recoveryCandidate = null; world.recoveryWork = 0; }
    if (!same) world.stats.fieldBuilds++;
    world.revision++;
    return true;
  }
  function hold(world, groupId = 0) {
    const group = Number.isSafeInteger(groupId) ? world.groups[groupId] : null;
    if (!group) return false;
    for (const m of world.units) if (m.group === groupId) { releaseTarget(group, m, 'holding'); m.contact = null; }
    group.order = 'hold'; group.destination = null; group.field = null; group.slotPool = []; group.reservedSlots.clear();
    if (world.recoveryCandidate?.group === groupId) { world.recoveryCandidate = null; world.recoveryWork = 0; }
    world.revision++;
    return true;
  }
  function setTeam(world, groupId, team) {
    const group = Number.isSafeInteger(groupId) ? world.groups[groupId] : null;
    if (!group || !Number.isSafeInteger(team) || team < 0) return false;
    group.team = team;
    for (const m of world.units) if (m.contact !== null) {
      const enemy = world.units[m.contact], own = world.groups[m.group];
      if (enemy && own.team !== world.groups[enemy.group].team) continue;
      m.contact = null; m.state = own.order === 'move' ? 'waiting' : own.order === 'hold' ? 'holding' : 'idle';
    }
    world.resumeAfter = 0; world.revision++;
    return true;
  }
  function removeAgents(world, ids) {
    const removed = new Set(ids), old = world.units;
    if (!old.some(m => removed.has(m.id))) return 0;
    const indices = new Map();
    const kept = old.filter(m => !removed.has(m.id));
    kept.forEach((m, i) => indices.set(m, i));
    for (const m of old) if (removed.has(m.id)) releaseTarget(world.groups[m.group], m, 'idle');
    for (const m of kept) {
      if (m.contact !== null) {
        m.contact = indices.get(old[m.contact]) ?? null;
        if (m.contact === null) m.state = world.groups[m.group].order === 'move' ? 'waiting' : world.groups[m.group].order === 'hold' ? 'holding' : 'idle';
      }
      if (m.waitingForRoute) { m.waitingForRoute = false; m.yieldUntil = 0; m.recoverAfter = 0; }
    }
    for (const group of world.groups) recovery.invalidate(group);
    world.units = kept; world.scratch = null;
    world.recoveryCandidate = null; world.recoveryWork = 0; world.recoveryAfter = world.resumeAfter = 0;
    world.revision++;
    return old.length - kept.length;
  }
  function resumeWaiting(world) {
    if (world.time < world.resumeAfter) return;
    world.resumeAfter = world.time + 0.25;
    const pending = new Map();
    for (const m of world.units) if (!m.target && m.contact === null && world.groups[m.group].order === 'move') {
      if (!pending.has(m.group)) pending.set(m.group, []);
      pending.get(m.group).push(m);
    }
    for (const [id, members] of pending) {
      const group = world.groups[id], slots = availableSlots(world, group, group.slotPool, members.length, group.reservedSlots, new Set(members));
      for (let i = 0; i < slots.length; i++) reserve(group, members[i], slots[i]);
    }
  }
  function reassignPending(world, group) {
    const nav = navigationFor(group);
    const rows = new Map();
    for (const m of world.units) if (m.group === group.id && m.moving && m.direct && !m.route) {
      if (!rows.has(m.target.row)) rows.set(m.target.row, []);
      rows.get(m.target.row).push(m);
    }
    for (const pending of rows.values()) for (let i = 0; i < pending.length; i++) for (let j = i + 1; j < pending.length; j++) {
      const a = pending[i], b = pending[j], at = a.target, bt = b.target;
      if (at.row !== bt.row || (lateral(a, group.arrivalDirection) - lateral(b, group.arrivalDirection))
        * (lateral(bt, group.arrivalDirection) - lateral(at, group.arrivalDirection)) < -1e-8) continue;
      const before = Math.hypot(a.x - at.x, a.z - at.z) + Math.hypot(b.x - bt.x, b.z - bt.z);
      const after = Math.hypot(a.x - bt.x, a.z - bt.z) + Math.hypot(b.x - at.x, b.z - at.z);
      if (after + 0.1 < before && nav.canTravel(a.x, a.z, bt.x, bt.z) && nav.canTravel(b.x, b.z, at.x, at.z)) {
        setTarget(a, bt); setTarget(b, at); world.stats.reassignments++;
      }
    }
  }
  function recover(world) {
    if (world.time < world.recoveryAfter) return;
    let candidate = world.recoveryCandidate, index = -1;
    if (candidate && (!candidate.moving || candidate.stalledFor <= 2)) { candidate = null; world.recoveryCandidate = null; world.recoveryWork = 0; }
    const continuing = Boolean(candidate);
    if (continuing) index = world.units.indexOf(candidate);
    else for (let i = 0; i < world.units.length; i++) {
      const m = world.units[i];
      if (m.moving && m.stalledFor > 2 && m.recoverAfter <= world.time && m.yieldUntil <= world.time
        // Service the least recently tried unit, so an impossible reservation cannot starve the queue.
        && (!candidate || m.recoverAfter < candidate.recoverAfter || m.recoverAfter === candidate.recoverAfter && m.stalledFor > candidate.stalledFor)) { candidate = m; index = i; }
    }
    if (!candidate) return;
    const group = world.groups[candidate.group];
    world.recoveryAfter = world.time + 0.25;
    if (!continuing && world.time >= group.reassignAfter) { reassignPending(world, group); group.reassignAfter = world.time + 0.5; }
    if (!candidate.moving || candidate.stalledFor <= 2) return;
    candidate.recoverAfter = world.time + 0.5;
    if (!continuing) for (let i = 0; i < world.units.length; i++) {
      const other = world.units[i];
      if (other === candidate || !other.moving || other.stalledFor < 1 || Math.hypot(other.x - candidate.x, other.z - candidate.z) > (other.radius + candidate.radius) * 1.5) continue;
      // Large-body queues need independent detours; repeatedly freezing the next tank can lock a whole column.
      if (navigationFor(candidate).traffic === 'independent-detour' || navigationFor(other).traffic === 'independent-detour') continue;
      const priority = candidate.group === other.group ? candidate.target.row - other.target.row || index - i : candidate.group - other.group;
      if (priority > 0) { candidate.yieldUntil = world.time + 0.8; return; }
      other.yieldUntil = world.time + 0.8;
    }
    world.stats.recoveryAttempts++;
    world.recoveryCandidate = null;
    let result = recovery.plan(world, candidate);
    if (result.status === 'blocked') {
      for (let i = candidate.alternativeCursor; i < group.slotPool.length; i++) {
        const target = group.slotPool[i]; candidate.alternativeCursor = i + 1;
        if (group.reservedSlots.has(target) || arrivalRow(target, group.arrivalDirection, group.arrivalFront, candidate.radius * 2) !== candidate.target.row) continue;
        if (!availableSlots(world, group, [target], 1).length) continue;
        result = recovery.plan(world, candidate, target);
        if (result.status === 'ready') {
          group.reservedSlots.delete(candidate.target); reserve(group, candidate, target); world.stats.retargets++;
        } else if (result.status === 'pending') candidate.alternativeCursor = i;
        break;
      }
      if (candidate.alternativeCursor >= group.slotPool.length) candidate.alternativeCursor = 0;
    }
    if (result.status === 'ready') {
      candidate.route = result.route; candidate.waitingForRoute = false; candidate.stalledFor = 0;
      candidate.avoidCos = 1; candidate.avoidSin = 0; candidate.clearFor = 0;
    } else {
      candidate.waitingForRoute = true; candidate.yieldUntil = world.time + 0.5;
      if (result.continue && world.recoveryWork < 8) { world.recoveryCandidate = candidate; world.recoveryWork++; }
    }
    if (!world.recoveryCandidate) world.recoveryWork = 0;
  }
  function scratchFor(world) {
    const n = world.units.length;
    if (!world.scratch || world.scratch.links.length !== n) {
      world.scratch = { heads: new Int32Array(bucketCount ** 2), links: new Int32Array(n), contacts: new Int32Array(n),
        startX: new Float64Array(n), startZ: new Float64Array(n), vx: new Float64Array(n), vz: new Float64Array(n),
        pushX: new Float64Array(n), pushZ: new Float64Array(n), remaining: new Float64Array(n) };
    }
    return world.scratch;
  }
  function buildBuckets(units, scratch) {
    scratch.heads.fill(-1);
    for (let i = 0; i < units.length; i++) {
      const key = bucket(units[i].z) * bucketCount + bucket(units[i].x);
      scratch.links[i] = scratch.heads[key]; scratch.heads[key] = i;
    }
  }
  function pairs(world, scratch, visit) {
    const units = world.units;
    for (let i = 0; i < units.length; i++) {
      const bx = bucket(units[i].x), bz = bucket(units[i].z), range = Math.ceil((units[i].radius + scratch.maxRadius) / bucketSize);
      for (let z = Math.max(0, bz - range); z <= Math.min(bucketCount - 1, bz + range); z++) {
        for (let x = Math.max(0, bx - range); x <= Math.min(bucketCount - 1, bx + range); x++) {
          for (let j = scratch.heads[z * bucketCount + x]; j >= 0; j = scratch.links[j]) {
            if (j <= i) continue;
            world.stats.neighbourChecks++; visit(i, j);
          }
        }
      }
    }
  }
  function updateContacts(world, s) {
    const units = world.units;
    s.contacts.fill(-1);
    const enemies = contactMode === 'hostile-stop' && units.some(m => world.groups[m.group].team !== world.groups[units[0].group].team);
    if (enemies) for (let i = 0; i < units.length; i++) {
      const m = units[i], team = world.groups[m.group].team;
      let nearest = Infinity, nearEnemy = false;
      const reach = m.radius + s.maxRadius + 0.9;
      for (let z = bucket(m.z - reach); z <= bucket(m.z + reach); z++) {
        for (let x = bucket(m.x - reach); x <= bucket(m.x + reach); x++) {
          for (let j = s.heads[z * bucketCount + x]; j >= 0; j = s.links[j]) {
            if (j === i || world.groups[units[j].group].team === team) continue;
            world.stats.contactChecks++;
            const other = units[j], dx = other.x - m.x, dz = other.z - m.z, distance = Math.hypot(dx, dz);
            const retained = m.contact === j, contact = m.radius + other.radius + 0.5, release = contact + 0.4;
            if (distance <= release) nearEnemy = true;
            if (distance > (retained ? release : contact) || distance >= nearest) continue;
            // A fresh retreat order may leave contact, but cannot force a passage through enemies.
            if (!retained && m.disengage && Math.hypot(s.vx[i], s.vz[i]) > 1e-6 && dx * s.vx[i] + dz * s.vz[i] <= 0.01) continue;
            if (!nav.canTravel(m.x, m.z, other.x, other.z)) continue;
            nearest = distance; s.contacts[i] = j;
          }
        }
      }
      if (!nearEnemy) m.disengage = false;
    }
    // Decide from one snapshot before releasing any target or stopping a neighbour.
    for (let i = 0; i < units.length; i++) {
      const m = units[i], enemy = s.contacts[i], group = world.groups[m.group];
      if (!enemies) m.disengage = false;
      if (enemy >= 0) {
        if (m.contact === null) world.stats.contacts++;
        releaseTarget(group, m, 'contact'); m.contact = enemy; s.vx[i] = s.vz[i] = s.remaining[i] = 0;
      } else if (m.contact !== null) {
        m.contact = null; m.state = group.order === 'move' ? 'waiting' : group.order === 'hold' ? 'holding' : 'idle';
      }
    }
  }
  function slide(unit, dx, dz) {
    const nav = navigationFor(unit);
    if (nav.canTravel(unit.x, unit.z, unit.x + dx, unit.z + dz)) { unit.x += dx; unit.z += dz; return; }
    if (nav.canTravel(unit.x, unit.z, unit.x + dx, unit.z)) unit.x += dx;
    if (nav.canTravel(unit.x, unit.z, unit.x, unit.z + dz)) unit.z += dz;
  }
  function safeVelocity(units, s, i, nearby, vx, vz, speed, straight) {
    const nav = navigationFor(units[i]);
    const horizon = Math.min(0.15, s.remaining[i] / speed);
    if (!nav.canTravel(units[i].x, units[i].z, units[i].x + vx * horizon, units[i].z + vz * horizon)) return false;
    for (const j of nearby) {
      const otherSpeed = Math.hypot(units[j].vx, units[j].vz);
      const otherHorizon = Math.min(0.15, s.remaining[j] / (otherSpeed || 1));
      const preview = straight && otherSpeed < 0.05 ? Math.min(0.6, s.remaining[i] / speed) : horizon;
      const dx = units[i].x - units[j].x, dz = units[i].z - units[j].z;
      const px = vx * preview - units[j].vx * otherHorizon, pz = vz * preview - units[j].vz * otherHorizon;
      const t = Math.max(0, Math.min(1, -(dx * px + dz * pz) / (px * px + pz * pz || 1)));
      if (Math.hypot(dx + px * t, dz + pz * t) < Math.min(units[i].radius + units[j].radius + 0.015, Math.hypot(dx, dz)) - 1e-5) return false;
    }
    return true;
  }
  function tick(world) {
    const units = world.units, s = scratchFor(world), dt = fixedStep;
    world.time += dt; resumeWaiting(world);
    s.vx.fill(0); s.vz.fill(0); s.pushX.fill(0); s.pushZ.fill(0); s.remaining.fill(0); s.maxRadius = nav.radius;
    for (let i = 0; i < units.length; i++) {
      const unit = units[i], group = world.groups[unit.group], nav = navigationFor(group), moveSpeed = nav.maxSpeed;
      s.maxRadius = Math.max(s.maxRadius, unit.radius);
      s.startX[i] = unit.x; s.startZ[i] = unit.z;
      const previous = unit.previous;
      previous.x = unit.x; previous.z = unit.z; previous.yaw = unit.yaw;
      previous.time = unit.time; previous.movementBlend = unit.movementBlend;
      unit.time += dt;
      if (!unit.target) continue;
      const dx = unit.target.x - unit.x, dz = unit.target.z - unit.z, distance = Math.hypot(dx, dz);
      s.remaining[i] = distance;
      if (distance <= 0.03 || unit.waitingForRoute || unit.yieldUntil > world.time) continue;
      if (unit.route) {
        while (unit.route.index < unit.route.points.length) {
          const p = unit.route.points[unit.route.index];
          const next = unit.route.points[unit.route.index + 1];
          // The exit itself may be a corner: reach it before handing control back to the primary field.
          if (Math.hypot(p.x - unit.x, p.z - unit.z) > (next ? 0.06 : 1e-8)) break;
          // Being close to a corner does not yet make the following segment traversable.
          if (next && !nav.canTravel(unit.x, unit.z, next.x, next.z)) break;
          unit.route.index++;
        }
        if (unit.route.index === unit.route.points.length) {
          unit.route = null; unit.directCell = -1; unit.bestDistance = Infinity; unit.stalledFor = 0;
        }
      }
      const cell = nav.indexAt(unit.x, unit.z), navigation = unit.navigation;
      const approach = navigation.points[navigation.index];
      if (!unit.route && (cell !== unit.directCell || !unit.direct && cell === group.field.goal
        || approach && Math.hypot(approach.x - unit.x, approach.z - unit.z) <= 0.06)) {
        unit.directCell = cell; unit.direct = false; navigation.index = -1;
        if (Math.hypot(unit.x - group.destination.x, unit.z - group.destination.z) <= group.arrivalRadius) {
          unit.direct = nav.canTravel(unit.x, unit.z, unit.target.x, unit.target.z);
          if (!unit.direct) for (let i = navigation.points.length - 2; i > 0; i--) {
            const p = navigation.points[i];
            if (nav.canTravel(unit.x, unit.z, p.x, p.z)) { navigation.index = i; break; }
          }
        }
      }
      const waypoint = unit.route?.points[unit.route.index] || navigation.points[navigation.index];
      const waypointDistance = waypoint ? Math.hypot(waypoint.x - unit.x, waypoint.z - unit.z) : 0;
      if (waypoint) s.remaining[i] = Math.min(distance, waypointDistance);
      const direction = waypoint ? { x: (waypoint.x - unit.x) / waypointDistance, z: (waypoint.z - unit.z) / waypointDistance }
        : unit.direct ? { x: dx / distance, z: dz / distance } : nav.direction(group.field, unit.x, unit.z);
      const speed = Math.min(moveSpeed * Math.min(1, unit.movementBlend + dt * 10), waypoint ? waypointDistance / dt : unit.direct ? distance * 5 : moveSpeed);
      s.vx[i] = direction.x * speed; s.vz[i] = direction.z * speed;
    }
    buildBuckets(units, s); updateContacts(world, s);
    for (let i = 0; i < units.length; i++) {
      const speed = Math.hypot(s.vx[i], s.vz[i]);
      if (speed < 1e-6) continue;
      const nearby = [], bx = bucket(units[i].x), bz = bucket(units[i].z), range = Math.ceil((units[i].radius + s.maxRadius + 0.6) / bucketSize);
      for (let z = Math.max(0, bz - range); z <= Math.min(bucketCount - 1, bz + range); z++) {
        for (let x = Math.max(0, bx - range); x <= Math.min(bucketCount - 1, bx + range); x++) {
          for (let j = s.heads[z * bucketCount + x]; j >= 0; j = s.links[j]) {
            if (j === i) continue;
            world.stats.neighbourChecks++;
            if (Math.hypot(units[i].x - units[j].x, units[i].z - units[j].z) < units[i].radius + units[j].radius + 0.6) nearby.push(j);
          }
        }
      }
      const unit = units[i], clear = safeVelocity(units, s, i, nearby, s.vx[i], s.vz[i], speed, true);
      unit.clearFor = clear ? Math.min(0.18, unit.clearFor + dt) : 0;
      const heldX = s.vx[i] * unit.avoidCos + s.vz[i] * unit.avoidSin;
      const heldZ = s.vz[i] * unit.avoidCos - s.vx[i] * unit.avoidSin;
      // A brief clear gap must not undo a safe passing manoeuvre on the next tick.
      if (unit.avoidCos < 0.999 && unit.clearFor < 0.18
        && safeVelocity(units, s, i, nearby, heldX, heldZ, speed, false)) {
        s.pushX[i] = heldX; s.pushZ[i] = heldZ;
        continue;
      }
      for (const [c, candidateTurn] of turns) {
        const turn = candidateTurn * unit.avoidSide;
        const vx = s.vx[i] * c + s.vz[i] * turn, vz = s.vz[i] * c - s.vx[i] * turn;
        if (c === 1 ? !clear : !safeVelocity(units, s, i, nearby, vx, vz, speed, false)) continue;
        s.pushX[i] = vx; s.pushZ[i] = vz;
        unit.avoidCos = c; unit.avoidSin = turn;
        if (Math.abs(turn) > 1e-4) unit.avoidSide = Math.sign(turn);
        break;
      }
    }
    // All steering reads the old positions before any unit advances.
    for (let i = 0; i < units.length; i++) slide(units[i], s.pushX[i] * dt, s.pushZ[i] * dt);
    for (let pass = 0; pass < 4; pass++) {
      buildBuckets(units, s); s.pushX.fill(0); s.pushZ.fill(0);
      let overlaps = false;
      pairs(world, s, (i, j) => {
        let dx = units[i].x - units[j].x, dz = units[i].z - units[j].z, distance = Math.hypot(dx, dz);
        const separation = units[i].radius + units[j].radius;
        if (distance >= separation - 1e-5) return;
        overlaps = true;
        if (distance < 1e-6) { const angle = i * 2.4 + j; dx = Math.cos(angle); dz = Math.sin(angle); }
        else { dx /= distance; dz /= distance; }
        const fixedI = !units[i].moving, fixedJ = !units[j].moving;
        const share = fixedI && !fixedJ ? 0 : fixedJ && !fixedI ? 1 : 0.5;
        const push = separation - distance + 1e-5;
        s.pushX[i] += dx * push * share; s.pushZ[i] += dz * push * share;
        s.pushX[j] -= dx * push * (1 - share); s.pushZ[j] -= dz * push * (1 - share);
      });
      if (!overlaps) break;
      for (let i = 0; i < units.length; i++) slide(units[i], s.pushX[i], s.pushZ[i]);
    }
    buildBuckets(units, s);
    for (let i = 0; i < units.length; i++) {
      const unit = units[i], group = world.groups[unit.group], nav = navigationFor(group), moveSpeed = nav.maxSpeed;
      const distance = unit.target ? Math.hypot(unit.target.x - unit.x, unit.target.z - unit.z) : 0;
      let snapClear = true;
      if (unit.target && distance > 0 && distance <= 0.03) {
        const bx = bucket(unit.target.x), bz = bucket(unit.target.z), range = Math.ceil((unit.radius + s.maxRadius) / bucketSize);
        for (let z = Math.max(0, bz - range); z <= Math.min(bucketCount - 1, bz + range) && snapClear; z++) {
          for (let x = Math.max(0, bx - range); x <= Math.min(bucketCount - 1, bx + range) && snapClear; x++) {
            for (let j = s.heads[z * bucketCount + x]; j >= 0; j = s.links[j]) {
              if (i === j) continue;
              world.stats.neighbourChecks++;
              if (Math.hypot(unit.target.x - units[j].x, unit.target.z - units[j].z) < unit.radius + units[j].radius - 1e-5) { snapClear = false; break; }
            }
          }
        }
      }
      unit.moving = distance > 0.03 || !snapClear;
      unit.state = unit.contact !== null ? 'contact' : unit.target ? unit.moving ? unit.waitingForRoute ? 'waiting' : 'moving' : 'idle'
        : group.order === 'move' ? 'waiting' : group.order === 'hold' ? 'holding' : 'idle';
      const navigation = unit.navigation;
      const waypoint = unit.route?.points[unit.route.index] || navigation?.points[navigation.index];
      // Real detours count as progress; oscillation without improvement does not.
      const progress = waypoint ? Math.hypot(waypoint.x - unit.x, waypoint.z - unit.z) + waypoint.remaining
        : unit.direct ? distance : group.field && unit.target ? group.field.cost[nav.indexAt(unit.x, unit.z)] : distance;
      const owner = waypoint ? unit.route || navigation : unit;
      const key = !waypoint && !unit.direct ? 'bestFieldDistance' : 'bestDistance';
      if (!unit.moving || progress < (owner[key] ?? Infinity) - 0.05) { owner[key] = progress; unit.stalledFor = 0; }
      else if (unit.yieldUntil <= world.time) unit.stalledFor += dt;
      if (unit.target && !unit.moving && nav.canTravel(unit.x, unit.z, unit.target.x, unit.target.z)) {
        unit.x = unit.target.x; unit.z = unit.target.z;
      }
      const dx = unit.x - s.startX[i], dz = unit.z - s.startZ[i], travelled = Math.hypot(dx, dz);
      unit.vx = dx / dt; unit.vz = dz / dt;
      const animation = Math.min(1, travelled / (moveSpeed * dt));
      unit.movementBlend += (animation - unit.movementBlend) * (1 - Math.exp(-dt * 10));
      if (travelled > moveSpeed * dt * 0.08 || unit.contact !== null) {
        const enemy = units[unit.contact];
        const angle = (unit.contact !== null ? Math.atan2(enemy.x - unit.x, enemy.z - unit.z) : Math.atan2(dx, dz)) - unit.yaw;
        const turn = Math.atan2(Math.sin(angle), Math.cos(angle)) * (1 - Math.exp(-dt * 12));
        unit.yaw += Math.max(-5 * dt, Math.min(5 * dt, turn));
      }
      unit.y = terrain.heightAt(unit.x, unit.z);
    }
    recover(world);
    world.stats.steps++;
  }
  return { halfSize, contactDistance, contactRelease, createAgent, createWorld, createGroup, spawnAgent, spawnAgents,
    moveTo, hold, setTeam, tick, removeAgents };
}
