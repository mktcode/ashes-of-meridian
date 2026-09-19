import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
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
  discard(game: Game, team: number): void;
}
interface Connection {
  id: number; ws: WebSocket; seat?: Seat; tokens: number; tokenAt: number;
  connected: number; lastPong: number; pingAt: number; previousRtt?: number;
  bytesSent: number; stateFramesSent: number; stateFramesSkipped: number;
  maxBufferedAmount: number; closeCause?: string;
}
interface Seat {
  room?: Room; team: number; ready: boolean; connection?: Connection; disconnectedAt?: number;
  resumeToken: string; resources: Map<number, unknown>; requests: Map<number, number>;
  outcomes: Map<number, string>; lastRequest: number;
}
interface Room {
  id: number; code: string; map: string; seed: number; factions: number[]; seats: Seat[];
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
  resumeAttempts: number; resumeSucceeded: number; resumeRejected: number;
}
export interface MultiplayerServerOptions {
  origins?: string[]; maxRooms?: number; now?: () => number;
  tickIntervalMs?: number; stateFrameEveryTicks?: number; heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number; unassignedTimeoutMs?: number; resumeGraceMs?: number;
  metricsIntervalMs?: number; stateBackpressureBytes?: number; controlBackpressureBytes?: number;
  bufferedAmount?: (ws: WebSocket) => number; telemetry?: (event: MultiplayerTelemetryEvent) => void;
}
export const MAX_MULTIPLAYER_ROOMS = 2;
export function createMultiplayerServer(options: MultiplayerServerOptions = {}) {
  const script = new Script(readFileSync(new URL('./simulation.js', import.meta.url), 'utf8'), { filename: 'simulation.js' });
  const catalog = script.runInNewContext({ console }) as Simulation;
  const rooms = new Map<string, Room>(), connections = new Set<Connection>();
  const origins = new Set(options.origins ?? ['null']);
  const now = options.now ?? Date.now;
  const telemetry = options.telemetry ?? (() => {});
  const timing = {
    tick: options.tickIntervalMs ?? 50,
    stateFrameTicks: options.stateFrameEveryTicks ?? 2,
    heartbeat: options.heartbeatIntervalMs ?? 10000,
    heartbeatTimeout: options.heartbeatTimeoutMs ?? 30000,
    unassigned: options.unassignedTimeoutMs ?? 10000,
    resumeGrace: options.resumeGraceMs ?? 45000,
    metrics: options.metricsIntervalMs ?? 30000
  };
  const limits = { stateBuffer: options.stateBackpressureBytes ?? 256 * 1024,
    controlBuffer: options.controlBackpressureBytes ?? 1024 * 1024 };
  if ([...Object.values(timing), ...Object.values(limits)].some(value => !Number.isSafeInteger(value) || value < 1) ||
      timing.heartbeatTimeout <= timing.heartbeat || limits.stateBuffer >= limits.controlBuffer)
    throw Error('Invalid server timing or buffer limit');
  const metrics: MultiplayerServerMetrics = { connectionsOpened: 0, connectionsClosed: 0, bytesSent: 0,
    controlMessagesSent: 0, stateFramesSent: 0, stateFramesSkipped: 0, backpressureDisconnects: 0,
    heartbeatTimeouts: 0, maxBufferedAmount: 0, heartbeatRttSamples: 0, heartbeatRttLastMs: 0,
    heartbeatRttMaxMs: 0, heartbeatJitterLastMs: 0, resumeAttempts: 0, resumeSucceeded: 0, resumeRejected: 0 };
  let nextConnectionId = 1, nextRoomId = 1;
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
    if (req.url !== '/' || !origins.has(req.headers.origin ?? '') || connections.size >= 24) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  function observeBuffer(connection: Connection) {
    const bufferedAmount = options.bufferedAmount?.(connection.ws) ?? connection.ws.bufferedAmount;
    connection.maxBufferedAmount = Math.max(connection.maxBufferedAmount, bufferedAmount);
    metrics.maxBufferedAmount = Math.max(metrics.maxBufferedAmount, bufferedAmount);
    return bufferedAmount;
  }
  function send(connection: Connection | undefined, value: unknown) {
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) return false;
    const bufferedAmount = observeBuffer(connection);
    if (bufferedAmount > limits.controlBuffer) {
      metrics.backpressureDisconnects++;
      connection.closeCause = 'backpressure';
      emit('backpressure_disconnect', { connectionId: connection.id, roomId: connection.seat?.room?.id, bufferedAmount });
      connection.ws.terminate(); return false;
    }
    const message = JSON.stringify(value), bytes = Buffer.byteLength(message);
    connection.ws.send(message); connection.bytesSent += bytes; metrics.bytesSent += bytes;
    metrics.controlMessagesSent++;
    return true;
  }
  function sendSeat(seat: Seat, value: unknown) { return send(seat.connection, value); }
  function discardFrame(room: Room, seat: Seat) {
    room.api!.discard(room.game!, seat.team);
  }
  function frameSeat(room: Room, seat: Seat, afterResume = false) {
    const connection = seat.connection;
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) { discardFrame(room, seat); return false; }
    const bufferedAmount = observeBuffer(connection);
    if (bufferedAmount > limits.stateBuffer) {
      discardFrame(room, seat); connection.stateFramesSkipped++; metrics.stateFramesSkipped++;
      return false;
    }
    if (afterResume) discardFrame(room, seat);
    const message = JSON.stringify(room.api!.view(room.game!, seat.team, seat.resources)), bytes = Buffer.byteLength(message);
    connection.ws.send(message); connection.bytesSent += bytes; metrics.bytesSent += bytes;
    connection.stateFramesSent++; metrics.stateFramesSent++;
    return true;
  }
  function tokenMatches(actual: string, supplied: unknown) {
    if (typeof supplied !== 'string') return false;
    const actualBytes = Buffer.from(actual), suppliedBytes = Buffer.from(supplied);
    return suppliedBytes.length === actualBytes.length && timingSafeEqual(actualBytes, suppliedBytes);
  }
  function newToken() { return randomBytes(24).toString('base64url'); }
  function startMessage(room: Room, seat: Seat) {
    return { type: 'start', version: catalog.version, code: room.code, map: room.map, seed: room.seed,
      factions: room.factions, team: seat.team, token: seat.resumeToken, graceMs: timing.resumeGrace };
  }
  function rememberOutcome(seat: Seat, request: number, status: string) {
    seat.outcomes.set(request, status);
    while (seat.outcomes.size > 64) seat.outcomes.delete(seat.outcomes.keys().next().value!);
    sendSeat(seat, { type: 'outcome', request, status });
  }
  function presence(room: Room, changed: Seat, connected: boolean) {
    for (const seat of room.seats) if (seat !== changed)
      sendSeat(seat, { type: 'presence', team: changed.team, connected, graceMs: connected ? 0 : timing.resumeGrace });
  }
  function end(room: Room, message: string, cause = 'session_end') {
    if (!rooms.delete(room.code)) return;
    if (room.game) room.game.s.stopped = true;
    emit('room_end', { roomId: room.id, phase: room.phase, cause, ticks: room.ticks });
    for (const seat of room.seats) {
      const connection = seat.connection;
      seat.room = undefined; seat.connection = undefined; seat.resources.clear(); seat.requests.clear(); seat.outcomes.clear();
      if (!connection) continue;
      connection.seat = undefined; send(connection, { type: 'end', message });
      connection.closeCause ??= cause; connection.ws.close(1000, 'Session ended');
    }
  }
  function fail(connection: Connection, message: string, cause = 'invalid_request') {
    send(connection, { type: 'error', message }); connection.closeCause = cause; connection.ws.close(1008, 'Invalid request');
  }
  function attach(connection: Connection, seat: Seat) {
    const previous = seat.connection;
    if (previous && previous !== connection) {
      previous.seat = undefined; previous.closeCause = 'replaced'; previous.ws.close(4000, 'Connection replaced');
    }
    connection.seat = seat; seat.connection = connection; seat.disconnectedAt = undefined;
  }
  function findSeat(code: unknown, token: unknown) {
    const room = typeof code === 'string' ? rooms.get(code) : undefined;
    if (!room) return undefined;
    const seat = room.seats.find(candidate => tokenMatches(candidate.resumeToken, token));
    return seat?.room === room ? seat : undefined;
  }
  function resume(connection: Connection, data: Record<string, unknown>) {
    metrics.resumeAttempts++;
    if (data.version !== catalog.version) {
      metrics.resumeRejected++; emit('resume_rejected', { connectionId: connection.id, reason: 'version' });
      fail(connection, 'Session unavailable.', 'resume_rejected'); return;
    }
    const seat = findSeat(data.code, data.token), room = seat?.room;
    if (!seat || !room || (seat.disconnectedAt !== undefined && now() - seat.disconnectedAt >= timing.resumeGrace)) {
      metrics.resumeRejected++; emit('resume_rejected', { connectionId: connection.id, reason: 'credentials_or_expired' });
      fail(connection, 'Session unavailable.', 'resume_rejected'); return;
    }
    attach(connection, seat); seat.resumeToken = newToken();
    metrics.resumeSucceeded++; emit('resume_succeeded', { connectionId: connection.id, roomId: room.id, team: seat.team, phase: room.phase });
    send(connection, { type: 'resumed', token: seat.resumeToken, graceMs: timing.resumeGrace, phase: room.phase,
      lastRequest: seat.lastRequest, start: room.phase === 'waiting' ? undefined : startMessage(room, seat) });
    for (const [request, status] of seat.outcomes) sendSeat(seat, { type: 'outcome', request, status });
    presence(room, seat, true);
    if (room.phase === 'playing') frameSeat(room, seat, true);
  }
  function createSeat(team: number): Seat {
    return { team, ready: false, resumeToken: newToken(), resources: new Map(), requests: new Map(), outcomes: new Map(), lastRequest: 0 };
  }
  wss.on('connection', (ws: WebSocket) => {
    const connected = now();
    const connection: Connection = { id: nextConnectionId++, ws, tokens: 60, tokenAt: connected, connected,
      lastPong: connected, pingAt: connected, bytesSent: 0, stateFramesSent: 0, stateFramesSkipped: 0, maxBufferedAmount: 0 };
    connections.add(connection); metrics.connectionsOpened++;
    emit('connection_open', { connectionId: connection.id });
    ws.on('pong', () => {
      const receivedAt = now(), rtt = Math.max(0, receivedAt - connection.pingAt);
      connection.lastPong = receivedAt;
      metrics.heartbeatRttSamples++; metrics.heartbeatRttLastMs = rtt;
      metrics.heartbeatRttMaxMs = Math.max(metrics.heartbeatRttMaxMs, rtt);
      metrics.heartbeatJitterLastMs = connection.previousRtt === undefined ? 0 : Math.abs(rtt - connection.previousRtt);
      connection.previousRtt = rtt;
    });
    ws.on('error', error => {
      connection.closeCause ??= 'transport_error';
      emit('transport_error', { connectionId: connection.id, roomId: connection.seat?.room?.id,
        error: error instanceof Error ? error.name : 'UnknownError' });
      ws.terminate();
    });
    ws.on('close', (code, reason) => {
      connections.delete(connection); metrics.connectionsClosed++;
      const seat = connection.seat, room = seat?.room;
      if (seat?.connection === connection) seat.connection = undefined;
      connection.seat = undefined;
      emit('connection_close', { connectionId: connection.id, roomId: room?.id, phase: room?.phase,
        team: room ? seat?.team : undefined, code, reason: reason.toString('utf8').slice(0, 123),
        cause: connection.closeCause ?? 'peer_close', durationMs: Math.max(0, now() - connection.connected),
        bytesSent: connection.bytesSent, stateFramesSent: connection.stateFramesSent,
        stateFramesSkipped: connection.stateFramesSkipped, maxBufferedAmount: connection.maxBufferedAmount });
      if (!seat || !room || seat.connection) return;
      if (['invalid_request', 'resume_rejected'].includes(connection.closeCause ?? '')) {
        end(room, 'A player left the session. No rewards.', connection.closeCause); return;
      }
      seat.disconnectedAt = now(); presence(room, seat, false);
      emit('seat_disconnected', { roomId: room.id, team: seat.team, cause: connection.closeCause ?? 'peer_close', graceMs: timing.resumeGrace });
    });
    ws.on('message', (raw, binary) => {
      try {
        if (ws.readyState !== WebSocket.OPEN) return;
        const receivedAt = now();
        connection.tokens = Math.min(60, connection.tokens + (receivedAt - connection.tokenAt) * .03); connection.tokenAt = receivedAt;
        if (binary || --connection.tokens < 0) { fail(connection, 'Message limit exceeded.'); return; }
        const data = JSON.parse(raw.toString()) as Record<string, unknown>;
        if (!data || typeof data !== 'object' || Array.isArray(data)) { fail(connection, 'Invalid message.'); return; }
        if (!connection.seat) {
          if (data.type === 'resume') { resume(connection, data); return; }
          if (!['create', 'join'].includes(String(data.type)) || data.version !== catalog.version ||
              !Number.isInteger(data.faction) || ![0, 1, 2].includes(data.faction as number)) {
            fail(connection, 'Incompatible session request.'); return;
          }
          if (data.type === 'create') {
            if (!catalog.maps.includes(String(data.map)) || rooms.size >= maxRooms) { fail(connection, 'Unknown map or server full.'); return; }
            let code: string; do { code = randomBytes(5).toString('hex').toUpperCase(); } while (rooms.has(code));
            const seat = createSeat(0);
            const room: Room = { id: nextRoomId++, code, map: String(data.map), seed: randomInt(1, 100000000),
              factions: [data.faction as number], seats: [seat], phase: 'waiting', deadline: receivedAt + 120000, ticks: 0 };
            seat.room = room; attach(connection, seat); rooms.set(code, room);
            emit('room_created', { roomId: room.id, map: room.map });
            send(connection, { type: 'waiting', code, map: room.map, token: seat.resumeToken, graceMs: timing.resumeGrace }); return;
          }
          const room = typeof data.code === 'string' ? rooms.get(data.code) : undefined;
          const host = room?.seats[0];
          if (!room || !host || room.phase !== 'waiting' || receivedAt >= room.deadline || !host.connection) {
            fail(connection, 'Session unavailable.'); return;
          }
          const seat = createSeat(1); seat.room = room; attach(connection, seat);
          room.seats.push(seat); room.factions.push(data.faction as number);
          room.phase = 'loading'; room.deadline = receivedAt + 60000;
          emit('room_loading', { roomId: room.id, map: room.map });
          room.api = script.runInNewContext({ console }) as Simulation;
          room.game = room.api.create({ seed: room.seed, startSeed: randomInt(1, 100000000), map: room.map, duration: 3600,
            parties: room.factions.map(faction => ({ faction, controller: 'human' })), hostilities: [[false, true], [true, false]] });
          for (const member of room.seats) sendSeat(member, startMessage(room, member));
          return;
        }
        const seat = connection.seat, room = seat.room;
        if (!room) { fail(connection, 'Session unavailable.'); return; }
        if (data.type === 'leave') { end(room, 'A player left the session. No rewards.', 'player_leave'); return; }
        if (data.type === 'ready' && room.phase === 'loading') {
          if (!seat.ready) {
            seat.ready = true;
            if (room.seats.every(member => member.ready)) {
              room.phase = 'playing'; room.deadline = receivedAt + 3600000;
              emit('room_playing', { roomId: room.id, map: room.map });
              for (const member of room.seats) frameSeat(room, member);
            }
          }
          return;
        }
        if (data.type !== 'action' || room.phase !== 'playing' || !Number.isSafeInteger(data.request) ||
            (data.request as number) <= seat.lastRequest) { fail(connection, 'Invalid command sequence or session phase.'); return; }
        seat.lastRequest = data.request as number;
        const ticket = seat.requests.size < 64 ? room.api!.enqueue(room.game!, seat.team, data.action) : null;
        if (!ticket) { rememberOutcome(seat, data.request as number, 'rejected'); return; }
        seat.requests.set(ticket.sequence, data.request as number);
        sendSeat(seat, { type: 'accepted', request: data.request, tick: ticket.tick });
      } catch (error) {
        if (error instanceof SyntaxError) fail(connection, 'Invalid JSON.');
        else { console.error('Session initialization failed', error); const room = connection.seat?.room;
          if (room) end(room, 'Server error. Session ended.', 'server_error'); else fail(connection, 'Server error.'); }
      }
    });
  });
  const clock = setInterval(() => {
    for (const room of rooms.values()) {
      const expiredSeat = room.seats.find(seat => seat.disconnectedAt !== undefined && now() - seat.disconnectedAt >= timing.resumeGrace);
      if (expiredSeat) { end(room, 'A player did not reconnect in time. No rewards.', 'resume_expired'); continue; }
      if (now() >= room.deadline) { end(room, 'Session time limit reached. No rewards.', 'room_timeout'); continue; }
      if (room.phase !== 'playing') continue;
      try {
        const dt = timing.tick / 1000;
        room.game!.step(dt); room.game!.effects.tick(dt);
        for (const result of room.game!.commandQueue.lastResults) {
          const seat = room.seats[result.team], request = seat?.requests.get(result.sequence);
          if (request !== undefined) { rememberOutcome(seat, request, result.status); seat.requests.delete(result.sequence); }
        }
        if (++room.ticks % timing.stateFrameTicks === 0) for (const seat of room.seats) frameSeat(room, seat);
        if (room.game!.s.stopped) end(room, 'Scenario stopped. No rewards.', 'scenario_stopped');
      } catch (error) { console.error('Session tick failed', error); end(room, 'Server error. Session ended.', 'server_error'); }
    }
  }, timing.tick);
  const heartbeat = setInterval(() => {
    for (const connection of connections) {
      if (connection.ws.readyState !== WebSocket.OPEN) continue;
      const current = now();
      if (current - connection.lastPong > timing.heartbeatTimeout) {
        metrics.heartbeatTimeouts++; connection.closeCause = 'heartbeat_timeout';
        emit('heartbeat_timeout', { connectionId: connection.id, roomId: connection.seat?.room?.id,
          silenceMs: current - connection.lastPong, bufferedAmount: connection.ws.bufferedAmount });
        connection.ws.terminate(); continue;
      }
      if (!connection.seat && current - connection.connected > timing.unassigned) {
        connection.closeCause = 'unassigned_timeout'; connection.ws.terminate(); continue;
      }
      connection.pingAt = current; connection.ws.ping(); send(connection, { type: 'ping' });
    }
  }, timing.heartbeat);
  const metricReport = setInterval(() => emit('metrics', { activeConnections: connections.size, activeRooms: rooms.size, ...metrics }), timing.metrics);
  return {
    http,
    getMetrics: (): MultiplayerServerMetrics => ({ ...metrics }),
    async close() {
      clearInterval(clock); clearInterval(heartbeat); clearInterval(metricReport);
      for (const room of rooms.values()) end(room, 'Server shutting down.', 'server_shutdown');
      for (const connection of connections) { connection.closeCause ??= 'server_shutdown'; connection.ws.terminate(); }
      await new Promise<void>(resolve => wss.close(() => resolve()));
      if (http.listening) await new Promise<void>(resolve => http.close(() => resolve()));
    }
  };
}
