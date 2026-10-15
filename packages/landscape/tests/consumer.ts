import { importGameMap, heightAt, walkableAt, createTerrainMesh, raycastTerrain, boundsOf, type GameMap } from '@aom/landscape';
import { createCrowdSurface, createProfileMask } from '@aom/landscape/crowd';
import { createHeightfield, createNavigationWorld, canStand, type Heightfield } from '@aom/crowd-simulation';
async function consume(bytes: Uint8Array): Promise<Heightfield> {
  const map: GameMap = await importGameMap(bytes);
  const h: number | null = heightAt(map, 0, 0);
  const free: boolean = walkableAt(map, 0, 0);
  const mesh = createTerrainMesh(map);
  const indices: Uint32Array = mesh.indices;
  const ray = raycastTerrain(map, [0,1000,0], [0,-1,0]);
  const bounds = boundsOf(map);
  const surface = createCrowdSurface(map, createHeightfield);
  const navigation = createNavigationWorld({ surface, obstacles: [], profiles: { small: { radius: .4, maxSlope: .6, maxSpeed: 2 } } });
  const mask: Uint8Array = createProfileMask(map, navigation, 'small', canStand);
  void [h, free, indices, ray?.distance, bounds.minZ, mask];
  // @ts-expect-error Maps must be imported, not arbitrary height arrays.
  const invalid: GameMap = { heights: new Float32Array() };
  // @ts-expect-error Terrain grid metadata is readonly.
  map.manifest.grid.nx = 1;
  void invalid;
  return surface;
}
void consume;
