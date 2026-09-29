// Bounded generation, route and CPU/view contracts; no autonomous simulation run.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {createHash}=require('node:crypto');
const {loadScripts,BATTLEFIELD_SCRIPTS,SIMULATION_SCRIPTS,RENDERER_SCRIPTS}=require('./helpers/game-scripts.cjs');
const {createRendererStub}=require('./helpers/renderer-stub.cjs');
const context=loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world','effects',...SIMULATION_SCRIPTS,
  ...RENDERER_SCRIPTS,'world-view'],{globals:{innerHeight:800}});
const api=vm.runInContext(`({Battlefield,BattlefieldBuilder,BATTLEFIELDS,WORLD_VARIATIONS,worldVariationRecipe,battlefieldVariation,
  battlefieldDesign,battlefieldStartSites,TerrainModels,MeridianRenderer,MeridianGame,BattlefieldView,ecologyFootprint,UNITS,UNIT_BODY_SCALE})`,context);
const families={alien:'alien-planet',desert:'desert',ship:'mothership',alpine:'westmark',city:'aurelion',frontier:'frontier',haven:'haven'},
  json=v=>JSON.parse(JSON.stringify(v)),topology=w=>createHash('sha256').update(JSON.stringify(w.layout)).update(w.staticGrid)
    .update(new Uint8Array(w.surface.heights.buffer)).digest('hex');
function representatives(family) {
  const seeds=new Map();for(let seed=1;seed<=128;seed++) {
    const r=api.worldVariationRecipe(family,seed);if(!seeds.has(r.id))seeds.set(r.id,seed);
  }
  assert.equal(seeds.size,api.WORLD_VARIATIONS[family].length);return seeds;
}

test('every catalog family resolves deterministic morphology/relief/atmosphere; Alien has eight distinct forms',()=>{
  const before=JSON.stringify(api.BATTLEFIELDS),alien=new Set();
  for(const [family,map] of Object.entries(families))for(const [id,seed] of representatives(family)) {
    const p=api.BATTLEFIELDS[map].render,a=api.battlefieldVariation(p,seed),b=api.battlefieldVariation(p,seed);
    assert.deepEqual(json(a),json(b));assert.equal(a.variation.id,id);assert.ok(a.atmosphere&&a.ecology);
    assert.equal(a.ecology.natural,family!=='ship'&&family!=='city');
    if(family==='alien')alien.add(a.variation.flora);
    for(const color of [a.ecology.dry,a.ecology.lush,...Object.values(a.lighting)])assert.ok(color.every(Number.isFinite));
  }
  assert.equal(alien.size,8);assert.equal(JSON.stringify(api.BATTLEFIELDS),before);
});

for(const [family,map] of Object.entries(families))test(`${map}: every family has real relief, protected economy, connected vehicle routes and sampled skin`,()=>{
  const signatures=new Set();
  for(const [id,seed] of representatives(family)) {
    const w=new api.Battlefield(seed,map,4),s=w.surface,starts=api.battlefieldStartSites(w);
    assert.ok(s,id);assert.equal(starts.length,4);signatures.add(topology(w));
    const vents=w.layout.resourceSites.map((p,i)=>({x:p.x+(i?7:5),z:p.z+(i?7:18)}));
    for(const p of starts)assert.ok(s.foundation(p,7),id+' HQ');
    for(const p of vents)assert.ok(s.foundation(p,2.3),id+' refinery');
    for(const target of [...starts,...w.layout.resourceSites,...vents]) {
      const path=w.path(starts[0].x,starts[0].z,target.x,target.z,false,undefined,api.UNITS.tank.size*api.UNIT_BODY_SCALE);
      assert.equal(path.status,'complete',`${id} ${JSON.stringify(target)}`);
      let from=starts[0];for(const p of path.points){assert.ok(w.lineFree(from,p,api.UNITS.tank.size*api.UNIT_BODY_SCALE));from=p;}
    }
    let lo=Infinity,hi=-Infinity,slopes=0;
    for(let i=0;i<w.staticGrid.length;i++)if(!w.staticGrid[i]) {
      const p=w.point(i),h=s.heightAt(p.x,p.z);lo=Math.min(lo,h);hi=Math.max(hi,h);
      if(Math.abs(s.heightAt(p.x+1,p.z)-h)+Math.abs(s.heightAt(p.x,p.z+1)-h)>.06)slopes++;
      if(family!=='city'&&family!=='ship')assert.equal(s.visibilityLevelAt(p.x,p.z),0);
    }
    assert.ok(hi-lo>3,`${id}: walkable relief ${hi-lo}`);assert.ok(slopes>200,id+' real slopes');
    const skin=w.renderData.geometries.find(g=>g.mesh==='terrain');
    if(family==='alien'||family==='desert') {
      assert.equal(skin.model,'landscapeRelief');const mesh=api.TerrainModels.geometry(skin);
      for(let i=0;i<mesh.length;i+=9) {
        assert.ok(Math.abs(mesh[i+1]+.13-s.heightAt(mesh[i],mesh[i+2]))<2e-5,id+' matching samples');
        assert.ok(Math.abs(Math.hypot(mesh[i+3],mesh[i+4],mesh[i+5])-1)<1e-5);
      }
      const r=skin.relief,distance=vm.runInContext('pointSegment',context);
      for(let z=1;z<r.size-1;z+=17)for(let x=1;x<r.size-1;x+=19) {
        const p={x:(x-1)*r.step-r.extent,z:(z-1)*r.step-r.extent},i=z*r.size+x;let road=Infinity;
        for(const route of w.layout.corridors)for(let j=1;j<route.length;j++)
          road=Math.min(road,distance(p,{x:route[j-1][0],z:route[j-1][1]},{x:route[j][0],z:route[j][1]}));
        assert.ok(Math.abs(r.colors[i*3]-Math.max(0,1-road/3)*(1-r.colors[i*3+1]))<1e-7,'bounded road tint matches exact segment distances');
      }
    }
    assert.ok(w.renderData.placements.every(p=>[...p.position,...p.scale,...p.rotation].every(Number.isFinite)));
    assert.ok(w.renderData.placements.length<7200,'bounded base scenery plus shared ecology');
    if(family==='ship'||family==='city') {
      assert.ok(!w.renderData.placements.some(p=>p.mesh.startsWith('ecology')),'no meadow on engineered decks');
      assert.ok(w.renderData.placements.filter(p=>p.mesh.startsWith('variationLandmark')).length<=32);
    }
  }
  if(family!=='haven')assert.ok(signatures.size>1,'not just palette swaps');
});

test('new habitat and architecture meshes have deterministic, finite, normalized bounded geometry',()=>{
  const flora=['Coral','Fan','Spire','Pod','Arch','Reed','Shelf','Cactus','Palm'];
  for(const part of [...flora.map(p=>'ecology'+p),'variationRadar','variationPylon','variationWreck'])for(const seed of [197,7919,0xffffffff]) {
    const mesh=api.TerrainModels[part](seed);assert.deepEqual(mesh,api.TerrainModels[part](seed));
    assert.ok(mesh.length>0&&mesh.length%27===0&&mesh.length/27<=1400,part);
    for(let i=0;i<mesh.length;i+=9) {
      assert.ok(mesh.slice(i,i+9).every(Number.isFinite));assert.ok(Math.hypot(mesh[i],mesh[i+2])<=1.00001,part+' radius');
      assert.ok(mesh[i+1]>=-.06&&mesh[i+1]<=1.2,part+' height');
      assert.ok(Math.abs(Math.hypot(mesh[i+3],mesh[i+4],mesh[i+5])-1)<1e-5,part+' normal');
    }
  }
});

test('Alien arches fit unchanged trunk collision radii; their morphology is not stacked with old mushroom gills',()=>{
  const w=new api.Battlefield(1,'alien-planet');assert.equal(w.renderProfile.variation.flora,'Arch');
  assert.ok(!w.renderData.placements.some(p=>p.mesh.startsWith('alienCapGills')||p.mesh==='alienLanternPool'));
  for(const p of w.renderData.placements.filter(p=>p.mesh.startsWith('alienTree')||p.mesh==='alienSapling')) {
    const rock=w.rocks.find(r=>r.x===p.position[0]&&r.z===p.position[2]);if(!rock)continue; // exterior backdrop
    assert.ok(p.scale[0]+.4<=rock.r+1e-6,'entire new form plus wind remains inside the original blocker');
    assert.ok(Math.abs(p.position[1]-w.surface.heightAt(rock.x,rock.z))<.2,'rooted on the authoritative surface');
  }
});

test('canyon debris is embedded in the new triangle surface, including formerly failing public vents',()=>{
  for(const seed of [71271,102947]) {
    const w=new api.Battlefield(seed,'desert');
    for(const [i,p] of w.layout.resourceSites.entries())assert.ok(w.surface.foundation({x:p.x+(i?7:5),z:p.z+(i?7:18)},2.3));
    for(const p of w.renderData.placements.filter(p=>['desertTalus','desertFlake','desertPebble','desertChip','desertButtress','desertScree'].includes(p.mesh))) {
      const [x,y,z]=p.position,r=p.scale[0];if(Math.max(Math.abs(x),Math.abs(z))+r>=w.extent)continue;
      const foot=Math.min(...[[x,z],[x+r,z],[x-r,z],[x,z+r],[x,z-r]].map(([a,b])=>w.surface.heightAt(a,b)-.13));
      assert.ok(Math.abs(y-(foot-.025))<1e-5,'no floating wall-foot debris');
    }
  }
});

test('cosmetic choices preserve terrain, collision, resources and encounter RNG; fixed landscapes survive encounter changes',()=>{
  const original=api.BattlefieldBuilder.prototype.cosmeticRandom;
  try {
    const a=new api.MeridianGame({upgrades:{}},()=>{});a.start({map:'alien-planet',seed:1,enemies:[1,2,0]});
    api.BattlefieldBuilder.prototype.cosmeticRandom=()=>()=>.5;
    const b=new api.MeridianGame({upgrades:{}},()=>{});b.start({map:'alien-planet',seed:1,enemies:[1,2,0]});
    assert.equal(topology(a.world),topology(b.world));assert.deepEqual(json(a.s),json(b.s));assert.equal(a.random(),b.random());
    assert.notDeepEqual(json(a.world.renderData),json(b.world.renderData));
  }finally{api.BattlefieldBuilder.prototype.cosmeticRandom=original;}
  const recipe=api.BATTLEFIELDS['alien-planet'];
  try {
    api.BATTLEFIELDS['alien-planet']=api.battlefieldDesign(recipe,'PINNED ARCHES',{terrainSeed:1,atmosphere:{timeOfDay:12,materialSeed:1}});
    const a=new api.Battlefield(1409,'alien-planet'),b=new api.Battlefield(7919,'alien-planet');
    assert.equal(topology(a),topology(b));assert.deepEqual(json(a.renderData),json(b.renderData));assert.deepEqual(json(a.renderProfile),json(b.renderProfile));
    assert.equal(a.renderProfile.atmosphere.timeOfDay,12,'explicit design time overrides family mood');
  }finally{api.BATTLEFIELDS['alien-planet']=recipe;}
});

test('surface queries never reevaluate generation fields in the per-frame visibility path',()=>{
  const original=vm.runInContext('worldReliefField',context);let reads=0;
  context.countedField=(...args)=>{const field=original(...args);return (...p)=>{reads++;return field(...p);};};
  vm.runInContext('worldReliefField=countedField',context);
  try {
    for(const map of ['westmark','mothership','aurelion']) {
      const w=new api.Battlefield(1,map),before=reads;
      for(let i=0;i<w.staticGrid.length;i++) {const p=w.point(i);w.surface.heightAt(p.x,p.z);w.surface.visibilityLevelAt(p.x,p.z);}
      assert.equal(reads,before,map+' reads sampled heights, not pad/noise generation');
    }
  }finally{context.originalField=original;vm.runInContext('worldReliefField=originalField',context);delete context.originalField;delete context.countedField;}
});

test('city authored lighting scale resets with profiles and rigid traffic follows scaled paths',()=>{
  const values=new Map(),r=Object.create(api.MeridianRenderer.prototype);
  Object.assign(r,{gl:{uniform1f:(key,v)=>values.set(key,v),uniform3fv(){}},uniform:(_,key)=>key});
  r.battlefieldProfile=api.battlefieldVariation(api.BATTLEFIELDS.aurelion.render,1);r.bindAtmosphere({});
  assert.equal(values.get('u_worldHeightScale'),1.06);
  r.battlefieldProfile={};r.bindAtmosphere({});assert.equal(values.get('u_worldHeightScale'),1);
  const {flights,draw}=vm.runInContext('({flights:createAurelionFlights(),draw:drawAurelionFlights})',context),
    capture=scale=>{const calls=[];draw({add:(...a)=>calls.push(['add',...a]),beam:(...a)=>calls.push(['beam',...a])},flights,7,scale);return calls;},
    base=capture(1),scaled=capture(.9);
  assert.ok(base.length>0);assert.equal(scaled.length,base.length);
  for(let i=0;i<base.length;i++) {
    const a=base[i],b=scaled[i];
    if(a[0]==='add') {assert.ok(Math.abs(b[3]-a[3]*.9)<1e-6);assert.deepEqual(b.slice(5),a.slice(5),'aircraft stay rigid');}
    else for(const point of [1,2])assert.ok(Math.abs(b[point][1]-a[point][1]*.9)<1e-6,'wake follows the same scaled path');
  }
});

test('all composed recipes retain original resource initialization and simulation RNG entry points',()=>{
  const originals=vm.runInContext(`({desert:DESERT_BATTLEFIELD,'alien-planet':ALIEN_PLANET_BATTLEFIELD,
    mothership:MOTHERSHIP_BATTLEFIELD,westmark:WESTMARK_BATTLEFIELD,aurelion:AURELION_BATTLEFIELD,
    frontier:FRONTIER_BATTLEFIELD,haven:HAVEN_BATTLEFIELD})`,context);
  for(const map of Object.values(families)) {
    const options={map,seed:1409,enemies:[1,2,0],mission:map==='aurelion'?'echo-salvage':'hq-elimination'},
      current=api.BATTLEFIELDS[map],a=new api.MeridianGame({upgrades:{}},()=>{}),b=new api.MeridianGame({upgrades:{}},()=>{});
    a.start(options);
    try {api.BATTLEFIELDS[map]=originals[map];b.start(options);}
    finally {api.BATTLEFIELDS[map]=current;}
    const resources=g=>json(g.s.entities.filter(e=>e.kind==='resource'));
    assert.deepEqual(resources(a),resources(b),map+' protected resource positions, amounts and ids');
    assert.deepEqual(json(a.s.parties.map(p=>p.account)),json(b.s.parties.map(p=>p.account)),map+' accounts');
    assert.equal(a.random(),b.random(),map+' unchanged encounter RNG position');
  }
});

test('picking, mesh ownership and detail reset follow actual surfaces across all seven maps',()=>{
  const r=createRendererStub(),view=new api.BattlefieldView(r),released=[];r.releaseGeometry=name=>released.push(name);
  const picker=Object.create(api.MeridianRenderer.prototype);
  Object.assign(picker,{viewport:{left:0,top:0,right:1200,bottom:800,width:1200,height:800},quality:0});
  for(const map of ['alien-planet','desert','mothership','westmark','aurelion','frontier','haven','alien-planet']) {
    const w=new api.Battlefield(1,map);view.sync(w);assert.strictEqual(r.surface,w.surface);
    assert.equal(r.detailMeshes.size,w.renderProfile.ecology.natural?3:0);
    assert.strictEqual(r.battlefieldProfile,w.renderProfile);
    picker.surface=w.surface;const p=w.layout.startSites[0];picker.camera(p.x,p.z,70);
    const screen=picker.project(p.x,w.surface.heightAt(p.x,p.z),p.z),hit=picker.ground(screen.x,screen.y);
    assert.ok(Math.hypot(hit.x-p.x,hit.z-p.z)<1e-4,map+' projection/picking');
  }
  assert.ok(released.includes('aurelionStructure'));assert.ok(released.includes('variationLandmark0'));
});
