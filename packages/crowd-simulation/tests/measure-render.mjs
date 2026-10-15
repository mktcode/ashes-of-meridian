import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
const counts = process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [100, 500, 1000];
if (counts.some(n => !Number.isSafeInteger(n) || n < 1 || n > 2000)) throw new Error('Crowd counts must be integers from 1 to 2000');
process.chdir(fileURLToPath(new URL('../../../', import.meta.url)));
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
    window.samples = [];
    window.requestAnimationFrame = callback => raf(now => {
      if (callback.name !== 'frame') { callback(now); return; }
      if (window.forceRig && window.CrowdDemo) CrowdDemo.invalidateRendering();
      window.draws = window.instances = window.uploads = 0;
      const start = performance.now(); callback(now);
      if (window.draws) window.samples.push({ ms: performance.now() - start, draws: window.draws, instances: window.instances, uploads: window.uploads });
    });
  });
  await page.goto(new URL('../demo/index.html', import.meta.url).href);
  await page.waitForFunction(() => window.CrowdDemo && window.gl);
  await page.click('#pause');
  console.log(JSON.stringify(await page.evaluate(() => {
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return { map: CrowdTerrain.halfSize * 2, renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      physicsPaused: true, pose: 'actual locomotion after 60 setup ticks', gpuOrFpsClaim: false };
  })));
  for (const requested of counts) {
    const setup = await page.evaluate(n => {
      const crowd = CrowdDemo.crowd, data = MeridianCrowd.createCrowdFrameBuffer();
      crowd.command({ kind: 'hold', group: 0 }); crowd.writeFrame(data, 1);
      crowd.removeAgents(Array.from(data.ids.subarray(0, data.count)));
      const result = crowd.spawn(0, n), command = crowd.command({ kind: 'move', group: 0, destination: { x: 20, z: -6 } });
      for (let i = 0; i < 60; i++) crowd.step();
      window.forceRig = true; window.samples = [];
      return { actual: result.agents.length, commandAccepted: command.ok, tick: crowd.tick };
    }, requested);
    if (!setup.commandAccepted || setup.actual !== requested) throw new Error('Measurement setup rejected');
    await page.click('#focus');
    for (const mode of ['full-rig', 'cached-pause']) {
      await page.evaluate(full => { window.forceRig = full; window.samples = []; }, mode === 'full-rig');
      await page.waitForFunction(() => window.samples.length >= 12);
      const result = await page.evaluate(() => {
        const samples = window.samples.slice(3, 12), sorted = samples.map(s => s.ms).sort((a, b) => a - b);
        return { callbackP50Ms: sorted[Math.floor(sorted.length * 0.5)], callbackP95Ms: sorted[Math.floor(sorted.length * 0.95)],
          draws: samples.at(-1).draws, instances: samples.at(-1).instances, uploads: samples.at(-1).uploads, glError: gl.getError(), tick: CrowdDemo.crowd.tick };
      });
      if (result.glError || result.tick !== setup.tick) throw new Error('WebGL error or supposedly paused physics advanced');
      console.log(JSON.stringify({ requested, ...setup, mode, ...result }));
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); }
