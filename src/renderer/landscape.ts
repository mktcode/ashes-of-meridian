/* Shared height-field skin for authored and generated landscapes. Tint carries
 * material weights; triangles agree with the authoritative BattlefieldSurface. */
'use strict';
function landscapeReliefVertex(field:WorldRelief,x:number,z:number):number[] {
  const {size,step,extent,heights,colors,innerRelief}=field,
    wx=(x-1)*step-extent,wz=(z-1)*step-extent;
  if(innerRelief&&Math.max(Math.abs(wx),Math.abs(wz))===field.innerExtent)
    return landscapeReliefVertex(innerRelief,Math.round((wx+innerRelief.extent)/innerRelief.step)+1,
      Math.round((wz+innerRelief.extent)/innerRelief.step)+1);
  const i=z*size+x,normal=V.norm([
    heights[z*size+Math.max(0,x-1)]-heights[z*size+Math.min(size-1,x+1)],step*2,
    heights[Math.max(0,z-1)*size+x]-heights[Math.min(size-1,z+1)*size+x]]);
  return [wx,heights[i],wz,...normal,colors?.[i*3]??0,colors?.[i*3+1]??1,colors?.[i*3+2]??0];
}
// Zipper each coarse border cell to every fine edge vertex. No T-junctions,
// vertical seam, or independently sampled boundary heights/normals/materials.
function landscapeJoinEdge(field:WorldRelief,x:number,z:number):number[][]|null {
  if(!field.innerRelief)return null;
  const wx=(x-1)*field.step-field.extent,wz=(z-1)*field.step-field.extent,e=field.innerExtent,s=field.step,
    a=[x,z],b=[x+1,z],c=[x+1,z+1],d=[x,z+1];
  if(wx===e&&wz>=-e&&wz+s<=e)return [a,d,b,c];
  if(wx+s===-e&&wz>=-e&&wz+s<=e)return [c,b,d,a];
  if(wz+s===-e&&wx>=-e&&wx+s<=e)return [d,c,a,b];
  if(wz===e&&wx>=-e&&wx+s<=e)return [b,a,c,d];
  return null;
}
function landscapeJoinTriangles(field:WorldRelief,x:number,z:number):number[][]|null {
  const edge=landscapeJoinEdge(field,x,z),fine=field.innerRelief;
  if(!edge||!fine)return null;
  const [from,to,outFrom,outTo]=edge,segments=field.step/fine.step,
    at=(t:number)=>landscapeReliefVertex(fine,
      Math.round(((from[0]+(to[0]-from[0])*t-1)*field.step-field.extent+fine.extent)/fine.step)+1,
      Math.round(((from[1]+(to[1]-from[1])*t-1)*field.step-field.extent+fine.extent)/fine.step)+1),
    outer=landscapeReliefVertex(field,outFrom[0],outFrom[1]),triangles:number[][]=[];
  let previous=at(0);
  for(let i=1;i<=segments;i++) {
    const next=at(i/segments);triangles.push(outer,previous,next);previous=next;
  }
  triangles.push(outer,previous,landscapeReliefVertex(field,outTo[0],outTo[1]));
  return triangles;
}
// Cosmetic grounding and exterior sight tiers use the same stitched triangles.
function landscapeReliefHeightAt(field:WorldRelief,x:number,z:number):number {
  const reach=Math.max(Math.abs(x),Math.abs(z));
  if(!field.innerRelief||reach>field.innerExtent+field.step)return worldReliefHeightAt(field,x,z);
  if(reach<=field.innerExtent)return worldReliefHeightAt(field.innerRelief,x,z);
  const col=Math.floor((x+field.extent)/field.step)+1,row=Math.floor((z+field.extent)/field.step)+1,
    a=()=>landscapeReliefVertex(field,col,row),b=()=>landscapeReliefVertex(field,col+1,row),
    c=()=>landscapeReliefVertex(field,col+1,row+1),d=()=>landscapeReliefVertex(field,col,row+1),
    triangles=landscapeJoinTriangles(field,col,row)??[a(),d(),c(),a(),c(),b()];
  for(let i=0;i<triangles.length;i+=3) {
    const [a,b,c]=triangles.slice(i,i+3),den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]),
      u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,
      v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;
    if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)return u*a[1]+v*b[1]+(1-u-v)*c[1];
  }
  throw Error('Point outside stitched landscape cell');
}
TerrainModels.landscapeRelief=(relief:WorldRelief)=>{
  const {size,step,extent,innerExtent,innerRelief}=relief;
  if(innerRelief&&(innerRelief.extent!==innerExtent||!Number.isSafeInteger(step/innerRelief.step)||step<innerRelief.step||
      (extent-innerExtent)/step%1))throw Error('Landscape stitch requires aligned fine/coarse grids');
  const visible=(x:number,z:number)=>{
    const wx=(x-1)*step-extent,wz=(z-1)*step-extent;
    return !(innerExtent&&wx>=-innerExtent&&wz>=-innerExtent&&wx+step<=innerExtent&&wz+step<=innerExtent);
  };
  let cells=0,joins=0;
  for(let z=1;z<size-2;z++)for(let x=1;x<size-2;x++)if(visible(x,z)) {
    cells++;if(landscapeJoinEdge(relief,x,z))joins++;
  }
  const outerExtent=Math.max(extent,relief.outerExtent??extent),edge=size-2,
    joinLength=joins*((innerRelief?step/innerRelief.step:1)-1)*27,
    rimLength=!innerExtent||outerExtent>extent?4*(size-3)*54:0,
    vertices=new Float32Array(size*size*9),out=new Float32Array(cells*54+joinLength+rimLength);
  for(let z=0;z<size;z++)for(let x=0;x<size;x++)
    vertices.set(landscapeReliefVertex(relief,x,z),(z*size+x)*9);
  let offset=0;
  for(let z=1;z<size-2;z++)for(let x=1;x<size-2;x++) {
    if(!visible(x,z))continue;
    const joined=landscapeJoinTriangles(relief,x,z);
    if(joined)for(const v of joined) {out.set(v,offset);offset+=9;}
    else {
      const a=z*size+x,b=a+1,c=a+size+1,d=a+size;
      for(const i of [a,d,c,a,c,b]) {out.set(vertices.subarray(i*9,i*9+9),offset);offset+=9;}
    }
  }
  const rim:number[]=[];
  // The fine skin's downward skirt remains a concealed underside closure;
  // joined exteriors have a continuous apron, not a visible vertical hole wall.
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
  if(!innerExtent||outerExtent>extent)strip([[1,1],[edge,1],[edge,edge],[1,edge]],edge-1,!!innerExtent);
  out.set(rim,offset);
  return out;
};
