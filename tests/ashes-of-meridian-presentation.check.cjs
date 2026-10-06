// Fixed ground/effect references and deterministic landscape contracts: docs/reference-tests.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/presentation-v1.json');
const { worldSample, effectSample } = require('./helpers/presentation-scenario.cjs');
const vm = require('node:vm');
const { DIAGNOSTIC_SCRIPTS, BATTLEFIELD_SCRIPTS, RENDERER_SCRIPTS, SIMULATION_SCRIPTS, loadScripts } = require('./helpers/game-scripts.cjs');
const { createRendererStub } = require('./helpers/renderer-stub.cjs');
for (const { seed, map } of fixture.worlds) {
  test(`repeatable procedural presentation/navigation: ${seed} (${map})`, () => {
    const actual = worldSample(seed, map);
    assert.deepEqual(actual, worldSample(seed, map), 'new geometry, placement and navigation are seeded');
  });
}
test('world and simulation start and step without renderer, geometry or browser globals', () => {
  const context = loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'effects', ...SIMULATION_SCRIPTS], { globals: { structuredClone } });
  vm.runInContext('Math.random = () => { throw Error("Unseeded randomness"); }', context);
  const Game = vm.runInContext('MeridianGame', context), game = new Game({ upgrades: {} });
  game.start({ seed: 1409, faction: 0 });
  assert.deepEqual([game.s.parties[0].account.alloy,game.s.parties[0].account.gas],[650,0]);
  assert.deepEqual(Array.from(game.s.parties, p => p.controller.kind), ['human', 'ai']);
  assert.equal(game.alive(e => e.type === 'hq').length,0);
  assert.equal(game.train('worker'), false);
  assert.equal('R' in game, false); assert.equal('R' in game.world, false);
  game.s.parties.forEach(p => p.controller = {kind:'human'});
  game.step(.05); game.effects.tick(.05);
  assert.equal(game.s.time,.05);
  assert.ok(game.world.fogPixels.includes(255));
  assert.equal(vm.runInContext('typeof geom + ":" + typeof MAT + ":" + typeof document', context), 'undefined:undefined:undefined');
});

test('observer-relative entity colors do not rotate buildings or mutate model state', () => {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', 'world-view']);
  const render = vm.runInContext('renderEntity', context), R = createRendererStub({ record: true });
  R.cinema = false; R.quality = 0;
  for (const team of [0, 1, 2, 3]) {
    const e = Object.freeze({ id: 42, kind: 'building', type: 'hq', hp: 100, team, faction: 0, size: 4, x: 0, z: 0, progress: 1 });
    const draw = localTeam => { R.calls.length = 0; render(R, e, 0, { localTeam }); return R.calls.map(c => [...c]); };
    const own = draw(team), foreign = draw((team + 1) % 4);
    assert.deepEqual(own.map(c => c.filter((_, i) => i !== 7)), foreign.map(c => c.filter((_, i) => i !== 7)));
    assert.ok(own.some((c, i) => c[7] !== foreign[i][7]), 'ownership changes colors, not faction identity or transforms');
  }
});

test('effect markers use the local actor for scans, drops, fields and strike warnings', () => {
  const context = loadScripts(['core', 'content', 'effects', 'effects-view'], { globals: { clamp: (v, a, b) => Math.max(a, Math.min(b, v)) } });
  const render = vm.runInContext('renderBattlefieldEffects', context), R = createRendererStub({ record: true });
  R.quality = 0; R.beam = (...args) => R.calls.push(['beam', ...args]);
  const world = { visible: [0], idx: () => 0 }, s = { time: 0, entities: [], scans: [], fields: [], strikes: [] };
  const effects = { fx: [], combatBeams: new WeakMap() };
  const draws = team => { R.calls.length = 0; render(R, effects, world, s, [], 0, team); return R.calls.length; };
  for (const kind of ['scan', 'drop', 'field', 'strike']) {
    s.scans = []; s.fields = []; s.strikes = []; effects.fx = [];
    const p = { team: 2, x: 0, z: 0 };
    if (kind === 'scan') s.scans = [{ ...p, until: 10, r: 10 }];
    if (kind === 'drop') effects.fx = [{ ...p, type: 'drop', life: 1, maxLife: 1, color: 1 }];
    if (kind === 'field') s.fields = [{ ...p, until: 10, r: 10, type: 'repair' }];
    if (kind === 'strike') s.strikes = [{ ...p, at: 10, radius: 10, type: 'orbital' }];
    const before = JSON.stringify([s, effects.fx]);
    assert.equal(draws(0), 0, `${kind}: hidden foreign marker`);
    assert.ok(draws(2) > 0, `${kind}: own marker`);
    assert.equal(JSON.stringify([s, effects.fx]), before);
  }
});

test('occlusion records exact opaque model parts only for explicit in-battle opt-in', () => {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', 'world-view']);
  vm.runInContext('Math.random=()=>{throw Error("Render RNG");}', context);
  const render = vm.runInContext('renderEntity', context), R = createRendererStub({record:true});
  R.cinema = false;
  const recorded = [];
  R.recordOcclusion = (name, color) => recorded.push({part:R.calls.at(-1),name,color});
  for (const [kind,type] of [['unit','worker'],['building','hq'],['resource','gas'],['resource','crystal']]) {
    const e = Object.freeze({id:42,kind,type,hp:100,team:kind==='resource'?-1:2,faction:1,size:2,x:12,z:-23,rot:.3,walk:1,progress:.4});
    for (const quality of [0,1,2]) {
      R.quality = quality; R.calls.length = 0; recorded.length = 0;
      render(R,e,3,{localTeam:2,occlusion:true});
      const opaque = R.calls.filter(c => c[13]==='dynamic' && c[12]===1);
      assert.equal(recorded.length,opaque.length);
      assert.ok(recorded.length>0);
      assert.ok(recorded.every((entry,i)=>entry.part===opaque[i] && entry.name===opaque[i][0]));
      assert.equal(recorded[0].color,kind==='resource'?(type==='gas'?0x65e5e9:0xe7b969):0x8bdfad);
      R.calls.length=0;recorded.length=0;
      render(R,e,3,{localTeam:0,occlusion:true});
      assert.equal(recorded[0].color,kind==='resource'?(type==='gas'?0x65e5e9:0xe7b969):0xe98680);
    }
    for (const options of [{},{occlusion:false},{occlusion:true,ghost:true},{occlusion:true,tint:0xffffff},
      {occlusion:true,alpha:.3},{occlusion:true,layer:'effects'}]) {
      recorded.length=0; render(R,e,3,options); assert.equal(recorded.length,0);
    }
    R.cinema=true;recorded.length=0;render(R,e,3,{occlusion:true});assert.equal(recorded.length,0);R.cinema=false;
    recorded.length=0;render(R,{...e,hp:0},3,{occlusion:true});assert.equal(recorded.length,0);
  }
});

test('contact shadows add one effect quad per unit/building on Balanced/High without changing models or previews',()=>{
  const context=loadScripts(['core',...RENDERER_SCRIPTS,'content','world-view']);
  vm.runInContext('Math.random=()=>{throw Error("Render RNG");}',context);
  const {renderEntity:render,CONTACT_SHADOW_MATERIAL:material}=vm.runInContext('({renderEntity,CONTACT_SHADOW_MATERIAL})',context);
  const R=createRendererStub({record:true});R.cinema=false;
  for(const [kind,type] of [['building','hq'],['unit','worker'],['unit','air']]) {
    const e=Object.freeze({id:42,kind,type,hp:100,team:0,faction:0,size:kind==='building'?4:1,x:12,z:-23,rot:.3,walk:0,progress:1});
    const before=JSON.stringify(e);R.quality=0;R.calls.length=0;render(R,e,0);
    const withoutGlow=calls=>JSON.stringify(calls.map(c=>c.map((value,i)=>i===11?0:value)));
    const model=withoutGlow(R.calls);
    for(const quality of [1,2]) {
      R.quality=quality;R.calls.length=0;render(R,e,0);
      const contacts=R.calls.filter(c=>c[14]===material);
      assert.equal(contacts.length,1);
      const c=contacts[0];assert.equal(c[0],'plane');assert.deepEqual(c.slice(1,4),[12,.025,-23]);
      assert.equal(c[11],0);assert.equal(c[13],'effects');assert.ok(c[12]>0&&c[12]<.4);
      assert.ok(c.slice(1,13).every(Number.isFinite));
      assert.equal(withoutGlow(R.calls.filter(c=>c[14]!==material)),model);
    }
    for(const options of [{ghost:true},{tint:0xffffff},{alpha:.3},{layer:'effects'}]) {
      R.calls.length=0;render(R,e,0,options);assert.ok(!R.calls.some(c=>c[14]===material));
    }
    R.cinema=true;R.calls.length=0;render(R,e,0);assert.ok(!R.calls.some(c=>c[14]===material));R.cinema=false;
    assert.equal(JSON.stringify(e),before);
  }
  R.calls.length=0;render(R,{id:1,kind:'resource',type:'gas',hp:100,x:0,z:0},0);
  assert.ok(!R.calls.some(c=>c[14]===material));
});

test('contact shadow quads follow planar slopes above the surface and never slice curved terrain',()=>{
  const context=loadScripts(['core',...RENDERER_SCRIPTS,'content',...BATTLEFIELD_SCRIPTS,'world','world-view']);
  const {renderEntity:render,BattlefieldSurface,CONTACT_SHADOW_MATERIAL:material}=vm.runInContext('({renderEntity,BattlefieldSurface,CONTACT_SHADOW_MATERIAL})',context);
  const R=createRendererStub({record:true});Object.assign(R,{quality:1,cinema:false});
  const e={id:42,kind:'building',type:'hq',hp:100,team:0,faction:0,size:4,x:12,z:-23,progress:1};
  R.surface=new BattlefieldSurface(60,2.5,(x,z)=>40+.03*x+.02*z);render(R,e,0);
  const contacts=R.calls.filter(c=>c[14]===material);assert.equal(contacts.length,1);const c=contacts[0];
  const cy=Math.cos(c[8]),sy=Math.sin(c[8]),cx=Math.cos(c[9]),sx=Math.sin(c[9]),cz=Math.cos(c[10]),sz=Math.sin(c[10]),
    xx=cy*cz+sy*sx*sz,xy=cx*sz,xz=-sy*cz+cy*sx*sz,zx=sy*cx,zy=-sx,zz=cy*cx;
  for(const x of [-c[4]/2,0,c[4]/2])for(const z of [-c[6]/2,0,c[6]/2]){
    const wx=c[1]+x*xx+z*zx,wy=c[2]+x*xy+z*zy,wz=c[3]+x*xz+z*zz;
    assert.ok(wy>R.surface.heightAt(wx,wz),'the soft contact layer stays above the ground');
  }
  R.surface=new BattlefieldSurface(60,2.5,(x,z)=>40+.02*x*x+.025*z*z);R.calls.length=0;render(R,e,0);
  assert.equal(R.calls.some(c=>c[14]===material),false,'omit only the invalid cosmetic quad, not the model or real shadow caster');
  assert.ok(R.calls.some(c=>c[13]==='dynamic'));
});
test('faction light animation changes only emissive model strength, not geometry, team colors or previews',()=>{
  const context=loadScripts(['core',...RENDERER_SCRIPTS,'content','world-view']);
  vm.runInContext('Math.random=()=>{throw Error("Animation RNG");}',context);
  const render=vm.runInContext('renderEntity',context),R=createRendererStub({record:true});R.cinema=false;
  for(const faction of [0,1,2]) {
    const e=Object.freeze({id:42,kind:'building',type:'hq',hp:100,team:0,faction,size:4,x:0,z:0,rot:0,progress:1});
    for(const time of [0,1.5]) {
      const draw=(quality,options={})=>{R.quality=quality;R.calls.length=0;render(R,e,time,options);return R.calls.filter(c=>c[14]!==-1);};
      const still=draw(0),animated=draw(2);let changed=0;
      assert.equal(animated.length,still.length);
      animated.forEach((c,i)=>{
        assert.deepEqual(c.filter((_,j)=>j!==11),still[i].filter((_,j)=>j!==11));
        if(still[i][11]<.3) assert.equal(c[11],still[i][11],'do not animate across the shader texture cutoff');
        if(c[11]!==still[i][11]) {changed++;assert.ok(c[11]/still[i][11]>=.78&&c[11]/still[i][11]<=1.22);}
      });
      assert.ok(changed>0);
      for(const options of [{ghost:true},{tint:0xffffff},{alpha:.3,layer:'effects'}]) assert.deepEqual(draw(2,options),draw(0,options));
      R.cinema=true;assert.deepEqual(draw(2),draw(0));R.cinema=false;
    }
  }
});

test('motion dust is view-owned, bounded, stationary after emission, and cleared by fog, quality and world changes',()=>{
  const context=loadScripts(['core','content','effects','effects-view'],{globals:{clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}});
  vm.runInContext('Math.random=()=>{throw Error("Dust RNG");}',context);
  const {renderMotionDust:render,motionDustViews:views}=vm.runInContext('({renderMotionDust,motionDustViews})',context);
  const R=createRendererStub({record:true});R.quality=2;R.cinema=false;
  R.project=()=>({x:100,y:100});R.viewport={left:0,top:0,right:200,bottom:200};
  const world={visible:[1],idx:()=>0,definition:{palette:{ground:0xab9876}}};
  const s={time:0,entities:Array.from({length:80},(_,id)=>({id,kind:'unit',type:'tank',hp:100,x:0,z:0,rot:0,size:1,walk:0}))};
  const frame=()=>{const before=JSON.stringify(s);R.calls.length=0;render(R,world,s);assert.equal(JSON.stringify(s),before);return R.calls;};
  assert.equal(frame().length,0);
  s.time=.2;for(const e of s.entities){e.walk=1;e.x=1;}
  assert.equal(frame().length,48);const first=R.calls[0];
  s.time=.4;for(const e of s.entities){e.walk=2;e.x=2;}
  assert.equal(frame().length,96);assert.equal(R.calls[0][1],first[1]);assert.equal(R.calls[0][3],first[3]);
  assert.equal(views.get(R).tracks.size,48);
  s.time=1;assert.equal(frame().length,0,'stopped units leave no permanent cloud');
  world.visible[0]=0;frame();assert.equal(views.get(R).tracks.size,0);
  world.visible[0]=1;s.time=2;assert.equal(frame().length,0,'revealing units never replays old motion');
  R.quality=0;frame();assert.equal(views.has(R),false);
  R.quality=1;frame();s.time=2.2;s.entities.forEach(e=>e.walk++);assert.equal(frame().length,24);
  render(R,{...world},s);assert.equal(views.get(R).tracks.size,24);assert.ok([...views.get(R).tracks.values()].every(t=>t.puffs.length===0));
});

test('combat accents exclude work/healing beams, obey both endpoint visibility and fixed quality budgets',()=>{
  const context=loadScripts(['core','content','effects','effects-view'],{globals:{clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}});
  const {MeridianEffects:Effects,renderBattlefieldEffects:render}=vm.runInContext('({MeridianEffects,renderBattlefieldEffects})',context);
  const effects=new Effects(()=>{throw Error('Combat cosmetic RNG');});
  const shooter={kind:'unit',type:'tank',x:0,z:0,rot:0,faction:0,team:0},target={kind:'unit',type:'tank',x:20,z:0,size:1.3};
  effects.shot(shooter,target);const shot=effects.fx[0];
  effects.healing(shooter,target);
  effects.random=()=>0;effects.construction(shooter,target,1);effects.mining(shooter,target,1,()=>true);
  effects.random=()=>{throw Error('View sampled RNG');};
  assert.ok(effects.fx.slice(1).every(f=>!effects.combatBeams.has(f)));
  const R=createRendererStub({record:true});R.beam=(...args)=>R.calls.push(['beam',...args]);R.quality=2;R.cinema=false;
  const world={visible:[1,1],idx:x=>x<10?0:1,definition:{palette:{ground:0xab9876}}},s={entities:[],fields:[],scans:[],strikes:[],time:0};
  const frame=()=>{const before=JSON.stringify(effects.fx);R.calls.length=0;render(R,effects,world,s,[],0);assert.equal(JSON.stringify(effects.fx),before);return R.calls;};
  assert.equal(frame().filter(c=>c[0]==='sphere').length,1);
  assert.equal(R.calls.filter(c=>c[0]==='beam').length,8,'four original beams, a Pact tracer and three combat sparks');
  assert.equal(effects.combatBeams.get(shot),1.3);
  for(const c of R.calls.filter(c=>c[0]==='beam').slice(2,5)) assert.ok(Math.abs(Math.hypot(c[1][0]-20,c[1][2])-1.3)<.0001,'sparks start at the hull, not its center');
  world.visible[1]=0;assert.equal(frame().filter(c=>c[0]==='beam').length,4);
  world.visible[0]=0;assert.equal(frame().length,0);world.visible=[1,1];
  effects.fx=Array.from({length:100},()=>shot);
  for(const [quality,cap,sparks,signatures] of [[0,0,0,0],[1,16,1,12],[2,48,3,32]]) {
    R.quality=quality;frame();assert.equal(R.calls.filter(c=>c[0]==='sphere').length,cap);
    assert.equal(R.calls.filter(c=>c[0]==='beam').length,100+cap*sparks+signatures);
  }
  effects.reset();effects.shell(shooter,target,.8);R.quality=2;
  assert.equal(frame().filter(c=>c[0]==='sphere').length,2,'projectile plus short launch flash');
  effects.tick(.15);assert.equal(frame().filter(c=>c[0]==='sphere').length,1,'launch flash ends before impact');
});

test('world view uploads only changed layout/fog and does not mutate CPU data', () => {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'world-view']);
  const { Battlefield, BattlefieldView } = vm.runInContext('({Battlefield, BattlefieldView})', context);
  const world = new Battlefield(1409, 'desert'), renderer = createRendererStub();
  let meshes = 0, fogs = 0, fogPixels;
  renderer.geometry = () => meshes++;
  renderer.fog = data => { fogs++; fogPixels = Array.from(data); };
  const view = new BattlefieldView(renderer), before = JSON.stringify(world.renderData);
  view.sync(world, false); view.sync(world, false);
  assert.equal(meshes, world.renderData.geometries.length); assert.equal(fogs, 0); assert.equal(renderer.fogOn, false);
  world.reveal([], [{ x: 0, z: 0, r: 7 }]); view.sync(world); view.sync(world);
  assert.equal(meshes, world.renderData.geometries.length); assert.equal(fogs, 1); assert.equal(renderer.fogOn, true);
  assert.deepEqual(fogPixels, Array.from(world.fogPixels)); assert.ok(fogPixels.includes(255));
  assert.equal(JSON.stringify(world.renderData), before);
  const next = new Battlefield(43015, 'desert'); next.reveal([]);
  view.sync(next); view.sync(next);
  assert.equal(fogs, 2); assert.equal(renderer.fogOn, true);
  assert.deepEqual(fogPixels, Array.from(next.fogPixels)); assert.ok(fogPixels.every(v => v === 0));
  assert.equal(meshes, world.renderData.geometries.length + next.renderData.geometries.length);
});

test('world view switches ground bounds, boundary descriptors and fog sizes between worlds', () => {
  const context=loadScripts(['core', ...RENDERER_SCRIPTS, 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'world-view']);
  const {Battlefield,BattlefieldView,BATTLEFIELDS,TerrainModels}=vm.runInContext(
    '({Battlefield,BattlefieldView,BATTLEFIELDS,TerrainModels})',context);
  // Flat component fixtures isolate dispatch from fixed campaign recipes/deployment.
  const field=(extent,step,innerExtent=0)=>{
    const size=extent*2/step+3;
    return {extent,step,size,innerExtent,heights:new Float32Array(size*size).fill(20),
      colors:new Float32Array(size*size*3).fill(.25)};
  };
  const fixture=(map,extent,grid)=>{
    const sight=Array.from({length:2},()=>({visible:new Uint8Array(grid*grid),explored:new Uint8Array(grid*grid)}));
    return Object.assign(Object.create(Battlefield.prototype),{extent,cellSize:2.5,gridSize:grid,seed:43015,terrainSeed:43015,
      definition:BATTLEFIELDS[map],renderProfile:BATTLEFIELDS[map].render,fogVersion:0,viewTeam:0,sight,
      visible:sight[0].visible,explored:sight[0].explored,fogPixels:new Uint8Array(grid*grid),
      surface:{size:grid+1,maxHeight:20,heightAt:()=>20,visibilityLevelAt:()=>0,visibilityLevel:()=>0},
      renderData:{placements:[],geometries:[{mesh:'terrain',model:'landscapeRelief',relief:field(extent,2.5)},
        {mesh:'backdrop',model:'landscapeRelief',relief:field(extent+100,5,extent)}]}});
  };
  const renderer=createRendererStub(), uploads=[], fogs=[], boundaries=[];
  // Test descriptor dispatch here; actual boundary meshes are checked in the terrain suite.
  const landscape=TerrainModels.landscapeRelief;
  TerrainModels.landscapeRelief=relief=>{
    if(!relief.innerExtent)return landscape(relief);
    boundaries.push([relief.outerExtent??relief.extent,relief.innerExtent]);return new Float32Array();
  };
  renderer.geometry=(mesh,data)=>{
    if (mesh!=='terrain') return;
    let min=Infinity,max=-Infinity;
    for(let i=0;i<data.length;i+=9) {min=Math.min(min,data[i],data[i+2]);max=Math.max(max,data[i],data[i+2]);}
    uploads.push([data.length/27,min,max]);
  };
  renderer.fog=(data,size)=>{assert.equal(data.length,size*size);fogs.push([size,Array.from(data)]);};
  const view=new BattlefieldView(renderer);
  for(const [map,extent,grid] of [['desert',90,72],['alien-planet',135,108],['mothership',120,96]]) {
    const w=fixture(map,extent,grid), count=fogs.length;
    view.sync(w,false);view.sync(w,true);view.sync(w,true);
    assert.equal(renderer.extent,extent);
    assert.deepEqual(uploads.at(-1).slice(1),[-extent,extent]);
    assert.ok(uploads.at(-1)[0]>=(w.surface.size-1)**2*2, 'terrain retains its top triangles plus boundary closure');
    assert.equal(boundaries.at(-1)[1],extent);assert.ok(boundaries.at(-1)[0]>extent);
    assert.equal(fogs.length,count+1);assert.equal(fogs.at(-1)[0],grid);
    assert.ok(fogs.at(-1)[1].every(v=>v===0), 'unrevealed world never reuses old fog');
    w.reveal([], [{x:extent-15,z:0,r:7}]);view.sync(w);
    assert.ok(fogs.at(-1)[1].includes(255));
  }
  assert.equal(uploads.length,3);
});

test('world view dispatches declared terrain models and profiles without assuming mountains', () => {
  const context = loadScripts(['core', 'content', ...RENDERER_SCRIPTS, ...BATTLEFIELD_SCRIPTS, 'world', 'world-view']);
  const { Battlefield, BattlefieldView, TerrainModels } = vm.runInContext('({Battlefield, BattlefieldView, TerrainModels})', context);
  const world = new Battlefield(1409, 'mothership'), renderer = createRendererStub(), uploads = [], inputs = [];
  const feature = world.renderData.features[0];
  TerrainModels.testInterior = input => { inputs.push(input); return [1, 2, 3]; };
  world.renderData.geometries = [{ mesh: 'custom', model: 'testInterior', feature }];
  renderer.geometry = (name, data) => uploads.push([name, data]);
  const before = JSON.stringify(world.renderData), view = new BattlefieldView(renderer);
  view.sync(world); view.sync(world);
  assert.deepEqual(uploads.map(([name]) => name), ['terrain', 'custom']);
  assert.strictEqual(inputs[0], feature); assert.equal(inputs.length, 1);
  assert.strictEqual(renderer.battlefieldProfile, world.renderProfile);
  assert.strictEqual(renderer.haze, world.renderProfile.haze);
  assert.equal(JSON.stringify(world.renderData), before);
  assert.throws(() => TerrainModels.geometry({ model: 'missing', seed: 1 }), /Unknown terrain model/);
  assert.throws(() => TerrainModels.geometry({ model: 'toString', seed: 1 }), /Unknown terrain model/);
});

test('produced aircraft rise smoothly from the hangar without changing draw state or RNG', () => {
  const context=loadScripts(['core',...RENDERER_SCRIPTS,'content',...BATTLEFIELD_SCRIPTS, 'world','world-view']);
  vm.runInContext('Math.random = () => { throw Error("Draw RNG"); }',context);
  const render=vm.runInContext('renderEntity',context), renderer=createRendererStub({record:true});
  const unit={id:1,hp:245,kind:'unit',type:'air',team:0,faction:0,size:1,x:0,z:0,rot:0,
    exit:Object.freeze({building:2,x:10,z:0,length:10})};
  const height=(x,exit=unit.exit)=>{
    const e=Object.freeze({...unit,x,exit}), before=JSON.stringify(e); renderer.calls.length=0;
    render(renderer,e,0); assert.equal(JSON.stringify(e),before);
    return renderer.calls.find(c=>c[0]==='faction0AirHull')[2];
  };
  const start=height(0), middle=height(5), end=height(10), normal=height(10,null);
  assert.ok(Math.abs(middle-start-1.5)<1e-9); assert.ok(Math.abs(end-start-3)<1e-9);
  assert.ok(Math.abs(end-normal)<1e-9);
});

test('faction 0 HQ armor has bounded beveled panels with outward finite unit normals', () => {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS]);
  vm.runInContext('Math.random = seeded = () => { throw Error("Mesh RNG"); }', context);
  const geom = vm.runInContext('geom', context), mesh = geom.commandHull();
  assert.deepEqual(mesh, geom.commandHull());
  assert.ok(mesh.length / 27 >= 800 && mesh.length / 27 <= 1400);
  // Each convex panel has three eight-sided bands and two closed caps (64 triangles).
  assert.equal(mesh.length % (64 * 27), 0);
  for (let start = 0; start < mesh.length; start += 64 * 27) {
    const center = [0, 0, 0];
    for (let i = start; i < start + 64 * 27; i += 9)
      for (let k = 0; k < 3; k++) center[k] += mesh[i + k] / (64 * 3);
    for (let i = start; i < start + 64 * 27; i += 27) {
      const a = mesh.slice(i, i + 3), b = mesh.slice(i + 9, i + 12), c = mesh.slice(i + 18, i + 21),
        u = b.map((v, k) => v - a[k]), v = c.map((v, k) => v - a[k]),
        cross = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]],
        area = Math.hypot(...cross);
      assert.ok(area > 1e-8, 'no degenerate triangles');
      assert.ok(cross.reduce((sum, n, k) => sum + n * (a[k] - center[k]), 0) > 0, 'outward winding');
      for (let j = i; j < i + 27; j += 9) {
        const vertex = mesh.slice(j, j + 9);
        assert.ok(vertex.every(Number.isFinite));
        assert.ok(Math.abs(vertex[0]) <= 3.98 && vertex[1] >= .1 - 1e-9 && vertex[1] <= 3.55);
        assert.ok(vertex[2] >= -2.6 && vertex[2] <= 4, 'armor and step remain inside existing foundation');
        assert.ok(cross.every((n, k) => Math.abs(n / area - vertex[k + 3]) < 1e-9));
        assert.ok(vertex.slice(6).every(tint => tint > 0 && tint < 1.6));
      }
    }
  }
});

test('command hull is faction-specific and retains construction, team yaw, tint and draw isolation', () => {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'world-view']);
  vm.runInContext('Math.random = seeded = () => { throw Error("HQ draw RNG"); }', context);
  const { renderEntity, BUILDINGS, BUILDING_YAW, FACTIONS, MAT } =
    vm.runInContext('({renderEntity, BUILDINGS, BUILDING_YAW, FACTIONS, MAT})', context);
  const entity = Object.freeze({ id: 1, kind: 'building', type: 'hq', x: 12, z: -7,
    hp: BUILDINGS.hq.hp, size: BUILDINGS.hq.size, faction: 0, team: 0, progress: 1 });
  const render = (e = entity, options = {}, time = 0) => {
    const renderer = createRendererStub({ record: true }), before = JSON.stringify(e);
    renderEntity(renderer, Object.freeze(e), time, options);
    assert.equal(JSON.stringify(e), before);
    assert.ok(renderer.calls.every(c => c.slice(1, 13).every(Number.isFinite)));
    return renderer.calls;
  };
  const calls = render(), hull = list => list.find(c => c[0] === 'commandHull');
  assert.equal(calls.filter(c => c[0] === 'commandHull').length, 1);
  assert.deepEqual(hull(calls), ['commandHull', 12, 0, -7, 1, 1, 1,
    FACTIONS[0].metal, BUILDING_YAW, 0, 0, 0, 1, 'dynamic', MAT.METAL]);
  assert.deepEqual(calls, render());
  assert.deepEqual(hull(calls), hull(render(entity, {}, 9)), 'armor stays fixed while radar rotates');
  for (const progress of [0, .4, 1]) {
    const h = hull(render({ ...entity, progress }));
    assert.equal(h[5], Math.max(.15, progress));
    assert.equal(h[4], 1); assert.equal(h[6], 1);
  }
  const preview = hull(render(entity, { tint: 0x99e4c6, alpha: .3, layer: 'effects' }));
  assert.equal(preview[7], 0x99e4c6); assert.equal(preview[12], .3); assert.equal(preview[13], 'effects');
  assert.equal(hull(render(entity, { ghost: true }))[7], 0x68717d);
  const enemy = render({ ...entity, team: 1 });
  assert.equal(hull(enemy)[8], BUILDING_YAW + Math.PI);
  assert.equal(hull(render({...entity,visualRotation:1/3}))[8],BUILDING_YAW+Math.PI/12,'cosmetic hull rotation is independent of aim');
  assert.equal(enemy[1][7], 0xe98680, 'foundation retains hostile team color');
  for (const faction of [1, 2]) assert.equal(hull(render({ ...entity, faction })), undefined);
  for (const type of Object.keys(BUILDINGS).filter(type => type !== 'hq'))
    assert.equal(hull(render({ ...entity, type })), undefined);
  assert.deepEqual(render({ ...entity, hp: 0 }), []);
});

test('faction 0 worker meshes are deterministic, bounded and non-degenerate with finite flat normals', () => {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS]);
  vm.runInContext('Math.random = seeded = () => { throw Error("Worker mesh RNG"); }', context);
  const geom = vm.runInContext('geom', context);
  for (const [name, min, max] of [['workerHull', 1200, 1800], ['workerDrill', 100, 160]]) {
    const mesh = geom[name](), colors = new Set();
    assert.deepEqual(mesh, geom[name]());
    assert.ok(mesh.length / 27 >= min && mesh.length / 27 <= max);
    let volume = 0;
    for (let i = 0; i < mesh.length; i += 27) {
      const a = mesh.slice(i, i+3), b = mesh.slice(i+9, i+12), c = mesh.slice(i+18, i+21),
        u = b.map((v,k) => v-a[k]), v = c.map((v,k) => v-a[k]),
        cross = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]],
        area = Math.hypot(...cross);
      assert.ok(area > 1e-9);
      volume += a.reduce((sum,n,k) => sum+n*cross[k], 0) / 6;
      for (let j = i; j < i+27; j += 9) {
        const p = mesh.slice(j, j+9);
        assert.ok(p.every(Number.isFinite));
        assert.ok(cross.every((n,k) => Math.abs(n/area-p[k+3]) < 1e-9));
        if (name === 'workerHull') {
          assert.ok(Math.abs(p[0]) <= .90 && Math.abs(p[2]) <= .87);
          assert.ok(p[1] >= .03 && p[1] <= 1.241, 'preserve compact crawler silhouette');
        } else {
          assert.ok(Math.hypot(p[0],p[2]) <= 1+1e-9 && Math.abs(p[1]) <= .5);
        }
        assert.ok(p.slice(6).every(tint => tint > 0 && tint <= 1.21));
        colors.add(p.slice(6).join(','));
      }
    }
    assert.ok(volume > 0, 'outward-oriented closed components');
    assert.ok(colors.size >= 3, 'facets and recesses have distinct tints');
  }
});

test('detailed faction 0 workers preserve yaw, cargo indication, team tint and read-only rendering', () => {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'world-view']);
  vm.runInContext('Math.random = seeded = geom.workerHull = geom.workerDrill = () => { throw Error("Per-frame mesh/RNG"); }', context);
  const { renderEntity, UNITS, MAT } = vm.runInContext('({renderEntity, UNITS, MAT})', context);
  const unit = Object.freeze({ id: 17, kind: 'unit', type: 'worker', faction: 0, team: 0,
    x: 12, z: -7, hp: UNITS.worker.hp, size: UNITS.worker.size, rot: .7, walk: 2, carry: 0,
    order: Object.freeze({ type: 'gather', id: 8 }) });
  const render = (e = unit, time = 0, options = {}) => {
    const renderer = createRendererStub({ record: true }), before = JSON.stringify(e);
    renderEntity(renderer, Object.freeze(e), time, options);
    assert.equal(JSON.stringify(e), before);
    assert.ok(renderer.calls.every(c => c.slice(1,13).every(Number.isFinite)));
    return renderer.calls;
  };
  const calls = render();
  assert.equal(calls.filter(c => c[0] === 'workerHull').length, 1);
  assert.equal(calls.filter(c => c[0] === 'workerDrill').length, 1);
  assert.ok(calls.length <= 16 && calls.every(c => c[14] === MAT.METAL));
  assert.deepEqual(calls, render({ ...unit, walk: 7 }, 20), 'no new time/walk-driven behavior');
  const drill = calls.find(c => c[0] === 'workerDrill');
  assert.ok(Math.abs(drill[1] - (unit.x + .67*Math.cos(.7) + Math.sin(.7))) < 1e-9);
  assert.ok(Math.abs(drill[3] - (unit.z - .67*Math.sin(.7) + Math.cos(.7))) < 1e-9);
  assert.equal(drill[8], .7); assert.equal(drill[9], -1.1);
  const loaded = render({ ...unit, carry: 10 });
  assert.deepEqual(loaded.slice(0,-1), calls);
  assert.equal(loaded.at(-1)[0], 'octa'); assert.equal(loaded.at(-1)[2], 1.4);
  assert.equal(loaded.at(-1)[7], 0xecc88a);
  const preview = render(unit, 0, { tint: 0x99e4c6, alpha: .3, layer: 'effects' });
  assert.equal(preview[0][7], 0x99e4c6);
  assert.ok(preview.every(c => c[12] === .3 && c[13] === 'effects'));
  assert.equal(render(unit, 0, { ghost: true })[0][7], 0x68717d);
  assert.ok(render({ ...unit, team: 1 }).some(c => c[7] === 0xe98680));
  for (const faction of [1,2])
    assert.ok(render({ ...unit, faction }).every(c => !['workerHull','workerDrill'].includes(c[0])));
  assert.deepEqual(render({ ...unit, hp: 0 }), []);
});

test('faction 0 turret meshes are deterministic, bounded and non-degenerate, including recessed twin muzzles', () => {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS]);
  vm.runInContext('Math.random = seeded = () => { throw Error("Turret mesh RNG"); }', context);
  const geom = vm.runInContext('geom', context), meshes = geom.turretAssembly();
  assert.deepEqual(meshes, geom.turretAssembly());
  for (const [name, mesh] of Object.entries(meshes)) {
    const base = name === 'turretBase', colors = new Set();
    assert.ok(mesh.length/27 >= (base ? 500 : 900) && mesh.length/27 <= (base ? 800 : 1300));
    let volume = 0;
    for (let i = 0; i < mesh.length; i += 27) {
      const a = mesh.slice(i,i+3), b = mesh.slice(i+9,i+12), c = mesh.slice(i+18,i+21),
        u = b.map((v,k) => v-a[k]), v = c.map((v,k) => v-a[k]),
        cross = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]],
        area = Math.hypot(...cross);
      assert.ok(area > 1e-9, 'no degenerate surfaces');
      volume += a.reduce((sum,n,k) => sum+n*cross[k],0)/6;
      for (let j = i; j < i+27; j += 9) {
        const p = mesh.slice(j,j+9);
        assert.ok(p.every(Number.isFinite));
        assert.ok(cross.every((n,k) => Math.abs(n/area-p[k+3]) < 1e-9));
        if (base) assert.ok(Math.hypot(p[0],p[2]) <= 1.35+1e-9 && p[1] >= .15 && p[1] <= 2.05);
        else assert.ok(Math.abs(p[0]) <= .98+1e-9 && p[1] >= 1.83-1e-9 && p[1] <= 2.77 && p[2] >= -.85-1e-9 && p[2] <= 1.85);
        assert.ok(p.slice(6).every(tint => tint > 0 && tint < 1.5));
        colors.add(p.slice(6).join(','));
      }
    }
    assert.ok(volume > 0); assert.ok(colors.size >= 3);
  }
  for (const side of [-1,1]) {
    const mesh = meshes.turretHead;
    assert.ok(mesh.some((v,i) => i%9 === 0 && Math.abs(v-side*.52) < 1e-9 &&
      Math.abs(mesh[i+1]-2.3) < 1e-9 && mesh[i+2] === 1.65), 'each barrel has a recessed bore end');
  }
});

test('faction 0 turret detail keeps its fixed base and independently aimed head through team and construction variants', () => {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'world-view']);
  vm.runInContext('Math.random = seeded = geom.turretAssembly = () => { throw Error("Per-frame turret mesh/RNG"); }', context);
  const { renderEntity, BUILDINGS, BUILDING_YAW, MAT } =
    vm.runInContext('({renderEntity, BUILDINGS, BUILDING_YAW, MAT})', context);
  const entity = { id: 17, kind: 'building', type: 'turret', faction: 0, team: 0,
    x: 12, z: -7, hp: BUILDINGS.turret.hp, size: BUILDINGS.turret.size, rot: .7, progress: 1 };
  const render = (e = entity, options = {}, time = 0) => {
    const renderer = createRendererStub({ record: true }), before = JSON.stringify(e);
    renderEntity(renderer, Object.freeze(e), time, options);
    assert.equal(JSON.stringify(e), before);
    assert.ok(renderer.calls.every(c => c.slice(1,13).every(Number.isFinite)));
    return renderer.calls;
  };
  const base = calls => calls.find(c => c[0] === 'turretBase'), head = calls => calls.find(c => c[0] === 'turretHead');
  const calls = render();
  assert.equal(calls.filter(c => c[0] === 'turretBase').length, 1);
  assert.equal(calls.filter(c => c[0] === 'turretHead').length, 1);
  assert.ok(calls.length <= 10); assert.deepEqual(calls, render(entity, {}, 19));
  for (const team of [0,1]) for (const rot of [0,.7,Math.PI,-2]) for (const progress of [0,.4,1]) {
    const visualRotation=progress===1?1/3:0,
      next = render({ ...entity, team, rot, progress, visualRotation }), scale = Math.max(.15,progress);
    assert.equal(base(next)[8], BUILDING_YAW+team*Math.PI+visualRotation*Math.PI/4);
    assert.ok(Math.abs(head(next)[8]-rot) < 1e-9, 'aim is not added to building yaw');
    for (const c of [base(next),head(next)]) {
      assert.deepEqual(c.slice(1,7), [entity.x,0,entity.z,1,scale,1]);
      assert.equal(c[14], MAT.METAL);
    }
    const sensor = next.find(c => c[0] === 'box' && c[11] === 1.2);
    assert.ok(Math.abs(sensor[1]-(entity.x+Math.sin(rot)*.827)) < 1e-9);
    assert.ok(Math.abs(sensor[3]-(entity.z+Math.cos(rot)*.827)) < 1e-9);
    assert.equal(sensor[2], 2.3*scale);
    assert.equal(sensor[7], team ? 0xe98680 : 0x78ded3);
  }
  const preview = render(entity, { tint: 0x99e4c6, alpha: .3, layer: 'effects' });
  for (const c of [base(preview),head(preview)]) {
    assert.equal(c[7], 0x99e4c6); assert.equal(c[12], .3); assert.equal(c[13], 'effects');
  }
  assert.equal(head(render(entity, { ghost: true }))[7], 0x68717d);
  for (const faction of [1,2]) assert.equal(head(render({ ...entity, faction })), undefined);
  for (const type of Object.keys(BUILDINGS).filter(type => type !== 'turret'))
    assert.equal(head(render({ ...entity, type })), undefined);
  assert.deepEqual(render({ ...entity, hp: 0 }), []);
});

test('effects need only content, consume RNG synchronously and preserve visibility short-circuiting', () => {
  const context = loadScripts(['content', 'effects']);
  const Effects = vm.runInContext('MeridianEffects', context);
  let calls = 0, visibleCalls = 0;
  const effects = new Effects(() => { calls++; return .5; });
  effects.explosion(3, 4);
  assert.equal(calls, 78); assert.equal(effects.fx.length, 16);
  effects.tick(.5); assert.equal(calls, 78); assert.equal(effects.fx.length, 15);
  const e = Object.freeze({ x: 0, z: 0, team: 0 }), b = Object.freeze({ x: 1, z: 1, size: 3 });
  effects.construction(e, b, .05);
  effects.mining(e, b, .05, () => { visibleCalls++; return true; });
  assert.equal(calls, 80); assert.equal(visibleCalls, 0);
  for (let i = 0; i < 40; i++) effects.damageNumber(e, 30);
  assert.equal(effects.floats.length, 35);
  effects.reset(); assert.equal(effects.fx.length, 0); assert.equal(effects.floats.length, 0);
});

test('shot and shell faction variants use stable IDs rather than display names', () => {
  const context = loadScripts(['content', 'effects']);
  vm.runInContext(`FACTIONS.forEach(f => { f.name = 'Same revised name'; });`, context);
  const Effects = vm.runInContext('MeridianEffects', context);
  const effects = new Effects(() => { throw Error('Shot RNG'); });
  const target = { kind: 'unit', type: 'rifle', x: 8, z: 9 };
  for (const [faction, color, life, shellColor] of [
    [0, 0xffd2a0, .1, 0xffce8f], [1, 0xafe8a6, .1, 0xb8eba3], [2, 0xd9bfff, .19, 0xffce8f]
  ]) {
    const e = Object.freeze({ kind: 'unit', type: 'rifle', x: 0, z: 0, rot: 0, team: 0, faction });
    effects.shot(e, target); effects.shell(e, target, .85);
    assert.equal(effects.fx.at(-2).color, color); assert.equal(effects.fx.at(-2).life, life);
    assert.equal(effects.fx.at(-1).color, shellColor);
  }
});

test('placement previews have a stable visual identity and finite transforms for every building', () => {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', 'world-view']);
  const { createBuildingPreview, renderEntity, BUILDINGS } = vm.runInContext(
    '({createBuildingPreview, renderEntity, BUILDINGS})', context);
  vm.runInContext('Math.random = seeded = () => { throw Error("Preview RNG"); };', context);
  for (const faction of [0, 1, 2]) for (const type of Object.keys(BUILDINGS)) {
    const preview = Object.freeze(createBuildingPreview(type, {x: 12, z: -7}, faction));
    assert.equal(preview.id, 0, 'no simulation ID allocation');
    for (const time of [0, 9, 20]) {
      const renderer = createRendererStub({record: true});
      renderEntity(renderer, preview, time, {tint: 0x99e4c6, alpha: .3, layer: 'effects'});
      assert.ok(renderer.calls.length > 0);
      for (const call of renderer.calls) for (const value of call)
        if (typeof value === 'number') assert.ok(Number.isFinite(value), `${faction}/${type}: finite transform`);
    }
  }
});

test('entity models stay identical when faction, unit and building display names change', () => {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', 'world-view']);
  const { renderEntity, UNITS, BUILDINGS } = vm.runInContext('({renderEntity, UNITS, BUILDINGS})', context);
  const draw = () => {
    const renderer = createRendererStub({ record: true });
    for (const faction of [0, 1, 2]) for (const team of [0, 1])
      for (const [kind, definitions] of [['unit', UNITS], ['building', BUILDINGS]])
        for (const [type, d] of Object.entries(definitions))
          renderEntity(renderer, Object.freeze({ id: 1, kind, type, faction, team,
            hp: d.hp, size: d.size, x: 0, z: 0, progress: 1, rot: .7, walk: 0, carry: 0 }), 0);
    return renderer.calls;
  };
  const before = draw();
  vm.runInContext(`FACTIONS.forEach(f => {
    f.name = f.short = 'Revised';
    for (const names of [f.units, f.buildings]) for (const key of Object.keys(names)) names[key] = 'Revised';
  });`, context);
  assert.deepEqual(draw(), before);
});

test('effect provider follows the current game RNG and resets on each new start', () => {
  const context = loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'effects', ...SIMULATION_SCRIPTS], { globals: { structuredClone } });
  const Game = vm.runInContext('MeridianGame', context), game = new Game({ upgrades: {} });
  const effects = game.effects;
  game.start({ seed: 1409 });
  game.random = () => .5; game.effects.explosion(0, 0);
  assert.equal(game.effects.fx[1].vy, 6);
  game.start({ seed: 1409 });
  assert.equal(game.effects, effects); assert.equal(game.effects.fx.length, 0);
  const restarted = JSON.stringify(game.s);
  game.random = () => .25; game.effects.explosion(0, 0);
  assert.equal(game.effects.fx[1].vy, 4.5);
  assert.equal(JSON.stringify(game.s), restarted);
});

test('effect drawing accepts frozen data without game/UI globals and matches the original draw calls', () => {
  const context = loadScripts(['effects-view'], { globals: { clamp: (v, a, b) => Math.max(a, Math.min(b, v)) } });
  vm.runInContext('Math.random = () => { throw Error("Rendering must not consume randomness"); }', context);
  const render = vm.runInContext('renderBattlefieldEffects', context);
  const { effectViewSample } = require('./helpers/effect-view-scenario.cjs');
  const { reference, ...expected } = require('./fixtures/effects-view-v1.json');
  assert.deepEqual(effectViewSample(render), expected);
});

function effectCullingView() {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS, 'content', 'effects', 'effects-view'],
    { globals: { clamp: (value, min, max) => Math.max(min, Math.min(max, value)) } });
  vm.runInContext('Math.random = () => { throw Error("View RNG"); }', context);
  const api = vm.runInContext('({renderBattlefieldEffects, drawEffectRing, drawVisibleEffectBeam, effectBoundsVisible, M4})', context);
  const R = createRendererStub({ record: true });
  R.beam = (...args) => R.calls.push(['beam', ...args]);
  R.quality = 0;
  R.viewport = { left: 100, top: 50, width: 1000, height: 800 };
  R.vp = new Float32Array([.1,0,0,0, 0,.1,0,0, 0,0,.01,0, 0,0,0,1]);
  const world = { visible: [255], idx: () => 0, definition: { palette: { ground: 0x556677 } } };
  const state = { time: 0, entities: [], fields: [], scans: [], strikes: [] };
  const effects = { fx: [], combatBeams: new WeakMap() };
  return { ...api, R, world, state, effects, render() {
    R.calls.length = 0;
    api.renderBattlefieldEffects(R, effects, world, state, [], 0);
    return R.calls;
  } };
}

test('command drill marks only visible living commanders of parties that own the benefit', () => {
  const h = effectCullingView();
  h.world.visible = [255, 0];
  h.world.idx = x => x >= 10 ? 1 : 0;
  h.state.parties = [
    { benefits: { commandDrill: 2 } }, { benefits: { commandDrill: 1 } },
    { benefits: {} }, { benefits: { commandDrill: 1 } }
  ];
  h.state.entities = [
    { id: 1, kind: 'unit', type: 'hero', hp: 100, team: 0, x: 0, z: 1 },
    { id: 2, kind: 'unit', type: 'hero', hp: 100, team: 1, x: 5, z: 2 },
    { id: 3, kind: 'unit', type: 'hero', hp: 100, team: 2, x: 6, z: 3 },
    { id: 4, kind: 'unit', type: 'hero', hp: 0, team: 3, x: 7, z: 4 },
    { id: 5, kind: 'unit', type: 'hero', hp: 100, team: 3, x: 10, z: 5 },
    { id: 6, kind: 'unit', type: 'rifle', hp: 100, team: 0, x: 8, z: 6 }
  ];
  const rings = h.render().filter(call => call[0] === 'ring');
  assert.deepEqual(rings.map(call => [call[1], call[3], call[4], call[7]]), [
    [0, 1, 11, 0x94e4d1], [5, 2, 11, 0xf2a490]
  ]);
  assert.ok(rings.every(call => call[12] >= .16 && call[12] <= .21));
});

test('effect bounds retain viewport-crossing shapes, heights, widths and perspective near-plane intersections', () => {
  const h = effectCullingView(), { R, effectBoundsVisible: visible, drawVisibleEffectBeam: beam } = h;
  assert.equal(visible(R, 20, 0, 0, 12, 1, 1), true, 'outside center, visible radius');
  assert.equal(visible(R, 20, 0, 0, 1, 1, 1), false);
  assert.equal(visible(R, 0, 30, 0, 1, 1, 1), false);
  beam(R, [-30, 0, 0], [30, 0, 0], .1, 1, 1, 1);
  assert.equal(R.calls.length, 1, 'both endpoints outside, segment crosses the screen');
  beam(R, [12, -1, 0], [12, 1, 0], 1, 1, 1, 1);
  assert.equal(R.calls.length, 2, 'beam thickness intersects the padded viewport');
  beam(R, [50, -1, 0], [50, 1, 0], .1, 1, 1, 1);
  assert.equal(R.calls.length, 2);
  R.vp = h.M4.perspective(Math.PI / 2, 1, .1, 100);
  assert.equal(visible(R, 0, 0, -.1, 1, 1, 1), true, 'straddling near plane is not rejected by a center projection');
  assert.equal(visible(R, 0, 0, 5, .1, .1, .1), false, 'fully behind camera');
  assert.equal(visible(R, 0, 0, -5, .1, .1, .1), true);
});

test('offscreen height rings skip sampling; visible segments reuse samples without changing positions', () => {
  const { R, drawEffectRing: ring } = effectCullingView();
  let samples = 0;
  const height = (x, z) => x * .1 - 2;
  R.surface = { heights: new Float32Array([-12, 8]), heightAt(x, z) { samples++; return height(x, z); } };
  ring(R, 100, 0, 5, 1);
  assert.equal(samples, 0); assert.equal(R.calls.length, 0);
  const radius = 8, rot = .3, y = .16, count = Math.ceil(radius * Math.PI * 2 / 1.25);
  ring(R, 0, 0, radius, 1, .6, y, rot);
  assert.equal(samples, count + 1, 'one height query per endpoint, not three per segment');
  assert.equal(R.calls.length, count);
  for (let i = 0; i < count; i++) {
    const point = j => {
      const angle = rot + j * Math.PI * 2 / count, x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
      return [x, height(x, z) + y, z];
    };
    assert.deepEqual(R.calls[i].map(v => Array.isArray(v) ? Array.from(v) : v),
      ['beam', point(i), point(i+1), .045, 1, .45, .6]);
  }
  R.calls.length = 0;
  ring(R, 20, 0, 12, 1);
  assert.ok(R.calls.length > 0, 'large offscreen-centered ring remains visible');
  R.calls.length = 0; samples = 0; ring(R, 0, 0, 60, 1);
  assert.equal(R.calls.length, 192); assert.equal(samples, 193, 'bounded scratch covers maximum ring size');
  // A new surface must invalidate the cached vertical envelope, including negative heights.
  R.surface = { heights: new Float32Array([-40, -40]), heightAt: () => -40 };
  R.vp[13] = 4;
  R.calls.length = 0; ring(R, 0, 0, 2, 1);
  assert.equal(R.calls.length, 1); assert.equal(R.calls[0][2], -39.9);
  R.surface = { heights: new Float32Array([40, 40]), heightAt: () => 40 };
  R.vp[13] = -4;
  R.calls.length = 0; ring(R, 0, 0, 2, 1);
  assert.equal(R.calls.length, 1); assert.equal(R.calls[0][2], 40.1);
});

test('offscreen non-casting effects disappear only from drawing, while dynamic casters remain', () => {
  const h = effectCullingView(), common = { x: 100, y: 1, z: 0, life: .5, maxLife: 1, color: 1 };
  h.effects.fx = [
    { ...common, type: 'beam', tx: 105, ty: 2, tz: 0, width: .1 },
    { ...common, type: 'blast', size: 2 }, { ...common, type: 'smoke', size: 2 },
    { ...common, type: 'drop' }
  ];
  h.state.fields = [{ x: 100, z: 0, r: 12, until: 10, type: 'repair' }];
  h.state.scans = [{ x: 100, z: 0, r: 32, until: 10 }];
  h.state.strikes = [{ x: 100, z: 0, at: 10, type: 'orbital', team: 0 }];
  const before = JSON.stringify([h.effects.fx, h.state]);
  assert.equal(h.render().length, 0);
  assert.equal(JSON.stringify([h.effects.fx, h.state]), before);
  h.effects.fx.push({ ...common, type: 'particle', size: .1 },
    { ...common, type: 'shell', tx: 110, tz: 0, startY: 1 });
  const calls = h.render();
  assert.deepEqual(calls.map(c => c[0]), ['box', 'sphere'], 'preserve possible offscreen shadows, cull only shell trail');
  assert.ok(calls.every(c => c[13] !== 'effects'));
  // Panning back rebuilds from current CPU effects, without having deleted them.
  const offscreenCount = calls.length;
  h.R.vp[12] = -10;
  assert.ok(h.render().length > offscreenCount);
});

test('drop columns remain visible when their ground anchor is below the viewport', () => {
  const h = effectCullingView();
  h.R.vp[13] = -2;
  h.effects.fx = [{ type: 'drop', x: 0, z: 0, life: 1, maxLife: 1, color: 1 }];
  assert.deepEqual(h.render().map(c => c[0]), ['beam'], 'full vertical segment survives, ground ring is offscreen');
});

test('effect culling preserves visible output and does not redistribute the accent budget', () => {
  const h = effectCullingView();
  h.R.quality = 1;
  const beam = x => ({ type: 'beam', x, y: 1, z: 0, tx: x+1, ty: 1, tz: 0,
    width: .04, life: .1, maxLife: .2, color: 1 });
  h.effects.fx = Array.from({ length: 16 }, () => beam(100));
  h.effects.fx.push(beam(0));
  for (const f of h.effects.fx) h.effects.combatBeams.set(f, .2);
  assert.deepEqual(h.render().map(c => c[0]), ['beam'], 'offscreen accents still consume their existing budget');
  h.effects.fx = [beam(0), { type: 'smoke', x: 1, y: 2, z: 0, size: 2, life: .5, maxLife: 1, color: 2 }];
  const bounded = JSON.stringify(h.render());
  h.R.vp = undefined;
  assert.equal(JSON.stringify(h.render()), bounded, 'fully visible draw parameters and order are unchanged');
});

test('Forum parcel fills follow native terrain facets and cut the circle, all streets and the plaza exactly, without RNG or state changes',()=>{
 const context=loadScripts(['core','content','battlefield-surface',...SIMULATION_SCRIPTS,'world-view']);
 const {BattlefieldSurface,buildForumParcelGeometry,forumCorridors,forumCorridorBlocked,buildingVisualYaw,FORUM_SETTLEMENT}=vm.runInContext(
  '({BattlefieldSurface,buildForumParcelGeometry,forumCorridors,forumCorridorBlocked,buildingVisualYaw,FORUM_SETTLEMENT})',context);
 vm.runInContext('Math.random = seeded = () => { throw Error("Parcel rendering must not consume RNG"); }',context);
 const surface=new BattlefieldSurface(80,4,(x,z)=>3+Math.sin(x*.7)*.3+Math.cos(z*.4)*.2),before=surface.heights.slice(),radius=FORUM_SETTLEMENT.radius;
 const cross=(a,b,p)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);
 for(const rotation of [0,1/3,2]){
  const forum=Object.freeze({id:1,x:7,z:-4,size:10.4,team:0,visualRotation:rotation}),saved=JSON.stringify(forum),
   data=buildForumParcelGeometry({surface},forum),streets=forumCorridors(forum,forum.size+.5),triangles=[];
  assert.ok(data.length>0);assert.equal(data.length%27,0);
  for(let i=0;i<data.length;i+=27){
   const points=[0,9,18].map(o=>({x:data[i+o]+forum.x,y:data[i+o+1],z:data[i+o+2]+forum.z}));triangles.push(points);
   for(const p of points){assert.ok(Math.hypot(p.x-forum.x,p.z-forum.z)<=radius+1e-4);assert.ok(Math.abs(p.y-surface.heightAt(p.x,p.z)-.065)<1e-5);}
   const center={x:points.reduce((s,p)=>s+p.x,0)/3,z:points.reduce((s,p)=>s+p.z,0)/3};
   assert.ok(Math.abs(points.reduce((s,p)=>s+p.y,0)/3-surface.heightAt(center.x,center.z)-.065)<1e-5,'a triangle never bridges a CPU terrain facet');
   assert.ok(streets.every(poly=>!poly.every((a,j)=>cross(a,poly[(j+1)%poly.length],center)>1e-4)),'no painted triangle lies inside a street or plaza');
  }
  const yaw=buildingVisualYaw(forum),cs=Math.cos(yaw),sn=Math.sin(yaw),at=(x,z)=>({x:forum.x+x*cs+z*sn,z:forum.z-x*sn+z*cs}),
   covered=p=>triangles.some(t=>{const d=t.map((a,j)=>cross(a,t[(j+1)%3],p));return d.every(v=>v>=-1e-6)||d.every(v=>v<=1e-6);});
  for(const x of [-.75,-.25,.25,.75])for(const z of [-.55,.55])assert.equal(covered(at(x*radius,z*radius)),true,'all eight parcels are filled');
  for(const [x,z] of [[-radius/2,33],[0,40],[radius/2,-33],[45,0],[0,0],[7,7]])assert.equal(covered(at(x,z)),false,'street and plaza interiors remain completely empty');
  const plaza=forum.size+.5;
  assert.ok(streets[4].every(p=>Math.abs(Math.hypot(p.x-forum.x,p.z-forum.z)-plaza)<1e-9),'visible plaza matches the small selection ring');
  assert.equal(covered(at(10,10)),true,'the formerly empty band outside the selection ring is now painted');
  assert.equal(forumCorridorBlocked(forum,at(10,10),.1),true,'the hidden navigation reserve still protects Worker access');
  for(let i=0;i<16;i++){
   const angle=i*Math.PI*2/16;
   assert.equal(covered(at(Math.cos(angle)*plaza*.95,Math.sin(angle)*plaza*.95)),false,'the round plaza stays empty in every direction');
  }
  for(const sx of [-1,1])for(const sz of [-1,1])
   assert.equal(covered(at(sx*plaza*.85,sz*plaza*.85)),true,'former square corners are painted outside the round plaza');
  assert.equal(covered(at(radius+1,0)),false);assert.equal(JSON.stringify(forum),saved);
 }
 const edge=buildForumParcelGeometry({surface},{id:1,x:78,z:0,size:10.4,team:0});
 for(let i=0;i<edge.length;i+=9)assert.ok(Math.abs(edge[i]+78)<=surface.extent+1e-4&&Math.abs(edge[i+2])<=surface.extent+1e-4,'no fill outside native map bounds');
 assert.equal(buildForumParcelGeometry({surface},{id:1,x:0,z:0,size:100,team:0}).length,0,'a fully excluded area produces no geometry');
 assert.deepEqual(surface.heights,before);
});

// Execute the real app loop with synthetic rAF timestamps, without WebGL or a browser.
function appClock(diagnostic = false) {
  let now = 0;
  const pending = [], draws = [], ticks = [], steps = [], effectTicks = [], errors = [], weatherClocks = [], entitiesDrawn = [], rings = [], parcelBuilds = [];
  const renderWork = { begin: 0, battlefield: 0, overlay: 0 };
  const elements = new Map(), window = {}, queryRequests = [], buildings = {}, forumSettings = {radius:73};
  const document = { hidden: false, body: { appendChild() {} }, createElement: () => ({ append() {} }) };
  const $ = id => {
    if (!elements.has(id)) elements.set(id, {
      handlers: {}, style: {}, classList: { add() {}, remove() {} },
      addEventListener(name, fn) { this.handlers[name] = fn; },
      getContext: () => ({ setTransform() {}, drawImage() {} })
    });
    return elements.get(id);
  };
  loadScripts(['core', ...DIAGNOSTIC_SCRIPTS, 'app'], { globals: {
    $, window, document, navigator: { userAgent: 'clock-test' }, URLSearchParams,
    location: { search: diagnostic ? '?diagnostics=1' : '' }, devicePixelRatio: 1,
    performance: { now: () => now }, requestAnimationFrame: fn => pending.push(fn),
    addEventListener() {}, ResizeObserver: class { observe() {} }, matchMedia:()=>({matches:true}),
    console: { error: e => errors.push(e), warn() {} },
    META: {}, PERMANENT_UPGRADES: {}, ABILITIES: {}, EXPEDITION_BENEFITS: {}, BATTLEFIELDS: {desert:{render:{}}}, MISSIONS: {}, UNITS: {}, BUILDINGS: buildings, FACTIONS: {},
    PLACEMENT_GUIDE_MATERIAL: -9, FORUM_PARCEL_MATERIAL: -10,
    buildForumParcelGeometry(world,forum) {
      parcelBuilds.push({world,id:forum.id,rotation:forum.visualRotation||0});
      if(world.emptyParcels) return new Float32Array();
      return new Float32Array([0,1,0,0,1,0,1,1,1,0,1,1,0,1,0,1,1,1,1,1,1,0,1,0,1,1,1]);
    },
    battlefieldId: map => map,
    Battlefield: class { renderProfile = {}; },
    savedBattleMenuScene: vm.runInContext('savedBattleMenuScene', loadScripts(['world-view'])),
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)), expeditionEnemyCount() {}, esc: String,
    expeditionStageUnlocked: vm.runInContext('expeditionStageUnlocked', loadScripts(['content'])),
    createBuildingPreview: (type,p,faction,team) => ({type,...p,faction,team}),
    FORUM_SETTLEMENT: forumSettings, drawEffectRing(_renderer,...args) { rings.push(args); },
    createMeridianPersistence: () => ({ loadProfile: () => ({ settings: { quality: 2 } }) }),
    MeridianRenderer: class {
      viewport = { width: 800, height: 600, left: 0, top: 0 };
      gl = { getExtension(name) { queryRequests.push(name); return null; } };
      meshes = {}; static = {}; dynamic = {}; effects = {}; textureResources = {};
      width = 800; height = 600; sceneSamples = 0; bloomTargets = []; bloomWidth = 1; bloomHeight = 1; canRetainScene = true;
      frameReady() { return true; } releaseEnvironment() {} releaseMenuSky() {} releaseGeometry() {}
      streamGeometry() {} add() {}
      hasBattlefieldTextures() { return true; }
      async prepareBattlefieldTextures() { return true; }
      setBattlefieldTime(time) { this.battlefieldTime=time; }
      setMenuSky(seed,family) { this.menuSky={seed,family}; }
      resize() {} camera() {} project() { return {x:400,y:300}; } begin() { renderWork.begin++; }
      render(time, modelTime, thumbnails, retainScene) { this.diagnostics?.beginFrame(); thumbnails?.(); draws.push({ now, time, retainScene }); }
    },
    // This fixture tests app mesh/lifecycle behavior; shared placement rules have their own tests.
    PlacementGuideSampler: class {
      constructor(game,type,team) {
        Object.assign(this,{game,type,team});
        (game.guideSamplers ??= []).push(this);
      }
      retainTerrainFootprint(...bounds) { this.bounds=bounds; }
      refresh() {
        this.pending=!!this.game.guidePendingFrames;
        if(this.pending) this.game.guidePendingFrames--;
      }
      sample(p) {
        const {game,type,team}=this, world=game.world;
        if (Math.abs(p.x)>=world.extent-4 || Math.abs(p.z)>=world.extent-4 || !world.sight[team].visible[world.idx(p.x,p.z)]) return 0;
        return game.canBuild(type,p,team)?-1:1;
      }
    },
    MeridianModelThumbnails: class { update() {} dispose() {} },
    BattlefieldView: class {
      world={terrainSeed:7,definition:{render:{groundTexture:'ground'}}};
      sync() {} retainBuildingGround() {} drawBuildingGround() {}
    },
    MeridianAudio: class { update() {} },
    MeridianGame: class {
      world = {};
      s = { time: 0, speed: 1, entities: [], supplyCaches: [], cam: { x: 0, z: 0, zoom: 65, yaw: 0 } };
      effects = { fx: [], tick: dt => effectTicks.push(dt) };
      step(dt) { steps.push(dt); this.s.time += dt; }
    },
    MeridianUI: class {
      view = 'game'; paused = false; pointer = {}; pings = [];
      showHome() {} saveBattle() {} autosaveBattle() {} drawMinimap() {} drawOverlay() { renderWork.overlay++; }
      selectionIds() { return new Set(); }
      cameraClamp = p => ({x:p.x,z:p.z});
      clampCameraPoint(p) { return this.cameraClamp(p); }
      tick(dt) { ticks.push(dt); }
    },
    renderEntity(R,e,t,options) { entitiesDrawn.push({entity:e,options}); },
    renderBattlefieldEffects(R,e,w,s,p,time,team,weatherTime) {
      renderWork.battlefield++;
      weatherClocks.push({now,state:s.time,effects:time,weather:weatherTime});
    }
  } });
  assert.ok(window.Meridian, 'app initializes');
  assert.deepEqual(errors, []);
  return { ...window.Meridian, draws, renderWork, ticks, steps, effectTicks, errors, pending, queryRequests, weatherClocks, entitiesDrawn, rings, parcelBuilds, forumSettings, $,
    get performance() { return window.Meridian.performance; },
    setBuilding(name,value) { buildings[name]=value; },
    frame(t) {
      assert.equal(pending.length, 1, 'exactly one outstanding rAF');
      now = t;
      pending.shift()(now);
    }
  };
}

test('selected Forum parcel overlays are translucent, cached while paused, update on rotation/world changes and release on deselection or menus',()=>{
 const h=appClock(),uploads=[],marks=[],releases=[],forum={id:1,kind:'building',type:'meridianforum',team:0,hp:950,size:10.4,x:12,z:8,progress:.5};
 h.ui.paused=true;h.game.localTeam=0;h.game.s.entities=[forum];h.setBuilding('meridianforum',{});
 h.game.world={surface:{entityHeight:()=>0}};h.game.observed=()=>true;h.ui.introObserves=()=>false;
 h.game.random=()=>assert.fail('Parcel overlay cannot draw battle RNG');let selected=true;
 h.ui.selectionIds=()=>new Set(selected?[forum.id]:[]);
 h.renderer.streamGeometry=(name,data)=>uploads.push({name,data});h.renderer.add=(...args)=>marks.push(args);h.renderer.releaseGeometry=name=>releases.push(name);
 const before=JSON.stringify(h.game.s);h.frame(0);assert.equal(JSON.stringify(h.game.s),before);
 assert.equal(uploads.length,1);assert.equal(marks[0][0],'forumParcels:1');assert.equal(marks[0][13],'effects');assert.equal(marks[0][14],-10);
 assert.ok(marks[0][12]>0&&marks[0][12]<.5,'translucent fill, not an opaque surface');
 h.frame(20);assert.equal(uploads.length,1,'no per-frame geometry upload');
 forum.visualRotation=1;h.frame(40);assert.equal(uploads.length,2);assert.equal(h.parcelBuilds.at(-1).rotation,1);
 forum.cinderStock=1200;h.game.s.cam.x=3;h.renderer.viewport.width=960;h.frame(60);assert.equal(uploads.length,2,'stock, camera and viewport do not change the terrain mesh');
 h.renderer.project=()=>({x:-2000,y:300});const count=marks.length;h.frame(80);assert.ok(marks.length>count,'offscreen Forum centers cannot cull a visible part of the circle');
 h.game.world={...h.game.world};h.frame(100);assert.equal(uploads.length,3);
 h.game.world.surface={entityHeight:()=>0};h.frame(120);assert.equal(uploads.length,4);
 selected=false;h.ui.hover=forum.id;h.frame(140);assert.deepEqual(releases,['forumParcels:1'],'hover alone retains no fill');
 selected=true;h.frame(160);assert.equal(uploads.length,5);
 h.game.observed=()=>false;h.frame(180);assert.equal(releases.length,2,'hidden Forums retain no overlay');
 h.game.observed=()=>true;forum.hp=0;h.frame(200);assert.equal(uploads.length,5);
 forum.hp=950;h.frame(220);h.ui.battleIntro={};h.frame(240);assert.equal(releases.length,3,'intros do not show planning overlays');
 h.ui.battleIntro=null;h.frame(260);h.ui.view='home';h.frame(280);assert.equal(releases.length,4,'menu transition releases view-owned GPU data');
 assert.equal(h.steps.length,0);assert.deepEqual(h.errors,[]);
});

test('Forum parcel overlays drop stale GPU geometry when a changed world has no paintable area',()=>{
 const h=appClock(),uploads=[],releases=[],marks=[],forum={id:1,kind:'building',type:'meridianforum',team:0,hp:950,size:10.4,x:0,z:0};
 h.ui.paused=true;h.game.s.entities=[forum];h.setBuilding('meridianforum',{});h.game.localTeam=0;
 h.game.world={surface:{entityHeight:()=>0}};h.game.observed=()=>true;h.ui.selectionIds=()=>new Set([1]);
 h.renderer.streamGeometry=name=>uploads.push(name);h.renderer.releaseGeometry=name=>releases.push(name);h.renderer.add=(...args)=>marks.push(args);
 h.frame(0);assert.equal(uploads.length,1);assert.equal(marks.length,1);
 h.game.world={...h.game.world,emptyParcels:true};h.frame(20);h.frame(40);
 assert.equal(uploads.length,1);assert.equal(marks.length,1);assert.deepEqual(releases,['forumParcels:1']);
 assert.equal(h.parcelBuilds.length,2,'empty areas are cached without uploading empty meshes');assert.deepEqual(h.errors,[]);
});

test('selected Forums show their configured settlement radius, including offscreen centers, without state or RNG changes',()=>{
 const h=appClock(),forum=Object.freeze({id:1,kind:'building',type:'meridianforum',team:0,hp:950,size:10.4,x:12,z:8,progress:.5});
 h.ui.paused=true;h.game.localTeam=0;h.game.s.entities=[forum];h.setBuilding('meridianforum',{});
 h.game.observed=()=>true;h.ui.introObserves=()=>false;h.game.random=()=>assert.fail('Radius display must not consume battle RNG');
 let selected=true;h.ui.selectionIds=()=>new Set(selected?[forum.id]:[]);
 const before=JSON.stringify(h.game.s),radiusRings=()=>h.rings.filter(r=>r[2]===h.forumSettings.radius);
 h.frame(0);assert.equal(radiusRings().length,1);assert.deepEqual(radiusRings()[0].slice(0,3),[forum.x,forum.z,h.forumSettings.radius]);
 assert.equal(JSON.stringify(h.game.s),before);assert.equal(h.steps.length,0);
 h.rings.length=0;h.renderer.project=()=>({x:-1000,y:300});h.frame(20);
 assert.equal(radiusRings().length,1,'entity-center culling cannot hide a potentially visible radius');
 h.rings.length=0;h.renderer.project=()=>({x:400,y:300});selected=false;h.ui.hover=forum.id;h.frame(40);
 assert.equal(radiusRings().length,0,'hover alone does not show the settlement radius');
 h.rings.length=0;h.ui.hover=null;h.frame(60);assert.equal(h.rings.length,0);
 selected=true;h.game.s.entities=[{...forum,hp:0}];h.frame(80);assert.equal(radiusRings().length,0);
 h.game.s.entities=[forum];h.game.observed=()=>false;h.frame(100);assert.equal(radiusRings().length,0);
 h.game.observed=()=>true;h.setBuilding('fieldlab',{});h.game.s.entities=[{...forum,type:'fieldlab'}];h.frame(120);
 assert.equal(radiusRings().length,0,'other civilian buildings have no settlement radius');
 assert.deepEqual(h.errors,[]);
});

test('app revalidates restored and resized cameras while paused but leaves cinematic travel alone',()=>{
  const h=appClock(),cam=h.game.s.cam;let calls=0;
  h.ui.paused=true;cam.x=1000;
  h.ui.cameraClamp=p=>{calls++;return {x:Math.min(5,p.x),z:p.z};};
  h.frame(0);assert.equal(cam.x,5);assert.ok(calls>0);
  h.renderer.viewport.width=1600;cam.x=1000;
  h.frame(20);assert.equal(cam.x,5);
  const before=calls;h.ui.battleIntro={};cam.x=1000;
  h.frame(40);assert.equal(cam.x,1000);assert.equal(calls,before);
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.steps,[]);
});

test('result background retains scene construction but invalidates camera, resize, quality and view changes',()=>{
  const a=appClock();a.game.s.result={win:true};a.ui.paused=true;a.ui.modalKind='result';
  a.frame(20);a.frame(40);
  assert.deepEqual(a.draws.map(d=>d.retainScene),[false,true]);
  assert.deepEqual(a.renderWork,{begin:1,battlefield:1,overlay:1});
  assert.equal(a.ticks.length,2);assert.equal(a.steps.length,0);
  const redraw=change=>{change();a.frame(a.draws.at(-1).now+20);assert.equal(a.draws.at(-1).retainScene,false);};
  redraw(()=>a.game.s.cam.x++);
  redraw(()=>a.renderer.quality=1);
  redraw(()=>a.renderer.canRetainScene=false);a.renderer.canRetainScene=true;
  redraw(()=>a.ui.onViewportChange());
  redraw(()=>a.ui.pings.push({life:1}));
  a.ui.pings=[];redraw(()=>{});
  a.frame(a.draws.at(-1).now+20);assert.equal(a.draws.at(-1).retainScene,true);
  redraw(()=>a.game.s={...a.game.s});
  redraw(()=>a.ui.view='codex');redraw(()=>a.ui.view='game');
  redraw(()=>{a.game.s.result=null;a.ui.paused=false;a.ui.modalKind=null;});
  a.frame(a.draws.at(-1).now+60);
  assert.ok(a.steps.length>0);assert.deepEqual(a.errors,[]);
});

test('result UI advances transient clocks without updating the hidden HUD or minimap',()=>{
  const context=loadScripts(['ui-presentation'],{globals:{defineMeridianUIMethods(){},performance:{now:()=>0}}}),
    tick=vm.runInContext('uiPresentationMethods.tick',context),calls=[];
  const ui={view:'game',game:{s:{result:{win:false}}},pings:[{life:.1}],hudClock:0,
    notifyStorageFailure(){calls.push('storage');},advanceTutorialArrival(){},advanceBattleIntro(){},
    armRectangleSelection(){},updateTutorialSpeedHint(){},refreshCivilizationScore(){calls.push('score');},
    updateQueues(){calls.push('queues');},updateHUD(){calls.push('hud');},drawMinimap(){calls.push('minimap');}};
  tick.call(ui,.3);assert.deepEqual(calls,['storage']);assert.equal(ui.pings.length,0);
  ui.game.s.result=null;tick.call(ui,.3);assert.deepEqual(calls,['storage','storage','queues','score','hud','minimap']);
});

test('app enables celestial backdrops only on home, never in combat or codex',()=>{
  const a=appClock();
  a.frame(0);assert.equal(a.renderer.menuSky.seed,null);
  a.ui.view='home';a.frame(20);
  assert.deepEqual(a.renderer.menuSky,{seed:7,family:'ground'});
  assert.equal(a.renderer.battlefieldTime,0);
  a.ui.view='codex';a.frame(40);assert.equal(a.renderer.menuSky.seed,null);
  a.ui.view='game';a.frame(60);assert.equal(a.renderer.menuSky.seed,null);
  assert.equal(a.renderer.battlefieldTime,a.game.s.time);
  assert.deepEqual(a.errors,[]);
});

test('home atmosphere freezes current and historical worlds but resets for landscape-only or abandoned saves', async () => {
  const a=appClock();
  a.game.s=null;a.ui.view='home';
  a.ui.expedition={encounter:{map:'desert',seed:123},battle:{state:{map:'desert',seed:123,time:347,entities:[],cam:{x:0,z:0}}}};
  assert.equal(await a.ui.onPreview('desert',123),true);
  a.frame(0);assert.equal(a.renderer.battlefieldTime,347);
  assert.equal(a.renderer.menuSky.seed,null,'saved scene uses the time-aware battlefield sky');
  a.frame(1000);assert.equal(a.renderer.battlefieldTime,347,'menu does not advance the day');
  assert.equal(await a.ui.onPreview('desert',122),true);
  a.frame(1020);assert.equal(a.renderer.battlefieldTime,0,'archive uses seed starting time');
  assert.equal(a.renderer.menuSky.seed,7,'archive retains celestial backdrop');
  await a.ui.onPreview('desert',123);
  a.frame(1040);assert.equal(a.renderer.battlefieldTime,347,'return to checkpoint restores its time');
  const historical={state:{map:'desert',seed:123,time:912,entities:[{id:99,kind:'building',type:'hq',hp:10,x:4,z:6}],cam:{x:0,z:0}}};
  await a.ui.onPreview('desert',123,false,historical);
  a.frame(1060);assert.equal(a.renderer.battlefieldTime,912);
  assert.equal(a.renderer.menuSky.seed,null,'historical world also uses the battlefield sky');
  assert.equal(a.entitiesDrawn.at(-1).entity.id,99,'explicit snapshot wins even with identical map/seed');
  a.ui.expedition=null;
  await a.ui.onPreview('desert',123);
  a.frame(1080);assert.equal(a.renderer.battlefieldTime,0,'abandoned save leaves no old time');
  assert.deepEqual(a.errors,[]);
});

test('smooth app preview carries its snapshot through loading and ignores superseded requests',async()=>{
  const a=appClock();a.game.s=null;a.ui.view='home';
  const battle=time=>({state:{map:'desert',seed:123,time,entities:[],cam:{x:0,z:0}}});
  a.ui.expedition={encounter:{map:'desert',seed:123},battle:battle(10)};
  await a.ui.onPreview('desert',123,false,a.ui.expedition.battle);a.frame(0);
  const historical=battle(900),pending=a.ui.onPreview('desert',123,true,historical);
  a.frame(20);await new Promise(setImmediate);a.frame(40);
  assert.equal(await pending,true);assert.equal(a.renderer.battlefieldTime,900);
  const stale=a.ui.onPreview('desert',123,true,battle(800));a.frame(60);
  await a.ui.onPreview('desert',123,false,battle(700));await new Promise(setImmediate);a.frame(80);
  assert.equal(await stale,false);assert.equal(a.renderer.battlefieldTime,700);
  assert.deepEqual(a.errors,[]);
});

test('app world launch validates archive identity and does not load after leaving home',async()=>{
  const a=appClock(),world={stage:1,recipe:{},battle:{state:{}}},calls=[];
  a.ui.view='home';a.ui.expedition={worlds:[world]};
  a.game.restoreBattle=(target,completed)=>calls.push({target,completed});
  const target={battle:world.battle};
  assert.equal(await a.ui.onLaunchBattle({map:'desert'},target,world),true);
  assert.deepEqual(calls,[{target,completed:true}]);
  let resolve;a.renderer.prepareBattlefieldTextures=()=>new Promise(done=>{resolve=done;});
  const pending=a.ui.onLaunchBattle({map:'desert'},target,world);
  a.ui.view='codex';resolve(true);assert.equal(await pending,false);assert.equal(calls.length,1);
  assert.deepEqual(a.errors,[]);
});

test('real app build preview validates and draws the same screen target used by placement', () => {
  const a=appClock(), target={x:20,z:30}, checks=[];
  a.ui.mode={kind:'build',arg:'refinery'};a.ui.pointer={inside:true,x:440,y:350};
  a.ui.targetPosition=(x,y)=>{assert.deepEqual([x,y],[440,350]);return {...target};};
  a.game.world.extent=90;a.game.s.parties=[{faction:0}];
  a.game.foundationPosition=(type,p,team)=>{checks.push(['foundation',type,{...p},team]);return {...p};};
  a.game.canBuild=(type,p,team)=>{checks.push(['validate',type,{...p},team]);return '';};
  a.game.localTeam=0;
  // The helper's app context uses no real renderer; provide only the chosen metadata.
  a.setBuilding('refinery',{size:3});
  a.frame(20);
  assert.deepEqual(checks,[['foundation','refinery',target,0],['validate','refinery',target,0]]);
  const preview=a.entitiesDrawn[0];
  assert.equal(preview.entity.x,20);assert.equal(preview.entity.z,30);
  assert.equal(preview.options.alpha,.3);assert.equal(preview.options.layer,'effects');
  assert.deepEqual(a.errors,[]);
});

test('placement guide makes one fine, continuous terrain mesh from bounded visible build samples', () => {
  const a=appClock(), marks=[], samples=[], uploads=[], releases=[];
  a.ui.mode={kind:'build',arg:'depot'};a.ui.pointer={inside:false};a.ui.paused=true;
  a.setBuilding('depot',{size:2});a.game.localTeam=0;
  a.renderer.ground=(x,y,terrain)=>{assert.equal(terrain,false);return {x:(x-400)/20,z:(y-300)/20};};
  a.game.world={extent:50, fogVersion:0, surface:{maxHeight:4,heightAt:(x,z)=>3+x*.01},
    sight:[{visible:new Uint8Array([1])}], idx:()=>0};
  a.game.s.cam.zoom=40;
  a.game.canBuild=(type,p,team)=>{samples.push([type,p.x,p.z,team]);return p.x<0?'blocked':'';};
  a.renderer.add=(...args)=>marks.push(args);
  a.renderer.streamGeometry=(name,data)=>uploads.push({name,data});
  a.renderer.releaseGeometry=name=>releases.push(name);
  a.ui.paused=false;a.frame(20);
  assert.ok(samples.length>0 && samples.length<500);
  assert.equal(uploads.length,1);
  assert.equal(uploads[0].name,'placementGuide');
  assert.ok(uploads[0].data.length>samples.length*54,'finer triangles than validation samples');
  const colors=[];
  for(let i=0;i<uploads[0].data.length;i+=9) colors.push(uploads[0].data.slice(i+6,i+9));
  assert.ok(colors.some(c=>c[0]>c[1]),'red where blocked');
  assert.ok(colors.some(c=>c[1]>c[0]),'turquoise where buildable');
  assert.ok(colors.some(c=>c[0]>.42&&c[0]<.94),'smooth transition between samples');
  assert.ok(marks.every(m=>m[0]==='placementGuide'&&m[13]==='effects'));
  assert.deepEqual(a.errors,[]);
  const count=samples.length;a.frame(40);assert.equal(samples.length,count,'reuse mesh between revisions');
  a.game.world.fogVersion++;a.frame(60);
  assert.equal(uploads.length,1,'unchanged sampled colors do not upload on fog revisions');
  assert.equal(samples.length,count*2);
  a.game.canBuild=()=>'';a.game.world.fogVersion++;a.frame(80);
  assert.equal(uploads.length,2);
  assert.strictEqual(uploads[0].data,uploads[1].data,'reuse CPU mesh storage for changed colors');
  const afterChange=samples.length;
  a.game.world.sight[0].visible[0]=0;a.game.world.fogVersion++;a.frame(100);
  assert.equal(samples.length,afterChange,'do not probe unseen terrain');
  a.ui.mode=null;a.frame(120);assert.deepEqual(releases,['placementGuide']);
  assert.deepEqual(a.errors,[]);
});

test('placement guide covers wide viewports and raised ground, updating on rotation and resize', () => {
  const a=appClock(), uploads=[], marks=[];
  a.ui.mode={kind:'build',arg:'depot'};a.ui.pointer={inside:false};
  a.setBuilding('depot',{size:2});a.game.localTeam=0;
  a.game.world={extent:135,fogVersion:0,surface:{maxHeight:60,heightAt:()=>60},
    sight:[{visible:new Uint8Array([1])}],idx:()=>0};
  a.game.canBuild=()=>'';
  a.renderer.streamGeometry=(name,data)=>uploads.push(data);
  a.renderer.add=(...args)=>marks.push(args);
  a.renderer.ground=(x,y,terrain)=>{
    assert.equal(terrain,false);
    return {x:(x-400)/8,z:(y-300)/15};
  };
  const colorAt=(x,z)=>{
    const data=uploads.at(-1), mark=marks.at(-1);
    for(let i=0;i<data.length;i+=9)
      if(Math.abs(data[i]+mark[1]-x)<.01 && Math.abs(data[i+2]+mark[3]-z)<.01)
        return data[i+7];
    return 0;
  };
  a.frame(20);
  assert.deepEqual(a.errors,[]);
  assert.ok(colorAt(48,63)>.8,'wide edge of elevated visible ground is not capped at 36');
  const count=uploads.length;a.frame(40);assert.equal(uploads.length,count);
  a.game.s.cam.yaw=Math.PI/2;a.frame(60);
  assert.equal(uploads.length,count+1,'rotation changes the elevated ground footprint');
  assert.ok(colorAt(93,0)>.8,'raised terrain shifts along the rotated camera axis');
  a.renderer.viewport.width=960;a.frame(80);
  assert.equal(uploads.length,count+2,'viewport resizing invalidates the mesh');
  assert.ok(colorAt(111,0)>.8,'newly exposed right edge is covered');
  assert.deepEqual(a.errors,[]);
});

test('placement guide reuses terrain sampler on camera changes, but not across build contexts',()=>{
  const a=appClock();
  a.ui.mode={kind:'build',arg:'depot'};a.ui.pointer={inside:false};a.game.localTeam=0;
  a.setBuilding('depot',{size:2});a.setBuilding('hq',{size:4});
  a.game.world={extent:50,fogVersion:0,surface:{maxHeight:0,heightAt:()=>0},
    sight:[{visible:new Uint8Array([1])},{visible:new Uint8Array([1])}],idx:()=>0};
  a.game.canBuild=()=>'';
  let pan=0;
  a.renderer.ground=(x,y)=>({x:(x-400)/20+pan,z:(y-300)/20});
  a.renderer.streamGeometry=()=>{};a.renderer.add=()=>{};
  a.frame(20);
  const first=a.game.guideSamplers[0], initialBounds=[...first.bounds];
  pan=6;a.frame(40);
  assert.equal(a.game.guideSamplers.length,1,'pan retains the sampler');
  assert.notDeepEqual(first.bounds,initialBounds,'new footprint prunes its terrain cache');
  a.renderer.viewport.width=960;a.frame(60);
  assert.equal(a.game.guideSamplers.length,1,'resize retains the sampler');
  a.ui.mode={kind:'build',arg:'hq'};a.frame(80);
  assert.equal(a.game.guideSamplers.length,2,'building type replaces sampler');
  a.game.localTeam=1;a.frame(100);
  assert.equal(a.game.guideSamplers.length,3,'team replaces sampler');
  a.game.world={...a.game.world};a.frame(120);
  assert.equal(a.game.guideSamplers.length,4,'world replaces sampler');
  a.ui.mode=null;a.frame(140);
  a.ui.mode={kind:'build',arg:'hq'};a.frame(160);
  assert.equal(a.game.guideSamplers.length,5,'ending build mode releases the cache');
  assert.deepEqual(a.errors,[]);
});

test('placement guide batches cold terrain across frames before uploading and hides stale fields',()=>{
  const a=appClock(),uploads=[],marks=[];
  a.ui.mode={kind:'build',arg:'depot'};a.ui.pointer={inside:false};a.game.localTeam=0;a.game.guidePendingFrames=2;
  a.setBuilding('depot',{size:2});
  a.game.world={extent:50,fogVersion:0,surface:{maxHeight:0,heightAt:()=>3},sight:[{visible:new Uint8Array([1])}],idx:()=>0};
  a.game.canBuild=()=>'';
  a.renderer.ground=(x,y)=>({x:(x-400)/20,z:(y-300)/20});
  a.renderer.streamGeometry=(name,data)=>uploads.push(data);a.renderer.add=(...args)=>marks.push(args);
  a.frame(20);a.frame(40);assert.equal(uploads.length,0);assert.equal(marks.length,0);
  a.frame(60);assert.equal(uploads.length,1);assert.equal(marks.length,1);
  assert.ok(Math.abs(uploads[0][1]-3.065)<1e-5,'positions initialize when a deferred mesh is first uploaded');
  a.game.guidePendingFrames=1;a.game.world.fogVersion++;a.frame(80);
  assert.equal(marks.length,1,'do not draw stale colors while new samples are pending');
  a.frame(100);assert.equal(marks.length,2);assert.equal(uploads.length,1,'reuse unchanged completed field');
  a.ui.mode=null;a.frame(120);assert.deepEqual(a.errors,[]);
});

test('real app loop gates occlusion by party observation and excludes intro-only contacts', () => {
  const a = appClock(); a.ui.paused = true; a.game.localTeam = 2;
  a.game.s.entities = [
    {id:1,kind:'unit',type:'rifle',team:2,hp:100},
    {id:2,kind:'building',type:'hq',team:1,hp:100},
    {id:3,kind:'resource',type:'gas',team:-1,hp:100},
    {id:4,kind:'resource',type:'gas',team:-1,hp:100},
    {id:5,kind:'unit',type:'worker',team:1,hp:100}
  ];
  const observed = new Set([1,2,3]);
  a.game.observed = e => observed.has(e.id);
  a.ui.introObserves = e => !!a.ui.battleIntro && e.id===5;
  a.frame(20);
  assert.deepEqual(a.entitiesDrawn.map(v=>v.entity.id),[1,2,3]);
  assert.ok(a.entitiesDrawn.every(v=>v.options.occlusion && v.options.localTeam===2));
  observed.delete(2);a.entitiesDrawn.length=0;a.frame(40);
  assert.deepEqual(a.entitiesDrawn.map(v=>v.entity.id),[1,3],'visibility loss is applied next frame');
  a.ui.battleIntro={};a.entitiesDrawn.length=0;a.frame(60);
  assert.deepEqual(a.entitiesDrawn.map(v=>v.entity.id),[1,3,5]);
  assert.ok(a.entitiesDrawn.every(v=>!v.options.occlusion),'intro presentation never grants x-ray visibility');
  assert.deepEqual(a.errors,[]);
});

for (const hz of [30, 59.94, 60, 90, 120, 144]) {
  test(`app renders at most 60 FPS without slowing its clocks at ${hz} Hz`, () => {
    const a = appClock(), count = Math.floor(hz * 10);
    for (let i = 1; i <= count; i++) a.frame(i * 1000 / hz);
    const seconds = count / hz;
    assert.ok(Math.abs(a.draws.length - Math.min(60, hz) * seconds) <= 1);
    assert.ok(Object.values(a.renderWork).every(count => count === a.draws.length),
      'skipped frames omit instance/effect construction and overlay drawing too');
    assert.equal(a.ticks.length, count, 'UI continues on skipped render callbacks');
    assert.ok(Math.abs(a.ticks.reduce((sum, dt) => sum + dt, 0) - seconds) < 1e-8);
    assert.ok(Math.abs(a.steps.length - seconds * 30) <= 1);
    assert.ok(a.steps.every(dt => dt === .05));
    assert.deepEqual(a.effectTicks, a.steps, 'effects retain fixed-step ordering/cadence');
    assert.ok(Math.abs(a.draws.at(-1).time - seconds) < .02);
    assert.ok(Math.abs(a.performance.fps - Math.min(60, hz)) <= 1, 'FPS counts draws, not callbacks');
    assert.equal(a.renderer.quality, 2);
    assert.deepEqual(a.errors, []);
  });
}

test('opt-in diagnostics preserves real app cadence and stops with exportable history on graphics loss', () => {
  const plain = appClock(), measured = appClock(true);
  for (let i = 1; i <= 120; i++) { plain.frame(i * 1000 / 120); measured.frame(i * 1000 / 120); }
  assert.equal(plain.diagnostics, undefined); assert.deepEqual(plain.queryRequests, []);
  assert.deepEqual(measured.steps, plain.steps);
  assert.deepEqual(measured.effectTicks, plain.effectTicks);
  assert.deepEqual(measured.draws, plain.draws);
  assert.deepEqual(measured.ticks, plain.ticks);
  const report = measured.diagnostics.report();
  assert.equal(report.recording.summary.callbacks, 120);
  assert.equal(report.recording.summary.rendered, measured.draws.length);
  assert.equal(report.gpu.status, 'unavailable');
  assert.ok(report.recording.frames.some(f => !f.rendered && f.cpuMs.sceneBuild === undefined));
  measured.$('world').handlers.webglcontextlost({ preventDefault() {} });
  assert.equal(measured.diagnostics.report().recording.stopped, 'context-lost');
  assert.equal(measured.diagnostics.report().recording.frames.length, 120);
  assert.equal(measured.renderer.diagnostics, undefined);
  const failed = appClock(true); failed.frame(20);
  failed.renderer.render = () => { throw Error('synthetic error'); }; failed.frame(40);
  assert.equal(failed.diagnostics.report().recording.stopped, 'render-error');
  assert.equal(failed.diagnostics.report().recording.frames.length, 1);
});

test('render phase tolerates timestamp jitter at 60 Hz and discards slots after a long gap', () => {
  const a = appClock();
  for (let i = 1; i <= 600; i++) a.frame(i * 1000 / 60 + (i % 2 ? -.06 : .06));
  assert.equal(a.draws.length, 600, 'small jitter must not turn 60 Hz into 30 FPS');
  const before = a.draws.length, steps = a.steps.length;
  a.frame(20000);
  assert.equal(a.draws.length, before + 1, 'no render catch-up batch');
  assert.ok(a.steps.length - steps <= 3, 'existing 100 ms elapsed clamp is retained');
  a.frame(20001);
  assert.equal(a.draws.length, before + 1, 'no immediate replay of missed slots');
  assert.deepEqual(a.errors, []);
});

test('app current-stage launch checks the score unlock again after asynchronous texture preparation',async()=>{
  const a=appClock();a.ui.view='home';a.ui.expedition={depth:1,unlockedStage:1,battle:null};
  let starts=0;a.game.start=()=>starts++;
  assert.equal(await a.ui.onLaunchBattle({map:'desert'},a.ui.expedition),false);assert.equal(starts,0);
  a.ui.expedition.unlockedStage=2;
  assert.equal(await a.ui.onLaunchBattle({map:'desert'},a.ui.expedition),true);assert.equal(starts,1);
  let ready;a.renderer.prepareBattlefieldTextures=()=>new Promise(done=>{ready=done;});
  const pending=a.ui.onLaunchBattle({map:'desert'},a.ui.expedition);
  a.ui.expedition.unlockedStage=1;ready(true);
  assert.equal(await pending,false);assert.equal(starts,1);
});

test('frame cap leaves local speed, pause and menu simulation ownership unchanged', () => {
  for (const mode of ['normal', 'double', 'triple', 'paused', 'menu']) {
    const a = appClock();
    const multiplier = mode === 'triple' ? 3 : mode === 'double' ? 2 : 1;
    a.game.s.speed = multiplier;
    if (mode === 'paused') a.ui.paused = true;
    if (mode === 'menu') a.ui.view = 'home';
    for (let i = 1; i <= 120; i++) a.frame(i * 1000 / 120);
    assert.ok(Math.abs(a.draws.length - 60) <= 1);
    if (mode === 'paused' || mode === 'menu') assert.equal(a.steps.length, 0);
    else assert.ok(Math.abs(a.steps.length - 30 * multiplier) <= 1);
    assert.ok(a.steps.every(dt => dt === .05));
    assert.deepEqual(a.effectTicks, a.steps);
    assert.deepEqual(a.errors, []);
  }
});

test('precipitation interpolates only its view clock, freezes on pause and resets per battle', () => {
  const a=appClock();
  for(let i=1;i<=120;i++)a.frame(i*1000/120);
  assert.ok(new Set(a.weatherClocks.map(c=>c.weather)).size>50);
  for(const c of a.weatherClocks) {
    assert.equal(c.effects,c.state,'CPU effect ages/model clocks are unchanged');
    assert.ok(c.weather>=c.state-1e-10&&c.weather<c.state+.05+1e-10);
    assert.ok(Math.abs(c.weather-c.now/1000*1.5)<1e-10,'smooth interpolation at the new base pace');
  }
  a.frame(1017);const paused=a.weatherClocks.at(-1).weather;
  a.ui.paused=true;
  for(const t of [1034,1051,1068])a.frame(t);
  assert.ok(a.weatherClocks.slice(-3).every(c=>c.weather===paused),'no snap backwards when remainder is discarded');
  a.ui.paused=false;a.game.s.speed=2;
  for(const t of [1085,1102,1119])a.frame(t);
  const resumed=a.weatherClocks.slice(-3);
  assert.ok(resumed[0].weather>=paused);
  assert.ok(Math.abs(resumed[2].weather-resumed[1].weather-.051)<1e-10);
  a.game.s={...a.game.s,time:0};a.frame(1136);
  assert.ok(a.weatherClocks.at(-1).weather<.1,'new battle forgets previous weather clock');
  assert.deepEqual(a.errors,[]);
});

test('graphics loss and render errors stop scheduling even with the frame cap', () => {
  for (const contextLoss of [true, false]) {
    const a = appClock();
    a.frame(1000 / 120);
    if (contextLoss) a.$('world').handlers.webglcontextlost({ preventDefault() {} });
    else a.renderer.render = () => { throw Error('test render failure'); };
    a.frame(1000 / 60);
    assert.equal(a.pending.length, 0);
    assert.equal(a.ui.paused, true);
    assert.equal(a.errors.length, contextLoss ? 0 : 1);
  }
});

for (const [kind, expected] of Object.entries(fixture.effects)) {
  test(`effect payload, lifetime and RNG reference: ${kind}`, () => {
    assert.deepEqual(effectSample(kind), expected);
  });
}
