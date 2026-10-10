const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {loadScripts}=require('../helpers/game-scripts.cjs');
const {createRendererStub}=require('../helpers/renderer-stub.cjs');
function setup(){
 const context=loadScripts(['core','content','effects','effects-view'],{globals:{clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}});
 vm.runInContext('Math.random=()=>{throw Error("View RNG");}',context);
 const {Effects,render,views}=vm.runInContext('({Effects:MeridianEffects,render:renderBattlefieldEffects,views:infantryShotViews})',context);
 const effects=new Effects(()=>{throw Error('Shot RNG');});
 const R=createRendererStub({record:true});R.quality=2;R.cinema=false;R.beam=(...a)=>R.calls.push(['beam',...a]);
 const world={visible:[1,1],idx:x=>x<10?0:1,definition:{palette:{ground:0xab9876}}};
 const s={time:0,entities:[],fields:[],scans:[],strikes:[]};
 const source={kind:'unit',type:'rifle',x:0,z:0,rot:Math.PI/2,faction:0,team:0,size:.65},target={...source,x:20,team:1};
 const frame=()=>{R.calls.length=0;const before=JSON.stringify(effects.fx);render(R,effects,world,s,[],s.time);assert.equal(JSON.stringify(effects.fx),before);return R.calls;};
 return {effects,R,world,s,source,target,frame,views};
}
test('rifle impulse preserves CPU effect contract across factions; ordinary weapons remain unmarked',()=>{
 const {effects,source,target,R,s,frame}=setup();
 for(const [faction,color] of [[0,0x38d9e8],[1,0xb9ed86],[2,0xc6a5ff]]){
  effects.reset();source.faction=faction;effects.shot(source,target);
  const f=effects.fx[0];assert(effects.infantryBeams.has(f));assert.equal(effects.fx.length,1);
  assert.equal(f.life,faction===2?.19:.1);assert.equal(f.maxLife,.19);assert.equal(f.width,.035);
  frame();s.time+=.04;effects.tick(.04);frame();
  assert(R.calls.some(c=>c[0]==='beam'&&c[4]===color));
  assert(!R.calls.some(c=>c[0]==='beam'&&Math.hypot(c[2][0]-c[1][0],c[2][2]-c[1][2])>6));
 }
 for(const type of ['hero','medic','tank','worker']){effects.reset();effects.shot({...source,type},target);assert(!effects.infantryBeams.has(effects.fx[0]));}
});
test('view-only trails survive CPU expiry, freeze on pause, expire, and never replay after sight loss/reset',()=>{
 const {effects,source,target,world,s,frame}=setup();effects.shot(source,target);frame();
 effects.tick(.14);s.time=.14;assert.equal(effects.fx.length,0);assert(frame().length>0);
 const frozen=JSON.stringify(frame());assert.equal(JSON.stringify(frame()),frozen);
 world.visible[1]=0;assert.equal(frame().length,0);world.visible[1]=1;assert.equal(frame().length,0);
 effects.shot(source,target);frame();effects.reset();assert.equal(frame().length,0);
 effects.shot(source,target);frame();effects.tick(.5);s.time+=.5;assert.equal(frame().length,0);
 effects.shot(source,target);frame();s.time=0;effects.reset();assert.equal(frame().length,0);
});
test('rifle view budgets, endpoint fog and clip bounds apply without culling replays',()=>{
 const {effects,source,target,R,world,s,frame,views}=setup();
 for(let i=0;i<100;i++)effects.shot(source,target);
 frame();assert.equal(views.get(R).shots.length,32);
 R.quality=0;frame();assert.equal(views.get(R).shots.length,8);
 world.visible[0]=0;assert.equal(frame().length,0);world.visible[0]=1;assert.equal(frame().length,0);
 effects.reset();world.visible[1]=0;effects.shot(source,target);frame();world.visible[1]=1;assert.equal(frame().length,0);
 effects.reset();effects.shot(source,target);R.vp=[1,0,0,0,0,1,0,0,0,0,1,0,-1000,0,0,1];R.viewport={width:800,height:600};assert.equal(frame().length,0);
 R.vp=null;s.time=.04;assert(frame().length>0,'offscreen live fire can enter the viewport');
});
