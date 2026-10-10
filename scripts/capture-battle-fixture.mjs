// Serializable Playwright callback; capture-only setup, never a runtime start mode.
export function prepareCaptureBattle({ options, runtime = window.Meridian }) {
  const { game, ui } = runtime;
  ui.paused = true;
  const { map, seed, faction, enemy } = options;
  game.start({ map, seed, faction, enemies: [enemy], benefits: {}, enemyBenefits: [{}], depth: 6 });
  ui.paused = true;

  const homes = [];
  for (const team of [0, 1]) {
    const worker = game.alive(entity => entity.kind === 'unit' && entity.type === 'worker' && entity.team === team)[0];
    if (!worker) throw new Error(`Capture fixture: no landing worker for team ${team}.`);
    let home;
    for (let radius = 8; radius <= 40 && !home; radius += 2) {
      for (let step = 0; step < 48; step++) {
        const angle = step * Math.PI * 2 / 48;
        const position = { x: worker.x + Math.cos(angle) * radius, z: worker.z + Math.sin(angle) * radius };
        if (game.canBuild('hq', position, team)) continue;
        // Arranged developed base: placement rules apply, construction time/payment do not.
        home = game.spawnBuilding('hq', position.x, position.z, team, game.factionFor(team));
        if (home) break;
      }
    }
    if (!home) throw new Error(`Capture fixture: no valid HQ site near team ${team}'s landing worker (${map}, ${seed}).`);
    game.party(team).deploymentPending = false;
    game.world.rebuild(game.s.entities);
    homes.push({ team, x: home.x, z: home.z });
  }
  game.rehash();
  return homes;
}
