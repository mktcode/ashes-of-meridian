import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import { deflateRawSync } from 'node:zlib';
import { WebSocket } from 'ws';
import { createMultiplayerServer } from '../dist/server.js';

const frames = Number(process.env.SAMPLE_FRAMES || 30);
if (!Number.isSafeInteger(frames) || frames < 10 || frames > 300) throw Error('SAMPLE_FRAMES must be an integer from 10 to 300');

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? 0;
}
async function connect(url) {
  const ws = new WebSocket(url, { origin: 'null', perMessageDeflate: false });
  const messages = [], waiters = new Set();
  ws.on('message', raw => { messages.push(raw.toString()); for (const wake of waiters) wake(); });
  await once(ws, 'open');
  return {
    ws,
    send(value) { ws.send(JSON.stringify(value)); },
    receive(predicate) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { waiters.delete(check); reject(Error('Timed out waiting for frame')); }, 10000);
        function check() {
          const index = messages.findIndex(raw => predicate(JSON.parse(raw)));
          if (index < 0) return;
          clearTimeout(timer); waiters.delete(check); resolve(messages.splice(index, 1)[0]);
        }
        waiters.add(check); check();
      });
    }
  };
}
async function measureMap(map) {
  const server = createMultiplayerServer({ compression: false });
  server.http.listen(0, '127.0.0.1'); await once(server.http, 'listening');
  const url = `ws://127.0.0.1:${server.http.address().port}`;
  const host = await connect(url), guest = await connect(url);
  try {
    host.send({ type: 'create', version: 4, map, faction: 0 });
    const waiting = JSON.parse(await host.receive(message => message.type === 'waiting'));
    guest.send({ type: 'join', version: 4, code: waiting.code, faction: 1 });
    await host.receive(message => message.type === 'start'); await guest.receive(message => message.type === 'start');
    host.send({ type: 'ready' }); guest.send({ type: 'ready' });
    const payloads = [];
    while (payloads.length < frames) payloads.push(await host.receive(message => message.type === 'frame'));
    const rawSizes = payloads.map(payload => Buffer.byteLength(payload));
    const compressionTimes = [], compressedSizes = payloads.map(payload => {
      const started = performance.now(), size = deflateRawSync(payload, { level: 3 }).length;
      compressionTimes.push(performance.now() - started); return size;
    });
    const rawBytes = rawSizes.reduce((sum, value) => sum + value, 0);
    const compressedBytes = compressedSizes.reduce((sum, value) => sum + value, 0);
    return {
      map, profile: 'opening-idle', frames, stateRateHz: 10,
      rawBytesPerSecond: Math.round(rawBytes / frames * 10),
      estimatedCompressedBytesPerSecond: Math.round(compressedBytes / frames * 10),
      estimatedCompressionRatio: Number((compressedBytes / rawBytes).toFixed(3)),
      frameBytesP95: percentile(rawSizes, .95), frameBytesMax: Math.max(...rawSizes),
      deflateLevel3P95Ms: Number(percentile(compressionTimes, .95).toFixed(3)),
      deflateLevel3P99Ms: Number(percentile(compressionTimes, .99).toFixed(3))
    };
  } finally {
    host.ws.terminate(); guest.ws.terminate(); await server.close();
  }
}

const results = [];
for (const map of ['desert', 'alien-planet', 'mothership']) results.push(await measureMap(map));
console.log(JSON.stringify({ note: 'Payload estimate excludes WebSocket/TCP/TLS framing and does not represent a loaded battle.', results }, null, 2));
