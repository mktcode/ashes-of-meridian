    /* MeridianUI minimap and battlefield overlay drawing. Loaded after ui/core.js. */
    'use strict';
    const BATTLE_INTRO_BY_STAGE: Partial<Record<number, { hold: number; travel: number }>> = {
      1: { hold: 5, travel: 1.25 }
    };
    const BATTLE_INTRO_OBJECTIVE_DELAY = 1;
    const uiPresentationMethods = {
      beginBattleIntro(this: MeridianUI) {
        this.battleIntro = null;
        const s = this.game.s;
        if (!s || s.rules?.kind !== 'single-player') return false;
        const mission = s.rules.mission, salvage = mission.id === 'echo-salvage',
          timing = salvage ? (this.profile.salvageIntroComplete ? undefined : { hold: 10, travel: 1.5 })
            : (this.shouldBeginBattleTutorial() ? BATTLE_INTRO_BY_STAGE[s.depth + 1] : undefined);
        if (!timing) return false;
        const home = this.game.alive(e => e.team === this.localTeam && e.kind === 'building' && e.type === 'hq')[0],
          enemy = !salvage && this.game.alive(e => e.team !== -1 && e.team !== this.localTeam && e.kind === 'building' && e.type === 'hq')[0];
        if (!home || (!salvage && !enemy)) return false;
        const limit = this.game.world!.extent - 18,
          cameraPoint = (e: Position) => ({ x: clamp(e.x + 4, -limit, limit), z: clamp(e.z - 2, -limit, limit) }),
          focus = mission.id === 'echo-salvage' ? { x: mission.site.x, z: mission.site.z } : cameraPoint(enemy as Entity),
          homeCamera = cameraPoint(home);
        this.battleIntro = {
          elapsed: 0,
          hold: timing.hold,
          travel: timing.travel,
          focus,
          mission: mission.id,
          home: homeCamera,
          visibleEntityIds: new Set(enemy ? [enemy.id] : []),
          objectiveShown: false
        };
        s.cam.x = focus.x;
        s.cam.z = focus.z;
        this.paused = true;
        return true;
      },
      advanceBattleIntro(this: MeridianUI, dt: number) {
        const intro = this.battleIntro, s = this.game.s;
        if (!intro || !s) return;
        intro.elapsed += Math.max(0, Number.isFinite(dt) ? dt : 0);
        if (!intro.objectiveShown && intro.elapsed >= BATTLE_INTRO_OBJECTIVE_DELAY) {
          intro.objectiveShown = true;
          if (s.rules.kind === 'single-player') this.radio(MISSIONS[s.rules.mission.id].intro);
        }
        const progress = clamp((intro.elapsed - intro.hold) / intro.travel, 0, 1),
          eased = progress * progress * (3 - 2 * progress);
        s.cam.x = intro.focus.x + (intro.home.x - intro.focus.x) * eased;
        s.cam.z = intro.focus.z + (intro.home.z - intro.focus.z) * eased;
        if (intro.elapsed < intro.hold + intro.travel) return;
        const pendingRadio = intro.pendingRadio;
        if (intro.mission === 'echo-salvage') {
          this.profile.salvageIntroComplete = true;
          this.persist();
        }
        this.battleIntro = null;
        this.paused = false;
        this.beginBattleTutorial();
        this.updateHUD();
        this.audio.setMode?.('battle');
        if (pendingRadio) this.radio(pendingRadio);
      },
      introObserves(this: MeridianUI, e: Entity) {
        return !!this.battleIntro?.visibleEntityIds.has(e.id);
      },
      salvageMission(this: MeridianUI): SalvageMissionState | null {
        const rules = this.game.s?.rules;
        return rules?.kind === 'single-player' && rules.mission.id === 'echo-salvage' ? rules.mission : null;
      },
      updateMissionHUD(this: MeridianUI) {
        const mission = this.salvageMission(), el = $('missionObjective');
        el.classList.toggle('hidden', !mission);
        if (!mission) return;
        const label = (team: number) => team === this.localTeam ? 'YOU' : `OPP ${team}`,
          cargo=this.game.alive(e=>e.team===this.localTeam && e.kind==='unit')
            .reduce((n,e)=>n+((e as UnitEntity).salvageCarry || 0),0);
        el.textContent = `ECHO SALVAGE · FIRST TO ${SALVAGE_RULES.goal}\n${mission.delivered.map((n, team) => `${label(team)}: ${Math.floor(n)}`).join(' · ')}\nYOUR CARGO: ${Math.floor(cargo)} · DELIVER TO HQ`;
        el.title = `${MISSIONS[mission.id].objective} Tap to center on the core.`;
        el.setAttribute('aria-label', `${el.textContent}. Tap to center on the core.`);
      },
      drawMissionZone(this: MeridianUI, ctx: CanvasRenderingContext2D) {
        const mission = this.salvageMission();
        if (!mission) return;
        const { x, z, radius } = mission.site;
        ctx.save();
        ctx.strokeStyle = '#79dbcc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        let connected = false;
        for (let i = 0; i <= 64; i++) {
          const angle = i * Math.PI / 32, px = x + Math.cos(angle) * radius, pz = z + Math.sin(angle) * radius,
            p = this.R.project(px, .25 + (this.game.world?.surface?.heightAt(px, pz) ?? 0), pz);
          if (!p) { connected = false; continue; }
          if (connected) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
          connected = true;
        }
        ctx.stroke();
        // Extraction is presentation-only: no effect RNG, no new vision or invisible enemy jobs.
        const workers=this.game.alive(e=>e.kind==='unit' && e.type==='worker' && this.game.observed(e)) as UnitEntity[];
        for(const worker of workers) {
          if(worker.order.type!=='salvage' || worker.returning || !worker.salvagePoint ||
            distance(worker,worker.salvagePoint)>.8 || (worker.salvageCarry || 0)>=SALVAGE_RULES.load) continue;
          const d=distance(worker,mission.site),a=this.R.project(worker.x,1.4+(this.game.world?.surface?.heightAt(worker.x,worker.z) ?? 0),worker.z),
            b=this.R.project(x+(worker.x-x)*14.5/d,4.5,z+(worker.z-z)*14.5/d);
          if(!a || !b) continue;
          ctx.strokeStyle='#a4e9ed';ctx.lineWidth=1.3;
          ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
        }
        ctx.restore();
      },
      tick(this: MeridianUI, dt: number) {
        this.advanceBattleIntro(dt);
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
        if (!this.domPressed) this.updateQueues();
        this.hudClock += dt;
        if (this.hudClock > 0.25) {
          this.hudClock = 0;
          if (!this.domPressed) this.updateHUD();
          this.drawMinimap();
        }
      },
      drawMinimap(this: MeridianUI) {
        let g = this.game;
        if (!g.s || !g.world) return;
        let c = $('minimap'),
          ctx = c.getContext('2d')!,
          w = c.width,
          h = c.height;
        const { extent, gridSize: GRID } = g.world, span = extent * 2;
        if (!this.miniBuffer || this.miniBuffer.width !== GRID) {
          this.miniBuffer ||= document.createElement('canvas');
          this.miniBuffer.width = this.miniBuffer.height = GRID;
          this.miniCtx = this.miniBuffer.getContext('2d')!;
          this.miniImage = this.miniCtx.createImageData(GRID, GRID);
        }
        let img = this.miniImage!.data,
          base = g.world.terrainColors;
        for (let i = 0; i < GRID * GRID; i++) {
          // Keep the tactical terrain legible; entity visibility still follows the world fog below.
          let fog = g.world.visible[i] ? 1 : g.world.explored[i] ? 0.65 : 0.30;
          if (g.world.terrainFeatureGrid[i]) fog *= .48;
          img[i * 4] = base[i * 4] * fog;
          img[i * 4 + 1] = base[i * 4 + 1] * fog;
          img[i * 4 + 2] = base[i * 4 + 2] * fog;
          img[i * 4 + 3] = 255;
        }
        this.miniCtx!.putImageData(this.miniImage!, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.miniBuffer, 0, 0, w, h);
        let map = (p: Position) => ({ x: ((p.x + extent) / span) * w, y: ((p.z + extent) / span) * h });
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
          e = this.multiplayer?.displayEntity(e) ?? e;
          if (e.hp <= 0) continue;
          let explored = g.world.explored[g.world.idx(e.x, e.z)],
            visible = g.visible(e);
          if (e.kind === 'resource') {
            if (!explored) continue;
            let p = map(e);
            ctx.fillStyle = e.type === 'gas' ? '#9ed3c1' : '#c0a880';
            ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
            continue;
          }
          if (e.team !== this.localTeam && !visible) continue;
          let p = map(e);
          ctx.fillStyle = e.team === this.localTeam ? '#79dbcc' : '#eb8e80';
          if (e.type === 'hero') ctx.fillStyle = '#ffd494';
          if (e.kind === 'building') {
            let size = Math.max(5, (e.size * w) / span);
            ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);

          } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, e.type === 'hero' ? 3 : 2, 0, 6.28);
            ctx.fill();
          }
        }
        const mission = this.salvageMission();
        if (mission) {
          const p = map(mission.site);
          ctx.strokeStyle = '#79dbcc';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(p.x, p.y, mission.site.radius * w / span, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.strokeStyle = '#e3ffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const v = this.R.viewport!;
        for (let [i, p] of [
          { x: v.left, y: v.top },
          { x: v.right, y: v.top },
          { x: v.right, y: v.bottom },
          { x: v.left, y: v.bottom }
        ].entries()) {
          let q = map(this.R.ground(p.x, p.y));
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
      },
      drawOverlay(this: MeridianUI, ctx: CanvasRenderingContext2D) {
        const v = this.R.viewport!;
        ctx.clearRect(v.left, v.top, v.width, v.height);
        if (this.view !== 'game' || !this.game.s) return;
        let g = this.game,
          s = g.s!;
        this.drawMissionZone(ctx);
        const selectedIds = this.selectionIds();
        ctx.font = '10px ui-monospace,Consolas,monospace';
        ctx.textAlign = 'center';
        if (this.selected.length && this.mode?.kind !== 'build') {
          ctx.save();
          ctx.setLineDash([4, 6]);
          ctx.lineWidth = 1;
          for (let id of this.selected.slice(0, 12)) {
            let e = g.get(id);
            if (!e || e.team !== this.localTeam) continue;
            e = this.multiplayer?.displayEntity(e) ?? e;
            let target = e.order?.type === 'attack' ? g.get(e.order.id) : null;
            if (target) target = this.multiplayer?.displayEntity(target) ?? target;
            let goal = e.rally ||
              ((e.order?.type === 'move' || e.order?.type === 'attackMove') ? e.order : target);
            if (!goal || (goal === target && !g.visible(target!))) continue;
            let a = this.R.project(e.x, .2 + (g.world?.surface?.heightAt(e.x,e.z) ?? 0), e.z),
              b = this.R.project(goal.x, .2 + (g.world?.surface?.heightAt(goal.x,goal.z) ?? 0), goal.z);
            if (a && b) {
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              if (e.rally) {
                ctx.lineWidth = 4;
                ctx.strokeStyle = '#07101dcc';
                ctx.stroke();
              }
              ctx.lineWidth = e.rally ? 2 : 1;
              ctx.strokeStyle = e.rally ? '#9fe9d6' : e.order?.type === 'attack' ? '#e9b47b5c' : '#8dddd955';
              ctx.stroke();
            }
          }
          ctx.restore();
        }
        for (let e of s.entities) {
          e = this.multiplayer?.displayEntity(e) ?? e;
          if (e.hp <= 0) continue;
          let selected = selectedIds.has(e.id),
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
              isFlyingUnitType(e.type)
                ? 6.1
                : e.kind === 'building'
                    ? Math.min(8, e.size + 2.5)
                    : 3.0,
            p = this.R.project(e.x, y + (g.world?.surface?.entityHeight(e) ?? 0), e.z);
          if (!p || !this.R.containsPoint(p.x, p.y)) continue;
          let w = e.kind === 'building' ? 56 : e.type === 'hero' || e.type === 'destroyer' ? 42 : 30;
          ctx.fillStyle = '#07101deb';
          ctx.fillRect(p.x - w / 2 - 2, p.y - 2, w + 4, e.maxShield ? 10 : 7);
          ctx.fillStyle = '#344350';
          ctx.fillRect(p.x - w / 2, p.y, w, 3);
          ctx.fillStyle = e.team !== -1 && e.team !== this.localTeam ? '#e8a291' : e.hp / e.maxHp < 0.3 ? '#f0b178' : '#91daca';
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
                    ? 'ECHO VENT'
                    : 'CINDER CRYSTALS'
                  : unitName(e.type, e.faction));
            ctx.font = '10px ui-monospace,Consolas,monospace';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#091421';
            ctx.strokeText(name.toUpperCase(), p.x, p.y - 8);
            ctx.fillStyle = e.team !== -1 && e.team !== this.localTeam ? '#efc8b5' : '#d9e9df';
            ctx.fillText(name.toUpperCase(), p.x, p.y - 8);
          }
          if (e.kills >= 5) {
            ctx.fillStyle = '#f5ce95';
            ctx.fillText('★', p.x + w / 2 + 8, p.y + 5);
          }
        }
        for (let f of g.effects.floats) {
          let p = this.R.project(f.x, f.y, f.z);
          if (!p || p.x < v.left - 40 || p.x > v.right + 40 || p.y < v.top - 20 || p.y > v.bottom + 20) continue;
          ctx.globalAlpha = f.life / f.maxLife;
          ctx.fillStyle = f.color;
          ctx.font = 'bold 12px ui-monospace,Consolas,monospace';
          ctx.fillText(f.text, p.x, p.y);
        }
        ctx.globalAlpha = 1;
      }
    };
    type UIPresentationMethods = typeof uiPresentationMethods;
    interface MeridianUI extends UIPresentationMethods {}
    defineMeridianUIMethods(uiPresentationMethods);
