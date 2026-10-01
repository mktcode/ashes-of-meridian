const {test} = require('node:test');
const assert = require('node:assert/strict');
const {existsSync} = require('node:fs');
const {resolve} = require('node:path');
const vm = require('node:vm');
const {loadScripts, UI_SCRIPTS} = require('./helpers/game-scripts.cjs');

test('UI motifs resolve to local assets and retain SVG fallback without replacing shared icons', () => {
  const context = loadScripts(['core', 'content', 'voice-content', ...UI_SCRIPTS]);
  vm.runInContext('Math.random = seeded = () => { throw Error("UI asset RNG"); }', context);
  const {uiIcon, icon, UI_ICON_ASSETS} = vm.runInContext('({uiIcon, icon, UI_ICON_ASSETS})', context);
  assert.ok(Object.isFrozen(UI_ICON_ASSETS));
  for (const [key, name] of Object.entries(UI_ICON_ASSETS)) {
    const local = `./assets/ui/${name}.webp`;
    assert.ok(existsSync(resolve(__dirname, '..', local)), `${key}: missing local motif`);
    assert.ok(uiIcon(key).includes(local), `${key}: wrong asset reference`);
  }
  for (const key of ['disruption', 'surge', 'recall', 'hero', 'rifle'])
    assert.equal(uiIcon(key), icon(key), `${key}: no equivalent demo motif`);
  assert.equal(uiIcon('commanderMandate', 'hero'), icon('hero'));
  assert.match(icon('heal'), /^<svg/, 'the shared content icon helper stays SVG-based');
});
