// Recipe and shared-art contracts; no autonomous simulation or exhaustive seed sweep.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {loadScripts,BATTLEFIELD_SCRIPTS,RENDERER_SCRIPTS}=require('./helpers/game-scripts.cjs');
function scope() {
  const context=loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world',...RENDERER_SCRIPTS]);
  return vm.runInContext('({Battlefield,BATTLEFIELDS,WORLD_VARIATIONS,worldVariationRecipe,battlefieldVariation,TerrainModels,battlefieldGasPosition,worldReliefHeightAt})',context);
}
const families={alien:'alien-planet',desert:'desert',westmark:'westmark',frontier:'frontier',haven:'haven'},
  json=v=>JSON.parse(JSON.stringify(v));
function representatives(api,family) {
  const seeds=new Map();for(let seed=1;seed<=128;seed++) {
    const r=api.worldVariationRecipe(family,seed);if(!seeds.has(r.id))seeds.set(r.id,seed);
  }
  assert.equal(seeds.size,api.WORLD_VARIATIONS[family].length);return seeds;
}
test('five catalog families resolve repeatable morphology, ecology and atmosphere without mutating recipes',()=>{
  const api=scope(),before=JSON.stringify(api.BATTLEFIELDS),alien=new Set();
  assert.deepEqual(Object.keys(api.WORLD_VARIATIONS).sort(),Object.keys(families).sort());
  assert.equal(api.WORLD_VARIATIONS.haven.length,4);
  for(const [family,map]of Object.entries(families))for(const [id,seed]of representatives(api,family)) {
    const p=api.BATTLEFIELDS[map].render,a=api.battlefieldVariation(p,seed),b=api.battlefieldVariation(p,seed);
    assert.deepEqual(json(a),json(b));assert.equal(a.variation.id,id);assert.ok(a.atmosphere&&a.ecology);
    assert.equal(a.ecology.natural,true);
    if(family==='alien')alien.add(a.variation.flora);
    else assert.equal(a.variation.relief,api.worldVariationRecipe(family,seed).relief,'native recipe owns the relief');
    for(const color of [a.ecology.dry,a.ecology.lush,...Object.values(a.lighting)])assert.ok(color.every(Number.isFinite));
  }
  assert.equal(alien.size,8);assert.equal(JSON.stringify(api.BATTLEFIELDS),before);
});
test('Alien relief and habitat axes stay independent and shared landmark meshes remain finite and bounded',()=>{
  const api=scope(),combinations=new Map();
  for(let seed=1;seed<=128;seed++) {
    const v=api.battlefieldVariation(api.BATTLEFIELDS['alien-planet'].render,seed).variation;
    if(!combinations.has(v.id))combinations.set(v.id,new Set());combinations.get(v.id).add(v.relief);
  }
  assert.ok([...combinations.values()].every(forms=>forms.size===2), 'each habitat supports both native Alien landforms');
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
