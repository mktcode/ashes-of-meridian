/* Shared height-field skin for authored and generated landscapes. Tint carries
 * material weights; triangles agree with the authoritative BattlefieldSurface. */
'use strict';
TerrainModels.landscapeRelief=(relief:WorldRelief)=>{
  const {size,step,extent,heights,colors,innerExtent}=relief;
  const visible=(x:number,z:number)=>{
    const wx=(x-1)*step-extent,wz=(z-1)*step-extent;
    return !(innerExtent&&wx>=-innerExtent&&wz>=-innerExtent&&wx+step<=innerExtent&&wz+step<=innerExtent);
  };
  let cells=0;
  for(let z=1;z<size-2;z++)for(let x=1;x<size-2;x++)if(visible(x,z))cells++;
  const vertices=new Float32Array(size*size*9),out=new Float32Array(cells*54);
  for(let z=0;z<size;z++)for(let x=0;x<size;x++) {
    const i=z*size+x,left=heights[z*size+Math.max(0,x-1)],right=heights[z*size+Math.min(size-1,x+1)],
      back=heights[Math.max(0,z-1)*size+x],front=heights[Math.min(size-1,z+1)*size+x],
      normal=V.norm([left-right,step*2,back-front]);
    vertices.set([(x-1)*step-extent,heights[i],(z-1)*step-extent,...normal,
      colors?.[i*3]??0,colors?.[i*3+1]??1,colors?.[i*3+2]??0],i*9);
  }
  let offset=0;
  for(let z=1;z<size-2;z++)for(let x=1;x<size-2;x++) {
    if(!visible(x,z))continue;
    const a=z*size+x,b=a+1,c=a+size+1,d=a+size;
    for(const i of [a,d,c,a,c,b]) {out.set(vertices.subarray(i*9,i*9+9),offset);offset+=9;}
  }
  return out;
};
