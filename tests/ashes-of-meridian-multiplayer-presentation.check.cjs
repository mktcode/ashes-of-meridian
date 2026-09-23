const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts, BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS, MULTIPLAYER_SCRIPTS } = require('./helpers/game-scripts.cjs');
const context = loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'effects', ...SIMULATION_SCRIPTS, ...MULTIPLAYER_SCRIPTS]);
const { MultiplayerTimeline, projectMultiplayerEffect: project, enableMultiplayerPresentation: enable,
  takeMultiplayerEffects: take, MeridianGame, MeridianEffects, MeridianMultiplayerClient } = vm.runInContext(
  '({ MultiplayerTimeline, projectMultiplayerEffect, enableMultiplayerPresentation, takeMultiplayerEffects, MeridianGame, MeridianEffects, MeridianMultiplayerClient })', context);
const json = x => JSON.parse(JSON.stringify(x));
const entity = (id, team, x, extra = {}) => ({ id, team, x, z: 0, kind: 'unit', type: 'rifle', faction: 0,
  size: 1, rot: 0, walk: x, hp: 100, maxHp: 100, secret: 'never transmit', ...extra });
const frame = (time, entities, effects = []) => ({ time, entities, effects });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function fixture() {
  return { s: { time: 1, parties: [{ id: 0 }, { id: 1 }] },
    canSee: (team, p) => p.team === team || (team === 0 ? p.x < 2 : p.x >= 1),
    random: () => { throw Error('Simulation RNG touched'); }, cosmeticRandom: () => { throw Error('Effect RNG touched'); } };
}

test('network presentation interpolates position, shortest rotation and walk without altering authoritative snapshots', () => {
  const timeline = new MultiplayerTimeline();
  const frames = [frame(0, [entity(1, 0, 0)]), frame(.1, [entity(1, 0, 1, { rot: Math.PI - .1 })]),
    frame(.2, [entity(1, 0, 2, { rot: -Math.PI + .1 })])];
  const before = json(frames);
  for (const f of frames) { f.entities.forEach(Object.freeze); timeline.push(f, f.time * 1000); }
  const samples = [];
  timeline.advance(220, () => {}); const identity = timeline.poses.get(1);
  for (const now of [230, 240, 250, 260, 270, 280]) {
    timeline.advance(now, () => {}); samples.push(timeline.poses.get(1).x);
    assert.equal(timeline.poses.get(1), identity);
  }
  assert.equal(new Set(samples).size, 6);
  near(samples[0], 1.1); near(samples[5], 1.6);
  assert.ok(Math.abs(identity.rot) > 3); near(identity.walk, 1.6);
  assert.notEqual(identity, frames[2].entities[0]); assert.deepEqual(json(frames), before);
  timeline.advance(1000, () => {}); near(identity.x, 2); near(timeline.time, .2); // No extrapolation.
  timeline.push(frame(.3, [entity(1, 0, 3)]), 1000);
  timeline.advance(1000, () => {}); near(timeline.time, .2); // Late packets never reverse the view clock.
  timeline.advance(1050, () => {}); near(timeline.time, .23);
});

test('visibility removal, reappearance, teleports and reset do not leave trails through unseen positions', () => {
  const timeline = new MultiplayerTimeline();
  timeline.push(frame(0, [entity(1, 1, 0, { rally: { x: 4, z: 0 } })]), 0);
  timeline.advance(0, () => {}); const pose = timeline.poses.get(1);
  timeline.push(frame(.1, [entity(1, 1, 1)]), 100); timeline.advance(150, () => {});
  assert.equal(pose.rally, undefined);
  timeline.push(frame(.2, []), 200); timeline.advance(200, () => {});
  assert.equal(timeline.poses.size, 0);
  timeline.push(frame(.3, [entity(1, 1, 100)]), 300); timeline.advance(300, () => {});
  assert.equal(timeline.poses.get(1).x, 100);
  timeline.push(frame(.4, [entity(1, 1, -100)]), 400); timeline.advance(470, () => {});
  assert.equal(timeline.poses.get(1).x, -100);
  timeline.reset(); assert.equal(timeline.poses.size, 0); assert.equal(timeline.time, 0);
});

test('transient events follow the render clock once, with bounded history and no stale burst after a stall', () => {
  const timeline = new MultiplayerTimeline(), played = [];
  const event = { kind: 'sound', time: .1, point: { x: 0, z: 0 }, heavy: false };
  timeline.push(frame(0, []), 0);
  timeline.push(frame(.1, [], [event]), 100);
  timeline.push(frame(.1, [], [event]), 110); // Duplicate snapshot.
  timeline.push(frame(.2, []), 200);
  timeline.advance(210, e => played.push(e)); assert.equal(played.length, 0);
  timeline.advance(230, e => played.push(e)); assert.equal(played.length, 1);
  timeline.advance(250, e => played.push(e)); assert.equal(played.length, 1);
  timeline.push(frame(.15, [], [event]), 260); // Out-of-order packet.
  for (let i = 1; i <= 10; i++) timeline.push(frame(i, [], Array(256).fill(event)), i * 1000);
  assert.ok(timeline.effects.length <= 512); assert.ok(timeline.frames.length <= 5);
  timeline.advance(11000, e => played.push(e)); assert.equal(played.length, 1);
  timeline.reset(); timeline.advance(12000, e => played.push(e)); assert.equal(played.length, 1);
});

test('effects filter both endpoints at occurrence, without hidden sources, targets or unrelated entity fields', () => {
  const game = fixture(), source = entity(1, 0, 0), target = entity(2, 1, 1);
  const shot = { kind: 'shot', source, target };
  const visible = project(game, 0, shot);
  assert.equal(visible.kind, 'shot'); assert.equal(visible.source.id, undefined);
  assert.equal(visible.target.secret, undefined); assert.equal(visible.target.hp, undefined);
  assert.equal(project(game, 1, shot), null); // Hidden muzzle, visible victim: no source coordinate leak.
  target.x = 2;
  assert.deepEqual(json(project(game, 0, shot)), { kind: 'sound', time: 1, point: { x: 0, z: 0 }, heavy: false });
  const healing = { kind: 'healing', source: target, target: entity(3, 1, 2) };
  assert.equal(project(game, 0, healing), null); assert.equal(project(game, 1, healing).kind, 'healing');
  const explosion = { kind: 'explosion', point: target, size: 2, big: true };
  assert.equal(project(game, 0, explosion), null); assert.equal(project(game, 1, explosion).color, 0xa2e3db);
  assert.equal(project(game, 0, { kind: 'drop', point: target, team: 1, color: 123 }), null);
  target.x = 99; assert.equal(visible.target.x, 1); // Values copied synchronously, not retained entity references.
});

test('private notifications redact entities and cannot deliver results or hidden global-warning positions', () => {
  const game = fixture(), notice = { kind: 'notice', team: 1, event: ['trained', entity(7, 1, 2)] };
  assert.equal(project(game, 0, notice), null);
  assert.deepEqual(json(project(game, 1, notice).event), ['trained', { type: 'rifle' }]);
  assert.equal(project(game, 1, { ...notice, event: ['result', { win: true }] }), null);
  const warning = { kind: 'notice', team: null, event: ['alert', { text: 'Warning', danger: true, x: 2, z: 0 }] };
  assert.deepEqual(json(project(game, 0, warning).event), ['alert', { text: 'Warning', danger: true }]);
  assert.equal(project(game, 1, warning).event[1].x, 2);
});

test('event outboxes drain separately, cap bursts and throttle work without consuming either RNG', () => {
  const game = fixture(); enable(game);
  for (let i = 0; i < 300; i++) game.presentation({ kind: 'damage', target: entity(1, 0, 0), amount: i });
  assert.equal(take(game, 0).length, 256); assert.equal(take(game, 0).length, 0); assert.equal(take(game, 1).length, 0);
  const mining = { kind: 'mining', source: entity(2, 1, 2), target: entity(3, -1, 2, { kind: 'resource', type: 'crystal' }) };
  for (const time of [1, 1.05, 1.1, 1.15, 1.3]) { game.s.time = time; game.presentation(mining); }
  assert.equal(take(game, 1).length, 2); assert.equal(take(game, 0).length, 0);
});

test('client effects use cosmetic state, gate audio and cannot route forged lifecycle notifications to persistence', () => {
  context.document = { hidden: false };
  const calls = [], sounds = [], game = { networkTeam: 1, localTeam: 1, effects: new MeridianEffects(() => .5) };
  const ui = { game, paused: false, audio: { sound: name => sounds.push(name) }, event: (...args) => calls.push(args) };
  const client = new MeridianMultiplayerClient(ui), source = entity(1, 1, 1), target = entity(2, 0, 2);
  client.playEffect({ kind: 'shot', time: 0, source, target });
  assert.equal(game.effects.fx[0].color, 0xffd2a0); assert.equal(calls[0][0], 'shot');
  client.playEffect({ kind: 'shot', time: 0, source, target, travel: .85 });
  client.playEffect({ kind: 'explosion', time: 0, point: target, size: 1, color: 123, big: false });
  assert.ok(game.effects.fx.some(f => f.type === 'shell')); assert.ok(game.effects.fx.some(f => f.type === 'blast'));
  const count = calls.length;
  for (const type of ['start', 'result', 'victory', '__proto__']) client.playEffect({ kind: 'notice', time: 0, event: [type, { win: true }] });
  assert.equal(calls.length, count);
  client.playEffect({ kind: 'notice', time: 0, event: ['queued', 'worker'] });
  assert.equal(calls.at(-1)[0], 'queued');
  const audible = calls.length;
  ui.paused = true; client.playEffect({ kind: 'shot', time: 0, source, target });
  ui.paused = false; context.document.hidden = true; client.playEffect({ kind: 'shot', time: 0, source, target });
  assert.equal(calls.length, audible);
  client.timeline.push(frame(.1, [source], [{ kind: 'shot', time: .1, source, target }]), 100);
  client.updatePresentation(100);
  client.timeline.push(frame(.2, [source]), 200);
  context.document.hidden = false; client.updatePresentation(250);
  assert.equal(calls.length, audible); assert.equal(game.effects.fx.length, 0);
  client.disconnect(); assert.equal(game.networkTeam, null); assert.equal(game.effects.fx.length, 0);
});

test('client resume rotates credentials and resends only requests unknown to the server', async () => {
  context.document = { hidden: false, getElementById: () => null, addEventListener: () => {} };
  context.performance = { now: () => 1000 };
  context.WebSocket = { OPEN: 1 };
  const sent = [], events = [], game = { networkTeam: 0, effects: { reset: () => {} },
    s: { seed: 42, map: 'desert', parties: [{ faction: 0 }, { faction: 1 }] } };
  const ui = { game, toast: () => {}, event: (...args) => events.push(args) };
  const client = new MeridianMultiplayerClient(ui, async () => true);
  const socket = { readyState: 1, send: value => sent.push(JSON.parse(value)) };
  client.socket = socket; client.code = 'AABBCCDDEE'; client.started = true; client.request = 2;
  client.pending.set(1, { kind: 'train', unit: 'worker' });
  client.pending.set(2, { kind: 'order', ids: [1], order: { type: 'move', x: 1, z: 1 } });
  const start = { type: 'start', version: 4, code: client.code, team: 0, map: 'desert', seed: 42,
    factions: [0, 1], token: 'B'.repeat(32), graceMs: 45000 };
  await client.receive({ type: 'resumed', token: 'B'.repeat(32), graceMs: 45000,
    phase: 'playing', lastRequest: 1, start }, socket);
  assert.equal(sent[0].type, 'resume_ack');
  assert.deepEqual(sent.filter(message => message.type === 'action').map(message => message.request), [2]);
  assert.equal(client.resumeToken, 'B'.repeat(32)); assert.equal(client.connectionPhase, 'reconnecting');
  await client.receive({ type: 'outcome', request: 1, status: 'applied' }, socket);
  await client.receive({ type: 'outcome', request: 1, status: 'applied' }, socket);
  assert.equal(client.pending.has(1), false); assert.equal(events.length, 0);
});

test('socket input stays ordered across asynchronous resume preparation and coalesces queued frames', async t => {
  const original = { WebSocket: context.WebSocket, document: context.document, performance: context.performance };
  t.after(() => Object.assign(context, original));
  context.document = { hidden: false, getElementById: () => null, addEventListener: () => {} };
  context.performance = { now: () => 1000 };
  const sockets = [];
  context.WebSocket = class {
    static OPEN = 1;
    constructor() { this.readyState = 1; this.bufferedAmount = 0; sockets.push(this); }
    send() {}
    close() { this.readyState = 3; }
  };
  const client = new MeridianMultiplayerClient({ game: { networkTeam: null }, toast: () => {} }, async () => true);
  const seen = [];
  let finishResume;
  client.receive = async message => {
    seen.push(message);
    if (message.type === 'resumed') await new Promise(resolve => { finishResume = resolve; });
  };
  client.openSocket({ type: 'resume' }, true);
  const socket = sockets[0];
  socket.onmessage({ data: JSON.stringify({ type: 'resumed' }) });
  socket.onmessage({ data: JSON.stringify({ type: 'frame', tick: 1 }) });
  socket.onmessage({ data: JSON.stringify({ type: 'frame', tick: 2 }) });
  await Promise.resolve();
  assert.deepEqual(seen.map(message => message.type), ['resumed']);
  finishResume();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(seen.map(message => [message.type, message.tick]), [['resumed', undefined], ['frame', 2]]);
});

test('recent session credentials survive reload briefly and resume without re-entering the code', t => {
  const original = { localStorage: context.localStorage, WebSocket: context.WebSocket, document: context.document,
    URL: context.URL, performance: context.performance, setInterval: context.setInterval, clearInterval: context.clearInterval };
  t.after(() => Object.assign(context, original));
  const values = new Map();
  context.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key) };
  context.URL = URL; context.performance = performance;
  context.document = { getElementById: () => null, addEventListener: () => {}, hidden: false };
  context.setInterval = () => 1; context.clearInterval = () => {};
  const first = new MeridianMultiplayerClient({ game: { networkTeam: null }, toast: () => {} }, async () => true);
  first.serverUrl = 'wss://example.test/socket'; first.code = 'A1B2C3D4E5'; first.request = 17;
  first.acceptCredentials({ token: 'T'.repeat(32), graceMs: 45000 });
  first.rememberCode(); first.persistResume(true);
  const saved = JSON.parse(values.get('ashes.multiplayer.resume.v1'));
  assert.equal(saved.code, first.code); assert.equal(saved.request, 17);
  assert.equal(values.get('ashes.multiplayer.code'), first.code);

  const sockets = [];
  context.WebSocket = class {
    static OPEN = 1;
    constructor(url) { this.url = url; this.readyState = 1; this.bufferedAmount = 0; sockets.push(this); }
    send(raw) { this.sent = JSON.parse(raw); }
    close() { this.readyState = 3; }
  };
  const restored = new MeridianMultiplayerClient({ game: { networkTeam: null }, toast: () => {} }, async () => true);
  assert.ok(restored.storedResume());
  restored.resumeStored(); sockets[0].onopen();
  assert.equal(sockets[0].url, 'wss://example.test/socket');
  assert.deepEqual(sockets[0].sent, { type: 'resume', version: 4, code: first.code, token: 'T'.repeat(32) });
  assert.equal(restored.request, 17);
  restored.disconnect();
  assert.equal(values.has('ashes.multiplayer.resume.v1'), false);
  assert.equal(values.get('ashes.multiplayer.code'), first.code);
});

test('expired or malformed stored multiplayer credentials are discarded', t => {
  const original = { localStorage: context.localStorage, URL: context.URL };
  t.after(() => Object.assign(context, original));
  context.URL = URL;
  const values = new Map([['ashes.multiplayer.resume.v1', JSON.stringify({ version: 4, serverUrl: 'wss://example.test',
    code: 'A1B2C3D4E5', token: 'T'.repeat(32), graceMs: 45000, expiresAt: Date.now() - 1, request: 0 })]]);
  context.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key) };
  const client = new MeridianMultiplayerClient({ game: { networkTeam: null } }, async () => true);
  assert.equal(client.storedResume(), null);
  assert.equal(values.has('ashes.multiplayer.resume.v1'), false);
});

test('resume replay is paced and cancelled on disconnect', () => {
  const timers = new Map(); let id = 0;
  context.setTimeout = fn => { timers.set(++id, fn); return id; };
  context.clearTimeout = key => timers.delete(key);
  context.WebSocket = { OPEN: 1 };
  const client = new MeridianMultiplayerClient({ game: { networkTeam: null } }, async () => true);
  const sent = [], socket = { readyState: 1, send: raw => sent.push(JSON.parse(raw)), close: () => {} };
  client.socket = socket;
  for (let request = 1; request <= 64; request++) client.pending.set(request, { kind: 'train', unit: 'worker' });
  client.replay = [...client.pending.keys()]; client.replayNext(socket);
  assert.equal(sent.length, 1); assert.equal(timers.size, 1);
  for (let n = 1; n < 64; n++) {
    const [key, fn] = timers.entries().next().value; timers.delete(key); fn();
    assert.equal(sent.length, n + 1);
  }
  assert.equal(timers.size, 0);
  client.replay = [1, 2]; client.replayNext(socket);
  client.disconnect();
  assert.equal(timers.size, 0); assert.equal(client.replay.length, 0);
});

test('cancelled asynchronous resume preparation cannot change a newer client phase', async () => {
  context.document = { getElementById: () => null };
  let complete;
  const game = { networkTeam: null };
  const client = new MeridianMultiplayerClient({ game, toast: () => {} }, () => new Promise(resolve => { complete = resolve; }));
  const socket = { readyState: 1, send: () => {}, close: () => {} };
  client.socket = socket;
  const start = { type: 'start', version: 4, code: 'AABBCCDDEE', team: 0, map: 'desert', seed: 42,
    factions: [0, 1], token: 'B'.repeat(32), graceMs: 45000 };
  const receiving = client.receive({ type: 'resumed', token: start.token, graceMs: 45000,
    phase: 'loading', lastRequest: 0, start }, socket);
  client.disconnect(); client.connectionPhase = 'connecting'; client.connectionAttempt = 7;
  complete(true); await receiving;
  assert.equal(client.connectionPhase, 'connecting'); assert.equal(client.connectionAttempt, 7);
  assert.equal(game.networkTeam, null);
});

test('real combat presentation capture leaves simulation, original effects and both RNG streams unchanged', () => {
  const games = [false, true].map(capture => {
    const game = new MeridianGame({ upgrades: {} }, () => {});
    game.startScenario({ seed: 1409, map: 'mothership', duration: 60,
      parties: [{ faction: 0, controller: 'human' }, { faction: 1, controller: 'human' }], hostilities: [[false, true], [true, false]] });
    if (capture) enable(game);
    for (const sight of game.world.sight) sight.visible.fill(255);
    const source = game.spawnUnit('rifle', 0, 0, 0, 0), target = game.spawnUnit('rifle', 2, 0, 1, 1);
    target.hp = 1; game.fire(source, target);
    return game;
  });
  assert.deepEqual(json(games[0].s), json(games[1].s));
  assert.deepEqual(json(games[0].effects.fx), json(games[1].effects.fx));
  for (let i = 0; i < 5; i++) { assert.equal(games[0].random(), games[1].random()); assert.equal(games[0].cosmeticRandom(), games[1].cosmeticRandom()); }
  for (const team of [0, 1]) {
    const events = take(games[1], team);
    assert.ok(events.some(e => e.kind === 'shot')); assert.ok(events.some(e => e.kind === 'explosion'));
  }
});
