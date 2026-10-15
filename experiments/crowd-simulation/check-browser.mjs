import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';

// Relative private temp paths avoid Chromium's Unix socket path-length limit.
const temp = '.tmp/crowd-browser'; mkdirSync(temp, { recursive: true });
for (const key of ['TMPDIR', 'TMP', 'TEMP']) process.env[key] = temp;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const gl = get.apply(this, args); if (args[0] !== 'webgl2' || !gl) return gl;
      window.gl = gl; window.uploads = 0; window.frames = 0;
      const upload = gl.bufferSubData.bind(gl);
      gl.bufferSubData = (target, offset, data, ...rest) => {
        window.instanceBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
        window.instanceData = Array.from(data); window.uploads++;
        return upload(target, offset, data, ...rest);
      };
      const draw = gl.drawArraysInstanced.bind(gl);
      gl.drawArraysInstanced = (...values) => { window.drawCount = values[3]; window.frames++; return draw(...values); };
      return gl;
    };
    const raf = window.requestAnimationFrame.bind(window);
    let wrapped = false;
    window.requestAnimationFrame = callback => {
      if (!wrapped && callback.name === 'frame') {
        const update = CrowdSimulation.update;
        CrowdSimulation.update = (world, dt) => { window.world = world; return update(world, dt); };
        wrapped = true;
      }
      return raf(callback);
    };
  });
  await page.goto(new URL('./index.html', import.meta.url).href);
  await page.waitForFunction(() => window.world && window.instanceData && window.frames >= 2);
  await page.click('#pause');
  assert.equal(await page.getAttribute('#pause', 'aria-pressed'), 'true');
  await page.locator('#speed').fill('5');
  assert.equal(await page.inputValue('#speed'), '5');
  assert.equal(await page.textContent('#speed-value'), '5.00×');
  await page.locator('#speed').fill('1');
  assert.equal(await page.textContent('#speed-value'), '1.00×');
  const initial = await page.evaluate(() => {
    const m = CrowdSimulation.createMarine(-3, -2);
    Object.assign(m, { yaw: 0.4, time: 1.4, runWeight: 0.7 });
    Object.assign(m.previous, { x: -3.4, z: -2.3, yaw: 0.1, time: 1.2, runWeight: 0.3 });
    world.marines = [m]; world.accumulator = 1 / 120;
    return window.frames;
  });
  await page.waitForFunction(n => window.frames > n, initial);
  await page.click('#focus');
  const check = await page.evaluate(() => {
    const gl = window.gl, core = CrowdSimulation, renderer = MarineInstances, m = core.renderMarine(world, world.marines[0]);
    const packed = renderer.create(); packed.begin(MarineModel.parts.length); packed.marine(m);
    const gpu = new Float32Array(window.drawCount * renderer.stride);
    gl.bindBuffer(gl.ARRAY_BUFFER, window.instanceBuffer); gl.getBufferSubData(gl.ARRAY_BUFFER, 0, gpu);
    const start = CrowdNavigation.obstacles.length * renderer.stride;
    let maxError = 0;
    for (let i = 0; i < packed.count * renderer.stride; i++) maxError = Math.max(maxError, Math.abs(gpu[start + i] - packed.data[i]));
    const program = gl.getParameter(gl.CURRENT_PROGRAM), uniform = name => gl.getUniform(program, gl.getUniformLocation(program, name));
    const feet = [];
    for (const name of ['leftBoot', 'rightBoot']) {
      const index = MarineModel.parts.findIndex(p => p.name === name), matrix = gpu.slice(start + index * renderer.stride, start + index * renderer.stride + 16);
      let min = Infinity;
      for (const x of [-0.5, 0, 0.5]) for (const z of [-0.5, 0, 0.5]) {
        const px = matrix[0] * x - matrix[4] * 0.5 + matrix[8] * z + matrix[12];
        const py = matrix[1] * x - matrix[5] * 0.5 + matrix[9] * z + matrix[13];
        const pz = matrix[2] * x - matrix[6] * 0.5 + matrix[10] * z + matrix[14];
        min = Math.min(min, py - CrowdTerrain.heightAt(px, pz));
      }
      feet.push(min);
    }
    return { maxError, feet, interpolation: { x: m.x, z: m.z, time: m.time, runWeight: m.runWeight },
      actualY: m.y, terrainY: CrowdTerrain.heightAt(m.x, m.z), error: gl.getError(), depth: uniform('depthRange'),
      bufferBound: gl.getVertexAttrib(2, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING) === window.instanceBuffer,
      divisors: [2, 3, 4, 5, 6].map(i => gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_DIVISOR)),
      offsets: [2, 3, 4, 5, 6].map(i => gl.getVertexAttribOffset(i, gl.VERTEX_ATTRIB_ARRAY_POINTER)),
      strides: [2, 3, 4, 5, 6].map(i => gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_STRIDE)) };
  });
  assert.equal(check.maxError, 0); assert.equal(check.error, 0); assert.equal(check.bufferBound, true);
  assert.deepEqual(check.divisors, [1, 1, 1, 1, 1]); assert.deepEqual(check.offsets, [0, 16, 32, 48, 64]); assert.deepEqual(check.strides, [76, 76, 76, 76, 76]);
  assert.ok(check.depth > 200); assert.equal(check.actualY, check.terrainY);
  assert.ok(Math.abs(check.interpolation.x + 3.2) < 1e-10 && Math.abs(check.interpolation.z + 2.15) < 1e-10);
  assert.ok(Math.abs(check.interpolation.time - 1.3) < 1e-10 && Math.abs(check.interpolation.runWeight - 0.5) < 1e-10);
  assert.ok(check.feet.every(v => v > -0.001) && Math.min(...check.feet) < 0.04, 'actual GPU boot matrices retain terrain contact');
  const paused = await page.evaluate(() => ({ frame: window.frames, uploads: window.uploads, state: JSON.stringify(world.marines) }));
  await page.waitForFunction(n => window.frames > n + 3, paused.frame);
  assert.deepEqual(await page.evaluate(() => ({ uploads: window.uploads, state: JSON.stringify(world.marines) })), { uploads: paused.uploads, state: paused.state });
  if (process.env.CROWD_CAPTURE) {
    const conversion = spawnSync('magick', ['png:-', '-quality', '80', `${temp}/instance-frame.webp`], { input: await page.screenshot() });
    if (conversion.error || conversion.status !== 0) throw new Error('Optional WebP capture requires ImageMagick');
  }

  async function clickPoint(x, z, obstacle = false) {
    const pixel = await page.evaluate(({ x, z, obstacle }) => {
      const gl = window.gl, program = gl.getParameter(gl.CURRENT_PROGRAM), u = name => gl.getUniform(program, gl.getUniformLocation(program, name));
      const b = document.querySelector('canvas').getBoundingClientRect(), center = u('center'), right = u('right'), up = u('up'), scale = u('scale');
      const y = obstacle ? CrowdNavigation.obstacles[0].baseY + CrowdNavigation.obstacles[0].height : CrowdTerrain.heightAt(x, z);
      const p = [x - center[0], y - center[1], z - center[2]], dot = a => p.reduce((sum, v, i) => sum + v * a[i], 0);
      return { x: b.left + (dot(right) * scale[0] + 1) * b.width / 2, y: b.top + (1 - dot(up) * scale[1]) * b.height / 2 };
    }, { x, z, obstacle });
    await page.mouse.click(pixel.x, pixel.y);
  }
  await clickPoint(-4.5, -2.5);
  assert.ok(await page.evaluate(() => world.groups[0].destination && Math.hypot(world.groups[0].destination.x + 4.5, world.groups[0].destination.z + 2.5) < 0.03));
  const command = await page.evaluate(() => JSON.stringify({ destination: world.groups[0].destination, slots: [...world.groups[0].reservedSlots], units: world.marines }));
  await clickPoint(2.5, 0, true);
  assert.equal(await page.evaluate(() => JSON.stringify({ destination: world.groups[0].destination, slots: [...world.groups[0].reservedSlots], units: world.marines })), command);
  assert.ok(await page.evaluate(() => Boolean(world.notice)), 'native top-face click rejects the visible obstacle');
  const beforePan = await page.evaluate(() => ({ state: JSON.stringify(world.marines), frame: window.frames }));
  const canvas = await page.locator('canvas').boundingBox();
  await page.keyboard.down('Shift'); await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.mouse.down(); await page.mouse.move(canvas.x + canvas.width / 2 + 45, canvas.y + canvas.height / 2 + 25); await page.mouse.up(); await page.keyboard.up('Shift');
  assert.equal(await page.evaluate(() => JSON.stringify(world.marines)), beforePan.state, 'pan never commands or moves units');

  const old = await page.evaluate(() => JSON.stringify(world.marines[0]));
  await page.click('#spawn-thousand');
  assert.equal(await page.textContent('#unit-count'), '1001');
  assert.equal(await page.evaluate(() => JSON.stringify(world.marines[0])), old);
  assert.equal(await page.evaluate(() => world.stats.fieldBuilds), 1);
  assert.equal(await page.evaluate(() => new Set(world.marines.map(m => m.target)).size), 1001);
  await page.click('#reset');
  await page.waitForFunction(() => window.drawCount === CrowdNavigation.obstacles.length + 2 + world.marines.length * MarineModel.parts.length);
  const frozen = await page.evaluate(() => JSON.stringify(world.marines));
  await page.click('#focus'); await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2); await page.mouse.wheel(0, -2000);
  await page.waitForFunction(() => window.drawCount < world.marines.length * MarineModel.parts.length);
  assert.equal(await page.evaluate(() => JSON.stringify(world.marines)), frozen, 'culling and zoom do not alter simulation');
  const arrival = await page.evaluate(() => {
    const core = CrowdSimulation, nav = CrowdNavigation, goal = { x: 0, z: 7 };
    if (!core.moveTo(world, goal)) throw new Error('Central browser command rejected');
    const hidden = world.marines.filter(m => !nav.canTravel(goal.x, goal.z, m.target.x, m.target.z));
    const m = hidden[0], field = world.groups[0].field, target = m.target;
    world.marines = [m]; m.x = goal.x; m.z = goal.z; m.y = CrowdTerrain.heightAt(m.x, m.z);
    Object.assign(m.previous, { x: m.x, z: m.z });
    const before = world.stats.recoveryAttempts;
    let tick = 0;
    for (; tick < 1800; tick++) { core.update(world, 1 / 60); if (!m.moving && m.runWeight < 0.001) break; }
    return { hidden: hidden.length, arrived: tick < 1800 && m.x === target.x && m.z === target.z,
      unchanged: world.groups[0].field === field && m.target === target, fields: world.stats.fieldBuilds,
      recovery: world.stats.recoveryAttempts - before };
  });
  assert.ok(arrival.hidden > 100); assert.equal(arrival.arrived, true); assert.equal(arrival.unchanged, true);
  assert.equal(arrival.fields, 2); assert.equal(arrival.recovery, 0);
  await page.click('#focus');
  await page.waitForFunction(() => window.drawCount === CrowdNavigation.obstacles.length + 2 + MarineModel.parts.length);
  await page.selectOption('#scenario', 'contact'); await page.fill('#scenario-count', '16');
  await page.click('#scenario-start');
  assert.equal(await page.textContent('#unit-count'), '32'); assert.equal(await page.isChecked('#hostile'), true);
  await page.waitForFunction(() => window.drawCount === 9 + 4 + 32 * MarineModel.parts.length);
  const colors = await page.evaluate(() => {
    const offset = (13 + 16 * MarineModel.parts.length + MarineModel.parts.findIndex(p => p.name === 'chest')) * MarineInstances.stride + 16;
    return window.instanceData.slice(offset, offset + 3);
  });
  assert.ok(colors.every((c, i) => Math.abs(c - [0.65, 0.28, 0.18][i]) < 1e-6), 'group B has its own actual uploaded armor palette');
  const untouched = await page.evaluate(() => JSON.stringify(world.marines.filter(m => m.group === 0)));
  await page.selectOption('#active-group', '1'); await clickPoint(10, -6);
  assert.equal(await page.evaluate(() => JSON.stringify(world.marines.filter(m => m.group === 0))), untouched);
  assert.ok(await page.evaluate(() => Math.hypot(world.groups[1].destination.x - 10, world.groups[1].destination.z + 6) < 0.03));
  await page.click('#hold'); assert.equal(await page.evaluate(() => world.groups[1].reservedSlots.size), 0);
  assert.ok(await page.evaluate(() => world.marines.filter(m => m.group === 1).every(m => m.state === 'holding' && m.target === null)));
  await page.click('#spawn'); assert.equal(await page.textContent('#unit-count'), '33');
  assert.equal(await page.evaluate(() => world.marines.at(-1).group), 1);
  assert.equal(await page.evaluate(() => world.marines.at(-1).state), 'holding');
  await page.uncheck('#hostile'); assert.equal(await page.evaluate(() => world.groups[1].team), 0);
  const freeze = await page.evaluate(() => ({ state: JSON.stringify(world.marines), uploads: window.uploads, frame: window.frames }));
  await page.waitForFunction(n => window.frames > n + 3, freeze.frame);
  // One pending UI-driven upload is allowed before the held scene cache settles.
  const uploads = await page.evaluate(() => window.uploads);
  await page.waitForFunction(n => window.frames > n + 6, freeze.frame);
  assert.equal(await page.evaluate(() => JSON.stringify(world.marines)), freeze.state);
  assert.equal(await page.evaluate(() => window.uploads), uploads);
  await page.selectOption('#scenario', 'mixed'); await page.fill('#scenario-count', '16'); await page.click('#scenario-start');
  assert.equal(await page.textContent('#unit-count'), '18'); assert.equal(await page.isChecked('#hostile'), false);
  await page.waitForFunction(() => window.drawCount === 13 + 16 * MarineModel.parts.length + 2 * TankModel.parts.length);
  const tanks = await page.evaluate(() => {
    const pack = MarineInstances.create(); pack.begin(2 * TankModel.parts.length);
    const before = JSON.stringify(world.marines);
    for (const unit of world.marines.filter(m => m.kind === 'tank')) pack.tank(CrowdSimulation.renderMarine(world, unit), [0.65, 0.28, 0.18]);
    const gpu = new Float32Array(window.drawCount * MarineInstances.stride), gl = window.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, window.instanceBuffer); gl.getBufferSubData(gl.ARRAY_BUFFER, 0, gpu);
    const start = (13 + 16 * MarineModel.parts.length) * MarineInstances.stride;
    let maxError = 0;
    for (let i = 0; i < pack.count * MarineInstances.stride; i++) maxError = Math.max(maxError, Math.abs(gpu[start + i] - pack.data[i]));
    return { maxError, pure: before === JSON.stringify(world.marines), kinds: world.groups.map(g => g.kind), fields: world.stats.fieldBuilds };
  });
  assert.equal(tanks.maxError, 0); assert.equal(tanks.pure, true); assert.deepEqual(tanks.kinds, ['marine', 'tank']); assert.equal(tanks.fields, 2);
  const marinesBeforeTankSpawn = await page.evaluate(() => JSON.stringify(world.marines.filter(m => m.group === 0)));
  await page.selectOption('#active-group', '1'); await page.click('#spawn');
  assert.equal(await page.textContent('#unit-count'), '19');
  assert.ok(await page.evaluate(() => world.marines.at(-1).kind === 'tank' && world.marines.at(-1).target && world.stats.fieldBuilds === 2));
  assert.equal(await page.evaluate(() => JSON.stringify(world.marines.filter(m => m.group === 0))), marinesBeforeTankSpawn);
  await page.waitForFunction(() => window.drawCount === 13 + 16 * MarineModel.parts.length + 3 * TankModel.parts.length);
  const tankPause = await page.evaluate(() => ({ state: JSON.stringify(world.marines), uploads: window.uploads, frame: window.frames }));
  await page.waitForFunction(n => window.frames > n + 4, tankPause.frame);
  assert.deepEqual(await page.evaluate(() => ({state: JSON.stringify(world.marines), uploads: window.uploads})), {state:tankPause.state, uploads:tankPause.uploads});
  const glError = await page.evaluate(() => window.gl.getError()); assert.equal(glError, 0); assert.deepEqual(errors, []);
  console.log('Browser file://: actual GPU Marine/tank instances, attributes/palettes, interpolation, terrain feet, pause cache, camera/picking, 1000-unit batch, occluded arrival, independent typed groups, hold/spawn/team controls and shader/GL errors checked.');
} finally { await browser.close(); }
