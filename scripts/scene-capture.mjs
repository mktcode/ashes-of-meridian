import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { randomInt } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { withBrowser } from './browser/harness.mjs';
import { prepareItchCapturePaths, webpScreenshot } from './capture-output.mjs';
import { captureSchema, validateCapture, resolveShots } from './capture-recipe.mjs';
import { verifyCaptureBuild } from './build-info.mjs';
import { classifyGraphics } from './diagnostics/results.mjs';

const root = resolve(import.meta.dirname, '..');
const { values } = parseArgs({
  allowNegative: true,
  options: {
    scene: { type: 'string' },
    batch: { type: 'string' },
    output: { type: 'string' },
    map: { type: 'string' },
    seed: { type: 'string' },
    count: { type: 'string' },
    'selection-seed': { type: 'string' },
    content: { type: 'string' },
    fit: { type: 'string' },
    'camera-mode': { type: 'string' },
    projection: { type: 'string' },
    x: { type: 'string' },
    z: { type: 'string' },
    zoom: { type: 'string' },
    yaw: { type: 'string' },
    pitch: { type: 'string' },
    distance: { type: 'string' },
    fov: { type: 'string' },
    eye: { type: 'string' },
    target: { type: 'string' },
    up: { type: 'string' },
    width: { type: 'string' },
    height: { type: 'string' },
    hour: { type: 'string' },
    dpr: { type: 'string' },
    quality: { type: 'string' },
    hud: { type: 'boolean' },
    units: { type: 'boolean' },
    buildings: { type: 'boolean' },
    effects: { type: 'boolean' },
    caches: { type: 'boolean' },
    guides: { type: 'boolean' },
    reveal: { type: 'boolean' },
    'distance-mist': { type: 'boolean' },
    'horizon-mist': { type: 'boolean' },
    'reuse-build': { type: 'boolean' },
    angle: { type: 'string' },
    headed: { type: 'boolean' },
    'require-hardware': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});
if (values.help) {
  console.log(`Usage: npm run capture:scene -- [--scene recipe.json | --batch batch.json | --map desert --seed 1409]
  --content landscape|landing|arranged --fit map|entities --yaw <radians>
  --camera-mode orbit --pitch <radians> --projection perspective --fov <radians>
  --camera-mode lookAt --eye x,y,z --target x,y,z [--up x,y,z]
  --zoom <orthographic-height> | --distance <orbit-distance>
  --map random --count 3 [--selection-seed 123] --content landscape --fit map
  --no-units --no-buildings --no-distance-mist --hud --hour 13 --width 1920 --height 1080
  --output .tmp/<new-run> --reuse-build [--angle gl] [--headed]
Build once by default; reuse refuses stale/missing builds. One browser per bounded batch.
WebP quality 80 + per-image reports/index. Angles in radians. --scene also accepts viewer exports.`);
} else {
  if (values.scene && values.batch) throw Error('--scene and --batch are mutually exclusive');
  if (values.angle !== undefined && values.angle !== 'gl') throw Error('--angle must be gl');
  if ((values.scene || values.batch) && (values.count || values['selection-seed']))
    throw Error('Random selection options require direct map input');
  let scenes;
  if (values.scene) scenes = [JSON.parse(await readFile(resolve(values.scene), 'utf8'))];
  else if (values.batch) {
    const batch = JSON.parse(await readFile(resolve(values.batch), 'utf8'));
    if (!batch || Object.keys(batch).some((k) => k !== 'scenes') || !Array.isArray(batch.scenes))
      throw Error('Batch must contain only a scenes array');
    scenes = batch.scenes;
  } else {
    const maps = captureSchema().maps;
    const count = Number(values.count ?? 1);
    if (!Number.isInteger(count) || count < 1 || count > 16) throw Error('count must be 1–16');
    if (count > 1 && values.seed !== undefined)
      throw Error('A fixed --seed requires count 1; use --selection-seed for random batches');
    let state = Number(values['selection-seed']);
    if (
      values['selection-seed'] !== undefined &&
      (!Number.isInteger(state) || state < 1 || state > 99999999)
    )
      throw Error('Invalid selection seed');
    const draw = (max) => {
      if (values['selection-seed'] === undefined) return randomInt(max);
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) % max;
    };
    const pool = [...maps];
    scenes = Array.from({ length: count }, () => {
      if (!pool.length) pool.push(...maps);
      const map =
        values.map === 'random' ? pool.splice(draw(pool.length), 1)[0] : (values.map ?? 'desert');
      return {
        map,
        seed: values.seed === undefined ? draw(99999999) + 1 : Number(values.seed),
        content: values.content ?? 'landscape',
      };
    });
  }
  if (!scenes.length || scenes.length > 16) throw Error('Batch must contain 1–16 scenes');
  const cameraOverrides = {};
  for (const key of ['x', 'z', 'zoom', 'yaw', 'pitch', 'distance', 'fov'])
    if (values[key] !== undefined) cameraOverrides[key] = Number(values[key]);
  for (const key of ['eye', 'target', 'up'])
    if (values[key] !== undefined) cameraOverrides[key] = values[key].split(',').map(Number);
  if (values['camera-mode'] !== undefined) cameraOverrides.mode = values['camera-mode'];
  for (const key of ['fit', 'projection'])
    if (values[key] !== undefined) cameraOverrides[key] = values[key];
  const renderOverrides = {};
  for (const key of ['units', 'buildings', 'effects', 'caches', 'guides'])
    if (values[key] !== undefined) renderOverrides[key] = values[key];
  if (values['distance-mist'] !== undefined) renderOverrides.distanceMist = values['distance-mist'];
  if (values['horizon-mist'] !== undefined) renderOverrides.horizonMist = values['horizon-mist'];
  const override = (shot) => {
    const result = { ...shot, render: { ...shot.render, ...renderOverrides } };
    for (const key of ['width', 'height', 'hour', 'dpr', 'quality'])
      if (values[key] !== undefined) result[key] = Number(values[key]);
    for (const key of ['hud', 'reveal']) if (values[key] !== undefined) result[key] = values[key];
    if (Object.keys(cameraOverrides).length) {
      result.camera = {
        ...(values['camera-mode'] === undefined ? shot.camera : {}),
        ...cameraOverrides,
      };
      // A fit override replaces a previously explicit framing, not a simultaneous CLI framing.
      if (values.fit !== undefined) {
        if (values.zoom === undefined) delete result.camera.zoom;
        if (values.distance === undefined) delete result.camera.distance;
      } else if (values.zoom !== undefined || values.distance !== undefined)
        delete result.camera.fit;
    }
    return result;
  };
  scenes = scenes.map((scene) => {
    const resolved = override(scene);
    if (values.map !== undefined && values.map !== 'random' && (values.scene || values.batch))
      resolved.map = values.map;
    if (values.seed !== undefined && (values.scene || values.batch))
      resolved.seed = Number(values.seed);
    if (values.content !== undefined) resolved.content = values.content;
    if (scene.shots) resolved.shots = resolveShots(scene).map(override);
    validateCapture(resolved);
    return resolved;
  });
  const shotLists = scenes.map(resolveShots),
    total = shotLists.reduce((n, s) => n + s.length, 0);
  if (total > 64) throw Error('At most 64 images per batch');
  const requested = values.output && resolve(root, values.output),
    singleFile = requested?.endsWith('.webp');
  if (singleFile && total !== 1) throw Error('A .webp output path requires exactly one image');
  const paths = await prepareItchCapturePaths(root, singleFile ? dirname(requested) : requested);
  const timing = {},
    start = performance.now();
  try {
    const buildStart = performance.now();
    if (!values['reuse-build']) {
      // Keep all helper scratch in this invocation's own worktree.
      execFileSync('npm', ['run', 'build'], {
        cwd: root,
        stdio: 'inherit',
        timeout: 120000,
        env: { ...process.env, TMPDIR: paths.scratch, TMP: paths.scratch, TEMP: paths.scratch },
      });
    }
    verifyCaptureBuild(root);
    timing.buildMs = performance.now() - buildStart;
    const launchStart = performance.now(),
      reports = [];
    await withBrowser(
      root,
      async (browser) => {
        timing.browserStartMs = performance.now() - launchStart;
        const page = await browser.newPage({
          viewport: { width: 1920, height: 1080 },
          deviceScaleFactor: 1,
          reducedMotion: 'reduce',
        });
        page.setDefaultTimeout(30000);
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
          if (m.type() === 'error') errors.push(m.text());
        });
        const loadStart = performance.now(),
          url = pathToFileURL(resolve(root, 'index.html'));
        url.search = 'capture=1';
        await page.goto(url.href);
        await page.waitForFunction(
          () =>
            window.Meridian?.capture &&
            document.querySelector('#loading').classList.contains('hidden'),
        );
        timing.appLoadMs = performance.now() - loadStart;
        const graphics = await page.evaluate(() => {
          const g = Meridian.renderer.gl,
            ext = g.getExtension('WEBGL_debug_renderer_info');
          return {
            renderer: ext
              ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL)
              : g.getParameter(g.RENDERER),
            vendor: ext ? g.getParameter(ext.UNMASKED_VENDOR_WEBGL) : g.getParameter(g.VENDOR),
          };
        });
        graphics.backend = classifyGraphics(graphics);
        if (values['require-hardware'] && graphics.backend !== 'hardware-reported')
          throw Error(`Hardware renderer required; detected ${graphics.backend}`);
        for (const [i, scene] of scenes.entries()) {
          console.log(`Preparing ${scene.map} · seed ${scene.seed}`);
          const sceneStart = performance.now(),
            shots = shotLists[i],
            first = shots[0];
          await page.setViewportSize({ width: first.width ?? 1920, height: first.height ?? 1080 });
          const setup = await page.evaluate((scene) => Meridian.capture.prepare(scene), {
            ...scene,
            ...first,
          });
          const setupMs = performance.now() - sceneStart;
          for (const [j, shot] of shots.entries()) {
            const frameStart = performance.now();
            let state = setup;
            if (j > 0) {
              await page.setViewportSize({
                width: shot.width ?? 1920,
                height: shot.height ?? 1080,
              });
              state = await page.evaluate((shot) => Meridian.capture.apply(shot), {
                ...shot,
                hour: shot.hour ?? scene.hour ?? setup.startHour,
              });
            }
            const frameMs = j > 0 ? performance.now() - frameStart : setup.timing.frameMs;
            if (
              state.glError ||
              errors.length ||
              !state.paused ||
              state.time !== 0 ||
              state.request !== state.renderedRequest
            )
              throw Error(`Capture failed: ${JSON.stringify({ state, errors })}`);
            const file = singleFile
              ? requested
              : resolve(
                  paths.output,
                  `${String(i + 1).padStart(2, '0')}-${scene.map}-${scene.seed}-${shot.name}.webp`,
                );
            const imageTiming = {},
              image = await webpScreenshot(page, imageTiming);
            if (errors.length)
              throw Error(`Browser errors during image encoding: ${errors.join('\n')}`);
            await writeFile(file, image);
            const report = {
              scene,
              shot,
              setup,
              state,
              build: await page.evaluate(() => Meridian.build),
              browser: browser.version(),
              graphics,
              output: file,
              format: 'webp',
              quality: 80,
              timing: { setupMs, frameMs, ...imageTiming },
            };
            await writeFile(`${file}.json`, JSON.stringify(report, null, 2) + '\n');
            reports.push(report);
            console.log(file);
          }
        }
      },
      {
        timeoutMs: Math.min(600000, 30000 + scenes.length * 30000 + total * 15000),
        headless: !values.headed,
        angle: values.angle,
      },
    );
    timing.totalMs = performance.now() - start;
    await writeFile(
      resolve(paths.output, 'index.json'),
      JSON.stringify(
        {
          scenes,
          selectionSeed: values['selection-seed'] ?? null,
          timing,
          images: reports.map((r) => ({ output: r.output, timing: r.timing })),
        },
        null,
        2,
      ) + '\n',
    );
    console.log(`Capture timings: ${JSON.stringify(timing)}`);
  } finally {
    const { rm } = await import('node:fs/promises');
    await rm(paths.scratch, { recursive: true, force: true });
  }
}
