'use strict';

const CrowdScenarios = (() => {
  const setups = {
    counterflow: { a: [-16, -6], b: [16, -6], goalA: [20, -6], goalB: [-20, -6] },
    crossing: { a: [-22, -6], b: [-6, -26], goalA: [12, -6], goalB: [-6, 14] },
    standing: { a: [-16, -6], b: [8, -6], goalA: [24, -6] },
    contact: { a: [-16, -6], b: [16, -6], goalA: [20, -6], goalB: [-20, -6], hostile: true },
    mixed: { a: [-16, -6], b: [16, -6], goalA: [20, -6], goalB: [-20, -6], tanks: true },
    'mixed-standing': { a: [-16, -6], b: [8, -6], goalA: [24, -6], tanks: true },
    'mixed-contact': { a: [-16, -6], b: [16, -6], goalA: [20, -6], goalB: [-20, -6], tanks: true, hostile: true },
  };
  const point = ([x, z]) => ({ x, z });
  function load(world, name, count = 32) {
    const setup = typeof name === 'string' && Object.hasOwn(setups, name) ? setups[name] : null;
    if (!setup || !Number.isSafeInteger(count) || count < 1 || count > 500) return false;
    const core = CrowdSimulation, next = core.createWorld();
    next.marines = []; next.groups[0].spawn = point(setup.a);
    const secondCount = setup.tanks ? Math.ceil(count / 8) : count;
    if (core.createGroup(next, setup.hostile ? 1 : 0, point(setup.b), setup.tanks ? 'tank' : 'marine') < 0) return false;
    if (core.spawnMarines(next, count, 0).length !== count || core.spawnMarines(next, secondCount, 1).length !== secondCount) return false;
    if (!core.moveTo(next, point(setup.goalA), 0)) return false;
    if (setup.goalB) { if (!core.moveTo(next, point(setup.goalB), 1)) return false; }
    else core.hold(next, 1);
    next.revision = world.revision + 1;
    Object.assign(world, next);
    return true;
  }
  return { load };
})();
