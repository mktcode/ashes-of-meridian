const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const {modelHarness,assertMesh} = require('../helpers/model-contract.cjs');
const {assertRecessedMuzzle} = require('../helpers/unit-contract.cjs');
const {createRendererStub} = require('../helpers/renderer-stub.cjs');

function setup() {
  const h=modelHarness(),e={id:17,kind:'unit',type:'rifle',faction:0,team:0,x:12,z:-7,
    hp:h.UNITS.rifle.hp,size:h.UNITS.rifle.size,rot:0,walk:0,cd:0,order:{type:'stop'}};
  let descriptor;
  const isolated=vm.createContext({registerEntityModel:d=>descriptor=d});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../../dist/src/renderer/models/faction-0-unit-rifle.js'),'utf8'),isolated);
  assert.equal(descriptor.id,'faction-0/unit/rifle','registration needs no geometry, content, browser or GPU');
  isolated.geom=h.geom;isolated.ModelMesh=h.ModelMesh;
  const meshes=Object.fromEntries(Object.entries(descriptor.meshes).map(([name,factory])=>[name,factory()]));
  vm.runInContext('Math.random=seeded=()=>{throw Error("Model RNG")};for(const key of Object.keys(geom))geom[key]=()=>{throw Error("Per-frame geometry")}',h.context);
  function draw(entity=e,time=0,options={},extra={}) {
    const r=createRendererStub({record:true});Object.assign(r,extra);
    const before=JSON.stringify(entity);h.renderEntity(r,entity,time,options);
    assert.equal(JSON.stringify(entity),before,'view never mutates simulation');
    assert(r.calls.every(c=>c.slice(1,13).every(Number.isFinite)),'finite pose');
    return r.calls.filter(c=>c[0].startsWith('oathguard'));
  }
  return {h,e,descriptor,meshes,draw};
}
function transform(c,p) {
  const [x,y,z]=p,cy=Math.cos(c[8]),sy=Math.sin(c[8]),cx=Math.cos(c[9]),sx=Math.sin(c[9]),cz=Math.cos(c[10]),sz=Math.sin(c[10]);
  const xx=x*cz-y*sz,yy=x*sz+y*cz,vy=yy*cx-z*sx,vz=yy*sx+z*cx;
  return [c[1]+xx*cy+vz*sy,c[2]+vy,c[3]-xx*sy+vz*cy];
}

test('Oathguard: independent painted armor, closed meshes, two-handed rifle and recessed muzzle',()=>{
  const {h,e,descriptor,meshes,draw}=setup();
  assert.equal(h.EntityModels.find(e).id,descriptor.id);
  assert.notEqual(h.EntityModels.find({...e,type:'medic'}).id,descriptor.id);
  for(const faction of [1,2])assert.notEqual(h.EntityModels.find({...e,faction}).id,descriptor.id);
  for(const [name,factory] of Object.entries(descriptor.meshes)) {
    assertMesh(factory,{minTriangles:8,maxTriangles:4000,min:[-.8,0,-.6],max:[.8,2.06,1.36]});
    if(name.endsWith('Neutral'))for(let i=6;i<meshes[name].length;i+=9)assert.deepEqual(Array.from(meshes[name].slice(i,i+3)),[1,1,1]);
  }
  const normal=draw(),triangles=normal.reduce((n,c)=>n+meshes[c[0]].length/27,0);
  assert.equal(normal.length,13);assert(triangles<11000,'bounded detailed model');
  assertRecessedMuzzle(meshes.oathguardRifle,{x:.24,y:1.425,z:1.079,front:.075,recess:.035});
  const colors=new Set();for(const data of Object.values(meshes))for(let i=6;i<data.length;i+=9)colors.add(Array.from(data.slice(i,i+3)).join(','));
  assert(colors.has('0.12,0.32,0.34'),'petrol paint');assert(colors.has('0.78,0.73,0.58'),'ivory ceramic');assert(colors.has('0.85,0.27,0.075'),'orange marks');
  assert.equal(normal.find(c=>c[0]==='oathguardOptics')[7],0x38d9e8);
  assert.deepEqual(draw({...e,hp:0}),[]);
});

test('Oathguard: team markers, material/alpha overrides and neutral ghost/tint meshes',()=>{
  const {h,e,draw}=setup();
  for(const rot of [-2.1,0,.7])for(const team of [0,1]) {
    const state={...e,rot,team},own=draw(state),marker=own.find(c=>c[0]==='oathguardTeam');
    assert.equal(marker[7],team?0xe98680:h.FACTIONS[0].color);
    for(const options of [{ghost:true},{tint:0x99e4c6},{ghost:true,tint:0x99e4c6},
      {tint:0x99e4c6,alpha:.3,layer:'effects',material:h.MAT.AUTO}]) {
      const calls=draw(state,0,options),color=options.ghost?0x68717d:options.tint;
      assert(calls.every(c=>c[7]===color),'override affects every colored surface');
      assert(calls.filter(c=>!['oathguardOptics','oathguardTeam'].includes(c[0])).every(c=>c[0].endsWith('Neutral')));
      for(const c of calls)assert.deepEqual(c.slice(12),[options.alpha??1,options.layer||'dynamic',options.material??h.MAT.METAL]);
    }
    const alternate=draw(state,0,{localTeam:team});assert.equal(alternate.find(c=>c[0]==='oathguardTeam')[7],h.FACTIONS[0].color);
  }
});

test('Oathguard: movement-driven articulated legs, idle breathing, pause and planted stance feet',()=>{
  const {e,meshes,draw}=setup();
  const stand=draw(e,0);assert(!stand.some(c=>c[0]==='oathguardFlash'));
  assert.notDeepEqual(draw(e,.1).find(c=>c[0]==='oathguardTorso'),stand.find(c=>c[0]==='oathguardTorso'),'idle breath');
  let moved=false;
  for(let i=1;i<=60;i++) {
    e.walk+=.03;const calls=draw(e,.1+i*.05);
    if(i>5) {
      moved ||= calls.some(c=>c[0]==='oathguardLeftShin'&&Math.abs(c[9])>.05);
      for(const name of ['oathguardLeftBoot','oathguardRightBoot']) {
        const c=calls.find(c=>c[0]===name),data=meshes[name];
        for(let k=0;k<data.length;k+=9)assert(transform(c,data.slice(k,k+3))[1]>=-.002,'no foot through floor');
      }
    }
    assert.deepEqual(draw(e,.1+i*.05),calls,'paused simulation time freezes all poses');
  }
  assert(moved,'knee joints animate');
  for(let i=1;i<=8;i++)draw(e,3.1+i*.05);
  for(const c of draw(e,3.5).filter(c=>/Thigh|Shin|Boot/.test(c[0])))assert.deepEqual(c.slice(8,11),[0,0,0],'stopped unit settles to authored stance');
});

test('Oathguard: real cooldown shot impulses, fixed grip contacts and no unsolicited firing',()=>{
  const {h,e,draw}=setup();
  for(const cd of [undefined,0,.1,.49,-3])assert(!draw({...e,cd}).some(c=>c[0]==='oathguardFlash'),'spawn/idle cooldown is not a shot');
  for(const rot of [0,.7,-2.1])for(const age of [0,.02,.06,.12,.2]) {
    const calls=draw({...e,rot,cd:h.UNITS.rifle.reload-age},.5),rifle=calls.find(c=>c[0]==='oathguardRifle');
    for(const name of ['oathguardLeftArm','oathguardRightArm','oathguardTorso','oathguardOptics']) {
      const c=calls.find(c=>c[0]===name);
      assert.deepEqual(c.slice(1,7),rifle.slice(1,7));assert.deepEqual(c.slice(8,11),rifle.slice(8,11),'shared upper-body rig locks both grip targets and shoulder stock');
    }
    const flash=calls.find(c=>c[0]==='oathguardFlash');
    assert.equal(!!flash,age<.04);
    if(flash){assert.equal(flash[7],0x38d9e8);assert(flash[11]>1);}
  }
  const before=draw({...e,cd:h.UNITS.rifle.reload},0).find(c=>c[0]==='oathguardRifle'),
    recoiling=draw({...e,cd:h.UNITS.rifle.reload-.02},0).find(c=>c[0]==='oathguardRifle');
  assert.notDeepEqual(before.slice(8,11),recoiling.slice(8,11));
});
