const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {loadScripts,UI_SCRIPTS} = require('./helpers/game-scripts.cjs');
test('codex exposes current-model tiles for every faction without a profile unlock', () => {
  const context=loadScripts(['core','content','voice-content',...UI_SCRIPTS]);
  vm.runInContext('Math.random = seeded = () => { throw Error("Codex RNG"); }',context);
  const {renderCodexScreen,renderCodexModelScreen,renderStoryScreen,renderHomeScreen,FACTIONS,UNITS,BUILDINGS} =
    vm.runInContext('({renderCodexScreen,renderCodexModelScreen,renderStoryScreen,renderHomeScreen,FACTIONS,UNITS,BUILDINGS})',context);
  assert.match(renderHomeScreen(null),/data-ui="codex"/);
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

test('civilian gallery exposes twelve previews and returns from specialized live models without gameplay',()=>{
  const menu={innerHTML:'',classList:{remove(){}}},context=loadScripts(['core','content','voice-content',...UI_SCRIPTS],
    {globals:{document:{getElementById:()=>menu}}});
  const {renderCivilianModelGallery,MeridianUI}=vm.runInContext('({renderCivilianModelGallery,MeridianUI})',context);
  vm.runInContext('Math.random=seeded=()=>{throw Error("Gallery RNG");}',context);
  const html=renderCivilianModelGallery();
  assert.equal((html.match(/class="codex-card"/g)||[]).length,12);
  assert.equal((html.match(/data-model-upgrade=/g)||[]).length,9);
  assert.equal((html.match(/Neutral · vor Aktivierung/g)||[]).length,3);
  assert.ok(html.includes('data-model-type="hearthtower"'));assert.ok(html.includes('data-model-type="researchspire"'));
  const ui=Object.assign(Object.create(MeridianUI.prototype),{civilianModelGallery:true,codexFaction:0,
    resetCodexGesture(){},R:{clearStatic(){},useModelPreview(){}},game:{start(){assert.fail('gallery starts gameplay');}}});
  ui.showCodexModel('building','hearthtower','startingAlloy');
  assert.equal(ui.view,'codexModel');assert.equal(ui.codexSelection.upgrade,'startingAlloy');
  assert.ok(menu.innerHTML.includes('Starting Cinder'));
  ui.showCodex();assert.equal(ui.view,'codex');assert.equal(menu.innerHTML,html);
  ui.showCodexModel('building','terracecommons','aetherAllocation');
  assert.equal(ui.codexSelection.upgrade,'aetherAllocation');assert.ok(menu.innerHTML.includes('Echo allocation'));
  ui.showCodex();assert.equal(menu.innerHTML,html);
});
