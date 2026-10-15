// STRATA v1 data importer; archive SDK entries are data, never executable dependencies.
import { readZip } from './zip.js';
import { MAX_SLOPE, MAX_HEIGHT_SCALE, createCorridorIndex, cellGrade } from './map-navigation.js';

export const MAP_FORMAT='strata-game-map',MAP_VERSION=1,MAX_MAP_BYTES=2*1024*1024;
export const MAP_GRID=Object.freeze({width:520,length:640,nx:260,ny:320,units:'meters',axes:'x-east/y-up/z-south',
  origin:Object.freeze([-260,0,320]),step:Object.freeze([2,0,-2]),heightEncoding:'float32-le',triangles:'a-b-c/b-d-c'});
const SDK=['src/landscape/game-map.js','src/landscape/navigation.js','src/zip.js'];
const BASE=['map.json','height.f32','navigation.bin','corridors.bin','navigation.json','README.md'];
const require=(ok,message='Ungültiges Spielkartenpaket.')=>{if(!ok)throw Error(message);};
const finite=(x,min,max)=>Number.isFinite(x)&&x>=min&&x<=max;
const canonical=v=>JSON.stringify(v,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);
const same=(a,b)=>canonical(a)===canonical(b);
const parse=(files,name)=>{const bytes=files.get(name);require(bytes&&bytes.length<=512*1024,'Metadaten fehlen oder sind zu groß: '+name);return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));};

function generationValid(g) {
  require(g&&g.generator==='strata-terrain'&&g.version===1,'Unbekannte Generatorversion.');
  const limits={seed:[0,4294967295],branches:[0,12],naturalness:[0,1.5],hills:[0,6],hillScale:[24,100],pathWidth:[6,24]};
  require(Object.keys(g).length===Object.keys(limits).length+3);
  for(const [key,[min,max]] of Object.entries(limits))require(finite(g[key],min,max));
  require(Number.isInteger(g.seed)&&Number.isInteger(g.branches)&&['macro','landscape'].includes(g.stage));
}
function routeIndex(routes,width,branches) {
  require(Array.isArray(routes)&&routes.length>=3&&routes.length<=64,'Ungültiges Wegenetz.');
  const nodes=new Map(),edges=new Map(),pairs=new Set();let pointCount=0;
  require(routes.filter(r=>r.kind==='branch').length===branches);
  require(routes.filter(r=>r.kind==='entry'&&r.from==='south').length===1&&routes.filter(r=>r.kind==='exit'&&r.to==='north').length===1);
  for(const r of routes) {
    require(r&&['entry','exit','ascent','branch','loop'].includes(r.kind));
    require([r.from,r.to].every(id=>typeof id==='string'&&/^[a-z0-9]{1,24}$/.test(id))&&r.from!==r.to);
    const pair=[r.from,r.to].sort().join('/');require(!pairs.has(pair));pairs.add(pair);
    require(Array.isArray(r.points)&&r.points.length>=2&&(pointCount+=r.points.length)<=10000);
    for(const p of r.points)require(Array.isArray(p)&&p.length===2&&finite(p[0],-260+width/2,260-width/2)&&finite(p[1],-400,400));
    for(const [id,p] of [[r.from,r.points[0]],[r.to,r.points.at(-1)]]) {
      const old=nodes.get(id);require(!old||Math.hypot(old[0]-p[0],old[1]-p[1])<1e-7,'Widersprüchlicher Weganschluss.');nodes.set(id,p);
      if(id==='south')require(p[1]>=320);else if(id==='north')require(p[1]<=-320);else require(Math.abs(p[1])<=320);
    }
    for(const [a,b] of [[r.from,r.to],[r.to,r.from]]){if(!edges.has(a))edges.set(a,[]);edges.get(a).push(b);}
  }
  const seen=new Set(['south']),queue=['south'];
  for(let i=0;i<queue.length;i++)for(const id of edges.get(queue[i])||[])if(!seen.has(id)){seen.add(id);queue.push(id);}
  require(seen.has('north')&&seen.size===nodes.size,'Nicht zusammenhängendes Wegenetz.');
  return createCorridorIndex(routes.map(r=>({points:r.points.map(([x,z])=>({x,y:-z}))})),width);
}

// Recompute gameplay truth from the exported, already-scaled Float32 heights.
// Never trust a supplied walkability mask/report or regenerate from a seed.
function inspect(manifest,heights,walkable,corridors,routes) {
  require(manifest?.format===MAP_FORMAT&&manifest.version===MAP_VERSION,'Unbekanntes Spielkartenformat.');
  require(same(Object.keys(manifest).sort(),['format','generation','grid','renderBasis','version']));
  require(same(manifest.grid,MAP_GRID),'Nicht unterstütztes Koordinaten-/Rasterformat.');generationValid(manifest.generation);
  const basis=manifest.renderBasis;
  require(basis&&same(Object.keys(basis).sort(),['heightScaleBaked','northAxis','upperHeight'])&&finite(basis.heightScaleBaked,.4,MAX_HEIGHT_SCALE)&&finite(basis.upperHeight,104,128));
  require(Array.isArray(basis.northAxis)&&basis.northAxis.length===3&&basis.northAxis.every(Number.isFinite)&&basis.northAxis[2]===0&&Math.abs(Math.hypot(...basis.northAxis)-1)<1e-6);
  const {nx,ny}=MAP_GRID,count=nx*ny;
  require(heights.length===(nx+1)*(ny+1)&&walkable.length===count&&corridors.length===count,'Falsche Binärdatenlänge.');
  for(const h of heights)require(finite(h,-4096,4096),'Ungültige Geländehöhe.');
  const index=routeIndex(routes,manifest.generation.pathWidth,manifest.generation.branches),limit=Math.tan(MAX_SLOPE*Math.PI/180);
  let corridorCells=0,maxGrade=0;
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++) {
    const k=j*nx+i,grade=cellGrade(heights,nx,ny,i,j);
    require(walkable[k]===(grade<=limit?1:0),'Begehbarkeit passt nicht zum Höhenfeld.');
    const covered=index.distance(-260+(i+.5)*2,-320+(j+.5)*2)<=index.radius+Math.SQRT2;
    require(corridors[k]===(covered?1:0),'Korridorbreite passt nicht zum Wegenetz.');
    if(covered){require(walkable[k]===1,'Export verletzt die Weggarantie.');corridorCells++;maxGrade=Math.max(maxGrade,grade);}
  }
  const seen=new Uint8Array(count),queue=new Int32Array(count);let head=0,tail=0;
  const visit=k=>{if(!seen[k]&&corridors[k]){seen[k]=1;queue[tail++]=k;}};
  for(let i=0;i<nx;i++)if(corridors[i]){visit(i);break;}
  while(head<tail){const k=queue[head++],x=k%nx,y=Math.floor(k/nx);if(x)visit(k-1);if(x+1<nx)visit(k+1);if(y)visit(k-nx);if(y+1<ny)visit(k+nx);}
  require(corridorCells>0&&tail===corridorCells&&seen.subarray((ny-1)*nx).some(v=>v===1),'Korridore verbinden nicht alle Äste mit Süd und Nord.');
  return {maxSlope:MAX_SLOPE,pathWidth:manifest.generation.pathWidth,neighbors:4,unitRadius:0,connected:true,
    corridorCells,routeCount:routes.length,maxCorridorSlope:Math.atan(maxGrade)*180/Math.PI};
}

export async function importGameMap(input) {
  const files=input instanceof Map?input:await readZip(input,{maxBytes:MAX_MAP_BYTES,maxFiles:BASE.length+SDK.length});
  require([...files.values()].every(data=>data instanceof Uint8Array)&&[...files.values()].reduce((sum,data)=>sum+data.length,0)<=MAX_MAP_BYTES);
  require(files.size===BASE.length+SDK.length&&[...BASE,...SDK].every(name=>files.has(name)),'Unvollständiges Spielkartenpaket.');
  const manifest=parse(files,'map.json'),nav=parse(files,'navigation.json'),bytes=files.get('height.f32');
  require(bytes.length===261*321*4,'Falsche Höhenfeldlänge.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),heights=new Float32Array(261*321);
  heights.forEach((_,i)=>{heights[i]=view.getFloat32(i*4,true);});
  const walkable=files.get('navigation.bin').slice(),corridors=files.get('corridors.bin').slice();
  require(nav?.format==='strata-navigation'&&nav.version===1,'Unbekanntes Navigationsformat.');
  const report=inspect(manifest,heights,walkable,corridors,nav.routes);
  for(const [key,value] of Object.entries(report))require(typeof value==='number'?typeof nav[key]==='number'&&Math.abs(nav[key]-value)<1e-7:nav[key]===value,'Navigationsbericht stimmt nicht.');
  return {manifest,heights,walkable,corridors,routes:nav.routes,report};
}

export function heightAt(map,x,z) {
  if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>260||Math.abs(z)>320)return null;
  const gx=(x+260)/2,gy=(320-z)/2,i=Math.min(259,Math.floor(gx)),j=Math.min(319,Math.floor(gy)),u=gx-i,v=gy-j;
  const h=map.heights,a=j*261+i,b=a+1,c=a+261,d=c+1;
  return u+v<=1?h[a]+u*(h[b]-h[a])+v*(h[c]-h[a]):h[d]+(1-u)*(h[c]-h[d])+(1-v)*(h[b]-h[d]);
}
export function walkableAt(map,x,z) {
  if(heightAt(map,x,z)===null)return false;
  return map.walkable[Math.min(319,Math.floor((320-z)/2))*260+Math.min(259,Math.floor((x+260)/2))]===1;
}
export function createTerrainMesh(map) {
  const vertices=new Float32Array(261*321*6),indices=new Uint32Array(260*320*6),h=map.heights;let at=0;
  for(let j=0;j<=320;j++)for(let i=0;i<=260;i++) {
    const k=j*261+i,l=Math.max(0,i-1),r=Math.min(260,i+1),b=Math.max(0,j-1),f=Math.min(320,j+1);
    const sx=(h[j*261+r]-h[j*261+l])/((r-l)*2),sy=(h[f*261+i]-h[b*261+i])/((f-b)*2),length=Math.hypot(sx,1,sy);
    vertices.set([-260+i*2,h[k],320-j*2,-sx/length,1/length,sy/length],k*6);
    if(i<260&&j<320){indices.set([k,k+1,k+261,k+1,k+262,k+261],at);at+=6;}
  }
  return {vertices,indices,stride:24};
}
