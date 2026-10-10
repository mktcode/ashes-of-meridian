// Synthetic fixture contracts only: no terrain generation, simulation ticks or autonomous AI.
const test = require('node:test');
const assert = require('node:assert/strict');
const { populateBase, populateOpponent } = require('./helpers/populated-battle.cjs');

function fixture() {
  const parties = [0,1].map(id => ({id,faction:2-id,deploymentPending:false,
    account:{alloy:250,gas:0,energy:25,abilities:{scan:0}}}));
  const homes = parties.map(p => ({id:p.id+1,kind:'building',type:'hq',team:p.id,faction:p.faction,
    x:p.id*200,z:0,hp:2600,maxHp:2600,size:4.4,progress:1}));
  const vent = {id:3,kind:'resource',type:'gas',team:-1,x:18,z:18,hp:100,amount:4000};
  const points = [0,200].flatMap(x => [[10,0],[20,0],[0,10],[10,10],[0,20],[20,20],[30,0],[0,30]]
    .map(([dx,z]) => ({x:x+dx,z})));
  const random = () => { random.state++; return .9; }; random.state=77;
  const checked=[], built=[], spawned=[], rebuilds=[];
  const game = {
    s:{entities:[...homes,vent],parties,nextId:4,stats:{built:0,gathered:0}},
    ids:new Map([...homes,vent].map(e=>[e.id,e])), random,
    party:team=>parties[team],
    alive(predicate) { return this.s.entities.filter(e=>e.hp>0&&predicate(e)); },
    cost:type=>({cost:10,gas:type==='factory'?3:0}),
    unitFits:()=>true,
    spawnDeploymentUnit(type, preferred, home, team, faction) {
      assert.strictEqual(preferred,homes[team]); assert.strictEqual(home,homes[team]);
      const count=this.alive(e=>e.team===team&&e.kind==='unit').length;
      const unit={id:this.s.nextId++,kind:'unit',type,team,faction,x:home.x+2+count*3,z:-12,
        hp:100,cd:this.random()*.5,order:{type:'idle'}};
      this.s.entities.push(unit); this.ids.set(unit.id,unit); spawned.push(unit); return unit;
    },
    canBuild(type,p,team) {
      checked.push({type,x:p.x,z:p.z,team});
      if (p.x===homes[team].x+10&&p.z===0) return 'Unsuitable foundation.';
      if (type==='factory'&&!this.alive(e=>e.team===team&&e.type==='barracks').length) return 'Requires barracks.';
      if (type==='refinery'&&(p.x!==vent.x||p.z!==vent.z)) return 'Not an explored vent.';
      if (this.alive(e=>e.kind==='building').some(e=>Math.hypot(e.x-p.x,e.z-p.z)<5)) return 'Structure blocks foundation.';
      return '';
    },
    build(type,p,ids,team) {
      if(this.canBuild(type,p,team)) return false;
      assert.ok(ids.length); assert.ok(ids.every(id=>this.ids.get(id)?.type==='worker'));
      const cost=this.cost(type),account=parties[team].account;
      assert.ok(account.alloy>=cost.cost&&account.gas>=cost.gas);
      account.alloy-=cost.cost; account.gas-=cost.gas;
      const b={id:this.s.nextId++,kind:'building',type,team,faction:parties[team].faction,x:p.x,z:p.z,
        hp:60,maxHp:1000,progress:.06,paid:cost,cd:this.random()*.5};
      if(type==='refinery') b.gasId=vent.id;
      this.s.entities.push(b); this.ids.set(b.id,b); built.push(b); return true;
    },
    setOrder(unit,order) { unit.order=order; },
    rehash() { this.indexed=[...this.s.entities]; },
    world:{deploymentReachable:new Uint8Array(points.length).fill(1),point:i=>points[i],
      staticGrid:new Uint8Array([0,1,0]),blocked:new Uint8Array([0,1,0]),
      rebuild(entities) { rebuilds.push([...entities]); },
      explore(team,home,radius) {
        assert.strictEqual(home,homes[team]); assert.equal(radius,64);
      },
      reveal(entities) { this.revealed=[...entities]; }}
  };
  return {game,parties,homes,vent,random,checked,built,spawned,rebuilds};
}

test('populated bases use validated paid buildings and fitting units without shifting RNG, terrain or resources', () => {
  const f=fixture(),{game,random,vent}=f,resourceBefore={...vent},grid=game.world.staticGrid,
    blocked=game.world.blocked,terrain=[...grid],enemyAccount=structuredClone(f.parties[1].account);
  const own=populateBase(game),enemy=populateOpponent(game);
  assert.equal(game.random,random); assert.equal(random.state,77);
  assert.strictEqual(game.world.staticGrid,grid); assert.deepEqual([...grid],terrain);
  assert.strictEqual(game.world.blocked,blocked); assert.deepEqual([...blocked],terrain);
  assert.deepEqual(vent,resourceBefore); assert.strictEqual(game.ids.get(vent.id),vent);
  assert.deepEqual(f.parties[0].account,{alloy:1100,gas:400,energy:25,abilities:{scan:0}});
  assert.deepEqual(f.parties[1].account,enemyAccount);
  assert.deepEqual(own.buildings.map(b=>b.type),['refinery','barracks','depot','factory','depot']);
  assert.deepEqual(enemy.buildings.map(b=>b.type),['turret','turret','barracks','factory']);
  assert.equal(own.units.length,17); assert.equal(enemy.units.length,7);
  assert.equal(game.alive(e=>e.team===0&&e.type==='worker').length,5);
  assert.equal(game.alive(e=>e.team===1&&e.type==='worker').length,0);
  for(const b of [...own.buildings,...enemy.buildings]) {
    assert.equal(b.progress,1); assert.equal(b.hp,b.maxHp); assert.equal(b.cd,.25);
    assert.ok(f.checked.some(p=>p.type===b.type&&p.team===b.team&&p.x===b.x&&p.z===b.z));
    assert.ok(f.built.includes(b)); assert.strictEqual(game.ids.get(b.id),b);
  }
  for(const unit of f.spawned) {
    assert.equal(unit.faction,f.parties[unit.team].faction); assert.equal(unit.cd,.25);
    assert.equal(game.ids.has(unit.id),unit.team===0||unit.type!=='worker');
  }
  assert.deepEqual(game.s.stats,{built:0,gathered:0});
  assert.deepEqual(game.indexed,game.s.entities);
  assert.deepEqual(f.rebuilds.at(-1),game.s.entities);
  assert.deepEqual(game.world.revealed,game.s.entities);
  assert.throws(()=>populateBase(game),/otherwise empty HQ/);
});

test('populated fixture rejects unsuitable sites without unblocking terrain or using unchecked coordinates', () => {
  const {game,random,parties,built}=fixture(),blocked=game.world.blocked;
  game.canBuild=()=>{assert.strictEqual(game.world.blocked,blocked);return 'Blocked terrain.';};
  assert.throws(()=>populateBase(game),/no legal reachable refinery site/);
  assert.equal(built.length,0); assert.equal(game.random,random); assert.equal(random.state,77);
  assert.deepEqual([parties[0].account.alloy,parties[0].account.gas],[250,0]);
  assert.strictEqual(game.world.blocked,blocked); assert.deepEqual([...blocked],[0,1,0]);
});

test('populated fixture rejects valid-looking sites when actual construction cannot reach them', () => {
  const {game,random,parties,built}=fixture();
  let attempts=0;
  game.build=()=>{attempts++;return false;};
  assert.throws(()=>populateBase(game),/no legal reachable refinery site/);
  assert.ok(attempts>0); assert.equal(built.length,0);
  assert.equal(game.random,random); assert.equal(random.state,77);
  assert.deepEqual([parties[0].account.alloy,parties[0].account.gas],[250,0]);
});

test('populated fixture rejects missing or unfitting units rather than silently reducing the army', () => {
  for(const unfitting of [false,true]) {
    const {game,random,parties}=fixture();
    if(unfitting) game.unitFits=()=>false; else game.spawnDeploymentUnit=()=>null;
    assert.throws(()=>populateBase(game),/no fitting worker position/);
    assert.equal(game.random,random); assert.equal(random.state,77);
    assert.deepEqual([parties[0].account.alloy,parties[0].account.gas],[250,0]);
  }
});

test('populated fixture restores grants, RNG and indexes on partial failure without claiming rollback', () => {
  const {game,random,parties,built}=fixture(),build=game.build;
  game.build=function(...args) {
    if(args[0]==='barracks') throw Error('fixture build failed');
    return build.apply(this,args);
  };
  assert.throws(()=>populateBase(game),/fixture build failed/);
  assert.equal(built.length,1); assert.equal(built[0].progress,1);
  assert.equal(game.random,random); assert.equal(random.state,77);
  assert.deepEqual([parties[0].account.alloy,parties[0].account.gas],[250,0]);
  assert.deepEqual(game.indexed,game.s.entities);
  assert.deepEqual(game.world.revealed,game.s.entities);
});

test('populated fixture requires established HQs and an explicit valid worker count', () => {
  const {game,parties}=fixture();
  parties[0].deploymentPending=true;
  assert.throws(()=>populateBase(game),/established/);
  parties[0].deploymentPending=false;
  for(const count of [-1,1.5,NaN]) assert.throws(()=>populateBase(game,count),/worker count/);
});
