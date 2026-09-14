const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { modelHarness, assertMesh } = require('../helpers/model-contract.cjs');
const names = ['faction1DepotHull','faction1DepotMembranes','faction1DepotStores'];
const entity = { id:17, faction:1, kind:'building', type:'depot', team:0,
  x:12, z:-7, hp:750, size:2.3, progress:1, rot:.7 };
function upload(h) {
  const r = { meshes:{}, geometry(name,data) { this.meshes[name] = data; } };
  h.EntityModels.upload(r); return r.meshes;
}
// Highest triangle hit by a downward ray: proves a cell is hollow, not a painted hexagon.
function surfaceAt(mesh,x,z) {
  let height = -Infinity;
  for (let i = 0; i < mesh.length; i += 27) {
    const [a,b,c] = [0,9,18].map(k => mesh.slice(i+k,i+k+3)),
      det = (b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if (Math.abs(det) < 1e-10) continue;
    const u = ((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det,
      v = ((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det, w = 1-u-v;
    if (Math.min(u,v,w) >= -1e-9) height = Math.max(height,u*a[1]+v*b[1]+w*c[1]);
  }
  return height;
}

test('Living canopy: bounded honeycomb has seven recessed hex cells, two membranes and a terraced silhouette', () => {
  const h = modelHarness();
  vm.runInContext('Math.random = seeded = () => { throw Error("Canopy RNG"); };',h.context);
  const first = upload(h), second = upload(h), specs = [
    {minTriangles:1300,maxTriangles:1500,min:[-1.95,.20,-1.95],max:[1.95,2.24,1.95]},
    {minTriangles:48,maxTriangles:48,min:[-1.5,.97,-1.02],max:[1.5,2.07,1.02]},
    {minTriangles:120,maxTriangles:120,min:[-1.32,.33,-1.47],max:[1.30,1.61,1.46]}
  ];
  names.forEach((name,i) => {
    let call = 0;
    assertMesh(() => (call++ ? second : first)[name],specs[i]);
    for (let j = 0; j < first[name].length; j += 9)
      assert.ok(Math.hypot(first[name][j],first[name][j+2]) < 2.2,'within unchanged size-2.3 footprint');
  });
  const hull = first[names[0]], membranes = first[names[1]], stores = first[names[2]];
  // Independent design landmarks: rear grows higher, front exposes the honeycomb from the game camera.
  for (const [x,z,top,sealed] of [[0,0,1.55,false],[-1.05,-.61,1.96,true],[0,-1.22,2.20,false],
    [1.05,-.61,1.73,false],[1.05,.61,1.02,true],[0,1.22,.90,false],[-1.05,.61,1.22,false]]) {
    const floor = Math.max(.34,top-.67), actual = surfaceAt(hull,x,z);
    assert.ok(Math.abs(actual-floor) < 1e-9,'real recessed cell floor');
    assert.ok(top-actual >= .55,'deep opening, not a shallow panel');
    if (sealed) {
      assert.ok(surfaceAt(membranes,x,z) > top,'two living wax seals');
      assert.equal(surfaceAt(stores,x,z),-Infinity,'no stores protrude through sealed cells');
    } else {
      assert.equal(surfaceAt(membranes,x,z),-Infinity,'five mouths remain open');
      assert.ok(surfaceAt(stores,x,z) < top-.48,'nutrient tissue stays down inside the cell');
    }
  }
  // Six equally spaced inner rim sectors around the central chamber retain the honeycomb cue.
  const sectors = new Set();
  for (let i = 0; i < hull.length; i += 9) {
    const [x,y,z] = hull.slice(i,i+3), r = Math.hypot(x,z);
    if (y > 1.49 && y < 1.56 && r > .44 && r < .47)
      sectors.add((Math.round(Math.atan2(z,x)*3/Math.PI)+6)%6);
  }
  assert.equal(sectors.size,6);
  const customTriangles = names.reduce((sum,n) => sum+first[n].length/27,0);
  assert.ok(customTriangles+h.geom.choirMound().length/27 <= 1800,
    'three custom batches plus mound; at most 3600 triangles with a shadow repeat');
});

test('Living canopy: static organic assembly preserves supply, construction, team colors, previews and isolation', () => {
  const h = modelHarness();
  assert.equal(h.BUILDINGS.depot.size,2.3); assert.equal(h.BUILDINGS.depot.hp,750);
  assert.equal(h.BUILDINGS.depot.cap,16);
  const model = h.EntityModels.find(entity);
  assert.equal(model.id,'faction-1/building/depot'); assert.ok(Object.isFrozen(model));
  assert.equal(h.EntityModels.find({...entity,kind:'unit'}),undefined);
  for (const faction of [0,1,2]) for (const type of Object.keys(h.BUILDINGS))
    if (faction !== 1 || type !== 'depot') assert.notEqual(h.EntityModels.find({...entity,faction,type}).id,model.id);
  vm.runInContext('Math.random = seeded = () => { throw Error("Canopy RNG"); }; for (const k of Object.keys(geom)) geom[k] = () => { throw Error("Frame geometry"); };',h.context);
  const normal = h.draw(entity);
  assert.deepEqual(normal.map(c => c[0]),['choirMound',...names],'no old tower, orbiting crystal or ring');
  for (const time of [0,20]) assert.deepEqual(h.draw(entity,{},time),normal,'no geometric animation');
  assert.deepEqual(h.draw({...entity,progress:undefined,rot:-2.1}),normal);
  assert.deepEqual(h.draw({...entity,hp:0}),[]);
  for (const team of [0,1]) for (const progress of [0,.4,1]) {
    const state = {...entity,team,progress}, build = Math.max(.15,progress), yaw = h.BUILDING_YAW+team*Math.PI,
      faction = h.FACTIONS[1], color = team ? 0xe98680 : faction.color, accent = team ? 0xffaf87 : faction.accent;
    for (const options of [{},{ghost:true},{ghost:true,tint:0x99e4c6},
      ...[0,.3,1].map(alpha => ({tint:0x99e4c6,alpha,layer:'effects',material:h.MAT.AUTO}))]) {
      const calls = h.draw(state,options);
      assert.equal(calls.length,4+(progress<1?5:0),'shared scaffold is unchanged');
      assert.deepEqual(calls[0],['choirMound',12,0,-7,2.3,build,2.3,
        options.ghost?0x68717d:options.tint||0x70523b,yaw,0,0,0,
        options.alpha??1,options.layer||'dynamic',options.material??h.MAT.ROCK]);
      const colors = [options.ghost?0x68717d:options.tint||faction.metal,options.tint||color,accent];
      names.forEach((name,i) => assert.deepEqual(calls.find(c => c[0]===name),
        [name,12,0,-7,1,build,1,colors[i],yaw,0,0,[0,.32,.30][i],
          options.alpha??1,options.layer||'dynamic',options.material??h.MAT.BIO]));
    }
  }
});
