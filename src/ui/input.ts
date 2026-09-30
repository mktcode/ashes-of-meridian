    /* MeridianUI DOM, pointer and targeting input. Loaded after ui/core.js. */
    'use strict';
    const uiInputMethods = {
      bind(this: MeridianUI) {
        document.addEventListener('pointerdown', e => {
          this.audio.unlock();
          this.domPressed = !!(e.target as Element | null)?.closest('button,select,input');
        });
        document.addEventListener('pointerup', () => (this.domPressed = false));
        document.addEventListener('pointercancel', () => (this.domPressed = false));
        document.addEventListener('click', e => {
          let b = (e.target as Element | null)?.closest('button');
          if (!b || b.disabled) return;
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
          if (b.dataset.upgrade) {
            this.buyUpgrade(b.dataset.upgrade);
            return;
          }
          if (b.dataset.benefit) {
            if (this.game.s?.result && !$('result').classList.contains('hidden')) {
              this.resultBenefit = b.dataset.benefit;
              document.querySelectorAll<HTMLElement>('#result [data-benefit]').forEach(option => {
                const active = option.dataset.benefit === this.resultBenefit;
                option.classList.toggle('active', active);
                option.setAttribute('aria-pressed', String(active));
              });
            } else this.chooseBenefit(b.dataset.benefit);
            return;
          }
          if (b.dataset.action) {
            if (!this.paused) this.perform(b.dataset.action);
            return;
          }
          if (hasContentKey(UNITS, b.dataset.queueType) && !this.paused && !this.game.s?.result) {
            this.cancelRecruitment(b.dataset.queueType);
            this.updateHUD();
            return;
          }
          if (b.dataset.cam) {
            if (this.battleIntro) return;
            if (b.dataset.cam === 'home') this.homeCamera();
            else if (b.dataset.cam === 'objective') {
              const rules = this.game.s?.rules;
              if (rules?.kind === 'single-player' && rules.mission.id === 'echo-salvage')
                this.center(rules.mission.site.x, rules.mission.site.z);
            } else if (this.game.s)
              this.game.s!.cam.zoom = clamp(
                this.game.s!.cam.zoom * (b.dataset.cam === 'in' ? 0.85 : 1.18),
                27.2,
                115
              );
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
          if (this.game.networkTeam != null) return;
          if (this.view !== 'game' || this.paused || !this.game.s || this.game.s!.result) return;
          const speeds = [1, 1.5, 2, 0.75];
          this.game.s!.speed = speeds[(speeds.indexOf(this.game.s!.speed) + 1) % speeds.length];
          this.lastClick = {};
          this.updateHUD();
        };
        $('attackMoveBtn').onclick = () => {
          if (this.view !== 'game' || this.paused || !this.game.s || this.game.s!.result) return;
          this.attackMove = !this.attackMove;
          $('attackMoveBtn').setAttribute('aria-pressed', String(this.attackMove));
          this.lastClick = {};
          this.toast(this.attackMove
            ? 'Attack-move: troops engage enemies along the way.'
            : 'Move: troops prioritize reaching the destination.');
        };
        $('visibleCombatSelectBtn').onclick = () => {
          if (this.view !== 'game' || this.paused || !this.game.s || this.game.s!.result) return;
          this.select(this.game.alive(e => e.team === this.localTeam && e.kind === 'unit' && e.type !== 'worker')
            .filter(e => {
              const pose = this.multiplayer?.displayEntity(e) ?? e;
              const y = (isFlyingUnitType(pose.type) ? 4.4 : 1) + (this.game.world?.surface?.entityHeight(pose) ?? 0),
                p = this.R.project(pose.x, y, pose.z);
              return p && this.R.containsPoint(p.x, p.y);
            }).map(e => e.id));
          this.lastClick = {};
        };
        $('combatSelectBtn').onclick = () => {
          if (this.view !== 'game' || this.paused || !this.game.s || this.game.s!.result) return;
          this.select(this.game.alive(e => e.team === this.localTeam && e.kind === 'unit' && e.type !== 'worker').map(e => e.id));
          this.lastClick = {};
        };
        $('radioClose').onclick = () => {
          $('radio').classList.add('hidden');
          this.radioUntil = 0;
        };
        window.addEventListener('blur', () => {
          this.resetCodexGesture();
          this.domPressed = false;
          this.drag = null;
        });
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
          if (this.view !== 'game' || this.paused || !this.game.s ||
              !this.R.containsPoint(e.clientX, e.clientY)) return;
          e.preventDefault();
          // WheelEvent delta modes are pixels, lines and pages respectively.
          const pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
          this.game.s.cam.zoom = clamp(this.game.s.cam.zoom * Math.exp(clamp(pixels, -240, 240) * .0015), 27.2, 115);
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
          if (this.paused || this.view !== 'game') return;
          e.preventDefault();
          let p = minimapPosition(e);
          if (e.button === 2) {
            if (this.selectedBuilding()) this.select([]);
            else this.issueOrder(
              this.selected,
              { type: this.attackMove ? 'attackMove' : 'move', ...p }
            );
            this.clearMode();
          } else if (this.mode) {
            if (this.mode.kind === 'build') {
              this.toast('Place foundations in the main battlefield view.');
              return;
            }
            this.applyTarget(p);
          } else {
            this.center(p.x, p.z);
            miniDrag = true;
            map.setPointerCapture(e.pointerId);
          }
        });
        map.addEventListener('pointermove', e => {
          if (!miniDrag) return;
          let p = minimapPosition(e);
          this.center(p.x, p.z);
        });
        map.addEventListener('pointerup', () => (miniDrag = false));
        map.addEventListener('pointercancel', () => (miniDrag = false));
      },
      uiAction(this: MeridianUI, action: string) {
        this.audio.sound('select');
        switch (action) {
          case 'multiplayer': this.multiplayer?.show(); break;
          case 'networkCreate': this.multiplayer?.connect('create'); break;
          case 'networkJoin': this.multiplayer?.connect('join'); break;
          case 'networkResume': this.multiplayer?.resumeStored(); break;
          case 'networkCopy': void this.multiplayer?.copyCode(); break;
          case 'home':
            this.showHome();
            break;
          case 'battle':
            this.showBattle();
            break;
          case 'startBattle':
            this.startBattle();
            break;
          case 'continueExpedition':
            this.continueExpedition();
            break;
          case 'confirmBenefit':
            if (this.resultBenefit) this.chooseBenefit(this.resultBenefit);
            break;
          case 'expeditionBenefits':
            this.showExpeditionBenefits();
            break;
          case 'abandon':
            this.persistence.clearExpedition?.();
            this.expedition = null;
            this.showHome();
            break;
          case 'armory':
            this.showArmory();
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
          case 'help':
            this.showHelp();
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
          case 'restartConfirm':
            this.openModal(
              'confirm',
              `<div class="eyebrow">REDEPLOY EXPEDITION</div><h1>Restart this operation?</h1><p>The current battle will restart from its secured expedition checkpoint. Permanent upgrades are unaffected.</p><div class="launch-row"><button class="primary" data-ui="restart">RESTART</button><button class="secondary" data-ui="backPause">CANCEL</button></div>`
            );
            break;
          case 'backPause':
            this.showPause();
            break;
          case 'restart':
            if (this.expedition) this.startExpeditionBattle();
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
          e = this.multiplayer?.displayEntity(e) ?? e;
          if (e.hp <= 0) continue;
          if (!this.game.observed(e)) continue;
          if (filter && !filter(e)) continue;
          let y =
              isFlyingUnitType(e.type) ? 4.4 : e.kind === 'building' ? 2.0 : 1,
            p = this.R.project(e.x, y + (this.game.world?.surface?.entityHeight(e) ?? 0), e.z);
          if (!p) continue;
          let edge = this.R.project(e.x + e.size, y + (this.game.world?.surface?.entityHeight(e) ?? 0), e.z),
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
      },
      resetCodexGesture(this: MeridianUI) {
        this.codexTouches.clear();
        this.codexPinchDist = undefined;
      },
      codexTouchDistance(this: MeridianUI) {
        const points = [...this.codexTouches.values()];
        return points.length === 2 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : undefined;
      },
      pointerDown(this: MeridianUI, e: PointerEvent) {
        if (this.view === 'codexModel') {
          if (e.pointerType !== 'touch' || !this.R.containsPoint(e.clientX, e.clientY)) return;
          e.preventDefault();
          $('world').setPointerCapture(e.pointerId);
          this.codexTouches.set(e.pointerId, {x:e.clientX,y:e.clientY});
          this.codexPinchDist = this.codexTouchDistance();
          return;
        }
        if (this.view !== 'game' || this.paused || !this.R.containsPoint(e.clientX, e.clientY)) return;
        e.preventDefault();
        if (e.pointerType === 'mouse' && ![0, 1, 2].includes(e.button)) return;
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
      },
      pointerMove(this: MeridianUI, e: PointerEvent) {
        if (this.view === 'codexModel') {
          if (!this.codexTouches.has(e.pointerId)) return;
          e.preventDefault();
          this.codexTouches.set(e.pointerId, {x:e.clientX,y:e.clientY});
          const distance = this.codexTouchDistance();
          if (distance !== undefined && this.codexPinchDist && this.codexPinchDist > 0)
            this.codexZoom = clamp(this.codexZoom * this.codexPinchDist / Math.max(10, distance), .3, 2);
          this.codexPinchDist = distance;
          return;
        }
        this.pointer = { x: e.clientX, y: e.clientY,
          inside: e.target === $('world') && this.R.containsPoint(e.clientX, e.clientY) };
        if (this.view !== 'game' || this.paused) return;
        if (e.pointerType === 'touch' && this.touchPoints.has(e.pointerId)) {
          this.touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (this.touchPoints.size === 2) {
            let a = [...this.touchPoints.values()],
              d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
            if (this.pinchDist && this.pinchDist > 0)
              this.game.s!.cam.zoom = clamp(
                (this.game.s!.cam.zoom * this.pinchDist) / Math.max(10, d),
                27.2,
                115
              );
            this.pinchDist = d;
            return;
          }
        }
        if (this.drag) {
          let drag = this.drag;
          if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
          if (drag.moved && (drag.type === 'touch' || (drag.type === 'mouse' && drag.button !== 2))) {
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
          return;
        }
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
        if (!d || !this.R.containsPoint(e.clientX, e.clientY)) return;
        let p = this.targetPosition(e.clientX, e.clientY),
          target = this.pick(e.clientX, e.clientY);
        const limit = this.game.world!.extent - 4;
        p.x = clamp(p.x, -limit, limit);
        p.z = clamp(p.z, -limit, limit);
        if ((d.type === 'touch' && d.moved) || d.button === 1) return;
        if (d.button === 2) {
          if (this.selectedBuilding()) this.select([]);
          else this.issueOrder(
            this.selected,
            target
              ? { type: 'smart', id: target.id, x: target.x, z: target.z }
              : { type: this.attackMove ? 'attackMove' : 'move', ...p }
          );
          this.clearMode();
          return;
        }
        if (this.mode) {
          if (!d.moved) this.applyTarget(p);
          return;
        }
        if (d.moved) return;
        const salvage=this.salvageMission();
        if(!target && salvage && distance(p,salvage.site)<=salvage.site.radius &&
          this.selected.some(id=>this.game.get(id)?.type==='worker')) {
          this.issueOrder(this.selected,{type:'move',...p});return;
        }
        if (target && this.game.workerTask(target, this.localTeam) && this.selected.some(id => {
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
              : { type: this.attackMove ? 'attackMove' : 'move', ...p }
          );
          return;
        }
        if (target) {
          let now = performance.now(),
            count = previousClick.id === target.id && previousClick.type === d.type &&
              now - previousClick.time! < 330 ? Math.min(3, previousClick.count! + 1) : 1;
          if (count >= 2 && target.team === this.localTeam && target.kind === 'unit') {
            let combat = d.type === 'touch' && count === 3,
              units = this.game
              .alive(e => e.team === this.localTeam && e.kind === 'unit' &&
                (combat ? e.type !== 'worker' : e.type === target.type))
              .filter(e => {
                const pose = this.multiplayer?.displayEntity(e) ?? e;
                let q = this.R.project(pose.x, (isFlyingUnitType(pose.type) ? 4.4 : 1) + (this.game.world?.surface?.entityHeight(pose) ?? 0), pose.z);
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
