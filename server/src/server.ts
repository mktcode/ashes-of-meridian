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
  id: number; ws: WebSocket; room?: Room; team: number; ready: boolean; alive: boolean;
  resources: Map<number, unknown>; requests: Map<number, number>;
  lastRequest: number; tokens: number; tokenAt: number; connected: number; lastPong: number; pingAt: number; previousRtt?: number;
  bytesSent: number; stateFramesSent: number; maxBufferedAmount: number; closeCause?: string;
}
interface Room {
  id: number; code: string; map: string; seed: number; factions: number[]; clients: Client[];
  phase: 'waiting' | 'loading' | 'playing'; deadline: number; ticks: number;
  api?: Simulation; game?: Game;
}
export interface MultiplayerTelemetryEvent {
  event: string; at: number; [field: string]: unknown;
}
export interface MultiplayerServerMetrics {
  connectionsOpened: number; connectionsClosed: number; bytesSent: number;
  controlMessagesSent: number; stateFramesSent: number; stateFramesSkipped: number;
  backpressureDisconnects: number; heartbeatTimeouts: number; maxBufferedAmount: number;
  heartbeatRttSamples: number; heartbeatRttLastMs: number; heartbeatRttMaxMs: number; heartbeatJitterLastMs: number;
}
export interface MultiplayerServerOptions {
  origins?: string[]; maxRooms?: number; now?: () => number;
  tickIntervalMs?: number; stateFrameEveryTicks?: number; heartbeatIntervalMs?: number;
  unassignedTimeoutMs?: number; metricsIntervalMs?: number;
  telemetry?: (event: MultiplayerTelemetryEvent) => void;
}
export const MAX_MULTIPLAYER_ROOMS = 2;
export function createMultiplayerServer(options: MultiplayerServerOptions = {}) {
  const script = new Script(readFileSync(new URL('./simulation.js', import.meta.url), 'utf8'), { filename: 'simulation.js' });
  const catalog = script.runInNewContext({ console }) as Simulation;
  const rooms = new Map<string, Room>(), clients = new Set<Client>();
  const origins = new Set(options.origins ?? ['null']);
  const now = options.now ?? Date.now;
  const telemetry = options.telemetry ?? (() => {});
  const timing = {
    tick: options.tickIntervalMs ?? 50,
    stateFrameTicks: options.stateFrameEveryTicks ?? 2,
    heartbeat: options.heartbeatIntervalMs ?? 5000,
    unassigned: options.unassignedTimeoutMs ?? 10000,
    metrics: options.metricsIntervalMs ?? 30000
  };
  if (Object.values(timing).some(value => !Number.isSafeInteger(value) || value < 1)) throw Error('Invalid server timing');
  const metrics: MultiplayerServerMetrics = { connectionsOpened: 0, connectionsClosed: 0, bytesSent: 0,
    controlMessagesSent: 0, stateFramesSent: 0, stateFramesSkipped: 0, backpressureDisconnects: 0,
    heartbeatTimeouts: 0, maxBufferedAmount: 0, heartbeatRttSamples: 0, heartbeatRttLastMs: 0,
    heartbeatRttMaxMs: 0, heartbeatJitterLastMs: 0 };
  let nextClientId = 1, nextRoomId = 1;
  const emit = (event: string, fields: Record<string, unknown> = {}) => telemetry({ event, at: now(), ...fields });
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
  function send(client: Client, value: unknown, kind: 'control' | 'state' = 'control') {
    if (client.ws.readyState !== WebSocket.OPEN) return false;
    const bufferedAmount = client.ws.bufferedAmount;
    client.maxBufferedAmount = Math.max(client.maxBufferedAmount, bufferedAmount);
    metrics.maxBufferedAmount = Math.max(metrics.maxBufferedAmount, bufferedAmount);
    if (bufferedAmount > 1024 * 1024) {
      metrics.backpressureDisconnects++;
      client.closeCause = 'backpressure';
      emit('backpressure_disconnect', { connectionId: client.id, roomId: client.room?.id, bufferedAmount });
      client.ws.terminate(); return false;
    }
    const message = JSON.stringify(value), bytes = Buffer.byteLength(message);
    client.ws.send(message); client.bytesSent += bytes; metrics.bytesSent += bytes;
    if (kind === 'state') { client.stateFramesSent++; metrics.stateFramesSent++; }
    else metrics.controlMessagesSent++;
    return true;
  }
  function end(room: Room, message: string, cause = 'session_end') {
    if (!rooms.delete(room.code)) return;
    if (room.game) room.game.s.stopped = true;
    emit('room_end', { roomId: room.id, phase: room.phase, cause, ticks: room.ticks });
    for (const client of room.clients) {
      client.room = undefined; client.resources.clear(); client.requests.clear();
      send(client, { type: 'end', message }); client.closeCause ??= cause; client.ws.close(1000, 'Session ended');
    }
  }
  function fail(client: Client, message: string) {
    send(client, { type: 'error', message }); client.closeCause = 'invalid_request'; client.ws.close(1008, 'Invalid request');
  }
  function frame(room: Room) {
    for (const client of room.clients) send(client, room.api!.view(room.game!, client.team, client.resources), 'state');
  }
  wss.on('connection', (ws: WebSocket) => {
    const connected = now();
    const client: Client = { id: nextClientId++, ws, team: 0, ready: false, alive: true, resources: new Map(), requests: new Map(),
      lastRequest: 0, tokens: 60, tokenAt: connected, connected, lastPong: connected, pingAt: connected,
      bytesSent: 0, stateFramesSent: 0, maxBufferedAmount: 0 };
    clients.add(client); metrics.connectionsOpened++;
    emit('connection_open', { connectionId: client.id });
    ws.on('pong', () => {
      const receivedAt = now(), rtt = Math.max(0, receivedAt - client.pingAt);
      client.alive = true; client.lastPong = receivedAt;
      metrics.heartbeatRttSamples++; metrics.heartbeatRttLastMs = rtt;
      metrics.heartbeatRttMaxMs = Math.max(metrics.heartbeatRttMaxMs, rtt);
      metrics.heartbeatJitterLastMs = client.previousRtt === undefined ? 0 : Math.abs(rtt - client.previousRtt);
      client.previousRtt = rtt;
    });
    ws.on('error', error => {
      client.closeCause ??= 'transport_error';
      emit('transport_error', { connectionId: client.id, roomId: client.room?.id,
        error: error instanceof Error ? error.name : 'UnknownError' });
      ws.terminate();
    });
    ws.on('close', (code, reason) => {
      clients.delete(client); metrics.connectionsClosed++;
      const room = client.room;
      emit('connection_close', { connectionId: client.id, roomId: room?.id, phase: room?.phase,
        team: room ? client.team : undefined, code, reason: reason.toString('utf8').slice(0, 123),
        cause: client.closeCause ?? 'peer_close', durationMs: Math.max(0, now() - client.connected),
        bytesSent: client.bytesSent, stateFramesSent: client.stateFramesSent,
        maxBufferedAmount: client.maxBufferedAmount });
      if (room) end(room, 'A player disconnected. Session ended without rewards.', client.closeCause ?? 'peer_close');
    });
    ws.on('message', (raw, binary) => {
      try {
        if (ws.readyState !== WebSocket.OPEN) return;
        const receivedAt = now();
        client.tokens = Math.min(60, client.tokens + (receivedAt - client.tokenAt) * .03); client.tokenAt = receivedAt;
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
            const room: Room = { id: nextRoomId++, code, map: String(data.map), seed: randomInt(1, 100000000), factions: [data.faction as number],
              clients: [client], phase: 'waiting', deadline: receivedAt + 120000, ticks: 0 };
            rooms.set(code, room); client.room = room;
            emit('room_created', { roomId: room.id, map: room.map });
            send(client, { type: 'waiting', code, map: room.map }); return;
          }
          const room = typeof data.code === 'string' ? rooms.get(data.code) : undefined;
          if (!room || room.phase !== 'waiting' || receivedAt >= room.deadline || room.clients[0].ws.readyState !== WebSocket.OPEN) {
            fail(client, 'Session unavailable.'); return;
          }
          client.room = room; client.team = 1; room.clients.push(client); room.factions.push(data.faction as number);
          room.phase = 'loading'; room.deadline = receivedAt + 60000;
          emit('room_loading', { roomId: room.id, map: room.map });
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
            room.phase = 'playing'; room.deadline = receivedAt + 3600000;
            emit('room_playing', { roomId: room.id, map: room.map }); frame(room);
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
      if (now() >= room.deadline) { end(room, 'Session time limit reached. No rewards.', 'room_timeout'); continue; }
      if (room.phase !== 'playing') continue;
      try {
        const dt = timing.tick / 1000;
        room.game!.step(dt); room.game!.effects.tick(dt);
        for (const result of room.game!.commandQueue.lastResults) {
          const client = room.clients[result.team], request = client?.requests.get(result.sequence);
          if (request !== undefined) { send(client, { type: 'outcome', request, status: result.status }); client.requests.delete(result.sequence); }
        }
        if (++room.ticks % timing.stateFrameTicks === 0) frame(room);
        if (room.game!.s.stopped) end(room, 'Scenario stopped. No rewards.', 'scenario_stopped');
      } catch (error) { console.error('Session tick failed', error); end(room, 'Server error. Session ended.', 'server_error'); }
    }
  }, timing.tick);
  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (!client.alive) {
        metrics.heartbeatTimeouts++; client.closeCause = 'heartbeat_timeout';
        emit('heartbeat_timeout', { connectionId: client.id, roomId: client.room?.id,
          silenceMs: Math.max(0, now() - client.lastPong), bufferedAmount: client.ws.bufferedAmount });
        client.ws.terminate(); continue;
      }
      if (!client.room && now() - client.connected > timing.unassigned) {
        client.closeCause = 'unassigned_timeout'; client.ws.terminate(); continue;
      }
      client.alive = false; client.pingAt = now(); client.ws.ping(); send(client, { type: 'ping' });
    }
  }, timing.heartbeat);
  const metricReport = setInterval(() => emit('metrics', { activeConnections: clients.size, activeRooms: rooms.size, ...metrics }), timing.metrics);
  return {
    http,
    getMetrics: (): MultiplayerServerMetrics => ({ ...metrics }),
    async close() {
      clearInterval(clock); clearInterval(heartbeat); clearInterval(metricReport);
      for (const room of rooms.values()) end(room, 'Server shutting down.', 'server_shutdown');
      for (const client of clients) { client.closeCause ??= 'server_shutdown'; client.ws.terminate(); }
      await new Promise<void>(resolve => wss.close(() => resolve()));
      if (http.listening) await new Promise<void>(resolve => http.close(() => resolve()));
    }
  };
}
