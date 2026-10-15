import assert from 'node:assert/strict';
import * as api from '@aom/crowd-simulation';
const {
  createHeightfield,
  createNavigationWorld,
  canStand,
  createCrowd,
  createCrowdFrameBuffer,
  createFixedStepClock,
  AgentState,
} = api;
const profile = { radius: 0.4, maxSlope: 0.6, maxSpeed: 2 };
function navigation(height = 0, obstacles = [], profiles = { infantry: profile }) {
  return createNavigationWorld({
    surface: createHeightfield({
      halfSize: 16,
      cellSize: 0.5,
      heights: new Float64Array(65 ** 2).fill(height),
    }),
    obstacles,
    profiles,
  });
}
const config = { ...profile },
  heights = new Float64Array(65 ** 2),
  boxes = [{ x: 4, z: 0, width: 2, depth: 4 }];
const surface = createHeightfield({ halfSize: 16, cellSize: 0.5, heights });
const nav = createNavigationWorld({
  surface,
  obstacles: boxes,
  profiles: { infantry: config, heavy: { ...profile, radius: 1.4, traffic: 'independent-detour' } },
});
heights.fill(50);
config.radius = 15;
boxes[0].width = 100;
assert.equal(surface.heightAt(0, 0), 0, 'surface owns a defensive input copy');
assert.ok(Object.isFrozen(surface));
assert.ok(Object.isFrozen(nav));
const crowd = createCrowd({ navigation: nav });
assert.equal(crowd.size, 0);
assert.deepEqual(crowd.getGroups(), []);
crowd.step();
for (const invalid of [
  { team: 0, spawnOrigin: { x: 0, z: 0 } },
  { profile: 'infantry', spawnOrigin: { x: 0, z: 0 } },
  { profile: 'infantry', team: 0 },
])
  assert.throws(() => crowd.createGroup(invalid), RangeError);
assert.deepEqual(crowd.getGroups(), [], 'invalid group requests do not install fallback defaults');
const a = crowd.createGroup({ profile: 'infantry', team: 0, spawnOrigin: { x: -8, z: -6 } });
const b = crowd.createGroup({ profile: 'heavy', team: 0, spawnOrigin: { x: 8, z: -6 } });
const spawned = crowd.spawn(a, 8),
  tanks = crowd.spawn(b, 2);
assert.ok(spawned.complete && tanks.complete);
assert.equal(new Set([...spawned.agents, ...tanks.agents]).size, 10);
assert.ok(
  crowd.command({ kind: 'move', group: a, destination: { x: 2, z: 0 } }).ok,
  'copied profile/obstacle retains infantry clearance',
);
assert.equal(canStand(nav, 'infantry', 2, 0), true);
assert.equal(canStand(nav, 'heavy', 2, 0), false);
assert.equal(canStand(nav, 'infantry', Infinity, 0), false);
assert.equal(canStand(nav, 'infantry', 16, 0), false);
assert.throws(() => canStand({}, 'infantry', 0, 0), TypeError);
assert.throws(() => canStand(nav, 'unknown', 0, 0), RangeError);
const before = JSON.stringify([
  crowd.getGroups(),
  crowd.getStats(),
  [...spawned.agents, ...tanks.agents].map((id) => crowd.getAgent(id)),
]);
assert.equal(
  crowd.command({ kind: 'move', group: b, destination: { x: 2, z: 0 } }).ok,
  false,
  'larger body really cannot enter narrow clearance',
);
assert.equal(
  JSON.stringify([
    crowd.getGroups(),
    crowd.getStats(),
    [...spawned.agents, ...tanks.agents].map((id) => crowd.getAgent(id)),
  ]),
  before,
  'rejected command is atomic',
);
assert.ok(crowd.command({ kind: 'move', group: a, destination: { x: 2, z: 0 } }).ok);
assert.equal(crowd.getStats().fieldBuilds, 1);
const frame = createCrowdFrameBuffer(1);
crowd.writeFrame(frame, 0.5);
const oldBuffer = frame.positions;
crowd.writeFrame(frame, 0.5);
assert.equal(frame.positions, oldBuffer);
assert.equal(frame.count, crowd.size);
assert.ok(frame.ids.includes(spawned.agents[0]));
frame.positions = new Float64Array(0);
crowd.writeFrame(frame, 0.5);
assert.ok(frame.positions.length >= frame.count * 3, 'all output capacities are checked');
const snapshot = JSON.stringify(crowd.getAgent(spawned.agents[0]));
frame.positions.fill(10000);
frame.ids.fill(0);
frame.states.fill(99);
assert.equal(
  JSON.stringify(crowd.getAgent(spawned.agents[0])),
  snapshot,
  'render buffers are not live solver state',
);
assert.throws(() => {
  crowd.getAgent(spawned.agents[0]).x = 100;
}, TypeError);
assert.throws(() => {
  crowd.getGroups()[0].destination.x = 100;
}, TypeError);
assert.throws(() => crowd.writeFrame(frame, NaN), RangeError);
assert.throws(() => crowd.writeFrame(frame, 1.01), RangeError);
for (const count of [-1, 0.5, NaN, Infinity])
  assert.throws(() => crowd.spawn(a, count), RangeError);
assert.equal(crowd.spawn(a, 0).complete, true);
assert.equal(
  crowd.command({ kind: 'move', group: 100, destination: { x: 0, z: 0 } }).reason,
  'unknown-group',
);
assert.equal(crowd.command({ kind: 'teleport', group: a }).reason, 'invalid-order');
assert.equal(
  crowd.command({ kind: 'move', group: a, destination: { x: NaN, z: 0 } }).reason,
  'invalid-destination',
);
assert.throws(
  () => crowd.createGroup({ profile: 'toString', team: 0, spawnOrigin: { x: 0, z: 0 } }),
  RangeError,
);
assert.equal(crowd.setTeam(a, -1), false);
const reservationCount = crowd.getStats().reservations,
  survivors = spawned.agents.slice(2),
  poses = survivors.map((id) => crowd.getAgent(id));
assert.equal(
  crowd.removeAgents([spawned.agents[0], spawned.agents[0], spawned.agents[1], 99999]),
  2,
);
assert.equal(crowd.getStats().reservations, reservationCount - 2);
assert.equal(crowd.getAgent(spawned.agents[0]), null);
assert.deepEqual(
  survivors.map((id) => crowd.getAgent(id)),
  poses,
  'removal preserves survivor positions/orders/IDs',
);
const late = crowd.spawn(a, 2);
assert.ok(late.complete);
assert.ok(late.agents.every((id) => id > Math.max(...spawned.agents, ...tanks.agents)));
assert.equal(crowd.getStats().fieldBuilds, 1);
assert.equal(crowd.getStats().reservations, reservationCount);
assert.ok(crowd.command({ kind: 'hold', group: a }).ok);
assert.equal(crowd.getStats().reservations, 0);
assert.equal(crowd.getAgent(crowd.spawn(a, 1).agents[0]).state, AgentState.Holding);

// Shared static navigation must not share live orders or reservations.
const mirror = createCrowd({ navigation: nav }),
  mirrorGroup = mirror.createGroup({ profile: 'infantry', team: 0, spawnOrigin: { x: 0, z: 8 } });
const untouched = JSON.stringify([
  crowd.getGroups(),
  crowd.getStats(),
  survivors.map((id) => crowd.getAgent(id)),
]);
assert.ok(mirror.spawn(mirrorGroup, 16).complete);
assert.ok(mirror.command({ kind: 'move', group: mirrorGroup, destination: { x: -8, z: 8 } }).ok);
for (let i = 0; i < 120; i++) mirror.step();
assert.equal(
  JSON.stringify([crowd.getGroups(), crowd.getStats(), survivors.map((id) => crowd.getAgent(id))]),
  untouched,
);
mirror.dispose();

// Separate maps, no DOM globals, no cross-world field/cache/height invalidation.
const high = createCrowd({ navigation: navigation(7) });
const hg = high.createGroup({ profile: 'infantry', team: 0, spawnOrigin: { x: 0, z: 0 } });
const hid = high.spawn(hg, 1).agents[0];
assert.equal(high.getAgent(hid).y, 7);
assert.equal(crowd.getAgent(survivors[0]).y, 0);
assert.ok(high.command({ kind: 'move', group: hg, destination: { x: -8, z: 8 } }).ok);
for (let i = 0; i < 120; i++) {
  high.step();
  crowd.step();
}
assert.equal(high.getAgent(hid).y, 7);
assert.equal(crowd.getAgent(survivors[0]).y, 0);
assert.equal(high.getStats().fieldBuilds, 1);
const count = high.tick,
  clock = createFixedStepClock();
assert.equal(clock.advance(0, high.step), 0);
assert.equal(clock.advance(NaN, high.step), 0);
assert.equal(clock.advance(1 / 120, high.step), 0);
assert.equal(clock.alpha, 0.5);
assert.equal(clock.advance(1 / 120, high.step), 1);
assert.equal(clock.advance(10, high.step), 15);
assert.equal(high.tick, count + 16);
const endpointA = createCrowdFrameBuffer(),
  endpointB = createCrowdFrameBuffer(),
  middle = createCrowdFrameBuffer();
high.writeFrame(endpointA, 0);
high.writeFrame(endpointB, 1);
high.writeFrame(middle, 0.5);
assert.equal(middle.positions[0], (endpointA.positions[0] + endpointB.positions[0]) / 2);
assert.equal(middle.positions[1], 7);

// Contact uses stable public IDs; removing an earlier array entry cannot retarget a surviving contact.
const contact = createCrowd({ navigation: navigation() });
const cg = contact.createGroup({ profile: 'infantry', team: 0, spawnOrigin: { x: -8, z: 0 } });
const eg = contact.createGroup({ profile: 'infantry', team: 1, spawnOrigin: { x: 8, z: 0 } });
const own = contact.spawn(cg, 4).agents,
  enemies = contact.spawn(eg, 4).agents;
assert.ok(contact.command({ kind: 'move', group: cg, destination: { x: 8, z: 0 } }).ok);
assert.ok(contact.command({ kind: 'move', group: eg, destination: { x: -8, z: 0 } }).ok);
const beforeContact = contact.getGroups();
for (let i = 0; i < 900 && contact.getStats().inContact < 4; i++) contact.step();
assert.ok(contact.getStats().inContact >= 4);
assert.equal(
  contact.getGroups(),
  beforeContact,
  'unchanged group metadata can reuse the immutable snapshot',
);
assert.ok(
  contact.getStats().reservations < 8,
  'tick-time contact releases are visible without a new command',
);
const retained = [...own, ...enemies].slice(1).map((id) => contact.getAgent(id));
contact.removeAgents([own[0]]);
for (const m of retained) {
  const after = contact.getAgent(m.id);
  assert.equal(after.contact, m.contact === own[0] ? null : m.contact);
  if (after.contact !== null) assert.ok(contact.getAgent(after.contact));
}
contact.removeAgents(enemies);
for (let i = 0; i < 90; i++) contact.step();
assert.equal(contact.getStats().inContact, 0);
assert.ok(own.slice(1).every((id) => contact.getAgent(id).contact === null));
assert.equal(contact.getStats().fieldBuilds, 2);

// Optional contact really disables enemy stops, not physical body clearance.
const peaceful = createCrowd({ navigation: navigation(), contactMode: 'none' });
const pg = peaceful.createGroup({ profile: 'infantry', team: 0, spawnOrigin: { x: -8, z: 0 } });
const qg = peaceful.createGroup({ profile: 'infantry', team: 1, spawnOrigin: { x: 8, z: 0 } });
const pa = peaceful.spawn(pg, 1).agents[0],
  pb = peaceful.spawn(qg, 1).agents[0];
assert.ok(peaceful.command({ kind: 'move', group: pg, destination: { x: 8, z: 0 } }).ok);
assert.ok(peaceful.command({ kind: 'move', group: qg, destination: { x: -8, z: 0 } }).ok);
for (let i = 0; i < 1800; i++) {
  peaceful.step();
  const a = peaceful.getAgent(pa),
    b = peaceful.getAgent(pb);
  assert.equal(a.contact, null);
  assert.equal(b.contact, null);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 0.78 - 1e-8);
  if (a.state === AgentState.Arrived && b.state === AgentState.Arrived) break;
}
assert.equal(peaceful.getAgent(pa).state, AgentState.Arrived);
assert.equal(peaceful.getAgent(pb).state, AgentState.Arrived);
peaceful.dispose();

// A within-tolerance command is not an exact arrival before the next safe snap tick.
const near = createCrowd({ navigation: navigation() });
const ng = near.createGroup({ profile: 'infantry', team: 0, spawnOrigin: { x: 0, z: 0 } }),
  nid = near.spawn(ng, 1).agents[0];
assert.ok(near.command({ kind: 'move', group: ng, destination: { x: 0.02, z: 0 } }).ok);
assert.equal(near.getAgent(nid).state, AgentState.Moving);
assert.equal(near.getStats().moving, 1);
near.step();
assert.equal(near.getAgent(nid).x, 0.02);
assert.equal(near.getAgent(nid).state, AgentState.Arrived);
near.dispose();

// Profiles configure actual movement, independently of model names.
const speeds = createNavigationWorld({
  surface,
  obstacles: [],
  profiles: { slow: { ...profile, maxSpeed: 1 }, fast: { ...profile, maxSpeed: 4 } },
});
const distances = [];
for (const profile of ['slow', 'fast']) {
  const c = createCrowd({ navigation: speeds }),
    g = c.createGroup({ profile, team: 0, spawnOrigin: { x: 0, z: 0 } });
  const id = c.spawn(g, 1).agents[0],
    start = c.getAgent(id);
  assert.ok(c.command({ kind: 'move', group: g, destination: { x: 8, z: 8 } }).ok);
  for (let i = 0; i < 60; i++) c.step();
  const end = c.getAgent(id);
  distances.push(Math.hypot(end.x - start.x, end.z - start.z));
  c.dispose();
}
assert.ok(distances[0] > 0.5 && distances[1] > distances[0] * 3.5);

// Full-capacity partial batches and removing the entire population.
const blocked = createCrowd({ navigation: navigation() });
const bg = blocked.createGroup({ profile: 'infantry', team: 0, spawnOrigin: { x: 0, z: 0 } });
const full = blocked.spawn(bg, 10000);
assert.equal(full.complete, false);
assert.ok(full.agents.length > 50 && full.agents.length < 10000);
const fullBefore = JSON.stringify(blocked.getStats());
assert.equal(blocked.spawn(bg, 1).agents.length, 0);
assert.equal(JSON.stringify(blocked.getStats()), fullBefore);
blocked.removeAgents(full.agents);
assert.equal(blocked.size, 0);
blocked.step();
assert.equal(blocked.getStats().reservations, 0);
for (const c of [crowd, high, contact, blocked]) {
  c.dispose();
  c.dispose();
  assert.throws(() => c.step(), /disposed/);
  assert.throws(() => c.getStats(), /disposed/);
}
assert.throws(() => createHeightfield({ halfSize: 4, cellSize: 0.5, heights: [0] }), RangeError);
assert.throws(
  () => createNavigationWorld({ surface: {}, obstacles: [], profiles: { infantry: profile } }),
  TypeError,
);
assert.throws(() => createNavigationWorld({ surface, obstacles: [], profiles: {} }), RangeError);
assert.throws(
  () =>
    createNavigationWorld({
      surface,
      obstacles: [],
      profiles: { bad: { ...profile, radius: -1 } },
    }),
  RangeError,
);
assert.throws(() => createCrowd({ navigation: nav, contactMode: 'combat' }), RangeError);
assert.throws(
  () =>
    createNavigationWorld({ surface, cellSize: 1, obstacles: [], profiles: { infantry: profile } }),
  RangeError,
);
assert.throws(() => surface.heightAt(NaN, 0), RangeError);
console.log(
  'Public API: headless worlds, defensive inputs/outputs, typed profiles, command atomicity, bounded batches, stable IDs/removal/contact, field reuse, held spawns, fixed clock/interpolation and disposal.',
);
