/* Viewer-only, read-only analysis of the final CPU surface. No generation or RNG.
 * Geometry is sampled once per world; drawing only projects cached annotations. */
'use strict';
type MapDiagnosticPoint = [number, number, number];
type MapDiagnosticLayer = 'connections' | 'cliffs' | 'foundations' | 'economy' | 'starts' | 'links' | 'changes';
const MAP_DIAGNOSTIC_LAYERS: readonly MapDiagnosticLayer[] = ['connections','cliffs','foundations','economy','starts','links','changes'];

function analyzeMapDiagnostics(world: Battlefield, map: string, anchors: Record<string, Position>) {
  const surface = world.surface!;
  const broad = battlefieldTerrainRegions(surface), vehicle = battlefieldTerrainRegions(surface, 2.6),
    coverage = battlefieldTerrainCoverage(surface, broad), n = world.gridSize,
    broadMain = new Uint8Array(n*n), vehicleMain = new Uint8Array(n*n);
  for (const i of broad.groups[0] ?? []) broadMain[i] = 1;
  for (const i of vehicle.groups[0] ?? []) vehicleMain[i] = 1;
  const point = (x: number, z: number): MapDiagnosticPoint => [x,surface.heightAt(x,z)+.2,z];
  // Row strips retain exact cell boundaries; extra edge samples follow relief.
  // This avoids projecting four corners for every cell of a large open plain.
  const strips = (included: (i: number) => boolean): MapDiagnosticPoint[][] => {
    const paths: MapDiagnosticPoint[][] = [], cell = world.cellSize, e = world.extent;
    for (let row=0;row<n;row++) for (let x=0;x<n;) {
      if (!included(row*n+x)) { x++; continue; }
      const start=x;
      while (x<n && included(row*n+x)) x++;
      const left=start*cell-e, right=x*cell-e, z=row*cell-e,
        steps=Math.max(1,Math.ceil((right-left)/8)), path: MapDiagnosticPoint[]=[];
      for (let j=0;j<=steps;j++) path.push(point(left+(right-left)*j/steps,z));
      for (let j=steps;j>=0;j--) path.push(point(left+(right-left)*j/steps,z+cell));
      paths.push(path);
    }
    return paths;
  };
  const mainPaths=strips(i=>!!broadMain[i]), detachedPaths=strips(i=>!!broad.free[i]&&!broadMain[i]),
    cliffPaths=strips(i=>!!surface.cliffs[i]);
  const plan=world.corridorPlan,reference=plan?.straightReference(),changes=new Float32Array(n*n),
    measure=()=>({sampledCutVolume:0,sampledFillVolume:0,sampledAbsoluteVolume:0,maxAbsoluteChange:0,changedCells:0}),
    modified=measure(),straightModified=measure(),area=world.cellSize**2,
    update=(m:ReturnType<typeof measure>,d:number)=>{
      m.sampledCutVolume+=Math.max(0,-d)*area;m.sampledFillVolume+=Math.max(0,d)*area;
      m.sampledAbsoluteVolume+=Math.abs(d)*area;m.maxAbsoluteChange=Math.max(m.maxAbsoluteChange,Math.abs(d));
      if(Math.abs(d)>.5)m.changedCells++;
    };
  if(plan&&reference)for(let i=0;i<n*n;i++) {
    const p=world.point(i),before=plan.before(p.x,p.z),d=surface.heightAt(p.x,p.z)-before;
    changes[i]=d;update(modified,d);update(straightModified,reference(p.x,p.z)-before);
  }
  const cutPaths=plan?strips(i=>changes[i]<-.5):[],fillPaths=plan?strips(i=>changes[i]>.5):[],
    sampleRoutes=(routes:[number,number][][])=>routes.map(route=>{
      const samples:{x:number;z:number;distance:number}[]=[];let along=0;
      for(let j=1;j<route.length;j++) {
        const [ax,az]=route[j-1],[bx,bz]=route[j],length=Math.hypot(bx-ax,bz-az),steps=Math.max(1,Math.ceil(length/5));
        for(let i=0;i<steps;i++)samples.push({x:ax+(bx-ax)*i/steps,z:az+(bz-az)*i/steps,distance:along+length*i/steps});
        along+=length;
      }
      const last=route[route.length-1];if(last)samples.push({x:last[0],z:last[1],distance:along});
      return samples;
    }),routeSamples=sampleRoutes(world.layout.corridors),
    profiles=routeSamples.map((samples,index)=>{
      const route=world.layout.corridors[index],first=route[0],last=route[route.length-1],
        direct=first&&last?Math.hypot(last[0]-first[0],last[1]-first[1]):0,length=samples.at(-1)?.distance??0,
        heights=samples.map(p=>({...p,before:plan?.before(p.x,p.z)??null,planned:plan?.height(p.x,p.z)??null,final:surface.heightAt(p.x,p.z)})),
        maxSampledGrade=heights.slice(1).reduce((max,p,i)=>Math.max(max,Math.abs(p.final-heights[i].final)/(p.distance-heights[i].distance||1)),0);
      return {index,straightLength:direct,length,detourRatio:direct?length/direct:1,maxSampledGrade,
        coreClear:battlefieldCorridorsClear(surface,[route]),points:route.map(p=>[...p]),samples:heights};
    }),originalLinks=sampleRoutes(plan?.links??world.layout.corridorLinks??world.layout.corridors)
      .map(samples=>samples.map(p=>point(p.x,p.z))),
    corridorReport={links:profiles.length,expandedNodes:plan?.expandedNodes??null,repairs:plan?.repairs??null,
      searchPasses:plan?.searchPasses??null,lengthConstrainedRoutes:plan?.lengthConstrainedRoutes??null,profileAxisGrade:plan?.profileAxisGrade??null,
      originalLinks:(plan?.links??world.layout.corridorLinks??world.layout.corridors).map(route=>route.map(p=>[...p])),
      meanDetour:profiles.length?profiles.reduce((sum,p)=>sum+p.detourRatio,0)/profiles.length:1,
      allCoresClear:profiles.every(p=>p.coreClear),routes:profiles,
      modification:plan?{sampleSpacing:world.cellSize,threshold:.5,changedFraction:modified.changedCells/(n*n),...modified,
        reference:'Economically supported terrain before corridors; includes final connectivity repairs.',
        straightDatumReference:{...straightModified,changedFraction:straightModified.changedCells/(n*n),
          limitation:'Straight datum-fit with current economic supports, before connectivity repairs; not a regenerated previous-version world.'}}:null};
  const foundations: {point:MapDiagnosticPoint;suitable:boolean}[] = [], stride=4, radius=BUILDINGS.hq.size;
  for (let z=stride;z<n-stride;z+=stride) for (let x=stride;x<n-stride;x+=stride) {
    const p=world.point(z*n+x);
    foundations.push({point:point(p.x,p.z),suitable:surface.foundation(p,radius)});
  }
  const economyAccess=world.layout.economyRegions.flatMap(region=>[region.center,region.vent,...region.crystals])
    .map(p=>!!vehicleMain[world.idx(p.x,p.z)]&&surface.segment(p,world.point(world.idx(p.x,p.z)),2.6));
  const broadHubs=world.layout.economyRegions.map(({center:p})=>
    !!broadMain[world.idx(p.x,p.z)]&&surface.segment(p,world.point(world.idx(p.x,p.z)),TERRAIN_ROUTE_RADIUS));
  const regionSummary=(groups:number[][])=>{
    const walkableCells=groups.reduce((sum,g)=>sum+g.length,0), mainCells=groups[0]?.length ?? 0;
    return {components:groups.length,walkableCells,mainCells,largestShare:walkableCells ? mainCells/walkableCells : 0};
  };
  const min=surface.heights.reduce((a,b)=>Math.min(a,b),Infinity), warnings:string[]=[];
  if (coverage.fraction<.55 || coverage.sectors.some(p=>p<.25)) warnings.push('Broad interior coverage is below the generator contract.');
  if (regionSummary(broad.groups).largestShare<.94 || broad.groups.slice(1).some(g=>g.length>=64))
    warnings.push('Significant broad terrain remains disconnected.');
  if (!economyAccess.every(Boolean) || !broadHubs.every(Boolean)) warnings.push('Some economic anchors lack terrain access.');
  if(!corridorReport.allCoresClear)warnings.push('Some resolved economic corridors lack radius-6 surface clearance.');
  const landings=Object.entries(anchors).filter(([name])=>name!=='world').map(([name,p])=>({name,...p,
    nearestEconomyDistance:battlefieldEconomyDistance(world,p)}));
  const report={schema:2,map,seed:world.seed,terrainSeed:world.terrainSeed,
    family:world.definition.family.id,recipe:world.renderProfile.variation?.id ?? null,
    size:{width:world.extent*2,cellSize:world.cellSize,gridSize:n},height:{min,max:surface.maxHeight},
    cliffs:{cells:surface.cliffs.reduce((sum,v)=>sum+Number(!!v),0),fraction:surface.cliffs.reduce((sum,v)=>sum+Number(!!v),0)/(n*n)},
    broad:{radius:TERRAIN_ROUTE_RADIUS,...regionSummary(broad.groups),interiorCoverage:coverage.fraction,sectorCoverage:coverage.sectors},
    vehicle:{radius:2.6,...regionSummary(vehicle.groups)},
    economy:{regions:world.layout.economyRegions.length,anchors: economyAccess.length,
      accessibleAnchors:economyAccess.filter(Boolean).length,broadHubs:broadHubs.filter(Boolean).length},
    hqSample:{spacing:stride*world.cellSize,radius,tested:foundations.length,suitable:foundations.filter(p=>p.suitable).length},
    deployment:{candidates:world.startSites.length,landings},corridors:corridorReport,warnings,
    limitations:['Final terrain only; no dynamic traffic, walling or balance proof.',
      'HQ suitability is sampled and terrain-only, ignoring resources, occupancy, costs and visibility.',
      'Corridors are resolved economic routes, not actual paths or repair-ramp locations.',
      'Terrain-change volumes and longitudinal grades are sampled estimates, not exact earthworks or maximum triangle slopes.',
      'Landing distances are straight-line distances in the viewer two-party context, not fairness scores.',
      'Annotations are visible through terrain and decoration.']};
  const corridors=world.layout.corridors.map(route=>{
    const path:MapDiagnosticPoint[]=[];
    for (let j=1;j<route.length;j++) {
      const [ax,az]=route[j-1],[bx,bz]=route[j], steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/5));
      for (let i=0;i<steps;i++) path.push(point(ax+(bx-ax)*i/steps,az+(bz-az)*i/steps));
    }
    const last=route[route.length-1]; path.push(point(last[0],last[1])); return path;
  });
  const economy=world.layout.economyRegions.map(r=>({center:point(r.center.x,r.center.z),vent:point(r.vent.x,r.vent.z),
    hq:point(r.hq.x,r.hq.z),crystals:r.crystals.map(p=>point(p.x,p.z))}));
  return {report,mainPaths,detachedPaths,cliffPaths,foundations,corridors,economy,originalLinks,cutPaths,fillPaths,profiles,
    candidates:world.startSites.map(p=>point(p.x,p.z)),landings:landings.map(p=>({name:p.name,point:point(p.x,p.z)}))};
}

class MeridianMapDiagnostics {
  enabled=false;
  selectedRoute=0;
  readonly layers:Record<MapDiagnosticLayer,boolean>={connections:true,cliffs:false,foundations:false,economy:false,starts:false,links:false,changes:false};
  private world?:Battlefield;
  data?:ReturnType<typeof analyzeMapDiagnostics>;
  invalidate() { this.world=undefined; this.data=undefined;this.selectedRoute=0; }
  analyze(world:Battlefield,map:string,anchors:Record<string,Position>) {
    if (this.world!==world || !this.data) {
      this.invalidate();
      const data=analyzeMapDiagnostics(world,map,anchors);
      this.world=world; this.data=data;
    }
    this.enabled=true;
    return this.data!;
  }
  draw(ctx:CanvasRenderingContext2D,project:(x:number,y:number,z:number)=>{x:number;y:number}|null) {
    const data=this.data;
    if (!this.enabled || !data) return;
    const projected=(point:MapDiagnosticPoint)=>{
      const p=project(...point); return p&&Number.isFinite(p.x)&&Number.isFinite(p.y) ? p : null;
    };
    const projectedPath:{x:number;y:number}[]=[];
    const path=(points:MapDiagnosticPoint[],closed=false)=>{
      if (closed) {
        projectedPath.length=0;
        for (const point of points) {
          const p=projected(point);if (!p) return;
          projectedPath.push(p);
        }
        for (let i=0;i<projectedPath.length;i++) {
          const p=projectedPath[i];if (i) ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);
        }
        ctx.closePath();return;
      }
      let connected=false;
      for (const point of points) {
        const p=projected(point);
        if (!p) {connected=false;continue;}
        if (connected) ctx.lineTo(p.x,p.y); else ctx.moveTo(p.x,p.y);
        connected=true;
      }
    };
    const fill=(paths:MapDiagnosticPoint[][],color:string)=>{
      ctx.beginPath(); for (const points of paths) path(points,true);
      ctx.fillStyle=color; ctx.fill();
    };
    const marker=(point:MapDiagnosticPoint,color:string,radius:number,label?:string)=>{
      const p=projected(point); if (!p) return;
      ctx.beginPath(); ctx.arc(p.x,p.y,radius,0,Math.PI*2); ctx.fillStyle=color; ctx.fill();
      ctx.strokeStyle='#071522'; ctx.lineWidth=1; ctx.stroke();
      if (label) {ctx.font='bold 12px sans-serif';ctx.lineWidth=3;ctx.strokeText(label,p.x+radius+3,p.y+4);ctx.fillText(label,p.x+radius+3,p.y+4);}
    };
    ctx.save(); ctx.globalAlpha=1; ctx.setLineDash([]); ctx.lineJoin='round';
    if (this.layers.connections) {fill(data.mainPaths,'#50dfaa55');fill(data.detachedPaths,'#ffad5277');}
    if (this.layers.changes) {fill(data.cutPaths,'#ff945877');fill(data.fillPaths,'#b69aff77');}
    if (this.layers.cliffs) fill(data.cliffPaths,'#fa637c88');
    if (this.layers.links) {
      ctx.setLineDash([6,5]);ctx.beginPath();for(const route of data.originalLinks)path(route);
      ctx.strokeStyle='#ffffffaa';ctx.lineWidth=2;ctx.stroke();ctx.setLineDash([]);
    }
    if (this.layers.foundations) for (const sample of data.foundations)
      marker(sample.point,sample.suitable?'#b6ef66':'#f57a8c',sample.suitable?3:2);
    if (this.layers.economy) {
      ctx.beginPath(); for (const route of data.corridors) path(route);
      ctx.strokeStyle='#06101e';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle='#65ddff';ctx.lineWidth=2;ctx.stroke();
      const selected=data.corridors[this.selectedRoute];if(selected){ctx.beginPath();path(selected);ctx.strokeStyle='#ffdb69';ctx.lineWidth=3;ctx.stroke();}
      for (const region of data.economy) {
        marker(region.center,'#65ddff',5);marker(region.vent,'#d69aff',5,'Echo');marker(region.hq,'#fff4b6',4,'HQ anchor');
        for (const p of region.crystals) marker(p,'#65ddff',2);
      }
    }
    if (this.layers.starts) {
      for (const p of data.candidates) marker(p,'#e8f0ff',2);
      for (const p of data.landings) marker(p.point,'#ffdb69',7,p.name);
    }
    ctx.restore();
  }
  drawProfile(ctx:CanvasRenderingContext2D) {
    const profile=this.data?.profiles[this.selectedRoute],w=ctx.canvas.width,h=ctx.canvas.height;
    ctx.clearRect(0,0,w,h);if(!profile?.samples.length)return;
    const values=profile.samples.flatMap(p=>[p.before,p.planned,p.final]).filter((v):v is number=>v!==null),
      low=Math.min(...values),high=Math.max(...values),padding=Math.max(0,(1-(high-low))/2),
      min=low-padding,max=high+padding,range=max-min,left=48,top=40,bottom=h-24,right=w-12,
      xy=(distance:number,height:number)=>({x:left+distance/(profile.length||1)*(right-left),y:bottom-(height-min)/range*(bottom-top)});
    ctx.fillStyle='#0b1522';ctx.fillRect(0,0,w,h);ctx.font='12px sans-serif';ctx.fillStyle='#eef3ed';
    ctx.fillText(`Link ${profile.index+1} · ${profile.length.toFixed(1)} units · ${profile.detourRatio.toFixed(2)}× straight distance`,10,16);
    ctx.fillText(max.toFixed(1),4,top+5);ctx.fillText(min.toFixed(1),4,bottom);
    ctx.fillText('0',left,bottom+18);ctx.fillText(profile.length.toFixed(0),right-24,bottom+18);
    ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(left,bottom);ctx.lineTo(right,bottom);ctx.strokeStyle='#7796a7';ctx.lineWidth=1;ctx.stroke();
    for(const [key,color,label,x]of [['before','#ff9458','pre-corridor',10],['planned','#65ddff','planned',140],['final','#eef3ed','final CPU',240]] as const) {
      if(!profile.samples.some(p=>p[key]!==null))continue;
      ctx.fillStyle=color;ctx.fillText(label,x,32);ctx.beginPath();let started=false;
      for(const p of profile.samples) {
        const height=p[key];if(height===null){started=false;continue;}const q=xy(p.distance,height);
        if(started)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);started=true;
      }
      ctx.strokeStyle=color;ctx.lineWidth=key==='final'?1:2;ctx.stroke();
    }
  }
}
