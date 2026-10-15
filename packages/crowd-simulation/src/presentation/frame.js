// @ts-check
import { AgentState, fixedDelta } from '../constants.js';

/** @returns {import('../contracts.js').CrowdFrameBuffer} */
export function createCrowdFrameBuffer(capacity = 0) {
  if (!Number.isSafeInteger(capacity) || capacity < 0)
    throw new RangeError('Invalid frame capacity');
  return {
    count: 0,
    tick: 0,
    revision: 0,
    time: 0,
    ids: new Uint32Array(capacity),
    groups: new Uint32Array(capacity),
    positions: new Float64Array(capacity * 3),
    yaw: new Float64Array(capacity),
    age: new Float64Array(capacity),
    movementBlend: new Float64Array(capacity),
    velocity: new Float64Array(capacity * 2),
    states: new Uint8Array(capacity),
  };
}

/** @param {import('../internal-types.js').SolverAgent} unit */
export function agentState(unit) {
  if (unit.contact !== null) return AgentState.Contact;
  if (unit.target && !unit.moving && unit.x === unit.target.x && unit.z === unit.target.z)
    return AgentState.Arrived;
  if (unit.state === 'holding') return AgentState.Holding;
  if (unit.state === 'waiting') return AgentState.Waiting;
  return unit.target || unit.moving ? AgentState.Moving : AgentState.Idle;
}

/**
 * @param {import('../internal-types.js').SolverWorld} world
 * @param {{heightAt(x: number, z: number): number}} surface
 * @param {import('../contracts.js').CrowdFrameBuffer} out
 * @param {number} alpha
 */
export function writeWorldFrame(world, surface, out, alpha) {
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1)
    throw new RangeError('Interpolation alpha must be between 0 and 1');
  const n = world.units.length;
  if (
    out.ids.length < n ||
    out.groups.length < n ||
    out.positions.length < n * 3 ||
    out.yaw.length < n ||
    out.age.length < n ||
    out.movementBlend.length < n ||
    out.velocity.length < n * 2 ||
    out.states.length < n
  ) {
    let capacity = Math.max(16, out.ids.length);
    while (capacity < world.units.length) capacity *= 2;
    Object.assign(out, createCrowdFrameBuffer(capacity));
  }
  out.count = world.units.length;
  out.tick = world.stats.steps;
  out.revision = world.revision;
  out.time = Math.max(0, world.time - fixedDelta * (1 - alpha));
  for (let i = 0; i < world.units.length; i++) {
    const m = world.units[i],
      p = m.previous,
      x = p.x + (m.x - p.x) * alpha,
      z = p.z + (m.z - p.z) * alpha;
    out.ids[i] = m.id;
    out.groups[i] = m.group;
    out.positions[i * 3] = x;
    out.positions[i * 3 + 1] = surface.heightAt(x, z);
    out.positions[i * 3 + 2] = z;
    const angle = m.yaw - p.yaw;
    out.yaw[i] = p.yaw + Math.atan2(Math.sin(angle), Math.cos(angle)) * alpha;
    out.age[i] = p.time + (m.time - p.time) * alpha;
    out.movementBlend[i] = p.movementBlend + (m.movementBlend - p.movementBlend) * alpha;
    out.velocity[i * 2] = m.vx;
    out.velocity[i * 2 + 1] = m.vz;
    out.states[i] = agentState(m);
  }
}
