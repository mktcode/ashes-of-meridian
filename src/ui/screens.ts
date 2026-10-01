    /* MeridianUI menus, dialogs and permanent profile screens. Loaded after ui/core.js. */
    'use strict';
    const uiScreenMethods = {
      showHome(this: MeridianUI) {
        this.multiplayer?.disconnect();
        this.game.s = null;
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
        if (this.onPreview) this.onPreview(this.expedition?.encounter.map || 'desert', this.expedition?.encounter.seed);
        this.rememberStage();
        this.stagePreviewIndex = Math.max(0, this.stageHistory.length - 1);
        this.stagePreviewBusy = false;
        $('menu').innerHTML =
          renderHomeScreen(this.expedition, this.profile.expeditionDepth, this.encounterBriefing(), this.stageHistory.length > 1,
            this.expedition ? BATTLEFIELDS[this.expedition.encounter.map].name : '');
      },
      rememberStage(this: MeridianUI) {
        if (!this.expedition) { this.stageHistory = []; return; }
        const current = { stage: this.expedition.depth + 1, map: this.expedition.encounter.map, seed: this.expedition.encounter.seed },
          last = this.stageHistory[this.stageHistory.length - 1];
        if (last?.stage === current.stage && last.map === current.map && last.seed === current.seed) return;
        if (!last || last.stage !== current.stage - 1) this.stageHistory = [];
        this.stageHistory.push(current);
        this.persistence.saveStageHistory?.(this.stageHistory);
      },
      async browseStage(this: MeridianUI, direction: -1 | 1) {
        if (this.view !== 'home' || this.modalKind || !this.expedition || this.stagePreviewBusy) return;
        const index = this.stagePreviewIndex + direction, entry = this.stageHistory[index];
        if (!entry || !this.onPreview) return;
        const panel = $('menu').querySelector<HTMLElement>('.expedition-stage');
        if (!panel) return;
        this.stagePreviewBusy = true;
        this.updateStagePreview();
        try {
          const ready = await this.onPreview(entry.map, entry.seed, true);
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
        const archived = entry.stage !== this.expedition.depth + 1;
        panel.classList.toggle('archived', archived);
        panel.setAttribute('aria-busy', String(this.stagePreviewBusy));
        panel.querySelector('.stage-label')!.textContent = archived ? 'STAGE ARCHIVE' : 'CHECKPOINT';
        panel.querySelector('.stage-crystal strong')!.textContent = String(entry.stage);
        panel.querySelector('.stage-map')!.textContent = BATTLEFIELDS[entry.map].name;
        panel.querySelector('.stage-status')!.textContent = this.stagePreviewBusy ? 'PREPARING LANDSCAPE…' :
          archived ? `CLEARED · CONTINUE AT ${this.expedition.depth + 1}` : 'CURRENT · LANDSCAPE PREVIEW';
        panel.querySelector<HTMLButtonElement>('[data-ui="previousStage"]')!.disabled = this.stagePreviewBusy || this.stagePreviewIndex === 0;
        panel.querySelector<HTMLButtonElement>('[data-ui="nextStage"]')!.disabled = this.stagePreviewBusy || this.stagePreviewIndex === this.stageHistory.length - 1;
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
          `<div class="eyebrow">CURRENT EXPEDITION / CHECKPOINT ${this.expedition.depth + 1}</div><h1>Run benefits.</h1>${renderAbilityLoadout(this.expedition.abilities, this.profile)}<div class="expedition-benefit-list">${active.length ? active.map(([key, count]) => { const benefit = expeditionBenefit(key)!; return `<div class="expedition-benefit-row"><span class="sigil">${icon(benefit.icon)}</span><div><strong>${esc(benefit.name)}</strong><small>${esc(benefit.desc)}</small></div><b>×${count}</b></div>`; }).join('') : '<p class="empty-benefits">No benefits collected yet. Win this battle to choose your first.</p>'}</div><div class="launch-row"><button class="primary" data-ui="closeModal">RETURN</button></div>`
        );
      },
      showBattle(this: MeridianUI) {
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
        let unlocked: FactionId = FACTION_ID.FIRST;
        for (let i = 1; i < FACTION_DEPTH_REQUIREMENTS.length; i++)
          if (depth >= FACTION_DEPTH_REQUIREMENTS[i]) unlocked = i as FactionId;
        return unlocked;
      },
      factionUnlocked(this: MeridianUI, faction: number | undefined): faction is FactionId {
        return faction !== undefined && Number.isInteger(faction) && faction >= 0 && faction < FACTIONS.length &&
          faction <= this.unlockedFactionForDepth(this.profile.expeditionDepth);
      },
      createEncounter(this: MeridianUI, depth = 0, previousMap?: BattlefieldId): ExpeditionEncounter {
        const maps = availableBattlefields(), choices = contentKeys(MISSIONS)
          .filter(id => depth + 1 >= MISSIONS[id].firstStage)
          .flatMap(mission => MISSIONS[mission].maps.filter(map => maps.includes(map)).map(map => ({ mission, map }))),
          alternatives = choices.filter(choice => choice.map !== previousMap),
          pool = alternatives.length ? alternatives : choices;
        // Preserve the faction → map → seed draw order, with no extra mission draw.
        const enemies = expeditionEnemyFactions(depth, Math.random), choice = pool[Math.floor(Math.random() * pool.length)];
        return { ...choice, enemies, seed: 1 + Math.floor(Math.random() * 99999999) };
      },
      createBenefitOffers(this: MeridianUI, expedition: MeridianExpedition) {
        return expeditionBenefitOffers(expedition.benefits, seeded(expedition.encounter.seed + expedition.depth * 7919));
      },
      selectBattleAbility(this: MeridianUI, ability: AbilityType) {
        if (this.expedition) return;
        const index = this.battleAbilities.indexOf(ability);
        if (index >= 0) this.battleAbilities.splice(index, 1);
        else if (this.battleAbilities.length < 4) this.battleAbilities.push(ability);
        else { this.toast('Deselect a command module before choosing another.'); return; }
        this.showBattle();
      },
      startBattle(this: MeridianUI) {
        const faction = this.factionUnlocked(this.battleFaction) ? this.battleFaction : FACTION_ID.FIRST;
        if (this.battleAbilities.length !== 4 || new Set(this.battleAbilities).size !== 4) {
          this.toast('Select four command modules.'); return;
        }
        this.battleFaction = faction;
        this.expedition = { version: 5, faction, abilities: [...this.battleAbilities], depth: 0, benefits: {}, enemyBenefits: [{}], encounter: this.createEncounter(), offers: [] };
        this.persistence.saveExpedition(this.expedition);
        this.stageHistory = [];
        this.rememberStage();
        this.startExpeditionBattle();
      },
      startExpeditionBattle(this: MeridianUI) {
        if (!this.expedition) return;
        this.audio.unlock();
        const options: BattleOptions = { faction: this.expedition.faction, ...this.expedition.encounter,
          abilities: this.expedition.abilities, benefits: this.expedition.benefits,
          enemyBenefits: this.expedition.enemyBenefits, depth: this.expedition.depth };
        if (this.onLaunchBattle) this.onLaunchBattle(options);
        else this.game.start(options);
      },
      continueExpedition(this: MeridianUI) {
        if (!this.expedition) return this.showBattle();
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
        $('menu').innerHTML = `<div class="subscreen expedition-transition"><header class="sub-header"><div><div class="eyebrow">CHECKPOINT SECURED / DEPTH ${this.expedition.depth}</div><h1>Choose an expedition benefit.</h1></div><button class="textbtn" data-ui="home">← MAIN MENU</button></header>${this.encounterBriefing()}<p class="muted">The benefit remains active until this expedition ends.</p><div class="benefit-options">${renderBenefitOptions(this.expedition.offers)}</div><p class="battle-note">ACTIVE · ${benefits || 'NO BENEFITS YET'}</p><div class="launch-row"><button class="secondary" data-ui="armory">FLEET UPGRADES</button></div></div>`;
      },
      chooseBenefit(this: MeridianUI, key: string) {
        if (!this.expedition || !this.expedition.offers.includes(key) || !expeditionBenefit(key)) return;
        const benefit = expeditionBenefit(key)!, count = this.expedition.benefits[key] || 0;
        if (benefit.max !== undefined && count >= benefit.max) return;
        this.expedition.benefits[key] = count + 1;
        this.expedition.offers = [];
        this.persistence.saveExpedition(this.expedition);
        this.startExpeditionBattle();
      },
      openModal(this: MeridianUI, kind: string, html: string, wide = false) {
        if (kind !== 'sell') this.sellBuildingId = null;
        this.modalKind = kind;
        $('modal').innerHTML =
          `<div class="modal-shade"><div class="modal-card ${wide ? 'wide' : ''}">${html}</div></div>`;
        $('modal').classList.remove('hidden');
      },
      closeModal(this: MeridianUI) {
        let kind = this.modalKind;
        this.modalKind = '';
        $('modal').classList.add('hidden');
        if (this.view === 'game' && !this.game.s?.result) {
          if (kind === 'pause') this.paused = false;
          else this.showPause();
        } else if (kind === 'armory') {
          if (this.view === 'game' && this.game.s?.result) this.showResult(this.game.s!.result);
          else if (this.view === 'transition') this.showExpeditionTransition();
          else this.showHome();
        }
      },
      pause(this: MeridianUI) {
        if (this.battleIntro || this.view !== 'game' || !this.game.s || this.game.s!.result) return;
        this.paused = true;
        this.audio.setMode?.('silent');
        this.clearMode();
        this.showPause();
      },
      showPause(this: MeridianUI) {
        let s = this.game.s;
        if (!s) return;
        this.paused = true;
        if (this.game.networkTeam != null) {
          this.openModal('pause', `<div class="eyebrow">SESSION ${esc(this.multiplayer?.code || '')}</div><h1>Server keeps running.</h1><p>This menu only blocks your local controls. Leaving ends the session for both players. No expedition or profile changes.</p><div class="btnstack"><button class="primary" data-ui="resume">RETURN TO SESSION</button><button class="secondary" data-ui="settings">SETTINGS</button><button class="secondary" data-ui="home">LEAVE SESSION</button></div>`);
          return;
        }
        this.openModal(
          'pause',
          `<div class="eyebrow">OPERATION PAUSED / ${formatTime(s.time)}</div><h1>Operation paused.</h1>${renderWorldDesign(this.game.world)}<div class="btnstack"><button class="primary" data-ui="resume">RESUME OPERATION <span>↗</span></button><button class="secondary" data-ui="settings">SETTINGS</button><button class="secondary" data-ui="help">FIELD MANUAL</button><button class="secondary" data-ui="home">MAIN MENU</button><button class="secondary" data-ui="restartConfirm">RESTART OPERATION</button><button class="secondary" data-ui="abandon">ABANDON EXPEDITION</button></div><p style="font-size:11px;margin-bottom:0">Main menu, closing or reloading discards this battle but keeps its secured pre-battle checkpoint. Abandoning ends the expedition.</p>`
        );
      },
      resume(this: MeridianUI) {
        if (this.battleIntro || this.view !== 'game' || !this.game.s || this.game.s!.result) return;
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
          renderSettingsScreen(st)
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
      showHelp(this: MeridianUI) {
        if (this.view === 'game') this.paused = true;
        this.openModal(
          'help',
          renderFieldManual(this.game.s?.rules.kind === 'single-player'
            ? this.game.s.rules.mission.id : this.expedition?.encounter.mission ?? DEFAULT_MISSION),
          true
        );
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
        this.paused = true;
        this.clearMode();
        this.modalKind = 'result';
        this.sellBuildingId = null;
        $('hud').classList.add('hidden');
        $('radio').classList.add('hidden');
        $('worldViewport').classList.remove('in-battle');
        $('worldViewport').classList.add('result-backdrop');
        if (this.onViewportChange) this.onViewportChange();
        const offers = result.win && this.expedition ? this.expedition.offers : [];
        if (!offers.includes(this.resultBenefit || '')) this.resultBenefit = offers[0];
        const next = result.win && this.expedition ? this.expedition.encounter : null,
          nextPanel = next ? `<section class="result-next"><div class="result-next-preview map-${next.map}" aria-hidden="true"><span>${esc(BATTLEFIELDS[next.map].name)}</span></div><div class="result-next-body"><div class="result-next-heading"><div><div class="eyebrow">NEXT / STAGE ${this.expedition!.depth + 1}</div><h2>${esc(BATTLEFIELDS[next.map].name)}</h2></div></div>${renderMissionBriefing(next.mission)}${renderExpeditionOpponents(this.expedition!)}</div></section>` : '',
          benefitPanel = offers.length ? `<section class="result-benefits"><h3><span></span>CHOOSE AN EXPEDITION BENEFIT<span></span></h3><div class="benefit-options compact">${renderBenefitOptions(offers, this.resultBenefit)}</div><button class="primary result-confirm-benefit" data-ui="confirmBenefit">CONTINUE EXPEDITION <span>→</span></button></section>` : '';
        $('modal').classList.add('hidden');
        $('result').innerHTML = `<main class="result-screen ${result.win ? 'victory' : 'defeat'}"><div class="result-shell"><header class="result-hero"><h1>${result.win ? 'VICTORY' : 'DEFEAT'}</h1><p>${result.win ? `EXPEDITION DEPTH ${this.expedition?.depth || 0} SECURED` : esc(result.text)}</p></header><section class="result-reward"><span class="result-reward-sigil">⬡</span><div><span>ECHO RECOVERED</span><strong>${(this.resultAetherRecovered || 0).toLocaleString()}</strong><small class="result-reward-breakdown"><span>EVACUATED ${(this.resultAetherEvacuated || 0).toLocaleString()}</span><span>BUILDINGS DESTROYED ${(this.resultAetherStructures || 0).toLocaleString()}</span></small></div></section>${this.factionJustUnlocked === null ? '' : `<p class="unlock-notice">NEW FACTION UNLOCKED · ${esc(FACTIONS[this.factionJustUnlocked].name)} is ready for deployment.</p>`}${benefitPanel}${nextPanel}<nav class="result-actions">${result.win && !offers.length ? '<button class="primary" data-ui="continueExpedition">CONTINUE EXPEDITION <span>→</span></button>' : !result.win ? '<button class="primary" data-ui="battle">NEW EXPEDITION <span>→</span></button>' : ''}<button class="secondary" data-ui="armory">FLEET UPGRADES <span>→</span></button><button class="secondary" data-ui="home">MAIN MENU <span>→</span></button></nav></div></main>`;
        $('result').classList.remove('hidden');
      }
    };
    type UIScreenMethods = typeof uiScreenMethods;
    interface MeridianUI extends UIScreenMethods {}
    defineMeridianUIMethods(uiScreenMethods);
