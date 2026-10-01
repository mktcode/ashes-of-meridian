/* Optional WebSocket client; offline play never opens a connection. */
'use strict';
class MeridianMultiplayerClient {
  private static readonly CODE_KEY = 'ashes.multiplayer.code';
  private static readonly RESUME_KEY = 'ashes.multiplayer.resume.v1';
  socket: WebSocket | null = null;
  code = '';
  serverUrl = 'wss://aoms.markus-kottlaender.de';
  private readonly timeline = new MultiplayerTimeline();
  private receivedFrames = 0;
  private wasHidden = false;
  private request = 0;
  private lastTick = -1;
  private started = false;
  private preparing = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private receivedAt = 0;
  private connectionAttempt = 0;
  private connectionPhase: 'idle' | 'connecting' | 'handshake' | 'waiting' | 'preparing' | 'playing' | 'reconnecting' | 'ended' = 'idle';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectUntil = 0;
  private resumeGraceMs = 45000;
  private resumeToken = '';
  private preparation = 0;
  private pending = new Map<number, BattleAction>();
  private replayTimer: ReturnType<typeof setTimeout> | null = null;
  private replay: number[] = [];
  private resumeExpiresAt = 0;
  private persistedAt = 0;
  private storage(): Storage | null {
    try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
  }
  private rememberedCode() {
    try {
      const code = this.storage()?.getItem(MeridianMultiplayerClient.CODE_KEY) ?? '';
      return /^[A-F0-9]{10}$/.test(code) ? code : '';
    } catch { return ''; }
  }
  private rememberCode() {
    if (!/^[A-F0-9]{10}$/.test(this.code)) return;
    try { this.storage()?.setItem(MeridianMultiplayerClient.CODE_KEY, this.code); } catch { /* Storage is optional. */ }
  }
  private persistResume(force = false) {
    if (!this.resumeToken || !this.code) return;
    const now = Date.now();
    if (!force && now - this.persistedAt < 5000) return;
    this.resumeExpiresAt = now + this.resumeGraceMs; this.persistedAt = now;
    try { this.storage()?.setItem(MeridianMultiplayerClient.RESUME_KEY, JSON.stringify({
      version: MULTIPLAYER_VERSION, serverUrl: this.serverUrl, code: this.code, token: this.resumeToken,
      graceMs: this.resumeGraceMs, expiresAt: this.resumeExpiresAt, request: this.request
    })); } catch { /* Storage is optional. */ }
  }
  private clearResume() {
    this.resumeExpiresAt = 0; this.persistedAt = 0;
    try { this.storage()?.removeItem(MeridianMultiplayerClient.RESUME_KEY); } catch { /* Storage is optional. */ }
  }
  private storedResume() {
    try {
      const raw = this.storage()?.getItem(MeridianMultiplayerClient.RESUME_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw) as Record<string, unknown>;
      const url = new URL(String(value.serverUrl));
      if (value.version !== MULTIPLAYER_VERSION || !['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.hash ||
          (typeof location !== 'undefined' && location.protocol === 'https:' && url.protocol !== 'wss:') ||
          !/^[A-F0-9]{10}$/.test(String(value.code)) || !/^[A-Za-z0-9_-]{32}$/.test(String(value.token)) ||
          !Number.isSafeInteger(value.graceMs) || Number(value.graceMs) < 1000 || Number(value.graceMs) > 120000 ||
          !Number.isSafeInteger(value.expiresAt) || Number(value.expiresAt) <= Date.now() ||
          !Number.isSafeInteger(value.request) || Number(value.request) < 0) throw Error('Invalid stored session');
      return { serverUrl: url.href, code: String(value.code), token: String(value.token),
        graceMs: Number(value.graceMs), expiresAt: Number(value.expiresAt), request: Number(value.request) };
    } catch { this.clearResume(); return null; }
  }
  private stopReplay() {
    if (this.replayTimer) clearTimeout(this.replayTimer);
    this.replayTimer = null; this.replay = [];
  }
  private replayNext(socket: WebSocket) {
    if (socket !== this.socket || socket.readyState !== WebSocket.OPEN) return;
    const request = this.replay.shift(), action = request === undefined ? undefined : this.pending.get(request);
    if (action) socket.send(JSON.stringify({ type: 'action', request, action }));
    if (this.replay.length) this.replayTimer = setTimeout(() => {
      this.replayTimer = null; this.replayNext(socket);
    }, 100);
  }
  constructor(private ui: MeridianUI, private prepare: (map: BattlefieldId) => Promise<boolean>) {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function')
      window.addEventListener('online', () => this.retryReconnectNow());
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) this.retryReconnectNow();
        else this.persistResume(true);
      });
      document.addEventListener('pagehide', () => this.persistResume(true));
    }
  }
  show() {
    this.ui.showHome();
    const stored = this.storedResume(), code = stored?.code ?? this.rememberedCode();
    $('menu').innerHTML = `<div class="subscreen"><header class="sub-header"><div><div class="eyebrow">TWO-PLAYER PROTOTYPE</div><h1>Multiplayer.</h1></div><button class="textbtn" data-ui="home">← MAIN MENU</button></header>
      <div style="max-width:640px;margin:auto"><p>Two human parties, no expedition rewards. Short connection losses reconnect automatically; leaving or exceeding the recovery window ends the session. Menus do not pause the server.</p>
      ${stored ? '<div class="launch-row"><button class="primary" data-ui="networkResume">CONTINUE RECENT SESSION</button></div>' : ''}
      <div class="settings-row"><label for="netServer">Server address</label><input id="netServer" type="url" value="${esc(stored?.serverUrl ?? this.serverUrl)}" placeholder="wss://your-server.example"></div>
      <div class="settings-row"><label for="netFaction">Your faction</label><select id="netFaction">${FACTIONS.map((f,i) => `<option value="${i}">${esc(f.name)}</option>`).join('')}</select></div>
      <div class="settings-row"><label for="netMap">Map (session creator)</label><select id="netMap">${availableBattlefields('multiplayer').map(id => `<option value="${id}">${esc(BATTLEFIELDS[id].name)}</option>`).join('')}</select></div>
      <div class="launch-row"><button id="netCreate" class="primary" data-ui="networkCreate">CREATE SESSION</button></div>
      <div class="settings-row"><label for="netCode">Session code</label><input id="netCode" maxlength="10" autocomplete="off" spellcheck="false" value="${esc(code)}" placeholder="Code from your friend"></div>
      <div class="launch-row"><button id="netJoin" class="primary" data-ui="networkJoin">JOIN SESSION</button><button class="secondary" data-ui="networkCopy">COPY CODE</button></div>
      <p id="netStatus" role="status">Start the separate multiplayer server, then create or join a session.</p></div></div>`;
  }
  resumeStored() {
    if (this.socket || this.reconnectTimer) return;
    const stored = this.storedResume();
    if (!stored) { this.status('The saved reconnection window has expired.'); return; }
    this.serverUrl = stored.serverUrl; this.code = stored.code; this.resumeToken = stored.token;
    this.resumeGraceMs = stored.graceMs; this.resumeExpiresAt = stored.expiresAt; this.request = stored.request;
    this.reconnectUntil = performance.now() + Math.max(0, stored.expiresAt - Date.now());
    this.receivedAt = performance.now(); this.connectionAttempt = 0;
    this.openSocket({ type: 'resume', version: MULTIPLAYER_VERSION, code: this.code, token: this.resumeToken }, true);
    this.startWatchdog();
  }
  async copyCode() {
    const input = document.getElementById('netCode') as HTMLInputElement | null;
    if (!input?.value) return;
    try { await navigator.clipboard.writeText(input.value); this.ui.toast('Session code copied.'); }
    catch { input.focus(); input.select(); this.ui.toast('Select and copy the session code.'); }
  }
  connect(kind: 'create' | 'join') {
    if (this.socket || this.reconnectTimer) return;
    const value = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
    try {
      const url = new URL(value('netServer'));
      if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.hash)
        throw Error('Use a ws:// or wss:// server address without credentials.');
      if (location.protocol === 'https:' && url.protocol !== 'wss:') throw Error('HTTPS pages require a wss:// server.');
      const code = value('netCode').trim().toUpperCase();
      if (kind === 'join' && !/^[A-F0-9]{10}$/.test(code)) throw Error('Enter the ten-character session code.');
      this.serverUrl = url.href; this.code = code; this.resumeToken = ''; this.clearResume();
      if (code) this.rememberCode();
      this.ui.audio.unlock();
      this.lastTick = -1; this.request = 0; this.started = false; this.receivedAt = performance.now();
      this.connectionAttempt = 0;
      for (const id of ['netCreate', 'netJoin', 'netServer', 'netMap', 'netFaction'])
        (document.getElementById(id) as HTMLInputElement).disabled = true;
      (document.getElementById('netCode') as HTMLInputElement).readOnly = true;
      const message = { type: kind, version: MULTIPLAYER_VERSION, map: value('netMap'), faction: Number(value('netFaction')), code };
      this.openSocket(message, false);
      this.startWatchdog();
    } catch (error) {
      this.setConnectionPhase('ended', error instanceof Error ? error.message : String(error));
      this.diagnose('connect_rejected', { reason: error instanceof Error ? error.name : 'UnknownError' });
    }
  }
  private startWatchdog() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
        if (!this.socket) return;
        const silenceMs = performance.now() - this.receivedAt;
        if (silenceMs > 35000) {
          this.diagnose('client_timeout', { phase: this.connectionPhase, silenceMs: Math.round(silenceMs) });
          this.socket.close(4002, 'Client timeout');
        }
    }, 5000);
  }
  private openSocket(message: Record<string, unknown>, reconnect: boolean) {
    const socket = this.socket = new WebSocket(this.serverUrl), inbox: Record<string, unknown>[] = [];
    let receiving = false;
    const drain = async () => {
      if (receiving) return;
      receiving = true;
      try {
        while (socket === this.socket && inbox.length) await this.receive(inbox.shift()!, socket);
      } catch (error) {
        if (socket === this.socket) this.end(String(error));
      } finally {
        receiving = false;
        if (socket === this.socket && inbox.length) void drain();
      }
    };
    this.receivedAt = performance.now();
    if (reconnect) this.connectionAttempt++;
    this.setConnectionPhase(reconnect ? 'reconnecting' : 'connecting',
      reconnect ? `Connection interrupted · reconnecting (attempt ${this.connectionAttempt})…` : 'Connecting…');
    this.diagnose(reconnect ? 'reconnect_attempt' : 'connect_attempt', { attempt: reconnect ? this.connectionAttempt : 1 });
    socket.onopen = () => {
      if (socket !== this.socket) return;
      this.setConnectionPhase(reconnect ? 'reconnecting' : 'handshake', reconnect ? 'Reconnected · restoring session…' : 'Connected · negotiating session…');
      this.diagnose('socket_open', { attempt: this.connectionAttempt, reconnect });
      socket.send(JSON.stringify(message));
    };
    socket.onmessage = event => {
      if (socket !== this.socket) return;
      this.receivedAt = performance.now(); this.persistResume();
      try {
        if (typeof event.data !== 'string' || event.data.length > 4 * 1024 * 1024) throw Error('Invalid server message');
        const incoming = JSON.parse(event.data) as Record<string, unknown>;
        // Preserve server order across asynchronous map preparation. Consecutive queued
        // full views are replaceable; retaining only the newest bounds resume backlog.
        if (incoming.type === 'frame' && inbox.at(-1)?.type === 'frame') inbox[inbox.length - 1] = incoming;
        else inbox.push(incoming);
        void drain();
      } catch { this.end('Invalid server message.'); }
    };
    socket.onerror = () => {
      if (socket === this.socket) this.diagnose('socket_error', { readyState: socket.readyState,
        bufferedAmount: socket.bufferedAmount, silenceMs: Math.round(performance.now() - this.receivedAt) });
    };
    socket.onclose = event => {
      if (socket !== this.socket) return;
      this.socket = null; this.preparation++; this.stopReplay();
      const closedPhase = this.connectionPhase;
      this.diagnose('socket_close', { code: event.code, clean: event.wasClean,
        phase: closedPhase, silenceMs: Math.round(performance.now() - this.receivedAt) });
      if (this.resumeToken && closedPhase !== 'reconnecting') this.reconnectUntil = performance.now() + this.resumeGraceMs;
      if (this.resumeToken && closedPhase !== 'ended' && performance.now() < this.reconnectUntil) this.scheduleReconnect();
      else this.end('Connection lost. The session has ended.', 'transport_close');
    };
  }
  private scheduleReconnect(delayOverride?: number) {
    if (this.reconnectTimer || !this.resumeToken || this.socket) return;
    this.setConnectionPhase('reconnecting', `Connection interrupted · reconnecting (attempt ${this.connectionAttempt + 1})…`);
    const delays = [250, 1000, 2000, 4000, 5000];
    const delay = delayOverride ?? delays[Math.min(this.connectionAttempt, delays.length - 1)];
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.resumeToken || performance.now() >= this.reconnectUntil) {
        this.end('The reconnection window expired.', 'resume_expired'); return;
      }
      this.openSocket({ type: 'resume', version: MULTIPLAYER_VERSION, code: this.code, token: this.resumeToken }, true);
    }, delay);
  }
  private retryReconnectNow() {
    if (this.connectionPhase !== 'reconnecting' || this.socket || !this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer); this.reconnectTimer = null; this.scheduleReconnect(0);
  }
  get renderTime() { return this.timeline.time; }
  displayEntity(entity: Entity): Entity { return this.timeline.poses.get(entity.id) ?? entity; }
  takeSnapshotCount() { const count = this.receivedFrames; this.receivedFrames = 0; return count; }
  updatePresentation(now: number) {
    if (this.ui.game.networkTeam === null) return;
    if (document.hidden) this.wasHidden = true;
    else if (this.wasHidden) {
      this.timeline.clearEffects(); this.ui.game.effects.reset(); this.wasHidden = false;
    }
    const due: MultiplayerEffect[] = [];
    const delta = this.timeline.advance(now, event => due.push(event));
    this.ui.game.effects.tick(delta);
    for (const event of due) this.playEffect(event);
  }
  private playEffect(event: MultiplayerEffect) {
    const game = this.ui.game, fx = game.effects, audible = !this.ui.paused && !document.hidden;
    switch (event.kind) {
      case 'shot':
        if (event.travel) fx.shell(event.source, event.target, event.travel);
        else fx.shot(event.source, event.target, game.localTeam);
        if (audible) this.ui.event('shot', { ...event.source, heavy: event.source.type === 'tank' || event.source.type === 'destroyer' || !!event.travel });
        break;
      case 'sound': if (audible) this.ui.event('shot', { ...event.point, heavy: event.heavy }); break;
      case 'explosion':
        fx.explosion(event.point.x, event.point.z, event.size, event.color);
        if (audible) this.ui.event('explosion', { ...event.point, big: event.big });
        break;
      case 'healing': fx.healing(event.source, event.target); break;
      case 'mining': fx.mining(event.source, event.target, 1, () => true); break;
      case 'construction': fx.construction(event.source, event.target, 1); break;
      case 'damage': fx.damageNumber(event.point, event.amount, game.localTeam); break;
      case 'drop': fx.drop(event.point, event.color, event.team); break;
      case 'notice': {
        if (!audible) break; // No delayed sound/radio burst when returning from a hidden tab/menu.
        if (event.event[0] === 'trained') {
          this.ui.audio.sound('trained'); this.ui.actionSignature = '';
          if (event.event[1].type === 'hero') this.ui.radio('Expedition command|Commander reconstructed and ready.');
        } else if (['toast', 'radio', 'alert', 'complete', 'queued', 'scan', 'heal'].includes(event.event[0])) {
          // Keep this runtime allowlist even with typed server payloads: network events must never reach start/result persistence.
          this.ui.event(...event.event);
        }
        break;
      }
    }
    fx.trim(500);
  }
  private status(text: string) {
    const element = document.getElementById('netStatus');
    if (element) element.textContent = text;
    else this.ui.toast(text);
  }
  private setConnectionPhase(phase: typeof this.connectionPhase, text?: string) {
    const previous = this.connectionPhase;
    this.connectionPhase = phase;
    const element = document.getElementById('netStatus');
    if (element) element.dataset.phase = phase;
    if (text) this.status(text);
    if (previous !== phase) this.diagnose('phase', { from: previous, to: phase, attempt: this.connectionAttempt });
  }
  private diagnose(event: string, fields: Record<string, unknown> = {}) {
    if (typeof console !== 'undefined') console.info('[multiplayer]', { event, at: Date.now(), ...fields });
  }
  private acceptCredentials(message: Record<string, unknown>) {
    if (typeof message.token !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(message.token) ||
        !Number.isSafeInteger(message.graceMs) || Number(message.graceMs) < 1000 || Number(message.graceMs) > 120000)
      throw Error('Invalid session credentials');
    this.resumeToken = message.token; this.resumeGraceMs = Number(message.graceMs);
  }
  private async prepareSession(start: MultiplayerStart, socket: WebSocket, sendReady = true) {
    const game = this.ui.game;
    if (start.version !== MULTIPLAYER_VERSION || !Object.hasOwn(BATTLEFIELDS, start.map) ||
        ![0, 1].includes(start.team) || !Number.isSafeInteger(start.seed) || start.seed <= 0 ||
        !/^[A-F0-9]{10}$/.test(start.code) ||
        !Array.isArray(start.factions) || start.factions.length !== 2 || start.factions.some(f => ![0, 1, 2].includes(f)))
      throw Error('Incompatible session');
    this.code = start.code;
    if (game.networkTeam !== null) {
      if (game.networkTeam !== start.team || game.s?.seed !== start.seed || game.s.map !== start.map ||
          game.s.parties.some((party, index) => party.faction !== start.factions[index])) throw Error('Resumed session does not match');
      if (sendReady && socket === this.socket) socket.send(JSON.stringify({ type: 'ready' }));
      return socket === this.socket;
    }
    const preparation = ++this.preparation;
    this.preparing = true; this.setConnectionPhase('preparing');
    this.status(`Preparing ${BATTLEFIELDS[start.map].name}…`);
    const prepared = await this.prepare(start.map);
    if (preparation !== this.preparation || socket !== this.socket) return false;
    this.preparing = false;
    if (!prepared) throw Error('Map preparation failed');
    game.world = new Battlefield(start.seed, start.map, 2);
    game.world.selectView(start.team);
    game.networkTeam = start.team;
    game.networkSubmit = action => this.submit(action);
    game.effects.reset();
    game.s = { seed: start.seed, map: start.map, depth: 0, time: 0, nextId: 0,
      parties: start.factions.map((f, id) => { const p = createParty(id as PlayerTeam, f, {}, {});
        p.account.alloy = p.account.gas = p.account.energy = 0; return p; }),
      rules: { kind: 'scenario', duration: 3600, hostilities: [[false, true], [true, false]] },
      stopped: false, result: null, entities: [], scans: [], strikes: [], fields: [], recalls: [], triggers: {},
      stats: { kills: 0, structuresDestroyed: 0, lost: 0, trained: 0, gathered: 0, built: 0, damage: 0 },
      speed: 1, cam: { x: 0, z: 0, zoom: 48 } };
    game.resetRandom(start.seed);
    if (sendReady) socket.send(JSON.stringify({ type: 'ready' }));
    return true;
  }
  private async receive(message: Record<string, unknown>, socket: WebSocket) {
    const game = this.ui.game;
    switch (message.type) {
      case 'waiting': {
        this.acceptCredentials(message);
        this.setConnectionPhase('waiting');
        this.code = String(message.code); this.rememberCode(); this.persistResume(true);
        (document.getElementById('netCode') as HTMLInputElement).value = this.code;
        this.status(`Session ${this.code} · ${BATTLEFIELDS[message.map as BattlefieldId].name} · waiting for the second player…`);
        break;
      }
      case 'ping': break;
      case 'error': case 'end': this.end(String(message.message)); break;
      case 'start': {
        const start = message as unknown as MultiplayerStart;
        this.acceptCredentials(start as unknown as Record<string, unknown>);
        await this.prepareSession(start, socket); this.rememberCode(); this.persistResume(true);
        break;
      }
      case 'resumed': {
        this.acceptCredentials(message);
        // Store the proposed token before acknowledging it; a reload during map preparation must not retain the invalidated token.
        this.persistResume(true);
        socket.send(JSON.stringify({ type: 'resume_ack', token: this.resumeToken }));
        if (!Number.isSafeInteger(message.lastRequest) || Number(message.lastRequest) < 0 || Number(message.lastRequest) > this.request ||
            !['waiting', 'loading', 'playing'].includes(String(message.phase))) throw Error('Invalid resume state');
        if (message.phase === 'waiting') {
          this.setConnectionPhase('waiting', `Session ${this.code} · reconnected · waiting for the second player…`);
        } else {
          if (!message.start || typeof message.start !== 'object') throw Error('Missing resumed session');
          const start = message.start as unknown as MultiplayerStart;
          this.acceptCredentials(start as unknown as Record<string, unknown>);
          if (!await this.prepareSession(start, socket, message.phase === 'loading') || socket !== this.socket) return;
          if (message.phase === 'playing') {
            if (game.networkTeam === null) throw Error('Cannot restore an unprepared session');
            this.timeline.reset(); game.effects.reset(); this.lastTick = -1;
            this.setConnectionPhase('reconnecting', 'Session restored · synchronizing state…');
          }
        }
        if (socket !== this.socket) return;
        this.stopReplay();
        this.replay = [...this.pending.keys()].filter(request => request > Number(message.lastRequest));
        this.replayNext(socket);
        this.diagnose('resume_succeeded', { attempt: this.connectionAttempt, phase: message.phase,
          pendingRequests: this.pending.size, lastRequest: message.lastRequest });
        this.connectionAttempt = 0; this.rememberCode(); this.persistResume(true);
        break;
      }
      case 'presence': {
        if (message.connected === false) this.ui.toast('Other player disconnected · waiting for reconnection.');
        else if (message.connected === true) this.ui.toast('Other player reconnected.');
        break;
      }
      case 'frame': {
        if (!game.s || game.networkTeam === null) throw Error('Frame before session start');
        const frame = message as unknown as MultiplayerFrame;
        if (!Number.isSafeInteger(frame.tick) || frame.tick <= this.lastTick) return;
        if (frame.party.id !== game.networkTeam || !Number.isFinite(frame.time) || !Array.isArray(frame.entities) || frame.entities.length > 10000 ||
            !Array.isArray(frame.effects) || frame.effects.length > 256 || !Array.isArray(frame.strikes))
          throw Error('Invalid party view');
        applyMultiplayerFog(game.world!, game.networkTeam, frame.fog);
        game.s.time = frame.time;
        game.s.parties[game.networkTeam] = frame.party;
        game.s.entities = frame.entities;
        game.s.scans = frame.scans; game.s.fields = frame.fields; game.s.strikes = frame.strikes;
        if (document.hidden) this.wasHidden = true;
        this.timeline.push(document.hidden ? { ...frame, effects: [] } : frame, performance.now());
        this.receivedFrames++;
        game.ids = new Map(frame.entities.map(e => [e.id, e]));
        game.world!.rebuild(frame.entities);
        game.rehash();
        this.lastTick = frame.tick;
        if (!this.started) {
          this.started = true;
          this.setConnectionPhase('playing');
          const home = frame.entities.find(e => e.team === game.networkTeam && e.type === 'hq') ||
            frame.entities.find(e => e.team === game.networkTeam && e.type === 'worker');
          if (home) { game.s.cam.x = home.x; game.s.cam.z = home.z; }
          this.ui.event('start', {});
          this.ui.toast(`Session ${this.code} · server time · menus do not pause`);
        } else if (this.connectionPhase === 'reconnecting') {
          this.setConnectionPhase('playing');
          this.ui.toast('Session restored.');
        }
        break;
      }
      case 'accepted': break; // Admission is not execution; keep the request pending.
      case 'outcome': {
        const action = this.pending.get(Number(message.request));
        if (!action) break; // A retained result can be replayed after another reconnect.
        this.pending.delete(Number(message.request));
        if (message.status !== 'applied') this.ui.toast('Command rejected by the server.');
        else if (action.kind === 'order') this.ui.event('order', { ...action.order, count: action.ids.length });
        break;
      }
    }
  }
  private submit(action: BattleAction): boolean {
    if (!this.started || this.replay.length || this.replayTimer || this.connectionPhase !== 'playing' || this.socket?.readyState !== WebSocket.OPEN ||
        this.pending.size >= 64 || this.socket.bufferedAmount > 65536) return false;
    const request = ++this.request;
    this.pending.set(request, action); this.persistResume(true);
    this.socket.send(JSON.stringify({ type: 'action', request, action }));
    return true;
  }
  disconnect(cause = 'user_leave') {
    const hadSession = !!this.resumeToken;
    const socket = this.socket; this.socket = null; this.preparation++; this.stopReplay();
    if (this.timer) clearInterval(this.timer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.timer = null; this.reconnectTimer = null;
    this.diagnose('disconnect', { cause, phase: this.connectionPhase, pendingRequests: this.pending.size });
    if (cause === 'user_leave' && socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'leave' }));
    socket?.close(1000, cause === 'user_leave' ? 'Client left' : 'Client cleanup');
    this.pending.clear(); this.started = false; this.preparing = false;
    this.timeline.reset(); this.receivedFrames = 0; this.wasHidden = false;
    if (this.ui.game.networkTeam !== null) this.ui.game.effects.reset();
    this.ui.game.networkSubmit = undefined; this.ui.game.networkTeam = null;
    this.connectionPhase = 'idle'; this.connectionAttempt = 0; this.resumeToken = ''; this.reconnectUntil = 0;
    if (hadSession || cause !== 'user_leave') this.clearResume();
  }
  private end(message: string, cause = 'server_end') {
    this.setConnectionPhase('ended');
    this.disconnect(cause);
    this.ui.showHome();
    this.ui.toast(message);
  }
}
