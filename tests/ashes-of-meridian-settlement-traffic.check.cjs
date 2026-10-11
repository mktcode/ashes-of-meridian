// Bounded cosmetic updates only: no game ticks or AI matches.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {loadScripts}=require('./helpers/game-scripts.cjs');
const context=loadScripts(['core','content','battlefield-surface','world','model-settlement-traffic','world-view','settlement-traffic']);
const {SettlementTraffic,BattlefieldView,Battlefield,BattlefieldSurface,buildingVisualYaw,CIVILIZATION_MODEL_SCALE}=vm.runInContext(
 '({SettlementTraffic,BattlefieldView,Battlefield,BattlefieldSurface,buildingVisualYaw,CIVILIZATION_MODEL_SCALE})',context);
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
 assert.equal(actors.filter(a=>!a.air).length,60);assert.equal(actors.filter(a=>a.air).length,6);
 assert.equal(new Set(actors.map(a=>a.id)).size,66);assert.ok(actors.every(a=>a.id<0));
 for(const forum of new Set(actors.map(a=>a.forumId)))assert.ok(actors.filter(a=>a.forumId===forum&&!a.air).length<=24);
 assert.ok(new Set(actors.filter(a=>!a.air).map(a=>a.forumId)).size>=12);
 h.update(.25,0);assert.equal(h.traffic.actors.filter(a=>!a.air).length,30);assert.equal(h.traffic.actors.filter(a=>a.air).length,3);
 h.state.rules.completed=false;h.update(.5);assert.equal(h.traffic.actors.length,0);
});
test('trip searches are globally throttled, cached and use an explicit small A* budget without mutating CPU entities or RNG',()=>{
 const h=fixture(),before=plain(h.state.entities);
 for(let i=0;i<=200;i++)h.update(i*.1);
 assert.ok(h.calls.length>0&&h.calls.length<=80);
 assert.ok(h.calls.every(args=>args[8]===600));
 assert.equal(h.state.rng,98765);assert.deepEqual(plain(h.state.entities),before);
 const actors=plain(h.traffic.actors);h.update(20);assert.deepEqual(plain(h.traffic.actors),actors,'pause freezes positions, waits and animation');
});
test('failed or partial ground routes never spawn walkers and failed pairs are cached instead of retried every frame',()=>{
 const h=fixture();h.world.path=(...args)=>{h.calls.push(args);return {status:'budget-exhausted',points:[{x:0,z:0}]};};
 let sawAir=false;
 for(let i=0;i<=400;i++){h.update(i*.1);sawAir ||= h.traffic.actors.some(a=>a.air&&a.route);}
 assert.ok(h.calls.length>0&&h.calls.length<=40,'failed directed pairs are cached within each refresh interval');
 assert.ok(h.traffic.actors.filter(a=>!a.air).every(a=>!a.route));
 assert.ok(sawAir,'air traffic does not need A*');
});
test('both traffic types cross authored rotated door planes, traverse to another building and disappear inside it',()=>{
 const h=fixture();h.update(0);
 const ground=h.traffic.actors.find(a=>!a.air),air=h.traffic.actors.find(a=>a.air);
 for(const actor of [ground,air]) {
  actor.homeId=h.state.entities[0].id;actor.random=()=>.8;
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
test('Forum trips are weighted, use the surrounding work area and work with one upgrade',()=>{
 const h=fixture(1,1);h.update(0);
 const actor=h.traffic.actors.find(a=>!a.air),forum=h.state.entities.find(b=>b.type==='meridianforum');
 actor.homeId=h.state.entities[0].id;actor.random=()=>.1;
 h.traffic.depart(actor,h.world);assert.equal(actor.destinationId,forum.id);
 const area=h.calls.at(-1)[5];assert.equal(area.radius,forum.size+2.9);assert.equal(area.terrainConnection,false);
 assert.ok(actor.destinationOutside);
 for(let i=0;i<2000&&!actor.lingerUntil;i++)h.traffic.advance(actor,h.world,.1,i*.1);
 assert.equal(actor.homeId,forum.id);assert.equal(actor.alpha,1);assert.ok(actor.lingerUntil);
 const arrived=plain({x:actor.x,y:actor.y,z:actor.z});
 h.traffic.depart(actor,h.world);assert.deepEqual(plain(actor.route[0]),arrived,'no teleport to the inaccessible front door');
 assert.equal(actor.destinationId,h.state.entities[0].id);
 const large=fixture();large.update(0);const walker=large.traffic.actors.find(a=>!a.air);
 walker.homeId=large.state.entities[0].id;walker.random=()=>.2;large.traffic.depart(walker,large.world);
 assert.equal(walker.destinationId,10000);
 walker.random=()=>.8;large.traffic.depart(walker,large.world);assert.notEqual(walker.destinationId,10000);
 const drone=large.traffic.actors.find(a=>a.air);drone.random=()=>.1;large.traffic.depart(drone,large.world);
 assert.notEqual(drone.destinationId,10000,'drones retain their existing upgrade-only trips');
});
test('road usage is sampled only for cosmetic ground searches and cache refresh preserves active trips',()=>{
 const h=fixture();h.state.time=0;h.traffic.update(h.world,h.state,2,()=>true,(x)=>x>0?1:0);
 const actor=h.traffic.actors.find(a=>!a.air);actor.homeId=1;actor.random=()=>.8;
 h.traffic.depart(actor,h.world);const cost=h.calls.at(-1)[9];
 assert.equal(cost(10,0),1);assert.equal(cost(-10,0),1.3);
 const route=actor.route;h.traffic.depart(actor,h.world);assert.equal(h.calls.length,1,'same pair is cached');
 for(let time=.5;time<=30;time+=.5) {
  h.state.time=time;h.traffic.advance=()=>{};h.traffic.update(h.world,h.state,2,()=>true,()=>1);
 }
 assert.deepEqual(plain(actor.route),plain(route),'refresh does not replace an active journey');
 const before=h.calls.length;h.traffic.depart(actor,h.world);
 assert.equal(h.calls.length,before+1,'expired pairs are searched again');
 assert.equal(h.calls.at(-1)[9](-10,0),1,'future trips see refreshed roads');
});
test('a hillside Forum remains visitable when the front stair is inaccessible but its worker area is reachable',()=>{
 const h=fixture(1,2),forum=h.state.entities.find(b=>b.type==='meridianforum');
 forum.x=0;forum.z=0;
 h.state.entities[0].x=-24;h.state.entities[0].z=-6;h.state.entities[0].visualRotation=0;
 h.state.entities[1].x=-24;h.state.entities[1].z=-18;h.state.entities[1].visualRotation=0;
 const surface=new BattlefieldSurface(32,1,(x,z)=>x<0?Math.max(0,Math.min(6,(x+20)*.3)):
  Math.max(0,Math.min(6,(8-z)*1.5)));
 h.world=Object.assign(Object.create(Battlefield.prototype),{extent:32,cellSize:1,gridSize:64,viewTeam:0,pathVersion:1,
  surface,staticGrid:new Uint8Array(surface.cliffs),blocked:new Uint8Array(64*64),visible:new Uint8Array(64*64).fill(1)});
 h.world.rebuild(h.state.entities);
 const traffic=h.traffic;traffic.update(h.world,h.state,2,()=>true);
 const portal=traffic.groups.get(forum.id).find(p=>p.building.id===forum.id);
 assert.equal(portal.groundAccess,false,'the old front-stair requirement rejects this hill');
 const start=traffic.groups.get(forum.id).find(p=>p.building.id===h.state.entities[0].id).service;
 const area={x:0,z:0,radius:forum.size+2.9,terrainConnection:false};
 assert.equal(h.world.path(start.x,start.z,0,0,false,area,.2).status,'complete','worker-style access is reachable');
 const actor=traffic.actors.find(a=>!a.air);actor.homeId=1;actor.random=()=>.1;traffic.depart(actor,h.world);
 assert.ok(actor.route);assert.equal(actor.destinationId,forum.id);assert.ok(actor.destinationOutside);
 const end=actor.route.at(-1);assert.ok(Math.hypot(end.x,end.z)<=area.radius);
 assert.equal(h.world.blockedAt(end.x,end.z),false);assert.ok(surface.fits(end.x,end.z,.2));
 for(let i=actor.groundStart;i<actor.groundEnd;i++)assert.ok(h.world.lineFree(actor.route[i],actor.route[i+1],.2),'every outdoor segment is genuinely traversable');
 for(let i=0;i<1500&&!actor.lingerUntil;i++)traffic.advance(actor,h.world,.1,i*.1);
 assert.equal(actor.homeId,forum.id);assert.equal(actor.alpha,1);
 const arrived=plain({x:actor.x,y:actor.y,z:actor.z});traffic.depart(actor,h.world);
 assert.deepEqual(plain(actor.route[0]),arrived);assert.equal(actor.destinationId,1);
});
test('Forum visitors form spaced temporary groups, pause without walking or creating wear, then leave',()=>{
 const h=fixture();h.update(0);
 const visitors=h.traffic.actors.filter(a=>!a.air).slice(0,3);
 for(const actor of visitors){actor.homeId=1;actor.random=()=>.1;h.traffic.depart(actor,h.world);}
 let now=0;
 for(let i=1;i<1500;i++) {
  now=i*.1;h.update(now);
  if(visitors.every(a=>a.lingerUntil>now))break;
 }
 assert.ok(visitors.every(a=>a.lingerUntil>now&&a.alpha===1&&a.walk===0));
 for(let i=0;i<visitors.length;i++)for(let j=i+1;j<visitors.length;j++)
  assert.ok(Math.hypot(visitors[i].x-visitors[j].x,visitors[i].z-visitors[j].z)>=.65,'group members do not overlap');
 const snapshot=plain(visitors);h.update(now);assert.deepEqual(plain(visitors),snapshot,'pause freezes gathering');
 const uploads=[],view=new BattlefieldView({workerRoads(p){uploads.push(Array.from(p));},releaseWorkerRoads(){}});
 view.world={extent:100};view.updateWorkerRoads(now,[],()=>true,visitors);
 view.updateWorkerRoads(now+.5,[],()=>true,visitors);
 assert.ok(uploads.every(p=>p.every(v=>v===0)),'standing groups do not strengthen paths');
 const visitor=visitors[0],end=visitor.lingerUntil;
 h.traffic.advance(visitor,h.world,.1,end+.1);assert.equal(visitor.route,null);assert.ok(visitor.outside);
 const position=plain({x:visitor.x,y:visitor.y,z:visitor.z});h.traffic.depart(visitor,h.world);
 assert.deepEqual(plain(visitor.route[0]),position);assert.notEqual(visitor.destinationId,10000);
 h.state.entities.find(b=>b.id===10000).visualRotation=1;h.update(now+.1);
 assert.ok(visitors.every(a=>!a.outside&&a.lingerUntil===0),'a changed Forum discards obsolete meeting positions');
});
test('unreachable Forum areas never teleport visitors into groups',()=>{
 const h=fixture();h.world.path=(...args)=>{h.calls.push(args);return {status:'unreachable',points:[]};};h.update(0);
 const actor=h.traffic.actors.find(a=>!a.air);actor.homeId=1;actor.random=()=>.1;h.traffic.depart(actor,h.world);
 assert.equal(actor.route,null);assert.equal(actor.outside,false);assert.equal(actor.alpha,0);
 assert.equal(h.traffic.meetingPoints.size,0);
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
