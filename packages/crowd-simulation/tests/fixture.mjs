import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as api from '../dist/index.js';
import { createNavigation } from '../src/navigation/navigation.js';
import { createRecovery } from '../src/movement/recovery.js';
import { createSolver } from '../src/world.js';
import { writeWorldFrame } from '../src/presentation/frame.js';

export function loadDemo() {
  const context = vm.createContext({ console, Math, Float32Array, Float64Array, Array, Map, Set, Number, Object, MeridianCrowd: api });
  for (const file of ['marine-model.js', 'crowd-terrain.js', 'obstacles.js', 'camera.js', 'tank-model.js', 'crowd-scenarios.js', 'marine-instances.js']) {
    vm.runInContext(readFileSync(new URL('../demo/' + file, import.meta.url), 'utf8'), context);
  }
  return vm.runInContext('({ terrain: CrowdTerrain, obstacles: CrowdObstacles, profiles: CrowdProfiles, camera: CrowdCamera, model: MarineModel, tank: TankModel, instances: MarineInstances, demoScenarios: CrowdScenarios })', context);
}

// These fixtures deliberately expose solver internals for physical invariant/regression tests.
// Production consumers and the demo use only the package facade.
export function fixture() {
  const demo = loadDemo(), { terrain, profiles, obstacles, camera, demoScenarios } = demo;
  const nav = createNavigation(terrain.surface, obstacles, profiles), recovery = createRecovery(nav);
  const solver = createSolver(terrain.surface, nav, recovery);
  const sample = api.createCrowdFrameBuffer(1);
  const sampleWorld = { units: [null], stats: { steps: 0 }, revision: 0, time: 0 };
  const core = { ...solver, ...camera,
    update(world, dt) {
      if (!(dt > 0) || !Number.isFinite(dt)) return;
      world.stats.neighbourChecks = world.stats.contactChecks = 0;
      world.accumulator = (world.accumulator ?? 0) + Math.min(dt, 0.25);
      while (world.accumulator >= 1 / 60 - 1e-10) { solver.tick(world); world.accumulator -= 1 / 60; }
    },
    renderAgent(world, m) {
      sampleWorld.units[0] = m;
      writeWorldFrame(sampleWorld, terrain, sample, Math.max(0, Math.min(1, (world.accumulator ?? 0) * 60)));
      return { x: sample.positions[0], y: sample.positions[1], z: sample.positions[2], yaw: sample.yaw[0],
        time: sample.age[0], movementBlend: sample.movementBlend[0] };
    },
  };
  function createFixtureWorld() {
    const world = solver.createWorld(); solver.createGroup(world);
    const m = solver.createAgent(); m.id = world.nextAgentId++; world.units.push(m);
    world.accumulator = 0;
    return world;
  }
  const createTank = (x = 0, z = 0, group = 0) => solver.createAgent(x, z, group, 'tank');
  const scenarios = {
    load(world, name, count = 32) {
      const setup = typeof name === 'string' && Object.hasOwn(demoScenarios.setups, name) ? demoScenarios.setups[name] : null;
      if (!setup || !Number.isSafeInteger(count) || count < 1 || count > 500) return false;
      const point = ([x, z]) => ({ x, z }), next = solver.createWorld();
      solver.createGroup(next, 0, point(setup.a));
      solver.createGroup(next, setup.hostile ? 1 : 0, point(setup.b), setup.tanks ? 'tank' : 'marine');
      if (solver.spawnAgents(next, count, 0).length !== count || solver.spawnAgents(next, setup.tanks ? Math.ceil(count / 8) : count, 1).length !== (setup.tanks ? Math.ceil(count / 8) : count)) return false;
      if (!solver.moveTo(next, point(setup.goalA), 0)) return false;
      if (setup.goalB) { if (!solver.moveTo(next, point(setup.goalB), 1)) return false; }
      else solver.hold(next, 1);
      next.accumulator = 0; next.revision = world.revision + 1;
      Object.assign(world, next); return true;
    },
  };
  return { ...demo, renderer: demo.instances, nav, recovery, core, scenarios, createFixtureWorld, createTank };
}
