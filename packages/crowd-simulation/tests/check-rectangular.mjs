import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  createNavigationWorld,
  createCrowd,
  createCrowdFrameBuffer,
  AgentState,
} from '../dist/index.js';
import { syntheticTerrain, profiles } from './synthetic-terrain.mjs';

function run({
  width,
  depth,
  origin,
  rowOrder,
  diagonal,
  count = 12,
  large = 2,
  maxSeconds = 110,
}) {
  const start = performance.now();
  const { surface } = syntheticTerrain({ width, depth, origin, rowOrder, diagonal });
  const center = { x: origin.x + width / 2, z: origin.z + depth / 2 };
  const navigation = createNavigationWorld({
    surface,
    profiles,
    obstacles: [{ ...center, width: 4, depth: 16 }],
  });
  const crowd = createCrowd({ navigation, contactMode: 'none' });
  const a = crowd.createGroup({
    profile: 'small',
    team: 0,
    spawnOrigin: { x: origin.x + 12, z: center.z - 6 },
  });
  const b = large
    ? crowd.createGroup({
        profile: 'large',
        team: 0,
        spawnOrigin: { x: origin.x + width - 12, z: center.z + 6 },
      })
    : null;
  assert.equal(crowd.spawn(a, count).agents.length, count);
  if (b !== null) assert.equal(crowd.spawn(b, large).agents.length, large);
  assert.ok(
    crowd.command({
      kind: 'move',
      group: a,
      destination: { x: origin.x + width - 12, z: center.z - 6 },
    }).ok,
  );
  if (b !== null)
    assert.ok(
      crowd.command({ kind: 'move', group: b, destination: { x: origin.x + 12, z: center.z + 6 } })
        .ok,
    );
  const setupMs = performance.now() - start,
    frame = createCrowdFrameBuffer(),
    parked = new Map();
  let finished = false,
    peakNeighbours = 0;
  const inspect = () => {
    crowd.writeFrame(frame, 1);
    assert.equal(frame.count, count + large);
    finished = true;
    const agents = Array.from(frame.ids.subarray(0, frame.count), (id) => crowd.getAgent(id));
    for (let i = 0; i < frame.count; i++) {
      const x = frame.positions[i * 3],
        y = frame.positions[i * 3 + 1],
        z = frame.positions[i * 3 + 2];
      const agent = agents[i];
      assert.ok(
        surface.contains(x - agent.radius, z - agent.radius) &&
          surface.contains(x + agent.radius, z + agent.radius),
      );
      assert.equal(y, surface.heightAt(x, z));
      assert.ok(
        Math.abs(x - center.x) >= 2 + agent.radius - 1e-8 ||
          Math.abs(z - center.z) >= 8 + agent.radius - 1e-8,
        'actual obstacle footprint clearance',
      );
      if (parked.has(agent.id))
        assert.deepEqual([x, z], parked.get(agent.id), 'parked bodies stay fixed');
      if (agent.state === AgentState.Arrived) parked.set(agent.id, [x, z]);
      else finished = false;
    }
    const sorted = agents.slice().sort((a, b) => a.x - b.x);
    const maxRadius = Math.max(...agents.map((m) => m.radius));
    for (let i = 0; i < sorted.length; i++) {
      const agent = sorted[i];
      for (let j = i + 1; j < sorted.length; j++) {
        const other = sorted[j];
        if (other.x - agent.x >= agent.radius + maxRadius) break;
        if (Math.abs(other.z - agent.z) >= agent.radius + other.radius) continue;
        assert.ok(
          Math.hypot(agent.x - other.x, agent.z - other.z) >= agent.radius + other.radius - 0.02,
          'summed body radii retained',
        );
      }
    }
    if (crowd.tick === 61) {
      const current = frame.positions.slice(),
        tick = crowd.tick,
        revision = crowd.revision;
      crowd.writeFrame(frame, 0);
      const previous = frame.positions.slice();
      crowd.writeFrame(frame, 0.5);
      for (let i = 0; i < frame.count; i++) {
        for (const component of [0, 2]) {
          const j = i * 3 + component;
          assert.equal(frame.positions[j], previous[j] + (current[j] - previous[j]) * 0.5);
        }
        assert.equal(
          frame.positions[i * 3 + 1],
          surface.heightAt(frame.positions[i * 3], frame.positions[i * 3 + 2]),
        );
      }
      assert.equal(crowd.tick, tick);
      assert.equal(crowd.revision, revision);
      crowd.writeFrame(frame, 1);
    }
  };
  inspect();
  for (let tick = 0; tick < maxSeconds * 60 && !finished; tick++) {
    crowd.step();
    peakNeighbours = Math.max(peakNeighbours, crowd.getStats().neighbourChecks);
    if (tick % 30 === 0) inspect();
  }
  if (!finished)
    console.error(
      JSON.stringify({
        stats: crowd.getStats(),
        unresolved: Array.from(frame.ids.subarray(0, frame.count))
          .map((id, i) => ({
            ...crowd.getAgent(id),
            velocity: Array.from(frame.velocity.subarray(i * 2, i * 2 + 2)),
          }))
          .filter((m) => m.state !== AgentState.Arrived),
      }),
    );
  assert.ok(
    finished,
    `complete rectangular ${width}x${depth} ${rowOrder}/${diagonal}: ${parked.size}/${crowd.size}`,
  );
  for (let tick = 0; tick < 60; tick++) crowd.step();
  inspect();
  assert.equal(parked.size, count + large);
  assert.equal(crowd.getStats().fieldBuilds, large ? 2 : 1);
  assert.ok(peakNeighbours < (count + large) * 256, 'bounded local neighbour work');
  assert.equal(crowd.getStats().reservations, count + large);
  const before = JSON.stringify(crowd.getStats()),
    current = frame.positions.slice(0, frame.count * 3);
  for (const alpha of [0, 0.5, 1]) {
    crowd.writeFrame(frame, alpha);
    for (let i = 0; i < frame.count; i++)
      assert.equal(
        frame.positions[i * 3 + 1],
        surface.heightAt(frame.positions[i * 3], frame.positions[i * 3 + 2]),
      );
  }
  assert.equal(JSON.stringify(crowd.getStats()), before, 'render queries do not step physics');
  const order = crowd.getGroups()[0].orderId;
  const invalid = crowd.command({
    kind: 'move',
    group: a,
    destination: { x: surface.bounds.maxX + 1, z: center.z },
  });
  assert.equal(invalid.ok, false);
  assert.equal(crowd.getGroups()[0].orderId, order);
  assert.throws(
    () =>
      crowd.createGroup({
        profile: 'large',
        team: 0,
        spawnOrigin: { x: center.x, z: surface.bounds.maxZ + 1 },
      }),
    RangeError,
  );
  console.log(
    JSON.stringify({
      scenario: 'synthetic-rectangular-2m',
      width,
      depth,
      rowOrder,
      diagonal,
      count: crowd.size,
      arrived: parked.size,
      tick: crowd.tick,
      setupMs,
      elapsedMs: performance.now() - start,
      peakNeighbours,
    }),
  );
  crowd.dispose();
  return current;
}

function contactAndRetreat() {
  const { surface } = syntheticTerrain({
    width: 48,
    depth: 24,
    origin: { x: 103, z: -17 },
    rowOrder: 'decreasing-z',
    diagonal: 'a-d',
  });
  const crowd = createCrowd({
    navigation: createNavigationWorld({ surface, profiles, obstacles: [] }),
  });
  const a = crowd.createGroup({ profile: 'small', team: 0, spawnOrigin: { x: 115, z: -5 } });
  const b = crowd.createGroup({ profile: 'large', team: 1, spawnOrigin: { x: 139, z: -5 } });
  const first = crowd.spawn(a, 1).agents[0],
    second = crowd.spawn(b, 1).agents[0];
  assert.ok(first && second);
  assert.ok(crowd.command({ kind: 'hold', group: b }).ok);
  const parked = crowd.getAgent(second),
    start = crowd.getAgent(first);
  assert.ok(crowd.command({ kind: 'move', group: a, destination: { x: 143, z: -5 } }).ok);
  for (let tick = 0; tick < 900 && crowd.getAgent(first).state !== AgentState.Contact; tick++)
    crowd.step();
  assert.equal(crowd.getAgent(first).contact, second);
  assert.equal(crowd.getAgent(second).contact, first);
  assert.ok(crowd.command({ kind: 'move', group: a, destination: start }).ok);
  for (let tick = 0; tick < 900 && crowd.getAgent(first).state !== AgentState.Arrived; tick++)
    crowd.step();
  assert.equal(crowd.getAgent(first).state, AgentState.Arrived);
  assert.equal(crowd.getAgent(first).contact, null);
  assert.deepEqual([crowd.getAgent(second).x, crowd.getAgent(second).z], [parked.x, parked.z]);
  assert.equal(crowd.getAgent(second).contact, null);
  crowd.dispose();
  console.log(
    'Rectangular contact: mixed radii, stationary hostile body, contact IDs, retreat and stable held body.',
  );
}

if (process.argv.includes('--scale')) {
  run({
    width: 128,
    depth: 192,
    origin: { x: -73, z: 19 },
    rowOrder: 'increasing-z',
    diagonal: 'b-c',
    count: 2000,
    large: 0,
    maxSeconds: 180,
  });
  run({
    width: 320,
    depth: 480,
    origin: { x: 37, z: -511 },
    rowOrder: 'decreasing-z',
    diagonal: 'a-d',
    count: 500,
    large: 63,
    maxSeconds: 300,
  });
} else {
  for (const shape of [
    { width: 64, depth: 96, origin: { x: 113, z: 27 } },
    { width: 96, depth: 64, origin: { x: -220, z: -130 } },
  ]) {
    let expected;
    for (const rowOrder of ['increasing-z', 'decreasing-z'])
      for (const diagonal of ['b-c', 'a-d']) {
        const result = run({ ...shape, rowOrder, diagonal });
        if (!expected) expected = result;
        // Equal planar inputs have the same physical X/Z geometry, independently of storage.
        for (let i = 0; i < result.length; i++)
          if (i % 3 !== 1) assert.equal(result[i], expected[i]);
      }
  }
  contactAndRetreat();
}
