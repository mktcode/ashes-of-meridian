    /* Application lifecycle, fixed-step clock, visual effects, and cinematic frontier. */
    'use strict';
    (() => {
      let R: MeridianRenderer,
        game: MeridianGame,
        ui: MeridianUI,
        audio: MeridianAudio,
        overlayContext: CanvasRenderingContext2D,
        preview: RenderEntity[] = [],
        previewCenter: Position = { x: 0, z: 0 },
        previewTime = 0,
        previewSavedBattle = false,
        retainedResult: { state: RunState; world: Battlefield | null; key: string } | null = null;
      const canvas = $('world'),
        overlay = $('overlay');
      try {
        const params = new URLSearchParams(location.search);
        const experiment = params.get('experiment'),
          mapExperiment: BattlefieldId | null = experiment === 'height' ? 'mothership' :
            experiment && Object.prototype.hasOwnProperty.call(BATTLEFIELDS, experiment) ? experiment as BattlefieldId : null,
          visibleSimulation = !mapExperiment && params.get('simulation') === 'ai-vs-ai',
          volatileStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} },
          persistence = createMeridianPersistence({
            // The explicitly launched spectator run must not read or mutate the normal profile.
            getStorage: () => visibleSimulation || mapExperiment ? volatileStorage : localStorage,
            clamp,
            upgrades: PERMANENT_UPGRADES,
            benefits: EXPEDITION_BENEFITS,
            abilities: ABILITIES,
            units: UNITS,
            buildings: BUILDINGS,
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
          if (!event.persisted) { thumbnails.dispose(); R.releaseMenuSky(); R.releaseMenuShadows(); R.releasePointLights(); R.releaseWorkerRoads(); R.releaseEnvironment(); }
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
          retainedResult = null;
          R.resize();
          let d = Math.min(devicePixelRatio || 1, 2);
          const v = R.viewport;
          overlay.width = Math.round(v.width * d);
          overlay.height = Math.round(v.height * d);
          // Overlay drawing shares the renderer's CSS client coordinates.
          overlayContext.setTransform(d, 0, 0, d, -v.left * d, -v.top * d);
          if (ui.view === 'game' && game.s) {
            const cam = game.s.cam;
            R.camera(cam.x, cam.z, cam.zoom, false, 0, cam.yaw);
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
          world?: Battlefield; battle?: ExpeditionBattleSave | null; animation?: Animation; resolve: (ready: boolean) => void;
        } | null = null;
        function finishPreviewChange(ready: boolean) {
          const change = previewChange;
          previewChange = null;
          previewSnapshot.classList.add('hidden');
          previewSnapshot.width = previewSnapshot.height = 0;
          change?.animation?.cancel();
          change?.resolve(ready);
        }
        function previewEntities(map: BattlefieldId, seed: number, battle?: ExpeditionBattleSave | null) {
          const scene = savedBattleMenuScene(ui.expedition, map, seed, battle);
          preview = scene.entities;
          previewCenter = scene.center;
          previewTime = scene.time;
          const source = battle === undefined ? ui.expedition?.encounter.map === map && ui.expedition.encounter.seed === seed
            ? ui.expedition.battle : null : battle;
          previewSavedBattle = !!source && source.state.map === map && source.state.seed === seed;
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
        let initialHomeReveal = true;
        ui.onPreview = async (map, seed = 40517, smooth = false, battle) => {
          finishPreviewChange(false);
          const id = ++worldRequest, mapId = battlefieldId(map);
          if (smooth && ui.view === 'home' && snapshotContext) {
            // Capture inside the render callback: WebGL's default buffer is not
            // preserved between frames. No preserveDrawingBuffer or readback loop.
            return new Promise<boolean>(resolve => {
              previewChange = { id, map: mapId, seed, battle, phase: 'capture', resolve };
            });
          }
          try {
            const world = new Battlefield(seed, mapId), ready = await R.prepareBattlefieldTextures(world.renderProfile);
            if (!ready || id !== worldRequest || ui.view === 'game' || ui.view === 'codexModel') return false;
            worldView.sync(world, false);
            R.fogOn = false;
            previewEntities(mapId, seed, battle);
            $('loading').classList.add('hidden');
            if (initialHomeReveal && ui.view === 'home') {
              initialHomeReveal = false;
              $('worldViewport').classList.add('home-scene-reveal');
            }
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
        const battleTransition = $('battleTransition');
        let battleTransitionAnimation: Animation | null = null;
        let battleHUDAnimations: Animation[] = [];
        let battleEntranceFrame: RunState | null = null;
        let battleExit: { phase: 'out' | 'loading' | 'ready' | 'reveal'; complete: () => void | Promise<boolean> } | null = null;
        function clearBattleTransition() {
          battleExit = null;
          ui.leavingBattle = false;
          battleTransitionAnimation?.cancel();
          battleTransitionAnimation = null;
          battleHUDAnimations.forEach(animation => animation.cancel());
          battleHUDAnimations = [];
          battleEntranceFrame = null;
          battleTransition.classList.add('hidden');
          battleTransition.classList.remove('battle-reveal');
          $('hud').classList.remove('battle-entrance-pending', 'battle-entrance', 'battle-exit');
        }
        function revealBattlefield() {
          if (!$('hud').classList.contains('battle-entrance-pending')) return;
          if (matchMedia('(prefers-reduced-motion: reduce)').matches) { clearBattleTransition(); return; }
          // Keep the hidden starting pose through a submitted frame. In particular,
          // cold scene setup must not consume the HUD's visible animation time.
          if (battleEntranceFrame !== game.s) { battleEntranceFrame = game.s; return; }
          battleTransitionAnimation?.cancel();
          battleTransition.classList.add('battle-reveal');
          // Explicit animation instances restart even if DOM/style updates coalesce.
          // Gentle acceleration keeps the slide visible instead of front-loading it.
          const hudAnimations = [
            $('topbar').animate([{ opacity: 0, transform: 'translateY(-110%)' }, { opacity: 1, transform: 'translateY(0)' }],
              { duration: 1100, delay: 80, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'both' }),
            $('commandDeck').animate([{ opacity: 0, transform: 'translateY(110%)' }, { opacity: 1, transform: 'translateY(0)' }],
              { duration: 1100, delay: 160, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'both' })
          ];
          battleHUDAnimations = hudAnimations;
          $('hud').classList.replace('battle-entrance-pending', 'battle-entrance');
          const animation = battleTransition.animate([{ opacity: 1 }, { opacity: 0 }],
            { duration: 900, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' });
          battleTransitionAnimation = animation;
          void animation.finished.then(() => {
            if (battleTransitionAnimation === animation) battleTransition.classList.add('hidden');
          }).catch(() => {});
          // Finishing the map fade must not cancel a still-moving HUD.
          void Promise.all([animation, ...hudAnimations].map(item => item.finished)).then(() => {
            if (battleHUDAnimations === hudAnimations) clearBattleTransition();
          }).catch(() => {});
        }
        function showBattleDestination(exit: NonNullable<typeof battleExit>) {
          if (battleExit !== exit) return;
          exit.phase = 'loading';
          // Change viewport, screen and world only once every outgoing element is
          // gone. Keep an opaque cover until the destination actually renders.
          battleTransition.classList.remove('battle-reveal');
          void Promise.resolve().then<void | boolean>(() => battleExit === exit ? exit.complete() : undefined).then(ready => {
            if (battleExit !== exit) return;
            if (ready === false) {
              clearBattleTransition();
              textureFailure(Error('Required menu textures are unavailable'));
            } else exit.phase = 'ready';
          }).catch(error => {
            if (battleExit !== exit) return;
            clearBattleTransition();
            textureFailure(error);
          });
        }
        ui.onLeaveBattle = complete => {
          // Capture partially entered HUDs before cancelling their old animations:
          // leaving during an entrance must not snap them to their final position.
          const poses = ['topbar', 'commandDeck'].map(id => {
            const style = getComputedStyle($(id));
            return { opacity: style.opacity, transform: style.transform };
          });
          const coverOpacity = battleTransition.classList.contains('hidden') ? '0' : getComputedStyle(battleTransition).opacity;
          clearBattleTransition();
          ui.leavingBattle = true;
          ui.paused = true;
          ui.clearMode();
          ui.drag = null;
          audio.setMode?.('silent');
          $('modal').classList.add('hidden');
          $('radio').classList.add('hidden');
          battleTransition.classList.remove('hidden');
          const exit: NonNullable<typeof battleExit> = { phase: 'out', complete };
          battleExit = exit;
          if (matchMedia('(prefers-reduced-motion: reduce)').matches) { showBattleDestination(exit); return; }
          // Keep a visible HUD above the map blackout. From a result screen,
          // cover the whole screen instead: there is no remaining HUD to slide.
          if (!$('hud').classList.contains('hidden')) battleTransition.classList.add('battle-reveal');
          $('hud').classList.add('battle-exit');
          battleHUDAnimations = ['topbar', 'commandDeck'].map((id, index) => $(id).animate([
            poses[index], { opacity: 0, transform: `translateY(${index ? '' : '-'}110%)` }
          ], { duration: 1000, delay: index * 80, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'both' }));
          const animation = battleTransition.animate([{ opacity: coverOpacity }, { opacity: 1 }],
            { duration: 900, delay: 180, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'both' });
          battleTransitionAnimation = animation;
          void Promise.all([animation, ...battleHUDAnimations].map(item => item.finished)).then(() => {
            showBattleDestination(exit);
          }).catch(() => {});
        };
        function revealBattleDestination() {
          const exit = battleExit;
          if (!exit || exit.phase !== 'ready') return;
          exit.phase = 'reveal';
          if (matchMedia('(prefers-reduced-motion: reduce)').matches) { clearBattleTransition(); return; }
          battleTransitionAnimation?.cancel();
          const animation = battleTransition.animate([{ opacity: 1 }, { opacity: 0 }],
            { duration: 900, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' });
          battleTransitionAnimation = animation;
          void animation.finished.then(() => {
            if (battleExit === exit) clearBattleTransition();
          }).catch(() => {});
        }
        ui.onLaunchBattle = async (options, expedition, world) => {
          finishPreviewChange(false);
          const id = ++worldRequest, mapId = battlefieldId(options.map), profile = BATTLEFIELDS[mapId].render;
          if (!R.hasBattlefieldTextures(profile)) loadingBattlefield('Preparing operation');
          let ready: boolean;
          try {
            clearBattleTransition();
            battleTransition.classList.remove('hidden');
            if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
              const animation = battleTransition.animate([{ opacity: 0 }, { opacity: 1 }],
                { duration: 320, easing: 'ease-in-out', fill: 'forwards' });
              battleTransitionAnimation = animation;
              await animation.finished;
            }
            ready = await R.prepareBattlefieldTextures(profile);
          }
          catch (e) { clearBattleTransition(); if (id === worldRequest) textureFailure(e); return false; }
          if (id !== worldRequest || (world ? !ui.expedition?.worlds?.includes(world) || ui.view !== 'home' : expedition !== ui.expedition)) { clearBattleTransition(); return false; }
          if (!ready) { clearBattleTransition(); textureFailure(Error('Required battlefield textures are unavailable')); return false; }
          if (!world && ui.expedition && !expeditionStageUnlocked(ui.expedition)) { clearBattleTransition(); return false; }
          try {
            if (expedition.battle) game.restoreBattle(expedition, !!world);
            else game.start(options);
            return true;
          } catch (error) {
            clearBattleTransition();
            throw error;
          } finally { $('loading').classList.add('hidden'); }
        };
        const diagnostics = params.get('diagnostics') === '1' ? createMeridianDiagnostics(R, () => ({
          view: ui.view, paused: ui.paused,
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
        let placementGuide: { world: Battlefield; context: string; key: string; revision: string; uploaded: boolean; dirty: boolean;
          sampler: PlacementGuideSampler; samples: Float32Array; points: Float32Array; data: Float32Array } | null = null;
        function clearPlacementGuide() {
          if (placementGuide) R.releaseGeometry(GUIDE_MESH);
          placementGuide = null;
        }
        function drawPlacementGuide(type: BuildingType, s: RunState, world: Battlefield) {
          if (!world.surface || !world.sight[game.localTeam] || ui.battleIntro) { clearPlacementGuide(); return; }
          // Project the whole viewport, not a capped square around the zero-height pivot.
          // Raised ground shifts towards the camera along its fixed viewing axis.
          const viewport = R.viewport, height = world.surface.maxHeight,
            dx = Math.sin(s.cam.yaw) * .82 / 1.1 * height,
            dz = Math.cos(s.cam.yaw) * .82 / 1.1 * height,
            corners = [[viewport.left, viewport.top], [viewport.left + viewport.width, viewport.top],
              [viewport.left, viewport.top + viewport.height], [viewport.left + viewport.width, viewport.top + viewport.height]]
              .flatMap(([x, y]) => { const p = R.ground(x, y, false); return [p, { x: p.x + dx, z: p.z + dz }]; }),
            lower = (values: number[]) => Math.floor(Math.max(-world.extent, Math.min(...values) - GUIDE_SAMPLE * 2) / GUIDE_SAMPLE) * GUIDE_SAMPLE,
            upper = (values: number[]) => Math.ceil(Math.min(world.extent, Math.max(...values) + GUIDE_SAMPLE * 2) / GUIDE_SAMPLE) * GUIDE_SAMPLE,
            startX = lower(corners.map(p => p.x)), startZ = lower(corners.map(p => p.z)),
            endX = upper(corners.map(p => p.x)), endZ = upper(corners.map(p => p.z)),
            cx = (startX + endX) / 2, cz = (startZ + endZ) / 2,
            context = `${type}:${game.localTeam}`,
            key = `${context}:${startX}:${startZ}:${endX}:${endZ}`,
            revision = `${world.fogVersion}:${Math.floor(s.time * 3)}`,
            columns = (endX - startX) / GUIDE_SAMPLE + 1, rows = (endZ - startZ) / GUIDE_SAMPLE + 1,
            fineX = (columns - 1) * 2, fineZ = (rows - 1) * 2, row = fineX + 1;
          if (endX <= startX || endZ <= startZ) { clearPlacementGuide(); return; }
          const newFootprint = placementGuide?.world !== world || placementGuide.key !== key;
          if (newFootprint) {
            const sampler = placementGuide?.world === world && placementGuide.context === context
              ? placementGuide.sampler : new PlacementGuideSampler(game, type, game.localTeam);
            sampler.retainTerrainFootprint(startX, startZ, endX, endZ);
            clearPlacementGuide();
            placementGuide = { world, context, key, revision: '', uploaded: false, dirty: false, sampler,
              samples: new Float32Array(columns * rows).fill(2),
              points: new Float32Array(row * (fineZ + 1) * 6), data: new Float32Array(fineX * fineZ * 54) };
          }
          const guide = placementGuide!;
          if (guide.revision !== revision || guide.sampler.pending) {
            const { samples, points, data, sampler } = guide;
            sampler.refresh();
            for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
              const sample = sampler.sample({ x: startX + i * GUIDE_SAMPLE, z: startZ + j * GUIDE_SAMPLE }), index = j * columns + i;
              if (samples[index] !== sample) { samples[index] = sample; guide.dirty = true; }
            }
            // Fog revisions and moving blockers often leave the sampled field unchanged.
            // Finish the bounded terrain batch before building/uploading the field once.
            if (guide.dirty && !sampler.pending) {
              for (let j = 0; j <= fineZ; j++) for (let i = 0; i <= fineX; i++) {
                const x = startX + i * GUIDE_STEP, z = startZ + j * GUIDE_STEP,
                  si = Math.min(columns - 2, Math.floor(i / 2)), sj = Math.min(rows - 2, Math.floor(j / 2)),
                  u = i / 2 - si, v = j / 2 - sj, base = sj * columns + si,
                  a = samples[base], b = samples[base + 1], c = samples[base + columns], d = samples[base + columns + 1],
                  // Missing visibility fades to transparency rather than becoming red.
                  visibility = (1-u)*(1-v)*Math.abs(a) + u*(1-v)*Math.abs(b) + (1-u)*v*Math.abs(c) + u*v*Math.abs(d),
                  weight = visibility * Math.max(0, Math.min(1, (x - startX) / GUIDE_SAMPLE, (endX - x) / GUIDE_SAMPLE,
                    (z - startZ) / GUIDE_SAMPLE, (endZ - z) / GUIDE_SAMPLE)),
                  score = (1-u)*(1-v)*a + u*(1-v)*b + (1-u)*v*c + u*v*d,
                  blend = visibility ? Math.max(0, Math.min(1, (score / visibility + 1) / 2)) : 0,
                  p = (j * row + i) * 6;
                // The viewport footprint owns stable local positions; only colors change.
                if (!guide.uploaded) {
                  points[p] = x - cx; points[p + 1] = world.surface.heightAt(x, z) + 0.065; points[p + 2] = z - cz;
                }
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
              for (let j = 0; j < fineZ; j++) for (let i = 0; i < fineX; i++) {
                const a = j * row + i, b = a + 1, d = a + row, c = d + 1;
                vertex(a); vertex(d); vertex(c); vertex(a); vertex(c); vertex(b);
              }
              R.streamGeometry(GUIDE_MESH, data);
              guide.uploaded = true; guide.dirty = false;
            }
            guide.revision = revision;
          }
          // Hide the previous field while new terrain samples are pending; never leak stale sight/occupancy.
          if (guide.uploaded && !guide.sampler.pending)
            R.add(GUIDE_MESH, cx, 0, cz, 1, 1, 1, 0xffffff, 0, 0, 0, 0, 0.65, 'effects', PLACEMENT_GUIDE_MATERIAL);
        }
        function battlefield(t: number) {
          const s = game.s!, world = game.world!;
          const fogOn = !(world.fogCleared && world.viewTeam === 0);
          worldView.sync(world, fogOn, s);
          worldView.updateWorkerRoads(s.time, s.entities, e => !ui.battleIntro && game.observed(e));
          worldView.retainBuildingGround(s.entities);
          // Revalidate restored cameras and resized viewports, including while paused.
          if (!ui.battleIntro && ui.battleTutorial?.step !== 'arrival')
            Object.assign(s.cam, ui.clampCameraPoint(s.cam));
          R.camera(s.cam.x, s.cam.z, s.cam.zoom, false, 0, s.cam.yaw);
          // Intros are presentation-only: show terrain and any featured entity without
          // mutating either party's visibility/exploration buffers.
          R.fogOn = fogOn && !ui.battleIntro;
          const selectedIds = ui.selectionIds();
          for (const cache of s.supplyCaches)
            if (!cache.collected && world.explored[world.idx(cache.x, cache.z)]) renderSupplyCache(R, world, cache);
          for (let e of s.entities) {
            if (e.hp <= 0) continue;
            if (!game.observed(e) && !ui.introObserves(e)) continue;
            let p = R.project(e.x, world.surface?.entityHeight(e) ?? 0, e.z);
            const v = R.viewport;
            if (p && (p.x < v.left - 220 || p.x > v.right + 220 || p.y < v.top - 260 || p.y > v.bottom + 260))
              continue;
            worldView.drawBuildingGround(e);
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
          renderBattlefieldEffects(R, game.effects, world, s, ui.pings, t, game.localTeam, weatherTime);
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
            if (game.s && ui.view === 'game' && !ui.paused && !game.s.result) {
              accumulator += dt * GAME_SPEED.base * game.s.speed;
              let steps = 0;
              while (accumulator >= SIMULATION_STEP_SECONDS && steps++ < 12) {
                game.step(SIMULATION_STEP_SECONDS);
                game.effects.tick(SIMULATION_STEP_SECONDS);
                accumulator -= SIMULATION_STEP_SECONDS;
                if (game.s.result) break;
              }
            } else accumulator = 0;
            diagnostics?.recorder.phase('ui');
            ui.tick(dt);
            ui.autosaveBattle();
            if (weatherState !== game.s) {
              weatherState = game.s;
              weatherTime = game.s?.time ?? 0;
            }
            // Only weather interpolates the local fixed-step remainder.
            // Keep its last pose when pausing; neither gameplay nor effect ages advance.
            if (game.s && ui.view === 'game' && !ui.paused && !game.s.result)
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
            // Keep simulation and UI clocks on every rAF.
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
              previewEntities(previewChange.map, previewChange.seed, previewChange.battle);
              previewChange.world = undefined;
              previewChange.phase = 'blend';
            }
            // Missed render slots are discarded, never drawn in a catch-up loop.
            frames++;
            if (frameClock >= 1) {
              fps = frames / frameClock;
              $('fpsReadout').textContent = `${Math.round(fps)} FPS`;
              frames = 0;
              frameClock = 0;
            }
            diagnostics?.recorder.phase('sceneBuild');
            if (ui.view !== 'game') worldView.clearWorkerRoads();
            const viewTime = game.s?.time,
              resultKey = ui.view === 'game' && game.s?.result && !ui.battleIntro && !ui.mode && !ui.pings.length
                ? [viewTime, weatherTime, R.width, R.height, R.quality, game.localTeam,
                    game.s.cam.x, game.s.cam.z, game.s.cam.zoom, game.s.cam.yaw,
                    game.world?.fogVersion, ui.hover, ...ui.selectionIds()].join('/') : null,
              retainResultScene = resultKey !== null && R.canRetainScene && retainedResult?.state === game.s &&
                retainedResult.world === game.world && retainedResult.key === resultKey;
            if (!retainResultScene) R.begin();
            if (retainResultScene) {
              // Result state and camera are stationary. Keep scene/bloom GPU targets
              // and the matching overlay; post grain and DOM animation remain live.
            } else if (ui.view === 'game' && game.s) battlefield(viewTime!);
            else if (ui.view === 'codexModel' && ui.codexSelection) {
              clearPlacementGuide();
              const {kind,type,faction} = ui.codexSelection;
              const d = kind === 'unit' ? UNITS[type as UnitType] : BUILDINGS[type as BuildingType];
              R.fogOn = false;
              R.camera(0,0,(kind === 'building' ? Math.max(21,d.size*4) : type === 'destroyer' ? 30 : 13) * ui.codexZoom);
              renderEntity(R, {id:7,kind,type,x:0,z:0,faction,team:0,hp:d.hp,maxHp:d.hp,size:d.size,
                rot:ui.codexModelRotation(dt),walk:time,progress:1,carry:0,amount:2200,shield:0,maxShield:0,kills:0},time,{localTeam:0});
            } else {
              clearPlacementGuide();
              R.fogOn = false;
              R.camera(previewCenter.x, previewCenter.z, 65, true, time);
              worldView.retainBuildingGround(preview);
              for (let e of preview) {
                worldView.drawBuildingGround(e);
                renderEntity(R, e, previewTime);
              }
            }
            diagnostics?.recorder.phase('glSubmission');
            // Simulation time freezes with pause/result and scales with game speed.
            // All saved home worlds freeze their atmosphere; landscapes without saves start at zero.
            R.setBattlefieldTime(ui.view === 'game' && game.s ? game.s.time : ui.view === 'home' ? previewTime : 0);
            // Saved battles use the battlefield sky, not the seed-only celestial backdrop.
            const menuWorld = ui.view === 'home' && !previewSavedBattle ? worldView.world : null;
            R.setMenuSky(menuWorld?.terrainSeed ?? null, menuWorld?.definition.render.groundTexture ?? '');
            R.render(time, ui.view === 'game' && game.s ? viewTime! : ui.view === 'codexModel' ? time : 0,
              ui.view === 'codex' ? () => thumbnails.update($('menu')) :
                ui.view === 'game' && !ui.modalKind ? () => thumbnails.update($('actionPanel')) : undefined, retainResultScene);
            retainedResult = resultKey === null ? null : { state: game.s!, world: game.world, key: resultKey };
            advancePreviewChange();
            // Never fade away the cover before the resized battlefield has rendered.
            if (battleExit) revealBattleDestination();
            else if (ui.view === 'game') revealBattlefield();
            else if (!ui.launchingBattle) clearBattleTransition();
            diagnostics?.recorder.phase('overlay');
            if (!retainResultScene) ui.drawOverlay(overlayContext);
            diagnostics?.finishFrame(true);
          } catch (error) {
            finishPreviewChange(false);
            clearBattleTransition();
            diagnostics?.stop('render-error');
            failed = true;
            console.error(error);
            ui.paused = true;
            ui.saveBattle();
            let loader = $('loading');
            loader.classList.remove('hidden');
            loader.innerHTML =
              '<div class="eyebrow">UPLINK INTERRUPTED</div><h2>The renderer encountered a problem.</h2><p>' +
              esc(error instanceof Error ? error.message : String(error)) +
              '</p><p>Reload this file to restore the last saved expedition battle or transition.</p>';
            return;
          }
          requestAnimationFrame(draw);
        }
        canvas.addEventListener('webglcontextlost', e => {
          e.preventDefault();
          finishPreviewChange(false);
          clearBattleTransition();
          diagnostics?.stop('context-lost');
          ui.paused = true;
          ui.saveBattle();
          $('loading').classList.remove('hidden');
          $('loading').innerHTML =
            '<div class="eyebrow">GRAPHICS CONNECTION LOST</div><h2>The graphics connection was lost.</h2><p>' +
            'Reload this file to restore the last saved expedition battle or transition.' +
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
          ui.expedition = { version: 7, battle: null, worlds: [], faction: 0, abilities: [...DEFAULT_ABILITY_LOADOUT], depth: 0, civilizationScore: 0, unlockedStage: 1,
            benefits: {pioneerSquad: 2}, enemyBenefits: [{}],
            encounter: {mission: DEFAULT_MISSION, deployment: 'resource-start', map: mapExperiment,
              seed: /^[1-9][0-9]{0,7}$/.test(params.get('seed') ?? '') ? Number(params.get('seed')) : 1409,
              enemies: [2]}, offers: [] };
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
