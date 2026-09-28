import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
// Build from the same sources as the offline client; deploy dist, not a second simulation implementation.
execFileSync(process.execPath, [resolve(root, '../node_modules/typescript/bin/tsc'), '-p', resolve(root, '../tsconfig.json')], { stdio: 'inherit' });
rmSync(resolve(root, 'dist'), { recursive: true, force: true });
mkdirSync(resolve(root, 'dist'), { recursive: true });
const files = ['core', 'content', 'battlefields/surface', 'battlefields/shared', 'battlefields/desert', 'battlefields/alien-planet',
  'battlefields/mothership', 'battlefields/westmark-data', 'battlefields/westmark',
  'battlefields/aurelion-layout', 'battlefields/aurelion', 'battlefields/catalog', 'world', 'effects', 'simulation/game', 'simulation/movement',
  'simulation/economy', 'simulation/combat', 'simulation/commands', 'simulation/ai-rules', 'simulation/ai-strategy', 'simulation/ai', 'simulation/runtime', 'multiplayer/presentation', 'multiplayer/state'];
const source = files.map(name => readFileSync(resolve(root, '../dist/src', name + '.js'), 'utf8')).join('\n');
writeFileSync(resolve(root, 'dist/simulation.js'), source + `\n({ version: MULTIPLAYER_VERSION, maps: availableBattlefields(),
  create(options) { const game = new MeridianGame({ upgrades: {} }, () => {}); game.startScenario(options); enableMultiplayerPresentation(game); return game; },
  view: multiplayerFrame, enqueue: queueMultiplayerAction,
  discard(game, team) { takeMultiplayerEffects(game, team); } });\n`);
