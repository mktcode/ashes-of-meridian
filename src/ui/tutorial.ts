/* First-battle HUD tutorial. Loaded after ui/core.js. */
'use strict';

type BattleTutorialStep = 'trainWorker' | 'buildRefinery' | 'buildBarracks' | 'trainRifle';
interface BattleTutorialState {
  step: BattleTutorialStep;
  achieved: Set<BattleTutorialStep>;
  workersTrained: number;
}

const BATTLE_TUTORIAL_TARGETS: Record<BattleTutorialStep, { tab: UITab; action: string }> = {
  trainWorker: { tab: 'infantry', action: 'train:worker' },
  buildRefinery: { tab: 'build', action: 'build:refinery' },
  buildBarracks: { tab: 'build', action: 'build:barracks' },
  trainRifle: { tab: 'infantry', action: 'train:rifle' }
};

const uiTutorialMethods = {
  shouldBeginBattleTutorial(this: MeridianUI) {
    const s = this.game.s;
    return !!s && s.rules?.kind === 'single-player' && s.depth === 0 && this.localTeam === 0 &&
      s.parties[0].faction === FACTION_ID.FIRST && this.profile.expeditionDepth === 0 &&
      !this.profile.tutorialComplete;
  },
  beginBattleTutorial(this: MeridianUI) {
    this.battleTutorial = null;
    if (!this.shouldBeginBattleTutorial()) return false;
    this.battleTutorial = { step: 'trainWorker', achieved: new Set(), workersTrained: 0 };
    this.actionSignature = '';
    return true;
  },
  tutorialAction(this: MeridianUI): string | null {
    if (!this.battleTutorial) return null;
    const step = this.battleTutorial.step, target = BATTLE_TUTORIAL_TARGETS[step],
      queuedWorkers = step === 'trainWorker' ? this.game.alive(e => e.team === this.localTeam && e.kind === 'building')
        .reduce((count, e) => count + (e.queue?.filter(q => q.type === 'worker').length || 0), 0) : 0,
      pending = step === 'trainWorker'
        ? this.battleTutorial.workersTrained + queuedWorkers >= 2
        : step === 'trainRifle'
          ? this.game.alive(e => e.team === this.localTeam && e.kind === 'building' &&
            e.queue?.some(q => q.type === 'rifle')).length > 0
          : this.game.alive(e => e.team === this.localTeam && e.kind === 'building' &&
            e.type === (step === 'buildRefinery' ? 'refinery' : 'barracks') && e.progress < 1).length > 0;
    if (pending) return null;
    if (this.tab === target.tab) return target.action;
    return this.tab === 'root' ? `tab:${target.tab}` : 'tab:root';
  },
  setBattleTutorialStep(this: MeridianUI, step: BattleTutorialStep, tab: UITab) {
    if (!this.battleTutorial) return;
    this.battleTutorial.step = step;
    this.actionSignature = '';
    if (this.tab !== tab) this.setTab(tab);
    else this.renderActions();
  },
  advanceBattleTutorial(this: MeridianUI, event: 'complete' | 'trained', type: BuildingType | UnitType) {
    const tutorial = this.battleTutorial;
    if (!tutorial) return;
    if (event === 'trained' && type === 'worker') tutorial.workersTrained++;
    const achieved = event === 'trained' && type === 'worker' && tutorial.workersTrained >= 2 ? 'trainWorker'
      : event === 'complete' && type === 'refinery' ? 'buildRefinery'
        : event === 'complete' && type === 'barracks' ? 'buildBarracks'
          : event === 'trained' && type === 'rifle' ? 'trainRifle' : null;
    if (!achieved) {
      this.actionSignature = '';
      this.renderActions();
      return;
    }
    tutorial.achieved.add(achieved);
    while (this.battleTutorial?.achieved.has(this.battleTutorial.step)) {
      switch (this.battleTutorial.step) {
        case 'trainWorker': this.setBattleTutorialStep('buildRefinery', 'root'); break;
        case 'buildRefinery': this.setBattleTutorialStep('buildBarracks', 'build'); break;
        case 'buildBarracks': this.setBattleTutorialStep('trainRifle', 'root'); break;
        case 'trainRifle':
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
