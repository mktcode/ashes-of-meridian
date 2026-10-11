import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { withBrowser } from './harness.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
if (process.argv.length > 2)
  throw Error('Usage: node scripts/browser/smoke.mjs (CHROMIUM_PATH optional)');
const report = await withBrowser(root, async (browser) => {
  const page = await browser.newPage({
    viewport: { width: 960, height: 720 },
    reducedMotion: 'reduce',
  });
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(pathToFileURL(resolve(root, 'index.html')).href);
  await page.waitForFunction(
    () =>
      window.Meridian?.renderer.frame > 0 &&
      window.Meridian.renderer.frameReady() &&
      document.querySelector('#loading').classList.contains('hidden'),
  );
  const state = await page.evaluate(async () => {
    const renderer = window.Meridian.renderer,
      gl = renderer.gl;
    const programs = [
      'program',
      'depthProg',
      'occlusionProg',
      'skyProg',
      'postProg',
      'bloomProg',
    ].map((name) => [name, renderer[name]]);
    programs.push(...Object.entries(renderer.materialPrograms));
    if (renderer.menuSky)
      for (const name of ['sky', 'body', 'copy'])
        programs.push([`menuSky.${name}`, renderer.menuSky[name]]);
    for (const [name, program] of programs) {
      if (!gl.isProgram(program) || !gl.getProgramParameter(program, gl.LINK_STATUS))
        throw Error(`Unlinked shader program ${name}: ${gl.getProgramInfoLog(program)}`);
    }
    if (gl.getError() !== gl.NO_ERROR) throw Error('WebGL error after startup/render');
    const loss = gl.getExtension('WEBGL_lose_context');
    if (!loss) throw Error('Cannot verify context-loss handling: WEBGL_lose_context unavailable');
    loss.loseContext();
    await new Promise((done) => setTimeout(done, 100));
    const frame = renderer.frame;
    await new Promise((done) => setTimeout(done, 100));
    if (
      !gl.isContextLost() ||
      renderer.frame !== frame ||
      document.querySelector('#loading').classList.contains('hidden')
    )
      throw Error('Context loss did not stop rendering and expose recovery UI');
    return { linkedPrograms: programs.length, contextLossHandled: true };
  });
  if (errors.length) throw Error(`Browser errors: ${errors.join('\n')}`);
  if (new URL(page.url()).protocol !== 'file:')
    throw Error('Startup left the file:// delivery path');
  return { browser: browser.version(), protocol: new URL(page.url()).protocol, ...state };
});
console.log(JSON.stringify(report, null, 2));
