// Fresh VM per rule arena; source caching does not share mutable game globals.
const vm = require('node:vm');
const {
  BATTLEFIELD_SCRIPTS,
  SIMULATION_SCRIPTS,
  readScripts,
  loadScripts,
} = require('./game-scripts.cjs');
const scripts = readScripts();

function createGame() {
  const context = loadScripts(
    ['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'effects', ...SIMULATION_SCRIPTS],
    {
      scripts,
      globals: { structuredClone },
    },
  );
  vm.runInContext(
    'Math.random = () => { throw Error("Unexpected unseeded randomness in simulation test"); }',
    context,
  );
  const MeridianGame = vm.runInContext('MeridianGame', context);
  const events = [];
  const game = new MeridianGame({ upgrades: {} }, (type, data) => {
    events.push({ type, data: JSON.parse(JSON.stringify(data)) });
  });
  // Local rules isolate the controller; autonomous play belongs to the AI suite.
  game.aiTick = () => {};
  return { game, events, context };
}
module.exports = { createGame };
