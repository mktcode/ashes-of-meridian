'use strict';
const canvas = document.getElementById('map');
const context = canvas.getContext('2d');
const seedInput = document.getElementById('seed');
const status = document.getElementById('status');
const checked = (id) => document.getElementById(id).checked;
let currentPlan;
function redraw() {
  if (!currentPlan || !context) return;
  context.clearRect(0, 0, PIXELS, PIXELS);
  drawNetwork(context, currentPlan, checked('filled'), checked('dual'));
}
function generate() {
  const seed = Number(seedInput.value);
  if (seedInput.value === '' || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    status.textContent = 'Bitte einen ganzzahligen Seed von 0 bis 4294967295 eingeben.';
    return;
  }
  try {
    if (!context) throw Error('Canvas 2D ist nicht verfügbar.');
    currentPlan = makePlan(seed, { curved: checked('curved'), rounded: checked('rounded') });
    redraw();
    const river = currentPlan.river;
    status.textContent = `Seed ${seed} · ${currentPlan.regions.length} Regionen · ${currentPlan.edges.length} Wege · ${river.splits} Flussaufteilungen · ${river.exits.length} Ausflüsse · ${river.bridges.length}/${river.reduction.total} Brücken erhalten · ${river.reduction.removed.length} redundante Brücken entfernt (${river.reduction.percent} % Ausdünnung).`;
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
for (const id of ['curved', 'rounded']) document.getElementById(id).addEventListener('change', generate);
for (const id of ['filled', 'dual']) document.getElementById(id).addEventListener('change', redraw);
const startupSeed = new URL(location.href).searchParams.get('seed');
if (startupSeed !== null) seedInput.value = startupSeed;
generate();
