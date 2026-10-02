/* Engineered topology is planned explicitly, never quantized from landscape noise. */
'use strict';
interface BattlefieldPlatform { x: number; z: number; width: number; depth: number; height: number }
interface BattlefieldRamp { x: number; z: number; dx: number; dz: number; length: number; width: number; rise: number }
interface BattlefieldPlatformPlan {
  extent: number; floor: number; platforms: BattlefieldPlatform[]; ramps: BattlefieldRamp[];
}
function platformBattlefieldPlan(seed: number, extent: number): BattlefieldPlatformPlan {
  const random=seeded(seed^0x504c4154),snap=(v:number)=>Math.round(v/2.5)*2.5,
    platforms: BattlefieldPlatform[]=[],ramps: BattlefieldRamp[]=[],floor=12;
  const ramp=(x:number,z:number,dx:number,dz:number,rise:number)=>{
    const length=rise===12?32.5:50;
    ramps.push({x:x-dx*length,z:z-dz*length,dx,dz,length,width:25,rise});
  };
  for(const sz of [-1,1])for(const sx of [-1,1]){
    const x=sx*snap(82.5+random()*10),z=sz*snap(82.5+random()*10),
      width=snap(60+random()*15),depth=snap(60+random()*15),height=24;
    platforms.push({x,z,width,depth,height});
    ramp(x-sx*width/2,z,sx,0,height-floor);
    ramp(x,z-sz*depth/2,0,sz,height-floor);
  }
  const width=45,depth=40;
  platforms.push({x:0,z:0,width,depth,height:36});
  ramp(0,-depth/2,0,1,24);ramp(0,depth/2,0,-1,24);
  return {extent,floor,platforms,ramps};
}
function platformBattlefieldHeight(plan: BattlefieldPlatformPlan,x:number,z:number):number {
  for(const p of plan.platforms)
    if(Math.abs(x-p.x)<=p.width/2&&Math.abs(z-p.z)<=p.depth/2)return p.height;
  for(const r of plan.ramps){
    const dx=x-r.x,dz=z-r.z,u=dx*r.dx+dz*r.dz,v=dx*r.dz-dz*r.dx;
    if(u>=0&&u<=r.length&&Math.abs(v)<=r.width/2)return plan.floor+r.rise*u/r.length;
  }
  return plan.floor;
}
// Closed technical profile: no habitat, soil/rock textures, vegetation or outdoor weather.
function createPlatformBattlefield(): BattlefieldDefinition {
  return {
    name:'ORBITAL PLATFORM',size:{extent:160,cellSize:2.5},
    design:{atmosphere:{timeOfDay:'seeded'}},
    palette:{ground:0x637b89,rock:0x637b89,accent:0xffc56b,flora:0x637b89},worldEvent:null,
    render:{groundTexture:'metal',skyTexture:'sky',daylight:true,terrainReceiverHeight:48,
      rockDecor:{density:0,opacity:0},shrubDecor:{density:0,opacity:0},haze:[.035,.06,.09]},
    createLayout(seed,size){
      const plan=platformBattlefieldPlan(seed,size.extent),resourceSites:Position[]=[
        ...plan.platforms.map(p=>({x:p.x-7.5,z:p.z-7.5})),
        {x:-120,z:-7.5},{x:105,z:-7.5},{x:-7.5,z:-120},{x:-7.5,z:105}];
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
