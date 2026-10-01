/* Westmark scenery factories. Material weights / foliage UVs occupy the tint
 * attribute only for their explicit materials; entity vertex contracts are unchanged. */
'use strict';
(() => {
  // The retained bridge art factory owns its ramp profile; no authored map data is loaded.
  const westmarkDeckHeight = (b: WorldTerrainFeature, u: number) => 10 + (b.height - 10) * clamp((b.width - Math.abs(u)) / 7, 0, 1);
  TerrainModels.westmarkWater=(field:WorldRelief)=>{
    const out:number[]=[],{size,step,extent,heights,colors}=field;
    const vertex=(i:number)=>[(i%size-1)*step-extent,heights[i],(Math.floor(i/size)-1)*step-extent,
      colors![i*3],colors![i*3+1],colors![i*3+2]];
    for(let row=1;row<size-2;row++)for(let col=1;col<size-2;col++) {
      const a=row*size+col,b=a+1,c=a+size+1,d=a+size;
      for(const indices of [[a,d,c],[a,c,b]]) {
        if(indices.every(i=>colors![i*3]<=0))continue;
        const input=indices.map(vertex),polygon:number[][]=[];
        for(let i=0;i<3;i++) {
          const p=input[i],q=input[(i+1)%3];
          if(p[3]>=0)polygon.push(p);
          if(p[3]*q[3]<0) {
            const t=p[3]/(p[3]-q[3]);polygon.push(p.map((v,k)=>v+(q[k]-v)*t));
          }
        }
        for(let i=1;i<polygon.length-1;i++) {
          const points=[polygon[0],polygon[i],polygon[i+1]],
            normal=V.norm(V.cross(V.sub(points[1].slice(0,3),points[0].slice(0,3)),V.sub(points[2].slice(0,3),points[0].slice(0,3))));
          for(const p of points)out.push(...p.slice(0,3),...normal,Math.max(0,p[3]),p[4],p[5]);
        }
      }
    }
    return out;
  };
  TerrainModels.westmarkBridge=(b:WorldTerrainFeature)=>{
    const out:number[]=[],c=Math.cos(b.yaw),s=Math.sin(b.yaw),
      p=(u:number,y:number,v:number)=>[b.x+u*c+v*s,y,b.z-u*s+v*c],
      quad=(a:number[],b:number[],c:number[],d:number[],tint=[.58,.60,.56])=>{geom.tri(out,a,b,c,tint);geom.tri(out,a,c,d,tint);},
      rand=seeded(b.seed^0x42524944);
    // Chamfered stone blocks: mortar joints, coping and paving are actual geometry.
    // The roadway stays below the CPU deck; all raised masonry stays in the parapet band.
    const block=(u:number,v:number,w:number,d:number,bottom:number,top:number,shade:number,sides=true)=>{
      const bevel=Math.min(.065,w*.12,d*.12,(top-bottom)*.4),
        lo=[[u-w/2,v-d/2],[u-w/2,v+d/2],[u+w/2,v+d/2],[u+w/2,v-d/2]],
        hi=lo.map(([x,z])=>[x+Math.sign(u-x)*bevel,z+Math.sign(v-z)*bevel]),
        tint=[shade,shade*.99,shade*.94],shoulder=sides?top-bevel:bottom;
      quad(...hi.map(([x,z])=>p(x,top,z)) as [number[],number[],number[],number[]],tint);
      for(let k=0;k<4;k++) {
        const next=(k+1)%4,a=lo[k],d=lo[next],h=hi[k],j=hi[next];
        if(sides)quad(p(a[0],bottom,a[1]),p(d[0],bottom,d[1]),p(d[0],shoulder,d[1]),p(a[0],shoulder,a[1]),tint);
        quad(p(a[0],shoulder,a[1]),p(d[0],shoulder,d[1]),p(j[0],top,j[1]),p(h[0],top,h[1]),tint);
      }
    };
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
    const rows=Math.ceil((b.depth-1.1)*2/1.15),rowDepth=(b.depth-1.1)*2/rows;
    for(let row=0;row<rows;row++) {
      const v=-b.depth+1.1+(row+.5)*rowDepth,stagger=(row%2)*.8;
      for(let u=-b.width-1.6+stagger;u<b.width;u+=1.6) {
        const lo=Math.max(-b.width,u),hi=Math.min(b.width,u+1.6);
        if(hi-lo<.15)continue;
        block((lo+hi)/2,v,hi-lo-.045,rowDepth-.04,b.height-.12,b.height-.045,.76+rand()*.24,false);
      }
    }
    for(const side of [-1,1]) {
      for(let row=0;row<3;row++)for(let u=-b.width;u<b.width;u+=1.5) {
        const hi=Math.min(b.width,u+1.5),offset=row%2?.32:0;
        const lo=Math.min(hi-.08,u+offset);
        block((lo+hi)/2,side*(b.depth-.35),hi-lo-.035,.72,b.height-.08+row*.26,b.height+.16+row*.26,.74+rand()*.23);
      }
      for(let u=-b.width;u<b.width;u+=1.8) {
        const hi=Math.min(b.width,u+1.8);
        block((u+hi)/2,side*(b.depth-.35),hi-u-.035,.92,b.height+.70,b.height+.94,.92+rand()*.10);
      }
      for(const u of [-b.width+1.8,0,b.width-1.8]) {
        block(u,side*(b.depth-.35),1.15,1.08,b.height-.12,b.height+1.1,.85);
        block(u,side*(b.depth-.35),1.34,1.20,b.height+1.1,b.height+1.3,.99);
      }
      // Radial voussoirs emphasize the shallow arch above the water.
      for(let j=0;j<24;j++) {
        const a=-b.width+j*b.width/12,d=-b.width+(j+1)*b.width/12,
          under=(u:number)=>b.height-2.8+2.05*Math.sqrt(Math.max(0,1-(u/b.width)**2)),v=side*(b.depth+.015),
          tint=[.76+rand()*.2,.76+rand()*.15,.70+rand()*.15];
        quad(p(a+.025,under(a)+.04,v),p(d-.025,under(d)+.04,v),
          p(d-.025,under(d)+.40,v),p(a+.025,under(a)+.40,v),tint);
      }
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
    // Overlapping radial whorls fill the crown rather than exposing a spiral of
    // single flat fronds. Crossed sprays also retain volume in oblique views.
    // Keep the existing tree envelope; this mesh-local RNG never places blockers.
    for(let layer=0;layer<18;layer++)for(let arm=0;arm<7;arm++) {
      const t=layer/18,y=1.65+t*9.35+(rand()-.5)*.15,
        angle=arm*Math.PI*2/7+layer*2.39996+(rand()-.5)*.24,
        len=((1-t)*2.45+.25)*(.86+rand()*.14),width=(1-t)*2.1+.30,
        cs=Math.cos(angle),sn=Math.sin(angle),
        base=[cs*.08,y,sn*.08],tip=[cs*len,y+.15+t*.35,sn*len],
        uv=[[0,1],[1,1],[1,0],[0,0]],shade=.8+rand()*.2;
      for(const tilt of [.2+rand()*.25,1.05+rand()*.25]) {
        const spread=width*.5*Math.cos(tilt),rise=width*.5*Math.sin(tilt),
          right=[-sn*spread,rise,cs*spread],
          points=[V.sub(base,right),base.map((v,i)=>v+right[i]),tip.map((v,i)=>v+right[i]),V.sub(tip,right)],
          normal=V.norm(V.cross(V.sub(points[1],points[0]),V.sub(points[2],points[0])));
        for(const i of [0,1,2,0,2,3])out.push(...points[i],...normal,...uv[i],shade);
      }
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
