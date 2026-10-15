import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
const counts = process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [100, 500, 1000];
if (counts.some(n => !Number.isSafeInteger(n) || n < 1 || n > 2000)) throw new Error('Crowd counts must be integers from 1 to 2000');
const temp = '.tmp/crowd-render-measure'; mkdirSync(temp, { recursive: true });
for (const key of ['TMPDIR', 'TMP', 'TEMP']) process.env[key] = temp;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const gl = get.apply(this, args); if (args[0] !== 'webgl2' || !gl) return gl;
      window.gl = gl;
      for (const name of ['drawArrays', 'drawArraysInstanced', 'bufferSubData']) {
        const original = gl[name].bind(gl);
        gl[name] = (...values) => {
          if (name === 'bufferSubData') window.uploads++;
          else { window.draws++; if (name === 'drawArraysInstanced') window.instances += values[3]; }
          return original(...values);
        };
      }
      return gl;
    };
    const raf = window.requestAnimationFrame.bind(window);
    let wrapped = false;
    window.samples = [];
    window.requestAnimationFrame = callback => {
      if (!wrapped && callback.name === 'frame') {
        const update = CrowdSimulation.update;
        CrowdSimulation.update = (world, dt) => { window.world = world; return update(world, dt); };
        wrapped = true;
      }
      return raf(now => {
        if (callback.name !== 'frame') { callback(now); return; }
        // Identical held pose and paused physics, but every measured active frame rebuilds the rig.
        if (window.forceRig && window.world) window.world.stats.steps++;
        window.draws = window.instances = window.uploads = 0;
        const start = performance.now(); callback(now);
        if (window.draws) window.samples.push({ ms: performance.now() - start, draws: window.draws, instances: window.instances, uploads: window.uploads });
      });
    };
  });
  await page.goto(new URL('./index.html', import.meta.url).href);
  await page.waitForFunction(() => window.world && window.gl);
  await page.click('#pause');
  console.log(JSON.stringify(await page.evaluate(() => {
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return { map: CrowdTerrain.halfSize * 2, renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      physicsPaused: true, gpuOrFpsClaim: false };
  })));
  for (const requested of counts) {
    const actual = await page.evaluate(n => {
      world.marines = CrowdNavigation.spawnSites.slice(0, n).map(p => {
        const m = CrowdSimulation.createMarine(p.x, p.z); m.runWeight = m.previous.runWeight = 1; m.moving = true; return m;
      });
      world.accumulator = 0; window.forceRig = true; window.samples = [];
      return world.marines.length;
    }, requested);
    for (const mode of ['full-rig', 'cached-pause']) {
      if (mode === 'cached-pause') await page.evaluate(() => { window.forceRig = false; window.samples = []; });
      await page.waitForFunction(() => window.samples.length >= 12);
      const result = await page.evaluate(() => {
        const samples = window.samples.slice(3, 12), sorted = samples.map(s => s.ms).sort((a, b) => a - b);
        return { callbackP50Ms: sorted[Math.floor(sorted.length * 0.5)], callbackP95Ms: sorted[Math.floor(sorted.length * 0.95)],
          draws: samples.at(-1).draws, instances: samples.at(-1).instances, uploads: samples.at(-1).uploads, glError: gl.getError() };
      });
      if (result.glError) throw new Error(`WebGL error: ${result.glError}`);
      console.log(JSON.stringify({ requested, actual, mode, ...result }));
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); }
