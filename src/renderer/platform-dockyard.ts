/* Connected orbital dock architecture: baked inert scenery, not simulation buildings/weapons. */
'use strict';
function platformDockKit(lights:boolean){
  const out:number[]=[],cube=geom.box(),round=geom.cylinder(12),cone=geom.cylinder(8,.25),
    steel=[.35,.44,.50],dark=[.10,.16,.21],trim=[.61,.66,.68],warm=[.91,.57,.22],cool=[.25,.76,.94],red=[.86,.18,.12];
  let origin=[0,0,0],yaw=0,scale=1;
  const rotate=(p:number[],a=0,pitch=0,roll=0)=>{
    const cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll),ca=Math.cos(a),sa=Math.sin(a),
      y=p[1]*cp-p[2]*sp,z=p[1]*sp+p[2]*cp,x=p[0]*cr-y*sr,v=p[0]*sr+y*cr;
    return [x*ca+z*sa,v,-x*sa+z*ca];
  },point=(p:number[])=>{
    const q=rotate(p,yaw);return q.map((v,i)=>origin[i]+v*scale);
  },tri=(a:number[],b:number[],c:number[],color=steel,emissive=false)=>{
    if(emissive!==lights)return;geom.tri(out,point(a),point(b),point(c),color);
  },quad=(a:number[],b:number[],c:number[],d:number[],color=steel,emissive=false)=>{
    tri(a,b,c,color,emissive);tri(a,c,d,color,emissive);
  },mesh=(data:number[],x:number,y:number,z:number,sx:number,sy:number,sz:number,color=steel,emissive=false,a=0,pitch=0,roll=0)=>{
    if(emissive!==lights)return;
    for(let i=0;i<data.length;i+=9){
      const p=rotate([data[i]*sx,data[i+1]*sy,data[i+2]*sz],a,pitch,roll),
        n=V.norm(rotate(rotate([data[i+3]/sx,data[i+4]/sy,data[i+5]/sz],a,pitch,roll),yaw));
      out.push(...point([p[0]+x,p[1]+y,p[2]+z]),...n,...color);
    }
  },box=(x:number,y:number,z:number,w:number,h:number,d:number,color=steel,emissive=false,a=0,pitch=0,roll=0)=>
    mesh(cube,x,y,z,w,h,d,color,emissive,a,pitch,roll),
    cylinder=(x:number,y:number,z:number,r:number,h:number,color=steel,emissive=false,a=0,pitch=0)=>
      mesh(round,x,y,z,r,h,r,color,emissive,a,pitch),
    beam=(a:number[],b:number[],r:number,color=trim)=>{
      const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz);
      if(length<.001)return;
      cylinder((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,r,length,color,false,Math.atan2(dx,dz),Math.acos(dy/length));
    },extrude=(shape:number[][],bottom:number,height:number,color=steel,topScale=1)=>{
      if(lights)return;
      const area=shape.reduce((sum,p,i)=>{const q=shape[(i+1)%shape.length];return sum+p[0]*q[1]-q[0]*p[1];},0),
        polygon=area<0?[...shape].reverse():shape,center=polygon.reduce((a,p)=>[a[0]+p[0]/polygon.length,a[1]+p[1]/polygon.length],[0,0]),
        lo=polygon.map(p=>[p[0],bottom,p[1]]),hi=polygon.map(p=>[center[0]+(p[0]-center[0])*topScale,bottom+height,center[1]+(p[1]-center[1])*topScale]);
      for(let i=0;i<polygon.length;i++){
        const j=(i+1)%polygon.length;
        quad(lo[i],hi[i],hi[j],lo[j],color);
        tri([center[0],bottom+height,center[1]],hi[j],hi[i],color);
        tri([center[0],bottom,center[1]],lo[i],lo[j],color);
      }
    },panel=(x:number,y:number,z:number,w:number,h:number,d:number,color=steel,bevel=1,topScale=.94)=>{
      const e=Math.min(bevel,w*.2,d*.2),a=w/2,b=d/2;
      extrude([[-a+e,-b],[a-e,-b],[a,-b+e],[a,b-e],[a-e,b],[-a+e,b],[-a,b-e],[-a,-b+e]].map(p=>[p[0]+x,p[1]+z]),y-h/2,h,color,topScale);
    },pose=(x:number,y:number,z:number,a=0,s=1)=>{origin=[x,y,z];yaw=a;scale=s;},
    at=(x:number,y:number,z:number,a:number,s:number,draw:()=>void)=>{
      const old=origin,oldYaw=yaw,oldScale=scale;origin=point([x,y,z]);yaw+=a;scale*=s;
      draw();origin=old;yaw=oldYaw;scale=oldScale;
    };
  return {out,steel,dark,trim,warm,cool,red,box,cylinder,beam,quad,tri,extrude,panel,mesh,cone,pose,at};
}
type PlatformDockKit=ReturnType<typeof platformDockKit>;
function platformParkedFighter(k:PlatformDockKit){
  const {box,cylinder,panel,extrude,steel,dark,trim,cool}=k;
  for(const side of [-1,1]){
    box(side*2,.4,-3,.25,.8,2,dark);box(side*2,.08,-3,2,.16,3,trim);
    extrude([[side*1.6,-3],[side*7.5,-6],[side*6,2],[side*1.6,4]],1.1,.65,steel,.9);
    cylinder(side*2.15,1.8,-5.8,.9,4,dark,false,0,Math.PI/2);
    cylinder(side*2.15,1.8,-7.85,.62,.09,cool,true,0,Math.PI/2);
    panel(side*2.15,3.1,-4.5,.5,2.7,3.8,trim,.2,.45);
    box(side*5.4,1.82,-.7,.38,.08,4,cool,true);
  }
  box(0,.36,4,.22,.7,1.8,dark);box(0,.07,4,1.3,.14,2.4,trim);
  extrude([[-1.8,-6],[1.8,-6],[2.3,-2],[1.8,4],[0,9],[-1.8,4],[-2.3,-2]],.8,1.9,[.85,.89,.91],.8);
  panel(0,3.05,.6,2.7,1.1,4,dark,.6,.58);
  box(0,3.63,1.2,1.3,.05,2.6,cool,true);
  box(0,2.81,5.5,.34,.12,2.8,dark);
}
function platformDockGun(k:PlatformDockKit){
  const {box,cylinder,panel,steel,dark,trim,warm}=k;
  panel(0,1,0,9,2,8,dark,1.4,.86);cylinder(0,2.2,0,3.1,1.1,trim);
  panel(0,4,0,6.8,3.5,5.7,steel,.8,.78);
  for(const side of [-1,1]){
    panel(side*3.3,3.8,.1,1.3,3.4,5.5,dark,.4,.92);
    cylinder(side*1.3,4.6,4.3,.40,10,trim,false,0,Math.PI/2-.13);
    cylinder(side*1.3,4.9,8.8,.63,1.2,dark,false,0,Math.PI/2-.13);
    cylinder(side*1.3,4.5,.8,.78,3.7,steel,false,0,Math.PI/2-.13);
    box(side*2.2,3.3,2.98,.85,.28,.07,warm,true);
  }
  box(0,5.83,-1.3,3.5,.12,1.2,dark);box(0,2.83,4.1,5.8,.18,.08,trim);
}
function platformSatelliteDish(k:PlatformDockKit){
  const {box,cylinder,panel,beam,quad,tri,steel,dark,trim,cool,red}=k;
  panel(0,.7,0,7,1.4,7,dark,1,.9);cylinder(0,3.8,0,1,6,steel);
  box(0,6.3,0,3.6,1.1,3.2,trim);
  const radius=5.8,angle=-.55,bowl=(r:number,t:number,back=0)=>{
    const x=r*Math.cos(t),y=r*Math.sin(t),z=r*r/(radius*radius)*2.1+back;
    return [x,9+y*Math.cos(angle)-z*Math.sin(angle),y*Math.sin(angle)+z*Math.cos(angle)];
  };
  for(let ring=0;ring<3;ring++)for(let i=0;i<16;i++){
    const r=radius*ring/3,R=radius*(ring+1)/3,t=i/16*Math.PI*2,T=(i+1)/16*Math.PI*2,
      color=i%4===0?trim:steel;
    if(ring===0){tri(bowl(0,0),bowl(R,t),bowl(R,T),color);tri(bowl(0,0,-.18),bowl(R,T,-.18),bowl(R,t,-.18),dark);}
    else{quad(bowl(r,t),bowl(R,t),bowl(R,T),bowl(r,T),color);quad(bowl(r,t,-.18),bowl(r,T,-.18),bowl(R,T,-.18),bowl(R,t,-.18),dark);}
    if(ring===2)quad(bowl(R,t),bowl(R,t,-.18),bowl(R,T,-.18),bowl(R,T),trim);
  }
  const feed=[0,9-6*Math.sin(angle),6*Math.cos(angle)];
  for(let i=0;i<3;i++)beam(bowl(radius,i/3*Math.PI*2),feed,.14,trim);
  cylinder(feed[0],feed[1],feed[2],.42,.7,dark);
  box(0,1.45,3.55,3.4,.23,.07,cool,true);cylinder(0,feed[1]+.45,feed[2],.18,.15,red,true);
}
function platformDockCrane(k:PlatformDockKit){
  const {box,cylinder,panel,beam,dark,trim,steel,warm,red}=k;
  panel(0,1,0,10,2,10,dark,2);cylinder(0,2.5,0,3.5,1.4,trim);
  box(-1,17,0,4,28,4.4,steel);
  for(let y=5;y<30;y+=6){
    beam([-3,y,2.25],[1,y+5,2.25],.25,trim);beam([1,y,2.25],[-3,y+5,2.25],.25,trim);
    box(-1,y,-2.3,4.2,.3,.3,dark);
  }
  box(14,30,0,34,2.1,3.5,trim);box(-7,29.5,0,10,4.8,5.7,dark);
  beam([-1,33,0],[30,30,0],.22,trim);box(28,28.8,0,4,1,4,warm);
  for(const side of [-1,1])cylinder(28,20,side*.8,.055,17,dark);
  box(28,11.1,0,3,.65,2,warm);cylinder(-1,33.3,0,.32,.3,red,true);
  box(-1,21.5,3.1,4,3,2.4,dark);box(-1,22.1,4.32,2.8,.45,.08,k.cool,true);
}
function platformDockyardGeometry(plan:BattlefieldPlatformPlan,lights:boolean):number[]{
  const k=platformDockKit(lights),{box,panel,cylinder,steel,dark,trim,warm,cool,red}=k,
    base=plan.floor-.13,outer=plan.extent+140,inner=plan.extent+24,span=outer-inner,
    yaw=[-Math.PI/2,Math.PI,Math.PI/2,0];
  // Continuous thick carrier rim, joined to the inner apron. Its cliff is not the play boundary.
  for(let side=0;side<4;side++){
    const sign=side<2?1:-1,center=(outer+inner)/2;
    k.pose(side%2?0:sign*center,base,side%2?sign*center:0,yaw[side]);
    panel(0,-9,0,outer*2+2,18,span,steel,4,1);
    for(let x=-outer+12;x<outer-8;x+=18){
      box(x,-8,-span/2-.1,1.8,17,1.4,dark);
      box(x,-6,-span/2-.85,8,.45,.12,warm,true);
    }
  }
  for(const p of plan.dockyard){
    const {width:w,depth:d,height:h}=p;k.pose(p.x,base,p.z,p.yaw);
    panel(0,3,0,w+2,6,d,steel,3,.96);
    // Armored front bulkhead: ribs, inset maintenance doors and amber running lights.
    for(let x=-w/2+4;x<w/2-2;x+=9){
      panel(x,2,d*.49,1.3,4.9,1.5,dark,.2,.85);
      box(x+3,2.3,d*.497,3.5,1.7,.08,dark);
      box(x+3,3.25,d*.5,2.8,.50,.09,warm,true);
    }
    if(p.kind==='hangar'){
      // A real open mouth, not a dark rectangle on a solid box. Two fighters sit inside.
      for(const side of [-1,1]){
        panel(side*w*.42,6+(h-4)/2,0,w*.14,h-4,d*.96,steel,2,.85);
        box(side*w*.337,6+(h-4)/2,d*.465,.85,h-4,.18,cool,true);
      }
      panel(0,6+(h-4)/2,-d*.42,w*.74,h-4,d*.15,dark,1.2,.96);
      panel(0,6+h,0,w*.99,8,d*1.01,steel,3.5,.86);
      box(0,6+h-4.25,d*.36,w*.66,.15,1.1,cool,true);
      box(0,6.1,d*.13,w*.67,.2,d*.67,dark);
      // Rear galleries, overhead girders and luminous work panels give the bay depth and scale.
      box(0,6+h*.50,-d*.28,w*.68,.65,4,trim);
      box(0,6+h*.50+1.1,-d*.245,w*.68,.18,.18,warm);
      for(let x=-w*.30;x<w*.31;x+=w*.12){
        box(x,6+h*.50+.6,-d*.245,.18,1.2,.18,trim);
        box(x,6+h*.27,-d*.338,w*.025,h*.25,.13,cool,true);
        panel(x,7.3,-d*.24,4,2.6,3.5,steel,.4,.9);
      }
      for(const side of [-1,1]){
        box(side*w*.19,6+h-4.9,0,1.2,1.2,d*.80,trim);
        k.at(side*w*.20,6.22,d*.05,0,1.2,()=>platformParkedFighter(k));
        box(side*w*.28,6.25,d*.14,.20,.04,d*.64,warm,true);
        panel(side*w*.40,6+h+4.7,-d*.24,8,1.5,12,dark,1);
        for(let slot=-2;slot<=2;slot++)box(side*w*.40,6+h+5.52,-d*.24+slot*1.8,6,.14,.5,trim);
      }
      box(0,6+h+.1,d*.509,w*.51,1.4,.1,dark);box(0,6+h+.1,d*.511,w*.38,.28,.12,cool,true);
    }else{
      // Tiered, sloping fortress massing rather than another solitary tower.
      panel(0,6+h*.37,-d*.03,w*.91,h*.74,d*.88,steel,4,.79);
      panel(0,6+h*.80,-d*.08,w*.74,h*.13,d*.69,trim,3,.88);
      panel(-w*.14,6+h*.98,-d*.17,w*.40,h*.24,d*.39,steel,2,.85);
      const window=(x:number,y:number,width:number,height:number,color:number[],emissive=false)=>{
        const face=(u:number,v:number)=>[u,v,-d*.03+d*.44*(1-.21*(v-6)/(h*.74))+.04];
        k.quad(face(x-width/2,y-height/2),face(x+width/2,y-height/2),
          face(x+width/2,y+height/2),face(x-width/2,y+height/2),color,emissive);
      };
      for(let x=-w*.34;x<w*.34;x+=12){
        window(x,6+h*.43,5.5,2.2,dark);
        window(x,6+h*.43+.6,4.2,.55,warm,true);
        window(x,6+h*.17,7,1.5,dark);
      }
      if(p.kind==='battery'){
        panel(0,6+h*.95,0,w*.83,h*.30,d*.56,dark,2,.92);
        for(const side of [-1,1])k.at(side*w*.25,6+h*1.10,d*.02,0,1.2,()=>platformDockGun(k));
      }else if(p.kind==='sensor')k.at(-w*.14,6+h*1.10,-d*.17,0,1.65,()=>platformSatelliteDish(k));
      else if(p.kind==='gantry')k.at(-w*.25,6+h*.40,-d*.04,0,1,()=>platformDockCrane(k));
      else{
        for(const side of [-1,1]){
          cylinder(side*w*.26,6+h*.95,-d*.10,3.1,7,dark);
          cylinder(side*w*.26,6+h*.95+3.7,-d*.10,3.3,.4,trim);
        }
      }
    }
    // Small freight compounds, cable trunks and warning beacons tie each module to its neighbors.
    for(const side of [-1,1]){
      panel(side*w*.43,7.2,d*.27,7,2.4,8,dark,1,.92);
      box(side*w*.43,8.5,d*.27,6,.15,7,trim);
      cylinder(side*w*.45,6+h+5,-d*.30,.22,7,trim);
      cylinder(side*w*.45,6+h+8.6,-d*.30,.30,.28,red,true);
      for(let pipe=0;pipe<3;pipe++)cylinder(side*w*.39,7+pipe*.65,-d*.34,.28,d*.25,trim,false,0,Math.PI/2);
    }
  }
  return k.out;
}
function platformRailGun(k:PlatformDockKit){
  const {box,cylinder,panel,steel,dark,trim,warm}=k;
  panel(0,.50,0,2.2,1,2.2,dark,.25,.90);
  cylinder(0,1.18,0,.85,.40,trim);
  panel(0,2.40,-.25,2.15,2.0,3.6,steel,.35,.78);
  for(const side of [-1,1]){
    box(side*.92,2.45,-.25,.26,1.8,3.7,dark);
    cylinder(side*.57,3.15,2.70,.14,8,trim,false,0,Math.PI/2-.05);
    cylinder(side*.57,3.33,6.90,.23,.6,dark,false,0,Math.PI/2-.05);
    cylinder(side*.57,3.10,-.1,.29,2.0,steel,false,0,Math.PI/2-.05);
  }
  box(0,2.55,1.575,1.15,.25,.06,warm,true);
  box(0,3.48,-.6,1.35,.12,1.1,dark);
}
function platformHardwareGeometry(plan:BattlefieldPlatformPlan,lights:boolean):number[]{
  const k=platformDockKit(lights),{box,cylinder,panel,steel,dark,trim,warm,cool}=k;
  for(const p of plan.greebles){
    const s=p.width;k.pose(p.x,p.height-.13+.015,p.z,p.yaw);
    if(p.kind===4){platformRailGun(k);continue;}
    panel(0,.055,0,s*.85,.11,s*.85,dark,.18,1);
    if(p.kind===0){
      for(const side of [-1,1]){
        panel(side*s*.23,.74,0,s*.36,1.38,s*.68,steel,.12,.96);
        box(side*s*.23,1.48,0,s*.38,.10,s*.70,trim);
        for(const z of [-.23,.23])box(side*s*.23,.77,z*s,s*.39,1.18,.07,dark);
      }
      box(0,.37,s*.35,s*.45,.13,.04,warm,true);
    }else if(p.kind===1){
      k.at(0,0,0,0,.17,()=>platformSatelliteDish(k));
    }else if(p.kind===2){
      for(const side of [-1,1]){
        cylinder(side*s*.22,.65,0,s*.17,1.1,steel);
        cylinder(side*s*.22,1.24,0,s*.18,.12,trim);
        cylinder(side*s*.22,.77,s*.20,.12,s*.52,trim,false,0,Math.PI/2);
      }
      panel(0,.33,-s*.24,s*.68,.50,s*.23,dark,.1,.9);
      box(0,.5,s*.35,s*.37,.14,.04,cool,true);
    }else{
      panel(0,.64,0,s*.55,1.15,s*.52,steel,.16,.76);
      box(0,.98,s*.245,s*.33,.26,.05,dark);
      box(0,1.02,s*.275,s*.24,.12,.03,cool,true);
      cylinder(-s*.18,1.57,-s*.15,.035,1.1,trim);
      cylinder(-s*.18,2.15,-s*.15,.065,.12,warm,true);
    }
  }
  return k.out;
}
TerrainModels.platformDockyard=(plan:BattlefieldPlatformPlan)=>platformDockyardGeometry(plan,false);
TerrainModels.platformDockyardLights=(plan:BattlefieldPlatformPlan)=>platformDockyardGeometry(plan,true);
TerrainModels.platformHardware=(plan:BattlefieldPlatformPlan)=>platformHardwareGeometry(plan,false);
TerrainModels.platformHardwareLights=(plan:BattlefieldPlatformPlan)=>platformHardwareGeometry(plan,true);
