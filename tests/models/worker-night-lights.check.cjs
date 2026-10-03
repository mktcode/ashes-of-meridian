const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {modelHarness} = require('../helpers/model-contract.cjs');
const {createRendererStub} = require('../helpers/renderer-stub.cjs');

test('worker lamps follow world dusk/dawn, pose and preview boundaries without RNG', () => {
  const h=modelHarness(), night=vm.runInContext('workerNightLight',h.context),
    poolMaterial=vm.runInContext('ALLOY_LIGHT_MATERIAL',h.context);
  vm.runInContext('Math.random = seeded = () => { throw Error("View RNG"); };',h.context);
  for(const hour of [6,12,17,18,undefined]) assert.equal(night(hour),0);
  for(const hour of [0,4,5,19,23.99]) assert.equal(night(hour),1);
  assert.equal(night(18.5),.5); assert.equal(night(5.5),.5);
  const e={id:17,kind:'unit',type:'worker',faction:0,team:0,hp:100,size:1,x:12,z:-7,rot:Math.PI/2};
  const draw=(hour,options={},quality=1,surface=null)=> {
    const r=createRendererStub({record:true});
    Object.assign(r,{battlefieldHour:hour,quality,surface});
    h.renderEntity(r,Object.freeze(e),9,options);
    return r.calls;
  };
  const lenses=calls=>calls.filter(c=>c[0]==='box'&&c[4]===.11&&c[5]===.07&&c[6]===.025);
  assert.ok(lenses(draw(12)).every(c=>c[11]===0));
  assert.ok(lenses(draw(18.5)).every(c=>c[11]>=1.2*.88&&c[11]<=1.2*1.12));
  assert.ok(lenses(draw(22)).every(c=>c[11]>=2.4*.88&&c[11]<=2.4*1.12));
  const pool=draw(22).find(c=>c[14]===poolMaterial);
  assert.ok(pool); assert.equal(pool[13],'effects');
  assert.equal(pool[1],13.65); assert.equal(pool[3],-7);
  assert.equal(draw(12).some(c=>c[14]===poolMaterial),false);
  for(const options of [{ghost:true},{tint:0x99e4c6},{alpha:.3},{layer:'effects'}]) {
    assert.ok(lenses(draw(22,options)).every(c=>c[11]===0));
    assert.equal(draw(22,options).some(c=>c[14]===poolMaterial),false);
  }
  assert.ok(lenses(draw(22,{},0)).every(c=>c[11]===2.4),'performance keeps lamps');
  assert.equal(draw(22,{},0).some(c=>c[14]===poolMaterial),false);
  const surface={entityHeight:()=>4,heightAt:(x)=>x>13.8?6:4};
  assert.equal(draw(22,{},1,surface).some(c=>c[14]===poolMaterial),false,'no pool bridging an uneven edge');
  const clock=vm.runInContext(`(() => {
    const r=Object.create(MeridianRenderer.prototype);
    r.battlefieldProfile=battlefieldAtmosphere({haze:[0,0,0]}, {timeOfDay:18}, 0);
    r.setBattlefieldTime(25);
    const evening=r.battlefieldHour;
    r.setBattlefieldTime(25);
    const paused=r.battlefieldHour;
    r.setBattlefieldTime(150);
    return [evening,paused,r.battlefieldHour];
  })()`,h.context);
  assert.deepEqual(Array.from(clock),[19,19,0],'same simulation time freezes lights; world hour wraps at midnight');
});
