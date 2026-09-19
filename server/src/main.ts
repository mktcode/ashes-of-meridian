import { createMultiplayerServer } from './server.js';
const port = Number(process.env.PORT || 8787), host = process.env.HOST || '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid PORT');
const server = createMultiplayerServer({ origins: (process.env.ALLOWED_ORIGINS || 'null').split(',').map(s => s.trim()) });
server.http.listen(port, host, () => console.log(`Meridian multiplayer listening on ${host}:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void server.close(); });
