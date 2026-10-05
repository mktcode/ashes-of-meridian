const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {modelHarness}=require('../helpers/model-contract.cjs');
const {createRendererStub}=require('../helpers/renderer-stub.cjs');

function draw(h,e,hour,options={},extra={}) {
  const r=createRendererStub({record:true}),lights=[],before=JSON.stringify(e);
  Object.assign(r,{battlefieldHour:hour,quality:0,...extra,addPointLight:(...args)=>lights.push(args)});
  h.renderEntity(r,Object.freeze(e),9,options);
  assert.equal(JSON.stringify(e),before,'no entity mutation');
  assert.ok(lights.every(l=>l.every(Number.isFinite)&&l[3]>0&&l[5]>0));
  return {calls:r.calls,lights};
}

function entities(h) {
  return [0,1,2].flatMap(faction=>['building','unit'].flatMap(kind=>
    Object.entries(kind==='building'?h.BUILDINGS:h.UNITS).map(([type,d])=>
      ({id:17,kind,type,faction,team:0,hp:d.hp,size:d.size,x:12,z:-7,rot:.7,walk:2,carry:10,progress:1}))));
}

test('every faction building and unit has posed night lights, unchanged geometry and preview isolation',()=>{
  const h=modelHarness({heavyModels:true});
  vm.runInContext('Math.random = seeded = () => { throw Error("View RNG"); };',h.context);
  const es=entities(h);
  assert.equal(es.length,3*(Object.keys(h.BUILDINGS).length+Object.keys(h.UNITS).length),'all faction models');
  for(const e of es) {
    const id=h.EntityModels.find(e)?.id;
    assert.ok(id,`${e.faction}/${e.kind}/${e.type} has a model`);
    const day=draw(h,e,12),night=draw(h,e,22);
    assert.deepEqual(day.calls,h.draw(e),'day pose remains the standard model presentation');
    assert.equal(night.lights.length,id==='faction-0/building/hq'||e.type==='researchspire'||e.type==='hearthtower'?2:1,`${id}: bounded model emitters`);
    assert.equal(night.calls.length,day.calls.length,`${id}: no extra geometry in performance mode`);
    let emissive=0;
    night.calls.forEach((c,i)=>{
      assert.deepEqual(c.filter((_,k)=>k!==11),day.calls[i].filter((_,k)=>k!==11),`${id}: only glow changes`);
      if(c[11]!==day.calls[i][11]) {
        emissive++;
        assert.ok(c[11]>day.calls[i][11]);
      }
    });
    assert.ok(emissive>0,`${id}: existing source becomes emissive`);
    for(const hour of [18.5,5.5]) {
      const half=draw(h,e,hour);
      night.lights.forEach((l,i)=>{
        assert.deepEqual(half.lights[i].slice(0,5),l.slice(0,5));
        assert.equal(half.lights[i][5],l[5]/2,`${id}: dusk/dawn intensity`);
      });
      half.calls.forEach((c,i)=>assert.ok(Math.abs(c[11]-(day.calls[i][11]+night.calls[i][11])/2)<1e-12));
    }
    for(const hour of [6,12,18,undefined])assert.equal(draw(h,e,hour).lights.length,0);
    for(const options of [{ghost:true},{tint:0x99e4c6},{alpha:.3},{layer:'effects'}]) {
      assert.equal(draw(h,e,22,options).lights.length,0);
      assert.deepEqual(draw(h,e,22,options).calls,draw(h,e,12,options).calls);
    }
    assert.deepEqual(draw(h,e,22,{}, {cinema:true}),night,'cinema retains all model night effects');
    assert.deepEqual(draw(h,{...e,hp:0},22),{calls:[],lights:[]});
    if(e.kind==='building') {
      assert.equal(draw(h,{...e,progress:.4},22).lights.length,0);
      assert.deepEqual(draw(h,{...e,progress:.4},22).calls,draw(h,{...e,progress:.4},12).calls);
    }
    for(const quality of [1,2])assert.equal(draw(h,e,22,{}, {quality}).lights.length,night.lights.length);
    const enemy=draw(h,{...e,team:1},22);
    assert.equal(enemy.lights.length,night.lights.length);
  }
});

test('noncivilian building lamps spread further with a softer peak, without changing civilian or unit lamps',()=>{
  const h=modelHarness({heavyModels:true}),noop=()=>{};
  for(const e of entities(h)){
    const authored=[];
    h.EntityModels.find(e).render({entity:e,time:9,nightLight:1,pointLight:(...args)=>authored.push(args),
      lightPool:noop,part:noop,nightPart:noop,ring:noop,metal:0,dark:0,team:0,accent:0,
      baseRotation:e.kind==='building'?h.BUILDING_YAW:e.rot,surfaceColor:c=>c});
    const actual=draw(h,e,22).lights,soften=e.kind==='building'&&!h.BUILDINGS[e.type].civilizationPoints;
    assert.equal(actual.length,authored.length);
    actual.forEach((l,i)=>{
      assert.equal(l[3],authored[i][3]*(soften?1.2:1),`${e.faction}/${e.type}: radius`);
      assert.equal(l[5],authored[i][5]*(soften?.8:1),`${e.faction}/${e.type}: intensity`);
    });
  }
});

test('local lamps share foundation/chassis frames and flying height; turret lamps follow aim',()=>{
  const h=modelHarness({heavyModels:true}),heightAt=(x,z)=>4+.2*x-.1*z;
  for(const e of entities(h)) {
    const ground=heightAt(e.x,e.z),surface={step:1.25,extent:60,heightAt,entityHeight:()=>ground,
      buildingPose:()=>({height:ground,dx:.2,dz:-.1})},flat=draw(h,e,22),posed=draw(h,e,22,{}, {surface});
    const rot=e.kind==='building'?h.BUILDING_YAW:e.rot,cs=Math.cos(rot),sn=Math.sin(rot),
      frame=vm.runInContext(e.kind==='building'
        ? `buildingGroundFrame({dx:.2,dz:-.1},${cs},${sn})`
        : `vehicleGroundFrame({heightAt:(x,z)=>4+.2*x-.1*z},${JSON.stringify(e)},${cs},${sn})`,h.context);
    const lift=vm.runInContext(`isFlyingUnitType('${e.type}') ? 3.8+Math.sin(18+17)*.22 : ${e.faction}===2 ? .3+Math.sin(18+17)*.08 : 0`,h.context);
    const baseLift=e.kind==='unit'?lift:0;
    flat.lights.forEach((l,i)=>{
      const wx=l[0]-e.x,wz=l[2]-e.z,lx=wx*cs-wz*sn,lz=wx*sn+wz*cs,ly=l[1]-baseLift;
      const expected=frame
        ? [e.x+frame[0]*lx+frame[3]*ly+frame[6]*lz,ground+baseLift+frame[1]*lx+frame[4]*ly+frame[7]*lz,e.z+frame[2]*lx+frame[5]*ly+frame[8]*lz]
        : [l[0],l[1]+ground,l[2]];
      expected.forEach((v,k)=>assert.ok(Math.abs(v-posed.lights[i][k])<1e-10,`${e.faction}/${e.type}: shared pose`));
    });
  }
  for(const faction of [0,1,2]) {
    const e=entities(h).find(e=>e.faction===faction&&e.type==='turret'),a=draw(h,e,22),b=draw(h,{...e,rot:e.rot+Math.PI/2},22);
    const [x,,z]=a.lights[0],[u,,v]=b.lights[0];
    assert.ok(Math.abs((u-e.x)-(z-e.z))<1e-10);
    assert.ok(Math.abs((v-e.z)+(x-e.x))<1e-10,'head lamp turns with weapon, not foundation');
  }
});
