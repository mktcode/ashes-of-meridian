import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createMultiplayerServer } from '../dist/server.js';

async function fixture(t, options) {
  const server = createMultiplayerServer(options);
  server.http.listen(0, '127.0.0.1'); await once(server.http, 'listening');
  t.after(() => server.close());
  const url = `ws://127.0.0.1:${server.http.address().port}`;
  async function connect(options = {}) {
    const ws = new WebSocket(url, { origin: 'null', ...options }), messages = [], waiters = new Set();
    ws.on('message', raw => { messages.push(JSON.parse(raw)); for (const wake of waiters) wake(); });
    await once(ws, 'open');
    t.after(() => ws.terminate());
    function receive(predicate) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { waiters.delete(check); reject(Error('Timed out waiting for server message')); }, 10000);
        function check() {
          const i = messages.findIndex(predicate);
          if (i < 0) return;
          clearTimeout(timer); waiters.delete(check); resolve(messages.splice(i, 1)[0]);
        }
        waiters.add(check); check();
      });
    }
    return { ws, receive, send: data => ws.send(JSON.stringify(data)) };
  }
  return { connect, url, server };
}
for (const map of ['desert', 'alien-planet', 'mothership', 'westmark']) test(`two resumable actors on ${map}: map choice, filtered views, queued commands and reconnect`, async t => {
  const { connect } = await fixture(t), host = await connect(), guest = await connect();
  host.send({ type: 'create', version: 5, map, faction: 0 });
  const waiting = await host.receive(m => m.type === 'waiting');
  assert.match(waiting.code, /^[A-F0-9]{10}$/); assert.equal(waiting.map, map);
  assert.match(waiting.token, /^[A-Za-z0-9_-]{32}$/); assert.equal(waiting.graceMs, 45000);
  guest.send({ type: 'join', version: 5, code: waiting.code, faction: 2, team: 0, map: 'invalid-ignored-map' });
  const a = await host.receive(m => m.type === 'start'), b = await guest.receive(m => m.type === 'start');
  assert.equal(a.map, map); assert.equal(b.map, map); assert.equal(a.seed, b.seed);
  assert.equal(a.team, 0); assert.equal(b.team, 1); assert.deepEqual(a.factions, [0, 2]);
  assert.equal(a.token, waiting.token); assert.match(b.token, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(a.startSeed, undefined); assert.equal(b.startSeed, undefined);
  const intruder = await connect();
  intruder.send({ type: 'join', version: 5, code: waiting.code, faction: 0 });
  await intruder.receive(m => m.type === 'error');
  host.send({ type: 'ready' }); guest.send({ type: 'ready' });
  const own = await host.receive(m => m.type === 'frame'), other = await guest.receive(m => m.type === 'frame');
  assert.equal(own.party.id, 0); assert.equal(other.party.id, 1);
  assert.equal(own.parties, undefined); assert.equal(own.stats, undefined);
  assert.deepEqual(own.effects, []); assert.deepEqual(other.effects, []);
  assert.deepEqual(own.strikes, []); assert.deepEqual(other.strikes, []);
  assert.ok(!own.entities.some(e => e.team === 1)); assert.ok(!other.entities.some(e => e.team === 0));
  const ownHQ = own.entities.find(e => e.type === 'hq'), otherHQ = other.entities.find(e => e.type === 'hq');
  host.send({ type: 'action', request: 1, team: 1, action: { kind: 'rally', ids: [otherHQ.id], position: { x: 0, z: 0 }, team: 1 } });
  await host.receive(m => m.type === 'accepted' && m.request === 1);
  assert.equal((await host.receive(m => m.type === 'outcome' && m.request === 1)).status, 'rejected');
  host.send({ type: 'action', request: 2, action: { kind: 'rally', ids: [ownHQ.id], position: { x: 0, z: 0 } } });
  assert.equal((await host.receive(m => m.type === 'outcome' && m.request === 2)).status, 'applied');
  const updated = await host.receive(m => m.type === 'frame' && m.entities.some(e => e.id === ownHQ.id && e.rally));
  assert.deepEqual(updated.entities.find(e => e.id === ownHQ.id).rally, { x: 0, z: 0 });
  guest.send({ type: 'action', request: 1, action: { kind: 'train', unit: 'worker' } });
  assert.equal((await guest.receive(m => m.type === 'outcome' && m.request === 1)).status, 'applied');
  const production = await guest.receive(m => m.type === 'frame' && m.entities.some(e => e.id === otherHQ.id && e.queue.length));
  assert.ok(production.entities.find(e => e.id === otherHQ.id).queue[0].progress > 0);
  assert.equal(production.entities.find(e => e.id === otherHQ.id).rally, undefined);
  assert.ok(production.effects.some(e => e.kind === 'notice' && e.event[0] === 'queued'));
  const hostView = await host.receive(m => m.type === 'frame' && m.tick >= production.tick);
  assert.ok(!hostView.effects.some(e => e.kind === 'notice' && e.event[0] === 'queued'));
  host.ws.terminate();
  assert.deepEqual(await guest.receive(m => m.type === 'presence' && m.team === 0),
    { type: 'presence', team: 0, connected: false, graceMs: 45000 });
  const resumedHost = await connect();
  resumedHost.send({ type: 'resume', version: 5, code: waiting.code, token: a.token });
  const resumed = await resumedHost.receive(m => m.type === 'resumed');
  assert.equal(resumed.phase, 'playing'); assert.equal(resumed.lastRequest, 2);
  assert.notEqual(resumed.token, a.token); assert.equal(resumed.start.team, 0);
  assert.equal((await resumedHost.receive(m => m.type === 'frame')).party.id, 0);
  assert.equal((await guest.receive(m => m.type === 'presence' && m.team === 0)).connected, true);
  resumedHost.send({ type: 'action', request: 3, action: { kind: 'rally', ids: [ownHQ.id], position: { x: 1, z: 1 } } });
  assert.equal((await resumedHost.receive(m => m.type === 'outcome' && m.request === 3)).status, 'applied');
  resumedHost.send({ type: 'leave' });
  assert.match((await guest.receive(m => m.type === 'end')).message, /left/);
});

test('accepted command outcomes survive transport loss and expired tokens cannot take over the seat', async t => {
  const { connect, server } = await fixture(t);
  const host = await connect(), guest = await connect();
  host.send({ type: 'create', version: 5, map: 'desert', faction: 0 });
  const waiting = await host.receive(m => m.type === 'waiting');
  guest.send({ type: 'join', version: 5, code: waiting.code, faction: 1 });
  const start = await host.receive(m => m.type === 'start'); await guest.receive(m => m.type === 'start');
  host.send({ type: 'ready' }); guest.send({ type: 'ready' });
  const frame = await host.receive(m => m.type === 'frame'), ownHQ = frame.entities.find(e => e.type === 'hq');
  await guest.receive(m => m.type === 'frame');
  host.send({ type: 'action', request: 1, action: { kind: 'rally', ids: [ownHQ.id], position: { x: 2, z: 2 } } });
  await host.receive(m => m.type === 'accepted' && m.request === 1);
  host.ws.terminate(); await guest.receive(m => m.type === 'presence' && m.connected === false);

  const replacement = await connect();
  replacement.send({ type: 'resume', version: 5, code: waiting.code, token: start.token });
  const resumed = await replacement.receive(m => m.type === 'resumed');
  assert.equal(resumed.lastRequest, 1); assert.notEqual(resumed.token, start.token);
  assert.equal((await replacement.receive(m => m.type === 'outcome' && m.request === 1)).status, 'applied');

  replacement.send({ type: 'resume_ack', token: resumed.token });
  // A following action proves the acknowledgment was processed before the stale-token attempt.
  replacement.send({ type: 'ready' });
  await replacement.receive(m => m.type === 'frame');
  const replay = await connect();
  replay.send({ type: 'resume', version: 5, code: waiting.code, token: start.token });
  assert.match((await replay.receive(m => m.type === 'error')).message, /unavailable/);
  replacement.send({ type: 'action', request: 2, action: { kind: 'rally', ids: [ownHQ.id], position: { x: 3, z: 3 } } });
  assert.equal((await replacement.receive(m => m.type === 'outcome' && m.request === 2)).status, 'applied');
  assert.equal(server.getMetrics().resumeSucceeded, 1); assert.equal(server.getMetrics().resumeRejected, 1);
});

test('state backpressure skips replaceable frames while control outcomes stay live', async t => {
  let congested = false;
  const { connect, server } = await fixture(t, { tickIntervalMs: 20, stateFrameEveryTicks: 1,
    stateBackpressureBytes: 10, controlBackpressureBytes: 100, bufferedAmount: () => congested ? 20 : 0 });
  const host = await connect(), guest = await connect();
  host.send({ type: 'create', version: 5, map: 'desert', faction: 0 });
  const waiting = await host.receive(m => m.type === 'waiting');
  guest.send({ type: 'join', version: 5, code: waiting.code, faction: 1 });
  await host.receive(m => m.type === 'start'); await guest.receive(m => m.type === 'start');
  host.send({ type: 'ready' }); guest.send({ type: 'ready' });
  const frame = await host.receive(m => m.type === 'frame'), ownHQ = frame.entities.find(e => e.type === 'hq');
  await guest.receive(m => m.type === 'frame');
  assert.match(host.ws.extensions, /permessage-deflate/);
  congested = true; await new Promise(resolve => setTimeout(resolve, 420));
  assert.ok(server.getMetrics().stateFramesSkipped >= 2);
  host.send({ type: 'action', request: 1, action: { kind: 'rally', ids: [ownHQ.id], position: { x: 2, z: 2 } } });
  assert.equal((await host.receive(m => m.type === 'outcome' && m.request === 1)).status, 'applied');
  const metrics = server.getMetrics();
  assert.equal(metrics.backpressureDisconnects, 0); assert.ok(metrics.statePayloadBytes > 0);
  assert.ok(metrics.controlPayloadBytes > 0); assert.ok(metrics.stateFrameBytesMax > 0);
  assert.ok(metrics.tickDurationSamples >= 20); assert.ok(metrics.tickDurationP95Ms > 0);
  assert.ok(metrics.tickDurationP99Ms >= metrics.tickDurationP95Ms);
});

test('WebSocket compression can be disabled for baseline measurements', async t => {
  const { connect } = await fixture(t, { compression: false });
  const client = await connect();
  assert.equal(client.ws.extensions, '');
});

test('delayed and missing heartbeat replies reduce state rate without dropping the session', async t => {
  const events = [];
  const { connect, server } = await fixture(t, { tickIntervalMs: 20, stateFrameEveryTicks: 1,
    heartbeatIntervalMs: 25, heartbeatTimeoutMs: 2000, stateRttMediumMs: 2, stateRttHighMs: 8,
    metricsIntervalMs: 50, telemetry: event => events.push(event) });
  const host = await connect({ autoPong: false }), guest = await connect();
  let pings = 0;
  host.ws.on('ping', payload => {
    const current = ++pings;
    if (current % 4 === 0) return;
    setTimeout(() => { if (host.ws.readyState === WebSocket.OPEN) host.ws.pong(payload); }, current % 2 ? 12 : 35);
  });
  host.send({ type: 'create', version: 5, map: 'desert', faction: 0 });
  const waiting = await host.receive(m => m.type === 'waiting');
  guest.send({ type: 'join', version: 5, code: waiting.code, faction: 1 });
  await host.receive(m => m.type === 'start'); await guest.receive(m => m.type === 'start');
  host.send({ type: 'ready' }); guest.send({ type: 'ready' });
  await host.receive(m => m.type === 'frame'); await guest.receive(m => m.type === 'frame');
  await new Promise(resolve => setTimeout(resolve, 180));
  const metrics = server.getMetrics();
  assert.equal(host.ws.readyState, WebSocket.OPEN); assert.ok(metrics.heartbeatRttSamples >= 3);
  assert.ok(metrics.heartbeatJitterMaxMs > 0); assert.ok(metrics.stateFramesThrottled > 0);
  assert.ok(events.some(event => event.event === 'state_rate_changed' && event.stateRateHz < 50));
});

test('the room ends only after the disconnected seat exhausts its resume grace', async t => {
  const events = [];
  const { connect } = await fixture(t, { resumeGraceMs: 80, tickIntervalMs: 10,
    telemetry: event => events.push(event) });
  const host = await connect(), guest = await connect();
  host.send({ type: 'create', version: 5, map: 'mothership', faction: 0 });
  const waiting = await host.receive(m => m.type === 'waiting');
  guest.send({ type: 'join', version: 5, code: waiting.code, faction: 2 });
  await host.receive(m => m.type === 'start'); await guest.receive(m => m.type === 'start');
  host.send({ type: 'ready' }); guest.send({ type: 'ready' });
  await host.receive(m => m.type === 'frame'); await guest.receive(m => m.type === 'frame');
  host.ws.terminate();
  assert.equal((await guest.receive(m => m.type === 'presence')).connected, false);
  assert.match((await guest.receive(m => m.type === 'end')).message, /reconnect/);
  assert.ok(events.some(event => event.event === 'room_end' && event.cause === 'resume_expired'));
});

test('connection telemetry reports lifecycle, traffic and heartbeat measurements without room credentials', async t => {
  const events = [];
  const { connect, server } = await fixture(t, { telemetry: event => events.push(event), heartbeatIntervalMs: 20,
    unassignedTimeoutMs: 1000, metricsIntervalMs: 20 });
  const client = await connect();
  client.send({ type: 'create', version: 5, map: 'desert', faction: 0 });
  const waiting = await client.receive(m => m.type === 'waiting');
  await new Promise(resolve => setTimeout(resolve, 60));
  const socketClosed = once(client.ws, 'close');
  client.ws.close(4001, waiting.token + waiting.code);
  await socketClosed;
  await new Promise(resolve => setImmediate(resolve));

  const opened = events.find(event => event.event === 'connection_open');
  const closed = events.find(event => event.event === 'connection_close');
  assert.equal(typeof opened.connectionId, 'number');
  assert.equal(closed.connectionId, opened.connectionId);
  assert.equal(closed.code, 4001); assert.equal(closed.reason, undefined); assert.equal(closed.cause, 'peer_close');
  assert.ok(closed.bytesSent > 0); assert.ok(closed.durationMs >= 0);
  assert.ok(events.some(event => event.event === 'room_created'));
  assert.ok(events.some(event => event.event === 'metrics'));
  assert.ok(!JSON.stringify(events).includes(waiting.code));
  assert.ok(!JSON.stringify(events).includes(waiting.token));
  const metrics = server.getMetrics();
  assert.equal(metrics.connectionsOpened, 1); assert.equal(metrics.connectionsClosed, 1);
  assert.ok(metrics.bytesSent > 0); assert.ok(metrics.controlMessagesSent > 0);
  assert.ok(metrics.controlPayloadBytes > 0); assert.equal(metrics.bytesSent, metrics.controlPayloadBytes + metrics.statePayloadBytes);
  assert.ok(metrics.heartbeatRttSamples > 0); assert.ok(metrics.heartbeatRttMaxMs >= 0);
  assert.ok(metrics.processCpuPercent >= 0); assert.ok(metrics.processRssBytes > 0);
});

test('unknown map, missing room and protocol mismatch fail before a battle starts', async t => {
  const { connect } = await fixture(t);
  for (const message of [
    { type: 'create', version: 5, faction: 0, map: 'unknown' },
    { type: 'create', version: 999, faction: 0, map: 'desert' },
    { type: 'join', version: 5, faction: 0, code: '0000000000' }
  ]) { const client = await connect(); client.send(message); await client.receive(m => m.type === 'error'); }
});

test('the absolute two-room limit cannot be raised and binary application messages are rejected', async t => {
  const { connect } = await fixture(t, { maxRooms: 99 });
  const binary = await connect(); binary.ws.send(Buffer.from('{}'));
  await binary.receive(m => m.type === 'error');
  for (let i = 0; i < 2; i++) {
    const client = await connect(); client.send({ type: 'create', version: 5, map: 'mothership', faction: 0 });
    await client.receive(m => m.type === 'waiting');
  }
  const overflow = await connect(); overflow.send({ type: 'create', version: 5, map: 'mothership', faction: 0 });
  assert.match((await overflow.receive(m => m.type === 'error')).message, /full/);
});

test('unapproved origins cannot establish a connection', async t => {
  const { url } = await fixture(t);
  const ws = new WebSocket(url, { origin: 'https://unapproved.example' });
  const [error] = await once(ws, 'error');
  assert.match(error.message, /403/);
});


test('lost resume proposal is repeatable until acknowledged, without extending rotation expiry', async t => {
  let now = 1000;
  const { connect } = await fixture(t, { now: () => now, resumeGraceMs: 1000 });
  const host = await connect();
  host.send({ type: 'create', version: 5, map: 'mothership', faction: 0 });
  const waiting = await host.receive(m => m.type === 'waiting');
  const first = await connect();
  first.send({ type: 'resume', version: 5, code: waiting.code, token: waiting.token });
  const proposal = await first.receive(m => m.type === 'resumed');
  // Model the client never learning this proposal: retry with its original credential.
  const retry = await connect();
  retry.send({ type: 'resume', version: 5, code: waiting.code, token: waiting.token });
  assert.equal((await retry.receive(m => m.type === 'resumed')).token, proposal.token);
  now += 1001;
  const expired = await connect();
  expired.send({ type: 'resume', version: 5, code: waiting.code, token: waiting.token });
  await expired.receive(m => m.type === 'error');
  const current = await connect();
  current.send({ type: 'resume', version: 5, code: waiting.code, token: proposal.token });
  const rotated = await current.receive(m => m.type === 'resumed');
  current.send({ type: 'resume_ack', token: rotated.token });
  current.send({ type: 'leave' });
  await current.receive(m => m.type === 'end');
});

test('ready replay after loading resume is harmless when the other player starts the match', async t => {
  const { connect } = await fixture(t);
  const host = await connect(), guest = await connect();
  host.send({ type: 'create', version: 5, map: 'mothership', faction: 0 });
  const waiting = await host.receive(m => m.type === 'waiting');
  guest.send({ type: 'join', version: 5, code: waiting.code, faction: 1 });
  const start = await host.receive(m => m.type === 'start');
  await guest.receive(m => m.type === 'start');
  host.send({ type: 'ready' });
  const replacement = await connect();
  replacement.send({ type: 'resume', version: 5, code: waiting.code, token: start.token });
  assert.equal((await replacement.receive(m => m.type === 'resumed')).phase, 'loading');
  guest.send({ type: 'ready' });
  await replacement.receive(m => m.type === 'frame');
  replacement.send({ type: 'ready' });
  replacement.send({ type: 'action', request: 1, action: { kind: 'train', unit: 'worker' } });
  assert.equal((await replacement.receive(m => m.type === 'outcome')).status, 'applied');
});
