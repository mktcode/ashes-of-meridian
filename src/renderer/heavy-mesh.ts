/* Destroyer mesh factories and animation; geometry is authoritative TypeScript data. */
'use strict';
type HeavyModelId = 'breakwater' | 'crownwing' | 'catafalque';
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
function registerHeavyModel(name: HeavyModelId, faction: FactionId) {
  const model = HEAVY_MODELS[name], moving = model.moving, prefix = `heavy${faction}`;
  const meshes: Record<string,()=>number[]> = {
    [`${prefix}Body`]: () => model.body(),
    [`${prefix}BodyNeutral`]: () => model.body(true)
  };
  if (model.team) meshes[`${prefix}Team`] = () => model.team!();
  for (const {index,mesh} of moving) {
    meshes[`${prefix}Part${index}`] = () => mesh();
    meshes[`${prefix}Part${index}Neutral`] = () => mesh(true);
  }
  registerEntityModel({id:`faction-${faction}/unit/destroyer`,meshes,
    render({entity,time,nightPart:part,part:basePart,nightLight,team,surfaceColor,pointLight}) {
      const scale = .72, surface = surfaceColor(0xffffff), neutral = surface !== 0xffffff ? 'Neutral' : '';
      // The hull remains nonemissive; use its existing team detail as the lamp.
      pointLight(0, name === 'crownwing' ? 1.9 : name === 'catafalque' ? 2.1 : 1,
        name === 'crownwing' ? 1.1 : name === 'catafalque' ? 2.8 : 3, 10, team, 3);
      part(`${prefix}Body${neutral}`,0,0,0,scale,scale,scale,surface);
      if (name === 'breakwater') basePart(`${prefix}Team`,0,0,0,scale,scale,scale,surfaceColor(team),0,0,0,2.4*nightLight);
      else part('sphere',0,name === 'crownwing' ? 1.9 : 2.1,
        name === 'crownwing' ? 1.1 : 2.8,.16,.08,.16,surfaceColor(team),0,0,0,.35);
      for (const {name:partName,translation,index} of moving) {
        const [x,y,z] = translation, phase = time * 1.5 + entity.id * .13;
        const flap = name === 'crownwing' ? Math.sin(phase) * (partName.includes('Main_') ? .22 : .13) * (x < 0 ? -1 : 1) : 0;
        const spin = name === 'breakwater' ? time * 2.5 : name === 'catafalque' && partName.includes('gyroscope') ? time * .4 : 0;
        const bob = name === 'catafalque' && partName.includes('Mandate_tablet') ? Math.sin(phase + index) * .07 : 0;
        // The Breakwater's front-facing rotors spin around local Z, not the hull's Y axis.
        part(`${prefix}Part${index}${neutral}`,x*scale,(y+bob)*scale,z*scale,scale,scale,scale,
          surface,name === 'breakwater' ? 0 : spin,0,name === 'breakwater' ? spin : flap);
      }
    }});
}
