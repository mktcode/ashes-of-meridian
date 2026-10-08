    /* MeridianUI DOM, pointer and targeting input. Loaded after ui/core.js. */
    'use strict';
    const uiInputMethods = {
      bind(this: MeridianUI) {
        let favoriteHold: { slot: number; startedAt: number; pointerId: number; x: number; y: number; timer: ReturnType<typeof setTimeout> } | null = null;
        let suppressFavoriteClick: number | null = null;
        const cancelFavoriteHold = () => {
          if (favoriteHold) clearTimeout(favoriteHold.timer);
          favoriteHold = null;
        };
        document.addEventListener('pointerdown', e => {
          this.audio.unlock();
          this.domPressed = !!(e.target as Element | null)?.closest('button,select,input');
          cancelFavoriteHold();
          suppressFavoriteClick = null;
          const b = (e.target as Element | null)?.closest<HTMLButtonElement>('button[data-favorite-slot]');
          if (!b || b.disabled || e.button !== 0 || e.isPrimary === false || this.view !== 'game' || this.controlsLocked || this.game.s?.result) return;
          const slot = Number(b.dataset.favoriteSlot);
          if (!Number.isInteger(slot) || slot < 0 || slot > 3) return;
          const startedAt = e.timeStamp ?? performance.now();
          favoriteHold = { slot, startedAt, pointerId: e.pointerId, x: e.clientX, y: e.clientY, timer: setTimeout(() => {
            favoriteHold = null;
            suppressFavoriteClick = slot;
            this.beginFavoriteEdit(slot);
          }, Math.max(0, 550 - Math.max(0, performance.now() - startedAt))) };
        });
        document.addEventListener('pointermove', e => {
          if (favoriteHold && e.pointerId === favoriteHold.pointerId && Math.hypot(e.clientX - favoriteHold.x, e.clientY - favoriteHold.y) > 10) cancelFavoriteHold();
        });
        document.addEventListener('pointerup', e => {
          this.domPressed = false;
          // A busy render frame may delay the timer until after release.
          if (favoriteHold && e.pointerId === favoriteHold.pointerId && (e.timeStamp ?? performance.now()) - favoriteHold.startedAt >= 550) {
            const slot = favoriteHold.slot;
            cancelFavoriteHold();
            suppressFavoriteClick = slot;
            this.beginFavoriteEdit(slot);
          }
          cancelFavoriteHold();
          if (suppressFavoriteClick !== null) setTimeout(() => { suppressFavoriteClick = null; }, 0);
        });
        document.addEventListener('pointercancel', () => { this.domPressed = false; cancelFavoriteHold(); suppressFavoriteClick = null; });
        document.addEventListener('contextmenu', e => {
          if ((e.target as Element | null)?.closest('button[data-favorite-slot]')) e.preventDefault();
        });
        document.addEventListener('click', e => {
          if (this.leavingBattle) return;
          let b = (e.target as Element | null)?.closest('button');
          if (!b || b.disabled) return;
          if (suppressFavoriteClick !== null && b.dataset.favoriteSlot === String(suppressFavoriteClick)) {
            suppressFavoriteClick = null;
            e.preventDefault();
            return;
          }
          if (b.dataset.favoriteSlot !== undefined && this.editFavoriteSlot !== null) {
            this.clearMode();
            this.renderActions();
            return;
          }
          if (b.dataset.ui) {
            this.uiAction(b.dataset.ui);
            return;
          }
          if (this.view === 'codex' && b.dataset.codexFaction !== undefined) {
            const faction = Number(b.dataset.codexFaction);
            if (!Number.isInteger(faction) || faction < 0 || faction >= FACTIONS.length) return;
            this.codexFaction = faction as FactionId;
            this.showCodex();
            return;
          }
          if (this.view === 'codex' && b.dataset.codexType !== undefined) {
            const type = b.dataset.codexType;
            if (b.dataset.codexKind === 'unit' && hasContentKey(UNITS,type)) this.showCodexModel('unit',type);
            else if (b.dataset.codexKind === 'building' && hasContentKey(BUILDINGS,type)) this.showCodexModel('building',type);
            return;
          }
          if (b.dataset.faction !== undefined) {
            let faction = +b.dataset.faction;
            if (!this.factionUnlocked(faction)) return;
            this.battleFaction = faction;
            document
              .querySelectorAll<HTMLElement>('[data-faction]')
              .forEach(a => a.classList.toggle('active', +a.dataset.faction! === this.battleFaction));
            $('factionTrait').textContent = FACTIONS[this.battleFaction].trait;
            return;
          }
          if (hasContentKey(ABILITIES, b.dataset.loadoutAbility)) {
            this.selectBattleAbility(b.dataset.loadoutAbility);
            return;
          }
          if (b.dataset.action) {
            if (!this.controlsLocked) this.perform(b.dataset.action);
            return;
          }
          if (hasContentKey(UNITS, b.dataset.queueType) && !this.controlsLocked && !this.game.s?.result) {
            this.cancelRecruitment(b.dataset.queueType);
            this.updateHUD();
            return;
          }
        });
        document.addEventListener('change', e => {
          const target = e.target as HTMLInputElement | HTMLSelectElement | null;
          if (target?.dataset.setting) this.applySetting(target);
        });
        document.addEventListener('input', e => {
          const target = e.target as HTMLInputElement | HTMLSelectElement | null;
          if (target?.dataset.setting === 'volume') this.applySetting(target);
        });
        $('pauseBtn').onclick = () => (this.paused ? this.resume() : this.pause());
        $('speedBtn').onclick = () => {
          if (this.controlsLocked) return;
          if (this.view !== 'game' || this.paused || !this.game.s || this.game.s!.result) return;
          const speeds = GAME_SPEED.multipliers;
          this.game.s!.speed = speeds[(speeds.indexOf(this.game.s!.speed) + 1) % speeds.length];
          this.lastClick = {};
          this.updateHUD();
        };
        $('radioClose').onclick = () => {
          this.audio.stopVoice?.('dialogue');
          this.radioVoiceId = null;
          $('radio').classList.add('hidden');
          this.radioUntil = 0;
        };
        window.addEventListener('blur', () => {
          cancelFavoriteHold();
          suppressFavoriteClick = null;
          this.resetCodexGesture();
          this.domPressed = false;
          this.drag = null;
        });
        window.addEventListener('pagehide', () => { this.saveBattle(); });
        document.addEventListener('visibilitychange', () => {
          if (document.hidden && this.view === 'game' && !this.game.s?.result) {
            this.pause();
          }
        });
        const c = $('world');
        c.addEventListener('contextmenu', e => e.preventDefault());
        c.addEventListener('wheel', e => {
          if (this.view === 'codexModel' && this.R.containsPoint(e.clientX, e.clientY)) {
            e.preventDefault();
            const pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
            this.codexZoom = clamp(this.codexZoom * Math.exp(clamp(pixels, -240, 240) * .0015), .3, 2);
            return;
          }
          if (this.view !== 'game' || this.controlsLocked || !this.game.s ||
              !this.R.containsPoint(e.clientX, e.clientY)) return;
          e.preventDefault();
          // WheelEvent delta modes are pixels, lines and pages respectively.
          const pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
          this.zoomCamera(this.game.s.cam.zoom * Math.exp(clamp(pixels, -240, 240) * .0015));
          this.lastClick = {};
        }, { passive: false });
        c.addEventListener('pointerdown', e => this.pointerDown(e));
        c.addEventListener('pointermove', e => this.pointerMove(e));
        c.addEventListener('pointerup', e => this.pointerUp(e));
        c.addEventListener('pointercancel', () => {
          this.resetCodexGesture();
          this.lastClick = {};
          this.drag = null;
          this.touchPoints.clear();
          this.touchGesture = false;
          this.pinchDist = this.touchAngle = undefined;
        });
        c.addEventListener('pointerleave', () => {
          this.pointer.inside = false;
          if (!this.drag) this.hover = null;
        });
        c.style.touchAction = 'none';
        let map = $('minimap');
        map.style.touchAction = 'none';
        map.addEventListener('contextmenu', e => e.preventDefault());
        const minimapPosition = (e: PointerEvent) => {
          let r = map.getBoundingClientRect(), extent = this.game.world!.extent;
          return {
            x: ((e.clientX - r.left) / r.width) * (extent * 2) - extent,
            z: ((e.clientY - r.top) / r.height) * (extent * 2) - extent
          };
        };
        let miniDrag = false;
        map.addEventListener('pointerdown', e => {
          if (this.controlsLocked || this.view !== 'game') return;
          e.preventDefault();
          let p = minimapPosition(e);
          // Scan is the sole minimap targeting action; other inputs only navigate.
          if (e.button === 0 && this.mode?.kind === 'ability' && this.mode.arg === 'scan') {
            miniDrag = false;
            if (!this.paused && !this.modalKind && !this.game.s?.result) this.applyTarget(p);
            return;
          }
          this.center(p.x, p.z);
          miniDrag = true;
          map.setPointerCapture(e.pointerId);
        });
        map.addEventListener('pointermove', e => {
          if (!miniDrag || this.controlsLocked) return;
          let p = minimapPosition(e);
          this.center(p.x, p.z);
        });
        map.addEventListener('pointerup', () => (miniDrag = false));
        map.addEventListener('pointercancel', () => (miniDrag = false));
      },
      uiAction(this: MeridianUI, action: string) {
        if (this.leavingBattle) return;
        this.audio.sound('select');
        switch (action) {
          case 'home':
            this.showHome();
            break;
          case 'battle':
            this.showBattle();
            break;
          case 'startBattle':
            this.startBattle();
            break;
          case 'replaceExpedition':
            this.startBattle(true);
            break;
          case 'leaveUnsaved':
            this.showHome(true);
            break;
          case 'discardExpeditionSave':
            this.battleSaveError = null;
            this.expedition = null;
            this.persistence.saveProgress(this.profile, null);
            this.notifyStorageFailure();
            this.showHome();
            break;
          case 'previousStage':
            void this.browseStage(-1);
            break;
          case 'nextStage':
            void this.browseStage(1);
            break;
          case 'enterSelectedStage':
            this.enterSelectedStage();
            break;
          case 'discardWorldSave': {
            if (this.view !== 'home' || this.modalKind !== 'worldSaveError' || !this.expedition) break;
            const stage = this.stageHistory[this.stagePreviewIndex]?.stage;
            const world = this.expedition.worlds?.find(w => w.stage === stage);
            if (!world?.error) break;
            this.expedition.worlds = this.expedition.worlds!.filter(w => w !== world);
            this.persistence.saveProgress(this.profile, this.expedition);
            this.notifyStorageFailure();
            this.showHome();
            break;
          }
          case 'continueExpedition':
            this.continueExpedition();
            break;
          case 'developWorld':
            this.continueBuilding();
            break;
          case 'expeditionBenefits':
            this.showExpeditionBenefits();
            break;
          case 'abandon':
            if (this.view !== 'game' || !this.paused || !this.expedition || this.activeWorldStage !== null || this.modalKind !== 'pause') break;
            this.openModal('abandonExpedition', `<div class="eyebrow">END EXPEDITION</div><h1>Abandon this expedition?</h1><p>This ends the entire expedition and discards its saved battle, all saved worlds and their building upgrades. Your settings and faction unlocks are kept. This cannot be undone.</p><div class="btnstack"><button class="primary" data-ui="closeModal">KEEP PLAYING</button><button class="secondary" data-ui="confirmAbandon">ABANDON EXPEDITION</button></div>`);
            break;
          case 'confirmAbandon':
            if (this.view !== 'game' || !this.paused || !this.expedition || this.activeWorldStage !== null || this.modalKind !== 'abandonExpedition') break;
            this.modalKind = '';
            this.expedition = null;
            this.persistence.saveProgress(this.profile, null);
            this.notifyStorageFailure();
            this.showHome();
            break;
          case 'codex':
            this.showCodex();
            break;
          case 'codexStory':
            if (this.view === 'codex') this.showCodexStory();
            break;
          case 'settings':
            this.showSettings();
            break;
          case 'resume':
            this.resume();
            break;
          case 'closeModal':
            this.closeModal();
            break;
          case 'confirmSale':
            this.finishBuildingSale(true);
            break;
          case 'cancelSale':
            this.finishBuildingSale(false);
            break;
          case 'backPause':
            this.showPause();
            break;
        }
      },
      targetPosition(this: MeridianUI, sx: number, sy: number): Position {
        // A refinery targets a known vent, not the mountain hit by the same screen
        // ray. Share this resolution with the preview; other modes keep terrain picking.
        if (this.mode?.kind === 'build' && this.mode.arg === 'refinery') {
          const vent = this.pick(sx, sy, e => e.kind === 'resource' && e.type === 'gas' && e.team === -1);
          if (vent?.kind === 'resource' && vent.type === 'gas' && vent.team === -1)
            return { x: vent.x, z: vent.z };
        }
        return this.R.ground(sx, sy);
      },
      pick(this: MeridianUI, sx: number, sy: number, filter?: (entity: Entity) => boolean) {
        if (!this.R.containsPoint(sx, sy)) return null;
        let best = null,
          score = Infinity;
        for (let e of this.game.s!.entities) {
          if (e.hp <= 0) continue;
          if (!this.game.observed(e)) continue;
          if (filter && !filter(e)) continue;
          const y = isFlyingUnitType(e.type) ? 4.4 : e.kind === 'building' ? 2.0 : 1,
            height = y + (this.game.world?.surface?.entityHeight(e) ?? 0),
            p = this.R.project(e.x, height, e.z);
          if (!p) continue;
          let edge = this.R.project(e.x + e.size, height, e.z),
            edgeZ = this.R.project(e.x, height, e.z + e.size),
            r = Math.max(e.kind === 'unit' ? 12 : 16,
              edge && edgeZ ? Math.hypot(edge.x - p.x, edgeZ.x - p.x) : 18),
            dx = (sx - p.x) / (r + 5),
            dy = (sy - p.y) / (r * 0.9 + 8),
            d = dx * dx + dy * dy;
          if (d < 1.4 && d + (e.kind === 'unit' ? -0.1 : 0) < score) {
            score = d;
            best = e;
          }
        }
        return best;
      },
      resetCodexGesture(this: MeridianUI) {
        this.codexTouches.clear();
        this.codexPinchDist = undefined;
        this.codexDrag = undefined;
        this.codexManualRotation = false;
      },
      codexTouchDistance(this: MeridianUI) {
        const points = [...this.codexTouches.values()];
        return points.length === 2 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : undefined;
      },
      battleTouchBaseline(this: MeridianUI) {
        const points = [...this.touchPoints.values()];
        this.pinchDist = points.length === 2
          ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) : undefined;
        this.touchAngle = points.length === 2 && this.pinchDist! >= 10
          ? Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x) : undefined;
      },
      rotateCamera(this: MeridianUI, delta: number) {
        if (delta === 0) return;
        const cam = this.game.s!.cam, yaw = (cam.yaw ?? 0) + delta;
        if (this.R.surface) {
          // Input can arrive more than once between frames (or after a pinch/pan).
          // Pick against the current camera, not the last rendered projection.
          this.R.camera(cam.x, cam.z, cam.zoom, false, 0, cam.yaw ?? 0);
          const v = this.R.viewport, sx = v.left + v.width / 2, sy = v.top + v.height / 2,
            terrain = this.R.ground(sx, sy), flat = this.R.ground(sx, sy, false),
            dx = terrain.x - flat.x, dz = terrain.z - flat.z,
            c = Math.cos(delta), s = Math.sin(delta);
          // Rotate the viewing-axis offset, keeping the visible terrain anchor fixed.
          // Apply bounds for the new heading, not the previous terrain offset.
          cam.yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
          this.center(cam.x + dx - (c * dx + s * dz), cam.z + dz - (-s * dx + c * dz));
        } else cam.yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
      },
      armRectangleSelection(this: MeridianUI) {
        const d = this.drag;
        if (d && d.type === 'touch' && !d.moved && !this.mode && !this.controlsLocked &&
            this.view === 'game' && performance.now() - d.startedAt >= 400) d.selecting = true;
      },
      selectRectangle(this: MeridianUI, d: UIDrag) {
        const left = Math.min(d.sx, d.x), right = Math.max(d.sx, d.x),
          top = Math.min(d.sy, d.y), bottom = Math.max(d.sy, d.y);
        const units = this.game.alive(e => e.hp > 0 && e.team === this.localTeam && e.kind === 'unit')
          .filter(e => {
            const p = this.R.project(e.x, (isFlyingUnitType(e.type) ? 4.4 : 1) +
              (this.game.world?.surface?.entityHeight(e) ?? 0), e.z);
            return p && this.R.containsPoint(p.x, p.y) &&
              p.x >= left && p.x <= right && p.y >= top && p.y <= bottom;
          });
        if (units.length) this.select(units.map(e => e.id), true);
      },
      pointerDown(this: MeridianUI, e: PointerEvent) {
        if (this.view === 'codexModel') {
          if (!this.R.containsPoint(e.clientX, e.clientY) ||
              (e.pointerType !== 'touch' && e.button !== 0)) return;
          e.preventDefault();
          $('world').setPointerCapture(e.pointerId);
          if (e.pointerType === 'touch') {
            this.codexTouches.set(e.pointerId, {x:e.clientX,y:e.clientY});
            this.codexPinchDist = this.codexTouchDistance();
          }
          // Pinch takes precedence. Its remaining finger cannot accidentally rotate.
          this.codexDrag = this.codexTouches.size <= 1
            ? {pointerId:e.pointerId,x:e.clientX} : undefined;
          if (!this.codexDrag) this.codexManualRotation = false;
          return;
        }
        if (this.view !== 'game' || this.controlsLocked || !this.R.containsPoint(e.clientX, e.clientY)) return;
        e.preventDefault();
        if (e.pointerType === 'mouse' && ![0, 1, 2].includes(e.button)) return;
        this.pointer = { x: e.clientX, y: e.clientY, inside: true };
        $('world').setPointerCapture(e.pointerId);
        if (e.pointerType === 'touch') {
          this.touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
          this.battleTouchBaseline();
          if (this.touchPoints.size >= 2 || this.touchGesture) {
            this.touchGesture = true;
            this.drag = null;
            return;
          }
        }
        this.drag = {
          sx: e.clientX,
          sy: e.clientY,
          x: e.clientX,
          y: e.clientY,
          button: e.button,
          type: e.pointerType,
          moved: false,
          pointerId: e.pointerId,
          startedAt: performance.now(),
          selecting: e.pointerType === 'mouse' && e.button === 0 && !this.mode
        };
      },
      pointerMove(this: MeridianUI, e: PointerEvent) {
        if (this.view === 'codexModel') {
          const drag = this.codexDrag;
          if (drag?.pointerId === e.pointerId) {
            e.preventDefault();
            const dx = e.clientX - drag.x;
            if (dx !== 0) {
              this.codexRotation += dx * .01;
              this.codexManualRotation = true;
            }
            drag.x = e.clientX;
          }
          if (this.codexTouches.has(e.pointerId)) {
            e.preventDefault();
            this.codexTouches.set(e.pointerId, {x:e.clientX,y:e.clientY});
            const distance = this.codexTouchDistance();
            if (distance !== undefined && this.codexPinchDist && this.codexPinchDist > 0)
              this.codexZoom = clamp(this.codexZoom * this.codexPinchDist / Math.max(10, distance), .3, 2);
            this.codexPinchDist = distance;
          }
          return;
        }
        this.pointer = { x: e.clientX, y: e.clientY,
          inside: e.target === $('world') && this.R.containsPoint(e.clientX, e.clientY) };
        if (this.view !== 'game' || this.controlsLocked) return;
        if (e.pointerType === 'touch' && this.touchPoints.has(e.pointerId)) {
          this.touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (this.touchPoints.size === 2) {
            let a = [...this.touchPoints.values()],
              d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
            if (this.pinchDist && this.pinchDist > 0)
              this.zoomCamera((this.game.s!.cam.zoom * this.pinchDist) / Math.max(10, d));
            const angle = d >= 10 ? Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x) : undefined;
            if (angle !== undefined && this.touchAngle !== undefined) {
              // Shortest signed arc also handles crossing the ±π seam.
              const delta = angle - this.touchAngle;
              this.rotateCamera(Math.atan2(Math.sin(delta), Math.cos(delta)));
            }
            this.pinchDist = d;
            this.touchAngle = angle;
            return;
          }
          // Extra fingers and the last surviving finger must not resume a stale drag.
          if (this.touchGesture) return;
        }
        if (this.drag) {
          let drag = this.drag;
          if (drag.pointerId !== e.pointerId) return;
          this.armRectangleSelection();
          if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
          // The camera stays fixed for the whole rectangle gesture.
          if (!drag.selecting && drag.moved && drag.type === 'mouse' && drag.button === 1) {
            this.rotateCamera((e.clientX - drag.x) * .01);
          } else if (!drag.selecting && drag.moved && (drag.type === 'touch' || (drag.type === 'mouse' && (drag.button === 0 || drag.button === 2)))) {
            let a = this.R.ground(drag.x, drag.y, false),
              b = this.R.ground(e.clientX, e.clientY, false);
            this.center(this.game.s!.cam.x + a.x - b.x, this.game.s!.cam.z + a.z - b.z);
          }
          drag.x = e.clientX;
          drag.y = e.clientY;
        } else {
          this.hover = this.pick(e.clientX, e.clientY)?.id || null;
          if (!this.mode) {
            let t = this.game.get(this.hover);
            $('world').style.cursor = t ? (t.team !== -1 && t.team !== this.localTeam ? 'crosshair' : 'pointer') : 'default';
          }
        }
      },
      pointerUp(this: MeridianUI, e: PointerEvent) {
        if (this.view === 'codexModel') {
          this.codexTouches.delete(e.pointerId);
          this.codexPinchDist = this.codexTouchDistance();
          if (this.codexDrag?.pointerId === e.pointerId) {
            this.codexDrag = undefined;
            this.codexManualRotation = false;
          }
          return;
        }
        if (this.drag && this.drag.pointerId !== e.pointerId) return;
        let previousClick = this.lastClick;
        this.lastClick = {};
        if (e.pointerType === 'touch') {
          this.touchPoints.delete(e.pointerId);
          this.battleTouchBaseline();
        }
        if (this.touchGesture) {
          if (!this.touchPoints.size) {
            this.touchGesture = false;
            this.drag = null;
          }
          return;
        }
        if (this.view !== 'game' || this.controlsLocked) {
          this.drag = null;
          return;
        }
        this.armRectangleSelection();
        let d = this.drag;
        this.drag = null;
        if (!d || !this.R.containsPoint(e.clientX, e.clientY)) return;
        // Pointer capture can deliver releases over the fullscreen HUD to the world canvas.
        if (document.elementFromPoint?.(e.clientX, e.clientY)?.closest('#hud')) return;
        if (d.selecting && (d.type === 'touch' || d.moved ||
            Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6)) {
          d.x = e.clientX; d.y = e.clientY;
          if (Math.hypot(d.x - d.sx, d.y - d.sy) > 6) this.selectRectangle(d);
          return;
        }
        if (d.moved) return;
        let p = this.targetPosition(e.clientX, e.clientY),
          target = this.pick(e.clientX, e.clientY);
        const limit = this.game.world!.extent - 4;
        p.x = clamp(p.x, -limit, limit);
        p.z = clamp(p.z, -limit, limit);
        if (d.button === 1) return;
        if (d.button === 2) {
          if (this.selectedBuilding()) this.select([]);
          else this.issueOrder(
            this.selected,
            target
              ? { type: 'smart', id: target.id, x: target.x, z: target.z }
              : { type: 'move', ...p }
          );
          this.clearMode();
          return;
        }
        if (this.mode) {
          if (!d.moved) this.applyTarget(p);
          return;
        }
        if (target && (this.game.canSupplyForum(target, this.localTeam) || this.game.workerTask(target, this.localTeam)) && this.selected.some(id => {
          const worker = this.game.get(id);
          return worker?.team === this.localTeam && worker.kind === 'unit' && worker.type === 'worker' && id !== target.id;
        })) {
          this.issueOrder(this.selected, { type: 'smart', id: target.id, x: target.x, z: target.z });
          return;
        }
        if (this.selectedBuilding() && (!target || target.team !== this.localTeam)) {
          this.select([]);
          return;
        }
        if (d.type === 'touch' && this.selected.length && (!target || target.team !== this.localTeam)) {
          this.issueOrder(
            this.selected,
            target ? { type: 'smart', id: target.id, x: target.x, z: target.z }
              : { type: 'move', ...p }
          );
          return;
        }
        if (target) {
          let now = performance.now(),
            count = previousClick.id === target.id && previousClick.type === d.type &&
              now - previousClick.time! < 330 ? Math.min(2, previousClick.count! + 1) : 1;
          if (count >= 2 && target.team === this.localTeam && target.kind === 'unit') {
            let units = this.game
              .alive(e => e.team === this.localTeam && e.kind === 'unit' && e.type === target.type)
              .filter(e => {
                let q = this.R.project(e.x, (isFlyingUnitType(e.type) ? 4.4 : 1) + (this.game.world?.surface?.entityHeight(e) ?? 0), e.z);
                return q && this.R.containsPoint(q.x, q.y);
              });
            this.select(units.map(e => e.id));
          } else this.select([target.id]);
          this.lastClick = { id: target.id, time: now, type: d.type, count };
        } else this.select([]);
      },
      applyTarget(this: MeridianUI, p: Position) {
        if (!this.mode) return;
        let m = this.mode,
          success = true;
        if (m.kind === 'build') success = this.submitAction({ kind: 'build', building: m.arg, position: p, selected: this.selected });
        else if (m.kind === 'ability') success = this.submitAction({ kind: 'ability', ability: m.arg, position: p });
        else if (m.kind === 'rally') success = this.submitAction({ kind: 'rally', ids: this.selected, position: p });
        if (success) this.clearMode();
        this.updateHUD();
      }
    };
    type UIInputMethods = typeof uiInputMethods;
    interface MeridianUI extends UIInputMethods {}
    defineMeridianUIMethods(uiInputMethods);
