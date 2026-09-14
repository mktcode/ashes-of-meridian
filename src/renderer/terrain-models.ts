/* CPU mesh factories dispatched by world descriptors, independent of map IDs. */
'use strict';
const TerrainModels = {
      geometry(descriptor: WorldGeometry): number[] {
        const factory = Object.hasOwn(TerrainModels, descriptor.model) && TerrainModels[descriptor.model];
        if (typeof factory !== 'function' || descriptor.model === 'geometry')
          throw new Error('Unknown terrain model: ' + descriptor.model);
        // Descriptors distinguish feature meshes from seeded reusable scenery.
        return 'feature' in descriptor
          ? (factory as (feature: WorldTerrainFeature) => number[])(descriptor.feature)
          : (factory as (seed: number, extent: number) => number[])(descriptor.seed, descriptor.extent);
      }
} as TerrainModelCatalog;
