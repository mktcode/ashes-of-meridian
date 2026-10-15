import { importGameMap, heightAt, normalAt, raycastTerrain } from '../src/index.ts';
import { createCrowdSurface, createProfileMask } from '../src/crowd.ts';

// Preparation does not touch a running demo. The caller commits or disposes the result.
export async function prepareSession(input, api, profiles, signal) {
  signal?.throwIfAborted();
  const map = await importGameMap(input);
  signal?.throwIfAborted();
  const surface = createCrowdSurface(map, api.createHeightfield);
  const navigation = api.createNavigationWorld({ surface, obstacles: [], profiles });
  const masks = Object.fromEntries(Object.keys(profiles).map(profile =>
    [profile, createProfileMask(map, navigation, profile, api.canStand)]));
  const { nx, ny, origin, step } = map.manifest.grid;
  const pointAt = k => ({ x: origin[0] + (k % nx + 0.5) * step[0], z: origin[2] + (Math.floor(k / nx) + 0.5) * step[2] });
  const profileMasks = Object.values(masks);
  const common = k => map.corridors[k] && profileMasks.every(mask => mask[k]);
  function nearest(target) {
    let found = -1, distance = Infinity;
    for (let k = 0; k < nx * ny; k++) if (common(k)) {
      const p = pointAt(k), d = (p.x - target[0]) ** 2 + (p.z - target[1]) ** 2;
      if (d < distance) { found = k; distance = d; }
    }
    if (found < 0) throw Error('Kein gemeinsamer profilfreier Korridorbereich. Karte bleibt unverändert.');
    return pointAt(found);
  }
  const entry = map.routes.find(r => r.kind === 'entry');
  const exit = map.routes.find(r => r.kind === 'exit');
  const portals = { south: nearest(entry.points[0]), north: nearest(exit.points.at(-1)) };
  const waypoints = new Map(Object.entries(portals));
  for (const route of map.routes) for (const [id, p] of [[route.from, route.points[0]], [route.to, route.points.at(-1)]])
    if (!waypoints.has(id)) waypoints.set(id, nearest(p));
  const crowd = api.createCrowd({ navigation, contactMode: 'none' });
  try {
    const marine = crowd.createGroup({ profile: 'marine', team: 0, spawnOrigin: portals.south });
    const tank = crowd.createGroup({ profile: 'tank', team: 0, spawnOrigin: portals.south });
    const tanks = crowd.spawn(tank, 2), marines = crowd.spawn(marine, 8);
    const terrain = {
      heightAt(x, z) {
        const value = heightAt(map, x, z);
        if (value === null) throw RangeError('Terrainabfrage außerhalb der Karte.');
        return value;
      },
      sample(x, z) { return { y: this.heightAt(x, z), normal: normalAt(map, x, z) }; },
      pick(ndcX, ndcY, camera) {
        const rayOrigin = camera.right.map((value, i) => value * ndcX / camera.scale[0]
          + camera.up[i] * ndcY / camera.scale[1] + camera.eye[i] * camera.depth + camera.center[i]);
        return raycastTerrain(map, rayOrigin, camera.eye.map(v => -v));
      },
    };
    return { map, surface, navigation, masks, crowd, terrain, portals, waypoints,
      clock: api.createFixedStepClock(), frame: api.createCrowdFrameBuffer(),
      spawnComplete: marines.complete && tanks.complete,
      dispose() { crowd.dispose(); } };
  } catch (error) { crowd.dispose(); throw error; }
}
