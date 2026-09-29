// Bounded recipe, terrain and movement checks; no AI decisions or long simulation runs.
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {loadScripts,BATTLEFIELD_SCRIPTS,SIMULATION_SCRIPTS}=require('./helpers/game-scripts.cjs');
const context=loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world','effects',...SIMULATION_SCRIPTS,
  'renderer-geometry','renderer-materials','renderer-runtime'],{globals:{innerHeight:800}});
const {Battlefield,BATTLEFIELDS,MeridianGame,MeridianRenderer,highlandParameters,highlandLayout,highlandPlan,
  createHighlandRecipe,battlefieldDesign,battlefieldStartSites}=vm.runInContext(
  '({Battlefield,BATTLEFIELDS,MeridianGame,MeridianRenderer,highlandParameters,highlandLayout,highlandPlan,createHighlandRecipe,battlefieldDesign,battlefieldStartSites})',context);
const json=v=>JSON.parse(JSON.stringify(v));

test('highland parameters vary size and landform independently and preserve compatible terraces',()=>{
  const choices=new Set();
  for(let seed=1;seed<=96;seed++) {
    const p=highlandParameters(seed);choices.add(`${p.extent}/${p.landform}`);
    assert.deepEqual(p,highlandParameters(seed));
    assert.equal(highlandParameters(seed,{extent:140}).landform,p.landform);
    assert.equal(highlandParameters(seed,{landform:'basin'}).extent,p.extent);
    const layout=highlandLayout(seed,p.extent,p.landform);
    assert.doesNotThrow(()=>highlandPlan(layout,seed,p.extent,p.landform));
  }
  assert.equal(choices.size,9);
  for(const extent of [89,NaN,Infinity,10000])assert.throws(()=>createHighlandRecipe({extent}));
  assert.throws(()=>createHighlandRecipe({landform:'unknown'}));
});

test('all three sizes have reachable elevated bases, broad traversable relief and local building terraces',()=>{
  const forms=new Set(),sizes=new Set();
  for(const seed of [1409,40517,3]) {
    const w=new Battlefield(seed,'frontier',4),s=w.surface,n=w.gridSize,starts=battlefieldStartSites(w);
    sizes.add(w.extent);forms.add(highlandParameters(seed).landform);
    assert.equal(n,w.extent*2/2.5);
    assert.equal(w.terrainColors.length,n*n*4);assert.equal(s.heights.length,(n*2+1)**2);
    const field=w.renderData.geometries.find(p=>p.mesh==='terrain').relief;
    for(let z=0;z<s.size;z++)for(let x=0;x<s.size;x++)
      assert.ok(Math.abs(field.heights[(z+1)*field.size+x+1]+.13-s.heights[z*s.size+x])<1e-5,'mesh samples equal authoritative terrain at every size');
    for(const buffer of [w.staticGrid,w.terrainFeatureGrid,w.blocked,w.fogPixels,...w.sight.flatMap(p=>[p.visible,p.explored])])
      assert.equal(buffer.length,n*n);
    let min=Infinity,max=-Infinity,open=0,sloping=0;
    for(let i=0;i<n*n;i++)if(!w.staticGrid[i]) {
      const p=w.point(i),h=s.heightAt(p.x,p.z);min=Math.min(h,min);max=Math.max(h,max);open++;
      if(Math.abs(s.heightAt(p.x+1,p.z)-s.heightAt(p.x-1,p.z))+
        Math.abs(s.heightAt(p.x,p.z+1)-s.heightAt(p.x,p.z-1))>.1)sloping++;
      assert.equal(s.visibilityLevelAt(p.x,p.z),0,'natural hills do not add unrequested high-ground sight rules');
    }
    assert.ok(max-min>6,`${seed}: actual walkable height variation`);
    assert.ok(open>n*n*.7&&sloping>open*.2,`${seed}: broad usable slopes, not decorative blocked mountains`);
    for(const p of starts) {
      assert.ok(s.foundation(p,7));
      assert.ok(s.heightAt(p.x,p.z)<s.maxHeight-1,'start search uses the local plateau, not the tallest peak');
      const route=w.path(p.x,p.z,starts[0].x,starts[0].z,false,undefined,2.5);
      assert.equal(route.status,'complete',`${seed}: real vehicle path between bases`);
      let from=p;for(const q of route.points){assert.ok(w.terrainFree(from,q,2.5));from=q;}
    }
    for(const [i,p] of w.layout.resourceSites.entries()) {
      const vent={x:p.x+(i?7:5),z:p.z+(i?7:18)};
      assert.ok(s.foundation(vent,3),`${seed}: vent ${i} fits its local terrace`);
      assert.equal(w.path(starts[0].x,starts[0].z,vent.x,vent.z,false,undefined,2.5).status,'complete');
    }
  }
  assert.equal(sizes.size,3);assert.equal(forms.size,3);
});

test('pinned highland designs pin dimensions and layout, while invalid sizes fail before layout allocation',()=>{
  const original=BATTLEFIELDS.frontier;
  try {
    BATTLEFIELDS.frontier=battlefieldDesign(createHighlandRecipe(),'FIXED HIGHLANDS',{terrainSeed:3,atmosphere:{timeOfDay:12}});
    const a=new Battlefield(1409,'frontier'),b=new Battlefield(7919,'frontier');
    assert.equal(a.extent,140);assert.equal(b.extent,140);
    assert.deepEqual(json(a.layout),json(b.layout));assert.deepEqual(a.surface.heights,b.surface.heights);
    assert.deepEqual(a.staticGrid,b.staticGrid);assert.notEqual(a.seed,b.seed);
    BATTLEFIELDS.frontier={...original,createSize:()=>({extent:95,cellSize:3}),createLayout:()=>{throw Error('layout ran before size validation');}};
    assert.throws(()=>new Battlefield(1,'frontier'),/whole grid/);
  } finally {BATTLEFIELDS.frontier=original;}
});

test('workers climb and descend real terrain; building and picking use that same surface',()=>{
  const g=new MeridianGame({upgrades:{}});g.start({seed:1409,map:'frontier'});
  g.s.parties.forEach(p=>p.controller={kind:'human'});
  g.s.entities=[];g.ids.clear();g.world.rebuild([]);g.world.explored.fill(1);
  const s=g.world.surface;let a,b;
  for(let z=-70;z<=70&&!a;z+=5)for(let x=-70;x<=60&&!a;x+=5) {
    const p={x,z},q={x:x+10,z};
    if(Math.abs(s.heightAt(p.x,p.z)-s.heightAt(q.x,q.z))>1.5&&s.segment(p,q,2.5)){a=p;b=q;}
  }
  assert.ok(a&&b,'a body-wide slope exists');
  const worker=g.spawnUnit('worker',a.x,a.z,0,0);assert.ok(worker);
  for(const target of [b,a]) {
    const start=s.entityHeight(worker);g.setOrder(worker,{type:'move',...target});let arrived=false;
    for(let i=0;i<180&&!arrived;i++) {
      g.s.time+=.05;arrived=g.move(worker,target,.05);
      assert.ok(g.unitFits(worker,worker.x,worker.z));
      assert.equal(s.entityHeight(worker),s.heightAt(worker.x,worker.z));
    }
    assert.ok(arrived);assert.ok(Math.abs(s.entityHeight(worker)-start)>1.2);
  }
  assert.equal(s.foundation(a,3),false);
  assert.match(g.canBuild('depot',a),/level ground/);
  assert.equal(g.canBuild('depot',g.world.layout.startSites[0]),'');
  const r=Object.create(MeridianRenderer.prototype);
  Object.assign(r,{viewport:{left:0,top:0,right:1200,bottom:800,width:1200,height:800},quality:0,surface:s});
  r.camera(a.x,a.z,65);
  for(const p of [a,b,...g.world.layout.startSites]) {
    const screen=r.project(p.x,s.heightAt(p.x,p.z),p.z),hit=r.ground(screen.x,screen.y);
    assert.ok(hit&&Math.hypot(hit.x-p.x,hit.z-p.z)<1e-4,'ray/project roundtrip on the actual hill');
  }
});
