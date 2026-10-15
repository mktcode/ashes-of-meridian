import type { createHeightfield, canStand, Heightfield, NavigationWorld } from '@aom/crowd-simulation';
import { boundsOf } from './index.js';
import type { GameMap } from './contracts.js';

// Inject the consumer's factory: never bundle a second Crowd with a separate handle registry.
export function createCrowdSurface(map: GameMap, factory: typeof createHeightfield): Heightfield {
  const g = map.manifest.grid, bounds = boundsOf(map);
  return factory({ width: g.width, depth: g.length, cellSize: g.step[0],
    origin: { x: bounds.minX, z: bounds.minZ }, rowOrder: 'decreasing-z',
    diagonal: 'b-c', boundary: 'reject', heights: map.heights });
}

// Same row order as the map/mesh; radius-zero export masks are not profile clearance.
export function createProfileMask(map: GameMap, navigation: NavigationWorld, profile: string, query: typeof canStand): Uint8Array {
  const g = map.manifest.grid, mask = new Uint8Array(g.nx * g.ny);
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++)
    mask[j * g.nx + i] = Number(query(navigation, profile,
      g.origin[0] + (i + 0.5) * g.step[0], g.origin[2] + (j + 0.5) * g.step[2]));
  return mask;
}
