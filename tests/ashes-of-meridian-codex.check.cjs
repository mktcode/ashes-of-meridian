const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {loadScripts,UI_SCRIPTS} = require('./helpers/game-scripts.cjs');
test('codex exposes current-model tiles for every faction without a profile unlock', () => {
  const context=loadScripts(['core','content','voice-content',...UI_SCRIPTS]);
  vm.runInContext('Math.random = seeded = () => { throw Error("Codex RNG"); }',context);
  const {renderCodexScreen,renderCodexModelScreen,renderStoryScreen,renderHomeScreen,FACTIONS,UNITS,BUILDINGS} =
    vm.runInContext('({renderCodexScreen,renderCodexModelScreen,renderStoryScreen,renderHomeScreen,FACTIONS,UNITS,BUILDINGS})',context);
  assert.match(renderHomeScreen(null,0,''),/data-ui="codex"/);
  for(let faction=0;faction<3;faction++) {
    const html=renderCodexScreen(faction);
    assert.match(html,new RegExp(FACTIONS[faction].name));
    assert.match(html,/data-ui="codexStory"/);
    for(const [kind,catalog] of [['unit',UNITS],['building',BUILDINGS]]) {
      for(const type of Object.keys(catalog)) {
        assert.ok(html.includes(`data-model-faction="${faction}" data-model-kind="${kind}" data-model-type="${type}"`));
        const detail=renderCodexModelScreen(faction,kind,type);
        assert.ok(detail.includes(FACTIONS[faction][`${kind}s`][type]));
        assert.ok(detail.includes(catalog[type].desc));
      }
    }
  }
  assert.equal(renderStoryScreen(),renderStoryScreen(),'story rendering is deterministic without storage or RNG');
});
