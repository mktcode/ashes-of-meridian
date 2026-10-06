    /* MeridianUI minimap and battlefield overlay drawing. Loaded after ui/core.js. */
    'use strict';
    const uiPresentationMethods = {
      beginTutorialRecon(this: MeridianUI) {
        const s = this.game.s;
        if (!s) return false;
        const home = this.game.alive(e => e.team === this.localTeam && e.type === 'hq' && e.progress >= 1)[0],
          enemy = this.game.alive(e => e.team !== -1 && e.team !== this.localTeam && e.type === 'hq')[0] ||
            this.game.alive(e => e.team !== -1 && e.team !== this.localTeam && e.type === 'worker')[0];
        if (!home || !enemy) return false;
        const point = (e: Entity) => this.terrainCameraPoint({ x: e.x + 4, z: e.z - 2 },
          this.game.world!.surface?.entityHeight(e) ?? 0);
        this.battleIntro = { kind: 'recon', elapsed: 0, hold: 4, travel: 2.5,
          origin: { x: s.cam.x, z: s.cam.z }, home: point(home), focus: point(enemy),
          mission: 'hq-elimination', visibleEntityIds: new Set([enemy.id]), objectiveShown: false };
        this.drag = null;
        this.touchPoints.clear();
        this.touchGesture = false;
        this.pinchDist = undefined;
        this.touchAngle = undefined;
        this.selected = [];
        this.clearMode();
        return true;
      },
      advanceBattleIntro(this: MeridianUI, dt: number) {
        const intro = this.battleIntro, s = this.game.s;
        if (!intro || !s || this.view !== 'game' || s.result || (intro.kind === 'recon' && this.paused)) return;
        intro.elapsed += Math.max(0, Number.isFinite(dt) ? dt : 0);
        if (intro.kind === 'recon') {
          const travel = intro.travel, t = intro.elapsed;
          if (!intro.objectiveShown && t >= 2.5) {
            intro.objectiveShown = true;
            this.radioLine('tutorial.warning');
            this.radioUntil = Infinity;
          }
          const segment = t < 1.25 ? [intro.origin!, intro.home, t / 1.25] as const
            : t < 2.5 + travel ? [intro.home, intro.focus, (t - 2.5) / travel] as const
              : [intro.focus, intro.home, (t - 2.5 - travel - intro.hold) / travel] as const;
          const p = clamp(segment[2], 0, 1), eased = p * p * (3 - 2 * p);
          s.cam.x = segment[0].x + (segment[1].x - segment[0].x) * eased;
          s.cam.z = segment[0].z + (segment[1].z - segment[0].z) * eased;
          // The enemy may still be constructing its first HQ when our flight begins.
          for (const e of this.game.alive(e => e.team !== -1 && e.team !== this.localTeam &&
            e.type === 'hq' && distance(e, intro.focus) < 35)) intro.visibleEntityIds.add(e.id);
          if (t < 2.5 + travel * 2 + intro.hold) return;
          this.battleIntro = null;
          this.finishTutorialRecon();
          this.updateHUD();
          return;
        }
      },
      introObserves(this: MeridianUI, e: Entity) {
        return !!this.battleIntro?.visibleEntityIds.has(e.id);
      },
      tick(this: MeridianUI, dt: number) {
        this.notifyStorageFailure();
        this.advanceTutorialArrival(dt);
        this.advanceBattleIntro(dt);
        let now = performance.now();
        if (this.view !== 'game' || this.controlsLocked || this.game.s?.result) this.drag = null;
        else this.armRectangleSelection();
        this.updateTutorialSpeedHint(now);
        if (this.toastUntil && now > this.toastUntil) {
          $('toast').classList.remove('show');
          this.toastUntil = 0;
        }
        if (this.radioUntil && now > this.radioUntil &&
          (!this.radioVoiceId || !this.audio.isVoiceActive?.(this.radioVoiceId))) {
          $('radio').classList.add('hidden');
          this.radioUntil = 0;
          this.radioVoiceId = null;
        }
        for (let p of this.pings) p.life -= dt;
        this.pings = this.pings.filter(p => p.life > 0);
        if (this.view !== 'game' || !this.game.s || this.game.s.result) return;
        if (!this.domPressed) this.updateQueues();
        this.hudClock += dt;
        if (this.hudClock > 0.25) {
          this.hudClock = 0;
          this.refreshCivilizationScore();
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
        const d = this.drag;
        if (d?.selecting && !this.controlsLocked && !this.mode) {
          ctx.save();
          ctx.strokeStyle = '#91daca';
          ctx.fillStyle = '#91daca22';
          ctx.lineWidth = 2;
          if (d.moved) {
            const x = Math.min(d.sx, d.x), y = Math.min(d.sy, d.y),
              width = Math.abs(d.x - d.sx), height = Math.abs(d.y - d.sy);
            ctx.fillRect(x, y, width, height);
            ctx.strokeRect(x, y, width, height);
          } else if (d.type === 'touch') {
            // Visible outside the fingertip once the long press is armed.
            ctx.beginPath();
            ctx.arc(d.sx, d.sy, 24, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }
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
            let target = e.order?.type === 'attack' ? g.get(e.order.id) : null;
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
        const forumCounts = new Map<number, number>();
        for (const e of s.entities) if (e.hp > 0 && e.kind === 'building' && e.forumId !== undefined)
          forumCounts.set(e.forumId, (forumCounts.get(e.forumId) || 0) + 1);
        for (let e of s.entities) {
          if (e.hp <= 0) continue;
          let selected = selectedIds.has(e.id),
            hover = this.hover === e.id;
          if (!g.visible(e)) continue;
          let damaged = e.hp < e.maxHp * 0.97;
          if (
            !selected &&
            !hover &&
            !(this.profile.settings.healthbars && e.kind === 'unit') &&
            !(e.type === 'meridianforum' && e.team === this.localTeam) && !damaged
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
          let w = e.type === 'meridianforum' && e.team === this.localTeam ? 96 : e.kind === 'building' ? 56 : e.type === 'hero' || e.type === 'destroyer' ? 42 : 30;
          ctx.fillStyle = e.team !== -1 && e.team !== this.localTeam ? '#ff9693' : '#6beddf';
          ctx.fillRect(p.x - w / 2 - 2, p.y - 2, w + 4, e.maxShield ? 10 : 7);
          ctx.fillStyle = '#344350';
          ctx.fillRect(p.x - w / 2, p.y, w, 3);
          ctx.fillStyle = e.team !== -1 && e.team !== this.localTeam ? '#e8a291' : e.hp / e.maxHp < 0.3 ? '#f0b178' : '#91daca';
          ctx.fillRect(p.x - w / 2, p.y, w * clamp(e.hp / e.maxHp, 0, 1), 3);
          if (e.maxShield) {
            ctx.fillStyle = '#b5adf0';
            ctx.fillRect(p.x - w / 2, p.y + 4, w * clamp(e.shield / e.maxShield, 0, 1), 2);
          }
          if (e.progress < 1 && e.kind === 'building') {
            ctx.fillStyle = '#344350';
            ctx.fillRect(p.x - w / 2, p.y + 10, w, 2);
            ctx.fillStyle = '#edc082';
            ctx.fillRect(p.x - w / 2, p.y + 10, w * e.progress, 2);
          }
          if (e.type === 'meridianforum' && e.team === this.localTeam && e.kind === 'building' && e.progress >= 1) {
            const stock = Math.floor(e.cinderStock || 0), count = forumCounts.get(e.id) || 0;
            for (const [offset, value, max, label, color] of [
              [9, stock, FORUM_SETTLEMENT.capacity, `Cinder ${stock}/${FORUM_SETTLEMENT.capacity}`, '#6beddf'],
              [24, count, FORUM_SETTLEMENT.buildings, `Buildings ${count}/${FORUM_SETTLEMENT.buildings}`, '#edb875']
            ] as const) {
              ctx.fillStyle = '#07101deb';
              ctx.fillRect(p.x - w / 2 - 2, p.y + offset, w + 4, 13);
              ctx.fillStyle = color + '80';
              ctx.fillRect(p.x - w / 2, p.y + offset + 1, w * clamp(value / max, 0, 1), 11);
              ctx.fillStyle = '#eef3ed';
              ctx.fillText(label, p.x, p.y + offset + 10);
            }
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
          ctx.font = `bold ${f.style === 'supply' ? 18 : 12}px ui-monospace,Consolas,monospace`;
          if (f.style === 'supply') {
            ctx.save();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#10202b';
            ctx.strokeText(f.text, p.x, p.y);
            ctx.restore();
          }
          ctx.fillText(f.text, p.x, p.y);
        }
        ctx.globalAlpha = 1;
      }
    };
    type UIPresentationMethods = typeof uiPresentationMethods;
    interface MeridianUI extends UIPresentationMethods {}
    defineMeridianUIMethods(uiPresentationMethods);
