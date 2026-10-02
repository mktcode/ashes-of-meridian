/* Bounded exterior architecture. Bodies and lights are baked once, never walkable roofs. */
'use strict';
function platformSkylineGeometry(plan:BattlefieldPlatformPlan,lights:boolean):number[]{
  const out:number[]=[],cube=geom.box(),round=geom.cylinder(10),cone=geom.cylinder(8,.2),
    steel=[.32,.42,.49],dark=[.13,.21,.27],trim=[.57,.65,.68],pale=[.68,.73,.74],
    add=(mesh:number[],x:number,y:number,z:number,sx:number,sy:number,sz:number,color:number[],emissive=false)=>{
      if(emissive!==lights)return;
      for(let i=0;i<mesh.length;i+=9){
        const n=V.norm([mesh[i+3]/sx,mesh[i+4]/sy,mesh[i+5]/sz]);
        out.push(x+mesh[i]*sx,y+mesh[i+1]*sy,z+mesh[i+2]*sz,...n,...color);
      }
    },
    box=(x:number,y:number,z:number,w:number,h:number,d:number,color=steel,emissive=false)=>
      add(cube,x,y,z,w,h,d,color,emissive),
    cylinder=(x:number,y:number,z:number,r:number,h:number,color=steel,emissive=false)=>
      add(round,x,y,z,r,h,r,color,emissive);
  for(const p of plan.skyline){
    const {x,z,width:w,depth:d,height:h,style}=p,base=plan.floor-.13,
      signal=style%2?[.83,.56,.24]:[.26,.69,.76],
      windows=(y:number,width:number,depth:number,cx=x,cz=z)=>{
        for(const side of [-1,1]){
          box(cx,y,cz+side*(depth/2+.05),width*.64,.38,.08,signal,true);
          box(cx+side*(width/2+.05),y,cz,.08,.38,depth*.64,signal,true);
        }
      };
    box(x,base+2,z,w,4,d,dark);
    box(x,base+5,z,w*.92,2,d*.92,trim);
    if(style===0){
      // Reinforced docking tower: narrow core, external ribs, stepped crown.
      box(x,base+6+(h-6)/2,z,w*.68,h-6,d*.68);
      for(const side of [-1,1]){
        box(x+side*w*.41,base+h*.44,z,w*.10,h*.84,d*.76,dark);
        box(x,base+h*.44,z+side*d*.41,w*.76,h*.84,d*.10,dark);
        box(x+side*w*.41,base+h*.45,z,w*.025,h*.79,d*.8,trim);
      }
      for(let y=base+12;y<base+h-2;y+=6){
        windows(y,w*.68,d*.68);
        for(const side of [-1,1])box(x,y-1.4,z+side*d*.35,w*.74,.3,.55,dark);
      }
      box(x,base+h+.5,z,w*.78,1,d*.78,trim);
      box(x,base+h+2.2,z,w*.46,2.4,d*.46,dark);
      cylinder(x,base+h+5,z,1.2,5,trim);
      cylinder(x,base+h+7.7,z,.7,.45,signal,true);
    }else if(style===1){
      // Twin reactor stacks: faceted cylinders and luminous service rings.
      const r=Math.min(w,d)*.21;
      for(const side of [-1,1]){
        const cx=x+side*w*.24;
        cylinder(cx,base+h*.45,z,r,h*.80);
        cylinder(cx,base+h*.8775,z,r*1.04,h*.055,trim);
        cylinder(cx,base+h*.9475,z,r*.76,h*.085,dark);
        cylinder(cx,base+h*.99+2.5,z,r*.30,5,trim);
        cylinder(cx,base+h*.99+5.15,z,r*.32,.3,signal,true);
        for(let y=base+12;y<base+h*.85;y+=9)cylinder(cx,y,z,r+.035,.22,signal,true);
      }
      box(x,base+h*.54,z,w*.80,1.5,d*.22,dark);
      box(x,base+h*.55,z,w*.76,.25,d*.24,trim);
    }else if(style===2){
      // Communication spire: open side piers, elevated control pod and antenna cluster.
      box(x,base+8+(h-8)/2,z,w*.36,h-8,d*.38,dark);
      for(const side of [-1,1]){
        box(x+side*w*.33,base+h*.44,z,w*.12,h*.84,d*.56);
        box(x+side*w*.33,base+h*.44,z+side*d*.28,w*.04,h*.82,.4,trim);
      }
      box(x,base+h*.64,z,w*.82,3.4,d*.65,trim);
      box(x,base+h,z,w*.72,5,d*.62);
      windows(base+h+.25,w*.72,d*.62);
      for(const side of [-1,1]){
        cylinder(x+side*w*.19,base+h+6,z,.32,9,trim);
        cylinder(x+side*w*.19,base+h+10.6,z,.55,.3,signal,true);
      }
      add(cone,x,base+h+5,z,w*.14,5,d*.14,pale);
      box(x,base+h*.63,z+d*.34,w*.60,.38,.08,signal,true);
    }else{
      // Terraced service block: broad lower hall and offset upper accommodation floors.
      box(x,base+h*.20,z,w*.88,h*.32,d*.84);
      box(x+w*.10,base+h*.52,z,w*.67,h*.34,d*.64,pale);
      box(x-w*.07,base+h*.83,z-d*.06,w*.48,h*.29,d*.46);
      for(let y=base+9;y<base+h*.34;y+=5)windows(y,w*.88,d*.84);
      for(let y=base+h*.38;y<base+h*.68;y+=5)windows(y,w*.67,d*.64,x+w*.10,z);
      for(let y=base+h*.72;y<base+h*.95;y+=5)windows(y,w*.48,d*.46,x-w*.07,z-d*.06);
      box(x-w*.07,base+h*.975+.3,z-d*.06,w*.55,.6,d*.54,trim);
      for(const side of [-1,1]){
        box(x+side*w*.30,base+h*.37,z+d*.18,w*.16,3.5,d*.30,dark);
        for(let slot=-1;slot<=1;slot++)box(x+side*w*.30,base+h*.37+1.8,z+d*(.18+slot*.075),w*.14,.15,.3,trim);
      }
    }
    // Low annexes, wall buttresses and roof service boxes unify the silhouettes.
    for(const side of [-1,1]){
      box(x+side*w*.36,base+4,z+d*.28,w*.20,6,d*.28,dark);
      box(x+side*w*.36,base+7.15,z+d*.28,w*.21,.3,d*.29,trim);
    }
  }
  return out;
}
TerrainModels.platformSkyline=(plan:BattlefieldPlatformPlan)=>platformSkylineGeometry(plan,false);
TerrainModels.platformSkylineLights=(plan:BattlefieldPlatformPlan)=>platformSkylineGeometry(plan,true);
