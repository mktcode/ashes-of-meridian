/* Frontier v2: walkable landforms, local building terraces and seeded dimensions.
 * A separate recipe keeps Frontier-v1 designs (notably Haven) intact. */
'use strict';
type HighlandForm = 'rolling' | 'basin' | 'ridge';
interface HighlandSettings { extent?: 90 | 115 | 140; landform?: HighlandForm; }
function highlandParameters(seed:number, settings:HighlandSettings={}) {
  const random=seeded(seed^0x48494748),extent=([90,115,140] as const)[Math.floor(random()*3)],
    landform=(['rolling','basin','ridge'] as const)[Math.floor(random()*3)];
  return {extent:settings.extent??extent,landform:settings.landform??landform};
}
function highlandLayout(seed:number, extent:number, form:HighlandForm):BattlefieldLayout {
  const random=seeded(seed^0x48524f55),jitter=(span:number)=>(random()-.5)*span,
    starts=[[-1,1],[1,-1],[-1,-1],[1,1]].map(([x,z])=>({x:x*(extent-34)+jitter(6),z:z*(extent-34)+jitter(6)})) as BattlefieldLayout['startSites'],
    resources=[...starts.map(p=>({x:p.x-Math.sign(p.x)*18,z:p.z})),
      ...[[1,0],[0,-1],[-1,0],[0,1]].map(([x,z])=>({x:x*extent*.30+jitter(4),z:z*extent*.30+jitter(4)}))],
    hubs=form==='rolling'?[{x:jitter(16),z:jitter(16)}]:form==='basin'?
      [{x:-extent*.22,z:jitter(10)},{x:extent*.22,z:jitter(10)}]:
      [{x:jitter(10),z:-extent*.22},{x:jitter(10),z:extent*.22}],
    routes:Position[][]=[],nearest=(p:Position)=>hubs.reduce((a,b)=>distance(p,a)<distance(p,b)?a:b),
    connect=(a:Position,b:Position,bend:number)=>{
      const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz)||1;
      routes.push([a,{x:(a.x+b.x)/2-dz/length*bend,z:(a.z+b.z)/2+dx/length*bend},b]);
    };
  for(const p of starts)connect(p,nearest(p),jitter(18));
  if(hubs.length===2)connect(hubs[0],hubs[1],jitter(12));
  const ring=[starts[0],starts[2],starts[1],starts[3]];
  for(let i=0;i<4;i++)connect(ring[i],ring[(i+1)%4],jitter(12));
  for(const [i,p] of resources.entries()) {
    connect(p,i<4?starts[i]:nearest(p),0);
    connect(p,{x:p.x+(i?7:5),z:p.z+(i?7:18)},0);
  }
  return {startSites:starts,playerStart:starts[0],enemySites:starts.slice(1),resourceSites:resources,
    centralClearings:hubs,outerClearings:[],additionalClearings:[],corridors:routes.map(r=>r.map(p=>[p.x,p.z]))};
}
function highlandPlan(layout:BattlefieldLayout, seed:number, extent:number, form:HighlandForm) {
  const random=seeded(seed^0x48454c46),angle=random()*Math.PI,phase=random()*Math.PI*2,cs=Math.cos(angle),sn=Math.sin(angle),
    datum=(x:number,z:number)=>6+2*Math.sin((x*cs+z*sn)/(extent*.8)+phase),
    pads=[...layout.startSites.map(p=>({...p,r:31,y:datum(p.x,p.z)})),
      ...layout.resourceSites.slice(0,4).map((p,i)=>({x:p.x+(i?7:5),z:p.z+(i?7:18),r:9,
        y:datum(layout.startSites[i].x,layout.startSites[i].z)})),
      ...layout.resourceSites.slice(4).flatMap(p=>{
        const y=datum(p.x,p.z);return [{...p,r:11,y},{x:p.x+7,z:p.z+7,r:9,y}];
      })],
    segments=layout.corridors.flatMap(route=>route.slice(1).map(([x,z],i)=>{
      const [ax,az]=route[i],dx=x-ax,dz=z-az;return {ax,az,dx,dz,length2:dx*dx+dz*dz||1};
    })),
    masses=Array.from({length:18},()=>({x:(random()-.5)*extent*1.9,z:(random()-.5)*extent*1.9,
      rx:8+random()*13,rz:8+random()*13,height:5+random()*9})),
    road=(x:number,z:number)=>{
      let d=Infinity;
      for(const s of segments) {
        const t=clamp(((x-s.ax)*s.dx+(z-s.az)*s.dz)/s.length2,0,1);
        d=Math.min(d,Math.hypot(x-s.ax-s.dx*t,z-s.az-s.dz*t));
      }
      return d;
    };
  // Compatible flat cores, connected by bounded ramps. Clamping against cones
  // preserves the raw field's slope bound; no smoothing/clearing after collision.
  for(let i=0;i<pads.length;i++)for(let j=i+1;j<pads.length;j++) {
    const a=pads[i],b=pads[j];
    if(Math.abs(a.y-b.y)>.28*Math.max(0,distance(a,b)-a.r-b.r)+1e-7)
      throw Error('Highland terraces have incompatible elevations');
  }
  const ground=(x:number,z:number)=>{
    const u=x*cs-z*sn,v=x*sn+z*cs;
    let h=form==='rolling'?10+7*Math.sin(u*Math.PI*1.1/extent+phase)*Math.cos(v*Math.PI*.7/extent+phase*.4)+2*Math.cos(v*.025+phase):
      form==='basin'?3+16*(1-Math.exp(-(u*u+v*v)/(extent*.72)**2))+2*Math.sin(v*.02+phase):
      6+14*Math.exp(-(((u+Math.sin(v*.02+phase)*extent*.09)/(extent*.36))**2))+2*Math.sin(v*.02+phase);
    for(const p of pads) {
      const rise=.28*Math.max(0,Math.hypot(x-p.x,z-p.z)-p.r);
      h=clamp(h,p.y-rise,p.y+rise);
    }
    return Math.max(.25,h);
  };
  const outcrop=(x:number,z:number)=>{
    let clearance=road(x,z)-10;
    for(const p of pads)clearance=Math.min(clearance,Math.hypot(x-p.x,z-p.z)-p.r-4);
    if(clearance<=0)return 0;
    let rock=0;
    for(const p of masses) {
      const d=((x-p.x)/p.rx)**2+((z-p.z)/p.rz)**2;
      if(d<1)rock=Math.max(rock,p.height*(1-d)**2);
    }
    const rim=clamp((Math.max(Math.abs(x),Math.abs(z))-extent+8)/18,0,1),t=clamp(clearance/8,0,1);
    return Math.max(rock,rim*(14+3*Math.sin(x*.032+z*.041+phase)))*t*t*(3-2*t);
  };
  return {pads,ground,outcrop,height:(x:number,z:number)=>ground(x,z)+outcrop(x,z),
    trail:(x:number,z:number)=>clamp((3.8-road(x,z))/3.2,0,1)*
      clamp((Math.min(...layout.startSites.map(p=>Math.hypot(x-p.x,z-p.z)))-9)/8,0,1)};
}
function createHighlandRecipe(settings:HighlandSettings={}):BattlefieldDefinition {
  if(settings.extent!==undefined&&![90,115,140].includes(settings.extent) ||
    settings.landform!==undefined&&!['rolling','basin','ridge'].includes(settings.landform))throw Error('Unsupported Highland recipe settings');
  const options={...settings},base=createFrontierRecipe({biome:'meadow',relief:24});
  return {...base,startHeight:'local',
    createSize:seed=>({extent:highlandParameters(seed,options).extent,cellSize:2.5}),
    createLayout:(seed,size)=>highlandLayout(seed,size.extent,highlandParameters(seed,options).landform),
    render:{...base.render,terrainReceiverHeight:48},
    generate(builder) {
      const w=builder.world,plan=highlandPlan(w.layout,w.terrainSeed,w.extent,highlandParameters(w.terrainSeed,options).landform),
        n=w.gridSize,step=w.cellSize/2,sampleSize=n*2+1,rock=new Float32Array(sampleSize*sampleSize),
        s=w.surface=new BattlefieldSurface(w.extent,w.cellSize,(x,z)=>{
          const stone=plan.outcrop(x,z),col=Math.round((x+w.extent)/step),row=Math.round((z+w.extent)/step);
          rock[row*sampleSize+col]=stone;return plan.ground(x,z)+stone;
        });
      // Only rock outcrops are wholly blocking. Ordinary elevated meadow stays walkable.
      for(let z=0;z<n;z++)for(let x=0;x<n;x++)for(let dz=0;dz<=2;dz++)for(let dx=0;dx<=2;dx++)
        if(rock[(z*2+dz)*s.size+x*2+dx]>.12)s.cliffs[z*n+x]=1;
      w.staticGrid.set(s.cliffs);w.terrainFeatureGrid.set(s.cliffs);
      builder.ground();
      w.renderData.placements=w.renderData.placements.filter(p=>p.mesh!=='box');
      w.renderData.placements.find(p=>p.mesh==='terrain')!.material='LANDSCAPE';
      const field=(extent:number,step:number,innerExtent=0):WorldRelief=>{
        const size=Math.round(extent*2/step)+3,heights=new Float32Array(size*size),colors=new Float32Array(size*size*3);
        for(let z=0;z<size;z++)for(let x=0;x<size;x++) {
          const wx=(x-1)*step-extent,wz=(z-1)*step-extent,i=z*size+x,
            within=Math.max(Math.abs(wx),Math.abs(wz))<=w.extent,
            source=within?Math.round((wz+w.extent)/s.step)*s.size+Math.round((wx+w.extent)/s.step):-1,
            stone=source>=0?rock[source]:plan.outcrop(wx,wz),
            h=source>=0?s.heights[source]:plan.ground(wx,wz)+stone;
          heights[i]=h-.13;colors[i*3]=plan.trail(wx,wz)*clamp(1-stone,0,1);colors[i*3+1]=clamp(stone/4,0,1);
        }
        return {extent,step,size,heights,colors,innerExtent};
      };
      w.renderData.geometries.push({mesh:'terrain',model:'landscapeRelief',relief:field(w.extent,s.step)},
        {mesh:'frontierBackdrop',model:'landscapeRelief',relief:field(w.extent+150,5,w.extent)});
      builder.place('frontierBackdrop',0,0,0,1,1,1,0xffffff,0,0,0,0,1,'static','LANDSCAPE');
      // A small local height spread embeds low tufts on gentle slopes, not just y=0.
      frontierMeadowScenery(builder,plan.trail,{treeLine:32,groundcover:(x,z)=>{
        const heights=[s.heightAt(x,z),s.heightAt(x-1.4,z),s.heightAt(x+1.4,z),s.heightAt(x,z-1.4),s.heightAt(x,z+1.4)];
        return Math.max(...heights)-Math.min(...heights)<.22?Math.min(...heights):null;
      }});
      for(const route of w.layout.corridors)for(let i=1;i<route.length;i++) {
        const [ax,az]=route[i-1],[bx,bz]=route[i];
        if(!s.segment({x:ax,z:az},{x:bx,z:bz},2.5))throw Error('Highland route lacks vehicle clearance');
      }
      battlefieldStartSites(w);
      // Height shading also makes the CPU minimap describe the actual landscape.
      for(let i=0;i<w.staticGrid.length;i++) {
        const p=w.point(i),shade=.76+s.heightAt(p.x,p.z)*.021;
        for(let c=0;c<3;c++)w.terrainColors[i*4+c]*=shade;
      }
    }
  };
}
const FRONTIER_BATTLEFIELD=battlefieldDesign(createHighlandRecipe(),'FRONTIER',{atmosphere:{timeOfDay:'seeded'}});
