const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const {loadScripts,BATTLEFIELD_SCRIPTS,SIMULATION_SCRIPTS}=require('./helpers/game-scripts.cjs');
const {createRendererStub}=require('./helpers/renderer-stub.cjs');
const context=loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world','effects',...SIMULATION_SCRIPTS,
  'renderer-geometry','renderer-terrain-models','renderer-upland','renderer-ecology','renderer-world-variation','effects-view','ui-core','ui-templates'],
  {globals:{CONTACT_SHADOW_MATERIAL:-1,SNOWFLAKE_MATERIAL:-6}});
const api=vm.runInContext(`({Battlefield,BATTLEFIELDS,battlefieldEcology,ecologyHabitat,ecologyFootprint,TerrainModels,
  MeridianGame,MeridianEffects,expeditionOpening,renderMissionBriefing,renderEcologyWeather,renderBattleScars,battleScarViews,
  renderWeaponSignature,UNIT_BODY_SCALE})`,context);
const json=v=>JSON.parse(JSON.stringify(v));
function topology(w){const h=createHash('sha256').update(JSON.stringify(w.layout)).update(w.staticGrid);
  if(w.surface)h.update(new Uint8Array(w.surface.heights.buffer));return h.digest('hex');}
function bare(run){const decorate=vm.runInContext('decorateEcology',context);try{
  vm.runInContext('decorateEcology=()=>{}',context);return run();
}finally{context.restore=decorate;vm.runInContext('decorateEcology=restore',context);delete context.restore;}}

test('ecology resolves four repeatable biomes and weather without mutating profiles or shifting terrain',()=>{
  vm.runInContext('Math.random=()=>{throw Error("Unseeded ecology");}',context);
  const before=JSON.stringify(api.BATTLEFIELDS),styles=new Set(),weather=new Set();
  for(let seed=1;seed<=96;seed++){
    const a=api.battlefieldEcology(api.BATTLEFIELDS.frontier.render,seed),b=api.battlefieldEcology(api.BATTLEFIELDS.frontier.render,seed);
    assert.deepEqual(json(a),json(b));styles.add(a.ecology.biome);weather.add(a.ecology.weather);
    const fixed=api.battlefieldEcology({...api.BATTLEFIELDS.frontier.render,wilderness:'rime'},seed);
    assert.equal(fixed.ecology.phase,a.ecology.phase,'fixed biome does not shift habitat or wind draws');
    assert.equal(fixed.ecology.wind,a.ecology.wind);
    for(const x of [-140,-20,0,73,140])for(const z of [-140,17,140]){
      const h=api.ecologyHabitat(a.ecology.phase,x,z);assert.ok(h>=0&&h<=1);
      assert.ok(Math.abs(h-api.ecologyHabitat(a.ecology.phase,x+.01,z))<.002,'continuous regions');
    }
  }
  assert.equal(styles.size,4);assert.equal(weather.size,5);
  for(const id of ['haven','westmark','mothership','aurelion'])assert.strictEqual(api.battlefieldEcology(api.BATTLEFIELDS[id].render,7),api.BATTLEFIELDS[id].render);
  assert.equal(JSON.stringify(api.BATTLEFIELDS),before);
  for(const [map,seed] of [['frontier',11],['desert',1409],['alien-planet',1409]]){
    const decorated=new api.Battlefield(seed,map),undecorated=bare(()=>new api.Battlefield(seed,map));
    assert.equal(topology(decorated),topology(undecorated));assert.deepEqual(json(decorated.startSites),json(undecorated.startSites));
    assert.notDeepEqual(Array.from(decorated.terrainColors),Array.from(undecorated.terrainColors));
  }
});

test('habitat models are finite, deterministic, bounded opaque meshes with unit normals',()=>{
  for(const part of ['Trunk','Grove','Acacia','Conifer','Fungus','Tuft','Relic','Spire'])for(let v=0;v<3;v++){
    const seed=193+v*7919,mesh=api.TerrainModels['ecology'+part](seed,0);
    assert.deepEqual(mesh,api.TerrainModels['ecology'+part](seed,0));
    assert.ok(mesh.length>0&&mesh.length%27===0&&mesh.length/27<=1400,part);
    assert.ok(mesh.every(Number.isFinite));
    for(let i=0;i<mesh.length;i+=9){
      assert.ok(Math.hypot(mesh[i],mesh[i+2])<=1.00001,part+' footprint');
      assert.ok(Math.abs(Math.hypot(mesh[i+3],mesh[i+4],mesh[i+5])-1)<1e-5,part+' normals');
      assert.ok(mesh[i+1]>=-.06&&mesh[i+1]<=1.2,part+' height, including buried rubble and inclined footings');
    }
  }
});

test('ecology clusters protect complete blocker envelopes, routes, resources and fixed placement budgets',()=>{
  let landmarks=0;
  for(const seed of [11,1,7,4]){
    const w=new api.Battlefield(seed,'frontier'),counts={Trunk:0,Tuft:0,Stone:0,Relic:0,Spire:0},meshes=new Map();
    for(const p of w.renderData.placements.filter(p=>p.mesh.startsWith('ecology'))){
      const part=p.mesh.match(/^ecology([A-Za-z]+)/)[1];counts[part]=(counts[part]||0)+1;
      const [x,y,z]=p.position,[sx,sy,sz]=p.scale;
      assert.equal(p.layer,'static');assert.equal(p.alpha,1);
      if(part!=='Tuft'){
        assert.ok(api.ecologyFootprint(w,x,z,sx+.4),p.mesh+' complete footprint and wind envelope');
        for(const start of w.layout.startSites)assert.ok(Math.hypot(start.x-x,start.z-z)>sx+13);
        for(const [i,site] of w.layout.resourceSites.entries()){
          assert.ok(Math.hypot(site.x-x,site.z-z)>sx+8);
          assert.ok(Math.hypot(site.x+(i?7:5)-x,site.z+(i?7:18)-z)>sx+6);
        }
      }else{
        if(!meshes.has(p.mesh))meshes.set(p.mesh,api.TerrainModels.geometry(w.renderData.geometries.find(g=>g.mesh===p.mesh)));
        const mesh=meshes.get(p.mesh),c=Math.cos(p.rotation[0]),s=Math.sin(p.rotation[0]);
        for(let i=0;i<mesh.length;i+=9){
          const px=x+mesh[i]*sx*c+mesh[i+2]*sz*s,pz=z-mesh[i]*sx*s+mesh[i+2]*sz*c;
          assert.ok(y+mesh[i+1]*sy-w.surface.heightAt(px,pz)<.55,'low, traversable groundcover');
        }
      }
    }
    const crowns=(counts.Grove||0)+(counts.Acacia||0)+(counts.Conifer||0)+(counts.Fungus||0)+(counts.Coral||0);
    assert.ok(crowns>0&&crowns<=144);assert.equal(counts.Trunk,counts.Fungus||counts.Coral?0:crowns);
    assert.ok(counts.Tuft>0&&counts.Tuft<=650);
    assert.ok(counts.Stone<=84);assert.ok(counts.Relic+counts.Spire<=6);landmarks+=counts.Relic+counts.Spire;
    assert.equal(w.renderData.geometries.filter(g=>g.detail).length,3);
    assert.ok(w.renderData.geometries.filter(g=>g.detail).every(g=>g.model==='ecologyTuft'));
    assert.ok(w.renderData.placements.length<=1030);
  }
  assert.ok(landmarks>0,'representative worlds actually contain landmarks');
});

test('Frontier landing choices are public, symmetric, reproducible and excluded from scenarios and other maps',()=>{
  const choices=new Map();for(let seed=1;seed<64;seed++){const o=api.expeditionOpening('frontier',seed);choices.set(o.name,seed);}
  assert.equal(choices.size,4);
  for(const map of ['haven','desert','alien-planet','mothership','westmark','aurelion'])assert.equal(api.expeditionOpening(map,7),null);
  // Initialization contracts only: no AI/simulation long run.
  for(const [name,seed] of choices){
    const make=()=>{const g=new api.MeridianGame({upgrades:{}},()=>{});g.start({map:'frontier',seed,faction:0,enemies:[1,2,0]});return g;};
    const game=bare(make),again=bare(make),s=game.s;
    assert.equal(s.opening.name,name);assert.deepEqual(json(s),json(again.s));assert.equal(game.random(),again.random());
    assert.equal(s.rules.mission.id,'hq-elimination');assert.equal(s.stats.trained,0);
    for(const p of s.parties){
      const units=s.entities.filter(e=>e.kind==='unit'&&e.team===p.id);
      assert.deepEqual(Array.from(units,e=>e.type).sort(),Array.from(s.opening.units).sort());
      assert.equal(p.account.alloy,250);assert.equal(p.account.gas,0);
      for(const u of units){assert.equal(u.faction,p.faction);assert.ok(game.unitFits(u,u.x,u.z));}
    }
    assert.ok(api.renderMissionBriefing('hq-elimination',{map:'frontier',seed,mission:'hq-elimination'}).includes(name));
    const scenario=new api.MeridianGame({upgrades:{}},()=>{});
    bare(()=>scenario.startScenario({map:'frontier',seed,duration:1,hostilities:[[false,true],[true,false]],parties:[{faction:0,controller:'human'},{faction:1,controller:'human'}]}));
    assert.equal(scenario.s.opening,undefined);assert.equal(scenario.s.entities.filter(e=>e.kind==='unit').length,0);
    assert.deepEqual(json(s.entities.filter(e=>e.kind==='resource')),json(scenario.s.entities.filter(e=>e.kind==='resource')),'landing additions follow protected resource initialization');
  }
});

test('weather and battle scars are bounded, view-owned and clear with quality, time, fog and world changes',()=>{
  const R=createRendererStub({record:true});R.quality=2;R.cinema=false;R.beam=(...args)=>R.calls.push(['beam',...args]);
  const world={terrainSeed:7,extent:140,visible:[1],idx:()=>0,surface:{heightAt:()=>4},renderProfile:{ecology:{weather:'snow',dry:[.4,.5,.6]}}};
  const state={time:1,cam:{x:0,z:0}},before=JSON.stringify([world,state]);
  for(const weather of ['rain','snow','ash','mist']){
    world.renderProfile.ecology.weather=weather;R.calls.length=0;api.renderEcologyWeather(R,world,state);
    assert.ok(R.calls.length>0&&R.calls.length<=(weather==='rain'||weather==='snow'?605:121));
    assert.ok(R.calls.every(c=>c[0]==='beam'||c[2]>=4));
    const draws=JSON.stringify(R.calls);R.calls.length=0;api.renderEcologyWeather(R,world,state);assert.equal(JSON.stringify(R.calls),draws);
    world.visible[0]=0;R.calls.length=0;api.renderEcologyWeather(R,world,state);assert.equal(R.calls.length,0);world.visible[0]=1;
  }
  world.renderProfile.ecology.weather='snow';assert.equal(JSON.stringify([world,state]),before);
  const effects={fx:Array.from({length:100},(_,i)=>({type:'blast',x:i,z:0,size:3}))};
  const effectBefore=JSON.stringify(effects);R.calls.length=0;api.renderBattleScars(R,effects,world,0,0);
  assert.equal(api.battleScarViews.get(R).scars.length,32);assert.equal(R.calls.length,72);
  R.calls.length=0;api.renderBattleScars(R,effects,world,1,0);assert.equal(api.battleScarViews.get(R).scars.length,32);
  world.visible[0]=0;R.calls.length=0;api.renderBattleScars(R,effects,world,2,0);assert.equal(R.calls.length,0);world.visible[0]=1;
  R.calls.length=0;api.renderBattleScars(R,effects,world,39,0);assert.equal(R.calls.length,0);
  assert.equal(api.battleScarViews.get(R).scars.length,0,'seen blasts cannot continually renew scars');
  R.quality=0;api.renderBattleScars(R,effects,world,40,0);assert.equal(api.battleScarViews.has(R),false);
  R.calls.length=0;api.renderEcologyWeather(R,world,state);assert.equal(R.calls.length,0);
  R.quality=2;api.renderBattleScars(R,{fx:[]},{...world},1,1);assert.equal(api.battleScarViews.get(R).scars.length,0);
  assert.equal(JSON.stringify(effects),effectBefore);
});

test('rain displacement follows its streak on flat and sloped ground, with no clock or RNG mutation',()=>{
  vm.runInContext('Math.random=()=>{throw Error("Weather RNG");}',context);
  for(const slope of [0,.3]) {
    const R=createRendererStub({record:true});R.quality=2;R.beam=(...a)=>R.calls.push(['beam',...a]);
    const world={terrainSeed:7,extent:512,visible:[1],idx:()=>0,surface:{heightAt:(x,z)=>4+slope*x},
      renderProfile:{ecology:{weather:'rain',phase:.2}}},state={time:1.234,cam:{x:0,z:0}},before=JSON.stringify([world,state]),
      capture=time=>{R.calls.length=0;api.renderEcologyWeather(R,world,{...state,time});return json(R.calls);},
      a=capture(state.time),b=capture(state.time+.00001);
    assert.ok(a.length>121&&a.length<=605,'denser but bounded rain');assert.equal(a.length,b.length);
    let compared=0;
    for(let i=0;i<a.length;i++) {
      const head=a[i][1],tail=a[i][2],next=b[i][1],move=next.map((v,j)=>v-head[j]),axis=head.map((v,j)=>v-tail[j]);
      if(move[1]>=0)continue; // reset to the cloud is faded, not a falling segment
      compared++;
      const dot=move.reduce((sum,v,j)=>sum+v*axis[j],0)/(Math.hypot(...move)*Math.hypot(...axis));
      assert.ok(dot>1-1e-8,'rain moves along the visible line, including on slopes');
      assert.ok(Math.abs(move[0])>0&&Math.abs(move[2])>0);
      assert.ok(head[1]>=world.surface.heightAt(head[0],head[2]));
      assert.ok(a[i][3]>.017&&a[i][6]>0&&a[i][6]<=1,'readable width and valid opacity');
    }
    assert.ok(compared>100);assert.equal(JSON.stringify([world,state]),before);
    assert.deepEqual(capture(state.time),a,'pause and arbitrary replay retain exactly the same rain');
    R.quality=1;assert.ok(capture(state.time).length<=147);
    world.idx=(x,z)=>x>0?0:1;world.visible=[1,0];
    for(const c of capture(state.time))assert.ok(c[1][0]>0&&c[2][0]>0,'test actual wind-displaced endpoints against fog');
    R.cinema=true;assert.equal(capture(state.time).length,0);
  }
});

test('snowflakes have soft-quad geometry, varied sizes and drifting speeds with bounded visibility',()=>{
  const R=createRendererStub({record:true});R.quality=2;R.eye=[0,110,82];
  const world={terrainSeed:11,extent:512,visible:[1],idx:()=>0,surface:{heightAt:()=>4},
    renderProfile:{ecology:{weather:'snow',phase:.2}}},state={time:2,cam:{x:0,z:0}},
    capture=time=>{R.calls.length=0;api.renderEcologyWeather(R,world,{...state,time});return json(R.calls);},
    a=capture(2),b=capture(2.01);
  assert.ok(a.length>121&&a.length<=605);assert.equal(b.length,a.length);
  assert.ok(a.every(c=>c[0]==='plane'&&c[14]===-6&&c[13]==='effects'));
  assert.ok(new Set(a.map(c=>c[4].toFixed(2))).size>10,'varied flake sizes, not identical dots');
  const velocities=[];
  for(let i=0;i<a.length;i++) {
    const c=a[i],next=b[i];assert.ok(c[2]>=4&&c[12]>0&&c[12]<=1);
    assert.ok(Math.abs(c[9]-Math.atan2(82,110))<1e-10,'flake faces the actual camera');
    if(next[2]<c[2])velocities.push([next[1]-c[1],next[2]-c[2],next[3]-c[3]]);
  }
  assert.ok(new Set(velocities.map(v=>v[1].toFixed(4))).size>10,'different fall speeds');
  assert.ok(new Set(velocities.map(v=>v[0].toFixed(3))).size>3,'individual lateral flutter');
  assert.deepEqual(capture(2),a,'snow is stateless and pauses with presentation time');
  R.quality=1;assert.ok(capture(2).length<=147);
  R.vp=vm.runInContext('M4.identity()',context);R.viewport={width:800,height:600};
  assert.equal(capture(2).length,0,'offscreen flakes are culled');
  R.vp=null;world.visible[0]=0;assert.equal(capture(2).length,0);
  world.visible[0]=1;R.quality=0;assert.equal(capture(2).length,0);
});

test('weapon identities add distinct bounded view signatures without sampling RNG or changing beams',()=>{
  const R=createRendererStub({record:true});R.beam=(...args)=>R.calls.push(['beam',...args]);
  const effects=new api.MeridianEffects(()=>{throw Error('Weapon view consumed RNG');}),shapes=[];
  for(const faction of [0,1,2]){
    effects.reset();effects.shot({kind:'unit',type:'rifle',team:0,faction,x:0,z:0,size:1,rot:0},{kind:'unit',type:'tank',team:1,faction:0,x:20,z:0,size:1.3,rot:0});
    const f=effects.fx[0],before=JSON.stringify(f);assert.equal(effects.weaponFactions.get(f),faction);
    R.calls.length=0;api.renderWeaponSignature(R,f,faction);assert.ok(R.calls.length>=1&&R.calls.length<=4);
    shapes.push(R.calls.map(c=>c[0]));assert.equal(JSON.stringify(f),before);
  }
  assert.equal(new Set(shapes.map(JSON.stringify)).size,3);
});
