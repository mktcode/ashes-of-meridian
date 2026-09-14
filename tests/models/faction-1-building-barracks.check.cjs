const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { modelHarness, assertMesh } = require('../helpers/model-contract.cjs');
const names = ['faction1BarracksHull', 'faction1BarracksTissue', 'faction1BarracksSeeds'];
const entity = { id:17, faction:1, kind:'building', type:'barracks', team:0,
  x:12, z:-7, hp:1150, size:3, progress:1, rot:.7 };

function forbidRng(h) {
  vm.runInContext('Math.random = seeded = () => { throw Error("Nursery RNG"); };', h.context);
}
function upload(h) {
  const r = { meshes:{}, geometry(name, data) { this.meshes[name] = data; } };
  h.EntityModels.upload(r);
  return r.meshes;
}
function vertices(mesh) {
  return Array.from({ length:mesh.length / 9 }, (_, i) => mesh.slice(i*9, i*9+3));
}

test('Bloom nursery: three low asymmetric pods, open +Z mouth and bounded deterministic meshes', () => {
  const h = modelHarness(); forbidRng(h);
  const first = upload(h), second = upload(h);
  const specs = [
    { minTriangles:3000, maxTriangles:3150, min:[-2.71,.01,-2.71], max:[2.71,2.85,2.71] },
    { minTriangles:450, maxTriangles:500, min:[-1.7,.18,-1.6], max:[1.75,2.51,1.8] },
    { minTriangles:260, maxTriangles:300, min:[-.4,.35,.45], max:[.6,.98,1.25] }
  ];
  names.forEach((name, i) => {
    let call = 0;
    assertMesh(() => (call++ ? second : first)[name], specs[i]);
    for (const [x,,z] of vertices(first[name])) assert.ok(Math.hypot(x,z) < 2.8, 'inside unchanged radius-3 footprint');
  });
  assert.ok(names.reduce((sum, name) => sum + first[name].length / 27, 0) <= 3900,
    'three custom batches, at most 7800 triangles including a shadow repeat');
  const hull = vertices(first[names[0]]), tissue = vertices(first[names[1]]), seeds = vertices(first[names[2]]);
  assert.ok(hull.filter(([x,y,z]) => x < -.5 && z < -.3 && y > 2.6).length > 30, 'tall closed rear-left capsule');
  assert.ok(hull.filter(([x,y,z]) => x > 1 && z < 0 && y > 1.8 && y < 2.1).length > 30, 'smaller rear-right capsule');
  assert.ok(!hull.some(([x,y]) => x > .4 && y > 2.1), 'not a symmetric crown or central spire');
  assert.ok(hull.filter(([x,y,z]) => Math.abs(x-.12) > .7 && y > 1 && z > .5).length > 30, 'peeled-back side bracts');
  assert.ok(!hull.some(([x,y,z]) => Math.abs(x-.12) < .55 && z > 1.4 && y > .65), 'front mouth is genuinely open');
  assert.ok(hull.filter(([x,y,z]) => Math.abs(x-.12) < .6 && z > 1.6 && y < .5).length > 30, 'low forward leaf lip');
  assert.ok(tissue.filter(([,y,z]) => z > 1.2 && y < .6).length > 30, 'exposed nutrient bed');
  assert.ok(seeds.every(([,y,z]) => y < 1 && z > .45), 'attached embryos stay inside the front capsule');
  assert.ok(hull.filter(([x,y,z]) => Math.hypot(x,z) > 2.4 && y > .3 && y < .6).length > 100, 'spreading connecting roots');
});

test('Bloom nursery: static three-part assembly preserves team, build, preview and production orientation contracts', () => {
  const h = modelHarness(); forbidRng(h);
  assert.equal(h.BUILDINGS.barracks.size, 3);
  assert.equal(h.BUILDINGS.barracks.hp, 1150);
  const model = h.EntityModels.find(entity);
  assert.equal(model.id, 'faction-1/building/barracks');
  assert.ok(Object.isFrozen(model));
  for (const faction of [0,1,2]) for (const type of Object.keys(h.BUILDINGS))
    if (faction !== 1 || type !== 'barracks') assert.notEqual(h.EntityModels.find({ ...entity, faction, type }).id, model.id);
  assert.equal(h.EntityModels.find({ ...entity, kind:'unit' }), undefined);
  vm.runInContext('for (const key of Object.keys(geom)) geom[key] = () => { throw Error("Per-frame geometry"); }', h.context);
  const normal = h.draw(entity);
  assert.deepEqual(normal.map(c => c[0]), ['choirMound',...names], 'no floating crystal or reused tower pieces');
  assert.deepEqual(normal, h.draw(entity, {}, 0), 'no geometric animation');
  assert.deepEqual(normal, h.draw({ ...entity, progress:undefined, rot:-2.1 }), 'default completion and fixed building yaw');
  assert.deepEqual(h.draw({ ...entity, hp:0 }), []);
  for (const team of [0,1]) for (const progress of [0,.4,1]) {
    const state = { ...entity, team, progress }, build = Math.max(.15,progress),
      yaw = h.BUILDING_YAW + team*Math.PI, faction = h.FACTIONS[1],
      teamColor = team ? 0xe98680 : faction.color, accent = team ? 0xffaf87 : faction.accent;
    const calls = h.draw(state);
    assert.equal(calls.length, 4 + (progress < 1 ? 5 : 0), 'unchanged common scaffold');
    assert.deepEqual(calls[0],
      ['choirMound',12,0,-7,3,build,3,0x70523b,yaw,0,0,0,1,'dynamic',h.MAT.ROCK]);
    for (const options of [{}, { ghost:true }, { ghost:true, tint:0x99e4c6 },
      ...[0,.3,1].map(alpha => ({ tint:0x99e4c6, alpha, layer:'effects', material:h.MAT.AUTO }))]) {
      const rendered = h.draw(state, options);
      const colors = [options.ghost ? 0x68717d : options.tint || faction.metal, options.tint || teamColor, accent];
      names.forEach((name, i) => assert.deepEqual(rendered.find(c => c[0] === name),
        [name,12,0,-7,1,build,1,colors[i],yaw,0,0,[0,.32,.35][i],options.alpha??1,options.layer||'dynamic',options.material??h.MAT.BIO]));
    }
  }
});

test('Bloom nursery: complete triangle budget and only shared organic light pulsing', () => {
  const h = modelHarness(), meshes = upload(h), counts = Object.fromEntries(names.map(n => [n,meshes[n].length/27]));
  counts.choirMound = h.geom.choirMound().length/27;
  const normal = h.draw(entity);
  assert.ok(normal.reduce((sum,c) => sum + counts[c[0]],0) <= 4100, 'includes shared earth mound');
  vm.runInContext(`{
    const r = { quality:1, calls:[], add(...args) { this.calls.push(args); } };
    const e = ${JSON.stringify(entity)};
    renderEntity(r,e,0); const before = r.calls; r.calls = [];
    renderEntity(r,e,1); const after = r.calls;
    globalThis.nurseryPulse = {before,after};
  }`, h.context);
  const {before,after} = h.context.nurseryPulse;
  for (let i = 0; i < before.length; i++) {
    assert.deepEqual(before[i].slice(0,11), after[i].slice(0,11), 'no motion');
    assert.deepEqual(before[i].slice(12), after[i].slice(12), 'no material/opacity changes');
    if (names.slice(1).includes(before[i][0])) {
      assert.notEqual(before[i][11], after[i][11]);
      assert.ok(before[i][11] >= .24 && before[i][11] < .44, 'subtle tissue glow');
    }
  }
});
