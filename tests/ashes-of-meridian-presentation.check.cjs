// Fixed ground/effect references and deterministic landscape contracts: docs/reference-tests.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/presentation-v1.json');
const { worldSample, effectSample } = require('./helpers/presentation-scenario.cjs');
const vm = require('node:vm');
const { DIAGNOSTIC_SCRIPTS, BATTLEFIELD_SCRIPTS, RENDERER_SCRIPTS, SIMULATION_SCRIPTS, loadScripts } = require('./helpers/game-scripts.cjs');
const { createRendererStub } = require('./helpers/renderer-stub.cjs');
for (const { seed, map, ...expected } of fixture.worlds) {
  test(`world ground reference and repeatable canyon presentation/navigation: ${seed} (${map})`, () => {
    const actual = worldSample(seed, map);
    assert.equal(actual.terrain, expected.terrain, 'ground sampling remains protected by the historical fixture');
    assert.deepEqual(actual, worldSample(seed, map), 'new geometry, placement and navigation are seeded');
  });
}
test('world and simulation start and step without renderer, geometry or browser globals', () => {
  const context = loadScripts(['core', 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'effects', ...SIMULATION_SCRIPTS], { globals: { structuredClone } });
  vm.runInContext('Math.random = () => { throw Error("Unseeded randomness"); }', context);
  const Game = vm.runInContext('MeridianGame', context), game = new Game({ upgrades: {} });
  game.start({ seed: 1409, faction: 0 });
  assert.deepEqual([game.s.parties[0].account.alloy,game.s.parties[0].account.gas],[250,0]);
  assert.deepEqual(Array.from(game.s.parties, p => p.controller.kind), ['human', 'ai']);
  assert.equal(game.train('worker'), true);
  assert.equal('R' in game, false); assert.equal('R' in game.world, false);
  for (let i = 0; i < 1000; i++) { game.step(.05); game.effects.tick(.05); }
  assert.ok(Math.abs(game.s.time-50)<1e-8); assert.ok(game.s.stats.gathered > 0);
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
      const c=contacts[0];assert.equal(c[0],'plane');assert.deepEqual(c.slice(1,4),[12,-.02,-23]);
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
  assert.equal(renderer.decorSeed, 1409);
  assert.equal(meshes, 1 + world.renderData.geometries.length); assert.equal(fogs, 0); assert.equal(renderer.fogOn, false);
  world.reveal([], [{ x: 0, z: 0, r: 7 }]); view.sync(world); view.sync(world);
  assert.equal(meshes, 1 + world.renderData.geometries.length); assert.equal(fogs, 1); assert.equal(renderer.fogOn, true);
  assert.deepEqual(fogPixels, Array.from(world.fogPixels)); assert.ok(fogPixels.includes(255));
  assert.equal(JSON.stringify(world.renderData), before);
  const next = new Battlefield(43015, 'desert'); next.reveal([]);
  view.sync(next); view.sync(next);
  assert.equal(fogs, 2); assert.equal(renderer.fogOn, true);
  assert.deepEqual(fogPixels, Array.from(next.fogPixels)); assert.ok(fogPixels.every(v => v === 0));
  assert.equal(renderer.decorSeed, 43015, 'new world updates cosmetic seed without sampling world RNG');
  assert.equal(meshes, 2 + world.renderData.geometries.length + next.renderData.geometries.length);
});

test('world view switches ground bounds, boundary descriptors and fog sizes between worlds', () => {
  const context=loadScripts(['core', ...RENDERER_SCRIPTS, 'content', ...BATTLEFIELD_SCRIPTS, 'world', 'world-view']);
  const {Battlefield,BattlefieldView,BATTLEFIELDS,TerrainModels}=vm.runInContext(
    '({Battlefield,BattlefieldView,BATTLEFIELDS,TerrainModels})',context);
  BATTLEFIELDS['alien-planet'].size={extent:135,cellSize:2.5};
  // Isolate size dispatch from the map's independently designed models/layout.
  for(const id of ['alien-planet','mothership']) {
    BATTLEFIELDS[id].generate=BATTLEFIELDS.desert.generate;
    BATTLEFIELDS[id].layout=BATTLEFIELDS.desert.layout;
  }
  const renderer=createRendererStub(), uploads=[], fogs=[], boundaries=[];
  // Test descriptor dispatch here; actual boundary meshes are checked in the terrain suite.
  TerrainModels.desertRelief=relief=>{boundaries.push([relief.extent,relief.innerExtent]); return new Float32Array();};
  renderer.geometry=(mesh,data)=>{
    if (mesh!=='terrain') return;
    let min=Infinity,max=-Infinity;
    for(let i=0;i<data.length;i+=9) {min=Math.min(min,data[i],data[i+2]);max=Math.max(max,data[i],data[i+2]);}
    uploads.push([data.length/27,min,max]);
  };
  renderer.fog=(data,size)=>{assert.equal(data.length,size*size);fogs.push([size,Array.from(data)]);};
  const view=new BattlefieldView(renderer);
  for(const [map,extent,grid] of [['desert',90,72],['alien-planet',135,108],['mothership',120,96]]) {
    const w=new Battlefield(43015,map), count=fogs.length;
    view.sync(w,false);view.sync(w,true);view.sync(w,true);
    assert.equal(renderer.extent,extent);
    assert.deepEqual(uploads.at(-1),[grid*grid*2,-extent,extent]);
    assert.deepEqual(boundaries.at(-1),[extent+150,extent]);
    assert.equal(fogs.length,count+1);assert.equal(fogs.at(-1)[0],grid);
    assert.ok(fogs.at(-1)[1].every(v=>v===0), 'unrevealed world never reuses old fog');
    w.reveal([], [{x:extent-15,z:0,r:7}]);view.sync(w);
    assert.ok(fogs.at(-1)[1].includes(255));
  }
  assert.equal(uploads.length,3);
});

test('world view dispatches declared terrain models and profiles without assuming mountains', () => {
  const context = loadScripts(['core', ...RENDERER_SCRIPTS, ...BATTLEFIELD_SCRIPTS, 'world', 'world-view']);
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
  assert.strictEqual(renderer.battlefieldProfile, world.definition.render);
  assert.strictEqual(renderer.haze, world.definition.render.haze);
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
    const next = render({ ...entity, team, rot, progress }), scale = Math.max(.15,progress);
    assert.equal(base(next)[8], BUILDING_YAW+team*Math.PI);
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
  assert.equal(reference, 'b9f0026');
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

// Execute the real app loop with synthetic rAF timestamps, without WebGL or a browser.
function appClock(diagnostic = false) {
  let now = 0;
  const pending = [], draws = [], ticks = [], steps = [], effectTicks = [], presentations = [], errors = [];
  const renderWork = { begin: 0, battlefield: 0, overlay: 0 };
  const elements = new Map(), window = {}, queryRequests = [];
  const document = { hidden: false, body: { appendChild() {} }, createElement: () => ({ append() {} }) };
  const $ = id => {
    if (!elements.has(id)) elements.set(id, {
      handlers: {}, classList: { add() {}, remove() {} },
      addEventListener(name, fn) { this.handlers[name] = fn; },
      getContext: () => ({ setTransform() {} })
    });
    return elements.get(id);
  };
  loadScripts([...DIAGNOSTIC_SCRIPTS, 'app'], { globals: {
    $, window, document, navigator: { userAgent: 'clock-test' }, URLSearchParams,
    location: { search: diagnostic ? '?diagnostics=1' : '' }, devicePixelRatio: 1,
    performance: { now: () => now }, requestAnimationFrame: fn => pending.push(fn),
    addEventListener() {}, ResizeObserver: class { observe() {} },
    console: { error: e => errors.push(e), warn() {} },
    META: {}, PERMANENT_UPGRADES: {}, ABILITIES: {}, EXPEDITION_BENEFITS: {}, BATTLEFIELDS: {}, MISSIONS: {}, UNITS: {}, BUILDINGS: {}, FACTIONS: {},
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)), expeditionEnemyCount() {}, esc: String,
    createMeridianPersistence: () => ({ loadProfile: () => ({ settings: { quality: 2 } }) }),
    MeridianRenderer: class {
      viewport = { width: 800, height: 600, left: 0, top: 0 };
      gl = { getExtension(name) { queryRequests.push(name); return null; } };
      meshes = {}; static = {}; dynamic = {}; effects = {}; textureResources = {};
      width = 800; height = 600; sceneSamples = 0; bloomTargets = []; bloomWidth = 1; bloomHeight = 1;
      frameReady() { return true; } releaseEnvironment() {}
      resize() {} camera() {} begin() { renderWork.begin++; }
      render(time) { this.diagnostics?.beginFrame(); draws.push({ now, time }); }
    },
    BattlefieldView: class { sync() {} },
    MeridianAudio: class { update() {} },
    MeridianGame: class {
      networkTeam = null;
      world = {};
      s = { time: 0, speed: 1, entities: [], cam: { x: 0, z: 0, zoom: 65 } };
      effects = { fx: [], tick: dt => effectTicks.push(dt) };
      step(dt) { steps.push(dt); this.s.time += dt; }
    },
    MeridianUI: class {
      view = 'game'; paused = false; pointer = {}; pings = [];
      showHome() {} drawMinimap() {} drawOverlay() { renderWork.overlay++; }
      selectionIds() { return new Set(); }
      tick(dt) { ticks.push(dt); }
    },
    MeridianMultiplayerClient: class {
      renderTime = 0;
      updatePresentation(t) { presentations.push(t); this.renderTime = t / 1000; }
      takeSnapshotCount() { return 0; }
      disconnect() {}
    },
    renderBattlefieldEffects() { renderWork.battlefield++; }
  } });
  assert.ok(window.Meridian, 'app initializes');
  assert.deepEqual(errors, []);
  return { ...window.Meridian, draws, renderWork, ticks, steps, effectTicks, presentations, errors, pending, queryRequests, $,
    get performance() { return window.Meridian.performance; },
    frame(t) {
      assert.equal(pending.length, 1, 'exactly one outstanding rAF');
      now = t;
      pending.shift()(now);
    }
  };
}

for (const hz of [30, 59.94, 60, 90, 120, 144]) {
  test(`app renders at most 60 FPS without slowing its clocks at ${hz} Hz`, () => {
    const a = appClock(), count = Math.floor(hz * 10);
    for (let i = 1; i <= count; i++) a.frame(i * 1000 / hz);
    const seconds = count / hz;
    assert.ok(Math.abs(a.draws.length - Math.min(60, hz) * seconds) <= 1);
    assert.ok(Object.values(a.renderWork).every(count => count === a.draws.length),
      'skipped frames omit instance/effect construction and overlay drawing too');
    assert.equal(a.ticks.length, count, 'UI continues on skipped render callbacks');
    assert.equal(a.presentations.length, count, 'network presentation keeps its existing cadence');
    assert.ok(Math.abs(a.ticks.reduce((sum, dt) => sum + dt, 0) - seconds) < 1e-8);
    assert.ok(Math.abs(a.steps.length - seconds * 20) <= 1);
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
  assert.ok(a.steps.length - steps <= 2, 'existing 100 ms elapsed clamp is retained');
  a.frame(20001);
  assert.equal(a.draws.length, before + 1, 'no immediate replay of missed slots');
  assert.deepEqual(a.errors, []);
});

test('frame cap leaves speed, pause and network simulation ownership unchanged', () => {
  for (const mode of ['double', 'paused', 'network', 'menu']) {
    const a = appClock();
    if (mode === 'double') a.game.s.speed = 2;
    if (mode === 'paused') a.ui.paused = true;
    if (mode === 'network') a.game.networkTeam = 0;
    if (mode === 'menu') a.ui.view = 'home';
    for (let i = 1; i <= 120; i++) a.frame(i * 1000 / 120);
    assert.ok(Math.abs(a.draws.length - 60) <= 1);
    if (mode === 'double') assert.ok(Math.abs(a.steps.length - 40) <= 1);
    else assert.equal(a.steps.length, 0);
    assert.equal(a.presentations.length, 120);
    assert.deepEqual(a.errors, []);
  }
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
