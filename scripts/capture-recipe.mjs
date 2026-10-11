import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';

// Node 24 reads the same pure validator/math that the classic browser build uses.
// No transpiler package, browser initialization or duplicated recipe schema.
const schemas = new Map();
export function captureSchema(root = resolve(import.meta.dirname, '..')) {
  if (!schemas.has(root)) {
    const source = stripTypeScriptTypes(readFileSync(resolve(root, 'src/capture.ts'), 'utf8'), {
      mode: 'transform',
    });
    const catalog = stripTypeScriptTypes(
      readFileSync(resolve(root, 'src/battlefields/catalog.ts'), 'utf8'),
      { mode: 'strip' },
    );
    schemas.set(
      root,
      runInNewContext(
        `${catalog}\n${source}\n({maps:availableBattlefields(), validate:validateCaptureScene, resolve:resolveCaptureCamera, view:captureViewMatrix})`,
        { createDynamicBattlefield: () => ({}) },
      ),
    );
  }
  return schemas.get(root);
}
export function validateCapture(scene, shotOnly = false) {
  return captureSchema().validate(scene, shotOnly);
}
export function resolveShots(scene) {
  validateCapture(scene);
  const { shots, ...defaults } = scene,
    content = scene.content;
  for (const key of ['map', 'seed', 'faction', 'enemy', 'content', 'entities'])
    delete defaults[key];
  const defaultHud = defaults.hud;
  delete defaults.hud;
  const list = shots ?? [{ name: scene.name ?? 'scene' }];
  const names = new Set();
  return list.map((shot, i) => {
    const resolved = {
      reveal: true,
      quality: 2,
      dpr: 1,
      ...defaults,
      ...shot,
      camera: shot.camera ?? defaults.camera ?? { mode: 'game', fit: 'map' },
      render: {
        units: true,
        buildings: true,
        effects: true,
        caches: content !== 'landscape',
        guides: false,
        mapBoundary: false,
        distanceMist: content !== 'landscape',
        horizonMist: content !== 'landscape',
        hud: false,
        ...defaults.render,
        ...(defaultHud === undefined ? {} : { hud: defaultHud }),
        ...shot.render,
      },
      name: shot.name ?? `shot-${i + 1}`,
    };
    validateCapture(resolved, true);
    if (names.has(resolved.name)) throw Error(`Duplicate shot name: ${resolved.name}`);
    names.add(resolved.name);
    return resolved;
  });
}
