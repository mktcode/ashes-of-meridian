// Bounded CPU terrain / vehicle-clearance / resource / rendering checks. No AI run.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {loadScripts,BATTLEFIELD_SCRIPTS,SIMULATION_SCRIPTS,RENDERER_SCRIPTS}=require('./helpers/game-scripts.cjs');
const context=loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world','effects',...SIMULATION_SCRIPTS,...RENDERER_SCRIPTS]);
const {Battlefield,BattlefieldBuilder,MeridianGame,TerrainModels,MeridianRenderer,battlefieldStartSites,westmarkPlan,
  westmarkBridgePoint,westmarkRiver,UNITS,UNIT_BODY_SCALE,MERIDIAN_TEXTURES}=vm.runInContext(
  '({Battlefield,BattlefieldBuilder,MeridianGame,TerrainModels,MeridianRenderer,battlefieldStartSites,westmarkPlan,westmarkBridgePoint,westmarkRiver,UNITS,UNIT_BODY_SCALE,MERIDIAN_TEXTURES})',context);
const lane=(b,u,v)=>({x:b.x+u*Math.cos(b.yaw)+v*Math.sin(b.yaw),z:b.z-u*Math.sin(b.yaw)+v*Math.cos(b.yaw)});

for(const seed of [1409,43015,7919])test(`Westmark ${seed}: all public starts and resources connect with vehicle clearance`,()=>{
  const w=new Battlefield(seed,'westmark',4),plan=westmarkPlan(w.layout),starts=battlefieldStartSites(w),
    radius=UNITS.tank.size*UNIT_BODY_SCALE;
  assert.equal(starts.length,4);assert.equal(w.layout.resourceSites.length,8);
  assert.ok(w.surface.maxHeight>10,'decorative mountains must not force HQs onto their summits');
  for(const p of starts){assert.equal(w.surface.heightAt(p.x,p.z),10);assert.ok(w.surface.foundation(p,7));}
  for(const p of [...w.layout.resourceSites,...plan.vents])assert.ok(w.surface.foundation(p,3),JSON.stringify(p));
  for(const a of starts)for(const b of [...starts,...w.layout.resourceSites,...plan.vents]) {
    const path=w.path(a.x,a.z,b.x,b.z,false,undefined,radius);
    assert.equal(path.status,'complete',JSON.stringify({a,b}));
    let previous=a;
    for(const p of path.points){assert.ok(w.lineFree(previous,p,radius));previous=p;}
  }
  for(const p of starts)assert.equal(w.surface.visibilityLevelAt(p.x,p.z),0,'no implicit new high-ground rule');
  const trees=w.renderData.placements.filter(p=>p.mesh==='westmarkSpruce'),
    anchors=trees.filter(p=>p.scale[0]>=.64),young=trees.filter(p=>p.scale[0]<.64);
  assert.ok(anchors.length>0&&young.length>=anchors.length,'existing groves gain at least one younger tree per anchor on average');
  assert.ok(young.length<=anchors.length*2,'bounded local density, not a new forest distribution');
  for(const p of young) {
    const [x,,z]=p.position;
    assert.ok(anchors.some(a=>Math.hypot(a.position[0]-x,a.position[2]-z)<2.36));
    assert.ok(plan.reserve(x,z)>=4.1&&plan.road(x,z)>=7.1&&!plan.bridgeAt(x,z,11.1));
    assert.ok(westmarkRiver(x,z).bank>=5.1);
    const cell=v=>Math.floor((v+w.extent)/w.cellSize);
    for(let row=cell(z-.6);row<=cell(z+.6);row++)for(let col=cell(x-.6);col<=cell(x+.6);col++)
      assert.equal(w.staticGrid[row*w.gridSize+col],1,'decorative trunks never occupy a traversable cell');
  }
});

test('all bridge decks admit opposing vehicles, prohibit foundations and preserve water barriers without the mutable grid',()=>{
  const g=new MeridianGame({upgrades:{}});g.start({seed:1409,map:'westmark'});
  const w=g.world,plan=westmarkPlan(w.layout),radius=UNITS.tank.size*UNIT_BODY_SCALE;
  for(const b of plan.bridges) {
    assert.equal(b.depth*2,22);
    assert.equal(w.surface.foundation(b,1.7),false,'even a small turret must not seal a bridge');
    for(const v of [-2.5,2.5])assert.ok(w.lineFree(lane(b,-b.width-5,v),lane(b,b.width+5,v),radius),
      `clear vehicle approach on bridge ${b.seed}`);
    const a=lane(b,-b.width+.5,-2.5),z=lane(b,b.width-.5,2.5),
      tank=g.spawnUnit('tank',a.x,a.z,0,0),other=g.spawnUnit('tank',z.x,z.z,0,0);
    assert.ok(tank&&other);
    for(let i=1;i<=80;i++) {
      const t=i/80,pa=lane(b,(-b.width+.5)*(1-2*t),-2.5),pb=lane(b,(b.width-.5)*(1-2*t),2.5);
      assert.ok(g.canStep(tank,pa.x,pa.z),`forward lane ${b.seed}, ${i}`);
      Object.assign(tank,pa);
      assert.ok(g.canStep(other,pb.x,pb.z),`opposite lane ${b.seed}, ${i}`);
      Object.assign(other,pb);
      assert.ok(Math.abs(w.surface.heightAt(pa.x,pa.z)-10)<1e-5);
    }
    tank.hp=other.hp=0;
    const center=lane(b,0,0),rail=lane(b,0,b.depth);
    assert.ok(w.surface.fits(center.x,center.z,radius));
    assert.equal(w.surface.segment(center,rail,radius),false,'parapet is a physical edge');
  }
  const river=westmarkRiver(0,-120),from={x:river.x-16,z:river.z},to={x:river.x+16,z:river.z};
  assert.equal(w.surface.fits(river.x,river.z,0),false);
  w.blocked.fill(0);
  assert.equal(w.lineFree(from,to,radius),false,'temporary obstacle overlays cannot turn water into a ford');
  assert.equal(w.surface.foundation({x:river.x,z:river.z},2.3),false);
});

test('build-only masks retain walkability and strict map bounds',()=>{
  const Surface=vm.runInContext('BattlefieldSurface',context),s=new Surface(10,2,()=>0);
  s.buildBlocked=new Uint8Array(100);s.buildBlocked[40]=1;
  assert.equal(s.foundation({x:6.9,z:-2},2),true,'near the right edge, unrelated cells must not block');
  assert.equal(s.foundation({x:7,z:-2},2),false,'the existing foundation margin must remain strictly inside');
  s.buildBlocked[49]=1;
  assert.equal(s.foundation({x:6.9,z:-2},2),false);
  assert.equal(s.fits(6.9,-2,2),true,'build exclusion is not a movement barrier');
});

test('four-player initialization retains standard resource amounts and grounded service access',()=>{
  const g=new MeridianGame({upgrades:{}});g.start({seed:1409,map:'westmark',enemies:[0,1,2]});
  const w=g.world,resources=g.s.entities.filter(e=>e.kind==='resource'),
    crystals=resources.filter(e=>e.type==='crystal'),vents=resources.filter(e=>e.type==='gas');
  assert.equal(g.s.entities.filter(e=>e.type==='hq').length,4);
  assert.equal(crystals.length,40);assert.equal(vents.length,8);
  for(const e of crystals){assert.ok(e.amount>=1800&&e.amount<2700);assert.ok(w.surface.fits(e.x,e.z));}
  for(const e of vents)assert.ok(w.surface.foundation(e,e.size));
  for(const hq of g.s.entities.filter(e=>e.type==='hq')) {
    const worker=g.spawnUnit('worker',hq.x+8,hq.z, hq.team,hq.faction);
    assert.ok(worker);assert.ok(g.unitFits(worker,worker.x,worker.z));
    const crystal=crystals.reduce((a,b)=>Math.hypot(a.x-hq.x,a.z-hq.z)<Math.hypot(b.x-hq.x,b.z-hq.z)?a:b);
    const path=w.path(worker.x,worker.z,crystal.x,crystal.z,false,{...crystal,radius:4},worker.size*UNIT_BODY_SCALE);
    assert.equal(path.status,'complete');
    assert.ok(w.terrainFree(path.points.at(-1),crystal));
  }
});

test('private cosmetic randomness cannot relocate Westmark blockers, starts or resources',()=>{
  const a=new Battlefield(1409,'westmark'),original=BattlefieldBuilder.prototype.cosmeticRandom;
  try {
    BattlefieldBuilder.prototype.cosmeticRandom=()=>()=>.5;
    const b=new Battlefield(1409,'westmark');
    assert.deepEqual(a.staticGrid,b.staticGrid);assert.deepEqual(a.surface.heights,b.surface.heights);
    assert.deepEqual(a.surface.buildBlocked,b.surface.buildBlocked);assert.deepEqual(a.layout,b.layout);
    assert.deepEqual(a.rocks,b.rocks);
  }finally{BattlefieldBuilder.prototype.cosmeticRandom=original;}
});

test('Westmark mesh descriptors use bounded finite geometry and CPU surface samples',()=>{
  const w=new Battlefield(1409,'westmark'),plan=westmarkPlan(w.layout),counts={};
  for(const d of w.renderData.geometries) {
    const mesh=TerrainModels.geometry(d);assert.equal(mesh.length%27,0);counts[d.mesh]=mesh.length/27;
    assert.ok(mesh.length>0);
    for(let i=0;i<mesh.length;i+=9) {
      for(let k=0;k<9;k++)assert.ok(Number.isFinite(mesh[i+k]),`${d.mesh} finite attribute`);
      assert.ok(Math.abs(Math.hypot(mesh[i+3],mesh[i+4],mesh[i+5])-1)<1e-5);
      if(d.mesh==='terrain'&&!plan.bridgeAt(mesh[i],mesh[i+2]))
        assert.ok(Math.abs(mesh[i+1]+.13-w.surface.heightAt(mesh[i],mesh[i+2]))<2e-5);
      if(d.mesh==='westmarkSpruce')assert.ok(mesh[i+6]>=0&&mesh[i+6]<=1&&mesh[i+7]>=0&&mesh[i+7]<=1);
    }
  }
  const triangles=w.renderData.placements.reduce((sum,p)=>sum+(counts[p.mesh]??100),0);
  // Denser groves add up to two young trees per existing anchor, sharing the same meshes.
  assert.ok(triangles<400000,`static world budget excluding shadow repetition: ${triangles}`);
  for(const b of plan.bridges) {
    const hit=w.surface.ray([b.x,50,b.z],[b.x,0,b.z]);
    assert.ok(hit&&Math.hypot(hit.x-b.x,hit.z-b.z)<1e-6,'picking selects the deck, not the river bed');
  }
});

test('spruce crowns fill every height/azimuth band within a bounded, deterministic tree envelope',()=>{
  const build=seed=>TerrainModels.geometry({mesh:'westmarkSpruce',model:'westmarkSpruce',seed,extent:160});
  for(const seed of [1409,43015,7919]) {
    const mesh=build(seed),bands=Array.from({length:4},()=>Array(8).fill(0));
    assert.deepEqual(mesh,build(seed));
    assert.ok(mesh.length/27<=520,'per-tree triangle budget, before shadow repetition');
    let minNY=1,maxNY=0;
    for(let i=0;i<mesh.length;i+=9) {
      const [x,y,z,nx,ny,nz,u,v,shade]=mesh.slice(i,i+9);
      assert.ok(Math.hypot(x,z)<=3&&y>=.4&&y<=11.5,'keep the original crown envelope');
      assert.ok(Math.abs(Math.hypot(nx,ny,nz)-1)<1e-5);
      assert.ok(u>=0&&u<=1&&v>=0&&v<=1&&shade>=.8&&shade<=1);
      minNY=Math.min(minNY,Math.abs(ny));maxNY=Math.max(maxNY,Math.abs(ny));
    }
    for(let i=0;i<mesh.length;i+=27) {
      const x=(mesh[i]+mesh[i+9]+mesh[i+18])/3,
        y=(mesh[i+1]+mesh[i+10]+mesh[i+19])/3,z=(mesh[i+2]+mesh[i+11]+mesh[i+20])/3,
        band=Math.floor((y-2)/2),sector=Math.floor((Math.atan2(z,x)+Math.PI)/Math.PI*4)%8;
      if(band>=0&&band<4)bands[band][sector]++;
    }
    // Geometry coverage only: alpha/lighting and the final silhouette still need human review.
    assert.ok(bands.every(b=>b.every(n=>n>=4)),'no sparsely populated side of the crown');
    assert.ok(minNY<.5&&maxNY>.9,'sprays must not all lie in nearly horizontal planes');
  }
  assert.notDeepEqual(build(1409),build(7919),'mesh-local variation remains seed based');
});

test('Westmark albedos preserve canonical WebP bytes and are only requested by the landscape profile',()=>{
  const w=new Battlefield(1409,'westmark'),names=MeridianRenderer.prototype.textureNames(w.definition.render);
  for(const [key,file]of Object.entries({westmarkMeadow:'meadow',westmarkGranite:'granite',westmarkEarth:'earth',westmarkBark:'bark',westmarkSpruce:'spruce'})) {
    assert.ok(names.has(key));
    assert.deepEqual(Buffer.from(MERIDIAN_TEXTURES[key].split(',')[1],'base64'),readFileSync(join(__dirname,`../assets/textures/texture-westmark-${file}.webp`)));
  }
  const desert=vm.runInContext('BATTLEFIELDS.desert.render',context);
  assert.ok([...MeridianRenderer.prototype.textureNames(desert)].every(name=>!name.startsWith('westmark')));
  assert.equal(names.has('ground'),false);assert.equal(names.has('desertRock'),false);
});
