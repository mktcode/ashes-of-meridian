    /* Front end, permanent upgrades, HUD, controls. */
    'use strict';
    function $(id: 'world' | 'overlay' | 'minimap' | 'previewTransition'): HTMLCanvasElement;
    function $(id: string): HTMLElement;
    function $(id: string): HTMLElement { return document.getElementById(id)!; }
    const esc = (s: unknown) =>
      String(s ?? '').replace(
        /[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]
      );
    // Presentation-only motifs. Missing semantics keep the original SVG, never a category substitute.
    const UI_ICON_ASSETS: Readonly<Record<string, string>> = Object.freeze({
      aether: 'echo', crystal: 'cinder', energy: 'energy', shield: 'shield', skull: 'skull',
      scan: 'scan', heal: 'repair', orbital: 'orbital', drop: 'drop', repair: 'repair', bulwark: 'shield',
      'tab:build': 'buildings', 'tab:infantry': 'infantry', 'tab:vehicles': 'vehicles', 'tab:aircraft': 'aircraft',
      startingAlloy: 'starting-cinder', startingWorkers: 'workers', aetherEvacuation: 'evacuation',
      constructionProtocols: 'construction', logisticsFrame: 'logistics', repairLogistics: 'repair-logistics',
      supplyCrate: 'crate', aetherAllocation: 'echo', pioneerSquad: 'pioneers',
      surveyDrones: 'survey', fieldWorkshop: 'workshop', commandCapacitor: 'energy',
      'echo-reward': 'echo-reward', pause: 'pause', settings: 'settings',
      back: 'back', close: 'close'
    });
    function uiIcon(name: string, fallback = name): string {
      return Object.hasOwn(UI_ICON_ASSETS, name)
        ? `<img class="ui-icon" src="./assets/ui/${UI_ICON_ASSETS[name]}.webp" alt="" aria-hidden="true" draggable="false">`
        : icon(fallback);
    }
    type UIMode = { kind: 'build'; arg: BuildingType } | { kind: 'ability'; arg: AbilityType } | { kind: 'rally'; arg?: undefined };
    type UITab = 'root' | 'build' | 'infantry' | 'vehicles' | 'aircraft' | 'building';
    interface UIPing extends Position { life: number; maxLife: number; color: number; }
    interface UIDrag {
      sx: number; sy: number; x: number; y: number; button: number; type: string; moved: boolean;
      pointerId: number; startedAt: number; selecting: boolean;
    }
    interface BattleIntro {
      elapsed: number;
      hold: number;
      travel: number;
      focus: Position;
      mission: MissionId;
      home: Position;
      visibleEntityIds: Set<number>;
      objectiveShown: boolean;
      kind: 'recon';
      origin?: Position;
    }
    class MeridianUI {
      persistence: MeridianPersistence;
      game: MeridianGame;
      R: MeridianRenderer;
      audio: MeridianAudio;
      profile: MeridianProfile;
      expedition: MeridianExpedition | null;
      stageHistory: ExpeditionStagePreview[] = [];
      stagePreviewIndex = 0;
      stagePreviewBusy = false;
      view: 'home' | 'battle' | 'transition' | 'game' | 'codex' | 'codexModel' | 'story';
      codexFaction: FactionId;
      codexSelection: { faction: FactionId; kind: 'unit' | 'building'; type: UnitType | BuildingType } | null;
      codexZoom = 1;
      codexRotation = 0;
      codexManualRotation = false;
      codexDrag?: {pointerId: number; x: number};
      codexTouches = new Map<number, {x: number; y: number}>();
      codexPinchDist?: number;
      paused: boolean;
      get controlsLocked(): boolean { return this.paused || !!this.battleIntro || this.battleTutorial?.step === 'arrival'; }
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
      drag: UIDrag | null;
      pings: UIPing[];
      lastClick: Partial<{ id: number; type: string; time: number; count: number }>;
      radioUntil: number;
      radioVoiceId: VoiceLineId | null = null;
      toastUntil: number;
      storageWarningShown = false;
      battleSaveError: string | null = null;
      launchingBattle = false;
      lastBattleSaveAt = 0;
      battleSaveBytes = 0;
      battleSaveMilliseconds = 0;
      actionSignature: string;
      factionJustUnlocked: FactionId | null;
      hudClock: number;
      touchPoints: Map<number, {x: number; y: number}>;
      battleFaction?: FactionId;
      battleAbilities: AbilityType[];
      resultAetherRecovered?: number;
      resultAetherEvacuated?: number;
      resultAetherStructures?: number;
      resultCivilizationEarned?: number;
      resultCivilizationTotal?: number;
      resultBenefit?: string;
      onViewportChange?: () => void;
      onPreview?: (map?: BattlefieldId, seed?: number, smooth?: boolean) => Promise<boolean>;
      onLaunchBattle?: (options: BattleOptions, expedition: MeridianExpedition) => Promise<void>;
      domPressed?: boolean;
      touchGesture?: boolean;
      pinchDist?: number;
      touchAngle?: number;
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
        this.battleSaveError = this.persistence.expeditionError;
        this.stageHistory = this.persistence.loadStageHistory?.(this.expedition) || [];
        this.view = 'home';
        this.codexFaction = FACTION_ID.FIRST;
        this.codexSelection = null;
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
        this.battleAbilities = [...DEFAULT_ABILITY_LOADOUT];
        this.battleIntro = null;
        this.battleTutorial = null;
        this.bind();
        this.notifyStorageFailure();
      }
      codexModelRotation(dt: number) {
        // Increment the current heading so releasing a drag never snaps it back.
        if (!this.codexManualRotation) this.codexRotation += dt * .23;
        return this.codexRotation;
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
        this.notifyStorageFailure();
      }
      saveBattle() {
        const s = this.game.s, expedition = this.expedition;
        if (this.battleSaveError || this.view !== 'game' || !s || s.result || !expedition || s.rules.kind !== 'single-player' ||
          s.map !== expedition.encounter.map || s.seed !== expedition.encounter.seed || s.depth !== expedition.depth) return true;
        if (this.game.stepping || !this.game.snapshotSafe) return false;
        const started = performance.now();
        this.lastBattleSaveAt = started;
        try {
          const battle = this.game.snapshotBattle(), tutorial = this.battleTutorial;
          if (tutorial) {
            battle.tutorial = { step: tutorial.step, achieved: [...tutorial.achieved], workersTrained: tutorial.workersTrained };
            const cameraHome = tutorial.arrivalCamera?.home ?? this.battleIntro?.home;
            if (cameraHome) battle.tutorial.cameraHome = { ...cameraHome };
          }
          expedition.battle = battle;
          const saved = this.persistence.saveProgress(this.profile, expedition);
          this.lastBattleSaveAt = performance.now();
          this.battleSaveBytes = this.persistence.saveBytes;
          this.battleSaveMilliseconds = performance.now() - started;
          this.notifyStorageFailure();
          return saved;
        } catch (e) {
          console.error('Battle save failed:', e);
          this.toast('The battle could not be saved. Keep this page open; reloading may lose progress.');
          return false;
        }
      }
      autosaveBattle() {
        if (this.view === 'game' && !this.paused && performance.now() - this.lastBattleSaveAt >= 5000)
          this.saveBattle();
      }
      notifyStorageFailure() {
        if (this.persistence.available !== false || this.storageWarningShown) return;
        this.storageWarningShown = true;
        this.toast('Saving is unavailable. Changes stay in this tab only; reloading may restore older progress.');
        this.toastUntil = performance.now() + 12000;
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
      radioLine(id: VoiceLineId) {
        const line = voiceLine(id);
        this.radio(`${line.speaker}|${line.text}`);
        this.radioVoiceId = line.audio ? id : null;
        if (this.radioVoiceId) this.audio.playVoice?.(this.radioVoiceId);
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
        this.audio.stopVoice?.();
        this.radioVoiceId = null;
        this.audio.sound('radio');
      }
      event(...[type, data]: GameEvent) {
        if (type === 'start') {
          this.view = 'game';
          this.audio.resetBattleMusic?.();
          this.factionJustUnlocked = null;
          this.resultAetherRecovered = undefined;
          this.resultAetherEvacuated = undefined;
          this.resultAetherStructures = undefined;
          this.resultCivilizationEarned = undefined;
          this.resultCivilizationTotal = undefined;
          this.resultBenefit = undefined;
          this.paused = !!data.restored;
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
          this.radioVoiceId = null;
          this.radioUntil = 0;
          $('alerts').innerHTML = '';
          this.selected = [];
          this.attackMove = false;
          $('attackMoveBtn').setAttribute('aria-pressed', 'false');
          this.mode = null;
          this.tab = 'root';
          this.actionSignature = '';
          this.battleTutorial = null;
          this.battleIntro = null;
          if (data.restored) {
            const tutorial = this.expedition?.battle?.tutorial;
            if (tutorial) {
              this.battleTutorial = { step: tutorial.step, achieved: new Set(tutorial.achieved),
                workersTrained: tutorial.workersTrained, elapsed: 0 };
              // Skip cinematics without forgetting already achieved tutorial goals.
              if (tutorial.cameraHome) Object.assign(this.game.s!.cam, tutorial.cameraHome);
              if (tutorial.step === 'arrival') this.battleTutorial.step = 'buildHQ';
              else if (tutorial.step === 'recon') this.finishTutorialRecon();
            }
          } else if (!this.beginBattleTutorial()) {
            const worker = this.game.alive(e => e.team === this.localTeam && e.type === 'worker')[0];
            if (worker) {
              const point = this.terrainCameraPoint(this.game.s!.cam,
                this.game.world!.surface?.entityHeight(worker) ?? 0);
              this.center(point.x, point.z);
            }
          }
          this.audio.setMode?.(this.paused || this.battleIntro ? 'silent' : 'battle');
          this.updateHUD();
          this.clearMode();
          // Start is outside a tick, so the initial CPU/UI snapshot precedes free play.
          if (data.restored) this.showPause();
          else this.saveBattle();
        } else if (type === 'toast') this.toast(data);
        else if (type === 'radio') {
          if (this.battleTutorial?.step === 'arrival' || this.battleTutorial?.step === 'buildHQ' || this.battleIntro?.kind === 'recon') return;
          this.radio(data);
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
          this.audio.stopVoice?.();
          this.battleIntro = null;
          this.battleTutorial = null;
          const firstResult = this.resultAetherRecovered === undefined;
          this.factionJustUnlocked = null;
          if (firstResult) {
            let level = Math.min(AETHER_EVACUATION_CAPS.length - 1, Math.max(0, Math.floor(this.game.s?.parties[0].meta?.aetherEvacuation || 0))),
              limit = AETHER_EVACUATION_CAPS[level],
              evacuated = Math.min(limit, Math.max(0, Math.floor(this.game.s?.parties[0].account.gas || 0))),
              structures = Math.max(0, Math.floor(this.game.s?.stats.structuresDestroyed || 0));
            this.resultAetherEvacuated = evacuated;
            this.resultAetherStructures = structures * AETHER_STRUCTURE_RECOVERY[level];
            this.resultAetherRecovered = this.resultAetherEvacuated + this.resultAetherStructures;
            if (this.resultAetherRecovered) {
              this.profile.aether = Math.min(999999, this.profile.aether + this.resultAetherRecovered);
            }
            this.resultCivilizationEarned = this.expedition ? data.civilizationScore || 0 : 0;
            if (this.expedition) {
              this.expedition.civilizationScore = Math.min(Number.MAX_SAFE_INTEGER,
                (this.expedition.civilizationScore || 0) + this.resultCivilizationEarned);
              this.profile.lastCivilizationScore = this.expedition.civilizationScore;
            }
            this.resultCivilizationTotal = this.expedition?.civilizationScore || 0;
            if (data.win && this.expedition) {
              const previousUnlock = this.unlockedFactionForDepth(this.profile.expeditionDepth);
              this.rememberStage();
              this.expedition.depth++;
              if (this.expedition.depth > this.profile.expeditionDepth) {
                this.profile.expeditionDepth = this.expedition.depth;
              }
              const currentUnlock = this.unlockedFactionForDepth(this.profile.expeditionDepth);
              if (currentUnlock > previousUnlock) this.factionJustUnlocked = currentUnlock;
              this.expedition.encounter = this.createEncounter(this.expedition.depth, this.expedition.encounter.map);
              this.expedition.enemyBenefits = advanceEnemyBenefits(this.expedition.enemyBenefits,
                this.expedition.encounter, this.expedition.depth);
              this.expedition.offers = this.createBenefitOffers(this.expedition);
              this.expedition.battle = null;
            } else if (!data.win) {
              this.expedition = null;
            }
            // One localStorage write owns both payout and retirement of the old battle.
            this.persistence.saveProgress(this.profile, this.expedition);
            this.notifyStorageFailure();
            if (data.win) this.rememberStage();
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
        } else if (type === 'supplyCollected') {
          this.audio.sound('pickup');
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
        } else if (['scan', 'heal', 'queued'].includes(type))
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
