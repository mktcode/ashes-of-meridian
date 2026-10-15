import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
for (const file of ['crowd-terrain.js', 'crowd-navigation.js', 'crowd-recovery.js', 'crowd-core.js', 'crowd-scenarios.js']) vm.runInThisContext(readFileSync(new URL(file, import.meta.url), 'utf8'));
const { core, nav, terrain, scenarios } = vm.runInThisContext('({ core: CrowdSimulation, nav: CrowdNavigation, terrain: CrowdTerrain, scenarios: CrowdScenarios })');
const rejected = core.createWorld(), unchanged = JSON.stringify(rejected);
for (const name of ['unknown', 'toString', '__proto__', null, {}]) assert.equal(scenarios.load(rejected, name, 32), false);
for (const count of [0, -1, 501, 1.5, NaN, Infinity, '32']) assert.equal(scenarios.load(rejected, 'counterflow', count), false);
assert.equal(JSON.stringify(rejected), unchanged, 'invalid scenario controls do not replace the current crowd');
function validate(world, fixed = new Map()) {
  const buckets = new Map(), reserved = new Map();
  for (const m of world.marines) {
    assert.ok(Number.isFinite(m.x + m.y + m.z + m.yaw + m.runWeight));
    assert.ok(nav.canStand(m.x, m.z)); assert.equal(m.y, terrain.heightAt(m.x, m.z));
    const bx = Math.floor(m.x), bz = Math.floor(m.z);
    for (let z = bz - 1; z <= bz + 1; z++) for (let x = bx - 1; x <= bx + 1; x++) {
      for (const other of buckets.get(`${x}:${z}`) || []) assert.ok(Math.hypot(m.x - other.x, m.z - other.z) >= 0.78 - 1e-8, 'unchanged physical spacing');
    }
    const key = `${bx}:${bz}`; if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(m);
    if (m.target) {
      assert.ok(world.groups[m.group].reservedSlots.has(m.target));
      assert.ok(!reserved.has(m.target)); reserved.set(m.target, m);
      if (!m.moving) { assert.equal(m.x, m.target.x); assert.equal(m.z, m.target.z); }
    }
    if (m.state === 'contact') { assert.equal(m.target, null); assert.equal(m.moving, false); assert.ok(m.contact !== null); }
    const old = fixed.get(m);
    if (old) { assert.equal(m.x, old.x, 'holding/arrived bodies stay fixed'); assert.equal(m.z, old.z); assert.equal(m.target, old.target); }
    else if (!m.moving && (m.target || world.groups[m.group].order === 'hold')) fixed.set(m, { x: m.x, z: m.z, target: m.target });
  }
  for (const group of world.groups) assert.equal(group.reservedSlots.size, [...reserved.values()].filter(m => m.group === group.id).length, 'no leaked or phantom reservations');
  const places = new Map();
  for (const [p, m] of reserved) {
    const bx = Math.floor(p.x), bz = Math.floor(p.z);
    for (let z = Math.floor(p.z - nav.parkingSpacing); z <= Math.floor(p.z + nav.parkingSpacing); z++) for (let x = Math.floor(p.x - nav.parkingSpacing); x <= Math.floor(p.x + nav.parkingSpacing); x++) {
      for (const [other, unit] of places.get(`${x}:${z}`) || []) if (unit.group !== m.group)
        assert.ok(Math.hypot(p.x - other.x, p.z - other.z) >= nav.parkingSpacing - 1e-8, 'independent formations retain the same parking lanes');
    }
    const key = `${bx}:${bz}`; if (!places.has(key)) places.set(key, []); places.get(key).push([p, m]);
  }
}
function settle(world, seconds, label) {
  const fields = world.groups.map(g => g.field), fixed = new Map(), costs = [];
  let peakNeighbours = 0, peakContacts = 0, tick = 0;
  for (; tick < seconds * 60; tick++) {
    const start = performance.now(); core.update(world, 1 / 60); costs.push(performance.now() - start);
    peakNeighbours = Math.max(peakNeighbours, world.stats.neighbourChecks); peakContacts = Math.max(peakContacts, world.stats.contactChecks);
    for (const g of world.groups) assert.equal(g.field, fields[g.id], 'no per-unit primary replanning');
    if (tick % 15 === 0) validate(world, fixed);
    if (world.marines.every(m => ['idle', 'holding'].includes(m.state) && m.runWeight < 0.001)) break;
  }
  if (tick === seconds * 60) console.error(JSON.stringify({ label, stats: world.stats, pending: world.marines.filter(m => m.state === 'moving' || m.state === 'waiting').slice(0, 12).map(m => ({ x: m.x, z: m.z, group: m.group, target: m.target, stalled: m.stalledFor })) }));
  assert.ok(tick < seconds * 60, `${label}: all commanded units actually arrive`);
  validate(world, fixed); assert.ok(peakNeighbours < world.marines.length * 256); assert.ok(peakContacts < world.marines.length * 96);
  costs.sort((a, b) => a - b);
  console.log(JSON.stringify({ scenario: label, actual: world.marines.length, seconds: (tick + 1) / 60,
    tickP50Ms: costs[Math.floor(costs.length * 0.5)], tickP95Ms: costs[Math.floor(costs.length * 0.95)], tickMaxMs: costs.at(-1),
    peakNeighbours, peakContacts, fields: world.stats.fieldBuilds, recovery: world.stats.recoveryAttempts }));
}
function pair() {
  const world = core.createWorld(); world.marines = [];
  world.groups[0].spawn = { x: -8, z: 8 }; core.createGroup(world, 1, { x: 8, z: 8 });
  const a = core.spawnMarine(world, 0), b = core.spawnMarine(world, 1);
  assert.ok(core.moveTo(world, { x: 8, z: 8 }, 0)); assert.ok(core.moveTo(world, { x: -8, z: 8 }, 1));
  return { world, a, b };
}
const { world, a, b } = pair(), fields = world.groups.map(g => g.field);
for (let tick = 0; tick < 600 && !world.marines.every(m => m.state === 'contact'); tick++) core.update(world, 1 / 60);
assert.ok(world.marines.every(m => m.state === 'contact'), 'head-on enemies stop at contact, not at their destination');
validate(world); assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 1.2);
assert.equal(world.groups[0].reservedSlots.size, 0); assert.equal(world.groups[1].reservedSlots.size, 0);
const line = world.marines.map(m => ({ x: m.x, z: m.z })), attempts = world.stats.recoveryAttempts;
for (let i = 0; i < 180; i++) core.update(world, 1 / 60);
assert.deepEqual(world.marines.map(m => ({ x: m.x, z: m.z })), line, 'stable contact without shoving or recovery spam');
assert.equal(world.stats.recoveryAttempts, attempts); assert.ok(world.marines.every(m => m.runWeight < 0.001));
assert.ok(core.moveTo(world, { x: 8, z: 8 }, 0)); assert.equal(world.groups[0].field, fields[0], 'repeat command reuses field while waking contact');
core.update(world, 1 / 60); assert.equal(a.state, 'contact', 'a forward order cannot force passage through an enemy');
assert.ok(core.moveTo(world, { x: -12, z: 8 }, 0)); assert.equal(world.groups[1].field, fields[1]);
settle(world, 35, 'contact-retreat-and-resume'); assert.equal(world.stats.fieldBuilds, 3);
assert.ok(core.hold(world, 0)); assert.equal(a.target, null); assert.equal(a.state, 'holding'); assert.equal(world.groups[0].reservedSlots.size, 0);
const held = [a.x, a.z]; for (let i = 0; i < 60; i++) core.update(world, 1 / 60); assert.deepEqual([a.x, a.z], held);
const snapshot = JSON.stringify(world.marines);
assert.equal(core.moveTo(world, { x: 2.5, z: 0 }, 1), false); assert.equal(core.moveTo(world, { x: 0, z: 7 }, 42), false);
assert.equal(JSON.stringify(world.marines), snapshot); assert.deepEqual(core.spawnMarines(world, 1, 42), []);
for (const id of ['0', NaN, 1.5, -1, 99]) {
  assert.equal(core.moveTo(world, { x: 0, z: 7 }, id), false); assert.equal(core.hold(world, id), false);
  assert.equal(core.setTeam(world, id, 0), false); assert.deepEqual(core.spawnMarines(world, 1, id), []);
}
assert.equal(JSON.stringify(world.marines), snapshot);
core.update(world, 0); assert.equal(JSON.stringify(world.marines), snapshot, 'pause is pure');

const parallel = core.createWorld(); parallel.marines = [core.createMarine(-8, 8), core.createMarine(-7, 8, 1)];
core.createGroup(parallel, 1); core.moveTo(parallel, { x: -8, z: 20 }, 0); core.moveTo(parallel, { x: -7, z: 20 }, 1);
core.update(parallel, 1 / 60);
assert.ok(parallel.marines.every(m => m.state === 'contact'), 'new nearby enemies react even when initially moving sideways or in parallel');
const corner = core.createWorld(); corner.marines = [core.createMarine(0.6, 3.4), core.createMarine(1.5, 3.6, 1)];
core.createGroup(corner, 1); assert.ok(!nav.canTravel(0.6, 3.4, 1.5, 3.6));
core.update(corner, 1 / 60); assert.ok(corner.marines.every(m => m.contact === null), 'no contact through a blocked corner');

for (const kind of ['counterflow', 'crossing', 'standing']) {
  const w = core.createWorld(); assert.ok(scenarios.load(w, kind, 32)); validate(w);
  const parked = w.marines.filter(m => m.group === 1).map(m => ({ x: m.x, z: m.z }));
  settle(w, 120, `64-${kind}`);
  if (kind === 'standing') assert.deepEqual(w.marines.filter(m => m.group === 1).map(m => ({ x: m.x, z: m.z })), parked);
}
// A halt in an already interleaved crowd can seal passages. Do not displace holders or fake arrival;
// once the holding group moves away, the blocked group must resume using its existing primary field.
const sealedFlow = core.createWorld(); assert.ok(scenarios.load(sealedFlow, 'counterflow', 32));
for (let tick = 0; tick < 600; tick++) core.update(sealedFlow, 1 / 60);
assert.ok(core.hold(sealedFlow, 0));
const stationary = new Map(sealedFlow.marines.filter(m => m.group === 0).map(m => [m, { x: m.x, z: m.z, target: m.target }]));
const secondField = sealedFlow.groups[1].field;
for (let tick = 0; tick < 3600; tick++) { core.update(sealedFlow, 1 / 60); if (tick % 15 === 0) validate(sealedFlow, stationary); }
const unresolved = sealedFlow.marines.filter(m => m.group === 1 && m.moving);
assert.ok(!unresolved.length || unresolved.some(m => m.state === 'waiting' && m.target), 'unresolved blockage includes explicit waiting, not false arrival');
const alreadyParked = sealedFlow.marines.filter(m => m.group === 1 && !m.moving).map(m => ({ m, x: m.x, z: m.z, target: m.target }));
assert.ok(core.moveTo(sealedFlow, { x: -24, z: -24 }, 0));
settle(sealedFlow, 90, '64-reopen-midflow-hold'); assert.equal(sealedFlow.groups[1].field, secondField);
for (const p of alreadyParked) { assert.equal(p.m.x, p.x); assert.equal(p.m.z, p.z); assert.equal(p.m.target, p.target); }
const overlap = core.createWorld(); overlap.marines = []; core.createGroup(overlap);
core.spawnMarines(overlap, 12, 0); core.spawnMarines(overlap, 12, 1);
assert.ok(core.moveTo(overlap, { x: -8, z: 8 }, 0)); assert.ok(core.moveTo(overlap, { x: -8, z: 8 }, 1));
validate(overlap); settle(overlap, 90, '24-shared-destination');
const old = overlap.marines.map(m => ({ unit: m, x: m.x, z: m.z, target: m.target })), shared = overlap.groups.map(g => g.field);
assert.equal(core.spawnMarines(overlap, 2, 1).length, 2);
settle(overlap, 60, '26-late-spawn-shared-destination');
for (const p of old) { assert.equal(p.unit.x, p.x); assert.equal(p.unit.z, p.z); assert.equal(p.unit.target, p.target); }
for (const g of overlap.groups) assert.equal(g.field, shared[g.id]); assert.equal(overlap.stats.fieldBuilds, 2);
const scale = core.createWorld(); assert.ok(scenarios.load(scale, 'counterflow', 500));
settle(scale, 240, '1000-counterflow');
const contactScale = core.createWorld(); assert.ok(scenarios.load(contactScale, 'contact', 500));
let peakContactChecks = 0; const contactTimes = [];
for (let tick = 0; tick < 240; tick++) {
  const start = performance.now(); core.update(contactScale, 1 / 60); if (tick >= 20) contactTimes.push(performance.now() - start);
  peakContactChecks = Math.max(peakContactChecks, contactScale.stats.contactChecks);
  if (tick % 15 === 0) validate(contactScale);
}
validate(contactScale); assert.ok(contactScale.marines.some(m => m.state === 'contact'));
assert.ok(peakContactChecks < contactScale.marines.length * 96); assert.equal(contactScale.stats.fieldBuilds, 2);
contactTimes.sort((a, b) => a - b);
console.log(JSON.stringify({ scenario: '1000-contact-4-second-window-not-arrival', actual: contactScale.marines.length,
  contacts: contactScale.marines.filter(m => m.state === 'contact').length, peakContactChecks,
  tickP50Ms: contactTimes[Math.floor(contactTimes.length * 0.5)], tickP95Ms: contactTimes[Math.floor(contactTimes.length * 0.95)], fields: 2 }));
const hostile = core.createWorld(); assert.ok(scenarios.load(hostile, 'contact', 32));
for (let tick = 0; tick < 1200; tick++) { core.update(hostile, 1 / 60); if (tick % 15 === 0) validate(hostile); }
assert.ok(hostile.marines.some(m => m.state === 'contact'));
const primary = hostile.stats.fieldBuilds; assert.equal(primary, 2);
assert.ok(core.setTeam(hostile, 1, 0)); settle(hostile, 120, '64-contact-disabled-resume'); assert.equal(hostile.stats.fieldBuilds, primary);
console.log('Groups/contact: independent fields/orders, real counterflow/crossing/standing passage, shared-goal reservations, stable physical enemy contact, retreat/resume, hold, blocked corners, pause and bounded local work checked. CPU timings are not GPU/FPS guarantees.');
