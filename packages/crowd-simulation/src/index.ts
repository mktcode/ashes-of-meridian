import { createHeightfield as bakeHeightfield } from './navigation/heightfield.js';
import { createNavigation } from './navigation/navigation.js';
import { createRecovery } from './movement/recovery.js';
import { createSolver } from './world.js';
import { agentState, writeWorldFrame } from './presentation/frame.js';
import { AgentState } from './constants.js';
import type {
  AgentId,
  GroupId,
  OrderId,
  Heightfield,
  HeightfieldOptions,
  NavigationWorld,
  NavigationOptions,
  Crowd,
  GroupView,
} from './contracts.js';
export * from './contracts.js';
export { createCrowdFrameBuffer } from './presentation/frame.js';
export { createFixedStepClock, fixedDelta } from './presentation/fixed-step-clock.js';

const surfaces = new WeakSet<object>();
const navigations = new WeakMap<NavigationWorld, ReturnType<typeof createNavigation>>();
const validPoint = (p: unknown): p is { x: number; z: number } =>
  !!p &&
  typeof p === 'object' &&
  Number.isFinite((p as { x: number }).x) &&
  Number.isFinite((p as { z: number }).z);
const validId = (id: number) => Number.isSafeInteger(id) && id >= 0;

export function createHeightfield(options: HeightfieldOptions): Heightfield {
  const surface = bakeHeightfield(options) as Heightfield;
  surfaces.add(surface);
  return surface;
}

export function createNavigationWorld(options: NavigationOptions): NavigationWorld {
  const { surface, profiles, obstacles } = options;
  const cellSize = options.cellSize ?? surface?.cellSize;
  if (!surfaces.has(surface))
    throw new TypeError('Use createHeightfield for the navigation surface');
  if (!(cellSize > 0) || cellSize !== surface.cellSize)
    throw new RangeError('Navigation grid must match the surface triangles');
  if (!profiles || !Object.keys(profiles).length)
    throw new RangeError('At least one movement profile is required');
  const copied = Object.create(null) as Record<
    string,
    Required<NavigationOptions['profiles'][string]>
  >;
  for (const [id, p] of Object.entries(profiles)) {
    if (
      !id ||
      !p ||
      !Number.isFinite(p.radius) ||
      !(p.radius > 0) ||
      !Number.isFinite(p.maxSlope) ||
      p.maxSlope < 0 ||
      !Number.isFinite(p.maxSpeed) ||
      !(p.maxSpeed > 0) ||
      (p.traffic !== undefined && !['cooperative', 'independent-detour'].includes(p.traffic))
    )
      throw new RangeError(`Invalid movement profile: ${id}`);
    copied[id] = Object.freeze({
      radius: p.radius,
      maxSlope: p.maxSlope,
      maxSpeed: p.maxSpeed,
      traffic: p.traffic ?? 'cooperative',
    });
  }
  if (!Array.isArray(obstacles)) throw new TypeError('Obstacle array required');
  const boxes = obstacles.map((b) => {
    if (
      !b ||
      !Number.isFinite(b.x) ||
      !Number.isFinite(b.z) ||
      !Number.isFinite(b.width) ||
      !(b.width > 0) ||
      !Number.isFinite(b.depth) ||
      !(b.depth > 0)
    )
      throw new RangeError('Invalid obstacle');
    return Object.freeze({ x: b.x, z: b.z, width: b.width, depth: b.depth });
  });
  const handle = Object.freeze({}) as NavigationWorld;
  navigations.set(
    handle,
    createNavigation(surface, Object.freeze(boxes), Object.freeze(copied), cellSize),
  );
  return handle;
}

// Read-only query of the solver's actual, conservatively cleared profile grid.
export function canStand(navigation: NavigationWorld, profile: string, x: number, z: number): boolean {
  const world = navigations.get(navigation);
  if (!world) throw new TypeError('Unknown navigation world');
  const grid = world.forProfile(profile);
  if (!grid) throw new RangeError('Unknown movement profile');
  return grid.canStand(x, z);
}

export function createCrowd(options: {
  navigation: NavigationWorld;
  contactMode?: 'none' | 'hostile-stop';
}): Crowd {
  const navigation = navigations.get(options.navigation);
  if (!navigation) throw new TypeError('Unknown navigation world');
  const mode = options.contactMode ?? 'hostile-stop';
  if (mode !== 'none' && mode !== 'hostile-stop') throw new RangeError('Invalid contact mode');
  const recovery = createRecovery(navigation),
    core = createSolver(navigation.surface, navigation, recovery, mode);
  const world = core.createWorld(),
    agents = new Map<number, ReturnType<typeof core.createAgent>>(),
    orders = new Map<number, OrderId>();
  let disposed = false,
    nextOrder = 1,
    cachedRevision = -1;
  let groups: readonly GroupView[] = [];
  const active = () => {
    if (disposed) throw new Error('Crowd is disposed');
  };
  const groupAt = (id: number) => (validId(id) ? world.groups[id] : undefined);
  return Object.freeze({
    get size() {
      active();
      return world.units.length;
    },
    get tick() {
      active();
      return world.stats.steps;
    },
    get revision() {
      active();
      return world.revision;
    },
    createGroup({ profile, team, spawnOrigin }) {
      active();
      if (
        typeof profile !== 'string' ||
        !Number.isSafeInteger(team) ||
        team < 0 ||
        !validPoint(spawnOrigin)
      )
        throw new RangeError('Explicit profile, team and finite spawn origin required');
      const id = core.createGroup(world, team, spawnOrigin, profile);
      if (id < 0) throw new RangeError('Invalid group profile, team or spawn origin');
      world.revision++;
      return id as GroupId;
    },
    spawn(group, count) {
      active();
      if (!groupAt(group) || !Number.isSafeInteger(count) || count < 0)
        throw new RangeError('Invalid spawn group or count');
      const added = core.spawnAgents(
        world,
        Math.min(count, 0x100000000 - world.nextAgentId),
        group,
      );
      for (const m of added) agents.set(m.id, m);
      return Object.freeze({
        requested: count,
        agents: Object.freeze(added.map((m) => m.id as AgentId)),
        complete: added.length === count,
      });
    },
    command(order) {
      active();
      if (!order || !['move', 'hold'].includes(order.kind))
        return { ok: false, reason: 'invalid-order' };
      if (!groupAt(order.group)) return { ok: false, reason: 'unknown-group' };
      const revision = world.revision;
      if (order.kind === 'move') {
        if (!validPoint(order.destination)) return { ok: false, reason: 'invalid-destination' };
        if (!core.moveTo(world, order.destination, order.group))
          return { ok: false, reason: 'unreachable-or-insufficient-space' };
      } else core.hold(world, order.group);
      const id = nextOrder++ as OrderId;
      orders.set(order.group, id);
      cachedRevision = -1;
      if (world.revision === revision) world.revision++;
      return { ok: true, order: id };
    },
    setTeam(group, team) {
      active();
      return core.setTeam(world, group, team);
    },
    removeAgents(ids) {
      active();
      if (!Array.isArray(ids) || ids.some((id) => !validId(id)))
        throw new RangeError('Invalid agent IDs');
      const count = core.removeAgents(world, ids);
      for (const id of ids) agents.delete(id);
      return count;
    },
    getAgent(id) {
      active();
      const m = agents.get(id);
      return m
        ? Object.freeze({
            id: m.id as AgentId,
            group: m.group as GroupId,
            profile: m.profile,
            radius: m.radius,
            x: m.x,
            y: m.y,
            z: m.z,
            yaw: m.yaw,
            state: agentState(m),
            orderId: orders.get(m.group) ?? null,
            contact: m.contact === null ? null : (world.units[m.contact].id as AgentId),
          })
        : null;
    },
    getGroups() {
      active();
      if (cachedRevision !== world.revision) {
        groups = Object.freeze(
          world.groups.map((g) =>
            Object.freeze({
              id: g.id as GroupId,
              profile: g.profile,
              team: g.team,
              order: g.order,
              orderId: orders.get(g.id) ?? null,
              destination: g.destination ? Object.freeze({ ...g.destination }) : null,
            }),
          ),
        );
        cachedRevision = world.revision;
      }
      return groups;
    },
    getStats() {
      active();
      let moving = 0,
        waiting = 0,
        inContact = 0;
      for (const m of world.units) {
        const state = agentState(m);
        moving += Number(state === AgentState.Moving || state === AgentState.Waiting);
        waiting += Number(state === AgentState.Waiting || (m.moving && m.stalledFor > 2));
        inContact += Number(state === AgentState.Contact);
      }
      return Object.freeze({
        ...world.stats,
        moving,
        waiting,
        inContact,
        reservations: world.groups.reduce((sum, g) => sum + g.reservedSlots.size, 0),
      });
    },
    step() {
      active();
      world.stats.neighbourChecks = world.stats.contactChecks = 0;
      core.tick(world);
    },
    writeFrame(out, alpha) {
      active();
      writeWorldFrame(world, navigation.surface, out, alpha);
    },
    dispose() {
      if (disposed) return;
      for (const group of world.groups) recovery.invalidate(group);
      world.units = [];
      world.groups = [];
      world.scratch = world.recoveryCandidate = null;
      agents.clear();
      orders.clear();
      groups = [];
      disposed = true;
    },
  } satisfies Crowd);
}
