    /* Front end, permanent upgrades, HUD, controls, field manual. */
    'use strict';
    function $(id: 'world' | 'overlay' | 'minimap'): HTMLCanvasElement;
    function $(id: string): HTMLElement;
    function $(id: string): HTMLElement { return document.getElementById(id)!; }
    const esc = (s: unknown) =>
      String(s ?? '').replace(
        /[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]
      );
    type UIMode = { kind: 'build'; arg: BuildingType } | { kind: 'ability'; arg: AbilityType } | { kind: 'rally'; arg?: undefined };
    type UITab = 'root' | 'build' | 'infantry' | 'vehicles' | 'aircraft' | 'building';
    interface UIPing extends Position { life: number; maxLife: number; color: number; }
    interface BattleIntro {
      elapsed: number;
      hold: number;
      travel: number;
      enemy: Position;
      home: Position;
      visibleEntityIds: Set<number>;
      objectiveShown: boolean;
      pendingRadio?: string;
    }
    class MeridianUI {
      persistence: MeridianPersistence;
      game: MeridianGame;
      R: MeridianRenderer;
      audio: MeridianAudio;
      profile: MeridianProfile;
      expedition: MeridianExpedition | null;
      view: 'home' | 'battle' | 'transition' | 'game';
      paused: boolean;
      modalKind: string;
      sellBuildingId: number | null;
      selected: number[];
      selectedLookupSource: number[];
      selectedLookup: Set<number>;
      tab: UITab;
      attackMove: boolean;
      mode: UIMode | null;
      hover: number | null;
      pointer: { x: number; y: number; inside: boolean };
      drag: { sx: number; sy: number; x: number; y: number; button: number; type: string; moved: boolean } | null;
      pings: UIPing[];
      lastClick: Partial<{ id: number; type: string; time: number; count: number }>;
      radioUntil: number;
      toastUntil: number;
      actionSignature: string;
      factionJustUnlocked: FactionId | null;
      hudClock: number;
      touchPoints: Map<number, {x: number; y: number}>;
      battleFaction?: FactionId;
      resultAetherRecovered?: number;
      resultBenefit?: string;
      onViewportChange?: () => void;
      multiplayer?: MeridianMultiplayerClient;
      onPreview?: (map?: BattlefieldId) => void;
      onLaunchBattle?: (options: BattleOptions) => void;
      domPressed?: boolean;
      touchGesture?: boolean;
      pinchDist?: number;
      queueSignature?: string;
      queueInputs?: (number | UnitType)[];
      miniBuffer?: HTMLCanvasElement;
      miniCtx?: CanvasRenderingContext2D;
      miniImage?: ImageData;
      battleIntro: BattleIntro | null;
      battleTutorial: BattleTutorialState | null;
      constructor(game: MeridianGame, renderer: MeridianRenderer, audio: MeridianAudio, profile: MeridianProfile, persistence: MeridianPersistence) {
        this.persistence = persistence;
        this.game = game;
        this.R = renderer;
        this.audio = audio;
        this.profile = profile;
        this.expedition = this.persistence.loadExpedition?.() || null;
        this.view = 'home';
        this.paused = true;
        this.modalKind = '';
        this.sellBuildingId = null;
        this.selected = [];
        this.selectedLookupSource = this.selected;
        this.selectedLookup = new Set();
        this.tab = 'root';
        this.attackMove = false;
        this.mode = null;
        this.hover = null;
        this.pointer = { x: innerWidth / 2, y: innerHeight / 2, inside: false };
        this.drag = null;
        this.pings = [];
        this.lastClick = {};
        this.radioUntil = 0;
        this.toastUntil = 0;
        this.actionSignature = '';
        this.factionJustUnlocked = null;
        this.hudClock = 0;
        this.touchPoints = new Map();
        this.battleIntro = null;
        this.battleTutorial = null;
        this.bind();
      }
      get localTeam(): PlayerTeam { return this.game.localTeam; }
      selectionIds() {
        if (this.selectedLookupSource !== this.selected) {
          this.selectedLookupSource = this.selected;
          this.selectedLookup = new Set(this.selected);
        }
        return this.selectedLookup;
      }
      persist() {
        this.persistence.saveProfile(this.profile);
      }
      toast(text: string) {
        $('toast').textContent = text;
        $('toast').classList.add('show');
        this.toastUntil = performance.now() + 3500;
      }
      alert(data: GameEventMap['alert']) {
        let d = typeof data === 'string' ? { text: data } : data,
          el = document.createElement('div');
        el.className = 'alert' + (d.danger ? ' danger' : '');
        el.textContent = d.text;
        $('alerts').appendChild(el);
        if (Number.isFinite(d.x)) {
          el.style.pointerEvents = 'auto';
          el.style.cursor = 'pointer';
          el.onclick = () => this.center(d.x!, d.z!);
        }
        setTimeout(() => el.remove(), 5800);
        while ($('alerts').children.length > 5) $('alerts').firstChild!.remove();
      }
      radio(text: string) {
        if (!text) return;
        let parts = text.split('|'),
          name = parts.length > 1 ? parts[0] : 'Expedition command',
          body = parts.length > 1 ? parts.slice(1).join('|') : parts[0];
        $('radioName').textContent = name + ' / SECURE CHANNEL';
        $('radioText').textContent = body;
        $('radio').classList.remove('hidden');
        $('radio').querySelector('.radio-avatar')!.firstChild!.textContent = name
          .split(' ')
          .map(w => w[0])
          .slice(0, 2)
          .join('');
        this.radioUntil = performance.now() + Math.max(7000, body.length * 54);
        this.audio.sound('radio');
      }
      event(...[type, data]: GameEvent) {
        if (type === 'start') {
          this.view = 'game';
          this.audio.resetBattleMusic?.();
          this.factionJustUnlocked = null;
          this.resultAetherRecovered = undefined;
          this.resultBenefit = undefined;
          this.paused = false;
          this.modalKind = '';
          this.sellBuildingId = null;
          this.lastClick = {};
          $('menu').classList.add('hidden');
          $('modal').classList.add('hidden');
          $('result').classList.add('hidden');
          $('hud').classList.remove('hidden');
          $('worldViewport').classList.remove('result-backdrop');
          $('worldViewport').classList.add('in-battle');
          if (this.onViewportChange) this.onViewportChange();
          $('radio').classList.add('hidden');
          $('alerts').innerHTML = '';
          this.selected = [];
          this.attackMove = false;
          $('attackMoveBtn').setAttribute('aria-pressed', 'false');
          this.mode = null;
          this.tab = 'root';
          this.actionSignature = '';
          this.battleTutorial = null;
          this.beginBattleIntro();
          if (!this.battleIntro) this.beginBattleTutorial();
          this.audio.setMode?.(this.battleIntro ? 'silent' : 'battle');
          this.updateHUD();
          this.clearMode();
        } else if (type === 'toast') this.toast(data);
        else if (type === 'radio') {
          if (this.battleIntro) this.battleIntro.pendingRadio = data;
          else this.radio(data);
        }
        else if (type === 'alert') this.alert(data);
        else if (type === 'order') {
          this.audio.sound('order');
          if (Number.isFinite(data.x))
            this.pings.push({
              x: data.x!,
              z: data.z!,
              life: 1,
              maxLife: 1,
              color:
                data.type === 'attackMove' || data.type === 'attack'
                  ? 0xeebc81
                  : FACTIONS[this.game.s!.parties[this.localTeam].faction].color
            });
        } else if (type === 'result') {
          this.battleTutorial = null;
          const firstResult = this.resultAetherRecovered === undefined;
          let profileChanged = false;
          this.factionJustUnlocked = null;
          if (firstResult) {
            let level = Math.min(AETHER_EVACUATION_CAPS.length - 1, Math.max(0, Math.floor(this.game.s?.parties[0].meta?.aetherEvacuation || 0))),
              limit = AETHER_EVACUATION_CAPS[level];
            this.resultAetherRecovered = Math.min(limit, Math.max(0, Math.floor(this.game.s?.parties[0].account.gas || 0)));
            if (this.resultAetherRecovered) {
              this.profile.aether = Math.min(999999, this.profile.aether + this.resultAetherRecovered);
              profileChanged = true;
            }
            if (data.win && this.expedition) {
              const previousUnlock = this.unlockedFactionForDepth(this.profile.expeditionDepth);
              this.expedition.depth++;
              if (this.expedition.depth > this.profile.expeditionDepth) {
                this.profile.expeditionDepth = this.expedition.depth;
                profileChanged = true;
              }
              const currentUnlock = this.unlockedFactionForDepth(this.profile.expeditionDepth);
              if (currentUnlock > previousUnlock) this.factionJustUnlocked = currentUnlock;
              this.expedition.encounter = this.createEncounter(this.expedition.depth, this.expedition.encounter.map);
              this.expedition.enemyBenefits = advanceEnemyBenefits(this.expedition.enemyBenefits,
                this.expedition.encounter, this.expedition.depth);
              this.expedition.offers = this.createBenefitOffers(this.expedition);
              this.persistence.saveExpedition(this.expedition);
            } else if (!data.win) {
              this.persistence.clearExpedition?.();
              this.expedition = null;
            }
            if (profileChanged) this.persist();
            this.audio.setMode?.('silent');
            this.audio.sound(data.win ? 'victory' : 'defeat');
          }
          this.showResult(data);
        } else if (type === 'shot') {
          let p = this.R.project(data.x, 1 + (this.game.world?.surface?.heightAt(data.x,data.z) ?? 0), data.z);
          if (p && this.R.containsPoint(p.x, p.y))
            this.audio.sound('shot', data.heavy);
        } else if (type === 'explosion') {
          let p = this.R.project(data.x, 1 + (this.game.world?.surface?.heightAt(data.x,data.z) ?? 0), data.z);
          const v = this.R.viewport!;
          if (p && p.x > v.left - 100 && p.x < v.right + 100 && p.y > v.top - 100 && p.y < v.bottom)
            this.audio.sound('explosion', data.big);
        } else if (type === 'complete') {
          this.audio.sound('complete');
          this.alert({
            text: buildingName(data.type, this.game.s!.parties[this.localTeam].faction) + ' complete.',
            x: data.x,
            z: data.z
          });
          this.advanceBattleTutorial('complete', data.type);
          this.actionSignature = '';
        } else if (type === 'trained') {
          this.audio.sound('trained');
          if (data.type === 'hero')
            this.radio('Expedition command|Commander reconstructed and ready.');
          this.advanceBattleTutorial('trained', data.type);
          this.actionSignature = '';
        } else if (['scan', 'heal', 'queued', 'select'].includes(type))
          this.audio.sound(type);
      }
    }
    function defineMeridianUIMethods(methods: Record<string, Function>) {
      for (const [name, method] of Object.entries(methods))
        Object.defineProperty(MeridianUI.prototype, name, {
          value: method,
          configurable: true,
          writable: true
        });
    }
