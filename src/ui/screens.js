    /* MeridianUI menus, dialogs and permanent profile screens. Loaded after ui/core.js. */
    'use strict';
    defineMeridianUIMethods({
      showHome() {
        this.game.s = null;
        this.view = 'home';
        this.paused = true;
        this.modalKind = '';
        this.selected = [];
        this.clearMode();
        $('hud').classList.add('hidden');
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
              <div class="eyebrow">AN ORIGINAL REAL-TIME STRATEGY GAME</div>
              <h1 class="wordmark" aria-label="Ashes of Meridian">ASHES<span class="wordmark-link"><b>OF</b></span>MERIDIAN</h1>
              <p class="menu-tagline">Build your force. Break the enemy base. Return stronger.</p>
              <div class="menu-buttons">
                <button class="primary" data-ui="battle">New battle <span aria-hidden="true">→</span></button>
              </div>
              <nav class="menu-subnav" aria-label="More options"><button class="textbtn" data-ui="armory">FLEET UPGRADES</button><button class="textbtn" data-ui="help">FIELD MANUAL</button><button class="textbtn" data-ui="settings">SETTINGS</button></nav>
            </div>
            <div class="menu-quote">One objective.<br>Destroy the enemy base.<small>REPEATABLE BATTLES / PERMANENT UPGRADES</small></div>
            <footer class="menu-footer"><span class="menu-status"><span class="menu-beacon" aria-hidden="true"></span>3 CIVILIZATIONS · ONE OBJECTIVE</span><span class="menu-progress">LOCAL & OFFLINE</span></footer>
          </div></div>`;
      },
      showBattle() {
        this.view = 'battle';
        this.paused = true;
        $('menu').classList.remove('hidden');
        $('hud').classList.add('hidden');
        $('modal').classList.add('hidden');
        this.battleFaction = this.battleFaction || 0;
        $('menu').innerHTML =
          `<div class="subscreen"><header class="sub-header"><div><div class="eyebrow">THE FRONTIER IS NEVER QUIET</div><h1>Choose your war.</h1></div><button class="textbtn" data-ui="home">← MAIN MENU</button></header><div style="max-width:910px;margin:0 auto"><div class="faction-options">${FACTIONS.map((f, i) => `<button class="faction-option ${this.battleFaction === i ? 'active' : ''}" data-faction="${i}"><span class="sigil" style="color:#${f.color.toString(16)}">${f.sigil}</span><strong>${f.name}</strong><small>${f.desc}</small></button>`).join('')}</div><p id="factionTrait" class="muted" style="min-height:42px;font-size:13px">${FACTIONS[this.battleFaction].trait}</p><div class="glass" style="padding:15px 25px"><div class="settings-row"><label>Hostile civilization</label><select id="battleEnemy"><option value="2">The Veiled Court</option><option value="1">The Verdant Choir</option><option value="0">The Free Marches</option></select></div><div class="settings-row"><label>Battlefield</label><select id="battleBiome">${Object.entries(
            BIOMES
          )
            .map(([k, b]) => `<option value="${k}">${b.name}</option>`)
            .join(
              ''
            )}</select></div><div class="settings-row"><label>Map seed<small>Use the same seed to replay a battlefield.</small></label><input id="battleSeed" type="number" value="${Math.floor(Math.random() * 900000) + 100000}" min="1" max="999999999" style="width:155px;background:#172333;border:1px solid #68809855;padding:11px;color:#c9dbde;font:12px var(--mono)"></div></div><div class="launch-row" style="justify-content:space-between"><span class="battle-note">HQ + ${this.profile.upgrades.startingWorkers || 0} WORKERS</span><button class="primary" data-ui="startBattle">START BATTLE ↗</button></div></div></div>`;
      },
      startBattle() {
        let enemy = +$('battleEnemy').value, biome = $('battleBiome').value,
          seed = clamp(parseInt($('battleSeed').value) || Math.floor(Math.random() * 1e8), 1, 999999999);
        this.audio.unlock();
        this.game.start({ faction: this.battleFaction, seed, enemy, biome });
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
        } else if (kind === 'armory') this.showHome();
      },
      pause() {
        if (this.view !== 'game' || !this.game.s || this.game.s.result) return;
        this.paused = true;
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
      },
      showSettings() {
        if (this.view === 'game') this.paused = true;
        let st = this.profile.settings;
        this.openModal(
          'settings',
          `<div class="eyebrow">EXPEDITION PREFERENCES</div><h1>Systems & sound.</h1><div class="settings-row"><label>Render quality<small>Reduce quality for older graphics hardware.</small></label><select data-setting="quality"><option value="2" ${st.quality === 2 ? 'selected' : ''}>High · shadows & glow</option><option value="1" ${st.quality === 1 ? 'selected' : ''}>Balanced · native resolution</option><option value="0" ${st.quality === 0 ? 'selected' : ''}>Performance · no shadows</option></select></div><div class="settings-row"><label>Master volume</label><input type="range" min="0" max="1" step=".01" value="${st.volume}" data-setting="volume"></div><div class="settings-row"><label>Atmospheric soundtrack</label><input type="checkbox" data-setting="music" ${st.music ? 'checked' : ''}></div><div class="settings-row"><label>Battlefield audio</label><input type="checkbox" data-setting="sfx" ${st.sfx ? 'checked' : ''}></div><div class="settings-row"><label>Always show health bars</label><input type="checkbox" data-setting="healthbars" ${st.healthbars ? 'checked' : ''}></div><div class="launch-row"><button class="primary" data-ui="closeModal">DONE</button></div><p style="font-size:10px">Everything stays in this browser. No accounts, analytics, external assets, or network requests. Only permanent upgrades and settings are stored. Runs are never saved.</p>`
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
          `<div class="eyebrow">MERIDIAN FIELD MANUAL</div><h1>Bring your people home.</h1><div class="help-grid"><div><h3>Command your force</h3>${renderHelpLines([
            ['Select', 'Tap unit or structure'],
            ['Context order', 'Right click (temporary)'],
            ['Rally point', 'Select completed building → Rally point → tap ground'],
            ['Move (default)', 'Select units → tap ground'],
            ['Attack-move', 'Crossed swords beside ⌂ → gold = active → tap ground'],
            ['Move workers', 'Always ordinary movement, even with Attack-move active'],
            ['Build / repair with selected workers', 'Tap an own foundation or damaged building/unit'],
            ['Select visible units of a type', 'Double-tap unit'],
            ['Select visible combat units (no workers)', 'Triple-tap unit']
          ])}<h3>Navigate</h3>${renderHelpLines([
            ['Pan camera', 'Drag with one finger'],
            ['Zoom', 'Pinch / ＋ and − buttons'],
            ['Center on base', '⌂ button'],
            ['Navigate on minimap', 'Tap or drag']
          ])}</div><div><h3>Economy & production</h3><p style="font-size:12px">You start with <b>your headquarters and 0–5 workers</b>, depending on your permanent <b>Starting workers</b> upgrade. With no starting workers, recruit your first through <b>Infanterie</b>. Starting resources remain <b>250 alloy / 0 aether</b>; workers automatically harvest <b>alloy</b> and return it to command. Place a <b>refinery within 8 meters of a vent</b> for aether; it runs without an assigned worker.</p><p style="font-size:12px">Use <b>Gebäude</b>, choose a structure, then tap open, explored ground. One free worker is assigned; workers already building, travelling to build or repairing are not interrupted. If none is free, nothing is placed or paid. Select a completed own building for <b>Repair</b>, <b>Sell</b> and <b>Rally point</b> in the lower-right menu. Use <b>Zurück</b> to return to the categories. Repair sends the nearest free worker and costs 0.1 alloy per hull; tap again to stop. Without a free worker, automatic repair is unavailable. Selling refunds 50% of the building’s purchase value plus all pending recruitment costs; the last completed command center cannot be sold. Select workers, then tap an own foundation to resume construction or a damaged own building/unit to repair it. Exactly one selected worker is sent; other selected troops keep their orders. This explicit order may interrupt that worker's current job and replaces any previous builder at the target: construction never gets extra speed from multiple workers. Selection stays on the workers; deselect them first to inspect a foundation or damaged target. Intact targets are selected normally.</p><p style="font-size:12px"><b>Depots add 16 supply.</b> Queued troops reserve their supply. Multiple production structures recruit in parallel. Recruit through Infanterie (including workers and commander), Fahrzeuge or Flugzeuge. Orders are distributed across matching buildings. Icons above the minimap count all pending orders per type; the clockwise overlay shows the next completion. Tap an icon to cancel one order (waiting orders first) and recover its resources.</p><h3>Battlefield rules</h3><p style="font-size:12px">Attack-move stops to engage enemies; ordinary move prioritizes reaching the destination, including retreat. The crossed-swords toggle affects future ground orders only (also right-clicks in the battlefield or minimap), stays active until switched off and resets to off on each new battle/restart. Direct enemy taps still attack. Medics heal automatically. Tanks and artillery cannot attack aircraft. Artillery needs spotters and cannot fire at close range. Veterans earn stronger weapons after five kills.</p><p style="font-size:12px">Units and scans reveal fog-of-war. Destroy the enemy command center to win. Losing your last command center ends the battle.</p></div></div><h3>Command abilities & operation controls</h3><div class="help-grid">${renderHelpLines([
            ['Command abilities', 'Always-visible ability bar → tap target'],
            ['Build / recruit', 'Lower-right categories; Zurück returns'],
            ['Simulation speed', 'Left speed button: 1× → 1,5× → 2× → 0,75×; current battle only'],
            ['Speed lifetime', 'Pause keeps speed; each new battle/restart begins at 1×'],
            ['Pause', 'Ⅱ button'],
            ['Cancel targeting / placement', 'Cancel button beside the target prompt'],
            ['Run lifetime', 'No saves; closing, reloading or leaving ends the run'],
            ['Field manual', '? button']
          ])}</div><p style="font-size:11px">On touch screens: tap a unit, then a destination or enemy. Drag the battlefield to pan. Tap structures to inspect them.</p><p style="font-size:11px">Fleet upgrades apply to new battles. Upgrade resources are unlimited for testing; resource collection and unlocks will be added later.</p><div class="launch-row"><button class="primary" data-ui="closeModal">RETURN TO COMMAND ↗</button></div>`,
          true
        );
      },
      showArmory() {
        let previous = this.view;
        if (previous === 'game') this.paused = true;
        this.openModal(
          'armory',
          `<div class="eyebrow">FLOTILLA REQUISITIONS / ∞ UPGRADE RESOURCES / TEST MODE</div><h1>What we carry forward.</h1><p style="font-size:13px">Permanent expedition upgrades. Free upgrades for testing. Resource collection will be added later. Changes apply to new battles.</p><div class="armory-grid">${Object.entries(
            META
          )
            .map(([k, m]) => {
              let n = this.profile.upgrades[k] || 0;
              return `<div class="upgrade-card"><div class="sigil" style="width:32px;height:32px">${icon(m.icon)}</div><h3>${m.name}</h3><p>${m.desc}</p><div class="upgrade-levels">${Array.from({ length: m.max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div><button class="secondary" data-upgrade="${k}" ${n >= m.max ? 'disabled' : ''}>${n >= m.max ? 'FULLY REQUISITIONED' : 'FREE · LEVEL ' + (n + 1)}</button></div>`;
            })
            .join(
              ''
            )}</div><div class="launch-row"><button class="primary" data-ui="closeModal">RETURN ↗</button></div>`,
          true
        );
      },
      buyUpgrade(key) {
        let m = META[key];
        if (!m) return;
        let n = this.profile.upgrades[key] || 0;
        if (n >= m.max) return;
        this.profile.upgrades[key] = n + 1;
        this.persist();
        this.audio.sound('research');
        this.showArmory();
      },
      showResult(result) {
        this.paused = true;
        this.clearMode();
        let s = this.game.s;
        this.audio.sound(result.win ? 'victory' : 'defeat');
        this.openModal(
          'result',
          `<div class="eyebrow">${result.win ? 'VICTORY' : 'DEFEAT'} / ${FACTIONS[s.faction].short}</div><h1>${result.win ? 'Enemy base destroyed.' : 'Command center lost.'}</h1><p>${esc(result.text)}</p><div class="result-stats"><div><strong>${formatTime(result.time)}</strong><span>BATTLE TIME</span></div><div><strong>${s.stats.kills}</strong><span>HOSTILES NEUTRALIZED</span></div><div><strong>${s.stats.lost}</strong><span>UNITS LOST</span></div><div><strong>${Math.floor(s.stats.gathered).toLocaleString()}</strong><span>ALLOY HARVESTED</span></div><div><strong>${Math.round(result.integrity * 100)}%</strong><span>COMMAND INTEGRITY</span></div><div><strong>${result.score.toLocaleString()}</strong><span>SCORE</span></div></div><div class="launch-row"><button class="primary" data-ui="restart">DEPLOY AGAIN ↗</button><button class="secondary" data-ui="home">MAIN MENU</button></div>`,
          true
        );
      }
    });
