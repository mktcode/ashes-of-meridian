const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync,existsSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');
const {loadScripts,UI_SCRIPTS} = require('./helpers/game-scripts.cjs');
const root = join(__dirname,'..');

test('codex shows every faction and authored portrait without a profile unlock', () => {
  const context=loadScripts(['core','content',...UI_SCRIPTS]);
  vm.runInContext('Math.random = seeded = () => { throw Error("Codex RNG"); }',context);
  const {renderCodexScreen,renderCodexModelScreen,renderStoryScreen,renderHomeScreen,FACTIONS,UNITS,BUILDINGS,story} =
    vm.runInContext('({renderCodexScreen,renderCodexModelScreen,renderStoryScreen,renderHomeScreen,FACTIONS,UNITS,BUILDINGS,story:CODEX_STORY_MARKDOWN})',context);
  const source=readFileSync(join(root,'docs/story.md'),'utf8');
  assert.equal(story,source.replace(/\n> \*\*Ashes of Meridian bleibt der Titel\.\*\*[^\n]*\n\n/, '\n')
    .replace(/\n\*In den Spielregeln und technischen Verträgen weiterhin[^\n]*\n/g, '')
    .replace(/\n## 10\. Missionsansätze[\s\S]*?(?=\n## 11\.)/, '')
    .replace('## 11. Was unbekannt bleiben darf','## 10. Was unbekannt bleiben darf'));
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
  assert.match(storyHtml,/Die drei Fraktionen/);
  assert.equal((storyHtml.match(/id="codex-chapter-/g) || []).length,10);
  assert.match(storyHtml,/Breakwater/);
  assert.match(storyHtml,/Die Siebte Vermessung|Siebten Vermessung/);
  assert.match(storyHtml,/<ol><li>.*?Meridian/);
  assert.doesNotMatch(storyHtml,/Dies ist die maßgebliche Geschichte|Missionsansätze aus derselben Welt/);
});
