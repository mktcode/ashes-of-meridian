/* Optional WebSocket client; offline play never opens a connection. */
'use strict';
class MeridianMultiplayerClient {
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
  private connectionPhase: 'idle' | 'connecting' | 'handshake' | 'waiting' | 'preparing' | 'playing' | 'ended' = 'idle';
  private pending = new Map<number, BattleAction>();
  constructor(private ui: MeridianUI, private prepare: (map: BattlefieldId) => Promise<boolean>) {}
  show() {
    this.ui.showHome();
    $('menu').innerHTML = `<div class="subscreen"><header class="sub-header"><div><div class="eyebrow">TWO-PLAYER PROTOTYPE</div><h1>Multiplayer.</h1></div><button class="textbtn" data-ui="home">← MAIN MENU</button></header>
      <div style="max-width:640px;margin:auto"><p>Two human parties, no expedition rewards. Leaving or losing a connection ends the session for both players. Menus do not pause the server.</p>
      <div class="settings-row"><label for="netServer">Server address</label><input id="netServer" type="url" value="${esc(this.serverUrl)}" placeholder="wss://your-server.example"></div>
      <div class="settings-row"><label for="netFaction">Your faction</label><select id="netFaction">${FACTIONS.map((f,i) => `<option value="${i}">${esc(f.name)}</option>`).join('')}</select></div>
      <div class="settings-row"><label for="netMap">Map (session creator)</label><select id="netMap">${contentKeys(BATTLEFIELDS).map(id => `<option value="${id}">${esc(BATTLEFIELDS[id].name)}</option>`).join('')}</select></div>
      <div class="launch-row"><button id="netCreate" class="primary" data-ui="networkCreate">CREATE SESSION</button></div>
      <div class="settings-row"><label for="netCode">Session code</label><input id="netCode" maxlength="10" autocomplete="off" spellcheck="false" placeholder="Code from your friend"></div>
      <div class="launch-row"><button id="netJoin" class="primary" data-ui="networkJoin">JOIN SESSION</button><button class="secondary" data-ui="networkCopy">COPY CODE</button></div>
      <p id="netStatus" role="status">Start the separate multiplayer server, then create or join a session.</p></div></div>`;
  }
  async copyCode() {
    const input = document.getElementById('netCode') as HTMLInputElement | null;
    if (!input?.value) return;
    try { await navigator.clipboard.writeText(input.value); this.ui.toast('Session code copied.'); }
    catch { input.focus(); input.select(); this.ui.toast('Select and copy the session code.'); }
  }
  connect(kind: 'create' | 'join') {
    if (this.socket) return;
    const value = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
    try {
      const url = new URL(value('netServer'));
      if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.hash)
        throw Error('Use a ws:// or wss:// server address without credentials.');
      if (location.protocol === 'https:' && url.protocol !== 'wss:') throw Error('HTTPS pages require a wss:// server.');
      const code = value('netCode').trim().toUpperCase();
      if (kind === 'join' && !/^[A-F0-9]{10}$/.test(code)) throw Error('Enter the ten-character session code.');
      this.serverUrl = url.href;
      this.ui.audio.unlock();
      const socket = this.socket = new WebSocket(url.href);
      this.lastTick = -1; this.request = 0; this.started = false; this.receivedAt = performance.now();
      this.connectionAttempt = 1;
      this.setConnectionPhase('connecting', `Connecting… (attempt ${this.connectionAttempt})`);
      this.diagnose('connect_attempt', { attempt: this.connectionAttempt });
      for (const id of ['netCreate', 'netJoin', 'netServer', 'netMap', 'netFaction'])
        (document.getElementById(id) as HTMLInputElement).disabled = true;
      (document.getElementById('netCode') as HTMLInputElement).readOnly = true;
      const message = { type: kind, version: MULTIPLAYER_VERSION, map: value('netMap'), faction: Number(value('netFaction')), code };
      socket.onopen = () => {
        if (socket !== this.socket) return;
        this.setConnectionPhase('handshake', 'Connected · negotiating session…');
        this.diagnose('socket_open', { attempt: this.connectionAttempt });
        socket.send(JSON.stringify(message));
      };
      socket.onmessage = event => {
        if (socket !== this.socket) return;
        this.receivedAt = performance.now();
        try {
          if (typeof event.data !== 'string' || event.data.length > 4 * 1024 * 1024) throw Error('Invalid server message');
          void this.receive(JSON.parse(event.data), socket).catch(error => { if (socket === this.socket) this.end(String(error)); });
        } catch { this.end('Invalid server message.'); }
      };
      socket.onerror = () => {
        if (socket === this.socket) this.diagnose('socket_error', { readyState: socket.readyState,
          bufferedAmount: socket.bufferedAmount, silenceMs: Math.round(performance.now() - this.receivedAt) });
      };
      socket.onclose = event => {
        if (socket !== this.socket) return;
        this.diagnose('socket_close', { code: event.code, reason: event.reason.slice(0, 123), clean: event.wasClean,
          phase: this.connectionPhase, silenceMs: Math.round(performance.now() - this.receivedAt) });
        this.end('Connection lost. The session has ended.', 'transport_close');
      };
      this.timer = setInterval(() => {
        const silenceMs = performance.now() - this.receivedAt;
        if (silenceMs > 45000) {
          this.diagnose('client_timeout', { phase: this.connectionPhase, silenceMs: Math.round(silenceMs) });
          this.end('Server timed out. The session has ended.', 'client_timeout');
        }
      }, 5000);
    } catch (error) {
      this.setConnectionPhase('ended', error instanceof Error ? error.message : String(error));
      this.diagnose('connect_rejected', { reason: error instanceof Error ? error.name : 'UnknownError' });
    }
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
        if (audible) this.ui.event('shot', { ...event.source, heavy: event.source.type === 'tank' || !!event.travel });
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
    if (fx.fx.length > 500) fx.fx.splice(0, fx.fx.length - 500);
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
  private async receive(message: Record<string, unknown>, socket: WebSocket) {
    const game = this.ui.game;
    switch (message.type) {
      case 'waiting': {
        this.setConnectionPhase('waiting');
        this.code = String(message.code);
        (document.getElementById('netCode') as HTMLInputElement).value = this.code;
        this.status(`Session ${this.code} · ${BATTLEFIELDS[message.map as BattlefieldId].name} · waiting for the second player…`);
        break;
      }
      case 'ping': break;
      case 'error': case 'end': this.end(String(message.message)); break;
      case 'start': {
        if (this.started || this.preparing || game.networkTeam !== null) throw Error('Duplicate session start');
        this.preparing = true;
        this.setConnectionPhase('preparing');
        const start = message as unknown as MultiplayerStart;
        if (start.version !== MULTIPLAYER_VERSION || !Object.hasOwn(BATTLEFIELDS, start.map) ||
            ![0, 1].includes(start.team) || !Number.isSafeInteger(start.seed) || start.seed <= 0 ||
            !/^[A-F0-9]{10}$/.test(start.code) ||
            !Array.isArray(start.factions) || start.factions.length !== 2 || start.factions.some(f => ![0, 1, 2].includes(f)))
          throw Error('Incompatible session');
        this.code = start.code;
        this.status(`Preparing ${BATTLEFIELDS[start.map].name}…`);
        if (!await this.prepare(start.map) || socket !== this.socket) return;
        game.world = new Battlefield(start.seed, start.map, 2);
        game.world.selectView(start.team);
        game.networkTeam = start.team;
        game.networkSubmit = action => this.submit(action);
        game.effects.reset();
        game.s = { seed: start.seed, map: start.map, depth: 0, time: 0, nextId: 0,
          parties: start.factions.map((f, id) => { const p = createParty(id as PlayerTeam, f, {}, {});
            p.account.alloy = p.account.gas = p.account.energy = 0; return p; }),
          rules: { kind: 'scenario', duration: 3600, hostilities: [[false, true], [true, false]] },
          stopped: false, result: null, entities: [], scans: [], strikes: [], fields: [], triggers: {},
          stats: { kills: 0, lost: 0, trained: 0, gathered: 0, built: 0, damage: 0 },
          speed: 1, cam: { x: 0, z: 0, zoom: 48 } };
        game.resetRandom(start.seed);
        socket.send(JSON.stringify({ type: 'ready' }));
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
          const home = frame.entities.find(e => e.team === game.networkTeam && e.type === 'hq');
          if (home) { game.s.cam.x = home.x; game.s.cam.z = home.z; }
          this.ui.event('start', {});
          this.ui.toast(`Session ${this.code} · server time · menus do not pause`);
        }
        break;
      }
      case 'accepted': break; // Admission is not execution; keep the request pending.
      case 'outcome': {
        const action = this.pending.get(Number(message.request));
        this.pending.delete(Number(message.request));
        if (message.status !== 'applied') this.ui.toast('Command rejected by the server.');
        else if (action?.kind === 'order') this.ui.event('order', { ...action.order, count: action.ids.length });
        break;
      }
    }
  }
  private submit(action: BattleAction): boolean {
    if (!this.started || this.socket?.readyState !== WebSocket.OPEN || this.pending.size >= 64 || this.socket.bufferedAmount > 65536) return false;
    const request = ++this.request;
    this.pending.set(request, action);
    this.socket.send(JSON.stringify({ type: 'action', request, action }));
    return true;
  }
  disconnect(cause = 'user_leave') {
    const socket = this.socket; this.socket = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.diagnose('disconnect', { cause, phase: this.connectionPhase, pendingRequests: this.pending.size });
    socket?.close(1000, cause === 'user_leave' ? 'Client left' : 'Client cleanup');
    this.pending.clear(); this.started = false; this.preparing = false;
    this.timeline.reset(); this.receivedFrames = 0; this.wasHidden = false;
    if (this.ui.game.networkTeam !== null) this.ui.game.effects.reset();
    this.ui.game.networkSubmit = undefined; this.ui.game.networkTeam = null;
    this.connectionPhase = 'idle'; this.connectionAttempt = 0;
  }
  private end(message: string, cause = 'server_end') {
    this.setConnectionPhase('ended');
    this.disconnect(cause);
    this.ui.showHome();
    this.ui.toast(message);
  }
}
