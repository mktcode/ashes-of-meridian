const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts } = require('./helpers/game-scripts.cjs');

function setup() {
  const footer = { style: {}, classList: { add() {}, remove() {} } };
  const document = { activeElement: { tagName: 'BODY' }, getElementById: () => footer };
  const context = loadScripts(['content', 'ui'], { globals: {
    document, innerWidth: 1280, innerHeight: 800, performance: { now: () => 0 }
  } });
  const UI = vm.runInContext('MeridianUI', context), calls = [];
  class TestUI extends UI {
    bind() {} setControlHints() {} updateHUD() {} drawMinimap() {}
    center(x, z) { Object.assign(this.game.s.cam, { x, z }); }
    setMode(...args) { calls.push(['mode', ...args]); }
    perform(...args) { calls.push(['perform', ...args]); }
    setTab(...args) { calls.push(['tab', ...args]); }
    selectArmy() { calls.push(['army']); }
    selectWorker() { calls.push(['worker']); }
    save() { calls.push(['save']); }
    homeCamera() { calls.push(['base']); }
    centerSelection() { calls.push(['selection']); }
    openModal(kind, html) { this.html = html; }
  }
  const game = { s: { cam: { x: 0, z: 0, zoom: 50 }, time: 0, speed: 1, groups: {} } };
  const ui = new TestUI(game, {}, {}, { unlocked: 0, settings: { edge: false, quality: 2 } }, {});
  ui.view = 'game'; ui.paused = false;
  const key = (key, options = {}) => ui.keyDown({ key, preventDefault() {}, ...options });
  return { ui, calls, key, document, footer, UI };
}

test('WASD pans in all four directions; uppercase, repeats and release preserve continuous movement', () => {
  for (const [key, x, z] of [['w', 0, -4], ['a', -4, 0], ['s', 0, 4], ['d', 4, 0], ['W', 0, -4]]) {
    const h = setup(); h.key(key); h.key(key, { repeat: true }); h.ui.tick(.1);
    assert.deepEqual(h.ui.game.s.cam, { x, z, zoom: 50 }); assert.deepEqual(h.calls, []);
    h.ui.keys.delete(key.toLowerCase()); h.ui.tick(.1);
    assert.deepEqual(h.ui.game.s.cam, { x, z, zoom: 50 });
  }
});

test('arrow keys never pan or enter the held camera-key set', () => {
  const h = setup();
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) h.key(key);
  assert.equal(h.ui.keys.size, 0);
  h.ui.keys.add('arrowup'); h.ui.keys.add('arrowleft'); h.ui.tick(.1);
  assert.deepEqual(h.ui.game.s.cam, { x: 0, z: 0, zoom: 50 });
});

test('F selects attack-move and A only pans', () => {
  const h = setup();
  h.key('a'); h.ui.tick(.1); h.key('f'); h.key('f', { repeat: true });
  assert.deepEqual(h.calls, [['mode', 'attackMove']]);
  assert.equal(h.ui.game.s.cam.x, -4);
});

test('modified shortcuts do not accidentally pan; focus and pause suppress camera input', () => {
  const h = setup();
  h.key('a', { ctrlKey: true }); h.key('s', { ctrlKey: true });
  h.key('d', { altKey: true }); h.key('w', { metaKey: true }); h.ui.tick(.1);
  assert.deepEqual(h.calls, [['army'], ['save']]); assert.equal(h.ui.keys.size, 0);
  assert.deepEqual(h.ui.game.s.cam, { x: 0, z: 0, zoom: 50 });
  for (const tagName of ['INPUT', 'SELECT', 'TEXTAREA']) {
    h.document.activeElement.tagName = tagName; h.key('w'); h.key('f');
  }
  h.document.activeElement.tagName = 'BODY'; h.ui.paused = true; h.key('d'); h.ui.tick(.1);
  assert.equal(h.ui.keys.size, 0); assert.deepEqual(h.calls, [['army'], ['save']]);
});

test('remaining command hotkeys keep their existing assignments', () => {
  const h = setup();
  for (const key of ['m', 'h', 'x', 'q', 'b', 'n', 't', 'e', 'r', 'c', 'v', 'y', 'F2', 'F3', ' ', 'Home']) h.key(key);
  assert.deepEqual(h.calls, [['mode', 'move'], ['perform', 'hold'], ['perform', 'stop'],
    ['tab', 'orders'], ['tab', 'build'], ['tab', 'army'], ['tab', 'tech'],
    ['mode', 'ability', 'orbital'], ['mode', 'ability', 'repair'], ['mode', 'ability', 'scan'],
    ['mode', 'ability', 'drop'], ['mode', 'rally'], ['army'], ['worker'], ['base'], ['selection']]);
});

test('home redesign preserves dynamic campaign progress, checkpoint priority and navigation actions', () => {
  for (const saved of [false, true]) for (const progressed of [false, true]) {
    const h = setup(); let previews = 0;
    h.ui.game.s = null; h.ui.view = 'home';
    h.ui.profile.medals = progressed ? { 0: 3, 1: 1, 2: 0 } : {};
    h.ui.persistence.hasCheckpoint = () => saved;
    h.ui.onPreview = () => previews++;
    h.ui.showHome();
    const html = h.footer.innerHTML;
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

test('settings, manual and live control strip describe only WASD and F', () => {
  const h = setup(); h.ui.showSettings();
  assert.doesNotMatch(h.ui.html, /data-setting="wasd"|WASD camera/);
  h.ui.showHelp();
  assert.match(h.ui.html, /F → click ground/); assert.match(h.ui.html, /<kbd>WASD<\/kbd>/);
  assert.doesNotMatch(h.ui.html, /Arrow|arrows|WASD \/ arrows/);
  h.UI.prototype.setControlHints.call(h.ui);
  assert.match(h.footer.innerHTML, /<kbd>F<\/kbd> ATTACK-MOVE/);
  assert.match(h.footer.innerHTML, /<kbd>WASD<\/kbd> PAN/);
});
