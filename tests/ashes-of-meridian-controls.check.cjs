const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS, UI_SCRIPTS, loadScripts } = require('./helpers/game-scripts.cjs');
const RUNTIME_SOURCE = 'dist/src';
const UI_FILES = UI_SCRIPTS.map(name => `${RUNTIME_SOURCE}/ui/${name.replace('ui-', '')}.js`);
const STYLE_FILES = ['styles/base.css', 'styles/screens.css', 'styles/hud.css'];

function setup() {
  const target = () => ({
    handlers: {}, style: { setProperty(key, value) { this[key] = value; } }, classList: {
      names: new Set(), add(name) { this.names.add(name); }, remove(name) { this.names.delete(name); },
      contains(name) { return this.names.has(name); },
      toggle(name, on) { if (on) this.names.add(name); else this.names.delete(name); }
    },
    addEventListener(type, handler) { this.handlers[type] = handler; },
    setPointerCapture() {},
    setAttribute(key, value) { this[key] = value; },
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
      assert.ok(!['tooltip','contextLabel','selectionContent','selectCount','buildingActions','importFile','speedLabel','settingSpeed'].includes(id), 'removed DOM must never be accessed');
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
  const UI = vm.runInContext('MeridianUI', context), calls = [];
  class TestUI extends UI {
    bind() {} updateHUD() {} drawMinimap() {}
    setMode(...args) { calls.push(['mode', ...args]); }
    perform(...args) { calls.push(['perform', ...args]); }
    setTab(...args) { calls.push(['tab', ...args]); }
    homeCamera() { calls.push(['base']); }
    select(ids) { this.selected = [...ids]; calls.push(['select', [...ids]]); }
    pick() { return null; }
    openModal(kind, html) { this.html = html; }
  }
  const game = {
    world: { extent: 90, gridSize: 72, cellSize: 2.5 },
    s: { cam: { x: 0, z: 0, zoom: 50 }, time: 0, speed: 1, entities: [], faction: 0, meta: {}, teams: [{alloy:0,gas:0,energy:100,abilities:{}}] },
    effects: { floats: [] }, canBuild: () => '', cost: () => ({ cost: 0, gas: 0 }),
    alive(predicate) { return this.s.entities.filter(predicate); },
    availableProducers: vm.runInContext('MeridianGame.prototype.availableProducers', context),
    workerTask: vm.runInContext('MeridianGame.prototype.workerTask', context),
    availableWorkers: () => [{}],
    get(id) { return this.s.entities.find(e => e.id === id && e.hp !== 0); },
    managedBuilding(id) { const b = this.get(id); return !this.s.result && b?.kind === 'building' && b.team === 0 && b.hp > 0 && b.progress >= 1 ? b : null; },
    buildingRepairers: () => [], canRepairBuilding: () => '', canSellBuilding: () => '',
    command(...args) { calls.push(['command', ...args]); }
  };
  const ui = new TestUI(game, {
    viewport: { left: 0, top: 55, right: 1280, bottom: 590, width: 1280, height: 535 },
    containsPoint(x, y) { const v = this.viewport; return x > v.left && x < v.right && y > v.top && y < v.bottom; },
    ground: (x, y) => ({ x: x / 10, z: y / 10 }),
    project: (x, y, z) => ({ x, y: z })
  },
    { unlock() {}, sound() {} }, { expeditionDepth: 0, aether: 0, upgrades: {}, settings: { quality: 2 } },
    { saveProfile() {}, saveExpedition() {}, clearExpedition() {} });
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
  return { context, ui, calls, key, document, window, world, minimap, pointer, click, clickCamera, UI, setTime(value) { now = value; } };
}

test('battle lifecycle reserves the world viewport only while the battlefield is displayed', () => {
  const h = setup(), changes = [], viewport = h.document.getElementById('worldViewport');
  h.ui.onViewportChange = () => changes.push([h.ui.view, viewport.classList.contains('in-battle')]);
  h.ui.event('start'); assert.equal(viewport.classList.contains('in-battle'), true);
  h.ui.pause(); h.ui.showSettings(); h.ui.showArmory();
  assert.deepEqual(changes, [['game', true]], 'dialogs keep battlefield geometry');
  h.ui.showHome(); assert.equal(viewport.classList.contains('in-battle'), false);
  h.ui.showBattle(); assert.equal(viewport.classList.contains('in-battle'), false);
  assert.deepEqual(changes, [['game', true], ['home', false], ['battle', false]]);
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

test('minimap distinguishes massif footprints without bypassing visibility or changing terrain colors', () => {
  const h = setup(), ctx = new Proxy({}, { get: () => () => {} }),
    c = h.document.getElementById('minimap');
  c.width = c.height = 210; c.getContext = () => ctx;
  h.ui.game.world = { extent: 90, gridSize: 72, terrainColors: new Uint8Array(72*72*4).fill(100),
    terrainFeatureGrid: [1,0,1,0,1,0], visible: [1,1], explored: [0,0,1,1] };
  h.ui.miniBuffer = { width: 72 }; h.ui.miniCtx = { putImageData() {} };
  h.ui.miniImage = { data: new Uint8ClampedArray(72*72*4) };
  h.ui.R.ground = () => ({ x: 0, z: 0 });
  h.UI.prototype.drawMinimap.call(h.ui);
  for (const [i, value] of [48,100,23,48,8,16].entries())
    assert.deepEqual(Array.from(h.ui.miniImage.data.slice(i*4,i*4+4)), [value,value,value,255]);
  assert.ok(h.ui.game.world.terrainColors.every(v => v === 100));
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

test('mouse clicks replace selection even with Shift; select still deduplicates', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
  h.ui.pick = () => ({ id: 1, team: 0, kind: 'unit', type: 'rifle' });
  h.pointer('pointerdown', 200, 200, { pointerType: 'mouse', shiftKey: true });
  h.pointer('pointerup', 200, 200, { pointerType: 'mouse', shiftKey: true });
  assert.deepEqual(h.ui.selected, [1]);
  h.ui.game.s.entities = [{ id: 1 }, { id: 2 }];
  h.ui.audio.sound = () => {}; h.ui.renderActions = () => {};
  h.UI.prototype.select.call(h.ui, [1, 1, 99]);
  assert.deepEqual(Array.from(h.ui.selected), [1]);
});

test('Shift no longer queues commands or keeps successful targeting active', () => {
  for (const mini of [false, true]) for (const rightClick of [false, true]) {
    const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
    h.ui.mode = { kind: 'ability', arg: 'scan' };
    h.ui.game.ability = (...args) => { h.calls.push(['ability', ...args]); return true; };
    const options = { pointerType: 'mouse', button: rightClick ? 2 : 0, shiftKey: true,
      target: mini ? h.minimap : h.world };
    h.pointer('pointerdown', 100, 100, options); h.pointer('pointerup', 100, 100, options);
    assert.equal(h.calls.length, 1); assert.equal(h.calls[0][0], rightClick ? 'command' : 'ability');
    assert.equal(h.calls[0].length, 3, 'no queue/append argument reaches command or ability');
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

test('speed button cycles existing rates, updates its own label and preserves commands and transient state', () => {
  const h = setup(), g = h.ui.game;
  Object.assign(g.s.teams[0], { alloy: 100, gas: 0, energy: 100, abilities: {} });
  Object.assign(g, { supply: () => 0, cap: () => 24, objectiveRows: () => [] });
  h.ui.updateHUD = h.UI.prototype.updateHUD;
  h.UI.prototype.bind.call(h.ui);
  const button = h.document.getElementById('speedBtn'), profile = JSON.stringify(h.ui.profile);
  h.ui.persist = () => { throw Error('Speed must not be persisted'); };
  g.random = () => { throw Error('Speed must not consume RNG'); };
  const order = { type: 'move', x: 30, z: 40 }, mode = { kind: 'ability', arg: 'scan' };
  g.s.entities = [{ id: 7, kind: 'unit', team: 0, hp: 100, order }];
  h.ui.selected = [7]; h.ui.mode = mode; h.ui.attackMove = true;
  h.ui.updateHUD(); assert.equal(button.textContent, '1×');
  for (const speed of [1.5, 2, .75, 1, 1.5, 2, .75, 1]) {
    h.ui.lastClick = { id: 7, count: 1 };
    button.onclick();
    const label = String(speed).replace('.', ',') + '×';
    assert.equal(g.s.speed, speed); assert.equal(button.textContent, label);
    assert.equal(button['aria-label'], `Simulation speed: ${label}. Tap to change.`);
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
  g.s = { ...run, speed: 1 }; h.ui.event('start', {});
  assert.equal(button.textContent, '1×');
});

test('speed is a single button under the clock, not a settings control', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  h.document.handlers.change({ target: { id: 'settingSpeed', value: '2', dataset: {} } });
  assert.equal(h.ui.game.s.speed, 1);
  h.ui.showPause(); assert.doesNotMatch(h.ui.html, /GAME SPEED/);
  for (const run of [h.ui.game.s, null]) {
    h.ui.game.s = run; h.ui.showSettings();
    assert.doesNotMatch(h.ui.html, /settingSpeed|Simulation speed/);
    assert.match(h.ui.html, /data-setting="quality"/);
  }
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.doesNotMatch(html, /speedLabel|settingSpeed/);
  assert.match(html, /class="clock"><strong id="gameTime">00:00<\/strong><button id="speedBtn"[^>]*>1×<\/button><\/div>/);
  assert.equal((html.match(/id="speedBtn"/g) || []).length, 1);
  const deck = html.slice(html.indexOf('<footer id="commandDeck">'), html.indexOf('</footer>'));
  assert.match(deck, /class="minimap-panel"[\s\S]*id="commandCenter"[\s\S]*id="cameraTools"[\s\S]*id="abilityBar"[\s\S]*id="actionPanel"/);
  assert.match(html, /<button id="speedBtn"[^>]*>1×<\/button>/);
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
    assert.equal(button['aria-pressed'], 'false');
  }
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
  button.onclick(); assert.equal(h.ui.attackMove, true); assert.equal(button['aria-pressed'], 'true');
  h.ui.clearMode(); assert.equal(h.ui.attackMove, true);
  h.ui.paused = true; button.onclick(); assert.equal(h.ui.attackMove, true);
  h.ui.paused = false; h.ui.game.s.result = {}; button.onclick(); assert.equal(h.ui.attackMove, true);
  h.ui.game.s.result = null; h.ui.view = 'home'; button.onclick(); assert.equal(h.ui.attackMove, true);
  h.ui.event('start', {});
  assert.equal(h.ui.attackMove, false); assert.equal(button['aria-pressed'], 'false');
  assert.equal(JSON.stringify(h.ui.profile), profile);
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.match(html, /id="cameraTools"><button id="attackMoveBtn" aria-label="Attack-move" aria-pressed="false"/);
  assert.match(fs.readFileSync(path.join(__dirname, '../styles/hud.css'), 'utf8'), /#attackMoveBtn\[aria-pressed="true"\]/);
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

test('removed commands do nothing; abilities and categories remain, with pause guards', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.perform = h.UI.prototype.perform;
  for (const action of ['attackMove','move','hold','stop','ability:orbital','ability:repair','ability:scan','ability:drop','rally','army','worker','home'])
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

test('portrait deck has four root categories and a separate persistent ability bar, no old panels', () => {
  const h = setup(); h.ui.renderActions(); h.ui.updateQueues();
  assert.deepEqual(actionKeys(h), ['tab:build','tab:infantry','tab:vehicles','tab:aircraft']);
  assert.equal(h.document.getElementById('productionQueue').innerHTML, '');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /buildingActions|selectionPanel|selectionContent|data-tab/);
  assert.match(html, /id="minimap" aria-label="Minimap"/);
  for (const tab of ['root','build','infantry','vehicles','aircraft']) {
    h.UI.prototype.setTab.call(h.ui, tab);
    assert.deepEqual([...h.document.getElementById('abilityBar').innerHTML.matchAll(/data-action="([^"]+)"/g)].map(m => m[1]),
      ['ability:orbital','ability:repair','ability:scan','ability:drop']);
    assert.equal(actionKeys(h).includes('tab:root'), tab !== 'root');
  }
});

test('Cancel button exits every targeting mode without spending resources or changing orders', () => {
  for (const [kind, arg] of [['build','depot'], ['rally'],
    ...['orbital','repair','scan','drop'].map(a => ['ability',a])]) {
    const h = setup(); h.UI.prototype.bind.call(h.ui); h.ui.selected = [7];
    if (kind === 'build') h.ui.tab = 'build';
    if (kind === 'rally') {
      h.ui.game.s.entities = [{id:7,team:0,kind:'building',type:'barracks',hp:100,progress:1,queue:[]}];
      h.ui.tab = 'building';
    }
    const state = JSON.stringify(h.ui.game.s);
    h.UI.prototype.setMode.call(h.ui, kind, arg);
    assert.equal(h.document.getElementById('modeIndicator').classList.contains('hidden'), false);
    assert.match(h.document.getElementById('modeLabel').textContent, /TAP TO CONFIRM/);
    assert.match(h.document.getElementById(kind === 'ability' ? 'abilityBar' : 'actions').innerHTML, /class="action[^"\n]*\bactive\b/);
    h.click({ ui: 'cancelTarget' });
    assert.equal(h.ui.mode, null);
    assert.equal(h.document.getElementById('modeIndicator').classList.contains('hidden'), true);
    assert.equal(h.world.style.cursor, 'default');
    assert.doesNotMatch(h.document.getElementById(kind === 'ability' ? 'abilityBar' : 'actions').innerHTML, /class="action[^"\n]*\bactive\b/);
    assert.deepEqual(h.ui.selected, [7]); assert.equal(h.ui.paused, false);
    assert.equal(JSON.stringify(h.ui.game.s), state); assert.deepEqual(h.calls, []);
  }
});

test('pause, resume, help and modal close remain button actions; save/load/backup actions are gone', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  h.ui.pause = () => { h.ui.paused = true; h.calls.push(['pause']); };
  h.ui.resume = () => { h.ui.paused = false; h.calls.push(['resume']); };
  h.ui.showHelp = () => h.calls.push(['help']); h.ui.closeModal = () => h.calls.push(['close']);
  h.document.getElementById('pauseBtn').onclick(); h.document.getElementById('pauseBtn').onclick();
  h.document.getElementById('helpBtn').onclick();
  for (const ui of ['save','load','continue','export','import','closeModal']) h.click({ ui });
  assert.deepEqual(h.calls, [['pause'],['resume'],['help'],['close']]);
  for (const method of ['save','load','exportBackup','importBackup']) assert.equal(h.UI.prototype[method], undefined);
});

test('home offers a new expedition and exposes a secured expedition when present', () => {
  const h = setup(); h.ui.showHome();
  let html = h.document.getElementById('menu').innerHTML;
  assert.match(html, /New expedition/);
  assert.deepEqual(Array.from(html.matchAll(/data-ui="([^"]+)"/g), m => m[1]),
    ['battle', 'armory', 'help', 'settings']);
  h.ui.expedition = { depth: 4, benefits: { supplyCrate: 2, commanderMandate: 1 } };
  h.ui.showHome(); html = h.document.getElementById('menu').innerHTML;
  assert.match(html, /Continue expedition/);
  assert.match(html, /class="continue-row"/); assert.match(html, /aria-label="View expedition benefits"/);
  assert.match(html, /class="expedition-stage" aria-label="Checkpoint 5"/);
  assert.match(html, />CHECKPOINT<\/span>/); assert.doesNotMatch(html, /CURRENT STAGE|CHECKPOINT SECURED/);
  assert.match(html, /<strong>5<\/strong>/); assert.match(html, /4 SECTORS CLEARED/);
  assert.deepEqual(Array.from(html.matchAll(/data-ui="([^"]+)"/g), m => m[1]),
    ['continueExpedition', 'expeditionBenefits', 'battle', 'armory', 'help', 'settings']);
  h.ui.uiAction('expeditionBenefits');
  assert.match(h.ui.html, /Run benefits/); assert.match(h.ui.html, /Supply crate/);
  assert.match(h.ui.html, /Commander mandate/); assert.match(h.ui.html, /×2/);
  assert.equal(h.ui.game.s, null); assert.equal(h.ui.view, 'home'); assert.equal(h.ui.paused, true);
});

test('pause offers checkpoint-preserving home and explicit expedition abandonment', () => {
  const h=setup(); h.UI.prototype.bind.call(h.ui);
  const state=h.ui.game.s, before=JSON.stringify(state);
  h.ui.pause(); assert.equal(h.ui.paused,true);
  assert.match(h.ui.html,/discards this battle but keeps its secured pre-battle checkpoint/);
  assert.match(h.ui.html,/ABANDON EXPEDITION/);
  assert.deepEqual(Array.from(h.ui.html.matchAll(/data-ui="([^"]+)"/g),m=>m[1]),
    ['resume','settings','help','home','restartConfirm','abandon']);
  assert.equal((h.ui.html.match(/class="primary"|class="secondary"/g) || []).length, 6);
  assert.doesNotMatch(h.ui.html, /class="textbtn"/);
  h.ui.resume(); assert.equal(h.ui.paused,false);
  h.document.hidden=true; h.document.handlers.visibilitychange(); assert.equal(h.ui.paused,true);
  h.document.hidden=false; h.document.handlers.visibilitychange(); assert.equal(h.ui.paused,true);
  h.ui.resume(); assert.equal(h.ui.paused,false);
  state.time=90; h.ui.tick(.1); state.time=0;
  assert.strictEqual(h.ui.game.s,state); assert.equal(JSON.stringify(state),before); assert.deepEqual(h.calls,[]);
  h.ui.showSettings(); assert.doesNotMatch(h.ui.html,/data-ui="(?:export|import)"/);
  assert.match(h.ui.html,/saved only between battles/);
});

test('victory offers expedition benefits while defeat offers a fresh expedition', () => {
  for (const win of [false, true]) {
    const h = setup();
    Object.assign(h.ui.game.s, { stats: { kills: 0, lost: 1, gathered: 0 } });
    if (win) h.ui.expedition = { depth: 2, offers: ['supplyCrate'], benefits: {} };
    const result = { win, text: 'HQ destroyed', time: 20, integrity: 0, score: 0 };
    h.ui.showResult(result);
    assert.equal(h.ui.paused, true);
    if (win) assert.match(h.ui.html, /data-benefit="supplyCrate"/);
    else assert.match(h.ui.html, /data-ui="battle">NEW EXPEDITION/);
    assert.match(h.ui.html, /data-ui="armory"/); assert.match(h.ui.html, /data-ui="home"/);
  }
});

test('pause restart reopens the secured encounter with its expedition benefits', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  h.ui.expedition = { faction: 1, encounter: { enemy: 2, map: 'desert', seed: 1409 },
    benefits: { supplyCrate: 2 }, offers: [], depth: 3 };
  h.ui.game.start = opts => h.calls.push(['start', JSON.parse(JSON.stringify(opts))]);
  h.ui.pause(); h.click({ ui: 'restartConfirm' }); h.click({ ui: 'restart' });
  assert.deepEqual(h.calls, [['start', { faction: 1, enemy: 2, map: 'desert', seed: 1409,
    benefits: { supplyCrate: 2 }, depth: 3 }]]);
});

test('victory checkpoints offers and chosen benefits; defeat clears the expedition', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  const saved = [], cleared = [];
  h.ui.persistence.saveExpedition = value => saved.push(JSON.parse(JSON.stringify(value)));
  h.ui.persistence.clearExpedition = () => cleared.push(true);
  h.ui.persistence.saveProfile = () => {};
  h.ui.game.start = opts => h.calls.push(['start', JSON.parse(JSON.stringify(opts))]);
  h.ui.game.s.stats = { kills: 0, lost: 0, gathered: 0 };
  h.ui.expedition = { version: 1, faction: 0, depth: 0, benefits: {},
    encounter: { enemy: 1, map: 'desert', seed: 1409 }, offers: [] };
  h.ui.event('result', { win: true, text: 'Victory', time: 1, integrity: 1, score: 1 });
  assert.equal(h.ui.expedition.depth, 1); assert.equal(saved.length, 1);
  assert.equal(h.ui.expedition.offers.length, 3);
  const choice = h.ui.expedition.offers[0]; h.click({ benefit: choice });
  assert.equal(h.ui.expedition.benefits[choice], 1); assert.equal(h.ui.expedition.offers.length, 0);
  assert.equal(saved.length, 2); assert.equal(h.calls.length, 1);
  h.ui.resultAetherRecovered = undefined;
  h.ui.event('result', { win: false, text: 'Defeat', time: 1, integrity: 0, score: 0 });
  assert.equal(h.ui.expedition, null); assert.equal(cleared.length, 1);
});

test('result upgrades return to the same ended battle without replaying the result sound', () => {
  for (const win of [false, true]) {
    const h = setup(), sounds = []; h.UI.prototype.bind.call(h.ui);
    h.ui.openModal = (kind, html, wide) => {
      h.UI.prototype.openModal.call(h.ui, kind, html, wide); h.ui.html = html;
    };
    h.ui.audio.sound = name => sounds.push(name);
    Object.assign(h.ui.game.s, { seed: 1409, map: 'desert', enemy: 2,
      stats: { kills: 3, lost: 1, gathered: 42 },
      result: { win, text: 'HQ destroyed', time: 20, integrity: .5, score: 12 } });
    const state = h.ui.game.s, before = JSON.stringify(state);
    h.ui.event('result', state.result); const resultHTML = h.ui.html;
    assert.deepEqual(sounds, [win ? 'victory' : 'defeat']);
    h.click({ ui: 'armory' }); assert.equal(h.ui.modalKind, 'armory');
    let saved = 0; h.ui.persistence.saveProfile = () => { saved++; return true; };
    h.ui.profile.aether = 300; h.ui.buyUpgrade('startingWorkers');
    assert.equal(saved, 1); assert.equal(h.ui.profile.upgrades.startingWorkers, 1); assert.equal(h.ui.profile.aether, 0);
    assert.equal(h.ui.modalKind, 'armory');
    h.click({ ui: 'closeModal' });
    assert.equal(h.ui.modalKind, 'result'); assert.equal(h.ui.html, resultHTML);
    assert.equal(h.ui.paused, true); assert.strictEqual(h.ui.game.s, state);
    assert.equal(JSON.stringify(state), before);
    assert.deepEqual(sounds.filter(name => name === 'victory' || name === 'defeat'), [win ? 'victory' : 'defeat']);
    assert.equal(sounds.filter(name => name === 'research').length, 1);
    h.click({ ui: 'home' }); assert.equal(h.ui.game.s, null);
    assert.equal(h.ui.view, 'home'); assert.equal(h.ui.profile.upgrades.startingWorkers, 1);
  }
});

test('upgrades opened outside a result retain home and active-battle return routes', () => {
  for (const view of ['home', 'game']) {
    const h = setup(); h.ui.view = view;
    h.ui.openModal = (kind, html) => { h.ui.modalKind = kind; h.ui.html = html; };
    if (view === 'home') h.ui.game.s = null;
    h.ui.showArmory(); h.ui.closeModal();
    assert.equal(h.ui.view, view);
    assert.equal(h.ui.modalKind, view === 'home' ? '' : 'pause');
    assert.equal(h.ui.paused, true);
  }
});

test('runtime has no in-battle snapshot or backup hooks', () => {
  for (const file of [`${RUNTIME_SOURCE}/app.js`, ...UI_FILES,
    ...SIMULATION_SCRIPTS.map(name => `${RUNTIME_SOURCE}/simulation/${name.replace('simulation-', '')}.js`),
    `${RUNTIME_SOURCE}/persistence.js`, 'index.html']) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.doesNotMatch(source, /lastSaveTime|importFile|exportBackup|importBackup|serializeBackup|parseBackup|beforeunload|entities.*localStorage/i, file);
  }
});

test('permanent upgrades spend recovered aether, remain bounded and do not alter the active battle', () => {
  const h = setup(), keys = ['startingAlloy', 'startingWorkers'];
  h.ui.game.s.meta = {}; h.ui.game.s.teams[0].alloy = 123; h.ui.game.s.teams[0].gas = 45;
  h.ui.persistence.saveProfile = p => h.calls.push(['profile', JSON.parse(JSON.stringify(p))]);
  h.ui.profile.aether = 99; h.ui.showArmory();
  assert.match(h.ui.html, /class="armory-screen"/);
  assert.match(h.ui.html, /class="armory-balance"><strong>99<\/strong><span class="armory-aether-icon"><svg/);
  assert.match(h.ui.html, /STARTING RESERVES<\/span><strong>250 <small>ALLOY<\/small>/);
  assert.match(h.ui.html, /STARTING WORKERS<\/span><strong>0 <small>WORKERS<\/small>/);
  assert.match(h.ui.html, /EVACUATION LIMIT<\/span><strong>100 <small>AETHER \/ BATTLE<\/small>/);
  assert.equal((h.ui.html.match(/class="upgrade-heading"/g) || []).length, 6);
  assert.equal((h.ui.html.match(/class="upgrade-rank">LEVEL 0 \/ 5/g) || []).length, 6);
  assert.equal((h.ui.html.match(/aria-label="Level 0 of 5"/g) || []).length, 6);
  assert.deepEqual(Array.from(h.ui.html.matchAll(/data-upgrade="([^"]+)"/g), m => m[1]),
    ['startingAlloy', 'startingWorkers', 'aetherEvacuation', 'constructionProtocols', 'logisticsFrame', 'repairLogistics']);
  assert.match(h.ui.html, /Starting alloy/); assert.match(h.ui.html, /100 AETHER · LEVEL 1/);
  assert.match(h.ui.html, /Starting workers/); assert.match(h.ui.html, /300 AETHER · LEVEL 1/);
  assert.match(h.ui.html, /Aether evacuation/); assert.match(h.ui.html, /500 AETHER · LEVEL 1/);
  assert.match(h.ui.html, /data-upgrade="startingAlloy" disabled/);
  h.ui.buyUpgrade('startingAlloy'); assert.deepEqual(h.ui.profile.upgrades, {});
  h.ui.profile.aether = 100; h.ui.buyUpgrade('startingAlloy');
  assert.deepEqual(h.ui.profile.upgrades, { startingAlloy: 1 }); assert.equal(h.ui.profile.aether, 0);
  assert.match(h.ui.html, /STARTING RESERVES<\/span><strong>300 <small>ALLOY<\/small>/);
  h.ui.profile.aether = 500; h.ui.buyUpgrade('aetherEvacuation');
  assert.deepEqual(h.ui.profile.upgrades, { startingAlloy: 1, aetherEvacuation: 1 }); assert.equal(h.ui.profile.aether, 0);
  assert.match(h.ui.html, /EVACUATION LIMIT<\/span><strong>200 <small>AETHER \/ BATTLE<\/small>/);
  h.ui.profile.aether = 5100; h.ui.showArmory();
  assert.doesNotMatch(h.ui.html, /∞ UPGRADE RESOURCES|FREE · LEVEL|Command uplink|Command resolve|Frontier assembly/);
  for (const key of keys) for (let i=0;i<7;i++) h.ui.buyUpgrade(key);
  for (const key of ['not-an-upgrade', 'veterans', 'logistics', 'stores', 'command', 'resolve', 'industry']) h.ui.buyUpgrade(key);
  assert.deepEqual(h.ui.profile.upgrades, { startingAlloy: 5, aetherEvacuation: 1, startingWorkers: 5 });
  assert.equal(h.ui.profile.aether, 0); assert.equal(h.calls.length, 11); assert.equal('credits' in h.ui.profile, false);
  assert.deepEqual([h.ui.game.s.teams[0].alloy,h.ui.game.s.teams[0].gas,h.ui.game.s.meta], [123,45,{}]);
  assert.equal((h.ui.html.match(/FULLY REQUISITIONED/g)||[]).length, 2);
});

test('each result transfers floored unused aether once, using the run-start evacuation limit through 1,000', () => {
  for (const [level, gas, recovered] of [[0, 0, 0], [0, 42.9, 42], [0, 1000, 100],
    [1, 1000, 200], [2, 1000, 350], [3, 1000, 500], [4, 1000, 750], [5, 2000, 1000]]) {
    const h = setup(), saves = [];
    h.ui.persistence.saveProfile = p => saves.push(JSON.parse(JSON.stringify(p)));
    h.ui.showResult = () => {};
    h.ui.game.s.faction = 2; h.ui.game.s.teams[0].gas = gas; h.ui.game.s.meta = { aetherEvacuation: level };
    h.ui.event('result', { win: true });
    assert.equal(h.ui.resultAetherRecovered, recovered);
    assert.equal(h.ui.profile.aether, recovered);
    assert.equal(saves.length, recovered ? 1 : 0);
    h.ui.event('result', { win: true });
    assert.equal(h.ui.profile.aether, recovered, 'same result cannot pay twice');
    assert.equal(saves.length, recovered ? 1 : 0);
  }
});

test('new fleet upgrades display levels, charge their prices and never mutate an active battle',()=>{
  const h=setup(),rules=vm.runInContext('META',h.context),snapshot=JSON.stringify(h.ui.game.s);
  let saves=0;h.ui.persistence.saveProfile=()=>saves++;
  for(const key of ['constructionProtocols','logisticsFrame','repairLogistics']) {
    const rule=rules[key];
    for(let level=0;level<rule.max;level++) {
      h.ui.profile.aether=rule.costs[level]-1;h.ui.buyUpgrade(key);
      assert.equal(h.ui.profile.upgrades[key]||0,level);
      h.ui.profile.aether++;h.ui.buyUpgrade(key);
      assert.equal(h.ui.profile.upgrades[key],level+1);assert.equal(h.ui.profile.aether,0);
      assert.ok(h.ui.html.includes(`${rule.display.values[level+1]} <small>${rule.display.unit}</small>`));
    }
    h.ui.profile.aether=10000;h.ui.buyUpgrade(key);
    assert.equal(h.ui.profile.upgrades[key],5);assert.equal(h.ui.profile.aether,10000);
  }
  assert.equal(saves,15);assert.equal(JSON.stringify(h.ui.game.s),snapshot);
});

test('battle setup and help describe starting workers and alloy levels', () => {
  const h = setup();
  for (let level = 0; level <= 5; level++) {
    h.ui.profile.upgrades.startingWorkers = level;
    h.ui.profile.upgrades.startingAlloy = level;
    h.ui.showBattle();
    assert.match(h.document.getElementById('menu').innerHTML,
      new RegExp(`HQ \\+ ${level} WORKERS · ${250 + level * 50} ALLOY`));
  }
  h.ui.showHelp();
  assert.match(h.ui.html, /0–5 workers/); assert.match(h.ui.html, /250–500 alloy/);
  assert.match(h.ui.html, /benefits can add workers, alloy, aether and your commander/);
  assert.doesNotMatch(h.ui.html, /only your headquarters/);
});

test('content labels can change without changing faction IDs or depth requirements', () => {
  const h = setup();
  vm.runInContext(`FACTIONS.forEach((f, i) => { f.name = 'Faction <' + i + '> & revised'; });`, h.context);
  h.ui.showBattle();
  const html = h.document.getElementById('menu').innerHTML;
  assert.match(html, /Faction &lt;1&gt; &amp; revised/);
  assert.match(html, /Reach expedition depth 10/); assert.match(html, /Reach expedition depth 25/);
  h.ui.showHelp();
  for (const i of [1, 2]) assert.ok(h.ui.html.includes(`<b>Faction &lt;${i}&gt; &amp; revised</b>`));
});

test('best expedition depth unlocks factions at 10 and 25', () => {
  const h = setup(); h.UI.prototype.bind.call(h.ui);
  for (const [depth, unlocked] of [[0, 0], [9, 0], [10, 1], [24, 1], [25, 2]]) {
    h.ui.profile.expeditionDepth = depth;
    assert.deepEqual([0, 1, 2].map(faction => h.ui.factionUnlocked(faction)),
      [true, unlocked >= 1, unlocked >= 2]);
  }
  h.ui.profile.expeditionDepth = 9;
  h.ui.expedition = { version: 1, faction: 0, depth: 9, benefits: {},
    encounter: { enemy: 1, map: 'desert', seed: 1409 }, offers: [] };
  h.ui.game.s.stats = { kills: 0, lost: 0, gathered: 0 };
  h.ui.showResult = () => {};
  let saves = 0; h.ui.persistence.saveProfile = () => { saves++; };
  h.ui.event('result', { win: true });
  assert.equal(h.ui.profile.expeditionDepth, 10); assert.equal(h.ui.factionJustUnlocked, 1); assert.equal(saves, 1);
  h.ui.resultAetherRecovered = undefined; h.ui.expedition.depth = 24; h.ui.profile.expeditionDepth = 24;
  h.ui.event('result', { win: true });
  assert.equal(h.ui.profile.expeditionDepth, 25); assert.equal(h.ui.factionJustUnlocked, 2); assert.equal(saves, 2);
});

test('new expedition benefits are offered deterministically, displayed and bounded on selection',()=>{
  const h=setup(),rules=vm.runInContext('EXPEDITION_BENEFITS',h.context),seen=new Set();
  h.ui.expedition={faction:0,depth:8,benefits:{},offers:[],encounter:{enemy:1,map:'desert',seed:1409}};
  const run=h.ui.expedition;
  for(let seed=1;seed<=30;seed++) {
    run.encounter.seed=seed;
    const offers=Array.from(h.ui.createBenefitOffers(run));
    assert.equal(new Set(offers).size,3);assert.deepEqual(Array.from(h.ui.createBenefitOffers(run)),offers);
    offers.forEach(k=>seen.add(k));
  }
  for(const key of ['surveyDrones','fieldWorkshop','commandCapacitor']) {
    assert.ok(seen.has(key));run.offers=[key];h.ui.showExpeditionTransition();
    assert.ok(h.document.getElementById('menu').innerHTML.includes(rules[key].name));
    h.ui.game.start=()=>{};h.ui.chooseBenefit(key);assert.equal(run.benefits[key],1);
    run.benefits[key]=rules[key].max;run.offers=[key];h.ui.chooseBenefit(key);
    assert.equal(run.benefits[key],rules[key].max);
    assert.ok(!h.ui.createBenefitOffers(run).includes(key));
  }
});

test('checkpoint briefing derives faction doctrine and pressure without changing the encounter',()=>{
  const h=setup();
  h.ui.expedition={faction:0,depth:8,benefits:{},offers:['supplyCrate'],
    encounter:{enemy:1,map:'desert',seed:1409}};
  const saved=JSON.stringify(h.ui.expedition);
  h.ui.showExpeditionTransition();
  let html=h.document.getElementById('menu').innerHTML;
  assert.match(html,/VERDANT CHOIR/);assert.match(html,/Regenerating swarm/);assert.match(html,/PRESSURE 3\/5/);
  h.ui.showHome();assert.match(h.document.getElementById('menu').innerHTML,/Regenerating swarm/);
  assert.equal(JSON.stringify(h.ui.expedition),saved);
  vm.runInContext("FACTIONS[1].doctrine.name='<Swarm & revised>'",h.context);
  assert.match(h.ui.encounterBriefing(),/&lt;Swarm &amp; revised&gt;/);
});

test('expedition setup creates and saves a random pending encounter', () => {
  const h = setup(); h.ui.profile.expeditionDepth = 25; h.ui.battleFaction = 2;
  const saved = []; h.ui.persistence.saveExpedition = value => saved.push(JSON.parse(JSON.stringify(value)));
  h.ui.game.start = opts => h.calls.push(['start', JSON.parse(JSON.stringify(opts))]);
  h.ui.startBattle();
  assert.equal(saved.length, 1); assert.equal(saved[0].faction, 2); assert.equal(saved[0].depth, 0);
  assert.ok([0, 1, 2].includes(saved[0].encounter.enemy));
  assert.ok(['desert', 'alien-planet', 'mothership'].includes(saved[0].encounter.map));
  assert.ok(saved[0].encounter.seed > 0);
  assert.deepEqual(h.calls[0][1], { faction: 2, ...saved[0].encounter, benefits: {}, depth: 0 });
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
  for (const file of [...UI_FILES, 'index.html', ...STYLE_FILES]) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.doesNotMatch(source, /tooltip|tt-cost|\stitle=["']|\.title\s*=/i, file);
  }
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /<title>Ashes of Meridian/);
  for (const [attribute, value, label] of [
    ['id', 'battleHome', 'Pause / operations'], ['id', 'pauseBtn', 'Pause'],
    ['data-cam', 'home', 'Center on command'], ['data-cam', 'in', 'Zoom in'],
    ['data-cam', 'out', 'Zoom out'], ['id', 'soundBtn', 'Sound'],
    ['id', 'helpBtn', 'Field manual'], ['id', 'minimap', 'Minimap']
  ]) assert.match(html, new RegExp(`${attribute}="${value}"[^>]*aria-label="${label}"`));
});

function actionKeys(h) {
  return [...h.document.getElementById('actions').innerHTML.matchAll(/data-action="([^"]+)"/g)].map(m => m[1]);
}

function buildingPanel() {
  const h = setup(), b = { id: 7, kind: 'building', type: 'barracks', team: 0, faction: 0, hp: 100, maxHp: 200, progress: 1, x: 0, z: 0, queue: [] };
  h.ui.game.s.entities = [b]; h.ui.selected = [7]; h.ui.tab = 'building';
  h.ui.setTab = h.UI.prototype.setTab;
  h.ui.perform = h.UI.prototype.perform;
  return { ...h, b };
}

test('building selection opens fixed actions; Back preserves selection and explicit reselection reopens actions', () => {
  const h = buildingPanel(); h.UI.prototype.select.call(h.ui, [7]);
  assert.deepEqual(actionKeys(h), ['tab:root','sell','repair','rally']);
  h.ui.R.project = () => { throw Error('Building actions must not project into the world'); };
  h.ui.renderActions();
  h.ui.setTab('root'); h.ui.renderActions();
  assert.deepEqual(actionKeys(h), ['tab:build','tab:infantry','tab:vehicles','tab:aircraft']);
  assert.deepEqual(Array.from(h.ui.selected), [7]);
  h.UI.prototype.select.call(h.ui, [7]);
  assert.equal(h.ui.tab, 'building');
  assert.equal(h.UI.prototype.updateBuildingActions, undefined);
  assert.equal(h.UI.prototype.closeBuildingActions, undefined);
});

test('foundations have only Cancel build; completion and destruction update the context menu', () => {
  const h = buildingPanel(); h.b.progress = .5; h.ui.renderActions();
  assert.deepEqual(actionKeys(h), ['tab:root','cancelBuild']);
  h.b.progress = 1; h.ui.renderActions();
  assert.deepEqual(actionKeys(h), ['tab:root','sell','repair','rally']);
  h.b.hp = 0; h.ui.renderActions();
  assert.equal(h.ui.tab, 'root');
  assert.ok(!actionKeys(h).includes('sell'));
  for (const mode of ['enemy','unit','many','none']) {
    const h = buildingPanel();
    if (mode === 'enemy') h.b.team = 1;
    if (mode === 'unit') h.b.kind = 'unit';
    if (mode === 'many') h.ui.selected = [7,8];
    if (mode === 'none') h.ui.selected = [];
    h.ui.renderActions(); assert.equal(h.ui.tab, 'root', mode);
  }
});

test('repair restrictions and Stop repair remain visible in the fixed menu', () => {
  const h = buildingPanel();
  h.ui.game.canRepairBuilding = () => 'No workers'; h.ui.game.canSellBuilding = () => 'Last command center';
  h.ui.renderActions();
  const html = () => h.document.getElementById('actions').innerHTML;
  assert.match(html(), /data-action="repair" disabled/); assert.match(html(), /data-action="sell" disabled/);
  assert.match(html(), /No workers · Last command center/);
  h.ui.game.buildingRepairers = () => [{}]; h.ui.renderActions();
  assert.doesNotMatch(html(), /data-action="repair" disabled/); assert.match(html(), /Stop repair/);
});

test('build menu explains unavailable workers and refreshes when one becomes free', () => {
  const h = setup(); h.ui.tab = 'build';
  h.ui.game.availableWorkers = () => [];
  h.ui.renderActions();
  const html = () => h.document.getElementById('actions').innerHTML;
  assert.match(html(), /role="status">No free worker/);
  h.ui.game.availableWorkers = () => [{}];
  h.ui.renderActions();
  assert.doesNotMatch(html(), /No free worker/);
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
  for (const mini of [false,true]) {
    const h = buildingPanel(); h.UI.prototype.bind.call(h.ui);
    h.ui.select = h.UI.prototype.select; h.ui.setMode = h.UI.prototype.setMode;
    h.click({action:'rally'}); assert.equal(h.ui.mode.kind,'rally');
    const options = {target:mini ? h.minimap : h.world};
    h.pointer('pointerdown',100,100,options); h.pointer('pointerup',100,100,options);
    assert.ok(h.b.rally); assert.equal(h.ui.mode,null); assert.deepEqual(Array.from(h.ui.selected),[7]);
    const rally = JSON.stringify(h.b.rally);
    h.pointer('pointerdown',200,200); h.pointer('pointerup',200,200);
    assert.equal(JSON.stringify(h.b.rally),rally); assert.deepEqual(Array.from(h.ui.selected),[]);
    assert.deepEqual(h.calls,[]);
  }
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

test('global type icons aggregate parallel/waiting orders, keep DOM stable and show the next completion', () => {
  const h = setup(), q = (type, progress = 0) => ({type,progress,time:10,cost:75,gas:0});
  const a = {id:1,team:0,kind:'building',queue:[q('rifle',.25),q('rifle'),q('medic')]},
    b = {id:2,team:0,kind:'building',queue:[q('rifle',.6),q('medic')]};
  h.ui.game.s.entities = [a,b,{...a,id:3,team:1}]; h.ui.updateQueues();
  const buttons = () => h.document.getElementById('productionQueue').querySelectorAll('[data-queue-type]');
  const [rifle,medic] = buttons();
  assert.deepEqual(buttons().map(b => b.dataset.queueType), ['rifle','medic']);
  assert.equal(rifle.querySelector('.queue-count').textContent, 3);
  assert.equal(rifle.style['--progress'], '216deg');
  assert.equal(rifle.querySelector('.queue-time').textContent, '4s');
  assert.match(rifle['aria-label'], /Vanguard · 3 pending.*cancel one recruitment/);
  assert.equal(medic.querySelector('.queue-count').textContent, 2);
  assert.equal(medic.classList.contains('waiting'), true);
  b.queue[0].progress = .7; h.ui.updateQueues();
  assert.equal(buttons()[0], rifle); assert.ok(Math.abs(parseFloat(rifle.style['--progress']) - 252) < 1e-9);
  b.queue.shift(); h.ui.updateQueues();
  assert.equal(rifle.querySelector('.queue-count').textContent, 2);
  assert.equal(rifle.style['--progress'], '90deg');
  assert.equal(medic.classList.contains('waiting'), false);
  a.queue = []; b.queue = []; h.ui.updateQueues();
  assert.equal(buttons().length, 0);
});

test('starting workers do not affect queue duration, progress or waiting state', () => {
  const h = setup(), g = h.ui.game;
  g.s.entities = [{ id: 1, team: 0, kind: 'building', queue: [
    { type: 'rifle', progress: .2, time: 100 }, { type: 'medic', progress: 0, time: 10 }
  ] }];
  for (const level of [0, 1, 2, 3, 4, 5]) {
    const remaining = '80s';
    g.s.meta = { startingWorkers: level };
    const before = JSON.stringify(g.s);
    h.ui.updateQueues();
    const [rifle, medic] = h.document.getElementById('productionQueue').querySelectorAll('[data-queue-type]');
    assert.equal(rifle.querySelector('.queue-time').textContent, remaining);
    assert.equal(rifle.style['--progress'], '72deg');
    assert.match(rifle['aria-label'], new RegExp(remaining));
    assert.equal(medic.querySelector('.queue-time').textContent, '…');
    assert.equal(medic.classList.contains('waiting'), true);
    assert.equal(JSON.stringify(g.s), before);
  }
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
  assert.match(h.document.getElementById('modal').innerHTML, /147.5 alloy/);
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

test('command deck and help have no research actions; removed buildings are never offered for construction', () => {
  const h = setup(), html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /data-tab/);
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
  h.ui.tab = 'infantry'; h.ui.renderActions();
  assert.match(h.document.getElementById('actions').innerHTML, /train:rifle/);
  h.ui.game.s.entities = [{ id: 1, type: 'barracks', kind: 'building', team: 0, queue: [{ type: 'rifle', time: 11, progress: .5 }] }];
  h.ui.updateQueues(); assert.match(h.document.getElementById('productionQueue').innerHTML, /data-queue-type="rifle"/);
});

test('all factions share the minimal recruitment categories, including HQ units under infantry', () => {
  const h = setup();
  for (const faction of [0,1,2]) for (const [tab,types] of Object.entries({
    infantry:['worker','rifle','medic','hero'], vehicles:['tank','artillery'], aircraft:['air']
  })) {
    h.ui.game.s.faction = faction; h.UI.prototype.setTab.call(h.ui, tab);
    assert.deepEqual(actionKeys(h), ['tab:root',...types.map(t => 'train:' + t)]);
    assert.match(h.document.getElementById('actions').innerHTML, /class="cost"/);
  }
  h.ui.game.train = (...args) => h.calls.push(['train',...args]);
  h.ui.selected = [99]; h.UI.prototype.perform.call(h.ui, 'train:rifle');
  assert.deepEqual(h.calls, [['train','rifle']], 'selection is not a preferred producer');
});

test('only faction 0 recruitment/build buttons use local model portraits without changing actions or labels', () => {
  const h = setup();
  for (const [key, label, type, cost, file, gas = 0] of [
    ['train:worker', 'Prospector', 'worker', 50, 'assets/portraits/faction-0-unit-worker.webp'],
    ['train:rifle', 'Vanguard', 'rifle', 75, 'assets/portraits/faction-0-unit-rifle.webp'],
    ['train:medic', 'Field medic', 'medic', 100, 'assets/portraits/faction-0-unit-medic.webp', 35],
    ['train:tank', 'Ironclad', 'tank', 200, 'assets/portraits/faction-0-unit-tank.webp', 70],
    ['train:artillery', 'Longbow', 'artillery', 235, 'assets/portraits/faction-0-unit-artillery.webp', 95],
    ['train:air', 'Kestrel', 'air', 180, 'assets/portraits/faction-0-unit-air.webp', 100],
    ['train:hero', 'Commander', 'hero', 300, 'assets/portraits/faction-0-unit-hero.webp', 100],
    ['build:hq', 'Command center', 'hq', 400, 'assets/portraits/faction-0-building-hq.webp'],
    ['build:barracks', 'Muster station', 'barracks', 145, 'assets/portraits/faction-0-building-barracks.webp'],
    ['build:depot', 'Logistics depot', 'depot', 85, 'assets/portraits/faction-0-building-depot.webp'],
    ['build:refinery', 'Aether refinery', 'refinery', 100, 'assets/portraits/faction-0-building-refinery.webp'],
    ['build:factory', 'War foundry', 'factory', 225, 'assets/portraits/faction-0-building-factory.webp', 85],
    ['build:hangar', 'Flight deck', 'hangar', 220, 'assets/portraits/faction-0-building-hangar.webp', 115],
    ['build:turret', 'Sentinel turret', 'turret', 115, 'assets/portraits/faction-0-building-turret.webp', 25]
  ]) {
    const webp = fs.readFileSync(path.join(__dirname, '..', file));
    assert.equal(webp.toString('ascii', 0, 4), 'RIFF');
    assert.equal(webp.toString('ascii', 8, 16), 'WEBPVP8 ');
    assert.equal(webp.readUInt16LE(26) & 0x3fff, 320);
    assert.equal(webp.readUInt16LE(28) & 0x3fff, 320);
    for (const faction of [0,1,2]) {
      h.ui.game.s.faction = faction;
      const before = JSON.stringify(h.ui.game.s);
      const html = h.ui.actionButton(key, label, type, { cost: {cost, gas}, disabled: true, badge: '2' });
      assert.equal(JSON.stringify(h.ui.game.s), before);
      assert.ok(html.includes(`data-action="${key}" disabled`));
      assert.ok(html.includes(`<span>${label}</span><span class="cost">${cost}◆${gas ? ' ' + gas + '⬡' : ''}</span>`));
      assert.ok(html.includes(`<small data-badge="${key}">2</small>`));
      if (faction === 0) {
        assert.ok(html.includes(`src="${file}" alt="" draggable="false"`));
        assert.match(html, /class="model-space" aria-hidden="true"/);
        assert.doesNotMatch(html, /<svg/);
      } else {
        assert.match(html, /<svg/); assert.doesNotMatch(html, /<img|model-action/);
      }
    }
  }
  h.ui.game.s.faction = 0; h.ui.mode = { kind: 'build', arg: 'hq' };
  assert.match(h.ui.actionButton('build:hq', 'Command center', 'hq'), /class="[^"]*\bmodel-action\b[^"]*\bactive\b/);
  for (const [key, type] of [['tab:build','hq'], ['tab:infantry','rifle'], ['tab:vehicles','tank'], ['tab:aircraft','air'], ['ability:drop','drop'], ['repair','repair'], ['sell','cancel']])
    assert.doesNotMatch(h.ui.actionButton(key, type, type), /<img|model-action/);
});

test('HUD disables full queues, missing producers, queued commander and unavailable building actions', () => {
  const h = buildingPanel(), g = h.ui.game;
  Object.assign(g.s.teams[0],{alloy:1000,gas:1000,energy:100,abilities:{}});
  Object.assign(g,{supply:()=>10,cap:()=>50,afford:()=>true,objectiveRows:()=>[]});
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

test('HUD reads supply and capacity once per update and refreshes counts, warnings and recruitment', () => {
  const h = buildingPanel(), g = h.ui.game;
  Object.assign(g.s.teams[0], { alloy: 1000, gas: 1000, energy: 100, abilities: {} });
  Object.assign(g, { afford: () => true, objectiveRows: () => [] });
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
    const count = h.document.getElementById('supplyCount');
    assert.equal(count.textContent, supply + ' / ' + capacity);
    assert.equal(count.style.color, supply >= capacity ? 'var(--red)' : '');
    assert.deepEqual(buttons.map(button => button.disabled), blocked);
    assert.deepEqual([supplyReads, capacityReads], [1, 1]);
  }
});

test('HUD ability badges and disabled states retain energy and cooldown boundaries', () => {
  const h = setup(), g = h.ui.game;
  Object.assign(g.s.teams[0], { alloy: 0, gas: 0, abilities: {} }); Object.assign(g.s,{time:10});
  Object.assign(g, { supply: () => 0, cap: () => 24, objectiveRows: () => [] });
  for (const [kind, energy] of [['orbital', 85], ['repair', 45], ['scan', 25], ['drop', 95]]) {
    const button = h.document.getElementById('ability:' + kind);
    button.dataset = { action: 'ability:' + kind };
    h.document.querySelectorAll = () => [button];
    for (const available of [energy - 1, energy]) {
      g.s.teams[0].energy = available;
      h.UI.prototype.updateHUD.call(h.ui);
      assert.equal(button.disabled, available < energy);
      assert.equal(button.querySelector('small').textContent, energy + 'ϟ');
    }
    g.s.teams[0].abilities[kind] = 12.2;
    h.UI.prototype.updateHUD.call(h.ui);
    assert.equal(button.disabled, true);
    assert.equal(button.querySelector('small').textContent, '3s');
    g.s.teams[0].abilities[kind] = 10;
    h.UI.prototype.updateHUD.call(h.ui);
    assert.equal(button.disabled, false);
    assert.equal(button.querySelector('small').textContent, energy + 'ϟ');
  }
});

test('stylesheets load local base, screen and HUD rules in cascade order', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.deepEqual(
    [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(match => match[1]),
    STYLE_FILES.map(file => `./${file}`)
  );
});

test('settings and camera hints describe touch navigation without desktop camera controls', () => {
  const h = setup(); h.ui.showSettings();
  assert.doesNotMatch(h.ui.html, /data-setting="edge"|Edge scrolling/);
  h.ui.showHelp();
  assert.match(h.ui.html, /Move \/ attack/);
  assert.match(h.ui.html, /Select troops → tap ground \/ enemy/);
  assert.match(h.ui.html, /Crossed swords beside ⌂: gold = stop to fight/);
  assert.match(h.ui.html, /Turn Attack-move off to prioritize moving or retreating/);
  assert.match(h.ui.html, /Workers always move normally/);
  assert.doesNotMatch(h.ui.html, /Attack-move button|Move \/ hold \/ stop|Combat force button|Next worker button|Command view|Tabs on the command deck|Ability buttons in Command/);
  assert.doesNotMatch(h.ui.html, /<kbd>|F[12359]|\bEsc\b|to assist|keyboard/);
  assert.match(h.ui.html, /Drag one finger/); assert.match(h.ui.html, /pinch/i);
  assert.doesNotMatch(h.ui.html, /WASD|Middle-button|Mouse wheel|Space \/ Home|box-select|Shift|control group/i);
  assert.match(h.ui.html, /Double-tap: same type/);
  assert.equal(h.UI.prototype.setControlHints, undefined);
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /WASD|WHEEL|SPACE|\(Space\)|DRAG BOX|CTRL|LMB|<kbd>|F[12359]|\bEsc\b/);
  assert.match(html, /data-ui="cancelTarget"/);
  assert.doesNotMatch(html, /controlstrip/);
  const styles = STYLE_FILES.map(file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')).join('\n');
  assert.doesNotMatch(styles, /controlstrip/);
  h.ui.game.s.faction = 0;
  h.ui.renderActions();
  const actions = h.document.getElementById('actions').innerHTML;
  assert.doesNotMatch(actions, /Command view|SPACE|class="key"|F[12359]/);
  h.ui.showPause();
  assert.doesNotMatch(h.ui.html, /<kbd>|F[12359]/);
  assert.equal(h.ui.updateTips, undefined);
});
