/* Sharp deck skins and retaining walls from the same CPU-owned platform plan.
 * Wall/ramp margins are blocked by the CPU raster; no second playable surface. */
'use strict';
TerrainModels.platformDeck=(plan:BattlefieldPlatformPlan)=>{
  const out:number[]=[],floor=plan.floor-.13,random=seeded(plan.detailSeed),
    palettes=[[.64,.76,.84],[.73,.75,.77],[.67,.72,.65],[.66,.69,.78]],
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
    const top=p.height-.13,base=p.base-.13,wallScale=(top-base)/6,left=p.x-p.width/2,right=p.x+p.width/2,
      near=p.z-p.depth/2,far=p.z+p.depth/2,corners=platformOutline(p),
      paint=palettes[Math.floor(random()*palettes.length)],
      rim=(v:Position,t:number)=>{
        const distance=Math.hypot(v.x-p.x,v.z-p.z),inset=.5*(1-Math.cos(t*Math.PI/2));
        return [v.x+(p.x-v.x)*inset/distance,top-.5+.5*Math.sin(t*Math.PI/2),
          v.z+(p.z-v.z)*inset/distance];
      },
      footNormals=corners.map((v,i)=>{
        const before=corners[(i+corners.length-1)%corners.length],after=corners[(i+1)%corners.length],
          incoming=Math.hypot(v.x-before.x,v.z-before.z),outgoing=Math.hypot(after.x-v.x,after.z-v.z),
          ax=-(v.z-before.z)/incoming,az=(v.x-before.x)/incoming,
          bx=-(after.z-v.z)/outgoing,bz=(after.x-v.x)/outgoing,
          divisor=1+ax*bx+az*bz;
        return {x:(ax+bx)/divisor,z:(az+bz)/divisor};
      }),
      foot=(i:number,t:number)=>{
        const v=corners[i],n=footNormals[i],outset=.5*(1-Math.cos(t*Math.PI/2));
        return [v.x+n.x*outset,base+.012+.45*(1-Math.sin(t*Math.PI/2)),v.z+n.z*outset];
      };
    for(let side=0;side<corners.length;side++){
      const a=corners[side],b=corners[(side+1)%corners.length],dx=b.x-a.x,dz=b.z-a.z,
        length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length;
      geom.tri(out,[p.x,top,p.z],rim(a,1),rim(b,1),paint);
      for(let band=0;band<3;band++)quad(rim(a,band/3),rim(b,band/3),rim(b,(band+1)/3),rim(a,(band+1)/3),[.56,.65,.72]);
      quad([a.x,top-.5,a.z],[a.x,base,a.z],[b.x,base,b.z],[b.x,top-.5,b.z],[.35,.45,.54]);
      // A continuous coved skirting softens the wall/floor joint, including corners.
      // Its half-metre apron remains inside the conservative blocked edge margin.
      for(let band=0;band<3;band++)quad(foot(side,band/3),foot(side,(band+1)/3),
        foot((side+1)%corners.length,(band+1)/3),foot((side+1)%corners.length,band/3),[.48,.57,.64]);
      const panel=(from:number,to:number,low:number,high:number,color:number[],offset=.02)=>{
        const point=(u:number,y:number)=>[a.x+dx*u/length+nx*offset,y,a.z+dz*u/length+nz*offset];
        quad(point(from,high),point(from,low),point(to,low),point(to,high),color);
      };
      // All hardware stays on retaining walls inside the CPU's blocked edge band.
      if(length>7)for(let u=2;u<length-3;u+=9){
        const end=Math.min(u+6,length-1),vent=random()<.45;
        panel(u,end,base+wallScale,base+4.25*wallScale,[.21,.29,.35]);
        panel(u-.35,u+.25,base+.3*wallScale,top-.65,[.59,.65,.68],.10);
        if(vent){
          for(let y=base+1.5*wallScale;y<base+4*wallScale;y+=.55*wallScale)
            panel(u+.4,end-.4,y,y+.14*wallScale,[.49,.56,.61],.05);
        }else{
          panel(u+.35,end-.35,base+1.35*wallScale,base+3.75*wallScale,[.42,.48,.52],.04);
          panel(u+.6,end-.6,base+2.3*wallScale,base+2.5*wallScale,[.22,.30,.37],.065);
        }
      }
      // Edge-band safety rails, with deliberately wide openings at both ramp mouths.
      if(length>7)for(let u=2;u<length-5;u+=12){
        const x=a.x+dx*(u+2)/length,z=a.z+dz*(u+2)/length;
        if(plan.ramps.some(r=>[0,r.length].some(t=>Math.hypot(x-r.x-r.dx*t,z-r.z-r.dz*t)<r.width/2+18)))continue;
        panel(u,u+4,top+.82,top+.97,[.61,.68,.71],.04);
        panel(u,u+.16,top,top+1.05,[.39,.48,.54],.04);
        panel(u+3.84,u+4,top,top+1.05,[.39,.48,.54],.04);
        // A matching inward face keeps rails visible from either side.
        const point=(v:number,y:number)=>[a.x+dx*v/length-nx*.10,y,a.z+dz*v/length-nz*.10];
        quad(point(u,top+.82),point(u,top+.97),point(u+4,top+.97),point(u+4,top+.82),[.61,.68,.71]);
      }
      if(length>7){
        panel(.5,length-.5,base+.5,base+.7,[.55,.63,.67],.12);
        panel(.5,length-.5,top-1.1,top-.9,[.74,.60,.34],.075);
      }
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
    // Flush service covers: readable deck detail, never a hidden movement obstacle.
    for(let j=0;j<3;j++){
      const x=p.x+(random()-.5)*(p.width-18),z=p.z+(random()-.5)*(p.depth-18);
      if([-4,4].some(dx=>[-4,4].some(dz=>!platformContains(p,x+dx,z+dz)||
        Math.abs(platformBattlefieldHeight(plan,x+dx,z+dz)-p.height)>.01)))continue;
      if(plan.ramps.some(r=>{
        const u=(x-r.x)*r.dx+(z-r.z)*r.dz,v=(x-r.x)*r.dz-(z-r.z)*r.dx;
        return u>=-PLATFORM_LANDING-4&&u<=r.length+PLATFORM_LANDING+4&&Math.abs(v)<r.width/2+8;
      }))continue;
      rectangle(x,z,6,5,top+.023,[.30,.40,.47]);
      rectangle(x,z,5.5,4.5,top+.025,[.56,.61,.63]);
      for(let slot=-1.5;slot<=1.5;slot+=.6)rectangle(x+slot,z,.18,3.5,top+.03,[.27,.35,.41]);
    }
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
/* Presentation-only zoning and maintenance routes; never a navigation replacement. */
TerrainModels.platformFloor=(plan:BattlefieldPlatformPlan)=>{
  const out:number[]=[],random=seeded(plan.detailSeed^0x464c4f52),phase=random()*Math.PI*2,
    floor=plan.floor-.13,extent=plan.extent,
    strip=(a:Position,b:Position,width:number,y:number,color:number[],offset=0)=>{
      const length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.01)return;
      const nx=-(b.z-a.z)/length,nz=(b.x-a.x)/length,
        point=(p:Position,s:number)=>[p.x+nx*(offset+s),y,p.z+nz*(offset+s)];
      geom.tri(out,point(a,-width/2),point(a,width/2),point(b,width/2),color);
      geom.tri(out,point(a,-width/2),point(b,width/2),point(b,-width/2),color);
    },
    rectangle=(x:number,z:number,w:number,d:number,y:number,color:number[])=>
      strip({x:x-w/2,z},{x:x+w/2,z},d,y,color),
    tint=(x:number,z:number)=>{
      const region=.5+.28*Math.sin(x*.026+phase)+.22*Math.cos(z*.031-phase),
        wear=.94+.06*Math.sin(x*.14+z*.09+phase),
        fade=clamp((extent+35-Math.max(Math.abs(x),Math.abs(z)))/35,0,1),
        dark=[.31,.40,.47],light=[.56,.59,.53],base=[.46,.57,.64];
      return base.map((v,i)=>v*(1-fade)+(dark[i]*(1-region)+light[i]*region)*wear*fade);
    };
  // Large graded material zones, fading into the uninterrupted exterior apron.
  for(let z=-extent-40;z<extent+40;z+=10)for(let x=-extent-40;x<extent+40;x+=10){
    for(const [dx,dz] of [[0,0],[0,10],[10,10],[0,0],[10,10],[10,0]])
      out.push(x+dx,floor+.006,z+dz,0,1,0,...tint(x+dx,z+dz));
  }
  // Inset replacement plates on upper decks; existing seams/covers remain above them.
  for(const p of plan.platforms)for(let z=p.z-p.depth/2+5;z<p.z+p.depth/2-4;z+=10)
    for(let x=p.x-p.width/2+5;x<p.x+p.width/2-4;x+=10){
      if([-4,4].some(dx=>[-4,4].some(dz=>!platformContains(p,x+dx,z+dz)||
        Math.abs(platformBattlefieldHeight(plan,x+dx,z+dz)-p.height)>.001)))continue;
      if(random()<.3)continue;
      const c=tint(x,z),shade=.93+random()*.15;
      rectangle(x,z,7.8,7.8,p.height-.13+.008,c.map(v=>v*shade*1.18));
    }
  // A coarse flat-floor graph paints connected, right-angled service aisles to ground ramps.
  // Shared landings stay flat; channels are flush markings, not raised pipes/blockers.
  const step=5,start=-extent+10,size=Math.floor((extent*2-20)/step)+1,
    passable=new Uint8Array(size*size),point=(i:number)=>({x:start+(i%size)*step,z:start+Math.floor(i/size)*step});
  for(let i=0;i<passable.length;i++){
    const p=point(i);
    if(!plan.scenery.some(q=>Math.abs(p.x-q.x)<q.width/2+4.5&&Math.abs(p.z-q.z)<q.depth/2+4.5)&&
      [-4.5,0,4.5].every(dx=>[-4.5,0,4.5].every(dz=>
      Math.abs(platformBattlefieldHeight(plan,p.x+dx,p.z+dz)-plan.floor)<.001)))passable[i]=1;
  }
  const goals:number[]=[];
  for(const r of plan.ramps.filter(r=>r.base===plan.floor)){
    const target={x:r.x-r.dx*7.5,z:r.z-r.dz*7.5};let best=-1,distance=Infinity;
    for(let i=0;i<passable.length;i++)if(passable[i]){
      const p=point(i),d=(p.x-target.x)**2+(p.z-target.z)**2;
      if(d<distance){best=i;distance=d;}
    }
    if(best>=0&&distance<225&&!goals.includes(best))goals.push(best);
  }
  const painted=new Set<string>(),connected=new Set<number>(goals.slice(0,1));
  for(const goal of goals.slice(1)){
    const parent=new Int32Array(passable.length).fill(-1),queue=new Int32Array(passable.length);
    let head=0,tail=0,found=-1;
    for(const i of connected){parent[i]=i;queue[tail++]=i;}
    while(head<tail){
      const i=queue[head++];if(i===goal){found=i;break;}
      const x=i%size,z=Math.floor(i/size);
      for(const j of [x>0?i-1:-1,x<size-1?i+1:-1,z>0?i-size:-1,z<size-1?i+size:-1])
        if(j>=0&&passable[j]&&parent[j]<0){parent[j]=i;queue[tail++]=j;}
    }
    if(found<0)continue;
    for(let i=found;parent[i]!==i;i=parent[i]){
      const j=parent[i],key=Math.min(i,j)+':'+Math.max(i,j);connected.add(i);
      if(painted.has(key))continue;painted.add(key);
      const a=point(i),b=point(j);
      strip(a,b,4.5,floor+.021,[.28,.37,.42]);
      for(const side of [-1,1])strip(a,b,.16,floor+.028,[.73,.61,.36],side*2.05);
      strip(a,b,.75,floor+.022,[.17,.24,.29],3.25);
      strip(a,b,.22,floor+.025,[.49,.56,.59],3.25);
    }
  }
  // Sparse scuffs and embedded access grilles break the clean factory-new finish.
  for(let i=0;i<140;i++){
    const x=(random()*2-1)*(extent-12),z=(random()*2-1)*(extent-12),height=platformBattlefieldHeight(plan,x,z);
    if([-3,3].some(dx=>[-3,3].some(dz=>Math.abs(platformBattlefieldHeight(plan,x+dx,z+dz)-height)>.001)))continue;
    const y=height-.13;
    if(i%5===0){
      rectangle(x,z,3.5,2.5,y+.031,[.23,.32,.38]);
      for(let slot=-1.2;slot<=1.2;slot+=.4)rectangle(x+slot,z,.13,2,y+.033,[.48,.53,.55]);
    }else{
      const length=1+random()*3;
      for(let scratch=0;scratch<3;scratch++)strip({x:x-length/2,z:z+scratch*.18},
        {x:x+length/2,z:z+scratch*.18},.055,y+.032,[.36,.43,.46]);
    }
  }
  return out;
};
TerrainModels.platformSignals=(plan:BattlefieldPlatformPlan)=>{
  const out:number[]=[],random=seeded(plan.detailSeed^0x4c494748);
  for(const p of plan.platforms){
    const outline=platformOutline(p),color=random()<.7?[.25,.66,.82]:[.90,.57,.18];
    for(let i=0;i<outline.length;i++){
      const a=outline[i],b=outline[(i+1)%outline.length],dx=b.x-a.x,dz=b.z-a.z,
        length=Math.hypot(dx,dz);if(length<9)continue;
      const nx=-dz/length,nz=dx/length,y=p.height-1.6;
      for(let u=3;u<length-2;u+=18){
        const point=(t:number,h:number)=>[a.x+dx*t/length+nx*.06,h,a.z+dz*t/length+nz*.06];
        geom.tri(out,point(u,y),point(u,y-.18),point(u+1.5,y-.18),color);
        geom.tri(out,point(u,y),point(u+1.5,y-.18),point(u+1.5,y),color);
      }
    }
  }
  return out;
};
