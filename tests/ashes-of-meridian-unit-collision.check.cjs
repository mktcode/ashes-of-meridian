// Bounded body-index fixtures: no generated terrain, AI or autonomous battles.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadScripts, SIMULATION_SCRIPTS } = require('./helpers/game-scripts.cjs');
const context = loadScripts(['core', 'content', 'world', 'effects', ...SIMULATION_SCRIPTS]);
const { Game, Index, UNITS, scale, seeded } = vm.runInContext(
  '({Game:MeridianGame,Index:LiveUnitCollisionIndex,UNITS,scale:UNIT_BODY_SCALE,seeded})', context);
function fixture() {
  const game = new Game({ upgrades: {} });
  game.s = { entities: [], nextId: 1, time: 0, fields: [], recalls: [] };
  game.world = { extent: 160, cellSize: 2.5, pathVersion: 0, blocked: new Uint8Array(1), staticGrid: new Uint8Array(1),
    surface: null, blockedAt: () => false, terrainFree: () => true, lineFree: () => true,
    mark() {}, idx: () => 0,
    path(x,z,tx,tz) { const goal={x:tx,z:tz};return {points:[goal],goal,status:'complete'}; } };
  return game;
}
// This is the old live scan, not an alternative shipping implementation.
function scan(game, e, x, z) {
  const flying = !!UNITS[e.type].flying;
  if (Math.abs(x) > game.world.extent - 5 || Math.abs(z) > game.world.extent - 5) return false;
  return !game.s.entities.some(other => other !== e && other.hp > 0 && other.kind === 'unit' &&
    !!UNITS[other.type].flying === flying &&
    ((other.x-x)**2+(other.z-z)**2 < ((e.size+other.size)*scale)**2-1e-9 ||
      (other.exit && (other.exit.x-x)**2+(other.exit.z-z)**2 < ((e.size+other.size)*scale)**2-1e-9)));
}
function tick(game, callback) { game.stepTick = callback; game.step(.05); }
const value = object => JSON.parse(JSON.stringify(object));

test('live body index agrees with the scan for mixed radii, air, dead bodies, edges and reservations', () => {
  const game=fixture(), random=seeded(427), types=Object.keys(UNITS);
  for(let i=0;i<180;i++) {
    const e=game.spawn('unit',types[i%types.length],random()*320-160,random()*320-160,i%2,0);
    if(i%3===0)e.exit={x:random()*300-150,z:random()*300-150,building:999,length:10};
    if(i%7===0)e.hp=0;
  }
  game.spawn('building','hq',0,0,0,0);
  tick(game,()=>{
    for(let i=0;i<2500;i++) {
      const e=game.s.entities[i%180],x=random()*324-162,z=random()*324-162;
      assert.equal(game.unitFits(e,x,z),scan(game,e,x,z),`query ${i}`);
    }
    for(const other of game.s.entities.slice(0,180)) for(const offset of [-1e-6,0,1e-6]) {
      const e={type:other.type,size:other.size},x=other.x+2*other.size*scale+offset,z=other.z;
      assert.equal(game.unitFits(e,x,z),scan(game,e,x,z),'tangent tolerance');
    }
  });
  assert.equal(game.unitCollisionIndex.entities,null,'tick cleanup releases its source');
});

test('body broadphase excludes distant units and the other flight layer',()=>{
  const game=fixture();
  for(let i=0;i<300;i++)game.spawn('unit',i%2?'air':'rifle',(i%20-10)*12,(Math.floor(i/20)-7)*12,0,0);
  const index=new Index(game.world.extent);index.begin(game.s.entities);
  let candidates=0;index.some({type:'rifle',size:.65},0,0,()=>{candidates++;return false;});
  assert.ok(candidates<15,`local candidates: ${candidates}, total: 300`);
  index.clear();assert.equal(index.units.length,0,'no retained bodies between ticks');
  assert.ok(index.heads.every(head=>head===-1));
});

test('movement and yield update live membership before a later body query in the same tick',()=>{
  const game=fixture(),e=game.spawn('unit','rifle',-10,0,0,0),probe={type:'rifle',size:.65};
  e.yieldTo={x:12,z:0};e.yieldUntil=10;
  tick(game,()=>{
    assert.equal(game.unitFits(probe,e.x,e.z),false);
    game.moveYield(e,10);
    assert.equal(e.x,12);
    assert.equal(game.unitFits(probe,-10,0),true);
    assert.equal(game.unitFits(probe,12,0),false);
    game.setOrder(e,{type:'move',x:40,z:0});game.move(e,{x:40,z:0},10);
    assert.equal(e.x,40);
    assert.equal(game.unitFits(probe,12,0),true);
    assert.equal(game.unitFits(probe,40,0),false);
  });
});

test('spawn, body death and exit reservation removal remain visible within the active tick',()=>{
  const game=fixture(),probe={type:'rifle',size:.65};
  tick(game,()=>{
    assert.equal(game.unitFits(probe,20,0),true);
    const e=game.spawn('unit','rifle',20,0,0,0,{exit:{x:40,z:0,building:999,length:20}});
    assert.equal(game.unitFits(probe,20,0),false);
    assert.equal(game.unitFits(probe,40,0),false);
    delete e.exit;game.updateUnitCollision(e);
    assert.equal(game.unitFits(probe,40,0),true);
    e.hp=0;assert.equal(game.unitFits(probe,20,0),true);
  });
});

test('recall updates membership for both successful placement and rolled-back placement',()=>{
  for(const success of [true,false]) {
    const game=fixture(),e=game.spawn('unit','rifle',-40,0,0,0),hq=game.spawn('building','hq',40,0,0,0),
      probe={type:'rifle',size:.65};
    game.s.recalls=[{hq:hq.id,ids:[e.id],team:0,at:0}];game.factionFor=()=>0;game.effects.drop=()=>{};
    game.unitPosition=()=>success?{x:50,z:0}:null;
    tick(game,()=>{
      assert.equal(game.unitFits(probe,-40,0),false);
      game.resolveRecalls();
      for(const x of [-40,40,50]) assert.equal(game.unitFits(probe,x,0),scan(game,probe,x,0));
      assert.equal(e.x,success?50:-40);
    });
  }
});

test('runtime production and exit release agree with live scans throughout the tick',()=>{
  const game=fixture(),hq=game.spawn('building','hq',0,0,0,0);
  Object.assign(game.s,{rules:{kind:'single-player'},strikes:[],scans:[],supplyCaches:[],
    parties:[{id:0,faction:0,meta:{},benefits:{},upgradeDelivery:{workers:0,commander:false},
      controller:{kind:'human'},account:{energy:0}}]});
  game.world.reveal=()=>{};game.rehash=()=>{};game.updateSettlements=()=>{};
  game.collectSupplyCaches=()=>{};game.checkBattleResult=()=>{};game.weaponRate=()=>1;
  game.combat=()=>false;game.worker=()=>false;game.medic=()=>false;
  hq.queue=[{type:'worker',progress:1,time:1}];
  const fits=game.unitFits;let queries=0;
  game.unitFits=function(e,x,z){queries++;const result=fits.call(this,e,x,z);
    assert.equal(result,scan(this,e,x,z),'production/runtime query');return result;};
  game.step(10);const e=game.s.entities.find(e=>e.kind==='unit');assert.ok(e?.exit);
  const exit=value(e.exit);game.step(10);
  assert.equal(e.exit,undefined);assert.deepEqual([e.x,e.z],[exit.x,exit.z]);
  assert.ok(queries>0);assert.equal(game.unitCollisionIndex.entities,null);
});

test('failed ticks clear the index, and outside-tick mutations or state replacement cannot reuse it',()=>{
  const game=fixture(),e=game.spawn('unit','rifle',0,0,0,0),probe={type:'rifle',size:.65},failure=Error('tick');
  assert.throws(()=>tick(game,()=>{game.unitFits(probe,0,0);throw failure;}),error=>error===failure);
  assert.equal(game.unitCollisionIndex.entities,null);
  e.x=30;assert.equal(game.unitFits(probe,0,0),true);assert.equal(game.unitFits(probe,30,0),false);
  tick(game,()=>{
    game.unitFits(probe,30,0);
    game.s.entities=[];
    assert.equal(game.unitFits(probe,30,0),true,'replaced entity source uses the live scan');
  });
});

test('Yield axis rejection skips distant order work without changing live array order',()=>{
  const game=fixture(),e=game.spawn('unit','rifle',0,0,0,0),near=game.spawn('unit','rifle',1,0,0,0),
    far=game.spawn('unit','rifle',100,100,0,0);
  let nearReads=0,farReads=0;
  Object.defineProperty(near,'order',{get(){nearReads++;return {type:'idle'};}});
  Object.defineProperty(far,'order',{get(){farReads++;return {type:'idle'};}});
  game.yieldUnitSpace(e,.1,0);
  assert.ok(nearReads>0);assert.equal(farReads,0);assert.ok(near.yieldTo);
});

test('Yield retains exact axes, corners, tangencies and mixed body radii',()=>{
  for(const type of ['worker','rifle','tank','air','destroyer']) for(const axis of ['x','z'])
    for(const offset of [-1e-9,0,1e-9]){
      const game=fixture(),e=game.spawn('unit',type,-1,0,0,0),other=game.spawn('unit',type,0,0,0,0),
        radius=(e.size+other.size)*scale;
      other[axis]=radius+offset;
      game.yieldUnitSpace(e,0,0);
      assert.equal(!!other.yieldTo,offset<0,`${type} ${axis} ${offset}`);
    }
  for(const point of [[.8,.8],[0,0]]){
    const game=fixture(),e=game.spawn('unit','rifle',-1,0,0,0),other=game.spawn('unit','rifle',0,0,0,0),
      radius=(e.size+other.size)*scale;
    other.x=point[0]*radius;other.z=point[1]*radius;
    game.yieldUnitSpace(e,0,0);
    assert.equal(other.yieldTo,undefined,'square candidate is not necessarily an overlapping body');
  }
});

test('Yield retains loaded-worker priority, flight layers and eligibility',()=>{
  for(const loaded of [false,true]){
    const game=fixture(),other=game.spawn('unit','rifle',0,0,0,0),e=game.spawn('unit','worker',-1,0,0,0);
    other.order={type:'move',x:30,z:0};e.carry=loaded?18:0;
    game.yieldUnitSpace(e,.1,0);
    assert.equal(!!other.yieldTo,loaded,'loaded worker precedes stable ID priority');
  }
  for(const change of [e=>e.team=1,e=>e.hp=0,e=>e.type='air',e=>e.yieldUntil=10,
    e=>e.exit={x:10,z:0,building:999,length:10},e=>e.order={type:'attack',target:999}]){
    const game=fixture(),e=game.spawn('unit','rifle',-1,0,0,0),other=game.spawn('unit','rifle',0,0,0,0);
    change(other);game.yieldUnitSpace(e,.1,0);assert.equal(other.yieldTo,undefined);
  }
});

test('indexed dense steering and recursive Yield preserve the scan state and RNG after each directed tick',()=>{
  const indexed=fixture(),legacy=fixture();legacy.unitFits=function(e,x,z){return scan(this,e,x,z);};
  for(const game of [indexed,legacy]) {
    for(let i=0;i<100;i++) {
      const e=game.spawn('unit','rifle',(i%10)*1.9-10,Math.floor(i/10)*1.9-10,0,0);
      game.setOrder(e,{type:'move',x:30,z:30});
    }
    game.stepTick=function(dt){this.s.time+=dt;for(const e of this.s.entities)this.move(e,e.order,dt);};
  }
  for(let i=0;i<24;i++) {
    indexed.step(.05);legacy.step(.05);
    assert.deepEqual(value(indexed.s),value(legacy.s),`directed tick ${i}`);
    assert.equal(indexed.random.state,legacy.random.state);
  }
});
