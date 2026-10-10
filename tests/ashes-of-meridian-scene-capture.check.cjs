const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

test('scene recipe validation accepts the example and rejects malformed input before launching', async () => {
  const { validateScene } = await import('../scripts/scene-capture-fixture.mjs');
  const example = JSON.parse(readFileSync(require('node:path').join(__dirname, '../scripts/scenes/model-lineup.json'), 'utf8'));
  assert.equal(validateScene(example), example);
  for (const patch of [{ seed: 0 }, { seed: 1.5 }, { hour: 24 }, { width: NaN }, { height: 10000 },
    { faction: 4 }, { hud: 'false' }, { unexpected: true }, { camera: { x: 0, z: 0, zoom: 0 } },
    { entities: [{ kind: 'unit', type: 'rifle', team: 2, x: 0, z: 0 }] }])
    assert.throws(() => validateScene({ ...example, ...patch }));
});

test('capture callback serializes, preserves pause and projects the focus onto elevated terrain', async () => {
  const { prepareScene } = await import('../scripts/scene-capture-fixture.mjs');
  const units = [{ kind: 'unit', type: 'worker', team: 0, x: 10, z: 20 }, { kind: 'unit', type: 'worker', team: 1, x: -10, z: -20 }];
  const game = { start() { this.s = { map: 'desert', seed: 1409, time: 0, entities: units, cam: {} }; },
    alive: fn => units.filter(fn), spawnUnit(type,x,z) { return { id: 3,type,x,z }; }, factionFor: t => t,
    rehash() {}, world: { extent: 100, rebuild() {}, reveal() {}, surface: { heightAt: () => 12 }, renderProfile: { atmosphere: { timeOfDay: 10 } } } };
  const ui = { terrainCameraPoint: (p,h) => ({ x: p.x, z: p.z - h }), pointer: {}, renderActions() {}, updateHUD() {} };
  const renderer = { resize() {}, setBattlefieldTime(t) { this.elapsed = t; } };
  const context = vm.createContext({ window: { Meridian: { game, ui, renderer, content: { units: { rifle: { size: 1 } }, buildings: {} } } }, scene: {
    map: 'desert', seed: 1409, hour: 22, camera: { anchor: 'player', x: 0, z: 0, zoom: 30 },
    entities: [{ kind: 'unit', type: 'rifle', team: 0, anchor: 'player', x: 3, z: 0 }]
  } });
  const result = vm.runInContext(`(${prepareScene.toString()})(scene)`, context);
  assert.equal(ui.paused, true); assert.equal(result.time, 0);
  assert.equal(result.placed[0].x, 13); assert.equal(game.s.cam.z, 8);
  renderer.setBattlefieldTime(0); assert.equal(renderer.elapsed, 300);
  context.scene.entities[0].type = 'missing';
  assert.throws(() => vm.runInContext(`(${prepareScene.toString()})(scene)`, context), /Unknown unit/);
});
