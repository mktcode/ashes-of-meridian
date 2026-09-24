const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { modelHarness } = require('../helpers/model-contract.cjs');
const { loadScripts, BATTLEFIELD_SCRIPTS, SIMULATION_SCRIPTS } = require('../helpers/game-scripts.cjs');

const root = join(__dirname, '../..');
test('authored destroyers keep GLB triangles, independent moving parts and uniform preview colors', () => {
  const h = modelHarness({heavyModels:true}), meshes = {};
  vm.runInContext('Math.random = seeded = () => { throw Error("Model RNG"); }', h.context);
  h.EntityModels.upload({ meshes, geometry(name, data) { meshes[name] = data; } });
  for (const [faction, count, animated] of [[0,20528,4],[1,49848,6],[2,31664,16]]) {
    const prefix = `heavy${faction}`;
    const keys = Object.keys(meshes).filter(key => key.startsWith(prefix) && !key.endsWith('Neutral'));
    assert.equal(keys.length, animated + 1 + (faction === 0 ? 1 : 0));
    assert.equal(keys.reduce((sum, key) => sum + meshes[key].length / 27, 0), count);
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

test('source GLBs match the supported embedded data layout and portraits exist', () => {
  const counts = {breakwater:20528,crownwing:49848,catafalque:31664};
  for (const [index,name] of Object.keys(counts).entries()) {
    const file = readFileSync(join(root,'assets/models',`${name}.glb`));
    assert.equal(file.toString('ascii',0,4),'glTF');
    assert.equal(file.readUInt32LE(4),2);
    const bytes = readFileSync(join(root,'assets/portraits',`faction-${index}-unit-destroyer.webp`));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');
    assert.equal(bytes.toString('ascii',8,12),'WEBP');
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

test('multiplayer projects visible destroyers and own pending production without leaking opponent queues', () => {
  const context=loadScripts(['core','content','multiplayer-state']);
  const project=vm.runInContext('multiplayerEntity',context);
  const entity={id:3,kind:'unit',type:'destroyer',team:0,faction:1,x:0,z:0,hp:1500,maxHp:1500,
    size:2.7,rot:0,progress:1,walk:0,shield:0,maxShield:0,carry:0,lastHit:0,shieldFlash:0,
    kills:0,order:{type:'idle'},queue:[]};
  const own=project(entity,0,new Set([3])),opponent=project({...entity,team:1},0,new Set([3]));
  assert.equal(own.type,'destroyer');assert.equal(opponent.type,'destroyer');
  const hangar={...entity,id:4,kind:'building',type:'hangar',queue:[{type:'destroyer',progress:.3,time:70,cost:850,gas:500}]};
  assert.deepEqual(JSON.parse(JSON.stringify(project(hangar,0,new Set([4])).queue)),hangar.queue);
  assert.deepEqual(Array.from(project({...hangar,team:1},0,new Set([4])).queue),[]);
});

test('destroyer is a costly flying hangar unit; its area hit accepts air and applies faction damage', () => {
  const context=loadScripts(['core','content',...BATTLEFIELD_SCRIPTS,'world',...SIMULATION_SCRIPTS]);
  const {MeridianGame,UNITS,FACTIONS,isFlyingUnitType,parseBattleAction}=
    vm.runInContext('({MeridianGame,UNITS,FACTIONS,isFlyingUnitType,parseBattleAction})',context);
  assert.deepEqual([UNITS.destroyer.cost,UNITS.destroyer.gas,UNITS.destroyer.supply,UNITS.destroyer.time], [850,500,16,70]);
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
