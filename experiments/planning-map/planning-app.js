'use strict';
const canvas = document.getElementById('map');
let renderPlan;
try {
  renderPlan = createPlanningRenderer(canvas, document.getElementById('labels'));
} catch (error) {
  document.getElementById('status').textContent = error.message;
}
const seedInput = document.getElementById('seed');
const status = document.getElementById('status');
const checked = (id) => document.getElementById(id).checked;
let currentPlan;
let yaw = 0;
function redraw() {
  if (currentPlan && renderPlan) renderPlan(currentPlan, yaw);
}
// One active pointer; horizontal motion changes yaw, vertical motion does nothing.
let drag, drawPending = false;
canvas.addEventListener('pointerdown', (event) => {
  if (drag || event.button !== 0 || !renderPlan) return;
  drag = { id: event.pointerId, x: event.clientX };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  yaw = (yaw + (event.clientX - drag.x) * Math.PI * 2 / canvas.clientWidth) % (Math.PI * 2);
  drag.x = event.clientX;
  if (!drawPending) {
    drawPending = true;
    requestAnimationFrame(() => {
      drawPending = false;
      redraw();
    });
  }
});
function finishDrag(event) {
  if (!drag || event.pointerId !== drag.id) return;
  drag = undefined;
  canvas.classList.remove('dragging');
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, finishDrag);
function generate() {
  const seed = Number(seedInput.value);
  if (seedInput.value === '' || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    status.textContent = 'Bitte einen ganzzahligen Seed von 0 bis 4294967295 eingeben.';
    return;
  }
  try {
    if (!renderPlan) return;
    currentPlan = makePlan(seed, { curved: checked('curved') });
    redraw();
    status.textContent = `Seed ${seed} · ${currentPlan.cells.length} Waben · Höhenstufen ${currentPlan.heightSteps.step} · Hochpunkt W${currentPlan.heightSteps.peakCellId} · ${currentPlan.edges.length} Wege`;
  } catch (error) {
    status.textContent = `Seed ${seed}: ${error.message}`;
  }
}
document.getElementById('generate').addEventListener('submit', (event) => {
  event.preventDefault();
  generate();
});
document.getElementById('random').addEventListener('click', () => {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  seedInput.value = String(value[0]);
  generate();
});
document.getElementById('curved').addEventListener('change', generate);
const startupSeed = new URL(location.href).searchParams.get('seed');
if (startupSeed !== null) seedInput.value = startupSeed;
generate();
