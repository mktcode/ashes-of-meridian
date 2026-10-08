    /* MeridianUI selection, action panel, queues and HUD. Loaded after ui/core.js. */
    'use strict';
    interface UIActionButtonOptions { badge?: string | number; disabled?: boolean; cost?: Cost; favoriteSlot?: number }
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
        this.setTab('root');
      },
      selectedBuilding(this: MeridianUI) {
        let e = this.selected.length === 1 ? this.game.get(this.selected[0]) : null;
        return e?.team === this.localTeam && e.kind === 'building' && e.hp > 0 ? e : null;
      },
      setTab(this: MeridianUI, tab: string) {
        if (!['root', 'build', 'infantry', 'vehicles', 'aircraft', 'details'].includes(tab)) return;
        this.clearMode(tab !== 'details');
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
      quickAccess(this: MeridianUI): QuickAccessAction[] {
        return this.profile.quickAccess ?? ['favorite:worker', 'favorite:rifle', 'build:depot', 'build:barracks'];
      },
      beginFavoriteEdit(this: MeridianUI, slot: number) {
        if (this.view !== 'game' || this.controlsLocked || this.game.s?.result || !Number.isInteger(slot) || slot < 0 || slot > 3) return;
        this.clearMode();
        this.editFavoriteSlot = slot;
        this.setTab('root');
      },
      clearMode(this: MeridianUI, preserveFavoriteEdit = false) {
        if (!preserveFavoriteEdit) this.editFavoriteSlot = null;
        this.mode = null;
        $('world').style.cursor = 'default';
        this.actionSignature = '';
      },
      perform(this: MeridianUI, action: string) {
        if (!this.game.s || this.controlsLocked || this.game.s!.result) return;
        let [kind, arg] = action.split(':');
        if (this.editFavoriteSlot !== null && kind !== 'tab') {
          if ((kind === 'build' && hasContentKey(BUILDINGS, arg)) || (kind === 'train' && hasContentKey(UNITS, arg))) {
            const favorites = [...this.quickAccess()];
            favorites[this.editFavoriteSlot] = `${kind === 'train' ? 'favorite' : 'build'}:${arg}` as QuickAccessAction;
            this.profile.quickAccess = favorites;
            this.persistence.saveProfile(this.profile);
            this.notifyStorageFailure();
            this.clearMode();
            this.setTab('root');
            return;
          }
          this.clearMode();
        }
        const reason = this.actionReason(action);
        if (reason) { this.toast(reason); return; }
        if (kind === 'settlementUpgrade' || kind === 'settlementClear' || kind === 'settlementExpand') {
          const b = this.selectedBuilding();
          if (!b) return;
          const applied = kind === 'settlementExpand' ? this.submitAction({kind:'expandSettlementBuilding', id:b.id}) :
            this.submitAction({kind:'configureSettlementUpgrade', id:b.id,
              upgrade:kind === 'settlementClear' ? null : arg as CivilizationUpgradeType});
          if (applied) { this.audio.sound('research'); this.actionSignature = ''; this.saveBattle(); }
          this.updateHUD();
          return;
        }
        if (kind === 'tab') {
          this.setTab(arg);
          return;
        }
        if ((kind === 'train' || kind === 'favorite') && hasContentKey(UNITS, arg)) {
          const producerId = kind === 'favorite' ? this.favoriteProducer(arg) : undefined;
          this.submitAction({ kind: 'train', unit: arg, ...(producerId === undefined ? {} : { producerId }) });
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
          case 'clearSelection': this.select([]); break;
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
      favoriteProducer(this: MeridianUI, type: UnitType) {
        const b = this.selectedBuilding();
        return b && b.type === UNITS[type].from ? b.id : undefined;
      },
      actionButton(this: MeridianUI, key: string, label: string, ic: string, opts: UIActionButtonOptions = {}, tutorialAction: string | null = this.tutorialAction()) {
        const active = this.isModeAction(key), [kind, type] = key.split(':'), faction = this.game.s?.parties[this.localTeam].faction;
        const preview = faction !== undefined && kind === 'build' && hasContentKey(BUILDINGS, type)
          ? renderModelThumbnail(faction, 'building', type, 'action-model', 1.35)
          : faction !== undefined && (kind === 'train' || kind === 'favorite') && hasContentKey(UNITS, type)
            ? renderModelThumbnail(faction, 'unit', type, 'action-model', 1.35) : '';
        const cost = opts.cost, costLabel = cost ? ` · ${cost.cost} Cinder${cost.gas ? ' · ' + cost.gas + ' Echo' : ''}` : '';
        const supplyLabel = (kind === 'train' || kind === 'favorite') && hasContentKey(UNITS, type) ? ` · Supply ${UNITS[type].supply}` : '';
        const editing = opts.favoriteSlot !== undefined && opts.favoriteSlot === this.editFavoriteSlot;
        const baseLabel = editing ? `Quick access slot ${opts.favoriteSlot! + 1} · Choose replacement from a category · Tap to cancel editing` :
          label + costLabel + supplyLabel + (opts.favoriteSlot !== undefined ? ' · Hold to replace favorite' :
            this.editFavoriteSlot !== null && (kind === 'build' || kind === 'train') ? ` · Assign to quick access slot ${this.editFavoriteSlot + 1}` : '');
        const name = active ? `${label} · Cancel targeting` : baseLabel;
        return `<button ${opts.favoriteSlot !== undefined ? `data-favorite-slot="${opts.favoriteSlot}" ` : ''}class="action ${editing ? 'favorite-edit' : ''} ${preview ? 'model-action' : ''} ${opts.disabled ? 'blocked' : ''} ${active ? 'active cancel-target' : ''} ${tutorialAction === key ? 'tutorial-focus' : ''}" data-action="${key}" data-label="${esc(baseLabel)}" aria-label="${esc(name)}" title="${esc(name)}"${kind === 'build' || kind === 'ability' || kind === 'rally' ? ` aria-pressed="${active}"` : ''}>${uiSkin()}${preview || uiIcon(kind === 'tab' ? key : ic, ic)}${cost ? `<span class="cost" aria-hidden="true"><span>${cost.cost} C</span>${cost.gas ? `<span>${cost.gas} E</span>` : ''}</span>` : ''}${kind === 'ability' ? `<small data-badge="${key}" aria-hidden="true">${active ? '' : opts.badge || ''}</small>` : ''}</button>`;
      },
      renderActions(this: MeridianUI, supply?: number, capacity?: number) {
        if (this.battleTutorial?.step === 'trainRifle' || this.battleTutorial?.step === 'buildDepot') {
          supply ??= this.game.supply(this.localTeam);
          capacity ??= this.game.cap(this.localTeam);
        }
        this.updateTutorialGoal(supply, capacity);
        this.renderActionMarkup(supply, capacity);
        this.renderSelectionStatus(supply, capacity);
        this.updateActionStates(supply, capacity);
        this.updateHUDLayout();
      },
      renderActionMarkup(this: MeridianUI, supply?: number, capacity?: number) {
        const s = this.game.s;
        if (!s) return;
        if (this.tab === 'details' && (!this.selected.length || this.selected.some(id => this.game.get(id)?.kind !== 'unit'))) this.tab = 'root';
        if (this.mode?.kind === 'rally' && !this.selectedBuilding()) this.clearMode();
        const tutorialAction = this.tutorialAction(supply, capacity), f = s.parties[this.localTeam].faction,
          b = this.selectedBuilding(), civilian = this.tab === 'root' && b?.forumId !== undefined && b.progress >= 1;
        const button = (key: string, label: string, ic: string, opts: UIActionButtonOptions = {}) => this.actionButton(key, label, ic, opts, tutorialAction);
        const sig = [this.localTeam, this.tab, f, s.parties[this.localTeam].loadout.join(','), this.selected.join(','),
          this.mode?.kind, this.mode?.arg, tutorialAction, civilian, b?.upgrade, b?.upgradeLevel, this.editFavoriteSlot, this.quickAccess().join(',')].join(':');
        if (sig === this.actionSignature) return;
        this.actionSignature = sig;
        $('hud').classList.toggle('favorites-editing', this.editFavoriteSlot !== null);
        const catalog = this.tab !== 'root' && this.tab !== 'details';
        $('abilityBar').classList.toggle('hidden', catalog || this.tab === 'details' || civilian);
        $('actionPanel').classList.toggle('details-panel', this.tab === 'details');
        $('actionPanel').classList.toggle('settlement-panel', civilian);
        $('abilityBar').innerHTML = s.parties[this.localTeam].loadout.map(key => button('ability:' + key, ABILITIES[key].name, ABILITIES[key].icon)).join('');
        const back = button('tab:root', this.editFavoriteSlot === null ? 'Close menu' : `Back · Replacing quick access slot ${this.editFavoriteSlot + 1}`, 'back');
        let html = '';
        if (civilian && b) {
          html = this.renderSettlementUpgrades(b);
        } else if (this.tab === 'root') {
          html = `<div class="compact-dock"><div class="favorites" role="group" aria-label="Quick access">${
            this.quickAccess().map((action, favoriteSlot) => {
              const [kind, type] = action.split(':');
              return button(action, kind === 'build' ? buildingName(type as BuildingType, f) : unitName(type as UnitType, f), type, { favoriteSlot });
            }).join('')
          }</div><div class="category-nav" role="group" aria-label="Build and recruit">${[
            ['build', 'Buildings', 'hq'], ['infantry', 'Infantry', 'rifle'], ['vehicles', 'Vehicles', 'tank'], ['aircraft', 'Aircraft', 'air']
          ].map(([tab, label, ic]) => button('tab:' + tab, label, ic)).join('')}</div></div>`;
        } else if (this.tab === 'details') {
          const list = this.selected.map(id => this.game.get(id)).filter((e): e is UnitEntity => e?.kind === 'unit');
          const groups = new Map<UnitType, UnitEntity[]>();
          for (const e of list) groups.set(e.type, [...groups.get(e.type) || [], e]);
          html = `<div class="details-heading">${back}<span>Unit details</span></div><div class="details-body">${[...groups].map(([type, group]) =>
            `<section><strong>${esc(unitName(type, group[0].faction))}${group.length > 1 ? ' × ' + group.length : ''}</strong><p>${esc(UNITS[type].desc)}</p><small>Hull ${Math.ceil(group.reduce((n, e) => n + e.hp, 0))} / ${Math.ceil(group.reduce((n, e) => n + e.maxHp, 0))} · Shields ${Math.ceil(group.reduce((n, e) => n + e.shield, 0))} · Supply ${UNITS[type].supply}</small></section>`
          ).join('')}</div>`;
        } else {
          if (this.tab === 'build') {
            html = contentKeys(BUILDINGS).filter(k => civilizationBuildingAvailable(k)).map(k =>
              button('build:' + k, buildingName(k, f), k, { cost: this.game.cost(k, 'building', this.localTeam) })).join('');
          } else {
            const types: Record<'infantry' | 'vehicles' | 'aircraft', UnitType[]> = { infantry: [...(this.editFavoriteSlot !== null || !this.quickAccess().includes('favorite:worker') ? ['worker' as UnitType] : []), 'rifle', 'medic', 'hero'], vehicles: ['tank', 'artillery'], aircraft: ['air', 'destroyer'] };
            html = types[this.tab].map(k => button('train:' + k, unitName(k, f), k, { cost: this.game.cost(k, 'unit', this.localTeam) })).join('');
          }
          html = `<div class="catalog-grid" role="group" aria-label="${this.tab === 'build' ? 'Buildings' : this.tab}">${back}${html}</div>`;
        }
        $('actions').innerHTML = html;
      },
      renderSettlementUpgrades(this: MeridianUI, b: BuildingEntity): string {
        const level = b.upgradeLevel || 0, nextCost = CIVILIZATION_UPGRADE_COSTS[level],
          family = civilizationBuildingFamily(b.type) === 'research' ? 'Research' : 'Residential',
          unavailable = b.upgrade && !civilizationUpgradeAllowed(b.type, b.upgrade),
          label = level >= 3 ? 'Fully expanded · Rank 3' : `Expand to rank ${level + 1} · ${nextCost} Echo`;
        return `<div class="settlement-upgrades"><header><strong>${family} upgrade · Rank ${level || '—'}</strong>${unavailable ? '<small>The stored effect is unavailable for this family; choose a listed effect or clear it. Purchased ranks are kept.</small>' : ''}</header><div class="settlement-controls"><button data-action="settlementExpand" data-label="${esc(label)}">${uiSkin()}${esc(label)}</button><button data-action="settlementClear" data-label="Clear effect · Keep purchased rank">${uiSkin()}Clear effect</button></div><div class="settlement-effect-list" role="group" aria-label="Choose building upgrade">${contentKeys(CIVILIZATION_UPGRADES).filter(key => civilizationUpgradeAllowed(b.type, key)).map(key => {
          const effect = CIVILIZATION_UPGRADES[key], selected = b.upgrade === key,
            rule = civilizationUpgradeUnique(key) ? 'Once per expedition; extra buildings or ranks do not strengthen this effect.' :
              effect.max !== undefined && effect.max < 999999 ? `Stacks across worlds, up to ${effect.max} ranks.` : 'Stacks across all cleared worlds.',
            cost = level ? selected ? 'Selected' : 'Free switch' : `${CIVILIZATION_UPGRADE_COSTS[0]} Echo`,
            text = `${effect.name} · ${cost}`;
          return `<button class="settlement-effect${selected ? ' active' : ''}" data-action="settlementUpgrade:${key}" data-label="${esc(text)}" aria-pressed="${selected}">${uiSkin()}<span class="sigil">${uiIcon(key, effect.icon)}</span><span><strong>${esc(effect.name)}</strong><small>${esc(effect.desc)} ${esc(rule)}</small></span><em>${cost}</em></button>`;
        }).join('')}</div></div>`;
      },
      renderSelectionStatus(this: MeridianUI, supply?: number, capacity?: number) {
        const list = this.selected.map(id => this.game.get(id)).filter((e): e is Entity => !!e), el = $('selectionStatus');
        el.classList.toggle('hidden', !list.length || this.tab !== 'root');
        if (!list.length) { el.innerHTML = ''; return; }
        const e = list[0], b = this.selectedBuilding(), enemy = list.some(e => e.team !== -1 && e.team !== this.localTeam);
        const name = list.length > 1 ? `${list.length} units selected` : e.kind === 'unit' ? unitName(e.type, e.faction)
          : e.kind === 'building' ? buildingName(e.type, e.faction) : e.type === 'gas' ? 'Echo vent' : 'Cinder deposit';
        const hp = Math.ceil(list.reduce((n, e) => n + e.hp, 0)), max = Math.ceil(list.reduce((n, e) => n + e.maxHp, 0));
        const shield = Math.ceil(list.reduce((n, e) => n + e.shield, 0)), maxShield = list.reduce((n, e) => n + e.maxShield, 0);
        const value = e.kind === 'resource' ? `${Math.floor(e.amount).toLocaleString('en-US')} remaining` : `HP ${hp.toLocaleString('en-US')} / ${max.toLocaleString('en-US')}`;
        const summary = `<span class="summary-title">${esc(name)}</span><span class="selection-health ${enemy ? 'enemy' : 'own'}" style="--health:${clamp(hp / max, 0, 1) * 100}%"${e.kind !== 'resource' ? ` role="meter" aria-label="Hull ${hp} of ${max}${maxShield ? '; Shields ' + shield + ' of ' + Math.ceil(maxShield) : ''}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${hp}"` : ''}><span>${value}</span>${maxShield ? `<i class="shield-meter" style="width:${clamp(shield / maxShield, 0, 1) * 100}%" aria-hidden="true"></i>` : ''}</span>`;
        const producer = b && contentKeys(UNITS).some(type => UNITS[type].from === b.type), count = producer ? Math.min(5, b.queue.length) : 0;
        const dots = producer ? `<span class="selection-queue" role="img" aria-label="${count} of 5 orders in ${esc(name)} #${b.id}">${Array.from({ length: 5 }, (_, i) => `<i class="${i < count ? 'occupied' : ''}" aria-hidden="true"></i>`).join('')}</span>` : '';
        const avatar = e.kind === 'resource' ? uiIcon(e.type === 'gas' ? 'aether' : 'crystal') : renderModelThumbnail(e.faction, e.kind, e.type, 'selection-model', 1.35);
        const tutorialAction = this.tutorialAction(supply, capacity);
        const button = (key: string, label: string, ic: string) => this.actionButton(key, label, ic, {}, tutorialAction);
        let actions = '';
        if (b) {
          if (b.progress >= 1) {
            const repairing = this.game.buildingRepairers(b.id, this.localTeam).length > 0;
            actions = button('sell', 'Sell structure', 'cancel') + button('repair', repairing ? 'Stop repair' : 'Repair structure', 'repair');
            if (!isCivilizationBuildingType(b.type)) actions += button('rally', 'Rally point', 'rally');
            actions += button('rotateLeft', 'Rotate left', 'rotateLeft') + button('rotateRight', 'Rotate right', 'rotateRight');
          } else actions = button('cancelBuild', 'Cancel construction', 'cancel');
        }
        const markup = `${uiSkin()}<span class="selection-avatar ${producer ? 'has-queue' : ''}">${avatar}${dots}</span>${e.kind === 'unit' && list.every(e => e.kind === 'unit') ? `<button class="selection-summary" data-action="tab:details" aria-label="${esc(name)} · Unit details">${summary}</button>` : `<div class="selection-summary">${summary}</div>`}<div class="building-controls">${actions}${button('clearSelection', 'Clear selection', 'close')}</div>`;
        if (el.innerHTML !== markup) el.innerHTML = markup;
      },
      updateHUDLayout(this: MeridianUI) {
        // Hidden HUDs have zero geometry; do not overwrite the visible layout defaults.
        if ($('hud').classList.contains('hidden')) return;
        // Only queue/radio/toast placement depends on HUD layout. The world stays fullscreen.
        // Layout offsets exclude entrance/exit transforms, unlike getBoundingClientRect().
        const deck = $('commandDeck'), panel = $('actionPanel'), status = $('selectionStatus');
        const top = deck.offsetTop + Math.min(0, panel.offsetTop, status.classList.contains('hidden') ? 0 : status.offsetTop);
        if (!Number.isFinite(top) || typeof innerHeight !== 'number') return;
        const height = Math.max(0, innerHeight - top), style = document.documentElement?.style;
        style?.setProperty('--hud-height', height + 'px');
        style?.setProperty('--queue-floor', height + 8 + 'px');
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
            `<div class="eyebrow">SELL STRUCTURE</div><h1>Sell ${esc(buildingName(b.type, b.faction))}?</h1><p>Refund: <b>${refund.cost} Cinder / ${refund.gas} Echo</b>.</p><p>Includes 50% of the building’s purchase value and a full refund for all ${b.queue.length} pending recruitments. ${b.type === 'meridianforum' ? 'Stored Cinder is lost; its settlement disappears gradually.' : b.kind === 'building' && b.forumId !== undefined ? 'This free settlement building yields no purchase refund. Its Forum will grow a replacement if space permits.' : 'The structure is removed immediately; supply capacity may decrease.'}</p><div class="launch-row"><button class="primary" data-ui="confirmSale">${uiSkin()}SELL STRUCTURE</button><button class="secondary" data-ui="cancelSale">${uiSkin()}KEEP STRUCTURE</button></div>`);
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
            `<button class="queue-item" data-queue-type="${type}">${uiSkin()}${icon(type)}<span class="queue-count"></span><span class="queue-time"></span></button>`
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
        const speedButton = $('speedBtn'), speedLabel = String(s.speed).replace('.', ',') + '×';
        speedButton.textContent = speedLabel;
        speedButton.setAttribute('aria-label', `Simulation speed: ${speedLabel}. Tap to change.`);
        $('battleStage').textContent = `STAGE ${s.depth + 1}`;
        this.selected = this.selected.filter(id => { const e = this.game.get(id); return e && this.game.observed(e); });
        this.renderActions(supply, capacity);
      },
      actionReason(this: MeridianUI, action: string, supply?: number, capacity?: number) {
        if (this.editFavoriteSlot !== null && /^(build|train|favorite):/.test(action)) return '';
        if (this.isModeAction(action)) return '';
        const [kind, arg] = action.split(':'), team = this.localTeam, s = this.game.s;
        if (!s) return '';
        if ((kind === 'train' || kind === 'favorite') && hasContentKey(UNITS, arg))
          return this.game.recruitmentReason(arg, team, kind === 'favorite' ? this.favoriteProducer(arg) : undefined, supply, capacity);
        if (kind === 'build' && hasContentKey(BUILDINGS, arg)) {
          const cost = this.game.cost(arg, 'building', team), account = s.parties[team].account;
          return this.game.canBuild(arg, null, team) || (account.alloy < cost.cost ? 'Not enough Cinder.' : '') ||
            (account.gas < cost.gas ? 'Not enough Echo.' : '');
        }
        if (kind === 'ability' && hasContentKey(ABILITIES, arg)) {
          const account = s.parties[team].account;
          return this.game.abilityRequirement(arg, team) || (account.abilities[arg] > s.time ? 'Ability is cooling down.' : '') ||
            (account.energy < this.game.abilityStats(arg, team).energy ? 'Not enough energy.' : '');
        }
        const b = this.selectedBuilding();
        if (kind === 'settlementExpand') return this.game.settlementExpansionReason(b?.id || 0, team);
        if (kind === 'settlementClear') return this.game.settlementUpgradeReason(b?.id || 0, null, team);
        if (kind === 'settlementUpgrade') return hasContentKey(CIVILIZATION_UPGRADES, arg)
          ? this.game.settlementUpgradeReason(b?.id || 0, arg, team) : 'Unknown upgrade effect.';
        if (['repair', 'sell', 'rotateLeft', 'rotateRight'].includes(kind) && this.mode) return 'Cancel targeting first.';
        if (kind === 'repair') return !b ? 'Select an own structure.' : this.game.buildingRepairers(b.id, team).length ? '' : this.game.canRepairBuilding(b.id, team);
        if (kind === 'sell') return this.game.canSellBuilding(this.selected[0], team);
        if (kind === 'rotateLeft' || kind === 'rotateRight') return this.game.managedBuilding(this.selected[0], team) ? '' : 'This structure cannot be rotated.';
        return '';
      },
      updateActionStates(this: MeridianUI, supply?: number, capacity?: number) {
        const s = this.game.s;
        if (!s) return;
        for (const b of document.querySelectorAll<HTMLButtonElement>('[data-action]')) {
          const key = b.dataset.action!, [kind, arg] = key.split(':'),
            active = kind === 'settlementUpgrade' ? this.selectedBuilding()?.upgrade === arg : this.isModeAction(key),
            reason = this.actionReason(key, supply, capacity);
          // Blocked actions remain tappable to explain the reason. Only lifecycle locks disable input.
          b.disabled = this.controlsLocked || !!s.result;
          b.classList.toggle('blocked', !!reason);
          b.classList.toggle('active', active);
          b.classList.toggle('cancel-target', active && kind !== 'settlementUpgrade');
          if (kind === 'build' || kind === 'ability' || kind === 'rally' || kind === 'settlementUpgrade') b.setAttribute('aria-pressed', String(active));
          const base = b.dataset.label || '', label = active && kind !== 'settlementUpgrade' ? `${base.split(' · ')[0]} · Cancel targeting` : base + (reason ? ` · ${reason} · Tap for reason` : '');
          if (b.dataset.label !== undefined) {
            b.setAttribute('aria-label', label);
            b.setAttribute('title', label);
          }
          if (kind === 'ability' && hasContentKey(ABILITIES, arg)) {
            const badge = b.querySelector('small'), account = s.parties[this.localTeam].account;
            if (badge) badge.textContent = active ? '' : this.game.abilityRequirement(arg, this.localTeam) ? 'TECH' :
              account.abilities[arg] > s.time ? Math.ceil(account.abilities[arg] - s.time) + 's' : this.game.abilityStats(arg, this.localTeam).energy + 'ϟ';
          }
        }
      }
    };
    type UIActionMethods = typeof uiActionMethods;
    interface MeridianUI extends UIActionMethods {}
    defineMeridianUIMethods(uiActionMethods);
