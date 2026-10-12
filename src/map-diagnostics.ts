/* Viewer-only, read-only analysis of the final CPU surface. No generation or RNG.
 * Geometry is sampled once per world; drawing only projects cached annotations. */
'use strict';
type MapDiagnosticPoint = [number, number, number];
type MapDiagnosticLayer = 'connections' | 'cliffs' | 'foundations' | 'economy' | 'starts';
const MAP_DIAGNOSTIC_LAYERS: readonly MapDiagnosticLayer[] = ['connections','cliffs','foundations','economy','starts'];

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
  const landings=Object.entries(anchors).filter(([name])=>name!=='world').map(([name,p])=>({name,...p,
    nearestEconomyDistance:battlefieldEconomyDistance(world,p)}));
  const report={schema:1,map,seed:world.seed,terrainSeed:world.terrainSeed,
    family:world.definition.family.id,recipe:world.renderProfile.variation?.id ?? null,
    size:{width:world.extent*2,cellSize:world.cellSize,gridSize:n},height:{min,max:surface.maxHeight},
    cliffs:{cells:surface.cliffs.reduce((sum,v)=>sum+Number(!!v),0),fraction:surface.cliffs.reduce((sum,v)=>sum+Number(!!v),0)/(n*n)},
    broad:{radius:TERRAIN_ROUTE_RADIUS,...regionSummary(broad.groups),interiorCoverage:coverage.fraction,sectorCoverage:coverage.sectors},
    vehicle:{radius:2.6,...regionSummary(vehicle.groups)},
    economy:{regions:world.layout.economyRegions.length,anchors: economyAccess.length,
      accessibleAnchors:economyAccess.filter(Boolean).length,broadHubs:broadHubs.filter(Boolean).length},
    hqSample:{spacing:stride*world.cellSize,radius,tested:foundations.length,suitable:foundations.filter(p=>p.suitable).length},
    deployment:{candidates:world.startSites.length,landings},warnings,
    limitations:['Final terrain only; no dynamic traffic, walling or balance proof.',
      'HQ suitability is sampled and terrain-only, ignoring resources, occupancy, costs and visibility.',
      'Corridors are the planned economic network, not actual paths or repair-ramp locations.',
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
  return {report,mainPaths,detachedPaths,cliffPaths,foundations,corridors,economy,
    candidates:world.startSites.map(p=>point(p.x,p.z)),landings:landings.map(p=>({name:p.name,point:point(p.x,p.z)}))};
}

class MeridianMapDiagnostics {
  enabled=false;
  readonly layers:Record<MapDiagnosticLayer,boolean>={connections:true,cliffs:false,foundations:false,economy:false,starts:false};
  private world?:Battlefield;
  data?:ReturnType<typeof analyzeMapDiagnostics>;
  invalidate() { this.world=undefined; this.data=undefined; }
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
    if (this.layers.cliffs) fill(data.cliffPaths,'#fa637c88');
    if (this.layers.foundations) for (const sample of data.foundations)
      marker(sample.point,sample.suitable?'#b6ef66':'#f57a8c',sample.suitable?3:2);
    if (this.layers.economy) {
      ctx.beginPath(); for (const route of data.corridors) path(route);
      ctx.strokeStyle='#06101e';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle='#65ddff';ctx.lineWidth=2;ctx.stroke();
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
}
