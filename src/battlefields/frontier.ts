/* Frontier v1: seeded route graph first, geology around it. Keep this recipe stable
 * for named designs; a breaking generator change needs a new recipe, not new seeds. */
'use strict';
interface FrontierSettings {
  biome: 'meadow' | 'arid';
  relief: number;
}
function frontierLayout(seed: number): BattlefieldLayout {
  const random = seeded(seed ^ 0x524f5554), jitter = (size: number) => (random()-.5)*size,
    starts = [[-1,1],[1,-1],[-1,-1],[1,1]].map(([x,z]) => ({x:x*56+jitter(10),z:z*56+jitter(10)})) as BattlefieldLayout['startSites'],
    hub = {x:jitter(18),z:jitter(18)},
    resources = [...starts.map(p => ({x:p.x-Math.sign(p.x)*18,z:p.z})),
      ...[[-1,1],[1,-1],[-1,-1],[1,1]].map(([x,z]) => ({x:x*24+jitter(10),z:z*24+jitter(10)}))],
    routes: Position[][] = [];
  const connect = (a: Position,b: Position,bend: number) => {
    const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz)||1;
    routes.push([a,{x:(a.x+b.x)/2-dz/length*bend,z:(a.z+b.z)/2+dx/length*bend},b]);
  };
  for(const start of starts) connect(start,hub,jitter(32));
  // A flank loop gives every base an alternative to its central approach.
  const ring=[starts[0],starts[2],starts[1],starts[3]];
  for(let i=0;i<4;i++) connect(ring[i],ring[(i+1)%4],jitter(18));
  for(const [i,p] of resources.entries()) {
    connect(p,i<4?starts[i]:hub,0);
    connect(p,{x:p.x+(i?7:5),z:p.z+(i?7:18)},0);
  }
  return {startSites:starts,playerStart:starts[0],enemySites:starts.slice(1),resourceSites:resources,
    centralClearings:[hub],outerClearings:[],additionalClearings:[],
    corridors:routes.map(route=>route.map(p=>[p.x,p.z]))};
}
function frontierHeight(layout: BattlefieldLayout, seed: number, relief: number) {
  const {Math}=globalThis, random=seeded(seed^0x47454f4c), angle=random()*Math.PI, frequency=.025+random()*.025,
    phase=random()*Math.PI*2, ridged=random()>.5,
    reserves=[...layout.startSites.map(p=>({...p,r:28})),...layout.resourceSites.map(p=>({...p,r:12})),
      ...layout.resourceSites.map((p,i)=>({x:p.x+(i?7:5),z:p.z+(i?7:18),r:9})),
      ...layout.centralClearings.map(p=>({...p,r:14}))],
    segments=layout.corridors.flatMap(route=>route.slice(1).map(([x,z],i)=>{
      const [ax,az]=route[i],dx=x-ax,dz=z-az;
      return {ax,az,dx,dz,length2:dx*dx+dz*dz||1};
    })),
    hash=(x:number,z:number)=>{
      let h=Math.imul(x,374761393)^Math.imul(z,668265263)^seed;
      h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;
    },
    noise=(x:number,z:number)=>{
      const ix=Math.floor(x),iz=Math.floor(z);let u=x-ix,v=z-iz;
      u=u*u*(3-2*u);v=v*v*(3-2*v);
      return (hash(ix,iz)*(1-u)+hash(ix+1,iz)*u)*(1-v)+(hash(ix,iz+1)*(1-u)+hash(ix+1,iz+1)*u)*v;
    };
  return (x:number,z:number)=>{
    let clearance=10;
    for(const p of reserves) clearance=Math.min(clearance,Math.hypot(x-p.x,z-p.z)-p.r);
    if(clearance<=0) return 0;
    for(const s of segments) {
      const t=Math.max(0,Math.min(1,((x-s.ax)*s.dx+(z-s.az)*s.dz)/s.length2));
      clearance=Math.min(clearance,Math.hypot(x-s.ax-s.dx*t,z-s.az-s.dz*t)-10);
    }
    if(clearance<=0) return 0;
    const u=x*Math.cos(angle)-z*Math.sin(angle),v=x*Math.sin(angle)+z*Math.cos(angle),
      field=noise(x*.04,z*.04),ridge=.5+.5*Math.sin(u*frequency*3+phase+field*3),
      mass=ridged?ridge:noise(u*.033+40,v*.033),
      geology=Math.max(0,(mass-.26)/.74),grade=Math.min(1,clearance/10),
      rim=Math.max(0,Math.min(1,(Math.max(Math.abs(x),Math.abs(z))-78)/12));
    return relief*Math.max(rim*.8,geology)*grade*grade*(3-2*grade)*( .75+noise(x*.09,z*.09)*.25);
  };
}
function createFrontierRecipe(settings: FrontierSettings): BattlefieldDefinition {
  if(!Number.isFinite(settings.relief)||settings.relief<8||settings.relief>32 || !['meadow','arid'].includes(settings.biome))
    throw Error('Unsupported Frontier recipe settings');
  const {biome,relief}=settings, meadow=biome==='meadow';
  return {
    name:'FRONTIER',multiplayer:false,size:{extent:90,cellSize:2.5},layout:standardBattleLayout(),
    createLayout:frontierLayout,startHeight:0,
    palette:meadow?{ground:0x637344,rock:0x828783,accent:0xbad49c,flora:0x355b3a}:
      {ground:0x59443a,rock:0x74544a,accent:0xf0b67b,flora:0x806348},
    render:{groundTexture:meadow?'westmarkMeadow':'ground',skyTexture:'sky',
      rockSurface:{texture:meadow?'westmarkGranite':'desertRock',metersPerTile:meadow?9:18},
      ...(meadow?{upland:true,landscape:{earth:'westmarkEarth' as const,bark:'westmarkBark' as const}}:{}),
      rockDecor:{density:0,opacity:0},shrubDecor:{density:0,opacity:0},haze:[.38,.45,.50],terrainReceiverHeight:relief+(meadow?10:0)},
    worldEvent:null,
    generate(builder) {
      const w=builder.world,height=frontierHeight(w.layout,w.terrainSeed,relief),
        surface=w.surface=new BattlefieldSurface(w.extent,w.cellSize,height),n=w.gridSize;
      // Raised geology is an obstacle, not an inaccessible second playable plateau.
      // Rasterize every triangle touching each nav cell from the very same samples.
      for(let z=0;z<n;z++) for(let x=0;x<n;x++) {
        for(let dz=0;dz<=2;dz++) for(let dx=0;dx<=2;dx++)
          if(surface.heights[(z*2+dz)*surface.size+x*2+dx]>.18) surface.cliffs[z*n+x]=1;
      }
      w.staticGrid.set(surface.cliffs);w.terrainFeatureGrid.set(surface.cliffs);
      builder.ground();
      w.renderData.placements=w.renderData.placements.filter(p=>p.mesh!=='box');
      w.renderData.placements.find(p=>p.mesh==='terrain')!.material='LANDSCAPE';
      // Trail pigment follows the existing graph, never creates a navigable route.
      const segments=w.layout.corridors.flatMap(route=>route.slice(1).map(([x,z],i)=>{
        const [ax,az]=route[i],dx=x-ax,dz=z-az;return {ax,az,dx,dz,length2:dx*dx+dz*dz||1};
      }));
      const trail=(x:number,z:number)=>{
        let d=Infinity;
        for(const s of segments) {
          const t=clamp(((x-s.ax)*s.dx+(z-s.az)*s.dz)/s.length2,0,1);
          d=Math.min(d,Math.hypot(x-s.ax-s.dx*t,z-s.az-s.dz*t));
        }
        const clearing=Math.min(...w.layout.startSites.map(p=>Math.hypot(x-p.x,z-p.z)));
        return clamp((3.8-d)/3.2,0,1)*clamp((clearing-9)/8,0,1);
      };
      const field=(extent:number,step:number,innerExtent=0):WorldRelief=>{
        const size=Math.round(extent*2/step)+3,heights=new Float32Array(size*size),colors=new Float32Array(size*size*3);
        for(let z=0;z<size;z++) for(let x=0;x<size;x++) {
          const wx=(x-1)*step-extent,wz=(z-1)*step-extent,i=z*size+x,
            h=Math.max(Math.abs(wx),Math.abs(wz))<=w.extent?surface.heightAt(wx,wz):height(wx,wz);
          heights[i]=h-.13;
          colors[i*3]=meadow?trail(wx,wz)*clamp(1-h,0,1):0;
          colors[i*3+1]=Math.min(1,h/4);colors[i*3+2]=0;
        }
        return {extent,step,size,heights,colors,innerExtent};
      };
      w.renderData.geometries.push({mesh:'terrain',model:'landscapeRelief',relief:field(w.extent,surface.step)},
        {mesh:'frontierBackdrop',model:'landscapeRelief',relief:field(240,5,w.extent)});
      builder.place('frontierBackdrop',0,0,0,1,1,1,0xffffff,0,0,0,0,1,'static','LANDSCAPE');
      // Bounded, independent scenery. Large rocks stay completely inside existing blockers.
      const decor=builder.cosmeticRandom(0x53434154);
      if(!meadow) for(let i=0;i<240;i++) {
        const x=(decor()-.5)*172,z=(decor()-.5)*172,r=.6+decor()*1.2,h=surface.heightAt(x,z);
        if(h<2||surface.fits(x,z,r+3)) continue;
        const cell=w.idx(x,z),cx=cell%n,cz=Math.floor(cell/n);
        if(cx<1||cz<1||cx>=n-1||cz>=n-1)continue;
        let embedded=true;
        for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++) if(!w.staticGrid[(cz+dz)*n+cx+dx])embedded=false;
        if(!embedded)continue;
        builder.place('rockBoulder',x,h-.3,z,r,1+decor()*2,r,builder.palette.rock,decor()*6.28,0,0,0,1,'static','ROCK');
      }
      if(meadow) frontierMeadowScenery(builder,trail);
      // Fail a broken recipe explicitly rather than silently rerolling or clearing collision.
      for(const route of w.layout.corridors) for(let i=1;i<route.length;i++) {
        const [ax,az]=route[i-1],[bx,bz]=route[i];
        if(!surface.segment({x:ax,z:az},{x:bx,z:bz},2.5)) throw Error('Frontier route lacks vehicle clearance');
      }
      battlefieldStartSites(w);
    }
  };
}
// Presentation-only habitat rules: full rock/crown envelopes stay in existing
// blocked cells; low groundcover is traversable. No writes to terrain or simulation RNG.
function frontierMeadowScenery(builder: BattlefieldBuilder, trail: (x:number,z:number)=>number) {
  const w=builder.world,surface=w.surface!,random=builder.cosmeticRandom(0x554c414e),n=w.gridSize;
  for(let variant=0;variant<3;variant++) for(const family of ['Stone','Trunk','Crown','Grass'])
    w.renderData.geometries.push({mesh:`upland${family}${variant}`,model:`upland${family}`,seed:173+variant*7919,extent:0});
  const blocked=(x:number,z:number,r:number)=>{
    if(Math.max(Math.abs(x),Math.abs(z))+r>w.extent-2)return false;
    const lo=w.idx(x-r,z-r),hi=w.idx(x+r,z+r);
    for(let row=Math.floor(lo/n);row<=Math.floor(hi/n);row++)for(let col=lo%n;col<=hi%n;col++)
      if(!w.staticGrid[row*n+col])return false;
    return true;
  };
  const place=(family:string,variant:number,x:number,y:number,z:number,r:number,h:number,yaw:number,
    material:NonNullable<WorldPlacement['material']>,color=0xffffff)=>
    builder.place(`upland${family}${variant}`,x,y,z,r,h,r,color,yaw,0,0,0,1,'static',material);
  const trees:Position[]=[];
  let stones=0,grass=0;
  for(let i=0;i<2600;i++) {
    const x=(random()-.5)*174,z=(random()-.5)*174,choice=random(),variant=Math.floor(random()*3),
      r=1.4+random()*1.7,yaw=random()*Math.PI*2,h=surface.heightAt(x,z),
      patch=Math.sin(x*.091+Math.sin(z*.07)*2)+Math.cos(z*.113-x*.041);
    if(h>.6&&blocked(x,z,r+.25)) {
      const samples=[surface.heightAt(x-r,z),surface.heightAt(x+r,z),surface.heightAt(x,z-r),surface.heightAt(x,z+r)],
        lo=Math.min(...samples),hi=Math.max(...samples);
      if(choice<.7&&trees.length<60&&patch>-.4&&hi-lo<5&&h<16&&trees.every(p=>Math.hypot(x-p.x,z-p.z)>4.5)) {
        const height=5.5+random()*3;
        place('Trunk',variant,x,h-.25,z,r,height,yaw,'BARK');
        place('Crown',variant,x,h-.25,z,r,height,yaw,'LEAF');
        trees.push({x,z});
      } else if(stones<96&&hi-lo<2.8) {
        place('Stone',variant,x,lo-.4,z,r,1.2+r*.5+hi-lo,yaw,'ROCK',0xa4a58a);stones++;
      }
    } else if(grass<400&&h===0&&!w.staticGrid[w.idx(x,z)]&&patch>.1&&trail(x,z)<.08&&
      surface.heightAt(x-1.4,z)===0&&surface.heightAt(x+1.4,z)===0&&
      surface.heightAt(x,z-1.4)===0&&surface.heightAt(x,z+1.4)===0&&
      w.layout.startSites.every(p=>Math.hypot(x-p.x,z-p.z)>12)&&
      w.layout.resourceSites.every((p,i)=>Math.hypot(x-p.x,z-p.z)>10&&Math.hypot(x-p.x-(i?7:5),z-p.z-(i?7:18))>7)) {
      place('Grass',variant,x,-.12,z,.8+random()*.6,.24+random()*.24,yaw,'LEAF');grass++;
    }
  }
}
const FRONTIER_BATTLEFIELD=battlefieldDesign(createFrontierRecipe({biome:'meadow',relief:24}),'FRONTIER',
  {atmosphere:{timeOfDay:'seeded'}});
// A permanent catalog design from exactly the same system; encounter seeds still
// control teams, economy and effects. The pinned landscape and dusk stay independent.
const HAVEN_BATTLEFIELD=battlefieldDesign(createFrontierRecipe({biome:'arid',relief:18}),'HAVEN',
  {terrainSeed:40517,atmosphere:{timeOfDay:18.5,materialSeed:40517}});
