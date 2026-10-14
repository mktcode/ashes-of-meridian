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
function redraw() {
  if (currentPlan && renderPlan) renderPlan(currentPlan);
}
function generate() {
  const seed = Number(seedInput.value);
  if (seedInput.value === '' || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    status.textContent = 'Bitte einen ganzzahligen Seed von 0 bis 4294967295 eingeben.';
    return;
  }
  try {
    if (!renderPlan) return;
    currentPlan = makePlan(seed, { curved: checked('curved'), rounded: checked('rounded') });
    redraw();
    const river = currentPlan.river;
    status.textContent = `Seed ${seed} · ${currentPlan.cells.length} Waben mit eigenem Höhenoffset · ${currentPlan.edges.length} Wege · ${river.splits} Flussaufteilungen · ${river.exits.length} Ausflüsse · ${river.bridges.length}/${river.reduction.total} Brücken erhalten · ${river.reduction.removed.length} redundante Brücken entfernt (${river.reduction.percent} % Ausdünnung).`;
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
const startupSeed = new URL(location.href).searchParams.get('seed');
if (startupSeed !== null) seedInput.value = startupSeed;
generate();
