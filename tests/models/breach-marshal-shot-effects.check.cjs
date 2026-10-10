const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {loadScripts}=require('../helpers/game-scripts.cjs');
const {createRendererStub}=require('../helpers/renderer-stub.cjs');
function setup(){
 const context=loadScripts(['core','content','effects','effects-view'],{globals:{clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}});
 const {Effects,render}=vm.runInContext('({Effects:MeridianEffects,render:renderBattlefieldEffects})',context);
 const effects=new Effects(()=>{throw Error('Shot RNG');});effects.entityHeight=()=>3;
 const source={id:1,kind:'unit',type:'hero',faction:0,team:0,size:.8,x:10,z:12,rot:.7},
  target={...source,id:2,team:1,x:18,z:21,size:1};
 return {effects,render,source,target};
}
test('Breach Marshal shots: cyan scaled carbine muzzle, unchanged RNG, effect count and non-Pact weapons',()=>{
 const {effects,source,target}=setup();
 for(const team of [0,1])for(const rot of [0,.7,-2.1]){
  source.team=team;source.rot=rot;effects.reset();effects.shot(source,target,0);
  assert.equal(effects.fx.length,1);const f=effects.fx[0];
  assert.equal(f.color,0x38d9e8);assert(effects.modelMuzzleBeams.has(f));
  assert(Math.abs(f.x-source.x-(Math.cos(rot)*.24+Math.sin(rot)*1.3)*1.18)<1e-9);
  assert(Math.abs(f.z-source.z-(-Math.sin(rot)*.24+Math.cos(rot)*1.3)*1.18)<1e-9);
  assert.equal(f.y,3+1.425*1.18);assert.equal(f.life,.1);assert.equal(f.width,.035);
  assert.equal(effects.combatBeams.get(f),target.size);
 }
 for(const change of [{type:'medic'},{type:'tank'},{kind:'building',type:'turret'},{faction:1},{faction:2}]){
  effects.reset();const e={...source,...change};effects.shot(e,target);
  assert(!effects.modelMuzzleBeams.has(effects.fx[0]));assert.notEqual(effects.fx[0].color,0x38d9e8);
  assert.equal(effects.fx[0].x,e.x+Math.sin(e.rot)*.7);
 }
});
test('Breach Marshal effects: model flash replaces only muzzle sphere; tracer, impact and fog remain',()=>{
 const {effects,render,source,target}=setup();effects.shot(source,target);
 const r=createRendererStub({record:true});r.quality=1;r.beam=(...args)=>r.calls.push(['beam',...args]);
 const s={time:0,entities:[],scans:[],fields:[],strikes:[],cam:{x:0,z:0}},world={visible:[255],idx:()=>0,renderProfile:{ecology:{dry:[.4,.4,.4],weather:'clear'}}};
 render(r,effects,world,s,[],0);assert(r.calls.length>0);
 assert(!r.calls.some(c=>c[0]==='sphere'));assert(r.calls.filter(c=>c[0]==='beam').every(c=>c[4]===0x38d9e8));
 r.calls.length=0;world.visible[0]=0;render(r,effects,world,s,[],0);assert.deepEqual(r.calls,[]);
});
