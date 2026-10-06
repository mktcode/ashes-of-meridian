    /* MeridianUI menus, dialogs and permanent profile screens. Loaded after ui/core.js. */
    'use strict';
    const uiScreenMethods = {
      transitionBattleExit(this: MeridianUI, complete: () => void | Promise<boolean>) {
        if (this.leavingBattle) return true;
        if (this.view !== 'game' || !this.onLeaveBattle) return false;
        this.onLeaveBattle(complete);
        return true;
      },
      showHome(this: MeridianUI, leaveUnsaved = false, preferredStage?: number) {
        if (this.leavingBattle) return;
        if (!this.saveBattle() && !leaveUnsaved) {
          this.paused = true;
          this.openModal('saveUnavailable', `<div class="eyebrow">SAVE UNAVAILABLE</div><h1>Progress is only in this tab.</h1><p>The current battle has not been saved to this browser. You can continue in this tab, but closing or reloading may restore older progress.</p><div class="launch-row"><button class="primary" data-ui="backPause">KEEP PLAYING</button><button class="secondary" data-ui="leaveUnsaved">MAIN MENU ANYWAY</button></div>`);
          return;
        }
        const returningStage = preferredStage ?? this.activeWorldStage;
        if (this.transitionBattleExit(() => this.finishHome(returningStage))) return;
        void this.finishHome(returningStage);
      },
      finishHome(this: MeridianUI, returningStage: number | null) {
        this.refreshCivilizationScore();
        this.game.s = null;
        this.activeWorldStage = null;
        this.battleIntro = null;
        this.battleTutorial = null;
        this.view = 'home';
        this.resetCodexGesture();
        this.codexSelection = null;
        this.paused = true;
        this.audio.setMode?.('menu');
        this.modalKind = '';
        this.selected = [];
        this.clearMode();
        $('hud').classList.add('hidden');
        $('worldViewport').classList.remove('in-battle', 'result-backdrop');
        if (this.onViewportChange) this.onViewportChange();
        $('modal').classList.add('hidden');
        $('result').classList.add('hidden');
        $('radio').classList.add('hidden');
        $('menu').classList.remove('hidden');
        this.R.fogOn = false;
        this.rememberStage();
        const returningIndex = this.stageHistory.findIndex(s => s.stage === returningStage);
        this.stagePreviewIndex = returningIndex >= 0 ? returningIndex : Math.max(0, this.stageHistory.length - 1);
        this.stagePreviewBusy = false;
        $('menu').innerHTML =
          renderHomeScreen(this.expedition, this.stageHistory.length > 1,
            this.expedition ? BATTLEFIELDS[this.expedition.encounter.map].name : '', this.profile.lastCivilizationScore);
        const entry = this.stageHistory[this.stagePreviewIndex];
        const preview = this.onPreview?.(entry?.map || this.expedition?.encounter.map || 'desert',
          entry?.seed ?? this.expedition?.encounter.seed, false, this.stageBattle(entry?.stage));
        this.updateStagePreview();
        if (this.battleSaveError) this.showBattleSaveError();
        return preview;
      },
      showBattleSaveError(this: MeridianUI) {
        this.paused = true;
        this.audio.setMode?.('silent');
        this.openModal('battleSaveError', `<div class="eyebrow">EXPEDITION SAVE UNAVAILABLE</div><h1>Cannot restore this expedition.</h1><p>${esc(this.battleSaveError)}</p><p>The battle will not restart from its beginning. Your fleet upgrades and reserve are kept.</p><div class="launch-row"><button class="secondary" data-ui="closeModal">KEEP SAVE</button><button class="primary" data-ui="discardExpeditionSave">ABANDON EXPEDITION</button></div>`);
      },
      rememberStage(this: MeridianUI) {
        if (!this.expedition) { this.stageHistory = []; return; }
        if (this.expedition.worlds) {
          this.stageHistory = this.persistence.loadStageHistory(this.expedition);
          return;
        }
        const current = { stage: this.expedition.depth + 1, map: this.expedition.encounter.map, seed: this.expedition.encounter.seed },
          last = this.stageHistory[this.stageHistory.length - 1];
        if (last?.stage === current.stage && last.map === current.map && last.seed === current.seed) return;
        if (!last || last.stage !== current.stage - 1) this.stageHistory = [];
        this.stageHistory.push(current);
        this.persistence.saveStageHistory?.(this.stageHistory);
      },
      stageBattle(this: MeridianUI, stage?: number): ExpeditionBattleSave | null {
        if (stage === undefined || stage === (this.expedition?.depth ?? -1) + 1) return this.expedition?.battle ?? null;
        return this.expedition?.worlds?.find(w => w.stage === stage)?.battle ?? null;
      },
      enterSelectedStage(this: MeridianUI) {
        if (this.view !== 'home' || this.modalKind || this.stagePreviewBusy || this.launchingBattle) return;
        const entry = this.stageHistory[this.stagePreviewIndex];
        if (!entry || entry.stage === (this.expedition?.depth ?? -1) + 1) return this.continueExpedition();
        const world = this.expedition?.worlds?.find(w => w.stage === entry.stage);
        if (!world) { this.toast('Only the landscape was saved for this stage. This world cannot be entered.'); return; }
        if (world.error || !world.battle || !world.recipe) {
          this.openModal('worldSaveError', `<div class="eyebrow">WORLD SAVE UNAVAILABLE</div><h1>Cannot enter this world.</h1><p>${esc(world.error)}</p><p>Your current expedition is kept.</p><div class="launch-row"><button class="secondary" data-ui="closeModal">KEEP SAVE</button><button class="primary" data-ui="discardWorldSave" data-stage="${world.stage}">DISCARD WORLD</button></div>`);
          return;
        }
        void this.startExpeditionBattle(world);
      },
      continueBuilding(this: MeridianUI) {
        if (!this.expedition || this.launchingBattle || this.leavingBattle) return;
        const world = this.expedition.worlds?.filter(w => !w.error && w.recipe && w.battle)
          .sort((a, b) => b.stage - a.stage)[0];
        if (!world) { this.toast('No playable cleared world remains. Start a new expedition to continue.'); return; }
        // Re-entering a cleared world is not a departure to the main menu.
        if (this.view === 'game' && this.game.s?.result) void this.finishHome(world.stage);
        else this.showHome(false, world.stage);
        this.enterSelectedStage();
      },
      showCivilizationGate(this: MeridianUI) {
        if (!this.expedition) return;
        this.openModal('civilizationGate', `<div class="eyebrow">STAGE LOCKED</div><h1>Develop your civilization.</h1><p>${esc(expeditionProgressText(this.expedition))}</p><p>Civilization Score is the current total across all your worlds. It is not spent. Build in any cleared world, then return here.</p><div class="launch-row"><button class="primary" data-ui="developWorld">CONTINUE BUILDING</button><button class="secondary" data-ui="closeModal">RETURN</button></div>`);
      },
      async browseStage(this: MeridianUI, direction: -1 | 1) {
        if (this.view !== 'home' || this.modalKind || !this.expedition || this.stagePreviewBusy || this.launchingBattle) return;
        const index = this.stagePreviewIndex + direction, entry = this.stageHistory[index];
        if (!entry || !this.onPreview) return;
        const panel = $('menu').querySelector<HTMLElement>('.expedition-stage');
        if (!panel) return;
        this.stagePreviewBusy = true;
        this.updateStagePreview();
        try {
          const ready = await this.onPreview(entry.map, entry.seed, true, this.stageBattle(entry.stage));
          if (!ready || this.view !== 'home' || $('menu').querySelector('.expedition-stage') !== panel) return;
          this.stagePreviewIndex = index;
          this.updateStagePreview();
          const crystal = panel.querySelector<HTMLElement>('.stage-crystal');
          if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
            crystal?.animate?.([{ opacity: .35, transform: `translateX(${direction * 8}px) scale(.96)` },
              { opacity: 1, transform: 'translateX(0) scale(1)' }], { duration: 280, easing: 'ease-out' });
        } finally {
          // A newly opened home screen owns its own controls, not this stale request.
          if ($('menu').querySelector('.expedition-stage') === panel) {
            this.stagePreviewBusy = false;
            this.updateStagePreview();
          }
        }
      },
      updateStagePreview(this: MeridianUI) {
        const panel = $('menu').querySelector<HTMLElement>('.expedition-stage'), entry = this.stageHistory[this.stagePreviewIndex];
        if (!panel || !entry || !this.expedition) return;
        const archived = entry.stage !== this.expedition.depth + 1,
          locked = !expeditionStageUnlocked(this.expedition);
        panel.classList.toggle('archived', archived);
        panel.setAttribute('aria-busy', String(this.stagePreviewBusy));
        panel.querySelector('.stage-label')!.textContent = archived ? 'STAGE ARCHIVE' : 'CHECKPOINT';
        panel.querySelector('.stage-crystal strong')!.textContent = String(entry.stage);
        panel.querySelector('.stage-map')!.textContent = BATTLEFIELDS[entry.map].name;
        const world = this.expedition.worlds?.find(w => w.stage === entry.stage);
        panel.querySelector('.stage-status')!.textContent = this.stagePreviewBusy ? 'PREPARING WORLD…' :
          archived ? world?.error ? 'WORLD SAVE UNAVAILABLE' : world ? 'CLEARED · WORLD SAVED' : 'LANDSCAPE ONLY · NO WORLD SAVE' : locked ? `STAGE LOCKED · ${expeditionProgressText(this.expedition)}` : 'CURRENT CHECKPOINT';
        const button = $('menu').querySelector<HTMLButtonElement>('[data-ui="enterSelectedStage"]');
        if (button) {
          button.innerHTML = `${archived ? 'Enter world' : 'Continue expedition'} <span aria-hidden="true">→</span>`;
          button.title = archived ? `Enter stage ${entry.stage}` : `Continue at stage ${entry.stage}`;
          button.disabled = this.stagePreviewBusy || this.launchingBattle || (archived ? !world : locked);
        }
        panel.querySelector<HTMLButtonElement>('[data-ui="previousStage"]')!.disabled = this.stagePreviewBusy || this.launchingBattle || this.stagePreviewIndex === 0;
        panel.querySelector<HTMLButtonElement>('[data-ui="nextStage"]')!.disabled = this.stagePreviewBusy || this.launchingBattle || this.stagePreviewIndex === this.stageHistory.length - 1;
      },
      showCodex(this: MeridianUI) {
        if (this.view === 'codexModel') this.onPreview?.();
        this.view = 'codex';
        this.resetCodexGesture();
        this.codexSelection = null;
        $('menu').classList.remove('hidden');
        $('menu').innerHTML = renderCodexScreen(this.codexFaction);
      },
      showCodexModel(this: MeridianUI, kind: 'unit' | 'building', type: UnitType | BuildingType) {
        this.codexSelection = {faction:this.codexFaction,kind,type};
        this.codexZoom = 1;
        this.codexRotation = 0;
        this.codexManualRotation = false;
        this.resetCodexGesture();
        this.R.clearStatic();
        this.R.useModelPreview();
        this.view = 'codexModel';
        $('menu').innerHTML = renderCodexModelScreen(this.codexFaction,kind,type);
      },
      showCodexStory(this: MeridianUI) {
        this.view = 'story';
        this.codexSelection = null;
        $('menu').innerHTML = renderStoryScreen();
      },
      encounterBriefing(this: MeridianUI) {
        if (!this.expedition?.encounter) return '';
        return `<div class="battle-note">${renderMissionBriefing(this.expedition.encounter.mission)}${renderAbilityLoadout(this.expedition.abilities, this.profile)}${renderExpeditionOpponents(this.expedition)}</div>`;
      },
      showExpeditionBenefits(this: MeridianUI) {
        if (!this.expedition) return;
        const active = Object.entries(this.expedition.benefits || {}).filter(([key, count]) =>
          count > 0 && Object.hasOwn(EXPEDITION_BENEFITS, key));
        this.openModal(
          'expeditionBenefits',
          `<div class="eyebrow">CURRENT EXPEDITION / CHECKPOINT ${this.expedition.depth + 1}</div><h1>Current expedition.</h1><p class="muted">${esc(FACTIONS[this.expedition.faction].name)} · ${this.expedition.depth} sectors cleared<br>Next destination · ${esc(BATTLEFIELDS[this.expedition.encounter.map].name)}</p>${this.encounterBriefing()}<h2>Expedition benefits</h2><div class="expedition-benefit-list">${active.length ? active.map(([key, count]) => { const benefit = expeditionBenefit(key)!; return `<div class="expedition-benefit-row"><span class="sigil">${uiIcon(key, benefit.icon)}</span><div><strong>${esc(benefit.name)}</strong><small>${esc(benefit.desc)}</small></div><b>×${count}</b></div>`; }).join('') : '<p class="empty-benefits">No benefits collected yet. Win this battle to choose your first.</p>'}</div><div class="launch-row"><button class="primary" data-ui="closeModal">RETURN</button></div>`
        );
      },
      showBattle(this: MeridianUI) {
        if (this.battleSaveError) return this.showBattleSaveError();
        this.saveBattle();
        this.game.s = null;
        this.view = 'battle';
        this.paused = true;
        this.audio.setMode?.('menu');
        $('menu').classList.remove('hidden');
        $('hud').classList.add('hidden');
        $('worldViewport').classList.remove('in-battle', 'result-backdrop');
        if (this.onViewportChange) this.onViewportChange();
        $('modal').classList.add('hidden');
        $('result').classList.add('hidden');
        if (!this.factionUnlocked(this.battleFaction)) this.battleFaction = FACTION_ID.FIRST;
        let startingAlloyLevel = clamp(Math.floor(Number(this.profile.upgrades.startingAlloy) || 0), 0, STARTING_ALLOY.length - 1),
          startingAlloy = STARTING_ALLOY[startingAlloyLevel];
        if (this.battleAbilities.length > 4 || new Set(this.battleAbilities).size !== this.battleAbilities.length ||
            this.battleAbilities.some(key => !Object.hasOwn(ABILITIES, key)))
          this.battleAbilities = [...DEFAULT_ABILITY_LOADOUT];
        $('menu').innerHTML = renderBattleScreen(this.profile, this.battleFaction,
          this.unlockedFactionForDepth(this.profile.expeditionDepth), startingAlloy, this.battleAbilities);
      },
      unlockedFactionForDepth(this: MeridianUI, depth: number): FactionId {
        return unlockedExpeditionFaction(depth);
      },
      factionUnlocked(this: MeridianUI, faction: number | undefined): faction is FactionId {
        return faction !== undefined && Number.isInteger(faction) && faction >= 0 && faction < FACTIONS.length &&
          faction <= this.unlockedFactionForDepth(this.profile.expeditionDepth);
      },
      createEncounter(this: MeridianUI, depth = 0, previousMap?: BattlefieldId): ExpeditionEncounter {
        return createExpeditionEncounter(this.profile, depth, previousMap);
      },
      createBenefitOffers(this: MeridianUI, expedition: MeridianExpedition) {
        return createExpeditionBenefitOffers(expedition);
      },
      selectBattleAbility(this: MeridianUI, ability: AbilityType) {
        if (this.view !== 'battle') return;
        const index = this.battleAbilities.indexOf(ability);
        if (index >= 0) this.battleAbilities.splice(index, 1);
        else if (this.battleAbilities.length < 4) this.battleAbilities.push(ability);
        else { this.toast('Deselect a command module before choosing another.'); return; }
        // Keep the screen and focused controls alive; do not replay its entrance animation.
        document.querySelectorAll<HTMLButtonElement>('#menu [data-loadout-ability]').forEach(button => {
          const slot = this.battleAbilities.indexOf(button.dataset.loadoutAbility as AbilityType);
          button.classList.toggle('active', slot >= 0);
          button.setAttribute('aria-pressed', String(slot >= 0));
          button.querySelector<HTMLElement>('.loadout-slot')!.textContent = slot >= 0 ? String(slot + 1) : '';
        });
        $('menu').querySelector<HTMLElement>('.loadout-picker-heading > span')!.textContent = `${this.battleAbilities.length} / 4`;
        $('menu').querySelector<HTMLButtonElement>('[data-ui="startBattle"]')!.disabled =
          this.battleAbilities.length !== 4 || new Set(this.battleAbilities).size !== 4;
      },
      startBattle(this: MeridianUI, replaceExpedition = false) {
        if (this.launchingBattle) return;
        if (this.battleSaveError) return this.showBattleSaveError();
        if (this.expedition && !replaceExpedition) {
          this.openModal('replaceExpedition', `<div class="eyebrow">NEW EXPEDITION</div><h1>Abandon the current expedition?</h1><p>Starting a new expedition permanently discards your current run and its battle save.</p><div class="launch-row"><button class="primary" data-ui="replaceExpedition">ABANDON AND START NEW</button><button class="secondary" data-ui="closeModal">CANCEL</button></div>`);
          return;
        }
        const faction = this.factionUnlocked(this.battleFaction) ? this.battleFaction : FACTION_ID.FIRST;
        if (this.battleAbilities.length !== 4 || new Set(this.battleAbilities).size !== 4) {
          this.toast('Select four command modules.'); return;
        }
        this.battleFaction = faction;
        this.expedition = { version: 7, battle: null, worlds: [], faction, abilities: [...this.battleAbilities], depth: 0, civilizationScore: 0, unlockedStage: 1, benefits: {}, enemyBenefits: [{}], encounter: this.createEncounter(), offers: [] };
        this.refreshCivilizationScore();
        this.persistence.saveProgress(this.profile, this.expedition);
        this.notifyStorageFailure();
        this.stageHistory = [];
        this.rememberStage();
        this.startExpeditionBattle();
      },
      async startExpeditionBattle(this: MeridianUI, world?: ExpeditionWorld) {
        if (!this.expedition || this.launchingBattle || this.leavingBattle || (!world && this.expedition.offers.length)) return;
        if (world && (!this.expedition.worlds?.includes(world) || world.error || !world.recipe || !world.battle)) return;
        if (this.battleSaveError) return this.showBattleSaveError();
        this.refreshCivilizationScore();
        if (!world && !expeditionStageUnlocked(this.expedition)) return this.showCivilizationGate();
        if (this.view === 'game' && this.game.s && !this.game.s.result) return this.showPause();
        const expedition = world ? { ...world.recipe!, battle: world.battle } : this.expedition;
        this.launchingBattle = true;
        this.launchingWorld = world ?? null;
        this.updateStagePreview();
        this.audio.unlock();
        const options: BattleOptions = { faction: expedition.faction, ...expedition.encounter,
          abilities: expedition.abilities, benefits: expedition.benefits,
          enemyBenefits: expedition.enemyBenefits, depth: expedition.depth };
        try {
          if (this.onLaunchBattle) await this.onLaunchBattle(options, expedition, world);
          else if (expedition.battle) this.game.restoreBattle(expedition, !!world);
          else this.game.start(options);
        } catch (e) {
          console.error('Expedition launch failed:', e);
          if (world) this.openModal('worldLoadError', `<div class="eyebrow">WORLD LOAD FAILED</div><h1>Cannot enter this world.</h1><p>${esc(e instanceof Error ? e.message : String(e))}</p><button class="secondary" data-ui="closeModal">RETURN</button>`);
          else {
            this.battleSaveError = e instanceof Error ? e.message : String(e);
            this.showBattleSaveError();
          }
        } finally { this.launchingBattle = false; this.launchingWorld = null; this.updateStagePreview(); }
      },
      continueExpedition(this: MeridianUI) {
        if (this.battleSaveError) return this.showBattleSaveError();
        if (!this.expedition) return this.showBattle();
        this.refreshCivilizationScore();
        if (this.expedition.offers.length) this.showExpeditionTransition();
        else this.startExpeditionBattle();
      },
      showExpeditionTransition(this: MeridianUI) {
        if (!this.expedition) return this.showHome();
        this.view = 'transition';
        this.paused = true;
        this.audio.setMode?.('menu');
        $('hud').classList.add('hidden');
        $('worldViewport').classList.remove('in-battle', 'result-backdrop');
        $('modal').classList.add('hidden');
        $('result').classList.add('hidden');
        $('menu').classList.remove('hidden');
        if (this.onPreview) this.onPreview(this.expedition.encounter.map, this.expedition.encounter.seed);
        const benefits = Object.entries(this.expedition.benefits).filter(([, count]) => count)
          .map(([key, count]) => `${esc(expeditionBenefit(key)!.name)}${count > 1 ? ` ×${count}` : ''}`).join(' · ');
        $('menu').innerHTML = `<div class="subscreen expedition-transition"><header class="sub-header"><div><div class="eyebrow">MILITARY VICTORY / STAGE ${this.expedition.depth}</div><h1>Choose an expedition benefit.</h1></div><button class="textbtn" data-ui="home">${uiIcon('back')}MAIN MENU</button></header>${this.encounterBriefing()}<p class="muted">${esc(expeditionProgressText(this.expedition))}</p><p class="muted">The benefit remains active until this expedition ends.</p><div class="benefit-options">${renderBenefitOptions(this.expedition.offers)}</div><p class="battle-note">ACTIVE · ${benefits || 'NO BENEFITS YET'}</p><div class="launch-row"><button class="secondary" data-ui="developWorld">CONTINUE BUILDING</button><button class="secondary" data-ui="armory">FLEET UPGRADES</button></div></div>`;
      },
      chooseBenefit(this: MeridianUI, key: string) {
        if (!this.expedition || !this.expedition.offers.includes(key) || !expeditionBenefit(key)) return;
        const benefit = expeditionBenefit(key)!, count = this.expedition.benefits[key] || 0;
        if (benefit.max !== undefined && count >= benefit.max) return;
        this.expedition.benefits[key] = count + 1;
        this.expedition.offers = [];
        this.refreshCivilizationScore();
        this.persistence.saveProgress(this.profile, this.expedition);
        this.notifyStorageFailure();
        if (!expeditionStageUnlocked(this.expedition)) {
          if (this.view === 'game' && this.game.s?.result) this.showResult(this.game.s.result);
          else this.showHome();
          return;
        }
        void this.startExpeditionBattle();
      },
      openModal(this: MeridianUI, kind: string, html: string, wide = false) {
        if (this.view === 'game' && this.paused && !['pause', 'saveUnavailable', 'battleSaveError'].includes(kind)) this.saveBattle();
        if (kind !== 'sell') this.sellBuildingId = null;
        this.modalKind = kind;
        $('modal').innerHTML =
          `<div class="modal-shade"><div class="modal-frame ${wide ? 'wide' : ''}"><div class="modal-card">${html}</div></div></div>`;
        $('modal').classList.remove('hidden');
      },
      closeModal(this: MeridianUI) {
        let kind = this.modalKind;
        this.modalKind = '';
        $('modal').classList.add('hidden');
        if (this.view === 'game' && !this.game.s?.result) {
          if (kind === 'battleSaveError') return this.showHome();
          if (kind === 'pause') this.resume();
          else this.showPause();
        } else if (kind === 'armory') {
          if (this.view === 'game' && this.game.s?.result) this.showResult(this.game.s!.result);
          else if (this.view === 'transition') this.showExpeditionTransition();
          else this.showHome();
        }
      },
      pause(this: MeridianUI) {
        if (this.leavingBattle) return;
        if ( this.view !== 'game' || !this.game.s || this.game.s!.result) return;
        this.paused = true;
        this.audio.setMode?.('silent');
        this.clearMode();
        this.showPause();
      },
      showPause(this: MeridianUI) {
        let s = this.game.s;
        if (!s) return;
        this.paused = true;
        this.audio.setMode?.('silent');
        this.saveBattle();
        this.openModal(
          'pause',
          `<div class="modal-symbol">${uiIcon('pause')}</div><div class="eyebrow">OPERATION PAUSED / ${formatTime(s.time)}</div><h1>Operation paused.</h1>${this.expedition ? `<p class="muted">Civilization Score · ${(this.expedition.civilizationScore || 0).toLocaleString('en-US')}<br>${esc(expeditionProgressText(this.expedition))}</p>` : ''}${renderWorldDesign(this.game.world)}<div class="btnstack"><button class="primary" data-ui="resume">RESUME OPERATION <span>↗</span></button><button class="secondary" data-ui="settings">${uiIcon('settings')}SETTINGS</button><button class="secondary" data-ui="home">MAIN MENU</button>${this.activeWorldStage === null ? '<button class="secondary" data-ui="abandon">ABANDON EXPEDITION</button>' : ''}</div><p class="ui-note">${this.activeWorldStage === null ? 'This battle is autosaved and Continue expedition resumes it directly. Abandoning ends the expedition and removes its saved worlds.' : `STAGE ${this.activeWorldStage} · This cleared world is autosaved separately from your current battle. Civilian buildings contribute to the expedition's live Civilization Score; visits grant no additional payouts.`} A hard interruption may return to the last successful autosave.</p>`
        );
      },
      resume(this: MeridianUI) {
        if (this.leavingBattle) return;
        if (this.battleSaveError) return this.showBattleSaveError();
        if ( this.view !== 'game' || !this.game.s || this.game.s!.result) return;
        this.paused = false;
        this.modalKind = '';
        $('modal').classList.add('hidden');
        this.audio.unlock();
        this.audio.setMode?.('battle');
      },
      showSettings(this: MeridianUI) {
        if (this.view === 'game') this.paused = true;
        let st = this.profile.settings;
        this.openModal(
          'settings',
          renderSettingsScreen(st, this.persistence.available !== false)
        );
      },
      applySetting(this: MeridianUI, el: HTMLInputElement | HTMLSelectElement) {
        let k = el.dataset.setting;
        if (!k || !Object.hasOwn(this.profile.settings, k)) return;
        let v = el.type === 'checkbox' ? (el as HTMLInputElement).checked : Number(el.value);
        this.profile.settings[k] = v;
        this.audio.updateSettings();
        if (k === 'quality') {
          this.R.quality = Number(v);
          this.R.resize();
        }
        if (k === 'showFps') {
          if (v) $('fpsReadout').classList.remove('hidden');
          else $('fpsReadout').classList.add('hidden');
        }
        this.persist();
      },
      showArmory(this: MeridianUI) {
        let previous = this.view;
        if (previous === 'game') this.paused = true;
        this.openModal(
          'armory',
          renderArmoryScreen(this.profile),
          true
        );
      },
      buyUpgrade(this: MeridianUI, key: string) {
        if (!hasContentKey(PERMANENT_UPGRADES, key)) return;
        let m = PERMANENT_UPGRADES[key];
        let n = this.profile.upgrades[key] || 0, cost = m.costs[n];
        if (n >= m.max || !Number.isFinite(cost) || this.profile.aether < cost) return;
        this.profile.aether -= cost;
        this.profile.upgrades[key] = n + 1;
        this.persist();
        this.audio.sound('research');
        this.showArmory();
      },
      showResult(this: MeridianUI, result: BattleResult) {
        if (this.leavingBattle) return;
        this.paused = true;
        this.clearMode();
        this.modalKind = 'result';
        this.sellBuildingId = null;
        $('hud').classList.add('hidden');
        $('radio').classList.add('hidden');
        $('worldViewport').classList.remove('in-battle');
        $('worldViewport').classList.add('result-backdrop');
        if (this.onViewportChange) this.onViewportChange();
        const locked = !!this.expedition && !expeditionStageUnlocked(this.expedition),
          offers = result.win && this.expedition ? this.expedition.offers : [];
        if (!offers.includes(this.resultBenefit || '')) this.resultBenefit = offers[0];
        const next = result.win && this.expedition ? this.expedition.encounter : null,
          nextPanel = next ? `<section class="result-next"><div class="result-next-body"><div class="result-next-heading"><div><div class="eyebrow">NEXT / STAGE ${this.expedition!.depth + 1}</div><h2>${esc(BATTLEFIELDS[next.map].name)}</h2></div></div>${renderMissionBriefing(next.mission)}${renderExpeditionOpponents(this.expedition!)}</div></section>` : '',
          benefitPanel = offers.length ? `<section class="result-benefits"><h3><span></span>CHOOSE AN EXPEDITION BENEFIT<span></span></h3><div class="benefit-options compact">${renderBenefitOptions(offers, this.resultBenefit)}</div><button class="primary result-confirm-benefit" data-ui="confirmBenefit">${locked ? 'CONFIRM BENEFIT' : 'CONTINUE EXPEDITION'} <span>→</span></button></section>` : '';
        $('modal').classList.add('hidden');
        $('result').innerHTML = `<main class="result-screen ${result.win ? 'victory' : 'defeat'}"><div class="result-shell"><header class="result-hero"><div class="result-symbol">${uiIcon(result.win ? 'shield' : 'skull')}</div><h1>${result.win ? 'MILITARY VICTORY' : 'DEFEAT'}</h1><p>${result.win ? `STAGE ${this.expedition?.depth || 0} CLEARED` : esc(result.text)}</p></header><section class="result-reward"><span class="result-reward-sigil">${uiIcon('echo-reward')}</span><div><span>ECHO RECOVERED</span><strong>${(this.resultAetherRecovered || 0).toLocaleString()}</strong><small class="result-reward-breakdown"><span>EVACUATED ${(this.resultAetherEvacuated || 0).toLocaleString()}</span><span>BUILDINGS DESTROYED ${(this.resultAetherStructures || 0).toLocaleString()}</span></small></div></section>${result.win && this.expedition ? renderVictoryCivilizationScore(this.expedition) : `<p class="muted">Civilization Score · ${(this.resultCivilizationTotal || 0).toLocaleString('en-US')} across this expedition's worlds</p>${this.expedition ? `<p class="muted">${esc(expeditionProgressText(this.expedition))}</p>` : ''}`}${this.factionJustUnlocked === null ? '' : `<p class="unlock-notice">NEW FACTION UNLOCKED · ${esc(FACTIONS[this.factionJustUnlocked].name)} is ready for deployment.</p>`}${benefitPanel}${nextPanel}<nav class="result-actions">${result.win ? '<button class="secondary" data-ui="developWorld">CONTINUE BUILDING <span>→</span></button>' : ''}${result.win && !offers.length ? `<button class="primary" data-ui="continueExpedition"${locked ? ' disabled' : ''}>CONTINUE EXPEDITION <span>→</span></button>` : !result.win ? '<button class="primary" data-ui="battle">NEW EXPEDITION <span>→</span></button>' : ''}<button class="secondary" data-ui="armory">FLEET UPGRADES <span>→</span></button><button class="secondary" data-ui="home">MAIN MENU <span>→</span></button></nav></div></main>`;
        $('result').classList.remove('hidden');
      }
    };
    type UIScreenMethods = typeof uiScreenMethods;
    interface MeridianUI extends UIScreenMethods {}
    defineMeridianUIMethods(uiScreenMethods);
