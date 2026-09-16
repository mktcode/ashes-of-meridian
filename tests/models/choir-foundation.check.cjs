const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { modelHarness, assertMesh } = require('../helpers/model-contract.cjs');

test('Choir earth mound is low, closed, outward and irregular within the former platform footprint', () => {
  const h = modelHarness();
  vm.runInContext('Math.random = seeded = () => { throw Error("Mound RNG"); };', h.context);
  const mesh = assertMesh(() => h.geom.choirMound(), {
    minTriangles:40, maxTriangles:40, min:[-1.09,-.18,-1.09], max:[1.09,.30,1.09]
  });
  const edges = new Map(), radii = new Set();
  for (let i = 0; i < mesh.length; i += 27) {
    const points = [0,9,18].map(k => mesh.slice(i+k,i+k+3));
    assert.ok(i/27%4 === 3 ? mesh[i+4] < 0 : mesh[i+4] > 0, 'top slopes up, underside down; no vertical walls');
    for (let j = 0; j < 3; j++) {
      const [x,y,z] = points[j];
      assert.ok(Math.hypot(x,z) < 1.09);
      if (y === -.14) radii.add(Math.hypot(x,z).toFixed(3));
      const a = points[j].join(','), b = points[(j+1)%3].join(','), key = [a,b].sort().join('|'),
        edge = edges.get(key) || { count:0, winding:0 };
      edge.count++; edge.winding += a < b ? 1 : -1; edges.set(key,edge);
    }
  }
  assert.equal(radii.size, 10, 'uneven soil edge, not a regular polygon plinth');
  assert.ok([...edges.values()].every(e => e.count === 2 && e.winding === 0), 'watertight with consistent winding');
});

test('Choir buildings keep soil foundations except the flower-seated queen, including previews', () => {
  const h = modelHarness();
  vm.runInContext('Math.random = seeded = () => { throw Error("Draw RNG"); }; for (const k of Object.keys(geom)) geom[k] = () => { throw Error("Frame geometry"); };', h.context);
  for (const [type,d] of Object.entries(h.BUILDINGS)) for (const team of [0,1]) for (const progress of [0,.4,1]) {
    const e = { id:17, faction:1, kind:'building', type, team, progress, x:12, z:-7, size:d.size, hp:d.hp },
      build = Math.max(.15,progress), yaw = h.BUILDING_YAW + team*Math.PI;
    for (const options of [{}, {ghost:true}, {ghost:true,tint:0x99e4c6},
      ...[0,.3,1].map(alpha => ({tint:0x99e4c6,alpha,layer:'effects',material:h.MAT.AUTO}))]) {
      const calls = h.draw(e,options), mounds = calls.filter(c => c[0] === 'choirMound');
      assert.equal(mounds.length,type==='hq'?0:1);
      if (type==='hq') assert.equal(calls[0][0],'faction1HqFlower','queen owns the five-petal base');
      else assert.deepEqual(mounds[0], ['choirMound',12,0,-7,d.size,build,d.size,
        options.ghost ? 0x68717d : options.tint || 0x70523b,yaw,0,0,0,
        options.alpha??1,options.layer||'dynamic',options.material??h.MAT.ROCK]);
      assert.ok(!calls.some(c => c[0] === 'hex'), 'no mechanical platform');
      assert.ok(!calls.some(c => c[0] === 'ring' && c[2] === .33*build), 'no permanent platform rim');
      if (progress < 1) assert.ok(calls.some(c => c[0] === 'ring' && c[13] === 'effects' && c[2] === .13), 'construction marker retained');
    }
    for (const faction of [0,2]) {
      const calls = h.draw({...e,faction});
      if (faction === 2 && type === 'barracks') assert.equal(calls[0][0],'faction2BarracksHull', 'gate owns its angular foundation');
      else { assert.equal(calls[0][0],'hex'); assert.equal(calls[1][0],'ring'); }
      assert.ok(!calls.some(c => c[0] === 'choirMound'));
    }
  }
  for (const [type,d] of Object.entries(h.UNITS)) assert.ok(!h.draw({
    id:17,faction:1,kind:'unit',type,team:0,x:0,z:0,size:d.size,hp:d.hp
  }).some(c => c[0] === 'choirMound'), 'units do not grow foundations');
});
