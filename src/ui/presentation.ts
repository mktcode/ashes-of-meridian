    /* MeridianUI minimap and battlefield overlay drawing. Loaded after ui/core.js. */
    'use strict';
    const uiPresentationMethods = {
      tick(this: MeridianUI, dt: number) {
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
          let fog = g.world.visible[i] ? 1 : g.world.explored[i] ? 0.48 : 0.16;
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
            ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
            continue;
          }
          if (e.team === 1 && !visible) continue;
          let p = map(e);
          ctx.fillStyle = e.team === 0 ? '#79dbcc' : '#eb8e80';
          if (e.type === 'hero') ctx.fillStyle = '#ffd494';
          if (e.kind === 'building') {
            let size = Math.max(3, (e.size * w) / span);
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
              ((e.order?.type === 'move' || e.order?.type === 'attackMove')
                ? e.order
                : e.order?.type === 'attack'
                  ? g.get(e.order.id)
                  : null);
            if (!goal) continue;
            let a = this.R.project(e.x, 0.2, e.z),
              b = this.R.project(goal.x, 0.2, goal.z);
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
          if (!p || !this.R.containsPoint(p.x, p.y)) continue;
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
    };
    type UIPresentationMethods = typeof uiPresentationMethods;
    interface MeridianUI extends UIPresentationMethods {}
    defineMeridianUIMethods(uiPresentationMethods);
