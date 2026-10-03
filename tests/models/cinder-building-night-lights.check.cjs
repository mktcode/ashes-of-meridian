const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {modelHarness} = require('../helpers/model-contract.cjs');
const {createRendererStub} = require('../helpers/renderer-stub.cjs');

for(const type of ['hq','depot','barracks','factory','hangar','refinery','turret']) {
  test(`Cinder ${type}: existing trim emits at night without extra geometry or instances`, () => {
    const h=modelHarness(), definition=h.BUILDINGS[type],
      e={id:17,kind:'building',type,faction:0,team:0,hp:definition.hp,size:definition.size,x:12,z:-7,rot:.7,progress:1};
    vm.runInContext('Math.random = seeded = () => { throw Error("View RNG"); };',h.context);
    const draw=(hour,options={},entity=e,extra={})=> {
      const r=createRendererStub({record:true});
      Object.assign(r,{battlefieldHour:hour,quality:0,...extra});
      const before=JSON.stringify(entity);
      h.renderEntity(r,Object.freeze(entity),9,options);
      assert.equal(JSON.stringify(entity),before);
      return r.calls;
    };
    const day=draw(12), dusk=draw(18.5), night=draw(22);
    assert.deepEqual(day,h.draw(e),'established day presentation unchanged');
    assert.equal(night.length,day.length,'no halos, pools or additional model draws');
    let lamps=0;
    for(let i=0;i<day.length;i++) {
      assert.deepEqual(night[i].filter((_,k)=>k!==11),day[i].filter((_,k)=>k!==11),
        'same meshes, pose, colors, alpha, material and layer');
      if(night[i][11]!==day[i][11]) {
        lamps++;
        assert.equal(night[i][11],5,'bright emissive trim even in performance mode');
        assert.ok(Math.abs(dusk[i][11]-(day[i][11]+night[i][11])/2)<1e-12,'dusk fade');
      }
    }
    assert.ok(lamps>=3,'multiple existing decorative light surfaces');
    assert.ok(night.filter(c=>c[0].includes('Hull')||c[0].includes('Fittings')||c[0]==='turretBase'||c[0]==='turretHead')
      .every(c=>c[11]===0),'structural armor stays opaque and unlit');
    for(const options of [{ghost:true},{tint:0x99e4c6},{alpha:.3},{layer:'effects'}])
      assert.deepEqual(draw(22,options),draw(12,options),'no night enhancement in previews');
    assert.deepEqual(draw(22,{},e,{cinema:true}),draw(12,{},e,{cinema:true}));
    assert.deepEqual(draw(undefined),day);
    assert.deepEqual(draw(22,{}, {...e,progress:.4}),draw(12,{}, {...e,progress:.4}),'unfinished structures stay unchanged');
    assert.deepEqual(draw(22,{}, {...e,hp:0}),[]);
    for(const team of [0,1]) for(const quality of [1,2]) {
      const calls=draw(22,{}, {...e,team},{quality});
      assert.equal(calls.length,draw(12,{}, {...e,team},{quality}).length);
      assert.ok(calls.some(c=>c[11]>2.8),'balanced/high retain emission for existing bloom pass');
    }
    if(type==='depot') {
      const roof=night.filter(c=>c[0]==='box'&&c[4]===.16&&c[5]===.025&&c[6]===2.72),
        door=night.filter(c=>c[0]==='box'&&c[4]===1.1&&c[5]===.17&&c[6]===.035);
      assert.equal(roof.length,2); assert.equal(door.length,2);
      assert.ok([...roof,...door].every(c=>c[11]===5),'both screenshot-marked depot trims glow');
    }
    if(type==='hq') {
      for(const [sx,sy,sz] of [[.28,.03,1.1],[1.65,.17,1.65],[.85,.1,.85]]) {
        const marked=night.filter(c=>c[0]==='box'&&c[4]===sx&&c[5]===sy&&c[6]===sz);
        assert.ok(marked.length>0&&marked.every(c=>c[11]===5),'screenshot-marked ramp and roof panels glow');
      }
    }
  });
}
