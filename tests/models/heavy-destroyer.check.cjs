const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { modelHarness, assertMesh } = require('../helpers/model-contract.cjs');
const { loadScripts, BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS } = require('../helpers/game-scripts.cjs');

test('each destroyer model registers independently from its own file', () => {
  for (const faction of [0,1,2]) {
    const context = loadScripts(['core', 'renderer-materials', 'renderer-geometry', 'renderer-model-kit',
      'renderer-heavy-mesh', `model-faction-${faction}-unit-destroyer`]);
    const model = vm.runInContext(`EntityModels.find({kind:'unit',type:'destroyer',faction:${faction}})`, context);
    assert.equal(typeof model.render, 'function');
  }
});

test('destroyers protect unchanged indexed meshes, independent moving parts and uniform preview colors', () => {
  const h = modelHarness({heavyModels:true}), meshes = {};
  vm.runInContext('Math.random = seeded = () => { throw Error("Model RNG"); }', h.context);
  // Keep full-precision captures outside the bounded JavaScript test heap.
  h.EntityModels.upload({ meshes, geometry(name, data) { meshes[name] = Float64Array.from(data); } });
  for (const [faction, count, animated] of [[0,null,4],[1,49848,6],[2,31664,16]]) {
    const prefix = `heavy${faction}`;
    // Cinder Pact is deliberately reconstructed and has a geometric contract below.
    // Keep the other two full-precision baselines unchanged, including triangle order.
    if (faction !== 0) {
      const meshHashes = Object.keys(meshes).filter(key => key.startsWith(prefix)).sort().map(key =>
        key + ':' + createHash('sha256').update(Buffer.from(new Float64Array(meshes[key]).buffer)).digest('hex'));
      const expected = {
        1: 'cd193f805ffc7520fb58de238e5d0d594f7d9cb7acb9bc456509172fef9bcb40',
        2: '2c4004e6edf5c38ce7e9b7a3e4977aeee7f129da9d9bbe38c6637cc2e5c2dc60'
      };
      assert.equal(createHash('sha256').update(meshHashes.join('\n')).digest('hex'), expected[faction]);
    }
    const keys = Object.keys(meshes).filter(key => key.startsWith(prefix) && !key.endsWith('Neutral'));
    assert.equal(keys.length, animated + 1 + (faction === 0 ? 1 : 0));
    if (count !== null) assert.equal(keys.reduce((sum, key) => sum + meshes[key].length / 27, 0), count);
    assert.ok(keys.every(key => meshes[key].every(Number.isFinite)));
    for (const key of keys.filter(key => !key.endsWith('Team'))) {
      const normal = meshes[key], preview = meshes[key + 'Neutral'];
      assert.equal(preview.length, normal.length);
      for (let i = 0; i < normal.length; i += 9) {
        assert.deepEqual(Array.from(preview.slice(i, i + 6)), Array.from(normal.slice(i, i + 6)));
        assert.deepEqual(Array.from(preview.slice(i + 6, i + 9)), [1,1,1]);
      }
    }
    const entity = {id:7,kind:'unit',type:'destroyer',faction,team:0,hp:1500,size:2.7,x:0,z:0,rot:.5};
    const regular = h.draw(entity,{},2), ghost = h.draw(entity,{ghost:true},2);
    assert.equal(regular.length, animated + 2);
    assert.ok(regular.every(call => !call[0].endsWith('Neutral')));
    assert.ok(ghost.every(call => (call[0].endsWith('Neutral') || call[0].endsWith('Team') || call[0] === 'sphere') && call[7] === 0x68717d));
    assert.ok(h.draw(entity,{tint:0x99e4c6},2).every(call =>
      (call[0].endsWith('Neutral') || call[0].endsWith('Team') || call[0] === 'sphere') && call[7] === 0x99e4c6));
    assert.deepEqual(regular,h.draw(entity,{},2));
    if (faction === 0) {
      const start = h.draw(entity,{},0), turned = h.draw(entity,{},1);
      for (const index of [9,11,13,15]) {
        const name = `heavy0Part${index}`;
        const before = start.find(call => call[0] === name), after = turned.find(call => call[0] === name);
        assert.ok(before && after, `rotor ${index} is rendered`);
        assert.equal(after[8],before[8], 'rotor must not yaw around the vertical axis');
        assert.equal(after[9],0);
        assert.equal(after[10]-before[10],2.5, 'rotor spins around its forward local Z axis');
        assert.equal(after[1],before[1]);assert.equal(after[3],before[3]);
      }
    }
    assert.equal(h.draw({...entity,hp:0}).length,0);
  }
});

test('Breakwater construction is closed, deterministic, RNG-free and bounded with outward flat normals', () => {
  const context=loadScripts(['core','renderer-materials','renderer-geometry','renderer-model-kit',
    'renderer-heavy-mesh','model-faction-0-unit-destroyer']);
  vm.runInContext('Math.random = seeded = () => { throw Error("Model RNG"); }',context);
  const registry=vm.runInContext('EntityModels',context),meshes={};
  registry.upload({meshes,geometry(name,data){meshes[name]=Float64Array.from(data);}});
  for(const [name,data] of Object.entries(meshes).filter(([name])=>!name.endsWith('Neutral'))) {
    const rotor=name.includes('Part'),team=name.endsWith('Team');
    const mesh=assertMesh(()=>Array.from(data),{
      minTriangles:rotor?150:team?100:9000,maxTriangles:rotor?220:team?180:15000,
      min:rotor?[-.77,-.77,-.023]:[-8.45,-1.78,-6.75],
      max:rotor?[.77,.77,.023]:[8.45,4.15,9.183]
    });
    // Each directed edge must be paired by an oppositely wound edge, even for
    // touching independent components. Quantization only welds roundoff at seams.
    const edges=new Map(),key=p=>p.map(v=>Math.round(v*1e6)).join(',');
    for(let i=0;i<mesh.length;i+=27) {
      const points=[0,9,18].map(j=>key(mesh.slice(i+j,i+j+3)));
      for(let j=0;j<3;j++) {
        const a=points[j],b=points[(j+1)%3],edge=a<b?`${a}|${b}`:`${b}|${a}`;
        edges.set(edge,(edges.get(edge)||0)+(a<b?1:-1));
      }
    }
    assert.ok([...edges.values()].every(balance=>balance===0),`${name}: closed oriented surface`);
  }
  const repeated={};registry.upload({meshes:repeated,geometry(name,data){repeated[name]=Float64Array.from(data);}});
  for(const name of Object.keys(meshes)) assert.deepEqual(meshes[name],repeated[name]);
  // Rendering may reuse the baked meshes but must not reconstruct any of them.
  vm.runInContext('geom.box = geom.cylinder = geom.tri = () => { throw Error("Frame geometry"); }',context);
  const model=registry.find({kind:'unit',type:'destroyer',faction:0}),calls=[];
  for(const time of [0,1]) model.render({time,nightPart:(...args)=>calls.push(args),part:(...args)=>calls.push(args),
    nightLight:0,team:0x78ded3,surfaceColor:c=>c,pointLight(){}});
  assert.equal(calls.length,12);
  const pivots=[[-7.15,.32,1.99],[7.15,.32,1.99],[-4.6,.55,-3.71],[4.6,.55,-3.71]];
  for(let i=0;i<4;i++) {
    assert.deepEqual(calls[i+2].slice(1,4),pivots[i].map(v=>v*.72));
    assert.equal(calls[i+8][10]-calls[i+2][10],2.5);
  }
});

test('local flight envelopes keep the complete animated aircraft and destroyer meshes above mountain triangles', () => {
  const h=modelHarness({heavyModels:true}),meshes={},Surface=vm.runInContext('BattlefieldSurface',h.context);
  h.EntityModels.upload({meshes,geometry(name,data){meshes[name]=Float64Array.from(data);}});
  const surface=new Surface(30,2.5,(x,z)=>Math.max(0,40-Math.hypot(x,z)*12)),
    rotate=([x,y,z],ry,rx,rz)=>{
      [x,y]=[x*Math.cos(rz)-y*Math.sin(rz),x*Math.sin(rz)+y*Math.cos(rz)];
      [y,z]=[y*Math.cos(rx)-z*Math.sin(rx),y*Math.sin(rx)+z*Math.cos(rx)];
      return [x*Math.cos(ry)+z*Math.sin(ry),y,-x*Math.sin(ry)+z*Math.cos(ry)];
    };
  for(const faction of [0,1,2])for(const type of ['air','destroyer'])for(const time of [0,1]) {
    const e={id:7,kind:'unit',type,faction,team:0,hp:1500,size:h.UNITS[type].size,x:-6,z:-6,rot:Math.PI/4},
      calls=h.draw(e,{},time),datum=surface.entityHeight(e);
    for(const call of calls) {
      const mesh=meshes[call[0]];if(!mesh)continue;
      for(let i=0;i<mesh.length;i+=9) {
        const p=rotate([mesh[i]*call[4],mesh[i+1]*call[5],mesh[i+2]*call[6]],...call.slice(8,11)),
          x=call[1]+p[0],y=call[2]+p[1]+datum,z=call[3]+p[2];
        assert.ok(y>surface.heightAt(x,z)+.5,`${faction}/${type}: actual transformed vertex clears the mountain`);
      }
    }
  }
});

test('hangar queue charges, reserves supply and refunds heavy aircraft without a unit cap', () => {
  const context=loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world',...SIMULATION_SCRIPTS]);
  const {MeridianGame}=vm.runInContext('({MeridianGame})',context),g=Object.create(MeridianGame.prototype);
  const account={alloy:2000,gas:1200},hangar={id:4,team:0,faction:0,kind:'building',type:'hangar',hp:100,
    progress:1,queue:[],size:4,x:0,z:0};
  g.s={stopped:false,entities:[hangar]};g.factionFor=()=>0;g.account=()=>account;
  g.alive=filter=>g.s.entities.filter(filter);g.cap=()=>32;g.notify=()=>{};
  g.get=id=>id===4?hangar:null;
  assert.equal(g.train('destroyer',0),true);assert.equal(g.train('destroyer',0),true);
  assert.equal(g.supply(0),32);assert.equal(g.train('destroyer',0),false);
  assert.deepEqual([account.alloy,account.gas],[300,200]);
  g.cancelQueue(4,1,0);
  assert.deepEqual([account.alloy,account.gas],[1150,700]);assert.equal(g.supply(0),16);
  g.unitPosition=e=>({x:e.x,z:e.z});g.unitFits=()=>true;
  g.spawn=(_kind,_type,x,z,_team,_faction,options)=>({x,z,...options});
  const produced=g.produceUnit(hangar,'destroyer');
  assert.ok(produced.exit.length>0,'uses the standard hangar exit');
  assert.equal(produced.exit.building,hangar.id);
});

test('AI saves for one supported destroyer instead of blocking its own economy prematurely', () => {
  const context=loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world',...SIMULATION_SCRIPTS]);
  const {MeridianGame}=vm.runInContext('({MeridianGame})',context);
  const game=Object.create(MeridianGame.prototype), trained=[], account={alloy:700,gas:400};
  game.s={depth:8};game.factionFor=()=>0;game.aiFor=()=>({contacts:{}});
  game.has=type=>type==='hangar';game.account=()=>account;
  game.availableProducers=type=>type==='hangar'?[{queue:[]}]:[];
  game.executeAction=(_team,action)=>trained.push(action);
  const own=Array.from({length:10},(_,id)=>({id,kind:'unit',type:'rifle',queue:[]}));
  own.push({kind:'building',type:'hangar',queue:[]});
  game.aiProduction(0,own,[],50);
  assert.deepEqual(trained,[],'saving alloy must not spend on ordinary aircraft');
  account.alloy=900;account.gas=550;
  game.aiProduction(0,own,[],50);
  assert.deepEqual(trained.map(a=>a.unit),['destroyer']);
  trained.length=0;account.alloy=700;account.gas=150;
  game.aiProduction(0,own,[],50);
  assert.deepEqual(trained.map(a=>a.unit),['air'],'without the aether economy the army keeps producing');
});

test('destroyer is a costly flying hangar unit; its area hit accepts air and applies faction damage', () => {
  const context=loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world',...SIMULATION_SCRIPTS]);
  const {MeridianGame,UNITS,FACTIONS,isFlyingUnitType,parseBattleAction}=
    vm.runInContext('({MeridianGame,UNITS,FACTIONS,isFlyingUnitType,parseBattleAction})',context);
  assert.deepEqual([UNITS.destroyer.cost,UNITS.destroyer.gas,UNITS.destroyer.supply,UNITS.destroyer.time], [850,500,16,70]);
  assert.equal(UNITS.destroyer.speed,2.8);
  assert.ok(UNITS.destroyer.speed < UNITS.air.speed / 2);
  assert.equal(UNITS.destroyer.from,'hangar'); assert.equal(isFlyingUnitType('destroyer'),true);
  assert.equal(parseBattleAction({kind:'train',unit:'destroyer'}).unit,'destroyer');
  for(const faction of [0,1,2]) {
    assert.ok(FACTIONS[faction].units.destroyer);
    const g=Object.create(MeridianGame.prototype), hits=[];
    g.s={fields:[],parties:[{benefits:{commandDrill:0}}],time:0};
    g.factionFor=()=>faction;g.account=()=>({alloy:1000,gas:600});
    const price=g.cost('destroyer','unit',0);
    assert.deepEqual({...price},{cost:[850,723,953][faction],gas:500});
    const attacker={id:1,kind:'unit',type:'destroyer',team:0,faction,x:0,z:0,kills:0,cd:0,rot:0};
    const target={id:2,kind:'unit',type:'air',team:1,x:5,z:0,size:1};
    const bystander={id:3,kind:'unit',type:'rifle',team:1,x:6,z:0,size:1};
    g.damage=(...args)=>hits.push(args);g.enemy=(_source,entity)=>entity.team!==0;
    g.near=(_x,_z,_radius,accept)=>[bystander].filter(accept);
    g.visible=()=>false;g.effects={shot(){throw Error('hidden shot')}};
    g.fire(attacker,target);
    assert.equal(hits.length,2);
    assert.equal(hits[0][0],target);assert.equal(hits[1][0],bystander);
    assert.equal(hits[0][1],145*(faction===2?1.12:1));
    assert.equal(hits[1][1],hits[0][1]*.45);
    assert.equal(attacker.cd,2.6);
  }
});
