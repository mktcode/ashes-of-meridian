const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { modelHarness, assertMesh } = require('./model-contract.cjs');

// Unit-specific contracts remain separate from building scaffolds and orbital effects.
function checkUnit({ type, meshes: specs, min, max, totalTriangles, maxInstances, features = [] }) {
  const h = modelHarness(), id = `faction-0/unit/${type}`, d = h.UNITS[type], mesh = specs[0].mesh;
  vm.runInContext('Math.random = seeded = () => { throw Error("Unit mesh/draw RNG"); };', h.context);
  // Each file can register before content, geometry or a GPU even exists.
  let descriptor;
  const isolated = vm.createContext({ registerEntityModel: model => { descriptor = model; } });
  vm.runInContext('Math.random = () => { throw Error("Registration RNG"); };', isolated);
  vm.runInContext(fs.readFileSync(path.join(__dirname, `../../dist/src/renderer/models/faction-0-unit-${type}.js`), 'utf8'), isolated);
  assert.equal(descriptor.id, id);
  isolated.geom = h.geom; isolated.ModelMesh = h.ModelMesh;
  const uploaded = {}, r = { meshes: {}, geometry(name, data) {
    assert.ok(!Object.hasOwn(uploaded, name)); uploaded[name] = data;
  } };
  h.EntityModels.upload(r);
  for (const spec of specs) {
    assertMesh(descriptor.meshes[spec.mesh], spec);
    assert.equal(JSON.stringify(uploaded[spec.mesh]), JSON.stringify(descriptor.meshes[spec.mesh]()));
  }
  const vertices = [];
  for (let i = 0; i < uploaded[mesh].length; i += 9) vertices.push(uploaded[mesh].slice(i, i + 3));
  for (const feature of features) assert.ok(vertices.filter(p => p.every((v, k) =>
    v >= feature.min[k] - 1e-9 && v <= feature.max[k] + 1e-9)).length >= feature.vertices, feature.name);
  for (const name of ['box','octa','sphere','ring','workerHull','workerDrill']) uploaded[name] = h.geom[name]();
  uploaded.hex = h.geom.cylinder(6); uploaded.cylinder = h.geom.cylinder(10);
  const counts = Object.fromEntries(Object.entries(uploaded).map(([key, data]) => [key, data.length / 27]));
  vm.runInContext('for (const key of Object.keys(geom)) geom[key] = () => { throw Error("Per-frame geometry"); };', h.context);
  const e = { id:17, faction:0, team:0, kind:'unit', type, hp:d.hp, size:d.size,
    x:12, z:-7, rot:.7, walk:0, carry:0 }, primary = calls => calls.find(c => c[0] === mesh), normal = h.draw(e);
  assert.equal(h.EntityModels.find(e).id, id); assert.ok(Object.isFrozen(h.EntityModels.find(e)));
  for (const faction of [1,2]) assert.notEqual(h.EntityModels.find({...e, faction})?.id, id);
  // Detailed destroyers have their own opt-in model contract (and a larger test heap footprint).
  for (const other of Object.keys(h.UNITS).filter(t => t !== type && t !== 'destroyer'))
    assert.notEqual(h.EntityModels.find({...e, type:other}).id, id);
  assert.equal(h.EntityModels.find({...e, kind:'building'}), undefined);
  assert.equal(normal.filter(c => c[0] === mesh).length, 1);
  for (const carry of [0,10]) {
    const calls = h.draw({...e, carry});
    assert.ok(calls.length <= maxInstances, 'whole model instance budget, including cargo');
    assert.ok(calls.reduce((n,c) => n + counts[c[0]], 0) <= totalTriangles, 'whole model triangle budget');
  }
  assert.deepEqual(h.draw({...e, hp:0}), []);
  assert.deepEqual(h.draw({...e, target:{x:-40,z:50}}), normal, 'no new independent weapon targeting');
  const altitude = time => type === 'air' ? 3.8 + Math.sin(time*2+e.id)*.22 : 0;
  for (const team of [0,1]) for (const progress of [0,.4,1]) for (const rot of [-2.1,0,.7]) {
    const state = {...e, team, progress, rot};
    for (const options of [{}, {ghost:true}, {ghost:true,tint:0x99e4c6},
      ...[0,.3,1].map(alpha => ({tint:0x99e4c6,alpha,layer:'effects',material:h.MAT.AUTO}))]) {
      const calls = h.draw(state, options), c = primary(calls), f = h.FACTIONS[0];
      const color = type === 'medic' ? 0xb9c3be : options.ghost ? 0x68717d : options.tint || (type === 'worker' ? 0xb7a27b : f.metal);
      assert.deepEqual(c, [mesh,e.x,altitude(9),e.z,1,1,1,color,rot,0,0,0,
        options.alpha??1,options.layer||'dynamic',options.material??h.MAT.METAL]);
      assert.equal(calls.length, normal.length, 'no building scaffold or build scaling on units');
      const teamColor = options.tint || (team ? 0xe98680 : f.color);
      assert.ok(calls.some(p => p[7] === teamColor && p[11] > 0), 'team/preview marker survives');
      assert.deepEqual(calls, h.draw({...state, rot:rot||undefined}, options), 'default heading stays zero');
    }
    for (const time of [0,9,20]) {
      const timed = h.draw(state, {}, time), reference = h.draw(state);
      assert.deepEqual(timed.map(c => c.filter((_,k) => k !== 2)), reference.map(c => c.filter((_,k) => k !== 2)),
        'only centrally supplied air bobbing depends on render time');
      timed.forEach((c,i) => assert.ok(Math.abs(c[2]-reference[i][2]-altitude(time)+altitude(9)) < 1e-12));
    }
  }
  // Complete visible bounds, including instanced primitives, in entity-local coordinates at rest.
  const low=[Infinity,Infinity,Infinity], high=[-Infinity,-Infinity,-Infinity];
  for (const c of normal) {
    const data=uploaded[c[0]], yaw=c[8]-e.rot, cy=Math.cos(yaw), sy=Math.sin(yaw),
      cx=Math.cos(c[9]), sx=Math.sin(c[9]), cz=Math.cos(c[10]), sz=Math.sin(c[10]),
      dx=c[1]-e.x, dz=c[3]-e.z, ox=dx*Math.cos(e.rot)-dz*Math.sin(e.rot),
      oz=dx*Math.sin(e.rot)+dz*Math.cos(e.rot);
    for(let j=0;j<data.length;j+=9) {
      const x=data[j]*c[4], y=data[j+1]*c[5], z=data[j+2]*c[6],
        xx=x*cz-y*sz, yy=x*sz+y*cz, y2=yy*cx-z*sx, z2=yy*sx+z*cx,
        point=[ox+xx*cy+z2*sy,c[2]-altitude(9)+y2,oz-xx*sy+z2*cy];
      point.forEach((v,k)=>{low[k]=Math.min(low[k],v);high[k]=Math.max(high[k],v);});
    }
  }
  low.forEach((v,k)=>assert.ok(v>=min[k]-1e-9 && high[k]<=max[k]+1e-9, `complete bounds axis ${k}: ${v}..${high[k]}`));
  return {h,e,normal,uploaded,counts};
}
// Ray through the barrel axis: the nearest closed surface must sit behind the lip.
function assertRecessedMuzzle(mesh, { x, y, z, rx=0, front, recess }) {
  const hits=[], c=Math.cos(rx), s=Math.sin(rx);
  for(let i=0;i<mesh.length;i+=27) {
    const p=[0,9,18].map(j=>{const yy=mesh[i+j+1]-y, zz=mesh[i+j+2]-z;
      return [mesh[i+j]-x,yy*c+zz*s,-yy*s+zz*c];});
    const [a,b,d]=p, det=(b[1]-d[1])*(a[0]-d[0])+(d[0]-b[0])*(a[1]-d[1]);
    if(Math.abs(det)<1e-12) continue;
    const u=((b[1]-d[1])*-d[0]+(d[0]-b[0])*-d[1])/det,
      v=((d[1]-a[1])*-d[0]+(a[0]-d[0])*-d[1])/det, w=1-u-v;
    if(Math.min(u,v,w)>=-1e-9) hits.push(u*a[2]+v*b[2]+w*d[2]);
  }
  assert.ok(hits.length>0, 'closed recessed barrel end');
  assert.ok(Math.max(...hits)<=front-recess, 'muzzle remains visibly hollow');
}
module.exports = { checkUnit, assertRecessedMuzzle };
