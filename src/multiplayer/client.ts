/* Optional WebSocket client; offline play never opens a connection. */
'use strict';
class MeridianMultiplayerClient {
  socket: WebSocket | null = null;
  code = '';
  serverUrl = 'ws://localhost:8787';
  private request = 0;
  private lastTick = -1;
  private started = false;
  private preparing = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private receivedAt = 0;
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
      this.status('Connecting…');
      for (const id of ['netCreate', 'netJoin', 'netServer', 'netMap', 'netFaction'])
        (document.getElementById(id) as HTMLInputElement).disabled = true;
      (document.getElementById('netCode') as HTMLInputElement).readOnly = true;
      const message = { type: kind, version: MULTIPLAYER_VERSION, map: value('netMap'), faction: Number(value('netFaction')), code };
      socket.onopen = () => { if (socket === this.socket) socket.send(JSON.stringify(message)); };
      socket.onmessage = event => {
        if (socket !== this.socket) return;
        this.receivedAt = performance.now();
        try {
          if (typeof event.data !== 'string' || event.data.length > 4 * 1024 * 1024) throw Error('Invalid server message');
          void this.receive(JSON.parse(event.data), socket).catch(error => { if (socket === this.socket) this.end(String(error)); });
        } catch { this.end('Invalid server message.'); }
      };
      socket.onerror = () => { if (socket === this.socket) this.end('Server connection failed. Check address, TLS and server availability.'); };
      socket.onclose = () => { if (socket === this.socket) this.end('Connection lost. The session has ended.'); };
      this.timer = setInterval(() => {
        if (performance.now() - this.receivedAt > 45000) this.end('Server timed out. The session has ended.');
      }, 5000);
    } catch (error) { this.status(error instanceof Error ? error.message : String(error)); }
  }
  private status(text: string) {
    const element = document.getElementById('netStatus');
    if (element) element.textContent = text;
    else this.ui.toast(text);
  }
  private async receive(message: Record<string, unknown>, socket: WebSocket) {
    const game = this.ui.game;
    switch (message.type) {
      case 'waiting': {
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
        socket.send(JSON.stringify({ type: 'ready' }));
        break;
      }
      case 'frame': {
        if (!game.s || game.networkTeam === null) throw Error('Frame before session start');
        const frame = message as unknown as MultiplayerFrame;
        if (!Number.isSafeInteger(frame.tick) || frame.tick <= this.lastTick) return;
        if (frame.party.id !== game.networkTeam || !Number.isFinite(frame.time) || !Array.isArray(frame.entities) || frame.entities.length > 10000)
          throw Error('Invalid party view');
        applyMultiplayerFog(game.world!, game.networkTeam, frame.fog);
        game.s.time = frame.time;
        game.s.parties[game.networkTeam] = frame.party;
        game.s.entities = frame.entities;
        game.s.scans = frame.scans; game.s.fields = frame.fields;
        game.ids = new Map(frame.entities.map(e => [e.id, e]));
        game.world!.rebuild(frame.entities);
        game.rehash();
        this.lastTick = frame.tick;
        if (!this.started) {
          this.started = true;
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
  disconnect() {
    const socket = this.socket; this.socket = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    socket?.close();
    this.pending.clear(); this.started = false; this.preparing = false;
    this.ui.game.networkSubmit = undefined; this.ui.game.networkTeam = null;
  }
  private end(message: string) {
    this.disconnect();
    this.ui.showHome();
    this.ui.toast(message);
  }
}
