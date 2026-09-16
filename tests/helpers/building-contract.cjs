const assert = require('node:assert/strict');
const vm = require('node:vm');
const { modelHarness, assertMesh } = require('./model-contract.cjs');

// Every remaining building owns a small declarative test specification, not a runtime model DSL.
function checkBuilding({ faction, type, mesh, min, max, minTriangles, maxTriangles,
  maxInstances = 36, totalTriangles = 3000, features = [], height, extraMeshes = [] }) {
  const h = modelHarness(), id = `faction-${faction}/building/${type}`, d = h.BUILDINGS[type];
  vm.runInContext('Math.random = seeded = () => { throw Error("Building mesh/draw RNG"); };', h.context);
  const upload = () => {
    const r = { meshes: {}, geometry(name, data) {
      assert.ok(!Object.hasOwn(this.meshes, name)); this.meshes[name] = data;
    } };
    h.EntityModels.upload(r); return r.meshes;
  }, first = upload(), second = upload();
  for (const spec of [{ mesh, min, max, minTriangles, maxTriangles }, ...extraMeshes]) {
    let call = 0;
    assertMesh(() => (call++ ? second : first)[spec.mesh], spec);
  }
  const vertices = [];
  for (let i = 0; i < first[mesh].length; i += 9) vertices.push(first[mesh].slice(i, i + 3));
  for (const feature of features) assert.ok(vertices.filter(p => p.every((v, k) =>
    v >= feature.min[k] - 1e-9 && v <= feature.max[k] + 1e-9)).length >= feature.vertices, feature.name);

  const counts = Object.fromEntries(Object.entries(first).map(([k, v]) => [k, v.length / 27]));
  for (const name of ['box', 'octa', 'sphere', 'ring', 'commandHull']) counts[name] = h.geom[name]().length / 27;
  counts.choirMound = h.geom.choirMound().length / 27;
  counts.hex = h.geom.cylinder(6).length / 27; counts.cylinder = h.geom.cylinder(10).length / 27;
  counts.cone = h.geom.cylinder(7, 0).length / 27;
  for (const [name, data] of Object.entries(h.geom.turretAssembly())) counts[name] = data.length / 27;
  // Ban all geometry helpers during assembly, not just one likely primitive.
  vm.runInContext('for (const key of Object.keys(geom)) geom[key] = () => { throw Error("Per-frame geometry"); };', h.context);
  const e = { id: 17, faction, type, kind: 'building', team: 0, hp: d.hp, size: d.size,
    x: 12, z: -7, progress: 1, rot: .7 }, normal = h.draw(e), primary = calls => calls.find(c => c[0] === mesh);
  assert.equal(h.EntityModels.find(e).id, id);
  assert.ok(Object.isFrozen(h.EntityModels.find(e)));
  assert.equal(h.EntityModels.find({ ...e, kind: 'unit' }), undefined);
  for (const f of [0, 1, 2]) for (const t of Object.keys(h.BUILDINGS)) if (f !== faction || t !== type)
    assert.notEqual(h.EntityModels.find({ ...e, faction: f, type: t }).id, id);
  assert.equal(normal.filter(c => c[0] === mesh).length, 1);
  assert.ok(normal.length <= maxInstances, 'finished instance budget including legacy orbital effects');
  assert.ok(normal.reduce((sum, c) => sum + counts[c[0]], 0) <= totalTriangles, 'complete model triangle budget');
  assert.deepEqual(normal, h.draw({ ...e, progress: undefined }));
  assert.deepEqual(h.draw({ ...e, hp: 0 }), []);
  for (const team of [0, 1]) for (const progress of [0, .4, 1]) {
    const state = { ...e, team, progress }, build = Math.max(.15, progress), yaw = h.BUILDING_YAW + team * Math.PI,
      calls = h.draw(state), f = h.FACTIONS[faction], color = team ? 0xe98680 : f.color;
    assert.equal(calls.length, normal.length + (progress < 1 ? 5 : 0), 'shared construction scaffold');
    if (faction === 1) assert.deepEqual(calls[0],
      ['choirMound',12,0,-7,d.size,build,d.size,0x70523b,yaw,0,0,0,1,'dynamic',h.MAT.ROCK]);
    else if (faction === 2 && ['barracks','depot','factory'].includes(type)) assert.equal(calls[0][0], mesh, 'gate owns its angular foundation');
    else assert.deepEqual(calls.slice(0, 2), [
      ['hex',12,.15*build,-7,d.size*1.09,.3*build,d.size*1.09,0x384552,yaw+.12,0,0,0,1,'dynamic',faction===1?h.MAT.BIO:h.MAT.METAL],
      ['ring',12,.33*build,-7,d.size*1.03,.1*build,d.size*1.03,color,yaw,0,0,.4,1,'dynamic',faction===1?h.MAT.BIO:h.MAT.METAL]
    ]);
    for (const options of [{}, { ghost: true }, { ghost: true, tint: 0x99e4c6 },
      ...[0,.3,1].map(alpha => ({ tint: 0x99e4c6, alpha, layer: 'effects', material: h.MAT.AUTO }))]) {
      const rendered = h.draw(state, options), c = primary(rendered);
      assert.deepEqual(c, [mesh,12,0,-7,1,build,1,options.ghost?0x68717d:options.tint||f.metal,
        yaw,0,0,0,options.alpha??1,options.layer||'dynamic',options.material??(faction===1?h.MAT.BIO:h.MAT.METAL)]);
    }
    for (const time of [0,9,20]) {
      const timed = h.draw(state, {}, time), accent = team ? 0xffaf87 : f.accent;
      if (faction === 1) {
        assert.deepEqual(timed.find(c => c[0]==='octa' && c[11]===.85),
          ['octa',12,(height+Math.sin(time+e.id)*.14)*build,-7,d.size*.3,1.3*build,d.size*.3,accent,yaw+time*.22,0,0,.85,1,'dynamic',h.MAT.BIO]);
        if (type === 'hangar') assert.deepEqual(timed.find(c => c[0]==='ring' && c[13]==='effects' && c[2]===height*.9),
          ['ring',12,height*.9,-7,d.size*.8,1,d.size*.8,accent,0,0,0,1.2,.7,'effects']);
      }
      if (faction === 2) {
        if (!['barracks','depot','factory'].includes(type)) {
          assert.deepEqual(timed.find(c => c[0]==='octa' && c[11]===.75),
            ['octa',12,height*.79*build,-7,d.size*.21,height*.35*build,d.size*.21,color,yaw+time*.1,0,0,.75,1,'dynamic',h.MAT.METAL]);
          assert.deepEqual(timed.find(c => c[0]==='octa' && c[5]===height*.43*build),
            ['octa',12,height*.67*build,-7,d.size*.38,height*.43*build,d.size*.38,f.metal,yaw+.4,0,0,0,1,'dynamic',h.MAT.METAL], 'original pale core keeps its instanced lighting');
        }
        if (['hq','refinery','hangar'].includes(type)) {
          assert.deepEqual(timed.find(c => c[0]==='ring' && c[9]===Math.PI/2),
            ['ring',12,height*.62,-7,d.size*.88,1,d.size*.88,accent,time*.18,Math.PI/2,0,.85,.8,'effects']);
          assert.ok(timed.some(c => c[0]==='ring' && c[2]===height*.4 && c[11]===1.2 && c[12]===.6));
        }
      }
      if (faction === 0 && type === 'refinery') assert.equal(timed.find(c => c[0]==='octa')[8],yaw+time*.22);
      if (faction === 0 && type === 'hq') assert.equal(timed.find(c => c[0]==='cone')[8],yaw+time*.13);
    }
  }
  if (faction > 0 || type === 'depot') assert.deepEqual(h.draw({ ...e, rot: -2.1 }), normal, 'no new targeting mode');
  if (faction === 0 && type === 'depot') assert.deepEqual(h.draw(e, {}, 0), normal, 'static cargo modules');
  if (faction === 0 && type === 'turret') for (const rot of [-2.1,0,.7,3.14]) {
    const calls = h.draw({ ...e, rot, team: 1 });
    assert.equal(calls.find(c => c[0]==='turretBase')[8],h.BUILDING_YAW+Math.PI);
    assert.ok(Math.abs(calls.find(c => c[0]==='turretHead')[8]-rot)<1e-12);
  }
}
module.exports = { checkBuilding };
