// Explicit developed simulation bases, never a runtime starting loadout.
// Requires established, otherwise empty HQs. Historical effects use presentation-base.cjs.
function populateDevelopedParty(game, team, workers, buildingTypes, unitTypes, economy) {
  const party = game.party(team), homes = game.alive(e => e.team === team && e.kind === 'building' && e.type === 'hq' && e.progress >= 1);
  if (party.deploymentPending || homes.length !== 1 || game.alive(e => e.team === team && e.type !== 'hq').length)
    throw Error(`Populated fixture requires one established, otherwise empty HQ for party ${team}.`);
  if (!Number.isSafeInteger(workers) || workers < 0)
    throw Error('Populated fixture requires a nonnegative worker count.');
  const home = homes[0], random = game.random, account = party.account,
    before = { alloy: account.alloy, gas: account.gas }, builders = [], buildings = [], units = [];
  let completed = false;
  const spawnUnit = type => {
    const unit = game.spawnDeploymentUnit(type, home, home, team, party.faction);
    if (!unit || !game.unitFits(unit, unit.x, unit.z))
      throw Error(`Populated fixture has no fitting ${type} position for party ${team}.`);
    return unit;
  };
  try {
    game.random = () => .5;
    // Explicit fixture grants, not assertions about the production start economy.
    // Use real build validation/payment, including planned-foundation reachability.
    for (const type of buildingTypes) {
      const cost = game.cost(type, 'building', team);
      account.alloy += cost.cost; account.gas += cost.gas;
    }
    for (let i = 0; i < Math.max(1, workers); i++) builders.push(spawnUnit('worker'));
    game.rehash(); game.world.reveal(game.s.entities);
    game.world.explore(team, home, 64); // Explicit developed local scouting, not fresh-start visibility.
    const candidates = [];
    for (let i = 0; i < game.world.deploymentReachable.length; i++) {
      if (!game.world.deploymentReachable[i]) continue;
      const p = game.world.point(i), distance = Math.hypot(p.x - home.x, p.z - home.z);
      if (distance >= 8 && distance <= 64) candidates.push({ p, distance });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    for (const type of buildingTypes) {
      const positions = type === 'refinery'
        ? game.alive(e => e.kind === 'resource' && e.type === 'gas')
          .sort((a, b) => Math.hypot(a.x - home.x, a.z - home.z) - Math.hypot(b.x - home.x, b.z - home.z))
        : candidates.map(c => c.p);
      let building;
      for (const p of positions) {
        if (game.canBuild(type, p, team) || !game.build(type, p, builders.map(w => w.id), team)) continue;
        building = game.alive(e => e.team === team && e.kind === 'building' && e.type === type && e.progress < 1).at(-1);
        if (!building) throw Error(`Populated fixture build did not create ${type} for party ${team}.`);
        // Developed rule arena: deliberately skip construction time, not placement rules.
        building.progress = 1; building.hp = building.maxHp;
        for (const worker of builders) game.setOrder(worker, { type: 'idle' });
        buildings.push(building);
        game.world.reveal(game.s.entities);
        break;
      }
      if (!building) throw Error(`Populated fixture has no legal reachable ${type} site for party ${team}.`);
    }
    if (workers === 0) {
      const removed = new Set(builders.map(w => w.id));
      game.s.entities = game.s.entities.filter(e => !removed.has(e.id));
      for (const id of removed) game.ids.delete(id);
    } else units.push(...builders);
    for (const type of unitTypes) units.push(spawnUnit(type));
    completed = true;
    return { home, buildings, units };
  } finally {
    // Restore RNG/funds and indexes also on partial failure; this is not a rollback.
    game.random = random;
    account.alloy = completed && economy ? economy.alloy : before.alloy;
    account.gas = completed && economy ? economy.gas : before.gas;
    game.world.rebuild(game.s.entities);
    game.rehash(); game.world.reveal(game.s.entities);
  }
}
function populateBase(game, workers = 5) {
  return populateDevelopedParty(game, 0, workers,
    // Reserve the vent first: later buildings must not obstruct its refinery footprint.
    ['refinery', 'barracks', 'depot', 'factory', 'depot'],
    ['hero', ...Array(7).fill('rifle'), 'medic', 'tank', 'tank', 'medic'],
    { alloy: 1100, gas: 400 });
}
function populateOpponent(game) {
  return populateDevelopedParty(game, 1, 0,
    ['turret', 'turret', 'barracks', 'factory'],
    [...Array(5).fill('rifle'), 'artillery', 'tank']);
}
module.exports = { populateBase, populateOpponent };
