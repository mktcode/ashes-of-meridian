import assert from 'node:assert/strict';
import {
  createHeightfield,
  createNavigationWorld,
  createCrowd,
  createCrowdFrameBuffer,
  AgentState,
} from '../dist/index.js';
import { createNavigation } from '../src/navigation/navigation.js';

const profiles = {
  small: { radius: 0.4, maxSlope: 0.6, maxSpeed: 2 },
  large: { radius: 1.4, maxSlope: 0.6, maxSpeed: 2, traffic: 'independent-detour' },
};
const surface = createHeightfield({
  width: 96,
  depth: 80,
  origin: { x: -35, z: -51 },
  cellSize: 0.5,
  heights: new Float64Array(193 * 161).fill(2),
  rowOrder: 'decreasing-z',
  diagonal: 'a-d',
});
const navigation = createNavigationWorld({ surface, profiles, obstacles: [] });
const nav = createNavigation(surface, [], profiles),
  largeNav = nav.forProfile('large');
const center = { x: 13, z: -11 };
const distanceToSegment = (p, a, b) => {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
};

for (const [angle, lateTank] of [
  [0, false],
  [0.65, false],
  [1.4, false],
  [0.35, true],
]) {
  const count = lateTank ? 48 : 96;
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const point = (x, z) => ({ x: center.x + c * x - s * z, z: center.z + s * x + c * z });
  const slots = nav.places(center, 400, nav.buildField(center), { x: c, z: s }, largeNav);
  assert.equal(slots.length, 400);
  assert.deepEqual(
    slots,
    nav.places(center, 401, nav.buildField(center), { x: c, z: s }, largeNav).slice(0, 400),
    'stable prefix across compact islands',
  );
  // Independent swept-disc oracle: both crossing aisle directions stay genuinely tank-wide.
  const spacing = 1.75,
    lane = 3.75,
    row = (spacing * Math.sqrt(3)) / 2;
  for (let k = -1; k <= 1; k++)
    for (const axis of ['x', 'z']) {
      const value = axis === 'x' ? 3.625 + k * 8.125 : row + lane / 2 + k * (2 * row + lane);
      const a = axis === 'x' ? point(value, -24) : point(-24, value);
      const b = axis === 'x' ? point(value, 24) : point(24, value);
      assert.ok(largeNav.canTravel(a.x, a.z, b.x, b.z), 'aisle also has static terrain clearance');
      for (const p of slots)
        assert.ok(
          distanceToSegment(p, a, b) >= 1.8 + 0.05 - 1e-8,
          'full tank radius plus parked body and margin fit the aisle',
        );
    }
  const crowd = createCrowd({ navigation, contactMode: 'none' });
  const heavy = crowd.createGroup({ profile: 'large', team: 0, spawnOrigin: point(-28, 0) });
  let heavyIds = lateTank ? [] : crowd.spawn(heavy, 1).agents;
  assert.equal(heavyIds.length, lateTank ? 0 : 1);
  assert.ok(crowd.command({ kind: 'hold', group: heavy }).ok);
  const group = crowd.createGroup({ profile: 'small', team: 0, spawnOrigin: point(-20, 0) });
  const ids = crowd.spawn(group, count).agents;
  assert.equal(ids.length, count);
  const held = lateTank ? null : crowd.getAgent(heavyIds[0]);
  const frame = createCrowdFrameBuffer(),
    fixed = new Map();
  let peak = 0;
  const inspect = () => {
    crowd.writeFrame(frame, 1);
    assert.equal(frame.count, crowd.size);
    const bodies = Array.from(frame.ids.subarray(0, frame.count), (id) => crowd.getAgent(id)).sort(
      (a, b) => a.x - b.x,
    );
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      assert.equal(a.y, surface.heightAt(a.x, a.z));
      if (fixed.has(a.id))
        assert.deepEqual(
          [a.x, a.z],
          fixed.get(a.id),
          'arrived small bodies never move aside for the tank',
        );
      if (a.profile === 'small' && a.state === AgentState.Arrived) fixed.set(a.id, [a.x, a.z]);
      for (let j = i + 1; j < bodies.length && bodies[j].x - a.x < a.radius + 1.4; j++) {
        const b = bodies[j];
        assert.ok(
          Math.hypot(a.x - b.x, a.z - b.z) >= a.radius + b.radius - 0.02 - 1e-8,
          'unchanged summed physical radii and solver tolerance',
        );
      }
    }
  };
  const settle = (members, seconds, label) => {
    let finished = false;
    for (let tick = 0; tick < seconds * 60; tick++) {
      crowd.step();
      peak = Math.max(peak, crowd.getStats().neighbourChecks);
      if (tick % 15) continue;
      inspect();
      if (members.every((id) => crowd.getAgent(id).state === AgentState.Arrived)) {
        finished = true;
        break;
      }
    }
    assert.ok(finished, `${angle}: ${label}: complete real arrival`);
    for (let tick = 0; tick < 60; tick++) crowd.step();
    inspect();
    assert.ok(members.every((id) => crowd.getAgent(id).state === AgentState.Arrived));
  };
  assert.ok(crowd.command({ kind: 'move', group, destination: center }).ok);
  settle(ids, 90, 'compact formation');
  if (held)
    assert.deepEqual([crowd.getAgent(held.id).x, crowd.getAgent(held.id).z], [held.x, held.z]);
  assert.equal(fixed.size, ids.length);
  const parked = ids.map((id) => crowd.getAgent(id));
  const nearest = parked
    .map((a) =>
      Math.min(...parked.filter((b) => b !== a).map((b) => Math.hypot(a.x - b.x, a.z - b.z))),
    )
    .sort((a, b) => a - b);
  assert.ok(
    Math.abs(nearest[Math.floor(nearest.length / 2)] - 1.75) < 1e-8,
    'most neighbours retain the compact small-body spacing',
  );
  const previousSpacing = lateTank ? 1.75 : 3.75;
  const oldDistances = [];
  for (let q = -16; q <= 16; q++)
    for (let r = -16; r <= 16; r++)
      oldDistances.push(
        (previousSpacing * (q + r / 2)) ** 2 + (((previousSpacing * Math.sqrt(3)) / 2) * r) ** 2,
      );
  oldDistances.sort((a, b) => a - b);
  const oldMeanSquare = oldDistances.slice(0, count).reduce((a, b) => a + b, 0) / count;
  const meanSquare =
    parked.reduce((sum, p) => sum + (p.x - center.x) ** 2 + (p.z - center.z) ** 2, 0) /
    parked.length;
  if (lateTank)
    assert.ok(
      Math.abs(meanSquare - oldMeanSquare) < 1e-8,
      'single-size footprint is unchanged before the late tank',
    );
  else
    assert.ok(
      meanSquare < oldMeanSquare * 0.65,
      'materially smaller footprint, not just one close pair',
    );
  if (lateTank) {
    heavyIds = crowd.spawn(heavy, 1).agents;
    assert.equal(heavyIds.length, 1);
  }
  assert.ok(crowd.command({ kind: 'move', group: heavy, destination: point(28, 0) }).ok);
  settle(heavyIds, 90, 'tank passing existing parked formation');
  assert.equal(fixed.size, count);
  const parkedHeavy = crowd.getAgent(heavyIds[0]);
  const added = crowd.spawn(group, 16).agents;
  assert.equal(added.length, 16);
  settle(added, 90, 'late small bodies inherit compact reservations');
  assert.equal(fixed.size, count + 16);
  assert.equal(crowd.size, count + 17);
  for (const id of [...ids, ...added, ...heavyIds])
    assert.equal(crowd.getAgent(id).state, AgentState.Arrived);
  assert.deepEqual(
    [crowd.getAgent(parkedHeavy.id).x, crowd.getAgent(parkedHeavy.id).z],
    [parkedHeavy.x, parkedHeavy.z],
    'late small spawns do not move the arrived large body',
  );
  assert.equal(crowd.getStats().reservations, count + 17);
  assert.equal(crowd.getStats().fieldBuilds, 2);
  assert.ok(peak < crowd.size * 256);
  console.log(
    JSON.stringify({
      scenario: 'compact-islands-and-tank-passage',
      angle,
      lateTank,
      initialSmall: ids.length,
      addedSmall: added.length,
      large: heavyIds.length,
      arrived: crowd.size,
      medianSpacing: nearest[Math.floor(nearest.length / 2)],
      squaredFootprintRatio: meanSquare / oldMeanSquare,
      tick: crowd.tick,
      peakNeighbours: peak,
    }),
  );
  crowd.dispose();
}
console.log(
  'Formation: compact small-body islands, independent swept tank clearance, rotated crossing aisles, stable prefixes, real arrivals and immovable parked bodies.',
);
