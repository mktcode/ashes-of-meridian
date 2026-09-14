const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { modelHarness, assertMesh } = require('../helpers/model-contract.cjs');
const names = ['Nest','Hull','Abdomen','Chambers','Senses','Feeler'].map(n => `faction1Hq${n}`);
const entity = { id:17, faction:1, kind:'building', type:'hq', team:0,
  x:12, z:-7, hp:2600, size:4.4, progress:1, rot:.7 };
function upload(h) {
  const r = { meshes:{}, geometry(name,data) { this.meshes[name] = data; } };
  h.EntityModels.upload(r); return r.meshes;
}
function vertices(mesh) {
  return Array.from({length:mesh.length/9},(_,i) => mesh.slice(i*9,i*9+3));
}

test('Bloom queen: bounded creature, four gripping limbs, open rooted nest and distinct crown/face', () => {
  const h = modelHarness();
  vm.runInContext('Math.random = seeded = () => { throw Error("Queen RNG"); };',h.context);
  const first = upload(h), second = upload(h), specs = [
    {minTriangles:900,maxTriangles:1050,min:[-4.1,.06,-4.1],max:[4.1,1.7,3.2]},
    {minTriangles:1600,maxTriangles:1850,min:[-3.35,.20,-2.45],max:[3.35,5.70,2.85]},
    {minTriangles:380,maxTriangles:420,min:[-2.1,.06,-2.15],max:[2.1,2.1,1.45]},
    {minTriangles:550,maxTriangles:600,min:[-2.2,.84,-1.3],max:[2.2,1.52,.27]},
    {minTriangles:260,maxTriangles:300,min:[-.62,2.64,1.2],max:[.62,4.3,1.96]},
    {minTriangles:100,maxTriangles:120,min:[-.05,-.05,-.4],max:[1,1.1,.15]}
  ];
  names.forEach((name,i) => {
    let call = 0;
    assertMesh(() => (call++ ? second : first)[name],specs[i]);
  });
  const nest = vertices(first[names[0]]), body = vertices(first[names[1]]),
    abdomen = vertices(first[names[2]]), senses = vertices(first[names[4]]);
  assert.ok(nest.filter(([x,y,z]) => Math.hypot(x,z)>3.4 && y<.7).length>300,'nest has spreading roots');
  assert.ok(nest.filter(([,y,z]) => y>1 && z<0).length>100,'raised rear leaf wreath');
  for (const side of [-1,1]) {
    assert.ok(body.filter(([x,y,z]) => x*side>2.5 && y<.7 && z>2.2).length>50,'front gripping limb');
    assert.ok(body.filter(([x,y,z]) => x*side>2.9 && y<.7 && z< -2.1).length>10,'rear planted limb');
    assert.ok(senses.some(([x,y,z]) => x*side>.25 && y>4 && z>1.8),'paired forward eyes, not a floating core');
  }
  assert.ok(body.filter(([x,y,z]) => Math.abs(x)<.8 && y>5 && z<1).length>60,'attached leaf crown');
  assert.ok(abdomen.filter(([x,y,z]) => Math.abs(x)>1.8 && y>.6 && z<.1).length>50,'broad, heavy rear sac');
  assert.ok([...nest,...body].every(([x,y,z]) => !(Math.abs(x)<1 && z>2.4 && y>.35)),
    'worker approach stays visibly open at +Z');
  const counts = Object.fromEntries(names.map(n => [n,first[n].length/27]));
  counts.choirMound = h.geom.choirMound().length/27;
  assert.ok(h.draw(entity).reduce((sum,c) => sum+counts[c[0]],0)<=4500,
    'six custom mesh batches, repeated feeler, shared mound; at most 9000 triangles with shadows');
});

test('Bloom queen: name changes, but HQ identity, supply, build scaffolding and preview transforms remain intact', () => {
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
  assert.deepEqual(normal.map(c => c[0]),['choirMound',...names,names[5]]);
  assert.deepEqual(h.draw({...entity,progress:undefined,rot:-2.1}),normal,'stationary building, not a walking/aiming unit');
  assert.deepEqual(h.draw({...entity,hp:0}),[]);
  for (const team of [0,1]) for (const progress of [0,.4,1]) {
    const state = {...entity,team,progress}, build = Math.max(.15,progress), yaw = h.BUILDING_YAW+team*Math.PI,
      f = h.FACTIONS[1], color = team?0xe98680:f.color, accent = team?0xffaf87:f.accent;
    for (const options of [{},{ghost:true},{ghost:true,tint:0x99e4c6},
      ...[0,.3,1].map(alpha => ({tint:0x99e4c6,alpha,layer:'effects',material:h.MAT.AUTO}))]) {
      const calls = h.draw(state,options), metal = options.ghost?0x68717d:options.tint||f.metal,
        tail = [options.alpha??1,options.layer||'dynamic',options.material??h.MAT.BIO];
      assert.equal(calls.length,8+(progress<1?5:0),'unchanged common construction scaffold');
      assert.deepEqual(calls[0],['choirMound',12,0,-7,4.4,build,4.4,
        options.ghost?0x68717d:options.tint||0x70523b,yaw,0,0,0,...tail.slice(0,2),options.material??h.MAT.ROCK]);
      for (const n of names.slice(0,2)) assert.deepEqual(calls.find(c => c[0]===n),
        [n,12,0,-7,1,build,1,metal,yaw,0,0,0,...tail]);
      assert.deepEqual(calls.find(c => c[0]===names[4]),
        [names[4],12,0,-7,1,build,1,options.tint||color,yaw,0,0,.4,...tail]);
      const abdomen = calls.find(c => c[0]===names[2]), chambers = calls.find(c => c[0]===names[3]);
      assert.deepEqual(chambers.slice(1,7),abdomen.slice(1,7),'chambers breathe with the sac');
      assert.equal(abdomen[7],metal); assert.equal(chambers[7],accent);
      for (const c of [abdomen,chambers,...calls.filter(c => c[0]===names[5])]) {
        assert.deepEqual(c.slice(12),tail); assert.ok(c[5]>0);
      }
    }
  }
});

test('Bloom queen: only sac and feelers move, bounded over a full breath cycle with planted feet and nest', () => {
  const h = modelHarness(), meshes = upload(h);
  meshes.choirMound = h.geom.choirMound();
  vm.runInContext('Math.random = seeded = () => { throw Error("Queen RNG"); };',h.context);
  const e = {...entity,x:0,z:0}, first = h.draw(e,{},0), scales = [], sways = [];
  for (const progress of [0,.4,1]) for (const time of [0,1,2,3,4,5]) {
    const calls = h.draw({...e,progress},{},time), build = Math.max(.15,progress), phase = time*1.4+e.id*.61,
      abdomen = calls.find(c => c[0]===names[2]), feelers = calls.filter(c => c[0]===names[5]);
    assert.equal(abdomen[2],.68*build); assert.equal(abdomen[5],(1+Math.sin(phase)*.018)*build);
    assert.ok(Math.abs(abdomen[1]+Math.sin(h.BUILDING_YAW)*1.10)<1e-12);
    assert.ok(Math.abs(abdomen[3]+Math.cos(h.BUILDING_YAW)*1.10)<1e-12);
    assert.deepEqual(feelers.map(c => c[9]),[-1,1].map(side => Math.sin(phase*.43+side)*.035));
    assert.deepEqual(feelers.map(c => c[8]),[h.BUILDING_YAW+Math.PI,h.BUILDING_YAW]);
    for (const c of feelers) assert.equal(c[2],4.38*build,'feelers pivot at the head');
    if (progress!==1) continue;
    scales.push(abdomen[5]); sways.push(feelers[0][9]);
    for (const n of ['choirMound',names[0],names[1],names[4]])
      assert.deepEqual(calls.find(c => c[0]===n),first.find(c => c[0]===n),'no whole-body bob, walk or nest movement');
    for (const c of calls) {
      const mesh = [];
      h.ModelMesh.bake(mesh,meshes[c[0]],{x:c[1],y:c[2],z:c[3],sx:c[4],sy:c[5],sz:c[6],ry:c[8],rx:c[9],rz:c[10]});
      for (let i = 0; i < mesh.length; i += 9) {
        assert.ok(mesh[i+1]>=-.19 && mesh[i+1]<=5.70,'no new shadow/caster height requirement');
        assert.ok(Math.hypot(mesh[i],mesh[i+2])<=4.4*1.09,'all animation stays inside the existing foundation envelope');
        if (c[0]!=='choirMound') assert.ok(Math.hypot(mesh[i],mesh[i+2])<4.3,'creature and nest stay inside the HQ radius');
      }
    }
  }
  assert.ok(Math.max(...scales)-Math.min(...scales)>.025,'subtle visible breath');
  assert.ok(Math.max(...sways)-Math.min(...sways)>.02,'living feelers, not static ornament');
});
