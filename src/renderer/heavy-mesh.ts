/* Embedded authored GLB geometry; decoded only by the synchronous mesh factories at renderer initialization. */
'use strict';
type HeavyModelId = 'breakwater' | 'crownwing' | 'catafalque';
interface HeavyAccessor { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string }
interface HeavyPrimitive { attributes: { POSITION: number; NORMAL: number; COLOR_0?: number }; indices: number; material: number; mode?: number }
interface HeavyNode { name: string; mesh?: number; translation?: number[]; rotation?: number[]; scale?: number[] }
interface HeavyDocument {
  nodes: HeavyNode[];
  meshes: { primitives: HeavyPrimitive[] }[];
  accessors: HeavyAccessor[];
  bufferViews: { byteOffset?: number; byteStride?: number }[];
  materials: { name: string; pbrMetallicRoughness?: { baseColorFactor?: number[] } }[];
}
const HEAVY_MODELS: Record<HeavyModelId, { document: HeavyDocument; binary: string }> =
  HEAVY_GLB as unknown as Record<HeavyModelId, { document: HeavyDocument; binary: string }>;
const heavyBinaryCache: Partial<Record<HeavyModelId, DataView>> = {};
function heavyBinary(name: HeavyModelId) {
  if (heavyBinaryCache[name]) return heavyBinaryCache[name]!;
  const encoded = HEAVY_MODELS[name].binary, bytes = new Uint8Array(encoded.length * 3 >> 2);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let j = 0, bits = 0, value = 0;
  for (let i = 0; i < encoded.length; i++) {
    const digit = alphabet.indexOf(encoded[i]);
    if (digit < 0) break;
    value = (value << 6) | digit; bits += 6;
    if (bits >= 8) { bits -= 8; bytes[j++] = (value >>> bits) & 255; }
  }
  return heavyBinaryCache[name] = new DataView(bytes.buffer, 0, j);
}
function heavyMesh(name: HeavyModelId, selected: number, moving: readonly number[], neutral = false, teamOnly = false): number[] {
  const d = HEAVY_MODELS[name].document, data = heavyBinary(name), out: number[] = [];
  const accessor = (id: number) => {
    const a = d.accessors[id], view = d.bufferViews[a.bufferView], start = (view.byteOffset || 0) + (a.byteOffset || 0),
      width = a.componentType === 5126 || a.componentType === 5125 ? 4 : a.componentType === 5123 ? 2 : 1,
      size = a.type === 'VEC4' ? 4 : a.type === 'VEC3' ? 3 : 1,
      stride = view.byteStride || width * size;
    return (index: number, channel = 0) => {
      const offset = start + index * stride + channel * width;
      if (a.componentType === 5126) return data.getFloat32(offset, true);
      if (a.componentType === 5125) return data.getUint32(offset, true);
      if (a.componentType === 5123) return data.getUint16(offset, true);
      if (a.componentType === 5121) return data.getUint8(offset);
      throw Error('Unsupported heavy mesh accessor');
    };
  };
  for (let nodeId = 0; nodeId < d.nodes.length; nodeId++) {
    const node = d.nodes[nodeId];
    if (node.mesh === undefined || (selected === -1 ? moving.includes(nodeId) : selected !== nodeId)) continue;
    const q = node.rotation || [0, 0, 0, 1], scale = node.scale || [1, 1, 1],
      translation = selected === -1 ? node.translation || [0, 0, 0] : [0, 0, 0];
    const rotate = (x: number, y: number, z: number) => {
      const [qx, qy, qz, qw] = q, ix = qw*x + qy*z - qz*y, iy = qw*y + qz*x - qx*z,
        iz = qw*z + qx*y - qy*x, iw = -qx*x - qy*y - qz*z;
      return [ix*qw + iw*-qx + iy*-qz - iz*-qy,
        iy*qw + iw*-qy + iz*-qx - ix*-qz,
        iz*qw + iw*-qz + ix*-qy - iy*-qx];
    };
    for (const primitive of d.meshes[node.mesh].primitives) {
      const teamMaterial = name === 'breakwater' && d.materials[primitive.material].name === 'Team / orange';
      if (teamMaterial !== teamOnly) continue;
      if ((primitive.mode ?? 4) !== 4) throw Error('Heavy model requires triangles');
      const pos = accessor(primitive.attributes.POSITION), normal = accessor(primitive.attributes.NORMAL),
        color = primitive.attributes.COLOR_0 === undefined ? null : accessor(primitive.attributes.COLOR_0),
        index = accessor(primitive.indices), base = d.materials[primitive.material].pbrMetallicRoughness?.baseColorFactor || [1,1,1];
      const count = d.accessors[primitive.indices].count;
      for (let i = 0; i < count; i++) {
        const v = index(i), p = rotate(pos(v,0)*scale[0],pos(v,1)*scale[1],pos(v,2)*scale[2]),
          n = rotate(normal(v,0),normal(v,1),normal(v,2));
        out.push(p[0]+translation[0],p[1]+translation[1],p[2]+translation[2],...n,
          ...[0,1,2].map(k=>neutral || teamOnly ? 1 : Math.min(1.5,Math.pow(Math.max(0,base[k]*(color ? color(v,k) : 1)),1/2.2))));
      }
    }
  }
  return out;
}
function registerHeavyModel(name: HeavyModelId, faction: FactionId) {
  const nodes = HEAVY_MODELS[name].document.nodes,
    moving = nodes.map((node, index) => ({node,index})).filter(({node}) =>
      name === 'breakwater' ? node.name.includes('Turbine_rotor') :
      name === 'crownwing' ? node.name.includes('wing_') :
      node.name.includes('gyroscope') || node.name.includes('Mandate_tablet')),
    indexes = moving.map(({index})=>index), prefix = `heavy${faction}`;
  const meshes: Record<string,()=>number[]> = {
    [`${prefix}Body`]: () => heavyMesh(name,-1,indexes),
    [`${prefix}BodyNeutral`]: () => heavyMesh(name,-1,indexes,true)
  };
  if (name === 'breakwater') meshes[`${prefix}Team`] = () => heavyMesh(name,-1,indexes,false,true);
  for (const {index} of moving) {
    meshes[`${prefix}Part${index}`] = () => heavyMesh(name,index,indexes);
    meshes[`${prefix}Part${index}Neutral`] = () => heavyMesh(name,index,indexes,true);
  }
  registerEntityModel({id:`faction-${faction}/unit/destroyer`,meshes,
    render({entity,time,part,team,surfaceColor}) {
      const scale = .72, surface = surfaceColor(0xffffff), neutral = surface !== 0xffffff ? 'Neutral' : '';
      part(`${prefix}Body${neutral}`,0,0,0,scale,scale,scale,surface);
      if (name === 'breakwater') part(`${prefix}Team`,0,0,0,scale,scale,scale,surfaceColor(team));
      else part('sphere',0,name === 'crownwing' ? 1.9 : 2.1,
        name === 'crownwing' ? 1.1 : 2.8,.16,.08,.16,surfaceColor(team),0,0,0,.35);
      for (const {node,index} of moving) {
        const [x,y,z] = node.translation || [0,0,0], phase = time * 1.5 + entity.id * .13;
        const flap = name === 'crownwing' ? Math.sin(phase) * (node.name.includes('Main_') ? .22 : .13) * (x < 0 ? -1 : 1) : 0;
        const spin = name === 'breakwater' ? time * 2.5 : name === 'catafalque' && node.name.includes('gyroscope') ? time * .4 : 0;
        const bob = name === 'catafalque' && node.name.includes('Mandate_tablet') ? Math.sin(phase + index) * .07 : 0;
        part(`${prefix}Part${index}${neutral}`,x*scale,(y+bob)*scale,z*scale,scale,scale,scale,
          surface,spin,0,flap);
      }
    }});
}
