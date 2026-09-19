import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createMultiplayerServer } from '../dist/server.js';

async function fixture(t) {
  const server = createMultiplayerServer();
  server.http.listen(0, '127.0.0.1'); await once(server.http, 'listening');
  t.after(() => server.close());
  const url = `ws://127.0.0.1:${server.http.address().port}`;
  async function connect() {
    const ws = new WebSocket(url, { origin: 'null' }), messages = [], waiters = new Set();
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
  return { connect, url };
}
for (const map of ['desert', 'alien-planet', 'mothership']) test(`two connection-bound actors on ${map}: map choice, filtered views, queued commands, disconnect`, async t => {
  const { connect } = await fixture(t), host = await connect(), guest = await connect();
  host.send({ type: 'create', version: 2, map, faction: 0 });
  const waiting = await host.receive(m => m.type === 'waiting');
  assert.match(waiting.code, /^[A-F0-9]{10}$/); assert.equal(waiting.map, map);
  guest.send({ type: 'join', version: 2, code: waiting.code, faction: 2, team: 0, map: 'invalid-ignored-map' });
  const a = await host.receive(m => m.type === 'start'), b = await guest.receive(m => m.type === 'start');
  assert.equal(a.map, map); assert.equal(b.map, map); assert.equal(a.seed, b.seed);
  assert.equal(a.team, 0); assert.equal(b.team, 1); assert.deepEqual(a.factions, [0, 2]);
  assert.equal(a.startSeed, undefined); assert.equal(b.startSeed, undefined);
  const intruder = await connect();
  intruder.send({ type: 'join', version: 2, code: waiting.code, faction: 0 });
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
  host.ws.close();
  assert.match((await guest.receive(m => m.type === 'end')).message, /disconnected/);
});

test('unknown map, missing room and protocol mismatch fail before a battle starts', async t => {
  const { connect } = await fixture(t);
  for (const message of [
    { type: 'create', version: 2, faction: 0, map: 'unknown' },
    { type: 'create', version: 999, faction: 0, map: 'desert' },
    { type: 'join', version: 2, faction: 0, code: '0000000000' }
  ]) { const client = await connect(); client.send(message); await client.receive(m => m.type === 'error'); }
});

test('waiting rooms are bounded and binary application messages are rejected', async t => {
  const { connect } = await fixture(t);
  const binary = await connect(); binary.ws.send(Buffer.from('{}'));
  await binary.receive(m => m.type === 'error');
  for (let i = 0; i < 8; i++) {
    const client = await connect(); client.send({ type: 'create', version: 2, map: 'mothership', faction: 0 });
    await client.receive(m => m.type === 'waiting');
  }
  const overflow = await connect(); overflow.send({ type: 'create', version: 2, map: 'mothership', faction: 0 });
  assert.match((await overflow.receive(m => m.type === 'error')).message, /full/);
});

test('unapproved origins cannot establish a connection', async t => {
  const { url } = await fixture(t);
  const ws = new WebSocket(url, { origin: 'https://unapproved.example' });
  const [error] = await once(ws, 'error');
  assert.match(error.message, /403/);
});
