// Bounded surface/navigation/presentation checks, not autonomous AI or simulation long runs.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {createRendererStub} = require('./helpers/renderer-stub.cjs');
const {loadScripts, BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS, RENDERER_SCRIPTS} = require('./helpers/game-scripts.cjs');
const context = loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world','effects',...SIMULATION_SCRIPTS,
  ...RENDERER_SCRIPTS,'world-view','effects-view'], {globals:{innerHeight:800}});
const {Battlefield: ProceduralBattlefield, BattlefieldSurface, MeridianGame, MeridianRenderer, MeridianEffects, BattlefieldView, renderEntity,
  BATTLEFIELDS, UNITS, UNIT_BODY_SCALE, modelFrameRotation} = vm.runInContext(
  '({Battlefield, BattlefieldSurface, MeridianGame, MeridianRenderer, MeridianEffects, BattlefieldView, renderEntity, BATTLEFIELDS, UNITS, UNIT_BODY_SCALE, modelFrameRotation})',context);
const deckHeight=w=>Math.fround(6*w.renderProfile.variation.heightScale);
// A synthetic ramp/cliff fixture isolates surface contracts from procedural catalog geography.
function withRamp(run) {
  const original = BATTLEFIELDS.mothership;
  BATTLEFIELDS.mothership = { ...original, createSize: () => ({ extent: 120, cellSize: 2.5 }),
    createLayout: () => ({ startSites: [], resourceSites: [-60,-20,20,60].flatMap(x => [-60,70].map(z => ({x,z}))),
      corridors: [] }),
    generate(builder) {
      const w = builder.world, h = 6 * w.renderProfile.variation.heightScale;
      w.surface = new BattlefieldSurface(w.extent, w.cellSize,
        (x,z) => h * (Math.abs(x) < 90 ? Math.max(0, Math.min(1, (z-31)/11)) : z >= 42 ? 1 : 0),
        height => height >= h / 2 ? 1 : 0);
      w.staticGrid.set(w.surface.cliffs); w.terrainFeatureGrid.set(w.surface.cliffs); builder.ground();
      const size=w.surface.size+2,step=w.surface.step,heights=new Float32Array(size*size);
      for(let z=0;z<size;z++)for(let x=0;x<size;x++)
        heights[z*size+x]=w.surface.heightAt((x-1)*step-w.extent,(z-1)*step-w.extent)-.13;
      w.renderData.geometries.push({mesh:'terrain',model:'landscapeRelief',relief:{extent:w.extent,step,size,heights,innerExtent:0}});
    }
  };
  try { return run(); } finally { BATTLEFIELDS.mothership = original; }
}
function Battlefield(seed, map = 'mothership', count = 2) {
  return map === 'mothership' ? withRamp(() => new ProceduralBattlefield(seed, map, count)) : new ProceduralBattlefield(seed, map, count);
}
function game() {
  const g = new MeridianGame({upgrades:{}});
  withRamp(() => g.start({seed:1409,map:'mothership',deployment:'exploration'}));
  g.s.parties.forEach(p=>p.controller={kind:'human'});
  g.checkBattleResult = () => {}; // Movement/effect unit fixtures do not test victory resolution.
  return g;
}

test('surface height and ray use the same diagonal, including non-planar quads',()=>{
  const s = new BattlefieldSurface(10,2.5,(x,z)=>x===0&&z===0?4:0);
  for (const [x,z,expected] of [[0,0,4],[.625,.625,2],[.625,0,2],[0,.625,2]]) {
    assert.equal(s.heightAt(x,z),expected);
    const hit = s.ray([x,20,z],[x,-20,z]); assert.ok(hit);
    assert.ok(Math.abs(hit.x-x)<1e-8 && Math.abs(hit.z-z)<1e-8);
  }
  assert.equal(s.ray([30,20,30],[30,-20,30]),null);
  assert.ok(Number.isFinite(s.heightAt(1e6,-1e6)));
  assert.equal(s.visibilityLevelAt(0,0),0,'flat surfaces retain one visibility tier by default');
});

test('ground sight respects declared tiers while sources combine and air or scans see every tier',()=>{
  const w=new Battlefield(1409,'mothership'), entity=(id,team,type,x,z)=>({
    id,team,type,x,z,kind:'unit',hp:100,vision:17
  }), low=entity(1,0,'rifle',80,30), high=entity(2,1,'rifle',80,42), highAlly=entity(3,0,'rifle',76,42);
  assert.equal(w.surface.visibilityLevelAt(80,36),0,'lower half of the ramp belongs to the low tier');
  assert.equal(w.surface.visibilityLevelAt(80,37),1,'upper half of the ramp belongs to the plateau tier');
  w.reveal([low,high]);
  const lowCell=w.idx(80,30), highCell=w.idx(80,42);
  assert.equal(w.sight[0].visible[lowCell],255,'same-tier ground remains visible');
  assert.equal(w.sight[0].visible[highCell],0,'low ground cannot reveal the plateau');
  assert.equal(w.sight[0].explored[highCell],0,'blocked current sight does not explore a new plateau');
  assert.equal(w.sight[1].visible[lowCell],255,'plateau observers see lower ground within normal range');
  w.reveal([low,high,highAlly]);
  assert.equal(w.sight[0].visible[highCell],255,'one allied high observer contributes plateau sight');
  w.reveal([low,high]);
  assert.equal(w.sight[0].visible[highCell],0,'plateau sight disappears with the high observer');
  assert.equal(w.sight[0].explored[highCell],1,'previously explored plateau terrain remains remembered');
  w.reveal([entity(4,0,'air',80,30),high]);
  assert.equal(w.sight[0].visible[highCell],255,'aircraft see independently of ground tier');
  w.reveal([low,high],[{team:0,x:80,z:30,r:17,until:10}]);
  assert.equal(w.sight[0].visible[highCell],255,'reconnaissance scans cross visibility tiers');
});

test('surface transition mask survives replacement of dynamic occupancy, and paths cannot smooth across cliffs',()=>{
  const w = new Battlefield(1409,'mothership'); w.blocked.fill(0);
  const a={x:100,z:30}, b={x:100,z:65};
  assert.equal(w.lineFree(a,b),false);
  const route=w.path(a.x,a.z,b.x,b.z,false,undefined,1);
  assert.equal(route.status,'complete'); assert.ok(route.points.length>1);
  let from=a; for(const p of route.points) {assert.ok(w.terrainFree(from,p,1));from=p;}
  assert.equal(w.surface.fits(100,44,2),false,'body clearance before the cliff');
  for(const radius of [1,2,3]) for(let x=-110;x<=110;x+=7) for(let z=-110;z<=110;z+=7) {
    if(w.surface.fits(x,z,radius)) assert.ok(w.surface.segment({x,z},{x,z},radius),'accepted positions are not trapped in expanded cliff bounds');
  }
});

test('ground step, yield and placement cannot tunnel across a cliff; aircraft can cross',()=>{
  const g=game(); g.s.entities=[];g.ids.clear();g.world.rebuild([]);
  const w=g.spawnUnit('worker',100,30,0,0), air=g.spawnUnit('air',100,30,0,0);
  assert.ok(w&&air);
  assert.equal(g.canStep(w,100,65),false);
  assert.equal(g.canStep(air,100,65),true);
  w.yieldTo={x:100,z:65};w.yieldUntil=10;g.moveYield(w,10);
  assert.equal(w.z,30,'large dt must not tunnel');
  assert.equal(g.unitPosition({type:'worker',size:UNITS.worker.size,x:100,z:42}),null,'no teleport from a cliff into a nearby plateau');
  const height=g.world.surface;
  assert.ok(height.entityHeight(air)>=height.heightAt(air.x,air.z));
  assert.ok(height.entityHeight(air)<=deckHeight(g.world),'local climb, not a global maximum datum');
  air.z=65;assert.ok(Math.abs(height.entityHeight(air)-deckHeight(g.world))<1e-6,'cruise clears the upper deck');
});

test('both flight classes use continuous local envelopes and clear their complete footprints over narrow peaks',()=>{
  let reads=0;
  const s=new BattlefieldSurface(90,2.5,(x,z)=>{reads++;return x>=20&&x<=25&&Math.abs(z)<=5?30:0;}),before=reads;
  for(const [type,radius,belly] of [['air',3.5,0],['destroyer',10,-2.5]]) {
    const far={type,x:-75,z:-75};assert.equal(s.entityHeight(far),type==='air'?0:3,'distant peaks do not lift valley flight');
    let previous;
    for(let x=-40;x<=60;x+=.25) {
      const e=Object.freeze({type,x,z:0}),h=s.entityHeight(e);
      if(previous!==undefined)assert.ok(Math.abs(h-previous)<=.5*.25+1e-5,'bounded gradual climb/descent');
      previous=h;
      // Include worst downward bob and the lower destroyer belly, not just the origin.
      const bottom=h+3.8-.22+belly;
      for(let z=-radius;z<=radius;z+=1.25)for(let dx=-radius;dx<=radius;dx+=1.25)
        assert.ok(bottom>s.heightAt(x+dx,z)+.5,`${type} hull clearance at ${x+dx}/${z}`);
    }
  }
  assert.equal(reads,before,'queries use precomputed samples only');
  assert.equal(s.entityHeight({type:'tank',x:20,z:0}),30,'ground units remain on the terrain');
});

test('local flight clearance covers the six procedural map surfaces',()=>{
  for(const [map,seed] of [['alien-planet',9],['desert',1409],['mothership',1409],['westmark',1409],['frontier',3],['haven',1409]]) {
    const w=new ProceduralBattlefield(seed,map),s=w.surface;
    let peak={x:0,z:0},highest=-Infinity;
    for(let i=0;i<w.staticGrid.length;i++) {
      const p=w.point(i),h=s.heightAt(p.x,p.z);
      if(Math.max(Math.abs(p.x),Math.abs(p.z))<w.extent-12&&h>highest){peak=p;highest=h;}
    }
    for(const p of [peak,{x:0,z:0},...w.layout.startSites])for(const [type,radius,belly] of [['air',3.5,0],['destroyer',10,-2.5]]) {
      const e={...p,type},bottom=s.entityHeight(e)+3.8-.22+belly;
      for(let z=-radius;z<=radius;z+=2.5)for(let x=-radius;x<=radius;x+=2.5)
        assert.ok(bottom>s.heightAt(p.x+x,p.z+z)+.5,`${map}/${type}: full hull clears terrain`);
    }
    assert.ok(s.entityHeight({...peak,type:'destroyer'})>s.entityHeight({...peak,type:'air'}),'heavy ships do not fly below light aircraft');
  }
});

test('launch altitude is shared by models and effects, without double lowering or hillside intersections',()=>{
  const flat=new BattlefieldSurface(30,2.5,()=>0),wall=new BattlefieldSurface(30,2.5,x=>x>=0?30:0);
  for(const type of ['air','destroyer']) {
    const exit={building:99,x:4,z:0,length:24},datum=type==='air'?0:3;
    for(const x of [-20,-8,4]) {
      const e={id:3,kind:'unit',type,x,z:0,exit,hp:100,faction:0,team:0,size:UNITS[type].size},
        remaining=(4-x)/24,expected=datum-3*remaining;
      assert.equal(flat.entityHeight(e),expected);
      const calls=drawPose(e,flat),noExit=drawPose({...e,exit:undefined},flat);
      calls.forEach((c,i)=>assert.ok(Math.abs(c[2]-noExit[i][2]+3*remaining)<1e-6,'launch lowering applied once'));
      const effects=new MeridianEffects(()=>{throw Error('flight height RNG');});effects.entityHeight=p=>flat.entityHeight(p);
      effects.shot(e,{...e,exit:undefined});const shot=effects.fx.at(-1);
      assert.equal(shot.y,expected+4.5);assert.equal(shot.ty,datum+4.5);
      const bottom=wall.entityHeight(e)+3.8-.22+(type==='destroyer'?-2.5:0),radius=type==='destroyer'?10:3.5;
      for(let dx=-radius;dx<=radius;dx+=1)assert.ok(bottom>wall.heightAt(x+dx,0)+.5,'launch never blends the hull into a cliff');
    }
  }
});

test('worker crosses a ramp up and down using ordinary orders',()=>{
  const g=game();g.s.entities=[];g.ids.clear();g.world.rebuild([]);
  const w=g.spawnUnit('worker',72,10,0,0); assert.ok(w);
  for (const goal of [{x:72,z:65},{x:72,z:10}]) {
    g.setOrder(w,{type:'move',...goal}); let arrived=false;
    for(let i=0;i<320&&!arrived;i++) {g.s.time+=.05;arrived=g.move(w,goal,.05);assert.ok(g.unitFits(w,w.x,w.z));}
    assert.ok(arrived,JSON.stringify(w));
  }
});

test('foundations reject slopes/cliff edges; legal plateau production exits remain on its level',()=>{
  const g=game();g.world.sight[0].explored.fill(1);
  g.s.entities=[];g.ids.clear();g.world.rebuild([]);
  const worker=g.spawnUnit('worker',-72,78,0,0);assert.ok(worker);
  assert.equal(g.world.surface.foundation({x:72,z:36.5},4),false);
  assert.notEqual(g.canBuild('depot',{x:72,z:36.5}),'');
  assert.equal(g.world.surface.foundation({x:90,z:36.5},4),false);
  assert.notEqual(g.canBuild('depot',{x:90,z:36.5}),'');
  assert.equal(g.canBuild('depot',{x:72,z:65}),'');
  assert.ok(g.world.surface.foundation({x:100,z:-72.5},4.4));
  const terrainFree=g.world.terrainFree;
  try {
    g.world.terrainFree=()=>false; // Isolate exit rejection from catalog-specific geography.
    assert.match(g.canBuild('hq',{x:100,z:-72.5}),/production exits/);
  } finally {g.world.terrainFree=terrainFree;}
  const h=g.spawnBuilding('hq',72,65,0,0);g.world.rebuild(g.s.entities);
  const u=g.produceUnit(h,'worker');assert.ok(u?.exit);
  assert.equal(g.world.surface.heightAt(u.exit.x,u.exit.z),deckHeight(g.world));
  assert.ok(g.world.terrainFree(u,u.exit,u.size*UNIT_BODY_SCALE));
});

test('close worker cannot repair or deliver through a cliff and area navigation seeks the accessible level',()=>{
  const g=game();g.s.entities=[];g.ids.clear();g.world.rebuild([]);
  const b=g.spawnBuilding('hq',110,45,0,0), w=g.spawnUnit('worker',110,39,0,0);
  assert.ok(w);b.hp-=100;w.order={type:'repair',id:b.id};
  const hp=b.hp;g.worker(w,.05);assert.equal(b.hp,hp);
  w.order={type:'mine',id:999};w.carry=18;w.returning=true;
  const alloy=g.account(0).alloy;g.worker(w,.05);assert.equal(g.account(0).alloy,alloy);
  assert.equal(w.carry,18);
  const route=g.world.path(110,39,110,45,false,{x:110,z:45,radius:8});
  assert.equal(route.status,'complete');assert.ok(Math.hypot(route.goal.x-110,route.goal.z-45)<=8);
});

test('CPU effect origins, targets, shell landing and particle floor include surface height without extra RNG draws',()=>{
  const g=game(), a={x:72,z:65,type:'tank',kind:'unit',team:0,faction:0,rot:0,size:1},
    b={...a,x:0,z:0}; let draws=0;
  g.effects.random=()=>{draws++;return .5;};
  g.effects.shot(a,b);let f=g.effects.fx.at(-1);
  assert.equal(f.y,deckHeight(g.world)+1.45);assert.equal(f.ty,1);
  g.effects.shell(b,a,.85);f=g.effects.fx.at(-1);assert.equal(f.endY,deckHeight(g.world));
  assert.equal(draws,0);
  g.effects.explosion(72,65);const before=draws;
  const flat=new MeridianEffects(()=>.5);flat.explosion(72,65);
  for(const [i,fx] of g.effects.fx.slice(2).entries()) if('y' in fx) assert.ok(Math.abs(fx.y-flat.fx[i].y-deckHeight(g.world))<1e-6);
  g.effects.tick(.05);assert.equal(draws,before);
});

test('terrain picking roundtrips both plateaus and ramp while camera drag keeps its flat plane',()=>{
  const w=new Battlefield(1409,'mothership'),r=Object.create(MeridianRenderer.prototype);
  Object.assign(r,{viewport:{left:0,top:0,right:1200,bottom:800,width:1200,height:800},quality:0,surface:w.surface});
  r.camera(42,30,85);
  for(const [x,z] of [[72,65],[72,36.5],[0,0],[-72,-65]]) {
    const screen=r.project(x,w.surface.heightAt(x,z),z),hit=r.ground(screen.x,screen.y);
    assert.ok(Math.hypot(hit.x-x,hit.z-z)<1e-4,JSON.stringify({x,z,hit}));
    const flat=r.ground(screen.x,screen.y,false),p=r.project(flat.x,0,flat.z);
    assert.ok(Math.hypot(p.x-screen.x,p.y-screen.y)<1e-4);
  }
});

test('rendered floor samples and models use the CPU surface in battle and menu cinema, and map changes replace it',()=>{
  const w=new Battlefield(1409,'mothership'),r=createRendererStub({record:true}),meshes=new Map();
  r.geometry=(name,data)=>{meshes.set(name,data);};r.quality=0;
  const view=new BattlefieldView(r);view.sync(w);
  const mesh=meshes.get('terrain'),floorVertices=(w.surface.size-1)**2*6;
  for(let i=0;i<floorVertices*9;i+=9) {
    assert.ok(Math.abs(mesh[i+1]+.13-w.surface.heightAt(mesh[i],mesh[i+2]))<1e-6);
    assert.ok(Math.abs(Math.hypot(mesh[i+3],mesh[i+4],mesh[i+5])-1)<1e-6);
  }
  for(const cinema of [false,true]) {
    r.cinema=cinema;
    for(const e of [{id:1,x:72,z:65,kind:'unit',type:'worker',hp:100,faction:0,team:0,size:.65},
      {id:2,x:72,z:65,kind:'resource',type:'gas',hp:100,faction:0,team:-1,size:2},
      {id:3,x:72,z:65,kind:'building',type:'depot',hp:100,faction:0,team:0,size:2.3,progress:.3},
      {id:4,x:72,z:65,kind:'resource',type:'crystal',hp:100,faction:0,team:-1,size:2,amount:1800}]) {
      r.calls=[];r.surface=null;renderEntity(r,e,1);const flat=r.calls;
      r.calls=[];r.surface=w.surface;renderEntity(r,e,1);
      assert.equal(r.calls.length,flat.length);
      r.calls.forEach((call,i)=>assert.ok(Math.abs(call[2]-flat[i][2]-deckHeight(w))<1e-6));
    }
  }
  const alien=new Battlefield(1409,'alien-planet');view.sync(alien);
  assert.strictEqual(r.surface,alien.surface);assert.notStrictEqual(r.surface,w.surface);
});

// Independent sequential rotations, also used to inspect the actual instance matrices.
function rotatePart([x,y,z],ry,rx,rz) {
  [x,y]=[x*Math.cos(rz)-y*Math.sin(rz),x*Math.sin(rz)+y*Math.cos(rz)];
  [y,z]=[y*Math.cos(rx)-z*Math.sin(rx),y*Math.sin(rx)+z*Math.cos(rx)];
  return [x*Math.cos(ry)+z*Math.sin(ry),y,-x*Math.sin(ry)+z*Math.cos(ry)];
}
const axes=[[1,0,0],[0,1,0],[0,0,1]], normalize=v=>v.map(n=>n/Math.hypot(...v)),
  cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  applyFrame=(f,v)=>axes.map((_,i)=>f[0][i]*v[0]+f[1][i]*v[1]+f[2][i]*v[2]);
function closeVector(actual,expected,message) {
  assert.ok(Math.hypot(...actual.map((v,i)=>v-expected[i]))<1e-6,`${message}: ${actual} != ${expected}`);
}
function drawPose(e,surface,quality=0) {
  const r=createRendererStub({record:true});Object.assign(r,{surface,quality});
  renderEntity(r,Object.freeze(e),1);return r.calls;
}

test('vehicles follow uphill, downhill and cross slopes as rigid assemblies, preserving heading and hover',()=>{
  const surface=new BattlefieldSurface(10,2.5,(x,z)=>4+x*.25+z*.375), up=normalize([-.25,1,-.375]);
  for(const faction of [0,1,2]) for(const type of ['worker','tank','artillery']) {
    const e={id:4,x:0,z:0,rot:0,kind:'unit',type,hp:100,faction,team:0,size:UNITS[type].size,walk:2,carry:10},
      hover=faction===2?.3+Math.sin(2+e.id)*.08:0, flat=drawPose(e,null);
    for(const rot of [0,Math.PI/2,Math.PI,Math.PI*1.5,.7]) {
      const forward=normalize([Math.sin(rot),.25*Math.sin(rot)+.375*Math.cos(rot),Math.cos(rot)]),
        frame=[cross(up,forward),up,forward], calls=drawPose({...e,rot},surface);
      assert.equal(calls.length,flat.length);
      for(const [i,c] of calls.entries()) {
        const local=flat[i], position=applyFrame(frame,[local[1],local[2]-hover,local[3]]);
        position[1]+=4+hover;
        closeVector(c.slice(1,4),position,`${faction}/${type} part ${i} position`);
        for(const axis of axes) closeVector(rotatePart(axis,...c.slice(8,11)),
          applyFrame(frame,rotatePart(axis,...local.slice(8,11))),`${faction}/${type} part ${i} orientation`);
        assert.deepEqual(c.slice(4,8),local.slice(4,8),'scale and color are unchanged');
        assert.deepEqual(c.slice(11),local.slice(11),'material, glow and layer are unchanged');
      }
    }
  }
});

test('vehicle rotation composition handles vertical part pitch without tearing attached geometry',()=>{
  const root=[.5,.3,0], frame=axes.map(axis=>rotatePart(axis,...root));
  for(const pitch of [Math.PI/2,-Math.PI/2]) {
    const local=[0,pitch-.3,.8], result=modelFrameRotation(frame.flat(),...local);
    for(const axis of axes) closeVector(rotatePart(axis,...result),rotatePart(rotatePart(axis,...local),...root),'vertical part');
  }
});

test('vehicle ramp joins remain continuous and nearby cliffs cannot overturn the chassis',()=>{
  const surface=new BattlefieldSurface(10,2.5,(_x,z)=>Math.max(0,Math.min(2.5,z*.25))),
    e={id:1,x:0,z:0,rot:0,kind:'unit',type:'tank',hp:100,faction:0,team:0,size:UNITS.tank.size};
  // The tank hull is the first rigid part. Crossing a CPU triangle/ramp edge must not snap its normal.
  for(const boundary of [-e.size,0,1.25,e.size,2.5]) {
    const a=drawPose({...e,z:boundary-1e-5},surface)[0],b=drawPose({...e,z:boundary+1e-5},surface)[0];
    assert.ok(Math.hypot(...rotatePart(axes[1],...a.slice(8,11)).map((v,i)=>v-rotatePart(axes[1],...b.slice(8,11))[i]))<1e-5);
  }
  const cliff=new BattlefieldSurface(10,2.5,(_x,z)=>z>0?20:0),call=drawPose(e,cliff)[0],up=rotatePart(axes[1],...call.slice(8,11));
  assert.ok(up.every(Number.isFinite));assert.ok(up[1]>=1/Math.hypot(1,.65)-1e-6);
  assert.deepEqual(drawPose({...e,z:-4},surface),drawPose({...e,z:-4},null),'flat floor keeps the original draw calls');
});

test('slope alignment leaves infantry, aircraft, buildings and resources upright and does not mutate terrain',()=>{
  const surface=new BattlefieldSurface(10,2.5,(x,z)=>4+x*.25+z*.375), heights=Array.from(surface.heights), cliffs=Array.from(surface.cliffs);
  for(const [kind,type] of [['unit','rifle'],['unit','medic'],['unit','hero'],['unit','air'],['unit','destroyer'],['building','depot'],['resource','gas']]) {
    const e={id:2,x:0,z:0,rot:.7,kind,type,hp:100,faction:0,team:0,size:1,progress:1},flat=drawPose(e,null),drawn=drawPose(e,surface),
      calls=kind==='building'?drawn.slice(1):drawn;
    if(kind==='building')assert.equal(drawn[0][0],'terrainFooting','slope support is separate from upright model parts');
    assert.equal(calls.length,flat.length);
    calls.forEach((c,i)=>{
      assert.ok(Math.abs(c[2]-flat[i][2]-surface.entityHeight(e))<1e-6);
      assert.deepEqual(c.filter((_,j)=>j!==2),flat[i].filter((_,j)=>j!==2));
    });
  }
  drawPose({id:1,x:0,z:0,rot:.7,kind:'unit',type:'tank',hp:100,faction:0,team:0,size:1.3},surface);
  assert.deepEqual(Array.from(surface.heights),heights);assert.deepEqual(Array.from(surface.cliffs),cliffs);
});

test('cinematic foundations relocate off steep terrain, respect blockers and spacing, or are omitted',()=>{
  const find = vm.runInContext('cinematicBuildingPosition',context), extent=40, cell=2.5, n=32,
    world={gridSize:n,staticGrid:new Uint8Array(n*n),
      idx:(x,z)=>Math.floor((z+extent)/cell)*n+Math.floor((x+extent)/cell),
      surface:new BattlefieldSurface(extent,cell,(x)=>20+Math.max(0,x)*.4)};
  const preferred={x:12,z:0}, before=Array.from(world.surface.heights), placed=[];
  const p=find(world,preferred,3,placed);
  assert.ok(p);assert.ok(world.surface.foundation(p,3));assert.notDeepEqual({...p},preferred);
  assert.deepEqual({...find(world,preferred,3,placed)},{...p},'deterministic without RNG');
  placed.push({kind:'building',size:3,...p});
  const q=find(world,preferred,3,placed);
  assert.ok(q);assert.ok(Math.hypot(q.x-p.x,q.z-p.z)>=8);
  world.staticGrid.fill(1);assert.equal(find(world,preferred,3,[]),null);
  assert.deepEqual(Array.from(world.surface.heights),before,'search never changes terrain');
  world.staticGrid.fill(0);world.surface=new BattlefieldSurface(extent,cell,x=>20+x*.4);
  assert.equal(find(world,preferred,3,[]),null,'no suitable nearby ground means no cinematic prop');
});

test('terrain footings have level seats, rounded shoulders and wider buried toes',()=>{
  const geom=vm.runInContext('geom',context), mesh=geom.terrainFooting();
  assert.deepEqual(mesh,geom.terrainFooting(),'fixed reusable geometry');
  let top=0,bottom=0,sloped=0;
  for(let i=0;i<mesh.length;i+=9){
    const [x,y,z,nx,ny,nz]=mesh.slice(i,i+6);
    assert.ok([x,y,z,nx,ny,nz].every(Number.isFinite));
    if(y===.5)top=Math.max(top,Math.abs(x),Math.abs(z));
    if(y===-.5)bottom=Math.max(bottom,Math.abs(x),Math.abs(z));
    if(ny>0&&ny<.99)sloped++;
  }
  assert.ok(Math.abs(top-1)<1e-12);assert.ok(bottom>top);assert.ok(sloped>0,'no sheer support walls');
});

test('GPU instances retain the complete vehicle slope pose without mutating entities',()=>{
  const w=new Battlefield(1409,'mothership'),
    e={id:1,x:72,z:34,rot:0,walk:0,kind:'unit',type:'worker',hp:100,faction:0,team:0,size:UNITS.worker.size}, before=JSON.stringify(e),
    calls=drawPose(e,w.surface),hull=calls.find(c=>c[0]==='workerHull');
  assert.ok(hull[9]<0,'front rises along the ramp');
  const radius=Math.max(.75,e.size),slope=(w.surface.heightAt(e.x,e.z+radius)-w.surface.heightAt(e.x,e.z-radius))/(2*radius);
  closeVector(rotatePart(axes[1],...hull.slice(8,11)),normalize([0,1,-slope]),'ground normal');
  const r=Object.create(MeridianRenderer.prototype);
  Object.assign(r,{dynamic:{},effects:{},meshes:{},colors:new Map(),gl:{createBuffer:()=>({})}});
  for(const c of calls) r.add(...c);
  const matrix=r.dynamic.workerHull.data;
  for(let i=0;i<3;i++) closeVector(Array.from(matrix.slice(i*4,i*4+3)),rotatePart(axes[i],...hull.slice(8,11)),'GPU basis');
  closeVector(Array.from(matrix.slice(12,15)),hull.slice(1,4),'GPU origin');
  assert.equal(JSON.stringify(e),before,'no authoritative pose mutation');
});

test('all eight vents admit real refinery placement and air recovery ignores cliff masks',()=>{
  const g=game();g.world.sight[0].explored.fill(1);assert.ok(g.spawnUnit('worker',0,0,0,0));
  for(const vent of g.s.entities.filter(e=>e.type==='gas'))
    assert.equal(g.canBuild('refinery',vent),'',`vent at ${vent.x},${vent.z}`);
  const air=g.spawnUnit('air',80,30,0,0);assert.ok(air);
  g.pathTo(air,{x:80,z:50},true);
  assert.equal(air.pathStatus,'complete');
  assert.equal(air.path.length,1,'unit-avoidance recovery still flies straight over the cliff');
});

test('cliff drops reject before spending; a plateau drop reserves four real landing bodies',()=>{
  const g=game();g.s.entities=[];g.ids.clear();g.world.rebuild([]);
  g.spawnBuilding('hq',72,78,0,0);g.spawnUnit('worker',100,30,0,0);g.world.rebuild(g.s.entities);
  g.world.sight[0].explored.fill(1);g.account(0).energy=200;
  const energy=g.account(0).energy, cooldown=g.account(0).abilities.drop, count=g.s.entities.length;
  assert.equal(g.ability('drop',{x:100,z:42},0),false);
  assert.equal(g.account(0).energy,energy);assert.equal(g.account(0).abilities.drop,cooldown);
  assert.equal(g.s.entities.length,count);
  assert.equal(g.ability('drop',{x:72,z:65},0),true);
  const units=g.s.entities.filter(e=>e.type==='rifle');assert.equal(units.length,4);
  for(const e of units) {assert.equal(g.world.surface.heightAt(e.x,e.z),deckHeight(g.world));assert.ok(g.unitFits(e,e.x,e.z));}
});
