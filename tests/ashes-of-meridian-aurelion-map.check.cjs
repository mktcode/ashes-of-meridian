// Bounded terrain and deployment checks, not an autonomous AI match.
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {loadScripts,BATTLEFIELD_SCRIPTS,SIMULATION_SCRIPTS,RENDERER_SCRIPTS}=require('./helpers/game-scripts.cjs');
const context=loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world','effects',...SIMULATION_SCRIPTS]);
const {Battlefield,MeridianGame,battlefieldStartSites,UNITS,UNIT_BODY_SCALE,AURELION_WALKWAYS,aurelionFloor,aurelionWalkable}=vm.runInContext(
  '({Battlefield,MeridianGame,battlefieldStartSites,UNITS,UNIT_BODY_SCALE,AURELION_WALKWAYS,aurelionFloor,aurelionWalkable})',context);

test('Aurelion has four buildable precincts with vehicle routes to the crown and every resource district',()=>{
  const w=new Battlefield(1409,'aurelion',4),starts=battlefieldStartSites(w),radius=UNITS.tank.size*UNIT_BODY_SCALE;
  assert.equal(starts.length,4);assert.equal(w.layout.resourceSites.length,8);
  for(const a of starts) {
    assert.equal(w.surface.heightAt(a.x,a.z),Math.fround(8*w.renderProfile.variation.heightScale));assert.ok(w.surface.foundation(a,7));
    assert.equal(w.surface.visibilityLevelAt(a.x,a.z),1);
    const crown={x:Math.sign(a.x)*22,z:Math.sign(a.z)*19}, inner={x:Math.sign(a.x)*19,z:Math.sign(a.z)*3};
    assert.ok(Math.hypot(inner.x,inner.z)<w.layout.salvageSite.radius);
    for(const b of [crown,inner,...starts,...w.layout.resourceSites]) {
      const path=w.path(a.x,a.z,b.x,b.z,false,undefined,radius);
      assert.equal(path.status,'complete',JSON.stringify({a,b}));
      let previous=a;
      for(const p of path.points){assert.ok(w.lineFree(previous,p,radius));previous=p;}
    }
  }
  assert.equal(w.surface.visibilityLevelAt(22,19),0);
});

test('city voids, roofs, plinth and rails stay impassable even with an empty temporary navigation grid',()=>{
  const w=new Battlefield(1409,'aurelion');w.blocked.fill(0);
  for(const p of [{x:0,z:0},{x:0,z:70},{x:89,z:130},{x:149,z:88},{x:133,z:126},{x:157,z:90}]) {
    assert.equal(w.surface.fits(p.x,p.z),false,JSON.stringify(p));
    assert.equal(w.surface.foundation(p,2),false);
  }
  assert.equal(w.lineFree({x:-30,z:0},{x:30,z:0}),false,'no path through the globe plinth');
  assert.equal(w.lineFree({x:80,z:80},{x:80,z:-80}),false,'no shortcut through the chasm');
  for(const p of [{x:112,z:0},{x:0,z:103},{x:43,z:36},{x:22,z:19}]) {
    assert.ok(w.surface.fits(p.x,p.z),JSON.stringify(p));
    assert.equal(w.surface.foundation(p,1.7),false,'no foundations on approaches or crown');
    const hit=w.surface.ray([p.x,60,p.z],[p.x,-50,p.z]);
    assert.ok(hit&&Math.hypot(hit.x-p.x,hit.z-p.z)<1e-6);
  }
  for(const road of AURELION_WALKWAYS)for(const t of [.2,.5,.8]) {
    const x=road[0]+(road[2]-road[0])*t,z=road[1]+(road[3]-road[1])*t;
    assert.ok(Math.abs(w.surface.heightAt(x,z)-aurelionFloor(x,z)*w.renderProfile.variation.heightScale)<.16,'sampled surface follows the visible ramp');
  }
});

test('four parties initialize reproducibly with harvest routes, buildable vents and room for production',()=>{
  const g=new MeridianGame({upgrades:{}}),options={mission:'echo-salvage',map:'aurelion',seed:1409,enemies:[0,1,2],benefits:{pioneerSquad:2},
    enemyBenefits:[{pioneerSquad:2},{pioneerSquad:2},{pioneerSquad:2}]};
  g.start(options);const w=g.world,entities=g.s.entities;
  const snapshot=JSON.stringify(entities);
  const crystals=entities.filter(e=>e.type==='crystal'),vents=entities.filter(e=>e.type==='gas');
  assert.equal(crystals.length,40);assert.equal(vents.length,8);
  for(const e of crystals){assert.ok(w.surface.fits(e.x,e.z));assert.ok(e.amount>=1800&&e.amount<2700);}
  for(const vent of vents) assert.ok(w.surface.foundation(vent,3),JSON.stringify(vent));
  for(const hq of entities.filter(e=>e.type==='hq')) {
    const workers=entities.filter(e=>e.team===hq.team&&e.type==='worker');assert.equal(workers.length,2);
    const crystal=crystals.reduce((a,b)=>Math.hypot(a.x-hq.x,a.z-hq.z)<Math.hypot(b.x-hq.x,b.z-hq.z)?a:b);
    for(const worker of workers) {
      assert.ok(g.unitFits(worker,worker.x,worker.z));
      const path=w.path(worker.x,worker.z,crystal.x,crystal.z,false,{...crystal,radius:4},worker.size*UNIT_BODY_SCALE);
      assert.equal(path.status,'complete');
      const end=path.points.at(-1)||worker;
      assert.ok(w.terrainFree(end,crystal));
      assert.equal(w.path(end.x,end.z,hq.x,hq.z,false,{...hq,radius:7},worker.size*UNIT_BODY_SCALE).status,'complete');
    }
    let plots=0;
    for(let x=hq.x-30;x<=hq.x+30;x+=8)for(let z=hq.z-25;z<=hq.z+25;z+=8)
      if(Math.hypot(x-hq.x,z-hq.z)>12&&w.surface.foundation({x,z},5))plots++;
    assert.ok(plots>=8,'space for an economy and production, not merely a fitting HQ');
  }
  g.start(options);assert.equal(JSON.stringify(g.s.entities),snapshot);
});

test('Aurelion environment routes city and model batches through shared binding with separate lighting',()=>{
  const c=loadScripts(['core',...RENDERER_SCRIPTS]);
  // Real batch routing; program/texture allocation is checked separately.
  vm.runInContext(`AurelionAtmosphere=class {
    program='city';skyProg='sky';postProg='post';beginFrame() {}
  }`,c);
  const {create,lighting}=vm.runInContext('({create:createAurelionEnvironment,lighting:AURELION_ENTITY_LIGHTING})',c);
  const profile={scenery:'aurelion',lighting:{sun:[.42,.52,.72],sky:[.085,.12,.19],bounce:[.016,.025,.045]}},before=JSON.stringify(profile);
  const draws=[],bindings=[],r={program:'combat',battlefieldProfile:profile,add(){},beam(){},
    bindSceneProgram(time,modelTime,program,light){
      assert.equal(time,12);assert.equal(modelTime,4);this.boundProgram=program;bindings.push([program,light]);
    },
    drawBatches(map,matrix,excluded,included){draws.push({program:this.boundProgram,sources:Object.values(map).map(b=>b.source),matrix,excluded,included});}
  };
  const environment=create(r),matrix=new Float32Array(16),map={unit:{source:'tank',n:1},traffic:{source:'aurelionAir0',n:1},
    relic:{source:'echoRelicCrystal',n:1},effect:{source:'ring',n:1}};
  for (const quality of [0,1,2]) {
    r.quality=quality;draws.length=0;bindings.length=0;environment.beginFrame(4);
    environment.drawSceneBatches(12,4,map,matrix,['skip']);
    assert.deepEqual(draws.map(d=>[d.program,Array.from(d.sources)]),[['city',['aurelionAir0']],['combat',['tank','echoRelicCrystal','ring']]]);
    assert.ok(draws.every(d=>d.matrix===matrix&&d.excluded[0]==='skip'));
    assert.deepEqual(bindings,[['city',undefined],['combat',lighting]],'city keeps profile lighting; models get plaza fill');
  }
  assert.equal(JSON.stringify(profile),before);
  assert.equal(r.program,'combat','environment never replaces the common renderer program');
});

test('all three precinct approaches connect without turning roofs or chasms into shortcuts',()=>{
  const w=new Battlefield(1409,'aurelion'),radius=UNITS.tank.size*UNIT_BODY_SCALE;
  for(const sx of [-1,1])for(const sz of [-1,1])for(const [a,b] of [
    [{x:112,z:48},{x:112,z:0}], [{x:55,z:103},{x:0,z:103}], [{x:67,z:60},{x:43,z:36}]
  ]) {
    const from={x:sx*a.x,z:sz*a.z},to={x:sx*b.x,z:sz*b.z};
    assert.ok(w.lineFree(from,to,radius),JSON.stringify({from,to}));
    assert.ok(w.lineFree(to,from,radius));
  }
});

test('navigable cells match actual city triangles, including ramp heights and retained roof collisions',()=>{
  const w=new Battlefield(1409,'aurelion'),render=loadScripts(['core',...RENDERER_SCRIPTS]),
    meshes=vm.runInContext(`createAurelionBattlefieldMeshes(${w.renderData.heightScale})`,render),data=meshes.find(m=>m.name==='aurelionStructure').data,
    floors=new Float32Array(w.staticGrid.length).fill(-Infinity),tops=new Float32Array(w.staticGrid.length).fill(-Infinity);
  // Rasterize upward physical triangles at every navigation-cell center. Lights are not solids.
  for(let i=0;i<data.length;i+=27) {
    if(data[i+4]<.2||Math.max(data[i+1],data[i+10],data[i+19])<-.2)continue;
    const ax=data[i],az=data[i+2],bx=data[i+9],bz=data[i+11],cx=data[i+18],cz=data[i+20],
      determinant=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
    if(Math.abs(determinant)<1e-9)continue;
    const cell=v=>Math.floor((v+w.extent)/w.cellSize),
      left=Math.max(0,cell(Math.min(ax,bx,cx))),right=Math.min(w.gridSize-1,cell(Math.max(ax,bx,cx))),
      top=Math.max(0,cell(Math.min(az,bz,cz))),bottom=Math.min(w.gridSize-1,cell(Math.max(az,bz,cz)));
    for(let row=top;row<=bottom;row++)for(let col=left;col<=right;col++) {
      const index=row*w.gridSize+col;if(w.staticGrid[index])continue;
      const p=w.point(index),a=((bz-cz)*(p.x-cx)+(cx-bx)*(p.z-cz))/determinant,
        b=((cz-az)*(p.x-cx)+(ax-cx)*(p.z-cz))/determinant,c=1-a-b;
      if(Math.min(a,b,c)<-1e-6)continue;
      const h=a*data[i+1]+b*data[i+10]+c*data[i+19],expected=w.surface.heightAt(p.x,p.z);
      tops[index]=Math.max(tops[index],h);
      if(Math.abs(h-expected)<.3)floors[index]=h;
    }
  }
  for(let i=0;i<w.staticGrid.length;i++)if(!w.staticGrid[i]) {
    const p=w.point(i),height=w.surface.heightAt(p.x,p.z);
    assert.ok(aurelionWalkable(p.x,p.z));assert.ok(aurelionFloor(p.x,p.z)>=0);
    assert.ok(Number.isFinite(floors[i]),`no physical floor at ${JSON.stringify(p)}, height ${height}`);
    assert.ok(tops[i]<height+.8,`solid obstacle on navigable floor at ${JSON.stringify(p)}: ${tops[i]} > ${height}`);
  }
});
