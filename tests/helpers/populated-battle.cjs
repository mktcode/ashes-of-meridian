// Explicit developed-base fixture for production, repair, crowd and effect tests.
// This is not the game's starting loadout or an alternative runtime start mode.
function populateBase(game, workers = 5) {
  const faction = game.s.faction, random = game.random, blocked = game.world.blocked;
  try {
    // Fixture entities must not shift the battle/effect RNG entry point.
    game.random = () => .5;
    game.world.blocked = game.world.staticGrid.slice();
    for (const [type, x, z] of [
      ['barracks', -39, 53], ['depot', -51, 63], ['refinery', -63, 60],
      ['factory', -37, 67], ['depot', -27, 61]
    ]) game.spawnBuilding(type, x, z, 0, faction);
    game.spawnUnit('hero', -45, 42, 0, faction);
    for (let i = 0; i < workers; i++)
      game.spawnUnit('worker', -57 + (i % 3) * 1.8, 46 + Math.floor(i / 3) * 1.8, 0, faction);
    for (let i = 0; i < 7; i++)
      game.spawnUnit('rifle', -51 + (i % 4) * 1.8, 38 - Math.floor(i / 4) * 1.8, 0, faction);
    for (const [type, x, z] of [
      ['medic', -45, 39], ['tank', -40, 37], ['tank', -36, 35], ['medic', -42, 40]
    ]) game.spawnUnit(type, x, z, 0, faction);
  } finally {
    game.random = random;
    game.world.blocked = blocked;
  }
  for (const b of game.alive(e => e.type === 'refinery'))
    b.gasId = game.closest(b, e => e.type === 'gas' && e.kind === 'resource')?.id;
  game.world.rebuild(game.s.entities);
  for (const e of game.alive(e => e.kind === 'unit')) {
    const p = game.unitPosition(e);
    if (!p) throw Error('No free space in populated battle fixture.');
    Object.assign(e, p);
  }
  // Developed-base scenarios use an explicit economy independent of start balance.
  game.s.alloy = 1100;
  game.s.gas = 400;
  game.rehash();
  game.world.reveal(game.s.entities);
}
module.exports = { populateBase };
