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
  // Mixed formation spacing is deliberately changed; keep the historical oracle intact
  // for the unaffected single-size scenarios, and compare both solver entry points below.
  if (expected.name !== 'mixed' && expected.name !== 'mixed-contact') {
    assert.deepEqual(actual, expected.units, `${expected.name}: solver positions, reservations, headings, locomotion and contacts unchanged`);
    assert.deepEqual(world.stats, expected.stats, `${expected.name}: navigation/recovery work unchanged`);
  }
  assert.equal(actual.length, expected.units.length);
  const frame = api.createCrowdFrameBuffer(); crowd.writeFrame(frame, 1);
  assert.equal(frame.count, expected.units.length);
  for (let i = 0; i < frame.count; i++) {
    const m = actual[i];
    assert.deepEqual(Array.from(frame.positions.subarray(i * 3, i * 3 + 3)), [m.x, m.y, m.z]);
    assert.equal(frame.yaw[i], m.yaw); assert.equal(frame.movementBlend[i], m.movementBlend);
    const contact = crowd.getAgent(frame.ids[i]).contact;
    assert.equal(contact, m.contact === null ? null : frame.ids[m.contact]);
  }
  const stats = crowd.getStats();
  for (const key of Object.keys(world.stats)) assert.equal(stats[key], world.stats[key], `${expected.name}: public ${key}`);
  crowd.dispose();
}
console.log('Parity: exact pre-extraction single/counterflow traces; four scenarios compare solver/public poses, contacts, reservations and work counters for 1800 ticks. Mixed spacing is covered by independent compact-formation/passage tests, not regenerated historical fixtures.');
