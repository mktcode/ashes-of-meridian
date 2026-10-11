import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { withBrowser } from '../browser/harness.mjs';
import { prepareScene } from '../scene-capture-fixture.mjs';
import { collectWindow, graphicsInfo, measureScene } from './browser.mjs';
import { classifyGraphics, validateMeasurement } from './results.mjs';

// One fresh page/context per case. The harness owns browser lifetime and scratch cleanup.
export async function captureCase(
  root,
  recipe,
  scenario,
  { requireHardware = false, onProgress = () => {}, headless = true, angle } = {},
) {
  const timeoutMs = 35000 + recipe.warmupMs + recipe.durationMs;
  return withBrowser(
    root,
    async (browser) => {
      const page = await browser.newPage({
        viewport: { width: recipe.scene.width ?? 960, height: recipe.scene.height ?? 720 },
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
      });
      page.setDefaultTimeout(30000);
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      const url = pathToFileURL(resolve(root, 'index.html'));
      url.search = 'diagnostics=1';
      onProgress('Loading file:// application');
      await page.goto(url.href);
      await page.waitForFunction(
        () =>
          window.Meridian?.diagnostics &&
          window.Meridian.renderer.frameReady() &&
          document.getElementById('loading').classList.contains('hidden'),
      );
      const graphics = await page.evaluate(graphicsInfo),
        backend = classifyGraphics(graphics);
      if (requireHardware && backend !== 'hardware-reported')
        throw Error(`Hardware renderer required; detected ${backend}`);
      const frame = await page.evaluate(() => window.Meridian.renderer.frame);
      const scene = { ...recipe.scene, hour: scenario.hour };
      onProgress(`Preparing ${recipe.army.count} units (${backend})`);
      const setup = await page.evaluate(prepareScene, scene);
      onProgress('Waiting for the prepared scene to render');
      await page.waitForFunction(
        (previous) =>
          window.Meridian.ui.view === 'game' &&
          window.Meridian.renderer.frame > previous &&
          window.Meridian.renderer.frameReady() &&
          document.getElementById('battleTransition').classList.contains('hidden') &&
          document.getElementById('loading').classList.contains('hidden'),
        frame,
      );
      const { anchors, extent } = await page.evaluate(() => {
        const game = window.Meridian.game;
        const anchors = Object.fromEntries(
          ['player', 'enemy'].map((name, team) => {
            const e = game.alive(
              (e) => e.kind === 'unit' && e.type === 'worker' && e.team === team,
            )[0];
            return [name, { x: e.x, z: e.z }];
          }),
        );
        return { anchors, extent: game.world.extent };
      });
      for (const action of recipe.interactions)
        if (action.kind === 'moveArmy') {
          const anchor =
            action.target.anchor === 'world' ? { x: 0, z: 0 } : anchors[action.target.anchor];
          if (
            Math.abs(anchor.x + action.target.x) > extent ||
            Math.abs(anchor.z + action.target.z) > extent
          )
            throw Error('Movement target outside map');
        }
      if (errors.length) throw Error(`Browser errors during setup: ${errors.join('\n')}`);
      onProgress('Paused warmup');
      // Real timers only. Warmup is paused, so all cases begin at the same simulation state.
      await page.evaluate(
        (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        recipe.warmupMs,
      );
      const armyIds = setup.placed.slice(recipe.armyOffset).map((e) => e.id);
      onProgress('Measuring with real browser time');
      const measurement = await page.evaluate(measureScene, {
        durationMs: recipe.durationMs,
        interactions: recipe.interactions,
        armyIds,
        anchors,
        paused: scenario.paused,
      });
      // The normal render loop polls asynchronous queries. Drain briefly outside the selected window.
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 250)));
      const diagnostic = await page.evaluate(collectWindow, measurement.range);
      validateMeasurement(measurement, diagnostic, scenario.paused);
      if (errors.length) throw Error(`Browser errors: ${errors.join('\n')}`);
      await page.evaluate(() => window.Meridian.diagnostics.stop());
      return {
        schema: 1,
        case: scenario,
        scene,
        setup,
        measurement,
        diagnostic,
        environment: {
          browser: browser.version(),
          mode: headless ? 'headless' : 'headed',
          angle: angle ?? 'default',
          graphics,
          backend,
        },
        notes: [
          'Arranged synthetic army on normal seeded terrain, not a saved player battle or balancing test.',
          'Real browser clock; loading/paused warmup and post-window GPU drain are excluded from recording summaries.',
          'GPU probe counters and callbacksSeen/eventsSeen remain session totals; only retained measurements/samples are window-filtered.',
          'Selection/movement use synchronous UI APIs, not real pointer input or input-to-visible-image latency.',
          'No explicit selection in warmup; the initial menu may already warm resources. Repeated selections may reuse portraits. Automation/diagnostic overhead remains.',
          'Renderer strings are reported by WebGL, not independent hardware verification. Software/unknown backends do not establish device FPS.',
          'Missing GPU timings are unavailable, never zero. Last queries may remain unresolved after the bounded drain.',
        ],
      };
    },
    { timeoutMs, headless, angle },
  );
}
