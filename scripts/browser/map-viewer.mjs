import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { withBrowser } from './harness.mjs';

// Explicit technical check, not a screenshot series or an automatic spectator run.
const root = resolve(import.meta.dirname, '../..');
await withBrowser(
  root,
  async (browser) => {
    const page = await browser.newPage({
      viewport: { width: 960, height: 540 },
      deviceScaleFactor: 1,
      hasTouch: true,
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.addInitScript(() => {
      window.viewerStorageCalls = [];
      for (const name of ['getItem', 'setItem', 'removeItem']) {
        const method = Storage.prototype[name];
        Storage.prototype[name] = function (...args) {
          window.viewerStorageCalls.push({ name, key: args[0] });
          return method.apply(this, args);
        };
      }
    });
    const url = pathToFileURL(resolve(root, 'map-viewer.html'));
    url.search = 'map=desert&seed=1409';
    await page.goto(url.href);
    const ready = () =>
      page.waitForFunction(
        () =>
          window.Meridian?.capture.readyToDraw &&
          !window.Meridian.capture.busy &&
          window.Meridian.capture.renderedRequest === window.Meridian.capture.request,
      );
    await ready();
    const before = await page.evaluate(() => ({
      state: window.Meridian.capture.report(),
      cameraLocked: window.Meridian.ui.cameraControlsLocked,
      actionsLocked: window.Meridian.ui.controlsLocked,
    }));
    assert.equal(before.cameraLocked, false);
    assert.equal(before.actionsLocked, true);
    assert.equal(before.state.units, 0);
    assert.equal(before.state.buildings, 0);
    assert.equal(before.state.render.horizonMist, false);
    assert.equal(before.state.render.mapBoundary, true);
    const boundary = page.locator('#mapViewer input[name="boundary"]');
    const overlayHasPixels = () =>
      page.evaluate(() => {
        const canvas = document.querySelector('#overlay'),
          data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < data.length; i += 4) if (data[i]) return true;
        return false;
      });
    assert.equal(await boundary.isChecked(), true);
    assert.equal(await overlayHasPixels(), true);
    await boundary.uncheck();
    await ready();
    assert.equal(await overlayHasPixels(), false);
    await page.locator('#mapDiagnostics summary').click();
    assert.equal(await page.locator('[data-viewer="report"]').isDisabled(), true);
    assert.equal(await page.evaluate(() => window.Meridian.capture.mapDiagnostics.data), undefined);
    await page.evaluate(() => {
      const { game } = window.Meridian,
        w = game.world;
      window.viewerDiagnosticSignature = () =>
        JSON.stringify({
          heights: w.surface.heights,
          cliffs: w.surface.cliffs,
          static: w.staticGrid,
          blocked: w.blocked,
          layout: w.layout,
          entities: game.s.entities,
          time: game.s.time,
        });
      window.viewerDiagnosticBaseline = window.viewerDiagnosticSignature();
      window.viewerDiagnosticFrame = window.Meridian.renderer.frame;
    });
    await page.locator('[data-viewer="analyze"]').click();
    await ready();
    const diagnostic = await page.evaluate(() => window.Meridian.capture.exportMapDiagnostics());
    assert.equal(diagnostic.map, 'desert');
    assert.equal(diagnostic.seed, 1409);
    assert.equal(diagnostic.build.id, await page.evaluate(() => window.Meridian.build.id));
    assert.equal(diagnostic.economy.accessibleAnchors, diagnostic.economy.anchors);
    assert.ok(diagnostic.broad.interiorCoverage >= 0.55);
    assert.equal(await overlayHasPixels(), true);
    await page.locator('[data-layer="connections"]').uncheck();
    await ready();
    assert.equal(await overlayHasPixels(), false);
    for (const layer of ['cliffs', 'foundations', 'economy', 'starts']) {
      const control = page.locator(`[data-layer="${layer}"]`);
      await control.check();
      await ready();
      assert.equal(await overlayHasPixels(), true, `${layer} has projected annotations`);
      await control.uncheck();
      await ready();
      assert.equal(await overlayHasPixels(), false);
    }
    assert.equal(
      await page.evaluate(
        () => window.viewerDiagnosticBaseline === window.viewerDiagnosticSignature(),
      ),
      true,
    );
    assert.equal(
      await page.evaluate(() => window.Meridian.renderer.frame),
      await page.evaluate(() => window.viewerDiagnosticFrame),
      'diagnostic layer changes redraw annotations without rendering the 3D world',
    );
    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-viewer="report"]').click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'desert-1409-diagnostics.json');
    assert.equal(await download.failure(), null);
    await page.locator('[data-layer="economy"]').check();
    await ready();
    await page.locator('#mapDiagnostics summary').click();
    await boundary.check();
    await ready();
    assert.equal(await overlayHasPixels(), true);
    assert.equal(await page.evaluate(() => window.Meridian.renderer.fogOn), false);
    assert.equal(await page.evaluate(() => window.Meridian.renderer.horizonMist), false);
    const clock = page.locator('#mapViewerTime');
    await clock.focus();
    await page.keyboard.press('Home');
    await ready();
    assert.equal(await page.locator('#mapViewer output').textContent(), '00:00');
    assert.ok(Math.abs(await page.evaluate(() => window.Meridian.renderer.battlefieldHour)) < 1e-6);
    const nightHaze = await page.evaluate(() => Array.from(window.Meridian.renderer.haze));
    await clock.evaluate((el) => {
      el.value = '720';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await ready();
    assert.equal(await page.locator('#mapViewer output').textContent(), '12:00');
    assert.ok(
      Math.abs((await page.evaluate(() => window.Meridian.renderer.battlefieldHour)) - 12) < 1e-6,
    );
    assert.notDeepEqual(
      await page.evaluate(() => Array.from(window.Meridian.renderer.haze)),
      nightHaze,
    );
    assert.equal(await page.evaluate(() => window.Meridian.game.s.time), 0);
    assert.equal(await page.evaluate(() => window.Meridian.ui.paused), true);
    await page.mouse.move(480, 350);
    await page.mouse.wheel(0, -300);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(560, 350, { steps: 4 });
    await page.mouse.up({ button: 'right' });
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(620, 350, { steps: 4 });
    await page.mouse.up({ button: 'middle' });
    await ready();
    const after = await page.evaluate(() => window.Meridian.capture.report());
    assert.ok(after.stateCamera.zoom < before.state.stateCamera.zoom);
    assert.notEqual(after.stateCamera.x, before.state.stateCamera.x);
    assert.notEqual(after.stateCamera.yaw, 0);
    const touch = await page.context().newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: 350, y: 350, id: 1 },
        { x: 600, y: 350, id: 2 },
      ],
    });
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: 300, y: 320, id: 1 },
        { x: 650, y: 380, id: 2 },
      ],
    });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await ready();
    const touched = await page.evaluate(() => window.Meridian.capture.report());
    assert.notEqual(touched.stateCamera.zoom, after.stateCamera.zoom);
    assert.notEqual(touched.stateCamera.yaw, after.stateCamera.yaw);
    assert.equal(touched.time, 0);
    const frame = await page.evaluate(() => window.Meridian.renderer.frame);
    // This bounded wait specifically verifies that idle rendering has stopped.
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.Meridian.renderer.frame), frame);
    const recipe = await page.evaluate(() => window.Meridian.capture.exportScene()),
      matrix = await page.evaluate(() => Array.from(window.Meridian.renderer.vp));
    await page.evaluate((camera) => window.Meridian.capture.apply({ camera }), recipe.camera);
    assert.ok(Math.abs(recipe.hour - 12) < 1e-6);
    assert.equal(recipe.render.mapBoundary, true);
    assert.equal(
      Object.hasOwn(recipe, 'diagnostics'),
      false,
      'viewer analysis is not a capture-recipe field',
    );
    const restored = await page.evaluate(() => Array.from(window.Meridian.renderer.vp));
    matrix.forEach((n, i) => assert.ok(Math.abs(n - restored[i]) < 1e-4));
    await page.setViewportSize({ width: 640, height: 720 });
    await ready();
    await page.locator('[data-viewer="reset"]').click();
    await ready();
    const covered = await page.evaluate(() => {
      const { game, renderer: r } = window.Meridian,
        v = r.viewport,
        fields = game.world.renderData.geometries.filter((d) => d.relief).map((d) => d.relief),
        extent = Math.max(...fields.map((f) => f.extent)),
        yaw = game.s.cam.yaw;
      let low = 0,
        high = game.world.surface.maxHeight;
      for (const field of fields)
        for (const h of field.heights) {
          low = Math.min(low, h);
          high = Math.max(high, h);
        }
      for (const x of [v.left, v.right])
        for (const y of [v.top, v.bottom]) {
          const p = r.ground(x, y, false);
          for (const h of [low, high]) {
            if (
              Math.abs(p.x + (Math.sin(yaw) * h * 0.82) / 1.1) > extent - 1 ||
              Math.abs(p.z + (Math.cos(yaw) * h * 0.82) / 1.1) > extent - 1
            )
              return false;
          }
        }
      return true;
    });
    assert.equal(covered, true, 'resized overview keeps every ground ray inside finite scenery');
    assert.equal(await page.evaluate(() => window.Meridian.ui.cameraControlsLocked), false);
    await page.evaluate(() => {
      window.Meridian.ui.resume();
      window.Meridian.ui.pause();
    });
    assert.equal(await page.evaluate(() => window.Meridian.ui.paused), true);
    await page.locator('[data-viewer="hide"]').click();
    assert.equal(await page.locator('#mapViewer').isVisible(), false);
    await page.locator('#showMapViewer').click();
    await page.locator('input[name="seed"]').fill('1410');
    await page.locator('#mapViewer button').filter({ hasText: 'Load' }).click();
    await page.waitForFunction(
      () => window.Meridian.game.s.seed === 1410 && !window.Meridian.capture.busy,
    );
    await ready();
    assert.equal(await page.evaluate(() => window.Meridian.game.s.time), 0);
    assert.ok(
      Math.abs((await page.evaluate(() => window.Meridian.renderer.battlefieldHour)) - 12) < 1e-6,
    );
    assert.equal(await page.locator('#mapViewer output').textContent(), '12:00');
    const reloadedDiagnostic = await page.evaluate(() =>
      window.Meridian.capture.exportMapDiagnostics(),
    );
    assert.equal(reloadedDiagnostic.seed, 1410);
    assert.equal(await page.locator('[data-layer="economy"]').isChecked(), true);
    assert.equal(
      await page
        .locator('[data-diagnostic-report]')
        .textContent()
        .then((t) => t.includes('seed 1410')),
      true,
    );
    assert.equal(await boundary.isChecked(), true);
    assert.equal(await overlayHasPixels(), true);
    assert.equal(await page.evaluate(() => window.Meridian.renderer.fogOn), false);
    assert.equal(await page.evaluate(() => window.Meridian.renderer.horizonMist), false);
    assert.deepEqual(await page.evaluate(() => window.viewerStorageCalls), []);
    assert.deepEqual(errors, []);
    // Bypass HTML validation to exercise the load-error path without another world build.
    await page.evaluate(() => {
      document.querySelector('#mapViewer input[name="seed"]').value = '0';
      document
        .querySelector('#mapViewer form')
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await ready();
    assert.equal(await page.locator('[data-viewer="report"]').isDisabled(), true);
    assert.equal(await page.locator('[data-layer="economy"]').isDisabled(), true);
    assert.equal(await page.evaluate(() => window.Meridian.capture.mapDiagnostics.data), undefined);
    assert.equal(
      await page.evaluate(() => window.Meridian.game.s.seed),
      1410,
      'failed input never replaces the seed',
    );
    await page.evaluate(() =>
      window.Meridian.renderer.gl.getExtension('WEBGL_lose_context').loseContext(),
    );
    await page.waitForFunction(
      () =>
        !document.querySelector('#loading').classList.contains('hidden') &&
        /graphics connection.*lost/i.test(document.querySelector('#loading').textContent),
    );
    assert.equal(await page.evaluate(() => window.Meridian.game.s.time), 0);
    assert.deepEqual(await page.evaluate(() => window.viewerStorageCalls), []);
    console.log(
      'Map viewer file://, profile isolation, paused mouse/touch navigation, zoom, terrain-following dashed map-boundary toggle/export, read-only cached map diagnostics, layer toggles/report download/reload/error invalidation, unmasked landscape borders, day-time slider/export/reload, idle rendering, export, resize/fit, seed reload and visible context-loss handling passed.',
    );
  },
  { timeoutMs: 60000 },
);
