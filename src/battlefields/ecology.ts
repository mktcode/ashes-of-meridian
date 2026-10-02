/* Presentation recipes, not terrain generators: shared habitat fields align
 * material mosaics, plant communities and weather without touching encounter RNG. */
'use strict';
const ECOLOGY_BIOMES: readonly EcologyBiome[] = ['verdant','ochre','rime','mycelium'];
const ECOLOGY_WEATHER: readonly EcologyWeather[] = ['clear','mist','rain','snow','ash'];
const ECOLOGY_PALETTES = {
  verdant: {dry:[.56,.55,.24],lush:[.13,.37,.28],soil:[.45,.30,.18],stone:[.47,.53,.46],leaf:0x82b864,bloom:0xe0c681},
  ochre: {dry:[.69,.43,.20],lush:[.34,.39,.24],soil:[.43,.24,.16],stone:[.62,.35,.24],leaf:0xdab15b,bloom:0xe27742},
  rime: {dry:[.49,.55,.52],lush:[.21,.35,.37],soil:[.32,.34,.36],stone:[.58,.64,.70],leaf:0x759fa2,bloom:0xa9b7e5},
  mycelium: {dry:[.38,.24,.40],lush:[.17,.36,.37],soil:[.24,.19,.28],stone:[.39,.38,.55],leaf:0x7cc4c0,bloom:0xd791d4}
} as const;
function battlefieldEcology(profile:BattlefieldRenderProfile, seed:number):BattlefieldRenderProfile {
  if(!profile.wilderness)return profile;
  const random=seeded(seed^0x45434f4c),choice=ECOLOGY_BIOMES[Math.floor(random()*4)],weatherChoice=random(),
    biome=profile.wilderness==='seeded'?choice:profile.wilderness,
    weather:EcologyWeather=weatherChoice<.3?'clear':weatherChoice<.55?'mist':
      biome==='rime'?'snow':biome==='ochre'?'ash':'rain';
  const vegetationDensity=1.35+seeded(seed^0x56454744)()*.65;
  return {...profile,ecology:{vegetationDensity,biome,weather,phase:random()*Math.PI*2,cover:weather==='clear'?.18:weather==='mist'?.58:.8,
    wind:.12+random()*.16,...ECOLOGY_PALETTES[biome]}};
}
// Same bounded field in the scene shader. Its broad regions are world-anchored,
// not screen-space noise; no palette choice changes walkability or resources.
function ecologyHabitat(phase:number,x:number,z:number):number {
  const warp=Math.sin(x*.017+z*.031+phase)*9;
  return clamp(.5+Math.sin(x*.041+warp*.08+phase)*.24+Math.cos(z*.036-x*.015-phase)*.23,0,1);
}
function ecologyFootprint(world:Battlefield,x:number,z:number,r:number):boolean {
  if(Math.max(Math.abs(x),Math.abs(z))+r>=world.extent-1)return false;
  const c=world.cellSize,e=world.extent,n=world.gridSize;
  for(let iz=Math.floor((z-r+e)/c);iz<=Math.floor((z+r+e)/c);iz++)
    for(let ix=Math.floor((x-r+e)/c);ix<=Math.floor((x+r+e)/c);ix++)
      if(!world.staticGrid[iz*n+ix])return false;
  return true;
}
function decorateEcology(builder:BattlefieldBuilder) {
  const w=builder.world,style=w.renderProfile.ecology;if(!style||style.natural===false)return;
  const rand=builder.cosmeticRandom(0x48414249),height=(x:number,z:number)=>w.surface?.heightAt(x,z)??0,
    family=style.flora??(style.biome==='mycelium'?'Fungus':style.biome==='rime'?'Conifer':style.biome==='ochre'?'Acacia':'Grove'),
    woody=family==='Grove'||family==='Acacia'||family==='Conifer',
    occupied:{x:number;z:number;r:number}[]=[],groundSites:Position[]=[],landmarks:Position[]=[];
  // Replace only this recipe's previous cosmetic families, never authored geometry.
  w.renderData.placements=w.renderData.placements.filter(p=>!p.mesh.startsWith('upland'));
  w.renderData.geometries=w.renderData.geometries.filter(p=>!p.mesh.startsWith('upland'));
  for(let variant=0;variant<3;variant++) {
    for(const part of [...(woody?['Trunk']:[]),...new Set([family,'Tuft','Relic','Spire'])])w.renderData.geometries.push({
      mesh:`ecology${part}${variant}`,model:`ecology${part}`,seed:193+variant*7919,
      extent:part==='Trunk'&&family==='Acacia'?1:0,detail:part==='Tuft'});
    w.renderData.geometries.push({mesh:`ecologyStone${variant}`,model:'uplandStone',seed:173+variant*7919,extent:0});
  }
  const safe=(x:number,z:number,r:number)=>w.layout.resourceSites.every(p=>Math.hypot(x-p.x,z-p.z)>r+8&&
    distance({x,z},battlefieldGasPosition(p))>r+6),
    clear=(x:number,z:number,r:number)=>occupied.every(p=>Math.hypot(x-p.x,z-p.z)>r+p.r),
    place=(part:string,v:number,x:number,y:number,z:number,r:number,h:number,color:number,yaw:number,mat:WorldPlacement['material'],glow=0)=>
      builder.place(`ecology${part}${v}`,x,y,z,r,h,r,color,yaw,0,0,glow,1,'static',mat);
  const density=style.vegetationDensity,treeLimit=Math.floor(144*density),
    tuftLimit=Math.floor(650*density),attempts=Math.floor(4200*density),
    tuftSpacing=1.9/Math.sqrt(density);
  let trees=0,stones=0,tufts=0;
  // Landmark clusters first: their complete silhouettes occupy already blocked rock.
  // No new collision, rewards or phantom buildings hidden inside decorative ruins.
  for(let i=0;i<700&&landmarks.length<6;i++) {
    const x=(rand()-.5)*(w.extent*2-24),z=(rand()-.5)*(w.extent*2-24),r=2+rand()*1.8,v=i%3,
      heights=[height(x,z),height(x-r,z),height(x+r,z),height(x,z-r),height(x,z+r)],y=Math.min(...heights),spread=Math.max(...heights)-y;
    if(!safe(x,z,r)||!ecologyFootprint(w,x,z,r+.4)||!clear(x,z,r+10)||spread>3.6)continue;
    const part=style.biome==='mycelium'||rand()<.45?'Spire':'Relic';
    place(part,v,x,y-.45,z,r,part==='Relic'?5+rand()*4:7+rand()*6,0xffffff,rand()*Math.PI*2,part==='Relic'?'MASONRY':'CRYSTAL',part==='Spire'?.18:0);
    occupied.push({x,z,r:r+1});landmarks.push({x,z});
  }
  for(let i=0;i<attempts;i++) {
    const x=(rand()-.5)*(w.extent*2-8),z=(rand()-.5)*(w.extent*2-8),v=i%3,habitat=ecologyHabitat(style.phase,x,z),
      r=1.6+rand()*2.2,yaw=rand()*Math.PI*2,y=height(x,z);
    if(!safe(x,z,1))continue;
    if(safe(x,z,r)&&ecologyFootprint(w,x,z,r+.4)&&clear(x,z,r*.72)) {
      const lo=Math.min(y,height(x-r,z),height(x+r,z),height(x,z-r),height(x,z+r)),
        hi=Math.max(y,height(x-r,z),height(x+r,z),height(x,z-r),height(x,z+r));
      if(trees<treeLimit&&habitat>.36&&hi-lo<4.8) {
        const h=5+habitat*5+rand()*2;
        if(woody)place('Trunk',v,x,y-.35,z,r,h,0xb0a18c,yaw,'BARK');
        place(family,v,x,y-.35,z,r,h,style.leaf,yaw,'LEAF',style.biome==='mycelium'?.18:0);
        occupied.push({x,z,r:r*.78});trees++;
      }else if(stones<84&&hi-lo<2.8) {
        place('Stone',v,x,lo-.35,z,r,1.3+r*.55+hi-lo,0xffffff,yaw,'ROCK');
        occupied.push({x,z,r:r*.65});stones++;
      }
    }else if(tufts<tuftLimit&&habitat>.48&&!w.staticGrid[w.idx(x,z)]&&groundSites.every(p=>Math.hypot(x-p.x,z-p.z)>tuftSpacing)) {
      // Avoid route centres and keep every small plant visibly traversable.
      if(w.layout.corridors.some(route=>route.slice(1).some(([bx,bz],j)=>{
        const [ax,az]=route[j];return pointSegment({x,z},{x:ax,z:az},{x:bx,z:bz})<2.5;
      })))continue;
      const lo=Math.min(y,height(x-1,z),height(x+1,z),height(x,z-1),height(x,z+1)),
        hi=Math.max(y,height(x-1,z),height(x+1,z),height(x,z-1),height(x,z+1));
      if(hi-lo>.3)continue;
      place('Tuft',v,x,lo-.08,z,.65+rand()*.45,.18+rand()*.14,habitat>.73?style.bloom:style.leaf,yaw,'LEAF');
      groundSites.push({x,z});tufts++;
    }
  }
  // Palette information on the minimap, not a second terrain or visibility map.
  for(let i=0;i<w.gridSize*w.gridSize;i++) {
    const p=w.point(i),h=ecologyHabitat(style.phase,p.x,p.z),light=.83+height(p.x,p.z)*.013;
    for(let c=0;c<3;c++) {
      const meadow=style.dry[c]*(1-h)+style.lush[c]*h;
      w.terrainColors[i*4+c]=(w.staticGrid[i]?(meadow*.35+style.stone[c]*.65)*.68:meadow)*180*light;
    }
  }
}
