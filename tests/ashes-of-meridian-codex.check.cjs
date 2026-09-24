const {test} = require('node:test');
const assert = require('node:assert/strict');
const {existsSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');
const {loadScripts,UI_SCRIPTS} = require('./helpers/game-scripts.cjs');
const root = join(__dirname,'..');

test('codex shows every faction and authored portrait without a profile unlock', () => {
  const context=loadScripts(['core','content',...UI_SCRIPTS]);
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
        const portrait=`assets/portraits/faction-${faction}-${kind}-${type}.webp`;
        assert.ok(existsSync(join(root,portrait)),portrait);
        assert.ok(html.includes(`src="${portrait}"`));
        const detail=renderCodexModelScreen(faction,kind,type);
        assert.ok(detail.includes(FACTIONS[faction][`${kind}s`][type]));
        assert.ok(detail.includes(catalog[type].desc));
        assert.doesNotMatch(detail,/Animated game model|automatic rotation|no faction unlock required/);
      }
    }
  }
  const storyHtml=renderStoryScreen();
  assert.match(storyHtml,/Three Claims/);
  assert.equal((storyHtml.match(/id="codex-chapter-/g) || []).length,4);
  assert.match(storyHtml,/<strong>Cinder<\/strong>/);
  assert.match(storyHtml,/<strong>Echo<\/strong>/);
  assert.match(storyHtml,/Seventh Survey/);
  assert.match(storyHtml,/<blockquote>[^<]+<br>— Inscription[^<]+<\/blockquote>/);
  assert.doesNotMatch(storyHtml,/Alloy|Aether|Sternenschlacke|Nachhall|Missionsansätze/);
});
