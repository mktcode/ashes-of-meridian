const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { modelHarness } = require('../helpers/model-contract.cjs');
const names = ['Flower','Hull','Abdomen','Wings','Eyes','Senses','Antenna'].map(n => `faction1Hq${n}`);
const entity = { id:17, faction:1, kind:'building', type:'hq', team:0,
  x:12, z:-7, hp:2600, size:4.4, progress:1, rot:.7 };
function upload(h) {
  const r = { meshes:{}, geometry(name,data) { this.meshes[name] = data; } };
  h.EntityModels.upload(r); return r.meshes;
}
// These organic meshes deliberately use smooth, crease-aware normals, not the flat
// normals required by assertMesh for the older models. Validate the actual normals.
function checkSoftMesh(mesh, {min,max,budget}) {
  assert.equal(mesh.length%27,0); assert.ok(mesh.length/27<=budget);
  const edges = new Map(); let rounded = 0;
  for (let i = 0; i < mesh.length; i += 27) {
    const points = [0,9,18].map(k => mesh.slice(i+k,i+k+3)),
      a = points[0], u = points[1].map((v,k) => v-a[k]), v = points[2].map((v,k) => v-a[k]),
      cross = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]], area = Math.hypot(...cross);
    assert.ok(area>1e-8,'no collapsed poles, veins or caps');
    for (let j = 0; j < 3; j++) {
      const at = i+j*9, p = mesh.slice(at,at+9), normal = p.slice(3,6);
      assert.ok(p.every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(...normal)-1)<1e-9,'unit smooth normal');
      const dot = normal.reduce((sum,v,k) => sum+v*cross[k]/area,0);
      assert.ok(dot>.149,'no inward lighting normals at thin petal edges');
      if (dot<.999) rounded++;
      for (let k = 0; k < 3; k++) {
        assert.ok(p[k]>=min[k]-1e-9 && p[k]<=max[k]+1e-9,'bounded detailed geometry');
        assert.ok(p[k+6]>0 && p[k+6]<1.6,'relative material tint');
      }
      const key = n => points[n].map(v => Math.round(v*1e6)).join(','),
        from = key(j), to = key((j+1)%3), edgeKey = [from,to].sort().join('|'), edge = edges.get(edgeKey)||[0,0];
      edge[0]++; edge[1] += from<to?1:-1; edges.set(edgeKey,edge);
    }
  }
  assert.ok([...edges.values()].every(([count,winding]) => count===2 && winding===0),'closed consistently wound components');
  assert.ok(rounded>mesh.length/9*.30,'rounded surfaces, not the old faceted mantis');
}
function surfaceAt(mesh,x,z) {
  let height = -Infinity;
  for (let i = 0; i < mesh.length; i += 27) {
    const [a,b,c] = [0,9,18].map(k => mesh.slice(i+k,i+k+3)),
      det = (b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if (Math.abs(det)<1e-10) continue;
    const u = ((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det,
      v = ((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det, w = 1-u-v;
    if (Math.min(u,v,w)>=-1e-9) height = Math.max(height,u*a[1]+v*b[1]+w*c[1]);
  }
  return height;
}

test('Bloom queen: five separate petal lobes and a rounded, compact bumblebee silhouette', () => {
  const h = modelHarness();
  vm.runInContext('Math.random = seeded = () => { throw Error("Queen RNG"); };',h.context);
  const first = upload(h), second = upload(h), specs = [
    {min:[-4.1,.04,-3.6],max:[4.1,.70,4.25],budget:2100},
    {min:[-2.25,.10,-1.8],max:[2.25,3.35,2.6],budget:4200},
    {min:[-2.1,0,-2],max:[2.1,2.95,2],budget:1450},
    {min:[-2.25,2.4,-1.9],max:[2.25,3.25,.55],budget:800},
    {min:[-1.03,1.76,1.98],max:[1.03,2.64,2.50],budget:1150},
    {min:[-.86,2.03,2.38],max:[.86,2.50,2.49],budget:450},
    {min:[-.07,-.03,-.07],max:[.50,.84,.26],budget:320}
  ];
  names.forEach((name,i) => { assert.deepEqual(first[name],second[name]); checkSoftMesh(first[name],specs[i]); });
  const flower = first[names[0]], hull = first[names[1]], sac = first[names[2]], eyes = first[names[4]];
  for (let i = 0; i < 5; i++) {
    const a = i*Math.PI*2/5, between = a+Math.PI/5;
    assert.ok(surfaceAt(flower,Math.sin(a)*3.6,Math.cos(a)*3.6)>.3,'broad raised petal');
    assert.equal(surfaceAt(flower,Math.sin(between)*3.6,Math.cos(between)*3.6),-Infinity,
      'real notch between each of exactly five lobes, not a circular plate');
  }
  assert.ok(surfaceAt(hull,0,1.7)>2.7,'large round head merges into the shoulders');
  assert.ok(surfaceAt(sac,0,0)>2.8 && surfaceAt(sac,1.7,0)>2,'fat abdomen, not a narrow upright thorax');
  for (const side of [-1,1]) {
    assert.ok(surfaceAt(eyes,side*.7,2.24)>2.5,'two large round insect eyes');
    for (const [x,z] of [[1.38,1.45],[1.83,.28],[2.0,-.92]])
      assert.ok(surfaceAt(hull,side*x,z)>.95,'three short folded legs on each side');
  }
  const colors = new Set();
  for (let i = 0; i < sac.length; i += 9) colors.add(sac.slice(i+6,i+9).join(','));
  assert.equal(colors.size,2,'pollen and moss bands remain readable across smooth geometry');
  const counts = Object.fromEntries(names.map(n => [n,first[n].length/27]));
  assert.ok(h.draw(entity).reduce((sum,c) => sum+counts[c[0]],0)<=11000,
    'seven cached mesh batches, two antenna instances; at most 22000 triangles including shadows');
});

test('Bloom queen: flower replaces ONLY the HQ mound, while building role and all preview contracts survive', () => {
  const h = modelHarness();
  assert.equal(h.FACTIONS[1].buildings.hq,'Bloom queen');
  assert.equal(h.BUILDINGS.hq.size,4.4); assert.equal(h.BUILDINGS.hq.hp,2600); assert.equal(h.BUILDINGS.hq.cap,24);
  const model = h.EntityModels.find(entity);
  assert.equal(model.id,'faction-1/building/hq'); assert.ok(Object.isFrozen(model));
  assert.equal(h.EntityModels.find({...entity,kind:'unit'}),undefined);
  for (const faction of [0,1,2]) for (const type of Object.keys(h.BUILDINGS))
    if (faction!==1 || type!=='hq') assert.notEqual(h.EntityModels.find({...entity,faction,type}).id,model.id);
  vm.runInContext('Math.random = seeded = () => { throw Error("Queen RNG"); }; for (const k of Object.keys(geom)) geom[k] = () => { throw Error("Frame geometry"); };',h.context);
  const normal = h.draw(entity);
  assert.deepEqual(normal.map(c => c[0]),[...names,names[6]],'no mound, platform, long limbs or old crown');
  assert.deepEqual(h.draw({...entity,progress:undefined,rot:-2.1}),normal,'still an immobile HQ');
  assert.deepEqual(h.draw({...entity,hp:0}),[]);
  for (const team of [0,1]) for (const progress of [0,.4,1]) {
    const state = {...entity,team,progress}, build = Math.max(.15,progress), yaw = h.BUILDING_YAW+team*Math.PI,
      f = h.FACTIONS[1], color = team?0xe98680:f.color, accent = team?0xffaf87:f.accent;
    for (const options of [{},{ghost:true},{ghost:true,tint:0x99e4c6},
      ...[0,.3,1].map(alpha => ({tint:0x99e4c6,alpha,layer:'effects',material:h.MAT.AUTO}))]) {
      const calls = h.draw(state,options), tint = c => options.ghost?0x68717d:options.tint||c,
        tail = [options.alpha??1,options.layer||'dynamic',options.material??h.MAT.BIO];
      assert.equal(calls.length,8+(progress<1?5:0),'common construction scaffold is unchanged');
      for (const [i,c,glow] of [[0,accent,0],[1,f.metal,0],[3,color,0],[4,0x193931,0],[5,color,.35]])
        assert.deepEqual(calls.find(c => c[0]===names[i]),[names[i],12,0,-7,1,build,1,tint(c),yaw,0,0,glow,...tail]);
      for (const c of calls.filter(c => [names[2],names[6]].includes(c[0]))) {
        assert.equal(c[7],tint(f.metal)); assert.deepEqual(c.slice(12),tail);
      }
    }
  }
});

test('Bloom queen: slow belly breathing and tiny antenna motion never move the flower, wings or feet', () => {
  const h = modelHarness(), meshes = upload(h);
  vm.runInContext('Math.random = seeded = () => { throw Error("Queen RNG"); };',h.context);
  const e = {...entity,x:0,z:0}, first = h.draw(e,{},0), scales = [], sways = [];
  for (const progress of [0,.4,1]) for (const time of [0,1,2,3,4,5]) {
    const calls = h.draw({...e,progress},{},time), build = Math.max(.15,progress), phase = time*1.4+e.id*.61,
      abdomen = calls.find(c => c[0]===names[2]), antennae = calls.filter(c => c[0]===names[6]);
    assert.equal(abdomen[2],.56*build); assert.equal(abdomen[5],(1+Math.sin(phase)*.014)*build);
    assert.ok(Math.abs(abdomen[1]+Math.sin(h.BUILDING_YAW)*1.02)<1e-12);
    assert.ok(Math.abs(abdomen[3]+Math.cos(h.BUILDING_YAW)*1.02)<1e-12);
    assert.deepEqual(antennae.map(c => c[9]),[-1,1].map(side => Math.sin(phase*.43+side)*.035));
    assert.deepEqual(antennae.map(c => c[8]),[h.BUILDING_YAW+Math.PI,h.BUILDING_YAW]);
    for (const c of antennae) assert.equal(c[2],2.70*build,'antennae pivot on the low round head');
    if (progress!==1) continue;
    scales.push(abdomen[5]); sways.push(antennae[0][9]);
    for (const i of [0,1,3,4,5]) assert.deepEqual(calls.find(c => c[0]===names[i]),first.find(c => c[0]===names[i]));
    for (const c of calls) {
      const mesh = [];
      h.ModelMesh.bake(mesh,meshes[c[0]],{x:c[1],y:c[2],z:c[3],sx:c[4],sy:c[5],sz:c[6],ry:c[8],rx:c[9],rz:c[10]});
      for (let i = 0; i < mesh.length; i += 9) {
        assert.ok(mesh[i+1]>=0 && mesh[i+1]<=3.65,'low rounded creature, not the old tall mantis');
        assert.ok(Math.hypot(mesh[i],mesh[i+2])<4.4,'flower and animation stay inside HQ radius');
      }
    }
  }
  assert.ok(Math.max(...scales)-Math.min(...scales)>.02);
  assert.ok(Math.max(...sways)-Math.min(...sways)>.02);
});
