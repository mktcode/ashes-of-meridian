const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { loadScripts } = require('./helpers/game-scripts.cjs');

function setup() {
  const target = () => ({
    handlers: {}, style: {}, classList: {
      names: new Set(), add(name) { this.names.add(name); }, remove(name) { this.names.delete(name); },
      contains(name) { return this.names.has(name); }
    },
    addEventListener(type, handler) { this.handlers[type] = handler; },
    setPointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 180, height: 180 })
  });
  const elements = new Map();
  const document = { ...target(), activeElement: { tagName: 'BODY' }, querySelectorAll: () => [],
    getElementById(id) {
      assert.notEqual(id, 'tooltip', 'removed tooltip DOM must never be accessed');
      if (!elements.has(id)) elements.set(id, target());
      return elements.get(id);
    }
  };
  const window = target(), footer = document.getElementById('controlstrip');
  const context = loadScripts(['core', 'content', 'world', 'ui'], { globals: {
    document, window, innerWidth: 1280, innerHeight: 800, performance: { now: () => 0 },
    formatTime: () => '00:00'
  } });
  const UI = vm.runInContext('MeridianUI', context), calls = [];
  class TestUI extends UI {
    bind() {} setControlHints() {} updateHUD() {} drawMinimap() {}
    setMode(...args) { calls.push(['mode', ...args]); }
    perform(...args) { calls.push(['perform', ...args]); }
    setTab(...args) { calls.push(['tab', ...args]); }
    selectArmy() { calls.push(['army']); }
    selectWorker() { calls.push(['worker']); }
    save() { calls.push(['save']); }
    homeCamera() { calls.push(['base']); }
    select(ids) { this.selected = [...ids]; calls.push(['select', [...ids]]); }
    pick() { return null; }
    openModal(kind, html) { this.html = html; }
  }
  const game = {
    s: { cam: { x: 0, z: 0, zoom: 50 }, time: 0, speed: 1, entities: [], m: { tier: 1 }, faction: 0 },
    effects: { floats: [] }, canBuild: () => '', cost: () => ({ cost: 0, gas: 0 }),
    alive(predicate) { return this.s.entities.filter(predicate); },
    get(id) { return this.s.entities.find(e => e.id === id); },
    managedBuilding(id) { const b = this.get(id); return !this.s.result && b?.kind === 'building' && b.team === 0 && b.hp > 0 && b.progress >= 1 && b.type !== 'ward' ? b : null; },
    buildingRepairers: () => [], canRepairBuilding: () => '', canSellBuilding: () => '',
    command(...args) { calls.push(['command', ...args]); }
  };
  const ui = new TestUI(game, {
    ground: (x, y) => ({ x: x / 10, z: y / 10 }),
    project: (x, y, z) => ({ x, y: z })
  },
    { unlock() {}, sound() {} }, { unlocked: 0, settings: { quality: 2 } }, {});
  ui.view = 'game'; ui.paused = false;
  const key = (key, options = {}) => document.handlers.keydown?.({ key, preventDefault() {}, ...options });
  const world = document.getElementById('world'), minimap = document.getElementById('minimap');
  const pointer = (type, x, y, options = {}) => {
    const event = { pointerType: 'touch', pointerId: 1, button: 0, clientX: x, clientY: y,
      target: world, preventDefault() {}, ...options };
    (event.target.handlers[type])(event);
  };
  const click = dataset => document.handlers.click({ target: { closest: () => ({ dataset }) } });
  const clickCamera = cam => click({ cam });
  return { ui, calls, key, document, window, footer, world, minimap, pointer, click, clickCamera, UI };
}

test('camera keys and pointer edges no longer move the camera', () => {
  const h = setup();
  for (const key of ['w', 'a', 's', 'd', 'W', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Home']) {
    h.key(key); h.key(key, { repeat: true }); h.key(key, { shiftKey: true }); h.ui.tick(.1);
    assert.deepEqual(h.ui.game.s.cam, { x: 0, z: 0, zoom: 50 });
  }
  for (const [x, y] of [[0, 400], [1279, 400], [640, 70], [640, 555]]) {
    h.ui.pointer = { x, y, inside: true }; h.ui.tick(.1);
    assert.deepEqual(h.ui.game.s.cam, { x: 0, z: 0, zoom: 50 });
  }
  assert.equal('keys' in h.ui, false);
  assert.deepEqual(h.calls, []);
});

test('no keyboard handler remains for game commands, menus or targeting', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  assert.equal(h.UI.prototype.keyDown, undefined);
  assert.equal(h.document.handlers.keydown, undefined);
  assert.equal(h.document.handlers.keyup, undefined);
  h.ui.mode = { kind: 'move' };
  for (const key of ['f','m','h','x','q','b','n','t','e','r','c','v','y','F1','F2','F3','F5','F9','Tab','Escape','a','s']) {
    h.key(key); h.key(key, { ctrlKey: true });
  }
  assert.deepEqual(h.calls, []); assert.equal(h.ui.mode.kind, 'move');
  assert.equal(h.ui.paused, false);
});

test('number keys no longer assign or recall control groups', () => {
  const h = setup(); h.ui.selected = [7];
  for (let n = 1; n <= 9; n++) {
    h.key(String(n), { ctrlKey: true }); h.key(String(n)); h.key(String(n), { shiftKey: true });
  }
  assert.deepEqual(h.calls, []); assert.deepEqual(h.ui.selected, [7]);
  assert.equal('groups' in h.ui.game.s, false);
  assert.deepEqual(h.ui.game.s.cam, { x: 0, z: 0, zoom: 50 });
});

test('left mouse dragging neither draws a selection rectangle nor changes selection or orders', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
  // A hidden entity keeps the overlay empty but would be inside the former selection box.
  const unit = { id: 1, team: 0, kind: 'unit', type: 'rifle', hp: 0, x: 220, z: 220 };
  h.ui.game.s.entities.push(unit); h.ui.pick = () => unit;
  h.pointer('pointerdown', 200, 200, { pointerType: 'mouse' });
  h.pointer('pointermove', 240, 230, { pointerType: 'mouse' });
  const draws = [];
  const ctx = new Proxy({}, { get: (_, key) => (...args) => draws.push([key, ...args]) });
  h.ui.drawOverlay(ctx);
  assert.equal(draws.some(([name]) => name === 'fillRect' || name === 'strokeRect'), false);
  h.pointer('pointerup', 240, 230, { pointerType: 'mouse' });
  assert.deepEqual(h.calls, []); assert.deepEqual(h.ui.selected, [7]);
  assert.deepEqual(h.ui.game.s.cam, { x: 0, z: 0, zoom: 50 });
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

test('mouse clicks and portrait clicks replace selection even with Shift; select still deduplicates', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
  h.ui.pick = () => ({ id: 1, team: 0, kind: 'unit', type: 'rifle' });
  h.pointer('pointerdown', 200, 200, { pointerType: 'mouse', shiftKey: true });
  h.pointer('pointerup', 200, 200, { pointerType: 'mouse', shiftKey: true });
  assert.deepEqual(h.ui.selected, [1]);
  h.document.handlers.click({ shiftKey: true, target: { closest: () => ({ dataset: { select: '2' } }) } });
  assert.deepEqual(h.ui.selected, [2]);
  h.ui.game.s.entities = [{ id: 1 }, { id: 2 }];
  h.ui.audio.sound = () => {}; h.ui.updateSelection = () => {}; h.ui.renderActions = () => {};
  h.UI.prototype.select.call(h.ui, [1, 1, 99]);
  assert.deepEqual(Array.from(h.ui.selected), [1]);
});

test('Shift no longer queues commands or keeps successful targeting active', () => {
  for (const mini of [false, true]) for (const rightClick of [false, true]) {
    const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
    h.ui.mode = { kind: 'attackMove' };
    const options = { pointerType: 'mouse', button: rightClick ? 2 : 0, shiftKey: true,
      target: mini ? h.minimap : h.world };
    h.pointer('pointerdown', 100, 100, options); h.pointer('pointerup', 100, 100, options);
    assert.equal(h.calls.length, 1); assert.equal(h.calls[0][0], 'command');
    assert.equal(h.calls[0].length, 3, 'only selection and current order reach command');
    assert.equal(h.ui.mode, null);
  }
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  h.ui.mode = { kind: 'build', arg: 'depot' }; h.ui.game.build = () => false;
  h.pointer('pointerdown', 200, 200, { shiftKey: true });
  h.pointer('pointerup', 200, 200, { shiftKey: true });
  assert.equal(h.ui.mode.kind, 'build', 'failed placement still allows retry');
  h.ui.game.build = () => true;
  h.pointer('pointerdown', 200, 200, { shiftKey: true });
  h.pointer('pointerup', 200, 200, { shiftKey: true });
  assert.equal(h.ui.mode, null);
});

test('wheel and key-release listeners are gone; middle-button drag does nothing', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  assert.equal(h.world.handlers.wheel, undefined);
  assert.equal(h.document.handlers.keyup, undefined);
  h.pointer('pointerdown', 200, 200, { pointerType: 'mouse', button: 1 });
  h.pointer('pointermove', 240, 230, { pointerType: 'mouse', button: 1 });
  h.pointer('pointerup', 240, 230, { pointerType: 'mouse', button: 1 });
  assert.equal(h.ui.drag, null);
  assert.deepEqual(h.ui.game.s.cam, { x: 0, z: 0, zoom: 50 });
  assert.deepEqual(h.calls, []);
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
  assert.equal(h.ui.game.s.cam.zoom, 32);
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

test('camera buttons and minimap tap/drag still navigate with existing limits', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  h.ui.homeCamera = h.UI.prototype.homeCamera;
  h.ui.game.s.entities.push({ id: 1, team: 0, type: 'hq', x: 20, z: 30 });
  h.clickCamera('home');
  assert.deepEqual(h.ui.game.s.cam, { x: 24, z: 28, zoom: 50 });
  h.clickCamera('in'); assert.equal(h.ui.game.s.cam.zoom, 42.5);
  h.clickCamera('out'); assert.equal(h.ui.game.s.cam.zoom, 42.5 * 1.18);
  for (let i = 0; i < 20; i++) h.clickCamera('in');
  assert.equal(h.ui.game.s.cam.zoom, 32);
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

test('command buttons and tabs retain their actions; pause suppresses battlefield actions', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.perform = h.UI.prototype.perform;
  for (const action of ['attackMove','move','hold','stop','ability:orbital','ability:repair','ability:scan','ability:drop','rally','army','worker','home'])
    h.click({ action });
  for (const tab of ['orders','build','army']) h.click({ tab });
  assert.deepEqual(h.calls.map(c => c[0] === 'command' ? ['command', c[2].type] : c), [
    ['mode','attackMove'], ['mode','move'], ['command','hold'], ['command','stop'],
    ['mode','ability','orbital'], ['mode','ability','repair'], ['mode','ability','scan'],
    ['mode','ability','drop'], ['mode','rally'], ['army'], ['worker'], ['base'],
    ['tab','orders'], ['tab','build'], ['tab','army']
  ]);
  h.calls.length = 0; h.ui.paused = true; h.click({ action: 'ability:orbital' });
  assert.deepEqual(h.calls, []);
});

test('Cancel button exits every targeting mode without spending resources or changing orders', () => {
  for (const [kind, arg] of [['build','depot'], ['move'], ['attackMove'], ['rally'],
    ...['orbital','repair','scan','drop'].map(a => ['ability',a])]) {
    const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
    const before = JSON.stringify(h.ui.game.s);
    if (kind === 'build') h.ui.tab = 'build';
    h.UI.prototype.setMode.call(h.ui, kind, arg);
    assert.equal(h.document.getElementById('modeIndicator').classList.contains('hidden'), false);
    assert.match(h.document.getElementById('modeLabel').textContent, /TAP TO CONFIRM/);
    assert.match(h.document.getElementById('actions').innerHTML, /class="action[^"\n]*\bactive\b/);
    h.click({ ui: 'cancelTarget' });
    assert.equal(h.ui.mode, null);
    assert.equal(h.document.getElementById('modeIndicator').classList.contains('hidden'), true);
    assert.equal(h.world.style.cursor, 'default');
    assert.doesNotMatch(h.document.getElementById('actions').innerHTML, /class="action[^"\n]*\bactive\b/);
    assert.deepEqual(h.ui.selected, [7]); assert.equal(h.ui.paused, false);
    assert.equal(JSON.stringify(h.ui.game.s), before); assert.deepEqual(h.calls, []);
  }
});

test('pause, resume, help, save/load and modal close remain available as button actions', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  h.ui.pause = () => { h.ui.paused = true; h.calls.push(['pause']); };
  h.ui.resume = () => { h.ui.paused = false; h.calls.push(['resume']); };
  h.ui.showHelp = () => h.calls.push(['help']);
  h.ui.load = () => h.calls.push(['load']); h.ui.closeModal = () => h.calls.push(['close']);
  h.document.getElementById('pauseBtn').onclick(); h.document.getElementById('pauseBtn').onclick();
  h.document.getElementById('helpBtn').onclick();
  for (const ui of ['save','load','closeModal']) h.click({ ui });
  assert.deepEqual(h.calls, [['pause'],['resume'],['help'],['save'],['load'],['close']]);
});

test('home redesign preserves dynamic campaign progress, checkpoint priority and navigation actions', () => {
  for (const saved of [false, true]) for (const progressed of [false, true]) {
    const h = setup(); let previews = 0;
    h.ui.game.s = null; h.ui.view = 'home';
    h.ui.profile.medals = progressed ? { 0: 3, 1: 1, 2: 0 } : {};
    h.ui.persistence.hasCheckpoint = () => saved;
    h.ui.onPreview = () => previews++;
    h.ui.showHome();
    const html = h.document.getElementById('menu').innerHTML;
    assert.match(html, /class="home-screen"/);
    assert.match(html, /aria-label="Ashes of Meridian"/);
    assert.ok(html.includes(`${progressed ? 2 : 0}/16 OPERATIONS COMPLETE`));
    assert.ok(html.includes(progressed ? 'Continue the campaign' : 'Enter the campaign'));
    assert.deepEqual(Array.from(html.matchAll(/data-ui="([^"]+)"/g), m => m[1]),
      [...(saved ? ['continue'] : []), 'campaign', 'skirmish', 'armory', 'help', 'settings']);
    assert.equal((html.match(/class="primary"/g) || []).length, 1);
    assert.ok(html.includes(`class="primary" data-ui="${saved ? 'continue' : 'campaign'}"`));
    assert.equal(previews, 1); assert.equal(h.ui.R.fogOn, false);
    assert.equal(h.ui.view, 'home'); assert.equal(h.ui.paused, true);
    assert.deepEqual(h.calls, []);
  }
});

test('tooltips and native title hints are removed without removing pointer press guards or accessible names', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  assert.equal(h.UI.prototype.tooltipFor, undefined);
  assert.equal(h.document.handlers.mousemove, undefined);
  assert.equal(typeof h.world.handlers.pointermove, 'function');
  h.document.handlers.pointerdown({ target: { closest: () => ({}) } });
  assert.equal(h.ui.domPressed, true);
  h.document.handlers.pointerup(); assert.equal(h.ui.domPressed, false);
  h.document.handlers.pointerdown({ target: { closest: () => null } });
  assert.equal(h.ui.domPressed, false);
  for (const file of ['ui.js', 'index.html', 'styles.css']) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.doesNotMatch(source, /tooltip|tt-cost|\stitle=["']|\.title\s*=/i, file);
  }
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /<title>Ashes of Meridian/);
  for (const [attribute, value, label] of [
    ['id', 'missionHome', 'Pause / operations'], ['id', 'pauseBtn', 'Pause'],
    ['data-cam', 'home', 'Center on command'], ['data-cam', 'in', 'Zoom in'],
    ['data-cam', 'out', 'Zoom out'], ['id', 'soundBtn', 'Sound'],
    ['id', 'helpBtn', 'Field manual'], ['id', 'minimap', 'Tactical overview']
  ]) assert.match(html, new RegExp(`${attribute}="${value}"[^>]*aria-label="${label}"`));
});

test('actions retain visible costs; portrait selection and queue cancellation retain labels and actions without tooltips', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  const button = h.ui.actionButton('train:rifle', 'Vanguard', 'rifle', { cost: { cost: 75, gas: 20 } });
  assert.match(button, /data-action="train:rifle"/); assert.match(button, /Vanguard/);
  assert.match(button, /75◆ 20⬡/); assert.doesNotMatch(button, /tooltip|\stitle=/);
  h.ui.game.s.entities = [
    { id: 1, kind: 'building', type: 'barracks', team: 0, queue: [{ type: 'rifle', time: 11, progress: .5 }] },
    { id: 2, kind: 'unit', type: 'rifle', faction: 0, hp: 150, maxHp: 150 },
    { id: 3, kind: 'unit', type: 'medic', faction: 0, hp: 130, maxHp: 130 }
  ];
  h.ui.selected = [2, 3]; h.ui.updateSelection();
  const portraits = h.document.getElementById('selectionContent').innerHTML;
  assert.match(portraits, /data-select="2" aria-label="Vanguard"/);
  assert.match(portraits, /data-select="3" aria-label="Field medic"/);
  assert.doesNotMatch(portraits, /\stitle=/);
  h.click({ select: '2' }); assert.deepEqual(h.ui.selected, [2]);
  h.ui.updateQueues();
  const queue = h.document.getElementById('productionQueue').innerHTML;
  assert.match(queue, /data-queue="1:0" aria-label="Vanguard · cancel recruitment"/);
  assert.match(queue, /6s/); assert.doesNotMatch(queue, /\stitle=/);
  h.ui.game.cancelQueue = (...args) => h.calls.push(['cancelQueue', ...args]);
  h.click({ queue: '1:0' });
  assert.deepEqual(h.calls, [['select', [2]], ['cancelQueue', 1, 0]]);
});

function buildingPanel() {
  const h = setup(), b = { id: 7, kind: 'building', type: 'barracks', team: 0, faction: 0, hp: 100, maxHp: 200, progress: 1, size: 2.9, x: 0, z: 0, queue: [] };
  h.ui.game.s.entities = [b]; h.ui.selected = [7];
  const panel = h.document.getElementById('buildingActions'), buttons = ['repair','sell'].map(action => ({ dataset: { buildingAction: action } }));
  panel.querySelectorAll = () => buttons; panel.offsetWidth = 260; panel.offsetHeight = 100;
  h.document.getElementById('topbar').getBoundingClientRect = () => ({ bottom: 63 });
  h.document.getElementById('commandDeck').getBoundingClientRect = () => ({ top: 584 });
  h.ui.R.project = () => ({ x: 640, y: 400 });
  return { ...h, b, panel, buttons };
}

test('building buttons follow projection, clamp to the play area and do not move under a pressed finger', () => {
  const h = buildingPanel(); h.ui.updateBuildingActions();
  assert.equal(h.panel.classList.contains('hidden'), false);
  assert.equal(h.panel.style.left, '510px'); assert.equal(h.panel.style.top, '288px');
  assert.deepEqual(h.buttons.map(b => b.dataset.buildingId), [7,7]);
  h.ui.R.project = () => ({ x: 1278, y: 580 }); h.ui.domPressed = true; h.ui.updateBuildingActions();
  assert.equal(h.panel.style.left, '510px');
  h.ui.domPressed = false; h.ui.updateBuildingActions();
  assert.equal(h.panel.style.left, '1012px'); assert.equal(h.panel.style.top, '468px');
  h.ui.R.project = () => ({ x: 1, y: 64 }); h.ui.updateBuildingActions();
  assert.equal(h.panel.style.left, '8px'); assert.equal(h.panel.style.top, '71px');
});

test('building panel avoids camera/help buttons vertically or sideways in a short play area', () => {
  const h = buildingPanel(); h.ui.R.project = () => ({ x: 1278, y: 580 });
  h.document.getElementById('cameraTools').getBoundingClientRect = () => ({ left: 1014, right: 1272, top: 542, bottom: 574 });
  h.ui.updateBuildingActions(); assert.equal(h.panel.style.left, '1012px'); assert.equal(h.panel.style.top, '434px');
  h.document.getElementById('topbar').getBoundingClientRect = () => ({ bottom: 460 });
  h.ui.updateBuildingActions(); assert.equal(h.panel.style.left, '746px'); assert.equal(h.panel.style.top, '468px');
});

test('building buttons hide for ineligible selection, offscreen targets, targeting, pause and modals', () => {
  for (const mode of ['none','many','enemy','ally','unit','ward','foundation','dead','result','offscreen','behind','paused','modal','target','home']) {
    const h = buildingPanel();
    if (mode === 'none') h.ui.selected = [];
    if (mode === 'many') h.ui.selected = [7,8];
    if (mode === 'enemy') h.b.team = 1;
    if (mode === 'ally') h.b.team = 2;
    if (mode === 'unit') h.b.kind = 'unit';
    if (mode === 'ward') h.b.type = 'ward';
    if (mode === 'foundation') h.b.progress = .5;
    if (mode === 'dead') h.b.hp = 0;
    if (mode === 'result') h.ui.game.s.result = { win: true };
    if (mode === 'offscreen') h.ui.R.project = () => ({ x: -10, y: 400 });
    if (mode === 'behind') h.ui.R.project = () => null;
    if (mode === 'paused') h.ui.paused = true;
    if (mode === 'modal') h.ui.modalKind = 'help';
    if (mode === 'target') h.ui.mode = { kind: 'move' };
    if (mode === 'home') h.ui.view = 'home';
    h.ui.updateBuildingActions(); assert.equal(h.panel.classList.contains('hidden'), true, mode);
  }
});

test('building button states expose no-worker/last-HQ restrictions and keep stopping repair available', () => {
  const h = buildingPanel();
  h.ui.game.canRepairBuilding = () => 'No workers'; h.ui.game.canSellBuilding = () => 'Last command center';
  h.ui.updateBuildingActions(); assert.deepEqual(h.buttons.map(b => b.disabled), [true,true]);
  assert.equal(h.document.getElementById('buildingActionStatus').textContent, 'No workers · Last command center');
  h.ui.game.buildingRepairers = () => [{}]; h.ui.updateBuildingActions();
  assert.equal(h.buttons[0].disabled, false); assert.equal(h.buttons[0].textContent, 'STOP REPAIR');
});

test('building buttons dispatch repair; sale pauses, cancels safely, confirms the captured ID and rejects stale repeats', () => {
  const h = buildingPanel(); h.UI.prototype.bind.call(h.ui); h.ui.openModal = h.UI.prototype.openModal;
  h.ui.game.toggleBuildingRepair = id => h.calls.push(['repair',id]);
  h.ui.game.buildingSaleRefund = () => ({cost:147.5,gas:0});
  h.ui.game.sellBuilding = id => h.calls.push(['sell',id]);
  h.click({ buildingAction: 'repair', buildingId: '7' }); assert.deepEqual(h.calls, [['repair',7]]);
  h.click({ buildingAction: 'sell', buildingId: '7' });
  assert.equal(h.ui.paused, true); assert.equal(h.ui.modalKind, 'sell');
  assert.equal(h.panel.classList.contains('hidden'), true);
  assert.match(h.document.getElementById('modal').innerHTML, /147.5 alloy/);
  h.click({ buildingAction: 'repair', buildingId: '7' }); assert.equal(h.calls.length, 1);
  h.click({ ui: 'cancelSale' }); assert.equal(h.ui.paused, false); assert.equal(h.calls.length, 1);
  h.click({ ui: 'confirmSale' }); assert.equal(h.calls.length, 1);
  h.click({ buildingAction: 'sell', buildingId: '7' }); h.ui.selected = [99];
  h.click({ ui: 'confirmSale' }); assert.deepEqual(h.calls, [['repair',7],['sell',7]]);
  assert.equal(h.ui.paused, false); assert.equal(h.ui.modalKind, '');
  h.click({ ui: 'confirmSale' }); assert.equal(h.calls.length, 2);
  h.ui.game.canSellBuilding = () => 'Last command center'; h.ui.toast = text => h.calls.push(['toast',text]);
  h.click({ buildingAction: 'sell', buildingId: '7' }); assert.equal(h.ui.paused, false);
  assert.deepEqual(h.calls.at(-1), ['toast','Last command center']);
});

test('command deck and help have no research actions; mission wards are never offered for construction', () => {
  const h = setup(), html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.deepEqual(Array.from(html.matchAll(/data-tab="([^"]+)"/g), m => m[1]), ['orders', 'build', 'army']);
  h.ui.showHelp(); assert.doesNotMatch(h.ui.html, /research/i);
  for (const faction of [0, 1, 2]) {
    h.ui.game.s.faction = faction; h.ui.tab = 'build'; h.ui.actionSignature = '';
    h.ui.renderActions();
    const actions = h.document.getElementById('actions').innerHTML;
    assert.deepEqual(Array.from(actions.matchAll(/data-action="build:([^"]+)"/g), m => m[1]),
      ['hq', 'barracks', 'depot', 'refinery', 'factory', 'hangar', 'turret']);
    assert.doesNotMatch(actions, /lab|ward|tech:|research|class="level"/i);
  }
  h.UI.prototype.perform.call(h.ui, 'tech:weapons'); assert.deepEqual(h.calls, []);
  h.ui.tab = 'army'; h.ui.renderActions();
  assert.match(h.document.getElementById('actions').innerHTML, /train:rifle/);
  h.ui.game.s.entities = [{ id: 1, type: 'barracks', kind: 'building', team: 0, queue: [{ type: 'rifle', time: 11, progress: .5 }] }];
  h.ui.updateQueues(); assert.match(h.document.getElementById('productionQueue').innerHTML, /data-queue="1:0"/);
});

test('selection retains damage/range and resource quantities, without the removed armor research level', () => {
  const h = setup();
  h.ui.game.rangedStats = () => ({ damage: 13, range: 9 });
  const entity = { id: 1, kind: 'unit', type: 'rifle', faction: 0, team: 0, hp: 150, maxHp: 150, order: { type: 'idle' } };
  h.ui.game.s.entities = [entity]; h.ui.selected = [1]; h.ui.updateSelection();
  let html = h.document.getElementById('selectionContent').innerHTML;
  assert.match(html, /DAMAGE<b>13/); assert.match(html, /RANGE<b>9/); assert.doesNotMatch(html, /ARMOR|REMAINING/);
  for (const [type, expected] of [['crystal', '1234'], ['gas', '∞']]) {
    Object.assign(entity, { kind: 'resource', type, amount: 1234 }); h.ui.updateSelection();
    assert.ok(h.document.getElementById('selectionContent').innerHTML.includes(`REMAINING<b>${expected}`));
  }
});

test('settings and camera hints describe touch navigation without desktop camera controls', () => {
  const h = setup(); h.ui.showSettings();
  assert.doesNotMatch(h.ui.html, /data-setting="edge"|Edge scrolling/);
  h.ui.showHelp();
  assert.match(h.ui.html, /Attack-move button → tap destination/);
  assert.doesNotMatch(h.ui.html, /<kbd>|F[12359]|\bEsc\b|to assist|keyboard/);
  assert.match(h.ui.html, /Drag with one finger/); assert.match(h.ui.html, /Pinch/);
  assert.doesNotMatch(h.ui.html, /WASD|Middle-button|Mouse wheel|Space \/ Home|box-select|Shift|control group/i);
  assert.match(h.ui.html, /Double-tap unit/);
  h.UI.prototype.setControlHints.call(h.ui);
  assert.doesNotMatch(h.footer.innerHTML, /<kbd>|F[12359]/);
  assert.match(h.footer.innerHTML, /DRAG TO PAN · PINCH TO ZOOM/);
  assert.doesNotMatch(h.footer.innerHTML, /WASD|WHEEL|SPACE|DRAG BOX|CTRL|LMB/);
  assert.match(h.footer.innerHTML, /TAP TO SELECT/);
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /WASD|WHEEL|SPACE|\(Space\)|DRAG BOX|CTRL|LMB|<kbd>|F[12359]|\bEsc\b/);
  assert.match(html, /data-ui="cancelTarget"/);
  h.ui.updateSelection();
  assert.doesNotMatch(h.document.getElementById('selectionContent').innerHTML, /Box-select|Right-click/);
  h.ui.game.s.m = { tier: 1 }; h.ui.game.s.faction = 0;
  h.ui.renderActions();
  const actions = h.document.getElementById('actions').innerHTML;
  assert.match(actions, /Command view/); assert.doesNotMatch(actions, /SPACE|class="key"|F[12359]/);
  h.ui.persistence.hasCheckpoint = () => true; h.ui.game.s.m.name = 'Test';
  h.ui.showPause();
  assert.doesNotMatch(h.ui.html, /<kbd>|F[12359]/);
  h.ui.profile.settings.tips = true; h.ui.game.s.index = 0; h.ui.game.s.time = 30;
  h.ui.game.s.stats = { trained: 0 };
  h.ui.game.supply = () => 0; h.ui.game.cap = () => 24; h.ui.game.has = () => false;
  h.ui.updateTips();
  assert.doesNotMatch(h.document.getElementById('tip').innerHTML, /\[N\]/);
  h.ui.game.s.stats.trained = 3; h.ui.game.supply = () => 23; h.ui.updateTips();
  assert.doesNotMatch(h.document.getElementById('tip').innerHTML, /\[B\]/);
  h.ui.game.s.stats.trained = 6; h.ui.game.supply = () => 0; h.ui.updateTips();
  assert.match(h.document.getElementById('tip').innerHTML, /Tap <b>Combat force/);
  assert.doesNotMatch(h.document.getElementById('tip').innerHTML, /F2|Press|Right-click/);
});
