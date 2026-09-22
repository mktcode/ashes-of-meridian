/* Westmark scenery factories. Material weights / foliage UVs occupy the tint
 * attribute only for their explicit materials; entity vertex contracts are unchanged. */
'use strict';
(() => {
  TerrainModels.westmarkRelief=(relief:WorldRelief)=>{
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
      // Same diagonal as the authoritative BattlefieldSurface, at every resolution.
      for(const i of [a,d,c,a,c,b]) {out.set(vertices.subarray(i*9,i*9+9),offset);offset+=9;}
    }
    return out;
  };
  TerrainModels.westmarkWater=()=>{
    const out:number[]=[];
    for(const river of WESTMARK_RIVERS) {
      let along=0;
      for(let j=0;j<river.length-1;j++) {
        const a=river[j],b=river[j+1],before=river[Math.max(0,j-1)],after=river[Math.min(river.length-1,j+2)],
          side=(p:Position,q:Position)=>V.norm([-(q.z-p.z),0,q.x-p.x]),sa=side(before,b),sb=side(a,after),
          next=along+Math.hypot(b.x-a.x,b.z-a.z),fall=Math.abs(b.y-a.y)/Math.max(.001,next-along),
          point=(p:typeof a,s:number[],u:number)=>[p.x+s[0]*(p.r+.9)*u,p.y,p.z+s[2]*(p.r+.9)*u];
        for(let k=0;k<8;k++) {
          const u=k/8*2-1,v=(k+1)/8*2-1,points=[point(a,sa,u),point(b,sb,u),point(b,sb,v),point(a,sa,v)],
            uv=[[k/8,along,fall],[k/8,next,fall],[(k+1)/8,next,fall],[(k+1)/8,along,fall]],
            n=V.norm(V.cross(V.sub(points[1],points[0]),V.sub(points[2],points[0])));
          for(const i of [0,1,2,0,2,3])out.push(...points[i],...n,...uv[i]);
        }
        along=next;
      }
    }
    return out;
  };
  TerrainModels.westmarkBridge=(b:WorldTerrainFeature)=>{
    const out:number[]=[],c=Math.cos(b.yaw),s=Math.sin(b.yaw),
      p=(u:number,y:number,v:number)=>[b.x+u*c+v*s,y,b.z-u*s+v*c],
      quad=(a:number[],b:number[],c:number[],d:number[])=>{geom.tri(out,a,b,c);geom.tri(out,a,c,d);};
    const steps=Math.ceil(b.width*2/2);
    for(let j=0;j<steps;j++) {
      const a=-b.width+j*b.width*2/steps,d=-b.width+(j+1)*b.width*2/steps,
        // Lift the stone skin slightly above the adjoining soil to avoid coplanar fringes.
        topA=westmarkDeckHeight(b,a)-.10,topB=westmarkDeckHeight(b,d)-.10,
        under=(u:number)=>b.height-2.8+2.05*Math.sqrt(Math.max(0,1-(u/b.width)**2));
      quad(p(a,topA,-b.depth),p(a,topA,b.depth),p(d,topB,b.depth),p(d,topB,-b.depth));
      for(const sign of [-1,1]) {
        const v=sign*b.depth;
        quad(p(a,topA,v),p(d,topB,v),p(d,under(d),v),p(a,under(a),v));
        // Separate low parapet blocks; collision protects the full outside edge.
        const lo=a+.05,hi=d-.05,v0=sign*(b.depth-.7),v1=sign*b.depth,
          y0=westmarkDeckHeight(b,(a+d)*.5)-.10,y1=y0+.85;
        quad(p(lo,y1,v0),p(lo,y1,v1),p(hi,y1,v1),p(hi,y1,v0));
        quad(p(lo,y0,v0),p(lo,y1,v0),p(hi,y1,v0),p(hi,y0,v0));
        quad(p(lo,y0,v1),p(hi,y0,v1),p(hi,y1,v1),p(lo,y1,v1));
        quad(p(lo,y0,v0),p(lo,y0,v1),p(lo,y1,v1),p(lo,y1,v0));
        quad(p(hi,y0,v0),p(hi,y1,v0),p(hi,y1,v1),p(hi,y0,v1));
      }
      quad(p(a,under(a),-b.depth),p(d,under(d),-b.depth),p(d,under(d),b.depth),p(a,under(a),b.depth));
    }
    return out;
  };
  TerrainModels.westmarkTrunk=()=>{
    const out:number[]=[];
    ModelMesh.bake(out,geom.cylinder(8,.12),{y:5.5,sx:.33,sy:11,sz:.33});
    return out;
  };
  TerrainModels.westmarkSpruce=(seed:number)=>{
    const out:number[]=[],rand=seeded(seed^0x53505255);
    for(let j=0;j<44;j++) {
      const t=j/44,y=1.5+t*9.5,angle=j*2.39996,len=(1-t)*2.6+.25,
        cs=Math.cos(angle),sn=Math.sin(angle),width=(1-t)*1.3+.24,
        base=[cs*.15,y,sn*.15],tip=[cs*len,y+.3+rand()*.4,sn*len],
        right=[-sn*width*.5,.15,cs*width*.5],
        points=[V.sub(base,right),base.map((v,i)=>v+right[i]),tip.map((v,i)=>v+right[i]),V.sub(tip,right)],
        uv=[[0,1],[1,1],[1,0],[0,0]],shade=.8+rand()*.2,
        normal=V.norm(V.cross(V.sub(points[1],points[0]),V.sub(points[2],points[0])));
      for(const i of [0,1,2,0,2,3])out.push(...points[i],...normal,...uv[i],shade);
    }
    return out;
  };
  TerrainModels.westmarkBeacon=()=>{
    const out:number[]=[],box=geom.box(),post=(x:number,y:number,z:number,sx:number,sy:number,sz:number)=>
      ModelMesh.bake(out,box,{x,y,z,sx,sy,sz});
    for(const x of [-1.3,1.3])for(const z of [-1.3,1.3])post(x,3,z,.3,6,.3);
    for(let i=0;i<8;i++)post(-1.4+i*.4,6,0,.36,.22,3.3);
    for(let i=0;i<12;i++)post(0,i*.48,1.75,1.1,.12,.14);
    for(const x of [-.5,.5])post(x,2.8,1.75,.12,5.8,.14);
    for(const x of [-1.45,1.45])post(x,6.7,0,.15,.15,3.1);
    for(const z of [-1.45,1.45])post(0,6.7,z,3.1,.15,.15);
    post(0,6.35,0,1.5,.4,1.5);
    return out;
  };
})();
