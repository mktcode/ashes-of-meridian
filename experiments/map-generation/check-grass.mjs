import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadLab } from './test-support.mjs';
const context=loadLab({scripts:['terrain-core','terrain-decoration','terrain-grass'],globals:{assert}});
const counts=vm.runInContext(`(()=>{
  assert.equal(typeof document,'undefined');
  const p=makePlan(2),before=JSON.stringify(p);
  let queries=0;
  const flat=height=>(p,x,y)=>{queries++;return {height,water:0,bridge:false};};
  const low=makeGrassDecoration(p,flat(20),3);
  assert.equal(JSON.stringify(makeGrassDecoration(p,flat(20),3)),JSON.stringify(low));
  assert.equal(JSON.stringify(p),before);
  const dense=grassInstances(low,1),medium=grassInstances(low,.65),sparse=grassInstances(low,.3),q=queries;
  assert.ok(sparse.length<medium.length && medium.length<dense.length);
  assert.equal(grassInstances(low,0).length,0);
  assert.equal(queries,q);
  const keys=data=>new Set(Array.from({length:data.length/7},(_,i)=>data[i*7]+':'+data[i*7+1]));
  const mediumKeys=keys(medium),denseKeys=keys(dense);
  assert.ok([...keys(sparse)].every(k=>mediumKeys.has(k)));
  assert.ok([...mediumKeys].every(k=>denseKeys.has(k)));
  assert.ok(dense.every(Number.isFinite));
  for(const site of low.catalog) {
    assert.ok(grassClearance(p,site.sourceX,site.sourceY)>0);
    assert.ok(site.height>0);
  }
  const overlap=low.catalog.find(s=>decorationClearance(p,s.sourceX,s.sourceY));
  assert.ok(overlap,'Tree and grass areas may overlap');
  const s=overlap;
  const actual=grassSite(p,s.sourceX,s.sourceY);
  assert.ok(actual.eligible);assert.equal(actual.band,heightBand(actual.height));
  assert.equal(actual.height,sampleWorld(p,actual.x,actual.y).height);
  assert.equal(grassSite(p,s.sourceX,s.sourceY,()=>({height:20,water:30,riverGap:50,bridge:false})).eligible,true,
    'Distant dry lowland below the nearest river datum must remain plantable');
  assert.equal(grassSite(p,s.sourceX,s.sourceY,()=>({height:20,water:21,riverGap:0,bridge:false})).eligible,false);
  assert.equal(grassSite(p,s.sourceX,s.sourceY,()=>({height:20,water:0,bridge:true})).eligible,false);
  assert.equal(grassSite(p,s.sourceX,s.sourceY,(p,x,y)=>({height:20+(x-s.x)*.8,water:-100,bridge:false})).eligible,true);
  assert.equal(grassSite(p,s.sourceX,s.sourceY,(p,x,y)=>({height:20+(x-s.x)*2,water:-100,bridge:false})).eligible,false);
  assert.equal(grassClearance(p,0,0),0);
  for(const e of p.edges) {
    const a=p.regions[e.a],b=p.regions[e.b];assert.equal(grassClearance(p,(a.x+b.x)/2,(a.y+b.y)/2),0);
  }
  for(const b of p.river.bridges) assert.equal(grassClearance(p,b.center.x,b.center.y),0);
  for(const e of p.river.segments) assert.equal(grassClearance(p,e.a.x,e.a.y),0);
  const model=grassBladeGeometry();assert.equal(model.length,27);assert.ok(model.every(Number.isFinite));
  const zones=[low,makeGrassDecoration(p,flat(40),3),makeGrassDecoration(p,flat(70),3)];
  assert.ok(zones.every(d=>JSON.stringify(d.field.sites.map(s=>s.eligible))===JSON.stringify(low.field.sites.map(s=>s.eligible))));
  const counts=zones.map(d=>grassInstances(d,.65).length/7);
  assert.ok(counts[1]<counts[0]*.3 && counts[2]<counts[0]*.05);
  assert.equal(JSON.stringify(p),before);
  return counts;
})()`,context,{timeout:5000});
console.log(`Grass: ${counts.join('/')} clumps at 65% on equal eligible low/middle/highland areas; deterministic, read-only, nested density, overlap, dry ground, road/bridge/water exclusion, slopes and shared model OK. Coarse test candidates; no terrain mesh/raster.`);
