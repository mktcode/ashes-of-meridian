    /* MeridianUI selection, action panel, queues and HUD. Loaded after ui/core.js. */
    'use strict';
    const FREE_MARCHES_ACTION_PORTRAITS = {
      'train:worker': 'assets/portraits/preview-prospector.webp',
      'train:rifle': 'assets/portraits/preview-vanguard.webp',
      'train:medic': 'assets/portraits/preview-field-medic.webp',
      'train:tank': 'assets/portraits/preview-ironclad.webp',
      'train:artillery': 'assets/portraits/preview-longbow.webp',
      'train:air': 'assets/portraits/preview-kestrel.webp',
      'train:hero': 'assets/portraits/preview-field-commander.webp',
      'build:hq': 'assets/portraits/preview-command-center.webp',
      'build:barracks': 'assets/portraits/preview-muster-station.webp',
      'build:depot': 'assets/portraits/preview-logistics-depot.webp',
      'build:refinery': 'assets/portraits/preview-aether-refinery.webp',
      'build:factory': 'assets/portraits/preview-war-foundry.webp',
      'build:hangar': 'assets/portraits/preview-flight-deck.webp',
      'build:turret': 'assets/portraits/preview-sentinel-turret.webp'
    };
    defineMeridianUIMethods({
      center(x, z) {
        if (!this.game.s) return;
        this.game.s.cam.x = clamp(x, -72, 72);
        this.game.s.cam.z = clamp(z, -72, 72);
      },
      homeCamera() {
        let e = this.game.alive(e => e.team === 0 && e.type === 'hq')[0];
        if (e) this.center(e.x + 4, e.z - 2);
      },
      select(ids) {
        this.selected = [...new Set(ids)].filter(id => this.game.get(id));
        this.audio.sound('select');
        this.setTab(this.selectedBuilding() ? 'building' : 'root');
      },
      selectedBuilding() {
        let e = this.selected.length === 1 ? this.game.get(this.selected[0]) : null;
        return e?.team === 0 && e.kind === 'building' && e.hp > 0 ? e : null;
      },
      setTab(tab) {
        if (!['root', 'build', 'infantry', 'vehicles', 'aircraft', 'building'].includes(tab)) return;
        this.clearMode();
        this.tab = tab;
        this.actionSignature = '';
        $('actionPanel').scrollTop = 0;
        this.renderActions();
      },
      setMode(kind, arg) {
        if (this.paused) return;
        if (kind === 'build') {
          let reason = this.game.canBuild(arg);
          if (reason) {
            this.toast(reason);
            return;
          }
        }
        this.lastClick = {};
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
              : 'SET RALLY POINT';
        $('modeLabel').textContent = text + ' · TAP TO CONFIRM';
        $('modeIndicator').classList.remove('hidden');
        $('world').style.cursor = 'crosshair';
        this.actionSignature = '';
        this.renderActions();
      },
      clearMode() {
        this.mode = null;
        $('modeIndicator').classList.add('hidden');
        $('world').style.cursor = 'default';
        this.actionSignature = '';
      },
      perform(action) {
        if (!this.game.s || this.paused || this.game.s.result) return;
        let [kind, arg] = action.split(':');
        if (kind === 'tab') {
          this.setTab(arg);
          return;
        }
        if (kind === 'train') {
          this.game.train(arg);
          this.updateHUD();
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
          case 'rally':
            if (this.selectedBuilding()?.progress >= 1) this.setMode(kind);
            break;
          case 'repair':
          case 'sell':
            if (this.selectedBuilding()) this.buildingAction(kind, this.selected[0]);
            break;
          case 'cancelBuild':
            this.game.cancelConstruction(this.selected[0]);
            this.updateHUD();
            break;
        }
      },
      actionButton(key, label, ic, opts = {}) {
        let badge = opts.badge || '',
          preview = this.game.s?.faction === 0 && FREE_MARCHES_ACTION_PORTRAITS[key];
        // Fixed renders of the actual models: no additional WebGL scenes in the HUD.
        const visual = preview ? `<img class="action-model" src="${preview}" alt="" draggable="false"><i class="model-space" aria-hidden="true"></i>` : icon(ic);
        return `<button class="action ${preview ? 'model-action' : ''} ${opts.disabled ? 'disabled' : ''} ${this.mode && (key === 'build:' + this.mode.arg || key === 'ability:' + this.mode.arg || key === this.mode.kind) ? 'active' : ''}" data-action="${key}"${opts.disabled ? ' disabled' : ''}>${visual}<span>${label}</span>${opts.cost ? `<span class="cost">${opts.cost.cost}◆${opts.cost.gas ? ' ' + opts.cost.gas + '⬡' : ''}</span>` : ''}<small data-badge="${key}">${badge}</small></button>`;
      },
      renderActions() {
        let s = this.game.s;
        if (!s) return;
        let b = this.selectedBuilding();
        if (this.tab === 'building' && !b) this.tab = 'root';
        let ready = b?.progress >= 1,
          repairing = ready && this.game.buildingRepairers(b.id).length > 0,
          repairReason = ready && !repairing ? this.game.canRepairBuilding(b.id) : '',
          sellReason = ready ? this.game.canSellBuilding(b.id) : '',
          noFreeWorker = this.tab === 'build' && !this.game.availableWorkers().length,
          sig = [this.tab, s.faction, this.selected.join(','), ready, repairing, repairReason, sellReason, noFreeWorker,
            this.mode?.kind, this.mode?.arg].join(':');
        if (sig === this.actionSignature) return;
        this.actionSignature = sig;
        $('abilityBar').innerHTML = [
          ['orbital', 'Orbital strike', 'orbital'], ['repair', 'Repair field', 'heal'],
          ['scan', 'Recon scan', 'scan'], ['drop', 'Reinforcements', 'drop']
        ].map(([k, label, ic]) => this.actionButton('ability:' + k, label, ic)).join('');
        let html = '', f = s.faction;
        if (this.tab === 'root') {
          for (let [tab, label, ic] of [
            ['build', 'Buildings', 'hq'], ['infantry', 'Infantry', 'rifle'],
            ['vehicles', 'Vehicles', 'tank'], ['aircraft', 'Aircraft', 'air']
          ]) html += this.actionButton('tab:' + tab, label, ic);
        } else if (this.tab === 'building') {
          if (ready) {
            html += this.actionButton('sell', 'Sell', 'cancel', { disabled: !!sellReason });
            html += this.actionButton('repair', repairing ? 'Stop repair' : 'Repair', 'repair', { disabled: !!repairReason });
            html += this.actionButton('rally', 'Rally point', 'rally');
          } else html += this.actionButton('cancelBuild', 'Cancel build', 'cancel');
        } else if (this.tab === 'build') {
          for (let k of Object.keys(BUILDINGS))
            html += this.actionButton('build:' + k, buildingName(k, f), k, {
              cost: this.game.cost(k, 'building')
            });
        } else {
          let types = { infantry: ['worker', 'rifle', 'medic', 'hero'], vehicles: ['tank', 'artillery'], aircraft: ['air'] };
          for (let k of types[this.tab] || [])
            html += this.actionButton('train:' + k, k === 'hero' ? 'Commander' : unitName(k, f), k, {
              cost: this.game.cost(k)
            });
        }
        $('actions').innerHTML = (this.tab === 'root' ? '' :
          '<button class="menu-back" data-action="tab:root">← Back</button>') +
          (noFreeWorker ? '<p class="building-status" role="status">No free worker. Recruit one or finish a build/repair.</p>' : '') +
          `<div class="action-grid${this.tab === 'root' ? ' root-grid' : ''}">` + html + '</div>' +
          (this.tab === 'building' ? `<p class="building-status">${esc(buildingName(b.type, f))}${ready ?
            '<br>' + esc([repairing ? 'Worker assigned' : repairReason, sellReason].filter(Boolean).join(' · ')) : ''}</p>` : '');
      },
      buildingAction(action, id) {
        if (this.view !== 'game' || this.paused || this.modalKind || this.mode || !this.game.s || this.game.s.result) return;
        if (action === 'repair') {
          this.game.toggleBuildingRepair(id);
          this.updateHUD();
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
      },
      finishBuildingSale(confirm) {
        if (this.modalKind !== 'sell' || this.view !== 'game' || !this.game.s || this.game.s.result) return;
        let id = this.sellBuildingId;
        this.sellBuildingId = null;
        if (confirm) this.game.sellBuilding(id);
        this.resume();
        this.updateHUD();
      },
      recruitmentGroups() {
        let groups = {};
        for (let b of this.game.alive(e => e.team === 0 && e.kind === 'building' && e.queue?.length))
          for (let [index, q] of b.queue.entries())
            (groups[q.type] ||= []).push({ b, index, q });
        return groups;
      },
      cancelRecruitment(type) {
        let entries = this.recruitmentGroups()[type] || [];
        // Preserve work already done: cancel a waiting order first, then the least advanced active one.
        entries.sort((a, b) => b.index - a.index || a.q.progress - b.q.progress || b.b.id - a.b.id);
        let entry = entries[0];
        if (entry) this.game.cancelQueue(entry.b.id, entry.index);
      },
      updateQueues() {
        let groups = this.recruitmentGroups(),
          types = Object.keys(UNITS).filter(type => groups[type]),
          signature = types.join(',');
        if (signature !== this.queueSignature) {
          this.queueSignature = signature;
          $('productionQueue').innerHTML = types.map(type =>
            `<button class="queue-item" data-queue-type="${type}">${icon(type)}<span class="queue-count"></span><span class="queue-time"></span></button>`
          ).join('');
        }
        // Keep the buttons stable while animating from simulation progress (also correct after pause/load).
        for (let button of $('productionQueue').querySelectorAll('[data-queue-type]')) {
          let type = button.dataset.queueType, entries = groups[type],
            next = entries.filter(e => e.index === 0)
              .sort((a, b) => a.q.time * (1 - a.q.progress) - b.q.time * (1 - b.q.progress))[0]?.q,
            remaining = next ? Math.ceil(next.time * (1 - next.progress)) + 's' : '…';
          button.style.setProperty('--progress', (next ? clamp(next.progress, 0, 1) * 360 : 360) + 'deg');
          button.classList.toggle('waiting', !next);
          button.querySelector('.queue-count').textContent = entries.length;
          button.querySelector('.queue-time').textContent = remaining;
          button.setAttribute('aria-label', `${unitName(type, this.game.s.faction)} · ${entries.length} pending · ${next ? remaining : 'waiting'} · cancel one recruitment`);
        }
      },
      updateHUD() {
        let s = this.game.s;
        if (!s) return;
        $('alloyCount').textContent = Math.floor(s.alloy).toLocaleString();
        $('gasCount').textContent = Math.floor(s.gas).toLocaleString();
        const supply = this.game.supply(), capacity = this.game.cap();
        $('supplyCount').textContent = supply + ' / ' + capacity;
        $('supplyCount').style.color = supply >= capacity ? 'var(--red)' : '';
        $('energyCount').textContent = Math.floor(s.energy);
        $('gameTime').textContent = formatTime(s.time);
        const speedButton = $('speedBtn'), speedLabel = String(s.speed).replace('.', ',') + '×';
        speedButton.textContent = speedLabel;
        speedButton.setAttribute('aria-label', `Simulation speed: ${speedLabel}. Tap to change.`);
        $('battleLabel').innerHTML = 'Annihilation' + `<small>SEED ${s.seed}</small>`;
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
        this.selected = this.selected.filter(id => this.game.get(id));
        this.renderActions();
        this.updateQueues();
        for (let b of document.querySelectorAll('[data-action]')) {
          let [k, arg] = b.dataset.action.split(':');
          let disabled = false;
          if (k === 'train') {
            let d = UNITS[arg];
            disabled =
              !this.game.afford(this.game.cost(arg)) ||
              !this.game.availableProducers(d.from).length ||
              supply + d.supply > capacity;
            if (arg === 'hero' && this.game.alive(e => e.team === 0 &&
              (e.type === 'hero' || e.queue?.some(q => q.type === 'hero'))).length) disabled = true;
          } else if (k === 'build')
            disabled = !!this.game.canBuild(arg) || !this.game.afford(this.game.cost(arg, 'building'));
          else if (k === 'ability') {
            let energy = ABILITIES[arg]?.energy;
            disabled = s.energy < energy || s.abilities[arg] > s.time;
            let badge = b.querySelector('small');
            if (badge)
              badge.textContent =
                s.abilities[arg] > s.time
                  ? Math.ceil(s.abilities[arg] - s.time) + 's'
                  : energy + 'ϟ';
          }
          if (k === 'repair') disabled = !!this.mode || !this.selectedBuilding() ||
            (!this.game.buildingRepairers(this.selected[0]).length && !!this.game.canRepairBuilding(this.selected[0]));
          if (k === 'sell') disabled = !!this.mode || !!this.game.canSellBuilding(this.selected[0]);
          disabled ||= this.paused || !!s.result;
          b.disabled = disabled;
          b.classList.toggle('disabled', disabled);
        }
      }
    });
