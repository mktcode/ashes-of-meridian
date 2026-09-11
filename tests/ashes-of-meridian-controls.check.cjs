const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { loadScripts } = require('./helpers/game-scripts.cjs');

function setup() {
  const target = () => ({
    handlers: {}, style: {}, classList: { add() {}, remove() {} },
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
    document, window, innerWidth: 1280, innerHeight: 800, performance: { now: () => 0 }
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
    select(ids, add = false) { this.selected = [...ids]; calls.push(['select', [...ids], add]); }
    pick() { return null; }
    openModal(kind, html) { this.html = html; }
  }
  const game = {
    s: { cam: { x: 0, z: 0, zoom: 50 }, time: 0, speed: 1, groups: {}, entities: [] },
    alive(predicate) { return this.s.entities.filter(predicate); },
    get(id) { return this.s.entities.find(e => e.id === id); },
    command(...args) { calls.push(['command', ...args]); }
  };
  const ui = new TestUI(game, { ground: (x, y) => ({ x: x / 10, z: y / 10 }) },
    { unlock() {} }, { unlocked: 0, settings: { quality: 2 } }, {});
  ui.view = 'game'; ui.paused = false;
  const key = (key, options = {}) => ui.keyDown({ key, preventDefault() {}, ...options });
  const world = document.getElementById('world'), minimap = document.getElementById('minimap');
  const pointer = (type, x, y, options = {}) => {
    const event = { pointerType: 'touch', pointerId: 1, button: 0, clientX: x, clientY: y,
      target: world, preventDefault() {}, ...options };
    (event.target.handlers[type])(event);
  };
  const clickCamera = cam => document.handlers.click({ target: {
    closest: () => ({ dataset: { cam } })
  } });
  return { ui, calls, key, document, window, footer, world, minimap, pointer, clickCamera, UI };
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

test('F and modified shortcuts remain; focus and pause still suppress commands', () => {
  const h = setup();
  h.key('a', { ctrlKey: true }); h.key('s', { ctrlKey: true });
  h.key('d', { altKey: true }); h.key('w', { metaKey: true });
  h.key('f'); h.key('f', { repeat: true }); h.ui.tick(.1);
  assert.deepEqual(h.calls, [['army'], ['save'], ['mode', 'attackMove']]);
  assert.deepEqual(h.ui.game.s.cam, { x: 0, z: 0, zoom: 50 });
  for (const tagName of ['INPUT', 'SELECT', 'TEXTAREA']) {
    h.document.activeElement.tagName = tagName; h.key('f');
  }
  h.document.activeElement.tagName = 'BODY'; h.ui.paused = true; h.key('f'); h.ui.tick(.1);
  assert.deepEqual(h.calls, [['army'], ['save'], ['mode', 'attackMove']]);
});

test('control groups still select, but double recall no longer centers the camera', () => {
  const h = setup();
  h.ui.selected = [7]; h.key('1', { ctrlKey: true });
  h.key('1'); h.key('1');
  assert.deepEqual(h.calls, [['select', [7], false], ['select', [7], false]]);
  assert.deepEqual(h.ui.game.s.cam, { x: 0, z: 0, zoom: 50 });
  assert.equal('lastGroup' in h.ui, false);
  assert.equal(h.UI.prototype.centerSelection, undefined);
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

test('remaining command hotkeys keep their existing assignments', () => {
  const h = setup();
  for (const key of ['m', 'h', 'x', 'q', 'b', 'n', 't', 'e', 'r', 'c', 'v', 'y', 'F2', 'F3']) h.key(key);
  assert.deepEqual(h.calls, [['mode', 'move'], ['perform', 'hold'], ['perform', 'stop'],
    ['tab', 'orders'], ['tab', 'build'], ['tab', 'army'], ['tab', 'tech'],
    ['mode', 'ability', 'orbital'], ['mode', 'ability', 'repair'], ['mode', 'ability', 'scan'],
    ['mode', 'ability', 'drop'], ['mode', 'rally'], ['army'], ['worker']]);
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
  assert.match(h.ui.html, /F → click ground/);
  assert.match(h.ui.html, /Drag with one finger/); assert.match(h.ui.html, /Pinch/);
  assert.doesNotMatch(h.ui.html, /WASD|Middle-button|Mouse wheel|Space \/ Home/);
  h.UI.prototype.setControlHints.call(h.ui);
  assert.match(h.footer.innerHTML, /<kbd>F<\/kbd> ATTACK-MOVE/);
  assert.match(h.footer.innerHTML, /DRAG TO PAN · PINCH TO ZOOM/);
  assert.doesNotMatch(h.footer.innerHTML, /WASD|WHEEL|SPACE/);
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /WASD|WHEEL|SPACE|\(Space\)/);
  h.ui.game.s.upgrades = {}; h.ui.game.s.m = { tier: 1 }; h.ui.game.s.faction = 0;
  h.ui.renderActions();
  const actions = h.document.getElementById('actions').innerHTML;
  assert.match(actions, /Command view/); assert.doesNotMatch(actions, /SPACE/);
});
