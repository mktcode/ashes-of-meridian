'use strict';

(() => {
  const canvas = document.querySelector('#terrain');
  const seedInput = document.querySelector('#seed');
  const stageInput = document.querySelector('#stage');
  const branchesInput = document.querySelector('#branches');
  const branchesOutput = document.querySelector('#branches-value');
  const status = document.querySelector('#status');
  try {
    const view = createLandscapeView(canvas, document.querySelector('#labels'));
    let plan = null, pending = false;
    function generate() {
      if (pending) return;
      pending = true;
      status.textContent = 'Landschaftsgerüst und Höhenfeld werden aufgebaut …';
      // Give the browser one paint before the synchronous prototype generation.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        try {
          const seed = Number(seedInput.value) >>> 0;
          seedInput.value = String(seed);
          const branches = Number(branchesInput.value);
          if (!plan || plan.seed !== seed || plan.complexity !== branches) plan = LandscapeCore.makePlan(seed, { branches });
          const stage = stageInput.value;
          const mesh = LandscapeCore.buildMesh(plan, stage);
          view.setScene(plan, mesh, stage);
          status.textContent = `Seed ${seed} · ${plan.branchCount} zusätzliche Äste · ${plan.loopCount} Rundwege · verbundener Aufstieg über ${plan.routes.filter(e => e.guaranteed).length} Abschnitte (${Math.round(plan.ascentLength)} Karteneinheiten) · ${stage === 'macro' ? 'nur Großformen' : 'mit Gebirgsausläufern'} · kein Detailrelief`;
        } catch (error) {
          status.textContent = error.message;
          console.error(error);
        } finally {
          pending = false;
        }
      }));
    }
    document.querySelector('#generate').addEventListener('submit', event => { event.preventDefault(); generate(); });
    document.querySelector('#random').addEventListener('click', () => {
      if (pending) return;
      seedInput.value = String(crypto.getRandomValues(new Uint32Array(1))[0]);
      generate();
    });
    stageInput.addEventListener('change', generate);
    branchesInput.addEventListener('input', () => { branchesOutput.textContent = branchesInput.value; });
    branchesInput.addEventListener('change', generate);
    for (const name of ['structure', 'routes', 'places', 'contours']) {
      const input = document.querySelector(`#${name}`);
      input.addEventListener('change', () => view.setOptions({ [name]: input.checked }));
    }
    document.querySelector('#reset').addEventListener('click', () => view.resetCamera());
    document.querySelector('#overview').addEventListener('click', () => view.resetCamera(true));

    const pointers = new Map();
    function gesture() {
      const [a, b] = [...pointers.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
        distance: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x) };
    }
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    canvas.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && ![0, 1, 2].includes(event.button)) return;
      canvas.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, pan: event.button !== 0 || event.shiftKey });
      canvas.classList.add('dragging');
      event.preventDefault();
    });
    canvas.addEventListener('pointermove', event => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      const before = pointers.size === 2 ? gesture() : null;
      const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
      pointers.set(event.pointerId, { ...previous, x: event.clientX, y: event.clientY });
      if (before) {
        const after = gesture();
        const angle = after.angle - before.angle;
        view.gesture(after.x - before.x, after.y - before.y, Math.atan2(Math.sin(angle), Math.cos(angle)),
          after.distance / Math.max(1, before.distance));
      } else if (pointers.size === 1) {
        if (previous.pan || event.shiftKey) view.pan(dx, dy);
        else view.orbit(dx, dy);
      }
    });
    function release(event) {
      pointers.delete(event.pointerId);
      if (!pointers.size) canvas.classList.remove('dragging');
    }
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, release);
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      view.zoomBy(Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.025 : 0.0015)));
    }, { passive: false });
    const query = new URLSearchParams(location.search);
    const querySeed = query.get('seed'), queryBranches = query.get('branches');
    if (querySeed !== null && /^\d+$/.test(querySeed)) seedInput.value = String(Number(querySeed) >>> 0);
    if (queryBranches !== null && /^\d+$/.test(queryBranches)) branchesInput.value = String(Math.min(12, Number(queryBranches)));
    branchesOutput.textContent = branchesInput.value;
    generate();
  } catch (error) {
    status.textContent = error.message;
    console.error(error);
  }
})();
