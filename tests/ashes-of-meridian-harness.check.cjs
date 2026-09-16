const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
const { fileURLToPath } = require('node:url');
const { BATTLEFIELD_SCRIPTS, RENDERER_SCRIPTS, SIMULATION_SCRIPTS, UI_SCRIPTS, readScripts, loadScripts } = require('./helpers/game-scripts.cjs');
const { createRendererStub } = require('./helpers/renderer-stub.cjs');

const sample = `
<script data-meridian-script="base">const value = 41;</script>
<script data-meridian-script="unused">throw Error('must not execute');</script>
<script data-meridian-script='dependent'>const result = value + 1;</script>`;

test('visible simulation launcher gives desktop openers a real wrapper file without query data', () => {
  const root = join(__dirname, '..'), output = execFileSync(process.execPath,
    ['scripts/open-visible-simulation.mjs', '--print'], { cwd: root, encoding: 'utf8' }).trim(),
    url = new URL(output), file = fileURLToPath(url), html = readFileSync(file, 'utf8'),
    pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(url.protocol, 'file:');
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
  assert.equal(file, join(root, 'visible-simulation.html'));
  assert.match(html, /index\.html/);
  assert.match(html, /simulation.*ai-vs-ai/);
  assert.match(html, /location\.replace\(game\)/);
  assert.equal(pkg.scripts['simulate:visible'], 'npm run build && node scripts/open-visible-simulation.mjs');
});

function sandbox(t) {
  const directory = mkdtempSync(join(tmpdir(), 'meridian-loader-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const rootDir = join(directory, 'source');
  mkdirSync(rootDir);
  return { directory, rootDir };
}

test('content loads alone with reference catalog order, classic bindings and naming/icon helpers', () => {
  const context = loadScripts(['content']);
  const { FACTIONS, UNITS, BUILDINGS, META, unitName, buildingName, icon } =
    vm.runInContext('({ FACTIONS, UNITS, BUILDINGS, META, unitName, buildingName, icon })', context);
  for (const name of ['M4', 'seeded', 'MeridianRenderer', 'document', 'window']) {
    assert.equal(vm.runInContext(`typeof ${name}`, context), 'undefined');
  }
  const ids = vm.runInContext('FACTION_ID', context);
  assert.deepEqual({ ...ids }, { FIRST: 0, SECOND: 1, THIRD: 2 });
  assert.equal(Object.isFrozen(ids), true);
  assert.deepEqual(Object.values(ids), Array.from(FACTIONS.keys()), 'IDs retain catalog/unlock order');
  assert.strictEqual(context.icon, icon);
  assert.deepEqual([FACTIONS.length, Object.keys(META).length], [3, 6]);
  assert.deepEqual(Array.from(Object.keys(META)), ['startingAlloy', 'startingWorkers', 'aetherEvacuation',
    'constructionProtocols', 'logisticsFrame', 'repairLogistics']);
  for (const upgrade of Object.values(META)) {
    assert.equal(upgrade.costs.length, upgrade.max);
    assert.equal(upgrade.display.values.length, upgrade.max + 1);
    assert.ok(upgrade.costs.every(cost => Number.isFinite(cost) && cost > 0));
  }
  assert.deepEqual(Array.from(META.startingAlloy.costs), [100, 200, 300, 450, 650]);
  assert.equal(META.startingWorkers.max, 5);
  assert.deepEqual(Array.from(META.aetherEvacuation.costs), [500, 800, 1200, 1800, 2600]);
  assert.deepEqual(Array.from(vm.runInContext('STARTING_ALLOY', context)), [250, 300, 350, 400, 450, 500]);
  assert.deepEqual(Array.from(vm.runInContext('AETHER_EVACUATION_CAPS', context)), [100, 200, 350, 500, 750, 1000]);
  assert.deepEqual(Object.keys(UNITS), ['worker', 'rifle', 'medic', 'tank', 'artillery', 'air', 'hero']);
  assert.deepEqual(Object.keys(BUILDINGS), ['hq', 'barracks', 'depot', 'refinery', 'factory', 'hangar', 'turret']);

  assert.equal(unitName('worker'), 'Prospector');
  assert.equal(unitName('worker', 1), 'Tender');
  assert.equal(unitName('worker', 2), 'Custodian');
  assert.equal(unitName('unknown-unit'), 'unknown-unit');
  assert.equal(buildingName('hq'), 'Command center');
  assert.equal(buildingName('hq', 1), 'Bloom queen');
  assert.equal(buildingName('hq', 2), 'Silent throne');
  assert.equal(buildingName('unknown-building'), 'unknown-building');
  assert.equal(icon('unknown-icon'), icon('hero'));
  assert.match(icon('worker'), /^<svg viewBox="0 0 24 24".*<path d="M8 15l-4 5/);
});

test('three CPU map recipes load without content, renderer or browser, with explicit names and IDs', () => {
  const scripts = readScripts(), context = loadScripts(BATTLEFIELD_SCRIPTS, { scripts });
  assert.deepEqual(scripts.filter(s => BATTLEFIELD_SCRIPTS.includes(s.name)).map(s => s.filename),
    BATTLEFIELD_SCRIPTS.map(name => `dist/src/battlefields/${name.replace('battlefield-', '')}.js`));
  const { BATTLEFIELDS, battlefieldId } = vm.runInContext('({BATTLEFIELDS, battlefieldId})', context);
  assert.deepEqual(Object.keys(BATTLEFIELDS), ['desert', 'alien-planet', 'mothership']);
  assert.deepEqual(Object.values(BATTLEFIELDS).map(b => b.name), ['DESERT', 'ALIEN PLANET', 'MOTHERSHIP']);
  for (const id of Object.keys(BATTLEFIELDS)) assert.equal(battlefieldId(id), id);
  for (const invalid of [undefined, null, 4, '', 'unknown', 'toString', '__proto__'])
    assert.equal(battlefieldId(invalid), 'desert');
  for (const name of ['geom', 'MAT', 'document', 'window', 'FACTIONS'])
    assert.equal(vm.runInContext(`typeof ${name}`, context), 'undefined');
  assert.notStrictEqual(BATTLEFIELDS.desert.layout.resourceSites, BATTLEFIELDS.mothership.layout.resourceSites);
  assert.notStrictEqual(BATTLEFIELDS.desert.render.rockDecor, BATTLEFIELDS.mothership.render.rockDecor);
});

test('renderer fragments expose the existing bindings and class API in document order', () => {
  const expectedFiles = RENDERER_SCRIPTS.map(name => name.startsWith('model-')
    ? `dist/src/renderer/models/${name.replace('model-', '')}.js`
    : `dist/src/renderer/${name.replace('renderer-', '')}.js`),
    scripts = readScripts(), context = loadScripts(RENDERER_SCRIPTS, { scripts });
  assert.deepEqual(
    scripts.filter(script => RENDERER_SCRIPTS.includes(script.name)).map(script => script.filename),
    expectedFiles
  );
  assert.equal(vm.runInContext('typeof MAT + ":" + typeof MERIDIAN_TEXTURES + ":" + typeof geom', context), 'object:object:object');
  assert.equal(vm.runInContext('typeof VERT + ":" + typeof FRAG + ":" + typeof MeridianRenderer', context), 'string:string:function');
  for (const method of ['resize', 'render', 'project', 'ground']) {
    assert.equal(vm.runInContext(`typeof MeridianRenderer.prototype.${method}`, context), 'function');
  }
  assert.equal(vm.runInContext('Object.keys(MeridianRenderer.prototype).length', context), 0);
});

test('simulation fragments assemble the existing non-enumerable MeridianGame API in document order', () => {
  const names = SIMULATION_SCRIPTS,
    expectedFiles = names.map(name => `dist/src/simulation/${name.replace('simulation-', '')}.js`),
    scripts = readScripts(), context = loadScripts(names, { scripts });
  assert.deepEqual(scripts.filter(script => names.includes(script.name)).map(script => script.filename), expectedFiles);
  assert.equal(vm.runInContext('Object.keys(MeridianGame.prototype).length', context), 0);
  for (const method of ['start', 'move', 'train', 'combat', 'step', 'availableWorkers', 'workerTask']) {
    assert.equal(vm.runInContext(`typeof MeridianGame.prototype.${method}`, context), 'function');
    assert.equal(vm.runInContext(`Object.getOwnPropertyDescriptor(MeridianGame.prototype, '${method}').enumerable`, context), false);
  }
  assert.equal(vm.runInContext("formatTime(65)", context), '01:05');
});

test('UI fragments assemble the existing non-enumerable MeridianUI API in document order', () => {
  const names = UI_SCRIPTS,
    expectedFiles = names.map(name => `dist/src/ui/${name.replace('ui-', '')}.js`),
    scripts = readScripts(), context = loadScripts(names, { scripts });
  assert.deepEqual(scripts.filter(script => names.includes(script.name)).map(script => script.filename), expectedFiles);
  assert.equal(vm.runInContext('Object.keys(MeridianUI.prototype).length', context), 0);
  for (const method of ['event', 'showHome', 'renderActions', 'pointerUp', 'drawOverlay']) {
    assert.equal(vm.runInContext(`typeof MeridianUI.prototype.${method}`, context), 'function');
    assert.equal(vm.runInContext(`Object.getOwnPropertyDescriptor(MeridianUI.prototype, '${method}').enumerable`, context), false);
  }
  assert.equal(vm.runInContext("esc('<battle>')", context), '&lt;battle&gt;');
});

function setupAudio() {
  const plays = [], tracks = [];
  const parameter = () => ({ value: 0, setTargetAtTime(value) { this.value = value; },
    setValueAtTime(value) { this.value = value; }, exponentialRampToValueAtTime(value) { this.value = value; } });
  const node = () => ({ gain: parameter(), connect() {}, disconnect() {} });
  class AudioContext {
    constructor() { this.currentTime = 1; this.sampleRate = 10; this.state = 'running'; }
    createGain() { return node(); }
    createDynamicsCompressor() { return { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect() {} }; }
    createBuffer() { return { getChannelData: () => new Float32Array(20) }; }
    createOscillator() { return { frequency: parameter(), connect() {}, disconnect() {}, start() {}, stop() {} }; }
    createBufferSource() { return { connect() {}, disconnect() {}, start() {}, stop() {} }; }
    createBiquadFilter() { return { frequency: {}, connect() {}, disconnect() {} }; }
    resume() { return Promise.resolve(); }
  }
  class Audio {
    constructor(src) { this.src = src; this.listeners = {}; tracks.push(this); }
    set src(value) { this.url = value; this.currentTime = 0; this.paused = true; this.ended = false; }
    get src() { return this.url; }
    set currentTime(value) { this.time = value; this.ended = false; }
    get currentTime() { return this.time; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    pause() { this.paused = true; }
    play() { this.paused = false; this.playCount = (this.playCount || 0) + 1; plays.push(this.src); return Promise.resolve(); }
    finish() { this.paused = true; this.ended = true; this.listeners.ended(); }
  }
  const settings = { volume: 0.28, music: true, sfx: true },
    context = loadScripts(['audio'], { globals: { window: { AudioContext }, Audio, settings } });
  const evaluate = code => vm.runInContext(code, context);
  evaluate('audio = new MeridianAudio(settings); audio.unlock()');
  return { evaluate, settings, plays, tracks, audio: evaluate('audio'),
    flush: () => new Promise(resolve => setImmediate(resolve)) };
}

test('battle playlist starts after ten seconds and plays the approved recordings with ten-second gaps', async () => {
  const h = setupAudio(), { audio, plays } = h, track = h.tracks[0];
  const recordings = [
    ['ratchet-theory'],
    ['last-light-relay'],
    ['breach-protocol'],
    ['black-channel'],
    ['sporewake', '06-sporewake.mp3'],
    ['rootmind', '07-rootmind.mp3']
  ];
  assert.equal(h.tracks.length, 6, 'one music element and five overlapping infantry-shot voices are prepared');
  assert.equal(track.loop, false);
  assert.equal(audio.master.gain.value, .28, 'master volume remains unchanged');
  assert.equal(audio.musicGain.gain.value, 1, 'menu music remains unchanged');
  assert.equal(audio.effectsGain.gain.value, 1, 'sound effects remain unchanged');
  audio.setMode('battle'); await h.flush();
  assert.equal(plays.length, 0, 'new battles start with silence');
  const initial = audio.ctx.currentTime;
  audio.ctx.currentTime = initial + 9.999; audio.update();
  assert.equal(plays.length, 0);
  audio.ctx.currentTime = initial + 10; audio.update(); await h.flush();
  assert.equal(plays.length, 1);
  assert.ok(Math.abs(track.volume - .028) < 1e-12, 'battle music plays at ten percent of the master volume');
  for (let i = 0; i < recordings.length; i++) {
    const [name, draft] = recordings[i];
    const file = `music-${name}.mp3`;
    assert.equal(track.src, `./audio/${file}`);
    const asset = readFileSync(join(__dirname, '..', 'audio', file));
    assert.ok(asset.length > 1000, 'approved recording is present');
    if (draft) assert.deepEqual(asset, readFileSync(join(__dirname, '..', 'music-drafts',
      draft)), 'approved draft is copied without re-encoding');
    track.paused = true; track.ended = true;
    audio.update();
    assert.equal(plays.length, i + 1, 'a frame before the ended event must not restart the old file');
    track.listeners.ended();
    const start = audio.ctx.currentTime;
    track.listeners.ended(); // A duplicate event must not restart the gap.
    audio.ctx.currentTime = start + 9.999; audio.update();
    assert.equal(plays.length, i + 1);
    assert.equal(track.paused, true);
    audio.ctx.currentTime = start + 10; audio.update(); await h.flush();
    assert.equal(plays.length, i + 2);
  }
  assert.equal(track.src, './audio/music-ratchet-theory.mp3', 'last track returns to first, also after a gap');
});

test('light shots use the approved recording with throttled overlapping voices', async () => {
  const h = setupAudio(), { audio, plays, settings } = h, shots = h.tracks.slice(1);
  assert.equal(shots.length, 5);
  assert.ok(shots.every(shot => shot.src === './audio/sfx-infantry-shot.wav'));
  assert.ok(shots.every(shot => Math.abs(shot.volume - .0616) < 1e-12));
  const asset = readFileSync(join(__dirname, '..', 'audio', 'sfx-infantry-shot.wav'));
  assert.equal(asset.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.ok(asset.length > 1000);

  audio.sound('shot', false); await h.flush();
  assert.deepEqual(plays, ['./audio/sfx-infantry-shot.wav']);
  audio.sound('shot', false); await h.flush();
  assert.equal(plays.length, 1, 'light shots retain the existing fire-rate throttle');
  audio.ctx.currentTime += .086;
  audio.sound('shot', false); await h.flush();
  assert.equal(plays.length, 2);
  assert.equal(shots[0].playCount, 1);
  assert.equal(shots[1].playCount, 1, 'successive shots may overlap');

  settings.volume = .4; audio.updateSettings();
  assert.ok(shots.every(shot => Math.abs(shot.volume - .088) < 1e-12));
  settings.sfx = false; audio.updateSettings();
  assert.ok(shots.every(shot => shot.volume === 0));
  audio.ctx.currentTime += 1; audio.sound('shot', false); await h.flush();
  assert.equal(plays.length, 2);
});

test('music pause/mute preserve track and gap position; menu and new battles reset the playlist', async () => {
  const h = setupAudio(), { audio, settings, plays } = h, track = h.tracks[0];
  audio.setMode('battle'); audio.ctx.currentTime += 10; audio.update(); await h.flush();
  track.currentTime = 12;
  audio.setMode('silent'); assert.equal(track.paused, true);
  audio.ctx.currentTime += 20;
  audio.setMode('battle'); await h.flush();
  assert.equal(track.currentTime, 12);
  track.finish(); audio.ctx.currentTime += 2;
  audio.setMode('silent'); assert.equal(audio.battleGapRemaining, 8);
  audio.ctx.currentTime += 100;
  audio.setMode('battle');
  audio.ctx.currentTime += 1; settings.music = false; audio.updateSettings();
  assert.equal(audio.battleGapRemaining, 7);
  const count = plays.length;
  audio.ctx.currentTime += 100; audio.update();
  assert.equal(plays.length, count);
  settings.music = true; settings.volume = .4; audio.updateSettings();
  audio.ctx.currentTime += 6.999; audio.update(); assert.equal(plays.length, count);
  audio.ctx.currentTime += .001; audio.update(); await h.flush();
  assert.equal(audio.battleTrackIndex, 1); assert.ok(Math.abs(track.volume - .04) < 1e-12);
  settings.music = false; audio.updateSettings(); assert.equal(track.paused, true);
  settings.music = true; audio.updateSettings(); await h.flush();
  track.finish(); audio.setMode('menu');
  assert.equal(audio.battleTrackIndex, 0); assert.equal(audio.battleGapRemaining, 10);
  assert.equal(track.currentTime, 0); assert.equal(track.paused, true);
  audio.ctx.currentTime += 100; audio.update(); assert.equal(track.paused, true);
  audio.setMode('battle'); audio.ctx.currentTime += 10; audio.update(); await h.flush(); track.finish();
  audio.resetBattleMusic(); audio.setMode('battle'); await h.flush();
  assert.equal(track.paused, true); assert.equal(audio.battleGapRemaining, 10);
  audio.ctx.currentTime += 10; audio.update(); await h.flush();
  assert.equal(track.paused, false); assert.equal(audio.battleGapRemaining, null);
  assert.equal(track.src, './audio/music-ratchet-theory.mp3');
});

test('initial music delay pauses with gameplay or music off and restarts for a new battle', async () => {
  const h = setupAudio(), { audio, settings, plays } = h;
  audio.setMode('battle'); audio.ctx.currentTime += 3;
  audio.setMode('silent'); assert.equal(audio.battleGapRemaining, 7);
  audio.ctx.currentTime += 100; audio.update();
  audio.setMode('battle'); audio.ctx.currentTime += 2;
  settings.music = false; audio.updateSettings();
  assert.equal(audio.battleGapRemaining, 5);
  audio.ctx.currentTime += 100; audio.update();
  settings.music = true; audio.updateSettings();
  audio.ctx.currentTime += 4.999; audio.update();
  assert.equal(plays.length, 0);
  audio.ctx.currentTime += .001; audio.update(); await h.flush();
  assert.deepEqual(plays, ['./audio/music-ratchet-theory.mp3']);
  audio.resetBattleMusic(); audio.setMode('battle');
  audio.ctx.currentTime += 4; audio.update();
  audio.resetBattleMusic(); audio.setMode('battle');
  audio.ctx.currentTime += 9.999; audio.update(); assert.equal(plays.length, 1);
  audio.ctx.currentTime += .001; audio.update(); await h.flush();
  assert.equal(plays.length, 2);
  assert.equal(audio.battleTrackIndex, 0);
});

test('rejected battle playback does not retry every frame and can retry on user unlock', async () => {
  const h = setupAudio(), { audio } = h, track = h.tracks[0];
  let attempts = 0;
  track.play = () => { attempts++; return Promise.reject(new Error('blocked')); };
  audio.setMode('battle'); audio.ctx.currentTime += 10; audio.update(); await h.flush();
  for (let i = 0; i < 10; i++) audio.update();
  assert.equal(attempts, 1);
  track.play = () => { attempts++; track.paused = false; return Promise.resolve(); };
  audio.unlock(); await h.flush(); assert.equal(attempts, 2);
});

test('loader selects explicit names in document order, skipping unrelated scripts', () => {
  const scripts = readScripts(sample);
  assert.deepEqual(scripts.map(s => s.name), ['base', 'unused', 'dependent']);
  const context = loadScripts(['dependent', 'base'], { scripts });
  assert.equal(vm.runInContext('result', context), 42);
});

test('loader rejects absent, duplicate, unnamed and non-classic script blocks', () => {
  assert.throws(() => readScripts(''), /No scripts/);
  assert.throws(() => readScripts('<script>const x = 1;</script>'), /missing a valid/);
  assert.throws(() => readScripts(sample + sample), /Duplicate script: base/);
  for (const attribute of ['type="module"', 'type="text/javascript"', 'async', 'defer', 'nomodule']) {
    assert.throws(() => readScripts(`<script data-meridian-script="base" ${attribute}></script>`), /synchronous classic/);
  }
  assert.throws(() => loadScripts(['missing'], { scripts: readScripts(sample) }), /Missing script: missing/);
});

test('VM contexts are isolated and browser globals are not silently mocked', () => {
  const scripts = readScripts('<script data-meridian-script="base">let value = input;</script>');
  const a = loadScripts(['base'], { scripts, globals: { input: 1 } });
  const b = loadScripts(['base'], { scripts, globals: { input: 2 } });
  vm.runInContext('value = 3', a);
  assert.equal(vm.runInContext('value', b), 2);
  assert.equal(vm.runInContext('typeof document', a), 'undefined');
  assert.equal(vm.runInContext('typeof window', a), 'undefined');
});

test('script failures identify the named source', () => {
  assert.throws(() => loadScripts(['unused'], { scripts: readScripts(sample) }), error => {
    assert.match(error.stack, /index\.html#unused/);
    return true;
  });
});

test('renderer stub records only when requested, copies fog and handles colors', () => {
  const renderer = createRendererStub({ record: true });
  renderer.add('box', 1, 2, 3);
  assert.deepEqual(renderer.calls, [['box', 1, 2, 3]]);
  renderer.clearStatic();
  assert.deepEqual(renderer.calls, []);
  const quiet = createRendererStub();
  quiet.add('box');
  assert.deepEqual(quiet.calls, []);
  const pixels = new Uint8Array([0, 80, 255]);
  renderer.fog(pixels);
  pixels[0] = 255;
  assert.deepEqual(Array.from(renderer.fogPixels), [0, 80, 255]);
  assert.deepEqual(renderer.color(0xff0080), [1, 0, 128 / 255]);
  assert.deepEqual(renderer.color('#ff0080'), renderer.color(0xff0080));
  const color = [.1, .2, .3];
  assert.strictEqual(renderer.color(color), color);
});

test('local files and inline scripts share lexical bindings in document order, relative to source root', t => {
  const { rootDir } = sandbox(t);
  mkdirSync(join(rootDir, 'lib'));
  writeFileSync(join(rootDir, 'lib/base.js'), 'const value = initial + 40;');
  writeFileSync(join(rootDir, 'index.html'), `<script data-meridian-script="initial">const initial = 1;</script>
<script data-meridian-script="base" src="./lib/base.js"></script>
<script data-meridian-script="unused">throw Error('must not execute');</script>
<script data-meridian-script="dependent">const result = value + 1;</script>`);
  const scripts = readScripts(undefined, { rootDir });
  assert.equal(scripts[1].filename, 'lib/base.js');
  const context = loadScripts(['dependent', 'base', 'initial'], { scripts });
  assert.equal(vm.runInContext('result', context), 42);
  assert.equal(context.value, undefined);
});

test('loader rejects URLs, traversal, ambiguous external content and base elements', () => {
  for (const path of ['https://example.invalid/code.js', '//example.invalid/code.js', 'file:///tmp/code.js', '/tmp/code.js', '../code.js', './lib/../code.js', '.\\code.js', './%63ode.js', './code.js?v=1', './code.js#hash', '']) {
    assert.throws(() => readScripts(`<script data-meridian-script="base" src="${path}"></script>`), /Invalid local script path/);
  }
  assert.throws(() => readScripts('<script data-meridian-script="base" src="./base.js">const ignored = 1;</script>'), /must not contain inline code/);
  assert.throws(() => readScripts('<base href="elsewhere/">' + sample), /Unsupported base element/);
});

test('loader rejects duplicate, unquoted, valueless and misleading attributes', () => {
  for (const attributes of ['data-meridian-script=base', 'data-meridian-script="base" src=base.js', 'data-meridian-script="base" data-meridian-script="other"', 'data-meridian-script="base" src="a.js" src="b.js"', 'data-meridian-script="base" src', 'data-meridian-script', 'data-other="data-meridian-script=base"']) {
    assert.throws(() => readScripts(`<script ${attributes}></script>`), /attribute|missing a valid|Invalid local script path/);
  }
});

test('loader reports missing local sources and rejects symlinks outside the source root', t => {
  const { directory, rootDir } = sandbox(t);
  const html = '<script data-meridian-script="base" src="./base.js"></script>';
  assert.throws(() => readScripts(html, { rootDir }), /Cannot read script base.*base\.js/);
  writeFileSync(join(directory, 'outside.js'), 'throw Error("must not execute");');
  symlinkSync(join(directory, 'outside.js'), join(rootDir, 'base.js'));
  assert.throws(() => readScripts(html, { rootDir }), /escapes source root/);
});

test('external script failures identify the local source file', t => {
  const { rootDir } = sandbox(t);
  writeFileSync(join(rootDir, 'base.js'), 'throw Error("external failure");');
  const scripts = readScripts('<script data-meridian-script="base" src="base.js"></script>', { rootDir });
  assert.throws(() => loadScripts(['base'], { scripts }), error => {
    assert.match(error.stack, /base\.js:1/);
    assert.match(error.message, /external failure/);
    return true;
  });
});
