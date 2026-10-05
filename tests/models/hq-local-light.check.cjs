const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {modelHarness}=require('../helpers/model-contract.cjs');
const {createRendererStub}=require('../helpers/renderer-stub.cjs');

test('HQ pilot registers two posed, dusk-controlled lights without new meshes or simulation state',()=>{
  const h=modelHarness(),d=h.BUILDINGS.hq,
    e={id:17,kind:'building',type:'hq',faction:0,team:0,hp:d.hp,size:d.size,x:12,z:-7,progress:1};
  vm.runInContext('Math.random = seeded = () => { throw Error("View RNG"); };',h.context);
  const draw=(hour,options={},entity=e,extra={})=>{
    const r=createRendererStub({record:true}),lights=[],before=JSON.stringify(entity);
    Object.assign(r,{battlefieldHour:hour,quality:1,...extra,addPointLight:(...args)=>lights.push(args)});
    h.renderEntity(r,Object.freeze(entity),9,options);
    assert.equal(JSON.stringify(entity),before);
    return {lights,calls:r.calls};
  };
  const night=draw(22),half=draw(18.5);
  assert.equal(night.lights.length,2);
  assert.deepEqual(night.lights.map(l=>l.slice(3)),[[14,0x75dce9,5],[10,0xffb65e,4]]);
  night.lights.forEach((l,i)=>{
    assert.deepEqual(half.lights[i].slice(0,5),l.slice(0,5));
    assert.equal(half.lights[i][5],l[5]/2);
  });
  for(const hour of [6,12,18,undefined])assert.equal(draw(hour).lights.length,0);
  for(const options of [{ghost:true},{tint:0x99e4c6},{alpha:.3},{layer:'effects'}])assert.equal(draw(22,options).lights.length,0);
  for(const entity of [{...e,progress:.4},{...e,hp:0}])assert.equal(draw(22,{},entity).lights.length,0);
  assert.deepEqual(draw(22,{},e,{cinema:true}).lights,night.lights);
  assert.equal(draw(22,{},e,{quality:0}).lights.length,2,'performance retains both lamps');
  const surface={step:1.25,extent:60,entityHeight:()=>4,heightAt:()=>4,buildingPose:()=>({height:4,dx:.2,dz:-.1})},
    frame=vm.runInContext('buildingGroundFrame({dx:.2,dz:-.1},Math.cos(BUILDING_YAW),Math.sin(BUILDING_YAW))',h.context),
    posed=draw(22,{},e,{surface});
  [[0,2.8,3.3],[1.6,4.8,-1.4]].forEach(([x,y,z],i)=>{
    const actual=posed.lights[i],expected=[e.x+frame[0]*x+frame[3]*y+frame[6]*z,4+frame[1]*x+frame[4]*y+frame[7]*z,e.z+frame[2]*x+frame[5]*y+frame[8]*z];
    expected.forEach((v,k)=>assert.ok(Math.abs(v-actual[k])<1e-12,'lights follow foundation slope and yaw'));
  });
  assert.equal(night.calls.length,draw(12).calls.length,'no extra light meshes/draws');
});
