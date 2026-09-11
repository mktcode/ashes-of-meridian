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
    s: { cam: { x: 0, z: 0, zoom: 50 }, time: 0, speed: 1, entities: [], m: { tier: 1 }, upgrades: {}, faction: 0 },
    effects: { floats: [] }, canBuild: () => '', cost: () => ({ cost: 0, gas: 0 }),
    alive(predicate) { return this.s.entities.filter(predicate); },
    get(id) { return this.s.entities.find(e => e.id === id); },
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
  for (const tab of ['orders','build','army','tech']) h.click({ tab });
  assert.deepEqual(h.calls.map(c => c[0] === 'command' ? ['command', c[2].type] : c), [
    ['mode','attackMove'], ['mode','move'], ['command','hold'], ['command','stop'],
    ['mode','ability','orbital'], ['mode','ability','repair'], ['mode','ability','scan'],
    ['mode','ability','drop'], ['mode','rally'], ['army'], ['worker'], ['base'],
    ['tab','orders'], ['tab','build'], ['tab','army'], ['tab','tech']
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
    h.document.handlers.mousemove({ target: { closest: () => ({ dataset: { tooltip: 'move' } }) } });
    assert.equal(h.document.getElementById('tooltip').classList.contains('hidden'), true);
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
  assert.doesNotMatch(h.ui.tooltipFor('attackMove'), /Shift|queue waypoints/);
  h.ui.game.s.upgrades = {}; h.ui.game.s.m = { tier: 1 }; h.ui.game.s.faction = 0;
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
