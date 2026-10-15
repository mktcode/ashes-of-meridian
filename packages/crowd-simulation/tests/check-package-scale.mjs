import assert from 'node:assert/strict';
import {
  createCrowd,
  createNavigationWorld,
  createCrowdFrameBuffer,
  AgentState,
} from '../dist/index.js';
import { loadDemo } from './fixture.mjs';
const { terrain, obstacles, profiles, demoScenarios } = loadDemo();
const navigation = createNavigationWorld({ surface: terrain.surface, obstacles, profiles });
const mass = createCrowd({ navigation });
const group = mass.createGroup({ profile: 'marine', team: 0, spawnOrigin: { x: 0, z: 0 } });
assert.equal(mass.spawn(group, 2000).agents.length, 2000);
assert.ok(mass.command({ kind: 'move', group, destination: { x: 0, z: 7 } }).ok);
const mixed = demoScenarios.create(navigation, 'mixed', 500);
assert.equal(mixed.size, 563);
const standing = createCrowd({ navigation });
const large = standing.createGroup({ profile: 'tank', team: 0, spawnOrigin: { x: 8, z: -6 } });
const held = standing.spawn(large, 4).agents;
assert.equal(held.length, 4);
assert.ok(standing.command({ kind: 'hold', group: large }).ok);
const small = standing.createGroup({ profile: 'marine', team: 0, spawnOrigin: { x: -16, z: -6 } });
assert.equal(standing.spawn(small, 1000).agents.length, 1000);
assert.ok(standing.command({ kind: 'move', group: small, destination: { x: 24, z: -6 } }).ok);
for (const [label, crowd, fields, heldIds] of [
  ['public-2000-obstacle-shadow-arrival', mass, 1, []],
  ['public-500-marines-63-tanks', mixed, 2, []],
  ['public-1000-marines-four-held-tanks', standing, 1, held],
]) {
  const holding = new Set(heldIds);
  const count = crowd.size,
    frame = createCrowdFrameBuffer(),
    parked = new Map();
  let finished = false,
    peakNeighbours = 0;
  for (let tick = 0; tick < 150 * 60; tick++) {
    crowd.step();
    peakNeighbours = Math.max(peakNeighbours, crowd.getStats().neighbourChecks);
    if (tick % 15) continue;
    crowd.writeFrame(frame, 1);
    assert.equal(frame.count, count);
    finished = true;
    for (let i = 0; i < count; i++) {
      const x = frame.positions[i * 3],
        z = frame.positions[i * 3 + 2],
        id = frame.ids[i];
      assert.equal(frame.positions[i * 3 + 1], terrain.heightAt(x, z));
      if (parked.has(id))
        assert.deepEqual([x, z], parked.get(id), 'actual parked positions remain fixed');
      const expectedState = holding.has(id) ? AgentState.Holding : AgentState.Arrived;
      if (frame.states[i] !== expectedState || frame.movementBlend[i] >= 0.001) {
        finished = false;
        continue;
      }
      assert.equal(crowd.getAgent(id).state, expectedState);
      parked.set(id, [x, z]);
    }
    if (finished) break;
  }
  assert.ok(finished, `${label}: complete arrival through the actual built public API`);
  for (let tick = 0; tick < 60; tick++) crowd.step();
  crowd.writeFrame(frame, 1);
  for (let i = 0; i < count; i++)
    assert.deepEqual(
      [frame.positions[i * 3], frame.positions[i * 3 + 2]],
      parked.get(frame.ids[i]),
    );
  assert.equal(parked.size, count);
  assert.equal(crowd.getStats().fieldBuilds, fields);
  assert.equal(crowd.getStats().reservations, count - holding.size);
  assert.ok(peakNeighbours < count * 256);
  console.log(
    JSON.stringify({
      scenario: label,
      count,
      tick: crowd.tick,
      parked: parked.size,
      arrived: count - holding.size,
      held: holding.size,
      fields,
      peakNeighbours,
    }),
  );
  crowd.dispose();
}
