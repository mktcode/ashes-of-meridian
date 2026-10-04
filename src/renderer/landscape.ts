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
  const outerExtent=Math.max(extent,relief.outerExtent??extent),edge=size-2,
    innerLow=Math.max(1,Math.ceil((extent-(innerExtent??0))/step)+1),
    innerHigh=Math.min(edge,Math.floor((extent+(innerExtent??0))/step)+1),
    innerLength=innerExtent&&innerHigh>innerLow?4*(innerHigh-innerLow)*54:0,
    rimLength=!innerExtent||outerExtent>extent?4*(size-3)*54:0,
    vertices=new Float32Array(size*size*9),out=new Float32Array(cells*54+innerLength+rimLength);
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
  const rim:number[]=[];
  // Close both sides of the fine/coarse join: the coarse edge can also be higher
  // than the fine edge between samples. Hole walls face inward, skin walls outward.
  // Exterior meshes additionally continue their boundary beyond the largest view.
  const strip=(corners:number[][],segments:number,extend:boolean)=>{
    for(let side=0;side<4;side++)for(let j=0;j<segments;j++) {
      const from=corners[side],to=corners[(side+1)%4],
        at=(t:number)=>{const x=Math.round(from[0]+(to[0]-from[0])*t),z=Math.round(from[1]+(to[1]-from[1])*t);
          return vertices.subarray((z*size+x)*9,(z*size+x)*9+9);},
        a=at(j/segments),b=at((j+1)/segments),
        lower=(v:Float32Array)=>extend
          ? [v[0]*outerExtent/extent,v[1],v[2]*outerExtent/extent] : [v[0],-.13,v[2]],
        pa=[a[0],a[1],a[2]],pb=[b[0],b[1],b[2]],qa=lower(a),qb=lower(b),
        color=[a[6],a[7],a[8]];
      geom.tri(rim,pa,pb,qb,color);
      geom.tri(rim,pa,qb,qa,color);
    }
  };
  if(innerLength)strip([[innerLow,innerLow],[innerLow,innerHigh],[innerHigh,innerHigh],[innerHigh,innerLow]],innerHigh-innerLow,false);
  if(!innerExtent||outerExtent>extent)strip([[1,1],[edge,1],[edge,edge],[1,edge]],edge-1,!!innerExtent);
  out.set(rim,offset);
  return out;
};
