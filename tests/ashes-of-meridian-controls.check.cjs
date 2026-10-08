const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS, UI_SCRIPTS, loadScripts } = require('./helpers/game-scripts.cjs');
// Logic behind UI actions; copy, layout and full navigation flows are checked manually.
function flatCameraLimits(ui) {
  const v=ui.R.viewport,cam=ui.game.s.cam,e=ui.game.world.extent,
    x=cam.zoom*v.width/800/2,z=cam.zoom*v.height/800/2*Math.hypot(1.1,.82)/1.1;
  return {x:Math.max(0,e-x+Math.min(8,x*.15)),z:Math.max(0,e-z+Math.min(8,z*.15))};
}

test('stage browsing is bounded and purely visual; continue always launches the real checkpoint', async () => {
  const h = setup(), ui = h.ui, saved = [], previews = [];
  ui.expedition = { version: 8, battle: null, faction: 0, abilities: ['orbital','repair','scan','drop'], depth: 2,
    upgrades: {}, benefits: {}, enemyBenefits: [{}],
    encounter: { mission: 'hq-elimination', enemies: [2], map: 'desert', seed: 1409 } };
  ui.stageHistory = [{ stage: 1, map: 'mothership', seed: 11 }, { stage: 2, map: 'alien-planet', seed: 22 }];
  ui.persistence.saveStageHistory = stages => saved.push(JSON.stringify(stages));
  ui.rememberStage(); ui.rememberStage();
  assert.equal(saved.length, 1, 'revisiting a checkpoint does not duplicate history');
  ui.onPreview = async (...args) => { previews.push(args); return true; };
  ui.showHome(); previews.length = 0;
  const before = JSON.stringify({ expedition: ui.expedition, profile: ui.profile, history: ui.stageHistory });
  vm.runInContext('Math.random = () => { throw Error("Browsing consumed RNG"); };', h.context);
  await ui.browseStage(1); assert.equal(previews.length, 0);
  await ui.browseStage(-1); await ui.browseStage(-1); await ui.browseStage(-1);
  assert.deepEqual(previews, [['alien-planet', 22, true, null], ['mothership', 11, true, null]]);
  assert.equal(ui.stagePreviewIndex, 0);
  assert.equal(JSON.stringify({ expedition: ui.expedition, profile: ui.profile, history: ui.stageHistory }), before);
  assert.equal(saved.length, 1);
  ui.game.start = options => h.calls.push(['start', options]);
  ui.continueExpedition();
  const options = h.calls.at(-1)[1];
  assert.equal(options.map, 'desert'); assert.equal(options.seed, 1409); assert.equal(options.depth, 2);
  await ui.browseStage(1); await ui.browseStage(1); await ui.browseStage(1);
  assert.equal(ui.stagePreviewIndex, 2);
  assert.equal(previews.length, 4);
});

test('stage previews ignore overlapping input, failures, dialogs and stale screen completions', async () => {
  const h = setup(), ui = h.ui;
  ui.expedition = { depth: 1, encounter: { mission: 'hq-elimination', enemies: [], map: 'desert', seed: 1409 }, upgrades: {}, benefits: {}, abilities: [], enemyBenefits: [] };
  ui.stageHistory = [{ stage: 1, map: 'mothership', seed: 11 }, { stage: 2, map: 'desert', seed: 1409 }];
  ui.showHome();
  let resolve, calls = 0;
  ui.onPreview = () => { calls++; return new Promise(done => { resolve = done; }); };
  const pending = ui.browseStage(-1);
  assert.equal(ui.stagePreviewBusy, true);
  await ui.browseStage(-1); assert.equal(calls, 1);
  resolve(false); await pending;
  assert.equal(ui.stagePreviewIndex, 1); assert.equal(ui.stagePreviewBusy, false);
  ui.modalKind = 'settings'; await ui.browseStage(-1); assert.equal(calls, 1); ui.modalKind = '';
  const stale = ui.browseStage(-1);
  ui.view = 'codex'; resolve(true); await stale;
  assert.equal(ui.stagePreviewIndex, 1, 'a left screen must not commit preview selection');
  ui.onPreview = async () => true;
  ui.showHome(); assert.equal(ui.stagePreviewBusy, false); assert.equal(ui.stagePreviewIndex, 1);
  ui.view = 'game'; await ui.browseStage(-1); assert.equal(ui.stagePreviewIndex, 1);
});

test('Codex hydrates cached model images after attaching its visible replacement DOM', () => {
  const {ui,document}=setup(),menu=document.getElementById('menu');
  menu.classList.add('hidden');menu.innerHTML='previous screen';
  ui.R.clearStatic=()=>{};ui.R.useModelPreview=()=>{};
  let hydrated=0;
  ui.onCachedModelThumbnails=root=>{
    assert.equal(root,menu);assert.equal(ui.view,'codex');
    assert.equal(menu.classList.contains('hidden'),false);
    assert.notEqual(menu.innerHTML,'previous screen');
    hydrated++;
  };
  ui.showCodex();assert.equal(hydrated,1);
  ui.showCodexModel('unit','rifle');assert.equal(hydrated,1,'live detail view does not hydrate tiles');
  ui.showCodex();assert.equal(hydrated,2,'returning from the live model hydrates the rebuilt list');
});

test('escaping converts values and protects HTML delimiters independently of screen wording', () => {
  const context = loadScripts(['ui-core']), esc = vm.runInContext('esc', context);
  for (const [input, expected] of [[null, ''], [undefined, ''], [42, '42'],
    ['<&>"\'', '&lt;&amp;&gt;&quot;&#39;'], ['&lt;', '&amp;lt;']])
    assert.equal(esc(input), expected);
});

test('opening HQ encounters keep faction → map → seed draw order with the landscape pool', () => {
  const h = setup();
  for (const depth of [0, 1, 2]) {
    const expected = vm.runInContext(`(() => {
      const random = seeded(1409), maps = ['alien-planet','mothership','westmark','frontier','haven'];
      return {mission: DEFAULT_MISSION, deployment: ${depth} === 0 ? 'resource-start' : 'exploration', enemies: expeditionEnemyFactions(${depth}, random),
        map: maps[Math.floor(random() * maps.length)], seed: 1 + Math.floor(random() * 99999999), next: random()};
    })()`, h.context);
    vm.runInContext('Math.random = seeded(1409);', h.context);
    const encounter = h.ui.createEncounter(depth, 'desert');
    assert.deepEqual(JSON.parse(JSON.stringify({...encounter, next: vm.runInContext('Math.random()', h.context)})),
      JSON.parse(JSON.stringify(expected)));
    assert.notEqual(encounter.map, 'aurelion');
  }
});

test('six expedition landscapes retain equal map weight, normal party counts and no immediate repeat', () => {
  const h = setup();
  for (const depth of [2,3,6,7]) {
    const found = new Set(), count = 6;
    for (let index=0;index<count;index++) {
      let draws=0;
      vm.runInContext('Math',h.context).random=()=>{draws++;return (index+.5)/count;};
      const e=h.ui.createEncounter(depth);
      found.add(e.map);
      assert.equal(e.mission,'hq-elimination');
      assert.equal(e.enemies.length,depth<3?1:depth<7?2:3);
      assert.equal(draws,(depth<3?0:e.enemies.length)+2,'no extra mission draw');
      assert.notEqual(h.ui.createEncounter(depth,e.map).map,e.map);
    }
    assert.equal(found.has('aurelion'),false); assert.equal(found.size,count);
  }
});

test('ordinary landscape encounters are checkpointed and continued without experiment settings',()=>{
  const h=setup(),saved=[];
  h.ui.profile.tutorialComplete=true;
  vm.runInContext('Math.random=()=>.99;',h.context);
  h.ui.view = 'battle';
  h.ui.persistence.saveProgress=(profile,value)=>saved.push(JSON.parse(JSON.stringify(value)));
  h.ui.game.start=options=>h.calls.push(['start',JSON.parse(JSON.stringify(options))]);
  h.ui.startBattle();
  assert.equal(saved[0].encounter.map,'haven');
  assert.equal(saved[0].encounter.mission,'hq-elimination');
  assert.equal(saved[0].encounter.deployment,'exploration');
  const first=h.calls.find(c=>c[0]==='start')[1];
  assert.equal(first.map,'haven');
  h.ui.showHome();h.ui.continueExpedition();
  const resumed=h.calls.filter(c=>c[0]==='start').at(-1)[1];
  assert.equal(resumed.map,first.map);assert.equal(resumed.seed,first.seed);
});
test('screen templates render frozen data without DOM access, randomness or profile mutation', () => {
  const context = loadScripts(['core', 'content', 'ui-core', 'ui-templates']);
  vm.runInContext('Math.random = seeded = () => { throw Error("Template RNG"); };', context);
  const render = vm.runInContext('({renderHomeScreen, renderMissionBriefing, renderExpeditionOpponents, renderBattleScreen, renderSettingsScreen, renderExpeditionUpgradeList})', context);
  const profile = Object.freeze({version: 2, expeditionDepth: 10,
    settings: Object.freeze({quality: 2, volume: .28, music: true, sfx: true, healthbars: false, showFps: true})});
  const expedition = Object.freeze({version: 8, battle: null, faction: 1, upgrades: Object.freeze({orbital:2}), abilities: Object.freeze(['orbital', 'repair', 'scan', 'drop']), depth: 10,
    enemyBenefits: Object.freeze([Object.freeze({}), Object.freeze({supplyCrate: 2}), Object.freeze({})]),
    benefits: Object.freeze({surveyDrones: 1}),
    encounter: Object.freeze({mission: 'hq-elimination', enemies: Object.freeze([2, 1, 2]), map: 'desert', seed: 1409})});
  const before = JSON.stringify({profile, expedition});
  render.renderMissionBriefing(expedition.encounter.mission);
  const briefing = render.renderExpeditionOpponents(expedition);
  assert.equal(briefing, render.renderExpeditionOpponents(expedition));
  render.renderHomeScreen(expedition, true, 'Desert');
  render.renderHomeScreen(null);
  const battle = render.renderBattleScreen(profile, 1, 1, 250, expedition.abilities);
  assert.equal((battle.match(/data-loadout-ability=/g) || []).length, 8);
  assert.equal((battle.match(/loadout-option active/g) || []).length, 4);
  assert.match(render.renderBattleScreen(profile, 1, 1, 250, expedition.abilities.slice(0, 3)),
    /data-ui="startBattle" disabled/);
  const settings = render.renderSettingsScreen(profile.settings);
  assert.match(settings, /data-setting="showFps" checked/);
  const totals=Object.freeze({upgrades:Object.freeze({orbital:2}),benefits:expedition.benefits});
  assert.equal(render.renderExpeditionUpgradeList(totals),render.renderExpeditionUpgradeList(totals));
  assert.equal(JSON.stringify({profile, expedition}), before);
});

test('victory offers direct travel without mutating the next encounter',()=>{
  const h=setup(),ui=h.ui;ui.factionJustUnlocked=null;
  ui.expedition={depth:1,upgrades:{},benefits:{},enemyBenefits:[],
    encounter:{map:'desert',seed:1409,mission:'hq-elimination',enemies:[]}};
  const before=JSON.stringify(ui.expedition);ui.showResult({win:true});
  assert.doesNotMatch(h.document.getElementById('result').innerHTML,/data-ui="continueExpedition" disabled/);
  assert.equal(JSON.stringify(ui.expedition),before);
});

test('opponent briefing maps active slots to their faction and benefit data', () => {
  const context = loadScripts(['core', 'content', 'ui-core', 'ui-templates']);
  const { renderExpeditionOpponents: renderOpponents, FACTIONS, expeditionBenefit } =
    vm.runInContext('({ renderExpeditionOpponents, FACTIONS, expeditionBenefit })', context);
  const expedition = {
    enemyBenefits: [{}, { supplyCrate: 2 }, { surveyDrones: 1 }],
    encounter: { enemies: [2, 1, 0] }
  };
  for (let count = 1; count <= 3; count++) {
    const html = renderOpponents({
      ...expedition,
      enemyBenefits: expedition.enemyBenefits.slice(0, count),
      encounter: { enemies: expedition.encounter.enemies.slice(0, count) }
    });
    for (const faction of expedition.encounter.enemies.slice(0, count))
      assert.ok(html.includes(FACTIONS[faction].short));
    for (const faction of expedition.encounter.enemies.slice(count))
      assert.ok(!html.includes(FACTIONS[faction].short));
    assert.equal(html.includes(expeditionBenefit('supplyCrate').name), count >= 2);
    assert.equal(html.includes(expeditionBenefit('surveyDrones').name), count >= 3);
  }
});

function setup() {
  const target = () => ({
    handlers: {}, firstChild: { textContent: '', remove() {} },
    style: {
      setProperty(key, value) { this[key] = value; },
      getPropertyValue(key) { return this[key] || ''; }
    }, classList: {
      names: new Set(), add(name) { this.names.add(name); }, remove(name) { this.names.delete(name); },
      contains(name) { return this.names.has(name); },
      toggle(name, on) { if (on) this.names.add(name); else this.names.delete(name); }
    },
    addEventListener(type, handler) { this.handlers[type] = handler; },
    setPointerCapture() {},
    setAttribute(key, value) { this[key] = value; },
    removeAttribute(key) { delete this[key]; },
    getAttribute(key) { return this[key] ?? null; },
    querySelector(selector) { return (this.parts ||= {})[selector] ||= target(); },
    querySelectorAll(selector) {
      assert.equal(selector, '[data-queue-type]');
      if (this.parsedHTML !== this.innerHTML) {
        this.parsedHTML = this.innerHTML;
        this.queueButtons = [...(this.innerHTML || '').matchAll(/data-queue-type="([^"]+)"/g)]
          .map(m => ({ ...target(), dataset: { queueType: m[1] } }));
      }
      return this.queueButtons || [];
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 180, height: 180 })
  });
  const elements = new Map();
  const document = { ...target(), activeElement: { tagName: 'BODY' }, querySelectorAll: () => [],
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, target());
        if (id === 'topbar') elements.get(id).getBoundingClientRect = () => ({ bottom: 55 });
        if (id === 'abilityBar') elements.get(id).getBoundingClientRect = () => ({ top: 590 });
      }
      return elements.get(id);
    }
  };
  const window = target();
  let now = 0;
  const context = loadScripts(['core', 'content', 'expedition', 'voice-content', ...BATTLEFIELD_SCRIPTS, 'world', ...SIMULATION_SCRIPTS, ...UI_SCRIPTS], { globals: {
    document, window, innerWidth: 1280, innerHeight: 800, performance: { now: () => now },
    formatTime: () => '00:00', matchMedia: () => ({ matches: true })
  } });
  const UI = vm.runInContext('MeridianUI', context), calls = [],
    definition = vm.runInContext('BATTLEFIELDS.desert', context);
  class TestUI extends UI {
    bind() {} updateHUD() {} drawMinimap() {}
    setMode(...args) { calls.push(['mode', ...args]); }
    perform(...args) { calls.push(['perform', ...args]); }
    setTab(...args) { calls.push(['tab', ...args]); }
    homeCamera() { calls.push(['base']); }
    select(ids) { this.selected = [...ids]; calls.push(['select', [...ids]]); }
    pick() { return null; }
    openModal() {}
  }
  const game = {
    localTeam: 0,
    visible: () => true,
    observed: vm.runInContext('MeridianGame.prototype.observed', context),
    world: { extent: 90, gridSize: 72, cellSize: 2.5, idx: () => 0, explored: new Uint8Array([1]),
      seed: 1409, terrainSeed: 1409, definition, renderProfile: definition.render },
    s: { rules: { kind: 'single-player', mission: { id: 'hq-elimination' } },
      cam: { x: 0, z: 0, zoom: 50 }, time: 0, speed: 1, entities: [],
      parties: [{id:0,faction:0,loadout:['orbital','repair','scan','drop'],meta:{},benefits:{},controller:{kind:'human'},account:{alloy:0,gas:0,energy:100,abilities:{}}}] },
    snapshotBattle(archiveVictory = false) {
      const state = JSON.parse(JSON.stringify(this.s));
      if (archiveVictory) { state.result = null; state.rules.completed = true; }
      return {version:1,state,tutorial:null};
    },
    effects: { floats: [] }, canSupplyForum: () => false, canBuild: () => '', cost: () => ({ cost: 0, gas: 0 }),
    recruitmentReason: () => '', abilityRequirement: () => '', afford: () => true,
    alive(predicate) { return this.s.entities.filter(predicate); },
    availableProducers: vm.runInContext('MeridianGame.prototype.availableProducers', context),
    workerTask: vm.runInContext('MeridianGame.prototype.workerTask', context),
    cap: vm.runInContext('MeridianGame.prototype.cap', context),
    supply: vm.runInContext('MeridianGame.prototype.supply', context),
    availableWorkers: () => [{}],
    get(id) { return this.s.entities.find(e => e.id === id && e.hp !== 0); },
    managedBuilding(id) { const b = this.get(id); return !this.s.result && b?.kind === 'building' && b.team === 0 && b.hp > 0 && b.progress >= 1 ? b : null; },
    buildingRepairers: () => [], canRepairBuilding: () => '', canSellBuilding: () => '',
    party: vm.runInContext('MeridianGame.prototype.party', context),
    account: vm.runInContext('MeridianGame.prototype.account', context),
    has: vm.runInContext('MeridianGame.prototype.has', context),
    factionFor: vm.runInContext('MeridianGame.prototype.factionFor', context),
    abilityStats: vm.runInContext('MeridianGame.prototype.abilityStats', context),
    command(...args) { calls.push(['command', ...args]); },
    // UI tests mock submission/execution; scheduling and permission checks have separate CPU tests.
    submitAction(team, action) { return this.executeAction(team, action); },
    executeAction(team, action) {
      assert.equal(team, 0, 'single-player UI supplies its actor outside the payload');
      switch (action.kind) {
        case 'order': return this.command(action.ids, action.order);
        case 'train': return action.producerId === undefined ? this.train(action.unit) : this.train(action.unit, team, action.producerId);
        case 'build': return this.build(action.building, action.position, action.selected);
        case 'ability': return this.ability(action.ability, action.position);
        case 'cancelConstruction': return this.cancelConstruction(action.id);
        case 'cancelQueue': return this.cancelQueue(action.id, action.index);
        case 'toggleRepair': return this.toggleBuildingRepair(action.id);
        case 'sell': return this.sellBuilding(action.id);
        case 'configureSettlementUpgrade':
        case 'expandSettlementBuilding': calls.push(['action',team,JSON.parse(JSON.stringify(action))]);return true;
        case 'rotateBuilding':
        case 'rally': return vm.runInContext('MeridianGame.prototype.executeAction', context).call(this, team, action);
        default: assert.fail(`Unexpected UI action: ${action.kind}`);
      }
    },
    notify(team, ...event) { assert.equal(team, 0); ui.event(...event); }
  };
  const ui = new TestUI(game, {
    viewport: { left: 0, top: 55, right: 1280, bottom: 590, width: 1280, height: 535 },
    containsPoint(x, y) { const v = this.viewport; return x > v.left && x < v.right && y > v.top && y < v.bottom; },
    ground: (x, y) => ({ x: x / 10, z: y / 10 }),
    project: (x, y, z) => ({ x, y: z })
  },
    { unlock() {}, sound() {} }, { expeditionDepth: 0, tutorialComplete: false, settings: { quality: 2 } },
    { expeditionError: null, saveProfile() {}, saveProgress() { return true; },
      loadStageHistory(e) { if (!e) return []; return [...(e.worlds || []).map(w=>({stage:w.stage,map:w.map,seed:w.seed})),
        {stage:e.depth+1,map:e.encounter.map,seed:e.encounter.seed}]; } });
  ui.view = 'game'; ui.paused = false;
  const world = document.getElementById('world'), minimap = document.getElementById('minimap');
  const pointer = (type, x, y, options = {}) => {
    const event = { pointerType: 'touch', pointerId: 1, button: 0, clientX: x, clientY: y,
      target: world, preventDefault() {}, ...options };
    (event.target.handlers[type])(event);
  };
  const click = dataset => document.handlers.click({ target: { closest: () => ({ dataset }) } });
  const clickCamera = cam => click({ cam });
  return { context, ui, calls, document, window, world, minimap, pointer, click, clickCamera, UI, setTime(value) { now = value; } };
}

test('storage failures notify once on writes or later ticks and remain visible in settings', () => {
  const startup = setup();
  const uiAtStartup = new startup.UI(startup.ui.game, startup.ui.R, startup.ui.audio,
    startup.ui.profile, { available: false });
  assert.equal(uiAtStartup.storageWarningShown, true);
  assert.ok(startup.document.getElementById('toast').classList.contains('show'));
  for (const failurePath of ['write', 'read']) {
    const h = setup(), ui = h.ui, notices = [];
    ui.toast = text => notices.push(text);
    ui.persistence.available = true;
    ui.notifyStorageFailure(); assert.equal(notices.length, 0);
    if (failurePath === 'write') {
      ui.persistence.saveProfile = () => { ui.persistence.available = false; return false; };
      ui.persist();
    } else {
      ui.persistence.available = false;
      ui.view = 'home'; ui.tick(0);
    }
    assert.equal(notices.length, 1);
    assert.ok(ui.toastUntil > 3500, 'storage failure is not just a brief action toast');
    ui.notifyStorageFailure(); ui.persist();
    assert.equal(notices.length, 1, 'no repeated warnings on every tick or setting write');
    ui.openModal = (kind, html) => h.calls.push([kind, html]);
    ui.showSettings();
    assert.match(h.calls.at(-1)[1], /role="status"/);
    ui.persistence.available = true; ui.showSettings();
    assert.doesNotMatch(h.calls.at(-1)[1], /role="status"/);
  }
});

test('refinery screen targeting uses the explored vent behind terrain, including overlapping units', () => {
  for (const pointerType of ['mouse','touch']) {
    const h=setup(), ui=h.ui;
    ui.pick=h.UI.prototype.pick.bind(ui);
    ui.R.project=(x,y,z)=>({x:400+x*2,y:300+z*2-y*10});
    // The screen ray strikes the foreground mountain far outside the vent's 6 m range.
    const mountain={x:-30,z:-40};ui.R.ground=()=>({...mountain});
    const vent={id:7,kind:'resource',type:'gas',team:-1,hp:100,size:2,x:20,z:30},
      unit={id:8,kind:'unit',type:'hero',team:0,hp:100,size:2,x:20,z:30};
    ui.game.s.entities=[unit,vent];
    const screen=ui.R.project(vent.x,1,vent.z);
    assert.equal(ui.pick(screen.x,screen.y).id,unit.id,'normal selection still prioritizes the overlapping unit');
    ui.mode={kind:'build',arg:'refinery'};
    assert.deepEqual({...ui.targetPosition(screen.x,screen.y)},{x:20,z:30});
    ui.game.build=(type,p)=>{h.calls.push(['build',type,{...p}]);return false;};
    h.UI.prototype.bind.call(ui);
    h.pointer('pointerdown',screen.x,screen.y,{pointerType});h.pointer('pointerup',screen.x,screen.y,{pointerType});
    assert.deepEqual(h.calls.filter(c=>c[0]==='build'),[['build','refinery',{x:20,z:30}]]);
    assert.equal(ui.mode.arg,'refinery','a failed validation keeps the placement mode');
    ui.game.world.explored[0]=0;
    assert.deepEqual({...ui.targetPosition(screen.x,screen.y)},mountain,'unexplored vent is not a target');
    ui.game.world.explored[0]=1;vent.hp=0;
    assert.deepEqual({...ui.targetPosition(screen.x,screen.y)},mountain,'dead vent is not a target');
    vent.hp=100;
    for(const mode of [null,{kind:'build',arg:'depot'},{kind:'ability',arg:'orbital'},{kind:'rally'}]) {
      ui.mode=mode;assert.deepEqual({...ui.targetPosition(screen.x,screen.y)},mountain,'other modes retain terrain picking');
    }
    ui.mode={kind:'build',arg:'refinery'};
    assert.deepEqual({...ui.targetPosition(screen.x+100,screen.y)},mountain,'off-silhouette taps retain terrain picking');
    assert.deepEqual({...vent},{id:7,kind:'resource',type:'gas',team:-1,hp:100,size:2,x:20,z:30},'view resolution does not mutate authority');
  }
});

test('expedition loadout selection keeps four unique ordered slots and locks an active run', () => {
  const h = setup(); h.ui.view = 'battle'; h.ui.expedition = null;
  assert.deepEqual(Array.from(h.ui.battleAbilities), ['orbital', 'repair', 'scan', 'drop']);
  h.ui.selectBattleAbility('orbital');
  h.ui.selectBattleAbility('disruption');
  h.ui.selectBattleAbility('bulwark');
  assert.deepEqual(Array.from(h.ui.battleAbilities), ['repair', 'scan', 'drop', 'disruption']);
  h.ui.selectBattleAbility('scan'); h.ui.selectBattleAbility('bulwark');
  assert.deepEqual(Array.from(h.ui.battleAbilities), ['repair', 'drop', 'disruption', 'bulwark']);
  h.ui.expedition = { abilities: [...h.ui.battleAbilities] };
  h.ui.view = 'game';
  h.ui.selectBattleAbility('repair');
  h.ui.selectBattleAbility('recall');
  assert.deepEqual(Array.from(h.ui.battleAbilities), ['repair', 'drop', 'disruption', 'bulwark']);
});

test('new expedition modules remain editable with an existing checkpoint without changing the saved run', () => {
  const h = setup(), ui = h.ui;
  // Controller metadata is mutable; editing must still leave this existing recipe untouched.
  const expedition = { version: 8, battle: null, faction: 0, depth: 2, upgrades: {},
    abilities: Object.freeze(['orbital', 'repair', 'scan', 'drop']),
    benefits: Object.freeze({}), enemyBenefits: Object.freeze([Object.freeze({})]),
    encounter: Object.freeze({ mission: 'hq-elimination', enemies: Object.freeze([2]), map: 'desert', seed: 1409 }) };
  const before = JSON.stringify(expedition);
  ui.expedition = expedition;
  ui.persistence.saveProgress = () => { throw Error('Loadout editing must not save or discard a run'); };
  ui.uiAction('battle');
  ui.selectBattleAbility('orbital');
  assert.deepEqual(Array.from(ui.battleAbilities), ['repair', 'scan', 'drop']);
  ui.selectBattleAbility('disruption');
  assert.deepEqual(Array.from(ui.battleAbilities), ['repair', 'scan', 'drop', 'disruption']);
  assert.strictEqual(ui.expedition, expedition);assert.equal(JSON.stringify(expedition),before);
  ui.game.start = options => h.calls.push(['start', options]);
  ui.continueExpedition();
  const options = h.calls.at(-1)[1];
  assert.deepEqual(Array.from(options.abilities), ['orbital', 'repair', 'scan', 'drop']);
  assert.equal(options.seed, 1409);assert.equal(JSON.stringify(expedition),before);
});

test('module selection updates existing controls without replacing the screen or losing focus and scroll', () => {
  const h = setup(), ui = h.ui, menu = h.document.getElementById('menu');
  ui.showBattle();
  const buttons = ['orbital', 'repair', 'scan', 'drop', 'disruption'].map(key => {
    const button = menu.querySelector(key);
    button.dataset = { loadoutAbility: key };
    return button;
  });
  h.document.querySelectorAll = selector => {
    assert.equal(selector, '#menu [data-loadout-ability]');
    return buttons;
  };
  const focused = buttons[0], start = menu.querySelector('[data-ui="startBattle"]');
  h.document.activeElement = focused;
  menu.scrollTop = 120;
  const markup = menu.innerHTML;
  Object.defineProperty(menu, 'innerHTML', { get: () => markup,
    set: () => { throw Error('Module selection must not replace the screen'); } });
  ui.showBattle = () => { throw Error('Module selection must not reopen the screen'); };
  ui.selectBattleAbility('orbital');
  assert.equal(buttons[0].getAttribute('aria-pressed'), 'false');
  assert.equal(buttons[0].querySelector('.loadout-slot').textContent, '');
  assert.equal(buttons[1].querySelector('.loadout-slot').textContent, '1');
  assert.equal(start.disabled, true);
  ui.selectBattleAbility('disruption');
  assert.equal(buttons[4].getAttribute('aria-pressed'), 'true');
  assert.equal(buttons[4].classList.contains('active'), true);
  assert.equal(buttons[4].querySelector('.loadout-slot').textContent, '4');
  assert.equal(start.disabled, false);
  assert.equal(parseInt(menu.querySelector('.loadout-picker-heading > span').textContent), 4);
  assert.strictEqual(h.document.activeElement, focused);
  assert.equal(menu.scrollTop, 120);
});

test('FPS setting updates the readout immediately and remains a profile setting', () => {
  const h = setup(), readout = h.document.getElementById('fpsReadout');
  h.ui.profile.settings.showFps = false;
  h.ui.audio.updateSettings = () => {};
  h.ui.applySetting({ dataset: { setting: 'showFps' }, type: 'checkbox', checked: true });
  assert.equal(h.ui.profile.settings.showFps, true);
  assert.equal(readout.classList.contains('hidden'), false);
  h.ui.applySetting({ dataset: { setting: 'showFps' }, type: 'checkbox', checked: false });
  assert.equal(h.ui.profile.settings.showFps, false);
  assert.equal(readout.classList.contains('hidden'), true);
});

test('UI submits actor-bound action data and cannot set rally when execution rejects it', () => {
  const h = setup(), actions = [];
  h.ui.game.executeAction = (team, action) => { actions.push(JSON.parse(JSON.stringify([team, action]))); return false; };
  h.ui.game.s.entities = [{ id: 7, team: 0, kind: 'building', type: 'hq', hp: 100, progress: 1 }];
  h.ui.selected = [7]; h.ui.mode = { kind: 'rally' };
  h.ui.applyTarget({ x: 12, z: 23 });
  assert.equal(h.ui.game.get(7).rally, undefined);
  assert.equal(h.ui.mode.kind, 'rally', 'rejection keeps targeting active');
  h.ui.issueOrder([7], { type: 'hold' });
  h.UI.prototype.perform.call(h.ui, 'train:worker');
  assert.deepEqual(actions, [
    [0, { kind: 'rally', ids: [7], position: { x: 12, z: 23 } }],
    [0, { kind: 'order', ids: [7], order: { type: 'hold' } }],
    [0, { kind: 'train', unit: 'worker' }]
  ]);
});

test('scenario UI perspective resets local interaction, follows actor accounts and routes commands to that actor', () => {
  const h = setup(), g = h.ui.game, queries = [], actions = [];
  g.s.parties = Array.from({ length: 4 }, (_, id) => ({ id, faction: id % 3,
    loadout: ['orbital', 'repair', 'scan', 'drop'], meta: {}, benefits: {},
    account: { alloy: 100 + id, gas: 200 + id, energy: 20 + id, abilities: {} } }));
  g.s.entities = [{ id: 7, team: 2, type: 'hq', kind: 'building', hp: 100, progress: 1, x: 20, z: 10, queue: [] }];
  g.supply = team => { queries.push(['supply', team]); return 3; };
  g.cap = team => { queries.push(['cap', team]); return 10; };
  g.setPerspective = team => { g.localTeam = team; return true; };
  g.executeAction = (team, action) => { actions.push([team, JSON.parse(JSON.stringify(action))]); return true; };
  h.ui.setTab = h.UI.prototype.setTab;
  h.ui.homeCamera = h.UI.prototype.homeCamera;
  h.ui.updateHUD = h.UI.prototype.updateHUD;
  h.ui.selected = [99]; h.ui.hover = 99; h.ui.mode = { kind: 'rally' };
  h.ui.drag = { x: 1 }; h.ui.lastClick = { id: 99 }; h.ui.pings = [{ x: 1, z: 1 }];
  h.ui.touchPoints.set(1, { x: 1, y: 1 }); h.ui.touchGesture = true;
  h.ui.queueSignature = 'worker'; h.document.getElementById('productionQueue').innerHTML = 'old party queue';
  assert.equal(h.ui.setPerspective(2), true);
  assert.equal(h.document.getElementById('productionQueue').innerHTML, '');
  assert.deepEqual(Array.from(h.ui.selected), []); assert.equal(h.ui.hover, null); assert.equal(h.ui.mode, null);
  assert.equal(h.ui.drag, null); assert.equal(h.ui.touchPoints.size, 0); assert.equal(h.ui.pings.length, 0);
  assert.deepEqual([g.s.cam.x, g.s.cam.z], [24, 8]);
  assert.equal(h.document.getElementById('alloyCount').textContent, '102');
  assert.equal(h.document.getElementById('gasCount').textContent, '202');
  assert.equal(h.document.getElementById('energyCount').textContent, '22');
  assert.deepEqual(queries, [['supply', 2], ['cap', 2]]);
  h.ui.issueOrder([7], { type: 'hold' });
  assert.deepEqual(actions, [[2, { kind: 'order', ids: [7], order: { type: 'hold' } }]]);
  assert.match(h.ui.actionButton('build:hq', 'HQ', 'hq'), /data-model-faction="2" data-model-kind="building" data-model-type="hq"/);
  h.ui.modalKind = 'sell'; assert.equal(h.ui.setPerspective(3), false); assert.equal(g.localTeam, 2);
});

test('picking samples each observed entity height once and shares it with all radius projections', () => {
  const h=setup(),g=h.ui.game,samples=[],projections=[];
  g.s.entities=[
    {id:1,kind:'building',type:'hq',team:0,hp:100,x:200,z:200,size:4},
    {id:2,kind:'unit',type:'rifle',team:0,hp:100,x:200,z:200,size:1},
    {id:3,kind:'unit',type:'rifle',team:1,hp:100,x:200,z:200,size:1}
  ];
  g.observed=e=>e.team===0;
  g.world.surface={entityHeight(e){samples.push(e.id);return e.id*3;}};
  h.ui.R.project=(x,y,z)=>{projections.push([x,y,z]);return {x,y:z};};
  assert.equal(h.UI.prototype.pick.call(h.ui,200,200).id,2,'unit still wins the overlapping selection');
  assert.deepEqual(samples,[1,2],'unobserved entities remain unsampled');
  assert.deepEqual(projections.map(p=>p[1]),[5,5,5,7,7,7]);
});

test('nonzero perspective selection and picking hide foreign units and select only its own combat force', () => {
  const h = setup(), g = h.ui.game;
  g.localTeam = 2;
  g.visible = e => e.team === 2;
  g.s.entities = [
    { id: 1, team: 0, type: 'rifle' }, { id: 2, team: 1, type: 'rifle' },
    { id: 3, team: 2, type: 'rifle' }, { id: 4, team: 3, type: 'rifle' },
    { id: 5, team: 2, type: 'worker' }
  ].map(e => ({ ...e, kind: 'unit', hp: 100, x: 200, z: 200, size: 1 }));
  assert.equal(h.UI.prototype.pick.call(h.ui, 200, 200).team, 2);
  h.UI.prototype.select.call(h.ui, [1, 2, 3, 4]);
  assert.deepEqual(Array.from(h.ui.selected), [3]);
  h.UI.prototype.bind.call(h.ui);
  assert.equal(h.document.getElementById('combatSelectBtn').onclick, undefined);
  g.s.entities.push({ id: 6, team: 2, kind: 'building', type: 'hq', hp: 100, queue: [{ type: 'worker', time: 10, progress: 0 }] });
  g.s.entities.push({ id: 7, team: 0, kind: 'building', type: 'hq', hp: 100, queue: [{ type: 'rifle', time: 10, progress: 0 }] });
  assert.deepEqual(Object.keys(h.ui.recruitmentGroups()), ['worker']);
});

test('each battle start resets the music playlist before playback, but resume does not', () => {
  const h = setup(), calls = [];
  h.ui.profile.tutorialComplete = true;
  h.ui.audio.resetBattleMusic = () => calls.push('reset');
  h.ui.audio.setMode = mode => calls.push(mode);
  h.ui.event('start', {});
  assert.deepEqual(calls, ['reset', 'battle']);
  h.ui.pause(); h.ui.resume();
  assert.ok(calls.includes('silent'));
  assert.deepEqual(calls.filter(value => value !== 'silent'), ['reset', 'battle', 'battle']);
  h.ui.event('start', {});
  assert.deepEqual(calls.slice(-2), ['reset', 'battle']);
  assert.equal(calls.filter(value => value === 'reset').length, 2);
});

test('tutorial begins with worker arrival and HQ placement, then locks only controls for a round-trip camera flight', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  h.ui.game.s.depth = 0;
  h.ui.alert = () => {};
  const spoken = [];
  h.ui.audio.playVoice = id => spoken.push(id);
  h.ui.game.s.rules = { kind: 'single-player', mission: { id: 'hq-elimination' } };
  h.ui.game.s.entities = [
    { id: 3, team: 0, kind: 'unit', type: 'worker', hp: 100, x: -69, z: 46, queue: [] },
    { id: 2, team: 1, kind: 'building', type: 'hq', hp: 100, x: 80, z: -70, progress: 1, queue: [] }
  ];
  const explored = Array.from(h.ui.game.world.explored);
  h.ui.event('start', {});
  assert.equal(h.ui.battleTutorial.step, 'arrival');
  assert.equal(h.ui.paused, false);
  assert.equal(h.ui.controlsLocked, true);
  assert.notEqual(h.ui.game.s.cam.z, 0, 'arrival begins with the camera looking ahead of the worker');
  h.ui.advanceTutorialArrival(3);
  assert.deepEqual(h.ui.game.s.cam, { x: 0, z: 0, zoom: 50 });
  assert.equal(h.ui.battleTutorial.step, 'buildHQ');
  assert.deepEqual(spoken, ['tutorial.settle']);
  assert.equal(h.ui.controlsLocked, false);
  assert.equal(h.ui.tutorialAction(), 'tab:build');
  h.ui.game.s.entities.push({ id: 1, team: 0, kind: 'building', type: 'hq', hp: 100,
    x: -60, z: 50, progress: 1, queue: [] });
  h.ui.advanceBattleTutorial('complete', 'hq');
  assert.equal(h.ui.battleTutorial.step, 'recon');
  assert.equal(h.ui.paused, false, 'simulation clock remains enabled');
  assert.equal(h.ui.controlsLocked, true);
  assert.equal(h.ui.introObserves(h.ui.game.s.entities[1]), true);
  const camera = { ...h.ui.game.s.cam };
  h.clickCamera('home'); h.clickCamera('in');
  h.pointer('pointerdown', 200, 200); h.pointer('pointerup', 200, 200);
  h.ui.perform('train:worker');
  assert.deepEqual(h.ui.game.s.cam, camera);
  assert.equal(h.ui.drag, null);
  h.ui.advanceBattleIntro(1.25);
  assert.deepEqual(h.ui.game.s.cam, { x: -56, z: 48, zoom: 50 });
  h.ui.advanceBattleIntro(3.75);
  assert.deepEqual(spoken, ['tutorial.settle', 'tutorial.warning']);
  assert.deepEqual(h.ui.game.s.cam, { x: flatCameraLimits(h.ui).x, z: -72, zoom: 50 });
  h.ui.advanceBattleIntro(4);
  assert.deepEqual(h.ui.game.s.cam, { x: flatCameraLimits(h.ui).x, z: -72, zoom: 50 });
  h.ui.advanceBattleIntro(2.5);
  assert.deepEqual(h.ui.game.s.cam, { x: -56, z: 48, zoom: 50 });
  assert.equal(h.ui.battleIntro, null);
  assert.equal(h.ui.battleTutorial.step, 'trainWorker');
  assert.equal(h.ui.controlsLocked, false);
  assert.deepEqual(Array.from(h.ui.game.world.explored), explored);
});

test('tutorial speed hint starts at HQ construction and expires without a click or simulation-time dependency', () => {
  const h = setup(), ui = h.ui, s = ui.game.s;
  s.depth = 0;
  ui.beginBattleTutorial();
  const button = h.document.getElementById('speedBtn'), hint = h.document.getElementById('speedHint');
  ui.updateTutorialSpeedHint(100);
  assert.equal(button.classList.contains('tutorial-focus'), false);
  s.entities.push({ id: 1, team: 1, type: 'hq', kind: 'building', progress: 0 });
  ui.updateTutorialSpeedHint(200);
  assert.equal(button.classList.contains('tutorial-focus'), false, 'enemy HQ does not trigger hint');
  s.entities.push({ id: 2, team: 0, type: 'hq', kind: 'building', progress: 0 });
  ui.updateTutorialSpeedHint(300);
  assert.equal(button.classList.contains('tutorial-focus'), true);
  assert.equal(hint.classList.contains('hidden'), false);
  assert.equal(button.getAttribute('aria-describedby'), 'speedHint');
  s.speed = 3; s.time = 100;
  ui.updateTutorialSpeedHint(5299);
  assert.equal(button.classList.contains('tutorial-focus'), true);
  ui.updateTutorialSpeedHint(5300);
  assert.equal(button.classList.contains('tutorial-focus'), false);
  assert.equal(hint.classList.contains('hidden'), true);
  assert.equal(button.getAttribute('aria-describedby'), null);
  ui.updateTutorialSpeedHint(6000);
  assert.equal(button.classList.contains('tutorial-focus'), false, 'no repeated hint while construction continues');
  assert.equal(ui.battleTutorial.step, 'buildHQ', 'hint does not advance or gate tutorial goals');
  ui.battleTutorial.speedHintUntil = 12000;
  ui.view = 'home'; ui.updateTutorialSpeedHint(7000);
  assert.equal(hint.classList.contains('hidden'), true);
  ui.view = 'game'; ui.battleTutorial = null; ui.updateTutorialSpeedHint(8000);
  assert.equal(button.classList.contains('tutorial-focus'), false);
});

test('tutorial camera targets compensate terrain height along the viewing axis', () => {
  const h = setup(), s = h.ui.game.s;
  s.depth = 0;
  s.rules = { kind: 'single-player', mission: { id: 'hq-elimination' } };
  s.cam = { x: -55, z: 48, zoom: 50, yaw: 0 };
  const worker = { id: 3, team: 0, kind: 'unit', type: 'worker', hp: 100, x: -60, z: 50 };
  const home = { id: 1, team: 0, kind: 'building', type: 'hq', hp: 100, x: -60, z: 50, progress: 1 };
  const enemy = { id: 2, team: 1, kind: 'building', type: 'hq', hp: 100, x: 60, z: -50, progress: 1 };
  s.entities = [worker, home, enemy];
  h.ui.game.world.surface = { maxHeight: 22, heightAt:()=>22, entityHeight: e => e.team === 0 ? 11 : 22 };
  const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
  assert.equal(h.ui.beginBattleTutorial(), true);
  close(s.cam.z, -8.2);
  h.ui.advanceTutorialArrival(3);
  close(s.cam.z, 48 - 8.2);
  assert.equal(s.cam.x, -55);
  assert.equal(h.ui.beginTutorialRecon(), true);
  h.ui.advanceBattleIntro(1.25);
  close(s.cam.z, home.z - 2 - 8.2);
  h.ui.advanceBattleIntro(3.75);
  close(s.cam.z, enemy.z - 2 - 16.4);
  h.ui.advanceBattleIntro(6.5);
  close(s.cam.z, home.z - 2 - 8.2);
  s.cam.yaw = Math.PI / 2;
  const rotated = h.ui.terrainCameraPoint(home, 11);
  close(rotated.x, home.x - 8.2);
  close(rotated.z, home.z);
  const edge = h.ui.terrainCameraPoint({ x: -90, z: 0 }, 22);
  close(edge.x, -flatCameraLimits(h.ui).z - 16.4);
  close(edge.z, 0);
});

test('resource-adjacent deployment belongs only to the first tutorial, not every new stage-one run', () => {
  const h = setup();
  for (const [depth, best, complete, expected] of [[0,0,false,'resource-start'], [0,0,true,'exploration'],
    [0,1,false,'exploration'], [1,0,false,'exploration']]) {
    h.ui.profile.expeditionDepth = best; h.ui.profile.tutorialComplete = complete;
    assert.equal(h.ui.createEncounter(depth).deployment, expected);
  }
});

test('later stages skip the stage-one camera introduction', () => {
  const h = setup();
  h.ui.game.s.depth = 1;
  h.ui.game.s.rules = { kind: 'single-player', mission: { id: 'hq-elimination' } };
  h.ui.game.s.entities = [
    { id: 1, team: 0, kind: 'building', type: 'hq', hp: 100, x: -60, z: 50 },
    { id: 2, team: 1, kind: 'building', type: 'hq', hp: 100, x: 80, z: -70 }
  ];
  h.ui.event('start', {});
  assert.equal(h.ui.battleIntro, null);
  assert.equal(h.ui.paused, false);
  assert.deepEqual(h.ui.game.s.cam, { x: 0, z: 0, zoom: 50 });
});

test('non-tutorial starts compensate worker height without changing zoom or running a camera introduction', () => {
  for (const [depth,complete,faction] of [[1,false,0],[0,true,0],[0,false,1]]) {
    const h=setup(),s=h.ui.game.s;
    s.depth=depth;s.rules={kind:'single-player',mission:{id:'hq-elimination'}};
    s.parties[0].faction=faction;h.ui.profile.tutorialComplete=complete;
    s.cam={x:-25,z:48,zoom:57,yaw:0};
    s.entities=[{id:3,team:0,kind:'unit',type:'worker',hp:100,x:-30,z:50}];
    h.ui.game.world.surface={entityHeight:()=>20};
    h.ui.battleIntro={kind:'recon'}; // A previous introduction must not block centering.
    h.ui.event('start',{});
    assert.equal(h.ui.battleTutorial,null);assert.equal(h.ui.battleIntro,null);
    assert.equal(s.cam.x,-25);assert.ok(Math.abs(s.cam.z-(48-20*.82/1.1))<1e-9);
    assert.equal(s.cam.zoom,57);assert.equal(s.cam.yaw,0);assert.deepEqual(h.calls,[]);
  }
});

test('home camera compensates HQ or worker height along the current yaw and retains limits', () => {
  const h=setup(),s=h.ui.game.s;
  h.ui.homeCamera=h.UI.prototype.homeCamera;
  h.ui.game.alive=predicate=>s.entities.filter(e=>e.hp>0&&predicate(e));
  const worker={id:3,team:0,kind:'unit',type:'worker',hp:100,x:-30,z:20},
    hq={id:4,team:0,kind:'building',type:'hq',hp:100,x:10,z:30};
  s.entities=[worker,hq];h.ui.game.world.surface={maxHeight:20,heightAt:()=>20,entityHeight:e=>e.type==='hq'?20:10};
  for(const yaw of [0,Math.PI/2,-Math.PI/4]) {
    s.cam.yaw=yaw;h.ui.homeCamera();
    assert.ok(Math.abs(s.cam.x-(14-Math.sin(yaw)*20*.82/1.1))<1e-9);
    assert.ok(Math.abs(s.cam.z-(28-Math.cos(yaw)*20*.82/1.1))<1e-9);
  }
  hq.hp=0;s.cam.yaw=Math.PI/2;h.ui.homeCamera();
  assert.ok(Math.abs(s.cam.x-(-26-10*.82/1.1))<1e-9);assert.equal(s.cam.z,18);
  worker.x=-200;h.ui.homeCamera();assert.ok(Math.abs(s.cam.x-(-flatCameraLimits(h.ui).z-20*.82/1.1))<1e-9);
  const before={...s.cam};h.ui.paused=true;worker.z=40;h.ui.homeCamera();
  assert.deepEqual(s.cam,before,'pause still guards the home button');
  assert.deepEqual(h.calls,[]);
});

test('first-stage tutorial highlights workers, economy, infantry to the supply limit and a completed depot', () => {
  const h = setup(), actions = h.document.getElementById('actions'), saved = [], spoken = [];
  h.ui.radioLine = id => spoken.push(id);
  h.ui.setTab = h.UI.prototype.setTab;
  h.ui.alert = () => {};
  h.ui.persistence.saveProfile = profile => { saved.push(JSON.parse(JSON.stringify(profile))); return true; };
  h.ui.game.s.depth = 0;
  h.ui.game.s.rules = { kind: 'single-player', mission: { id: 'hq-elimination' } };
  h.ui.game.s.entities = [];
  const focused = action => new RegExp(`class="[^"]*tutorial-focus[^"]*" data-action="${action}"`).test(actions.innerHTML);

  assert.equal(h.ui.beginBattleTutorial(), true);
  h.ui.renderActions();
  assert.equal(focused('tab:build'), true);
  h.ui.setTab('build');
  assert.equal(focused('build:hq'), true);
  h.ui.advanceBattleTutorial('complete', 'hq');
  assert.equal(focused('favorite:worker'), true);
  assert.match(vm.runInContext("voiceLine('tutorial.economy').text", h.context), /worker icon in quick access/);
  const producer = { id: 10, team: 0, kind: 'building', type: 'hq', hp: 100, progress: 1,
    queue: [{ type: 'worker' }] };
  h.ui.game.s.entities.push(producer);
  h.ui.renderActions();
  assert.equal(focused('favorite:worker'), true, 'the prompt remains until the second Prospector is ordered');
  producer.queue.push({ type: 'worker' });
  h.ui.renderActions();
  assert.equal(actions.innerHTML.includes('tutorial-focus'), false, 'two queued Prospectors satisfy the ordering prompt');
  producer.queue.pop();
  h.ui.renderActions();
  assert.equal(focused('favorite:worker'), true, 'cancelling the second order restores its prompt');
  producer.queue = [];

  h.ui.event('trained', { type: 'worker' });
  assert.equal(h.ui.tab, 'root');
  assert.equal(focused('favorite:worker'), true, 'the second Prospector is requested after the first finishes');
  h.ui.event('trained', { type: 'worker' });
  assert.equal(h.ui.tab, 'root');
  assert.equal(focused('tab:build'), true);
  h.ui.setTab('build');
  assert.equal(focused('build:refinery'), true);
  const foundation = { id: 11, team: 0, kind: 'building', type: 'refinery', hp: 100, progress: .2, queue: [] };
  h.ui.game.s.entities.push(foundation);
  h.ui.renderActions();
  assert.equal(actions.innerHTML.includes('tutorial-focus'), false, 'placed foundation waits for completion');
  h.ui.game.s.entities = h.ui.game.s.entities.filter(e => e !== foundation);
  h.ui.renderActions();
  assert.equal(focused('build:refinery'), true, 'cancelled foundation restores its prompt');

  h.ui.event('complete', { type: 'refinery', x: 1, z: 2 });
  assert.equal(h.ui.tab, 'build');
  assert.equal(focused('build:barracks'), true);
  h.ui.event('complete', { type: 'barracks', x: 1, z: 2 });
  assert.equal(h.ui.tab, 'root');
  assert.equal(focused('tab:infantry'), true);
  h.ui.setTab('infantry');
  assert.equal(focused('train:rifle'), true);

  const barracks = { id: 12, team: 0, kind: 'building', type: 'barracks', hp: 100, progress: 1, queue: [] };
  h.ui.game.s.entities.push(barracks, ...Array.from({ length: 3 }, (_, i) =>
    ({ id: 20 + i, team: 0, kind: 'unit', type: 'worker', hp: 100 })));
  const recruit = () => {
    h.ui.game.s.entities.push({ id: h.ui.game.s.entities.length + 100, team: 0, kind: 'unit', type: 'rifle', hp: 100 });
    h.ui.event('trained', { type: 'rifle' });
  };
  recruit();
  assert.equal(h.ui.battleTutorial.step, 'trainRifle', 'one squad no longer finishes the tutorial');
  assert.equal(focused('train:rifle'), true);
  assert.equal(h.ui.profile.tutorialComplete, false);
  barracks.queue.push({ type: 'rifle' });
  h.ui.renderActions();
  assert.equal(focused('train:rifle'), true, 'a queued squad does not hide further recruitment while supply remains');
  barracks.queue = [];
  for (let i = 0; i < 8; i++) recruit();
  assert.equal(h.ui.battleTutorial.step, 'trainRifle');
  barracks.queue.push({ type: 'rifle' });
  h.UI.prototype.updateHUD.call(h.ui);
  assert.equal(h.ui.game.supply(), 23);
  assert.equal(h.ui.battleTutorial.step, 'buildDepot', 'reserved supply counts and one odd slot cannot fit a squad');
  assert.equal(spoken.filter(id => id === 'tutorial.supply').length, 1);
  assert.equal(spoken.filter(id => id === 'tutorial.logistics').length, 1);
  assert.equal(h.ui.profile.tutorialComplete, false);
  assert.equal(focused('tab:build'), true);
  h.ui.setTab('build');
  assert.equal(focused('build:depot'), true);
  const depot = { id: 13, team: 0, kind: 'building', type: 'depot', hp: 100, progress: .2, queue: [] };
  h.ui.game.s.entities.push(depot);
  h.ui.renderActions();
  assert.equal(focused('build:depot'), false, 'wait for the depot foundation to finish');
  assert.equal(h.ui.game.cap(), 24);
  assert.equal(saved.length, 0);
  h.ui.game.s.entities = h.ui.game.s.entities.filter(e => e !== depot);
  h.ui.renderActions();
  assert.equal(focused('build:depot'), true, 'cancelling the foundation restores the depot prompt');
  depot.progress = 1;
  h.ui.game.s.entities.push(depot);
  h.ui.event('complete', { type: 'depot', x: 1, z: 2 });
  assert.equal(h.ui.game.cap(), 40);
  assert.equal(h.ui.battleTutorial, null);
  assert.equal(h.ui.profile.tutorialComplete, true);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].tutorialComplete, true);
  assert.equal(h.document.getElementById('tutorialGoal').classList.contains('hidden'), true);
  assert.equal(actions.innerHTML.includes('tutorial-focus'), false);
});

test('tutorial objective stays separate from action markup, covers every step and hides outside the tutorial', () => {
  const h = setup(), ui = h.ui, panel = h.document.getElementById('tutorialGoal'),
    text = h.document.getElementById('tutorialGoalText'), actions = h.document.getElementById('actions');
  ui.game.s.entities = [{ id: 1, team: 0, kind: 'building', type: 'hq', hp: 100, progress: 1, queue: [] }];
  for (const step of ['arrival', 'buildHQ', 'recon', 'trainWorker', 'buildRefinery', 'buildBarracks', 'trainRifle', 'buildDepot']) {
    ui.battleTutorial = { step, achieved: new Set(), workersTrained: 1, elapsed: 0 };
    ui.renderActions(6, 24);
    assert.equal(panel.classList.contains('hidden'), false);
    assert.ok(text.textContent.length > 0, `objective for ${step}`);
    assert.equal(actions.innerHTML.includes(text.textContent), false, 'objectives never consume action-panel space');
  }
  ui.battleTutorial.step = 'trainRifle';
  ui.renderActions(6, 24);
  let markup = actions.innerHTML, writes = 0;
  Object.defineProperty(actions, 'innerHTML', { get: () => markup, set(value) { markup = value; writes++; } });
  const previousGoal = text.textContent;
  ui.renderActions(8, 24);
  assert.notEqual(text.textContent, previousGoal, 'live supply updates the objective');
  assert.equal(writes, 0, 'a changed supply count does not rebuild or scroll the action buttons');
  for (const state of ['menu', 'result', 'complete']) {
    ui.view = state === 'menu' ? 'home' : 'game';
    ui.game.s.result = state === 'result' ? { win: true } : null;
    if (state === 'complete') ui.battleTutorial = null;
    ui.updateTutorialGoal();
    assert.equal(panel.classList.contains('hidden'), true);
    assert.equal(text.textContent, '');
  }
});

test('supply tutorial waits for multiple completed squads and responds to cancelled reservations', () => {
  const h = setup(), ui = h.ui, g = ui.game;
  ui.setTab = h.UI.prototype.setTab;
  ui.tab = 'infantry';
  ui.battleTutorial = { step: 'trainRifle', achieved: new Set(['trainRifle']), workersTrained: 2, elapsed: 0 };
  const producer = (id, type, count) => ({ id, team: 0, kind: 'building', type, hp: 100, progress: 1,
    queue: Array.from({ length: count }, () => ({ type: 'rifle' })) });
  const a = producer(1, 'barracks', 5), b = producer(2, 'barracks', 4);
  g.s.entities = [producer(3, 'hq', 0), a, b,
    ...Array.from({ length: 3 }, (_, i) => ({ id: 4 + i, team: 0, kind: 'unit', type: 'worker', hp: 100 })),
    { id: 7, team: 0, kind: 'unit', type: 'rifle', hp: 100 }];
  assert.equal(g.supply(), 23);
  ui.reconcileBattleTutorial();
  assert.equal(ui.battleTutorial.step, 'trainRifle', 'full orders alone are not multiple completed squads');
  assert.equal(ui.tutorialAction(), null);
  b.queue.pop();
  ui.reconcileBattleTutorial();
  assert.equal(g.supply(), 21);
  assert.equal(ui.tutorialAction(), 'train:rifle', 'cancelling reserved supply restores recruitment guidance');
  b.queue.push({ type: 'rifle' });
  ui.reconcileBattleTutorial();
  assert.equal(ui.tutorialAction(), null);
  a.queue.shift();
  g.s.entities.push({ id: 8, team: 0, kind: 'unit', type: 'rifle', hp: 100 });
  ui.advanceBattleTutorial('trained', 'rifle');
  assert.equal(g.supply(), 23);
  assert.equal(ui.battleTutorial.step, 'buildDepot');
  assert.equal(ui.profile.tutorialComplete, false);
});

test('supply tutorial derives its limit from current capacity, including odd slots and fleet upgrades', () => {
  for (const [workers, rifles, rank, step] of [[2, 10, 0, 'trainRifle'], [3, 9, 0, 'trainRifle'],
    [3, 10, 0, 'buildDepot'], [2, 12, 2, 'trainRifle'], [2, 13, 2, 'buildDepot']]) {
    const h = setup(), ui = h.ui, g = ui.game;
    g.s.parties[0].meta.logisticsFrame = rank;
    g.s.entities = [{ id: 1, team: 0, kind: 'building', type: 'hq', hp: 100, progress: 1, queue: [] },
      ...Array.from({ length: workers + rifles }, (_, i) =>
        ({ id: i + 2, team: 0, kind: 'unit', type: i < workers ? 'worker' : 'rifle', hp: 100 }))];
    ui.battleTutorial = { step: 'trainRifle', achieved: new Set(['trainRifle']), workersTrained: 2, elapsed: 0 };
    vm.runInContext('Math.random=()=>{throw Error("Tutorial RNG");};', h.context);
    const before = JSON.stringify(g.s);
    assert.ok(g.supply() <= g.cap(), 'fixture stays within its real supply capacity');
    ui.reconcileBattleTutorial();
    assert.equal(ui.battleTutorial.step, step);
    assert.equal(JSON.stringify(g.s), before, 'guidance does not alter balances, units, supply or queues');
  }
});

test('tutorial remembers valid goals completed out of order instead of demanding duplicates', () => {
  const h = setup(), saved = [];
  h.ui.setTab = h.UI.prototype.setTab;
  h.ui.persistence.saveProfile = profile => { saved.push(JSON.parse(JSON.stringify(profile))); return true; };
  h.ui.game.s.depth = 0;
  h.ui.game.s.rules = { kind: 'single-player', mission: { id: 'hq-elimination' } };
  assert.equal(h.ui.beginBattleTutorial(), true);
  h.ui.advanceBattleTutorial('complete', 'hq');
  h.ui.advanceBattleTutorial('complete', 'barracks');
  h.ui.advanceBattleTutorial('complete', 'depot');
  h.ui.game.s.entities = [{ id: 1, team: 0, kind: 'building', type: 'hq', hp: 100, progress: 1, queue: [] },
    { id: 2, team: 0, kind: 'building', type: 'depot', hp: 100, progress: 1, queue: [] },
    ...Array.from({ length: 21 }, (_, i) =>
      ({ id: i + 3, team: 0, kind: 'unit', type: i < 2 ? 'worker' : 'rifle', hp: 100 }))];
  h.ui.advanceBattleTutorial('trained', 'rifle');
  h.ui.advanceBattleTutorial('complete', 'refinery');
  assert.equal(h.ui.battleTutorial.step, 'trainWorker');
  h.ui.advanceBattleTutorial('trained', 'worker');
  assert.equal(h.ui.battleTutorial.step, 'trainWorker');
  h.ui.advanceBattleTutorial('trained', 'worker');
  assert.equal(h.ui.battleTutorial, null);
  assert.equal(h.ui.profile.tutorialComplete, true);
  assert.equal(saved.length, 1);
});

test('tutorial and camera introduction stay out of later progress, completed profiles and other factions', () => {
  for (const [depth, bestDepth, complete, faction] of [[1, 0, false, 0], [0, 1, false, 0],
    [0, 0, true, 0], [0, 0, false, 1]]) {
    const h = setup();
    h.ui.game.s.depth = depth;
    h.ui.game.s.rules = { kind: 'single-player', mission: { id: 'hq-elimination' } };
    h.ui.game.s.parties[0].faction = faction;
    h.ui.profile.expeditionDepth = bestDepth;
    h.ui.profile.tutorialComplete = complete;
    h.ui.game.s.entities = [
      { id: 1, team: 0, kind: 'building', type: 'hq', hp: 100, x: -60, z: 50 },
      { id: 2, team: 1, kind: 'building', type: 'hq', hp: 100, x: 80, z: -70 }
    ];
    const camera = { ...h.ui.game.s.cam };
    h.ui.event('start', {});
    assert.equal(h.ui.battleIntro, null);
    assert.equal(h.ui.paused, false);
    assert.deepEqual(h.ui.game.s.cam, camera);
    assert.equal(h.ui.introObserves(h.ui.game.s.entities[1]), false);
    assert.equal(h.ui.beginBattleTutorial(), false);
    assert.equal(h.ui.battleTutorial, null);
  }
});

test('world picking and captured releases outside the viewport cannot issue orders or target abilities', () => {
  for (const pointerType of ['touch', 'mouse']) for (const y of [40, 610]) {
    const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
    h.ui.mode = { kind: 'ability', arg: 'scan' };
    h.ui.applyTarget = p => h.calls.push(['target', p]);
    h.pointer('pointerdown', 200, y, { pointerType }); assert.equal(h.ui.drag, null);
    h.pointer('pointerdown', 200, 200, { pointerType });
    h.pointer('pointerup', 200, y, { pointerType });
    assert.deepEqual(h.calls, []); assert.deepEqual(h.ui.selected, [7]);
    h.ui.game.s.entities = [{ id: 1, hp: 100, team: 0, kind: 'unit', type: 'rifle', x: 200, z: y, size: 1 }];
    assert.equal(h.UI.prototype.pick.call(h.ui, 200, y), null);
    h.pointer('pointermove', 200, y, { pointerType }); assert.equal(h.ui.pointer.inside, false);
  }
});

test('minimap camera outline uses all four actual viewport corners after layout changes', () => {
  const h = setup(), points = [], ctx = new Proxy({}, { get: () => () => {} });
  const c = h.document.getElementById('minimap'); c.width = c.height = 210; c.getContext = () => ctx;
  h.ui.game.world = { extent: 90, gridSize: 72, terrainColors: new Uint8Array(72*72*4), terrainFeatureGrid: [], visible: [], explored: [] };
  h.ui.miniBuffer = { width: 72 }; h.ui.miniCtx = { putImageData() {} };
  h.ui.miniImage = { data: new Uint8Array(72*72*4) };
  h.ui.R.ground = (x,y) => { points.push([x,y]); return {x:x/10,z:y/10}; };
  for (const v of [{left:0,top:55,right:390,bottom:573}, {left:17,top:63,right:1017,bottom:464.5}]) {
    h.ui.R.viewport = v; points.length = 0; h.UI.prototype.drawMinimap.call(h.ui);
    assert.deepEqual(points, [[v.left,v.top],[v.right,v.top],[v.right,v.bottom],[v.left,v.bottom]]);
  }
});

test('minimap never marks an unseen enemy HQ, even on explored ground', () => {
  const h=setup(), draws=[], ctx=new Proxy({}, {get:(_,name)=>(...args)=>draws.push([name,...args])});
  h.minimap.width=h.minimap.height=180;h.minimap.getContext=()=>ctx;
  h.ui.game.world={extent:90,gridSize:72,terrainColors:new Uint8Array(72*72*4),terrainFeatureGrid:[],visible:[],explored:[],idx:()=>0};
  h.ui.miniBuffer={width:72};h.ui.miniCtx={putImageData(){}};h.ui.miniImage={data:new Uint8Array(72*72*4)};
  h.ui.R.ground=()=>({x:0,z:0});
  h.ui.game.s.entities=[{kind:'building',type:'hq',team:1,hp:100,size:4.4,x:49,z:-49}];
  for(const explored of [0,1]) {
    h.ui.game.world.explored[0]=explored;h.ui.game.visible=()=>false;draws.length=0;
    h.UI.prototype.drawMinimap.call(h.ui);
    assert.equal(draws.some(([name])=>name==='strokeRect'||name==='fillRect'),false);
  }
  h.ui.game.visible=()=>true;draws.length=0;h.UI.prototype.drawMinimap.call(h.ui);
  assert.equal(draws.filter(([name])=>name==='fillRect').length,1,'visible HQ remains visible');
});

test('minimap input, camera limits and world targets use the active map size after switching', () => {
  const h=setup();h.UI.prototype.bind.call(h.ui);
  for (const extent of [90,135,90]) {
    h.ui.game.world.extent=extent;
    h.pointer('pointerdown',180,0,{target:h.minimap});
    h.pointer('pointerup',180,0,{target:h.minimap});
    const limits=flatCameraLimits(h.ui);
    assert.deepEqual(h.ui.game.s.cam,{x:limits.x,z:-limits.z,zoom:50});
    h.calls.length=0;
    h.pointer('pointerdown',162,18,{target:h.minimap,button:2});
    assert.deepEqual(h.calls, [], 'minimap input only navigates');
    h.ui.R.ground=()=>({x:999,z:-999});h.calls.length=0;
    h.pointer('pointerdown',200,200,{pointerType:'mouse',button:2});
    h.pointer('pointerup',200,200,{pointerType:'mouse',button:2});
    assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0][2])),{type:'move',x:extent-4,z:4-extent});
  }
});

test('minimap reallocates its raster on size changes and scales markers and camera outline', () => {
  const h=setup(), draws=[], rects=[], outline=[], images=[];
  const ctx=new Proxy({fillRect(...args){rects.push(args);},moveTo(...args){outline.push(args);}},
    {get:(target,key)=>target[key] || (()=>{})});
  h.minimap.width=270;h.minimap.height=180;h.minimap.getContext=()=>ctx;
  const miniCtx={createImageData(w,height){images.push([w,height]);return {data:new Uint8ClampedArray(w*height*4)};},
    putImageData(img){draws.push(img.data.length);}};
  h.document.createElement=()=>({getContext:()=>miniCtx});h.ui.game.visible=()=>true;
  h.ui.R.ground=()=>({x:0,z:0});
  for(const [extent,n] of [[90,72],[135,108],[135,108],[90,72]]) {
    rects.length=outline.length=0;
    h.ui.game.world={extent,gridSize:n,terrainColors:new Uint8Array(n*n*4).fill(100),
      visible:new Uint8Array(n*n).fill(255),explored:[],terrainFeatureGrid:[],idx:()=>0};
    h.ui.game.s.entities=[{hp:100,kind:'building',type:'hq',team:0,size:10,x:extent*.8,z:-extent*.8}];
    h.UI.prototype.drawMinimap.call(h.ui);
    assert.equal(draws.at(-1),n*n*4);assert.equal(h.ui.miniBuffer.width,n);
    assert.equal(h.ui.miniBuffer.height,n);
    const size=10*270/(extent*2);
    assert.deepEqual(rects,[[243-size/2,18-size/2,size,size]]);
    assert.deepEqual(outline.at(-1),[135,90]);
  }
  assert.deepEqual(images,[[72,72],[108,108],[72,72]]);
});

test('right mouse dragging pans without issuing commands or changing selection', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
  h.pointer('pointerdown', 200, 200, { pointerType: 'mouse', button: 2 });
  h.pointer('pointermove', 240, 230, { pointerType: 'mouse', button: 2 });
  h.pointer('pointerup', 240, 230, { pointerType: 'mouse', button: 2 });
  assert.deepEqual(h.calls, []); assert.deepEqual(h.ui.selected, [7]);
  assert.deepEqual(h.ui.game.s.cam, { x: -4, z: -3, zoom: 50 });
});

test('rectangle selection replaces with living own units in either drag direction, including elevated air units', () => {
  for (const pointerType of ['mouse','touch']) for (const reverse of [false,true]) {
    const h=setup(),ui=h.ui;h.UI.prototype.bind.call(ui);ui.selected=[99];
    ui.game.localTeam=2;
    ui.game.world.surface={entityHeight:()=>12};
    const heights=[];ui.R.project=(x,y,z)=>{heights.push(y);return {x,y:z-y};};
    ui.game.s.entities=[
      {id:1,team:2,type:'rifle',x:220,z:220},
      {id:2,team:2,type:'worker',x:240,z:230},
      {id:3,team:0,type:'rifle',x:220,z:220},
      {id:4,team:2,type:'rifle',x:260,z:240,hp:0},
      {id:5,team:2,type:'hq',x:230,z:230,kind:'building'},
      {id:6,team:2,type:'rifle',x:310,z:220},
      {id:7,team:2,type:'air',x:280,z:315}
    ].map(e=>({kind:'unit',hp:100,...e}));
    const from=reverse?[300,300]:[200,200],to=reverse?[200,200]:[300,300];
    h.pointer('pointerdown',...from,{pointerType});
    if(pointerType==='touch')h.setTime(400);
    h.pointer('pointermove',...to,{pointerType});
    h.pointer('pointerup',...to,{pointerType});
    assert.deepEqual(ui.selected,[1,2,7]);
    assert.ok(heights.includes(16.4),'flying center includes terrain height');
    assert.deepEqual(ui.game.s.cam,{x:0,z:0,zoom:50});
    assert.deepEqual(h.calls,[['select',[1,2,7]]]);
  }
});

test('rectangle long press tolerates jitter, signals readiness and release alone or empty selection does nothing', () => {
  const h=setup(),ui=h.ui;h.UI.prototype.bind.call(ui);ui.selected=[7];
  h.pointer('pointerdown',200,200);
  h.setTime(399);h.pointer('pointermove',203,202);
  assert.equal(ui.drag.selecting,false);
  h.setTime(400);ui.tick(0);
  assert.equal(ui.drag.selecting,true);
  const arcs=[],ctx=new Proxy({arc(...args){arcs.push(args);}}, {get:(o,k)=>o[k]||(()=>{})});
  ui.game.effects={floats:[]};h.UI.prototype.drawOverlay.call(ui,ctx);
  assert.equal(arcs.some(a=>a[0]===200&&a[1]===200&&a[2]===24),true);
  h.pointer('pointerup',203,202);
  assert.deepEqual(ui.selected,[7]);assert.deepEqual(h.calls,[]);
  for(const pointerType of ['touch','mouse']) {
    h.pointer('pointerdown',200,200,{pointerType});h.setTime(900);
    h.pointer('pointermove',300,300,{pointerType});h.pointer('pointerup',300,300,{pointerType});
    assert.deepEqual(ui.selected,[7]);assert.deepEqual(h.calls,[]);
  }
});

test('rectangle long press cannot take over an early camera pan, explicit targeting or a multi-touch gesture', () => {
  const h=setup(),ui=h.ui;h.UI.prototype.bind.call(ui);ui.selected=[7];
  h.pointer('pointerdown',200,200);h.setTime(100);h.pointer('pointermove',220,200);
  h.setTime(700);h.pointer('pointermove',240,230);h.pointer('pointerup',240,230);
  assert.deepEqual(ui.game.s.cam,{x:-4,z:-3,zoom:50});assert.deepEqual(h.calls,[]);
  ui.mode={kind:'ability',arg:'scan'};
  h.pointer('pointerdown',200,200);h.setTime(1200);ui.tick(0);
  assert.equal(ui.drag.selecting,false);
  h.pointer('pointermove',240,230);h.pointer('pointerup',240,230);
  assert.deepEqual(h.calls,[]);ui.mode=null;
  h.pointer('pointerdown',200,200);h.setTime(1700);ui.tick(0);
  assert.equal(ui.drag.selecting,true);
  h.pointer('pointerdown',300,300,{pointerId:2});assert.equal(ui.drag,null);
  h.pointer('pointerup',300,300,{pointerId:2});h.pointer('pointermove',250,250);h.pointer('pointerup',250,250);
  assert.deepEqual(ui.selected,[7]);assert.deepEqual(h.calls,[]);
});

test('rectangle cancellation, pause and captured release outside viewport preserve selection', () => {
  for(const interruption of ['cancel','pause','outside']) {
    const h=setup(),ui=h.ui;h.UI.prototype.bind.call(ui);ui.selected=[7];
    h.pointer('pointerdown',200,200);h.setTime(400);h.pointer('pointermove',300,300);
    if(interruption==='cancel')h.pointer('pointercancel',300,300);
    if(interruption==='pause'){ui.paused=true;ui.tick(0);}
    h.pointer('pointerup',300,interruption==='outside'?610:300);
    assert.equal(ui.drag,null);assert.deepEqual(ui.selected,[7]);assert.deepEqual(h.calls,[]);
  }
});

test('touch single/double tap preserves selection and visible same-type filtering', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  const unit = { id: 1, team: 0, kind: 'unit', type: 'rifle', x: 200, z: 200 };
  h.ui.game.s.entities.push(unit,
    { ...unit, id: 2, x: 240 },
    { ...unit, id: 3, type: 'worker' },
    { ...unit, id: 4, team: 1 },
    { ...unit, id: 5, x: -10 },
    { ...unit, id: 6, z: 700 });
  h.ui.pick = () => unit;
  h.pointer('pointerdown', 200, 200); h.pointer('pointerup', 200, 200);
  assert.deepEqual(h.ui.selected, [1]);
  h.pointer('pointerdown', 200, 200); h.pointer('pointerup', 200, 200);
  assert.deepEqual(h.ui.selected, [1, 2]);
  assert.deepEqual(h.calls, [['select', [1]], ['select', [1, 2]]]);
});

test('triple touch taps retain same-type selection without expanding to the combat force', () => {
  for (const trigger of ['rifle','worker']) {
    const h = setup(); h.UI.prototype.bind.call(h.ui);
    const unit = { id: 1, team: 0, kind: 'unit', type: trigger, hp: 100, x: 200, z: 200 };
    h.ui.game.s.entities = [unit, ...['rifle','worker','tank','medic','hero','air','artillery']
      .map((type,i) => ({...unit,id:i+2,type})),
      {...unit,id:10,team:1}, {...unit,id:11,kind:'building',type:'barracks'},
      {...unit,id:12,hp:0}, {...unit,id:13,x:-10}, {...unit,id:14,x:1280},
      {...unit,id:15,z:55}, {...unit,id:16,z:590}, {...unit,id:17,x:999}];
    h.ui.game.alive = predicate => h.ui.game.s.entities.filter(e => e.hp > 0 && predicate(e));
    h.ui.R.project = (x,y,z) => x === 999 ? null : {x,y:z};
    h.ui.pick = () => unit;
    const tap = time => { h.setTime(time); h.pointer('pointerdown',200,200); h.pointer('pointerup',200,200); };
    tap(0); assert.deepEqual(h.ui.selected,[1]);
    tap(200); assert.deepEqual(h.ui.selected,trigger === 'worker' ? [1,3] : [1,2]);
    const sameType = trigger === 'worker' ? [1,3] : [1,2];
    tap(400); assert.deepEqual(h.ui.selected,sameType);
    tap(500); assert.deepEqual(h.ui.selected,sameType);
    assert.ok(h.calls.every(c => c[0] === 'select'), 'no order or camera action');
  }
});

test('group selection uses the actual world viewport bounds in portrait', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  Object.assign(h.ui.R.viewport, { top: 90, bottom: 400, height: 310 });
  const unit = {id:1,team:0,kind:'unit',type:'rifle',hp:100,x:200,z:200};
  h.ui.game.s.entities = [unit,{...unit,id:2,z:80},{...unit,id:3,z:399},{...unit,id:4,z:410}];
  h.ui.pick = () => unit;
  for(let i=0;i<3;i++){h.pointer('pointerdown',200,200);h.pointer('pointerup',200,200);}
  assert.deepEqual(h.ui.selected,[1,3]);
});

test('tap chains reset on timeout, a different target, drag, cancellation, pinch, ground order or targeting', () => {
  for (const interruption of ['timeout','target','drag','cancel','pinch','ground','mode']) {
    const h = setup(); h.UI.prototype.bind.call(h.ui);
    const unit = {id:1,team:0,kind:'unit',type:'rifle',x:200,z:200};
    h.ui.game.s.entities = [unit,{...unit,id:2},{...unit,id:3,type:'tank'}];
    h.ui.pick = () => unit;
    const tap = () => {h.pointer('pointerdown',200,200);h.pointer('pointerup',200,200);};
    tap(); tap(); assert.deepEqual(h.ui.selected,[1,2]);
    if (interruption === 'timeout') h.setTime(330);
    if (interruption === 'target') {h.ui.pick = () => h.ui.game.s.entities[2];tap();}
    if (interruption === 'drag') {
      h.pointer('pointerdown',200,200);h.pointer('pointermove',220,200);h.pointer('pointerup',220,200);
    }
    if (interruption === 'cancel') {h.pointer('pointerdown',200,200);h.pointer('pointercancel',200,200);}
    if (interruption === 'pinch') {
      h.pointer('pointerdown',200,200);h.pointer('pointerdown',240,200,{pointerId:2});
      h.pointer('pointerup',240,200,{pointerId:2});h.pointer('pointerup',200,200);
    }
    if (interruption === 'ground') {h.ui.pick = () => null;tap();}
    if (interruption === 'mode') {h.ui.mode = {kind:'move'};tap();}
    h.ui.pick = () => unit; h.calls.length = 0; tap();
    assert.deepEqual(h.ui.selected,[1],interruption);
    assert.deepEqual(h.calls,[['select',[1]]]);
  }
});

test('triple mouse clicks keep same-type selection; buildings never trigger combat selection', () => {
  for (const kind of ['unit','building']) {
    const h = setup(); h.UI.prototype.bind.call(h.ui);
    const unit = {id:1,team:0,kind,type:kind === 'unit' ? 'rifle' : 'barracks',x:200,z:200};
    h.ui.game.s.entities = [unit,{...unit,id:2},{...unit,id:3,kind:'unit',type:'tank'}];
    h.ui.pick = () => unit;
    for (let i=0;i<3;i++) {
      h.pointer('pointerdown',200,200,{pointerType:kind === 'unit' ? 'mouse' : 'touch'});
      h.pointer('pointerup',200,200,{pointerType:kind === 'unit' ? 'mouse' : 'touch'});
    }
    assert.deepEqual(h.ui.selected,kind === 'unit' ? [1,2] : [1]);
  }
});

test('selection feedback uses only living owned units and HUD group selection requests exactly one response', () => {
  const h = setup(), requests = [], sounds = [];
  h.ui.select = h.UI.prototype.select.bind(h.ui);
  h.ui.audio.selectionVoice = (units, group) => { requests.push({ types: Array.from(units, e => e.type), group }); return units.length > 0; };
  h.ui.audio.sound = sound => sounds.push(sound);
  h.ui.game.observed = () => true;
  h.ui.game.s.entities = [
    { id: 1, kind: 'unit', type: 'worker', team: 0, hp: 100, x: 100, z: 100 },
    { id: 2, kind: 'unit', type: 'rifle', team: 0, hp: 100, x: 200, z: 200 },
    { id: 3, kind: 'unit', type: 'tank', team: 0, hp: 100, x: 300, z: 300 },
    { id: 4, kind: 'unit', type: 'rifle', team: 1, hp: 100, x: 400, z: 400 },
    { id: 5, kind: 'unit', type: 'worker', team: 0, hp: 0, x: 100, z: 100 }
  ];
  h.ui.select([1, 1, 4, 5]);
  assert.deepEqual(requests.pop(), { types: ['worker'], group: false });
  assert.deepEqual(sounds, []);
  h.ui.select([4]); assert.deepEqual(requests.pop().types, []);
  assert.deepEqual(sounds, ['select'], 'enemy selection never impersonates an owned unit');
  h.UI.prototype.bind.call(h.ui);
  requests.length = 0;
  h.ui.select([2, 3], true);
  assert.deepEqual(requests, [{ types: ['rifle', 'tank'], group: true }]);
});

test('catalogue dialogue shares subtitle and recording identity, outlives its voice and stops on close', () => {
  const h = setup(), spoken = [], stopped = [];
  let active = null;
  h.ui.audio.playVoice = id => { spoken.push(id); active = id; return true; };
  h.ui.audio.isVoiceActive = id => active === id;
  h.ui.audio.stopVoice = kind => { stopped.push(kind); active = null; };
  h.ui.updateQueues = () => {};
  h.UI.prototype.bind.call(h.ui);
  for (const id of ['tutorial.settle', 'tutorial.warning']) {
    const line = vm.runInContext(`voiceLine('${id}')`, h.context);
    h.ui.radioLine(id);
    assert.equal(h.document.getElementById('radioText').textContent, line.text);
    assert.equal(h.document.getElementById('radioName').textContent, line.speaker + ' / SECURE CHANNEL');
    assert.equal(spoken.at(-1), id);
  }
  h.ui.radioUntil = 1;
  h.setTime(20000); h.ui.tick(0);
  assert.equal(h.document.getElementById('radio').classList.contains('hidden'), false, 'late media loading or long playback must not hide its subtitles');
  active = null; h.ui.tick(0);
  assert.equal(h.document.getElementById('radio').classList.contains('hidden'), true);
  h.ui.radioLine('tutorial.settle');
  h.document.getElementById('radioClose').onclick();
  assert.equal(stopped.at(-1), 'dialogue');
  assert.equal(h.ui.radioVoiceId, null);
  assert.equal(h.document.getElementById('radio').classList.contains('hidden'), true);
});

test('selection deduplicates IDs and excludes missing entities', () => {
  const h = setup();
  h.ui.game.s.entities = [{ id: 1 }, { id: 2 }];
  h.ui.audio.sound = () => {}; h.ui.renderActions = () => {};
  h.UI.prototype.select.call(h.ui, [1, 1, 99]);
  assert.deepEqual(Array.from(h.ui.selected), [1]);
  const lookup = h.ui.selectionIds();
  assert.strictEqual(h.ui.selectionIds(), lookup, 'unchanged selection reuses its lookup');
  h.ui.selected = [2];
  assert.notStrictEqual(h.ui.selectionIds(), lookup);
  assert.deepEqual(Array.from(h.ui.selectionIds()), [2]);
});

test('successful targeting clears the mode; failed placement allows retry', () => {
  for (const mini of [false, true]) for (const rightClick of [false, true]) {
    const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
    h.ui.mode = { kind: 'ability', arg: 'scan' };
    h.ui.game.ability = (...args) => { h.calls.push(['ability', ...args]); return true; };
    const options = { pointerType: 'mouse', button: rightClick ? 2 : 0,
      target: mini ? h.minimap : h.world };
    h.pointer('pointerdown', 100, 100, options); h.pointer('pointerup', 100, 100, options);
    if (mini && rightClick) {
      assert.deepEqual(h.calls, []);
      assert.equal(h.ui.mode.kind, 'ability', 'right-click minimap navigation preserves targeting');
    } else {
      assert.equal(h.calls.length, 1); assert.equal(h.calls[0][0], rightClick ? 'command' : 'ability');
      assert.equal(h.ui.mode, null);
    }
  }
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  h.ui.mode = { kind: 'build', arg: 'depot' }; h.ui.game.build = () => false;
  h.pointer('pointerdown', 200, 200);
  h.pointer('pointerup', 200, 200);
  assert.equal(h.ui.mode.kind, 'build', 'failed placement still allows retry');
  h.ui.game.build = () => true;
  h.pointer('pointerdown', 200, 200);
  h.pointer('pointerup', 200, 200);
  assert.equal(h.ui.mode, null);
});

test('codex wheel zoom is bounded, normalizes delta modes and stays separate from battle camera', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  h.ui.view = 'codexModel'; h.ui.paused = true;
  const camera = {...h.ui.game.s.cam};
  let prevented = 0;
  const wheel = (deltaY, deltaMode = 0, clientY = 200) => h.world.handlers.wheel({
    deltaY, deltaMode, clientX:200, clientY, preventDefault:()=>prevented++
  });
  for (const [delta, mode] of [[120,0],[7.5,1],[.15,2]]) {
    h.ui.codexZoom = 1; wheel(delta, mode);
    assert.ok(Math.abs(h.ui.codexZoom - Math.exp(.18)) < 1e-10);
  }
  for (let i=0;i<20;i++) wheel(-1000);
  assert.equal(h.ui.codexZoom,.3);
  for (let i=0;i<20;i++) wheel(1000);
  assert.equal(h.ui.codexZoom,2);
  wheel(-120,0,10); assert.equal(h.ui.codexZoom,2);
  h.ui.view = 'codex'; wheel(-120); assert.equal(h.ui.codexZoom,2);
  assert.equal(prevented,43);
  assert.deepEqual(h.ui.game.s.cam,camera); assert.deepEqual(h.calls,[]);
  h.ui.view = 'codexModel'; h.ui.game.s = null;
  wheel(-120); assert.ok(h.ui.codexZoom<2,'preview works without a running battle');
});

test('codex dragging takes over the displayed rotation without affecting zoom or battle controls', () => {
  for (const pointerType of ['mouse','touch']) {
    const h = setup(); h.UI.prototype.bind.call(h.ui);
    h.ui.view = 'codexModel'; h.ui.paused = true;
    const camera = {...h.ui.game.s.cam};
    assert.equal(h.ui.codexModelRotation(10),10*.23);
    h.pointer('pointerdown',200,200,{pointerType});
    h.pointer('pointermove',200,230,{pointerType});
    assert.equal(h.ui.codexManualRotation,false,'vertical motion does not stop automatic rotation');
    h.pointer('pointermove',250,230,{pointerType});
    assert.equal(h.ui.codexManualRotation,true);
    assert.equal(h.ui.codexModelRotation(20),10*.23+.5,'manual rotation starts from the displayed heading');
    h.pointer('pointerup',250,230,{pointerType});
    h.pointer('pointermove',300,230,{pointerType});
    assert.equal(h.ui.codexManualRotation,false);
    const resumed = h.ui.codexModelRotation(.1);
    assert.ok(Math.abs(resumed-(10*.23+.5+.023))<1e-10,'release resumes smoothly from the chosen heading');
    h.pointer('pointerdown',300,230,{pointerType});
    h.pointer('pointermove',200,230,{pointerType});
    assert.ok(Math.abs(h.ui.codexModelRotation(.1)-(resumed-1))<1e-10);
    h.window.handlers.blur();
    assert.equal(h.ui.codexDrag,undefined);
    assert.equal(h.ui.codexManualRotation,false);
    h.pointer('pointermove',300,230,{pointerType});
    assert.ok(Math.abs(h.ui.codexRotation-(resumed-1))<1e-10);
    const afterBlur = h.ui.codexModelRotation(.1);
    assert.ok(Math.abs(afterBlur-(resumed-1+.023))<1e-10);
    h.pointer('pointerdown',200,200,{pointerType});
    h.pointer('pointermove',220,200,{pointerType});
    h.world.handlers.pointercancel();
    assert.equal(h.ui.codexManualRotation,false);
    assert.ok(Math.abs(h.ui.codexModelRotation(.1)-(afterBlur+.2+.023))<1e-10);
    assert.equal(h.ui.codexZoom,1);
    assert.deepEqual(h.ui.game.s.cam,camera); assert.deepEqual(h.calls,[]);
    h.ui.R.clearStatic = () => {}; h.ui.R.useModelPreview = () => {};
    h.ui.showCodexModel('building','hq');
    assert.equal(h.ui.codexManualRotation,false);
    assert.equal(h.ui.codexDrag,undefined);
    assert.equal(h.ui.codexModelRotation(.1),.1*.23);
  }
  const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.view = 'codexModel';
  for (const button of [1,2]) {
    h.pointer('pointerdown',200,200,{pointerType:'mouse',button});
    h.pointer('pointermove',300,200,{pointerType:'mouse',button});
    assert.equal(h.ui.codexManualRotation,false); assert.equal(h.ui.codexDrag,undefined);
  }
  h.pointer('pointerdown',200,10,{pointerType:'mouse'});
  assert.equal(h.ui.codexDrag,undefined,'press outside viewport cannot start rotation');
});

test('codex pinch captures both fingers, keeps rotation separate and clears stale gestures', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  h.ui.view = 'codexModel'; h.ui.paused = true;
  const camera = {...h.ui.game.s.cam}, captured = [];
  h.world.setPointerCapture = id => captured.push(id);
  h.pointer('pointerdown',200,200);
  h.pointer('pointermove',220,200);
  assert.equal(h.ui.codexZoom,1);
  h.pointer('pointerdown',320,200,{pointerId:2});
  const rotation = h.ui.codexRotation;
  assert.equal(h.ui.codexDrag,undefined);
  assert.equal(h.ui.codexManualRotation,false,'pinch resumes automatic rotation');
  h.pointer('pointermove',420,200,{pointerId:2});
  assert.equal(h.ui.codexZoom,.5); assert.deepEqual(captured,[1,2]);
  h.pointer('pointermove',1000,200,{pointerId:2}); assert.equal(h.ui.codexZoom,.3);
  h.pointer('pointermove',221,200,{pointerId:2}); assert.equal(h.ui.codexZoom,2);
  h.pointer('pointerup',221,200,{pointerId:2});
  h.pointer('pointermove',250,200); assert.equal(h.ui.codexZoom,2);
  assert.equal(h.ui.codexRotation,rotation,'pinch and its surviving finger do not rotate');
  h.pointer('pointerdown',350,200,{pointerId:3});
  h.pointer('pointerdown',400,200,{pointerId:4});
  h.pointer('pointermove',420,200,{pointerId:4}); assert.equal(h.ui.codexZoom,2,'third touch suspends pinch');
  h.pointer('pointerup',420,200,{pointerId:4});
  h.pointer('pointermove',450,200,{pointerId:3}); assert.equal(h.ui.codexZoom,1);
  h.world.handlers.pointercancel();
  assert.equal(h.ui.codexTouches.size,0); assert.equal(h.ui.codexPinchDist,undefined);
  assert.equal(h.ui.codexDrag,undefined);
  h.pointer('pointerdown',200,200); h.window.handlers.blur();
  assert.equal(h.ui.codexTouches.size,0);
  assert.deepEqual(h.ui.game.s.cam,camera); assert.deepEqual(h.calls,[]);
  h.ui.R.clearStatic = () => {}; h.ui.R.useModelPreview = () => {};
  for (const [kind,type] of [['unit','rifle'],['building','hq'],['unit','destroyer']]) {
    h.ui.codexZoom = .3; h.pointer('pointerdown',200,200);
    h.ui.showCodexModel(kind,type);
    assert.equal(h.ui.codexZoom,1); assert.equal(h.ui.codexTouches.size,0);
  }
  h.pointer('pointerdown',200,200); h.ui.showCodex();
  assert.equal(h.ui.codexTouches.size,0);
});

test('mouse wheel zoom and middle-button rotation respect camera guards without issuing commands', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
  assert.equal(typeof h.world.handlers.wheel, 'function');
  let prevented = 0;
  const wheel = (deltaY, options = {}) => h.world.handlers.wheel({ deltaY, deltaMode: 0,
    clientX: 200, clientY: 200, preventDefault: () => prevented++, ...options });
  h.ui.lastClick = { id: 4, count: 1 };
  wheel(120);
  assert.ok(Math.abs(h.ui.game.s.cam.zoom - 50 * Math.exp(.18)) < 1e-10);
  assert.equal(Object.keys(h.ui.lastClick).length, 0); assert.equal(prevented, 1);
  for (let i = 0; i < 20; i++) wheel(1000);
  assert.equal(h.ui.game.s.cam.zoom, 115);
  for (let i = 0; i < 20; i++) wheel(-1000);
  assert.equal(h.ui.game.s.cam.zoom, 27.2);
  h.pointer('pointerdown', 200, 200, { pointerType: 'mouse', button: 1 });
  h.pointer('pointermove', 240, 230, { pointerType: 'mouse', button: 1 });
  h.pointer('pointerup', 240, 230, { pointerType: 'mouse', button: 1 });
  assert.equal(h.ui.drag, null);
  assert.deepEqual(h.ui.game.s.cam, { x: 0, z: 0, zoom: 27.2, yaw: .4 });
  assert.deepEqual(h.ui.selected, [7]); assert.deepEqual(h.calls, []);
  h.ui.paused = true; wheel(120); assert.equal(prevented, 41);
  h.pointer('pointerdown', 200, 200, { pointerType: 'mouse', button: 1 });
  h.pointer('pointermove', 280, 200, { pointerType: 'mouse', button: 1 });
  assert.deepEqual(h.ui.game.s.cam, { x: 0, z: 0, zoom: 27.2, yaw: .4 });
});

test('one-finger drag preserves pan, camera bounds and no command on release', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
  h.pointer('pointerdown', 200, 200);
  h.pointer('pointermove', 240, 230);
  assert.deepEqual(h.ui.game.s.cam, { x: -4, z: -3, zoom: 50 });
  h.pointer('pointermove', 1240, 1230);
  const limits=flatCameraLimits(h.ui);
  assert.deepEqual(h.ui.game.s.cam, { x: -limits.x, z: -limits.z, zoom: 50 });
  h.pointer('pointerup', 1240, 1230);
  assert.equal(h.ui.drag, null); assert.equal(h.ui.touchPoints.size, 0);
  assert.deepEqual(h.calls, []);
});

test('pinch preserves zoom limits and does not pan or issue commands', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
  h.pointer('pointerdown', 200, 200);
  h.pointer('pointerdown', 300, 200, { pointerId: 2 });
  h.pointer('pointermove', 320, 200, { pointerId: 2 });
  assert.equal(h.ui.game.s.cam.zoom, 50 * 100 / 120);
  h.pointer('pointermove', 600, 200, { pointerId: 2 });
  assert.equal(h.ui.game.s.cam.zoom, 27.2);
  h.pointer('pointermove', 210, 200, { pointerId: 2 });
  assert.equal(h.ui.game.s.cam.zoom, 115);
  h.pointer('pointerup', 210, 200, { pointerId: 2 });
  h.pointer('pointerup', 200, 200);
  assert.deepEqual(h.ui.game.s.cam, { x: 0, z: 0, zoom: 115 });
  assert.equal(h.ui.touchGesture, false); assert.equal(h.ui.touchPoints.size, 0);
  assert.equal(h.ui.drag, null); assert.deepEqual(h.calls, []);
});

test('two-finger twist combines rotation and zoom and guards surviving or extra fingers', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
  h.pointer('pointerdown', 200, 200);
  h.pointer('pointerdown', 300, 200, { pointerId: 2 });
  h.pointer('pointermove', 200, 400, { pointerId: 2 });
  assert.ok(Math.abs(h.ui.game.s.cam.yaw - Math.PI / 2) < 1e-10);
  assert.equal(h.ui.game.s.cam.zoom, 27.2);
  assert.equal(h.ui.game.s.cam.x, 0); assert.equal(h.ui.game.s.cam.z, 0);
  const before = { ...h.ui.game.s.cam };
  h.pointer('pointerdown', 400, 200, { pointerId: 3 });
  h.pointer('pointermove', 240, 400, { pointerId: 2 });
  assert.deepEqual(h.ui.game.s.cam, before, 'third finger suspends the gesture');
  h.pointer('pointerup', 400, 200, { pointerId: 3 });
  h.pointer('pointermove', 240, 400, { pointerId: 2 });
  assert.deepEqual(h.ui.game.s.cam, before, 'two-finger resumption starts at a fresh baseline');
  h.pointer('pointerup', 240, 400, { pointerId: 2 });
  h.pointer('pointermove', 260, 260);
  h.pointer('pointerup', 260, 260);
  assert.deepEqual(h.ui.game.s.cam, before, 'surviving finger neither pans nor rotates');
  assert.deepEqual(h.ui.selected, [7]); assert.deepEqual(h.calls, []);
  h.pointer('pointerdown', 200, 200);
  h.pointer('pointerdown', 300, 200, { pointerId: 2 });
  h.world.handlers.pointercancel();
  assert.equal(h.ui.touchAngle, undefined); assert.equal(h.ui.pinchDist, undefined);
});

test('two-finger rotation crosses the angle seam by the shortest arc', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  h.pointer('pointerdown', 300, 300);
  h.pointer('pointerdown', 200, 301, { pointerId: 2 });
  h.pointer('pointermove', 200, 299, { pointerId: 2 });
  assert.ok(Math.abs(h.ui.game.s.cam.yaw - 2 * Math.atan(.01)) < 1e-10);
});

test('touch taps still issue orders; pause, cancel and blur retain gesture guards', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
  h.pointer('pointerdown', 200, 200); h.pointer('pointerup', 200, 200);
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0][0], 'command');
  assert.equal(h.calls[0][2].type, 'move'); h.calls.length = 0;
  h.ui.paused = true;
  h.pointer('pointerdown', 200, 200); h.pointer('pointermove', 240, 230); h.pointer('pointerup', 240, 230);
  assert.deepEqual(h.ui.game.s.cam, { x: 0, z: 0, zoom: 50 });
  h.ui.paused = false;
  h.pointer('pointerdown', 200, 200);
  h.pointer('pointerdown', 300, 200, { pointerId: 2 });
  h.world.handlers.pointercancel();
  assert.equal(h.ui.drag, null); assert.equal(h.ui.touchPoints.size, 0);
  assert.equal(h.ui.touchGesture, false);
  h.pointer('pointerdown', 200, 200); h.window.handlers.blur();
  assert.equal(h.ui.drag, null); assert.deepEqual(h.calls, []);
});

test('build menu exposes only the Forum among civilian models in every expedition stage',()=>{
  const h=setup(),ui=h.ui,g=ui.game,tiers=[['fieldlab','embercottage'],['researchhub','terracecommons'],['researchspire','hearthtower'],['meridianforum']];
  ui.tab='build';
  for(const faction of [0,1,2]){
    g.s.parties[0].faction=faction;
    for(const stage of [1,2,3,4]){
      g.civilizationStage=stage;ui.renderActionMarkup();
      const html=h.document.getElementById('actions').innerHTML;
      tiers.forEach((types,i)=>types.forEach(type=>{
        const pattern=new RegExp(`data-action="build:${type}"`);
        if(type==='meridianforum')assert.match(html,pattern);else assert.doesNotMatch(html,pattern);
      }));
      for(const type of ['hq','barracks','factory','hangar','depot','refinery','turret'])assert.match(html,new RegExp(`data-action="build:${type}"`));
    }
  }
});

test('civilian HUD choices carry the selected building ID and obey pause guards',()=>{
  const h=setup(),ui=h.ui,g=ui.game,b={id:7,kind:'building',type:'fieldlab',team:0,hp:500,progress:1,forumId:1,queue:[]};
  g.s.entities=[b];ui.selected=[7];ui.perform=h.UI.prototype.perform;g.settlementUpgradeReason=()=>'';g.settlementExpansionReason=()=>'';
  ui.perform('settlementUpgrade:orbital');assert.deepEqual(h.calls.at(-1),['action',0,{kind:'configureSettlementUpgrade',id:7,upgrade:'orbital'}]);
  ui.perform('settlementExpand');assert.deepEqual(h.calls.at(-1),['action',0,{kind:'expandSettlementBuilding',id:7}]);
  ui.perform('settlementClear');assert.deepEqual(h.calls.at(-1),['action',0,{kind:'configureSettlementUpgrade',id:7,upgrade:null}]);
  const count=h.calls.length;ui.paused=true;ui.perform('settlementUpgrade:scan');assert.equal(h.calls.length,count);
});

test('speed changes are transient, pause-guarded and preserve commands and RNG', () => {
  const h = setup(), g = h.ui.game;
  Object.assign(g.s.parties[0].account, { alloy: 100, gas: 0, energy: 100, abilities: {} });
  Object.assign(g, { supply: () => 0, cap: () => 24 });
  h.ui.updateHUD = h.UI.prototype.updateHUD;
  h.UI.prototype.bind.call(h.ui);
  const button = h.document.getElementById('speedBtn'), profile = JSON.stringify(h.ui.profile);
  h.ui.persist = () => { throw Error('Speed must not be persisted'); };
  g.random = () => { throw Error('Speed must not consume RNG'); };
  const order = { type: 'move', x: 30, z: 40 }, mode = { kind: 'ability', arg: 'scan' };
  g.s.entities = [{ id: 7, kind: 'unit', team: 0, hp: 100, order }];
  h.ui.selected = [7]; h.ui.mode = mode; h.ui.attackMove = true;
  h.ui.updateHUD();
  for (const speed of [2, 3, 1, 2, 3, 1]) {
    h.ui.lastClick = { id: 7, count: 1 };
    button.onclick();
    assert.equal(g.s.speed, speed);
    assert.deepEqual(h.ui.selected, [7]); assert.strictEqual(h.ui.mode, mode);
    assert.strictEqual(g.s.entities[0].order, order); assert.equal(h.ui.attackMove, true);
    assert.equal(Object.keys(h.ui.lastClick).length, 0);
  }
  assert.deepEqual(h.calls, []); assert.equal(JSON.stringify(h.ui.profile), profile);
  button.onclick(); h.ui.pause(); button.onclick(); assert.equal(g.s.speed, 2);
  h.ui.resume(); assert.equal(g.s.speed, 2);
  g.s.result = {}; button.onclick(); assert.equal(g.s.speed, 2);
  g.s.result = null; h.ui.view = 'home'; button.onclick(); assert.equal(g.s.speed, 2);
  h.ui.view = 'game'; const run = g.s; g.s = null; button.onclick(); assert.equal(g.s, null);
  g.s = run;
});

test('removed command and camera controls have no handlers; ground orders remain move orders', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
  for (const id of ['attackMoveBtn', 'combatSelectBtn', 'visibleCombatSelectBtn'])
    assert.equal(h.document.getElementById(id).onclick, undefined);
  assert.equal(h.ui.attackMove, undefined);
  h.clickCamera('home'); assert.deepEqual(h.calls, []);
  for (const pointerType of ['mouse', 'touch']) {
    h.pointer('pointerdown', 200, 200, { pointerType, button: pointerType === 'mouse' ? 2 : 0 });
    h.pointer('pointerup', 200, 200, { pointerType, button: pointerType === 'mouse' ? 2 : 0 });
    assert.equal(h.calls.at(-1)[2].type, 'move');
  }
});

test('minimap Scan uses map coordinates without moving the camera, and failed scans allow retry', () => {
  for(const pointerType of ['mouse','touch']) for(const success of [true,false]) {
    const h=setup();h.UI.prototype.bind.call(h.ui);h.ui.selected=[7];h.ui.mode={kind:'ability',arg:'scan'};
    h.minimap.getBoundingClientRect=()=>({left:30,top:50,width:360,height:180});
    h.ui.game.world.extent=200;const cam={...h.ui.game.s.cam};
    h.ui.game.ability=(...args)=>{h.calls.push(['ability',...args]);return success;};
    h.pointer('pointerdown',300,95,{target:h.minimap,pointerType});
    h.pointer('pointermove',310,100,{target:h.minimap,pointerType});
    h.pointer('pointerup',310,100,{target:h.minimap,pointerType});
    assert.equal(h.calls.length,1);assert.equal(h.calls[0][1],'scan');
    assert.equal(h.calls[0][2].x,100);assert.equal(h.calls[0][2].z,-100);
    assert.deepEqual(h.ui.game.s.cam,cam);assert.deepEqual(h.ui.selected,[7]);
    assert.equal(h.ui.mode?.arg,success?undefined:'scan');
  }
});

test('minimap navigation preserves non-Scan targeting without issuing orders', () => {
  for(const mode of [{kind:'ability',arg:'orbital'},{kind:'ability',arg:'repair'},{kind:'build',arg:'depot'},{kind:'rally'}]) {
    const h=setup();h.UI.prototype.bind.call(h.ui);h.ui.mode=mode;h.ui.selected=[7];
    h.pointer('pointerdown',100,100,{target:h.minimap});h.pointer('pointerup',100,100,{target:h.minimap});
    assert.deepEqual(h.calls,[]);assert.strictEqual(h.ui.mode,mode);assert.deepEqual(h.ui.selected,[7]);
  }
});

test('minimap Scan respects pause, modal, result and lifecycle locks', () => {
  for(const state of ['paused','modalKind','result','leavingBattle','battleIntro']) {
    const h=setup();h.UI.prototype.bind.call(h.ui);h.ui.mode={kind:'ability',arg:'scan'};
    if(state==='result')h.ui.game.s.result='victory';else h.ui[state]=state==='modalKind'?'pause':true;
    h.ui.game.ability=(...args)=>{h.calls.push(args);return true;};
    h.pointer('pointerdown',100,100,{target:h.minimap});h.pointer('pointerup',100,100,{target:h.minimap});
    assert.deepEqual(h.calls,[]);assert.equal(h.ui.mode.arg,'scan');
  }
});

test('minimap tap/drag navigates to the full map bounds', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  h.ui.game.s.cam.zoom = 115;
  h.pointer('pointerdown', 100, 110, { target: h.minimap });
  assert.ok(Math.abs(h.ui.game.s.cam.x - Math.min(10,flatCameraLimits(h.ui).x)) < 1e-10);
  assert.ok(Math.abs(h.ui.game.s.cam.z - 20) < 1e-10);
  assert.equal(h.ui.game.s.cam.zoom, 115);
  h.pointer('pointermove', 180, 0, { target: h.minimap });
  const limits=flatCameraLimits(h.ui);
  assert.deepEqual(h.ui.game.s.cam, { x: limits.x, z: -limits.z, zoom: 115 });
  h.pointer('pointerup', 180, 0, { target: h.minimap });
  h.pointer('pointermove', 90, 90, { target: h.minimap });
  assert.deepEqual(h.ui.game.s.cam, { x: limits.x, z: -limits.z, zoom: 115 });
  assert.deepEqual(h.calls, []);
});

test('minimap uses current offset and dimensions for navigation without issuing orders', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  h.minimap.getBoundingClientRect = () => ({ left: 30, top: 50, width: 360, height: 180 });
  h.pointer('pointerdown', 210, 95, { target: h.minimap });
  assert.deepEqual(h.ui.game.s.cam, { x: 0, z: -45, zoom: 50 });
  h.minimap.getBoundingClientRect = () => ({ left: 40, top: 70, width: 180, height: 360 });
  h.pointer('pointermove', 175, 340, { target: h.minimap });
  assert.deepEqual(h.ui.game.s.cam, { x: 45, z: 45, zoom: 50 });
  h.pointer('pointercancel', 175, 340, { target: h.minimap });
  h.pointer('pointermove', 40, 70, { target: h.minimap });
  assert.deepEqual(h.ui.game.s.cam, { x: 45, z: 45, zoom: 50 });
  h.pointer('pointerdown', 85, 160, { target: h.minimap, button: 2 });
  assert.deepEqual(h.calls, []);
});

test('ability and category actions dispatch only while unpaused', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.perform = h.UI.prototype.perform;
  for (const action of ['ability:orbital','ability:repair','ability:scan','ability:drop'])
    h.click({ action });
  for (const tab of ['root','build','infantry','vehicles','aircraft']) h.click({ action: 'tab:' + tab });
  assert.deepEqual(h.calls, [
    ['mode','ability','orbital'], ['mode','ability','repair'], ['mode','ability','scan'],
    ['mode','ability','drop'],
    ['tab','root'], ['tab','build'], ['tab','infantry'], ['tab','vehicles'], ['tab','aircraft']
  ]);
  h.calls.length = 0; h.ui.paused = true; h.click({ action: 'ability:orbital' });
  h.UI.prototype.perform.call(h.ui, 'tab:build');
  assert.deepEqual(h.calls, []);
});

function favoriteHarness() {
  const h=setup();
  for(const method of ['perform','setTab'])h.ui[method]=h.UI.prototype[method];
  h.UI.prototype.bind.call(h.ui);
  return h;
}

test('favorite replacement changes only its slot, persists preferences and never executes the picked action', () => {
  for(const action of ['train:hero','build:barracks']) {
    const h=favoriteHarness();let saved=0;h.ui.persistence.saveProfile=()=>{saved++;return true;};
    h.ui.game.recruitmentReason=()=> 'No producer';h.ui.game.cost=()=>({cost:9999,gas:0});
    h.ui.mode={kind:'ability',arg:'scan'};h.ui.beginFavoriteEdit(2);
    assert.equal(h.ui.mode,null);assert.equal(h.ui.editFavoriteSlot,2);
    assert.match(h.document.getElementById('actions').innerHTML,/favorite-edit/);
    h.ui.perform(action.startsWith('build')?'tab:build':'tab:infantry');
    assert.equal(h.ui.editFavoriteSlot,2);assert.equal(h.ui.actionReason(action),'');
    h.ui.perform(action);
    assert.deepEqual(Array.from(h.ui.quickAccess()),['favorite:worker','favorite:rifle',action.replace('train:','favorite:'),'build:barracks']);
    assert.equal(saved,1);assert.equal(h.ui.tab,'root');assert.equal(h.ui.editFavoriteSlot,null);
    assert.equal(h.ui.mode,null);assert.deepEqual(h.calls,[]);
  }
});

test('favorite editing survives catalog back navigation and cancels on slot tap, pause or lifecycle lock', () => {
  const h=favoriteHarness();h.ui.beginFavoriteEdit(1);h.ui.perform('tab:vehicles');h.ui.perform('tab:root');
  assert.equal(h.ui.editFavoriteSlot,1);
  h.click({favoriteSlot:'1',action:'favorite:rifle'});
  assert.equal(h.ui.editFavoriteSlot,null);assert.deepEqual(h.calls,[]);
  h.ui.beginFavoriteEdit(2);h.ui.pause();assert.equal(h.ui.editFavoriteSlot,null);
  h.ui.beginFavoriteEdit(0);assert.equal(h.ui.editFavoriteSlot,null);
});

test('favorite hold enters editing after 550ms, suppresses its click and cancels on movement or pointercancel', () => {
  for(const end of ['hold','move','cancel','tap']) {
    const h=favoriteHarness(),timers=new Map();let id=0;
    h.context.setTimeout=(fn,ms)=>{timers.set(++id,{fn,ms});return id;};h.context.clearTimeout=id=>timers.delete(id);
    h.ui.game.train=(...args)=>h.calls.push(['train',...args]);
    const b={dataset:{favoriteSlot:'1',action:'favorite:rifle'}},event={target:{closest:()=>b},button:0,pointerId:1,clientX:20,clientY:20,preventDefault(){}};
    h.document.handlers.pointerdown(event);assert.equal([...timers.values()][0].ms,550);
    if(end==='move')h.document.handlers.pointermove({...event,clientX:40});
    if(end==='cancel')h.document.handlers.pointercancel(event);
    if(end==='hold'){[...timers.values()][0].fn();assert.equal(h.ui.editFavoriteSlot,1);}
    else assert.equal(h.ui.editFavoriteSlot,null);
    h.document.handlers.pointerup(event);
    if(end==='hold'||end==='tap')h.document.handlers.click(event);
    assert.equal(h.calls.length,end==='tap'?1:0);
    assert.equal(h.ui.editFavoriteSlot,end==='hold'?1:null);
    if(end!=='hold')assert.equal(timers.size,0);
  }
});

test('favorite long press still enters editing if a busy frame delays the hold timer until release', () => {
  const h=favoriteHarness(),timers=new Map();let id=0;h.setTime(1000);
  h.context.setTimeout=(fn,ms)=>{timers.set(++id,{fn,ms});return id;};h.context.clearTimeout=id=>timers.delete(id);
  const b={dataset:{favoriteSlot:'2',action:'build:depot'}},event={target:{closest:()=>b},button:0,pointerId:1,clientX:20,clientY:20,timeStamp:1000,preventDefault(){}};
  h.document.handlers.pointerdown(event);h.document.handlers.pointerup({...event,timeStamp:1700});
  h.document.handlers.click(event);
  assert.equal(h.ui.editFavoriteSlot,2);assert.deepEqual(h.calls,[]);
});

test('worker remains reachable and tutorial-guided when its favorite was replaced', () => {
  const h=favoriteHarness();h.ui.profile.quickAccess=['favorite:rifle','favorite:medic','build:depot','build:barracks'];
  h.ui.battleTutorial={step:'trainWorker',workersTrained:0};h.ui.tab='root';
  assert.equal(h.ui.tutorialAction(),'tab:infantry');
  h.ui.setTab('infantry');assert.match(h.document.getElementById('actions').innerHTML,/data-action="train:worker"/);
  assert.equal(h.ui.tutorialAction(),'train:worker');
  assert.match(h.ui.tutorialGoalText(),/Infantry menu/);
});

test('repeating the active targeting action cancels without changing selection or game state', () => {
  for (const [kind, arg] of [['build','depot'], ['rally'],
    ...['orbital','repair','scan','drop'].map(a => ['ability',a])]) {
    const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
    h.ui.setMode = h.UI.prototype.setMode; h.ui.perform = h.UI.prototype.perform;
    if (kind === 'build') h.ui.tab = 'build';
    if (kind === 'rally') {
      h.ui.game.s.entities = [{id:7,team:0,kind:'building',type:'barracks',hp:100,progress:1,queue:[]}];
      h.ui.tab = 'root';
    }
    const state = JSON.stringify(h.ui.game.s), action = kind === 'rally' ? 'rally' : `${kind}:${arg}`;
    h.ui.setMode(kind, arg);
    assert.equal(h.ui.mode.kind, kind);
    h.click({ action });
    assert.equal(h.ui.mode, null);
    assert.deepEqual(h.ui.selected, [7]); assert.equal(h.ui.paused, false);
    assert.equal(JSON.stringify(h.ui.game.s), state); assert.deepEqual(h.calls, []);
  }
});

test('pause and visibility changes preserve battle state and require explicit resume', () => {
  const h=setup(); h.UI.prototype.bind.call(h.ui);
  const state=h.ui.game.s, before=JSON.stringify(state);
  h.ui.pause(); assert.equal(h.ui.paused,true);
  h.ui.resume(); assert.equal(h.ui.paused,false);
  h.document.hidden=true; h.document.handlers.visibilitychange(); assert.equal(h.ui.paused,true);
  h.document.hidden=false; h.document.handlers.visibilitychange(); assert.equal(h.ui.paused,true);
  h.ui.resume(); assert.equal(h.ui.paused,false);
  state.time=90; h.ui.tick(.1); state.time=0;
  assert.strictEqual(h.ui.game.s,state); assert.equal(JSON.stringify(state),before); assert.deepEqual(h.calls,[]);
});

// UI orchestration uses a small CPU stub; real snapshot validation/restore lives in persistence checks.
function savedUIBattle() {
  const h = setup(), game = h.ui.game, copy = value => JSON.parse(JSON.stringify(value));
  Object.assign(game.s, { map: 'desert', seed: 1409, depth: 0, result: null, time: 42, speed: 2 });
  h.ui.expedition = { version: 8, battle: null, faction: 0, abilities: ['orbital', 'repair', 'scan', 'drop'],
    depth: 0, upgrades: {}, benefits: {}, enemyBenefits: [{}],
    encounter: { deployment: 'exploration', mission: 'hq-elimination', enemies: [2], map: 'desert', seed: 1409 } };
  game.snapshotSafe = true; game.snapshotBattle = () => ({ version: 1, state: copy(game.s), tutorial: null });
  game.start = () => assert.fail('A saved battle must use restore, not fresh deployment');
  game.restoreBattle = expedition => { game.s = copy(expedition.battle.state); h.ui.event('start', { restored: true }); };
  h.ui.beginBattleTutorial = () => assert.fail('Restore must not restart the tutorial');
  h.ui.openModal = h.UI.prototype.openModal;
  const saves = [];
  h.ui.persistence.available = true;
  h.ui.persistence.saveProgress = (profile, expedition) => { saves.push(copy({ profile, expedition })); return true; };
  return { ...h, saves };
}

test('battle exit defers the main menu after saving and blocks repeated navigation', async () => {
  const h = savedUIBattle(), ui = h.ui, run = ui.game.s;
  h.UI.prototype.bind.call(ui);
  const faction = ui.battleFaction;
  let finish, requests = 0;
  ui.onLeaveBattle = complete => { requests++; finish = complete; ui.leavingBattle = true; ui.paused = true; };
  ui.showHome();
  assert.equal(h.saves.length, 1, 'save before any visual delay');
  assert.strictEqual(ui.game.s, run); assert.equal(ui.view, 'game');
  assert.equal(ui.controlsLocked, true);
  ui.uiAction('home'); ui.uiAction('resume'); ui.resume(); ui.showHome();
  h.click({ faction: '0' });
  assert.equal(ui.battleFaction, faction, 'delegated controls behind the cover are also blocked');
  assert.equal(requests, 1); assert.equal(ui.paused, true);
  assert.equal(h.saves.length, 1);
  await finish();
  assert.equal(ui.view, 'home'); assert.equal(ui.game.s, null);
  assert.equal(h.saves.length, 1, 'completing presentation does not save again');
});

test('battle exit still warns before animation when saving fails', () => {
  const h = savedUIBattle(), ui = h.ui;
  let requested = 0;
  ui.persistence.saveProgress = () => false;
  ui.onLeaveBattle = () => { requested++; };
  ui.showHome();
  assert.equal(requested, 0); assert.equal(ui.modalKind, 'saveUnavailable');
  ui.uiAction('leaveUnsaved');
  assert.equal(requested, 1, 'explicitly leaving without storage may animate');
});

test('battle exit starts only after confirmed abandonment and never restores the discarded expedition', async () => {
  const h = savedUIBattle(), ui = h.ui, run = ui.game.s;
  let finish, requests = 0;
  ui.onLeaveBattle = complete => { requests++; finish = complete; ui.leavingBattle = true; };
  ui.pause(); ui.uiAction('abandon');
  assert.equal(requests, 0, 'opening confirmation is not an exit');
  ui.uiAction('closeModal'); assert.equal(requests, 0);
  ui.uiAction('abandon'); ui.uiAction('confirmAbandon');
  assert.equal(requests, 1); assert.equal(ui.expedition, null);
  assert.strictEqual(ui.game.s, run, 'scene stays available while sliding out');
  assert.equal(h.saves.filter(save => save.expedition === null).length, 1);
  ui.uiAction('confirmAbandon'); assert.equal(requests, 1);
  await finish();
  assert.equal(ui.view, 'home'); assert.equal(ui.game.s, null);
  assert.equal(h.saves.filter(save => save.expedition === null).length, 1);
});

test('battle exit is not used for victory or defeat, only for their subsequent return to the main menu', () => {
  for (const win of [true, false]) {
    const h = savedUIBattle(), ui = h.ui;
    const result = { win, text: 'HQ destroyed', time: 42, integrity: .5, score: 1 };
    ui.game.s.stats = { kills: 0, lost: 0, gathered: 0 }; ui.game.s.result = result;
    h.document.getElementById('result').classList.add('hidden');
    let finish, requests = 0;
    ui.onLeaveBattle = complete => { requests++; finish = complete; ui.leavingBattle = true; ui.paused = true; };
    ui.event('result', result);
    assert.equal(h.saves.length, 1); assert.equal(requests, 0);
    ui.event('result', result);
    assert.equal(h.saves.length, 1); assert.equal(requests, 0);
    assert.equal(ui.modalKind, 'result');
    assert.equal(h.document.getElementById('hud').classList.contains('hidden'), true);
    assert.equal(h.document.getElementById('result').classList.contains('hidden'), false);
    assert.equal(h.saves.length, 1);
    assert.equal(win ? ui.expedition.depth : ui.expedition, win ? 1 : null);
    ui.showHome();
    assert.equal(requests, 1, 'only returning to the main menu starts the fade');
    assert.equal(ui.view, 'game');
    finish();
    assert.equal(ui.view, 'home');
    assert.equal(h.saves.length, 1);
  }
});

test('battle exit is bypassed when continuing to build after victory', () => {
  const h = savedUIBattle(), ui = h.ui;
  ui.game.s.stats = { kills: 0, lost: 0, gathered: 0 };
  ui.game.s.result = { win: true, text: 'Victory', time: 42, integrity: 1, score: 1 };
  ui.onLeaveBattle = () => assert.fail('Continue building does not leave for the main menu');
  ui.event('result', ui.game.s.result);
  let visited;
  ui.onLaunchBattle = async (options, recipe, world) => { visited = world; return false; };
  ui.continueBuilding();
  assert.strictEqual(visited, ui.expedition.worlds[0]);
  assert.equal(ui.leavingBattle, false);
});

test('pause abandonment requires confirmation; cancel preserves the expedition and stale confirmations do nothing', () => {
  const h = savedUIBattle(), ui = h.ui;
  h.UI.prototype.bind.call(ui);
  const expedition = ui.expedition, battle = ui.game.s, profile = JSON.stringify(ui.profile);
  const cleared = () => h.saves.filter(save => save.expedition === null).length;
  h.click({ ui: 'confirmAbandon' });
  assert.equal(cleared(), 0, 'confirmation outside its dialog is ignored');
  ui.pause();
  h.click({ ui: 'abandon' });
  assert.equal(ui.modalKind, 'abandonExpedition');
  assert.strictEqual(ui.expedition, expedition); assert.strictEqual(ui.game.s, battle);
  assert.equal(ui.paused, true); assert.equal(cleared(), 0);
  h.click({ ui: 'closeModal' });
  assert.equal(ui.modalKind, 'pause'); assert.equal(ui.paused, true);
  assert.strictEqual(ui.expedition, expedition); assert.strictEqual(ui.game.s, battle);
  h.click({ ui: 'confirmAbandon' }); assert.equal(cleared(), 0, 'cancel invalidates confirmation');
  h.click({ ui: 'abandon' }); h.click({ ui: 'confirmAbandon' });
  assert.equal(ui.expedition, null); assert.equal(ui.game.s, null); assert.equal(ui.view, 'home');
  assert.equal(cleared(), 1); assert.equal(JSON.stringify(ui.profile), profile);
  h.click({ ui: 'confirmAbandon' }); assert.equal(cleared(), 1, 'duplicate confirmation is ignored');
});

test('battle autosave, pagehide and main menu preserve tutorial goals and continue directly without redeployment', () => {
  const h = savedUIBattle(), ui = h.ui;
  h.UI.prototype.bind.call(ui);
  ui.battleTutorial = { step: 'trainWorker', achieved: new Set(['buildHQ']), workersTrained: 1, elapsed: 0 };
  h.setTime(4999); ui.autosaveBattle(); assert.equal(h.saves.length, 0);
  h.setTime(5000); ui.autosaveBattle(); assert.equal(h.saves.length, 1);
  h.window.handlers.pagehide(); assert.equal(h.saves.length, 2);
  const state = JSON.stringify(ui.game.s); ui.showHome(); assert.equal(ui.game.s, null);
  ui.profile.expeditionDepth = 25;
  ui.continueExpedition();
  assert.equal(ui.view, 'game'); assert.equal(ui.paused, false); assert.equal(JSON.stringify(ui.game.s), state);
  assert.equal(ui.modalKind, '');
  assert.equal(h.document.getElementById('modal').classList.contains('hidden'), true);
  assert.equal(ui.battleTutorial.step, 'trainWorker'); assert.equal(ui.battleTutorial.workersTrained, 1);
  assert.deepEqual([...ui.battleTutorial.achieved], ['buildHQ']);
  assert.deepEqual(ui.game.s.parties[0].meta, {}, 'profile progress does not change restored battle upgrades');
  assert.equal(ui.expedition.battle.tutorial.cameraHome, undefined, 'ordinary tutorial goals do not add a phantom camera target');
  ui.pause(); assert.equal(ui.paused, true); assert.equal(ui.modalKind, 'pause');
  ui.resume(); assert.equal(ui.paused, false);
});

test('supply tutorial recruitment and depot goals continue directly without losing progress', () => {
  for (const step of ['trainRifle', 'buildDepot']) {
    const h = savedUIBattle(), ui = h.ui, g = ui.game;
    g.s.entities = [{ id: 1, team: 0, kind: 'building', type: 'hq', hp: 100, progress: 1, queue: [] },
      { id: 2, team: 0, kind: 'building', type: 'barracks', hp: 100, progress: 1, queue: [{ type: 'rifle' }] },
      ...Array.from({ length: 5 }, (_, i) =>
        ({ id: i + 3, team: 0, kind: 'unit', type: i < 3 ? 'worker' : 'rifle', hp: 100 }))];
    const goals = ['buildHQ', 'trainWorker', 'buildRefinery', 'buildBarracks', 'trainRifle'];
    ui.battleTutorial = { step, achieved: new Set(goals), workersTrained: 2, elapsed: 0 };
    const state = JSON.stringify(g.s);
    ui.showHome();
    ui.continueExpedition();
    assert.equal(ui.paused, false);
    assert.equal(ui.modalKind, '');
    assert.equal(ui.battleTutorial.step, step);
    assert.equal(ui.battleTutorial.workersTrained, 2);
    assert.deepEqual([...ui.battleTutorial.achieved], goals);
    assert.equal(ui.profile.tutorialComplete, false);
    assert.equal(JSON.stringify(g.s), state);
    ui.reconcileBattleTutorial();
    assert.equal(ui.battleTutorial.step, step);
    assert.equal(ui.tutorialAction(), step === 'trainRifle' ? 'tab:infantry' : 'tab:build');
  }
});

test('failed battle save warns before leaving and keeps a usable volatile snapshot in this tab', () => {
  const h = savedUIBattle(), ui = h.ui, state = ui.game.s;
  ui.persistence.available = false; ui.persistence.saveProgress = () => false;
  ui.showHome(); assert.strictEqual(ui.game.s, state); assert.equal(ui.modalKind, 'saveUnavailable');
  ui.uiAction('leaveUnsaved'); assert.equal(ui.view, 'home'); assert.equal(ui.game.s, null);
  ui.continueExpedition(); assert.equal(ui.game.s.time, 42); assert.equal(ui.paused, false);
  assert.equal(ui.modalKind, '');
});

test('blocked expedition saves require explicit discard and concurrent launch attempts do not redeploy', async () => {
  const h = savedUIBattle(), ui = h.ui;
  ui.battleSaveError = 'damaged'; ui.continueExpedition(); assert.equal(ui.modalKind, 'battleSaveError');
  ui.uiAction('discardExpeditionSave'); assert.equal(ui.expedition, null); assert.equal(ui.battleSaveError, null);
  assert.equal(h.saves.at(-1).expedition, null);
  const pending = savedUIBattle(); pending.ui.showHome();
  let finish, calls = 0;
  pending.ui.onLaunchBattle = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const launch = pending.ui.startExpeditionBattle(); await pending.ui.startExpeditionBattle();
  assert.equal(calls, 1); finish(); await launch; assert.equal(pending.ui.launchingBattle, false);
});

test('pause restart actions cannot redeploy a running expedition', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  h.ui.expedition = { version: 8, battle: null, faction: 1, abilities: ['orbital','repair','scan','drop'], encounter: { mission: 'hq-elimination', enemies: [2, 0], map: 'desert', seed: 1409 },
    upgrades: {}, benefits: {}, enemyBenefits: [{ fieldWorkshop: 1 }, { supplyCrate: 1 }], depth: 3 };
  const state = h.ui.game.s; let starts = 0;
  h.ui.game.start = () => { starts++; };
  h.ui.pause(); h.click({ ui: 'restartConfirm' }); h.click({ ui: 'restart' }); h.ui.continueExpedition();
  assert.equal(starts, 0); assert.strictEqual(h.ui.game.s, state); assert.equal(h.ui.paused, true);
});

test('victory checkpoints the completed world once; defeat clears the expedition', () => {
  const h=setup(),saved=[],cleared=[];
  h.ui.persistence.saveProgress=(_profile,value)=>value===null?cleared.push(true):saved.push(JSON.parse(JSON.stringify(value)));
  h.ui.expedition={version:8,battle:null,worlds:[],faction:0,abilities:['orbital','repair','scan','drop'],depth:0,upgrades:{orbital:2},benefits:{supplyCrate:1},enemyBenefits:[{}],
    encounter:{mission:'hq-elimination',enemies:[1],map:'desert',seed:1409}};
  const previousMap=h.ui.expedition.encounter.map;h.ui.game.s.result={win:true};
  h.ui.event('result',{win:true,text:'Victory'});
  assert.equal(h.ui.expedition.depth,1);assert.equal(saved.length,1);
  assert.equal(saved[0].battle,null);assert.equal(saved[0].worlds[0].recipe.upgrades.orbital,2);
  assert.notEqual(saved[0].encounter.map,previousMap);
  assert.deepEqual(JSON.parse(JSON.stringify(saved[0].upgrades)),{});
  assert.deepEqual(JSON.parse(JSON.stringify(saved[0].enemyBenefits)),[{}]);
  h.ui.event('result',{win:true});assert.equal(saved.length,1);
  h.ui.game.s={...h.ui.game.s};h.ui.event('result',{win:false,text:'Defeat'});
  assert.equal(h.ui.expedition,null);assert.equal(cleared.length,1);
});

test('settings after a result preserve the ended battle and do not replay its sound', () => {
  for(const win of [false,true]){
    const h=setup(),sounds=[];h.UI.prototype.bind.call(h.ui);h.ui.openModal=h.UI.prototype.openModal;
    h.ui.audio.sound=name=>sounds.push(name);h.ui.game.s.result={win,text:'HQ destroyed'};
    const state=h.ui.game.s,before=JSON.stringify(state);h.ui.event('result',state.result);
    h.click({ui:'settings'});assert.equal(h.ui.modalKind,'settings');h.click({ui:'closeModal'});
    assert.equal(h.ui.modalKind,'');assert.equal(h.document.getElementById('result').classList.contains('hidden'),false);assert.strictEqual(h.ui.game.s,state);assert.equal(JSON.stringify(state),before);
    assert.deepEqual(sounds.filter(name=>name==='victory'||name==='defeat'),[win?'victory':'defeat']);
  }
});

test('best expedition depth unlocks factions at 10 and 25', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  for (const [depth, unlocked] of [[0, 0], [9, 0], [10, 1], [24, 1], [25, 2]]) {
    h.ui.profile.expeditionDepth = depth;
    assert.deepEqual([0, 1, 2].map(faction => h.ui.factionUnlocked(faction)),
      [true, unlocked >= 1, unlocked >= 2]);
  }
  h.ui.profile.expeditionDepth = 9;
  h.ui.expedition = { version: 8, battle: null, faction: 0, abilities: ['orbital','repair','scan','drop'], depth: 9, upgrades: {}, benefits: {}, enemyBenefits: [{}, {}, {}],
    encounter: { mission: 'hq-elimination', enemies: [1, 2, 0], map: 'desert', seed: 1409 } };
  h.ui.game.s.stats = { kills: 0, lost: 0, gathered: 0 };
  h.ui.showResult = () => {};
  let saves = 0; h.ui.persistence.saveProgress = () => { saves++; return true; };
  h.ui.event('result', { win: true });
  assert.equal(h.ui.profile.expeditionDepth, 10); assert.equal(h.ui.factionJustUnlocked, 1); assert.equal(saves, 1);
  h.ui.game.s = { ...h.ui.game.s }; h.ui.expedition.depth = 24; h.ui.profile.expeditionDepth = 24;
  h.ui.event('result', { win: true });
  assert.equal(h.ui.profile.expeditionDepth, 25); assert.equal(h.ui.factionJustUnlocked, 2); assert.equal(saves, 2);
});

test('civilian effect lists expose only their family and mark selections without RNG at every tier',()=>{
  const h=setup(),rules=vm.runInContext('({CIVILIZATION_UPGRADES,civilizationUpgradeAllowed})',h.context);
  vm.runInContext("Math.random=()=>{throw Error('UI consumed RNG');}",h.context);
  for(const type of ['fieldlab','researchhub','researchspire','embercottage','terracecommons','hearthtower']){
    const research=type.startsWith('research')||type==='fieldlab',key=research?'orbital':'startingAlloy',
      b={type,upgrade:key,upgradeLevel:2},before=JSON.stringify(b),html=h.ui.renderSettlementUpgrades(b);
    assert.match(html,new RegExp(`${research?'Research':'Residential'} upgrade`));
    assert.doesNotMatch(html,/Local Echo pays for ranks|Switching effects within this building family|Changes apply only to newly started battles/);
    for(const effect of Object.keys(rules.CIVILIZATION_UPGRADES))
      assert.equal(html.includes(`data-action="settlementUpgrade:${effect}"`),rules.civilizationUpgradeAllowed(type,effect));
    assert.match(html,new RegExp(`data-action="settlementUpgrade:${key}"[^>]*aria-pressed="true"`));
    assert.equal(JSON.stringify(b),before);
  }
  const unavailable=h.ui.renderSettlementUpgrades({type:'embercottage',upgrade:'orbital',upgradeLevel:2});
  assert.match(unavailable,/stored effect is unavailable/);assert.doesNotMatch(unavailable,/aria-pressed="true"/);
  assert.match(unavailable,/data-action="settlementClear"/);
});

test('home and transition previews use the actual next landscape and atmosphere seed', () => {
  const h = setup(), maps = [];
  h.ui.expedition = { faction: 0, abilities: ['orbital','repair','scan','drop'], depth: 2, upgrades: {}, benefits: {}, enemyBenefits: [{}],
    encounter: { mission: 'hq-elimination', enemies: [2], map: 'frontier', seed: 1409 } };
  h.ui.onPreview = (map, seed) => maps.push([map, seed]);
  h.ui.showHome();
  assert.deepEqual(maps, [['frontier',1409]]);
  h.ui.expedition.encounter.seed=7919;
  h.ui.showExpeditionTransition();
  assert.deepEqual(maps, [['frontier',1409],['frontier',7919]]);
});

test('expedition encounter generation excludes the immediately previous map', () => {
  const h = setup();
  vm.runInContext('Math.random = () => 0;', h.context);
  for (const previousMap of ['desert', 'alien-planet', 'mothership', 'westmark', 'frontier', 'haven'])
    assert.notEqual(h.ui.createEncounter(3, previousMap).map, previousMap);
});

test('expedition setup creates and saves the fixed Free Marches opening encounter', () => {
  const h = setup(); h.ui.profile.expeditionDepth = 25; h.ui.battleFaction = 2;
  vm.runInContext('Math.random = () => .999;', h.context);
  h.ui.view = 'battle';
  const saved = []; h.ui.persistence.saveProgress = (profile, value) => saved.push(JSON.parse(JSON.stringify(value)));
  h.ui.game.start = () => { throw Error('Battle started before renderer preparation'); };
  h.ui.onLaunchBattle = opts => h.calls.push(['start', JSON.parse(JSON.stringify(opts))]);
  h.ui.startBattle();
  assert.equal(saved.length, 1); assert.equal(saved[0].faction, 2); assert.equal(saved[0].depth, 0);
  assert.equal(saved[0].encounter.enemies.length, 1);
  assert.deepEqual(saved[0].encounter.enemies, [0]);
  assert.equal(saved[0].encounter.mission, 'hq-elimination');
  const openingMaps = vm.runInContext("MISSIONS['hq-elimination'].maps", h.context);
  assert.ok(openingMaps.includes(saved[0].encounter.map));
  assert.ok(saved[0].encounter.seed > 0);
  assert.deepEqual(h.calls[0][1], { faction: 2, ...saved[0].encounter,
    abilities: ['orbital', 'repair', 'scan', 'drop'], upgrades: {}, benefits: {}, enemyBenefits: [{}], depth: 0 });
});

test('DOM press guard tracks pointer presses on controls', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  h.document.handlers.pointerdown({ target: { closest: () => ({}) } });
  assert.equal(h.ui.domPressed, true);
  h.document.handlers.pointerup(); assert.equal(h.ui.domPressed, false);
  h.document.handlers.pointerdown({ target: { closest: () => null } });
  assert.equal(h.ui.domPressed, false);
});

function buildingPanel() {
  const h = setup(), b = { id: 7, kind: 'building', type: 'barracks', team: 0, faction: 0, hp: 100, maxHp: 200, progress: 1, x: 0, z: 0, queue: [] };
  h.ui.game.s.entities = [b]; h.ui.selected = [7]; h.ui.tab = 'root';
  h.ui.setTab = h.UI.prototype.setTab;
  h.ui.perform = h.UI.prototype.perform;
  return { ...h, b };
}

test('invalid building selections leave building context', () => {
  const h = buildingPanel(); h.b.hp = 0; h.ui.renderActions();
  assert.equal(h.ui.tab, 'root');
  for (const mode of ['enemy','unit','many','none']) {
    const h = buildingPanel();
    if (mode === 'enemy') h.b.team = 1;
    if (mode === 'unit') h.b.kind = 'unit';
    if (mode === 'many') h.ui.selected = [7,8];
    if (mode === 'none') h.ui.selected = [];
    h.ui.renderActions(); assert.equal(h.ui.tab, 'root', mode);
  }
});

test('selected workers turn own foundation/damaged target taps into work orders without changing selection', () => {
  for (const pointerType of ['touch', 'mouse']) for (const attackMove of [false, true])
    for (const kind of ['foundation', 'building', 'unit']) {
      const h = setup(); h.UI.prototype.bind.call(h.ui);
      const worker = { id: 7, kind: 'unit', type: 'worker', team: 0, hp: 100 },
        soldier = { id: 8, kind: 'unit', type: 'rifle', team: 0, hp: 100 },
        target = { id: 9, kind: kind === 'unit' ? 'unit' : 'building', type: kind === 'unit' ? 'rifle' : 'depot',
          team: 0, hp: 50, maxHp: 100, progress: kind === 'foundation' ? .1 : 1, x: 10, z: 20 };
      h.ui.game.s.entities = [worker, soldier, target]; h.ui.selected = [7, 8];
      h.ui.attackMove = attackMove; h.ui.pick = () => target;
      h.pointer('pointerdown', 200, 200, { pointerType }); h.pointer('pointerup', 200, 200, { pointerType });
      assert.equal(h.calls.length, 1); assert.equal(h.calls[0][0], 'command');
      assert.deepEqual(h.calls[0][1], [7, 8]);
      assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0][2])), { type: 'smart', id: 9, x: 10, z: 20 });
      assert.deepEqual(h.ui.selected, [7, 8]);
      h.calls.length = 0; h.ui.paused = true;
      h.pointer('pointerdown', 200, 200, { pointerType }); h.pointer('pointerup', 200, 200, { pointerType });
      assert.deepEqual(h.calls, []);
    }
});

test('selected workers send smart supply orders to healthy completed Forums by touch or mouse',()=>{
  for(const [pointerType,button] of [['touch',0],['mouse',0],['mouse',2]]) {
    const h=setup();h.UI.prototype.bind.call(h.ui);
    const worker={id:7,kind:'unit',type:'worker',team:0,hp:100},
      forum={id:9,kind:'building',type:'meridianforum',team:0,hp:100,maxHp:100,progress:1,x:10,z:20};
    h.ui.game.s.rules.completed=true;h.ui.game.s.entities=[worker,forum];h.ui.selected=[7];h.ui.pick=()=>forum;
    h.ui.game.canSupplyForum=vm.runInContext('MeridianGame.prototype.canSupplyForum',h.context);
    h.pointer('pointerdown',200,200,{pointerType,button});h.pointer('pointerup',200,200,{pointerType,button});
    assert.equal(h.calls.length,1);assert.equal(h.calls[0][0],'command');
    assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0][2])),{type:'smart',id:9,x:10,z:20});
    assert.deepEqual(h.ui.selected,[7]);
  }
});

test('healthy own targets, self taps and selections without workers still select normally', () => {
  for (const mode of ['healthy', 'self', 'no-worker', 'deselected']) {
    const h = setup(); h.UI.prototype.bind.call(h.ui);
    const worker = { id: 7, kind: 'unit', type: 'worker', team: 0, hp: 50, maxHp: 100, progress: 1 },
      target = { id: 8, kind: 'building', type: 'depot', team: 0, hp: mode === 'healthy' ? 100 : 50, maxHp: 100, progress: 1 };
    if (mode === 'no-worker') worker.type = 'rifle';
    h.ui.game.s.entities = [worker, target]; h.ui.selected = mode === 'deselected' ? [] : [7];
    h.ui.pick = () => mode === 'self' ? worker : target;
    h.pointer('pointerdown', 200, 200); h.pointer('pointerup', 200, 200);
    assert.deepEqual(h.calls, [['select', [mode === 'self' ? 7 : 8]]]);
  }
});

test('worker context taps do not override explicit targeting or camera drags', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  const worker = { id: 7, kind: 'unit', type: 'worker', team: 0, hp: 100 },
    target = { id: 8, kind: 'building', team: 0, hp: 50, maxHp: 100, progress: .1, x: 10, z: 20 };
  h.ui.game.s.entities = [worker, target]; h.ui.selected = [7]; h.ui.pick = () => target;
  h.ui.mode = { kind: 'ability', arg: 'scan' };
  h.ui.game.ability = () => { h.calls.push(['ability']); return true; };
  h.pointer('pointerdown', 200, 200); h.pointer('pointerup', 200, 200);
  assert.deepEqual(h.calls, [['ability']]); h.calls.length = 0;
  h.pointer('pointerdown', 200, 200); h.pointer('pointermove', 230, 220); h.pointer('pointerup', 230, 220);
  assert.deepEqual(h.calls, []); assert.deepEqual(h.ui.selected, [7]);
});

test('building ground taps/clicks only deselect, including right-click and foundations', () => {
  for (const pointerType of ['touch','mouse']) for (const button of [0,2])
    for (const progress of [.5,1]) for (const target of [null,{id:99,team:1,kind:'unit',type:'rifle',x:30,z:40}]) {
      const h = buildingPanel(); h.UI.prototype.bind.call(h.ui);
      h.ui.select = h.UI.prototype.select;
      h.b.progress = progress; h.b.rally = {x:5,z:6}; h.ui.pick = () => target;
      h.pointer('pointerdown',200,200,{pointerType,button});
      h.pointer('pointerup',200,200,{pointerType,button});
      assert.deepEqual(Array.from(h.ui.selected), []); assert.equal(h.ui.tab,'root');
      assert.deepEqual(h.b.rally,{x:5,z:6}); assert.deepEqual(h.calls,[]);
    }
});

test('building camera gestures and minimap navigation preserve selection and do not set rally', () => {
  const h = buildingPanel(); h.UI.prototype.bind.call(h.ui); h.ui.select = h.UI.prototype.select;
  h.pointer('pointerdown',200,200); h.pointer('pointermove',240,230); h.pointer('pointerup',240,230);
  assert.deepEqual(Array.from(h.ui.selected),[7]); assert.equal(h.b.rally,undefined);
  h.pointer('pointerdown',100,100,{target:h.minimap}); h.pointer('pointerup',100,100,{target:h.minimap});
  assert.deepEqual(Array.from(h.ui.selected),[7]); assert.equal(h.b.rally,undefined);
  h.pointer('pointerdown',100,100,{target:h.minimap,pointerType:'mouse',button:2});
  h.pointer('pointerup',100,100,{target:h.minimap,pointerType:'mouse',button:2});
  assert.deepEqual(Array.from(h.ui.selected),[7]); assert.deepEqual(h.calls,[]);
  const own = {id:8,kind:'unit',type:'worker',team:0,hp:100}; h.ui.game.s.entities.push(own);
  h.ui.select([7]); h.ui.pick = () => own;
  h.pointer('pointerdown',200,200); h.pointer('pointerup',200,200);
  assert.deepEqual(Array.from(h.ui.selected),[8]); assert.equal(h.b.rally,undefined);
});

test('only the Rally point button arms placement; a following normal tap deselects without changing it', () => {
  for (const mini of [false,true]) for (const pointerType of ['touch','mouse']) {
    const h = buildingPanel(); h.UI.prototype.bind.call(h.ui);
    h.ui.select = h.UI.prototype.select; h.ui.setMode = h.UI.prototype.setMode;
    h.click({action:'rally'}); assert.equal(h.ui.mode.kind,'rally');
    const options = {target:mini ? h.minimap : h.world,pointerType},sounds=[];
    h.ui.audio.sound=key=>sounds.push(key);
    h.ui.game.random=()=>{throw Error('Rally feedback consumed simulation RNG');};
    h.pointer('pointerdown',100,100,options); h.pointer('pointerup',100,100,options);
    if (mini) {
      assert.equal(h.b.rally, undefined); assert.equal(h.ui.mode.kind, 'rally');
      assert.deepEqual(Array.from(h.ui.selected), [7]); continue;
    }
    assert.ok(h.b.rally); assert.equal(h.ui.mode,null); assert.deepEqual(Array.from(h.ui.selected),[7]);
    assert.equal(h.ui.pings.length,1);assert.deepEqual(sounds,['order']);
    const ping=h.ui.pings[0];
    assert.deepEqual([ping.x,ping.z,ping.life,ping.maxLife],[h.b.rally.x,h.b.rally.z,1,1]);
    const rally = JSON.stringify(h.b.rally);
    h.pointer('pointerdown',200,200); h.pointer('pointerup',200,200);
    assert.equal(JSON.stringify(h.b.rally),rally); assert.deepEqual(Array.from(h.ui.selected),[]);
    assert.equal(h.ui.pings.length,1);
    h.ui.tick(.5);assert.equal(ping.life,.5);
    h.ui.tick(.5);assert.equal(h.ui.pings.length,0);
    h.ui.mode={kind:'rally'};h.ui.applyTarget({x:0,z:0});
    assert.equal(h.ui.pings.length,0);assert.deepEqual(sounds.filter(key=>key==='order'),['order']);
    assert.deepEqual(h.calls,[]);
  }
});

test('overlays use selection lookups and cull distant floating text without mutating state or RNG',()=>{
  const h=buildingPanel(),g=h.ui.game;
  h.b.rally={x:12,z:23};
  g.s.entities.push({id:8,team:0,kind:'unit',hp:100,x:2,z:3,order:{type:'move',x:10,z:20}});
  h.ui.selected=[7,8];h.ui.selected.includes=()=>{throw Error('Linear selection lookup');};g.visible=()=>false;
  g.effects.floats=[
    {x:100,y:1,z:100,text:'inside',color:'#fff',life:1,maxLife:1},
    {x:2000,y:1,z:100,text:'outside',color:'#fff',life:1,maxLife:1}
  ];
  g.random=()=>{throw Error('Overlay consumed simulation RNG');};
  const before=JSON.stringify(g.s),paths=[],texts=[];
  const ctx={clearRect(){},save(){},restore(){},setLineDash(){},
    beginPath(){},moveTo(x,y){paths.push(['from',x,y]);},lineTo(x,y){paths.push(['to',x,y]);},stroke(){},
    fillText(text){texts.push(text);}};
  h.ui.drawOverlay(ctx);
  assert.deepEqual(paths.filter(p=>p[0]==='to'),[['to',12,23],['to',10,20]]);
  assert.deepEqual(texts,['inside']);
  assert.equal(JSON.stringify(g.s),before);
});

test('all completed own buildings expose rally; foundations cannot set it and Back cancels targeting', () => {
  for (const type of ['hq','barracks','factory','hangar','depot','refinery','turret']) {
    const h = buildingPanel(); h.b.type = type;
    h.ui.setMode = h.UI.prototype.setMode;
    h.ui.perform('rally'); assert.equal(h.ui.mode.kind, 'rally');
    h.ui.applyTarget({x:12,z:23});
    assert.deepEqual(JSON.parse(JSON.stringify(h.b.rally)), {x:12,z:23});
    h.ui.perform('rally'); h.ui.setTab('root'); assert.equal(h.ui.mode, null);
    h.b.progress = .5; h.ui.perform('rally'); assert.equal(h.ui.mode, null);
  }
});

test('recruitment groups combine own parallel and waiting orders with their producer and queue index', () => {
  const h = setup(), q = (type, progress = 0) => ({type,progress,time:10,cost:75,gas:0});
  const a = {id:1,team:0,kind:'building',queue:[q('rifle',.25),q('rifle'),q('medic')]},
    b = {id:2,team:0,kind:'building',queue:[q('rifle',.6),q('medic')]};
  h.ui.game.s.entities = [a,b,{...a,id:3,team:1}];
  const before = JSON.stringify(h.ui.game.s);
  const summary = () => Object.fromEntries(Object.entries(h.ui.recruitmentGroups()).map(([type, entries]) =>
    [type, Array.from(entries, ({b,index,q}) => [b.id,index,q.progress])]));
  assert.deepEqual(summary(), {rifle:[[1,0,.25],[1,1,0],[2,0,.6]],medic:[[1,2,0],[2,1,0]]});
  assert.strictEqual(h.ui.recruitmentGroups().rifle[0].q, a.queue[0]);
  assert.equal(JSON.stringify(h.ui.game.s), before);
  b.queue.shift();
  assert.deepEqual(summary(), {rifle:[[1,0,.25],[1,1,0]],medic:[[1,2,0],[2,0,0]]});
  a.queue = []; b.queue = [];
  assert.deepEqual(summary(), {});
});

test('queue rendering leaves production state and RNG untouched', () => {
  const h = setup(), g = h.ui.game;
  g.s.entities = [{ id: 1, team: 0, kind: 'building', hp: 100, queue: [
    { type: 'rifle', progress: .2, time: 100 }, { type: 'medic', progress: 0, time: 10 }
  ] }];
  g.random = () => { throw Error('Queue rendering consumed simulation RNG'); };
  const before = JSON.stringify(g.s);
  h.ui.updateQueues(); h.ui.updateQueues();
  assert.equal(JSON.stringify(g.s), before);
});

function queueViewSetup() {
  const h = setup(), g = h.ui.game;
  g.alive = vm.runInContext('MeridianGame.prototype.alive', h.context).bind(g);
  g.random = () => { throw Error('Queue view consumed simulation RNG'); };
  g.s.entities = [{ id: 1, team: 0, kind: 'building', hp: 100, queue: [
    { type: 'rifle', progress: .2, time: 10 }, { type: 'medic', progress: 0, time: 10 }
  ] }];
  h.buttons = () => h.document.getElementById('productionQueue').querySelectorAll('[data-queue-type]');
  h.button = type => h.buttons().find(b => b.dataset.queueType === type);
  return h;
}

function watchQueueWrites(h) {
  const writes = [];
  const property = (object, key, kind) => {
    let value = object[key];
    Object.defineProperty(object, key, { configurable: true, get: () => value,
      set(next) { writes.push(kind); value = next; } });
  };
  property(h.document.getElementById('productionQueue'), 'innerHTML', 'structure');
  for (const button of h.buttons()) {
    property(button.querySelector('.queue-count'), 'textContent', 'count');
    property(button.querySelector('.queue-time'), 'textContent', 'time');
    for (const [object, key, kind] of [[button.style, 'setProperty', 'progress'],
      [button.classList, 'toggle', 'waiting'], [button, 'setAttribute', 'label']]) {
      const original = object[key];
      object[key] = function(...args) { writes.push(kind); return original.apply(this, args); };
    }
  }
  return writes;
}

test('queue view skips unchanged grouping and DOM writes, updating only changed display values', () => {
  const h = queueViewSetup(), g = h.ui.game, original = h.ui.recruitmentGroups;
  let groups = 0;
  h.ui.recruitmentGroups = function() { groups++; return original.call(this); };
  h.ui.updateQueues();
  const writes = watchQueueWrites(h), buttons = h.buttons();
  for (let i = 0; i < 120; i++) { g.s.time += .05; h.ui.updateQueues(); }
  assert.equal(groups, 1, 'time advancing alone does not rebuild recruitment groups');
  assert.deepEqual(writes, []);
  const q = g.s.entities[0].queue[0];
  q.progress = .21; h.ui.updateQueues();
  assert.equal(groups, 2); assert.deepEqual(writes, ['progress'], 'same displayed second and count');
  writes.length = 0;
  q.progress = .31; h.ui.updateQueues();
  assert.deepEqual(writes, ['progress', 'time', 'label']);
  writes.length = 0;
  g.s.entities[0].queue.push({ type: 'rifle', progress: 0, time: 10 });
  h.ui.updateQueues();
  assert.deepEqual(writes, ['count', 'label']);
  assert.strictEqual(h.buttons()[0], buttons[0], 'same types retain clickable nodes');
  assert.strictEqual(h.buttons()[1], buttons[1]);
});

test('queue view keeps parallel-producer minimum, stable ties, waiting status and current cancellation targets', () => {
  const h = queueViewSetup(), g = h.ui.game, a = g.s.entities[0];
  a.queue[0].progress = .5;
  const b = { ...a, id: 2, queue: [{ type: 'rifle', progress: .75, time: 20 }] };
  g.s.entities.push(b);
  h.ui.updateQueues();
  assert.equal(h.button('rifle').style.getPropertyValue('--progress'), '180deg', 'first producer wins equal remaining time');
  assert.equal(h.button('medic').classList.contains('waiting'), true);
  g.s.entities.reverse(); h.ui.updateQueues();
  assert.equal(h.button('rifle').style.getPropertyValue('--progress'), '270deg');
  b.queue[0].time = 40; h.ui.updateQueues();
  assert.equal(h.button('rifle').style.getPropertyValue('--progress'), '180deg', 'duration changes can switch the earliest completion');
  a.queue.shift(); h.ui.updateQueues();
  assert.equal(h.button('medic').classList.contains('waiting'), false, 'new head becomes active without clock advance');
  assert.equal(h.button('medic').style.getPropertyValue('--progress'), '0deg');
  g.submitAction = (team, action) => { h.calls.push([team, action.id, action.index]); return true; };
  h.ui.cancelRecruitment('rifle');
  assert.deepEqual(h.calls, [[0, 2, 0]], 'actions still resolve live producer IDs rather than view cache');
});

test('queue view detects immediate queue edits, producer death and ownership changes without a new tick', () => {
  const h = queueViewSetup(), g = h.ui.game, a = g.s.entities[0];
  h.ui.updateQueues();
  a.queue.push({ type: 'worker', progress: 0, time: 12 }); h.ui.updateQueues();
  assert.ok(h.button('worker'));
  a.queue.pop(); h.ui.updateQueues(); assert.equal(h.button('worker'), undefined);
  a.hp = 0; h.ui.updateQueues(); assert.equal(h.buttons().length, 0);
  assert.equal(h.ui.queueInputs.length, 2, 'removed queues release cached input slots');
  a.hp = 100; h.ui.updateQueues(); assert.equal(h.buttons().length, 2);
  a.team = 1; h.ui.updateQueues(); assert.equal(h.buttons().length, 0);
  a.team = 0; h.ui.updateQueues(); assert.equal(h.buttons().length, 2);
  g.s = { ...g.s, entities: [] }; h.ui.updateQueues(); assert.equal(h.buttons().length, 0);
  assert.equal(g.s.time, 0);
});

test('queue view compares values instead of entity identities and refreshes actor/faction labels', () => {
  const h = queueViewSetup(), g = h.ui.game, original = h.ui.recruitmentGroups;
  let groups = 0;
  h.ui.recruitmentGroups = function() { groups++; return original.call(this); };
  h.ui.updateQueues();
  const writes = watchQueueWrites(h), first = h.button('rifle');
  g.s.entities = JSON.parse(JSON.stringify(g.s.entities));
  g.s.entities[0].id = 42;
  h.ui.updateQueues();
  assert.equal(groups, 1); assert.deepEqual(writes, []);
  g.submitAction = (team, action) => { h.calls.push([team, action.id, action.index]); return true; };
  h.ui.cancelRecruitment('rifle'); assert.deepEqual(h.calls, [[0, 42, 0]]);
  g.s.entities[0].queue[0].progress = .6; h.ui.updateQueues();
  assert.equal(first.style.getPropertyValue('--progress'), '216deg');
  const label = first.getAttribute('aria-label');
  g.s.parties[0].faction = 1; h.ui.updateQueues();
  assert.notEqual(first.getAttribute('aria-label'), label);
  g.s.parties.push({ id: 1, faction: 2 }); g.localTeam = 1;
  h.ui.updateQueues(); assert.equal(h.buttons().length, 0);
  g.s.entities[0].team = 1; h.ui.updateQueues(); assert.equal(h.buttons().length, 2);
  // Explicit UI invalidation must still rebuild otherwise identical content.
  const old = h.button('rifle'); h.ui.queueSignature = undefined;
  h.document.getElementById('productionQueue').innerHTML = '';
  h.buttons(); h.ui.updateQueues(); assert.notStrictEqual(h.button('rifle'), old);
});

test('queue view preserves pressed-node guard and pause/resume without wall-clock progress', () => {
  const h = queueViewSetup(), g = h.ui.game;
  h.ui.tick(0);
  const first = h.button('rifle'), writes = watchQueueWrites(h);
  h.ui.paused = true;
  for (let i = 0; i < 10; i++) h.ui.tick(.1);
  assert.deepEqual(writes, []);
  h.ui.paused = false; h.ui.domPressed = true;
  g.s.entities[0].queue[0].progress = .5; h.ui.tick(0);
  assert.deepEqual(writes, []);
  h.ui.domPressed = false; h.ui.tick(0);
  assert.strictEqual(h.button('rifle'), first);
  assert.equal(first.style.getPropertyValue('--progress'), '180deg');
  assert.deepEqual(writes, ['progress', 'time', 'label']);
});

test('periodic HUD refresh does not duplicate the per-frame queue update', () => {
  const h = setup(); let queues = 0;
  h.ui.game.supply = () => 0; h.ui.game.cap = () => 20;
  h.ui.renderActions = () => {};
  h.ui.updateHUD = h.UI.prototype.updateHUD;
  h.ui.updateQueues = () => queues++;
  h.ui.hudClock = .3;
  h.ui.tick(0);
  assert.equal(queues, 1);
});

test('queue tap cancels one waiting order before active work; pause and scroll cancellation are guarded', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  const q = progress => ({type:'rifle',progress,time:10});
  h.ui.game.s.entities = [
    {id:1,team:0,kind:'building',queue:[q(.2)]},
    {id:2,team:0,kind:'building',queue:[q(.8),q(0)]}
  ];
  h.ui.game.cancelQueue = (id,index) => { h.calls.push(['cancel',id,index]); h.ui.game.get(id).queue.splice(index,1); };
  h.click({queueType:'rifle'}); assert.deepEqual(h.calls, [['cancel',2,1]]);
  h.click({queueType:'rifle'}); assert.deepEqual(h.calls.at(-1), ['cancel',1,0]);
  h.ui.paused = true; h.click({queueType:'rifle'}); assert.equal(h.calls.length, 2);
  h.ui.domPressed = true; h.document.handlers.pointercancel(); assert.equal(h.ui.domPressed, false);
});

test('building rotation arrows exist only for completed own buildings and obey action guards', () => {
  for(const type of ['barracks','fieldlab','hearthtower']){
    const h=buildingPanel();h.UI.prototype.bind.call(h.ui);h.b.type=type;
    h.ui.game.rotateBuilding=vm.runInContext('MeridianGame.prototype.rotateBuilding',h.context);
    h.ui.game.refreshSettlementLayouts=()=>{};
    h.ui.renderActions();assert.match(h.document.getElementById('selectionStatus').innerHTML,/data-action="rotateLeft"/);
    assert.match(h.document.getElementById('selectionStatus').innerHTML,/data-action="rotateRight"/);
    h.click({action:'rotateLeft'});assert.equal(h.b.visualRotation,23/3);
    h.click({action:'rotateRight'});assert.equal(h.b.visualRotation,0);
    for(const guard of ['paused','modal','mode','intro','ended']){
      h.ui.paused=guard==='paused';h.ui.modalKind=guard==='modal'?'pause':'';
      h.ui.mode=guard==='mode'?{kind:'rally'}:null;h.ui.battleIntro=guard==='intro'?{}:null;
      h.ui.game.s.result=guard==='ended'?{win:true}:null;
      h.click({action:'rotateRight'});assert.equal(h.b.visualRotation,0,guard);
    }
  }
  for(const invalid of ['unfinished','foreign','dead','unit','none']){
    const h=buildingPanel();h.UI.prototype.bind.call(h.ui);h.ui.game.rotateBuilding=()=>assert.fail('Invalid rotation submitted');
    if(invalid==='unfinished')h.b.progress=.4;
    if(invalid==='foreign')h.b.team=1;
    if(invalid==='dead')h.b.hp=0;
    if(invalid==='unit')h.b.kind='unit';
    if(invalid==='none')h.ui.selected=[];
    h.ui.renderActions();assert.doesNotMatch(h.document.getElementById('selectionStatus').innerHTML,/data-action="rotate(Left|Right)"/);
    h.click({action:'rotateRight'});
  }
});

test('own Forum world bars remain visible without selection or healthbar settings and update from live state',()=>{
  const h=buildingPanel(),g=h.ui.game,texts=[],rects=[];
  Object.assign(h.b,{type:'meridianforum',hp:200,maxHp:200,size:4,x:200,z:200,cinderStock:100});
  g.s.entities.push({...h.b,id:8,type:'fieldlab',forumId:7});
  h.ui.selected=[];h.ui.profile.settings.healthbars=false;
  const ctx=new Proxy({fillText(text){texts.push(text);},fillRect(...args){rects.push(args);}},
    {get:(target,key)=>target[key] || (()=>{})});
  const limits=vm.runInContext('FORUM_SETTLEMENT',h.context),before=JSON.stringify(g.s);
  h.ui.drawOverlay(ctx);
  assert.ok(texts.includes(`Cinder 100/${limits.capacity}`));assert.ok(texts.includes(`Buildings 1/${limits.buildings}`));
  assert.ok(rects.some(r=>r[2]===100&&r[3]===7),'HP bar has ownership border');
  assert.equal(JSON.stringify(g.s),before);
  h.b.cinderStock=200;g.s.entities.push({...h.b,id:9,type:'fieldlab',forumId:7});texts.length=0;
  h.ui.drawOverlay(ctx);assert.ok(texts.includes(`Cinder 200/${limits.capacity}`));assert.ok(texts.includes(`Buildings 2/${limits.buildings}`));
});

test('Forum stock belongs in world bars; managed children retain rotation, sale and foundation cancellation',()=>{
  const h=buildingPanel();h.b.type='meridianforum';h.b.cinderStock=100;
  h.ui.renderActions();const before=h.ui.actionSignature;
  h.b.cinderStock=200;h.ui.renderActions();assert.equal(h.ui.actionSignature,before);
  const child={...h.b,id:8,type:'fieldlab',forumId:7};delete child.cinderStock;
  h.ui.game.s.entities.push(child);h.ui.selected=[8];h.ui.renderActions();
  assert.match(h.document.getElementById('selectionStatus').innerHTML,/data-action="rotateLeft"/);
  assert.match(h.document.getElementById('selectionStatus').innerHTML,/data-action="rotateRight"/);
  assert.match(h.document.getElementById('selectionStatus').innerHTML,/data-action="sell"/);
  child.progress=.3;h.ui.renderActions();
  assert.match(h.document.getElementById('selectionStatus').innerHTML,/data-action="cancelBuild"/);
  child.progress=1;h.UI.prototype.bind.call(h.ui);h.ui.openModal=h.UI.prototype.openModal;
  h.ui.game.buildingSaleRefund=()=>({cost:0,gas:0});h.click({action:'sell'});
  assert.match(h.document.getElementById('modal').innerHTML,/no purchase refund/);
  assert.match(h.document.getElementById('modal').innerHTML,/grow a replacement/);
});

test('building buttons dispatch repair; sale pauses, cancels safely, confirms the captured ID and rejects stale repeats', () => {
  const h = buildingPanel(); h.UI.prototype.bind.call(h.ui); h.ui.openModal = h.UI.prototype.openModal;
  h.ui.game.toggleBuildingRepair = id => h.calls.push(['repair',id]);
  h.ui.game.buildingSaleRefund = () => ({cost:147.5,gas:0});
  h.ui.game.sellBuilding = id => h.calls.push(['sell',id]);
  h.click({ action: 'repair' }); assert.deepEqual(h.calls, [['repair',7]]);
  h.click({ action: 'sell' });
  assert.equal(h.ui.paused, true); assert.equal(h.ui.modalKind, 'sell');
  h.click({ action: 'repair' }); assert.equal(h.calls.length, 1);
  h.click({ ui: 'cancelSale' }); assert.equal(h.ui.paused, false); assert.equal(h.calls.length, 1);
  h.click({ ui: 'confirmSale' }); assert.equal(h.calls.length, 1);
  h.click({ action: 'sell' }); h.ui.selected = [99];
  h.click({ ui: 'confirmSale' }); assert.deepEqual(h.calls, [['repair',7],['sell',7]]);
  assert.equal(h.ui.paused, false); assert.equal(h.ui.modalKind, '');
  h.click({ ui: 'confirmSale' }); assert.equal(h.calls.length, 2);
  h.ui.game.canSellBuilding = () => 'Last command center'; h.ui.toast = text => h.calls.push(['toast',text]);
  h.ui.selected = [7]; h.click({ action: 'sell' }); assert.equal(h.ui.paused, false);
  assert.deepEqual(h.calls.at(-1), ['toast','Last command center']);
});

test('quick recruitment binds compatible selections and never reroutes blocked local orders', () => {
  const h = buildingPanel(), g = h.ui.game;
  g.recruitmentReason = vm.runInContext('MeridianGame.prototype.recruitmentReason', h.context);
  g.cap = () => 100;
  g.train = (...args) => { h.calls.push(['train', ...args]); return true; };
  h.ui.perform('favorite:rifle');
  assert.deepEqual(h.calls, [['train', 'rifle', 0, 7]]);
  h.calls.length = 0; h.b.queue = Array.from({length:5}, () => ({type:'rifle'}));
  const other = {...h.b, id:8, queue:[]}; g.s.entities.push(other);
  const reasons=[]; h.ui.toast = text => reasons.push(text);
  h.ui.perform('favorite:rifle'); assert.deepEqual(h.calls, []); assert.match(reasons.pop(), /queue is full/);
  h.b.queue=[]; h.b.progress=.5;
  h.ui.perform('favorite:rifle'); assert.deepEqual(h.calls, []); assert.match(reasons.pop(), /construction/);
  h.ui.selected=[8]; other.type='hq';
  h.ui.perform('favorite:rifle'); assert.deepEqual(h.calls, []); // No completed barracks yet.
  h.b.progress=1; h.ui.perform('favorite:rifle');
  assert.deepEqual(h.calls, [['train','rifle']], 'incompatible structure routes globally without confirmation');
  h.calls.length=0;h.ui.selected=[7];h.ui.perform('train:rifle');
  assert.deepEqual(h.calls, [['train','rifle']], 'catalog remains global');
});

test('recruitment delegates producer choice to the simulation, independent of selection', () => {
  const h = setup();
  h.ui.game.train = (...args) => h.calls.push(['train',...args]);
  h.ui.selected = [99]; h.UI.prototype.perform.call(h.ui, 'train:rifle');
  assert.deepEqual(h.calls, [['train','rifle']], 'selection is not a preferred producer');
});

test('HUD layout uses unanimated offsets only for overlay placement, never world bounds', () => {
  const h=setup(), hud=h.document.getElementById('hud');
  const style=h.document.getElementById('layout-vars').style;h.document.documentElement={style};
  const deck=h.document.getElementById('commandDeck'),panel=h.document.getElementById('actionPanel'),status=h.document.getElementById('selectionStatus');
  deck.offsetTop=656;panel.offsetTop=0;status.offsetTop=-44;
  for(const el of [deck,panel,status,h.document.getElementById('topbar')])
    el.getBoundingClientRect=()=>{throw Error('Animated geometry must not affect HUD layout');};
  style.setProperty('--hud-top','48px');style.setProperty('--hud-height','144px');
  hud.classList.add('hidden');h.ui.updateHUDLayout();
  assert.equal(style.getPropertyValue('--hud-height'),'144px');
  hud.classList.remove('hidden');status.classList.add('hidden');h.ui.updateHUDLayout();
  assert.equal(style.getPropertyValue('--queue-floor'),'152px');
  status.classList.remove('hidden');h.ui.updateHUDLayout();
  assert.equal(style.getPropertyValue('--queue-floor'),'196px');
  status.classList.add('hidden');panel.offsetTop=-136;h.ui.updateHUDLayout();
  assert.equal(style.getPropertyValue('--hud-height'),'280px');
  assert.equal(style.getPropertyValue('--hud-top'),'48px');
});

test('captured world releases over the HUD cannot issue orders, select or place targets', () => {
  for(const mode of [null,{kind:'ability',arg:'scan'},{kind:'build',arg:'depot'}]) {
    const h=setup();h.UI.prototype.bind.call(h.ui);h.ui.selected=[7];h.ui.mode=mode;
    h.document.elementFromPoint=()=>({closest:selector=>selector==='#hud'?{}:null});
    h.pointer('pointerdown',200,200);h.pointer('pointerup',200,200);
    assert.deepEqual(h.calls,[]);assert.deepEqual(h.ui.selected,[7]);assert.equal(h.ui.mode,mode);
  }
});

test('catalog and unit details back controls use the left-arrow asset, not the fallback star', () => {
  const h=setup();
  for(const tab of ['build','infantry','vehicles','aircraft','details']) {
    h.ui.tab=tab;
    if(tab==='details') {h.ui.selected=[1];h.ui.game.s.entities=[{id:1,kind:'unit',type:'worker',faction:0,hp:100}];}
    h.ui.renderActions();
    assert.match(h.document.getElementById('actions').innerHTML,
      /data-action="tab:root"[^>]*><img class="ui-icon" src="\.\/assets\/ui\/back\.webp"/);
  }
});

test('building and unit actions request the current model of the active faction', () => {
  const h = setup();
  for (const faction of [0, 1, 2]) {
    h.ui.game.s.parties[0].faction = faction;
    const html = h.UI.prototype.actionButton.call(h.ui, 'build:hq', 'HQ', 'hq');
    assert.ok(html.includes(`data-model-faction="${faction}" data-model-kind="building" data-model-type="hq"`));
    assert.match(html, /class="action-model"/);
    assert.match(html, /data-model-zoom="1.35"/);
  }
  for (const faction of [0, 1, 2]) {
    h.ui.game.s.parties[0].faction = faction;
    const html = h.UI.prototype.actionButton.call(h.ui, 'train:worker', 'Worker', 'worker');
    assert.ok(html.includes(`data-model-faction="${faction}" data-model-kind="unit" data-model-type="worker"`));
    assert.match(html, /class="action-model"/);
    assert.match(html, /data-model-zoom="1.35"/);
  }
});

test('action availability refreshes synchronously without a HUD tick', () => {
  const h = setup(), g = h.ui.game;
  g.recruitmentReason = vm.runInContext('MeridianGame.prototype.recruitmentReason', h.context);
  g.cost = () => ({cost: 10, gas: 0});
  Object.assign(g, { supply: () => 0, cap: () => 24, afford: () => false,
    abilityRequirement: key => key === 'orbital' ? 'TECH' : '' });
  g.s.parties[0].account.energy = 32;
  const panels = ['abilityBar', 'actions'].map(id => h.document.getElementById(id));
  // Model innerHTML replacement: each render creates fresh, initially enabled buttons.
  for (const panel of panels) {
    let html = '';
    Object.defineProperty(panel, 'innerHTML', {
      get: () => html,
      set(value) {
        html = value;
        panel.buttons = [...value.matchAll(/<button[^>]*data-action="([^"]+)"[^>]*>/g)].map(([tag, action]) => {
          const button = Object.assign(h.document.getElementById(Symbol(action)), {
            dataset: { action }, disabled: / disabled/.test(tag)
          });
          button.querySelector('small').textContent = '';
          return button;
        });
      }
    });
  }
  h.document.querySelectorAll = () => panels.flatMap(p => p.buttons || []);
  h.ui.updateHUD = () => { throw Error('must not wait for or require the periodic HUD update'); };
  const check = () => {
    const buttons = h.document.querySelectorAll();
    for (const button of buttons) {
      const action = button.dataset.action;
      if (action.startsWith('ability:')) {
        const active = h.ui.isModeAction(action);
        assert.equal(button.disabled, false, 'blocked actions remain tappable');
        assert.equal(button.classList.contains('blocked'), active ? false : action !== 'ability:scan', action);
      } else if (/^(train|build):/.test(action)) {
        assert.equal(button.disabled, false);
        assert.equal(button.classList.contains('blocked'), true, action);
      }
    }
  };
  for (const tab of ['infantry', 'build', 'vehicles', 'root']) {
    h.UI.prototype.setTab.call(h.ui, tab);
    check();
  }
  h.UI.prototype.setMode.call(h.ui, 'ability', 'scan');
  check();
  const previous = panels[0].buttons;
  g.s.parties[0].account.energy = 0;
  h.ui.renderActions();
  assert.equal(panels[0].buttons, previous, 'unchanged markup is retained');
  assert.equal(panels[0].buttons.find(b => b.dataset.action === 'ability:scan').disabled, false,
    'the selected action remains available to cancel');
  assert.ok(panels[0].buttons.filter(b => b.dataset.action !== 'ability:scan').every(b => b.classList.contains('blocked')),
    'state still refreshes when markup is unchanged');
});

test('HUD explains full queues, missing producers, queued commander and unavailable building actions on tap', () => {
  const h = buildingPanel(), g = h.ui.game;
  g.recruitmentReason = vm.runInContext('MeridianGame.prototype.recruitmentReason', h.context);
  Object.assign(g.s.parties[0].account,{alloy:1000,gas:1000,energy:100,abilities:{}});
  Object.assign(g,{supply:()=>10,cap:()=>50,afford:()=>true});
  const buttons = ['train:rifle','train:hero','train:air','repair','sell'].map(action =>
    Object.assign(h.document.getElementById(action),{dataset:{action}}));
  h.document.querySelectorAll = () => buttons;
  const [rifle,hero,air,repair,sell] = buttons;
  h.b.queue = Array.from({length:5},()=>({type:'rifle',time:11,progress:0}));
  g.s.entities.push({id:8,team:0,kind:'building',type:'hq',hp:100,progress:1,queue:[{type:'hero',time:40,progress:0}]});
  g.canRepairBuilding = () => 'No workers'; g.canSellBuilding = () => 'Protected';
  h.UI.prototype.updateHUD.call(h.ui);
  assert.ok(buttons.every(b=>b.classList.contains('blocked') && !b.disabled));
  h.b.queue.pop(); g.buildingRepairers = () => [{}]; g.canSellBuilding = () => '';
  h.UI.prototype.updateHUD.call(h.ui);
  assert.equal(rifle.classList.contains('blocked'),false); assert.equal(repair.classList.contains('blocked'),false); assert.equal(sell.classList.contains('blocked'),false);
  assert.equal(hero.classList.contains('blocked'),true); assert.equal(air.classList.contains('blocked'),true);
  h.ui.mode = {kind:'ability',arg:'scan'}; h.UI.prototype.updateHUD.call(h.ui);
  assert.equal(repair.classList.contains('blocked'),true); assert.equal(sell.classList.contains('blocked'),true);
  h.ui.paused = true; h.UI.prototype.updateHUD.call(h.ui); assert.ok(buttons.every(b=>b.disabled));
});

test('HUD reads supply and capacity once per update and gates recruitment at capacity', () => {
  const h = buildingPanel(), g = h.ui.game;
  g.recruitmentReason = vm.runInContext('MeridianGame.prototype.recruitmentReason', h.context);
  Object.assign(g.s.parties[0].account, { alloy: 1000, gas: 1000, energy: 100, abilities: {} });
  Object.assign(g.s, { depth: 4 });
  Object.assign(g, { afford: () => true });
  g.s.entities.push({ id: 8, team: 0, kind: 'building', type: 'hq', hp: 100, progress: 1, queue: [] });
  const buttons = ['train:worker', 'train:rifle'].map(action =>
    Object.assign(h.document.getElementById(action), { dataset: { action } }));
  h.document.querySelectorAll = () => buttons;
  for (const [supply, capacity, blocked] of [
    [22, 24, [false, false]], [23, 24, [false, true]],
    [24, 24, [true, true]], [24, 40, [false, false]]
  ]) {
    for (const step of [null, 'trainRifle', 'buildDepot']) {
      h.ui.battleTutorial = step ? { step, achieved: new Set(), workersTrained: 2, elapsed: 0 } : null;
      let supplyReads = 0, capacityReads = 0;
      g.supply = () => { supplyReads++; return supply; };
      g.cap = () => { capacityReads++; return capacity; };
      h.UI.prototype.updateHUD.call(h.ui);
      assert.deepEqual(buttons.map(button => button.classList.contains('blocked')), blocked);
      assert.deepEqual([supplyReads, capacityReads], [1, 1]);
    }
  }
});

test('ability availability respects energy, cooldown and technology boundaries', () => {
  const h = setup(), g = h.ui.game;
  Object.assign(g.s.parties[0].account, { alloy: 0, gas: 0, abilities: {} }); Object.assign(g.s,{time:10});
  Object.assign(g, { supply: () => 0, cap: () => 24, abilityRequirement: () => null });
  for (const [kind, energy] of [['orbital', 85], ['repair', 45], ['scan', 25], ['drop', 95]]) {
    const button = h.document.getElementById('ability:' + kind);
    button.dataset = { action: 'ability:' + kind };
    h.document.querySelectorAll = () => [button];
    for (const available of [energy - 1, energy]) {
      g.s.parties[0].account.energy = available;
      h.UI.prototype.updateHUD.call(h.ui);
      assert.equal(button.disabled, false);
      assert.equal(button.classList.contains('blocked'), available < energy);
    }
    g.s.parties[0].account.abilities[kind] = 12.2;
    h.UI.prototype.updateHUD.call(h.ui);
    assert.equal(button.classList.contains('blocked'), true);
    g.s.parties[0].account.abilities[kind] = 10;
    h.UI.prototype.updateHUD.call(h.ui);
    assert.equal(button.classList.contains('blocked'), false);
    if(kind==='orbital') {
      g.abilityRequirement=()=>'Requires a completed War foundry.';
      h.UI.prototype.updateHUD.call(h.ui);
      assert.equal(button.classList.contains('blocked'),true);
      g.abilityRequirement=()=>null;
    }
  }
});
