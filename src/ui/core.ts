    /* Front end, expedition lifecycle, HUD, controls. */
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
      startingAlloy: 'starting-cinder', startingWorkers: 'workers',
      constructionProtocols: 'construction', logisticsFrame: 'logistics', repairLogistics: 'repair-logistics',
      supplyCrate: 'crate', aetherAllocation: 'echo', pioneerSquad: 'pioneers',
      surveyDrones: 'survey', fieldWorkshop: 'workshop', commandCapacitor: 'energy',
      'echo-reward': 'echo-reward', pause: 'pause', settings: 'settings',
      'tab:root': 'back', back: 'back', close: 'close'
    });
    function uiIcon(name: string, fallback = name): string {
      return Object.hasOwn(UI_ICON_ASSETS, name)
        ? `<img class="ui-icon" src="./assets/ui/${UI_ICON_ASSETS[name]}.webp" alt="" aria-hidden="true" draggable="false">`
        : icon(fallback);
    }
    // Decorative material layers only; never participate in layout, focus or input.
    function uiSkin(): string {
      return '<span class="ui-skin" aria-hidden="true"><span class="ui-rim"></span><span class="ui-fill"></span><span class="ui-inner"></span><span class="ui-corners"><i></i><i></i><i></i><i></i></span></span>';
    }
    type UIMode = { kind: 'build'; arg: BuildingType } | { kind: 'ability'; arg: AbilityType } | { kind: 'rally'; arg?: undefined };
    type UITab = 'root' | 'build' | 'infantry' | 'vehicles' | 'aircraft' | 'details';
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
      activeWorldStage: number | null = null;
      launchingWorld: ExpeditionWorld | null = null;
      view: 'home' | 'battle' | 'game' | 'codex' | 'codexModel' | 'story';
      codexFaction: FactionId;
      codexSelection: { faction: FactionId; kind: 'unit' | 'building'; type: UnitType | BuildingType } | null;
      codexZoom = 1;
      codexRotation = 0;
      codexManualRotation = false;
      codexDrag?: {pointerId: number; x: number};
      codexTouches = new Map<number, {x: number; y: number}>();
      codexPinchDist?: number;
      paused: boolean;
      get controlsLocked(): boolean { return this.paused || this.leavingBattle || !!this.battleIntro || this.battleTutorial?.step === 'arrival'; }
      modalKind: string;
      sellBuildingId: number | null;
      selected: number[];
      selectedLookupSource: number[];
      selectedLookup: Set<number>;
      tab: UITab;
      mode: UIMode | null;
      editFavoriteSlot: number | null = null;
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
      leavingBattle = false;
      lastBattleSaveAt = 0;
      battleSaveBytes = 0;
      battleSaveMilliseconds = 0;
      settlementDetail: { buildingId: number; upgrade: CivilizationUpgradeType } | null = null;
      actionSignature: string;
      factionJustUnlocked: FactionId | null;
      hudClock: number;
      touchPoints: Map<number, {x: number; y: number}>;
      battleFaction?: FactionId;
      battleAbilities: AbilityType[];
      private processExpeditionResult?: ReturnType<typeof createExpeditionResultProcessor>;
      onViewportChange?: () => void;
      onCachedModelThumbnails?: (root: HTMLElement) => void;
      onPreview?: (map?: BattlefieldId, seed?: number, smooth?: boolean, battle?: ExpeditionBattleSave | null) => Promise<boolean>;
      onLaunchBattle?: (options: BattleOptions, expedition: ExpeditionBattleRecipe & { battle: ExpeditionBattleSave | null }, world?: ExpeditionWorld) => Promise<boolean>;
      onLeaveBattle?: (complete: () => void | Promise<boolean>) => void;
      domPressed?: boolean;
      touchGesture?: boolean;
      pinchDist?: number;
      touchAngle?: number;
      hudResizeObserver?: ResizeObserver;
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
        if (typeof ResizeObserver !== 'undefined') {
          this.hudResizeObserver = new ResizeObserver(() => this.updateHUDLayout());
          for (const id of ['topbar', 'commandDeck', 'selectionStatus']) this.hudResizeObserver.observe($(id));
        }
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
      expeditionUpgrades(): CivilizationUpgradeTotals {
        return this.expedition ? expeditionCivilizationUpgrades(this.expedition,
          this.view === 'game' && !this.game.stepping && this.game.snapshotSafe ? this.game.s : null, this.activeWorldStage)
          : {upgrades:{}, benefits:{}};
      }
      saveBattle() {
        const s = this.game.s, expedition = this.expedition,
          world = expedition?.worlds?.find(w => w.stage === this.activeWorldStage), recipe = world?.recipe ?? expedition;
        if (this.battleSaveError || this.view !== 'game' || !s || s.result || !expedition || !recipe || s.rules.kind !== 'single-player') return true;
        if (this.activeWorldStage !== null && (!world || world.error)) return false;
        if (s.map !== recipe.encounter.map || s.seed !== recipe.encounter.seed || s.depth !== recipe.depth)
          return !world;
        if (!!s.rules.completed !== !!world) return false;
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
          if (world) world.battle = battle;
          else expedition.battle = battle;
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
          this.activeWorldStage = this.launchingWorld?.stage ?? null;
          this.view = 'game';
          this.audio.resetBattleMusic?.();
          this.factionJustUnlocked = null;
          this.paused = !!data.restored && this.activeWorldStage !== null;
          this.modalKind = '';
          this.sellBuildingId = null;
          this.lastClick = {};
          $('menu').classList.add('hidden');
          $('modal').classList.add('hidden');
          $('result').classList.add('hidden');
          $('hud').classList.remove('hidden', 'battle-entrance');
          $('hud').classList.add('battle-entrance-pending');
          $('battleTransition').classList.remove('hidden');
          $('worldViewport').classList.remove('result-backdrop', 'home-scene-reveal');
          $('worldViewport').classList.add('in-battle');
          if (this.onViewportChange) this.onViewportChange();
          $('radio').classList.add('hidden');
          this.radioVoiceId = null;
          this.radioUntil = 0;
          $('alerts').innerHTML = '';
          this.selected = [];
          this.mode = null;
          this.tab = 'root';
          this.actionSignature = '';
          this.battleTutorial = null;
          this.battleIntro = null;
          if (data.restored) {
            const tutorial = this.launchingWorld ? null : this.expedition?.battle?.tutorial;
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
          if (this.paused) this.showPause();
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
          if (this.activeWorldStage !== null || (this.game.s?.rules.kind === 'single-player' && this.game.s.rules.completed)) return;
          this.audio.stopVoice?.();
          this.battleIntro = null;
          this.battleTutorial = null;
          if (!this.game.s) return;
          this.factionJustUnlocked = null;
          const completion = (this.processExpeditionResult ??= createExpeditionResultProcessor())(
            this.profile, this.expedition, this.game.s, data.win, {
              snapshotVictory: () => this.game.snapshotBattle(true),
              createEncounter: (depth, previousMap) => this.createEncounter(depth, previousMap)
            });
          if (completion) {
            this.expedition = completion.expedition;
            this.factionJustUnlocked = completion.factionUnlocked;
            // One localStorage write owns archive creation and retirement of the old battle.
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
