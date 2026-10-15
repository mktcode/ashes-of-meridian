import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { importGameMap, heightAt, walkableAt, createTerrainMesh, boundsOf, normalAt, raycastTerrain, MAX_MAP_BYTES } from '@aom/landscape';
import { readZip, zipFiles } from '../src/zip.js';
const bytes = new Uint8Array(await readFile(new URL('./fixtures/strata-417.zip', import.meta.url)));
const map = await importGameMap(bytes), mesh = createTerrainMesh(map);
const near = (a,b,eps=1e-8) => assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
const decoder = new TextDecoder(), encoder = new TextEncoder();
const pack = files => zipFiles([...files], { maxBytes: MAX_MAP_BYTES });
function editJSON(files,name,fn) {
  const data=JSON.parse(decoder.decode(files.get(name))); fn(data);
  files.set(name,encoder.encode(JSON.stringify(data)));
}
// Mesh geometry, barycentric coordinates and cross products are independent of the sampler.
function oracle(mesh,cell,u,v) {
  const tri=u+v<=1?0:1, offset=cell*6+tri*3;
  const [a,b,c]=Array.from(mesh.indices.subarray(offset,offset+3),k=>Array.from(mesh.vertices.subarray(k*6,k*6+3)));
  const e=b.map((value,i)=>value-a[i]), f=c.map((value,i)=>value-a[i]);
  const normal=[e[1]*f[2]-e[2]*f[1],e[2]*f[0]-e[0]*f[2],e[0]*f[1]-e[1]*f[0]];
  const col=cell%260,row=Math.floor(cell/260),px=-260+(col+u)*2,pz=320-(row+v)*2;
  const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
  const w0=((b[2]-c[2])*(px-c[0])+(c[0]-b[0])*(pz-c[2]))/den;
  const w1=((c[2]-a[2])*(px-c[0])+(a[0]-c[0])*(pz-c[2]))/den;
  return { x:px,z:pz,y:a[1]*w0+b[1]*w1+c[1]*(1-w0-w1),normal,
    slope:Math.hypot(normal[0],normal[2])/Math.abs(normal[1]) };
}

test('actual STRATA v1 archive preserves authoritative baked heights, graph and mesh',async()=>{
  assert.ok(bytes.length<MAX_MAP_BYTES);
  assert.equal((await importGameMap(new Blob([bytes]))).manifest.generation.seed,417);
  assert.equal(map.manifest.generation.seed,417); assert.equal(map.manifest.generation.branches,3);
  assert.equal(map.manifest.renderBasis.heightScaleBaked,1.8);
  assert.equal(map.report.connected,true); assert.equal(map.routes.filter(r=>r.kind==='branch').length,3);
  assert.deepEqual(boundsOf(map),{minX:-260,maxX:260,minZ:-320,maxZ:320});
  assert.equal(mesh.stride,24); assert.equal(mesh.indices.length/3,166400);
  assert.deepEqual(Array.from(mesh.indices.subarray(0,6)),[0,1,261,1,262,261]);
  const files=await readZip(bytes), h=files.get('height.f32');
  const view=new DataView(h.buffer,h.byteOffset,h.byteLength);
  for(let k=0;k<map.heights.length;k++) assert.equal(map.heights[k],view.getFloat32(k*4,true));
  assert.notEqual(heightAt(map,0,0),map.heights[0]);
  assert.equal(heightAt(map,260,-320),map.heights.at(-1));
  for(const p of [[261,0],[0,321],[NaN,0],[Infinity,0]]) {
    assert.equal(heightAt(map,...p),null); assert.equal(walkableAt(map,...p),false); assert.equal(normalAt(map,...p),null);
  }
});

test('height/normal/picking match both actual mesh triangles, not bilinear or rescaled terrain',()=>{
  for(let cell=0;cell<260*320;cell+=137) for(const [u,v] of [[.17,.29],[.82,.67]]) {
    const p=oracle(mesh,cell,u,v), n=normalAt(map,p.x,p.z), length=Math.hypot(...p.normal);
    near(heightAt(map,p.x,p.z),p.y);
    for(let i=0;i<3;i++) near(n[i],p.normal[i]/length);
    const hit=raycastTerrain(map,[p.x,p.y+1000,p.z],[0,-2,0]);
    near(hit.y,p.y); near(hit.distance,1000);
    const origin=[p.x-0.4,p.y+10,p.z+0.25], direction=[.4,-10,-.25];
    const oblique=raycastTerrain(map,origin,direction);
    near(oblique.x,p.x); near(oblique.z,p.z); near(oblique.y,p.y);
  }
  assert.equal(raycastTerrain(map,[261,0,0],[0,-1,0]),null);
  assert.equal(raycastTerrain(map,[0,1000,0],[0,1,0]),null);
  assert.equal(raycastTerrain(map,[0,1000,0],[0,0,0]),null);
  assert.equal(raycastTerrain(map,[NaN,1000,0],[0,-1,0]),null);
  for(const [x,z] of [[-260,320],[260,-320],[-260,-320],[260,320]])
    near(raycastTerrain(map,[x,1000,z],[0,-1,0]).y,heightAt(map,x,z));
});

test('long oblique camera rays pick the nearest mesh plane, including foreground occlusion',()=>{
  const vertices=mesh.vertices,indices=mesh.indices;
  function brute(origin,direction) {
    const length=Math.hypot(...direction),ray=direction.map(v=>v/length);
    let nearest=Infinity;
    for(let at=0;at<indices.length;at+=3) {
      const a=indices[at]*6,b=indices[at+1]*6,c=indices[at+2]*6;
      const ex=vertices[b]-vertices[a],ey=vertices[b+1]-vertices[a+1],ez=vertices[b+2]-vertices[a+2];
      const fx=vertices[c]-vertices[a],fy=vertices[c+1]-vertices[a+1],fz=vertices[c+2]-vertices[a+2];
      const nx=ey*fz-ez*fy,ny=ez*fx-ex*fz,nz=ex*fy-ey*fx,den=nx*ray[0]+ny*ray[1]+nz*ray[2];
      if(Math.abs(den)<1e-12)continue;
      const t=(nx*(vertices[a]-origin[0])+ny*(vertices[a+1]-origin[1])+nz*(vertices[a+2]-origin[2]))/den;
      if(t<0||t>=nearest)continue;
      const x=origin[0]+t*ray[0],z=origin[2]+t*ray[2];
      const determinant=(vertices[b+2]-vertices[c+2])*(vertices[a]-vertices[c])+(vertices[c]-vertices[b])*(vertices[a+2]-vertices[c+2]);
      const w0=((vertices[b+2]-vertices[c+2])*(x-vertices[c])+(vertices[c]-vertices[b])*(z-vertices[c+2]))/determinant;
      const w1=((vertices[c+2]-vertices[a+2])*(x-vertices[c])+(vertices[a]-vertices[c])*(z-vertices[c+2]))/determinant;
      if(w0>=-1e-8&&w1>=-1e-8&&w0+w1<=1+1e-8)nearest=t;
    }
    return nearest;
  }
  for(const [origin,target] of [
    [[800,900,1000],[-160,260]],[[-900,700,-800],[120,-240]],
    [[600,800,-900],[0,0]],[[-800,900,700],[-240,-280]],
  ]) {
    const direction=[target[0]-origin[0],heightAt(map,...target)-origin[1],target[1]-origin[2]];
    const hit=raycastTerrain(map,origin,direction),expected=brute(origin,direction);
    assert.ok(hit);near(hit.distance,expected,1e-6);near(hit.y,heightAt(map,hit.x,hit.z));
  }
});

test('corruption, oversized inputs and inconsistent map/navigation data are rejected',async()=>{
  const broken=bytes.slice(); broken[100]^=1;
  await assert.rejects(importGameMap(broken),/Prüfsumme/);
  await assert.rejects(importGameMap(bytes.subarray(0,bytes.length-1)));
  await assert.rejects(importGameMap(new Blob([new Uint8Array(MAX_MAP_BYTES+1)])),/groß/);
  let decoded=false;
  await assert.rejects(importGameMap({size:MAX_MAP_BYTES+1,arrayBuffer(){decoded=true;return Promise.resolve(new ArrayBuffer(0));}}),/groß/);
  assert.equal(decoded,false,'check the declared file size before decoding');
  const original=await readZip(bytes);
  for(const mutate of [
    f=>editJSON(f,'map.json',m=>{m.version=2;}),
    f=>editJSON(f,'map.json',m=>{m.grid.step[2]=2;}),
    f=>editJSON(f,'map.json',m=>{m.generation.pathWidth=6;}),
    f=>editJSON(f,'navigation.json',m=>{m.connected=false;}),
    f=>editJSON(f,'navigation.json',m=>{m.routes[2].points[0][0]+=3;}),
    f=>{const h=f.get('height.f32').slice();new DataView(h.buffer).setFloat32(0,NaN,true);f.set('height.f32',h);},
    f=>{const w=f.get('navigation.bin').slice();w[0]^=1;f.set('navigation.bin',w);},
    f=>{const w=f.get('corridors.bin').slice();w[0]^=1;f.set('corridors.bin',w);},
    f=>f.delete('src/landscape/game-map.js'),
    f=>f.set('extra.js',encoder.encode('throw Error("never execute")')),
  ]) { const files=new Map(original); mutate(files); await assert.rejects(importGameMap(await pack(files))); }
});

test('delivered terrain demo references only present local classic scripts',async()=>{
  const entry=new URL('../../../dist/landscape/demo/index.html',import.meta.url);
  const html=await readFile(entry,'utf8');
  assert.doesNotMatch(html,/<script[^>]*(?:type=["']module|\sasync|\sdefer)/i);
  const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(scripts.length,8);
  for(const path of scripts) {
    assert.equal(path.startsWith('/'),false);
    assert.doesNotMatch(path,/^[a-z]+:/i);
    const source=await readFile(new URL(path,entry),'utf8');
    assert.doesNotMatch(source,/^\s*import\s|\bimport\s*\(|\bfetch\s*\(/m);
  }
});

test('archive SDK content is inert and core has no Crowd/DOM/network/generator runtime dependency',async()=>{
  const files=await readZip(bytes);
  files.set('src/landscape/game-map.js',encoder.encode('globalThis.strataExecuted = true; throw Error("not data")'));
  const oldFetch=globalThis.fetch;
  globalThis.fetch=()=>{throw Error('network forbidden');};
  try { assert.equal((await importGameMap(await pack(files))).report.connected,true); }
  finally { globalThis.fetch=oldFetch; }
  assert.equal(globalThis.strataExecuted,undefined);
  const source=await readFile(new URL('../dist/landscape.global.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\b(?:document|window|WebGLRenderingContext|MeridianCrowd)\b|\bfetch\s*\(|import\s*\(|import\.meta|createField|makePlan/);
  const context=vm.createContext({Blob,TextDecoder,TextEncoder,AbortController,setTimeout});
  vm.runInContext(source,context);
  assert.equal(vm.runInContext('MeridianLandscape.MAP_VERSION',context),1);
});
