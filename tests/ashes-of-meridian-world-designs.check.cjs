const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { loadScripts, BATTLEFIELD_SCRIPTS } = require('./helpers/game-scripts.cjs');
const json = value => JSON.parse(JSON.stringify(value));
function scope(extra = []) {
  const context = loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world',...extra]);
  return vm.runInContext('({Battlefield,BATTLEFIELDS,battlefieldDesign,battlefieldAtmosphere,TerrainModels: typeof TerrainModels === "undefined" ? null : TerrainModels})', context);
}
function signature(world) {
  return createHash('sha256').update(JSON.stringify(world.layout)).update(world.staticGrid)
    .update(new Uint8Array(world.surface.heights.buffer)).digest('hex');
}
test('named seed overrides remain deterministic without pinning any catalog landscape', () => {
  const api = scope(), original = api.BATTLEFIELDS.haven;
  assert.equal(original.design?.terrainSeed, undefined);
  api.BATTLEFIELDS.haven = api.battlefieldDesign(original, 'NAMED TEST DESIGN',
    {terrainSeed:40517, atmosphere:{timeOfDay:18.5, materialSeed:40517}});
  const a = new api.Battlefield(1, 'haven'), b = new api.Battlefield(7919, 'haven');
  assert.equal(a.seed, 1); assert.equal(b.seed, 7919);
  assert.equal(a.terrainSeed, 40517); assert.equal(signature(a), signature(b));
  assert.deepEqual(json(a.renderData), json(b.renderData));
  assert.equal(a.renderProfile.atmosphere.timeOfDay, 18.5);
});
test('atmosphere remains bounded, deterministic and independent of terrain generation', () => {
  const api = scope(), profile = api.BATTLEFIELDS.mothership.render, before = JSON.stringify(profile);
  assert.strictEqual(api.battlefieldAtmosphere(profile, undefined, 1), profile);
  const night = api.battlefieldAtmosphere(profile, {timeOfDay:0}, 1),
    day = api.battlefieldAtmosphere(profile, {timeOfDay:12}, 1);
  assert.notDeepEqual(json(night.lighting), json(day.lighting));
  assert.equal(JSON.stringify(profile), before);
  assert.deepEqual(json(api.battlefieldAtmosphere(profile, {timeOfDay:'seeded'}, 1409)),
    json(api.battlefieldAtmosphere(profile, {timeOfDay:'seeded'}, 1409)));
  for (const hour of [0,5,7,12,16,19,21,23.9999]) {
    const p = api.battlefieldAtmosphere(profile, {timeOfDay:hour}, 7);
    for (const color of [p.atmosphere.horizon,p.atmosphere.zenith,p.haze,...Object.values(p.lighting)])
      assert.ok(color.every(v => Number.isFinite(v) && v >= 0 && v <= 1.2));
  }
  for (const timeOfDay of [-1,24,NaN,Infinity])
    assert.throws(() => api.battlefieldDesign(api.BATTLEFIELDS.frontier, 'invalid', {atmosphere:{timeOfDay}}));
  for (const terrainSeed of [-1,1.5,NaN,0x100000000])
    assert.throws(() => api.battlefieldDesign(api.BATTLEFIELDS.frontier, 'invalid', {terrainSeed}));
  const original = api.BATTLEFIELDS.frontier;
  api.BATTLEFIELDS.frontier = api.battlefieldDesign(original, 'DAY', {atmosphere:{timeOfDay:12}});
  const a = new api.Battlefield(1409, 'frontier');
  api.BATTLEFIELDS.frontier = api.battlefieldDesign(original, 'NIGHT', {atmosphere:{timeOfDay:0}});
  const b = new api.Battlefield(1409, 'frontier');
  assert.equal(signature(a), signature(b)); assert.deepEqual(json(a.renderData), json(b.renderData));
});
test('generated geometry uses CPU samples and matching triangle interpolation with finite unit normals', () => {
  const api = scope(['renderer-geometry','renderer-terrain-models','renderer-landscape']),
    w = new api.Battlefield(1409, 'frontier'), descriptor = w.renderData.geometries.find(g => g.mesh === 'terrain'),
    mesh = api.TerrainModels.geometry(descriptor), s = w.surface;
  assert.equal(mesh.length, (s.size - 1) ** 2 * 54);
  for (let i = 0; i < mesh.length; i += 9 * 73) {
    assert.ok(Math.abs(mesh[i+1] - (s.heightAt(mesh[i],mesh[i+2]) - .13)) < 1e-5);
    assert.ok(mesh[i+4] > 0);
    assert.ok(Math.abs(Math.hypot(mesh[i+3],mesh[i+4],mesh[i+5]) - 1) < 1e-5);
  }
});
