/* Reusable upland families: opaque leaf polygons, branch skeletons and layered
 * stone. Unit envelopes let CPU scenery rules conservatively reserve footprints.
 * Baked only at world sync; no image assets, alpha overdraw or per-frame growth. */
'use strict';
(() => {
  const rod=(out:number[],a:number[],b:number[],radius:number,tint:number[])=>{
    const axis=V.norm(V.sub(b,a)),side=V.norm(V.cross(axis,Math.abs(axis[1])>.9?[1,0,0]:[0,1,0])),
      up=V.cross(axis,side),point=(p:number[],angle:number,r:number)=>p.map((v,k)=>v+r*(side[k]*Math.cos(angle)+up[k]*Math.sin(angle)));
    for(let i=0;i<7;i++) {
      const u=i*Math.PI*2/7,v=(i+1)*Math.PI*2/7,
        p=point(a,u,radius),q=point(a,v,radius),r=point(b,u,radius*.28),s=point(b,v,radius*.28);
      geom.tri(out,p,q,s,tint);geom.tri(out,p,s,r,tint);
    }
  };
  // Same seed and branch descriptors for bark and crown; no duplicated placement logic.
  const branches=(seed:number)=>{
    const random=seeded(seed),out:{base:number[];tip:number[];shade:number}[]=[];
    for(let i=0;i<12;i++) {
      const t=i/12,angle=i*2.39996+random()*.4,radius=(.30+.25*Math.sin(Math.PI*t))*(.85+random()*.15),y=.48+t*.34;
      out.push({base:[t*.09,y-.18,0],tip:[Math.cos(angle)*radius+t*.09,y,Math.sin(angle)*radius],shade:random()});
    }
    out.push({base:[.08,.72,0],tip:[.1,.87,0],shade:.7});return out;
  };
  TerrainModels.uplandTrunk=(seed:number)=>{
    const out:number[]=[];
    rod(out,[0,0,0],[.10,.96,0],.055,[.75,.69,.52]);
    for(const b of branches(seed))rod(out,b.base,b.tip,.022,[.66,.61,.46]);
    return out;
  };
  TerrainModels.uplandCrown=(seed:number)=>{
    const out:number[]=[],random=seeded(seed^0x4c454146);
    for(const b of branches(seed))for(let leaf=0;leaf<34;leaf++) {
      const angle=random()*Math.PI*2,v=random()*2-1,ring=Math.sqrt(1-v*v),
        p=[b.tip[0]+Math.cos(angle)*ring*.24,b.tip[1]+v*.12,b.tip[2]+Math.sin(angle)*ring*.24],
        yaw=random()*Math.PI*2,tilt=(random()-.5)*1.4,w=.045+random()*.035,l=w*1.7,
        side=[Math.cos(yaw),0,Math.sin(yaw)],forward=[-Math.sin(yaw)*Math.cos(tilt),Math.sin(tilt),Math.cos(yaw)*Math.cos(tilt)],
        point=(x:number,z:number)=>p.map((v,k)=>v+side[k]*x+forward[k]*z),
        color=b.shade>.74?[.64,.60,.25]:[.26+b.shade*.12,.40+b.shade*.16,.17+b.shade*.06],
        points=[[0,-l],[-w,-l*.35],[-w*.8,l*.4],[0,l],[w*.8,l*.4],[w,-l*.35]].map(([x,z])=>point(x,z));
      // A folded six-sided leaf retains highlights without transparent rectangular cards.
      const ridge=p.map((v,k)=>v+(k===1?.008:0));
      for(let i=0;i<6;i++)geom.tri(out,ridge,points[i],points[(i+1)%6],color);
    }
    return out;
  };
  TerrainModels.uplandStone=(seed:number)=>{
    const out:number[]=[],random=seeded(seed^0x53544f4e),count=7,
      contour=Array.from({length:count},()=>.62+random()*.29),
      layers=[[0,.98],[.18,1],[.24,.78],[.57,.86],[.65,.58],[.94,.63],[1,.24]],
      rings=layers.map(([y,r],j)=>contour.map((c,i)=>{
        const angle=i*Math.PI*2/count,offset=Math.sin(j*.7)*.08;
        return [Math.cos(angle)*c*r+offset,y+(j===0?0:Math.sin(i*2.1+seed+j*.8)*.09),Math.sin(angle)*c*r];
      }));
    for(let j=1;j<rings.length;j++)for(let i=0;i<count;i++) {
      const next=(i+1)%count,tint=j%2?[.85,.86,.80]:[.68,.71,.63];
      geom.tri(out,rings[j-1][i],rings[j][next],rings[j-1][next],tint);
      geom.tri(out,rings[j-1][i],rings[j][i],rings[j][next],tint);
    }
    for(let i=0;i<count;i++)geom.tri(out,[.02,1.10,0],rings.at(-1)![(i+1)%count],rings.at(-1)![i],[.92,.91,.81]);
    return out;
  };
  TerrainModels.uplandGrass=(seed:number)=>{
    const out:number[]=[],random=seeded(seed^0x47524153);
    for(let tuft=0;tuft<7;tuft++) {
      const angle=random()*Math.PI*2,r=random()*.75,x=Math.cos(angle)*r,z=Math.sin(angle)*r;
      for(let blade=0;blade<5;blade++) {
        const a=random()*Math.PI*2,h=.35+random()*.65,dx=Math.cos(a),dz=Math.sin(a),
          base=[x-dz*.025,0,z+dx*.025],other=[x+dz*.025,0,z-dx*.025],bend=[x+dx*.12,h*.55,z+dz*.12],
          tip=[x+dx*.24,h,z+dz*.24],color=[.39+random()*.12,.46+random()*.1,.20];
        geom.tri(out,base,other,bend,color);geom.tri(out,base,bend,tip,color);
      }
      if(tuft%3===0) {
        const y=.68+random()*.2;
        rod(out,[x,0,z],[x,y,z],.008,[.34,.40,.19]);
        for(let petal=0;petal<5;petal++) {
          const a=petal*Math.PI*2/5,dx=Math.cos(a)*.09,dz=Math.sin(a)*.09;
          geom.tri(out,[x,y,z],[x+dx-dz*.45,y+.02,z+dz+dx*.45],[x+dx+dz*.45,y+.035,z+dz-dx*.45],[.77,.72,.50]);
        }
      }
    }
    return out;
  };
})();
