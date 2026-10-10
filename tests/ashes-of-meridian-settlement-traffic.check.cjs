// Bounded cosmetic updates only: no game ticks or AI matches.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {loadScripts}=require('./helpers/game-scripts.cjs');
const context=loadScripts(['core','content','world','model-settlement-traffic','world-view','settlement-traffic']);
const {SettlementTraffic,BattlefieldView,buildingVisualYaw,CIVILIZATION_MODEL_SCALE}=vm.runInContext(
 '({SettlementTraffic,BattlefieldView,buildingVisualYaw,CIVILIZATION_MODEL_SCALE})',context);
const plain=value=>JSON.parse(JSON.stringify(value));
function fixture(forums=1,perForum=4) {
 let id=1;
 const entities=[];
 for(let f=0;f<forums;f++)for(let i=0;i<perForum;i++)entities.push({id:id++,kind:'building',type:i%2?'embercottage':'fieldlab',
  forumId:10000+f,team:0,faction:0,x:f*200+i*20,z:0,size:3.6,hp:500,progress:1,visualRotation:i/3});
 for(let f=0;f<forums;f++)entities.push({id:10000+f,kind:'building',type:'meridianforum',team:0,faction:0,
  x:f*200,z:-50,size:10.4,hp:950,progress:1});
 const state={seed:1409,time:0,rng:98765,rules:{kind:'single-player',completed:true},entities};
 const calls=[];
 const world={extent:5000,cellSize:1,viewTeam:0,pathVersion:1,idx:()=>0,visible:new Uint8Array([1]),staticGrid:new Uint8Array(1),
  blockedAt:()=>false,terrainFree:()=>true,lineFree:()=>true,
  surface:{buildingPose:()=>({height:0}),heightAt:()=>0,fits:()=>true},
  path(...args){calls.push(args);return {status:'complete',points:[{x:args[2],z:args[3]}]};}};
 const traffic=new SettlementTraffic();
 const update=(time,quality=2)=>{state.time=time;traffic.update(world,state,quality,()=>true);};
 return {traffic,state,world,calls,update};
}
test('decorative population is bounded globally and per Forum, fairly allocated, with lower Performance budgets',()=>{
 const small=fixture();small.update(0);
 assert.equal(small.traffic.actors.filter(a=>a.air).length,3,'a small settlement supports several drones');
 const h=fixture(20,14);h.update(0);
 const actors=h.traffic.actors;
 assert.equal(actors.filter(a=>!a.air).length,24);assert.equal(actors.filter(a=>a.air).length,6);
 assert.equal(new Set(actors.map(a=>a.id)).size,30);assert.ok(actors.every(a=>a.id<0));
 for(const forum of new Set(actors.map(a=>a.forumId)))assert.ok(actors.filter(a=>a.forumId===forum&&!a.air).length<=8);
 assert.ok(new Set(actors.filter(a=>!a.air).map(a=>a.forumId)).size>=12);
 h.update(.25,0);assert.equal(h.traffic.actors.filter(a=>!a.air).length,12);assert.equal(h.traffic.actors.filter(a=>a.air).length,3);
 h.state.rules.completed=false;h.update(.5);assert.equal(h.traffic.actors.length,0);
});
test('trip searches are globally throttled, cached and use an explicit small A* budget without mutating CPU entities or RNG',()=>{
 const h=fixture(),before=plain(h.state.entities);
 for(let i=0;i<=200;i++)h.update(i*.1);
 assert.ok(h.calls.length>0&&h.calls.length<=40);
 assert.ok(h.calls.every(args=>args[8]===600));
 assert.equal(h.state.rng,98765);assert.deepEqual(plain(h.state.entities),before);
 const actors=plain(h.traffic.actors);h.update(20);assert.deepEqual(plain(h.traffic.actors),actors,'pause freezes positions, waits and animation');
});
test('failed or partial ground routes never spawn walkers and failed pairs are cached instead of retried every frame',()=>{
 const h=fixture();h.world.path=(...args)=>{h.calls.push(args);return {status:'budget-exhausted',points:[{x:0,z:0}]};};
 let sawAir=false;
 for(let i=0;i<=400;i++){h.update(i*.1);sawAir ||= h.traffic.actors.some(a=>a.air&&a.route);}
 assert.ok(h.calls.length>0&&h.calls.length<=12,'at most the twelve directed pairs of four buildings are searched');
 assert.ok(h.traffic.actors.filter(a=>!a.air).every(a=>!a.route));
 assert.ok(sawAir,'air traffic does not need A*');
});
test('both traffic types cross authored rotated door planes, traverse to another building and disappear inside it',()=>{
 const h=fixture();h.update(0);
 const ground=h.traffic.actors.find(a=>!a.air),air=h.traffic.actors.find(a=>a.air);
 for(const actor of [ground,air]) {
  h.traffic.depart(actor,h.world);assert.ok(actor.route);
  const route=plain(actor.route),first=route[0],last=route.at(-1);
  assert.ok(Math.hypot(first.x-last.x,first.z-last.z)>10);
  const portal=h.traffic.groups.get(actor.forumId).find(p=>Math.hypot(p.inside.x-first.x,p.inside.z-first.z)<1e-9);
  const yaw=buildingVisualYaw(portal.building),localZ=(first.x-portal.building.x)*Math.sin(yaw)+(first.z-portal.building.z)*Math.cos(yaw);
  assert.ok(localZ<1.72*CIVILIZATION_MODEL_SCALE,'starts behind the model door, not before the building');
  assert.equal(actor.alpha,0,'hidden inside at departure');
  if(actor.air)assert.ok(Math.max(...route.map(p=>p.y))>=16);
  let sawOutside=false;
  for(let i=0;i<2000&&actor.route;i++) {h.traffic.advance(actor,h.world,.1,i*.1);if(actor.alpha===1)sawOutside=true;}
  assert.ok(sawOutside);assert.equal(actor.route,null);assert.equal(actor.alpha,0);
  assert.ok(Math.hypot(actor.x-last.x,actor.y-last.y,actor.z-last.z)<1e-6,'arrival is inside the destination');
  h.traffic.depart(actor,h.world);
  assert.deepEqual(plain(actor.route[0]),last,'next journey emerges from the same building the actor entered');
 }
});
test('unreachable stilt access prevents ground trips but does not prevent sparse aircraft',()=>{
 const h=fixture();h.world.terrainFree=()=>false;h.update(0);
 const ground=h.traffic.actors.find(a=>!a.air),air=h.traffic.actors.find(a=>a.air);
 h.traffic.depart(ground,h.world);assert.equal(ground.route,null);assert.equal(h.calls.length,0);
 h.traffic.depart(air,h.world);assert.ok(air.route);assert.equal(h.calls.length,0);
});
test('unaffected trips survive growth and navigation revisions; changed doors, blocked routes and world switches discard stale traffic',()=>{
 const h=fixture();h.update(0);
 const actor=h.traffic.actors.find(a=>!a.air);h.traffic.depart(actor,h.world);
 const route=actor.route;
 h.state.entities.push({...h.state.entities[0],id:99,x:100});h.world.pathVersion++;h.update(.1);
 assert.strictEqual(h.traffic.actors.find(a=>a.id===actor.id).route,route,'growth is not a global traffic restart');
 h.world.lineFree=()=>false;h.world.pathVersion++;h.update(.2);assert.equal(actor.route,null);
 h.world.lineFree=()=>true;h.traffic.depart(actor,h.world);
 const sourceId=Number(actor.tripKey.split(':')[0]);h.state.entities.find(b=>b.id===sourceId).visualRotation+=1/3;
 h.update(.3);assert.equal(actor.route,null,'rotation invalidates the old doorway');
 h.world.viewTeam=1;h.update(.4);assert.ok(h.traffic.actors.every(a=>!a.route));
 h.update(5);assert.ok(h.traffic.actors.every(a=>!a.route),'no catch-up movement across a background gap');
});
test('only moving visible pedestrians feed the existing wear field; drones never leave ground trails',()=>{
 const h=fixture();h.update(0);
 for(const a of h.traffic.actors)h.traffic.depart(a,h.world);
 for(const a of h.traffic.actors)h.traffic.advance(a,h.world,.2,.2);
 assert.ok(h.traffic.walkers().length>0);assert.ok(h.traffic.walkers().every(a=>!a.air));
 const uploads=[],view=new BattlefieldView({releaseWorkerRoads(){},workerRoads(pixels){uploads.push(Array.from(pixels));}});
 view.world={extent:100};view.updateWorkerRoads(.2,[],()=>true,h.traffic.walkers());
 for(const a of h.traffic.actors)h.traffic.advance(a,h.world,.25,.45);
 view.updateWorkerRoads(.45,[],()=>true,h.traffic.walkers());
 assert.ok(uploads.some(p=>p.some(v=>v>0)),'pedestrians build the normal worker wear texture');
 h.world.visible.fill(0);assert.equal(h.traffic.walkers().length,0);
});
test('removed Forums and unfinished, unobserved or scheduled-for-removal buildings do not generate traffic',()=>{
 const h=fixture();h.update(0);assert.ok(h.traffic.actors.length);
 h.state.entities.find(e=>e.type==='meridianforum').hp=0;h.update(.25);assert.equal(h.traffic.actors.length,0);
 h.state.entities.find(e=>e.type==='meridianforum').hp=950;
 for(const b of h.state.entities)if(b.forumId!==undefined)b.progress=.5;
 h.update(.5);assert.equal(h.traffic.actors.length,0);
 for(const b of h.state.entities)if(b.forumId!==undefined){b.progress=1;b.settlementAt=10;}
 h.update(.75);assert.equal(h.traffic.actors.length,0);
 for(const b of h.state.entities)delete b.settlementAt;
 h.state.time=1;h.traffic.update(h.world,h.state,2,()=>false);assert.equal(h.traffic.actors.length,0);
});
test('models use only six pedestrian or four drone shared primitive parts, without lights or mesh allocations',()=>{
 const models=vm.runInContext('SettlementTrafficModels',context);
 for(const [name,count] of [['civilian',6],['drone',4]]) {
  const parts=[];models[name]({part:(...args)=>parts.push(args),walk:3,color:0xaaaaaa});
  assert.equal(parts.length,count);assert.ok(parts.every(p=>p[0]==='box'));
  const emissive=parts.filter(p=>(p[11]||0)>0);
  assert.equal(emissive.length,name==='drone'?1:0,'only the existing drone indicator emits light');
  if(name==='drone')assert.equal(emissive[0][7],0x69cbd8);
 }
});
