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
                  <button class="primary" data-ui="battle">New battle <span aria-hidden="true">→</span></button>
                  <button class="secondary" data-ui="armory">Fleet upgrades <span aria-hidden="true">→</span></button>
                </div>
                <nav class="menu-subnav" aria-label="More options"><button class="textbtn" data-ui="help">FIELD MANUAL</button><button class="textbtn" data-ui="settings">SETTINGS</button></nav>
              </div>
            </div>
            <div class="menu-quote">One objective.<br>Destroy the enemy base.<small>REPEATABLE BATTLES / PERMANENT UPGRADES</small></div>
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
          `<div class="subscreen"><header class="sub-header"><div><div class="eyebrow">THE FRONTIER IS NEVER QUIET</div><h1>Choose your war.</h1></div><button class="textbtn" data-ui="home">← MAIN MENU</button></header><div style="max-width:910px;margin:0 auto"><div class="faction-options">${FACTIONS.map((f, i) => { const unlocked = this.factionUnlocked(i), requirement = FACTIONS[Math.max(0, i - 1)].name; return `<button class="faction-option${this.battleFaction === i ? ' active' : ''}${unlocked ? '' : ' locked'}" data-faction="${i}"${unlocked ? '' : ' disabled'}><span class="sigil" style="color:#${f.color.toString(16)}">${f.sigil}</span><strong>${esc(f.name)}</strong><small>${unlocked ? f.desc : `LOCKED · Win once as ${esc(requirement)}.`}</small></button>`; }).join('')}</div><p id="factionTrait" class="muted" style="min-height:42px;font-size:13px">${FACTIONS[this.battleFaction].trait}</p><div class="glass" style="padding:15px 25px"><div class="settings-row"><label>Hostile civilization</label><select id="battleEnemy">${FACTIONS.map((f, i) => `<option value="${i}">${esc(f.name)}</option>`).reverse().join('')}</select></div><div class="settings-row"><label>Battlefield</label><select id="battleBiome">${Object.entries(
            BIOMES
          )
            .map(([k, b]) => `<option value="${k}">${b.name}</option>`)
            .join(
              ''
            )}</select></div></div><div class="launch-row battle-launch"><span class="battle-note">HQ + ${this.profile.upgrades.startingWorkers || 0} WORKERS · ${startingAlloy} ALLOY</span><button class="primary" data-ui="startBattle">START BATTLE ↗</button></div></div></div>`;
      },
      factionUnlocked(faction) {
        return Number.isInteger(faction) && faction >= 0 && faction < FACTIONS.length &&
          faction <= this.profile.factionUnlockLevel;
      },
      startBattle() {
        let enemy = +$('battleEnemy').value, biome = $('battleBiome').value,
          faction = this.factionUnlocked(this.battleFaction) ? this.battleFaction : FACTION_ID.FIRST;
        this.battleFaction = faction;
        this.audio.unlock();
        this.game.start({ faction, enemy, biome });
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
          `<div class="eyebrow">OPERATION PAUSED / ${formatTime(s.time)}</div><h1>Annihilation</h1><div class="btnstack"><button class="primary" data-ui="resume">RESUME OPERATION <span>↗</span></button><button class="secondary" data-ui="settings">SETTINGS</button><button class="secondary" data-ui="help">FIELD MANUAL</button><button class="textbtn" data-ui="restartConfirm">RESTART OPERATION</button><button class="textbtn" data-ui="home">ABANDON RUN & MAIN MENU</button></div><p style="font-size:11px;margin-bottom:0">Runs cannot be saved. Returning to the main menu, closing or reloading the page ends this run. Pausing keeps it in this open page.</p>`
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
          `<div class="eyebrow">EXPEDITION PREFERENCES</div><h1>Systems & sound.</h1><div class="settings-row"><label>Render quality<small>Reduce quality for older graphics hardware.</small></label><select data-setting="quality"><option value="2" ${st.quality === 2 ? 'selected' : ''}>High · tilt-shift</option><option value="1" ${st.quality === 1 ? 'selected' : ''}>Balanced · native resolution</option><option value="0" ${st.quality === 0 ? 'selected' : ''}>Performance · no shadows</option></select></div><div class="settings-row"><label>Master volume</label><input type="range" min="0" max="1" step=".01" value="${st.volume}" data-setting="volume"></div><div class="settings-row"><label>Atmospheric soundtrack</label><input type="checkbox" data-setting="music" ${st.music ? 'checked' : ''}></div><div class="settings-row"><label>Battlefield audio</label><input type="checkbox" data-setting="sfx" ${st.sfx ? 'checked' : ''}></div><div class="settings-row"><label>Always show health bars</label><input type="checkbox" data-setting="healthbars" ${st.healthbars ? 'checked' : ''}></div><div class="launch-row"><button class="primary" data-ui="closeModal">DONE</button></div><p style="font-size:10px">Everything stays in this browser. No accounts, analytics, external assets, or network requests. Only permanent upgrades and settings are stored. Runs are never saved.</p>`
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
          ])}<p style="font-size:12px"><b>No battle saves.</b> Pause keeps the run only in this open page. Main menu, reload or closing ends it.</p></div><div><h3>Base & economy</h3><p style="font-size:12px"><b>Start:</b> HQ, 0–5 workers and 250–500 alloy / 0 aether, depending on fleet upgrades. No workers? Recruit one through <b>Infantry</b>.</p><p style="font-size:12px"><b>Resources:</b> Workers automatically gather alloy. Build a refinery within 8 meters of a vent for aether; no assigned worker needed. Depots add 16 supply.</p><p style="font-size:12px"><b>Build:</b> Buildings → choose → tap clear, explored ground. Requires a free worker. Recruit via <b>Infantry / Vehicles / Aircraft</b>. <b>Back</b> returns to categories. Tap a queue icon above the minimap to cancel one order for a full refund.</p><p style="font-size:12px"><b>Manage:</b> Select a completed building for <b>Repair / Sell / Rally point</b>. For rally, then tap a destination. Select a worker and tap your foundation or damaged unit/building to resume construction or repair.</p><h3>Between battles</h3><p style="font-size:12px">Win or lose: unspent aether is recovered up to your evacuation limit (100–1,000). Spend it on <b>Fleet upgrades</b> for future battles.</p><p style="font-size:12px">Win as <b>${esc(FACTIONS[FACTION_ID.FIRST].name)}</b> to unlock <b>${esc(FACTIONS[FACTION_ID.SECOND].name)}</b>; win as <b>${esc(FACTIONS[FACTION_ID.SECOND].name)}</b> to unlock <b>${esc(FACTIONS[FACTION_ID.THIRD].name)}</b>. Upgrades and unlocks stay in this browser.</p></div></div><div class="launch-row"><button class="primary" data-ui="closeModal">RETURN ↗</button></div>`,
          true
        );
      },
      showArmory() {
        let previous = this.view,
          evacuationLevel = clamp(this.profile.upgrades.aetherEvacuation || 0, 0, AETHER_EVACUATION_CAPS.length - 1),
          evacuationLimit = AETHER_EVACUATION_CAPS[evacuationLevel];
        if (previous === 'game') this.paused = true;
        this.openModal(
          'armory',
          `<div class="armory-screen"><header class="armory-heading"><h1>Fleet upgrades.</h1><div class="armory-limit"><span>EVACUATION LIMIT</span><strong>${evacuationLimit}</strong><small>AETHER / BATTLE</small></div></header><div class="armory-grid">${Object.entries(
            META
          )
            .map(([k, m]) => {
              let n = this.profile.upgrades[k] || 0, cost = m.costs[n], affordable = this.profile.aether >= cost;
              return `<div class="upgrade-card"><div class="upgrade-heading"><div class="sigil">${icon(m.icon)}</div><div><h3>${m.name}</h3><span class="upgrade-rank">LEVEL ${n} / ${m.max}</span></div></div><p>${m.desc}</p><div class="upgrade-levels" aria-label="Level ${n} of ${m.max}">${Array.from({ length: m.max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div><button class="secondary" data-upgrade="${k}" ${n >= m.max || !affordable ? 'disabled' : ''}>${n >= m.max ? 'FULLY REQUISITIONED' : cost + ' AETHER · LEVEL ' + (n + 1)}</button></div>`;
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
        let s = this.game.s;
        this.openModal(
          'result',
          `<div class="eyebrow">${result.win ? 'VICTORY' : 'DEFEAT'} / ${FACTIONS[s.faction].short}</div><h1>${result.win ? 'Enemy base destroyed.' : 'Command center lost.'}</h1><p>${esc(result.text)}</p>${this.factionJustUnlocked === null ? '' : `<p class="unlock-notice">NEW FACTION UNLOCKED · ${esc(FACTIONS[this.factionJustUnlocked].name)} is ready for deployment.</p>`}<div class="result-stats"><div><strong>${formatTime(result.time)}</strong><span>BATTLE TIME</span></div><div><strong>${s.stats.kills}</strong><span>HOSTILES NEUTRALIZED</span></div><div><strong>${s.stats.lost}</strong><span>UNITS LOST</span></div><div><strong>${Math.floor(s.stats.gathered).toLocaleString()}</strong><span>ALLOY HARVESTED</span></div><div><strong>${this.resultAetherRecovered || 0}</strong><span>AETHER RECOVERED</span></div><div><strong>${Math.round(result.integrity * 100)}%</strong><span>COMMAND INTEGRITY</span></div><div><strong>${result.score.toLocaleString()}</strong><span>SCORE</span></div></div><div class="btnstack"><button class="primary" data-ui="restart">DEPLOY AGAIN ↗</button><button class="secondary" data-ui="armory">FLEET UPGRADES</button><button class="secondary" data-ui="home">MAIN MENU</button></div>`,
          true
        );
      }
    });
