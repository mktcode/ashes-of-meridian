import { createMultiplayerServer, MAX_MULTIPLAYER_ROOMS } from './server.js';
const port = Number(process.env.PORT || 8787), host = process.env.HOST || '127.0.0.1',
  maxRooms = Number(process.env.MAX_ROOMS || MAX_MULTIPLAYER_ROOMS);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid PORT');
if (!Number.isSafeInteger(maxRooms) || maxRooms < 1) throw Error('Invalid MAX_ROOMS');
const server = createMultiplayerServer({
  origins: (process.env.ALLOWED_ORIGINS || 'null').split(',').map(s => s.trim()), maxRooms,
  telemetry: event => console.log(JSON.stringify({ service: 'meridian-multiplayer', ...event }))
});
server.http.listen(port, host, () => console.log(`Meridian multiplayer listening on ${host}:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void server.close(); });
