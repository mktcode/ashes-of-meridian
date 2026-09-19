import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomBytes, randomInt } from 'node:crypto';
import { Script } from 'node:vm';
import { WebSocket, WebSocketServer } from 'ws';

interface Ticket { tick: number; sequence: number; }
interface Game {
  s: { stopped: boolean };
  effects: { tick(dt: number): void };
  step(dt: number): void;
  commandQueue: { lastResults: (Ticket & { team: number; status: string })[] };
}
interface Simulation {
  version: number; maps: string[];
  create(options: unknown): Game;
  enqueue(game: Game, team: number, input: unknown): Ticket | null;
  view(game: Game, team: number, resources: Map<number, unknown>): unknown;
}
interface Client {
  ws: WebSocket; room?: Room; team: number; ready: boolean; alive: boolean;
  resources: Map<number, unknown>; requests: Map<number, number>;
  lastRequest: number; tokens: number; tokenAt: number; connected: number;
}
interface Room {
  code: string; map: string; seed: number; factions: number[]; clients: Client[];
  phase: 'waiting' | 'loading' | 'playing'; deadline: number; ticks: number;
  api?: Simulation; game?: Game;
}
export const MAX_MULTIPLAYER_ROOMS = 2;
export function createMultiplayerServer(options: { origins?: string[]; maxRooms?: number } = {}) {
  const script = new Script(readFileSync(new URL('./simulation.js', import.meta.url), 'utf8'), { filename: 'simulation.js' });
  const catalog = script.runInNewContext({ console }) as Simulation;
  const rooms = new Map<string, Room>(), clients = new Set<Client>();
  const origins = new Set(options.origins ?? ['null']);
  const requestedRooms = options.maxRooms ?? MAX_MULTIPLAYER_ROOMS;
  if (!Number.isSafeInteger(requestedRooms) || requestedRooms < 1) throw Error('Invalid room limit');
  const maxRooms = Math.min(requestedRooms, MAX_MULTIPLAYER_ROOMS);
  const http = createServer((req, res) => {
    if (req.url !== '/health' || req.method !== 'GET') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, protocol: catalog.version }));
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16384, perMessageDeflate: false });
  http.on('upgrade', (req, socket, head) => {
    if (req.url !== '/' || !origins.has(req.headers.origin ?? '') || clients.size >= 24) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  function send(client: Client, value: unknown) {
    if (client.ws.readyState !== WebSocket.OPEN) return;
    if (client.ws.bufferedAmount > 1024 * 1024) { client.ws.terminate(); return; }
    client.ws.send(JSON.stringify(value));
  }
  function end(room: Room, message: string) {
    if (!rooms.delete(room.code)) return;
    if (room.game) room.game.s.stopped = true;
    for (const client of room.clients) {
      client.room = undefined; client.resources.clear(); client.requests.clear();
      send(client, { type: 'end', message }); client.ws.close(1000, 'Session ended');
    }
  }
  function fail(client: Client, message: string) {
    send(client, { type: 'error', message }); client.ws.close(1008, 'Invalid request');
  }
  function frame(room: Room) {
    for (const client of room.clients) send(client, room.api!.view(room.game!, client.team, client.resources));
  }
  wss.on('connection', (ws: WebSocket) => {
    const client: Client = { ws, team: 0, ready: false, alive: true, resources: new Map(), requests: new Map(),
      lastRequest: 0, tokens: 60, tokenAt: Date.now(), connected: Date.now() };
    clients.add(client);
    ws.on('pong', () => { client.alive = true; });
    ws.on('error', () => ws.terminate());
    ws.on('close', () => {
      clients.delete(client);
      if (client.room) end(client.room, 'A player disconnected. Session ended without rewards.');
    });
    ws.on('message', (raw, binary) => {
      try {
        if (ws.readyState !== WebSocket.OPEN) return;
        const now = Date.now();
        client.tokens = Math.min(60, client.tokens + (now - client.tokenAt) * .03); client.tokenAt = now;
        if (binary || --client.tokens < 0) { fail(client, 'Message limit exceeded.'); return; }
        const data = JSON.parse(raw.toString()) as Record<string, unknown>;
        if (!data || typeof data !== 'object' || Array.isArray(data)) { fail(client, 'Invalid message.'); return; }
        if (!client.room) {
          if (!['create', 'join'].includes(String(data.type)) || data.version !== catalog.version ||
              !Number.isInteger(data.faction) || ![0, 1, 2].includes(data.faction as number)) {
            fail(client, 'Incompatible session request.'); return;
          }
          if (data.type === 'create') {
            if (!catalog.maps.includes(String(data.map)) || rooms.size >= maxRooms) { fail(client, 'Unknown map or server full.'); return; }
            let code: string; do { code = randomBytes(5).toString('hex').toUpperCase(); } while (rooms.has(code));
            const room: Room = { code, map: String(data.map), seed: randomInt(1, 100000000), factions: [data.faction as number],
              clients: [client], phase: 'waiting', deadline: now + 120000, ticks: 0 };
            rooms.set(code, room); client.room = room;
            send(client, { type: 'waiting', code, map: room.map }); return;
          }
          const room = typeof data.code === 'string' ? rooms.get(data.code) : undefined;
          if (!room || room.phase !== 'waiting' || now >= room.deadline || room.clients[0].ws.readyState !== WebSocket.OPEN) {
            fail(client, 'Session unavailable.'); return;
          }
          client.room = room; client.team = 1; room.clients.push(client); room.factions.push(data.faction as number);
          room.phase = 'loading'; room.deadline = now + 60000;
          room.api = script.runInNewContext({ console }) as Simulation;
          room.game = room.api.create({ seed: room.seed, startSeed: randomInt(1, 100000000), map: room.map, duration: 3600,
            parties: room.factions.map(faction => ({ faction, controller: 'human' })), hostilities: [[false, true], [true, false]] });
          for (const member of room.clients) send(member, { type: 'start', version: catalog.version, code: room.code,
            map: room.map, seed: room.seed, factions: room.factions, team: member.team });
          return;
        }
        const room = client.room;
        if (data.type === 'ready' && room.phase === 'loading' && !client.ready) {
          client.ready = true;
          if (room.clients.every(c => c.ready)) {
            room.phase = 'playing'; room.deadline = now + 3600000; frame(room);
          }
          return;
        }
        if (data.type !== 'action' || room.phase !== 'playing' || !Number.isSafeInteger(data.request) ||
            (data.request as number) <= client.lastRequest) { fail(client, 'Invalid command sequence or session phase.'); return; }
        client.lastRequest = data.request as number;
        const ticket = client.requests.size < 64 ? room.api!.enqueue(room.game!, client.team, data.action) : null;
        if (!ticket) { send(client, { type: 'outcome', request: data.request, status: 'rejected' }); return; }
        client.requests.set(ticket.sequence, data.request as number);
        send(client, { type: 'accepted', request: data.request, tick: ticket.tick });
      } catch (error) {
        if (error instanceof SyntaxError) fail(client, 'Invalid JSON.');
        else { console.error('Session initialization failed', error); if (client.room) end(client.room, 'Server error. Session ended.'); else fail(client, 'Server error.'); }
      }
    });
  });
  const clock = setInterval(() => {
    for (const room of rooms.values()) {
      if (Date.now() >= room.deadline) { end(room, 'Session time limit reached. No rewards.'); continue; }
      if (room.phase !== 'playing') continue;
      try {
        room.game!.step(.05); room.game!.effects.tick(.05);
        for (const result of room.game!.commandQueue.lastResults) {
          const client = room.clients[result.team], request = client?.requests.get(result.sequence);
          if (request !== undefined) { send(client, { type: 'outcome', request, status: result.status }); client.requests.delete(result.sequence); }
        }
        if (++room.ticks % 2 === 0) frame(room);
        if (room.game!.s.stopped) end(room, 'Scenario stopped. No rewards.');
      } catch (error) { console.error('Session tick failed', error); end(room, 'Server error. Session ended.'); }
    }
  }, 50);
  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (!client.alive || (!client.room && Date.now() - client.connected > 10000)) { client.ws.terminate(); continue; }
      client.alive = false; client.ws.ping(); send(client, { type: 'ping' });
    }
  }, 5000);
  return {
    http,
    async close() {
      clearInterval(clock); clearInterval(heartbeat);
      for (const room of rooms.values()) end(room, 'Server shutting down.');
      for (const client of clients) client.ws.terminate();
      await new Promise<void>(resolve => wss.close(() => resolve()));
      if (http.listening) await new Promise<void>(resolve => http.close(() => resolve()));
    }
  };
}
