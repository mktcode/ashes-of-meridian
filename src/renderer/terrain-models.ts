/* CPU mesh factories dispatched by world descriptors, independent of map IDs. */
'use strict';
const TerrainModels = {
      geometry(descriptor: WorldGeometry): MeshData {
        const factory = Object.hasOwn(TerrainModels, descriptor.model) && TerrainModels[descriptor.model];
        if (typeof factory !== 'function' || descriptor.model === 'geometry')
          throw new Error('Unknown terrain model: ' + descriptor.model);
        if ('plan' in descriptor) return (factory as (plan: BattlefieldPlatformPlan) => MeshData)(descriptor.plan);
        if ('relief' in descriptor) return (factory as (relief: WorldRelief) => MeshData)(descriptor.relief);
        // Descriptors distinguish feature meshes from seeded reusable scenery.
        return 'feature' in descriptor
          ? (factory as (feature: WorldTerrainFeature) => MeshData)(descriptor.feature)
          : (factory as (seed: number, extent: number) => MeshData)(descriptor.seed, descriptor.extent);
      }
} as TerrainModelCatalog;
