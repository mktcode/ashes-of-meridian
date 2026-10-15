import * as source from './map.js';
import type { GameMap, MapInput, TerrainMesh, BoundsXZ } from './contracts.js';
export * from './contracts.js';
export { raycastTerrain, normalAt } from './surface.js';
export const MAP_FORMAT = 'strata-game-map', MAP_VERSION = 1;
export const MAX_MAP_BYTES = source.MAX_MAP_BYTES;
export const MAP_GRID = source.MAP_GRID;

export async function importGameMap(input: MapInput): Promise<GameMap> {
  if (!(input instanceof ArrayBuffer) && !(input instanceof Uint8Array)) {
    if (!input || !Number.isSafeInteger(input.size) || input.size < 22 || input.size > MAX_MAP_BYTES
      || typeof input.arrayBuffer !== 'function') throw Error('ZIP-Paket ist zu groß oder ungültig.');
    input = await input.arrayBuffer();
  }
  return await source.importGameMap(input) as GameMap;
}
export function heightAt(map: GameMap, x: number, z: number): number | null {
  return source.heightAt(map, x, z);
}
// Radius-zero terrain predicate, not a Crowd profile clearance query.
export function walkableAt(map: GameMap, x: number, z: number): boolean {
  return source.walkableAt(map, x, z);
}
export function createTerrainMesh(map: GameMap): TerrainMesh {
  return source.createTerrainMesh(map) as TerrainMesh;
}
export function boundsOf(map: GameMap): BoundsXZ {
  const g = map.manifest.grid;
  return { minX: g.origin[0], maxX: g.origin[0] + g.width,
    minZ: g.origin[2] - g.length, maxZ: g.origin[2] };
}
