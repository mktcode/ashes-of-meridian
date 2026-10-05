/* First-battle HUD tutorial. Loaded after ui/core.js. */
'use strict';

type BattleTutorialStep = 'arrival' | 'buildHQ' | 'recon' | 'trainWorker' | 'buildRefinery' | 'buildBarracks' | 'trainRifle' | 'buildDepot';
interface BattleTutorialState {
  step: BattleTutorialStep;
  achieved: Set<BattleTutorialStep>;
  workersTrained: number;
  elapsed: number;
  speedHintUntil?: number;
  arrivalCamera?: { from: Position; home: Position };
}

const BATTLE_TUTORIAL_TARGETS: Record<BattleTutorialStep, { tab: UITab; action: string }> = {
  arrival: { tab: 'root', action: '' },
  recon: { tab: 'root', action: '' },
  buildHQ: { tab: 'build', action: 'build:hq' },
  trainWorker: { tab: 'infantry', action: 'train:worker' },
  buildRefinery: { tab: 'build', action: 'build:refinery' },
  buildBarracks: { tab: 'build', action: 'build:barracks' },
  trainRifle: { tab: 'infantry', action: 'train:rifle' },
  buildDepot: { tab: 'build', action: 'build:depot' }
};

const uiTutorialMethods = {
  shouldBeginBattleTutorial(this: MeridianUI) {
    const s = this.game.s;
    return !!s && s.rules?.kind === 'single-player' && s.rules.mission.id === 'hq-elimination' && s.depth === 0 && this.localTeam === 0 &&
      s.parties[0].faction === FACTION_ID.FIRST && this.profile.expeditionDepth === 0 &&
      !this.profile.tutorialComplete;
  },
  beginBattleTutorial(this: MeridianUI) {
    this.battleTutorial = null;
    if (!this.shouldBeginBattleTutorial()) return false;
    const worker = this.game.alive(e => e.team === this.localTeam && e.type === 'worker')[0];
    this.battleTutorial = { step: worker ? 'arrival' : 'buildHQ', achieved: new Set(), workersTrained: 0, elapsed: 0 };
    if (worker) {
      const s = this.game.s!, height = this.game.world!.surface?.entityHeight(worker) ?? 0,
        home = this.terrainCameraPoint(s.cam, height),
        from = this.terrainCameraPoint({ x: s.cam.x,
          z: worker.z + (worker.z < 0 ? 1 : -1) * s.cam.zoom }, height);
      this.battleTutorial.arrivalCamera = { from, home };
      s.cam.x = from.x; s.cam.z = from.z;
      this.game.submitAction(this.localTeam, { kind: 'order', ids: [worker.id], order: { type: 'move', x: worker.x + 7, z: worker.z - 7 } });
    }
    this.actionSignature = '';
    return true;
  },
  advanceTutorialArrival(this: MeridianUI, dt: number) {
    const tutorial = this.battleTutorial;
    if (!tutorial || tutorial.step !== 'arrival' || this.paused || this.view !== 'game') return;
    tutorial.elapsed += Math.max(0, dt);
    const camera = tutorial.arrivalCamera, s = this.game.s;
    if (camera && s) {
      const p = clamp(tutorial.elapsed / 3, 0, 1), eased = p * p * (3 - 2 * p);
      s.cam.x = camera.from.x + (camera.home.x - camera.from.x) * eased;
      s.cam.z = camera.from.z + (camera.home.z - camera.from.z) * eased;
    }
    if (tutorial.elapsed < 3) return;
    tutorial.arrivalCamera = undefined;
    this.radioLine('tutorial.settle');
    this.setBattleTutorialStep('buildHQ', 'root');
  },
  updateTutorialSpeedHint(this: MeridianUI, now: number) {
    const tutorial = this.battleTutorial,
      inBattle = this.view === 'game' && !!this.game.s && !this.game.s.result;
    if (tutorial && inBattle && !this.paused && tutorial.step === 'buildHQ' &&
      tutorial.speedHintUntil === undefined && this.game.alive(e =>
        e.team === this.localTeam && e.type === 'hq' && e.progress < 1).length > 0) {
      // Presentation time: speeding up the simulation must not shorten the hint.
      tutorial.speedHintUntil = now + 5000;
    }
    const visible = !!tutorial && inBattle && now < (tutorial.speedHintUntil ?? 0);
    $('speedBtn').classList.toggle('tutorial-focus', visible);
    $('speedHint').classList.toggle('hidden', !visible);
    if (visible) $('speedBtn').setAttribute('aria-describedby', 'speedHint');
    else $('speedBtn').removeAttribute('aria-describedby');
  },
  tutorialAction(this: MeridianUI, supply?: number, capacity?: number): string | null {
    if (!this.battleTutorial || this.battleTutorial.step === 'arrival' || this.battleTutorial.step === 'recon') return null;
    const step = this.battleTutorial.step, target = BATTLE_TUTORIAL_TARGETS[step],
      queuedWorkers = step === 'trainWorker' ? this.game.alive(e => e.team === this.localTeam && e.kind === 'building')
        .reduce((count, e) => count + (e.queue?.filter(q => q.type === 'worker').length || 0), 0) : 0,
      pending = step === 'trainWorker'
        ? this.battleTutorial.workersTrained + queuedWorkers >= 2
        : step === 'trainRifle'
          ? (supply ?? this.game.supply(this.localTeam)) + UNITS.rifle.supply > (capacity ?? this.game.cap(this.localTeam))
          : this.game.alive(e => e.team === this.localTeam && e.kind === 'building' &&
            e.type === target.action.slice('build:'.length) && e.progress < 1).length > 0;
    if (pending) return null;
    if (this.tab === target.tab) return target.action;
    return this.tab === 'root' ? `tab:${target.tab}` : 'tab:root';
  },
  tutorialGoalText(this: MeridianUI, supply?: number, capacity?: number): string {
    const tutorial = this.battleTutorial;
    if (!tutorial || !this.game.s) return '';
    const { step } = tutorial, faction = this.game.s.parties[this.localTeam].faction;
    switch (step) {
      case 'arrival': return 'Establish a landing zone.';
      case 'buildHQ': return `Build a ${buildingName('hq', faction)} to establish your base.`;
      case 'recon': return 'Survey the enemy outpost and return to your base.';
      case 'trainWorker': return `Recruit two more ${unitName('worker', faction)} workers (${tutorial.workersTrained}/2 trained).`;
      case 'buildRefinery': return `Build a ${buildingName('refinery', faction)} beside an Echo vent.`;
      case 'buildBarracks': return `Build a ${buildingName('barracks', faction)} to recruit infantry.`;
    }
    supply ??= this.game.supply(this.localTeam);
    capacity ??= this.game.cap(this.localTeam);
    if (step === 'buildDepot')
      return `Supply ${supply}/${capacity}. Complete a ${buildingName('depot', faction)} for +${BUILDINGS.depot.cap} capacity.`;
    const goal = supply + UNITS.rifle.supply > capacity
      ? 'No further squad fits. Wait for queued infantry to finish.'
      : `Recruit ${unitName('rifle', faction)} squads until no more fit.`;
    return `Supply ${supply}/${capacity}. ${goal} Each squad uses ${UNITS.rifle.supply}; queued recruits count.`;
  },
  updateTutorialGoal(this: MeridianUI, supply?: number, capacity?: number) {
    const visible = this.view === 'game' && !!this.game.s && !this.game.s.result && !!this.battleTutorial,
      panel = $('tutorialGoal'), text = $('tutorialGoalText');
    panel.classList.toggle('hidden', !visible);
    const goal = visible ? this.tutorialGoalText(supply, capacity) : '';
    if (text.textContent !== goal) text.textContent = goal;
  },
  finishTutorialRecon(this: MeridianUI) {
    this.setBattleTutorialStep('trainWorker', 'root');
    this.radioLine('tutorial.economy');
    // Reconcile goals already completed while the camera was travelling.
    this.advanceBattleTutorial('complete', 'hq');
  },
  setBattleTutorialStep(this: MeridianUI, step: BattleTutorialStep, tab: UITab) {
    if (!this.battleTutorial) return;
    this.battleTutorial.step = step;
    if (step === 'trainRifle') this.radioLine('tutorial.supply');
    else if (step === 'buildDepot' && !this.battleTutorial.achieved.has('buildDepot')) this.radioLine('tutorial.logistics');
    this.actionSignature = '';
    if (this.tab !== tab) this.setTab(tab);
    else this.renderActions();
  },
  advanceBattleTutorial(this: MeridianUI, event: 'complete' | 'trained', type: BuildingType | UnitType) {
    const tutorial = this.battleTutorial;
    if (!tutorial) return;
    if (event === 'trained' && type === 'worker') tutorial.workersTrained++;
    const achieved = event === 'complete' && type === 'hq' ? 'buildHQ' : event === 'trained' && type === 'worker' && tutorial.workersTrained >= 2 ? 'trainWorker'
      : event === 'complete' && type === 'refinery' ? 'buildRefinery'
        : event === 'complete' && type === 'barracks' ? 'buildBarracks'
          : event === 'trained' && type === 'rifle' ? 'trainRifle'
            : event === 'complete' && type === 'depot' ? 'buildDepot' : null;
    if (achieved) tutorial.achieved.add(achieved);
    this.reconcileBattleTutorial();
    this.actionSignature = '';
    this.renderActions();
  },
  reconcileBattleTutorial(this: MeridianUI, supply?: number, capacity?: number) {
    while (this.battleTutorial?.achieved.has(this.battleTutorial.step)) {
      switch (this.battleTutorial.step) {
        case 'buildHQ':
          this.setBattleTutorialStep('recon', 'root');
          if (!this.beginTutorialRecon()) this.finishTutorialRecon();
          return;
        case 'trainWorker': this.setBattleTutorialStep('buildRefinery', 'root'); break;
        case 'buildRefinery': this.setBattleTutorialStep('buildBarracks', 'build'); break;
        case 'buildBarracks': this.setBattleTutorialStep('trainRifle', 'root'); break;
        case 'trainRifle':
          // Orders reserve supply immediately. An odd free slot need not fit another squad.
          supply ??= this.game.supply(this.localTeam);
          capacity ??= this.game.cap(this.localTeam);
          if (capacity <= 0 || supply + UNITS.rifle.supply <= capacity ||
            this.game.alive(e => e.team === this.localTeam && e.kind === 'unit' && e.type === 'rifle').length < 2) return;
          this.setBattleTutorialStep('buildDepot', 'root');
          break;
        case 'buildDepot':
          this.battleTutorial = null;
          this.profile.tutorialComplete = true;
          this.persist();
          this.actionSignature = '';
          this.renderActions();
          this.toast('Field tutorial complete.');
          break;
      }
    }
  }
};
type UITutorialMethods = typeof uiTutorialMethods;
interface MeridianUI extends UITutorialMethods {}
defineMeridianUIMethods(uiTutorialMethods);
