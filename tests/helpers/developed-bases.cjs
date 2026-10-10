// Explicit established-HQ fixture for unit-rule scenarios, not a runtime start mode.
// Starts/end-to-end deployment tests must use the unmodified game.start() state.
function establishHeadquarters(game) {
  const random = game.random, homes = [];
  try {
    // Fixture cooldowns must not advance the battle's simulation RNG.
    game.random = () => .5;
    for (const party of game.s.parties) {
      const team = party.id;
      if (!party.deploymentPending || game.alive(e => e.team === team && e.type === 'hq').length)
        throw Error(`Developed-base fixture requires fresh deployment for party ${team}.`);
      const workers = game.alive(e => e.kind === 'unit' && e.type === 'worker' && e.team === team);
      const worker = workers.at(-1);
      if (!worker) throw Error(`Developed-base fixture has no landing worker for party ${team}.`);
      const cost = game.cost('hq', 'building', team);
      if (!game.afford(cost, team)) throw Error(`Developed-base fixture has no HQ reserves for party ${team}.`);
      let position;
      for (let radius = 8; radius <= 40 && !position; radius += 2) {
        for (let step = 0; step < 48; step++) {
          const angle = step * Math.PI * 2 / 48;
          const candidate = { x: worker.x + Math.cos(angle) * radius, z: worker.z + Math.sin(angle) * radius };
          if (!game.canBuild('hq', candidate, team)) { position = candidate; break; }
        }
      }
      if (!position) throw Error(`Developed-base fixture has no valid HQ site for party ${team}.`);
      const home = game.spawnBuilding('hq', position.x, position.z, team, party.faction);
      if (!home) throw Error(`Developed-base fixture could not spawn HQ for party ${team}.`);
      party.account.alloy -= cost.cost;
      party.account.gas -= cost.gas;
      party.deploymentPending = false;
      // Established production/economy cases add or recruit their own workers explicitly.
      const removed = new Set(workers.map(e => e.id));
      game.s.entities = game.s.entities.filter(e => !removed.has(e.id));
      for (const id of removed) game.ids.delete(id);
      game.world.rebuild(game.s.entities);
      homes.push(home);
    }
  } finally {
    game.random = random;
    // Also leave indexes consistent if setup fails after establishing an earlier party.
    game.rehash();
    game.world.reveal(game.s.entities);
  }
  return homes;
}
module.exports = { establishHeadquarters };
