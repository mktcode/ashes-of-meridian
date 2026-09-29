const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const {loadScripts,BATTLEFIELD_SCRIPTS,SIMULATION_SCRIPTS}=require('./helpers/game-scripts.cjs');
const {createRendererStub}=require('./helpers/renderer-stub.cjs');
const context=loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world','effects',...SIMULATION_SCRIPTS,
  'renderer-geometry','renderer-terrain-models','renderer-upland','renderer-ecology','renderer-world-variation','effects-view','ui-core','ui-templates'],
  {globals:{CONTACT_SHADOW_MATERIAL:-1}});
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
    assert.ok(R.calls.length>0&&R.calls.length<=121);assert.ok(R.calls.every(c=>c[0]==='beam'||c[2]>=4));
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
