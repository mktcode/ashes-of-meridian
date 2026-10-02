// Bounded economic validators: no simulation steps or autonomous controller runs.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts, BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS } = require('./helpers/game-scripts.cjs');
const context = loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'effects', ...SIMULATION_SCRIPTS]);
const { MeridianGame } = vm.runInContext('({ MeridianGame })', context);
const json = value => JSON.parse(JSON.stringify(value));
function battle(faction = 0) {
  const game = new MeridianGame({ upgrades: {} });
  game.start({ seed: 1409, map: 'desert', faction, enemies: [faction] });
  return game;
}

test('unknown structures cannot be built or spend resources', () => {
  const game = battle(), before = json(game.s);
  game.random = () => { throw Error('Economic rejection consumed RNG'); };
  assert.match(game.canBuild('unknown-structure'), /Unknown structure/);
  assert.equal(game.build('unknown-structure', { x: -30, z: 40 }), false);
  assert.deepEqual(json(game.s), before);
});

test('unknown units cannot be recruited or mutate the battle', () => {
  for (const faction of [0, 1, 2]) {
    const game = battle(faction), before = json(game.s);
    game.random = () => { throw Error('Economic rejection consumed RNG'); };
    assert.equal(game.train('unknown-unit'), false);
    assert.deepEqual(json(game.s), before);
  }
});

test('only an owned completed replacement HQ permits sale of the current HQ', () => {
  const game = battle();
  // This validator needs an established base, not the worker-only starting recipe.
  const hq = game.spawnBuilding('hq', -50, 40, 0, 0),
    enemy = game.spawnBuilding('hq', 50, -40, 1, 0);
  const next = game.spawnBuilding('hq', -20, 60, 0, 0, { progress: .5 });
  assert.match(game.canSellBuilding(hq.id), /Last command center/);
  assert.equal(game.sellBuilding(hq.id), false);
  next.progress = 1;
  assert.equal(game.sellBuilding(hq.id), true);
  assert.match(game.canSellBuilding(next.id), /Last command center/);
  for (const target of [game.spawn('unit', 'hero', 0, 0, 0, 0),
    enemy,
    game.spawnBuilding('depot', 0, 0, 0, 0, { progress: .5 }), { id: -1 }]) {
    const before = json(game.s);
    assert.equal(game.sellBuilding(target.id), false);
    assert.deepEqual(json(game.s), before);
  }
});
