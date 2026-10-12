// Recipe and shared-art contracts; no autonomous simulation or exhaustive seed sweep.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {loadScripts,BATTLEFIELD_SCRIPTS,RENDERER_SCRIPTS}=require('./helpers/game-scripts.cjs');
function scope() {
  const context=loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world',...RENDERER_SCRIPTS]);
  return vm.runInContext('({BATTLEFIELDS,LANDSCAPE_FAMILIES,worldVariationRecipe,resolveBattlefieldLandscape,TerrainModels})',context);
}
const families={alien:'alien-planet',desert:'desert',westmark:'westmark',frontier:'frontier',haven:'haven'},
  json=v=>JSON.parse(JSON.stringify(v));
function representatives(api,family) {
  const definition=api.LANDSCAPE_FAMILIES[family],seeds=new Map();for(let seed=1;seed<=128;seed++) {
    const r=api.worldVariationRecipe(definition,seed);if(!seeds.has(r.id))seeds.set(r.id,seed);
  }
  assert.equal(seeds.size,definition.recipes.length);return seeds;
}
test('five catalog families resolve repeatable morphology, ecology and atmosphere without mutating recipes',()=>{
  const api=scope(),before=JSON.stringify(api.BATTLEFIELDS),alien=new Set();
  assert.deepEqual(Object.keys(api.LANDSCAPE_FAMILIES).sort(),Object.keys(families).sort());
  assert.equal(api.LANDSCAPE_FAMILIES.haven.recipes.length,4);
  for(const [family,map]of Object.entries(families))for(const [id,seed]of representatives(api,family)) {
    const definition=api.BATTLEFIELDS[map],p=definition.render,
      a=api.resolveBattlefieldLandscape(definition.family,p,seed),b=api.resolveBattlefieldLandscape(definition.family,p,seed);
    assert.strictEqual(definition.family,api.LANDSCAPE_FAMILIES[family]);
    assert.deepEqual(json(a),json(b));assert.equal(a.presentation.variation.id,id);assert.ok(a.presentation.atmosphere);
    assert.equal(a.habitat.natural,true);assert.strictEqual(a.habitat,a.presentation.ecology);
    assert.equal(a.presentation.variation.relief,a.terrain.relief);
    assert.equal(a.presentation.variation.heightScale,a.terrain.heightScale);
    assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.terrain));
    if(family==='alien')alien.add(a.habitat.flora);
    else assert.deepEqual(json(a.terrain),json(api.worldVariationRecipe(definition.family,seed).terrain),'native recipe owns the relief');
    for(const color of [a.habitat.dry,a.habitat.lush,...Object.values(a.presentation.lighting)])assert.ok(color.every(Number.isFinite));
  }
  assert.equal(alien.size,8);assert.equal(JSON.stringify(api.BATTLEFIELDS),before);
});
test('Alien relief and habitat axes stay independent and shared landmark meshes remain finite and bounded',()=>{
  const api=scope(),combinations=new Map(),definition=api.BATTLEFIELDS['alien-planet'];
  for(let seed=1;seed<=128;seed++) {
    const r=api.resolveBattlefieldLandscape(definition.family,definition.render,seed),id=r.presentation.variation.id;
    if(!combinations.has(id))combinations.set(id,new Set());combinations.get(id).add(r.terrain.relief);
  }
  assert.ok([...combinations.values()].every(forms=>forms.size===2),'each habitat supports both native Alien landforms');
  const forms=new Set([...combinations.values()].flatMap(forms=>[...forms]));
  assert.deepEqual([...forms].sort(),['broken-crater','ridges']);
  for(const model of ['variationAlienCoral','variationAlienFan','variationAlienSpire','variationAlienPod',
    'variationAlienArch','variationAlienReed','variationAlienShelf','variationAlienCactus','variationAlienPalm']) {
    assert.equal(typeof api.TerrainModels[model],'function',model);
    const mesh=api.TerrainModels[model](1409,0);
    assert.deepEqual(mesh,api.TerrainModels[model](1409,0));
    assert.ok(mesh.length>0&&mesh.length%27===0&&mesh.length/27<10000,model);
    assert.ok(mesh.every(Number.isFinite));
    for(let i=0;i<mesh.length;i+=9)assert.ok(Math.abs(Math.hypot(mesh[i+3],mesh[i+4],mesh[i+5])-1)<1e-5,model);
  }
});
