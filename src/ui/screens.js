    /* MeridianUI menus, dialogs and permanent profile screens. Loaded after ui/core.js. */
    'use strict';
    defineMeridianUIMethods({
      showHome() {
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
          `<div class="home-screen"><div class="home-layout">
            <svg class="menu-frame" viewBox="0 0 22 887" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M1 0V72L17 88V178L6 190V674L20 688V778L1 797V887"/></svg>
            <header class="menu-header">
              <div class="brand"><svg class="menu-emblem" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="22"/><path d="M24 3V11M24 37V45M3 24H11M37 24H45M24 10L28 20L38 24L28 28L24 38L20 28L10 24L20 20Z"/><circle cx="24" cy="24" r="4"/></svg><span>MERIDIAN EXPEDITIONARY COMMAND</span></div>
              <div class="menu-system">SOL SYSTEM <span>//</span> M-472</div>
              <div class="version">ROGUELITE PROTOTYPE</div>
            </header>
            <div class="menu-main">
              <div class="menu-title">
                <h1 class="wordmark" aria-label="Ashes of Meridian"><span class="wordmark-first">ASHES <b>OF</b></span><span>MERIDIAN</span></h1>
                <p class="menu-tagline">A roguelite RTS.</p>
              </div>
              <div class="menu-actions">
                <div class="menu-buttons">
                  ${this.expedition ? `<button class="primary" data-ui="continueExpedition">Continue expedition <span aria-hidden="true">→</span></button>` : ''}
                  <button class="${this.expedition ? 'secondary' : 'primary'}" data-ui="battle">New expedition <span aria-hidden="true">→</span></button>
                  <button class="secondary" data-ui="armory">Fleet upgrades <span aria-hidden="true">→</span></button>
                </div>
                <nav class="menu-subnav" aria-label="More options"><button class="textbtn" data-ui="help">FIELD MANUAL</button><button class="textbtn" data-ui="settings">SETTINGS</button></nav>
              </div>
            </div>
            <div class="menu-quote">One expedition.<br>How deep can you go?<small>${this.expedition ? `DEPTH ${this.expedition.depth} · CHECKPOINT SECURED` : `BEST DEPTH ${this.profile.expeditionDepth}`}</small></div>
            <footer class="menu-footer"><span class="menu-status"><span class="menu-beacon" aria-hidden="true"></span>3 CIVILIZATIONS · ONE OBJECTIVE</span><span class="menu-progress">LOCAL & OFFLINE</span></footer>
          </div></div>`;
      },
      showBattle() {
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
          `<div class="subscreen"><header class="sub-header"><div><div class="eyebrow">NEW EXPEDITION</div><h1>Choose your command.</h1></div><button class="textbtn" data-ui="home">← MAIN MENU</button></header><div style="max-width:910px;margin:0 auto"><div class="faction-options">${FACTIONS.map((f, i) => { const unlocked = this.factionUnlocked(i), requirement = FACTION_DEPTH_REQUIREMENTS[i]; return `<button class="faction-option${this.battleFaction === i ? ' active' : ''}${unlocked ? '' : ' locked'}" data-faction="${i}"${unlocked ? '' : ' disabled'}><span class="sigil" style="color:#${f.color.toString(16)}">${f.sigil}</span><strong>${esc(f.name)}</strong><small>${unlocked ? f.desc : `LOCKED · Reach expedition depth ${requirement}.`}</small></button>`; }).join('')}</div><p id="factionTrait" class="muted" style="min-height:42px;font-size:13px">${FACTIONS[this.battleFaction].trait}</p><div class="launch-row battle-launch"><span class="battle-note">HQ + ${this.profile.upgrades.startingWorkers || 0} WORKERS · ${startingAlloy} ALLOY · RANDOM FRONTIER</span><button class="primary" data-ui="startBattle">START EXPEDITION ↗</button></div></div></div>`;
      },
      unlockedFactionForDepth(depth) {
        let unlocked = FACTION_ID.FIRST;
        for (let i = 1; i < FACTION_DEPTH_REQUIREMENTS.length; i++)
          if (depth >= FACTION_DEPTH_REQUIREMENTS[i]) unlocked = i;
        return unlocked;
      },
      factionUnlocked(faction) {
        return Number.isInteger(faction) && faction >= 0 && faction < FACTIONS.length &&
          faction <= this.unlockedFactionForDepth(this.profile.expeditionDepth);
      },
      createEncounter() {
        const maps = Object.keys(BATTLEFIELDS);
        return {
          enemy: Math.floor(Math.random() * FACTIONS.length),
          map: maps[Math.floor(Math.random() * maps.length)],
          seed: 1 + Math.floor(Math.random() * 99999999)
        };
      },
      createBenefitOffers(expedition) {
        const available = Object.keys(EXPEDITION_BENEFITS).filter(key => {
          const max = EXPEDITION_BENEFITS[key].max;
          return max === undefined || (expedition.benefits[key] || 0) < max;
        });
        const random = seeded(expedition.encounter.seed + expedition.depth * 7919);
        for (let i = available.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [available[i], available[j]] = [available[j], available[i]];
        }
        return available.slice(0, 3);
      },
      startBattle() {
        const faction = this.factionUnlocked(this.battleFaction) ? this.battleFaction : FACTION_ID.FIRST;
        this.battleFaction = faction;
        this.expedition = { version: 1, faction, depth: 0, benefits: {}, encounter: this.createEncounter(), offers: [] };
        this.persistence.saveExpedition(this.expedition);
        this.startExpeditionBattle();
      },
      startExpeditionBattle() {
        if (!this.expedition) return;
        this.audio.unlock();
        this.game.start({ faction: this.expedition.faction, ...this.expedition.encounter,
          benefits: this.expedition.benefits });
      },
      continueExpedition() {
        if (!this.expedition) return this.showBattle();
        if (this.expedition.offers.length) this.showExpeditionTransition();
        else this.startExpeditionBattle();
      },
      showExpeditionTransition() {
        if (!this.expedition) return this.showHome();
        this.view = 'transition';
        this.paused = true;
        this.audio.setMode?.('menu');
        $('hud').classList.add('hidden');
        $('worldViewport').classList.remove('in-battle');
        $('modal').classList.add('hidden');
        $('menu').classList.remove('hidden');
        const benefits = Object.entries(this.expedition.benefits).filter(([, count]) => count)
          .map(([key, count]) => `${esc(EXPEDITION_BENEFITS[key].name)}${count > 1 ? ` ×${count}` : ''}`).join(' · ');
        $('menu').innerHTML = `<div class="subscreen expedition-transition"><header class="sub-header"><div><div class="eyebrow">CHECKPOINT SECURED / DEPTH ${this.expedition.depth}</div><h1>Choose an expedition benefit.</h1></div><button class="textbtn" data-ui="home">← MAIN MENU</button></header><p class="muted">The benefit remains active until this expedition ends.</p><div class="benefit-options">${this.expedition.offers.map(key => { const benefit = EXPEDITION_BENEFITS[key]; return `<button class="benefit-option" data-benefit="${key}"><span class="sigil">${icon(benefit.icon)}</span><strong>${benefit.name}</strong><small>${benefit.desc}</small></button>`; }).join('')}</div><p class="battle-note">ACTIVE · ${benefits || 'NO BENEFITS YET'}</p><div class="launch-row"><button class="secondary" data-ui="armory">FLEET UPGRADES</button></div></div>`;
      },
      chooseBenefit(key) {
        if (!this.expedition || !this.expedition.offers.includes(key) || !EXPEDITION_BENEFITS[key]) return;
        const benefit = EXPEDITION_BENEFITS[key], count = this.expedition.benefits[key] || 0;
        if (benefit.max !== undefined && count >= benefit.max) return;
        this.expedition.benefits[key] = count + 1;
        this.expedition.offers = [];
        this.persistence.saveExpedition(this.expedition);
        this.startExpeditionBattle();
      },
      openModal(kind, html, wide = false) {
        if (kind !== 'sell') this.sellBuildingId = null;
        this.modalKind = kind;
        $('modal').innerHTML =
          `<div class="modal-shade"><div class="modal-card ${wide ? 'wide' : ''}">${html}</div></div>`;
        $('modal').classList.remove('hidden');
      },
      closeModal() {
        let kind = this.modalKind;
        this.modalKind = '';
        $('modal').classList.add('hidden');
        if (this.view === 'game' && !this.game.s?.result) {
          if (kind === 'pause') this.paused = false;
          else this.showPause();
        } else if (kind === 'armory') {
          if (this.view === 'game' && this.game.s?.result) this.showResult(this.game.s.result);
          else if (this.view === 'transition') this.showExpeditionTransition();
          else this.showHome();
        }
      },
      pause() {
        if (this.view !== 'game' || !this.game.s || this.game.s.result) return;
        this.paused = true;
        this.audio.setMode?.('silent');
        this.clearMode();
        this.showPause();
      },
      showPause() {
        let s = this.game.s;
        if (!s) return;
        this.paused = true;
        this.openModal(
          'pause',
          `<div class="eyebrow">OPERATION PAUSED / ${formatTime(s.time)}</div><h1>Annihilation</h1><div class="btnstack"><button class="primary" data-ui="resume">RESUME OPERATION <span>↗</span></button><button class="secondary" data-ui="settings">SETTINGS</button><button class="secondary" data-ui="help">FIELD MANUAL</button><button class="textbtn" data-ui="restartConfirm">RESTART OPERATION</button><button class="textbtn" data-ui="abandon">ABANDON EXPEDITION</button></div><p style="font-size:11px;margin-bottom:0">The current battle is not saved. Closing or reloading returns to its secured pre-battle checkpoint.</p>`
        );
      },
      resume() {
        if (this.view !== 'game' || !this.game.s || this.game.s.result) return;
        this.paused = false;
        this.modalKind = '';
        $('modal').classList.add('hidden');
        this.audio.unlock();
        this.audio.setMode?.('battle');
      },
      showSettings() {
        if (this.view === 'game') this.paused = true;
        let st = this.profile.settings;
        this.openModal(
          'settings',
          `<div class="eyebrow">EXPEDITION PREFERENCES</div><h1>Systems & sound.</h1><div class="settings-row"><label>Render quality<small>Reduce quality for older graphics hardware.</small></label><select data-setting="quality"><option value="2" ${st.quality === 2 ? 'selected' : ''}>High · tilt-shift</option><option value="1" ${st.quality === 1 ? 'selected' : ''}>Balanced · native resolution</option><option value="0" ${st.quality === 0 ? 'selected' : ''}>Performance · no shadows</option></select></div><div class="settings-row"><label>Master volume</label><input type="range" min="0" max="1" step=".01" value="${st.volume}" data-setting="volume"></div><div class="settings-row"><label>Atmospheric soundtrack</label><input type="checkbox" data-setting="music" ${st.music ? 'checked' : ''}></div><div class="settings-row"><label>Battlefield audio</label><input type="checkbox" data-setting="sfx" ${st.sfx ? 'checked' : ''}></div><div class="settings-row"><label>Always show health bars</label><input type="checkbox" data-setting="healthbars" ${st.healthbars ? 'checked' : ''}></div><div class="launch-row"><button class="primary" data-ui="closeModal">DONE</button></div><p style="font-size:10px">Everything stays in this browser. No accounts, analytics, external assets, or network requests. The expedition is saved only between battles.</p>`
        );
      },
      applySetting(el) {
        let k = el.dataset.setting;
        if (!k) return;
        let v =
          el.type === 'checkbox'
            ? el.checked
            : ['quality', 'volume'].includes(k)
              ? Number(el.value)
              : el.value;
        this.profile.settings[k] = v;
        this.audio.updateSettings();
        if (k === 'quality') {
          this.R.quality = v;
          this.R.resize();
        }
        this.persist();
      },
      showHelp() {
        const renderHelpLines = rows => rows
          .map(([a, b]) => `<div class="help-line"><span>${a}</span><span class="help-input">${b}</span></div>`)
          .join('');
        if (this.view === 'game') this.paused = true;
        this.openModal(
          'help',
          `<div class="eyebrow">ASHES OF MERIDIAN</div><h1>Field manual</h1><p>Destroy the enemy HQ. Protect your last HQ.</p><div class="help-grid"><div><h3>Touch controls</h3>${renderHelpLines([
            ['Select', 'Tap your unit or building'],
            ['Move / attack', 'Select troops → tap ground / enemy'],
            ['Group visible units', 'Double-tap: same type · triple-tap: all except workers'],
            ['Attack-move', 'Crossed swords beside ⌂: gold = stop to fight'],
            ['Pan / zoom', 'Drag one finger · pinch or ＋ / −'],
            ['Navigate', '⌂: base · minimap: tap or drag']
          ])}<p style="font-size:12px">Turn Attack-move off to prioritize moving or retreating. Workers always move normally.</p><h3>Battle controls</h3>${renderHelpLines([
            ['Abilities', 'Choose in the bottom-center bar → tap target'],
            ['Cancel', 'Cancel beside the target prompt'],
            ['Speed', 'Tap the multiplier below the clock'],
            ['Pause / help', 'Ⅱ / ? buttons']
          ])}<p style="font-size:12px"><b>Between-battle checkpoints.</b> The current battle is not saved. Reloading resumes from its preceding expedition checkpoint.</p></div><div><h3>Base & economy</h3><p style="font-size:12px"><b>Start:</b> HQ, plus 0–5 workers and 250–500 alloy from fleet upgrades. Expedition benefits can add workers, alloy, aether and your commander. No workers? Recruit one through <b>Infantry</b>.</p><p style="font-size:12px"><b>Resources:</b> Workers automatically gather alloy. Build a refinery within 8 meters of a vent for aether; no assigned worker needed. Depots add 16 supply.</p><p style="font-size:12px"><b>Build:</b> Buildings → choose → tap clear, explored ground. Requires a free worker. Recruit via <b>Infantry / Vehicles / Aircraft</b>. <b>Back</b> returns to categories. Tap a queue icon above the minimap to cancel one order for a full refund.</p><p style="font-size:12px"><b>Manage:</b> Select a completed building for <b>Repair / Sell / Rally point</b>. For rally, then tap a destination. Select a worker and tap your foundation or damaged unit/building to resume construction or repair.</p><h3>Between battles</h3><p style="font-size:12px">A victory secures the next checkpoint and lets you choose a benefit for the rest of the expedition. A lost HQ ends the expedition. Unspent aether is recovered up to your evacuation limit (100–1,000) after every battle.</p><p style="font-size:12px">Reach depth <b>10</b> to unlock <b>${esc(FACTIONS[FACTION_ID.SECOND].name)}</b> and depth <b>25</b> to unlock <b>${esc(FACTIONS[FACTION_ID.THIRD].name)}</b>. Fleet upgrades, reserve and best depth stay in this browser.</p></div></div><div class="launch-row"><button class="primary" data-ui="closeModal">RETURN ↗</button></div>`,
          true
        );
      },
      showArmory() {
        let previous = this.view;
        if (previous === 'game') this.paused = true;
        this.openModal(
          'armory',
          `<div class="armory-screen"><header class="armory-heading"><h1>Upgrades</h1><div class="armory-balance"><strong>${this.profile.aether.toLocaleString()}</strong><span class="armory-aether-icon">${icon('crystal')}</span></div></header><div class="armory-grid">${Object.entries(
            META
          )
            .map(([k, m]) => {
              let n = this.profile.upgrades[k] || 0, cost = m.costs[n], affordable = this.profile.aether >= cost,
                effect = m.display.values[n];
              return `<div class="upgrade-card"><div class="upgrade-heading"><div class="sigil">${icon(m.icon)}</div><div><h3>${m.name}</h3><span class="upgrade-rank">LEVEL ${n} / ${m.max}</span></div></div><p>${m.desc}</p><div class="upgrade-effect"><span>${m.display.label}</span><strong>${effect.toLocaleString()} <small>${m.display.unit}</small></strong></div><div class="upgrade-levels" aria-label="Level ${n} of ${m.max}">${Array.from({ length: m.max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div><button class="secondary" data-upgrade="${k}" ${n >= m.max || !affordable ? 'disabled' : ''}>${n >= m.max ? 'FULLY REQUISITIONED' : cost + ' AETHER · LEVEL ' + (n + 1)}</button></div>`;
            })
            .join(
              ''
            )}</div><div class="launch-row"><button class="primary" data-ui="closeModal">RETURN ↗</button></div></div>`,
          true
        );
      },
      buyUpgrade(key) {
        let m = META[key];
        if (!m) return;
        let n = this.profile.upgrades[key] || 0, cost = m.costs[n];
        if (n >= m.max || !Number.isFinite(cost) || this.profile.aether < cost) return;
        this.profile.aether -= cost;
        this.profile.upgrades[key] = n + 1;
        this.persist();
        this.audio.sound('research');
        this.showArmory();
      },
      showResult(result) {
        this.paused = true;
        this.clearMode();
        let s = this.game.s, offers = result.win && this.expedition ? this.expedition.offers : [];
        this.openModal(
          'result',
          `<div class="eyebrow">${result.win ? `VICTORY / EXPEDITION DEPTH ${this.expedition?.depth || 0}` : 'EXPEDITION LOST'} / ${FACTIONS[s.faction].short}</div><h1>${result.win ? 'Enemy base destroyed.' : 'Command center lost.'}</h1><p>${esc(result.text)}</p>${this.factionJustUnlocked === null ? '' : `<p class="unlock-notice">NEW FACTION UNLOCKED · ${esc(FACTIONS[this.factionJustUnlocked].name)} is ready for deployment.</p>`}<div class="result-stats"><div><strong>${formatTime(result.time)}</strong><span>BATTLE TIME</span></div><div><strong>${s.stats.kills}</strong><span>HOSTILES NEUTRALIZED</span></div><div><strong>${s.stats.lost}</strong><span>UNITS LOST</span></div><div><strong>${Math.floor(s.stats.gathered).toLocaleString()}</strong><span>ALLOY HARVESTED</span></div><div><strong>${this.resultAetherRecovered || 0}</strong><span>AETHER RECOVERED</span></div><div><strong>${Math.round(result.integrity * 100)}%</strong><span>COMMAND INTEGRITY</span></div><div><strong>${result.score.toLocaleString()}</strong><span>SCORE</span></div></div>${offers.length ? `<h3>Choose your expedition benefit</h3><div class="benefit-options compact">${offers.map(key => { const benefit = EXPEDITION_BENEFITS[key]; return `<button class="benefit-option" data-benefit="${key}"><span class="sigil">${icon(benefit.icon)}</span><strong>${benefit.name}</strong><small>${benefit.desc}</small></button>`; }).join('')}</div>` : ''}<div class="btnstack">${result.win && !offers.length ? '<button class="primary" data-ui="continueExpedition">CONTINUE EXPEDITION ↗</button>' : !result.win ? '<button class="primary" data-ui="battle">NEW EXPEDITION ↗</button>' : ''}<button class="secondary" data-ui="armory">FLEET UPGRADES</button><button class="secondary" data-ui="home">MAIN MENU</button></div>`,
          true
        );
      }
    });
