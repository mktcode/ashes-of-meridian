    /* Front end, local checkpoints, permanent upgrades, HUD, controls, field manual. */
    'use strict';
    const $ = id => document.getElementById(id);
    const esc = s =>
      String(s ?? '').replace(
        /[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
      );
    class MeridianUI {
      constructor(game, renderer, audio, profile, persistence) {
        this.persistence = persistence;
        this.game = game;
        this.R = renderer;
        this.audio = audio;
        this.profile = profile;
        this.view = 'home';
        this.paused = true;
        this.modalKind = '';
        this.sellBuildingId = null;
        this.buildingActionsClosed = false;
        this.selected = [];
        this.tab = 'orders';
        this.mode = null;
        this.hover = null;
        this.pointer = { x: innerWidth / 2, y: innerHeight / 2, inside: false };
        this.drag = null;
        this.pings = [];
        this.lastClick = {};
        this.radioUntil = 0;
        this.toastUntil = 0;
        this.actionSignature = '';
        this.hudClock = 0;
        this.lastSaveTime = 0;
        this.touchPoints = new Map();
        this.bind();
        this.setControlHints();
      }
      persist() {
        this.persistence.saveProfile(this.profile);
      }
      toast(text) {
        $('toast').textContent = text;
        $('toast').classList.add('show');
        this.toastUntil = performance.now() + 3500;
      }
      alert(data) {
        let d = typeof data === 'string' ? { text: data } : data,
          el = document.createElement('div');
        el.className = 'alert' + (d.danger ? ' danger' : '');
        el.textContent = d.text;
        $('alerts').appendChild(el);
        if (Number.isFinite(d.x)) {
          el.style.pointerEvents = 'auto';
          el.style.cursor = 'pointer';
          el.onclick = () => this.center(d.x, d.z);
        }
        setTimeout(() => el.remove(), 5800);
        while ($('alerts').children.length > 5) $('alerts').firstChild.remove();
      }
      radio(text) {
        if (!text) return;
        let parts = text.split('|'),
          name = parts.length > 1 ? parts[0] : 'Expedition command',
          body = parts.length > 1 ? parts.slice(1).join('|') : parts[0];
        $('radioName').textContent = name + ' / SECURE CHANNEL';
        $('radioText').textContent = body;
        $('radio').classList.remove('hidden');
        $('radio').querySelector('.radio-avatar').firstChild.textContent = name
          .split(' ')
          .map(w => w[0])
          .slice(0, 2)
          .join('');
        this.radioUntil = performance.now() + Math.max(7000, body.length * 54);
        this.audio.sound('radio');
      }
      event(type, data) {
        if (type === 'start') {
          this.view = 'game';
          this.paused = false;
          this.modalKind = '';
          this.sellBuildingId = null;
          this.lastClick = {};
          this.buildingActionsClosed = false;
          $('menu').classList.add('hidden');
          $('modal').classList.add('hidden');
          $('hud').classList.remove('hidden');
          $('radio').classList.add('hidden');
          $('alerts').innerHTML = '';
          this.selected = [];
          this.mode = null;
          this.tab = 'orders';
          this.actionSignature = '';
          this.lastSaveTime = this.game.s.time;
          this.updateHUD(true);
          this.clearMode();
        } else if (type === 'toast') this.toast(data);
        else if (type === 'radio') this.radio(data);
        else if (type === 'alert') this.alert(data);
        else if (type === 'order') {
          this.audio.sound('order');
          if (Number.isFinite(data.x))
            this.pings.push({
              x: data.x,
              z: data.z,
              life: 1,
              maxLife: 1,
              color:
                data.type === 'attackMove' || data.type === 'attack'
                  ? 0xeebc81
                  : FACTIONS[this.game.s.faction].color
            });
        } else if (type === 'result') this.showResult(data);
        else if (type === 'shot') {
          let p = this.R.project(data.x, 1, data.z);
          if (p && p.x > 0 && p.x < innerWidth && p.y > 60 && p.y < innerHeight - 210)
            this.audio.sound('shot', data.heavy);
        } else if (type === 'explosion') {
          let p = this.R.project(data.x, 1, data.z);
          if (p && p.x > -100 && p.x < innerWidth + 100 && p.y > -100 && p.y < innerHeight)
            this.audio.sound('explosion', data.big);
        } else if (type === 'complete') {
          this.audio.sound('complete');
          this.alert({
            text: buildingName(data.type, this.game.s.faction) + ' complete.',
            x: data.x,
            z: data.z
          });
          this.actionSignature = '';
        } else if (type === 'trained') {
          this.audio.sound('trained');
          if (data.type === 'hero')
            this.radio('Expedition command|Commander reconstructed and ready.');
          this.actionSignature = '';
        } else if (type === 'wave') {
          this.audio.sound('wave');
          this.pings.push({ ...data, life: 5, maxLife: 5, color: 0xf38f83 });
          this.alert({
            text: 'Hostile wave ' + data.wave + ' is advancing.',
            danger: true,
            x: data.x,
            z: data.z
          });
        } else if (['scan', 'heal', 'queued', 'select'].includes(type))
          this.audio.sound(type);
      }
      showHome() {
        if (this.view === 'game' && this.game.s && !this.game.s.result) this.save(false);
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
        let saved = this.persistence.hasCheckpoint();
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
                ${saved ? '<button class="primary" data-ui="continue">Resume operation <span aria-hidden="true">→</span></button>' : ''}
                <button class="${saved ? 'secondary' : 'primary'}" data-ui="battle">New battle <span aria-hidden="true">→</span></button>
              </div>
              <nav class="menu-subnav" aria-label="More options"><button class="textbtn" data-ui="armory">FLEET UPGRADES</button><button class="textbtn" data-ui="help">FIELD MANUAL</button><button class="textbtn" data-ui="settings">SETTINGS</button></nav>
            </div>
            <div class="menu-quote">One objective.<br>Destroy the enemy base.<small>REPEATABLE BATTLES / PERMANENT UPGRADES</small></div>
            <footer class="menu-footer"><span class="menu-status"><span class="menu-beacon" aria-hidden="true"></span>3 CIVILIZATIONS · ONE OBJECTIVE</span><span class="menu-progress">LOCAL & OFFLINE</span></footer>
          </div></div>`;
      }
      difficultyOptions() {
        return Object.entries(DIFFICULTY)
          .map(
            ([k, d]) =>
              `<option value="${k}" ${this.profile.settings.difficulty === k ? 'selected' : ''}>${d.name}</option>`
          )
          .join('');
      }
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
            )}</select></div><div class="settings-row"><label>Difficulty<small>Story is forgiving. Veteran brings larger, stronger attacks.</small></label><select id="battleDifficulty">${this.difficultyOptions()}</select></div><div class="settings-row"><label>Map seed<small>Use the same seed to replay a battlefield.</small></label><input id="battleSeed" type="number" value="${Math.floor(Math.random() * 900000) + 100000}" min="1" max="999999999" style="width:155px;background:#172333;border:1px solid #68809855;padding:11px;color:#c9dbde;font:12px var(--mono)"></div></div><div class="launch-row" style="justify-content:space-between"><span class="battle-note">FULL ARSENAL · FLEET UPGRADES ACTIVE</span><button class="primary" data-ui="startBattle">START BATTLE ↗</button></div></div></div>`;
      }
      startBattle() {
        let enemy = +$('battleEnemy').value, biome = $('battleBiome').value,
          difficulty = $('battleDifficulty').value,
          seed = clamp(parseInt($('battleSeed').value) || Math.floor(Math.random() * 1e8), 1, 999999999);
        this.profile.settings.difficulty = difficulty;
        this.persist();
        this.audio.unlock();
        this.game.start({ faction: this.battleFaction, difficulty, seed, enemy, biome });
        this.save(false);
      }
      openModal(kind, html, wide = false) {
        if (kind !== 'sell') this.sellBuildingId = null;
        $('buildingActions').classList.add('hidden');
        this.modalKind = kind;
        $('modal').innerHTML =
          `<div class="modal-shade"><div class="modal-card ${wide ? 'wide' : ''}">${html}</div></div>`;
        $('modal').classList.remove('hidden');
      }
      closeModal() {
        let kind = this.modalKind;
        this.modalKind = '';
        $('modal').classList.add('hidden');
        if (this.view === 'game' && !this.game.s?.result) {
          if (kind === 'pause') this.paused = false;
          else this.showPause();
        } else if (kind === 'armory') this.showHome();
      }
      pause() {
        if (this.view !== 'game' || !this.game.s || this.game.s.result) return;
        this.paused = true;
        this.clearMode();
        this.showPause();
      }
      showPause() {
        let s = this.game.s;
        if (!s) return;
        this.paused = true;
        this.openModal(
          'pause',
          `<div class="eyebrow">OPERATION PAUSED / ${formatTime(s.time)}</div><h1>Annihilation</h1><div class="btnstack"><button class="primary" data-ui="resume">RESUME OPERATION <span>↗</span></button><button class="secondary" data-ui="save">SAVE CHECKPOINT</button><button class="secondary" data-ui="load" ${this.persistence.hasCheckpoint() ? '' : 'disabled'}>LOAD CHECKPOINT</button><button class="secondary" data-ui="settings">SETTINGS & GAME SPEED</button><button class="secondary" data-ui="help">FIELD MANUAL</button><button class="textbtn" data-ui="restartConfirm">RESTART OPERATION</button><button class="textbtn" data-ui="home">SAVE & RETURN TO MAIN MENU</button></div><p style="font-size:11px;margin-bottom:0">Your operation is saved automatically every 45 seconds. Export a backup in Settings before changing browsers or moving the game file.</p>`
        );
      }
      resume() {
        this.paused = false;
        this.modalKind = '';
        $('modal').classList.add('hidden');
        this.audio.unlock();
      }
      save(announce = true) {
        if (!this.game.s || this.game.s.result) return false;
        let ok = this.persistence.saveCheckpoint(this.game.snapshot());
        this.lastSaveTime = this.game.s.time;
        if (announce) {
          this.toast(
            ok
              ? 'Operation checkpoint saved.'
              : 'Browser storage is unavailable. Use Settings → Export backup.'
          );
          this.audio.sound('complete');
        }
        return ok;
      }
      load() {
        try {
          const checkpoint = this.persistence.readCheckpoint();
          if (!checkpoint.exists) {
            this.toast('No operation checkpoint found.');
            return;
          }
          this.game.restore(checkpoint.state);
          this.selected = [];
          this.actionSignature = '';
          this.audio.unlock();
          this.radio('Expedition command|Checkpoint restored. Your orders stand.');
          this.updateHUD(true);
        } catch (e) {
          this.toast('Checkpoint could not be loaded: ' + e.message);
        }
      }
      showSettings() {
        if (this.view === 'game') this.paused = true;
        let st = this.profile.settings;
        this.openModal(
          'settings',
          `<div class="eyebrow">EXPEDITION PREFERENCES</div><h1>Systems & sound.</h1><div class="settings-row"><label>Render quality<small>Reduce quality for older graphics hardware.</small></label><select data-setting="quality"><option value="2" ${st.quality === 2 ? 'selected' : ''}>High · shadows & glow</option><option value="1" ${st.quality === 1 ? 'selected' : ''}>Balanced · native resolution</option><option value="0" ${st.quality === 0 ? 'selected' : ''}>Performance · no shadows</option></select></div><div class="settings-row"><label>Master volume</label><input type="range" min="0" max="1" step=".01" value="${st.volume}" data-setting="volume"></div><div class="settings-row"><label>Atmospheric soundtrack</label><input type="checkbox" data-setting="music" ${st.music ? 'checked' : ''}></div><div class="settings-row"><label>Battlefield audio</label><input type="checkbox" data-setting="sfx" ${st.sfx ? 'checked' : ''}></div><div class="settings-row"><label>Always show health bars</label><input type="checkbox" data-setting="healthbars" ${st.healthbars ? 'checked' : ''}></div>${
            this.game.s
              ? `<div class="settings-row"><label>Simulation speed</label><select id="settingSpeed">${[
                  [0.75, '0.75× · deliberate'],
                  [1, '1× · standard'],
                  [1.5, '1.5× · fast'],
                  [2, '2× · accelerated']
                ]
                  .map(
                    ([v, l]) =>
                      `<option value="${v}" ${this.game.s.speed === v ? 'selected' : ''}>${l}</option>`
                  )
                  .join('')}</select></div>`
              : ''
          }<div class="launch-row"><button class="primary" data-ui="closeModal">DONE</button><button class="textbtn" data-ui="export">EXPORT BACKUP</button><button class="textbtn" data-ui="import">IMPORT BACKUP</button></div><p style="font-size:10px">Everything stays in this browser. No accounts, analytics, external assets, or network requests. Export includes permanent upgrades and your current battle.</p>`
        );
      }
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
      }
      exportBackup() {
        let operation = this.game.s && !this.game.s.result ? this.game.snapshot() : null;
        let data = this.persistence.serializeBackup(this.profile, operation),
          blob = new Blob([data], { type: 'application/json' }),
          url = URL.createObjectURL(blob),
          a = document.createElement('a');
        a.href = url;
        a.download = 'meridian-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.toast('Backup exported.');
      }
      async importBackup(file) {
        if (!file) return;
        if (file.size > 4000000) {
          this.toast('Backup is too large.');
          return;
        }
        try {
          let d = this.persistence.parseBackup(await file.text());
          this.persistence.saveProfile(d.profile);
          let valid = this.persistence.loadProfile();
          Object.assign(this.profile, valid);
          this.audio.settings = this.profile.settings;
          this.audio.updateSettings();
          this.R.quality = this.profile.settings.quality;
          this.R.resize();
          if (d.operation) this.persistence.saveCheckpoint(d.operation);
          this.game.s = null;
          this.showHome();
          this.toast('Upgrades and checkpoint imported.');
        } catch (e) {
          this.toast('Import failed: ' + e.message);
        }
      }
      showHelp() {
        if (this.view === 'game') this.paused = true;
        this.openModal(
          'help',
          `<div class="eyebrow">MERIDIAN FIELD MANUAL</div><h1>Bring your people home.</h1><div class="help-grid"><div><h3>Command your force</h3>${[
            ['Select', 'Tap unit or structure'],
            ['Context order / rally point', 'Right click'],
            ['Attack-move', 'Attack-move button → tap destination'],
            ['Move / hold / stop', 'Buttons in Command'],
            ['Select all combat units', 'Combat force button'],
            ['Select next worker', 'Next worker button'],
            ['Select visible units of a type', 'Double-tap unit'],
            ['Select visible combat units (no workers)', 'Triple-tap unit']
          ]
            .map(([a, b]) => `<div class="help-line"><span>${a}</span><span class="help-input">${b}</span></div>`)
            .join('')}<h3>Navigate</h3>${[
            ['Pan camera', 'Drag with one finger'],
            ['Zoom', 'Pinch / ＋ and − buttons'],
            ['Center on base', '⌂ / Command view button'],
            ['Navigate / issue order on minimap', 'Left / right click']
          ]
            .map(([a, b]) => `<div class="help-line"><span>${a}</span><span class="help-input">${b}</span></div>`)
            .join(
              ''
            )}</div><div><h3>Economy & production</h3><p style="font-size:12px">Workers automatically harvest <b>alloy</b> and return it to command. Recruit more at headquarters. Place a <b>refinery within 8 meters of a vent</b> for aether; it runs without an assigned worker.</p><p style="font-size:12px">Use <b>Build</b>, choose a structure, then tap open, explored ground. One worker is assigned to construct it. Select a completed own building for its <b>Repair</b> and <b>Sell</b> buttons. Repair sends the nearest worker and costs 0.1 alloy per hull; tap again to stop. Without workers, repair is unavailable. Selling refunds 50% of the building’s purchase value plus all pending recruitment costs; the last completed command center cannot be sold. Workers can still repair damaged own units and structures via context orders.</p><p style="font-size:12px"><b>Depots add 16 supply.</b> Queued troops reserve their supply. Multiple production structures recruit in parallel. Click a queue entry to cancel it and recover its resources.</p><h3>Battlefield rules</h3><p style="font-size:12px">Attack-move stops to engage enemies; ordinary move prioritizes reaching the destination. Medics heal automatically. Tanks and artillery cannot attack aircraft. Artillery needs spotters and cannot fire at close range. Veterans earn stronger weapons after five kills.</p><p style="font-size:12px">Scouts and scans reveal fog-of-war. Destroy the enemy command center to win. Losing your last command center ends the battle.</p></div></div><h3>Command abilities & operation controls</h3><div class="help-grid">${[
            ['Command abilities', 'Ability buttons in Command → tap target'],
            ['Command / build / recruit', 'Tabs on the command deck'],
            ['Pause', 'Ⅱ button'],
            ['Cancel targeting / placement', 'Cancel button beside the target prompt'],
            ['Save / load checkpoint', 'Save / Load in the pause menu'],
            ['Field manual', '? button']
          ]
            .map(([a, b]) => `<div class="help-line"><span>${a}</span><span class="help-input">${b}</span></div>`)
            .join(
              ''
            )}</div><p style="font-size:11px">On touch screens: tap a unit, then a destination or enemy. Drag the battlefield to pan. Tap structures to inspect them.</p><p style="font-size:11px">Fleet upgrades apply to new battles. Upgrade resources are unlimited for testing; resource collection and unlocks will be added later.</p><div class="launch-row"><button class="primary" data-ui="closeModal">RETURN TO COMMAND ↗</button></div>`,
          true
        );
      }
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
      }
      buyUpgrade(key) {
        let m = META[key];
        if (!m) return;
        let n = this.profile.upgrades[key] || 0;
        if (n >= m.max) return;
        this.profile.upgrades[key] = n + 1;
        this.persist();
        this.audio.sound('research');
        this.showArmory();
      }
      showResult(result) {
        this.paused = true;
        this.clearMode();
        let s = this.game.s;
        if (result.win) this.persistence.removeCheckpoint();
        this.audio.sound(result.win ? 'victory' : 'defeat');
        this.openModal(
          'result',
          `<div class="eyebrow">${result.win ? 'VICTORY' : 'DEFEAT'} / ${FACTIONS[s.faction].short}</div><h1>${result.win ? 'Enemy base destroyed.' : 'Command center lost.'}</h1><p>${esc(result.text)}</p><div class="result-stats"><div><strong>${formatTime(result.time)}</strong><span>BATTLE TIME</span></div><div><strong>${s.stats.kills}</strong><span>HOSTILES NEUTRALIZED</span></div><div><strong>${s.stats.lost}</strong><span>UNITS LOST</span></div><div><strong>${Math.floor(s.stats.gathered).toLocaleString()}</strong><span>ALLOY HARVESTED</span></div><div><strong>${Math.round(result.integrity * 100)}%</strong><span>COMMAND INTEGRITY</span></div><div><strong>${result.score.toLocaleString()}</strong><span>SCORE</span></div></div><div class="launch-row"><button class="primary" data-ui="restart">DEPLOY AGAIN ↗</button>${!result.win && this.persistence.hasCheckpoint() ? '<button class="secondary" data-ui="load">RETRY CHECKPOINT</button>' : ''}<button class="secondary" data-ui="home">MAIN MENU</button><button class="textbtn" data-ui="armory">FLEET UPGRADES</button></div>`,
          true
        );
      }
      center(x, z) {
        if (!this.game.s) return;
        this.game.s.cam.x = clamp(x, -72, 72);
        this.game.s.cam.z = clamp(z, -72, 72);
      }
      homeCamera() {
        let e = this.game.alive(e => e.team === 0 && e.type === 'hq')[0];
        if (e) this.center(e.x + 4, e.z - 2);
      }
      select(ids) {
        this.buildingActionsClosed = false;
        this.selected = [...new Set(ids)].filter(id => this.game.get(id));
        this.actionSignature = '';
        this.audio.sound('select');
        this.updateSelection();
        if (this.selected.length === 1) {
          let e = this.game.get(this.selected[0]);
          if (e?.team === 0 && e.kind === 'building') {
            if (['hq', 'barracks', 'factory', 'hangar'].includes(e.type)) this.tab = 'army';
          }
        }
        this.renderActions();
      }
      selectArmy() {
        this.select(
          this.game
            .alive(e => e.team === 0 && e.kind === 'unit' && e.type !== 'worker')
            .map(e => e.id)
        );
      }
      selectWorker() {
        let list = this.game.alive(e => e.team === 0 && e.type === 'worker');
        if (!list.length) {
          this.toast('Recruit a worker at command.');
          return;
        }
        let i = list.findIndex(e => this.selected.includes(e.id));
        let idle = list.find(e => e.order.type === 'idle');
        let e = idle || list[(i + 1) % list.length];
        this.select([e.id]);
        this.center(e.x, e.z);
      }
      setTab(tab) {
        this.tab = tab;
        this.actionSignature = '';
        this.renderActions();
      }
      setMode(kind, arg) {
        if (this.paused) return;
        if (kind === 'build') {
          let reason = this.game.canBuild(arg);
          if (reason) {
            this.toast(reason);
            return;
          }
        }
        $('buildingActions').classList.add('hidden');
        this.mode = { kind, arg };
        let text =
          kind === 'build'
            ? `PLACE ${buildingName(arg, this.game.s.faction).toUpperCase()}`
            : kind === 'ability'
              ? {
                  orbital: 'TARGET ORBITAL STRIKE',
                  repair: 'DEPLOY REPAIR FIELD',
                  scan: 'SELECT SCAN AREA',
                  drop: 'DEPLOY REINFORCEMENTS'
                }[arg]
              : kind === 'rally'
                ? 'SET RALLY POINT'
                : kind === 'attackMove'
                  ? 'ATTACK-MOVE'
                  : 'MOVE ORDER';
        $('modeLabel').textContent = text + ' · TAP TO CONFIRM';
        $('modeIndicator').classList.remove('hidden');
        $('world').style.cursor = 'crosshair';
        this.actionSignature = '';
        this.renderActions();
      }
      clearMode() {
        this.mode = null;
        $('modeIndicator').classList.add('hidden');
        $('world').style.cursor = 'default';
        this.actionSignature = '';
      }
      perform(action) {
        if (!this.game.s) return;
        let [kind, arg] = action.split(':');
        if (kind === 'tab') {
          this.setTab(arg);
          return;
        }
        if (kind === 'train') {
          if (!this.paused) this.game.train(arg, this.selected[0]);
          return;
        }
        if (kind === 'build') {
          this.setMode('build', arg);
          return;
        }
        if (kind === 'ability') {
          this.setMode('ability', arg);
          return;
        }
        switch (kind) {
          case 'attackMove':
          case 'move':
          case 'rally':
            this.setMode(kind);
            break;
          case 'hold':
          case 'stop':
            this.game.command(this.selected, { type: kind });
            break;
          case 'army':
            this.selectArmy();
            break;
          case 'worker':
            this.selectWorker();
            break;
          case 'home':
            this.homeCamera();
            break;
          case 'cancelBuild':
            this.game.cancelConstruction(this.selected[0]);
            break;
        }
      }
      actionButton(key, label, ic, opts = {}) {
        let badge = opts.badge || '';
        return `<button class="action ${opts.disabled ? 'disabled' : ''} ${this.mode && (key === 'build:' + this.mode.arg || key === 'ability:' + this.mode.arg || key === this.mode.kind) ? 'active' : ''}" data-action="${key}">${icon(ic)}<span>${label}</span>${opts.cost ? `<span class="cost">${opts.cost.cost}◆${opts.cost.gas ? ' ' + opts.cost.gas + '⬡' : ''}</span>` : ''}<small data-badge="${key}">${badge}</small></button>`;
      }
      renderActions() {
        let s = this.game.s;
        if (!s) return;
        let sig =
          this.tab +
          ':' +
          this.selected.join(',') +
          ':' +
          (this.mode ? this.mode.kind + this.mode.arg : '');
        if (sig === this.actionSignature) return;
        this.actionSignature = sig;
        for (let b of document.querySelectorAll('.tabs [data-tab]'))
          b.classList.toggle('active', b.dataset.tab === this.tab);
        let html = '',
          f = s.faction;
        if (this.tab === 'orders') {
          for (let [k, l, ic] of [
            ['attackMove', 'Attack-move', 'attack'],
            ['move', 'Move', 'move'],
            ['hold', 'Hold', 'hold'],
            ['stop', 'Stop', 'stop'],
            ['army', 'Combat force', 'rifle'],
            ['worker', 'Next worker', 'worker'],
            ['ability:orbital', 'Orbital strike', 'orbital'],
            ['ability:repair', 'Repair field', 'heal'],
            ['ability:scan', 'Recon scan', 'scan'],
            ['ability:drop', 'Reinforcements', 'drop'],
            ['rally', 'Rally point', 'rally'],
            ['home', 'Command view', 'hq']
          ])
            html += this.actionButton(k, l, ic);
        } else if (this.tab === 'build') {
          let labels = {
            hq: 'Command',
            barracks: 'Muster',
            depot: 'Supply',
            refinery: 'Refinery',
            factory: 'Foundry',
            hangar: 'Flight deck',
            turret: 'Turret'
          };
          for (let k of Object.keys(BUILDINGS)) {
            html += this.actionButton(
              'build:' + k,
              f === 0 ? labels[k] : buildingName(k, f).split(' ').slice(-1)[0],
              k,
              { cost: this.game.cost(k, 'building') }
            );
          }
          let selected = this.game.get(this.selected[0]);
          if (selected?.kind === 'building' && selected.team === 0 && selected.progress < 1)
            html += this.actionButton('cancelBuild', 'Cancel build', 'cancel');
        } else if (this.tab === 'army') {
          for (let [k, d] of Object.entries(UNITS)) {
            if (!d.from) continue;
            html += this.actionButton('train:' + k, k === 'hero' ? 'Commander' : unitName(k, f), k, {
              cost: this.game.cost(k)
            });
          }
        }
        $('actions').innerHTML = '<div class="action-grid">' + html + '</div>';
        $('contextLabel').textContent =
          this.tab === 'orders'
            ? 'COMMAND LINK ONLINE'
            : this.tab === 'build'
              ? 'SELECT A FOUNDATION'
              : 'PARALLEL PRODUCTION';
      }
      closeBuildingActions() {
        this.buildingActionsClosed = true;
        $('buildingActions').classList.add('hidden');
      }
      updateBuildingActions() {
        let panel = $('buildingActions'), g = this.game,
          b = this.view === 'game' && g.s && !this.paused && !this.modalKind && !this.mode &&
            this.selected.length === 1 ? g.managedBuilding(this.selected[0]) : null;
        if (!b || this.buildingActionsClosed) {
          panel.classList.add('hidden');
          return;
        }
        let p = this.R.project(b.x, Math.min(8, b.size + 2.5), b.z),
          top = $('topbar').getBoundingClientRect().bottom + 8,
          bottom = $('commandDeck').getBoundingClientRect().top - 8;
        if (!p || p.x < 0 || p.x > innerWidth || p.y < top - 8 || p.y > bottom + 8) {
          this.closeBuildingActions();
          return;
        }
        // Do not move or relabel a button under a finger while it is being pressed.
        if (this.domPressed) return;
        let repairing = g.buildingRepairers(b.id).length > 0,
          repairReason = repairing ? '' : g.canRepairBuilding(b.id), sellReason = g.canSellBuilding(b.id);
        $('buildingActionName').textContent = buildingName(b.type, b.faction);
        for (let button of panel.querySelectorAll('[data-building-action]')) {
          button.dataset.buildingId = b.id;
          button.disabled = !!(button.dataset.buildingAction === 'repair' ? repairReason : sellReason);
          if (button.dataset.buildingAction === 'repair') button.textContent = repairing ? 'STOP REPAIR' : 'REPAIR';
        }
        $('buildingActionStatus').textContent = [repairing ? 'Worker assigned' : repairReason, sellReason].filter(Boolean).join(' · ') || '38 hull/s · 0.1 alloy/hull';
        panel.classList.remove('hidden');
        let w = panel.offsetWidth, h = panel.offsetHeight,
          x = clamp(p.x - w / 2, 8, innerWidth - w - 8),
          y = clamp(p.y - h - 12, top, Math.max(top, bottom - h)),
          tools = $('cameraTools').getBoundingClientRect();
        if (x < tools.right + 8 && x + w > tools.left - 8 && y + h > tools.top - 8 && y < tools.bottom + 8) {
          // Keep camera/help buttons usable, even in the narrow landscape play area.
          if (tools.top - h - 8 >= top) y = tools.top - h - 8;
          else x = Math.max(8, tools.left - w - 8);
        }
        panel.style.left = x + 'px';
        panel.style.top = y + 'px';
      }
      buildingAction(action, id) {
        if (this.view !== 'game' || this.paused || this.modalKind || this.mode || !this.game.s || this.game.s.result) return;
        if (action === 'repair') {
          this.game.toggleBuildingRepair(id);
          this.updateBuildingActions();
        } else if (action === 'sell') {
          let reason = this.game.canSellBuilding(id);
          if (reason) { this.toast(reason); return; }
          let b = this.game.get(id), refund = this.game.buildingSaleRefund(id);
          this.sellBuildingId = id;
          this.paused = true;
          this.clearMode();
          this.openModal('sell',
            `<div class="eyebrow">SELL STRUCTURE</div><h1>Sell ${esc(buildingName(b.type, b.faction))}?</h1><p>Refund: <b>${refund.cost} alloy / ${refund.gas} aether</b>.</p><p>Includes 50% of the building’s purchase value and a full refund for all ${b.queue.length} pending recruitments. The structure is removed immediately; supply capacity may decrease.</p><div class="launch-row"><button class="primary" data-ui="confirmSale">SELL STRUCTURE</button><button class="secondary" data-ui="cancelSale">KEEP STRUCTURE</button></div>`);
        }
      }
      finishBuildingSale(confirm) {
        if (this.modalKind !== 'sell' || this.view !== 'game' || !this.game.s || this.game.s.result) return;
        let id = this.sellBuildingId;
        this.sellBuildingId = null;
        if (confirm) this.game.sellBuilding(id);
        this.resume();
        this.updateHUD(true);
      }
      updateSelection() {
        let s = this.game.s;
        if (!s) return;
        this.selected = this.selected.filter(id => this.game.get(id));
        $('selectCount').textContent = this.selected.length ? this.selected.length + ' SELECTED' : '';
        if (!this.selected.length) {
          $('selectionContent').innerHTML =
            '<div class="selection-empty"><div class="eyebrow">AWAITING YOUR ORDERS</div>Select a unit or structure.<p>Double-tap for visible units of its type; triple-tap for all visible combat units (no workers).</p></div>';
          return;
        }
        if (this.selected.length > 1) {
          $('selectionContent').innerHTML = `<div class="squad-grid">${this.selected
            .slice(0, 40)
            .map(id => {
              let e = this.game.get(id);
              return `<button class="squad-icon" data-select="${id}" aria-label="${esc(unitName(e.type, e.faction))}">${icon(e.type)}<i style="width:${Math.max(1, (e.hp / e.maxHp) * 27)}px"></i></button>`;
            })
            .join(
              ''
            )}</div><div class="unit-order">${this.selected.length > 40 ? '+' + (this.selected.length - 40) + ' ADDITIONAL UNITS · ' : ''}${this.selected.length} CONTACTS / GROUP COMMAND ACTIVE</div>`;
          return;
        }
        let e = this.game.get(this.selected[0]),
          d = e.kind === 'building' ? BUILDINGS[e.type] : UNITS[e.type] || {},
          name =
            e.label ||
            (e.kind === 'building'
              ? buildingName(e.type, e.faction)
              : e.kind === 'resource'
                ? e.type === 'gas'
                  ? 'Aether vent'
                  : 'Alloy crystals'
                : unitName(e.type, e.faction)),
          order =
            e.kind === 'building'
              ? e.progress < 1
                ? 'CONSTRUCTION ' + Math.floor(e.progress * 100) + '%'
                : e.queue.length
                  ? 'PRODUCING ' + unitName(e.queue[0].type, e.faction).toUpperCase()
                  : 'STRUCTURE OPERATIONAL'
              : e.order?.type === 'mine'
                ? 'HARVESTING · ' + Math.round(e.carry) + ' ALLOY'
                                  : (e.order?.type || 'idle').replace(/([A-Z])/g, ' $1').toUpperCase();
        let stats = this.game.rangedStats(
          e.kind === 'resource' ? { ...e, kind: 'unit', type: 'worker' } : e
        );
        $('selectionContent').innerHTML =
          `<div class="unit-summary"><div class="unit-portrait" style="color:${e.team === 1 ? 'var(--red)' : 'var(--teal)'}">${icon(e.type === 'gas' ? 'energy' : e.type === 'crystal' ? 'crystal' : e.type)}</div><div class="unit-detail"><h3>${esc(name)}${e.kills >= 5 ? ' ★' : ''}</h3><small>${e.team === 1 ? 'HOSTILE' : e.team === -1 ? 'NEUTRAL' : FACTIONS[e.faction].short}</small><div class="hp-line"><i style="width:${clamp((e.hp / e.maxHp) * 100, 0, 100)}%;background:${e.team === 1 ? 'var(--red)' : 'var(--teal)'}"></i></div><div class="hp-number">${Math.ceil(e.hp)} / ${Math.round(e.maxHp)} HULL${e.maxShield ? ' + ' + Math.ceil(e.shield) + ' SHIELD' : ''}</div></div></div><div class="unit-stats"><div>DAMAGE<b>${Math.round(stats.damage || 0)}</b></div><div>RANGE<b>${stats.range || '—'}</b></div>${e.kind === 'resource' ? `<div>REMAINING<b>${e.type === 'gas' ? '∞' : Math.round(e.amount)}</b></div>` : ''}</div><div class="unit-order">${esc(order)}</div>`;
      }
      updateQueues() {
        let s = this.game.s,
          all = this.game.alive(e => e.team === 0 && e.queue?.length),
          sel = this.selected
            .map(id => this.game.get(id))
            .find(e => e?.kind === 'building' && e.queue.length),
          list = sel ? [sel, ...all.filter(e => e.id !== sel.id)] : all,
          html = '';
        for (let b of list)
          for (let [i, q] of b.queue.entries()) {
            html += `<button class="queue-item" data-queue="${b.id}:${i}" aria-label="${esc(unitName(q.type, s.faction))} · cancel recruitment">${unitName(q.type, s.faction).slice(0, 8)} ${i === 0 ? Math.ceil(q.time * (1 - q.progress)) + 's' : '…'}<i style="width:${q.progress * 100}%"></i></button>`;
            if (html.length > 1500) break;
          }
        $('productionQueue').innerHTML =
          '<span class="queue-label">' +
          (html ? 'IN PRODUCTION' : 'PRODUCTION IDLE') +
          '</span>' +
          html;
      }
      updateHUD(force = false) {
        let s = this.game.s;
        if (!s) return;
        $('alloyCount').textContent = Math.floor(s.alloy).toLocaleString();
        $('gasCount').textContent = Math.floor(s.gas).toLocaleString();
        $('supplyCount').textContent = this.game.supply() + ' / ' + this.game.cap();
        $('supplyCount').style.color = this.game.supply() >= this.game.cap() ? 'var(--red)' : '';
        $('energyCount').textContent = Math.floor(s.energy);
        $('gameTime').textContent = formatTime(s.time);
        $('speedLabel').textContent = s.speed + '× ' + DIFFICULTY[s.difficulty].name.toUpperCase();
        $('battleLabel').innerHTML = 'Annihilation' + `<small>SEED ${s.seed}</small>`;
        $('biomeLabel').textContent = BIOMES[s.biome].name;
        let rows = this.game.objectiveRows();
        $('objectives').innerHTML =
          '<div class="eyebrow">◈ BATTLE OBJECTIVE</div><div id="objectiveRows">' +
          rows
            .map(
              r =>
                `<div class="objective-row ${r.done ? 'complete' : ''}"><span class="check">${r.done ? '✓' : '◇'}</span><div>${esc(r.text)}${!r.sub && r.max < 30 ? ' <span class="objective-sub">' + Math.min(r.max, Math.floor(r.current)) + '/' + r.max + '</span>' : ''}${r.sub ? '<div class="objective-sub">' + esc(r.sub) + '</div>' : ''}<div class="progress"><i style="width:${clamp((r.current / r.max) * 100, 0, 100)}%;${r.done ? 'background:var(--teal)' : ''}"></i></div></div></div>`
            )
            .join('') +
          '</div>';
        let wait = s.nextWave - s.time;
        $('waveBanner').classList.toggle('hidden', wait > 15 || this.paused);
        if (wait <= 15)
          $('waveBanner').textContent =
            '⚠ HOSTILE WAVE ' + (s.wave + 1) + ' · ' + Math.max(0, Math.ceil(wait)) + 's';
        this.updateSelection();
        this.renderActions();
        this.updateQueues();
        for (let b of document.querySelectorAll('[data-action]')) {
          let [k, arg] = b.dataset.action.split(':');
          let disabled = false;
          if (k === 'train') {
            let d = UNITS[arg];
            disabled =
              !this.game.afford(this.game.cost(arg)) ||
              !this.game.has(d.from) ||
              this.game.supply() + d.supply > this.game.cap();
            if (arg === 'hero' && this.game.alive(e => e.team === 0 && e.type === 'hero').length)
              disabled = true;
          } else if (k === 'build')
            disabled = !!this.game.canBuild(arg) || !this.game.afford(this.game.cost(arg, 'building'));
          else if (k === 'ability') {
            let costs = { orbital: 85, repair: 45, scan: 25, drop: 95 };
            disabled = s.energy < costs[arg] || s.abilities[arg] > s.time;
            let badge = b.querySelector('small');
            if (badge)
              badge.textContent =
                s.abilities[arg] > s.time
                  ? Math.ceil(s.abilities[arg] - s.time) + 's'
                  : costs[arg] + 'ϟ';
          }
          b.classList.toggle('disabled', disabled);
        }
      }
      setControlHints() {
        $('controlstrip').innerHTML =
          `<span>TAP TO SELECT · DOUBLE-TAP TYPE · TRIPLE-TAP COMBAT</span><span>RMB SMART ORDER</span><span>DRAG TO PAN · PINCH TO ZOOM</span>`;
      }
      bind() {
        document.addEventListener('pointerdown', e => {
          this.audio.unlock();
          this.domPressed = !!e.target.closest('button,select,input');
        });
        document.addEventListener('pointerup', () => (this.domPressed = false));
        document.addEventListener('click', e => {
          let b = e.target.closest('button');
          if (!b || b.disabled) return;
          if (b.dataset.ui) {
            this.uiAction(b.dataset.ui);
            return;
          }
          if (b.dataset.faction !== undefined) {
            this.battleFaction = +b.dataset.faction;
            document
              .querySelectorAll('[data-faction]')
              .forEach(a => a.classList.toggle('active', +a.dataset.faction === this.battleFaction));
            $('factionTrait').textContent = FACTIONS[this.battleFaction].trait;
            return;
          }
          if (b.dataset.upgrade) {
            this.buyUpgrade(b.dataset.upgrade);
            return;
          }
          if (b.dataset.tab) {
            this.setTab(b.dataset.tab);
            return;
          }
          if (b.dataset.buildingAction) {
            this.buildingAction(b.dataset.buildingAction, +b.dataset.buildingId);
            return;
          }
          if (b.dataset.action) {
            if (!this.paused) this.perform(b.dataset.action);
            return;
          }
          if (b.dataset.select) {
            this.select([+b.dataset.select]);
            return;
          }
          if (b.dataset.queue && !this.paused) {
            let [id, index] = b.dataset.queue.split(':').map(Number);
            this.game.cancelQueue(id, index);
            this.updateQueues();
            return;
          }
          if (b.dataset.cam) {
            if (b.dataset.cam === 'home') this.homeCamera();
            else if (this.game.s)
              this.game.s.cam.zoom = clamp(
                this.game.s.cam.zoom * (b.dataset.cam === 'in' ? 0.85 : 1.18),
                32,
                115
              );
          }
        });
        document.addEventListener('change', e => {
          if (e.target.dataset.setting) this.applySetting(e.target);
          if (e.target.id === 'settingSpeed' && this.game.s) this.game.s.speed = +e.target.value;
        });
        document.addEventListener('input', e => {
          if (e.target.dataset.setting === 'volume') this.applySetting(e.target);
        });
        $('importFile').onchange = e => {
          this.importBackup(e.target.files[0]);
          e.target.value = '';
        };
        $('pauseBtn').onclick = () => (this.paused ? this.resume() : this.pause());
        $('battleHome').onclick = () => this.pause();
        $('helpBtn').onclick = () => this.showHelp();
        $('soundBtn').onclick = () => {
          let muted = !this.profile.settings.sfx;
          this.profile.settings.sfx = muted;
          this.profile.settings.music = muted;
          this.audio.updateSettings();
          this.persist();
          $('soundBtn').textContent = muted ? '♫' : '♪';
          this.toast(muted ? 'Audio enabled.' : 'Audio muted.');
        };
        $('radioClose').onclick = () => {
          $('radio').classList.add('hidden');
          this.radioUntil = 0;
        };
        window.addEventListener('blur', () => {
          this.drag = null;
        });
        document.addEventListener('visibilitychange', () => {
          if (document.hidden && this.view === 'game' && !this.game.s?.result) {
            this.save(false);
            this.pause();
          }
        });
        const c = $('world');
        c.addEventListener('contextmenu', e => e.preventDefault());
        c.addEventListener('pointerdown', e => this.pointerDown(e));
        c.addEventListener('pointermove', e => this.pointerMove(e));
        c.addEventListener('pointerup', e => this.pointerUp(e));
        c.addEventListener('pointercancel', () => {
          this.lastClick = {};
          this.drag = null;
          this.touchPoints.clear();
          this.touchGesture = false;
        });
        c.addEventListener('pointerleave', () => {
          this.pointer.inside = false;
          if (!this.drag) this.hover = null;
        });
        c.style.touchAction = 'none';
        let map = $('minimap');
        map.addEventListener('contextmenu', e => e.preventDefault());
        let miniDrag = false;
        map.addEventListener('pointerdown', e => {
          if (this.paused || this.view !== 'game') return;
          e.preventDefault();
          let r = map.getBoundingClientRect(),
            p = {
              x: ((e.clientX - r.left) / r.width) * 180 - 90,
              z: ((e.clientY - r.top) / r.height) * 180 - 90
            };
          if (e.button === 2) {
            this.game.command(
              this.selected,
              { type: this.mode?.kind === 'attackMove' ? 'attackMove' : 'move', ...p }
            );
            this.clearMode();
          } else if (this.mode) {
            if (this.mode.kind === 'build') {
              this.toast('Place foundations in the main battlefield view.');
              return;
            }
            this.applyTarget(p, null);
          } else {
            this.center(p.x, p.z);
            miniDrag = true;
            map.setPointerCapture(e.pointerId);
          }
        });
        map.addEventListener('pointermove', e => {
          if (!miniDrag) return;
          let r = map.getBoundingClientRect();
          this.center(
            ((e.clientX - r.left) / r.width) * 180 - 90,
            ((e.clientY - r.top) / r.height) * 180 - 90
          );
        });
        map.addEventListener('pointerup', () => (miniDrag = false));
        map.addEventListener('pointercancel', () => (miniDrag = false));
      }
      uiAction(action) {
        this.audio.sound('select');
        switch (action) {
          case 'home':
            this.showHome();
            break;
          case 'continue':
          case 'load':
            this.load();
            break;
          case 'battle':
            this.showBattle();
            break;
          case 'startBattle':
            this.startBattle();
            break;
          case 'armory':
            this.showArmory();
            break;
          case 'settings':
            this.showSettings();
            break;
          case 'help':
            this.showHelp();
            break;
          case 'resume':
            this.resume();
            break;
          case 'save':
            this.save(true);
            break;
          case 'closeModal':
            this.closeModal();
            break;
          case 'closeBuildingActions':
            this.closeBuildingActions();
            break;
          case 'confirmSale':
            this.finishBuildingSale(true);
            break;
          case 'cancelSale':
            this.finishBuildingSale(false);
            break;
          case 'cancelTarget':
            this.clearMode();
            this.renderActions();
            break;
          case 'export':
            this.exportBackup();
            break;
          case 'import':
            $('importFile').click();
            break;
          case 'restartConfirm':
            this.openModal(
              'confirm',
              `<div class="eyebrow">REDEPLOY EXPEDITION</div><h1>Start this operation again?</h1><p>Your current deployment will be replaced. Permanent upgrades are unaffected.</p><div class="launch-row"><button class="primary" data-ui="restart">RESTART</button><button class="secondary" data-ui="backPause">CANCEL</button></div>`
            );
            break;
          case 'backPause':
            this.showPause();
            break;
          case 'restart': {
            let s = this.game.s;
            this.game.start({ faction: s.faction, difficulty: s.difficulty, seed: s.seed, biome: s.biome, enemy: s.enemy });
            this.save(false);
            break;
          }
        }
      }
      pick(sx, sy) {
        let best = null,
          score = Infinity;
        for (let e of this.game.s.entities) {
          if (e.hp <= 0) continue;
          if (e.team === 1 && !this.game.visible(e)) continue;
          if (e.team === -1 && !this.game.world.explored[this.game.world.idx(e.x, e.z)]) continue;
          let y =
              e.type === 'air' ? 4.4 : e.kind === 'building' ? 2.0 : 1,
            p = this.R.project(e.x, y, e.z);
          if (!p) continue;
          let edge = this.R.project(e.x + e.size, y, e.z),
            r = Math.max(e.kind === 'unit' ? 12 : 16, edge ? Math.abs(edge.x - p.x) : 18),
            dx = (sx - p.x) / (r + 5),
            dy = (sy - p.y) / (r * 0.9 + 8),
            d = dx * dx + dy * dy;
          if (d < 1.4 && d + (e.kind === 'unit' ? -0.1 : 0) < score) {
            score = d;
            best = e;
          }
        }
        return best;
      }
      pointerDown(e) {
        if (this.view !== 'game' || this.paused) return;
        e.preventDefault();
        if (e.button === 1) return;
        this.pointer = { x: e.clientX, y: e.clientY, inside: true };
        if (e.pointerType === 'touch') {
          this.touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (this.touchPoints.size === 2) {
            let a = [...this.touchPoints.values()];
            this.pinchDist = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
            this.touchGesture = true;
            return;
          }
        }
        $('world').setPointerCapture(e.pointerId);
        this.drag = {
          sx: e.clientX,
          sy: e.clientY,
          x: e.clientX,
          y: e.clientY,
          button: e.button,
          type: e.pointerType,
          moved: false
        };
      }
      pointerMove(e) {
        this.pointer = { x: e.clientX, y: e.clientY, inside: e.target === $('world') };
        if (this.view !== 'game' || this.paused) return;
        if (e.pointerType === 'touch' && this.touchPoints.has(e.pointerId)) {
          this.touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (this.touchPoints.size === 2) {
            let a = [...this.touchPoints.values()],
              d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
            if (this.pinchDist > 0)
              this.game.s.cam.zoom = clamp(
                (this.game.s.cam.zoom * this.pinchDist) / Math.max(10, d),
                32,
                115
              );
            this.pinchDist = d;
            return;
          }
        }
        if (this.drag) {
          let drag = this.drag;
          if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
          if (drag.type === 'touch' && drag.moved) {
            let a = this.R.ground(drag.x, drag.y),
              b = this.R.ground(e.clientX, e.clientY);
            this.center(this.game.s.cam.x + a.x - b.x, this.game.s.cam.z + a.z - b.z);
          }
          drag.x = e.clientX;
          drag.y = e.clientY;
        } else {
          this.hover = this.pick(e.clientX, e.clientY)?.id || null;
          if (!this.mode) {
            let t = this.game.get(this.hover);
            $('world').style.cursor = t ? (t.team === 1 ? 'crosshair' : 'pointer') : 'default';
          }
        }
      }
      pointerUp(e) {
        let previousClick = this.lastClick;
        this.lastClick = {};
        if (e.pointerType === 'touch') this.touchPoints.delete(e.pointerId);
        if (this.touchGesture) {
          if (!this.touchPoints.size) {
            this.touchGesture = false;
            this.drag = null;
          }
          return;
        }
        if (this.view !== 'game' || this.paused) {
          this.drag = null;
          return;
        }
        let d = this.drag;
        this.drag = null;
        if (!d) return;
        let p = this.R.ground(e.clientX, e.clientY),
          target = this.pick(e.clientX, e.clientY);
        p.x = clamp(p.x, -86, 86);
        p.z = clamp(p.z, -86, 86);
        if (d.type === 'touch' && d.moved) return;
        if (d.button === 2) {
          this.game.command(
            this.selected,
            target
              ? { type: 'smart', id: target.id, x: target.x, z: target.z }
              : { type: 'move', ...p }
          );
          this.clearMode();
          return;
        }
        if (this.mode) {
          if (!d.moved) this.applyTarget(p, target);
          return;
        }
        if (d.moved) return;
        if (d.type === 'touch' && this.selected.length && (!target || target.team !== 0)) {
          this.game.command(
            this.selected,
            target ? { type: 'smart', id: target.id, x: target.x, z: target.z } : { type: 'move', ...p }
          );
          return;
        }
        if (target) {
          let now = performance.now(),
            count = previousClick.id === target.id && previousClick.type === d.type &&
              now - previousClick.time < 330 ? Math.min(3, previousClick.count + 1) : 1;
          if (count >= 2 && target.team === 0 && target.kind === 'unit') {
            let combat = d.type === 'touch' && count === 3,
              units = this.game
              .alive(e => e.team === 0 && e.kind === 'unit' &&
                (combat ? e.type !== 'worker' : e.type === target.type))
              .filter(e => {
                let q = this.R.project(e.x, 1, e.z);
                return q && q.x > 0 && q.x < innerWidth && q.y > 55 && q.y < innerHeight - 210;
              });
            this.select(units.map(e => e.id));
          } else this.select([target.id]);
          this.lastClick = { id: target.id, time: now, type: d.type, count };
        } else this.select([]);
      }
      applyTarget(p, target) {
        if (!this.mode) return;
        let m = this.mode,
          success = true;
        if (m.kind === 'build') success = this.game.build(m.arg, p, this.selected);
        else if (m.kind === 'ability') success = this.game.ability(m.arg, p);
        else if (m.kind === 'rally') {
          let list = this.selected
            .map(id => this.game.get(id))
            .filter(
              e =>
                e?.team === 0 &&
                e.kind === 'building' &&
                ['hq', 'barracks', 'factory', 'hangar'].includes(e.type)
            );
          if (!list.length) {
            this.toast('Select a production structure before setting a rally point.');
            success = false;
          } else for (let e of list) e.rally = { ...p };
        } else {
          if (!this.selected.length) {
            this.toast('Select a squad first.');
            success = false;
          } else
            this.game.command(
              this.selected,
              m.kind === 'attackMove' && target?.team === 1
                ? { type: 'attack', id: target.id, x: target.x, z: target.z }
                : { type: m.kind, ...p }
            );
        }
        if (success) this.clearMode();
        this.updateHUD(true);
      }
      tick(dt) {
        let now = performance.now();
        if (this.toastUntil && now > this.toastUntil) {
          $('toast').classList.remove('show');
          this.toastUntil = 0;
        }
        if (this.radioUntil && now > this.radioUntil) {
          $('radio').classList.add('hidden');
          this.radioUntil = 0;
        }
        for (let p of this.pings) p.life -= dt;
        this.pings = this.pings.filter(p => p.life > 0);
        if (this.view !== 'game' || !this.game.s) return;
        let s = this.game.s;
        if (!this.paused) {
          if (s.time - this.lastSaveTime >= 45) this.save(false);
        }
        this.hudClock += dt;
        if (this.hudClock > 0.25) {
          this.hudClock = 0;
          if (!this.domPressed) this.updateHUD();
          this.drawMinimap();
        }
      }
      drawMinimap() {
        let g = this.game;
        if (!g.s || !g.world) return;
        let c = $('minimap'),
          ctx = c.getContext('2d'),
          w = c.width,
          h = c.height;
        if (!this.miniBuffer) {
          this.miniBuffer = document.createElement('canvas');
          this.miniBuffer.width = this.miniBuffer.height = GRID;
          this.miniCtx = this.miniBuffer.getContext('2d');
          this.miniImage = this.miniCtx.createImageData(GRID, GRID);
        }
        let img = this.miniImage.data,
          base = g.world.terrainColors;
        for (let i = 0; i < GRID * GRID; i++) {
          let fog = g.world.visible[i] ? 1 : g.world.explored[i] ? 0.48 : 0.16;
          img[i * 4] = base[i * 4] * fog;
          img[i * 4 + 1] = base[i * 4 + 1] * fog;
          img[i * 4 + 2] = base[i * 4 + 2] * fog;
          img[i * 4 + 3] = 255;
        }
        this.miniCtx.putImageData(this.miniImage, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.miniBuffer, 0, 0, w, h);
        let map = p => ({ x: ((p.x + 90) / 180) * w, y: ((p.z + 90) / 180) * h });
        ctx.strokeStyle = '#91b7c215';
        ctx.lineWidth = 0.6;
        for (let i = 1; i < 6; i++) {
          ctx.beginPath();
          ctx.moveTo((w * i) / 6, 0);
          ctx.lineTo((w * i) / 6, h);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, (h * i) / 6);
          ctx.lineTo(w, (h * i) / 6);
          ctx.stroke();
        }
        for (let e of g.s.entities) {
          if (e.hp <= 0) continue;
          let explored = g.world.explored[g.world.idx(e.x, e.z)],
            visible = g.visible(e);
          if (e.kind === 'resource') {
            if (!explored) continue;
            let p = map(e);
            ctx.fillStyle = e.type === 'gas' ? '#9ed3c1' : '#c0a880';
            ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
            continue;
          }
          if (e.team === 1 && !visible) {
            if (e.kind === 'building' && e.type === 'hq') {
              let p = map(e);
              ctx.strokeStyle = '#e29e884e';
              ctx.strokeRect(p.x - 4, p.y - 3, 8, 6);
            }
            continue;
          }
          let p = map(e);
          ctx.fillStyle = e.team === 0 ? '#79dbcc' : '#eb8e80';
          if (e.type === 'hero') ctx.fillStyle = '#ffd494';
          if (e.kind === 'building') {
            let size = Math.max(3, (e.size * w) / 180);
            ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);

          } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, e.type === 'hero' ? 2.3 : 1.3, 0, 6.28);
            ctx.fill();
          }
        }
        ctx.strokeStyle = '#c3e1debb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let [i, p] of [
          [0, { x: 0, y: 63 }],
          [1, { x: innerWidth, y: 63 }],
          [2, { x: innerWidth, y: innerHeight - 237 }],
          [3, { x: 0, y: innerHeight - 237 }]
        ].entries()) {
          let q = map(this.R.ground(p[1].x, p[1].y));
          if (i === 0) ctx.moveTo(q.x, q.y);
          else ctx.lineTo(q.x, q.y);
        }
        ctx.closePath();
        ctx.stroke();
        for (let ping of this.pings) {
          let p = map(ping);
          ctx.strokeStyle = '#efc990';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3 + (1 - ping.life / ping.maxLife) * 7, 0, 6.28);
          ctx.stroke();
        }
      }
      drawOverlay(ctx) {
        this.updateBuildingActions();
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        if (this.view !== 'game' || !this.game.s) return;
        let g = this.game,
          s = g.s;
        ctx.font = '10px ui-monospace,Consolas,monospace';
        ctx.textAlign = 'center';
        if (this.selected.length && this.mode?.kind !== 'build') {
          ctx.save();
          ctx.setLineDash([4, 6]);
          ctx.lineWidth = 1;
          for (let id of this.selected.slice(0, 12)) {
            let e = g.get(id);
            if (!e || e.team !== 0) continue;
            let goal =
              e.rally ||
              (['move', 'attackMove'].includes(e.order?.type)
                ? e.order
                : e.order?.type === 'attack'
                  ? g.get(e.order.id)
                  : null);
            if (!goal) continue;
            let a = this.R.project(e.x, 0.2, e.z),
              b = this.R.project(goal.x, 0.2, goal.z);
            if (a && b) {
              ctx.strokeStyle = e.order?.type === 'attack' ? '#e9b47b5c' : '#8dddd955';
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
          ctx.restore();
        }
        for (let e of s.entities) {
          if (e.hp <= 0) continue;
          let selected = this.selected.includes(e.id),
            hover = this.hover === e.id;
          if (!g.visible(e)) continue;
          let damaged = e.hp < e.maxHp * 0.97;
          if (
            !selected &&
            !hover &&
            !(this.profile.settings.healthbars && e.kind === 'unit') &&
            !damaged
          )
            continue;
          if (e.kind === 'resource' && !selected && !hover) continue;
          let y =
              e.type === 'air'
                ? 6.1
                : e.kind === 'building'
                    ? Math.min(8, e.size + 2.5)
                    : 3.0,
            p = this.R.project(e.x, y, e.z);
          if (!p || p.x < 0 || p.x > innerWidth || p.y < 64 || p.y > innerHeight - 210) continue;
          let w = e.kind === 'building' ? 56 : e.type === 'hero' ? 42 : 30;
          ctx.fillStyle = '#07101deb';
          ctx.fillRect(p.x - w / 2 - 2, p.y - 2, w + 4, e.maxShield ? 10 : 7);
          ctx.fillStyle = '#344350';
          ctx.fillRect(p.x - w / 2, p.y, w, 3);
          ctx.fillStyle = e.team === 1 ? '#e8a291' : e.hp / e.maxHp < 0.3 ? '#f0b178' : '#91daca';
          ctx.fillRect(p.x - w / 2, p.y, w * clamp(e.hp / e.maxHp, 0, 1), 3);
          if (e.maxShield) {
            ctx.fillStyle = '#b5adf0';
            ctx.fillRect(p.x - w / 2, p.y + 5, w * clamp(e.shield / e.maxShield, 0, 1), 2);
          }
          if (e.progress < 1 && e.kind === 'building') {
            ctx.fillStyle = '#edc082';
            ctx.fillRect(p.x - w / 2, p.y + 6, w * e.progress, 2);
          }
          if (
            hover ||
            (selected && this.selected.length === 1)
          ) {
            let name =
              e.label ||
              (e.kind === 'building'
                ? buildingName(e.type, e.faction)
                : e.kind === 'resource'
                  ? e.type === 'gas'
                    ? 'AETHER VENT'
                    : 'ALLOY CRYSTALS'
                  : unitName(e.type, e.faction));
            ctx.font = '10px ui-monospace,Consolas,monospace';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#091421';
            ctx.strokeText(name.toUpperCase(), p.x, p.y - 8);
            ctx.fillStyle = e.team === 1 ? '#efc8b5' : '#d9e9df';
            ctx.fillText(name.toUpperCase(), p.x, p.y - 8);
          }
          if (e.kills >= 5) {
            ctx.fillStyle = '#f5ce95';
            ctx.fillText('★', p.x + w / 2 + 8, p.y + 5);
          }
        }
        for (let f of g.effects.floats) {
          let p = this.R.project(f.x, f.y, f.z);
          if (!p) continue;
          ctx.globalAlpha = f.life / f.maxLife;
          ctx.fillStyle = f.color;
          ctx.font = 'bold 12px ui-monospace,Consolas,monospace';
          ctx.fillText(f.text, p.x, p.y);
        }
        ctx.globalAlpha = 1;
      }
    }
