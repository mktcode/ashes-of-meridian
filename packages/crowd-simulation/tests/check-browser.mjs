import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

process.chdir(fileURLToPath(new URL('../../../', import.meta.url)));
const temp = '.tmp/crowd-browser'; mkdirSync(temp, { recursive: true });
for (const key of ['TMPDIR', 'TMP', 'TEMP']) process.env[key] = temp;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } }), errors = [], network = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); });
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const gl = get.apply(this, args); if (args[0] !== 'webgl2' || !gl) return gl;
      window.gl = gl; window.uploads = 0; window.frames = 0;
      const upload = gl.bufferSubData.bind(gl);
      gl.bufferSubData = (target, offset, data, ...rest) => {
        window.instanceBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING); window.uploads++;
        return upload(target, offset, data, ...rest);
      };
      const draw = gl.drawArraysInstanced.bind(gl);
      gl.drawArraysInstanced = (...values) => { window.drawCount = values[3]; window.frames++; return draw(...values); };
      return gl;
    };
  });
  const entry = process.argv.includes('--release') ? '../../../dist/crowd-simulation/demo/index.html' : '../demo/index.html';
  await page.goto(new URL(entry, import.meta.url).href);
  await page.waitForFunction(() => window.CrowdDemo && window.frames >= 2);
  assert.equal(await page.locator('script[type="module"],script[async],script[defer]').count(), 0);
  await page.click('#pause');
  await page.locator('#speed').fill('5'); assert.equal(await page.textContent('#speed-value'), '5.00×');
  await page.locator('#speed').fill('1'); assert.equal(await page.textContent('#speed-value'), '1.00×');
  const tick = await page.evaluate(() => {
    const crowd = CrowdDemo.crowd;
    if (!crowd.command({ kind: 'move', group: 0, destination: { x: -8, z: 8 } }).ok) throw Error('move rejected');
    for (let i = 0; i < 20; i++) crowd.step();
    const a = MeridianCrowd.createCrowdFrameBuffer(), b = MeridianCrowd.createCrowdFrameBuffer(), mid = MeridianCrowd.createCrowdFrameBuffer();
    crowd.writeFrame(a, 0); crowd.writeFrame(b, 1); crowd.writeFrame(mid, 0.5);
    if (Math.abs(mid.positions[0] - (a.positions[0] + b.positions[0]) / 2) > 1e-12) throw Error('interpolation');
    return window.frames;
  });
  await page.waitForFunction(n => window.frames > n + 2, tick);
  await page.click('#focus');
  const gpu = await page.evaluate(() => {
    const { crowd, frameData: data, renderRecord } = CrowdDemo, renderer = MarineInstances, gl = window.gl;
    const before = JSON.stringify(crowd.getAgent(data.ids[0]));
    const pack = renderer.create(); pack.begin(MarineModel.parts.length); pack.marine(renderRecord(data, 0));
    const gpu = new Float32Array(window.drawCount * renderer.stride);
    gl.bindBuffer(gl.ARRAY_BUFFER, window.instanceBuffer); gl.getBufferSubData(gl.ARRAY_BUFFER, 0, gpu);
    const start = (CrowdObstacles.length + crowd.getGroups().filter(g => g.destination).length * 2) * renderer.stride;
    let maxError = 0;
    for (let i = 0; i < pack.count * renderer.stride; i++) maxError = Math.max(maxError, Math.abs(gpu[start + i] - pack.data[i]));
    const feet = [];
    for (const name of ['leftBoot', 'rightBoot']) {
      const index = MarineModel.parts.findIndex(p => p.name === name), m = gpu.subarray(start + index * renderer.stride);
      let min = Infinity;
      for (const x of [-0.5, 0, 0.5]) for (const z of [-0.5, 0, 0.5]) {
        const px = m[0] * x - m[4] * 0.5 + m[8] * z + m[12], py = m[1] * x - m[5] * 0.5 + m[9] * z + m[13];
        const pz = m[2] * x - m[6] * 0.5 + m[10] * z + m[14];
        min = Math.min(min, py - CrowdTerrain.heightAt(px, pz));
      }
      feet.push(min);
    }
    return { maxError, feet, pure: before === JSON.stringify(crowd.getAgent(data.ids[0])), error: gl.getError(),
      divisors: [2, 3, 4, 5, 6].map(i => gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_DIVISOR)),
      offsets: [2, 3, 4, 5, 6].map(i => gl.getVertexAttribOffset(i, gl.VERTEX_ATTRIB_ARRAY_POINTER)),
      strides: [2, 3, 4, 5, 6].map(i => gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_STRIDE)) };
  });
  assert.equal(gpu.maxError, 0); assert.equal(gpu.pure, true); assert.equal(gpu.error, 0);
  assert.deepEqual(gpu.divisors, [1, 1, 1, 1, 1]); assert.deepEqual(gpu.offsets, [0, 16, 32, 48, 64]); assert.deepEqual(gpu.strides, [76, 76, 76, 76, 76]);
  assert.ok(gpu.feet.every(v => v > -0.001) && Math.min(...gpu.feet) < 0.04, 'GPU boots retain terrain contact');
  const frozen = await page.evaluate(() => ({ state: JSON.stringify(CrowdDemo.crowd.getAgent(CrowdDemo.frameData.ids[0])), tick: CrowdDemo.crowd.tick, uploads: window.uploads, frame: window.frames }));
  await page.waitForFunction(n => window.frames > n + 4, frozen.frame);
  assert.deepEqual(await page.evaluate(() => ({ state: JSON.stringify(CrowdDemo.crowd.getAgent(CrowdDemo.frameData.ids[0])), tick: CrowdDemo.crowd.tick, uploads: window.uploads })), { state: frozen.state, tick: frozen.tick, uploads: frozen.uploads });
  async function clickPoint(x, z, obstacle = false) {
    const pixel = await page.evaluate(({ x, z, obstacle }) => {
      const gl = window.gl, program = gl.getParameter(gl.CURRENT_PROGRAM), u = name => gl.getUniform(program, gl.getUniformLocation(program, name));
      const b = document.querySelector('canvas').getBoundingClientRect(), center = u('center'), right = u('right'), up = u('up'), scale = u('scale');
      const y = obstacle ? CrowdObstacles[0].baseY + CrowdObstacles[0].height : CrowdTerrain.heightAt(x, z);
      const p = [x - center[0], y - center[1], z - center[2]], dot = a => p.reduce((sum, v, i) => sum + v * a[i], 0);
      return { x: b.left + (dot(right) * scale[0] + 1) * b.width / 2, y: b.top + (1 - dot(up) * scale[1]) * b.height / 2 };
    }, { x, z, obstacle });
    await page.mouse.click(pixel.x, pixel.y);
  }
  await clickPoint(-4.5, -2.5);
  assert.ok(await page.evaluate(() => Math.hypot(CrowdDemo.crowd.getGroups()[0].destination.x + 4.5, CrowdDemo.crowd.getGroups()[0].destination.z + 2.5) < 0.03));
  const command = await page.evaluate(() => JSON.stringify(CrowdDemo.crowd.getGroups()));
  await clickPoint(2.5, 0, true);
  assert.equal(await page.evaluate(() => JSON.stringify(CrowdDemo.crowd.getGroups())), command);
  assert.match(await page.textContent('#status'), /gesperrt/);
  const canvas = await page.locator('canvas').boundingBox();
  await page.keyboard.down('Shift'); await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.mouse.down(); await page.mouse.move(canvas.x + canvas.width / 2 + 45, canvas.y + canvas.height / 2 + 25); await page.mouse.up(); await page.keyboard.up('Shift');
  assert.equal(await page.evaluate(() => JSON.stringify(CrowdDemo.crowd.getGroups())), command, 'pan issues no command');
  const old = await page.evaluate(() => JSON.stringify(CrowdDemo.crowd.getAgent(CrowdDemo.frameData.ids[0])));
  const fields = await page.evaluate(() => CrowdDemo.crowd.getStats().fieldBuilds);
  await page.click('#spawn-thousand'); assert.equal(await page.textContent('#unit-count'), '1001');
  assert.equal(await page.evaluate(() => JSON.stringify(CrowdDemo.crowd.getAgent(CrowdDemo.frameData.ids[0]))), old);
  assert.equal(await page.evaluate(() => CrowdDemo.crowd.getStats().fieldBuilds), fields);
  assert.equal(await page.evaluate(() => CrowdDemo.crowd.getStats().reservations), 1001);
  await page.click('#focus'); await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2); await page.mouse.wheel(0, -2000);
  await page.waitForFunction(() => window.drawCount < CrowdDemo.crowd.size * MarineModel.parts.length);
  assert.equal(await page.evaluate(() => JSON.stringify(CrowdDemo.crowd.getAgent(CrowdDemo.frameData.ids[0]))), old, 'culling leaves simulation untouched');
  await page.selectOption('#scenario', 'mixed'); await page.fill('#scenario-count', '16'); await page.click('#scenario-start');
  assert.equal(await page.textContent('#unit-count'), '18'); assert.equal(await page.isChecked('#hostile'), false);
  await page.waitForFunction(() => window.drawCount === 13 + 16 * MarineModel.parts.length + 2 * TankModel.parts.length);
  const tanks = await page.evaluate(() => {
    const { crowd, frameData, renderRecord } = CrowdDemo, pack = MarineInstances.create(); pack.begin(2 * TankModel.parts.length);
    for (let i = 0; i < frameData.count; i++) if (frameData.groups[i] === 1) pack.tank(renderRecord(frameData, i), [0.65, 0.28, 0.18]);
    const gpu = new Float32Array(window.drawCount * MarineInstances.stride), gl = window.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, window.instanceBuffer); gl.getBufferSubData(gl.ARRAY_BUFFER, 0, gpu);
    const start = (13 + 16 * MarineModel.parts.length) * MarineInstances.stride;
    let maxError = 0;
    for (let i = 0; i < pack.count * MarineInstances.stride; i++) maxError = Math.max(maxError, Math.abs(gpu[start + i] - pack.data[i]));
    return { maxError, profiles: crowd.getGroups().map(g => g.profile), fields: crowd.getStats().fieldBuilds };
  });
  assert.equal(tanks.maxError, 0); assert.deepEqual(tanks.profiles, ['marine', 'tank']); assert.equal(tanks.fields, 2);
  const untouched = await page.evaluate(() => JSON.stringify(Array.from(CrowdDemo.frameData.ids.subarray(0, 16), id => CrowdDemo.crowd.getAgent(id))));
  await page.selectOption('#active-group', '1'); await page.click('#spawn'); assert.equal(await page.textContent('#unit-count'), '19');
  assert.equal(await page.evaluate(() => CrowdDemo.crowd.getStats().fieldBuilds), 2);
  assert.equal(await page.evaluate(() => CrowdDemo.crowd.getStats().reservations), 19);
  assert.equal(await page.evaluate(() => JSON.stringify(Array.from(CrowdDemo.frameData.ids.subarray(0, 16), id => CrowdDemo.crowd.getAgent(id)))), untouched);
  await page.click('#hold'); assert.equal(await page.evaluate(() => CrowdDemo.crowd.getStats().reservations), 16);
  await page.check('#hostile'); assert.equal(await page.evaluate(() => CrowdDemo.crowd.getGroups()[1].team), 1);
  await page.uncheck('#hostile');
  await page.waitForFunction(() => window.drawCount === 11 + 16 * MarineModel.parts.length + 3 * TankModel.parts.length);
  const held = await page.evaluate(() => ({ uploads: window.uploads, frame: window.frames, tick: CrowdDemo.crowd.tick }));
  await page.waitForFunction(n => window.frames > n + 4, held.frame);
  assert.equal(await page.evaluate(() => window.uploads), held.uploads); assert.equal(await page.evaluate(() => CrowdDemo.crowd.tick), held.tick);
  assert.equal(await page.evaluate(() => window.gl.getError()), 0); assert.deepEqual(errors, []); assert.deepEqual(network, []);
  console.log(`Browser file:// (${entry}): classic bundle, public API, interpolation/terrain feet, exact Marine/tank GPU matrices, pause cache, camera/picking, 1000 spawn, culling and independent mixed groups. No network/GL/page errors.`);
} finally { await browser.close(); }
