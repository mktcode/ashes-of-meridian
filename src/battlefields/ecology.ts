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
  const vegetationDensity=3+seeded(seed^0x56454744)()*9;
  return {...profile,ecology:{vegetationDensity,biome,weather,phase:random()*Math.PI*2,cover:weather==='clear'?.18:weather==='mist'?.58:.8,
    wind:.12+random()*.16,...ECOLOGY_PALETTES[biome]}};
}
// Same bounded field in the scene shader. Its broad regions are world-anchored,
// not screen-space noise; no palette choice changes walkability or resources.
function ecologyHabitat(phase:number,x:number,z:number):number {
  const warp=Math.sin(x*.017+z*.031+phase)*9;
  return clamp(.5+Math.sin(x*.041+warp*.08+phase)*.24+Math.cos(z*.036-x*.015-phase)*.23,0,1);
}
// Four soft communities within the family's palette, not four unrelated climates.
// Keep this analytic recipe in sync with biotopeWeights() in the scene shader.
function ecologyBiotope(style:BattlefieldEcology,x:number,z:number,height:number,slope:number):readonly [number,number,number,number] {
  const smooth=(a:number,b:number,v:number)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);},
    [low,range]=style.biotopeElevation??[24,32],elevation=clamp((height-low)/range,0,1),
    moisture=clamp(.5+Math.sin(x*.012+Math.sin(z*.01)*.8+style.phase*.6)*.28+
      Math.cos(z*.016-style.phase*1.3)*.24,0,1),
    patch=ecologyHabitat(style.phase,x*.65,z*.65),
    rock=clamp(smooth(.45,1.35,slope)*.55+smooth(.65,.98,elevation)*.5,0,1),
    wet=(1-rock)*smooth(.35,.75,moisture)*(1-smooth(.18,.5,elevation))*(1-smooth(.08,.38,slope))*.9,
    forest=(1-rock-wet)*smooth(.2,.7,patch)*(.35+.65*smooth(.22,.65,moisture))*(1-.5*smooth(.6,.95,elevation))*.95;
  return [1-rock-wet-forest,forest,wet,rock];
}
function ecologyBiotopeAt(style:BattlefieldEcology,x:number,z:number,height:(x:number,z:number)=>number) {
  const step=1.25,dx=(height(x+step,z)-height(x-step,z))/(2*step),dz=(height(x,z+step)-height(x,z-step))/(2*step);
  return ecologyBiotope(style,x,z,height(x,z),Math.hypot(dx,dz));
}
function ecologyBiotopeColor(style:BattlefieldEcology,weights:readonly number[]):number[] {
  return [0,1,2].map(c=>style.dry[c]*weights[0]+style.lush[c]*.72*weights[1]+
    (style.lush[c]*.4+style.soil[c]*.6)*weights[2]+style.stone[c]*.9*weights[3]);
}
function ecologyFloraFamilies(style:BattlefieldEcology):readonly [EcologyFlora,EcologyFlora] {
  const primary=style.flora??(style.biome==='mycelium'?'Fungus':style.biome==='rime'?'Conifer':style.biome==='ochre'?'Acacia':'Grove'),
    secondary:EcologyFlora=primary==='Grove'?'Conifer':primary==='Conifer'?'Grove':
      primary==='Acacia'||primary==='Cactus'?'Palm':primary==='Palm'?'Acacia':primary==='Fungus'?'Coral':'Fungus';
  return [primary,secondary];
}
function ecologyFloraAt(style:BattlefieldEcology,weights:readonly number[]):EcologyFlora {
  const [primary,secondary]=ecologyFloraFamilies(style);
  if(primary==='Palm')return weights[2]>.3?primary:secondary;
  return (primary==='Acacia'||primary==='Cactus'?weights[2]>.3:weights[1]>.35)?secondary:primary;
}
function ecologyWoody(family:EcologyFlora):boolean {return family==='Grove'||family==='Acacia'||family==='Conifer';}
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
  let low=Infinity;
  for(const h of w.surface?.heights??[])low=Math.min(low,h);
  if(Number.isFinite(low))style.biotopeElevation=[low,Math.max(8,(w.surface?.maxHeight??low)-low)];
  const rand=builder.cosmeticRandom(0x48414249),height=(x:number,z:number)=>w.surface?.heightAt(x,z)??0,
    families=ecologyFloraFamilies(style),woody=families.some(ecologyWoody),
    occupied:{x:number;z:number;r:number}[]=[],groundSites=new Map<string,Position[]>(),
    blockedSites:Position[]=[],landmarks:Position[]=[];
  for(let i=0;i<w.staticGrid.length;i++)if(w.staticGrid[i])blockedSites.push(w.point(i));
  // Replace only this recipe's previous cosmetic families, never authored geometry.
  w.renderData.placements=w.renderData.placements.filter(p=>!p.mesh.startsWith('upland'));
  w.renderData.geometries=w.renderData.geometries.filter(p=>!p.mesh.startsWith('upland'));
  for(let variant=0;variant<3;variant++) {
    for(const part of [...(woody?['Trunk']:[]),...new Set([...families,'Tuft','Brush','Relic','Spire'])])w.renderData.geometries.push({
      mesh:`ecology${part}${variant}`,model:`ecology${part}`,seed:193+variant*7919,
      extent:part==='Trunk'&&families.includes('Acacia')?1:0,detail:part==='Tuft'||part==='Brush'});
    w.renderData.geometries.push({mesh:`ecologyStone${variant}`,model:'uplandStone',seed:173+variant*7919,extent:0});
  }
  const safe=(x:number,z:number,r:number)=>w.layout.resourceSites.every(p=>Math.hypot(x-p.x,z-p.z)>r+8&&
    distance({x,z},battlefieldGasPosition(p))>r+6),
    clear=(x:number,z:number,r:number)=>occupied.every(p=>Math.hypot(x-p.x,z-p.z)>r+p.r),
    place=(part:string,v:number,x:number,y:number,z:number,r:number,h:number,color:number,yaw:number,mat:WorldPlacement['material'],glow=0)=>
      builder.place(`ecology${part}${v}`,x,y,z,r,h,r,color,yaw,0,0,glow,1,'static',mat);
  const density=style.vegetationDensity,treeLimit=Math.floor(144*density),
    tuftLimit=Math.floor(650*density),attempts=Math.floor(4200*density),
    tuftSpacing=1.9/Math.sqrt(density),bucketSize=1.2,
    bucketKey=(x:number,z:number)=>`${x},${z}`,
    groundClear=(x:number,z:number)=>{
      const bx=Math.floor(x/bucketSize),bz=Math.floor(z/bucketSize);
      for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)
        if(groundSites.get(bucketKey(bx+dx,bz+dz))?.some(p=>Math.hypot(x-p.x,z-p.z)<tuftSpacing))return false;
      return true;
    },
    groundRemember=(x:number,z:number)=>{
      const key=bucketKey(Math.floor(x/bucketSize),Math.floor(z/bucketSize)),sites=groundSites.get(key)??[];
      sites.push({x,z});groundSites.set(key,sites);
    };
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
    // Concentrate some draws on existing vegetation-compatible cliff bands.
    // Slimmer crowns and closer stems fill them without extending collision envelopes.
    const anchor=i%3===0&&blockedSites.length?blockedSites[Math.floor(rand()*blockedSites.length)]:null,
      x=anchor?anchor.x+(rand()-.5)*1.2:(rand()-.5)*(w.extent*2-8),
      z=anchor?anchor.z+(rand()-.5)*1.2:(rand()-.5)*(w.extent*2-8),v=i%3,
      zones=ecologyBiotopeAt(style,x,z,height),habitat=zones[0]*.12+zones[1]+zones[2]*.95,
      family=ecologyFloraAt(style,zones),r=.55+rand()*1.1,yaw=rand()*Math.PI*2,y=height(x,z);
    if(!safe(x,z,1))continue;
    if(safe(x,z,r)&&ecologyFootprint(w,x,z,r+.4)&&clear(x,z,r*.4)) {
      const lo=Math.min(y,height(x-r,z),height(x+r,z),height(x,z-r),height(x,z+r)),
        hi=Math.max(y,height(x-r,z),height(x+r,z),height(x,z-r),height(x,z+r));
      if(trees<treeLimit&&habitat>.2&&zones[3]<.7&&hi-lo<4.8) {
        const h=5+habitat*5+rand()*2;
        if(ecologyWoody(family))place('Trunk',v,x,y-.35,z,r,h,0xb0a18c,yaw,'BARK');
        place(family,v,x,y-.35,z,r,h,style.leaf,yaw,'LEAF',style.biome==='mycelium'?.18:0);
        occupied.push({x,z,r:r*.4});trees++;
      }else if(stones<84) {
        const sr=1.6+rand()*2.2,low=Math.min(y,height(x-sr,z),height(x+sr,z),height(x,z-sr),height(x,z+sr)),
          high=Math.max(y,height(x-sr,z),height(x+sr,z),height(x,z-sr),height(x,z+sr));
        if(safe(x,z,sr)&&ecologyFootprint(w,x,z,sr+.4)&&clear(x,z,sr*.72)&&high-low<2.8){
          place('Stone',v,x,low-.35,z,sr,1.3+sr*.55+high-low,0xffffff,yaw,'ROCK');
          occupied.push({x,z,r:sr*.65});stones++;
        }
      }
    }else if(tufts<tuftLimit&&(habitat>.3||rand()<.025)&&!w.staticGrid[w.idx(x,z)]&&groundClear(x,z)) {
      // Avoid route centres and keep every small plant visibly traversable.
      if(w.layout.corridors.some(route=>route.slice(1).some(([bx,bz],j)=>{
        const [ax,az]=route[j];return pointSegment({x,z},{x:ax,z:az},{x:bx,z:bz})<2.5;
      })))continue;
      const radius=.9+rand()*.65;
      if(!safe(x,z,radius)||!w.surface!.fits(x,z,radius))continue;
      const lo=Math.min(y,height(x-radius,z),height(x+radius,z),height(x,z-radius),height(x,z+radius)),
        hi=Math.max(y,height(x-radius,z),height(x+radius,z),height(x,z-radius),height(x,z+radius));
      if(hi-lo>.4)continue;
      const part=rand()<.55?'Brush':'Tuft';
      place(part,v,x,lo-.06,z,radius,.34+rand()*.1,habitat>.73?style.bloom:style.leaf,yaw,part==='Brush'?'BRUSH':'LEAF');
      groundRemember(x,z);tufts++;
    }
  }
  // Palette information on the minimap, not a second terrain or visibility map.
  for(let i=0;i<w.gridSize*w.gridSize;i++) {
    const p=w.point(i),zones=ecologyBiotopeAt(style,p.x,p.z,height),meadowColor=ecologyBiotopeColor(style,zones),light=.83+height(p.x,p.z)*.013;
    for(let c=0;c<3;c++) {
      const meadow=meadowColor[c];
      w.terrainColors[i*4+c]=(w.staticGrid[i]?(meadow*.35+style.stone[c]*.65)*.68:meadow)*180*light;
    }
  }
}
