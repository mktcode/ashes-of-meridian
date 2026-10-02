/* Sharp deck skins and retaining walls from the same CPU-owned platform plan.
 * Wall/ramp margins are blocked by the CPU raster; no second playable surface. */
'use strict';
TerrainModels.platformDeck=(plan:BattlefieldPlatformPlan)=>{
  const out:number[]=[],floor=plan.floor-.13,
    quad=(a:number[],b:number[],c:number[],d:number[],color:number[])=>{
      geom.tri(out,a,b,c,color);geom.tri(out,a,c,d,color);
    },
    rectangle=(x:number,z:number,width:number,depth:number,y:number,color:number[])=>{
      const left=x-width/2,right=x+width/2,near=z-depth/2,far=z+depth/2;
      quad([left,y,near],[left,y,far],[right,y,far],[right,y,near],color);
    };
  // Continuous exterior apron keeps the playable boundary out of the battle view.
  rectangle(0,0,(plan.extent+400)*2,(plan.extent+400)*2,floor,[.46,.57,.64]);
  for(const p of plan.platforms){
    const top=p.height-.13,base=p.base-.13,left=p.x-p.width/2,right=p.x+p.width/2,
      near=p.z-p.depth/2,far=p.z+p.depth/2,corners=platformOutline(p);
    for(let side=0;side<corners.length;side++){
      const a=corners[side],b=corners[(side+1)%corners.length];
      geom.tri(out,[p.x,top,p.z],[a.x,top,a.z],[b.x,top,b.z],[.68,.78,.85]);
      quad([a.x,top,a.z],[a.x,base,a.z],[b.x,base,b.z],[b.x,top,b.z],[.35,.45,.54]);
    }
    // Clip painted seams to the inset polygon, never across removed corners.
    const seam=(start:Position,end:Position)=>{
      let a={...start},b={...end};
      for(let i=0;i<corners.length;i++){
        const c=corners[i],d=corners[(i+1)%corners.length],dx=d.x-c.x,dz=d.z-c.z,
          value=(v:Position)=>dx*(v.z-c.z)-dz*(v.x-c.x)+Math.hypot(dx,dz)*.5,
          av=value(a),bv=value(b);
        if(av>0&&bv>0)return;
        if(av>0||bv>0){const t=av/(av-bv),v={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};if(av>0)a=v;else b=v;}
      }
      const length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.1)return;
      const nx=-(b.z-a.z)/length*.11,nz=(b.x-a.x)/length*.11,y=top+.014;
      quad([a.x-nx,y,a.z-nz],[a.x+nx,y,a.z+nz],[b.x+nx,y,b.z+nz],[b.x-nx,y,b.z-nz],[.25,.34,.41]);
    };
    for(let x=left+10;x<right-3;x+=10)seam({x,z:near+2},{x,z:far-2});
    for(let z=near+10;z<far-3;z+=10)seam({x:left+2,z},{x:right-2,z});
  }
  for(const r of plan.ramps){
    const base=r.base-.13,nx=-r.dz*r.width/2,nz=r.dx*r.width/2,
      a=[r.x+nx,base,r.z+nz],b=[r.x-nx,base,r.z-nz],
      c=[r.x+r.dx*r.length-nx,base+r.rise,r.z+r.dz*r.length-nz],
      d=[r.x+r.dx*r.length+nx,base+r.rise,r.z+r.dz*r.length+nz];
    quad(a,d,c,b,[.75,.77,.72]);
    geom.tri(out,a,d,[d[0],base,d[2]],[.32,.41,.49]);
    geom.tri(out,b,[c[0],base,c[2]],c,[.32,.41,.49]);
    // Broad painted shoulder stripes read as entrances, not landscape trails.
    for(const side of [-1,1]){
      const offset=side*(r.width/2-2),paint=(u:number,v:number)=>[
        r.x+r.dx*u-r.dz*v,base+r.rise*u/r.length+.025,r.z+r.dz*u+r.dx*v];
      quad(paint(0,offset-.5),paint(0,offset+.5),
        paint(r.length,offset+.5),paint(r.length,offset-.5),[1,.72,.24]);
    }
  }
  return out;
};
