/* Shared synchronous mesh/preview factories; models own their construction and animation. */
'use strict';
interface HeavyModelData {
  body: (neutral?: boolean) => number[];
  team?: (neutral?: boolean) => number[];
  moving: { index: number; name: string; translation: [number, number, number]; mesh: (neutral?: boolean) => number[] }[];
}
function createHeavyMeshes(model: HeavyModelData, faction: FactionId) {
  const moving = model.moving, prefix = `heavy${faction}`;
  const meshes: Record<string,()=>number[]> = {
    [`${prefix}Body`]: () => model.body(),
    [`${prefix}BodyNeutral`]: () => model.body(true)
  };
  if (model.team) meshes[`${prefix}Team`] = () => model.team!();
  for (const {index,mesh} of moving) {
    meshes[`${prefix}Part${index}`] = () => mesh();
    meshes[`${prefix}Part${index}Neutral`] = () => mesh(true);
  }
  return meshes;
}
