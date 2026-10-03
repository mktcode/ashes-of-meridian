const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {modelHarness} = require('../helpers/model-contract.cjs');
const {createRendererStub} = require('../helpers/renderer-stub.cjs');

for(const faction of [0,1,2]) for(const type of ['rifle','medic','hero']) {
  test(`faction-${faction} ${type}: night accent, terrain pool and preview isolation`, () => {
    const h=modelHarness(), material=vm.runInContext('ALLOY_LIGHT_MATERIAL',h.context),
      definition=h.UNITS[type],
      e={id:17,kind:'unit',type,faction,team:0,hp:definition.hp,size:definition.size,x:12,z:-7,rot:.7,walk:2};
    vm.runInContext('Math.random = seeded = () => { throw Error("View RNG"); };',h.context);
    const draw=(hour,options={},extra={},entity=e)=> {
      const r=createRendererStub({record:true});
      Object.assign(r,{battlefieldHour:hour,quality:1,...extra});
      const before=JSON.stringify(entity);
      h.renderEntity(r,Object.freeze(entity),9,options);
      assert.equal(JSON.stringify(entity),before);
      return r.calls;
    };
    const pools=calls=>calls.filter(c=>c[14]===material),
      parts=calls=>calls.filter(c=>c[14]!==material),
      day=draw(12), dusk=draw(18.5), night=draw(22);
    assert.equal(pools(day).length,0);
    assert.equal(pools(night).length,1,'at most one extra instance, no extra model geometry');
    assert.equal(pools(dusk)[0][12],pools(night)[0][12]/2,'pool fades with world time');
    const dayParts=parts(day), duskParts=parts(dusk), nightParts=parts(night);
    assert.equal(nightParts.length,dayParts.length);
    let sources=0;
    for(let i=0;i<dayParts.length;i++) {
      const a=dayParts[i], b=nightParts[i], half=duskParts[i];
      assert.deepEqual(b.filter((_,k)=>k!==11),a.filter((_,k)=>k!==11),'pose, colors and animation unchanged');
      if(b[11]!==a[11]) {
        sources++;
        assert.ok(b[11]>a[11],'only the selected lamp/core brightens');
        assert.ok(Math.abs(half[11]-(a[11]+b[11])/2)<1e-12,'source fades smoothly too');
      }
    }
    assert.equal(sources,faction===2&&type==='medic'?2:1);
    for(const options of [{ghost:true},{tint:0x99e4c6},{alpha:.3},{layer:'effects'}]) {
      assert.deepEqual(draw(22,options),draw(12,options),'preview never acquires night effects');
    }
    assert.deepEqual(draw(22,{}, {cinema:true}),draw(12,{}, {cinema:true}));
    assert.deepEqual(draw(undefined),day,'no atmosphere means no additional lighting');
    assert.deepEqual(draw(22,{}, {},{...e,hp:0}),[]);
    assert.equal(pools(draw(22,{}, {quality:0})).length,0,'performance skips pools');
    assert.ok(parts(draw(22,{}, {quality:0})).some((c,i)=>c[11]>parts(draw(12,{}, {quality:0}))[i][11]),
      'performance retains bright sources');
    const heightAt=(x,z)=>4+.24*x-.28*z,
      surface={heightAt,entityHeight:()=>heightAt(e.x,e.z)},
      pool=pools(draw(22,{}, {surface}))[0];
    assert.ok(pool,'ordinary slope does not hide light');
    const vertices=[];
    h.ModelMesh.bake(vertices,h.geom.plane(),{
      x:pool[1],y:pool[2],z:pool[3],sx:pool[4],sy:pool[5],sz:pool[6],ry:pool[8],rx:pool[9],rz:pool[10]
    });
    for(let i=0;i<vertices.length;i+=9)
      assert.ok(Math.abs(vertices[i+1]-heightAt(vertices[i],vertices[i+2])-.025)<1e-9,'pool lies above CPU terrain');
    const cliff={entityHeight:()=>4,heightAt:x=>x>pool[1]+.2?7:4};
    assert.equal(pools(draw(22,{}, {surface:cliff})).length,0,'sharp edges still hide the pool');
    const enemy=pools(draw(22,{}, {},{...e,team:1}))[0];
    if(faction===1) assert.equal(enemy[7],0xe98680,'organic pool follows its team-colored source');
    else assert.equal(enemy[7],pools(night)[0][7],'fixed-color optics remain fixed across teams');
  });
}
