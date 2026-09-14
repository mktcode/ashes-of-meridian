    /* MeridianUI menus, dialogs and permanent profile screens. Loaded after ui/core.js. */
    'use strict';
    const uiScreenMethods = {
      showHome(this: MeridianUI) {
        this.game.s = null;
        this.view = 'home';
        this.paused = true;
        this.audio.setMode?.('menu');
        this.modalKind = '';
        this.selected = [];
        this.clearMode();
        $('hud').classList.add('hidden');
        $('worldViewport').classList.remove('in-battle');
        if (this.onViewportChange) this.onViewportChange();
        $('modal').classList.add('hidden');
        $('radio').classList.add('hidden');
        $('menu').classList.remove('hidden');
        this.R.fogOn = false;
        if (this.onPreview) this.onPreview();
        $('menu').innerHTML =
          renderHomeScreen(this.expedition, this.profile.expeditionDepth, this.encounterBriefing());
      },
      encounterBriefing(this: MeridianUI) {
        if (!this.expedition?.encounter) return '';
        const { enemy, map } = this.expedition.encounter, faction = FACTIONS[enemy],
          stage = aiRulesFor(enemy, this.expedition.depth).stage + 1;
        return `<p class="battle-note">NEXT · ${esc(faction.short)} · ${esc(BATTLEFIELDS[map].name)} · PRESSURE ${stage}/5<br><b>${esc(faction.doctrine.name)}</b> — ${esc(faction.doctrine.desc)}</p>`;
      },
      showExpeditionBenefits(this: MeridianUI) {
        if (!this.expedition) return;
        const active = Object.entries(this.expedition.benefits || {}).filter(([key, count]) =>
          count > 0 && Object.hasOwn(EXPEDITION_BENEFITS, key));
        this.openModal(
          'expeditionBenefits',
          `<div class="eyebrow">CURRENT EXPEDITION / CHECKPOINT ${this.expedition.depth + 1}</div><h1>Run benefits.</h1><div class="expedition-benefit-list">${active.length ? active.map(([key, count]) => { const benefit = expeditionBenefit(key)!; return `<div class="expedition-benefit-row"><span class="sigil">${icon(benefit.icon)}</span><div><strong>${esc(benefit.name)}</strong><small>${esc(benefit.desc)}</small></div><b>×${count}</b></div>`; }).join('') : '<p class="empty-benefits">No benefits collected yet. Win this battle to choose your first.</p>'}</div><div class="launch-row"><button class="primary" data-ui="closeModal">RETURN</button></div>`
        );
      },
      showBattle(this: MeridianUI) {
        this.view = 'battle';
        this.paused = true;
        this.audio.setMode?.('menu');
        $('menu').classList.remove('hidden');
        $('hud').classList.add('hidden');
        $('worldViewport').classList.remove('in-battle');
        if (this.onViewportChange) this.onViewportChange();
        $('modal').classList.add('hidden');
        if (!this.factionUnlocked(this.battleFaction)) this.battleFaction = FACTION_ID.FIRST;
        let startingAlloyLevel = clamp(Math.floor(Number(this.profile.upgrades.startingAlloy) || 0), 0, STARTING_ALLOY.length - 1),
          startingAlloy = STARTING_ALLOY[startingAlloyLevel];
        $('menu').innerHTML =
          renderBattleScreen(this.profile, this.battleFaction, this.unlockedFactionForDepth(this.profile.expeditionDepth), startingAlloy);
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
      createEncounter(this: MeridianUI): ExpeditionEncounter {
        const maps = contentKeys(BATTLEFIELDS);
        return {
          enemy: Math.floor(Math.random() * FACTIONS.length) as FactionId,
          map: maps[Math.floor(Math.random() * maps.length)],
          seed: 1 + Math.floor(Math.random() * 99999999)
        };
      },
      createBenefitOffers(this: MeridianUI, expedition: MeridianExpedition) {
        const available = contentKeys(EXPEDITION_BENEFITS).filter(key => {
          const max = expeditionBenefit(key)!.max;
          return max === undefined || (expedition.benefits[key] || 0) < max;
        });
        const random = seeded(expedition.encounter.seed + expedition.depth * 7919);
        for (let i = available.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [available[i], available[j]] = [available[j], available[i]];
        }
        return available.slice(0, 3);
      },
      startBattle(this: MeridianUI) {
        const faction = this.factionUnlocked(this.battleFaction) ? this.battleFaction : FACTION_ID.FIRST;
        this.battleFaction = faction;
        this.expedition = { version: 1, faction, depth: 0, benefits: {}, encounter: this.createEncounter(), offers: [] };
        this.persistence.saveExpedition(this.expedition);
        this.startExpeditionBattle();
      },
      startExpeditionBattle(this: MeridianUI) {
        if (!this.expedition) return;
        this.audio.unlock();
        this.game.start({ faction: this.expedition.faction, ...this.expedition.encounter,
          benefits: this.expedition.benefits, depth: this.expedition.depth });
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
        $('worldViewport').classList.remove('in-battle');
        $('modal').classList.add('hidden');
        $('menu').classList.remove('hidden');
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
        if (this.view !== 'game' || !this.game.s || this.game.s!.result) return;
        this.paused = true;
        this.audio.setMode?.('silent');
        this.clearMode();
        this.showPause();
      },
      showPause(this: MeridianUI) {
        let s = this.game.s;
        if (!s) return;
        this.paused = true;
        this.openModal(
          'pause',
          `<div class="eyebrow">OPERATION PAUSED / ${formatTime(s.time)}</div><h1>Annihilation</h1><div class="btnstack"><button class="primary" data-ui="resume">RESUME OPERATION <span>↗</span></button><button class="secondary" data-ui="settings">SETTINGS</button><button class="secondary" data-ui="help">FIELD MANUAL</button><button class="secondary" data-ui="home">MAIN MENU</button><button class="secondary" data-ui="restartConfirm">RESTART OPERATION</button><button class="secondary" data-ui="abandon">ABANDON EXPEDITION</button></div><p style="font-size:11px;margin-bottom:0">Main menu, closing or reloading discards this battle but keeps its secured pre-battle checkpoint. Abandoning ends the expedition.</p>`
        );
      },
      resume(this: MeridianUI) {
        if (this.view !== 'game' || !this.game.s || this.game.s!.result) return;
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
        this.persist();
      },
      showHelp(this: MeridianUI) {
        if (this.view === 'game') this.paused = true;
        this.openModal(
          'help',
          renderFieldManual(),
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
        if (!hasContentKey(META, key)) return;
        let m = META[key];
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
        let s = this.game.s!, offers = result.win && this.expedition ? this.expedition.offers : [];
        this.openModal(
          'result',
          `<div class="eyebrow">${result.win ? `VICTORY / EXPEDITION DEPTH ${this.expedition?.depth || 0}` : 'EXPEDITION LOST'} / ${FACTIONS[s.faction].short}</div><h1>${result.win ? 'Enemy base destroyed.' : 'Command center lost.'}</h1><p>${esc(result.text)}</p>${this.factionJustUnlocked === null ? '' : `<p class="unlock-notice">NEW FACTION UNLOCKED · ${esc(FACTIONS[this.factionJustUnlocked].name)} is ready for deployment.</p>`}<div class="result-stats"><div><strong>${formatTime(result.time)}</strong><span>BATTLE TIME</span></div><div><strong>${s.stats.kills}</strong><span>HOSTILES NEUTRALIZED</span></div><div><strong>${s.stats.lost}</strong><span>UNITS LOST</span></div><div><strong>${Math.floor(s.stats.gathered).toLocaleString()}</strong><span>ALLOY HARVESTED</span></div><div><strong>${this.resultAetherRecovered || 0}</strong><span>AETHER RECOVERED</span></div><div><strong>${Math.round(result.integrity * 100)}%</strong><span>COMMAND INTEGRITY</span></div><div><strong>${result.score.toLocaleString()}</strong><span>SCORE</span></div></div>${result.win ? this.encounterBriefing() : ''}${offers.length ? `<h3>Choose your expedition benefit</h3><div class="benefit-options compact">${renderBenefitOptions(offers)}</div>` : ''}<div class="btnstack">${result.win && !offers.length ? '<button class="primary" data-ui="continueExpedition">CONTINUE EXPEDITION ↗</button>' : !result.win ? '<button class="primary" data-ui="battle">NEW EXPEDITION ↗</button>' : ''}<button class="secondary" data-ui="armory">FLEET UPGRADES</button><button class="secondary" data-ui="home">MAIN MENU</button></div>`,
          true
        );
      }
    };
    type UIScreenMethods = typeof uiScreenMethods;
    interface MeridianUI extends UIScreenMethods {}
    defineMeridianUIMethods(uiScreenMethods);
