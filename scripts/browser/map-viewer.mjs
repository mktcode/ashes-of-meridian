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
    await page.mouse.move(480, 350);
    await page.mouse.wheel(0, 300);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(560, 350, { steps: 4 });
    await page.mouse.up({ button: 'right' });
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(620, 350, { steps: 4 });
    await page.mouse.up({ button: 'middle' });
    await ready();
    const after = await page.evaluate(() => window.Meridian.capture.report());
    assert.ok(after.stateCamera.zoom > before.state.stateCamera.zoom);
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
    const restored = await page.evaluate(() => Array.from(window.Meridian.renderer.vp));
    matrix.forEach((n, i) => assert.ok(Math.abs(n - restored[i]) < 1e-4));
    await page.setViewportSize({ width: 640, height: 720 });
    await ready();
    await page.locator('[data-viewer="reset"]').click();
    await ready();
    const fits = await page.evaluate(() => {
      const { capture, renderer: r } = window.Meridian,
        v = r.viewport;
      return capture.bounds('map').every((p) => {
        const q = r.project(...p);
        return q && q.x >= v.left && q.x <= v.right && q.y >= v.top && q.y <= v.bottom;
      });
    });
    assert.equal(fits, true);
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
    assert.deepEqual(await page.evaluate(() => window.viewerStorageCalls), []);
    assert.deepEqual(errors, []);
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
      'Map viewer file://, profile isolation, paused mouse/touch navigation, zoom, idle rendering, export, resize/fit, seed reload and visible context-loss handling passed.',
    );
  },
  { timeoutMs: 60000 },
);
