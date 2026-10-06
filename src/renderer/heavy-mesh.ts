/* Shared indexed mesh expansion and preview factories; models own their data and animation. */
'use strict';
interface HeavyModelData {
  body: (neutral?: boolean) => number[];
  team?: (neutral?: boolean) => number[];
  moving: { index: number; name: string; translation: [number, number, number]; mesh: (neutral?: boolean) => number[] }[];
}
function expandHeavyMesh(positions: readonly number[], normals: readonly number[], tints: readonly number[],
  vertices: readonly number[], neutral = false): number[] {
  const out = new Array<number>(vertices.length * 3);
  for (let i = 0; i < vertices.length; i += 3) {
    const position = vertices[i] * 3, normal = vertices[i + 1] * 3, tint = vertices[i + 2] * 3;
    for (let k = 0; k < 3; k++) {
      out[i * 3 + k] = positions[position + k];
      out[i * 3 + k + 3] = normals[normal + k];
      out[i * 3 + k + 6] = neutral ? 1 : tints[tint + k];
    }
  }
  return out;
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
