import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Bounded contour check: no terrain mesh, navigation raster or WebGL startup.
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
assert.match(script, /generate\(\);\s*$/);
const context = vm.createContext({
  assert,
  document: { getElementById: () => ({ addEventListener() {} }), addEventListener() {} },
  window: { addEventListener() {} },
  ResizeObserver: class { observe() {} },
});
vm.runInContext(script.replace(/generate\(\);\s*$/, ''), context, { timeout: 1000 });
vm.runInContext(`
  for (const seed of [1, 2, 19, 16053245]) {
    const random = rng(seed ^ 0x504f4c59), repeated = rng(seed ^ 0x504f4c59);
    for (let i = 0; i < 19; i++) {
      const region = { x: 150, y: 150, radius: 11 + i % 5 }, copy = { ...region };
      shapeRegion(region, random); shapeRegion(copy, repeated);
      assert.equal(JSON.stringify(region.points), JSON.stringify(copy.points));
      assert.equal(region.points.length, 32);
      assert.ok(polygonDistance(region, region.x, region.y) <= -7.5);
      for (let j = 0; j < region.sides.length; j++) {
        const e = region.sides[j], next = region.sides[(j + 1) % region.sides.length];
        assert.ok(e.length2 > 0 && e.dx * next.dy - e.dy * next.dx > 0);
        assert.ok(distance(e.a, region) <= region.radius * 1.22 + 1e-8);
        assert.ok(Math.abs(polygonDistance(region, e.a.x + e.dx / 2, e.a.y + e.dy / 2)) < 1e-8);
        const angle = j * Math.PI * 2 / 32;
        assert.ok(polygonDistance(region, region.x + 7.5 * Math.cos(angle), region.y + 7.5 * Math.sin(angle)) <= 0);
      }
    }
  }
  const plan = makePlan(2);
  assert.equal(plan.regions.length, 19);
  for (const region of plan.regions) {
    assert.ok(region.points.every(p => insideMap(p.x, p.y)));
    assert.ok(region.outline.every(p => Math.abs(polygonDistance(region, p.source.x, p.source.y)) < 1e-7));
    const center = warpPoint(plan, region);
    assert.ok(sampleWorld(plan, center.x, center.y).planned);
  }
  const probes = Array.from({ length: 48 }, (_, i) => ({ x: (i % 8 + .3) * SIZE / 8, y: (Math.floor(i / 8) + .7) * SIZE / 6 }));
  const pruned = probes.map(p => sampleLand(plan, p.x, p.y));
  const bounds = plan.regions.map(r => r.bounds);
  plan.regions.forEach(r => { r.bounds = { minX: -Infinity, minY: -Infinity, maxX: Infinity, maxY: Infinity }; });
  assert.equal(JSON.stringify(pruned), JSON.stringify(probes.map(p => sampleLand(plan, p.x, p.y))));
  plan.regions.forEach((r, i) => { r.bounds = bounds[i]; });
`, context, { timeout: 5000 });
console.log('Rounded region contours: deterministic, convex, road-width core, bounded footprint, shared planning geometry and exact distance pruning OK. No mesh/raster generated.');
