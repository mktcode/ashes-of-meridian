const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS, UI_SCRIPTS, loadScripts } = require('./helpers/game-scripts.cjs');
// Logic behind UI actions; copy, layout and full navigation flows are checked manually.

test('escaping converts values and protects HTML delimiters independently of screen wording', () => {
  const context = loadScripts(['ui-core']), esc = vm.runInContext('esc', context);
  for (const [input, expected] of [[null, ''], [undefined, ''], [42, '42'],
    ['<&>"\'', '&lt;&amp;&gt;&quot;&#39;'], ['&lt;', '&amp;lt;']])
    assert.equal(esc(input), expected);
});

test('opening HQ encounters keep faction → map → seed draw order with the extended map pool', () => {
  const h = setup();
  for (const depth of [0, 1, 2]) {
    const expected = vm.runInContext(`(() => {
      const random = seeded(1409), maps = ['alien-planet','mothership','westmark','frontier','haven'];
      return {mission: DEFAULT_MISSION, enemies: expeditionEnemyFactions(${depth}, random),
        map: maps[Math.floor(random() * maps.length)], seed: 1 + Math.floor(random() * 99999999), next: random()};
    })()`, h.context);
    vm.runInContext('Math.random = seeded(1409);', h.context);
    const encounter = h.ui.createEncounter(depth, 'desert');
    assert.deepEqual(JSON.parse(JSON.stringify({...encounter, next: vm.runInContext('Math.random()', h.context)})),
      JSON.parse(JSON.stringify(expected)));
    assert.notEqual(encounter.map, 'aurelion');
  }
});

test('Aurelion enters at stage four with equal map weight, normal party counts and no immediate repeat', () => {
  const h = setup();
  for (const depth of [2,3,6,7]) {
    const found = new Set(), count = depth<3 ? 6 : 7;
    for (let index=0;index<count;index++) {
      let draws=0;
      vm.runInContext('Math',h.context).random=()=>{draws++;return (index+.5)/count;};
      const e=h.ui.createEncounter(depth);
      found.add(e.map);
      assert.equal(e.mission,e.map==='aurelion'?'echo-salvage':'hq-elimination');
      assert.equal(e.enemies.length,depth<3?1:depth<7?2:3);
      assert.equal(draws,(depth<3?0:e.enemies.length)+2,'no extra mission draw');
      assert.notEqual(h.ui.createEncounter(depth,e.map).map,e.map);
    }
    assert.equal(found.has('aurelion'),depth>=3); assert.equal(found.size,count);
  }
});

test('screen templates render frozen data without DOM access, randomness or profile mutation', () => {
  const context = loadScripts(['core', 'content', 'ui-core', 'ui-templates']);
  vm.runInContext('Math.random = seeded = () => { throw Error("Template RNG"); };', context);
  const render = vm.runInContext('({renderHomeScreen, renderMissionBriefing, renderExpeditionOpponents, renderBattleScreen, renderSettingsScreen, renderFieldManual, renderArmoryScreen, renderBenefitOptions})', context);
  const profile = Object.freeze({version: 1, expeditionDepth: 10, aether: 250,
    upgrades: Object.freeze({startingAlloy: 0, constructionProtocols: 1}),
    settings: Object.freeze({quality: 2, volume: .28, music: true, sfx: true, healthbars: false, showFps: true})});
  const expedition = Object.freeze({version: 5, faction: 1, abilities: Object.freeze(['orbital', 'repair', 'scan', 'drop']), depth: 10,
    enemyBenefits: Object.freeze([Object.freeze({}), Object.freeze({supplyCrate: 2}), Object.freeze({})]),
    benefits: Object.freeze({surveyDrones: 1}), offers: Object.freeze(['fieldWorkshop', 'commandCapacitor']),
    encounter: Object.freeze({mission: 'hq-elimination', enemies: Object.freeze([2, 1, 2]), map: 'desert', seed: 1409})});
  const before = JSON.stringify({profile, expedition});
  render.renderMissionBriefing(expedition.encounter.mission);
  const briefing = render.renderExpeditionOpponents(expedition);
  assert.equal(briefing, render.renderExpeditionOpponents(expedition));
  render.renderHomeScreen(expedition, 10, briefing);
  render.renderHomeScreen(null, 10, '');
  const battle = render.renderBattleScreen(profile, 1, 1, 250, expedition.abilities);
  assert.equal((battle.match(/data-loadout-ability=/g) || []).length, 8);
  assert.equal((battle.match(/loadout-option active/g) || []).length, 4);
  assert.match(render.renderBattleScreen(profile, 1, 1, 250, expedition.abilities.slice(0, 3)),
    /data-ui="startBattle" disabled/);
  const settings = render.renderSettingsScreen(profile.settings);
  assert.match(settings, /data-setting="showFps" checked/);
  render.renderFieldManual();
  const armory = render.renderArmoryScreen(profile),
    aetherIcon = vm.runInContext('icon("aether")', context), alloyIcon = vm.runInContext('icon("crystal")', context);
  assert.match(armory, /<h1>Permanent Upgrades<\/h1>/);
  assert.notEqual(aetherIcon, alloyIcon);
  assert.ok(armory.includes(`<span class="armory-aether-icon">${aetherIcon}</span>`));
  assert.ok(armory.includes(alloyIcon));
  assert.match(armory, /data-upgrade="startingAlloy"[^>]*><span>100 ECHO<\/span><small>\+50 CINDER<\/small>/);
  assert.match(armory, /data-upgrade="aetherEvacuation"[^>]*><span>500 ECHO<\/span><small>\+100 LIMIT · \+5 \/ BUILDING<\/small>/);
  assert.match(armory, /data-upgrade="constructionProtocols"[^>]*><span>350 ECHO<\/span><small>\+5% BUILD SPEED<\/small>/);
  assert.match(armory, /FLEET SYSTEMS/); assert.match(armory, /COMMAND MODULES/);
  assert.match(armory, /data-upgrade="orbital"[^>]*><span>250 ECHO<\/span><small>\+12% DAMAGE<\/small>/);
  assert.doesNotMatch(armory, /AETHER · LEVEL/);
  const offers = render.renderBenefitOptions(expedition.offers);
  assert.equal(offers, render.renderBenefitOptions(expedition.offers));
  assert.equal(JSON.stringify({profile, expedition}), before);
});

test('opponent briefing shows only present slots, factions and current upgrades', () => {
  const context = loadScripts(['core', 'content', 'ui-core', 'ui-templates']);
  const renderOpponents = vm.runInContext('renderExpeditionOpponents', context);
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
    assert.equal((html.match(/class="opponent-card"/g) || []).length, count);
    assert.match(html, /OPPONENT 1<\/span><strong>MOURNING HOUSES/);
    assert.equal(html.includes(`OPPONENT ${count + 1}`), false);
    assert.doesNotMatch(html, /FREE-FOR-ALL|PRESSURE|Precision supremacy|Early technology|Regenerating swarm|Infantry masses/);
  }
  const html = renderOpponents(expedition);
  assert.match(html, /opponent-sigil[^>]*>◇<\/span>.*OPPONENT 1<\/span><strong>MOURNING HOUSES<\/strong><small>UPGRADES · NONE/);
  assert.match(html, /opponent-sigil[^>]*>❋<\/span>.*OPPONENT 2<\/span><strong>MANYROOT<\/strong><small>UPGRADES · Supply crate ×2/);
  assert.match(html, /opponent-sigil[^>]*>◈<\/span>.*OPPONENT 3<\/span><strong>CINDER PACT<\/strong><small>UPGRADES · Survey drones ×1/);
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
  const context = loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world', ...SIMULATION_SCRIPTS, ...UI_SCRIPTS], { globals: {
    document, window, innerWidth: 1280, innerHeight: 800, performance: { now: () => now },
    formatTime: () => '00:00'
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
    s: { cam: { x: 0, z: 0, zoom: 50 }, time: 0, speed: 1, entities: [],
      parties: [{id:0,faction:0,loadout:['orbital','repair','scan','drop'],meta:{},benefits:{},controller:{kind:'human'},account:{alloy:0,gas:0,energy:100,abilities:{}}}] },
    effects: { floats: [] }, canBuild: () => '', cost: () => ({ cost: 0, gas: 0 }),
    alive(predicate) { return this.s.entities.filter(predicate); },
    availableProducers: vm.runInContext('MeridianGame.prototype.availableProducers', context),
    workerTask: vm.runInContext('MeridianGame.prototype.workerTask', context),
    availableWorkers: () => [{}],
    get(id) { return this.s.entities.find(e => e.id === id && e.hp !== 0); },
    managedBuilding(id) { const b = this.get(id); return !this.s.result && b?.kind === 'building' && b.team === 0 && b.hp > 0 && b.progress >= 1 ? b : null; },
    buildingRepairers: () => [], canRepairBuilding: () => '', canSellBuilding: () => '',
    party: vm.runInContext('MeridianGame.prototype.party', context),
    abilityStats: vm.runInContext('MeridianGame.prototype.abilityStats', context),
    command(...args) { calls.push(['command', ...args]); },
    // UI tests mock submission/execution; scheduling and permission checks have separate CPU tests.
    submitAction(team, action) { return this.executeAction(team, action); },
    executeAction(team, action) {
      assert.equal(team, 0, 'single-player UI supplies its actor outside the payload');
      switch (action.kind) {
        case 'order': return this.command(action.ids, action.order);
        case 'train': return this.train(action.unit);
        case 'build': return this.build(action.building, action.position, action.selected);
        case 'ability': return this.ability(action.ability, action.position);
        case 'cancelConstruction': return this.cancelConstruction(action.id);
        case 'cancelQueue': return this.cancelQueue(action.id, action.index);
        case 'toggleRepair': return this.toggleBuildingRepair(action.id);
        case 'sell': return this.sellBuilding(action.id);
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
    { unlock() {}, sound() {} }, { expeditionDepth: 0, aether: 0, tutorialComplete: false, upgrades: {}, settings: { quality: 2 } },
    { saveProfile() {}, saveExpedition() {}, clearExpedition() {} });
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

test('refinery screen targeting uses the explored vent behind terrain, including overlapping units and network poses', () => {
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
    ui.multiplayer={displayEntity:e=>({...e,x:25,z:35})};
    const networkScreen=ui.R.project(25,1,35);
    assert.deepEqual({...ui.targetPosition(networkScreen.x,networkScreen.y)},{x:25,z:35});
    assert.deepEqual({...ui.targetPosition(screen.x+200,screen.y)},mountain);
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
  h.ui.selectBattleAbility('recall');
  assert.deepEqual(Array.from(h.ui.battleAbilities), ['repair', 'drop', 'disruption', 'bulwark']);
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
  assert.match(h.ui.actionButton('build:hq', 'HQ', 'hq'), /faction-2-building-hq/);
  h.ui.modalKind = 'sell'; assert.equal(h.ui.setPerspective(3), false); assert.equal(g.localTeam, 2);
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
  h.document.getElementById('combatSelectBtn').onclick();
  assert.deepEqual(Array.from(h.ui.selected), [3]);
  g.s.entities.push({ id: 6, team: 2, kind: 'building', type: 'hq', hp: 100, queue: [{ type: 'worker', time: 10, progress: 0 }] });
  g.s.entities.push({ id: 7, team: 0, kind: 'building', type: 'hq', hp: 100, queue: [{ type: 'rifle', time: 10, progress: 0 }] });
  assert.deepEqual(Object.keys(h.ui.recruitmentGroups()), ['worker']);
});

test('each battle start resets the music playlist before playback, but resume does not', () => {
  const h = setup(), calls = [];
  h.ui.audio.resetBattleMusic = () => calls.push('reset');
  h.ui.audio.setMode = mode => calls.push(mode);
  h.ui.event('start');
  assert.deepEqual(calls, ['reset', 'battle']);
  h.ui.pause(); h.ui.resume();
  assert.deepEqual(calls, ['reset', 'battle', 'silent', 'battle']);
  h.ui.event('start');
  assert.deepEqual(calls.slice(-2), ['reset', 'battle']);
  assert.equal(calls.filter(value => value === 'reset').length, 2);
});

test('stage one holds simulation and controls while the camera introduces the enemy HQ, then travels home', () => {
  const h = setup(), modes = [];
  h.ui.audio.resetBattleMusic = () => modes.push('reset');
  h.ui.audio.setMode = mode => modes.push(mode);
  h.ui.game.s.depth = 0;
  h.ui.game.s.rules = { kind: 'single-player', mission: { id: 'hq-elimination' } };
  h.ui.game.s.entities = [
    { id: 1, team: 0, kind: 'building', type: 'hq', hp: 100, x: -60, z: 50 },
    { id: 2, team: 1, kind: 'building', type: 'hq', hp: 100, x: 80, z: -70 }
  ];
  const explored = Array.from(h.ui.game.world.explored);
  h.ui.event('start', {});
  h.ui.event('radio', 'Expedition command|Recruit your first two workers from Infantry.');
  assert.equal(h.ui.paused, true);
  assert.deepEqual(h.ui.game.s.cam, { x: 72, z: -72, zoom: 50 });
  assert.equal(h.ui.introObserves(h.ui.game.s.entities[1]), true);
  assert.equal(h.ui.introObserves(h.ui.game.s.entities[0]), false);
  assert.deepEqual(modes, ['reset', 'silent']);
  h.ui.resume(); h.ui.pause();
  assert.equal(h.ui.paused, true, 'normal pause controls cannot bypass the intro');

  h.ui.advanceBattleIntro(.999);
  assert.equal(h.document.getElementById('radio').classList.contains('hidden'), true);
  h.ui.advanceBattleIntro(.001);
  assert.equal(h.document.getElementById('radioText').textContent, 'Destroy the enemy base to advance.');
  h.ui.advanceBattleIntro(4);
  assert.deepEqual(h.ui.game.s.cam, { x: 72, z: -72, zoom: 50 });
  h.ui.advanceBattleIntro(.625);
  assert.deepEqual(h.ui.game.s.cam, { x: 8, z: -12, zoom: 50 });
  h.ui.advanceBattleIntro(.625);
  assert.deepEqual(h.ui.game.s.cam, { x: -56, z: 48, zoom: 50 });
  assert.equal(h.document.getElementById('radioText').textContent, 'Recruit your first two workers from Infantry.');
  assert.equal(h.ui.battleIntro, null);
  assert.equal(h.ui.paused, false);
  assert.equal(h.ui.game.s.time, 0);
  assert.deepEqual(Array.from(h.ui.game.world.explored), explored);
  assert.deepEqual(modes, ['reset', 'silent', 'battle']);
});

test('first salvage introduction focuses the core without revealing an enemy; completion persists independently', () => {
  const h=setup(), saved=[];
  h.ui.profile.salvageIntroComplete=false;
  h.ui.persistence.saveProfile=p=>saved.push(JSON.parse(JSON.stringify(p)));
  h.ui.game.s.depth=3;
  h.ui.game.s.rules={kind:'single-player',mission:{id:'echo-salvage',site:{x:0,z:0,radius:20.5},delivered:[0,0,0]}};
  h.ui.game.s.entities=[{id:1,team:0,kind:'building',type:'hq',hp:100,x:-60,z:50},
    {id:2,team:1,kind:'building',type:'hq',hp:100,x:60,z:-50}];
  const explored=Array.from(h.ui.game.world.explored);
  h.ui.event('start',{});
  assert.equal(h.ui.paused,true); assert.equal(h.ui.game.s.cam.x,0); assert.equal(h.ui.game.s.cam.z,0);
  assert.equal(h.ui.introObserves(h.ui.game.s.entities[1]),false);
  assert.equal(h.ui.battleIntro.visibleEntityIds.size,0);
  assert.equal(saved.length,0);
  h.ui.advanceBattleIntro(10);
  assert.equal(h.ui.profile.salvageIntroComplete,false); assert.equal(h.ui.game.s.cam.x,0);
  h.ui.advanceBattleIntro(1.5);
  assert.equal(h.ui.paused,false); assert.equal(h.ui.battleIntro,null);
  assert.equal(h.ui.profile.salvageIntroComplete,true); assert.equal(saved.length,1);
  assert.equal(saved[0].tutorialComplete,false);
  assert.equal(h.ui.game.s.time,0); assert.deepEqual(Array.from(h.ui.game.world.explored),explored);
  assert.equal(h.ui.beginBattleIntro(),false,'later salvage missions skip the first-visit intro');
  h.ui.game.s.rules={kind:'single-player',mission:{id:'hq-elimination'}}; h.ui.game.s.depth=0;
  assert.equal(h.ui.beginBattleIntro(),true,'standard stage-one intro is independent');
});

test('an interrupted salvage intro stays unseen, and its public marker/HUD never mutate the mission or fog', () => {
  const h=setup(); h.ui.game.s.depth=3;
  const mission={id:'echo-salvage',site:{x:0,z:0,radius:20.5},delivered:[20,30,10]};
  h.ui.game.s.rules={kind:'single-player',mission};
  h.ui.game.s.entities=[{id:1,team:0,kind:'building',type:'hq',hp:100,x:-60,z:50}];
  assert.equal(h.ui.beginBattleIntro(),true);
  h.ui.advanceBattleIntro(2); h.ui.battleIntro=null;
  assert.notEqual(h.ui.profile.salvageIntroComplete,true); assert.equal(h.ui.beginBattleIntro(),true);
  const before=JSON.stringify(h.ui.game.s), points=[];
  vm.runInContext('Math.random = seeded = () => { throw Error("UI RNG"); };',h.context);
  h.ui.R.project=(x,y,z)=>{points.push({x,z}); return {x,y:z};};
  h.ui.drawMissionZone({save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}});
  assert.equal(points.length,65); assert.ok(points.every(p=>Math.abs(Math.hypot(p.x,p.z)-20.5)<1e-9));
  h.ui.updateMissionHUD();
  const el=h.document.getElementById('missionObjective');
  assert.equal(el.classList.contains('hidden'),false);
  assert.ok(el.textContent.includes('FIRST TO 100')); assert.ok(el.textContent.includes('OPP 1: 30'));
  assert.equal(JSON.stringify(h.ui.game.s),before);
  h.ui.battleIntro=null; h.UI.prototype.bind.call(h.ui); h.clickCamera('objective');
  assert.equal(h.ui.game.s.cam.x,0); assert.equal(h.ui.game.s.cam.z,0);
  h.ui.game.s.rules={kind:'single-player',mission:{id:'hq-elimination'}};
  h.ui.updateMissionHUD(); assert.equal(el.classList.contains('hidden'),true);
});

test('mouse and touch commands at the core assign only selected own workers to salvage',()=>{
  for(const [pointerType,button] of [['mouse',0],['mouse',2],['touch',0]]) {
    const h=setup();h.UI.prototype.bind.call(h.ui);
    h.ui.game.s.rules={kind:'single-player',mission:{id:'echo-salvage',site:{x:0,z:0,radius:20.5},delivered:[0,0]}};
    h.ui.game.s.entities=[{id:1,kind:'unit',type:'worker',team:0,hp:100},{id:2,kind:'unit',type:'rifle',team:0,hp:100}];
    h.ui.selected=[1,2];h.calls.length=0;
    h.pointer('pointerdown',100,100,{pointerType,button});h.pointer('pointerup',100,100,{pointerType,button});
    const commands=h.calls.filter(c=>c[0]==='command');assert.equal(commands.length,2);
    assert.deepEqual(JSON.parse(JSON.stringify(commands[0])),['command',[1],{type:'salvage',x:0,z:0}]);
    assert.equal(commands[1][2].type,'move');assert.deepEqual(Array.from(commands[1][1]),[2]);
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

test('first-stage tutorial highlights two workers, refinery, barracks and rifle in sequence and persists completion', () => {
  const h = setup(), actions = h.document.getElementById('actions'), saved = [];
  h.ui.setTab = h.UI.prototype.setTab;
  h.ui.alert = () => {};
  h.ui.persistence.saveProfile = profile => { saved.push(JSON.parse(JSON.stringify(profile))); return true; };
  h.ui.game.s.depth = 0;
  h.ui.game.s.rules = { kind: 'single-player', mission: { id: 'hq-elimination' } };
  h.ui.game.s.entities = [];
  const focused = action => new RegExp(`class="[^"]*tutorial-focus[^"]*" data-action="${action}"`).test(actions.innerHTML);

  assert.equal(h.ui.beginBattleTutorial(), true);
  h.ui.renderActions();
  assert.equal(focused('tab:infantry'), true);
  h.ui.setTab('infantry');
  assert.equal(focused('train:worker'), true);
  const producer = { id: 10, team: 0, kind: 'building', type: 'hq', hp: 100, progress: 1,
    queue: [{ type: 'worker' }] };
  h.ui.game.s.entities.push(producer);
  h.ui.renderActions();
  assert.equal(focused('train:worker'), true, 'the prompt remains until the second Prospector is ordered');
  producer.queue.push({ type: 'worker' });
  h.ui.renderActions();
  assert.equal(actions.innerHTML.includes('tutorial-focus'), false, 'two queued Prospectors satisfy the ordering prompt');
  producer.queue.pop();
  h.ui.renderActions();
  assert.equal(focused('train:worker'), true, 'cancelling the second order restores its prompt');
  producer.queue = [];

  h.ui.event('trained', { type: 'worker' });
  assert.equal(h.ui.tab, 'infantry');
  assert.equal(focused('train:worker'), true, 'the second Prospector is requested after the first finishes');
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

  h.ui.event('trained', { type: 'rifle' });
  assert.equal(h.ui.battleTutorial, null);
  assert.equal(h.ui.profile.tutorialComplete, true);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].tutorialComplete, true);
  assert.equal(actions.innerHTML.includes('tutorial-focus'), false);
});

test('tutorial remembers valid goals completed out of order instead of demanding duplicates', () => {
  const h = setup(), saved = [];
  h.ui.setTab = h.UI.prototype.setTab;
  h.ui.persistence.saveProfile = profile => { saved.push(JSON.parse(JSON.stringify(profile))); return true; };
  h.ui.game.s.depth = 0;
  h.ui.game.s.rules = { kind: 'single-player', mission: { id: 'hq-elimination' } };
  assert.equal(h.ui.beginBattleTutorial(), true);
  h.ui.advanceBattleTutorial('complete', 'barracks');
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

test('tutorial stays out of later progress, completed profiles and other factions', () => {
  for (const [depth, bestDepth, complete, faction] of [[1, 0, false, 0], [0, 1, false, 0],
    [0, 0, true, 0], [0, 0, false, 1]]) {
    const h = setup();
    h.ui.game.s.depth = depth;
    h.ui.game.s.rules = { kind: 'single-player', mission: { id: 'hq-elimination' } };
    h.ui.game.s.parties[0].faction = faction;
    h.ui.profile.expeditionDepth = bestDepth;
    h.ui.profile.tutorialComplete = complete;
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
    assert.deepEqual(h.ui.game.s.cam,{x:extent-18,z:18-extent,zoom:50});
    h.calls.length=0;
    h.pointer('pointerdown',162,18,{target:h.minimap,button:2});
    const target=h.calls[0][2];
    assert.ok(Math.abs(target.x-extent*.8)<1e-8);assert.ok(Math.abs(target.z+extent*.8)<1e-8);
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

test('left mouse dragging pans without issuing commands or changing selection', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
  h.pointer('pointerdown', 200, 200, { pointerType: 'mouse' });
  h.pointer('pointermove', 240, 230, { pointerType: 'mouse' });
  h.pointer('pointerup', 240, 230, { pointerType: 'mouse' });
  assert.deepEqual(h.calls, []); assert.deepEqual(h.ui.selected, [7]);
  assert.deepEqual(h.ui.game.s.cam, { x: -4, z: -3, zoom: 50 });
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

test('triple touch tap selects only living on-screen own non-workers, including support and air units', () => {
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
    tap(400); const combat = trigger === 'worker' ? [2,4,5,6,7,8] : [1,2,4,5,6,7,8];
    assert.deepEqual(h.ui.selected,combat);
    tap(500); assert.deepEqual(h.ui.selected,combat, 'further rapid taps keep combat selection');
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
    assert.equal(h.calls.length, 1); assert.equal(h.calls[0][0], rightClick ? 'command' : 'ability');
    assert.equal(h.ui.mode, null);
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

test('mouse wheel zoom and middle-button pan respect camera limits without issuing commands', () => {
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
  assert.deepEqual(h.ui.game.s.cam, { x: -4, z: -3, zoom: 27.2 });
  assert.deepEqual(h.ui.selected, [7]); assert.deepEqual(h.calls, []);
  h.ui.paused = true; wheel(120); assert.equal(prevented, 41);
  assert.deepEqual(h.ui.game.s.cam, { x: -4, z: -3, zoom: 27.2 });
});

test('one-finger drag preserves pan, camera bounds and no command on release', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
  h.pointer('pointerdown', 200, 200);
  h.pointer('pointermove', 240, 230);
  assert.deepEqual(h.ui.game.s.cam, { x: -4, z: -3, zoom: 50 });
  h.pointer('pointermove', 1240, 1230);
  assert.deepEqual(h.ui.game.s.cam, { x: -72, z: -72, zoom: 50 });
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
  for (const speed of [1.5, 2, .75, 1, 1.5, 2, .75, 1]) {
    h.ui.lastClick = { id: 7, count: 1 };
    button.onclick();
    assert.equal(g.s.speed, speed);
    assert.deepEqual(h.ui.selected, [7]); assert.strictEqual(h.ui.mode, mode);
    assert.strictEqual(g.s.entities[0].order, order); assert.equal(h.ui.attackMove, true);
    assert.equal(Object.keys(h.ui.lastClick).length, 0);
  }
  assert.deepEqual(h.calls, []); assert.equal(JSON.stringify(h.ui.profile), profile);
  button.onclick(); h.ui.pause(); button.onclick(); assert.equal(g.s.speed, 1.5);
  h.ui.resume(); assert.equal(g.s.speed, 1.5);
  g.s.result = {}; button.onclick(); assert.equal(g.s.speed, 1.5);
  g.s.result = null; h.ui.view = 'home'; button.onclick(); assert.equal(g.s.speed, 1.5);
  h.ui.view = 'game'; const run = g.s; g.s = null; button.onclick(); assert.equal(g.s, null);
  g.s = run;
});

test('attack-move toggle changes future ground orders for touch and mouse, not existing orders', () => {
  for (const input of ['touch', 'mouse', 'minimap']) {
    const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
    const button = h.document.getElementById('attackMoveBtn');
    const pending = { type: 'move', x: 30, z: 40 };
    h.ui.game.s.entities = [{ id: 7, kind: 'unit', team: 0, hp: 100, order: pending }];
    const options = input === 'touch' ? {} : {
      pointerType: 'mouse', button: 2, target: input === 'minimap' ? h.minimap : h.world
    };
    for (const active of [false, true, true, false]) {
      if (h.ui.attackMove !== active) button.onclick();
      assert.strictEqual(h.ui.game.s.entities[0].order, pending);
      assert.equal(h.calls.length, 0, 'toggling alone issues no command');
      h.pointer('pointerdown', 200, 200, options); h.pointer('pointerup', 200, 200, options);
      assert.equal(h.calls.length, 1);
      assert.equal(h.calls[0][2].type, active ? 'attackMove' : 'move');
      assert.equal(h.ui.attackMove, active, 'not a one-shot targeting mode');
      h.calls.length = 0;
    }
  }
});

test('visible combat force button selects living own non-workers projected inside the battlefield viewport', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  const unit = { id: 1, team: 0, kind: 'unit', type: 'rifle', hp: 100, x: 100, z: 100 };
  h.ui.game.s.entities = [unit, { ...unit, id: 2, type: 'medic', x: 200 },
    { ...unit, id: 3, x: -10 }, { ...unit, id: 4, z: 700 }, { ...unit, id: 5, type: 'worker' },
    { ...unit, id: 6, team: 1 }, { ...unit, id: 7, kind: 'building' }, { ...unit, id: 8, hp: 0 }];
  h.ui.game.alive = predicate => h.ui.game.s.entities.filter(e => e.hp > 0 && predicate(e));
  const grounded = [];
  h.ui.game.world.surface = { entityHeight: e => { grounded.push(e.id); return 6; } };
  h.ui.lastClick = { id: 5, count: 2 };
  h.document.getElementById('visibleCombatSelectBtn').onclick();
  assert.deepEqual(grounded, [1, 2, 3, 4]);
  assert.deepEqual(h.ui.selected, [1, 2]);
  assert.deepEqual(h.calls, [['select', [1, 2]]]);
  assert.equal(Object.keys(h.ui.lastClick).length, 0);
  h.ui.paused = true; h.document.getElementById('visibleCombatSelectBtn').onclick();
  assert.deepEqual(h.calls, [['select', [1, 2]]]);
});

test('combat force button selects every living own non-worker without changing commands', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  const unit = { id: 1, team: 0, kind: 'unit', type: 'rifle', hp: 100 };
  h.ui.game.s.entities = [unit, { ...unit, id: 2, type: 'medic' }, { ...unit, id: 3, type: 'hero' },
    { ...unit, id: 4, type: 'air' }, { ...unit, id: 5, type: 'worker' }, { ...unit, id: 6, team: 1 },
    { ...unit, id: 7, kind: 'building', type: 'barracks' }, { ...unit, id: 8, hp: 0 }];
  h.ui.game.alive = predicate => h.ui.game.s.entities.filter(e => e.hp > 0 && predicate(e));
  h.ui.lastClick = { id: 5, count: 2 };
  h.document.getElementById('combatSelectBtn').onclick();
  assert.deepEqual(h.ui.selected, [1, 2, 3, 4]);
  assert.deepEqual(h.calls, [['select', [1, 2, 3, 4]]]);
  assert.equal(Object.keys(h.ui.lastClick).length, 0);
  h.ui.paused = true; h.document.getElementById('combatSelectBtn').onclick();
  assert.deepEqual(h.calls, [['select', [1, 2, 3, 4]]]);
});

test('attack-move toggle preserves context orders, selection, and explicit ability targeting', () => {
  for (const active of [false, true]) {
    const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
    if (active) h.document.getElementById('attackMoveBtn').onclick();
    for (const target of [{ id: 8, team: 1 }, { id: 9, team: -1 }]) {
      h.ui.pick = () => target;
      h.pointer('pointerdown', 200, 200); h.pointer('pointerup', 200, 200);
      assert.equal(h.calls[0][2].type, 'smart'); assert.equal(h.calls[0][2].id, target.id);
      h.calls.length = 0;
    }
    h.ui.pick = () => ({ id: 10, team: 0 });
    h.pointer('pointerdown', 200, 200); h.pointer('pointerup', 200, 200);
    assert.deepEqual(h.calls, [['select', [10]]]); h.calls.length = 0;
    h.ui.mode = { kind: 'ability', arg: 'scan' }; h.ui.pick = () => null;
    h.ui.game.ability = (...args) => { h.calls.push(['ability', ...args]); return true; };
    h.pointer('pointerdown', 200, 200); h.pointer('pointerup', 200, 200);
    assert.equal(h.calls.length, 1); assert.equal(h.calls[0][0], 'ability');
    assert.equal(h.ui.mode, null); assert.equal(h.ui.attackMove, active);
  }
});

test('attack-move is transient, guarded while paused/ended, and reset on battle start', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  const button = h.document.getElementById('attackMoveBtn');
  assert.equal(h.ui.attackMove, false);
  const profile = JSON.stringify(h.ui.profile);
  button.onclick(); assert.equal(h.ui.attackMove, true);
  h.ui.clearMode(); assert.equal(h.ui.attackMove, true);
  h.ui.paused = true; button.onclick(); assert.equal(h.ui.attackMove, true);
  h.ui.paused = false; h.ui.game.s.result = {}; button.onclick(); assert.equal(h.ui.attackMove, true);
  h.ui.game.s.result = null; h.ui.view = 'home'; button.onclick(); assert.equal(h.ui.attackMove, true);
  h.ui.event('start', {});
  assert.equal(h.ui.attackMove, false);
  assert.equal(JSON.stringify(h.ui.profile), profile);
});

test('camera buttons and minimap tap/drag still navigate with existing limits', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  h.ui.homeCamera = h.UI.prototype.homeCamera;
  h.ui.game.s.entities.push({ id: 1, team: 0, type: 'hq', x: 20, z: 30 });
  h.clickCamera('home');
  assert.deepEqual(h.ui.game.s.cam, { x: 24, z: 28, zoom: 50 });
  h.clickCamera('in'); assert.equal(h.ui.game.s.cam.zoom, 42.5);
  h.clickCamera('out'); assert.equal(h.ui.game.s.cam.zoom, 42.5 * 1.18);
  for (let i = 0; i < 20; i++) h.clickCamera('in');
  assert.equal(h.ui.game.s.cam.zoom, 27.2);
  for (let i = 0; i < 20; i++) h.clickCamera('out');
  assert.equal(h.ui.game.s.cam.zoom, 115);
  h.pointer('pointerdown', 100, 110, { target: h.minimap });
  assert.ok(Math.abs(h.ui.game.s.cam.x - 10) < 1e-10);
  assert.ok(Math.abs(h.ui.game.s.cam.z - 20) < 1e-10);
  assert.equal(h.ui.game.s.cam.zoom, 115);
  h.pointer('pointermove', 180, 0, { target: h.minimap });
  assert.deepEqual(h.ui.game.s.cam, { x: 72, z: -72, zoom: 115 });
  h.pointer('pointerup', 180, 0, { target: h.minimap });
  h.pointer('pointermove', 90, 90, { target: h.minimap });
  assert.deepEqual(h.ui.game.s.cam, { x: 72, z: -72, zoom: 115 });
  assert.deepEqual(h.calls, []);
});

test('minimap uses current offset and dimensions for pressing, dragging and right-click orders', () => {
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
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls)), [['command', [], { type: 'move', x: -45, z: -45 }]]);
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

test('repeating the active targeting action cancels without changing selection or game state', () => {
  for (const [kind, arg] of [['build','depot'], ['rally'],
    ...['orbital','repair','scan','drop'].map(a => ['ability',a])]) {
    const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
    h.ui.setMode = h.UI.prototype.setMode; h.ui.perform = h.UI.prototype.perform;
    if (kind === 'build') h.ui.tab = 'build';
    if (kind === 'rally') {
      h.ui.game.s.entities = [{id:7,team:0,kind:'building',type:'barracks',hp:100,progress:1,queue:[]}];
      h.ui.tab = 'building';
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

test('pause restart reopens the secured encounter with its expedition benefits', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  h.ui.expedition = { faction: 1, abilities: ['orbital','repair','scan','drop'], encounter: { mission: 'hq-elimination', enemies: [2, 0], map: 'desert', seed: 1409 },
    benefits: { supplyCrate: 2 }, enemyBenefits: [{ fieldWorkshop: 1 }, { supplyCrate: 1 }], offers: [], depth: 3 };
  h.ui.game.start = opts => h.calls.push(['start', JSON.parse(JSON.stringify(opts))]);
  h.ui.pause(); h.click({ ui: 'restartConfirm' }); h.click({ ui: 'restart' });
  assert.deepEqual(h.calls, [['start', { faction: 1, mission: 'hq-elimination', enemies: [2, 0], map: 'desert', seed: 1409,
    abilities: ['orbital','repair','scan','drop'], benefits: { supplyCrate: 2 },
    enemyBenefits: [{ fieldWorkshop: 1 }, { supplyCrate: 1 }], depth: 3 }]]);
});

test('victory checkpoints offers and chosen benefits; defeat clears the expedition', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  const saved = [], cleared = [];
  h.ui.persistence.saveExpedition = value => saved.push(JSON.parse(JSON.stringify(value)));
  h.ui.persistence.clearExpedition = () => cleared.push(true);
  h.ui.persistence.saveProfile = () => {};
  h.ui.game.start = opts => h.calls.push(['start', JSON.parse(JSON.stringify(opts))]);
  h.ui.game.s.stats = { kills: 0, lost: 0, gathered: 0 };
  h.ui.expedition = { version: 5, faction: 0, abilities: ['orbital','repair','scan','drop'], depth: 0, benefits: {}, enemyBenefits: [{}],
    encounter: { mission: 'hq-elimination', enemies: [1], map: 'desert', seed: 1409 }, offers: [] };
  const previousMap = h.ui.expedition.encounter.map;
  h.ui.event('result', { win: true, text: 'Victory', time: 1, integrity: 1, score: 1 });
  assert.equal(h.ui.expedition.depth, 1); assert.equal(saved.length, 1);
  assert.equal(saved[0].encounter.mission, 'hq-elimination');
  assert.notEqual(h.ui.expedition.encounter.map, previousMap);
  assert.equal(h.ui.expedition.offers.length, 3);
  const enemyBefore=JSON.stringify(h.ui.expedition.enemyBenefits);
  const totals = () => Array.from(h.ui.expedition.enemyBenefits, perks => Object.values(perks).reduce((a,b)=>a+b,0));
  assert.deepEqual(totals(), [1]);
  assert.deepEqual(Array.from(h.ui.expedition.encounter.enemies), [1]);
  h.ui.event('result',{win:true,text:'Victory',time:1,integrity:1,score:1});
  assert.equal(saved.length,1);assert.equal(JSON.stringify(h.ui.expedition.enemyBenefits),enemyBefore);
  const choice = h.ui.expedition.offers[0]; h.click({ benefit: choice });
  assert.equal(h.ui.expedition.benefits[choice], 1); assert.equal(h.ui.expedition.offers.length, 0);
  assert.equal(saved.length, 2); assert.equal(h.calls.length, 1);
  assert.equal(JSON.stringify(h.calls[0][1].enemyBenefits),enemyBefore);
  assert.equal(JSON.stringify(saved[1].enemyBenefits),enemyBefore);
  const previous=JSON.parse(enemyBefore);
  h.ui.resultAetherRecovered=undefined;
  h.ui.createEncounter=depth=>({mission: 'hq-elimination', enemies: Array.from({length: Math.min(3, depth + 1)}, () => 2),map:'mothership',seed:222});
  h.ui.event('result',{win:true,text:'Victory',time:1,integrity:1,score:1});
  assert.deepEqual(totals(), [2, 0, 0]);
  for(const [key,count] of Object.entries(previous[0]))assert.ok(h.ui.expedition.enemyBenefits[0][key]>=count);
  h.ui.resultAetherRecovered=undefined;
  h.ui.event('result',{win:true,text:'Victory',time:1,integrity:1,score:1});
  assert.deepEqual(totals(), [3, 1, 1]);
  h.ui.resultAetherRecovered = undefined;
  h.ui.event('result', { win: false, text: 'Defeat', time: 1, integrity: 0, score: 0 });
  assert.equal(h.ui.expedition, null); assert.equal(cleared.length, 1);
});

test('upgrades after a result preserve the ended battle and do not replay its sound', () => {
  for (const win of [false, true]) {
    const h = setup(), sounds = []; h.UI.prototype.bind.call(h.ui);
    h.ui.openModal = h.UI.prototype.openModal;
    h.ui.audio.sound = name => sounds.push(name);
    Object.assign(h.ui.game.s, { seed: 1409, map: 'desert', enemy: 2,
      stats: { kills: 3, lost: 1, gathered: 42 },
      result: { win, text: 'HQ destroyed', time: 20, integrity: .5, score: 12 } });
    const state = h.ui.game.s, before = JSON.stringify(state);
    h.ui.event('result', state.result);
    assert.deepEqual(sounds, [win ? 'victory' : 'defeat']);
    h.click({ ui: 'armory' }); assert.equal(h.ui.modalKind, 'armory');
    let saved = 0; h.ui.persistence.saveProfile = () => { saved++; return true; };
    h.ui.profile.aether = 300; h.ui.buyUpgrade('startingWorkers');
    assert.equal(saved, 1); assert.equal(h.ui.profile.upgrades.startingWorkers, 1); assert.equal(h.ui.profile.aether, 0);
    assert.equal(h.ui.modalKind, 'armory');
    h.click({ ui: 'closeModal' });
    assert.equal(h.ui.modalKind, 'result');
    assert.equal(h.ui.paused, true); assert.strictEqual(h.ui.game.s, state);
    assert.equal(JSON.stringify(state), before);
    assert.deepEqual(sounds.filter(name => name === 'victory' || name === 'defeat'), [win ? 'victory' : 'defeat']);
    assert.equal(sounds.filter(name => name === 'research').length, 1);
    h.click({ ui: 'home' }); assert.equal(h.ui.game.s, null);
    assert.equal(h.ui.view, 'home'); assert.equal(h.ui.profile.upgrades.startingWorkers, 1);
  }
});

test('permanent upgrades spend recovered aether, remain bounded and do not alter the active battle', () => {
  const h = setup(), keys = ['startingAlloy', 'startingWorkers'];
  h.ui.game.s.parties[0].meta = {}; h.ui.game.s.parties[0].account.alloy = 123; h.ui.game.s.parties[0].account.gas = 45;
  h.ui.persistence.saveProfile = p => h.calls.push(['profile', JSON.parse(JSON.stringify(p))]);
  h.ui.profile.aether = 99;
  h.ui.buyUpgrade('startingAlloy'); assert.deepEqual(h.ui.profile.upgrades, {});
  h.ui.profile.aether = 100; h.ui.buyUpgrade('startingAlloy');
  assert.deepEqual(h.ui.profile.upgrades, { startingAlloy: 1 }); assert.equal(h.ui.profile.aether, 0);
  h.ui.profile.aether = 500; h.ui.buyUpgrade('aetherEvacuation');
  assert.deepEqual(h.ui.profile.upgrades, { startingAlloy: 1, aetherEvacuation: 1 }); assert.equal(h.ui.profile.aether, 0);
  h.ui.profile.aether = 5100;
  for (const key of keys) for (let i=0;i<7;i++) h.ui.buyUpgrade(key);
  h.ui.buyUpgrade('not-an-upgrade');
  assert.deepEqual(h.ui.profile.upgrades, { startingAlloy: 5, aetherEvacuation: 1, startingWorkers: 5 });
  assert.equal(h.ui.profile.aether, 0); assert.equal(h.calls.length, 11);
  assert.deepEqual([h.ui.game.s.parties[0].account.alloy,h.ui.game.s.parties[0].account.gas,h.ui.game.s.parties[0].meta], [123,45,{}]);
});

test('each result transfers capped unused aether plus structure recovery once at the run-start upgrade level', () => {
  for (const [level, gas, structures, recovered] of [[0, 0, 0, 0], [0, 42.9, 2, 52], [0, 1000, 2, 110],
    [1, 1000, 2, 220], [2, 1000, 2, 380], [3, 1000, 2, 540], [4, 1000, 2, 800], [5, 2000, 2, 1060]]) {
    const h = setup(), saves = [];
    h.ui.persistence.saveProfile = p => saves.push(JSON.parse(JSON.stringify(p)));
    h.ui.showResult = () => {};
    h.ui.game.s.parties[0].faction = 2; h.ui.game.s.parties[0].account.gas = gas;
    h.ui.game.s.parties[0].meta = { aetherEvacuation: level };
    h.ui.game.s.stats = { structuresDestroyed: structures };
    h.ui.event('result', { win: true });
    assert.equal(h.ui.resultAetherEvacuated, Math.min([100, 200, 350, 500, 750, 1000][level], Math.floor(gas)));
    assert.equal(h.ui.resultAetherStructures, structures * (5 + level * 5));
    assert.equal(h.ui.resultAetherRecovered, recovered);
    assert.equal(h.ui.profile.aether, recovered);
    assert.equal(saves.length, recovered ? 1 : 0);
    h.ui.event('result', { win: true });
    assert.equal(h.ui.profile.aether, recovered, 'same result cannot pay twice');
    assert.equal(saves.length, recovered ? 1 : 0);
  }
});

test('result screen shows evacuated and building-destruction aether beneath the combined total', () => {
  const h = setup();
  h.ui.resultAetherRecovered = 130;
  h.ui.resultAetherEvacuated = 100;
  h.ui.resultAetherStructures = 30;
  h.ui.showResult({ win: false, text: 'Defeat', time: 1, score: 0, integrity: 0 });
  const html = h.document.getElementById('result').innerHTML;
  assert.match(html, /ECHO RECOVERED<\/span><strong>130<\/strong>/);
  assert.match(html, /EVACUATED 100/);
  assert.match(html, /BUILDINGS DESTROYED 30/);
});

test('fleet upgrades charge their prices, respect caps and never mutate an active battle',()=>{
  const h=setup(),rules=vm.runInContext('META',h.context),snapshot=JSON.stringify(h.ui.game.s);
  let saves=0;h.ui.persistence.saveProfile=()=>saves++;
  for(const key of ['constructionProtocols','logisticsFrame','repairLogistics']) {
    const rule=rules[key];
    for(let level=0;level<rule.max;level++) {
      h.ui.profile.aether=rule.costs[level]-1;h.ui.buyUpgrade(key);
      assert.equal(h.ui.profile.upgrades[key]||0,level);
      h.ui.profile.aether++;h.ui.buyUpgrade(key);
      assert.equal(h.ui.profile.upgrades[key],level+1);assert.equal(h.ui.profile.aether,0);
    }
    h.ui.profile.aether=10000;h.ui.buyUpgrade(key);
    assert.equal(h.ui.profile.upgrades[key],5);assert.equal(h.ui.profile.aether,10000);
  }
  assert.equal(saves,15);assert.equal(JSON.stringify(h.ui.game.s),snapshot);
});

test('command module purchases use rank prices without changing the active battle snapshot', () => {
  const h = setup(), snapshot = JSON.stringify(h.ui.game.s), rules = vm.runInContext('COMMAND_MODULES', h.context);
  let saves = 0; h.ui.persistence.saveProfile = () => saves++;
  for (let rank = 0; rank < 3; rank++) {
    h.ui.profile.aether = rules.disruption.costs[rank] - 1; h.ui.buyUpgrade('disruption');
    assert.equal(h.ui.profile.upgrades.disruption || 0, rank);
    h.ui.profile.aether++; h.ui.buyUpgrade('disruption');
    assert.equal(h.ui.profile.upgrades.disruption, rank + 1); assert.equal(h.ui.profile.aether, 0);
  }
  h.ui.profile.aether = 5000; h.ui.buyUpgrade('disruption');
  assert.equal(h.ui.profile.upgrades.disruption, 3); assert.equal(h.ui.profile.aether, 5000);
  assert.equal(saves, 3); assert.equal(JSON.stringify(h.ui.game.s), snapshot);
});

test('best expedition depth unlocks factions at 10 and 25', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  for (const [depth, unlocked] of [[0, 0], [9, 0], [10, 1], [24, 1], [25, 2]]) {
    h.ui.profile.expeditionDepth = depth;
    assert.deepEqual([0, 1, 2].map(faction => h.ui.factionUnlocked(faction)),
      [true, unlocked >= 1, unlocked >= 2]);
  }
  h.ui.profile.expeditionDepth = 9;
  h.ui.expedition = { version: 5, faction: 0, abilities: ['orbital','repair','scan','drop'], depth: 9, benefits: {}, enemyBenefits: [{}, {}, {}],
    encounter: { mission: 'hq-elimination', enemies: [1, 2, 0], map: 'desert', seed: 1409 }, offers: [] };
  h.ui.game.s.stats = { kills: 0, lost: 0, gathered: 0 };
  h.ui.showResult = () => {};
  let saves = 0; h.ui.persistence.saveProfile = () => { saves++; };
  h.ui.event('result', { win: true });
  assert.equal(h.ui.profile.expeditionDepth, 10); assert.equal(h.ui.factionJustUnlocked, 1); assert.equal(saves, 1);
  h.ui.resultAetherRecovered = undefined; h.ui.expedition.depth = 24; h.ui.profile.expeditionDepth = 24;
  h.ui.event('result', { win: true });
  assert.equal(h.ui.profile.expeditionDepth, 25); assert.equal(h.ui.factionJustUnlocked, 2); assert.equal(saves, 2);
});

test('enemy choices use the shared three-offer pool and caps with deterministic faction preferences',()=>{
  const h=setup(),{chooseEnemyBenefit:choose,expeditionBenefitOffers:offers,EXPEDITION_BENEFITS:rules}=
    vm.runInContext('({chooseEnemyBenefit,expeditionBenefitOffers,EXPEDITION_BENEFITS})',h.context);
  vm.runInContext("Math.random=()=>{throw Error('Unseeded choice');}",h.context);
  const counts=[{}, {}, {}],empty=Object.freeze({});
  for(let seed=1;seed<=1000;seed++)for(const faction of [0,1,2]) {
    const key=choose(faction,empty,seed,21);
    assert.ok(Object.hasOwn(rules,key));assert.equal(choose(faction,empty,seed,21),key);
    counts[faction][key]=(counts[faction][key]||0)+1;
  }
  for(const c of counts)assert.equal(Object.keys(c).length,Object.keys(rules).length,'no faction-exclusive benefits');
  assert.ok(counts[0].fieldWorkshop>counts[2].fieldWorkshop);
  assert.ok(counts[1].pioneerSquad>counts[0].pioneerSquad);
  assert.ok(counts[2].commandCapacitor>counts[1].commandCapacitor);
  const perks={};
  for(let depth=1;depth<=100;depth++) {
    const key=choose(depth%3,Object.freeze({...perks}),depth*7919,depth);
    perks[key]=(perks[key]||0)+1;
    assert.ok(perks[key]<=(rules[key].max??Infinity));
  }
  assert.equal(Object.values(perks).reduce((a,b)=>a+b,0),100);
  const capped=Object.fromEntries(Object.entries(rules).filter(([,rule])=>rule.max).map(([key,rule])=>[key,rule.max]));
  assert.deepEqual(Array.from(offers(capped,()=>.5)).sort(),['aetherAllocation','commandDrill','supplyCrate']);
  for(const faction of [0,1,2])assert.ok(['aetherAllocation','commandDrill','supplyCrate'].includes(choose(faction,capped,1409,21)));
});

test('expedition benefits are offered deterministically and bounded on selection',()=>{
  const h=setup(),rules=vm.runInContext('EXPEDITION_BENEFITS',h.context),seen=new Set();
  h.ui.expedition={faction:0,depth:8,benefits:{},enemyBenefits:[{},{},{}],offers:[],encounter:{mission:'hq-elimination',enemies:[1,0,2],map:'desert',seed:1409}};
  const run=h.ui.expedition;
  for(let seed=1;seed<=30;seed++) {
    run.encounter.seed=seed;
    const offers=Array.from(h.ui.createBenefitOffers(run));
    assert.equal(new Set(offers).size,3);assert.deepEqual(Array.from(h.ui.createBenefitOffers(run)),offers);
    offers.forEach(k=>seen.add(k));
  }
  for(const key of ['surveyDrones','fieldWorkshop','commandCapacitor']) {
    assert.ok(seen.has(key));run.offers=[key];
    h.ui.game.start=()=>{};h.ui.chooseBenefit(key);assert.equal(run.benefits[key],1);
    run.benefits[key]=rules[key].max;run.offers=[key];h.ui.chooseBenefit(key);
    assert.equal(run.benefits[key],rules[key].max);
    assert.ok(!h.ui.createBenefitOffers(run).includes(key));
  }
  assert.ok(seen.has('commandDrill'));assert.equal(rules.commandDrill.max,undefined);
  run.offers=['commandDrill'];h.ui.chooseBenefit('commandDrill');
  run.offers=['commandDrill'];h.ui.chooseBenefit('commandDrill');
  assert.equal(run.benefits.commandDrill,2);
});

test('home and transition previews use the actual next landscape and atmosphere seed', () => {
  const h = setup(), maps = [];
  h.ui.expedition = { faction: 0, abilities: ['orbital','repair','scan','drop'], depth: 2, benefits: {}, enemyBenefits: [{}], offers: [],
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
  const saved = []; h.ui.persistence.saveExpedition = value => saved.push(JSON.parse(JSON.stringify(value)));
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
    abilities: ['orbital', 'repair', 'scan', 'drop'], benefits: {}, enemyBenefits: [{}], depth: 0 });
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
  h.ui.game.s.entities = [b]; h.ui.selected = [7]; h.ui.tab = 'building';
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

test('building camera gestures and own-target selection do not set rally; minimap right-click deselects', () => {
  const h = buildingPanel(); h.UI.prototype.bind.call(h.ui); h.ui.select = h.UI.prototype.select;
  h.pointer('pointerdown',200,200); h.pointer('pointermove',240,230); h.pointer('pointerup',240,230);
  assert.deepEqual(Array.from(h.ui.selected),[7]); assert.equal(h.b.rally,undefined);
  h.pointer('pointerdown',100,100,{target:h.minimap}); h.pointer('pointerup',100,100,{target:h.minimap});
  assert.deepEqual(Array.from(h.ui.selected),[7]); assert.equal(h.b.rally,undefined);
  h.pointer('pointerdown',100,100,{target:h.minimap,pointerType:'mouse',button:2});
  h.pointer('pointerup',100,100,{target:h.minimap,pointerType:'mouse',button:2});
  assert.deepEqual(Array.from(h.ui.selected),[]); assert.deepEqual(h.calls,[]);
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

test('queue view compares multiplayer values instead of snapshot identities and refreshes actor/faction labels', () => {
  const h = queueViewSetup(), g = h.ui.game, original = h.ui.recruitmentGroups;
  let groups = 0;
  h.ui.recruitmentGroups = function() { groups++; return original.call(this); };
  g.networkTeam = 0;
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
  g.s.parties.push({ id: 1, faction: 2 }); g.localTeam = g.networkTeam = 1;
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

test('recruitment delegates producer choice to the simulation, independent of selection', () => {
  const h = setup();
  h.ui.game.train = (...args) => h.calls.push(['train',...args]);
  h.ui.selected = [99]; h.UI.prototype.perform.call(h.ui, 'train:rifle');
  assert.deepEqual(h.calls, [['train','rifle']], 'selection is not a preferred producer');
});

test('building and unit actions use the model portrait of the active faction', () => {
  const h = setup();
  for (const faction of [0, 1, 2]) {
    h.ui.game.s.parties[0].faction = faction;
    const html = h.UI.prototype.actionButton.call(h.ui, 'build:hq', 'HQ', 'hq');
    assert.match(html, new RegExp(`assets/portraits/faction-${faction}-building-hq\\.webp`));
    assert.match(html, /class="action-model"/);
  }
  for (const faction of [0, 1, 2]) {
    h.ui.game.s.parties[0].faction = faction;
    const html = h.UI.prototype.actionButton.call(h.ui, 'train:worker', 'Worker', 'worker');
    assert.match(html, new RegExp(`assets/portraits/faction-${faction}-unit-worker\\.webp`));
    assert.match(html, /class="action-model"/);
  }
});

test('action availability refreshes synchronously without a HUD tick', () => {
  const h = setup(), g = h.ui.game;
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
        assert.equal(button.disabled, active ? false : action !== 'ability:scan', action);
      } else if (/^(train|build):/.test(action)) {
        assert.equal(button.disabled, true, action);
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
  assert.ok(panels[0].buttons.filter(b => b.dataset.action !== 'ability:scan').every(b => b.disabled),
    'state still refreshes when markup is unchanged');
});

test('HUD disables full queues, missing producers, queued commander and unavailable building actions', () => {
  const h = buildingPanel(), g = h.ui.game;
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
  assert.ok(buttons.every(b=>b.disabled));
  h.b.queue.pop(); g.buildingRepairers = () => [{}]; g.canSellBuilding = () => '';
  h.UI.prototype.updateHUD.call(h.ui);
  assert.equal(rifle.disabled,false); assert.equal(repair.disabled,false); assert.equal(sell.disabled,false);
  assert.equal(hero.disabled,true); assert.equal(air.disabled,true);
  h.ui.mode = {kind:'ability',arg:'scan'}; h.UI.prototype.updateHUD.call(h.ui);
  assert.equal(repair.disabled,true); assert.equal(sell.disabled,true);
  h.ui.paused = true; h.UI.prototype.updateHUD.call(h.ui); assert.ok(buttons.every(b=>b.disabled));
});

test('HUD reads supply and capacity once per update and gates recruitment at capacity', () => {
  const h = buildingPanel(), g = h.ui.game;
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
    let supplyReads = 0, capacityReads = 0;
    g.supply = () => { supplyReads++; return supply; };
    g.cap = () => { capacityReads++; return capacity; };
    h.UI.prototype.updateHUD.call(h.ui);
    assert.deepEqual(buttons.map(button => button.disabled), blocked);
    assert.deepEqual([supplyReads, capacityReads], [1, 1]);
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
      assert.equal(button.disabled, available < energy);
    }
    g.s.parties[0].account.abilities[kind] = 12.2;
    h.UI.prototype.updateHUD.call(h.ui);
    assert.equal(button.disabled, true);
    g.s.parties[0].account.abilities[kind] = 10;
    h.UI.prototype.updateHUD.call(h.ui);
    assert.equal(button.disabled, false);
    if(kind==='orbital') {
      g.abilityRequirement=()=>'Requires a completed War foundry.';
      h.UI.prototype.updateHUD.call(h.ui);
      assert.equal(button.disabled,true);
      g.abilityRequirement=()=>null;
    }
  }
});
