import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { prepareScene, validateScene } from './scene-capture-fixture.mjs';
import { webpScreenshot } from './capture-output.mjs';

const root = resolve(import.meta.dirname, '..');
const { values } = parseArgs({ options: {
  scene: { type: 'string' }, output: { type: 'string' },
  width: { type: 'string' }, height: { type: 'string' },
  hour: { type: 'string' }, hud: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' }
} });
if (values.help) {
  console.log('Usage: npm run capture:scene -- --scene scripts/scenes/model-lineup.json [--output .tmp/my-capture/scene.webp] [--width 1920 --height 1080] [--hour 22] [--hud]\nOne paused scene, WebP quality 80 + JSON report. Requires Chromium (CHROMIUM_PATH optional).');
} else {
  if (!values.scene) throw Error('--scene is required; see --help');
  const scene = JSON.parse(await readFile(resolve(values.scene), 'utf8'));
  for (const key of ['width', 'height', 'hour']) if (values[key] !== undefined) scene[key] = Number(values[key]);
  if (values.hud !== undefined) scene.hud = values.hud;
  validateScene(scene);
  const output = resolve(values.output ?? resolve(root, '.tmp', `scene-capture-${Date.now()}`, 'scene.webp'));
  if (!output.endsWith('.webp')) throw Error('--output must end in .webp');
  // Browser profiles and scratch always belong to this worktree and this invocation.
  const scratch = resolve(root, '.tmp', `scene-capture-runtime-${Date.now()}-${process.pid}`);
  await mkdir(scratch, { recursive: true });
  process.chdir(scratch);
  // Chromium's Unix singleton socket has a ~108-byte path limit. /proc is
  // only a short alias to our own cwd, not a shared external scratch directory.
  const tempPath = process.platform === 'linux' && scratch.length > 55 ? `/proc/${process.pid}/cwd` : scratch;
  process.env.TMPDIR = process.env.TMP = process.env.TEMP = tempPath;
  const { chromium } = await import('playwright-core');
  let executablePath;
  for (const candidate of [process.env.CHROMIUM_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].filter(Boolean)) {
    try { await access(candidate, constants.X_OK); executablePath = candidate; break; } catch {}
  }
  if (!executablePath) throw Error('Chromium not found; set CHROMIUM_PATH.');
  const browser = await chromium.launch({ executablePath, headless: true, chromiumSandbox: true });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: scene.width ?? 1920, height: scene.height ?? 1080 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    page.setDefaultTimeout(30000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(pathToFileURL(resolve(root, 'index.html')).href);
    await page.waitForFunction(() => window.Meridian && document.querySelector('#loading').classList.contains('hidden'));
    const result = await page.evaluate(prepareScene, scene);
    await page.addStyleTag({ content: `#toast,#radio,#modal,#alerts{display:none!important}${scene.hud ? '' : '#hud,#overlay{display:none!important}'}` });
    // Pause the browser clock after preparation; advance a bounded render window only.
    const clockTime = Date.now();
    await page.clock.install({ time: clockTime });
    // pauseAt fast-forwards (does not replay every frame). Leave enough
    // headroom for slow/software-GPU setup before this command reaches the page.
    await page.clock.pauseAt(clockTime + 60000);
    await page.clock.runFor(100);
    await page.waitForFunction(() => document.querySelector('#battleTransition').classList.contains('hidden') && Meridian.renderer.frameReady());
    const state = await page.evaluate(() => ({ glError: Meridian.renderer.gl.getError(), time: Meridian.game.s.time,
      paused: Meridian.ui.paused, hour: Meridian.renderer.battlefieldHour, camera: { ...Meridian.game.s.cam } }));
    if (state.glError || errors.length || !state.paused || state.time !== result.time)
      throw Error(`Capture failed: ${JSON.stringify(state)}; ${errors.join('\n')}`);
    const image = await webpScreenshot(page);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, image);
    await writeFile(`${output}.json`, JSON.stringify({ scene, result, state, browser: browser.version(), output, format: 'webp', quality: 80 }, null, 2) + '\n');
    console.log(output);
  } finally { await browser.close(); }
}
