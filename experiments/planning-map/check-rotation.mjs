import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let uploads = 0, rotation, captured, framebuffer, shadowDraws = 0, frameScale;
const frames = [], elements = new Map();
const html = readFileSync(new URL('index.html', import.meta.url), 'utf8');
const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
const gl = new Proxy({
  NO_ERROR: 0, FRAMEBUFFER_COMPLETE: 1,
  createFramebuffer: () => ({}),
  checkFramebufferStatus: () => 1,
  bindFramebuffer: (_, target) => { framebuffer = target; },
  drawArrays: () => { if (framebuffer) shadowDraws++; },
  uniform3f: (name, x, y, z) => { if (name === 'frame') frameScale = z; },
  getError: () => 0,
  getShaderParameter: () => true,
  getProgramParameter: () => true,
  getUniformLocation: (_, name) => name,
  bufferData: () => uploads++,
  uniform2f: (_, x, y) => { rotation = [x, y]; },
}, { get: (target, key) => key in target ? target[key] : () => {} });
function element(id) {
  assert.ok(htmlIds.has(id), `UI element exists: ${id}`);
  if (!elements.has(id)) elements.set(id, {
    handlers: new Map(), value: id === 'zoom' ? '1' : '2', checked: true, clientWidth: 900, clientHeight: 600, width: 900, height: 600,
    children: [], style: {}, classList: { add() {}, remove() {} },
    addEventListener(type, callback) { this.handlers.set(type, callback); },
    setPointerCapture: (pointerId) => { captured = pointerId; },
    hasPointerCapture: (pointerId) => captured === pointerId,
    releasePointerCapture: () => { captured = undefined; },
    getContext: () => gl,
    replaceChildren() { this.children = []; },
    append(child) { this.children.push(child); },
  });
  return elements.get(id);
}
const sandbox = vm.createContext({
  URL, location: { href: 'file:///planning-map/index.html?seed=2' },
  document: { getElementById: element, createElement: () => ({ style: {} }) },
  requestAnimationFrame: (callback) => frames.push(callback),
});
for (const file of ['planning-core.js', 'planning-view.js', 'planning-app.js']) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), sandbox);
}
const canvas = element('map'), labels = element('labels');
const dispatch = (type, overrides = {}) => canvas.handlers.get(type)?.({ pointerId: 1, button: 0, clientX: 100, clientY: 100, ...overrides });
const flush = () => { while (frames.length) frames.shift()(); };
const initialPlan = vm.runInContext('JSON.stringify(currentPlan)', sandbox);
const initialLabels = labels.children.map((label) => label.style.left);
assert.equal(uploads, 2);
assert.equal(shadowDraws, 1, 'new plan renders the shadow map once');
const initialScale = frameScale;
assert.equal(labels.children.length, 19);
dispatch('pointerdown');
dispatch('pointermove', { clientY: 400 });
flush();
assert.equal(vm.runInContext('yaw', sandbox), 0, 'vertical drag does not change camera');
dispatch('pointermove', { pointerId: 2, clientX: 600 });
assert.equal(vm.runInContext('yaw', sandbox), 0, 'second pointer ignored');
dispatch('pointermove', { clientX: 325 });
dispatch('pointermove', { clientX: 550 });
assert.equal(frames.length, 1, 'redraws coalesced');
flush();
assert.ok(Math.abs(vm.runInContext('yaw', sandbox) - Math.PI) < 1e-10);
assert.ok(Math.abs(rotation[0] + 1) < 1e-10);
assert.notDeepEqual(labels.children.map((label) => label.style.left), initialLabels);
assert.equal(uploads, 2, 'rotation reuses GPU buffers');
assert.equal(vm.runInContext('JSON.stringify(currentPlan)', sandbox), initialPlan);
dispatch('pointerup');
dispatch('pointermove', { clientX: 800 });
assert.equal(frames.length, 0);
assert.equal(captured, undefined);
for (const finish of ['pointercancel', 'lostpointercapture']) {
  dispatch('pointerdown');
  dispatch(finish);
  assert.equal(vm.runInContext('drag', sandbox), undefined);
}
const beforeZoom = labels.children.map((label) => label.style.left);
let prevented = false;
dispatch('wheel', { deltaY: -100, deltaMode: 0, preventDefault: () => { prevented = true; } });
flush();
assert.ok(prevented, 'wheel zoom prevents page scrolling');
assert.ok(frameScale > initialScale, 'wheel zoom magnifies the camera');
assert.notDeepEqual(labels.children.map((label) => label.style.left), beforeZoom, 'labels follow zoom');
element('zoom').value = '99';
element('zoom').handlers.get('input')();
flush();
assert.equal(vm.runInContext('zoom', sandbox), 2.5, 'upper zoom bound');
element('zoom').value = '0';
element('zoom').handlers.get('input')();
flush();
assert.equal(vm.runInContext('zoom', sandbox), 0.6, 'lower zoom bound');
element('zoom-reset').handlers.get('click')();
flush();
assert.equal(frameScale, initialScale);
assert.equal(element('zoom-value').textContent, '100 %');
assert.equal(uploads, 2, 'zoom reuses GPU buffers');
assert.equal(shadowDraws, 1, 'rotation and zoom reuse stationary shadows');
assert.equal(vm.runInContext('JSON.stringify(currentPlan)', sandbox), initialPlan);
element('curved').checked = false;
element('curved').handlers.get('change')();
assert.equal(uploads, 4);
assert.equal(shadowDraws, 2, 'regeneration refreshes shadows');
console.log('Camera: yaw, bounded wheel/slider zoom, labels, pointer cleanup, GPU and shadow-cache reuse passed.');
