import {
  createCrowd,
  createHeightfield,
  createNavigationWorld,
  createCrowdFrameBuffer,
  createFixedStepClock,
  AgentState,
} from '@aom/crowd-simulation';
import type { AgentId, GroupId, HeightfieldOptions } from '@aom/crowd-simulation';
const surface = createHeightfield({
  halfSize: 8,
  cellSize: 0.5,
  heights: new Float64Array(33 ** 2),
});
const rectangular: HeightfieldOptions = {
  width: 48,
  depth: 72,
  cellSize: 2,
  origin: { x: 100, z: -90 },
  rowOrder: 'decreasing-z',
  diagonal: 'a-d',
  boundary: 'reject',
  heights: new Float32Array(25 * 37),
};
const otherSurface = createHeightfield(rectangular);
const gradient: number = otherSurface.cellSlopeAt(110, -80);
const inside: boolean = otherSurface.contains(110, -80);
void gradient;
void inside;
// @ts-expect-error Square shorthand and explicit rectangle are mutually exclusive.
createHeightfield({ halfSize: 8, width: 16, depth: 16, cellSize: 2, heights: [] });
// @ts-expect-error Storage orientation is explicit, not an arbitrary string.
createHeightfield({ ...rectangular, rowOrder: 'north' });
// @ts-expect-error Bounds are immutable snapshots.
otherSurface.bounds.minX = 0;
const navigation = createNavigationWorld({
  surface,
  obstacles: [],
  profiles: { disc: { radius: 0.4, maxSlope: 0.6, maxSpeed: 2 } },
});
const crowd = createCrowd({ navigation });
const group: GroupId = crowd.createGroup({ profile: 'disc', team: 0, spawnOrigin: { x: 0, z: 0 } });
const result = crowd.spawn(group, 4);
const id: AgentId = result.agents[0];
const command = crowd.command({ kind: 'move', group, destination: { x: 4, z: 0 } });
if (!command.ok) {
  const reason: string = command.reason;
  void reason;
}
const buffer = createCrowdFrameBuffer();
const clock = createFixedStepClock();
clock.advance(1 / 60, crowd.step);
crowd.writeFrame(buffer, clock.alpha);
if (crowd.getAgent(id)?.state === AgentState.Arrived) crowd.removeAgents([id]);
// @ts-expect-error Group IDs and agent IDs are not interchangeable.
crowd.removeAgents([group]);
// @ts-expect-error Public views cannot change authoritative positions.
crowd.getAgent(id)!.x = 0;
// @ts-expect-error No mutable solver-world escape hatch.
crowd.world;
// @ts-expect-error Opaque navigation is constructed, not fabricated.
createCrowd({ navigation: {} });
