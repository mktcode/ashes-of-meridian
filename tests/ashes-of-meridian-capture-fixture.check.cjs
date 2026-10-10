const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS, loadScripts } = require('./helpers/game-scripts.cjs');

const scenes = [
  { map: 'desert', seed: 1409, faction: 0, enemy: 1 },
  { map: 'alien-planet', seed: 24080, faction: 1, enemy: 2 },
  { map: 'mothership', seed: 43015, faction: 2, enemy: 0 }
];

function createRuntime() {
  const context = loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'effects', ...SIMULATION_SCRIPTS]);
  const Game = vm.runInContext('MeridianGame', context);
  const game = new Game({ upgrades: {} });
  return { game, ui: { paused: false } };
}

test('capture callback serializes and explicitly creates valid developed HQs for its three scene recipes', async () => {
  const { prepareCaptureBattle } = await import('../scripts/capture-battle-fixture.mjs');
  for (const options of scenes) {
    const runtime = createRuntime(), { game } = runtime;
    const originalStart = game.start.bind(game);
    game.start = recipe => {
      originalStart(recipe);
      assert.equal(game.alive(e => e.type === 'hq').length, 0, 'production start still has no HQ');
      for (const team of [0, 1]) assert.equal(game.party(team).deploymentPending, true);
    };
    const originalCanBuild = game.canBuild.bind(game), sites = [];
    game.canBuild = (type, position, team) => {
      const reason = originalCanBuild(type, position, team);
      if (!reason) sites.push({ team, ...position });
      return reason;
    };
    // Same serialized function and browser-global lookup used by page.evaluate.
    const context = vm.createContext({ window: { Meridian: runtime }, options });
    const homes = vm.runInContext(`(${prepareCaptureBattle.toString()})({ options })`, context);
    assert.equal(runtime.ui.paused, true);
    assert.equal(homes.length, 2);
    for (const home of homes) {
      const hq = game.alive(e => e.kind === 'building' && e.type === 'hq' && e.team === home.team)[0];
      assert.ok(hq);
      assert.equal(hq.progress, 1);
      assert.equal(hq.faction, home.team ? options.enemy : options.faction);
      assert.equal(game.party(home.team).deploymentPending, false);
      assert.ok(sites.some(p => p.team === home.team && p.x === hq.x && p.z === hq.z));
      assert.equal(game.get(hq.id), hq, 'new HQ is indexed');
      assert.equal(game.world.blockedAt(hq.x, hq.z), true, 'new HQ participates in occupancy');
    }
  }
});

test('capture fixture fails explicitly rather than spawning an HQ on rejected terrain', async () => {
  const { prepareCaptureBattle } = await import('../scripts/capture-battle-fixture.mjs');
  let spawns = 0;
  const runtime = { ui: {}, game: {
    start() {}, alive: () => [{ x: 0, z: 0 }], canBuild: () => 'Terrain obstructs the foundation.',
    spawnBuilding() { spawns++; }
  } };
  assert.throws(() => prepareCaptureBattle({ options: scenes[0], runtime }), /no valid HQ site near team 0/);
  assert.equal(spawns, 0);
  assert.equal(runtime.ui.paused, true);
});
