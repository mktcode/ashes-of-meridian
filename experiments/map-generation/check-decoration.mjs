import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadLab } from './test-support.mjs';

// Cheap placement/model checks: real plan topology, synthetic height fields;
// no generated terrain mesh, navigation raster or browser initialization.
const context = loadLab({ scripts: ['terrain-core', 'terrain-decoration'], globals: { assert } });
const result = vm.runInContext(`(() => {
  assert.equal(typeof document, 'undefined');
  const plan = makePlan(2), before = JSON.stringify(plan);
  let queries = 0;
  const flat = (p,x,y) => { queries++; return {height:40 + .01 * (x - SIZE/2),water:15,bridge:false}; };
  const decoration = makeDecoration(plan, flat);
  assert.equal(JSON.stringify(plan), before);
  assert.equal(JSON.stringify(makeDecoration(plan, flat)), JSON.stringify(decoration));
  assert.ok(decoration.catalog.length > 20);
  const full = selectTrees(decoration, 1), sparse = selectTrees(decoration, .3), medium = selectTrees(decoration, .65);
  assert.deepEqual(selectTrees(decoration, 0), []);
  assert.deepEqual(full, decoration.catalog);
  assert.ok(sparse.length < medium.length && medium.length < full.length);
  assert.ok(sparse.every(t => medium.includes(t)));
  assert.ok(full.some(t => t.type === 'broadleaf') && full.some(t => t.type === 'conifer'));
  for (let i = 0; i < full.length; i++) {
    const t = full[i];
    assert.ok(decorationClearance(plan, t.sourceX, t.sourceY));
    assert.equal(decorationSite(plan, t.sourceX, t.sourceY, flat).eligible, true);
    assert.ok(plantingMask(decoration.field, t.sourceX, t.sourceY) >= .5);
    for (let j = 0; j < i; j++) assert.ok(distance(t, full[j]) >= TREE_RULES.spacing);
  }
  const t = full[0];
  for (const [height, band] of [[20,0],[40,1],[70,2]]) {
    assert.equal(decorationSite(plan, t.sourceX, t.sourceY, () => ({height,water:0,bridge:false})).band, band);
  }
  assert.equal(decorationSite(plan, t.sourceX, t.sourceY, (p,x,y) => ({height:x*.7,water:-100,bridge:false})).eligible, false);
  assert.equal(decorationSite(plan, t.sourceX, t.sourceY, () => ({height:40,water:15,bridge:true})).eligible, false);
  assert.equal(decorationSite(plan, t.sourceX, t.sourceY, () => ({height:10,water:15,bridge:false})).eligible, false);
  assert.equal(decorationClearance(plan, 0, 0), false);
  for (const e of plan.edges) {
    const a = plan.regions[e.a], b = plan.regions[e.b];
    assert.equal(decorationClearance(plan, (a.x+b.x)/2, (a.y+b.y)/2), false);
  }
  for (const b of plan.river.bridges) {
    assert.equal(decorationClearance(plan, b.center.x, b.center.y), false);
    assert.equal(decorationClearance(plan, b.center.x + b.ux*(b.halfLength+2), b.center.y + b.uy*(b.halfLength+2)), false);
  }
  for (const e of plan.river.segments) assert.equal(decorationClearance(plan, e.a.x, e.a.y), false);
  const queriesBeforeSelection = queries;
  selectTrees(decoration, .5); makeTreeGeometry(medium);
  assert.equal(queries, queriesBeforeSelection);
  for (const tree of [full.find(t => t.type === 'broadleaf'), full.find(t => t.type === 'conifer')]) {
    const geometry = makeTreeGeometry([tree]);
    assert.ok(geometry.every(Number.isFinite));
    assert.equal(geometry.length / 21, tree.type === 'broadleaf' ? 60 : 72);
    const materials = new Set(); let low = Infinity;
    for (let i = 0; i < geometry.length; i += 7) {
      assert.ok(Math.hypot(geometry[i] - (tree.x - SIZE/2), geometry[i+1] - (tree.y - SIZE/2)) <= 1.8 * tree.size + 1e-4);
      low = Math.min(low, geometry[i+2]); materials.add(geometry[i+6]);
    }
    assert.ok(Math.abs(low - (tree.height - 40 - .15*tree.size)) < 1e-4);
    assert.deepEqual([...materials], [3, tree.type === 'broadleaf' ? 4 : 5]);
  }
  assert.equal(makeTreeGeometry([]).length, 0);
  // Equal topology, area, slope and random stream: only global height changes.
  const zones = [20,40,70].map(height => makeDecoration(plan, () => ({height,water:0,bridge:false})));
  assert.ok(zones.every(d => JSON.stringify(d.field.sites.map(s => s.eligible)) ===
    JSON.stringify(zones[0].field.sites.map(s => s.eligible))));
  const zoneCounts = zones.map(d => selectTrees(d,.65).length);
  assert.ok(zoneCounts[1] < zoneCounts[0] * .75, 'Mittelland must be noticeably sparser');
  assert.ok(zoneCounts[2] < zoneCounts[1] * .5, 'Hochland must be much sparser');
  assert.ok(zoneCounts[2] < zoneCounts[0] * .3, 'Strong Tiefland/Hochland density contrast');
  assert.equal(JSON.stringify(plan), before);
  return { full:full.length, medium:medium.length, sparse:sparse.length, zoneCounts };
})()`, context, { timeout: 5000 });
console.log(`Equal eligible areas at 65%: Tiefland/Mittelland/Hochland ${result.zoneCounts.join('/')} trees.`);
console.log(`Decoration: ${result.full}/${result.medium}/${result.sparse} trees at 100/65/30%; deterministic, read-only, nested densities, clear routes/banks/bridges, physical slopes, spacing and both models OK. Synthetic heights only.`);
