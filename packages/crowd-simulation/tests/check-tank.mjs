import { fixture } from './fixture.mjs';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
const { core, nav, terrain, tank: model, instances, recovery, scenarios, createFixtureWorld, createTank } = fixture();
const large = nav.forProfile('tank');
assert.equal(large, nav.forProfile('tank')); assert.equal(nav.radius, 0.4); assert.equal(large.radius, 1.4);
assert.equal(large.cellSize, nav.cellSize); assert.equal(large.obstacles, nav.obstacles); assert.equal(large.maxSlope, nav.maxSlope);
const laneGoal = {x:20,z:-6}, laneField = nav.buildField(laneGoal), wideSlots = nav.places(laneGoal, 80, laneField, null, large);
assert.equal(wideSlots.length, 80);
for (const p of wideSlots) for (const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]])
  assert.ok(large.canStand(p.x + dx * (nav.radius + large.radius + 0.05), p.z + dz * (nav.radius + large.radius + 0.05)), 'Marine parking keeps tank clearance at walls as well as between bodies');
assert.ok(large.spawnSites.length < nav.spawnSites.length);
assert.ok(nav.canTravel(20.5, -6, 20.5, 8)); assert.ok(!large.canTravel(20.5, -6, 20.5, 8), 'Marine-width rock clearance is not tank clearance');
for (const part of model.parts) for (const x of [-0.5, 0.5]) for (const z of [-0.5, 0.5])
  assert.ok(Math.hypot(part.center[0] + x * part.size[0], part.center[2] + z * part.size[2]) <= large.radius, `${part.name}: entire rigid model fits physical disc, including barrel`);
for (const [x, z] of [[-8, 8], [8, -6], [-4, -3], [5, 4]]) for (const yaw of [0, 0.6, 2, 4]) {
  const unit = createTank(x, z), before = JSON.stringify(unit); unit.yaw = yaw;
  const batch = instances.create(); batch.begin(model.parts.length); batch.tank(unit, [0.65, 0.28, 0.18]);
  assert.equal(batch.count, model.parts.length);
  for (let i = 0; i < model.parts.length; i++) for (const a of [-0.5, 0, 0.5]) for (const b of [-0.5, 0, 0.5]) {
    const m = batch.data.subarray(i * instances.stride), px = m[0] * a - m[4] * 0.5 + m[8] * b + m[12];
    const py = m[1] * a - m[5] * 0.5 + m[9] * b + m[13], pz = m[2] * a - m[6] * 0.5 + m[10] * b + m[14];
    assert.ok(py >= terrain.heightAt(px, pz) - 1e-6, 'rigid tank never cuts into authoritative terrain');
    assert.ok(Math.hypot(px - x, py - unit.y, pz - z) < model.cullingRadius);
  }
  assert.ok(Math.abs(batch.data[2 * instances.stride + 16] - 0.65) < 1e-7);
  unit.yaw = 0; assert.equal(JSON.stringify(unit), before, 'sampling does not mutate simulation');
}
function validate(w, fixed = new Map()) {
  const buckets = new Map(), reservations = [], passageRadius = Math.max(...w.units.map(m => m.radius));
  for (const m of w.units) {
    const group = w.groups[m.group], n = nav.forProfile(group.profile);
    assert.equal(m.profile, group.profile); assert.equal(m.radius, n.radius); assert.ok(n.canStand(m.x, m.z));
    assert.ok(Number.isFinite(m.x + m.z + m.y + m.yaw)); assert.equal(m.y, terrain.heightAt(m.x, m.z));
    const bx = Math.floor(m.x / 3), bz = Math.floor(m.z / 3);
    for (let z = bz - 1; z <= bz + 1; z++) for (let x = bx - 1; x <= bx + 1; x++) for (const o of buckets.get(`${x}:${z}`) || [])
      assert.ok(Math.hypot(m.x - o.x, m.z - o.z) >= m.radius + o.radius - 0.02 - 1e-8, 'unchanged 2 cm solver tolerance for mixed physical bodies');
    const key = `${bx}:${bz}`; if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(m);
    if (m.target) { assert.ok(group.reservedSlots.has(m.target)); reservations.push(m); if (!m.moving) { assert.equal(m.x, m.target.x); assert.equal(m.z, m.target.z); } }
    if (m.state === 'contact') { assert.equal(m.target, null); assert.equal(m.moving, false); }
    if (fixed.has(m)) { const p = fixed.get(m); assert.deepEqual([m.x, m.z, m.target], p); }
    else if (!m.moving && (m.target || group.order === 'hold')) fixed.set(m, [m.x, m.z, m.target]);
  }
  for (const g of w.groups) assert.equal(g.reservedSlots.size, reservations.filter(m => m.group === g.id).length);
  for (let i = 0; i < reservations.length; i++) for (let j = i + 1; j < reservations.length; j++) {
    const a = reservations[i], b = reservations[j];
    assert.ok(Math.hypot(a.target.x - b.target.x, a.target.z - b.target.z) >= a.radius + b.radius + passageRadius * 2 + 0.15 - 1e-8, 'size-aware parking lanes');
  }
}
function settle(w, seconds, label) {
  const fields = w.groups.map(g => g.field), fixed = new Map(), times = []; let peak = 0, tick = 0;
  validate(w, fixed);
  for (; tick < seconds * 60; tick++) {
    const t = performance.now(); core.update(w, 1 / 60); times.push(performance.now() - t); peak = Math.max(peak, w.stats.neighbourChecks);
    if (tick % 30 === 0) validate(w, fixed);
    for (const g of w.groups) assert.equal(g.field, fields[g.id]);
    if (w.units.every(m => ['idle', 'holding'].includes(m.state) && m.movementBlend < 0.001)) break;
  }
  if (tick === seconds * 60) console.error(JSON.stringify({ label, stats:w.stats, pending:w.units.filter(m => m.moving).slice(0, 8) }));
  assert.ok(tick < seconds * 60, `${label}: exact complete arrival`); validate(w, fixed);
  assert.ok(peak < w.units.length * 256, 'spatial-local work remains bounded');
  times.sort((a,b) => a-b);
  console.log(JSON.stringify({ scenario:label, units:w.units.length, seconds:(tick+1)/60, tickP50Ms:times[Math.floor(times.length*.5)], tickP95Ms:times[Math.floor(times.length*.95)], peakNeighbours:peak, fields:w.stats.fieldBuilds }));
}
const blocked = createFixtureWorld(); const tankId = core.createGroup(blocked, 0, {x:16,z:-6}, 'tank');
assert.equal(core.spawnAgents(blocked, 2, tankId).length, 2);
const snapshot = JSON.stringify(blocked); assert.equal(core.moveTo(blocked, {x:20.5,z:0}, tankId), false);
assert.equal(JSON.stringify(blocked), snapshot, 'a rejected large-body command is atomic');
assert.equal(core.createGroup(blocked, 0, {x:16,z:-6}, 'unknown'), -1);
for (const [moving, parkedKind] of [['marine', 'tank'], ['tank', 'marine'], ['tank', 'tank']]) {
  const w = createFixtureWorld(); w.units = [];
  w.groups[0].spawn = {x:-12,z:8};
  const id = moving === 'tank' ? core.createGroup(w, 0, {x:-12,z:8}, 'tank') : 0;
  const parkedId = core.createGroup(w, 0, {x:-8,z:8}, parkedKind);
  const mover = moving === 'tank' ? createTank(-12,8,id) : core.createAgent(-12,8,id);
  const parked = parkedKind === 'tank' ? createTank(-8,8,parkedId) : core.createAgent(-8,8,parkedId);
  w.units = [mover, parked]; core.hold(w, parkedId); assert.ok(core.moveTo(w, {x:-4,z:8}, id));
  // Directly exercise the fine field with each combination of mover/obstacle radii.
  let route;
  for (let work = 0; work < 8; work++) { route = recovery.plan(w, mover); if (route.status !== 'pending') break; }
  assert.equal(route.status, 'ready'); mover.route = route.route;
  settle(w, 40, `${moving}-around-held-${parkedKind}`);
}
for (const kind of ['mixed', 'mixed-standing']) {
  const w = createFixtureWorld(); assert.ok(scenarios.load(w, kind, 32));
  assert.equal(w.units.filter(m => m.profile === 'tank').length, 4);
  settle(w, 150, kind);
  if (kind === 'mixed') {
    const old = w.units.map(m => [m,m.x,m.z,m.target]), field = w.groups[1].field;
    assert.equal(core.spawnAgents(w, 2, 1).length, 2); settle(w, 120, 'late-tanks');
    for (const [m,x,z,target] of old) { assert.equal(m.x,x); assert.equal(m.z,z); assert.equal(m.target,target); }
    assert.equal(w.groups[1].field, field); assert.equal(w.stats.fieldBuilds, 2);
    assert.ok(core.moveTo(w, {x:30,z:25}, 0)); assert.ok(core.moveTo(w, {x:30,z:25}, 1));
    settle(w, 180, 'shared-mixed-destination');
  }
}
const contact = createFixtureWorld(); contact.units = [core.createAgent(-8,8)];
core.createGroup(contact, 1, {x:8,z:8}, 'tank'); contact.units.push(createTank(8,8,1));
assert.ok(core.moveTo(contact,{x:8,z:8},0)); assert.ok(core.moveTo(contact,{x:-8,z:8},1));
for (let tick=0; tick<600 && !contact.units.every(m=>m.state==='contact'); tick++) core.update(contact,1/60);
assert.ok(contact.units.every(m=>m.state==='contact'));
const [a,b] = contact.units; assert.ok(Math.hypot(a.x-b.x,a.z-b.z) >= a.radius+b.radius+0.4);
const positions = contact.units.map(m=>[m.x,m.z]), attempts = contact.stats.recoveryAttempts;
for (let tick=0; tick<180; tick++) core.update(contact,1/60);
assert.deepEqual(contact.units.map(m=>[m.x,m.z]), positions); assert.equal(contact.stats.recoveryAttempts,attempts);
assert.ok(core.moveTo(contact,{x:12,z:8},1)); settle(contact,60,'tank-retreat-and-marine-resume');
const paused = JSON.stringify(contact); core.update(contact,0); assert.equal(JSON.stringify(contact),paused);
const hostile = createFixtureWorld(); assert.ok(scenarios.load(hostile, 'mixed-contact', 32));
for (let tick=0; tick<1200; tick++) { core.update(hostile,1/60); if (tick%30===0) validate(hostile); }
assert.ok(hostile.units.some(m=>m.state==='contact')); assert.equal(hostile.stats.fieldBuilds,2);
assert.ok(core.setTeam(hostile,1,0)); settle(hostile,120,'mixed-contact-disabled-resume');
assert.equal(hostile.stats.fieldBuilds,2);
if (process.argv.includes('--scale')) {
  const scale = createFixtureWorld(); assert.ok(scenarios.load(scale, 'mixed', 500));
  assert.equal(scale.units.length, 563);
  for (let i = 0; i < scale.units.length; i++) for (let j = i + 1; j < scale.units.length; j++) {
    const a = scale.units[i], b = scale.units[j];
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= a.radius + b.radius + 0.03 - 1e-8, 'mixed batch spawn leaves the full physical margin');
  }
  settle(scale, 240, '500-marines-63-tanks-counterflow');
}
console.log('Tank: conservative size class, unchanged Marine clearance, complete mixed arrivals, late spawns, shared goals, bounded local work, both fine-recovery radii, stationary bodies, contact/retreat and rigid instanced terrain-safe model checked. No vehicle-dynamics/FPS claim.');
