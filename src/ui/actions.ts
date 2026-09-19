    /* MeridianUI selection, action panel, queues and HUD. Loaded after ui/core.js. */
    'use strict';
    const FACTION_0_ACTION_PORTRAITS: Partial<Record<string, string>> = {
      'train:worker': 'assets/portraits/faction-0-unit-worker.webp',
      'train:rifle': 'assets/portraits/faction-0-unit-rifle.webp',
      'train:medic': 'assets/portraits/faction-0-unit-medic.webp',
      'train:tank': 'assets/portraits/faction-0-unit-tank.webp',
      'train:artillery': 'assets/portraits/faction-0-unit-artillery.webp',
      'train:air': 'assets/portraits/faction-0-unit-air.webp',
      'train:hero': 'assets/portraits/faction-0-unit-hero.webp',
      'build:hq': 'assets/portraits/faction-0-building-hq.webp',
      'build:barracks': 'assets/portraits/faction-0-building-barracks.webp',
      'build:depot': 'assets/portraits/faction-0-building-depot.webp',
      'build:refinery': 'assets/portraits/faction-0-building-refinery.webp',
      'build:factory': 'assets/portraits/faction-0-building-factory.webp',
      'build:hangar': 'assets/portraits/faction-0-building-hangar.webp',
      'build:turret': 'assets/portraits/faction-0-building-turret.webp'
    };
    const BUILDING_PORTRAIT_ACTIONS = new Set(Object.keys(FACTION_0_ACTION_PORTRAITS).filter(key => key.startsWith('build:')));
    const uiActionMethods = {
      submitAction(this: MeridianUI, action: BattleAction) {
        // Single-player actor remains explicit here; perspective/session binding is separate work.
        return this.game.executeAction(0, action);
      },
      issueOrder(this: MeridianUI, ids: number[], order: CommandOrder) {
        return this.submitAction({ kind: 'order', ids, order });
      },
      center(this: MeridianUI, x: number, z: number) {
        if (!this.game.s) return;
        const limit = this.game.world!.extent - 18;
        this.game.s!.cam.x = clamp(x, -limit, limit);
        this.game.s!.cam.z = clamp(z, -limit, limit);
      },
      homeCamera(this: MeridianUI) {
        let e = this.game.alive(e => e.team === 0 && e.type === 'hq')[0];
        if (e) this.center(e.x + 4, e.z - 2);
      },
      select(this: MeridianUI, ids: number[]) {
        this.selected = [...new Set(ids)].filter(id => this.game.get(id));
        this.audio.sound('select');
        this.setTab(this.selectedBuilding() ? 'building' : 'root');
      },
      selectedBuilding(this: MeridianUI) {
        let e = this.selected.length === 1 ? this.game.get(this.selected[0]) : null;
        return e?.team === 0 && e.kind === 'building' && e.hp > 0 ? e : null;
      },
      setTab(this: MeridianUI, tab: string) {
        if (!['root', 'build', 'infantry', 'vehicles', 'aircraft', 'building'].includes(tab)) return;
        this.clearMode();
        this.tab = tab as UITab;
        this.actionSignature = '';
        $('actionPanel').scrollTop = 0;
        this.renderActions();
      },
      isModeAction(this: MeridianUI, action: string) {
        if (!this.mode) return false;
        return action === (this.mode.kind === 'rally' ? 'rally' : `${this.mode.kind}:${this.mode.arg}`);
      },
      setMode(this: MeridianUI, ...[kind, arg]: ['build', BuildingType] | ['ability', AbilityType] | ['rally']) {
        if (this.paused) return;
        const action = kind === 'rally' ? 'rally' : `${kind}:${arg}`;
        if (this.isModeAction(action)) {
          this.clearMode();
          this.renderActions();
          return;
        }
        if (kind === 'build') {
          let reason = this.game.canBuild(arg);
          if (reason) {
            this.toast(reason);
            return;
          }
        }
        this.lastClick = {};
        this.mode = kind === 'build' ? { kind, arg } : kind === 'ability' ? { kind, arg } : { kind };
        $('world').style.cursor = 'crosshair';
        this.actionSignature = '';
        this.renderActions();
      },
      clearMode(this: MeridianUI) {
        this.mode = null;
        $('world').style.cursor = 'default';
        this.actionSignature = '';
      },
      perform(this: MeridianUI, action: string) {
        if (!this.game.s || this.paused || this.game.s!.result) return;
        let [kind, arg] = action.split(':');
        if (kind === 'tab') {
          this.setTab(arg);
          return;
        }
        if (kind === 'train' && hasContentKey(UNITS, arg)) {
          this.submitAction({ kind: 'train', unit: arg });
          this.updateHUD();
          return;
        }
        if (kind === 'build' && hasContentKey(BUILDINGS, arg)) {
          this.setMode('build', arg);
          return;
        }
        if (kind === 'ability' && hasContentKey(ABILITIES, arg)) {
          this.setMode('ability', arg);
          return;
        }
        switch (kind) {
          case 'rally':
            if ((this.selectedBuilding()?.progress || 0) >= 1) this.setMode(kind);
            break;
          case 'repair':
          case 'sell':
            if (this.selectedBuilding()) this.buildingAction(kind, this.selected[0]);
            break;
          case 'cancelBuild':
            this.submitAction({ kind: 'cancelConstruction', id: this.selected[0] });
            this.updateHUD();
            break;
        }
      },
      actionButton(this: MeridianUI, key: string, label: string, ic: string, opts: {badge?: string | number; disabled?: boolean; cost?: Cost} = {}) {
        const active = this.isModeAction(key), renderedLabel = active ? 'Cancel' : label;
        const faction = this.game.s?.parties[0].faction;
        let badge = active ? '' : opts.badge || '',
          preview = faction === FACTION_ID.FIRST
            ? FACTION_0_ACTION_PORTRAITS[key]
            : faction !== undefined && BUILDING_PORTRAIT_ACTIONS.has(key)
              ? `assets/portraits/faction-${faction}-building-${key.slice('build:'.length)}.webp`
              : undefined;
        // Fixed renders of the actual models: no additional WebGL scenes in the HUD.
        const visual = preview ? `<img class="action-model" src="${preview}" alt="" draggable="false"><i class="model-space" aria-hidden="true"></i>` : icon(ic);
        return `<button class="action ${preview ? 'model-action' : ''} ${opts.disabled ? 'disabled' : ''} ${active ? 'active' : ''}" data-action="${key}"${opts.disabled ? ' disabled' : ''}>${visual}<span>${renderedLabel}</span>${opts.cost && !active ? `<span class="cost">${opts.cost.cost}◆${opts.cost.gas ? ' ' + opts.cost.gas + '⬡' : ''}</span>` : ''}<small data-badge="${key}">${badge}</small></button>`;
      },
      renderActions(this: MeridianUI, supply?: number, capacity?: number) {
        this.renderActionMarkup();
        // Never expose newly created buttons in their default enabled state until the next HUD tick.
        this.updateActionStates(supply, capacity);
      },
      renderActionMarkup(this: MeridianUI) {
        let s = this.game.s;
        if (!s) return;
        let b = this.selectedBuilding();
        if (this.tab === 'building' && !b) this.tab = 'root';
        let ready = !!b && b.progress >= 1,
          repairing = ready && this.game.buildingRepairers(b!.id).length > 0,
          repairReason = ready && !repairing ? this.game.canRepairBuilding(b!.id) : '',
          sellReason = ready ? this.game.canSellBuilding(b!.id) : '',
          noFreeWorker = this.tab === 'build' && !this.game.availableWorkers().length,
          sig = [this.tab, s.parties[0].faction, this.selected.join(','), ready, repairing, repairReason, sellReason, noFreeWorker,
            this.mode?.kind, this.mode?.arg].join(':');
        if (sig === this.actionSignature) return;
        this.actionSignature = sig;
        $('abilityBar').innerHTML = [
          ['orbital', 'Orbital strike', 'orbital'], ['repair', 'Repair field', 'heal'],
          ['scan', 'Recon scan', 'scan'], ['drop', 'Reinforcements', 'drop']
        ].map(([k, label, ic]) => this.actionButton('ability:' + k, label, ic)).join('');
        let html = '', f = s.parties[0].faction;
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
          for (let k of contentKeys(BUILDINGS))
            html += this.actionButton('build:' + k, buildingName(k, f), k, {
              cost: this.game.cost(k, 'building')
            });
        } else {
          let types: Record<'infantry' | 'vehicles' | 'aircraft', UnitType[]> = { infantry: ['worker', 'rifle', 'medic', 'hero'], vehicles: ['tank', 'artillery'], aircraft: ['air'] };
          for (let k of types[this.tab] || [])
            html += this.actionButton('train:' + k, k === 'hero' ? 'Commander' : unitName(k, f), k, {
              cost: this.game.cost(k)
            });
        }
        $('actions').innerHTML = (this.tab === 'root' ? '' :
          '<button class="menu-back" data-action="tab:root">← Back</button>') +
          (noFreeWorker ? '<p class="building-status" role="status">No free worker. Recruit one or finish a build/repair.</p>' : '') +
          `<div class="action-grid${this.tab === 'root' ? ' root-grid' : ''}">` + html + '</div>' +
          (this.tab === 'building' ? `<p class="building-status">${esc(buildingName(b!.type, f))}${ready ?
            '<br>' + esc([repairing ? 'Worker assigned' : repairReason, sellReason].filter(Boolean).join(' · ')) : ''}</p>` : '');
      },
      buildingAction(this: MeridianUI, action: string, id: number) {
        if (this.view !== 'game' || this.paused || this.modalKind || this.mode || !this.game.s || this.game.s!.result) return;
        if (action === 'repair') {
          this.submitAction({ kind: 'toggleRepair', id });
          this.updateHUD();
        } else if (action === 'sell') {
          let reason = this.game.canSellBuilding(id);
          if (reason) { this.toast(reason); return; }
          let b = this.game.get(id), refund = this.game.buildingSaleRefund(id);
          if (!b || !refund) return;
          this.sellBuildingId = id;
          this.paused = true;
          this.clearMode();
          this.openModal('sell',
            `<div class="eyebrow">SELL STRUCTURE</div><h1>Sell ${esc(buildingName(b.type, b.faction))}?</h1><p>Refund: <b>${refund.cost} alloy / ${refund.gas} aether</b>.</p><p>Includes 50% of the building’s purchase value and a full refund for all ${b.queue.length} pending recruitments. The structure is removed immediately; supply capacity may decrease.</p><div class="launch-row"><button class="primary" data-ui="confirmSale">SELL STRUCTURE</button><button class="secondary" data-ui="cancelSale">KEEP STRUCTURE</button></div>`);
        }
      },
      finishBuildingSale(this: MeridianUI, confirm: boolean) {
        if (this.modalKind !== 'sell' || this.view !== 'game' || !this.game.s || this.game.s!.result) return;
        let id = this.sellBuildingId;
        this.sellBuildingId = null;
        if (confirm && id !== null) this.submitAction({ kind: 'sell', id });
        this.resume();
        this.updateHUD();
      },
      recruitmentGroups(this: MeridianUI) {
        let groups: Partial<Record<UnitType, {b: Entity; index: number; q: QueueItem}[]>> = {};
        for (let b of this.game.alive(e => e.team === 0 && e.kind === 'building' && !!e.queue?.length))
          for (let [index, q] of b.queue.entries())
            (groups[q.type] ||= []).push({ b, index, q });
        return groups;
      },
      cancelRecruitment(this: MeridianUI, type: UnitType) {
        let entries = this.recruitmentGroups()[type] || [];
        // Preserve work already done: cancel a waiting order first, then the least advanced active one.
        entries.sort((a, b) => b.index - a.index || a.q.progress - b.q.progress || b.b.id - a.b.id);
        let entry = entries[0];
        if (entry) this.submitAction({ kind: 'cancelQueue', id: entry.b.id, index: entry.index });
      },
      updateQueues(this: MeridianUI) {
        let groups = this.recruitmentGroups(),
          types = contentKeys(UNITS).filter(type => groups[type]),
          signature = types.join(',');
        if (signature !== this.queueSignature) {
          this.queueSignature = signature;
          $('productionQueue').innerHTML = types.map(type =>
            `<button class="queue-item" data-queue-type="${type}">${icon(type)}<span class="queue-count"></span><span class="queue-time"></span></button>`
          ).join('');
        }
        // Keep the buttons stable while animating from simulation progress (also correct after pause/load).
        for (let button of $('productionQueue').querySelectorAll<HTMLButtonElement>('[data-queue-type]')) {
          let type = button.dataset.queueType as UnitType, entries = groups[type]!,
            next = entries.filter(e => e.index === 0)
              .sort((a, b) => a.q.time * (1 - a.q.progress) - b.q.time * (1 - b.q.progress))[0]?.q,
            remaining = next ? Math.ceil(next.time * (1 - next.progress)) + 's' : '…';
          button.style.setProperty('--progress', (next ? clamp(next.progress, 0, 1) * 360 : 360) + 'deg');
          button.classList.toggle('waiting', !next);
          button.querySelector('.queue-count')!.textContent = String(entries.length);
          button.querySelector('.queue-time')!.textContent = remaining;
          button.setAttribute('aria-label', `${unitName(type, this.game.s!.parties[0].faction)} · ${entries.length} pending · ${next ? remaining : 'waiting'} · cancel one recruitment`);
        }
      },
      updateHUD(this: MeridianUI) {
        let s = this.game.s;
        if (!s) return;
        $('alloyCount').textContent = Math.floor(s.parties[0].account.alloy).toLocaleString();
        $('gasCount').textContent = Math.floor(s.parties[0].account.gas).toLocaleString();
        const supply = this.game.supply(), capacity = this.game.cap();
        $('supplyCount').textContent = supply + '/' + capacity;
        $('supplyCount').style.color = supply >= capacity ? 'var(--red)' : '';
        $('energyCount').textContent = String(Math.floor(s.parties[0].account.energy));
        $('gameTime').textContent = formatTime(s.time);
        const speedButton = $('speedBtn'), speedLabel = String(s.speed).replace('.', ',') + '×';
        speedButton.textContent = speedLabel;
        speedButton.setAttribute('aria-label', `Simulation speed: ${speedLabel}. Tap to change.`);
        $('battleLabel').textContent = `STAGE ${s.depth + 1}`;
        this.selected = this.selected.filter(id => this.game.get(id));
        this.renderActions(supply, capacity);
      },
      updateActionStates(this: MeridianUI, supply?: number, capacity?: number) {
        const s = this.game.s;
        if (!s) return;
        const buttons = document.querySelectorAll<HTMLButtonElement>('[data-action]');
        if (!buttons.length) return;
        supply ??= this.game.supply();
        capacity ??= this.game.cap();
        for (let b of buttons) {
          let [k, arg] = b.dataset.action!.split(':');
          const active = this.isModeAction(b.dataset.action!);
          let disabled = false;
          if (active) {
            const badge = b.querySelector('small');
            if (badge) badge.textContent = '';
          } else if (k === 'train' && hasContentKey(UNITS, arg)) {
            let d = UNITS[arg];
            disabled =
              !this.game.afford(this.game.cost(arg)) ||
              !this.game.availableProducers(d.from).length ||
              supply + d.supply > capacity;
            if (arg === 'hero' && this.game.alive(e => e.team === 0 &&
              (e.type === 'hero' || e.queue?.some(q => q.type === 'hero'))).length) disabled = true;
          } else if (k === 'build' && hasContentKey(BUILDINGS, arg))
            disabled = !!this.game.canBuild(arg) || !this.game.afford(this.game.cost(arg, 'building'));
          else if (k === 'ability' && hasContentKey(ABILITIES, arg)) {
            let energy = ABILITIES[arg]?.energy, requirement = this.game.abilityRequirement(arg);
            disabled = !!requirement || s.parties[0].account.energy < energy || s.parties[0].account.abilities[arg] > s.time;
            let badge = b.querySelector('small');
            if (badge)
              badge.textContent =
                requirement ? 'TECH' : s.parties[0].account.abilities[arg] > s.time
                  ? Math.ceil(s.parties[0].account.abilities[arg] - s.time) + 's'
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
    };
    type UIActionMethods = typeof uiActionMethods;
    interface MeridianUI extends UIActionMethods {}
    defineMeridianUIMethods(uiActionMethods);
