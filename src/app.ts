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
        const params = new URLSearchParams(location.search);
        const experiment = params.get('experiment'),
          mapExperiment: BattlefieldId | null = experiment === 'height' ? 'mothership' : experiment === 'aurelion-playable' ? 'aurelion' :
            experiment && Object.prototype.hasOwnProperty.call(BATTLEFIELDS, experiment) ? experiment as BattlefieldId : null,
          aurelionExperiment = mapExperiment === 'aurelion',
          visibleSimulation = !mapExperiment && params.get('simulation') === 'ai-vs-ai',
          volatileStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} },
          persistence = createMeridianPersistence({
            // The explicitly launched spectator run must not read or mutate the normal profile.
            getStorage: () => visibleSimulation || mapExperiment ? volatileStorage : localStorage,
            clamp,
            upgrades: PERMANENT_UPGRADES,
            benefits: EXPEDITION_BENEFITS,
            abilities: ABILITIES,
            enemyCount: expeditionEnemyCount,
            battlefields: BATTLEFIELDS,
            missions: MISSIONS,
            warn: (...args) => console.warn(...args)
          });
        const profile = persistence.loadProfile();
        if (profile.settings.showFps) $('fpsReadout').classList.remove('hidden');
        R = new MeridianRenderer(canvas);
        const thumbnails = new MeridianModelThumbnails(R);
        addEventListener('pagehide',event=>{
          if (!event.persisted) { thumbnails.dispose(); R.releaseEnvironment(); }
        });
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
        const previewSnapshot = $('previewTransition'), snapshotContext = previewSnapshot.getContext('2d');
        let previewChange: {
          id: number; map: BattlefieldId; seed: number; phase: 'capture' | 'loading' | 'ready' | 'blend';
          world?: Battlefield; animation?: Animation; resolve: (ready: boolean) => void;
        } | null = null;
        function finishPreviewChange(ready: boolean) {
          const change = previewChange;
          previewChange = null;
          previewSnapshot.classList.add('hidden');
          previewSnapshot.width = previewSnapshot.height = 0;
          change?.animation?.cancel();
          change?.resolve(ready);
        }
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
        ui.onPreview = async (map, seed = 40517, smooth = false) => {
          finishPreviewChange(false);
          const id = ++worldRequest, mapId = battlefieldId(map);
          if (smooth && ui.view === 'home' && snapshotContext) {
            // Capture inside the render callback: WebGL's default buffer is not
            // preserved between frames. No preserveDrawingBuffer or readback loop.
            return new Promise<boolean>(resolve => {
              previewChange = { id, map: mapId, seed, phase: 'capture', resolve };
            });
          }
          try {
            const world = new Battlefield(seed, mapId), ready = await R.prepareBattlefieldTextures(world.renderProfile);
            if (!ready || id !== worldRequest || ui.view === 'game' || ui.view === 'codexModel') return false;
            worldView.sync(world, false);
            R.fogOn = false;
            previewEntities();
            $('loading').classList.add('hidden');
            return true;
          } catch (error) {
            if (id === worldRequest) textureFailure(error);
            return false;
          }
        };
        function advancePreviewChange() {
          const change = previewChange;
          if (!change) return;
          if (change.phase === 'capture') {
            previewSnapshot.width = canvas.width;
            previewSnapshot.height = canvas.height;
            snapshotContext!.drawImage(canvas, 0, 0);
            previewSnapshot.style.opacity = '1';
            previewSnapshot.classList.remove('hidden');
            change.phase = 'loading';
            // Keep just one frozen image while building/loading; old map textures
            // can be released safely and no second live world is rendered.
            void Promise.resolve().then(async () => {
              if (previewChange !== change) return;
              const world = new Battlefield(change.seed, change.map), ready = await R.prepareBattlefieldTextures(world.renderProfile);
              if (previewChange !== change) return;
              if (!ready || change.id !== worldRequest || ui.view === 'game' || ui.view === 'codexModel') { finishPreviewChange(false); return; }
              change.world = world;
              change.phase = 'ready';
            }).catch(error => {
              if (previewChange !== change) return;
              finishPreviewChange(false);
              textureFailure(error);
            });
          } else if (change.phase === 'blend' && !change.animation) {
            if (matchMedia('(prefers-reduced-motion: reduce)').matches) { finishPreviewChange(true); return; }
            // Opacity runs on the compositor, independently of the live scene's FPS.
            change.animation = previewSnapshot.animate([{ opacity: 1 }, { opacity: 0 }],
              { duration: 560, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' });
            void change.animation.finished.then(() => {
              if (previewChange === change) finishPreviewChange(true);
            }).catch(() => {}); // Superseding previews cancel only their own animation.
          }
        }
        ui.onLaunchBattle = options => {
          finishPreviewChange(false);
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
        let weatherState: RunState | null = null, weatherTime = 0;
        let last = performance.now(),
          nextRender = last,
          accumulator = 0,
          time = 0,
          frames = 0,
          frameClock = 0,
          fps = 60,
          failed = false;
        const ring = (...args: EffectRingArgs) => drawEffectRing(R, ...args);
        // Coarse validation samples become a continuous, terrain-following color field.
        // Its fine mesh and GPU storage are view-owned; neither changes world geometry or RNG.
        const GUIDE_MESH = 'placementGuide', GUIDE_SAMPLE = 3, GUIDE_STEP = 1.5;
        let placementGuide: { world: Battlefield; key: string } | null = null;
        function clearPlacementGuide() {
          if (placementGuide) R.releaseGeometry(GUIDE_MESH);
          placementGuide = null;
        }
        function drawPlacementGuide(type: BuildingType, s: RunState, world: Battlefield) {
          if (!world.surface || !world.sight[game.localTeam] || ui.battleIntro) { clearPlacementGuide(); return; }
          const radius = Math.min(36, Math.max(24, Math.ceil(s.cam.zoom * 0.55 / GUIDE_SAMPLE) * GUIDE_SAMPLE)),
            cx = Math.round(s.cam.x / GUIDE_SAMPLE) * GUIDE_SAMPLE,
            cz = Math.round(s.cam.z / GUIDE_SAMPLE) * GUIDE_SAMPLE,
            key = `${type}:${game.localTeam}:${cx}:${cz}:${radius}:${world.fogVersion}:${Math.floor(s.time * 3)}`;
          if (placementGuide?.world !== world || placementGuide.key !== key) {
            const startX = cx - radius, startZ = cz - radius, count = radius * 2 / GUIDE_SAMPLE + 1,
              samples = new Float32Array(count * count), sight = world.sight[game.localTeam], size = BUILDINGS[type].size;
            for (let j = 0; j < count; j++) for (let i = 0; i < count; i++) {
              const x = startX + i * GUIDE_SAMPLE, z = startZ + j * GUIDE_SAMPLE, pos = { x, z };
              if (Math.abs(x) >= world.extent - 4 || Math.abs(z) >= world.extent - 4 || !sight.visible[world.idx(x, z)]) continue;
              // An unseen blocker must not be revealed by a changed color at its position.
              if (s.entities.some(e => e.hp > 0 && !game.observed(e) && (
                distance(pos, e) < size + (e.kind === 'unit' ? e.size * UNIT_BODY_SCALE + 1 : e.size + 0.8) ||
                (e.kind === 'unit' && e.exit && distance(pos, e.exit) < size + e.size * UNIT_BODY_SCALE + 1)))) continue;
              samples[j * count + i] = game.canBuild(type, pos, game.localTeam) ? -1 : 1;
            }
            const fine = (count - 1) * 2, row = fine + 1,
              points = new Float32Array(row * row * 6), data = new Float32Array(fine * fine * 54);
            for (let j = 0; j <= fine; j++) for (let i = 0; i <= fine; i++) {
              const x = startX + i * GUIDE_STEP, z = startZ + j * GUIDE_STEP,
                si = Math.min(count - 2, Math.floor(i / 2)), sj = Math.min(count - 2, Math.floor(j / 2)),
                u = i / 2 - si, v = j / 2 - sj, base = sj * count + si,
                a = samples[base], b = samples[base + 1], c = samples[base + count], d = samples[base + count + 1],
                // Missing visibility fades to transparency rather than becoming red.
                visibility = (1-u)*(1-v)*Math.abs(a) + u*(1-v)*Math.abs(b) + (1-u)*v*Math.abs(c) + u*v*Math.abs(d),
                weight = visibility * Math.max(0, Math.min(1, (radius - Math.abs(x - cx)) / GUIDE_SAMPLE,
                  (radius - Math.abs(z - cz)) / GUIDE_SAMPLE)),
                score = (1-u)*(1-v)*a + u*(1-v)*b + (1-u)*v*c + u*v*d,
                blend = visibility ? Math.max(0, Math.min(1, (score / visibility + 1) / 2)) : 0,
                p = (j * row + i) * 6;
              // Local X/Z keep chunk bucket names stable as the camera pans.
              points[p] = x - cx; points[p + 1] = world.surface.heightAt(x, z) + 0.065; points[p + 2] = z - cz;
              points[p + 3] = (.94 - .52 * blend) * weight;
              points[p + 4] = (.38 + .52 * blend) * weight;
              points[p + 5] = (.36 + .49 * blend) * weight;
            }
            let offset = 0;
            const vertex = (index: number) => {
              const p = index * 6;
              data[offset++] = points[p]; data[offset++] = points[p + 1]; data[offset++] = points[p + 2];
              data[offset++] = 0; data[offset++] = 1; data[offset++] = 0;
              data[offset++] = points[p + 3]; data[offset++] = points[p + 4]; data[offset++] = points[p + 5];
            };
            for (let j = 0; j < fine; j++) for (let i = 0; i < fine; i++) {
              const a = j * row + i, b = a + 1, d = a + row, c = d + 1;
              vertex(a); vertex(d); vertex(c); vertex(a); vertex(c); vertex(b);
            }
            R.geometry(GUIDE_MESH, data);
            placementGuide = { world, key };
          }
          R.add(GUIDE_MESH, cx, 0, cz, 1, 1, 1, 0xffffff, 0, 0, 0, 0, 0.65, 'effects', PLACEMENT_GUIDE_MATERIAL);
        }
        function battlefield(t: number) {
          const s = game.s!, world = game.world!;
          const viewState = game.networkTeam !== null ? { ...s, time: t,
            entities: s.entities.map(e => ui.multiplayer!.displayEntity(e)) } : s;
          worldView.sync(world);
          R.camera(s.cam.x, s.cam.z, s.cam.zoom);
          // Intros are presentation-only: show terrain and any featured entity without
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
            renderEntity(R, e, t, { localTeam: game.localTeam, occlusion: !ui.battleIntro && game.observed(e) });
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
                (world.surface?.entityHeight(e) ?? 0) + (isFlyingUnitType(e.type) ? 4.7 : 1.4),
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
          renderBattlefieldEffects(R, game.effects, world, viewState, ui.pings, t, game.localTeam,
            game.networkTeam !== null ? t : weatherTime);
          if (ui.mode?.kind === 'build' && !ui.paused && BUILDINGS[ui.mode.arg])
            drawPlacementGuide(ui.mode.arg, s, world);
          else clearPlacementGuide();
          if (ui.mode && ui.pointer.inside && !ui.paused) {
            let p = ui.targetPosition(ui.pointer.x, ui.pointer.y);
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
              let kind = ui.mode.arg, stats = game.abilityStats(kind, game.localTeam),
                rad = kind === 'scan' ? stats.scanRadius! : kind === 'orbital'
                  ? s.parties[game.localTeam].faction === FACTION_ID.THIRD ? 8 : 10
                  : stats.radius || 4;
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
            if (weatherState !== game.s) {
              weatherState = game.s;
              weatherTime = game.s?.time ?? 0;
            }
            // Only weather interpolates the local fixed-step remainder.
            // Keep its last pose when pausing; neither gameplay nor effect ages advance.
            if (game.networkTeam === null && game.s && ui.view === 'game' && !ui.paused && !game.s.result)
              weatherTime = Math.max(weatherTime, game.s.time + accumulator);
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
            if (now + RENDER_TOLERANCE_MS < nextRender || !R.frameReady()) {
              diagnostics?.finishFrame(false);
              requestAnimationFrame(draw);
              return;
            }
            nextRender += Math.max(1, Math.floor((now - nextRender + RENDER_TOLERANCE_MS) / RENDER_INTERVAL_MS) + 1) * RENDER_INTERVAL_MS;
            if (previewChange && (ui.view === 'game' || ui.view === 'codexModel')) finishPreviewChange(false);
            if (previewChange?.phase === 'loading') {
              diagnostics?.finishFrame(false);
              requestAnimationFrame(draw);
              return;
            }
            if (previewChange?.phase === 'ready') {
              worldView.sync(previewChange.world!, false);
              R.fogOn = false;
              previewEntities();
              previewChange.world = undefined;
              previewChange.phase = 'blend';
            }
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
            else if (ui.view === 'codexModel' && ui.codexSelection) {
              clearPlacementGuide();
              const {kind,type,faction} = ui.codexSelection;
              const d = kind === 'unit' ? UNITS[type as UnitType] : BUILDINGS[type as BuildingType];
              R.fogOn = false;
              R.camera(0,0,(kind === 'building' ? 21 : type === 'destroyer' ? 30 : 13) * ui.codexZoom);
              renderEntity(R, {id:7,kind,type,x:0,z:0,faction,team:0,hp:d.hp,maxHp:d.hp,size:d.size,
                rot:ui.codexModelRotation(dt),walk:time,progress:1,carry:0,amount:2200,shield:0,maxShield:0,kills:0},time,{localTeam:0});
            } else {
              clearPlacementGuide();
              R.fogOn = false;
              R.camera(0, 0, 65, true, time);
              for (let e of preview) {
                if (e.type === 'air') e.z = 6 + Math.sin(time * 0.3) * 5;
                renderEntity(R, e, time);
              }
            }
            diagnostics?.recorder.phase('glSubmission');
            R.render(time, ui.view === 'game' && game.s ? viewTime! : ui.view === 'codexModel' ? time : 0,
              ui.view === 'codex' ? () => thumbnails.update($('menu')) :
                ui.view === 'game' && !ui.modalKind ? () => thumbnails.update($('actionPanel')) : undefined);
            advancePreviewChange();
            diagnostics?.recorder.phase('overlay');
            ui.drawOverlay(overlayContext);
            diagnostics?.finishFrame(true);
          } catch (error) {
            finishPreviewChange(false);
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
          finishPreviewChange(false);
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
          ui.expedition = { version: 5, faction: 0, abilities: [...DEFAULT_ABILITY_LOADOUT], depth: aurelionExperiment ? 3 : 0,
            benefits: {pioneerSquad: 2}, enemyBenefits: aurelionExperiment ? [{pioneerSquad:2},{pioneerSquad:2}] : [{}],
            encounter: {mission: aurelionExperiment ? 'echo-salvage' : DEFAULT_MISSION, map: mapExperiment,
              seed: /^[1-9][0-9]{0,7}$/.test(params.get('seed') ?? '') ? Number(params.get('seed')) : 1409,
              enemies: aurelionExperiment ? [1,2] : [2]}, offers: [] };
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
