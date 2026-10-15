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
  for (const setup of Object.values(setups)) {
    for (const value of Object.values(setup)) if (Array.isArray(value)) Object.freeze(value);
    Object.freeze(setup);
  }
  Object.freeze(setups);
  const point = ([x, z]) => ({ x, z });
  function create(navigation, name, count = 32) {
    const setup = typeof name === 'string' && Object.hasOwn(setups, name) ? setups[name] : null;
    if (!setup || !Number.isSafeInteger(count) || count < 1 || count > 500) return null;
    const crowd = MeridianCrowd.createCrowd({ navigation });
    const a = crowd.createGroup({ profile: 'marine', team: 0, spawnOrigin: point(setup.a) });
    const b = crowd.createGroup({ profile: setup.tanks ? 'tank' : 'marine', team: setup.hostile ? 1 : 0, spawnOrigin: point(setup.b) });
    if (!crowd.spawn(a, count).complete || !crowd.spawn(b, setup.tanks ? Math.ceil(count / 8) : count).complete
      || !crowd.command({ kind: 'move', group: a, destination: point(setup.goalA) }).ok
      || !crowd.command(setup.goalB ? { kind: 'move', group: b, destination: point(setup.goalB) } : { kind: 'hold', group: b }).ok) {
      crowd.dispose(); return null;
    }
    return crowd;
  }
  return { create, setups };
})();
