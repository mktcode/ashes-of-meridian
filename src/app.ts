    /* Application lifecycle, fixed-step clock, visual effects, and cinematic frontier. */
    'use strict';
    (() => {
      let R: MeridianRenderer,
        game: MeridianGame,
        ui: MeridianUI,
        audio: MeridianAudio,
        overlayContext: CanvasRenderingContext2D,
        preview: RenderEntity[] = [];
      const canvas = $('world'),
        overlay = $('overlay');
      try {
        const params = new URLSearchParams(location.search),
          heightExperiment = params.get('experiment') === 'height',
          westmarkExperiment = params.get('experiment') === 'westmark',
          mapExperiment = heightExperiment || westmarkExperiment,
          visibleSimulation = !mapExperiment && params.get('simulation') === 'ai-vs-ai',
          volatileStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} },
          persistence = createMeridianPersistence({
            // The explicitly launched spectator run must not read or mutate the normal profile.
            getStorage: () => visibleSimulation || mapExperiment ? volatileStorage : localStorage,
            clamp,
            upgrades: META,
            benefits: EXPEDITION_BENEFITS,
            enemyCount: expeditionEnemyCount,
            battlefields: BATTLEFIELDS,
            warn: (...args) => console.warn(...args)
          });
        const profile = persistence.loadProfile();
        R = new MeridianRenderer(canvas);
        R.quality = profile.settings.quality;
        R.resize();
        audio = new MeridianAudio(profile.settings);
        const worldView = new BattlefieldView(R);
        game = new MeridianGame(profile, (...event: GameEvent) => {
          const [type] = event;
          if (type === 'start') {
            worldView.sync(game.world!);
            if (visibleSimulation) {
              game.enableAI(0);
              const run = game.s!;
              setTimeout(() => {
                if (game.s === run && !run.result) {
                  run.speed = 2;
                  ui?.updateHUD();
                }
              }, 10000);
            }
          }
          if (ui) ui.event(...event);
        });
        ui = new MeridianUI(game, R, audio, profile, persistence);
        const context = overlay.getContext('2d');
        if (!context) throw Error('Canvas 2D is unavailable');
        overlayContext = context;
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
        new ResizeObserver(resize).observe($('worldViewport'));
        addEventListener('resize', resize);
        resize();
        let worldRequest = 0;
        function previewEntities() {
          preview = [];
          let id = 0;
          function e<K extends EntityKind>(kind: K, type: EntityTypeForKind<K>, x: number, z: number, faction: FactionId = FACTION_ID.FIRST, team: TeamId = 0) {
            let d: { hp?: number; size?: number } = kind === 'building' ? BUILDINGS[type as BuildingType] : UNITS[type as UnitType] || {};
            preview.push({
              id: ++id, kind, type, x, z, faction, team,
              hp: d.hp || 100, maxHp: d.hp || 100, size: d.size || 1,
              rot: kind === 'building' ? 0 : -0.45, walk: 0, progress: 1, carry: 0, amount: 2200,
              shield: 0, maxShield: 0, kills: 0, order: { type: 'idle' }
            });
          }
          e('building', 'hq', 7, 1);
          e('building', 'factory', -4, 12);
          e('building', 'barracks', 21, 10);
          e('building', 'depot', 29, 1);
          e('building', 'turret', 20, -6);
          e('building', 'turret', 30, -10);
          e('unit', 'hero', 14, 21);
          e('unit', 'tank', 8, 23);
          e('unit', 'tank', -1, 26);
          e('unit', 'artillery', -13, 15);
          e('unit', 'air', 30, 6);
          for (let i = 0; i < 9; i++) e('unit', 'rifle', 15 + (i % 3) * 1.8, 16 + Math.floor(i / 3) * 2);
          for (let i = 0; i < 7; i++) e('resource', 'crystal', -19 + Math.sin(i * 2) * 4, 25 + Math.cos(i * 2) * 4);
          e('building', 'hq', -30, -48, FACTION_ID.THIRD, 1);
          e('building', 'turret', -20, -39, FACTION_ID.THIRD, 1);
        }
        function loadingBattlefield(text: string) {
          const loader = $('loading');
          loader.innerHTML = `<div class="crest">◈</div><div class="eyebrow">MERIDIAN EXPEDITIONARY COMMAND</div><h2>${text}<span class="dots">...</span></h2><p>Preparing the frontier</p>`;
          loader.classList.remove('hidden');
        }
        function textureFailure(error: unknown) {
          console.error(error);
          const loader = $('loading');
          loader.innerHTML = `<div class="eyebrow">UPLINK INTERRUPTED</div><h2>Texture preparation failed.</h2><p>${esc(error instanceof Error ? error.message : String(error))}</p>`;
          loader.classList.remove('hidden');
        }
        ui.onPreview = map => {
          const id = ++worldRequest, mapId = battlefieldId(map), world = new Battlefield(40517, mapId),
            profile = BATTLEFIELDS[mapId].render;
          void R.prepareBattlefieldTextures(profile).then(ready => {
            if (!ready || id !== worldRequest || ui.view === 'game') return;
            worldView.sync(world, false);
            R.fogOn = false;
            previewEntities();
            $('loading').classList.add('hidden');
          }).catch(textureFailure);
        };
        ui.onLaunchBattle = options => {
          const id = ++worldRequest, mapId = battlefieldId(options.map), profile = BATTLEFIELDS[mapId].render;
          if (!R.hasBattlefieldTextures(profile)) loadingBattlefield('Preparing operation');
          void R.prepareBattlefieldTextures(profile).then(ready => {
            if (!ready || id !== worldRequest) return;
            game.start(options);
            $('loading').classList.add('hidden');
          }).catch(textureFailure);
        };
        ui.multiplayer = new MeridianMultiplayerClient(ui, async map => {
          const id = ++worldRequest;
          const ready = await R.prepareBattlefieldTextures(BATTLEFIELDS[map].render);
          return ready && id === worldRequest;
        });
        const diagnostics = params.get('diagnostics') === '1' ? createMeridianDiagnostics(R, () => ({
          view: ui.view, paused: ui.paused, multiplayer: game.networkTeam != null,
          map: worldView.world?.definition.name ?? null, seed: worldView.world?.seed ?? null,
          simulationTime: ui.view === 'game' ? game.s?.time ?? null : null,
          speed: ui.view === 'game' ? game.s?.speed ?? null : null,
          entities: ui.view === 'game' ? game.s?.entities.length ?? 0 : preview.length,
          effects: ui.view === 'game' ? game.effects.fx.length : 0
        })) : undefined;
        ui.showHome();
        const SIMULATION_STEP_SECONDS = 0.05,
          RENDER_INTERVAL_MS = 1000 / 60,
          RENDER_TOLERANCE_MS = 0.1;
        let last = performance.now(),
          nextRender = last,
          accumulator = 0,
          time = 0,
          frames = 0,
          frameClock = 0,
          fps = 60,
          failed = false;
        const ring = (...args: EffectRingArgs) => drawEffectRing(R, ...args);
        function battlefield(t: number) {
          const s = game.s!, world = game.world!;
          const viewState = game.networkTeam !== null ? { ...s, time: t,
            entities: s.entities.map(e => ui.multiplayer!.displayEntity(e)) } : s;
          worldView.sync(world);
          R.camera(s.cam.x, s.cam.z, s.cam.zoom);
          // Stage intros are presentation-only: show the terrain and featured HQ without
          // mutating either party's visibility/exploration buffers.
          R.fogOn = !ui.battleIntro;
          const selectedIds = ui.selectionIds();
          for (let e of viewState.entities) {
            if (e.hp <= 0) continue;
            if (!game.observed(e) && !ui.introObserves(e)) continue;
            let p = R.project(e.x, world.surface?.entityHeight(e) ?? 0, e.z);
            const v = R.viewport;
            if (p && (p.x < v.left - 220 || p.x > v.right + 220 || p.y < v.top - 260 || p.y > v.bottom + 260))
              continue;
            renderEntity(R, e, t, { localTeam: game.localTeam });
            let selected = selectedIds.has(e.id),
              hover = ui.hover === e.id;
            if (selected || hover) {
              let col =
                e.team !== -1 && e.team !== game.localTeam
                  ? 0xf2a490
                  : e.type === 'hero'
                    ? 0xf1c181
                    : 0x94e4d1;
              ring(e.x, e.z, e.size + 0.5, col, selected ? 0.95 : 0.43, 0.12);
              if (selected && e.kind === 'building' && (BUILDINGS[e.type] as BuildingDefinitionShape).range)
                ring(e.x, e.z, game.rangedStats(e).range, col, 0.15, 0.12);
            }
            if (e.maxShield && e.shield > 0 && s.time - e.lastHit < 0.35)
              R.add(
                'sphere',
                e.x,
                (world.surface?.entityHeight(e) ?? 0) + (e.type === 'air' ? 4.7 : 1.4),
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
          renderBattlefieldEffects(R, game.effects, world, viewState, ui.pings, t, game.localTeam);
          if (ui.mode && ui.pointer.inside && !ui.paused) {
            let p = R.ground(ui.pointer.x, ui.pointer.y);
            const limit = world.extent - 4;
            p.x = clamp(p.x, -limit, limit);
            p.z = clamp(p.z, -limit, limit);
            if (ui.mode.kind === 'build') {
              let type = ui.mode.arg,
                d = BUILDINGS[type];
              if (d) {
                const foundation = game.foundationPosition(type, p, game.localTeam);
                let check = game.canBuild(type, p, game.localTeam),
                  ok = !check,
                  col = ok ? 0x99e4c6 : 0xf39989;
                renderEntity(
                  R,
                  createBuildingPreview(type, foundation, s.parties[game.localTeam].faction, game.localTeam),
                  t,
                  { tint: col, alpha: 0.3, layer: 'effects', localTeam: game.localTeam }
                );
                ring(foundation.x, foundation.z, d.size + 0.6, col, 0.9);
              }
            } else if (ui.mode.kind === 'ability') {
              let kind = ui.mode.arg,
                rad =
                  kind === 'scan'
                    ? 32
                    : kind === 'orbital'
                      ? s.parties[game.localTeam].faction === FACTION_ID.THIRD
                        ? 8
                        : 10
                      : kind === 'repair'
                        ? 12
                        : 4;
              ring(p.x, p.z, rad, kind === 'orbital' ? 0xf4c080 : 0x9bdddd, 0.75, 0.12);
              ring(p.x, p.z, 0.6, 0xf1deae, 0.8, 0.14);
            } else ring(p.x, p.z, 1.3, 0xa2ddd5, 0.9, 0.12);
          }
        }
        function draw(now: number) {
          if (failed) return;
          diagnostics?.recorder.beginFrame(now);
          const elapsed = Math.max(0, (now - last) / 1000);
          let dt = Math.min(0.1, elapsed);
          last = now;
          time += dt;
          frameClock += elapsed;
          try {
            if (game.networkTeam == null && game.s && ui.view === 'game' && !ui.paused && !game.s.result) {
              accumulator += dt * game.s.speed;
              let steps = 0;
              while (accumulator >= SIMULATION_STEP_SECONDS && steps++ < 12) {
                game.step(SIMULATION_STEP_SECONDS);
                game.effects.tick(SIMULATION_STEP_SECONDS);
                accumulator -= SIMULATION_STEP_SECONDS;
                if (game.s.result) break;
              }
            } else accumulator = 0;
            diagnostics?.recorder.phase('networkPresentation');
            ui.multiplayer?.updatePresentation(now);
            diagnostics?.recorder.phase('ui');
            ui.tick(dt);
            diagnostics?.recorder.phase('audio');
            audio.update(
              ui.view === 'game'
                ? game.s && !ui.paused && !game.s.result
                  ? 'battle'
                  : 'silent'
                : 'menu'
            );
            diagnostics?.recorder.phase();
            // Keep simulation, UI clocks and network presentation on every rAF.
            // Retain the render phase on e.g. 90/144 Hz displays instead of
            // resetting to now + interval, which would systematically undershoot.
            if (now + RENDER_TOLERANCE_MS < nextRender) {
              diagnostics?.finishFrame(false);
              requestAnimationFrame(draw);
              return;
            }
            nextRender += Math.max(1, Math.floor((now - nextRender + RENDER_TOLERANCE_MS) / RENDER_INTERVAL_MS) + 1) * RENDER_INTERVAL_MS;
            // Missed render slots are discarded, never drawn in a catch-up loop.
            frames++;
            if (frameClock >= 1) {
              fps = frames / frameClock;
              const snapshots = ui.multiplayer?.takeSnapshotCount() ?? 0;
              $('fpsReadout').textContent = `${Math.round(fps)} FPS` +
                (game.networkTeam !== null ? ` · NET ${(snapshots / frameClock).toFixed(0)} Hz` : '');
              frames = 0;
              frameClock = 0;
            }
            diagnostics?.recorder.phase('sceneBuild');
            R.begin();
            const viewTime = game.networkTeam !== null ? ui.multiplayer!.renderTime : game.s?.time;
            if (ui.view === 'game' && game.s) battlefield(viewTime!);
            else {
              R.fogOn = false;
              R.camera(0, 0, 65, true, time);
              for (let e of preview) {
                if (e.type === 'air') e.z = 6 + Math.sin(time * 0.3) * 5;
                renderEntity(R, e, time);
              }
            }
            diagnostics?.recorder.phase('glSubmission');
            R.render(time, ui.view === 'game' && game.s ? viewTime! : 0);
            diagnostics?.recorder.phase('overlay');
            ui.drawOverlay(overlayContext);
            diagnostics?.finishFrame(true);
          } catch (error) {
            diagnostics?.stop('render-error');
            const network = game.networkTeam != null;
            if (network) ui.multiplayer?.disconnect();
            failed = true;
            console.error(error);
            ui.paused = true;
            let loader = $('loading');
            loader.classList.remove('hidden');
            loader.innerHTML =
              '<div class="eyebrow">UPLINK INTERRUPTED</div><h2>The renderer encountered a problem.</h2><p>' +
              esc(error instanceof Error ? error.message : String(error)) +
              (network ? '</p><p>The multiplayer session ended. Reload to return to the menu.</p>'
                : '</p><p>Reload this file to return to the last secured expedition checkpoint.</p>');
            return;
          }
          requestAnimationFrame(draw);
        }
        canvas.addEventListener('webglcontextlost', e => {
          e.preventDefault();
          diagnostics?.stop('context-lost');
          const network = game.networkTeam != null;
          if (network) ui.multiplayer?.disconnect();
          ui.paused = true;
          $('loading').classList.remove('hidden');
          $('loading').innerHTML =
            '<div class="eyebrow">GRAPHICS CONNECTION LOST</div><h2>The graphics connection was lost.</h2><p>' +
            (network ? 'The multiplayer session ended. Reload to return to the menu.' : 'Reload this file to reconnect from the last secured expedition checkpoint.') +
            ' Use Performance quality in Settings for a lighter graphics load.</p>';
          failed = true;
        });
        window.Meridian = {
          game,
          ui,
          renderer: R,
          audio,
          diagnostics,
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
        if (mapExperiment) {
          // Explicit, local manual playtest. No normal profile reads/writes or automatic spectator run.
          ui.expedition = { version: 3, faction: 0, depth: 0, benefits: {pioneerSquad: 2}, enemyBenefits: [{}],
            encounter: {map: westmarkExperiment ? 'westmark' : 'mothership', seed: 1409, enemies: [2]}, offers: [] };
          ui.startExpeditionBattle();
        } else if (visibleSimulation) {
          ui.showBattle();
          ui.startBattle();
        }
        requestAnimationFrame(draw);
      } catch (error) {
        console.error(error);
        const loading = $('loading');
        loading.innerHTML =
          '<div class="eyebrow">GRAPHICS UNAVAILABLE</div><h2>A WebGL 2 browser is required.</h2><p>Open this HTML file in a desktop browser with hardware acceleration enabled.</p><p>' +
          String(error instanceof Error ? error.message : error).replace(/[<>&]/g, '') +
          '</p>';
      }
    })();
