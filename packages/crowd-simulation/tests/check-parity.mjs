import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixture } from './fixture.mjs';
import * as api from '@aom/crowd-simulation';

// Captured from 5ae4b62 before extraction; never regenerated from the package implementation.
const baseline = JSON.parse(readFileSync(new URL('fixtures/pre-extraction.json', import.meta.url), 'utf8'));
const { core, scenarios, createFixtureWorld, terrain, obstacles, profiles, demoScenarios } = fixture();
const navigation = api.createNavigationWorld({ surface: terrain.surface, obstacles, profiles });
for (const expected of baseline) {
  const world = createFixtureWorld();
  let crowd;
  if (expected.name === 'single') {
    core.spawnAgents(world, 31); assert.ok(core.moveTo(world, { x: -8, z: 8 }));
    crowd = api.createCrowd({ navigation });
    const group = crowd.createGroup({ profile: 'marine', team: 0, spawnOrigin: { x: 0, z: 0 } });
    assert.ok(crowd.spawn(group, 32).complete);
    assert.ok(crowd.command({ kind: 'move', group, destination: { x: -8, z: 8 } }).ok);
  } else {
    assert.ok(scenarios.load(world, expected.name, 24));
    crowd = demoScenarios.create(navigation, expected.name, 24);
    assert.ok(crowd);
  }
  for (let i = 0; i < 1800; i++) { core.update(world, api.fixedDelta); crowd.step(); }
  const actual = world.units.map(m => ({ x: m.x, y: m.y, z: m.z, yaw: m.yaw, movementBlend: m.movementBlend,
    state: m.state, contact: m.contact, target: m.target ? { x: m.target.x, z: m.target.z } : null }));
  assert.deepEqual(actual, expected.units, `${expected.name}: solver positions, reservations, headings, locomotion and contacts unchanged`);
  assert.deepEqual(world.stats, expected.stats, `${expected.name}: navigation/recovery work unchanged`);
  const frame = api.createCrowdFrameBuffer(); crowd.writeFrame(frame, 1);
  assert.equal(frame.count, expected.units.length);
  for (let i = 0; i < frame.count; i++) {
    const m = expected.units[i];
    assert.deepEqual(Array.from(frame.positions.subarray(i * 3, i * 3 + 3)), [m.x, m.y, m.z]);
    assert.equal(frame.yaw[i], m.yaw); assert.equal(frame.movementBlend[i], m.movementBlend);
    const contact = crowd.getAgent(frame.ids[i]).contact;
    assert.equal(contact, m.contact === null ? null : frame.ids[m.contact]);
  }
  const stats = crowd.getStats();
  for (const key of Object.keys(expected.stats)) assert.equal(stats[key], expected.stats[key], `${expected.name}: public ${key}`);
  crowd.dispose();
}
console.log('Pre-extraction parity: four scenarios, 1800 ticks each, exact solver/public poses, contacts, reservations and work counters.');
