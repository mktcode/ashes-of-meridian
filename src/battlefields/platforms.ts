/* Engineered topology is planned explicitly, never quantized from landscape noise. */
'use strict';
interface BattlefieldPlatform {
  x: number; z: number; width: number; depth: number; height: number; base: number;
  corners: readonly [number,number,number,number];
  cornerStyle: 'round' | 'chamfer';
}
const PLATFORM_TIER_HEIGHT=3;
const PLATFORM_RAMP_LENGTH=12.5;
const PLATFORM_LANDING=15;
interface BattlefieldRamp { x: number; z: number; dx: number; dz: number; length: number; width: number; rise: number; base: number }
interface BattlefieldPlatformScenery extends Position { height:number; width:number; depth:number }
interface BattlefieldPlatformGreeble extends BattlefieldPlatformScenery { kind:number; yaw:number }
interface BattlefieldPlatformDockyard extends Position {
  width:number; depth:number; height:number; yaw:number;
  kind:'hangar'|'battery'|'sensor'|'gantry'|'hall';
}
interface BattlefieldPlatformSkyline extends Position {
  width:number; depth:number; height:number; style:number;
}
interface BattlefieldPlatformPlan {
  extent: number; floor: number; detailSeed: number; platforms: BattlefieldPlatform[]; ramps: BattlefieldRamp[];
  scenery: BattlefieldPlatformScenery[];
  skyline: BattlefieldPlatformSkyline[];
  dockyard: BattlefieldPlatformDockyard[];
  greebles: BattlefieldPlatformGreeble[];
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
  const plan:BattlefieldPlatformPlan={extent,floor,detailSeed:seed^0x50444543,platforms,ramps,scenery:[],skyline:[],dockyard:[],greebles:[]},supports: BattlefieldPlatform[]=[];
  for(const room of rooms){
    const p:BattlefieldPlatform={...room,height:floor+PLATFORM_TIER_HEIGHT,base:floor,corners:[0,0,0,0],cornerStyle:'round'};
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
    if(Math.min(p.width,p.depth)<50||Math.max(p.width,p.depth)<80)continue;
    if(highDecks&&random()<.35)continue;
    const alongX=p.width>p.depth,sign=random()<.5?-1:1,
      long=alongX?p.width:p.depth,short=alongX?p.depth:p.width,
      size=Math.floor(Math.min(55,long-52.5,short-20)/2.5)*2.5,
      across=snap((random()-.5)*Math.max(0,short-size-20)),
      along=sign*(long/2-size/2-10),
      x=p.x+(alongX?along:across),z=p.z+(alongX?across:along),dx=alongX?sign:0,dz=alongX?0:sign,
      upper:BattlefieldPlatform={x,z,width:size,depth:size,height:floor+PLATFORM_TIER_HEIGHT*2,
        base:floor+PLATFORM_TIER_HEIGHT,corners:[0,0,0,0],cornerStyle:'round'},length=PLATFORM_RAMP_LENGTH;
    platforms.push(upper);highDecks++;
    ramps.push({x:x-dx*(size/2+length),z:z-dz*(size/2+length),dx,dz,length,width:25,rise:PLATFORM_TIER_HEIGHT,base:upper.base});
  }
  if(!highDecks)throw Error('Platform partition lacks a supported high deck');
  // Shape RNG is independent: corner detail never shifts the partition/access draws.
  const shape=seeded(seed^0x50434f52),style=seeded(seed^0x50434544);
  for(const p of platforms){
    p.cornerStyle=style()<.5?'round':'chamfer';
    const max=p.height>floor+PLATFORM_TIER_HEIGHT?Math.min(5,(p.width-25)/2):Math.min(12.5,p.width/4,p.depth/4);
    p.corners=Array.from({length:4},()=>max<2.5||shape()<.15?0:Math.floor((2.5+shape()*(max-2.5))/2.5)*2.5) as [number,number,number,number];
  }
  const bounds=(r:BattlefieldRamp,landing=PLATFORM_LANDING)=>({x:r.x+r.dx*r.length/2,z:r.z+r.dz*r.length/2,
    width:r.dx?r.length+landing*2:r.width+10,
    depth:r.dz?r.length+landing*2:r.width+10});
  const overlaps=(a:ReturnType<typeof bounds>,b:ReturnType<typeof bounds>)=>
    Math.abs(a.x-b.x)<(a.width+b.width)/2&&Math.abs(a.z-b.z)<(a.depth+b.depth)/2;
  const entrances=rooms.map(room=>{
    const candidates:BattlefieldRamp[]=[];
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const reach=(dx?room.depth:room.width)/2-20,offsets=[0];
      for(let offset=-reach;offset<=reach;offset+=5)if(offset!==0)offsets.push(offset);
      for(const offset of offsets){
        const x=room.x-dx*room.width/2+(dz?offset:0),
          z=room.z-dz*room.depth/2+(dx?offset:0),length=PLATFORM_RAMP_LENGTH;
        candidates.push({x:x-dx*length,z:z-dz*length,dx,dz,length,width:25,rise:PLATFORM_TIER_HEIGHT,base:floor});
      }
    }
    for(let i=candidates.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
    return {candidates,wanted:random()<.65?2:1};
  });
  // Reserve one access per room before any optional second entrance can crowd it out.
  for(let pass=0;pass<2;pass++)for(const {candidates,wanted} of entrances){
    if(pass===1&&wanted===1)continue;
    let added=0;
    for(const r of candidates){
      const b=bounds(r);
      // Flat landings may merge; no ramp body may intrude into another landing.
      if(ramps.some(q=>overlaps(bounds(q,0),b)||overlaps(bounds(q),bounds(r,0))))continue;
      let valid=true;
      for(const u of [-PLATFORM_LANDING,-7.5,0,r.length/2,r.length-2.5,r.length+5,r.length+PLATFORM_LANDING])for(const v of [-17.5,0,17.5]){
        const h=platformBattlefieldHeight(plan,r.x+r.dx*u-r.dz*v,r.z+r.dz*u+r.dx*v);
        if(Math.abs(h-(u>r.length?floor+PLATFORM_TIER_HEIGHT:floor))>.001)valid=false;
      }
      if(!valid)continue;
      ramps.push(r);added++;break;
    }
    if(pass===0&&!added)throw Error('Platform room has no clear ground ramp');
  }
  return plan;
}
const PLATFORM_ARC_NORMALS=Array.from({length:4},(_,i)=>{
  const angle=(i+.5)*Math.PI/8;return {x:Math.cos(angle),z:Math.sin(angle)};
});
function platformContains(p:BattlefieldPlatform,x:number,z:number):boolean {
  const u=x-p.x+p.width/2,v=z-p.z+p.depth/2;
  if(u<0||u>p.width||v<0||v>p.depth)return false;
  const cut=(dx:number,dz:number,r:number)=>dx<r&&dz<r&&
    (p.cornerStyle==='chamfer'?dx+dz<r-1e-8:
      PLATFORM_ARC_NORMALS.some(n=>(r-dx)*n.x+(r-dz)*n.z>r*Math.cos(Math.PI/16)+1e-8));
  return !cut(u,v,p.corners[0])&&!cut(u,p.depth-v,p.corners[1])&&
    !cut(p.width-u,p.depth-v,p.corners[2])&&!cut(p.width-u,v,p.corners[3]);
}
function platformOutline(p:BattlefieldPlatform):Position[]{
  const l=p.x-p.width/2,r=p.x+p.width/2,n=p.z-p.depth/2,f=p.z+p.depth/2,[a,b,c,d]=p.corners,
    out:Position[]=[];
  for(const [x,z,radius,angle] of [[l+b,f-b,b,Math.PI],[r-c,f-c,c,Math.PI/2],
    [r-d,n+d,d,0],[l+a,n+a,a,-Math.PI/2]]){
    const segments=p.cornerStyle==='chamfer'?1:4;
    for(let i=0;i<=segments;i++){
      const t=angle-i*Math.PI/2/segments;
      out.push({x:x+radius*Math.cos(t),z:z+radius*Math.sin(t)});
    }
  }
  return out.filter((v,i,all)=>Math.hypot(v.x-all[(i+1)%all.length].x,v.z-all[(i+1)%all.length].z)>1e-7);
}
function platformBattlefieldHeight(plan: BattlefieldPlatformPlan,x:number,z:number):number {
  let height=plan.floor;
  for(const p of plan.platforms)
    if(platformContains(p,x,z))height=Math.max(height,p.height);
  for(const r of plan.ramps){
    const dx=x-r.x,dz=z-r.z,u=dx*r.dx+dz*r.dz,v=dx*r.dz-dz*r.dx;
    if(u>=0&&u<=r.length&&Math.abs(v)<=r.width/2)height=Math.max(height,r.base+r.rise*u/r.length);
  }
  return height;
}
function platformBattlefieldSurface(plan:BattlefieldPlatformPlan,cellSize:number):BattlefieldSurface{
  const surface=new BattlefieldSurface(plan.extent,cellSize,
    (x,z)=>platformBattlefieldHeight(plan,x,z),height=>Math.floor((height-plan.floor+1e-5)/PLATFORM_TIER_HEIGHT)),
    n=plan.extent*2/cellSize;
  surface.buildBlocked=new Uint8Array(n*n);
  for(let i=0;i<n*n;i++){
    const x=(i%n+.5)*cellSize-plan.extent,z=(Math.floor(i/n)+.5)*cellSize-plan.extent;
    if(plan.ramps.some(r=>{
      const dx=x-r.x,dz=z-r.z,u=dx*r.dx+dz*r.dz,v=dx*r.dz-dz*r.dx;
      return u>=-PLATFORM_LANDING&&u<=r.length+PLATFORM_LANDING&&Math.abs(v)<=r.width/2+5;
    }))surface.buildBlocked[i]=1;
  }
  return surface;
}
function platformResourceSites(plan:BattlefieldPlatformPlan,seed:number):Position[]{
  const surface=platformBattlefieldSurface(plan,2.5);
  const random=seeded(seed^0x5045434f),candidates:Position[]=plan.platforms.filter(p=>p.height===plan.floor+PLATFORM_TIER_HEIGHT*2).map(p=>({x:p.x-2.5,z:p.z-2.5})),sites:Position[]=[];
  for(let z=-plan.extent+30;z<=plan.extent-30;z+=20)for(let x=-plan.extent+30;x<=plan.extent-30;x+=20)candidates.push({x,z});
  for(let i=candidates.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  for(const p of candidates){
    const h=platformBattlefieldHeight(plan,p.x,p.z);
    if(sites.some(q=>distance(p,q)<45))continue;
    if([-12,0,12].some(dx=>[-12,0,12].some(dz=>Math.abs(platformBattlefieldHeight(plan,p.x+dx,p.z+dz)-h)>.001)))continue;
    if(!surface.foundation(battlefieldGasPosition(p),BUILDINGS.refinery.size))continue;
    sites.push(p);if(sites.length===9)break;
  }
  if(sites.length<6)throw Error('Platform plan lacks economic space');
  return sites;
}
// Closed technical profile: no habitat, soil/rock textures, vegetation or outdoor weather.
// Separate cosmetic RNG. Modules occupy already blocked edge cells; never shrink build/movement areas.
function decoratePlatformStations(builder:BattlefieldBuilder,plan:BattlefieldPlatformPlan,resources:Position[]){
  const w=builder.world,s=w.surface!,random=seeded(plan.detailSeed^0x53544154),
    density=seeded(plan.detailSeed^0x44454e53)(),stationLimit=18+Math.floor(density*7),
    hardwareLimit=36+Math.floor(density*13),models=['shipHangar','shipPlant','shipBridge','shipCrate'];
  for(const model of [...models,'shipHangarLights'])w.renderData.geometries.push({mesh:'platform'+model,model,seed:0,extent:0});
  const candidates:Position[]=[],hardwareCandidates:Position[]=[];
  for(let i=0;i<w.staticGrid.length;i++)if(w.staticGrid[i]&&s.cliffs[i]){
    const p=w.point(i),height=platformBattlefieldHeight(plan,p.x,p.z);
    if(Math.abs(p.x)>w.extent-15||Math.abs(p.z)>w.extent-15)continue;
    if([-1.2,0,1.2].some(dx=>[-1.2,0,1.2].some(dz=>Math.abs(platformBattlefieldHeight(plan,p.x+dx,p.z+dz)-height)>.001)))continue;
    hardwareCandidates.push(p);
    if(height>plan.floor)candidates.push(p);
  }
  for(let attempt=0;attempt<240&&candidates.length&&plan.scenery.length<stationLimit;attempt++){
    const p=candidates.splice(Math.floor(random()*candidates.length),1)[0],{x,z}=p;
    if(resources.some(q=>distance(p,q)<32)||plan.scenery.some(q=>distance(p,q)<14))continue;
    if(plan.ramps.some(r=>{
      const dx=x-r.x,dz=z-r.z,u=dx*r.dx+dz*r.dz,v=dx*r.dz-dz*r.dx;
      return u>=-PLATFORM_LANDING-18&&u<=r.length+PLATFORM_LANDING+18&&Math.abs(v)<=r.width/2+18;
    }))continue;
    const height=platformBattlefieldHeight(plan,x,z),width=w.cellSize,depth=w.cellSize,model=models[Math.floor(random()*models.length)],
      yaw=Math.floor(random()*4)*Math.PI/2,scale=.9,h=1.2+random()*.8;
    plan.scenery.push({x,z,height,width,depth});
    builder.place('box',x,height+.10,z,width,.46,depth,0x394a53,0,0,0,0,1,'static','METAL');
    builder.place('platform'+model,x,height+.33,z,scale,h,scale,
      random()<.5?0x9cacb3:0xaa9a80,yaw,0,0,0,1,'static','METAL');
    if(model==='shipHangar')builder.place('platformshipHangarLights',x,height+.33,z,scale,h,scale,0xffffff,yaw,0,0,.65,1,'static','AUTO');
    // Flush perimeter warning paint outlines the existing blocked cell.
    for(const side of [-1,1]){
      builder.place('box',x+side*(width/2-.12),height+.35,z,.12,.03,depth-.24,0xc8aa56,0,0,0,0,1,'static','AUTO');
      builder.place('box',x,height+.35,z+side*(depth/2-.12),width-.24,.03,.12,0xc8aa56,0,0,0,0,1,'static','AUTO');
    }
  }
  // Additional small hardware uses only unused, already blocked edge cells.
  const detail=seeded(plan.detailSeed^0x47524545),gun=seeded(plan.detailSeed^0x47554e53);
  const gunCandidates=hardwareCandidates.slice();
  for(let attempt=0;attempt<240&&gunCandidates.length&&plan.greebles.length<8;attempt++){
    const p=gunCandidates.splice(Math.floor(gun()*gunCandidates.length),1)[0],height=platformBattlefieldHeight(plan,p.x,p.z);
    if(height<=plan.floor||resources.some(q=>distance(p,q)<26)||plan.scenery.some(q=>distance(p,q)<10)||
      plan.greebles.some(q=>distance(p,q)<22))continue;
    // A long rail gun must lie along a continuous blocked cliff band, never across free floor.
    const angles=[0,Math.PI/2,Math.PI,-Math.PI/2],offset=Math.floor(gun()*4);
    for(let index=0;index<4;index++){
      const yaw=angles[(index+offset)%4],cx=Math.cos(yaw),sx=Math.sin(yaw);
      let clear=true;
      for(let u=-1.1;u<=1.11;u+=1.1)for(let v=-2.1;v<=7.41;v+=.5){
        const x=p.x+u*cx+v*sx,z=p.z-u*sx+v*cx,cell=w.idx(x,z);
        if(!w.staticGrid[cell]||!s.cliffs[cell]||Math.abs(platformBattlefieldHeight(plan,x,z)-height)>.001)clear=false;
      }
      if(!clear)continue;
      plan.greebles.push({...p,height,width:w.cellSize,depth:10,kind:4,yaw});break;
    }
  }
  for(let attempt=0;attempt<360&&hardwareCandidates.length&&plan.greebles.length<hardwareLimit;attempt++){
    const p=hardwareCandidates.splice(Math.floor(detail()*hardwareCandidates.length),1)[0];
    if(resources.some(q=>distance(p,q)<18)||plan.scenery.some(q=>distance(p,q)<5)||
      plan.greebles.some(q=>distance(p,q)<6))continue;
    if(plan.ramps.some(r=>{
      const dx=p.x-r.x,dz=p.z-r.z,u=dx*r.dx+dz*r.dz,v=dx*r.dz-dz*r.dx;
      return u>=-PLATFORM_LANDING-12&&u<=r.length+PLATFORM_LANDING+12&&Math.abs(v)<=r.width/2+12;
    }))continue;
    plan.greebles.push({...p,height:platformBattlefieldHeight(plan,p.x,p.z),width:w.cellSize,depth:w.cellSize,
      kind:Math.floor(detail()*4),yaw:Math.floor(detail()*4)*Math.PI/2});
  }
  w.renderData.geometries.push({mesh:'platformHardware',model:'platformHardware',plan},
    {mesh:'platformHardwareLights',model:'platformHardwareLights',plan});
  builder.place('platformHardware',0,0,0,1,1,1,0xffffff,0,0,0,0,1,'static','METAL');
  builder.place('platformHardwareLights',0,0,0,1,1,1,0xffffff,0,0,0,.5,1,'static','AUTO');
}
// A bounded exterior ring; tall foreground silhouettes stay clear of the playable floor.
function decoratePlatformSkyline(builder:BattlefieldBuilder,plan:BattlefieldPlatformPlan){
  const random=seeded(plan.detailSeed^0x534b594c);
  for(let side=0;side<4;side++)for(let slot=0;slot<8;slot++){
    const width=18+random()*12,depth=18+random()*12,height=28+random()*40,
      along=-(plan.extent+32)+(slot+.5)*(plan.extent+32)/4+(random()-.5)*10,
      outside=Math.max(plan.extent+Math.max(width,depth)/2+28+height*.85,plan.extent+111+height*.1),
      sign=side<2?1:-1;
    plan.skyline.push({x:side%2?along:sign*outside,z:side%2?sign*outside:along,
      width,depth,height,style:Math.floor(random()*4)});
  }
  // Corner landmarks close the diagonal panorama gaps between the four side rows.
  for(const x of [-1,1])for(const z of [-1,1])plan.skyline.push({
    x:x*(plan.extent+105),z:z*(plan.extent+105),width:24,depth:24,height:60+random()*16,style:2});
  // Connected megastructure modules replace the isolated-tower look without entering play space.
  const dock=seeded(plan.detailSeed^0x444f434b),yaw=[-Math.PI/2,Math.PI,Math.PI/2,0],
    kinds=[['sensor','gantry'],['hall','battery'],['battery','hall'],['sensor','gantry']] as const;
  for(let side=0;side<4;side++)for(let slot=0;slot<4;slot++){
    const width=(plan.extent+32)/2,depth=58+dock()*10,height=26+dock()*12,
      along=-(plan.extent+32)+(slot+.5)*width,outside=plan.extent+28+depth/2,sign=side<2?1:-1;
    plan.dockyard.push({x:side%2?along:sign*outside,z:side%2?sign*outside:along,
      width,depth,height,yaw:yaw[side],kind:slot===1||slot===2?'hangar':kinds[side][slot===0?0:1]});
  }
  builder.world.renderData.geometries.push({mesh:'platformDockyard',model:'platformDockyard',plan},
    {mesh:'platformDockyardLights',model:'platformDockyardLights',plan},
    {mesh:'platformSkyline',model:'platformSkyline',plan},
    {mesh:'platformSkylineLights',model:'platformSkylineLights',plan});
  builder.place('platformDockyard',0,0,0,1,1,1,0xffffff,0,0,0,0,1,'static','TECHNICAL');
  builder.place('platformDockyardLights',0,0,0,1,1,1,0xffffff,0,0,0,1.8,1,'static','AUTO');
  builder.place('platformSkyline',0,0,0,1,1,1,0xffffff,0,0,0,0,1,'static','METAL');
  builder.place('platformSkylineLights',0,0,0,1,1,1,0xffffff,0,0,0,.5,1,'static','AUTO');
}
function createPlatformBattlefield(): BattlefieldDefinition {
  return {
    name:'ORBITAL PLATFORM',size:{extent:160,cellSize:2.5},
    createSize:seed=>({extent:[160,180,200][Math.floor(seeded(seed^0x5053495a)()*3)],cellSize:2.5}),
    design:{atmosphere:{timeOfDay:'seeded'}},
    palette:{ground:0x637b89,rock:0x637b89,accent:0xffc56b,flora:0x637b89},worldEvent:null,
    render:{groundTexture:'metal',skyTexture:'sky',daylight:true,terrainReceiverHeight:48,
      sceneryBounds:{extent:360,maxHeight:112},
      rockDecor:{density:0,opacity:0},shrubDecor:{density:0,opacity:0},haze:[.035,.06,.09]},
    createLayout(seed,size){
      const plan=platformBattlefieldPlan(seed,size.extent),resourceSites=platformResourceSites(plan,seed);
      return {startSites:[],resourceSites,corridors:plan.ramps.map(r=>[
        [r.x,r.z],[r.x+r.dx*r.length,r.z+r.dz*r.length]])};
    },
    generate(builder){
      const w=builder.world,plan=platformBattlefieldPlan(w.terrainSeed,w.extent),
        surface=w.surface=platformBattlefieldSurface(plan,w.cellSize);
      w.staticGrid.set(surface.cliffs);w.terrainFeatureGrid.set(surface.cliffs);
      for(let i=0;i<w.staticGrid.length;i++){
        const p=w.point(i),h=surface.heightAt(p.x,p.z);
        w.terrainColors.set([62+h*.8,79+h*.9,91+h,255],i*4);
        w.renderData.groundColors.push([.55,.65,.72],[.55,.65,.72]);
      }
      w.renderData.geometries.push({mesh:'terrain',model:'platformDeck',plan},
        {mesh:'platformFixtures',model:'shipPlant',seed:197,extent:0},
        {mesh:'platformSignals',model:'platformSignals',plan},
        {mesh:'platformFloor',model:'platformFloor',plan});
      decoratePlatformStations(builder,plan,w.layout.resourceSites);
      decoratePlatformSkyline(builder,plan);
      builder.place('terrain',0,0,0,1,1,1,0xffffff,0,0,0,0,1,'static','TECHNICAL');
      builder.place('platformSignals',0,0,0,1,1,1,0xffffff,0,0,0,.65,1,'static','AUTO');
      builder.place('platformFloor',0,0,0,1,1,1,0xffffff,0,0,0,0,1,'static','TECHNICAL');
      // Machinery is outside the playable rectangle, never an invisible nav obstacle.
      for(const side of [-1,1])for(let z=-120;z<=120;z+=60)
        builder.place('platformFixtures',side*(w.extent+25),plan.floor,z,5,7,5,
          0x91a3af,0,0,0,0,1,'static','METAL');
    }
  };
}
