/* Generation-only terrain-aware economic links. A shared bounded-grade target
 * gives intersections one height; only corridor shoulders change the input field. */
'use strict';
interface BattlefieldCorridorPlan {
  links: [number,number][][];
  corridors: [number,number][][];
  before: BattlefieldHeightField;
  height: BattlefieldHeightField;
  straightReference: () => BattlefieldHeightField;
  expandedNodes: number;
  repairs: number;
  searchPasses: number;
  lengthConstrainedRoutes: number;
  profileAxisGrade: number;
}
function battlefieldCorridorProtection(regions:readonly BattlefieldEconomyRegion[],cellSize:number) {
  // Include full HQ exit/cliff cells as well as the complete foundations.
  // Repair-search exclusions have a different purpose and are not reused here.
  const hq=Math.ceil(Math.SQRT2*(Math.max(9,BUILDINGS.hq.size+1)+cellSize)),
    vent=Math.max(9,Math.ceil(Math.SQRT2*(BUILDINGS.refinery.size+1+cellSize/2)));
  return regions.flatMap(r=>[{...r.center,radius:10},{...r.vent,radius:vent},{...r.hq,radius:hq}]);
}
function battlefieldCorridorGrid(extent:number,height:BattlefieldHeightField,regions:readonly BattlefieldEconomyRegion[]=[],cellSize=2.5) {
  const step=5,n=Math.round(extent*2/step)+1,raw=new Float64Array(n*n);
  for(let z=0;z<n;z++)for(let x=0;x<n;x++)raw[z*n+x]=height(x*step-extent,z*step-extent);
  const pads=regions.flatMap(r=>[{...r.center,radius:10},{...r.vent,radius:4},{...r.hq,radius:6}]),anchors:number[]=[];
  for(let z=0;z<n;z++)for(let x=0;x<n;x++)
    if(pads.some(p=>Math.hypot(x*step-extent-p.x,z*step-extent-p.z)<=p.radius))anchors.push(z*n+x);
  let grade=.16;
  for(const i of anchors)for(const j of anchors)if(i!==j) {
    const run=(Math.abs(i%n-j%n)+Math.abs(Math.floor(i/n)-Math.floor(j/n)))*step;
    grade=Math.max(grade,Math.abs(raw[i]-raw[j])/run+1e-6);
  }
  if(grade>.4)throw Error('Economic anchors exceed the bounded profile grade');
  const rise=step*grade,envelope=(field:Float64Array,lower:boolean)=>{
    const limit=(i:number,j:number)=>lower?Math.max(field[i],field[j]-rise):Math.min(field[i],field[j]+rise);
    for(let z=0;z<n;z++) {
      for(let x=1;x<n;x++){const i=z*n+x;field[i]=limit(i,i-1);}
      for(let x=n-2;x>=0;x--){const i=z*n+x;field[i]=limit(i,i+1);}
    }
    for(let x=0;x<n;x++) {
      for(let z=1;z<n;z++){const i=z*n+x;field[i]=limit(i,i-n);}
      for(let z=n-2;z>=0;z--){const i=z*n+x;field[i]=limit(i,i+n);}
    }
    return field;
  };
  // A min-plus envelope keeps natural lows/passes instead of raising them to
  // the average of a nearby summit and valley. Absolute elevation is free.
  // Economic interiors pin their grade; only their supports can raise the bound.
  const target=envelope(raw.slice(),false),cost=new Float64Array(raw.length);
  if(anchors.length) {
    const floor=new Float64Array(raw.length).fill(-Infinity),ceiling=new Float64Array(raw.length).fill(Infinity);
    for(const i of anchors)floor[i]=ceiling[i]=raw[i];
    envelope(floor,true);envelope(ceiling,false);
    for(let i=0;i<target.length;i++)target[i]=clamp(target[i],floor[i],ceiling[i]);
  }
  for(let z=0;z<n;z++)for(let x=0;x<n;x++) {
    const i=z*n+x,dx=(raw[z*n+Math.min(n-1,x+1)]-raw[z*n+Math.max(0,x-1)])/((x>0&&x<n-1?2:1)*step),
      dz=(raw[Math.min(n-1,z+1)*n+x]-raw[Math.max(0,z-1)*n+x])/((z>0&&z<n-1?2:1)*step);
    cost[i]=1+8*(dx*dx+dz*dz)+.8*Math.abs(raw[i]-target[i]);
  }
  // Cost the corridor's width as well as its center. A cheap center sample
  // must not invite a route along a steep cross-slope or through a narrow notch.
  const local=cost.slice(),width=[[-2,0],[2,0],[0,-2],[0,2],[-1,-1],[1,-1],[-1,1],[1,1]];
  for(let z=0;z<n;z++)for(let x=0;x<n;x++) {
    const i=z*n+x;let peak=local[i];
    for(const [dx,dz]of width)peak=Math.max(peak,local[clamp(z+dz,0,n-1)*n+clamp(x+dx,0,n-1)]);
    cost[i]=(local[i]+peak)/2;
  }
  const sample=(field:Float64Array,x:number,z:number)=>{
    const gx=clamp((x+extent)/step,0,n-1),gz=clamp((z+extent)/step,0,n-1),
      ix=Math.min(n-2,Math.floor(gx)),iz=Math.min(n-2,Math.floor(gz)),u=gx-ix,v=gz-iz,i=iz*n+ix,
      a=field[i],b=field[i+1],c=field[i+n+1],d=field[i+n];
    return v>=u?a+(c-d)*u+(d-a)*v:a+(b-a)*u+(c-b)*v;
  };
  const protection=battlefieldCorridorProtection(regions,cellSize),core=new BattlefieldSurface(extent,cellSize,(x,z)=>{
    let influence=1;for(const p of protection)influence*=battlefieldSmooth((Math.hypot(x-p.x,z-p.z)-p.radius)/12);
    const original=height(x,z);return original+(sample(target,x,z)-original)*influence;
  });
  const point=(i:number)=>({x:(i%n)*step-extent,z:Math.floor(i/n)*step-extent}),broad=new Uint8Array(n*n);
  for(let i=0;i<broad.length;i++) {
    const p=point(i);broad[i]=Math.max(Math.abs(p.x),Math.abs(p.z))<extent-10&&core.segment(p,p,6)?1:0;
  }
  const exclusions=regions.map(region=>{
    const mask=new Uint8Array(n*n);
    for(let i=0;i<mask.length;i++) {
      const p=point(i);mask[i]=region.rampProtection.some(site=>distance(site,p)<site.radius+6)?1:0;
    }
    return mask;
  });
  return {step,n,raw,target,cost,sample,core,grade,point,broad,exclusions};
}
function routeBattlefieldCorridor(size:BattlefieldSize,a:Position,b:Position,
    regions:readonly BattlefieldEconomyRegion[],grid:ReturnType<typeof battlefieldCorridorGrid>,lengthPenalty=0) {
  const {n,step,raw,cost,point,sample}=grid,
    foreign=regions.flatMap((r,i)=>distance(r.center,a)>.01&&distance(r.center,b)>.01?[i]:[]),
    protectedSites=foreign.flatMap(i=>regions[i].rampProtection),
    clear=(p:Position,q:Position)=>Math.max(Math.abs(p.x),Math.abs(p.z),Math.abs(q.x),Math.abs(q.z))<size.extent-10&&
      protectedSites.every(site=>pointSegment(site,p,q)>=site.radius+6)&&grid.core.segment(p,q,6),
    index=(p:Position)=>Math.round((p.z+size.extent)/step)*n+Math.round((p.x+size.extent)/step),
    root=index(a),goal=index(b),free=new Uint8Array(n*n),scores=new Float64Array(n*n).fill(Infinity),
    parents=new Int32Array(n*n).fill(-1),closed=new Uint8Array(n*n),heap=new Heap(),direct=distance(a,b);
  if(direct<.01)throw Error('Economic corridor endpoints must differ');
  for(let i=0;i<free.length;i++) {
    const p=point(i);
    free[i]=grid.broad[i]&&foreign.every(j=>!grid.exclusions[j][i])&&distance(a,p)+distance(p,b)<=direct*2+40?1:0;
  }
  if(!free[root]||!free[goal]||!clear(a,point(root))||!clear(point(goal),b))throw Error('No safe economic corridor terminal');
  const shortestOnly=!Number.isFinite(lengthPenalty),heuristicScale=shortestOnly?1:1+lengthPenalty;
  scores[root]=0;heap.push(root,distance(point(root),b)*heuristicScale);let expanded=0;
  const neighbors=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
  while(heap.length&&expanded<n*n) {
    const i=heap.pop();if(closed[i])continue;closed[i]=1;expanded++;
    if(i===goal)break;
    const x=i%n,z=Math.floor(i/n),p=point(i);
    for(const [dx,dz]of neighbors) {
      if(x+dx<0||x+dx>=n||z+dz<0||z+dz>=n)continue;
      const j=(z+dz)*n+x+dx;if(!free[j]||closed[j]||!clear(p,point(j)))continue;
      const length=step*Math.hypot(dx,dz),slope=(raw[j]-raw[i])/length,
        score=scores[i]+length*(shortestOnly?1:(cost[i]+cost[j])/2+12*slope*slope+lengthPenalty);
      if(score>=scores[j])continue;scores[j]=score;parents[j]=i;heap.push(j,score+distance(point(j),b)*heuristicScale);
    }
  }
  if(!closed[goal])throw Error('Economic corridor search budget exhausted');
  const chain:Position[]=[b];
  for(let i=goal;i!==root;i=parents[i])chain.push(point(i));
  chain.push(point(root),a);chain.reverse();
  const unique=chain.filter((p,i)=>!i||distance(p,chain[i-1])>.01);
  const lineCost=(p:Position,q:Position)=>{
    if(!clear(p,q))return Infinity;
    const length=distance(p,q),steps=Math.max(1,Math.ceil(length/2.5));if(shortestOnly)return length;
    let total=0,previous=sample(raw,p.x,p.z);
    for(let i=1;i<=steps;i++) {
      const x=p.x+(q.x-p.x)*i/steps,z=p.z+(q.z-p.z)*i/steps,h=sample(raw,x,z),slope=(h-previous)/(length/steps||1);
      total+=length/steps*(sample(cost,x,z)+12*slope*slope+lengthPenalty);previous=h;
    }
    return total;
  };
  const cumulative=[0];for(let i=1;i<unique.length;i++)cumulative.push(cumulative[i-1]+lineCost(unique[i-1],unique[i]));
  const simplified=[a];
  for(let i=0;i<unique.length-1;) {
    let next=unique.length-1;
    while(next>i+1) {
      const cost=lineCost(unique[i],unique[next]);
      if(Number.isFinite(cost)&&cost<=(cumulative[next]-cumulative[i])*1.04)break;
      next--;
    }
    simplified.push(unique[next]);i=next;
  }
  const rounded=[a];
  for(let i=1;i<simplified.length-1;i++) {
    const p=simplified[i],previous=simplified[i-1],next=simplified[i+1],
      trim=Math.min(5,distance(previous,p)/3,distance(p,next)/3),
      u={x:p.x+(previous.x-p.x)*trim/distance(previous,p),z:p.z+(previous.z-p.z)*trim/distance(previous,p)},
      v={x:p.x+(next.x-p.x)*trim/distance(p,next),z:p.z+(next.z-p.z)*trim/distance(p,next)},curve=[u];
    for(let j=1;j<=4;j++){const t=j/4,s=1-t;curve.push({x:s*s*u.x+2*s*t*p.x+t*t*v.x,z:s*s*u.z+2*s*t*p.z+t*t*v.z});}
    const curved=curve.slice(1).reduce((sum,q,j)=>sum+lineCost(curve[j],q),0),old=lineCost(u,p)+lineCost(p,v);
    if(Number.isFinite(curved)&&curved<=old*1.04)rounded.push(...curve);else rounded.push(p);
  }
  rounded.push(b);
  const length=rounded.slice(1).reduce((sum,p,i)=>sum+distance(rounded[i],p),0);
  return {points:rounded,expanded,length,withinBudget:length<=direct*2+40&&rounded.length<=128};
}
function fitBattlefieldCorridors(size:BattlefieldSize,regions:readonly BattlefieldEconomyRegion[],
    corridors:[number,number][][],before:BattlefieldHeightField,target:BattlefieldHeightField):BattlefieldHeightField {
  const bound=size.extent+40,tile=16,n=Math.ceil(bound*2/tile),bins:number[][]=Array.from({length:n*n},()=>[]),
    legs=corridors.flatMap((route,id)=>route.slice(1).map(([x,z],i)=>{
      const [ax,az]=route[i],dx=x-ax,dz=z-az;return {id,x:ax,z:az,dx,dz,length2:dx*dx+dz*dz};
    })).filter(r=>r.length2>.0001),protectedSites=battlefieldCorridorProtection(regions,size.cellSize),nearest=new Float64Array(corridors.length);
  for(const [index,r]of legs.entries()) {
    const left=clamp(Math.floor((Math.min(r.x,r.x+r.dx)-36+bound)/tile),0,n-1),
      right=clamp(Math.floor((Math.max(r.x,r.x+r.dx)+36+bound)/tile),0,n-1),
      top=clamp(Math.floor((Math.min(r.z,r.z+r.dz)-36+bound)/tile),0,n-1),
      bottom=clamp(Math.floor((Math.max(r.z,r.z+r.dz)+36+bound)/tile),0,n-1);
    for(let z=top;z<=bottom;z++)for(let x=left;x<=right;x++)bins[z*n+x].push(index);
  }
  return (x,z)=>{
    const original=before(x,z),ix=Math.floor((x+bound)/tile),iz=Math.floor((z+bound)/tile);
    if(ix<0||ix>=n||iz<0||iz>=n)return original;
    nearest.fill(Infinity);
    for(const i of bins[iz*n+ix]) {
      const r=legs[i],t=clamp(((x-r.x)*r.dx+(z-r.z)*r.dz)/r.length2,0,1),d=Math.hypot(x-r.x-t*r.dx,z-r.z-t*r.dz);
      nearest[r.id]=Math.min(nearest[r.id],d);
    }
    let retained=1;for(const d of nearest)retained*=battlefieldSmooth((d-12)/24);
    let influence=1-retained;if(!influence)return original;
    for(const p of protectedSites)influence*=battlefieldSmooth((Math.hypot(x-p.x,z-p.z)-p.radius)/12);
    return original+(target(x,z)-original)*influence;
  };
}
function battlefieldHeadquartersSupported(surface:BattlefieldSurface,regions:readonly BattlefieldEconomyRegion[]) {
  return regions.every(r=>surface.foundation(r.hq,BUILDINGS.hq.size)&&surface.fits(r.hq.x,r.hq.z,9));
}
function battlefieldCorridorsClear(surface:BattlefieldSurface,corridors:[number,number][][]) {
  return corridors.every(route=>route.slice(1).every(([x,z],i)=>
    surface.segment({x:route[i][0],z:route[i][1]},{x,z},TERRAIN_ROUTE_RADIUS)));
}
function planBattlefieldCorridors(size:BattlefieldSize,layout:BattlefieldLayout,before:BattlefieldHeightField) {
  const links=(layout.corridorLinks??layout.corridors).map(route=>[route[0],route[route.length-1]].map(p=>[...p] as [number,number]));
  if(!links.length)return {links,corridors:[],before,height:before,expandedNodes:0,repairs:0,searchPasses:0,lengthConstrainedRoutes:0,profileAxisGrade:0};
  const grid=battlefieldCorridorGrid(size.extent,before,layout.economyRegions,size.cellSize);
  let expandedNodes=0,searchPasses=0,lengthConstrainedRoutes=0;
  const corridors=links.map(([a,b])=>{
    // A pointwise detour ellipse does not bound the cumulative route length.
    // At most four searches trade terrain cost for length; the last prioritizes
    // shortest *width-checked* geometry, never another seed or relaxed physics.
    for(const penalty of [0,8,64,Infinity]) {
      const route=routeBattlefieldCorridor(size,{x:a[0],z:a[1]},{x:b[0],z:b[1]},layout.economyRegions,grid,penalty);
      expandedNodes+=route.expanded;searchPasses++;
      if(!route.withinBudget)continue;if(penalty)lengthConstrainedRoutes++;
      return route.points.map(p=>[p.x,p.z] as [number,number]);
    }
    throw Error('Economic corridor detour budget exceeded');
  });
  const {sample,target:profile}=grid,target:BattlefieldHeightField=(x,z)=>sample(profile,x,z),
    height=fitBattlefieldCorridors(size,layout.economyRegions,corridors,before,target);
  return {links,corridors,before,height,expandedNodes,repairs:0,searchPasses,lengthConstrainedRoutes,profileAxisGrade:grid.grade};
}
