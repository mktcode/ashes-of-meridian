    /* Application lifecycle, fixed-step clock, visual effects, and cinematic frontier. */
    'use strict';
    (() => {
      let R,
        game,
        ui,
        audio,
        overlayContext,
        preview = [];
      const canvas = document.getElementById('world'),
        overlay = document.getElementById('overlay');
      try {
        const visibleSimulation = new URLSearchParams(location.search).get('simulation') === 'ai-vs-ai',
          volatileStorage = { getItem: () => null, setItem: () => {} },
          persistence = createMeridianPersistence({
            // The explicitly launched spectator run must not read or mutate the normal profile.
            getStorage: () => visibleSimulation ? volatileStorage : localStorage,
            clamp,
            upgrades: META,
            warn: (...args) => console.warn(...args)
          });
        const profile = persistence.loadProfile();
        R = new MeridianRenderer(canvas);
        R.quality = profile.settings.quality;
        R.resize();
        audio = new MeridianAudio(profile.settings);
        const worldView = new BattlefieldView(R);
        game = new MeridianGame(profile, (type, data) => {
          if (type === 'start') {
            worldView.sync(game.world);
            if (visibleSimulation) {
              game.enableAI(0);
              const run = game.s;
              setTimeout(() => {
                if (game.s === run && !run.result) {
                  run.speed = 2;
                  ui?.updateHUD();
                }
              }, 10000);
            }
          }
          if (ui) ui.event(type, data);
        });
        ui = new MeridianUI(game, R, audio, profile, persistence);
        overlayContext = overlay.getContext('2d');
        function resize() {
          R.resize();
          let d = Math.min(devicePixelRatio || 1, 2);
          const v = R.viewport;
          overlay.width = Math.round(v.width * d);
          overlay.height = Math.round(v.height * d);
          // Overlay drawing shares the renderer's CSS client coordinates.
          overlayContext.setTransform(d, 0, 0, d, -v.left * d, -v.top * d);
          if (ui.view === 'game' && game.s) {
            const cam = game.s.cam;
            R.camera(cam.x, cam.z, cam.zoom);
            ui.drawMinimap();
          }
        }
        ui.onViewportChange = resize;
        new ResizeObserver(resize).observe(document.getElementById('worldViewport'));
        addEventListener('resize', resize);
        resize();
        ui.onPreview = () => {
          worldView.sync(new Battlefield(40517, 'biome0'), false);
          R.fogOn = false;
          preview = [];
          let id = 0;
          function e(kind, type, x, z, faction = FACTION_ID.FIRST, team = 0) {
            let d = kind === 'building' ? BUILDINGS[type] : UNITS[type] || {};
            preview.push({
              id: ++id,
              kind,
              type,
              x,
              z,
              faction,
              team,
              hp: d.hp || 100,
              maxHp: d.hp || 100,
              size: d.size || 1,
              rot: kind === 'building' ? 0 : -0.45,
              walk: 0,
              progress: 1,
              carry: 0,
              amount: 2200,
              shield: 0,
              maxShield: 0,
              kills: 0,
              order: { type: 'idle' }
            });
          }
          e('building', 'hq', 7, 1);
          e('building', 'factory', -4, 12);
          e('building', 'barracks', 21, 10);
          e('building', 'depot', 29, 1);
          e('building', 'turret', 20, -6);
          e('building', 'turret', 30, 17);
          e('unit', 'hero', 14, 21);
          e('unit', 'tank', 8, 23);
          e('unit', 'tank', -1, 26);
          e('unit', 'artillery', -13, 15);
          e('unit', 'air', 30, 6);
          for (let i = 0; i < 9; i++)
            e('unit', 'rifle', 15 + (i % 3) * 1.8, 16 + Math.floor(i / 3) * 2);
          for (let i = 0; i < 7; i++)
            e('resource', 'crystal', -19 + Math.sin(i * 2) * 4, 25 + Math.cos(i * 2) * 4);
          e('building', 'hq', -30, -48, FACTION_ID.THIRD, 1);
          e('building', 'turret', -20, -39, FACTION_ID.THIRD, 1);
        };
        ui.showHome();
        document.getElementById('loading').classList.add('hidden');
        const SIMULATION_STEP_SECONDS = 0.05;
        let last = performance.now(),
          accumulator = 0,
          time = 0,
          frames = 0,
          frameClock = 0,
          fps = 60,
          failed = false;
        const ring = (...args) => drawEffectRing(R, ...args);
        function battlefield(t) {
          const s = game.s;
          worldView.sync(game.world);
          R.camera(s.cam.x, s.cam.z, s.cam.zoom);
          R.fogOn = true;
          for (let e of s.entities) {
            if (e.hp <= 0) continue;
            let idx = game.world.idx(e.x, e.z),
              visible = game.visible(e),
              explored = game.world.explored[idx];
            if (e.team === 1 && !visible) continue;
            if (e.team === -1 && !explored) continue;
            let p = R.project(e.x, 0, e.z);
            const v = R.viewport;
            if (p && (p.x < v.left - 220 || p.x > v.right + 220 || p.y < v.top - 260 || p.y > v.bottom + 260))
              continue;
            renderEntity(R, e, t);
            let selected = ui.selected.includes(e.id),
              hover = ui.hover === e.id;
            if (selected || hover) {
              let col =
                e.team === 1
                  ? 0xf2a490
                  : e.type === 'hero'
                    ? 0xf1c181
                    : 0x94e4d1;
              ring(e.x, e.z, e.size + 0.5, col, selected ? 0.95 : 0.43, 0.12);
              if (selected && e.kind === 'building' && BUILDINGS[e.type].range)
                ring(e.x, e.z, game.rangedStats(e).range, col, 0.15, 0.12);
            }
            if (e.maxShield && e.shield > 0 && s.time - e.lastHit < 0.35)
              R.add(
                'sphere',
                e.x,
                e.type === 'air' ? 4.7 : 1.4,
                e.z,
                e.size * 1.5,
                e.size * 1.7,
                e.size * 1.5,
                0xc3b4f7,
                0,
                0,
                0,
                0.8,
                0.18,
                'effects'
              );
            if (e.kind === 'unit' && e.type === 'worker' && e.order?.type === 'build') {
              let b = game.get(e.order.id);
              if (b && b.progress < 1 && distance(e, b) < b.size + 3.5)
                ring(b.x, b.z, b.size + 1, 0xe5ba79, 0.25, 0.11, t * 0.1);
            }
          }
          renderBattlefieldEffects(R, game.effects, game.world, s, ui.pings, t);
          if (ui.mode && ui.pointer.inside && !ui.paused) {
            let p = R.ground(ui.pointer.x, ui.pointer.y);
            p.x = clamp(p.x, -86, 86);
            p.z = clamp(p.z, -86, 86);
            if (ui.mode.kind === 'build') {
              let type = ui.mode.arg,
                d = BUILDINGS[type];
              if (d) {
                let check = game.canBuild(type, p),
                  ok = !check,
                  col = ok ? 0x99e4c6 : 0xf39989;
                renderEntity(
                  R,
                  {
                    kind: 'building',
                    type,
                    x: p.x,
                    z: p.z,
                    rot: 0,
                    faction: s.faction,
                    team: 0,
                    hp: 1,
                    maxHp: 1,
                    progress: 1,
                    size: d.size,
                    queue: []
                  },
                  t,
                  { tint: col, alpha: 0.3, layer: 'effects' }
                );
                ring(p.x, p.z, d.size + 0.6, col, 0.9);
              }
            } else if (ui.mode.kind === 'ability') {
              let kind = ui.mode.arg,
                rad =
                  kind === 'scan'
                    ? 32
                    : kind === 'orbital'
                      ? s.faction === FACTION_ID.THIRD
                        ? 8
                        : 10
                      : kind === 'repair'
                        ? 12
                        : 4;
              ring(p.x, p.z, rad, kind === 'orbital' ? 0xf4c080 : 0x9bdddd, 0.75, 0.12);
              ring(p.x, p.z, 0.6, 0xf1deae, 0.8, 0.14);
            } else ring(p.x, p.z, 1.3, ui.mode.kind === 'attackMove' ? 0xf2c087 : 0xa2ddd5, 0.9, 0.12);
          }
        }
        function draw(now) {
          if (failed) return;
          let dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
          last = now;
          time += dt;
          frames++;
          frameClock += dt;
          if (frameClock >= 1) {
            fps = frames / frameClock;
            frames = 0;
            frameClock = 0;
          }
          try {
            if (game.s && ui.view === 'game' && !ui.paused && !game.s.result) {
              accumulator += dt * game.s.speed;
              let steps = 0;
              while (accumulator >= SIMULATION_STEP_SECONDS && steps++ < 12) {
                game.step(SIMULATION_STEP_SECONDS);
                game.effects.tick(SIMULATION_STEP_SECONDS);
                accumulator -= SIMULATION_STEP_SECONDS;
                if (game.s.result) break;
              }
            } else accumulator = 0;
            ui.tick(dt);
            audio.update(
              ui.view === 'game'
                ? game.s && !ui.paused && !game.s.result
                  ? 'battle'
                  : 'silent'
                : 'menu'
            );
            R.begin();
            if (ui.view === 'game' && game.s) battlefield(game.s.time);
            else {
              R.fogOn = false;
              R.camera(0, 0, 65, true, time);
              for (let e of preview) {
                if (e.type === 'air') e.z = 6 + Math.sin(time * 0.3) * 5;
                renderEntity(R, e, time);
              }
            }
            R.render(time);
            ui.drawOverlay(overlayContext);
          } catch (error) {
            failed = true;
            console.error(error);
            ui.paused = true;
            let loader = document.getElementById('loading');
            loader.classList.remove('hidden');
            loader.innerHTML =
              '<div class="eyebrow">UPLINK INTERRUPTED</div><h2>The renderer encountered a problem.</h2><p>' +
              esc(error.message) +
              '</p><p>Reload this file to return to the main menu. Runs are not saved; the current run will be lost.</p>';
            return;
          }
          requestAnimationFrame(draw);
        }
        canvas.addEventListener('webglcontextlost', e => {
          e.preventDefault();
          ui.paused = true;
          document.getElementById('loading').classList.remove('hidden');
          document.getElementById('loading').innerHTML =
            '<div class="eyebrow">GRAPHICS CONNECTION LOST</div><h2>The graphics connection was lost.</h2><p>Reload this file to reconnect. Runs are not saved; the current run will be lost. Use Performance quality in Settings for a lighter graphics load.</p>';
          failed = true;
        });
        window.Meridian = {
          game,
          ui,
          renderer: R,
          audio,
          content: { units: UNITS, buildings: BUILDINGS, factions: FACTIONS },
          get performance() {
            return {
              fps: Math.round(fps),
              drawCalls: R.drawCalls,
              entities: game.s?.entities.length || 0
            };
          },
          version: '1.0.0'
        };
        // Manual spectator command only; normal launches still stop at the home screen.
        if (visibleSimulation) {
          ui.showBattle();
          ui.startBattle();
        }
        requestAnimationFrame(draw);
      } catch (error) {
        console.error(error);
        const loading = document.getElementById('loading');
        loading.innerHTML =
          '<div class="eyebrow">GRAPHICS UNAVAILABLE</div><h2>A WebGL 2 browser is required.</h2><p>Open this HTML file in a desktop browser with hardware acceleration enabled.</p><p>' +
          String(error.message).replace(/[<>&]/g, '') +
          '</p>';
      }
    })();
