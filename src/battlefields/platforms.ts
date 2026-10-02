/* Engineered topology is planned explicitly, never quantized from landscape noise. */
'use strict';
interface BattlefieldPlatform { x: number; z: number; width: number; depth: number; height: number; base: number }
interface BattlefieldRamp { x: number; z: number; dx: number; dz: number; length: number; width: number; rise: number; base: number }
interface BattlefieldPlatformPlan {
  extent: number; floor: number; platforms: BattlefieldPlatform[]; ramps: BattlefieldRamp[];
}
function platformBattlefieldPlan(seed: number, extent: number): BattlefieldPlatformPlan {
  const random=seeded(seed^0x504c4154),snap=(v:number)=>Math.round(v/2.5)*2.5,
    platforms: BattlefieldPlatform[]=[],ramps: BattlefieldRamp[]=[],floor=12,
    rooms=[{x:0,z:0,width:(extent-42.5)*2,depth:(extent-42.5)*2}],
    target=3+Math.floor(random()*5),gap=42.5;
  // Seeded spatial partition, not player slots: staggered halls and courts.
  while(rooms.length<target){
    const options=rooms.flatMap((r,i)=>[true,false].filter(x=>(x?r.width:r.depth)>=152.5).map(x=>({i,x})));
    if(!options.length)break;
    const {i,x}=options[Math.floor(random()*options.length)],r=rooms.splice(i,1)[0],
      length=x?r.width:r.depth,first=snap(55+random()*(length-gap-110)),second=length-gap-first;
    if(x)rooms.push({...r,x:r.x-(length-first)/2,width:first},{...r,x:r.x+(length-second)/2,width:second});
    else rooms.push({...r,z:r.z-(length-first)/2,depth:first},{...r,z:r.z+(length-second)/2,depth:second});
  }
  const plan={extent,floor,platforms,ramps},supports: BattlefieldPlatform[]=[];
  for(const room of rooms){
    const p={...room,height:24,base:floor};
    if(random()<.7&&room.width>=75){
      const sx=random()<.5?-1:1,sz=random()<.5?-1:1,cw=snap(15+random()*10),cd=snap(15+random()*15),
        main={...p,x:p.x-sx*cw/2,width:p.width-cw},
        wing={...p,x:p.x+sx*(p.width-cw)/2,z:p.z-sz*cd/2,width:cw,depth:p.depth-cd};
      platforms.push(main,wing);supports.push(main);
    }else{platforms.push(p);supports.push(p);}
  }
  // High decks are always seated on a middle deck, accessed from that deck only.
  let highDecks=0;
  for(const p of supports){
    if(Math.min(p.width,p.depth)<50||Math.max(p.width,p.depth)<75)continue;
    if(highDecks&&random()<.35)continue;
    const alongX=p.width>p.depth,sign=random()<.5?-1:1,
      long=alongX?p.width:p.depth,short=alongX?p.depth:p.width,
      size=snap(Math.min(55,long-50,short-20)),
      across=snap((random()-.5)*Math.max(0,short-size-20)),
      along=sign*(long/2-size/2-7.5),
      x=p.x+(alongX?along:across),z=p.z+(alongX?across:along),dx=alongX?sign:0,dz=alongX?0:sign,
      upper={x,z,width:size,depth:size,height:36,base:24},length=32.5;
    platforms.push(upper);highDecks++;
    ramps.push({x:x-dx*(size/2+length),z:z-dz*(size/2+length),dx,dz,length,width:25,rise:12,base:24});
  }
  if(!highDecks)throw Error('Platform partition lacks a supported high deck');
  const bounds=(r:BattlefieldRamp)=>({x:r.x+r.dx*r.length/2,z:r.z+r.dz*r.length/2,
    width:r.dx?r.length+6:r.width+6,depth:r.dz?r.length+6:r.width+6});
  for(const room of rooms){
    const candidates:BattlefieldRamp[]=[];
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])for(const offset of [-.25,0,.25]){
      const x=room.x-dx*room.width/2+(dz?offset*room.width:0),
        z=room.z-dz*room.depth/2+(dx?offset*room.depth:0),length=32.5;
      candidates.push({x:x-dx*length,z:z-dz*length,dx,dz,length,width:25,rise:12,base:floor});
    }
    for(let i=candidates.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
    let added=0;const wanted=random()<.65?2:1;
    for(const r of candidates){
      const b=bounds(r);
      if(ramps.some(q=>{const a=bounds(q);return Math.abs(a.x-b.x)<(a.width+b.width)/2&&Math.abs(a.z-b.z)<(a.depth+b.depth)/2;}))continue;
      let valid=true;
      for(const u of [-5,0,16,30,35.5,42.5])for(const v of [-15,0,15]){
        const h=platformBattlefieldHeight(plan,r.x+r.dx*u-r.dz*v,r.z+r.dz*u+r.dx*v);
        if(Math.abs(h-(u>32.5?24:floor))>.001)valid=false;
      }
      if(!valid)continue;
      ramps.push(r);if(++added===wanted)break;
    }
    if(!added)throw Error('Platform room has no clear ground ramp');
  }
  return plan;
}
function platformBattlefieldHeight(plan: BattlefieldPlatformPlan,x:number,z:number):number {
  let height=plan.floor;
  for(const p of plan.platforms)
    if(Math.abs(x-p.x)<=p.width/2&&Math.abs(z-p.z)<=p.depth/2)height=Math.max(height,p.height);
  for(const r of plan.ramps){
    const dx=x-r.x,dz=z-r.z,u=dx*r.dx+dz*r.dz,v=dx*r.dz-dz*r.dx;
    if(u>=0&&u<=r.length&&Math.abs(v)<=r.width/2)height=Math.max(height,r.base+r.rise*u/r.length);
  }
  return height;
}
function platformResourceSites(plan:BattlefieldPlatformPlan,seed:number):Position[]{
  const random=seeded(seed^0x5045434f),candidates:Position[]=plan.platforms.filter(p=>p.height===36).map(p=>({x:p.x-2.5,z:p.z-2.5})),sites:Position[]=[];
  for(let z=-plan.extent+30;z<=plan.extent-30;z+=20)for(let x=-plan.extent+30;x<=plan.extent-30;x+=20)candidates.push({x,z});
  for(let i=candidates.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  for(const p of candidates){
    const h=platformBattlefieldHeight(plan,p.x,p.z);
    if(sites.some(q=>distance(p,q)<45))continue;
    if([-12,0,12].some(dx=>[-12,0,12].some(dz=>Math.abs(platformBattlefieldHeight(plan,p.x+dx,p.z+dz)-h)>.001)))continue;
    sites.push(p);if(sites.length===9)break;
  }
  if(sites.length<6)throw Error('Platform plan lacks economic space');
  return sites;
}
// Closed technical profile: no habitat, soil/rock textures, vegetation or outdoor weather.
function createPlatformBattlefield(): BattlefieldDefinition {
  return {
    name:'ORBITAL PLATFORM',size:{extent:160,cellSize:2.5},
    createSize:seed=>({extent:[160,180,200][Math.floor(seeded(seed^0x5053495a)()*3)],cellSize:2.5}),
    design:{atmosphere:{timeOfDay:'seeded'}},
    palette:{ground:0x637b89,rock:0x637b89,accent:0xffc56b,flora:0x637b89},worldEvent:null,
    render:{groundTexture:'metal',skyTexture:'sky',daylight:true,terrainReceiverHeight:48,
      rockDecor:{density:0,opacity:0},shrubDecor:{density:0,opacity:0},haze:[.035,.06,.09]},
    createLayout(seed,size){
      const plan=platformBattlefieldPlan(seed,size.extent),resourceSites=platformResourceSites(plan,seed);
      return {startSites:[],resourceSites,corridors:plan.ramps.map(r=>[
        [r.x,r.z],[r.x+r.dx*r.length,r.z+r.dz*r.length]])};
    },
    generate(builder){
      const w=builder.world,plan=platformBattlefieldPlan(w.terrainSeed,w.extent),
        surface=w.surface=new BattlefieldSurface(w.extent,w.cellSize,
          (x,z)=>platformBattlefieldHeight(plan,x,z),height=>Math.floor((height-plan.floor+1e-5)/12));
      w.staticGrid.set(surface.cliffs);w.terrainFeatureGrid.set(surface.cliffs);
      // Ramps remain traversable but cannot be obstructed by foundations.
      surface.buildBlocked=new Uint8Array(w.staticGrid.length);
      for(let i=0;i<w.staticGrid.length;i++){
        const p=w.point(i),h=surface.heightAt(p.x,p.z);
        if(plan.ramps.some(r=>{
          const dx=p.x-r.x,dz=p.z-r.z,u=dx*r.dx+dz*r.dz,v=dx*r.dz-dz*r.dx;
          return u>=-2.5&&u<=r.length+2.5&&Math.abs(v)<=r.width/2+2.5;
        }))surface.buildBlocked[i]=1;
        w.terrainColors.set([62+h*.8,79+h*.9,91+h,255],i*4);
        w.renderData.groundColors.push([.55,.65,.72],[.55,.65,.72]);
      }
      w.renderData.geometries.push({mesh:'terrain',model:'platformDeck',plan},
        {mesh:'platformFixtures',model:'shipPlant',seed:197,extent:0});
      builder.place('terrain',0,0,0,1,1,1,0xffffff,0,0,0,0,1,'static','METAL');
      // Machinery is outside the playable rectangle, never an invisible nav obstacle.
      for(const side of [-1,1])for(let z=-120;z<=120;z+=60)
        builder.place('platformFixtures',side*(w.extent+25),plan.floor,z,5,7,5,
          0x91a3af,0,0,0,0,1,'static','METAL');
    }
  };
}
