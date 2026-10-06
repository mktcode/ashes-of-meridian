    /* MeridianUI selection, action panel, queues and HUD. Loaded after ui/core.js. */
    'use strict';
    interface UIActionButtonOptions { badge?: string | number; disabled?: boolean; cost?: Cost }
    const cameraMapBounds = new WeakMap<Battlefield, { yaw: number; extent: number; surface: BattlefieldSurface | null; low: number; high: number }>();
    const uiActionMethods = {
      submitAction(this: MeridianUI, action: BattleAction) {
        // Confirmation dialogs may submit while paused, but never during a cinematic.
        if (this.battleIntro || this.battleTutorial?.step === 'arrival') return false;
        // Local scenario control follows the selected view.
        return this.game.submitAction(this.localTeam, action);
      },
      issueOrder(this: MeridianUI, ids: number[], order: CommandOrder) {
        return this.submitAction({ kind: 'order', ids, order });
      },
      setPerspective(this: MeridianUI, team: PlayerTeam) {
        if (this.view !== 'game' || this.modalKind || !this.game.setPerspective(team)) return false;
        this.selected = [];
        this.hover = null;
        this.drag = null;
        this.lastClick = {};
        this.touchPoints.clear();
        this.touchGesture = false;
        this.domPressed = false;
        this.pinchDist = undefined;
        this.touchAngle = undefined;
        this.pings = [];
        this.audio.stopVoice?.();
        this.radioVoiceId = null;
        this.radioUntil = this.toastUntil = 0;
        $('radio').classList.add('hidden');
        $('toast').classList.remove('show');
        this.queueSignature = undefined;
        this.setTab('root');
        this.homeCamera();
        this.updateHUD();
        this.updateQueues();
        return true;
      },
      center(this: MeridianUI, x: number, z: number) {
        if (!this.game.s || this.controlsLocked) return;
        Object.assign(this.game.s.cam, this.clampCameraPoint({ x, z }));
      },
      clampCameraPoint(this: MeridianUI, point: Position): Position {
        const world = this.game.world!, limit = world.extent, cam = this.game.s!.cam,
          yaw = cam.yaw ?? 0, sn = Math.sin(yaw), cs = Math.cos(yaw), surface = world.surface,
          v = this.R.viewport, windowHeight = typeof innerHeight === 'number' ? innerHeight : v.height,
          halfX = cam.zoom * v.width / windowHeight / 2,
          halfZ = cam.zoom * v.height / windowHeight / 2 * Math.hypot(1.1, .82) / 1.1;
        let bounds = cameraMapBounds.get(world);
        if (!bounds || bounds.yaw !== yaw || bounds.extent !== limit || bounds.surface !== surface) {
          let low = Infinity, high = -Infinity;
          const sample = (x: number, z: number, height: number) => {
            const p = sn * x + cs * z - height * .82 / 1.1;
            low = Math.min(low, p); high = Math.max(high, p);
          };
          if (surface?.heights) {
            for (let z = 0; z < surface.size; z++) for (let x = 0; x < surface.size; x++)
              sample(x * surface.step - limit, z * surface.step - limit, surface.heights[z * surface.size + x]);
          } else for (const x of [-limit, limit]) for (const z of [-limit, limit])
            sample(x, z, surface?.heightAt?.(x, z) ?? 0);
          bounds = { yaw, extent: limit, surface, low, high }; cameraMapBounds.set(world, bounds);
        }
        // Clamp the visible rectangle, not its y=0 pivot. A small inside-screen
        // margin keeps edge targets reachable without centering the exterior.
        const horizontal = limit * (Math.abs(sn) + Math.abs(cs)),
          insetX = Math.max(0, halfX - Math.min(8, halfX * .15)),
          insetZ = Math.max(0, halfZ - Math.min(8, halfZ * .15)),
          fit = (p: number, lo: number, hi: number, inset: number) =>
            lo + inset > hi - inset ? (lo + hi) / 2 : clamp(p, lo + inset, hi - inset),
          u = fit(cs * point.x - sn * point.z, -horizontal, horizontal, insetX),
          w = fit(sn * point.x + cs * point.z, bounds.low, bounds.high, insetZ),
          x = cs * u + sn * w, z = -sn * u + cs * w;
        // A rotated map's projected AABB contains empty corners. Keep the
        // central terrain anchor on the map as well, using local—not peak—height.
        let height = surface?.heightAt?.(x, z) ?? 0;
        for (let i = 0; i < 6; i++) height = surface?.heightAt?.(
          x + sn * height * .82 / 1.1, z + cs * height * .82 / 1.1) ?? 0;
        const ax = x + sn * height * .82 / 1.1, az = z + cs * height * .82 / 1.1;
        if (Math.abs(ax) <= limit && Math.abs(az) <= limit) return { x, z };
        const anchor = { x: clamp(ax, -limit, limit), z: clamp(az, -limit, limit) },
          shift = (surface?.heightAt?.(anchor.x, anchor.z) ?? 0) * .82 / 1.1;
        return { x: anchor.x - sn * shift, z: anchor.z - cs * shift };
      },
      zoomCamera(this: MeridianUI, zoom: number) {
        if (!this.game.s || this.controlsLocked) return;
        const cam = this.game.s.cam;
        cam.zoom = clamp(zoom, 27.2, 115);
        Object.assign(cam, this.clampCameraPoint(cam));
      },
      terrainCameraPoint(this: MeridianUI, point: Position, height: number): Position {
        const yaw = this.game.s!.cam.yaw ?? 0;
        // Project an elevated focus onto the renderer's y=0 target plane.
        const shift = height * .82 / 1.1;
        return this.clampCameraPoint({ x: point.x - Math.sin(yaw) * shift,
          z: point.z - Math.cos(yaw) * shift });
      },
      homeCamera(this: MeridianUI) {
        let e = this.game.alive(e => e.team === this.localTeam && e.type === 'hq')[0] ||
          this.game.alive(e => e.team === this.localTeam && e.type === 'worker')[0];
        if (e) {
          const point = this.terrainCameraPoint({ x: e.x + 4, z: e.z - 2 },
            this.game.world!.surface?.entityHeight(e) ?? 0);
          this.center(point.x, point.z);
        }
      },
      select(this: MeridianUI, ids: number[], groupVoice = false) {
        this.selected = [...new Set(ids)].filter(id => { const e = this.game.get(id); return e && this.game.observed(e); });
        const units = this.selected.map(id => this.game.get(id))
          .filter((e): e is UnitEntity => !!e && e.kind === 'unit' && e.team === this.localTeam && e.hp > 0);
        if (!this.audio.selectionVoice?.(units, groupVoice)) this.audio.sound('select');
        this.setTab(this.selectedBuilding() ? 'building' : 'root');
      },
      selectedBuilding(this: MeridianUI) {
        let e = this.selected.length === 1 ? this.game.get(this.selected[0]) : null;
        return e?.team === this.localTeam && e.kind === 'building' && e.hp > 0 ? e : null;
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
        if (this.controlsLocked) return;
        const action = kind === 'rally' ? 'rally' : `${kind}:${arg}`;
        if (this.isModeAction(action)) {
          this.clearMode();
          this.renderActions();
          return;
        }
        if (kind === 'build') {
          let reason = this.game.canBuild(arg, null, this.localTeam);
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
        if (!this.game.s || this.controlsLocked || this.game.s!.result) return;
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
          case 'rotateLeft':
          case 'rotateRight':
            if ((this.selectedBuilding()?.progress || 0) >= 1) this.buildingAction(kind, this.selected[0]);
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
      actionButton(this: MeridianUI, key: string, label: string, ic: string, opts: UIActionButtonOptions = {}, tutorialAction: string | null = this.tutorialAction()) {
        const active = this.isModeAction(key), tutorialFocus = tutorialAction === key,
          renderedLabel = active ? 'Cancel' : label;
        const faction = this.game.s?.parties[this.localTeam].faction;
        const badge = active ? '' : opts.badge || '', [kind,type] = key.split(':');
        const preview = faction !== undefined && kind === 'build' && hasContentKey(BUILDINGS,type)
          ? renderModelThumbnail(faction,'building',type,'action-model')
          : faction !== undefined && kind === 'train' && hasContentKey(UNITS,type)
            ? renderModelThumbnail(faction,'unit',type,'action-model') : '';
        const visual = preview ? `${preview}<i class="model-space" aria-hidden="true"></i>` : uiIcon(kind === 'tab' ? key : ic, ic);
        return `<button class="action ${preview ? 'model-action' : ''} ${opts.disabled ? 'disabled' : ''} ${active ? 'active' : ''} ${tutorialFocus ? 'tutorial-focus' : ''}" data-action="${key}"${opts.disabled ? ' disabled' : ''}>${visual}<span>${renderedLabel}</span>${opts.cost && !active ? `<span class="cost">${opts.cost.cost || !opts.cost.gas ? opts.cost.cost + '◆' : ''}${opts.cost.gas ? (opts.cost.cost ? ' ' : '') + opts.cost.gas + '⬡' : ''}</span>` : ''}<small data-badge="${key}">${badge}</small></button>`;
      },
      renderActions(this: MeridianUI, supply?: number, capacity?: number) {
        if (this.battleTutorial?.step === 'trainRifle' || this.battleTutorial?.step === 'buildDepot') {
          supply ??= this.game.supply(this.localTeam);
          capacity ??= this.game.cap(this.localTeam);
        }
        this.updateTutorialGoal(supply, capacity);
        this.renderActionMarkup(supply, capacity);
        // Never expose newly created buttons in their default enabled state until the next HUD tick.
        this.updateActionStates(supply, capacity);
      },
      renderActionMarkup(this: MeridianUI, supply?: number, capacity?: number) {
        let s = this.game.s;
        if (!s) return;
        let b = this.selectedBuilding();
        if (this.tab === 'building' && !b) this.tab = 'root';
        const tutorialAction = this.tutorialAction(supply, capacity);
        const button = (key: string, label: string, ic: string, opts: UIActionButtonOptions = {}) =>
          this.actionButton(key, label, ic, opts, tutorialAction);
        let ready = !!b && b.progress >= 1,
          repairing = ready && this.game.buildingRepairers(b!.id, this.localTeam).length > 0,
          repairReason = ready && !repairing ? this.game.canRepairBuilding(b!.id, this.localTeam) : '',
          sellReason = ready ? this.game.canSellBuilding(b!.id, this.localTeam) : '',
          noFreeWorker = this.tab === 'build' && !this.game.availableWorkers(this.localTeam).length,
          sig = [this.localTeam, this.tab, s.parties[this.localTeam].faction, s.parties[this.localTeam].loadout.join(','),
            this.selected.join(','), ready, repairing, repairReason, sellReason, noFreeWorker,
            this.mode?.kind, this.mode?.arg, this.battleTutorial?.step, tutorialAction, this.game.civilizationStage,
            s.rules.kind === 'single-player' && s.rules.completed, b?.kind === 'building' ? b.cinderStock : '',
            b?.type === 'meridianforum' ? this.game.alive(e => e.kind === 'building' && e.forumId === b!.id).length : ''].join(':');
        if (sig === this.actionSignature) return;
        this.actionSignature = sig;
        $('abilityBar').innerHTML = s.parties[this.localTeam].loadout.map(key => {
          const ability = ABILITIES[key];
          return button('ability:' + key, ability.name, ability.icon);
        }).join('');
        let html = '', f = s.parties[this.localTeam].faction;
        if (this.tab === 'root') {
          for (let [tab, label, ic] of [
            ['build', 'Buildings', 'hq'], ['infantry', 'Infantry', 'rifle'],
            ['vehicles', 'Vehicles', 'tank'], ['aircraft', 'Aircraft', 'air']
          ]) html += button('tab:' + tab, label, ic);
        } else if (this.tab === 'building') {
          if (ready) {
            html += button('sell', 'Sell', 'cancel', { disabled: !!sellReason });
            html += button('repair', repairing ? 'Stop repair' : 'Repair', 'repair', { disabled: !!repairReason });
            html += `<div class="building-rotation">${button('rotateLeft', 'Rotate left', 'rotateLeft')}${button('rotateRight', 'Rotate right', 'rotateRight')}</div>`;
            if (!isCivilizationBuildingType(b!.type)) html += button('rally', 'Rally point', 'rally');
          } else html += button('cancelBuild', 'Cancel build', 'cancel');
        } else if (this.tab === 'build') {
          for (let k of contentKeys(BUILDINGS).filter(k => civilizationBuildingAvailable(k, this.game.civilizationStage)))
            html += button('build:' + k, buildingName(k, f), k, {
              cost: this.game.cost(k, 'building', this.localTeam)
            });
        } else {
          let types: Record<'infantry' | 'vehicles' | 'aircraft', UnitType[]> = { infantry: ['worker', 'rifle', 'medic', 'hero'], vehicles: ['tank', 'artillery'], aircraft: ['air', 'destroyer'] };
          for (let k of types[this.tab] || [])
            html += button('train:' + k, unitName(k, f), k, {
              cost: this.game.cost(k, 'unit', this.localTeam)
            });
        }
        const tutorialBack = tutorialAction === 'tab:root';
        $('actions').innerHTML = (this.tab === 'root' ? '' :
          `<button class="menu-back${tutorialBack ? ' tutorial-focus' : ''}" data-action="tab:root">${uiIcon('back')}Back</button>`) +
          (noFreeWorker ? '<p class="building-status" role="status">No free worker. Recruit one or finish a build/repair.</p>' : '') +
          `<div class="action-grid${this.tab === 'root' ? ' root-grid' : ''}">` + html + '</div>' +
          (this.tab === 'building' ? `<p class="building-status">${esc(buildingName(b!.type, f))}${ready ?
            '<br>' + esc([repairing ? 'Worker assigned' : repairReason, sellReason].filter(Boolean).join(' · ')) : b!.forumId !== undefined ? '<br>Automatic construction' : ''}${b!.type === 'meridianforum' && ready ?
            `<br>Cinder: ${Math.floor(b!.cinderStock || 0)} / ${FORUM_SETTLEMENT.capacity}<br>Buildings: ${this.game.alive(e => e.kind === 'building' && e.forumId === b!.id).length} / ${forumBuildingTarget(b!)} (max ${FORUM_SETTLEMENT.buildings})<br>Send prospectors here to supply this settlement.` : ''}</p>` : '');
      },
      buildingAction(this: MeridianUI, action: string, id: number) {
        if (this.view !== 'game' || this.paused || this.modalKind || this.mode || !this.game.s || this.game.s!.result) return;
        if (action === 'rotateLeft' || action === 'rotateRight') {
          this.submitAction({ kind: 'rotateBuilding', id, direction: action === 'rotateLeft' ? -1 : 1 });
          this.updateHUD();
        } else if (action === 'repair') {
          this.submitAction({ kind: 'toggleRepair', id });
          this.updateHUD();
        } else if (action === 'sell') {
          let reason = this.game.canSellBuilding(id, this.localTeam);
          if (reason) { this.toast(reason); return; }
          let b = this.game.get(id), refund = this.game.buildingSaleRefund(id, this.localTeam);
          if (!b || !refund) return;
          this.sellBuildingId = id;
          this.paused = true;
          this.clearMode();
          this.openModal('sell',
            `<div class="eyebrow">SELL STRUCTURE</div><h1>Sell ${esc(buildingName(b.type, b.faction))}?</h1><p>Refund: <b>${refund.cost} Cinder / ${refund.gas} Echo</b>.</p><p>Includes 50% of the building’s purchase value and a full refund for all ${b.queue.length} pending recruitments. ${b.type === 'meridianforum' ? 'Stored Cinder is lost; its settlement disappears gradually.' : b.kind === 'building' && b.forumId !== undefined ? 'This free settlement building yields no purchase refund. Its Forum will grow a replacement if space permits.' : 'The structure is removed immediately; supply capacity may decrease.'}</p><div class="launch-row"><button class="primary" data-ui="confirmSale">SELL STRUCTURE</button><button class="secondary" data-ui="cancelSale">KEEP STRUCTURE</button></div>`);
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
        for (let b of this.game.alive(e => e.team === this.localTeam && e.kind === 'building' && !!e.queue?.length))
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
        const team = this.localTeam, faction = this.game.s!.parties[team].faction,
          inputs = this.queueInputs ||= [];
        let index = 2, changed = this.queueSignature === undefined || inputs[0] !== team || inputs[1] !== faction;
        inputs[0] = team; inputs[1] = faction;
        // Compare values, not time or entity identity: local commands can change a
        // queue between ticks; presentation caches compare current values.
        // Keep this read-only scan; caching producers needs a simulation revision contract.
        for (const b of this.game.s!.entities) {
          if (!(b.hp > 0) || b.team !== team || b.kind !== 'building' || !b.queue) continue;
          for (let i = 0; i < b.queue.length; i++) {
            const q = b.queue[i];
            if (inputs[index] !== q.type || inputs[index+1] !== i ||
              inputs[index+2] !== q.progress || inputs[index+3] !== q.time) changed = true;
            inputs[index++] = q.type; inputs[index++] = i;
            inputs[index++] = q.progress; inputs[index++] = q.time;
          }
        }
        if (inputs.length !== index) changed = true;
        inputs.length = index;
        if (!changed) return;
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
          const type = button.dataset.queueType as UnitType, entries = groups[type]!;
          let next: QueueItem | undefined;
          // Strict comparison retains producer order for equal remaining times.
          for (const entry of entries) if (entry.index === 0 &&
            (!next || entry.q.time * (1 - entry.q.progress) < next.time * (1 - next.progress))) next = entry.q;
          const remaining = next ? Math.ceil(next.time * (1 - next.progress)) + 's' : '…',
            progress = (next ? clamp(next.progress, 0, 1) * 360 : 360) + 'deg',
            count = button.querySelector('.queue-count')!, time = button.querySelector('.queue-time')!,
            label = `${unitName(type, faction)} · ${entries.length} pending · ${next ? remaining : 'waiting'} · cancel one recruitment`;
          if (button.style.getPropertyValue('--progress') !== progress) button.style.setProperty('--progress', progress);
          if (button.classList.contains('waiting') !== !next) button.classList.toggle('waiting', !next);
          if (count.textContent !== String(entries.length)) count.textContent = String(entries.length);
          if (time.textContent !== remaining) time.textContent = remaining;
          if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
        }
      },
      updateHUD(this: MeridianUI) {
        let s = this.game.s;
        if (!s) return;
        const account = s.parties[this.localTeam].account;
        $('alloyCount').textContent = Math.floor(account.alloy).toLocaleString();
        $('gasCount').textContent = Math.floor(account.gas).toLocaleString();
        const supply = this.game.supply(this.localTeam), capacity = this.game.cap(this.localTeam);
        this.reconcileBattleTutorial(supply, capacity);
        $('supplyCount').textContent = supply + '/' + capacity;
        $('supplyCount').style.color = supply >= capacity ? 'var(--red)' : '';
        $('energyCount').textContent = String(Math.floor(account.energy));
        $('gameTime').textContent = formatTime(s.time);
        const speedButton = $('speedBtn'), speedLabel = String(s.speed).replace('.', ',') + '×';
        speedButton.textContent = speedLabel;
        speedButton.setAttribute('aria-label', `Simulation speed: ${speedLabel}. Tap to change.`);
        $('battleStage').textContent = `STAGE ${s.depth + 1}`;
        const civilization = $('civilizationCount');
        civilization.classList.toggle('hidden', !this.expedition);
        if (this.expedition) {
          this.refreshCivilizationScore();
          const expedition = this.expedition, score = expedition.civilizationScore,
            runningBattle = !!expedition.battle || (this.activeWorldStage === null && s.rules.kind === 'single-player' && !s.rules.completed && !s.result),
            stage = expedition.depth + (runningBattle ? 2 : 1), required = civilizationScoreRequirement(stage),
            scoreReady = score >= required, stageReady = !runningBattle && expeditionStageUnlocked(expedition),
            progress = stageReady ? 1 : Number.isFinite(required) ? Math.min(1, score / required) : 0;
          civilization.textContent = `${stageReady ? '→' : scoreReady ? '✓' : 'CIV'} ${score.toLocaleString('en-US', { notation: 'compact', maximumSignificantDigits: 2, useGrouping: false })}`;
          civilization.classList.toggle('stage-ready', stageReady);
          civilization.style.setProperty('--civilization-progress', `${progress * 100}%`);
          civilization.title = `Civilization Score: ${score.toLocaleString('en-US')}. ` + (stageReady
            ? `Stage ${stage} unlocked. Return to the expedition via the main menu.`
            : `${Number.isFinite(required) ? `Stage ${stage}: ${required.toLocaleString('en-US')} points required.` : 'Next score requirement exceeds supported range.'} ${scoreReady ? 'Score ready; military victory still required.' : 'Build in any world to increase your score.'}`);
          civilization.setAttribute('role', 'img');
          civilization.setAttribute('aria-label', civilization.title);
        }
        this.selected = this.selected.filter(id => { const e = this.game.get(id); return e && this.game.observed(e); });
        this.renderActions(supply, capacity);
      },
      updateActionStates(this: MeridianUI, supply?: number, capacity?: number) {
        const s = this.game.s;
        if (!s) return;
        const buttons = document.querySelectorAll<HTMLButtonElement>('[data-action]');
        if (!buttons.length) return;
        supply ??= this.game.supply(this.localTeam);
        capacity ??= this.game.cap(this.localTeam);
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
              !this.game.afford(this.game.cost(arg, 'unit', this.localTeam), this.localTeam) ||
              !this.game.availableProducers(d.from, this.localTeam).length ||
              supply + d.supply > capacity;
            if (arg === 'hero' && this.game.alive(e => e.team === this.localTeam &&
              (e.type === 'hero' || e.queue?.some(q => q.type === 'hero'))).length) disabled = true;
          } else if (k === 'build' && hasContentKey(BUILDINGS, arg))
            disabled = !!this.game.canBuild(arg, null, this.localTeam) || !this.game.afford(this.game.cost(arg, 'building', this.localTeam), this.localTeam);
          else if (k === 'ability' && hasContentKey(ABILITIES, arg)) {
            let energy = this.game.abilityStats(arg, this.localTeam).energy,
              requirement = this.game.abilityRequirement(arg, this.localTeam), account = s.parties[this.localTeam].account;
            disabled = !!requirement || account.energy < energy || account.abilities[arg] > s.time;
            let badge = b.querySelector('small');
            if (badge)
              badge.textContent =
                requirement ? 'TECH' : account.abilities[arg] > s.time
                  ? Math.ceil(account.abilities[arg] - s.time) + 's'
                  : energy + 'ϟ';
          }
          if (k === 'repair') disabled = !!this.mode || !this.selectedBuilding() ||
            (!this.game.buildingRepairers(this.selected[0], this.localTeam).length && !!this.game.canRepairBuilding(this.selected[0], this.localTeam));
          if (k === 'sell') disabled = !!this.mode || !!this.game.canSellBuilding(this.selected[0], this.localTeam);
          if (k === 'rotateLeft' || k === 'rotateRight') disabled = !!this.mode || !this.game.managedBuilding(this.selected[0], this.localTeam);
          disabled ||= this.controlsLocked || !!s.result;
          b.disabled = disabled;
          b.classList.toggle('disabled', disabled);
        }
      }
    };
    type UIActionMethods = typeof uiActionMethods;
    interface MeridianUI extends UIActionMethods {}
    defineMeridianUIMethods(uiActionMethods);
