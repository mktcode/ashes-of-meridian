    /* Front end, permanent upgrades, HUD, controls, field manual. */
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
        this.selected = [];
        this.tab = 'root';
        this.attackMove = false;
        this.mode = null;
        this.hover = null;
        this.pointer = { x: innerWidth / 2, y: innerHeight / 2, inside: false };
        this.drag = null;
        this.pings = [];
        this.lastClick = {};
        this.radioUntil = 0;
        this.toastUntil = 0;
        this.actionSignature = '';
        this.factionJustUnlocked = null;
        this.hudClock = 0;
        this.touchPoints = new Map();
        this.bind();
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
          this.audio.resetBattleMusic?.();
          this.audio.setMode?.('battle');
          this.factionJustUnlocked = null;
          this.resultAetherRecovered = undefined;
          this.paused = false;
          this.modalKind = '';
          this.sellBuildingId = null;
          this.lastClick = {};
          $('menu').classList.add('hidden');
          $('modal').classList.add('hidden');
          $('hud').classList.remove('hidden');
          $('worldViewport').classList.add('in-battle');
          if (this.onViewportChange) this.onViewportChange();
          $('radio').classList.add('hidden');
          $('alerts').innerHTML = '';
          this.selected = [];
          this.attackMove = false;
          $('attackMoveBtn').setAttribute('aria-pressed', 'false');
          this.mode = null;
          this.tab = 'root';
          this.actionSignature = '';
          this.updateHUD();
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
        } else if (type === 'result') {
          let changed = false,
            faction = this.game.s?.faction,
            unlockLevel = this.profile.factionUnlockLevel;
          this.factionJustUnlocked = null;
          if (data.win && faction === unlockLevel && faction + 1 < FACTIONS.length) {
            this.factionJustUnlocked = faction + 1;
            this.profile.factionUnlockLevel = this.factionJustUnlocked;
            changed = true;
          }
          if (this.resultAetherRecovered === undefined) {
            let level = Math.min(AETHER_EVACUATION_CAPS.length - 1, Math.max(0, Math.floor(this.game.s?.meta?.aetherEvacuation || 0))),
              limit = AETHER_EVACUATION_CAPS[level];
            this.resultAetherRecovered = Math.min(limit, Math.max(0, Math.floor(this.game.s?.gas || 0)));
            if (this.resultAetherRecovered) {
              this.profile.aether = Math.min(999999, this.profile.aether + this.resultAetherRecovered);
              changed = true;
            }
          }
          if (changed) this.persist();
          this.audio.setMode?.('silent');
          this.audio.sound(data.win ? 'victory' : 'defeat');
          this.showResult(data);
        } else if (type === 'shot') {
          let p = this.R.project(data.x, 1, data.z);
          if (p && this.R.containsPoint(p.x, p.y))
            this.audio.sound('shot', data.heavy);
        } else if (type === 'explosion') {
          let p = this.R.project(data.x, 1, data.z);
          const v = this.R.viewport;
          if (p && p.x > v.left - 100 && p.x < v.right + 100 && p.y > v.top - 100 && p.y < v.bottom)
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
    }
    function defineMeridianUIMethods(methods) {
      for (const [name, method] of Object.entries(methods))
        Object.defineProperty(MeridianUI.prototype, name, {
          value: method,
          configurable: true,
          writable: true
        });
    }
