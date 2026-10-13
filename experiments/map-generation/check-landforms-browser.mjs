import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { withBrowser } from '../../scripts/browser/harness.mjs';

// One real map, one same-seed comparison. No build, game startup, seed sweep,
// screenshot batch or pixel assertions. Requires installed playwright-core and
// Chromium; the shared harness owns an isolated worktree-local browser profile.
const root = fileURLToPath(new URL('../../', import.meta.url));
await withBrowser(root, async browser => {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${new URL('./index.html', import.meta.url)}?seed=2`, { waitUntil: 'load', timeout: 45000 });
  await page.waitForFunction(() => preview.gpu?.uploaded === preview.mesh, null, { timeout: 45000 });
  const first = await page.evaluate(() => {
    const plan = preview.plan, mesh = preview.mesh, audit = auditMap(plan, mesh), edgeCounts = new Map();
    for (const t of mesh.triangles) if (t.material === 0 && !t.rock) for (let j = 0; j < 3; j++) {
      const key = edgeKey(t.indices[j], t.indices[(j + 1) % 3]);
      edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
    }
    const border = plan.border.map(p => p.source);
    let conforming = true;
    for (const [key, count] of edgeCounts) {
      if (count !== 1 && count !== 2) { conforming = false; break; }
      if (count === 1) {
        const [a, b] = key.split(':').map(i => mesh.vertices[Number(i)]),
          x = (a.sourceX + b.sourceX) / 2 + SIZE / 2, y = (a.sourceY + b.sourceY) / 2 + SIZE / 2;
        if (!border.some((a, j) => segmentDistance(x, y, a, border[(j + 1) % border.length]) < 1e-7)) {
          conforming = false; break;
        }
      }
    }
    window.landformCheck = {
      plan, mesh,
      heights: plan.regions.map(r => sampleLand(plan, r.x, r.y).height),
      topology: JSON.stringify([plan.regions, plan.edges, plan.river])
    };
    return { seed: plan.seed, mesas: plan.landforms.mesas.length, rocks: plan.landforms.rocks.length,
      faces: mesh.terrainFaceCount, finite: mesh.vertices.every(p => Number.isFinite(p.z) && Number.isFinite(p.height)),
      rockFaces: mesh.triangles.filter(t => t.rock).length, conforming, audit,
      gl: preview.gpu.gl.getError(), error: document.getElementById('renderError').textContent,
      mainProgram: preview.gpu.gl.getProgramParameter(preview.gpu.program, preview.gpu.gl.LINK_STATUS) };
  });
  assert.equal(first.seed, 2); assert.ok(first.mesas > 0 && first.rocks > 0 && first.rockFaces > 0);
  assert.ok(first.finite && first.conforming && first.mainProgram);
  assert.ok(first.audit.connected && first.audit.downhill && first.audit.maxPlayableGrade <= .45);
  assert.equal(first.gl, 0); assert.equal(first.error, '');
  // Presentation changes must preserve the generated CPU/GPU geometry.
  await page.selectOption('#terrainStyle', 'desert');
  await page.uncheck('#relief');
  await page.waitForTimeout(100);
  assert.ok(await page.evaluate(() => landformCheck.mesh === preview.mesh && preview.gpu.uploaded === preview.mesh));
  await page.uncheck('#landforms');
  const comparison = await page.evaluate(() => ({
    seed: preview.plan.seed, enabled: preview.plan.landforms.enabled,
    sameTopology: landformCheck.topology === JSON.stringify([preview.plan.regions, preview.plan.edges, preview.plan.river]),
    sameHeights: JSON.stringify(landformCheck.heights) === JSON.stringify(preview.plan.regions.map(r => sampleLand(preview.plan, r.x, r.y).height)),
    rebuilt: landformCheck.mesh !== preview.mesh && preview.gpu.uploaded === preview.mesh,
    noRocks: !preview.mesh.triangles.some(t => t.rock), grade: auditSurface(preview.mesh),
    gl: preview.gpu.gl.getError(), error: document.getElementById('renderError').textContent
  }));
  assert.equal(comparison.seed, 2); assert.equal(comparison.enabled, false);
  assert.ok(comparison.sameTopology && comparison.sameHeights && comparison.rebuilt && comparison.noRocks);
  assert.ok(Math.abs(comparison.grade - first.audit.maxPlayableGrade) < 1e-12);
  assert.equal(comparison.gl, 0); assert.equal(comparison.error, ''); assert.deepEqual(errors, []);
  console.log('Seed 2: actual warped mesh, conforming cliff/river refinement, 192² connectivity, descending water, unchanged playable grade and protected heights, same-seed toggle, file:// + GLSL/GL OK.', first);
  await page.close();
}, { timeoutMs: 60000 });
