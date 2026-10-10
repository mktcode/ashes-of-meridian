export function validateScene(scene) {
  const number = (v, name, min = -Infinity, max = Infinity) => {
    if (!Number.isFinite(v) || v < min || v > max) throw Error(`Invalid ${name}`);
  };
  if (!scene || typeof scene !== 'object' || Array.isArray(scene)) throw Error('Scene must be an object');
  const allowed = ['map', 'seed', 'faction', 'enemy', 'camera', 'entities', 'hour', 'width', 'height', 'hud', 'reveal'];
  for (const key of Object.keys(scene)) if (!allowed.includes(key)) throw Error(`Unknown scene field: ${key}`);
  if (typeof scene.map !== 'string' || !scene.map) throw Error('map is required');
  number(scene.seed, 'seed', 1, 99999999);
  if (!Number.isInteger(scene.seed)) throw Error('seed must be an integer');
  for (const key of ['faction', 'enemy']) if (scene[key] !== undefined) { number(scene[key], key, 0, 2); if (!Number.isInteger(scene[key])) throw Error(`Invalid ${key}`); }
  for (const key of ['width', 'height']) if (scene[key] !== undefined) { number(scene[key], key, 64, 4096); if (!Number.isInteger(scene[key])) throw Error(`Invalid ${key}`); }
  if (scene.hour !== undefined) number(scene.hour, 'hour', 0, 23.999999);
  for (const key of ['hud', 'reveal']) if (scene[key] !== undefined && typeof scene[key] !== 'boolean') throw Error(`Invalid ${key}`);
  const position = (p, name, camera = false) => {
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw Error(`Invalid ${name}`);
    for (const key of Object.keys(p)) if (!(camera ? ['x','z','zoom','yaw','anchor'] : ['kind','type','team','x','z','rot','anchor']).includes(key)) throw Error(`Unknown ${name} field: ${key}`);
    for (const key of ['x', 'z']) number(p[key], `${name}.${key}`);
    if (p.anchor !== undefined && !['world','player','enemy'].includes(p.anchor)) throw Error(`Invalid ${name}.anchor`);
    if (camera) { number(p.zoom, 'camera.zoom', 5, 200); if (p.yaw !== undefined) number(p.yaw, 'camera.yaw'); }
    else {
      if (!['unit','building'].includes(p.kind) || typeof p.type !== 'string') throw Error(`Invalid ${name} kind/type`);
      if (![0,1].includes(p.team)) throw Error(`Invalid ${name}.team`);
      if (p.rot !== undefined) number(p.rot, `${name}.rot`);
    }
  };
  if (scene.camera) position(scene.camera, 'camera', true);
  if (scene.entities !== undefined && (!Array.isArray(scene.entities) || scene.entities.length > 200)) throw Error('entities must be an array of at most 200 entries');
  (scene.entities ?? []).forEach((e, i) => position(e, `entities[${i}]`));
  return scene;
}

// Serializable callback. Arranged geometry, not a gameplay/balancing test.
export function prepareScene(scene) {
  const { game, ui, renderer, content } = window.Meridian;
  ui.paused = true;
  game.start({ map: scene.map, seed: scene.seed, faction: scene.faction ?? 0, enemies: [scene.enemy ?? 1], depth: 6 });
  ui.paused = true;
  ui.battleIntro = ui.battleTutorial = null;
  const homes = [0,1].map(team => game.alive(e => e.team === team && e.kind === 'unit' && e.type === 'worker')[0]);
  function location(p) {
    const home = p.anchor === 'player' ? homes[0] : p.anchor === 'enemy' ? homes[1] : { x: 0, z: 0 };
    return { x: home.x + p.x, z: home.z + p.z };
  }
  const placed = [];
  for (const entry of scene.entities ?? []) {
    const catalog = entry.kind === 'unit' ? content.units : content.buildings;
    if (!Object.hasOwn(catalog, entry.type)) throw Error(`Unknown ${entry.kind}: ${entry.type}`);
    const p = location(entry);
    if (Math.abs(p.x) + catalog[entry.type].size >= game.world.extent || Math.abs(p.z) + catalog[entry.type].size >= game.world.extent) throw Error(`Entity outside map: ${entry.type}`);
    const spawn = entry.kind === 'unit' ? game.spawnUnit : game.spawnBuilding;
    const entity = spawn.call(game, entry.type, p.x, p.z, entry.team, game.factionFor(entry.team), { rot: entry.rot ?? 0 });
    if (!entity) throw Error(`Could not place ${entry.type}`);
    placed.push({ id: entity.id, type: entity.type, ...p });
  }
  game.rehash(); game.world.rebuild(game.s.entities);
  if (scene.reveal !== false) game.world.reveal(game.s.entities, [{ team: 0, x: 0, z: 0, r: game.world.extent * 3 }]);
  if (scene.camera) {
    const focus = location(scene.camera);
    Object.assign(game.s.cam, { zoom: scene.camera.zoom, yaw: scene.camera.yaw ?? 0 });
    Object.assign(game.s.cam, ui.terrainCameraPoint(focus, game.world.surface.heightAt(focus.x, focus.z)));
  }
  if (scene.hour !== undefined) {
    const setTime = renderer.setBattlefieldTime.bind(renderer);
    const offset = ((scene.hour - game.world.renderProfile.atmosphere.timeOfDay + 24) % 24) * 25;
    renderer.setBattlefieldTime = elapsed => setTime(elapsed + offset);
  }
  renderer.quality = 2; renderer.resize();
  ui.selected = []; ui.hover = null; ui.pointer.inside = false;
  ui.renderActions(); ui.updateHUD();
  return { map: game.s.map, seed: game.s.seed, time: game.s.time, camera: game.s.cam, placed };
}
